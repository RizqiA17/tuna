# Implementasi Auto-Submit saat Timer Habis

## Perubahan yang Dilakukan

### 1. Method `autoSubmitOnTimeout()` (Baris 1765-1856)
Method yang mengirim jawaban otomatis dengan logika:
- **Jika ada jawaban di form fields**: Menggunakan jawaban yang sudah diisi user
- **Jika tidak ada jawaban**: Mengirim string kosong (""):
  - **Decision**: "" (string kosong)
  - **Argumentation**: "" (string kosong)
- **Score**: Berdasarkan algoritma scoring (bisa > 0 jika ada jawaban user, 0 jika kosong)

### 2. Integrasi dengan Timer (2 lokasi)
#### a. startTimer() - Baris 2278-2289
```javascript
if (this.timeLeft <= 0) {
  console.log("⏰ TIMER EXPIRED - Calling auto-submit...");
  this.stopTimer();
  this.showNotification(
    "Waktu habis! Jawaban akan dikirim otomatis.",
    "warning"
  );
  console.log("🚀 Calling autoSubmitOnTimeout()...");
  this.autoSubmitOnTimeout();
}
```

#### b. restoreTimerState() - Baris 2418-2429
```javascript
if (this.timeLeft <= 0) {
  console.log("⏰ TIMER EXPIRED (restored) - Calling auto-submit...");
  this.stopTimer();
  this.showNotification(
    "Waktu habis! Jawaban akan dikirim otomatis.",
    "warning"
  );
  console.log("🚀 Calling autoSubmitOnTimeout() (restored)...");
  this.autoSubmitOnTimeout();
}
```

## Cara Menguji

### Test di Browser (Aplikasi Utama)
1. Buka aplikasi di browser: `http://localhost:3000`
2. Login sebagai team
3. Mulai game dan masuk ke decision screen
4. **Test Case 1**: Biarkan form kosong, tunggu timer habis → Akan mengirim jawaban kosong ("")
5. **Test Case 2**: Isi form dengan jawaban, tunggu timer habis → Akan mengirim jawaban yang sudah diisi
6. Lihat console.log untuk debugging

### Test Files yang Tersedia
1. `test-auto-submit-verification.html` - Test dengan timer 3 detik + form fields untuk testing
2. `test-1second-timer.html` - Test dengan timer 1 detik
3. `test-simple-timer.html` - Test dengan timer 2 detik
4. `test-debug-timer.html` - Test dengan debugging lengkap

## Cara Mengakses Test Files
1. Buka browser
2. Akses: `http://localhost:3000/test-auto-submit-verification.html`
3. **Test Case 1**: Klik "Start 3 Second Timer" tanpa mengisi form → Lihat empty strings ("")
4. **Test Case 2**: Isi form fields dengan jawaban, klik "Start 3 Second Timer" → Lihat jawaban yang diisi
5. Tunggu 3 detik dan lihat hasil di console log

## Debugging
Jika auto-submit tidak berfungsi, periksa console.log untuk:
1. `⏰ TIMER EXPIRED - Calling auto-submit...` - Timer habis
2. `🚀 Calling autoSubmitOnTimeout()...` - Method dipanggil
3. `🚨 AUTO-SUBMIT TRIGGERED - Timer expired!` - Method mulai eksekusi
4. `📝 Using existing answers from form fields` - Menggunakan jawaban yang ada
5. `⏰ No existing answers found, sending empty strings` - Mengirim string kosong
6. `🚀 Submitting timeout response...` - API request dikirim
7. `✅ Auto-submit successful` - Response sukses

## Kemungkinan Masalah

### 1. currentScenario atau teamData null
Jika method dipanggil tapi tidak ada scenario/team data:
```
Cannot auto-submit: missing scenario or team data
```

### 2. API Request Gagal
Jika ada error saat mengirim request:
```
Auto-submit failed: [error message]
```

### 3. Timer Tidak Berjalan
Jika timer tidak countdown, periksa apakah `startTimer()` dipanggil.

## Solusi untuk Testing dengan Timer Pendek
Untuk mempercepat testing, ubah durasi timer di `app.js`:
```javascript
// Baris 2262: Ubah dari 900 detik (15 menit) menjadi lebih pendek
this.timeLeft = 10; // 10 detik untuk testing
this.timerDuration = 10;
```

Jangan lupa kembalikan ke 900 setelah testing selesai!

