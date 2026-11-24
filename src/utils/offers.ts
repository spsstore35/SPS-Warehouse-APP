import { MarketingOffer, Product } from '../types/inventory';

export interface ResolvedProductOffer {
  isActive: boolean;
  offer: MarketingOffer | null;
  originalPrice: number;
  effectivePrice: number;
  discountPct: number;
  badgeText: string;
}

export function getEffectiveProductOffer(
  product: Product,
  offers: MarketingOffer[],
  todayIso: string = new Date().toISOString().slice(0, 10)
): ResolvedProductOffer {
  const originalPrice = typeof product.price === 'number' ? product.price : 0;

  // Prefer active offer within date window (or any active offer on this product)
  const matching = offers.filter((o) => o.productId === product.id);
  const activeOffer =
    matching.find(
      (o) =>
        o.status === 'active' &&
        (!o.startDate || o.startDate <= todayIso) &&
        (!o.endDate || o.endDate >= todayIso)
    ) ||
    matching.find((o) => o.status === 'active') ||
    null;

  if (!activeOffer) {
    return {
      isActive: false,
      offer: null,
      originalPrice,
      effectivePrice: originalPrice,
      discountPct: 0,
      badgeText: '',
    };
  }

  let effectivePrice = originalPrice;
  let discountPct = Number(activeOffer.discountPercent || 0);

  if (activeOffer.offerType === 'fixed_price' && typeof activeOffer.offerPrice === 'number') {
    effectivePrice = Math.max(0, activeOffer.offerPrice);
    if (originalPrice > 0) {
      discountPct = Math.max(
        0,
        Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
      );
    }
  } else if (activeOffer.offerType === 'percentage' && discountPct > 0 && originalPrice > 0) {
    effectivePrice = Math.max(0, Math.round(originalPrice * (1 - discountPct / 100)));
  }

  return {
    isActive: true,
    offer: activeOffer,
    originalPrice,
    effectivePrice,
    discountPct,
    badgeText:
      activeOffer.badgeText ||
      (discountPct > 0 ? `${discountPct}% OFF` : activeOffer.title || 'Special Offer'),
  };
}
