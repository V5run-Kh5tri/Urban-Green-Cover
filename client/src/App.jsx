import React, { useState, useEffect, useMemo } from "react";
import MapView from "./components/MapView";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function App() {
  const [selected, setSelected] = useState(null);
  const [sectorStats, setSectorStats] = useState([]);
  const [greenCover, setGreenCover] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [searchTerm, setSearchTerm] = useState('');

  const sectors = Array.from({ length: 56 }, (_, i) =>
    `Sector_${i + 1 === 13 ? 14 : i + 1}` // skip Sector_13
  );

  // Filter sectors based on search
  const filteredSectors = sectors.filter(sector =>
    sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (sectorValue) => {
    if (!sectorValue) return;
    setSelected(sectorValue);
    const sectorName = sectorValue.replace("_", " ");
    const stat = sectorStats.find((s) => s.sector === sectorName);
    setGreenCover(stat ? stat.green_cover : "N/A");
  };

  // Advanced analytics calculations
  const analytics = useMemo(() => {
    if (sectorStats.length === 0) return null;

    const sorted = [...sectorStats].sort((a, b) => b.green_cover - a.green_cover);
    const total = sectorStats.length;
    const average = sectorStats.reduce((sum, s) => sum + s.green_cover, 0) / total;
    
    // Critical zones (below 30% green cover)
    const criticalZones = sectorStats.filter(s => s.green_cover < 43.5);
    const goodZones = sectorStats.filter(s => s.green_cover >= 52);
    const moderateZones = sectorStats.filter(s => s.green_cover >= 43.5 && s.green_cover < 52);

    // Performance categories
    const categories = [
      { name: 'Critical (<30%)', value: criticalZones.length, color: '#DC2626' },
      { name: 'Moderate (30-60%)', value: moderateZones.length, color: '#F59E0B' },
      { name: 'Good (≥60%)', value: goodZones.length, color: '#059669' }
    ];

    // Top and bottom performers
    const topPerformers = sorted.slice(0, 5);
    const bottomPerformers = sorted.slice(-5).reverse();

    return {
      total,
      average: average.toFixed(1),
      highest: sorted[0],
      lowest: sorted[sorted.length - 1],
      criticalZones,
      goodZones,
      moderateZones,
      categories,
      topPerformers,
      bottomPerformers
    };
  }, [sectorStats]);

  // Chart data for visualization
  const chartData = useMemo(() => {
    if (!sectorStats.length) return [];
    
    return sectorStats
      .sort((a, b) => b.green_cover - a.green_cover)
      .slice(0, 10)
      .map(sector => ({
        name: sector.sector.replace('Sector ', 'S'),
        greenCover: sector.green_cover
      }));
  }, [sectorStats]);

  return (
    <div style={{ 
      padding: "0", 
      minHeight: "100vh", 
      backgroundColor: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      {/* Header Dashboard */}
      <div style={{
        background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
        color: "white",
        padding: "20px 30px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1 style={{ 
            margin: "0 0 10px 0", 
            fontSize: "28px", 
            fontWeight: "700" 
          }}>
            🌿 Chandigarh Green Cover Analytics Dashboard
          </h1>
          <p style={{ 
            margin: "0", 
            fontSize: "16px", 
            opacity: "0.9" 
          }}>
            Real-time environmental monitoring across 56 urban sectors
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 30px"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "0" }}>
            {[
              { key: 'map', label: '🗺️ Interactive Map', desc: 'Sector visualization' },
              { key: 'analytics', label: '📊 Analytics', desc: 'Performance metrics' },
              { key: 'critical', label: '⚠️ Critical Zones', desc: 'Intervention needed' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key)}
                style={{
                  background: activeView === tab.key ? "#f0fdf4" : "transparent",
                  border: "none",
                  padding: "16px 24px",
                  cursor: "pointer",
                  borderBottom: activeView === tab.key ? "3px solid #059669" : "3px solid transparent",
                  fontSize: "14px",
                  fontWeight: activeView === tab.key ? "600" : "500",
                  color: activeView === tab.key ? "#059669" : "#6b7280",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.2s"
                }}
              >
                <span>{tab.label}</span>
                <span style={{ fontSize: "11px", opacity: "0.7" }}>{tab.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "30px" }}>
        
        {/* Key Metrics Cards */}
        {analytics && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "30px"
          }}>
            <div style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#059669" }}>
                {analytics.total}
              </div>
              <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Total Sectors Analyzed
              </div>
            </div>

            <div style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#3b82f6" }}>
                {analytics.average}%
              </div>
              <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Average Green Cover
              </div>
            </div>

            <div style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#dc2626" }}>
                {analytics.criticalZones.length}
              </div>
              <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Critical Zones Flagged
              </div>
            </div>

            <div style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#059669" }}>
                {analytics.goodZones.length}
              </div>
              <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Well-Performing Sectors
              </div>
            </div>
          </div>
        )}

        {/* Map View */}
        {activeView === 'map' && (
          <div>
            {/* Sector Selection */}
            <div style={{
              background: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid #e5e7eb",
              marginBottom: "20px"
            }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600" }}>
                Sector Analysis
              </h3>
              
              <div style={{ 
                display: "flex", 
                gap: "16px", 
                alignItems: "center",
                flexWrap: "wrap"
              }}>
                <div style={{ flex: "1", minWidth: "200px" }}>
                  <input
                    type="text"
                    placeholder="Search sectors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      fontSize: "14px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
                
                <div style={{ flex: "2", minWidth: "250px" }}>
                  <select
                    onChange={(e) => handleSelect(e.target.value)}
                    defaultValue=""
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      fontSize: "14px",
                      backgroundColor: "white",
                      boxSizing: "border-box"
                    }}
                  >
                    <option value="" disabled>
                      Choose a sector to analyze...
                    </option>
                    {filteredSectors.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {greenCover !== null && (
                  <div style={{
                    padding: "10px 16px",
                    backgroundColor: greenCover < 30 ? "#fef2f2" : greenCover < 60 ? "#fffbeb" : "#f0fdf4",
                    border: `1px solid ${greenCover < 30 ? "#fecaca" : greenCover < 60 ? "#fed7aa" : "#bbf7d0"}`,
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: greenCover < 30 ? "#dc2626" : greenCover < 60 ? "#d97706" : "#059669"
                  }}>
                    🌿 {greenCover}% Green Cover
                  </div>
                )}
              </div>
            </div>

            <MapView selectedSector={selected} onStatsLoaded={setSectorStats} />
          </div>
        )}

        {/* Analytics View */}
        {activeView === 'analytics' && analytics && (
          <div style={{ display: "grid", gap: "24px" }}>
            {/* Performance Distribution */}
            <div style={{
              background: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid #e5e7eb"
            }}>
              <h3 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "600" }}>
                Green Cover Distribution
              </h3>
              <div style={{ display: "flex", gap: "40px", alignItems: "center" }}>
                <div style={{ flex: "1" }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={analytics.categories}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({name, value}) => `${name}: ${value}`}
                      >
                        {analytics.categories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: "1" }}>
                  {analytics.categories.map((category, index) => (
                    <div key={index} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                      padding: "8px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "6px"
                    }}>
                      <div style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: category.color,
                        borderRadius: "4px"
                      }}></div>
                      <span style={{ fontSize: "14px", fontWeight: "500" }}>
                        {category.name}: {category.value} sectors
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Performers Chart */}
            <div style={{
              background: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid #e5e7eb"
            }}>
              <h3 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "600" }}>
                Top 10 Performing Sectors
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Green Cover']}
                    labelFormatter={(label) => `Sector ${label.replace('S', '')}`}
                  />
                  <Bar dataKey="greenCover" fill="#059669" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Critical Zones View */}
        {activeView === 'critical' && analytics && (
          <div style={{
            background: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px"
            }}>
              <span style={{ fontSize: "24px" }}>⚠️</span>
              <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "600", color: "#dc2626" }}>
                Critical Zones Requiring Intervention ({analytics.criticalZones.length} sectors)
              </h3>
            </div>
            
            <p style={{ color: "#6b7280", marginBottom: "24px", fontSize: "14px" }}>
              These sectors have less than 30% green cover and require immediate environmental intervention.
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px"
            }}>
              {analytics.criticalZones.map((sector, index) => (
                <div
                  key={index}
                  style={{
                    padding: "16px",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    backgroundColor: "#fef2f2",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onClick={() => handleSelect(sector.sector.replace(' ', '_'))}
                  onMouseEnter={(e) => e.target.style.transform = "translateY(-2px)"}
                  onMouseLeave={(e) => e.target.style.transform = "translateY(0px)"}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px"
                  }}>
                    <h4 style={{ margin: "0", fontSize: "16px", fontWeight: "600" }}>
                      {sector.sector}
                    </h4>
                    <span style={{
                      padding: "4px 8px",
                      backgroundColor: "#dc2626",
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {sector.green_cover}%
                    </span>
                  </div>
                  <div style={{
                    width: "100%",
                    height: "6px",
                    backgroundColor: "#fecaca",
                    borderRadius: "3px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${sector.green_cover}%`,
                      height: "100%",
                      backgroundColor: "#dc2626",
                      borderRadius: "3px"
                    }}></div>
                  </div>
                  <p style={{
                    margin: "8px 0 0 0",
                    fontSize: "12px",
                    color: "#991b1b"
                  }}>
                    Priority: HIGH - Immediate intervention required
                  </p>
                </div>
              ))}
            </div>

            {analytics.criticalZones.length === 0 && (
              <div style={{
                textAlign: "center",
                padding: "40px",
                color: "#6b7280"
              }}>
                <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>🎉</span>
                <h4 style={{ margin: "0 0 8px 0", color: "#059669" }}>Great News!</h4>
                <p style={{ margin: "0", fontSize: "14px" }}>
                  No critical zones found. All sectors have adequate green cover.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;