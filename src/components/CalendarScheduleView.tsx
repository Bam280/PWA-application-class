import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  ArrowUpRight,
  Download,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { ScheduleItem, ReminderItem, UserRole } from '../types';
import {
  getMonthCalendarWeeks,
  CalendarWeek,
  CalendarDay,
  MONTH_NAMES_ID,
  MONTH_NAMES_SHORT_ID,
  DAY_NAMES_ID,
  isSameDay,
  formatFullIndonesianDate,
  getDateInWeek,
  getGoogleCalendarUrlForDateSchedule,
} from '../lib/calendarUtils';
import { getGoogleCalendarUrlForSchedule, downloadICSFile, generateSchedulesICS } from '../lib/calendarSync';
import { formatScheduleTime } from '../lib/dataService';

interface CalendarScheduleViewProps {
  schedules: ScheduleItem[];
  reminders?: ReminderItem[];
  role: UserRole;
  isMobile?: boolean;
  onAddSchedule?: () => void;
  onEditSchedule?: (schedule: ScheduleItem) => void;
  onDeleteSchedule?: (id: string) => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  schedules,
  reminders = [],
  role,
  isMobile = false,
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
}) => {
  const canManage = role === 'super_admin' || role === 'class_admin';
  const today = useMemo(() => new Date(), []);

  // Year and Month state - defaults to CURRENT year & month (e.g. 2026, November = 10)
  const [selectedYear, setSelectedYear] = useState<number>(() => today.getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => today.getMonth());

  // Show Year Overview (12 months grid) toggle
  const [showYearOverview, setShowYearOverview] = useState<boolean>(false);

  // Compute weeks for the active year and month
  const calendarWeeks = useMemo(() => {
    return getMonthCalendarWeeks(selectedYear, selectedMonthIndex, schedules, reminders);
  }, [selectedYear, selectedMonthIndex, schedules, reminders]);

  // Selected Week within the month (default to the week containing today if in current month, or week 1)
  const initialWeekIndex = useMemo(() => {
    const weekWithToday = calendarWeeks.find((w) => w.hasToday);
    return weekWithToday ? weekWithToday.weekIndexInMonth : 1;
  }, [calendarWeeks]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(initialWeekIndex);

  // Sync selected week if month changes
  const activeWeek = useMemo(() => {
    const found = calendarWeeks.find((w) => w.weekIndexInMonth === selectedWeekIndex);
    return found || calendarWeeks[0] || null;
  }, [calendarWeeks, selectedWeekIndex]);

  // Day filter within the selected week: 0 = Semua Hari, 1 = Senin ... 7 = Minggu
  const [selectedDayFilter, setSelectedDayFilter] = useState<number>(0);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonthIndex((m) => m - 1);
    }
    setSelectedWeekIndex(1);
    setSelectedDayFilter(0);
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonthIndex((m) => m + 1);
    }
    setSelectedWeekIndex(1);
    setSelectedDayFilter(0);
  };

  const handleJumpToToday = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonthIndex(today.getMonth());
    const found = getMonthCalendarWeeks(today.getFullYear(), today.getMonth(), schedules, reminders).find((w) => w.hasToday);
    setSelectedWeekIndex(found ? found.weekIndexInMonth : 1);
    setSelectedDayFilter(0);
    setShowYearOverview(false);
  };

  const handleSelectMonth = (monthIndex: number) => {
    setSelectedMonthIndex(monthIndex);
    setSelectedWeekIndex(1);
    setSelectedDayFilter(0);
    setShowYearOverview(false);
  };

  // Schedules for the selected week
  const weekSchedulesWithDates = useMemo(() => {
    if (!activeWeek) return [];
    
    // For each schedule item, associate it with the specific date of this week
    const items: Array<{
      schedule: ScheduleItem;
      date: Date;
      dateString: string;
      isToday: boolean;
    }> = [];

    // Sort by dayOfWeek, then startTime safely
    const sorted = [...schedules].sort((a, b) => {
      const dayA = a?.dayOfWeek || 0;
      const dayB = b?.dayOfWeek || 0;
      if (dayA !== dayB) return dayA - dayB;
      const startA = a?.startTime || '';
      const startB = b?.startTime || '';
      return startA.localeCompare(startB);
    });

    for (const sch of sorted) {
      // Filter by selected day if set
      if (selectedDayFilter > 0 && sch.dayOfWeek !== selectedDayFilter) {
        continue;
      }

      const specificDate = getDateInWeek(activeWeek, sch.dayOfWeek);
      const isDateToday = isSameDay(specificDate, today);

      items.push({
        schedule: sch,
        date: specificDate,
        dateString: formatFullIndonesianDate(specificDate),
        isToday: isDateToday,
      });
    }

    return items;
  }, [activeWeek, schedules, selectedDayFilter, today]);

  // Deadlines falling in this selected week
  const weekDeadlines = useMemo(() => {
    if (!activeWeek) return [];
    return reminders.filter((r) => {
      try {
        const d = new Date(r.deadline);
        return d >= activeWeek.startDate && d <= activeWeek.endDate;
      } catch {
        return false;
      }
    });
  }, [activeWeek, reminders]);

  // Export current selected week to ICS
  const handleExportWeekICS = () => {
    const weekScheds = schedules.filter((s) => {
      if (selectedDayFilter > 0) return s.dayOfWeek === selectedDayFilter;
      return true;
    });
    const icsContent = generateSchedulesICS(weekScheds);
    const filename = `jadwal-kuliah-${MONTH_NAMES_ID[selectedMonthIndex].toLowerCase()}-minggu-${selectedWeekIndex}.ics`;
    downloadICSFile(icsContent, filename);
  };

  const isCurrentActiveMonth =
    selectedYear === today.getFullYear() && selectedMonthIndex === today.getMonth();

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & MONTH/YEAR CONTROLLER */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-900">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {MONTH_NAMES_ID[selectedMonthIndex]} {selectedYear}
                </h3>
                {isCurrentActiveMonth && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow-xs">
                    Bulan Ini
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Semester Ganjil 2026/2027 · {schedules.length} Sesi Perkuliahan
              </p>
            </div>
          </div>

          {/* Controller buttons */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setShowYearOverview(!showYearOverview)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                showYearOverview
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Lihat seluruh bulan dalam setahun"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Opsi 12 Bulan (Tahun)</span>
              {showYearOverview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {!isCurrentActiveMonth && (
              <button
                onClick={handleJumpToToday}
                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors flex items-center gap-1"
                title="Kembali ke bulan yang sedang berjalan saat ini"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Hari Ini</span>
              </button>
            )}

            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                title="Bulan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-mono font-bold text-slate-700">
                {MONTH_NAMES_SHORT_ID[selectedMonthIndex]}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                title="Bulan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. EXPANDABLE 12-MONTH YEAR CALENDAR OVERVIEW */}
        {showYearOverview && (
          <div className="pt-3 border-t border-slate-100 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pilih Bulan Kalender Akademik ({selectedYear})
              </span>
              <span className="text-[11px] text-slate-500">
                Klik salah satu bulan untuk menampilkan kalender & jadwal
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {MONTH_NAMES_ID.map((mName, idx) => {
                const isSelected = idx === selectedMonthIndex;
                const isCurrent = idx === today.getMonth() && selectedYear === today.getFullYear();
                return (
                  <button
                    key={mName}
                    onClick={() => handleSelectMonth(idx)}
                    className={`p-2.5 rounded-2xl text-left border transition-all relative overflow-hidden ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs'
                        : isCurrent
                        ? 'bg-amber-50 text-slate-900 border-amber-300 font-semibold hover:bg-amber-100'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{mName}</span>
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className={isSelected ? 'text-slate-900' : 'text-slate-500'}>
                        {idx >= 8 || idx <= 0 ? 'Sem. Ganjil' : 'Sem. Genap'}
                      </span>
                      {isCurrent && (
                        <span className="font-bold text-[9px] uppercase tracking-wide">Aktif</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. MONTH CALENDAR GRID WITH INTERACTIVE WEEK SELECTORS */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Kalender Bulan {MONTH_NAMES_ID[selectedMonthIndex]}
            </h4>
            <p className="text-[11px] text-slate-500">
              Pilih baris <span className="font-bold text-amber-700">Minggu (Week)</span> untuk melihat detail jadwal per-minggu
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Jadwal Kuliah</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Tugas/Kuis</span>
            </div>
          </div>
        </div>

        {/* Calendar Table */}
        <div className="overflow-x-auto">
          <div className="min-w-[340px]">
            {/* Header row: Week selector label + 7 Days (Sen s/d Min) */}
            <div className="grid grid-cols-8 gap-1 text-center font-bold text-[11px] text-slate-500 pb-1.5 border-b border-slate-100">
              <div className="py-1 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                Pilih Week
              </div>
              {DAY_NAMES_ID.map((d) => (
                <div key={d.value} className="py-1 text-slate-700">
                  {d.short}
                </div>
              ))}
            </div>

            {/* Week rows */}
            <div className="space-y-1.5 pt-1.5">
              {calendarWeeks.map((week) => {
                const isSelectedWeek = week.weekIndexInMonth === selectedWeekIndex;
                return (
                  <div
                    key={week.weekIndexInMonth}
                    className={`grid grid-cols-8 gap-1 items-center p-1 rounded-2xl transition-all ${
                      isSelectedWeek
                        ? 'bg-amber-100/70 border border-amber-300 shadow-xs'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    {/* Week Selector Button */}
                    <button
                      onClick={() => {
                        setSelectedWeekIndex(week.weekIndexInMonth);
                        setSelectedDayFilter(0);
                      }}
                      className={`h-full min-h-[42px] px-1 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center transition-all ${
                        isSelectedWeek
                          ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                          : 'bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                      }`}
                      title={`Klik untuk melihat jadwal ${week.label}`}
                    >
                      <span className="leading-tight">W{week.weekIndexInMonth}</span>
                      <span className="text-[8px] opacity-80 leading-none">
                        {isSelectedWeek ? '✓ Aktif' : 'Pilih'}
                      </span>
                    </button>

                    {/* 7 Day cells */}
                    {week.days.map((day, idx) => {
                      const isCurrentM = day.isCurrentMonth;
                      const isTodayDate = day.isToday;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedWeekIndex(week.weekIndexInMonth);
                            setSelectedDayFilter(day.dayOfWeek);
                          }}
                          className={`h-11 sm:h-12 rounded-xl flex flex-col items-center justify-between p-1 transition-all relative ${
                            !isCurrentM
                              ? 'text-slate-300 bg-slate-50/50 opacity-60'
                              : isTodayDate
                              ? 'bg-amber-400/90 text-slate-950 font-extrabold ring-2 ring-amber-500 ring-offset-1'
                              : isSelectedWeek
                              ? 'bg-white text-slate-800 font-semibold hover:border-amber-400 border border-slate-200/80 shadow-2xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                          }`}
                        >
                          <span className="text-[11px] leading-none mt-0.5">{day.dayNumber}</span>

                          {/* Dots / badges for schedule & deadline */}
                          <div className="flex items-center gap-0.5 mb-0.5">
                            {day.hasSchedule && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isTodayDate ? 'bg-slate-950' : 'bg-amber-500'
                                }`}
                                title={`${day.scheduleCount} jadwal kuliah`}
                              />
                            )}
                            {day.deadlinesCount > 0 && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"
                                title={`${day.deadlinesCount} tenggat tugas`}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Week pills for touch / one-tap selection */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1">
              Pilih Minggu:
            </span>
            {calendarWeeks.map((w) => {
              const isSelected = w.weekIndexInMonth === selectedWeekIndex;
              return (
                <button
                  key={w.weekIndexInMonth}
                  onClick={() => {
                    setSelectedWeekIndex(w.weekIndexInMonth);
                    setSelectedDayFilter(0);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{w.shortLabel}</span>
                  {w.hasToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. DETAILED WEEKLY SCHEDULE VIEW (PERMINGGU) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        {/* Week Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                Minggu ke-{activeWeek?.weekIndexInMonth || 1}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-700">
                Pekan Ke-{activeWeek?.academicWeekNumber || 1} Perkuliahan
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Jadwal Kuliah: {activeWeek?.label}
            </h3>
            <p className="text-[11px] text-slate-500">
              {weekSchedulesWithDates.length} sesi perkuliahan aktif
              {weekDeadlines.length > 0 && ` · ${weekDeadlines.length} tugas jatuh tempo`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManage && onAddSchedule && (
              <button
                onClick={onAddSchedule}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Jadwal</span>
              </button>
            )}

            <button
              onClick={handleExportWeekICS}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              title="Ekspor jadwal minggu ini ke file .ics"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor .ICS</span>
            </button>
          </div>
        </div>

        {/* Deadlines alert in this week if any */}
        {weekDeadlines.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Pengingat Tugas / Kuis di Minggu Ini ({weekDeadlines.length} Agenda):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {weekDeadlines.map((dl) => (
                <div
                  key={dl.id}
                  className="p-2 rounded-xl bg-white/80 border border-rose-200 flex items-center justify-between text-[11px]"
                >
                  <div className="truncate mr-2">
                    <span className="font-bold text-slate-900">{dl.title}</span>
                    <span className="text-slate-500 block text-[10px]">{dl.courseName}</span>
                  </div>
                  <span className="font-mono text-rose-700 font-bold shrink-0">
                    {new Date(dl.deadline).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter per Day in this Week (Semua Hari, Sen, Sel, Rab, Kam, Jum, Sab) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedDayFilter(0)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              selectedDayFilter === 0
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Semua Hari ({schedules.length})
          </button>

          {DAY_NAMES_ID.slice(0, 6).map((d) => {
            const isSelected = selectedDayFilter === d.value;
            const count = schedules.filter((s) => s.dayOfWeek === d.value).length;
            const dayDate = activeWeek ? getDateInWeek(activeWeek, d.value) : null;
            const isTodayDay = dayDate ? isSameDay(dayDate, today) : false;

            return (
              <button
                key={d.value}
                onClick={() => setSelectedDayFilter(d.value)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>
                  {d.short}
                  {dayDate && ` (${dayDate.getDate()} ${MONTH_NAMES_SHORT_ID[dayDate.getMonth()]})`}
                </span>
                <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-amber-600/30' : 'bg-slate-200'}`}>
                  {count}
                </span>
                {isTodayDay && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
              </button>
            );
          })}
        </div>

        {/* Lecture cards for the selected week */}
        <div className="space-y-3">
          {weekSchedulesWithDates.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
              <CalendarIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">
                Tidak ada jadwal perkuliahan pada hari yang dipilih di minggu ini.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pilih opsi "Semua Hari" atau hari lain untuk melihat jadwal.
              </p>
            </div>
          ) : (
            weekSchedulesWithDates.map(({ schedule: item, date, dateString, isToday: isDateToday }) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl bg-white border shadow-xs space-y-3 transition-all ${
                  isDateToday
                    ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20'
                    : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                {/* Top row: Date banner + Course info + Time */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="empty:hidden text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                        {item.courseCode}
                      </span>
                      {item.divisionName && (
                        <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded truncate max-w-[260px]">
                          {item.divisionName}
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          item.classType === 'online'
                            ? 'bg-blue-100 text-blue-800'
                            : item.classType === 'hybrid'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {item.classType}
                      </span>
                      {isDateToday && (
                        <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                          Hari Ini
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{item.courseName}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{item.lecturer}</span>
                      {item.speakerRole && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-amber-800 font-medium bg-amber-50 px-1.5 py-0.2 rounded text-[11px]">
                            {item.speakerRole}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 inline-block">
                      {formatScheduleTime(item)}
                    </span>
                    <span className="block text-[11px] font-medium text-amber-800 mt-1">
                      {dateString}
                    </span>
                  </div>
                </div>

                {/* Bottom row: Room, Google Calendar Deep Sync, & Admin Actions */}
                <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-slate-100 text-xs text-slate-500 gap-2">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">
                      {item.room} {item.building ? `· ${item.building}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Sync to Google Calendar for this specific week's date */}
                    <a
                      href={getGoogleCalendarUrlForDateSchedule(item, date)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] flex items-center gap-1 border border-amber-200 transition-colors"
                      title={`Simpan jadwal tanggal ${date.getDate()} ${MONTH_NAMES_SHORT_ID[date.getMonth()]} ke Google Calendar`}
                    >
                      <CalendarIcon className="w-3 h-3 text-amber-700" />
                      <span>Sync G-Cal</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>

                    {/* Admin actions */}
                    {canManage && onEditSchedule && (
                      <button
                        onClick={() => onEditSchedule(item)}
                        className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Edit sesi jadwal"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canManage && onDeleteSchedule && (
                      <button
                        onClick={() => onDeleteSchedule(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus sesi jadwal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
