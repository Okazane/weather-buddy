/**
 * WeatherBuddy Hardened Electron Preload Bridge (preload.cjs)
 * Exposes strictly allowlisted window controls via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_CORNERS = new Set(['BottomRight', 'TopRight', 'BottomLeft', 'TopLeft']);
const ALLOWED_SIZES = new Set(['Compact', 'Standard']);

contextBridge.exposeInMainWorld('weatherBuddyDesktop', {
  setAlwaysOnTop(flag) {
    ipcRenderer.send('weatherbuddy:set-always-on-top', Boolean(flag));
  },
  setSizeMode(sizeMode) {
    const clean = ALLOWED_SIZES.has(sizeMode) ? sizeMode : 'Standard';
    ipcRenderer.send('weatherbuddy:set-size-mode', clean);
  },
  snapCorner(corner) {
    const clean = ALLOWED_CORNERS.has(corner) ? corner : 'BottomRight';
    ipcRenderer.send('weatherbuddy:snap-corner', clean);
  },
});
