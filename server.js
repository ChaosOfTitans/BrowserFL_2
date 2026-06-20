/**
 * BrowserFL Server — Node.js + Express + Socket.io
 * Gerencia: salas de multiplayer, draft, sincronização de jogadas, saves de temporada
 */

const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path  = require("path");
const fs    = require("fs");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

const PORT = process.env.PORT || 3000;

// ─── Serve os arquivos estáticos do frontend ──────────────────────────────────
// Serve arquivos estáticos — tenta public/ primeiro, depois a raiz
const publicDir = fs.existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : __dirname;
app.use(express.static(publicDir));
console.log(`[static] Servindo arquivos de: ${publicDir}`);
app.use(express.json());

// ─── Persistência de temporadas (arquivo JSON simples) ────────────────────────
const SAVES_DIR = path.join(__dirname, "data");
if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR);

function savesPath(userId) {
  return path.join(SAVES_DIR, `saves_${userId}.json`);
}
function loadSaves(userId) {
  try {
    const p = savesPath(userId);
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch { return {}; }
}
function writeSaves(userId, saves) {
  fs.writeFileSync(savesPath(userId), JSON.stringify(saves, null, 2), "utf8");
}

// ─── API REST para temporadas ──────────────────────────────────────────────────
app.get("/api/saves/:userId", (req, res) => {
  res.json(loadSaves(req.params.userId));
});
app.post("/api/saves/:userId/:saveId", (req, res) => {
  const saves = loadSaves(req.params.userId);
  saves[req.params.saveId] = req.body;
  writeSaves(req.params.userId, saves);
  res.json({ ok: true });
});
app.delete("/api/saves/:userId/:saveId", (req, res) => {
  const saves = loadSaves(req.params.userId);
  delete saves[req.params.saveId];
  writeSaves(req.params.userId, saves);
  res.json({ ok: true });
});

// ─── Estado das salas multiplayer ─────────────────────────────────────────────
const rooms = new Map();
/*
  room = {
    id: string,
    code: string,       // código amigável ex: "AB12C"
    hostId: socketId,
    guestId: socketId | null,
    phase: "waiting" | "draft" | "game" | "done",
    draft: {
      abbr: string,
      players: [...],
      hostPicks: [indices],
      guestPicks: [indices],
      hostPositions: [pos],
      guestPositions: [pos],
      turnIsHost: bool,
    }
  }
*/

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function findRoomByCode(code) {
  for (const [,room] of rooms) {
    if (room.code === code) return room;
  }
  return null;
}

function findRoomBySocket(socketId) {
  for (const [,room] of rooms) {
    if (room.hostId === socketId || room.guestId === socketId) return room;
  }
  return null;
}

// ─── Socket.io — eventos ──────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[+] Conectado: ${socket.id}`);

  // ── Criar sala ──────────────────────────────────────────────────────────────
  socket.on("create_room", (cb) => {
    // Remove sala antiga se houver
    const old = findRoomBySocket(socket.id);
    if (old) rooms.delete(old.id);

    const roomId = uuidv4();
    let code;
    // Garante código único
    do { code = generateCode(); } while (findRoomByCode(code));

    const room = {
      id: roomId, code,
      hostId: socket.id, guestId: null,
      phase: "waiting",
      draft: null,
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.isHost = true;

    console.log(`[SALA] Criada: ${code} por ${socket.id}`);
    cb({ ok: true, code, roomId });
  });

  // ── Entrar em sala ──────────────────────────────────────────────────────────
  socket.on("join_room", (code, cb) => {
    const room = findRoomByCode(code.toUpperCase());
    if (!room) return cb({ ok: false, error: "Sala não encontrada. Verifique o código." });
    if (room.guestId) return cb({ ok: false, error: "Sala cheia." });
    if (room.phase !== "waiting") return cb({ ok: false, error: "Partida já iniciada." });

    room.guestId = socket.id;
    room.phase = "draft";
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.isHost = false;

    console.log(`[SALA] ${socket.id} entrou na sala ${code}`);
    cb({ ok: true, roomId: room.id });

    // Notifica o host que o guest conectou
    socket.to(room.id).emit("guest_connected");
  });

  // ── Draft: host sorteia o time e envia para os dois ─────────────────────────
  socket.on("draft_start", (data, cb) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;

    room.draft = {
      abbr: data.abbr,
      players: data.players,
      hostPicks: [], guestPicks: [],
      hostPositions: [], guestPositions: [],
      turnIsHost: true,
    };
    room.phase = "draft";

    // Envia para os dois jogadores
    io.to(room.id).emit("draft_started", {
      abbr: data.abbr,
      players: data.players,
    });

    console.log(`[DRAFT] Iniciado na sala ${room.code} — time: ${data.abbr}`);
    if (cb) cb({ ok: true });
  });

  // ── Draft: jogador escolhe um jogador ───────────────────────────────────────
  socket.on("draft_pick", (playerIdx, cb) => {
    const room = findRoomBySocket(socket.id);
    if (!room || !room.draft) return;
    const d = room.draft;
    const isHost = room.hostId === socket.id;

    if (isHost !== d.turnIsHost) return cb && cb({ ok: false, error: "Não é sua vez." });
    if (d.hostPicks.includes(playerIdx) || d.guestPicks.includes(playerIdx))
      return cb && cb({ ok: false, error: "Jogador já escolhido." });

    const p = d.players[playerIdx];
    if (!p) return;

    const positions = isHost ? d.hostPositions : d.guestPositions;
    if (positions.includes(p.pos))
      return cb && cb({ ok: false, error: `Você já tem um ${p.pos}.` });

    if (isHost) { d.hostPicks.push(playerIdx); d.hostPositions.push(p.pos); }
    else        { d.guestPicks.push(playerIdx); d.guestPositions.push(p.pos); }

    d.turnIsHost = !d.turnIsHost;

    const needed = 11;
    const complete = d.hostPicks.length >= needed && d.guestPicks.length >= needed;
    // Após cada par de escolhas (host+guest), nova rodada
    const newRound = !complete && d.hostPicks.length === d.guestPicks.length;

    io.to(room.id).emit("draft_pick_made", {
      playerIdx, byHost: isHost, pos: p.pos,
      turnIsHost: d.turnIsHost,
      hostCount: d.hostPicks.length,
      guestCount: d.guestPicks.length,
      complete, newRound,
    });

    if (complete) { room.phase = "game"; console.log(`[DRAFT] Completo na sala ${room.code}`); }
    if (cb) cb({ ok: true });
  });

  // ── Draft: host envia novo time sorteado para a próxima rodada ──────────────
  socket.on("draft_start", (data, cb) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;

    // Atualiza o time da rodada atual (mantém picks acumulados)
    if (!room.draft) {
      room.draft = {
        players: data.players, abbr: data.abbr,
        hostPicks: [], guestPicks: [],
        hostPositions: [], guestPositions: [],
        turnIsHost: true,
      };
    } else {
      // Nova rodada: reseta picks da rodada, mantém posições acumuladas
      room.draft.players = data.players;
      room.draft.abbr = data.abbr;
      room.draft.hostPicks = [];
      room.draft.guestPicks = [];
      room.draft.turnIsHost = data.round % 2 === 0; // alterna quem começa
    }
    room.phase = "draft";

    io.to(room.id).emit("draft_started", { abbr: data.abbr, players: data.players, round: data.round || 0 });
    console.log(`[DRAFT] Rodada ${data.round || 0} — time: ${data.abbr} na sala ${room.code}`);
    if (cb) cb({ ok: true });
  });

  // ── Jogo: sincroniza snap entre os jogadores ─────────────────────────────────
  socket.on("snap", (snapData) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    // Reenvia para o outro jogador
    socket.to(room.id).emit("snap_received", snapData);
  });

  // ── Jogo encerrado ───────────────────────────────────────────────────────────
  socket.on("game_over", (result) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    room.phase = "done";
    socket.to(room.id).emit("game_over_received", result);
    console.log(`[JOGO] Encerrado na sala ${room.code}`);
  });

  // ── Desconexão ───────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const room = findRoomBySocket(socket.id);
    if (room) {
      socket.to(room.id).emit("opponent_disconnected");
      // Limpa sala após 60s (dá tempo de reconectar)
      setTimeout(() => {
        if (rooms.has(room.id)) {
          rooms.delete(room.id);
          console.log(`[SALA] ${room.code} removida.`);
        }
      }, 60000);
    }
    console.log(`[-] Desconectado: ${socket.id}`);
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({
  ok: true,
  rooms: rooms.size,
  uptime: Math.floor(process.uptime()) + "s"
}));

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅ BrowserFL Server rodando em http://localhost:${PORT}`);
  console.log(`   Salas ativas: ${rooms.size}`);
});
