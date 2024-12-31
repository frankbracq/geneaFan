class MarkerLogger {
    constructor() {
        this.logs = [];
        this.performanceMetrics = [];
        this.errors = [];
        this.stats = {
            totalMarkers: 0,
            activeMarkers: 0,
            successfulMarkers: 0,
            failedMarkers: 0,
            avgCreationTime: 0
        };

        // Configuration
        this.MAX_LOGS = 1000;
        this.MAX_ERRORS = 100;
        this.MAX_METRICS = 500;
    }

    logMarkerCreation(markerData, duration) {
        this.#addLog({
            timestamp: new Date().toISOString(),
            type: 'creation',
            location: markerData.location,
            birthCount: markerData.births.length,
            generationCount: Object.keys(markerData.generations).length,
            duration: duration,
            status: 'success'
        });

        this.#updateStats('creation', duration);
    }

    logMarkerError(error, context) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            type: 'error',
            message: error.message,
            stack: error.stack,
            context: context
        };
        
        this.errors.push(errorLog);
        if (this.errors.length > this.MAX_ERRORS) {
            this.errors.shift();
        }

        this.#updateStats('error');
        console.error('🚨 Marker Error:', errorLog);
    }

    logPerformance(operation, metrics) {
        const performanceLog = {
            timestamp: new Date().toISOString(),
            operation,
            metrics,
            memory: this.getMemoryUsage()
        };
        
        this.performanceMetrics.push(performanceLog);
        if (this.performanceMetrics.length > this.MAX_METRICS) {
            this.performanceMetrics.shift();
        }
    }

    #addLog(log) {
        this.logs.push(log);
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift();
        }
    }

    #updateStats(type, duration = 0) {
        if (type === 'creation') {
            this.stats.totalMarkers++;
            this.stats.successfulMarkers++;
            
            // Mise à jour de la moyenne du temps de création
            const totalTime = this.stats.avgCreationTime * (this.stats.successfulMarkers - 1);
            this.stats.avgCreationTime = (totalTime + duration) / this.stats.successfulMarkers;
        } else if (type === 'error') {
            this.stats.failedMarkers++;
        }
    }

    getMemoryUsage() {
        if (window.performance && window.performance.memory) {
            const memory = window.performance.memory;
            return {
                totalJSHeapSize: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
                usedJSHeapSize: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
                jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / (1024 * 1024))
            };
        }
        return null;
    }

    displayStats() {
        console.group('📊 Marker Statistics');
        
        // Statistiques générales
        console.table({
            'Total Markers': this.stats.totalMarkers,
            'Active Markers': this.stats.activeMarkers,
            'Successful': this.stats.successfulMarkers,
            'Failed': this.stats.failedMarkers,
            'Avg Creation Time (ms)': Math.round(this.stats.avgCreationTime * 100) / 100
        });

        // Erreurs récentes
        if (this.errors.length > 0) {
            console.group('⚠️ Recent Errors');
            this.errors.slice(-5).forEach(error => 
                console.error(error.message, error.context)
            );
            console.groupEnd();
        }

        // Métriques de performance récentes
        const recentPerformance = this.performanceMetrics.slice(-5);
        if (recentPerformance.length > 0) {
            console.group('⚡ Recent Performance Metrics');
            console.table(recentPerformance.map(log => ({
                Operation: log.operation,
                Duration: log.metrics.duration,
                MarkersAffected: log.metrics.markersCount,
                Memory: log.memory ? `${log.memory.usedJSHeapSize}MB / ${log.memory.totalJSHeapSize}MB` : 'N/A'
            })));
            console.groupEnd();
        }

        console.groupEnd();
    }

    exportLogs() {
        return {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            recentLogs: this.logs.slice(-100),
            recentErrors: this.errors.slice(-50),
            performance: this.performanceMetrics.slice(-50)
        };
    }

    clearOldLogs() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        this.logs = this.logs.filter(log => 
            new Date(log.timestamp).getTime() > oneHourAgo
        );
        this.errors = this.errors.filter(error => 
            new Date(error.timestamp).getTime() > oneHourAgo
        );
        this.performanceMetrics = this.performanceMetrics.filter(metric => 
            new Date(metric.timestamp).getTime() > oneHourAgo
        );
    }
}

export const markerLogger = new MarkerLogger();