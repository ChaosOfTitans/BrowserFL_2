/* app.js — Orquestração geral: menu, navegação, temporada, editor */

const TEAM_KEY = "gridiron_my_team";

const NFL_TEAMS_FLAT = [
  ["Ravens","Baltimore","BAL"],["Steelers","Pittsburgh","PIT"],["Browns","Cleveland","CLE"],["Bengals","Cincinnati","CIN"],
  ["Texans","Houston","HOU"],["Colts","Indianapolis","IND"],["Titans","Tennessee","TEN"],["Jaguars","Jacksonville","JAC"],
  ["Patriots","New England","NE"],["Bills","Buffalo","BUF"],["Dolphins","Miami","MIA"],["Jets","New York","NYJ"],
  ["Chiefs","Kansas City","KC"],["Raiders","Las Vegas","LV"],["Chargers","Los Angeles","LAC"],["Broncos","Denver","DEN"],
  ["Packers","Green Bay","GB"],["Vikings","Minnesota","MIN"],["Bears","Chicago","CHI"],["Lions","Detroit","DET"],
  ["Saints","New Orleans","NO"],["Buccaneers","Tampa Bay","TB"],["Falcons","Atlanta","ATL"],["Panthers","Carolina","CAR"],
  ["Cowboys","Dallas","DAL"],["Eagles","Philadelphia","PHI"],["Giants","New York","NYG"],["Commanders","Washington","WAS"],
  ["49ers","San Francisco","SF"],["Seahawks","Seattle","SEA"],["Rams","Los Angeles","LAR"],["Cardinals","Arizona","ARI"],
];

function loadMyTeam() {
  const raw = localStorage.getItem(TEAM_KEY);
  if (!raw) return { name:"Eagles", city:"Philadelphia", abbreviation:"PHI", isCustom:false };
  try { return JSON.parse(raw); } catch { return { name:"Eagles", city:"Philadelphia", abbreviation:"PHI", isCustom:false }; }
}
function saveMyTeam(team) { localStorage.setItem(TEAM_KEY, JSON.stringify(team)); }

function getAllTeams() {
  const teams = [];
  const my = loadMyTeam();
  if (my.isCustom) teams.push({ ...my, isCustom: true });
  for (const [n,c,a] of NFL_TEAMS_FLAT) teams.push({ name:n, city:c, abbreviation:a, isCustom:false });
  return teams;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ─── Menu Screen ─────────────────────────────────────────────────────────── */

function refreshMenuScreen() {
  const team = loadMyTeam();
  document.getElementById("menu-team-name").innerHTML =
    `Time:  <span class="accent">${team.city} ${team.name} (${team.abbreviation})</span>`;

  const saves = listSaves();
  const saveIds = Object.keys(saves);
  const seasonCard = document.getElementById("season-card-info");
  if (saveIds.length > 0) {
    const s = saves[saveIds[0]];
    const t = s.teams[s.playerTeam] || {};
    document.getElementById("season-card-title").textContent = "CONTINUAR TEMPORADA";
    seasonCard.textContent = `📅 Semana ${s.currentWeek}/17  •  ${t.wins||0}-${t.losses||0}`;
  } else {
    document.getElementById("season-card-title").textContent = "NOVA TEMPORADA";
    seasonCard.textContent = "Nenhuma temporada ativa";
  }

  document.getElementById("editor-card-info").textContent = `${team.city} ${team.name}  (${team.abbreviation})`;
}

function startFriendly() {
  const myTeam = loadMyTeam();
  const home = createSampleTeam(myTeam.name, myTeam.city, myTeam.abbreviation, "strong");

  const pool = NFL_TEAMS_FLAT.filter(([,,a]) => a !== myTeam.abbreviation);
  const [n,c,a] = choice(pool);
  const strengths = ["weak","medium","medium","strong"];
  const away = createSampleTeam(n, c, a, choice(strengths));

  const used = new Set([myTeam.abbreviation, a]);
  const remaining = NFL_TEAMS_FLAT.filter(([,,ab]) => !used.has(ab));
  shuffle(remaining);
  const weekGames = [];
  for (let i = 0; i < Math.min(remaining.length - 1, 12); i += 2) {
    weekGames.push({
      home: remaining[i][2], away: remaining[i+1][2],
      homeStr: choice(["weak","medium","strong"]),
      awayStr: choice(["weak","medium","strong"]),
    });
  }

  window.onGameFinished = function(homeScore, awayScore) {
    showScreen("menu-screen");
    refreshMenuScreen();
  };

  gameScreen.startGame(home, away, weekGames);
  showScreen("game-screen");
}

window.onGameFinished = function() {};

/* ─── Season Select Screen ───────────────────────────────────────────────── */

function refreshSeasonSelectScreen() {
  const saves = listSaves();
  const list = document.getElementById("ss-list");
  list.innerHTML = "";
  const ids = Object.keys(saves);

  if (ids.length === 0) {
    list.innerHTML = `<div class="ss-empty">Nenhuma temporada salva.<br>Clique em  ＋ Nova Temporada  para começar.</div>`;
    return;
  }

  const phaseLabels = { regular:"Semana", wildcard:"Wild Card", divisional:"Divisional", conference:"Conf. Champ", superbowl:"Super Bowl", ended:"Encerrada 🏆" };

  for (const id of ids) {
    const s = saves[id];
    const t = s.teams[s.playerTeam] || {};
    const phaseStr = s.phase === "regular" ? `Semana ${s.currentWeek}/17` : (phaseLabels[s.phase] || s.phase);

    const card = document.createElement("div");
    card.className = "save-card";
    card.innerHTML = `
      <div class="info">
        <div class="name">${s.saveName}</div>
        <div class="detail">${t.city||""} ${s.playerTeam}  ·  ${t.wins||0}-${t.losses||0}  ·  ${phaseStr}  ·  ${s.year}</div>
        <div class="created">Criado em ${s.createdAt}</div>
      </div>
      <div class="actions">
        <button class="btn btn-primary">▶  Jogar</button>
        <button class="btn btn-danger">Deletar</button>
      </div>`;
    card.querySelector(".btn-primary").onclick = () => loadSeasonAndGo(id);
    card.querySelector(".btn-danger").onclick = () => {
      if (confirm(`Deletar '${s.saveName}'? Esta ação não pode ser desfeita.`)) {
        deleteSave(id);
        refreshSeasonSelectScreen();
      }
    };
    list.appendChild(card);
  }
}

let currentSaveId = null;
let currentSeason = null;

function loadSeasonAndGo(saveId) {
  currentSaveId = saveId;
  currentSeason = loadSeasonFromStorage(saveId);
  showScreen("season-screen");
  refreshSeasonScreen();
}

/* ─── Modal Nova Temporada ────────────────────────────────────────────────── */

let selectedNewTeam = null;

function openNewSeasonModal() {
  selectedNewTeam = null;
  document.getElementById("ns-name").value = `Temporada ${new Date().toLocaleDateString("pt-BR")}`;
  document.getElementById("ns-year").value = "2025";
  document.getElementById("ns-selection").textContent = "Nenhum time selecionado";
  document.getElementById("ns-selection").className = "modal-selection";
  document.getElementById("ns-confirm").disabled = true;

  const grid = document.getElementById("ns-team-grid");
  grid.innerHTML = "";
  const teams = getAllTeams();
  teams.forEach((team, idx) => {
    const btn = document.createElement("div");
    btn.className = "team-btn" + (team.isCustom ? " custom" : "");
    btn.innerHTML = `${team.abbreviation}<span class="city">${team.city}</span>`;
    btn.onclick = () => {
      grid.querySelectorAll(".team-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedNewTeam = team;
      const sel = document.getElementById("ns-selection");
      sel.textContent = `✓  ${team.city} ${team.name} (${team.abbreviation})`;
      sel.className = "modal-selection selected";
      document.getElementById("ns-confirm").disabled = false;
    };
    grid.appendChild(btn);
  });

  document.getElementById("new-season-modal").classList.add("active");
}

function closeNewSeasonModal() {
  document.getElementById("new-season-modal").classList.remove("active");
}

function confirmNewSeason() {
  if (!selectedNewTeam) return;
  const name = document.getElementById("ns-name").value.trim() || "Nova Temporada";
  const year = parseInt(document.getElementById("ns-year").value) || 2025;

  const season = buildSeason(selectedNewTeam.abbreviation, selectedNewTeam.name, selectedNewTeam.city);
  season.year = year;

  const saveId = "save_" + Date.now();
  saveSeasonToStorage(saveId, season, name);

  closeNewSeasonModal();
  refreshSeasonSelectScreen();
}

/* ─── Season Screen ───────────────────────────────────────────────────────── */

let seasonTab = "matchup";

function refreshSeasonScreen() {
  if (!currentSeason) return;
  const s = currentSeason;
  document.getElementById("season-screen-title").textContent =
    `${s.teams[s.playerTeam]?.city || ""} ${s.playerTeam}  —  ${s.year}`;
  renderSeasonTab();
}

function setSeasonTab(tab) {
  seasonTab = tab;
  document.querySelectorAll(".season-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  renderSeasonTab();
}

function getPlayerSeasonStats(season, abbr) {
  const games = season.schedule.filter(g =>
    (g.home === abbr || g.away === abbr) && g.played
  );
  const wins = games.filter(g => {
    const isHome = g.home === abbr;
    return isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
  }).length;
  const losses = games.length - wins;
  const pf = games.reduce((sum, g) => sum + (g.home === abbr ? g.homeScore : g.awayScore), 0);
  const pa = games.reduce((sum, g) => sum + (g.home === abbr ? g.awayScore : g.homeScore), 0);
  const avgPf = games.length ? (pf / games.length).toFixed(1) : "—";
  const avgPa = games.length ? (pa / games.length).toFixed(1) : "—";
  // TDs estimados: pontos / 7 (simplificação, já que campo sabemos PF mas não breakdown)
  const estTDs = Math.round(pf / 7);
  const estFGs = Math.max(0, Math.round((pf - estTDs * 7) / 3));
  return { games: games.length, wins, losses, pf, pa, avgPf, avgPa, estTDs, estFGs };
}

function getRecentForm(season, abbr, weeksBack = 5) {
  const games = season.schedule.filter(g =>
    (g.home === abbr || g.away === abbr) && g.played && g.week < season.currentWeek
  ).sort((a,b) => b.week - a.week).slice(0, weeksBack);
  return games.map(g => {
    const isHome = g.home === abbr;
    const myScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    return myScore > oppScore ? "win" : "loss";
  }).reverse();
}

function getHeadToHead(season, abbrA, abbrB) {
  return season.schedule.find(g =>
    g.played && ((g.home === abbrA && g.away === abbrB) || (g.home === abbrB && g.away === abbrA))
  );
}

// Estado persistente entre re-renders da aba de matchup (escolhas do jogador antes do jogo)
let matchupState = { offPlaybook: "Pro Style", defPlaybook: "4-3", myTeamFull: null, weekKey: null, offExpanded: false, defExpanded: false };

function renderMatchupTab(content, s) {
  const game = s.schedule.find(g => g.week === s.currentWeek && g.isPlayerGame && !g.played);

  if (!game) {
    content.innerHTML = `<div class="ss-empty">Nenhum jogo pendente nesta semana.<br>Veja o Calendário para mais detalhes.</div>`;
    return;
  }

  const isHome = game.home === s.playerTeam;
  const myRecord = s.teams[s.playerTeam];
  const oppAbbr = isHome ? game.away : game.home;
  const oppRecord = s.teams[oppAbbr];

  const myWinProb = Math.round(100 * myRecord.strength / (myRecord.strength + oppRecord.strength));
  const oppWinProb = 100 - myWinProb;

  const myForm = getRecentForm(s, s.playerTeam);
  const oppForm = getRecentForm(s, oppAbbr);
  const h2h = getHeadToHead(s, s.playerTeam, oppAbbr);

  const divTeams = s.getStandings(myRecord.conference, myRecord.division);
  const divPos = divTeams.findIndex(t => t.abbreviation === s.playerTeam) + 1;
  const playoffSeeds = s.getPlayoffSeeds(myRecord.conference).map(t => t.abbreviation);
  const inPlayoffPicture = playoffSeeds.includes(s.playerTeam);
  const weeksLeft = 18 - s.currentWeek;

  // Mantém o mesmo elenco (com eventuais trocas) enquanto for a mesma semana
  const weekKey = `${s.currentWeek}-${s.playerTeam}`;
  if (matchupState.weekKey !== weekKey || !matchupState.myTeamFull) {
    if (myRecord.roster) {
      matchupState.myTeamFull = rosterToTeam(myRecord.name, myRecord.abbreviation, myRecord.city, myRecord.roster);
    } else {
      matchupState.myTeamFull = createSampleTeam(myRecord.name, myRecord.city, myRecord.abbreviation, "strong");
    }
    matchupState.weekKey = weekKey;
  }
  const myTeamFull = matchupState.myTeamFull;

  // Pré-calcula o HTML do melhor jogador da temporada (não pode ser IIFE dentro de template literal)
  let seasonMVPHtml = "";
  if (myRecord.seasonMVPs && myRecord.seasonMVPs.length > 0) {
    const byPlayer = {};
    for (const entry of myRecord.seasonMVPs) {
      if (!byPlayer[entry.name]) byPlayer[entry.name] = { ...entry, totalScore: 0, appearances: 0, bestStats: entry.stats };
      byPlayer[entry.name].totalScore += entry.score;
      byPlayer[entry.name].appearances += 1;
      if (entry.score > byPlayer[entry.name].score) byPlayer[entry.name].bestStats = entry.stats;
    }
    const best = Object.values(byPlayer).sort((a,b) => b.totalScore - a.totalScore)[0];
    seasonMVPHtml = `
      <div class="section-title centered">⭐  Melhor Jogador da Temporada</div>
      <div class="season-mvp-card">
        <div class="smvp-icon">⭐</div>
        <div class="smvp-info">
          <div class="smvp-name ${ovrColorClass(best.ovr)}">${best.name}</div>
          <div class="smvp-pos">${best.pos}  ·  <span class="${ovrColorClass(best.ovr)}">${best.ovr} OVR</span>  ·  MVP em ${best.appearances} jogo${best.appearances !== 1 ? "s" : ""}</div>
          <div class="smvp-stats">Melhor jogo: ${best.bestStats}</div>
        </div>
      </div>`;
  }

  const formPills = (form) => form.map(r =>
    `<div class="pill-result ${r}">${r === "win" ? "V" : "D"}</div>`).join("");


  const rosterHtml = (team) => {
    const order = ["QB","RB","WR","TE","OL","DE","DT","LB","CB","S","K"];
    const curIdxOf = (pos) => team.activeStarter[pos] ?? 0;
    return order.map(pos => {
      const players = team.getAllAtPosition(pos);
      if (!players.length) return "";
      const curIdx = curIdxOf(pos);
      const rows = players.map((p, idx) => {
        const isStarter = idx === curIdx;
        return `<div class="roster-row ${isStarter ? "is-starter" : "is-backup"}" data-pos="${pos}" data-idx="${idx}">
          <span class="pos">${isStarter ? pos : ""}</span>
          <span class="role-tag">${isStarter ? "TITULAR" : "RESERVA"}</span>
          <span class="name">${p.name}</span>
          <span class="ovr ${ovrColorClass(p.overall)}">${p.overall}</span>
          ${!isStarter ? `<button class="roster-swap-btn" data-pos="${pos}" data-idx="${idx}" title="Colocar ${p.name} como titular">⇄</button>` : ""}
        </div>`;
      }).join("");
      return `<div class="roster-pos-group">${rows}</div>`;
    }).join("");
  };

  const playbookPicker = (info, current, prefix, expanded) => {
    const selectedData = info[current];
    const selectedCard = `
      <div class="pb-card selected pb-card-current" data-${prefix}-toggle="1">
        <div class="pb-card-icon">${selectedData.icon}</div>
        <div class="pb-card-name">${current}</div>
        <div class="pb-card-desc">${selectedData.desc}</div>
        <div class="pb-card-hint">${expanded ? "▲ fechar" : "▼ trocar"}</div>
      </div>`;
    if (!expanded) return selectedCard;

    const otherCards = Object.entries(info)
      .filter(([name]) => name !== current)
      .map(([name, data]) => `
        <div class="pb-card" data-${prefix}="${name}">
          <div class="pb-card-icon">${data.icon}</div>
          <div class="pb-card-name">${name}</div>
          <div class="pb-card-desc">${data.desc}</div>
        </div>`).join("");
    return selectedCard + otherCards;
  };

  content.innerHTML = `
    <div class="matchup-wrap">
      <button class="btn btn-primary play-week-top-btn" id="play-matchup-btn">
        ▶  Jogar Semana ${s.currentWeek}
      </button>

      <div class="matchup-header">
        <div class="matchup-team home">
          <div class="abbr">${myRecord.abbreviation}</div>
          <div class="city">${myRecord.city} ${myRecord.name}</div>
          <div class="record">${myRecord.recordStr}</div>
        </div>
        <div class="matchup-vs">${isHome ? "VS" : "@"}</div>
        <div class="matchup-team away">
          <div class="abbr">${oppRecord.abbreviation}</div>
          <div class="city">${oppRecord.city} ${oppRecord.name}</div>
          <div class="record">${oppRecord.recordStr}</div>
        </div>
      </div>
      <div class="matchup-prob">
        🎲  Probabilidade de vitória:  <span class="pct">${myWinProb}%</span>  vs  ${oppWinProb}%
        ${h2h ? `<br>🔁  Confronto anterior nesta temporada: ${h2h.homeScore} – ${h2h.awayScore}` : ""}
      </div>

      <div class="context-grid">
        <div class="context-card">
          <div class="card-icon">📍</div>
          <div class="label">Posição na Divisão</div>
          <div class="value">${divPos}º de ${divTeams.length}</div>
          <div class="sub">${myRecord.division} — ${myRecord.conference}</div>
        </div>
        <div class="context-card ${inPlayoffPicture ? "playoff-in" : "playoff-out"}">
          <div class="card-icon">${inPlayoffPicture ? "✅" : "⚠️"}</div>
          <div class="label">Situação de Playoff</div>
          <div class="value">${inPlayoffPicture ? "Classificado" : "Fora da zona"}</div>
          <div class="sub">se a temporada acabasse hoje</div>
        </div>
        <div class="context-card">
          <div class="card-icon">📅</div>
          <div class="label">Semanas Restantes</div>
          <div class="value">${weeksLeft}</div>
          <div class="sub">temporada regular</div>
        </div>
      </div>

      ${myRecord.seasonGames > 0 ? `
      <div class="section-title centered">📊  Estatísticas da Temporada — ${myRecord.abbreviation}</div>
      <div class="season-stats-grid">
        <div class="season-stat-card">
          <div class="ss-val">${myRecord.seasonTDs}</div>
          <div class="ss-label">Touchdowns</div>
        </div>
        <div class="season-stat-card">
          <div class="ss-val">${myRecord.seasonFGs}</div>
          <div class="ss-label">Field Goals</div>
        </div>
        <div class="season-stat-card">
          <div class="ss-val">${myRecord.seasonTotalYards}</div>
          <div class="ss-label">Jardas Totais</div>
        </div>
        <div class="season-stat-card">
          <div class="ss-val">${myRecord.seasonPassYards}</div>
          <div class="ss-label">Jardas Passe</div>
        </div>
        <div class="season-stat-card">
          <div class="ss-val">${myRecord.seasonRushYards}</div>
          <div class="ss-label">Jardas Corrida</div>
        </div>
        <div class="season-stat-card">
          <div class="ss-val">${myRecord.seasonFirstDowns}</div>
          <div class="ss-label">1st Downs</div>
        </div>
        <div class="season-stat-card">
          <div class="ss-val">${myRecord.seasonTurnovers}</div>
          <div class="ss-label">Turnovers</div>
        </div>
        <div class="season-stat-card">
          <div class="ss-val">${myRecord.seasonGames > 0 ? (myRecord.pointsFor / myRecord.seasonGames).toFixed(1) : "—"}</div>
          <div class="ss-label">Pontos/Jogo</div>
        </div>
      </div>` : ""}

      ${seasonMVPHtml}

      <div class="section-title centered">📈  Forma recente</div>
      <div class="context-grid">
        <div class="context-card">
          <div class="label">${myRecord.abbreviation} — últimos jogos</div>
          <div class="opp-recent centered">${myForm.length ? formPills(myForm) : '<span style="color:var(--muted);font-size:11px;">Sem jogos ainda</span>'}</div>
        </div>
        <div class="context-card">
          <div class="label">${oppRecord.abbreviation} — últimos jogos</div>
          <div class="opp-recent centered">${oppForm.length ? formPills(oppForm) : '<span style="color:var(--muted);font-size:11px;">Sem jogos ainda</span>'}</div>
        </div>
      </div>

      <div class="pb-row">
        <div class="pb-col">
          <div class="section-title centered">🎯  Ataque</div>
          <div class="pb-grid ${matchupState.offExpanded ? "" : "collapsed"}" id="off-pb-grid">${playbookPicker(OFFENSE_PLAYBOOK_INFO, matchupState.offPlaybook, "off", matchupState.offExpanded)}</div>
        </div>
        <div class="pb-col">
          <div class="section-title centered">🛡️  Defesa</div>
          <div class="pb-grid ${matchupState.defExpanded ? "" : "collapsed"}" id="def-pb-grid">${playbookPicker(DEFENSE_PLAYBOOK_INFO, matchupState.defPlaybook, "def", matchupState.defExpanded)}</div>
        </div>
      </div>

      <div class="section-title centered">🏈  Escalação — ${myRecord.abbreviation}</div>
      <div class="field-lineup-wrap">
        <canvas id="field-canvas" class="field-canvas"></canvas>
        <div class="field-sidebar" id="field-sidebar">
          <div class="sidebar-title">Clique em uma posição para trocar</div>
          <div id="sidebar-player-list"></div>
        </div>
      </div>

      <div style="height:24px;"></div>
    </div>
  `;

  document.getElementById("play-matchup-btn").onclick = () => playSeasonGame();

  // Inicializa o campo desenhado após o DOM estar pronto
  requestAnimationFrame(() => {
    initFieldCanvas();
    drawField(myTeamFull);
    renderFullSidebar();
  });

  document.getElementById("off-pb-grid").querySelectorAll("[data-off-toggle]").forEach(card => {
    card.onclick = () => {
      matchupState.offExpanded = !matchupState.offExpanded;
      renderMatchupTab(content, s);
    };
  });
  document.getElementById("off-pb-grid").querySelectorAll("[data-off]").forEach(card => {
    card.onclick = () => {
      matchupState.offPlaybook = card.dataset.off;
      matchupState.offExpanded = false;
      renderMatchupTab(content, s);
    };
  });
  document.getElementById("def-pb-grid").querySelectorAll("[data-def-toggle]").forEach(card => {
    card.onclick = () => {
      matchupState.defExpanded = !matchupState.defExpanded;
      renderMatchupTab(content, s);
    };
  });
  document.getElementById("def-pb-grid").querySelectorAll("[data-def]").forEach(card => {
    card.onclick = () => {
      matchupState.defPlaybook = card.dataset.def;
      matchupState.defExpanded = false;
      renderMatchupTab(content, s);
    };
  });
  document.querySelectorAll(".roster-swap-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const pos = btn.dataset.pos;
      const idx = parseInt(btn.dataset.idx);
      myTeamFull.substitute(pos, idx);
      renderMatchupTab(content, s);
    };
  });
}

/* ─── Campo de futebol americano visual ───────────────────────────────────── */

// Layout das posições no campo (x%, y% dentro do canvas)
// Posições no campo — y cresce para baixo, ataque em baixo, defesa em cima
// OL na frente do QB, K no canto inferior, bem espaçado
const FIELD_POSITIONS = {
  // ── Defesa (topo) ──
  CB:  { x:10, y:8,  label:"CB" },
  S:   { x:33, y:12, label:"S"  },
  S2:  { x:67, y:12, label:"S"  },
  CB2: { x:90, y:8,  label:"CB" },
  LB:  { x:33, y:24, label:"LB" },
  LB2: { x:67, y:24, label:"LB" },
  DE:  { x:22, y:35, label:"DE" },
  DT:  { x:50, y:34, label:"DT" },
  DE2: { x:78, y:35, label:"DE" },
  // ── Linha de scrimmage ~46% ──
  // ── Ataque (baixo) ──
  WR:  { x:10, y:55, label:"WR" },
  TE:  { x:72, y:57, label:"TE" },
  WR2: { x:90, y:55, label:"WR" },
  OL:  { x:50, y:57, label:"OL" },
  QB:  { x:50, y:67, label:"QB" },
  RB:  { x:50, y:78, label:"RB" },
  // K no canto inferior direito
  K:   { x:88, y:88, label:"K"  },
};

let fieldActivePos = null;
let fieldTeam = null;

function drawField(team) {
  fieldTeam = team;
  const canvas = document.getElementById("field-canvas");
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) { requestAnimationFrame(() => drawField(team)); return; }
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;

  // ── Fundo do campo ──────────────────────────────────────────────────────────
  const fieldGrad = ctx.createLinearGradient(0, 0, 0, H);
  fieldGrad.addColorStop(0,   "#162a16");
  fieldGrad.addColorStop(0.5, "#1a3d1a");
  fieldGrad.addColorStop(1,   "#162a16");
  ctx.fillStyle = fieldGrad;
  roundRectField(ctx, 0, 0, W, H, 14);
  ctx.fill();

  // Listras do campo (alternadas)
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, H * i / 10, W, H / 10);
    }
  }

  // Linha de scrimmage
  const scrimmageY = H * 0.52;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(12, scrimmageY); ctx.lineTo(W-12, scrimmageY); ctx.stroke();
  ctx.setLineDash([]);

  // Labels DEF / ATQ
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.floor(W*0.04)}px Segoe UI`;
  ctx.fillStyle = "rgba(77,157,224,0.35)";
  ctx.fillText("DEF", 14, H * 0.25);
  ctx.fillStyle = "rgba(232,160,32,0.35)";
  ctx.fillText("ATQ", 14, H * 0.72);

  // ── Círculos de posição ──────────────────────────────────────────────────────
  const R = Math.min(W * 0.055, H * 0.07, 28); // raio fixo, não muito grande
  const posOrder = ["WR","OL","QB","TE","WR2","RB","K","DE","DT","DE2","LB","LB2","CB","S","S2","CB2"];
  for (const key of posOrder) {
    const def = FIELD_POSITIONS[key];
    if (!def) continue;

    const basePos = def.label;
    const posPlayers = team.getAllAtPosition(basePos);
    const isDup = key.endsWith("2");
    const playerIdx = isDup ? 1 : 0;
    const p = posPlayers[playerIdx] || posPlayers[0];
    if (!p) continue;

    const px = W * def.x / 100;
    const py = H * def.y / 100;
    const isActive = fieldActivePos === key;
    const isDefense = ["DE","DT","DE2","LB","LB2","CB","CB2","S","S2"].includes(key);
    const color = isDefense ? "#4d9de0" : "#e8a020";
    const colorRgb = isDefense ? "77,157,224" : "232,160,32";

    // Sombra sutil
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur  = isActive ? 10 : 4;

    // Círculo
    ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI*2);
    ctx.fillStyle = isActive ? color : `rgba(${colorRgb},0.22)`;
    ctx.fill();
    ctx.strokeStyle = isActive ? "#fff" : color;
    ctx.lineWidth   = isActive ? 2.5 : 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Posição (cima)
    ctx.fillStyle = isActive ? "#0d1117" : color;
    ctx.font = `bold ${Math.floor(R * 0.62)}px Segoe UI`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(def.label, px, py - R * 0.22);

    // Sobrenome (baixo)
    const lastName = p.name.split(" ").pop().substring(0, 8);
    ctx.fillStyle = isActive ? "#0d1117" : "rgba(255,255,255,0.88)";
    ctx.font = `${Math.floor(R * 0.52)}px Segoe UI`;
    ctx.fillText(lastName, px, py + R * 0.32);
  }
}

function roundRectField(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function onFieldClick(e) {
  const canvas = document.getElementById("field-canvas");
  if (!canvas || !fieldTeam) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const W = rect.width, H = rect.height;
  const R = Math.min(W * 0.055, H * 0.07, 28);

  for (const [key, def] of Object.entries(FIELD_POSITIONS)) {
    const px = W * def.x / 100;
    const py = H * def.y / 100;
    const dist = Math.sqrt((mx-px)**2 + (my-py)**2);
    if (dist <= R * 1.4) {
      fieldActivePos = key;
      drawField(fieldTeam);
      showFieldSidebar(key, def.label);
      // Botão voltar ao elenco completo
      const listEl = document.getElementById("sidebar-player-list");
      if (listEl) {
        const back = document.createElement("div");
        back.style.cssText = "margin-top:12px;text-align:center;";
        back.innerHTML = `<button class="btn btn-ghost" style="font-size:11px;height:30px;" onclick="fieldActivePos=null;drawField(fieldTeam);renderFullSidebar();">← Ver elenco completo</button>`;
        listEl.appendChild(back);
      }
      return;
    }
  }
  // Clique fora de qualquer posição → volta ao elenco completo
  fieldActivePos = null;
  drawField(fieldTeam);
  renderFullSidebar();
}

function showFieldSidebar(posKey, posLabel) {
  if (!fieldTeam) return;
  const players = fieldTeam.getAllAtPosition(posLabel);
  const curIdx  = fieldTeam.activeStarter[posLabel] ?? 0;
  const listEl  = document.getElementById("sidebar-player-list");
  const titleEl = document.querySelector(".sidebar-title");
  if (titleEl) titleEl.textContent = `${posLabel} — toque para escalar como titular`;

  listEl.innerHTML = players.map((p, idx) => {
    const isTitular = idx === curIdx;
    return `<div class="field-sidebar-player ${isTitular ? "current" : ""}"
      onclick="selectFieldPlayer('${posLabel}',${idx},'${posKey}')">
      <span class="fsp-ovr ${ovrColorClass(p.overall)}">${p.overall}</span>
      <div class="fsp-details">
        <span class="fsp-name">${p.name}</span>
        <span class="fsp-role">${isTitular ? "TITULAR" : "RESERVA"}</span>
      </div>
      ${!isTitular ? `<button class="fsp-btn" onclick="event.stopPropagation();selectFieldPlayer('${posLabel}',${idx},'${posKey}')">Escalar</button>` : '<span class="fsp-check">✓</span>'}
    </div>`;
  }).join("") || `<div style="color:var(--muted);font-size:12px;padding:8px;">Sem jogadores nesta posição</div>`;
}

function renderFullSidebar() {
  // Mostra todos os jogadores agrupados por posição no sidebar
  if (!fieldTeam) return;
  const listEl  = document.getElementById("sidebar-player-list");
  const titleEl = document.querySelector(".sidebar-title");
  if (titleEl) titleEl.textContent = "Elenco completo — clique para selecionar";
  if (!listEl) return;

  const order = ["QB","RB","WR","TE","OL","DE","DT","LB","CB","S","K"];
  listEl.innerHTML = order.map(pos => {
    const players = fieldTeam.getAllAtPosition(pos);
    if (!players.length) return "";
    const curIdx = fieldTeam.activeStarter[pos] ?? 0;
    return `<div class="fsl-group">
      <div class="fsl-pos-label">${pos}</div>
      ${players.map((p, idx) => {
        const isTitular = idx === curIdx;
        const posKey = idx === 1 && ["WR","DE","LB","CB","S"].includes(pos) ? pos+"2" : pos;
        return `<div class="field-sidebar-player ${isTitular ? "current" : ""}"
          onclick="selectAndHighlight('${pos}','${posKey}',${idx})">
          <span class="fsp-ovr ${ovrColorClass(p.overall)}">${p.overall}</span>
          <div class="fsp-details">
            <span class="fsp-name">${p.name}</span>
            <span class="fsp-role">${isTitular ? "TITULAR" : "RESERVA"}</span>
          </div>
          ${!isTitular ? `<button class="fsp-btn" onclick="event.stopPropagation();selectFieldPlayer('${pos}',${idx},'${posKey}')">↑</button>` : '<span class="fsp-check">✓</span>'}
        </div>`;
      }).join("")}
    </div>`;
  }).join("");
}

function selectAndHighlight(posLabel, posKey, idx) {
  // Clique no sidebar: destaca no campo e mostra a posição
  fieldActivePos = posKey;
  drawField(fieldTeam);
  showFieldSidebar(posKey, posLabel);
}

function selectFieldPlayer(posLabel, playerIdx, posKey) {
  if (!fieldTeam) return;
  fieldTeam.substitute(posLabel, playerIdx);
  matchupState.myTeamFull = fieldTeam;
  fieldActivePos = posKey;
  drawField(fieldTeam);
  showFieldSidebar(posKey, posLabel);
}

function initFieldCanvas() {
  const canvas = document.getElementById("field-canvas");
  if (!canvas) return;
  canvas.onclick = onFieldClick;
  // Resize observer
  if (!canvas._fieldRO) {
    canvas._fieldRO = new ResizeObserver(() => { if (fieldTeam) drawField(fieldTeam); });
    canvas._fieldRO.observe(canvas);
  }
  if (fieldTeam) drawField(fieldTeam);
}

function renderSeasonTab() {
  const content = document.getElementById("season-content");
  const s = currentSeason;
  if (!s) return;

  if (seasonTab === "matchup") {
    renderMatchupTab(content, s);
  }

  else if (seasonTab === "schedule") {
    const games = s.getWeekGames(s.currentWeek);
    let html = `<h3 style="margin-bottom:12px;color:var(--muted);font-size:13px;">SEMANA ${s.currentWeek}</h3>`;
    for (const g of games) {
      const homeT = s.teams[g.home], awayT = s.teams[g.away];
      const isPlayerGame = g.isPlayerGame;
      const scoreStr = g.played ? `${g.homeScore} – ${g.awayScore}` : "vs";
      html += `
        <div class="week-game-row ${isPlayerGame ? "player-game" : ""}">
          <div class="teams">${homeT?.abbreviation||g.home}  ${scoreStr}  ${awayT?.abbreviation||g.away}</div>
          ${isPlayerGame && !g.played ? `<button class="btn btn-primary" id="play-week-btn">▶ Jogar</button>` : (g.played ? `<span class="score">✓</span>` : "")}
        </div>`;
    }
    content.innerHTML = html;
    const playBtn = document.getElementById("play-week-btn");
    if (playBtn) playBtn.onclick = () => playSeasonGame();
  }

  else if (seasonTab === "standings") {
    let html = "";
    for (const conf of ["AFC","NFC"]) {
      html += `<h3 style="margin:16px 0 8px;color:var(--muted);font-size:13px;">${conf}</h3>`;
      html += `<table class="standings-table"><tr><th>Time</th><th>V</th><th>D</th><th>E</th><th>PF</th><th>PA</th></tr>`;
      const standings = s.getStandings(conf);
      for (const t of standings) {
        html += `<tr class="${t.isPlayer ? "player-row" : ""}">
          <td>${t.city} ${t.name}</td><td>${t.wins}</td><td>${t.losses}</td><td>${t.ties}</td>
          <td>${t.pointsFor}</td><td>${t.pointsAgainst}</td></tr>`;
      }
      html += `</table>`;
    }
    content.innerHTML = html;
  }

  else if (seasonTab === "ranking") {
    renderRankingTab(content, s);
  }

  else if (seasonTab === "history") {
    renderHistoryTab(content);
  }

  else if (seasonTab === "transfers") {
    renderTransfersTab(content, s);
  }
}

/* ─── Ranking da Liga ────────────────────────────────────────────────────────── */
function renderRankingTab(content, s) {
  const all = Object.values(s.teams).sort((a,b) =>
    (b.winPct - a.winPct) || (b.pointDiff - a.pointDiff) || (b.wins - a.wins)
  );

  const medals = ["🥇","🥈","🥉"];
  content.innerHTML = `
    <div style="max-width:600px;margin:0 auto;">
      <div class="section-title">🏆  Ranking Geral da Liga — ${s.year}</div>
      <table class="standings-table ranking-table">
        <tr><th>#</th><th>Time</th><th>Conf</th><th>V-D</th><th>%</th><th>PF</th><th>PA</th><th>Saldo</th></tr>
        ${all.map((t, i) => `
          <tr class="${t.isPlayer ? "player-row" : ""}">
            <td>${medals[i] || (i+1)}</td>
            <td><strong>${t.abbreviation}</strong> ${t.city}</td>
            <td style="color:var(--muted);font-size:11px;">${t.conference}</td>
            <td>${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}</td>
            <td>${(t.winPct*100).toFixed(0)}%</td>
            <td>${t.pointsFor}</td>
            <td>${t.pointsAgainst}</td>
            <td class="${t.pointDiff >= 0 ? "green" : "red"}">${t.pointDiff >= 0 ? "+" : ""}${t.pointDiff}</td>
          </tr>`).join("")}
      </table>
    </div>`;
}

/* ─── Histórico de temporadas ────────────────────────────────────────────────── */
const SEASON_HISTORY_KEY = "browserfl_history";

function saveSeasonToHistory(s) {
  const history = JSON.parse(localStorage.getItem(SEASON_HISTORY_KEY) || "[]");
  const playerRec = s.teams[s.playerTeam];
  history.unshift({
    year:     s.year,
    team:     s.playerTeam,
    record:   playerRec ? playerRec.recordStr : "0-0",
    wins:     playerRec ? playerRec.wins : 0,
    losses:   playerRec ? playerRec.losses : 0,
    pointsFor:   playerRec ? playerRec.pointsFor : 0,
    champion: s.champion || null,
    savedAt:  Date.now(),
  });
  // Mantém só os últimos 10
  localStorage.setItem(SEASON_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
}

function renderHistoryTab(content) {
  const history = JSON.parse(localStorage.getItem(SEASON_HISTORY_KEY) || "[]");
  if (!history.length) {
    content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
      Nenhuma temporada concluída ainda. Complete a temporada regular e os playoffs para ver o histórico.
    </div>`;
    return;
  }

  content.innerHTML = `
    <div style="max-width:600px;margin:0 auto;">
      <div class="section-title">📚  Histórico de Temporadas</div>
      <div class="history-list">
        ${history.map(h => `
          <div class="history-card ${h.champion ? "champion-card" : ""}">
            <div class="hc-year">${h.year}</div>
            <div class="hc-info">
              <div class="hc-team">${h.team} — ${h.record}</div>
              <div class="hc-pts">${h.pointsFor} pontos marcados</div>
            </div>
            <div class="hc-result">
              ${h.champion ? "🏆 CAMPEÃO" : h.wins >= 9 ? "✅ Playoffs" : "❌ Eliminado"}
            </div>
          </div>`).join("")}
      </div>
    </div>`;
}

/* ─── Animação de Campeão ────────────────────────────────────────────────────── */
function showChampionAnimation(teamAbbr, teamName) {
  // Salva no histórico
  if (currentSeason) {
    currentSeason.champion = teamAbbr;
    saveSeasonToHistory(currentSeason);
    saveSeasonToStorage(currentSaveId, currentSeason);
  }

  const overlay = document.createElement("div");
  overlay.className = "champion-overlay";
  overlay.innerHTML = `
    <div class="champion-modal">
      <div class="champ-confetti" id="champ-confetti"></div>
      <div class="champ-trophy">🏆</div>
      <div class="champ-title">CAMPEÃO!</div>
      <div class="champ-team">${teamName}</div>
      <div class="champ-subtitle">Super Bowl ${currentSeason?.year || ""}</div>
      <button class="btn btn-primary" style="width:200px;margin-top:24px;"
        onclick="this.closest('.champion-overlay').remove(); showScreen('menu-screen'); refreshMenuScreen();">
        🎉  Celebrar!
      </button>
    </div>`;
  document.body.appendChild(overlay);

  // Confetti
  const confettiEl = document.getElementById("champ-confetti");
  const colors = ["#e8a020","#fff","#3fb950","#4d9de0","#f85149","#bc8cff"];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement("div");
    c.className = "confetti-piece";
    c.style.cssText = `left:${Math.random()*100}%;background:${colors[i%colors.length]};
      animation-delay:${Math.random()*2}s;animation-duration:${2+Math.random()*2}s;
      width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;
      border-radius:${Math.random() > 0.5 ? "50%" : "0"};`;
    confettiEl.appendChild(c);
  }
}

/* ─── Transferências ────────────────────────────────────────────────────────── */

// Estado da UI de transferências
let transferState = {
  mode: "menu",        // "menu" | "freeagency" | "trade"
  tradeTargetAbbr: null,
  myOfferedPlayers: [],
  theirWantedPlayers: [],
};

function renderTransfersTab(content, s) {
  const window_ = transferWindowStatus(s);
  const myRecord = s.teams[s.playerTeam];

  // Garante que o roster persistente existe
  if (!myRecord.roster) {
    const team = createSampleTeam(myRecord.name, myRecord.city, myRecord.abbreviation, "strong");
    myRecord.roster = teamToRoster(team);
    myRecord.capUsed = calcCapUsed(myRecord.roster);
    saveSeasonToStorage(currentSaveId, s);
  }

  const capSpace = parseFloat((myRecord.capTotal - myRecord.capUsed).toFixed(1));

  if (transferState.mode === "freeagency") {
    renderFreeAgency(content, s, myRecord, capSpace, window_);
    return;
  }
  if (transferState.mode === "trade") {
    renderTradeScreen(content, s, myRecord, capSpace, window_);
    return;
  }

  // Menu principal
  content.innerHTML = `
    <div class="transfer-wrap">
      <div class="transfer-window-badge ${window_.open ? "open" : "closed"}">
        ${window_.open ? "🟢" : "🔴"}  ${window_.msg}
      </div>

      <div class="cap-bar">
        <div class="cap-bar-header">
          <span class="cap-label">Cap Salarial</span>
          <span class="cap-numbers">$${myRecord.capUsed}M / $${myRecord.capTotal}M</span>
        </div>
        <div class="cap-bar-track">
          <div class="cap-bar-fill ${capSpace < 20 ? "danger" : capSpace < 50 ? "warning" : ""}"
            style="width:${Math.min(100, (myRecord.capUsed / myRecord.capTotal) * 100).toFixed(1)}%">
          </div>
        </div>
        <div class="cap-space">Cap space disponível: <span class="${capSpace < 20 ? "red" : "green"}">$${capSpace}M</span></div>
      </div>

      ${window_.open ? `
        <div class="transfer-actions">
          <button class="transfer-action-btn fa-btn" onclick="transferState.mode='freeagency'; renderSeasonTab();">
            <div class="ta-icon">🏪</div>
            <div class="ta-info">
              <div class="ta-title">Mercado Livre</div>
              <div class="ta-sub">Contratar jogadores sem time</div>
            </div>
          </button>
          <button class="transfer-action-btn trade-btn" onclick="transferState.mode='trade'; transferState.tradeTargetAbbr=null; renderSeasonTab();">
            <div class="ta-icon">🔄</div>
            <div class="ta-info">
              <div class="ta-title">Propor Troca</div>
              <div class="ta-sub">Negociar com outros times</div>
            </div>
          </button>
        </div>
      ` : ""}

      <div class="section-title">📋  Meu Elenco Atual</div>
      <div class="transfer-roster">
        ${_renderMyRoster(myRecord.roster, window_.open)}
      </div>

    </div>`;
}

function _renderMyRoster(roster, canRelease) {
  const order = ["QB","RB","WR","TE","OL","DE","DT","LB","CB","S","K"];
  return order.map(pos => {
    const players = roster[pos] || [];
    return players.map((p, idx) => {
      const isStarter = idx === 0;
      return `<div class="tr-player-row">
        <span class="tr-pos">${pos}</span>
        <span class="tr-role">${isStarter ? "TIT" : "RES"}</span>
        <span class="tr-name">${p.name}</span>
        <span class="tr-ovr ${ovrColorClass(p.overall)}">${p.overall}</span>
        <span class="tr-salary">${salaryLabel(p.salary || calcSalary(p.overall, pos))}</span>
        ${(() => {
          if (!canRelease) return "";
          const posPlayers = roster[pos] || [];
          // Pode dispensar qualquer jogador, exceto se for o único na posição
          const isOnlyOne = posPlayers.length === 1;
          if (isOnlyOne) return `<span class="tr-no-release" title="Único na posição">—</span>`;
          return `<button class="tr-release-btn" onclick="releasePlayer('${pos}',${idx})">Dispensar</button>`;
        })()}
      </div>`;
    }).join("");
  }).join("");
}

function releasePlayer(pos, idx) {
  const s = currentSeason;
  const myRecord = s.teams[s.playerTeam];
  if (!myRecord.roster || !myRecord.roster[pos]) return;

  const player = myRecord.roster[pos][idx];
  if (!player) return;
  if (!confirm(`Dispensar ${player.name}? Ele sairá do elenco.`)) return;

  myRecord.roster[pos].splice(idx, 1);
  myRecord.capUsed = calcCapUsed(myRecord.roster);
  saveSeasonToStorage(currentSaveId, s);
  renderSeasonTab();
}

// ─── Mercado Livre ────────────────────────────────────────────────────────────
function renderFreeAgency(content, s, myRecord, capSpace, window_) {
  const usedNames = new Set();
  for (const players of Object.values(myRecord.roster)) {
    for (const p of players) usedNames.add(p.name);
  }
  const agents = generateFreeAgents(usedNames);

  content.innerHTML = `
    <div class="transfer-wrap">
      <div class="tr-back-row">
        <button class="btn btn-secondary" onclick="transferState.mode='menu'; renderSeasonTab();">←  Voltar</button>
        <div class="tr-cap-mini">Cap livre: <span class="${capSpace < 20 ? "red" : "green"}">$${capSpace}M</span></div>
      </div>
      <div class="section-title">🏪  Mercado Livre</div>
      <div class="fa-list">
        ${agents.map(p => `
          <div class="fa-player">
            <span class="tr-pos">${p.position}</span>
            <span class="tr-name">${p.name}</span>
            <span class="tr-ovr ${ovrColorClass(p.overall)}">${p.overall}</span>
            <span class="tr-salary">${salaryLabel(p.salary)}</span>
            ${p.salary <= capSpace
              ? `<button class="btn btn-primary tr-sign-btn" onclick="signFreeAgent(${JSON.stringify(p).replace(/"/g,'&quot;')})">Contratar</button>`
              : `<span class="tr-no-cap">Sem cap</span>`}
          </div>`).join("")}
      </div>
    </div>`;
}

function signFreeAgent(player) {
  const s = currentSeason;
  const myRecord = s.teams[s.playerTeam];
  const capSpace = parseFloat((myRecord.capTotal - myRecord.capUsed).toFixed(1));

  if (player.salary > capSpace) {
    alert(`Cap insuficiente. Você tem $${capSpace}M disponível.`); return;
  }

  const pos = player.position;
  if (!myRecord.roster[pos]) myRecord.roster[pos] = [];

  // Adiciona como reserva (posição 1+)
  myRecord.roster[pos].push({
    name: player.name, position: pos, overall: player.overall,
    salary: player.salary, attrs: player.attrs || {}, injured: false,
  });
  myRecord.capUsed = calcCapUsed(myRecord.roster);
  saveSeasonToStorage(currentSaveId, s);

  showTransferToast(`✅ ${player.name} contratado por ${salaryLabel(player.salary)}/ano!`);
  renderSeasonTab();
}

// ─── Trocas ───────────────────────────────────────────────────────────────────
function renderTradeScreen(content, s, myRecord, capSpace, window_) {
  if (!transferState.tradeTargetAbbr) {
    // Tela de seleção de time
    const teams = Object.values(s.teams)
      .filter(t => !t.isPlayer)
      .sort((a,b) => b.strength - a.strength);

    content.innerHTML = `
      <div class="transfer-wrap">
        <div class="tr-back-row">
          <button class="btn btn-secondary" onclick="transferState.mode='menu'; renderSeasonTab();">←  Voltar</button>
          <div class="tr-cap-mini">Cap livre: <span class="${capSpace < 20 ? "red" : "green"}">$${capSpace}M</span></div>
        </div>
        <div class="section-title">🔄  Escolha o time para negociar</div>
        <div class="trade-team-grid">
          ${teams.map(t => `
            <div class="trade-team-card" onclick="transferState.tradeTargetAbbr='${t.abbreviation}'; transferState.myOfferedPlayers=[]; transferState.theirWantedPlayers=[]; renderSeasonTab();">
              <div class="ttc-abbr">${t.abbreviation}</div>
              <div class="ttc-name">${t.city}</div>
              <div class="ttc-record">${t.recordStr}</div>
            </div>`).join("")}
        </div>
      </div>`;
    return;
  }

  // Tela de proposta de troca
  const theirRecord = s.teams[transferState.tradeTargetAbbr];
  const theirTeam = createSampleTeam(theirRecord.name, theirRecord.city, theirRecord.abbreviation, "medium");
  const theirRoster = theirRecord.roster || teamToRoster(theirTeam);

  const myPlayers   = _flatRoster(myRecord.roster);
  const theirPlayers = _flatRoster(theirRoster);

  const offered = transferState.myOfferedPlayers;
  const wanted  = transferState.theirWantedPlayers;

  const myVal    = _tradeValue(offered);
  const theirVal = _tradeValue(wanted);
  const ratio    = wanted.length > 0 ? myVal / theirVal : 0;
  const fairness = ratio >= 0.85 ? "🟢 Equilibrada" : ratio >= 0.65 ? "🟡 Desfavorável para você" : "🔴 Muito desequilibrada";

  content.innerHTML = `
    <div class="transfer-wrap">
      <div class="tr-back-row">
        <button class="btn btn-secondary" onclick="transferState.tradeTargetAbbr=null; renderSeasonTab();">←  Times</button>
        <span style="font-size:13px;font-weight:700;color:var(--white);">vs ${theirRecord.city} ${theirRecord.abbreviation}</span>
      </div>

      <div class="trade-cols">
        <div class="trade-col">
          <div class="trade-col-title">Você oferece</div>
          ${myPlayers.map(p => {
            const sel = offered.find(o => o.name === p.name);
            return `<div class="trade-player ${sel ? "selected" : ""}" onclick="toggleTradePlayer('my','${p.name}','${p.position}',${p.overall},${p.salary||0})">
              <span class="tr-pos">${p.position}</span>
              <span class="tr-name">${p.name}</span>
              <span class="tr-ovr ${ovrColorClass(p.overall)}">${p.overall}</span>
              ${sel ? '<span class="tp-check">✓</span>' : ''}
            </div>`;
          }).join("")}
        </div>

        <div class="trade-mid">
          <div class="trade-arrow">⇄</div>
          <div class="trade-value">
            <div class="tv-mine">Você: ${myVal.toFixed(0)} pts</div>
            <div class="tv-their">Eles: ${theirVal.toFixed(0)} pts</div>
            <div class="tv-fair">${offered.length && wanted.length ? fairness : "—"}</div>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:12px;"
            onclick="proposeTrade()"
            ${!offered.length || !wanted.length ? "disabled" : ""}>
            Propor Troca
          </button>
        </div>

        <div class="trade-col">
          <div class="trade-col-title">Você recebe</div>
          ${theirPlayers.map(p => {
            const sel = wanted.find(w => w.name === p.name);
            return `<div class="trade-player ${sel ? "selected" : ""}" onclick="toggleTradePlayer('their','${p.name}','${p.position}',${p.overall},${p.salary||0})">
              <span class="tr-pos">${p.position}</span>
              <span class="tr-name">${p.name}</span>
              <span class="tr-ovr ${ovrColorClass(p.overall)}">${p.overall}</span>
              ${sel ? '<span class="tp-check">✓</span>' : ''}
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>`;
}

function _flatRoster(roster) {
  const result = [];
  const order = ["QB","RB","WR","TE","OL","DE","DT","LB","CB","S","K"];
  for (const pos of order) {
    for (const p of (roster[pos] || [])) {
      result.push({ ...p, position: pos });
    }
  }
  return result;
}

function toggleTradePlayer(side, name, position, overall, salary) {
  const list = side === "my" ? transferState.myOfferedPlayers : transferState.theirWantedPlayers;
  const idx = list.findIndex(p => p.name === name);
  if (idx >= 0) list.splice(idx, 1);
  else list.push({ name, position, overall, salary });
  renderSeasonTab();
}

function proposeTrade() {
  const s = currentSeason;
  const myRecord    = s.teams[s.playerTeam];
  const theirRecord = s.teams[transferState.tradeTargetAbbr];
  const theirTeam   = createSampleTeam(theirRecord.name, theirRecord.city, theirRecord.abbreviation, "medium");
  const theirRoster = theirRecord.roster || teamToRoster(theirTeam);

  const result = evaluateTrade({
    myPlayers:    transferState.myOfferedPlayers,
    theirPlayers: transferState.theirWantedPlayers,
  });

  if (!result.accepted) {
    showTransferToast("❌ " + result.reason, 4000);
    return;
  }

  // Executa a troca
  const offered = transferState.myOfferedPlayers;
  const wanted  = transferState.theirWantedPlayers;

  // Remove oferecidos do meu roster
  for (const op of offered) {
    const arr = myRecord.roster[op.position] || [];
    const i = arr.findIndex(p => p.name === op.name);
    if (i >= 0) arr.splice(i, 1);
  }
  // Adiciona os que quero ao meu roster
  for (const wp of wanted) {
    if (!myRecord.roster[wp.position]) myRecord.roster[wp.position] = [];
    // Remove do roster deles
    const theirArr = theirRoster[wp.position] || [];
    const ti = theirArr.findIndex(p => p.name === wp.name);
    if (ti >= 0) theirArr.splice(ti, 1);
    myRecord.roster[wp.position].push({ ...wp, attrs: wp.attrs || {} });
  }

  myRecord.capUsed = calcCapUsed(myRecord.roster);
  transferState.myOfferedPlayers = [];
  transferState.theirWantedPlayers = [];
  transferState.tradeTargetAbbr = null;
  transferState.mode = "menu";

  saveSeasonToStorage(currentSaveId, s);
  showTransferToast(`✅ Troca aprovada! ${wanted.map(p=>p.name).join(", ")} chegam ao seu time.`, 4000);
  renderSeasonTab();
}

function showTransferToast(msg, duration = 3000) {
  let t = document.getElementById("transfer-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "transfer-toast";
    t.className = "transfer-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

function playSeasonGame() {
  const s = currentSeason;
  const game = s.schedule.find(g => g.week === s.currentWeek && g.isPlayerGame && !g.played);
  if (!game) return;

  const isHome = game.home === s.playerTeam;
  const myRecord = s.teams[s.playerTeam];
  const oppAbbr = isHome ? game.away : game.home;
  const oppRecord = s.teams[oppAbbr];
  const oppStr = oppRecord.strength >= 82 ? "strong" : oppRecord.strength >= 74 ? "medium" : "weak";

  // Usa o elenco com as substituições feitas na tela pré-jogo (se existir e for a mesma semana)
  const weekKey = `${s.currentWeek}-${s.playerTeam}`;
  const myTeam = (matchupState.weekKey === weekKey && matchupState.myTeamFull)
    ? matchupState.myTeamFull
    : createSampleTeam(myRecord.name, myRecord.city, myRecord.abbreviation, "strong");
  const oppTeam = createSampleTeam(oppRecord.name, oppRecord.city, oppRecord.abbreviation, oppStr);

  // O time do JOGADOR é sempre tratado como "home" no motor (controla agressividade/foco/playbook),
  // independente de quem é o mandante real na temporada — o resultado salvo respeita o confronto real.
  const homeTeam = myTeam, awayTeam = oppTeam;

  const weekGames = [];
  for (const g of s.getWeekGames(s.currentWeek)) {
    if (g.isPlayerGame) continue;
    const ht = s.teams[g.home], at = s.teams[g.away];
    weekGames.push({
      home: g.home, away: g.away,
      homeStr: ht.strength >= 82 ? "strong" : ht.strength >= 74 ? "medium" : "weak",
      awayStr: at.strength >= 82 ? "strong" : at.strength >= 74 ? "medium" : "weak",
    });
  }

  window.onGameFinished = function(myScore, oppScore) {
    // homeScore/awayScore do motor correspondem a myTeam/oppTeam (jogador sempre é "home" no motor).
    // Precisamos mapear de volta para o mandante/visitante REAIS da temporada.
    const realHomeScore = isHome ? myScore : oppScore;
    const realAwayScore = isHome ? oppScore : myScore;
    processWeekResults(s, s.currentWeek, realHomeScore, realAwayScore);

    // Salva estatísticas do jogo no registro do time do jogador
    const playerRecord = s.teams[s.playerTeam];
    const gameState = gameScreen.state;
    if (gameState && playerRecord) {
      const myTeamInGame = gameState.homeTeam;
      playerRecord.seasonPassYards   += myTeamInGame.passYards   || 0;
      playerRecord.seasonRushYards   += myTeamInGame.rushYards   || 0;
      playerRecord.seasonTotalYards  += myTeamInGame.totalYards  || 0;
      playerRecord.seasonTurnovers   += myTeamInGame.turnovers   || 0;
      playerRecord.seasonFirstDowns  += myTeamInGame.firstDowns  || 0;
      playerRecord.seasonTDs         += Math.floor(myScore / 7);
      playerRecord.seasonFGs         += Math.round((myScore % 7) / 3);
      playerRecord.seasonGames       += 1;

      const mvp = getTeamMVP(myTeamInGame);
      if (mvp && mvp.mvpScore() > 0) {
        if (!playerRecord.seasonMVPs) playerRecord.seasonMVPs = [];
        playerRecord.seasonMVPs.push({
          name: mvp.name, pos: mvp.position, ovr: mvp.overall,
          week: s.currentWeek, stats: formatPlayerStats(mvp), score: mvp.mvpScore()
        });
      }

      // Persiste lesões ocorridas no jogo de volta ao roster
      if (playerRecord.roster) {
        for (const [pos, players] of Object.entries(myTeamInGame.roster)) {
          for (const enginePlayer of players) {
            if (enginePlayer.injured) {
              const rosterPos = playerRecord.roster[pos] || [];
              const rp = rosterPos.find(r => r.name === enginePlayer.name);
              if (rp) {
                rp.injured      = true;
                rp.injurySev    = enginePlayer.injurySev    || "mild";
                rp.gamesMissed  = enginePlayer.gamesMissed  || 0;
                rp.injuryLabel  = enginePlayer.injuryLabel  || "leve";
              }
            }
          }
        }
      }
    }

    // Avança semana — decrementa contador de lesões
    s.currentWeek = Math.min(18, s.currentWeek + 1);
    if (playerRecord?.roster) {
      for (const players of Object.values(playerRecord.roster)) {
        for (const p of players) {
          if (p.injured && p.gamesMissed > 0) {
            p.gamesMissed--;
            if (p.gamesMissed === 0) p.injured = false;
          } else if (p.injured && (!p.gamesMissed || p.gamesMissed <= 0)) {
            // Lesão leve: recupera automaticamente
            p.injured = false;
          }
        }
      }
    }

    saveSeasonToStorage(currentSaveId, s);
    window.onGameFinished = () => {};
    matchupState.weekKey = null;

    // Verifica se o jogador venceu o Super Bowl
    const playerGame = s.schedule?.find(g => g.isPlayerGame && g.week === s.currentWeek - 1 && g.played);
    const playerWon = playerGame && (
      (playerGame.home === s.playerTeam && realHomeScore > realAwayScore) ||
      (playerGame.away === s.playerTeam && realAwayScore > realHomeScore)
    );
    if (s.phase === "superbowl" && playerWon) {
      const playerRec = s.teams[s.playerTeam];
      showChampionAnimation(s.playerTeam, `${playerRec.city} ${playerRec.name}`);
      return;
    }

    showScreen("season-screen");
    refreshSeasonScreen();
  };

  gameScreen.startGame(homeTeam, awayTeam, weekGames, {
    offPlaybook: matchupState.offPlaybook,
    defPlaybook: matchupState.defPlaybook,
  });
  showScreen("game-screen");
}

/* ─── Editor de Time (simplificado) ──────────────────────────────────────── */

function openEditor() {
  const team = loadMyTeam();
  document.getElementById("editor-name").value = team.name;
  document.getElementById("editor-city").value = team.city;
  document.getElementById("editor-abbr").value = team.abbreviation;
  showScreen("editor-screen");
}

function saveEditor() {
  const team = {
    name: document.getElementById("editor-name").value.trim() || "Meu Time",
    city: document.getElementById("editor-city").value.trim() || "Minha Cidade",
    abbreviation: document.getElementById("editor-abbr").value.trim().toUpperCase() || "MEU",
    isCustom: true,
  };
  saveMyTeam(team);
  showScreen("menu-screen");
  refreshMenuScreen();
}

/* ─── Multiplayer Lobby ───────────────────────────────────────────────────── */

// URL do servidor — muda aqui quando hospedar
const MP_SERVER_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : window.location.origin; // produção: mesmo domínio

function openMpLobby() {
  showScreen("mp-lobby-screen");
  document.getElementById("mp-back-btn").onclick = () => {
    mpClose();
    showScreen("menu-screen");
    refreshMenuScreen();
  };

  document.getElementById("mp-create-btn").onclick = async () => {
    const btn = document.getElementById("mp-create-btn");
    btn.disabled = true; btn.textContent = "Conectando...";
    try {
      await mpConnect(MP_SERVER_URL);
      mpCreateRoom((code) => {
        document.getElementById("mp-code-display").textContent = code;
        document.getElementById("mp-room-code").style.display = "block";
        btn.style.display = "none";
      });
    } catch (e) {
      btn.disabled = false; btn.textContent = "Criar sala";
      document.getElementById("mp-error").textContent = e.message;
      document.getElementById("mp-error").style.display = "block";
    }
  };

  document.getElementById("mp-join-btn").onclick = async () => {
    const code = document.getElementById("mp-code-input").value.trim().toUpperCase();
    if (!code) {
      document.getElementById("mp-error").textContent = "Digite o código da sala.";
      document.getElementById("mp-error").style.display = "block";
      return;
    }
    const statusEl = document.getElementById("mp-join-status");
    statusEl.style.display = "block"; statusEl.textContent = "Conectando...";
    document.getElementById("mp-join-btn").disabled = true;

    try {
      await mpConnect(MP_SERVER_URL);
      mpJoinRoom(code, () => {
        statusEl.textContent = "Conectado! Aguardando o host iniciar o draft...";
        showScreen("mp-draft-screen");
        document.getElementById("mp-draft-screen").innerHTML =
          `<div style="text-align:center;padding:60px 24px;">
            <div style="font-size:40px;margin-bottom:16px;">🤝</div>
            <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:8px;">Conectado!</div>
            <div style="font-size:13px;color:var(--muted);">Aguardando o host iniciar o draft...</div>
          </div>`;
      });
    } catch (e) {
      statusEl.textContent = "Erro: " + e.message;
      document.getElementById("mp-join-btn").disabled = false;
    }
  };

  document.getElementById("mp-code-input").oninput = (e) => {
    e.target.value = e.target.value.toUpperCase();
    document.getElementById("mp-error").style.display = "none";
  };
}

function _unused_mpHandleMessage(data) {
  switch (data.type) {
    case "draft_start":
      break;
    case "draft_pick":
      break;
    case "snap":
      mpReceiveSnap(data);
      break;
  }
}



let gameScreen;

document.addEventListener("DOMContentLoaded", () => {
  gameScreen = new GameScreenController();
  gameScreen.soundMgr = new SoundManager();

  document.getElementById("season-card-btn").onclick = () => {
    showScreen("season-select-screen");
    refreshSeasonSelectScreen();
  };
  document.getElementById("friendly-card-btn").onclick = openMpLobby;
  document.getElementById("editor-card-btn").onclick = openEditor;

  document.getElementById("ss-back-btn").onclick = () => { showScreen("menu-screen"); refreshMenuScreen(); };
  document.getElementById("ss-new-btn").onclick = openNewSeasonModal;
  document.getElementById("ns-cancel").onclick = closeNewSeasonModal;
  document.getElementById("ns-confirm").onclick = confirmNewSeason;

  document.getElementById("season-back-btn").onclick = () => { showScreen("season-select-screen"); refreshSeasonSelectScreen(); };
  document.querySelectorAll(".season-tab").forEach(t => t.onclick = () => setSeasonTab(t.dataset.tab));

  document.getElementById("editor-back-btn").onclick = () => { showScreen("menu-screen"); refreshMenuScreen(); };
  document.getElementById("editor-save-btn").onclick = saveEditor;

  refreshMenuScreen();
  showScreen("menu-screen");
});
