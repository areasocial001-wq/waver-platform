import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Paintbrush, Eraser, RotateCcw, Check, Undo2, Redo2, Layers } from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [applyToAllFrames, setApplyToAllFrames] = useState(false);
  
  // Undo/Redo history
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 20;

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

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);

    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    // Red semi-transparent = area to edit (will be visible on the image)
    // Clear = area to preserve
    if (tool === "brush") {
      ctx.fillStyle = "rgba(255, 50, 50, 0.6)";
    } else {
      // Eraser: clear the area
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
    }
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }, [isDrawing, brushSize, tool, getCanvasCoordinates]);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  }, [draw]);

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      // Save state after each stroke
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

    // Convert: red areas (drawn with brush) → transparent, other → opaque
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const a = data[i + 3];
      
      // Check if this pixel has significant red (was painted with brush)
      if (r > 100 && a > 50) {
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
              className="absolute top-0 left-0 rounded cursor-crosshair"
              style={{ pointerEvents: "auto" }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
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
