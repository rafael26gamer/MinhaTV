// ==========================================
// MinhaTV Player - Lógica do Frontend
// ==========================================

let playerId = '';
let playerName = 'Player TV';
let sharedDirPath = '';
let sintonizedChannel = ''; // canal_recepcao.json
let localCachePath = '';

let activePlaylist = [];
let playlistIndex = 0;
let currentLayer = 'a';
let playTimeout = null;
let activeVideoElement = null;

// Elementos do DOM
const playerContainer = document.getElementById('player-container');
const layerA = document.getElementById('layer-a');
const layerB = document.getElementById('layer-b');
const playerFallback = document.getElementById('player-fallback');
const fallbackClock = document.getElementById('fallback-clock');
const fallbackStatus = document.getElementById('fallback-status');
const widgetOverlay = document.getElementById('widget-overlay');
const widgetClock = document.getElementById('widget-clock');
const widgetDate = document.getElementById('widget-date');
const playerStatusBar = document.getElementById('player-status-bar');
const statusBarText = document.getElementById('status-bar-text');

// Painel de Configurações
const hiddenTrigger = document.getElementById('hidden-trigger');
const settingsPanel = document.getElementById('player-settings-panel');
const btnCloseSettings = document.getElementById('btn-close-settings');
const playerNameInput = document.getElementById('player-name-input');
const playerDirInput = document.getElementById('player-dir-input');
const btnBrowsePlayer = document.getElementById('btn-browse-player');
const playerChannelSelect = document.getElementById('player-channel-select');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnPlayerDevTools = document.getElementById('btn-player-devtools');

const statusConn = document.getElementById('status-conn');
const statusSyncTime = document.getElementById('status-sync-time');
const statusMode = document.getElementById('status-mode');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  // Carrega configurações salvas via IPC persistente
  const settings = await window.api.loadSettings();

  playerId = settings.playerId;
  playerName = settings.playerName;
  sharedDirPath = settings.sharedDirPath;
  sintonizedChannel = settings.sintonizedChannel;
  const showClock = settings.showClock;
  const autoStart = settings.autoStart;

  // Garante que o UUID persistido também esteja no localStorage caso o front precise
  localStorage.setItem('minhatv_player_uuid', playerId);

  playerNameInput.value = playerName;
  playerDirInput.value = sharedDirPath;

  // Busca o caminho da pasta de cache local
  localCachePath = await window.api.getLocalCachePath();

  // Inicia Relógio
  updateClock();
  setInterval(updateClock, 1000);

  // Configura visibilidade inicial do Relógio
  const chkShowClock = document.getElementById('chk-show-clock');
  if (chkShowClock) {
    chkShowClock.checked = showClock;
  }
  if (widgetOverlay) {
    widgetOverlay.style.display = showClock ? 'flex' : 'none';
  }

  // Configura visibilidade inicial do Autostart
  const chkAutoStart = document.getElementById('chk-autostart');
  if (chkAutoStart) {
    chkAutoStart.checked = autoStart;
  }

  // Configura Event Listeners da Configuração
  setupSettingsListeners();

  // Ocultar cursor se não houver movimento do mouse
  setupCursorAutohide();

  // Conecta e inicia loop de sincronização e exibição
  if (sharedDirPath) {
    statusConn.textContent = 'Conectando...';
    statusConn.style.color = 'var(--color-warning)';
    
    // Inicia heartbeat de forma imediata e paralela (não bloqueia a UI nem aguarda a cópia das mídias)
    startHeartbeatInterval();
    
    syncAndLoadChannels().then(() => {
      startSyncInterval();
    }).catch(err => {
      console.error('Erro na sincronização inicial:', err);
      startSyncInterval();
    });
  } else {
    // Exibe tela de configuração de cara se estiver sem pasta
    openSettings();
    showFallback('Aguardando configuração de diretório...');
  }
});

// UUID Generator simplificado (v4)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Atualização de Relógios e Data
function updateClock() {
  const now = new Date();
  
  // Relógio do Widget (HH:MM)
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  widgetClock.textContent = `${hours}:${minutes}`;
  fallbackClock.textContent = `${hours}:${minutes}:${seconds}`;

  // Data em Português
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  widgetDate.textContent = now.toLocaleDateString('pt-BR', options);
}

// Configurações do Painel
function setupSettingsListeners() {
  hiddenTrigger.addEventListener('click', () => {
    openSettings();
  });

  btnCloseSettings.addEventListener('click', () => {
    closeSettings();
  });

  btnBrowsePlayer.addEventListener('click', async () => {
    const path = await window.api.selectDirectory();
    if (path) {
      playerDirInput.value = path;
      await loadChannelsDropdown(path);
    }
  });

  btnSaveSettings.addEventListener('click', async () => {
    const newName = playerNameInput.value.trim() || 'Player TV';
    const newDir = playerDirInput.value.trim();
    const newChannel = playerChannelSelect.value;
    
    const chkShowClock = document.getElementById('chk-show-clock');
    const newShowClock = chkShowClock ? chkShowClock.checked : false;

    const chkAutoStart = document.getElementById('chk-autostart');
    const newAutoStart = chkAutoStart ? chkAutoStart.checked : true;

    const settings = {
      playerId,
      playerName: newName,
      sharedDirPath: newDir,
      sintonizedChannel: newChannel,
      showClock: newShowClock,
      autoStart: newAutoStart
    };

    const res = await window.api.saveSettings(settings);
    if (res.success) {
      // Salva no localStorage como compatibilidade rápida
      localStorage.setItem('minhatv_player_name', newName);
      localStorage.setItem('minhatv_player_shared_dir', newDir);
      localStorage.setItem('minhatv_player_channel', newChannel);
      localStorage.setItem('minhatv_player_show_clock', newShowClock);
      localStorage.setItem('minhatv_shared_dir', newDir);
      localStorage.setItem('minhatv_player_autostart', newAutoStart);

      closeSettings();
      showStatusBar('Configurações salvas! Reiniciando player...', 5000);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showStatusBar('Erro ao salvar configurações: ' + res.error, 5000);
    }
  });

  btnPlayerDevTools.addEventListener('click', () => {
    window.api.toggleDevTools();
  });
}

function openSettings() {
  settingsPanel.classList.add('open');
  playerContainer.classList.add('show-cursor');
  if (sharedDirPath) {
    loadChannelsDropdown(sharedDirPath);
  }
}

function closeSettings() {
  settingsPanel.classList.remove('open');
  playerContainer.classList.remove('show-cursor');
}

async function loadChannelsDropdown(dirPath) {
  playerChannelSelect.innerHTML = '<option value="">Carregando canais...</option>';
  playerChannelSelect.setAttribute('disabled', 'true');

  const res = await window.api.getPlaylists(dirPath);
  if (res.success) {
    playerChannelSelect.innerHTML = '';
    
    if (res.playlists.length === 0) {
      playerChannelSelect.innerHTML = '<option value="">Nenhum canal encontrado</option>';
      return;
    }

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Selecione um Canal --';
    playerChannelSelect.appendChild(defaultOpt);

    res.playlists.forEach(playlist => {
      const opt = document.createElement('option');
      opt.value = playlist.fileName;
      opt.textContent = playlist.channelName;
      if (playlist.fileName === sintonizedChannel) {
        opt.setAttribute('selected', 'true');
      }
      playerChannelSelect.appendChild(opt);
    });

    playerChannelSelect.removeAttribute('disabled');
    statusConn.textContent = 'Conectado';
    statusConn.style.color = 'var(--color-success)';
  } else {
    playerChannelSelect.innerHTML = '<option value="">Erro ao carregar canais</option>';
    statusConn.textContent = 'Erro';
    statusConn.style.color = 'var(--color-danger)';
  }
}

// Controle do Cursor de forma amigável
function setupCursorAutohide() {
  let timeout;
  document.addEventListener('mousemove', () => {
    // Se o painel de configurações estiver aberto, não oculta
    if (settingsPanel.classList.contains('open')) return;

    playerContainer.classList.add('show-cursor');
    playerContainer.style.cursor = 'default';
    
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (!settingsPanel.classList.contains('open')) {
        playerContainer.classList.remove('show-cursor');
        playerContainer.style.cursor = 'none';
      }
    }, 3000); // 3 segundos sem mover oculta cursor
  });
}

// Mostrar barra de status temporária
function showStatusBar(text, duration = 4000) {
  statusBarText.textContent = text;
  playerStatusBar.classList.add('visible');
  
  clearTimeout(playerStatusBar.timeout);
  playerStatusBar.timeout = setTimeout(() => {
    playerStatusBar.classList.remove('visible');
  }, duration);
}

// ==========================================
// Sincronização e Telemetria
// ==========================================
async function syncAndLoadChannels() {
  showStatusBar('Sincronizando canal...');
  
  if (!sharedDirPath) {
    statusConn.textContent = 'Sem pasta';
    statusConn.style.color = 'var(--color-danger)';
    return;
  }

  if (!sintonizedChannel) {
    statusConn.textContent = 'Sem canal';
    statusConn.style.color = 'var(--color-warning)';
    fallbackStatus.textContent = 'Canal não sintonizado. Abra as configurações para selecionar o canal.';
    showFallback('Nenhum canal sintonizado');
    return;
  }

  // 1. Tenta baixar a playlist do canal
  const playlistsRes = await window.api.getPlaylists(sharedDirPath);
  
  if (playlistsRes.success) {
    statusConn.textContent = 'Conectado';
    statusConn.style.color = 'var(--color-success)';
    statusMode.textContent = 'Online';

    const currentPlaylist = playlistsRes.playlists.find(p => p.fileName === sintonizedChannel);
    
    if (currentPlaylist) {
      // 2. Cacheia as mídias da playlist localmente
      showStatusBar(`Sincronizando ${currentPlaylist.items.length} mídias...`);
      
      const cachedItems = [];
      const filenames = currentPlaylist.items.map(i => i.filename);

      for (const item of currentPlaylist.items) {
        const cacheRes = await window.api.cacheMediaLocally(sharedDirPath, item.filename);
        if (cacheRes.success) {
          cachedItems.push({
            filename: item.filename,
            duration: item.duration,
            rules: item.rules || null, // Persiste as regras no cache
            localPath: cacheRes.localPath
          });
        } else {
          console.error(`Falha ao cachear mídia ${item.filename}:`, cacheRes.error);
        }
      }

      // 3. Limpa do cache local arquivos que não fazem mais parte desta playlist
      await window.api.cleanLocalCache(filenames);

      // 4. Salva a playlist atualizada no cache localStorage (resiliência offline)
      localStorage.setItem('minhatv_cached_playlist', JSON.stringify(cachedItems));
      statusSyncTime.textContent = new Date().toLocaleTimeString();

      // 5. Inicia o loop de exibição se houver itens válidos
      updatePlaylistLoop(cachedItems);
    } else {
      console.warn(`Playlist do canal ${sintonizedChannel} não foi encontrada.`);
      loadFromCachedFallback('Canal não encontrado na pasta compartilhada');
    }
  } else {
    // Falha na sincronização (Rede offline/pasta inacessível)
    console.warn('Falha ao acessar diretório compartilhado. Carregando do cache local...');
    loadFromCachedFallback('Modo Offline');
  }
}

// Carrega playlist antiga do localStorage em caso de queda de rede
async function loadFromCachedFallback(reason) {
  statusConn.textContent = 'Offline';
  statusConn.style.color = 'var(--color-danger)';
  statusMode.textContent = 'Cache';

  const cachedStr = localStorage.getItem('minhatv_cached_playlist');
  if (cachedStr) {
    try {
      const cachedItems = JSON.parse(cachedStr);
      const filenames = cachedItems.map(item => item.filename);
      
      // Valida se os arquivos do cache físico ainda existem no disco
      const verifyRes = await window.api.verifyCacheFiles(filenames);
      let activeItems = cachedItems;

      if (verifyRes && verifyRes.success) {
        const missing = verifyRes.missing || [];
        if (missing.length > 0) {
          console.warn(`[Offline Cache] Arquivos ausentes fisicamente: ${missing.join(', ')}`);
          // Filtra itens cujos arquivos não existem mais
          activeItems = cachedItems.filter(item => !missing.includes(item.filename));
          showStatusBar(`${reason} - ${missing.length} mídia(s) ausentes no cache local`, 6000);
        } else {
          showStatusBar(`${reason} - Carregado cache local (100% íntegro)`, 5000);
        }
      } else {
        showStatusBar(`${reason} - Carregado cache local (sem verificação física)`, 5000);
      }

      if (activeItems.length > 0) {
        updatePlaylistLoop(activeItems);
      } else {
        showFallback('Mídias em cache local estão fisicamente ausentes. Sem conteúdo para exibir.');
      }
    } catch (e) {
      console.error('[Offline Cache] Erro ao processar playlist em cache:', e);
      showFallback('Erro ao ler cache local de playlist');
    }
  } else {
    showFallback('Sem conexão e sem mídias em cache local');
  }
}

function updatePlaylistLoop(items) {
  // Compara se a nova playlist é diferente da atual
  const oldFilenames = activePlaylist.map(i => i.filename).join(',');
  const newFilenames = items.map(i => i.filename).join(',');

  if (oldFilenames === newFilenames && activePlaylist.length > 0) {
    // Sem alterações na playlist, mantém tocando normalmente
    return;
  }

  activePlaylist = items;
  playlistIndex = 0;
  
  if (activePlaylist.length > 0) {
    hideFallback();
    // Cancela o timeout atual para recomeçar o loop imediatamente
    if (playTimeout) {
      clearTimeout(playTimeout);
      playTimeout = null;
    }
    playNext();
  } else {
    showFallback('A playlist sintonizada está vazia.');
  }
}

function startSyncInterval() {
  // Sincroniza a cada 20 minutos (1.200.000 ms)
  setInterval(syncAndLoadChannels, 20 * 60 * 1000);
}

async function sendHeartbeat() {
  if (!sharedDirPath) return;

  const currentMedia = activePlaylist[playlistIndex - 1 >= 0 ? playlistIndex - 1 : activePlaylist.length - 1];
  const statusData = {
    playerId,
    playerName,
    channel: sintonizedChannel ? sintonizedChannel.replace('canal_', '').replace('.json', '') : 'Nenhum',
    currentMedia: currentMedia ? currentMedia.filename : 'Nenhuma',
    lastSeen: new Date().toISOString()
  };

  try {
    const res = await window.api.savePlayerStatus(sharedDirPath, playerId, statusData);
    if (res && res.success) {
      statusConn.textContent = 'Conectado';
      statusConn.style.color = 'var(--color-success)';
    } else {
      statusConn.textContent = 'Offline';
      statusConn.style.color = 'var(--color-danger)';
      console.warn('Erro ao salvar heartbeat:', res ? res.error : 'Sem resposta');
    }
  } catch (err) {
    statusConn.textContent = 'Offline';
    statusConn.style.color = 'var(--color-danger)';
    console.error('Falha de rede no heartbeat:', err);
  }
}

function startHeartbeatInterval() {
  // Envia batimento cardíaco imediatamente
  sendHeartbeat();
  // Envia a cada 60 segundos
  setInterval(sendHeartbeat, 60000);
}

// ==========================================
// Avaliação das Regras de Exibição Dinâmicas
// ==========================================
function isMediaActive(item, now = new Date()) {
  if (!item.rules) {
    return true; // Sem regras roda sempre
  }

  const { days, timeStart, timeEnd, endDate } = item.rules;

  // 1. Remoção Programada (Expiração)
  if (endDate) {
    if (now > new Date(endDate)) {
      return false; // Expirou
    }
  }

  // 2. Dias da Semana
  if (days && Array.isArray(days)) {
    const currentDay = now.getDay(); // 0 = Domingo, 1 = Segunda, ...
    if (!days.includes(currentDay)) {
      return false; // Fora do dia
    }
  }

  // 3. Intervalo de Horário (Horas e minutos)
  if (timeStart && timeEnd) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = timeStart.split(':').map(Number);
    const [endH, endM] = timeEnd.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Período no mesmo dia (ex: 08:00 às 18:00)
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return false;
      }
    } else {
      // Período que vira a noite (ex: 22:00 às 06:00)
      if (currentMinutes < startMinutes && currentMinutes > endMinutes) {
        return false;
      }
    }
  }

  return true;
}

// ==========================================
// Loop de Reprodução com Crossfade e Filtro de Regras
// ==========================================
function playNext() {
  if (activePlaylist.length === 0) {
    showFallback('A playlist está vazia.');
    return;
  }

  const now = new Date();
  let checkedCount = 0;
  let foundActive = false;
  let item = null;

  // Procura a próxima mídia ativa a partir de playlistIndex
  while (checkedCount < activePlaylist.length) {
    item = activePlaylist[playlistIndex];
    if (isMediaActive(item, now)) {
      foundActive = true;
      break;
    }
    playlistIndex = (playlistIndex + 1) % activePlaylist.length;
    checkedCount++;
  }

  if (!foundActive) {
    // Nenhuma mídia disponível para reproduzir no momento atual
    showFallback('Nenhum conteúdo programado para este horário.');
    
    // Agenda nova verificação em 10 segundos
    if (playTimeout) clearTimeout(playTimeout);
    playTimeout = setTimeout(() => {
      playNext();
    }, 10000);
    return;
  }

  // Oculta tela de fallback
  hideFallback();

  const isVideo = item.filename.toLowerCase().endsWith('.mp4');

  // Alterna o layer ativo para o crossfade
  const nextLayer = currentLayer === 'a' ? 'b' : 'a';
  const nextLayerEl = nextLayer === 'a' ? layerA : layerB;
  const currentLayerEl = currentLayer === 'a' ? layerA : layerB;

  // Limpa o layer destino
  nextLayerEl.innerHTML = '';

  // Formata o caminho para file:///
  const cleanPath = `file:///${item.localPath.replace(/\\/g, '/')}`;

  if (isVideo) {
    // Elemento de vídeo
    const video = document.createElement('video');
    video.src = cleanPath;
    video.autoplay = true;
    video.muted = true; // Mudo por padrão nas TVs comerciais
    video.style.cssText = 'width: 100%; height: 100%; object-fit: contain; background: #000;';
    
    // Adiciona listener para avançar quando o vídeo acabar
    video.addEventListener('ended', () => {
      advancePlaylist();
    });

    // Se falhar o carregamento do vídeo, pula para o próximo
    video.addEventListener('error', (e) => {
      console.error(`Erro ao reproduzir vídeo ${item.filename}:`, e);
      showStatusBar(`Falha no vídeo ${item.filename}, pulando...`, 3000);
      advancePlaylist();
    });

    nextLayerEl.appendChild(video);
    
    // Armazena elemento ativo para parar se necessário
    activeVideoElement = video;
    
    // Aguarda o primeiro frame estar pronto para evitar flashes pretos no crossfade
    video.addEventListener('canplay', () => {
      performCrossfade(nextLayerEl, currentLayerEl, nextLayer);
    });
  } else {
    // Elemento de imagem
    const img = document.createElement('img');
    img.src = cleanPath;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; background: #000;';

    img.onload = () => {
      performCrossfade(nextLayerEl, currentLayerEl, nextLayer);
      
      // Agenda próxima mídia com base na duração informada
      const durationMs = (item.duration || 10) * 1000;
      playTimeout = setTimeout(() => {
        advancePlaylist();
      }, durationMs);
    };

    img.onerror = (e) => {
      console.error(`Erro ao carregar imagem ${item.filename}:`, e);
      advancePlaylist();
    };

    nextLayerEl.appendChild(img);
  }
}

function performCrossfade(nextLayerEl, currentLayerEl, nextLayer) {
  // Traz o próximo layer para frente e dá opacidade
  nextLayerEl.classList.add('active');
  
  // Desativa o layer anterior (fade out)
  currentLayerEl.classList.remove('active');
  
  currentLayer = nextLayer;
}

function advancePlaylist() {
  if (playTimeout) {
    clearTimeout(playTimeout);
    playTimeout = null;
  }
  
  // Para qualquer vídeo tocando em segundo plano
  if (activeVideoElement) {
    activeVideoElement.pause();
    activeVideoElement = null;
  }

  playlistIndex = (playlistIndex + 1) % activePlaylist.length;
  playNext();
}

// Fallback Visual
function showFallback(message) {
  fallbackStatus.textContent = message;
  playerFallback.style.zIndex = '5';
  layerA.classList.remove('active');
  layerB.classList.remove('active');
}

function hideFallback() {
  playerFallback.style.zIndex = '0';
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
