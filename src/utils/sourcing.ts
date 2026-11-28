import {
  CustomStageDefinition,
  OperationStageKey,
  ProductionBatch,
  Product,
  VendorBehaviorTag,
  WorkflowType,
} from '../types/inventory';

export interface OperationStageMeta {
  key: OperationStageKey;
  label: string;
  shortLabel: string;
  description: string;
  defaultUnit: string;
}

export const ALL_OPERATION_STAGES: OperationStageMeta[] = [
  {
    key: 'raw_material',
    label: 'Raw Material / Fabric (Toob)',
    shortLabel: 'Fabric (Toob)',
    description: 'Sourcing raw fabric rolls (Toob), trims, and threads',
    defaultUnit: 'meter',
  },
  {
    key: 'manufacturing',
    label: "Manufacturing / Cutting (Tasnee')",
    shortLabel: "Cutting (Tasnee')",
    description: 'Pattern grading, fabric laying, and bulk cutting',
    defaultUnit: 'piece',
  },
  {
    key: 'tailor',
    label: 'Tailor / Finishing (Tarzy)',
    shortLabel: 'Tailor (Tarzy)',
    description: 'Stitching, collar/pocket assembly, badges & ironing',
    defaultUnit: 'piece',
  },
  {
    key: 'supplier_sourcing',
    label: 'Supplier Sourcing',
    shortLabel: 'Supplier Sourcing',
    description: 'Wholesale ready-made supplier procurement',
    defaultUnit: 'piece',
  },
  {
    key: 'packaging',
    label: 'Packaging',
    shortLabel: 'Packaging',
    description: 'Polybags, size stickers, hangtags & carton packing',
    defaultUnit: 'piece',
  },
  {
    key: 'stock_in',
    label: 'Inventory Stock-In (Gard - Ready for Orders)',
    shortLabel: 'Stock-In (Gard)',
    description: 'Final QC count & add to live Inventory Catalog stock',
    defaultUnit: 'piece',
  },
];

export const DEFAULT_STAGE_KEYS: Record<WorkflowType, OperationStageKey[]> = {
  manufactured: ['raw_material', 'manufacturing', 'tailor', 'packaging', 'stock_in'],
  ready_made: ['supplier_sourcing', 'stock_in'], // bought goods go straight to stock (add packaging per item if needed)
};

export function getStageMeta(
  key: OperationStageKey,
  customStages?: Record<string, CustomStageDefinition>
): OperationStageMeta {
  const custom = customStages?.[key];
  if (custom) {
    return {
      key,
      label: custom.label,
      shortLabel: custom.shortLabel || custom.label,
      description: custom.description || 'Custom item pipeline stage',
      defaultUnit: custom.defaultUnit || 'piece',
    };
  }
  return (
    ALL_OPERATION_STAGES.find((s) => s.key === key) || {
      key,
      label: key,
      shortLabel: key,
      description: '',
      defaultUnit: 'piece',
    }
  );
}

export interface VendorTagGroup {
  group: string;
  options: { id: VendorBehaviorTag; label: string; toneClass: string }[];
}

export const VENDOR_TAG_GROUPS: VendorTagGroup[] = [
  {
    group: 'Frequency',
    options: [
      { id: 'regular', label: 'Regular / Always', toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      { id: 'occasional', label: 'Occasional / Backup', toneClass: 'bg-slate-100 text-slate-700 border-slate-200' },
    ],
  },
  {
    group: 'Pricing',
    options: [
      { id: 'negotiable', label: 'Negotiable (Yefasel)', toneClass: 'bg-blue-50 text-blue-800 border-blue-200' },
      { id: 'fixed_price', label: 'Fixed Price', toneClass: 'bg-slate-100 text-slate-700 border-slate-200' },
    ],
  },
  {
    group: 'Delivery',
    options: [
      { id: 'on_time', label: 'On-Time', toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      { id: 'delays', label: 'Delays', toneClass: 'bg-amber-50 text-amber-800 border-amber-200' },
    ],
  },
  {
    group: 'Attitude',
    options: [
      { id: 'easy_smooth', label: 'Easy / Smooth', toneClass: 'bg-sky-50 text-sky-800 border-sky-200' },
      { id: 'difficult', label: "Difficult (Mo'ref)", toneClass: 'bg-rose-50 text-rose-800 border-rose-200' },
    ],
  },
];

export function getVendorTagInfo(tag: VendorBehaviorTag): { label: string; toneClass: string } {
  for (const g of VENDOR_TAG_GROUPS) {
    const match = g.options.find((o) => o.id === tag);
    if (match) return { label: match.label, toneClass: match.toneClass };
  }
  return { label: tag, toneClass: 'bg-slate-100 text-slate-700 border-slate-200' };
}

export function buildWhatsAppUrl(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('01') && digits.length === 11) {
    // Egyptian mobile number format -> +20
    digits = `2${digits}`;
  } else if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  return digits ? `https://wa.me/${digits}` : null;
}

export function inferDefaultWorkflowType(product: Product): WorkflowType {
  const hay = `${product.name} ${product.category} ${product.fabricDetails || ''}`.toLowerCase();
  if (
    hay.includes('wig') ||
    hay.includes('badge') ||
    hay.includes('pin') ||
    hay.includes('souvenir') ||
    hay.includes('accessory') ||
    hay.includes('accessories') ||
    hay.includes('ready') ||
    product.category.toLowerCase() === 'others'
  ) {
    return 'ready_made';
  }
  return 'manufactured';
}


/** The first working stage of a product's workflow (where a batch starts). */
export function firstWorkingStage(wf?: { activeStages?: OperationStageKey[]; workflowType?: WorkflowType } | null): OperationStageKey {
  return (
    wf?.activeStages?.find((st) => st !== 'stock_in') ||
    (wf?.workflowType === 'ready_made' ? 'supplier_sourcing' : 'raw_material')
  );
}

/**
 * A batch can take more quantity / be merged only while it is still at its first stage and no
 * work or money is recorded on it. Returns the reason in plain words, or null when it is open.
 */
export function batchJoinBlockReason(batch: ProductionBatch, firstStage: OperationStageKey): string | null {
  if (batch.status !== 'in_progress') return 'it is already completed';
  if (batch.currentStageKey !== firstStage) return 'it already moved past its first stage (it is with the factory or further)';
  const spent = Object.values(batch.stageAssignments || {}).some(
    (a) => a && (a.completedAt || (a.totalCost ?? a.cost) || (a.costLines && a.costLines.length > 0))
  );
  if (spent) return 'work or costs are already recorded on it';
  return null;
}
