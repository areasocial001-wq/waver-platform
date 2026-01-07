import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Paintbrush, Eraser, RotateCcw, Check, Undo2, Redo2, Layers, Palette } from "lucide-react";

const MASK_COLORS = [
  { name: "Rosso", value: "rgba(255, 50, 50, 0.6)", rgb: { r: 255, g: 50, b: 50 } },
  { name: "Verde", value: "rgba(50, 255, 50, 0.6)", rgb: { r: 50, g: 255, b: 50 } },
  { name: "Blu", value: "rgba(50, 50, 255, 0.6)", rgb: { r: 50, g: 50, b: 255 } },
  { name: "Giallo", value: "rgba(255, 255, 50, 0.6)", rgb: { r: 255, g: 255, b: 50 } },
  { name: "Ciano", value: "rgba(50, 255, 255, 0.6)", rgb: { r: 50, g: 255, b: 255 } },
  { name: "Magenta", value: "rgba(255, 50, 255, 0.6)", rgb: { r: 255, g: 50, b: 255 } },
];

interface InpaintingCanvasProps {
  imageData: string;
  onMaskComplete: (maskData: string, applyToAll?: boolean) => void;
  onCancel: () => void;
  frameCount?: number;
}

export function InpaintingCanvas({ 
  imageData, 
  onMaskComplete, 
  onCancel,
  frameCount = 1 
}: InpaintingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [applyToAllFrames, setApplyToAllFrames] = useState(false);
  const [maskColorIndex, setMaskColorIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  
  // Undo/Redo history
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 20;
  
  const maskColor = MASK_COLORS[maskColorIndex];

  // Save current state to history
  const saveToHistory = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const currentState = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      newHistory.push(currentState);
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
  }, [historyIndex]);

  // Undo action
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    const previousState = history[newIndex];
    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  // Redo action
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    const nextState = history[newIndex];
    if (nextState) {
      ctx.putImageData(nextState, 0, 0);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  // Load image and setup canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !maskCanvas || !container) return;

      // Wait for container to have dimensions
      const containerWidth = container.clientWidth || 600;
      
      // Calculate display size while maintaining aspect ratio
      const maxWidth = Math.max(containerWidth, 400);
      const maxHeight = 500;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      
      const displayWidth = Math.max(img.width * scale, 200);
      const displayHeight = Math.max(img.height * scale, 200);

      // Set canvas sizes - use actual image dimensions for the canvas
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
      maskCanvas.style.width = `${displayWidth}px`;
      maskCanvas.style.height = `${displayHeight}px`;

      // Setup cursor preview canvas
      const cursorCanvas = cursorCanvasRef.current;
      if (cursorCanvas) {
        cursorCanvas.width = img.width;
        cursorCanvas.height = img.height;
        cursorCanvas.style.width = `${displayWidth}px`;
        cursorCanvas.style.height = `${displayHeight}px`;
      }

      setCanvasSize({ width: displayWidth, height: displayHeight });

      // Draw image on main canvas
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }

      // Initialize mask canvas as fully transparent (nothing masked)
      const maskCtx = maskCanvas.getContext("2d");
      if (maskCtx) {
        // Clear to transparent first
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        // Then fill with semi-transparent black so user can see where they haven't drawn
        maskCtx.fillStyle = "rgba(0, 0, 0, 0.01)";
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        
        // Save initial state to history
        const initialState = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        setHistory([initialState]);
        setHistoryIndex(0);
      }
    };
    img.src = imageData;
  }, [imageData]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Draw cursor preview
  useEffect(() => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    if (cursorPos) {
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, brushSize, 0, Math.PI * 2);
      ctx.strokeStyle = tool === "brush" ? maskColor.value : "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner circle for better visibility
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, brushSize, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [cursorPos, brushSize, tool, maskColor]);

  const getCanvasCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e);
    setCursorPos(coords);
    if (isDrawing) {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;
      const ctx = maskCanvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2);
      if (tool === "brush") {
        ctx.fillStyle = maskColor.value;
      } else {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
      }
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
  }, [isDrawing, brushSize, tool, getCanvasCoordinates, maskColor]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDrawing) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2);
    if (tool === "brush") {
      ctx.fillStyle = maskColor.value;
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
    }
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }, [isDrawing, brushSize, tool, getCanvasCoordinates, maskColor]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
  }, [isDrawing, saveToHistory]);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2);
    if (tool === "brush") {
      ctx.fillStyle = maskColor.value;
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
    }
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }, [getCanvasCoordinates, brushSize, tool, maskColor]);

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
  }, [isDrawing, saveToHistory]);

  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.01)";
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    saveToHistory();
  }, [saveToHistory]);

  const completeMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    // Create a new canvas for the final mask
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = maskCanvas.width;
    outputCanvas.height = maskCanvas.height;
    const outputCtx = outputCanvas.getContext("2d");
    if (!outputCtx) return;

    // Export mask as PNG with alpha channel
    // For OpenAI: transparent areas = edit, opaque = preserve
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imageData.data;

    // Create output image data
    const outputImageData = outputCtx.createImageData(maskCanvas.width, maskCanvas.height);
    const outputData = outputImageData.data;

    // Convert: colored areas (drawn with brush) → transparent, other → opaque
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      
      // Check if this pixel was painted (has significant alpha)
      if (a > 50) {
        // Painted area: make transparent (this is where we want to edit)
        outputData[i] = 0;     // R
        outputData[i + 1] = 0; // G
        outputData[i + 2] = 0; // B
        outputData[i + 3] = 0; // A = transparent
      } else {
        // Unpainted area: keep opaque (preserve this area)
        outputData[i] = 0;       // R
        outputData[i + 1] = 0;   // G
        outputData[i + 2] = 0;   // B
        outputData[i + 3] = 255; // A = opaque
      }
    }

    outputCtx.putImageData(outputImageData, 0, 0);
    const maskDataUrl = outputCanvas.toDataURL("image/png");

    onMaskComplete(maskDataUrl, applyToAllFrames);
  }, [onMaskComplete, applyToAllFrames]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={tool === "brush" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("brush")}
          >
            <Paintbrush className="w-4 h-4 mr-2" />
            Pennello
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("eraser")}
          >
            <Eraser className="w-4 h-4 mr-2" />
            Gomma
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={undo}
            disabled={!canUndo}
            title="Annulla (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={redo}
            disabled={!canRedo}
            title="Ripeti (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Label className="text-sm whitespace-nowrap">Dimensione: {brushSize}px</Label>
          <Slider
            value={[brushSize]}
            min={5}
            max={100}
            step={1}
            onValueChange={(v) => setBrushSize(v[0])}
            className="flex-1"
          />
        </div>

        <Button variant="outline" size="sm" onClick={clearMask}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Pulisci
        </Button>

        {/* Color picker */}
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1">
            {MASK_COLORS.map((color, idx) => (
              <button
                key={color.name}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  idx === maskColorIndex ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: color.value }}
                onClick={() => setMaskColorIndex(idx)}
                title={color.name}
              />
            ))}
          </div>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="relative w-full flex justify-center bg-muted/50 rounded-lg p-4"
      >
        {canvasSize.width > 0 && (
          <div className="relative" style={{ width: canvasSize.width, height: canvasSize.height }}>
            {/* Background image canvas */}
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 rounded"
            />
            {/* Mask overlay canvas */}
            <canvas
              ref={maskCanvasRef}
              className="absolute top-0 left-0 rounded"
              style={{ pointerEvents: "none" }}
            />
            {/* Cursor preview canvas - this one receives events */}
            <canvas
              ref={cursorCanvasRef}
              className="absolute top-0 left-0 rounded cursor-none"
              style={{ pointerEvents: "auto" }}
              onMouseDown={startDrawing}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={handleMouseLeave}
              onTouchStart={startDrawing}
              onTouchMove={handleTouchMove}
              onTouchEnd={stopDrawing}
            />
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Disegna sulle aree di testo che vuoi rimuovere. Le zone bianche verranno elaborate dall'AI.
        <br />
        <span className="text-xs">Scorciatoie: Ctrl+Z = Annulla, Ctrl+Shift+Z = Ripeti</span>
      </p>

      {/* Batch application option */}
      {frameCount > 1 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id="apply-to-all"
            checked={applyToAllFrames}
            onCheckedChange={(checked) => setApplyToAllFrames(checked === true)}
          />
          <div className="flex-1">
            <Label htmlFor="apply-to-all" className="font-medium cursor-pointer flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Applica a tutti i {frameCount} frame
            </Label>
            <p className="text-xs text-muted-foreground">
              Usa questa maschera per rimuovere le scritte da tutti i frame estratti
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button onClick={completeMask}>
          <Check className="w-4 h-4 mr-2" />
          {applyToAllFrames ? `Applica a ${frameCount} frame` : "Applica maschera"}
        </Button>
      </div>
    </div>
  );
}
