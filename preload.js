const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs seguras para o processo de renderização (frontend)
contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  initializeDirectory: (dirPath) => ipcRenderer.invoke('initialize-directory', dirPath),
  savePlaylist: (dirPath, channelName, playlistData) => ipcRenderer.invoke('save-playlist', { dirPath, channelName, playlistData }),
  getPlaylists: (dirPath) => ipcRenderer.invoke('get-playlists', dirPath),
  deletePlaylist: (dirPath, fileName) => ipcRenderer.invoke('delete-playlist', { dirPath, fileName }),
  savePlayerStatus: (dirPath, playerId, statusData) => ipcRenderer.invoke('save-player-status', { dirPath, playerId, statusData }),
  getAllPlayerStatuses: (dirPath) => ipcRenderer.invoke('get-all-player-statuses', dirPath),
  deletePlayerStatus: (dirPath, playerId) => ipcRenderer.invoke('delete-player-status', { dirPath, playerId }),
  copyMediaToShared: (sourcePath, dirPath) => ipcRenderer.invoke('copy-media-to-shared', { sourcePath, dirPath }),
  getMediaFiles: (dirPath) => ipcRenderer.invoke('get-media-files', dirPath),
  deleteMediaFile: (dirPath, filename) => ipcRenderer.invoke('delete-media-file', { dirPath, filename }),
  cacheMediaLocally: (dirPath, filename) => ipcRenderer.invoke('cache-media-locally', { dirPath, filename }),
  cleanLocalCache: (keepFilenames) => ipcRenderer.invoke('clean-local-cache', keepFilenames),
  getLocalCachePath: () => ipcRenderer.invoke('get-local-cache-path'),
  toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
  verifyCacheFiles: (filenames) => ipcRenderer.invoke('verify-cache-files', filenames),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings)
});
