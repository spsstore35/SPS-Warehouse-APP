import React, { useState } from 'react';
import { Product, ProductVariant, Role } from '../types/inventory';
import { X, AlertCircle, SlidersHorizontal, Package, FileText, Check } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product;
  userRole: Role;
  onClose: () => void;
  onRequestAdjustment: (product: Product, variant: ProductVariant) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  userRole,
  onClose,
  onRequestAdjustment,
}) => {
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>('all');
  const isAdmin = userRole === 'admin';

  const uniqueColors = Array.from(
    new Map(product.variants.map((v) => [v.colorName, v])).values()
  );

  const filteredVariants =
    selectedColorFilter === 'all'
      ? product.variants
      : product.variants.filter((v) => v.colorName === selectedColorFilter);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Container - Bottom Sheet on mobile, centered dialog on desktop */}
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Mobile drag handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-3" />

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="font-mono text-amber-700 font-semibold">{product.sku}</span>
              <span aria-hidden="true">·</span>
              <span>{product.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {product.targetAudience || 'Unisex'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate mt-0.5">{product.name}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {/* Top Info Strip: Product Description & Total Stock (No warehouse location) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total In Stock</div>
              <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {product.totalQuantity} <span className="text-xs font-sans font-normal text-slate-500">units</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Audience: <strong className="text-slate-800">{product.targetAudience || 'Unisex'}</strong>
              </div>
            </div>

            <div className="sm:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>Product Description & Fabric Details</span>
              </div>
              <p className="text-xs text-slate-700 mt-1.5 leading-relaxed font-medium">
                {product.description || 'Apparel item with size and color matrix.'}
              </p>
              {product.fabricDetails && (
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  Spec: {product.fabricDetails}
                </div>
              )}
            </div>
          </div>

          {/* Color Filter Tabs */}
          <div>
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Filter By Color:
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedColorFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedColorFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                All Colors ({product.variants.length})
              </button>
              {uniqueColors.map((col) => (
                <button
                  key={col.colorName}
                  onClick={() => setSelectedColorFilter(col.colorName)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedColorFilter === col.colorName
                      ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-slate-300 shadow-sm"
                    style={{ backgroundColor: col.colorHex }}
                  />
                  <span>{col.colorName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Variants Table / Touch-friendly List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <span>Size & Color Stock Matrix</span>
              </h3>
              <span className="text-xs text-slate-500">
                {filteredVariants.length} combinations
              </span>
            </div>

            <div className="space-y-2">
              {filteredVariants.map((variant) => {
                const isLow =
                  variant.minThreshold !== undefined &&
                  variant.quantity <= variant.minThreshold;

                return (
                  <div
                    key={variant.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 hover:border-slate-300 transition-colors gap-3"
                  >
                    {/* Left: Size & Color Info */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full border border-slate-300 shadow-sm shrink-0"
                        style={{ backgroundColor: variant.colorHex }}
                        title={variant.colorName}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">Size {variant.size}</span>
                          <span className="text-xs text-slate-500 font-medium">· {variant.colorName}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {variant.sku}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quantity & Action Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <div className="flex items-center gap-2">
                        {isLow && (
                          <span className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Low Stock
                          </span>
                        )}
                        <div className="text-right">
                          <span className="text-lg font-black font-mono tabular-nums text-slate-900">
                            {variant.quantity}
                          </span>
                          <span className="text-xs text-slate-500 ml-1 font-medium">units</span>
                        </div>
                      </div>

                      <button
                        onClick={() => onRequestAdjustment(product, variant)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors min-h-[38px] ${
                          isAdmin
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                            : 'bg-sky-500 hover:bg-sky-600 text-white'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{isAdmin ? 'Direct Adjust' : 'Request Count'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isAdmin ? (
              <span>Admin: edits immediately update inventory balance</span>
            ) : (
              <span>Floor Staff: adjustments submit to Admin for verification</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-colors min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
