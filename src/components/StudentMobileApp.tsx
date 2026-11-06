import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Bell,
  Clock,
  CheckCircle2,
  Circle,
  FileText,
  MapPin,
  User,
  ArrowUpRight,
  Download,
  ShieldAlert,
  Search,
  WifiOff,
  ChevronRight,
  BookOpen,
  Plus,
  X,
  Crown,
  ShieldCheck,
  GraduationCap,
  Settings,
  Database,
  Server,
  HardDrive,
  Check,
  RefreshCw,
  Send,
  Pencil,
  Trash2,
  LogOut,
  LayoutDashboard,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClassData } from '../context/ClassDataContext';
import {
  ScheduleItem,
  Announcement,
  ReminderItem,
  StudentMember,
  UserRole,
  ROLE_DEFINITIONS,
  BNI_IT_DIVISIONS,
  BNI_SPEAKER_ROLES,
  BNI_TRAINING_ROOMS,
} from '../types';
import { DAYS_OF_WEEK, ASSET_IMAGES } from '../lib/seedData';
import {
  generateSchedulesICS,
  getGoogleCalendarUrlForSchedule,
  getGoogleCalendarUrlForReminder,
  downloadICSFile,
} from '../lib/calendarSync';
import { notificationService } from '../lib/notifications';
import { dataService, DatabaseProviderType, AuthHeaderMode, formatScheduleTime } from '../lib/dataService';
import { CalendarScheduleView } from './CalendarScheduleView';
import { MembersErrorBanner } from './MembersErrorBanner';
import { PendingApprovalsPanel } from './PendingApprovalsPanel';

interface StudentMobileAppProps {
  /** Present only for admins: switches to the full admin portal. */
  onOpenPortal?: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
}

type MobileTab = 'home' | 'schedule' | 'announcements' | 'reminders' | 'settings' | 'profile';

export const StudentMobileApp: React.FC<StudentMobileAppProps> = ({ onOpenPortal, onOpenNotifications, unreadCount }) => {
  const { user, role, isOnline, signOut } = useAuth();
  const {
    schedules,
    announcements,
    reminders,
    classMembers,
    pendingApprovals,
    approvalsError,
    approvePendingUser,
    rejectPendingUser,
    dbConfig,
    updateDbConfig,
    updateMemberRole,
    addMember,
    markAnnouncementAsRead,
    toggleReminderComplete,
    addReminder,
    addAnnouncement,
    addSchedule,
  } = useClassData();

  const isSuperAdmin = role === 'super_admin';
  const isClassAdmin = role === 'class_admin';
  const isAdmin = isSuperAdmin || isClassAdmin;

  // Active navigation tab & directional slide tracking
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [tabDirection, setTabDirection] = useState<number>(1);

  const TAB_ORDER: Record<MobileTab, number> = {
    home: 0,
    schedule: 1,
    announcements: 2,
    reminders: 3,
    settings: 4,
    profile: 4,
  };

  const navigateToTab = (newTab: MobileTab) => {
    if (newTab === activeTab) return;
    const curr = TAB_ORDER[activeTab] ?? 0;
    const next = TAB_ORDER[newTab] ?? 0;
    setTabDirection(next >= curr ? 1 : -1);
    setActiveTab(newTab);
  };

  const tabSlideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 36 : -36,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.8 },
        opacity: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -36 : 36,
      opacity: 0,
      transition: {
        x: { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.8 },
        opacity: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const },
      },
    }),
  };

  // Mobile Settings Sub-Tab
  const [mobileSettingsSubTab, setMobileSettingsSubTab] = useState<'approvals' | 'roles' | 'database' | 'account'>(() =>
    pendingApprovals && pendingApprovals.length > 0 ? 'approvals' : 'roles'
  );

  // Schedule filtering by day (default to today's day 1-7)
  const currentDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<number>(currentDayOfWeek <= 5 ? currentDayOfWeek : 1);
  const [scheduleViewMode, setScheduleViewMode] = useState<'calendar' | 'daily'>('calendar');

  // Announcement filtering and detail modal
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Reminder filtering & add modal
  const [reminderFilter, setReminderFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [showAddReminderModal, setShowAddReminderModal] = useState<boolean>(false);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderCourse, setNewReminderCourse] = useState(schedules[0]?.courseName || '');
  const [newReminderDeadline, setNewReminderDeadline] = useState('2026-11-06T23:59');
  const [newReminderType, setNewReminderType] = useState<ReminderItem['reminderType']>('assignment');

  // Mobile Admin Modals (Add announcement & Add schedule directly from mobile)
  const [showMobileAddAnnModal, setShowMobileAddAnnModal] = useState(false);
  const [mobileAnnTitle, setMobileAnnTitle] = useState('');
  const [mobileAnnContent, setMobileAnnContent] = useState('');
  const [mobileAnnPriority, setMobileAnnPriority] = useState<Announcement['priority']>('important');
  const [mobileAnnCategory, setMobileAnnCategory] = useState<Announcement['category']>('academic');

  const [showMobileAddSchedModal, setShowMobileAddSchedModal] = useState(false);
  const [mobileSchedCourse, setMobileSchedCourse] = useState('');
  const [mobileSchedCode, setMobileSchedCode] = useState('');
  const [mobileSchedDivision, setMobileSchedDivision] = useState<string>(BNI_IT_DIVISIONS[0]);
  const [mobileSchedLecturer, setMobileSchedLecturer] = useState('');
  const [mobileSchedSpeakerRole, setMobileSchedSpeakerRole] = useState<string>(BNI_SPEAKER_ROLES[0]);
  const [mobileSchedDay, setMobileSchedDay] = useState(1);
  const [mobileSchedStart, setMobileSchedStart] = useState('08:30');
  const [mobileSchedEnd, setMobileSchedEnd] = useState('11:30');
  const [mobileSchedRoom, setMobileSchedRoom] = useState(BNI_TRAINING_ROOMS[0]);

  // Role Management State on Mobile (Super Admin)
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | UserRole>('all');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberNim, setNewMemberNim] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('class_member');

  // Database settings on mobile (Super Admin)
  const [mobDbProvider, setMobDbProvider] = useState<DatabaseProviderType>(dbConfig.provider);
  const [mobApiUrl, setMobApiUrl] = useState(dbConfig.apiBaseUrl);
  const [mobApiKey, setMobApiKey] = useState(dbConfig.apiKey || '');
  const [mobAuthMode, setMobAuthMode] = useState<AuthHeaderMode>(dbConfig.authHeaderMode || 'firebase_jwt');
  const [mobTestLoading, setMobTestLoading] = useState(false);
  const [mobTestResult, setMobTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [mobSaveSuccess, setMobSaveSuccess] = useState(false);

  // Filtered schedules for selected day
  const daySchedules = useMemo(() => {
    return schedules
      .filter(s => s.dayOfWeek === selectedDay)
      .sort((a, b) => (a?.startTime || '').localeCompare(b?.startTime || ''));
  }, [schedules, selectedDay]);

  // Today's next upcoming class
  const todayClasses = useMemo(() => {
    return schedules.filter(s => s.dayOfWeek === currentDayOfWeek);
  }, [schedules, currentDayOfWeek]);

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
      const matchQuery =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.authorName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [announcements, selectedCategory, searchQuery]);

  // Filtered reminders
  const filteredReminders = useMemo(() => {
    return reminders.filter(r => {
      if (reminderFilter === 'pending') return !r.isCompleted;
      if (reminderFilter === 'completed') return r.isCompleted;
      return true;
    });
  }, [reminders, reminderFilter]);

  // Filtered members for Super Admin
  const filteredMembers = useMemo(() => {
    return classMembers.filter(m => {
      const matchQuery =
        m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        m.nim.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearchQuery.toLowerCase());
      const matchRole = memberRoleFilter === 'all' || m.role === memberRoleFilter;
      return matchQuery && matchRole;
    });
  }, [classMembers, memberSearchQuery, memberRoleFilter]);

  // Format date helper
  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const handleOpenAnnouncement = (ann: Announcement) => {
    setSelectedAnnouncement(ann);
    markAnnouncementAsRead(ann.id);
  };

  const handleDownloadAllICS = () => {
    const icsContent = generateSchedulesICS(schedules, 'Jadwal Kuliah Semester Ini');
    downloadICSFile(icsContent, 'jadwal-kuliah-semester.ics');
    notificationService.dispatchNotification(
      'Kalender Berhasil Diunduh',
      'File .ics jadwal kuliah siap diimpor ke aplikasi Kalender bawaan iOS/Android.',
      'normal'
    );
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;

    const saved = await addReminder({
      title: newReminderTitle,
      courseName: newReminderCourse,
      deadline: newReminderDeadline,
      reminderType: newReminderType,
      description: 'Pengingat dibuat melalui ponsel.',
      priority: 'high',
      isCompleted: false,
    });
    if (!saved) return;

    setNewReminderTitle('');
    setShowAddReminderModal(false);
  };

  const handleMobileCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileAnnTitle.trim() || !mobileAnnContent.trim()) return;

    const saved = await addAnnouncement({
      title: mobileAnnTitle,
      content: mobileAnnContent,
      priority: mobileAnnPriority,
      category: mobileAnnCategory,
      authorId: user?.id || 'admin',
      authorName: user?.displayName || (isSuperAdmin ? 'Super Admin' : 'Admin Kelas'),
    });
    if (!saved) return;

    setMobileAnnTitle('');
    setMobileAnnContent('');
    setShowMobileAddAnnModal(false);
  };

  const handleMobileCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileSchedCourse.trim()) return;

    const saved = await addSchedule({
      courseName: mobileSchedCourse,
      courseCode: mobileSchedCode,
      divisionName: mobileSchedDivision,
      lecturer: mobileSchedLecturer,
      speakerRole: mobileSchedSpeakerRole,
      dayOfWeek: mobileSchedDay,
      startTime: mobileSchedStart,
      endTime: mobileSchedEnd,
      room: mobileSchedRoom,
      building: 'BNI Corporate University Jakarta',
      classType: 'offline',
    });
    if (!saved) return;

    setMobileSchedCourse('');
    setMobileSchedCode('');
    setShowMobileAddSchedModal(false);
  };

  const handleMobileAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    const saved = await addMember({
      name: newMemberName,
      nim: newMemberNim.trim(),
      email: newMemberEmail,
      avatarUrl:
        newMemberRole === 'super_admin'
          ? ASSET_IMAGES.superAdminAvatar
          : newMemberRole === 'class_admin'
          ? ASSET_IMAGES.classAdminAvatar
          : ASSET_IMAGES.classMemberAvatar,
      attendanceRate: 100,
      lastActive: 'Baru ditambahkan',
      role: newMemberRole,
    });
    // Keep the form open (with its input) if the API rejected the new member.
    if (!saved) return;

    setNewMemberName('');
    setNewMemberNim('');
    setNewMemberEmail('');
    setShowAddMemberModal(false);
  };

  const handleMobileSaveDb = (e: React.FormEvent) => {
    e.preventDefault();
    updateDbConfig({
      provider: mobDbProvider,
      apiBaseUrl: mobApiUrl,
      apiKey: mobApiKey,
      authHeaderMode: mobAuthMode,
      authHeaderName: 'Authorization',
      syncWithFirestoreBackup: true,
      lastConnectedAt: new Date().toISOString(),
    });
    setMobSaveSuccess(true);
    setTimeout(() => setMobSaveSuccess(false), 3000);
  };

  const handleMobileTestDb = async () => {
    setMobTestLoading(true);
    setMobTestResult(null);
    const res = await dataService.testConnection(mobApiUrl, mobApiKey, mobAuthMode, 'Authorization');
    setMobTestLoading(false);
    setMobTestResult(res);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col bg-white sm:border sm:border-slate-200/80 sm:rounded-3xl sm:shadow-sm overflow-hidden h-dvh sm:h-[calc(100dvh-2rem)] lg:h-[calc(100dvh-3rem)] relative">
      {/* Offline Warning Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-5 py-2 text-xs flex items-center justify-between shrink-0 shadow-xs font-semibold">
          <span className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            Mode Offline Aktif · Memuat jadwal dan pengumuman dari cache lokal
          </span>
          <span className="text-[10px] bg-amber-800 text-white px-2 py-0.5 rounded font-mono font-bold">Lokal</span>
        </div>
      )}

      {/* Top App Bar */}
        <div className="px-4 sm:px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3 border-b border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="px-1.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-[11px] shadow-xs tracking-wider">
              BNI
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">ODP IT BNI 2026</h1>
                {isAdmin && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded">
                    {isSuperAdmin ? 'Super' : 'Admin'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                Kelas A<span className="hidden sm:inline"> · BNI Corporate University</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Admin portal shortcut (admins only) */}
            {onOpenPortal && (
              <button
                onClick={onOpenPortal}
                className="p-1.5 sm:px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Buka Portal Admin"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Portal Admin</span>
              </button>
            )}

            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
              title="Notifikasi"
              aria-label="Buka notifikasi"
            >
              <Bell className="w-3.5 h-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-slate-950 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Quick Settings Shortcut for Admins */}
            {isAdmin && (
              <button
                onClick={() => navigateToTab('settings')}
                className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                }`}
                title="Buka Pengaturan Admin di HP"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleDownloadAllICS}
              className="hidden sm:flex p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 items-center gap-1 transition-colors"
              title="Ekspor seluruh jadwal ke file kalender .ics"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => navigateToTab(isAdmin ? 'settings' : 'profile')}
              className="w-7 h-7 rounded-full overflow-hidden border border-amber-300"
            >
              <img
                src={user?.avatarUrl || ASSET_IMAGES.classMemberAvatar}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>

        {/* Scrollable Content Viewport with Fluid Directional Slide-in */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-3 pb-24">
          <AnimatePresence mode="wait" custom={tabDirection}>
            <motion.div
              key={activeTab}
              custom={tabDirection}
              variants={tabSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              {/* TAB 1: BERANDA (HOME) */}
              {activeTab === 'home' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Student/Admin Greeting Card with Campus Image */}
              <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden shadow-xs relative">
                <div className="h-24 w-full relative overflow-hidden bg-slate-200">
                  <img
                    src={ASSET_IMAGES.campusHeroBanner}
                    alt="Campus"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent"></div>
                  <div className="absolute bottom-2 left-3 text-white flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-slate-900/60 px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                      {isSuperAdmin && <Crown className="w-3 h-3 text-amber-400" />}
                      {isClassAdmin && <ShieldCheck className="w-3 h-3 text-yellow-400" />}
                      {!isAdmin && <GraduationCap className="w-3 h-3 text-slate-300" />}
                      {ROLE_DEFINITIONS[role]?.label || 'Member Kelas'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{user?.displayName || 'Trainee ODP IT'}</h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {user?.nim || 'NIP: ODP-IT-2026-001'} · ODP IT BNI Batch 2026
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => navigateToTab('settings')}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <Settings className="w-3 h-3" />
                        Pengaturan
                      </button>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 text-[11px] font-medium">
                      {todayClasses.length > 0
                        ? `Ada ${todayClasses.length} sesi kuliah hari ini`
                        : 'Tidak ada jadwal kuliah hari ini'}
                    </span>
                    <button
                      onClick={() => navigateToTab('schedule')}
                      className="text-amber-700 hover:text-amber-800 font-bold text-[11px] flex items-center gap-0.5"
                    >
                      Buka Jadwal <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Urgent Broadcast Notice if any */}
              {announcements.find(a => a.priority === 'urgent') && (
                <div
                  onClick={() => handleOpenAnnouncement(announcements.find(a => a.priority === 'urgent')!)}
                  className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 cursor-pointer hover:bg-rose-100/70 transition-all shadow-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 mt-0.5 shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Pemberitahuan Mendesak</span>
                        <span className="text-[10px] text-slate-400">Hari ini</span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 mt-0.5 line-clamp-1">
                        {announcements.find(a => a.priority === 'urgent')?.title}
                      </h3>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                        {announcements.find(a => a.priority === 'urgent')?.content}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upcoming Deadlines Widget */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pengingat Terdekat</h3>
                  <button
                    onClick={() => navigateToTab('reminders')}
                    className="text-[11px] text-amber-700 hover:text-amber-800 font-bold"
                  >
                    Lihat Semua
                  </button>
                </div>

                <div className="space-y-2">
                  {reminders.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-400 shadow-2xs">
                      Belum ada pengingat tugas aktif.
                    </div>
                  ) : (
                    reminders.slice(0, 2).map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-2.5"
                      >
                        <button
                          onClick={() => toggleReminderComplete(item.id)}
                          className="text-slate-400 hover:text-amber-600 transition-colors shrink-0"
                        >
                          {item.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-xs font-bold truncate ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span>{item.courseName}</span>
                            <span>·</span>
                            <span className="text-amber-700 font-mono font-bold">Batas: {formatDate(item.deadline)}</span>
                          </div>
                        </div>
                        <a
                          href={getGoogleCalendarUrlForReminder(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-amber-800 hover:bg-amber-50 rounded-lg shrink-0"
                          title="Simpan pengingat ke Google Calendar"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Today's Schedule Overview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Kuliah Hari Ini</h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {DAYS_OF_WEEK.find(d => d.value === currentDayOfWeek)?.label}
                  </span>
                </div>

                {todayClasses.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 shadow-xs">
                    Tidak ada jadwal perkuliahan hari ini. Waktu belajar mandiri!
                  </div>
                ) : (
                  todayClasses.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="empty:hidden text-[10px] font-mono text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                              {item.courseCode}
                            </span>
                            {item.divisionName && (
                              <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                                {item.divisionName}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-900">{item.courseName}</h4>
                          <div className="flex items-center gap-1 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-800">{item.lecturer}</span>
                            {item.speakerRole && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-amber-800 text-[10px] font-medium bg-amber-50 px-1 rounded">
                                  {item.speakerRole}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 shrink-0">
                          {formatScheduleTime(item)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          {item.room}
                        </span>
                        <a
                          href={getGoogleCalendarUrlForSchedule(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1"
                        >
                          Sync G-Cal <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: JADWAL KULIAH (SCHEDULE) */}
          {activeTab === 'schedule' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Jadwal Kuliah</h2>
                  <p className="text-[11px] text-slate-500">Semester Ganjil 2026/2027</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isAdmin && (
                    <button
                      onClick={() => setShowMobileAddSchedModal(true)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah
                    </button>
                  )}
                  <button
                    onClick={handleDownloadAllICS}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    .ICS
                  </button>
                </div>
              </div>

              {/* View Switcher: Kalender Bulan & Minggu vs Mode Harian */}
              <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs">
                <button
                  onClick={() => setScheduleViewMode('calendar')}
                  className={`flex-1 py-1.5 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    scheduleViewMode === 'calendar'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>Kalender Bulan & Minggu</span>
                </button>
                <button
                  onClick={() => setScheduleViewMode('daily')}
                  className={`flex-1 py-1.5 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    scheduleViewMode === 'daily'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Mode Harian</span>
                </button>
              </div>

              {/* CALENDAR & WEEK VIEW MODE */}
              {scheduleViewMode === 'calendar' ? (
                <CalendarScheduleView
                  schedules={schedules}
                  reminders={reminders}
                  role={role}
                  isMobile={true}
                  onAddSchedule={isAdmin ? () => setShowMobileAddSchedModal(true) : undefined}
                />
              ) : (
                /* DAILY DIRECT VIEW MODE */
                <div className="space-y-3">
                  {/* Day filter pills */}
                  <div className="grid grid-cols-6 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    {DAYS_OF_WEEK.slice(0, 6).map((day) => (
                      <button
                        key={day.value}
                        onClick={() => setSelectedDay(day.value)}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          selectedDay === day.value
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>

                  {/* Schedule list */}
                  <div className="space-y-3">
                    {daySchedules.length === 0 ? (
                      <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
                        <CalendarIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Tidak ada jadwal kuliah di hari ini.</p>
                      </div>
                    ) : (
                      daySchedules.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="empty:hidden text-[10px] font-mono text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                                  {item.courseCode}
                                </span>
                                {item.divisionName && (
                                  <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                                    {item.divisionName}
                                  </span>
                                )}
                                <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {item.classType}
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-slate-900">{item.courseName}</h3>
                              <div className="flex items-center gap-1 text-xs text-slate-600">
                                <span className="font-semibold text-slate-800">{item.lecturer}</span>
                                {item.speakerRole && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-amber-800 text-[10px] font-medium bg-amber-50 px-1 rounded">
                                      {item.speakerRole}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 block">
                                {formatScheduleTime(item)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {[item.room, item.building].filter(Boolean).join(' · ')}
                            </span>
                            <a
                              href={getGoogleCalendarUrlForSchedule(item)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1"
                            >
                              Sync G-Cal <ArrowUpRight className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BERITA & PENGUMUMAN (ANNOUNCEMENTS) */}
          {activeTab === 'announcements' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Pengumuman & Berita</h2>
                  <p className="text-[11px] text-slate-500">Informasi resmi perkuliahan</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setShowMobileAddAnnModal(true)}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Siarkan
                  </button>
                )}
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari judul pengumuman..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              {/* Announcement items */}
              <div className="space-y-3">
                {filteredAnnouncements.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
                    <p className="text-xs font-semibold text-slate-500">Belum ada pengumuman kelas.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Pengumuman dari dosen atau ketua kelas akan tampil di sini.</p>
                  </div>
                ) : (
                  filteredAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      onClick={() => handleOpenAnnouncement(ann)}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 cursor-pointer hover:border-amber-400 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            ann.priority === 'urgent'
                              ? 'bg-rose-100 text-rose-800'
                              : ann.priority === 'important'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ann.priority}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{formatDate(ann.publishedAt)}</span>
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 leading-snug">{ann.title}</h3>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{ann.content}</p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                        <span>Dosen: {ann.authorName}</span>
                        <span className="text-amber-700 font-bold flex items-center gap-1">
                          Baca Selengkapnya <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PENGINGAT (REMINDERS) */}
          {activeTab === 'reminders' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Pengingat & Tenggat Tugas</h2>
                  <p className="text-[11px] text-slate-500">Daftar agenda tugas dan kuis online</p>
                </div>
                <button
                  onClick={() => setShowAddReminderModal(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </div>

              {/* Reminders filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setReminderFilter('all')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    reminderFilter === 'all' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Semua ({reminders.length})
                </button>
                <button
                  onClick={() => setReminderFilter('pending')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    reminderFilter === 'pending' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Belum Selesai ({reminders.filter(r => !r.isCompleted).length})
                </button>
                <button
                  onClick={() => setReminderFilter('completed')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    reminderFilter === 'completed' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Selesai
                </button>
              </div>

              {/* Reminders list */}
              <div className="space-y-2.5">
                {filteredReminders.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
                    <p className="text-xs font-semibold text-slate-500">Tidak ada pengingat tugas aktif.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Tekan tombol "+ Tambah" di atas untuk menambahkan tugas atau agenda baru.</p>
                  </div>
                ) : (
                  filteredReminders.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                    >
                      <button
                        onClick={() => toggleReminderComplete(item.id)}
                        className="text-slate-400 hover:text-amber-600 transition-colors shrink-0"
                      >
                        {item.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-bold ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-semibold text-slate-600">{item.courseName}</span>
                          <span>·</span>
                          <span className="text-amber-800 font-mono font-bold">Batas: {formatDate(item.deadline)}</span>
                        </div>
                      </div>

                      <a
                        href={getGoogleCalendarUrlForReminder(item)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-amber-800 hover:bg-amber-50 rounded-lg shrink-0"
                        title="Simpan ke Google Calendar"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: PENGATURAN SUPER ADMIN & ADMIN KELAS (SETTINGS ON MOBILE) */}
          {activeTab === 'settings' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Profile Card Header */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
                <img
                  src={user?.avatarUrl || ASSET_IMAGES.superAdminAvatar}
                  alt={user?.displayName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isSuperAdmin && <Crown className="w-3.5 h-3.5 text-amber-600" />}
                    {isClassAdmin && <ShieldCheck className="w-3.5 h-3.5 text-yellow-600" />}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-950 bg-amber-100 px-2 py-0.5 rounded-full">
                      {ROLE_DEFINITIONS[role]?.label || role}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 truncate mt-0.5">{user?.displayName}</h3>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Sub-tab navigation for Super Admin vs Admin Kelas */}
              {isSuperAdmin ? (
                <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-2xl text-[10px] font-bold">
                  <button
                    onClick={() => setMobileSettingsSubTab('approvals')}
                    className={`py-2 px-1 rounded-xl transition-all text-center flex flex-col items-center gap-1 relative ${
                      mobileSettingsSubTab === 'approvals' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Konfirmasi</span>
                    {pendingApprovals.length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </button>
                  <button
                    onClick={() => setMobileSettingsSubTab('roles')}
                    className={`py-2 px-1 rounded-xl transition-all text-center flex flex-col items-center gap-1 ${
                      mobileSettingsSubTab === 'roles' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Role</span>
                  </button>
                  <button
                    onClick={() => setMobileSettingsSubTab('database')}
                    className={`py-2 px-1 rounded-xl transition-all text-center flex flex-col items-center gap-1 ${
                      mobileSettingsSubTab === 'database' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Database</span>
                  </button>
                  <button
                    onClick={() => setMobileSettingsSubTab('account')}
                    className={`py-2 px-1 rounded-xl transition-all text-center flex flex-col items-center gap-1 ${
                      mobileSettingsSubTab === 'account' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Kalender</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    Panel Pengaturan Admin Kelas (Ketua Kelas)
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Anda memiliki wewenang untuk menyiarkan berita kelas, memperbarui jadwal, dan mengatur tenggat pengingat di HP ini.
                  </p>
                </div>
              )}

              {/* SUBTAB APPROVALS: SUPER ADMIN ONLY */}
              {isSuperAdmin && mobileSettingsSubTab === 'approvals' && (
                <div className="space-y-3">
                  <PendingApprovalsPanel
                    pendingApprovals={pendingApprovals}
                    error={approvalsError}
                    onApprove={approvePendingUser}
                    onReject={rejectPendingUser}
                  />
                </div>
              )}

              {/* SUBTAB ROLES: SUPER ADMIN ONLY */}
              {isSuperAdmin && mobileSettingsSubTab === 'roles' && (
                <div className="space-y-3">
                  <MembersErrorBanner />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Kelola Role Anggota Kelas</h4>
                      <p className="text-[10px] text-slate-500">Ubah peran mahasiswa langsung dari HP</p>
                    </div>
                    <button
                      onClick={() => setShowAddMemberModal(true)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah
                    </button>
                  </div>

                  {/* Search input on mobile */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari anggota / NIM..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                    />
                  </div>

                  {/* Role filter buttons */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-bold">
                    <button
                      onClick={() => setMemberRoleFilter('all')}
                      className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                        memberRoleFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Semua ({classMembers.length})
                    </button>
                    <button
                      onClick={() => setMemberRoleFilter('super_admin')}
                      className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                        memberRoleFilter === 'super_admin' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Super Admin
                    </button>
                    <button
                      onClick={() => setMemberRoleFilter('class_admin')}
                      className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                        memberRoleFilter === 'class_admin' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Admin Kelas
                    </button>
                    <button
                      onClick={() => setMemberRoleFilter('class_member')}
                      className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                        memberRoleFilter === 'class_member' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Member
                    </button>
                  </div>

                  {/* Member cards with role switcher */}
                  <div className="space-y-2">
                    {filteredMembers.map((mhs) => (
                      <div
                        key={mhs.id}
                        className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={mhs.avatarUrl}
                              alt={mhs.name}
                              className="w-8 h-8 rounded-full object-cover border border-amber-300 shrink-0"
                            />
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-slate-900 truncate">{mhs.name}</h5>
                              <p className="text-[10px] text-slate-500 font-mono truncate">{mhs.nim} · {mhs.email}</p>
                            </div>
                          </div>
                        </div>

                        {/* In-place role select */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-[10px] text-slate-500 font-semibold">Peran Sistem:</span>
                          <select
                            value={mhs.role}
                            onChange={(e) => updateMemberRole(mhs.id, e.target.value as UserRole)}
                            className="px-2 py-1 bg-amber-50 border border-amber-300 rounded-lg text-[11px] font-bold text-amber-950 focus:outline-hidden"
                          >
                            <option value="super_admin">👑 Super Admin</option>
                            <option value="class_admin">🛡️ Admin Kelas</option>
                            <option value="class_member">🎓 Member Kelas</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBTAB DATABASE: SUPER ADMIN ONLY */}
              {isSuperAdmin && mobileSettingsSubTab === 'database' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                      <Check className="w-3.5 h-3.5" />
                      Firebase Auth Tetap 100% Terisolasi Aman
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Mengganti basis data ke REST API pribadi tidak mempengaruhi autentikasi SSO Google Anda.
                    </p>
                  </div>

                  <form onSubmit={handleMobileSaveDb} className="p-4 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-3">
                    <label className="block text-slate-900 font-bold text-xs">Pilih Basis Data Aktif</label>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setMobDbProvider('firestore')}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          mobDbProvider === 'firestore'
                            ? 'bg-amber-100 border-amber-500 text-amber-950 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        Firestore
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobDbProvider('custom_api')}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          mobDbProvider === 'custom_api'
                            ? 'bg-amber-100 border-amber-500 text-amber-950 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        API Pribadi
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobDbProvider('local_offline')}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          mobDbProvider === 'local_offline'
                            ? 'bg-amber-100 border-amber-500 text-amber-950 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        Lokal
                      </button>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Base URL Server Pribadi</label>
                      <input
                        type="text"
                        inputMode="url"
                        required
                        value={mobApiUrl}
                        onChange={(e) => setMobApiUrl(e.target.value)}
                        placeholder="Contoh: https://api.kampus-pribadi.ac.id/v1 atau http://localhost:8000/api"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Mendukung awalan <code className="text-amber-800">http://</code>, <code className="text-amber-800">https://</code>, IP lokal, dan pembungkus JSON <code className="text-amber-800">&#123; data: [...] &#125;</code>.
                      </p>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Header Autentikasi</label>
                      <select
                        value={mobAuthMode}
                        onChange={(e) => setMobAuthMode(e.target.value as AuthHeaderMode)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      >
                        <option value="firebase_jwt">Kirim Firebase ID Token (JWT)</option>
                        <option value="custom_key">API Key Manual</option>
                      </select>
                    </div>

                    {mobAuthMode === 'custom_key' && (
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[11px]">API Key / Secret Token</label>
                        <input
                          type="password"
                          value={mobApiKey}
                          onChange={(e) => setMobApiKey(e.target.value)}
                          placeholder="Masukkan API Key server pribadi Anda"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                        />
                      </div>
                    )}

                    {mobTestResult && (
                      <div
                        className={`p-2.5 rounded-xl border text-[11px] leading-tight ${
                          mobTestResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'
                        }`}
                      >
                        {mobTestResult.message}
                      </div>
                    )}

                    {mobSaveSuccess && (
                      <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-300 text-[11px] font-bold text-center">
                        Konfigurasi database berhasil disimpan!
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={mobTestLoading}
                          onClick={handleMobileTestDb}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-[11px] border border-slate-200 transition-colors"
                        >
                          {mobTestLoading ? 'Menguji...' : 'Uji Koneksi'}
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-[11px] shadow-xs"
                        >
                          Simpan
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          dataService.resetToDefault();
                          const fresh = dataService.getConfig();
                          setMobApiUrl(fresh.apiBaseUrl);
                          setMobAuthMode('firebase_jwt');
                          setMobApiKey('');
                          updateDbConfig(fresh);
                          setMobTestResult({
                            success: true,
                            message: 'Cache lokal browser dibersihkan. Kembali ke endpoint resmi https://api-class.and-than.my.id/api (Firebase ID Token SSO).',
                          });
                        }}
                        className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-semibold text-[10px] border border-rose-200 transition-colors text-center"
                      >
                        Hapus Cache Konfigurasi & Reset ke API Resmi
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SUBTAB ACCOUNT & CALENDAR (Available to both Super Admin and Admin Kelas) */}
              {(mobileSettingsSubTab === 'account' || !isSuperAdmin) && (
                <div className="space-y-3 text-xs">
                  <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs">Ekspor & Sinkronisasi Kalender</h4>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Unduh berkas jadwal kuliah format iCalendar (.ics) yang kompatibel dengan Google Calendar dan Apple Calendar.
                    </p>

                    <button
                      onClick={handleDownloadAllICS}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Unduh Kalender Kelas (.ICS)
                    </button>

                    <button
                      onClick={() => dataService.downloadDatabaseJSON()}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-200 transition-colors text-[11px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Ekspor Database JSON
                    </button>
                  </div>

                  {/* Push notification settings */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Uji Push Notifikasi</h4>
                      <p className="text-[10px] text-slate-500">Kirim sampel pengingat ke perangkat</p>
                    </div>
                    <button
                      onClick={() => {
                        if (notificationService.getDeviceState() === 'granted') {
                          notificationService.showOnDevice('Uji notifikasi', 'Notifikasi di perangkat ini berfungsi.');
                        } else {
                          notificationService.enableDeviceNotifications();
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg text-xs"
                    >
                      Uji Notif
                    </button>
                  </div>

                  <button
                    onClick={() => signOut()}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar ({user?.email})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB PROFILE (For Member Kelas) */}
          {activeTab === 'profile' && !isAdmin && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-center pt-2">
                <img
                  src={user?.avatarUrl || ASSET_IMAGES.classMemberAvatar}
                  alt={user?.displayName}
                  className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-amber-400 shadow-sm"
                />
                <h2 className="text-sm font-bold text-slate-900 mt-2">{user?.displayName || 'Luki Giovani'}</h2>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-700" />
                  <span>Member Kelas (Mahasiswa)</span>
                </div>
              </div>

              {/* Role explanation */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-amber-950 block mb-0.5">Hak Akses Mahasiswa:</span>
                Anda memiliki akses membaca jadwal kuliah mingguan, berita dan pengumuman kelas, serta pengingat tenggat tugas.
              </div>

              {/* Bulk ICS Export Button */}
              <button
                onClick={handleDownloadAllICS}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                Unduh Semua Kalender (.ICS)
              </button>

              <button
                onClick={() => signOut()}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* BOTTOM ERGONOMIC TAB BAR */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around z-20 shadow-xs">
          <button
            onClick={() => navigateToTab('home')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors relative ${
              activeTab === 'home' ? 'text-amber-800 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-[10px] mt-1">Beranda</span>
            {activeTab === 'home' && (
              <motion.div
                layoutId="mobileActiveTabIndicator"
                className="absolute -bottom-1 w-5 h-0.5 bg-amber-600 rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>

          <button
            onClick={() => navigateToTab('schedule')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors relative ${
              activeTab === 'schedule' ? 'text-amber-800 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span className="text-[10px] mt-1">Jadwal</span>
            {activeTab === 'schedule' && (
              <motion.div
                layoutId="mobileActiveTabIndicator"
                className="absolute -bottom-1 w-5 h-0.5 bg-amber-600 rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>

          <button
            onClick={() => navigateToTab('announcements')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors relative ${
              activeTab === 'announcements' ? 'text-amber-800 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="text-[10px] mt-1">Berita</span>
            {activeTab === 'announcements' && (
              <motion.div
                layoutId="mobileActiveTabIndicator"
                className="absolute -bottom-1 w-5 h-0.5 bg-amber-600 rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>

          <button
            onClick={() => navigateToTab('reminders')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors relative ${
              activeTab === 'reminders' ? 'text-amber-800 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="text-[10px] mt-1">Pengingat</span>
            {activeTab === 'reminders' && (
              <motion.div
                layoutId="mobileActiveTabIndicator"
                className="absolute -bottom-1 w-5 h-0.5 bg-amber-600 rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>

          {/* 5th Tab: Settings for Admin/SuperAdmin, Profile for Member */}
          {isAdmin ? (
            <button
              onClick={() => navigateToTab('settings')}
              className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors relative ${
                activeTab === 'settings' ? 'text-amber-800 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="text-[10px] mt-1">Setting</span>
              {activeTab === 'settings' && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className="absolute -bottom-1 w-5 h-0.5 bg-amber-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ) : (
            <button
              onClick={() => navigateToTab('profile')}
              className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors relative ${
                activeTab === 'profile' ? 'text-amber-800 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="text-[10px] mt-1">Profil</span>
              {activeTab === 'profile' && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className="absolute -bottom-1 w-5 h-0.5 bg-amber-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          )}
        </div>

      {/* ANNOUNCEMENT DETAIL MODAL */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col relative">
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  selectedAnnouncement.priority === 'urgent'
                    ? 'bg-rose-100 text-rose-800'
                    : selectedAnnouncement.priority === 'important'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {selectedAnnouncement.priority}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{formatDate(selectedAnnouncement.publishedAt)}</span>
            </div>

            <h2 className="text-base font-bold text-slate-900 mb-2 leading-snug">
              {selectedAnnouncement.title}
            </h2>

            <div className="flex items-center gap-2 text-xs text-slate-500 pb-3 border-b border-slate-100">
              <span>Pengirim: {selectedAnnouncement.authorName}</span>
              <span>·</span>
              <span className="text-emerald-700 font-bold">Status: Terbaca</span>
            </div>

            <div className="py-4 overflow-y-auto text-xs text-slate-700 leading-relaxed space-y-3">
              <p>{selectedAnnouncement.content}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">
                {selectedAnnouncement.readCount || 0} mahasiswa membaca
              </span>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE ADD SCHEDULE MODAL (FOR SUPER ADMIN & ADMIN KELAS) */}
      {showMobileAddSchedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowMobileAddSchedModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">Jadwal Sesi Pembicara Divisi</h3>
            <p className="text-[11px] text-slate-500 mb-3">Atur sesi ODP IT dengan Dept Head / Team Leader</p>

            <form onSubmit={handleMobileCreateSchedule} className="space-y-2.5 text-xs">
              {/* Divisi BNI */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nama Divisi BNI <span className="text-rose-500">*</span>
                </label>
                <select
                  value={mobileSchedDivision}
                  onChange={(e) => setMobileSchedDivision(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  {BNI_IT_DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Materi Sesi */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Materi / Topik Sesi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Microservices & Event Architecture"
                  value={mobileSchedCourse}
                  onChange={(e) => setMobileSchedCourse(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              {/* Kode Modul */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Kode Modul Sesi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ODP-EAS-01"
                  value={mobileSchedCode}
                  onChange={(e) => setMobileSchedCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold"
                />
              </div>

              {/* Pembicara & Role */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Nama Pembicara <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Bambang Wijaya"
                    value={mobileSchedLecturer}
                    onChange={(e) => setMobileSchedLecturer(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Jabatan / Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mobileSchedSpeakerRole}
                    onChange={(e) => setMobileSchedSpeakerRole(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                  >
                    {BNI_SPEAKER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ruang Kelas yang Digunakan */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Ruang Kelas yang Digunakan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={mobileSchedRoom}
                  onChange={(e) => setMobileSchedRoom(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  {BNI_TRAINING_ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hari & Jam */}
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Hari</label>
                  <select
                    value={mobileSchedDay}
                    onChange={(e) => setMobileSchedDay(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    {DAYS_OF_WEEK.slice(0, 6).map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.short}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mulai</label>
                  <input
                    type="time"
                    value={mobileSchedStart}
                    onChange={(e) => setMobileSchedStart(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Selesai</label>
                  <input
                    type="time"
                    value={mobileSchedEnd}
                    onChange={(e) => setMobileSchedEnd(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMobileAddSchedModal(false)}
                  className="px-4 py-1.5 text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs"
                >
                  Simpan Jadwal Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE ADD ANNOUNCEMENT MODAL (FOR SUPER ADMIN & ADMIN KELAS) */}
      {showMobileAddAnnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl relative">
            <button
              onClick={() => setShowMobileAddAnnModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-3">Siarkan Berita / Pengumuman</h3>

            <form onSubmit={handleMobileCreateAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Perubahan Ruang Kuliah..."
                  value={mobileAnnTitle}
                  onChange={(e) => setMobileAnnTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Prioritas</label>
                  <select
                    value={mobileAnnPriority}
                    onChange={(e) => setMobileAnnPriority(e.target.value as Announcement['priority'])}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="normal">Biasa</option>
                    <option value="important">Penting</option>
                    <option value="urgent">Mendesak</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kategori</label>
                  <select
                    value={mobileAnnCategory}
                    onChange={(e) => setMobileAnnCategory(e.target.value as Announcement['category'])}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="academic">Akademik</option>
                    <option value="schedule_change">Jadwal</option>
                    <option value="exam">Ujian</option>
                    <option value="event">Kegiatan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Isi Berita</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Tuliskan detail pengumuman..."
                  value={mobileAnnContent}
                  onChange={(e) => setMobileAnnContent(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMobileAddAnnModal(false)}
                  className="px-4 py-1.5 text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Siarkan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE ADD MEMBER MODAL (SUPER ADMIN ONLY) */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl relative">
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-3">Tambah Anggota Kelas Baru</h3>

            <form onSubmit={handleMobileAddMember} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Siswa"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">NIM</label>
                <input
                  type="text"
                  required
                  placeholder="2301092015"
                  value={newMemberNim}
                  onChange={(e) => setNewMemberNim(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="siswa@univ.ac.id"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Peran Awal</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                >
                  <option value="class_member">🎓 Member Kelas (Mahasiswa)</option>
                  <option value="class_admin">🛡️ Admin Kelas (Ketua Kelas)</option>
                  <option value="super_admin">👑 Super Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-1.5 text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Simpan Anggota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PERSONAL REMINDER MODAL */}
      {showAddReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl relative">
            <button
              onClick={() => setShowAddReminderModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-3">Tambah Pengingat Mandiri</h3>

            <form onSubmit={handleCreateReminder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Judul Tugas / Pengingat</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Belajar Bab 4 UTS..."
                  value={newReminderTitle}
                  onChange={(e) => setNewReminderTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mata Kuliah</label>
                <select
                  value={newReminderCourse}
                  onChange={(e) => setNewReminderCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.courseName}>
                      {s.courseName}
                    </option>
                  ))}
                  <option value="Lainnya">Agenda Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Batas Waktu (Deadline)</label>
                <input
                  type="datetime-local"
                  required
                  value={newReminderDeadline}
                  onChange={(e) => setNewReminderDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddReminderModal(false)}
                  className="px-4 py-1.5 text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Simpan Pengingat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
