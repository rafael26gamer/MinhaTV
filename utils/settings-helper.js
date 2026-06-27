const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { execSync } = require('child_process');

// Helper para obter o app do Electron apenas se disponível (evita erro nos testes em ambiente Node puro)
function getElectronApp() {
  try {
    return require('electron').app;
  } catch (e) {
    return null;
  }
}

/**
 * Retorna as configurações padrão do reprodutor.
 * @returns {object}
 */
function getDefaultSettings() {
  return {
    playerId: randomUUID(),
    playerName: 'Player TV',
    sharedDirPath: '',
    sintonizedChannel: '',
    showClock: false, // Desabilitado por padrão
    autoStart: true   // Habilitado por padrão
  };
}

/**
 * Carrega as configurações de forma persistente.
 * Se o arquivo não existir ou for inválido, inicializa com as configurações padrão.
 * @param {string} configPath 
 * @returns {Promise<object>}
 */
async function loadSettings(configPath) {
  try {
    const dir = path.dirname(configPath);
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    if (!fsSync.existsSync(configPath)) {
      const defaults = getDefaultSettings();
      await fs.writeFile(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
      console.log(`[Config] Arquivo criado com padrões em: ${configPath}`);
      return defaults;
    }

    const data = await fs.readFile(configPath, 'utf-8');
    let config;
    try {
      config = JSON.parse(data);
    } catch (e) {
      config = {};
    }

    // Garante que todas as chaves obrigatórias estejam presentes
    let updated = false;
    if (!config.playerId) {
      config.playerId = randomUUID();
      updated = true;
    }
    if (config.playerName === undefined) {
      config.playerName = 'Player TV';
      updated = true;
    }
    if (config.sharedDirPath === undefined) {
      config.sharedDirPath = '';
      updated = true;
    }
    if (config.sintonizedChannel === undefined) {
      config.sintonizedChannel = '';
      updated = true;
    }
    if (config.showClock === undefined) {
      config.showClock = false;
      updated = true;
    }
    if (config.autoStart === undefined) {
      config.autoStart = true;
      updated = true;
    }

    if (updated) {
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('[Config] Padrões ausentes preenchidos e salvos.');
    }

    return config;
  } catch (err) {
    console.error('[Config] Erro ao ler configurações, retornando padrões:', err);
    return getDefaultSettings();
  }
}

/**
 * Salva as configurações de forma atômica no arquivo JSON.
 * @param {string} configPath 
 * @param {object} settings 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function saveSettings(configPath, settings) {
  const tempPath = `${configPath}.tmp`;
  try {
    const dir = path.dirname(configPath);
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Assegura que o playerId original não foi perdido ou gera um novo
    if (!settings.playerId) {
      settings.playerId = randomUUID();
    }

    await fs.writeFile(tempPath, JSON.stringify(settings, null, 2), 'utf-8');
    await fs.rename(tempPath, configPath);
    console.log(`[Config] Configurações persistidas com sucesso em: ${configPath}`);
    return { success: true };
  } catch (err) {
    if (fsSync.existsSync(tempPath)) {
      try { await fs.unlink(tempPath); } catch (_) {}
    }
    console.error('[Config] Erro ao salvar configurações:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Aplica a inicialização automática com o sistema operacional.
 * @param {boolean} autoStart 
 * @param {boolean} isPlayerMode 
 * @returns {{success: boolean, error?: string}}
 */
function applyAutoStart(autoStart, isPlayerMode) {
  try {
    const app = getElectronApp();
    if (!app) {
      console.warn('[Autostart] Electron app não disponível. Ignorando configuração de autostart.');
      return { success: true };
    }
    
    // Para executáveis portáteis compilados, PORTABLE_EXECUTABLE_FILE aponta para o caminho real do arquivo .exe (estável)
    // ao invés da pasta temporária em AppData/Local/Temp/ que muda ou é apagada no reboot.
    const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    console.log(`[Autostart] Definindo caminho do autostart para: ${exePath}`);
    
    // app.setLoginItemSettings está disponível em Windows e macOS
    app.setLoginItemSettings({
      openAtLogin: autoStart,
      path: exePath,
      args: isPlayerMode ? ['--mode=player'] : []
    });
    console.log(`[Autostart] Configurado openAtLogin como: ${autoStart}`);
    return { success: true };
  } catch (err) {
    console.error('[Autostart] Erro ao aplicar autostart:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Remove entradas de inicialização automática do Registro do Windows.
 * Usado como fallback para garantir que executáveis portáteis não fiquem
 * registrados no startup do Windows (já que setLoginItemSettings pode
 * não funcionar 100% para builds portáteis).
 * 
 * A função primeiro consulta o registro (reg query) e depois deleta apenas
 * as entradas que contêm nomes relacionados ao MinhaTV, evitando chamadas
 * desnecessárias e engolimento silencioso de erros.
 * @returns {{success: boolean, error?: string}}
 */
function removeRegistryAutoStart() {
  if (process.platform !== 'win32') {
    return { success: true };
  }

  const regPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  const knownNames = ['minhatv', 'minhatv gerenciador', 'minhatv player'];
  
  try {
    // Primeiro consulta todas as entradas do Run key
    const queryOutput = execSync(
      `reg query "${regPath}"`,
      { stdio: 'pipe', timeout: 5000, encoding: 'utf-8' }
    );

    // Parse da saída do reg query para extrair os nomes das chaves
    // Formato: "    NOMEDACHAVE    REG_SZ    C:\caminho\do\exe.exe"
    const lines = queryOutput.split('\n');
    let removedCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Extrai o nome completo da chave (tudo antes do marcador REG_*, ex: REG_SZ)
      // A saída do reg query segue o formato:
      //   Nome do Valor    REG_SZ    C:\caminho\do\exe.exe
      const match = trimmed.match(/^(.+?)\s+REG_/);
      if (!match) continue;
      
      const valueName = match[1].trim().toLowerCase();
      
      // Verifica se o nome da entrada contém algum dos identificadores conhecidos
      const isMatch = knownNames.some(name => valueName.includes(name));
      
      if (isMatch) {
        const fullName = match[1].trim();
        try {
          execSync(
            `reg delete "${regPath}" /v "${fullName}" /f`,
            { stdio: 'pipe', timeout: 5000 }
          );
          console.log(`[Autostart] Registro removido do Windows: ${fullName}`);
          removedCount++;
        } catch (delErr) {
          console.error(`[Autostart] Erro ao remover entrada "${fullName}":`, delErr.message);
        }
      }
    }

    if (removedCount > 0) {
      console.log(`[Autostart] Total de ${removedCount} entrada(s) de autostart removida(s) do registro.`);
    } else {
      console.log('[Autostart] Nenhuma entrada de autostart do MinhaTV encontrada no registro.');
    }
  } catch (queryErr) {
    // reg query retorna erro se o caminho não existir (ex: chave Run não existe - improvável)
    console.log('[Autostart] Nenhuma entrada de autostart encontrada no registro (ou erro ao consultar).');
  }

  return { success: true };
}

/**
 * Migra as configurações do diretório antigo (suatv-player) para o novo (minhatv-player).
 * Executado uma única vez na primeira inicialização após a renomeação do projeto.
 * 
 * Se existir config.json em suatv-player/ mas não em minhatv-player/, copia o antigo.
 * Se ambos existirem, mantém o novo (não sobrescreve).
 * Após a migração, marca um arquivo de flag para não repetir o processo.
 * 
 * @param {string} oldConfigPath - Caminho do antigo config.json (suatv-player)
 * @param {string} newConfigPath - Caminho do novo config.json (minhatv-player)
 * @returns {Promise<{migrated: boolean, message: string}>}
 */
async function migrateConfig(oldConfigPath, newConfigPath) {
  const flagPath = path.join(path.dirname(newConfigPath), '.migrated-from-suatv');
  
  // Se já migrou antes, não repete
  if (fsSync.existsSync(flagPath)) {
    return { migrated: false, message: 'Migração já foi realizada anteriormente.' };
  }

  const oldExists = fsSync.existsSync(oldConfigPath);
  const newExists = fsSync.existsSync(newConfigPath);

  if (!oldExists) {
    // Não há config antigo para migrar — cria flag para não tentar de novo
    try {
      await fs.writeFile(flagPath, new Date().toISOString(), 'utf-8');
    } catch (_) {}
    return { migrated: false, message: 'Nenhuma configuração antiga encontrada para migrar.' };
  }

  if (newExists) {
    // Ambos existem — mantém o novo, apenas cria flag
    try {
      await fs.writeFile(flagPath, new Date().toISOString(), 'utf-8');
    } catch (_) {}
    return { migrated: false, message: 'Configuração nova já existe. Mantida a atual.' };
  }

  // Migra: copia o config antigo para o novo local
  try {
    const dir = path.dirname(newConfigPath);
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    const data = await fs.readFile(oldConfigPath, 'utf-8');
    await fs.writeFile(newConfigPath, data, 'utf-8');
    
    // Cria flag de migração concluída
    await fs.writeFile(flagPath, new Date().toISOString(), 'utf-8');
    
    console.log('[Migrate] Configurações migradas de suatv-player para minhatv-player com sucesso.');
    return { migrated: true, message: 'Configurações migradas com sucesso!' };
  } catch (err) {
    console.error('[Migrate] Erro ao migrar configurações:', err);
    return { migrated: false, message: `Erro na migração: ${err.message}` };
  }
}

module.exports = {
  loadSettings,
  saveSettings,
  applyAutoStart,
  removeRegistryAutoStart,
  migrateConfig
};
