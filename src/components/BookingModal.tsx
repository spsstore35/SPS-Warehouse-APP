import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductVariant, Booking, BookingItem, User, Role } from '../types/inventory';
import {
  X,
  Plus,
  Minus,
  Trash2,
  CalendarCheck,
  DollarSign,
  User as UserIcon,
  Phone,
  Package,
  Layers,
  Check,
  Edit3,
  AlertCircle,
} from 'lucide-react';

const formatSizeShort = (sz?: string) =>
  !sz || sz === 'One Size' || sz === 'Standard' ? 'Standard Size' : sz;

const formatSizeBadge = (sz?: string) =>
  !sz || sz === 'One Size' || sz === 'Standard' ? 'Standard Size' : `Size ${sz}`;

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProduct?: Product;
  bookingToEdit?: Booking | null;
  currentUser: User;
  existingBookings?: Booking[];
  onSaveBooking: (booking: Booking, autoAdvanceToPreparing?: boolean) => void;
}

function isLightColor(hex?: string): boolean {
  if (!hex || hex === 'transparent') return true;
  const c = hex.replace('#', '');
  if (c.length !== 6 && c.length !== 3) return false;
  const rgb =
    c.length === 3
      ? [parseInt(c[0] + c[0], 16), parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16)]
      : [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.65;
}

function generateBookingSerial(existingBookings: Booking[] = []): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearShort = String(now.getFullYear()).slice(-2);
  const prefix = `SPS-${day}${month}${yearShort}`;

  let maxSeq = 0;
  existingBookings.forEach((b) => {
    if (b.bookingNumber) {
      if (b.bookingNumber.startsWith(prefix)) {
        const rest = b.bookingNumber.substring(prefix.length);
        const seq = parseInt(rest, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      } else {
        // Also support backward compatibility with older dashed format (SPS-DD-MM-YYYY-N)
        const oldPrefix = `SPS-${day}-${month}-${now.getFullYear()}-`;
        if (b.bookingNumber.startsWith(oldPrefix)) {
          const rest = b.bookingNumber.substring(oldPrefix.length);
          const seq = parseInt(rest, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(2, '0');
  return `${prefix}${nextSeq}`;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProduct,
  bookingToEdit,
  currentUser,
  existingBookings = [],
  onSaveBooking,
}) => {
  const isUserAdmin = currentUser.role === 'admin';
  const isEditMode = Boolean(bookingToEdit);

  const initialEditDepositPct = bookingToEdit
    ? bookingToEdit.depositPercentage ??
      (bookingToEdit.depositRate ? Math.round(bookingToEdit.depositRate * 100) : 50)
    : 50;
  const initialIsCustomDeposit = bookingToEdit
    ? ![50, 70, 100].includes(initialEditDepositPct)
    : false;

  // Client Info
  const [clientName, setClientName] = useState(bookingToEdit?.clientName || '');
  const [troopGroup, setTroopGroup] = useState(bookingToEdit?.troopGroup || '');
  const [clientPhone, setClientPhone] = useState(
    bookingToEdit?.clientPhone && bookingToEdit.clientPhone !== 'N/A' ? bookingToEdit.clientPhone : ''
  );
  const [notes, setNotes] = useState(bookingToEdit?.notes || '');
  const [discount, setDiscount] = useState<number | ''>(
    bookingToEdit && bookingToEdit.discount > 0 ? bookingToEdit.discount : ''
  );
  const [depositPct, setDepositPct] = useState<number>(initialEditDepositPct);
  const [customPctInput, setCustomPctInput] = useState<string>(
    initialIsCustomDeposit ? String(initialEditDepositPct) : ''
  );
  const [isCustomMode, setIsCustomMode] = useState<boolean>(initialIsCustomDeposit);
  const [markDepositPaidImmediately, setMarkDepositPaidImmediately] = useState(false);

  // Items in this booking
  const [items, setItems] = useState<BookingItem[]>(() => {
    if (bookingToEdit && bookingToEdit.items) {
      return bookingToEdit.items.map((it) => {
        const liveProd = products.find((p) => p.id === it.productId);
        const liveVariant = liveProd?.variants.find((v) => v.id === it.variantId);
        const avail = liveVariant ? liveVariant.quantity || 0 : it.availableStock || 0;
        const threshold = liveVariant?.minThreshold ?? it.minThreshold ?? 5;
        const deficit = Math.max(0, it.quantity - avail);
        const recProd =
          deficit > 0
            ? deficit + threshold
            : avail - it.quantity < threshold
            ? Math.max(0, threshold - (avail - it.quantity))
            : 0;
        return {
          ...it,
          productImage: it.productImage || liveProd?.image,
          availableStock: avail,
          deficitQuantity: deficit,
          minThreshold: threshold,
          recommendedProduction: recProd,
          totalPrice: it.quantity * it.unitPrice,
        };
      });
    }
    if (initialProduct && initialProduct.variants.length > 0) {
      const v = initialProduct.variants[0];
      const avail = v.quantity || 0;
      const defaultQty = 1;
      const unitPrice = typeof initialProduct.price === 'number' ? initialProduct.price : 0;
      const deficit = Math.max(0, defaultQty - avail);
      const threshold = v.minThreshold || 5;
      const recProd =
        deficit > 0
          ? deficit + threshold
          : avail - defaultQty < threshold
          ? threshold - (avail - defaultQty)
          : 0;

      return [
        {
          id: `bki_${Date.now()}_1`,
          productId: initialProduct.id,
          productName: initialProduct.name,
          productSku: initialProduct.sku,
          productImage: initialProduct.image,
          variantId: v.id,
          size: v.size,
          colorName: v.colorName,
          colorHex: v.colorHex,
          quantity: defaultQty,
          unitPrice,
          totalPrice: defaultQty * unitPrice,
          availableStock: avail,
          deficitQuantity: deficit,
          minThreshold: threshold,
          recommendedProduction: recProd,
        },
      ];
    }
    return [];
  });

  // Category Filter state before Item Model
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');

  const availableCategories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['All Categories', ...cats];
  }, [products]);

  const filteredProductsForSelection = useMemo(() => {
    if (selectedCategory === 'All Categories') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  // Selector for adding next item - NO item model pre-selected unless initialProduct provided
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProduct?.id || ''
  );
  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || null;

  // Extract unique colors for selected item
  const availableColors = useMemo(() => {
    if (!selectedProduct) return [];
    const map = new Map<string, { colorName: string; colorHex: string }>();
    selectedProduct.variants.forEach((v) => {
      const cName = v.colorName || 'Standard';
      const cHex = v.colorHex || '#94a3b8';
      if (!map.has(cName)) {
        map.set(cName, {
          colorName: cName,
          colorHex: cHex,
        });
      }
    });
    if (map.size === 0) {
      map.set('Standard', { colorName: 'Standard', colorHex: '#94a3b8' });
    }
    return Array.from(map.values());
  }, [selectedProduct]);

  // Selected Color state
  const [selectedColorName, setSelectedColorName] = useState<string>(() => {
    if (initialProduct && initialProduct.variants.length > 0) {
      return initialProduct.variants[0].colorName || 'Standard';
    }
    return 'Standard';
  });

  // Variants filtered by selected color
  const variantsForCurrentColor = useMemo(() => {
    if (!selectedProduct) return [];
    if (!selectedColorName) return selectedProduct.variants;
    const filtered = selectedProduct.variants.filter(
      (v) => (v.colorName || 'Standard') === selectedColorName
    );
    return filtered.length > 0 ? filtered : selectedProduct.variants;
  }, [selectedProduct, selectedColorName]);

  // Selected Variant (Size) state
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Auto-select size if only 1 size option exists (e.g. One Size) so user doesn't have to click it!
  useEffect(() => {
    if (variantsForCurrentColor.length === 1) {
      setSelectedVariantId(variantsForCurrentColor[0].id);
    }
  }, [variantsForCurrentColor]);

  // Order quantity BLANK by default as requested!
  const [newQty, setNewQty] = useState<number | ''>('');
  const [newPrice, setNewPrice] = useState<number | ''>(
    typeof selectedProduct?.price === 'number' ? selectedProduct.price : 0
  );
  const [isEditingPrice, setIsEditingPrice] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [addItemError, setAddItemError] = useState<string>('');

  if (!isOpen) return null;

  // Handler when item model changes
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setIsEditingPrice(false);
    setAddItemError('');
    const prod = products.find((p) => p.id === productId);
    if (prod && prod.variants.length > 0) {
      const firstVariant = prod.variants[0];
      const cName = firstVariant.colorName || 'Standard';
      setSelectedColorName(cName);
      const matching = prod.variants.filter((v) => (v.colorName || 'Standard') === cName);
      if (matching.length === 1) {
        setSelectedVariantId(matching[0].id);
      } else {
        setSelectedVariantId('');
      }
      setNewPrice(typeof prod.price === 'number' ? prod.price : 0);
    } else {
      setSelectedColorName('Standard');
      setSelectedVariantId('');
      setNewPrice(0);
    }
  };

  // Handler when color changes
  const handleColorChange = (colorName: string) => {
    setSelectedColorName(colorName);
    if (selectedProduct) {
      const matching = selectedProduct.variants.filter(
        (v) => (v.colorName || 'Standard') === colorName
      );
      if (matching.length === 1) {
        setSelectedVariantId(matching[0].id);
      } else {
        setSelectedVariantId('');
      }
    } else {
      setSelectedVariantId('');
    }
  };

  // Current selected variant object (null if no size selected)
  const currentVariant =
    variantsForCurrentColor.find((v) => v.id === selectedVariantId) || null;

  // Add Item to List
  const handleAddItem = () => {
    setFormError('');
    setAddItemError('');
    if (!selectedProduct) {
      setAddItemError('Please select an Item Model first.');
      return;
    }
    if (!currentVariant) {
      setAddItemError('Please select a size for the item.');
      return;
    }

    if (newQty === '' || newQty <= 0) {
      setAddItemError('Please add quantity');
      return;
    }

    const qty = Number(newQty);
    const price = Math.max(0, typeof newPrice === 'number' ? newPrice : Number(newPrice) || 0);
    const avail = currentVariant.quantity || 0;
    const deficit = Math.max(0, qty - avail);
    const threshold = currentVariant.minThreshold || 5;
    const recProd =
      deficit > 0
        ? deficit + threshold
        : avail - qty < threshold
        ? Math.max(0, threshold - (avail - qty))
        : 0;

    const newItem: BookingItem = {
      id: `bki_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productSku: selectedProduct.sku,
      productImage: selectedProduct.image,
      variantId: currentVariant.id,
      size: currentVariant.size,
      colorName: currentVariant.colorName,
      colorHex: currentVariant.colorHex,
      quantity: qty,
      unitPrice: price,
      totalPrice: qty * price,
      availableStock: avail,
      deficitQuantity: deficit,
      minThreshold: threshold,
      recommendedProduction: recProd,
    };

    setItems((prev) => [...prev, newItem]);
    setNewQty('');
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update item quantity or price
  const handleUpdateItem = (id: string, updates: Partial<BookingItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextQty =
          updates.quantity !== undefined
            ? Math.max(1, Number(updates.quantity) || 1)
            : item.quantity;
        const nextPrice =
          updates.unitPrice !== undefined
            ? Math.max(0, Number(updates.unitPrice) || 0)
            : item.unitPrice;
        const deficit = Math.max(0, nextQty - item.availableStock);
        const threshold = item.minThreshold || 5;
        const recProd =
          deficit > 0
            ? deficit + threshold
            : item.availableStock - nextQty < threshold
            ? Math.max(0, threshold - (item.availableStock - nextQty))
            : 0;

        return {
          ...item,
          ...updates,
          quantity: nextQty,
          unitPrice: nextPrice,
          totalPrice: nextQty * nextPrice,
          deficitQuantity: deficit,
          recommendedProduction: recProd,
        };
      })
    );
  };

  // Financial calculations in EGP
  const subtotal = items.reduce((acc, it) => acc + it.totalPrice, 0);
  const discountNumeric = typeof discount === 'number' ? discount : 0;
  const total = Math.max(0, subtotal - discountNumeric);

  const activeDepositPct = isCustomMode
    ? (customPctInput === '' ? 50 : Math.min(100, Math.max(0, Number(customPctInput) || 0)))
    : depositPct;
  const depositRate = activeDepositPct / 100;
  const depositRequired = Math.round(total * depositRate);
  const remainingBalance = Math.max(0, total - depositRequired);
  const remainingPct = Math.max(0, 100 - activeDepositPct);

  const totalUnits = items.reduce((acc, it) => acc + it.quantity, 0);
  const totalDeficit = items.reduce((acc, it) => acc + it.deficitQuantity, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (bookingToEdit) {
      if (!isUserAdmin) {
        setFormError('Only Admins can edit existing bookings.');
        return;
      }
      if (bookingToEdit.status !== 'pending' || bookingToEdit.depositPaid) {
        setFormError('Cannot edit a booking after payment has been confirmed.');
        return;
      }
    }

    if (!clientName.trim()) {
      setFormError('Please enter client or organization name.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one item to this booking order.');
      return;
    }

    if (bookingToEdit) {
      const updatedBooking: Booking = {
        ...bookingToEdit,
        clientName: clientName.trim(),
        troopGroup: troopGroup.trim() || undefined,
        clientPhone: clientPhone.trim() || 'N/A',
        notes: notes.trim(),
        items,
        subtotal,
        discount: discountNumeric,
        total,
        depositRate,
        depositPercentage: activeDepositPct,
        pendingDepositPercentage: undefined,
        pendingDepositPercentageBy: undefined,
        pendingDepositPercentageAt: undefined,
        depositRequired,
        depositPaid: false,
        depositPaidAmount: 0,
        status: 'pending',
        inventoryDeducted: false,
        updatedAt: new Date().toISOString(),
      };
      onSaveBooking(updatedBooking, false);
      onClose();
      return;
    }

    const bookingNumber = generateBookingSerial(existingBookings);

    const newBooking: Booking = {
      id: `bk_${Date.now()}`,
      bookingNumber,
      clientName: clientName.trim(),
      troopGroup: troopGroup.trim() || undefined,
      clientPhone: clientPhone.trim() || 'N/A',
      notes: notes.trim(),
      items,
      subtotal,
      discount: discountNumeric,
      total,
      depositRate,
      depositPercentage: activeDepositPct,
      depositRequired,
      depositPaid: markDepositPaidImmediately,
      depositPaidAmount: markDepositPaidImmediately ? depositRequired : 0,
      depositPaidAt: markDepositPaidImmediately ? new Date().toISOString() : undefined,
      status: markDepositPaidImmediately ? 'preparing' : 'pending',
      inventoryDeducted: false,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdByRole: currentUser.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveBooking(newBooking, markDepositPaidImmediately);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden print:hidden animate-in fade-in duration-150">
      {/* Modal Container */}
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-200 flex flex-col overflow-hidden">
        {/* Sticky Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
              isEditMode ? 'bg-amber-400 text-slate-950' : 'bg-blue-600 text-white'
            }`}>
              {isEditMode ? <Edit3 className="w-5 h-5" /> : <CalendarCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-2 flex-wrap">
                <span>{isEditMode ? 'Edit Client Booking' : 'New Client Booking & Quotation'}</span>
                {isEditMode && bookingToEdit && (
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-slate-900 text-white">
                    {bookingToEdit.bookingNumber}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                {isEditMode
                  ? 'Admin Only — Add items, remove items, or adjust quantities while payment is unpaid • All Currency in EGP'
                  : <>Serial Format: <span className="font-mono font-bold text-blue-700">SPS-DDMMYYXX</span> (e.g. SPS-01112601) • All Currency in EGP</>}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-900">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Client Information */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <UserIcon className="w-4 h-4 text-blue-600" />
              <span>Client & Organization Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Leader Mark / Father Youhanna"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Troop / Group Name <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={troopGroup}
                  onChange={(e) => setTroopGroup(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer ${
                    troopGroup ? 'border-slate-300 text-slate-900' : 'border-amber-300 text-slate-500 bg-amber-50/20'
                  }`}
                >
                  <option value="">-- Select Troop / Group --</option>
                  <option value="Ashbal">Ashbal</option>
                  <option value="Zahrat">Zahrat</option>
                  <option value="Kashafeen">Kashafeen</option>
                  <option value="Morshedat">Morshedat</option>
                  <option value="3ashera 1">3ashera 1</option>
                  <option value="3ashera 2">3ashera 2</option>
                  <option value="Afrad">Afrad</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="e.g. 012 3456 7890"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Booking Notes / Special Request
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Needed before Annual Camp, specific patch placements..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Item Selection with Category Filter, Separated Color Circles and Size Chips */}
          <div className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-blue-200/70 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                <span>Select & Add Item to Order</span>
              </h3>
              <span className="text-[11px] font-semibold text-blue-700">
                You can order any quantity, even if out of stock!
              </span>
            </div>

            {/* 1. Category Filter & 2. Item Model Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>1. Filter Category</span>
                  <span className="text-[10px] text-blue-700 font-semibold">{availableCategories.length - 1} categories</span>
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setSelectedCategory(cat);
                    if (selectedProduct && cat !== 'All Categories' && selectedProduct.category !== cat) {
                      handleProductChange('');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
                >
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>2. Item Model *</span>
                  <span className="text-[10px] text-slate-500 font-medium">{filteredProductsForSelection.length} available</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer ${
                    selectedProductId ? 'border-slate-300 text-slate-900' : 'border-amber-300 text-slate-500 bg-amber-50/20'
                  }`}
                >
                  <option value="">-- Select Item Model --</option>
                  {filteredProductsForSelection.map((p) => (
                    <option key={p.id} value={p.id} className="text-slate-900 font-medium">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Product Preview Card */}
            {selectedProduct && (
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-blue-200 shadow-2xs">
                {selectedProduct.image ? (
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-slate-900 truncate">{selectedProduct.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold border border-slate-200">
                      {selectedProduct.sku}
                    </span>
                    {selectedProduct.category && (
                      <span className="text-blue-700 font-semibold">{selectedProduct.category}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Color Swatches / Circles ("Dawayer") */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700">
                  2. Choose Color: <span className="font-black text-blue-950 ml-1">{selectedColorName || (selectedProduct ? 'Select a color' : '—')}</span>
                </label>
                {selectedProduct && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    {availableColors.length} color{availableColors.length === 1 ? '' : 's'} available
                  </span>
                )}
              </div>

              {!selectedProduct ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 font-medium text-center">
                  Select an Item Model above to view available colors
                </div>
              ) : availableColors.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center font-medium">
                  Standard Color
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {availableColors.map((c) => {
                    const isSelected = c.colorName === selectedColorName;
                    const isLight = isLightColor(c.colorHex);

                    return (
                      <button
                        key={c.colorName}
                        type="button"
                        onClick={() => handleColorChange(c.colorName)}
                        className={`group flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                          isSelected
                            ? 'border-blue-600 bg-white shadow-sm ring-2 ring-blue-500/50'
                            : 'border-slate-300 bg-white/90 hover:border-slate-400 hover:bg-white'
                        }`}
                        title={c.colorName}
                      >
                        {/* Circular Dot ("Dayra") */}
                        <span
                          className="w-6 h-6 rounded-full border border-black/15 shadow-inner flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: c.colorHex }}
                        >
                          {isSelected && (
                            <Check
                              className={`w-3.5 h-3.5 ${
                                isLight ? 'text-slate-900' : 'text-white'
                              } stroke-[3]`}
                            />
                          )}
                        </span>

                        <span
                          className={`text-xs ${
                            isSelected ? 'font-black text-blue-900' : 'font-medium text-slate-700'
                          }`}
                        >
                          {c.colorName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Size Selector Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700">
                  3. Choose Size: <span className={`ml-1 font-black ${currentVariant ? 'text-blue-950' : 'text-amber-700'}`}>{currentVariant ? formatSizeShort(currentVariant.size) : '(Please select a size)'}</span>
                </label>
                {selectedProduct && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    Click to select size
                  </span>
                )}
              </div>

              {!selectedProduct ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 font-medium text-center">
                  Select an Item Model above to choose size
                </div>
              ) : variantsForCurrentColor.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                  No size variants found for this color
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {variantsForCurrentColor.map((v) => {
                    const isSelected = v.id === selectedVariantId;
                    const stock = v.quantity || 0;
                    const isOut = stock <= 0;

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border active:scale-95 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/40'
                            : isOut
                            ? 'bg-rose-50/80 text-rose-900 border-rose-200 hover:border-rose-300'
                            : 'bg-white text-slate-800 border-slate-300 hover:border-blue-400 shadow-xs'
                        }`}
                      >
                        <span className="font-mono text-xs">{formatSizeShort(v.size)}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : isOut
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isOut ? '0 in stock' : `${stock} stock`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quantity, Unit Price and Add Item button */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              {/* Quantity with mobile +/- stepper and BLANK default */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Order Quantity
                </label>
                <div
                  className={`flex items-center border rounded-xl bg-white shadow-xs overflow-hidden transition-colors ${
                    addItemError === 'Please add quantity'
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAddItemError('');
                      setNewQty((q) => Math.max(1, (typeof q === 'number' ? q : 1) - 1));
                    }}
                    className="w-11 h-11 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 border-r border-slate-200 shrink-0"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter qty..."
                    value={newQty}
                    onChange={(e) => {
                      setAddItemError('');
                      setNewQty(
                        e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1)
                      );
                    }}
                    className="w-full text-center py-2.5 text-xs font-mono font-black text-slate-900 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAddItemError('');
                      setNewQty((q) => (typeof q === 'number' ? q + 1 : 1));
                    }}
                    className="w-11 h-11 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 border-l border-slate-200 shrink-0"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Unit Price in EGP - Locked with Yellow Pencil Toggle */}
              <div className="sm:col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Unit Price (EGP)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditingPrice(!isEditingPrice)}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all ${
                      isEditingPrice
                        ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300 shadow-xs'
                        : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 shadow-2xs'
                    }`}
                    title={isEditingPrice ? "Lock price" : "Click yellow pencil to edit price"}
                  >
                    <Edit3 className="w-3 h-3 text-amber-900" />
                    <span>{isEditingPrice ? 'Unlocked' : 'Edit'}</span>
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    EGP
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    readOnly={!isEditingPrice}
                    value={newPrice}
                    onChange={(e) =>
                      setNewPrice(
                        e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0)
                      )
                    }
                    placeholder="0"
                    className={`w-full pl-12 pr-9 py-2.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                      isEditingPrice
                        ? 'border-amber-400 bg-amber-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs'
                        : 'border-slate-300 bg-slate-100/90 text-slate-700 cursor-not-allowed'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingPrice(!isEditingPrice)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-amber-600 hover:text-amber-800 rounded"
                    title={isEditingPrice ? "Lock price" : "Edit price"}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Add Button */}
              <div className="sm:col-span-3 flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ Add Item</span>
                </button>
              </div>
            </div>

            {addItemError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{addItemError}</span>
              </div>
            )}
          </div>

          {/* Section 3: Items in Order Breakdown */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Order Items ({items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} total units)
              </span>
              {totalDeficit > 0 && (
                <span className="text-xs font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Workshop Deficit: {totalDeficit} units to produce
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No items added to this booking yet.</p>
                <p className="text-xs mt-1">Select items, colors, and sizes above to build this quotation.</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View (Visible on phones) */}
                <div className="block sm:hidden divide-y divide-slate-200 bg-slate-50/40">
                  {items.map((it) => (
                    <div key={it.id} className="p-3.5 space-y-3 bg-white">
                      {/* Header Row: Image + Name/Variant + Remove Button */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {it.productImage ? (
                            <img
                              src={it.productImage}
                              alt={it.productName}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50 shadow-2xs"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 text-sm leading-snug truncate">
                              {it.productName}
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-1 flex-wrap">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/15 inline-block shrink-0"
                                style={{ backgroundColor: it.colorHex }}
                              />
                              <span className="font-semibold">{it.colorName}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md">
                                {formatSizeBadge(it.size)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="w-10 h-10 -mr-1 -mt-1 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl shrink-0 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Pricing & Quantity Strip */}
                      <div className="grid grid-cols-12 items-center gap-2 bg-slate-50/90 border border-slate-200/70 px-3 py-2.5 rounded-xl">
                        <div className="col-span-4 flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-500">Qty</span>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) =>
                              handleUpdateItem(it.id, { quantity: parseInt(e.target.value) || 1 })
                            }
                            className="w-16 h-9 px-2 text-center font-mono text-xs font-black text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="col-span-4 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Unit Price</div>
                          <div className="font-mono text-xs font-bold tabular-nums text-slate-700 mt-0.5">
                            {it.unitPrice.toFixed(0)} EGP
                          </div>
                        </div>

                        <div className="col-span-4 text-right">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total</div>
                          <div className="font-mono text-xs font-black tabular-nums text-blue-900 mt-0.5">
                            {it.totalPrice.toFixed(2)} EGP
                          </div>
                        </div>
                      </div>

                      {/* Clean Warehouse Stock Row (Single Deficit remains at header only) */}
                      <div className="flex items-center justify-between text-[11px] px-0.5">
                        <span className="text-slate-500 font-mono tabular-nums">
                          Warehouse stock: <strong className="text-slate-700">{it.availableStock}</strong> units
                        </span>
                        {it.deficitQuantity <= 0 && (
                          <span className="text-emerald-700 font-bold">In Stock</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (Visible on sm and up) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item & Variant</th>
                        <th className="py-2.5 px-3 text-center">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Unit Price (EGP)</th>
                        <th className="py-2.5 px-3 text-right">Total (EGP)</th>
                        <th className="py-2.5 px-3 text-center">Warehouse Stock</th>
                        <th className="py-2.5 px-3 text-center">Deficit</th>
                        <th className="py-2.5 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              {it.productImage ? (
                                <img
                                  src={it.productImage}
                                  alt={it.productName}
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900">{it.productName}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className="inline-block w-2.5 h-2.5 rounded-full border border-slate-300"
                                    style={{ backgroundColor: it.colorHex }}
                                  />
                                  <span>{it.colorName}</span>
                                  <span>•</span>
                                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 rounded">
                                    {formatSizeBadge(it.size)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) =>
                                handleUpdateItem(it.id, { quantity: parseInt(e.target.value) || 1 })
                              }
                              className="w-16 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg bg-white"
                            />
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                            {it.unitPrice.toFixed(2)} EGP
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {it.totalPrice.toFixed(2)} EGP
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-semibold text-slate-600">
                            {it.availableStock} units
                          </td>

                          <td className="py-3 px-3 text-center">
                            {it.deficitQuantity > 0 ? (
                              <span className="inline-block font-mono font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                                +{it.deficitQuantity} to make
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold text-[11px]">
                                In Stock
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Remove line item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Section 4: Enhanced Financial Quotation & Upfront Deposit Breakdown (EGP) */}
          <div className="bg-gradient-to-b from-slate-50 to-slate-100/60 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Financial Quotation & Upfront Deposit Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Select advance payment policy denominated in Egyptian Pounds (EGP)
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                {activeDepositPct === 100 ? '100% Full Payment' : `${activeDepositPct}% Advance Deposit`}
              </span>
            </div>

            {/* Upfront Payment Selector Buttons (50%, 70%, 100%, Custom) */}
            <div className="mb-4 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Select Upfront Advance Percentage:</span>
                <span className="text-[11px] font-mono font-bold text-amber-800">
                  Current: {activeDepositPct}%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[50, 70, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setIsCustomMode(false);
                      setDepositPct(pct);
                    }}
                    className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      !isCustomMode && depositPct === pct
                        ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400 scale-[1.02]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>{pct === 100 ? '100% (Full Payment)' : `${pct}% Deposit`}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(true);
                    if (!customPctInput) setCustomPctInput(String(depositPct));
                  }}
                  className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    isCustomMode
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>Custom %</span>
                </button>

                {isCustomMode && (
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customPctInput}
                      onChange={(e) => setCustomPctInput(e.target.value)}
                      placeholder="e.g. 60"
                      className="w-20 px-2 py-1.5 text-center font-mono font-bold text-xs border-2 border-amber-400 rounded-xl bg-amber-50 focus:bg-white focus:outline-none"
                    />
                    <span className="ml-1 text-xs font-bold text-slate-500">%</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left Column: Quotation Subtotal & Discount Calculation */}
              <div className="md:col-span-6 bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold">Gross Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {subtotal.toFixed(2)} <span className="text-[11px] text-slate-500">EGP</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold">Order Discount (EGP):</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={discount}
                      onChange={(e) =>
                        setDiscount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      className="w-28 pl-2 pr-7 py-1 text-right font-mono text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 pointer-events-none">
                      EGP
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-black text-slate-900 block">
                      Total Order Value
                    </span>
                    <span className="text-[10px] text-slate-500">Inclusive of items & discounts</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xl sm:text-2xl font-black text-blue-950 block">
                      {total.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-blue-700">EGP Net</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Upfront Advance & Handover Milestone Split */}
              <div className="md:col-span-6 space-y-2.5">
                {/* Advance Required Card (Prominent Amber Theme) */}
                <div className="p-3.5 rounded-xl bg-amber-50/90 border-2 border-amber-300 shadow-xs flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                        {activeDepositPct === 100 ? '100% Full Payment Required' : `${activeDepositPct}% Advance Required`}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-800 font-medium mt-0.5">
                      Required before physical workshop preparation begins
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-lg sm:text-xl text-amber-950">
                      {depositRequired.toFixed(2)}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-800">
                      EGP ({activeDepositPct}%)
                    </span>
                  </div>
                </div>

                {/* Balance on Handover Card */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      {activeDepositPct === 100 ? 'Remaining Balance' : `${remainingPct}% Balance on Handover`}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {activeDepositPct === 100 ? 'Fully settled upfront' : 'Due upon final delivery & item inspection'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-base sm:text-lg text-slate-800">
                      {remainingBalance.toFixed(2)}
                    </div>
                    <span className="text-[10px] font-mono font-medium text-slate-500">
                      {activeDepositPct === 100 ? 'EGP (Fully Paid)' : `EGP (${remainingPct}%)`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin option to mark deposit paid immediately (New Booking only) */}
            {!isEditMode && isUserAdmin && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer bg-white/70 p-2.5 rounded-xl border border-slate-200/80 hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={markDepositPaidImmediately}
                    onChange={(e) => setMarkDepositPaidImmediately(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span>
                    {activeDepositPct === 100
                      ? '100% Full payment already received now (advance directly to Preparing and reserve warehouse stock)'
                      : `${activeDepositPct}% Deposit already received now (advance directly to Preparing and reserve warehouse stock)`}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Stock Rule Note — Styled in Yellow / Amber */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-medium leading-relaxed">
            <strong>Stock Rule Note:</strong> This booking starts in <strong>Pending</strong> status.
            Inventory stock units will <strong>NOT</strong> be deducted until the upfront payment ({activeDepositPct}%) is
            marked as paid and the booking advances to <strong>Preparing</strong>. Once paid, quantities cannot be reduced or deleted.
          </div>

          {/* Sticky Modal Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-xs font-mono font-bold text-slate-700 flex items-center justify-between sm:justify-start gap-4">
              <span>
                Total: <strong className="text-blue-900">{total.toFixed(2)} EGP</strong>
              </span>
              <span className="text-amber-800">
                Upfront ({activeDepositPct}%): <strong>{depositRequired.toFixed(2)} EGP</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={items.length === 0}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl active:scale-95 disabled:opacity-50 text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                  isEditMode
                    ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black'
                    : 'bg-blue-600 hover:bg-blue-700 text-white font-bold'
                }`}
              >
                {isEditMode ? <Check className="w-4 h-4 stroke-[2.5]" /> : <CalendarCheck className="w-4 h-4" />}
                <span>
                  {isEditMode
                    ? 'Save Booking Changes'
                    : markDepositPaidImmediately
                    ? 'Create & Start Preparing'
                    : (activeDepositPct === 100 ? 'Create Booking (Pending 100%)' : `Create Booking (Pending ${activeDepositPct}%)`)}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
