// ==========================================
// MinhaTV Gerenciador - Lógica do Frontend
// ==========================================

let sharedDirPath = '';
let activeView = 'dashboard';
let dashboardInterval = null;
let currentPlaylistItems = []; // Itens sendo editados na playlist atual
let playlistsViewMediaFiles = []; // Mídias completas da biblioteca rápida
let activeChannelsPlaylists = []; // Canais completos

// Elementos do DOM - Setup Inicial
const setupModal = document.getElementById('setup-modal');
const setupDirInput = document.getElementById('setup-dir-input');
const btnBrowseSetup = document.getElementById('btn-browse-setup');
const btnConnectSetup = document.getElementById('btn-connect-setup');
const mainLayout = document.getElementById('main-layout');

// Elementos do DOM - Configurações
const settingsDirInput = document.getElementById('settings-dir-input');
const btnBrowseSettings = document.getElementById('btn-browse-settings');
const btnToggleDevTools = document.getElementById('btn-toggle-devtools');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Verifica se há pasta compartilhada salva no localStorage
  const savedDir = localStorage.getItem('minhatv_shared_dir');
  if (savedDir) {
    sharedDirPath = savedDir;
    setupDirInput.value = savedDir;
    btnConnectSetup.removeAttribute('disabled');
  }

  setupEventListeners();
});

// Configuração de Event Listeners Globais
function setupEventListeners() {
  // Setup Inicial
  btnBrowseSetup.addEventListener('click', async () => {
    const path = await window.api.selectDirectory();
    if (path) {
      setupDirInput.value = path;
      btnConnectSetup.removeAttribute('disabled');
    }
  });

  btnConnectSetup.addEventListener('click', async () => {
    const path = setupDirInput.value;
    if (!path) return;

    btnConnectSetup.setAttribute('disabled', 'true');
    btnConnectSetup.textContent = 'Inicializando...';

    const result = await window.api.initializeDirectory(path);
    if (result.success) {
      sharedDirPath = path;
      localStorage.setItem('minhatv_shared_dir', path);
      
      // Abre a tela principal
      setupModal.style.display = 'none';
      mainLayout.style.display = 'grid';
      
      initApp();
    } else {
      showToast('Erro ao inicializar pasta: ' + result.error, 'danger');
      btnConnectSetup.removeAttribute('disabled');
      btnConnectSetup.textContent = 'Conectar e Iniciar';
    }
  });

  // Alterar pasta nas configurações
  btnBrowseSettings.addEventListener('click', async () => {
    const path = await window.api.selectDirectory();
    if (path) {
      const result = await window.api.initializeDirectory(path);
      if (result.success) {
        sharedDirPath = path;
        localStorage.setItem('minhatv_shared_dir', path);
        settingsDirInput.value = path;
        showToast('Pasta compartilhada alterada com sucesso!', 'success');
        initApp();
      } else {
        showToast('Erro ao inicializar nova pasta: ' + result.error, 'danger');
      }
    }
  });

  btnToggleDevTools.addEventListener('click', () => {
    window.api.toggleDevTools();
  });

  // Navegação da Barra Lateral
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      // Remove classe active de todos
      menuItems.forEach(mi => mi.classList.remove('active'));
      // Adiciona active no clicado
      const clickedItem = e.currentTarget;
      clickedItem.classList.add('active');
      
      // Muda a view
      const viewName = clickedItem.getAttribute('data-view');
      switchView(viewName);
    });
  });

  // Upload de Mídia (Arrastar e Soltar Geral na biblioteca)
  const dropzone = document.getElementById('dropzone');
  const mediaFileInput = document.getElementById('media-file-input');
  const btnUploadBrowse = document.getElementById('btn-upload-browse');

  btnUploadBrowse.addEventListener('click', () => {
    mediaFileInput.click();
  });

  mediaFileInput.addEventListener('change', (e) => {
    handleFileUpload(e.target.files);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFileUpload(e.dataTransfer.files);
  });

  // Editor de Playlists
  document.getElementById('btn-clear-playlist').addEventListener('click', () => {
    currentPlaylistItems = [];
    renderTimeline();
  });

  document.getElementById('btn-save-playlist').addEventListener('click', savePlaylist);

  // Botão para criar novo canal (limpa formulário e timeline)
  document.getElementById('btn-new-channel').addEventListener('click', () => {
    currentPlaylistItems = [];
    document.getElementById('playlist-channel-name').value = '';
    document.getElementById('playlist-editor-title').textContent = 'Criar Novo Canal';
    renderTimeline();
    showToast('Pronto para criar um novo canal.', 'info');
  });

  // Configura a dropzone da Timeline (uma única vez)
  const timelineList = document.getElementById('timeline-list');
  if (timelineList) {
    timelineList.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    timelineList.addEventListener('drop', async (e) => {
      e.preventDefault();

      // Caso seja drag de arquivo externo (do OS)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleTimelineExternalDrop(e.dataTransfer.files);
        return;
      }

      // Caso seja drag interno (da biblioteca de mídias do app)
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data && data.filename) {
          addToPlaylist(data);
        }
      } catch (err) {}
    });
  }

  // Toggle pesquisa de mídias
  const btnToggleMediaSearch = document.getElementById('btn-toggle-media-search');
  const mediaSearchContainer = document.getElementById('media-search-container');
  const inputMediaSearch = document.getElementById('input-media-search');
  
  if (btnToggleMediaSearch && mediaSearchContainer && inputMediaSearch) {
    btnToggleMediaSearch.addEventListener('click', () => {
      mediaSearchContainer.classList.toggle('active');
      if (mediaSearchContainer.classList.contains('active')) {
        inputMediaSearch.focus();
      } else {
        inputMediaSearch.value = '';
        renderPlaylistsViewSelector();
      }
    });

    inputMediaSearch.addEventListener('input', (e) => {
      renderPlaylistsViewSelector(e.target.value);
    });
  }

  // Toggle pesquisa de canais
  const btnToggleChannelsSearch = document.getElementById('btn-toggle-channels-search');
  const channelsSearchContainer = document.getElementById('channels-search-container');
  const inputChannelsSearch = document.getElementById('input-channels-search');

  if (btnToggleChannelsSearch && channelsSearchContainer && inputChannelsSearch) {
    btnToggleChannelsSearch.addEventListener('click', () => {
      channelsSearchContainer.classList.toggle('active');
      if (channelsSearchContainer.classList.contains('active')) {
        inputChannelsSearch.focus();
      } else {
        inputChannelsSearch.value = '';
        renderActiveChannels();
      }
    });

    inputChannelsSearch.addEventListener('input', (e) => {
      renderActiveChannels(e.target.value);
    });
  }

  // Inicializa eventos específicos das novas modais
  setupRulesModal();
  setupPreviewModal();
}

// Inicializa componentes do App após conexão bem sucedida
function initApp() {
  settingsDirInput.value = sharedDirPath;
  switchView('dashboard');
}

// Alternar entre as telas (Views)
function switchView(viewName) {
  activeView = viewName;
  
  // Oculta todas as views
  const views = document.querySelectorAll('.content-view');
  views.forEach(v => v.style.display = 'none');
  
  // Mostra a view ativa
  const activeViewEl = document.getElementById(`view-${viewName}`);
  if (activeViewEl) {
    activeViewEl.style.display = 'block';
  }

  // Limpa loops/timers anteriores
  if (dashboardInterval) {
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }

  // Ações de entrada na view
  if (viewName === 'dashboard') {
    loadDashboard();
    // Refresh a cada 10 segundos
    dashboardInterval = setInterval(loadDashboard, 10000);
  } else if (viewName === 'media') {
    loadMediaLibrary();
  } else if (viewName === 'playlists') {
    loadPlaylistsView();
  } else if (viewName === 'monitor') {
    loadMonitorView();
  }
}

// ==========================================
// Lógica do Dashboard
// ==========================================
async function loadDashboard() {
  try {
    // 1. Totalizadores de Telas
    const statusRes = await window.api.getAllPlayerStatuses(sharedDirPath);
    let onlineCount = 0;
    let totalPlayers = 0;
    
    const playersTable = document.getElementById('dash-players-list');
    playersTable.innerHTML = '';

    if (statusRes.success && statusRes.statuses.length > 0) {
      totalPlayers = statusRes.statuses.length;
      
      statusRes.statuses.forEach(player => {
        const lastSeen = new Date(player.lastSeen);
        const diffMinutes = (new Date() - lastSeen) / 1000 / 60;
        const isOnline = diffMinutes < 2; // Online se atualizou nos últimos 2 min

        if (isOnline) onlineCount++;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color:#fff;">${escapeHtml(player.playerName)}</strong><br><span style="font-size:11px;color:var(--text-muted);">${player.playerId}</span></td>
          <td><span style="color:var(--text-secondary);">${escapeHtml(player.channel || 'Nenhum')}</span></td>
          <td><span style="color:var(--text-secondary); font-family: monospace;">${escapeHtml(player.currentMedia || 'Nenhuma')}</span></td>
          <td>
            <span class="status-badge ${isOnline ? 'online' : 'offline'}">
              <span class="status-dot ${isOnline ? 'pulse' : ''}"></span>
              ${isOnline ? 'Online' : 'Offline'}
            </span>
          </td>
          <td>
            <button class="btn-icon-danger" onclick="deletePlayer('${escapeHtml(player.playerId)}')">Excluir</button>
          </td>
        `;
        playersTable.appendChild(tr);
      });
    } else {
      playersTable.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 32px;">Nenhum player ativo detectado nesta pasta compartilhada.</td>
        </tr>
      `;
    }

    document.getElementById('dash-active-players').textContent = `${onlineCount} / ${totalPlayers}`;

    // 2. Totalizador de playlists (Canais)
    const playlistsRes = await window.api.getPlaylists(sharedDirPath);
    const playlistsCount = playlistsRes.success ? playlistsRes.playlists.length : 0;
    document.getElementById('dash-playlists-count').textContent = playlistsCount;

    // 3. Biblioteca e espaço ocupado
    const mediaRes = await window.api.getMediaFiles(sharedDirPath);
    let totalSize = 0;
    if (mediaRes.success) {
      mediaRes.files.forEach(f => totalSize += f.sizeBytes);
    }
    const sizeMb = (totalSize / 1024 / 1024).toFixed(1);
    document.getElementById('dash-disk-space').textContent = `${sizeMb} MB`;

  } catch (err) {
    console.error('Erro ao atualizar dashboard:', err);
  }
}

// ==========================================
// Biblioteca de Mídias
// ==========================================
async function loadMediaLibrary() {
  const mediaGrid = document.getElementById('media-grid');
  mediaGrid.innerHTML = '<div style="color: var(--text-secondary);">Carregando biblioteca...</div>';

  const result = await window.api.getMediaFiles(sharedDirPath);
  if (!result.success) {
    mediaGrid.innerHTML = `<div style="color: var(--color-danger);">Erro ao carregar mídias: ${result.error}</div>`;
    return;
  }

  mediaGrid.innerHTML = '';
  if (result.files.length === 0) {
    mediaGrid.innerHTML = '<div style="color: var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 40px 0;">Biblioteca vazia. Faça upload de imagens ou vídeos acima.</div>';
    return;
  }

  result.files.forEach(file => {
    const isVideo = file.filename.toLowerCase().endsWith('.mp4');
    const sizeMb = (file.sizeBytes / 1024 / 1024).toFixed(2);
    
    const card = document.createElement('div');
    card.className = 'media-card';
    card.setAttribute('draggable', 'true');
    
    // Configura drag start para arrastar para a playlist
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/json', JSON.stringify(file));
    });

    // Cria elemento de preview seguro
    let previewHtml = '';
    if (isVideo) {
      previewHtml = `
        <video class="media-preview" muted loop src="file:///${file.absolutePath.replace(/\\/g, '/')}#t=1" preload="metadata"></video>
        <span class="media-type-badge">Vídeo</span>
      `;
    } else {
      previewHtml = `
        <img class="media-preview" src="file:///${file.absolutePath.replace(/\\/g, '/')}">
        <span class="media-type-badge">Imagem</span>
      `;
    }

    card.innerHTML = `
      <div class="media-preview-container">
        ${previewHtml}
      </div>
      <div class="media-details">
        <div>
          <div class="media-name" title="${escapeHtml(file.filename)}">${escapeHtml(file.filename)}</div>
          <div class="media-meta">${sizeMb} MB</div>
        </div>
        <div class="media-actions" style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="previewMedia('${escapeHtml(file.filename)}', '${escapeHtml(file.absolutePath.replace(/\\/g, '/'))}')">Visualizar</button>
          <button class="btn-icon-danger" onclick="deleteMedia('${escapeHtml(file.filename)}')">Excluir</button>
        </div>
      </div>
    `;
    
    // Tenta dar play no preview do hover
    if (isVideo) {
      card.addEventListener('mouseenter', () => {
        const video = card.querySelector('video');
        if (video) video.play().catch(() => {});
      });
      card.addEventListener('mouseleave', () => {
        const video = card.querySelector('video');
        if (video) {
          video.pause();
          video.currentTime = 1;
        }
      });
    }

    mediaGrid.appendChild(card);
  });
}

function setDropzoneLoading(loading) {
  const dropzone = document.getElementById('dropzone');
  const btn = document.getElementById('btn-upload-browse');
  if (loading) {
    dropzone.classList.add('uploading');
    dropzone.style.pointerEvents = 'none';
    dropzone.style.opacity = '0.6';
    btn.setAttribute('disabled', 'true');
  } else {
    dropzone.classList.remove('uploading');
    dropzone.style.pointerEvents = 'auto';
    dropzone.style.opacity = '1';
    btn.removeAttribute('disabled');
  }
}

async function handleFileUpload(files) {
  if (!files || files.length === 0) return;
  
  setDropzoneLoading(true);
  let uploadedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.mp4', '.jpg', '.jpeg', '.png', '.webp'];

    if (!allowed.includes(extension)) {
      showToast(`Arquivo "${file.name}" não suportado. Formatos válidos: MP4, JPG, PNG, WebP.`, 'danger');
      errorCount++;
      continue;
    }

    showToast(`Copiando ${file.name}...`, 'info');
    const result = await window.api.copyMediaToShared(file.path, sharedDirPath);
    if (result.success) {
      uploadedCount++;
    } else {
      showToast(`Erro ao copiar ${file.name}: ${result.error}`, 'danger');
      errorCount++;
    }
  }

  setDropzoneLoading(false);

  if (uploadedCount > 0) {
    showToast(`${uploadedCount} arquivo(s) importado(s) com sucesso.`, 'success');
    loadMediaLibrary();
  }
}

window.deleteMedia = async function(filename) {
  if (!confirm(`Deseja realmente excluir a mídia "${filename}" da biblioteca? Mídias em uso continuarão nas playlists antigas mas podem falhar ao rodar se apagadas.`)) {
    return;
  }

  const result = await window.api.deleteMediaFile(sharedDirPath, filename);
  if (result.success) {
    showToast('Mídia excluída com sucesso.', 'success');
    loadMediaLibrary();
  } else {
    showToast('Erro ao excluir mídia: ' + result.error, 'danger');
  }
};

// ==========================================
// Playlists & Canais
// ==========================================
async function loadPlaylistsView() {
  // Limpa editor
  document.getElementById('playlist-channel-name').value = '';
  document.getElementById('playlist-editor-title').textContent = 'Criar Novo Canal';
  currentPlaylistItems = [];
  renderTimeline();

  // Reset de buscas
  const mediaSearchContainer = document.getElementById('media-search-container');
  const channelsSearchContainer = document.getElementById('channels-search-container');
  if (mediaSearchContainer) mediaSearchContainer.classList.remove('active');
  if (channelsSearchContainer) channelsSearchContainer.classList.remove('active');
  
  const inputMediaSearch = document.getElementById('input-media-search');
  const inputChannelsSearch = document.getElementById('input-channels-search');
  if (inputMediaSearch) inputMediaSearch.value = '';
  if (inputChannelsSearch) inputChannelsSearch.value = '';

  // Carrega seletor de mídias da biblioteca
  await loadPlaylistsViewSelector();

  // Carrega lista de Canais Ativos
  loadActiveChannels();
}

// Carrega de forma independente o seletor lateral de mídias (evita limpar a timeline)
async function loadPlaylistsViewSelector() {
  const mediaSelector = document.getElementById('playlist-media-selector');
  mediaSelector.innerHTML = '<div style="color: var(--text-secondary); padding: 12px;">Carregando biblioteca...</div>';

  const mediaRes = await window.api.getMediaFiles(sharedDirPath);
  if (mediaRes.success) {
    playlistsViewMediaFiles = mediaRes.files;
    
    // Mantém o filtro se houver algo digitado no campo de busca
    const inputMediaSearch = document.getElementById('input-media-search');
    const query = inputMediaSearch ? inputMediaSearch.value : '';
    renderPlaylistsViewSelector(query);
  } else {
    mediaSelector.innerHTML = `<div style="color: var(--color-danger);">Erro ao carregar mídias: ${mediaRes.error}</div>`;
  }
}

function renderPlaylistsViewSelector(filterQuery = '') {
  const mediaSelector = document.getElementById('playlist-media-selector');
  mediaSelector.innerHTML = '';

  const query = filterQuery.toLowerCase().trim();
  const filteredFiles = playlistsViewMediaFiles.filter(file => 
    file.filename.toLowerCase().includes(query)
  );

  if (filteredFiles.length === 0) {
    mediaSelector.innerHTML = '<div style="color: var(--text-secondary); padding: 12px; font-size: 13px;">Nenhuma mídia encontrada.</div>';
    return;
  }

  filteredFiles.forEach(file => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; user-select:none; transition: background 0.2s; border-radius:6px;';
    item.setAttribute('draggable', 'true');
    
    // Dragstart para arrastar para a timeline
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/json', JSON.stringify(file));
    });

    const isVideo = file.filename.toLowerCase().endsWith('.mp4');
    const mediaTag = isVideo ?
      `<video src="file:///${file.absolutePath.replace(/\\/g, '/')}#t=1" preload="metadata" muted style="width:40px; height:40px; border-radius:4px; object-fit:cover; background:#000;"></video>` :
      `<img src="file:///${file.absolutePath.replace(/\\/g, '/')}" style="width:40px; height:40px; border-radius:4px; object-fit:cover; background:#000;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 fill=%22%23222%22/><text x=%2220%22 y=%2224%22 fill=%22%23aaa%22 font-size=%2210%22 text-anchor=%22middle%22>Video</text></svg>'">`;

    item.innerHTML = `
      ${mediaTag}
      <div style="flex-grow:1; font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(file.filename)}</div>
      <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">+ Adicionar</button>
    `;
    
    item.addEventListener('click', (e) => {
      // Só adiciona se não foi clicado o botão especificamente (para não duplicar se disparar bolha)
      addToPlaylist(file);
    });

    mediaSelector.appendChild(item);
  });
}

// Manipulador de importação de arquivo arrastado do SO direto para a timeline
async function handleTimelineExternalDrop(files) {
  if (!files || files.length === 0) return;
  
  let addedCount = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.mp4', '.jpg', '.jpeg', '.png', '.webp'];

    if (!allowed.includes(extension)) {
      showToast(`Arquivo "${file.name}" não suportado. Formatos válidos: MP4, JPG, PNG, WebP.`, 'danger');
      continue;
    }

    showToast(`Importando ${file.name}...`, 'info');
    const result = await window.api.copyMediaToShared(file.path, sharedDirPath);
    if (result.success) {
      // Adiciona na playlist
      currentPlaylistItems.push({
        filename: result.filename,
        absolutePath: file.path, 
        duration: extension === '.mp4' ? 0 : 10,
        rules: null // Sem regras por padrão
      });
      addedCount++;
    } else {
      showToast(`Erro ao importar ${file.name}: ${result.error}`, 'danger');
    }
  }

  if (addedCount > 0) {
    showToast(`${addedCount} mídia(s) adicionada(s) à timeline!`, 'success');
    loadPlaylistsViewSelector(); // Atualiza a biblioteca lateral
    renderTimeline();
  }
}

function addToPlaylist(mediaFile) {
  const isVideo = mediaFile.filename.toLowerCase().endsWith('.mp4');
  currentPlaylistItems.push({
    filename: mediaFile.filename,
    absolutePath: mediaFile.absolutePath,
    duration: isVideo ? 0 : 10, // Vídeos usam o tempo padrão 0 (execução completa). Imagens padrão 10s.
    rules: null // Sem regra por padrão
  });
  renderTimeline();
}

function renderTimeline() {
  const timelineList = document.getElementById('timeline-list');
  timelineList.innerHTML = '';

  if (currentPlaylistItems.length === 0) {
    timelineList.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin: auto; padding: 24px;">Arraste ou clique nas mídias para montar a playlist.</div>';
    return;
  }

  currentPlaylistItems.forEach((item, index) => {
    const isVideo = item.filename.toLowerCase().endsWith('.mp4');
    
    // Constrói resumo visual das regras
    let rulesHtml = '';
    if (!item.rules) {
      rulesHtml = `
        <div class="rules-always-active-badge" style="cursor: pointer;" onclick="openRulesModal(${index})">
          <span>✓ Exibição Contínua (Sempre Ativo)</span>
        </div>
      `;
    } else {
      const { days, timeStart, timeEnd, endDate } = item.rules;
      let parts = [];
      if (days && days.length > 0) {
        const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const activeDays = days.map(d => dayLabels[d]).join(', ');
        parts.push(`Dias: ${activeDays}`);
      }
      if (timeStart && timeEnd) {
        parts.push(`Horário: ${timeStart} às ${timeEnd}`);
      }
      if (endDate) {
        const dateStr = new Date(endDate).toLocaleDateString('pt-BR') + ' ' + new Date(endDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        parts.push(`Remoção: ${dateStr}`);
      }
      
      const summaryText = parts.join(' • ') || 'Ativo sem restrições';
      rulesHtml = `
        <div class="rules-active-badge" style="cursor: pointer;" onclick="openRulesModal(${index})">
          <span>✓ Com Regras de Exibição</span>
        </div>
        <span class="rules-summary-text">${summaryText}</span>
      `;
    }

    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.setAttribute('draggable', 'true');
    
    const thumbElement = isVideo ?
      `<video class="timeline-thumb" src="file:///${item.absolutePath.replace(/\\/g, '/')}#t=1" preload="metadata" muted style="object-fit: cover;"></video>` :
      `<img class="timeline-thumb" src="file:///${item.absolutePath.replace(/\\/g, '/')}">`;

    div.innerHTML = `
      <div class="timeline-index">${index + 1}</div>
      ${thumbElement}
      <div class="timeline-info">
        <div class="timeline-title">${escapeHtml(item.filename)}</div>
        <div class="timeline-duration">
          ${isVideo ? 
            '<span>Tempo de duração: Automático (Vídeo Completo)</span>' : 
            `<span>Tempo: </span><input type="number" min="1" max="999" value="${item.duration}" class="duration-input" onchange="updateItemDuration(${index}, this.value)"><span> segs</span>`
          }
        </div>
        <div style="margin-top: 6px;">
          ${rulesHtml}
        </div>
      </div>
      <div style="display:flex; gap:6px; align-items: center;">
        <button class="btn btn-secondary" style="padding:6px; min-width:32px; height: 32px;" onclick="previewMedia('${escapeHtml(item.filename)}', '${escapeHtml(item.absolutePath.replace(/\\/g, '/'))}')" title="Visualizar Mídia">👁</button>
        <button class="btn btn-secondary" style="padding:6px; min-width:32px; height: 32px;" onclick="openRulesModal(${index})" title="Regras de Exibição">⚙</button>
        <button class="btn btn-secondary" style="padding:6px; min-width:32px; height: 32px;" onclick="movePlaylistItem(${index}, -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn btn-secondary" style="padding:6px; min-width:32px; height: 32px;" onclick="movePlaylistItem(${index}, 1)" ${index === currentPlaylistItems.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="btn-icon-danger" style="padding:6px 10px; height: 32px;" onclick="removeFromPlaylist(${index})">Remover</button>
      </div>
    `;
    
    // Drag and drop timeline item reordering
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
    });
    div.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    div.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(fromIndex) && fromIndex !== index) {
        const targetItem = currentPlaylistItems.splice(fromIndex, 1)[0];
        currentPlaylistItems.splice(index, 0, targetItem);
        renderTimeline();
      }
    });

    timelineList.appendChild(div);
  });
}

window.updateItemDuration = function(index, value) {
  const parsed = parseInt(value);
  if (parsed > 0) {
    currentPlaylistItems[index].duration = parsed;
  }
};

window.removeFromPlaylist = function(index) {
  currentPlaylistItems.splice(index, 1);
  renderTimeline();
};

window.movePlaylistItem = function(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex >= 0 && targetIndex < currentPlaylistItems.length) {
    const temp = currentPlaylistItems[index];
    currentPlaylistItems[index] = currentPlaylistItems[targetIndex];
    currentPlaylistItems[targetIndex] = temp;
    renderTimeline();
  }
};

// ==========================================
// Lógica do Modal de Regras (Samsung alarm style)
// ==========================================
let activeRulesItemIndex = null;

function setupRulesModal() {
  const rulesModal = document.getElementById('rules-modal');
  const btnCloseRules = document.getElementById('btn-close-rules-modal');
  const btnCancelRules = document.getElementById('btn-cancel-rules');
  const btnSaveRules = document.getElementById('btn-save-rules');
  const btnClearRules = document.getElementById('btn-clear-rules');
  const btnToggleAllDays = document.getElementById('btn-toggle-all-days');

  const chkRestrictHours = document.getElementById('chk-restrict-hours');
  const ruleTimeStart = document.getElementById('rule-time-start');
  const ruleTimeEnd = document.getElementById('rule-time-end');

  const chkRemoveScheduled = document.getElementById('chk-remove-scheduled');
  const ruleEndDate = document.getElementById('rule-end-date');

  const dayButtons = document.querySelectorAll('.day-btn');

  // Seleção individual de dias
  dayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // Habilitar todos/nenhum dia
  btnToggleAllDays.addEventListener('click', () => {
    const allActive = Array.from(dayButtons).every(b => b.classList.contains('active'));
    dayButtons.forEach(b => {
      if (allActive) {
        b.classList.remove('active');
      } else {
        b.classList.add('active');
      }
    });
  });

  // Habilitar/Desabilitar inputs de horário
  chkRestrictHours.addEventListener('change', () => {
    ruleTimeStart.disabled = !chkRestrictHours.checked;
    ruleTimeEnd.disabled = !chkRestrictHours.checked;
  });

  // Habilitar/Desabilitar data de remoção
  chkRemoveScheduled.addEventListener('change', () => {
    ruleEndDate.disabled = !chkRemoveScheduled.checked;
  });

  const closeRules = () => {
    rulesModal.style.display = 'none';
    activeRulesItemIndex = null;
  };

  btnCloseRules.addEventListener('click', closeRules);
  btnCancelRules.addEventListener('click', closeRules);

  // Limpa as regras do item atual de volta para "Sem Regra" (null)
  btnClearRules.addEventListener('click', () => {
    if (activeRulesItemIndex !== null) {
      currentPlaylistItems[activeRulesItemIndex].rules = null;
      renderTimeline();
      closeRules();
      showToast('Regras de exibição limpas. O item rodará continuamente.', 'success');
    }
  });

  // Salva as regras no item atual
  btnSaveRules.addEventListener('click', () => {
    if (activeRulesItemIndex === null) return;

    // Obtém dias ativos
    const days = [];
    dayButtons.forEach(btn => {
      if (btn.classList.contains('active')) {
        days.push(parseInt(btn.getAttribute('data-day')));
      }
    });

    let timeStart = null;
    let timeEnd = null;
    if (chkRestrictHours.checked) {
      timeStart = ruleTimeStart.value;
      timeEnd = ruleTimeEnd.value;
      if (!timeStart || !timeEnd) {
        showToast('Preencha os horários de início e término.', 'danger');
        return;
      }
    }

    let endDate = null;
    if (chkRemoveScheduled.checked) {
      endDate = ruleEndDate.value;
      if (!endDate) {
        showToast('Selecione uma data para a remoção programada.', 'danger');
        return;
      }
    }

    // Se tudo estiver limpo, salva como null
    if (days.length === 0 && !timeStart && !endDate) {
      currentPlaylistItems[activeRulesItemIndex].rules = null;
    } else {
      currentPlaylistItems[activeRulesItemIndex].rules = {
        days: days.length > 0 ? days : null,
        timeStart,
        timeEnd,
        endDate: endDate ? new Date(endDate).toISOString() : null
      };
    }

    renderTimeline();
    closeRules();
    showToast('Regras de exibição salvas com sucesso!', 'success');
  });
}

window.openRulesModal = function(index) {
  activeRulesItemIndex = index;
  const item = currentPlaylistItems[index];

  const rulesModal = document.getElementById('rules-modal');
  const title = document.getElementById('rules-modal-title');
  title.textContent = `Regras: ${item.filename}`;

  const chkRestrictHours = document.getElementById('chk-restrict-hours');
  const ruleTimeStart = document.getElementById('rule-time-start');
  const ruleTimeEnd = document.getElementById('rule-time-end');

  const chkRemoveScheduled = document.getElementById('chk-remove-scheduled');
  const ruleEndDate = document.getElementById('rule-end-date');

  const dayButtons = document.querySelectorAll('.day-btn');

  // Reseta todos os botões de dia
  dayButtons.forEach(btn => btn.classList.remove('active'));

  if (item.rules) {
    const { days, timeStart, timeEnd, endDate } = item.rules;

    // Carrega dias
    if (days && Array.isArray(days)) {
      dayButtons.forEach(btn => {
        const d = parseInt(btn.getAttribute('data-day'));
        if (days.includes(d)) {
          btn.classList.add('active');
        }
      });
    }

    // Carrega horários
    if (timeStart && timeEnd) {
      chkRestrictHours.checked = true;
      ruleTimeStart.value = timeStart;
      ruleTimeEnd.value = timeEnd;
      ruleTimeStart.disabled = false;
      ruleTimeEnd.disabled = false;
    } else {
      chkRestrictHours.checked = false;
      ruleTimeStart.value = '';
      ruleTimeEnd.value = '';
      ruleTimeStart.disabled = true;
      ruleTimeEnd.disabled = true;
    }

    // Carrega data de expiração
    if (endDate) {
      chkRemoveScheduled.checked = true;
      // datetime-local precisa do formato local YYYY-MM-DDTHH:MM
      const date = new Date(endDate);
      const tzOffset = date.getTimezoneOffset() * 60000;
      const localISODate = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
      ruleEndDate.value = localISODate;
      ruleEndDate.disabled = false;
    } else {
      chkRemoveScheduled.checked = false;
      ruleEndDate.value = '';
      ruleEndDate.disabled = true;
    }
  } else {
    // Por padrão desmarcado
    chkRestrictHours.checked = false;
    ruleTimeStart.value = '';
    ruleTimeEnd.value = '';
    ruleTimeStart.disabled = true;
    ruleTimeEnd.disabled = true;

    chkRemoveScheduled.checked = false;
    ruleEndDate.value = '';
    ruleEndDate.disabled = true;

    // Por conveniência, inicia marcando todos os dias se for configurar pela primeira vez
    dayButtons.forEach(btn => btn.classList.add('active'));
  }

  rulesModal.style.display = 'flex';
};

// ==========================================
// Lógica do Modal de Pré-visualização (Preview)
// ==========================================
function setupPreviewModal() {
  const modal = document.getElementById('preview-modal');
  const btnClose = document.getElementById('btn-close-preview-modal');

  const closePreview = () => {
    const content = document.getElementById('preview-modal-content');
    content.innerHTML = ''; // Para de rodar o vídeo se estiver tocando
    modal.style.display = 'none';
  };

  btnClose.addEventListener('click', closePreview);
  
  // Fecha clicando fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePreview();
    }
  });
}

window.previewMedia = function(filename, absolutePath) {
  const modal = document.getElementById('preview-modal');
  const title = document.getElementById('preview-modal-title');
  const content = document.getElementById('preview-modal-content');

  title.textContent = `Visualizar: ${filename}`;
  content.innerHTML = '';

  const isVideo = filename.toLowerCase().endsWith('.mp4');
  const cleanPath = `file:///${absolutePath.replace(/\\/g, '/')}`;

  if (isVideo) {
    const video = document.createElement('video');
    video.src = cleanPath;
    video.autoplay = true;
    video.controls = true;
    video.muted = false; // Permite áudio no preview para testar
    video.style.cssText = 'max-width: 100%; max-height: 450px; outline: none;';
    content.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = cleanPath;
    img.style.cssText = 'max-width: 100%; max-height: 450px; object-fit: contain;';
    content.appendChild(img);
  }

  modal.style.display = 'flex';
};

// ==========================================
// Salvar e Carregar Playlist do Backend
// ==========================================
async function savePlaylist() {
  const channelNameInput = document.getElementById('playlist-channel-name');
  const channelName = channelNameInput.value.trim();

  if (!channelName) {
    showToast('Por favor, informe o Nome do Canal.', 'danger');
    channelNameInput.focus();
    return;
  }

  // Valida se o nome contém apenas caracteres permitidos
  const isNameValid = /^[a-zA-Z0-9_-]+$/.test(channelName);
  if (!isNameValid) {
    showToast('Nome do canal inválido. Use apenas letras, números, traços (-) ou sublinhados (_). Sem espaços ou acentos.', 'danger');
    channelNameInput.focus();
    return;
  }

  if (currentPlaylistItems.length === 0) {
    showToast('A playlist deve conter pelo menos uma mídia.', 'danger');
    return;
  }

  const btnSave = document.getElementById('btn-save-playlist');
  const originalText = btnSave.textContent;
  btnSave.setAttribute('disabled', 'true');
  btnSave.textContent = 'Salvando...';

  // Higieniza o nome do canal (somente letras, números e traços/sublinhados)
  const sanitizedName = channelName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

  const playlistData = {
    channelName,
    items: currentPlaylistItems.map(item => ({
      filename: item.filename,
      duration: item.duration,
      rules: item.rules // Salva o objeto de regras
    })),
    updatedAt: new Date().toISOString()
  };

  showToast('Publicando playlist do canal...', 'info');
  
  const result = await window.api.savePlaylist(sharedDirPath, sanitizedName, playlistData);
  
  btnSave.removeAttribute('disabled');
  btnSave.textContent = originalText;

  if (result.success) {
    showToast(`Canal "${channelName}" publicado com sucesso!`, 'success');
    loadActiveChannels();
    loadDashboard();
  } else {
    showToast('Erro ao salvar playlist: ' + result.error, 'danger');
  }
}

async function loadActiveChannels() {
  const container = document.getElementById('active-channels-list');
  container.innerHTML = '<div style="color:var(--text-secondary); padding:8px;">Carregando...</div>';

  const res = await window.api.getPlaylists(sharedDirPath);
  if (res.success) {
    activeChannelsPlaylists = res.playlists;
    
    // Mantém o filtro se houver algo digitado no campo de busca
    const inputChannelsSearch = document.getElementById('input-channels-search');
    const query = inputChannelsSearch ? inputChannelsSearch.value : '';
    renderActiveChannels(query);
  } else {
    container.innerHTML = `<div style="color:var(--color-danger); padding:8px;">Erro ao carregar canais: ${res.error}</div>`;
  }
}

function renderActiveChannels(filterQuery = '') {
  const container = document.getElementById('active-channels-list');
  container.innerHTML = '';

  const query = filterQuery.toLowerCase().trim();
  const filteredPlaylists = activeChannelsPlaylists.filter(playlist => 
    playlist.channelName.toLowerCase().includes(query)
  );

  if (filteredPlaylists.length === 0) {
    container.innerHTML = '<div style="color:var(--text-secondary); padding:8px; font-size:12px;">Nenhum canal encontrado.</div>';
    return;
  }

  filteredPlaylists.forEach(playlist => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.03); font-size:13px;';
    div.innerHTML = `
      <div style="cursor:pointer; flex-grow:1;" onclick="editChannel('${escapeHtml(playlist.fileName)}')">
        <strong style="color:#fff;">${escapeHtml(playlist.channelName)}</strong><br>
        <span style="font-size:10px; color:var(--text-muted);">${playlist.items.length} mídias • Atualizado: ${new Date(playlist.updatedAt).toLocaleTimeString()}</span>
      </div>
      <button class="btn-icon-danger" onclick="deleteChannel('${escapeHtml(playlist.fileName)}')">Apagar</button>
    `;
    container.appendChild(div);
  });
}

window.editChannel = async function(fileName) {
  showToast('Carregando playlist para edição...', 'info');
  const res = await window.api.getPlaylists(sharedDirPath);
  if (res.success) {
    const playlist = res.playlists.find(p => p.fileName === fileName);
    if (playlist) {
      document.getElementById('playlist-channel-name').value = playlist.channelName;
      document.getElementById('playlist-editor-title').textContent = 'Editar Canal: ' + playlist.channelName;
      
      // Carrega os caminhos físicos a partir dos arquivos locais de mídias conhecidas
      const mediaRes = await window.api.getMediaFiles(sharedDirPath);
      const mediaList = mediaRes.success ? mediaRes.files : [];
      
      currentPlaylistItems = playlist.items.map(item => {
        const localMedia = mediaList.find(m => m.filename === item.filename);
        return {
          filename: item.filename,
          absolutePath: localMedia ? localMedia.absolutePath : '',
          duration: item.duration,
          rules: item.rules || null // Carrega as regras correspondentes
        };
      });

      renderTimeline();
      showToast('Playlist carregada com sucesso.', 'success');
    }
  }
};

window.deleteChannel = async function(fileName) {
  if (!confirm('Tem certeza que deseja apagar permanentemente este canal (playlist)? Os players que sintonizam nele mostrarão tela de erro/aguardo.')) {
    return;
  }

  const result = await window.api.deletePlaylist(sharedDirPath, fileName);
  if (result.success) {
    showToast('Canal removido com sucesso.', 'success');
    loadActiveChannels();
    loadDashboard();
    
    // Se a playlist apagada era a que estávamos editando, limpa o formulário
    currentPlaylistItems = [];
    document.getElementById('playlist-channel-name').value = '';
    document.getElementById('playlist-editor-title').textContent = 'Criar Novo Canal';
    renderTimeline();
  } else {
    showToast('Erro ao remover canal: ' + result.error, 'danger');
  }
};

// ==========================================
// Monitor de Telas
// ==========================================
async function loadMonitorView() {
  const container = document.getElementById('monitor-players-table');
  container.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 32px;">Carregando dados das telas...</td></tr>';

  const res = await window.api.getAllPlayerStatuses(sharedDirPath);
  if (res.success) {
    container.innerHTML = '';
    if (res.statuses.length === 0) {
      container.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 32px;">Nenhum player ativo cadastrado.</td></tr>';
      return;
    }

    res.statuses.forEach(player => {
      const lastSeen = new Date(player.lastSeen);
      const diffMinutes = (new Date() - lastSeen) / 1000 / 60;
      const isOnline = diffMinutes < 2;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:#fff;">${escapeHtml(player.playerName)}</strong></td>
        <td><span style="font-family: monospace; font-size:12px;">${player.playerId}</span></td>
        <td><span style="color:var(--text-secondary);">${escapeHtml(player.channel || 'Sem canal')}</span></td>
        <td><span style="color:var(--text-secondary); font-family: monospace; font-size:12px;">${escapeHtml(player.currentMedia || 'Nenhuma')}</span></td>
        <td><span style="color:var(--text-secondary);">${lastSeen.toLocaleDateString()} ${lastSeen.toLocaleTimeString()}</span></td>
        <td>
          <span class="status-badge ${isOnline ? 'online' : 'offline'}">
            <span class="status-dot ${isOnline ? 'pulse' : ''}"></span>
            ${isOnline ? 'Online' : 'Offline'}
          </span>
        </td>
        <td>
          <button class="btn-icon-danger" onclick="deletePlayer('${escapeHtml(player.playerId)}')">Excluir</button>
        </td>
      `;
      container.appendChild(tr);
    });
  } else {
    container.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger); padding: 32px;">Erro ao carregar monitor: ${res.error}</td></tr>`;
  }
}

// ==========================================
// Componentes Auxiliares (Toast, Escape)
// ==========================================
function showToast(message, type = 'info') {
  // Remove toast antigo se houver
  const oldToast = document.querySelector('.custom-toast');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.className = `custom-toast glass-panel`;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10000;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    border-radius: 8px;
    animation: setup-card-anim 0.3s ease;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  `;

  if (type === 'success') {
    toast.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    toast.style.background = 'rgba(16, 185, 129, 0.15)';
    toast.innerHTML = `<span style="color:var(--color-success); margin-right: 8px;">✓</span> ${escapeHtml(message)}`;
  } else if (type === 'danger') {
    toast.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    toast.style.background = 'rgba(239, 68, 68, 0.15)';
    toast.innerHTML = `<span style="color:var(--color-danger); margin-right: 8px;">✗</span> ${escapeHtml(message)}`;
  } else if (type === 'info') {
    toast.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    toast.style.background = 'rgba(59, 130, 246, 0.15)';
    toast.innerHTML = `<span style="color:var(--color-secondary); margin-right: 8px;">ℹ</span> ${escapeHtml(message)}`;
  } else {
    toast.innerHTML = escapeHtml(message);
  }

  document.body.appendChild(toast);

  // Auto-remove após 4 segundos
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
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

window.deletePlayer = async function(playerId) {
  if (!confirm(`Deseja realmente remover a tela com ID "${playerId}" do monitoramento? Se o player continuar online, ele reaparecerá automaticamente no próximo envio de heartbeat.`)) {
    return;
  }

  showToast('Removendo registro da tela...', 'info');
  const result = await window.api.deletePlayerStatus(sharedDirPath, playerId);
  if (result.success) {
    showToast('Tela removida com sucesso!', 'success');
    if (activeView === 'dashboard') {
      loadDashboard();
    } else if (activeView === 'monitor') {
      loadMonitorView();
    }
  } else {
    showToast('Erro ao remover tela: ' + result.error, 'danger');
  }
};
