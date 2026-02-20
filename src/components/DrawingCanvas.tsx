import { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, Trash2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = [
  "#000000", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
];

const DrawingCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);
  const [showColors, setShowColors] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowColors(!showColors)}
          >
            <Palette className="w-4 h-4" />
            <span
              className="w-4 h-4 rounded-full border border-border ml-1"
              style={{ backgroundColor: color }}
            />
          </Button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-card border border-border rounded-lg p-2 flex gap-1 shadow-md">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setShowColors(false); }}
                  className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        <input
          type="range"
          min={1}
          max={20}
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          className="w-24"
        />

        <Button variant="outline" size="sm" onClick={() => setColor("#ffffff")}>
          <Eraser className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="sm" onClick={clearCanvas}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border border-border cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
    </div>
  );
};

export default DrawingCanvas;
