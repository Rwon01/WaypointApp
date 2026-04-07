import React, { useEffect, useState } from "react";
import Card, { CardContent } from "./components/Card";
import MapArea from "./components/MapArea";
import MapExplorer from "./components/MapExplorer";
import LoginPage from "./components/LoginPage";
import { CirclePicker } from "react-color";
import { isLoggedIn, clearToken, authFetch } from "./components/auth";

export default function App() {
  const [authed,  setAuthed]  = useState(false);
  const [checking, setChecking] = useState(true);
  const [page,    setPage]    = useState("waypoints");

  const [waypoints, setWaypoints] = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState({ name: "", x: "", z: "", color: "#ff0000" });
  const [color,     setColor]     = useState("#ff0000");

  const WP_URL = "/waypoints";

  // Check token on mount
  useEffect(() => {
    setAuthed(isLoggedIn());
    setChecking(false);
  }, []);

  // Fetch waypoints once authenticated
  useEffect(() => {
    if (!authed) return;
    authFetch(WP_URL)
      .then(r => {
        if (r.status === 401) { handleLogout(); return []; }
        return r.json();
      })
      .then(data => data && setWaypoints(data))
      .catch(err => console.error(err));
  }, [authed]);

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
    setWaypoints([]);
  };

  const handleAdd = async () => {
    try {
      const res = await authFetch(WP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, x: parseFloat(form.x), z: parseFloat(form.z), color: form.color }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (!res.ok) throw new Error("Failed to create waypoint");
      const data = await res.json();
      setWaypoints(prev => [...prev, data]);
      setForm({ name: "", x: "", z: "", color: "#ff0000" });
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await authFetch(`${WP_URL}/${id}`, { method: "DELETE" });
      if (res.status === 401) { handleLogout(); return; }
      if (!res.ok) throw new Error("Failed to delete");
      setWaypoints(prev => prev.filter(wp => wp.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) { console.error(err); }
  };

  const handleSelect = (wp) => {
    setSelected(wp);
    setForm({ name: wp.name, x: wp.x, z: wp.z, color: wp.color });
    setColor(wp.color);
  };

  const handleUpdate = async () => {
    try {
      const res = await authFetch(`${WP_URL}/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, x: parseFloat(form.x), z: parseFloat(form.z), color: form.color }),
      });
      if (res.status === 401) { handleLogout(); return; }
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setWaypoints(prev => prev.map(wp => wp.id === selected.id ? updated : wp));
    } catch {
      // Fall back to local update if PUT not implemented yet
      setWaypoints(prev => prev.map(wp =>
        wp.id === selected.id
          ? { ...wp, name: form.name, x: parseFloat(form.x), z: parseFloat(form.z), color: form.color }
          : wp
      ));
    }
    setSelected(null);
    setForm({ name: "", x: "", z: "", color: "#ff0000" });
    setColor("#ff0000");
  };

  const handleColorChange = (newColor) => {
    setColor(newColor.hex);
    setForm(f => ({ ...f, color: newColor.hex }));
  };

  if (checking) return null;
  if (!authed)  return <LoginPage onLogin={() => setAuthed(true)} />;

  return (
    <div className="flex flex-col h-screen">
      {/* Nav */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0, padding: "0 16px",
        background: "#1e293b", borderBottom: "1px solid #334155",
        flexShrink: 0, height: 44,
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, marginRight: 20, color: "#f1f5f9" }}>
          🗺 MC Map
        </span>

        {[
          { key: "waypoints", label: "Waypoints" },
          { key: "explorer",  label: "Chunk Explorer" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setPage(tab.key)} style={{
            padding: "0 16px", height: "100%",
            background: "transparent", border: "none",
            borderBottom: page === tab.key ? "2px solid #3b82f6" : "2px solid transparent",
            color: page === tab.key ? "#3b82f6" : "#94a3b8",
            fontWeight: page === tab.key ? 500 : 400,
            fontSize: 13, cursor: "pointer",
          }}>
            {tab.label}
          </button>
        ))}

        <button onClick={handleLogout} style={{
          marginLeft: "auto", padding: "4px 12px", borderRadius: 6,
          background: "transparent", border: "1px solid #334155",
          color: "#94a3b8", fontSize: 12, cursor: "pointer",
        }}>
          Sign out
        </button>
      </div>

      {/* Pages */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {page === "waypoints" && (
          <div className="flex" style={{ flex: 1, overflow: "hidden" }}>
            <div className="w-1/4 p-4 bg-gray-100 overflow-auto">
              <h2 className="text-xl mb-4">Waypoints</h2>
              <div className="space-y-2 mb-4">
                <input placeholder="Name"  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}  className="border p-1 w-full" />
                <input placeholder="X"     value={form.x}    onChange={e => setForm(f => ({ ...f, x: e.target.value }))}     className="border p-1 w-full" />
                <input placeholder="Z"     value={form.z}    onChange={e => setForm(f => ({ ...f, z: e.target.value }))}     className="border p-1 w-full" />
                <div>
                  <p>Selected color: <span style={{ color }}>{color}</span></p>
                  <CirclePicker color={color} onChangeComplete={handleColorChange} />
                </div>
                {selected ? (
                  <button onClick={handleUpdate} className="bg-blue-500 text-white px-2 py-1">Update</button>
                ) : (
                  <button onClick={handleAdd}    className="bg-green-500 text-white px-2 py-1">Add</button>
                )}
              </div>
              <div className="space-y-2">
                {waypoints.map(wp => (
                  <Card key={wp.id} className="cursor-pointer">
                    <CardContent className="flex justify-between items-center p-2">
                      <div onClick={() => handleSelect(wp)}>
                        <div className="font-bold">{wp.name}</div>
                        <div className="text-sm">X: {wp.x}, Z: {wp.z}</div>
                      </div>
                      <button onClick={() => handleDelete(wp.id)} className="text-red-500 px-2">X</button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <div className="flex-1 relative bg-gray-200">
              <MapArea waypoints={waypoints} setWaypoints={setWaypoints} />
            </div>
          </div>
        )}

        {page === "explorer" && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <MapExplorer />
          </div>
        )}
      </div>
    </div>
  );
}