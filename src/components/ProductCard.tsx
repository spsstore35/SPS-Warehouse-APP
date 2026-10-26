import React, { useState } from 'react';
import { Product, Role, ProductVariant } from '../types/inventory';
import { Layers, AlertCircle, SlidersHorizontal, Edit3, Image as ImageIcon } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  userRole: Role;
  onOpenDetails: (product: Product) => void;
  onRequestAdjustment: (product: Product, variant?: ProductVariant) => void;
  onEditProduct?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  userRole,
  onOpenDetails,
  onRequestAdjustment,
  onEditProduct,
}) => {
  const [imageError, setImageError] = useState(false);
  const isAdmin = userRole === 'admin';

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

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col group">
      {/* Product Image Box */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden flex items-center justify-center border-b border-slate-100">
        {!imageError && product.image ? (
          <img
            src={product.image}
            alt={product.name}
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4">
            <ImageIcon className="w-10 h-10 mb-2 stroke-[1.5]" />
            <span className="text-xs font-medium text-slate-500">{product.category}</span>
          </div>
        )}

        {/* Target Audience Badge */}
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
          <span>{product.targetAudience || 'Unisex'}</span>
        </div>

        {/* Low Stock Warning Badge */}
        {lowStockVariants.length > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-[11px] text-rose-700 font-semibold flex items-center gap-1 shadow-sm">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>{lowStockVariants.length} Low Variant{lowStockVariants.length > 1 ? 's' : ''}</span>
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
              <button
                type="button"
                onClick={() => onEditProduct ? onEditProduct(product) : onOpenDetails(product)}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm min-h-[44px]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Item</span>
              </button>
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
