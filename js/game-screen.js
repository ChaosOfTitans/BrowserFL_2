/* game-screen.js — Tela do jogo: scoreboard + painel de controles + jogos ao vivo */

const C = {
  bg:"#0d1117", surface:"#161b22", card:"#1c2230", border:"#30363d",
  gold:"#e8a020", goldL:"#f5c842", blue:"#4d9de0", green:"#3fb950",
  red:"#f85149", white:"#e6edf3", muted:"#8b949e", purple:"#a371f7",
};

function pad2(n) { return String(n).padStart(2, "0"); }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

class Scoreboard {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.homeAbbr = "PHI"; this.awayAbbr = "OPP";
    this.homeColor = "#e8a020"; this.awayColor = "#4d9de0";
    this.homeScore = 0; this.awayScore = 0;
    this.quarter = 1; this.seconds = 900;
    this.down = 1; this.yards = 10; this.ballPos = 25;
    this.possession = "home";
    this._flash = false; this._flashTimer = null;
    this._resize();
    window.addEventListener("resize", () => this._resize());
  }
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(dpr, dpr);
    this.W = rect.width; this.H = rect.height;
    this.draw();
  }
  flashTD() {
    this._flash = true;
    let n = 0;
    clearInterval(this._flashTimer);
    this._flashTimer = setInterval(() => {
      this._flash = !this._flash; this.draw(); n++;
      if (n > 7) { clearInterval(this._flashTimer); this._flash = false; this.draw(); }
    }, 300);
  }
  update(state) {
    const h = state.homeTeam, a = state.awayTeam;
    this.homeScore = h.score; this.awayScore = a.score;
    this.quarter = state.quarter; this.seconds = state.secondsLeft;
    this.down = state.down; this.yards = state.yardsToGo;
    this.ballPos = state.ballPosition; this.possession = state.possession;
    this.draw();
  }
  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a2035"); bg.addColorStop(1, "#0d1117");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const topGrad = ctx.createLinearGradient(0, 0, W, 0);
    topGrad.addColorStop(0, "rgba(232,160,32,0)");
    topGrad.addColorStop(0.3, C.gold); topGrad.addColorStop(0.7, C.gold);
    topGrad.addColorStop(1, "rgba(232,160,32,0)");
    ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, 2);

    const homeX = W * 0.22, isHomePoss = this.possession === "home";

    // 🏈 Bola de futebol — aparece no lado do time com a posse, grande e visível
    ctx.font = "22px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (isHomePoss) {
      ctx.globalAlpha = 1;
      ctx.fillText("🏈", homeX - 68, H / 2);
    }

    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 14px Segoe UI";
    ctx.fillStyle = isHomePoss ? this.homeColor : C.muted;
    ctx.fillText(this.homeAbbr, homeX - 50, 26);

    const flashCol = (this._flash && isHomePoss) ? C.goldL : C.white;
    ctx.font = "bold 42px Segoe UI";
    ctx.fillStyle = flashCol;
    ctx.fillText(String(this.homeScore), homeX - 50, 66);

    const cx = W / 2;
    const ql = this.quarter === 5 ? "OT" : this.quarter > 4 ? "FINAL" : `Q${this.quarter}`;
    const m_ = Math.floor(this.seconds / 60), s_ = this.seconds % 60;

    ctx.fillStyle = ql === "FINAL" ? C.green : ql === "OT" ? C.purple : C.gold;
    roundRect(ctx, cx - 28, 12, 56, 22, 6); ctx.fill();
    ctx.font = "bold 11px Segoe UI"; ctx.fillStyle = "#0d1117";
    ctx.fillText(ql, cx, 23);

    ctx.font = "bold 24px Segoe UI"; ctx.fillStyle = C.white;
    ctx.fillText(`${pad2(m_)}:${pad2(s_)}`, cx, 52);

    ctx.font = "11px Segoe UI"; ctx.fillStyle = C.muted;
    ctx.fillText(`${this.down}ª & ${this.yards}  ·  Jarda ${this.ballPos}`, cx, 82);

    // Barra de campo
    const barY = 97, barH = 6, barL = cx - 70, barW = 140;
    ctx.fillStyle = "#2d333b";
    roundRect(ctx, barL, barY, barW, barH, 3); ctx.fill();

    // Zonas de end zone
    ctx.fillStyle = "rgba(232,160,32,0.1)";
    ctx.fillRect(barL, barY, barW * 0.1, barH);
    ctx.fillStyle = "rgba(77,157,224,0.1)";
    ctx.fillRect(barL + barW * 0.9, barY, barW * 0.1, barH);

    // Linha de 50 jardas
    ctx.fillStyle = "#30363d";
    ctx.fillRect(barL + barW * 0.5 - 0.5, barY, 1, barH);

    // Bolinha da bola — cor pelo time com posse, glow
    // Posição da bola: home ataca da esquerda para direita, away da direita para esquerda
    const displayPos = isHomePoss ? this.ballPos : (100 - this.ballPos);
    const ballX = barL + barW * (displayPos / 100);
    const ballColor = isHomePoss ? this.homeColor : this.awayColor;
    // Glow
    const grd = ctx.createRadialGradient(ballX, barY + barH/2, 0, ballX, barY + barH/2, 10);
    grd.addColorStop(0, ballColor + "cc");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ballX, barY + barH/2, 10, 0, Math.PI*2); ctx.fill();
    // Bolinha principal
    ctx.fillStyle = ballColor;
    ctx.beginPath(); ctx.arc(ballX, barY + barH/2, 5, 0, Math.PI*2); ctx.fill();

    const awayX = W * 0.78, isAwayPoss = !isHomePoss;
    if (isAwayPoss) {
      ctx.font = "22px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.globalAlpha = 1;
      ctx.fillText("🏈", awayX + 68, H / 2);
    }
    ctx.font = "bold 14px Segoe UI";
    ctx.fillStyle = isAwayPoss ? this.awayColor : C.muted;
    ctx.fillText(this.awayAbbr, awayX + 50, 26);

    const flashCol2 = (this._flash && isAwayPoss) ? C.blue : C.white;
    ctx.font = "bold 42px Segoe UI";
    ctx.fillStyle = flashCol2;
    ctx.fillText(String(this.awayScore), awayX + 50, 66);

    ctx.strokeStyle = C.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H-0.5); ctx.lineTo(W, H-0.5); ctx.stroke();
  }
}

class PlayerGamePanel {
  /* Painel grande e destacado do jogo do jogador: placar (canvas) +
     estatísticas + histórico de pontuadores, tudo embutido. */
  constructor(homeAbbr, awayAbbr) {
    this.homeAbbr = homeAbbr; this.awayAbbr = awayAbbr;
    this.homeScore = 0; this.awayScore = 0;
    this.quarter = 1; this.seconds = 900;
    this.scorerHistory = []; // [{quarter, time, text}]
    this.done = false; this.homeWon = false;
    this._flash = false; this._flashTimer = null;
    this._lastScorerKey = "";

    this.root = document.createElement("div");
    this.root.className = "player-panel";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "player-panel-canvas";
    this.ctx = this.canvas.getContext("2d");
    this.root.appendChild(this.canvas);

    this.statsEl = document.createElement("div");
    this.statsEl.className = "player-panel-stats";
    this.root.appendChild(this.statsEl);

    this.historyEl = document.createElement("div");
    this.historyEl.className = "player-panel-history";
    this.root.appendChild(this.historyEl);

    this.rosterEl = document.createElement("div");
    this.rosterEl.className = "player-panel-roster";
    this.root.appendChild(this.rosterEl);

    requestAnimationFrame(() => this._resize());
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.canvas);
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(dpr, dpr);
    this.W = rect.width; this.H = rect.height;
    this.draw();
  }

  setData(homeScore, awayScore, quarter, seconds, scorerKey = "", scorerText = "") {
    this.homeScore = homeScore; this.awayScore = awayScore;
    this.quarter = quarter; this.seconds = seconds;
    if (scorerText && scorerKey !== this._lastScorerKey) {
      this._lastScorerKey = scorerKey;
      const m_ = Math.floor(seconds/60), s_ = seconds%60;
      this.scorerHistory.unshift({ quarter, time: `${pad2(m_)}:${pad2(s_)}`, text: scorerText });
      this._renderHistory();
      const isTurnover = scorerText.includes("INT") || scorerText.includes("FUMBLE");
      this._flashColor = isTurnover ? C.red : C.goldL;
      this._flash = true;
      let n = 0;
      clearInterval(this._flashTimer);
      this._flashTimer = setInterval(() => {
        this._flash = !this._flash; this.draw(); n++;
        if (n > 7) { clearInterval(this._flashTimer); this._flash = false; this.draw(); }
      }, 300);
    }
    this.draw();
  }

  setStats(homeTeam, awayTeam) {
    const rows = [
      ["Jardas", homeTeam.totalYards, awayTeam.totalYards],
      ["Passe",  homeTeam.passYards,  awayTeam.passYards],
      ["Corrida",homeTeam.rushYards,  awayTeam.rushYards],
      ["1st Downs", homeTeam.firstDowns, awayTeam.firstDowns],
      ["Turnovers", homeTeam.turnovers, awayTeam.turnovers],
    ];
    this.statsEl.innerHTML = rows.map(([label, h, a]) => {
      const total = Math.max(1, h + a);
      const pct = Math.round(100 * h / total);
      return `
        <div class="pp-stat-row">
          <span class="pp-stat-val gold">${h}</span>
          <div class="pp-stat-mid">
            <span class="pp-stat-label">${label}</span>
            <div class="pp-stat-bar"><div class="pp-stat-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <span class="pp-stat-val blue">${a}</span>
        </div>`;
    }).join("");
  }

  _renderHistory() {
    if (!this.scorerHistory.length) {
      this.historyEl.innerHTML = `<div class="pp-history-empty">Nenhum evento ainda</div>`;
      return;
    }
    this.historyEl.innerHTML = `
      <div class="pp-history-title">Histórico da partida</div>
      ${this.scorerHistory.map(h => {
        const isTurnover = h.text.includes("INT") || h.text.includes("FUMBLE");
        return `<div class="pp-history-row">
          <span class="pp-history-q">Q${h.quarter} ${h.time}</span>
          <span class="pp-history-text ${isTurnover ? "turnover" : ""}">${h.text}</span>
        </div>`;
      }).join("")}`;
  }

  setRoster(team) {
    const order = ["QB","RB","WR","TE","OL","DE","DT","LB","CB","S","K"];
    const rows = order.map(pos => {
      const starter = team.getStarter(pos);
      if (!starter) return "";
      const backup = team.getBackup(pos);
      return `
        <div class="pr-row" data-pos="${pos}">
          <span class="pr-pos">${pos}</span>
          <span class="pr-name">${starter.name}</span>
          <span class="pr-ovr ${ovrColorClass(starter.overall)}">${starter.overall}</span>
          ${backup ? `<button class="pr-swap-btn" data-pos="${pos}" title="Trocar por ${backup.name} (${backup.overall} OVR)">⇄</button>` : ""}
        </div>`;
    }).join("");
    this.rosterEl.innerHTML = `<div class="pp-history-title">Escalação  ·  Fadiga</div>${rows}`;

    this.rosterEl.querySelectorAll(".pr-swap-btn").forEach(btn => {
      btn.onclick = () => {
        const pos = btn.dataset.pos;
        const players = team.getAllAtPosition(pos);
        const curIdx = team.activeStarter[pos];
        const newIdx = players.findIndex((p, i) => i !== curIdx);
        if (newIdx >= 0) {
          team.substitute(pos, newIdx);
          this.setRoster(team);
        }
      };
    });
  }

  markDone(homeWon) {
    this.done = true; this.homeWon = homeWon;
    clearInterval(this._flashTimer); this._flash = false;
    this.draw();
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a2035"); bg.addColorStop(1, "#0d1117");
    ctx.fillStyle = bg;
    roundRect(ctx, 1, 1, W-2, H-2, 14); ctx.fill();
    ctx.strokeStyle = this._flash ? (this._flashColor || C.goldL) : C.gold; ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, W-2, H-2, 14); ctx.stroke();

    const cy = H/2 - 6;
    const ql = this.done ? "FINAL" : `Q${this.quarter}`;
    const m_ = Math.floor(this.seconds/60), s_ = this.seconds%60;
    const timeStr = this.done ? "FINAL" : `${ql}  ${pad2(m_)}:${pad2(s_)}`;

    ctx.textBaseline = "middle";
    ctx.font = "11px Segoe UI"; ctx.fillStyle = C.muted; ctx.textAlign = "center";
    ctx.fillText(timeStr, W/2, 22);

    ctx.font = "bold 20px Segoe UI"; ctx.textAlign = "left";
    const hw = this.done && this.homeScore > this.awayScore;
    ctx.fillStyle = hw ? C.gold : C.white;
    ctx.fillText(this.homeAbbr, 24, cy);

    ctx.textAlign = "center"; ctx.font = "bold 46px Segoe UI"; ctx.fillStyle = C.white;
    ctx.fillText(`${this.homeScore}  –  ${this.awayScore}`, W/2, cy);

    ctx.textAlign = "right"; ctx.font = "bold 20px Segoe UI";
    const aw = this.done && this.awayScore > this.homeScore;
    ctx.fillStyle = aw ? C.blue : C.white;
    ctx.fillText(this.awayAbbr, W - 24, cy);
  }
}

class GameCard {
  constructor(homeAbbr, awayAbbr, isPlayer = false) {
    this.homeAbbr = homeAbbr; this.awayAbbr = awayAbbr;
    this.isPlayer = isPlayer;
    this.homeScore = 0; this.awayScore = 0;
    this.quarter = 1; this.seconds = 900;
    this.scorer = ""; this.done = false; this.homeWon = false;
    this._flash = false; this._flashTimer = null;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-card-canvas";
    this.canvas.style.height = isPlayer ? "72px" : "54px";
    this.ctx = this.canvas.getContext("2d");
    requestAnimationFrame(() => this._resize());
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.canvas);
  }
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(dpr, dpr);
    this.W = rect.width; this.H = rect.height;
    this.draw();
  }
  setData(homeScore, awayScore, quarter, seconds, scorer = "") {
    this.homeScore = homeScore; this.awayScore = awayScore;
    this.quarter = quarter; this.seconds = seconds;
    if (scorer && scorer !== this.scorer) {
      this.scorer = scorer;
      this._flash = true;
      let n = 0;
      clearInterval(this._flashTimer);
      this._flashTimer = setInterval(() => {
        this._flash = !this._flash; this.draw(); n++;
        if (n > 5) { clearInterval(this._flashTimer); this._flash = false; this.draw(); }
      }, 400);
    }
    this.draw();
  }
  markDone(homeWon) {
    this.done = true; this.homeWon = homeWon;
    clearInterval(this._flashTimer); this._flash = false;
    this.draw();
  }
  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);

    if (this.isPlayer) {
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, "#1a2035"); bg.addColorStop(1, "#0d1117");
      ctx.fillStyle = bg;
      roundRect(ctx, 1, 1, W-2, H-2, 10); ctx.fill();
      ctx.strokeStyle = this._flash ? C.goldL : C.gold; ctx.lineWidth = 1.5;
      roundRect(ctx, 1, 1, W-2, H-2, 10); ctx.stroke();
    } else {
      let col = C.card;
      if (this.done) col = this.homeWon ? "#1a2a1a" : "#2a1a1a";
      ctx.fillStyle = col;
      roundRect(ctx, 1, 1, W-2, H-2, 8); ctx.fill();
      ctx.strokeStyle = this._flash ? C.gold : C.border;
      ctx.lineWidth = this._flash ? 1.5 : 1;
      roundRect(ctx, 1, 1, W-2, H-2, 8); ctx.stroke();
    }

    const pad = 16, cy = H/2;
    const ql = this.done ? "FINAL" : (this.quarter <= 4 ? `Q${this.quarter}` : "FIM");
    const m_ = Math.floor(this.seconds/60), s_ = this.seconds%60;
    const timeStr = this.done ? "FINAL" : `${ql}  ${pad2(m_)}:${pad2(s_)}`;

    ctx.textBaseline = "middle";
    ctx.font = "8px Segoe UI"; ctx.fillStyle = C.muted; ctx.textAlign = "right";
    ctx.fillText(timeStr, W - pad, cy);

    const fsz = this.isPlayer ? 13 : 11;
    ctx.textAlign = "left";
    ctx.font = `bold ${fsz}px Segoe UI`;
    const hw = this.done && this.homeScore > this.awayScore;
    ctx.fillStyle = hw ? C.gold : C.white;
    ctx.fillText(this.homeAbbr, pad, cy - (this.scorer ? 8 : 0));

    ctx.textAlign = "center";
    ctx.font = `bold ${fsz + (this.isPlayer?4:2)}px Segoe UI`;
    ctx.fillStyle = C.white;
    ctx.fillText(`${this.homeScore}  –  ${this.awayScore}`, W/2, cy - (this.scorer ? 8 : 0));

    ctx.textAlign = "right";
    ctx.font = `bold ${fsz}px Segoe UI`;
    const aw = this.done && this.awayScore > this.homeScore;
    ctx.fillStyle = aw ? C.blue : C.white;
    ctx.fillText(this.awayAbbr, W - pad, cy - (this.scorer ? 8 : 0));

    if (this.scorer) {
      ctx.textAlign = "center";
      ctx.font = this.isPlayer ? "8px Segoe UI" : "7px Segoe UI";
      ctx.fillStyle = this._flash ? C.gold : (this.isPlayer ? C.muted : "#30363d");
      ctx.fillText(`TD  ${this.scorer}`, W/2, cy + 14);
    }
  }
}

class StatBar {
  constructor(label) {
    this.label = label; this.homeV = 0; this.awayV = 0;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "stat-bar-canvas";
    this.ctx = this.canvas.getContext("2d");
    requestAnimationFrame(() => this._resize());
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.canvas);
  }
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(dpr, dpr);
    this.W = rect.width; this.H = rect.height;
    this.draw();
  }
  setValues(h, a) { this.homeV = h; this.awayV = a; this.draw(); }
  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (!W) return;
    ctx.clearRect(0,0,W,H);
    ctx.textBaseline = "middle";
    ctx.font = "9px Segoe UI"; ctx.fillStyle = C.muted; ctx.textAlign = "center";
    ctx.fillText(this.label, W/2, H/2 - 4);

    ctx.font = "bold 10px Segoe UI"; ctx.textAlign = "left";
    ctx.fillStyle = C.gold;
    ctx.fillText(String(this.homeV), 4, H/2 - 4);

    ctx.textAlign = "right";
    ctx.fillStyle = C.blue;
    ctx.fillText(String(this.awayV), W-4, H/2 - 4);

    const total = Math.max(1, this.homeV + this.awayV);
    const barL = W/2 - 48, barW = 96, barH = 3, barY = H/2 + 6;
    ctx.fillStyle = "#2d333b"; roundRect(ctx, barL, barY, barW, barH, 2); ctx.fill();
    const homeW = barW * (this.homeV / total);
    if (homeW > 0) { ctx.fillStyle = C.gold; roundRect(ctx, barL, barY, homeW, barH, 2); ctx.fill(); }
  }
}

class SideGame {
  constructor(homeAbbr, awayAbbr, homeStr, awayStr) {
    this.home = createSampleTeam(homeAbbr, homeAbbr, homeAbbr, homeStr);
    this.away = createSampleTeam(awayAbbr, awayAbbr, awayAbbr, awayStr);
    this.state = new GameState(this.home, this.away);
    this.engine = new GameEngine(this.state);
    this.lastScorer = ""; this.done = false;
  }
  step() {
    if (this.done || this.state.gameOver) { this.done = true; return; }
    const off = pickOffense("balanced", "Pro Style", "balanced", this.state.down, this.state.yardsToGo);
    const def = pickDefense("balanced", this.state.down, this.state.yardsToGo);
    const result = this.engine.simulatePlay(off, def);
    const status = this.engine.applyResult(result);
    const desc = (status || result.description).toUpperCase();
    if (desc.includes("TOUCHDOWN")) {
      const m = result.description.match(/para ([A-Z][a-zà-ú]+ [A-Z][a-zà-ú]+)/i);
      this.lastScorer = m ? m[1] : (this.state.possession === "home" ? this.home.abbreviation : this.away.abbreviation);
    }
    if (this.state.secondsLeft <= 0) {
      if (this.state.nextQuarter()) this.done = true;
    }
  }
}

/* ─── GameScreen controller ──────────────────────────────────────────────── */

class GameScreenController {
  constructor() {
    this.state = null; this.engine = null;
    this.aggro = "balanced"; this.playbook = "Pro Style"; this.defPlaybook = "4-3"; this.focus = "balanced";
    this.spdInterval = 3000; this.timerHandle = null;
    this.myScorerKey = ""; this.myScorerText = "";
    this.sideGames = []; this.sideCards = []; this.playerCard = null;
    this.soundMgr = null;
    this._bindDom();
  }

  _bindDom() {
    this.scoreboard = new Scoreboard(document.getElementById("scoreboard-canvas"));
    this.cardsScroll = document.getElementById("cards-scroll");
    this.playerSlot = document.getElementById("player-panel-slot");
    this.tipText = document.getElementById("tip-text");

    this.playBtn = document.getElementById("play-btn");
    this.snapBtn = document.getElementById("snap-btn");
    this.playBtn.onclick = () => this.togglePlay();
    this.snapBtn.onclick = () => this.manualSnap();

    document.querySelectorAll(".spd-pill").forEach(btn => {
      btn.onclick = () => this.setSpeed(btn.dataset.key, parseInt(btn.dataset.ms));
    });
    document.querySelectorAll(".aggro-pill").forEach(btn => {
      btn.onclick = () => this.setAggro(btn.dataset.key);
    });
    document.querySelectorAll(".focus-pill").forEach(btn => {
      btn.onclick = () => this.setFocus(btn.dataset.key);
    });
    document.getElementById("back-btn").onclick = () => this.onBack();
  }

  startGame(homeTeam, awayTeam, weekGames = null, options = {}) {
    this.state = new GameState(homeTeam, awayTeam);
    this.engine = new GameEngine(this.state);
    this.myScorerKey = ""; this.myScorerText = "";
    clearInterval(this.timerHandle); this.timerHandle = null;

    // Playbooks escolhidos na tela pré-jogo (ou padrão do time/estado atual)
    if (options.offPlaybook && PLAYBOOKS[options.offPlaybook]) this.playbook = options.offPlaybook;
    else {
      try {
        const pb = homeTeam.playbook?.offensiveStyle;
        if (PLAYBOOKS[pb]) this.playbook = pb;
      } catch {}
    }
    if (options.defPlaybook && DEF_PLAYBOOKS[options.defPlaybook]) this.defPlaybook = options.defPlaybook;
    homeTeam.defPlaybook = this.defPlaybook;

    // Aplica substituições de titulares escolhidas na tela pré-jogo
    if (options.substitutions) {
      for (const [pos, idx] of Object.entries(options.substitutions)) {
        homeTeam.setStarter(pos, idx);
      }
    }

    document.querySelectorAll(".aggro-pill").forEach(b => b.classList.toggle("active", b.dataset.key === this.aggro));
    document.querySelectorAll(".focus-pill").forEach(b => b.classList.toggle("active", b.dataset.key === this.focus));
    this.playBtn.textContent = "▶  Iniciar";

    this.scoreboard.homeAbbr = homeTeam.abbreviation;
    this.scoreboard.awayAbbr = awayTeam.abbreviation;
    const hc = getTeamColor(homeTeam.abbreviation);
    const ac = getTeamColor(awayTeam.abbreviation);
    this.scoreboard.homeColor = hc.primary;
    this.scoreboard.awayColor = ac.primary;
    // Força redimensionamento depois que a tela fica visível (importante no mobile)
    requestAnimationFrame(() => {
      this.scoreboard._resize();
      this.scoreboard.update(this.state);
    });

    this.cardsScroll.innerHTML = "";
    this.playerSlot.innerHTML = "";
    this.playerCard = new PlayerGamePanel(homeTeam.abbreviation, awayTeam.abbreviation);
    this.playerSlot.appendChild(this.playerCard.root);

    this.sideGames = []; this.sideCards = [];
    if (weekGames) {
      for (const g of weekGames) {
        const card = new GameCard(g.home, g.away, false);
        this.cardsScroll.appendChild(card.canvas);
        const side = new SideGame(g.home, g.away, g.homeStr || "medium", g.awayStr || "medium");
        this.sideGames.push(side); this.sideCards.push(card);
      }
    }
    this.refreshUI();
  }

  togglePlay() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle); this.timerHandle = null;
      this.playBtn.textContent = "▶  Continuar";
    } else {
      this.playBtn.textContent = "⏸  Pausar";
      this.timerHandle = setInterval(() => this.tick(), this.spdInterval);
    }
  }
  setSpeed(key, ms) {
    this.spdInterval = ms;
    document.querySelectorAll(".spd-pill").forEach(b => b.classList.toggle("active", b.dataset.key === key));
    if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = setInterval(() => this.tick(), ms); }
  }
  manualSnap() {
    if (this.state && !this.state.gameOver) {
      this.doSnap();
      this.checkInjuryPause();
    }
  }
  setAggro(key) {
    this.aggro = key;
    document.querySelectorAll(".aggro-pill").forEach(b => b.classList.toggle("active", b.dataset.key === key));
    this.updateTip();
  }
  setFocus(key) {
    this.focus = key;
    document.querySelectorAll(".focus-pill").forEach(b => b.classList.toggle("active", b.dataset.key === key));
    this.updateTip();
  }
  onBack() {
    clearInterval(this.timerHandle); this.timerHandle = null;
    showScreen("menu-screen");
    refreshMenuScreen();
  }

  tick() {
    if (!this.state || this.state.gameOver) {
      clearInterval(this.timerHandle); this.timerHandle = null;
      this.onGameOver(); return;
    }
    this.doSnap();
    if (this.checkInjuryPause()) return; // pausa o tick se houve lesão no time do jogador
    // Mantém os jogos paralelos sincronizados com o progresso real do jogo do jogador
    // (tempo total restante na partida), não com contagem fixa de jogadas.
    const myProgress = (this.state.quarter - 1) * 900 + (900 - this.state.secondsLeft);
    for (const side of this.sideGames) {
      if (side.done) continue;
      let guard = 0;
      while (!side.done && guard < 6) {
        const sideProgress = (side.state.quarter - 1) * 900 + (900 - side.state.secondsLeft);
        if (sideProgress >= myProgress) break;
        side.step();
        guard++;
      }
    }
    this.refreshUI();
  }

  doSnap() {
    const state = this.state;
    const playerOff = state.possession === "home";
    let off, def;
    if (playerOff) {
      off = pickOffense(this.aggro, this.playbook, this.focus, state.down, state.yardsToGo);
      def = pickDefense("balanced", state.down, state.yardsToGo, "4-3");
    } else {
      off = pickOffense("balanced", "Pro Style", "balanced", state.down, state.yardsToGo);
      def = pickDefense(this.aggro, state.down, state.yardsToGo, this.defPlaybook);
    }
    const possBefore = state.possession;
    const result = this.engine.simulatePlay(off, def);
    const status = this.engine.applyResult(result);

    if (this.soundMgr) this.soundMgr.playForResult(result.event, result.description, result.turnover, possBefore, status || "");

    const desc = (status || result.description).toUpperCase();
    if (desc.includes("TOUCHDOWN")) {
      const m = result.description.match(/para ([A-Z][a-zà-ú]+ [A-Z][a-zà-ú]+)/i);
      const teamAbbr = possBefore === "home" ? state.homeTeam.abbreviation : state.awayTeam.abbreviation;
      const scorerName = m ? m[1] : teamAbbr;
      this.myScorerKey = `${state.quarter}-${state.secondsLeft}-${scorerName}`;
      this.myScorerText = `🏈 TD ${teamAbbr} — ${scorerName}`;
      this.scoreboard.flashTD();
    } else if (desc.includes("FIELD GOAL") && desc.includes("BOM")) {
      const teamAbbr = possBefore === "home" ? state.homeTeam.abbreviation : state.awayTeam.abbreviation;
      this.myScorerKey = `${state.quarter}-${state.secondsLeft}-FG-${teamAbbr}`;
      this.myScorerText = `🎯 FG ${teamAbbr}`;
    } else if (desc.includes("SAFETY")) {
      const defAbbr = possBefore === "home" ? state.awayTeam.abbreviation : state.homeTeam.abbreviation;
      this.myScorerKey = `${state.quarter}-${state.secondsLeft}-SAFETY-${defAbbr}`;
      this.myScorerText = `⚡ SAFETY ${defAbbr}`;
    } else if (result.event === "interception") {
      const m = result.description.match(/INTERCEPTADO!\s*([A-Z][a-zà-ú]+ [A-Z][a-zà-ú]+)/i);
      const playerName = m ? m[1] : "Defesa";
      const defAbbr = possBefore === "home" ? state.awayTeam.abbreviation : state.homeTeam.abbreviation;
      this.myScorerKey = `${state.quarter}-${state.secondsLeft}-INT`;
      this.myScorerText = `🔵 INT ${defAbbr} — ${playerName}`;
    } else if (result.event === "fumble") {
      const m = result.description.match(/FUMBLE!\s*([A-Z][a-zà-ú]+ [A-Z][a-zà-ú]+)/i);
      const playerName = m ? m[1] : "Jogador";
      const lostAbbr = possBefore === "home" ? state.homeTeam.abbreviation : state.awayTeam.abbreviation;
      this.myScorerKey = `${state.quarter}-${state.secondsLeft}-FUM`;
      this.myScorerText = `🟡 FUMBLE ${lostAbbr} — ${playerName}`;
    }

    if (state.secondsLeft <= 0) {
      const done = state.nextQuarter();
      if (done) { clearInterval(this.timerHandle); this.timerHandle = null; this.onGameOver(); return; }
    }
  }

  refreshUI() {
    if (!this.state) return;
    const s = this.state, home = s.homeTeam, away = s.awayTeam;
    this.scoreboard.update(s);

    if (this.playerCard) {
      this.playerCard.setData(home.score, away.score, s.quarter, s.secondsLeft,
                              this.myScorerKey, this.myScorerText);
      this.playerCard.setStats(home, away);
      this.playerCard.setRoster(home);
    }

    this.sideGames.forEach((side, i) => {
      const card = this.sideCards[i];
      const s2 = side.state;
      card.setData(s2.homeTeam.score, s2.awayTeam.score, s2.quarter, s2.secondsLeft, side.lastScorer);
      if (side.done) card.markDone(s2.homeTeam.score > s2.awayTeam.score);
    });

    this.updateTip();
  }

  updateTip() {
    if (!this.state) return;
    const s = this.state;
    const sd = s.homeTeam.score - s.awayTeam.score;
    let t;
    if (s.ballPosition >= 80) t = `🔴 RED ZONE — ${s.down}ª & ${s.yardsToGo}`;
    else if (s.down === 4) t = `⚠️ 4º DOWN — ${s.yardsToGo} jardas`;
    else if (sd > 7 && s.secondsLeft < 300) t = "💡 Ganhando no fim";
    else if (sd < -7 && s.secondsLeft < 300) t = "💡 Perdendo no fim";
    else t = `${AGGRO_LABELS[this.aggro] || ""}  ·  ${FOCUS_LABELS[this.focus] || ""}`;
    this.tipText.textContent = t;
  }

  /* Verifica se o time do jogador (home) teve uma lesão nova. Se sim, pausa o jogo
     e mostra o modal de substituição. Retorna true se pausou. */
  checkInjuryPause() {
    if (!this.state) return false;
    const injury = this.state.homeTeam.checkForNewInjury();
    if (!injury) return false;

    clearInterval(this.timerHandle); this.timerHandle = null;
    this.playBtn.textContent = "▶  Continuar";
    this.showInjuryModal(injury.position, injury.player);
    return true;
  }

  showInjuryModal(position, player) {
    const team = this.state.homeTeam;
    const players = team.getAllAtPosition(position);
    const currentIdx = team.activeStarter[position];

    let modal = document.getElementById("injury-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "injury-modal";
      modal.className = "modal-overlay active";
      document.body.appendChild(modal);
    }
    modal.classList.add("active");

    const optionsHtml = players.map((p, idx) => {
      if (idx === currentIdx) return "";
      const fatigueLabel = p.fatigue > 50 ? ` · fadiga ${p.fatigue}%` : "";
      return `<button class="injury-option-btn" data-idx="${idx}">
        <span class="io-name">${p.name}</span>
        <span class="io-ovr ${ovrColorClass(p.overall)}">${p.overall} OVR${fatigueLabel}</span>
      </button>`;
    }).join("");

    modal.innerHTML = `
      <div class="modal-box injury-box">
        <div class="injury-icon">🚑</div>
        <div class="modal-title" style="text-align:center;">${player.name} se machucou!</div>
        <div class="injury-sub">Posição: ${position} — escolha quem entra no lugar dele</div>
        <div class="injury-options">${optionsHtml}</div>
      </div>`;

    modal.querySelectorAll(".injury-option-btn").forEach(btn => {
      btn.onclick = () => {
        team.substitute(position, parseInt(btn.dataset.idx));
        modal.classList.remove("active");
        this.refreshUI();
        // Retoma o jogo automaticamente após substituição
        if (!this.state.gameOver && !this.timerHandle) {
          this.timerHandle = setInterval(() => this.tick(), this.spdInterval);
        }
      };
    });
  }

  onGameOver() {
    if (!this.state) return;
    const h = this.state.homeTeam, a = this.state.awayTeam;
    if (this.playerCard) this.playerCard.markDone(h.score > a.score);
    this.playBtn.style.display = "none";
    this.snapBtn.style.display = "none";
    this.showMatchSummary(h, a);
  }

  showMatchSummary(homeTeam, awayTeam) {
    const won = homeTeam.score > awayTeam.score;
    const tied = homeTeam.score === awayTeam.score;
    const result = won ? "VITÓRIA" : tied ? "EMPATE" : "DERROTA";
    const resultColor = won ? "#3fb950" : tied ? "#e8a020" : "#f85149";

    // Coleta pontuadores do histórico
    const scorers = this.playerCard?.scorerHistory || [];

    // Coleta lesões do jogo
    const injuries = [];
    for (const players of Object.values(homeTeam.roster)) {
      for (const p of players) {
        if (p.injured) injuries.push(`${p.name} (${p.position}) — ${homeTeam.abbreviation}`);
      }
    }
    for (const players of Object.values(awayTeam.roster)) {
      for (const p of players) {
        if (p.injured) injuries.push(`${p.name} (${p.position}) — ${awayTeam.abbreviation}`);
      }
    }

    // MVP
    const mvp = getTeamMVP(homeTeam);
    const mvpStats = mvp && mvp.mvpScore() > 0 ? formatPlayerStats(mvp) : null;

    // Cria modal
    let overlay = document.getElementById("match-summary-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "match-summary-overlay";
      overlay.className = "summary-overlay";
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="summary-modal">
        <div class="summary-result" style="color:${resultColor}">${result}</div>
        <div class="summary-score">
          <div class="summary-team-block">
            <div class="summary-abbr">${homeTeam.abbreviation}</div>
            <div class="summary-pts">${homeTeam.score}</div>
          </div>
          <div class="summary-x">×</div>
          <div class="summary-team-block">
            <div class="summary-abbr">${awayTeam.abbreviation}</div>
            <div class="summary-pts">${awayTeam.score}</div>
          </div>
        </div>

        <div class="summary-sections">
          ${scorers.length ? `
            <div class="summary-section">
              <div class="summary-section-title">🏈  Pontuação</div>
              ${[...scorers].reverse().map(s =>
                `<div class="summary-item">${s.text}<span class="summary-time">Q${s.quarter} ${s.time}</span></div>`
              ).join("")}
            </div>` : ""}

          ${injuries.length ? `
            <div class="summary-section">
              <div class="summary-section-title">🚑  Lesões</div>
              ${injuries.map(i => `<div class="summary-item injury">${i}</div>`).join("")}
            </div>` : ""}

          ${mvpStats ? `
            <div class="summary-section mvp-section">
              <div class="summary-section-title">⭐  MVP da Partida</div>
              <div class="summary-mvp">
                <div class="summary-mvp-name ${ovrColorClass(mvp.overall)}">${mvp.name}</div>
                <div class="summary-mvp-pos">${mvp.position} · ${mvp.overall} OVR</div>
                <div class="summary-mvp-stats">${mvpStats}</div>
              </div>
            </div>` : ""}
        </div>

        <button class="btn btn-primary summary-continue-btn" id="summary-continue-btn">
          ${won ? "🏆  Continuar  →" : "Continuar  →"}
        </button>
      </div>`;

    overlay.style.display = "flex";
    document.getElementById("summary-continue-btn").onclick = () => {
      overlay.style.display = "none";
      if (window.onGameFinished) window.onGameFinished(homeTeam.score, awayTeam.score);
    };
  }

  showContinueButton(homeScore, awayScore) {
    // Mantido para compatibilidade com multiplayer
    if (window.onGameFinished) window.onGameFinished(homeScore, awayScore);
  }
}
