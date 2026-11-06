# Role API — kebutuhan di sisi database & backend

Firebase Authentication **hanya** membuktikan siapa user-nya (email Google yang sudah terverifikasi).
**Role** (`super_admin`, `class_admin`, `class_member`) disimpan di database Anda dan dibaca aplikasi lewat API.

```
[Browser] --login Google--> [Firebase Auth] --ID token--> [Browser]
[Browser] --GET /me + Bearer <ID token>--> [API Anda]
[API Anda] --verifyIdToken()--> email terverifikasi --SELECT role ... WHERE email = ?--> [Database]
[API Anda] --{ email, name, nim, role }--> [Browser]
```

## 1. Tabel di database

Satu tabel cukup. Contoh MySQL (PostgreSQL: ganti `ENUM` dengan `TEXT CHECK (role IN (...))`):

```sql
CREATE TABLE user_roles (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(128) NOT NULL,            -- simpan dalam huruf kecil
  name          VARCHAR(100) NOT NULL,
  nim           VARCHAR(30)  NULL,                -- NIM / NIP, opsional
  role          ENUM('super_admin','class_admin','class_member') NOT NULL DEFAULT 'class_member',
  firebase_uid  VARCHAR(128) NULL,                -- diisi otomatis saat user pertama kali login (lihat /me)
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,    -- FALSE = dianggap tidak terdaftar
  last_login_at TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_roles_email (email),
  UNIQUE KEY uq_user_roles_uid (firebase_uid)
);

-- Minimal satu super admin awal (ganti dengan email Anda):
INSERT INTO user_roles (email, name, role) VALUES ('email-anda@gmail.com', 'Nama Anda', 'super_admin');
```

Kalau Anda sudah punya tabel user sendiri, cukup pastikan ada kolom **email (unik, huruf kecil)** dan **role**.
Nilai role lain juga diterima aplikasi dan dipetakan otomatis:
`admin`/`admin_kelas`/`ketua_kelas` → `class_admin`, `superadmin` → `super_admin`,
`member`/`student`/`mahasiswa`/`trainee` → `class_member`.

## 2. Endpoint yang dibutuhkan

Base URL diisi di frontend lewat `VITE_ROLE_API_URL` (lihat bagian 6). Semua request dari aplikasi membawa
`Authorization: Bearer <Firebase ID token>`.

| Method & path | Siapa boleh | Body | Respons sukses |
|---|---|---|---|
| `GET /me` | semua user login | – | `200` user milik pemilik token |
| `GET /users` | `super_admin`, `class_admin` | – | `200` array user |
| `POST /users` | `super_admin` | `{ email, name, nim?, role }` | `201` user baru |
| `PATCH /users/:id` | `super_admin` | `{ role }` | `200` user terbaru (atau `204`) |
| `DELETE /users/:id` | `super_admin` | – | `204` |

Bentuk satu user (camelCase atau snake_case sama-sama diterima, boleh juga dibungkus `{ "data": ... }`):

```json
{ "id": "12", "email": "budi@example.com", "name": "Budi", "nim": "NIP-001", "role": "class_admin" }
```

Field opsional yang ikut ditampilkan bila ada: `avatar_url`, `attendance_rate`, `last_active`.

### Kode status yang dibaca aplikasi

| Status | Arti di aplikasi |
|---|---|
| `GET /me` → `404` atau `403` | Email **belum terdaftar** / tidak aktif → user otomatis di-logout dengan pesan "Email … belum terdaftar". |
| `401` | Token tidak valid → user diminta login ulang. |
| `403` (endpoint lain) | Tidak punya izin → pesan "Anda tidak memiliki izin…". |
| `409` pada `POST /users` | Email sudah terdaftar → form tetap terbuka dengan pesan dari field `message`. |
| `5xx` / timeout (8 dtk) / CORS gagal | Pakai role terakhir yang tersimpan di perangkat (jika ada); jika tidak, tampil layar "Hak akses belum dapat dimuat" dengan tombol Coba lagi. |

Pesan error sebaiknya dikirim sebagai `{ "message": "..." }` — teksnya ditampilkan langsung ke user.

## 3. Wajib: verifikasi token di server

**Jangan pernah** mengambil email dari query/body untuk menentukan role. Ambil dari token yang sudah diverifikasi:

```js
// Node.js + firebase-admin (ada juga untuk Python, Go, Java, PHP/kreait, .NET)
import admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); // project: gen-lang-client-0512584165

async function requireFirebaseUser(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email || !decoded.email_verified) return res.status(401).json({ message: 'Email belum terverifikasi' });
    req.firebase = {
      uid: decoded.uid,
      email: decoded.email.toLowerCase(),
      provider: decoded.firebase?.sign_in_provider, // 'google.com' | 'password' | ...
    };
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid' });
  }
}

// (contoh query memakai pg-promise; sesuaikan dengan library database Anda)
app.get('/me', requireFirebaseUser, async (req, res) => {
  const user = await db.oneOrNone(
    'SELECT id, email, name, nim, role FROM user_roles WHERE email = $1 AND is_active', [req.firebase.email]);
  if (!user) return res.status(404).json({ message: 'Email belum terdaftar' });
  // Login email & password khusus admin (lihat bagian 7) — dicek juga di frontend.
  if (req.firebase.provider === 'password' && user.role === 'class_member') {
    return res.status(403).json({ message: 'Login email & password khusus admin. Silakan masuk dengan Google.' });
  }
  await db.none('UPDATE user_roles SET firebase_uid = $1, last_login_at = NOW() WHERE id = $2', [req.firebase.uid, user.id]);
  await syncRoleClaim(req.firebase.uid, user.role); // lihat bagian 4
  res.json(user);
});
```

Endpoint `/users*` memakai middleware yang sama, lalu cek role pemanggil **dari database** (bukan dari body).
Disarankan juga: tolak perubahan yang membuat tidak ada lagi `super_admin` tersisa.

## 4. Disarankan: salin role ke Firebase custom claims

Jadwal, pengumuman, dan pengingat masih disimpan di Firestore, dan Firestore tidak bisa membaca database Anda.
Agar aturan Firestore memakai role yang sama, API menyalin role ke token Firebase:

```js
async function syncRoleClaim(uid, role) {
  const { customClaims } = await admin.auth().getUser(uid);
  if (customClaims?.role !== role) await admin.auth().setCustomUserClaims(uid, { ...customClaims, role });
}
```

Panggil di `GET /me` dan setiap `PATCH`/`DELETE /users/:id` (pakai `firebase_uid`; untuk `DELETE`,
hapus claim dengan `setCustomUserClaims(uid, { ...customClaims, role: null })`). Aplikasi otomatis me-refresh token
bila claim berbeda dari role di `/me`.

`firestore.rules` di repo ini sudah menerima claim tersebut (`request.auth.token.role`) **di samping** daftar
email lama. Setelah claim berjalan, hapus daftar email hardcoded di fungsi `isAdmin()` lalu deploy:

```bash
firebase deploy --only firestore:rules
```

## 5. CORS

Server harus mengizinkan origin aplikasi (mis. `http://localhost:3000` dan domain produksi), header
`Authorization, Content-Type`, dan method `GET, POST, PATCH, DELETE, OPTIONS` (termasuk preflight `OPTIONS`).

## 6. Pengaturan di frontend

Buat file `.env.local` (tidak ikut git) di root project:

```
VITE_ROLE_API_URL=https://api-anda.example.com/v1
```

Lalu jalankan ulang `npm run dev`. Untuk build produksi, set variabel yang sama di environment build.
Alamat ini sengaja **tidak** bisa diubah dari halaman Pengaturan, supaya tidak ada yang bisa mengarahkan
aplikasi ke API palsu yang membalas `super_admin`.

Aturan nilai `VITE_ROLE_API_URL`:

- **URL lengkap server API**, diawali `https://` — contoh `https://api.domain-anda.com/api`.
  Tanpa garis miring di akhir; aplikasi menambahkan `/me`, `/users`, dst.
- **Bukan** alamat aplikasi ini (mis. `https://odp-apps-class.ai.studio/...`) dan **bukan** API key/token.
  Nilai seperti itu membuat aplikasi memanggil dirinya sendiri dan mendapat halaman HTML
  ("Respons API role bukan JSON … Permintaan terkirim ke aplikasi ini sendiri").
- Jika aplikasi dibuka lewat `https://`, API juga harus `https://` (browser memblokir `http://`).
- Untuk aplikasi yang sudah di-deploy (mis. di AI Studio), API harus bisa diakses dari internet.
  API yang hanya berjalan di komputer lokal (Laragon, `localhost`) tidak bisa dijangkau oleh pengguna lain.
- Nilai `VITE_*` ikut tertanam di JavaScript yang dikirim ke browser, jadi jangan pernah menaruh
  rahasia (API key, password) di variabel ini.

## 7. Login email & password (khusus admin)

Halaman login punya tombol **Masuk dengan Email (Admin)**. Role tetap diambil dari `GET /me`; jika yang
login lewat cara ini ternyata `class_member`, aplikasi langsung me-logout-nya dan meminta login Google.

Yang perlu disiapkan:

1. **Aktifkan provider**: Firebase Console → Authentication → Sign-in method → **Email/Password** → Enable.
2. **Biarkan "Enable create (sign-up)" tetap aktif** (Authentication → Settings → User actions). Opsi ini juga
   berlaku untuk Google: kalau dimatikan, akun Google baru gagal login dengan `auth/admin-restricted-operation`
   dan tidak bisa masuk antrean persetujuan. Akibatnya, siapa pun bisa membuat akun password lewat API Firebase,
   termasuk dengan email milik admin. Akun seperti itu belum terverifikasi, jadi **API wajib menolak token dengan
   `email_verified` bernilai `false`** (bagian 3). `firestore.rules` sudah mengeceknya.
3. **Buat akun admin** lewat Admin SDK (disarankan, agar `email_verified` bernilai `true` sehingga lolos
   pengecekan di bagian 3):

   ```js
   // akun baru
   await admin.auth().createUser({ email: 'admin@perusahaan.co.id', password: 'PasswordKuat!123', emailVerified: true });
   // atau menambahkan password ke akun yang sudah pernah login dengan Google (email sama)
   const u = await admin.auth().getUserByEmail('admin@perusahaan.co.id');
   await admin.auth().updateUser(u.uid, { password: 'PasswordKuat!123' });
   ```

   Membuat akun dari Firebase Console (Users → Add user) juga bisa, tetapi `email_verified` akan `false`
   sehingga ditolak oleh pengecekan `email_verified` di bagian 3. Tandai terverifikasi dengan
   `admin.auth().updateUser(uid, { emailVerified: true })`.
4. Pastikan email tersebut ada di tabel `user_roles` dengan role `super_admin` atau `class_admin`.
5. Disarankan: tolak juga di server (contoh di `GET /me` bagian 3), karena pengecekan di frontend saja bisa
   dilewati oleh orang yang memanggil API secara langsung.

"Lupa password?" memakai email reset bawaan Firebase (template bisa diubah di Authentication → Templates).

## 8. Sumber kebenaran role & alur persetujuan

**Database role adalah satu-satunya penentu role.** Aplikasi tidak punya daftar email cadangan.

| Balasan `GET /me` | Perilaku aplikasi |
|---|---|
| `200` | Masuk dengan role dari database. |
| `404` / `403` berformat JSON | Login Google: masuk antrean persetujuan. Login password: langsung ditolak. |
| `401` | Logout, diminta login ulang. |
| Tidak terjangkau, `5xx`, atau bukan JSON | Pakai role terakhir yang pernah dikonfirmasi API untuk akun itu. Jika tidak ada, tampil layar error dengan tombol Coba lagi. |

Konsekuensinya:

- **Minimal satu `super_admin` harus sudah ada di database** (lihat `INSERT` di bagian 1). Kalau tidak, tidak ada
  yang bisa menyetujui antrean.
- Menyetujui user memanggil `POST /users`. Jika gagal, permintaan tetap di antrean dan admin melihat pesan error.
  `409` dianggap "sudah terdaftar" dan role-nya mengikuti data yang ada.
- **Antrean `pending_approvals` hanya bisa dibaca admin menurut `firestore.rules`**: email yang tertulis di fungsi
  `isAdmin()`, atau akun dengan custom claim `role` (bagian 4). Super admin yang hanya ada di database dan belum punya
  claim akan melihat antrean kosong.
- API tetap wajib menolak token dengan `email_verified` bernilai `false` (bagian 3).

## 9. Arti kode error di halaman login

User hanya melihat pesan singkat dan kodenya. Cara mengatasinya ada di sini, khusus untuk admin:

| Kode | Penyebab | Cara mengatasi |
|---|---|---|
| `auth/admin-restricted-operation` | "Enable create (sign-up)" dimatikan, jadi akun baru tidak bisa dibuat. Akun yang sudah ada tetap bisa login. | Firebase Console → Authentication → Settings → User actions → aktifkan **Enable create (sign-up)**. |
| `auth/unauthorized-domain` | Alamat aplikasi belum terdaftar di Firebase. | Authentication → Settings → Authorized domains → tambahkan domainnya. |
| `auth/operation-not-allowed` | Metode login belum aktif. | Authentication → Sign-in method → aktifkan **Google** atau **Email/Password**. |

## 10. Format data jadwal, pengumuman, dan pengingat

Semua request memakai Firebase ID Token (`Authorization: Bearer <token>`). Server menolak field yang tidak
dikenal dengan `400 Data tidak valid`, jadi aplikasi hanya mengirim field berikut:

| Endpoint | Field yang dikirim |
|---|---|
| `POST /announcements` | `title`, `content`, `reads` |
| `POST /schedules` | `title`, `day` (mis. `Senin`), `time` (mis. `08:00`), `room` (opsional) |
| `POST /reminders` | `task`, `time` (ISO 8601), `completed` |

ID dibuat oleh server. Aplikasi memakai `id` dari balasan server, dan baru menampilkan data setelah server
menerimanya. `PUT` memakai format yang sama; endpoint `PUT` dan `POST /announcements/:id/reads` belum dipastikan
ada di server.

**Isian form yang saat ini tidak disimpan server**, jadi tidak muncul lagi setelah data disimpan:

| Data | Field |
|---|---|
| Pengumuman | prioritas, kategori, nama pengirim, lampiran |
| Jadwal | kode sesi, divisi, pembicara, jabatan pembicara, jam selesai, gedung, tipe kelas, catatan |
| Pengingat | mata kuliah, tipe, prioritas, deskripsi |

Supaya tersimpan, server perlu menambahkan kolom dan menerimanya di validasi, lalu `toApiAnnouncement`,
`toApiSchedule`, dan `toApiReminder` di `src/lib/dataService.ts` ikut mengirimnya.
