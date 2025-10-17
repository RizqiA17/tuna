# Testing Game State Restoration - Tuna Adventure Game

## Masalah yang Dilaporkan
User masih melihat welcome screen ketika keluar dan masuk lagi, meskipun sudah berada di step 2.

## Langkah Testing Manual

### 1. **Persiapan**
1. Buka browser dengan DevTools (F12)
2. Pastikan Console tab terbuka untuk melihat log
3. Start server: `node server.js`

### 2. **Test Case 1: User di Step 2**

**Langkah:**
1. Buka `http://localhost:3000`
2. Register team baru (misalnya: "Team Test")
3. Klik "Mulai Petualangan"
4. Baca scenario Step 1
5. Klik "Mulai Diskusi"
6. Isi keputusan dan reasoning
7. Submit keputusan
8. Setelah hasil muncul, tunggu admin untuk next scenario (atau klik next jika tersedia)
9. Sekarang user di Step 2
10. **Close browser tab**
11. **Buka tab baru** dan login dengan team yang sama
12. **EXPECTED**: User seharusnya melihat Step 2 scenario
13. **ACTUAL**: Check di console dan di UI

**Console Log yang Harus Terlihat:**
```
Token found, attempting to load team data
Game state restored from server
Determining screen based on server state
  - isGameComplete: false
  - hasCurrentScenario: true
  - currentPosition: 2
Team is in scenario, setting scenario content
showAppropriateContent called
  - currentScreen: scenario-content
  - Added active to: scenario-content
```

**UI yang Harus Terlihat:**
- ✅ Scenario Step 2 ditampilkan
- ✅ Progress bar menunjukkan Step 2
- ✅ Judul scenario: "Sungai Deras"

### 3. **Test Case 2: User Belum Mulai**

**Langkah:**
1. Register team baru
2. **Close browser tab** (sebelum mulai game)
3. **Buka tab baru** dan login
4. **EXPECTED**: User melihat welcome screen
5. **ACTUAL**: Check di console dan di UI

**Console Log:**
```
Team hasn't started yet, showing welcome content
showAppropriateContent called
  - currentScreen: welcome-content
```

### 4. **Test Case 3: User Menunggu Admin**

**Langkah:**
1. Register team baru
2. Complete Step 1
3. Jangan lanjut ke Step 2 (tunggu admin)
4. **Close browser tab**
5. **Buka tab baru** dan login
6. **EXPECTED**: User melihat welcome screen dengan pesan "Menunggu Admin"
7. **ACTUAL**: Check di console dan di UI

**Console Log:**
```
Team waiting for admin, showing welcome content
showAppropriateContent called
  - currentScreen: welcome-content
Welcome message updated: "Menunggu Admin"
```

## Debugging

### Jika Masih Melihat Welcome Screen di Step 2:

**Check 1: Server Response**
```javascript
// Di console browser, cek response dari /game/status
fetch('/api/game/status', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('tuna_token')
  }
})
.then(r => r.json())
.then(d => console.log('Server state:', d))
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "teamName": "Team Test",
    "currentPosition": 2,
    "totalScore": 15,
    "isGameComplete": false,
    "currentScenario": {
      "position": 2,
      "title": "Sungai Deras",
      "scenarioText": "..."
    }
  }
}
```

**Check 2: Frontend State**
```javascript
// Di console browser, cek state frontend
console.log({
  currentScreen: game.currentScreen,
  currentScenario: game.currentScenario,
  teamData: game.teamData
})
```

**Expected State:**
```javascript
{
  currentScreen: "scenario-content",
  currentScenario: {
    position: 2,
    title: "Sungai Deras",
    scenarioText: "..."
  },
  teamData: {
    currentPosition: 2,
    totalScore: 15
  }
}
```

### Jika Server Tidak Mengembalikan currentScenario:

**Kemungkinan Penyebab:**
1. Team sudah submit decision untuk Step 2, sehingga `currentPosition` = 3
2. Database tidak memiliki scenario untuk posisi tersebut
3. Ada error di server

**Solusi:**
1. Check database: Apakah ada scenario dengan position = 2?
2. Check `team_decisions`: Apakah team sudah submit decision untuk position 2?
3. Check server log untuk error

## Log Points untuk Debugging

Berikut adalah log points penting yang sudah ditambahkan:

1. **`restoreGameState()`**:
   - "Determining screen based on server state"
   - "Team is in scenario, setting scenario content"
   - "Team waiting for admin, showing welcome content"
   - "Team hasn't started yet, showing welcome content"

2. **`showAppropriateContent()`**:
   - "showAppropriateContent called" dengan state lengkap
   - "Added active to: [screen-name]"
   - "Updating scenario UI for restored scenario"

3. **`updateScenarioUI()`**:
   - Dipanggil otomatis ketika scenario di-restore

## Next Steps

Jika masih ada masalah setelah testing:
1. Screenshot console log
2. Screenshot UI yang terlihat
3. Export localStorage: `console.log(localStorage)`
4. Export server response dari /game/status




