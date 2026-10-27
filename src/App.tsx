import React, { useState, useEffect } from 'react';
import {
  Product,
  AdjustmentRequest,
  AuditLogEntry,
  User,
  Role,
  ProductVariant,
  AdjustmentReason,
  Category,
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
  approveUserAccount,
  rejectUserAccount,
  resetAllToDemo,
  getStoredCategories,
  saveStoredCategories,
  clearStoredAuditLogs,
} from './utils/storage';
import { INITIAL_USERS, SEED_CATALOG_DATA } from './data/initialData';
import {
  checkSupabaseConnection,
  fetchProductsFromDb,
  upsertProductToDb,
  deleteProductFromDb,
  deleteProductVariantFromDb,
  deleteUserFromDb,
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
  CATEGORY_MAP,
  DbConnectionStatus,
} from './services/supabaseService';
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

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedAudience, setSelectedAudience] = useState<string>('All');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

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

  const showToast = (msg: string, log?: AuditLogEntry) => {
    setToastNotification({ message: msg, log });
    setTimeout(() => {
      setToastNotification((prev) => (prev?.message === msg ? null : prev));
    }, 6000);
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
    if (currentUser?.role !== 'admin') {
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
    if (currentUser?.role !== 'admin') {
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
    if (currentUser?.role !== 'admin') {
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
    if (currentUser?.role !== 'admin') {
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

  // Load live data from Supabase
  const refreshFromSupabase = async (notify = false) => {
    setIsDbLoading(true);
    try {
      const status = await checkSupabaseConnection();
      setDbStatus(status);

      if (status.connected && status.tablesExist) {
        const [dbProducts, dbRequests, dbUsers, dbCategories, dbLogs] = await Promise.allSettled([
          fetchProductsFromDb(),
          fetchAdjustmentRequestsFromDb(),
          fetchUsersFromDb(),
          fetchCategoriesFromDb(),
          fetchAuditLogsFromDb(),
        ]);

        if (dbProducts.status === 'fulfilled') {
          setProducts(dbProducts.value);
        }
        if (dbRequests.status === 'fulfilled') {
          setRequests(dbRequests.value);
        }
        if (dbUsers.status === 'fulfilled' && dbUsers.value.length > 0) {
          setUsers(dbUsers.value);
        }
        if (dbCategories.status === 'fulfilled' && dbCategories.value.length > 0) {
          setCategories(dbCategories.value);
        }
        if (dbLogs.status === 'fulfilled' && dbLogs.value.length > 0) {
          setAuditLogs(dbLogs.value);
        }

        if (notify) {
          showToast('Live inventory synchronized with Supabase.');
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

  useEffect(() => {
    refreshFromSupabase(false);
  }, []);

  // Auth Handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveView('inventory');
    showToast(`Signed in as ${user.name} (${user.role === 'admin' ? 'Admin' : 'Floor Staff'})`);
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
        name: 'Floor Staff Member',
        role: 'worker',
        email: 'karim@wearhouse.com',
        status: 'active',
      };
      setCurrentUser(worker as User);
      showToast(`Switched to Floor Worker: ${worker.name}`);
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
    const isEdit = products.some((p) => p.id === product.id);
    let updatedProducts: Product[];
    if (isEdit) {
      updatedProducts = products.map((p) => (p.id === product.id ? product : p));
    } else {
      updatedProducts = [product, ...products];
    }

    setProducts(updatedProducts);

    // Audit log
    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: isEdit ? 'product_updated' : 'product_created',
      actorName: currentUser?.name || 'Admin',
      actorRole: currentUser?.role || 'admin',
      summary: isEdit
        ? `Updated garment "${product.name}"`
        : `Added new garment "${product.name}"`,
      details: `${product.variants.length} size/color variants (${product.totalQuantity} total units).`,
      productId: product.id,
      productName: product.name,
      productImage: product.image || product.images?.[0],
      totalQuantityAfter: product.totalQuantity,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    // Save product to Supabase FIRST so foreign key constraint is satisfied before writing audit logs
    try {
      await upsertProductToDb(product);
    } catch (err: any) {
      console.warn('Supabase upsert product error:', err?.message);
    }

    // Then record audit log
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(isEdit ? `Updated "${product.name}"` : `Added "${product.name}" to inventory`, newLog);
    setProductToEdit(undefined);
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
    const oldProductTotal = affectedProduct?.totalQuantity || 0;
    const newProductTotal = oldProductTotal + delta;
    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'stock_adjusted',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Updated inventory for "${affectedProduct?.name || 'Item'}"`,
      details: `Added to inventory: Size ${variantSize}${variantColor ? ` (${variantColor})` : ''} adjusted from ${oldQty} to ${data.newQuantity} units (${delta > 0 ? `+${delta}` : delta} units). Total units changed from ${oldProductTotal} to ${newProductTotal} units. Reason: ${data.reason}. ${data.note ? `Note: ${data.note}` : ''}`,
      productId: data.productId,
      productName: affectedProduct?.name,
      productImage: affectedProduct?.image || affectedProduct?.images?.[0],
      variantSize,
      variantColor,
      oldQuantity: oldQty,
      newQuantity: data.newQuantity,
      delta,
      totalQuantityBefore: oldProductTotal,
      totalQuantityAfter: newProductTotal,
      reason: data.reason,
      note: data.note,
    };
    setAuditLogs([newLog, ...auditLogs]);
    insertAuditLogInDb(newLog).catch(() => {});

    showToast(`Inventory updated: ${affectedProduct?.name || 'Item'} (${variantSize}) is now ${data.newQuantity} units.`, newLog);
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

    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'request_approved',
      actorName: currentUser?.name || 'Admin',
      actorRole: 'admin',
      summary: `Approved stock change for "${targetReq.productName}"`,
      details: `Worker ${targetReq.workerName} requested ${targetReq.currentQuantity} → ${
        targetReq.requestedQuantity
      } (${delta > 0 ? `+${delta}` : delta} units) for Size ${
        targetReq.size
      } / ${targetReq.colorName}. Total units changed from ${oldProductTotal} to ${nextProductTotal} units. Reason: ${targetReq.reason}.${
        adminNote ? ` Admin note: ${adminNote}` : ''
      }`,
      productId: targetReq.productId,
      productName: targetReq.productName,
      productImage: targetReq.productImage,
      variantSize: targetReq.size,
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
        details: `Account for ${newUser.email} (${newUser.role === 'admin' ? 'Warehouse Admin' : 'Floor Staff'}) created directly as Active without approval.`,
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

  // Refresh data from Supabase
  const handleResetData = () => {
    refreshFromSupabase(true);
  };

  // Pending count for alerts (includes pending staff registrations for admin)
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;
  const pendingUsersCount = users.filter((u) => u.status === 'pending').length;
  const pendingCount = currentUser?.role === 'admin' 
    ? (pendingRequestsCount + pendingUsersCount) 
    : pendingRequestsCount;

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

    return matchesSearch && matchesCategory && matchesAudience && matchesLowStock;
  });

  // KPI Calculations
  const totalUnits = products.reduce((sum, p) => sum + p.totalQuantity, 0);
  const lowStockCount = products.filter((p) =>
    p.variants.some((v) => v.minThreshold !== undefined && v.quantity <= v.minThreshold)
  ).length;

  // Not logged in -> Show Dual Authentication Screens
  if (!currentUser) {
    return <AuthScreens onLogin={handleLogin} />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20 md:pb-8 selection:bg-amber-500/20 selection:text-amber-900">
      {/* Top Bar Header */}
      <Header
        currentUser={currentUser}
        activeView={activeView}
        onNavigate={(view) => {
          if (view === 'add-product') {
            setProductToEdit(undefined);
            setShowAddModal(true);
          } else {
            setActiveView(view);
          }
        }}
        onSwitchRole={handleSwitchRole}
        onLogout={handleLogout}
        pendingCount={pendingCount}
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

              {/* Pending Approvals KPI */}
              <div
                onClick={() => setActiveView(isAdmin ? 'approvals' : 'worker-requests')}
                className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
                  pendingCount > 0
                    ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center justify-between">
                  <span>{isAdmin ? 'Pending Approvals' : 'Pending Requests'}</span>
                  {pendingCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-amber-900 mt-1">
                  {pendingCount}
                </div>
                <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                  {isAdmin
                    ? `${pendingRequestsCount} stock • ${pendingUsersCount} staff`
                    : 'Awaiting admin review'}
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
                {isAdmin && (
                  <button
                    onClick={() => {
                      setProductToEdit(undefined);
                      setShowAddModal(true);
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Item</span>
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

              {isAdmin && (
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

            {/* Product Grid or Clean Empty State */}
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
            ) : filteredProducts.length === 0 ? (
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
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl shadow-sm"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    userRole={currentUser.role}
                    onOpenDetails={(p) => setDetailProduct(p)}
                    onRequestAdjustment={(p, variant) => setAdjustmentTarget({ product: p, variant })}
                    onEditProduct={(p) => {
                      setProductToEdit(p);
                      setShowAddModal(true);
                    }}
                    onDeleteProduct={(p) => setProductToDelete(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: ADMIN APPROVALS QUEUE */}
        {activeView === 'approvals' && (
          <ApprovalsView
            requests={requests}
            users={users}
            currentUser={currentUser}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onApproveUser={handleApproveUser}
            onRejectUser={handleRejectUser}
            onDeleteUser={handleDeleteUser}
            onCreateUserDirectly={handleCreateUserDirectly}
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
          <AuditLogView
            logs={auditLogs}
            products={products}
            onViewProduct={(pId) => {
              const p = products.find((prod) => prod.id === pId);
              if (p) setDetailProduct(p);
            }}
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
        onNavigate={(view) => {
          if (view === 'add-product') {
            setProductToEdit(undefined);
            setShowAddModal(true);
          } else {
            setActiveView(view);
          }
        }}
        onLogout={handleLogout}
        pendingCount={pendingCount}
      />

      {/* MODAL 1: Size & Color Detail Matrix */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          userRole={currentUser.role}
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
          productToEdit={productToEdit}
          onClose={() => {
            setShowAddModal(false);
            setProductToEdit(undefined);
          }}
          onSaveProduct={handleSaveProduct}
          onManageCategories={() => setShowManageCategoriesModal(true)}
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
        message={`Are you sure you want to delete "${productToDelete?.name}" (${productToDelete?.sku})?`}
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
          onClose={() => setSelectedActivityLog(null)}
          onViewProduct={(pId) => {
            const p = products.find((prod) => prod.id === pId);
            if (p) {
              setDetailProduct(p);
              setActiveView('inventory');
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
    </div>
  );
};
