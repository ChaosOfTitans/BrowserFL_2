# BrowserFL Server

Backend Node.js + Socket.io para o jogo BrowserFL.

## Requisitos
- Node.js 18+
- npm

## Rodar localmente

```bash
npm install
npm start
```

Acesse: http://localhost:3000

Para desenvolvimento com reload automático:
```bash
npm run dev
```

---

## Deploy gratuito no Railway

1. Crie conta em https://railway.app
2. Clique em **New Project → Deploy from GitHub**
3. Conecte este repositório
4. Railway detecta automaticamente o Node.js e faz o deploy
5. Na aba **Settings → Domains**, gere um domínio público (ex: `browserfl.up.railway.app`)
6. Abra `public/js/app.js` e atualize a linha:

```js
const MP_SERVER_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://SEU-DOMINIO.up.railway.app"; // ← coloca aqui
```

---

## Deploy no Render (alternativa gratuita)

1. Crie conta em https://render.com
2. **New → Web Service → Connect GitHub**
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Gera URL tipo `https://browserfl.onrender.com`

**Obs:** No plano gratuito do Render, o servidor "dorme" após 15 min de inatividade e demora ~30s para acordar na primeira conexão.

---

## Estrutura do projeto

```
browserfl-server/
├── server.js          ← servidor principal (Express + Socket.io)
├── package.json
├── data/              ← saves de temporada (criado automaticamente)
└── public/            ← frontend (servido pelo Express)
    ├── index.html
    ├── css/
    ├── js/
    └── sounds/
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT`   | `3000` | Porta do servidor |

---

## Como funciona o multiplayer

1. J1 abre o jogo → "AMISTOSO 1x1" → "Criar sala"
2. Servidor gera um código de 5 letras (ex: `AB12C`)
3. J1 compartilha o código com J2 via WhatsApp/mensagem
4. J2 abre o jogo → "AMISTOSO 1x1" → digita o código → "Entrar"
5. Conexão estabelecida via Socket.io (WebSockets)
6. Host sorteia um time da NFL para o draft
7. Draft alternado: cada um escolhe 1 jogador por vez (11 escolhas cada)
8. Após o draft, jogo começa automaticamente
9. Cada jogador controla seu time quando tem a posse
10. Jogadas sincronizadas em tempo real pelo servidor
