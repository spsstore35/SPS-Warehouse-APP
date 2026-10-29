import React, { useState } from 'react';
import { Product, Role, ProductVariant } from '../types/inventory';
import { Layers, AlertCircle, SlidersHorizontal, Edit3, Image as ImageIcon, Trash2, ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  userRole: Role;
  onOpenDetails: (product: Product) => void;
  onRequestAdjustment: (product: Product, variant?: ProductVariant) => void;
  onEditProduct?: (product: Product) => void;
  onDeleteProduct?: (product: Product) => void;
  onApproveProduct?: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  userRole,
  onOpenDetails,
  onRequestAdjustment,
  onEditProduct,
  onDeleteProduct,
  onApproveProduct,
}) => {
  const [imageError, setImageError] = useState(false);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const isAdmin = userRole === 'admin';

  // Gather all photos available
  const allCardImages = (product.images && product.images.length > 0)
    ? product.images
    : (product.image ? [product.image] : []);
  const currentImage = allCardImages[activeImgIdx] || product.image;

  // Extract unique colors and sizes
  const uniqueColors = Array.from(
    new Map(product.variants.map((v) => [v.colorName, v])).values()
  );
  const uniqueSizes = Array.from(new Set(product.variants.map((v) => v.size)));

  // Check for any variants at or below minimum threshold
  const lowStockVariants = product.variants.filter(
    (v) => v.minThreshold !== undefined && v.quantity <= v.minThreshold
  );

  const isStandardItem =
    product.variants.length === 1 &&
    (product.variants[0].size === 'One Size' || product.variants[0].size === 'Standard' || !product.variants[0].size) &&
    (product.variants[0].colorName === 'Standard' || !product.variants[0].colorName);

  const isPending = product.status === 'pending';

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-sm transition-all flex flex-col group ${
        isPending
          ? 'bg-slate-50/95 border-2 border-dashed border-amber-300 ring-2 ring-amber-300/30 hover:border-amber-400'
          : 'bg-white border border-slate-200/90 hover:shadow-md hover:border-slate-300'
      }`}
    >
      {/* Product Image Box */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden flex items-center justify-center border-b border-slate-100">
        {!imageError && currentImage ? (
          <img
            src={currentImage}
            alt={product.name}
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
              isPending ? 'grayscale-[25%] opacity-90' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4">
            <ImageIcon className="w-10 h-10 mb-2 stroke-[1.5]" />
            <span className="text-xs font-medium text-slate-500">{product.category}</span>
          </div>
        )}

        {/* Glassy Left and Right arrows for cycling photos */}
        {allCardImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImgIdx((prev) => (prev > 0 ? prev - 1 : allCardImages.length - 1));
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full backdrop-blur-md bg-white/40 hover:bg-white/70 active:scale-95 text-slate-900 border border-white/60 shadow-lg flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:shadow-xl"
              title="Previous photo"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImgIdx((prev) => (prev < allCardImages.length - 1 ? prev + 1 : 0));
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full backdrop-blur-md bg-white/40 hover:bg-white/70 active:scale-95 text-slate-900 border border-white/60 shadow-lg flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:shadow-xl"
              title="Next photo"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Dots indicator at the bottom */}
            <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1 z-15 pointer-events-none">
              {allCardImages.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all shadow-xs ${
                    activeImgIdx === i ? 'w-4 bg-white shadow-md' : 'w-1.5 bg-white/50 backdrop-blur-xs'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Target Audience / Pending Status Badge */}
        {isPending ? (
          <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 font-black text-[11px] shadow-md border border-amber-400 flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Pending Approval</span>
          </div>
        ) : (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-white/95 backdrop-blur-sm border border-slate-200 text-[11px] font-black text-slate-900 shadow-sm flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                product.targetAudience === 'Men'
                  ? 'bg-blue-500'
                  : product.targetAudience === 'Women'
                  ? 'bg-rose-500'
                  : product.targetAudience === 'Kids'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
            <span>{product.targetAudience || 'Men'}</span>
          </div>
        )}

        {/* Creator indicator if pending */}
        {isPending && (
          <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-sm border border-white/20 text-[10px] font-bold text-slate-100 shadow-sm">
            By {product.createdByName || 'Staff'}
          </div>
        )}

        {/* Low Stock Warning Badge */}
        {lowStockVariants.length > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-[11px] text-rose-700 font-semibold flex items-center gap-1 shadow-sm">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>{lowStockVariants.length} Low Variant{lowStockVariants.length > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Multi-photo badge */}
        {product.images && product.images.length > 1 && (
          <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-sm text-[10px] font-bold text-white shadow-sm flex items-center gap-1 border border-white/20">
            <ImageIcon className="w-3 h-3 text-amber-400" />
            <span>{product.images.length} Photos</span>
          </div>
        )}

        {/* Hover overlay to view details */}
        <button
          onClick={() => onOpenDetails(product)}
          className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100 bg-slate-900/20 backdrop-blur-[2px] transition-opacity flex items-center justify-center text-slate-900 text-xs font-bold"
        >
          <span className="px-3.5 py-2 rounded-xl bg-white shadow-lg border border-slate-200">
            {isStandardItem ? 'View Item Details' : 'View Sizes & Colors'}
          </span>
        </button>
      </div>

      {/* Product Information Section */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 font-medium">
            <span className="font-mono text-amber-700 font-semibold">{product.sku}</span>
            <span aria-hidden="true">·</span>
            <span>{product.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-bold text-slate-800">{product.targetAudience || 'Unisex'}</span>
          </div>

          {/* Item Title */}
          <h3
            onClick={() => onOpenDetails(product)}
            className="text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-1 cursor-pointer"
          >
            {product.name}
          </h3>

          {/* Product Description */}
          <p className="mt-1.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {product.description || product.fabricDetails || 'Warehouse inventory item.'}
          </p>

          {isStandardItem ? (
            <div className="mt-3.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Standard Item (Single Stock)</span>
            </div>
          ) : (
            <>
              {/* Color swatches preview */}
              {uniqueColors.length > 0 && uniqueColors.some((c) => c.colorName !== 'Standard') && (
                <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-slate-500 mr-1">Colors:</span>
                  {uniqueColors.map((col) => (
                    <div
                      key={col.colorName}
                      title={`${col.colorName}`}
                      className="w-4 h-4 rounded-full border border-slate-300 shadow-sm shrink-0"
                      style={{ backgroundColor: col.colorHex }}
                    />
                  ))}
                  <span className="text-[11px] text-slate-500 ml-1">
                    ({uniqueColors.length})
                  </span>
                </div>
              )}

              {/* Size range indicator */}
              {uniqueSizes.length > 0 && uniqueSizes.some((s) => s !== 'One Size' && s !== 'Standard') && (
                <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-slate-500">Sizes:</span>
                  <div className="flex items-center gap-1 font-mono text-slate-700 font-medium">
                    {uniqueSizes.map((s, idx) => (
                      <span key={s}>
                        {s}
                        {idx < uniqueSizes.length - 1 && <span className="text-slate-300 mx-0.5">·</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Stock Breakdown & Action Buttons */}
        <div className="mt-4 pt-3.5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Stock</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 flex items-baseline gap-1">
                <span>{product.totalQuantity}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">units</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Variants</div>
              <div className="text-sm font-semibold font-mono tabular-nums text-slate-700">
                {isStandardItem ? '1 Standard' : `${product.variants.length} combinations`}
              </div>
            </div>
          </div>

          {/* Pending Status Callout & Quick Approval */}
          {isPending && (
            <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-amber-950">
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] font-bold truncate">Awaiting Admin Approval</span>
              </div>
              {isAdmin && onApproveProduct && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApproveProduct(product.id);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black rounded-lg shadow-xs transition-colors shrink-0 flex items-center gap-1"
                  title="Approve and activate this item"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Approve</span>
                </button>
              )}
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onOpenDetails(product)}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>{isStandardItem ? 'View Details' : 'Sizes & Colors'}</span>
            </button>

            {isAdmin ? (
              <div className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => onEditProduct ? onEditProduct(product) : onOpenDetails(product)}
                  className="flex-1 py-2.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-sm min-h-[44px]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                {onDeleteProduct && (
                  <button
                    type="button"
                    onClick={() => onDeleteProduct(product)}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors flex items-center justify-center min-h-[44px] min-w-[40px] shrink-0"
                    title="Delete Item (Admin Only)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onRequestAdjustment(product)}
                className="w-full py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm min-h-[44px]"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Request Count</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
