import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Bell,
  Calendar,
  Clock,
  Users,
  Plus,
  Trash2,
  FileText,
  ShieldCheck,
  TrendingUp,
  Eye,
  CheckCircle2,
  AlertCircle,
  Download,
  Share2,
  Send,
  X,
  Search,
  Pencil,
  Database,
  Server,
  HardDrive,
  Check,
  RefreshCw,
  Code2,
  Crown,
  GraduationCap,
  Settings,
  UserCheck,
  Info,
  LogOut,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClassData } from '../context/ClassDataContext';
import {
  Announcement,
  ScheduleItem,
  ReminderItem,
  StudentMember,
  UserRole,
  ROLE_DEFINITIONS,
  BNI_IT_DIVISIONS,
  BNI_SPEAKER_ROLES,
  BNI_TRAINING_ROOMS,
} from '../types';
import { DAYS_OF_WEEK, ASSET_IMAGES } from '../lib/seedData';
import { generateSchedulesICS, downloadICSFile } from '../lib/calendarSync';
import { notificationService } from '../lib/notifications';
import { dataService, DatabaseProviderType, AuthHeaderMode } from '../lib/dataService';
import { CalendarScheduleView } from './CalendarScheduleView';
import { MembersErrorBanner } from './MembersErrorBanner';
import { PendingApprovalsPanel } from './PendingApprovalsPanel';

interface AdminPortalProps {
  onOpenApp: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onOpenApp, onOpenNotifications, unreadCount }) => {
  const { user, role, signOut } = useAuth();
  const {
    schedules,
    announcements,
    reminders,
    readReceipts,
    classMembers,
    pendingApprovals,
    approvePendingUser,
    rejectPendingUser,
    dbConfig,
    updateDbConfig,
    updateMemberRole,
    addMember,
    deleteMember,
    addAnnouncement,
    deleteAnnouncement,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addReminder,
    updateReminder,
    deleteReminder,
  } = useClassData();

  // Active admin section & directional slide tracking
  const [activeSection, setActiveSection] = useState<
    'analytics' | 'announcements' | 'schedules' | 'reminders' | 'roster' | 'settings'
  >('analytics');
  const [sectionDirection, setSectionDirection] = useState<number>(1);

  const SECTION_ORDER: Record<string, number> = {
    analytics: 0,
    schedules: 1,
    announcements: 2,
    reminders: 3,
    roster: 4,
    settings: 5,
  };

  const navigateToSection = (newSection: typeof activeSection) => {
    if (newSection === activeSection) return;
    const curr = SECTION_ORDER[activeSection] ?? 0;
    const next = SECTION_ORDER[newSection] ?? 0;
    setSectionDirection(next >= curr ? 1 : -1);
    setActiveSection(newSection);
  };

  const sectionSlideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 32 : -32,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 360, damping: 30, mass: 0.8 },
        opacity: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -32 : 32,
      opacity: 0,
      transition: {
        x: { type: 'spring' as const, stiffness: 360, damping: 30, mass: 0.8 },
        opacity: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const },
      },
    }),
  };

  // Settings sub-tab for Super Admin
  const [settingsTab, setSettingsTab] = useState<'approvals' | 'roles' | 'database' | 'calendar'>(() =>
    pendingApprovals && pendingApprovals.length > 0 ? 'approvals' : 'roles'
  );

  // Role Management State (Super Admin)
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberNim, setNewMemberNim] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('class_member');

  // Announcement Form State
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<Announcement['priority']>('important');
  const [annCategory, setAnnCategory] = useState<Announcement['category']>('academic');
  const [annAttachment, setAnnAttachment] = useState('');
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  // Schedule Form State
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [schedViewMode, setSchedViewMode] = useState<'calendar' | 'table'>('calendar');
  const [schedCourse, setSchedCourse] = useState('');
  const [schedCode, setSchedCode] = useState('');
  const [schedDivision, setSchedDivision] = useState<string>(BNI_IT_DIVISIONS[0]);
  const [schedLecturer, setSchedLecturer] = useState('Bambang Wijaya, S.T., M.Kom.');
  const [schedSpeakerRole, setSchedSpeakerRole] = useState<string>(BNI_SPEAKER_ROLES[0]);
  const [schedDay, setSchedDay] = useState<number>(1);
  const [schedStart, setSchedStart] = useState('08:30');
  const [schedEnd, setSchedEnd] = useState('11:30');
  const [schedRoom, setSchedRoom] = useState(BNI_TRAINING_ROOMS[0]);
  const [schedBuilding, setSchedBuilding] = useState('BNI Corporate University Jakarta');
  const [schedType, setSchedType] = useState<ScheduleItem['classType']>('offline');
  const [schedNotes, setSchedNotes] = useState('');

  // Reminder Form State
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remCourse, setRemCourse] = useState(schedules[0]?.courseName || 'Enterprise Microservices & Event-Driven Architecture');
  const [remDeadline, setRemDeadline] = useState('2026-11-10T23:59');
  const [remType, setRemType] = useState<ReminderItem['reminderType']>('assignment');
  const [remPriority, setRemPriority] = useState<'low' | 'medium' | 'high'>('high');
  const [remDesc, setRemDesc] = useState('');

  // Edit Modals State
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [editSchedCourse, setEditSchedCourse] = useState('');
  const [editSchedCode, setEditSchedCode] = useState('');
  const [editSchedDivision, setEditSchedDivision] = useState<string>(BNI_IT_DIVISIONS[0]);
  const [editSchedLecturer, setEditSchedLecturer] = useState('');
  const [editSchedSpeakerRole, setEditSchedSpeakerRole] = useState<string>(BNI_SPEAKER_ROLES[0]);
  const [editSchedDay, setEditSchedDay] = useState(1);
  const [editSchedStart, setEditSchedStart] = useState('');
  const [editSchedEnd, setEditSchedEnd] = useState('');
  const [editSchedRoom, setEditSchedRoom] = useState('');
  const [editSchedBuilding, setEditSchedBuilding] = useState('BNI Corporate University Jakarta');
  const [editSchedType, setEditSchedType] = useState<ScheduleItem['classType']>('offline');
  const [editSchedNotes, setEditSchedNotes] = useState('');

  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [editRemTitle, setEditRemTitle] = useState('');
  const [editRemCourse, setEditRemCourse] = useState('');
  const [editRemDeadline, setEditRemDeadline] = useState('');
  const [editRemType, setEditRemType] = useState<ReminderItem['reminderType']>('assignment');

  // Student Read Details Modal State
  const [inspectAnnouncement, setInspectAnnouncement] = useState<Announcement | null>(null);

  // Custom Database Settings State
  const [dbProvider, setDbProvider] = useState<DatabaseProviderType>(dbConfig.provider);
  const [customApiUrl, setCustomApiUrl] = useState(dbConfig.apiBaseUrl);
  const [customApiKey, setCustomApiKey] = useState(dbConfig.apiKey || '');
  const [customAuthHeader, setCustomAuthHeader] = useState(dbConfig.authHeaderName || 'Authorization');
  const [authHeaderMode, setAuthHeaderMode] = useState<AuthHeaderMode>(dbConfig.authHeaderMode || 'firebase_jwt');
  const [syncFirestoreBackup, setSyncFirestoreBackup] = useState(dbConfig.syncWithFirestoreBackup);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; latencyMs?: number; message: string } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);

  // Role permissions check
  const isSuperAdmin = role === 'super_admin';
  const isClassAdmin = role === 'class_admin';
  const isMemberOnly = role === 'class_member';
  const canEditClassData = isSuperAdmin || isClassAdmin;

  // Filtered members for Super Admin Role Management
  const filteredMembers = classMembers.filter((m) => {
    const matchQuery =
      m.name.toLowerCase().includes(roleSearchQuery.toLowerCase()) ||
      m.nim.toLowerCase().includes(roleSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(roleSearchQuery.toLowerCase());
    const matchRole = roleFilter === 'all' || m.role === roleFilter;
    return matchQuery && matchRole;
  });

  // Role counts
  const superAdminCount = classMembers.filter((m) => m.role === 'super_admin').length;
  const classAdminCount = classMembers.filter((m) => m.role === 'class_admin').length;
  const memberCount = classMembers.filter((m) => m.role === 'class_member').length;

  // Handlers
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    setIsSubmittingAnn(true);
    await addAnnouncement({
      title: annTitle,
      content: annContent,
      priority: annPriority,
      category: annCategory,
      authorId: user?.id || 'admin',
      authorName: user?.displayName || (isSuperAdmin ? 'Super Admin' : 'Admin Kelas (Ketua Angkatan ODP)'),
      attachmentName: annAttachment.trim() ? annAttachment : undefined,
      attachmentUrl: annAttachment.trim() ? '#' : undefined,
    });

    setAnnTitle('');
    setAnnContent('');
    setAnnAttachment('');
    setIsSubmittingAnn(false);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedCourse.trim() || !schedCode.trim()) return;

    await addSchedule({
      courseName: schedCourse,
      courseCode: schedCode,
      divisionName: schedDivision,
      lecturer: schedLecturer,
      speakerRole: schedSpeakerRole,
      dayOfWeek: schedDay,
      startTime: schedStart,
      endTime: schedEnd,
      room: schedRoom,
      building: schedBuilding,
      classType: schedType,
      notes: schedNotes,
    });

    setSchedCourse('');
    setSchedCode('');
    setSchedNotes('');
    setShowAddSchedule(false);
  };

  const openEditSchedule = (sch: ScheduleItem) => {
    setEditingSchedule(sch);
    setEditSchedCourse(sch.courseName);
    setEditSchedCode(sch.courseCode);
    setEditSchedDivision(sch.divisionName || BNI_IT_DIVISIONS[0]);
    setEditSchedLecturer(sch.lecturer);
    setEditSchedSpeakerRole(sch.speakerRole || BNI_SPEAKER_ROLES[0]);
    setEditSchedDay(sch.dayOfWeek);
    setEditSchedStart(sch.startTime);
    setEditSchedEnd(sch.endTime);
    setEditSchedRoom(sch.room);
    setEditSchedBuilding(sch.building || 'BNI Corporate University Jakarta');
    setEditSchedType(sch.classType);
    setEditSchedNotes(sch.notes || '');
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    await updateSchedule(editingSchedule.id, {
      courseName: editSchedCourse,
      courseCode: editSchedCode,
      divisionName: editSchedDivision,
      lecturer: editSchedLecturer,
      speakerRole: editSchedSpeakerRole,
      dayOfWeek: editSchedDay,
      startTime: editSchedStart,
      endTime: editSchedEnd,
      room: editSchedRoom,
      building: editSchedBuilding,
      classType: editSchedType,
      notes: editSchedNotes,
    });

    setEditingSchedule(null);
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;

    await addReminder({
      title: remTitle,
      courseName: remCourse,
      deadline: remDeadline,
      reminderType: remType,
      priority: remPriority,
      description: remDesc || 'Tenggat waktu resmi dari pengurus kelas.',
      isCompleted: false,
    });

    setRemTitle('');
    setRemDesc('');
    setShowAddReminder(false);
  };

  const openEditReminder = (rem: ReminderItem) => {
    setEditingReminder(rem);
    setEditRemTitle(rem.title);
    setEditRemCourse(rem.courseName);
    setEditRemDeadline(rem.deadline);
    setEditRemType(rem.reminderType);
  };

  const handleUpdateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder) return;

    await updateReminder(editingReminder.id, {
      title: editRemTitle,
      courseName: editRemCourse,
      deadline: editRemDeadline,
      reminderType: editRemType,
    });

    setEditingReminder(null);
  };

  const handleSaveDbConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateDbConfig({
      provider: dbProvider,
      apiBaseUrl: customApiUrl,
      apiKey: customApiKey,
      authHeaderMode,
      authHeaderName: customAuthHeader,
      syncWithFirestoreBackup: syncFirestoreBackup,
      lastConnectedAt: new Date().toISOString(),
    });
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3500);
  };

  const handleTestCustomDb = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    const result = await dataService.testConnection(customApiUrl, customApiKey, authHeaderMode, customAuthHeader);
    setTestingConnection(false);
    setConnectionResult(result);
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
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

  // If user is Member Kelas, show graceful notice
  if (isMemberOnly) {
    return (
      <div className="w-full max-w-4xl p-6 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-5 text-slate-800">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Portal Pengurus Kelas (Khusus Pengurus & Dosen)</h2>
            <p className="text-xs text-slate-500">
              Anda sedang masuk dengan akun <strong>{user?.displayName}</strong> berstatus <span className="font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">Member Kelas</span>.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs space-y-3 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <Info className="w-4 h-4 text-amber-700" />
            Hak Akses Member Kelas
          </div>
          <p className="text-slate-700">
            Sebagai Member Kelas, Anda dapat melihat beranda perkuliahan, jadwal mingguan, berita kelas, dan pengingat tugas di tampilan aplikasi mobile siswa.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onOpenApp}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-xs"
            >
              Buka Aplikasi Kelas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full lg:w-64 bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shrink-0 shadow-xs flex flex-col justify-between gap-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
        <div className="space-y-3 lg:space-y-4">
          {/* Admin Profile Box */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-center gap-3">
            <img
              src={user?.avatarUrl || ASSET_IMAGES.superAdminAvatar}
              alt="Avatar"
              className="w-10 h-10 rounded-full object-cover border-2 border-amber-400"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isSuperAdmin ? (
                  <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                  {ROLE_DEFINITIONS[role]?.label || 'Pengurus'}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 truncate">{user?.displayName}</h4>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 transition-colors shrink-0"
              title="Notifikasi"
              aria-label="Buka notifikasi"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-slate-950 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex lg:flex-col gap-1 text-xs overflow-x-auto [scrollbar-width:none] lg:overflow-visible -mx-1 px-1 pb-1 lg:pb-0 lg:mx-0 lg:px-0 [&>button]:shrink-0 [&>button]:w-auto lg:[&>button]:w-full [&>button]:gap-2 [&>button]:whitespace-nowrap">
            <button
              onClick={() => navigateToSection('analytics')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
                activeSection === 'analytics'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4" />
                <span>Ringkasan & Analitik</span>
              </div>
            </button>

            <button
              onClick={() => navigateToSection('schedules')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
                activeSection === 'schedules'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" />
                <span>Kelola Jadwal Kuliah</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-700">
                {schedules.length}
              </span>
            </button>

            <button
              onClick={() => navigateToSection('announcements')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
                activeSection === 'announcements'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4" />
                <span>Siaran Berita & Pengumuman</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-700">
                {announcements.length}
              </span>
            </button>

            <button
              onClick={() => navigateToSection('reminders')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
                activeSection === 'reminders'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4" />
                <span>Kelola Pengingat & Tugas</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-700">
                {reminders.length}
              </span>
            </button>

            <button
              onClick={() => navigateToSection('roster')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
                activeSection === 'roster'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Daftar Mahasiswa</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-700">
                {classMembers.length}
              </span>
            </button>

            {/* Menu Pengaturan / Settings */}
            <button
              onClick={() => navigateToSection('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
                activeSection === 'settings'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4" />
                <span>Pengaturan Sistem</span>
              </div>
              {isSuperAdmin && pendingApprovals.length > 0 ? (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                  {pendingApprovals.length} Konfirmasi
                </span>
              ) : isSuperAdmin ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-950">
                  Super
                </span>
              ) : null}
            </button>
          </nav>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 text-xs">
            <button
              onClick={onOpenApp}
              className="flex items-center justify-center lg:justify-start gap-2 px-3.5 py-2.5 rounded-xl font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              <span>Aplikasi Kelas</span>
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center justify-center lg:justify-start gap-2 px-3.5 py-2.5 rounded-xl font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>

        {/* Database Quick Info Footer */}
        <div className="hidden lg:block p-3 rounded-2xl bg-slate-100 border border-slate-200/70 text-[11px] text-slate-600 space-y-1">
          <div className="flex items-center justify-between font-semibold">
            <span className="text-slate-700">Basis Data:</span>
            <span className="font-mono text-amber-700">
              {dbConfig.provider === 'firestore' ? 'Cloud Firestore' : dbConfig.provider === 'custom_api' ? 'API Pribadi' : 'Lokal'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            Auth Firebase SSO terisolasi aman.
          </p>
        </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <AnimatePresence mode="wait" custom={sectionDirection}>
          <motion.div
            key={activeSection}
            custom={sectionDirection}
            variants={sectionSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-6"
          >
            {/* SECTION 1: RINGKASAN & ANALITIK */}
            {activeSection === 'analytics' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top metric row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                <span className="text-xs text-slate-500 font-medium">Total Anggota Kelas</span>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-extrabold text-slate-900 font-mono">{classMembers.length}</h3>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> 100% Aktif
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {superAdminCount} Super Admin · {classAdminCount} Admin Kelas · {memberCount} Member
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                <span className="text-xs text-slate-500 font-medium">Jadwal Kuliah Mingguan</span>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-extrabold text-slate-900 font-mono">{schedules.length} Sesi</h3>
                  <span className="text-xs text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Senin - Jumat
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Mata kuliah semester berjalan</p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                <span className="text-xs text-slate-500 font-medium">Siaran Pengumuman</span>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-extrabold text-slate-900 font-mono">{announcements.length}</h3>
                  <span className="text-xs text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Real-time
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Notifikasi push terkirim ke mahasiswa</p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                <span className="text-xs text-slate-500 font-medium">Tenggat Waktu Tugas</span>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-extrabold text-slate-900 font-mono">{reminders.length} Agenda</h3>
                  <span className="text-xs text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Sinkron Kalender
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Siap diekspor ke format .ICS</p>
              </div>
            </div>

            {/* Quick Actions & Role Card */}
            <div className="p-6 rounded-3xl bg-amber-50/70 border border-amber-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                    {ROLE_DEFINITIONS[role]?.label}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs font-semibold text-slate-700">Akses Pengelolaan Kelas</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Selamat datang di Portal Manajemen UniClass Hub
                </h3>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  {ROLE_DEFINITIONS[role]?.description}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      navigateToSection('settings');
                      setSettingsTab('roles');
                    }}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    Kelola Role Kelas
                  </button>
                )}
                <button
                  onClick={() => navigateToSection('announcements')}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Siarkan Pengumuman
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: KELOLA JADWAL */}
        {activeSection === 'schedules' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Kelola Jadwal Perkuliahan Mingguan</h3>
                <p className="text-xs text-slate-500">
                  {canEditClassData
                    ? 'Tambah, perbarui, dan atur jadwal kelas yang tampil langsung di aplikasi mahasiswa'
                    : 'Daftar jadwal perkuliahan'}
                </p>
              </div>
              {canEditClassData && (
                <button
                  onClick={() => setShowAddSchedule(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Jadwal Baru
                </button>
              )}
            </div>

            {/* Form Add Schedule Modal */}
            {showAddSchedule && (
              <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Form Jadwal Sesi Pembicara Divisi ODP IT BNI
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Jadwalkan sesi pelatihan dengan Dept Head / Team Leader dari divisi IT terkait
                    </p>
                  </div>
                  <button onClick={() => setShowAddSchedule(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateSchedule} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* 1. Nama Divisi */}
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">
                      Nama Divisi BNI <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={schedDivision}
                      onChange={(e) => setSchedDivision(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                    >
                      {BNI_IT_DIVISIONS.map((div) => (
                        <option key={div} value={div}>
                          {div}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Materi / Topik ODP */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Materi / Topik Pelatihan ODP <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Enterprise Microservices & Event-Driven Architecture"
                      value={schedCourse}
                      onChange={(e) => setSchedCourse(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 3. Kode Modul */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Kode Modul Sesi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ODP-EAS-01"
                      value={schedCode}
                      onChange={(e) => setSchedCode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold"
                    />
                  </div>

                  {/* 4. Pembicara & Role (Dept Head / Team Leader) */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Nama Pembicara <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Bambang Wijaya, S.T., M.Kom."
                      value={schedLecturer}
                      onChange={(e) => setSchedLecturer(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Jabatan / Role Pembicara <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={schedSpeakerRole}
                      onChange={(e) => setSchedSpeakerRole(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                    >
                      {BNI_SPEAKER_ROLES.map((roleOpt) => (
                        <option key={roleOpt} value={roleOpt}>
                          {roleOpt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 5. Ruang Kelas yang Digunakan */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Ruang Kelas yang Digunakan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={schedRoom}
                      onChange={(e) => setSchedRoom(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                    >
                      {BNI_TRAINING_ROOMS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Gedung / Kampus BNI</label>
                    <input
                      type="text"
                      value={schedBuilding}
                      onChange={(e) => setSchedBuilding(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* 6. Jadwal Hari & Jam */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Jadwal Hari <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={schedDay}
                      onChange={(e) => setSchedDay(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                    >
                      {DAYS_OF_WEEK.slice(0, 6).map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Jam Mulai & Selesai <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={schedStart}
                        onChange={(e) => setSchedStart(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                      />
                      <span className="text-slate-400 font-bold">-</span>
                      <input
                        type="time"
                        value={schedEnd}
                        onChange={(e) => setSchedEnd(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  {/* 7. Tipe Sesi & Catatan */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tipe Sesi</label>
                    <select
                      value={schedType}
                      onChange={(e) => setSchedType(e.target.value as ScheduleItem['classType'])}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    >
                      <option value="offline">Tatap Muka (Offline di Corpu/Graha)</option>
                      <option value="online">Virtual Zoom Meeting BNI</option>
                      <option value="hybrid">Hybrid (Tatap Muka & Zoom)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Catatan / Persyaratan Sesi</label>
                    <input
                      type="text"
                      placeholder="Contoh: Membawa laptop dinas BNI & token VPN Corpu"
                      value={schedNotes}
                      onChange={(e) => setSchedNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddSchedule(false)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-800"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-xs"
                    >
                      Simpan Jadwal Sesi Divisi
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* View Switcher: Kalender Bulan & Minggu vs Tabel */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs">
                <button
                  onClick={() => setSchedViewMode('calendar')}
                  className={`px-4 py-2 font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    schedViewMode === 'calendar'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Kalender Bulan & Minggu (Tahun Akademik)</span>
                </button>
                <button
                  onClick={() => setSchedViewMode('table')}
                  className={`px-4 py-2 font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    schedViewMode === 'table'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tabel Ringkasan ({schedules.length})</span>
                </button>
              </div>

              <span className="text-xs text-slate-500 hidden sm:inline">
                Pilih minggu pada kalender untuk melihat jadwal perkuliahan lengkap
              </span>
            </div>

            {/* SCHEDULE VIEW CONTENT */}
            {schedViewMode === 'calendar' ? (
              <CalendarScheduleView
                schedules={schedules}
                reminders={reminders}
                role={role}
                isMobile={false}
                onAddSchedule={() => setShowAddSchedule(true)}
                onEditSchedule={openEditSchedule}
                onDeleteSchedule={deleteSchedule}
              />
            ) : (
              /* Schedules Table */
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Hari</th>
                      <th className="py-2.5 px-3">Jam</th>
                      <th className="py-2.5 px-3">Mata Kuliah</th>
                      <th className="py-2.5 px-3">Dosen</th>
                      <th className="py-2.5 px-3">Ruang</th>
                      {canEditClassData && <th className="py-2.5 px-3 text-center">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {schedules.length === 0 ? (
                      <tr>
                        <td colSpan={canEditClassData ? 6 : 5} className="py-10 text-center font-sans text-slate-400">
                          <p className="text-xs font-semibold text-slate-500">Belum ada jadwal perkuliahan tersimpan.</p>
                          <p className="text-[11px] text-slate-400 mt-1">Gunakan formulir di atas untuk menambahkan jadwal atau sinkronkan dengan API pribadi Anda.</p>
                        </td>
                      </tr>
                    ) : (
                      schedules.map((sch) => (
                        <tr key={sch.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-sans font-bold text-amber-800">
                            {DAYS_OF_WEEK.find((d) => d.value === sch.dayOfWeek)?.label}
                          </td>
                          <td className="py-3 px-3">{sch.startTime} - {sch.endTime}</td>
                          <td className="py-3 px-3 font-sans font-semibold text-slate-900">
                            {sch.courseName} <span className="text-[10px] text-slate-400 font-mono">({sch.courseCode})</span>
                          </td>
                          <td className="py-3 px-3 font-sans text-slate-600">{sch.lecturer}</td>
                          <td className="py-3 px-3 font-sans text-slate-700">{sch.room}</td>
                          {canEditClassData && (
                            <td className="py-3 px-3 text-center font-sans">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEditSchedule(sch)}
                                  className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Edit Jadwal Kuliah"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteSchedule(sch.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Hapus Jadwal"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: KELOLA PENGUMUMAN */}
        {activeSection === 'announcements' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {canEditClassData && (
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Siarkan Pengumuman Kelas Baru</h3>
                    <p className="text-xs text-slate-500">
                      Pesan akan terkirim dengan notifikasi push instan ke smartphone mahasiswa
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    {isSuperAdmin ? 'Super Admin' : 'Admin Kelas'}
                  </span>
                </div>

                <form onSubmit={handleCreateAnnouncement} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Judul Pengumuman</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Perubahan Ruang Kuliah atau Batas Tugas Capstone..."
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Tingkat Prioritas</label>
                      <select
                        value={annPriority}
                        onChange={(e) => setAnnPriority(e.target.value as Announcement['priority'])}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                      >
                        <option value="normal">Biasa (Normal)</option>
                        <option value="important">Penting (Important)</option>
                        <option value="urgent">Mendesak (Urgent - Notifikasi Banner)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Kategori Pengumuman</label>
                      <select
                        value={annCategory}
                        onChange={(e) => setAnnCategory(e.target.value as Announcement['category'])}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                      >
                        <option value="academic">Akademik & Materi Kuliah</option>
                        <option value="schedule_change">Perubahan Jadwal / Ruangan</option>
                        <option value="exam">Ujian (UTS / UAS / Kuis)</option>
                        <option value="event">Kegiatan / Webinar Kelas</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Isi Berita Lengkap</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Tuliskan detail informasi, petunjuk, atau tautan terkait..."
                      value={annContent}
                      onChange={(e) => setAnnContent(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-amber-500"
                    ></textarea>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingAnn}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSubmittingAnn ? 'Mengirim...' : 'Siarkan Pengumuman Sekarang'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Announcements List */}
            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl shadow-xs">
                  <p className="text-xs font-semibold text-slate-500">Belum ada pengumuman kelas yang diterbitkan.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Gunakan formulir di atas untuk menyiarkan pengumuman baru ke mahasiswa atau muat dari API Anda.</p>
                </div>
              ) : (
                announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
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
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500 font-medium">{ann.authorName}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{ann.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{ann.content}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setInspectAnnouncement(ann)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Lihat Mahasiswa yang Sudah Membaca"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {ann.readCount || 0}/42 Dibaca
                    </button>
                    {canEditClassData && (
                      <button
                        onClick={() => deleteAnnouncement(ann.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Hapus Pengumuman"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )))}
            </div>
          </div>
        )}

        {/* SECTION 4: KELOLA PENGINGAT */}
        {activeSection === 'reminders' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Kelola Pengingat & Tenggat Waktu Kelas</h3>
                <p className="text-xs text-slate-500">
                  Tetapkan batas pengumpulan tugas, kuis online, dan ujian untuk seluruh anak kelas
                </p>
              </div>
              {canEditClassData && (
                <button
                  onClick={() => setShowAddReminder(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Buat Pengingat Baru
                </button>
              )}
            </div>

            {/* Form Add Reminder */}
            {showAddReminder && (
              <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Form Buat Pengingat Baru</h4>
                  <button onClick={() => setShowAddReminder(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateReminder} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Judul Agenda / Tugas</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Pengumpulan Laporan Capstone..."
                      value={remTitle}
                      onChange={(e) => setRemTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Mata Kuliah</label>
                    <select
                      value={remCourse}
                      onChange={(e) => setRemCourse(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                    >
                      {schedules.map((s) => (
                        <option key={s.id} value={s.courseName}>
                          {s.courseName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Batas Waktu (Deadline)</label>
                    <input
                      type="datetime-local"
                      required
                      value={remDeadline}
                      onChange={(e) => setRemDeadline(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tipe Agenda</label>
                    <select
                      value={remType}
                      onChange={(e) => setRemType(e.target.value as ReminderItem['reminderType'])}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                    >
                      <option value="assignment">Tugas Mandiri / Kelompok</option>
                      <option value="quiz">Kuis Online</option>
                      <option value="exam">Ujian (UTS / UAS)</option>
                      <option value="project">Proyek Capstone</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Deskripsi Tambahan</label>
                    <textarea
                      rows={2}
                      placeholder="Instruksi pengumpulan atau format file..."
                      value={remDesc}
                      onChange={(e) => setRemDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    ></textarea>
                  </div>

                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddReminder(false)}
                      className="px-4 py-2 text-slate-500 hover:text-slate-800"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold"
                    >
                      Terbitkan Pengingat
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Reminders List */}
            <div className="space-y-3">
              {reminders.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl shadow-xs">
                  <p className="text-xs font-semibold text-slate-500">Belum ada pengingat tugas atau agenda aktif.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Gunakan tombol "Tambah Pengingat Baru" di atas untuk menambahkan tugas kelas.</p>
                </div>
              ) : (
                reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                        {rem.reminderType}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-600 font-semibold">{rem.courseName}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{rem.title}</h4>
                    <p className="text-xs text-slate-500">{rem.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 block">
                      Batas: {new Date(rem.deadline).toLocaleDateString('id-ID')}
                    </span>
                    {canEditClassData && (
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => openEditReminder(rem)}
                          className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          onClick={() => deleteReminder(rem.id)}
                          className="text-xs text-slate-400 hover:text-rose-600"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )))}
            </div>
          </div>
        )}

        {/* SECTION 5: ROSTER MAHASISWA */}
        {activeSection === 'roster' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <MembersErrorBanner />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Daftar Anggota & Mahasiswa Kelas</h3>
                <p className="text-xs text-slate-500">Pantau keaktifan dan kehadiran seluruh anggota kelas</p>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Nama Anggota</th>
                    <th className="py-2.5 px-3">NIM / Identitas</th>
                    <th className="py-2.5 px-3">Peran (Role)</th>
                    <th className="py-2.5 px-3">Email Kampus</th>
                    <th className="py-2.5 px-3 text-right">Kehadiran</th>
                    <th className="py-2.5 px-3 text-right">Aktivitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classMembers.map((mhs) => (
                    <tr key={mhs.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={mhs.avatarUrl}
                            alt={mhs.name}
                            className="w-8 h-8 rounded-full object-cover border border-amber-300 shadow-2xs"
                          />
                          <span className="font-semibold text-slate-900">{mhs.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">{mhs.nim}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            mhs.role === 'super_admin'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : mhs.role === 'class_admin'
                              ? 'bg-yellow-100 text-yellow-900 border-yellow-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {ROLE_DEFINITIONS[mhs.role]?.label || mhs.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{mhs.email}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 font-bold">
                        {mhs.attendanceRate}%
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 font-mono text-[11px]">{mhs.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 6: PENGATURAN SISTEM & MANAGE ROLE (SUPER ADMIN) */}
        {activeSection === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Settings Header Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs">
              {isSuperAdmin && (
                <button
                  onClick={() => setSettingsTab('approvals')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all relative ${
                    settingsTab === 'approvals'
                      ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-500/20'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-slate-950" />
                  <span>Konfirmasi User SSO</span>
                  {pendingApprovals.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                      {pendingApprovals.length}
                    </span>
                  )}
                </button>
              )}

              {isSuperAdmin && (
                <button
                  onClick={() => setSettingsTab('roles')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                    settingsTab === 'roles'
                      ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-500/20'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Crown className="w-4 h-4 text-amber-800" />
                  <span>Kelola Role Kelas (Super Admin)</span>
                </button>
              )}

              {isSuperAdmin && (
                <button
                  onClick={() => setSettingsTab('database')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                    settingsTab === 'database'
                      ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-500/20'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Database className="w-4 h-4 text-slate-800" />
                  <span>Koneksi Database & API Pribadi</span>
                </button>
              )}

              <button
                onClick={() => setSettingsTab('calendar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                  settingsTab === 'calendar'
                    ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-4 h-4 text-slate-800" />
                <span>Ekspor & Sinkronisasi Kalender (.ICS)</span>
              </button>
            </div>

            {/* SUBTAB 0: KONFIRMASI USER SSO BARU (SUPER ADMIN ONLY) */}
            {settingsTab === 'approvals' && isSuperAdmin && (
              <PendingApprovalsPanel
                pendingApprovals={pendingApprovals}
                onApprove={approvePendingUser}
                onReject={rejectPendingUser}
              />
            )}

            {/* SUBTAB 1: KELOLA ROLE KELAS (SUPER ADMIN ONLY) */}
            {settingsTab === 'roles' && (
              <div className="space-y-6">
                <MembersErrorBanner />
                {/* Header Explainer Card */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        Hak Khusus Super Admin
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-600 font-semibold">Manajemen Izin & Peran Pengguna</span>
                    </div>
                    <button
                      onClick={() => setShowAddMemberModal(true)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Anggota Baru
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">
                    Pengaturan Hak Akses & Role Anggota Kelas
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                    Sebagai <strong>Super Admin</strong>, Anda memiliki hak penuh untuk menentukan peran setiap pengguna. Perubahan role akan langsung mengubah izin akun pengguna secara real-time tanpa mengganggu sesi autentikasi Firebase.
                  </p>

                  {/* 3 Role Definitions Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-amber-600" /> Super Admin
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-900">{superAdminCount} akun</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Full manage aplikasi, menu Pengaturan, konfigurasi database cloud/pribadi, dan Kelola Role.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-yellow-50/70 border border-yellow-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-yellow-950 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-yellow-600" /> Admin Kelas
                        </span>
                        <span className="text-xs font-mono font-bold text-yellow-900">{classAdminCount} akun</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Ketua kelas: dapat mengirim, memperbarui, dan mengedit semua jadwal, berita kelas, dan pengingat.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-slate-600" /> Member Kelas
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-700">{memberCount} akun</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Mahasiswa biasa: hak akses baca untuk melihat beranda, jadwal kuliah mingguan, berita, dan pengingat.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filter and Table of Users */}
                <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari berdasarkan nama, NIM, atau email..."
                        value={roleSearchQuery}
                        onChange={(e) => setRoleSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                      />
                    </div>

                    {/* Filter Role Segmented Control */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                      <button
                        onClick={() => setRoleFilter('all')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          roleFilter === 'all' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua ({classMembers.length})
                      </button>
                      <button
                        onClick={() => setRoleFilter('super_admin')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          roleFilter === 'super_admin' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Super Admin ({superAdminCount})
                      </button>
                      <button
                        onClick={() => setRoleFilter('class_admin')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          roleFilter === 'class_admin' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Admin Kelas ({classAdminCount})
                      </button>
                      <button
                        onClick={() => setRoleFilter('class_member')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          roleFilter === 'class_member' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Member ({memberCount})
                      </button>
                    </div>
                  </div>

                  {/* Members Table with In-Place Role Editor */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Nama Anggota</th>
                          <th className="py-2.5 px-3">NIM</th>
                          <th className="py-2.5 px-3">Email Kampus</th>
                          <th className="py-2.5 px-3">Status Role</th>
                          <th className="py-2.5 px-3 text-right">Ubah Role Kelas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMembers.map((mhs) => (
                          <tr key={mhs.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={mhs.avatarUrl}
                                  alt={mhs.name}
                                  className="w-8 h-8 rounded-full object-cover border border-amber-300"
                                />
                                <div>
                                  <span className="font-bold text-slate-900 block">{mhs.name}</span>
                                  {mhs.email === user?.email && (
                                    <span className="text-[10px] text-amber-700 font-semibold">(Akun Anda)</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-500">{mhs.nim}</td>
                            <td className="py-3 px-3 text-slate-600">{mhs.email}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                                  mhs.role === 'super_admin'
                                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                                    : mhs.role === 'class_admin'
                                    ? 'bg-yellow-100 text-yellow-950 border-yellow-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {mhs.role === 'super_admin' && <Crown className="w-3 h-3 text-amber-700" />}
                                {mhs.role === 'class_admin' && <ShieldCheck className="w-3 h-3 text-yellow-700" />}
                                {mhs.role === 'class_member' && <GraduationCap className="w-3 h-3 text-slate-600" />}
                                {ROLE_DEFINITIONS[mhs.role]?.label || mhs.role}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <select
                                value={mhs.role}
                                onChange={(e) => updateMemberRole(mhs.id, e.target.value as UserRole)}
                                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 hover:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                              >
                                <option value="super_admin">Super Admin (Full Manage)</option>
                                <option value="class_admin">Admin Kelas (Ketua Kelas)</option>
                                <option value="class_member">Member Kelas (Mahasiswa)</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 2: KONEKSI DATABASE & API PRIBADI (SUPER ADMIN) */}
            {settingsTab === 'database' && isSuperAdmin && (
              <div className="space-y-6">
                {/* Header card with Isolation Guarantee */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      Penyimpanan Terisolasi
                    </span>
                    <span className="text-xs text-slate-400 font-medium">·</span>
                    <span className="text-xs text-amber-800 font-bold">
                      Jaminan: Firebase Auth Tetap 100% Independen & Aman
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">
                    Konfigurasi Basis Data & REST API Pribadi
                  </h3>
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-slate-700 space-y-2 leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      Prinsip Pemisahan Tugas (Separation of Concerns):
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        <strong>Autentikasi Pengguna</strong> dikelola sepenuhnya oleh <strong>Firebase Auth (Google SSO)</strong>. Sesi login, identitas akun, role, dan token JWT tidak akan pernah terpengaruh atau terputus bila database pribadi offline.
                      </li>
                      <li>
                        <strong>Penyimpanan Data Kelas</strong> (jadwal, pengumuman, pengingat) dapat diarahkan ke <strong>Firestore</strong>, <strong>API Backend Pribadi</strong> (PostgreSQL, MySQL, Supabase, Express), atau <strong>Lokal Offline</strong>.
                      </li>
                      <li>
                        Setiap pemanggilan ke API pribadi dapat meneruskan <strong>Firebase ID Token (JWT)</strong> di header sehingga server pribadi Anda dapat memvalidasi identitas mahasiswa dengan aman.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Database Provider Selector */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Pilih Basis Data Aktif (Active Database Engine)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Card 1: Firestore */}
                    <div
                      onClick={() => setDbProvider('firestore')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        dbProvider === 'firestore'
                          ? 'bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                          <Database className="w-5 h-5" />
                        </div>
                        {dbProvider === 'firestore' && (
                          <span className="text-[10px] font-bold text-amber-950 bg-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Terpilih
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Firebase Firestore</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Layanan cloud real-time terkelola bawaan Firebase. Tanpa perlu setup server database mandiri.
                      </p>
                    </div>

                    {/* Card 2: Custom API */}
                    <div
                      onClick={() => setDbProvider('custom_api')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        dbProvider === 'custom_api'
                          ? 'bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                          <Server className="w-5 h-5" />
                        </div>
                        {dbProvider === 'custom_api' && (
                          <span className="text-[10px] font-bold text-amber-950 bg-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Terpilih
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">API / Database Pribadi</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Hubungkan ke endpoint REST API pribadi (PostgreSQL, MySQL, Supabase, self-hosted Docker).
                      </p>
                    </div>

                    {/* Card 3: Local Offline */}
                    <div
                      onClick={() => setDbProvider('local_offline')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        dbProvider === 'local_offline'
                          ? 'bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-slate-200 text-slate-800 rounded-xl">
                          <HardDrive className="w-5 h-5" />
                        </div>
                        {dbProvider === 'local_offline' && (
                          <span className="text-[10px] font-bold text-amber-950 bg-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Terpilih
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Lokal / Offline Mandiri</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Simpan data secara eksklusif di memori lokal peramban tanpa koneksi keluar.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Konfigurasi Database Pribadi */}
                <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Parameter Koneksi Server REST API Pribadi</h4>
                      <p className="text-xs text-slate-500">
                        Tentukan URL endpoint backend yang mengelola operasi CRUD jadwal, berita, dan pengingat
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveDbConfig} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Base URL Server API Pribadi
                      </label>
                      <input
                        type="text"
                        inputMode="url"
                        required
                        placeholder="Contoh: https://api.kampus-pribadi.ac.id/v1 atau http://localhost:8000/api"
                        value={customApiUrl}
                        onChange={(e) => setCustomApiUrl(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-hidden focus:border-amber-500 text-xs"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Aplikasi memanggil rute <code className="text-amber-700 font-mono">/schedules</code>, <code className="text-amber-700 font-mono">/announcements</code>, <code className="text-amber-700 font-mono">/reminders</code>, dan <code className="text-amber-700 font-mono">/users</code>. Mendukung respon array langsung maupun pembungkus envelope (<code className="text-amber-800 font-mono">&#123; data: [...] &#125;</code>) dan penamaan kolom snake_case/camelCase otomatis.
                      </p>
                    </div>

                    {/* Authentication Header Mode Selector */}
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Mode Header Autentikasi ke Server Pribadi
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label
                          className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${
                            authHeaderMode === 'firebase_jwt'
                              ? 'bg-amber-50/70 border-amber-400'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="authHeaderMode"
                            checked={authHeaderMode === 'firebase_jwt'}
                            onChange={() => setAuthHeaderMode('firebase_jwt')}
                            className="mt-0.5 text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">Kirim Firebase ID Token (JWT)</span>
                            <span className="text-[11px] text-slate-500 leading-tight block">
                              Meneruskan token Firebase pengguna aktif secara otomatis via <code className="font-mono text-amber-800">Bearer &lt;JWT&gt;</code>.
                            </span>
                          </div>
                        </label>

                        <label
                          className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${
                            authHeaderMode === 'custom_key'
                              ? 'bg-amber-50/70 border-amber-400'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="authHeaderMode"
                            checked={authHeaderMode === 'custom_key'}
                            onChange={() => setAuthHeaderMode('custom_key')}
                            className="mt-0.5 text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">API Key / Token Statis Manual</span>
                            <span className="text-[11px] text-slate-500 leading-tight block">
                              Gunakan secret key API statis yang Anda tentukan sendiri di bawah.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {authHeaderMode === 'custom_key' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">
                            API Secret Key / Bearer Token
                          </label>
                          <input
                            type="password"
                            placeholder="Contoh: eyJhbGciOiJIUzI1NiIsIn..."
                            value={customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">
                            Nama Header
                          </label>
                          <input
                            type="text"
                            placeholder="Authorization"
                            value={customAuthHeader}
                            onChange={(e) => setCustomAuthHeader(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Toggle Dual-Sync */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-slate-900">Cadangan Sinkronisasi Otomatis ke Firestore</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Tetap simpan salinan cadangan (*failover redundancy*) ke Firestore saat terkoneksi ke database pribadi.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={syncFirestoreBackup}
                        onChange={(e) => setSyncFirestoreBackup(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-white border-slate-300"
                      />
                    </div>

                    {/* Test Connection Result Banner */}
                    {connectionResult && (
                      <div
                        className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                          connectionResult.success
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-rose-50 border-rose-300 text-rose-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold mb-1">
                          {connectionResult.success ? (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span>{connectionResult.success ? 'Koneksi Berhasil' : 'Koneksi Gagal / Catatan'}</span>
                        </div>
                        <p>{connectionResult.message}</p>
                      </div>
                    )}

                    {saveSuccessMsg && (
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        Konfigurasi database berhasil disimpan dan diterapkan!
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        disabled={testingConnection}
                        onClick={handleTestCustomDb}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold border border-slate-200 flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                        {testingConnection ? 'Menguji Koneksi...' : 'Uji Koneksi Server Pribadi'}
                      </button>

                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-xs flex items-center gap-2 transition-all active:scale-95"
                      >
                        <Check className="w-4 h-4" />
                        Simpan & Terapkan Konfigurasi
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* SUBTAB 3: EKSPOR & KALENDER (.ICS) */}
            {settingsTab === 'calendar' && (
              <div className="space-y-6">
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Sinkronisasi Kalender & Ekspor Data Kelas</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Unduh berkas jadwal kuliah format iCalendar (.ics) yang kompatibel dengan Google Calendar, Apple Calendar, dan Microsoft Outlook.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        const ics = generateSchedulesICS(schedules, 'Jadwal Kuliah Semester');
                        downloadICSFile(ics, 'jadwal-kuliah-semester.ics');
                        notificationService.dispatchNotification(
                          'Berkas Kalender Berhasil Diunduh',
                          'File .ics siap diimpor ke aplikasi Kalender bawaan perangkat Anda.',
                          'normal'
                        );
                      }}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Unduh Kalender Kelas (.ICS)
                    </button>

                    <button
                      onClick={() => dataService.downloadDatabaseJSON()}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Ekspor Seluruh Database (.JSON)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* MODAL: TAMBAH ANGGOTA KELAS BARU (SUPER ADMIN) */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-xl relative">
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                Super Admin
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-4">Tambah Anggota Kelas Baru</h3>

            <form onSubmit={handleAddMemberSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sarah Aulia"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">NIM / Nomor Identitas</label>
                <input
                  type="text"
                  required
                  placeholder="2301092010"
                  value={newMemberNim}
                  onChange={(e) => setNewMemberNim(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Kampus / Akun Google</label>
                <input
                  type="email"
                  required
                  placeholder="sarah.aulia@univ.ac.id"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Peran (Role) Awal</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                >
                  <option value="class_member">Member Kelas (Mahasiswa Biasa)</option>
                  <option value="class_admin">Admin Kelas (Ketua Kelas)</option>
                  <option value="super_admin">Super Admin (Full Manage)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs"
                >
                  Simpan Anggota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT READ RECEIPTS AUDIT MODAL */}
      {inspectAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 shadow-xl max-h-[85vh] flex flex-col relative">
            <button
              onClick={() => setInspectAnnouncement(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                Audit Pembacaan Mahasiswa
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-2">{inspectAnnouncement.title}</h3>

            <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-center justify-between text-xs mb-4">
              <span className="text-slate-700">
                Total Mahasiswa yang Membaca: <strong className="text-emerald-700 font-mono">{inspectAnnouncement.readCount || 0}</strong> dari {classMembers.length}
              </span>
              <span className="font-mono text-xs font-bold text-amber-950">
                {Math.round(((inspectAnnouncement.readCount || 0) / (classMembers.length || 1)) * 100)}% Keterlibatan
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 text-xs">Daftar Mahasiswa yang Telah Membaca:</h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                {classMembers.slice(0, 6).map((mhs, idx) => (
                  <div key={mhs.id} className="p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 block">{mhs.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">NIM: {mhs.nim}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {idx === 0 ? 'Hari ini, 08:35' : `${idx * 15 + 10} menit yang lalu`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectAnnouncement(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SCHEDULE MODAL */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setEditingSchedule(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4">Edit Sesi Divisi: {editingSchedule.courseName}</h3>

            <form onSubmit={handleUpdateSchedule} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Nama Divisi BNI</label>
                <select
                  value={editSchedDivision}
                  onChange={(e) => setEditSchedDivision(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  {BNI_IT_DIVISIONS.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Materi / Topik Pelatihan ODP</label>
                <input
                  type="text"
                  required
                  value={editSchedCourse}
                  onChange={(e) => setEditSchedCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Kode Modul Sesi</label>
                <input
                  type="text"
                  required
                  value={editSchedCode}
                  onChange={(e) => setEditSchedCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Pembicara</label>
                <input
                  type="text"
                  required
                  value={editSchedLecturer}
                  onChange={(e) => setEditSchedLecturer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Jabatan / Role Pembicara</label>
                <select
                  value={editSchedSpeakerRole}
                  onChange={(e) => setEditSchedSpeakerRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  {BNI_SPEAKER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ruang Kelas yang Digunakan</label>
                <input
                  type="text"
                  value={editSchedRoom}
                  onChange={(e) => setEditSchedRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Jadwal Hari</label>
                <select
                  value={editSchedDay}
                  onChange={(e) => setEditSchedDay(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  {DAYS_OF_WEEK.slice(0, 6).map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Jam Mulai & Selesai</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={editSchedStart}
                    onChange={(e) => setEditSchedStart(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="time"
                    value={editSchedEnd}
                    onChange={(e) => setEditSchedEnd(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs"
                >
                  Perbarui Jadwal Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT REMINDER MODAL */}
      {editingReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-xl relative">
            <button
              onClick={() => setEditingReminder(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4">Edit Pengingat: {editingReminder.title}</h3>

            <form onSubmit={handleUpdateReminder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Judul Agenda</label>
                <input
                  type="text"
                  required
                  value={editRemTitle}
                  onChange={(e) => setEditRemTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Batas Waktu (Deadline)</label>
                <input
                  type="datetime-local"
                  required
                  value={editRemDeadline}
                  onChange={(e) => setEditRemDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingReminder(null)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Perbarui Pengingat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
