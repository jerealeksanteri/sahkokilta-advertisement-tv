// Electron main process for Sähkökilta Advertisement TV
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;

/**
 * Create the main application window
 */
function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    fullscreen: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icons/app-icon.png'),
    show: false // Don't show until ready
  });

  // Load the main HTML file
  const indexPath = path.join(__dirname, '../index.html');
  
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    // Create a basic HTML file if it doesn't exist
    const basicHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sähkökilta Advertisement TV</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #ff6b35, #004e89);
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            text-align: center;
          }
          .logo {
            font-size: 3em;
            margin-bottom: 20px;
          }
          .status {
            font-size: 1.5em;
            opacity: 0.8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">Sähkökilta ry</div>
          <div class="status">Advertisement TV System</div>
          <div class="status">Initializing...</div>
        </div>
        <script>
          // Basic initialization
          console.log('Sähkökilta Advertisement TV starting...');
          
          // Load main application
          setTimeout(() => {
            const script = document.createElement('script');
            script.src = './js/main.js';
            document.head.appendChild(script);
          }, 1000);
        </script>
      </body>
      </html>
    `;
    
    fs.writeFileSync(indexPath, basicHTML);
    mainWindow.loadFile(indexPath);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Hide cursor for kiosk mode
    mainWindow.webContents.insertCSS('* { cursor: none !important; }');
    
    console.log('Sähkökilta Advertisement TV window ready');
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation (prevent external links)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
      console.log('Blocked navigation to:', navigationUrl);
    }
  });

  // Handle new window requests
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('Blocked new window request:', url);
    return { action: 'deny' };
  });

  // Development tools (only in development)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Set up IPC handlers for communication with renderer process
 */
function setupIPC() {
  // Handle application restart
  ipcMain.handle('app:restart', async () => {
    app.relaunch();
    app.exit();
  });

  // Handle application quit
  ipcMain.handle('app:quit', async () => {
    app.quit();
  });

  // Handle fullscreen toggle
  ipcMain.handle('app:toggle-fullscreen', async () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      return mainWindow.isFullScreen();
    }
    return false;
  });

  // Handle display info request
  ipcMain.handle('display:get-info', async () => {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    return {
      primary: {
        id: primaryDisplay.id,
        bounds: primaryDisplay.bounds,
        workArea: primaryDisplay.workArea,
        scaleFactor: primaryDisplay.scaleFactor,
        rotation: primaryDisplay.rotation
      },
      all: displays.map(display => ({
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        rotation: display.rotation
      }))
    };
  });

  // Handle configuration file operations
  ipcMain.handle('config:read', async (event, filePath) => {
    try {
      const fullPath = path.resolve(filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('config:write', async (event, filePath, content) => {
    try {
      const fullPath = path.resolve(filePath);
      fs.writeFileSync(fullPath, content, 'utf8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handle system information
  ipcMain.handle('system:get-info', async () => {
    const os = require('os');
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: {
        model: os.cpus()[0].model,
        cores: os.cpus().length,
        speed: os.cpus()[0].speed
      }
    };
  });
}

/**
 * Handle application events
 */
function setupAppEvents() {
  // This method will be called when Electron has finished initialization
  app.whenReady().then(() => {
    setupIPC();
    createWindow();

    app.on('activate', () => {
      // On macOS, re-create window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // Quit when all windows are closed
  app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Handle certificate errors (for development)
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (process.env.NODE_ENV === 'development') {
      // In development, ignore certificate errors
      event.preventDefault();
      callback(true);
    } else {
      // In production, use default behavior
      callback(false);
    }
  });

  // Handle GPU process crashed
  app.on('gpu-process-crashed', (event, killed) => {
    console.error('GPU process crashed:', { killed });
    
    // Restart the application
    app.relaunch();
    app.exit();
  });

  // Handle renderer process crashed
  app.on('render-process-gone', (event, webContents, details) => {
    console.error('Renderer process gone:', details);
    
    // Restart the application
    app.relaunch();
    app.exit();
  });

  // Handle child process gone
  app.on('child-process-gone', (event, details) => {
    console.error('Child process gone:', details);
  });

  // Security: Prevent new window creation
  app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      console.log('Blocked new window:', navigationUrl);
    });
  });
}

/**
 * Configure application security
 */
function configureAppSecurity() {
  // Disable hardware acceleration if needed (for older Raspberry Pi)
  if (process.env.DISABLE_GPU === 'true') {
    app.disableHardwareAcceleration();
  }

  // Set app user model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('fi.sahkokilta.advertisement-tv');
  }

  // Configure app paths
  const userDataPath = path.join(app.getPath('userData'), 'SahkokiltaTV');
  app.setPath('userData', userDataPath);

  // Set up crash reporting directory
  const crashesPath = path.join(userDataPath, 'crashes');
  if (!fs.existsSync(crashesPath)) {
    fs.mkdirSync(crashesPath, { recursive: true });
  }
}

/**
 * Initialize the application
 */
function initialize() {
  console.log('Starting Sähkökilta Advertisement TV...');
  console.log('Electron version:', process.versions.electron);
  console.log('Node version:', process.versions.node);
  console.log('Chrome version:', process.versions.chrome);

  // Configure security and paths
  configureAppSecurity();

  // Set up application events
  setupAppEvents();

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    
    // Log to file if possible
    const logPath = path.join(app.getPath('userData'), 'error.log');
    const logEntry = `${new Date().toISOString()} - Uncaught Exception: ${error.stack}\n`;
    
    try {
      fs.appendFileSync(logPath, logEntry);
    } catch (logError) {
      console.error('Failed to write error log:', logError);
    }
    
    // Restart application
    app.relaunch();
    app.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Log to file if possible
    const logPath = path.join(app.getPath('userData'), 'error.log');
    const logEntry = `${new Date().toISOString()} - Unhandled Rejection: ${reason}\n`;
    
    try {
      fs.appendFileSync(logPath, logEntry);
    } catch (logError) {
      console.error('Failed to write error log:', logError);
    }
  });
}

// Start the application
initialize();