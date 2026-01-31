// Logger utility for frontend applications
class Logger {
    constructor(context = 'APP') {
        this.context = context;
        this.logs = [];
        this.maxLogs = 1000; // Keep last 1000 logs
        this.enableConsole = true;
        this.enableStorage = true;
        this.enableServer = false; // Will be enabled when needed
    }

    // Log levels
    static LEVELS = {
        ERROR: 'ERROR',
        WARN: 'WARN',
        INFO: 'INFO',
        DEBUG: 'DEBUG',
        TRACE: 'TRACE'
    };

    // Create log entry
    createLog(level, message, data = null, category = 'GENERAL') {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            context: this.context,
            category,
            message,
            data: data ? JSON.parse(JSON.stringify(data)) : null,
            url: window.location.href,
            userAgent: navigator.userAgent,
            sessionId: this.getSessionId()
        };

        // Add to memory logs
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift(); // Remove oldest log
        }

        // Console output
        if (this.enableConsole) {
            this.consoleLog(level, logEntry);
        }

        // Local storage
        if (this.enableStorage) {
            this.saveToStorage(logEntry);
        }

        // Server logging (if enabled)
        if (this.enableServer) {
            this.sendToServer(logEntry);
        }

        return logEntry;
    }

    // Console output with colors
    consoleLog(level, logEntry) {
        const colors = {
            [Logger.LEVELS.ERROR]: 'color: red; font-weight: bold;',
            [Logger.LEVELS.WARN]: 'color: orange; font-weight: bold;',
            [Logger.LEVELS.INFO]: 'color: blue; font-weight: bold;',
            [Logger.LEVELS.DEBUG]: 'color: green;',
            [Logger.LEVELS.TRACE]: 'color: gray;'
        };

        const style = colors[level] || 'color: black;';
        const prefix = `[${logEntry.timestamp}] [${level}] [${this.context}] [${logEntry.category}]`;
        
        if (logEntry.data) {
            // console.log(`%c${prefix} ${logEntry.message}`, style, logEntry.data);
        } else {
            // console.log(`%c${prefix} ${logEntry.message}`, style);
        }
    }

    // Save to localStorage
    saveToStorage(logEntry) {
        try {
            const storageKey = `tuna_logs_${this.context}`;
            const existingLogs = JSON.parse(localStorage.getItem(storageKey) || '[]');
            existingLogs.push(logEntry);
            
            // Keep only last 500 logs in storage
            if (existingLogs.length > 500) {
                existingLogs.splice(0, existingLogs.length - 500);
            }
            
            localStorage.setItem(storageKey, JSON.stringify(existingLogs));
        } catch (error) {
            // console.error('Failed to save log to storage:', error);
        }
    }

    // Send to server (if enabled)
    async sendToServer(logEntry) {
        try {
            if (window.socket && window.socket.connected) {
                window.socket.emit('client-log', logEntry);
            }
        } catch (error) {
            // console.error('Failed to send log to server:', error);
        }
    }

    // Get session ID
    getSessionId() {
        if (!this.sessionId) {
            this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        return this.sessionId;
    }

    // Log methods
    error(message, data = null, category = 'ERROR') {
        return this.createLog(Logger.LEVELS.ERROR, message, data, category);
    }

    warn(message, data = null, category = 'WARNING') {
        return this.createLog(Logger.LEVELS.WARN, message, data, category);
    }

    info(message, data = null, category = 'INFO') {
        return this.createLog(Logger.LEVELS.INFO, message, data, category);
    }

    debug(message, data = null, category = 'DEBUG') {
        return this.createLog(Logger.LEVELS.DEBUG, message, data, category);
    }

    trace(message, data = null, category = 'TRACE') {
        return this.createLog(Logger.LEVELS.TRACE, message, data, category);
    }

    // Network logging
    network(method, url, requestData = null, responseData = null, status = null, duration = null) {
        return this.createLog(Logger.LEVELS.INFO, `Network ${method} ${url}`, {
            method,
            url,
            requestData,
            responseData,
            status,
            duration
        }, 'NETWORK');
    }

    // WebSocket logging
    websocket(event, data = null, direction = 'OUT') {
        return this.createLog(Logger.LEVELS.DEBUG, `WebSocket ${direction} ${event}`, data, 'WEBSOCKET');
    }

    // User action logging
    userAction(action, data = null) {
        return this.createLog(Logger.LEVELS.INFO, `User Action: ${action}`, data, 'USER_ACTION');
    }

    // Game state logging
    gameState(state, data = null) {
        return this.createLog(Logger.LEVELS.INFO, `Game State: ${state}`, data, 'GAME_STATE');
    }

    // Data logging
    data(operation, data = null, table = 'UNKNOWN') {
        return this.createLog(Logger.LEVELS.DEBUG, `Data ${operation}`, data, `DATA_${table}`);
    }

    // Get all logs
    getAllLogs() {
        return this.logs;
    }

    // Get logs by level
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }

    // Get logs by category
    getLogsByCategory(category) {
        return this.logs.filter(log => log.category === category);
    }

    // Clear logs
    clearLogs() {
        this.logs = [];
        if (this.enableStorage) {
            const storageKey = `tuna_logs_${this.context}`;
            localStorage.removeItem(storageKey);
        }
    }

    // Export logs
    exportLogs() {
        const logs = this.getAllLogs();
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tuna_logs_${this.context}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Enable server logging
    enableServerLogging(socket) {
        this.enableServer = true;
        window.socket = socket;
    }

    // Disable server logging
    disableServerLogging() {
        this.enableServer = false;
    }
}

// Create global logger instances
window.TeamLogger = new Logger('TEAM');
window.AdminLogger = new Logger('ADMIN');

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}
