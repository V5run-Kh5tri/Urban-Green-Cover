import React, { useState } from "react";
import MapView from "./components/MapView";

function App() {
  const [selected, setSelected] = useState(null);
  const [sectorStats, setSectorStats] = useState([]);
  const [greenCover, setGreenCover] = useState(null);

  const sectors = Array.from({ length: 56 }, (_, i) =>
    `Sector_${i + 1 === 13 ? 14 : i + 1}` // skip Sector_13
  );

  const handleSelect = (sectorValue) => {
    if (!sectorValue) return;
    setSelected(sectorValue);

    const sectorName = sectorValue.replace("_", " ");
    const stat = sectorStats.find((s) => s.sector === sectorName);
    setGreenCover(stat ? stat.green_cover : "N/A");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Select Sector</h2>
      <select
        onChange={(e) => handleSelect(e.target.value)}
        defaultValue=""
        style={{ padding: "8px", fontSize: "16px", marginBottom: "10px" }}
      >
        <option value="" disabled>
          Choose a sector...
        </option>
        {sectors.map((sec) => (
          <option key={sec} value={sec}>
            {sec.replace("_", " ")}
          </option>
        ))}
      </select>

      {greenCover !== null && (
        <p style={{ fontSize: "18px", fontWeight: "bold" }}>
          🌿 Green Cover: {greenCover}%
        </p>
      )}

      <MapView selectedSector={selected} onStatsLoaded={setSectorStats} />
    </div>
  );
}

export default App;
