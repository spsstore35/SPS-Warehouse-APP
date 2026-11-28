import React, { useMemo, useState } from 'react';
import {
  BatchStageAssignment,
  CustomStageDefinition,
  OperationStageKey,
  Product,
  ProductStageVendor,
  ProductWorkflow,
  ProductionBatch,
  TeamChangeRequest,
  User,
  Vendor,
  VendorBehaviorTag,
  VendorPriceEntry,
  WorkflowTemplateApplication,
  WorkflowType,
} from '../types/inventory';
import {
  ALL_OPERATION_STAGES,
  DEFAULT_STAGE_KEYS,
  VENDOR_TAG_GROUPS,
  buildWhatsAppUrl,
  getStageMeta,
  getVendorTagInfo,
  inferDefaultWorkflowType,
} from '../utils/sourcing';
import { canUserManageVendors } from '../utils/security';
import BatchCostModal from './BatchCostModal';
import { TeamRequestsPanel } from './TeamRequestsPanel';
import {
  AdvanceStageModal,
  ApplyWorkflowTemplateModal,
  CompleteStockInModal,
  GlobalVendorModal,
  StartBatchModal,
} from './SourcingModals';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Factory,
  Image as ImageIcon,
  Layers,
  Link2,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Star,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';

interface SourcingOperationsViewProps {
  products: Product[];
  vendors: Vendor[];
  workflows: ProductWorkflow[];
  stageVendors: ProductStageVendor[];
  priceHistory: VendorPriceEntry[];
  batches: ProductionBatch[];
  currentUser: User;
  users?: User[];
  teamRequests?: TeamChangeRequest[];
  onSubmitTeamRequest?: (
    req: Omit<TeamChangeRequest, 'id' | 'status' | 'requestedById' | 'requestedByName' | 'requestedAt'>
  ) => void;
  onApproveTeamRequest?: (req: TeamChangeRequest, adminNote?: string) => void;
  onRejectTeamRequest?: (req: TeamChangeRequest, adminNote?: string) => void;
  onSaveVendor: (vendor: Vendor) => void;
  onDeleteVendor: (vendorId: string) => void;
  onSaveWorkflow: (workflow: ProductWorkflow) => void;
  onApplyWorkflowTemplate?: (payload: WorkflowTemplateApplication) => void;
  onSaveStageVendor: (link: ProductStageVendor) => void;
  onDeleteStageVendor: (linkId: string) => void;
  onAddPriceEntry: (entry: VendorPriceEntry) => void;
  onSaveBatch: (batch: ProductionBatch) => void;
  onDeleteBatch: (batchId: string) => void;
  onCompleteBatchStockIn: (payload: {
    batchId: string;
    finalQuantity: number;
    variantId: string;
  }) => void;
  onShowToast?: (msg: string) => void;
}

type TopTab = 'catalog' | 'vendors';
type CatalogFilter = 'all' | 'manufactured' | 'ready_made' | 'active_batches';

export const SourcingOperationsView: React.FC<SourcingOperationsViewProps> = ({
  products,
  vendors,
  workflows,
  stageVendors,
  priceHistory,
  batches,
  currentUser,
  users = [],
  teamRequests = [],
  onSubmitTeamRequest,
  onApproveTeamRequest,
  onRejectTeamRequest,
  onSaveVendor,
  onDeleteVendor,
  onSaveWorkflow,
  onApplyWorkflowTemplate,
  onSaveStageVendor,
  onDeleteStageVendor,
  onAddPriceEntry,
  onSaveBatch,
  onDeleteBatch,
  onCompleteBatchStockIn,
  onShowToast,
}) => {
  // Direct edits (vendors, prices, stages, batches): purchases admin and full admin only (same as the database).
  // Everyone else sends a request that one of them approves.
  const isAdmin = canUserManageVendors(currentUser, users);
  const [topTab, setTopTab] = useState<TopTab>('catalog');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [stageDrafts, setStageDrafts] = useState<Record<string, { approxOrderQty: string; orderScriptNotes: string }>>({});

  // Catalog Grid Filters
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');

  // Product Workspace Controls
  const [showCustomizeStages, setShowCustomizeStages] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageUnit, setNewStageUnit] = useState('piece');
  const [newStageDays, setNewStageDays] = useState('');
  const [newStageDesc, setNewStageDesc] = useState('');
  const [editingStageKey, setEditingStageKey] = useState<string | null>(null);
  const [editingStageLabel, setEditingStageLabel] = useState('');
  const [editingStageUnit, setEditingStageUnit] = useState('piece');
  const [editingStageDays, setEditingStageDays] = useState('');
  const [drawerStageKey, setDrawerStageKey] = useState<OperationStageKey | null>(null);
  const [batchTab, setBatchTab] = useState<'active' | 'completed'>('active');
  const [isStartBatchOpen, setIsStartBatchOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductionBatch | null>(null);
  const [stockInBatch, setStockInBatch] = useState<ProductionBatch | null>(null);
  const [costBatchId, setCostBatchId] = useState<string | null>(null);
  const [advancingBatchContext, setAdvancingBatchContext] = useState<{
    batch: ProductionBatch;
    currentStageKey: OperationStageKey;
    nextStageKey: OperationStageKey;
  } | null>(null);

  // Stage Drawer Controls
  const [linkVendorId, setLinkVendorId] = useState('');
  const [expandedLedgers, setExpandedLedgers] = useState<Record<string, boolean>>({});
  const [addingPriceForPsvId, setAddingPriceForPsvId] = useState<string | null>(null);
  const [priceFormDate, setPriceFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priceFormAmount, setPriceFormAmount] = useState('');
  const [priceFormQty, setPriceFormQty] = useState('');
  const [priceFormNotes, setPriceFormNotes] = useState('');

  // Vendor Directory Controls
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorTagFilter, setVendorTagFilter] = useState<VendorBehaviorTag | 'all'>('all');
  const [vendorProductFilter, setVendorProductFilter] = useState<string>('all');
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [linkAfterCreateTarget, setLinkAfterCreateTarget] = useState<{
    productId: string;
    stageKey: OperationStageKey;
  } | null>(null);

  // Resolve effective workflow for any product
  const getEffectiveWorkflow = (product: Product): ProductWorkflow => {
    const existing = workflows.find((w) => w.productId === product.id);
    if (existing && existing.activeStages.length > 0) return existing;
    const inferredType = existing?.workflowType || inferDefaultWorkflowType(product);
    return {
      id: existing?.id || `wf_${product.id}`,
      productId: product.id,
      workflowType: inferredType,
      activeStages: [...DEFAULT_STAGE_KEYS[inferredType]],
    };
  };

  const activeCatalogProducts = useMemo(
    () => products.filter((p) => p.status !== 'pending'),
    [products]
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const activeBatchesCountByProduct = useMemo(() => {
    const map = new Map<string, number>();
    batches.forEach((b) => {
      if (b.status === 'in_progress') {
        map.set(b.productId, (map.get(b.productId) || 0) + 1);
      }
    });
    return map;
  }, [batches]);

  const filteredCatalogProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return activeCatalogProducts.filter((product) => {
      const wf = getEffectiveWorkflow(product);
      const activeBatchCount = activeBatchesCountByProduct.get(product.id) || 0;

      if (catalogFilter === 'manufactured' && wf.workflowType !== 'manufactured') return false;
      if (catalogFilter === 'ready_made' && wf.workflowType !== 'ready_made') return false;
      if (catalogFilter === 'active_batches' && activeBatchCount === 0) return false;

      if (!q) return true;
      const linkedVendorNames = stageVendors
        .filter((psv) => psv.productId === product.id)
        .map((psv) => vendors.find((v) => v.id === psv.vendorId)?.name || '')
        .join(' ');
      const haystack = `${product.name} ${product.sku} ${product.category} ${linkedVendorNames}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [
    activeCatalogProducts,
    catalogFilter,
    catalogSearch,
    workflows,
    activeBatchesCountByProduct,
    stageVendors,
    vendors,
  ]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return vendors.filter((v) => {
      if (vendorTagFilter !== 'all' && !v.tags.includes(vendorTagFilter)) return false;
      if (vendorProductFilter !== 'all' && !stageVendors.some((psv) => psv.vendorId === v.id && psv.productId === vendorProductFilter)) return false;
      if (!q) return true;
      const hay = `${v.name} ${v.contactPerson || ''} ${v.location || ''} ${v.phone || ''} ${v.generalNotes || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vendors, vendorSearch, vendorTagFilter, vendorProductFilter, stageVendors]);

  const getLatestPriceForPsv = (psvId: string): VendorPriceEntry | undefined => {
    return priceHistory
      .filter((ph) => ph.productStageVendorId === psvId)
      .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0];
  };

  const commitWorkflowUpdate = (
    product: Product,
    updatedWf: ProductWorkflow,
    title: string,
    summary: string,
    toastMsg?: string
  ) => {
    if (!isAdmin && onSubmitTeamRequest) {
      onSubmitTeamRequest({
        teamScope: 'purchases',
        entityType: 'sourcing_workflow',
        actionType: 'update',
        targetId: updatedWf.id,
        title,
        summary,
        payload: { workflow: updatedWf },
      });
      return;
    }
    onSaveWorkflow(updatedWf);
    if (toastMsg) onShowToast?.(toastMsg);
  };

  const handleSwitchWorkflowType = (product: Product, nextType: WorkflowType) => {
    const existing = getEffectiveWorkflow(product);
    const updated: ProductWorkflow = {
      ...existing,
      id: existing.id || `wf_${product.id}`,
      productId: product.id,
      workflowType: nextType,
      activeStages: [...DEFAULT_STAGE_KEYS[nextType]],
      updatedAt: new Date().toISOString(),
    };
    commitWorkflowUpdate(
      product,
      updated,
      `Switch Workflow: ${product.name}`,
      `Change pipeline to ${nextType === 'manufactured' ? 'Manufactured' : 'Ready-Made'}.`,
      `Switched "${product.name}" to ${nextType === 'manufactured' ? 'Manufactured' : 'Ready-Made'} pipeline.`
    );
  };

  const handleToggleStageInWorkflow = (product: Product, stageKey: OperationStageKey) => {
    if (stageKey === 'stock_in') return; // Final Gard stage stays required
    const wf = getEffectiveWorkflow(product);
    const exists = wf.activeStages.includes(stageKey);
    let nextStages: OperationStageKey[];
    if (exists) {
      nextStages = wf.activeStages.filter((k) => k !== stageKey);
    } else {
      const stockIdx = wf.activeStages.indexOf('stock_in');
      if (stockIdx === -1) {
        nextStages = [...wf.activeStages, stageKey, 'stock_in'];
      } else {
        nextStages = [
          ...wf.activeStages.slice(0, stockIdx),
          stageKey,
          ...wf.activeStages.slice(stockIdx),
        ];
      }
    }
    const updatedWf: ProductWorkflow = {
      ...wf,
      activeStages: nextStages,
      updatedAt: new Date().toISOString(),
    };
    commitWorkflowUpdate(
      product,
      updatedWf,
      `Customize Pipeline Stages: ${product.name}`,
      `${exists ? 'Remove' : 'Add'} stage "${getStageMeta(stageKey, wf.customStages).shortLabel}".`
    );
  };

  const handleMoveStageInWorkflow = (
    product: Product,
    stageKey: OperationStageKey,
    direction: -1 | 1
  ) => {
    if (stageKey === 'stock_in') return;
    const wf = getEffectiveWorkflow(product);
    const nonStockStages = wf.activeStages.filter((k) => k !== 'stock_in');
    const idx = nonStockStages.indexOf(stageKey);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= nonStockStages.length) return;
    const reordered = [...nonStockStages];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    const nextStages: OperationStageKey[] = [...reordered, 'stock_in'];
    const updatedWf: ProductWorkflow = {
      ...wf,
      activeStages: nextStages,
      updatedAt: new Date().toISOString(),
    };
    commitWorkflowUpdate(
      product,
      updatedWf,
      `Reorder Pipeline Stages: ${product.name}`,
      `Moved "${getStageMeta(stageKey, wf.customStages).shortLabel}".`
    );
  };

  const handleAddCustomStage = (product: Product) => {
    const trimmedName = newStageName.trim();
    if (!trimmedName) {
      onShowToast?.('Enter a name for the custom stage.');
      return;
    }
    const wf = getEffectiveWorkflow(product);
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20);
    const key = `custom_${slug || 'stage'}_${Date.now().toString(36).slice(-4)}`;
    const nextCustomStages: Record<string, CustomStageDefinition> = {
      ...(wf.customStages || {}),
      [key]: {
        key,
        label: trimmedName,
        shortLabel: trimmedName,
        description: newStageDesc.trim() || `Custom stage: ${trimmedName}`,
        defaultUnit: newStageUnit.trim() || 'piece',
      },
    };
    const stockIdx = wf.activeStages.indexOf('stock_in');
    const nextStages: OperationStageKey[] =
      stockIdx === -1
        ? [...wf.activeStages, key, 'stock_in']
        : [...wf.activeStages.slice(0, stockIdx), key, ...wf.activeStages.slice(stockIdx)];

    const parsedNewDays = Math.max(0, Math.round(Number(newStageDays) || 0));
    const nextLeadTimes: Record<string, number> = {
      ...(wf.stageLeadTimes || {}),
      ...(parsedNewDays > 0 ? { [key]: parsedNewDays } : {}),
    };

    const updatedWf: ProductWorkflow = {
      ...wf,
      activeStages: nextStages,
      customStages: nextCustomStages,
      stageLeadTimes: nextLeadTimes,
      updatedAt: new Date().toISOString(),
    };

    setNewStageName('');
    setNewStageDesc('');
    setNewStageUnit('piece');
    setNewStageDays('');
    commitWorkflowUpdate(
      product,
      updatedWf,
      `Add Custom Stage: ${product.name}`,
      `Added custom stage "${trimmedName}" (${nextCustomStages[key].defaultUnit}${
        parsedNewDays > 0 ? `, ${parsedNewDays}d` : ''
      }).`,
      `Added stage "${trimmedName}" to pipeline.`
    );
  };

  const handleSaveStageRename = (product: Product, stageKey: OperationStageKey) => {
    const trimmed = editingStageLabel.trim();
    if (!trimmed) {
      setEditingStageKey(null);
      return;
    }
    const wf = getEffectiveWorkflow(product);
    const existingMeta = getStageMeta(stageKey, wf.customStages);
    const nextCustomStages: Record<string, CustomStageDefinition> = {
      ...(wf.customStages || {}),
      [stageKey]: {
        key: stageKey,
        label: trimmed,
        shortLabel: trimmed,
        description: existingMeta.description,
        defaultUnit: editingStageUnit.trim() || existingMeta.defaultUnit || 'piece',
      },
    };
    const parsedDays = Math.max(0, Math.round(Number(editingStageDays) || 0));
    const nextLeadTimes: Record<string, number> = { ...(wf.stageLeadTimes || {}) };
    if (editingStageDays.trim() !== '') {
      nextLeadTimes[stageKey] = parsedDays;
    }

    const updatedWf: ProductWorkflow = {
      ...wf,
      customStages: nextCustomStages,
      stageLeadTimes: nextLeadTimes,
      updatedAt: new Date().toISOString(),
    };
    setEditingStageKey(null);
    commitWorkflowUpdate(
      product,
      updatedWf,
      `Rename Pipeline Stage: ${product.name}`,
      `Renamed stage to "${trimmed}".`,
      `Updated stage "${trimmed}".`
    );
  };

  const handleUpdateStageLeadTime = (
    product: Product,
    stageKey: OperationStageKey,
    rawDays: string
  ) => {
    const wf = getEffectiveWorkflow(product);
    const parsed = Math.max(0, Math.round(Number(rawDays) || 0));
    const nextLeadTimes: Record<string, number> = { ...(wf.stageLeadTimes || {}) };
    if (rawDays.trim() === '' || parsed === 0) {
      delete nextLeadTimes[stageKey];
    } else {
      nextLeadTimes[stageKey] = parsed;
    }
    const updatedWf: ProductWorkflow = {
      ...wf,
      stageLeadTimes: nextLeadTimes,
      updatedAt: new Date().toISOString(),
    };
    commitWorkflowUpdate(
      product,
      updatedWf,
      `Update Stage Duration: ${product.name}`,
      `Set estimated time for "${getStageMeta(stageKey, wf.customStages).shortLabel}" to ${parsed} days.`
    );
  };

  const getWorkflowTotalDays = (wf: ProductWorkflow): number =>
    wf.activeStages.reduce(
      (sum, k) => sum + Math.max(0, Number(wf.stageLeadTimes?.[k] || 0)),
      0
    );

  const getRemainingDaysFromStage = (
    wf: ProductWorkflow,
    currentKey: OperationStageKey
  ): number => {
    const idx = wf.activeStages.indexOf(currentKey);
    const slice = idx >= 0 ? wf.activeStages.slice(idx) : wf.activeStages;
    return slice.reduce(
      (sum, k) => sum + Math.max(0, Number(wf.stageLeadTimes?.[k] || 0)),
      0
    );
  };

  const handleResetToCleanPipeline = (product: Product) => {
    const wf = getEffectiveWorkflow(product);
    const updatedWf: ProductWorkflow = {
      ...wf,
      activeStages: ['stock_in'],
      updatedAt: new Date().toISOString(),
    };
    commitWorkflowUpdate(
      product,
      updatedWf,
      `Start Clean Pipeline: ${product.name}`,
      `Reset stages to empty + Final Gard ready to customize from scratch.`,
      `Cleared stages for "${product.name}". Add your custom stages below.`
    );
  };

  const handleLinkVendorToStage = (
    productId: string,
    stageKey: OperationStageKey,
    vendorId: string
  ) => {
    if (!vendorId) return;
    const existingLinks = stageVendors.filter(
      (psv) => psv.productId === productId && psv.stageKey === stageKey
    );
    if (existingLinks.some((l) => l.vendorId === vendorId)) {
      onShowToast?.('This vendor is already linked to this stage.');
      return;
    }
    const newLink: ProductStageVendor = {
      id: `psv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId,
      stageKey,
      vendorId,
      isPrimary: existingLinks.length === 0,
      approxOrderQty: '',
      orderScriptNotes: '',
    };
    if (!isAdmin && onSubmitTeamRequest) {
      const prodName = products.find((p) => p.id === productId)?.name || productId;
      const vendorName = vendors.find((v) => v.id === vendorId)?.name || vendorId;
      onSubmitTeamRequest({
        teamScope: 'purchases',
        entityType: 'sourcing_stage_vendor',
        actionType: 'create',
        targetId: newLink.id,
        title: `Link Vendor: ${vendorName}`,
        summary: `Link ${vendorName} to ${getStageMeta(stageKey, workflows.find((w) => w.productId === productId)?.customStages).shortLabel} for "${prodName}".`,
        payload: { link: newLink },
      });
      setLinkVendorId('');
      return;
    }
    onSaveStageVendor(newLink);
    setLinkVendorId('');
    onShowToast?.('Vendor linked to stage.');
  };

  const handleSetPrimaryStageVendor = (targetLink: ProductStageVendor) => {
    if (!isAdmin && onSubmitTeamRequest) {
      const prodName = products.find((p) => p.id === targetLink.productId)?.name || targetLink.productId;
      const vendorName = vendors.find((v) => v.id === targetLink.vendorId)?.name || targetLink.vendorId;
      onSubmitTeamRequest({
        teamScope: 'purchases',
        entityType: 'sourcing_stage_vendor',
        actionType: 'update',
        targetId: targetLink.id,
        title: `Set Primary Vendor: ${vendorName}`,
        summary: `Make ${vendorName} primary on ${getStageMeta(targetLink.stageKey, workflows.find((w) => w.productId === targetLink.productId)?.customStages).shortLabel} for "${prodName}".`,
        payload: { link: { ...targetLink, isPrimary: true }, setPrimary: true },
      });
      return;
    }
    const siblings = stageVendors.filter(
      (psv) =>
        psv.productId === targetLink.productId && psv.stageKey === targetLink.stageKey
    );
    siblings.forEach((sib) => {
      const shouldBePrimary = sib.id === targetLink.id;
      if (sib.isPrimary !== shouldBePrimary) {
        onSaveStageVendor({ ...sib, isPrimary: shouldBePrimary });
      }
    });
  };

  const handleRequestAdvanceBatchStage = (
    batch: ProductionBatch,
    activeStages: OperationStageKey[]
  ) => {
    const currentIndex = activeStages.indexOf(batch.currentStageKey);
    if (currentIndex === -1 || currentIndex >= activeStages.length - 1) return;
    const nextStageKey = activeStages[currentIndex + 1];
    setAdvancingBatchContext({
      batch,
      currentStageKey: batch.currentStageKey,
      nextStageKey,
    });
  };

  const handleConfirmAdvanceBatchStage = ({
    batchId,
    stageKey,
    nextStageKey,
    assignment,
  }: {
    batchId: string;
    stageKey: OperationStageKey;
    nextStageKey: OperationStageKey;
    assignment: BatchStageAssignment;
  }) => {
    const targetBatch = batches.find((b) => b.id === batchId);
    if (!targetBatch) return;
    const prod = products.find((p) => p.id === targetBatch.productId);
    const wf = prod ? getEffectiveWorkflow(prod) : undefined;
    const nextStageMeta = getStageMeta(nextStageKey, wf?.customStages);
    const completedMeta = getStageMeta(stageKey, wf?.customStages);

    const vendorLabel = assignment.vendorId
      ? vendors.find((v) => v.id === assignment.vendorId)?.name || 'Vendor'
      : assignment.customVendorName || 'Workshop';

    const updatedBatch: ProductionBatch = {
      ...targetBatch,
      currentStageKey: nextStageKey,
      stageAssignments: {
        ...(targetBatch.stageAssignments || {}),
        [stageKey]: assignment,
      },
    };

    if (!isAdmin && onSubmitTeamRequest) {
      onSubmitTeamRequest({
        teamScope: 'purchases',
        entityType: 'sourcing_batch',
        actionType: 'update',
        targetId: targetBatch.id,
        title: `Advance Batch ${targetBatch.batchCode}`,
        summary: `Completed ${completedMeta.shortLabel} @ ${vendorLabel} (${(
          assignment.totalCost ?? assignment.cost ?? 0
        ).toLocaleString()} EGP) -> ${nextStageMeta.shortLabel}.`,
        payload: { batch: updatedBatch },
      });
      setAdvancingBatchContext(null);
      return;
    }
    onSaveBatch(updatedBatch);
    setAdvancingBatchContext(null);
    onShowToast?.(
      `${targetBatch.batchCode} moved to ${nextStageMeta.shortLabel} (${vendorLabel} · ${(
        assignment.totalCost ?? assignment.cost ?? 0
      ).toLocaleString()} EGP).`
    );
  };

  const totalActiveBatches = batches.filter((b) => b.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Sourcing &amp; Production Operations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Map product supply chains, vendor price ledgers, ordering scripts, and live restock batches.
          </p>
        </div>

        {/* Segmented Tabs: Catalog Operations vs All Vendors Directory */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setTopTab('catalog')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 min-h-[38px] ${
              topTab === 'catalog'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Catalog Operations ({activeCatalogProducts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTopTab('vendors')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 min-h-[38px] ${
              topTab === 'vendors'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>All Vendors Directory ({vendors.length})</span>
          </button>
        </div>
      </div>

      {onApproveTeamRequest && onRejectTeamRequest && (
        <TeamRequestsPanel
          currentUser={currentUser}
          users={users}
          teamScopes={['purchases']}
          requests={teamRequests}
          onApproveRequest={onApproveTeamRequest}
          onRejectRequest={onRejectTeamRequest}
        />
      )}

      {/* VIEW 1: CATALOG OPERATIONS */}
      {topTab === 'catalog' && !selectedProduct && (
        <div className="space-y-5">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs font-medium text-slate-500">Catalog Products</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {activeCatalogProducts.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs font-medium text-slate-500">Manufactured</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {
                  activeCatalogProducts.filter(
                    (p) => getEffectiveWorkflow(p).workflowType === 'manufactured'
                  ).length
                }
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs font-medium text-slate-500">Master Vendors</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {vendors.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs font-medium text-slate-500">Active Batches</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {totalActiveBatches}
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search products by name, SKU, or assigned vendor..."
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {(
                [
                  { id: 'all', label: 'All Items' },
                  { id: 'manufactured', label: 'Manufactured' },
                  { id: 'ready_made', label: 'Ready-Made' },
                  { id: 'active_batches', label: `Has Active Batches (${totalActiveBatches})` },
                ] as { id: CatalogFilter; label: string }[]
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setCatalogFilter(pill.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
                    catalogFilter === pill.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {activeCatalogProducts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 max-w-lg mx-auto">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">
                No Inventory Catalog Items Found
              </h3>
              <p className="text-xs text-slate-500">
                Add products to your Inventory Catalog first to configure supply chain pipelines.
              </p>
            </div>
          ) : filteredCatalogProducts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700">
                No products match your current search or filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCatalogSearch('');
                  setCatalogFilter('all');
                }}
                className="text-xs font-bold text-blue-700 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCatalogProducts.map((product) => {
                const wf = getEffectiveWorkflow(product);
                const activeBatchCount = activeBatchesCountByProduct.get(product.id) || 0;
                const linkedVendorCount = new Set(
                  stageVendors
                    .filter((psv) => psv.productId === product.id)
                    .map((psv) => psv.vendorId)
                ).size;
                const imgSrc = product.image || product.images?.[0];

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(product.id);
                      setDrawerStageKey(null);
                      setShowCustomizeStages(false);
                    }}
                    className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-2xl overflow-hidden transition-all flex flex-col group cursor-pointer"
                  >
                    <div className="relative aspect-[16/10] bg-slate-100 border-b border-slate-100 overflow-hidden w-full">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="w-8 h-8 mb-1" />
                          <span className="text-xs">{product.category}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3 w-full">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-slate-700">
                            {product.sku}
                          </span>
                          <span
                            className={`font-semibold ${
                              wf.workflowType === 'manufactured'
                                ? 'text-blue-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {wf.workflowType === 'manufactured' ? 'Manufactured' : 'Ready-Made'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1 group-hover:text-blue-700 transition-colors">
                          {product.name}
                        </h3>

                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
                          <span className="font-mono tabular-nums font-semibold text-slate-800">
                            {product.totalQuantity} pcs in stock
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {linkedVendorCount} {linkedVendorCount === 1 ? 'vendor' : 'vendors'}
                          </span>
                          {getWorkflowTotalDays(wf) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-700">
                              <Clock className="w-2.5 h-2.5" />
                              <span>~{getWorkflowTotalDays(wf)}d lead</span>
                            </span>
                          )}
                          {wf.sharedGroupId && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-700">
                              <Link2 className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[130px]">
                                {wf.sharedGroupName || 'Shared Estamba'}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {activeBatchCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                            <Layers className="w-3.5 h-3.5" />
                            <span>
                              {activeBatchCount} Active{' '}
                              {activeBatchCount === 1 ? 'Batch' : 'Batches'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">
                            No active batches
                          </span>
                        )}

                        <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          <span>Open Pipeline</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PRODUCT OPERATIONS WORKSPACE */}
      {topTab === 'catalog' && selectedProduct && (() => {
        const workflow = getEffectiveWorkflow(selectedProduct);
        const productBatches = batches.filter((b) => b.productId === selectedProduct.id);
        const visibleBatches = productBatches.filter((b) =>
          batchTab === 'active' ? b.status === 'in_progress' : b.status === 'completed'
        );
        const imgSrc = selectedProduct.image || selectedProduct.images?.[0];

        return (
          <div className="space-y-6">
            {/* Workspace Top Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductId(null);
                    setDrawerStageKey(null);
                  }}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 min-h-[42px]"
                  title="Back to Catalog Grid"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={selectedProduct.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-700">
                      {selectedProduct.sku}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums font-bold text-slate-800">
                      {selectedProduct.totalQuantity} units in stock
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 truncate">
                    {selectedProduct.name}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Workflow Type Toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkflowType(selectedProduct, 'manufactured')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      workflow.workflowType === 'manufactured'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Manufactured
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchWorkflowType(selectedProduct, 'ready_made')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      workflow.workflowType === 'ready_made'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ready-Made
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 min-h-[40px] transition-colors ${
                    workflow.sharedGroupId
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {workflow.sharedGroupId ? 'Shared Estamba Linked' : 'Template (Estamba)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCustomizeStages((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 min-h-[40px] ${
                    showCustomizeStages
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Customize Stages</span>
                </button>
              </div>
            </div>

            {/* Shared Estamba Live Sync Banner */}
            {workflow.sharedGroupId && (() => {
              const linkedSiblings = workflows
                .filter(
                  (w) =>
                    w.sharedGroupId === workflow.sharedGroupId &&
                    w.productId !== selectedProduct.id
                )
                .map((w) => products.find((p) => p.id === w.productId))
                .filter((p): p is Product => Boolean(p));

              return (
                <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Link2 className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-indigo-950">
                        Shared Estamba Group: {workflow.sharedGroupName || 'Synced Items'}
                      </div>
                      <div className="text-[11px] text-indigo-800 mt-0.5">
                        Synced pipeline, vendors, ordering scripts &amp; prices with{' '}
                        {linkedSiblings.length > 0 ? (
                          <strong>
                            {linkedSiblings.map((p) => p.name).join(', ')}
                          </strong>
                        ) : (
                          'linked items'
                        )}
                        . Any edit updates all linked items (stock &amp; batches remain per-item).
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-800"
                    >
                      Manage Link
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Custom Per-Item Pipeline Builder & Stage Customizer */}
            {showCustomizeStages && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Custom Pipeline Builder — {selectedProduct.name}
                    </div>
                    <p className="text-xs text-slate-500">
                      Toggle standard stages, create custom stages for this item, rename, or reorder with arrows.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResetToCleanPipeline(selectedProduct)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
                      title="Clear stages and start from scratch"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Start Clean</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomizeStages(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>

                {/* Standard Presets */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Standard Stages
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_OPERATION_STAGES.map((st) => {
                      const active = workflow.activeStages.includes(st.key);
                      const locked = st.key === 'stock_in';
                      return (
                        <button
                          key={st.key}
                          type="button"
                          disabled={locked}
                          onClick={() => handleToggleStageInWorkflow(selectedProduct, st.key)}
                          className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-70 ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                          <span>{getStageMeta(st.key, workflow.customStages).shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current Active Order + Reorder / Rename / Est. Days / Remove */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Current Flowchart Order ({workflow.activeStages.length} stages)
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-mono font-bold text-indigo-800">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Total Pipeline Time: {getWorkflowTotalDays(workflow)} days</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {workflow.activeStages.map((stageKey, sIdx) => {
                      const meta = getStageMeta(stageKey, workflow.customStages);
                      const isStockIn = stageKey === 'stock_in';
                      const nonStockLen = workflow.activeStages.filter(
                        (k) => k !== 'stock_in'
                      ).length;
                      const isEditing = editingStageKey === stageKey;
                      const stageDays = workflow.stageLeadTimes?.[stageKey] ?? '';

                      return (
                        <div
                          key={stageKey}
                          className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                            isStockIn
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editingStageLabel}
                                onChange={(e) => setEditingStageLabel(e.target.value)}
                                placeholder="Stage name"
                                className="flex-1 min-w-[150px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                              />
                              <input
                                type="text"
                                value={editingStageUnit}
                                onChange={(e) => setEditingStageUnit(e.target.value)}
                                placeholder="Unit (piece, meter...)"
                                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                              />
                              <input
                                type="number"
                                min={0}
                                value={editingStageDays}
                                onChange={(e) => setEditingStageDays(e.target.value)}
                                placeholder="Days"
                                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveStageRename(selectedProduct, stageKey)}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStageKey(null)}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-xs font-bold text-slate-500">
                                  0{sIdx + 1}.
                                </span>
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {meta.label}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500">
                                  ({meta.defaultUnit})
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <input
                                    type="number"
                                    min={0}
                                    value={stageDays}
                                    onChange={(e) =>
                                      handleUpdateStageLeadTime(
                                        selectedProduct,
                                        stageKey,
                                        e.target.value
                                      )
                                    }
                                    placeholder="0"
                                    className="w-11 text-xs font-mono font-bold text-slate-900 text-center focus:outline-none"
                                    title="Estimated duration in days"
                                  />
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    days
                                  </span>
                                </div>

                                {!isStockIn && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={sIdx === 0}
                                      onClick={() =>
                                        handleMoveStageInWorkflow(selectedProduct, stageKey, -1)
                                      }
                                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-35"
                                      title="Move earlier"
                                    >
                                      <ArrowLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={sIdx >= nonStockLen - 1}
                                      onClick={() =>
                                        handleMoveStageInWorkflow(selectedProduct, stageKey, 1)
                                      }
                                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-35"
                                      title="Move later"
                                    >
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingStageKey(stageKey);
                                        setEditingStageLabel(meta.label);
                                        setEditingStageUnit(meta.defaultUnit || 'piece');
                                        setEditingStageDays(
                                          stageDays !== '' ? String(stageDays) : ''
                                        );
                                      }}
                                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                                      title="Rename / edit unit"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleStageInWorkflow(selectedProduct, stageKey)
                                      }
                                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-rose-600 hover:bg-rose-50"
                                      title="Remove stage"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add Custom Stage Form */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Add Custom Stage for This Item
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      placeholder="Stage name (e.g. Fabric Dyeing, Embroidery, Printing...)"
                      className="sm:col-span-4 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="text"
                      value={newStageUnit}
                      onChange={(e) => setNewStageUnit(e.target.value)}
                      placeholder="Unit (piece, meter)"
                      className="sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="number"
                      min={0}
                      value={newStageDays}
                      onChange={(e) => setNewStageDays(e.target.value)}
                      placeholder="Est. days"
                      className="sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="text"
                      value={newStageDesc}
                      onChange={(e) => setNewStageDesc(e.target.value)}
                      placeholder="Notes (optional)"
                      className="sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomStage(selectedProduct)}
                      className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Stage</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VISUAL HORIZONTAL PROCESS FLOWCHART */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Process Pipeline Flowchart
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any stage node to manage assigned vendors, estimated days, ordering scripts, and price history.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {getWorkflowTotalDays(workflow) > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-mono font-bold text-indigo-800">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Total Est. Time: {getWorkflowTotalDays(workflow)} days</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCustomizeStages(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700"
                    >
                      <Clock className="w-3 h-3" />
                      <span>+ Set Est. Days</span>
                    </button>
                  )}
                  <span className="text-xs font-mono text-slate-500 hidden sm:inline">
                    {workflow.activeStages.length} stages
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="flex items-stretch gap-2 min-w-max">
                  {workflow.activeStages.map((stageKey, idx) => {
                    const meta = getStageMeta(stageKey, workflow.customStages);
                    const estDays = Number(workflow.stageLeadTimes?.[stageKey] || 0);
                    const stageLinks = stageVendors.filter(
                      (psv) => psv.productId === selectedProduct.id && psv.stageKey === stageKey
                    );
                    const primaryLink =
                      stageLinks.find((l) => l.isPrimary) || stageLinks[0];
                    const primaryVendor = primaryLink
                      ? vendors.find((v) => v.id === primaryLink.vendorId)
                      : null;
                    const latestPrice = primaryLink
                      ? getLatestPriceForPsv(primaryLink.id)
                      : undefined;
                    const stageBatchesCount = productBatches.filter(
                      (b) => b.status === 'in_progress' && b.currentStageKey === stageKey
                    ).length;
                    const isSelected = drawerStageKey === stageKey;
                    const isStockIn = stageKey === 'stock_in';

                    return (
                      <React.Fragment key={stageKey}>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerStageKey(stageKey);
                            setAddingPriceForPsvId(null);
                            setLinkVendorId('');
                          }}
                          className={`w-[220px] sm:w-[235px] text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 cursor-pointer shrink-0 ${
                            isSelected
                              ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10'
                              : isStockIn
                              ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-400'
                              : 'border-slate-200 bg-white hover:border-slate-400'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono font-bold text-slate-500">
                                0{idx + 1}.
                              </span>
                              <div className="flex items-center gap-1">
                                {estDays > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] font-mono tabular-nums inline-flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>{estDays}d</span>
                                  </span>
                                )}
                                {stageBatchesCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px] font-mono tabular-nums">
                                    {stageBatchesCount} active
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-sm font-bold text-slate-900 leading-snug">
                              {meta.label}
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-slate-100 space-y-1">
                            {isStockIn ? (
                              <div className="text-xs font-medium text-emerald-800">
                                Final Gard · {selectedProduct.totalQuantity} units live
                              </div>
                            ) : primaryVendor ? (
                              <>
                                <div className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1">
                                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                                  <span className="truncate">{primaryVendor.name}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>
                                    {stageLinks.length > 1
                                      ? `+${stageLinks.length - 1} backup`
                                      : 'Primary vendor'}
                                  </span>
                                  {latestPrice ? (
                                    <span className="font-mono tabular-nums font-bold text-slate-900">
                                      {latestPrice.unitPrice} EGP/{meta.defaultUnit}
                                    </span>
                                  ) : (
                                    <span>No price logged</span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs font-medium text-amber-700">
                                Click to assign vendor
                              </div>
                            )}
                          </div>
                        </button>

                        {idx < workflow.activeStages.length - 1 && (
                          <div className="flex items-center justify-center text-slate-300 px-0.5 shrink-0">
                            <ArrowRight className="w-5 h-5" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* LIVE BATCH TRACKING SECTION */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Active Batches &amp; Restock Pipeline
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track ongoing restock batches stage-by-stage and automatically stock in (Gard) upon completion.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setBatchTab('active')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        batchTab === 'active'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      In Progress ({productBatches.filter((b) => b.status === 'in_progress').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchTab('completed')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        batchTab === 'completed'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      Completed ({productBatches.filter((b) => b.status === 'completed').length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingBatch(null);
                      setIsStartBatchOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 min-h-[40px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Start New Batch</span>
                  </button>
                </div>
              </div>

              {visibleBatches.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700">
                    {batchTab === 'active'
                      ? 'No active production batches right now.'
                      : 'No completed stock-in batches recorded yet.'}
                  </p>
                  {batchTab === 'active' && (
                    <button
                      type="button"
                      onClick={() => setIsStartBatchOpen(true)}
                      className="text-xs font-bold text-blue-700 hover:underline"
                    >
                      + Start your first batch
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleBatches.map((batch) => {
                    const currentStageMeta = getStageMeta(
                      batch.currentStageKey,
                      workflow.customStages
                    );
                    const stageIdx = workflow.activeStages.indexOf(batch.currentStageKey);
                    const isFinalStage = batch.currentStageKey === 'stock_in';
                    const stageAssignment = batch.stageAssignments?.[batch.currentStageKey];
                    const currentVendor = stageAssignment?.vendorId
                      ? vendors.find((v) => v.id === stageAssignment.vendorId)
                      : null;
                    const currentActorName =
                      currentVendor?.name || stageAssignment?.customVendorName || '';
                    const targetVariant = selectedProduct.variants.find(
                      (v) => v.id === batch.variantId
                    );
                    const totalPipelineDays = getWorkflowTotalDays(workflow);
                    const remainingPipelineDays = getRemainingDaysFromStage(
                      workflow,
                      batch.currentStageKey
                    );
                    const loggedStages = workflow.activeStages
                      .filter((stKey) => {
                        const a = batch.stageAssignments?.[stKey];
                        return Boolean(
                          a && (a.vendorId || a.customVendorName || a.completedAt || (a.totalCost ?? a.cost))
                        );
                      })
                      .map((stKey) => {
                        const a = batch.stageAssignments[stKey];
                        const vName = a.vendorId
                          ? vendors.find((v) => v.id === a.vendorId)?.name || 'Vendor'
                          : a.customVendorName || 'Vendor';
                        const totalStageEgp =
                          typeof a.totalCost === 'number' && a.totalCost >= 0
                            ? a.totalCost
                            : typeof a.cost === 'number'
                            ? Math.round(a.cost * Math.max(1, batch.quantity) * 100) / 100
                            : 0;
                        return {
                          stageKey: stKey,
                          label: getStageMeta(stKey, workflow.customStages).shortLabel,
                          vendorName: vName,
                          totalEgp: totalStageEgp,
                          completed: Boolean(a.completedAt),
                        };
                      });
                    const totalSpentSoFar = loggedStages.reduce(
                      (sum, st) => sum + (st.totalEgp || 0),
                      0
                    );
                    const progressPct =
                      workflow.activeStages.length > 0 && stageIdx >= 0
                        ? Math.round(((stageIdx + 1) / workflow.activeStages.length) * 100)
                        : 100;

                    return (
                      <div
                        key={batch.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-mono font-bold text-slate-900 text-sm">
                                  {batch.batchCode}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums font-bold text-slate-800">
                                  {batch.quantity} pcs
                                </span>
                                {targetVariant && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      Size {targetVariant.size} ({targetVariant.colorName})
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                Stage: <strong className="text-slate-900">{currentStageMeta.label}</strong>
                                {currentActorName ? ` · ${currentActorName}` : ''}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 mt-0.5">
                                {batch.targetDate && <span>Target: {batch.targetDate}</span>}
                                {totalPipelineDays > 0 && batch.status === 'in_progress' && (
                                  <span className="text-indigo-700 font-semibold">
                                    · ~{remainingPipelineDays}d left (of {totalPipelineDays}d est.)
                                  </span>
                                )}
                                {totalSpentSoFar > 0 && (
                                  <span className="text-emerald-700 font-bold">
                                    · Cost logged: {totalSpentSoFar.toLocaleString()} EGP
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setCostBatchId(batch.id)}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 inline-flex items-center gap-1"
                                title="Steps, durations and costs"
                              >
                                <span>Steps &amp; costs</span>
                              </button>
                              {batch.status === 'in_progress' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBatch(batch);
                                    setIsStartBatchOpen(true);
                                  }}
                                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 inline-flex items-center gap-1"
                                  title="Edit batch quantity & choose vendors"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Qty &amp; Vendors</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isAdmin && onSubmitTeamRequest) {
                                    onSubmitTeamRequest({
                                      teamScope: 'purchases',
                                      entityType: 'sourcing_batch',
                                      actionType: 'delete',
                                      targetId: batch.id,
                                      title: `Delete Batch ${batch.batchCode}`,
                                      summary: `${selectedProduct.name} · ${batch.quantity} pcs`,
                                      payload: { batchId: batch.id },
                                    });
                                    return;
                                  }
                                  onDeleteBatch(batch.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title={isAdmin ? 'Delete batch' : 'Request batch deletion'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Completed / Logged Stages Cost & Vendor Trail */}
                          {loggedStages.some((st) => st.completed) && (
                            <div className="flex flex-wrap gap-1.5">
                              {loggedStages
                                .filter((st) => st.completed)
                                .map((st) => (
                                  <span
                                    key={st.stageKey}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-700"
                                  >
                                    <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span>{st.label}:</span>
                                    <span className="text-slate-900">{st.vendorName}</span>
                                    <span className="font-mono text-emerald-700">
                                      ({st.totalEgp.toLocaleString()} EGP)
                                    </span>
                                  </span>
                                ))}
                            </div>
                          )}

                          {/* Clean Progress Bar */}
                          <div className="space-y-1">
                            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  batch.status === 'completed' || isFinalStage
                                    ? 'bg-emerald-600'
                                    : 'bg-slate-900'
                                }`}
                                style={{ width: `${batch.status === 'completed' ? 100 : progressPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {batch.status === 'in_progress' ? (
                          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            {!isFinalStage ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRequestAdvanceBatchStage(
                                    batch,
                                    workflow.activeStages
                                  )
                                }
                                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 min-h-[40px]"
                              >
                                <span>Advance to Next Stage</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setStockInBatch(batch)}
                                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 min-h-[40px]"
                              >
                                <Check className="w-4 h-4" />
                                <span>Complete &amp; Stock In</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-200/80 text-xs font-semibold text-emerald-700">
                            Completed &amp; stocked in on{' '}
                            {batch.completedAt
                              ? new Date(batch.completedAt).toLocaleDateString()
                              : '—'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* STAGE & VENDOR DETAIL SLIDE-OVER DRAWER */}
            {drawerStageKey && (() => {
              const stageMeta = getStageMeta(drawerStageKey, workflow.customStages);
              const linkedPsvs = stageVendors
                .filter(
                  (psv) =>
                    psv.productId === selectedProduct.id && psv.stageKey === drawerStageKey
                )
                .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
              const alreadyLinkedIds = new Set(linkedPsvs.map((l) => l.vendorId));
              const availableVendors = vendors.filter((v) => !alreadyLinkedIds.has(v.id));

              return (
                <div
                  className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end"
                  onClick={() => setDrawerStageKey(null)}
                >
                  <div
                    className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Drawer Header */}
                    <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="text-xs font-semibold text-slate-500">
                          {selectedProduct.name} · Stage Details
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          {stageMeta.label}
                        </h3>
                        <p className="text-xs text-slate-500">{stageMeta.description}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-[11px] font-bold text-slate-700">
                              Est. Time:
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={workflow.stageLeadTimes?.[drawerStageKey] ?? ''}
                              onChange={(e) =>
                                handleUpdateStageLeadTime(
                                  selectedProduct,
                                  drawerStageKey,
                                  e.target.value
                                )
                              }
                              placeholder="0"
                              className="w-12 px-1 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold text-slate-900 text-center"
                            />
                            <span className="text-[11px] text-slate-500">days</span>
                          </div>
                          {workflow.sharedGroupId && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                              <Link2 className="w-3 h-3" />
                              <span>
                                Synced with {workflow.sharedGroupName || 'Shared Estamba Group'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrawerStageKey(null)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
                        aria-label="Close drawer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Drawer Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                      {drawerStageKey === 'stock_in' ? (
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                          <div className="text-sm font-bold text-emerald-900">
                            Inventory Stock-In (Gard - Ready for Orders)
                          </div>
                          <p className="text-xs text-emerald-800 leading-relaxed">
                            Batches arriving at this final stage are ready for quality count and stock-in. Click <strong>Complete &amp; Stock In</strong> on any batch at this stage to add its quantity directly to <strong>{selectedProduct.name}</strong> in the live Inventory Catalog and record vendor prices in their ledgers.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Link Vendor Bar */}
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                Assign Vendor to This Stage
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVendor(null);
                                  setLinkAfterCreateTarget({
                                    productId: selectedProduct.id,
                                    stageKey: drawerStageKey,
                                  });
                                  setIsVendorModalOpen(true);
                                }}
                                className="text-xs font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create New Vendor</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <select
                                value={linkVendorId}
                                onChange={(e) => setLinkVendorId(e.target.value)}
                                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 min-h-[40px]"
                              >
                                <option value="">
                                  {availableVendors.length > 0
                                    ? 'Select from Master Vendor Directory...'
                                    : 'All existing vendors are linked'}
                                </option>
                                {availableVendors.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name} {v.location ? `(${v.location})` : ''}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!linkVendorId}
                                onClick={() =>
                                  handleLinkVendorToStage(
                                    selectedProduct.id,
                                    drawerStageKey,
                                    linkVendorId
                                  )
                                }
                                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold min-h-[40px] shrink-0"
                              >
                                Link
                              </button>
                            </div>
                          </div>

                          {/* Linked Vendors List */}
                          {linkedPsvs.length === 0 ? (
                            <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center space-y-1.5">
                              <p className="text-sm font-semibold text-slate-700">
                                No vendors linked to {stageMeta.shortLabel} yet.
                              </p>
                              <p className="text-xs text-slate-500">
                                Link an existing vendor above or create a new one in the Master Directory.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {linkedPsvs.map((psv) => {
                                const vendor = vendors.find((v) => v.id === psv.vendorId);
                                if (!vendor) return null;
                                const waUrl = buildWhatsAppUrl(vendor.phone);
                                const rows = priceHistory
                                  .filter((ph) => ph.productStageVendorId === psv.id)
                                  .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
                                const latestRow = rows[0];
                                const isExpanded = Boolean(expandedLedgers[psv.id]);

                                return (
                                  <div
                                    key={psv.id}
                                    className={`rounded-2xl border p-4 space-y-3.5 ${
                                      psv.isPrimary
                                        ? 'border-amber-300 bg-amber-50/20'
                                        : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    {/* Vendor Header & Priority Toggle */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="text-sm font-bold text-slate-900">
                                            {vendor.name}
                                          </h4>
                                          <button
                                            type="button"
                                            onClick={() => handleSetPrimaryStageVendor(psv)}
                                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border inline-flex items-center gap-1 transition-colors ${
                                              psv.isPrimary
                                                ? 'bg-amber-500 text-slate-950 border-amber-600'
                                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-amber-50'
                                            }`}
                                            title="Toggle Primary vs Backup priority"
                                          >
                                            <Star
                                              className={`w-3 h-3 ${
                                                psv.isPrimary ? 'fill-slate-950' : ''
                                              }`}
                                            />
                                            <span>{psv.isPrimary ? 'Primary' : 'Backup'}</span>
                                          </button>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                                          {vendor.contactPerson && <span>{vendor.contactPerson}</span>}
                                          {vendor.phone && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span className="font-mono text-slate-700">
                                                {vendor.phone}
                                              </span>
                                            </>
                                          )}
                                          {vendor.location && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span>{vendor.location}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {waUrl && (
                                          <a
                                            href={waUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                            title="Open WhatsApp"
                                          >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                        {vendor.mapsUrl && (
                                          <a
                                            href={vendor.mapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                                            title="Open Location on Maps"
                                          >
                                            <MapPin className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingVendor(vendor);
                                            setLinkAfterCreateTarget(null);
                                            setIsVendorModalOpen(true);
                                          }}
                                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                                          title="Edit global vendor profile"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!isAdmin && onSubmitTeamRequest) {
                                              onSubmitTeamRequest({
                                                teamScope: 'purchases',
                                                entityType: 'sourcing_stage_vendor',
                                                actionType: 'delete',
                                                targetId: psv.id,
                                                title: `Unlink Vendor: ${vendor.name}`,
                                                summary: `Remove ${vendor.name} from ${stageMeta.shortLabel} (${selectedProduct.name}).`,
                                                payload: { linkId: psv.id },
                                              });
                                              return;
                                            }
                                            onDeleteStageVendor(psv.id);
                                          }}
                                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                          title={isAdmin ? 'Unlink vendor from stage' : 'Request unlink vendor'}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Behavior Tags */}
                                    {vendor.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-slate-600">
                                        {vendor.tags.map((t, i) => {
                                          const info = getVendorTagInfo(t);
                                          return (
                                            <span
                                              key={t}
                                              className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${info.toneClass}`}
                                            >
                                              {info.label}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Stage-Specific Approx Qty & Ordering Script */}
                                    {(() => {
                                      const draft = stageDrafts[psv.id];
                                      const qtyVal = draft ? draft.approxOrderQty : psv.approxOrderQty;
                                      const scriptVal = draft ? draft.orderScriptNotes : psv.orderScriptNotes;
                                      const hasDraftChanges =
                                        Boolean(draft) &&
                                        (draft.approxOrderQty !== psv.approxOrderQty ||
                                          draft.orderScriptNotes !== psv.orderScriptNotes);
                                      return (
                                        <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-slate-100">
                                          <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                              Approx. Order Quantity
                                            </label>
                                            <input
                                              type="text"
                                              value={qtyVal}
                                              onChange={(e) => {
                                                const nextVal = e.target.value;
                                                if (!isAdmin && onSubmitTeamRequest) {
                                                  setStageDrafts((prev) => ({
                                                    ...prev,
                                                    [psv.id]: {
                                                      approxOrderQty: nextVal,
                                                      orderScriptNotes: scriptVal,
                                                    },
                                                  }));
                                                  return;
                                                }
                                                onSaveStageVendor({
                                                  ...psv,
                                                  approxOrderQty: nextVal,
                                                });
                                              }}
                                              placeholder='e.g. "50 meters" or "30 pieces"'
                                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                              Ordering Script / Instructions (&ldquo;What I tell him when ordering&rdquo;)
                                            </label>
                                            <textarea
                                              rows={2}
                                              value={scriptVal}
                                              onChange={(e) => {
                                                const nextVal = e.target.value;
                                                if (!isAdmin && onSubmitTeamRequest) {
                                                  setStageDrafts((prev) => ({
                                                    ...prev,
                                                    [psv.id]: {
                                                      approxOrderQty: qtyVal,
                                                      orderScriptNotes: nextVal,
                                                    },
                                                  }));
                                                  return;
                                                }
                                                onSaveStageVendor({
                                                  ...psv,
                                                  orderScriptNotes: nextVal,
                                                });
                                              }}
                                              placeholder="Exact GSM, colors, stitching pattern, collar specs..."
                                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 resize-none"
                                            />
                                          </div>
                                          {!isAdmin && onSubmitTeamRequest && hasDraftChanges && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                onSubmitTeamRequest({
                                                  teamScope: 'purchases',
                                                  entityType: 'sourcing_stage_vendor',
                                                  actionType: 'update',
                                                  targetId: psv.id,
                                                  title: `Update Ordering Script: ${vendor.name}`,
                                                  summary: `${selectedProduct.name} (${stageMeta.shortLabel}) · Qty: "${qtyVal || '—'}"`,
                                                  payload: {
                                                    link: {
                                                      ...psv,
                                                      approxOrderQty: qtyVal,
                                                      orderScriptNotes: scriptVal,
                                                    },
                                                  },
                                                });
                                                setStageDrafts((prev) => {
                                                  const copy = { ...prev };
                                                  delete copy[psv.id];
                                                  return copy;
                                                });
                                              }}
                                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold self-start"
                                            >
                                              Submit Qty / Script Update Request
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* Price History Mini-Ledger */}
                                    <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div>
                                          <div className="text-[11px] font-bold text-slate-500">
                                            Last Purchase Price
                                          </div>
                                          {latestRow ? (
                                            <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                              {latestRow.unitPrice} EGP/{stageMeta.defaultUnit}{' '}
                                              <span className="text-xs font-normal text-slate-500">
                                                · {latestRow.purchaseDate}
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="text-xs text-slate-400">
                                              No purchase price logged yet
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setAddingPriceForPsvId(
                                                addingPriceForPsvId === psv.id ? null : psv.id
                                              );
                                              setPriceFormDate(
                                                new Date().toISOString().slice(0, 10)
                                              );
                                              setPriceFormAmount('');
                                              setPriceFormQty(psv.approxOrderQty || '');
                                              setPriceFormNotes('');
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>Add Price Entry</span>
                                          </button>

                                          {rows.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setExpandedLedgers((prev) => ({
                                                  ...prev,
                                                  [psv.id]: !prev[psv.id],
                                                }))
                                              }
                                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1"
                                            >
                                              <span>Ledger ({rows.length})</span>
                                              {isExpanded ? (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                              ) : (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Inline Add Price Entry Form */}
                                      {addingPriceForPsvId === psv.id && (
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                          <div className="grid grid-cols-3 gap-2">
                                            <div>
                                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                                Date
                                              </label>
                                              <input
                                                type="date"
                                                value={priceFormDate}
                                                onChange={(e) => setPriceFormDate(e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                                Price (EGP)
                                              </label>
                                              <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={priceFormAmount}
                                                onChange={(e) => setPriceFormAmount(e.target.value)}
                                                placeholder="145"
                                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono tabular-nums"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                                Qty Bought
                                              </label>
                                              <input
                                                type="text"
                                                value={priceFormQty}
                                                onChange={(e) => setPriceFormQty(e.target.value)}
                                                placeholder="50 meters"
                                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={priceFormNotes}
                                              onChange={(e) => setPriceFormNotes(e.target.value)}
                                              placeholder="Notes (optional)..."
                                              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const num = Number(priceFormAmount);
                                                if (!num || num <= 0) {
                                                  onShowToast?.('Enter a valid unit price.');
                                                  return;
                                                }
                                                const priceEntry: VendorPriceEntry = {
                                                  id: `ph_${Date.now()}_${Math.random()
                                                    .toString(36)
                                                    .slice(2, 6)}`,
                                                  productStageVendorId: psv.id,
                                                  purchaseDate:
                                                    priceFormDate ||
                                                    new Date().toISOString().slice(0, 10),
                                                  unitPrice: num,
                                                  quantity: priceFormQty.trim() || '—',
                                                  notes: priceFormNotes.trim(),
                                                };
                                                if (!isAdmin && onSubmitTeamRequest) {
                                                  onSubmitTeamRequest({
                                                    teamScope: 'purchases',
                                                    entityType: 'sourcing_price',
                                                    actionType: 'create',
                                                    targetId: priceEntry.id,
                                                    title: `Log Vendor Price: ${vendor.name}`,
                                                    summary: `${num} EGP/${stageMeta.defaultUnit} for ${selectedProduct.name} (${priceEntry.quantity})`,
                                                    payload: { entry: priceEntry },
                                                  });
                                                  setAddingPriceForPsvId(null);
                                                  return;
                                                }
                                                onAddPriceEntry(priceEntry);
                                                setAddingPriceForPsvId(null);
                                                setExpandedLedgers((prev) => ({
                                                  ...prev,
                                                  [psv.id]: true,
                                                }));
                                                onShowToast?.('New price entry logged.');
                                              }}
                                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
                                            >
                                              Save Row
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Expandable Historical Ledger Table */}
                                      {isExpanded && rows.length > 0 && (
                                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                          <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                                              <tr>
                                                <th className="py-2 px-2.5 font-semibold">Date</th>
                                                <th className="py-2 px-2.5 font-semibold text-right">
                                                  Unit Price
                                                </th>
                                                <th className="py-2 px-2.5 font-semibold">Qty</th>
                                                <th className="py-2 px-2.5 font-semibold">Notes</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                              {rows.map((r) => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                  <td className="py-2 px-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                                                    {r.purchaseDate}
                                                  </td>
                                                  <td className="py-2 px-2.5 font-mono tabular-nums font-bold text-slate-900 text-right whitespace-nowrap">
                                                    {r.unitPrice} EGP
                                                  </td>
                                                  <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap">
                                                    {r.quantity || '—'}
                                                  </td>
                                                  <td className="py-2 px-2.5 text-slate-500">
                                                    {r.notes || '—'}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Start / Edit Production Batch Modal */}
            <StartBatchModal
              isOpen={isStartBatchOpen}
              product={selectedProduct}
              activeStages={workflow.activeStages}
              customStages={workflow.customStages}
              stageLeadTimes={workflow.stageLeadTimes}
              vendors={vendors}
              productStageVendors={stageVendors}
              priceHistory={priceHistory}
              existingBatchCount={batches.length}
              initialBatch={editingBatch}
              onClose={() => {
                setIsStartBatchOpen(false);
                setEditingBatch(null);
              }}
              onCreateBatch={(batch) => {
                const wasEdit = Boolean(editingBatch);
                const stageShort = getStageMeta(
                  batch.currentStageKey,
                  workflow.customStages
                ).shortLabel;
                if (!isAdmin && onSubmitTeamRequest) {
                  onSubmitTeamRequest({
                    teamScope: 'purchases',
                    entityType: 'sourcing_batch',
                    actionType: wasEdit ? 'update' : 'create',
                    targetId: batch.id,
                    title: `${wasEdit ? 'Update' : 'Start'} Batch ${batch.batchCode}`,
                    summary: `${selectedProduct.name} · ${batch.quantity} pcs @ ${stageShort}`,
                    payload: { batch },
                  });
                  setIsStartBatchOpen(false);
                  setEditingBatch(null);
                  return;
                }
                onSaveBatch(batch);
                setIsStartBatchOpen(false);
                setEditingBatch(null);
                setBatchTab('active');
                onShowToast?.(
                  wasEdit
                    ? `${batch.batchCode} updated (${batch.quantity} pcs).`
                    : `${batch.batchCode} started at ${stageShort}.`
                );
              }}
            />

            {/* Mandatory Cost + Vendor Gate When Advancing Stage */}
            <AdvanceStageModal
              batch={advancingBatchContext?.batch || null}
              product={selectedProduct}
              currentStageKey={advancingBatchContext?.currentStageKey || null}
              nextStageKey={advancingBatchContext?.nextStageKey || null}
              customStages={workflow.customStages}
              stageLeadTimes={workflow.stageLeadTimes}
              vendors={vendors}
              productStageVendors={stageVendors}
              priceHistory={priceHistory}
              onClose={() => setAdvancingBatchContext(null)}
              onConfirm={handleConfirmAdvanceBatchStage}
            />

            {costBatchId && batches.find((b) => b.id === costBatchId) && (
              <BatchCostModal
                batch={batches.find((b) => b.id === costBatchId)!}
                allBatches={batches}
                stages={workflow.activeStages}
                customStages={workflow.customStages}
                vendors={vendors}
                canEdit={canUserManageVendors(currentUser, users)}
                onClose={() => setCostBatchId(null)}
                onSave={(updated) => {
                  setCostBatchId(null);
                  onSaveBatch(updated);
                  onShowToast?.(`Saved steps and costs for ${updated.batchCode}.`);
                }}
              />
            )}

            {/* Complete & Stock In (Gard) Modal */}
            <CompleteStockInModal
              batch={stockInBatch}
              product={selectedProduct}
              customStages={workflow.customStages}
              vendors={vendors}
              onClose={() => setStockInBatch(null)}
              onConfirm={(payload) => {
                if (!isAdmin && onSubmitTeamRequest) {
                  const targetBatch = batches.find((b) => b.id === payload.batchId);
                  onSubmitTeamRequest({
                    teamScope: 'purchases',
                    entityType: 'sourcing_stock_in',
                    actionType: 'update',
                    targetId: payload.batchId,
                    title: `Complete & Stock In: ${targetBatch?.batchCode || payload.batchId}`,
                    summary: `${selectedProduct.name} · Final Gard Qty: ${payload.finalQuantity} pcs`,
                    payload,
                  });
                  setStockInBatch(null);
                  return;
                }
                onCompleteBatchStockIn(payload);
                setStockInBatch(null);
              }}
            />

            {/* Use Template / Shared Estamba Modal */}
            <ApplyWorkflowTemplateModal
              isOpen={isTemplateModalOpen}
              targetProduct={selectedProduct}
              targetWorkflow={workflow}
              products={activeCatalogProducts}
              stageVendors={stageVendors}
              getEffectiveWorkflow={getEffectiveWorkflow}
              onClose={() => setIsTemplateModalOpen(false)}
              onApply={(payload) => {
                const srcProd = products.find((p) => p.id === payload.sourceProductId);
                if (!isAdmin && onSubmitTeamRequest) {
                  onSubmitTeamRequest({
                    teamScope: 'purchases',
                    entityType: 'sourcing_template',
                    actionType: 'update',
                    targetId: selectedProduct.id,
                    title:
                      payload.mode === 'unlink'
                        ? `Unlink Estamba: ${selectedProduct.name}`
                        : payload.mode === 'same_all'
                        ? `Link Shared Estamba: ${selectedProduct.name}`
                        : `Copy Estamba Pipeline: ${selectedProduct.name}`,
                    summary:
                      payload.mode === 'unlink'
                        ? `Unlink "${selectedProduct.name}" from shared estamba group.`
                        : payload.mode === 'same_all'
                        ? `Sync pipeline & vendors from "${srcProd?.name || payload.sourceProductId}" onto "${selectedProduct.name}".`
                        : `Copy pipeline stages only from "${srcProd?.name || payload.sourceProductId}" onto "${selectedProduct.name}".`,
                    payload,
                  });
                  setIsTemplateModalOpen(false);
                  return;
                }
                onApplyWorkflowTemplate?.(payload);
                setIsTemplateModalOpen(false);
              }}
            />
          </div>
        );
      })()}

      {/* VIEW 3: MASTER VENDORS DIRECTORY TAB */}
      {topTab === 'vendors' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Search vendors by name, contact person, location, or phone..."
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
              />
              {vendorSearch && (
                <button
                  type="button"
                  onClick={() => setVendorSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingVendor(null);
                setLinkAfterCreateTarget(null);
                setIsVendorModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 min-h-[44px] shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Global Vendor</span>
            </button>
          </div>

          {/* Behavior Tag Quick Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            <button
              type="button"
              onClick={() => setVendorTagFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 ${
                vendorTagFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Vendors ({vendors.length})
            </button>
            {VENDOR_TAG_GROUPS.flatMap((g) => g.options).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  setVendorTagFilter((prev) => (prev === opt.id ? 'all' : opt.id))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                  vendorTagFilter === opt.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filter by what the vendor makes/supplies */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 shrink-0" htmlFor="vendor-product-filter">Makes / supplies:</label>
            <select
              id="vendor-product-filter"
              value={vendorProductFilter}
              onChange={(e) => setVendorProductFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 min-h-[36px] max-w-full"
            >
              <option value="all">All products</option>
              {products
                .filter((p) => stageVendors.some((psv) => psv.productId === p.id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          {filteredVendors.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
              <Factory className="w-9 h-9 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                No vendors match your search or tag filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVendors.map((vendor) => {
                const waUrl = buildWhatsAppUrl(vendor.phone);
                const linkedEntries = stageVendors.filter((psv) => psv.vendorId === vendor.id);

                return (
                  <div
                    key={vendor.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 truncate">
                            {vendor.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                            {vendor.contactPerson && (
                              <span className="inline-flex items-center gap-1">
                                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                {vendor.contactPerson}
                              </span>
                            )}
                            {vendor.phone && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-slate-700 inline-flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  {vendor.phone}
                                </span>
                              </>
                            )}
                          </div>
                          {vendor.location && (
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{vendor.location}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1"
                              title="Message on WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                          {vendor.mapsUrl && (
                            <a
                              href={vendor.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title="Open Maps Location"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVendor(vendor);
                              setLinkAfterCreateTarget(null);
                              setIsVendorModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                            title="Edit vendor"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAdmin && onSubmitTeamRequest) {
                                onSubmitTeamRequest({
                                  teamScope: 'purchases',
                                  entityType: 'sourcing_vendor',
                                  actionType: 'delete',
                                  targetId: vendor.id,
                                  title: `Delete Vendor: ${vendor.name}`,
                                  summary: `Remove "${vendor.name}" from Master Vendor Directory.`,
                                  payload: { vendorId: vendor.id },
                                });
                                return;
                              }
                              onDeleteVendor(vendor.id);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title={isAdmin ? 'Delete vendor' : 'Request vendor deletion'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Behavior & Reliability Tags */}
                      {vendor.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {vendor.tags.map((tag) => {
                            const info = getVendorTagInfo(tag);
                            return (
                              <span
                                key={tag}
                                className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${info.toneClass}`}
                              >
                                {info.label}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {vendor.generalNotes && (
                        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                          {vendor.generalNotes}
                        </p>
                      )}
                    </div>

                    {/* Supplied Products & Stages */}
                    <div className="pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500">
                        Supplies ({linkedEntries.length}{' '}
                        {linkedEntries.length === 1 ? 'stage' : 'stages'})
                      </div>
                      {linkedEntries.length === 0 ? (
                        <div className="text-xs text-slate-400">
                          Not linked to any product stage yet.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {linkedEntries.map((entry) => {
                            const prod = products.find((p) => p.id === entry.productId);
                            if (!prod) return null;
                            const prodWf = workflows.find((w) => w.productId === prod.id);
                            const stMeta = getStageMeta(entry.stageKey, prodWf?.customStages);
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => {
                                  setTopTab('catalog');
                                  setSelectedProductId(prod.id);
                                  setDrawerStageKey(entry.stageKey);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 inline-flex items-center gap-1"
                              >
                                {entry.isPrimary && (
                                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                )}
                                <span className="font-semibold">{prod.name}</span>
                                <span className="text-slate-400">/</span>
                                <span className="text-slate-600">{stMeta.shortLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Global Vendor Add/Edit Modal */}
      <GlobalVendorModal
        isOpen={isVendorModalOpen}
        initialVendor={editingVendor}
        onClose={() => {
          setIsVendorModalOpen(false);
          setEditingVendor(null);
          setLinkAfterCreateTarget(null);
        }}
        onSave={(savedVendor) => {
          const isEdit = Boolean(editingVendor);
          if (!isAdmin && onSubmitTeamRequest) {
            onSubmitTeamRequest({
              teamScope: 'purchases',
              entityType: 'sourcing_vendor',
              actionType: isEdit ? 'update' : 'create',
              targetId: savedVendor.id,
              title: `${isEdit ? 'Edit' : 'Add'} Vendor: ${savedVendor.name}`,
              summary: `${savedVendor.contactPerson || 'Vendor'}${savedVendor.location ? ` · ${savedVendor.location}` : ''}`,
              payload: { vendor: savedVendor },
            });
            if (linkAfterCreateTarget) {
              onShowToast?.('Vendor creation requested — link to stage once Admin approves.');
            }
            setIsVendorModalOpen(false);
            setEditingVendor(null);
            setLinkAfterCreateTarget(null);
            return;
          }
          onSaveVendor(savedVendor);
          if (linkAfterCreateTarget) {
            handleLinkVendorToStage(
              linkAfterCreateTarget.productId,
              linkAfterCreateTarget.stageKey,
              savedVendor.id
            );
            setLinkAfterCreateTarget(null);
          }
          setIsVendorModalOpen(false);
          setEditingVendor(null);
          onShowToast?.(`Saved vendor "${savedVendor.name}".`);
        }}
      />
    </div>
  );
};
