import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCw, Crop, Move } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  onCropComplete,
  onClose,
}) => {
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '4:3'>('1:1');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Aspect ratio numbers
  const aspectMultipliers = {
    '1:1': 1,
    '4:5': 5 / 4,
    '4:3': 3 / 4,
  };

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      renderPreview();
    };
  }, [imageSrc]);

  useEffect(() => {
    if (imageRef.current) {
      renderPreview();
    }
  }, [zoom, rotation, offset, aspectRatio]);

  const renderPreview = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 360;
    const height = Math.round(size * aspectMultipliers[aspectRatio]);

    canvas.width = size;
    canvas.height = height;

    // Fill background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, height);

    ctx.save();
    // Center of canvas
    ctx.translate(size / 2, height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Scaling to cover
    const scaleFactor = Math.max(size / img.width, height / img.height) * zoom;
    const drawWidth = img.width * scaleFactor;
    const drawHeight = img.height * scaleFactor;

    ctx.drawImage(
      img,
      -drawWidth / 2 + offset.x,
      -drawHeight / 2 + offset.y,
      drawWidth,
      drawHeight
    );
    ctx.restore();
  };

  // Drag / Pan handlers (touch and mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    // High resolution export canvas
    const exportCanvas = document.createElement('canvas');
    const targetWidth = 800;
    const targetHeight = Math.round(targetWidth * aspectMultipliers[aspectRatio]);

    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.save();
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const ratioScale = targetWidth / 360;
    const scaleFactor = Math.max(targetWidth / img.width, targetHeight / img.height) * zoom;
    const drawWidth = img.width * scaleFactor;
    const drawHeight = img.height * scaleFactor;

    ctx.drawImage(
      img,
      -drawWidth / 2 + offset.x * ratioScale,
      -drawHeight / 2 + offset.y * ratioScale,
      drawWidth,
      drawHeight
    );
    ctx.restore();

    // Export optimized JPEG
    const croppedData = exportCanvas.toDataURL('image/jpeg', 0.85);
    onCropComplete(croppedData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-white">Frame & Crop Photo</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Canvas */}
        <div
          ref={containerRef}
          className="relative bg-slate-950 flex items-center justify-center p-4 min-h-[360px] overflow-hidden select-none cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <canvas
            ref={canvasRef}
            className="rounded-xl border border-amber-500/50 shadow-2xl max-w-full max-h-[380px]"
          />

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] text-slate-300 font-medium flex items-center gap-1 border border-slate-700 pointer-events-none">
            <Move className="w-3 h-3 text-amber-400" />
            <span>Drag image to position</span>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3.5">
          {/* Aspect Ratio Buttons */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ratio:
            </span>
            <div className="flex items-center gap-1.5">
              {(['1:1', '4:5', '4:3'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    aspectRatio === ratio
                      ? 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {ratio === '1:1' ? 'Square (1:1)' : ratio === '4:5' ? 'Apparel (4:5)' : 'Wide (4:3)'}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />

            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 ml-2"
              title="Rotate 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Save & Crop Photo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
