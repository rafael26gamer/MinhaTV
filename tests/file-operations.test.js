const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const {
  writeAtomic,
  sanitizeFilename,
  getSafePath,
  initializeDirectory,
  cleanLocalCache,
  savePlayerStatus,
  deletePlayerStatus
} = require('../utils/file-helpers');

test('Testes de Operações de Arquivo e Segurança', async (t) => {
  let tempDir;

  t.before(async () => {
    // Cria um diretório temporário para os testes
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minhatv-test-'));
  });

  t.after(async () => {
    // Limpa o diretório temporário
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  await t.test('Deve criar o diretório e escrever o arquivo JSON de forma atômica', async () => {
    const targetFile = path.join(tempDir, 'subfolder', 'test_atomic.json');
    const testData = { success: true, message: 'Atomic Write Works!' };
    
    await writeAtomic(targetFile, JSON.stringify(testData, null, 2));

    // Verifica se o arquivo final existe
    const exists = await fs.stat(targetFile).then(s => s.isFile()).catch(() => false);
    assert.strictEqual(exists, true);

    // Lê o conteúdo e valida
    const fileContent = await fs.readFile(targetFile, 'utf-8');
    const parsed = JSON.parse(fileContent);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.message, 'Atomic Write Works!');
  });

  await t.test('Deve higienizar nomes de arquivos contra Path Traversal', () => {
    assert.strictEqual(sanitizeFilename('normal.mp4'), 'normal.mp4');
    assert.strictEqual(sanitizeFilename('../../root.mp4'), 'root.mp4');
    assert.strictEqual(sanitizeFilename('sub/folder/file.jpg'), 'file.jpg');
    assert.strictEqual(sanitizeFilename('..\\..\\windows\\system.ini'), 'system.ini');
  });

  await t.test('Deve validar caminhos seguros e rejeitar Path Traversal', () => {
    // Caso de caminho seguro
    const safePath = getSafePath(tempDir, 'midias', 'promo.mp4');
    assert.ok(safePath.includes('midias'));
    assert.ok(safePath.endsWith('promo.mp4'));

    // Caso de tentativa de Path Traversal (deve jogar erro)
    assert.throws(() => {
      getSafePath(tempDir, 'midias', '../../README.md');
    }, /Acesso negado: Caminho de arquivo inseguro detectado/);

    assert.throws(() => {
      getSafePath(tempDir, 'midias', '..\\..\\main.js');
    }, /Acesso negado: Caminho de arquivo inseguro detectado/);
  });

  await t.test('Deve inicializar a estrutura de diretórios do canal', async () => {
    const sharedDir = path.join(tempDir, 'shared_folder');
    const result = await initializeDirectory(sharedDir);
    assert.strictEqual(result.success, true);

    const subfolders = ['playlists', 'midias', 'status'];
    for (const folder of subfolders) {
      const folderPath = path.join(sharedDir, folder);
      const exists = await fs.stat(folderPath).then(s => s.isDirectory()).catch(() => false);
      assert.strictEqual(exists, true);
    }
  });

  await t.test('Deve limpar o cache local mantendo apenas mídias listadas', async () => {
    const cacheDir = path.join(tempDir, 'local_cache');
    await fs.mkdir(cacheDir, { recursive: true });

    // Cria arquivos mockados no cache
    await fs.writeFile(path.join(cacheDir, 'file1.mp4'), 'mock video 1');
    await fs.writeFile(path.join(cacheDir, 'file2.jpg'), 'mock image 2');
    await fs.writeFile(path.join(cacheDir, 'file3.png'), 'mock image 3');

    // Executa a limpeza mantendo file1.mp4 e file3.png (file2.jpg deve ser deletado)
    const result = await cleanLocalCache(cacheDir, ['file1.mp4', 'file3.png']);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deletedCount, 1);

    const file1Exists = fsSync.existsSync(path.join(cacheDir, 'file1.mp4'));
    const file2Exists = fsSync.existsSync(path.join(cacheDir, 'file2.jpg'));
    const file3Exists = fsSync.existsSync(path.join(cacheDir, 'file3.png'));

    assert.strictEqual(file1Exists, true, 'file1.mp4 deve ser mantido');
    assert.strictEqual(file2Exists, false, 'file2.jpg deve ser deletado');
    assert.strictEqual(file3Exists, true, 'file3.png deve ser mantido');
  });

  await t.test('Deve deletar o arquivo de status do player de forma segura', async () => {
    const sharedDir = path.join(tempDir, 'shared_player_test');
    await initializeDirectory(sharedDir);

    const playerId = 'test-player-123';
    const statusData = { playerId, playerName: 'Test Player', channel: 'Recepcao' };
    
    // Salva o status
    const saveRes = await savePlayerStatus(sharedDir, playerId, statusData);
    assert.strictEqual(saveRes.success, true);
    
    // Verifica se o arquivo existe
    const statusFilePath = path.join(sharedDir, 'status', `player_${playerId}.json`);
    assert.strictEqual(fsSync.existsSync(statusFilePath), true);

    // Deleta o status
    const deleteRes = await deletePlayerStatus(sharedDir, playerId);
    assert.strictEqual(deleteRes.success, true);
    
    // Verifica se foi removido
    assert.strictEqual(fsSync.existsSync(statusFilePath), false);

    // Tentativa com path traversal (deve falhar)
    const badId = '../../some_file';
    const traversalRes = await deletePlayerStatus(sharedDir, badId);
    assert.strictEqual(traversalRes.success, false);
    assert.ok(traversalRes.error.includes('Acesso negado') || traversalRes.error.includes('Caminho de arquivo inseguro'));
  });
});
