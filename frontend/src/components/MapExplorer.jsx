import { useEffect, useRef, useState, useCallback } from "react";
import { authFetch } from "./auth";
import {
  getCachedTile,
  setCachedTile,
  deleteCachedTile,
  getCachedTileByCoords,
} from "./tileCache";

const TILE_SIZE   = 1024;
const MIN_SCALE   = 0.00005;
const MAX_SCALE   = 4;
const ZOOM_FACTOR = 0.0015;
const TILES_URL   = "/tiles";
const WP_URL      = "/waypoints";
const LOD_SIZES   = [1024, 256, 64, 16];

function pickLod(tile, screenPixels) {
  for (let i = LOD_SIZES.length - 1; i >= 0; i--) {
    if (LOD_SIZES[i] >= screenPixels * 0.5) return tile.lods[i];
  }
  return tile.lods[0];
}

function downscale(src, targetSize) {
  const dst = document.createElement("canvas");
  dst.width = dst.height = targetSize;
  const ctx = dst.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, targetSize, targetSize);
  return dst;
}

async function processBlob(blob) {
  const url = URL.createObjectURL(blob);
  const img  = await new Promise((res, rej) => {
    const i = new Image();
    i.onload  = () => { URL.revokeObjectURL(url); res(i); };
    i.onerror = () => { URL.revokeObjectURL(url); rej(); };
    i.src = url;
  });

  const full = document.createElement("canvas");
  full.width = full.height = TILE_SIZE;
  const ctx  = full.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 15 && d[i + 1] < 15 && d[i + 2] < 15) d[i + 3] = 0;
  }
  ctx.putImageData(imageData, 0, 0);

  const lods = [full, ...LOD_SIZES.slice(1).map(s => downscale(full, s))];
  return lods;
}

export default function MapExplorer() {
  const canvasRef      = useRef(null);
  const tilesRef       = useRef([]);
  const waypointsRef   = useRef([]);
  const cameraRef      = useRef({ x: 0, z: 0 });
  const scaleRef       = useRef(0.25);
  const dragging       = useRef(false);
  const lastPos        = useRef({ x: 0, y: 0 });
  const animFrameRef   = useRef(null);
  const cursorElRef    = useRef(null);
  const statsElRef     = useRef(null);

  const [isDragOver,   setIsDragOver]   = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [wpPopup,      setWpPopup]      = useState(null);
  const [wpForm,       setWpForm]       = useState({ name: "", color: "#ff0000" });

  const getCanvas = () => canvasRef.current;

  // ── Draw ──────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx   = canvas.getContext("2d");
    const camX  = cameraRef.current.x;
    const camZ  = cameraRef.current.z;
    const scale = scaleRef.current;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const viewLeft   = camX - W / 2 / scale;
    const viewRight  = camX + W / 2 / scale;
    const viewTop    = camZ - H / 2 / scale;
    const viewBottom = camZ + H / 2 / scale;

    drawGrid(ctx, W, H, camX, camZ, scale, viewLeft, viewRight, viewTop, viewBottom);
    drawAxes(ctx, W, H, camX, camZ, scale);

    const tileScreenPx = TILE_SIZE * scale;
    let visible = 0;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = tileScreenPx > 256 ? "high" : "low";

    for (const tile of tilesRef.current) {
      if (!tile.lods) continue;
      if (tile.x + TILE_SIZE < viewLeft  || tile.x > viewRight)  continue;
      if (tile.z + TILE_SIZE < viewTop   || tile.z > viewBottom) continue;
      visible++;
      const sx = Math.floor(W / 2 + (tile.x - camX) * scale);
      const sz = Math.floor(H / 2 + (tile.z - camZ) * scale);
      const sw = Math.ceil(tileScreenPx);
      const sh = Math.ceil(tileScreenPx);
      ctx.drawImage(pickLod(tile, tileScreenPx), sx, sz, sw, sh);
    }

    for (const wp of waypointsRef.current) {
      const sx = W / 2 + (wp.x - camX) * scale;
      const sz = H / 2 + (wp.z - camZ) * scale;
      ctx.beginPath();
      ctx.arc(sx, sz, 5, 0, Math.PI * 2);
      ctx.fillStyle   = wp.color || "#ff0000";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth   = 1;
      ctx.stroke();
      if (scale > 0.002) {
        ctx.fillStyle    = "#f1f5f9";
        ctx.font         = `bold ${Math.min(13, Math.max(9, scale * 400))}px monospace`;
        ctx.shadowColor  = "rgba(0,0,0,0.8)";
        ctx.shadowBlur   = 3;
        ctx.fillText(wp.name, sx + 7, sz - 4);
        ctx.shadowBlur   = 0;
      }
    }

    const ox = W / 2 + (0 - camX) * scale;
    const oz = H / 2 + (0 - camZ) * scale;
    if (ox > -10 && ox < W + 10 && oz > -10 && oz < H + 10) {
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(ox, oz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(148,210,255,0.9)";
      ctx.font      = "11px monospace";
      ctx.fillText("0,0", ox + 7, oz - 4);
    }

    if (statsElRef.current) {
      statsElRef.current.textContent =
        `${tilesRef.current.length} tiles · ${visible} visible · ${waypointsRef.current.length} waypoints`;
    }
  }, []);

  function drawGrid(ctx, W, H, camX, camZ, scale, vL, vR, vT, vB) {
    let gridSize = TILE_SIZE;
    const minPx = 60;
    while (gridSize * scale < minPx)     gridSize *= 2;
    while (gridSize * scale > minPx * 8) gridSize /= 2;
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.lineWidth   = 0.5;
    const startX = Math.floor(vL / gridSize) * gridSize;
    const startZ = Math.floor(vT / gridSize) * gridSize;
    for (let x = startX; x <= vR; x += gridSize) {
      const sx = W / 2 + (x - camX) * scale;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let z = startZ; z <= vB; z += gridSize) {
      const sz = H / 2 + (z - camZ) * scale;
      ctx.beginPath(); ctx.moveTo(0, sz); ctx.lineTo(W, sz); ctx.stroke();
    }
    if (scale < 0.04) {
      ctx.fillStyle = "rgba(100,116,139,0.45)";
      ctx.font      = "10px monospace";
      for (let x = startX; x <= vR; x += gridSize)
        for (let z = startZ; z <= vB; z += gridSize)
          ctx.fillText(`${x},${z}`, W / 2 + (x - camX) * scale + 3, H / 2 + (z - camZ) * scale + 10);
    }
  }

  function drawAxes(ctx, W, H, camX, camZ, scale) {
    const ox = W / 2 - camX * scale;
    const oz = H / 2 - camZ * scale;
    ctx.save();
    ctx.strokeStyle = "rgba(59,130,246,0.1)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oz); ctx.lineTo(W, oz); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
    ctx.restore();
  }

  const scheduleDraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // ── Load tile: IndexedDB first, then network ──────────────────────────────

  const loadTile = useCallback(async (tileMeta) => {
    try {
      let blob;
      const cached = await getCachedTile(tileMeta.gridFsId);

      if (cached) {
        blob = cached.blob;
      } else {
        const res = await authFetch(`${TILES_URL}/files/${tileMeta.gridFsId}`);
        if (!res.ok) return { ...tileMeta, lods: null };
        blob = await res.blob();
        // Cache it for next time
        await setCachedTile(tileMeta.gridFsId, blob, tileMeta.x, tileMeta.z);
      }

      const lods = await processBlob(blob);
      scheduleDraw();
      return { ...tileMeta, lods };
    } catch (err) {
      console.error("Failed to load tile:", tileMeta.gridFsId, err);
      return { ...tileMeta, lods: null };
    }
  }, [scheduleDraw]);

  const fitCamera = useCallback((tiles) => {
    if (!tiles.length) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const minX = Math.min(...tiles.map(t => t.x));
    const maxX = Math.max(...tiles.map(t => t.x + TILE_SIZE));
    const minZ = Math.min(...tiles.map(t => t.z));
    const maxZ = Math.max(...tiles.map(t => t.z + TILE_SIZE));
    const fitScale = Math.min(canvas.width / (maxX - minX), canvas.height / (maxZ - minZ)) * 0.9;
    cameraRef.current = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    scaleRef.current  = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale));
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      authFetch(TILES_URL).then(r => r.json()),
      authFetch(WP_URL).then(r => r.json()),
    ])
      .then(async ([metaList, wps]) => {
        waypointsRef.current = wps;
        const loaded = await Promise.all(metaList.map(loadTile));
        tilesRef.current = loaded.filter(t => t.lods);
        fitCamera(tilesRef.current);
        scheduleDraw();
      })
      .catch(err => console.error("Init failed:", err))
      .finally(() => setIsLoading(false));
  }, [loadTile, fitCamera, scheduleDraw]);

  // ── Upload ────────────────────────────────────────────────────────────────

  const uploadFiles = useCallback(async (files) => {
    const pngFiles = Array.from(files).filter(f => f.name.endsWith(".png"));
    if (!pngFiles.length) return;

    setUploadStatus("uploading");
    let successCount = 0;

    for (const file of pngFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await authFetch(TILES_URL, { method: "POST", body: formData });
        if (!res.ok) continue;

        const tileMeta = await res.json();

        // If a tile at these coords already exists locally, evict its cache entry
        const existing = tilesRef.current.find(t => t.x === tileMeta.x && t.z === tileMeta.z);
        if (existing) {
          await deleteCachedTile(existing.gridFsId);
          tilesRef.current = tilesRef.current.filter(t => t !== existing);
        } else {
          // Also check IDB in case it was cached from a previous session
          const oldCached = await getCachedTileByCoords(tileMeta.x, tileMeta.z);
          if (oldCached) await deleteCachedTile(oldCached.gridFsId);
        }

        const loaded = await loadTile(tileMeta);
        if (loaded.lods) {
          tilesRef.current = [...tilesRef.current, loaded];
          successCount++;
          scheduleDraw();
        }
      } catch (err) {
        console.error("Upload failed:", file.name, err);
      }
    }

    setUploadStatus(successCount > 0 ? "done" : "error");
    setTimeout(() => setUploadStatus(null), 2500);
    if (tilesRef.current.length === successCount) fitCamera(tilesRef.current);
  }, [loadTile, fitCamera, scheduleDraw]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleFileInput = useCallback((e) => {
    uploadFiles(e.target.files);
    e.target.value = "";
  }, [uploadFiles]);

  // ── Waypoint placement ────────────────────────────────────────────────────

  const handleRightClick = useCallback((e) => {
    e.preventDefault();
    const canvas = getCanvas();
    if (!canvas) return;
    const rect   = canvas.getBoundingClientRect();
    const scale  = scaleRef.current;
    const camX   = cameraRef.current.x;
    const camZ   = cameraRef.current.z;
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    const worldX = Math.round((mx - canvas.width  / 2) / scale + camX);
    const worldZ = Math.round((my - canvas.height / 2) / scale + camZ);
    setWpForm({ name: "", color: "#ff0000" });
    setWpPopup({ screenX: e.clientX, screenY: e.clientY, worldX, worldZ });
  }, []);

  const handleAddWaypoint = useCallback(async () => {
    if (!wpPopup || !wpForm.name.trim()) return;
    try {
      const res = await authFetch(WP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wpForm.name.trim(), x: wpPopup.worldX, z: wpPopup.worldZ, color: wpForm.color }),
      });
      if (!res.ok) throw new Error("Failed");
      const wp = await res.json();
      waypointsRef.current = [...waypointsRef.current, wp];
      scheduleDraw();
    } catch (err) {
      console.error("Waypoint creation failed:", err);
    }
    setWpPopup(null);
  }, [wpPopup, wpForm, scheduleDraw]);

  // ── Canvas events ─────────────────────────────────────────────────────────

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current  = { x: e.clientX, y: e.clientY };
    if (wpPopup) setWpPopup(null);
  };

  const handleMouseMove = (e) => {
    const canvas = getCanvas();
    if (!canvas) return;
    const rect  = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    const camX  = cameraRef.current.x;
    const camZ  = cameraRef.current.z;
    const mx    = e.clientX - rect.left;
    const my    = e.clientY - rect.top;
    const wx    = Math.round((mx - canvas.width  / 2) / scale + camX);
    const wz    = Math.round((my - canvas.height / 2) / scale + camZ);
    if (cursorElRef.current) cursorElRef.current.textContent = `X: ${wx}  Z: ${wz}`;
    if (dragging.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      cameraRef.current = { x: camX - dx / scale, z: camZ - dy / scale };
      lastPos.current   = { x: e.clientX, y: e.clientY };
      scheduleDraw();
    }
  };

  const handleMouseUp   = () => { dragging.current = false; };

  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = getCanvas();
    if (!canvas) return;
    const rect   = canvas.getBoundingClientRect();
    const scale  = scaleRef.current;
    const camX   = cameraRef.current.x;
    const camZ   = cameraRef.current.z;
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    const worldX = (mx - canvas.width  / 2) / scale + camX;
    const worldZ = (my - canvas.height / 2) / scale + camZ;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + (-e.deltaY * ZOOM_FACTOR * scale)));
    cameraRef.current = {
      x: worldX - (mx - canvas.width  / 2) / newScale,
      z: worldZ - (my - canvas.height / 2) / newScale,
    };
    scaleRef.current = newScale;
    scheduleDraw();
  };

  // ── Resize ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const parent = canvas.parentElement;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        canvas.width  = e.contentRect.width;
        canvas.height = e.contentRect.height;
        scheduleDraw();
      }
    });
    ro.observe(parent);
    canvas.width  = parent.clientWidth;
    canvas.height = parent.clientHeight;
    scheduleDraw();
    return () => ro.disconnect();
  }, [scheduleDraw]);

  const statusStyle = {
    uploading: { bg: "#1e3a5f", border: "#2563eb", text: "#93c5fd" },
    done:      { bg: "#14532d", border: "#16a34a", text: "#86efac" },
    error:     { bg: "#450a0a", border: "#dc2626", text: "#fca5a5" },
  }[uploadStatus];

  const statusLabel = {
    uploading: "Uploading…",
    done:      "Tiles saved",
    error:     "Some tiles failed",
  }[uploadStatus];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0f172a" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "7px 14px",
        background: "#1e293b", borderBottom: "1px solid #334155",
        flexShrink: 0, flexWrap: "wrap",
      }}>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 6,
          border: "1px solid #475569", fontSize: 12, color: "#cbd5e1",
          cursor: "pointer", background: "#334155", userSelect: "none",
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v9M4 5l4-4 4 4M2 12h12v2H2v-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Upload tiles
          <input type="file" accept=".png" multiple onChange={handleFileInput} style={{ display: "none" }} />
        </label>

        <div ref={statsElRef} style={{
          padding: "4px 10px", borderRadius: 6,
          background: "#0f172a", border: "1px solid #334155",
          fontSize: 11, color: "#64748b", fontFamily: "monospace",
        }}>
          {isLoading ? "Loading…" : "0 tiles · 0 visible · 0 waypoints"}
        </div>

        {uploadStatus && statusStyle && (
          <div style={{
            padding: "4px 10px", borderRadius: 6,
            background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
            fontSize: 11, color: statusStyle.text, fontFamily: "monospace",
          }}>
            {statusLabel}
          </div>
        )}

        <span style={{ marginLeft: "auto", fontSize: 11, color: "#475569" }}>
          scroll to zoom · drag to pan · right-click to place waypoint
        </span>
      </div>

      <div
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%", cursor: "crosshair" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleRightClick}
        />

        {/* Waypoint popup */}
        {wpPopup && (
          <div style={{
            position: "fixed",
            left: Math.min(wpPopup.screenX, window.innerWidth - 220),
            top:  Math.min(wpPopup.screenY, window.innerHeight - 170),
            width: 210, background: "#1e293b",
            border: "1px solid #475569", borderRadius: 8,
            padding: "12px", zIndex: 100,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontFamily: "monospace" }}>
              X: {wpPopup.worldX}  Z: {wpPopup.worldZ}
            </div>
            <input
              autoFocus
              placeholder="Waypoint name"
              value={wpForm.name}
              onChange={e => setWpForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") handleAddWaypoint(); if (e.key === "Escape") setWpPopup(null); }}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#0f172a", border: "1px solid #334155",
                borderRadius: 5, padding: "5px 8px",
                color: "#f1f5f9", fontSize: 12, marginBottom: 8, outline: "none",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Color</span>
              <input
                type="color" value={wpForm.color}
                onChange={e => setWpForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 32, height: 24, border: "none", background: "none", cursor: "pointer", padding: 0 }}
              />
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{wpForm.color}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleAddWaypoint} disabled={!wpForm.name.trim()} style={{
                flex: 1, padding: "5px 0", borderRadius: 5,
                background: wpForm.name.trim() ? "#2563eb" : "#1e3a5f",
                border: "none", color: wpForm.name.trim() ? "#fff" : "#475569",
                fontSize: 12, cursor: wpForm.name.trim() ? "pointer" : "default",
              }}>
                Add waypoint
              </button>
              <button onClick={() => setWpPopup(null)} style={{
                padding: "5px 10px", borderRadius: 5,
                background: "transparent", border: "1px solid #334155",
                color: "#94a3b8", fontSize: 12, cursor: "pointer",
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{
          position: "absolute", bottom: 12, left: 12,
          padding: "4px 10px", borderRadius: 6,
          background: "rgba(15,23,42,0.85)", border: "1px solid #334155",
          fontSize: 11, fontFamily: "monospace", color: "#94a3b8",
          pointerEvents: "none",
        }}>
          <span ref={cursorElRef}>X: 0  Z: 0</span>
        </div>

        {isDragOver && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(59,130,246,0.07)",
            border: "2px dashed rgba(59,130,246,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              padding: "14px 26px", borderRadius: 8,
              background: "#1e293b", border: "1px solid #475569",
              fontSize: 13, color: "#cbd5e1", fontWeight: 500,
            }}>
              Drop PNG tiles here
            </div>
          </div>
        )}

        {!isLoading && tilesRef.current.length === 0 && !isDragOver && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            pointerEvents: "none",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 10,
              border: "1px solid #334155", background: "#1e293b",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h7v7H3V3zM14 3h7v7h-7V3zM14 14h7v7h-7v-7zM3 14h7v7H3v-7z"
                  stroke="#475569" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#cbd5e1" }}>No tiles loaded</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
                Upload PNGs named like{" "}
                <code style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>
                  662_248_x304128_z-113152.png
                </code>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}