const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'MIJ ERP Digital Client Portal',
    icon: path.join(__dirname, '../public/favicon.ico'),
    frame: false, // Frameless window like VSCode/Antigravity
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Set custom user agent to strip default browser identifiers
  mainWindow.webContents.setUserAgent(`MIJ-ERP-Desktop NativeApp/1.0`);

  // Remove default menu bar completely
  Menu.setApplicationMenu(null);

  // Target URL ERP Client Portal with Auto-Login Parameter
  const targetUrl = process.env.ERP_PORTAL_URL || 'http://localhost:4321/login?code=Abmalaya';
  mainWindow.loadURL(targetUrl);

  // Prevent navigation to external browser pages inside the app window
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.includes('localhost:4321') && !url.includes('202.155.94.144') && !url.includes('mijdigital.my')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const { ipcMain } = require('electron');
ipcMain.on('window-min', () => mainWindow?.minimize());
ipcMain.on('window-max', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
