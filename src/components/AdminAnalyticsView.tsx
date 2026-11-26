import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Booking, Product, User } from '../types/inventory';
import { canUserAccessView } from '../utils/security';
import { SCOUT_FERA2_LIST, getScoutFare2Meta } from '../utils/scoutFera2';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Search,
  ShieldAlert,
  TrendingUp,
  Layers,
  Factory,
  Shirt,
  Package,
  Users,
  Check,
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  ArrowUpDown,
  X,
} from 'lucide-react';

interface AdminAnalyticsViewProps {
  bookings: Booking[];
  products: Product[];
  currentUser: User;
  users?: User[];
  onShowToast?: (message: string) => void;
}

type DatePreset = 'all' | 'today' | '7d' | 'month' | '30d' | 'custom';
type SalesPaymentFilter = 'all' | 'preparing' | 'done';
type AggregatorFilter = 'all' | 'preparing' | 'done';
type SalesSortKey = 'revenue' | 'qty' | 'name';

const KNOWN_BRANCHES = [
  'Ashbal',
  'Zahrat',
  'Kashafeen',
  'Morshedat',
  '3ashera 1',
  '3ashera 2',
  'Afrad',
];

const formatDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toOrderDateKey = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatDateKey(d);
};

const normalizeSizeLabel = (sz?: string): string => {
  const clean = (sz || '').trim();
  if (!clean || clean.toLowerCase() === 'one size' || clean.toLowerCase() === 'standard') {
    return 'Standard Size';
  }
  return clean;
};

const resolveBookingBranchName = (b: Booking): string => {
  const core = getScoutFare2Meta(b.troopGroup);
  if (core) return core.id;
  const routed = getScoutFare2Meta(b.assignedFare2);
  if (routed) return routed.id;
  return (b.troopGroup || '').trim() || 'Unassigned';
};

const isOrderPaidOrConfirmed = (b: Booking): boolean =>
  Boolean(
    b.depositPaid ||
      (typeof b.depositPaidAmount === 'number' && b.depositPaidAmount > 0) ||
      (typeof b.finalPaidAmount === 'number' && b.finalPaidAmount > 0) ||
      b.status === 'done'
  );

const getCollectedCashForBooking = (b: Booking): number => {
  if (b.status === 'done') return b.total;
  if (!isOrderPaidOrConfirmed(b)) return 0;
  if (typeof b.depositPaidAmount === 'number' && b.depositPaidAmount > 0) {
    return Math.min(b.total, b.depositPaidAmount);
  }
  if (typeof b.depositRequired === 'number' && b.depositRequired > 0) {
    return Math.min(b.total, b.depositRequired);
  }
  const rate = b.depositRate ?? (b.depositPercentage ? b.depositPercentage / 100 : 0.5);
  return Math.round(b.total * rate);
};

const classifyGarmentGroup = (
  productName: string,
  catalogProduct?: Product
): 'amees' | 'tshirt' | 'other' => {
  const combined = `${productName} ${catalogProduct?.name || ''} ${catalogProduct?.category || ''}`.toLowerCase();

  // Check Uniform Shirt / Amees / Chemise first so "Scout Shirt" doesn't collide with generic shirt terms
  if (
    combined.includes('amees') ||
    combined.includes('3amees') ||
    combined.includes('amis') ||
    combined.includes('chemise') ||
    combined.includes('قميص') ||
    ((combined.includes('shirt') || combined.includes('uniform shirt')) &&
      !combined.includes('t-shirt') &&
      !combined.includes('tshirt') &&
      !combined.includes('t shirt') &&
      !combined.includes('sweatshirt') &&
      !combined.includes('tee'))
  ) {
    return 'amees';
  }

  if (
    combined.includes('t-shirt') ||
    combined.includes('tshirt') ||
    combined.includes('t shirt') ||
    combined.includes('tee') ||
    combined.includes('polo') ||
    combined.includes('تيشيرت') ||
    combined.includes('class b') ||
    combined.includes('class a')
  ) {
    return 'tshirt';
  }

  return 'other';
};

const formatCurrency = (val: number): string =>
  val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({
  bookings,
  products,
  currentUser,
  users = [],
  onShowToast,
}) => {
  const hasAnalyticsAccess = canUserAccessView(currentUser, 'analytics', users);

  // Global Date Range & Branch Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('All Branches');

  // Section 1B: Product Sales Filters (strictly paid & deposit-accepted orders only)
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<SalesPaymentFilter>('all');
  const [salesSearch, setSalesSearch] = useState<string>('');
  const [salesSortKey, setSalesSortKey] = useState<SalesSortKey>('revenue');
  const [salesSortAsc, setSalesSortAsc] = useState<boolean>(false);

  // Section 2: Branch Filter inside Branch Demand
  const [selectedDemandBranch, setSelectedDemandBranch] = useState<string>('All');

  // Section 3: Production Aggregator Filters (Multi-select Fare2 + Date Range + Status + Shortfall)
  const [aggregatorFilter, setAggregatorFilter] = useState<AggregatorFilter>('all');
  const [aggregatorSearch, setAggregatorSearch] = useState<string>('');
  const [onlyShortfall, setOnlyShortfall] = useState<boolean>(false);
  const [aggregatorFare2, setAggregatorFare2] = useState<string[]>([]);
  const [aggFromDate, setAggFromDate] = useState<string>('');
  const [aggToDate, setAggToDate] = useState<string>('');

  // Strict RBAC guard
  if (!hasAnalyticsAccess) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg mx-auto my-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          The Analytics &amp; Production Dashboard is restricted to Budgeting &amp; Liquidity Team members and Full-Access Administrators.
        </p>
      </div>
    );
  }

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = formatDateKey(today);

    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === '7d') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setFromDate(formatDateKey(start));
      setToDate(todayStr);
    } else if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(formatDateKey(start));
      setToDate(todayStr);
    } else if (preset === '30d') {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setFromDate(formatDateKey(start));
      setToDate(todayStr);
    }
  };

  // All unique branch options (strictly from paid/confirmed orders)
  const branchOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_BRANCHES);
    bookings.forEach((b) => {
      if (!isOrderPaidOrConfirmed(b)) return;
      const grp = resolveBookingBranchName(b);
      if (grp && grp !== 'Unassigned') set.add(grp);
    });
    return ['All Branches', ...Array.from(set), 'Unassigned'];
  }, [bookings]);

  // Catalog Lookup Maps
  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const productByName = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.name.trim().toLowerCase(), p));
    return m;
  }, [products]);

  // Filter Bookings by Paid/Confirmed Status + Date Range + Branch (strictly excludes unpaid orders)
  const dateAndBranchFilteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!isOrderPaidOrConfirmed(b)) return false;

      const orderDay = toOrderDateKey(b.createdAt);
      if (fromDate && orderDay && orderDay < fromDate) return false;
      if (toDate && orderDay && orderDay > toDate) return false;
      if ((fromDate || toDate) && !orderDay) return false;

      if (branchFilter !== 'All Branches') {
        const bGroup = resolveBookingBranchName(b);
        if (branchFilter === 'Unassigned') {
          if (bGroup !== 'Unassigned') return false;
        } else if (bGroup.toLowerCase() !== branchFilter.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [bookings, fromDate, toDate, branchFilter]);

  // Section 1A: KPI Metrics (Paid & Deposit-Accepted Orders Only)
  const kpiMetrics = useMemo(() => {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    let confirmedRevenue = 0;
    let collectedCash = 0;
    let confirmedUnits = 0;
    let preparingUnits = 0;
    let completedUnits = 0;
    let confirmedOrdersCount = 0;
    let preparingOrdersCount = 0;
    let completedOrdersCount = 0;

    dateAndBranchFilteredBookings.forEach((b) => {
      const orderTotal = Math.max(0, Number(b.total) || 0);
      const units = b.items.reduce((s, it) => s + (it.quantity || 0), 0);

      confirmedRevenue += orderTotal;
      confirmedUnits += units;
      confirmedOrdersCount += 1;
      collectedCash += Math.min(orderTotal, Math.max(0, getCollectedCashForBooking(b)));

      if (b.status === 'done') {
        completedOrdersCount += 1;
        completedUnits += units;
      } else {
        preparingOrdersCount += 1;
        preparingUnits += units;
      }
    });

    confirmedRevenue = round2(confirmedRevenue);
    collectedCash = round2(Math.min(confirmedRevenue, collectedCash));
    const confirmedRemainingBalance = round2(Math.max(0, confirmedRevenue - collectedCash));
    const collectedPct = confirmedRevenue > 0 ? Math.round((collectedCash / confirmedRevenue) * 100) : 0;

    return {
      confirmedRevenue,
      collectedCash,
      confirmedRemainingBalance,
      collectedPct,
      confirmedUnits,
      preparingUnits,
      completedUnits,
      confirmedOrdersCount,
      preparingOrdersCount,
      completedOrdersCount,
    };
  }, [dateAndBranchFilteredBookings]);

  // Section 1B: Product Sales Breakdown (Strictly Paid & Confirmed Orders)
  const productSalesRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        productId: string;
        productName: string;
        sku: string;
        category: string;
        qtySold: number;
        preparingQty: number;
        doneQty: number;
        totalRevenue: number;
        confirmedRevenue: number;
        preparingRevenue: number;
        doneRevenue: number;
        orderIds: Set<string>;
      }
    >();

    dateAndBranchFilteredBookings.forEach((b) => {
      if (salesPaymentFilter === 'preparing' && b.status === 'done') return;
      if (salesPaymentFilter === 'done' && b.status !== 'done') return;

      const isDone = b.status === 'done';

      b.items.forEach((it) => {
        const catProd =
          productById.get(it.productId) ||
          productByName.get((it.productName || '').trim().toLowerCase());
        const key = it.productId || (it.productName || '').trim().toLowerCase();
        const existing = map.get(key) || {
          key,
          productId: it.productId,
          productName: catProd?.name || it.productName,
          sku: catProd?.sku || it.productSku || '—',
          category: catProd?.category || 'Apparel & Gear',
          qtySold: 0,
          preparingQty: 0,
          doneQty: 0,
          totalRevenue: 0,
          confirmedRevenue: 0,
          preparingRevenue: 0,
          doneRevenue: 0,
          orderIds: new Set<string>(),
        };

        const qty = it.quantity || 0;
        const lineTotal = it.totalPrice || qty * (it.unitPrice || 0);
        existing.qtySold += qty;
        existing.totalRevenue += lineTotal;
        existing.confirmedRevenue += lineTotal;
        existing.orderIds.add(b.id);

        if (isDone) {
          existing.doneQty += qty;
          existing.doneRevenue += lineTotal;
        } else {
          existing.preparingQty += qty;
          existing.preparingRevenue += lineTotal;
        }

        map.set(key, existing);
      });
    });

    const q = salesSearch.trim().toLowerCase();
    const list = Array.from(map.values())
      .map((r) => ({
        ...r,
        ordersCount: r.orderIds.size,
        unitPrice: r.qtySold > 0 ? r.totalRevenue / r.qtySold : 0,
      }))
      .filter(
        (r) =>
          !q ||
          r.productName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );

    list.sort((a, b) => {
      let cmp = 0;
      if (salesSortKey === 'revenue') {
        cmp = a.confirmedRevenue - b.confirmedRevenue;
      } else if (salesSortKey === 'qty') {
        cmp = a.qtySold - b.qtySold;
      } else {
        cmp = a.productName.localeCompare(b.productName);
      }
      return salesSortAsc ? cmp : -cmp;
    });

    return list;
  }, [
    dateAndBranchFilteredBookings,
    salesPaymentFilter,
    salesSearch,
    salesSortKey,
    salesSortAsc,
    productById,
    productByName,
  ]);

  const productSalesTotals = useMemo(() => {
    return productSalesRows.reduce(
      (acc, r) => ({
        qty: acc.qty + r.qtySold,
        revenue: acc.revenue + r.totalRevenue,
        confirmedRevenue: acc.confirmedRevenue + r.confirmedRevenue,
        preparingRevenue: acc.preparingRevenue + r.preparingRevenue,
        doneRevenue: acc.doneRevenue + r.doneRevenue,
      }),
      { qty: 0, revenue: 0, confirmedRevenue: 0, preparingRevenue: 0, doneRevenue: 0 }
    );
  }, [productSalesRows]);

  // Section 2A: Top-Selling Products Ranking (strictly paid / deposit-accepted orders only)
  const topSellingProducts = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        category: string;
        qty: number;
        revenue: number;
        orderIds: Set<string>;
      }
    >();

    dateAndBranchFilteredBookings.forEach((b) => {
      if (!isOrderPaidOrConfirmed(b)) return;
      b.items.forEach((it) => {
        const catProd =
          productById.get(it.productId) ||
          productByName.get((it.productName || '').trim().toLowerCase());
        const key = it.productId || (it.productName || '').trim().toLowerCase();
        const curr = map.get(key) || {
          productId: it.productId,
          productName: catProd?.name || it.productName,
          sku: catProd?.sku || it.productSku || '—',
          category: catProd?.category || 'General',
          qty: 0,
          revenue: 0,
          orderIds: new Set<string>(),
        };
        curr.qty += it.quantity || 0;
        curr.revenue += it.totalPrice || (it.quantity || 0) * (it.unitPrice || 0);
        curr.orderIds.add(b.id);
        map.set(key, curr);
      });
    });

    const ranked = Array.from(map.values())
      .map((r) => ({ ...r, ordersCount: r.orderIds.size }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);

    const maxQty = ranked[0]?.qty || 1;
    return ranked.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      sharePct: Math.round((r.qty / maxQty) * 100),
    }));
  }, [dateAndBranchFilteredBookings, productById, productByName]);

  // Section 2B: Most Requested Sizes by Scout Fera2 -> Sized items get individual Top-3 cards; Standard/no-size items group under "Others"
  const branchVariantDemand = useMemo(() => {
    type ProductSizeBucket = {
      productKey: string;
      productName: string;
      category: string;
      group: 'tshirt' | 'amees' | 'other';
      hasSizedVariants: boolean;
      totalUnits: number;
      sizes: Map<string, number>;
    };

    const branches = new Map<
      string,
      {
        branchName: string;
        ordersCount: number;
        totalUnits: number;
        products: Map<string, ProductSizeBucket>;
      }
    >();

    const getOrCreateBranch = (name: string) => {
      const clean = name.trim() || 'Unassigned';
      let entry = branches.get(clean);
      if (!entry) {
        entry = {
          branchName: clean,
          ordersCount: 0,
          totalUnits: 0,
          products: new Map(),
        };
        branches.set(clean, entry);
      }
      return entry;
    };

    dateAndBranchFilteredBookings.forEach((b) => {
      const branch = getOrCreateBranch(resolveBookingBranchName(b));
      branch.ordersCount += 1;

      b.items.forEach((it) => {
        const qty = it.quantity || 0;
        if (qty <= 0) return;
        branch.totalUnits += qty;

        const catProd =
          productById.get(it.productId) ||
          productByName.get((it.productName || '').trim().toLowerCase());
        const group = classifyGarmentGroup(it.productName, catProd);
        const catalogName = (catProd?.name || it.productName || 'Product').trim();
        const prodKey = catProd?.id || catalogName.toLowerCase();
        const size = normalizeSizeLabel(it.size);
        const bookedHasSizedVariant = size !== 'Standard Size';
        const catalogHasSizedVariants = Boolean(
          catProd && catProd.variants.some((v) => normalizeSizeLabel(v.size) !== 'Standard Size')
        );

        let bucket = branch.products.get(prodKey);
        if (!bucket) {
          bucket = {
            productKey: prodKey,
            productName: catalogName,
            category: catProd?.category || (group === 'tshirt' ? 'T-Shirt' : group === 'amees' ? 'Amees' : 'Gear'),
            group,
            hasSizedVariants: bookedHasSizedVariant || catalogHasSizedVariants,
            totalUnits: 0,
            sizes: new Map(),
          };
          branch.products.set(prodKey, bucket);
        } else if (bookedHasSizedVariant || catalogHasSizedVariants) {
          bucket.hasSizedVariants = true;
        }
        bucket.totalUnits += qty;
        bucket.sizes.set(size, (bucket.sizes.get(size) || 0) + qty);
      });
    });

    const sortEntries = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([label, qty]) => ({ label, qty }))
        .sort((a, b) => b.qty - a.qty);

    return Array.from(branches.values())
      .map((br) => {
        const allBuckets = Array.from(br.products.values())
          .map((pb) => ({
            productKey: pb.productKey,
            productName: pb.productName,
            category: pb.category,
            group: pb.group,
            hasSizedVariants: pb.hasSizedVariants,
            totalUnits: pb.totalUnits,
            topSizes: sortEntries(pb.sizes),
          }))
          .sort((a, b) => b.totalUnits - a.totalUnits || a.productName.localeCompare(b.productName));

        const sizedProducts = allBuckets.filter((pb) => pb.hasSizedVariants);
        const otherProducts = allBuckets.filter((pb) => !pb.hasSizedVariants);
        const otherTotalUnits = otherProducts.reduce((sum, pb) => sum + pb.totalUnits, 0);

        return {
          branchName: br.branchName,
          ordersCount: br.ordersCount,
          totalUnits: br.totalUnits,
          productBuckets: allBuckets,
          sizedProducts,
          otherProducts,
          otherTotalUnits,
        };
      })
      .sort((a, b) => {
        const idxA = KNOWN_BRANCHES.indexOf(a.branchName);
        const idxB = KNOWN_BRANCHES.indexOf(b.branchName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b.totalUnits - a.totalUnits;
      });
  }, [dateAndBranchFilteredBookings, productById, productByName]);

  const visibleBranchDemand = useMemo(() => {
    if (selectedDemandBranch === 'All') return branchVariantDemand;
    return branchVariantDemand.filter((b) => b.branchName === selectedDemandBranch);
  }, [branchVariantDemand, selectedDemandBranch]);

  const toggleAggregatorFare2 = (fare2Id: string) => {
    setAggregatorFare2((prev) =>
      prev.includes(fare2Id) ? prev.filter((id) => id !== fare2Id) : [...prev, fare2Id]
    );
  };

  // Bookings filtered specifically for Section 3 (strictly paid/confirmed orders only)
  const aggregatorMatchedBookings = useMemo(() => {
    const effFrom = aggFromDate || fromDate;
    const effTo = aggToDate || toDate;
    const fare2Set = new Set(aggregatorFare2.map((f) => f.toLowerCase()));

    return bookings.filter((b) => {
      if (!isOrderPaidOrConfirmed(b)) return false;

      const orderDay = toOrderDateKey(b.createdAt);
      if (effFrom && orderDay && orderDay < effFrom) return false;
      if (effTo && orderDay && orderDay > effTo) return false;
      if ((effFrom || effTo) && !orderDay) return false;

      const resolvedBranch = resolveBookingBranchName(b);
      if (fare2Set.size > 0) {
        if (!fare2Set.has(resolvedBranch.toLowerCase())) return false;
      } else if (branchFilter !== 'All Branches') {
        if (branchFilter === 'Unassigned') {
          if (resolvedBranch !== 'Unassigned') return false;
        } else if (resolvedBranch.toLowerCase() !== branchFilter.toLowerCase()) {
          return false;
        }
      }

      if (aggregatorFilter === 'preparing' && b.status === 'done') return false;
      if (aggregatorFilter === 'done' && b.status !== 'done') return false;
      return true;
    });
  }, [
    bookings,
    aggFromDate,
    aggToDate,
    fromDate,
    toDate,
    aggregatorFare2,
    branchFilter,
    aggregatorFilter,
  ]);

  // Section 3: Master Production & Procurement Aggregator
  const productionAggregatorRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        productId: string;
        variantId: string;
        productName: string;
        sku: string;
        category: string;
        size: string;
        colorName: string;
        colorHex: string;
        totalNeeded: number;
        confirmedNeeded: number;
        pendingNeeded: number;
        orderNumbers: Set<string>;
      }
    >();

    aggregatorMatchedBookings.forEach((b) => {
      const paid = isOrderPaidOrConfirmed(b);

      b.items.forEach((it) => {
        const sizeLabel = normalizeSizeLabel(it.size);
        const colorName = (it.colorName || 'Standard').trim() || 'Standard';
        const catProd =
          productById.get(it.productId) ||
          productByName.get((it.productName || '').trim().toLowerCase());
        const prodName = catProd?.name || it.productName;
        const groupKey = `${(it.productId || prodName).toLowerCase()}__${sizeLabel.toLowerCase()}__${colorName.toLowerCase()}`;

        const curr = map.get(groupKey) || {
          key: groupKey,
          productId: it.productId,
          variantId: it.variantId,
          productName: prodName,
          sku: catProd?.sku || it.productSku || '—',
          category: catProd?.category || 'Apparel & Gear',
          size: sizeLabel,
          colorName,
          colorHex: it.colorHex || '#94a3b8',
          totalNeeded: 0,
          confirmedNeeded: 0,
          pendingNeeded: 0,
          orderNumbers: new Set<string>(),
        };

        const qty = it.quantity || 0;
        curr.totalNeeded += qty;
        if (paid) curr.confirmedNeeded += qty;
        else curr.pendingNeeded += qty;
        curr.orderNumbers.add(b.bookingNumber);
        map.set(groupKey, curr);
      });
    });

    const rows = Array.from(map.values()).map((row) => {
      const catProd =
        productById.get(row.productId) ||
        productByName.get(row.productName.toLowerCase());
      const matchedVariant =
        catProd?.variants.find((v) => v.id === row.variantId) ||
        catProd?.variants.find(
          (v) =>
            normalizeSizeLabel(v.size).toLowerCase() === row.size.toLowerCase() &&
            (v.colorName || 'Standard').trim().toLowerCase() === row.colorName.toLowerCase()
        );
      const warehouseStock = matchedVariant ? matchedVariant.quantity : 0;
      const netToMake = Math.max(0, row.totalNeeded - warehouseStock);

      return {
        ...row,
        ordersCount: row.orderNumbers.size,
        orderNumbersList: Array.from(row.orderNumbers),
        warehouseStock,
        netToMake,
      };
    });

    const q = aggregatorSearch.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (onlyShortfall && r.netToMake <= 0) return false;
        if (!q) return true;
        return (
          r.productName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.size.toLowerCase().includes(q) ||
          r.colorName.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.totalNeeded - a.totalNeeded || b.netToMake - a.netToMake);
  }, [
    aggregatorMatchedBookings,
    aggregatorSearch,
    onlyShortfall,
    productById,
    productByName,
  ]);

  const aggregatorSummary = useMemo(() => {
    return productionAggregatorRows.reduce(
      (acc, r) => ({
        totalUnits: acc.totalUnits + r.totalNeeded,
        totalStock: acc.totalStock + r.warehouseStock,
        totalDeficit: acc.totalDeficit + r.netToMake,
        deficitVariants: acc.deficitVariants + (r.netToMake > 0 ? 1 : 0),
      }),
      { totalUnits: 0, totalStock: 0, totalDeficit: 0, deficitVariants: 0 }
    );
  }, [productionAggregatorRows]);

  // Excel (.xlsx) Multi-Sheet Export
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const effFrom = aggFromDate || fromDate;
      const effTo = aggToDate || toDate;
      const rangeLabel =
        effFrom || effTo ? `${effFrom || 'Start'}_to_${effTo || 'Today'}` : 'All_Time';
      const statusLabel =
        aggregatorFilter === 'preparing'
          ? 'In_Fulfillment_Paid'
          : aggregatorFilter === 'done'
          ? 'Completed_Paid'
          : 'All_Paid_Orders';

      // Sheet 1: Master Production & Procurement Aggregator
      const prodSheetRows = productionAggregatorRows.map((r) => ({
        'Production Item & Variant': `${r.productName} - ${r.size}${r.colorName && r.colorName !== 'Standard' ? ` (${r.colorName})` : ''}`,
        Product: r.productName,
        SKU: r.sku,
        Category: r.category,
        Size: r.size,
        Color: r.colorName,
        'Total Qty Needed': r.totalNeeded,
        'Paid Orders Qty': r.confirmedNeeded,
        'Live Warehouse Stock': r.warehouseStock,
        'Net To Make / Order (Deficit)': r.netToMake,
        'Contributing Orders': r.ordersCount,
        'Order Numbers': r.orderNumbersList.join(', '),
      }));
      const wsProd = XLSX.utils.json_to_sheet(
        prodSheetRows.length > 0
          ? prodSheetRows
          : [{ Message: 'No production items found for the selected date range & filter.' }]
      );
      wsProd['!cols'] = [
        { wch: 38 },
        { wch: 24 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 16 },
        { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, wsProd, 'Production Aggregator');

      // Sheet 2: Product Sales Breakdown
      const salesSheetRows = productSalesRows.map((r) => ({
        Product: r.productName,
        SKU: r.sku,
        Category: r.category,
        'Paid Qty Sold': r.qtySold,
        'Preparing Qty': r.preparingQty,
        'Completed Qty': r.doneQty,
        'Avg Unit Price (EGP)': Number(r.unitPrice.toFixed(2)),
        'Confirmed Revenue (EGP)': Number(r.confirmedRevenue.toFixed(2)),
        'In Preparation Revenue (EGP)': Number(r.preparingRevenue.toFixed(2)),
        'Completed Revenue (EGP)': Number(r.doneRevenue.toFixed(2)),
        'Orders Count': r.ordersCount,
      }));
      const wsSales = XLSX.utils.json_to_sheet(
        salesSheetRows.length > 0
          ? salesSheetRows
          : [{ Message: 'No paid sales recorded for the selected date range.' }]
      );
      wsSales['!cols'] = [
        { wch: 28 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSales, 'Product Sales');

      // Sheet 3: Most Requested Sizes (Top 3 per Sized Product + Grouped Others per Fare2)
      const branchRows: Array<Record<string, string | number>> = [];
      branchVariantDemand.forEach((br) => {
        br.sizedProducts.forEach((prod) => {
          branchRows.push({
            'Scout Branch (Far3)': br.branchName,
            'Product Name': prod.productName,
            Category: prod.category,
            'Branch Orders': br.ordersCount,
            'Units Demanded': prod.totalUnits,
            'Top 3 Requested Sizes': prod.topSizes
              .slice(0, 3)
              .map((s) => `${s.label} (${s.qty})`)
              .join(', '),
          });
        });
        if (br.otherProducts.length > 0) {
          branchRows.push({
            'Scout Branch (Far3)': br.branchName,
            'Product Name': 'Others (Standard / No-Size Items)',
            Category: 'Others',
            'Branch Orders': br.ordersCount,
            'Units Demanded': br.otherTotalUnits,
            'Top 3 Requested Sizes': br.otherProducts
              .map((op) => `${op.productName} (${op.totalUnits})`)
              .join(', '),
          });
        }
      });
      const wsBranch = XLSX.utils.json_to_sheet(
        branchRows.length > 0
          ? branchRows
          : [{ Message: 'No booked item size demand found for the selected filters.' }]
      );
      wsBranch['!cols'] = [
        { wch: 20 },
        { wch: 26 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
        { wch: 36 },
      ];
      XLSX.utils.book_append_sheet(wb, wsBranch, 'Most Requested Sizes');

      // Sheet 4: Orders Detail (Filtered)
      const orderSheetRows = aggregatorMatchedBookings
        .map((b) => ({
          'Order #': b.bookingNumber,
          Date: toOrderDateKey(b.createdAt),
          'Client Name': b.clientName,
          Phone: b.clientPhone || 'N/A',
          'Scout Fera2 (Far3)': resolveBookingBranchName(b),
          Status: b.status.toUpperCase(),
          'Payment Confirmed': isOrderPaidOrConfirmed(b) ? 'YES' : 'PENDING',
          'Deposit %': b.depositPercentage ?? Math.round((b.depositRate || 0.5) * 100),
          'Total Units': b.items.reduce((s, it) => s + (it.quantity || 0), 0),
          'Total Order Value (EGP)': Number((b.total || 0).toFixed(2)),
          'Cash Collected (EGP)': Number(getCollectedCashForBooking(b).toFixed(2)),
          'Created By': b.createdByName || 'Staff',
        }));
      const wsOrders = XLSX.utils.json_to_sheet(
        orderSheetRows.length > 0
          ? orderSheetRows
          : [{ Message: 'No orders match the selected date range and filter.' }]
      );
      wsOrders['!cols'] = [
        { wch: 16 },
        { wch: 12 },
        { wch: 22 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders Detail');

      const filename = `SPS_Production_Analytics_${rangeLabel}_${statusLabel}.xlsx`;
      XLSX.writeFile(wb, filename);
      onShowToast?.(`Exported "${filename}" with 4 analytics sheets.`);
    } catch (err: any) {
      console.error('Excel export failed:', err);
      onShowToast?.(`Export failed: ${err?.message || 'Unable to generate Excel file.'}`);
    }
  };

  // CSV Export for Production Aggregator
  const handleExportCsv = () => {
    const headers = [
      'Product',
      'SKU',
      'Category',
      'Size',
      'Color',
      'Total Qty Needed',
      'Warehouse Stock',
      'Net To Make',
      'Orders Count',
      'Order Numbers',
    ];
    const escapeCell = (val: string | number) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [
      headers.join(','),
      ...productionAggregatorRows.map((r) =>
        [
          r.productName,
          r.sku,
          r.category,
          r.size,
          r.colorName,
          r.totalNeeded,
          r.warehouseStock,
          r.netToMake,
          r.ordersCount,
          r.orderNumbersList.join(' | '),
        ]
          .map(escapeCell)
          .join(',')
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const effFrom = aggFromDate || fromDate;
    const effTo = aggToDate || toDate;
    const rangeLabel =
      effFrom || effTo ? `${effFrom || 'Start'}_to_${effTo || 'Today'}` : 'All_Time';
    link.href = url;
    link.setAttribute('download', `SPS_Production_Aggregator_${rangeLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast?.('CSV production sheet downloaded.');
  };

  const toggleSort = (key: SalesSortKey) => {
    if (salesSortKey === key) {
      setSalesSortAsc((prev) => !prev);
    } else {
      setSalesSortKey(key);
      setSalesSortAsc(key === 'name');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Date/Branch Filters + Excel Export */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Admin Analytics &amp; Production Dashboard
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Sales KPIs · Scout Branch (Far3) Variant Demand · Master Production Aggregator
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Download Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors min-h-[44px] whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Date Range Presets + Custom Dates + Branch Filter */}
        <div className="pt-3 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7d', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: '30d', label: 'Last 30 Days' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
                  datePreset === preset.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 min-h-[44px]">
              <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 min-h-[44px]">
              <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none w-full"
              />
            </div>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 min-h-[44px]"
            >
              {branchOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 1A: SALES & REVENUE KPIs */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Sales &amp; Revenue Overview</span>
          </h2>
          <span className="text-xs font-mono text-slate-500">
            {fromDate || toDate
              ? `${fromDate || 'Beginning'} → ${toDate || 'Present'}`
              : 'All Recorded Orders'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Confirmed Revenue (Only orders with accepted payment or deposit) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Confirmed Revenue (Payment Accepted)
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {formatCurrency(kpiMetrics.confirmedRevenue)}{' '}
                <span className="text-sm font-bold text-slate-500">EGP</span>
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
                Unpaid orders are excluded until deposit or payment is accepted
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full transition-all"
                  style={{ width: `${kpiMetrics.collectedPct}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase text-emerald-700">
                    Cash Collected ({kpiMetrics.collectedPct}%)
                  </div>
                  <div className="font-mono tabular-nums font-black text-slate-900">
                    {formatCurrency(kpiMetrics.collectedCash)} EGP
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-amber-700">
                    Remaining on Confirmed ({kpiMetrics.confirmedRevenue > 0 ? 100 - kpiMetrics.collectedPct : 0}%)
                  </div>
                  <div className="font-mono tabular-nums font-black text-slate-900">
                    {formatCurrency(kpiMetrics.confirmedRemainingBalance)} EGP
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Confirmed Units Sold */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Confirmed Units Sold
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {kpiMetrics.confirmedUnits.toLocaleString()}{' '}
                <span className="text-sm font-bold text-slate-500">pcs</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Strictly from payment-accepted orders
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase text-blue-700">
                  In Fulfillment
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900">
                  {kpiMetrics.preparingUnits.toLocaleString()} pcs
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-emerald-700">
                  Delivered / Done
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900">
                  {kpiMetrics.completedUnits.toLocaleString()} pcs
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Confirmed Orders Count */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Confirmed Orders
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {kpiMetrics.confirmedOrdersCount.toLocaleString()}{' '}
                <span className="text-sm font-bold text-slate-500">orders</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <span className="font-mono tabular-nums font-bold text-slate-700">
                  {kpiMetrics.completedOrdersCount}
                </span>{' '}
                fully settled &amp; completed
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase text-blue-700">
                  Paid / Preparing
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900">
                  {kpiMetrics.preparingOrdersCount} orders
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-emerald-700">
                  Completed (Done)
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900">
                  {kpiMetrics.completedOrdersCount} orders
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1B: PRODUCT SALES BREAKDOWN TABLE */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Product Sales Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quantity sold, unit price, and confirmed revenue from paid orders only
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Fulfillment Filter (Paid orders only) */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {(
                [
                  { id: 'all', label: 'All Paid Orders' },
                  { id: 'preparing', label: 'In Preparation' },
                  { id: 'done', label: 'Completed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSalesPaymentFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                    salesPaymentFilter === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                placeholder="Filter item or SKU..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-slate-900 min-h-[40px]"
              />
              {salesSearch && (
                <button
                  type="button"
                  onClick={() => setSalesSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {productSalesRows.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
            No product sales match the selected date range and payment filter.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('name')}
                        className="flex items-center gap-1 hover:text-slate-900"
                      >
                        <span>Item Sold</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 font-bold text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('qty')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                      >
                        <span>Qty Sold</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 font-bold text-right">Avg Unit Price</th>
                    <th className="py-3 px-4 font-bold text-right">Preparing / Done</th>
                    <th className="py-3 px-4 font-bold text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('revenue')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                      >
                        <span>Confirmed Revenue</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productSalesRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.productName}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {row.sku} · {row.category} · {row.ordersCount} order{row.ordersCount === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-black text-slate-900">
                        {row.qtySold.toLocaleString()} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(row.unitPrice)} EGP
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[11px]">
                        <span className="text-blue-700 font-bold">
                          {formatCurrency(row.preparingRevenue)}
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-emerald-700 font-bold">
                          {formatCurrency(row.doneRevenue)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-black text-slate-900">
                        {formatCurrency(row.confirmedRevenue)} EGP
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-black text-slate-900">
                  <tr>
                    <td className="py-3 px-4">Total ({productSalesRows.length} items)</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {productSalesRows.reduce((s, r) => s + r.qtySold, 0).toLocaleString()} pcs
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">—</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[11px]">
                      <span className="text-blue-700">
                        {formatCurrency(productSalesTotals.preparingRevenue)}
                      </span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-emerald-700">
                        {formatCurrency(productSalesTotals.doneRevenue)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(productSalesTotals.confirmedRevenue)} EGP
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-2.5">
              {productSalesRows.map((row) => (
                <div
                  key={row.key}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">
                        {row.productName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {row.sku} · {row.category}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums font-black text-sm text-slate-900">
                        {formatCurrency(row.confirmedRevenue)} EGP
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-600">
                        {row.qtySold} pcs @ {formatCurrency(row.unitPrice)}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono tabular-nums">
                    <span className="text-blue-700 font-bold">
                      Preparing: {formatCurrency(row.preparingRevenue)} EGP
                    </span>
                    <span className="text-emerald-700 font-bold">
                      Completed: {formatCurrency(row.doneRevenue)} EGP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* SECTION 2: TOP-SELLING PRODUCTS & BRANCH DEMAND ANALYTICS (FAR3) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top-Selling Products Ranked Leaderboard */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Top-Selling Products</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Ranked by total units demanded</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              Top {Math.min(10, topSellingProducts.length)}
            </span>
          </div>

          {topSellingProducts.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              No product demand recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {topSellingProducts.slice(0, 10).map((item) => (
                <div
                  key={`${item.productId}-${item.productName}`}
                  className="p-3 rounded-xl border border-slate-200 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0 ${
                          item.rank === 1
                            ? 'bg-amber-500 text-slate-950'
                            : item.rank <= 3
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.productName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {item.category} · {item.ordersCount} order{item.ordersCount === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black font-mono tabular-nums text-slate-900">
                        {item.qty.toLocaleString()} pcs
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        {formatCurrency(item.revenue)} EGP
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full"
                      style={{ width: `${item.sharePct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Requested Sizes (Connected to Bookings -> Every Product & Top 3 Sizes per Color-Coded Scout Fera2) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Most Requested Sizes</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Connected directly to Bookings — Top 3 sizes purchased per catalog item for each Scout Fera2
              </p>
            </div>
          </div>

          {/* Branch Filter Strip (Color-Coded) */}
          {branchVariantDemand.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedDemandBranch('All')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 min-h-[36px] border transition-colors ${
                  selectedDemandBranch === 'All'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
              >
                All Branches ({branchVariantDemand.length})
              </button>
              {branchVariantDemand.map((br) => {
                const fm = getScoutFare2Meta(br.branchName);
                const isSelected = selectedDemandBranch === br.branchName;
                return (
                  <button
                    key={br.branchName}
                    type="button"
                    onClick={() => setSelectedDemandBranch(br.branchName)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 min-h-[36px] border transition-colors ${
                      isSelected
                        ? fm
                          ? fm.activeButtonClass
                          : 'bg-slate-900 border-slate-900 text-white'
                        : fm
                        ? fm.chipClass
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    }`}
                  >
                    {fm && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSelected ? 'bg-white' : fm.dotClass
                        }`}
                      />
                    )}
                    <span>
                      {br.branchName} ({br.totalUnits})
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {visibleBranchDemand.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              No branch orders match the selected date range.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[680px] overflow-y-auto pr-1">
              {visibleBranchDemand.map((br) => {
                const fm = getScoutFare2Meta(br.branchName);
                return (
                  <div
                    key={br.branchName}
                    style={
                      fm
                        ? { borderLeftWidth: '4px', borderLeftColor: fm.hex }
                        : undefined
                    }
                    className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {fm && (
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${fm.dotClass}`}
                            />
                          )}
                          <h3 className="text-sm sm:text-base font-black text-slate-900">
                            {br.branchName}
                          </h3>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {br.ordersCount} order{br.ordersCount === 1 ? '' : 's'} · {br.totalUnits} total pcs
                        </div>
                      </div>
                      {(br.sizedProducts.length > 0 || br.otherProducts.length > 0) && (
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                          {br.sizedProducts.map((pb, idx) => (
                            <React.Fragment key={pb.productKey}>
                              {idx > 0 && <span className="text-slate-300">|</span>}
                              <span
                                className="font-bold"
                                style={{ color: fm?.hex || '#0f172a' }}
                              >
                                {pb.productName}: {pb.totalUnits}
                              </span>
                            </React.Fragment>
                          ))}
                          {br.otherProducts.length > 0 && (
                            <>
                              {br.sizedProducts.length > 0 && (
                                <span className="text-slate-300">|</span>
                              )}
                              <span className="font-bold text-slate-600">
                                Others: {br.otherTotalUnits}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {br.productBuckets.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No booked items recorded for this branch yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Individual cards for products with size variants (Chemise, T-Shirt, etc.) */}
                        {br.sizedProducts.map((prod) => (
                          <div
                            key={prod.productKey}
                            className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 min-w-0">
                                <Shirt
                                  className="w-3.5 h-3.5 shrink-0"
                                  style={{ color: fm?.hex || '#475569' }}
                                />
                                <span className="truncate">{prod.productName}</span>
                              </span>
                              <span
                                className="font-mono tabular-nums text-xs font-black shrink-0"
                                style={{ color: fm?.hex || '#0f172a' }}
                              >
                                {prod.totalUnits} pcs
                              </span>
                            </div>

                            <div className="space-y-2 text-[11px]">
                              <div>
                                <div className="font-bold text-slate-500 uppercase text-[10px]">
                                  Top 3 Sizes
                                </div>
                                <div className="mt-1.5 space-y-1.5">
                                  {prod.topSizes.slice(0, 3).map((sz, idx) => (
                                    <div
                                      key={sz.label}
                                      className="flex justify-between items-center font-mono tabular-nums"
                                    >
                                      <span className="text-slate-800 font-semibold flex items-center gap-1.5">
                                        <span
                                          className={`text-[10px] font-black border px-1.5 py-0.5 rounded ${
                                            fm
                                              ? fm.chipClass
                                              : 'text-slate-700 bg-slate-100 border-slate-200'
                                          }`}
                                        >
                                          #{idx + 1}
                                        </span>
                                        <span>{sz.label}</span>
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {sz.qty} pcs ({Math.round((sz.qty / prod.totalUnits) * 100)}%)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Grouped "Others" card (Box Icon) for items with no size / Standard Size */}
                        {br.otherProducts.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 min-w-0">
                                <Package
                                  className="w-3.5 h-3.5 shrink-0"
                                  style={{ color: fm?.hex || '#475569' }}
                                />
                                <span className="truncate">Others</span>
                              </span>
                              <span
                                className="font-mono tabular-nums text-xs font-black shrink-0"
                                style={{ color: fm?.hex || '#0f172a' }}
                              >
                                {br.otherTotalUnits} pcs
                              </span>
                            </div>

                            <div className="space-y-1.5 text-[11px]">
                              <div className="font-bold text-slate-500 uppercase text-[10px]">
                                Standard / No-Size Items
                              </div>
                              <div className="space-y-1.5">
                                {br.otherProducts.map((op) => (
                                  <div
                                    key={op.productKey}
                                    className="flex justify-between items-center gap-2 font-mono tabular-nums"
                                  >
                                    <span className="text-slate-800 font-semibold font-sans truncate">
                                      {op.productName}
                                    </span>
                                    <span className="font-bold text-slate-900 shrink-0">
                                      {op.totalUnits} pcs
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3: MASTER PRODUCTION & PROCUREMENT AGGREGATOR ("What I Need to Make/Order") */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Factory className="w-5 h-5 text-slate-900" />
              <span>Master Production &amp; Procurement Aggregator</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregates all matching orders across users by Product + Size + Color so you know exact manufacturing &amp; restocking quantities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 min-h-[42px] whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Download Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Aggregator Filter Toggle & Controls */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          {/* Row 1: Payment Status + Deficit Toggle + Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All Paid Orders' },
                  { id: 'preparing', label: 'Paid · In Fulfillment' },
                  { id: 'done', label: 'Paid · Completed' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAggregatorFilter(opt.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                    aggregatorFilter === opt.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyShortfall((prev) => !prev)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors min-h-[40px] whitespace-nowrap shrink-0 ${
                  onlyShortfall
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {onlyShortfall ? 'Showing Deficit Only' : 'Deficit / To Make Only'}
              </button>

              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={aggregatorSearch}
                  onChange={(e) => setAggregatorSearch(e.target.value)}
                  placeholder="Search variant, size or color..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-slate-900 min-h-[40px]"
                />
                {aggregatorSearch && (
                  <button
                    type="button"
                    onClick={() => setAggregatorSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Multi-Select Scout Fera2 Filter (Pick 1, 2, or more from the 6 teams) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              Scout Fera2:
            </span>
            <button
              type="button"
              onClick={() => setAggregatorFare2([])}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 min-h-[34px] cursor-pointer ${
                aggregatorFare2.length === 0
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Fera2
            </button>
            {SCOUT_FERA2_LIST.map((f) => {
              const isSelected = aggregatorFare2.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleAggregatorFare2(f.id)}
                  title={`${f.label} — click to select one or multiple Fera2`}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 min-h-[34px] flex items-center gap-1.5 cursor-pointer ${
                    isSelected ? f.activeButtonClass : f.chipClass
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isSelected ? 'bg-white' : f.dotClass
                    }`}
                  />
                  <span>{f.label}</span>
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => toggleAggregatorFare2('Afrad')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 min-h-[34px] flex items-center gap-1.5 cursor-pointer ${
                aggregatorFare2.includes('Afrad')
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <span>Afrad</span>
              {aggregatorFare2.includes('Afrad') && <Check className="w-3 h-3 shrink-0" />}
            </button>
          </div>

          {/* Row 3: Dedicated Date Range Filter (From Date -> To Date) */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Order Date Range:</span>
              </span>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[38px]">
                <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">From</span>
                <input
                  type="date"
                  value={aggFromDate}
                  onChange={(e) => setAggFromDate(e.target.value)}
                  aria-label="Aggregator From Date"
                  className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[38px]">
                <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">To</span>
                <input
                  type="date"
                  value={aggToDate}
                  onChange={(e) => setAggToDate(e.target.value)}
                  aria-label="Aggregator To Date"
                  className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>

              {(aggregatorFare2.length > 0 || aggFromDate || aggToDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setAggregatorFare2([]);
                    setAggFromDate('');
                    setAggToDate('');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 min-h-[38px] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Aggregator Filters</span>
                </button>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-500">
              Matching <strong className="text-slate-900">{aggregatorMatchedBookings.length}</strong> order
              {aggregatorMatchedBookings.length === 1 ? '' : 's'}
              {aggregatorFare2.length > 0 ? ` · ${aggregatorFare2.join(', ')}` : ''}
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase text-slate-500">Distinct Variants</div>
            <div className="text-lg font-black font-mono tabular-nums text-slate-900 mt-0.5">
              {productionAggregatorRows.length}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase text-slate-500">Total Qty Needed</div>
            <div className="text-lg font-black font-mono tabular-nums text-slate-900 mt-0.5">
              {aggregatorSummary.totalUnits.toLocaleString()} units
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase text-slate-500">Matched Live Stock</div>
            <div className="text-lg font-black font-mono tabular-nums text-emerald-700 mt-0.5">
              {aggregatorSummary.totalStock.toLocaleString()} units
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
            <div className="text-[10px] font-bold uppercase text-rose-700">
              Net To Make / Order
            </div>
            <div className="text-lg font-black font-mono tabular-nums text-rose-700 mt-0.5">
              {aggregatorSummary.totalDeficit.toLocaleString()} units
            </div>
          </div>
        </div>

        {productionAggregatorRows.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
            No variants match the selected production filter and date range.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Product + Variant</th>
                    <th className="py-3 px-4 font-bold">Color &amp; Size</th>
                    <th className="py-3 px-4 font-bold text-right">Total Qty Needed</th>
                    <th className="py-3 px-4 font-bold text-right">Warehouse Stock</th>
                    <th className="py-3 px-4 font-bold text-right">To Make / Order</th>
                    <th className="py-3 px-4 font-bold text-right">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionAggregatorRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {row.productName} - {row.size === 'Standard Size' ? 'Standard Size' : `Size ${row.size}`}
                          {row.colorName && row.colorName !== 'Standard' ? ` (${row.colorName})` : ''}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {row.sku} · {row.category}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                            style={{ backgroundColor: row.colorHex }}
                          />
                          <span>{row.colorName}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono font-bold text-slate-900">{row.size}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-black text-slate-900">
                        {row.totalNeeded.toLocaleString()} units
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-700">
                        {row.warehouseStock.toLocaleString()} units
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {row.netToMake > 0 ? (
                          <span className="font-black text-rose-700">
                            {row.netToMake.toLocaleString()} units deficit
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Covered</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {row.ordersCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2.5">
              {productionAggregatorRows.map((row) => (
                <div
                  key={row.key}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900">
                        {row.productName} - {row.size === 'Standard Size' ? 'Standard Size' : `Size ${row.size}`}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: row.colorHex }}
                        />
                        <span>{row.colorName}</span>
                        <span>·</span>
                        <span className="font-mono">{row.ordersCount} order{row.ordersCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums font-black text-sm text-slate-900">
                        {row.totalNeeded.toLocaleString()} units
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        Stock: {row.warehouseStock.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-slate-500">Net To Make:</span>
                    {row.netToMake > 0 ? (
                      <span className="font-black text-rose-700">
                        {row.netToMake.toLocaleString()} units needed
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Covered in stock</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
