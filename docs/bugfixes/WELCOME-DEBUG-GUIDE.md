# Welcome Screen Debug Guide - Tuna Adventure Game Demo

## Masalah
Welcome screen tidak muncul meskipun sudah diperbaiki. User melihat tampilan kosong di area content.

## Debug Steps

### 1. **Buka Browser Console**
- Tekan F12 atau Ctrl+Shift+I
- Buka tab Console

### 2. **Periksa Log Debug**
Cari log dengan format:
```
🎯 showAppropriateContent called {currentScreen: "...", gameState: "...", isGameStarted: ...}
  - Removed active from: ...
  - Added active to: ...
```

### 3. **Test Manual di Console**
Jalankan command berikut di console:

```javascript
// Cek state saat ini
debugTuna.getState()

// Force show welcome content
debugTuna.showWelcome()

// Test showAppropriateContent
debugTuna.showAppropriate()
```

### 4. **Periksa DOM Elements**
```javascript
// Cek apakah welcome-content element ada
document.getElementById('welcome-content')

// Cek class active
document.querySelectorAll('.content-section.active')

// Cek semua content sections
document.querySelectorAll('.content-section')
```

### 5. **Periksa CSS**
Pastikan CSS untuk `.content-section.active` berfungsi:
```css
.content-section.active {
  display: block;
}
```

## Kemungkinan Penyebab

### 1. **Element tidak ditemukan**
- `welcome-content` element tidak ada di DOM
- HTML structure berubah

### 2. **CSS conflict**
- Class `active` tidak diterapkan dengan benar
- CSS override yang tidak diinginkan

### 3. **JavaScript error**
- Error di method `showAppropriateContent()`
- State tidak di-set dengan benar

### 4. **Timing issue**
- DOM belum siap saat method dipanggil
- Race condition antara methods

## Solusi yang Sudah Diimplementasi

### 1. **Enhanced Logging**
- Log detail di `showAppropriateContent()`
- Log di `forceShowWelcomeContent()`

### 2. **Fallback Method**
- `forceShowWelcomeContent()` sebagai backup
- Timeout untuk memastikan DOM siap

### 3. **Debug Tools**
- `window.debugTuna` untuk testing manual
- State inspection methods

## Testing Commands

### **Test 1: Basic State Check**
```javascript
debugTuna.getState()
```

### **Test 2: Force Show Welcome**
```javascript
debugTuna.showWelcome()
```

### **Test 3: Check DOM**
```javascript
// Cek semua content sections
document.querySelectorAll('.content-section').forEach(el => {
  console.log(el.id, el.classList.contains('active'));
});
```

### **Test 4: Manual CSS Test**
```javascript
// Manual set active class
document.getElementById('welcome-content').classList.add('active');
```

## Expected Results

### **Normal Flow:**
1. User login → `showAppropriateContent()` dipanggil
2. `currentScreen = 'welcome-content'` → Welcome content muncul
3. Log: `Added active to: welcome-content`

### **Server Restart:**
1. Server restart → `clearGameState()` dipanggil
2. `currentScreen = 'welcome-content'` → Welcome content muncul
3. Fallback: `forceShowWelcomeContent()` dipanggil setelah 100ms

## Next Steps

Jika welcome content masih tidak muncul:

1. **Cek console logs** untuk error messages
2. **Jalankan debug commands** di console
3. **Periksa DOM structure** apakah `welcome-content` ada
4. **Test manual CSS** untuk memastikan styling berfungsi
5. **Report findings** dengan log output yang relevan
