# UniClass Hub: Sistem Manajemen Pengumuman, Jadwal & Kalender Kelas Terpadu

Sistem aplikasi manajemen pemberitahuan dan jadwal kelas universitas multi-platform yang menyajikan antarmuka mobile responsif untuk mahasiswa (Android & iOS) serta portal web desktop terpusat untuk Dosen/Admin Prodi, dilengkapi integrasi SSO Google Firebase Auth, sinkronisasi otomatis kalender (.ics & Google Calendar), notifikasi real-time, caching offline mandiri, dan dashboard analitik keterlibatan kelas.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan konfirmasi preferensi Anda pada tahap klarifikasi:
> - **Antarmuka Pengguna**: Mode dual-view terintegrasi dengan opsi frame simulasi perangkat (Android & iOS) bagi mahasiswa, serta tampilan portal web desktop layar penuh untuk Dosen/Admin.
> - **Konteks & Struktur Akademik**: Universitas / Perguruan Tinggi (Mata Kuliah, SKS, Dosen Pengampu, Ruang Kuliah/Lab, Kelas Paralel, dan Semester).
> - **Sinkronisasi Kalender**: Integrasi tautan langsung ke Google Calendar (`render.google.com/calendar/render`) dan generator file iCalendar (`.ics`) standar untuk iOS Apple Calendar dan Outlook.
> - **Autentikasi & Otorisasi**: Google Sign-In SSO melalui Firebase Auth dengan pemisahan peran (*Role-Based Access Control* / RBAC) yang membedakan hak akses Mahasiswa dan Admin/Dosen.

---

## 1. Overview & Core Concept

### What It Does
UniClass Hub menyatukan seluruh kanal komunikasi akademik ke dalam satu platform:
1. **Pemberitahuan & Berita Kelas**: Pengumuman penting dari dosen/fakultas yang dilengkapi lampiran materi, tingkat urgensi (Normal, Penting, Mendesak), dan pelacakan pembacaan.
2. **Jadwal & Agenda Kuliah**: Kalender mingguan interaktif dengan detail ruangan, jam sesi, dosen pengampu, dan status perkuliahan (Tatap Muka, Daring, Responsi, Ditiadakan).
3. **Pengingat Tugas & Ujian**: Pengingat deadline tugas, kuis, UTS/UAS dengan tombol hitung mundur (*countdown*), checklist progres mahasiswa, dan reminder popup notifikasi.
4. **Sinkronisasi Kalender Otomatis**: Tombol satu-klik untuk memasukkan seluruh jadwal atau reminder terpilih langsung ke Google Calendar atau unduh file `.ics` untuk sinkronisasi kalender bawaan iPhone (iOS) dan Android.
5. **Mode Offline Mandiri**: Penyimpanan lokal cerdas (IndexedDB / LocalStorage) sehingga mahasiswa tetap dapat membuka jadwal dan membaca pengumuman saat tidak memiliki jaringan internet di kampus.
6. **Portal Admin & Dashboard Analitik**: Portal khusus admin/dosen untuk mempublikasikan berita, memantau *view rate* mahasiswa, memeriksa log pembacaan secara berkala, dan mengelola jadwal.

### Target Audience & Persona
- **Mahasiswa**: Memeriksa jadwal harian melalui ponsel Android/iOS, mengecek deadline tugas, mengekspor agenda ke Google Calendar, dan membaca edaran prodi secara offline.
- **Dosen & Admin Kelas/Prodi**: Membuat pengumuman resmi, mengatur jadwal kuliah pengganti, menyiarkan push notification, dan mengamati grafik keterlibatan mahasiswa pada dashboard analitik.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[ ALUR PENGGUNA MAHASISWA (MOBILE ANDROID / IOS) ]
1. Masuk via Google SSO -> Pilih Kelas / Prodi
2. Beranda: Jadwal Hari Ini + Pengumuman Terbaru + Banner Deadline Terdekat
3. Tab Jadwal: Tampilan Harian & Mingguan + Opsi "Sync to Google Calendar" / "Download .ics"
4. Tab Pengumuman: Baca Detail Berita (otomatis mencatat log analitik pembacaan)
5. Tab Pengingat: Daftar Tugas, checklist personal mahasiswa, dan opsi push notification reminder
6. Offline Banner: Status otomatis beralih saat offline, data tetap dapat diakses

[ ALUR PENGGUNA ADMIN / DOSEN (PORTAL DESKTOP) ]
1. Masuk via Akun Admin SSO Google
2. Dashboard Analitik: Metrik Total Mahasiswa Aktif, View Rate Pengumuman, Grafik Pembacaan
3. Manajemen Berita: Form Pembuat Berita (Rich Text, Badge Urgensi, Jadwal Tayang, Lampiran)
4. Manajemen Jadwal: Editor Jadwal Kuliah Mingguan, Dosen Pengampu, Ruang, dan Mode Kelas
5. Manajemen Pengingat: Pembuat Reminder Tugas / Ujian dengan target siaran notifikasi
6. Audit Log: Daftar mahasiswa yang telah dan belum membaca pemberitahuan tertentu
```

### Visual Identity & Theme
- **Aesthetic Direction**: *Academic Modern & Ergonomic*. Bersih, terstruktur rapi, tanpa ornamen berlebih (mengikuti prinsip anti-AI slop), dengan kontras tinggi untuk kenyamanan baca di layar ponsel maupun desktop.
- **Color Palette & Distribution (Aturan 60-30-10)**:
  - **60% Neutral Canvas**: Slate-50 / White (`#FFFFFF`, `#F8FAFC`) pada mode terang, Slate-950 (`#0B0F17`) pada mode gelap.
  - **30% Structural Surfaces**: Card dengan hairline border `slate-200` / `slate-800`, latar belakang kontras lembut untuk pembeda blok jadwal kuliah.
  - **10% High-Intent Accent**: Indigo-Blue (`#2563EB`) untuk navigasi dan aksi utama, Emerald-600 (`#059669`) untuk status normal/hadir, Amber-500 (`#D97706`) untuk deadline mendesak, Rose-600 (`#DC2626`) untuk pengumuman darurat.
- **Typography & Hierarchy**:
  - Headings & Navigation: Font kontemporer bersih dengan visual weight tegas (`font-semibold tracking-tight`).
  - Data & Timestamps: Angka tabular (`tabular-nums font-mono`) untuk jam kuliah, tanggal deadline, dan metrik persentase pembacaan agar angka sejajar tanpa getaran layout.
  - Zero-Pill Discipline: Metadata (jam, ruangan, tanggal publikasi) disajikan dengan pemisah tipografis (`·` atau `/`), bukan kapsul berlapis.
- **Mobile Touch Ergonomics**:
  - Touch target minimal $44 \times 44\text{px}$ pada seluruh tombol di mode mobile.
  - Bottom navigation bar yang mudah dijangkau oleh jempol (Natural Reach Zone).
  - Pilihan frame preview: Android Viewport (Material Design top-bar & navigation pill), iPhone iOS Viewport (Dynamic Island & iOS home bar), atau Full Responsive Web.

---

## 3. Key Product Decisions & Trade-Offs

### 1. Dual-View Mode Switcher (Simulasi Mobile Mahasiswa & Web Portal Admin)
- **Keputusan**: Menyediakan panel kendali di bagian atas untuk beralih antara tampilan simulasi perangkat (iPhone / Android dengan frame realistis) dan tampilan Web Portal Desktop Admin.
- **Alasan**: Memberikan fleksibilitas langsung bagi penguji/dosen untuk mencoba pengalaman mahasiswa di layar ponsel sekaligus mengoperasikan portal administrasi kelas pada layar lebar tanpa perlu membuka beberapa peranti fisik.

### 2. Caching Offline Bertingkat (Firestore Persistence + Local Fallback Cache)
- **Keputusan**: Mengaktifkan offline cache Firestore yang diperkuat dengan penyimpanan lokal terenkripsi ringan untuk metadata jadwal dan riwayat pengumuman.
- **Alasan**: Mahasiswa di kampus sering menghadapi kendala koneksi di dalam gedung kuliah berlantai banyak atau ruang bawah tanah; aplikasi harus tetap dapat menampilkan jadwal ruang kuliah berikutnya tanpa jeda.

### 3. Ekspor Kalender Terbuka (.ics Standard & Direct Google Calendar Web URL)
- **Keputusan**: Menggunakan generator format `.ics` (iCalendar RFC 5545) murni di sisi peramban serta tautan deep-link `https://calendar.google.com/calendar/render?action=TEMPLATE...`.
- **Alasan**: Tidak memerlukan perizinan Google Workspace scope sensitif yang rumit bagi mahasiswa biasa, kompatibel instan dengan aplikasi Kalender bawaan iOS (Apple Calendar), Android, Mac, dan Microsoft Outlook.

### 4. Pelacakan Pembacaan Analitik (Read Receipts & Audience Engagement)
- **Keputusan**: Setiap kali mahasiswa membuka kartu detail pengumuman atau pengingat, aplikasi merekam entri pembacaan unik (`announcement_views` dengan `userId`, `timestamp`, dan `duration`).
- **Alasan**: Admin/dosen dapat langsung melihat persentase mahasiswa yang sudah membaca (misal: "38 dari 42 mahasiswa telah membaca instruksi tugas") serta grafik tren pembacaan 7 hari terakhir.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UNICLASS HUB FRONTEND                           │
│                                                                        │
│  ┌─────────────────────────┐          ┌─────────────────────────────┐  │
│  │    STUDENT MOBILE UI    │          │     ADMIN WEB PORTAL        │  │
│  │ (Android / iOS Layout)  │          │    (Desktop Dashboard)      │  │
│  │                         │          │                             │  │
│  │ • Today Schedule Feed   │          │ • Analytics & Read Metrics  │  │
│  │ • Announcements Stream  │          │ • Publish Announcement      │  │
│  │ • Assignment Reminders  │          │ • Manage Weekly Schedules   │  │
│  │ • 1-Click Calendar Sync │          │ • Dispatch Push Alerts      │  │
│  │ • Offline Data Storage  │          │ • Student Engagement Logs   │  │
│  └───────────┬─────────────┘          └──────────────┬──────────────┘  │
│              │                                       │                 │
│  ┌───────────┴───────────────────────────────────────┴──────────────┐  │
│  │                 STATE & REPOSITORY LAYER                         │  │
│  │                                                                  │  │
│  │ • Auth Context (Google Firebase SSO + Role Detection)            │  │
│  │ • Offline Sync Manager (IndexedDB / LocalStorage Fallback)       │  │
│  │ • Calendar Generator (RFC 5545 iCal & Google Calendar Linker)    │  │
│  │ • Push Notification Simulator & Web Notification API             │  │
│  │ • Analytics Event Tracker (Read confirmations & Metrics)         │  │
│  └───────────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────────────┼─────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BACKEND & PERSISTENCE SERVICES                     │
│                                                                        │
│  ┌────────────────────────┐              ┌──────────────────────────┐  │
│  │     FIREBASE AUTH      │              │    CLOUDFIRESTORE DB     │  │
│  │                        │              │                          │  │
│  │ • Google Sign-In SSO   │              │ • /classes               │  │
│  │ • Role verification    │              │ • /schedules             │  │
│  │ • User profile session │              │ • /announcements         │  │
│  │                        │              │ • /reminders             │  │
│  │                        │              │ • /announcement_reads    │  │
│  │                        │              │ • /users & /admins       │  │
│  └────────────────────────┘              └──────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Entities & Collections
1. **`users`**: `{ id, email, displayName, role ('student' | 'admin'), nim, major, avatarUrl, createdAt }`
2. **`schedules`**: `{ id, classId, courseName, courseCode, lecturer, dayOfWeek (1-7), startTime, endTime, room, building, classType ('offline' | 'online' | 'hybrid'), notes, updatedAt }`
3. **`announcements`**: `{ id, title, content, priority ('normal' | 'important' | 'urgent'), category ('academic' | 'exam' | 'event' | 'schedule_change'), authorId, authorName, publishedAt, attachments, readCount }`
4. **`reminders`**: `{ id, title, courseName, deadline, reminderType ('assignment' | 'quiz' | 'exam' | 'project'), description, isCompleted, priority }`
5. **`read_receipts`**: `{ id, announcementId, userId, userName, readAt, userAgent }`

### Notification & Calendar Workflows
- **Calendar Export**:
  - Parameter: Nama Mata Kuliah, Waktu Mulai/Selesai, Ruang Kuliah, Dosen Pengampu, Pengulangan Mingguan (*RRULE:FREQ=WEEKLY*).
  - Format 1: File `.ics` instan siap simpan ke peranti Apple / Android.
  - Format 2: Tautan langsung pembuka Google Calendar web dengan parameter judul, tanggal, dan lokasi yang telah terisi lengkap.
- **Push Notification & Real-Time Alerts**:
  - Menggunakan Web Notification API peramban dengan opsi fallback in-app alert banner & toast saat izin notifikasi belum diberikan.

---

## 5. Verification & Testing Plan

1. **Autentikasi SSO**: Verifikasi alur login Google Firebase Auth, verifikasi pembagian hak akses (Mahasiswa vs Admin), dan pengalihan antarmuka otomatis.
2. **Sinkronisasi Kalender**:
   - Uji pembuatan tautan Google Calendar (memastikan tanggal, jam, dan ruang kuliah terisi otomatis).
   - Uji download file `.ics` dan validasi strukturnya (memastikan format tanggal ISO 8601 UTC valid).
3. **Mode Offline**:
   - Simulasikan kondisi offline peramban (`navigator.onLine = false`).
   - Pastikan data jadwal dan pengumuman yang telah tersimpan di cache tetap dapat diakses dengan indikator offline yang jelas.
4. **Dashboard Analitik**:
   - Buka pengumuman sebagai mahasiswa, lalu buka dashboard admin untuk memastikan grafik dan log pembaca bertambah secara real-time.
5. **Uji Responsivitas & Desain**:
   - Uji tampilan pada mode simulasi Android, iPhone (iOS), dan Portal Desktop.
   - Jalankan `compile_applet` untuk memastikan kode TypeScript bebas dari kesalahan kompilasi.
