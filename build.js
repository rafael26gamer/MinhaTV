const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Garante que o ambiente de download ignore erros de certificado SSL
try {
  // 1. Limpar pastas de build antigas
  console.log('\n--- 1. Limpando diretórios antigos ---');
  fs.rmSync('build-gerenciador', { recursive: true, force: true });
  fs.rmSync('build-player', { recursive: true, force: true });
  fs.rmSync('Exe portatil', { recursive: true, force: true });
  console.log('Diretórios limpos com sucesso.');

  // 2. Compilar Gerenciador
  console.log('\n--- 2. Compilando MinhaTV Gerenciador (Portable) ---');
  execSync('npx electron-builder --config electron-builder-gerenciador.json', { stdio: 'inherit' });

  // Copiar Gerenciador imediatamente
  console.log('\n--- 2.1 Movendo MinhaTV Gerenciador para "Exe portatil" ---');
  fs.mkdirSync('Exe portatil', { recursive: true });
  const gerenciadorSource = path.join('build-gerenciador', 'MinhaTV Gerenciador.exe');
  const gerenciadorDest = path.join('Exe portatil', 'MinhaTV Gerenciador.exe');
  if (fs.existsSync(gerenciadorSource)) {
    fs.copyFileSync(gerenciadorSource, gerenciadorDest);
    console.log(`Copiado: ${gerenciadorSource} -> ${gerenciadorDest}`);
    // Limpar diretório temporário do gerenciador
    fs.rmSync('build-gerenciador', { recursive: true, force: true });
    console.log('Pasta build-gerenciador limpa.');
  } else {
    throw new Error(`Arquivo não encontrado: ${gerenciadorSource}`);
  }

  // 3. Compilar Player
  console.log('\n--- 3. Compilando MinhaTV Player (Portable) ---');
  execSync('npx electron-builder --config electron-builder-player.json', { stdio: 'inherit' });

  // Copiar Player imediatamente
  console.log('\n--- 3.1 Movendo MinhaTV Player para "Exe portatil" ---');
  const playerSource = path.join('build-player', 'MinhaTV Player.exe');
  const playerDest = path.join('Exe portatil', 'MinhaTV Player.exe');
  if (fs.existsSync(playerSource)) {
    fs.copyFileSync(playerSource, playerDest);
    console.log(`Copiado: ${playerSource} -> ${playerDest}`);
    // Limpar diretório temporário do player
    fs.rmSync('build-player', { recursive: true, force: true });
    console.log('Pasta build-player limpa.');
  } else {
    throw new Error(`Arquivo não encontrado: ${playerSource}`);
  }

  console.log('\n======================================================');
  console.log(' COMPILAÇÃO CONCLUÍDA COM SUCESSO!');
  console.log(' Executáveis portáteis gerados na pasta "Exe portatil".');
  console.log('======================================================\n');
} catch (error) {
  console.error('\nErro durante o processo de compilação:', error.message);
  process.exit(1);
}
