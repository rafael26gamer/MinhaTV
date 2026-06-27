# 📺 MinhaTV Portable — A TV da sua loja, do seu jeito!

> **Uma solução de sinalização digital (TV Corporativa) compacta, fácil de usar e 100% gratuita!**  
> Esqueça mensalidades caras e servidores complicados. O **MinhaTV Portable** transforma qualquer computador ou TV ligada a um computador em um canal de anúncios profissional e elegante para o seu negócio.

---

## 🍞 Entendendo o projeto (Mesmo se você for um padeiro!)

Imagine que você quer exibir as fotos dos seus pães fresquinhos, bolos do dia e promoções em uma TV na parede da sua padaria. Com o **MinhaTV  Portable**, você faz isso em 3 passos simples:

1. **🧑‍🍳 O Gerenciador (Painel de Controle):** O programa que você abre no computador do caixa. Nele, você escolhe as fotos e vídeos, monta a ordem das imagens (a "playlist") e decide o que vai passar em cada TV.
2. **📺 O Player (A TV da Loja):** O programa que roda na TV instalada na parede. Ele exibe as fotos e vídeos em tela cheia, sem barras do Windows, sem cursor do mouse atrapalhando e com transições suaves (efeito *crossfade*) para a tela nunca piscar ou ficar preta.
3. **📁 A Pasta Compartilhada (A Ponte):** Para o painel de controle conversar com a TV, eles usam uma pasta comum. Pode ser um **pendrive** que você conecta nas máquinas, uma pasta de rede na sua loja, ou até pastas na nuvem como **OneDrive**, **Dropbox** ou **Google Drive**.

### 🌟 Por que o MinhaTV Portable é incrível?
- **Não para nunca!** Se o seu sinal de internet cair ou o pendrive for desconectado temporariamente, a TV continua passando seus anúncios normalmente, pois ela guarda uma cópia de segurança na memória local.
- **Transição Suave:** Os vídeos e fotos trocam de forma agradável e contínua, garantindo um visual profissional para atrair seus clientes.
- **Custo Zero:** Sem assinaturas mensais. O sistema é seu e roda direto na sua estrutura.

---

## 💻 Requisitos do Sistema

- **Sistema Operacional:** Windows (7, 10 ou 11)
- **Para rodar o código/desenvolver:** Node.js (versão 18 ou superior instalada)

---

## 🛠️ Instalação e Configuração

Para preparar o projeto no seu computador, abra o terminal na pasta raiz do projeto (`Projeto minha TV`) e execute o comando:

```bash
npm install
```

*Isso baixará automaticamente as ferramentas necessárias para rodar o sistema e os testes de qualidade.*

---

## 🚀 Como Executar o Sistema

O sistema vem pronto com duas funções (modos) em um único programa:

### 1. Iniciar o Painel de Controle (Gerenciador)
Para abrir a tela onde você envia fotos, vídeos e cria suas programações:
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

## 🧪 Como Rodar os Testes de Qualidade

Para garantir que o código esteja robusto e livre de erros nas atualizações de arquivos ou regras de negócio:
```bash
npm test
```

---

## 📦 Gerando o Aplicativo Pronto (.exe)

Para criar um instalador portátil e profissional para Windows (que você pode enviar e rodar em qualquer máquina sem precisar instalar o Node.js separadamente):
```bash
npx electron-builder --win
```
O instalador pronto será gerado na pasta `dist/`.

---
