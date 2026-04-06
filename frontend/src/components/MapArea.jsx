import { useEffect, useRef, useState } from "react";
import CurrentCoord from "./CurrentCoord"; 

export default function MapArea({waypoints}) {
  const canvasRef = useRef(null);
  const [camera, setCamera] = useState({ x: 0, z: 0 });
  const [scale, setScale] = useState(10);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, z: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [cursorCoords, setCursorCoords] = useState({ x: 0, z: 0 });

  const worldBorder = {
    minX: -400000,
    maxX: 400000,
    minZ: -400000,
    maxZ: 400000,
  };

  useEffect(() => {

  const canvas = canvasRef.current;
  const worldWidth = worldBorder.maxX - worldBorder.minX;
  const worldHeight = worldBorder.maxZ - worldBorder.minZ;

  const scaleX = canvas.width / worldWidth;
  const scaleZ = canvas.height / worldHeight;
  const fitScale = Math.min(scaleX, scaleZ) * 0.95;

  const centerX = (worldBorder.minX + worldBorder.maxX) / 2;
  const centerZ = (worldBorder.minZ + worldBorder.maxZ) / 2;
  
  setCamera({ x: centerX, z: centerZ });
  setScale(fitScale);
}, []);


  // Draw everything
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGrid(ctx, canvas);
      drawOrigin(ctx, canvas);
      drawBorders(ctx, canvas);
      drawAxes(ctx, canvas, camera, scale)
      drawWaypoints(ctx, canvas);

    }
  function drawGrid(ctx, canvas) {
    
  const baseGrid = 10;
  const gridSize = baseGrid * Math.pow(2, Math.floor(Math.log2(1 / scale)));
  
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;

  // Find world coords at screen edges
  const leftWorld = camera.x - canvas.width / 2 / scale;
  const rightWorld = camera.x + canvas.width / 2 / scale;
  const topWorld = camera.z - canvas.height / 2 / scale;
  const bottomWorld = camera.z + canvas.height / 2 / scale;

  // Find first grid line in view
  let startX = Math.floor(leftWorld / gridSize) * gridSize;
  let startZ = Math.floor(topWorld / gridSize) * gridSize;

  // Vertical lines
  for (let x = startX; x <= rightWorld; x += gridSize) {
    const screenX = canvas.width / 2 + (x - camera.x) * scale;

    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvas.height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let z = startZ; z <= bottomWorld; z += gridSize) {
    const screenZ = canvas.height / 2 + (z - camera.z) * scale;

    ctx.beginPath();
    ctx.moveTo(0, screenZ);
    ctx.lineTo(canvas.width, screenZ);
    ctx.stroke();
  }
}
    
    function drawWaypoints(ctx, canvas) {
      
      waypoints.forEach((wp) => {
        ctx.fillStyle = wp.color || "red"
        const x = canvas.width / 2 + (wp.x - camera.x) * scale;
        const z = canvas.height / 2 + (wp.z - camera.z) * scale;

        ctx.beginPath();
        ctx.arc(x, z, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillText(wp.name, x + 6, z - 6);
      });
    }
    draw();
  }, [waypoints, camera, scale]);

  
function drawOrigin(ctx, canvas) {
  const x = canvas.width / 2 + (0 - camera.x) * scale;
  const z = canvas.height / 2 + (0 - camera.z) * scale;

  // draw dot
  ctx.fillStyle = "blue";
  ctx.beginPath();
  ctx.arc(x, z, 6, 0, Math.PI * 2);
  ctx.fill();

  // label
  ctx.fillStyle = "black";
  ctx.font = "12px Arial";
  ctx.fillText("0,0", x + 8, z - 8);
}

function drawAxes(ctx, canvas, camera, scale) {
  ctx.save();

  // Set style
  ctx.strokeStyle = "rgb(0 0 255 / 10%)";
  ctx.lineWidth = 2;
  ctx.font = "12px Arial";
  ctx.fillStyle = "green";

  // Calculate origin position
  const originX = canvas.width / 2 - camera.x * scale;
  const originZ = canvas.height / 2 - camera.z * scale;

  // Draw X-axis (horizontal)
  ctx.beginPath();
  ctx.moveTo(0, originZ);
  ctx.lineTo(canvas.width, originZ);
  ctx.stroke();
  ctx.fillText("X", canvas.width - 15, originZ - 5);

  // Draw Z-axis (vertical)
  ctx.strokeStyle = "rgb(0 0 255 / 10%)";
  ctx.beginPath();
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, canvas.height);
  ctx.stroke();
  ctx.fillText("Z", originX + 5, 15);

  ctx.restore();
}


const MIN_SCALE = 0.000005;
const MAX_SCALE = 50000;
const ZOOM_SPEED = 0.000001;

const handleWheel = (e) => {
  e.preventDefault();
  const newScale = Math.max(
    MIN_SCALE,
    Math.min(MAX_SCALE, scale - e.deltaY * ZOOM_SPEED)
  );
  setScale(newScale);
};


  function drawBorders(ctx, canvas){
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    const left = canvas.width / 2 + (worldBorder.minX - camera.x) * scale;
    const right = canvas.width / 2 + (worldBorder.maxX - camera.x) * scale;
    const top = canvas.height / 2 + (worldBorder.minZ - camera.z) * scale;
    const bottom = canvas.height / 2 + (worldBorder.maxZ - camera.z) * scale;

    ctx.strokeRect(left, top, right - left, bottom - top);
  }

  const handleMouseDown = (e) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, z: e.clientY };
  };

const handleMouseMove = (e) => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - canvas.width / 2) / scale + camera.x;
  const worldZ = (mouseY - canvas.height / 2) / scale + camera.z;

  // Update cursor coords always
  setCursorCoords((prev) => {
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    if (prev.x !== x || prev.z !== z) return { x, z };
    return prev;
  });

  // Handle dragging separately
  if (dragging.current) {
    const dx = e.clientX - lastPos.current.x;
    const dz = e.clientY - lastPos.current.z;

    setCamera((prev) => ({
      x: prev.x - dx / scale,
      z: prev.z - dz / scale,
    }));

    lastPos.current = { x: e.clientX, z: e.clientY };
  }
};

  const handleMouseUp = () => {
    dragging.current = false;
  };

  return (

    <div>    
      <canvas
      ref={canvasRef}
      width={window.innerWidth*0.8}
      height={window.innerHeight}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ border: "1px solid black", cursor: "grab" }}
      />
      <CurrentCoord coords={cursorCoords}></CurrentCoord>
      </div>

  );
}
