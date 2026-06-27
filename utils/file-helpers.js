const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

/**
 * Higieniza um nome de arquivo para remover qualquer tentativa de Path Traversal.
 * @param {string} filename 
 * @returns {string}
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return '';
  const base = path.basename(filename);
  // Remove qualquer separador de caminho adicional
  return base.replace(/[/\\]/g, '');
}

/**
 * Garante que o caminho de destino é seguro e pertence ao diretório base pretendido.
 * @param {string} baseDir - Diretório compartilhado ou pasta base
 * @param {string} subDir - Subpasta (ex: 'midias', 'playlists', 'status')
 * @param {string} filename - Nome do arquivo
 * @returns {string} - Caminho absoluto seguro
 */
function getSafePath(baseDir, subDir, filename) {
  if (!baseDir) {
    throw new Error('Diretório base não especificado.');
  }
  const sanitized = sanitizeFilename(filename);
  if (!sanitized || filename !== sanitized) {
    throw new Error('Acesso negado: Caminho de arquivo inseguro detectado.');
  }
  
  const resolvedBase = path.resolve(baseDir, subDir);
  const targetPath = path.resolve(resolvedBase, sanitized);
  
  // Verifica se o arquivo gerado realmente reside dentro da pasta de destino
  const relative = path.relative(resolvedBase, targetPath);
  const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  
  if (!isSafe) {
    throw new Error('Acesso negado: Caminho de arquivo inseguro detectado.');
  }
  
  return targetPath;
}

/**
 * Escreve um arquivo de forma atômica utilizando um arquivo temporário e renomeação.
 * @param {string} filePath - Caminho final do arquivo
 * @param {string} data - Conteúdo a ser escrito
 * @returns {Promise<void>}
 */
async function writeAtomic(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  try {
    // Garante a existência do diretório pai
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tempPath, data, 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // Limpeza de resíduos temporários se falhar
    if (fsSync.existsSync(tempPath)) {
      try { await fs.unlink(tempPath); } catch (_) {}
    }
    throw err;
  }
}

/**
 * Inicializa a estrutura de diretórios na pasta compartilhada.
 * @param {string} dirPath 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function initializeDirectory(dirPath) {
  try {
    const subfolders = ['playlists', 'midias', 'status'];
    for (const folder of subfolders) {
      const target = path.join(dirPath, folder);
      await fs.mkdir(target, { recursive: true });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Valida a estrutura de dados de uma playlist (canal).
 * @param {object} playlist - Dados do JSON da playlist
 * @returns {{valid: boolean, error?: string}}
 */
function validatePlaylist(playlist) {
  if (!playlist || typeof playlist !== 'object') {
    return { valid: false, error: 'A playlist deve ser um objeto válido.' };
  }
  if (!playlist.channelName || typeof playlist.channelName !== 'string') {
    return { valid: false, error: 'O nome do canal (channelName) é obrigatório e deve ser uma string.' };
  }
  if (!Array.isArray(playlist.items)) {
    return { valid: false, error: 'Os itens da playlist devem ser um array.' };
  }

  for (let i = 0; i < playlist.items.length; i++) {
    const item = playlist.items[i];
    if (!item.filename || typeof item.filename !== 'string') {
      return { valid: false, error: `Item no índice ${i} está sem nome de arquivo (filename).` };
    }
    if (typeof item.duration !== 'number' || item.duration < 0) {
      return { valid: false, error: `Item no índice ${i} (${item.filename}) possui duração inválida.` };
    }

    // Validação das novas regras de exibição (rules)
    if (item.rules !== undefined && item.rules !== null) {
      if (typeof item.rules !== 'object') {
        return { valid: false, error: `Item no índice ${i} (${item.filename}) possui 'rules' inválido (deve ser um objeto).` };
      }

      const { days, timeStart, timeEnd, endDate } = item.rules;

      if (days !== undefined && days !== null) {
        if (!Array.isArray(days)) {
          return { valid: false, error: `Item no índice ${i} (${item.filename}) possui dias da semana (days) em formato incorreto (deve ser array).` };
        }
        for (let d = 0; d < days.length; d++) {
          const day = days[d];
          if (typeof day !== 'number' || day < 0 || day > 6) {
            return { valid: false, error: `Item no índice ${i} (${item.filename}) possui dia da semana inválido: ${day} (deve ser de 0 a 6).` };
          }
        }
      }

      const timeRegex = /^\d{2}:\d{2}$/;
      if (timeStart !== undefined && timeStart !== null && timeStart !== '') {
        if (typeof timeStart !== 'string' || !timeRegex.test(timeStart)) {
          return { valid: false, error: `Item no índice ${i} (${item.filename}) possui horário de início inválido (formato esperado HH:MM).` };
        }
      }

      if (timeEnd !== undefined && timeEnd !== null && timeEnd !== '') {
        if (typeof timeEnd !== 'string' || !timeRegex.test(timeEnd)) {
          return { valid: false, error: `Item no índice ${i} (${item.filename}) possui horário de término inválido (formato esperado HH:MM).` };
        }
      }

      if (endDate !== undefined && endDate !== null && endDate !== '') {
        if (typeof endDate !== 'string' || isNaN(Date.parse(endDate))) {
          return { valid: false, error: `Item no índice ${i} (${item.filename}) possui data de remoção inválida.` };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Verifica se a extensão da mídia é compatível com o player.
 * @param {string} filename - Nome do arquivo de mídia
 * @returns {boolean}
 */
function validateMediaExtension(filename) {
  if (!filename || typeof filename !== 'string') return false;
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  const allowed = ['.mp4', '.jpg', '.jpeg', '.png', '.webp'];
  return allowed.includes(ext);
}

/**
 * Salva a playlist de forma atômica e segura.
 * @param {string} dirPath 
 * @param {string} channelName 
 * @param {object} playlistData 
 * @returns {Promise<{success: boolean, fileName?: string, error?: string}>}
 */
async function savePlaylist(dirPath, channelName, playlistData) {
  try {
    const validation = validatePlaylist(playlistData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Higieniza o canal para o nome do arquivo
    const safeChannel = channelName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const fileName = `canal_${safeChannel}.json`;
    
    const targetPath = getSafePath(dirPath, 'playlists', fileName);
    await writeAtomic(targetPath, JSON.stringify(playlistData, null, 2));
    
    return { success: true, fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retorna todas as playlists do diretório compartilhado.
 * @param {string} dirPath 
 * @returns {Promise<{success: boolean, playlists?: Array<object>, error?: string}>}
 */
async function getPlaylists(dirPath) {
  try {
    const targetDir = path.join(dirPath, 'playlists');
    await fs.mkdir(targetDir, { recursive: true });
    const files = await fs.readdir(targetDir);
    const playlists = [];

    for (const file of files) {
      if (file.startsWith('canal_') && file.endsWith('.json')) {
        const filePath = getSafePath(dirPath, 'playlists', file);
        const dataStr = await fs.readFile(filePath, 'utf-8');
        try {
          const content = JSON.parse(dataStr);
          playlists.push({
            fileName: file,
            channelName: content.channelName || file.replace('canal_', '').replace('.json', ''),
            items: content.items || [],
            updatedAt: content.updatedAt || new Date().toISOString()
          });
        } catch (e) {
          console.error(`Erro ao parsear arquivo de playlist ${file}:`, e);
        }
      }
    }
    return { success: true, playlists };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Remove uma playlist.
 * @param {string} dirPath 
 * @param {string} fileName 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deletePlaylist(dirPath, fileName) {
  try {
    // Validação estrita de Path Traversal
    if (!fileName.startsWith('canal_') || !fileName.endsWith('.json')) {
      throw new Error('Nome de playlist inválido.');
    }
    const filePath = getSafePath(dirPath, 'playlists', fileName);
    await fs.unlink(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Salva status do player no diretório compartilhado.
 * @param {string} dirPath 
 * @param {string} playerId 
 * @param {object} statusData 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function savePlayerStatus(dirPath, playerId, statusData) {
  try {
    const fileName = `player_${playerId}.json`;
    const targetPath = getSafePath(dirPath, 'status', fileName);
    await writeAtomic(targetPath, JSON.stringify(statusData, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Obtém todos os status de players.
 * @param {string} dirPath 
 * @returns {Promise<{success: boolean, statuses?: Array<object>, error?: string}>}
 */
async function getAllPlayerStatuses(dirPath) {
  try {
    const targetDir = path.join(dirPath, 'status');
    await fs.mkdir(targetDir, { recursive: true });
    const files = await fs.readdir(targetDir);
    const statuses = [];

    for (const file of files) {
      if (file.startsWith('player_') && file.endsWith('.json')) {
        const filePath = getSafePath(dirPath, 'status', file);
        const dataStr = await fs.readFile(filePath, 'utf-8');
        try {
          const content = JSON.parse(dataStr);
          statuses.push(content);
        } catch (e) {
          console.error(`Erro ao parsear status de player ${file}:`, e);
        }
      }
    }
    return { success: true, statuses };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Remove o status de um player.
 * @param {string} dirPath 
 * @param {string} playerId 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deletePlayerStatus(dirPath, playerId) {
  try {
    const fileName = `player_${playerId}.json`;
    const filePath = getSafePath(dirPath, 'status', fileName);
    await fs.unlink(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Copia mídia local para a pasta compartilhada.
 * @param {string} sourcePath 
 * @param {string} dirPath 
 * @returns {Promise<{success: boolean, filename?: string, sizeBytes?: number, error?: string}>}
 */
async function copyMediaToShared(sourcePath, dirPath) {
  try {
    const filename = path.basename(sourcePath);
    if (!validateMediaExtension(filename)) {
      throw new Error('Formato de arquivo não suportado.');
    }
    const destPath = getSafePath(dirPath, 'midias', filename);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(sourcePath, destPath);
    const stat = await fs.stat(destPath);
    return { success: true, filename, sizeBytes: stat.size };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Lista mídias na pasta compartilhada.
 * @param {string} dirPath 
 * @returns {Promise<{success: boolean, files?: Array<object>, error?: string}>}
 */
async function getMediaFiles(dirPath) {
  try {
    const destDir = path.join(dirPath, 'midias');
    await fs.mkdir(destDir, { recursive: true });
    const files = await fs.readdir(destDir);
    const mediaFiles = [];

    for (const file of files) {
      if (validateMediaExtension(file)) {
        const filePath = getSafePath(dirPath, 'midias', file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          mediaFiles.push({
            filename: file,
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
            absolutePath: filePath
          });
        }
      }
    }
    return { success: true, files: mediaFiles };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Remove arquivo de mídia do diretório compartilhado.
 * @param {string} dirPath 
 * @param {string} filename 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteMediaFile(dirPath, filename) {
  try {
    if (!validateMediaExtension(filename)) {
      throw new Error('Arquivo inválido ou extensão não suportada.');
    }
    const filePath = getSafePath(dirPath, 'midias', filename);
    await fs.unlink(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Copia arquivo de mídia da pasta compartilhada para o cache local do player.
 * @param {string} dirPath 
 * @param {string} filename 
 * @param {string} localCacheDir 
 * @returns {Promise<{success: boolean, localPath?: string, cached?: boolean, error?: string}>}
 */
async function cacheMediaLocally(dirPath, filename, localCacheDir) {
  try {
    if (!validateMediaExtension(filename)) {
      throw new Error('Arquivo inválido ou extensão não suportada.');
    }
    const sharedPath = getSafePath(dirPath, 'midias', filename);
    const localPath = path.join(localCacheDir, sanitizeFilename(filename));

    // Se já estiver no cache, não duplica
    if (fsSync.existsSync(localPath)) {
      return { success: true, localPath, cached: true };
    }

    await fs.mkdir(localCacheDir, { recursive: true });
    await fs.copyFile(sharedPath, localPath);
    return { success: true, localPath, cached: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Limpa o cache local removendo arquivos que não fazem parte da playlist atual.
 * @param {string} localCacheDir 
 * @param {Array<string>} keepFilenames 
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
async function cleanLocalCache(localCacheDir, keepFilenames) {
  try {
    const sanitizedKeep = keepFilenames.map(sanitizeFilename);
    await fs.mkdir(localCacheDir, { recursive: true });
    const files = await fs.readdir(localCacheDir);
    let deletedCount = 0;
    
    for (const file of files) {
      if (!sanitizedKeep.includes(file)) {
        await fs.unlink(path.join(localCacheDir, file));
        deletedCount++;
      }
    }
    return { success: true, deletedCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  sanitizeFilename,
  getSafePath,
  writeAtomic,
  initializeDirectory,
  validatePlaylist,
  validateMediaExtension,
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
};
