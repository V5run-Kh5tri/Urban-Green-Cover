import React, { useEffect, useState } from "react";
import MapView from "./components/MapView";

function App() {
  const [selected, setSelected] = useState(null);
  const [greenCover, setGreenCover] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const sectors = [
        "Sector_1", "Sector_2", "Sector_3", "Sector_4", "Sector_5",
        "Sector_6", "Sector_7", "Sector_8", "Sector_9", "Sector_10",
        "Sector_11", "Sector_12", "Sector_14", "Sector_15", "Sector_16",
        "Sector_17", "Sector_18", "Sector_19", "Sector_20", "Sector_21",
        "Sector_22", "Sector_23", "Sector_24", "Sector_25", "Sector_26",
        "Sector_27", "Sector_28", "Sector_29", "Sector_30", "Sector_31",
        "Sector_32", "Sector_33", "Sector_34", "Sector_35", "Sector_36",
        "Sector_37", "Sector_38", "Sector_39", "Sector_40", "Sector_41",
        "Sector_42", "Sector_43", "Sector_44", "Sector_45", "Sector_46",
        "Sector_47", "Sector_48", "Sector_49", "Sector_50", "Sector_51",
        "Sector_52", "Sector_53", "Sector_54", "Sector_55", "Sector_56"
      ];

  const handleSelect = (sectorValue) => {
    if (!sectorValue) return;
    setSelected(sectorValue);
    setLoading(true);
    setError(null);
    setGreenCover(null);
    
    console.log("Fetching green cover for:", sectorValue);
    
    fetch(`http://localhost:8080/api/green-cover/${sectorValue.replace("_", " ")}`)
      .then(res => {
        console.log("Response status:", res.status);
        if (!res.ok) {
          return res.json().then(err => {
            throw new Error(err.error || "Failed to calculate green cover");
          });
        }
        return res.json();
      })
      .then(data => {
        console.log("Green cover data:", data);
        setGreenCover(data.green_cover);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error:", err);
        setError(err.message);
        setGreenCover("N/A");
        setLoading(false);
      });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Select Sector</h2>
      <select 
        onChange={(e) => handleSelect(e.target.value)} 
        defaultValue=""
        style={{ padding: "8px", fontSize: "16px", marginBottom: "10px" }}
      >
        <option value="" disabled>Choose a sector...</option>
        {sectors.map(sec => (
          <option key={sec} value={sec}>
            {sec.replace("_", " ")}
          </option>
        ))}
      </select>

      {loading && <p>🔄 Calculating green cover...</p>}
      
      {error && <p style={{ color: "red" }}>❌ Error: {error}</p>}
      
      {greenCover !== null && !loading && (
        <p style={{ fontSize: "18px", fontWeight: "bold" }}>
          🌿 Green Cover: {greenCover}%
        </p>
      )}
      
      <MapView selectedSector={selected} />
    </div>
  );
}

export default App;