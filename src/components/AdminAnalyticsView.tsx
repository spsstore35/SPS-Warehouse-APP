import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Booking, Product, User } from '../types/inventory';
import { isUserAdmin } from '../utils/security';
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
  Users,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  X,
} from 'lucide-react';

interface AdminAnalyticsViewProps {
  bookings: Booking[];
  products: Product[];
  currentUser: User;
  onShowToast?: (message: string) => void;
}

type DatePreset = 'all' | 'today' | '7d' | 'month' | '30d' | 'custom';
type SalesPaymentFilter = 'all' | 'paid' | 'pending';
type AggregatorFilter = 'all' | 'paid' | 'pending_fulfillment';
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

const isOrderPaidOrConfirmed = (b: Booking): boolean =>
  Boolean(b.depositPaid || b.status !== 'pending');

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
  onShowToast,
}) => {
  const isAdmin = isUserAdmin(currentUser);

  // Global Date Range & Branch Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('All Branches');

  // Section 1B: Product Sales Filters
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<SalesPaymentFilter>('all');
  const [salesSearch, setSalesSearch] = useState<string>('');
  const [salesSortKey, setSalesSortKey] = useState<SalesSortKey>('revenue');
  const [salesSortAsc, setSalesSortAsc] = useState<boolean>(false);

  // Section 2: Branch Filter inside Branch Demand
  const [selectedDemandBranch, setSelectedDemandBranch] = useState<string>('All');

  // Section 3: Production Aggregator Filters
  const [aggregatorFilter, setAggregatorFilter] = useState<AggregatorFilter>('all');
  const [aggregatorSearch, setAggregatorSearch] = useState<string>('');
  const [onlyShortfall, setOnlyShortfall] = useState<boolean>(false);

  // Strict RBAC guard
  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg mx-auto my-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Admin Access Required</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          The Admin Analytics &amp; Production Dashboard is restricted exclusively to Administrator accounts.
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

  // All unique branch options
  const branchOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_BRANCHES);
    bookings.forEach((b) => {
      const grp = (b.troopGroup || '').trim();
      if (grp) set.add(grp);
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

  // Filter Bookings by Date Range + Branch
  const dateAndBranchFilteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const orderDay = toOrderDateKey(b.createdAt);
      if (fromDate && orderDay && orderDay < fromDate) return false;
      if (toDate && orderDay && orderDay > toDate) return false;
      if ((fromDate || toDate) && !orderDay) return false;

      if (branchFilter !== 'All Branches') {
        const bGroup = (b.troopGroup || '').trim();
        if (branchFilter === 'Unassigned') {
          if (bGroup) return false;
        } else if (bGroup.toLowerCase() !== branchFilter.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [bookings, fromDate, toDate, branchFilter]);

  // Section 1A: KPI Metrics
  const kpiMetrics = useMemo(() => {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    let totalRevenue = 0;
    let confirmedRevenue = 0;
    let pendingRevenue = 0;
    let collectedCash = 0;
    let totalUnitsSold = 0;
    let confirmedUnits = 0;
    let pendingUnits = 0;
    let confirmedOrdersCount = 0;
    let pendingOrdersCount = 0;
    let completedOrdersCount = 0;

    dateAndBranchFilteredBookings.forEach((b) => {
      const paid = isOrderPaidOrConfirmed(b);
      const orderTotal = Math.max(0, Number(b.total) || 0);
      const units = b.items.reduce((s, it) => s + (it.quantity || 0), 0);
      totalRevenue += orderTotal;
      totalUnitsSold += units;

      if (paid) {
        confirmedRevenue += orderTotal;
        confirmedUnits += units;
        confirmedOrdersCount += 1;
        collectedCash += Math.min(orderTotal, Math.max(0, getCollectedCashForBooking(b)));
      } else {
        pendingRevenue += orderTotal;
        pendingUnits += units;
        pendingOrdersCount += 1;
      }

      if (b.status === 'done') {
        completedOrdersCount += 1;
      }
    });

    totalRevenue = round2(totalRevenue);
    confirmedRevenue = round2(confirmedRevenue);
    pendingRevenue = round2(pendingRevenue);
    collectedCash = round2(Math.min(totalRevenue, collectedCash));
    const receivableBalance = round2(Math.max(0, totalRevenue - collectedCash));
    const confirmedRemainingBalance = round2(Math.max(0, confirmedRevenue - collectedCash));
    const collectedPct = totalRevenue > 0 ? Math.round((collectedCash / totalRevenue) * 100) : 0;

    return {
      totalRevenue,
      confirmedRevenue,
      pendingRevenue,
      collectedCash,
      receivableBalance,
      confirmedRemainingBalance,
      collectedPct,
      totalUnitsSold,
      confirmedUnits,
      pendingUnits,
      totalOrders: dateAndBranchFilteredBookings.length,
      confirmedOrdersCount,
      pendingOrdersCount,
      completedOrdersCount,
    };
  }, [dateAndBranchFilteredBookings]);

  // Section 1B: Product Sales Breakdown (with Sales Payment Filter)
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
        confirmedQty: number;
        pendingQty: number;
        totalRevenue: number;
        confirmedRevenue: number;
        pendingRevenue: number;
        orderIds: Set<string>;
      }
    >();

    dateAndBranchFilteredBookings.forEach((b) => {
      const paid = isOrderPaidOrConfirmed(b);
      if (salesPaymentFilter === 'paid' && !paid) return;
      if (salesPaymentFilter === 'pending' && paid) return;

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
          confirmedQty: 0,
          pendingQty: 0,
          totalRevenue: 0,
          confirmedRevenue: 0,
          pendingRevenue: 0,
          orderIds: new Set<string>(),
        };

        const qty = it.quantity || 0;
        const lineTotal = it.totalPrice || qty * (it.unitPrice || 0);
        existing.qtySold += qty;
        existing.totalRevenue += lineTotal;
        existing.orderIds.add(b.id);

        if (paid) {
          existing.confirmedQty += qty;
          existing.confirmedRevenue += lineTotal;
        } else {
          existing.pendingQty += qty;
          existing.pendingRevenue += lineTotal;
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
      if (salesSortKey === 'revenue') cmp = a.totalRevenue - b.totalRevenue;
      else if (salesSortKey === 'qty') cmp = a.qtySold - b.qtySold;
      else cmp = a.productName.localeCompare(b.productName);
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
        pendingRevenue: acc.pendingRevenue + r.pendingRevenue,
      }),
      { qty: 0, revenue: 0, confirmedRevenue: 0, pendingRevenue: 0 }
    );
  }, [productSalesRows]);

  // Section 2A: Top-Selling Products Ranking (across all date/branch-filtered orders)
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

  // Section 2B: Branch-Level Variant Breakdown (Far3 -> T-Shirts & Amees)
  const branchVariantDemand = useMemo(() => {
    type Bucket = {
      totalUnits: number;
      sizes: Map<string, number>;
      colors: Map<string, { qty: number; hex: string }>;
      types: Map<string, number>;
    };
    const makeBucket = (): Bucket => ({
      totalUnits: 0,
      sizes: new Map(),
      colors: new Map(),
      types: new Map(),
    });

    const branches = new Map<
      string,
      {
        branchName: string;
        ordersCount: number;
        totalUnits: number;
        tshirt: Bucket;
        amees: Bucket;
        otherUnits: number;
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
          tshirt: makeBucket(),
          amees: makeBucket(),
          otherUnits: 0,
        };
        branches.set(clean, entry);
      }
      return entry;
    };

    dateAndBranchFilteredBookings.forEach((b) => {
      const branch = getOrCreateBranch(b.troopGroup || 'Unassigned');
      branch.ordersCount += 1;

      b.items.forEach((it) => {
        const qty = it.quantity || 0;
        if (qty <= 0) return;
        branch.totalUnits += qty;

        const catProd =
          productById.get(it.productId) ||
          productByName.get((it.productName || '').trim().toLowerCase());
        const group = classifyGarmentGroup(it.productName, catProd);

        if (group === 'tshirt' || group === 'amees') {
          const target = group === 'tshirt' ? branch.tshirt : branch.amees;
          target.totalUnits += qty;

          const size = normalizeSizeLabel(it.size);
          target.sizes.set(size, (target.sizes.get(size) || 0) + qty);

          const colorName = (it.colorName || 'Standard').trim() || 'Standard';
          const prevColor = target.colors.get(colorName) || {
            qty: 0,
            hex: it.colorHex || '#94a3b8',
          };
          target.colors.set(colorName, {
            qty: prevColor.qty + qty,
            hex: prevColor.hex || it.colorHex || '#94a3b8',
          });

          const typeName = catProd?.name || it.productName;
          target.types.set(typeName, (target.types.get(typeName) || 0) + qty);
        } else {
          branch.otherUnits += qty;
        }
      });
    });

    const sortEntries = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([label, qty]) => ({ label, qty }))
        .sort((a, b) => b.qty - a.qty);

    const sortColors = (m: Map<string, { qty: number; hex: string }>) =>
      Array.from(m.entries())
        .map(([label, val]) => ({ label, qty: val.qty, hex: val.hex }))
        .sort((a, b) => b.qty - a.qty);

    return Array.from(branches.values())
      .map((br) => ({
        branchName: br.branchName,
        ordersCount: br.ordersCount,
        totalUnits: br.totalUnits,
        otherUnits: br.otherUnits,
        tshirt: {
          totalUnits: br.tshirt.totalUnits,
          topSizes: sortEntries(br.tshirt.sizes),
          topColors: sortColors(br.tshirt.colors),
          topTypes: sortEntries(br.tshirt.types),
        },
        amees: {
          totalUnits: br.amees.totalUnits,
          topSizes: sortEntries(br.amees.sizes),
          topColors: sortColors(br.amees.colors),
          topTypes: sortEntries(br.amees.types),
        },
      }))
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

    dateAndBranchFilteredBookings.forEach((b) => {
      const paid = isOrderPaidOrConfirmed(b);
      if (aggregatorFilter === 'paid' && !paid) return;
      if (aggregatorFilter === 'pending_fulfillment') {
        if (b.status !== 'pending' && b.status !== 'preparing') return;
      }

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
    dateAndBranchFilteredBookings,
    aggregatorFilter,
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
      const rangeLabel =
        fromDate || toDate ? `${fromDate || 'Start'}_to_${toDate || 'Today'}` : 'All_Time';
      const statusLabel =
        aggregatorFilter === 'paid'
          ? 'Paid_Confirmed_Only'
          : aggregatorFilter === 'pending_fulfillment'
          ? 'Pending_Fulfillment'
          : 'All_Orders';

      // Sheet 1: Master Production & Procurement Aggregator
      const prodSheetRows = productionAggregatorRows.map((r) => ({
        'Production Item & Variant': `${r.productName} - ${r.size}${r.colorName && r.colorName !== 'Standard' ? ` (${r.colorName})` : ''}`,
        Product: r.productName,
        SKU: r.sku,
        Category: r.category,
        Size: r.size,
        Color: r.colorName,
        'Total Qty Needed': r.totalNeeded,
        'Confirmed Orders Qty': r.confirmedNeeded,
        'Pending Payment Qty': r.pendingNeeded,
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
        'Total Qty Sold': r.qtySold,
        'Confirmed Qty': r.confirmedQty,
        'Pending Qty': r.pendingQty,
        'Avg Unit Price (EGP)': Number(r.unitPrice.toFixed(2)),
        'Total Revenue (EGP)': Number(r.totalRevenue.toFixed(2)),
        'Confirmed Revenue (EGP)': Number(r.confirmedRevenue.toFixed(2)),
        'Pending Revenue (EGP)': Number(r.pendingRevenue.toFixed(2)),
        'Orders Count': r.ordersCount,
      }));
      const wsSales = XLSX.utils.json_to_sheet(
        salesSheetRows.length > 0
          ? salesSheetRows
          : [{ Message: 'No sales recorded for the selected date range.' }]
      );
      wsSales['!cols'] = [
        { wch: 28 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 20 },
        { wch: 22 },
        { wch: 20 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSales, 'Product Sales');

      // Sheet 3: Branch-Level Variant Demand (Far3)
      const branchRows: Array<Record<string, string | number>> = [];
      branchVariantDemand.forEach((br) => {
        if (br.tshirt.totalUnits > 0) {
          branchRows.push({
            'Scout Branch (Far3)': br.branchName,
            'Garment Group': 'T-Shirts',
            'Branch Orders': br.ordersCount,
            'Group Units Demanded': br.tshirt.totalUnits,
            'Top Requested Sizes': br.tshirt.topSizes.map((s) => `${s.label} (${s.qty})`).join(', '),
            'Top Requested Colors': br.tshirt.topColors.map((c) => `${c.label} (${c.qty})`).join(', '),
            'Top Models / Types': br.tshirt.topTypes.map((t) => `${t.label} (${t.qty})`).join(', '),
          });
        }
        if (br.amees.totalUnits > 0) {
          branchRows.push({
            'Scout Branch (Far3)': br.branchName,
            'Garment Group': 'Uniform Shirts (Amees)',
            'Branch Orders': br.ordersCount,
            'Group Units Demanded': br.amees.totalUnits,
            'Top Requested Sizes': br.amees.topSizes.map((s) => `${s.label} (${s.qty})`).join(', '),
            'Top Requested Colors': br.amees.topColors.map((c) => `${c.label} (${c.qty})`).join(', '),
            'Top Models / Types': br.amees.topTypes.map((t) => `${t.label} (${t.qty})`).join(', '),
          });
        }
      });
      const wsBranch = XLSX.utils.json_to_sheet(
        branchRows.length > 0
          ? branchRows
          : [{ Message: 'No T-Shirt or Amees branch demand found for the selected filters.' }]
      );
      wsBranch['!cols'] = [
        { wch: 20 },
        { wch: 24 },
        { wch: 14 },
        { wch: 20 },
        { wch: 34 },
        { wch: 28 },
        { wch: 36 },
      ];
      XLSX.utils.book_append_sheet(wb, wsBranch, 'Branch Variant Demand');

      // Sheet 4: Orders Detail (Filtered)
      const orderSheetRows = dateAndBranchFilteredBookings
        .filter((b) => {
          if (aggregatorFilter === 'paid') return isOrderPaidOrConfirmed(b);
          if (aggregatorFilter === 'pending_fulfillment') {
            return b.status === 'pending' || b.status === 'preparing';
          }
          return true;
        })
        .map((b) => ({
          'Order #': b.bookingNumber,
          Date: toOrderDateKey(b.createdAt),
          'Client Name': b.clientName,
          Phone: b.clientPhone || 'N/A',
          'Scout Branch (Far3)': b.troopGroup || 'Unassigned',
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
    const rangeLabel =
      fromDate || toDate ? `${fromDate || 'Start'}_to_${toDate || 'Today'}` : 'All_Time';
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
          {/* Card 1: Total Revenue (Cash Collected vs Receivable = Total Revenue) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Revenue (Order Value)
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {formatCurrency(kpiMetrics.totalRevenue)}{' '}
                <span className="text-sm font-bold text-slate-500">EGP</span>
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
                Confirmed Orders: <strong className="text-slate-800">{formatCurrency(kpiMetrics.confirmedRevenue)} EGP</strong>
                {' · '}
                Awaiting Deposit: <strong className="text-amber-700">{formatCurrency(kpiMetrics.pendingRevenue)} EGP</strong>
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
                    Receivable ({100 - kpiMetrics.collectedPct}%)
                  </div>
                  <div className="font-mono tabular-nums font-black text-slate-900">
                    {formatCurrency(kpiMetrics.receivableBalance)} EGP
                  </div>
                  {kpiMetrics.confirmedRemainingBalance > 0 && (
                    <div className="text-[10px] font-mono tabular-nums text-slate-500">
                      {formatCurrency(kpiMetrics.pendingRevenue)} + {formatCurrency(kpiMetrics.confirmedRemainingBalance)} bal.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Total Units Sold */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Units Sold
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {kpiMetrics.totalUnitsSold.toLocaleString()}{' '}
                <span className="text-sm font-bold text-slate-500">pcs</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Across all matching client quotations &amp; orders
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase text-emerald-700">
                  Confirmed Units
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900">
                  {kpiMetrics.confirmedUnits.toLocaleString()} pcs
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-amber-700">
                  Pending Units
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900">
                  {kpiMetrics.pendingUnits.toLocaleString()} pcs
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Total Orders Count */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Orders Count
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {kpiMetrics.totalOrders.toLocaleString()}{' '}
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
                <div className="text-[10px] font-bold uppercase text-emerald-700">
                  Paid / Preparing
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900">
                  {kpiMetrics.confirmedOrdersCount} orders
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-amber-700">
                  Awaiting Deposit
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900">
                  {kpiMetrics.pendingOrdersCount} orders
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
              Quantity sold, unit price, and total revenue per catalog item
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Status Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'paid', label: 'Paid & Confirmed' },
                  { id: 'pending', label: 'Pending Payment' },
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
                    <th className="py-3 px-4 font-bold text-right">Paid vs Pending</th>
                    <th className="py-3 px-4 font-bold text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('revenue')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                      >
                        <span>Total Revenue</span>
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
                        <span className="text-emerald-700 font-bold">
                          {formatCurrency(row.confirmedRevenue)}
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-amber-700 font-bold">
                          {formatCurrency(row.pendingRevenue)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-black text-slate-900">
                        {formatCurrency(row.totalRevenue)} EGP
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-black text-slate-900">
                  <tr>
                    <td className="py-3 px-4">Total ({productSalesRows.length} items)</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {productSalesTotals.qty.toLocaleString()} pcs
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">—</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[11px]">
                      <span className="text-emerald-700">
                        {formatCurrency(productSalesTotals.confirmedRevenue)}
                      </span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-amber-700">
                        {formatCurrency(productSalesTotals.pendingRevenue)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(productSalesTotals.revenue)} EGP
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
                        {formatCurrency(row.totalRevenue)} EGP
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-600">
                        {row.qtySold} pcs @ {formatCurrency(row.unitPrice)}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono tabular-nums">
                    <span className="text-emerald-700 font-bold">
                      Paid: {formatCurrency(row.confirmedRevenue)} EGP
                    </span>
                    <span className="text-amber-700 font-bold">
                      Pending: {formatCurrency(row.pendingRevenue)} EGP
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

        {/* Branch-Level Variant Breakdown (Far3 -> T-Shirts & Amees) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Branch-Level Variant Demand (Far3)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Most requested Sizes, Colors &amp; Types for <strong>T-Shirts</strong> and{' '}
                <strong>Uniform Shirts (Amees)</strong> per branch
              </p>
            </div>
          </div>

          {/* Branch Filter Strip */}
          {branchVariantDemand.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedDemandBranch('All')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                  selectedDemandBranch === 'All'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                All Branches ({branchVariantDemand.length})
              </button>
              {branchVariantDemand.map((br) => (
                <button
                  key={br.branchName}
                  type="button"
                  onClick={() => setSelectedDemandBranch(br.branchName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                    selectedDemandBranch === br.branchName
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {br.branchName} ({br.totalUnits})
                </button>
              ))}
            </div>
          )}

          {visibleBranchDemand.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              No branch orders match the selected date range.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[680px] overflow-y-auto pr-1">
              {visibleBranchDemand.map((br) => (
                <div
                  key={br.branchName}
                  className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900">
                        {br.branchName}
                      </h3>
                      <div className="text-[11px] font-mono text-slate-500">
                        {br.ordersCount} order{br.ordersCount === 1 ? '' : 's'} · {br.totalUnits} total pcs
                        {br.otherUnits > 0 ? ` (${br.otherUnits} other gear pcs)` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                      <span className="font-bold text-blue-700">
                        T-Shirts: {br.tshirt.totalUnits}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="font-bold text-amber-800">
                        Amees: {br.amees.totalUnits}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* T-SHIRTS COLUMN */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <Shirt className="w-3.5 h-3.5 text-blue-600" />
                          <span>T-Shirts</span>
                        </span>
                        <span className="font-mono tabular-nums text-xs font-black text-blue-700">
                          {br.tshirt.totalUnits} pcs
                        </span>
                      </div>

                      {br.tshirt.totalUnits === 0 ? (
                        <p className="text-[11px] text-slate-400">No T-shirt orders yet.</p>
                      ) : (
                        <div className="space-y-2 text-[11px]">
                          <div>
                            <div className="font-bold text-slate-500 uppercase text-[10px]">
                              Top Sizes
                            </div>
                            <div className="mt-1 space-y-1">
                              {br.tshirt.topSizes.slice(0, 4).map((sz) => (
                                <div key={sz.label} className="flex justify-between font-mono tabular-nums">
                                  <span className="text-slate-800 font-semibold">{sz.label}</span>
                                  <span className="font-bold text-slate-900">
                                    {sz.qty} pcs ({Math.round((sz.qty / br.tshirt.totalUnits) * 100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-100">
                            <div className="font-bold text-slate-500 uppercase text-[10px]">
                              Top Colors
                            </div>
                            <div className="mt-1 space-y-1">
                              {br.tshirt.topColors.slice(0, 3).map((col) => (
                                <div key={col.label} className="flex items-center justify-between font-mono tabular-nums">
                                  <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                                      style={{ backgroundColor: col.hex }}
                                    />
                                    <span>{col.label}</span>
                                  </span>
                                  <span className="font-bold text-slate-900">{col.qty} pcs</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-100">
                            <div className="font-bold text-slate-500 uppercase text-[10px]">
                              Top Types
                            </div>
                            <div className="mt-1 space-y-1">
                              {br.tshirt.topTypes.slice(0, 2).map((tp) => (
                                <div key={tp.label} className="flex justify-between gap-2">
                                  <span className="text-slate-700 truncate">{tp.label}</span>
                                  <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                                    {tp.qty}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* UNIFORM SHIRTS (AMEES) COLUMN */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <Shirt className="w-3.5 h-3.5 text-amber-600" />
                          <span>Uniform Shirts (Amees)</span>
                        </span>
                        <span className="font-mono tabular-nums text-xs font-black text-amber-800">
                          {br.amees.totalUnits} pcs
                        </span>
                      </div>

                      {br.amees.totalUnits === 0 ? (
                        <p className="text-[11px] text-slate-400">No Amees shirt orders yet.</p>
                      ) : (
                        <div className="space-y-2 text-[11px]">
                          <div>
                            <div className="font-bold text-slate-500 uppercase text-[10px]">
                              Top Sizes
                            </div>
                            <div className="mt-1 space-y-1">
                              {br.amees.topSizes.slice(0, 4).map((sz) => (
                                <div key={sz.label} className="flex justify-between font-mono tabular-nums">
                                  <span className="text-slate-800 font-semibold">{sz.label}</span>
                                  <span className="font-bold text-slate-900">
                                    {sz.qty} pcs ({Math.round((sz.qty / br.amees.totalUnits) * 100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-100">
                            <div className="font-bold text-slate-500 uppercase text-[10px]">
                              Top Colors
                            </div>
                            <div className="mt-1 space-y-1">
                              {br.amees.topColors.slice(0, 3).map((col) => (
                                <div key={col.label} className="flex items-center justify-between font-mono tabular-nums">
                                  <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                                      style={{ backgroundColor: col.hex }}
                                    />
                                    <span>{col.label}</span>
                                  </span>
                                  <span className="font-bold text-slate-900">{col.qty} pcs</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-100">
                            <div className="font-bold text-slate-500 uppercase text-[10px]">
                              Top Types
                            </div>
                            <div className="mt-1 space-y-1">
                              {br.amees.topTypes.slice(0, 2).map((tp) => (
                                <div key={tp.label} className="flex justify-between gap-2">
                                  <span className="text-slate-700 truncate">{tp.label}</span>
                                  <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                                    {tp.qty}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto scrollbar-none">
            {(
              [
                { id: 'all', label: 'All Orders' },
                { id: 'paid', label: 'Paid & Confirmed Only' },
                { id: 'pending_fulfillment', label: 'Pending Fulfillment' },
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
