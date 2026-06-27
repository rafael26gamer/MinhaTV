const test = require('node:test');
const assert = require('node:assert');
const { validatePlaylist, validateMediaExtension } = require('../utils/file-helpers');

test('Validação de Extensões de Mídia', async (t) => {
  await t.test('Deve permitir formatos compatíveis', () => {
    assert.strictEqual(validateMediaExtension('video.mp4'), true);
    assert.strictEqual(validateMediaExtension('imagem.jpg'), true);
    assert.strictEqual(validateMediaExtension('imagem.jpeg'), true);
    assert.strictEqual(validateMediaExtension('imagem.png'), true);
    assert.strictEqual(validateMediaExtension('imagem.webp'), true);
  });

  await t.test('Deve recusar formatos não compatíveis', () => {
    assert.strictEqual(validateMediaExtension('video.avi'), false);
    assert.strictEqual(validateMediaExtension('video.mkv'), false);
    assert.strictEqual(validateMediaExtension('audio.mp3'), false);
    assert.strictEqual(validateMediaExtension('documento.pdf'), false);
    assert.strictEqual(validateMediaExtension(null), false);
  });
});

test('Validação de Estrutura de Playlist JSON', async (t) => {
  await t.test('Deve validar uma playlist correta', () => {
    const playlist = {
      channelName: 'Recepcao',
      items: [
        { filename: 'promo.mp4', duration: 0 },
        { filename: 'banner.jpg', duration: 15 }
      ]
    };
    const result = validatePlaylist(playlist);
    assert.strictEqual(result.valid, true);
  });

  await t.test('Deve invalidar playlist com nome de canal ausente ou incorreto', () => {
    const playlist = {
      items: []
    };
    const result = playlist => validatePlaylist(playlist);
    const resVal = result(playlist);
    assert.strictEqual(resVal.valid, false);
    assert.match(resVal.error, /nome do canal/);
  });

  await t.test('Deve invalidar playlist sem items ou formato incorreto', () => {
    const playlist = {
      channelName: 'Restaurante',
      items: 'nao-e-array'
    };
    const resVal = validatePlaylist(playlist);
    assert.strictEqual(resVal.valid, false);
    assert.match(resVal.error, /itens/);
  });

  await t.test('Deve invalidar item com duração negativa ou sem nome de arquivo', () => {
    const playlist = {
      channelName: 'Restaurante',
      items: [
        { filename: 'promo.mp4', duration: -5 }
      ]
    };
    const resVal = validatePlaylist(playlist);
    assert.strictEqual(resVal.valid, false);
    assert.match(resVal.error, /duração/);
  });

  await t.test('Deve aceitar playlist com regras de exibição válidas', () => {
    const playlist = {
      channelName: 'Recepcao',
      items: [
        {
          filename: 'promo.mp4',
          duration: 0,
          rules: {
            days: [1, 2, 3, 4, 5],
            timeStart: '08:00',
            timeEnd: '18:00',
            endDate: '2026-06-25T23:59:59.000Z'
          }
        },
        {
          filename: 'banner.jpg',
          duration: 10,
          rules: null
        }
      ]
    };
    const result = validatePlaylist(playlist);
    assert.strictEqual(result.valid, true);
  });

  await t.test('Deve recusar regras de dias da semana inválidas', () => {
    const playlist = {
      channelName: 'Recepcao',
      items: [
        {
          filename: 'promo.mp4',
          duration: 0,
          rules: {
            days: [1, 2, 7] // 7 é inválido (deve ser 0-6)
          }
        }
      ]
    };
    const result = validatePlaylist(playlist);
    assert.strictEqual(result.valid, false);
    assert.match(result.error, /dia da semana inválido/);
  });

  await t.test('Deve recusar horários inválidos', () => {
    const playlist = {
      channelName: 'Recepcao',
      items: [
        {
          filename: 'promo.mp4',
          duration: 0,
          rules: {
            timeStart: '8:00' // Formato errado (deve ser HH:MM, ex: 08:00)
          }
        }
      ]
    };
    const result = validatePlaylist(playlist);
    assert.strictEqual(result.valid, false);
    assert.match(result.error, /horário de início inválido/);
  });

  await t.test('Deve recusar data de expiração inválida', () => {
    const playlist = {
      channelName: 'Recepcao',
      items: [
        {
          filename: 'promo.mp4',
          duration: 0,
          rules: {
            endDate: 'data-invalida'
          }
        }
      ]
    };
    const result = validatePlaylist(playlist);
    assert.strictEqual(result.valid, false);
    assert.match(result.error, /data de remoção inválida/);
  });
});
