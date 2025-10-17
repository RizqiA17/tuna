# Game State Restoration Fix V2 - Tuna Adventure Game

## Masalah yang Dilaporkan

**Issue**: User masih melihat welcome screen ketika keluar dan masuk lagi, meskipun sudah berada di step 2.

## Perubahan yang Dilakukan

### 1. **Enhanced Game State Restoration** (`public/app.js`)

#### A. **Server-First Restoration dengan Logging**
```javascript
async restoreGameState() {
  // First, try to get current game state from server
  if (this.teamData) {
    const response = await this.apiRequest("/game/status");
    if (response.success) {
      const serverState = response.data;
      
      // Update team data with server state
      this.teamData.currentPosition = serverState.currentPosition;
      this.teamData.totalScore = serverState.totalScore;
      
      // Logging untuk debugging
      this.logger.info("Determining screen based on server state", {
        isGameComplete: serverState.isGameComplete,
        hasCurrentScenario: !!serverState.currentScenario,
        currentPosition: serverState.currentPosition
      });
      
      // Determine appropriate screen
      if (serverState.isGameComplete) {
        this.currentScreen = 'complete-content';
        this.gameState = 'ended';
      } else if (serverState.currentScenario) {
        // PENTING: Team di scenario - tampilkan scenario!
        this.currentScenario = serverState.currentScenario;
        this.currentScreen = 'scenario-content';
        this.gameState = 'running';
        this.currentScenarioPosition = serverState.currentPosition;
        
        // Update UI langsung
        this.updateScenarioUI();
        this.updateGameUI();
      } else if (serverState.currentPosition > 1) {
        // Team menunggu admin
        this.currentScreen = 'welcome-content';
        this.gameState = 'waiting';
        this.isWaitingForAdmin = true;
      } else {
        // Team belum mulai
        this.currentScreen = 'welcome-content';
        this.gameState = 'waiting';
      }
      
      return true;
    }
  }
  return false;
}
```

#### B. **Improved Initialization Flow**
```javascript
async init() {
  // ...
  if (this.token) {
    await this.loadTeamData();
    
    // Restore game state
    const gameStateRestored = await this.restoreGameState();
    
    // Always show game screen
    this.showScreen("game-screen");
    this.updateGameUI();
    
    // Set default if not restored
    if (!gameStateRestored) {
      this.currentScreen = 'welcome-content';
    }
    
    // ALWAYS call showAppropriateContent
    this.showAppropriateContent();
  }
}
```

#### C. **Enhanced showAppropriateContent()**
```javascript
showAppropriateContent() {
  console.log('🎯 showAppropriateContent called', {
    currentScreen: this.currentScreen,
    gameState: this.gameState,
    currentPosition: this.teamData?.currentPosition,
    hasCurrentScenario: !!this.currentScenario
  });
  
  // Hide all sections
  document.querySelectorAll(".content-section").forEach(section => {
    section.classList.remove("active");
  });
  
  // Show the right section
  if (this.currentScreen && document.getElementById(this.currentScreen)) {
    document.getElementById(this.currentScreen).classList.add("active");
    
    // Update scenario UI if showing scenario
    if (this.currentScreen === 'scenario-content' && this.currentScenario) {
      this.updateScenarioUI();
    }
    
    // Update welcome UI if showing welcome
    if (this.currentScreen === 'welcome-content' && this.teamData?.currentPosition > 1) {
      this.updateWelcomeContentForProgress();
    }
  }
}
```

### 2. **New Helper Method: updateWelcomeContentForProgress()**

```javascript
updateWelcomeContentForProgress() {
  if (!this.teamData || this.teamData.currentPosition <= 1) return;
  
  const title = document.querySelector('#welcome-content h3');
  const description = document.querySelector('#welcome-content p');
  const startButton = document.getElementById('startGameBtn');
  
  if (this.teamData.currentPosition > 7) {
    title.textContent = '🏆 Petualangan Selesai!';
    description.textContent = `Selamat! Tim Anda telah menyelesaikan semua tantangan dengan total skor ${this.teamData.totalScore} poin.`;
    startButton.style.display = 'none';
  } else if (this.isWaitingForAdmin) {
    title.textContent = '⏳ Menunggu Admin';
    description.textContent = `Tim Anda telah menyelesaikan Pos ${this.teamData.currentPosition - 1} dengan skor ${this.teamData.totalScore} poin. Menunggu admin untuk memulai pos berikutnya.`;
    startButton.textContent = '⏳ Menunggu Admin...';
    startButton.disabled = true;
  } else {
    title.textContent = '🎯 Lanjutkan Petualangan!';
    description.textContent = `Tim Anda berada di Pos ${this.teamData.currentPosition} dengan total skor ${this.teamData.totalScore} poin. Siap untuk tantangan berikutnya?`;
    startButton.textContent = '🚀 Lanjutkan Petualangan';
    startButton.disabled = false;
  }
}
```

### 3. **Enhanced startGame() untuk Handle Continuation**

```javascript
async startGame() {
  // Check if team is continuing
  if (this.teamData && this.teamData.currentPosition > 1) {
    // Team is continuing - get current scenario
    const response = await this.apiRequest(`/game/scenario/${this.teamData.currentPosition}`);
    
    if (response.success) {
      this.currentScenario = response.data;
      this.currentScenarioPosition = this.teamData.currentPosition;
      this.updateScenarioUI();
      
      // Show scenario content
      document.getElementById("welcome-content").classList.remove("active");
      document.getElementById("scenario-content").classList.add("active");
      this.currentScreen = 'scenario-content';
      
      this.showNotification(
        `Lanjutkan ke Pos ${this.teamData.currentPosition}: ${this.currentScenario.title}`,
        "success"
      );
      return;
    }
  }
  
  // Team starting fresh - existing logic
  // ...
}
```

## Flow Restoration yang Baru

### **Skenario 1: User di Step 2**
```
1. User login → loadTeamData()
2. restoreGameState() → fetch /api/game/status
3. Server return: {currentPosition: 2, currentScenario: {...}}
4. Frontend set: currentScreen = 'scenario-content'
5. Frontend call: updateScenarioUI() + updateGameUI()
6. showAppropriateContent() → tampilkan scenario-content
7. ✅ User melihat Step 2 scenario
```

### **Skenario 2: User Menunggu Admin**
```
1. User login → loadTeamData()
2. restoreGameState() → fetch /api/game/status
3. Server return: {currentPosition: 3, currentScenario: null}
4. Frontend set: currentScreen = 'welcome-content', isWaitingForAdmin = true
5. showAppropriateContent() → tampilkan welcome-content
6. updateWelcomeContentForProgress() → update pesan "Menunggu Admin"
7. ✅ User melihat welcome dengan pesan yang sesuai
```

### **Skenario 3: User Belum Mulai**
```
1. User login → loadTeamData()
2. restoreGameState() → fetch /api/game/status
3. Server return: {currentPosition: 1, currentScenario: {...}}
4. Frontend set: currentScreen = 'scenario-content' ATAU 'welcome-content'
5. showAppropriateContent() → tampilkan screen yang sesuai
6. ✅ User melihat welcome atau scenario step 1
```

## Debugging Tools

### 1. **Console Logging**
Semua log penting sudah ditambahkan untuk debugging:
- "Determining screen based on server state"
- "Team is in scenario, setting scenario content"
- "showAppropriateContent called" dengan state lengkap

### 2. **Test Page**
File `public/test-game-state.html` untuk testing manual:
```
http://localhost:3000/test-game-state.html
```

Tests available:
- Test 1: Check Server Status Endpoint
- Test 2: Check Current Game State
- Test 3: Simulate Game State Restoration
- Test 4: Check LocalStorage

### 3. **Browser Console Commands**
```javascript
// Check server state
fetch('/api/game/status', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('tuna_token')
  }
}).then(r => r.json()).then(console.log)

// Check frontend state
console.log({
  currentScreen: game.currentScreen,
  currentScenario: game.currentScenario,
  teamData: game.teamData
})
```

## Testing Manual

### Langkah Testing:
1. **Start server**: `node server.js`
2. **Register team** dan complete step 1
3. **Close browser** (saat di step 2)
4. **Open browser** dan login kembali
5. **Expected**: Melihat scenario step 2
6. **Check console** untuk log debugging

### Expected Console Output:
```
Token found, attempting to load team data
Determining screen based on server state
  - isGameComplete: false
  - hasCurrentScenario: true
  - currentPosition: 2
Team is in scenario, setting scenario content
Game state restored from server
showAppropriateContent called
  - currentScreen: scenario-content
  - hasCurrentScenario: true
  - Added active to: scenario-content
  - Updating scenario UI for restored scenario
```

## Files Modified

1. **`public/app.js`**:
   - `restoreGameState()` - Enhanced dengan logging dan UI update
   - `showAppropriateContent()` - Enhanced dengan scenario UI update
   - `updateWelcomeContentForProgress()` - New method
   - `startGame()` - Enhanced untuk handle continuation
   - `init()` - Improved flow

2. **New Files**:
   - `GAME-STATE-RESTORATION-FIX-V2.md` - Dokumentasi ini
   - `TESTING-GAME-STATE-RESTORATION.md` - Testing guide
   - `public/test-game-state.html` - Testing tools

## Backward Compatibility

✅ **Server restart safety**: Tetap aman
✅ **LocalStorage fallback**: Tetap ada
✅ **Existing features**: Tidak terpengaruh
✅ **Admin panel**: Tidak terpengaruh

## Kesimpulan

Perbaikan ini memastikan bahwa:
1. ✅ User di step 2 → Melihat scenario step 2
2. ✅ User menunggu admin → Melihat welcome dengan pesan yang sesuai
3. ✅ User belum mulai → Melihat welcome screen normal
4. ✅ Semua state di-restore dari server (server-first approach)
5. ✅ Logging lengkap untuk debugging
6. ✅ Testing tools tersedia untuk verifikasi


