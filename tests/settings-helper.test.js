const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { loadSettings, saveSettings } = require('../utils/settings-helper');

test('Testes de Configuração Persistente', async (t) => {
  let tempDir;
  let configPath;

  t.before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minhatv-settings-test-'));
    configPath = path.join(tempDir, 'config.json');
  });

  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  await t.test('Deve criar arquivo com valores padrão se não existir', async () => {
    const settings = await loadSettings(configPath);
    
    assert.strictEqual(fsSync.existsSync(configPath), true, 'Arquivo de configuração deve ter sido criado');
    assert.ok(settings.playerId, 'Deve possuir um playerId');
    assert.strictEqual(typeof settings.playerId, 'string');
    assert.strictEqual(settings.playerId.length, 36, 'UUID deve ter 36 caracteres');
    assert.strictEqual(settings.playerName, 'Player TV');
    assert.strictEqual(settings.showClock, false, 'Relógio deve vir desativado por padrão');
    assert.strictEqual(settings.autoStart, true, 'Autostart deve vir ativado por padrão');
  });

  await t.test('Deve preencher valores ausentes preservando os existentes', async () => {
    // Escreve arquivo incompleto
    const incomplete = {
      playerId: 'fixed-uuid-1234',
      playerName: 'Tela Recepcao'
    };
    await fs.writeFile(configPath, JSON.stringify(incomplete, null, 2), 'utf-8');

    const settings = await loadSettings(configPath);
    assert.strictEqual(settings.playerId, 'fixed-uuid-1234', 'Deve preservar playerId existente');
    assert.strictEqual(settings.playerName, 'Tela Recepcao', 'Deve preservar playerName existente');
    assert.strictEqual(settings.showClock, false, 'Deve preencher showClock padrão');
    assert.strictEqual(settings.autoStart, true, 'Deve preencher autoStart padrão');
  });

  await t.test('Deve salvar as configurações corretamente', async () => {
    const newSettings = {
      playerId: 'custom-uuid',
      playerName: 'Novo Nome',
      sharedDirPath: 'C:/some/shared/dir',
      sintonizedChannel: 'canal_principal.json',
      showClock: true,
      autoStart: false
    };

    const saveRes = await saveSettings(configPath, newSettings);
    assert.strictEqual(saveRes.success, true);

    const fileData = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(fileData);
    assert.deepStrictEqual(parsed, newSettings);
  });
});
