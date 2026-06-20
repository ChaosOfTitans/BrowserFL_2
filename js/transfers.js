/* transfers.js — Sistema de transferências: mercado livre + trocas com IA */

// ─── Constantes ───────────────────────────────────────────────────────────────
const SALARY_CAP = 180; // $180M total por time

// Multiplicadores de posição (QB vale mais que K no cap)
const POS_SALARY_MULT = {
  QB: 1.8, RB: 0.9, WR: 1.1, TE: 0.8,
  OL: 0.7, DE: 1.0, DT: 0.8, LB: 0.8,
  CB: 0.9, S: 0.8, K: 0.4,
};

/* Calcula salário de um jogador em $M baseado em OVR + posição */
function calcSalary(ovr, pos) {
  const mult = POS_SALARY_MULT[pos] ?? 1.0;
  // Escala: OVR 99 = ~$35M base para QB, OVR 70 = ~$5M, OVR 50 = ~$1M
  const base = Math.pow(Math.max(0, ovr - 48) / 51, 2.2) * 35;
  return Math.max(0.5, parseFloat((base * mult).toFixed(1)));
}

/* Gera descrição legível do salário */
function salaryLabel(salary) {
  return `$${salary}M`;
}

/* Calcula o cap total usado por um roster */
function calcCapUsed(roster) {
  let total = 0;
  for (const players of Object.values(roster)) {
    for (const p of players) {
      total += p.salary || calcSalary(p.overall, p.position);
    }
  }
  return parseFloat(total.toFixed(1));
}

// ─── Roster persistente ───────────────────────────────────────────────────────
/* Converte um Team (do motor) em roster serializável para a temporada */
function teamToRoster(team) {
  const roster = {};
  for (const [pos, players] of Object.entries(team.roster)) {
    roster[pos] = players.map(p => ({
      name: p.name, position: p.position, overall: p.overall,
      salary: p.salary || calcSalary(p.overall, p.position),
      injured: p.injured || false,
      attrs: {
        passing: p.passing, running: p.running, catching: p.catching,
        blocking: p.blocking, tackle: p.tackle, coverage: p.coverage,
        pass_rush: p.pass_rush, speed: p.speed, strength: p.strength,
      }
    }));
  }
  return roster;
}

/* Reconstrói um Team (motor) a partir de um roster serializável */
function rosterToTeam(name, abbr, city, rosterData) {
  const pb = createDefaultPlaybook();
  const team = new Team(name, abbr, city, pb);
  for (const players of Object.values(rosterData)) {
    for (const p of players) {
      const player = new Player(p.name, Position[p.position], p.overall, p.attrs || {});
      player.salary = p.salary || calcSalary(p.overall, p.position);
      player.injured = p.injured || false;
      team.addPlayer(player);
    }
  }
  return team;
}

// ─── Mercado livre ────────────────────────────────────────────────────────────
/* Gera jogadores disponíveis no mercado livre para uma temporada */
function generateFreeAgents(usedPlayers = new Set()) {
  const agents = [];
  const BACKUP_POOL = {
    QB: [["Chad Kelly",68],["David Blough",66],["Cooper Rush",68],["Tommy DeVito",64]],
    RB: [["Damien Harris",70],["Kareem Hunt",72],["D'Onta Foreman",70],["Boston Scott",66]],
    WR: [["Randall Cobb",70],["Cole Beasley",68],["Darius Slayton",72],["Kalif Raymond",66]],
    TE: [["Cameron Brate",70],["Gerald Everett",72],["Nick Boyle",66],["Paul Quessenberry",62]],
    OL: [["Justin Pugh",70],["Ted Karras",72],["Bradley Bozeman",68],["Cam Fleming",66]],
    DE: [["Takkarist McKinley",70],["Shaquil Barrett",76],["Randy Gregory",72],["Bud Dupree",74]],
    DT: [["Linval Joseph",72],["Shelby Harris",74],["Maliek Collins",70],["Star Lotulelei",68]],
    LB: [["Anthony Barr",72],["Cory Littleton",70],["Kentrell Brothers",66],["Tyus Bowser",72]],
    CB: [["Chris Harris Jr.",72],["Prince Amukamara",68],["Bryce Callahan",70],["Desmond King",68]],
    S:  [["Tyrann Mathieu",78],["Devin McCourty",72],["Ha Ha Clinton-Dix",68],["Adrian Amos",72]],
    K:  [["Robbie Gould",76],["Greg Zuerlein",74],["Ryan Succop",72],["Matt Prater",74]],
  };

  for (const [pos, pool] of Object.entries(BACKUP_POOL)) {
    for (const [name, ovr] of pool) {
      if (!usedPlayers.has(name)) {
        agents.push({
          name, position: pos, overall: ovr,
          salary: calcSalary(ovr, pos),
          attrs: _defaultAttrs(pos, ovr),
        });
      }
    }
  }
  return agents.sort((a,b) => b.overall - a.overall);
}

function _defaultAttrs(pos, ovr) {
  const base = Math.floor(ovr * 0.9);
  const attrMap = {
    QB: {passing:ovr,running:Math.floor(ovr*0.65),speed:Math.floor(ovr*0.7)},
    RB: {running:ovr,speed:Math.floor(ovr*0.95),strength:Math.floor(ovr*0.85),catching:Math.floor(ovr*0.75)},
    WR: {catching:ovr,speed:Math.floor(ovr*0.95)},
    TE: {catching:ovr,blocking:Math.floor(ovr*0.8),speed:Math.floor(ovr*0.8)},
    OL: {blocking:ovr,strength:ovr},
    DE: {pass_rush:ovr,speed:Math.floor(ovr*0.85),tackle:Math.floor(ovr*0.85)},
    DT: {strength:ovr,pass_rush:Math.floor(ovr*0.85),tackle:ovr},
    LB: {tackle:ovr,coverage:Math.floor(ovr*0.8),speed:Math.floor(ovr*0.85)},
    CB: {coverage:ovr,speed:ovr,tackle:Math.floor(ovr*0.7)},
    S:  {coverage:ovr,tackle:Math.floor(ovr*0.85),speed:Math.floor(ovr*0.85)},
    K:  {speed:50},
  };
  return attrMap[pos] || {speed:base};
}

// ─── Trocas com IA ────────────────────────────────────────────────────────────
/* Avalia se um time de IA aceita uma troca.
   Retorna { accepted: bool, reason: string } */
function evaluateTrade(offer) {
  // offer = {
  //   myPlayers: [{name, overall, position, salary}],   // o que você oferece
  //   myPicks: [],                                       // draft picks (futuro: valor fixo)
  //   theirPlayers: [{name, overall, position, salary}], // o que você quer
  // }
  const myValue    = _tradeValue(offer.myPlayers)    + (offer.myPicks?.length || 0) * 8;
  const theirValue = _tradeValue(offer.theirPlayers);

  const ratio = myValue / Math.max(1, theirValue);

  if (ratio >= 0.85) {
    return { accepted: true,  reason: "Oferta aceita! A troca foi aprovada." };
  } else if (ratio >= 0.65) {
    return { accepted: false, reason: `Oferta recusada — o que você oferece (${myValue.toFixed(0)} pts) não é suficiente pelo que pede (${theirValue.toFixed(0)} pts). Melhore a oferta.` };
  } else {
    return { accepted: false, reason: `Oferta recusada — grande desequilíbrio. Você precisaria adicionar muito mais valor.` };
  }
}

function _tradeValue(players) {
  return players.reduce((sum, p) => {
    // Valor baseado em OVR com peso exponencial
    const ovr = p.overall || p.ovr || 70;
    return sum + Math.pow(Math.max(0, ovr - 50) / 49, 1.8) * 100;
  }, 0);
}

// ─── Verificações de janela ────────────────────────────────────────────────────
function isTransferWindowOpen(season) {
  if (!season) return false;
  if (season.phase !== "regular") return false; // pré-temporada OK (semana 0)
  return season.currentWeek <= 8;               // até semana 8
}

function transferWindowStatus(season) {
  if (!season) return { open: false, msg: "Nenhuma temporada ativa." };
  if (season.phase !== "regular") return { open: false, msg: "Transferências encerradas nos playoffs." };
  if (season.currentWeek <= 8) return { open: true,  msg: `Janela aberta até a Semana 8 (atual: Semana ${season.currentWeek}).` };
  return { open: false, msg: `Janela fechada. Transferências só até a Semana 8 (atual: Semana ${season.currentWeek}).` };
}
