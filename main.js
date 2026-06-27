const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fsSync = require('fs');
const { registerIpcHandlers } = require('./main/ipc-handlers');
const { loadSettings, applyAutoStart, removeRegistryAutoStart, migrateConfig } = require('./utils/settings-helper');

// Verifica o modo de inicialização (via flag --mode=player ou se o nome do executável contiver 'player')
const exeName = path.basename(process.execPath).toLowerCase();
const isPlayerMode = process.argv.includes('--mode=player') || exeName.includes('player');

let mainWindow = null;

// Caminho de Cache Local (ex: AppData/Roaming/minhatv-player/cache)
const localCacheDir = path.join(app.getPath('appData'), 'minhatv-player', 'cache');
const configPath = path.join(app.getPath('appData'), 'minhatv-player', 'config.json');

// Garante que a pasta de cache local exista no início
if (!fsSync.existsSync(localCacheDir)) {
  fsSync.mkdirSync(localCacheDir, { recursive: true });
}

function createWindow() {
  const windowOptions = {
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  if (isPlayerMode) {
    // Configuração para o modo Player (Kiosk / TV)
    windowOptions.width = 1920;
    windowOptions.height = 1080;
    windowOptions.fullscreen = true;
    windowOptions.kiosk = true;
    windowOptions.frame = false;
    windowOptions.alwaysOnTop = true;
    windowOptions.title = "MinhaTV - Player";
  } else {
    // Configuração para o modo Gerenciador (Dashboard)
    windowOptions.width = 1200;
    windowOptions.height = 800;
    windowOptions.frame = true;
    windowOptions.resizable = true;
    windowOptions.title = "MinhaTV - Gerenciador de Conteúdo";
  }

  mainWindow = new BrowserWindow(windowOptions);

  if (isPlayerMode) {
    mainWindow.loadFile(path.join(__dirname, 'src', 'player.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  }

  // Ocultar cursor no modo player após inatividade
  if (isPlayerMode) {
    mainWindow.webContents.on('dom-ready', () => {
      // Código injetado de forma segura se necessário, ou manipulado via CSS/JS no frontend
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Migra configurações do diretório antigo (suatv-player) para o novo (minhatv-player)
  const oldAppData = path.join(app.getPath('appData'), 'suatv-player');
  const oldConfigPath = path.join(oldAppData, 'config.json');
  await migrateConfig(oldConfigPath, configPath);

  // Carrega e inicializa as configurações persistentes
  const settings = await loadSettings(configPath);
  
  if (isPlayerMode) {
    // Modo Player: aplica autostart conforme configurado pelo usuário
    applyAutoStart(settings.autoStart, true);
  } else {
    // Modo Gerenciador: NUNCA inicia com o Windows
    // Usa setLoginItemSettings do Electron + limpeza direta do Registro do Windows
    // para garantir que builds portáteis não mantenham entradas residuais de autostart
    applyAutoStart(false, false);
    removeRegistryAutoStart();
  }

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

// ==========================================
// Handlers IPC (Inter-Process Communication)
// ==========================================

// Registra todos os handlers de IPC de forma modular e segura
registerIpcHandlers(ipcMain, dialog, localCacheDir, () => mainWindow, configPath, isPlayerMode);
