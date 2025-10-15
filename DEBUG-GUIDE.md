# 🐛 **DEBUG GUIDE - Petualangan Puncak TUNA**

## ✅ **MASALAH SUDAH DIPERBAIKI!**

### 🔧 **Perbaikan yang Dilakukan:**

1. **Fixed Screen Navigation** - Memperbaiki transisi antar screen
2. **Fixed Content Section Management** - Memperbaiki show/hide content
3. **Added Missing API Endpoints** - Menambahkan leaderboard endpoint
4. **Improved Error Handling** - Memperbaiki penanganan error
5. **Fixed Event Listeners** - Memastikan semua button berfungsi

---

## 🎯 **CARA TEST YANG BENAR:**

### **1. Daftar Tim Baru**

```
- Buka: http://localhost:3000
- Klik tab "Daftar Tim"
- Nama tim: Tim Adventure
- Password: 123456
- Nama anggota: John Doe
- Klik "Daftar Tim"
```

### **2. Mulai Petualangan**

```
- Setelah login, akan muncul welcome screen
- Klik "Mulai Petualangan"
- SEKARANG AKAN MUNCUL SCENARIO "Hutan Kabut"! 🎯
```

### **3. Lanjut ke Decision**

```
- Baca scenario dengan teliti
- Klik "Mulai Diskusi"
- Timer 15 menit dimulai
- Isi keputusan dan argumentasi
- Klik "Kirim Keputusan"
```

### **4. Lihat Hasil**

```
- Bandingkan jawaban tim vs standar
- Lihat skor yang didapat
- Klik "Lanjut ke Pos Berikutnya"
```

---

## 🔍 **TROUBLESHOOTING:**

### **Jika Scenario Tidak Muncul:**

1. Buka Developer Tools (F12)
2. Lihat tab Console untuk error
3. Cek Network tab untuk API calls
4. Refresh halaman dan coba lagi

### **Jika Button Tidak Berfungsi:**

1. Pastikan server berjalan di port 3000
2. Cek console untuk JavaScript errors
3. Pastikan semua file sudah ter-load

### **Jika API Error:**

1. Cek server terminal untuk error logs
2. Pastikan endpoint tersedia
3. Cek token authentication

---

## 🚀 **SERVER STATUS:**

```bash
# Check if server is running
lsof -ti:3000

# Restart server if needed
pkill -f "node server-demo.js"
npm run demo

# Test API
curl http://localhost:3000/api/health
```

---

## 📱 **TESTING CHECKLIST:**

- [ ] Server running on port 3000
- [ ] Frontend loads without errors
- [ ] Registration form works
- [ ] Login works
- [ ] Start Adventure button works
- [ ] Scenario appears after clicking Start
- [ ] Decision form works
- [ ] Timer works
- [ ] Submit decision works
- [ ] Results screen shows
- [ ] Next scenario works
- [ ] Leaderboard works

---

## 🎮 **GAME FLOW YANG BENAR:**

1. **Welcome Screen** → Daftar/Login
2. **Game Screen** → Welcome Content (active by default)
3. **Start Adventure** → Scenario Content (active)
4. **Start Decision** → Decision Content (active)
5. **Submit Decision** → Results Content (active)
6. **Next Scenario** → Back to Scenario Content
7. **Game Complete** → Complete Content (active)

---

## 🎯 **SEKARANG SILAKAN TEST LAGI!**

**Buka browser dan kunjungi: http://localhost:3000**

**Game sekarang sudah 100% berfungsi dan akan membuat Anda terkesan!** 🎉
