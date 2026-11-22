import {
  OperationStageKey,
  Product,
  ProductStageVendor,
  ProductWorkflow,
  ProductionBatch,
  Vendor,
  VendorBehaviorTag,
  VendorPriceEntry,
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
  ready_made: ['supplier_sourcing', 'packaging', 'stock_in'],
};

export function getStageMeta(key: OperationStageKey): OperationStageMeta {
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

export interface SourcingSeedBundle {
  vendors: Vendor[];
  workflows: ProductWorkflow[];
  stageVendors: ProductStageVendor[];
  priceHistory: VendorPriceEntry[];
  batches: ProductionBatch[];
}

export function buildInitialSourcingSeed(products: Product[]): SourcingSeedBundle {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 32 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const vendors: Vendor[] = [
    {
      id: 'vnd_mahalla_textile',
      name: 'Al-Mahalla Textile Mills (El-Naggar)',
      location: 'Gesr El-Suez Industrial Zone, Bldg 14, Cairo',
      mapsUrl: 'https://maps.google.com/?q=Gesr+El+Suez+Industrial+Zone+Cairo',
      contactPerson: 'Hany El-Naggar',
      phone: '01012345678',
      tags: ['regular', 'negotiable', 'on_time', 'easy_smooth'],
      generalNotes: 'Reliable combed cotton 220 GSM and French Terry supplier. Delivers rolls directly by microbus if >= 3 toobs.',
      createdAt: now,
    },
    {
      id: 'vnd_shubra_cotton',
      name: 'Shubra Knitwear & Cotton',
      location: 'Shubra El-Kheima Textile Market, Gate 3',
      mapsUrl: 'https://maps.google.com/?q=Shubra+El+Kheima+Cairo',
      contactPerson: 'Mina Farouk',
      phone: '01229876543',
      tags: ['occasional', 'fixed_price', 'delays', 'easy_smooth'],
      generalNotes: 'Good backup for Forest Olive and Navy dyes when El-Naggar is out of stock. Confirm GSM weight on scale.',
      createdAt: now,
    },
    {
      id: 'vnd_elsalam_cutting',
      name: "El-Salam Cutting & Tasnee' Workshop",
      location: 'El-Marg Workshop District, Street 9, Cairo',
      mapsUrl: 'https://maps.google.com/?q=El+Marg+Cairo',
      contactPerson: 'Abou Youssef',
      phone: '01145678901',
      tags: ['regular', 'negotiable', 'on_time', 'easy_smooth'],
      generalNotes: 'Handles laser/electric knife bulk cutting for S to 3XL size patterns.',
      createdAt: now,
    },
    {
      id: 'vnd_hany_tarzy',
      name: 'Ustaz Hany Tailor Studio (Tarzy)',
      location: 'Ain Shams Textile Alley, 2nd Floor, Cairo',
      mapsUrl: 'https://maps.google.com/?q=Ain+Shams+Cairo',
      contactPerson: 'Ustaz Hany',
      phone: '01098765432',
      tags: ['regular', 'negotiable', 'on_time', 'easy_smooth'],
      generalNotes: 'Clean overlock stitching, collar reinforcement, and Scout emblem placement.',
      createdAt: now,
    },
    {
      id: 'vnd_cairo_pack',
      name: 'Cairo Pack & Polybags',
      location: 'Bab El-Shaariya Packaging Market, Cairo',
      mapsUrl: 'https://maps.google.com/?q=Bab+El+Shaariya+Cairo',
      contactPerson: 'Karim Adel',
      phone: '01277654321',
      tags: ['regular', 'fixed_price', 'on_time', 'easy_smooth'],
      generalNotes: 'Shared packaging vendor for self-seal polybags, size labels, and SPS kraft tags.',
      createdAt: now,
    },
    {
      id: 'vnd_muski_imports',
      name: 'Al-Muski Costume & Scout Imports',
      location: 'Haret El-Yahood / Al-Muski Wholesale, Cairo',
      mapsUrl: 'https://maps.google.com/?q=El+Muski+Cairo',
      contactPerson: 'Sayed El-Masry',
      phone: '01122334455',
      tags: ['regular', 'negotiable', 'on_time', 'difficult'],
      generalNotes: 'Wholesale importer for costume wigs, badges, and event props. Count every carton before paying.',
      createdAt: now,
    },
  ];

  // Match real catalog products if available
  const mfgProduct =
    products.find((p) =>
      /t-?shirt|shirt|hoodie|amees|chemise|pant|jacket/i.test(`${p.name} ${p.category}`)
    ) || products[0];

  const readyProduct =
    products.find(
      (p) =>
        p.id !== mfgProduct?.id &&
        /wig|badge|pin|accessor|souvenir|other|ready|cap|hat/i.test(`${p.name} ${p.category}`)
    ) || products.find((p) => p.id !== mfgProduct?.id);

  const workflows: ProductWorkflow[] = [];
  const stageVendors: ProductStageVendor[] = [];
  const priceHistory: VendorPriceEntry[] = [];
  const batches: ProductionBatch[] = [];

  if (mfgProduct) {
    workflows.push({
      id: `wf_${mfgProduct.id}`,
      productId: mfgProduct.id,
      workflowType: 'manufactured',
      activeStages: [...DEFAULT_STAGE_KEYS.manufactured],
      updatedAt: now,
    });

    const psvFab1: ProductStageVendor = {
      id: `psv_${mfgProduct.id}_raw_1`,
      productId: mfgProduct.id,
      stageKey: 'raw_material',
      vendorId: 'vnd_mahalla_textile',
      isPrimary: true,
      approxOrderQty: '60 meters (3 toobs)',
      orderScriptNotes:
        'Request 220 GSM combed cotton, pre-shrunk finish, color-fastness check, and matching rib collar roll.',
    };
    const psvFab2: ProductStageVendor = {
      id: `psv_${mfgProduct.id}_raw_2`,
      productId: mfgProduct.id,
      stageKey: 'raw_material',
      vendorId: 'vnd_shubra_cotton',
      isPrimary: false,
      approxOrderQty: '40 meters (2 toobs)',
      orderScriptNotes:
        'Backup fabric roll if El-Naggar has dye delay. Weigh each toob on pickup before loading.',
    };
    const psvCut: ProductStageVendor = {
      id: `psv_${mfgProduct.id}_cut_1`,
      productId: mfgProduct.id,
      stageKey: 'manufacturing',
      vendorId: 'vnd_elsalam_cutting',
      isPrimary: true,
      approxOrderQty: '100 pieces per batch',
      orderScriptNotes:
        'Use SPS standard pattern grading (20 S, 30 M, 35 L, 15 XL). Bundle by size with chalk marks on inside hem.',
    };
    const psvTailor: ProductStageVendor = {
      id: `psv_${mfgProduct.id}_tailor_1`,
      productId: mfgProduct.id,
      stageKey: 'tailor',
      vendorId: 'vnd_hany_tarzy',
      isPrimary: true,
      approxOrderQty: '100 pieces',
      orderScriptNotes:
        'Double-needle shoulder seam + 4-thread overlock + clean steam press before folding.',
    };
    const psvPack: ProductStageVendor = {
      id: `psv_${mfgProduct.id}_pack_1`,
      productId: mfgProduct.id,
      stageKey: 'packaging',
      vendorId: 'vnd_cairo_pack',
      isPrimary: true,
      approxOrderQty: '100 polybags + size stickers',
      orderScriptNotes:
        '30x40cm self-adhesive clear polybag with woven SPS size sticker on upper right corner.',
    };

    stageVendors.push(psvFab1, psvFab2, psvCut, psvTailor, psvPack);

    priceHistory.push(
      {
        id: 'ph_seed_1',
        productStageVendorId: psvFab1.id,
        purchaseDate: monthAgo,
        unitPrice: 135,
        quantity: '60 meters',
        notes: 'Batch #101 combed cotton rolls',
      },
      {
        id: 'ph_seed_2',
        productStageVendorId: psvFab1.id,
        purchaseDate: twoWeeksAgo,
        unitPrice: 142,
        quantity: '80 meters',
        notes: 'Seasonal cotton mill adjustment',
      },
      {
        id: 'ph_seed_3',
        productStageVendorId: psvFab2.id,
        purchaseDate: twoWeeksAgo,
        unitPrice: 148,
        quantity: '40 meters',
        notes: 'Urgent backup pickup',
      },
      {
        id: 'ph_seed_4',
        productStageVendorId: psvCut.id,
        purchaseDate: twoWeeksAgo,
        unitPrice: 18,
        quantity: '100 pcs',
        notes: 'Pattern cut & size bundling',
      },
      {
        id: 'ph_seed_5',
        productStageVendorId: psvTailor.id,
        purchaseDate: twoWeeksAgo,
        unitPrice: 38,
        quantity: '100 pcs',
        notes: 'Full stitching + finishing',
      },
      {
        id: 'ph_seed_6',
        productStageVendorId: psvPack.id,
        purchaseDate: twoWeeksAgo,
        unitPrice: 6,
        quantity: '100 bags',
        notes: 'Bags + size stickers',
      }
    );

    batches.push({
      id: 'batch_seed_104',
      batchCode: 'Batch #104',
      productId: mfgProduct.id,
      variantId: mfgProduct.variants[0]?.id,
      quantity: 100,
      targetDate: nextWeek,
      currentStageKey: 'manufacturing',
      status: 'in_progress',
      stageAssignments: {
        raw_material: { vendorId: 'vnd_mahalla_textile', cost: 142, notes: '3 toobs delivered' },
        manufacturing: { vendorId: 'vnd_elsalam_cutting', cost: 18, notes: 'Cutting scheduled' },
        tailor: { vendorId: 'vnd_hany_tarzy', cost: 38 },
        packaging: { vendorId: 'vnd_cairo_pack', cost: 6 },
      },
      createdAt: now,
    });
  }

  if (readyProduct) {
    workflows.push({
      id: `wf_${readyProduct.id}`,
      productId: readyProduct.id,
      workflowType: 'ready_made',
      activeStages: [...DEFAULT_STAGE_KEYS.ready_made],
      updatedAt: now,
    });

    const psvReadySup: ProductStageVendor = {
      id: `psv_${readyProduct.id}_sup_1`,
      productId: readyProduct.id,
      stageKey: 'supplier_sourcing',
      vendorId: 'vnd_muski_imports',
      isPrimary: true,
      approxOrderQty: '30 pieces',
      orderScriptNotes:
        'Check inner cap netting & tangle-free fiber quality before sealing carton. Negotiate carton rate if >= 30 pcs.',
    };
    const psvReadyPack: ProductStageVendor = {
      id: `psv_${readyProduct.id}_pack_1`,
      productId: readyProduct.id,
      stageKey: 'packaging',
      vendorId: 'vnd_cairo_pack',
      isPrimary: true,
      approxOrderQty: '30 pouches',
      orderScriptNotes: 'Zipper matte pouch with barcode label.',
    };

    stageVendors.push(psvReadySup, psvReadyPack);

    priceHistory.push(
      {
        id: 'ph_seed_ready_1',
        productStageVendorId: psvReadySup.id,
        purchaseDate: today,
        unitPrice: 95,
        quantity: '30 pcs',
        notes: 'Ready-made wholesale lot',
      },
      {
        id: 'ph_seed_ready_2',
        productStageVendorId: psvReadyPack.id,
        purchaseDate: today,
        unitPrice: 5,
        quantity: '30 pouches',
        notes: 'Standard packaging pouch',
      }
    );
  }

  return { vendors, workflows, stageVendors, priceHistory, batches };
}
