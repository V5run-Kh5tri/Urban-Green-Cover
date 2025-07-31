import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";


const MapView = ({ selectedSector }) => {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [sectorStats, setSectorStats] = useState([]);

  // Helper to decide color based on green cover %
  const getColor = (greenCover) => {
    if (greenCover < 20) return "#8B0000"; // Dark red
    if (greenCover < 30) return "#FF0000"; // Red
    if (greenCover < 40) return "#FF4500"; // Orange red
    if (greenCover < 50) return "#FF8C00"; // Dark orange
    if (greenCover < 60) return "#FFD700"; // Gold
    if (greenCover < 70) return "#ADFF2F"; // Green yellow
    if (greenCover < 80) return "#32CD32"; // Lime green
    return "#006400"; // Dark green
  };

  // Initialize map
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [76.7794, 30.7333],
      zoom: 11,
    });

    mapRef.current = map;

    map.on("load", () => {
      hasLoadedRef.current = true;
      map.resize();
      loadAllSectors();
    });

    return () => map.remove();
  }, []);

  // Load all sectors data
  const loadAllSectors = async () => {
    if (!mapRef.current || !hasLoadedRef.current) return;

    setLoading(true);
    setLoadingProgress("Fetching all sectors data...");

    try {
      const response = await fetch("http://localhost:8080/api/all-sectors");
      if (!response.ok) throw new Error("Failed to fetch sectors data");

      const data = await response.json();
      setLoadingProgress(`Loaded ${data.total_sectors} sectors successfully`);
      setSectorStats(data.sector_stats);

      const map = mapRef.current;

      // Remove existing layers if they exist
      if (map.getLayer("all-sectors-fill")) map.removeLayer("all-sectors-fill");
      if (map.getLayer("all-sectors-line")) map.removeLayer("all-sectors-line");
      if (map.getSource("all-sectors")) map.removeSource("all-sectors");

      // Color expression for green cover %
      const colorExpression = [
        "case",
        ["<", ["get", "green_cover"], 20], "#8B0000",
        ["<", ["get", "green_cover"], 30], "#FF0000",
        ["<", ["get", "green_cover"], 40], "#FF4500",
        ["<", ["get", "green_cover"], 50], "#FF8C00",
        ["<", ["get", "green_cover"], 60], "#FFD700",
        ["<", ["get", "green_cover"], 70], "#ADFF2F",
        ["<", ["get", "green_cover"], 80], "#32CD32",
        "#006400"
      ];

      // Add GeoJSON source
      map.addSource("all-sectors", {
        type: "geojson",
        data: data.geojson,
      });

      // Fill layer
      map.addLayer({
        id: "all-sectors-fill",
        type: "fill",
        source: "all-sectors",
        paint: {
          "fill-color": colorExpression,
          "fill-opacity": 0.6,
        },
      });

      // Boundary layer
      map.addLayer({
        id: "all-sectors-line",
        type: "line",
        source: "all-sectors",
        paint: {
          "line-color": colorExpression,
          "line-width": 2,
        },
      });

      // Hover cursor
      map.on("mouseenter", "all-sectors-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "all-sectors-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // Popup on click (with null check)
      map.on("click", "all-sectors-fill", (e) => {
        if (!e.features || e.features.length === 0) return;
        const properties = e.features[0].properties;

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="padding: 10px;">
              <h3 style="margin: 0 0 10px 0; color: #333;">${properties.name}</h3>
              <p style="margin: 0; font-size: 14px;">
                <strong>Green Cover:</strong> ${properties.green_cover}%
              </p>
              <div style="width: 100%; height: 10px; background: #eee; border-radius: 5px; margin-top: 8px;">
                <div style="width: ${properties.green_cover}%; height: 100%; background: ${getColor(properties.green_cover)}; border-radius: 5px;"></div>
              </div>
            </div>`
          )
          .addTo(map);
      });

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      data.geojson.features.forEach((feature) => {
        const { type, coordinates } = feature.geometry;
        if (type === "Polygon") {
          coordinates[0].forEach((coord) => bounds.extend(coord));
        } else if (type === "MultiPolygon") {
          coordinates.forEach((polygon) =>
            polygon[0].forEach((coord) => bounds.extend(coord))
          );
        }
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50 });
      }

      setLoadingProgress("");
      setTimeout(() => setLoading(false), 1000);
    } catch (error) {
      console.error("Error loading sectors:", error);
      setLoadingProgress("Error loading sectors data");
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress("");
      }, 2000);
    }
  };

  // Highlight selected sector
  useEffect(() => {
    if (!selectedSector || !mapRef.current || !hasLoadedRef.current) return;

    const map = mapRef.current;
    if (!map.getSource("all-sectors")) return;

    const features = map.querySourceFeatures("all-sectors");
    const sectorFeature = features.find(
      (feature) => feature.properties.name === selectedSector
    );

    if (sectorFeature) {
      const bounds = new mapboxgl.LngLatBounds();
      const { type, coordinates } = sectorFeature.geometry;

      if (type === "Polygon") {
        coordinates[0].forEach((coord) => bounds.extend(coord));
      } else if (type === "MultiPolygon") {
        coordinates.forEach((polygon) =>
          polygon[0].forEach((coord) => bounds.extend(coord))
        );
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 100, duration: 1000 });
      }
    } else {
      console.warn(`No feature found for sector: ${selectedSector}`);
    }
  }, [selectedSector]);

  // Calculate stats
  const getStats = () => {
    if (sectorStats.length === 0) return null;

    const sorted = [...sectorStats].sort((a, b) => b.green_cover - a.green_cover);
    const average =
      sectorStats.reduce((sum, s) => sum + s.green_cover, 0) / sectorStats.length;

    return {
      total: sectorStats.length,
      average: average.toFixed(1),
      highest: sorted[0],
      lowest: sorted[sorted.length - 1],
    };
  };

  const stats = getStats();

  return (
    <div style={{ position: "relative" }}>
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "white",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            fontSize: "18px",
          }}
        >
          <div>Loading Chandigarh Sectors...</div>
          <div style={{ marginTop: "10px", fontSize: "14px" }}>
            {loadingProgress}
          </div>
          <div style={{ marginTop: "20px" }}>
            <div
              className="spinner"
              style={{
                border: "4px solid #f3f3f3",
                borderTop: "4px solid #3498db",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                animation: "spin 2s linear infinite",
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Statistics panel */}
      {stats && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            padding: "15px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            zIndex: 100,
            minWidth: "250px",
            fontSize: "14px",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>
            Green Cover Statistics
          </h4>
          <div>
            <strong>Total Sectors:</strong> {stats.total}
          </div>
          <div>
            <strong>Average:</strong> {stats.average}%
          </div>
          <div>
            <strong>Highest:</strong> {stats.highest.sector} (
            {stats.highest.green_cover}%)
          </div>
          <div>
            <strong>Lowest:</strong> {stats.lowest.sector} (
            {stats.lowest.green_cover}%)
          </div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          padding: "15px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          zIndex: 100,
          fontSize: "12px",
        }}
      >
        <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>
          Green Cover Legend
        </h4>
        {[
          { range: "80%+", color: "#006400" },
          { range: "70-80%", color: "#32CD32" },
          { range: "60-70%", color: "#ADFF2F" },
          { range: "50-60%", color: "#FFD700" },
          { range: "40-50%", color: "#FF8C00" },
          { range: "30-40%", color: "#FF4500" },
          { range: "20-30%", color: "#FF0000" },
          { range: "<20%", color: "#8B0000" },
        ].map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "5px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "15px",
                backgroundColor: item.color,
                marginRight: "8px",
                border: "1px solid #ccc",
              }}
            ></div>
            <span>{item.range}</span>
          </div>
        ))}
      </div>

      {/* Refresh button */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 100,
        }}
      >
        <button
          onClick={() => {
            fetch("http://localhost:8080/api/clear-cache")
              .then(() => loadAllSectors())
              .catch(console.error);
          }}
          style={{
            padding: "10px 15px",
            backgroundColor: "#007cbf",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "14px",
          }}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh Data"}
        </button>
      </div>

      {/* Map container */}
      <div
        ref={mapContainer}
        style={{
          height: "600px",
          width: "100%",
          border: "1px solid #ccc",
          marginTop: "1rem",
        }}
      />

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MapView;
