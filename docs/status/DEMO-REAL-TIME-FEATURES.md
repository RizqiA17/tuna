# Demo Mode - Real-time Game Control Features

## Overview
Server demo (`server-demo.js`) telah diperbarui dengan fitur real-time yang sama seperti server utama, tetapi berjalan tanpa database untuk testing yang mudah.

## Fitur Demo Mode

### ✅ **WebSocket Integration (Demo)**
- Socket.IO untuk komunikasi real-time
- Tidak memerlukan database
- Data disimpan dalam memory (hilang saat restart)
- Perfect untuk testing dan development

### ✅ **Admin Panel (Demo)**
- Akses admin panel di `/admin`
- Login dengan kredensial: `admin` / `tuna_admin_2024`
- Semua fitur kontrol permainan tersedia
- Real-time monitoring dashboard

### ✅ **Game Control (Demo)**
- **Start Game for All Teams**: Memulai permainan untuk semua tim
- **Next Scenario for All Teams**: Memajukan semua tim ke scenario berikutnya
- **End Game for All Teams**: Mengakhiri permainan untuk semua tim
- **Kick Team**: Mengeluarkan tim tertentu dari permainan

### ✅ **Real-time Monitoring (Demo)**
- Live team status monitoring
- Progress updates real-time
- Decision notifications
- Connection status tracking

## Cara Menjalankan Demo

### 1. Start Demo Server
```bash
node server-demo.js
```

### 2. Akses Aplikasi
- **Frontend**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **API Health**: http://localhost:3000/api/health

### 3. Testing Flow
1. **Buka Admin Panel**: Login dengan `admin` / `tuna_admin_2024`
2. **Buka Frontend**: Daftar beberapa tim untuk testing
3. **Gunakan Game Control**: Mulai permainan untuk semua tim
4. **Monitor Progress**: Lihat progress tim secara real-time
5. **Test Features**: Coba semua fitur kontrol dan monitoring

## Perbedaan dengan Server Utama

| Fitur | Server Utama | Demo Server |
|-------|-------------|-------------|
| Database | MySQL/PostgreSQL | Memory (Map) |
| Data Persistence | ✅ Permanent | ❌ Temporary |
| Admin Auth | JWT + Database | Simple Token |
| Team Management | Full CRUD | Basic Operations |
| Real-time Features | ✅ Complete | ✅ Complete |
| WebSocket | ✅ Full Support | ✅ Full Support |

## Demo Data

### Mock Teams
- Data tim disimpan dalam `Map` di memory
- Token authentication sederhana
- Progress tracking basic

### Mock Scenarios
- 7 scenario lengkap dengan jawaban standar
- Scoring algorithm yang konsisten
- Tidak memerlukan database

### Admin Features
- Login sederhana tanpa database
- Statistik real-time dari memory
- Leaderboard dari data mock

## Testing Scenarios

### 1. Multi-Team Testing
1. Buka beberapa tab browser
2. Daftar 3-5 tim berbeda
3. Login sebagai admin
4. Mulai permainan untuk semua tim
5. Monitor progress real-time

### 2. Real-time Control Testing
1. Mulai permainan
2. Lanjutkan ke scenario berikutnya
3. Kick beberapa tim
4. Monitor notifikasi real-time

### 3. Connection Testing
1. Buka/ tutup browser tabs
2. Monitor connection status di admin
3. Test reconnection behavior

## Keuntungan Demo Mode

1. **Quick Setup**: Tidak perlu setup database
2. **Easy Testing**: Restart server untuk reset data
3. **Development**: Perfect untuk development dan testing
4. **Demo Purposes**: Ideal untuk presentasi
5. **Learning**: Mudah dipelajari struktur aplikasi

## Limitations Demo Mode

1. **Data Loss**: Data hilang saat server restart
2. **No Persistence**: Tidak ada penyimpanan permanen
3. **Simple Auth**: Authentication sederhana
4. **Basic Stats**: Statistik terbatas
5. **Single Instance**: Tidak support multiple server instances

## File Structure Demo

```
server-demo.js          # Demo server dengan WebSocket
public/
├── index.html          # Frontend (sama dengan server utama)
├── admin.html          # Admin panel (sama dengan server utama)
├── app.js              # Frontend JS (sama dengan server utama)
├── admin.js            # Admin JS (sama dengan server utama)
├── styles.css          # Styles (sama dengan server utama)
└── admin-styles.css    # Admin styles (sama dengan server utama)
```

## Next Steps

1. **Test Features**: Jalankan demo dan test semua fitur
2. **Development**: Gunakan untuk development fitur baru
3. **Production**: Deploy server utama untuk production
4. **Customization**: Sesuaikan dengan kebutuhan spesifik

## Support

- Demo mode perfect untuk testing dan development
- Semua fitur real-time tersedia
- Mudah di-customize dan di-extend
- Ideal untuk pembelajaran dan presentasi
