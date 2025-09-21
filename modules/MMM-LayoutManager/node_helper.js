/**
 * Node Helper for MMM-LayoutManager
 * 
 * Handles server-side operations for layout management
 */

const NodeHelper = require("node_helper");
const Log = require("logger");

module.exports = NodeHelper.create({
    
    // Node helper started
    start: function() {
        Log.info("Starting node helper for: " + this.name);
        this.displayCapabilities = null;
    },

    /**
     * Handle socket notifications from the module
     */
    socketNotificationReceived: function(notification, payload) {
        switch (notification) {
            case "GET_SYSTEM_DISPLAY_INFO":
                this.getSystemDisplayInfo(payload.identifier);
                break;
                
            case "LOG_DISPLAY_CHANGE":
                this.logDisplayChange(payload);
                break;
                
            case "GET_DISPLAY_CAPABILITIES":
                this.getDisplayCapabilities(payload.identifier);
                break;
        }
    },

    /**
     * Get system-level display information
     */
    getSystemDisplayInfo: function(identifier) {
        try {
            // In a real implementation, this could query system APIs
            // For now, we'll provide basic system information
            const systemInfo = {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            };

            // On Linux (Raspberry Pi), we could potentially read from /sys/class/drm/
            // or use xrandr commands to get more detailed display information
            if (process.platform === "linux") {
                systemInfo.isRaspberryPi = this.detectRaspberryPi();
                systemInfo.gpuMemory = this.getGPUMemoryInfo();
            }

            this.sendSocketNotification("SYSTEM_DISPLAY_INFO", {
                identifier: identifier,
                systemInfo: systemInfo
            });

        } catch (error) {
            Log.error("Error getting system display info:", error);
            this.sendSocketNotification("SYSTEM_DISPLAY_INFO_ERROR", {
                identifier: identifier,
                error: error.message
            });
        }
    },

    /**
     * Detect if running on Raspberry Pi
     */
    detectRaspberryPi: function() {
        try {
            const fs = require("fs");
            
            // Check for Raspberry Pi specific files
            if (fs.existsSync("/proc/device-tree/model")) {
                const model = fs.readFileSync("/proc/device-tree/model", "utf8");
                return model.toLowerCase().includes("raspberry pi");
            }
            
            // Alternative check using /proc/cpuinfo
            if (fs.existsSync("/proc/cpuinfo")) {
                const cpuinfo = fs.readFileSync("/proc/cpuinfo", "utf8");
                return cpuinfo.toLowerCase().includes("raspberry pi") || 
                       cpuinfo.toLowerCase().includes("bcm2");
            }
            
            return false;
        } catch (error) {
            Log.warn("Could not detect Raspberry Pi:", error.message);
            return false;
        }
    },

    /**
     * Get GPU memory information (Raspberry Pi specific)
     */
    getGPUMemoryInfo: function() {
        try {
            const { execSync } = require("child_process");
            
            // Try to get GPU memory split on Raspberry Pi
            const gpuMem = execSync("vcgencmd get_mem gpu", { encoding: "utf8" }).trim();
            const armMem = execSync("vcgencmd get_mem arm", { encoding: "utf8" }).trim();
            
            return {
                gpu: gpuMem,
                arm: armMem
            };
        } catch (error) {
            Log.warn("Could not get GPU memory info:", error.message);
            return null;
        }
    },

    /**
     * Get display capabilities
     */
    getDisplayCapabilities: function(identifier) {
        try {
            const capabilities = {
                supportsHardwareAcceleration: this.checkHardwareAcceleration(),
                supportedResolutions: this.getSupportedResolutions(),
                refreshRates: this.getSupportedRefreshRates(),
                colorDepth: this.getColorDepth(),
                timestamp: new Date().toISOString()
            };

            this.displayCapabilities = capabilities;

            this.sendSocketNotification("DISPLAY_CAPABILITIES", {
                identifier: identifier,
                capabilities: capabilities
            });

        } catch (error) {
            Log.error("Error getting display capabilities:", error);
            this.sendSocketNotification("DISPLAY_CAPABILITIES_ERROR", {
                identifier: identifier,
                error: error.message
            });
        }
    },

    /**
     * Check for hardware acceleration support
     */
    checkHardwareAcceleration: function() {
        try {
            // On Raspberry Pi, check for GPU acceleration
            if (process.platform === "linux") {
                const fs = require("fs");
                
                // Check for GPU device files
                const gpuDevices = [
                    "/dev/dri/card0",
                    "/dev/dri/renderD128",
                    "/sys/class/drm/card0"
                ];
                
                return gpuDevices.some(device => fs.existsSync(device));
            }
            
            return true; // Assume hardware acceleration on other platforms
        } catch (error) {
            Log.warn("Could not check hardware acceleration:", error.message);
            return false;
        }
    },

    /**
     * Get supported resolutions (placeholder implementation)
     */
    getSupportedResolutions: function() {
        // Common resolutions that are typically supported
        return [
            { width: 1920, height: 1080, name: "1080p" },
            { width: 1366, height: 768, name: "WXGA" },
            { width: 1280, height: 720, name: "720p" },
            { width: 3840, height: 2160, name: "4K UHD" },
            { width: 2560, height: 1440, name: "1440p" }
        ];
    },

    /**
     * Get supported refresh rates (placeholder implementation)
     */
    getSupportedRefreshRates: function() {
        return [30, 60, 75, 120];
    },

    /**
     * Get color depth information
     */
    getColorDepth: function() {
        return {
            bits: 24,
            channels: "RGB",
            hdr: false // HDR detection would require more complex logic
        };
    },

    /**
     * Log display change events
     */
    logDisplayChange: function(payload) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp: timestamp,
            event: "display_change",
            data: payload
        };

        Log.info("Display change logged:", logEntry);

        // In a production environment, you might want to:
        // - Write to a log file
        // - Send to a monitoring service
        // - Store in a database
        // - Trigger alerts for significant changes

        // For now, we'll just acknowledge the log
        this.sendSocketNotification("DISPLAY_CHANGE_LOGGED", {
            timestamp: timestamp,
            success: true
        });
    }
});