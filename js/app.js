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
    matchupState.myTeamFull = createSampleTeam(myRecord.name, myRecord.city, myRecord.abbreviation, "strong");
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

      <div class="section-title centered">🏈  Escalação titular — ${myRecord.abbreviation}</div>
      <div class="roster-grid" id="my-roster-grid">${rosterHtml(myTeamFull)}</div>

      <div style="height:24px;"></div>
    </div>
  `;

  document.getElementById("play-matchup-btn").onclick = () => playSeasonGame();

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
      const myTeamInGame = gameState.homeTeam; // jogador sempre é home
      playerRecord.seasonPassYards   += myTeamInGame.passYards   || 0;
      playerRecord.seasonRushYards   += myTeamInGame.rushYards   || 0;
      playerRecord.seasonTotalYards  += myTeamInGame.totalYards  || 0;
      playerRecord.seasonTurnovers   += myTeamInGame.turnovers   || 0;
      playerRecord.seasonFirstDowns  += myTeamInGame.firstDowns  || 0;
      playerRecord.seasonTDs         += Math.floor(myScore / 7);
      playerRecord.seasonFGs         += Math.round((myScore % 7) / 3);
      playerRecord.seasonGames       += 1;

      // Salva MVP da partida para histórico da temporada
      const mvp = getTeamMVP(myTeamInGame);
      if (mvp && mvp.mvpScore() > 0) {
        if (!playerRecord.seasonMVPs) playerRecord.seasonMVPs = [];
        playerRecord.seasonMVPs.push({
          name: mvp.name, pos: mvp.position, ovr: mvp.overall,
          week: s.currentWeek, stats: formatPlayerStats(mvp), score: mvp.mvpScore()
        });
      }
    }

    s.currentWeek = Math.min(18, s.currentWeek + 1);
    saveSeasonToStorage(currentSaveId, s);
    window.onGameFinished = () => {};
    matchupState.weekKey = null;
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
