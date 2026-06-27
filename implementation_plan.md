# Plano de Implementação - MinhaTV Portable (Aplicações Nativas via Electron)

Este plano descreve o desenvolvimento da solução de sinalização digital compacta de custo zero e alta portabilidade, composta por dois aplicativos executáveis nativos desenvolvidos com Electron.

---

## Estrutura do Workspace (Electron App)

Os arquivos seguem a estrutura de diretórios abaixo na raiz (`c:\Users\rafae\Desktop\Projeto minha TV`):

```
c:\Users\rafae\Desktop\Projeto minha TV\
├── main.js                      (Código Principal do Electron - Janelas e Backend Node.js)
├── preload.js                   (Ponte segura IPC entre Frontend e Backend)
├── package.json                 (Dependências Node.js e scripts de build)
├── src/                         (Código Frontend - HTML/JS/CSS)
│   ├── index.html               (Interface do Gerenciador de Conteúdo)
│   ├── ui-manager.js            (Lógica do Gerenciador - Playlist & Monitoramento)
│   ├── player.html              (Interface do Player de Mídia)
│   ├── ui-player.js             (Lógica do Player - Loop de vídeo, Regras de Exibição & Telemetria)
│   └── styles.css               (Design System Moderno Dark-Glass)
├── utils/
│   └── file-helpers.js          (Validações e escritas atômicas no disco)
└── README.md                    (Guia de execução, teste e compilação do executável .exe)
```

---

## Novas Funcionalidades: Gerenciador de Conteúdo e Regras de Exibição

O sistema agora funciona como um gerenciador de sinalização digital dinâmico baseado em canais, linha do tempo (timeline) e regras específicas por reprodução.

### 1. Modelo de Playlist por Canal (JSON)

Os arquivos de playlist de canal em `playlists/canal_[nome].json` suportam regras avançadas para cada item de mídia:

```json
{
  "channelName": "Recepcao",
  "items": [
    {
      "filename": "promo.mp4",
      "duration": 0,
      "rules": {
        "days": [1, 2, 3, 4, 5],
        "timeStart": "08:00",
        "timeEnd": "18:00",
        "endDate": "2026-06-25T23:59:59.000Z"
      }
    },
    {
      "filename": "banner.jpg",
      "duration": 10,
      "rules": null
    }
  ],
  "updatedAt": "2026-06-20T20:00:00.000Z"
}
```

*Nota: Se `rules` for `null` ou `undefined`, a mídia roda continuamente todos os dias e horários (sem restrições).*

### 2. Regras de Exibição do Item

- **Dias da Semana**: Seleção visual estilo despertador Samsung (siglas D/S/T/Q/Q/S/S) correspondente ao array de dias `[0, 1, 2, 3, 4, 5, 6]`.
- **Horário**: Intervalo de início e fim da exibição (ex: das 06:00 às 12:00).
- **Remoção Programada**: Data e hora limite. Após este período, a mídia é automaticamente ignorada na reprodução.

### 3. Drag-and-Drop Avançado

- **Interno**: Arrastar mídias da biblioteca (à direita) direto para a timeline (à esquerda).
- **Externo (OS)**: Arrastar arquivos MP4/JPG/PNG do Windows Explorer diretamente para a biblioteca ou para a timeline. O sistema copia o arquivo nativamente para `/midias` no diretório compartilhado e o inclui na lista.

---

## Verificação e Resiliência

1. **Validação de Playlist**: Ajustado o helper `validatePlaylist` para validar os campos das regras (dias entre 0 e 6, horários em formato HH:MM e data de remoção válida).
2. **Execução Resiliente no Player**:
   - O player filtra a playlist a cada iteração do loop de vídeo/imagem.
   - Itens fora das regras ativas ou expirados são ignorados e o loop segue para o próximo item.
   - Caso nenhuma mídia do canal esteja ativa no momento atual, o player exibe a tela de fallback ("Nenhum conteúdo ativo") e checa novamente a cada 10 segundos.
   - A filtragem funciona localmente e de forma offline se a rede cair, pois o player lê o arquivo cacheado local que possui as regras pré-gravadas.
