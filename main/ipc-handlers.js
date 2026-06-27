const {
  initializeDirectory,
  savePlaylist,
  getPlaylists,
  deletePlaylist,
  savePlayerStatus,
  getAllPlayerStatuses,
  deletePlayerStatus,
  copyMediaToShared,
  getMediaFiles,
  deleteMediaFile,
  cacheMediaLocally,
  cleanLocalCache
} = require('../utils/file-helpers');
const { loadSettings, saveSettings, applyAutoStart } = require('../utils/settings-helper');

/**
 * Registra todos os handlers de IPC de forma modular e segura.
 * @param {object} ipcMain - Instância ipcMain do Electron
 * @param {object} dialog - Instância dialog do Electron
 * @param {string} localCacheDir - Pasta do cache local do Player
 * @param {string} configPath - Caminho para o arquivo config.json de configurações
 * @param {boolean} isPlayerMode - Se a janela está rodando em modo Player
 */
function registerIpcHandlers(ipcMain, dialog, localCacheDir, getMainWindow, configPath, isPlayerMode) {
  
  // 1. Abre diálogo nativo do Windows para selecionar a pasta compartilhada
  ipcMain.handle('select-directory', async () => {
    console.log('[IPC Audit] select-directory solicitado.');
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled) {
      console.log('[IPC Audit] select-directory cancelado pelo usuário.');
      return null;
    }
    console.log(`[IPC Audit] select-directory selecionou: ${result.filePaths[0]}`);
    return result.filePaths[0];
  });

  // 2. Inicializa a estrutura de diretórios na pasta compartilhada
  ipcMain.handle('initialize-directory', async (event, dirPath) => {
    console.log(`[IPC Audit] initialize-directory chamado para: ${dirPath}`);
    return await initializeDirectory(dirPath);
  });

  // 3. Salva a playlist de forma atômica e higienizada
  ipcMain.handle('save-playlist', async (event, { dirPath, channelName, playlistData }) => {
    console.log(`[IPC Audit] save-playlist iniciado para o canal: ${channelName}`);
    return await savePlaylist(dirPath, channelName, playlistData);
  });

  // 4. Lista todos os canais/playlists disponíveis
  ipcMain.handle('get-playlists', async (event, dirPath) => {
    console.log(`[IPC Audit] get-playlists listando playlists em: ${dirPath}`);
    return await getPlaylists(dirPath);
  });

  // 5. Deleta uma playlist
  ipcMain.handle('delete-playlist', async (event, { dirPath, fileName }) => {
    console.log(`[IPC Audit] delete-playlist solicitada para: ${fileName}`);
    return await deletePlaylist(dirPath, fileName);
  });

  // 6. Atualiza o status/heartbeat do player
  ipcMain.handle('save-player-status', async (event, { dirPath, playerId, statusData }) => {
    console.log(`[IPC Audit] save-player-status de: ${playerId}`);
    return await savePlayerStatus(dirPath, playerId, statusData);
  });

  // 7. Lista os status de todos os players cadastrados/ativos
  ipcMain.handle('get-all-player-statuses', async (event, dirPath) => {
    console.log(`[IPC Audit] get-all-player-statuses em: ${dirPath}`);
    return await getAllPlayerStatuses(dirPath);
  });

  // 7.1. Deleta o status de um player
  ipcMain.handle('delete-player-status', async (event, { dirPath, playerId }) => {
    console.log(`[IPC Audit] delete-player-status de: ${playerId}`);
    return await deletePlayerStatus(dirPath, playerId);
  });

  // 8. Copia arquivo de mídia local do administrador para a pasta compartilhada
  ipcMain.handle('copy-media-to-shared', async (event, { sourcePath, dirPath }) => {
    console.log(`[IPC Audit] copy-media-to-shared: de ${sourcePath} para ${dirPath}`);
    return await copyMediaToShared(sourcePath, dirPath);
  });

  // 8.1. Lista arquivos de mídia na pasta compartilhada
  ipcMain.handle('get-media-files', async (event, dirPath) => {
    console.log(`[IPC Audit] get-media-files em: ${dirPath}`);
    return await getMediaFiles(dirPath);
  });

  // 8.2. Deleta um arquivo de mídia na pasta compartilhada
  ipcMain.handle('delete-media-file', async (event, { dirPath, filename }) => {
    console.log(`[IPC Audit] delete-media-file: ${filename} em: ${dirPath}`);
    return await deleteMediaFile(dirPath, filename);
  });

  // 9. Sincroniza e cacheia arquivo de mídia do diretório compartilhado para o cache local do player
  ipcMain.handle('cache-media-locally', async (event, { dirPath, filename }) => {
    console.log(`[IPC Audit] cache-media-locally: obtendo ${filename}`);
    return await cacheMediaLocally(dirPath, filename, localCacheDir);
  });

  // 10. Limpa cache local de mídias não listadas na playlist atual
  ipcMain.handle('clean-local-cache', async (event, keepFilenames) => {
    console.log(`[IPC Audit] clean-local-cache. Mantendo arquivos: [${keepFilenames.join(', ')}]`);
    return await cleanLocalCache(localCacheDir, keepFilenames);
  });

  // 11. Retorna o caminho do cache local
  ipcMain.handle('get-local-cache-path', () => {
    console.log(`[IPC Audit] get-local-cache-path retornando: ${localCacheDir}`);
    return localCacheDir;
  });

  // 12. Abre ferramentas de desenvolvedor (para debug)
  ipcMain.handle('toggle-dev-tools', () => {
    console.log('[IPC Audit] toggle-dev-tools solicitado.');
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // 13. Verifica a integridade física de arquivos no cache local (evita reprodução offline de mídias ausentes)
  ipcMain.handle('verify-cache-files', async (event, filenames) => {
    console.log(`[IPC Audit] verify-cache-files solicitado para ${filenames.length} arquivos.`);
    const fsSync = require('fs');
    const path = require('path');
    const { sanitizeFilename } = require('../utils/file-helpers');
    
    try {
      const missing = [];
      for (const file of filenames) {
        const cleanName = sanitizeFilename(file);
        if (!cleanName) continue;
        const filePath = path.join(localCacheDir, cleanName);
        if (!fsSync.existsSync(filePath)) {
          missing.push(file);
        }
      }
      return { success: true, missing };
    } catch (err) {
      console.error(`[IPC Audit] verify-cache-files erro: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  // 14. Carrega as configurações persistentes
  ipcMain.handle('load-settings', async () => {
    console.log('[IPC Audit] load-settings solicitado.');
    return await loadSettings(configPath);
  });

  // 15. Salva as configurações persistentes e aplica inicialização automática
  ipcMain.handle('save-settings', async (event, settings) => {
    console.log('[IPC Audit] save-settings solicitado.');
    const result = await saveSettings(configPath, settings);
    if (result.success) {
      applyAutoStart(settings.autoStart, isPlayerMode);
    }
    return result;
  });
}

module.exports = {
  registerIpcHandlers
};
