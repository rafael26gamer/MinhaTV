# 📺 MinhaTV Portable — A TV da sua loja, do seu jeito!

> **Uma solução de sinalização digital (TV Corporativa) compacta, fácil de usar e 100% gratuita!**  
> Esqueça mensalidades caras e servidores complicados. O **MinhaTV Portable** transforma qualquer computador ou TV ligada a um computador em um canal de anúncios profissional e elegante para o seu negócio.

---

## 🍞 Entendendo o projeto (Mesmo se você for um padeiro!)

Imagine que você quer exibir as fotos dos seus pães fresquinhos, bolos do dia e promoções em uma TV na parede da sua padaria. Com o **MinhaTV Portable**, você faz isso em 3 passos simples:

1. **🧑‍🍳 O Gerenciador (Painel de Controle):** O programa que você abre no computador do caixa. Nele, você escolhe as fotos e vídeos, monta a ordem das imagens (a "playlist") e decide o que vai passar em cada TV.
2. **📺 O Player (A TV da Loja):** O programa que roda na TV instalada na parede. Ele exibe as fotos e vídeos em tela cheia, sem barras do Windows, sem cursor do mouse atrapalhando e com transições suaves (efeito *crossfade*) para a tela nunca piscar ou ficar preta.
3. **📁 A Pasta Compartilhada (A Ponte):** Para o painel de controle conversar com a TV, eles usam uma pasta comum. Pode ser um **pendrive** que você conecta nas máquinas, uma pasta de rede na sua loja, ou até pastas na nuvem como **OneDrive**, **Dropbox** ou **Google Drive**.

### 🌟 Por que o MinhaTV Portable é incrível?
- **Não para nunca!** Se o seu sinal de internet cair ou o pendrive for desconectado temporariamente, a TV continua passando seus anúncios normalmente, pois ela guarda uma cópia de segurança na memória local.
- **Transição Suave:** Os vídeos e fotos trocam de forma agradável e contínua, garantindo um visual profissional para atrair seus clientes.
- **Custo Zero:** Sem assinaturas mensais. O sistema é seu e roda direto na sua estrutura.
- **Regras de Exibição Avançadas:** Agende mídias por dia da semana, horário específico e data de expiração — tudo configurado diretamente no Gerenciador.
- **Dois Executáveis Independentes:** O Gerenciador e o Player são aplicativos separados. Cada um pode ser instalado em máquinas diferentes.

---

## 💻 Requisitos do Sistema

- **Sistema Operacional:** Windows (7, 10 ou 11)
- **Para rodar o código/desenvolver:** Node.js (versão 18 ou superior instalada)

---

## 🛠️ Instalação e Configuração

Para preparar o projeto no seu computador, abra o terminal na **pasta raiz do projeto** e execute o comando:

```bash
npm install
```

*Isso baixará automaticamente as ferramentas necessárias para rodar o sistema e os testes de qualidade.*

---

## 🚀 Como Executar o Sistema

O sistema possui **dois modos de operação** que podem ser executados via terminal ou diretamente pelos executáveis portáteis.

### 1. Iniciar o Painel de Controle (Gerenciador)
Para abrir a tela onde você gerencia as mídias, cria playlists com regras de exibição e configura os canais:
```bash
npm start
```

### 2. Iniciar a TV (Player)
Para abrir a tela cheia de exibição que os clientes vão ver na TV:
```bash
npm run start:player
```
💡 *Dica de ouro:* Precisa ajustar alguma configuração direto na TV? Dê um clique duplo ou clique simples no **canto inferior direito** da tela do Player (há uma engrenagem oculta de depuração e configuração ali).

---

## 💾 Configuração de Pasta Compartilhada

O Gerenciador e o Player se comunicam através de uma pasta compartilhada. Configure o caminho no Gerenciador para apontar para:

- **📀 Pendrive**: Conecte o pendrive no computador do Gerenciador, configure-o como destino. Depois, conecte-o no computador do Player.
- **🌐 Pasta de Rede (LAN)**: Crie uma pasta compartilhada no servidor ou em um dos computadores e acesse-a de ambas as máquinas.
- **☁️ Nuvem**: Pastas sincronizadas como **OneDrive**, **Dropbox** ou **Google Drive** funcionam perfeitamente.

### Estrutura esperada da pasta compartilhada:
```
Pasta_Compartilhada/
├── midias/                  # Fotos e vídeos (MP4, JPG, PNG)
├── playlists/               # Playlists geradas pelo Gerenciador (formato JSON)
│   └── canal_*.json         # Um arquivo de playlist por canal
└── config.json              # Configurações gerais
```

> **Nota:** O Player faz cache local dos arquivos em `%APPDATA%/minhatv-player/cache/`, garantindo resiliência mesmo se a pasta compartilhada ficar temporariamente indisponível.

---

## 📋 Playlists com Regras de Exibição

O sistema suporta canais com regras avançadas de exibição por item de mídia:

- **📅 Dias da Semana**: Selecione quais dias cada mídia deve aparecer (seguindo a notação D/S/T/Q/Q/S/S).
- **⏰ Horário**: Defina um intervalo de horário para exibição (ex: das 06:00 às 12:00).
- **🗑️ Remoção Programada**: Defina uma data e hora limite para a mídia parar de ser exibida automaticamente.
- **♾️ Sem Regras**: Se nenhuma regra for configurada, a mídia roda continuamente em todos os horários.

Quando nenhuma mídia do canal estiver ativa no momento, o Player exibe uma tela de fallback ("Nenhum conteúdo ativo") e verifica novamente a cada 10 segundos.

---

## 🧪 Como Rodar os Testes de Qualidade

Para garantir que o código esteja robusto e livre de erros nas atualizações de arquivos ou regras de negócio:
```bash
npm test
```

---

## 📦 Gerando os Aplicativos Prontos (.exe)

Para criar **ambos os executáveis portáteis** (Gerenciador + Player) de uma só vez:

```bash
npm run build
```

Este comando executa o script `build.js` que:
1. Limpa diretórios de build anteriores
2. Compila o **MinhaTV Gerenciador** (portátil) usando `electron-builder-gerenciador.json`
3. Compila o **MinhaTV Player** (portátil) usando `electron-builder-player.json`
4. Copia ambos os `.exe` para a pasta `Exe portatil/` na raiz do projeto

Os executáveis gerados são:
- `Exe portatil/MinhaTV Gerenciador.exe` — Painel de controle
- `Exe portatil/MinhaTV Player.exe` — Player de TV

> **Nota:** Os executáveis são independentes e não exigem Node.js instalado para rodar.

---

## 🗂️ Estrutura do Projeto

```
MinhaTV-main/
├── main.js                          # Código principal do Electron (janelas e backend)
├── preload.js                       # Ponte segura IPC entre frontend e backend
├── package.json                     # Dependências e scripts
├── build.js                         # Script de build dos executáveis portáteis
├── electron-builder-gerenciador.json # Configuração de build do Gerenciador
├── electron-builder-player.json     # Configuração de build do Player
├── main/
│   └── ipc-handlers.js              # Handlers de comunicação IPC
├── src/
│   ├── index.html                   # Interface do Gerenciador
│   ├── player.html                  # Interface do Player
│   ├── ui-manager.js                # Lógica do Gerenciador
│   ├── ui-player.js                 # Lógica do Player
│   └── styles.css                   # Design system
├── utils/
│   ├── file-helpers.js              # Validações e escritas atômicas no disco
│   └── settings-helper.js           # Gerenciamento de configurações persistentes
├── tests/
│   ├── file-operations.test.js      # Testes de operações de arquivo
│   ├── playlist-validator.test.js   # Testes de validação de playlist
│   └── settings-helper.test.js      # Testes de configurações
└── README.md                        # Este guia
```

---

## ⚙️ Configurações Persistentes

As configurações do sistema são salvas em:
```
%APPDATA%/minhatv-player/config.json
```

Isso inclui preferências como:
- Caminho da pasta compartilhada
- Inicialização automática com o Windows (Player)
- Configurações de tela

---
