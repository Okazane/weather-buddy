/**
 * WeatherBuddy Hardened Electron Desktop Companion (electron-main.cjs)
 * Run via: npx electron desktop-widget/electron-main.cjs
 *
 * Security Hardening:
 * - contextIsolation: true
 * - nodeIntegration: false
 * - sandbox: true
 * - webSecurity: true
 * - Blocks all external navigation (will-navigate) and popups (setWindowOpenHandler)
 */

const path = require('path');
const { app, BrowserWindow, ipcMain, screen } = require('electron');

let mainWindow = null;

function computeCornerBounds(corner, sizeMode) {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const width = sizeMode === 'Compact' ? 300 : 380;
  const height = sizeMode === 'Compact' ? 420 : 540;
  const margin = 16;

  let x = workArea.x + workArea.width - width - margin;
  let y = workArea.y + workArea.height - height - margin;

  if (corner === 'TopRight') {
    y = workArea.y + margin;
  } else if (corner === 'BottomLeft') {
    x = workArea.x + margin;
  } else if (corner === 'TopLeft') {
    x = workArea.x + margin;
    y = workArea.y + margin;
  }

  return { x, y, width, height };
}

function createWidgetWindow() {
  const initialBounds = computeCornerBounds('BottomRight', 'Standard');

  mainWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    title: 'WeatherBuddy Desktop Widget',
    icon: path.join(__dirname, 'assets', 'weatherbuddy.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Block all external popup windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Block navigation away from local widget.html
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'widget.html'), {
    query: { mode: 'widget', corner: 'BottomRight', size: 'Standard' },
  });
}

ipcMain.on('weatherbuddy:set-always-on-top', (_event, flag) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(Boolean(flag), 'screen-saver');
  }
});

ipcMain.on('weatherbuddy:set-size-mode', (_event, sizeMode) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isCompact = sizeMode === 'Compact';
    mainWindow.setSize(isCompact ? 300 : 380, isCompact ? 420 : 540, true);
  }
});

ipcMain.on('weatherbuddy:snap-corner', (_event, corner) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [w] = mainWindow.getSize();
    const sizeMode = w <= 320 ? 'Compact' : 'Standard';
    const b = computeCornerBounds(corner, sizeMode);
    mainWindow.setPosition(b.x, b.y, true);
  }
});

app.whenReady().then(() => {
  createWidgetWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWidgetWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
