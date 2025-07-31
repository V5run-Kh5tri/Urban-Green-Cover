from flask import Flask, jsonify
from flask_cors import CORS
import os
import requests
import geojson
from shapely.geometry import shape, Polygon, MultiPolygon
from tile_utils import calculate_green_cover_from_tiles
from dotenv import load_dotenv
import concurrent.futures
from threading import Lock
import time

load_dotenv()
app = Flask(__name__)
CORS(app)

MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN")
PORT = os.getenv("PORT", 8080)
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
ZOOM_LEVEL = 17

# Cache for sector data to avoid repeated API calls
sector_cache = {}
cache_lock = Lock()

# List of all Chandigarh sectors
CHANDIGARH_SECTORS = [
    "Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6",
    "Sector 7", "Sector 8", "Sector 9", "Sector 10", "Sector 11", "Sector 12",
    "Sector 13", "Sector 14", "Sector 15", "Sector 16", "Sector 17", "Sector 18",
    "Sector 19", "Sector 20", "Sector 21", "Sector 22", "Sector 23", "Sector 24",
    "Sector 25", "Sector 26", "Sector 27", "Sector 28", "Sector 29", "Sector 30",
    "Sector 31", "Sector 32", "Sector 33", "Sector 34", "Sector 35", "Sector 36",
    "Sector 37", "Sector 38", "Sector 39", "Sector 40", "Sector 41", "Sector 42",
    "Sector 43", "Sector 44", "Sector 45", "Sector 46", "Sector 47", "Sector 48",
    "Sector 49", "Sector 50", "Sector 51", "Sector 52", "Sector 53", "Sector 54",
    "Sector 55", "Sector 56"
]

def fetch_sector_geojson(sector_name):
    """Fetch GeoJSON data for a specific sector"""
    # Convert sector name format for Overpass query (space to dot)
    query_sector_name = sector_name.replace(" ", ".")
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    # Use your working query pattern but with geometry output
    query = f"""
    [out:json][timeout:25];
    area["name"="Chandigarh"]->.searchArea;
    (
      relation["boundary"="administrative"]["name"~"{query_sector_name}"](area.searchArea);
    );
    (._;>;);
    out geom;
    """
    
    try:
        print(f"Querying for {sector_name} (using {query_sector_name})")
        response = requests.get(overpass_url, params={'data': query}, timeout=30)
        
        if response.status_code != 200:
            print(f"Overpass API error: {response.status_code}")
            return None
            
        data = response.json()
        elements = data.get("elements", [])
        print(f"Found {len(elements)} elements for {sector_name}")
        
        if not elements:
            print(f"No elements found for {query_sector_name}")
            return None
            
        # Process the response
        geojson_result = process_overpass_response(elements, sector_name)
        return geojson_result
            
    except Exception as e:
        print(f"Error fetching sector data for {sector_name}: {e}")
        return None

def process_overpass_response(elements, sector_name):
    """Process Overpass API response into GeoJSON"""
    
    # Separate elements by type
    ways = {}
    nodes = {}
    relations = []
    
    for element in elements:
        if element["type"] == "node":
            nodes[element["id"]] = (element["lon"], element["lat"])
        elif element["type"] == "way":
            ways[element["id"]] = element
        elif element["type"] == "relation":
            relations.append(element)
    
    print(f"Found: {len(nodes)} nodes, {len(ways)} ways, {len(relations)} relations")
    
    # First try to process relations
    for relation in relations:
        polygon = build_polygon_from_relation(relation, ways, nodes)
        if polygon:
            return geojson.FeatureCollection([
                geojson.Feature(
                    geometry=polygon,
                    properties={
                        "name": sector_name,
                        "source": "relation",
                        "id": relation["id"]
                    }
                )
            ])
    
    # If no relation worked, try individual ways
    for way_id, way in ways.items():
        if "geometry" in way:
            coords = [(p["lon"], p["lat"]) for p in way["geometry"]]
            if len(coords) >= 4:
                try:
                    # Ensure closed polygon
                    if coords[0] != coords[-1]:
                        coords.append(coords[0])
                    
                    polygon = geojson.Polygon([coords])
                    return geojson.FeatureCollection([
                        geojson.Feature(
                            geometry=polygon,
                            properties={
                                "name": sector_name,
                                "source": "way",
                                "id": way_id
                            }
                        )
                    ])
                except Exception as e:
                    print(f"Error creating polygon from way: {e}")
                    continue
    
    return None

def build_polygon_from_relation(relation, ways, nodes):
    """Build a polygon from a relation's members"""
    try:
        outer_ways = []
        inner_ways = []
        
        # Collect way IDs for outer and inner roles
        for member in relation.get("members", []):
            if member["type"] == "way" and member["ref"] in ways:
                way = ways[member["ref"]]
                
                # Get coordinates from way geometry
                if "geometry" in way:
                    coords = [(p["lon"], p["lat"]) for p in way["geometry"]]
                elif "nodes" in way:
                    # Fallback: build coordinates from node references
                    coords = []
                    for node_id in way["nodes"]:
                        if node_id in nodes:
                            coords.append(nodes[node_id])
                else:
                    continue
                
                if len(coords) >= 2:
                    role = member.get("role", "")
                    if role == "outer" or role == "":
                        outer_ways.append(coords)
                    elif role == "inner":
                        inner_ways.append(coords)
        
        if not outer_ways:
            return None
        
        # Connect outer ways into a single ring
        outer_ring = connect_ways(outer_ways)
        if not outer_ring or len(outer_ring) < 4:
            return None
        
        # Ensure closed ring
        if outer_ring[0] != outer_ring[-1]:
            outer_ring.append(outer_ring[0])
        
        # Process inner rings
        inner_rings = []
        for inner_way_coords in inner_ways:
            inner_ring = connect_ways([inner_way_coords])
            if inner_ring and len(inner_ring) >= 4:
                if inner_ring[0] != inner_ring[-1]:
                    inner_ring.append(inner_ring[0])
                inner_rings.append(inner_ring)
        
        # Create GeoJSON polygon
        if inner_rings:
            return geojson.Polygon([outer_ring] + inner_rings)
        else:
            return geojson.Polygon([outer_ring])
            
    except Exception as e:
        print(f"Error building polygon from relation: {e}")
        return None

def connect_ways(way_list):
    """Connect multiple ways into a single coordinate list"""
    if len(way_list) == 1:
        return way_list[0]
    
    if not way_list:
        return []
    
    # Start with the first way
    result = way_list[0][:]
    remaining = way_list[1:]
    
    while remaining:
        connected = False
        last_point = result[-1]
        first_point = result[0]
        
        for i, way_coords in enumerate(remaining):
            way_start = way_coords[0]
            way_end = way_coords[-1]
            
            # Try to connect to the end of current result
            if last_point == way_start:
                result.extend(way_coords[1:])
                remaining.pop(i)
                connected = True
                break
            elif last_point == way_end:
                result.extend(reversed(way_coords[:-1]))
                remaining.pop(i)
                connected = True
                break
            # Try to connect to the beginning of current result
            elif first_point == way_end:
                result = way_coords[:-1] + result
                remaining.pop(i)
                connected = True
                break
            elif first_point == way_start:
                result = list(reversed(way_coords[1:])) + result
                remaining.pop(i)
                connected = True
                break
        
        if not connected:
            # Can't connect remaining ways - return what we have
            break
    
    return result

def calculate_sector_green_cover(sector_name):
    """Calculate green cover for a single sector"""
    try:
        geojson_data = fetch_sector_geojson(sector_name)
        if not geojson_data:
            return None
        
        polygons = []
        for feature in geojson_data["features"]:
            try:
                geom = shape(feature["geometry"])
                if isinstance(geom, (Polygon, MultiPolygon)) and geom.is_valid:
                    polygons.append(geom)
            except Exception as e:
                print(f"Error processing geometry for {sector_name}: {e}")
                continue
        
        if not polygons:
            return None
        
        # Merge polygons and get bounding box
        if len(polygons) == 1:
            merged = polygons[0]
        else:
            merged = MultiPolygon(polygons)
        
        bbox = merged.bounds  # (minx, miny, maxx, maxy)
        
        green_percent = calculate_green_cover_from_tiles(bbox, ZOOM_LEVEL, MAPBOX_TOKEN)
        
        return {
            "sector": sector_name,
            "green_cover": round(green_percent, 2),
            "geojson": geojson_data,
            "bbox": bbox
        }
        
    except Exception as e:
        print(f"Error calculating green cover for {sector_name}: {e}")
        return None

@app.route("/api/all-sectors")
def get_all_sectors():
    """Get all sectors with their green cover data"""
    print("Starting to fetch all sectors data...")
    
    # Check cache first
    with cache_lock:
        if sector_cache:
            print("Returning cached data")
            return jsonify(sector_cache)
    
    results = []
    failed_sectors = []
    
    # Process sectors in batches to avoid overwhelming the Overpass API
    batch_size = 5
    for i in range(0, len(CHANDIGARH_SECTORS), batch_size):
        batch = CHANDIGARH_SECTORS[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}: {batch}")
        
        # Use threading for parallel processing within each batch
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_to_sector = {
                executor.submit(calculate_sector_green_cover, sector): sector 
                for sector in batch
            }
            
            for future in concurrent.futures.as_completed(future_to_sector):
                sector = future_to_sector[future]
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                        print(f"✓ {sector}: {result['green_cover']}%")
                    else:
                        failed_sectors.append(sector)
                        print(f"✗ {sector}: Failed")
                except Exception as e:
                    failed_sectors.append(sector)
                    print(f"✗ {sector}: Exception - {e}")
        
        # Add a small delay between batches to be respectful to the API
        if i + batch_size < len(CHANDIGARH_SECTORS):
            time.sleep(2)
    
    # Create combined GeoJSON
    all_features = []
    sector_stats = []
    
    for result in results:
        # Add green_cover to each feature's properties
        for feature in result["geojson"]["features"]:
            feature["properties"]["green_cover"] = result["green_cover"]
            all_features.append(feature)
        
        sector_stats.append({
            "sector": result["sector"],
            "green_cover": result["green_cover"]
        })
    
    combined_geojson = geojson.FeatureCollection(all_features)
    
    response_data = {
        "geojson": combined_geojson,
        "sector_stats": sector_stats,
        "total_sectors": len(results),
        "failed_sectors": failed_sectors,
        "success_rate": f"{len(results)}/{len(CHANDIGARH_SECTORS)}"
    }
    
    # Cache the results
    with cache_lock:
        sector_cache.update(response_data)
    
    print(f"Completed: {len(results)} sectors processed successfully")
    return jsonify(response_data)

@app.route("/api/green-cover/<sector_name>")
def green_cover(sector_name):
    sector_name = sector_name.replace("_", " ")
    print(f"Calculating green cover for: {sector_name}")
    
    geojson_data = fetch_sector_geojson(sector_name)
    if not geojson_data:
        return jsonify({"error": f"Sector '{sector_name}' not found"}), 404
    
    polygons = []
    for feature in geojson_data["features"]:
        try:
            geom = shape(feature["geometry"])
            if isinstance(geom, (Polygon, MultiPolygon)) and geom.is_valid:
                polygons.append(geom)
                print(f"Valid polygon: area={geom.area:.6f}, bounds={geom.bounds}")
            else:
                print(f"Invalid geometry: {type(geom)}, valid={getattr(geom, 'is_valid', 'N/A')}")
        except Exception as e:
            print(f"Error processing geometry: {e}")
            continue
    
    if not polygons:
        return jsonify({"error": "No valid polygon found"}), 400
    
    # Merge polygons and get bounding box
    if len(polygons) == 1:
        merged = polygons[0]
    else:
        merged = MultiPolygon(polygons)
    
    bbox = merged.bounds  # (minx, miny, maxx, maxy)
    print(f"Bounding box: {bbox}")
    
    try:
        green_percent = calculate_green_cover_from_tiles(bbox, ZOOM_LEVEL, MAPBOX_TOKEN)
    except Exception as e:
        print(f"Error calculating green cover: {e}")
        return jsonify({"error": "Failed to calculate green cover"}), 500
    
    return jsonify({
        "sector": sector_name,
        "green_cover": round(green_percent, 2),
        "bbox": bbox
    })

@app.route("/api/sector-data/<sector_name>")
def get_sector_data(sector_name):
    sector_name = sector_name.replace("_", " ")

    geojson_data = fetch_sector_geojson(sector_name)
    if not geojson_data:
        return jsonify({"error": f"Sector '{sector_name}' not found"}), 404

    # Calculate green cover using your existing function
    polygons = []
    for feature in geojson_data["features"]:
        geom = shape(feature["geometry"])
        if isinstance(geom, (Polygon, MultiPolygon)) and geom.is_valid:
            polygons.append(geom)

    if not polygons:
        return jsonify({"error": "No valid polygon found"}), 400

    merged = MultiPolygon(polygons) if len(polygons) > 1 else polygons[0]
    bbox = merged.bounds  

    green_cover = calculate_green_cover_from_tiles(bbox, ZOOM_LEVEL, MAPBOX_TOKEN)

    # Attach green cover info to response
    return jsonify({
        "sector": sector_name,
        "green_cover": round(green_cover, 2),
        "geojson": geojson_data
    })

@app.route("/api/clear-cache")
def clear_cache():
    """Clear the sector cache"""
    with cache_lock:
        sector_cache.clear()
    return jsonify({"message": "Cache cleared successfully"})

# Debug endpoint
@app.route("/api/debug/<sector_name>")
def debug_sector(sector_name):
    """Debug what data is available for a sector"""
    overpass_url = "https://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:30];
    area["name"="Chandigarh"]->.searchArea;
    (
      relation["name"~"{sector_name}",i](area.searchArea);
      way["name"~"{sector_name}",i](area.searchArea);
    );
    out meta;
    """
    
    try:
        response = requests.get(overpass_url, params={'data': query}, timeout=30)
        data = response.json()
        
        debug_info = {
            "sector_name": sector_name,
            "total_elements": len(data.get("elements", [])),
            "relations": [],
            "ways": []
        }
        
        for element in data.get("elements", []):
            if element["type"] == "relation":
                debug_info["relations"].append({
                    "id": element["id"],
                    "tags": element.get("tags", {}),
                    "members_count": len(element.get("members", []))
                })
            elif element["type"] == "way":
                debug_info["ways"].append({
                    "id": element["id"],
                    "tags": element.get("tags", {}),
                    "nodes_count": len(element.get("nodes", []))
                })
        
        return jsonify(debug_info)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(PORT), debug=DEBUG)
