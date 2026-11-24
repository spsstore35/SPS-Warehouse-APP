import React, { useMemo, useState } from 'react';
import {
  Booking,
  BudgetExpenseCategory,
  BudgetExpenseEntry,
  BudgetSettings,
  MarketingOffer,
  Product,
  ProductBudgetProfile,
  ProductionBatch,
  ScoutSeason,
  User,
  VendorPriceEntry,
  ProductStageVendor,
} from '../types/inventory';
import { SCOUT_FERA2_LIST, getScoutFare2Meta } from '../utils/scoutFera2';
import { getEffectiveProductOffer } from '../utils/offers';
import { isUserLeader } from '../utils/security';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calculator,
  HeartHandshake,
  ShoppingBag,
  Calendar as CalendarIcon,
  CalendarRange,
  Plus,
  Trash2,
  Check,
  Search,
  AlertTriangle,
  PackageCheck,
  Receipt,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';

interface BudgetingViewProps {
  products: Product[];
  bookings: Booking[];
  offers: MarketingOffer[];
  productionBatches: ProductionBatch[];
  stageVendors: ProductStageVendor[];
  priceHistory: VendorPriceEntry[];
  budgetProfiles: Record<string, ProductBudgetProfile>;
  budgetExpenses: BudgetExpenseEntry[];
  budgetSettings: BudgetSettings;
  scoutSeasons: ScoutSeason[];
  isUnlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onOpenCalendar?: () => void;
  currentUser: User;
  onSaveBudgetProfile: (profile: ProductBudgetProfile) => void;
  onAddExpense: (expense: BudgetExpenseEntry) => void;
  onDeleteExpense: (expenseId: string) => void;
  onSaveSettings: (settings: BudgetSettings) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => void;
  onShowToast?: (message: string) => void;
}

type BudgetingTab = 'unit_pnl' | 'liquidity' | 'seasons_fera2' | 'expenses';
type ProductBudgetFilter = 'all' | 'has_cost' | 'missing_cost' | 'hardship';

const BUDGETING_PASSCODE = '4447';

const EXPENSE_CATEGORY_META: Record<BudgetExpenseCategory, { label: string; short: string }> = {
  production_extras: { label: 'Production & Finishing Extras', short: 'Finishing' },
  packaging: { label: 'Packaging, Bags & Labels', short: 'Packaging' },
  transport: { label: 'Transport & Delivery', short: 'Transport' },
  rent_utilities: { label: 'Store Rent & Utilities', short: 'Utilities' },
  marketing: { label: 'Marketing & Promo Print', short: 'Marketing' },
  hardship_subsidy: { label: 'Hardship / Need Support', short: 'Hardship' },
  other: { label: 'Other Store Expenses', short: 'Other' },
};

const formatEgp = (val: number): string =>
  val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCompact = (val: number): string =>
  val.toLocaleString(undefined, { maximumFractionDigits: 0 });

const getBookingDateKey = (iso?: string): string => {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const resolveBookingFare2 = (b: Booking): string => {
  const core = getScoutFare2Meta(b.troopGroup);
  if (core) return core.id;
  const routed = getScoutFare2Meta(b.assignedFare2);
  if (routed) return routed.id;
  const raw = (b.troopGroup || '').trim();
  if (raw.toLowerCase() === 'afrad') return 'Afrad';
  return raw || 'Afrad';
};

const getCollectedCashForBooking = (b: Booking): number => {
  if (b.status === 'done') return b.total;
  if (!b.depositPaid && b.status === 'pending') return 0;
  if (typeof b.depositPaidAmount === 'number' && b.depositPaidAmount > 0) {
    return Math.min(b.total, b.depositPaidAmount);
  }
  if (typeof b.depositRequired === 'number' && b.depositRequired > 0) {
    return Math.min(b.total, b.depositRequired);
  }
  const rate = b.depositRate ?? (b.depositPercentage ? b.depositPercentage / 100 : 0.5);
  return Math.round(b.total * rate);
};

const classifyBuyingBucket = (name: string, category?: string): 'tshirt' | 'folard' | 'amees' | 'other' => {
  const txt = `${name} ${category || ''}`.toLowerCase();
  if (txt.includes('folard') || txt.includes('foulard') || txt.includes('فولار') || txt.includes('scarf')) {
    return 'folard';
  }
  if (
    txt.includes('amees') ||
    txt.includes('3amees') ||
    txt.includes('amis') ||
    txt.includes('chemise') ||
    txt.includes('قميص') ||
    ((txt.includes('shirt') || txt.includes('uniform shirt')) &&
      !txt.includes('t-shirt') &&
      !txt.includes('tshirt') &&
      !txt.includes('t shirt') &&
      !txt.includes('sweatshirt'))
  ) {
    return 'amees';
  }
  if (
    txt.includes('t-shirt') ||
    txt.includes('tshirt') ||
    txt.includes('t shirt') ||
    txt.includes('tee') ||
    txt.includes('polo') ||
    txt.includes('تيشيرت')
  ) {
    return 'tshirt';
  }
  return 'other';
};

export const BudgetingView: React.FC<BudgetingViewProps> = (props) => {
  const isLeader = isUserLeader(props.currentUser);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  if (isLeader) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg mx-auto my-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Store Budgeting Restricted</h2>
        <p className="text-xs text-slate-600">
          Budgeting, unit cost analysis, and cash liquidity tools are only accessible to authorized Budgeting &amp; Full-Access Admin accounts.
        </p>
      </div>
    );
  }

  if (!props.isUnlocked) {
    const handleUnlockSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (passcodeInput.trim() === BUDGETING_PASSCODE) {
        setPasscodeError('');
        setPasscodeInput('');
        props.onUnlock();
        props.onShowToast?.('Budgeting unlocked.');
      } else {
        setPasscodeError('Incorrect budgeting passcode. Please try again.');
      }
    };

    return (
      <div className="max-w-md mx-auto my-8 sm:my-12 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Budgeting Access Locked
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Financial costs, cash liquidity, and profit margins are protected. Enter the Budgeting passcode to continue.
          </p>
        </div>

        <form onSubmit={handleUnlockSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Budgeting Passcode
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPasscode ? 'text' : 'password'}
                inputMode="numeric"
                autoFocus
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value);
                  if (passcodeError) setPasscodeError('');
                }}
                placeholder="Enter passcode..."
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {passcodeError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {passcodeError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Unlock Budgeting</span>
          </button>
        </form>
      </div>
    );
  }

  return <BudgetingDashboardInner {...props} />;
};

const BudgetingDashboardInner: React.FC<BudgetingViewProps> = ({
  products,
  bookings,
  offers,
  productionBatches,
  stageVendors,
  priceHistory,
  budgetProfiles,
  budgetExpenses,
  budgetSettings,
  scoutSeasons,
  onLock,
  onOpenCalendar,
  currentUser,
  onSaveBudgetProfile,
  onAddExpense,
  onDeleteExpense,
  onSaveSettings,
  onUpdateProductPrice,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<BudgetingTab>('unit_pnl');
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductBudgetFilter>('all');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [selectedScoutSeasonId, setSelectedScoutSeasonId] = useState<string>('all');

  // Inline Liquidity & Bolt Cost controls
  const [editingCashValue, setEditingCashValue] = useState<string>(
    budgetSettings.cashOnHand !== undefined ? String(budgetSettings.cashOnHand) : ''
  );
  const [editingReserveValue, setEditingReserveValue] = useState<string>(
    String(budgetSettings.reserveBuffer || 0)
  );
  const [boltCostEstimate, setBoltCostEstimate] = useState<string>('4500');
  const [shirtsPerBolt, setShirtsPerBolt] = useState<string>('40');

  // Expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<BudgetExpenseCategory>('production_extras');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseLinkedProductId, setExpenseLinkedProductId] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Derive Sourcing fallback unit cost for any product if user hasn't set manual manufacturingCost
  const sourcingSuggestedCostByProduct = useMemo(() => {
    const map = new Map<string, number>();

    // Sum latest stage vendor prices per product
    const productVendorLinks = new Map<string, ProductStageVendor[]>();
    stageVendors.forEach((sv) => {
      const arr = productVendorLinks.get(sv.productId) || [];
      arr.push(sv);
      productVendorLinks.set(sv.productId, arr);
    });

    productVendorLinks.forEach((links, productId) => {
      let sum = 0;
      links.forEach((sv) => {
        const entries = priceHistory
          .filter((ph) => ph.productStageVendorId === sv.id)
          .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
        if (entries.length > 0) {
          sum += Number(entries[0].unitPrice || 0);
        }
      });
      if (sum > 0) map.set(productId, sum);
    });

    // Fallback to latest batch stage cost if no vendor price history
    productionBatches.forEach((b) => {
      if (map.has(b.productId)) return;
      const stageCosts = Object.values(b.stageAssignments || {}).reduce(
        (s, st) => s + Number(st?.cost || 0),
        0
      );
      if (stageCosts > 0 && b.quantity > 0) {
        map.set(b.productId, Math.round((stageCosts / b.quantity) * 100) / 100);
      }
    });

    return map;
  }, [stageVendors, priceHistory, productionBatches]);

  const activeProducts = useMemo(
    () => products.filter((p) => p.status !== 'pending' && p.status !== 'rejected'),
    [products]
  );

  // Per-Product Unit Economics + Sales + COGS + Gross/Net Profit
  const productMetrics = useMemo(() => {
    const totalOtherExpenses = budgetExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const salesByProd = new Map<
      string,
      { unitsSold: number; revenue: number; pendingDemand: number }
    >();

    bookings.forEach((b) => {
      const orderDiscountRatio =
        b.subtotal > 0 && b.discount > 0 ? Math.max(0, 1 - b.discount / b.subtotal) : 1;
      b.items.forEach((it) => {
        const key = it.productId;
        const curr = salesByProd.get(key) || { unitsSold: 0, revenue: 0, pendingDemand: 0 };
        curr.unitsSold += Number(it.quantity || 0);
        curr.revenue += Number(it.totalPrice || 0) * orderDiscountRatio;
        if (b.status === 'pending' || b.status === 'preparing') {
          curr.pendingDemand += Number(it.quantity || 0);
        }
        salesByProd.set(key, curr);
      });
    });

    const totalStoreSales = Array.from(salesByProd.values()).reduce((s, v) => s + v.revenue, 0);
    const totalStoreUnits = Array.from(salesByProd.values()).reduce((s, v) => s + v.unitsSold, 0);

    // Direct product-linked expenses vs general overhead expenses
    const directExpenseByProd = new Map<string, number>();
    let generalOverheadExpenses = 0;
    budgetExpenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      if (exp.linkedProductId) {
        directExpenseByProd.set(
          exp.linkedProductId,
          (directExpenseByProd.get(exp.linkedProductId) || 0) + amt
        );
      } else {
        generalOverheadExpenses += amt;
      }
    });

    const rows = activeProducts.map((product) => {
      const profile = budgetProfiles[product.id];
      const sourcingCost = sourcingSuggestedCostByProduct.get(product.id) || 0;
      const mfgCost = profile ? Number(profile.manufacturingCost || 0) : sourcingCost;
      const extraPrepCost = profile ? Number(profile.extraPrepCost || 0) : 0;
      const unitCost = mfgCost + extraPrepCost;

      const sellPrice = Number(product.price || 0);
      const offerInfo = getEffectiveProductOffer(product, offers);
      const activeSellPrice = offerInfo.isActive ? offerInfo.effectivePrice : sellPrice;

      const salesStat = salesByProd.get(product.id) || {
        unitsSold: 0,
        revenue: 0,
        pendingDemand: 0,
      };
      const cogs = salesStat.unitsSold * unitCost;
      const grossProfit = salesStat.revenue - cogs;

      const revenueShare =
        totalStoreSales > 0
          ? salesStat.revenue / totalStoreSales
          : activeProducts.length > 0
          ? 1 / activeProducts.length
          : 0;
      const allocatedGeneralExpense =
        totalStoreUnits > 0
          ? generalOverheadExpenses * revenueShare
          : generalOverheadExpenses / Math.max(1, activeProducts.length);
      const directProdExpense = directExpenseByProd.get(product.id) || 0;
      const allocatedExpenses = directProdExpense + allocatedGeneralExpense;
      const netProfit = grossProfit - allocatedExpenses;

      const marginPct =
        sellPrice > 0 ? Math.round(((sellPrice - unitCost) / sellPrice) * 1000) / 10 : 0;
      const targetMarginPct = profile?.targetMarginPercent;
      const suggestedSellPrice =
        targetMarginPct !== undefined && targetMarginPct >= 0 && targetMarginPct < 95 && unitCost > 0
          ? Math.round((unitCost / (1 - targetMarginPct / 100)) * 100) / 100
          : undefined;

      // Hardship calculation ("lw nas me7taga we mesh adra tedfa3")
      const hardshipType = profile?.hardshipDiscountType || 'percentage';
      const hardshipValue = Number(profile?.hardshipDiscountValue || 0);
      const hardshipPrice =
        hardshipValue > 0 && sellPrice > 0
          ? hardshipType === 'percentage'
            ? Math.max(0, Math.round(sellPrice * (1 - Math.min(100, hardshipValue) / 100) * 100) / 100)
            : Math.max(0, Math.round((sellPrice - hardshipValue) * 100) / 100)
          : sellPrice;
      const hardshipNetPerUnit = hardshipPrice - unitCost;

      return {
        product,
        profile,
        mfgCost,
        extraPrepCost,
        unitCost,
        sourcingCost,
        isCostFromSourcingFallback: !profile && sourcingCost > 0,
        sellPrice,
        activeSellPrice,
        offerBadge: offerInfo.isActive ? offerInfo.badgeText : undefined,
        unitsSold: salesStat.unitsSold,
        pendingDemand: salesStat.pendingDemand,
        revenue: salesStat.revenue,
        cogs,
        grossProfit,
        allocatedExpenses,
        netProfit,
        marginPct,
        targetMarginPct,
        suggestedSellPrice,
        hardshipType,
        hardshipValue,
        hardshipPrice,
        hardshipNetPerUnit,
      };
    });

    const totalSales = bookings.reduce((s, b) => s + Number(b.total || 0), 0);
    const totalCollectedCash = bookings.reduce((s, b) => s + getCollectedCashForBooking(b), 0);
    const totalCOGS = rows.reduce((s, r) => s + r.cogs, 0);
    const totalGrossProfit = totalSales - totalCOGS;
    const totalNetProfit = totalGrossProfit - totalOtherExpenses;

    return {
      rows,
      totalSales,
      totalCollectedCash,
      totalCOGS,
      totalGrossProfit,
      totalOtherExpenses,
      totalNetProfit,
    };
  }, [
    activeProducts,
    bookings,
    budgetProfiles,
    budgetExpenses,
    offers,
    sourcingSuggestedCostByProduct,
  ]);

  // Cash Liquidity ("El Seyoola")
  const autoComputedCash = Math.max(
    0,
    productMetrics.totalCollectedCash - productMetrics.totalOtherExpenses
  );
  const currentLiquidity =
    budgetSettings.cashOnHand !== undefined ? budgetSettings.cashOnHand : autoComputedCash;
  const reserveBuffer = Number(budgetSettings.reserveBuffer || 0);
  const spendableLiquidity = Math.max(0, currentLiquidity - reserveBuffer);

  // Statistical Footfall ("El Regl"), Category Purchasing Advisor & Inventory Scaling Verdict
  const liquidityAdvisor = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const recent14d = bookings.filter((b) => {
      const t = new Date(b.createdAt).getTime();
      return !isNaN(t) && now - t <= 14 * dayMs;
    });
    const prior14d = bookings.filter((b) => {
      const t = new Date(b.createdAt).getTime();
      return !isNaN(t) && now - t > 14 * dayMs && now - t <= 28 * dayMs;
    });

    const recentOrdersCount = recent14d.length;
    const priorOrdersCount = prior14d.length;
    const recentUnitsCount = recent14d.reduce(
      (s, b) => s + b.items.reduce((isum, i) => isum + i.quantity, 0),
      0
    );

    const footfallTrend: 'busy' | 'steady' | 'slow' =
      recentOrdersCount >= 6 || (priorOrdersCount > 0 && recentOrdersCount > priorOrdersCount * 1.15)
        ? 'busy'
        : recentOrdersCount >= 2
        ? 'steady'
        : 'slow';

    // Aggregate per buying bucket: tshirt, folard, amees, other
    type BucketKey = 'tshirt' | 'folard' | 'amees' | 'other';
    const buckets: Record<
      BucketKey,
      {
        label: string;
        sublabel: string;
        currentStock: number;
        totalUnitsSold: number;
        recentUnitsSold: number;
        pendingDeficit: number;
        avgUnitCost: number;
        avgSellPrice: number;
        itemCount: number;
      }
    > = {
      tshirt: {
        label: 'Fabric Bolt for T-Shirts (Tob Omash)',
        sublabel: 'T-Shirts / Class B / Polo fabric purchasing',
        currentStock: 0,
        totalUnitsSold: 0,
        recentUnitsSold: 0,
        pendingDeficit: 0,
        avgUnitCost: 0,
        avgSellPrice: 0,
        itemCount: 0,
      },
      folard: {
        label: 'Folard (Scout Scarves)',
        sublabel: 'Folard stock & fabric / ready-made restock',
        currentStock: 0,
        totalUnitsSold: 0,
        recentUnitsSold: 0,
        pendingDeficit: 0,
        avgUnitCost: 0,
        avgSellPrice: 0,
        itemCount: 0,
      },
      amees: {
        label: 'Amees / Uniform Chemise',
        sublabel: 'Formal uniform shirts & Scout chemises',
        currentStock: 0,
        totalUnitsSold: 0,
        recentUnitsSold: 0,
        pendingDeficit: 0,
        avgUnitCost: 0,
        avgSellPrice: 0,
        itemCount: 0,
      },
      other: {
        label: 'Badges, Wegla & Accessories',
        sublabel: 'Standard items & other gear shortages',
        currentStock: 0,
        totalUnitsSold: 0,
        recentUnitsSold: 0,
        pendingDeficit: 0,
        avgUnitCost: 0,
        avgSellPrice: 0,
        itemCount: 0,
      },
    };

    const rowById = new Map(productMetrics.rows.map((r) => [r.product.id, r]));
    const costAccum: Record<BucketKey, { costSum: number; priceSum: number; count: number }> = {
      tshirt: { costSum: 0, priceSum: 0, count: 0 },
      folard: { costSum: 0, priceSum: 0, count: 0 },
      amees: { costSum: 0, priceSum: 0, count: 0 },
      other: { costSum: 0, priceSum: 0, count: 0 },
    };

    productMetrics.rows.forEach((row) => {
      const bucketKey = classifyBuyingBucket(row.product.name, row.product.category);
      const b = buckets[bucketKey];
      b.currentStock += row.product.totalQuantity;
      b.totalUnitsSold += row.unitsSold;
      b.itemCount += 1;
      if (row.unitCost > 0 || row.sellPrice > 0) {
        costAccum[bucketKey].costSum += row.unitCost > 0 ? row.unitCost : Math.round(row.sellPrice * 0.65);
        costAccum[bucketKey].priceSum += row.sellPrice;
        costAccum[bucketKey].count += 1;
      }
    });

    // Pending shortages & recent 14d velocity
    bookings.forEach((b) => {
      const isRecent = recent14d.some((rb) => rb.id === b.id);
      const isOpenOrder = b.status === 'pending' || b.status === 'preparing';
      b.items.forEach((it) => {
        const prodRow = rowById.get(it.productId);
        const key = classifyBuyingBucket(it.productName, prodRow?.product.category);
        if (isRecent) buckets[key].recentUnitsSold += it.quantity;
        if (isOpenOrder && it.deficitQuantity > 0) {
          buckets[key].pendingDeficit += it.deficitQuantity;
        }
      });
    });

    const parsedBoltCost = Math.max(500, Number(boltCostEstimate) || 4500);
    const parsedShirtsPerBolt = Math.max(5, Number(shirtsPerBolt) || 40);

    (Object.keys(buckets) as BucketKey[]).forEach((k) => {
      const acc = costAccum[k];
      buckets[k].avgUnitCost = acc.count > 0 ? Math.round(acc.costSum / acc.count) : k === 'tshirt' ? 110 : k === 'folard' ? 55 : k === 'amees' ? 210 : 40;
      buckets[k].avgSellPrice = acc.count > 0 ? Math.round(acc.priceSum / acc.count) : Math.round(buckets[k].avgUnitCost * 1.35);
    });

    const recommendations = (['tshirt', 'folard', 'amees', 'other'] as BucketKey[]).map((k) => {
      const b = buckets[k];
      const effectiveCost =
        k === 'tshirt' ? parsedBoltCost : Math.max(10, b.avgUnitCost);
      const batchUnits = k === 'tshirt' ? parsedShirtsPerBolt : 1;
      const estimatedProfitPerUnit = Math.max(0, b.avgSellPrice - b.avgUnitCost);
      const coverageRatio = b.recentUnitsSold > 0 ? b.currentStock / Math.max(1, b.recentUnitsSold) : 99;
      const lowStockBonus = b.currentStock <= 10 ? 25 : 0;

      // Priority score balances urgent deficits, recent order pull ("el regl"), and profit margin
      const score =
        b.pendingDeficit * 6 +
        b.recentUnitsSold * 3 +
        (coverageRatio < 1.5 ? 20 : 0) +
        lowStockBonus;

      const affordableCount =
        spendableLiquidity >= effectiveCost ? Math.floor(spendableLiquidity / effectiveCost) : 0;
      const affordableUnits = affordableCount * batchUnits;
      const verdict: 'Buy Priority' | 'Moderate / Optional' | 'Stock Adequate' =
        b.pendingDeficit > 0 || (b.recentUnitsSold >= 8 && b.currentStock < b.recentUnitsSold * 2)
          ? 'Buy Priority'
          : b.recentUnitsSold > 0 && b.currentStock < 20
          ? 'Moderate / Optional'
          : 'Stock Adequate';

      return {
        key: k,
        ...b,
        unitPurchaseCost: effectiveCost,
        unitPurchaseLabel: k === 'tshirt' ? 'Fabric Bolt (Tob)' : 'Piece',
        batchUnits,
        affordableCount,
        affordableUnits,
        estimatedProfitPerUnit,
        score,
        verdict,
      };
    });

    const sortedRecs = [...recommendations].sort((a, b) => b.score - a.score);
    const totalPendingDeficit = recommendations.reduce((s, r) => s + r.pendingDeficit, 0);
    const totalWarehouseStock = activeProducts.reduce((s, p) => s + p.totalQuantity, 0);

    const shouldHoldCash =
      spendableLiquidity < 1000 ||
      (totalPendingDeficit === 0 && footfallTrend === 'slow' && totalWarehouseStock >= 50);

    const needMoreInventory =
      totalPendingDeficit > 0 ||
      (footfallTrend === 'busy' && totalWarehouseStock < recentUnitsCount * 2.5);

    const topRec = sortedRecs[0];
    let headlineDecision = '';
    if (shouldHoldCash) {
      headlineDecision =
        spendableLiquidity < 1000
          ? 'Hold Cash — Spendable liquidity is below minimum purchasing threshold after reserve.'
          : 'Hold Cash For Now — No open order deficits and warehouse inventory covers current footfall.';
    } else if (topRec && topRec.score > 0) {
      headlineDecision = `Prioritize ${topRec.label}: ${topRec.pendingDeficit} units short on open orders & ${topRec.recentUnitsSold} ordered in the last 14 days.`;
    } else {
      headlineDecision = 'Current Stock Covers Active Orders — Allocate budget only to replenish low items.';
    }

    return {
      recentOrdersCount,
      priorOrdersCount,
      recentUnitsCount,
      footfallTrend,
      recommendations: sortedRecs,
      totalPendingDeficit,
      totalWarehouseStock,
      shouldHoldCash,
      needMoreInventory,
      headlineDecision,
    };
  }, [
    bookings,
    productMetrics.rows,
    activeProducts,
    spendableLiquidity,
    boltCostEstimate,
    shirtsPerBolt,
  ]);

  // Calendar-Connected Scout Season & Scout Fare2 Breakdown
  const seasonAndFare2Analytics = useMemo(() => {
    const sortedSeasons = [...scoutSeasons].sort((a, b) =>
      b.startDate.localeCompare(a.startDate)
    );
    const rowById = new Map(productMetrics.rows.map((r) => [r.product.id, r]));

    const computeOrderCogs = (b: Booking): number =>
      b.items.reduce((s, it) => {
        const unitCost = rowById.get(it.productId)?.unitCost || 0;
        return s + it.quantity * unitCost;
      }, 0);

    const doesBookingMatchSeason = (b: Booking, season: ScoutSeason): boolean => {
      const dateKey = getBookingDateKey(b.createdAt);
      if (!dateKey) return false;
      return dateKey >= season.startDate && dateKey <= season.endDate;
    };

    const seasonRows = sortedSeasons.map((season) => {
      const matching = bookings.filter((b) => doesBookingMatchSeason(b, season));
      const orders = matching.length;
      const units = matching.reduce(
        (s, b) => s + b.items.reduce((u, it) => u + it.quantity, 0),
        0
      );
      const revenue = matching.reduce((s, b) => s + Number(b.total || 0), 0);
      const cogs = matching.reduce((s, b) => s + computeOrderCogs(b), 0);
      const collected = matching.reduce((s, b) => s + getCollectedCashForBooking(b), 0);
      return {
        id: season.id,
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
        colorHex: season.colorHex || '#059669',
        orders,
        units,
        revenue,
        collected,
        cogs,
        grossProfit: revenue - cogs,
      };
    });

    const unassignedBookings = bookings.filter(
      (b) => !sortedSeasons.some((s) => doesBookingMatchSeason(b, s))
    );
    const unassignedSummary = {
      id: '__unassigned__',
      name: sortedSeasons.length > 0 ? 'Outside Defined Seasons' : 'All Orders (No Scout Seasons Set)',
      startDate: '',
      endDate: '',
      colorHex: '#64748B',
      orders: unassignedBookings.length,
      units: unassignedBookings.reduce(
        (s, b) => s + b.items.reduce((u, it) => u + it.quantity, 0),
        0
      ),
      revenue: unassignedBookings.reduce((s, b) => s + Number(b.total || 0), 0),
      collected: unassignedBookings.reduce((s, b) => s + getCollectedCashForBooking(b), 0),
      cogs: unassignedBookings.reduce((s, b) => s + computeOrderCogs(b), 0),
      grossProfit:
        unassignedBookings.reduce((s, b) => s + Number(b.total || 0), 0) -
        unassignedBookings.reduce((s, b) => s + computeOrderCogs(b), 0),
    };

    const activeSelectedSeason =
      selectedScoutSeasonId !== 'all' && selectedScoutSeasonId !== '__unassigned__'
        ? sortedSeasons.find((s) => s.id === selectedScoutSeasonId) || null
        : null;

    const filteredBookings =
      selectedScoutSeasonId === 'all'
        ? bookings
        : selectedScoutSeasonId === '__unassigned__'
        ? unassignedBookings
        : activeSelectedSeason
        ? bookings.filter((b) => doesBookingMatchSeason(b, activeSelectedSeason))
        : bookings;

    const fare2Ids = [...SCOUT_FERA2_LIST.map((f) => f.id), 'Afrad'];
    const fare2Buckets = new Map<
      string,
      {
        fare2: string;
        orders: number;
        units: number;
        revenue: number;
        cogs: number;
        collected: number;
      }
    >();
    fare2Ids.forEach((id) =>
      fare2Buckets.set(id, { fare2: id, orders: 0, units: 0, revenue: 0, cogs: 0, collected: 0 })
    );

    filteredBookings.forEach((b) => {
      const units = b.items.reduce((s, i) => s + i.quantity, 0);
      const rev = Number(b.total || 0);
      const cogs = computeOrderCogs(b);
      const collected = getCollectedCashForBooking(b);

      const fKey = resolveBookingFare2(b);
      const fb = fare2Buckets.get(fKey) || {
        fare2: fKey,
        orders: 0,
        units: 0,
        revenue: 0,
        cogs: 0,
        collected: 0,
      };
      fb.orders += 1;
      fb.units += units;
      fb.revenue += rev;
      fb.cogs += cogs;
      fb.collected += collected;
      fare2Buckets.set(fKey, fb);
    });

    const totalFilteredRevenue = filteredBookings.reduce((s, b) => s + Number(b.total || 0), 0);
    const fare2Rows = Array.from(fare2Buckets.values()).map((row) => ({
      ...row,
      grossProfit: row.revenue - row.cogs,
      sharePct: totalFilteredRevenue > 0 ? Math.round((row.revenue / totalFilteredRevenue) * 1000) / 10 : 0,
    }));

    const combinedFera2 = {
      orders: filteredBookings.length,
      units: fare2Rows.reduce((s, r) => s + r.units, 0),
      revenue: totalFilteredRevenue,
      cogs: fare2Rows.reduce((s, r) => s + r.cogs, 0),
      grossProfit: totalFilteredRevenue - fare2Rows.reduce((s, r) => s + r.cogs, 0),
      collected: fare2Rows.reduce((s, r) => s + r.collected, 0),
    };

    return {
      sortedSeasons,
      seasonRows,
      unassignedSummary,
      activeSelectedSeason,
      fare2Rows,
      combinedFera2,
    };
  }, [bookings, productMetrics.rows, scoutSeasons, selectedScoutSeasonId]);

  const filteredProductRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productMetrics.rows.filter((row) => {
      if (productFilter === 'has_cost' && row.unitCost <= 0) return false;
      if (productFilter === 'missing_cost' && row.unitCost > 0) return false;
      if (productFilter === 'hardship' && row.hardshipValue <= 0) return false;
      if (!q) return true;
      return `${row.product.name} ${row.product.sku} ${row.product.category}`
        .toLowerCase()
        .includes(q);
    });
  }, [productMetrics.rows, searchQuery, productFilter]);

  const updateProductProfileField = (
    productId: string,
    patch: Partial<ProductBudgetProfile>
  ) => {
    const existing = budgetProfiles[productId];
    const row = productMetrics.rows.find((r) => r.product.id === productId);
    const next: ProductBudgetProfile = {
      productId,
      manufacturingCost: existing ? existing.manufacturingCost : row?.sourcingCost || 0,
      extraPrepCost: existing ? existing.extraPrepCost : 0,
      targetMarginPercent: existing?.targetMarginPercent,
      hardshipDiscountType: existing?.hardshipDiscountType || 'percentage',
      hardshipDiscountValue: existing?.hardshipDiscountValue,
      notes: existing?.notes,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    onSaveBudgetProfile(next);
  };

  const handleSaveLiquiditySettings = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCash = editingCashValue.trim() === '' ? undefined : Math.max(0, Number(editingCashValue) || 0);
    const parsedReserve = Math.max(0, Number(editingReserveValue) || 0);
    onSaveSettings({
      id: 'default',
      cashOnHand: parsedCash,
      reserveBuffer: parsedReserve,
      updatedAt: new Date().toISOString(),
    });
    onShowToast?.('Store cash liquidity & safety buffer saved.');
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount);
    if (!expenseTitle.trim() || !amt || amt <= 0) {
      onShowToast?.('Enter an expense title and positive amount.');
      return;
    }
    const entry: BudgetExpenseEntry = {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: expenseTitle.trim(),
      category: expenseCategory,
      amount: Math.round(amt * 100) / 100,
      expenseDate: expenseDate || new Date().toISOString().slice(0, 10),
      linkedProductId: expenseLinkedProductId || undefined,
      notes: expenseNotes.trim() || undefined,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
    };
    onAddExpense(entry);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseLinkedProductId('');
    setExpenseNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header & View Navigation Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-emerald-700 shrink-0" />
            <span>Store Budgeting &amp; Financial Control</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track unit manufacturing costs, Sales &amp; COGS, Gross &amp; Net Profit, Margin % pricing, hardship discounts, cash liquidity, and seasonal Fare2 performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">
            {(
              [
                { id: 'unit_pnl', label: 'Products P&L & Pricing' },
                { id: 'liquidity', label: 'Liquidity & Buying Advisor' },
                { id: 'seasons_fera2', label: 'Scout Seasons & Fera2' },
                { id: 'expenses', label: `Other Expenses (${budgetExpenses.length})` },
              ] as { id: BudgetingTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === t.id
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onLock}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Lock Budgeting page"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Persistent Top Financial KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-4">
          <div className="text-[11px] font-medium text-slate-300">Cash Liquidity (El Seyoola)</div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums mt-1">
            {formatCompact(currentLiquidity)} EGP
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
            Spendable: {formatCompact(spendableLiquidity)} EGP
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Total Sales Revenue</div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {formatCompact(productMetrics.totalSales)} EGP
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-1">
            Collected: {formatCompact(productMetrics.totalCollectedCash)} EGP
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Total COGS</div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {formatCompact(productMetrics.totalCOGS)} EGP
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Mfg + Ready Prep Costs</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Gross Profit</div>
          <div
            className={`text-lg sm:text-xl font-bold font-mono tabular-nums mt-1 ${
              productMetrics.totalGrossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCompact(productMetrics.totalGrossProfit)} EGP
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-1">
            Margin:{' '}
            {productMetrics.totalSales > 0
              ? Math.round((productMetrics.totalGrossProfit / productMetrics.totalSales) * 100)
              : 0}
            %
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Other Store Expenses</div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {formatCompact(productMetrics.totalOtherExpenses)} EGP
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {budgetExpenses.length} logged expense(s)
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Net Profit</div>
          <div
            className={`text-lg sm:text-xl font-bold font-mono tabular-nums mt-1 ${
              productMetrics.totalNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCompact(productMetrics.totalNetProfit)} EGP
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-1">
            After all store expenses
          </div>
        </div>
      </div>

      {/* TAB 1: PRODUCTS UNIT COST, MARGIN % AUTO-PRICING, HARDSHIP & P&L */}
      {activeTab === 'unit_pnl' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, SKU, or category..."
                className="w-full pl-9 pr-3 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `All Products (${productMetrics.rows.length})` },
                  { id: 'has_cost', label: 'Cost Configured' },
                  { id: 'missing_cost', label: 'Missing Cost' },
                  { id: 'hardship', label: 'Hardship Discount Active' },
                ] as { id: ProductBudgetFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setProductFilter(f.id)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    productFilter === f.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredProductRows.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
                No products match your filter.
              </div>
            ) : (
              filteredProductRows.map((row) => {
                const isExpanded = expandedProductId === row.product.id;
                const prodImg = row.product.image || row.product.images?.[0];

                return (
                  <div
                    key={row.product.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
                  >
                    {/* Summary Row */}
                    <div className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {prodImg ? (
                            <img
                              src={prodImg}
                              alt={row.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Calculator className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-amber-700 font-semibold">
                              {row.product.sku}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{row.product.category}</span>
                            {row.offerBadge && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-rose-700 font-bold">{row.offerBadge}</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {row.product.name}
                          </h3>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                            Stock: {row.product.totalQuantity} pcs · Sold: {row.unitsSold} pcs
                            {row.isCostFromSourcingFallback && ' · Cost synced from Sourcing'}
                          </div>
                        </div>
                      </div>

                      {/* Financial Numbers Grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-right items-center">
                        <div>
                          <div className="text-[11px] text-slate-500">Cost (Wa2ef)</div>
                          <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                            {formatEgp(row.unitCost)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Sell Price</div>
                          <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                            {formatEgp(row.sellPrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Sales</div>
                          <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                            {formatCompact(row.revenue)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">COGS</div>
                          <div className="text-sm font-bold font-mono tabular-nums text-slate-700">
                            {formatCompact(row.cogs)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Gross Profit</div>
                          <div
                            className={`text-sm font-bold font-mono tabular-nums ${
                              row.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatCompact(row.grossProfit)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Net Profit</div>
                          <div
                            className={`text-sm font-bold font-mono tabular-nums ${
                              row.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatCompact(row.netProfit)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProductId(isExpanded ? null : row.product.id)
                        }
                        className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                          isExpanded
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        {isExpanded ? 'Hide Calculator' : 'Cost, Margin % & Hardship'}
                      </button>
                    </div>

                    {/* Expanded Unit Cost + Margin Auto-Pricer + Hardship Discount */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 bg-slate-50/80 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Column A: Unit Cost Inputs */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Calculator className="w-4 h-4 text-amber-600" />
                            <span>1. Cost &amp; Ready-for-Sale Prep</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Mfg / Buy Cost (EGP)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={row.mfgCost}
                                onChange={(e) =>
                                  updateProductProfileField(row.product.id, {
                                    manufacturingCost: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Prep / Packaging (EGP)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={row.extraPrepCost}
                                onChange={(e) =>
                                  updateProductProfileField(row.product.id, {
                                    extraPrepCost: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-slate-600">Total Cost / Unit (Break-Even):</span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatEgp(row.unitCost)} EGP
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Current Profit / Unit:</span>
                            <span
                              className={`font-mono font-bold ${
                                row.sellPrice - row.unitCost >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatEgp(row.sellPrice - row.unitCost)} EGP ({row.marginPct}%)
                            </span>
                          </div>
                        </div>

                        {/* Column B: Auto-Calculate Price from Profit Margin % */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            <span>2. Margin % Auto-Price Calculator</span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Desired Profit Margin %
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="90"
                                step="1"
                                value={row.targetMarginPct ?? ''}
                                placeholder="e.g. 25"
                                onChange={(e) =>
                                  updateProductProfileField(row.product.id, {
                                    targetMarginPercent:
                                      e.target.value === ''
                                        ? undefined
                                        : Math.max(0, Math.min(90, Number(e.target.value) || 0)),
                                  })
                                }
                                className="w-24 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-900"
                              />
                              <div className="flex flex-wrap gap-1">
                                {[15, 25, 35, 50].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() =>
                                      updateProductProfileField(row.product.id, {
                                        targetMarginPercent: pct,
                                      })
                                    }
                                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold border ${
                                      row.targetMarginPct === pct
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {pct}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">Calculated Sell Price:</span>
                              <span className="text-sm font-black font-mono tabular-nums text-emerald-700">
                                {row.suggestedSellPrice !== undefined
                                  ? `${formatEgp(row.suggestedSellPrice)} EGP`
                                  : 'Enter Cost & %'}
                              </span>
                            </div>
                            {row.suggestedSellPrice !== undefined && (
                              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                                <span>Net / unit:</span>
                                <span>
                                  +{formatEgp(row.suggestedSellPrice - row.unitCost)} EGP
                                </span>
                              </div>
                            )}
                          </div>

                          {row.suggestedSellPrice !== undefined && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProductPrice(
                                  row.product.id,
                                  Math.round(row.suggestedSellPrice!)
                                )
                              }
                              className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                Apply {Math.round(row.suggestedSellPrice)} EGP to Catalog Price
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Column C: Hardship / Need-Based Discount Simulator */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <HeartHandshake className="w-4 h-4 text-sky-600" />
                            <span>3. Hardship Support Discount</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Discount Type
                              </label>
                              <select
                                value={row.hardshipType}
                                onChange={(e) =>
                                  updateProductProfileField(row.product.id, {
                                    hardshipDiscountType:
                                      e.target.value === 'fixed_amount'
                                        ? 'fixed_amount'
                                        : 'percentage',
                                  })
                                }
                                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 bg-white"
                              >
                                <option value="percentage">% Discount Off</option>
                                <option value="fixed_amount">Fixed EGP Off</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                {row.hardshipType === 'percentage' ? 'Discount %' : 'Amount Off (EGP)'}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={row.hardshipValue || ''}
                                placeholder="e.g. 30"
                                onChange={(e) =>
                                  updateProductProfileField(row.product.id, {
                                    hardshipDiscountValue:
                                      e.target.value === ''
                                        ? undefined
                                        : Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Hardship Sell Price:</span>
                              <span className="text-sm font-black font-mono tabular-nums text-sky-700">
                                {formatEgp(row.hardshipPrice)} EGP
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Break-Even Cost:</span>
                              <span className="font-mono font-semibold text-slate-700">
                                {formatEgp(row.unitCost)} EGP
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                              <span className="text-slate-600">Result:</span>
                              <span
                                className={`font-mono font-bold ${
                                  row.hardshipNetPerUnit >= 0 ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {row.hardshipNetPerUnit >= 0
                                  ? `Covers Cost (+${formatEgp(row.hardshipNetPerUnit)} EGP)`
                                  : `Subsidized (${formatEgp(row.hardshipNetPerUnit)} EGP/unit)`}
                              </span>
                            </div>
                          </div>

                          {row.hardshipNetPerUnit < 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const subsidy = Math.abs(Math.round(row.hardshipNetPerUnit * 100) / 100);
                                onAddExpense({
                                  id: `exp_hardship_${Date.now()}`,
                                  title: `Hardship Subsidy — ${row.product.name}`,
                                  category: 'hardship_subsidy',
                                  amount: subsidy,
                                  expenseDate: new Date().toISOString().slice(0, 10),
                                  linkedProductId: row.product.id,
                                  notes: `Hardship discount price ${row.hardshipPrice} EGP vs unit cost ${row.unitCost} EGP`,
                                  createdByName: currentUser.name,
                                  createdAt: new Date().toISOString(),
                                });
                              }}
                              className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                            >
                              Log 1x Subsidy ({formatEgp(Math.abs(row.hardshipNetPerUnit))} EGP) to Expenses
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIQUIDITY (EL SEYOOLA) & PURCHASING ADVISOR */}
      {activeTab === 'liquidity' && (
        <div className="space-y-6">
          {/* Liquidity Settings + Footfall ("El Regl") + Inventory Capacity Verdict */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <form
              onSubmit={handleSaveLiquiditySettings}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Store Cash Liquidity (El Seyoola)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Auto-calculated cash: {formatCompact(autoComputedCash)} EGP (Collected - Expenses)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCashValue('');
                    onSaveSettings({
                      id: 'default',
                      cashOnHand: undefined,
                      reserveBuffer: Number(editingReserveValue) || 0,
                      updatedAt: new Date().toISOString(),
                    });
                    onShowToast?.('Liquidity synced to live Collected Cash minus Expenses.');
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  title="Reset manual override back to automatic calculation"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Auto</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Cash In Hand Override (EGP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingCashValue}
                    onChange={(e) => setEditingCashValue(e.target.value)}
                    placeholder={`Auto (${Math.round(autoComputedCash)})`}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Safety Cash Reserve (EGP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingReserveValue}
                    onChange={(e) => setEditingReserveValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    T-Shirt Fabric Bolt Cost (EGP)
                  </label>
                  <input
                    type="number"
                    min="100"
                    value={boltCostEstimate}
                    onChange={(e) => setBoltCostEstimate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Avg T-Shirts per Bolt
                  </label>
                  <input
                    type="number"
                    min="5"
                    value={shirtsPerBolt}
                    onChange={(e) => setShirtsPerBolt(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                Save Liquidity &amp; Reserve Settings
              </button>
            </form>

            {/* Statistical Diagnosis & Inventory Capacity Verdict */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Statistical Purchasing &amp; Footfall Diagnosis</span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      liquidityAdvisor.shouldHoldCash
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {liquidityAdvisor.shouldHoldCash ? 'Hold Cash Recommended' : 'Ready To Purchase'}
                  </span>
                </div>

                <p className="text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  {liquidityAdvisor.headlineDecision}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Store Traffic (14d Orders)</div>
                    <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                      {liquidityAdvisor.recentOrdersCount} orders
                    </div>
                    <div className="text-[11px] text-slate-500 capitalize">
                      Pace: {liquidityAdvisor.footfallTrend} (vs {liquidityAdvisor.priorOrdersCount} prior)
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">14d Units Ordered</div>
                    <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                      {liquidityAdvisor.recentUnitsCount} pcs
                    </div>
                    <div className="text-[11px] text-slate-500">Recent store pull</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Open Order Shortages</div>
                    <div
                      className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                        liquidityAdvisor.totalPendingDeficit > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {liquidityAdvisor.totalPendingDeficit} pcs
                    </div>
                    <div className="text-[11px] text-slate-500">Unfulfilled demand</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Warehouse On-Hand</div>
                    <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                      {liquidityAdvisor.totalWarehouseStock} pcs
                    </div>
                    <div className="text-[11px] text-slate-500">Total active stock</div>
                  </div>
                </div>
              </div>

              {/* Inventory Scaling Verdict */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                  liquidityAdvisor.needMoreInventory
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {liquidityAdvisor.needMoreInventory ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  ) : (
                    <PackageCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold">
                      Inventory Capacity Verdict:{' '}
                      {liquidityAdvisor.needMoreInventory
                        ? 'Expand Inventory for Upcoming Demand'
                        : 'Current Inventory Size Is Sufficient'}
                    </div>
                    <div className="text-[11px] opacity-85 mt-0.5">
                      {liquidityAdvisor.needMoreInventory
                        ? `${liquidityAdvisor.totalPendingDeficit} shortage pieces across pending/preparing orders require restocking.`
                        : `Warehouse holds ${liquidityAdvisor.totalWarehouseStock} units against ${liquidityAdvisor.recentUnitsCount} units moved in the last 14 days.`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Purchasing Options Comparison: Tob Omash T-Shirt vs Folard vs Amees vs Others */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Where Should I Invest {formatCompact(spendableLiquidity)} EGP Spendable Liquidity?
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked by open order shortages, 14-day sales velocity, and unit profit contribution.
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-600">
                Available after {formatCompact(reserveBuffer)} EGP buffer
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {liquidityAdvisor.recommendations.map((rec) => (
                <div key={rec.key} className="p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{rec.label}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 border ${
                          rec.verdict === 'Buy Priority'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : rec.verdict === 'Moderate / Optional'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {rec.verdict}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{rec.sublabel}</p>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Current Stock:</span>
                        <span className="font-mono font-bold text-slate-900">{rec.currentStock} pcs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Open Order Deficit:</span>
                        <span
                          className={`font-mono font-bold ${
                            rec.pendingDeficit > 0 ? 'text-rose-700' : 'text-slate-700'
                          }`}
                        >
                          {rec.pendingDeficit} pcs
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">14-Day Demand:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {rec.recentUnitsSold} pcs
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Est. Unit Cost:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {formatCompact(rec.unitPurchaseCost)} EGP / {rec.unitPurchaseLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="text-slate-500">Current Liquidity Can Buy:</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                      {rec.affordableCount} {rec.unitPurchaseLabel}
                      {rec.affordableCount === 1 ? '' : 's'}
                      {rec.key === 'tshirt' && rec.affordableCount > 0
                        ? ` (~${rec.affordableUnits} T-Shirts)`
                        : ''}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-mono tabular-nums">
                      Est. Profit: ~{formatCompact(rec.estimatedProfitPerUnit * Math.max(1, rec.affordableUnits))} EGP
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CALENDAR-CONNECTED SCOUT SEASONS & SCOUT FERA2 BREAKDOWN */}
      {activeTab === 'seasons_fera2' && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-emerald-700" />
                <span>Calendar-Connected Scout Seasons &amp; Per-Fare2 Sales</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Seasons follow the exact Scout time frames configured in Store Calendar. Select any Scout Season to filter Fare2 sales below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                <select
                  value={selectedScoutSeasonId}
                  onChange={(e) => setSelectedScoutSeasonId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900"
                >
                  <option value="all">All Scout Seasons (All Time)</option>
                  {seasonAndFare2Analytics.sortedSeasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startDate} → {s.endDate})
                    </option>
                  ))}
                  {seasonAndFare2Analytics.unassignedSummary.orders > 0 &&
                    seasonAndFare2Analytics.sortedSeasons.length > 0 && (
                      <option value="__unassigned__">Outside Defined Seasons</option>
                    )}
                </select>
              </div>
              {onOpenCalendar && (
                <button
                  type="button"
                  onClick={onOpenCalendar}
                  className="px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-950 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Manage Seasons in Calendar</span>
                </button>
              )}
            </div>
          </div>

          {/* Sales by Calendar Scout Season Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Sales Volume &amp; Profit by Calendar Scout Season
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {seasonAndFare2Analytics.sortedSeasons.length} configured season(s)
              </span>
            </div>

            {seasonAndFare2Analytics.sortedSeasons.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <CalendarRange className="w-9 h-9 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-900">
                  No Scout Seasons defined in Calendar yet
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Define your Scout Seasons / Time Frames (e.g., First Term, Summer Camp, Easter Season) in the Store Calendar to group orders, COGS, and profits automatically.
                </p>
                {onOpenCalendar && (
                  <button
                    type="button"
                    onClick={onOpenCalendar}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    <CalendarRange className="w-4 h-4 text-emerald-400" />
                    <span>Open Calendar to Add Scout Seasons</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                      <th className="py-3 px-4">Scout Season (Calendar)</th>
                      <th className="py-3 px-4">Time Frame</th>
                      <th className="py-3 px-4 text-right">Orders</th>
                      <th className="py-3 px-4 text-right">Units Sold</th>
                      <th className="py-3 px-4 text-right">Sales Revenue</th>
                      <th className="py-3 px-4 text-right">Collected Cash</th>
                      <th className="py-3 px-4 text-right">COGS</th>
                      <th className="py-3 px-4 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {seasonAndFare2Analytics.seasonRows.map((s) => {
                      const isSelected = selectedScoutSeasonId === s.id;
                      return (
                        <tr
                          key={s.id}
                          onClick={() =>
                            setSelectedScoutSeasonId(isSelected ? 'all' : s.id)
                          }
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50/70'
                          }`}
                          title="Click row to filter Fare2 breakdown by this Scout Season"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: s.colorHex }}
                              />
                              <span>{s.name}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {s.startDate} → {s.endDate}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {s.orders}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {s.units} pcs
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatEgp(s.revenue)} EGP
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatEgp(s.collected)} EGP
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                            {formatEgp(s.cogs)} EGP
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                              s.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatEgp(s.grossProfit)} EGP
                          </td>
                        </tr>
                      );
                    })}
                    {seasonAndFare2Analytics.unassignedSummary.orders > 0 && (
                      <tr
                        onClick={() =>
                          setSelectedScoutSeasonId(
                            selectedScoutSeasonId === '__unassigned__' ? 'all' : '__unassigned__'
                          )
                        }
                        className={`cursor-pointer transition-colors ${
                          selectedScoutSeasonId === '__unassigned__'
                            ? 'bg-slate-100'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-600">
                          Outside Defined Seasons
                        </td>
                        <td className="py-3 px-4 text-slate-400">—</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {seasonAndFare2Analytics.unassignedSummary.orders}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {seasonAndFare2Analytics.unassignedSummary.units} pcs
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatEgp(seasonAndFare2Analytics.unassignedSummary.revenue)} EGP
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatEgp(seasonAndFare2Analytics.unassignedSummary.collected)} EGP
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {formatEgp(seasonAndFare2Analytics.unassignedSummary.cogs)} EGP
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                            seasonAndFare2Analytics.unassignedSummary.grossProfit >= 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {formatEgp(seasonAndFare2Analytics.unassignedSummary.grossProfit)} EGP
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sales by Scout Fare2 + Combined All Fera2 Total */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Sales by Scout Fare2 &amp; All Fera2 Total
                </h3>
                {seasonAndFare2Analytics.activeSelectedSeason && (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    {seasonAndFare2Analytics.activeSelectedSeason.name}
                  </span>
                )}
                {selectedScoutSeasonId === '__unassigned__' && (
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                    Outside Defined Seasons
                  </span>
                )}
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                Combined: {formatCompact(seasonAndFare2Analytics.combinedFera2.revenue)} EGP
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-4">Scout Fare2</th>
                    <th className="py-3 px-4 text-right">Orders</th>
                    <th className="py-3 px-4 text-right">Sales Volume</th>
                    <th className="py-3 px-4 text-right">Total Sales</th>
                    <th className="py-3 px-4 text-right">Collected</th>
                    <th className="py-3 px-4 text-right">COGS</th>
                    <th className="py-3 px-4 text-right">Gross Profit</th>
                    <th className="py-3 px-4 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {seasonAndFare2Analytics.fare2Rows.map((f) => {
                    const meta = getScoutFare2Meta(f.fare2);
                    return (
                      <tr key={f.fare2} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              meta?.dotClass || 'bg-slate-400'
                            }`}
                          />
                          <span>{f.fare2}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {f.orders}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {f.units} pcs
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatEgp(f.revenue)} EGP
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatEgp(f.collected)} EGP
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {formatEgp(f.cogs)} EGP
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                            f.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatEgp(f.grossProfit)} EGP
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {f.sharePct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white text-xs font-bold">
                    <td className="py-3.5 px-4">ALL FERA2 COMBINED TOTAL</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {seasonAndFare2Analytics.combinedFera2.orders}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {seasonAndFare2Analytics.combinedFera2.units} pcs
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {formatEgp(seasonAndFare2Analytics.combinedFera2.revenue)} EGP
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {formatEgp(seasonAndFare2Analytics.combinedFera2.collected)} EGP
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {formatEgp(seasonAndFare2Analytics.combinedFera2.cogs)} EGP
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-400">
                      {formatEgp(seasonAndFare2Analytics.combinedFera2.grossProfit)} EGP
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OTHER EXPENSES LEDGER */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Add Expense Form */}
          <form
            onSubmit={handleCreateExpense}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5 h-fit"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Receipt className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Log Store / Prep Expense</h2>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Expense Description *
              </label>
              <input
                type="text"
                required
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="e.g. Packaging bags, weaving labels, delivery courier..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Category
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as BudgetExpenseCategory)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white"
                >
                  {(Object.keys(EXPENSE_CATEGORY_META) as BudgetExpenseCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {EXPENSE_CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Amount (EGP) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Linked Product (Opt)
                </label>
                <select
                  value={expenseLinkedProductId}
                  onChange={(e) => setExpenseLinkedProductId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white"
                >
                  <option value="">General Store Overhead</option>
                  {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Notes</label>
              <textarea
                rows={2}
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                placeholder="Optional receipt details or vendor..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Expense Entry</span>
            </button>
          </form>

          {/* Expenses Table */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <h2 className="text-sm font-bold text-slate-900">
                Store &amp; Ready-for-Sale Expenses ({budgetExpenses.length})
              </h2>
              <span className="text-xs font-mono font-bold text-amber-800">
                Total: {formatEgp(productMetrics.totalOtherExpenses)} EGP
              </span>
            </div>

            {budgetExpenses.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No extra store expenses logged yet. Add packaging, finishing, delivery, or utility costs on the left so Net Profit stays accurate.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {budgetExpenses.map((exp) => {
                  const linkedProd = exp.linkedProductId
                    ? products.find((p) => p.id === exp.linkedProductId)
                    : undefined;
                  return (
                    <div
                      key={exp.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{exp.title}</div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>{EXPENSE_CATEGORY_META[exp.category]?.label || exp.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{exp.expenseDate}</span>
                          {linkedProd && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-700 font-semibold">{linkedProd.name}</span>
                            </>
                          )}
                          {exp.notes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate max-w-xs">{exp.notes}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-bold font-mono tabular-nums text-rose-700">
                          -{formatEgp(exp.amount)} EGP
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(exp.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
