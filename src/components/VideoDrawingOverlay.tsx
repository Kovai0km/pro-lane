import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pen, Eraser, X, Check, Undo, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Point {
  x: number;
  y: number;
}

interface DrawingPath {
  points: Point[];
  color: string;
  width: number;
}

interface VideoDrawingOverlayProps {
  isActive: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

const COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];
const BRUSH_SIZES = [2, 4, 8, 12];

export function VideoDrawingOverlay({
  isActive,
  onClose,
  onSave,
  containerRef,
}: VideoDrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  // Resize canvas to match container
  useEffect(() => {
    if (!isActive || !canvasRef.current || !containerRef.current) return;

    const resize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [isActive]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all saved paths
    paths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    });

    // Draw current path
    if (currentPath.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = isEraser ? 'rgba(0,0,0,0.5)' : selectedColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }, [paths, currentPath, selectedColor, brushSize, isEraser]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    setCurrentPath([point]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    setCurrentPath((prev) => [...prev, point]);
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPath.length > 1) {
      if (isEraser) {
        // For eraser, we'd need more complex logic - for now just ignore
        // A real eraser would need to detect intersections with existing paths
      } else {
        setPaths((prev) => [
          ...prev,
          { points: currentPath, color: selectedColor, width: brushSize },
        ]);
      }
    }
    setCurrentPath([]);
  };

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair touch-none"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />

      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-2 flex items-center gap-2">
        {/* Colors */}
        <div className="flex gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => {
                setSelectedColor(color);
                setIsEraser(false);
              }}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform',
                selectedColor === color && !isEraser
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:scale-105'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Brush sizes */}
        <div className="flex gap-1">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded hover:bg-muted',
                brushSize === size && 'bg-muted'
              )}
            >
              <div
                className="rounded-full bg-foreground"
                style={{ width: size + 4, height: size + 4 }}
              />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Tools */}
        <Button
          variant={!isEraser ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsEraser(false)}
        >
          <Pen className="h-4 w-4" />
        </Button>
        <Button
          variant={isEraser ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsEraser(true)}
        >
          <Eraser className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Actions */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleUndo}
          disabled={paths.length === 0}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleClear}
          disabled={paths.length === 0}
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Save/Cancel */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="h-8 w-8"
          onClick={handleSave}
          disabled={paths.length === 0}
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
