import React, { useState, useRef } from 'react';
import {
  Product,
  GarmentCategory,
  GarmentSize,
  ColorVariant,
  ProductVariant,
  User,
  TargetAudience,
} from '../types/inventory';
import { compressImage, getApparelCategoryFallback } from '../utils/imageCompressor';
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
  FileText,
  Users,
} from 'lucide-react';

interface AddProductModalProps {
  currentUser: User;
  onClose: () => void;
  onSaveProduct: (product: Product) => void;
  productToEdit?: Product;
}

const CATEGORIES: GarmentCategory[] = [
  'T-Shirts & Tops',
  'Hoodies & Sweatshirts',
  'Pants & Jeans',
  'Jackets & Outerwear',
  'Shorts & Swim',
  'Knitwear & Sweaters',
  'Activewear',
  'Accessories',
];

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
  onClose,
  onSaveProduct,
  productToEdit,
}) => {
  const isEditing = Boolean(productToEdit);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Basic Information
  const [name, setName] = useState(productToEdit?.name || '');
  const [sku, setSku] = useState(productToEdit?.sku || '');
  const [category, setCategory] = useState<GarmentCategory>(
    productToEdit?.category || 'T-Shirts & Tops'
  );
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(
    productToEdit?.targetAudience || 'Unisex'
  );
  // Product Description replacing warehouse location
  const [description, setDescription] = useState(
    productToEdit?.description || ''
  );
  const [fabricDetails, setFabricDetails] = useState(productToEdit?.fabricDetails || '');
  const [price, setPrice] = useState<number | ''>(productToEdit?.price || '');

  // Photo (Defaults to blank/empty string for new items)
  const [imagePreview, setImagePreview] = useState<string>(
    productToEdit?.image || ''
  );
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Selected Sizes & Colors
  const initialSizes: GarmentSize[] = productToEdit
    ? Array.from(new Set(productToEdit.variants.map((v) => v.size)))
    : ['S', 'M', 'L', 'XL'];

  const initialColors: ColorVariant[] = productToEdit
    ? Array.from(
        new Map(productToEdit.variants.map((v) => [v.colorName, { name: v.colorName, hex: v.colorHex }])).values()
      )
    : [PRESET_COLORS[0], PRESET_COLORS[1]];

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

  // Matrix quantities: key is `${size}_${colorName}` - default starts at 0
  const initialQuantities: Record<string, number> = {};
  if (productToEdit) {
    productToEdit.variants.forEach((v) => {
      initialQuantities[`${v.size}_${v.colorName}`] = v.quantity;
    });
  }
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>(initialQuantities);
  const [bulkQty, setBulkQty] = useState<number>(0);

  const [formError, setFormError] = useState('');

  // Handle image upload from Mobile camera or gallery
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const compressedDataUrl = await compressImage(file, 800, 800, 0.82);
      setImagePreview(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress image:', err);
      setFormError('Failed to process image. Please try another file.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleGenerateSku = () => {
    const catCode = category.substring(0, 2).toUpperCase();
    const randomNum = Math.floor(100 + Math.random() * 900);
    setSku(`WH-${catCode}-${randomNum}`);
  };

  // Toggle size
  const toggleSize = (size: GarmentSize) => {
    if (selectedSizes.includes(size)) {
      if (selectedSizes.length > 1) {
        setSelectedSizes(selectedSizes.filter((s) => s !== size));
      }
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
      if (selectedColors.length > 1) {
        setSelectedColors(selectedColors.filter((c) => c.name !== color.name));
      }
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

  // Bulk set all variants
  const handleApplyBulkQty = () => {
    const nextQtys: Record<string, number> = { ...variantQuantities };
    selectedSizes.forEach((s) => {
      selectedColors.forEach((c) => {
        nextQtys[`${s}_${c.name}`] = bulkQty;
      });
    });
    setVariantQuantities(nextQtys);
  };

  // Calculate total units
  const totalStock = selectedSizes.reduce((sum, size) => {
    return (
      sum +
      selectedColors.reduce((cSum, color) => {
        const val = variantQuantities[`${size}_${color.name}`] || 0;
        return cSum + val;
      }, 0)
    );
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter product name');
      return;
    }

    const finalSku = sku.trim() || `WH-${Math.floor(1000 + Math.random() * 9000)}`;

    // Build variants array - defaults to 0 quantity
    const variants: ProductVariant[] = [];
    selectedSizes.forEach((size) => {
      selectedColors.forEach((col) => {
        const key = `${size}_${col.name}`;
        const qty = variantQuantities[key] !== undefined ? variantQuantities[key] : 0;
        const colorSlug = col.name.substring(0, 3).toUpperCase();
        variants.push({
          id: `v_${finalSku}_${colorSlug}_${size}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          size,
          colorName: col.name,
          colorHex: col.hex,
          quantity: Math.max(0, qty),
          sku: `${finalSku}-${colorSlug}-${size}`,
          minThreshold: 10,
        });
      });
    });

    const finalProduct: Product = {
      id: productToEdit ? productToEdit.id : `prod_${Date.now()}`,
      sku: finalSku,
      name: name.trim(),
      category,
      targetAudience,
      description: description.trim() || `${name.trim()} apparel garment available in multiple sizes and colors.`,
      fabricDetails: fabricDetails.trim(),
      price: price === '' ? undefined : Number(price),
      image: imagePreview,
      variants,
      totalQuantity: variants.reduce((sum, v) => sum + v.quantity, 0),
      createdAt: productToEdit ? productToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveProduct(finalProduct);
    onClose();
  };

  return (
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
                {isEditing ? 'Edit Item' : 'Add New Item'}
              </h2>
              <p className="text-xs text-slate-500">
                Configure item description, sizes, colors, and stock matrix
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
            {/* Photo Upload Area */}
            <div className="md:col-span-4 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Item Photo (Optional)
              </label>

              {imagePreview ? (
                <div className="relative aspect-[4/3] rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner group">
                  <img
                    src={imagePreview}
                    alt="Product Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview('')}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold backdrop-blur-sm transition-all shadow-sm"
                  >
                    Clear Photo
                  </button>

                  {isProcessingImage && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-xs font-bold text-slate-900">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2 text-amber-600" />
                      Compressing photo...
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-[4/3] rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 overflow-hidden flex flex-col items-center justify-center p-4 text-center shadow-inner group hover:bg-slate-100/70 transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mb-2 shadow-sm">
                    <Camera className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">No Image (Blank)</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Upload below or leave empty
                  </span>

                  {isProcessingImage && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-xs font-bold text-slate-900">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2 text-amber-600" />
                      Compressing photo...
                    </div>
                  )}
                </div>
              )}

              {/* Upload & Camera Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  onChange={handleImageFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-h-[44px] border border-slate-200"
                >
                  <Camera className="w-4 h-4 text-amber-600" />
                  <span>Snap Camera</span>
                </button>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-h-[44px] border border-slate-200"
                >
                  <Upload className="w-4 h-4 text-sky-600" />
                  <span>Upload File</span>
                </button>
              </div>
            </div>

            {/* Product Meta Details */}
            <div className="md:col-span-8 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Heavyweight French Terry Zip Hoodie"
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
                    placeholder="e.g. WH-HD-450"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Audience / Gender Demographic */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>Target Audience (Who is this for?) *</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">Selected: {targetAudience}</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TARGET_AUDIENCES.map((aud) => {
                    const isSelected = targetAudience === aud;
                    return (
                      <button
                        key={aud}
                        type="button"
                        onClick={() => setTargetAudience(aud)}
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

              {/* Product Description replacing warehouse location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center justify-between">
                  <span>Product Description *</span>
                  <span className="text-[11px] font-normal text-slate-500">Fabric, cut, and fit overview</span>
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 450 GSM ultra-heavy French Terry cotton with drop shoulder silhouette and double-layered hood."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Fabric Specs & Care
                </label>
                <input
                  type="text"
                  value={fabricDetails}
                  onChange={(e) => setFabricDetails(e.target.value)}
                  placeholder="e.g. 100% Combed Cotton, Enzyme Washed, Machine Wash Cold"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Size Configuration */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Select Garment Sizes Available:
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
                        title="Remove custom size"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add Custom Size Button */}
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
                    placeholder="e.g. XXL, 32, 44..."
                    className="w-36 px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none"
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

          {/* Section 3: Color Palette Configuration */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Select Colors for this Garment:
              </label>
              <span className="text-xs text-slate-500 font-semibold">
                {selectedColors.length} colors selected
              </span>
            </div>

            {/* Presets */}
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

            {/* Add Custom Color */}
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
                    placeholder="Color Name (e.g. Washed Clay)"
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

          {/* Section 4: Dynamic Size x Color Stock Matrix */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>3. Stock Quantities by Variant Matrix</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Enter physical units for each size and color combination.
                </p>
              </div>

              {/* Bulk Fill Tool */}
              <div className="flex items-center gap-2 self-start sm:self-auto bg-white p-1 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 pl-2 font-medium">Bulk set:</span>
                <input
                  type="number"
                  min="0"
                  value={bulkQty}
                  onChange={(e) => setBulkQty(parseInt(e.target.value) || 0)}
                  className="w-14 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                />
                <button
                  type="button"
                  onClick={handleApplyBulkQty}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors"
                >
                  Apply All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextQtys: Record<string, number> = {};
                    selectedSizes.forEach((s) => {
                      selectedColors.forEach((c) => {
                        nextQtys[`${s}_${c.name}`] = 0;
                      });
                    });
                    setVariantQuantities(nextQtys);
                    setBulkQty(0);
                  }}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-lg transition-colors"
                  title="Reset all sizes and colors to 0"
                >
                  Zero All (0)
                </button>
              </div>
            </div>

            {/* Matrix Grid */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {selectedColors.map((col) => (
                <div
                  key={col.name}
                  className="p-3 rounded-xl bg-white border border-slate-200"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: col.hex }}
                    />
                    <span className="text-xs font-bold text-slate-900">{col.name}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {selectedSizes.map((sz) => {
                      const key = `${sz}_${col.name}`;
                      const qty = variantQuantities[key] !== undefined ? variantQuantities[key] : 0;
                      return (
                        <div
                          key={sz}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <span className="text-xs font-mono font-bold text-slate-700">{sz}:</span>
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
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:border-amber-600"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Total units indicator */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900">Total Garment Stock Balance:</span>
              <span className="text-base font-black font-mono tabular-nums text-slate-900">
                {totalStock} units
              </span>
            </div>
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
              {isEditing ? 'Save Product Changes' : 'Create & Add to Warehouse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
