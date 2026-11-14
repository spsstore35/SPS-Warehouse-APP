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
} from './types/inventory';
import {
  getStoredProducts,
  saveStoredProducts,
  getStoredRequests,
  saveStoredRequests,
  getStoredAuditLogs,
  saveStoredAuditLogs,
  getStoredUser,
  saveStoredUser,
  getStoredUsers,
  saveStoredUsers,
  approveUserAccount,
  rejectUserAccount,
  resetAllToDemo,
  getStoredCategories,
  saveStoredCategories,
  clearStoredAuditLogs,
  getStoredBookings,
  saveStoredBookings,
} from './utils/storage';
import { isUserAdmin } from './utils/security';
import { INITIAL_USERS, SEED_CATALOG_DATA, INITIAL_CATEGORIES } from './data/initialData';
import {
  checkSupabaseConnection,
  fetchProductsFromDb,
  upsertProductToDb,
  deleteProductFromDb,
  deleteProductVariantFromDb,
  deleteUserFromDb,
  updateUserRoleInDb,
  updateVariantQuantityInDb,
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
import { MobileNotificationBanner } from './components/MobileNotificationBanner';
import {
  registerServiceWorker,
  getNotificationPermissionState,
  requestNotificationPermission,
  sendSystemNotification,
  sendTestNotification,
  NotificationPermissionState,
} from './services/notificationService';
import { formatAuditLogReason } from './utils/auditReason';
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
} from 'lucide-react';

export default function App() {
  // State
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [users, setUsers] = useState<User[]>(() => getStoredUsers());
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [requests, setRequests] = useState<AdjustmentRequest[]>(() => getStoredRequests());
  const [categories, setCategories] = useState<Category[]>(() => getStoredCategories());
  // Audit logs preserved in state, storage, and Supabase
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => getStoredAuditLogs());
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

  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sps_others_folders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return Array.from(
            new Set(
              parsed
                .map((f: string) => (f === 'All Folders' ? 'All Items' : normalizeFolderPath(String(f))))
                .filter((f: string) => Boolean(f) && f !== 'All Items')
            )
          );
        }
      }
    } catch {}
    return ['Wegla', 'Pins & Badges', 'Wa3d', 'Accessories', 'Souvenirs'];
  });
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
    try {
      localStorage.setItem('sps_others_folders', JSON.stringify(nextFolders));
    } catch {}

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
    try {
      localStorage.setItem('sps_others_folders', JSON.stringify(updatedFolderList));
    } catch {}

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
      saveStoredProducts(nextProducts);
      modifiedProducts.forEach((mp) => {
        upsertProductToDb(mp).catch((err) => console.warn('Supabase folder rename notice:', err?.message));
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
    try {
      localStorage.setItem('sps_others_folders', JSON.stringify(updatedFolderList));
    } catch {}

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
      saveStoredProducts(nextProducts);
      modifiedProducts.forEach((mp) => {
        upsertProductToDb(mp).catch((err) => console.warn('Supabase folder delete notice:', err?.message));
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
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Rich Toast notification & Activity Detail
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    log?: AuditLogEntry;
  } | null>(null);
  const [selectedActivityLog, setSelectedActivityLog] = useState<AuditLogEntry | null>(null);

  // Mobile & System Notifications State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermissionState()
  );

  // Notification count trackers to detect new incoming requests across devices
  const prevStaffBookingPendingRef = useRef<number | null>(null);
  const prevPendingRequestsRef = useRef<number | null>(null);
  const prevPendingAccountsRef = useRef<number | null>(null);
  const seenAuditLogIdsRef = useRef<Set<string> | null>(null);

  const showToast = (msg: string, log?: AuditLogEntry) => {
    setToastNotification({ message: msg, log });
    setTimeout(() => {
      setToastNotification((prev) => (prev?.message === msg ? null : prev));
    }, 6000);
  };

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>(() => getStoredBookings());
  const [bookingModalProduct, setBookingModalProduct] = useState<Product | undefined>(undefined);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [printBooking, setPrintBooking] = useState<Booking | null>(null);
  const [printDocType, setPrintDocType] = useState<'quotation' | 'production'>('quotation');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<string | null>(null);

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

  // Sync to localStorage as offline cache
  useEffect(() => {
    saveStoredUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    saveStoredProducts(products);
  }, [products]);

  useEffect(() => {
    saveStoredRequests(requests);
  }, [requests]);

  useEffect(() => {
    saveStoredCategories(categories);
  }, [categories]);

  useEffect(() => {
    saveStoredAuditLogs(auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    saveStoredBookings(bookings);
  }, [bookings]);

  // Category handlers
  const handleAddCategory = async (name: string, description?: string) => {
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
    saveStoredCategories(nextCats);

    try {
      await createCategoryInDb(newCat);
    } catch (err: any) {
      console.warn('Supabase category create notice:', err?.message);
    }
    showToast(`Category "${name}" created.`);
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admin can delete categories.');
      return;
    }
    const deletedCat = categories.find((c) => c.id === catId);
    const nextCats = categories.filter((c) => c.id !== catId);
    setCategories(nextCats);
    saveStoredCategories(nextCats);

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
    saveStoredProducts(nextProducts);

    try {
      await deleteCategoryFromDb(catId);
    } catch (err: any) {
      console.warn('Supabase category delete notice:', err?.message);
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

  // Admin deletes entire product
  const handleDeleteProduct = async (productId: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admin can delete products.');
      return;
    }
    const targetProd = products.find((p) => p.id === productId);
    const nextProds = products.filter((p) => p.id !== productId);
    setProducts(nextProds);
    saveStoredProducts(nextProds);

    try {
      await deleteProductFromDb(productId);
    } catch (err: any) {
      console.warn('Supabase product delete notice:', err?.message);
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
    saveStoredProducts(nextProducts);

    try {
      await deleteProductVariantFromDb(variantId);
    } catch (err: any) {
      console.warn('Supabase variant delete notice:', err?.message);
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
      const { saveStoredUsers } = await import('./utils/storage');
      saveStoredUsers(nextUsers);
      await deleteUserFromDb(userId);
    } catch (err: any) {
      console.warn('Supabase user delete notice:', err?.message);
    }

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'account_deleted',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Deleted user account "${targetUser?.name || 'User'}"`,
      details: `Account for ${targetUser?.email} (${targetUser?.role}) permanently removed.`,
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
        avatarColor: newRole === 'admin' ? '#d97706' : '#0284c7',
      };
    });

    setUsers(nextUsers);
    saveStoredUsers(nextUsers);

    // If current logged-in user changed their own role, update currentUser state
    if (currentUser && currentUser.id === userId) {
      const updatedCurrent = {
        ...currentUser,
        role: newRole,
        requestedRole: newRole,
      };
      setCurrentUser(updatedCurrent);
      saveStoredUser(updatedCurrent);
    }

    try {
      await updateUserRoleInDb(userId, newRole);
    } catch (err: any) {
      console.warn('Supabase user role update notice:', err?.message);
    }

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'account_updated' as any,
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      reason: `Staff Role Changed: ${oldRole.toUpperCase()} → ${newRole.toUpperCase()}`,
      summary: `Staff Role Changed: "${targetUser?.name || targetUser?.email || 'User'}" to ${newRole === 'admin' ? 'Admin Authority' : 'Staff'}`,
      details: `User (${targetUser?.email}) role changed from ${oldRole.toUpperCase()} to ${newRole.toUpperCase()} by Admin.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Role for "${targetUser?.name || 'User'}" updated to ${newRole === 'admin' ? 'Admin Authority' : 'Staff'}.`, newLog);
  };

  // Load live data from Supabase - Strict single source of truth across all devices
  const refreshFromSupabase = async (notify = false) => {
    setIsDbLoading(true);
    try {
      const status = await checkSupabaseConnection();
      setDbStatus(status);

      if (status.connected && status.tablesExist) {
        const [dbProducts, dbRequests, dbUsers, dbCategories, dbLogs, dbBookings] = await Promise.allSettled([
          fetchProductsFromDb(),
          fetchAdjustmentRequestsFromDb(),
          fetchUsersFromDb(),
          fetchCategoriesFromDb(),
          fetchAuditLogsFromDb(),
          fetchBookingsFromDb(),
        ]);

        if (dbProducts.status === 'fulfilled') {
          setProducts((prev) => {
            const merged = dbProducts.value.map((p) => {
              const localMatch = prev.find((lp) => lp.id === p.id);
              return {
                ...p,
                folder: p.folder || localMatch?.folder,
              };
            });
            saveStoredProducts(merged);
            return merged;
          });
        }
        if (dbRequests.status === 'fulfilled') {
          setRequests(dbRequests.value);
          saveStoredRequests(dbRequests.value);
        }
        if (dbUsers.status === 'fulfilled') {
          setUsers(dbUsers.value);
          saveStoredUsers(dbUsers.value);
        }
        if (dbCategories.status === 'fulfilled') {
          const cats = dbCategories.value.length > 0 ? dbCategories.value : INITIAL_CATEGORIES;
          setCategories(cats);
          saveStoredCategories(cats);
        }
        if (dbLogs.status === 'fulfilled') {
          setAuditLogs((prev) => {
            const merged = dbLogs.value.map((l) => {
              const localMatch = prev.find((ll) => ll.id === l.id);
              if (!localMatch) return l;
              return {
                ...l,
                productImage: l.productImage || localMatch.productImage,
                variantSize: l.variantSize || localMatch.variantSize,
                variantColor: l.variantColor || localMatch.variantColor,
                oldQuantity: l.oldQuantity !== undefined ? l.oldQuantity : localMatch.oldQuantity,
                newQuantity: l.newQuantity !== undefined ? l.newQuantity : localMatch.newQuantity,
                delta: l.delta !== undefined ? l.delta : localMatch.delta,
                totalQuantityBefore: l.totalQuantityBefore !== undefined ? l.totalQuantityBefore : localMatch.totalQuantityBefore,
                totalQuantityAfter: l.totalQuantityAfter !== undefined ? l.totalQuantityAfter : localMatch.totalQuantityAfter,
                reason: l.reason || localMatch.reason,
                note: l.note || localMatch.note,
                bookingId: l.bookingId || localMatch.bookingId,
                bookingNumber: l.bookingNumber || localMatch.bookingNumber,
              };
            });
            saveStoredAuditLogs(merged);
            return merged;
          });
        }
        if (dbBookings.status === 'fulfilled') {
          setBookings((prev) => {
            const merged = dbBookings.value.map((b) => {
              const localMatch = prev.find((lb) => lb.id === b.id);
              return {
                ...b,
                troopGroup: b.troopGroup || localMatch?.troopGroup,
              };
            });
            saveStoredBookings(merged);
            return merged;
          });
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

  // Multi-Device Cloud Synchronization & Polling (Pure HTTP, No WebSockets)
  useEffect(() => {
    // 1. Initial fetch
    refreshFromSupabase(false);

    // 2. Periodic Background Sync (every 5 seconds) so changes made anywhere
    // sync seamlessly without WebSocket overhead or disconnect errors!
    const syncInterval = setInterval(() => {
      refreshFromSupabase(false);
    }, 5000);

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  // Register Service Worker for Mobile Notifications & Handle Notification Clicks
  useEffect(() => {
    registerServiceWorker();

    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'SPS_NAVIGATE') {
          if (event.data.view) {
            setActiveView(event.data.view);
          }
          if (event.data.bookingId) {
            handleOpenBookingDetails(event.data.bookingId);
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  // Auth Handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveView('inventory');
    showToast(`Signed in as ${user.name} (${user.role === 'admin' ? 'Admin' : 'Staff'})`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView('inventory');
  };

  const handleSwitchRole = () => {
    if (!currentUser) return;
    if (currentUser.role === 'admin') {
      const worker = users.find((u) => u.role === 'worker' && u.status === 'active') || {
        id: 'user_worker_01',
        name: 'Staff Member',
        role: 'worker',
        email: 'karim@wearhouse.com',
        status: 'active',
      };
      setCurrentUser(worker as User);
      showToast(`Switched to Staff: ${worker.name}`);
    } else {
      const admin = users.find((u) => u.role === 'admin' && u.status === 'active') || {
        id: 'user_admin_01',
        name: 'Warehouse Admin',
        role: 'admin',
        email: 'admin@wearhouse.com',
        status: 'active',
      };
      setCurrentUser(admin as User);
      showToast(`Switched to Warehouse Admin`);
    }
  };

  // Product CRUD (Persisted to Supabase)
  const handleSaveProduct = async (product: Product) => {
    const existingProd = products.find((p) => p.id === product.id);
    const isEdit = Boolean(existingProd);
    const isAdmin = isUserAdmin(currentUser);

    // If staff is creating a product (not editing existing approved), it is pending approval
    const finalProd: Product = {
      ...product,
      status: isEdit ? (product.status || 'active') : (isAdmin ? 'active' : 'pending'),
      createdByRole: product.createdByRole || (isAdmin ? 'admin' : 'worker'),
      createdByName: product.createdByName || currentUser?.name || 'Staff',
      createdById: product.createdById || currentUser?.id,
    };

    if (finalProd.folder && !customFolders.some((f) => f.toLowerCase() === finalProd.folder!.toLowerCase())) {
      const nextFolders = [...customFolders, finalProd.folder];
      setCustomFolders(nextFolders);
      try {
        localStorage.setItem('sps_others_folders', JSON.stringify(nextFolders));
      } catch {}
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

    setAuditLogs((prev) => [newLog, ...prev]);

    // Save product to Supabase FIRST so foreign key constraint is satisfied before writing audit logs
    try {
      await upsertProductToDb(finalProd);
    } catch (err: any) {
      console.warn('Supabase upsert product error:', err?.message);
    }

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
    saveStoredProducts(nextProds);

    try {
      await upsertProductToDb(approvedProd);
    } catch (err: any) {
      console.warn('Supabase product approve error:', err?.message);
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
    saveStoredProducts(nextProds);

    try {
      await deleteProductFromDb(productId);
    } catch (err: any) {
      console.warn('Supabase product reject delete error:', err?.message);
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
        oldQty = v.quantity;
        variantSize = v.size;
        variantColor = v.colorName;
        return {
          ...v,
          quantity: data.newQuantity,
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
    updateVariantQuantityInDb(data.variantId, data.newQuantity).catch((err) => {
      console.warn('Supabase variant update error:', err.message);
    });

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
  const handleApproveRequest = (requestId: string, adminNote?: string) => {
    const targetReq = requests.find((r) => r.id === requestId);
    if (!targetReq) return;

    // 1. Update the actual product variant quantity
    const nextProducts = products.map((prod) => {
      if (prod.id !== targetReq.productId) return prod;

      const nextVariants = prod.variants.map((v) => {
        if (v.id !== targetReq.variantId) return v;
        return {
          ...v,
          quantity: targetReq.requestedQuantity,
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
    updateVariantQuantityInDb(targetReq.variantId, targetReq.requestedQuantity).catch((err) => {
      console.warn('Supabase variant quantity update error:', err.message);
    });

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
    const updated = approveUserAccount(userId, currentUser);
    setUsers(updated);

    // Persist to Supabase
    updateUserStatusInDb(userId, 'active', currentUser).catch((err) => {
      console.warn('Supabase user approval error:', err.message);
    });

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'staff_approved',
      actorName: currentUser.name,
      actorRole: 'admin',
      summary: `Approved registration for "${targetUser?.name || 'Staff'}"`,
      details: `Account for ${targetUser?.email} (${targetUser?.requestedRole || targetUser?.role}) activated in Supabase.`,
    };
    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});
    showToast(`Account approved for ${targetUser?.name || 'user'}. They can now log in.`);
  };

  // Admin Rejects a pending staff registration (Persisted to Supabase)
  const handleRejectUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    const updated = rejectUserAccount(userId);
    setUsers(updated);

    // Persist to Supabase
    updateUserStatusInDb(userId, 'rejected', currentUser || undefined).catch((err) => {
      console.warn('Supabase user reject error:', err.message);
    });

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'staff_rejected',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Declined registration for "${targetUser?.name || 'Staff'}"`,
      details: `Registration for ${targetUser?.email} was declined.`,
    };
    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});
    showToast(`Registration request declined.`);
  };

  // Admin directly creates a staff or admin account with status 'active' (no approval needed)
  const handleCreateUserDirectly = async (data: {
    name: string;
    email: string;
    password?: string;
    role: Role;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = data.email.toLowerCase().trim();

    // 1. Check local state
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing && existing.status === 'active') {
      return { success: false, error: 'An active account with this email address already exists.' };
    }

    try {
      const { supabase } = await import('./services/supabaseClient');
      const { hashPassword } = await import('./utils/security');
      const plainPassword = data.password && data.password.trim().length >= 4 ? data.password.trim() : '123456';
      const securePasswordHash = await hashPassword(plainPassword);

      // 2. Check if user already exists in remote Supabase profiles table
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email, status')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        // If profile already exists (e.g. pending or previously registered), update to active and set password hash
        const updatePayload: Record<string, any> = {
          full_name: data.name.trim(),
          role: data.role,
          status: 'active',
          requested_role: data.role,
          approved_at: new Date().toISOString(),
          approved_by_name: currentUser?.name || 'Admin',
        };
        if (data.password && data.password.trim().length >= 4) {
          updatePayload.password_hash = securePasswordHash;
        }

        const { error: updateErr } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', existingProfile.id);

        if (updateErr) throw updateErr;

        setUsers((prev) =>
          prev.map((u) =>
            u.email.toLowerCase() === cleanEmail
              ? { ...u, status: 'active', role: data.role, name: data.name.trim() }
              : u
          )
        );

        showToast(`Account for ${cleanEmail} updated to Active.`);
        return { success: true };
      }

      // 3. Insert new user profile with secure password hash
      const newId = crypto.randomUUID();
      const newUser: User = {
        id: newId,
        name: data.name.trim(),
        email: cleanEmail,
        role: data.role,
        status: 'active',
        requestedRole: data.role,
        createdAt: new Date().toISOString(),
        avatarColor: data.role === 'admin' ? '#d97706' : '#0284c7',
      };

      const { error: insertErr } = await supabase.from('profiles').insert({
        id: newUser.id,
        full_name: newUser.name,
        email: newUser.email,
        password_hash: securePasswordHash,
        role: newUser.role,
        status: 'active',
        requested_role: newUser.role,
        avatar_color: newUser.avatarColor,
        approved_at: new Date().toISOString(),
        approved_by_name: currentUser?.name || 'Admin',
        created_at: newUser.createdAt,
      });

      if (insertErr) {
        // If unique constraint on email was hit, update existing row instead
        if (
          insertErr.code === '23505' ||
          insertErr.message?.includes('profiles_email_key') ||
          insertErr.message?.includes('duplicate key')
        ) {
          await supabase
            .from('profiles')
            .update({
              status: 'active',
              role: newUser.role,
              requested_role: newUser.role,
              full_name: newUser.name,
              password_hash: securePasswordHash,
              approved_at: new Date().toISOString(),
              approved_by_name: currentUser?.name || 'Admin',
            })
            .ilike('email', cleanEmail);

          refreshFromSupabase();
          showToast(`Account for ${cleanEmail} activated.`);
          return { success: true };
        }
        throw insertErr;
      }

      setUsers((prev) => [newUser, ...prev]);

      // Local account cache
      try {
        const { registerNewUser, approveUserAccount } = await import('./utils/storage');
        const reg = registerNewUser({
          name: newUser.name,
          email: newUser.email,
          password: data.password || '123456',
          requestedRole: newUser.role,
        });
        if (reg.user && currentUser) {
          approveUserAccount(reg.user.id, currentUser);
        }
      } catch (_err) {}

      // Record audit log
      const newLog: AuditLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'staff_approved',
        actorName: currentUser?.name || 'Admin',
        actorRole: 'admin',
        summary: `Created pre-approved account for "${newUser.name}"`,
        details: `Account for ${newUser.email} (${newUser.role === 'admin' ? 'Warehouse Admin' : 'Staff'}) created directly as Active without approval.`,
      };
      setAuditLogs((prev) => [newLog, ...prev]);
      insertAuditLogInDb(newLog).catch(() => {});

      showToast(`Account created for ${newUser.name}! They can log in immediately.`);
      return { success: true };
    } catch (err: any) {
      console.warn('Direct user creation notice:', err?.message);
      return { success: false, error: err?.message || 'Failed to create user' };
    }
  };

  // 1-Click Seed initial sample catalog into Supabase if desired
  const handleSeedToSupabase = async () => {
    showToast('Seeding initial apparel products into your Supabase database...');
    try {
      for (const prod of SEED_CATALOG_DATA) {
        await upsertProductToDb(prod);
      }
      setProducts(SEED_CATALOG_DATA);
      showToast('Apparel catalog seeded into Supabase successfully!');
    } catch (err: any) {
      console.error('Seed error:', err);
      showToast(`Seeding notice: ${err.message || 'Run SQL migration in Supabase first.'}`);
    }
  };

  // Booking Management Handlers
  const handleSaveBooking = (newBooking: Booking, autoAdvanceToPreparing = false) => {
    let nextProducts = [...products];
    const variantDbUpdates: { variantId: string; newQty: number }[] = [];

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
                variantDbUpdates.push({ variantId: v.id, newQty: updatedQty });
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
      saveStoredProducts(nextProducts);
      variantDbUpdates.forEach((u) => {
        updateVariantQuantityInDb(u.variantId, u.newQty).catch((err) => {
          console.warn('Notice deducting booking stock in Supabase:', err?.message);
        });
      });
      newBooking.inventoryDeducted = true;
    }

    const updatedBookings = [newBooking, ...bookings];
    setBookings(updatedBookings);
    saveStoredBookings(updatedBookings);

    // Sync booking & items to Supabase Database
    insertBookingInDb(newBooking).catch((err) => {
      console.warn('Notice saving booking to Supabase:', err?.message);
    });

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
      !isUserAdmin(currentUser)
        ? { ...updatedBooking, troopGroup: prevBooking.troopGroup }
        : updatedBooking;

    const nextBookings = bookings.map((b) => (b.id === safeBooking.id ? safeBooking : b));
    setBookings(nextBookings);
    saveStoredBookings(nextBookings);
    insertBookingInDb(safeBooking).catch((err) => {
      console.warn('Notice saving updated booking to Supabase:', err?.message);
    });
  };

  const handleSaveEditedBooking = (editedBooking: Booking) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admins can edit existing bookings.');
      return;
    }
    const existing = bookings.find((b) => b.id === editedBooking.id);
    if (!existing) return;
    if (existing.status !== 'pending' || existing.depositPaid) {
      showToast('Cannot edit this booking because payment has already been confirmed.');
      return;
    }

    const nextBookings = bookings.map((b) => (b.id === editedBooking.id ? editedBooking : b));
    setBookings(nextBookings);
    saveStoredBookings(nextBookings);

    insertBookingInDb(editedBooking).catch((err) => {
      console.warn('Notice updating booking in Supabase:', err?.message);
    });

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

  const handleAdvanceBookingStatus = (bookingId: string, nextStatus: BookingStatus) => {
    const nextProducts = [...products];
    const variantDbUpdates: { variantId: string; newQty: number }[] = [];
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
                  variantDbUpdates.push({ variantId: v.id, newQty: updatedQty });
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
      saveStoredProducts(nextProducts);

      // Persist all deducted variant quantities to Supabase
      variantDbUpdates.forEach((u) => {
        updateVariantQuantityInDb(u.variantId, u.newQty).catch((err) => {
          console.warn('Notice updating reserved variant stock in Supabase:', err?.message);
        });
      });

      setBookings(updatedBookings);
      saveStoredBookings(updatedBookings);

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

  const handleDeleteBooking = (bookingId: string) => {
    if (!isUserAdmin(currentUser)) {
      showToast('Only Admins can delete bookings.');
      return;
    }
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;

    if (target.status !== 'pending' || target.depositPaid) {
      showToast('Cannot delete a booking after payment has been confirmed.');
      return;
    }

    const nextBookings = bookings.filter((b) => b.id !== bookingId);
    setBookings(nextBookings);
    saveStoredBookings(nextBookings);

    // Delete from Supabase
    deleteBookingFromDb(bookingId).catch((err) => {
      console.warn('Notice deleting booking in Supabase:', err?.message);
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
  const pendingStaffBookingRequestsCount = bookings.filter((b) => Boolean(b.pendingDepositPercentage)).length;

  // Real-Time System Notification Triggers for EVERY Stock Audit Log Entry
  useEffect(() => {
    if (!auditLogs || auditLogs.length === 0) return;

    // First load: initialize known log IDs so we don't spam notifications for old history on startup
    if (seenAuditLogIdsRef.current === null) {
      seenAuditLogIdsRef.current = new Set(auditLogs.map((l) => l.id));
      return;
    }

    // Subsequent updates: detect any fresh logs not previously in the set
    const freshLogs = auditLogs.filter((l) => !seenAuditLogIdsRef.current!.has(l.id));

    if (freshLogs.length > 0) {
      freshLogs.forEach((newLog) => {
        const reasonTitle = formatAuditLogReason(newLog);
        const description = newLog.summary || newLog.details || 'New warehouse inventory activity recorded.';

        sendSystemNotification(reasonTitle, {
          body: description,
          tag: `sps-audit-log-${newLog.id}`,
          data: {
            view: 'audit-log',
            logId: newLog.id,
            bookingId: newLog.bookingNumber || newLog.bookingId,
          },
        });
      });

      // Update the known set
      freshLogs.forEach((l) => seenAuditLogIdsRef.current!.add(l.id));
    }
  }, [auditLogs]);

  // Real-Time System Notification Triggers for Pending Approval Actions
  useEffect(() => {
    if (prevStaffBookingPendingRef.current !== null && pendingStaffBookingRequestsCount > prevStaffBookingPendingRef.current) {
      sendSystemNotification('Staff Request: Deposit Terms Approval', {
        body: 'Staff member requested changing the upfront deposit percentage on a client order.',
        tag: 'sps-deposit-req-' + Date.now(),
        data: { view: 'audit-log' },
      });
    }
    prevStaffBookingPendingRef.current = pendingStaffBookingRequestsCount;
  }, [pendingStaffBookingRequestsCount]);

  useEffect(() => {
    if (prevPendingRequestsRef.current !== null && pendingRequestsCount > prevPendingRequestsRef.current) {
      sendSystemNotification('Stock Adjustment Request', {
        body: 'A warehouse staff member submitted a stock adjustment request awaiting review.',
        tag: 'sps-stock-req-' + Date.now(),
        data: { view: 'stock-approvals' },
      });
    }
    prevPendingRequestsRef.current = pendingRequestsCount;
  }, [pendingRequestsCount]);

  useEffect(() => {
    if (prevPendingAccountsRef.current !== null && pendingUsersCount > prevPendingAccountsRef.current) {
      const pendingUsers = users.filter((u) => u.status === 'pending');
      const latestUser = pendingUsers[0];
      const accountLabel = latestUser ? `"${latestUser.name}" (${latestUser.email})` : 'A new staff member';

      sendSystemNotification('New Account Registration', {
        body: `${accountLabel} registered and requires administrator approval. Tap to review.`,
        tag: 'sps-staff-req-' + Date.now(),
        data: { view: 'account-approvals' },
      });
    }
    prevPendingAccountsRef.current = pendingUsersCount;
  }, [pendingUsersCount, users]);

  // Navigation handler supporting direct routing to Account Approvals & Stock Approvals
  const handleNavigate = (view: string) => {
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

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20 md:pb-8 selection:bg-amber-500/20 selection:text-amber-900 print:hidden">
        {/* Top Bar Header */}
        <Header
        currentUser={currentUser}
        activeView={activeView}
        onNavigate={handleNavigate}
        onSwitchRole={handleSwitchRole}
        onLogout={handleLogout}
        pendingCount={pendingCount}
        pendingStockCount={pendingRequestsCount}
        pendingAccountsCount={pendingUsersCount}
        pendingBookingsCount={bookings.filter((b) => b.status === 'pending' || Boolean(b.pendingDepositPercentage)).length}
        pendingAuditNotificationsCount={pendingStaffBookingRequestsCount}
        approvalsTab={approvalsTab}
      />

      {/* Main View Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex-1 w-full">
        {/* VIEW 1: CATALOG & INVENTORY */}
        {activeView === 'inventory' && (
          <div className="space-y-6">

            {/* KPI Metric Strip in Clean Light Mode */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Items
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {products.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Active catalogue items</div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Units In Stock
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {totalUnits}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Sum of all size/colors</div>
              </div>

              {/* Account Approvals KPI Card */}
              <div
                onClick={() => handleNavigate(isAdmin ? 'account-approvals' : 'worker-requests')}
                className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
                  (isAdmin ? pendingUsersCount : pendingRequestsCount) > 0
                    ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center justify-between">
                  <span>{isAdmin ? 'Account Approvals' : 'My Requests'}</span>
                  {(isAdmin ? pendingUsersCount : pendingRequestsCount) > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-amber-900 mt-1">
                  {isAdmin ? pendingUsersCount : pendingRequestsCount}
                </div>
                <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                  {isAdmin
                    ? pendingUsersCount > 0
                      ? `${pendingUsersCount} staff account${pendingUsersCount > 1 ? 's' : ''} awaiting approval`
                      : 'All accounts active • 0 pending'
                    : pendingRequestsCount > 0
                    ? `${pendingRequestsCount} awaiting review`
                    : 'All requests processed'}
                </div>
              </div>

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
              <div className="flex items-center gap-2">
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

              <button
                onClick={() => setShowManageCategoriesModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0 shadow-2xs hover:border-slate-300 ml-auto"
                title="Manage Categories"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Manage Categories</span>
              </button>
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

                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    userRole={isUserAdmin(currentUser) ? 'admin' : 'worker'}
                    onOpenDetails={(p) => setDetailProduct(p)}
                    onRequestAdjustment={(p, variant) => setAdjustmentTarget({ product: p, variant })}
                    onEditProduct={(p) => {
                      setProductToEdit(p);
                      setShowAddModal(true);
                    }}
                    onDeleteProduct={(p) => setProductToDelete(p)}
                    onApproveProduct={handleApproveProduct}
                    onOpenBooking={(p) => {
                      setBookingModalProduct(p);
                      setIsBookingModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2A: STOCK APPROVALS (Stock adjustments queue + New item submissions) */}
        {(activeView === 'stock-approvals' || (activeView === 'approvals' && approvalsTab !== 'staff')) && (
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
            onCreateUserDirectly={handleCreateUserDirectly}
            onApproveProduct={handleApproveProduct}
            onRejectProduct={handleRejectProduct}
          />
        )}

        {/* VIEW 2B: ACCOUNT APPROVALS (Dedicated Staff Accounts & Registration Approvals) */}
        {(activeView === 'account-approvals' || (activeView === 'approvals' && approvalsTab === 'staff')) && (
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
            onCreateUserDirectly={handleCreateUserDirectly}
            onApproveProduct={handleApproveProduct}
            onRejectProduct={handleRejectProduct}
          />
        )}

        {/* VIEW 3: WORKER REQUESTS */}
        {activeView === 'worker-requests' && (
          <WorkerRequestsView
            requests={requests}
            currentUser={currentUser}
            onNavigateToCatalog={() => setActiveView('inventory')}
          />
        )}

        {/* VIEW 4: AUDIT LOG */}
        {activeView === 'audit-log' && (
          <div className="space-y-6">
            <MobileNotificationBanner
              permission={notificationPermission}
              onPermissionChange={setNotificationPermission}
              onShowToast={showToast}
            />
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
          </div>
        )}

        {/* VIEW 5: CLIENT BOOKINGS & QUOTATIONS */}
        {activeView === 'bookings' && (
          <BookingsView
            bookings={bookings}
            currentUser={currentUser}
            onOpenNewBookingModal={() => {
              setBookingModalProduct(undefined);
              setBookingToEdit(null);
              setIsBookingModalOpen(true);
            }}
            onEditBooking={(booking) => {
              if (!isUserAdmin(currentUser)) {
                showToast('Only Admins can edit bookings.');
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
            onDeleteBooking={handleDeleteBooking}
            onUpdateBooking={handleUpdateBooking}
            onLogActivity={(log) => {
              setAuditLogs((prev) => [log, ...prev]);
              insertAuditLogInDb(log).catch(() => {});
            }}
            onShowToast={showToast}
            initialSelectedBookingId={selectedBookingForDetails}
            onClearSelectedBookingId={() => setSelectedBookingForDetails(null)}
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
        activeView={activeView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        pendingCount={pendingCount}
        pendingStockCount={pendingRequestsCount}
        pendingAccountsCount={pendingUsersCount}
        pendingAuditNotificationsCount={pendingStaffBookingRequestsCount}
        approvalsTab={approvalsTab}
        onOpenAddProduct={() => {
          setProductToEdit(undefined);
          setShowAddModal(true);
        }}
        onOpenNewBooking={() => {
          setBookingModalProduct(undefined);
          setIsBookingModalOpen(true);
        }}
      />

      {/* MODAL 1: Size & Color Detail Matrix */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          userRole={isUserAdmin(currentUser) ? 'admin' : 'worker'}
          onClose={() => setDetailProduct(null)}
          onRequestAdjustment={(p, variant) => {
            setDetailProduct(null);
            setAdjustmentTarget({ product: p, variant });
          }}
          onDeleteProduct={handleDeleteProduct}
          onDeleteVariant={handleDeleteVariant}
          onEditProduct={(p) => {
            setDetailProduct(null);
            setProductToEdit(p);
            setShowAddModal(true);
          }}
          onApproveProduct={handleApproveProduct}
        />
      )}

      {/* MODAL 2: Stock Adjustment (Worker Request or Admin Direct) */}
      {adjustmentTarget && (
        <AdjustmentModal
          product={adjustmentTarget.product}
          initialVariant={adjustmentTarget.variant}
          currentUser={currentUser}
          onClose={() => setAdjustmentTarget(null)}
          onSubmitWorkerRequest={handleSubmitWorkerRequest}
          onAdminDirectAdjust={handleAdminDirectAdjust}
        />
      )}

      {/* MODAL 3: Add / Edit Product (Admin) */}
      {showAddModal && (
        <AddProductModal
          currentUser={currentUser}
          categories={categories}
          availableFolders={allFolderPaths}
          productToEdit={productToEdit}
          onClose={() => {
            setShowAddModal(false);
            setProductToEdit(undefined);
          }}
          onSaveProduct={handleSaveProduct}
          onManageCategories={() => setShowManageCategoriesModal(true)}
          onOpenDirectAdjust={(prod, variant) => {
            setShowAddModal(false);
            setProductToEdit(undefined);
            setAdjustmentTarget({ product: prod, variant });
          }}
        />
      )}

      {/* MODAL 4: Manage Categories (Dedicated SQL Table & FK) */}
      {showManageCategoriesModal && (
        <ManageCategoriesModal
          categories={categories}
          currentUser={currentUser}
          onClose={() => setShowManageCategoriesModal(false)}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      )}

      {/* Confirmation Modal for Direct Product Deletion from Catalog */}
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
      {selectedActivityLog && (
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
      {isBookingModalOpen && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setBookingModalProduct(undefined);
            setBookingToEdit(null);
          }}
          products={products}
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
