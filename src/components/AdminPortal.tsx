import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClassData } from '../context/ClassDataContext';
import { Announcement, ScheduleItem, ReminderItem, StudentMember } from '../types';
import { CLASS_STUDENTS, DAYS_OF_WEEK } from '../lib/seedData';
import { generateSchedulesICS, downloadICSFile } from '../lib/calendarSync';
import { notificationService } from '../lib/notifications';
import { dataService, DatabaseProviderType } from '../lib/dataService';

export const AdminPortal: React.FC = () => {
  const { user } = useAuth();
  const {
    schedules,
    announcements,
    reminders,
    readReceipts,
    dbConfig,
    updateDbConfig,
    addAnnouncement,
    deleteAnnouncement,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addReminder,
    updateReminder,
    deleteReminder,
  } = useClassData();

  // Active admin section
  const [activeSection, setActiveSection] = useState<'analytics' | 'announcements' | 'schedules' | 'reminders' | 'roster' | 'database'>('analytics');

  // Announcement Form State
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<Announcement['priority']>('important');
  const [annCategory, setAnnCategory] = useState<Announcement['category']>('academic');
  const [annAttachment, setAnnAttachment] = useState('');
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  // Schedule Form State
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [schedCourse, setSchedCourse] = useState('');
  const [schedCode, setSchedCode] = useState('');
  const [schedLecturer, setSchedLecturer] = useState(user?.displayName || 'Dr. Ir. Budi Rahardjo');
  const [schedDay, setSchedDay] = useState<number>(1);
  const [schedStart, setSchedStart] = useState('08:00');
  const [schedEnd, setSchedEnd] = useState('10:30');
  const [schedRoom, setSchedRoom] = useState('Lab Komputasi 302');
  const [schedBuilding, setSchedBuilding] = useState('Gedung Fasilkom Lt. 3');
  const [schedType, setSchedType] = useState<ScheduleItem['classType']>('offline');
  const [schedNotes, setSchedNotes] = useState('');

  // Reminder Form State
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remCourse, setRemCourse] = useState(schedules[0]?.courseName || 'Rekayasa Perangkat Lunak Terapan');
  const [remDeadline, setRemDeadline] = useState('2026-11-10T23:59');
  const [remType, setRemType] = useState<ReminderItem['reminderType']>('assignment');
  const [remPriority, setRemPriority] = useState<'low' | 'medium' | 'high'>('high');
  const [remDesc, setRemDesc] = useState('');

  // Student Read Details Modal State
  const [inspectAnnouncement, setInspectAnnouncement] = useState<Announcement | null>(null);

  // Custom Database Settings State
  const [dbProvider, setDbProvider] = useState<DatabaseProviderType>(dbConfig.provider);
  const [customApiUrl, setCustomApiUrl] = useState(dbConfig.apiBaseUrl);
  const [customApiKey, setCustomApiKey] = useState(dbConfig.apiKey || '');
  const [customAuthHeader, setCustomAuthHeader] = useState(dbConfig.authHeaderName || 'Authorization');
  const [syncFirestoreBackup, setSyncFirestoreBackup] = useState(dbConfig.syncWithFirestoreBackup);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; latencyMs?: number; message: string } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);

  const handleTestCustomDb = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await dataService.testConnection(customApiUrl, customApiKey);
      setConnectionResult(res);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveDbConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateDbConfig({
      provider: dbProvider,
      apiBaseUrl: customApiUrl.trim(),
      apiKey: customApiKey.trim(),
      authHeaderName: customAuthHeader.trim(),
      syncWithFirestoreBackup: syncFirestoreBackup,
      lastConnectedAt: new Date().toISOString(),
    });
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  // Compute analytics
  const totalStudents = 42;
  const totalAnnouncements = announcements.length;
  const avgReadRate =
    totalAnnouncements > 0
      ? Math.round(
          (announcements.reduce((acc, a) => acc + (a.readCount || 0), 0) / (totalAnnouncements * totalStudents)) *
            100
        )
      : 0;

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    setIsSubmittingAnn(true);
    try {
      await addAnnouncement({
        title: annTitle,
        content: annContent,
        priority: annPriority,
        category: annCategory,
        authorId: user?.id || 'admin-1',
        authorName: user?.displayName || 'Dian Pratama, M.Kom.',
        attachmentName: annAttachment.trim() || undefined,
      });

      setAnnTitle('');
      setAnnContent('');
      setAnnAttachment('');
      setActiveSection('announcements');
    } finally {
      setIsSubmittingAnn(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedCourse.trim() || !schedCode.trim()) return;

    await addSchedule({
      courseName: schedCourse,
      courseCode: schedCode,
      lecturer: schedLecturer,
      dayOfWeek: schedDay,
      startTime: schedStart,
      endTime: schedEnd,
      room: schedRoom,
      building: schedBuilding,
      classType: schedType,
      notes: schedNotes.trim() || undefined,
    });

    setSchedCourse('');
    setSchedCode('');
    setShowAddSchedule(false);
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;

    await addReminder({
      title: remTitle,
      courseName: remCourse,
      deadline: remDeadline,
      reminderType: remType,
      description: remDesc || 'Tenggat waktu pengerjaan resmi dari dosen.',
      priority: remPriority,
    });

    setRemTitle('');
    setRemDesc('');
    setShowAddReminder(false);
  };

  // Editing Schedule State
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [editSchedCourse, setEditSchedCourse] = useState('');
  const [editSchedCode, setEditSchedCode] = useState('');
  const [editSchedLecturer, setEditSchedLecturer] = useState('');
  const [editSchedDay, setEditSchedDay] = useState<number>(1);
  const [editSchedStart, setEditSchedStart] = useState('08:00');
  const [editSchedEnd, setEditSchedEnd] = useState('10:30');
  const [editSchedRoom, setEditSchedRoom] = useState('');
  const [editSchedBuilding, setEditSchedBuilding] = useState('');
  const [editSchedType, setEditSchedType] = useState<ScheduleItem['classType']>('offline');
  const [editSchedNotes, setEditSchedNotes] = useState('');

  // Editing Reminder State
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [editRemTitle, setEditRemTitle] = useState('');
  const [editRemCourse, setEditRemCourse] = useState('');
  const [editRemDeadline, setEditRemDeadline] = useState('');
  const [editRemType, setEditRemType] = useState<ReminderItem['reminderType']>('assignment');
  const [editRemPriority, setEditRemPriority] = useState<'low' | 'medium' | 'high'>('high');
  const [editRemDesc, setEditRemDesc] = useState('');

  const openEditSchedule = (sch: ScheduleItem) => {
    setEditingSchedule(sch);
    setEditSchedCourse(sch.courseName);
    setEditSchedCode(sch.courseCode);
    setEditSchedLecturer(sch.lecturer);
    setEditSchedDay(sch.dayOfWeek);
    setEditSchedStart(sch.startTime);
    setEditSchedEnd(sch.endTime);
    setEditSchedRoom(sch.room);
    setEditSchedBuilding(sch.building);
    setEditSchedType(sch.classType);
    setEditSchedNotes(sch.notes || '');
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule || !editSchedCourse.trim()) return;

    await updateSchedule(editingSchedule.id, {
      courseName: editSchedCourse,
      courseCode: editSchedCode,
      lecturer: editSchedLecturer,
      dayOfWeek: editSchedDay,
      startTime: editSchedStart,
      endTime: editSchedEnd,
      room: editSchedRoom,
      building: editSchedBuilding,
      classType: editSchedType,
      notes: editSchedNotes.trim() || undefined,
    });

    setEditingSchedule(null);
  };

  const openEditReminder = (rem: ReminderItem) => {
    setEditingReminder(rem);
    setEditRemTitle(rem.title);
    setEditRemCourse(rem.courseName);
    setEditRemDeadline(rem.deadline);
    setEditRemType(rem.reminderType);
    setEditRemPriority(rem.priority);
    setEditRemDesc(rem.description);
  };

  const handleUpdateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder || !editRemTitle.trim()) return;

    await updateReminder(editingReminder.id, {
      title: editRemTitle,
      courseName: editRemCourse,
      deadline: editRemDeadline,
      reminderType: editRemType,
      priority: editRemPriority,
      description: editRemDesc,
    });

    setEditingReminder(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Banner & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Fakultas Ilmu Komputer</span>
            <span>/</span>
            <span>Teknik Informatika (S-1)</span>
            <span>/</span>
            <span className="text-indigo-400 font-medium">Portal Admin & Dosen</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Pusat Kendali & Analitik Keterlibatan Kelas
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              const ics = generateSchedulesICS(schedules, 'Jadwal Kuliah Semester Ganjil 2026/2027');
              downloadICSFile(ics, 'master-jadwal-kuliah.ics');
            }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            Ekspor Kalender Master (.ICS)
          </button>
        </div>
      </div>

      {/* Main Grid Layout: Left Nav Sidebar + Right Content Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
          <button
            onClick={() => setActiveSection('analytics')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeSection === 'analytics'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard Analitik</span>
          </button>

          <button
            onClick={() => setActiveSection('announcements')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeSection === 'announcements'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4" />
              <span>Kelola Pengumuman</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded-full text-slate-300">
              {announcements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('schedules')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeSection === 'schedules'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4" />
              <span>Kelola Jadwal Kuliah</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded-full text-slate-300">
              {schedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('reminders')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeSection === 'reminders'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4" />
              <span>Kelola Pengingat / Tugas</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded-full text-slate-300">
              {reminders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('roster')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeSection === 'roster'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4" />
              <span>Daftar Mahasiswa</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded-full text-slate-300">
              {totalStudents}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('database')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeSection === 'database'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Koneksi Database</span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">
              {dbConfig.provider === 'firestore' ? 'Firestore' : dbConfig.provider === 'custom_api' ? 'Pribadi' : 'Lokal'}
            </span>
          </button>

          {/* Admin Identity Pill */}
          <div className="pt-4 mt-4 border-t border-slate-800 px-3 py-2">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-200 truncate">{user?.displayName}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Viewport */}
        <main className="lg:col-span-9 space-y-6">
          {/* SECTION 1: DASHBOARD ANALITIK */}
          {activeSection === 'analytics' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* 4 Metric KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Total Mahasiswa</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white font-mono">{totalStudents}</span>
                    <span className="text-xs text-slate-400">Terdaftar</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Rata-Rata View Rate</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-emerald-400 font-mono">{avgReadRate}%</span>
                    <span className="text-xs text-emerald-500/80 font-medium">+4.2%</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Pengumuman Aktif</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-indigo-400 font-mono">{announcements.length}</span>
                    <span className="text-xs text-slate-400">Siaran</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Tenggat Waktu</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-amber-400 font-mono">{reminders.length}</span>
                    <span className="text-xs text-slate-400">Pengingat</span>
                  </div>
                </div>
              </div>

              {/* 7-Day Engagement Chart Visualizer */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Grafik Keterlibatan Pembacaan (7 Hari Terakhir)</h3>
                    <p className="text-xs text-slate-400">Jumlah mahasiswa yang mengakses edaran & pengingat per hari</p>
                  </div>
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    Target: &gt;80% Capai
                  </span>
                </div>

                {/* Simulated SVG Bar/Area Chart */}
                <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-800">
                  {[
                    { day: '28 Okt', views: 34, pct: 81 },
                    { day: '29 Okt', views: 38, pct: 90 },
                    { day: '30 Okt', views: 36, pct: 85 },
                    { day: '31 Okt', views: 40, pct: 95 },
                    { day: '1 Nov', views: 41, pct: 97 },
                    { day: '2 Nov', views: 39, pct: 92 },
                    { day: 'Hari Ini', views: 42, pct: 100 },
                  ].map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-300 transition-colors">
                        {bar.views} mhs
                      </span>
                      <div
                        style={{ height: `${bar.pct}%` }}
                        className={`w-full max-w-[42px] rounded-t-lg transition-all ${
                          i === 6 ? 'bg-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-slate-800 group-hover:bg-slate-700'
                        }`}
                      ></div>
                      <span className="text-[10px] text-slate-400 font-medium truncate">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Announcements Engagement Audit Table */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Status Pembacaan Pengumuman Kelas</h3>
                    <p className="text-xs text-slate-400">
                      Audit real-time mahasiswa yang telah membaca setiap pengumuman yang disiarkan
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Judul Pengumuman</th>
                        <th className="py-2.5 px-3">Prioritas</th>
                        <th className="py-2.5 px-3">Dosen Pengampu</th>
                        <th className="py-2.5 px-3 text-right">Pembaca (Views)</th>
                        <th className="py-2.5 px-3 text-right">Rasio Pembacaan</th>
                        <th className="py-2.5 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {announcements.map((ann) => {
                        const count = ann.readCount || 0;
                        const pct = Math.round((count / totalStudents) * 100);

                        return (
                          <tr key={ann.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3 font-medium text-slate-100 max-w-xs truncate">
                              {ann.title}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  ann.priority === 'urgent'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : ann.priority === 'important'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {ann.priority}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400">{ann.authorName}</td>
                            <td className="py-3 px-3 text-right font-mono font-medium">
                              {count} / {totalStudents}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${pct}%` }}
                                    className={`h-full rounded-full ${
                                      pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`}
                                  ></div>
                                </div>
                                <span className="font-mono text-[11px] font-semibold text-slate-200">{pct}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => setInspectAnnouncement(ann)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-medium text-[11px] border border-indigo-500/20 flex items-center gap-1 mx-auto"
                              >
                                <Eye className="w-3 h-3" />
                                Rincian
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: KELOLA PENGUMUMAN */}
          {activeSection === 'announcements' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Creator Form */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white">Buat Pemberitahuan & Berita Kelas Baru</h3>
                    <p className="text-xs text-slate-400">
                      Pengumuman akan otomatis terkirim dan memicu push notifikasi ke seluruh mahasiswa
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePublishAnnouncement} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Judul Pengumuman</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Perubahan Ruang Kuliah / Pengumuman Ujian Susulan..."
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Kategori Pengumuman</label>
                      <select
                        value={annCategory}
                        onChange={(e) => setAnnCategory(e.target.value as Announcement['category'])}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:border-indigo-500 text-xs"
                      >
                        <option value="academic">Akademik & Perkuliahan</option>
                        <option value="schedule_change">Perubahan Jadwal / Ruang</option>
                        <option value="exam">Ujian (UTS / UAS / Kuis)</option>
                        <option value="event">Kegiatan Kampus / Seminar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Tingkat Prioritas</label>
                      <select
                        value={annPriority}
                        onChange={(e) => setAnnPriority(e.target.value as Announcement['priority'])}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:border-indigo-500 text-xs"
                      >
                        <option value="normal">Normal (Info Reguler)</option>
                        <option value="important">Penting (Wajib Diperhatikan)</option>
                        <option value="urgent">Mendesak (Darurat / Deadline Hari Ini)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Isi Pesan / Instruksi Lengkap</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Tuliskan detail pengumuman secara jelas untuk mahasiswa..."
                      value={annContent}
                      onChange={(e) => setAnnContent(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs leading-relaxed"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Lampiran Dokumen (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Nama file lampiran (Contoh: Panduan_Praktikum_Bab3.pdf)"
                      value={annAttachment}
                      onChange={(e) => setAnnAttachment(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingAnn}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                      {isSubmittingAnn ? 'Menerbitkan...' : 'Terbitkan & Kirim Push Notifikasi'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Announcements Table */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white">Daftar Pengumuman Aktif</h3>

                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              ann.priority === 'urgent'
                                ? 'bg-rose-500/20 text-rose-400'
                                : ann.priority === 'important'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {ann.priority}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-400">{new Date(ann.publishedAt).toLocaleDateString('id-ID')}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">{ann.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{ann.content}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setInspectAnnouncement(ann)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg transition-colors"
                          title="Lihat Mahasiswa yang Membaca"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(ann.id)}
                          className="p-2 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                          title="Hapus Pengumuman"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: KELOLA JADWAL KULIAH */}
          {activeSection === 'schedules' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Jadwal Kuliah Mingguan</h3>
                  <p className="text-xs text-slate-400">
                    Atur jadwal tatap muka, ruangan lab, dosen pengampu, dan waktu perkuliahan
                  </p>
                </div>
                <button
                  onClick={() => setShowAddSchedule(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Sesi Kuliah
                </button>
              </div>

              {/* Add Schedule Modal */}
              {showAddSchedule && (
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-700 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Form Tambah Jadwal Baru</h4>
                    <button
                      onClick={() => setShowAddSchedule(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateSchedule} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Nama Mata Kuliah</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Pemrograman Web Lanjut"
                        value={schedCourse}
                        onChange={(e) => setSchedCourse(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Kode MK</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: IF-320"
                        value={schedCode}
                        onChange={(e) => setSchedCode(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Dosen Pengampu</label>
                      <input
                        type="text"
                        required
                        value={schedLecturer}
                        onChange={(e) => setSchedLecturer(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Hari Perkuliahan</label>
                      <select
                        value={schedDay}
                        onChange={(e) => setSchedDay(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      >
                        {DAYS_OF_WEEK.slice(0, 6).map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Jam Mulai & Selesai</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={schedStart}
                          onChange={(e) => setSchedStart(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                        />
                        <span className="text-slate-500">-</span>
                        <input
                          type="time"
                          value={schedEnd}
                          onChange={(e) => setSchedEnd(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Ruangan & Gedung</label>
                      <input
                        type="text"
                        placeholder="Contoh: Lab Mobile 202"
                        value={schedRoom}
                        onChange={(e) => setSchedRoom(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      />
                    </div>

                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddSchedule(false)}
                        className="px-4 py-2 text-slate-400 hover:text-slate-200"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold"
                      >
                        Simpan Sesi Jadwal
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Schedules Table */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Hari</th>
                      <th className="py-2.5 px-3">Jam</th>
                      <th className="py-2.5 px-3">Mata Kuliah</th>
                      <th className="py-2.5 px-3">Dosen</th>
                      <th className="py-2.5 px-3">Ruang</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {schedules.map((sch) => (
                      <tr key={sch.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-sans font-semibold text-indigo-400">
                          {DAYS_OF_WEEK.find((d) => d.value === sch.dayOfWeek)?.label}
                        </td>
                        <td className="py-3 px-3">
                          {sch.startTime} - {sch.endTime}
                        </td>
                        <td className="py-3 px-3 font-sans font-medium text-slate-100">
                          {sch.courseName} <span className="text-[10px] text-slate-400 font-mono">({sch.courseCode})</span>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-400">{sch.lecturer}</td>
                        <td className="py-3 px-3 font-sans text-slate-300">{sch.room}</td>
                        <td className="py-3 px-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditSchedule(sch)}
                              className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-600/20 rounded-md transition-colors"
                              title="Edit Jadwal Kuliah"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteSchedule(sch.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 4: KELOLA PENGINGAT */}
          {activeSection === 'reminders' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Kelola Pengingat & Tenggat Waktu Kelas</h3>
                  <p className="text-xs text-slate-400">
                    Tetapkan tanggal deadline tugas, kuis online, dan ujian untuk seluruh anak kelas
                  </p>
                </div>
                <button
                  onClick={() => setShowAddReminder(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Buat Pengingat Baru
                </button>
              </div>

              {/* Add Reminder Modal */}
              {showAddReminder && (
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-700 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Form Buat Pengingat Baru</h4>
                    <button onClick={() => setShowAddReminder(false)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateReminder} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Judul Tugas / Agenda</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Pengumpulan Laporan Capstone..."
                        value={remTitle}
                        onChange={(e) => setRemTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Mata Kuliah Terkait</label>
                      <select
                        value={remCourse}
                        onChange={(e) => setRemCourse(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      >
                        {schedules.map((s) => (
                          <option key={s.id} value={s.courseName}>
                            {s.courseName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Batas Waktu (Deadline)</label>
                      <input
                        type="datetime-local"
                        required
                        value={remDeadline}
                        onChange={(e) => setRemDeadline(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Tipe Pengingat</label>
                      <select
                        value={remType}
                        onChange={(e) => setRemType(e.target.value as ReminderItem['reminderType'])}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                      >
                        <option value="assignment">Tugas Mandiri / Kelompok</option>
                        <option value="quiz">Kuis Online</option>
                        <option value="exam">Ujian (UTS / UAS)</option>
                        <option value="project">Proyek Capstone</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-medium mb-1">Deskripsi Tambahan</label>
                      <textarea
                        rows={2}
                        placeholder="Instruksi pengumpulan atau format file..."
                        value={remDesc}
                        onChange={(e) => setRemDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      ></textarea>
                    </div>

                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddReminder(false)}
                        className="px-4 py-2 text-slate-400 hover:text-slate-200"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold"
                      >
                        Terbitkan Pengingat
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Reminders List */}
              <div className="space-y-3">
                {reminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">
                          {rem.reminderType}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-400 font-medium">{rem.courseName}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">{rem.title}</h4>
                      <p className="text-xs text-slate-400">{rem.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 block">
                        Batas: {new Date(rem.deadline).toLocaleDateString('id-ID')}
                      </span>
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => openEditReminder(rem)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
                          title="Edit Pengingat"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <span className="text-slate-600">·</span>
                        <button
                          onClick={() => deleteReminder(rem.id)}
                          className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                          title="Hapus Pengingat"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 5: ROSTER MAHASISWA & AUDIT */}
          {activeSection === 'roster' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Daftar Mahasiswa Kelas (42 Mahasiswa)</h3>
                  <p className="text-xs text-slate-400">Pantau kehadiran dan keaktifan mahasiswa dalam mengakses portal</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Mahasiswa</th>
                      <th className="py-2.5 px-3">NIM</th>
                      <th className="py-2.5 px-3">Email Kampus</th>
                      <th className="py-2.5 px-3 text-right">Tingkat Kehadiran</th>
                      <th className="py-2.5 px-3 text-right">Terakhir Aktif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {CLASS_STUDENTS.map((mhs) => (
                      <tr key={mhs.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={mhs.avatarUrl}
                              alt={mhs.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-700"
                            />
                            <span className="font-semibold text-slate-100">{mhs.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">{mhs.nim}</td>
                        <td className="py-3 px-3 text-slate-400">{mhs.email}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                          {mhs.attendanceRate}%
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400">{mhs.lastActive}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 6: KONEKSI DATABASE PRIBADI */}
          {activeSection === 'database' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header card */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded">
                    Integrasi Basis Data
                  </span>
                  <span className="text-xs text-slate-400 font-medium">·</span>
                  <span className="text-xs text-indigo-400 font-medium">Auth: Firebase Google SSO (Aktif)</span>
                </div>
                <h3 className="text-base font-bold text-white">Konfigurasi Sumber Data & Database Pribadi</h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  Sistem autentikasi dan identitas pengguna tetap terkelola aman menggunakan <strong>Firebase Auth (Google SSO)</strong>. Untuk penyimpanan data jadwal, pengumuman, dan pengingat, Anda dapat memilih antara basis data cloud <strong>Firestore</strong>, atau menghubungkan langsung ke <strong>server / REST API database pribadi Anda</strong> (PostgreSQL, MySQL, Supabase, backend Express/FastAPI, dll).
                </p>
              </div>

              {/* Provider Selection Cards */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Pilih Basis Data Aktif (Active Database Provider)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Card 1: Firestore */}
                  <div
                    onClick={() => setDbProvider('firestore')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      dbProvider === 'firestore'
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                        <Database className="w-5 h-5" />
                      </div>
                      {dbProvider === 'firestore' && (
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Terpilih
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-100">Firebase Firestore</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Layanan cloud real-time terkelola bawaan Firebase. Tanpa perlu setup server database mandiri.
                    </p>
                  </div>

                  {/* Card 2: Custom API */}
                  <div
                    onClick={() => setDbProvider('custom_api')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      dbProvider === 'custom_api'
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                        <Server className="w-5 h-5" />
                      </div>
                      {dbProvider === 'custom_api' && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Terpilih
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-100">API / Database Pribadi</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Hubungkan ke endpoint REST API pribadi (PostgreSQL, MySQL, Supabase, self-hosted Docker backend).
                    </p>
                  </div>

                  {/* Card 3: Local Offline */}
                  <div
                    onClick={() => setDbProvider('local_offline')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      dbProvider === 'local_offline'
                        ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      {dbProvider === 'local_offline' && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Terpilih
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-100">Lokal / Offline Mandiri</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Simpan data secara eksklusif di memori lokal peramban peranti tanpa mengirim trafik ke cloud.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Konfigurasi Database Pribadi */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white">Parameter Koneksi Server REST API Pribadi</h4>
                    <p className="text-xs text-slate-400">
                      Tentukan URL endpoint backend yang mengelola operasi CRUD jadwal, berita, dan pengingat
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveDbConfig} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Base URL Server API Pribadi
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="Contoh: https://api.kampus-pribadi.ac.id/v1 atau http://localhost:8000/api"
                      value={customApiUrl}
                      onChange={(e) => setCustomApiUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-hidden focus:border-indigo-500 text-xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Aplikasi akan memanggil rute seperti <code className="text-indigo-400 font-mono">/schedules</code>, <code className="text-indigo-400 font-mono">/announcements</code>, dan <code className="text-indigo-400 font-mono">/reminders</code> di endpoint ini.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        API Secret Key / Bearer Token (Opsional)
                      </label>
                      <input
                        type="password"
                        placeholder="Contoh: eyJhbGciOiJIUzI1NiIsIn..."
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-hidden focus:border-indigo-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        Nama Header Autentikasi
                      </label>
                      <input
                        type="text"
                        placeholder="Authorization"
                        value={customAuthHeader}
                        onChange={(e) => setCustomAuthHeader(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-hidden focus:border-indigo-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* Toggle Dual-Sync */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <h5 className="font-semibold text-slate-200">Cadangan Sinkronisasi Otomatis ke Firestore</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tetap simpan salinan cadangan (*redundancy failover*) ke Firestore saat terkoneksi ke database pribadi.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={syncFirestoreBackup}
                      onChange={(e) => setSyncFirestoreBackup(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                    />
                  </div>

                  {/* Test Connection Result Banner */}
                  {connectionResult && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                        connectionResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold mb-1">
                        {connectionResult.success ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{connectionResult.success ? 'Koneksi Berhasil' : 'Koneksi Gagal / Periksa Konfigurasi'}</span>
                      </div>
                      <p>{connectionResult.message}</p>
                    </div>
                  )}

                  {saveSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Konfigurasi database berhasil disimpan dan diterapkan!
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      disabled={testingConnection}
                      onClick={handleTestCustomDb}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium border border-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                      {testingConnection ? 'Menguji Koneksi...' : 'Uji Koneksi Server Pribadi'}
                    </button>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      Simpan & Terapkan Konfigurasi
                    </button>
                  </div>
                </form>
              </div>

              {/* Data Export & Migration Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">Migrasi & Ekspor Skema Data (.JSON)</h4>
                    <p className="text-xs text-slate-400">
                      Unduh seluruh data jadwal, pengumuman, dan pengingat untuk di-import langsung ke basis data pribadi Anda (PostgreSQL / MySQL / MongoDB)
                    </p>
                  </div>
                  <button
                    onClick={() => dataService.downloadDatabaseJSON()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Unduh Data Lengkap (.JSON)
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowSchemaPreview(!showSchemaPreview)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    {showSchemaPreview ? 'Sembunyikan Panduan REST API' : 'Tampilkan Spesifikasi Endpoint REST API'}
                  </button>

                  {showSchemaPreview && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-3 font-mono">
                      <p className="text-slate-400 font-sans text-xs">
                        Backend API pribadi Anda cukup mengimplementasikan rute standar berikut:
                      </p>
                      <div className="space-y-1.5 text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">GET</span>
                          <span className="text-slate-200">/schedules</span>
                          <span className="text-slate-500 font-sans">· Mengambil daftar jadwal mingguan</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-400 font-bold">POST</span>
                          <span className="text-slate-200">/schedules</span>
                          <span className="text-slate-500 font-sans">· Tambah jadwal sesi kuliah</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">PUT</span>
                          <span className="text-slate-200">/schedules/:id</span>
                          <span className="text-slate-500 font-sans">· Perbarui sesi jadwal</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-rose-400 font-bold">DELETE</span>
                          <span className="text-slate-200">/schedules/:id</span>
                          <span className="text-slate-500 font-sans">· Hapus sesi jadwal</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">GET</span>
                          <span className="text-slate-200">/announcements</span>
                          <span className="text-slate-500 font-sans">· Daftar pengumuman</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-400 font-bold">POST</span>
                          <span className="text-slate-200">/announcements</span>
                          <span className="text-slate-500 font-sans">· Siarkan pengumuman baru</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-400 font-bold">POST</span>
                          <span className="text-slate-200">/announcements/:id/reads</span>
                          <span className="text-slate-500 font-sans">· Catat riwayat pembacaan mahasiswa</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">GET</span>
                          <span className="text-slate-200">/reminders</span>
                          <span className="text-slate-500 font-sans">· Daftar pengingat / tugas</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">PUT</span>
                          <span className="text-slate-200">/reminders/:id</span>
                          <span className="text-slate-500 font-sans">· Perbarui tenggat / status pengingat</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* INSPECT READ RECEIPTS AUDIT MODAL */}
      {inspectAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col relative">
            <button
              onClick={() => setInspectAnnouncement(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                Audit Pembacaan Mahasiswa
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-2">{inspectAnnouncement.title}</h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs mb-4">
              <span className="text-slate-400">
                Total Mahasiswa yang Membaca: <strong className="text-emerald-400 font-mono">{inspectAnnouncement.readCount || 0}</strong> dari 42
              </span>
              <span className="font-mono text-xs font-bold text-slate-200">
                {Math.round(((inspectAnnouncement.readCount || 0) / 42) * 100)}% Keterlibatan
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 text-xs">Daftar Mahasiswa yang Telah Membaca:</h4>
              <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                {CLASS_STUDENTS.slice(0, 7).map((mhs, idx) => (
                  <div key={mhs.id} className="p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-200 block">{mhs.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">NIM: {mhs.nim}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {idx === 0 ? 'Hari ini, 08:35' : `${idx * 15 + 10} menit yang lalu`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectAnnouncement(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SCHEDULE MODAL */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setEditingSchedule(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                Edit Jadwal Kuliah Mingguan
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-4">Edit Sesi: {editingSchedule.courseName}</h3>

            <form onSubmit={handleUpdateSchedule} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nama Mata Kuliah</label>
                <input
                  type="text"
                  required
                  value={editSchedCourse}
                  onChange={(e) => setEditSchedCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Kode MK</label>
                <input
                  type="text"
                  required
                  value={editSchedCode}
                  onChange={(e) => setEditSchedCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Dosen Pengampu</label>
                <input
                  type="text"
                  required
                  value={editSchedLecturer}
                  onChange={(e) => setEditSchedLecturer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Hari Perkuliahan</label>
                <select
                  value={editSchedDay}
                  onChange={(e) => setEditSchedDay(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {DAYS_OF_WEEK.slice(0, 6).map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Jam Mulai & Selesai</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={editSchedStart}
                    onChange={(e) => setEditSchedStart(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                  />
                  <span className="text-slate-500">-</span>
                  <input
                    type="time"
                    value={editSchedEnd}
                    onChange={(e) => setEditSchedEnd(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Mode Perkuliahan</label>
                <select
                  value={editSchedType}
                  onChange={(e) => setEditSchedType(e.target.value as ScheduleItem['classType'])}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="offline">Tatap Muka (Offline)</option>
                  <option value="online">Daring (Online)</option>
                  <option value="hybrid">Campuran (Hybrid)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Ruangan</label>
                <input
                  type="text"
                  required
                  value={editSchedRoom}
                  onChange={(e) => setEditSchedRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Gedung</label>
                <input
                  type="text"
                  required
                  value={editSchedBuilding}
                  onChange={(e) => setEditSchedBuilding(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-medium mb-1">Catatan Tambahan untuk Mahasiswa</label>
                <textarea
                  rows={2}
                  value={editSchedNotes}
                  onChange={(e) => setEditSchedNotes(e.target.value)}
                  placeholder="Contoh: Membawa laptop dengan modul praktikum..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                ></textarea>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md"
                >
                  Simpan Perubahan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT REMINDER MODAL */}
      {editingReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingReminder(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                Edit Pengingat / Tugas
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-4">Edit Pengingat: {editingReminder.title}</h3>

            <form onSubmit={handleUpdateReminder} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-medium mb-1">Judul Agenda / Tugas</label>
                <input
                  type="text"
                  required
                  value={editRemTitle}
                  onChange={(e) => setEditRemTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Mata Kuliah Terkait</label>
                <select
                  value={editRemCourse}
                  onChange={(e) => setEditRemCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.courseName}>
                      {s.courseName}
                    </option>
                  ))}
                  <option value="Agenda Umum">Agenda Umum / Mandiri</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Tipe Pengingat</label>
                <select
                  value={editRemType}
                  onChange={(e) => setEditRemType(e.target.value as ReminderItem['reminderType'])}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="assignment">Tugas Mandiri / Kelompok</option>
                  <option value="quiz">Kuis Online</option>
                  <option value="exam">Ujian (UTS / UAS)</option>
                  <option value="project">Proyek Capstone</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Batas Waktu (Deadline)</label>
                <input
                  type="datetime-local"
                  required
                  value={editRemDeadline.slice(0, 16)}
                  onChange={(e) => setEditRemDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Prioritas</label>
                <select
                  value={editRemPriority}
                  onChange={(e) => setEditRemPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="high">Tinggi (Mendesak)</option>
                  <option value="medium">Sedang</option>
                  <option value="low">Rendah</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-medium mb-1">Deskripsi Tambahan</label>
                <textarea
                  rows={2}
                  value={editRemDesc}
                  onChange={(e) => setEditRemDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                ></textarea>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingReminder(null)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md"
                >
                  Simpan Perubahan Pengingat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
