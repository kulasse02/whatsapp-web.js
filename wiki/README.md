# Wiki Dokumentasi ServerWA (WhatsApp Web API Gateway)

Selamat datang di repositori dokumentasi internal **ServerWA** (`oriwa3`). Direktori ini memuat seluruh detail arsitektur, panduan teknis, alur data, serta riwayat perubahan sistem (*changelog*).

---

## 📚 Daftar Isi Dokumentasi

1. [**Arsitektur Sistem (`architecture.md`)**](./architecture.md)
   - Gambaran umum arsitektur server (*High-Level Architecture*).
   - Komponen inti (Express.js, WhatsApp-Web.js, Puppeteer, SQLite, WebSocket/Frontend SPA).
   - Session Lifecycle Management (Inisialisasi, Multi-session, Heartbeat, Auto-Recovery).
   - Keamanan, Autentikasi (JWT + API Key), dan Role-Based Access Control (Admin vs Regular User).
   - Diagram aliran data (*Mermaid Flowcharts & Sequence Diagrams*).

2. [**Changelog & Patch Log (`changelog.md`)**](./changelog.md)
   - Catatan rilis dan riwayat perbaikan bug berkala.
   - Patch kritis WhatsApp Web internals (Media Sending `__x_id` fix, Mimetype resolution, Safe Seen filter).
   - Optimasi Session Cleaner dan penanganan background tasks.
   - Peningkatan UI/UX Frontend SPA dan manajemen session.

---

## 🛠️ Ringkasan Spesifikasi Teknis

| Komponen | Spesifikasi / Teknologi |
| :--- | :--- |
| **Runtime** | Node.js (v18+ / v20+) |
| **Framework HTTP** | Express.js 4.x |
| **WhatsApp Engine** | `whatsapp-web.js` (Custom Injected Puppeteer) |
| **Browser Engine** | Chromium / Google Chrome via Puppeteer-core |
| **Database** | SQLite3 via `better-sqlite3` (`app.db`) |
| **Process Manager** | PM2 (`ServerWA`, App ID: 0) |
| **Frontend UI** | Modern Vanilla JS + Tailwind / Responsive Mobile Web SPA |
| **Auth & Security** | Bearer JWT (Session Owner & Admin) + Global API Key |

---

## 🚀 Perintah Operasional Cepat

```bash
# Cek status proses
pm2 status

# Pantau real-time log
pm2 logs ServerWA --lines 50

# Restart layanan
pm2 restart ServerWA

# Cek kesehatan API
curl -s http://localhost:3000/ping
```
