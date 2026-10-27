import React, { useState } from 'react';
import { Product, ProductVariant, Role } from '../types/inventory';
import {
  X,
  AlertCircle,
  SlidersHorizontal,
  Package,
  FileText,
  Trash2,
  Edit3,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface ProductDetailModalProps {
  product: Product;
  userRole: Role;
  onClose: () => void;
  onRequestAdjustment: (product: Product, variant: ProductVariant) => void;
  onDeleteProduct?: (productId: string) => void;
  onDeleteVariant?: (productId: string, variantId: string) => void;
  onEditProduct?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  userRole,
  onClose,
  onRequestAdjustment,
  onDeleteProduct,
  onDeleteVariant,
  onEditProduct,
}) => {
  const isAdmin = userRole === 'admin';

  // Images list
  const allImages = product.images && product.images.length > 0
    ? product.images
    : product.image
    ? [product.image]
    : [];
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Check if standard single-stock item
  const isStandardItem =
    product.variants.length === 1 &&
    (product.variants[0].size === 'Standard' ||
      product.variants[0].size === 'One Size' ||
      !product.variants[0].size) &&
    (product.variants[0].colorName === 'Standard' ||
      product.variants[0].colorName === 'Default' ||
      product.variants[0].colorName === 'N/A' ||
      !product.variants[0].colorName);

  // Deduplicate variants by size + colorName to eliminate duplicate rows
  const dedupedMap = new Map<string, ProductVariant>();
  product.variants.forEach((v) => {
    const key = `${v.size}_${v.colorName}`.toLowerCase();
    if (!dedupedMap.has(key) || v.quantity > 0) {
      dedupedMap.set(key, v);
    }
  });
  const cleanVariants = Array.from(dedupedMap.values());

  // Distinct colors
  const uniqueColors = Array.from(
    new Map(cleanVariants.map((v) => [v.colorName, v])).values()
  );

  // Default active color to first color if available
  const [selectedColor, setSelectedColor] = useState<string>(
    uniqueColors[0]?.colorName || 'Standard'
  );

  // Filter variants by the chosen color
  const displayedVariants = !isStandardItem && uniqueColors.length > 1
    ? cleanVariants.filter((v) => v.colorName === selectedColor)
    : cleanVariants;

  const [showDeleteProductConfirm, setShowDeleteProductConfirm] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<ProductVariant | null>(null);

  const handleDeleteEntireProductClick = () => {
    if (!isAdmin || !onDeleteProduct) return;
    setShowDeleteProductConfirm(true);
  };

  const handleConfirmProductDelete = () => {
    if (!isAdmin || !onDeleteProduct) return;
    onDeleteProduct(product.id);
    setShowDeleteProductConfirm(false);
    onClose();
  };

  const handleDeleteSingleVariantClick = (variant: ProductVariant) => {
    if (!isAdmin || !onDeleteVariant) return;
    setVariantToDelete(variant);
  };

  const handleConfirmVariantDelete = () => {
    if (!isAdmin || !onDeleteVariant || !variantToDelete) return;
    onDeleteVariant(product.id, variantToDelete.id);
    setVariantToDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
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
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate mt-0.5">
              {product.name}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && onEditProduct && (
              <button
                onClick={() => {
                  onClose();
                  onEditProduct(product);
                }}
                className="p-2 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border border-slate-200"
                title="Edit Item"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            {isAdmin && onDeleteProduct && (
              <button
                onClick={handleDeleteEntireProductClick}
                className="p-2 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border border-slate-200"
                title="Delete Entire Product (Admin Only)"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">Delete Item</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Photos and Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            {/* Multi-image preview */}
            <div className="sm:col-span-5 space-y-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                {allImages.length > 0 && allImages[activeImageIdx] ? (
                  <img
                    src={allImages[activeImageIdx]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                    <ImageIcon className="w-8 h-8 mb-1" />
                    <span className="text-[11px]">No photo</span>
                  </div>
                )}
              </div>

              {/* Thumbnails if multiple images exist */}
              {allImages.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {allImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        activeImageIdx === idx
                          ? 'border-amber-500 ring-2 ring-amber-500/30'
                          : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Meta */}
            <div className="sm:col-span-7 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Total In Stock
                    </span>
                    <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-0.5">
                      {product.totalQuantity} <span className="text-xs font-sans font-normal text-slate-500">units</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Audience
                    </span>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">
                      {product.targetAudience || 'Unisex'}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    <span>Description & Specs</span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1.5 leading-relaxed font-medium">
                    {product.description || (isStandardItem ? 'Standard warehouse item.' : 'Apparel item with size and color matrix.')}
                  </p>
                  {product.fabricDetails && (
                    <div className="text-[11px] text-slate-500 mt-1 font-mono">
                      Spec: {product.fabricDetails}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Color Selector at the Top */}
          {!isStandardItem && uniqueColors.length > 1 && (
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Choose Color:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {uniqueColors.map((col) => {
                  const isSelected = selectedColor === col.colorName;
                  return (
                    <button
                      key={col.colorName}
                      type="button"
                      onClick={() => setSelectedColor(col.colorName)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-500/20 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-xs shrink-0"
                        style={{ backgroundColor: col.colorHex }}
                      />
                      <span>{col.colorName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sizes List (Filtered by active color, displaying ONLY the size label) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {isStandardItem
                    ? 'Item Stock & Balance'
                    : `Sizes for ${uniqueColors.length > 1 ? selectedColor : 'Standard'} (${displayedVariants.length} sizes)`}
                </span>
              </h3>
              <span className="text-[11px] text-slate-500">
                {displayedVariants.reduce((sum, v) => sum + v.quantity, 0)} units in this color
              </span>
            </div>

            <div className="space-y-2">
              {displayedVariants.map((variant) => {
                const isLow =
                  variant.minThreshold !== undefined &&
                  variant.minThreshold !== null &&
                  variant.quantity <= variant.minThreshold;

                return (
                  <div
                    key={variant.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors gap-3"
                  >
                    {/* Left: Size Name only */}
                    <div className="flex items-center gap-3">
                      {!isStandardItem && (
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: variant.colorHex }}
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">
                            {isStandardItem ? 'Standard Item' : `Size ${variant.size}`}
                          </span>
                          {isLow && (
                            <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Low Stock (≤{variant.minThreshold})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          SKU: {variant.sku}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quantity & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <div className="text-right">
                        <span className="text-lg font-black font-mono tabular-nums text-slate-900">
                          {variant.quantity}
                        </span>
                        <span className="text-xs text-slate-500 ml-1 font-medium">units</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRequestAdjustment(product, variant)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors min-h-[38px] ${
                          isAdmin
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm'
                            : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sm'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{isAdmin ? 'Direct Adjust' : 'Request Count'}</span>
                      </button>

                      {/* Admin-only delete variant size button */}
                      {isAdmin && cleanVariants.length > 1 && onDeleteVariant && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSingleVariantClick(variant)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                          title="Delete this size variant (Admin Only)"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </button>
                      )}
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
              <span>Admin: changes immediately reflect in Supabase database</span>
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

      {/* Confirmation Modal for Entire Product Deletion */}
      <ConfirmDeleteModal
        isOpen={showDeleteProductConfirm}
        title="Delete Item"
        itemTitle={product.name}
        message={`Are you sure you want to delete "${product.name}" (${product.sku})?`}
        details="This will permanently delete the item and all its color and size stock combinations from inventory."
        confirmLabel="Yes, Delete"
        cancelLabel="No, Cancel"
        onConfirm={handleConfirmProductDelete}
        onCancel={() => setShowDeleteProductConfirm(false)}
      />

      {/* Confirmation Modal for Single Variant Size Deletion */}
      <ConfirmDeleteModal
        isOpen={!!variantToDelete}
        title="Delete Size Variant"
        itemTitle={variantToDelete ? `Size ${variantToDelete.size} (${variantToDelete.colorName})` : ''}
        message={`Are you sure you want to delete Size "${variantToDelete?.size}" (${variantToDelete?.colorName})?`}
        details={`Current inventory of ${variantToDelete?.quantity || 0} units for this size will be permanently removed.`}
        confirmLabel="Yes, Delete"
        cancelLabel="No, Cancel"
        onConfirm={handleConfirmVariantDelete}
        onCancel={() => setVariantToDelete(null)}
      />
    </div>
  );
};
