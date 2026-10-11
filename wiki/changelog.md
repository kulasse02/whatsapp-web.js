# Changelog ServerWA

Seluruh catatan pembaruan, perbaikan bug (*bugfixes*), dan peningkatan performa sistem ServerWA didokumentasikan di sini.

Format penulisan berpedoman pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

---

## [Unreleased / Stable Patches] - 2026-10-12

### 🐛 Fixed (Perbaikan Bug Kritis)
* **Perbaikan Gagal Kirim Media Gambar / Video (`__x_id` Memoize Collision)**:
  * **Gejala:** Muncul error `Error: Data passed to getter must include an id property (it's how we memoize) but got undefined` saat mengirim media via endpoint `/client/sendMessage/:sessionId`.
  * **Penyebab:** WhatsApp Web melakukan update internal yang menyertakan properti privat `__x_id` pada model `mediaOptions`. Ketika di-spread ke dalam objek `message`, terjadi tabrakan ID internal sehingga fungsi getter WhatsApp gagal melakukan memoize.
  * **Solusi:** Di modul [`node_modules/whatsapp-web.js/src/util/Injected/Utils.js`](file:///home/gue/wapi/oriwa3/node_modules/whatsapp-web.js/src/util/Injected/Utils.js), properti `__x_id` dihapus (`delete mediaOptions.__x_id` dan `delete message.__x_id`), serta nilai `message.id` dipaksa tetap merujuk pada `newMsgKey`.
* **Proteksi Sesi Terputus Otomatis oleh Periodic Cleaner**:
  * **Gejala:** Sesi aktif (seperti `AnciXL`) tiba-tiba tertutup dengan log: `Cleaner: closing session AnciXL (deadBrowser=false, idle=true)`.
  * **Penyebab:** Cleaner mematikan sesi jika tidak ada aktivitas dalam kurun waktu `SESSION_IDLE_TIMEOUT_MS`, mengabaikan kenyataan bahwa koneksi WhatsApp Web sebenarnya masih sehat (`CONNECTED`).
  * **Solusi:** Cleaner pada [`src/sessions.js`](file:///home/gue/wapi/oriwa3/src/sessions.js) dimodifikasi untuk memeriksa `getState()`. Sesi berstatus `CONNECTED` tidak lagi ditutup paksa, dan aktivitas sesi diperbarui secara otomatis (`touchSession`).
* **Pencegahan Crash saat Download Media Kosong / Undefined Mimetype**:
  * **Gejala:** Muncul log error berulang `Cannot read properties of undefined (reading 'split')`.
  * **Penyebab:** Pesan masuk tanpa mimetype atau pesan sistem yang mencoba diproses oleh fungsi download media lokal.
  * **Solusi:** Ditambahkan validasi kelayakan mimetype sebelum eksekusi `downloadMedia()`, serta fallback MIME type yang aman.
* **Filter Aman Pengiriman Tanda Centang / Seen (`getChat error (non-fatal): r`)**:
  * **Penyebab:** `SET_MESSAGES_AS_SEEN=TRUE` memicu pemanggilan `getChat()` pada pesan status broadcast (`status@broadcast`) atau saluran newsletter di mana model chat tidak tersedia.
  * **Solusi:** Pesan dari status broadcast dan newsletter difilter agar tidak memicu `getChat().sendSeen()`, dan dibungkus penanganan exception yang senyap.
* **Auto-Touch Session pada Request API**:
  * Menambahkan pemanggilan `touchSession()` pada middleware [`src/middleware.js`](file:///home/gue/wapi/oriwa3/src/middleware.js) (`sessionValidation`) sehingga setiap pemanggilan API secara otomatis memperbarui waktu keaktifan sesi.

---

## [1.2.0] - 2026-09-06

### 🚀 Added
* **Multi-User Role & Session Ownership Isolation**:
  * Integrasi JWT authentication (`Bearer <token>`).
  * Pemisahan hak akses: User biasa hanya dapat mengakses dan mengelola sesi milik mereka sendiri.
  * Admin dapat mengelola dan memantau seluruh sesi yang terdaftar di sistem.
* **Responsive Mobile Web SPA Frontend**:
  * Penataan ulang UI halaman obrolan `/session/:id/chat/...` agar responsif dan nyaman digunakan pada perangkat layar sentuh / smartphone.
  * Fitur pencarian pesan, indikator status online/offline live, dan preview attachment media.
* **Engine Auto-Reply & Alur Pesan Terjadwal**:
  * Modul `src/controllers/autoReplyController.js` dan `src/services/autoReplyService.js`.
  * Fitur pesan otomatis berdasarkan pencocokan kata kunci fleksibel.

### 🛡️ Security
* Penyesuaian middleware API Key agar tidak membocorkan nilai kunci di log konsol.
* Proteksi rute SPA frontend dari pemblokiran rute backend API session.

---

## [1.1.0] - 2026-07-25

### 🚀 Added
* Integrasi database **SQLite3** (`app.db`) via `better-sqlite3`.
* Penyimpanan otomatis riwayat pesan masuk dan keluar (`messages`).
* Penyimpanan file media lokal terstruktur di `data/media/:sessionId/`.
* Pengenalan controller manajemen pengguna (`adminController.js`) dan skrip `upgrade_to_admin.js`.

---

## [1.0.2] - Rilis Awal
* Rilis dasar API wrapper REST untuk `whatsapp-web.js`.
* Dokumentasi Swagger UI interaktif (`/api-docs`).
* Dukungan QR Code terminal dan format gambar data URL.
* Manajemen multi-sesi dasar berbasis folder `sessions/`.
