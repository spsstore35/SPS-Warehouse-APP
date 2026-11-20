import React, { useMemo, useState } from 'react';
import { CalendarItem, CalendarItemType, StoreTeamId, User } from '../types/inventory';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
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
} from 'lucide-react';

interface CalendarViewProps {
  items: CalendarItem[];
  users?: User[];
  currentUser: User;
  onSaveItem: (item: CalendarItem) => void;
  onDeleteItem: (id: string) => void;
  onToggleTaskComplete: (id: string) => void;
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

export const CalendarView: React.FC<CalendarViewProps> = ({
  items,
  users = [],
  currentUser,
  onSaveItem,
  onDeleteItem,
  onToggleTaskComplete,
  onShowToast,
}) => {
  const todayKey = toDateKey(new Date());

  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [filterType, setFilterType] = useState<'all' | CalendarItemType>('all');
  const [filterTeam, setFilterTeam] = useState<'all' | StoreTeamId>('all');
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

  // Detail & Delete Modal state
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    return items
      .filter((item) => {
        if (filterType !== 'all' && item.itemType !== filterType) return false;
        if (filterTeam !== 'all' && item.team !== filterTeam) return false;
        if (onlyAssignedToMe) {
          const matchesId = item.assignedToId && item.assignedToId === currentUser.id;
          const matchesName =
            item.assignedToName && item.assignedToName.trim().toLowerCase() === myNameLower;
          if (!matchesId && !matchesName) return false;
        }
        if (q) {
          const teamMeta = getTeamMeta(item.team);
          const hay = `${item.title} ${item.notes || ''} ${item.location || ''} ${item.troopGroup || ''} ${teamMeta?.label || ''} ${item.assignedToName || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
  }, [items, filterType, filterTeam, onlyAssignedToMe, searchQuery, currentUser]);

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
    setFormTeam(filterTeam !== 'all' ? filterTeam : '');
    setFormAssignedToId('');
    setFormAssignedToName('');
    setFormTroop('');
    setFormLocation('');
    setFormNotes('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (item: CalendarItem) => {
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

        <div className="flex items-center gap-2 self-start sm:self-auto">
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

        {/* 6 Store Teams Color Filter Bar */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <span className="text-xs font-bold text-slate-500 shrink-0 mr-1">Teams:</span>

          <button
            type="button"
            onClick={() => setFilterTeam('all')}
            className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              filterTeam === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>All Teams</span>
            <span className="font-mono tabular-nums opacity-80">{items.length}</span>
          </button>

          {STORE_TEAMS.map((team) => {
            const isActive = filterTeam === team.id;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setFilterTeam(isActive ? 'all' : team.id)}
                className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 ${
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Month Calendar Grid + Day / Upcoming Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Top: Month Calendar Grid */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Month Controls */}
          <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCursorMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm sm:text-base font-black text-slate-900 px-1 min-w-[140px] text-center">
                {monthTitle}
              </h2>
              <button
                type="button"
                onClick={() =>
                  setCursorMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
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

          {/* Weekday Headers */}
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

          {/* Calendar Cells */}
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
        </div>

        {/* Right/Bottom: Selected Day & Upcoming Schedule + Tasks */}
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
                            {item.troopGroup && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{item.troopGroup}</span>
                              </>
                            )}
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
                    {detailItem.troopGroup && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{detailItem.troopGroup}</span>
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="text-lg font-black text-slate-900 leading-snug">
                    {detailItem.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDetailItemId(null);
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

              {/* From -> To Date & Time Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-500">
                    Date Window (From → To)
                  </div>
                  <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 mt-1 flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{formatRangeLabel(detailItem).dateLabel}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-500">
                    Time Window (From → To)
                  </div>
                  <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 mt-1 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{formatRangeLabel(detailItem).timeLabel}</span>
                  </div>
                </div>
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
              {confirmDeleteId === detailItem.id ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-rose-900">
                    Are you sure you want to delete this item?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1.5 min-h-[38px] rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      No
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
              ) : (
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

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(detailItem)}
                      className="px-3.5 py-2 min-h-[42px] rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(detailItem.id)}
                      className="px-3.5 py-2 min-h-[42px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
