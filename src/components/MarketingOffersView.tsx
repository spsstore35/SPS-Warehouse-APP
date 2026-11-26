import React, { useMemo, useState } from 'react';
import {
  MarketingOffer,
  MarketingOfferStatus,
  MarketingOfferType,
  Product,
  TeamChangeRequest,
  User,
} from '../types/inventory';
import { getEffectiveProductOffer } from '../utils/offers';
import { isUserAdmin } from '../utils/security';
import { TeamRequestsPanel } from './TeamRequestsPanel';
import {
  CalendarDays,
  Check,
  Image as ImageIcon,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

interface MarketingOffersViewProps {
  products: Product[];
  offers: MarketingOffer[];
  currentUser: User;
  users?: User[];
  canEditMedia?: boolean;
  teamRequests?: TeamChangeRequest[];
  onSubmitTeamRequest?: (
    req: Omit<TeamChangeRequest, 'id' | 'status' | 'requestedById' | 'requestedByName' | 'requestedAt'>
  ) => void;
  onApproveTeamRequest?: (req: TeamChangeRequest, adminNote?: string) => void;
  onRejectTeamRequest?: (req: TeamChangeRequest, adminNote?: string) => void;
  onSaveOffer: (offer: MarketingOffer, syncToCalendar: boolean) => void;
  onDeleteOffer: (offerId: string) => void;
  onEditProductMedia?: (product: Product) => void;
  onOpenCalendar?: () => void;
  onShowToast?: (msg: string) => void;
}

type OfferFilter = 'all' | 'on_offer' | 'recommended' | 'no_offer' | 'low_stock';
type MarketingTab = 'products' | 'campaigns';

export const MarketingOffersView: React.FC<MarketingOffersViewProps> = ({
  products,
  offers,
  currentUser,
  users = [],
  canEditMedia = true,
  teamRequests = [],
  onSubmitTeamRequest,
  onApproveTeamRequest,
  onRejectTeamRequest,
  onSaveOffer,
  onDeleteOffer,
  onEditProductMedia,
  onOpenCalendar,
  onShowToast,
}) => {
  const isAdmin = isUserAdmin(currentUser);
  const [activeTab, setActiveTab] = useState<MarketingTab>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<OfferFilter>('all');

  // Create / Edit Offer Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<MarketingOffer | null>(null);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<MarketingOfferType>('percentage');
  const [formDiscountPct, setFormDiscountPct] = useState('15');
  const [formOfferPrice, setFormOfferPrice] = useState('');
  const [formBadgeText, setFormBadgeText] = useState('Store Offer');
  const [formStartDate, setFormStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [formStatus, setFormStatus] = useState<MarketingOfferStatus>('active');
  const [formNotes, setFormNotes] = useState('');
  const [syncToCalendar, setSyncToCalendar] = useState(true);

  const activeCatalogProducts = useMemo(
    () => products.filter((p) => p.status !== 'pending'),
    [products]
  );

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const isLowStockProduct = (p: Product): boolean =>
    p.totalQuantity <= 5 ||
    p.variants.some((v) => v.minThreshold !== undefined && v.quantity <= v.minThreshold);

  const isHighStockRecommended = (p: Product): boolean =>
    p.totalQuantity >= 15 && !isLowStockProduct(p);

  const stats = useMemo(() => {
    let onOfferCount = 0;
    let recommendedCount = 0;
    let lowStockCount = 0;

    activeCatalogProducts.forEach((p) => {
      const resolved = getEffectiveProductOffer(p, offers, todayIso);
      if (resolved.isActive) onOfferCount += 1;
      else if (isHighStockRecommended(p)) recommendedCount += 1;
      if (isLowStockProduct(p)) lowStockCount += 1;
    });

    return {
      total: activeCatalogProducts.length,
      onOfferCount,
      recommendedCount,
      lowStockCount,
    };
  }, [activeCatalogProducts, offers, todayIso]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeCatalogProducts.filter((p) => {
      const resolved = getEffectiveProductOffer(p, offers, todayIso);
      const lowStock = isLowStockProduct(p);
      const recommended = isHighStockRecommended(p) && !resolved.isActive;

      if (filterMode === 'on_offer' && !resolved.isActive) return false;
      if (filterMode === 'recommended' && !recommended) return false;
      if (filterMode === 'no_offer' && resolved.isActive) return false;
      if (filterMode === 'low_stock' && !lowStock) return false;

      if (!q) return true;
      const offerText = resolved.offer ? `${resolved.offer.title} ${resolved.offer.badgeText}` : '';
      return `${p.name} ${p.sku} ${p.category} ${offerText}`.toLowerCase().includes(q);
    });
  }, [activeCatalogProducts, offers, todayIso, filterMode, searchQuery]);

  const openCreateOfferModal = (product: Product) => {
    const existingForProduct = offers.find((o) => o.productId === product.id && o.status === 'active');
    if (existingForProduct) {
      openEditOfferModal(existingForProduct, product);
      return;
    }
    const basePrice = typeof product.price === 'number' ? product.price : 0;
    const defaultStart = new Date().toISOString().slice(0, 10);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    const defaultEnd = d.toISOString().slice(0, 10);

    setEditingOffer(null);
    setTargetProduct(product);
    setFormTitle(`${product.name} Promo`);
    setFormType('percentage');
    setFormDiscountPct('15');
    setFormOfferPrice(basePrice > 0 ? String(Math.round(basePrice * 0.85)) : '');
    setFormBadgeText('15% OFF');
    setFormStartDate(defaultStart);
    setFormEndDate(defaultEnd);
    setFormStatus('active');
    setFormNotes('Featured store promo to bring troop traffic to the store.');
    setSyncToCalendar(true);
    setIsModalOpen(true);
  };

  const openEditOfferModal = (offer: MarketingOffer, product?: Product) => {
    const prod = product || products.find((p) => p.id === offer.productId) || null;
    setEditingOffer(offer);
    setTargetProduct(prod);
    setFormTitle(offer.title);
    setFormType(offer.offerType);
    setFormDiscountPct(String(offer.discountPercent || 0));
    setFormOfferPrice(offer.offerPrice !== undefined ? String(offer.offerPrice) : '');
    setFormBadgeText(offer.badgeText || 'Special Offer');
    setFormStartDate(offer.startDate || todayIso);
    setFormEndDate(offer.endDate || todayIso);
    setFormStatus(offer.status);
    setFormNotes(offer.notes || '');
    setSyncToCalendar(true);
    setIsModalOpen(true);
  };

  const handleSubmitOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct) return;
    if (!formTitle.trim()) {
      onShowToast?.('Please enter an offer title.');
      return;
    }

    const basePrice = typeof targetProduct.price === 'number' ? targetProduct.price : 0;
    const discountPct =
      formType === 'percentage' ? Math.max(0, Math.min(95, Number(formDiscountPct) || 0)) : 0;
    const fixedPrice =
      formType === 'fixed_price'
        ? Math.max(0, Number(formOfferPrice) || 0)
        : formType === 'percentage' && basePrice > 0
        ? Math.round(basePrice * (1 - discountPct / 100))
        : undefined;

    const nowIso = new Date().toISOString();
    const saved: MarketingOffer = {
      id: editingOffer?.id || `offer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: targetProduct.id,
      title: formTitle.trim(),
      offerType: formType,
      discountPercent:
        formType === 'fixed_price' && basePrice > 0 && fixedPrice !== undefined
          ? Math.max(0, Math.round(((basePrice - fixedPrice) / basePrice) * 100))
          : discountPct,
      offerPrice: fixedPrice,
      badgeText: formBadgeText.trim() || (discountPct > 0 ? `${discountPct}% OFF` : 'Special Offer'),
      startDate: formStartDate || todayIso,
      endDate: formEndDate >= formStartDate ? formEndDate : formStartDate,
      status: formStatus,
      notes: formNotes.trim() || undefined,
      createdById: editingOffer?.createdById || currentUser.id,
      createdByName: editingOffer?.createdByName || currentUser.name,
      createdAt: editingOffer?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (!isAdmin && onSubmitTeamRequest) {
      onSubmitTeamRequest({
        teamScope: 'marketing',
        entityType: 'marketing_offer',
        actionType: editingOffer ? 'update' : 'create',
        targetId: saved.id,
        title: `${editingOffer ? 'Edit' : 'Launch'} Offer: ${saved.title}`,
        summary: `${targetProduct.name} · ${saved.badgeText} (${saved.startDate} → ${saved.endDate})`,
        payload: { offer: saved, syncToCalendar },
      });
      setIsModalOpen(false);
      return;
    }

    onSaveOffer(saved, syncToCalendar);
    setIsModalOpen(false);
  };

  const handleToggleOfferStatus = (offer: MarketingOffer) => {
    const nextStatus: MarketingOfferStatus = offer.status === 'active' ? 'paused' : 'active';
    const updatedOffer: MarketingOffer = {
      ...offer,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    if (!isAdmin && onSubmitTeamRequest) {
      onSubmitTeamRequest({
        teamScope: 'marketing',
        entityType: 'marketing_offer',
        actionType: 'update',
        targetId: offer.id,
        title: `${nextStatus === 'active' ? 'Activate' : 'Pause'} Offer: ${offer.title}`,
        summary: `Request to change offer status to ${nextStatus.toUpperCase()}.`,
        payload: { offer: updatedOffer, syncToCalendar: true },
      });
      return;
    }
    onSaveOffer(updatedOffer, true);
  };

  const previewBasePrice = targetProduct?.price || 0;
  const previewFinalPrice =
    formType === 'fixed_price'
      ? Math.max(0, Number(formOfferPrice) || 0)
      : formType === 'percentage' && previewBasePrice > 0
      ? Math.max(0, Math.round(previewBasePrice * (1 - (Number(formDiscountPct) || 0) / 100)))
      : previewBasePrice;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-rose-600 shrink-0" />
            <span>Marketing &amp; Store Offers</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Choose which products get promotional offers vs. regular pricing to bring steady troop traffic to the store.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'products'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Product Offer Planner ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('campaigns')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'campaigns'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Campaigns ({offers.length})
            </button>
          </div>
          {onOpenCalendar && (
            <button
              type="button"
              onClick={onOpenCalendar}
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <CalendarDays className="w-4 h-4" />
              <span>View Store Calendar</span>
            </button>
          )}
        </div>
      </div>

      {onApproveTeamRequest && onRejectTeamRequest && (
        <TeamRequestsPanel
          currentUser={currentUser}
          users={users}
          teamScopes={['marketing']}
          requests={teamRequests}
          onApproveRequest={onApproveTeamRequest}
          onRejectRequest={onRejectTeamRequest}
        />
      )}

      {/* KPI Filter Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab('products');
            setFilterMode('all');
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            filterMode === 'all' && activeTab === 'products'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-medium opacity-75">Catalog Items</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">{stats.total}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('products');
            setFilterMode('on_offer');
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            filterMode === 'on_offer'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white text-slate-900 border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="text-xs font-medium opacity-75">Active Offers Live</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">{stats.onOfferCount}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('products');
            setFilterMode('recommended');
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            filterMode === 'recommended'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-slate-900 border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="text-xs font-medium opacity-75">Good Stock for Offer</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">
            {stats.recommendedCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('products');
            setFilterMode('low_stock');
          }}
          className={`text-left p-4 rounded-xl border transition-colors ${
            filterMode === 'low_stock'
              ? 'bg-amber-500 text-slate-950 border-amber-500'
              : 'bg-white text-slate-900 border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="text-xs font-medium opacity-75">Low Stock (Hold Price)</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">{stats.lowStockCount}</div>
        </button>
      </div>

      {/* TAB 1: PRODUCT OFFER PLANNER */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, SKUs, categories, or promo titles..."
                className="w-full pl-9 pr-8 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-rose-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Products' },
                  { id: 'on_offer', label: 'On Offer' },
                  { id: 'recommended', label: 'Recommended (High Stock)' },
                  { id: 'no_offer', label: 'Regular Price' },
                  { id: 'low_stock', label: 'Low Stock (Hold)' },
                ] as { id: OfferFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    filterMode === f.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
              No products match the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const resolved = getEffectiveProductOffer(product, offers, todayIso);
                const lowStock = isLowStockProduct(product);
                const recommended = isHighStockRecommended(product);
                const img = product.image || product.images?.[0];

                return (
                  <div
                    key={product.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {img ? (
                            <img
                              src={img}
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                            <span className="font-mono text-amber-700 font-semibold">
                              {product.sku}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{product.category}</span>
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate mt-0.5">
                            {product.name}
                          </h3>
                          <div className="text-xs text-slate-600 font-mono tabular-nums mt-1">
                            Stock: <strong className="text-slate-900">{product.totalQuantity}</strong> pcs
                            {' · '}
                            {lowStock ? (
                              <span className="text-amber-700 font-semibold font-sans">
                                Hold Offer (Low Stock)
                              </span>
                            ) : recommended ? (
                              <span className="text-emerald-700 font-semibold font-sans">
                                Good Stock for Offer
                              </span>
                            ) : (
                              <span className="text-slate-500 font-sans">Balanced Stock</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Price & Offer Summary */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500">
                            {resolved.isActive ? 'Store Offer Price' : 'Regular Price'}
                          </div>
                          {resolved.isActive ? (
                            <div className="flex items-baseline gap-2 mt-0.5">
                              <span className="text-lg font-black font-mono tabular-nums text-rose-700">
                                {resolved.effectivePrice.toLocaleString()} EGP
                              </span>
                              {resolved.originalPrice > resolved.effectivePrice && (
                                <span className="text-xs font-mono tabular-nums line-through text-slate-400">
                                  {resolved.originalPrice.toLocaleString()} EGP
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-lg font-black font-mono tabular-nums text-slate-900 mt-0.5">
                              {resolved.originalPrice > 0
                                ? `${resolved.originalPrice.toLocaleString()} EGP`
                                : 'No Price Set'}
                            </div>
                          )}
                        </div>

                        {resolved.isActive && resolved.offer ? (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold">
                              <Tag className="w-3 h-3" />
                              <span>{resolved.badgeText}</span>
                            </span>
                            <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-1">
                              {resolved.offer.startDate} → {resolved.offer.endDate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500">
                            No Active Offer
                          </span>
                        )}
                      </div>

                      {resolved.isActive && resolved.offer && (
                        <div className="text-xs text-slate-600">
                          <strong className="text-slate-800">{resolved.offer.title}</strong>
                          {resolved.offer.notes ? ` — ${resolved.offer.notes}` : ''}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center gap-2">
                        {resolved.isActive && resolved.offer ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditOfferModal(resolved.offer!, product)}
                              className="flex-1 py-2 px-3 min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit Offer</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleOfferStatus(resolved.offer!)}
                              className="py-2 px-3 min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                              title="Pause offer (return to regular price)"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCreateOfferModal(product)}
                            className={`w-full py-2 px-3 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                              lowStock
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                : 'bg-rose-600 hover:bg-rose-700 text-white'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                            <span>{lowStock ? 'Override & Put on Offer' : 'Put Product on Offer'}</span>
                          </button>
                        )}
                      </div>

                      {canEditMedia && onEditProductMedia && (
                        <button
                          type="button"
                          onClick={() => onEditProductMedia(product)}
                          className="w-full py-2 px-3 min-h-[38px] rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          title="Add/remove photos, manage product colors & update description"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
                          <span>Edit Photos ({product.images?.length || (product.image ? 1 : 0)}), Colors &amp; Desc</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL OFFER CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {offers.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700">No marketing offers created yet.</p>
              <p className="text-xs text-slate-500">
                Select any high-stock product from the Product Offer Planner to launch a store promo.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {offers.map((offer) => {
                const prod = products.find((p) => p.id === offer.productId);
                return (
                  <div
                    key={offer.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            offer.status === 'active'
                              ? 'bg-rose-600 text-white'
                              : offer.status === 'scheduled'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {offer.status.toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{offer.title}</span>
                        <span className="text-xs font-semibold text-rose-700">{offer.badgeText}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        Product: {prod?.name || offer.productId} · Window: {offer.startDate} →{' '}
                        {offer.endDate}
                        {offer.offerPrice !== undefined
                          ? ` · Promo Price: ${offer.offerPrice.toLocaleString()} EGP`
                          : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleOfferStatus(offer)}
                        className="px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1"
                      >
                        {offer.status === 'active' ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditOfferModal(offer, prod)}
                        className="px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isAdmin && onSubmitTeamRequest) {
                            onSubmitTeamRequest({
                              teamScope: 'marketing',
                              entityType: 'marketing_offer',
                              actionType: 'delete',
                              targetId: offer.id,
                              title: `Delete Offer: ${offer.title}`,
                              summary: `${prod?.name || offer.productId} (${offer.badgeText})`,
                              payload: { offerId: offer.id },
                            });
                            return;
                          }
                          onDeleteOffer(offer.id);
                        }}
                        className="p-2 min-h-[36px] rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                        title={isAdmin ? 'Delete offer' : 'Request offer deletion'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT MARKETING OFFER MODAL */}
      {isModalOpen && targetProduct && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-rose-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingOffer ? 'Edit Store Offer' : 'Create Product Offer'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {targetProduct.name} · Stock: {targetProduct.totalQuantity} pcs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOffer} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Campaign / Offer Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Camp Season Offer"
                  className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Offer Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as MarketingOfferType)}
                    className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-rose-500"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed_price">Fixed Offer Price (EGP)</option>
                    <option value="bundle_note">Bundle / Store Promo Note</option>
                  </select>
                </div>

                {formType === 'percentage' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={95}
                      value={formDiscountPct}
                      onChange={(e) => {
                        setFormDiscountPct(e.target.value);
                        if (e.target.value) setFormBadgeText(`${e.target.value}% OFF`);
                      }}
                      className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-slate-300 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                ) : formType === 'fixed_price' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Final Offer Price (EGP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formOfferPrice}
                      onChange={(e) => setFormOfferPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-slate-300 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Badge Label
                    </label>
                    <input
                      type="text"
                      value={formBadgeText}
                      onChange={(e) => setFormBadgeText(e.target.value)}
                      placeholder="e.g. Buy 2 Get 1"
                      className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                )}
              </div>

              {formType !== 'bundle_note' && (
                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-900">Catalog Price Preview</span>
                  <div className="flex items-baseline gap-2 font-mono tabular-nums">
                    <span className="text-sm font-black text-rose-700">
                      {previewFinalPrice.toLocaleString()} EGP
                    </span>
                    {previewBasePrice > previewFinalPrice && (
                      <span className="line-through text-slate-400">
                        {previewBasePrice.toLocaleString()} EGP
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Badge Text
                  </label>
                  <input
                    type="text"
                    value={formBadgeText}
                    onChange={(e) => setFormBadgeText(e.target.value)}
                    placeholder="e.g. 15% OFF"
                    className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as MarketingOfferStatus)}
                    className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-rose-500"
                  >
                    <option value="active">Active Now</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="paused">Paused</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[42px] rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Promo Instructions / Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Why this offer is running, target Fera2, or store display instructions..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToCalendar}
                  onChange={(e) => setSyncToCalendar(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Sync promo dates to Store Calendar &amp; Marketing Team Board
                </span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 min-h-[42px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isAdmin
                      ? editingOffer
                        ? 'Save Offer'
                        : 'Launch Offer'
                      : editingOffer
                      ? 'Request Offer Update'
                      : 'Submit Offer Request'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
