import React, { useMemo, useRef, useState } from 'react';
import { CalendarItem, CalendarItemType, ScoutSeason, StoreTeamId, User } from '../types/inventory';
import { SCOUT_FERA2_LIST, getScoutFare2Meta } from '../utils/scoutFera2';
import {
  Calendar as CalendarIcon,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  CheckCircle2,
  Circle,
  Plus,
  MapPin,
  Users,
  Download,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Search,
  ListTodo,
  CalendarPlus,
  UserCheck,
  Lock,
} from 'lucide-react';

interface CalendarViewProps {
  items: CalendarItem[];
  users?: User[];
  currentUser: User;
  scoutSeasons?: ScoutSeason[];
  onSaveItem: (item: CalendarItem) => void;
  onDeleteItem: (id: string) => void;
  onToggleTaskComplete: (id: string) => void;
  onSaveScoutSeason?: (season: ScoutSeason) => void;
  onDeleteScoutSeason?: (id: string) => void;
  onShowToast?: (msg: string) => void;
}

export interface StoreTeamMeta {
  id: StoreTeamId;
  label: string;
  shortLabel: string;
  hex: string;
  dotClass: string;
  chipClass: string;
  cardClass: string;
  activeButtonClass: string;
  textClass: string;
}

export const STORE_TEAMS: StoreTeamMeta[] = [
  {
    id: 'purchases',
    label: 'Purchases Team',
    shortLabel: 'Purchases',
    hex: '#2563EB',
    dotClass: 'bg-blue-600',
    chipClass: 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100',
    cardClass: 'bg-blue-50/40 border-blue-200 hover:border-blue-400',
    activeButtonClass: 'bg-blue-600 text-white border-blue-600',
    textClass: 'text-blue-800',
  },
  {
    id: 'troops',
    label: 'Scout Fera2 Team',
    shortLabel: 'Scout Fera2',
    hex: '#059669',
    dotClass: 'bg-emerald-600',
    chipClass: 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
    cardClass: 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400',
    activeButtonClass: 'bg-emerald-600 text-white border-emerald-600',
    textClass: 'text-emerald-800',
  },
  {
    id: 'inventory',
    label: 'Inventory Management Team',
    shortLabel: 'Inventory Mgmt',
    hex: '#D97706',
    dotClass: 'bg-amber-600',
    chipClass: 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100',
    cardClass: 'bg-amber-50/40 border-amber-200 hover:border-amber-400',
    activeButtonClass: 'bg-amber-600 text-white border-amber-600',
    textClass: 'text-amber-800',
  },
  {
    id: 'calendar',
    label: 'Calendar Team',
    shortLabel: 'Calendar',
    hex: '#4F46E5',
    dotClass: 'bg-indigo-600',
    chipClass: 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100',
    cardClass: 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-400',
    activeButtonClass: 'bg-indigo-600 text-white border-indigo-600',
    textClass: 'text-indigo-800',
  },
  {
    id: 'marketing',
    label: 'Marketing Team',
    shortLabel: 'Marketing',
    hex: '#E11D48',
    dotClass: 'bg-rose-600',
    chipClass: 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100',
    cardClass: 'bg-rose-50/40 border-rose-200 hover:border-rose-400',
    activeButtonClass: 'bg-rose-600 text-white border-rose-600',
    textClass: 'text-rose-800',
  },
  {
    id: 'budgeting',
    label: 'Budgeting Team',
    shortLabel: 'Budgeting',
    hex: '#0D9488',
    dotClass: 'bg-teal-600',
    chipClass: 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100',
    cardClass: 'bg-teal-50/40 border-teal-200 hover:border-teal-400',
    activeButtonClass: 'bg-teal-600 text-white border-teal-600',
    textClass: 'text-teal-800',
  },
];

const getTeamMeta = (teamId?: StoreTeamId): StoreTeamMeta | null =>
  STORE_TEAMS.find((t) => t.id === teamId) || null;

const TROOP_OPTIONS = [
  'Ashbal',
  'Zahrat',
  'Kashafeen',
  'Morshedat',
  '3ashera 1',
  '3ashera 2',
  'Afrad',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n: number) => String(n).padStart(2, '0');

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseDateKey = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const addDaysToDateKey = (dateStr: string, days: number): string => {
  const d = parseDateKey(dateStr);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = parseDateKey(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDisplayTime = (time24?: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${suffix}`;
};

const escapeIcsText = (text: string): string =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

const toIcsDateCompact = (dateStr: string): string => dateStr.replace(/-/g, '');

const toIcsDateTimeLocal = (dateStr: string, time24: string): string => {
  const cleanDate = toIcsDateCompact(dateStr);
  const [hh, mm] = (time24 || '09:00').split(':');
  return `${cleanDate}T${pad2(parseInt(hh || '9', 10))}${pad2(parseInt(mm || '0', 10))}00`;
};

const toIcsUtcStamp = (iso?: string): string => {
  const d = iso ? new Date(iso) : new Date();
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    'T' +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    'Z'
  );
};

const SEASON_COLOR_PRESETS = [
  { label: 'Emerald', hex: '#059669' },
  { label: 'Blue', hex: '#2563EB' },
  { label: 'Amber', hex: '#D97706' },
  { label: 'Rose', hex: '#E11D48' },
  { label: 'Indigo', hex: '#4F46E5' },
  { label: 'Teal', hex: '#0D9488' },
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  items,
  users = [],
  currentUser,
  scoutSeasons = [],
  onSaveItem,
  onDeleteItem,
  onToggleTaskComplete,
  onSaveScoutSeason,
  onDeleteScoutSeason,
  onShowToast,
}) => {
  const todayKey = toDateKey(new Date());

  const [calendarMode, setCalendarMode] = useState<'month' | 'week' | 'day'>('month');
  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [filterType, setFilterType] = useState<'all' | CalendarItemType>('all');
  const [selectedTeams, setSelectedTeams] = useState<StoreTeamId[]>([]);
  const [selectedFare2, setSelectedFare2] = useState<string[]>([]);
  const [isHoveringScoutFera2, setIsHoveringScoutFera2] = useState<boolean>(false);
  const scoutHoverTimeoutRef = useRef<number | null>(null);
  const openScoutFera2Hover = () => {
    if (scoutHoverTimeoutRef.current !== null) {
      window.clearTimeout(scoutHoverTimeoutRef.current);
      scoutHoverTimeoutRef.current = null;
    }
    setIsHoveringScoutFera2(true);
  };
  const closeScoutFera2HoverDelayed = () => {
    if (scoutHoverTimeoutRef.current !== null) {
      window.clearTimeout(scoutHoverTimeoutRef.current);
    }
    scoutHoverTimeoutRef.current = window.setTimeout(() => {
      setIsHoveringScoutFera2(false);
      scoutHoverTimeoutRef.current = null;
    }, 180);
  };
  const [onlyAssignedToMe, setOnlyAssignedToMe] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [agendaMode, setAgendaMode] = useState<'selected_day' | 'upcoming_all'>('selected_day');

  // Create/Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<CalendarItemType>('event');
  const [formStartDate, setFormStartDate] = useState<string>(todayKey);
  const [formEndDate, setFormEndDate] = useState<string>(todayKey);
  const [formAllDay, setFormAllDay] = useState<boolean>(false);
  const [formStartTime, setFormStartTime] = useState<string>('10:00');
  const [formEndTime, setFormEndTime] = useState<string>('12:00');
  const [formTeam, setFormTeam] = useState<StoreTeamId | ''>('');
  const [formAssignedToId, setFormAssignedToId] = useState<string>('');
  const [formAssignedToName, setFormAssignedToName] = useState<string>('');
  const [formTroop, setFormTroop] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Detail, Edit Confirm & Delete Modal state
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [pendingEditItem, setPendingEditItem] = useState<CalendarItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Scout Seasons / Time Frames Manager Modal state
  const [isSeasonsModalOpen, setIsSeasonsModalOpen] = useState<boolean>(false);
  const [editingSeason, setEditingSeason] = useState<ScoutSeason | null>(null);
  const [seasonName, setSeasonName] = useState<string>('');
  const [seasonStartDate, setSeasonStartDate] = useState<string>(todayKey);
  const [seasonEndDate, setSeasonEndDate] = useState<string>(addDaysToDateKey(todayKey, 90));
  const [seasonColorHex, setSeasonColorHex] = useState<string>('#059669');
  const [seasonNotes, setSeasonNotes] = useState<string>('');
  const [seasonError, setSeasonError] = useState<string>('');
  const [confirmDeleteSeasonId, setConfirmDeleteSeasonId] = useState<string | null>(null);

  const openSeasonForm = (season?: ScoutSeason) => {
    if (season) {
      setEditingSeason(season);
      setSeasonName(season.name);
      setSeasonStartDate(season.startDate);
      setSeasonEndDate(season.endDate);
      setSeasonColorHex(season.colorHex || '#059669');
      setSeasonNotes(season.notes || '');
    } else {
      setEditingSeason(null);
      setSeasonName('');
      setSeasonStartDate(selectedDate || todayKey);
      setSeasonEndDate(addDaysToDateKey(selectedDate || todayKey, 90));
      setSeasonColorHex('#059669');
      setSeasonNotes('');
    }
    setSeasonError('');
  };

  const handleSaveSeasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSeasonError('');
    if (!seasonName.trim()) {
      setSeasonError('Please enter the Scout Season name (e.g., Term 1 / Summer Camp / Mo2tamar).');
      return;
    }
    if (!seasonStartDate || !seasonEndDate) {
      setSeasonError('Please choose both start and end dates.');
      return;
    }
    if (seasonEndDate < seasonStartDate) {
      setSeasonError('End date must be on or after the start date.');
      return;
    }
    const nowIso = new Date().toISOString();
    const payload: ScoutSeason = {
      id: editingSeason ? editingSeason.id : `season_${Date.now()}`,
      name: seasonName.trim(),
      startDate: seasonStartDate,
      endDate: seasonEndDate,
      colorHex: seasonColorHex || '#059669',
      notes: seasonNotes.trim() || undefined,
      createdByName: editingSeason?.createdByName || currentUser.name,
      createdAt: editingSeason?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    onSaveScoutSeason?.(payload);
    openSeasonForm();
  };

  const sortedScoutSeasons = useMemo(
    () => [...scoutSeasons].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [scoutSeasons]
  );

  const activeSeasonsForView = useMemo(() => {
    if (sortedScoutSeasons.length === 0) return [];
    let rangeStart = selectedDate;
    let rangeEnd = selectedDate;
    if (calendarMode === 'month') {
      const y = cursorMonth.getFullYear();
      const m = cursorMonth.getMonth();
      rangeStart = toDateKey(new Date(y, m, 1));
      rangeEnd = toDateKey(new Date(y, m + 1, 0));
    } else if (calendarMode === 'week') {
      const anchor = parseDateKey(selectedDate);
      const startOfWeek = new Date(anchor);
      startOfWeek.setDate(anchor.getDate() - anchor.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      rangeStart = toDateKey(startOfWeek);
      rangeEnd = toDateKey(endOfWeek);
    }
    return sortedScoutSeasons.filter(
      (s) => s.startDate <= rangeEnd && s.endDate >= rangeStart
    );
  }, [sortedScoutSeasons, calendarMode, cursorMonth, selectedDate]);

  const getItemStage = (item: CalendarItem): 'upcoming' | 'in_progress' | 'done' => {
    if (item.completed || item.boardStatus === 'done') return 'done';
    if (item.boardStatus === 'in_progress') return 'in_progress';
    if (item.boardStatus === 'upcoming') return 'upcoming';
    if (item.startDate <= todayKey && (item.endDate || item.startDate) >= todayKey) {
      return 'in_progress';
    }
    return 'upcoming';
  };

  const detailItem = useMemo(
    () => items.find((i) => i.id === detailItemId) || null,
    [items, detailItemId]
  );

  // Active staff & admin accounts eligible for assignment
  const activeAccounts = useMemo(
    () =>
      users
        .filter((u) => u.status === 'active' && u.role !== 'leader')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  // Previously used assignees for quick selection (filtered by selected team if set)
  const previousTeamAssignees = useMemo(() => {
    const names = new Set<string>();
    items.forEach((it) => {
      if (!it.assignedToName) return;
      if (formTeam && it.team !== formTeam) return;
      names.add(it.assignedToName.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [items, formTeam]);

  // Filter & Search items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const myNameLower = (currentUser.name || '').trim().toLowerCase();
    const fare2Set = new Set(selectedFare2.map((f) => f.toLowerCase()));
    return items
      .filter((item) => {
        if (filterType !== 'all' && item.itemType !== filterType) return false;
        if (selectedTeams.length > 0 && (!item.team || !selectedTeams.includes(item.team))) {
          return false;
        }
        if (fare2Set.size > 0) {
          const itemTroop = (item.troopGroup || '').trim().toLowerCase();
          if (!itemTroop || !fare2Set.has(itemTroop)) return false;
        }
        if (onlyAssignedToMe) {
          const matchesId = item.assignedToId && item.assignedToId === currentUser.id;
          const matchesName =
            item.assignedToName && item.assignedToName.trim().toLowerCase() === myNameLower;
          if (!matchesId && !matchesName) return false;
        }
        if (q) {
          const teamMeta = getTeamMeta(item.team);
          const fare2Meta = getScoutFare2Meta(item.troopGroup);
          const hay = `${item.title} ${item.notes || ''} ${item.location || ''} ${item.troopGroup || ''} ${fare2Meta?.audience || ''} ${teamMeta?.label || ''} ${item.assignedToName || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
  }, [items, filterType, selectedTeams, selectedFare2, onlyAssignedToMe, searchQuery, currentUser]);

  // Metrics
  const stats = useMemo(() => {
    const total = items.length;
    const events = items.filter((i) => i.itemType === 'event').length;
    const openTasks = items.filter((i) => i.itemType === 'task' && !i.completed).length;
    const completedTasks = items.filter((i) => i.itemType === 'task' && i.completed).length;
    return { total, events, openTasks, completedTasks };
  }, [items]);

  // Team item counts
  const teamCounts = useMemo(() => {
    const counts: Record<StoreTeamId, number> = {
      purchases: 0,
      troops: 0,
      inventory: 0,
      calendar: 0,
      marketing: 0,
      budgeting: 0,
    };
    items.forEach((it) => {
      if (it.team && counts[it.team] !== undefined) {
        counts[it.team] += 1;
      }
    });
    return counts;
  }, [items]);

  // Scout Fera2 item counts
  const fare2Counts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((it) => {
      const grp = (it.troopGroup || '').trim().toLowerCase();
      if (grp) {
        counts[grp] = (counts[grp] || 0) + 1;
      }
    });
    return counts;
  }, [items]);

  // Toggle multi-select Store Team filter
  const toggleTeamFilter = (teamId: StoreTeamId) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  // Toggle multi-select Scout Fera2 filter (pick 1, 2, or more; empty = All)
  const toggleFare2Filter = (fare2Id: string) => {
    setSelectedFare2((prev) =>
      prev.includes(fare2Id) ? prev.filter((id) => id !== fare2Id) : [...prev, fare2Id]
    );
  };

  // Build 42-day month grid
  const monthCells = useMemo(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = firstDayOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);

    const cells: Array<{ dateKey: string; dayNum: number; inCurrentMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      cells.push({
        dateKey: toDateKey(d),
        dayNum: d.getDate(),
        inCurrentMonth: d.getMonth() === month,
      });
    }
    return cells;
  }, [cursorMonth]);

  // Build 7-day week cells centered on selectedDate (Sunday -> Saturday)
  const weekCells = useMemo(() => {
    const base = parseDateKey(selectedDate);
    const sunday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay());
    const days: Array<{ dateKey: string; dayName: string; dayNum: number; monthShort: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
      days.push({
        dateKey: toDateKey(d),
        dayName: WEEKDAYS[d.getDay()],
        dayNum: d.getDate(),
        monthShort: d.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return days;
  }, [selectedDate]);

  // Map items appearing on each day cell (inclusive startDate..endDate)
  const getItemsForDate = (dateKey: string): CalendarItem[] => {
    return filteredItems.filter((item) => {
      const start = item.startDate;
      const end = item.endDate || item.startDate;
      return dateKey >= start && dateKey <= end;
    });
  };

  const selectedDayItems = useMemo(
    () => getItemsForDate(selectedDate),
    [filteredItems, selectedDate]
  );

  const upcomingItems = useMemo(() => {
    return filteredItems.filter((item) => (item.endDate || item.startDate) >= todayKey);
  }, [filteredItems, todayKey]);

  const displayedAgendaItems =
    agendaMode === 'selected_day' ? selectedDayItems : upcomingItems;

  const openCreateModal = (presetDate?: string, presetType: CalendarItemType = 'event') => {
    const baseDate = presetDate || selectedDate || todayKey;
    setEditingItem(null);
    setFormTitle('');
    setFormType(presetType);
    setFormStartDate(baseDate);
    setFormEndDate(baseDate);
    setFormAllDay(false);
    setFormStartTime('10:00');
    setFormEndTime('12:00');
    setFormTeam(selectedTeams.length === 1 ? selectedTeams[0] : '');
    setFormAssignedToId('');
    setFormAssignedToName('');
    setFormTroop(selectedFare2.length === 1 ? selectedFare2[0] : '');
    setFormLocation('');
    setFormNotes('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (item: CalendarItem) => {
    if (getItemStage(item) === 'done') return;
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(item.itemType);
    setFormStartDate(item.startDate);
    setFormEndDate(item.endDate || item.startDate);
    setFormAllDay(Boolean(item.allDay));
    setFormStartTime(item.startTime || '10:00');
    setFormEndTime(item.endTime || '12:00');
    setFormTeam(item.team || '');
    setFormAssignedToId(item.assignedToId || '');
    setFormAssignedToName(item.assignedToName || '');
    setFormTroop(item.troopGroup || '');
    setFormLocation(item.location || '');
    setFormNotes(item.notes || '');
    setFormError('');
    setDetailItemId(null);
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formTitle.trim()) {
      setFormError('Please enter a title for the event or task.');
      return;
    }
    if (!formStartDate) {
      setFormError('Please choose a start date.');
      return;
    }

    const safeEndDate = !formEndDate || formEndDate < formStartDate ? formStartDate : formEndDate;

    if (!formAllDay) {
      if (!formStartTime || !formEndTime) {
        setFormError('Please set both From Time and To Time, or enable All Day.');
        return;
      }
      if (safeEndDate === formStartDate && formEndTime < formStartTime) {
        setFormError('End time cannot be earlier than start time on the same day.');
        return;
      }
    }

    const trimmedAssignee = formAssignedToName.trim();
    if (trimmedAssignee && !formTeam) {
      setFormError('Please select a Store Team when assigning a team member.');
      return;
    }

    const now = new Date().toISOString();
    const nextItem: CalendarItem = {
      id: editingItem ? editingItem.id : `cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: formTitle.trim(),
      itemType: formType,
      startDate: formStartDate,
      endDate: safeEndDate,
      startTime: formAllDay ? undefined : formStartTime,
      endTime: formAllDay ? undefined : formEndTime,
      allDay: formAllDay,
      completed: editingItem ? editingItem.completed : false,
      boardStatus: editingItem
        ? editingItem.boardStatus || (editingItem.completed ? 'done' : 'upcoming')
        : 'upcoming',
      team: formTeam || undefined,
      assignedToId: formAssignedToId || undefined,
      assignedToName: trimmedAssignee || undefined,
      troopGroup: formTroop || undefined,
      location: formLocation.trim() || undefined,
      notes: formNotes.trim() || undefined,
      createdById: editingItem ? editingItem.createdById : currentUser.id,
      createdByName: editingItem ? editingItem.createdByName : currentUser.name,
      createdAt: editingItem ? editingItem.createdAt : now,
      updatedAt: now,
    };

    onSaveItem(nextItem);
    setSelectedDate(nextItem.startDate);
    setIsFormOpen(false);
  };

  // Generate and download a mobile-compatible .ics iCalendar file
  const handleDownloadIcs = (item: CalendarItem) => {
    const uid = `${item.id}@sps-warehouse.local`;
    const dtStamp = toIcsUtcStamp(item.updatedAt);
    const safeEndDate = item.endDate && item.endDate >= item.startDate ? item.endDate : item.startDate;
    const teamMeta = getTeamMeta(item.team);

    const descriptionLines: string[] = [];
    if (item.itemType === 'task') {
      descriptionLines.push(`Type: Task (${item.completed ? 'Completed' : 'Open'})`);
    } else {
      descriptionLines.push('Type: Scout Store Event');
    }
    if (teamMeta) descriptionLines.push(`Assigned Team: ${teamMeta.label}`);
    if (item.assignedToName) descriptionLines.push(`Assigned Member: ${item.assignedToName}`);
    if (item.troopGroup) descriptionLines.push(`Scout Branch: ${item.troopGroup}`);
    if (item.notes) descriptionLines.push(`Notes: ${item.notes}`);
    descriptionLines.push(`Added by: ${item.createdByName}`);

    const dtLines = item.allDay
      ? [
          `DTSTART;VALUE=DATE:${toIcsDateCompact(item.startDate)}`,
          `DTEND;VALUE=DATE:${toIcsDateCompact(addDaysToDateKey(safeEndDate, 1))}`,
        ]
      : [
          `DTSTART:${toIcsDateTimeLocal(item.startDate, item.startTime || '09:00')}`,
          `DTEND:${toIcsDateTimeLocal(safeEndDate, item.endTime || '10:00')}`,
        ];

    const summaryPrefix = item.itemType === 'task' ? '[Task] ' : '';
    const teamSuffix = teamMeta ? ` (${teamMeta.shortLabel})` : '';

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SPS Warehouse//Scout Store Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      ...dtLines,
      `SUMMARY:${escapeIcsText(`${summaryPrefix}${item.title}${teamSuffix}`)}`,
      `DESCRIPTION:${escapeIcsText(descriptionLines.join('\n'))}`,
      item.location ? `LOCATION:${escapeIcsText(item.location)}` : '',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(item.title)}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean);

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeFilename =
      item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'sps-event';
    link.download = `${safeFilename}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (onShowToast) {
      onShowToast(
        `Calendar file downloaded — open it on your phone to add "${item.title}" to Mobile Calendar.`
      );
    }
  };

  const getGoogleCalendarUrl = (item: CalendarItem): string => {
    const safeEndDate = item.endDate && item.endDate >= item.startDate ? item.endDate : item.startDate;
    const teamMeta = getTeamMeta(item.team);
    const datesParam = item.allDay
      ? `${toIcsDateCompact(item.startDate)}/${toIcsDateCompact(addDaysToDateKey(safeEndDate, 1))}`
      : `${toIcsDateTimeLocal(item.startDate, item.startTime || '09:00')}/${toIcsDateTimeLocal(safeEndDate, item.endTime || '10:00')}`;

    const details = [
      item.itemType === 'task' ? 'Task from SPS Warehouse' : 'Event from SPS Warehouse',
      teamMeta ? `Team: ${teamMeta.label}` : '',
      item.assignedToName ? `Assigned Member: ${item.assignedToName}` : '',
      item.troopGroup ? `Branch: ${item.troopGroup}` : '',
      item.notes || '',
    ]
      .filter(Boolean)
      .join('\n');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${item.itemType === 'task' ? '[Task] ' : ''}${item.title}`,
      dates: datesParam,
      details,
      location: item.location || '',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const monthTitle = cursorMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const periodTitle = useMemo(() => {
    if (calendarMode === 'month') return monthTitle;
    if (calendarMode === 'week' && weekCells.length === 7) {
      const first = parseDateKey(weekCells[0].dateKey);
      const last = parseDateKey(weekCells[6].dateKey);
      const firstLabel = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const lastLabel = last.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${firstLabel} – ${lastLabel}`;
    }
    const d = parseDateKey(selectedDate);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [calendarMode, monthTitle, weekCells, selectedDate]);

  const stepPeriod = (direction: -1 | 1) => {
    if (calendarMode === 'month') {
      setCursorMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
      return;
    }
    const deltaDays = calendarMode === 'week' ? direction * 7 : direction;
    const nextKey = addDaysToDateKey(selectedDate, deltaDays);
    const nextDate = parseDateKey(nextKey);
    setSelectedDate(nextKey);
    setCursorMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  };

  const formatRangeLabel = (item: CalendarItem) => {
    const sameDay = !item.endDate || item.endDate === item.startDate;
    const dateLabel = sameDay
      ? formatDisplayDate(item.startDate)
      : `${formatDisplayDate(item.startDate)} → ${formatDisplayDate(item.endDate)}`;
    const timeLabel = item.allDay
      ? 'All Day'
      : `${formatDisplayTime(item.startTime)} – ${formatDisplayTime(item.endTime)}`;
    return { dateLabel, timeLabel };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <span>Store Calendar &amp; Tasks</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Assign events and tasks to color-coded store teams and individual team members with mobile calendar export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {onSaveScoutSeason && (
            <button
              type="button"
              onClick={() => {
                openSeasonForm();
                setIsSeasonsModalOpen(true);
              }}
              className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Define Scout Seasons / Time Frames synced directly with Budgeting Sales"
            >
              <CalendarRange className="w-4 h-4 text-emerald-700" />
              <span>Scout Seasons</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white font-mono text-[10px] tabular-nums">
                {scoutSeasons.length}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => openCreateModal(selectedDate, 'task')}
            className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ListTodo className="w-4 h-4 text-amber-700" />
            <span>New Task</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateModal(selectedDate, 'event')}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">Total Scheduled</div>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
            {stats.total}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-blue-700">Calendar Events</div>
          <div className="text-2xl font-black font-mono tabular-nums text-blue-700 mt-1">
            {stats.events}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-amber-700">Open Tasks</div>
          <div className="text-2xl font-black font-mono tabular-nums text-amber-700 mt-1">
            {stats.openTasks}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-emerald-700">Completed Tasks</div>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-700 mt-1">
            {stats.completedTasks}
          </div>
        </div>
      </div>

      {/* Search, Item Type & Color-Coded Team Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, team, assigned member, branch, or location..."
              className="w-full pl-10 pr-9 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'event', 'task'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  filterType === t
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t === 'all' ? 'All Items' : t === 'event' ? 'Events' : 'Tasks'}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setOnlyAssignedToMe((prev) => !prev)}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                onlyAssignedToMe
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assigned to Me</span>
            </button>
          </div>
        </div>

        {/* 6 Store Teams Color Filter Bar (Default: All Teams · Multi-select supported) */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <span className="text-xs font-bold text-slate-500 shrink-0 mr-1">Teams:</span>

          <button
            type="button"
            onClick={() => {
              setSelectedTeams([]);
              setSelectedFare2([]);
            }}
            className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              selectedTeams.length === 0
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>All Teams</span>
            <span className="font-mono tabular-nums opacity-80">{items.length}</span>
          </button>

          {STORE_TEAMS.map((team) => {
            const isActive = selectedTeams.includes(team.id);
            const isScoutFera2Team = team.id === 'troops';
            const showFera2Bar =
              selectedTeams.includes('troops') || selectedFare2.length > 0 || isHoveringScoutFera2;
            return (
              <button
                key={team.id}
                type="button"
                onMouseEnter={isScoutFera2Team ? openScoutFera2Hover : undefined}
                onMouseLeave={isScoutFera2Team ? closeScoutFera2HoverDelayed : undefined}
                onClick={() => {
                  if (isScoutFera2Team && isActive) {
                    setSelectedFare2([]);
                  }
                  toggleTeamFilter(team.id);
                }}
                className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isActive ? team.activeButtonClass : team.chipClass
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-sm shrink-0 ${
                    isActive ? 'bg-white' : team.dotClass
                  }`}
                  aria-hidden="true"
                />
                <span>{team.shortLabel}</span>
                <span className="font-mono tabular-nums opacity-80">{teamCounts[team.id]}</span>
                {isActive && <Check className="w-3 h-3 shrink-0" />}
                {isScoutFera2Team && (
                  <span className="text-[10px] opacity-75 ml-0.5">
                    {showFera2Bar ? '▴' : '▾'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Multi-Select Scout Fera2 Filter Bar (Shown ONLY when hovering or selecting Scout Fera2) */}
        {(selectedTeams.includes('troops') || selectedFare2.length > 0 || isHoveringScoutFera2) && (
          <div
            onMouseEnter={openScoutFera2Hover}
            onMouseLeave={closeScoutFera2HoverDelayed}
            className="pt-2.5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 animate-in fade-in duration-150"
          >
            <span className="text-xs font-bold text-emerald-700 shrink-0 mr-1">Scout Fera2:</span>

            <button
              type="button"
              onClick={() => setSelectedFare2([])}
              className={`px-3 py-1.5 min-h-[34px] rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                selectedFare2.length === 0
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>All Fera2</span>
            </button>

            {SCOUT_FERA2_LIST.map((f) => {
              const isActive = selectedFare2.includes(f.id);
              const cnt = fare2Counts[f.id.toLowerCase()] || 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFare2Filter(f.id)}
                  title={`${f.label} — tap to multi-select`}
                  className={`px-2.5 py-1.5 min-h-[34px] rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isActive ? f.activeButtonClass : f.chipClass
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive ? 'bg-white' : f.dotClass
                    }`}
                  />
                  <span>{f.label}</span>
                  {cnt > 0 && <span className="font-mono text-[11px] opacity-80">{cnt}</span>}
                  {isActive && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}

            {(() => {
              const isActive = selectedFare2.includes('Afrad');
              const cnt = fare2Counts['afrad'] || 0;
              return (
                <button
                  type="button"
                  onClick={() => toggleFare2Filter('Afrad')}
                  className={`px-2.5 py-1.5 min-h-[34px] rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>Afrad</span>
                  {cnt > 0 && <span className="font-mono text-[11px] opacity-80">{cnt}</span>}
                  {isActive && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })()}

            {(selectedTeams.length > 0 || selectedFare2.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTeams([]);
                  setSelectedFare2([]);
                }}
                className="px-2.5 py-1.5 min-h-[34px] rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Split: Calendar View (Month / Week / Day) + Day / Upcoming Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Top: Calendar Viewport (Month, Week, or Day) */}
        <div
          className={`${
            calendarMode === 'day' ? 'lg:col-span-12' : 'lg:col-span-7 xl:col-span-8'
          } bg-white rounded-2xl border border-slate-200 overflow-hidden`}
        >
          {/* Calendar Top Controls: Navigation + Month/Week/Day Switcher + Today */}
          <div className="px-4 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepPeriod(-1)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label={`Previous ${calendarMode}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm sm:text-base font-black text-slate-900 px-1 min-w-[140px] text-center">
                {periodTitle}
              </h2>
              <button
                type="button"
                onClick={() => stepPeriod(1)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label={`Next ${calendarMode}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Month | Week | Day Mode Switcher */}
              <div className="inline-flex p-1 bg-slate-200/70 rounded-xl border border-slate-200">
                {(['month', 'week', 'day'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setCalendarMode(mode);
                      if (mode === 'day') setAgendaMode('selected_day');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                      calendarMode === mode
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDate(todayKey);
                  setAgendaMode('selected_day');
                }}
                className="px-3.5 py-2 min-h-[40px] rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
              >
                Today
              </button>
            </div>
          </div>

          {/* Active Scout Season Time Frame Banner (Synced with Budgeting) */}
          {activeSeasonsForView.length > 0 && (
            <div className="px-4 py-2.5 border-b border-slate-200 bg-emerald-50/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Scout Season:</span>
                </span>
                {activeSeasonsForView.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      openSeasonForm(s);
                      setIsSeasonsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 hover:border-emerald-400 text-xs font-bold text-slate-900 transition-colors cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.colorHex || '#059669' }}
                    />
                    <span>{s.name}</span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      ({s.startDate} → {s.endDate})
                    </span>
                  </button>
                ))}
              </div>
              {onSaveScoutSeason && (
                <button
                  type="button"
                  onClick={() => {
                    openSeasonForm();
                    setIsSeasonsModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  Manage Seasons
                </button>
              )}
            </div>
          )}

          {/* MODE 1: MONTH GRID */}
          {calendarMode === 'month' && (
            <>
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-[11px] font-bold text-slate-500"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                {monthCells.map((cell) => {
                  const dayItems = getItemsForDate(cell.dateKey);
                  const isToday = cell.dateKey === todayKey;
                  const isSelected = cell.dateKey === selectedDate;

                  return (
                    <div
                      key={cell.dateKey}
                      onClick={() => {
                        setSelectedDate(cell.dateKey);
                        setAgendaMode('selected_day');
                      }}
                      className={`min-h-[82px] sm:min-h-[108px] p-1.5 sm:p-2 transition-colors cursor-pointer flex flex-col gap-1 ${
                        !cell.inCurrentMonth ? 'bg-slate-50/60 text-slate-400' : 'bg-white'
                      } ${
                        isSelected
                          ? 'ring-2 ring-inset ring-blue-600 bg-blue-50/20'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center tabular-nums ${
                            isToday
                              ? 'bg-blue-600 text-white'
                              : isSelected
                              ? 'bg-slate-900 text-white'
                              : cell.inCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {dayItems.length > 0 && (
                          <span className="text-[10px] font-mono font-bold text-slate-400 hidden sm:inline tabular-nums">
                            {dayItems.length}
                          </span>
                        )}
                      </div>

                      {/* Mobile color-coded dot indicators */}
                      {dayItems.length > 0 && (
                        <div className="flex sm:hidden flex-wrap gap-1 mt-0.5">
                          {dayItems.slice(0, 4).map((it) => {
                            const teamMeta = getTeamMeta(it.team);
                            const dotColor = teamMeta
                              ? teamMeta.dotClass
                              : it.itemType === 'task'
                              ? it.completed
                                ? 'bg-emerald-500'
                                : 'bg-amber-500'
                              : 'bg-slate-700';
                            return (
                              <span
                                key={it.id}
                                className={`w-2 h-2 rounded-sm ${dotColor}`}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Desktop/tablet color-coded event & task chips */}
                      <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                        {dayItems.slice(0, 2).map((it) => {
                          const teamMeta = getTeamMeta(it.team);
                          const chipStyle = teamMeta
                            ? teamMeta.chipClass
                            : it.itemType === 'task'
                            ? it.completed
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100';

                          return (
                            <button
                              key={it.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailItemId(it.id);
                              }}
                              className={`w-full text-left px-1.5 py-0.5 rounded-md border text-[10px] font-bold truncate transition-colors cursor-pointer flex items-center gap-1 ${chipStyle} ${
                                it.itemType === 'task' && it.completed ? 'line-through opacity-70' : ''
                              }`}
                              title={`${it.title}${teamMeta ? ` · ${teamMeta.label}` : ''}${it.assignedToName ? ` · Assigned: ${it.assignedToName}` : ''}`}
                            >
                              <span
                                className={`w-2 h-2 rounded-sm shrink-0 ${
                                  teamMeta ? teamMeta.dotClass : 'bg-slate-500'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="shrink-0">
                                {it.itemType === 'task' ? (it.completed ? '✓' : '☐') : ''}
                              </span>
                              <span className="truncate">{it.title}</span>
                            </button>
                          );
                        })}
                        {dayItems.length > 2 && (
                          <span className="text-[10px] font-bold text-slate-500 pl-1">
                            +{dayItems.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* MODE 2: WEEK VIEW (7-Day Columns) */}
          {calendarMode === 'week' && (
            <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              {weekCells.map((wc) => {
                const dayItems = getItemsForDate(wc.dateKey);
                const isToday = wc.dateKey === todayKey;
                const isSelected = wc.dateKey === selectedDate;
                return (
                  <div
                    key={wc.dateKey}
                    onClick={() => {
                      setSelectedDate(wc.dateKey);
                      setAgendaMode('selected_day');
                    }}
                    className={`min-h-[140px] sm:min-h-[380px] p-2.5 flex flex-col gap-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/25' : 'bg-white hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100">
                      <div className="flex items-center sm:flex-col sm:items-start gap-1.5 sm:gap-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {wc.dayName}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black ${
                              isToday
                                ? 'bg-blue-600 text-white'
                                : isSelected
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-900'
                            }`}
                          >
                            {wc.dayNum}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {wc.monthShort}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateModal(wc.dateKey, 'event');
                        }}
                        className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0"
                        title={`Add on ${wc.monthShort} ${wc.dayNum}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {dayItems.length === 0 ? (
                      <div className="text-[11px] text-slate-400 py-2 sm:py-6 text-center">
                        Free
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {dayItems.map((it) => {
                          const teamMeta = getTeamMeta(it.team);
                          const fm = getScoutFare2Meta(it.troopGroup);
                          return (
                            <div
                              key={it.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailItemId(it.id);
                              }}
                              className={`p-2 rounded-lg border text-[11px] space-y-1 cursor-pointer transition-colors ${
                                teamMeta
                                  ? teamMeta.chipClass
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-900'
                              }`}
                            >
                              <div className="flex items-start gap-1.5">
                                {it.itemType === 'task' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleTaskComplete(it.id);
                                    }}
                                    className="mt-0.5 shrink-0"
                                  >
                                    {it.completed ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Circle className="w-3.5 h-3.5 text-amber-600" />
                                    )}
                                  </button>
                                )}
                                <span
                                  className={`font-bold leading-snug line-clamp-2 ${
                                    it.itemType === 'task' && it.completed
                                      ? 'line-through opacity-70'
                                      : ''
                                  }`}
                                >
                                  {it.title}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 text-[10px] opacity-85">
                                <span>
                                  {it.allDay ? 'All Day' : formatDisplayTime(it.startTime)}
                                </span>
                                {fm && (
                                  <span
                                    className={`px-1 py-0.2 rounded font-bold ${fm.solidBadgeClass}`}
                                  >
                                    {fm.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* MODE 3: DAY VIEW (Detailed Schedule for Selected Day) */}
          {calendarMode === 'day' && (
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Daily Schedule
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900">
                    {formatDisplayDate(selectedDate)}
                    {selectedDate === todayKey && (
                      <span className="ml-2 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold">
                        Today
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openCreateModal(selectedDate, 'task')}
                    className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>+ Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateModal(selectedDate, 'event')}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Event</span>
                  </button>
                </div>
              </div>

              {selectedDayItems.length === 0 ? (
                <div className="py-12 text-center space-y-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Nothing scheduled on {formatDisplayDate(selectedDate)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Add an event or task for this day, or adjust your active Team / Fare2 filters.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDayItems.map((item) => {
                    const teamMeta = getTeamMeta(item.team);
                    const fm = getScoutFare2Meta(item.troopGroup);
                    const { dateLabel, timeLabel } = formatRangeLabel(item);
                    const isTask = item.itemType === 'task';
                    return (
                      <div
                        key={item.id}
                        onClick={() => setDetailItemId(item.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          teamMeta
                            ? teamMeta.cardClass
                            : 'bg-white border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {isTask && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTaskComplete(item.id);
                              }}
                              className="mt-0.5 shrink-0 cursor-pointer"
                            >
                              {item.completed ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Circle className="w-5 h-5 text-amber-600" />
                              )}
                            </button>
                          )}
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              {teamMeta && (
                                <span
                                  className={`font-bold flex items-center gap-1.5 ${teamMeta.textClass}`}
                                >
                                  <span
                                    className={`w-2.5 h-2.5 rounded-sm shrink-0 ${teamMeta.dotClass}`}
                                  />
                                  <span>{teamMeta.label}</span>
                                </span>
                              )}
                              {fm && (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${fm.solidBadgeClass}`}
                                >
                                  {fm.label}
                                </span>
                              )}
                              {!fm && item.troopGroup && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                                  {item.troopGroup}
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-sm font-black text-slate-900 ${
                                isTask && item.completed ? 'line-through text-slate-500' : ''
                              }`}
                            >
                              {item.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                              <span className="font-mono font-semibold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{timeLabel}</span>
                              </span>
                              {item.endDate && item.endDate !== item.startDate && (
                                <span className="font-mono text-slate-500">{dateLabel}</span>
                              )}
                              {item.assignedToName && (
                                <span className="font-semibold flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{item.assignedToName}</span>
                                </span>
                              )}
                              {item.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{item.location}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadIcs(item);
                          }}
                          className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>.ics</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right/Bottom: Selected Day & Upcoming Schedule + Tasks (Hidden in Day view to prevent duplicate daily schedule) */}
        {calendarMode !== 'day' && (
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  {agendaMode === 'selected_day' ? 'Selected Day Schedule' : 'Upcoming Schedule'}
                </div>
                <h3 className="text-base font-black text-slate-900 mt-0.5">
                  {agendaMode === 'selected_day'
                    ? formatDisplayDate(selectedDate)
                    : 'All Upcoming Events & Tasks'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => openCreateModal(selectedDate, 'event')}
                className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shrink-0 cursor-pointer"
                title={`Add item on ${selectedDate}`}
                aria-label="Add item on selected day"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setAgendaMode('selected_day')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  agendaMode === 'selected_day'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Selected Day ({selectedDayItems.length})
              </button>
              <button
                type="button"
                onClick={() => setAgendaMode('upcoming_all')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  agendaMode === 'upcoming_all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upcoming ({upcomingItems.length})
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[620px] overflow-y-auto">
            {displayedAgendaItems.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <CalendarIcon className="w-9 h-9 text-slate-300 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {agendaMode === 'selected_day'
                      ? `Nothing scheduled on ${formatDisplayDate(selectedDate)}`
                      : 'No upcoming events or tasks match your filters'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Schedule a team event or task with exact dates, times, and assignee.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCreateModal(selectedDate, 'event')}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Event / Task</span>
                </button>
              </div>
            ) : (
              displayedAgendaItems.map((item) => {
                const { dateLabel, timeLabel } = formatRangeLabel(item);
                const isTask = item.itemType === 'task';
                const teamMeta = getTeamMeta(item.team);

                return (
                  <div
                    key={item.id}
                    onClick={() => setDetailItemId(item.id)}
                    className={`rounded-xl border p-3.5 transition-colors cursor-pointer space-y-2 ${
                      teamMeta
                        ? teamMeta.cardClass
                        : 'bg-white border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isTask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTaskComplete(item.id);
                            }}
                            className="mt-0.5 text-slate-700 hover:text-emerald-700 shrink-0 cursor-pointer"
                            title={item.completed ? 'Mark task open' : 'Mark task complete'}
                            aria-label="Toggle task completion"
                          >
                            {item.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Circle className="w-5 h-5 text-amber-600" />
                            )}
                          </button>
                        )}
                        <div className="min-w-0">
                          {/* Clean Unboxed Metadata Line */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 mb-0.5">
                            {teamMeta && (
                              <span className={`font-bold flex items-center gap-1.5 ${teamMeta.textClass}`}>
                                <span
                                  className={`w-2.5 h-2.5 rounded-sm shrink-0 ${teamMeta.dotClass}`}
                                  aria-hidden="true"
                                />
                                <span>{teamMeta.shortLabel}</span>
                              </span>
                            )}
                            {teamMeta && <span aria-hidden="true">·</span>}
                            <span className="font-semibold text-slate-700">
                              {isTask ? (item.completed ? 'Task Done' : 'Task') : 'Event'}
                            </span>
                            {item.troopGroup && (() => {
                              const fm = getScoutFare2Meta(item.troopGroup);
                              return fm ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${fm.solidBadgeClass}`}
                                  >
                                    {fm.label}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{item.troopGroup}</span>
                                </>
                              );
                            })()}
                          </div>

                          <h4
                            className={`text-sm font-bold text-slate-900 leading-snug ${
                              isTask && item.completed ? 'line-through text-slate-500' : ''
                            }`}
                          >
                            {item.title}
                          </h4>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadIcs(item);
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shrink-0 cursor-pointer"
                        title="Add to Mobile Calendar (.ics)"
                        aria-label="Add to Mobile Calendar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>

                    {item.assignedToName && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Assigned to: {item.assignedToName}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-600">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{dateLabel}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{timeLabel}</span>
                      </span>
                    </div>

                    {item.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isFormOpen && (
        <div
          onClick={() => setIsFormOpen(false)}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                  <CalendarPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {editingItem ? 'Edit Schedule Item' : 'New Calendar Event or Task'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Assign a Store Team, specific team member, and date/time window
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              {/* Type Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType('event')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${
                    formType === 'event'
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CalendarIcon className="w-4 h-4" />
                  <span>Calendar Event</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('task')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${
                    formType === 'task'
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ListTodo className="w-4 h-4" />
                  <span>Task / Action Item</span>
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={
                    formType === 'task'
                      ? 'e.g. Purchase 50 rolls of fabric for scout uniforms'
                      : 'e.g. Monthly Store Budget Review'
                  }
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 6 Store Teams Selector with Color Codes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Assigned Store Team
                  </label>
                  {formTeam && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormTeam('');
                        setFormAssignedToId('');
                        setFormAssignedToName('');
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Clear team
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STORE_TEAMS.map((team) => {
                    const isSelected = formTeam === team.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setFormTeam(isSelected ? '' : team.id)}
                        className={`p-2.5 min-h-[44px] rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                          isSelected ? team.activeButtonClass : team.chipClass
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-sm shrink-0 ${
                            isSelected ? 'bg-white' : team.dotClass
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{team.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specific Assigned Team Member */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <label className="block text-xs font-bold text-slate-800">
                  Assigned Team Member (Optional)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={formAssignedToId}
                    onChange={(e) => {
                      const uid = e.target.value;
                      setFormAssignedToId(uid);
                      const matched = activeAccounts.find((u) => u.id === uid);
                      if (matched) {
                        setFormAssignedToName(matched.name);
                      }
                    }}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select Registered Account...</option>
                    {activeAccounts.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={formAssignedToName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormAssignedToName(val);
                      const matched = activeAccounts.find(
                        (u) => u.name.toLowerCase() === val.trim().toLowerCase()
                      );
                      setFormAssignedToId(matched ? matched.id : '');
                    }}
                    placeholder="Or type team member name..."
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {previousTeamAssignees.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] font-semibold text-slate-500">Quick pick:</span>
                    {previousTeamAssignees.slice(0, 6).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setFormAssignedToName(name);
                          const matched = activeAccounts.find(
                            (u) => u.name.toLowerCase() === name.toLowerCase()
                          );
                          setFormAssignedToId(matched ? matched.id : '');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          formAssignedToName.toLowerCase() === name.toLowerCase()
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* From Date -> To Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormStartDate(v);
                      if (!formEndDate || formEndDate < v) setFormEndDate(v);
                    }}
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    To Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={formStartDate}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* All Day Toggle + Time Window */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-slate-800">All-Day Event / Task</span>
                  <input
                    type="checkbox"
                    checked={formAllDay}
                    onChange={(e) => setFormAllDay(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </label>

                {!formAllDay && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        From Time *
                      </label>
                      <input
                        type="time"
                        required={!formAllDay}
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full px-3 py-2 min-h-[44px] rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        To Time *
                      </label>
                      <input
                        type="time"
                        required={!formAllDay}
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full px-3 py-2 min-h-[44px] rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Troop & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Scout Branch (Optional)
                  </label>
                  <select
                    value={formTroop}
                    onChange={(e) => setFormTroop(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Branches / General</option>
                    {TROOP_OPTIONS.map((tr) => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. SPS Scout Store / Church Hall"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Details (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Checklist items, order references, contact notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Save to Calendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail & Mobile Calendar Export Modal */}
      {detailItem && (() => {
        const detailTeam = getTeamMeta(detailItem.team);
        return (
          <div
            onClick={() => {
              setDetailItemId(null);
              setPendingEditItem(null);
              setConfirmDeleteId(null);
            }}
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 mb-1">
                    {detailTeam && (
                      <span className={`font-bold flex items-center gap-1.5 ${detailTeam.textClass}`}>
                        <span
                          className={`w-2.5 h-2.5 rounded-sm shrink-0 ${detailTeam.dotClass}`}
                          aria-hidden="true"
                        />
                        <span>{detailTeam.label}</span>
                      </span>
                    )}
                    {detailTeam && <span aria-hidden="true">·</span>}
                    <span className="font-bold text-slate-800">
                      {detailItem.itemType === 'task'
                        ? detailItem.completed
                          ? 'Task Completed'
                          : 'Task'
                        : 'Calendar Event'}
                    </span>
                    {detailItem.troopGroup && (() => {
                      const fm = getScoutFare2Meta(detailItem.troopGroup);
                      return (
                        <>
                          <span aria-hidden="true">·</span>
                          {fm ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 ${fm.solidBadgeClass}`}
                            >
                              <span>{fm.label}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{detailItem.troopGroup}</span>
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <h2 className="text-lg font-black text-slate-900 leading-snug">
                    {detailItem.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDetailItemId(null);
                    setPendingEditItem(null);
                    setConfirmDeleteId(null);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Team & Assigned Member Breakdown */}
              {(detailTeam || detailItem.assignedToName) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500">Store Team</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1 flex items-center gap-2">
                      {detailTeam ? (
                        <>
                          <span
                            className={`w-3 h-3 rounded-sm shrink-0 ${detailTeam.dotClass}`}
                            aria-hidden="true"
                          />
                          <span className={detailTeam.textClass}>{detailTeam.label}</span>
                        </>
                      ) : (
                        <span>General Store</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500">Assigned Team Member</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{detailItem.assignedToName || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* From -> To Date & Time / Scout Fera2 Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-500">
                    Date Window (From → To)
                  </div>
                  <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 mt-1 flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{formatRangeLabel(detailItem).dateLabel}</span>
                  </div>
                  {(detailItem.team === 'troops' || Boolean(detailItem.troopGroup)) &&
                    !detailItem.allDay && (
                      <div className="text-[11px] font-mono text-slate-600 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{formatRangeLabel(detailItem).timeLabel}</span>
                      </div>
                    )}
                </div>

                {detailItem.team === 'troops' || detailItem.troopGroup ? (() => {
                  const fm = getScoutFare2Meta(detailItem.troopGroup);
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500">
                        Scout Fera2
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {fm ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border ${fm.chipClass}`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: fm.hex }}
                            />
                            <span>{fm.label}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900">
                            <Users className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>{detailItem.troopGroup || 'Unassigned (Choose Fare2)'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500">
                      Time Window (From → To)
                    </div>
                    <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 mt-1 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{formatRangeLabel(detailItem).timeLabel}</span>
                    </div>
                  </div>
                )}
              </div>

              {detailItem.location && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs font-medium text-slate-800">
                  <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{detailItem.location}</span>
                </div>
              )}

              {detailItem.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {detailItem.notes}
                </div>
              )}

              <div className="text-xs text-slate-500">
                Scheduled by <strong className="text-slate-700">{detailItem.createdByName}</strong>
              </div>

              {/* Add to Mobile Calendar Actions */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2.5">
                <div className="text-xs font-bold text-blue-950">
                  Save to Your Phone&apos;s Calendar
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadIcs(detailItem)}
                    className="flex-1 py-2.5 px-4 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Add to Mobile Calendar (.ics)</span>
                  </button>

                  <a
                    href={getGoogleCalendarUrl(detailItem)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 min-h-[44px] rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-blue-300 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                    <span>Google Calendar</span>
                  </a>
                </div>
              </div>

              {/* Task toggle + Edit / Delete */}
              {(() => {
                const detailStage = getItemStage(detailItem);
                const isDone = detailStage === 'done';
                const isInProgress = detailStage === 'in_progress';

                if (confirmDeleteId === detailItem.id && !isInProgress) {
                  return (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-rose-900">
                        Are you sure you want to delete &quot;{detailItem.title}&quot;?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 min-h-[38px] rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const id = detailItem.id;
                            setConfirmDeleteId(null);
                            setDetailItemId(null);
                            onDeleteItem(id);
                          }}
                          className="px-3 py-1.5 min-h-[38px] rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  );
                }

                if (pendingEditItem?.id === detailItem.id && !isDone) {
                  return (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-950">
                        Are you sure you want to edit &quot;{detailItem.title}&quot;?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPendingEditItem(null)}
                          className="px-3 py-1.5 min-h-[38px] rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = pendingEditItem;
                            setPendingEditItem(null);
                            openEditModal(target);
                          }}
                          className="px-3 py-1.5 min-h-[38px] rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
                        >
                          Yes, Edit
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    {detailItem.itemType === 'task' ? (
                      <button
                        type="button"
                        onClick={() => onToggleTaskComplete(detailItem.id)}
                        className={`px-3.5 py-2 min-h-[42px] rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                          detailItem.completed
                            ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{detailItem.completed ? 'Reopen Task' : 'Mark Completed'}</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => setPendingEditItem(detailItem)}
                          className="px-3.5 py-2 min-h-[42px] rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}

                      {isInProgress ? (
                        <span
                          className="px-3 py-2 min-h-[42px] rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-not-allowed"
                          title="In Progress items cannot be deleted. Move to Done first."
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Move to Done to delete</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(detailItem.id)}
                          className="px-3.5 py-2 min-h-[42px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Modal: Scout Seasons / Time Frames Manager (Connected to Budgeting) */}
      {isSeasonsModalOpen && (
        <div
          onClick={() => setIsSeasonsModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Scout Seasons &amp; Time Frames
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set official Scout seasons/terms here — Budgeting automatically tracks revenue, COGS &amp; profit per season.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSeasonsModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Create / Edit Scout Season Form */}
              <form
                onSubmit={handleSaveSeasonSubmit}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-700">
                    {editingSeason ? `Edit Season: ${editingSeason.name}` : 'Add New Scout Season / Time Frame'}
                  </div>
                  {editingSeason && (
                    <button
                      type="button"
                      onClick={() => openSeasonForm()}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      + Create New Instead
                    </button>
                  )}
                </div>

                {seasonError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                    {seasonError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Season / Time Frame Name *
                    </label>
                    <input
                      type="text"
                      value={seasonName}
                      onChange={(e) => setSeasonName(e.target.value)}
                      placeholder="e.g., First Term 2026, Summer Camp Season, Easter Season..."
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={seasonStartDate}
                      onChange={(e) => setSeasonStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={seasonEndDate}
                      onChange={(e) => setSeasonEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-700 mb-1">
                      Color Tag
                    </span>
                    <div className="flex items-center gap-1.5">
                      {SEASON_COLOR_PRESETS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setSeasonColorHex(c.hex)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                            seasonColorHex === c.hex
                              ? 'border-slate-900 scale-110'
                              : 'border-white hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={seasonNotes}
                      onChange={(e) => setSeasonNotes(e.target.value)}
                      placeholder="Key camp or uniform focus..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2.5 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{editingSeason ? 'Save Season Changes' : 'Add Scout Season'}</span>
                  </button>
                </div>
              </form>

              {/* Defined Scout Seasons List */}
              <div className="space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Configured Scout Seasons ({sortedScoutSeasons.length})
                </div>

                {sortedScoutSeasons.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                    No Scout Seasons defined yet. Add your first Scout Season or Time Frame above so Budgeting can group sales &amp; Fare2 revenue by season.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedScoutSeasons.map((s) => (
                      <div
                        key={s.id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full mt-1 shrink-0"
                            style={{ backgroundColor: s.colorHex || '#059669' }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {s.name}
                            </div>
                            <div className="text-xs font-mono tabular-nums text-slate-600 mt-0.5">
                              {s.startDate} → {s.endDate}
                            </div>
                            {s.notes && (
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {s.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {confirmDeleteSeasonId === s.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-rose-700 mr-1">
                              Delete?
                            </span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSeasonId(null)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              No
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteScoutSeason?.(s.id);
                                setConfirmDeleteSeasonId(null);
                                if (editingSeason?.id === s.id) openSeasonForm();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Yes
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setCursorMonth(new Date(parseDateKey(s.startDate).getFullYear(), parseDateKey(s.startDate).getMonth(), 1));
                                setSelectedDate(s.startDate);
                                setIsSeasonsModalOpen(false);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                            >
                              Jump to Date
                            </button>
                            <button
                              type="button"
                              onClick={() => openSeasonForm(s)}
                              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                              title="Edit Season"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteScoutSeason && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSeasonId(s.id)}
                                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                title="Delete Season"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
