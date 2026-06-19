/* multiplayer.js — Socket.io multiplayer (substitui PeerJS) */

const MP = {
  socket: null,
  isHost: false,
  roomId: null,
  roomCode: null,
  ready: false,

  draft: {
    active: false,
    sourceTeamAbbr: null,
    sourceTeamPlayers: [],
    hostPicks: [],
    guestPicks: [],
    myPicks: [],
    theirPicks: [],
    turnIsHost: true,
    positionsNeeded: ["QB","RB","WR","TE","OL","DE","DT","LB","CB","S","K"],
    myPositionsFilled: [],
    theirPositionsFilled: [],
  },
};

const NFL_ABBRS = [
  "BAL","PIT","CLE","CIN","KC","BUF","MIA","NE","NYJ","LV","LAC","DEN",
  "HOU","IND","TEN","JAC","SF","SEA","LAR","ARI","PHI","DAL","NYG","WAS",
  "GB","MIN","CHI","DET","NO","TB","ATL","CAR"
];

// ─── Conexão ──────────────────────────────────────────────────────────────────
function mpConnect(serverUrl) {
  return new Promise((resolve, reject) => {
    if (!window.io) {
      const script = document.createElement("script");
      script.src = serverUrl + "/socket.io/socket.io.js";
      script.onload = () => resolve(_mpDoConnect(serverUrl));
      script.onerror = () => reject(new Error("Servidor indisponível."));
      document.head.appendChild(script);
    } else {
      resolve(_mpDoConnect(serverUrl));
    }
  });
}

function _mpDoConnect(serverUrl) {
  MP.socket = window.io(serverUrl, { transports: ["websocket","polling"] });

  MP.socket.on("connect", () => { MP.ready = true; });
  MP.socket.on("disconnect", () => { MP.ready = false; });
  MP.socket.on("guest_connected", () => {
    _mpShowStatus("Adversário conectou! Iniciando draft...", "ok");
    setTimeout(() => _mpStartDraft(), 800);
  });
  MP.socket.on("opponent_disconnected", () => {
    _mpShowStatus("Adversário desconectou.", "error");
  });
  MP.socket.on("draft_started",   (data) => _mpReceiveDraftStart(data.abbr, data.players));
  MP.socket.on("draft_pick_made", (data) => _mpReceivePick(data));
  MP.socket.on("snap_received",   (data) => mpReceiveSnap(data));
  MP.socket.on("game_over_received", () => { if (gameScreen) gameScreen.onGameOver(); });

  return MP.socket;
}

function mpClose() {
  if (MP.socket) { MP.socket.disconnect(); MP.socket = null; }
  MP.ready = false; MP.roomId = null; MP.roomCode = null;
}

function mpCreateRoom(onCode) {
  if (!MP.socket) return;
  MP.isHost = true;
  MP.socket.emit("create_room", (res) => {
    if (!res.ok) { _mpShowStatus(res.error, "error"); return; }
    MP.roomId = res.roomId; MP.roomCode = res.code;
    onCode(res.code);
  });
}

function mpJoinRoom(code, onJoined) {
  if (!MP.socket) return;
  MP.isHost = false;
  MP.socket.emit("join_room", code.toUpperCase(), (res) => {
    if (!res.ok) { _mpShowStatus(res.error, "error"); return; }
    MP.roomId = res.roomId;
    onJoined();
  });
}

// ─── Draft ────────────────────────────────────────────────────────────────────
function _mpStartDraft() {
  const abbr = NFL_ABBRS[Math.floor(Math.random() * NFL_ABBRS.length)];
  const team = createSampleTeam("", "", abbr, "medium");
  const players = [];
  for (const pos of MP.draft.positionsNeeded) {
    for (const p of team.getAllAtPosition(pos)) {
      players.push({ name: p.name, pos, ovr: p.overall, attrs: {
        passing: p.passing, running: p.running, catching: p.catching,
        blocking: p.blocking, tackle: p.tackle, coverage: p.coverage,
        pass_rush: p.pass_rush, speed: p.speed, strength: p.strength
      }});
    }
  }
  MP.socket.emit("draft_start", { abbr, players }, () => {});
  _mpInitDraftState(abbr, players);
  showScreen("mp-draft-screen");
  renderDraft();
}

function _mpReceiveDraftStart(abbr, players) {
  _mpInitDraftState(abbr, players);
  showScreen("mp-draft-screen");
  renderDraft();
}

function _mpInitDraftState(abbr, players) {
  const d = MP.draft;
  d.active = true; d.sourceTeamAbbr = abbr; d.sourceTeamPlayers = players;
  d.hostPicks = []; d.guestPicks = [];
  d.myPicks = []; d.theirPicks = [];
  d.myPositionsFilled = []; d.theirPositionsFilled = [];
  d.turnIsHost = true;
}

function draftPick(playerIdx) {
  const d = MP.draft;
  const isMyTurn = (MP.isHost && d.turnIsHost) || (!MP.isHost && !d.turnIsHost);
  if (!isMyTurn) return;
  const p = d.sourceTeamPlayers[playerIdx];
  if (!p) return;
  if (d.hostPicks.includes(playerIdx) || d.guestPicks.includes(playerIdx)) return;
  if (d.myPositionsFilled.includes(p.pos)) { showDraftToast(`Você já tem um ${p.pos}!`); return; }
  MP.socket.emit("draft_pick", playerIdx, (res) => {
    if (res && !res.ok) showDraftToast(res.error || "Erro ao escolher.");
  });
}

function _mpReceivePick(data) {
  const d = MP.draft;
  const p = d.sourceTeamPlayers[data.playerIdx];
  if (!p) return;
  if (data.byHost) {
    d.hostPicks.push(data.playerIdx);
    if (MP.isHost) { d.myPicks.push({...p}); d.myPositionsFilled.push(data.pos); }
    else           { d.theirPicks.push({...p}); d.theirPositionsFilled.push(data.pos); }
  } else {
    d.guestPicks.push(data.playerIdx);
    if (!MP.isHost) { d.myPicks.push({...p}); d.myPositionsFilled.push(data.pos); }
    else            { d.theirPicks.push({...p}); d.theirPositionsFilled.push(data.pos); }
  }
  d.turnIsHost = data.turnIsHost;
  renderDraft();
  if (data.complete) { d.active = false; setTimeout(() => startMpGame(), 800); }
}

// ─── Jogo ─────────────────────────────────────────────────────────────────────
function buildTeamFromPicks(picks, abbr) {
  const pb = createDefaultPlaybook();
  const team = new Team(abbr, abbr, abbr, pb);
  for (const p of picks) team.addPlayer(new Player(p.name, Position[p.pos], p.ovr, p.attrs || {}));
  return team;
}

function startMpGame() {
  const d = MP.draft;
  const myTeam    = buildTeamFromPicks(d.myPicks,    "EU");
  const theirTeam = buildTeamFromPicks(d.theirPicks, "ADV");
  const homeTeam  = MP.isHost ? myTeam    : theirTeam;
  const awayTeam  = MP.isHost ? theirTeam : myTeam;

  showScreen("game-screen");
  gameScreen.startGame(homeTeam, awayTeam, null, { offPlaybook:"Pro Style", defPlaybook:"4-3" });
  window.onGameFinished = (h, a) => {
    MP.socket.emit("game_over", { hostScore: h, guestScore: a });
    showScreen("menu-screen");
    refreshMenuScreen();
  };
  _mpInstallSnapOverride();
}

function _mpInstallSnapOverride() {
  gameScreen._mpActive = true;
  const origSnap = gameScreen.doSnap.bind(gameScreen);
  gameScreen.doSnap = function() {
    if (!this._mpActive) { origSnap(); return; }
    const state = this.state;
    const myPoss = MP.isHost ? "home" : "away";
    if (state.possession !== myPoss) return; // aguarda o adversário

    const playerOff = state.possession === "home";
    const off = playerOff
      ? pickOffense(this.aggro, this.playbook, this.focus, state.down, state.yardsToGo)
      : pickOffense("balanced","Pro Style","balanced",state.down,state.yardsToGo);
    const def = playerOff
      ? pickDefense("balanced",state.down,state.yardsToGo,"4-3")
      : pickDefense(this.aggro,state.down,state.yardsToGo,this.defPlaybook);

    const possBefore = state.possession;
    const result = this.engine.simulatePlay(off, def);
    const status  = this.engine.applyResult(result);

    if (this.soundMgr) this.soundMgr.playForResult(result.event,result.description,result.turnover,possBefore,status||"");
    _mpHandleVisuals(this, result, status, possBefore, state);

    MP.socket.emit("snap", {
      yards:result.yards, event:result.event,
      description:result.description, turnover:result.turnover,
      homeScore:state.homeTeam.score, awayScore:state.awayTeam.score,
      quarter:state.quarter, secondsLeft:state.secondsLeft,
      down:state.down, yardsToGo:state.yardsToGo,
      ballPosition:state.ballPosition, possession:state.possession,
      gameOver:state.gameOver,
    });

    if (state.secondsLeft <= 0) {
      const done = state.nextQuarter();
      if (done) { clearInterval(this.timerHandle); this.timerHandle = null; this.onGameOver(); return; }
    }
    this.refreshUI();
  };
}

function mpReceiveSnap(data) {
  if (!gameScreen || !gameScreen.state) return;
  const state = gameScreen.state;
  state.homeTeam.score = data.homeScore; state.awayTeam.score = data.awayScore;
  state.quarter = data.quarter; state.secondsLeft = data.secondsLeft;
  state.down = data.down; state.yardsToGo = data.yardsToGo;
  state.ballPosition = data.ballPosition; state.possession = data.possession;
  state.gameOver = data.gameOver;

  const possBefore = data.possession === "home" ? "away" : "home";
  _mpHandleVisuals(gameScreen, data, null, possBefore, state);

  if (data.gameOver) { clearInterval(gameScreen.timerHandle); gameScreen.timerHandle = null; gameScreen.onGameOver(); return; }
  gameScreen.refreshUI();
}

function _mpHandleVisuals(gs, result, status, possBefore, state) {
  const desc = ((status || result.description) + "").toUpperCase();
  if (desc.includes("TOUCHDOWN")) {
    const m = result.description.match(/para ([A-Z][a-zà-ú]+ [A-Z][a-zà-ú]+)/i);
    const abbr = possBefore==="home" ? state.homeTeam.abbreviation : state.awayTeam.abbreviation;
    gs.myScorerKey = `${state.quarter}-${state.secondsLeft}-TD`;
    gs.myScorerText = `🏈 TD ${abbr} — ${m?.[1]||abbr}`;
    gs.scoreboard.flashTD();
  } else if (result.event==="interception") {
    const abbr = possBefore==="home" ? state.awayTeam.abbreviation : state.homeTeam.abbreviation;
    gs.myScorerKey = `${state.quarter}-${state.secondsLeft}-INT`;
    gs.myScorerText = `🔵 INT ${abbr}`;
  } else if (result.event==="fumble") {
    const abbr = possBefore==="home" ? state.homeTeam.abbreviation : state.awayTeam.abbreviation;
    gs.myScorerKey = `${state.quarter}-${state.secondsLeft}-FUM`;
    gs.myScorerText = `🟡 FUMBLE ${abbr}`;
  } else if (result.event==="field_goal_good") {
    const abbr = possBefore==="home" ? state.homeTeam.abbreviation : state.awayTeam.abbreviation;
    gs.myScorerKey = `${state.quarter}-${state.secondsLeft}-FG`;
    gs.myScorerText = `🎯 FG ${abbr}`;
  }
}

// ─── Render Draft ─────────────────────────────────────────────────────────────
function renderDraft() {
  const d = MP.draft;
  const screen = document.getElementById("mp-draft-screen");
  if (!screen) return;
  const isMyTurn = (MP.isHost && d.turnIsHost) || (!MP.isHost && !d.turnIsHost);
  const total = d.positionsNeeded.length;

  screen.innerHTML = `
    <div class="draft-header">
      <div class="draft-title">🏈  DRAFT</div>
      <div class="draft-source">Time sorteado: <span class="accent">${d.sourceTeamAbbr}</span></div>
      <div class="draft-turn ${isMyTurn ? "my-turn" : "their-turn"}">
        ${isMyTurn ? "⭐ SUA VEZ de escolher!" : "⏳ Aguardando adversário..."}
      </div>
      <div class="draft-progress">Você: ${d.myPicks.length}/${total}  ·  Adversário: ${d.theirPicks.length}/${total}</div>
    </div>
    <div class="draft-cols">
      <div class="draft-pool">
        <div class="draft-section-title">Jogadores disponíveis</div>
        <div class="draft-players">
          ${d.sourceTeamPlayers.map((p, idx) => {
            const tH = d.hostPicks.includes(idx), tG = d.guestPicks.includes(idx);
            const isTaken = tH || tG;
            const takenByMe = (MP.isHost && tH) || (!MP.isHost && tG);
            const takenByThem = isTaken && !takenByMe;
            const posBlocked = d.myPositionsFilled.includes(p.pos);
            const disabled = isTaken || !isMyTurn || posBlocked;
            return `<div class="draft-player ${takenByMe?"taken-me":""} ${takenByThem?"taken-them":""} ${disabled&&!isTaken?"pos-full":""}"
              ${!disabled ? `onclick="draftPick(${idx})"` : ""}>
              <span class="dp-pos">${p.pos}</span>
              <span class="dp-name">${p.name}</span>
              <span class="dp-ovr ${ovrColorClass(p.ovr)}">${p.ovr}</span>
              ${takenByMe   ? '<span class="dp-tag me">✓ Você</span>'  : ""}
              ${takenByThem ? '<span class="dp-tag them">✓ Adv.</span>' : ""}
            </div>`;
          }).join("")}
        </div>
      </div>
      <div class="draft-roster">
        <div class="draft-section-title">Meu time</div>
        ${d.positionsNeeded.map(pos => {
          const pick = d.myPicks.find(p => p.pos === pos);
          return `<div class="dr-slot ${pick?"filled":""}">
            <span class="dr-pos">${pos}</span>
            ${pick
              ? `<span class="dr-name">${pick.name}</span><span class="dr-ovr ${ovrColorClass(pick.ovr)}">${pick.ovr}</span>`
              : `<span class="dr-empty">—</span>`}
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

function showDraftToast(msg) {
  let t = document.getElementById("draft-toast");
  if (!t) { t = document.createElement("div"); t.id = "draft-toast"; t.className = "draft-toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

function _mpShowStatus(msg, type="info") {
  const el = document.getElementById("mp-status");
  if (el) { el.textContent = msg; el.className = `mp-status ${type}`; el.style.display = "block"; }
}
