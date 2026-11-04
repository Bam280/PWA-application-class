import React, { useState, useMemo } from 'react';
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
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  WifiOff,
  Sparkles,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Plus,
  X,
  Share2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClassData } from '../context/ClassDataContext';
import { ScheduleItem, Announcement, ReminderItem, DeviceViewMode } from '../types';
import { DAYS_OF_WEEK } from '../lib/seedData';
import {
  generateSchedulesICS,
  getGoogleCalendarUrlForSchedule,
  getGoogleCalendarUrlForReminder,
  downloadICSFile,
} from '../lib/calendarSync';
import { notificationService } from '../lib/notifications';

interface StudentMobileAppProps {
  viewMode: DeviceViewMode;
}

export const StudentMobileApp: React.FC<StudentMobileAppProps> = ({ viewMode }) => {
  const { user, isOnline } = useAuth();
  const {
    schedules,
    announcements,
    reminders,
    readReceipts,
    markAnnouncementAsRead,
    toggleReminderComplete,
    addReminder,
  } = useClassData();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'announcements' | 'reminders' | 'profile'>('home');

  // Schedule filtering by day (default to today's day 1-7)
  const currentDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<number>(currentDayOfWeek <= 5 ? currentDayOfWeek : 1);

  // Announcement filtering and detail modal
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Reminder filtering & add modal
  const [reminderFilter, setReminderFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [showAddReminderModal, setShowAddReminderModal] = useState<boolean>(false);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderCourse, setNewReminderCourse] = useState(schedules[0]?.courseName || 'Rekayasa Perangkat Lunak');
  const [newReminderDeadline, setNewReminderDeadline] = useState('2026-11-06T23:59');
  const [newReminderType, setNewReminderType] = useState<ReminderItem['reminderType']>('assignment');

  // Filtered schedules for selected day
  const daySchedules = useMemo(() => {
    return schedules
      .filter(s => s.dayOfWeek === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
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

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;

    addReminder({
      title: newReminderTitle,
      courseName: newReminderCourse,
      deadline: newReminderDeadline,
      reminderType: newReminderType,
      description: 'Pengingat dibuat oleh mahasiswa.',
      priority: 'high',
      isCompleted: false,
    });

    setNewReminderTitle('');
    setShowAddReminderModal(false);
  };

  return (
    <div className="flex justify-center p-2 sm:p-6 w-full">
      {/* Mobile Frame Container */}
      <div
        className={`w-full max-w-[420px] bg-slate-900 border border-slate-800 shadow-2xl flex flex-col relative overflow-hidden transition-all duration-300 min-h-[780px] h-[86vh] max-h-[880px] ${
          viewMode === 'mobile-ios' ? 'rounded-[50px] ring-12 ring-slate-800' : 'rounded-[36px] ring-8 ring-slate-800'
        }`}
      >
        {/* iOS Dynamic Island / Android Camera Header simulation */}
        <div className="bg-slate-950 pt-2 pb-1 px-6 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0 select-none">
          <span>09:41</span>
          {viewMode === 'mobile-ios' ? (
            <div className="w-24 h-4 bg-black rounded-full mx-auto flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-900 mr-2"></div>
              <div className="w-2 h-2 rounded-full bg-indigo-950"></div>
            </div>
          ) : (
            <div className="w-3.5 h-3.5 bg-black rounded-full mx-auto"></div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">5G</span>
            <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-0.5 flex">
              <div className="w-full bg-slate-400 h-full rounded-2xs"></div>
            </div>
          </div>
        </div>

        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="bg-amber-600/90 text-white px-4 py-1.5 text-xs flex items-center justify-between shrink-0 shadow-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              Mode Offline: Akses Data Cache Lokal
            </span>
            <span className="text-[10px] bg-amber-800/80 px-1.5 py-0.5 rounded font-mono">Tersimpan</span>
          </div>
        )}

        {/* Top App Bar */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
              UC
            </div>
            <div>
              <h1 className="text-xs font-bold text-white tracking-tight">Teknik Informatika</h1>
              <p className="text-[10px] text-slate-400">Kelas A · Semester Ganjil</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDownloadAllICS}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-medium border border-slate-700/60 flex items-center gap-1 transition-colors"
              title="Ekspor seluruh jadwal ke file kalender .ics"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">.ICS</span>
            </button>
            <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-700">
              <img
                src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Content Viewport */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-20">
          {/* TAB 1: BERANDA (HOME) */}
          {activeTab === 'home' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Student Greeting Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-medium mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Selamat Datang</span>
                  </div>
                  <h2 className="text-base font-bold text-white">{user?.displayName || 'Mahasiswa'}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    NIM: {user?.nim || '2301092001'} · Status: Aktif
                  </p>

                  <div className="mt-3 pt-3 border-t border-indigo-500/20 flex items-center justify-between text-xs">
                    <span className="text-slate-300 text-[11px]">
                      {todayClasses.length > 0
                        ? `Ada ${todayClasses.length} sesi kuliah hari ini`
                        : 'Tidak ada jadwal kuliah hari ini'}
                    </span>
                    <button
                      onClick={() => setActiveTab('schedule')}
                      className="text-indigo-400 hover:text-indigo-300 font-medium text-[11px] flex items-center gap-0.5"
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
                  className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 cursor-pointer hover:bg-rose-500/15 transition-all"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 mt-0.5 shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Pemberitahuan Mendesak</span>
                        <span className="text-[10px] text-slate-400">Hari ini</span>
                      </div>
                      <h3 className="text-xs font-bold text-white mt-0.5 line-clamp-1">
                        {announcements.find(a => a.priority === 'urgent')?.title}
                      </h3>
                      <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                        {announcements.find(a => a.priority === 'urgent')?.content}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upcoming Deadlines Widget */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Pengingat Terdekat</h3>
                  <button
                    onClick={() => setActiveTab('reminders')}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    Lihat Semua
                  </button>
                </div>

                <div className="space-y-2">
                  {reminders.slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-2.5"
                    >
                      <button
                        onClick={() => toggleReminderComplete(item.id)}
                        className="text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                      >
                        {item.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-semibold truncate ${item.isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{item.courseName}</span>
                          <span>·</span>
                          <span className="text-amber-400 font-mono">Batas: {formatDate(item.deadline)}</span>
                        </div>
                      </div>
                      <a
                        href={getGoogleCalendarUrlForReminder(item)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-700/50 rounded-lg shrink-0"
                        title="Simpan pengingat ke Google Calendar"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today's Schedule Overview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Kuliah Hari Ini</h3>
                  <span className="text-[11px] text-slate-400">
                    {DAYS_OF_WEEK.find(d => d.value === currentDayOfWeek)?.label}
                  </span>
                </div>

                {todayClasses.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-center text-xs text-slate-400">
                    Tidak ada jadwal perkuliahan hari ini. Waktu belajar mandiri!
                  </div>
                ) : (
                  todayClasses.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            {item.courseCode}
                          </span>
                          <h4 className="text-xs font-bold text-slate-100 mt-1">{item.courseName}</h4>
                          <p className="text-[11px] text-slate-400">{item.lecturer}</p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-200 bg-slate-900 px-2 py-1 rounded-md border border-slate-800 shrink-0">
                          {item.startTime} - {item.endTime}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          {item.room}
                        </span>
                        <a
                          href={getGoogleCalendarUrlForSchedule(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
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
                  <h2 className="text-sm font-bold text-white">Jadwal Kuliah Mingguan</h2>
                  <p className="text-[11px] text-slate-400">Semester Ganjil 2026/2027</p>
                </div>
                <button
                  onClick={handleDownloadAllICS}
                  className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium rounded-lg border border-indigo-500/30 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh .ICS
                </button>
              </div>

              {/* Day filter pills */}
              <div className="grid grid-cols-6 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {DAYS_OF_WEEK.slice(0, 6).map((day) => (
                  <button
                    key={day.value}
                    onClick={() => setSelectedDay(day.value)}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                      selectedDay === day.value
                        ? 'bg-indigo-600 text-white shadow-sm font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {day.short}
                  </button>
                ))}
              </div>

              {/* Schedule list */}
              <div className="space-y-3">
                {daySchedules.length === 0 ? (
                  <div className="p-8 text-center bg-slate-800/30 border border-slate-800 rounded-2xl">
                    <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Tidak ada jadwal kuliah di hari ini.</p>
                  </div>
                ) : (
                  daySchedules.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded font-semibold">
                              {item.courseCode}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded">
                              {item.classType}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-100">{item.courseName}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{item.lecturer}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-slate-200 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 block">
                            {item.startTime} - {item.endTime}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{item.room} ({item.building})</span>
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-slate-400 italic bg-slate-800/40 p-2 rounded-lg">
                          "{item.notes}"
                        </p>
                      )}

                      {/* Sync actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-700/40">
                        <a
                          href={getGoogleCalendarUrlForSchedule(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 text-center text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg border border-indigo-500/20 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                          Google Calendar
                        </a>
                        <button
                          onClick={() => {
                            const ics = generateSchedulesICS([item], item.courseName);
                            downloadICSFile(ics, `${item.courseCode}.ics`);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded-lg border border-slate-700/50 transition-colors"
                          title="Unduh ICS untuk Apple / Outlook"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PENGUMUMAN (ANNOUNCEMENTS) */}
          {activeTab === 'announcements' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Pengumuman Kelas</h2>
                  <p className="text-[11px] text-slate-400">Informasi Resmi Dosen & Prodi</p>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                  {filteredAnnouncements.length} Berita
                </span>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari berita atau dosen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Category filter scroll */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'schedule_change', label: 'Jadwal' },
                  { id: 'academic', label: 'Akademik' },
                  { id: 'exam', label: 'Ujian' },
                  { id: 'event', label: 'Kegiatan' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg whitespace-nowrap transition-colors font-medium ${
                      selectedCategory === cat.id
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Announcement cards */}
              <div className="space-y-3">
                {filteredAnnouncements.map((ann) => {
                  const hasRead = readReceipts.some(
                    r => r.announcementId === ann.id && r.userId === user?.id
                  );

                  return (
                    <div
                      key={ann.id}
                      onClick={() => handleOpenAnnouncement(ann)}
                      className="p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/60 cursor-pointer transition-all space-y-2 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              ann.priority === 'urgent'
                                ? 'bg-rose-500/20 text-rose-400'
                                : ann.priority === 'important'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {ann.priority}
                          </span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-400">{formatDate(ann.publishedAt)}</span>
                        </div>

                        {hasRead ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Dibaca
                          </span>
                        ) : (
                          <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            Baru
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug">
                        {ann.title}
                      </h3>

                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                        {ann.content}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[10px] text-slate-400">
                        <span className="truncate">Oleh: {ann.authorName}</span>
                        <span className="font-mono">
                          {ann.readCount || 0}/42 dibaca
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PENGINGAT & TUGAS (REMINDERS) */}
          {activeTab === 'reminders' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Pengingat & Tugas</h2>
                  <p className="text-[11px] text-slate-400">Batas Waktu dan Agenda Mandiri</p>
                </div>
                <button
                  onClick={() => setShowAddReminderModal(true)}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1 text-xs font-medium transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </div>

              {/* Status filter tabs */}
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(['all', 'pending', 'completed'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setReminderFilter(mode)}
                    className={`py-1 rounded-lg capitalize font-medium transition-all ${
                      reminderFilter === mode
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'all' ? 'Semua' : mode === 'pending' ? 'Belum Selesai' : 'Selesai'}
                  </button>
                ))}
              </div>

              {/* Reminders List */}
              <div className="space-y-2.5">
                {filteredReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                      rem.isCompleted
                        ? 'bg-slate-900/40 border-slate-800 opacity-70'
                        : 'bg-slate-800/60 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleReminderComplete(rem.id)}
                        className="mt-0.5 text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                      >
                        {rem.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-mono uppercase bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded">
                            {rem.reminderType}
                          </span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-400">{rem.courseName}</span>
                        </div>

                        <h4 className={`text-xs font-bold leading-snug ${rem.isCompleted ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {rem.title}
                        </h4>

                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {rem.description}
                        </p>

                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-700/40 text-[11px]">
                          <span className="text-amber-400 font-mono font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(rem.deadline)}
                          </span>

                          <a
                            href={getGoogleCalendarUrlForReminder(rem)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px] font-medium"
                          >
                            <CalendarIcon className="w-3 h-3" />
                            Sync G-Cal
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: PROFIL & OFFLINE (PROFILE) */}
          {activeTab === 'profile' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-center pt-2">
                <img
                  src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={user?.displayName}
                  className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-indigo-500 shadow-md"
                />
                <h2 className="text-sm font-bold text-white mt-2">{user?.displayName || 'Luki Giovani'}</h2>
                <p className="text-xs text-slate-400">{user?.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-medium">
                  <span>NIM: {user?.nim || '2301092001'}</span>
                  <span>·</span>
                  <span>Angkatan 2024</span>
                </div>
              </div>

              {/* Offline & Storage Diagnostic Card */}
              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Status Penyimpanan Offline</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {isOnline ? 'Online Synced' : 'Offline Mode'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-indigo-400 block">{schedules.length}</span>
                    <span className="text-[10px] text-slate-400 font-sans">Jadwal</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-indigo-400 block">{announcements.length}</span>
                    <span className="text-[10px] text-slate-400 font-sans">Pengumuman</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-indigo-400 block">{reminders.length}</span>
                    <span className="text-[10px] text-slate-400 font-sans">Pengingat</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-normal">
                  Seluruh jadwal dan pemberitahuan di atas tetap dapat Anda buka tanpa jaringan internet (mode offline kampus).
                </p>
              </div>

              {/* Push Notification Setting */}
              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Push Notifikasi</h4>
                  <p className="text-[10px] text-slate-400">Pemberitahuan perubahan ruang & tugas</p>
                </div>
                <button
                  onClick={() => notificationService.requestPushPermission()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Izinkan
                </button>
              </div>

              {/* Bulk ICS Export Button */}
              <button
                onClick={handleDownloadAllICS}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/70 rounded-xl text-xs font-semibold text-indigo-300 flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Unduh Semua Kalender (.ICS)
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM ERGONOMIC TAB BAR (Natural Thumb Zone) */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-2 flex items-center justify-around z-20">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors ${
              activeTab === 'home' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-[10px] mt-1">Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors ${
              activeTab === 'schedule' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span className="text-[10px] mt-1">Jadwal</span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors relative ${
              activeTab === 'announcements' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="text-[10px] mt-1">Berita</span>
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors ${
              activeTab === 'reminders' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="text-[10px] mt-1">Pengingat</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] transition-colors ${
              activeTab === 'profile' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="text-[10px] mt-1">Profil</span>
          </button>
        </div>

        {/* iOS Home Indicator Bar simulation */}
        {viewMode === 'mobile-ios' && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-600 rounded-full pointer-events-none z-30"></div>
        )}
      </div>

      {/* ANNOUNCEMENT DETAIL MODAL */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col relative">
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  selectedAnnouncement.priority === 'urgent'
                    ? 'bg-rose-500/20 text-rose-400'
                    : selectedAnnouncement.priority === 'important'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {selectedAnnouncement.priority}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-400">{formatDate(selectedAnnouncement.publishedAt)}</span>
            </div>

            <h2 className="text-base font-bold text-white mb-2 leading-snug">
              {selectedAnnouncement.title}
            </h2>

            <div className="flex items-center gap-2 text-xs text-slate-400 pb-3 border-b border-slate-800">
              <span>Dosen: {selectedAnnouncement.authorName}</span>
              <span>·</span>
              <span className="text-emerald-400 font-medium">Status: Terbaca</span>
            </div>

            <div className="py-4 overflow-y-auto text-xs text-slate-300 leading-relaxed space-y-3">
              <p>{selectedAnnouncement.content}</p>

              {selectedAnnouncement.attachmentName && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-mono text-slate-300">{selectedAnnouncement.attachmentName}</span>
                  </div>
                  <button
                    onClick={() => alert('Mengunduh lampiran resmi materi kuliah...')}
                    className="text-xs text-indigo-400 hover:underline font-medium"
                  >
                    Unduh
                  </button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">
                {selectedAnnouncement.readCount || 0} dari 42 mahasiswa membaca
              </span>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PERSONAL REMINDER MODAL */}
      {showAddReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative">
            <button
              onClick={() => setShowAddReminderModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-white mb-3">Tambah Pengingat Mandiri</h3>

            <form onSubmit={handleCreateReminder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Judul Tugas / Pengingat</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Belajar Bab 4 UTS..."
                  value={newReminderTitle}
                  onChange={(e) => setNewReminderTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Mata Kuliah</label>
                <select
                  value={newReminderCourse}
                  onChange={(e) => setNewReminderCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:border-indigo-500"
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
                <label className="block text-slate-400 font-medium mb-1">Batas Waktu (Deadline)</label>
                <input
                  type="datetime-local"
                  required
                  value={newReminderDeadline}
                  onChange={(e) => setNewReminderDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Tipe Pengingat</label>
                <select
                  value={newReminderType}
                  onChange={(e) => setNewReminderType(e.target.value as ReminderItem['reminderType'])}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="assignment">Tugas Mandiri</option>
                  <option value="quiz">Kuis Online</option>
                  <option value="exam">Ujian (UTS/UAS)</option>
                  <option value="project">Proyek Capstone</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddReminderModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md"
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
