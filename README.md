# 🐟 Petualangan Puncak TUNA

Sebuah game papan berbasis web yang menantang kemampuan kelompok dalam menavigasi dunia yang penuh **Turbulensi**, **Ketidakpastian (Uncertainty)**, **Kebaruan (Novelty)**, dan **Ambiguitas**.

## 🎯 Tujuan Permainan

Mencapai "Puncak Visi" dengan membuat keputusan terbaik dalam tujuh situasi yang semakin kompleks. Kelompok dengan skor tertinggi di akhir permainan adalah pemenangnya.

## 🚀 Fitur Utama

- **7 Tantangan TUNA**: Setiap tantangan menguji aspek berbeda dari kompleksitas
- **Sistem Scoring**: Penilaian berdasarkan kesesuaian dengan jawaban standar
- **Leaderboard**: Peringkat tim berdasarkan skor total
- **UI Modern**: Interface yang menarik dan mudah digunakan
- **Responsive Design**: Dapat dimainkan di desktop dan mobile
- **Security**: Autentikasi JWT dan validasi input

## 🛠️ Teknologi

### Backend

- **Node.js** dengan Express.js
- **MySQL** database
- **JWT** untuk autentikasi
- **bcryptjs** untuk enkripsi password
- **Helmet** untuk security headers
- **Rate limiting** untuk mencegah abuse

### Frontend

- **Vanilla JavaScript** (ES6+)
- **CSS3** dengan animasi modern
- **Font Awesome** untuk ikon
- **Google Fonts** (Poppins)

## 📋 Prerequisites

- Node.js (v14 atau lebih baru)
- MySQL (v8.0 atau lebih baru)
- NPM atau Yarn

## 🔧 Instalasi

1. **Clone atau download project**

   ```bash
   cd tuna
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup database**

   - Buat database MySQL baru
   - Import schema dari `database/schema.sql`

   ```bash
   mysql -u root -p < database/schema.sql
   ```

4. **Setup konfigurasi**

   ```bash
   cp config.example.js config.js
   ```

   Edit `config.js` dengan informasi database Anda:

   ```javascript
   module.exports = {
     database: {
       host: "localhost",
       user: "your_username",
       password: "your_password",
       database: "tuna_adventure",
     },
     server: {
       port: 3000,
     },
     jwt: {
       secret: "your_super_secret_jwt_key_here",
     },
   };
   ```

5. **Jalankan server**

   ```bash
   npm start
   ```

   Atau untuk development:

   ```bash
   npm run dev
   ```

6. **Akses game**
   Buka browser dan kunjungi: `http://localhost:3000`

## 🎮 Cara Bermain

### 1. Daftar Tim

- Buat tim baru dengan nama unik
- Tambahkan 1-5 anggota tim
- Tentukan password tim

### 2. Login

- Masuk dengan nama tim dan password
- Mulai petualangan

### 3. Menyelesaikan Tantangan

- Baca scenario dengan teliti
- Diskusikan dengan tim (15 menit)
- Tuliskan keputusan dan argumentasi
- Kirim jawaban untuk mendapat skor

### 4. Melihat Hasil

- Bandingkan dengan jawaban standar
- Lihat skor yang didapat
- Lanjut ke tantangan berikutnya

### 5. Peringkat

- Lihat leaderboard untuk membandingkan skor
- Tim dengan skor tertinggi menang!

## 🏗️ Struktur Project

```
tuna/
├── config/
│   ├── database.js          # Database configuration
│   └── config.example.js    # Example configuration
├── database/
│   └── schema.sql           # Database schema
├── middleware/
│   ├── auth.js             # Authentication middleware
│   └── validation.js       # Input validation
├── routes/
│   ├── auth.js             # Authentication routes
│   └── game.js             # Game logic routes
├── public/
│   ├── index.html          # Main HTML file
│   ├── styles.css          # CSS styles
│   └── app.js              # Frontend JavaScript
├── server.js               # Main server file
├── package.json            # Dependencies
└── README.md              # Documentation
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcryptjs untuk enkripsi password
- **Rate Limiting**: Mencegah brute force attacks
- **Input Validation**: Sanitasi semua input user
- **CORS Protection**: Konfigurasi CORS yang aman
- **Helmet**: Security headers

## 🚀 Deployment

### Production Setup

1. **Environment Variables**

   ```bash
   export NODE_ENV=production
   export DB_HOST=your_db_host
   export DB_USER=your_db_user
   export DB_PASSWORD=your_db_password
   export DB_NAME=tuna_adventure
   export JWT_SECRET=your_very_secure_jwt_secret
   export PORT=3000
   ```

2. **Database Setup**

   - Pastikan MySQL server berjalan
   - Import schema.sql ke database production

3. **Start Server**
   ```bash
   npm start
   ```

### Hosting Recommendations

- **Shared Hosting**: Pastikan support Node.js dan MySQL
- **VPS**: Ubuntu/CentOS dengan Node.js dan MySQL
- **Cloud**: DigitalOcean, AWS, atau Google Cloud
- **PaaS**: Heroku, Railway, atau Vercel

## 📊 Database Schema

### Tables

- **teams**: Informasi tim dan skor
- **players**: Anggota tim
- **game_sessions**: Session management
- **team_decisions**: Jawaban tim untuk setiap scenario
- **game_scenarios**: 7 scenario yang sudah terdefinisi

## 🎯 Scoring System

Skor berdasarkan kesesuaian dengan jawaban standar:

- **15 poin**: Sangat sesuai dengan jawaban standar
- **12 poin**: Sesuai dengan pemahaman TUNA yang baik
- **10 poin**: Keputusan benar, argumentasi kurang tajam
- **7 poin**: Beberapa pertimbangan relevan
- **5 poin**: Sedikit relevan
- **0 poin**: Tidak relevan atau kontraproduktif

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**

   - Pastikan MySQL server berjalan
   - Cek konfigurasi database di config.js
   - Pastikan database 'tuna_adventure' sudah dibuat

2. **Port Already in Use**

   - Ganti port di config.js
   - Atau kill process yang menggunakan port tersebut

3. **CORS Issues**

   - Cek konfigurasi CORS di server.js
   - Pastikan domain frontend sudah diizinkan

4. **JWT Errors**
   - Pastikan JWT_SECRET sudah di-set
   - Token mungkin expired, coba login ulang

## 🤝 Contributing

1. Fork project
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - lihat file LICENSE untuk detail

## 📞 Support

Jika ada pertanyaan atau masalah:

1. Cek dokumentasi ini
2. Lihat troubleshooting section
3. Buat issue di repository

---

**Selamat bermain Petualangan Puncak TUNA! 🐟🏔️**
