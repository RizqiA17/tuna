# Real-time Game Control Features

## Overview
Sistem permainan Tuna Adventure telah diperbarui dengan fitur real-time yang memungkinkan admin untuk mengontrol semua tim secara bersamaan dan memantau progress secara real-time.

## Fitur Utama

### 1. WebSocket Integration
- **Socket.IO** digunakan untuk komunikasi real-time antara server dan client
- Semua tim dan admin terhubung melalui WebSocket
- Data progress dan status dikirim secara real-time

### 2. Admin Game Control
- **Start Game for All Teams**: Admin dapat memulai permainan untuk semua tim sekaligus
- **Next Scenario for All Teams**: Admin dapat memajukan semua tim ke scenario berikutnya
- **End Game for All Teams**: Admin dapat mengakhiri permainan untuk semua tim
- **Kick Team**: Admin dapat mengeluarkan tim tertentu dari permainan

### 3. Real-time Monitoring
- **Live Team Status**: Melihat status tim yang sedang terhubung
- **Progress Updates**: Update progress tim secara real-time (posisi, skor, status)
- **Decision Notifications**: Notifikasi ketika tim mengirim keputusan
- **Connection Status**: Melihat tim mana yang terhubung atau terputus

### 4. Team Synchronization
- Semua tim mulai permainan bersamaan ketika admin memulai
- Semua tim maju ke scenario berikutnya bersamaan
- Admin dapat menunggu semua tim selesai sebelum melanjutkan
- Sistem otomatis lanjut ke step berikutnya jika semua tim sudah selesai

## Cara Penggunaan

### Untuk Admin:
1. Buka `/admin` dan login dengan kredensial admin
2. Pilih tab "Game Control"
3. Gunakan tombol kontrol untuk:
   - **Start Game**: Memulai permainan untuk semua tim
   - **Next Scenario**: Memajukan semua tim ke scenario berikutnya
   - **End Game**: Mengakhiri permainan
4. Pantau progress tim di bagian "Real-time Team Monitoring"
5. Gunakan tombol "Kick" untuk mengeluarkan tim tertentu

### Untuk Tim:
1. Tim akan otomatis terhubung ke sistem real-time
2. Tim akan menerima perintah dari admin secara otomatis
3. Progress tim akan dikirim ke admin secara real-time
4. Tim dapat dikeluarkan dari permainan oleh admin

## Technical Details

### Server-side (server.js):
- WebSocket server menggunakan Socket.IO
- Event handlers untuk team connection, admin commands, dan progress updates
- Real-time broadcasting ke semua connected clients

### Client-side (app.js):
- WebSocket client untuk tim
- Event listeners untuk admin commands
- Real-time progress reporting ke admin

### Admin Panel (admin.js):
- WebSocket client untuk admin
- Game control interface
- Real-time monitoring dashboard
- Team management features

## File Changes:
- `server.js`: Added WebSocket server and event handlers
- `public/app.js`: Added WebSocket client for teams
- `public/admin.js`: Added WebSocket client and game control for admin
- `public/admin.html`: Added game control section
- `public/admin-styles.css`: Added styles for game control and monitoring
- `public/index.html`: Added Socket.IO client script

## Benefits:
1. **Synchronized Experience**: Semua tim bermain bersamaan
2. **Real-time Monitoring**: Admin dapat melihat progress semua tim
3. **Centralized Control**: Admin memiliki kontrol penuh atas permainan
4. **Better Management**: Admin dapat mengelola tim yang bermasalah
5. **Improved User Experience**: Tim tidak perlu menunggu atau mengatur sendiri

## Security:
- Admin authentication tetap diperlukan
- WebSocket connections menggunakan token authentication
- Team connections divalidasi melalui database

## Future Enhancements:
- Chat system untuk komunikasi admin-tim
- Advanced analytics dengan real-time charts
- Custom game settings per session
- Team grouping dan tournament modes
