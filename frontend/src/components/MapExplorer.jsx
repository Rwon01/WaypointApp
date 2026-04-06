import { useEffect, useRef, useState, useCallback } from "react";

const TILE_SIZE = 1024;
const MIN_SCALE = 0.00005;
const MAX_SCALE = 4;
const ZOOM_FACTOR = 0.0015;
const TILES_URL = "/tiles";

// Remove black background: pixels where r,g,b are all below threshold become transparent
async function removeBlackBackground(imgEl) {
  const offscreen = document.createElement("canvas");
  offscreen.width  = imgEl.naturalWidth;
  offscreen.height = imgEl.naturalHeight;
  const ctx = offscreen.getContext("2d");
  ctx.drawImage(imgEl, 0, 0);

  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 15 && data[i + 1] < 15 && data[i + 2] < 15) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return offscreen;
}

export default function MapExplorer() {
  const canvasRef    = useRef(null);
  const tilesRef     = useRef([]);
  const cameraRef    = useRef({ x: 0, z: 0 });
  const scaleRef     = useRef(0.25);
  const dragging     = useRef(false);
  const lastPos      = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef(null);
  const cursorElRef  = useRef(null);
  const statsElRef   = useRef(null);

  const [isDragging,   setIsDragging]   = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [uploadStatus, setUploadStatus] = useState(null); // null | "uploading" | "done" | "error"

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

    let visible = 0;
    for (const tile of tilesRef.current) {
      if (!tile.processedCanvas) continue;
      if (tile.x + TILE_SIZE < viewLeft  || tile.x > viewRight)  continue;
      if (tile.z + TILE_SIZE < viewTop   || tile.z > viewBottom) continue;

      visible++;
      const sx = Math.floor(W / 2 + (tile.x - camX) * scale);
      const sz = Math.floor(H / 2 + (tile.z - camZ) * scale);
      const sw = Math.ceil(TILE_SIZE * scale);
      const sh = Math.ceil(TILE_SIZE * scale);

      ctx.imageSmoothingEnabled = scale < 0.5;
      ctx.imageSmoothingQuality = "low";
      ctx.drawImage(tile.processedCanvas, sx, sz, sw, sh);
    }

    // Origin dot
    const ox = W / 2 + (0 - camX) * scale;
    const oz = H / 2 + (0 - camZ) * scale;
    if (ox > -10 && ox < W + 10 && oz > -10 && oz < H + 10) {
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(ox, oz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(59,130,246,0.9)";
      ctx.font = "11px monospace";
      ctx.fillText("0,0", ox + 7, oz - 4);
    }

    if (statsElRef.current) {
      statsElRef.current.textContent = `${tilesRef.current.length} tiles · ${visible} visible`;
    }
  }, []);

  function drawGrid(ctx, W, H, camX, camZ, scale, viewLeft, viewRight, viewTop, viewBottom) {
    let gridSize = TILE_SIZE;
    const minPx = 60;
    while (gridSize * scale < minPx)     gridSize *= 2;
    while (gridSize * scale > minPx * 8) gridSize /= 2;

    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth   = 0.5;

    let startX = Math.floor(viewLeft / gridSize) * gridSize;
    let startZ = Math.floor(viewTop  / gridSize) * gridSize;

    for (let x = startX; x <= viewRight;  x += gridSize) {
      const sx = W / 2 + (x - camX) * scale;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let z = startZ; z <= viewBottom; z += gridSize) {
      const sz = H / 2 + (z - camZ) * scale;
      ctx.beginPath(); ctx.moveTo(0, sz); ctx.lineTo(W, sz); ctx.stroke();
    }

    if (scale < 0.05) {
      ctx.fillStyle = "rgba(100,116,139,0.5)";
      ctx.font = "10px monospace";
      for (let x = startX; x <= viewRight;  x += gridSize)
        for (let z = startZ; z <= viewBottom; z += gridSize)
          ctx.fillText(`${x},${z}`, W / 2 + (x - camX) * scale + 3, H / 2 + (z - camZ) * scale + 10);
    }
  }

  function drawAxes(ctx, W, H, camX, camZ, scale) {
    const ox = W / 2 - camX * scale;
    const oz = H / 2 - camZ * scale;
    ctx.save();
    ctx.strokeStyle = "rgba(59,130,246,0.12)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oz); ctx.lineTo(W, oz); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
    ctx.restore();
  }

  const scheduleDraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // ── Load one tile: fetch from GridFS URL, strip black, return processed canvas

  const loadTile = useCallback((tileMeta) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        const processedCanvas = await removeBlackBackground(img);
        resolve({ ...tileMeta, processedCanvas });
        scheduleDraw();
      };
      img.onerror = () => resolve({ ...tileMeta, processedCanvas: null });
      img.src = `${TILES_URL}/files/${tileMeta.gridFsId}`;
    });
  }, [scheduleDraw]);

  // ── Fit camera to bounding box ────────────────────────────────────────────

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

  // ── Fetch existing tiles from backend on mount ────────────────────────────

  useEffect(() => {
    setIsLoading(true);
    fetch(TILES_URL)
      .then(res => res.json())
      .then(async (metaList) => {
        const loaded = await Promise.all(metaList.map(loadTile));
        tilesRef.current = loaded.filter(t => t.processedCanvas);
        fitCamera(tilesRef.current);
        scheduleDraw();
      })
      .catch(err => console.error("Failed to fetch tiles:", err))
      .finally(() => setIsLoading(false));
  }, [loadTile, fitCamera, scheduleDraw]);

  // ── Upload files to backend ───────────────────────────────────────────────

  const uploadFiles = useCallback(async (files) => {
    const pngFiles = Array.from(files).filter(f => f.name.endsWith(".png"));
    if (!pngFiles.length) return;

    setUploadStatus("uploading");
    let successCount = 0;

    for (const file of pngFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(TILES_URL, { method: "POST", body: formData });
        if (!res.ok) continue;

        const tileMeta = await res.json();

        // Skip if already loaded locally
        if (tilesRef.current.some(t => t.x === tileMeta.x && t.z === tileMeta.z)) continue;

        const loaded = await loadTile(tileMeta);
        if (loaded.processedCanvas) {
          tilesRef.current = [...tilesRef.current, loaded];
          successCount++;
          scheduleDraw();
        }
      } catch (err) {
        console.error("Upload failed for", file.name, err);
      }
    }

    setUploadStatus(successCount > 0 ? "done" : "error");
    setTimeout(() => setUploadStatus(null), 2500);

    if (tilesRef.current.length === successCount) fitCamera(tilesRef.current);
  }, [loadTile, fitCamera, scheduleDraw]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleFileInput = useCallback((e) => {
    uploadFiles(e.target.files);
    e.target.value = "";
  }, [uploadFiles]);

  // ── Canvas events ─────────────────────────────────────────────────────────

  const handleMouseDown = (e) => {
    dragging.current = true;
    lastPos.current  = { x: e.clientX, y: e.clientY };
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

  const handleMouseUp = () => { dragging.current = false; };

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

  // ── Resize observer ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const parent = canvas.parentElement;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width  = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
        scheduleDraw();
      }
    });
    ro.observe(parent);
    canvas.width  = parent.clientWidth;
    canvas.height = parent.clientHeight;
    scheduleDraw();
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // ── Status styles ─────────────────────────────────────────────────────────

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

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "7px 14px",
        background: "#1e293b", borderBottom: "1px solid #334155",
        flexShrink: 0, flexWrap: "wrap"
      }}>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 6,
          border: "1px solid #475569", fontSize: 12, color: "#cbd5e1",
          cursor: "pointer", background: "#334155", userSelect: "none"
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
          fontSize: 11, color: "#64748b", fontFamily: "monospace"
        }}>
          {isLoading ? "Loading…" : "0 tiles · 0 visible"}
        </div>

        {uploadStatus && statusStyle && (
          <div style={{
            padding: "4px 10px", borderRadius: 6,
            background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
            fontSize: 11, color: statusStyle.text, fontFamily: "monospace"
          }}>
            {statusLabel}
          </div>
        )}

        <span style={{ marginLeft: "auto", fontSize: 11, color: "#475569" }}>
          scroll to zoom · drag to pan
        </span>
      </div>

      {/* Canvas area */}
      <div
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
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
        />

        {/* Cursor coords */}
        <div style={{
          position: "absolute", bottom: 12, left: 12,
          padding: "4px 10px", borderRadius: 6,
          background: "rgba(15,23,42,0.85)", border: "1px solid #334155",
          fontSize: 11, fontFamily: "monospace", color: "#94a3b8",
          pointerEvents: "none"
        }}>
          <span ref={cursorElRef}>X: 0  Z: 0</span>
        </div>

        {/* Drop overlay */}
        {isDragging && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(59,130,246,0.07)",
            border: "2px dashed rgba(59,130,246,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none"
          }}>
            <div style={{
              padding: "14px 26px", borderRadius: 8,
              background: "#1e293b", border: "1px solid #475569",
              fontSize: 13, color: "#cbd5e1", fontWeight: 500
            }}>
              Drop PNG tiles here
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && tilesRef.current.length === 0 && !isDragging && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            pointerEvents: "none"
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 10,
              border: "1px solid #334155", background: "#1e293b",
              display: "flex", alignItems: "center", justifyContent: "center"
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