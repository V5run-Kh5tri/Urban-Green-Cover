import math
import requests
from PIL import Image
from io import BytesIO
import numpy as np

# -------------------------------
# Tile conversion helpers
# -------------------------------

def deg2num(lat_deg, lon_deg, zoom):
    """Convert latitude/longitude to XYZ tile numbers."""
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    return xtile, ytile


def tile_bounds(x, y, z):
    """Return bounding box of a tile in (lon_min, lat_min, lon_max, lat_max)."""
    n = 2.0 ** z
    lon_min = x / n * 360.0 - 180.0
    lat_max = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lon_max = (x + 1) / n * 360.0 - 180.0
    lat_min = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return (lon_min, lat_min, lon_max, lat_max)


def get_tile_url(x, y, z, token):
    """Mapbox Satellite tile URL."""
    return f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token={token}"


# -------------------------------
# Improved Green Cover Detection
# -------------------------------

def analyze_tile_image(img):
    """
    Analyze a satellite tile image using HSV-based vegetation detection.
    Returns number of green pixels and total pixels.
    """
    pixels = np.array(img) / 255.0  # normalize RGB to 0-1
    r, g, b = pixels[..., 0], pixels[..., 1], pixels[..., 2]

    # Compute HSV values (vectorized)
    maxc = np.max(pixels[..., :3], axis=-1)
    minc = np.min(pixels[..., :3], axis=-1)
    delta = maxc - minc

    # Hue calculation
    hue = np.zeros_like(maxc)
    mask = delta != 0
    hue[mask & (maxc == r)] = ((g - b) / delta)[mask & (maxc == r)]
    hue[mask & (maxc == g)] = (2.0 + (b - r) / delta)[mask & (maxc == g)]
    hue[mask & (maxc == b)] = (4.0 + (r - g) / delta)[mask & (maxc == b)]
    hue = (hue / 6.0) % 1.0  # normalize hue to 0-1
    hue_deg = hue * 360  # convert to degrees

    # Saturation and Value
    saturation = np.where(maxc == 0, 0, delta / maxc)
    value = maxc

    # Green detection mask: Hue ~35°-160°, moderately saturated and bright
    green_mask = (hue_deg >= 35) & (hue_deg <= 160) & (saturation > 0.25) & (value > 0.2)

    green_pixels = np.sum(green_mask)
    total_pixels = pixels.shape[0] * pixels.shape[1]

    return int(green_pixels), total_pixels


# -------------------------------
# Main Green Cover Calculator
# -------------------------------

def calculate_green_cover_from_tiles(bbox, zoom, mapbox_token):
    """
    Calculate green cover percentage for the given bounding box using Mapbox tiles.
    bbox: (min_lon, min_lat, max_lon, max_lat)
    """
    min_lon, min_lat, max_lon, max_lat = bbox

    # Determine which tiles cover the bounding box
    x_min, y_max = deg2num(min_lat, min_lon, zoom)
    x_max, y_min = deg2num(max_lat, max_lon, zoom)

    total_green = 0
    total_pixels = 0

    for x in range(min(x_min, x_max), max(x_min, x_max) + 1):
        for y in range(min(y_min, y_max), max(y_min, y_max) + 1):
            tile_url = get_tile_url(x, y, zoom, mapbox_token)
            response = requests.get(tile_url)

            if response.status_code == 200:
                img = Image.open(BytesIO(response.content)).convert("RGB")
                green, total = analyze_tile_image(img)
                total_green += green
                total_pixels += total
            else:
                print(f"⚠️ Failed to fetch tile {x},{y} at zoom {zoom}")

    return round((total_green / total_pixels) * 100, 2) if total_pixels else 0.0


# -------------------------------
# Example Usage
# -------------------------------
if __name__ == "__main__":
    MAPBOX_TOKEN = "<YOUR_MAPBOX_ACCESS_TOKEN>"
    ZOOM_LEVEL = 16  # Use 15 or 16 for better resolution

    # Example bounding box for Sector 56 Chandigarh (approx)
    bbox = (76.8035, 30.6885, 76.8195, 30.6995)

    green_cover = calculate_green_cover_from_tiles(bbox, ZOOM_LEVEL, MAPBOX_TOKEN)
    print(f"Green cover for bbox {bbox}: {green_cover}%")
