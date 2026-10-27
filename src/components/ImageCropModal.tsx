import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Crop,
  Move,
  Maximize2,
  Minimize2,
  Eye,
  RotateCcw,
} from 'lucide-react';

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
  // Default to 4:3 which is the exact aspect ratio of the catalog cards
  const [aspectRatio, setAspectRatio] = useState<'4:3' | '1:1' | '4:5'>('4:3');
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [fillBgColor, setFillBgColor] = useState<'#ffffff' | '#f1f5f9' | '#0f172a'>('#ffffff');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [livePreviewUrl, setLivePreviewUrl] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Aspect ratio multipliers: height / width
  const aspectMultipliers: Record<'4:3' | '1:1' | '4:5', number> = {
    '4:3': 3 / 4, // 0.75
    '1:1': 1,     // 1.0
    '4:5': 5 / 4, // 1.25
  };

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Viewport preview width
    const width = 360;
    const height = Math.round(width * aspectMultipliers[aspectRatio]);

    canvas.width = width;
    canvas.height = height;

    // Background fill
    ctx.fillStyle = fitMode === 'contain' ? fillBgColor : '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    let scaleFactor: number;
    if (fitMode === 'contain') {
      // Fit full image without cropping any edges
      scaleFactor = Math.min(width / img.width, height / img.height) * zoom;
    } else {
      // Fill frame (cover)
      scaleFactor = Math.max(width / img.width, height / img.height) * zoom;
    }

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

    // If using 1:1 or 4:5, draw a guide box showing where 4:3 catalog card will crop outside
    if (aspectRatio !== '4:3') {
      const cardHeight = Math.round(width * (3 / 4));
      const cropTop = (height - cardHeight) / 2;

      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)'; // Amber
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(2, cropTop, width - 4, cardHeight);
      ctx.restore();
    }

    // Update live preview URL for outside card widget
    try {
      const previewData = canvas.toDataURL('image/jpeg', 0.7);
      setLivePreviewUrl(previewData);
    } catch {
      // Ignore preview generation errors
    }
  }, [aspectRatio, fitMode, fillBgColor, zoom, rotation, offset, aspectMultipliers]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      renderPreview();
    };
  }, [imageSrc, renderPreview]);

  useEffect(() => {
    if (imageRef.current) {
      renderPreview();
    }
  }, [renderPreview]);

  // Reset position & zoom
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
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

    // High resolution export canvas (800px base width)
    const exportCanvas = document.createElement('canvas');
    const targetWidth = 800;
    const targetHeight = Math.round(targetWidth * aspectMultipliers[aspectRatio]);

    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = fitMode === 'contain' ? fillBgColor : '#0f172a';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.save();
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const scaleRatio = targetWidth / 360;
    let scaleFactor: number;
    if (fitMode === 'contain') {
      scaleFactor = Math.min(targetWidth / img.width, targetHeight / img.height) * zoom;
    } else {
      scaleFactor = Math.max(targetWidth / img.width, targetHeight / img.height) * zoom;
    }

    const drawWidth = img.width * scaleFactor;
    const drawHeight = img.height * scaleFactor;

    ctx.drawImage(
      img,
      -drawWidth / 2 + offset.x * scaleRatio,
      -drawHeight / 2 + offset.y * scaleRatio,
      drawWidth,
      drawHeight
    );
    ctx.restore();

    // Export optimized JPEG
    const croppedData = exportCanvas.toDataURL('image/jpeg', 0.88);
    onCropComplete(croppedData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-white">Frame & Crop Photo</h3>
              <p className="text-[11px] text-slate-400">Position and frame photo for warehouse catalog cards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Canvas (Interactive drag & zoom area) */}
        <div
          ref={containerRef}
          className="relative bg-slate-950 flex items-center justify-center p-4 min-h-[300px] sm:min-h-[340px] overflow-hidden select-none cursor-grab active:cursor-grabbing border-b border-slate-800"
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
            className="rounded-xl border-2 border-amber-500/60 shadow-2xl max-w-full max-h-[340px]"
          />

          {/* Overlay Helper Pill */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] text-slate-200 font-medium flex items-center gap-1.5 border border-slate-700 pointer-events-none shadow-md">
            <Move className="w-3 h-3 text-amber-400" />
            <span>Drag photo to position</span>
          </div>

          {/* Reset position button */}
          {(offset.x !== 0 || offset.y !== 0 || zoom !== 1 || rotation !== 0) && (
            <button
              type="button"
              onClick={handleReset}
              className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1 backdrop-blur-sm shadow-sm"
              title="Reset position and zoom"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Real-time Outside Card Preview Section (WYSIWYG) */}
        <div className="px-5 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center gap-3">
          <div className="relative w-24 aspect-[4/3] rounded-lg overflow-hidden bg-slate-800 border border-amber-500/40 shrink-0 shadow-sm flex items-center justify-center">
            {livePreviewUrl ? (
              <img
                src={livePreviewUrl}
                alt="Outside Card Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[9px] text-slate-500">Preview</span>
            )}
            <div className="absolute top-1 left-1 px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[8px]">
              4:3
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Eye className="w-3.5 h-3.5" />
              <span>Live Outside Preview</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              {aspectRatio === '4:3'
                ? 'Exact 1:1 match with product cards! Nothing will be cut off.'
                : 'Dashed line in frame shows the area that appears on 4:3 catalog cards.'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 sm:p-5 bg-slate-900 space-y-4">
          {/* Fit Mode Switcher: Cover (Fill) vs Contain (Fit Entire Photo) */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Fit Mode:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setFitMode('cover');
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                  fitMode === 'cover'
                    ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                <span>Fill Frame (Cover)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFitMode('contain');
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                  fitMode === 'contain'
                    ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Minimize2 className="w-3 h-3" />
                <span>Fit Whole Photo (No Crop)</span>
              </button>
            </div>
          </div>

          {/* Aspect Ratio Selector (Card 4:3 is recommended and default) */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ratio:
            </span>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { key: '4:3', label: 'Card (4:3) ★' },
                  { key: '1:1', label: 'Square (1:1)' },
                  { key: '4:5', label: 'Portrait (4:5)' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setAspectRatio(key);
                    handleReset();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    aspectRatio === key
                      ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Background color choice when in Fit Whole Photo mode */}
          {fitMode === 'contain' && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Background:
              </span>
              <div className="flex items-center gap-2">
                {[
                  { color: '#ffffff', label: 'White' },
                  { color: '#f1f5f9', label: 'Light' },
                  { color: '#0f172a', label: 'Dark' },
                ].map(({ color, label }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFillBgColor(color as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      fillBgColor === color
                        ? 'border-amber-400 bg-slate-800 text-white ring-1 ring-amber-400'
                        : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-500 shadow-xs"
                      style={{ backgroundColor: color }}
                    />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Zoom Slider & Rotation */}
          <div className="flex items-center gap-3 pt-1">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0.8"
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
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 ml-1 transition-colors"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition-colors shadow-sm min-h-[44px]"
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
