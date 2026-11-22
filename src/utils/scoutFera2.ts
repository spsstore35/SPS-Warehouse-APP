export type ScoutFare2Id =
  | 'Ashbal'
  | 'Zahrat'
  | 'Kashafeen'
  | 'Morshedat'
  | '3ashera 1'
  | '3ashera 2';

export interface ScoutFare2Meta {
  id: ScoutFare2Id;
  label: string;
  audience: string;
  genderGroup: 'boys' | 'girls';
  hex: string;
  dotClass: string;
  chipClass: string;
  solidBadgeClass: string;
  activeButtonClass: string;
}

// Boys / Men -> Blue family (Sky Blue, Royal Blue, Indigo/Navy)
// Girls / Women -> Pink / Purple / Rose family
export const SCOUT_FERA2_LIST: ScoutFare2Meta[] = [
  {
    id: 'Ashbal',
    label: 'Ashbal',
    audience: 'Kids Boys',
    genderGroup: 'boys',
    hex: '#0284C7',
    dotClass: 'bg-sky-500',
    chipClass: 'bg-sky-50 text-sky-950 border-sky-300 hover:bg-sky-100',
    solidBadgeClass: 'bg-sky-600 text-white',
    activeButtonClass: 'bg-sky-600 text-white border-sky-600',
  },
  {
    id: 'Zahrat',
    label: 'Zahrat',
    audience: 'Kids Girls',
    genderGroup: 'girls',
    hex: '#EC4899',
    dotClass: 'bg-pink-500',
    chipClass: 'bg-pink-50 text-pink-950 border-pink-300 hover:bg-pink-100',
    solidBadgeClass: 'bg-pink-500 text-white',
    activeButtonClass: 'bg-pink-500 text-white border-pink-500',
  },
  {
    id: 'Kashafeen',
    label: 'Kashafeen',
    audience: 'Boys Teens',
    genderGroup: 'boys',
    hex: '#2563EB',
    dotClass: 'bg-blue-600',
    chipClass: 'bg-blue-50 text-blue-950 border-blue-300 hover:bg-blue-100',
    solidBadgeClass: 'bg-blue-600 text-white',
    activeButtonClass: 'bg-blue-600 text-white border-blue-600',
  },
  {
    id: 'Morshedat',
    label: 'Morshedat',
    audience: 'Girls Teens',
    genderGroup: 'girls',
    hex: '#9333EA',
    dotClass: 'bg-purple-600',
    chipClass: 'bg-purple-50 text-purple-950 border-purple-300 hover:bg-purple-100',
    solidBadgeClass: 'bg-purple-600 text-white',
    activeButtonClass: 'bg-purple-600 text-white border-purple-600',
  },
  {
    id: '3ashera 1',
    label: '3ashera 1',
    audience: 'Women',
    genderGroup: 'girls',
    hex: '#E11D48',
    dotClass: 'bg-rose-600',
    chipClass: 'bg-rose-50 text-rose-950 border-rose-300 hover:bg-rose-100',
    solidBadgeClass: 'bg-rose-600 text-white',
    activeButtonClass: 'bg-rose-600 text-white border-rose-600',
  },
  {
    id: '3ashera 2',
    label: '3ashera 2',
    audience: '3ashera Men',
    genderGroup: 'boys',
    hex: '#4338CA',
    dotClass: 'bg-indigo-700',
    chipClass: 'bg-indigo-50 text-indigo-950 border-indigo-300 hover:bg-indigo-100',
    solidBadgeClass: 'bg-indigo-700 text-white',
    activeButtonClass: 'bg-indigo-700 text-white border-indigo-700',
  },
];

export const getScoutFare2Meta = (name?: string | null): ScoutFare2Meta | null => {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  return (
    SCOUT_FERA2_LIST.find((f) => f.id.toLowerCase() === normalized) || null
  );
};

export const isCoreScoutFare2 = (name?: string | null): boolean =>
  Boolean(getScoutFare2Meta(name));
