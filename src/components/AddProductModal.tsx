import React, { useState, useRef } from 'react';
import {
  Product,
  GarmentCategory,
  GarmentSize,
  ColorVariant,
  ProductVariant,
  User,
  TargetAudience,
  Category,
} from '../types/inventory';
import { compressImage } from '../utils/imageCompressor';
import { ImageCropModal } from './ImageCropModal';
import {
  X,
  Camera,
  Upload,
  Plus,
  Package,
  Layers,
  Sparkles,
  Check,
  RefreshCw,
  Users,
  FolderPlus,
  Tag,
  Boxes,
  Trash2,
  Crop,
  Star,
  Image as ImageIcon,
} from 'lucide-react';

interface AddProductModalProps {
  currentUser: User;
  categories: Category[];
  onClose: () => void;
  onSaveProduct: (product: Product) => void;
  productToEdit?: Product;
  onManageCategories?: () => void;
}

const TARGET_AUDIENCES: TargetAudience[] = ['Men', 'Women', 'Kids', 'Unisex'];

const STANDARD_SIZES: GarmentSize[] = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const PRESET_COLORS: ColorVariant[] = [
  { name: 'Pitch Black', hex: '#18181b' },
  { name: 'Bone White', hex: '#f8fafc' },
  { name: 'Heather Grey', hex: '#94a3b8' },
  { name: 'Deep Navy', hex: '#1e293b' },
  { name: 'Forest Olive', hex: '#2d372e' },
  { name: 'Burgundy Wine', hex: '#581c24' },
  { name: 'Camel Tan', hex: '#c29b72' },
  { name: 'Washed Sage', hex: '#4b5563' },
  { name: 'Mocha Brown', hex: '#573926' },
];

export const AddProductModal: React.FC<AddProductModalProps> = ({
  currentUser,
  categories,
  onClose,
  onSaveProduct,
  productToEdit,
  onManageCategories,
}) => {
  const isEditing = Boolean(productToEdit);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Basic Information
  const [name, setName] = useState(productToEdit?.name || '');
  const [sku, setSku] = useState(productToEdit?.sku || '');
  
  // Category - unselected by default for new items
  const [categoryId, setCategoryId] = useState<string>(productToEdit?.categoryId || '');
  const [category, setCategory] = useState<string>(productToEdit?.category || '');

  // Target audience - defaults to Unisex if not specified
  const [targetAudience, setTargetAudience] = useState<TargetAudience | ''>(
    productToEdit?.targetAudience || ''
  );

  const [description, setDescription] = useState(productToEdit?.description || '');
  const [fabricDetails, setFabricDetails] = useState(productToEdit?.fabricDetails || '');
  const [price, setPrice] = useState<number | ''>(productToEdit?.price || '');

  // Multi-image Support
  const initialImages: string[] = productToEdit?.images && productToEdit.images.length > 0
    ? productToEdit.images
    : productToEdit?.image
    ? [productToEdit.image]
    : [];
  const [images, setImages] = useState<string[]>(initialImages);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [cropTargetImage, setCropTargetImage] = useState<string | null>(null);
  const [cropTargetIdx, setCropTargetIdx] = useState<number | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Check if item is standard (no sizes or colors, e.g. bracelet, non-apparel accessory)
  const isExistingStandard = Boolean(
    productToEdit &&
      productToEdit.variants.length === 1 &&
      (productToEdit.variants[0].size === 'One Size' || productToEdit.variants[0].size === 'Standard') &&
      (productToEdit.variants[0].colorName === 'Standard' || !productToEdit.variants[0].colorName)
  );

  // Tracking Mode:
  // 'standard' = Single stock quantity (e.g. Bracelet, Bag, Cap, Non-apparel goods)
  // 'matrix' = Apparel matrix with sizes and/or colors
  const [trackingMode, setTrackingMode] = useState<'standard' | 'matrix'>(
    productToEdit ? (isExistingStandard ? 'standard' : 'matrix') : 'standard'
  );

  // Standard Item Single Stock
  const [standardQty, setStandardQty] = useState<number>(() => {
    if (productToEdit) return productToEdit.totalQuantity || 0;
    return 0;
  });
  const [standardThreshold, setStandardThreshold] = useState<number | ''>(() => {
    if (productToEdit && productToEdit.variants[0]?.minThreshold !== undefined && productToEdit.variants[0]?.minThreshold !== null) {
      return productToEdit.variants[0].minThreshold;
    }
    return '';
  });

  // Matrix Configuration: Has sizes / Has colors
  const [hasSizes, setHasSizes] = useState<boolean>(() => {
    if (productToEdit && !isExistingStandard) {
      return productToEdit.variants.some((v) => v.size && v.size !== 'One Size' && v.size !== 'Standard');
    }
    return true;
  });

  const [hasColors, setHasColors] = useState<boolean>(() => {
    if (productToEdit && !isExistingStandard) {
      return productToEdit.variants.some((v) => v.colorName && v.colorName !== 'Standard');
    }
    return true;
  });

  // Selected Sizes & Colors
  const initialSizes: GarmentSize[] = productToEdit && !isExistingStandard
    ? Array.from(new Set(productToEdit.variants.map((v) => v.size).filter((s) => s !== 'One Size' && s !== 'Standard')))
    : [];

  const initialColors: ColorVariant[] = productToEdit && !isExistingStandard
    ? Array.from(
        new Map(
          productToEdit.variants
            .filter((v) => v.colorName !== 'Standard')
            .map((v) => [v.colorName, { name: v.colorName, hex: v.colorHex }])
        ).values()
      )
    : [];

  const [availableSizes, setAvailableSizes] = useState<GarmentSize[]>(() => {
    if (productToEdit) {
      const existingSizes = productToEdit.variants.map((v) => v.size);
      return Array.from(new Set([...STANDARD_SIZES, ...existingSizes]));
    }
    return STANDARD_SIZES;
  });
  const [selectedSizes, setSelectedSizes] = useState<GarmentSize[]>(initialSizes);
  const [selectedColors, setSelectedColors] = useState<ColorVariant[]>(initialColors);
  const [showAddCustomSize, setShowAddCustomSize] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState('');

  // Custom Color Add
  const [customColorName, setCustomColorName] = useState('');
  const [customColorHex, setCustomColorHex] = useState('#3b82f6');
  const [showCustomColor, setShowCustomColor] = useState(false);

  // Matrix quantities: key is `${size}_${colorName}`
  const initialQuantities: Record<string, number> = {};
  // Matrix alert thresholds per size/color: key is `${size}_${colorName}`
  const initialThresholds: Record<string, number | ''> = {};
  if (productToEdit && !isExistingStandard) {
    productToEdit.variants.forEach((v) => {
      initialQuantities[`${v.size}_${v.colorName}`] = v.quantity;
      initialThresholds[`${v.size}_${v.colorName}`] =
        v.minThreshold !== undefined && v.minThreshold !== null ? v.minThreshold : '';
    });
  }
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>(initialQuantities);
  const [variantThresholds, setVariantThresholds] = useState<Record<string, number | ''>>(initialThresholds);
  const [bulkQty, setBulkQty] = useState<number>(0);
  const [bulkThreshold, setBulkThreshold] = useState<number | ''>('');

  const [formError, setFormError] = useState('');

  // Handle image files from mobile camera or gallery
  const handleFilePicked = (file: File, replaceIdx: number | null = null) => {
    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCropTargetImage(dataUrl);
        setCropTargetIdx(replaceIdx);
      }
      setIsProcessingImage(false);
    };
    reader.onerror = () => {
      setIsProcessingImage(false);
      setFormError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFilePicked(file, null);
    }
    e.target.value = '';
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFilePicked(file, null);
    }
    e.target.value = '';
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    if (cropTargetIdx !== null && cropTargetIdx >= 0 && cropTargetIdx < images.length) {
      setImages((prev) => {
        const next = [...prev];
        next[cropTargetIdx] = croppedDataUrl;
        return next;
      });
    } else {
      setImages((prev) => [...prev, croppedDataUrl]);
      setActiveImageIdx(images.length);
    }
    setCropTargetImage(null);
    setCropTargetIdx(null);
  };

  const handleRemoveImage = (idxToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
    if (activeImageIdx >= images.length - 1) {
      setActiveImageIdx(Math.max(0, images.length - 2));
    }
  };

  const handleSetPrimaryImage = (idxToPrimary: number) => {
    if (idxToPrimary === 0) return;
    setImages((prev) => {
      const item = prev[idxToPrimary];
      const remaining = prev.filter((_, idx) => idx !== idxToPrimary);
      return [item, ...remaining];
    });
    setActiveImageIdx(0);
  };

  const handleGenerateSku = () => {
    const catCode = category ? category.substring(0, 2).toUpperCase() : 'IT';
    const randomNum = Math.floor(100 + Math.random() * 900);
    setSku(`WH-${catCode}-${randomNum}`);
  };

  // Toggle size
  const toggleSize = (size: GarmentSize) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== size));
    } else {
      setSelectedSizes([...selectedSizes, size]);
    }
  };

  const handleAddCustomSize = () => {
    const trimmed = customSizeInput.trim().toUpperCase();
    if (!trimmed) return;
    if (!availableSizes.includes(trimmed)) {
      setAvailableSizes([...availableSizes, trimmed]);
    }
    if (!selectedSizes.includes(trimmed)) {
      setSelectedSizes([...selectedSizes, trimmed]);
    }
    setCustomSizeInput('');
    setShowAddCustomSize(false);
  };

  // Toggle color
  const toggleColor = (color: ColorVariant) => {
    const exists = selectedColors.some((c) => c.name === color.name);
    if (exists) {
      setSelectedColors(selectedColors.filter((c) => c.name !== color.name));
    } else {
      setSelectedColors([...selectedColors, color]);
    }
  };

  const handleAddCustomColor = () => {
    if (!customColorName.trim()) return;
    const newColor: ColorVariant = {
      name: customColorName.trim(),
      hex: customColorHex,
    };
    if (!selectedColors.some((c) => c.name.toLowerCase() === newColor.name.toLowerCase())) {
      setSelectedColors([...selectedColors, newColor]);
    }
    setCustomColorName('');
    setShowCustomColor(false);
  };

  // Bulk set all variant quantities
  const handleApplyBulkQty = () => {
    const nextQtys: Record<string, number> = { ...variantQuantities };
    const effectiveSizes = hasSizes ? (selectedSizes.length > 0 ? selectedSizes : ['One Size']) : ['One Size'];
    const effectiveColors = hasColors ? (selectedColors.length > 0 ? selectedColors : [{ name: 'Standard', hex: '#94a3b8' }]) : [{ name: 'Standard', hex: '#94a3b8' }];

    effectiveSizes.forEach((s) => {
      effectiveColors.forEach((c) => {
        nextQtys[`${s}_${c.name}`] = bulkQty;
      });
    });
    setVariantQuantities(nextQtys);
  };

  // Bulk set all variant alert thresholds
  const handleApplyBulkThreshold = () => {
    const nextThresh: Record<string, number | ''> = { ...variantThresholds };
    const effectiveSizes = hasSizes ? (selectedSizes.length > 0 ? selectedSizes : ['One Size']) : ['One Size'];
    const effectiveColors = hasColors ? (selectedColors.length > 0 ? selectedColors : [{ name: 'Standard', hex: '#94a3b8' }]) : [{ name: 'Standard', hex: '#94a3b8' }];

    effectiveSizes.forEach((s) => {
      effectiveColors.forEach((c) => {
        nextThresh[`${s}_${c.name}`] = bulkThreshold;
      });
    });
    setVariantThresholds(nextThresh);
  };

  // Calculate total units
  const totalStock = trackingMode === 'standard'
    ? Number(standardQty) || 0
    : (() => {
        const effectiveSizes = hasSizes ? (selectedSizes.length > 0 ? selectedSizes : ['One Size']) : ['One Size'];
        const effectiveColors = hasColors ? (selectedColors.length > 0 ? selectedColors : [{ name: 'Standard', hex: '#94a3b8' }]) : [{ name: 'Standard', hex: '#94a3b8' }];
        return effectiveSizes.reduce((sum, size) => {
          return (
            sum +
            effectiveColors.reduce((cSum, color) => {
              const val = variantQuantities[`${size}_${color.name}`] || 0;
              return cSum + val;
            }, 0)
          );
        }, 0);
      })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter item name');
      return;
    }

    const finalSku = sku.trim() || `WH-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalAudience: TargetAudience = (targetAudience || 'Unisex') as TargetAudience;
    // An item does not have to be assigned to a category; default to 'Unassigned'
    const finalCategory = category.trim() || 'Unassigned';

    let variants: ProductVariant[] = [];

    if (trackingMode === 'standard') {
      // 1. Standard single item (e.g. Bracelet "7azaza", non-clothing accessory, one-size item)
      variants = [
        {
          id: productToEdit?.variants[0]?.id || `v_${finalSku}_std`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          size: 'One Size',
          colorName: 'Standard',
          colorHex: '#94a3b8',
          quantity: Math.max(0, Number(standardQty) || 0),
          sku: finalSku,
          minThreshold:
            standardThreshold !== '' && !isNaN(Number(standardThreshold))
              ? Number(standardThreshold)
              : undefined,
        },
      ];
    } else {
      // 2. Matrix Item (Sizes & Colors)
      if (hasSizes && selectedSizes.length === 0 && hasColors && selectedColors.length === 0) {
        setFormError('Please select at least one size or color, or choose "Standard Single Item" mode.');
        return;
      }

      const effectiveSizes: GarmentSize[] = hasSizes
        ? (selectedSizes.length > 0 ? selectedSizes : ['One Size'])
        : ['One Size'];

      const effectiveColors: ColorVariant[] = hasColors
        ? (selectedColors.length > 0 ? selectedColors : [{ name: 'Standard', hex: '#94a3b8' }])
        : [{ name: 'Standard', hex: '#94a3b8' }];

      effectiveSizes.forEach((size) => {
        effectiveColors.forEach((col) => {
          const key = `${size}_${col.name}`;
          const qty = variantQuantities[key] !== undefined ? variantQuantities[key] : 0;
          const threshVal = variantThresholds[key];
          const colorSlug = col.name !== 'Standard' ? col.name.substring(0, 3).toUpperCase() : 'STD';
          const sizeSlug = size !== 'One Size' ? size : 'OS';

          variants.push({
            id: `v_${finalSku}_${colorSlug}_${sizeSlug}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            size,
            colorName: col.name,
            colorHex: col.hex,
            quantity: Math.max(0, qty),
            sku: `${finalSku}-${colorSlug}-${sizeSlug}`,
            // Save specific alert threshold per size/variant, or leave undefined/blank
            minThreshold:
              threshVal !== '' && threshVal !== undefined && !isNaN(Number(threshVal))
                ? Number(threshVal)
                : undefined,
          });
        });
      });
    }

    const finalProduct: Product = {
      id: productToEdit ? productToEdit.id : `prod_${Date.now()}`,
      sku: finalSku,
      name: name.trim(),
      categoryId: categoryId || undefined,
      category: finalCategory,
      targetAudience: finalAudience,
      description: description.trim() || `${name.trim()} item in warehouse inventory.`,
      fabricDetails: fabricDetails.trim(),
      price: price === '' ? undefined : Number(price),
      image: images[0] || '',
      images: images,
      variants,
      totalQuantity: variants.reduce((sum, v) => sum + v.quantity, 0),
      createdAt: productToEdit ? productToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveProduct(finalProduct);
    onClose();
  };

  return (
    <>
      {/* Interactive Image Cropper Modal */}
      {cropTargetImage && (
        <ImageCropModal
          imageSrc={cropTargetImage}
          onCropComplete={handleCropComplete}
          onClose={() => {
            setCropTargetImage(null);
            setCropTargetIdx(null);
          }}
        />
      )}

      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          {/* Mobile handle */}
          <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-3" />

          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {isEditing ? 'Edit Item' : 'New Item'}
                </h2>
                <p className="text-xs text-slate-500">
                  Configure item details, description, and inventory stock
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-6">
            {/* Section 1: Mobile Photo Upload & Basic Details */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Photo Upload Area (Supports Multiple Photos + Cropping) */}
              <div className="md:col-span-5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Item Photos ({images.length})
                  </label>
                  {images.length > 0 && (
                    <span className="text-[10px] text-amber-700 font-bold">
                      First photo is primary cover
                    </span>
                  )}
                </div>

                {images.length > 0 && images[activeImageIdx] ? (
                  <div className="space-y-2">
                    <div className="relative aspect-[4/3] rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner group">
                      <img
                        src={images[activeImageIdx]}
                        alt="Product Preview"
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Cover Badge */}
                      {activeImageIdx === 0 && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] shadow-sm flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> Cover Photo
                        </div>
                      )}

                      {/* Action buttons on active photo */}
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCropTargetImage(images[activeImageIdx]);
                            setCropTargetIdx(activeImageIdx);
                          }}
                          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur-sm shadow-sm"
                          title="Re-crop Photo"
                        >
                          <Crop className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(activeImageIdx)}
                          className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white shadow-sm"
                          title="Delete Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {activeImageIdx !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(activeImageIdx)}
                          className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] font-bold backdrop-blur-sm"
                        >
                          Make Cover
                        </button>
                      )}
                    </div>

                    {/* Thumbnail gallery */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIdx(idx)}
                          className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                            activeImageIdx === idx
                              ? 'border-amber-500 ring-2 ring-amber-500/20'
                              : 'border-slate-200 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          {idx === 0 && (
                            <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-[8px] font-black text-center text-slate-950 py-0.2">
                              COVER
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 overflow-hidden flex flex-col items-center justify-center p-4 text-center shadow-inner group hover:bg-slate-100/70 transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mb-2 shadow-sm">
                      <Camera className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">No Photos Yet</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Take photo or upload multiple images
                    </span>
                  </div>
                )}

                {/* Mobile Camera & Gallery Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Camera file input (for mobile device camera) */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleCameraChange}
                    className="hidden"
                  />
                  {/* Photo library / gallery input (standard gallery, supports mobile & desktop) */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={galleryInputRef}
                    onChange={handleGalleryChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-h-[42px] border border-slate-200"
                  >
                    <Camera className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-h-[42px] border border-slate-200"
                  >
                    <Upload className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Gallery</span>
                  </button>
                </div>
              </div>

              {/* Product Meta Details */}
              <div className="md:col-span-7 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Silver Beaded Bracelet, Heavyweight Hoodie, Leather Belt..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      SKU Code
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      className="text-[11px] text-amber-700 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="e.g. WH-BR-101"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Category (Optional)
                    </label>
                    {onManageCategories && (
                      <button
                        type="button"
                        onClick={onManageCategories}
                        className="text-[11px] text-amber-700 hover:text-amber-800 font-bold hover:underline flex items-center gap-1"
                      >
                        <FolderPlus className="w-3 h-3" />
                        <span>Manage</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={category}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      setCategory(selectedName);
                      const matched = categories.find((c) => c.name === selectedName);
                      setCategoryId(matched ? matched.id : '');
                    }}
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 ${
                      category ? 'text-slate-900 border-slate-300' : 'text-slate-500 border-slate-300'
                    }`}
                  >
                    <option value="" className="text-slate-600 font-medium">
                      -- No Category (Unassigned) --
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name} className="text-slate-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Audience / Demographic */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>Target Audience (Optional)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {targetAudience ? `Selected: ${targetAudience}` : 'Unisex (Default)'}
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TARGET_AUDIENCES.map((aud) => {
                    const isSelected = targetAudience === aud;
                    return (
                      <button
                        key={aud}
                        type="button"
                        onClick={() => setTargetAudience(isSelected ? '' : aud)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <span>{aud}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description & Spec */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Description & Specifications (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Handmade natural stone bracelet with elastic cord, or 100% Combed Cotton Hoodie..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Material / Fabric Details
                  </label>
                  <input
                    type="text"
                    value={fabricDetails}
                    onChange={(e) => setFabricDetails(e.target.value)}
                    placeholder="e.g. Stainless Steel / Cotton / Leather"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Price ($ / EGP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="e.g. 25.00"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Product Type & Stock Tracking Mode */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-600" />
                <span>Inventory Tracking Mode</span>
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Choose whether this item requires sizes and colors or has a single standard stock count.
              </p>
            </div>

            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTrackingMode('standard')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  trackingMode === 'standard'
                    ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${trackingMode === 'standard' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'}`}>
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Standard Single Item</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    For bracelets, accessories, caps, or items with no sizes or colors.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTrackingMode('matrix')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  trackingMode === 'matrix'
                    ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${trackingMode === 'matrix' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'}`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Variants Matrix (Sizes & Colors)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    For apparel and items tracked by specific sizes (S, M, L) and colorways.
                  </div>
                </div>
              </button>
            </div>

            {/* MODE 1: STANDARD SINGLE ITEM QUANTITY */}
            {trackingMode === 'standard' && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Stock Quantity in Warehouse *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={standardQty}
                      onChange={(e) => setStandardQty(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="e.g. 50"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Physical units available in stock.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Low Stock Alert Threshold (Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={standardThreshold}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setStandardThreshold(raw === '' ? '' : Math.max(0, parseInt(raw) || 0));
                      }}
                      placeholder="Leave blank or enter (e.g. 5)"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Can be left blank or saved with an alert number.</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">Total Item Stock:</span>
                  <span className="text-base font-black font-mono tabular-nums text-slate-900">
                    {standardQty} units
                  </span>
                </div>
              </div>
            )}

            {/* MODE 2: SIZES & COLORS CONFIGURATION */}
            {trackingMode === 'matrix' && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                {/* Variant Toggles */}
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={hasSizes}
                      onChange={(e) => setHasSizes(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span>Has Specific Sizes (S, M, L...)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={hasColors}
                      onChange={(e) => setHasColors(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span>Has Specific Colors</span>
                  </label>
                </div>

                {/* Size Selection */}
                {hasSizes && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        1. Select Sizes:
                      </label>
                      <span className="text-xs text-slate-500 font-semibold">
                        {selectedSizes.length} sizes active
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {availableSizes.map((sz) => {
                        const isSelected = selectedSizes.includes(sz);
                        const isCustom = !STANDARD_SIZES.includes(sz);
                        return (
                          <div key={sz} className="relative inline-flex items-center">
                            <button
                              type="button"
                              onClick={() => toggleSize(sz)}
                              className={`min-w-[48px] py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                                  : 'bg-white text-slate-600 border border-slate-300 hover:text-slate-900'
                              }`}
                            >
                              {sz}
                            </button>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAvailableSizes(availableSizes.filter((s) => s !== sz));
                                  setSelectedSizes(selectedSizes.filter((s) => s !== sz));
                                }}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-300 hover:bg-rose-500 hover:text-white text-slate-700 flex items-center justify-center text-[10px] font-bold shadow-sm"
                                title="Remove size"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {!showAddCustomSize ? (
                        <button
                          type="button"
                          onClick={() => setShowAddCustomSize(true)}
                          className="py-2 px-3 rounded-xl border border-dashed border-amber-400 bg-amber-50/60 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-700" />
                          <span>Add Size</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 p-1 bg-white border border-amber-400 rounded-xl shadow-sm">
                          <input
                            type="text"
                            value={customSizeInput}
                            onChange={(e) => setCustomSizeInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomSize();
                              }
                            }}
                            placeholder="e.g. 32, 44..."
                            className="w-32 px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomSize}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddCustomSize(false);
                              setCustomSizeInput('');
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Color Selection */}
                {hasColors && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        2. Select Colors:
                      </label>
                      <span className="text-xs text-slate-500 font-semibold">
                        {selectedColors.length} colors selected
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PRESET_COLORS.map((col) => {
                        const isSelected = selectedColors.some((c) => c.name === col.name);
                        return (
                          <button
                            key={col.name}
                            type="button"
                            onClick={() => toggleColor(col)}
                            className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs border transition-all ${
                              isSelected
                                ? 'bg-white border-amber-500 text-slate-900 font-bold shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                              style={{ backgroundColor: col.hex }}
                            />
                            <span className="truncate">{col.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 ml-auto text-amber-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-1">
                      {!showCustomColor ? (
                        <button
                          type="button"
                          onClick={() => setShowCustomColor(true)}
                          className="text-xs text-amber-700 hover:underline flex items-center gap-1 font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Custom Color</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="color"
                            value={customColorHex}
                            onChange={(e) => setCustomColorHex(e.target.value)}
                            className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border border-slate-300"
                          />
                          <input
                            type="text"
                            value={customColorName}
                            onChange={(e) => setCustomColorName(e.target.value)}
                            placeholder="Color Name"
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomColor}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCustomColor(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stock Matrix Quantities */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-amber-600" />
                        <span>3. Variant Stock Quantities & Alert Thresholds</span>
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Set physical stock and low-stock alert threshold for each size (leave alert blank or enter custom number).
                      </p>
                    </div>

                    {/* Bulk controls for Qty and Alert Threshold */}
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-600 pl-1 font-bold">Qty:</span>
                        <input
                          type="number"
                          min="0"
                          value={bulkQty}
                          onChange={(e) => setBulkQty(parseInt(e.target.value) || 0)}
                          className="w-12 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulkQty}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold rounded-lg transition-colors"
                        >
                          Set Qty
                        </button>
                      </div>

                      <span className="text-slate-300 hidden sm:inline">|</span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-600 pl-1 font-bold">Alert:</span>
                        <input
                          type="number"
                          min="0"
                          value={bulkThreshold}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setBulkThreshold(raw === '' ? '' : Math.max(0, parseInt(raw) || 0));
                          }}
                          placeholder="Opt"
                          className="w-12 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center placeholder:text-slate-400 placeholder:font-normal"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulkThreshold}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold rounded-lg transition-colors"
                        >
                          Set Alert
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Matrix Rows */}
                  {(() => {
                    const effectiveSizes = hasSizes ? (selectedSizes.length > 0 ? selectedSizes : ['One Size']) : ['One Size'];
                    const effectiveColors = hasColors ? (selectedColors.length > 0 ? selectedColors : [{ name: 'Standard', hex: '#94a3b8' }]) : [{ name: 'Standard', hex: '#94a3b8' }];

                    return (
                      <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                        {effectiveColors.map((col) => (
                          <div key={col.name} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="flex items-center gap-2 mb-2.5">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-slate-300"
                                style={{ backgroundColor: col.hex }}
                              />
                              <span className="text-xs font-bold text-slate-900">{col.name}</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {effectiveSizes.map((sz) => {
                                const key = `${sz}_${col.name}`;
                                const qty = variantQuantities[key] !== undefined ? variantQuantities[key] : 0;
                                const thresh = variantThresholds[key];

                                return (
                                  <div
                                    key={sz}
                                    className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5 hover:border-slate-300 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-mono font-black text-slate-800">
                                        Size {sz}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        Stock & Alert
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">
                                          Qty:
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={qty}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setVariantQuantities({
                                              ...variantQuantities,
                                              [key]: Math.max(0, val),
                                            });
                                          }}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">
                                          Alert Min:
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={thresh !== undefined ? thresh : ''}
                                          onChange={(e) => {
                                            const raw = e.target.value;
                                            setVariantThresholds({
                                              ...variantThresholds,
                                              [key]: raw === '' ? '' : Math.max(0, parseInt(raw) || 0),
                                            });
                                          }}
                                          placeholder="Blank (opt)"
                                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-amber-600"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Total Calculated Stock:</span>
                    <span className="text-base font-black font-mono tabular-nums text-slate-900">
                      {totalStock} units
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {formError && <p className="text-xs text-rose-600 font-bold">{formError}</p>}

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all min-h-[44px]"
            >
              {isEditing ? 'Save Changes' : 'Add New Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </>
  );
};
