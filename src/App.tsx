import { batchLabel } from './utils/sourcing';
import { loadSessionUser, signOutUser } from './services/authService';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Product,
  AdjustmentRequest,
  AuditLogEntry,
  User,
  Role,
  ProductVariant,
  AdjustmentReason,
  Category,
  Booking,
  BookingStatus,
  CalendarItem,
  BoardColumnStatus,
  StoreTeamId,
  Vendor,
  ProductWorkflow,
  ProductStageVendor,
  VendorPriceEntry,
  ProductionBatch,
  MarketingOffer,
  ProductBudgetProfile,
  BudgetExpenseEntry,
  BudgetSettings,
  ScoutSeason,
  Fare2LeaderAssignment,
  ShortageBatchConfig,
  BatchStageAssignment,
  OperationStageKey,
  TeamChangeRequest,
  WorkflowTemplateApplication,
} from './types/inventory';
import {
  clearLegacyLocalEntityCaches,
} from './utils/storage';
import { DEFAULT_STAGE_KEYS, getStageMeta, inferDefaultWorkflowType, batchJoinBlockReason, firstWorkingStage, batchVariantParts, addToBatchBreakdown } from './utils/sourcing';
import { getEffectiveProductOffer } from './utils/offers';
import { getScoutFare2Meta, isCoreScoutFare2 } from './utils/scoutFera2';
import {
  isUserAdmin,
  isUserLeader,
  isUserMarketingMember,
  canEditProductMediaAndColors,
  canUserAccessView,
  canUserEditBookings,
  canUserManageOrders,
  canUserConfirmPayments,
  canUserStartShortagePurchase,
  canUserManageVendors,
  canUserManageTeamScope,
  isFullAccessAdmin,
  normalizeRole,
  getRoleDisplayName,
  normalizeUsername,
  normalizePhoneNumber,
} from './utils/security';
import {
  checkSupabaseConnection,
  fetchProductsFromDb,
  upsertProductToDb,
  deleteProductFromDb,
  deleteProductVariantFromDb,
  deleteUserFromDb,
  updateUserRoleInDb,
  updateVariantQuantityInDb,
  applyStockChangeInDb,
  fetchStockReservedFromDb,
  previewStockAdjustInDb,
  recordOrderShortfallInDb,
  fetchOrderShortagesFromDb,
  type OrderShortageNote,
  previewBatchReceiveInDb,
  receiveBatchStockInDb,
  fetchAdjustmentRequestsFromDb,
  createAdjustmentRequestInDb,
  updateAdjustmentRequestInDb,
  fetchUsersFromDb,
  updateUserStatusInDb,
  fetchAuditLogsFromDb,
  insertAuditLogInDb,
  fetchCategoriesFromDb,
  createCategoryInDb,
  deleteCategoryFromDb,
  clearAuditLogsInDb,
  fetchBookingsFromDb,
  insertBookingInDb,
  updateBookingInDb,
  deleteBookingFromDb,
  fetchOthersFoldersFromDb,
  syncOthersFoldersToDb,
  fetchCalendarEventsFromDb,
  upsertCalendarEventToDb,
  deleteCalendarEventFromDb,
  updateUserTeamAssignmentsInDb,
  updateUserContactInDb,
  fetchFare2LeadersFromDb,
  upsertFare2LeaderInDb,
  fetchSourcingDataFromDb,
  upsertVendorToDb,
  deleteVendorFromDb,
  upsertProductWorkflowToDb,
  upsertProductStageVendorToDb,
  deleteProductStageVendorFromDb,
  insertVendorPriceEntryToDb,
  upsertProductionBatchToDb,
  deleteProductionBatchFromDb,
  fetchMarketingOffersFromDb,
  upsertMarketingOfferToDb,
  deleteMarketingOfferFromDb,
  fetchBudgetingDataFromDb,
  upsertProductBudgetProfileToDb,
  upsertBudgetExpenseToDb,
  deleteBudgetExpenseFromDb,
  upsertBudgetSettingsToDb,
  fetchScoutSeasonsFromDb,
  upsertScoutSeasonToDb,
  deleteScoutSeasonFromDb,
  fetchTeamRequestsFromDb,
  upsertTeamRequestToDb,
  CATEGORY_MAP,
  DbConnectionStatus,
} from './services/supabaseService';
import { supabase } from './services/supabaseClient';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AuthScreens } from './components/AuthScreens';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AdjustmentModal } from './components/AdjustmentModal';
import { AddProductModal } from './components/AddProductModal';
import { ManageCategoriesModal } from './components/ManageCategoriesModal';
import { ApprovalsView } from './components/ApprovalsView';
import { WorkerRequestsView } from './components/WorkerRequestsView';
import { AuditLogView } from './components/AuditLogView';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { ActivityDetailModal } from './components/ActivityDetailModal';
import { BookingsView } from './components/BookingsView';
import { BookingModal } from './components/BookingModal';
import { BookingPrintModal } from './components/BookingPrintModal';
import { AdminAnalyticsView } from './components/AdminAnalyticsView';
import { CalendarView } from './components/CalendarView';
import { TeamBoardView } from './components/TeamBoardView';
import { SourcingOperationsView } from './components/SourcingOperationsView';
import { appConfirm, AppConfirmHost } from './components/AppConfirm';
import ShortageNeedsPanel, { NeedsTiles, NeedsList, type NeedsKind, type LowStockNote } from './components/ShortageNeedsPanel';
import { estimateProductionDays, readSafetyDays } from './utils/deliveryEstimate';
import ShortageStartModal from './components/ShortageStartModal';
import { MarketingOffersView } from './components/MarketingOffersView';
import { PublicSalesView } from './components/PublicSalesView';
import { BudgetingView } from './components/BudgetingView';
import {
  Search,
  Plus,
  Package,
  Layers,
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw,
  FolderPlus,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Check,
  ArrowLeft,
  Folder,
  Download,
} from 'lucide-react';

export default function App() {
  // State (strictly DB-driven; only signed-in user session persists locally)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<AdjustmentRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [dbStatus, setDbStatus] = useState<DbConnectionStatus>({ connected: false, tablesExist: false });
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);

  // Navigation
  const [activeView, setActiveView] = useState<string>('inventory');
  const [approvalsTab, setApprovalsTab] = useState<'stock' | 'staff'>('stock');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedAudience, setSelectedAudience] = useState<string>('All');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Others Category Sub-Folders & Sub-Sub-Folders ("Parent / Child")
  const normalizeFolderPath = (raw: string): string =>
    raw
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' / ');

  const getFolderParts = (raw?: string): { parent: string; child?: string } => {
    if (!raw) return { parent: '' };
    const parts = raw
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length <= 1) return { parent: parts[0] || '' };
    return { parent: parts[0], child: parts.slice(1).join(' / ') };
  };

  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [fare2Leaders, setFare2Leaders] = useState<Record<string, Fare2LeaderAssignment>>({});
  const [selectedOtherFolder, setSelectedOtherFolder] = useState<string>('All Items');
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState<string>('');
  const [newFolderParentInput, setNewFolderParentInput] = useState<string>('');
  const [showEditFoldersModal, setShowEditFoldersModal] = useState<boolean>(false);
  const [renamingFolderPath, setRenamingFolderPath] = useState<string | null>(null);
  const [renameFolderInput, setRenameFolderInput] = useState<string>('');
  const [confirmDeleteFolderPath, setConfirmDeleteFolderPath] = useState<string | null>(null);

  // All folder paths (top-level + nested "Parent / Child"), excluding 'All Items'
  const allFolderPaths = React.useMemo(() => {
    const merged: string[] = [];
    const pushUnique = (val: string) => {
      const norm = normalizeFolderPath(val);
      if (!norm || norm.toLowerCase() === 'all items') return;
      // Ensure parent top-level folder exists if nested
      const { parent } = getFolderParts(norm);
      if (parent && !merged.some((f) => f.toLowerCase() === parent.toLowerCase())) {
        merged.push(parent);
      }
      if (!merged.some((f) => f.toLowerCase() === norm.toLowerCase())) {
        merged.push(norm);
      }
    };
    customFolders.forEach(pushUnique);
    products.forEach((p) => {
      if (p.folder) pushUnique(p.folder);
    });
    return merged;
  }, [customFolders, products]);

  // Top-level chips for the Others Sub-Folders bar
  const topLevelOthersFolders = React.useMemo(() => {
    const tops: string[] = ['All Items'];
    allFolderPaths.forEach((p) => {
      if (!p.includes(' / ') && !tops.some((t) => t.toLowerCase() === p.toLowerCase())) {
        tops.push(p);
      }
    });
    return tops;
  }, [allFolderPaths]);

  const handleCreateNewFolder = (folderName: string, parentPath?: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admins can create folders.');
      return;
    }
    const cleanLeaf = folderName.replace(/\//g, '-').trim();
    if (!cleanLeaf) return;
    const cleanParent = parentPath && parentPath !== 'All Items' ? getFolderParts(parentPath).parent : '';
    const fullPath = cleanParent ? `${cleanParent} / ${cleanLeaf}` : cleanLeaf;

    const nextFolders = [...allFolderPaths];
    if (cleanParent && !nextFolders.some((f) => f.toLowerCase() === cleanParent.toLowerCase())) {
      nextFolders.push(cleanParent);
    }
    if (!nextFolders.some((f) => f.toLowerCase() === fullPath.toLowerCase())) {
      nextFolders.push(fullPath);
    }
    setCustomFolders(nextFolders);
    syncOthersFoldersToDb(nextFolders).then((res) => {
      if (!res.ok && res.error) showToast(`Database folder sync error: ${res.error}`);
    });

    // If creating a sub-sub-folder inside a parent, stay inside parent so user immediately sees its Folder Card
    setSelectedOtherFolder(cleanParent || fullPath);
    setShowNewFolderModal(false);
    setNewFolderNameInput('');
    setNewFolderParentInput('');
    showToast(
      cleanParent
        ? `Sub-folder "${cleanLeaf}" created inside "${cleanParent}".`
        : `Folder "${cleanLeaf}" created in Others.`
    );
  };

  const handleRenameFolder = (oldPath: string, newLeafName: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admins can edit or rename folders.');
      return;
    }
    const cleanLeaf = newLeafName.replace(/\//g, '-').trim();
    if (!cleanLeaf || oldPath === 'All Items') return;
    const isNested = oldPath.includes(' / ');
    const parent = isNested ? getFolderParts(oldPath).parent : '';
    const newPath = isNested ? `${parent} / ${cleanLeaf}` : cleanLeaf;
    if (newPath.toLowerCase() === oldPath.toLowerCase()) {
      setRenamingFolderPath(null);
      setRenameFolderInput('');
      return;
    }

    const oldLower = oldPath.toLowerCase();
    const oldPrefix = `${oldLower} / `;

    const updatedFolderList = Array.from(
      new Set(
        allFolderPaths.map((f) => {
          const fLower = f.toLowerCase();
          if (fLower === oldLower) return newPath;
          if (!isNested && fLower.startsWith(oldPrefix)) {
            const sub = f.slice(oldPath.length + 3);
            return `${newPath} / ${sub}`;
          }
          return f;
        })
      )
    );
    setCustomFolders(updatedFolderList);
    syncOthersFoldersToDb(updatedFolderList).then((res) => {
      if (!res.ok && res.error) showToast(`Database folder sync error: ${res.error}`);
    });

    const modifiedProducts: Product[] = [];
    const nextProducts = products.map((p) => {
      if (!p.folder) return p;
      const pf = normalizeFolderPath(p.folder);
      const pfLower = pf.toLowerCase();
      let updatedFolder: string | undefined;
      if (pfLower === oldLower) {
        updatedFolder = newPath;
      } else if (!isNested && pfLower.startsWith(oldPrefix)) {
        updatedFolder = `${newPath} / ${pf.slice(oldPath.length + 3)}`;
      }
      if (updatedFolder) {
        const up = { ...p, folder: updatedFolder, updatedAt: new Date().toISOString() };
        modifiedProducts.push(up);
        return up;
      }
      return p;
    });

    if (modifiedProducts.length > 0) {
      setProducts(nextProducts);
      modifiedProducts.forEach((mp) => {
        upsertProductToDb(mp).catch((err) => showToast(`Database sync error: ${err?.message || 'Failed to update product folder'}`));
      });
    }

    if (selectedOtherFolder.toLowerCase() === oldLower) {
      setSelectedOtherFolder(newPath);
    } else if (!isNested && selectedOtherFolder.toLowerCase().startsWith(oldPrefix)) {
      setSelectedOtherFolder(`${newPath} / ${selectedOtherFolder.slice(oldPath.length + 3)}`);
    }

    setRenamingFolderPath(null);
    setRenameFolderInput('');
    showToast(`Renamed folder to "${cleanLeaf}".`);
  };

  const handleDeleteFolder = (targetPath: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admins can delete folders.');
      return;
    }
    if (targetPath === 'All Items') return;
    const isNested = targetPath.includes(' / ');
    const parent = isNested ? getFolderParts(targetPath).parent : '';
    const targetLower = targetPath.toLowerCase();
    const targetPrefix = `${targetLower} / `;

    const updatedFolderList = allFolderPaths.filter((f) => {
      const fLower = f.toLowerCase();
      if (fLower === targetLower) return false;
      if (!isNested && fLower.startsWith(targetPrefix)) return false;
      return true;
    });
    setCustomFolders(updatedFolderList);
    syncOthersFoldersToDb(updatedFolderList).then((res) => {
      if (!res.ok && res.error) showToast(`Database folder sync error: ${res.error}`);
    });

    const modifiedProducts: Product[] = [];
    const nextProducts = products.map((p) => {
      if (!p.folder) return p;
      const pf = normalizeFolderPath(p.folder);
      const pfLower = pf.toLowerCase();
      if (pfLower === targetLower || (!isNested && pfLower.startsWith(targetPrefix))) {
        const up: Product = {
          ...p,
          // If deleting a sub-sub-folder, move its items to parent folder; if deleting a top-level folder, unassign folder
          folder: isNested && parent ? parent : undefined,
          updatedAt: new Date().toISOString(),
        };
        modifiedProducts.push(up);
        return up;
      }
      return p;
    });

    if (modifiedProducts.length > 0) {
      setProducts(nextProducts);
      modifiedProducts.forEach((mp) => {
        upsertProductToDb(mp).catch((err) => showToast(`Database sync error: ${err?.message || 'Failed to update product folder'}`));
      });
    }

    if (
      selectedOtherFolder.toLowerCase() === targetLower ||
      (!isNested && selectedOtherFolder.toLowerCase().startsWith(targetPrefix))
    ) {
      setSelectedOtherFolder(isNested && parent ? parent : 'All Items');
    }

    setConfirmDeleteFolderPath(null);
    showToast(`Deleted folder "${isNested ? getFolderParts(targetPath).child : targetPath}".`);
  };

  // Modals
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState<{
    product: Product;
    variant?: ProductVariant;
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | undefined>(undefined);
  const [productEditScope, setProductEditScope] = useState<'full' | 'marketing' | undefined>(
    undefined
  );
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Rich Toast notification & Activity Detail
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    log?: AuditLogEntry;
  } | null>(null);
  const [selectedActivityLog, setSelectedActivityLog] = useState<AuditLogEntry | null>(null);

  const showToast = (msg: string, log?: AuditLogEntry) => {
    setToastNotification({ message: msg, log });
    setTimeout(() => {
      setToastNotification((prev) => (prev?.message === msg ? null : prev));
    }, 6000);
  };

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingModalProduct, setBookingModalProduct] = useState<Product | undefined>(undefined);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [printBooking, setPrintBooking] = useState<Booking | null>(null);
  const [printDocType, setPrintDocType] = useState<'quotation' | 'production'>('quotation');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<string | null>(null);

  // Store Calendar & Tasks state
  const [calendarEvents, setCalendarEvents] = useState<CalendarItem[]>([]);
  const [scoutSeasons, setScoutSeasons] = useState<ScoutSeason[]>([]);
  const [teamChangeRequests, setTeamChangeRequests] = useState<TeamChangeRequest[]>([]);
  const lastCalendarMutationAtRef = useRef<number>(0);
  const lastBookingMutationAtRef = useRef<number>(0);

  // Sourcing & Production Operations state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [productWorkflows, setProductWorkflows] = useState<ProductWorkflow[]>([]);
  const [productStageVendors, setProductStageVendors] = useState<ProductStageVendor[]>([]);
  const [vendorPriceHistory, setVendorPriceHistory] = useState<VendorPriceEntry[]>([]);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);

  // Marketing & Store Offers state
  const [marketingOffers, setMarketingOffers] = useState<MarketingOffer[]>([]);

  // Budgeting, Unit Costs, Expenses & Liquidity state
  const [budgetProfiles, setBudgetProfiles] = useState<Record<string, ProductBudgetProfile>>({});
  const [budgetExpenses, setBudgetExpenses] = useState<BudgetExpenseEntry[]>([]);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>({
    id: 'default',
    reserveBuffer: 0,
    updatedAt: '',
  });
  const [isBudgetingUnlocked, setIsBudgetingUnlocked] = useState<boolean>(false);

  const handleOpenBookingDetails = (bookingNumberOrId: string) => {
    const cleanQuery = bookingNumberOrId.trim().toLowerCase();
    const match = bookings.find(
      (b) =>
        b.id.toLowerCase() === cleanQuery ||
        b.bookingNumber.toLowerCase() === cleanQuery ||
        cleanQuery.includes(b.bookingNumber.toLowerCase()) ||
        b.bookingNumber.toLowerCase().includes(cleanQuery)
    );
    if (match) {
      setSelectedBookingForDetails(match.id);
    } else {
      setSelectedBookingForDetails(bookingNumberOrId);
    }
    setActiveView('bookings');
    setSelectedActivityLog(null);
  };

  // The session lives in Supabase Auth (not in a home-made localStorage record).
  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await loadSessionUser().catch(() => null);
      if (alive) {
        setCurrentUser(u);
        setAuthReady(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setCurrentUser(null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // RLS needs a signed-in session, so reload data whenever the signed-in person changes.
  useEffect(() => {
    if (authReady) refreshFromSupabase(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, currentUser?.id]);

  // Category handlers
  const executeAddCategory = async (name: string, description?: string) => {
    const newId = `cat_${Date.now()}`;
    const newCat: Category = {
      id: newId,
      name,
      description,
      displayOrder: categories.length + 1,
      createdAt: new Date().toISOString(),
    };
    const nextCats = [...categories, newCat];
    setCategories(nextCats);

    try {
      await createCategoryInDb(newCat);
      showToast(`Category "${name}" created.`);
    } catch (err: any) {
      console.warn('Supabase category create error:', err?.message);
      setCategories(categories);
      showToast(`Failed to save category to database: ${err?.message || 'Sync error'}`);
    }
  };

  const executeDeleteCategory = async (catId: string) => {
    const deletedCat = categories.find((c) => c.id === catId);
    const nextCats = categories.filter((c) => c.id !== catId);
    setCategories(nextCats);

    // Any products that belonged to this category now become Unassigned
    const nextProducts = products.map((p) => {
      if (p.categoryId === catId || (deletedCat && p.category === deletedCat.name)) {
        return {
          ...p,
          categoryId: undefined,
          category: 'Unassigned',
        };
      }
      return p;
    });
    setProducts(nextProducts);

    try {
      await deleteCategoryFromDb(catId);
    } catch (err: any) {
      console.warn('Supabase category delete error:', err?.message);
      setCategories(categories);
      setProducts(products);
      showToast(`Failed to delete category from database: ${err?.message || 'Sync error'}`);
      return;
    }

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'product_updated',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Deleted category "${deletedCat?.name || catId}"`,
      details: 'Items in this category have been set to Unassigned.',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast('Category deleted. Existing items are now Unassigned.');
  };

  const handleAddCategory = async (name: string, description?: string) => {
    if (!isUserAdmin(currentUser)) {
      handleSubmitTeamRequest({
        teamScope: 'inventory',
        entityType: 'category',
        actionType: 'create',
        title: `Create Category: ${name}`,
        summary: description || 'New inventory category',
        payload: { name, description },
      });
      return;
    }
    await executeAddCategory(name, description);
  };

  const handleDeleteCategory = async (catId: string) => {
    const deletedCat = categories.find((c) => c.id === catId);
    if (!isUserAdmin(currentUser)) {
      handleSubmitTeamRequest({
        teamScope: 'inventory',
        entityType: 'category',
        actionType: 'delete',
        targetId: catId,
        title: `Delete Category: ${deletedCat?.name || catId}`,
        summary: 'Items in this category will become Unassigned once approved.',
        payload: { categoryId: catId },
      });
      return;
    }
    await executeDeleteCategory(catId);
  };

  // Admin deletes entire product
  const handleDeleteProduct = async (productId: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admin can delete products.');
      return;
    }
    const targetProd = products.find((p) => p.id === productId);
    const nextProds = products.filter((p) => p.id !== productId);
    setProducts(nextProds);

    try {
      await deleteProductFromDb(productId);
    } catch (err: any) {
      console.warn('Supabase product delete error:', err?.message);
      setProducts(products);
      showToast(`Failed to delete product from database: ${err?.message || 'Sync error'}`);
      return;
    }

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'product_deleted',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Deleted product "${targetProd?.name || productId}"`,
      details: `Product (SKU: ${targetProd?.sku}) and all variants removed by Admin.`,
      productId,
      productName: targetProd?.name,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Product "${targetProd?.name || 'Item'}" deleted.`);
  };

  // Admin deletes single variant size from a product
  const handleDeleteVariant = async (productId: string, variantId: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admin can delete variants.');
      return;
    }

    let deletedVariantSize = '';
    let deletedVariantColor = '';
    let prodName = '';

    const nextProducts = products.map((prod) => {
      if (prod.id !== productId) return prod;
      prodName = prod.name;
      const targetVar = prod.variants.find((v) => v.id === variantId);
      if (targetVar) {
        deletedVariantSize = targetVar.size;
        deletedVariantColor = targetVar.colorName;
      }
      const updatedVariants = prod.variants.filter((v) => v.id !== variantId);
      const updatedTotal = updatedVariants.reduce((sum, v) => sum + v.quantity, 0);

      const updatedProd = {
        ...prod,
        variants: updatedVariants,
        totalQuantity: updatedTotal,
        updatedAt: new Date().toISOString(),
      };

      if (detailProduct && detailProduct.id === productId) {
        setDetailProduct(updatedProd);
      }
      return updatedProd;
    });

    setProducts(nextProducts);

    try {
      await deleteProductVariantFromDb(variantId);
    } catch (err: any) {
      console.warn('Supabase variant delete error:', err?.message);
      setProducts(products);
      showToast(`Failed to delete variant from database: ${err?.message || 'Sync error'}`);
      return;
    }

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'variant_deleted',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Deleted size variant "${deletedVariantSize}" from "${prodName}"`,
      details: `Variant (${deletedVariantSize} / ${deletedVariantColor}) deleted by Admin.`,
      productId,
      productName: prodName,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Size variant "${deletedVariantSize}" removed.`);
  };

  // Admin deletes staff account
  const handleDeleteUser = async (userId: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admin can delete user accounts.');
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    const nextUsers = users.filter((u) => u.id !== userId);
    setUsers(nextUsers);

    try {
      await deleteUserFromDb(userId);
    } catch (err: any) {
      console.warn('Supabase user delete error:', err?.message);
      setUsers(users);
      showToast(`Failed to delete user from database: ${err?.message || 'Sync error'}`);
      return;
    }

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'account_deleted',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Deleted user account "${targetUser?.name || 'User'}"`,
      details: `Account for ${targetUser?.email || (targetUser?.username ? `@${targetUser.username}` : targetUser?.phone || targetUser?.name || 'User')} (${targetUser?.role}) permanently removed.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`User account for "${targetUser?.name || 'staff'}" deleted.`);
  };

  // Admin changes staff / user account role (Worker <-> Admin)
  const handleUpdateUserRole = async (userId: string, newRole: Role) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admin can modify user account roles.');
      return;
    }

    const targetUser = users.find((u) => u.id === userId);
    const oldRole = targetUser?.role || 'worker';

    const nextUsers = users.map((u) => {
      if (u.id !== userId) return u;
      return {
        ...u,
        role: newRole,
        requestedRole: newRole,
        avatarColor:
          newRole === 'full_admin'
            ? '#b45309'
            : newRole === 'admin'
            ? '#d97706'
            : newRole === 'leader'
            ? '#059669'
            : '#0284c7',
      };
    });

    setUsers(nextUsers);

    // If current logged-in user changed their own role, update currentUser state
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({
        ...currentUser,
        role: newRole,
        requestedRole: newRole,
      });
    }

    try {
      await updateUserRoleInDb(userId, newRole);
    } catch (err: any) {
      console.warn('Supabase user role update error:', err?.message);
      setUsers(users);
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(currentUser);
      }
      showToast(`Failed to update role in database: ${err?.message || 'Sync error'}`);
      return;
    }

    const nextRoleLabel = getRoleDisplayName(newRole);
    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'account_updated' as any,
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      reason: `Account Role Changed: ${oldRole.toUpperCase()} → ${newRole.toUpperCase()}`,
      summary: `Account Role Changed: "${targetUser?.name || targetUser?.email || targetUser?.phone || 'User'}" to ${nextRoleLabel}`,
      details: `User (${targetUser?.email || (targetUser?.username ? `@${targetUser.username}` : targetUser?.phone || targetUser?.name || 'User')}) role changed from ${oldRole.toUpperCase()} to ${newRole.toUpperCase()} by Admin.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Role for "${targetUser?.name || 'User'}" updated to ${nextRoleLabel}.`, newLog);
  };

  // Load live data from Supabase - Strict single source of truth across all devices
  const refreshFromSupabase = async (notify = false) => {
    setIsDbLoading(true);
    try {
      const status = await checkSupabaseConnection();
      setDbStatus(status);

      if (status.connected && status.tablesExist) {
        const [
          dbProducts,
          dbRequests,
          dbUsers,
          dbCategories,
          dbLogs,
          dbBookings,
          dbFolders,
          dbCalendar,
          dbFare2Leaders,
          dbSourcing,
          dbOffers,
          dbBudgeting,
          dbScoutSeasons,
          dbTeamRequests,
        ] = await Promise.allSettled([
          fetchProductsFromDb(),
          fetchAdjustmentRequestsFromDb(),
          fetchUsersFromDb(),
          fetchCategoriesFromDb(),
          fetchAuditLogsFromDb(),
          fetchBookingsFromDb(),
          fetchOthersFoldersFromDb(),
          fetchCalendarEventsFromDb(),
          fetchFare2LeadersFromDb(),
          fetchSourcingDataFromDb(),
          fetchMarketingOffersFromDb(),
          fetchBudgetingDataFromDb(),
          fetchScoutSeasonsFromDb(),
          fetchTeamRequestsFromDb(),
        ]);

        let dbProductFolders: string[] = [];
        if (dbProducts.status === 'fulfilled') {
          dbProductFolders = dbProducts.value
            .map((p) => (p.folder ? normalizeFolderPath(p.folder) : ''))
            .filter(Boolean);
          setProducts(dbProducts.value);
        }
        // Product photos are downloaded once with the products; requests and order
        // items no longer download their own copy, so fill them in from here.
        const productImageById = new Map<string, string>();
        if (dbProducts.status === 'fulfilled') {
          dbProducts.value.forEach((p) => {
            if (p.image) productImageById.set(p.id, p.image);
          });
        }

        if (dbRequests.status === 'fulfilled') {
          const withImages = dbRequests.value.map((r) => ({
            ...r,
            productImage: r.productImage || productImageById.get(r.productId) || '',
          }));
          setRequests(withImages);
        }
        if (dbFare2Leaders.status === 'fulfilled' && dbFare2Leaders.value !== null) {
          setFare2Leaders(dbFare2Leaders.value);
        }
        if (dbUsers.status === 'fulfilled') {
          const enrichedUsers = dbUsers.value.map((u) => ({
            ...u,
            assignedTeams: Array.isArray(u.assignedTeams) ? u.assignedTeams : [],
            assignedFare2: Array.isArray(u.assignedFare2) ? u.assignedFare2 : [],
          }));
          setUsers(enrichedUsers);
          setCurrentUser((prevUser) => {
            if (!prevUser) return prevUser;
            const matched = enrichedUsers.find(
              (u) =>
                u.id === prevUser.id ||
                (u.email && prevUser.email && u.email.toLowerCase() === prevUser.email.toLowerCase())
            );
            if (!matched || matched.status !== 'active') return null;
            const prevTeams = JSON.stringify(prevUser.assignedTeams ?? []);
            const nextTeams = JSON.stringify(matched.assignedTeams ?? []);
            const prevFare2 = JSON.stringify(prevUser.assignedFare2 ?? []);
            const nextFare2 = JSON.stringify(matched.assignedFare2 ?? []);
            if (
              matched.name === prevUser.name &&
              matched.role === prevUser.role &&
              matched.status === prevUser.status &&
              matched.username === prevUser.username &&
              matched.phone === prevUser.phone &&
              prevTeams === nextTeams &&
              prevFare2 === nextFare2
            ) {
              return prevUser;
            }
            return {
              ...prevUser,
              name: matched.name,
              username: matched.username,
              phone: matched.phone,
              role: matched.role,
              status: matched.status,
              assignedTeams: matched.assignedTeams,
              assignedFare2: matched.assignedFare2,
            };
          });
        }
        if (dbCategories.status === 'fulfilled') {
          setCategories(dbCategories.value);
        }
        if (dbLogs.status === 'fulfilled') {
          setAuditLogs(dbLogs.value);
        }
        if (
          dbBookings.status === 'fulfilled' &&
          Date.now() - lastBookingMutationAtRef.current > 5000
        ) {
          const syncedBookings = dbBookings.value.map((b) => {
            const isPaidNow = Boolean(b.depositPaid || b.status !== 'pending');
            const resolvedFare2 =
              b.assignedFare2 || (isCoreScoutFare2(b.troopGroup) ? b.troopGroup : undefined);
            return {
              ...b,
              items: b.items.map((it) => ({
                ...it,
                productImage: it.productImage || productImageById.get(it.productId) || undefined,
              })),
              assignedFare2: resolvedFare2,
              paymentVerificationRequested: isPaidNow ? false : Boolean(b.paymentVerificationRequested),
              paymentVerificationRequestedBy: isPaidNow ? undefined : b.paymentVerificationRequestedBy,
              paymentVerificationRequestedAt: isPaidNow ? undefined : b.paymentVerificationRequestedAt,
              paymentVerificationNote: isPaidNow ? undefined : b.paymentVerificationNote,
            };
          });
          setBookings(syncedBookings);
        }

        // Sync Others folders, sub-folders & sub-sub-folders strictly from Supabase & DB products
        if (dbFolders.status === 'fulfilled') {
          const remoteFolders = dbFolders.value;
          if (remoteFolders !== null) {
            setCustomFolders(Array.from(new Set([...remoteFolders, ...dbProductFolders])));
          } else {
            setCustomFolders(dbProductFolders);
          }
        }

        // Sync Store Calendar Events & Tasks strictly from Supabase
        if (
          dbCalendar.status === 'fulfilled' &&
          dbCalendar.value !== null &&
          Date.now() - lastCalendarMutationAtRef.current > 3000
        ) {
          setCalendarEvents(dbCalendar.value);
        }

        // Sync Sourcing & Operations relational tables strictly from Supabase
        if (dbSourcing.status === 'fulfilled' && dbSourcing.value !== null && dbSourcing.value.tablesReady) {
          const remote = dbSourcing.value;
          setVendors(remote.vendors);
          setProductWorkflows(remote.workflows);
          setProductStageVendors(remote.stageVendors);
          setVendorPriceHistory(remote.priceHistory);
          setProductionBatches(remote.batches);
        }

        // Sync Marketing Offers
        if (dbOffers.status === 'fulfilled' && dbOffers.value !== null) {
          setMarketingOffers(dbOffers.value);
        }

        // Sync Budgeting Profiles, Expenses & Liquidity Settings
        if (dbBudgeting.status === 'fulfilled' && dbBudgeting.value !== null) {
          const bData = dbBudgeting.value;
          setBudgetProfiles(bData.profiles);
          setBudgetExpenses(bData.expenses);
          setBudgetSettings(
            bData.settings || { id: 'default', reserveBuffer: 0, updatedAt: '' }
          );
        }

        // Sync Calendar Scout Seasons
        if (dbScoutSeasons.status === 'fulfilled' && dbScoutSeasons.value !== null) {
          setScoutSeasons(dbScoutSeasons.value);
        }

        // Sync Team Change Requests (Staff -> Team Admin approval queue)
        if (dbTeamRequests.status === 'fulfilled' && Array.isArray(dbTeamRequests.value)) {
          setTeamChangeRequests(dbTeamRequests.value);
        }

        if (notify) {
          showToast('Live inventory & bookings synchronized with Supabase.');
        }
      } else if (notify && status.error) {
        showToast(status.error);
      }
    } catch (err: any) {
      console.warn('Supabase sync error:', err);
      if (notify) {
        showToast(`Sync warning: ${err.message || 'Network issue'}`);
      }
    } finally {
      setIsDbLoading(false);
    }
  };

  // Load all data ONCE when the app opens and clear any legacy client-only entity caches.
  useEffect(() => {
    clearLegacyLocalEntityCaches();
  }, []);

  // Auth Handlers
  const handleLogin = (user: User) => {
    setIsBudgetingUnlocked(false);
    setCurrentUser(user);
    setActiveView('inventory');
    showToast(`Signed in as ${user.name} (${getRoleDisplayName(user.role)})`);
  };

  const handleLogout = () => {
    signOutUser().catch(() => {});
    setIsBudgetingUnlocked(false);
    setCurrentUser(null);
    setActiveView('inventory');
  };

  // Product CRUD (Persisted to Supabase)
  const handleSaveProduct = async (product: Product) => {
    const existingProd = products.find((p) => p.id === product.id);
    const isEdit = Boolean(existingProd);
    const isAdmin = isUserAdmin(currentUser);
    const isMarketingRestrictedSave = Boolean(
      isEdit && existingProd && !isAdmin && isUserMarketingMember(currentUser)
    );

    // If Marketing staff edits an existing product, preserve protected Admin fields (name, SKU, price, category, status, stock counts)
    const finalProd: Product = isMarketingRestrictedSave && existingProd
      ? {
          ...existingProd,
          description: product.description,
          fabricDetails: product.fabricDetails,
          image: product.image,
          images: product.images,
          variants: product.variants.map((v) => {
            const match = existingProd.variants.find(
              (ev) => ev.id === v.id || (ev.size === v.size && ev.colorName === v.colorName)
            );
            return match
              ? { ...v, quantity: match.quantity, minThreshold: match.minThreshold }
              : { ...v, quantity: 0 };
          }),
          totalQuantity: existingProd.variants.reduce((sum, v) => {
            const kept = product.variants.some(
              (nv) => nv.id === v.id || (nv.size === v.size && nv.colorName === v.colorName)
            );
            return kept ? sum + v.quantity : sum;
          }, 0),
          updatedAt: new Date().toISOString(),
        }
      : {
          ...product,
          status: isEdit ? (product.status || 'active') : (isAdmin ? 'active' : 'pending'),
          createdByRole: product.createdByRole || (isAdmin ? 'admin' : 'worker'),
          createdByName: product.createdByName || currentUser?.name || 'Staff',
          createdById: product.createdById || currentUser?.id,
        };

    if (finalProd.folder && !customFolders.some((f) => f.toLowerCase() === finalProd.folder!.toLowerCase())) {
      const nextFolders = [...customFolders, finalProd.folder];
      setCustomFolders(nextFolders);
      syncOthersFoldersToDb(nextFolders).catch(() => {});
    }

    let updatedProducts: Product[];
    if (isEdit) {
      updatedProducts = products.map((p) => (p.id === finalProd.id ? finalProd : p));
    } else {
      updatedProducts = [finalProd, ...products];
    }

    setProducts(updatedProducts);

    const normalizeSizeName = (sz?: string) =>
      !sz || sz === 'One Size' || sz === 'Standard' ? 'Standard Size' : sz;

    let newLog: AuditLogEntry;

    if (isEdit && existingProd) {
      const oldTotal = existingProd.totalQuantity ?? 0;
      const newTotal = finalProd.totalQuantity ?? 0;
      const totalDelta = newTotal - oldTotal;

      const changedVariants: Array<{ size: string; colorName: string; oldQty: number; newQty: number }> = [];
      finalProd.variants.forEach((nv) => {
        const ov = existingProd.variants.find(
          (v) => v.id === nv.id || (v.size === nv.size && v.colorName === nv.colorName)
        );
        const oldQ = ov ? ov.quantity : 0;
        if (nv.quantity !== oldQ) {
          changedVariants.push({
            size: nv.size,
            colorName: nv.colorName,
            oldQty: oldQ,
            newQty: nv.quantity,
          });
        }
      });
      existingProd.variants.forEach((ov) => {
        const stillExists = finalProd.variants.some(
          (nv) => nv.id === ov.id || (nv.size === ov.size && nv.colorName === ov.colorName)
        );
        if (!stillExists && ov.quantity > 0) {
          changedVariants.push({
            size: ov.size,
            colorName: ov.colorName,
            oldQty: ov.quantity,
            newQty: 0,
          });
        }
      });

      const extractNonStandardColors = (variants: Product['variants']) => {
        const seen = new Set<string>();
        const list: string[] = [];
        variants.forEach((v) => {
          const c = (v.colorName || '').trim();
          if (c && c.toLowerCase() !== 'standard' && !seen.has(c.toLowerCase())) {
            seen.add(c.toLowerCase());
            list.push(c);
          }
        });
        return list;
      };

      const metaReasons: string[] = [];
      const metaDetails: string[] = [];

      const oldDesc = (existingProd.description || '').trim();
      const newDesc = (finalProd.description || '').trim();
      if (oldDesc && !newDesc) {
        metaReasons.push('Removed description');
        metaDetails.push(`Removed description (was: "${oldDesc}").`);
      } else if (!oldDesc && newDesc) {
        metaReasons.push('Added description');
        metaDetails.push(`Added description: "${newDesc}".`);
      } else if (oldDesc !== newDesc) {
        metaReasons.push('Updated description');
        metaDetails.push(`Updated description from "${oldDesc}" to "${newDesc}".`);
      }

      const oldColors = extractNonStandardColors(existingProd.variants);
      const newColors = extractNonStandardColors(finalProd.variants);
      const oldColorLowerSet = new Set(oldColors.map((c) => c.toLowerCase()));
      const newColorLowerSet = new Set(newColors.map((c) => c.toLowerCase()));

      if (oldColors.length === 0 && newColors.length > 0) {
        const addedLabel = newColors.join(', ');
        metaReasons.push(`Added color: ${addedLabel} (previously without color)`);
        metaDetails.push(`Added color "${addedLabel}" (previously without color).`);
      } else if (oldColors.length > 0 && newColors.length === 0) {
        const removedLabel = oldColors.join(', ');
        metaReasons.push(`Removed color: ${removedLabel}`);
        metaDetails.push(`Removed color "${removedLabel}" (set to without color).`);
      } else if (
        oldColors.length === 1 &&
        newColors.length === 1 &&
        oldColors[0].toLowerCase() !== newColors[0].toLowerCase()
      ) {
        metaReasons.push(`Changed color from ${oldColors[0]} to ${newColors[0]}`);
        metaDetails.push(`Changed color from "${oldColors[0]}" to "${newColors[0]}".`);
      } else {
        const addedColors = newColors.filter((c) => !oldColorLowerSet.has(c.toLowerCase()));
        const removedColors = oldColors.filter((c) => !newColorLowerSet.has(c.toLowerCase()));
        if (addedColors.length > 0 || removedColors.length > 0) {
          const parts: string[] = [];
          if (addedColors.length > 0) parts.push(`added ${addedColors.join(', ')}`);
          if (removedColors.length > 0) parts.push(`removed ${removedColors.join(', ')}`);
          const msg = `Changed colors (${parts.join('; ')})`;
          metaReasons.push(msg);
          metaDetails.push(`${msg}.`);
        }
      }

      const oldPrice = existingProd.price ?? 0;
      const newPrice = finalProd.price ?? 0;
      if (oldPrice !== newPrice) {
        metaReasons.push(`Updated price (${oldPrice} → ${newPrice} EGP)`);
        metaDetails.push(`Unit price changed from ${oldPrice} EGP to ${newPrice} EGP.`);
      }

      const oldFolder = (existingProd.folder || '').trim();
      const newFolder = (finalProd.folder || '').trim();
      if (oldFolder !== newFolder) {
        if (newFolder) {
          metaReasons.push(`Moved to folder: ${newFolder}`);
          metaDetails.push(`Moved to folder "${newFolder}".`);
        } else {
          metaReasons.push(`Removed from folder "${oldFolder}"`);
          metaDetails.push(`Removed from folder "${oldFolder}".`);
        }
      }

      if (existingProd.name.trim() !== finalProd.name.trim()) {
        metaReasons.push('Renamed item');
        metaDetails.push(`Renamed from "${existingProd.name}" to "${finalProd.name}".`);
      }

      if (changedVariants.length === 1) {
        const c = changedVariants[0];
        const d = c.newQty - c.oldQty;
        const sizeLabel = normalizeSizeName(c.size);
        const sizePrefix = sizeLabel === 'Standard Size' ? 'Standard Size' : `Size ${sizeLabel}`;
        const colorPart = c.colorName && c.colorName !== 'Standard' ? ` (${c.colorName})` : '';
        const verb = d >= 0 ? 'Added to inventory' : 'Removed from inventory';
        const baseReason = `Stock Adjustment: "${finalProd.name}"`;
        const effectiveReason =
          metaReasons.length > 0 ? `${baseReason} • ${metaReasons.join(' • ')}` : baseReason;
        const extraMeta = metaDetails.length > 0 ? ` ${metaDetails.join(' ')}` : '';

        newLog = {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'stock_adjusted',
          actorName: currentUser?.name || (isAdmin ? 'Admin' : 'Staff'),
          actorRole: currentUser?.role || 'worker',
          summary: `Updated inventory for "${finalProd.name}"`,
          details: `${verb}: ${sizePrefix}${colorPart} adjusted from ${c.oldQty} to ${c.newQty} units (${d >= 0 ? `+${d}` : d} units). Total units changed from ${oldTotal} to ${newTotal} units. Reason: ${effectiveReason}.${extraMeta}`,
          productId: finalProd.id,
          productName: finalProd.name,
          productImage: finalProd.image || finalProd.images?.[0],
          variantSize: sizeLabel,
          variantColor: c.colorName,
          oldQuantity: c.oldQty,
          newQuantity: c.newQty,
          delta: d,
          totalQuantityBefore: oldTotal,
          totalQuantityAfter: newTotal,
          reason: effectiveReason,
        };
      } else if (changedVariants.length > 1 || totalDelta !== 0) {
        const d = totalDelta;
        const verb = d >= 0 ? 'Added to inventory' : 'Removed from inventory';
        const baseReason = `Stock Adjustment: "${finalProd.name}"`;
        const effectiveReason =
          metaReasons.length > 0 ? `${baseReason} • ${metaReasons.join(' • ')}` : baseReason;
        const extraMeta = metaDetails.length > 0 ? ` ${metaDetails.join(' ')}` : '';
        const changesList = changedVariants
          .map((c) => {
            const s = normalizeSizeName(c.size);
            const col = c.colorName && c.colorName !== 'Standard' ? ` (${c.colorName})` : '';
            return `${s}${col}: ${c.oldQty} → ${c.newQty}`;
          })
          .join(', ');

        newLog = {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'stock_adjusted',
          actorName: currentUser?.name || (isAdmin ? 'Admin' : 'Staff'),
          actorRole: currentUser?.role || 'worker',
          summary: `Updated inventory for "${finalProd.name}"`,
          details: `${verb}: Multiple Variants adjusted from ${oldTotal} to ${newTotal} units (${d >= 0 ? `+${d}` : d} units). Total units changed from ${oldTotal} to ${newTotal} units${changesList ? ` (${changesList})` : ''}. Reason: ${effectiveReason}.${extraMeta}`,
          productId: finalProd.id,
          productName: finalProd.name,
          productImage: finalProd.image || finalProd.images?.[0],
          variantSize: 'Multiple Sizes',
          oldQuantity: oldTotal,
          newQuantity: newTotal,
          delta: d,
          totalQuantityBefore: oldTotal,
          totalQuantityAfter: newTotal,
          reason: effectiveReason,
        };
      } else {
        const effectiveReason =
          metaReasons.length > 0 ? metaReasons.join(' • ') : `Updated Item: "${finalProd.name}"`;
        const effectiveDetails =
          metaDetails.length > 0
            ? `${metaDetails.join(' ')} (${finalProd.variants.length} variant(s), ${finalProd.totalQuantity} total units).`
            : `${finalProd.variants.length} variant(s) (${finalProd.totalQuantity} total units).`;

        newLog = {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'product_updated',
          actorName: currentUser?.name || (isAdmin ? 'Admin' : 'Staff'),
          actorRole: currentUser?.role || 'worker',
          summary:
            metaReasons.length > 0
              ? `Updated "${finalProd.name}" (${metaReasons.join(', ')})`
              : `Updated item "${finalProd.name}"`,
          details: effectiveDetails,
          productId: finalProd.id,
          productName: finalProd.name,
          productImage: finalProd.image || finalProd.images?.[0],
          variantColor: newColors.length === 1 ? newColors[0] : oldColors.length === 1 ? oldColors[0] : undefined,
          totalQuantityAfter: finalProd.totalQuantity,
          reason: effectiveReason,
        };
      }
    } else {
      const actionType = isAdmin ? 'product_created' : 'product_submitted';
      const firstVar = finalProd.variants[0];
      const sizeLabel = finalProd.variants.length === 1 && firstVar ? normalizeSizeName(firstVar.size) : undefined;
      newLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: actionType as any,
        actorName: currentUser?.name || (isAdmin ? 'Admin' : 'Staff'),
        actorRole: currentUser?.role || 'worker',
        summary: isAdmin
          ? `Added new item "${finalProd.name}"`
          : `Submitted new item "${finalProd.name}" for Admin approval`,
        details: `${finalProd.variants.length} variant(s) (${finalProd.totalQuantity} total units).`,
        productId: finalProd.id,
        productName: finalProd.name,
        productImage: finalProd.image || finalProd.images?.[0],
        variantSize: sizeLabel,
        variantColor: finalProd.variants.length === 1 && firstVar ? firstVar.colorName : undefined,
        oldQuantity: 0,
        newQuantity: finalProd.totalQuantity,
        delta: finalProd.totalQuantity,
        totalQuantityBefore: 0,
        totalQuantityAfter: finalProd.totalQuantity,
      };
    }

    // Save product to Supabase FIRST so foreign key constraint is satisfied and no unsaved data remains in state
    try {
      await upsertProductToDb(finalProd);
    } catch (err: any) {
      console.warn('Supabase upsert product error:', err?.message);
      setProducts(products);
      setAuditLogs(auditLogs);
      const msg = String(err?.message || '');
      showToast(
        msg.includes('exceed_egress_quota')
          ? 'Could not save to database — Supabase project quota restricted (exceed_egress_quota).'
          : `Database save failed: ${msg || 'Could not persist product'}`
      );
      return;
    }

    setAuditLogs((prev) => [newLog, ...prev]);

    // Then record audit log
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(
      isEdit
        ? `Updated "${finalProd.name}"`
        : isAdmin
        ? `Added "${finalProd.name}" to inventory`
        : `Item "${finalProd.name}" submitted for Admin approval.`,
      newLog
    );
    setProductToEdit(undefined);
  };

  // Admin Approves a pending staff-submitted item
  const handleApproveProduct = async (productId: string) => {
    if (!isUserAdmin(currentUser)) return;
    const targetProd = products.find((p) => p.id === productId);
    if (!targetProd) return;

    const approvedProd: Product = {
      ...targetProd,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };

    const nextProds = products.map((p) => (p.id === productId ? approvedProd : p));
    setProducts(nextProds);

    try {
      await upsertProductToDb(approvedProd);
    } catch (err: any) {
      console.warn('Supabase product approve error:', err?.message);
      setProducts(products);
      showToast(`Failed to approve product in database: ${err?.message || 'Sync error'}`);
      return;
    }

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'product_created',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Approved new item "${targetProd.name}" for live catalog`,
      details: `Item submitted by ${targetProd.createdByName || 'Staff'} was approved with ${targetProd.variants.length} variant(s) and ${targetProd.totalQuantity} total units.`,
      productId: targetProd.id,
      productName: targetProd.name,
      productImage: targetProd.image || targetProd.images?.[0],
      totalQuantityAfter: targetProd.totalQuantity,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Item "${targetProd.name}" approved and published to live catalog!`, newLog);
  };

  // Admin Declines a pending staff-submitted item
  const handleRejectProduct = async (productId: string, note?: string) => {
    if (!isUserAdmin(currentUser)) return;
    const targetProd = products.find((p) => p.id === productId);
    if (!targetProd) return;

    const nextProds = products.filter((p) => p.id !== productId);
    setProducts(nextProds);

    try {
      await deleteProductFromDb(productId);
    } catch (err: any) {
      console.warn('Supabase product reject delete error:', err?.message);
      setProducts(products);
      showToast(`Failed to decline product in database: ${err?.message || 'Sync error'}`);
      return;
    }

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'product_deleted',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Declined item submission "${targetProd.name}"`,
      details: `Submission by ${targetProd.createdByName || 'Staff'} was declined.${note ? ` Reason: ${note}` : ''}`,
      productId: targetProd.id,
      productName: targetProd.name,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Submission for "${targetProd.name}" declined.`);
  };

  // Worker submits a stock change request (Persisted to Supabase)
  const handleSubmitWorkerRequest = (data: {
    productId: string;
    productName: string;
    productImage: string;
    variantId: string;
    size: ProductVariant['size'];
    colorName: string;
    colorHex: string;
    currentQuantity: number;
    requestedQuantity: number;
    delta: number;
    reason: AdjustmentReason;
    workerNote: string;
  }) => {
    const newRequest: AdjustmentRequest = {
      id: `req_${Date.now()}`,
      productId: data.productId,
      productName: data.productName,
      productImage: data.productImage,
      variantId: data.variantId,
      size: data.size,
      colorName: data.colorName,
      colorHex: data.colorHex,
      currentQuantity: data.currentQuantity,
      requestedQuantity: data.requestedQuantity,
      delta: data.delta,
      reason: data.reason,
      workerNote: data.workerNote,
      workerId: currentUser?.id || 'worker_floor',
      workerName: currentUser?.name || 'Warehouse Staff',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setRequests([newRequest, ...requests]);

    // Persist to Supabase
    createAdjustmentRequestInDb(newRequest).catch((err) => {
      console.warn('Supabase request create error:', err.message);
    });

    showToast(
      `Count request submitted for ${data.productName} (${data.size} / ${data.colorName}). Waiting for Admin approval.`
    );
  };

  // Manual stock change (count correction): done by the database so waiting orders are served first
  // (more stock) or the shortage grows on the latest paid orders (less than the free stock).
  const [reservedMap, setReservedMap] = useState<Record<string, number>>({});
  const refreshReserved = () => {
    if (!currentUser) return;
    fetchStockReservedFromDb().then(setReservedMap).catch(() => setReservedMap({}));
  };
  useEffect(() => {
    refreshReserved();
  }, [currentUser?.id, bookings.length, productionBatches.length, activeView]);
  const syncManualStockChange = (productId: string, variantId: string, delta: number) => {
    if (!delta) return;
    applyStockChangeInDb(variantId, delta, 'inventory_adjust', variantId)
      .then((newQty) => {
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId) return p;
            const vs = p.variants.map((v) => (v.id === variantId ? { ...v, quantity: newQty } : v));
            return { ...p, variants: vs, totalQuantity: vs.reduce((t, v) => t + v.quantity, 0) };
          })
        );
        setTimeout(refreshShortageNotes, 600);
        setTimeout(refreshReserved, 700);
      })
      .catch((err) => showToast(`Stock change was not saved: ${err?.message || 'sync failed'}`));
  };

  // Admin directly adjusts stock without approval step (Persisted to Supabase)
  const handleAdminDirectAdjust = (data: {
    productId: string;
    variantId: string;
    newQuantity: number;
    reason: string;
    note: string;
  }) => {
    let affectedProduct: Product | undefined;
    let oldQty = 0;
    let variantSize = '';
    let variantColor = '';

    const nextProducts = products.map((prod) => {
      if (prod.id !== data.productId) return prod;
      affectedProduct = prod;

      const nextVariants = prod.variants.map((v) => {
        if (v.id !== data.variantId) return v;
        // The typed number is the PHYSICAL count: free stock + pieces reserved for paid orders.
        oldQty = v.quantity + (reservedMap[v.id] || 0);
        variantSize = v.size;
        variantColor = v.colorName;
        return {
          ...v,
          quantity: Math.max(0, data.newQuantity - (reservedMap[v.id] || 0)),
        };
      });

      const nextTotal = nextVariants.reduce((sum, v) => sum + v.quantity, 0);
      return {
        ...prod,
        variants: nextVariants,
        totalQuantity: nextTotal,
        updatedAt: new Date().toISOString(),
      };
    });

    setProducts(nextProducts);

    // Persist variant update to Supabase
    syncManualStockChange(data.productId, data.variantId, data.newQuantity - oldQty);

    // Audit log
    const delta = data.newQuantity - oldQty;
    const oldProductTotal = affectedProduct?.totalQuantity ?? 0;
    const newProductTotal = oldProductTotal + delta;
    const effectiveReason =
      data.reason && data.reason.trim() !== ''
        ? data.reason.trim()
        : `Stock Adjustment: "${affectedProduct?.name || 'Inventory'}"`;
    const sizeLabel =
      !variantSize || variantSize === 'One Size' || variantSize === 'Standard'
        ? 'Standard Size'
        : variantSize;
    const sizePrefix = sizeLabel === 'Standard Size' ? 'Standard Size' : `Size ${sizeLabel}`;
    const verb = delta >= 0 ? 'Added to inventory' : 'Removed from inventory';

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'stock_adjusted',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Updated inventory for "${affectedProduct?.name || 'Item'}"`,
      details: `${verb}: ${sizePrefix}${variantColor ? ` (${variantColor})` : ''} adjusted from ${oldQty} to ${data.newQuantity} units (${delta > 0 ? `+${delta}` : delta} units). Total units changed from ${oldProductTotal} to ${newProductTotal} units. Reason: ${effectiveReason}. ${data.note ? `Note: ${data.note}` : ''}`,
      productId: data.productId,
      productName: affectedProduct?.name,
      productImage: affectedProduct?.image || affectedProduct?.images?.[0],
      variantSize: sizeLabel,
      variantColor,
      oldQuantity: oldQty,
      newQuantity: data.newQuantity,
      delta,
      totalQuantityBefore: oldProductTotal,
      totalQuantityAfter: newProductTotal,
      reason: effectiveReason,
      note: data.note,
    };
    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Inventory updated: ${affectedProduct?.name || 'Item'} (${sizeLabel}) is now ${data.newQuantity} units.`, newLog);
  };

  // Admin Approves a Worker Request (Persisted to Supabase)
  const handleApproveRequest = (requestId: string, adminNote?: string, skipConfirm?: boolean) => {
    const targetReq = requests.find((r) => r.id === requestId);
    if (!targetReq) return;
    const reservedNow = reservedMap[targetReq.variantId] || 0;
    if (targetReq.requestedQuantity < reservedNow && !skipConfirm) {
      appConfirm({
        title: 'Counted less than reserved',
        message: 'The count is lower than what paid orders are holding. The difference will be marked missing on the latest paid orders, and they will wait for a new batch.',
        facts: [
          { label: 'Counted', value: String(targetReq.requestedQuantity) },
          { label: 'Reserved for paid orders', value: String(reservedNow) },
          { label: 'Marked missing', value: String(reservedNow - targetReq.requestedQuantity) },
        ],
        confirmLabel: 'Approve anyway',
      }).then((ok) => { if (ok) handleApproveRequest(requestId, adminNote, true); });
      return;
    }

    // 1. Update the actual product variant quantity
    const nextProducts = products.map((prod) => {
      if (prod.id !== targetReq.productId) return prod;

      const nextVariants = prod.variants.map((v) => {
        if (v.id !== targetReq.variantId) return v;
        return {
          ...v,
          quantity: Math.max(0, targetReq.requestedQuantity - reservedNow),
        };
      });

      const nextTotal = nextVariants.reduce((sum, v) => sum + v.quantity, 0);
      return {
        ...prod,
        variants: nextVariants,
        totalQuantity: nextTotal,
        updatedAt: new Date().toISOString(),
      };
    });

    setProducts(nextProducts);

    // 2. Mark request as approved
    const nextRequests = requests.map((r) => {
      if (r.id !== requestId) return r;
      return {
        ...r,
        status: 'approved' as const,
        adminNote,
        adminId: currentUser?.id,
        adminName: currentUser?.name,
        reviewedAt: new Date().toISOString(),
      };
    });

    setRequests(nextRequests);

    // 3. Persist to Supabase
    updateAdjustmentRequestInDb(requestId, 'approved', currentUser || undefined, adminNote).catch((err) => {
      console.warn('Supabase approval error:', err.message);
    });
    syncManualStockChange(
      targetReq.productId,
      targetReq.variantId,
      targetReq.requestedQuantity - ((products.find((p) => p.id === targetReq.productId)?.variants.find((v) => v.id === targetReq.variantId)?.quantity ?? 0) + reservedNow)
    );

    // 4. Record Audit Log
    const matchedProd = products.find((p) => p.id === targetReq.productId);
    const oldProductTotal = matchedProd?.totalQuantity || 0;
    const delta = targetReq.requestedQuantity - targetReq.currentQuantity;
    const nextProductTotal = oldProductTotal + delta;

    const approvedSizeLabel =
      !targetReq.size || targetReq.size === 'One Size' || targetReq.size === 'Standard'
        ? 'Standard Size'
        : targetReq.size;
    const approvedSizePrefix = approvedSizeLabel === 'Standard Size' ? 'Standard Size' : `Size ${approvedSizeLabel}`;

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'request_approved',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Approved stock change for "${targetReq.productName}"`,
      details: `Staff ${targetReq.workerName} requested ${targetReq.currentQuantity} → ${
        targetReq.requestedQuantity
      } (${delta > 0 ? `+${delta}` : delta} units) for ${approvedSizePrefix} / ${targetReq.colorName}. Total units changed from ${oldProductTotal} to ${nextProductTotal} units. Reason: ${targetReq.reason}.${
        adminNote ? ` Admin note: ${adminNote}` : ''
      }`,
      productId: targetReq.productId,
      productName: targetReq.productName,
      productImage: targetReq.productImage,
      variantSize: approvedSizeLabel,
      variantColor: targetReq.colorName,
      oldQuantity: targetReq.currentQuantity,
      newQuantity: targetReq.requestedQuantity,
      delta,
      totalQuantityBefore: oldProductTotal,
      totalQuantityAfter: nextProductTotal,
      reason: targetReq.reason,
      note: adminNote || targetReq.workerNote,
    };

    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});
    showToast(`Approved! Stock for ${targetReq.productName} updated to ${targetReq.requestedQuantity} units.`, newLog);
  };

  // Admin Rejects a Worker Request (Persisted to Supabase)
  const handleRejectRequest = (requestId: string, adminNote?: string) => {
    const targetReq = requests.find((r) => r.id === requestId);
    if (!targetReq) return;

    const nextRequests = requests.map((r) => {
      if (r.id !== requestId) return r;
      return {
        ...r,
        status: 'rejected' as const,
        adminNote,
        adminId: currentUser?.id,
        adminName: currentUser?.name,
        reviewedAt: new Date().toISOString(),
      };
    });

    setRequests(nextRequests);

    // Persist to Supabase
    updateAdjustmentRequestInDb(requestId, 'rejected', currentUser || undefined, adminNote).catch((err) => {
      console.warn('Supabase rejection error:', err.message);
    });

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'request_rejected',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Rejected stock change for "${targetReq.productName}"`,
      details: `Count change of ${targetReq.delta > 0 ? `+${targetReq.delta}` : targetReq.delta} units submitted by ${
        targetReq.workerName
      } was rejected. Stock kept at ${targetReq.currentQuantity} units.${
        adminNote ? ` Reason: ${adminNote}` : ''
      }`,
      productId: targetReq.productId,
      productName: targetReq.productName,
    };

    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});
    showToast(`Request rejected. Live stock remains unchanged.`);
  };

  // Admin Approves a pending staff registration (Persisted to Supabase)
  const handleApproveUser = (userId: string) => {
    if (!currentUser) return;
    const targetUser = users.find((u) => u.id === userId);
    const updated = users.map((u) =>
      u.id === userId
        ? {
            ...u,
            status: 'active' as const,
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.id,
            approvedByName: currentUser.name,
          }
        : u
    );
    setUsers(updated);

    // Persist to Supabase
    updateUserStatusInDb(userId, 'active', currentUser).catch((err) => {
      console.warn('Supabase user approval error:', err.message);
      setUsers(users);
      showToast(`Failed to approve account in database: ${err.message}`);
    });

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'staff_approved',
      actorName: currentUser.name,
      actorRole: 'admin',
      summary: `Approved registration for "${targetUser?.name || 'Staff'}"`,
      details: `Account for ${targetUser?.email || (targetUser?.username ? `@${targetUser.username}` : targetUser?.phone || targetUser?.name || 'Staff')} (${targetUser?.requestedRole || targetUser?.role}) activated in Supabase.`,
    };
    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});
    showToast(`Account approved for ${targetUser?.name || 'user'}. They can now log in.`);
  };

  // Admin Rejects a pending staff registration (Persisted to Supabase)
  const handleRejectUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    const updated = users.map((u) =>
      u.id === userId ? { ...u, status: 'rejected' as const } : u
    );
    setUsers(updated);

    // Persist to Supabase
    updateUserStatusInDb(userId, 'rejected', currentUser || undefined).catch((err) => {
      console.warn('Supabase user reject error:', err.message);
      setUsers(users);
      showToast(`Failed to reject account in database: ${err.message}`);
    });

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'staff_rejected',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Declined registration for "${targetUser?.name || 'Staff'}"`,
      details: `Registration for ${targetUser?.email || (targetUser?.username ? `@${targetUser.username}` : targetUser?.phone || targetUser?.name || 'Staff')} was declined.`,
    };
    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});
    showToast(`Registration request declined.`);
  };

  // Admin directly creates a staff or admin account with status 'active' (no approval needed)
  const handleCreateUserDirectly = async (data: {
    name: string;
    email?: string;
    username?: string;
    phone?: string;
    password?: string;
    role: Role;
    assignedTeams?: StoreTeamId[];
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = (data.email || '').toLowerCase().trim() || undefined;
    const cleanUsername = normalizeUsername(data.username) || undefined;
    const cleanPhone = normalizePhoneNumber(data.phone) || undefined;
    const initialTeams = data.role === 'leader' ? [] : data.assignedTeams || [];
    const primaryContact =
      cleanEmail || (cleanUsername ? `@${cleanUsername}` : cleanPhone || data.name.trim());

    if (!cleanEmail && !cleanUsername && !cleanPhone) {
      return {
        success: false,
        error: 'Please enter at least one contact method: Email, Username, or Phone Number.',
      };
    }

    // 1. Check local state
    const existingByEmail = cleanEmail
      ? users.find((u) => (u.email || '').toLowerCase() === cleanEmail)
      : undefined;
    if (existingByEmail && existingByEmail.status === 'active') {
      return { success: false, error: 'An active account with this email address already exists.' };
    }
    if (cleanUsername && users.some((u) => normalizeUsername(u.username) === cleanUsername)) {
      return { success: false, error: 'An account with this username already exists.' };
    }
    if (cleanPhone && users.some((u) => normalizePhoneNumber(u.phone) === cleanPhone)) {
      return { success: false, error: 'An account with this phone number already exists.' };
    }

    const plainPassword = data.password ? data.password.trim() : '';
    if (plainPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters.',
      };
    }

    try {
      // The account is created on the server (Edge Function admin-users, full_admin only).
      // The browser never sees or stores a password hash.
      const { callAdminUsers } = await import('./services/authService');
      const created = await callAdminUsers({
        action: 'create',
        name: data.name.trim(),
        email: cleanEmail,
        username: cleanUsername,
        phone: cleanPhone,
        password: plainPassword,
        role: data.role,
        teams: initialTeams,
      });
      const newUser: User = {
        id: created?.id || `new_${Date.now()}`,
        name: data.name.trim(),
        email: cleanEmail,
        username: cleanUsername,
        phone: cleanPhone,
        role: data.role,
        status: 'active',
        requestedRole: data.role,
        assignedTeams: initialTeams,
        adminTeams: data.role === 'admin' ? initialTeams : [],
        createdAt: new Date().toISOString(),
        avatarColor:
          data.role === 'full_admin'
            ? '#b45309'
            : data.role === 'admin'
            ? '#d97706'
            : data.role === 'leader'
            ? '#059669'
            : '#0284c7',
      };

      setUsers((prev) => [newUser, ...prev]);

      // Record audit log
      const contactLogStr = [cleanEmail, cleanUsername ? `@${cleanUsername}` : '', cleanPhone]
        .filter(Boolean)
        .join(' • ');

      const newLog: AuditLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'staff_approved',
        actorName: currentUser?.name || 'Admin',
        actorRole: 'admin',
        summary: `Created pre-approved account for "${newUser.name}"`,
        details: `Account for ${contactLogStr || newUser.name} (${getRoleDisplayName(newUser.role)}) created directly as Active without approval.`,
      };
      setAuditLogs((prev) => [newLog, ...prev]);
      insertAuditLogInDb(newLog).catch(() => {});

      showToast(`Account created for ${newUser.name}! They can log in immediately.`);
      return { success: true };
    } catch (err: any) {
      console.warn('Direct user creation error:', err?.message);
      const rawMsg = String(err?.message || '');
      if (rawMsg.includes('exceed_egress_quota')) {
        return {
          success: false,
          error:
            'Supabase project is currently restricted by Free Plan monthly egress quota (exceed_egress_quota). To restore database writes, open Supabase Dashboard → Organization Billing to upgrade/remove the spend cap, or connect a new Supabase project.',
        };
      }
      if (rawMsg.includes('user_role') && (rawMsg.includes('leader') || rawMsg.includes('full_admin'))) {
        return {
          success: false,
          error:
            'Database enum "user_role" is missing "leader" or "full_admin". Run the SQL update from Account Approvals → View Supabase SQL.',
        };
      }
      return { success: false, error: rawMsg || 'Failed to create user' };
    }
  };

  const handleUserContactChange = async (
    userId: string,
    username?: string,
    phone?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (currentUser && !isUserAdmin(currentUser)) {
      showToast('Only Admins can update account login credentials.');
      return { ok: false, error: 'Unauthorized' };
    }
    const res = await updateUserContactInDb(userId, username, phone);
    if (!res.ok) {
      showToast(res.error || 'Failed to update username/phone.');
      return { ok: false, error: res.error };
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, username: res.username, phone: res.phone } : u
      )
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({ ...currentUser, username: res.username, phone: res.phone });
    }
    showToast('Updated account login username & phone number.');
    return { ok: true };
  };

  // Batch upsert helper for cross-team Calendar & Board cards
  const upsertCalendarItemsBatch = (itemsToUpsert: CalendarItem[]) => {
    if (itemsToUpsert.length === 0) return;
    lastCalendarMutationAtRef.current = Date.now();
    const byId = new Map(itemsToUpsert.map((it) => [it.id, it]));

    setCalendarEvents((prev) => {
      const updatedExisting = prev.map((ev) => byId.get(ev.id) || ev);
      const existingIds = new Set(prev.map((ev) => ev.id));
      const freshOnes = itemsToUpsert.filter((it) => !existingIds.has(it.id));
      return [...freshOnes, ...updatedExisting];
    });

    itemsToUpsert.forEach((it) => {
      upsertCalendarEventToDb(it).then((res) => {
        if (!res.ok && res.error) {
          showToast(`Database calendar sync error: ${res.error}`);
        }
      });
    });
  };

  // Connected Order Sync across Scout Fera2 Team, Inventory Mgmt Team & Calendar
  const syncOrderTaskToScoutFera2 = (booking: Booking) => {
    const fare2Meta =
      getScoutFare2Meta(booking.troopGroup) ||
      getScoutFare2Meta(booking.assignedFare2);
    const taskId = `task_order_${booking.id}`;
    const invTaskId = `task_inv_${booking.id}`;
    // Teams only see an order (calendar / board tasks) once the deposit is confirmed. An unpaid order
    // creates nothing, and any task made for it earlier is removed.
    const orderIsPaid = Boolean(booking.depositPaid) || booking.status !== 'pending';
    if (!orderIsPaid) {
      const stale = [taskId, invTaskId];
      if (calendarEvents.some((ev) => stale.includes(ev.id))) {
        setCalendarEvents((prev) => prev.filter((ev) => !stale.includes(ev.id)));
        stale.forEach((id) => deleteCalendarEventFromDb(id).catch(() => {}));
      }
      return;
    }
    // The task is dated by the PAYMENT day (not the day the order was created).
    const createdDate = (booking.depositPaidAt || new Date().toISOString()).slice(0, 10);
    const totalUnits = booking.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const itemsSummary = booking.items
      .map(
        (it) =>
          `• ${it.productName} (${!it.size || it.size === 'One Size' || it.size === 'Standard' ? 'Standard' : it.size} / ${it.colorName}) × ${it.quantity}`
      )
      .join('\n');

    // Compute live stock shortages for Inventory Mgmt Calendar & Board card
    const shortLines: string[] = [];
    let totalShortUnits = 0;
    booking.items.forEach((it) => {
      const prod = products.find((p) => p.id === it.productId);
      const variant = prod?.variants.find((v) => v.id === it.variantId);
      const avail = booking.inventoryDeducted ? it.quantity : (variant ? variant.quantity : 0);
      const shortQty = Math.max(0, it.quantity - avail);
      if (shortQty > 0) {
        totalShortUnits += shortQty;
        shortLines.push(`• ${it.productName} (${it.size || 'Std'} / ${it.colorName}): Need ${shortQty} more`);
      }
    });

    const isOrderCompletedOrDelivered = booking.status === 'delivered' || booking.status === 'done';
    const isStockReady = booking.stockCheckStatus === 'ready_for_handover' || isOrderCompletedOrDelivered;

    // 1. Always sync Inventory Management Stock Check Task to Calendar & Board
    const existingInvTask = calendarEvents.find((ev) => ev.id === invTaskId);
    const invBoardStatus: BoardColumnStatus = isStockReady
      ? 'done'
      : booking.stockCheckStatus === 'in_production'
      ? 'in_progress'
      : existingInvTask?.boardStatus || 'upcoming';
    const invMember = users.find(
      (u) => u.status === 'active' && (u.assignedTeams || []).includes('inventory')
    );

    const invTask: CalendarItem = {
      id: invTaskId,
      title: isStockReady
        ? `[Stock Ready] Order #${booking.bookingNumber} — ${booking.clientName}`
        : totalShortUnits > 0
        ? `[Inventory Check] Order #${booking.bookingNumber} (${totalShortUnits} pcs short)`
        : `[Inventory Check] Order #${booking.bookingNumber} — In Stock`,
      itemType: 'task',
      startDate: existingInvTask?.startDate || createdDate,
      endDate: existingInvTask?.endDate || createdDate,
      allDay: true,
      completed: invBoardStatus === 'done',
      boardStatus: invBoardStatus,
      team: 'inventory',
      assignedToId: existingInvTask?.assignedToId || invMember?.id,
      assignedToName: existingInvTask?.assignedToName || invMember?.name,
      troopGroup: fare2Meta?.id,
      location: 'SPS Warehouse',
      linkedBookingId: booking.id,
      workflowStage: 'inventory_check',
      notes: [
        `Order #${booking.bookingNumber} · ${booking.clientName}`,
        totalShortUnits > 0
          ? `Shortage Detected (${totalShortUnits} pcs):\n${shortLines.join('\n')}`
          : 'All requested units are available in warehouse stock.',
        booking.stockCheckStatus === 'in_production'
          ? 'Status: Sent to Purchases / Sourcing for production & restock.'
          : isStockReady
          ? 'Status: Stock confirmed ready for Scout Fera2 handover.'
          : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      createdById: existingInvTask?.createdById || currentUser?.id || 'system',
      createdByName: existingInvTask?.createdByName || currentUser?.name || 'System',
      createdAt: existingInvTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tasksToSync: CalendarItem[] = [invTask];

    if (!fare2Meta && !booking.assignedToId) {
      setCalendarEvents((prev) => {
        if (!prev.some((ev) => ev.id === taskId)) return prev;
        return prev.filter((ev) => ev.id !== taskId);
      });
      deleteCalendarEventFromDb(taskId).catch(() => {});
      upsertCalendarItemsBatch(tasksToSync);
      return;
    }

    const defaultLeader = fare2Meta ? fare2Leaders[fare2Meta.id] : undefined;
    const assignedToId = booking.assignedToId || defaultLeader?.userId || undefined;
    const assignedToName = booking.assignedToName || defaultLeader?.userName || undefined;

    const existingTask = calendarEvents.find((ev) => ev.id === taskId);

    const groupLine = fare2Meta
      ? booking.troopGroup && booking.troopGroup !== fare2Meta.id
        ? `Order Type: ${booking.troopGroup} → Routed to ${fare2Meta.label}`
        : `Scout Fera2: ${fare2Meta.label}`
      : `Order Type: ${booking.troopGroup || 'Afrad (Individual — Not assigned to a group)'}`;

    const workflowNote = isOrderCompletedOrDelivered
      ? 'Handover Status: Delivered to requesting Scout Fera2'
      : booking.stockCheckStatus === 'ready_for_handover'
      ? 'Handover Status: READY AT WAREHOUSE — Collect & deliver to requesting Fera2'
      : booking.stockCheckStatus === 'in_production'
      ? 'Handover Status: In Production / Purchases (awaiting Gard stock-in)'
      : totalShortUnits > 0
      ? `Stock Status: Needs ${totalShortUnits} pcs from Purchases/Production`
      : 'Stock Status: Available in Stock';

    const notesLines = [
      `Order #${booking.bookingNumber} · Client: ${booking.clientName}`,
      booking.clientPhone && booking.clientPhone !== 'N/A' ? `WhatsApp / Phone: ${booking.clientPhone}` : '',
      groupLine,
      workflowNote,
      `Total: ${totalUnits} units · ${booking.total.toFixed(2)} EGP`,
      itemsSummary,
      booking.notes ? `Order Notes: ${booking.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const nextBoardStatus: BoardColumnStatus = isOrderCompletedOrDelivered
      ? 'done'
      : booking.stockCheckStatus === 'ready_for_handover'
      ? 'in_progress'
      : existingTask?.boardStatus || 'upcoming';

    const nextTask: CalendarItem = {
      id: taskId,
      title:
        booking.stockCheckStatus === 'ready_for_handover' && !isOrderCompletedOrDelivered
          ? `[Ready to Deliver] Order #${booking.bookingNumber} — ${booking.clientName}`
          : `Order #${booking.bookingNumber} — ${booking.clientName}`,
      itemType: 'task',
      startDate: existingTask?.startDate || createdDate,
      endDate: existingTask?.endDate || createdDate,
      allDay: existingTask ? existingTask.allDay : true,
      startTime: existingTask?.startTime,
      endTime: existingTask?.endTime,
      completed: nextBoardStatus === 'done',
      boardStatus: nextBoardStatus,
      team: 'troops',
      assignedToId,
      assignedToName,
      troopGroup: fare2Meta?.id,
      location: 'SPS Warehouse',
      linkedBookingId: booking.id,
      workflowStage: booking.stockCheckStatus === 'ready_for_handover' ? 'fera2_handover' : 'order_intake',
      notes: notesLines,
      createdById: existingTask?.createdById || currentUser?.id || 'system',
      createdByName: existingTask?.createdByName || currentUser?.name || 'System',
      createdAt: existingTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasksToSync.push(nextTask);
    upsertCalendarItemsBatch(tasksToSync);
  };

  // Inventory Mgmt -> Purchases Team & Calendar Handoff when stock shortage exists
  // "Needs action" list: paid orders still waiting for stock (from order_stock_owed).
  const [shortageNotes, setShortageNotes] = useState<OrderShortageNote[]>([]);
  const [needsOpen, setNeedsOpen] = useState<NeedsKind>(null);
  const [shortageToStart, setShortageToStart] = useState<OrderShortageNote | null>(null);
  const [shortageGroup, setShortageGroup] = useState<OrderShortageNote[] | null>(null);
  const refreshShortageNotes = () => {
    if (!currentUser) return;
    fetchOrderShortagesFromDb().then(setShortageNotes).catch(() => setShortageNotes([]));
  };
  useEffect(() => {
    refreshShortageNotes();
    const t = setInterval(refreshShortageNotes, 20000);
    const onVis = () => { if (document.visibilityState === 'visible') refreshShortageNotes(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [currentUser?.id, bookings.length, productionBatches.length, activeView]);

  // Low-stock items (variant stock at or below its own minimum) that have no purchase running yet.
  const [lowToStart, setLowToStart] = useState<LowStockNote | null>(null);
  const lowStockNotes: LowStockNote[] = useMemo(() => {
    const out: LowStockNote[] = [];
    products.forEach((p) => {
      p.variants.forEach((v) => {
        if (v.minThreshold === undefined || v.minThreshold === null) return;
        if (!(v.minThreshold > 0) || v.quantity > v.minThreshold) return;
        if (shortageNotes.some((n) => n.variantId === v.id)) return;
        out.push({
          productId: p.id,
          variantId: v.id,
          productName: p.name,
          size: String(v.size),
          colorName: v.colorName,
          quantity: v.quantity,
          minThreshold: v.minThreshold,
          hasBatch: productionBatches.some(
            (b) => b.status === 'in_progress' && b.variantId === v.id
          ),
        });
      });
    });
    return out.sort((a, b) => Number(a.hasBatch) - Number(b.hasBatch) || a.quantity - b.quantity);
  }, [products, shortageNotes, productionBatches]);

  const handleStartLowStockPurchase = (n: LowStockNote, quantity: number, targetDate?: string, vendorId?: string) => {
    const wf = productWorkflows.find((w) => w.productId === n.productId);
    const stageKey: OperationStageKey =
      wf?.activeStages?.find((st) => st !== 'stock_in') ||
      (wf?.workflowType === 'ready_made' ? 'supplier_sourcing' : 'raw_material');
    const batchId = `batch_low_${n.variantId}_${Date.now()}`;
    const batchCode = `PO-LOW-${Date.now().toString().slice(-6)}`;
    const newBatch: ProductionBatch = {
      id: batchId,
      productId: n.productId,
      variantId: n.variantId,
      batchCode,
      quantity: Math.max(1, Math.round(quantity)),
      currentStageKey: stageKey,
      status: 'in_progress',
      targetDate,
      stageAssignments: {
        [stageKey]: {
          ...(vendorId ? { vendorId } : {}),
          notes: `Restock: ${n.productName} (${n.size} / ${n.colorName}) was low (${n.quantity} left).`,
        },
      } as Record<string, BatchStageAssignment>,
      requestedByTeam: 'inventory',
      createdAt: new Date().toISOString(),
    };
    setProductionBatches((prev) => [newBatch, ...prev]);
    upsertProductionBatchToDb(newBatch).catch((err) =>
      showToast(`Database batch sync error: ${err?.message || 'Sync error'}`)
    );
    showToast(`Restock batch ${batchCode} created for ${n.productName} (${quantity} pcs).`);
  };

  const handleSendShortageToPurchases = (
    booking: Booking,
    targetDate?: string,
    customConfigs?: ShortageBatchConfig[]
  ) => {
    const shortItems = booking.items
      .map((it) => {
        const prod = products.find((p) => p.id === it.productId);
        const variant = prod?.variants.find((v) => v.id === it.variantId);
        const available = variant ? variant.quantity : 0;
        const shortQty = Math.max(0, it.quantity - available);
        return { item: it, prod, variant, shortQty };
      })
      .filter((entry) => entry.shortQty > 0);

    const hasCustomConfigs = Array.isArray(customConfigs) && customConfigs.length > 0;
    if (!hasCustomConfigs && shortItems.length === 0) {
      showToast(`Order #${booking.bookingNumber} already has enough stock in warehouse!`);
      return;
    }

    const expectedDate =
      targetDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const purchasesMember = users.find(
      (u) => u.status === 'active' && (u.assignedTeams || []).includes('purchases')
    );
    const fare2Meta =
      getScoutFare2Meta(booking.troopGroup) || getScoutFare2Meta(booking.assignedFare2);

    const createdBatches: ProductionBatch[] = [];
    const createdCalendarTasks: CalendarItem[] = [];

    const entriesToProcess = hasCustomConfigs
      ? customConfigs!.map((cfg) => {
          const item =
            booking.items.find(
              (it) => it.productId === cfg.productId && it.variantId === cfg.variantId
            ) || booking.items.find((it) => it.productId === cfg.productId);
          const prod = products.find((p) => p.id === cfg.productId);
          const matchedShort = shortItems.find(
            (s) => s.item.productId === cfg.productId && s.item.variantId === cfg.variantId
          );
          const owedNote = shortageNotes.find(
            (n) => n.bookingId === booking.id && n.variantId === cfg.variantId
          );
          const minShort = owedNote?.owed ?? matchedShort?.shortQty ?? 1;
          return {
            productId: cfg.productId,
            variantId: cfg.variantId,
            productName: item?.productName || prod?.name || 'Item',
            size: item?.size || 'Std',
            colorName: item?.colorName || 'Default',
            quantity: Math.max(1, Math.round(cfg.quantity || minShort)),
            extraBookingIds: cfg.extraBookingIds,
            extraBookingNumbers: cfg.extraBookingNumbers,
            minShort,
            stageAssignments: (cfg.stageAssignments || {}) as Record<string, BatchStageAssignment>,
            targetDate: cfg.targetDate || expectedDate,
          };
        })
      : shortItems.map((entry) => ({
          productId: entry.item.productId,
          variantId: entry.item.variantId,
          productName: entry.item.productName,
          size: entry.item.size || 'Std',
          colorName: entry.item.colorName || 'Default',
          quantity: entry.shortQty,
          extraBookingIds: undefined as string[] | undefined,
          extraBookingNumbers: undefined as string[] | undefined,
          minShort: entry.shortQty,
          stageAssignments: {} as Record<string, BatchStageAssignment>,
          targetDate: expectedDate,
        }));

    entriesToProcess.forEach((entry, idx) => {
      const wf = productWorkflows.find((w) => w.productId === entry.productId);
      const batchId = `batch_ord_${booking.id}_${entry.variantId}_${Date.now()}_${idx}`;
      const batchCode = `PO-#${[booking.bookingNumber, ...(entry.extraBookingNumbers || [])].join('+')}-${idx + 1}`;
      const firstNonStockStage = wf?.activeStages?.find((s) => s !== 'stock_in');
      const stageKey: OperationStageKey =
        firstNonStockStage ||
        (wf?.workflowType === 'ready_made' ? 'supplier_sourcing' : 'raw_material');

      const mergedStageAssignments: Record<string, BatchStageAssignment> = {
        ...entry.stageAssignments,
      };
      mergedStageAssignments[stageKey] = {
        ...(mergedStageAssignments[stageKey] || {}),
        notes:
          mergedStageAssignments[stageKey]?.notes ||
          `Open batch for Order #${booking.bookingNumber} (${booking.clientName}) — ${entry.size} / ${entry.colorName}`,
      };

      const selectedVendorSummary = Object.entries(mergedStageAssignments)
        .filter(([, val]) => Boolean(val?.vendorId))
        .map(([sKey, val]) => {
          const vObj = vendors.find((v) => v.id === val.vendorId);
          return `${getStageMeta(sKey as OperationStageKey, wf?.customStages).shortLabel}: ${
            vObj?.name || val.vendorId
          }${val.cost ? ` (${val.cost} EGP)` : ''}`;
        })
        .join(' • ');

      const newBatch: ProductionBatch = {
        id: batchId,
        productId: entry.productId,
        variantId: entry.variantId,
        batchCode,
        quantity: entry.quantity,
        currentStageKey: stageKey,
        status: 'in_progress',
        targetDate: entry.targetDate,
        stageAssignments: mergedStageAssignments,
        linkedBookingId: booking.id,
        linkedBookingNumber: booking.bookingNumber,
        extraBookingIds: entry.extraBookingIds && entry.extraBookingIds.length ? entry.extraBookingIds : undefined,
        extraBookingNumbers: entry.extraBookingNumbers,
        requestedByTeam: 'inventory',
        createdAt: new Date().toISOString(),
      };
      createdBatches.push(newBatch);

      createdCalendarTasks.push({
        id: `task_purchase_${batchId}`,
        title: `[Purchases] ${entry.productName} (${entry.quantity} pcs) — Order #${[booking.bookingNumber, ...(entry.extraBookingNumbers || [])].join(', #')}`,
        itemType: 'task',
        startDate: entry.targetDate,
        endDate: entry.targetDate,
        allDay: true,
        completed: false,
        boardStatus: 'in_progress',
        team: 'purchases',
        assignedToId: purchasesMember?.id,
        assignedToName: purchasesMember?.name,
        troopGroup: fare2Meta?.id,
        location: 'Purchases / Suppliers',
        linkedBookingId: booking.id,
        linkedBatchId: batchId,
        workflowStage: 'purchase_order',
        notes: [
          `Requested by Inventory Management for Order #${booking.bookingNumber} (${booking.clientName}).`,
          `Item: ${entry.productName} (${entry.size} / ${entry.colorName})`,
          `Batch Quantity: ${entry.quantity} pcs (Order shortage: ${entry.minShort} pcs — Batch open in Sourcing & Operations)`,
          `Batch Code: ${batchCode}`,
          selectedVendorSummary ? `Assigned Vendors: ${selectedVendorSummary}` : 'Vendors: Open (assign/edit anytime in Sourcing & Operations)',
          `Expected Arrival / Gard Date: ${entry.targetDate}`,
        ].join('\n'),
        createdById: currentUser?.id || 'system',
        createdByName: currentUser?.name || 'System',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    setProductionBatches((prev) => [...createdBatches, ...prev]);
    createdBatches.forEach((b) =>
      upsertProductionBatchToDb(b).catch((err) =>
        showToast(`Database batch sync error: ${err?.message || 'Sync error'}`)
      )
    );

    const bookingVisible = bookings.some((b) => b.id === booking.id);
    if (bookingVisible) {
      lastBookingMutationAtRef.current = Date.now();
      const updatedBooking: Booking = {
        ...booking,
        stockCheckStatus: 'in_production',
        updatedAt: new Date().toISOString(),
      };
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? updatedBooking : b)));
      updateBookingInDb(booking.id, updatedBooking).catch((err) =>
        showToast(`Database booking sync error: ${err?.message || 'Sync error'}`)
      );
      syncOrderTaskToScoutFera2(updatedBooking);
    }

    upsertCalendarItemsBatch(createdCalendarTasks);
    setTimeout(refreshShortageNotes, 1500);

    showToast(
      `Created ${createdBatches.length} open batch(es) in Sourcing & Purchases Calendar (Target: ${expectedDate}).`
    );
  };

  // Inventory Mgmt confirms stock is ready -> Handover to Scout Fera2 Team for client delivery
  const handleConfirmBookingStockReady = (booking: Booking) => {
    lastBookingMutationAtRef.current = Date.now();
    const updatedBooking: Booking = {
      ...booking,
      stockCheckStatus: 'ready_for_handover',
      updatedAt: new Date().toISOString(),
    };
    setBookings((prev) => prev.map((b) => (b.id === booking.id ? updatedBooking : b)));
    updateBookingInDb(booking.id, updatedBooking).catch((err) =>
      showToast(`Database booking sync error: ${err?.message || 'Sync error'}`)
    );
    syncOrderTaskToScoutFera2(updatedBooking);

    showToast(
      `Inventory confirmed ready! Scout Fera2 notified to deliver Order #${booking.bookingNumber}.`
    );
  };

  const handleFare2LeaderChange = (fare2Id: string, leader: Fare2LeaderAssignment | null) => {
    setFare2Leaders((prev) => {
      const next = { ...prev };
      if (leader) next[fare2Id] = leader;
      else delete next[fare2Id];
      return next;
    });
    upsertFare2LeaderInDb(fare2Id, leader).then((res) => {
      if (!res.ok && res.error) {
        showToast(`Database Fare2 leader sync error: ${res.error}`);
      }
    });
    if (!leader) return;
    // Update open unassigned tasks for this Fare2 so they route to the new leader immediately
    setCalendarEvents((prev) =>
      prev.map((ev) => {
        if (
          ev.team === 'troops' &&
          ev.troopGroup === fare2Id &&
          !ev.assignedToId &&
          ev.boardStatus !== 'done'
        ) {
          const updatedEv = {
            ...ev,
            assignedToId: leader.userId,
            assignedToName: leader.userName,
            updatedAt: new Date().toISOString(),
          };
          upsertCalendarEventToDb(updatedEv).then((res) => {
            if (!res.ok && res.error) {
              showToast(`Database calendar sync error: ${res.error}`);
            }
          });
          return updatedEv;
        }
        return ev;
      })
    );
  };

  const handleUserTeamsChange = (
    userId: string,
    assignedTeams: StoreTeamId[],
    assignedFare2: string[]
  ) => {
    if (currentUser && !isUserAdmin(currentUser)) {
      showToast('Only Admins can modify Store Team assignments.');
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, assignedTeams, assignedFare2 } : u))
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({ ...currentUser, assignedTeams, assignedFare2 });
    }
    updateUserTeamAssignmentsInDb(userId, assignedTeams, assignedFare2).then((res) => {
      if (!res.ok && res.error) {
        showToast(`Database team assignment sync error: ${res.error}`);
      }
    });
  };

  // Export Full Inventory Catalog (All Items & Variants) to CSV
  const handleExportCatalogCsv = () => {
    const csvEscape = (val: unknown): string => {
      const s = val === undefined || val === null ? '' : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Product SKU',
      'Product Name',
      'Category',
      'Sub-Folder',
      'Target Audience',
      'Price (EGP)',
      'Materials / Fabrics',
      'Variant SKU',
      'Variant Size',
      'Variant Color',
      'Variant Stock',
      'Low Stock Threshold',
      'Total Product Stock',
      'Location',
      'Description',
    ];

    const rows: string[] = [headers.map(csvEscape).join(',')];
    let exportedRows = 0;

    products.forEach((p) => {
      const variants = p.variants && p.variants.length > 0 ? p.variants : [];
      if (variants.length === 0) {
        exportedRows += 1;
        rows.push(
          [
            p.sku,
            p.name,
            p.category,
            p.folder || '',
            p.targetAudience || 'Unisex',
            p.price !== undefined ? p.price.toFixed(2) : '',
            p.fabricDetails || '',
            '',
            'Standard',
            'Default',
            p.totalQuantity ?? 0,
            5,
            p.totalQuantity ?? 0,
            p.location || '',
            p.description || '',
          ]
            .map(csvEscape)
            .join(',')
        );
      } else {
        variants.forEach((v) => {
          exportedRows += 1;
          rows.push(
            [
              p.sku,
              p.name,
              p.category,
              p.folder || '',
              p.targetAudience || 'Unisex',
              p.price !== undefined ? p.price.toFixed(2) : '',
              p.fabricDetails || '',
              v.sku || '',
              v.size || 'Standard',
              v.colorName || '',
              v.quantity ?? 0,
              v.minThreshold ?? 5,
              p.totalQuantity ?? 0,
              p.location || '',
              p.description || '',
            ]
              .map(csvEscape)
              .join(',')
          );
        });
      }
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sps-inventory-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast(
      `Exported ${products.length} catalog items (${exportedRows} variant rows) to CSV.`
    );
  };

  // Booking Management Handlers
  const handleSaveBooking = (
    newBooking: Booking,
    autoAdvanceToPreparing = false,
    bypassApproval = false
  ) => {
    if (!bypassApproval && !canUserManageOrders(currentUser, users)) {
      if (!canUserEditBookings(currentUser, users)) {
        showToast('View-only access on Orders & Bookings.');
        return;
      }
      handleSubmitTeamRequest({
        teamScope: 'troops',
        entityType: 'booking_create',
        actionType: 'create',
        targetId: newBooking.id,
        title: `Create Order #${newBooking.bookingNumber}`,
        summary: `Client: ${newBooking.clientName} · ${newBooking.total.toFixed(2)} EGP (${newBooking.items.length} item types)`,
        payload: { booking: newBooking, autoAdvanceToPreparing: false },
      });
      return;
    }

    let nextProducts = [...products];
    const variantDbUpdates: { variantId: string; newQty: number; delta: number }[] = [];
    const shortfalls: { variantId: string; owed: number }[] = [];

    // INVENTORY RULE: If created directly in preparing (deposit confirmed upfront), reserve & deduct available stock!
    // Otherwise, booking remains in 'pending' and inventory stock is NOT touched.
    if (autoAdvanceToPreparing) {
      newBooking.items.forEach((item) => {
        const prodIndex = nextProducts.findIndex((p) => p.id === item.productId);
        if (prodIndex >= 0) {
          const prod = nextProducts[prodIndex];
          const nextVariants = prod.variants.map((v) => {
            if (v.id === item.variantId) {
              const deductUnits = Math.min(item.quantity, Math.max(0, v.quantity));
              const updatedQty = Math.max(0, v.quantity - deductUnits);
              if (deductUnits > 0) {
                variantDbUpdates.push({ variantId: v.id, newQty: updatedQty, delta: -deductUnits });
              }
              if (item.quantity > deductUnits) {
                shortfalls.push({ variantId: v.id, owed: item.quantity - deductUnits });
              }
              return {
                ...v,
                quantity: updatedQty,
              };
            }
            return v;
          });
          const nextTotal = nextVariants.reduce((sum, v) => sum + v.quantity, 0);
          nextProducts[prodIndex] = {
            ...prod,
            variants: nextVariants,
            totalQuantity: nextTotal,
            updatedAt: new Date().toISOString(),
          };
        }
      });
      setProducts(nextProducts);
      variantDbUpdates.forEach((u) => {
        applyStockChangeInDb(u.variantId, u.delta, 'order_deduction', newBooking.id).catch((err) => {
          showToast(`Stock was NOT saved in the database: ${err?.message || 'sync failed'}`);
        });
      });
      newBooking.inventoryDeducted = true;
      saveOrderShortfalls(newBooking.id, shortfalls, newBooking);
    }

    lastBookingMutationAtRef.current = Date.now();
    const updatedBookings = [newBooking, ...bookings];
    setBookings(updatedBookings);

    // Sync booking & items to Supabase Database (revert local state only if database rejects save)
    insertBookingInDb(newBooking).catch((err) => {
      console.warn('Notice saving booking to Supabase:', err?.message);
      setBookings((prev) => prev.filter((b) => b.id !== newBooking.id));
      showToast(`Failed to save order to database: ${err?.message || 'Database sync error'}`);
    });

    // Automatically create Scout Fera2 Task for this order
    syncOrderTaskToScoutFera2(newBooking);

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'booking_created',
      actorName: currentUser?.name || 'Staff',
      actorRole: currentUser?.role || 'worker',
      bookingId: newBooking.id,
      bookingNumber: newBooking.bookingNumber,
      bookingItems: newBooking.items,
      reason: `Making Order #${newBooking.bookingNumber}`,
      summary: `Making Order #${newBooking.bookingNumber} for "${newBooking.clientName}"`,
      details: `Making Order #${newBooking.bookingNumber}: Booking created with ${newBooking.items.length} garments (${newBooking.items.reduce((acc, it) => acc + it.quantity, 0)} units total, ${newBooking.total.toFixed(2)} EGP). Status: ${newBooking.status.toUpperCase()}. Deposit required: ${newBooking.depositRequired.toFixed(2)} EGP. ${autoAdvanceToPreparing ? 'Stock reserved and deducted.' : `Inventory stock untouched while pending ${newBooking.depositPercentage || 50}% deposit.`}`,
    };
    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(
      autoAdvanceToPreparing
        ? `Booking ${newBooking.bookingNumber} created & stock reserved and deducted.`
        : `Booking ${newBooking.bookingNumber} created (Awaiting deposit - stock untouched).`,
      newLog
    );
  };
  const handleUpdateBooking = (updatedBooking: Booking) => {
    const prevBooking = bookings.find((b) => b.id === updatedBooking.id);
    const safeBooking: Booking =
      prevBooking &&
      (prevBooking.troopGroup || '') !== (updatedBooking.troopGroup || '') &&
      !canUserManageOrders(currentUser, users)
        ? { ...updatedBooking, troopGroup: prevBooking.troopGroup }
        : updatedBooking;

    lastBookingMutationAtRef.current = Date.now();
    const nextBookings = bookings.map((b) => (b.id === safeBooking.id ? safeBooking : b));
    setBookings(nextBookings);
    insertBookingInDb(safeBooking).catch((err) => {
      console.warn('Notice saving updated booking to Supabase:', err?.message);
      showToast(`Database booking sync error: ${err?.message || 'Sync failed'}`);
    });
    syncOrderTaskToScoutFera2(safeBooking);
  };

  const handleSaveEditedBooking = (editedBooking: Booking, bypassApproval = false) => {
    if (!bypassApproval && !canUserManageOrders(currentUser, users)) {
      if (canUserEditBookings(currentUser, users)) {
        handleSubmitTeamRequest({
          teamScope: 'troops',
          entityType: 'booking_edit',
          actionType: 'update',
          targetId: editedBooking.id,
          title: `Edit Order #${editedBooking.bookingNumber}`,
          summary: `Client: ${editedBooking.clientName} · ${editedBooking.total.toFixed(2)} EGP`,
          payload: { booking: editedBooking },
        });
      } else {
        showToast('You do not have permission to edit bookings.');
      }
      return;
    }
    const existing = bookings.find((b) => b.id === editedBooking.id);
    if (!existing) return;
    if (existing.status !== 'pending' || existing.depositPaid) {
      showToast('Cannot edit this booking because payment has already been confirmed.');
      return;
    }

    lastBookingMutationAtRef.current = Date.now();
    const nextBookings = bookings.map((b) => (b.id === editedBooking.id ? editedBooking : b));
    setBookings(nextBookings);

    insertBookingInDb(editedBooking).catch((err) => {
      console.warn('Notice updating booking in Supabase:', err?.message);
      showToast(`Database booking sync error: ${err?.message || 'Sync failed'}`);
    });
    syncOrderTaskToScoutFera2(editedBooking);

    const changes: string[] = [];
    if (existing.clientName.trim() !== editedBooking.clientName.trim()) {
      changes.push(`Client Name: "${existing.clientName}" → "${editedBooking.clientName}"`);
    }
    if ((existing.troopGroup || '') !== (editedBooking.troopGroup || '')) {
      changes.push(`Troop: "${existing.troopGroup || 'Unassigned'}" → "${editedBooking.troopGroup || 'Unassigned'}"`);
    }
    if ((existing.clientPhone || 'N/A') !== (editedBooking.clientPhone || 'N/A')) {
      changes.push(`Phone: "${existing.clientPhone || 'N/A'}" → "${editedBooking.clientPhone || 'N/A'}"`);
    }
    if ((existing.notes || '').trim() !== (editedBooking.notes || '').trim()) {
      changes.push(`Notes: "${existing.notes?.trim() || 'None'}" → "${editedBooking.notes?.trim() || 'None'}"`);
    }
    if (existing.discount !== editedBooking.discount) {
      changes.push(`Discount: ${existing.discount.toFixed(2)} EGP → ${editedBooking.discount.toFixed(2)} EGP`);
    }

    const oldPct = existing.depositPercentage ?? Math.round((existing.depositRate || 0.5) * 100);
    const newPct = editedBooking.depositPercentage ?? Math.round((editedBooking.depositRate || 0.5) * 100);
    if (oldPct !== newPct) {
      changes.push(`Advance Deposit: ${oldPct}% → ${newPct}%`);
    }

    // Track line-item additions, removals, and quantity adjustments
    const oldItemMap = new Map(existing.items.map((it) => [it.id, it]));
    const newItemMap = new Map(editedBooking.items.map((it) => [it.id, it]));

    editedBooking.items.forEach((it) => {
      const prevIt = oldItemMap.get(it.id);
      const sizeLabel = !it.size || it.size === 'One Size' || it.size === 'Standard' ? 'Standard Size' : it.size;
      if (!prevIt) {
        changes.push(`Added "${it.productName}" (${it.colorName}, ${sizeLabel}): ${it.quantity} pcs`);
      } else if (prevIt.quantity !== it.quantity || prevIt.unitPrice !== it.unitPrice) {
        const parts: string[] = [];
        if (prevIt.quantity !== it.quantity) parts.push(`${prevIt.quantity} → ${it.quantity} pcs`);
        if (prevIt.unitPrice !== it.unitPrice) parts.push(`${prevIt.unitPrice} → ${it.unitPrice} EGP/pc`);
        changes.push(`Updated "${it.productName}" (${it.colorName}, ${sizeLabel}): ${parts.join(', ')}`);
      }
    });

    existing.items.forEach((it) => {
      if (!newItemMap.has(it.id)) {
        const sizeLabel = !it.size || it.size === 'One Size' || it.size === 'Standard' ? 'Standard Size' : it.size;
        changes.push(`Removed "${it.productName}" (${it.colorName}, ${sizeLabel}, ${it.quantity} pcs)`);
      }
    });

    if (existing.total !== editedBooking.total) {
      changes.push(`Total: ${existing.total.toFixed(2)} EGP → ${editedBooking.total.toFixed(2)} EGP`);
    }

    const detailsText =
      changes.length > 0
        ? `Admin updated Order #${editedBooking.bookingNumber}: ${changes.join(' • ')}.`
        : `Admin saved Order #${editedBooking.bookingNumber} (no field changes).`;

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'booking_updated',
      actorName: currentUser?.name || 'Admin',
      actorRole: currentUser?.role || 'admin',
      bookingId: editedBooking.id,
      bookingNumber: editedBooking.bookingNumber,
      bookingItems: editedBooking.items,
      reason: `Updated Order #${editedBooking.bookingNumber}`,
      summary: `Edited unpaid booking #${editedBooking.bookingNumber} for "${editedBooking.clientName}"`,
      details: detailsText,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Booking ${editedBooking.bookingNumber} updated successfully.`, newLog);
  };

  const handleRequestPaymentVerification = (bookingId: string, note?: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;
    if (target.status !== 'pending' || target.depositPaid) {
      showToast('Payment has already been confirmed for this booking.');
      return;
    }

    const updatedBooking: Booking = {
      ...target,
      paymentVerificationRequested: true,
      paymentVerificationRequestedBy: currentUser?.name || 'Staff',
      paymentVerificationRequestedAt: new Date().toISOString(),
      paymentVerificationNote: note,
      updatedAt: new Date().toISOString(),
    };

    lastBookingMutationAtRef.current = Date.now();
    const nextBookings = bookings.map((b) => (b.id === bookingId ? updatedBooking : b));
    setBookings(nextBookings);

    updateBookingInDb(bookingId, updatedBooking).catch((err) => {
      console.warn('Notice saving payment verification request to Supabase:', err?.message);
      showToast(`Database booking sync error: ${err?.message || 'Sync failed'}`);
    });

    const pct = target.depositPercentage || (target.depositRate ? Math.round(target.depositRate * 100) : 50);
    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'booking_payment_verification_requested',
      actorName: currentUser?.name || 'Staff',
      actorRole: currentUser?.role || 'worker',
      bookingId: target.id,
      bookingNumber: target.bookingNumber,
      bookingItems: target.items,
      reason: `Payment Verification Requested - Order #${target.bookingNumber}`,
      summary: `${currentUser?.name || 'Staff'} requested Admin payment verification for Order #${target.bookingNumber}`,
      details: `Staff requested Admin approval to confirm ${pct}% payment (${target.depositRequired.toFixed(2)} EGP) for "${target.clientName}".${note ? ` Ref note: ${note}` : ''}`,
      note,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});
    showToast(`Payment verification request sent for Order #${target.bookingNumber}. Awaiting Admin approval.`, newLog);
  };

  const handleDeclinePaymentVerification = (bookingId: string) => {
    if (!canUserConfirmPayments(currentUser, users)) {
      showToast('Only Admins can approve or decline payment verification requests.');
      return;
    }
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;

    const updatedBooking: Booking = {
      ...target,
      paymentVerificationRequested: false,
      paymentVerificationRequestedBy: undefined,
      paymentVerificationRequestedAt: undefined,
      paymentVerificationNote: undefined,
      updatedAt: new Date().toISOString(),
    };

    lastBookingMutationAtRef.current = Date.now();
    const nextBookings = bookings.map((b) => (b.id === bookingId ? updatedBooking : b));
    setBookings(nextBookings);

    updateBookingInDb(bookingId, updatedBooking).catch((err) => {
      console.warn('Notice declining payment verification in Supabase:', err?.message);
      showToast(`Database booking sync error: ${err?.message || 'Sync failed'}`);
    });

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'booking_updated',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      bookingId: target.id,
      bookingNumber: target.bookingNumber,
      bookingItems: target.items,
      reason: `Payment Verification Declined - Order #${target.bookingNumber}`,
      summary: `Admin declined payment verification request for Order #${target.bookingNumber}`,
      details: `Order #${target.bookingNumber} (${target.clientName}) remains Awaiting Deposit. Payment verification request cleared by Admin.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});
    showToast(`Payment verification request declined for Order #${target.bookingNumber}.`, newLog);
  };

  const handleAdvanceBookingStatus = (
    bookingId: string,
    nextStatus: BookingStatus,
    bypassAdminCheck = false
  ) => {
    if (nextStatus === 'preparing' && !bypassAdminCheck && !canUserConfirmPayments(currentUser, users)) {
      showToast('Only Admins can confirm payment. Please submit a Payment Verification Request.');
      return;
    }
    const nextProducts = [...products];
    const variantDbUpdates: { variantId: string; newQty: number; delta: number }[] = [];
    const shortfalls: { variantId: string; owed: number }[] = [];
    let affectedBooking: Booking | undefined;

    const updatedBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      affectedBooking = { ...b };

      const isAdvancingToPreparing = (b.status === 'pending' && nextStatus === 'preparing');
      let inventoryDeducted = b.inventoryDeducted;

      // CRITICAL INVENTORY DEDUCTION & RESERVATION RULE:
      // Reserve & deduct available warehouse stock when transitioning from Awaiting Deposit ('pending') -> 'preparing'!
      if (isAdvancingToPreparing && !inventoryDeducted) {
        b.items.forEach((item) => {
          const prodIndex = nextProducts.findIndex((p) => p.id === item.productId);
          if (prodIndex >= 0) {
            const prod = nextProducts[prodIndex];
            const nextVariants = prod.variants.map((v) => {
              if (v.id === item.variantId) {
                const deductUnits = Math.min(item.quantity, Math.max(0, v.quantity));
                const updatedQty = Math.max(0, v.quantity - deductUnits);
                if (deductUnits > 0) {
                  variantDbUpdates.push({ variantId: v.id, newQty: updatedQty, delta: -deductUnits });
                }
                if (item.quantity > deductUnits) {
                  shortfalls.push({ variantId: v.id, owed: item.quantity - deductUnits });
                }
                return {
                  ...v,
                  quantity: updatedQty,
                };
              }
              return v;
            });
            const nextTotal = nextVariants.reduce((sum, v) => sum + v.quantity, 0);
            nextProducts[prodIndex] = {
              ...prod,
              variants: nextVariants,
              totalQuantity: nextTotal,
              updatedAt: new Date().toISOString(),
            };
          }
        });
        inventoryDeducted = true;
      }

      const isDone = nextStatus === 'done';
      const updatedB: Booking = {
        ...b,
        status: nextStatus,
        inventoryDeducted,
        depositPaid: nextStatus !== 'pending' ? true : b.depositPaid,
        depositPaidAmount: isDone ? b.total : (nextStatus !== 'pending' ? b.depositRequired : b.depositPaidAmount),
        depositPaidAt: nextStatus === 'preparing' && !b.depositPaidAt ? new Date().toISOString() : b.depositPaidAt,
        finalPaidAmount: isDone ? (b.total - b.depositRequired) : b.finalPaidAmount,
        finalPaidAt: isDone ? new Date().toISOString() : b.finalPaidAt,
        paymentVerificationRequested: nextStatus !== 'pending' ? false : b.paymentVerificationRequested,
        paymentVerificationRequestedBy: nextStatus !== 'pending' ? undefined : b.paymentVerificationRequestedBy,
        paymentVerificationRequestedAt: nextStatus !== 'pending' ? undefined : b.paymentVerificationRequestedAt,
        paymentVerificationNote: nextStatus !== 'pending' ? undefined : b.paymentVerificationNote,
        updatedAt: new Date().toISOString(),
      };

      // Sync booking update to Supabase
      updateBookingInDb(b.id, updatedB).catch((err) => {
        console.warn('Notice updating booking status in Supabase:', err?.message);
      });

      return updatedB;
    });

    if (affectedBooking) {
      setProducts(nextProducts);

      // Persist all deducted variant quantities to Supabase
      variantDbUpdates.forEach((u) => {
        applyStockChangeInDb(u.variantId, u.delta, 'order_deduction', bookingId).catch((err) => {
          showToast(`Stock was NOT saved in the database: ${err?.message || 'sync failed'}`);
        });
      });
      saveOrderShortfalls(bookingId, shortfalls);

      lastBookingMutationAtRef.current = Date.now();
      setBookings(updatedBookings);

      const finalAffected = updatedBookings.find((b) => b.id === bookingId);
      if (finalAffected) {
        syncOrderTaskToScoutFera2(finalAffected);
      }

      const pct = affectedBooking.depositPercentage || (affectedBooking.depositRate ? Math.round(affectedBooking.depositRate * 100) : 50);
      let actionText = '';
      let reasonText = '';

      if (nextStatus === 'preparing') {
        actionText = `${pct}% Deposit Confirmed & Stock Reserved/Deducted`;
        reasonText = `Stock Reservation - Order #${affectedBooking.bookingNumber}`;
      } else if (nextStatus === 'delivered') {
        actionText = 'Delivered to Client';
        reasonText = `Shipment Handover - Order #${affectedBooking.bookingNumber}`;
      } else {
        actionText = 'Fully Paid & Order Closed';
        reasonText = `Order Completed - Final Balance Settled (${affectedBooking.bookingNumber})`;
      }

      const newLog: AuditLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'booking_status_changed',
        actorName: currentUser?.name || 'Admin',
        actorRole: currentUser?.role || 'admin',
        bookingId: affectedBooking.id,
        bookingNumber: affectedBooking.bookingNumber,
        bookingItems: affectedBooking.items,
        reason: reasonText,
        summary: `Booking #${affectedBooking.bookingNumber} moved to ${nextStatus.toUpperCase()}`,
        details: `${actionText} for client "${affectedBooking.clientName}". ${affectedBooking.items.reduce((s, it) => s + it.quantity, 0)} units total.`,
      };
      setAuditLogs([newLog, ...auditLogs]);
      insertAuditLogInDb(newLog).catch(() => {});
      showToast(`Booking ${affectedBooking.bookingNumber}: ${actionText}.`, newLog);
    }
  };

  const handleDeleteBooking = (bookingId: string, bypassAdminCheck = false) => {
    if (!bypassAdminCheck && !canUserManageOrders(currentUser, users)) {
      showToast('Only Admins can delete bookings directly.');
      return;
    }
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;

    if (target.status !== 'pending' || target.depositPaid) {
      showToast('Cannot delete a booking after payment has been confirmed.');
      return;
    }

    lastBookingMutationAtRef.current = Date.now();
    const nextBookings = bookings.filter((b) => b.id !== bookingId);
    setBookings(nextBookings);

    // Delete from Supabase
    deleteBookingFromDb(bookingId).catch((err) => {
      console.warn('Notice deleting booking in Supabase:', err?.message);
      setBookings(bookings);
      showToast(`Database booking delete error: ${err?.message || 'Sync failed'}`);
    });

    // Clean up linked order & inventory tasks
    const linkedTaskIds = [`task_order_${bookingId}`, `task_inv_${bookingId}`];
    setCalendarEvents((prev) => {
      if (!prev.some((ev) => linkedTaskIds.includes(ev.id))) return prev;
      linkedTaskIds.forEach((tid) => {
        deleteCalendarEventFromDb(tid).catch(() => {});
      });
      return prev.filter((ev) => !linkedTaskIds.includes(ev.id));
    });

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'booking_deleted',
      actorName: currentUser?.name || 'Admin',
      actorRole: currentUser?.role || 'admin',
      bookingId: target.id,
      bookingNumber: target.bookingNumber,
      bookingItems: target.items,
      reason: `Deleted Order #${target.bookingNumber}`,
      summary: `Deleted unpaid booking #${target.bookingNumber} for "${target.clientName}"`,
      details: `Admin permanently deleted unpaid booking #${target.bookingNumber} (${target.items.length} items, ${target.total.toFixed(2)} EGP).`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Booking ${target.bookingNumber} deleted.`, newLog);
  };

  // Calendar Events & Tasks Handlers
  const handleSaveCalendarEvent = (item: CalendarItem) => {
    lastCalendarMutationAtRef.current = Date.now();
    const normalizedItem: CalendarItem = {
      ...item,
      boardStatus: item.boardStatus || (item.completed ? 'done' : 'upcoming'),
      completed: item.boardStatus ? item.boardStatus === 'done' : item.completed,
    };
    const isExisting = calendarEvents.some((ev) => ev.id === normalizedItem.id);
    const nextEvents = isExisting
      ? calendarEvents.map((ev) => (ev.id === normalizedItem.id ? normalizedItem : ev))
      : [normalizedItem, ...calendarEvents];

    setCalendarEvents(nextEvents);

    upsertCalendarEventToDb(normalizedItem).then((res) => {
      if (!res.ok && res.error) {
        console.warn('Notice saving calendar item to Supabase:', res.error);
        if (res.error.includes('exceed_egress_quota')) {
          showToast('Database sync error — Supabase quota restricted (exceed_egress_quota).');
        } else {
          showToast(`Database calendar sync error: ${res.error}`);
        }
      }
    });

    const kindLabel = normalizedItem.itemType === 'task' ? 'Task' : 'Event';
    showToast(`${kindLabel} "${normalizedItem.title}" ${isExisting ? 'updated' : 'added to calendar'}.`);
  };

  const handleDeleteCalendarEvent = (id: string) => {
    const target = calendarEvents.find((ev) => ev.id === id);
    if (target) {
      const todayKey = new Date().toISOString().slice(0, 10);
      const effectiveStage: BoardColumnStatus =
        target.completed || target.boardStatus === 'done'
          ? 'done'
          : target.boardStatus === 'in_progress'
          ? 'in_progress'
          : target.boardStatus === 'upcoming'
          ? 'upcoming'
          : target.startDate <= todayKey && (target.endDate || target.startDate) >= todayKey
          ? 'in_progress'
          : 'upcoming';

      if (effectiveStage === 'in_progress') {
        showToast('In Progress items cannot be deleted. Move to Done first.');
        return;
      }
    }

    lastCalendarMutationAtRef.current = Date.now();
    const nextEvents = calendarEvents.filter((ev) => ev.id !== id);
    setCalendarEvents(nextEvents);

    deleteCalendarEventFromDb(id).then((res) => {
      if (!res.ok && res.error) {
        console.warn('Notice deleting calendar item from Supabase:', res.error);
        showToast(`Database calendar delete error: ${res.error}`);
      }
    });

    if (target) {
      showToast(`Removed "${target.title}" from calendar.`);
    }
  };

  // Scout Seasons (Calendar-defined time frames connected to Budgeting)
  const handleSaveScoutSeason = (season: ScoutSeason) => {
    setScoutSeasons((prev) => {
      const exists = prev.some((s) => s.id === season.id);
      return exists ? prev.map((s) => (s.id === season.id ? season : s)) : [...prev, season];
    });
    upsertScoutSeasonToDb(season).catch((err) =>
      showToast(`Database Scout Season sync error: ${err?.message || 'Sync failed'}`)
    );
    showToast(`Scout Season "${season.name}" saved.`);
  };

  const handleDeleteScoutSeason = (seasonId: string) => {
    setScoutSeasons((prev) => prev.filter((s) => s.id !== seasonId));
    deleteScoutSeasonFromDb(seasonId).catch((err) =>
      showToast(`Database Scout Season delete error: ${err?.message || 'Sync failed'}`)
    );
    showToast('Scout Season removed.');
  };

  const handleToggleCalendarTask = (id: string) => {
    lastCalendarMutationAtRef.current = Date.now();
    const target = calendarEvents.find((ev) => ev.id === id);
    if (!target) return;

    const nextDone = !target.completed;
    const nextBoardStatus: BoardColumnStatus = nextDone ? 'done' : 'upcoming';
    const updatedItem: CalendarItem = {
      ...target,
      completed: nextDone,
      boardStatus: nextBoardStatus,
      updatedAt: new Date().toISOString(),
    };

    const nextEvents = calendarEvents.map((ev) => (ev.id === id ? updatedItem : ev));
    setCalendarEvents(nextEvents);

    upsertCalendarEventToDb(updatedItem).then((res) => {
      if (!res.ok && res.error) {
        console.warn('Notice updating task completion in Supabase:', res.error);
        showToast(`Database calendar sync error: ${res.error}`);
      }
    });

    showToast(
      updatedItem.completed
        ? `Marked task "${updatedItem.title}" as completed.`
        : `Reopened task "${updatedItem.title}".`
    );
  };

  const handleMoveBoardItem = (id: string, nextStatus: BoardColumnStatus) => {
    lastCalendarMutationAtRef.current = Date.now();
    const target = calendarEvents.find((ev) => ev.id === id);
    if (!target) return;

    const updatedItem: CalendarItem = {
      ...target,
      boardStatus: nextStatus,
      completed: nextStatus === 'done',
      updatedAt: new Date().toISOString(),
    };

    const nextEvents = calendarEvents.map((ev) => (ev.id === id ? updatedItem : ev));
    setCalendarEvents(nextEvents);

    upsertCalendarEventToDb(updatedItem).then((res) => {
      if (!res.ok && res.error) {
        console.warn('Notice updating board stage in Supabase:', res.error);
        showToast(`Database board sync error: ${res.error}`);
      }
    });

    const stageLabel =
      nextStatus === 'done'
        ? 'Done'
        : nextStatus === 'in_progress'
        ? 'In Progress'
        : 'Upcoming';
    showToast(`Moved "${updatedItem.title}" to ${stageLabel}.`);
  };

  // Sourcing & Operations CRUD Handlers
  const handleSaveVendor = (vendor: Vendor) => {
    setVendors((prev) => {
      const exists = prev.some((v) => v.id === vendor.id);
      return exists ? prev.map((v) => (v.id === vendor.id ? vendor : v)) : [vendor, ...prev];
    });
    upsertVendorToDb(vendor).catch((err) =>
      showToast(`Database vendor sync error: ${err?.message || 'Sync failed'}`)
    );
    showToast(`Saved vendor "${vendor.name}".`);
  };

  const handleDeleteVendor = (vendorId: string) => {
    const target = vendors.find((v) => v.id === vendorId);
    setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    setProductStageVendors((prev) => prev.filter((psv) => psv.vendorId !== vendorId));
    deleteVendorFromDb(vendorId).catch((err) =>
      showToast(`Database vendor delete error: ${err?.message || 'Sync failed'}`)
    );
    showToast(`Removed vendor "${target?.name || 'Vendor'}".`);
  };

  const getEffectiveWorkflowForProduct = (productId: string): ProductWorkflow => {
    const existing = productWorkflows.find((w) => w.productId === productId);
    if (existing && existing.activeStages.length > 0) return existing;
    const prod = products.find((p) => p.id === productId);
    const inferredType =
      existing?.workflowType || (prod ? inferDefaultWorkflowType(prod) : 'manufactured');
    return {
      id: existing?.id || `wf_${productId}`,
      productId,
      workflowType: inferredType,
      activeStages: [...DEFAULT_STAGE_KEYS[inferredType]],
      customStages: existing?.customStages,
      stageLeadTimes: existing?.stageLeadTimes,
      sharedGroupId: existing?.sharedGroupId,
      sharedGroupName: existing?.sharedGroupName,
      templateSourceProductId: existing?.templateSourceProductId,
      updatedAt: existing?.updatedAt,
    };
  };

  const handleSaveWorkflow = (workflow: ProductWorkflow) => {
    const nowIso = workflow.updatedAt || new Date().toISOString();
    const toSync: ProductWorkflow[] = [{ ...workflow, updatedAt: nowIso }];

    if (workflow.sharedGroupId) {
      productWorkflows.forEach((w) => {
        if (
          w.sharedGroupId === workflow.sharedGroupId &&
          w.productId !== workflow.productId
        ) {
          toSync.push({
            ...w,
            workflowType: workflow.workflowType,
            activeStages: [...workflow.activeStages],
            customStages: workflow.customStages ? { ...workflow.customStages } : undefined,
            stageLeadTimes: workflow.stageLeadTimes
              ? { ...workflow.stageLeadTimes }
              : undefined,
            sharedGroupId: workflow.sharedGroupId,
            sharedGroupName: workflow.sharedGroupName,
            updatedAt: nowIso,
          });
        }
      });
    }

    const syncByProductId = new Map(toSync.map((w) => [w.productId, w]));
    setProductWorkflows((prev) => {
      const updated = prev.map((w) => syncByProductId.get(w.productId) || w);
      const existingIds = new Set(prev.map((w) => w.productId));
      const added = toSync.filter((w) => !existingIds.has(w.productId));
      return [...added, ...updated];
    });

    toSync.forEach((wf) => {
      upsertProductWorkflowToDb(wf).catch((err) =>
        showToast(`Database workflow sync error: ${err?.message || 'Sync failed'}`)
      );
    });
  };

  const handleSaveStageVendor = (link: ProductStageVendor) => {
    const sourceWf = productWorkflows.find((w) => w.productId === link.productId);
    const groupProductIds = sourceWf?.sharedGroupId
      ? productWorkflows
          .filter((w) => w.sharedGroupId === sourceWf.sharedGroupId)
          .map((w) => w.productId)
      : [link.productId];
    if (!groupProductIds.includes(link.productId)) {
      groupProductIds.push(link.productId);
    }

    const toUpsert: ProductStageVendor[] = [];
    const siblingLinksToAdd: ProductStageVendor[] = [];
    const updatedMap = new Map<string, ProductStageVendor>();

    // Primary target product link
    updatedMap.set(link.id, link);
    toUpsert.push(link);

    // Mirror onto shared estamba siblings
    groupProductIds.forEach((pid, idx) => {
      if (pid === link.productId) return;
      const existingSibling = productStageVendors.find(
        (l) =>
          l.productId === pid &&
          l.stageKey === link.stageKey &&
          l.vendorId === link.vendorId
      );
      if (existingSibling) {
        const synced: ProductStageVendor = {
          ...existingSibling,
          isPrimary: link.isPrimary,
          approxOrderQty: link.approxOrderQty,
          orderScriptNotes: link.orderScriptNotes,
        };
        updatedMap.set(synced.id, synced);
        toUpsert.push(synced);
      } else {
        const created: ProductStageVendor = {
          id: `psv_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          productId: pid,
          stageKey: link.stageKey,
          vendorId: link.vendorId,
          isPrimary: link.isPrimary,
          approxOrderQty: link.approxOrderQty,
          orderScriptNotes: link.orderScriptNotes,
        };
        siblingLinksToAdd.push(created);
        toUpsert.push(created);
      }
    });

    const groupIdSet = new Set(groupProductIds);
    setProductStageVendors((prev) => {
      const existsPrimary = prev.some((l) => l.id === link.id);
      let next = prev.map((l) => updatedMap.get(l.id) || l);
      if (!existsPrimary) {
        next = [...next, link];
      }
      if (siblingLinksToAdd.length > 0) {
        next = [...next, ...siblingLinksToAdd];
      }
      if (link.isPrimary) {
        next = next.map((l) => {
          if (
            groupIdSet.has(l.productId) &&
            l.stageKey === link.stageKey &&
            l.vendorId !== link.vendorId &&
            l.isPrimary
          ) {
            const cleared = { ...l, isPrimary: false };
            toUpsert.push(cleared);
            return cleared;
          }
          return l;
        });
      }
      return next;
    });

    toUpsert.forEach((item, idx) => {
      upsertProductStageVendorToDb(item).catch((err) => {
        if (idx === 0) {
          showToast(`Database stage vendor sync error: ${err?.message || 'Sync failed'}`);
        }
      });
    });
  };

  const handleDeleteStageVendor = (linkId: string) => {
    const targetLink = productStageVendors.find((l) => l.id === linkId);
    const sourceWf = targetLink
      ? productWorkflows.find((w) => w.productId === targetLink.productId)
      : undefined;

    const idsToDelete = new Set<string>([linkId]);
    if (targetLink && sourceWf?.sharedGroupId) {
      const siblingIds = new Set(
        productWorkflows
          .filter((w) => w.sharedGroupId === sourceWf.sharedGroupId)
          .map((w) => w.productId)
      );
      productStageVendors.forEach((l) => {
        if (
          siblingIds.has(l.productId) &&
          l.stageKey === targetLink.stageKey &&
          l.vendorId === targetLink.vendorId
        ) {
          idsToDelete.add(l.id);
        }
      });
    }

    setProductStageVendors((prev) => prev.filter((l) => !idsToDelete.has(l.id)));
    idsToDelete.forEach((id) => {
      deleteProductStageVendorFromDb(id).catch((err) => {
        if (id === linkId) {
          showToast(`Database stage vendor delete error: ${err?.message || 'Sync failed'}`);
        }
      });
    });
  };

  const handleAddPriceEntry = (entry: VendorPriceEntry) => {
    const baseLink = productStageVendors.find((l) => l.id === entry.productStageVendorId);
    const sourceWf = baseLink
      ? productWorkflows.find((w) => w.productId === baseLink.productId)
      : undefined;

    const entriesToAdd: VendorPriceEntry[] = [entry];
    if (baseLink && sourceWf?.sharedGroupId) {
      const siblingIds = new Set(
        productWorkflows
          .filter(
            (w) =>
              w.sharedGroupId === sourceWf.sharedGroupId &&
              w.productId !== baseLink.productId
          )
          .map((w) => w.productId)
      );
      productStageVendors.forEach((l, idx) => {
        if (
          siblingIds.has(l.productId) &&
          l.stageKey === baseLink.stageKey &&
          l.vendorId === baseLink.vendorId &&
          l.id !== baseLink.id
        ) {
          entriesToAdd.push({
            ...entry,
            id: `vph_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            productStageVendorId: l.id,
          });
        }
      });
    }

    setVendorPriceHistory((prev) => [...entriesToAdd, ...prev]);
    entriesToAdd.forEach((item, idx) => {
      insertVendorPriceEntryToDb(item).catch((err) => {
        if (idx === 0) {
          showToast(`Database price log error: ${err?.message || 'Sync failed'}`);
        }
      });
    });
    showToast(
      entriesToAdd.length > 1
        ? `Logged price ${entry.unitPrice.toLocaleString()} EGP (synced to ${entriesToAdd.length} linked items).`
        : `Logged price ${entry.unitPrice.toLocaleString()} EGP.`
    );
  };

  const handleApplyWorkflowTemplate = (payload: WorkflowTemplateApplication) => {
    const nowIso = new Date().toISOString();
    const targetProd = products.find((p) => p.id === payload.targetProductId);

    if (payload.mode === 'unlink') {
      const targetWf = getEffectiveWorkflowForProduct(payload.targetProductId);
      const unlinked: ProductWorkflow = {
        ...targetWf,
        sharedGroupId: undefined,
        sharedGroupName: undefined,
        updatedAt: nowIso,
      };
      setProductWorkflows((prev) => {
        const exists = prev.some((w) => w.productId === unlinked.productId);
        return exists
          ? prev.map((w) => (w.productId === unlinked.productId ? unlinked : w))
          : [unlinked, ...prev];
      });
      upsertProductWorkflowToDb(unlinked).catch((err) =>
        showToast(`Database unlink sync error: ${err?.message || 'Sync failed'}`)
      );
      showToast(`Unlinked "${targetProd?.name || 'item'}" from shared estamba.`);
      return;
    }

    const sourceWf = getEffectiveWorkflowForProduct(payload.sourceProductId);
    const sourceProd = products.find((p) => p.id === payload.sourceProductId);

    if (payload.mode === 'pipeline_only') {
      const targetWf = getEffectiveWorkflowForProduct(payload.targetProductId);
      const copied: ProductWorkflow = {
        ...targetWf,
        workflowType: sourceWf.workflowType,
        activeStages: [...sourceWf.activeStages],
        customStages: sourceWf.customStages ? { ...sourceWf.customStages } : undefined,
        stageLeadTimes: sourceWf.stageLeadTimes ? { ...sourceWf.stageLeadTimes } : undefined,
        sharedGroupId: undefined,
        sharedGroupName: undefined,
        templateSourceProductId: payload.sourceProductId,
        updatedAt: nowIso,
      };
      setProductWorkflows((prev) => {
        const exists = prev.some((w) => w.productId === copied.productId);
        return exists
          ? prev.map((w) => (w.productId === copied.productId ? copied : w))
          : [copied, ...prev];
      });
      upsertProductWorkflowToDb(copied).catch((err) =>
        showToast(`Database estamba sync error: ${err?.message || 'Sync failed'}`)
      );
      showToast(
        `Copied pipeline estamba from "${sourceProd?.name || 'source'}" to "${
          targetProd?.name || 'item'
        }" (vendors kept independent).`
      );
      return;
    }

    // mode === 'same_all': link into Shared Estamba & sync pipeline + vendors + scripts + prices
    const groupId =
      sourceWf.sharedGroupId ||
      `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const groupName =
      payload.sharedGroupName ||
      sourceWf.sharedGroupName ||
      `${sourceProd?.category || sourceProd?.name || 'Shared'} Estamba`;

    const memberIds = new Set<string>([payload.sourceProductId, payload.targetProductId]);
    if (sourceWf.sharedGroupId) {
      productWorkflows.forEach((w) => {
        if (w.sharedGroupId === sourceWf.sharedGroupId) {
          memberIds.add(w.productId);
        }
      });
    }

    const syncedWorkflows: ProductWorkflow[] = Array.from(memberIds).map((pid) => {
      const base = getEffectiveWorkflowForProduct(pid);
      return {
        ...base,
        workflowType: sourceWf.workflowType,
        activeStages: [...sourceWf.activeStages],
        customStages: sourceWf.customStages ? { ...sourceWf.customStages } : undefined,
        stageLeadTimes: sourceWf.stageLeadTimes ? { ...sourceWf.stageLeadTimes } : undefined,
        sharedGroupId: groupId,
        sharedGroupName: groupName,
        templateSourceProductId:
          pid === payload.sourceProductId
            ? sourceWf.templateSourceProductId
            : payload.sourceProductId,
        updatedAt: nowIso,
      };
    });

    const wfByPid = new Map(syncedWorkflows.map((w) => [w.productId, w]));
    setProductWorkflows((prev) => {
      const updated = prev.map((w) => wfByPid.get(w.productId) || w);
      const existingIds = new Set(prev.map((w) => w.productId));
      const added = syncedWorkflows.filter((w) => !existingIds.has(w.productId));
      return [...added, ...updated];
    });
    syncedWorkflows.forEach((wf) => {
      upsertProductWorkflowToDb(wf).catch((err) =>
        showToast(`Database shared estamba sync error: ${err?.message || 'Sync failed'}`)
      );
    });

    // Clone & sync stage vendors + price history from source onto target
    const sourceLinks = productStageVendors.filter(
      (l) => l.productId === payload.sourceProductId
    );
    const existingTargetLinks = productStageVendors.filter(
      (l) => l.productId === payload.targetProductId
    );
    const sourceKeys = new Set(sourceLinks.map((l) => `${l.stageKey}::${l.vendorId}`));
    const targetIdsToDelete = existingTargetLinks
      .filter((l) => !sourceKeys.has(`${l.stageKey}::${l.vendorId}`))
      .map((l) => l.id);

    const upsertedTargetLinks: ProductStageVendor[] = [];
    const clonedPrices: VendorPriceEntry[] = [];

    sourceLinks.forEach((srcLink, idx) => {
      const matchTarget = existingTargetLinks.find(
        (l) => l.stageKey === srcLink.stageKey && l.vendorId === srcLink.vendorId
      );
      const targetLink: ProductStageVendor = matchTarget
        ? {
            ...matchTarget,
            isPrimary: srcLink.isPrimary,
            approxOrderQty: srcLink.approxOrderQty,
            orderScriptNotes: srcLink.orderScriptNotes,
          }
        : {
            id: `psv_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            productId: payload.targetProductId,
            stageKey: srcLink.stageKey,
            vendorId: srcLink.vendorId,
            isPrimary: srcLink.isPrimary,
            approxOrderQty: srcLink.approxOrderQty,
            orderScriptNotes: srcLink.orderScriptNotes,
          };
      upsertedTargetLinks.push(targetLink);

      const targetHasPrices = vendorPriceHistory.some(
        (ph) => ph.productStageVendorId === targetLink.id
      );
      if (!matchTarget || !targetHasPrices) {
        const srcPrices = vendorPriceHistory.filter(
          (ph) => ph.productStageVendorId === srcLink.id
        );
        srcPrices.forEach((sp, pIdx) => {
          clonedPrices.push({
            ...sp,
            id: `vph_${Date.now()}_${idx}_${pIdx}_${Math.random().toString(36).slice(2, 6)}`,
            productStageVendorId: targetLink.id,
          });
        });
      }
    });

    const deleteSet = new Set(targetIdsToDelete);
    const upsertById = new Map(upsertedTargetLinks.map((l) => [l.id, l]));
    setProductStageVendors((prev) => {
      const filtered = prev
        .filter((l) => !deleteSet.has(l.id))
        .map((l) => upsertById.get(l.id) || l);
      const existingIds = new Set(filtered.map((l) => l.id));
      const added = upsertedTargetLinks.filter((l) => !existingIds.has(l.id));
      return [...filtered, ...added];
    });

    if (clonedPrices.length > 0) {
      setVendorPriceHistory((prev) => [...clonedPrices, ...prev]);
    }

    targetIdsToDelete.forEach((id) => deleteProductStageVendorFromDb(id).catch(() => {}));
    upsertedTargetLinks.forEach((lnk) => upsertProductStageVendorToDb(lnk).catch(() => {}));
    clonedPrices.forEach((entry) => insertVendorPriceEntryToDb(entry).catch(() => {}));

    showToast(
      `Linked "${targetProd?.name || 'item'}" with "${
        sourceProd?.name || 'source'
      }" under "${groupName}" (pipeline & vendors synced).`
    );
  };

  const handleSaveBatch = (batch: ProductionBatch) => {
    setProductionBatches((prev) => {
      const exists = prev.some((b) => b.id === batch.id);
      return exists ? prev.map((b) => (b.id === batch.id ? batch : b)) : [batch, ...prev];
    });
    upsertProductionBatchToDb(batch).catch((err) =>
      showToast(`Database batch sync error: ${err?.message || 'Sync failed'}`)
    );
  };

  // Merge two early batches of the same item (any size/colour): quantities add up, linked orders are combined.
  const handleMergeBatches = (keep: ProductionBatch, absorbed: ProductionBatch) => {
    const primary = keep.linkedBookingId || absorbed.linkedBookingId;
    const pairs: { id: string; num: string }[] = [];
    const add = (id?: string, num?: string) => {
      if (id && id !== primary && !pairs.some((p) => p.id === id)) pairs.push({ id, num: num || '' });
    };
    add(keep.linkedBookingId, keep.linkedBookingNumber);
    (keep.extraBookingIds || []).forEach((id, i) => add(id, keep.extraBookingNumbers?.[i]));
    add(absorbed.linkedBookingId, absorbed.linkedBookingNumber);
    (absorbed.extraBookingIds || []).forEach((id, i) => add(id, absorbed.extraBookingNumbers?.[i]));
    const merged: ProductionBatch = {
      ...keep,
      ...(() => {
        const parts = [...batchVariantParts(absorbed)];
        const loose = absorbed.quantity - parts.reduce((s, p) => s + p.qty, 0);
        const r = addToBatchBreakdown(keep, loose > 0 ? [...parts, { qty: loose }] : parts);
        return { quantity: r.quantity, variantQty: r.variantQty };
      })(),
      linkedBookingId: primary,
      linkedBookingNumber: keep.linkedBookingId ? keep.linkedBookingNumber : absorbed.linkedBookingNumber,
      extraBookingIds: pairs.length ? pairs.map((p) => p.id) : undefined,
      extraBookingNumbers: pairs.length ? pairs.map((p) => p.num) : undefined,
    };
    // Save the merged batch first, then remove the other one.
    setProductionBatches((prev) => prev.map((b) => (b.id === keep.id ? merged : b)));
    upsertProductionBatchToDb(merged)
      .then(() => {
        handleDeleteBatch(absorbed.id);
        showToast(`Merged ${batchLabel(absorbed)} into ${batchLabel(keep)}: now ${merged.quantity} pcs.`);
        setTimeout(refreshShortageNotes, 1000);
      })
      .catch((err) => {
        setProductionBatches((prev) => prev.map((b) => (b.id === keep.id ? keep : b)));
        showToast(`Could not merge: ${err?.message || 'sync failed'}`);
      });
  };

  // Before starting a NEW batch: is there an open batch of the same item still at its first stage?
  type JoinPrompt = {
    batch: ProductionBatch;
    blockedReason?: string;
    variantId?: string;
    quantity: number;
    orders: { id: string; num: string }[];
    startNew: () => void;
  };
  const [joinPrompt, setJoinPrompt] = useState<JoinPrompt | null>(null);
  const askJoinOrStartNew = (
    productId: string,
    variantId: string,
    quantity: number,
    orders: { id: string; num: string }[],
    startNew: () => void
  ) => {
    const open = productionBatches.filter(
      (b) => b.productId === productId && b.status === 'in_progress'
    );
    if (open.length === 0) return startNew();
    const first = firstWorkingStage(productWorkflows.find((w) => w.productId === productId));
    const joinable = open.find((b) => !batchJoinBlockReason(b, first));
    if (joinable) return setJoinPrompt({ batch: joinable, variantId, quantity, orders, startNew });
    setJoinPrompt({ batch: open[0], variantId, blockedReason: batchJoinBlockReason(open[0], first) || undefined, quantity, orders, startNew });
  };
  const popupEstimate = (productId: string, variantId?: string) => {
    const e = estimateProductionDays(productionBatches, productId, variantId);
    if (!e || e.max <= 0) return null;
    const safety = readSafetyDays();
    return { days: e.max + safety, baseDays: e.max, safety };
  };
  const popupMergeTargets = (productId: string) => {
    const first = firstWorkingStage(productWorkflows.find((w) => w.productId === productId));
    return productionBatches.filter((b) => b.productId === productId && b.status === 'in_progress' && !batchJoinBlockReason(b, first));
  };
  const joinVariantText = (productId: string, variantId?: string) => {
    const v = products.find((x) => x.id === productId)?.variants.find((x) => x.id === variantId);
    return v ? ` (size ${v.size} / ${v.colorName})` : '';
  };
  const joinExistingBatch = (p: JoinPrompt) => {
    const b = p.batch;
    const have = new Set([b.linkedBookingId, ...(b.extraBookingIds || [])].filter(Boolean) as string[]);
    const newOnes = p.orders.filter((o) => !have.has(o.id));
    let primary = b.linkedBookingId;
    let primaryNum = b.linkedBookingNumber;
    let list = newOnes;
    if (!primary && newOnes.length > 0) {
      primary = newOnes[0].id;
      primaryNum = newOnes[0].num;
      list = newOnes.slice(1);
    }
    const extraIds = [...(b.extraBookingIds || []), ...list.map((o) => o.id)];
    const extraNums = [...(b.extraBookingNumbers || (b.extraBookingIds || []).map(() => '')), ...list.map((o) => o.num)];
    const updated: ProductionBatch = {
      ...b,
      quantity: addToBatchBreakdown(b, [{ variantId: p.variantId, qty: p.quantity }]).quantity,
      variantQty: addToBatchBreakdown(b, [{ variantId: p.variantId, qty: p.quantity }]).variantQty,
      linkedBookingId: primary,
      linkedBookingNumber: primaryNum,
      extraBookingIds: extraIds.length ? extraIds : undefined,
      extraBookingNumbers: extraIds.length ? extraNums : undefined,
    };
    setProductionBatches((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
    upsertProductionBatchToDb(updated)
      .then(() => {
        showToast(`Added ${p.quantity} pcs${joinVariantText(b.productId, p.variantId)} to ${batchLabel(b)}: now ${updated.quantity} pcs.`);
        setTimeout(refreshShortageNotes, 1000);
      })
      .catch((err) => {
        setProductionBatches((prev) => prev.map((x) => (x.id === b.id ? b : x)));
        showToast(`Could not add to the batch: ${err?.message || 'sync failed'}`);
      });
  };

  const handleDeleteBatch = (batchId: string) => {
    const target = productionBatches.find((b) => b.id === batchId);
    setProductionBatches((prev) => prev.filter((b) => b.id !== batchId));
    deleteProductionBatchFromDb(batchId).catch((err) =>
      showToast(`Database batch delete error: ${err?.message || 'Sync failed'}`)
    );
    showToast(`Deleted batch ${(target ? batchLabel(target) : undefined) || ''}.`);
  };

  // Tell the purchases team (Calendar & Board task, same mechanism used for inventory/Fera2) that production must start.
  const notifyPurchasesOfShortage = (bookingId: string, items: { variantId: string; owed: number }[], bk?: Booking) => {
    const booking = bk || bookings.find((b) => b.id === bookingId);
    const today = new Date().toISOString().slice(0, 10);
    const lines = items.map((it) => {
      const prod = products.find((p) => p.variants.some((v) => v.id === it.variantId));
      const v = prod?.variants.find((x) => x.id === it.variantId);
      return `• ${prod?.name || 'Item'} (${v?.size || 'Std'}${v?.colorName ? ' / ' + v.colorName : ''}): make ${it.owed}`;
    });
    const total = items.reduce((sum, i) => sum + i.owed, 0);
    const purchMember = users.find((u) => u.status === 'active' && (u.assignedTeams || []).includes('purchases') && isUserAdmin(u));
    const task: CalendarItem = {
      id: `task_purch_${bookingId}`,
      title: `[Batch needed] Order #${booking?.bookingNumber || ''} (${total} pcs short)`,
      itemType: 'task',
      startDate: today,
      endDate: today,
      allDay: true,
      completed: false,
      boardStatus: 'upcoming',
      team: 'purchases',
      assignedToId: purchMember?.id,
      assignedToName: purchMember?.name,
      linkedBookingId: bookingId,
      workflowStage: 'purchase_needed',
      notes: `Deposit confirmed, stock was not enough. Start a purchase/production batch in Sourcing & Operations.\n${booking ? `Order #${booking.bookingNumber} · ${booking.clientName}\n` : ''}${lines.join('\n')}`,
      createdById: currentUser?.id || 'system',
      createdByName: currentUser?.name || 'System',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertCalendarItemsBatch([task]);
  };

  // Stock was short when the deposit was confirmed: remember what the order still waits for.
  // The order row is saved a moment after, so retry a few times.
  const saveOrderShortfalls = (bookingId: string, items: { variantId: string; owed: number }[], bk?: Booking) => {
    if (items.length === 0) return;
    notifyPurchasesOfShortage(bookingId, items, bk);
    const total = items.reduce((sum, i) => sum + i.owed, 0);
    showToast(
      `Stock was not enough: ${total} unit(s) are still needed for this order. They will be taken automatically when the linked purchase is received.`
    );
    items.forEach((it) => {
      const attempt = (n: number) => {
        recordOrderShortfallInDb(bookingId, it.variantId, it.owed).catch((err) => {
          if (n < 4) setTimeout(() => attempt(n + 1), 1500 * (n + 1));
          else showToast(`Could not remember the missing stock for this order: ${err?.message || 'sync failed'}`);
        });
      };
      setTimeout(() => attempt(0), 1200);
    });
  };

  // Tell the user BEFORE saving when part of the received goods goes to a waiting order.
  const handleCompleteBatchStockIn = (args: {
    batchId: string;
    finalQuantity: number;
    variantId: string;
    parts?: { variantId: string; qty: number }[];
  }) => {
    if (args.parts && args.parts.length > 1) {
      const parts = args.parts.map((p) => ({ variantId: p.variantId, qty: Math.max(0, Math.round(p.qty)) })).filter((p) => p.qty > 0);
      Promise.all(parts.map((p) => previewBatchReceiveInDb(args.batchId, p.variantId, p.qty).catch(() => null))).then((pvs) => {
        const reservedBy: Record<string, number> = {};
        for (let i = 0; i < parts.length; i++) {
          const pv = pvs[i];
          const pr = products.find((x) => x.id === productionBatches.find((b) => b.id === args.batchId)?.productId);
          const vv = pr?.variants.find((x) => x.id === parts[i].variantId);
          const label = vv ? `size ${vv.size} / ${vv.colorName}` : 'one of the sizes';
          if (pv && pv.owed > 0 && parts[i].qty < pv.owed) {
            showToast(`Cannot complete: the orders on this purchase still need ${pv.owed} pcs of ${label} (Order #${pv.bookingNumber}). The quantity made for it must be at least ${pv.owed}.`);
            return;
          }
          if (pv && pv.reserved > 0) reservedBy[parts[i].variantId] = pv.reserved;
        }
        const totalReserved = Object.values(reservedBy).reduce((s, n) => s + n, 0);
        if (totalReserved > 0) {
          const totalQty = parts.reduce((sum, x) => sum + x.qty, 0);
          appConfirm({
            title: 'Some pieces go to waiting orders',
            message: 'Part of the received goods is deducted for orders that are waiting. The rest goes to stock, per size.',
            facts: [
              { label: 'Received', value: `${totalQty} pcs` },
              { label: 'Deducted for waiting orders', value: `${totalReserved} pcs` },
              { label: 'Added to stock', value: `${totalQty - totalReserved} pcs` },
            ],
            confirmLabel: 'Complete & Stock In',
          }).then((ok) => { if (ok) finishBatchStockIn({ ...args, parts }, reservedBy); });
          return;
        }
        finishBatchStockIn({ ...args, parts }, reservedBy);
      });
      return;
    }
    const qty = Math.max(1, Math.round(args.finalQuantity));
    previewBatchReceiveInDb(args.batchId, args.variantId, qty)
      .catch(() => null)
      .then((pv) => {
        if (pv && pv.owed > 0 && qty < pv.owed) {
          showToast(
            `Cannot complete: this purchase is for Order #${pv.bookingNumber} (${pv.clientName}), which still needs ${pv.owed} pcs. The quantity made must be at least ${pv.owed}.`
          );
          return;
        }
        if (pv && pv.reserved > 0) {
          appConfirm({
            title: `Pieces go to Order #${pv.bookingNumber}`,
            message: `${pv.clientName} is waiting for stock. Part of this batch is deducted for the order, the rest goes to stock.`,
            facts: [
              { label: 'Received', value: `${qty} pcs` },
              { label: 'Deducted for the order', value: `${pv.reserved} pcs` },
              { label: 'Added to stock', value: `${qty - pv.reserved} pcs` },
            ],
            confirmLabel: 'Complete & Stock In',
          }).then((ok) => { if (ok) finishBatchStockIn(args, { [args.variantId]: pv?.reserved || 0 }); });
          return;
        }
        finishBatchStockIn(args, { [args.variantId]: pv?.reserved || 0 });
      });
  };

  const finishBatchStockIn = (
    {
      batchId,
      finalQuantity,
      variantId,
      parts: partsIn,
    }: {
      batchId: string;
      finalQuantity: number;
      variantId: string;
      parts?: { variantId: string; qty: number }[];
    },
    reservedBy: Record<string, number>
  ) => {
    const batch = productionBatches.find((b) => b.id === batchId);
    const product = products.find((p) => p.id === batch?.productId);
    if (!batch || !product) {
      showToast('Batch or product not found.');
      return;
    }

    const parts = partsIn && partsIn.length > 1
      ? partsIn
      : [{ variantId: product.variants.find((v) => v.id === variantId)?.id || product.variants[0]?.id || '', qty: Math.max(1, Math.round(finalQuantity)) }];
    if (parts.length === 0 || !parts[0].variantId) {
      showToast('No variant found on product to receive stock.');
      return;
    }
    const qtyToAdd = parts.reduce((s, p) => s + p.qty, 0);
    const targetVariant = product.variants.find((v) => v.id === parts[0].variantId) || product.variants[0];
    const oldTotal = product.totalQuantity;

    const updatedVariants = product.variants.map((v) => {
      const part = parts.find((p) => p.variantId === v.id);
      return part ? { ...v, quantity: v.quantity + part.qty - (reservedBy[v.id] || 0) } : v;
    });
    const newTotal = updatedVariants.reduce((sum, v) => sum + v.quantity, 0);
    const updatedProduct: Product = {
      ...product,
      variants: updatedVariants,
      totalQuantity: newTotal,
      updatedAt: new Date().toISOString(),
    };

    const nextProducts = products.map((p) => (p.id === product.id ? updatedProduct : p));
    setProducts(nextProducts);
    (async () => {
      for (const part of parts) {
        try {
          const r = await receiveBatchStockInDb(batchId, part.variantId, part.qty);
          if (r.reserved > 0) showToast(`${r.reserved} unit(s) were taken for the waiting order. Stock is now ${r.newQuantity}.`);
          setProducts((prev) => prev.map((p) => p.id !== product.id ? p : (() => { const vs = p.variants.map((v) => (v.id === part.variantId ? { ...v, quantity: r.newQuantity } : v)); return { ...p, variants: vs, totalQuantity: vs.reduce((t, v) => t + v.quantity, 0) }; })()));
          setTimeout(refreshShortageNotes, 800);
        } catch (err: any) {
          showToast(`Database stock update error: ${err?.message || 'Sync failed'}`);
        }
      }
    })();

    // Log audit entry for Gard stock-in (one per size/colour)
    let newLog: AuditLogEntry | undefined;
    parts.forEach((part) => {
      const pv = product.variants.find((v) => v.id === part.variantId);
      if (!pv) return;
      const oldQty = pv.quantity;
      const newQty = oldQty + part.qty - (reservedBy[pv.id] || 0);
      const sizeText = pv.size === 'One Size' || pv.size === 'Standard' ? 'Standard Size' : pv.size;
      const log: AuditLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        action: 'stock_adjusted',
        actorName: currentUser?.name || 'Operations',
        actorRole: currentUser?.role || 'admin',
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        variantSize: sizeText,
        variantColor: pv.colorName,
        oldQuantity: oldQty,
        newQuantity: newQty,
        delta: part.qty,
        totalQuantityBefore: oldTotal,
        totalQuantityAfter: newTotal,
        reason: `Batch Stock-In (Gard): ${batchLabel(batch)}`,
        summary: `Batch ${batchLabel(batch)} Stocked In (+${part.qty}): "${product.name}" [${sizeText} / ${pv.colorName}] (${oldQty} -> ${newQty})`,
        details: `Completed production batch ${batchLabel(batch)}. Stock added via Gard: +${part.qty} pcs (${sizeText} / ${pv.colorName}). Inventory updated from ${oldTotal} to ${newTotal} pcs.`,
      };
      newLog = newLog || log;
      setAuditLogs((prev) => [log, ...prev]);
      insertAuditLogInDb(log).catch(() => {});
    });

    // Auto-log batch stage costs into Vendor Price History
    const todayIso = new Date().toISOString().slice(0, 10);
    const createdLinks: ProductStageVendor[] = [];
    const createdPrices: VendorPriceEntry[] = [];

    Object.entries(batch.stageAssignments || {}).forEach(([stageKeyRaw, assignment]) => {
      const stageKey = stageKeyRaw as ProductStageVendor['stageKey'];
      if (!assignment?.vendorId || !assignment.cost || assignment.cost <= 0) return;

      let link = productStageVendors.find(
        (l) =>
          l.productId === product.id &&
          l.stageKey === stageKey &&
          l.vendorId === assignment.vendorId
      );
      if (!link) {
        const productCustomStages = productWorkflows.find(
          (w) => w.productId === product.id
        )?.customStages;
        link = {
          id: `psv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          productId: product.id,
          stageKey,
          vendorId: assignment.vendorId,
          isPrimary: false,
          approxOrderQty: `${qtyToAdd} ${getStageMeta(stageKey, productCustomStages).defaultUnit}`,
          orderScriptNotes: '',
        };
        createdLinks.push(link);
      }

      createdPrices.push({
        id: `vph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        productStageVendorId: link.id,
        purchaseDate: todayIso,
        unitPrice: Number(assignment.cost),
        quantity: `${qtyToAdd} pcs`,
        notes: `Auto-logged from ${batchLabel(batch)}`,
      });
    });

    if (createdLinks.length > 0) {
      setProductStageVendors((prev) => [...prev, ...createdLinks]);
      createdLinks.forEach((lnk) => upsertProductStageVendorToDb(lnk).catch(() => {}));
    }

    if (createdPrices.length > 0) {
      setVendorPriceHistory((prev) => [...createdPrices, ...prev]);
      createdPrices.forEach((entry) => insertVendorPriceEntryToDb(entry).catch(() => {}));
    }

    // Mark batch completed
    const completedBatch: ProductionBatch = {
      ...batch,
      quantity: qtyToAdd,
      variantId: targetVariant.id,
      variantQty: parts.length > 1 ? Object.fromEntries(parts.map((p) => [p.variantId, p.qty])) : undefined,
      currentStageKey: 'stock_in',
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
    const nextBatches = productionBatches.map((b) => (b.id === batch.id ? completedBatch : b));
    setProductionBatches(nextBatches);
    upsertProductionBatchToDb(completedBatch).catch((err) =>
      showToast(`Database batch sync error: ${err?.message || 'Sync failed'}`)
    );

    // Mark any linked Purchases Team Calendar / Board card as Done
    const purchaseTaskId = `task_purchase_${batch.id}`;
    const purchaseTask = calendarEvents.find(
      (ev) => ev.id === purchaseTaskId || ev.linkedBatchId === batch.id
    );
    if (purchaseTask) {
      upsertCalendarItemsBatch([
        {
          ...purchaseTask,
          completed: true,
          boardStatus: 'done',
          notes: `${purchaseTask.notes ? `${purchaseTask.notes}\n\n` : ''}Gard Stock-In Completed (+${qtyToAdd} pcs) on ${todayIso}`,
          updatedAt: new Date().toISOString(),
        },
      ]);
    }

    // If batch was triggered by an Order shortage & all batches for that booking are completed -> Ready for Scout Fera2 Delivery!
    [batch.linkedBookingId, ...(batch.extraBookingIds || [])].filter(Boolean).forEach((orderId) => {
      const stillOpenForOrder = nextBatches.some(
        (b) => (b.linkedBookingId === orderId || (b.extraBookingIds || []).includes(orderId as string)) && b.status !== 'completed'
      );
      const linkedOrder = bookings.find((b) => b.id === orderId);
      if (linkedOrder && !stillOpenForOrder) {
        lastBookingMutationAtRef.current = Date.now();
        const readyOrder: Booking = {
          ...linkedOrder,
          stockCheckStatus: 'ready_for_handover',
          updatedAt: new Date().toISOString(),
        };
        setBookings((prev) => prev.map((b) => (b.id === linkedOrder.id ? readyOrder : b)));
        updateBookingInDb(linkedOrder.id, readyOrder).catch(() => {});
        syncOrderTaskToScoutFera2(readyOrder);
      }
      if (!linkedOrder && !stillOpenForOrder) {
        // This person cannot read orders (e.g. purchases admin), so the database marks it ready.
        supabase.rpc('mark_booking_ready', { p_booking_id: orderId }).then(({ error }) => {
          if (error) showToast(`Could not mark the order ready: ${error.message}`);
        });
      }
    });

    showToast(
      batch.linkedBookingNumber
        ? `Batch ${batchLabel(batch)} Gard stock-in complete (+${qtyToAdd} pcs)! Order #${batch.linkedBookingNumber} updated for Scout Fera2 delivery.`
        : `Batch ${batchLabel(batch)} stocked in (+${qtyToAdd} pcs to ${product.name}) & vendor prices logged.`,
      newLog
    );
  };

  // Marketing & Offers CRUD Handlers (synced to Calendar & Marketing Team Board)
  const handleSaveMarketingOffer = (offer: MarketingOffer, syncToCalendar: boolean) => {
    setMarketingOffers((prev) => {
      const exists = prev.some((o) => o.id === offer.id);
      return exists ? prev.map((o) => (o.id === offer.id ? offer : o)) : [offer, ...prev];
    });
    upsertMarketingOfferToDb(offer).catch((err) =>
      showToast(`Database marketing offer sync error: ${err?.message || 'Sync failed'}`)
    );

    const eventId = `event_offer_${offer.id}`;
    if (syncToCalendar) {
      const prod = products.find((p) => p.id === offer.productId);
      const mktMember = users.find(
        (u) => u.status === 'active' && (u.assignedTeams || []).includes('marketing')
      );
      const existingEv = calendarEvents.find((ev) => ev.id === eventId);
      const discountDesc =
        offer.offerType === 'percentage'
          ? `${offer.discountPercent}% OFF`
          : offer.offerType === 'fixed_price'
          ? `${offer.offerPrice ?? 0} EGP Promo Price`
          : offer.badgeText || 'Promo Offer';

      upsertCalendarItemsBatch([
        {
          id: eventId,
          title: `[Marketing Offer] ${offer.title} — ${prod?.name || offer.productId} (${discountDesc})`,
          itemType: 'event',
          startDate: offer.startDate,
          endDate: offer.endDate || offer.startDate,
          allDay: true,
          completed: offer.status === 'ended',
          boardStatus:
            offer.status === 'ended'
              ? 'done'
              : offer.status === 'active'
              ? 'in_progress'
              : 'upcoming',
          team: 'marketing',
          assignedToId: existingEv?.assignedToId || mktMember?.id,
          assignedToName: existingEv?.assignedToName || mktMember?.name,
          location: 'SPS Store & Online Catalog',
          linkedOfferId: offer.id,
          workflowStage: 'marketing_promo',
          notes: [
            `Campaign: ${offer.title}`,
            prod ? `Product: ${prod.name} (${prod.sku})` : '',
            `Offer: ${discountDesc}`,
            offer.notes || '',
          ]
            .filter(Boolean)
            .join('\n'),
          createdById: existingEv?.createdById || currentUser?.id || 'system',
          createdByName: existingEv?.createdByName || currentUser?.name || 'Marketing Team',
          createdAt: existingEv?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    } else if (calendarEvents.some((ev) => ev.id === eventId)) {
      handleDeleteCalendarEvent(eventId);
    }

    showToast(`Saved Marketing Offer "${offer.title}".`);
  };

  const handleDeleteMarketingOffer = (offerId: string) => {
    const target = marketingOffers.find((o) => o.id === offerId);
    setMarketingOffers((prev) => prev.filter((o) => o.id !== offerId));
    deleteMarketingOfferFromDb(offerId).catch((err) =>
      showToast(`Database marketing offer delete error: ${err?.message || 'Sync failed'}`)
    );

    const linkedEv = calendarEvents.find((ev) => ev.id === `event_offer_${offerId}`);
    if (linkedEv) {
      setCalendarEvents((prev) => prev.filter((ev) => ev.id !== linkedEv.id));
      deleteCalendarEventFromDb(linkedEv.id).catch(() => {});
    }

    showToast(`Deleted Marketing Offer "${target?.title || ''}".`);
  };

  // Budgeting CRUD Handlers
  const handleSaveBudgetProfile = (profile: ProductBudgetProfile) => {
    setBudgetProfiles((prev) => ({ ...prev, [profile.productId]: profile }));
    upsertProductBudgetProfileToDb(profile).catch((err) =>
      showToast(`Database budget profile sync error: ${err?.message || 'Sync failed'}`)
    );
  };

  const handleAddBudgetExpense = (expense: BudgetExpenseEntry) => {
    setBudgetExpenses((prev) => [expense, ...prev]);
    upsertBudgetExpenseToDb(expense).catch((err) =>
      showToast(`Database expense sync error: ${err?.message || 'Sync failed'}`)
    );
    showToast(`Logged expense "${expense.title}" (${expense.amount} EGP).`);
  };

  const handleDeleteBudgetExpense = (expenseId: string) => {
    setBudgetExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    deleteBudgetExpenseFromDb(expenseId).catch((err) =>
      showToast(`Database expense delete error: ${err?.message || 'Sync failed'}`)
    );
    showToast('Deleted expense entry.');
  };

  const handleSaveBudgetSettings = (settings: BudgetSettings) => {
    setBudgetSettings(settings);
    upsertBudgetSettingsToDb(settings).catch((err) =>
      showToast(`Database budget settings sync error: ${err?.message || 'Sync failed'}`)
    );
  };

  const handleBudgetUpdateProductPrice = (productId: string, newPrice: number) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;
    const updated: Product = {
      ...target,
      price: Math.max(0, newPrice),
      updatedAt: new Date().toISOString(),
    };
    setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    upsertProductToDb(updated).catch((err) =>
      showToast(`Database product price sync error: ${err?.message || 'Sync failed'}`)
    );
    showToast(`Updated "${target.name}" catalog price to ${newPrice} EGP.`);
  };

  // Team Change Requests (Staff request -> Team Admin / Full Admin approval)
  const handleSubmitTeamRequest = (
    draft: Omit<
      TeamChangeRequest,
      'id' | 'status' | 'requestedById' | 'requestedByName' | 'requestedAt'
    >
  ) => {
    if (!currentUser) return;
    const newReq: TeamChangeRequest = {
      ...draft,
      id: `treq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'pending',
      requestedById: currentUser.id,
      requestedByName: currentUser.name,
      requestedAt: new Date().toISOString(),
    };
    setTeamChangeRequests((prev) => [newReq, ...prev]);
    upsertTeamRequestToDb(newReq).then((res) => {
      if (!res.ok && res.error) {
        showToast(`Failed to sync team request: ${res.error}`);
      }
    });
    showToast(`Request "${newReq.title}" sent to Team Admin for approval.`);
  };

  const handleApproveTeamRequest = (req: TeamChangeRequest, adminNote?: string) => {
    if (
      !currentUser ||
      (!isFullAccessAdmin(currentUser, users) &&
        !canUserManageTeamScope(currentUser, req.teamScope, users))
    ) {
      showToast('Only an Admin of this team or Full-Access Admin can approve requests.');
      return;
    }
    if (req.status !== 'pending') return;

    switch (req.entityType) {
      case 'calendar_item':
        if (req.actionType === 'delete') {
          handleDeleteCalendarEvent(req.payload?.id || req.targetId || '');
        } else if (req.payload?.item) {
          handleSaveCalendarEvent(req.payload.item);
        }
        break;
      case 'scout_season':
        if (req.actionType === 'delete') {
          handleDeleteScoutSeason(req.payload?.id || req.targetId || '');
        } else if (req.payload?.season) {
          handleSaveScoutSeason(req.payload.season);
        }
        break;
      case 'booking_create':
        if (req.payload?.booking) {
          handleSaveBooking(
            req.payload.booking,
            Boolean(req.payload.autoAdvanceToPreparing),
            true
          );
        }
        break;
      case 'booking_edit':
        if (req.payload?.booking) {
          handleSaveEditedBooking(req.payload.booking, true);
        }
        break;
      case 'booking_status':
        if (req.payload?.bookingId && req.payload?.nextStatus) {
          handleAdvanceBookingStatus(req.payload.bookingId, req.payload.nextStatus, true);
        }
        break;
      case 'booking_delete':
        if (req.payload?.bookingId || req.targetId) {
          handleDeleteBooking(req.payload?.bookingId || req.targetId || '', true);
        }
        break;
      case 'sourcing_vendor':
        if (req.actionType === 'delete') {
          handleDeleteVendor(req.payload?.vendorId || req.targetId || '');
        } else if (req.payload?.vendor) {
          handleSaveVendor(req.payload.vendor);
        }
        break;
      case 'sourcing_workflow':
        if (req.payload?.workflow) {
          handleSaveWorkflow(req.payload.workflow);
        }
        break;
      case 'sourcing_stage_vendor':
        if (req.actionType === 'delete') {
          handleDeleteStageVendor(req.payload?.linkId || req.targetId || '');
        } else if (req.payload?.link) {
          const link: ProductStageVendor = req.payload.setPrimary
            ? { ...req.payload.link, isPrimary: true }
            : req.payload.link;
          handleSaveStageVendor(link);
        }
        break;
      case 'sourcing_price':
        if (req.payload?.entry) {
          handleAddPriceEntry(req.payload.entry);
        }
        break;
      case 'sourcing_batch':
        if (req.actionType === 'delete') {
          handleDeleteBatch(req.payload?.batchId || req.targetId || '');
        } else if (req.payload?.batch) {
          handleSaveBatch(req.payload.batch);
        }
        break;
      case 'sourcing_stock_in':
        if (req.payload?.batchId) {
          handleCompleteBatchStockIn({
            batchId: req.payload.batchId,
            finalQuantity: req.payload.finalQuantity,
            variantId: req.payload.variantId,
            parts: req.payload.parts,
          });
        }
        break;
      case 'sourcing_template':
        if (req.payload?.targetProductId && req.payload?.mode) {
          handleApplyWorkflowTemplate(req.payload as WorkflowTemplateApplication);
        }
        break;
      case 'marketing_offer':
        if (req.actionType === 'delete') {
          handleDeleteMarketingOffer(req.payload?.offerId || req.targetId || '');
        } else if (req.payload?.offer) {
          handleSaveMarketingOffer(req.payload.offer, Boolean(req.payload.syncToCalendar));
        }
        break;
      case 'budget_profile':
        if (req.payload?.profile) {
          handleSaveBudgetProfile(req.payload.profile);
        }
        break;
      case 'budget_expense':
        if (req.actionType === 'delete') {
          handleDeleteBudgetExpense(req.payload?.expenseId || req.targetId || '');
        } else if (req.payload?.expense) {
          handleAddBudgetExpense(req.payload.expense);
        }
        break;
      case 'budget_settings':
        if (req.payload?.settings) {
          handleSaveBudgetSettings(req.payload.settings);
        }
        break;
      case 'budget_price':
        if (req.payload?.productId && typeof req.payload?.newPrice === 'number') {
          handleBudgetUpdateProductPrice(req.payload.productId, req.payload.newPrice);
        }
        break;
      case 'category':
        if (req.actionType === 'delete') {
          void executeDeleteCategory(req.payload?.categoryId || req.targetId || '');
        } else if (req.payload?.name) {
          void executeAddCategory(req.payload.name, req.payload.description);
        }
        break;
      default:
        break;
    }

    const updatedReq: TeamChangeRequest = {
      ...req,
      status: 'approved',
      reviewedById: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      adminNote: adminNote?.trim() || undefined,
    };
    setTeamChangeRequests((prev) => prev.map((r) => (r.id === req.id ? updatedReq : r)));
    upsertTeamRequestToDb(updatedReq).catch(() => {});
    showToast(`Approved request "${req.title}".`);
  };

  const handleRejectTeamRequest = (req: TeamChangeRequest, adminNote?: string) => {
    if (
      !currentUser ||
      (!isFullAccessAdmin(currentUser, users) &&
        !canUserManageTeamScope(currentUser, req.teamScope, users))
    ) {
      showToast('Only an Admin of this team or Full-Access Admin can reject requests.');
      return;
    }
    if (req.status !== 'pending') return;

    const updatedReq: TeamChangeRequest = {
      ...req,
      status: 'rejected',
      reviewedById: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      adminNote: adminNote?.trim() || undefined,
    };
    setTeamChangeRequests((prev) => prev.map((r) => (r.id === req.id ? updatedReq : r)));
    upsertTeamRequestToDb(updatedReq).catch(() => {});
    showToast(`Rejected request "${req.title}".`);
  };

  // Refresh data from Supabase
  const handleResetData = () => {
    refreshFromSupabase(true);
  };

  // Pending count for alerts (includes pending staff registrations, pending items, and staff booking deposit requests)
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;
  const pendingUsersCount = users.filter((u) => u.status === 'pending').length;
  const pendingProducts = products.filter((p) => p.status === 'pending');
  const pendingProductsCount = pendingProducts.length;
  const pendingCount = isUserAdmin(currentUser) 
    ? (pendingRequestsCount + pendingUsersCount + pendingProductsCount) 
    : pendingRequestsCount;
  const pendingStaffBookingRequestsCount = bookings.filter(
    (b) =>
      Boolean(b.pendingDepositPercentage) ||
      Boolean(b.paymentVerificationRequested && !b.depositPaid && b.status === 'pending')
  ).length;

  // Navigation handler supporting direct routing & RBAC enforcement
  const handleNavigate = (view: string) => {
    if (isUserLeader(currentUser)) {
      if (view !== 'inventory') {
        showToast('Scout Leader accounts have read-only access to the Catalog & Prices.');
      }
      setActiveView('inventory');
      return;
    }
    if (!canUserAccessView(currentUser, view, users)) {
      showToast(
        'You do not have access to this page. Assign the corresponding Store Team in Account Approvals.'
      );
      return;
    }
    if (view === 'add-product') {
      setProductToEdit(undefined);
      setShowAddModal(true);
    } else if (view === 'account-approvals') {
      setApprovalsTab('staff');
      setActiveView('account-approvals');
    } else if (view === 'stock-approvals') {
      setApprovalsTab('stock');
      setActiveView('stock-approvals');
    } else {
      setActiveView(view);
    }
  };

  // Filtered Products
  const categoryTabList = ['All', ...Array.from(new Set([...categories.map((c) => c.name), ...products.map((p) => p.category)]))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.fabricDetails && p.fabricDetails.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = (() => {
      if (selectedCategory === 'All') return true;
      if (selectedCategory === 'Unassigned') {
        return (
          !p.categoryId ||
          p.category === 'Unassigned' ||
          !p.category ||
          p.categoryId === 'none'
        );
      }
      if (p.category?.toLowerCase() === selectedCategory.toLowerCase()) return true;
      if (p.categoryId?.toLowerCase() === selectedCategory.toLowerCase()) return true;

      // Check against current categories list
      const matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase() === selectedCategory.toLowerCase() ||
          c.id.toLowerCase() === selectedCategory.toLowerCase()
      );
      if (matchedCat) {
        if (p.categoryId?.toLowerCase() === matchedCat.id.toLowerCase()) return true;
        if (p.category?.toLowerCase() === matchedCat.name.toLowerCase()) return true;
      }

      // Check standard aliases (e.g. cat_jackets -> Jackets & Outerwear)
      if (p.categoryId && CATEGORY_MAP[p.categoryId.toLowerCase()]?.toLowerCase() === selectedCategory.toLowerCase()) {
        return true;
      }
      return false;
    })();

    const matchesAudience =
      selectedAudience === 'All' ||
      (p.targetAudience || 'Unisex').toLowerCase() === selectedAudience.toLowerCase();

    const matchesLowStock =
      !filterLowStockOnly ||
      p.variants.some((v) => v.minThreshold !== undefined && v.quantity <= v.minThreshold);

    const matchesFolder = (() => {
      if (selectedCategory.toLowerCase() !== 'others') return true;
      if (selectedOtherFolder === 'All Items') return true;
      if (selectedOtherFolder === 'Uncategorized') return !p.folder;
      const pf = normalizeFolderPath(p.folder || '').toLowerCase();
      const target = normalizeFolderPath(selectedOtherFolder).toLowerCase();
      // If user is searching by keyword inside a top-level folder, include sub-sub-folder matches
      if (searchQuery.trim() && !target.includes(' / ')) {
        return pf === target || pf.startsWith(`${target} / `);
      }
      return pf === target;
    })();

    return matchesSearch && matchesCategory && matchesAudience && matchesLowStock && matchesFolder;
  });

  // Sub-sub-folders visible as large item-sized Folder Cards in the main grid when browsing a top-level Others sub-folder
  const visibleSubSubFolders = React.useMemo(() => {
    if (selectedCategory.toLowerCase() !== 'others') return [];
    if (selectedOtherFolder === 'All Items' || selectedOtherFolder.includes(' / ')) return [];
    if (searchQuery.trim()) return [];
    const parentLower = selectedOtherFolder.toLowerCase();
    return allFolderPaths.filter((path) => {
      if (!path.includes(' / ')) return false;
      const { parent } = getFolderParts(path);
      return parent.toLowerCase() === parentLower;
    });
  }, [selectedCategory, selectedOtherFolder, searchQuery, allFolderPaths]);

  // KPI Calculations
  const activeProducts = products.filter((p) => isUserAdmin(currentUser) || p.status !== 'pending');
  const totalUnits = activeProducts.reduce((sum, p) => sum + p.totalQuantity, 0);
  const lowStockCount = activeProducts.filter((p) =>
    p.variants.some((v) => v.minThreshold !== undefined && v.quantity <= v.minThreshold)
  ).length;

  // Not logged in -> Show Dual Authentication Screens
  if (!currentUser) {
    return <AuthScreens onLogin={handleLogin} />;
  }

  const isAdmin = isUserAdmin(currentUser);
  const isLeader = isUserLeader(currentUser);
  const canEditProductMedia = canEditProductMediaAndColors(currentUser);
  const resolvedActiveView =
    activeView === 'approvals'
      ? approvalsTab === 'staff'
        ? 'account-approvals'
        : 'stock-approvals'
      : activeView;
  const effectiveView = !canUserAccessView(currentUser, resolvedActiveView, users)
    ? 'inventory'
    : resolvedActiveView;
  const showAccountKpi = canUserAccessView(currentUser, 'account-approvals', users);
  const showStockKpi = !showAccountKpi && canUserAccessView(currentUser, 'stock-approvals', users);
  const showWorkerReqKpi =
    !showAccountKpi && !showStockKpi && canUserAccessView(currentUser, 'worker-requests', users);
  const showQueueKpiCard = !isLeader && (showAccountKpi || showStockKpi || showWorkerReqKpi);

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20 md:pb-8 selection:bg-amber-500/20 selection:text-amber-900 print:hidden">
        {/* Top Bar Header */}
        <Header
        currentUser={currentUser}
        users={users}
        activeView={effectiveView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        pendingCount={pendingCount}
        pendingStockCount={pendingRequestsCount}
        pendingAccountsCount={pendingUsersCount}
        pendingBookingsCount={bookings.filter((b) => b.status === 'pending' || Boolean(b.pendingDepositPercentage) || Boolean(b.paymentVerificationRequested && !b.depositPaid)).length}
        pendingAuditNotificationsCount={pendingStaffBookingRequestsCount}
        approvalsTab={approvalsTab}
      />

      {/* Main View Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex-1 w-full">
        {/* VIEW 1: CATALOG & INVENTORY */}
        {effectiveView === 'inventory' && (
          <div className="space-y-6">
            {/* KPI Metric Strip in Clean Light Mode (hidden for Scout Leader) */}
            {!isLeader && (
            <div className={`grid grid-cols-2 ${showQueueKpiCard ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
              <button
                type="button"
                onClick={() => {
                  setFilterLowStockOnly(false);
                  setSelectedCategory('All');
                  setSelectedAudience('All');
                  setSelectedOtherFolder('All Items');
                  setSearchQuery('');
                  setActiveView('inventory');
                }}
                title="Reset all filters and show all catalogue items"
                className={`text-left p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
                  filterLowStockOnly ||
                  selectedCategory !== 'All' ||
                  selectedAudience !== 'All' ||
                  selectedOtherFolder !== 'All Items' ||
                  searchQuery.trim() !== ''
                    ? 'bg-white border-slate-200/90 hover:border-amber-400 hover:bg-amber-50/40'
                    : 'bg-slate-900/5 border-slate-300'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Items
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {activeProducts.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {filterLowStockOnly ||
                  selectedCategory !== 'All' ||
                  selectedAudience !== 'All' ||
                  selectedOtherFolder !== 'All Items' ||
                  searchQuery.trim() !== ''
                    ? 'Click to show all items'
                    : 'Active catalogue items'}
                </div>
              </button>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Units In Stock
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {totalUnits}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Sum of all size/colors</div>
              </div>

              {/* Account Approvals / Stock Approvals / My Requests KPI Card (RBAC-scoped) */}
              {showQueueKpiCard && (
                <div
                  onClick={() =>
                    handleNavigate(
                      showAccountKpi
                        ? 'account-approvals'
                        : showStockKpi
                        ? 'stock-approvals'
                        : 'worker-requests'
                    )
                  }
                  className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
                    (showAccountKpi ? pendingUsersCount : pendingRequestsCount) > 0
                      ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center justify-between">
                    <span>
                      {showAccountKpi
                        ? 'Account Approvals'
                        : showStockKpi
                        ? 'Stock Approvals'
                        : 'My Requests'}
                    </span>
                    {(showAccountKpi ? pendingUsersCount : pendingRequestsCount) > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    )}
                  </div>
                  <div className="text-2xl font-black font-mono tabular-nums text-amber-900 mt-1">
                    {showAccountKpi ? pendingUsersCount : pendingRequestsCount}
                  </div>
                  <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                    {showAccountKpi
                      ? pendingUsersCount > 0
                        ? `${pendingUsersCount} staff account${pendingUsersCount > 1 ? 's' : ''} awaiting approval`
                        : 'All accounts active • 0 pending'
                      : pendingRequestsCount > 0
                      ? `${pendingRequestsCount} awaiting review`
                      : 'All requests processed'}
                  </div>
                </div>
              )}

              {/* Low Stock KPI */}
              <div
                onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
                className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
                  filterLowStockOnly
                    ? 'bg-rose-50 border-rose-300 text-slate-900'
                    : lowStockCount > 0
                    ? 'bg-white border-rose-200 hover:border-rose-300'
                    : 'bg-white border-slate-200/90'
                }`}
              >
                <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                  Low Stock Items
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-rose-700 mt-1">
                  {lowStockCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {filterLowStockOnly ? 'Filtered: click to reset' : 'Click to filter low stock'}
                </div>
              </div>
            </div>
            )}

            {/* Search & Filter Controls */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by item name, SKU, or description..."
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {!isLeader && (
                  <button
                    type="button"
                    onClick={handleExportCatalogCsv}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs shadow-sm transition-all min-h-[44px]"
                    title="Export all inventory items, variants, prices, fabrics & low-stock thresholds to CSV"
                  >
                    <Download className="w-4 h-4 text-emerald-700" />
                    <span>Export CSV</span>
                  </button>
                )}

                {!isLeader && canUserAccessView(currentUser, 'add-product', users) && (
                  <button
                    onClick={() => {
                      setProductToEdit(undefined);
                      setShowAddModal(true);
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all min-h-[44px]"
                    title={isAdmin ? 'Add New Item to Catalog' : 'Submit New Item for Approval'}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAdmin ? 'Add New Item' : '+ Add New Item'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Department / Audience Filter Pills (Men, Women, Kids, Unisex) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                Audience:
              </span>
              {(['All', 'Men', 'Women', 'Kids', 'Unisex'] as const).map((aud) => {
                const isSelected = selectedAudience === aud;
                const count = aud === 'All' 
                  ? products.length 
                  : products.filter(p => (p.targetAudience || 'Unisex') === aud).length;
                return (
                  <button
                    key={aud}
                    onClick={() => setSelectedAudience(aud)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <span>{aud}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                      isSelected ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
              <div className="flex items-center gap-1.5 shrink-0">
                {categoryTabList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {!isLeader && (
                <button
                  onClick={() => setShowManageCategoriesModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0 shadow-2xs hover:border-slate-300 ml-auto"
                  title="Manage Categories"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">Manage Categories</span>
                </button>
              )}
            </div>

            {/* Sub-Folders inside Others Category */}
            {selectedCategory.toLowerCase() === 'others' && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-2xs">
                      📁
                    </span>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                        Others Sub-Folders
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Browse items classified into organized sub-folders
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingFolderPath(null);
                          setRenameFolderInput('');
                          setConfirmDeleteFolderPath(null);
                          setShowEditFoldersModal(true);
                        }}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-xs border border-amber-500/70 transition-all flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Edit Folders</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const activeTop = selectedOtherFolder !== 'All Items' ? getFolderParts(selectedOtherFolder).parent : '';
                          setNewFolderParentInput(activeTop);
                          setNewFolderNameInput('');
                          setShowNewFolderModal(true);
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>
                          {selectedOtherFolder !== 'All Items' && !selectedOtherFolder.includes(' / ')
                            ? '+ New Sub-Folder'
                            : '+ New Folder'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Top-Level Sub-Folder Selector Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {topLevelOthersFolders.map((f) => {
                    const activeParent = getFolderParts(selectedOtherFolder).parent;
                    const isSelected =
                      f === 'All Items'
                        ? selectedOtherFolder === 'All Items'
                        : activeParent.toLowerCase() === f.toLowerCase();
                    const count =
                      f === 'All Items'
                        ? products.filter((p) => p.category?.toLowerCase() === 'others').length
                        : products.filter((p) => {
                            if (p.category?.toLowerCase() !== 'others') return false;
                            const pf = normalizeFolderPath(p.folder || '').toLowerCase();
                            const target = f.toLowerCase();
                            return pf === target || pf.startsWith(`${target} / `);
                          }).length;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setSelectedOtherFolder(f)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white border border-amber-200 text-slate-700 hover:bg-amber-100 hover:border-amber-300'
                        }`}
                      >
                        <span>📁 {f}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900 font-bold'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Breadcrumb bar when drilled into a Sub-Sub-Folder */}
                {selectedOtherFolder.includes(' / ') && (() => {
                  const { parent, child } = getFolderParts(selectedOtherFolder);
                  return (
                    <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                        <button
                          type="button"
                          onClick={() => setSelectedOtherFolder(parent)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-slate-800 text-xs font-bold transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back to {parent}</span>
                        </button>
                        <span className="text-amber-700 mx-1">›</span>
                        <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 border border-sky-200 font-black">
                          📁 {child}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Product Grid (including Large Sub-Sub-Folder Cards) or Clean Empty State */}
            {products.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto my-12 shadow-sm">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No products</h3>
                <p className="text-xs text-slate-500 mt-1">No apparel products have been added yet.</p>
                {isAdmin && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setProductToEdit(undefined);
                        setShowAddModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl shadow-sm transition-all min-h-[40px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Item</span>
                    </button>
                  </div>
                )}
              </div>
            ) : filteredProducts.length === 0 && visibleSubSubFolders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md mx-auto my-8 shadow-sm">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-900">No items match filters</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Try adjusting your search query or department/category filters.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setSelectedAudience('All');
                    setFilterLowStockOnly(false);
                    setSelectedOtherFolder('All Items');
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl shadow-sm"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleSubSubFolders.map((subPath) => {
                  const { parent, child } = getFolderParts(subPath);
                  const leafName = child || subPath;
                  const subCount = products.filter(
                    (p) =>
                      p.category?.toLowerCase() === 'others' &&
                      normalizeFolderPath(p.folder || '').toLowerCase() === subPath.toLowerCase()
                  ).length;

                  return (
                    <div
                      key={subPath}
                      onClick={() => setSelectedOtherFolder(subPath)}
                      className="rounded-2xl overflow-hidden shadow-sm transition-all flex flex-col group bg-white border border-slate-200/90 hover:shadow-md hover:border-sky-300 cursor-pointer"
                    >
                      {/* Clean Blue Rounded Folder Visual Box Matching Item Card Aspect */}
                      <div className="relative aspect-[4/3] bg-slate-50/70 border-b border-slate-100 flex flex-col items-center justify-center p-6">
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-white/95 border border-slate-200 text-[11px] font-bold text-slate-700 shadow-2xs flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-sky-600" />
                          <span>Sub-Folder</span>
                        </div>

                        {isAdmin && (
                          <div
                            className="absolute top-3 right-3 flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteFolderPath(null);
                                setRenamingFolderPath(subPath);
                                setRenameFolderInput(leafName);
                                setShowEditFoldersModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-500/70 shadow-xs transition-all"
                              title={`Rename "${leafName}"`}
                            >
                              <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingFolderPath(null);
                                setConfirmDeleteFolderPath(subPath);
                                setShowEditFoldersModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 shadow-xs transition-all"
                              title={`Delete "${leafName}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Large Sky-Blue Rounded Folder Illustration */}
                        <svg
                          viewBox="0 0 120 96"
                          className="w-36 h-28 drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                          aria-hidden="true"
                        >
                          <path
                            d="M10 18C10 12.477 14.477 8 20 8H42.5C45.8 8 48.9 9.6 50.8 12.3L54.2 17H100C105.523 17 110 21.477 110 27V38H10V18Z"
                            fill="#0284C7"
                          />
                          <rect
                            x="6"
                            y="26"
                            width="108"
                            height="62"
                            rx="14"
                            fill="#0EA5E9"
                          />
                          <rect
                            x="6"
                            y="26"
                            width="108"
                            height="10"
                            rx="5"
                            fill="#38BDF8"
                            fillOpacity="0.45"
                          />
                        </svg>
                      </div>

                      {/* Folder Metadata Footer Matching ProductCard Spacing */}
                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5 font-medium">
                            <span className="font-mono text-sky-700 font-bold">FOLDER</span>
                            <span aria-hidden="true">·</span>
                            <span>Others</span>
                            <span aria-hidden="true">›</span>
                            <span className="font-bold text-slate-700">{parent}</span>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-1">
                            {leafName}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Click to view items inside {leafName}
                          </p>
                        </div>

                        <div className="pt-3.5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold font-mono tabular-nums text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            {subCount} {subCount === 1 ? 'item' : 'items'}
                          </span>
                          <span className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 group-hover:bg-sky-600 group-hover:text-white text-xs font-bold transition-colors flex items-center gap-1">
                            <span>Open</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredProducts.map((product) => {
                  const promoInfo = getEffectiveProductOffer(product, marketingOffers);
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      userRole={normalizeRole(currentUser.role)}
                      canEditMedia={canEditProductMedia}
                      activeOffer={promoInfo?.offer || null}
                      onOpenDetails={(p) => setDetailProduct(p)}
                      onRequestAdjustment={(p, variant) => {
                        if (isLeader) return;
                        setAdjustmentTarget({ product: p, variant });
                      }}
                      onEditProduct={(p) => {
                        if (isLeader || (!isAdmin && !canEditProductMedia)) return;
                        setProductToEdit(p);
                        setProductEditScope(isAdmin ? 'full' : 'marketing');
                        setShowAddModal(true);
                      }}
                      onDeleteProduct={(p) => {
                        if (!isAdmin) return;
                        setProductToDelete(p);
                      }}
                      onApproveProduct={handleApproveProduct}
                      onOpenBooking={(p) => {
                        if (isLeader || !canUserAccessView(currentUser, 'bookings', users)) {
                          if (!isLeader) {
                            showToast('Orders & Bookings requires Scout Fera2 Team access.');
                          }
                          return;
                        }
                        setBookingModalProduct(p);
                        setIsBookingModalOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 1B: ADMIN ANALYTICS & PRODUCTION DASHBOARD */}
        {effectiveView === 'analytics' && canUserAccessView(currentUser, 'analytics', users) && (
          <AdminAnalyticsView
            bookings={bookings}
            products={products}
            currentUser={currentUser}
            users={users}
            onShowToast={showToast}
          />
        )}

        {/* VIEW 2A: STOCK APPROVALS (Stock adjustments queue + New item submissions) */}
        {effectiveView === 'stock-approvals' && canUserAccessView(currentUser, 'stock-approvals', users) && (
          <ApprovalsView
            mode="stock"
            requests={requests}
            users={users}
            currentUser={currentUser}
            pendingProducts={pendingProducts}
            initialTab={approvalsTab === 'staff' ? 'stock' : approvalsTab}
            onRefreshFromDb={() => refreshFromSupabase(true)}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onApproveUser={handleApproveUser}
            onRejectUser={handleRejectUser}
            onDeleteUser={handleDeleteUser}
            onUpdateUserRole={handleUpdateUserRole}
            onUpdateUserTeams={handleUserTeamsChange}
            onUpdateUserContact={handleUserContactChange}
            onCreateUserDirectly={handleCreateUserDirectly}
            onApproveProduct={handleApproveProduct}
            onRejectProduct={handleRejectProduct}
          />
        )}

        {/* VIEW 2B: ACCOUNT APPROVALS (Dedicated Staff Accounts & Registration Approvals) */}
        {effectiveView === 'account-approvals' && canUserAccessView(currentUser, 'account-approvals', users) && (
          <ApprovalsView
            mode="accounts"
            requests={requests}
            users={users}
            currentUser={currentUser}
            pendingProducts={pendingProducts}
            initialTab="staff"
            onRefreshFromDb={() => refreshFromSupabase(true)}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onApproveUser={handleApproveUser}
            onRejectUser={handleRejectUser}
            onDeleteUser={handleDeleteUser}
            onUpdateUserRole={handleUpdateUserRole}
            onUpdateUserTeams={handleUserTeamsChange}
            onUpdateUserContact={handleUserContactChange}
            onCreateUserDirectly={handleCreateUserDirectly}
            onApproveProduct={handleApproveProduct}
            onRejectProduct={handleRejectProduct}
          />
        )}

        {/* VIEW 3: WORKER REQUESTS */}
        {effectiveView === 'worker-requests' && canUserAccessView(currentUser, 'worker-requests', users) && (
          <WorkerRequestsView
            requests={requests}
            currentUser={currentUser}
            onNavigateToCatalog={() => setActiveView('inventory')}
          />
        )}

        {/* VIEW 4: AUDIT LOG */}
        {effectiveView === 'audit-log' && canUserAccessView(currentUser, 'audit-log', users) && (
          <AuditLogView
            logs={auditLogs}
            products={products}
            bookings={bookings}
            pendingAuditNotificationsCount={pendingStaffBookingRequestsCount}
            onViewProduct={(pId) => {
              const p = products.find((prod) => prod.id === pId);
              if (p) setDetailProduct(p);
            }}
            onViewBooking={handleOpenBookingDetails}
          />
        )}

        {shortageToStart && (
          <ShortageStartModal
            currentStock={products.flatMap((p) => p.variants).find((v) => v.id === shortageToStart.variantId)?.quantity ?? 0}
            minStock={products.flatMap((p) => p.variants).find((v) => v.id === shortageToStart.variantId)?.minThreshold}
            note={shortageToStart}
            estimate={popupEstimate(shortageToStart.productId, shortageToStart.variantId)}
            mergeTargets={popupMergeTargets(shortageToStart.productId)}
            onMerge={(batch, quantity) => {
              const n = shortageToStart;
              setShortageToStart(null);
              joinExistingBatch({ batch, variantId: n.variantId, quantity, orders: [{ id: n.bookingId, num: n.bookingNumber }], startNew: () => {} });
            }}
            onCancel={() => setShortageToStart(null)}
            onConfirm={(quantity, targetDate) => {
              const vendorId: string | undefined = undefined;
              const n = shortageToStart;
              setShortageToStart(null);
              const stub = {
                id: n.bookingId,
                bookingNumber: n.bookingNumber,
                clientName: n.clientName,
                items: [
                  {
                    productId: n.productId,
                    variantId: n.variantId,
                    productName: n.productName,
                    size: n.size,
                    colorName: n.colorName,
                    quantity: n.owed,
                  },
                ],
              } as unknown as Booking;
              const real = bookings.find((b) => b.id === n.bookingId);
              // The vendor goes on the first working stage of this product's workflow (same stage the batch opens in).
              const wf = productWorkflows.find((w) => w.productId === n.productId);
              const firstStage =
                wf?.activeStages?.find((st) => st !== 'stock_in') ||
                (wf?.workflowType === 'ready_made' ? 'supplier_sourcing' : 'raw_material');
              const stageAssignments: Record<string, BatchStageAssignment> = vendorId
                ? { [firstStage]: { vendorId } }
                : {};
              askJoinOrStartNew(n.productId, n.variantId, quantity, [{ id: n.bookingId, num: n.bookingNumber }], () =>
                handleSendShortageToPurchases(real || stub, targetDate, [
                  { productId: n.productId, variantId: n.variantId, quantity, stageAssignments, targetDate },
                ])
              );
            }}
          />
        )}

        {shortageGroup && shortageGroup.length > 0 && (
          <ShortageStartModal
            note={{ ...shortageGroup[0], owed: shortageGroup.reduce((sum, x) => sum + x.owed, 0) }}
            currentStock={products.flatMap((p) => p.variants).find((v) => v.id === shortageGroup[0].variantId)?.quantity ?? 0}
            minStock={products.flatMap((p) => p.variants).find((v) => v.id === shortageGroup[0].variantId)?.minThreshold}
            groupOrders={shortageGroup}
            estimate={popupEstimate(shortageGroup[0].productId, shortageGroup[0].variantId)}
            mergeTargets={popupMergeTargets(shortageGroup[0].productId)}
            onMerge={(batch, quantity) => {
              const g = shortageGroup;
              setShortageGroup(null);
              joinExistingBatch({ batch, variantId: g[0].variantId, quantity, orders: g.map((x) => ({ id: x.bookingId, num: x.bookingNumber })), startNew: () => {} });
            }}
            onCancel={() => setShortageGroup(null)}
            onConfirm={(quantity, targetDate) => {
              const vendorId: string | undefined = undefined;
              const g = shortageGroup;
              const n = g[0];
              setShortageGroup(null);
              const total = g.reduce((sum, x) => sum + x.owed, 0);
              const stub = {
                id: n.bookingId,
                bookingNumber: n.bookingNumber,
                clientName: g.map((x) => x.clientName).filter(Boolean).join(', '),
                items: [{ productId: n.productId, variantId: n.variantId, productName: n.productName, size: n.size, colorName: n.colorName, quantity: total }],
              } as unknown as Booking;
              const wf = productWorkflows.find((w) => w.productId === n.productId);
              const firstStage =
                wf?.activeStages?.find((st) => st !== 'stock_in') ||
                (wf?.workflowType === 'ready_made' ? 'supplier_sourcing' : 'raw_material');
              const stageAssignments: Record<string, BatchStageAssignment> = vendorId ? { [firstStage]: { vendorId } } : {};
              askJoinOrStartNew(n.productId, n.variantId, quantity, g.map((x) => ({ id: x.bookingId, num: x.bookingNumber })), () =>
                handleSendShortageToPurchases(bookings.find((b) => b.id === n.bookingId) || stub, targetDate, [
                  {
                    productId: n.productId,
                    variantId: n.variantId,
                    quantity,
                    stageAssignments,
                    targetDate,
                    extraBookingIds: g.slice(1).map((x) => x.bookingId),
                    extraBookingNumbers: g.slice(1).map((x) => x.bookingNumber),
                  },
                ])
              );
            }}
          />
        )}

        {joinPrompt && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 space-y-3 shadow-2xl">
              {joinPrompt.blockedReason ? (
                <>
                  <div className="text-base font-black text-slate-900">An open batch already exists</div>
                  <div className="text-xs text-slate-700">
                    {batchLabel(joinPrompt.batch)} ({joinPrompt.batch.quantity} pcs) cannot take this quantity: {joinPrompt.blockedReason}. A new batch will be started.
                  </div>
                  <button type="button" onClick={() => { const p = joinPrompt; setJoinPrompt(null); p.startNew(); }} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs">Start a new batch</button>
                  <button type="button" onClick={() => setJoinPrompt(null)} className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-900 font-black text-xs">Cancel</button>
                </>
              ) : (
                <>
                  <div className="text-base font-black text-slate-900">Add to the open batch?</div>
                  <div className="text-xs text-slate-700">
                    {batchLabel(joinPrompt.batch)} ({joinPrompt.batch.quantity} pcs) for this item is still at its first stage, not sent to the factory and no money spent. Size/color does not matter, the same vendor makes all of them. Add {joinPrompt.quantity} pcs{joinVariantText(joinPrompt.batch.productId, joinPrompt.variantId)} to it (total {joinPrompt.batch.quantity + joinPrompt.quantity}, kept per size), or start a new batch?
                  </div>
                  <button type="button" onClick={() => { const p = joinPrompt; setJoinPrompt(null); joinExistingBatch(p); }} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs">Add to {joinPrompt.batch.batchCode}</button>
                  <button type="button" onClick={() => { const p = joinPrompt; setJoinPrompt(null); p.startNew(); }} className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-black text-xs">Start a new batch</button>
                  <button type="button" onClick={() => setJoinPrompt(null)} className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-900 font-black text-xs">Cancel</button>
                </>
              )}
            </div>
          </div>
        )}

        {lowToStart && (
          <ShortageStartModal
            mode="low"
            currentStock={lowToStart.quantity}
            minStock={lowToStart.minThreshold}
            leftInStock={lowToStart.quantity}
            suggestedQty={Math.max(1, lowToStart.minThreshold * 2 - lowToStart.quantity)}
            note={{
              bookingId: '',
              bookingNumber: '',
              clientName: '',
              productId: lowToStart.productId,
              variantId: lowToStart.variantId,
              productName: lowToStart.productName,
              size: lowToStart.size,
              colorName: lowToStart.colorName,
              owed: 1,
              hasBatch: false,
            }}
            estimate={popupEstimate(lowToStart.productId, lowToStart.variantId)}
            mergeTargets={popupMergeTargets(lowToStart.productId)}
            onMerge={(batch, quantity) => {
              const n = lowToStart;
              setLowToStart(null);
              joinExistingBatch({ batch, variantId: n.variantId, quantity, orders: [], startNew: () => {} });
            }}
            onCancel={() => setLowToStart(null)}
            onConfirm={(quantity, targetDate) => {
              const vendorId: string | undefined = undefined;
              const n = lowToStart;
              setLowToStart(null);
              askJoinOrStartNew(n.productId, n.variantId, quantity, [], () => handleStartLowStockPurchase(n, quantity, targetDate, vendorId));
            }}
          />
        )}

        {/* VIEW 5: CLIENT BOOKINGS & QUOTATIONS */}
        {effectiveView === 'bookings' && canUserAccessView(currentUser, 'bookings', users) && (
          <BookingsView
            bookings={bookings}
            products={products}
            users={users}
            fare2Leaders={fare2Leaders}
            batches={productionBatches}
            vendors={vendors}
            workflows={productWorkflows}
            stageVendors={productStageVendors}
            priceHistory={vendorPriceHistory}
            currentUser={currentUser}
            canEditBookings={canUserEditBookings(currentUser, users)}
            teamRequests={teamChangeRequests}
            onSubmitTeamRequest={handleSubmitTeamRequest}
            onApproveTeamRequest={handleApproveTeamRequest}
            onRejectTeamRequest={handleRejectTeamRequest}
            onOpenNewBookingModal={() => {
              setBookingModalProduct(undefined);
              setBookingToEdit(null);
              setIsBookingModalOpen(true);
            }}
            onEditBooking={(booking) => {
              if (!canUserEditBookings(currentUser, users)) {
                showToast('Only Full-Access Admin or the Scout Fera2 team can edit bookings.');
                return;
              }
              if (booking.status !== 'pending' || booking.depositPaid) {
                showToast('Cannot edit booking after payment has been confirmed.');
                return;
              }
              setBookingModalProduct(undefined);
              setBookingToEdit(booking);
              setIsBookingModalOpen(true);
            }}
            onOpenPrintModal={(booking, docType) => {
              setPrintBooking(booking);
              setPrintDocType(docType);
              setIsPrintModalOpen(true);
            }}
            onAdvanceStatus={handleAdvanceBookingStatus}
            onRequestPaymentVerification={handleRequestPaymentVerification}
            onDeclinePaymentVerification={handleDeclinePaymentVerification}
            onDeleteBooking={handleDeleteBooking}
            onUpdateBooking={handleUpdateBooking}
            onSendShortageToPurchases={handleSendShortageToPurchases}
            onConfirmBookingStockReady={handleConfirmBookingStockReady}
            onOpenSourcing={canUserAccessView(currentUser, 'sourcing', users) ? () => handleNavigate('sourcing') : undefined}
            onOpenCalendar={() => handleNavigate('calendar')}
            onLogActivity={(log) => {
              setAuditLogs((prev) => [log, ...prev]);
              insertAuditLogInDb(log).catch(() => {});
            }}
            onShowToast={showToast}
            initialSelectedBookingId={selectedBookingForDetails}
            onClearSelectedBookingId={() => setSelectedBookingForDetails(null)}
          />
        )}

        {effectiveView === 'calendar' && canUserAccessView(currentUser, 'calendar', users) && (
          <CalendarView
            items={calendarEvents}
            users={users}
            currentUser={currentUser}
            scoutSeasons={scoutSeasons}
            teamRequests={teamChangeRequests}
            onSaveItem={handleSaveCalendarEvent}
            onDeleteItem={handleDeleteCalendarEvent}
            onToggleTaskComplete={handleToggleCalendarTask}
            onSaveScoutSeason={handleSaveScoutSeason}
            onDeleteScoutSeason={handleDeleteScoutSeason}
            onSubmitTeamRequest={handleSubmitTeamRequest}
            onApproveTeamRequest={handleApproveTeamRequest}
            onRejectTeamRequest={handleRejectTeamRequest}
            onShowToast={(msg) => showToast(msg)}
          />
        )}

        {effectiveView === 'board' && canUserAccessView(currentUser, 'board', users) && (
          <TeamBoardView
            items={calendarEvents}
            users={users}
            fare2Leaders={fare2Leaders}
            bookings={bookings}
            currentUser={currentUser}
            teamRequests={teamChangeRequests}
            onSaveItem={handleSaveCalendarEvent}
            onDeleteItem={handleDeleteCalendarEvent}
            onMoveItemStatus={handleMoveBoardItem}
            onFare2LeaderChange={handleFare2LeaderChange}
            onUserTeamsChange={handleUserTeamsChange}
            onSubmitTeamRequest={handleSubmitTeamRequest}
            onApproveTeamRequest={handleApproveTeamRequest}
            onRejectTeamRequest={handleRejectTeamRequest}
            onOpenBooking={(bid) => {
              if (!canUserAccessView(currentUser, 'bookings', users)) {
                showToast('Orders & Bookings page requires Scout Fera2 or Budgeting Team access.');
                return;
              }
              setSelectedBookingForDetails(bid);
              setActiveView('bookings');
            }}
            onOpenSourcing={canUserAccessView(currentUser, 'sourcing', users) ? () => handleNavigate('sourcing') : undefined}
            onOpenMarketing={() => handleNavigate('marketing')}
            onShowToast={(msg) => showToast(msg)}
          />
        )}

        {effectiveView === 'sourcing' && canUserAccessView(currentUser, 'sourcing', users) && (
          <div className="space-y-4">
          <SourcingOperationsView
            needsTiles={<NeedsTiles notes={shortageNotes} lowNotes={lowStockNotes} open={needsOpen} setOpen={setNeedsOpen} />}
            needsProductIds={
              needsOpen === 'order'
                ? new Set(shortageNotes.filter((n) => !n.hasBatch).map((n) => n.productId))
                : needsOpen === 'low'
                ? new Set(lowStockNotes.filter((n) => !n.hasBatch).map((n) => n.productId))
                : null
            }
            onClearNeeds={() => setNeedsOpen(null)}
            needsDetail={(pid) =>
              needsOpen ? (
                <NeedsList kind={needsOpen} productId={pid} notes={shortageNotes} lowNotes={lowStockNotes} canAct={canUserStartShortagePurchase(currentUser, users)} onStart={(n) => setShortageToStart(n)} onStartGroup={(g) => setShortageGroup(g)} onStartLow={(n) => setLowToStart(n)} />
              ) : null
            }
            products={products}
            vendors={vendors}
            workflows={productWorkflows}
            stageVendors={productStageVendors}
            priceHistory={vendorPriceHistory}
            batches={productionBatches}
            currentUser={currentUser}
            users={users}
            teamRequests={teamChangeRequests}
            onSubmitTeamRequest={handleSubmitTeamRequest}
            onApproveTeamRequest={handleApproveTeamRequest}
            onRejectTeamRequest={handleRejectTeamRequest}
            onSaveVendor={handleSaveVendor}
            onDeleteVendor={handleDeleteVendor}
            onSaveWorkflow={handleSaveWorkflow}
            onApplyWorkflowTemplate={handleApplyWorkflowTemplate}
            onSaveStageVendor={handleSaveStageVendor}
            onDeleteStageVendor={handleDeleteStageVendor}
            onAddPriceEntry={handleAddPriceEntry}
            onSaveBatch={handleSaveBatch}
            onDeleteBatch={handleDeleteBatch}
            onMergeBatches={handleMergeBatches}
            orderInfo={shortageNotes}
            onCompleteBatchStockIn={handleCompleteBatchStockIn}
            onShowToast={(msg) => showToast(msg)}
          />
          </div>
        )}

        {effectiveView === 'public-sales' && canUserAccessView(currentUser, 'public-sales', users) && (
          <PublicSalesView
            products={products}
            categories={categories}
            bookings={bookings}
            onMarkPaid={(id) => handleAdvanceBookingStatus(id, 'preparing')}
            onOpenInvoice={(booking) => {
              setPrintBooking(booking);
              setPrintDocType('quotation');
              setIsPrintModalOpen(true);
            }}
            onOpenOrder={(id) => {
              setSelectedBookingForDetails(id);
              handleNavigate('bookings');
            }}
            onShowToast={showToast}
          />
        )}

        {effectiveView === 'marketing' && canUserAccessView(currentUser, 'marketing', users) && (
          <MarketingOffersView
            products={products}
            offers={marketingOffers}
            currentUser={currentUser}
            users={users}
            canEditMedia={canEditProductMedia}
            teamRequests={teamChangeRequests}
            onSubmitTeamRequest={handleSubmitTeamRequest}
            onApproveTeamRequest={handleApproveTeamRequest}
            onRejectTeamRequest={handleRejectTeamRequest}
            onSaveOffer={handleSaveMarketingOffer}
            onDeleteOffer={handleDeleteMarketingOffer}
            onEditProductMedia={(p) => {
              if (!canEditProductMedia) return;
              setProductToEdit(p);
              setProductEditScope(isAdmin ? 'full' : 'marketing');
              setShowAddModal(true);
            }}
            onOpenCalendar={() => handleNavigate('calendar')}
            onShowToast={(msg) => showToast(msg)}
          />
        )}

        {effectiveView === 'budgeting' && canUserAccessView(currentUser, 'budgeting', users) && (
          <BudgetingView
            products={products}
            bookings={bookings}
            offers={marketingOffers}
            productionBatches={productionBatches}
            stageVendors={productStageVendors}
            priceHistory={vendorPriceHistory}
            budgetProfiles={budgetProfiles}
            budgetExpenses={budgetExpenses}
            budgetSettings={budgetSettings}
            scoutSeasons={scoutSeasons}
            currentUser={currentUser}
            users={users}
            isUnlocked={isBudgetingUnlocked}
            teamRequests={teamChangeRequests}
            onSubmitTeamRequest={handleSubmitTeamRequest}
            onApproveTeamRequest={handleApproveTeamRequest}
            onRejectTeamRequest={handleRejectTeamRequest}
            onUnlock={() => setIsBudgetingUnlocked(true)}
            onLock={() => setIsBudgetingUnlocked(false)}
            onOpenCalendar={() => handleNavigate('calendar')}
            onSaveBudgetProfile={handleSaveBudgetProfile}
            onAddExpense={handleAddBudgetExpense}
            onDeleteExpense={handleDeleteBudgetExpense}
            onSaveSettings={handleSaveBudgetSettings}
            onUpdateProductPrice={handleBudgetUpdateProductPrice}
            onShowToast={(msg) => showToast(msg)}
          />
        )}

        {/* Global Footer */}
        <footer className="pt-8 pb-4 text-center text-sm font-bold text-slate-700 tracking-wide">
          Made by Tony Mohab
        </footer>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentUser={currentUser}
        users={users}
        activeView={effectiveView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        pendingCount={pendingCount}
        pendingStockCount={pendingRequestsCount}
        pendingAccountsCount={pendingUsersCount}
        pendingAuditNotificationsCount={pendingStaffBookingRequestsCount}
        approvalsTab={approvalsTab}
        onOpenAddProduct={() => {
          if (!canUserAccessView(currentUser, 'add-product', users)) return;
          setProductToEdit(undefined);
          setShowAddModal(true);
        }}
        onOpenNewBooking={() => {
          if (!canUserEditBookings(currentUser, users)) return;
          setBookingModalProduct(undefined);
          setBookingToEdit(null);
          setIsBookingModalOpen(true);
        }}
      />

      {/* MODAL 1: Size & Color Detail Matrix */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          reservedMap={reservedMap}
          userRole={normalizeRole(currentUser.role)}
          canEditMedia={canEditProductMedia}
          onClose={() => setDetailProduct(null)}
          onRequestAdjustment={(p, variant) => {
            if (isLeader) return;
            setDetailProduct(null);
            setAdjustmentTarget({ product: p, variant });
          }}
          onDeleteProduct={handleDeleteProduct}
          onDeleteVariant={handleDeleteVariant}
          onEditProduct={(p) => {
            if (!isAdmin && !canEditProductMedia) return;
            setDetailProduct(null);
            setProductToEdit(p);
            setProductEditScope(isAdmin ? 'full' : 'marketing');
            setShowAddModal(true);
          }}
          onApproveProduct={handleApproveProduct}
        />
      )}

      {/* MODAL 2: Stock Adjustment (Worker Request or Admin Direct) */}
      {adjustmentTarget && !isLeader && (
        <AdjustmentModal
          product={adjustmentTarget.product}
          initialVariant={adjustmentTarget.variant}
          currentUser={currentUser}
          onClose={() => setAdjustmentTarget(null)}
          onSubmitWorkerRequest={handleSubmitWorkerRequest}
          onAdminDirectAdjust={handleAdminDirectAdjust}
          reservedMap={reservedMap}
          onPreviewMissing={previewStockAdjustInDb}
        />
      )}

      {/* MODAL 3: Add / Edit Product (Admin full edit, or Marketing photos/colors/description) */}
      {showAddModal && !isLeader && (
        <AddProductModal
          currentUser={currentUser}
          categories={categories}
          availableFolders={allFolderPaths}
          editScope={productToEdit ? (productEditScope || (isAdmin ? 'full' : 'marketing')) : 'full'}
          productToEdit={productToEdit}
          onClose={() => {
            setShowAddModal(false);
            setProductToEdit(undefined);
            setProductEditScope(undefined);
          }}
          onSaveProduct={handleSaveProduct}
          onManageCategories={() => setShowManageCategoriesModal(true)}
          onOpenDirectAdjust={(prod, variant) => {
            setShowAddModal(false);
            setProductToEdit(undefined);
            setProductEditScope(undefined);
            setAdjustmentTarget({ product: prod, variant });
          }}
        />
      )}

      {/* MODAL 4: Manage Categories (Dedicated SQL Table & FK) */}
      {showManageCategoriesModal && !isLeader && (
        <ManageCategoriesModal
          categories={categories}
          currentUser={currentUser}
          onClose={() => setShowManageCategoriesModal(false)}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      )}

      {/* Confirmation Modal for Direct Product Deletion from Catalog */}
      <AppConfirmHost />
      <ConfirmDeleteModal
        isOpen={!!productToDelete}
        title="Delete Item"
        itemTitle={productToDelete?.name}
        message={`Are you sure you want to delete "${productToDelete?.name}"?`}
        details="This will permanently delete the item and all its variant stock combinations from the catalog."
        confirmLabel="Yes, Delete"
        cancelLabel="No, Cancel"
        onConfirm={() => {
          if (productToDelete) {
            handleDeleteProduct(productToDelete.id);
            setProductToDelete(null);
          }
        }}
        onCancel={() => setProductToDelete(null)}
      />

      {/* MODAL 5: Detailed Activity Breakdown Modal */}
      {selectedActivityLog && !isLeader && (
        <ActivityDetailModal
          log={selectedActivityLog}
          product={products.find(
            (p) =>
              p.id === selectedActivityLog.productId ||
              p.name === selectedActivityLog.productName
          )}
          bookings={bookings}
          onClose={() => setSelectedActivityLog(null)}
          onViewProduct={(pId) => {
            const p = products.find((prod) => prod.id === pId);
            if (p) {
              setDetailProduct(p);
              setActiveView('inventory');
            }
          }}
          onViewBooking={handleOpenBookingDetails}
        />
      )}

      {/* MODAL 6: Create / Edit Client Booking (Quotation & Deficit Calculation) */}
      {isBookingModalOpen && !isLeader && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setBookingModalProduct(undefined);
            setBookingToEdit(null);
          }}
          products={products}
          users={users}
          fare2Leaders={fare2Leaders}
          marketingOffers={marketingOffers}
          initialProduct={bookingModalProduct}
          bookingToEdit={bookingToEdit}
          currentUser={currentUser}
          existingBookings={bookings}
          onSaveBooking={(savedBooking, autoAdvanceToPreparing) => {
            if (bookingToEdit) {
              handleSaveEditedBooking(savedBooking);
            } else {
              handleSaveBooking(savedBooking, autoAdvanceToPreparing);
            }
          }}
        />
      )}

        {/* Toast Notification Alert with Click-to-open Detailed Breakdown */}
        {toastNotification && (
          <div
            onClick={() => {
              if (toastNotification.log) {
                setSelectedActivityLog(toastNotification.log);
                setToastNotification(null);
              }
            }}
            className={`fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-md z-50 p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xl text-xs text-slate-900 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 transition-all ${
              toastNotification.log
                ? 'cursor-pointer hover:border-amber-400 hover:shadow-amber-500/10'
                : ''
            }`}
            title={toastNotification.log ? 'Click to view detailed breakdown' : undefined}
          >
            {toastNotification.log?.productImage && (
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-xs">
                <img
                  src={toastNotification.log.productImage}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{toastNotification.message}</span>
              </div>
              {toastNotification.log && (
                <div className="text-[11px] text-amber-800 font-bold mt-0.5 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-amber-600" />
                  <span>Tap to view detailed breakdown</span>
                  <span aria-hidden="true">→</span>
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setToastNotification(null);
              }}
              className="text-slate-400 hover:text-slate-700 p-1 shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Create New Folder / Sub-Folder inside Others Modal */}
        {showNewFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-amber-600" />
                  <span>
                    {newFolderParentInput
                      ? `New Sub-Folder in "${newFolderParentInput}"`
                      : 'Create New Folder in Others'}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parent Folder (Optional)
                  </label>
                  <select
                    value={newFolderParentInput}
                    onChange={(e) => setNewFolderParentInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">None (Top-Level Folder inside Others)</option>
                    {topLevelOthersFolders
                      .filter((f) => f !== 'All Items')
                      .map((top) => (
                        <option key={top} value={top}>
                          Inside "{top}" (Creates Sub-Sub-Folder)
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newFolderNameInput}
                    onChange={(e) => setNewFolderNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateNewFolder(newFolderNameInput, newFolderParentInput);
                      }
                    }}
                    placeholder={
                      newFolderParentInput
                        ? 'e.g. Wa3d Morshedat...'
                        : 'e.g. Wegla, Pins, Wa3d...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateNewFolder(newFolderNameInput, newFolderParentInput)}
                  disabled={!newFolderNameInput.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs shadow-xs disabled:opacity-50 transition-all"
                >
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit / Rename / Delete Sub-Folders & Sub-Sub-Folders Modal */}
        {showEditFoldersModal && (
          <div
            onClick={() => setShowEditFoldersModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-lg w-full p-5 border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                    <Pencil className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Edit Others Folders & Sub-Folders
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Rename or delete any sub-folder or nested sub-sub-folder
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditFoldersModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-2 pr-1 flex-1">
                {allFolderPaths.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No folders created yet. Click "+ New Folder" to create one.
                  </div>
                ) : (
                  topLevelOthersFolders
                    .filter((f) => f !== 'All Items')
                    .map((top) => {
                      const children = allFolderPaths.filter(
                        (p) => p.includes(' / ') && getFolderParts(p).parent.toLowerCase() === top.toLowerCase()
                      );
                      const directCount = products.filter(
                        (pr) =>
                          pr.category?.toLowerCase() === 'others' &&
                          normalizeFolderPath(pr.folder || '').toLowerCase() === top.toLowerCase()
                      ).length;

                      return (
                        <div key={top} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                          {/* Top-Level Folder Row */}
                          <div className="flex items-center justify-between gap-2">
                            {renamingFolderPath === top ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={renameFolderInput}
                                  onChange={(e) => setRenameFolderInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleRenameFolder(top, renameFolderInput);
                                    }
                                  }}
                                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-amber-400 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRenameFolder(top, renameFolderInput)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenamingFolderPath(null);
                                    setRenameFolderInput('');
                                  }}
                                  className="px-2 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : confirmDeleteFolderPath === top ? (
                              <div className="flex-1 flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl p-2">
                                <span className="text-xs font-bold text-rose-900">
                                  Delete "{top}"{children.length > 0 ? ` & ${children.length} sub-folder(s)` : ''}?
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteFolderPath(null)}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-[11px] font-bold"
                                  >
                                    No
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFolder(top)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black"
                                  >
                                    Yes, Delete
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-black text-slate-900 truncate">📁 {top}</span>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shrink-0">
                                    {directCount} direct
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowEditFoldersModal(false);
                                      setNewFolderParentInput(top);
                                      setNewFolderNameInput('');
                                      setShowNewFolderModal(true);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-bold"
                                    title={`Add sub-folder inside ${top}`}
                                  >
                                    + Sub
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmDeleteFolderPath(null);
                                      setRenamingFolderPath(top);
                                      setRenameFolderInput(top);
                                    }}
                                    className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-500/70"
                                    title={`Rename "${top}"`}
                                  >
                                    <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRenamingFolderPath(null);
                                      setConfirmDeleteFolderPath(top);
                                    }}
                                    className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200"
                                    title={`Delete "${top}"`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Nested Sub-Sub-Folders inside Top Folder */}
                          {children.length > 0 && (
                            <div className="pl-4 border-l-2 border-sky-200 space-y-1.5">
                              {children.map((subPath) => {
                                const leaf = getFolderParts(subPath).child || subPath;
                                const subItemCount = products.filter(
                                  (pr) =>
                                    pr.category?.toLowerCase() === 'others' &&
                                    normalizeFolderPath(pr.folder || '').toLowerCase() === subPath.toLowerCase()
                                ).length;

                                return (
                                  <div
                                    key={subPath}
                                    className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2"
                                  >
                                    {renamingFolderPath === subPath ? (
                                      <div className="flex-1 flex items-center gap-2">
                                        <input
                                          type="text"
                                          autoFocus
                                          value={renameFolderInput}
                                          onChange={(e) => setRenameFolderInput(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleRenameFolder(subPath, renameFolderInput);
                                            }
                                          }}
                                          className="flex-1 px-2.5 py-1 rounded-lg border border-amber-400 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleRenameFolder(subPath, renameFolderInput)}
                                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRenamingFolderPath(null);
                                            setRenameFolderInput('');
                                          }}
                                          className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : confirmDeleteFolderPath === subPath ? (
                                      <div className="flex-1 flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-bold text-rose-800">
                                          Delete sub-folder "{leaf}"?
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => setConfirmDeleteFolderPath(null)}
                                            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold"
                                          >
                                            No
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteFolder(subPath)}
                                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black"
                                          >
                                            Yes, Delete
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Folder className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                          <span className="text-xs font-bold text-slate-800 truncate">{leaf}</span>
                                          <span className="text-[10px] font-mono text-slate-500">
                                            ({subItemCount})
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setConfirmDeleteFolderPath(null);
                                              setRenamingFolderPath(subPath);
                                              setRenameFolderInput(leaf);
                                            }}
                                            className="p-1 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-500/70"
                                            title={`Rename "${leaf}"`}
                                          >
                                            <Pencil className="w-3 h-3 stroke-[2.5]" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setRenamingFolderPath(null);
                                              setConfirmDeleteFolderPath(subPath);
                                            }}
                                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                                            title={`Delete "${leaf}"`}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditFoldersModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 7: A4 Print & PDF Document Generator (Isolated outside print:hidden) */}
      {isPrintModalOpen && printBooking && (
        <BookingPrintModal
          isOpen={isPrintModalOpen}
          booking={printBooking}
          defaultDocType={printDocType}
          onClose={() => {
            setIsPrintModalOpen(false);
            setPrintBooking(null);
          }}
        />
      )}
    </>
  );
};
