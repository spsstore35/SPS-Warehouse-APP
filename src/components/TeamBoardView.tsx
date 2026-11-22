import React, { useMemo, useRef, useState } from 'react';
import {
  BoardColumnStatus,
  CalendarItem,
  CalendarItemType,
  StoreTeamId,
  User,
} from '../types/inventory';
import { STORE_TEAMS, StoreTeamMeta } from './CalendarView';
import {
  getStoredTeamDirectory,
  saveStoredTeamDirectory,
  getStoredFare2Leaders,
  saveStoredFare2Leaders,
  getStoredUserFare2Map,
  saveStoredUserFare2Map,
  Fare2LeaderAssignment,
} from '../utils/storage';
import { SCOUT_FERA2_LIST, getScoutFare2Meta } from '../utils/scoutFera2';
import {
  Kanban,
  Users,
  Plus,
  Search,
  Clock,
  AlignLeft,
  MapPin,
  ArrowLeft,
  ArrowRight,
  X,
  Pencil,
  Trash2,
  Download,
  ExternalLink,
  Calendar as CalendarIcon,
  ListTodo,
  UserPlus,
  Lock,
} from 'lucide-react';

interface TeamBoardViewProps {
  items: CalendarItem[];
  users: User[];
  currentUser: User;
  onSaveItem: (item: CalendarItem) => void;
  onDeleteItem: (id: string) => void;
  onMoveItemStatus: (id: string, nextStatus: BoardColumnStatus) => void;
  onFare2LeaderChange?: (fare2Id: string, leader: Fare2LeaderAssignment | null) => void;
  onUserTeamsChange?: (userId: string, assignedTeams: StoreTeamId[], assignedFare2: string[]) => void;
  onShowToast?: (msg: string) => void;
}

const TROOP_OPTIONS = [
  'Ashbal',
  'Zahrat',
  'Kashafeen',
  'Morshedat',
  '3ashera 1',
  '3ashera 2',
  'Afrad',
];

const BOARD_COLUMNS: {
  id: BoardColumnStatus;
  title: string;
  emptyText: string;
  headerAccent: string;
}[] = [
  {
    id: 'upcoming',
    title: 'Upcoming',
    emptyText: 'No upcoming cards yet',
    headerAccent: 'text-slate-900',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    emptyText: 'No cards in progress',
    headerAccent: 'text-blue-900',
  },
  {
    id: 'done',
    title: 'Done',
    emptyText: 'No completed cards yet',
    headerAccent: 'text-emerald-900',
  },
];

const TEAM_SOLID_BADGE: Record<StoreTeamId, string> = {
  purchases: 'bg-blue-600 text-white',
  troops: 'bg-emerald-600 text-white',
  inventory: 'bg-amber-500 text-slate-950',
  calendar: 'bg-indigo-600 text-white',
  marketing: 'bg-rose-600 text-white',
  budgeting: 'bg-teal-600 text-white',
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseDateKey = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '';
  return parseDateKey(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatDisplayTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  const [hRaw, mRaw] = timeStr.split(':');
  const h = parseInt(hRaw, 10);
  const m = parseInt(mRaw, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${suffix}`;
};

const getTeamMeta = (teamId?: StoreTeamId): StoreTeamMeta | null =>
  STORE_TEAMS.find((t) => t.id === teamId) || null;

const getInitials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AVATAR_PALETTE = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#4F46E5',
  '#E11D48',
  '#0D9488',
  '#7C3AED',
  '#0284C7',
];

const getAvatarColor = (seed: string, explicitColor?: string): string => {
  if (explicitColor) return explicitColor;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const buildIcsContent = (item: CalendarItem): string => {
  const uid = `${item.id}@sps-warehouse`;
  const teamMeta = getTeamMeta(item.team);
  const descriptionLines = [
    item.itemType === 'task' ? 'Store Task' : 'Store Event',
    teamMeta ? `Team: ${teamMeta.label}` : '',
    item.assignedToName ? `Assigned To: ${item.assignedToName}` : '',
    item.troopGroup ? `Scout Branch: ${item.troopGroup}` : '',
    item.notes || '',
  ]
    .filter(Boolean)
    .join('\\n');

  const escapeText = (t: string) =>
    t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const compactDate = (d: string) => d.replace(/-/g, '');
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let dtStart = '';
  let dtEnd = '';

  if (item.allDay || !item.startTime) {
    const endPlusOne = parseDateKey(item.endDate || item.startDate);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    dtStart = `DTSTART;VALUE=DATE:${compactDate(item.startDate)}`;
    dtEnd = `DTEND;VALUE=DATE:${compactDate(toDateKey(endPlusOne))}`;
  } else {
    const sTime = (item.startTime || '09:00').replace(':', '') + '00';
    const eTime = (item.endTime || item.startTime || '10:00').replace(':', '') + '00';
    dtStart = `DTSTART:${compactDate(item.startDate)}T${sTime}`;
    dtEnd = `DTEND:${compactDate(item.endDate || item.startDate)}T${eTime}`;
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SPS Warehouse//Team Board//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowUtc}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeText(item.title)}`,
    descriptionLines ? `DESCRIPTION:${escapeText(descriptionLines)}` : '',
    item.location ? `LOCATION:${escapeText(item.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
};

const getGoogleCalendarUrl = (item: CalendarItem): string => {
  const compactDate = (d: string) => d.replace(/-/g, '');
  let dates = '';
  if (item.allDay || !item.startTime) {
    const endPlusOne = parseDateKey(item.endDate || item.startDate);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    dates = `${compactDate(item.startDate)}/${compactDate(toDateKey(endPlusOne))}`;
  } else {
    const sTime = (item.startTime || '09:00').replace(':', '') + '00';
    const eTime = (item.endTime || item.startTime || '10:00').replace(':', '') + '00';
    dates = `${compactDate(item.startDate)}T${sTime}/${compactDate(item.endDate || item.startDate)}T${eTime}`;
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates,
    details: item.notes || '',
    location: item.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const TeamBoardView: React.FC<TeamBoardViewProps> = ({
  items,
  users,
  currentUser,
  onSaveItem,
  onDeleteItem,
  onMoveItemStatus,
  onFare2LeaderChange,
  onUserTeamsChange,
  onShowToast,
}) => {
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // Top Workspace Tabs: 'board' vs 'people'
  const [activeTab, setActiveTab] = useState<'board' | 'people'>('board');

  // Board filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeam, setFilterTeam] = useState<StoreTeamId | 'all'>('all');
  const [filterFare2, setFilterFare2] = useState<string>('all');
  const [isHoveringScoutFera2, setIsHoveringScoutFera2] = useState(false);
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
  const [filterType, setFilterType] = useState<'all' | CalendarItemType>('all');
  const [filterMemberName, setFilterMemberName] = useState<string>('all');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<BoardColumnStatus | null>(null);

  // People & Teams tab state
  const [peopleSubView, setPeopleSubView] = useState<'by-team' | 'all-people'>('by-team');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [teamDirectory, setTeamDirectory] = useState<Record<string, StoreTeamId[]>>(() =>
    getStoredTeamDirectory()
  );
  const [userFare2Map, setUserFare2Map] = useState<Record<string, string[]>>(() =>
    getStoredUserFare2Map()
  );
  const [fare2Leaders, setFare2Leaders] = useState<Record<string, Fare2LeaderAssignment>>(() =>
    getStoredFare2Leaders()
  );

  // Modals: Detail, Edit Confirm, Delete Confirm, Stage Confirm, Member Profile & Form
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [pendingEditItem, setPendingEditItem] = useState<CalendarItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<CalendarItem | null>(null);
  const [pendingStageMove, setPendingStageMove] = useState<{
    item: CalendarItem;
    nextStatus: BoardColumnStatus;
  } | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<CalendarItemType>('task');
  const [formBoardStatus, setFormBoardStatus] = useState<BoardColumnStatus>('upcoming');
  const [formStartDate, setFormStartDate] = useState(todayKey);
  const [formEndDate, setFormEndDate] = useState(todayKey);
  const [formAllDay, setFormAllDay] = useState(false);
  const [formStartTime, setFormStartTime] = useState('10:00');
  const [formEndTime, setFormEndTime] = useState('12:00');
  const [formTeam, setFormTeam] = useState<StoreTeamId | ''>('purchases');
  const [formAssignedToId, setFormAssignedToId] = useState('');
  const [formAssignedToName, setFormAssignedToName] = useState('');
  const [formTroop, setFormTroop] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Active non-leader team members
  const activeMembers = useMemo(
    () =>
      users
        .filter((u) => u.status === 'active' && u.role !== 'leader')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  // Determine each item's effective column ('upcoming' | 'in_progress' | 'done')
  const getItemColumn = (item: CalendarItem): BoardColumnStatus => {
    if (item.completed || item.boardStatus === 'done') return 'done';
    if (item.boardStatus === 'in_progress') return 'in_progress';
    if (item.boardStatus === 'upcoming') return 'upcoming';
    if (item.startDate <= todayKey && (item.endDate || item.startDate) >= todayKey) {
      return 'in_progress';
    }
    return 'upcoming';
  };

  // Filtered board items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => {
        if (filterTeam !== 'all' && item.team !== filterTeam) return false;
        if (filterFare2 !== 'all') {
          if ((item.troopGroup || '').trim().toLowerCase() !== filterFare2.toLowerCase()) {
            return false;
          }
        }
        if (filterType !== 'all' && item.itemType !== filterType) return false;
        if (filterMemberName !== 'all') {
          const itemAssignee = (item.assignedToName || '').trim().toLowerCase();
          if (itemAssignee !== filterMemberName.toLowerCase()) return false;
        }
        if (q) {
          const teamMeta = getTeamMeta(item.team);
          const fare2Meta = getScoutFare2Meta(item.troopGroup);
          const matchedAssignee = activeMembers.find(
            (u) =>
              (item.assignedToId && u.id === item.assignedToId) ||
              (item.assignedToName &&
                u.name.trim().toLowerCase() === item.assignedToName.trim().toLowerCase())
          );
          const hay = `${item.title} ${item.itemType} ${item.notes || ''} ${item.location || ''} ${item.troopGroup || ''} ${fare2Meta?.audience || ''} ${teamMeta?.label || ''} ${item.assignedToName || ''} ${matchedAssignee?.name || ''} ${matchedAssignee?.email || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [items, filterTeam, filterFare2, filterType, filterMemberName, searchQuery, activeMembers]);

  const itemsByColumn = useMemo(() => {
    const grouped: Record<BoardColumnStatus, CalendarItem[]> = {
      upcoming: [],
      in_progress: [],
      done: [],
    };
    filteredItems.forEach((item) => {
      grouped[getItemColumn(item)].push(item);
    });
    return grouped;
  }, [filteredItems, todayKey]);

  const detailItem = useMemo(
    () => items.find((i) => i.id === detailItemId) || null,
    [items, detailItemId]
  );

  // Build effective teams per user (saved in profile/directory OR inferred from assigned items/fare2 leaders)
  const effectiveUserTeams = useMemo(() => {
    const map = new Map<string, Set<StoreTeamId>>();
    activeMembers.forEach((u) => {
      const saved = teamDirectory[u.id] ?? u.assignedTeams ?? [];
      map.set(u.id, new Set(saved));
    });
    Object.values(fare2Leaders).forEach((leader) => {
      if (leader?.userId && map.has(leader.userId)) {
        map.get(leader.userId)?.add('troops');
      }
    });
    items.forEach((it) => {
      if (!it.team) return;
      const matched = activeMembers.find(
        (u) =>
          (it.assignedToId && u.id === it.assignedToId) ||
          (it.assignedToName &&
            u.name.trim().toLowerCase() === it.assignedToName.trim().toLowerCase())
      );
      if (matched) {
        map.get(matched.id)?.add(it.team);
      }
    });
    return map;
  }, [activeMembers, teamDirectory, fare2Leaders, items]);

  // Build effective Scout Fare2 assignments per user (saved in profile/localStorage OR leader assignment)
  const effectiveUserFare2 = useMemo(() => {
    const map = new Map<string, Set<string>>();
    activeMembers.forEach((u) => {
      const saved = userFare2Map[u.id] ?? u.assignedFare2 ?? [];
      map.set(u.id, new Set(saved));
    });
    Object.entries(fare2Leaders).forEach(([fare2Id, leader]) => {
      if (leader?.userId && map.has(leader.userId)) {
        map.get(leader.userId)?.add(fare2Id);
      }
    });
    return map;
  }, [activeMembers, userFare2Map, fare2Leaders]);

  const toggleUserTeam = (userId: string, teamId: StoreTeamId) => {
    const currentTeams = new Set(teamDirectory[userId] ?? Array.from(effectiveUserTeams.get(userId) || []));
    const wasRemoved = currentTeams.has(teamId);
    if (wasRemoved) {
      currentTeams.delete(teamId);
    } else {
      currentTeams.add(teamId);
    }
    const nextTeamsList = Array.from(currentTeams);
    const nextDir = { ...teamDirectory, [userId]: nextTeamsList };
    setTeamDirectory(nextDir);
    saveStoredTeamDirectory(nextDir);

    let nextFare2List = Array.from(effectiveUserFare2.get(userId) || []);
    if (teamId === 'troops' && wasRemoved) {
      nextFare2List = [];
      const nextF2Map = { ...userFare2Map, [userId]: [] };
      setUserFare2Map(nextF2Map);
      saveStoredUserFare2Map(nextF2Map);
    }

    onUserTeamsChange?.(userId, nextTeamsList, nextFare2List);
  };

  const assignUserToTeam = (userId: string, teamId: StoreTeamId) => {
    const currentTeams = new Set(teamDirectory[userId] ?? Array.from(effectiveUserTeams.get(userId) || []));
    currentTeams.add(teamId);
    const nextTeamsList = Array.from(currentTeams);
    const nextDir = { ...teamDirectory, [userId]: nextTeamsList };
    setTeamDirectory(nextDir);
    saveStoredTeamDirectory(nextDir);

    const nextFare2List = Array.from(effectiveUserFare2.get(userId) || []);
    onUserTeamsChange?.(userId, nextTeamsList, nextFare2List);

    const u = activeMembers.find((m) => m.id === userId);
    const t = getTeamMeta(teamId);
    if (u && t) {
      onShowToast?.(`Assigned ${u.name} to ${t.label}.`);
    }
  };

  const toggleUserFare2 = (userId: string, fare2Id: string) => {
    const currentFare2 = new Set(userFare2Map[userId] ?? Array.from(effectiveUserFare2.get(userId) || []));
    const adding = !currentFare2.has(fare2Id);
    if (adding) {
      currentFare2.add(fare2Id);
    } else {
      currentFare2.delete(fare2Id);
    }
    const nextFare2List = Array.from(currentFare2);
    const nextF2Map = { ...userFare2Map, [userId]: nextFare2List };
    setUserFare2Map(nextF2Map);
    saveStoredUserFare2Map(nextF2Map);

    // Ensure user is in Scout Fera2 team when adding a Fare2
    const currentTeams = new Set(teamDirectory[userId] ?? Array.from(effectiveUserTeams.get(userId) || []));
    if (adding) {
      currentTeams.add('troops');
    }
    const nextTeamsList = Array.from(currentTeams);
    const nextDir = { ...teamDirectory, [userId]: nextTeamsList };
    setTeamDirectory(nextDir);
    saveStoredTeamDirectory(nextDir);

    onUserTeamsChange?.(userId, nextTeamsList, nextFare2List);

    const u = activeMembers.find((m) => m.id === userId);
    const fm = getScoutFare2Meta(fare2Id);
    if (u && fm) {
      onShowToast?.(
        adding
          ? `Assigned ${u.name} to Scout Fera2 → ${fm.label} (${fm.audience}).`
          : `Removed ${fm.label} from ${u.name}.`
      );
    }
  };

  const handleSetFare2Leader = (fare2Id: string, userId: string) => {
    const user = activeMembers.find((m) => m.id === userId) || null;
    const nextMap = { ...fare2Leaders };
    let assignment: Fare2LeaderAssignment | null = null;

    if (user) {
      assignment = { userId: user.id, userName: user.name };
      nextMap[fare2Id] = assignment;
      // Ensure this leader is also linked inside Scout Fera2 team AND assigned to this Fare2
      const currentTeams = new Set(teamDirectory[user.id] ?? Array.from(effectiveUserTeams.get(user.id) || []));
      currentTeams.add('troops');
      const nextTeamsList = Array.from(currentTeams);
      const updatedDir = { ...teamDirectory, [user.id]: nextTeamsList };
      setTeamDirectory(updatedDir);
      saveStoredTeamDirectory(updatedDir);

      const currentF2 = new Set(userFare2Map[user.id] ?? Array.from(effectiveUserFare2.get(user.id) || []));
      currentF2.add(fare2Id);
      const nextF2List = Array.from(currentF2);
      const updatedF2Map = { ...userFare2Map, [user.id]: nextF2List };
      setUserFare2Map(updatedF2Map);
      saveStoredUserFare2Map(updatedF2Map);

      onUserTeamsChange?.(user.id, nextTeamsList, nextF2List);
    } else {
      delete nextMap[fare2Id];
    }

    setFare2Leaders(nextMap);
    saveStoredFare2Leaders(nextMap);
    onFare2LeaderChange?.(fare2Id, assignment);

    const fMeta = getScoutFare2Meta(fare2Id);
    if (user && fMeta) {
      onShowToast?.(
        `Assigned ${user.name} as responsible for ${fMeta.label} (${fMeta.audience}) under Scout Fera2.`
      );
    } else if (fMeta) {
      onShowToast?.(`Cleared responsible leader for ${fMeta.label}.`);
    }
  };

  // Open Create Card modal for a specific column
  const openCreateCardModal = (
    targetCol: BoardColumnStatus = 'upcoming',
    presetTeam?: StoreTeamId,
    presetAssignee?: User
  ) => {
    setEditingItem(null);
    setFormTitle('');
    setFormType('task');
    setFormBoardStatus(targetCol);
    setFormStartDate(todayKey);
    setFormEndDate(todayKey);
    setFormAllDay(false);
    setFormStartTime('10:00');
    setFormEndTime('12:00');
    setFormTeam(presetTeam || (filterTeam !== 'all' ? filterTeam : 'purchases'));
    setFormAssignedToId(presetAssignee?.id || '');
    setFormAssignedToName(presetAssignee?.name || '');
    setFormTroop('');
    setFormLocation('');
    setFormNotes('');
    setFormError('');
    setIsFormOpen(true);
  };

  const requestEditCard = (item: CalendarItem) => {
    if (getItemColumn(item) === 'done') {
      onShowToast?.('Completed (Done) cards cannot be edited.');
      return;
    }
    setPendingEditItem(item);
  };

  const requestDeleteCard = (item: CalendarItem) => {
    if (getItemColumn(item) === 'in_progress') {
      onShowToast?.('In Progress cards cannot be deleted. Move to Done first.');
      return;
    }
    setPendingDeleteItem(item);
  };

  const openEditCardModal = (item: CalendarItem) => {
    if (getItemColumn(item) === 'done') return;
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(item.itemType);
    setFormBoardStatus(getItemColumn(item));
    setFormStartDate(item.startDate);
    setFormEndDate(item.endDate || item.startDate);
    setFormAllDay(item.allDay);
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
      setFormError('Please enter a card title.');
      return;
    }
    if (!formStartDate) {
      setFormError('Please choose a date.');
      return;
    }
    const effectiveEndDate = formEndDate && formEndDate >= formStartDate ? formEndDate : formStartDate;
    const nowIso = new Date().toISOString();

    const matchedUser = activeMembers.find(
      (u) =>
        u.id === formAssignedToId ||
        (formAssignedToName.trim() &&
          u.name.trim().toLowerCase() === formAssignedToName.trim().toLowerCase())
    );

    const saved: CalendarItem = {
      id: editingItem ? editingItem.id : `cal_${Date.now()}`,
      title: formTitle.trim(),
      itemType: formType,
      startDate: formStartDate,
      endDate: effectiveEndDate,
      startTime: formAllDay ? undefined : formStartTime || '10:00',
      endTime: formAllDay ? undefined : formEndTime || '12:00',
      allDay: formAllDay,
      completed: formBoardStatus === 'done',
      boardStatus: formBoardStatus,
      team: formTeam || undefined,
      assignedToId: matchedUser?.id || formAssignedToId || undefined,
      assignedToName: matchedUser?.name || formAssignedToName.trim() || undefined,
      troopGroup: formTroop || undefined,
      location: formLocation.trim() || undefined,
      notes: formNotes.trim() || undefined,
      createdById: editingItem ? editingItem.createdById : currentUser.id,
      createdByName: editingItem ? editingItem.createdByName : currentUser.name,
      createdAt: editingItem ? editingItem.createdAt : nowIso,
      updatedAt: nowIso,
    };

    onSaveItem(saved);
    setIsFormOpen(false);
  };

  const handleDownloadIcs = (item: CalendarItem) => {
    const ics = buildIcsContent(item);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${item.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onShowToast?.('Calendar file downloaded (.ics).');
  };

  // Request confirmation before changing board stage (Upcoming -> In Progress -> Done)
  const requestStageMove = (item: CalendarItem, nextStatus: BoardColumnStatus) => {
    if (getItemColumn(item) === nextStatus) return;
    setPendingStageMove({ item, nextStatus });
  };

  // Drag & drop handlers
  const handleDropOnColumn = (targetCol: BoardColumnStatus) => {
    setDragOverCol(null);
    if (!draggedItemId) return;
    const item = items.find((i) => i.id === draggedItemId);
    setDraggedItemId(null);
    if (!item) return;
    requestStageMove(item, targetCol);
  };

  const selectedMember = useMemo(
    () => activeMembers.find((m) => m.id === selectedMemberId) || null,
    [activeMembers, selectedMemberId]
  );

  const selectedMemberEvents = useMemo(() => {
    if (!selectedMember) return { current: [] as CalendarItem[], past: [] as CalendarItem[] };
    const nameLower = selectedMember.name.trim().toLowerCase();
    const assigned = items
      .filter(
        (it) =>
          (it.assignedToId && it.assignedToId === selectedMember.id) ||
          (it.assignedToName && it.assignedToName.trim().toLowerCase() === nameLower)
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    const current: CalendarItem[] = [];
    const past: CalendarItem[] = [];
    assigned.forEach((it) => {
      const col = getItemColumn(it);
      const isPastDate = (it.endDate || it.startDate) < todayKey;
      if (col === 'done' || isPastDate) {
        past.push(it);
      } else {
        current.push(it);
      }
    });
    return { current, past };
  }, [selectedMember, items, todayKey]);

  // Helper to get per-user stats
  const getUserStats = (user: User, teamFilter?: StoreTeamId) => {
    const nameLower = user.name.trim().toLowerCase();
    const userItems = items.filter((it) => {
      if (teamFilter && it.team !== teamFilter) return false;
      return (
        (it.assignedToId && it.assignedToId === user.id) ||
        (it.assignedToName && it.assignedToName.trim().toLowerCase() === nameLower)
      );
    });
    return {
      total: userItems.length,
      upcoming: userItems.filter((i) => getItemColumn(i) === 'upcoming').length,
      inProgress: userItems.filter((i) => getItemColumn(i) === 'in_progress').length,
      done: userItems.filter((i) => getItemColumn(i) === 'done').length,
      items: userItems,
    };
  };

  const doesItemMatchQuery = (item: CalendarItem, qLower: string): boolean => {
    const tm = getTeamMeta(item.team);
    const fm = getScoutFare2Meta(item.troopGroup);
    const hay = `${item.title} ${item.itemType} ${item.notes || ''} ${item.location || ''} ${item.troopGroup || ''} ${fm?.audience || ''} ${tm?.label || ''} ${item.assignedToName || ''}`.toLowerCase();
    return hay.includes(qLower);
  };

  const doesMemberMatchQuery = (member: User, qLower: string): boolean => {
    if (
      member.name.toLowerCase().includes(qLower) ||
      member.email.toLowerCase().includes(qLower)
    ) {
      return true;
    }
    const teams = Array.from(effectiveUserTeams.get(member.id) || new Set<StoreTeamId>());
    if (
      teams.some((tid) => {
        const tm = getTeamMeta(tid);
        return tm ? tm.label.toLowerCase().includes(qLower) || tm.shortLabel.toLowerCase().includes(qLower) : false;
      })
    ) {
      return true;
    }
    const fare2s = Array.from(effectiveUserFare2.get(member.id) || new Set<string>());
    if (
      fare2s.some((fid) => {
        const fm = getScoutFare2Meta(fid);
        return (
          fid.toLowerCase().includes(qLower) ||
          (fm ? `${fm.label} ${fm.audience}`.toLowerCase().includes(qLower) : false)
        );
      })
    ) {
      return true;
    }
    const memberNameLower = member.name.trim().toLowerCase();
    return items.some((it) => {
      const isAssigned =
        (it.assignedToId && it.assignedToId === member.id) ||
        (it.assignedToName && it.assignedToName.trim().toLowerCase() === memberNameLower);
      return isAssigned && doesItemMatchQuery(it, qLower);
    });
  };

  const filteredPeople = useMemo(() => {
    const q = peopleSearch.trim().toLowerCase();
    if (!q) return activeMembers;
    return activeMembers.filter((u) => doesMemberMatchQuery(u, q));
  }, [activeMembers, peopleSearch, effectiveUserTeams, effectiveUserFare2, items]);

  return (
    <div className="space-y-5">
      {/* Top Project Management / Team Board Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Team Board &amp; People
              </h1>
              <p className="text-xs text-slate-500">
                Synced directly with Calendar Events &amp; Tasks across all 6 Store Teams
              </p>
            </div>

            {/* Two Primary Workspace Tabs: Board | People & Teams */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 ml-0 sm:ml-2">
              <button
                type="button"
                onClick={() => setActiveTab('board')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all min-h-[38px] ${
                  activeTab === 'board'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Kanban className="w-3.5 h-3.5 text-blue-600" />
                <span>Board</span>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  ({items.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('people')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all min-h-[38px] ${
                  activeTab === 'people'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>People &amp; Teams</span>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  ({activeMembers.length})
                </span>
              </button>
            </div>
          </div>

          {/* Right side: Member Avatar Stack + Add Card CTA */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
            {activeTab === 'board' && activeMembers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center -space-x-2">
                  {activeMembers.slice(0, 7).map((member) => {
                    const isSelected =
                      filterMemberName.toLowerCase() === member.name.trim().toLowerCase();
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() =>
                          setFilterMemberName(isSelected ? 'all' : member.name)
                        }
                        title={`Filter cards for ${member.name}`}
                        className={`w-8 h-8 rounded-full text-white text-[11px] font-black flex items-center justify-center border-2 transition-transform hover:scale-110 hover:z-10 ${
                          isSelected
                            ? 'border-slate-900 ring-2 ring-blue-500 z-10 scale-110'
                            : 'border-white'
                        }`}
                        style={{
                          backgroundColor: getAvatarColor(member.name, member.avatarColor),
                        }}
                      >
                        {getInitials(member.name)}
                      </button>
                    );
                  })}
                </div>
                {filterMemberName !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterMemberName('all')}
                    className="ml-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1"
                  >
                    <span>{filterMemberName}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => openCreateCardModal('upcoming')}
              className="px-4 py-2.5 min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Card</span>
            </button>
          </div>
        </div>

        {/* Filter Bar for TAB 1: BOARD */}
        {activeTab === 'board' && (
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks, events, account names, or branch..."
                  className="w-full pl-9 pr-8 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                  {(['all', 'task', 'event'] as const).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setFilterType(tp)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                        filterType === tp
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tp === 'all' ? 'All' : tp === 'task' ? 'Tasks' : 'Events'}
                    </button>
                  ))}
                </div>

                {(filterTeam !== 'all' ||
                  filterFare2 !== 'all' ||
                  filterType !== 'all' ||
                  filterMemberName !== 'all' ||
                  searchQuery.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTeam('all');
                      setFilterFare2('all');
                      setFilterType('all');
                      setFilterMemberName('all');
                      setSearchQuery('');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* 6 Color-Coded Team Filter Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => {
                  setFilterTeam('all');
                  setFilterFare2('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors ${
                  filterTeam === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Teams
              </button>
              {STORE_TEAMS.map((team) => {
                const isSelected = filterTeam === team.id;
                const isScoutFera2Team = team.id === 'troops';
                return (
                  <button
                    key={team.id}
                    type="button"
                    onMouseEnter={isScoutFera2Team ? openScoutFera2Hover : undefined}
                    onMouseLeave={isScoutFera2Team ? closeScoutFera2HoverDelayed : undefined}
                    onClick={() => {
                      const nextTeam = isSelected ? 'all' : team.id;
                      setFilterTeam(nextTeam);
                      if (nextTeam !== 'troops') setFilterFare2('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                      isSelected ? team.activeButtonClass : team.chipClass
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-white' : team.dotClass
                      }`}
                    />
                    <span>{team.shortLabel}</span>
                    {isScoutFera2Team && (
                      <span className="text-[10px] opacity-75 ml-0.5">
                        {filterTeam === 'troops' || filterFare2 !== 'all' || isHoveringScoutFera2
                          ? '▴'
                          : '▾'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 6 Color-Coded Scout Fera2 Sub-Team Filter Bar (shown only when hovering or selecting Scout Fera2) */}
            {(filterTeam === 'troops' || filterFare2 !== 'all' || isHoveringScoutFera2) && (
              <div
                onMouseEnter={openScoutFera2Hover}
                onMouseLeave={closeScoutFera2HoverDelayed}
                className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none pt-1.5 border-t border-slate-100 animate-in fade-in duration-150"
              >
                <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap shrink-0 mr-1">
                  Scout Fera2:
                </span>
                {SCOUT_FERA2_LIST.map((f) => {
                  const isSelected = filterFare2.toLowerCase() === f.id.toLowerCase();
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setFilterFare2('all');
                        } else {
                          setFilterTeam('troops');
                          setFilterFare2(f.id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                        isSelected ? f.activeButtonClass : f.chipClass
                      }`}
                      title={`${f.label} — ${f.audience}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSelected ? 'bg-white' : f.dotClass
                        }`}
                      />
                      <span>{f.label}</span>
                      <span className="opacity-75 font-medium">({f.audience})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================
          TAB 1: TRELLO / KANBAN BOARD (Upcoming | In Progress | Done)
      ================================================================ */}
      {activeTab === 'board' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {BOARD_COLUMNS.map((col, colIndex) => {
            const colItems = itemsByColumn[col.id];
            const isOver = dragOverCol === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverCol !== col.id) setDragOverCol(col.id);
                }}
                onDragLeave={() => {
                  if (dragOverCol === col.id) setDragOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnColumn(col.id);
                }}
                className={`rounded-2xl p-3.5 border transition-colors flex flex-col gap-3 min-h-[260px] ${
                  isOver
                    ? 'bg-blue-50/70 border-blue-400'
                    : 'bg-slate-100/90 border-slate-200/90'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h2 className={`text-sm font-black tracking-tight ${col.headerAccent}`}>
                      {col.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-mono tabular-nums font-bold text-slate-700">
                      {colItems.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateCardModal(col.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/80 transition-colors"
                    title={`Add card to ${col.title}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 flex-1">
                  {colItems.length === 0 ? (
                    <div className="py-8 px-3 rounded-xl border border-dashed border-slate-300 bg-white/50 text-center text-xs text-slate-500">
                      {col.emptyText}
                    </div>
                  ) : (
                    colItems.map((item) => {
                      const teamMeta = getTeamMeta(item.team);
                      const isOverdue = col.id !== 'done' && (item.endDate || item.startDate) < todayKey;
                      const matchedUser = activeMembers.find(
                        (u) =>
                          (item.assignedToId && u.id === item.assignedToId) ||
                          (item.assignedToName &&
                            u.name.trim().toLowerCase() ===
                              item.assignedToName.trim().toLowerCase())
                      );
                      const assigneeLabel = item.assignedToName || matchedUser?.name;
                      const dateBadgeClass =
                        col.id === 'done' || col.id === 'in_progress'
                          ? 'bg-emerald-600 text-white'
                          : isOverdue
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-200';

                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggedItemId(item.id)}
                          onDragEnd={() => {
                            setDraggedItemId(null);
                            setDragOverCol(null);
                          }}
                          onClick={() => setDetailItemId(item.id)}
                          className="bg-white rounded-xl border border-slate-200/95 p-3.5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer space-y-2.5 group"
                        >
                          {/* Top Colored Labels Row */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {teamMeta && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${TEAM_SOLID_BADGE[teamMeta.id]}`}
                              >
                                {teamMeta.shortLabel}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                item.itemType === 'task'
                                  ? 'bg-sky-50 text-sky-900 border-sky-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.itemType === 'task' ? 'Task' : 'Event'}
                            </span>
                            {item.troopGroup && (() => {
                              const fare2Meta = getScoutFare2Meta(item.troopGroup);
                              return fare2Meta ? (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${fare2Meta.solidBadgeClass}`}
                                  title={`${fare2Meta.label} (${fare2Meta.audience})`}
                                >
                                  <span>{fare2Meta.label}</span>
                                  <span className="opacity-85 font-medium text-[10px]">
                                    · {fare2Meta.audience}
                                  </span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {item.troopGroup}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Card Title */}
                          <div
                            className={`text-sm font-bold leading-snug ${
                              col.id === 'done'
                                ? 'text-slate-600 line-through decoration-slate-400'
                                : 'text-slate-900'
                            }`}
                          >
                            {item.title}
                          </div>

                          {/* Card Footer Metadata & Quick Move Controls */}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums ${dateBadgeClass}`}
                              >
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>{formatShortDate(item.startDate)}</span>
                              </span>

                              {item.notes && (
                                <span
                                  className="text-slate-400 inline-flex items-center"
                                  title="Has notes"
                                >
                                  <AlignLeft className="w-3.5 h-3.5" />
                                </span>
                              )}

                              {item.location && (
                                <span
                                  className="text-slate-400 inline-flex items-center"
                                  title={item.location}
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Quick Stage Move Buttons for Touch/Mobile & 1-click desktop */}
                              <div
                                className="flex items-center gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {colIndex > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestStageMove(
                                        item,
                                        BOARD_COLUMNS[colIndex - 1].id
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                                    title={`Move back to ${BOARD_COLUMNS[colIndex - 1].title}`}
                                  >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {colIndex < BOARD_COLUMNS.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestStageMove(
                                        item,
                                        BOARD_COLUMNS[colIndex + 1].id
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                                    title={`Move to ${BOARD_COLUMNS[colIndex + 1].title}`}
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Assignee Avatar */}
                              {assigneeLabel && (
                                <span
                                  title={assigneeLabel}
                                  className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center border border-white shadow-2xs"
                                  style={{
                                    backgroundColor: getAvatarColor(
                                      assigneeLabel,
                                      matchedUser?.avatarColor
                                    ),
                                  }}
                                >
                                  {getInitials(assigneeLabel)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Column Bottom "+ Add another card" Button */}
                <button
                  type="button"
                  onClick={() => openCreateCardModal(col.id)}
                  className="w-full py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white/90 border border-transparent hover:border-slate-200 flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add another card</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================
          TAB 2: PEOPLE & TEAMS DIRECTORY ACROSS ALL 6 STORE TEAMS
      ================================================================ */}
      {activeTab === 'people' && (
        <div className="space-y-4">
          {/* Controls bar for People & Teams (Unified Search across Tasks, Events, Accounts, Teams & Fare2) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPeopleSubView('by-team')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    peopleSubView === 'by-team'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Store Team (6 Teams)
                </button>
                <button
                  type="button"
                  onClick={() => setPeopleSubView('all-people')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    peopleSubView === 'all-people'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All People ({activeMembers.length})
                </button>
              </div>
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="Search task, event, account name, team, or Fare2..."
                className="w-full pl-9 pr-8 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              />
              {peopleSearch && (
                <button
                  type="button"
                  onClick={() => setPeopleSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Sub-view A: Grouped by the 6 Store Teams */}
          {peopleSubView === 'by-team' && (() => {
            const q = peopleSearch.trim().toLowerCase();
            const matchingTeams = STORE_TEAMS.filter((team) => {
              if (!q) return true;
              const teamMatches =
                team.label.toLowerCase().includes(q) ||
                team.shortLabel.toLowerCase().includes(q);
              const membersInTeam = activeMembers.filter((u) =>
                effectiveUserTeams.get(u.id)?.has(team.id)
              );
              const hasMatchingMember = membersInTeam.some((m) =>
                doesMemberMatchQuery(m, q)
              );
              const teamCards = items.filter((it) => it.team === team.id);
              const hasMatchingCard = teamCards.some((it) => doesItemMatchQuery(it, q));
              const hasMatchingFare2 =
                team.id === 'troops' &&
                SCOUT_FERA2_LIST.some((f) => {
                  const leader = fare2Leaders[f.id];
                  return (
                    `${f.label} ${f.audience}`.toLowerCase().includes(q) ||
                    (leader?.userName || '').toLowerCase().includes(q)
                  );
                });
              return teamMatches || hasMatchingMember || hasMatchingCard || hasMatchingFare2;
            });

            if (matchingTeams.length === 0) {
              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                  No teams, accounts, tasks, or events match "{peopleSearch}".
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {matchingTeams.map((team) => {
                  const allMembersInTeam = activeMembers.filter((u) =>
                    effectiveUserTeams.get(u.id)?.has(team.id)
                  );
                  const teamMatchesDirectly =
                    !q ||
                    team.label.toLowerCase().includes(q) ||
                    team.shortLabel.toLowerCase().includes(q);
                  const membersInTeam = q && !teamMatchesDirectly
                    ? allMembersInTeam.filter((m) => doesMemberMatchQuery(m, q))
                    : allMembersInTeam;
                  const unassignedToThisTeam = activeMembers.filter(
                    (u) => !effectiveUserTeams.get(u.id)?.has(team.id)
                  );
                  const teamCards = items.filter((it) => it.team === team.id);
                  const matchingCards = q
                    ? teamCards.filter((it) => doesItemMatchQuery(it, q))
                    : [];
                  const teamOpenCount = teamCards.filter(
                    (it) => getItemColumn(it) !== 'done'
                  ).length;

                  return (
                    <div
                      key={team.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        {/* Team Header */}
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-3.5 h-3.5 rounded-full shrink-0 ${team.dotClass}`}
                            />
                            <div>
                              <h3 className="text-sm font-black text-slate-900">
                                {team.label}
                              </h3>
                              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {allMembersInTeam.length} member{allMembersInTeam.length === 1 ? '' : 's'} ·{' '}
                                {teamOpenCount} active card{teamOpenCount === 1 ? '' : 's'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFilterTeam(team.id);
                              setActiveTab('board');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 shrink-0"
                          >
                            View Board
                          </button>
                        </div>

                        {/* Matching Tasks / Events Preview when searching */}
                        {q && matchingCards.length > 0 && (
                          <div className="space-y-1.5 p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80">
                            <div className="text-[10px] font-black uppercase tracking-wider text-blue-800">
                              Matching Tasks / Events ({matchingCards.length})
                            </div>
                            <div className="space-y-1">
                              {matchingCards.slice(0, 4).map((card) => (
                                <button
                                  key={card.id}
                                  type="button"
                                  onClick={() => setDetailItemId(card.id)}
                                  className="w-full text-left px-2 py-1.5 rounded-lg bg-white border border-blue-200/70 hover:border-blue-400 text-xs flex items-center justify-between gap-2"
                                >
                                  <span className="font-bold text-slate-900 truncate">
                                    {card.itemType === 'task' ? 'Task:' : 'Event:'} {card.title}
                                  </span>
                                  {card.assignedToName && (
                                    <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                                      {card.assignedToName}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Members List inside this Team */}
                        {membersInTeam.length === 0 ? (
                          <div className="py-5 px-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-center text-xs text-slate-500">
                            {q
                              ? 'No members in this team match your search.'
                              : 'No team members linked yet. Assign someone below or assign a card to this team.'}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {membersInTeam.map((member) => {
                              const stats = getUserStats(member, team.id);
                              const memberFare2List = Array.from(
                                effectiveUserFare2.get(member.id) || new Set<string>()
                              );
                              return (
                                <div
                                  key={member.id}
                                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 space-y-2 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMemberId(member.id)}
                                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
                                      title={`Open ${member.name}'s account & event history`}
                                    >
                                      <span
                                        className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0"
                                        style={{
                                          backgroundColor: getAvatarColor(
                                            member.name,
                                            member.avatarColor
                                          ),
                                        }}
                                      >
                                        {getInitials(member.name)}
                                      </span>
                                      <div className="min-w-0">
                                        <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 truncate transition-colors">
                                          {member.name}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                          {stats.upcoming} upcoming · {stats.inProgress} active · {stats.done} done
                                        </div>
                                      </div>
                                    </button>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => openCreateCardModal('upcoming', team.id, member)}
                                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-300"
                                        title={`Assign new card to ${member.name}`}
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFilterTeam(team.id);
                                          setFilterMemberName(member.name);
                                          setActiveTab('board');
                                        }}
                                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                                        title={`Filter board for ${member.name}`}
                                      >
                                        Cards
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleUserTeam(member.id, team.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                        title={`Remove ${member.name} from ${team.shortLabel}`}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Scout Fera2 member -> show & assign specific Scout Fare2 (Ashbal, Zahrat, etc.) */}
                                  {team.id === 'troops' && (
                                    <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-slate-200/70">
                                      {memberFare2List.map((fid) => {
                                        const fm = getScoutFare2Meta(fid);
                                        if (!fm) return null;
                                        return (
                                          <button
                                            key={fid}
                                            type="button"
                                            onClick={() => toggleUserFare2(member.id, fid)}
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 ${fm.chipClass}`}
                                            title={`Assigned to ${fm.label} (${fm.audience}) — click to remove`}
                                          >
                                            <span className={`w-1.5 h-1.5 rounded-full ${fm.dotClass}`} />
                                            <span>{fm.label}</span>
                                            <X className="w-2.5 h-2.5 opacity-60" />
                                          </button>
                                        );
                                      })}
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            toggleUserFare2(member.id, e.target.value);
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-600 focus:outline-none focus:border-blue-500"
                                      >
                                        <option value="">+ Assign Fare2...</option>
                                        {SCOUT_FERA2_LIST.filter((f) => !memberFare2List.includes(f.id)).map((f) => (
                                          <option key={f.id} value={f.id}>
                                            {f.label} ({f.audience})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Scout Fera2: 6 Color-Coded Branches & Leaders ("El Masek") */}
                      {team.id === 'troops' && (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <div className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                            6 Scout Fera2 Color Codes &amp; Leaders
                          </div>
                          <div className="space-y-1.5">
                            {SCOUT_FERA2_LIST.filter((fare2) => {
                              if (!q || teamMatchesDirectly) return true;
                              const leader = fare2Leaders[fare2.id];
                              return (
                                `${fare2.label} ${fare2.audience}`.toLowerCase().includes(q) ||
                                (leader?.userName || '').toLowerCase().includes(q)
                              );
                            }).map((fare2) => {
                              const leader = fare2Leaders[fare2.id];
                              return (
                                <div
                                  key={fare2.id}
                                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`w-3 h-3 rounded-full shrink-0 ${fare2.dotClass}`}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-900 truncate">
                                        {fare2.label}
                                      </div>
                                      <div className="text-[10px] font-semibold text-slate-500">
                                        {fare2.audience}
                                      </div>
                                    </div>
                                  </div>
                                  <select
                                    value={leader?.userId || ''}
                                    onChange={(e) =>
                                      handleSetFare2Leader(fare2.id, e.target.value)
                                    }
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-800 max-w-[145px] focus:outline-none focus:border-blue-500"
                                    title={`Select leader responsible for ${fare2.label} orders`}
                                  >
                                    <option value="">Assign leader...</option>
                                    {activeMembers.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Assign Member to Team Selector */}
                      {unassignedToThisTeam.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <UserPlus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignUserToTeam(e.target.value, team.id);
                                }
                              }}
                              className="w-full px-2.5 py-2 min-h-[38px] rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                            >
                              <option value="">+ Add person to {team.shortLabel}...</option>
                              {unassignedToThisTeam.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Sub-view B: All People across Teams */}
          {peopleSubView === 'all-people' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPeople.length === 0 ? (
                <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                  No matching accounts, tasks, events, or teams found.
                </div>
              ) : (
                filteredPeople.map((member) => {
                  const userTeams = effectiveUserTeams.get(member.id) || new Set<StoreTeamId>();
                  const userFare2List = effectiveUserFare2.get(member.id) || new Set<string>();
                  const stats = getUserStats(member);
                  const q = peopleSearch.trim().toLowerCase();
                  const matchingMemberItems = q
                    ? stats.items.filter((it) => doesItemMatchQuery(it, q))
                    : [];

                  return (
                    <div
                      key={member.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setSelectedMemberId(member.id)}
                          className="w-full flex items-start justify-between gap-3 text-left group cursor-pointer"
                          title={`Open ${member.name}'s account & event history`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-11 h-11 rounded-full text-white text-sm font-black flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: getAvatarColor(
                                  member.name,
                                  member.avatarColor
                                ),
                              }}
                            >
                              {getInitials(member.name)}
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-blue-700 truncate transition-colors">
                                {member.name}
                              </h3>
                              <p className="text-xs text-slate-500 truncate">{member.email}</p>
                            </div>
                          </div>
                          {userTeams.size === 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold shrink-0">
                              Needs Team
                            </span>
                          )}
                        </button>

                        {/* Workload Stats */}
                        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                          <div>
                            <div className="text-base font-black font-mono tabular-nums text-slate-900">
                              {stats.upcoming}
                            </div>
                            <div className="text-[10px] font-bold uppercase text-slate-500">
                              Upcoming
                            </div>
                          </div>
                          <div>
                            <div className="text-base font-black font-mono tabular-nums text-blue-700">
                              {stats.inProgress}
                            </div>
                            <div className="text-[10px] font-bold uppercase text-blue-700">
                              In Progress
                            </div>
                          </div>
                          <div>
                            <div className="text-base font-black font-mono tabular-nums text-emerald-700">
                              {stats.done}
                            </div>
                            <div className="text-[10px] font-bold uppercase text-emerald-700">
                              Done
                            </div>
                          </div>
                        </div>

                        {/* Matching Tasks / Events when searching */}
                        {matchingMemberItems.length > 0 && (
                          <div className="space-y-1 p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80">
                            <div className="text-[10px] font-black uppercase tracking-wider text-blue-800">
                              Matching Tasks / Events ({matchingMemberItems.length})
                            </div>
                            {matchingMemberItems.slice(0, 3).map((it) => (
                              <button
                                key={it.id}
                                type="button"
                                onClick={() => setDetailItemId(it.id)}
                                className="w-full text-left px-2 py-1 rounded-lg bg-white border border-blue-200/70 hover:border-blue-400 text-[11px] font-bold text-slate-900 truncate block"
                              >
                                {it.itemType === 'task' ? 'Task:' : 'Event:'} {it.title}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Assign / Toggle Team Membership (6 Teams) */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Assigned Team from 6 Teams (tap to toggle)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {STORE_TEAMS.map((team) => {
                              const active = userTeams.has(team.id);
                              return (
                                <button
                                  key={team.id}
                                  type="button"
                                  onClick={() => toggleUserTeam(member.id, team.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 transition-colors ${
                                    active
                                      ? team.activeButtonClass
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      active ? 'bg-white' : team.dotClass
                                    }`}
                                  />
                                  <span>{team.shortLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* If assigned to Scout Fera2 -> assign specific Scout Fare2 (Ashbal, Zahrat, etc.) */}
                        {userTeams.has('troops') && (
                          <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                              Assigned Scout Fare2 (tap to toggle)
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {SCOUT_FERA2_LIST.map((f) => {
                                const active = userFare2List.has(f.id);
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => toggleUserFare2(member.id, f.id)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-colors ${
                                      active ? f.activeButtonClass : f.chipClass
                                    }`}
                                    title={`${f.label} (${f.audience})`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        active ? 'bg-white' : f.dotClass
                                      }`}
                                    />
                                    <span>{f.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterTeam('all');
                            setFilterMemberName(member.name);
                            setActiveTab('board');
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                        >
                          View Cards on Board ({stats.total})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openCreateCardModal(
                              'upcoming',
                              Array.from(userTeams)[0] || 'purchases',
                              member
                            )
                          }
                          className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Assign</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          MODAL: CREATE / EDIT CARD
      ================================================================ */}
      {isFormOpen && (
        <div
          onClick={() => setIsFormOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Kanban className="w-5 h-5 text-blue-600" />
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {editingItem ? 'Edit Board Card' : 'Add Board Card'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Order summer Scout T-shirts batch"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Board Column
                  </label>
                  <select
                    value={formBoardStatus}
                    onChange={(e) => setFormBoardStatus(e.target.value as BoardColumnStatus)}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('task')}
                      className={`py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                        formType === 'task'
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <ListTodo className="w-4 h-4" />
                      <span>Task</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('event')}
                      className={`py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                        formType === 'event'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <CalendarIcon className="w-4 h-4" />
                      <span>Event</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Store Team Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Store Team
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STORE_TEAMS.map((team) => {
                    const active = formTeam === team.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setFormTeam(team.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          active ? team.activeButtonClass : team.chipClass
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            active ? 'bg-white' : team.dotClass
                          }`}
                        />
                        <span className="truncate">{team.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assigned Member (Names Only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Team Member
                  </label>
                  <select
                    value={formAssignedToId}
                    onChange={(e) => {
                      const uid = e.target.value;
                      setFormAssignedToId(uid);
                      const m = activeMembers.find((u) => u.id === uid);
                      if (m) setFormAssignedToName(m.name);
                    }}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select Member...</option>
                    {activeMembers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Or Type Name
                  </label>
                  <input
                    type="text"
                    value={formAssignedToName}
                    onChange={(e) => {
                      setFormAssignedToName(e.target.value);
                      const m = activeMembers.find(
                        (u) => u.name.toLowerCase() === e.target.value.trim().toLowerCase()
                      );
                      setFormAssignedToId(m ? m.id : '');
                    }}
                    placeholder="Team member name..."
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Dates & Time */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (formEndDate < e.target.value) setFormEndDate(e.target.value);
                    }}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-sm text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    To Date *
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    min={formStartDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-sm text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAllDay}
                    onChange={(e) => setFormAllDay(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>All Day</span>
                </label>
                {!formAllDay && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    />
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Scout Fera2 / Branch (Optional)
                  </label>
                  <select
                    value={formTroop}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormTroop(val);
                      const leader = fare2Leaders[val];
                      if (leader && !formAssignedToId) {
                        setFormAssignedToId(leader.userId);
                        setFormAssignedToName(leader.userName);
                      }
                    }}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                  >
                    <option value="">All Branches / General</option>
                    {TROOP_OPTIONS.map((t) => {
                      const fm = getScoutFare2Meta(t);
                      return (
                        <option key={t} value={t}>
                          {fm ? `${fm.label} (${fm.audience})` : t}
                        </option>
                      );
                    })}
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
                    placeholder="e.g. SPS Scout Store"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  placeholder="Details, checklist items, or order references..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold"
                >
                  {editingItem ? 'Save Changes' : 'Add Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: CARD DETAILS + STAGE SWITCH + MOBILE CALENDAR EXPORT
      ================================================================ */}
      {detailItem && (
        <div
          onClick={() => setDetailItemId(null)}
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {getTeamMeta(detailItem.team) && (
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                        TEAM_SOLID_BADGE[getTeamMeta(detailItem.team)!.id]
                      }`}
                    >
                      {getTeamMeta(detailItem.team)!.label}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {detailItem.itemType === 'task' ? 'Task' : 'Event'}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 leading-snug">
                  {detailItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailItemId(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              {/* Quick Stage Switcher */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Board Stage
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {BOARD_COLUMNS.map((col) => {
                    const isCurrent = getItemColumn(detailItem) === col.id;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => requestStageMove(detailItem, col.id)}
                        className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-colors ${
                          isCurrent
                            ? col.id === 'done'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : col.id === 'in_progress'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {col.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-semibold">Date &amp; Time</div>
                  <div className="font-bold text-slate-900 mt-1 font-mono tabular-nums">
                    {formatShortDate(detailItem.startDate)}
                    {detailItem.endDate && detailItem.endDate !== detailItem.startDate
                      ? ` → ${formatShortDate(detailItem.endDate)}`
                      : ''}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {detailItem.allDay
                      ? 'All Day'
                      : `${formatDisplayTime(detailItem.startTime)}${
                          detailItem.endTime ? ` – ${formatDisplayTime(detailItem.endTime)}` : ''
                        }`}
                  </div>
                </div>

                {detailItem.assignedToName && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500 font-semibold">Assigned Member</div>
                    <div className="font-bold text-slate-900 mt-1">
                      {detailItem.assignedToName}
                    </div>
                  </div>
                )}

                {detailItem.location && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500 font-semibold">Location</div>
                    <div className="font-bold text-slate-900 mt-1">{detailItem.location}</div>
                  </div>
                )}

                {detailItem.troopGroup && (() => {
                  const fm = getScoutFare2Meta(detailItem.troopGroup);
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-semibold">Scout Fera2</div>
                      <div className="mt-1.5">
                        {fm ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border ${fm.chipClass}`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: fm.hex }}
                            />
                            <span>
                              {fm.label} ({fm.audience})
                            </span>
                          </span>
                        ) : (
                          <span className="font-bold text-slate-900">{detailItem.troopGroup}</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {detailItem.notes && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
                  {detailItem.notes}
                </div>
              )}

              {/* Mobile Calendar Export */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadIcs(detailItem)}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Add to Mobile Calendar (.ics)</span>
                </button>
                <a
                  href={getGoogleCalendarUrl(detailItem)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Google Calendar</span>
                </a>
              </div>
            </div>

            {(() => {
              const detailStage = getItemColumn(detailItem);
              const isDone = detailStage === 'done';
              const isInProgress = detailStage === 'in_progress';

              return (
                <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => requestEditCard(detailItem)}
                        className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    {isInProgress ? (
                      <span
                        className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-not-allowed"
                        title="In Progress cards cannot be deleted. Move to Done first."
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Move to Done to delete</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestDeleteCard(detailItem)}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetailItemId(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: CONFIRM EDIT CARD
      ================================================================ */}
      {pendingEditItem && (
        <div
          onClick={() => setPendingEditItem(null)}
          className="fixed inset-0 z-[60] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4"
          >
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900">Edit Card?</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Are you sure you want to edit{' '}
                <strong className="text-slate-900">"{pendingEditItem.title}"</strong>?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingEditItem(null)}
                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingEditItem;
                  setPendingEditItem(null);
                  openEditCardModal(target);
                }}
                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs sm:text-sm font-bold"
              >
                Yes, Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: CONFIRM DELETE CARD
      ================================================================ */}
      {pendingDeleteItem && (
        <div
          onClick={() => setPendingDeleteItem(null)}
          className="fixed inset-0 z-[60] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4"
          >
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-rose-700">Delete Card?</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900">"{pendingDeleteItem.title}"</strong>?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingDeleteItem(null)}
                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = pendingDeleteItem.id;
                  setPendingDeleteItem(null);
                  setDetailItemId(null);
                  onDeleteItem(id);
                }}
                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: CONFIRM STAGE CHANGE (Upcoming -> In Progress -> Done)
      ================================================================ */}
      {pendingStageMove && (() => {
        const currentCol = getItemColumn(pendingStageMove.item);
        const currentLabel =
          BOARD_COLUMNS.find((c) => c.id === currentCol)?.title || 'Upcoming';
        const targetLabel =
          BOARD_COLUMNS.find((c) => c.id === pendingStageMove.nextStatus)?.title ||
          'In Progress';

        return (
          <div
            onClick={() => setPendingStageMove(null)}
            className="fixed inset-0 z-[60] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4"
            >
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900">
                  Move Card to {targetLabel}?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to move{' '}
                  <strong className="text-slate-900">"{pendingStageMove.item.title}"</strong> from{' '}
                  <strong className="text-slate-800">{currentLabel}</strong> to{' '}
                  <strong
                    className={
                      pendingStageMove.nextStatus === 'done'
                        ? 'text-emerald-700'
                        : pendingStageMove.nextStatus === 'in_progress'
                        ? 'text-blue-700'
                        : 'text-slate-900'
                    }
                  >
                    {targetLabel}
                  </strong>
                  ?
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingStageMove(null)}
                  className="px-4 py-2.5 min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMoveItemStatus(pendingStageMove.item.id, pendingStageMove.nextStatus);
                    setPendingStageMove(null);
                  }}
                  className={`px-4 py-2.5 min-h-[42px] rounded-xl text-white text-xs sm:text-sm font-bold ${
                    pendingStageMove.nextStatus === 'done'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : pendingStageMove.nextStatus === 'in_progress'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  Yes, Move to {targetLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================================================================
          MODAL: MEMBER ACCOUNT & CURRENT / PAST EVENTS HISTORY
      ================================================================ */}
      {selectedMember && (() => {
        const memberTeams = Array.from(
          effectiveUserTeams.get(selectedMember.id) || new Set<StoreTeamId>()
        );
        return (
          <div
            onClick={() => setSelectedMemberId(null)}
            className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className="w-12 h-12 rounded-full text-white text-base font-black flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: getAvatarColor(
                        selectedMember.name,
                        selectedMember.avatarColor
                      ),
                    }}
                  >
                    {getInitials(selectedMember.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-slate-900 truncate">
                      {selectedMember.name}
                    </h2>
                    <p className="text-xs text-slate-500 truncate">{selectedMember.email}</p>
                    {(memberTeams.length > 0 || (effectiveUserFare2.get(selectedMember.id)?.size || 0) > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {memberTeams.map((tid) => {
                          const tm = getTeamMeta(tid);
                          if (!tm) return null;
                          return (
                            <span
                              key={tid}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${TEAM_SOLID_BADGE[tid]}`}
                            >
                              {tm.shortLabel}
                            </span>
                          );
                        })}
                        {Array.from(effectiveUserFare2.get(selectedMember.id) || []).map((fid) => {
                          const f2 = getScoutFare2Meta(fid);
                          if (!f2) return null;
                          return (
                            <span
                              key={fid}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${f2.chipClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${f2.dotClass}`} />
                              {f2.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {/* Summary Strip */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="text-lg font-black font-mono tabular-nums text-blue-900">
                      {selectedMemberEvents.current.length}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-blue-700">
                      Current Events
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-lg font-black font-mono tabular-nums text-emerald-900">
                      {selectedMemberEvents.past.length}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-emerald-700">
                      Past / Completed
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-lg font-black font-mono tabular-nums text-slate-900">
                      {selectedMemberEvents.current.length + selectedMemberEvents.past.length}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-slate-600">
                      Total Handled
                    </div>
                  </div>
                </div>

                {/* Section 1: Currently Handling */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Currently Handling ({selectedMemberEvents.current.length})
                  </h3>
                  {selectedMemberEvents.current.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 text-center">
                      No active or upcoming events assigned right now.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedMemberEvents.current.map((ev) => {
                        const col = getItemColumn(ev);
                        const tm = getTeamMeta(ev.team);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => {
                              setSelectedMemberId(null);
                              setDetailItemId(ev.id);
                            }}
                            className="w-full text-left p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 transition-colors space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {tm && (
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${TEAM_SOLID_BADGE[tm.id]}`}
                                  >
                                    {tm.shortLabel}
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                    col === 'in_progress'
                                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  {col === 'in_progress' ? 'In Progress' : 'Upcoming'}
                                </span>
                              </div>
                              <span className="text-xs font-mono tabular-nums text-slate-500">
                                {formatShortDate(ev.startDate)}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-slate-900">{ev.title}</div>
                            {ev.notes && (
                              <div className="text-xs text-slate-500 line-clamp-2">{ev.notes}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 2: Previously Handled / Completed */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Previous &amp; Completed History ({selectedMemberEvents.past.length})
                  </h3>
                  {selectedMemberEvents.past.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 text-center">
                      No previous or completed events recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedMemberEvents.past.map((ev) => {
                        const tm = getTeamMeta(ev.team);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => {
                              setSelectedMemberId(null);
                              setDetailItemId(ev.id);
                            }}
                            className="w-full text-left p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-colors space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {tm && (
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${TEAM_SOLID_BADGE[tm.id]}`}
                                  >
                                    {tm.shortLabel}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {getItemColumn(ev) === 'done' ? 'Done' : 'Past Event'}
                                </span>
                              </div>
                              <span className="text-xs font-mono tabular-nums text-slate-500">
                                {formatShortDate(ev.startDate)}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-slate-800">{ev.title}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedMember;
                    const firstTeam = memberTeams[0] || 'purchases';
                    setSelectedMemberId(null);
                    openCreateCardModal('upcoming', firstTeam, target);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Assign New Event / Task</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
