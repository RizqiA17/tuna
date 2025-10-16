// Server-side logger utility
const fs = require('fs');
const path = require('path');

class ServerLogger {
    constructor(context = 'SERVER') {
        this.context = context;
        this.logs = [];
        this.maxLogs = 5000; // Keep last 5000 logs in memory
        this.logFile = path.join(__dirname, 'logs', `server_${new Date().toISOString().split('T')[0]}.log`);
        this.enableConsole = true;
        this.enableFile = true;
        this.enableMemory = true;
        
        // Create logs directory if it doesn't exist
        this.ensureLogDirectory();
    }

    // Log levels
    static LEVELS = {
        ERROR: 'ERROR',
        WARN: 'WARN',
        INFO: 'INFO',
        DEBUG: 'DEBUG',
        TRACE: 'TRACE'
    };

    // Ensure log directory exists
    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    // Create log entry
    createLog(level, message, data = null, category = 'GENERAL', requestId = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            context: this.context,
            category,
            message,
            data: data ? JSON.parse(JSON.stringify(data)) : null,
            requestId,
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };

        // Add to memory logs
        if (this.enableMemory) {
            this.logs.push(logEntry);
            if (this.logs.length > this.maxLogs) {
                this.logs.shift(); // Remove oldest log
            }
        }

        // Console output
        if (this.enableConsole) {
            this.consoleLog(level, logEntry);
        }

        // File output
        if (this.enableFile) {
            this.writeToFile(logEntry);
        }

        return logEntry;
    }

    // Console output with colors
    consoleLog(level, logEntry) {
        const colors = {
            [ServerLogger.LEVELS.ERROR]: '\x1b[31m', // Red
            [ServerLogger.LEVELS.WARN]: '\x1b[33m',  // Yellow
            [ServerLogger.LEVELS.INFO]: '\x1b[36m',  // Cyan
            [ServerLogger.LEVELS.DEBUG]: '\x1b[32m', // Green
            [ServerLogger.LEVELS.TRACE]: '\x1b[90m'  // Gray
        };

        const reset = '\x1b[0m';
        const color = colors[level] || '';
        const prefix = `[${logEntry.timestamp}] [${level}] [${this.context}] [${logEntry.category}]`;
        
        if (logEntry.data) {
            console.log(`${color}${prefix} ${logEntry.message}${reset}`, logEntry.data);
        } else {
            console.log(`${color}${prefix} ${logEntry.message}${reset}`);
        }
    }

    // Write to file
    writeToFile(logEntry) {
        try {
            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(this.logFile, logLine);
        } catch (error) {
            console.error('Failed to write log to file:', error);
        }
    }

    // Log methods
    error(message, data = null, category = 'ERROR', requestId = null) {
        return this.createLog(ServerLogger.LEVELS.ERROR, message, data, category, requestId);
    }

    warn(message, data = null, category = 'WARNING', requestId = null) {
        return this.createLog(ServerLogger.LEVELS.WARN, message, data, category, requestId);
    }

    info(message, data = null, category = 'INFO', requestId = null) {
        return this.createLog(ServerLogger.LEVELS.INFO, message, data, category, requestId);
    }

    debug(message, data = null, category = 'DEBUG', requestId = null) {
        return this.createLog(ServerLogger.LEVELS.DEBUG, message, data, category, requestId);
    }

    trace(message, data = null, category = 'TRACE', requestId = null) {
        return this.createLog(ServerLogger.LEVELS.TRACE, message, data, category, requestId);
    }

    // HTTP request logging
    http(method, url, status, duration, requestData = null, responseData = null, requestId = null) {
        return this.createLog(ServerLogger.LEVELS.INFO, `HTTP ${method} ${url} ${status}`, {
            method,
            url,
            status,
            duration,
            requestData,
            responseData
        }, 'HTTP', requestId);
    }

    // WebSocket logging
    websocket(event, data = null, socketId = null, direction = 'IN') {
        return this.createLog(ServerLogger.LEVELS.DEBUG, `WebSocket ${direction} ${event}`, {
            event,
            data,
            socketId,
            direction
        }, 'WEBSOCKET');
    }

    // Database logging
    database(operation, table, data = null, duration = null) {
        return this.createLog(ServerLogger.LEVELS.DEBUG, `Database ${operation} ${table}`, {
            operation,
            table,
            data,
            duration
        }, 'DATABASE');
    }

    // Game state logging
    gameState(state, data = null) {
        return this.createLog(ServerLogger.LEVELS.INFO, `Game State: ${state}`, data, 'GAME_STATE');
    }

    // Team logging
    team(action, teamId, teamName, data = null) {
        return this.createLog(ServerLogger.LEVELS.INFO, `Team ${action}`, {
            teamId,
            teamName,
            ...data
        }, 'TEAM');
    }

    // Admin logging
    admin(action, adminId, data = null) {
        return this.createLog(ServerLogger.LEVELS.INFO, `Admin ${action}`, {
            adminId,
            ...data
        }, 'ADMIN');
    }

    // System logging
    system(component, action, data = null) {
        return this.createLog(ServerLogger.LEVELS.INFO, `System ${component} ${action}`, data, 'SYSTEM');
    }

    // Performance logging
    performance(operation, duration, data = null) {
        return this.createLog(ServerLogger.LEVELS.INFO, `Performance ${operation}`, {
            operation,
            duration,
            ...data
        }, 'PERFORMANCE');
    }

    // Data logging
    data(operation, data = null, table = 'UNKNOWN') {
        return this.createLog(ServerLogger.LEVELS.DEBUG, `Data ${operation}`, data, `DATA_${table}`);
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

    // Get logs by time range
    getLogsByTimeRange(startTime, endTime) {
        return this.logs.filter(log => {
            const logTime = new Date(log.timestamp);
            return logTime >= startTime && logTime <= endTime;
        });
    }

    // Clear logs
    clearLogs() {
        this.logs = [];
    }

    // Export logs
    exportLogs() {
        const logs = this.getAllLogs();
        const exportFile = path.join(__dirname, 'logs', `export_${Date.now()}.json`);
        fs.writeFileSync(exportFile, JSON.stringify(logs, null, 2));
        return exportFile;
    }

    // Get log statistics
    getStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byCategory: {},
            byContext: {},
            oldest: null,
            newest: null
        };

        this.logs.forEach(log => {
            // By level
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            
            // By category
            stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
            
            // By context
            stats.byContext[log.context] = (stats.byContext[log.context] || 0) + 1;
            
            // Time range
            if (!stats.oldest || new Date(log.timestamp) < new Date(stats.oldest)) {
                stats.oldest = log.timestamp;
            }
            if (!stats.newest || new Date(log.timestamp) > new Date(stats.newest)) {
                stats.newest = log.timestamp;
            }
        });

        return stats;
    }
}

// Create global logger instance
const serverLogger = new ServerLogger('TUNA_SERVER');

// Export for use in other files
module.exports = { ServerLogger, serverLogger };
