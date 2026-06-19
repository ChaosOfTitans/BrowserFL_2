/* models.js — Motor do jogo (porte fiel de models.py) */

const Position = {
  QB:"QB", RB:"RB", WR:"WR", TE:"TE", OL:"OL",
  DE:"DE", DT:"DT", LB:"LB", CB:"CB", S:"S", K:"K"
};

const PlayType = {
  RUN_INSIDE:"RUN_INSIDE", RUN_OUTSIDE:"RUN_OUTSIDE",
  PASS_SHORT:"PASS_SHORT", PASS_MEDIUM:"PASS_MEDIUM", PASS_DEEP:"PASS_DEEP",
  PLAY_ACTION:"PLAY_ACTION", SCREEN:"SCREEN", QB_SCRAMBLE:"QB_SCRAMBLE",
  PUNT:"PUNT", FIELD_GOAL:"FIELD_GOAL",
  DEF_BLITZ:"DEF_BLITZ", DEF_ZONE:"DEF_ZONE", DEF_MAN:"DEF_MAN",
  DEF_PREVENT:"DEF_PREVENT", DEF_RUSH:"DEF_RUSH"
};

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* Classifica o overall de um jogador numa faixa de cor, usada em toda a UI:
   90+ azul, 70-90 verde, 50-70 amarelo, <50 vermelho. */
function ovrColorClass(ovr) {
  if (ovr >= 90) return "ovr-blue";
  if (ovr >= 70) return "ovr-green";
  if (ovr >= 50) return "ovr-yellow";
  return "ovr-red";
}
/* Dentro da faixa verde (70-90), retorna um tom mais claro/escuro conforme o valor —
   usado como inline style para dar variação dentro da própria cor. */
function ovrColorStyle(ovr) {
  if (ovr >= 70 && ovr < 90) {
    const t = (ovr - 70) / 20; // 0 a 1
    const lightness = 45 + t * 15; // 45% a 60%
    return `color: hsl(142, 65%, ${lightness}%);`;
  }
  return "";
}
function randUniform(min, max) { return Math.random() * (max - min) + min; }
function randGauss(mean, sd) {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * sd;
}
function choice(arr) { return arr[randInt(0, arr.length - 1)]; }

class Player {
  constructor(name, position, overall, attrs = {}) {
    this.name = name;
    this.position = position;
    this.overall = overall;
    this.speed     = attrs.speed     ?? 70;
    this.strength  = attrs.strength  ?? 70;
    this.passing   = attrs.passing   ?? 0;
    this.catching  = attrs.catching  ?? 0;
    this.running   = attrs.running   ?? 0;
    this.blocking  = attrs.blocking  ?? 0;
    this.tackle    = attrs.tackle    ?? 0;
    this.coverage  = attrs.coverage  ?? 0;
    this.pass_rush = attrs.pass_rush ?? 0;
    this.fatigue   = 0;
    this.injured   = false;
    // Estatísticas de jogo (zeradas no início de cada partida)
    this.gameStats = { passYards:0, passTDs:0, rushYards:0, rushTDs:0,
                       recYards:0, recTDs:0, tackles:0, sacks:0,
                       interceptions:0, fumblesCaused:0, fgMade:0 };
  }
  resetGameStats() {
    this.gameStats = { passYards:0, passTDs:0, rushYards:0, rushTDs:0,
                       recYards:0, recTDs:0, tackles:0, sacks:0,
                       interceptions:0, fumblesCaused:0, fgMade:0 };
  }
  /* Pontuação de "rating" para MVP: pondera as stats pelo impacto na partida */
  mvpScore() {
    const g = this.gameStats;
    return g.passYards * 0.04 + g.passTDs * 6 +
           g.rushYards * 0.05 + g.rushTDs * 6 +
           g.recYards  * 0.05 + g.recTDs  * 6 +
           g.tackles   * 1.5  + g.sacks   * 4  +
           g.interceptions * 6 + g.fumblesCaused * 4 +
           g.fgMade    * 2;
  }
  effectiveStat(stat) {
    let base = this[stat] ?? 0;
    if (this.injured) base = Math.floor(base * 0.5);
    const fatiguePenalty = Math.floor(this.fatigue * 0.3);
    return Math.max(0, base - fatiguePenalty);
  }
  addFatigue(amount = 5) { /* fadiga desativada — mantido só para compatibilidade */ }
}

class Play {
  constructor(name, playType, risk, reward, idealDown = [], idealDistance = "any") {
    this.name = name;
    this.playType = playType;
    this.risk = risk;
    this.reward = reward;
    this.idealDown = idealDown;
    this.idealDistance = idealDistance;
  }
}

class Playbook {
  constructor(name, offensiveStyle, defensiveStyle) {
    this.name = name;
    this.offensiveStyle = offensiveStyle;
    this.defensiveStyle = defensiveStyle;
    this.offensivePlays = [];
    this.defensivePlays = [];
  }
  addPlay(play) {
    if (play.playType.startsWith("DEF_")) this.defensivePlays.push(play);
    else this.offensivePlays.push(play);
  }
}

const OFFENSE_PLAYBOOK_INFO = {
  "Pro Style":  { icon:"🎯", desc:"Equilibrado entre corrida e passe. Versátil, sem pontos fracos claros — ótimo para quem está aprendendo o time." },
  "Air Raid":   { icon:"🚀", desc:"Passes verticais e ataque pelo ar. Favorece jogadas de risco alto e grandes ganhos, mas vulnerável a pressão." },
  "Power Run":  { icon:"💪", desc:"Ataque baseado em corrida física e controle de tempo de posse. Desgasta a defesa adversária ao longo do jogo." },
  "West Coast": { icon:"⚡", desc:"Passes curtos e rápidos, alta taxa de conclusão. Constrói drives longos com jogadas de baixo risco." },
  "Spread":     { icon:"📡", desc:"Espalha a defesa pelo campo com múltiplos recebedores. Cria espaços, mas depende de execução precisa." },
  "Option":     { icon:"🌀", desc:"QB móvel com opção de corrida ou passe a cada jogada. Imprevisível, difícil de defender no papel." },
};

const DEFENSE_PLAYBOOK_INFO = {
  "4-3":     { icon:"🛡️", desc:"4 linemen, 3 linebackers. Esquema clássico e equilibrado, sólido contra corrida e passe." },
  "3-4":     { icon:"🔀", desc:"3 linemen, 4 linebackers. Mais versátil em blitzes, mas exige linebackers completos." },
  "Tampa 2": { icon:"🌐", desc:"Zona profunda com 2 safeties. Excelente contra passes longos, mais vulnerável a corridas." },
  "46 Defense": { icon:"🔥", desc:"Pressão agressiva com muitos jogadores na linha. Gera sacks e turnovers, mas arrisca jogadas grandes." },
  "Nickel":  { icon:"🎯", desc:"5º defensive back extra no lugar de um linebacker. Forte contra passe, mais fraco contra corrida." },
};

const DEF_PLAYBOOKS = {
  "4-3":        ["Cover 2 Zone","Man Coverage","DL Bull Rush"],
  "3-4":        ["Man Coverage","5-Man Blitz","DL Bull Rush"],
  "Tampa 2":    ["Cover 2 Zone","Prevent D"],
  "46 Defense": ["5-Man Blitz","DL Bull Rush"],
  "Nickel":     ["Man Coverage","Cover 2 Zone"],
};

class Team {
  constructor(name, abbreviation, city, playbook) {
    this.name = name;
    this.abbreviation = abbreviation;
    this.city = city;
    this.playbook = playbook;
    this.defPlaybook = "4-3"; // playbook defensivo selecionado
    this.roster = {};
    this.activeStarter = {}; // { QB: 0, RB: 0, ... } índice do titular no array da posição
    this.score = 0;
    this.totalYards = 0;
    this.passYards = 0;
    this.rushYards = 0;
    this.turnovers = 0;
    this.firstDowns = 0;
    this.playsRun = 0;
  }
  addPlayer(player) {
    if (!this.roster[player.position]) this.roster[player.position] = [];
    this.roster[player.position].push(player);
    if (this.activeStarter[player.position] === undefined) {
      this.activeStarter[player.position] = 0;
    }
  }
  getStarter(position) {
    const players = this.roster[position] || [];
    if (!players.length) return null;
    const idx = this.activeStarter[position] ?? 0;
    return players[idx] || players[0];
  }
  getBackup(position) {
    const players = this.roster[position] || [];
    const idx = this.activeStarter[position] ?? 0;
    return players.find((p, i) => i !== idx) || null;
  }
  getAllAtPosition(position) {
    return this.roster[position] || [];
  }
  setStarter(position, playerIndex) {
    this.activeStarter[position] = playerIndex;
  }
  /* Substitui o titular atual pelo reserva (ou outro jogador do roster) na posição. */
  substitute(position, newPlayerIndex) {
    this.activeStarter[position] = newPlayerIndex;
  }
  /* Verifica se o titular atual de alguma posição acabou de se machucar.
     Retorna o jogador lesionado (para a UI mostrar o popup) ou null. */
  checkForNewInjury() {
    for (const pos of Object.keys(this.roster)) {
      const starter = this.getStarter(pos);
      if (starter && starter.injured && !starter._injuryNotified) {
        starter._injuryNotified = true;
        return { position: pos, player: starter };
      }
    }
    return null;
  }
}

function getTeamMVP(team) {
  let best = null, bestScore = -1;
  for (const players of Object.values(team.roster)) {
    for (const p of players) {
      const score = p.mvpScore();
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  return best;
}

/* Formata as stats relevantes de um jogador para exibição */
function formatPlayerStats(p) {
  const g = p.gameStats;
  const parts = [];
  if (g.passYards > 0)    parts.push(`${g.passYards} jardas passe${g.passTDs ? ` · ${g.passTDs} TD` : ""}`);
  if (g.rushYards > 0)    parts.push(`${g.rushYards} jardas corrida${g.rushTDs ? ` · ${g.rushTDs} TD` : ""}`);
  if (g.recYards > 0)     parts.push(`${g.recYards} jardas rec${g.recTDs ? ` · ${g.recTDs} TD` : ""}`);
  if (g.sacks > 0)        parts.push(`${g.sacks} sack${g.sacks !== 1 ? "s" : ""}`);
  if (g.interceptions > 0) parts.push(`${g.interceptions} INT`);
  if (g.tackles > 0)      parts.push(`${Math.round(g.tackles)} tackles`);
  if (g.fumblesCaused > 0) parts.push(`${g.fumblesCaused} fumble`);
  if (g.fgMade > 0)       parts.push(`${g.fgMade} FG`);
  return parts.join("  ·  ") || "Em campo";
}

function createDefaultPlaybook() {
  const pb = new Playbook("Playbook Padrão", "West Coast", "4-3");
  pb.addPlay(new Play("Inside Run",     PlayType.RUN_INSIDE,  1, 2, [1,2], "short"));
  pb.addPlay(new Play("Sweep",          PlayType.RUN_OUTSIDE, 2, 3, [1,2], "any"));
  pb.addPlay(new Play("Slant Pass",     PlayType.PASS_SHORT,  1, 2, [1,2,3], "short"));
  pb.addPlay(new Play("Crossing Route", PlayType.PASS_MEDIUM, 2, 3, [2,3], "medium"));
  pb.addPlay(new Play("Fly Route",      PlayType.PASS_DEEP,   4, 5, [2,3], "long"));
  pb.addPlay(new Play("Play Action",    PlayType.PLAY_ACTION, 3, 4, [1,2], "any"));
  pb.addPlay(new Play("Screen Pass",    PlayType.SCREEN,      2, 3, [2,3], "medium"));
  pb.addPlay(new Play("QB Draw",        PlayType.QB_SCRAMBLE, 3, 3, [3], "medium"));
  pb.addPlay(new Play("Field Goal",     PlayType.FIELD_GOAL,  1, 3, [4], "any"));
  pb.addPlay(new Play("Punt",           PlayType.PUNT,        1, 1, [4], "any"));
  pb.addPlay(new Play("Cover 2 Zone",   PlayType.DEF_ZONE,    1, 2, [1,2], "any"));
  pb.addPlay(new Play("Man Coverage",   PlayType.DEF_MAN,     3, 3, [2,3], "any"));
  pb.addPlay(new Play("5-Man Blitz",    PlayType.DEF_BLITZ,   4, 5, [3], "long"));
  pb.addPlay(new Play("Prevent D",      PlayType.DEF_PREVENT, 1, 1, [3,4], "long"));
  pb.addPlay(new Play("DL Bull Rush",   PlayType.DEF_RUSH,    2, 3, [2,3], "medium"));
  return pb;
}

function createSampleTeam(name, city, abbr, strength = "medium") {
  const multipliers = { weak: 0.88, medium: 1.0, strong: 1.08 };
  const m = multipliers[strength] ?? 1.0;
  // Para rosters reais: OVR fica como definido (já calibrado), só attrs de mecânica variam levemente
  const applyM = (v) => Math.max(40, Math.min(99, Math.round(v * m) + randInt(-3, 3)));
  // OVR fica fiel ao real, com ruído mínimo e sem multiplicador de força
  const realOvr = (v) => Math.max(40, Math.min(99, v + randInt(-2, 2)));

  const pb = createDefaultPlaybook();
  const team = new Team(name, abbr, city, pb);

  const roster = ALL_ROSTERS[abbr];

  if (roster) {
    for (const p of roster.starters) {
      const ovr = realOvr(p.ovr);          // OVR fiel ao real
      const attrs = {};
      if (p.attrs) for (const [k,v] of Object.entries(p.attrs)) attrs[k] = applyM(v);
      team.addPlayer(new Player(p.name, Position[p.pos], ovr, attrs));
    }
    for (const p of roster.backups) {
      const ovr = realOvr(Math.max(40, p.ovr - 4));
      const attrs = {};
      if (p.attrs) for (const [k,v] of Object.entries(p.attrs)) attrs[k] = applyM(v * 0.9);
      team.addPlayer(new Player(p.name, Position[p.pos], ovr, attrs));
    }
  } else {
    // Fallback genérico para times sem roster detalhado
    const s = (base) => Math.max(40, Math.min(99, Math.floor(base * m) + randInt(-6, 6)));
    const sb = (base) => Math.max(35, Math.min(90, Math.floor(base * m * 0.87) + randInt(-5, 5)));
    team.addPlayer(new Player("QB Titular",   Position.QB, s(80), { passing:s(82),running:s(68),speed:s(70) }));
    team.addPlayer(new Player("RB Titular",   Position.RB, s(76), { running:s(80),strength:s(74),speed:s(82) }));
    team.addPlayer(new Player("WR Titular",   Position.WR, s(78), { catching:s(82),speed:s(88) }));
    team.addPlayer(new Player("TE Titular",   Position.TE, s(72), { catching:s(76),blocking:s(70) }));
    team.addPlayer(new Player("OL Titular",   Position.OL, s(76), { blocking:s(80),strength:s(80) }));
    team.addPlayer(new Player("DE Titular",   Position.DE, s(78), { pass_rush:s(80),speed:s(80),tackle:s(76) }));
    team.addPlayer(new Player("DT Titular",   Position.DT, s(74), { strength:s(86),tackle:s(78) }));
    team.addPlayer(new Player("LB Titular",   Position.LB, s(76), { tackle:s(80),coverage:s(70) }));
    team.addPlayer(new Player("CB Titular",   Position.CB, s(75), { coverage:s(80),speed:s(84) }));
    team.addPlayer(new Player("S Titular",    Position.S,  s(74), { coverage:s(76),tackle:s(72) }));
    team.addPlayer(new Player("K Titular",    Position.K,  s(72), { speed:52 }));
    team.addPlayer(new Player("QB Reserva",   Position.QB, sb(80), { passing:sb(82),running:sb(68) }));
    team.addPlayer(new Player("RB Reserva",   Position.RB, sb(76), { running:sb(80),speed:sb(82) }));
    team.addPlayer(new Player("WR Reserva",   Position.WR, sb(78), { catching:sb(82),speed:sb(88) }));
    team.addPlayer(new Player("TE Reserva",   Position.TE, sb(72), { catching:sb(76),blocking:sb(70) }));
    team.addPlayer(new Player("OL Reserva",   Position.OL, sb(76), { blocking:sb(80),strength:sb(80) }));
    team.addPlayer(new Player("DE Reserva",   Position.DE, sb(78), { pass_rush:sb(80),tackle:sb(76) }));
    team.addPlayer(new Player("DT Reserva",   Position.DT, sb(74), { strength:sb(86),tackle:sb(78) }));
    team.addPlayer(new Player("LB Reserva",   Position.LB, sb(76), { tackle:sb(80),coverage:sb(70) }));
    team.addPlayer(new Player("CB Reserva",   Position.CB, sb(75), { coverage:sb(80),speed:sb(84) }));
    team.addPlayer(new Player("S Reserva",    Position.S,  sb(74), { coverage:sb(76),tackle:sb(72) }));
    team.addPlayer(new Player("K Reserva",    Position.K,  sb(72), { speed:52 }));
  }

  return team;
}

class GameState {
  constructor(homeTeam, awayTeam) {
    this.homeTeam = homeTeam;
    this.awayTeam = awayTeam;
    this.possession = "home";
    this.ballPosition = 25;
    this.down = 1;
    this.yardsToGo = 10;
    this.quarter = 1;
    this.secondsLeft = 900;
    this.gameOver = false;
  }
  get offense() { return this.possession === "home" ? this.homeTeam : this.awayTeam; }
  get defense() { return this.possession === "home" ? this.awayTeam : this.homeTeam; }
  get yardsToEndzone() { return 100 - this.ballPosition; }

  switchPossession() {
    this.possession = this.possession === "home" ? "away" : "home";
    this.ballPosition = 100 - this.ballPosition;
    this.down = 1;
    this.yardsToGo = 10;
  }
  nextQuarter() {
    // Fim do Q4 empatado → prorrogação de 10 min (sudden death)
    if (this.quarter === 4 && this.homeTeam.score === this.awayTeam.score) {
      this.quarter = 5;
      this.secondsLeft = 600;
      this.overtime = true;
      this.switchPossession();
      this.ballPosition = 25;
      return false;
    }
    // Fim da prorrogação (ou Q4 com vencedor) → encerra
    if (this.quarter >= 4) {
      this.gameOver = true;
      return true;
    }
    // Transição normal Q1→Q2→Q3→Q4
    this.quarter += 1;
    this.secondsLeft = 900;
    if (this.quarter === 3) {
      this.switchPossession();
      this.ballPosition = 25;
    }
    return false;
  }
}

class PlayResult {
  constructor(yards, event, description, turnover = false, points = 0) {
    this.yards = yards;
    this.event = event;
    this.description = description;
    this.turnover = turnover;
    this.points = points;
  }
}

class GameEngine {
  constructor(state) { this.state = state; }

  simulateFieldGoal() {
    const kicker = this.state.offense.getStarter(Position.K);
    const distance = this.state.yardsToEndzone + 17;
    let baseChance = 0.95 - (Math.max(0, distance - 30) * 0.025);
    if (kicker) baseChance += (kicker.overall - 70) * 0.003;
    const success = Math.random() < Math.max(0.1, baseChance);
    if (success) return new PlayResult(0, "field_goal_good", `Field goal de ${distance} jardas — É BOM!`, false, 3);
    return new PlayResult(0, "field_goal_miss", `Field goal de ${distance} jardas — ERROU`, true, 0);
  }

  simulatePunt() {
    const avgPunt = 45 + randInt(-8, 8);
    return new PlayResult(0, "punt", `Punt de ${avgPunt} jardas`, true, 0);
  }

  _resolveRun(play, offense, defense) {
    const rb = offense.getStarter(Position.RB);
    const ol = offense.getStarter(Position.OL);
    const lb = defense.getStarter(Position.LB);
    const dt = defense.getStarter(Position.DT);

    let offPower = 50;
    if (rb) offPower += rb.effectiveStat("running") * 0.4;
    if (ol) offPower += ol.effectiveStat("blocking") * 0.3;
    let defPower = 50;
    if (lb) defPower += lb.effectiveStat("tackle") * 0.4;
    if (dt) defPower += dt.effectiveStat("tackle") * 0.3;

    const ratio = offPower / Math.max(1, defPower);
    let baseYards = randGauss(3.5 * ratio, 2.5);
    baseYards *= (0.8 + play.reward * 0.08);
    let yards = Math.floor(baseYards);

    if (Math.random() < 0.015) {
      const rbName = rb ? rb.name : "RB";
      return new PlayResult(Math.max(-2, Math.floor(yards / 2)), "fumble", `FUMBLE! ${rbName} soltou a bola!`, true, 0);
    }

    const maxYds = play.playType === PlayType.RUN_OUTSIDE ? 30 : 20;
    yards = Math.max(-3, Math.min(yards, maxYds));
    const desc = `Corrida de ${yards} jarda${Math.abs(yards) !== 1 ? "s" : ""}`;
    return new PlayResult(yards, "normal", desc);
  }

  _resolvePass(play, offense, defense) {
    const qb = offense.getStarter(Position.QB);
    const wr = offense.getStarter(Position.WR);
    const de = defense.getStarter(Position.DE);
    const cb = defense.getStarter(Position.CB);
    const s  = defense.getStarter(Position.S);
    const ol = offense.getStarter(Position.OL);

    const passRush = de ? de.effectiveStat("pass_rush") : 50;
    const blocking = ol ? ol.effectiveStat("blocking")  : 50;
    const sackChance = Math.max(0.01, 0.06 + (passRush - blocking) * 0.0015 + (play.risk - 1) * 0.01);
    if (Math.random() < sackChance) {
      const qbName = qb ? qb.name : "QB";
      return new PlayResult(randInt(-8, -3), "sack", `SACK! ${qbName} derrubado atrás da linha!`);
    }

    const depthMap = {
      [PlayType.PASS_SHORT]:  [3, 11],
      [PlayType.PASS_MEDIUM]: [7, 19],
      [PlayType.PASS_DEEP]:   [18, 45],
      [PlayType.PLAY_ACTION]: [6, 22],
      [PlayType.SCREEN]:      [1, 11],
      [PlayType.QB_SCRAMBLE]: [1, 13],
    };
    const [minYds, maxYds] = depthMap[play.playType] || [4, 13];

    const qbPass  = qb ? qb.effectiveStat("passing")  : 65;
    const wrCatch = wr ? wr.effectiveStat("catching") : 65;
    const cbCov   = cb ? cb.effectiveStat("coverage") : 65;
    const sCov    = s  ? s.effectiveStat("coverage")  : 60;

    const completionBase = (qbPass * 0.4 + wrCatch * 0.3) / 100;
    const coveragePenalty = (cbCov * 0.25 + sCov * 0.15) / 100;
    const completionChance = Math.max(0.18, Math.min(0.82, 0.60 + completionBase - coveragePenalty));

    const intBase = 0.04 + (play.risk - 1) * 0.015;
    if (Math.random() < intBase * (1 - completionChance + 0.5)) {
      const cbName = cb ? cb.name : "CB";
      return new PlayResult(0, "interception", `INTERCEPTADO! ${cbName} roubou a bola!`, true, 0);
    }

    if (Math.random() < completionChance) {
      const yards = Math.floor(randUniform(minYds, maxYds));
      const wrName = wr ? wr.name : "WR";
      let desc = `Passe completo para ${wrName} — ${yards} jardas`;
      if (yards >= 25) desc += " GRANDE GANHO!";
      return new PlayResult(yards, "normal", desc);
    }

    return new PlayResult(0, "normal", "Passe incompleto — bola no chão");
  }

  simulatePlay(offPlay, defPlay) {
    const offense = this.state.offense;
    const defense = this.state.defense;
    const matchupBonus = this._calcMatchup(offPlay, defPlay);

    let result;
    if (offPlay.playType === PlayType.RUN_INSIDE || offPlay.playType === PlayType.RUN_OUTSIDE) {
      result = this._resolveRun(offPlay, offense, defense);
      // Stats: RB acumula jardas de corrida
      if (result.yards > 0 && result.event !== "fumble") {
        const rb = offense.getStarter(Position.RB);
        if (rb) rb.gameStats.rushYards += result.yards;
        // TD de corrida é detectado em applyResult — guardamos referência
        this._lastRunnerPos = Position.RB;
      }
    } else if (offPlay.playType === PlayType.PUNT) {
      result = this.simulatePunt();
    } else if (offPlay.playType === PlayType.FIELD_GOAL) {
      result = this.simulateFieldGoal();
    } else {
      result = this._resolvePass(offPlay, offense, defense);
      if (result.event === "normal" && result.yards > 0) {
        const qb = offense.getStarter(Position.QB);
        const wr = offense.getStarter(Position.WR);
        if (qb) qb.gameStats.passYards += result.yards;
        if (wr) wr.gameStats.recYards  += result.yards;
      } else if (result.event === "sack") {
        const de = defense.getStarter(Position.DE);
        if (de) de.gameStats.sacks += 1;
      } else if (result.event === "interception") {
        const cb = defense.getStarter(Position.CB);
        if (cb) cb.gameStats.interceptions += 1;
      }
      this._lastRunnerPos = null;
    }

    if (result.event === "fumble") {
      // LB ou DE causou o fumble
      const de = defense.getStarter(Position.DE);
      if (de) de.gameStats.fumblesCaused += 1;
    }

    // Sack: tackle do LB
    if (result.event === "normal" || result.event === "sack") {
      const lb = defense.getStarter(Position.LB);
      if (lb && result.yards < 0 && result.event !== "sack") lb.gameStats.tackles += 1;
      else if (lb && result.yards <= 3 && result.event === "normal") lb.gameStats.tackles += 0.5;
    }

    if (result.event === "normal" && matchupBonus !== 0) {
      result.yards = Math.max(-5, result.yards + matchupBonus);
    }

    this._applyFatigue(offense, offPlay);
    this._applyFatigue(defense, defPlay);
    return result;
  }

  _calcMatchup(off, defPlay) {
    const matchups = {
      [`${PlayType.RUN_INSIDE}|${PlayType.DEF_BLITZ}`]: 3,
      [`${PlayType.RUN_OUTSIDE}|${PlayType.DEF_BLITZ}`]: 2,
      [`${PlayType.PASS_DEEP}|${PlayType.DEF_BLITZ}`]: 5,
      [`${PlayType.PASS_SHORT}|${PlayType.DEF_BLITZ}`]: 2,
      [`${PlayType.PASS_DEEP}|${PlayType.DEF_PREVENT}`]: -6,
      [`${PlayType.PASS_SHORT}|${PlayType.DEF_ZONE}`]: -1,
      [`${PlayType.PASS_MEDIUM}|${PlayType.DEF_MAN}`]: 3,
      [`${PlayType.PLAY_ACTION}|${PlayType.DEF_MAN}`]: 4,
      [`${PlayType.PLAY_ACTION}|${PlayType.DEF_ZONE}`]: 2,
      [`${PlayType.SCREEN}|${PlayType.DEF_BLITZ}`]: 5,
      [`${PlayType.SCREEN}|${PlayType.DEF_MAN}`]: 2,
      [`${PlayType.RUN_INSIDE}|${PlayType.DEF_RUSH}`]: -2,
    };
    return matchups[`${off.playType}|${defPlay.playType}`] || 0;
  }

  _applyFatigue(team, play) {
    // Fadiga removida — apenas risco de lesão aleatório por jogada no titular ativo
    for (const pos of Object.keys(team.roster)) {
      const starter = team.getStarter(pos);
      if (!starter || starter.injured) continue;
      this._checkInjury(starter);
    }
  }

  _checkInjury(player) {
    // ~0.07% por jogada por jogador → 11 pos × 2 times × 105 jogadas × 0.0007 ≈ 1.6 lesões/jogo
    if (Math.random() < 0.0007) {
      player.injured = true;
    }
  }

  applyResult(result) {
    const state = this.state;
    const offense = state.offense;

    // Tempo por jogada calibrado para ~120-130 jogadas totais por jogo (como NFL real)
    const timeUsed = randInt(25, 45);
    state.secondsLeft = Math.max(0, state.secondsLeft - timeUsed);
    offense.playsRun += 1;

    if (result.event === "interception" || result.event === "fumble") {
      offense.turnovers += 1;
    }

    if (result.event === "field_goal_good") {
      offense.score += 3;
      // FG stat para o kicker
      const k = offense.getStarter(Position.K);
      if (k) k.gameStats.fgMade += 1;
      state.switchPossession();
      state.ballPosition = 25;
      if (state.overtime) { state.gameOver = true; }
      return `Field goal! ${offense.name} +3 | ${state.homeTeam.score} x ${state.awayTeam.score}`;
    }
    if (result.event === "field_goal_miss") {
      state.switchPossession();
      state.ballPosition = Math.max(20, 100 - state.ballPosition);
      return "Field goal perdido. Troca de posse.";
    }
    if (result.event === "punt") {
      const puntYds = randInt(35, 55);
      state.switchPossession();
      state.ballPosition = Math.max(20, 100 - (state.ballPosition + puntYds));
      return `Punt de ${puntYds} jardas. Troca de posse.`;
    }

    state.ballPosition += result.yards;

    if (result.yards > 0) {
      offense.totalYards += result.yards;
      if (result.event === "normal") {
        if (result.description.includes("Corrida")) offense.rushYards += result.yards;
        else offense.passYards += result.yards;
      }
    }

    if (state.ballPosition >= 100 && result.event !== "interception") {
      offense.score += 7;
      // TD: crédito ao QB (passe) ou RB (corrida)
      const isRun = this._lastRunnerPos === Position.RB;
      if (isRun) {
        const rb = offense.getStarter(Position.RB);
        if (rb) { rb.gameStats.rushTDs += 1; rb.gameStats.rushYards = Math.max(0, rb.gameStats.rushYards); }
      } else {
        const qb = offense.getStarter(Position.QB);
        const wr = offense.getStarter(Position.WR);
        if (qb) qb.gameStats.passTDs += 1;
        if (wr) wr.gameStats.recTDs  += 1;
      }
      this._lastRunnerPos = null;
      state.switchPossession();
      state.ballPosition = 25;
      if (state.overtime) { state.gameOver = true; }
      return `TOUCHDOWN! ${offense.name} +7 | ${state.homeTeam.score} x ${state.awayTeam.score}`;
    }

    if (state.ballPosition <= 0) {
      const defense = state.defense;
      defense.score += 2;
      state.switchPossession();
      state.ballPosition = 25;
      return `SAFETY! ${defense.name} +2`;
    }

    if (result.turnover) {
      state.switchPossession();
      state.ballPosition = Math.max(10, 100 - state.ballPosition);
      return `Troca de posse! ${state.offense.name} começa em ${state.ballPosition} jardas.`;
    }

    state.yardsToGo -= result.yards;
    if (state.yardsToGo <= 0) {
      state.down = 1;
      state.yardsToGo = 10;
      offense.firstDowns += 1;
      return `FIRST DOWN! ${offense.name} | Jarda ${state.ballPosition}`;
    } else {
      state.down += 1;
      if (state.down > 4) {
        state.switchPossession();
        state.ballPosition = Math.max(10, 100 - state.ballPosition);
        return `Turnover on downs! ${state.offense.name} assume em ${state.ballPosition}`;
      }
      return `${state.down}º & ${state.yardsToGo} | Jarda ${state.ballPosition}`;
    }
  }
}
/* Rosters reais dos 32 times NFL (baseados na temporada 2024) */
const NFL_ROSTERS = {
  BAL: {
    starters: [
      { pos:"QB", name:"Lamar Jackson",   ovr:98, attrs:{passing:96,running:95,speed:88} },
      { pos:"RB", name:"Derrick Henry",   ovr:88, attrs:{running:90,strength:88,speed:86} },
      { pos:"WR", name:"Zay Flowers",     ovr:82, attrs:{catching:84,speed:90} },
      { pos:"TE", name:"Mark Andrews",    ovr:88, attrs:{catching:90,blocking:72,speed:78} },
      { pos:"OL", name:"Ronnie Stanley",  ovr:84, attrs:{blocking:86,strength:82} },
      { pos:"DE", name:"Odafe Oweh",      ovr:82, attrs:{pass_rush:84,speed:86,tackle:78} },
      { pos:"DT", name:"Justin Madubuike",ovr:84, attrs:{pass_rush:82,strength:88,tackle:84} },
      { pos:"LB", name:"Roquan Smith",    ovr:90, attrs:{tackle:92,coverage:78,speed:82} },
      { pos:"CB", name:"Marlon Humphrey", ovr:86, attrs:{coverage:88,speed:86,tackle:72} },
      { pos:"S",  name:"Kyle Hamilton",   ovr:92, attrs:{coverage:90,tackle:86,speed:84} },
      { pos:"K",  name:"Justin Tucker",   ovr:94, attrs:{speed:50} },
    ],
    backups: [
      { pos:"QB", name:"Josh Johnson",    ovr:68 },
      { pos:"RB", name:"Justice Hill",    ovr:72, attrs:{running:74,speed:88} },
      { pos:"WR", name:"Nelson Agholor",  ovr:74, attrs:{catching:76,speed:86} },
      { pos:"TE", name:"Isaiah Likely",   ovr:76, attrs:{catching:78,blocking:65} },
      { pos:"OL", name:"Andrew Vorhees",  ovr:70, attrs:{blocking:72,strength:74} },
      { pos:"DE", name:"Tavius Robinson", ovr:72, attrs:{pass_rush:74,tackle:70} },
      { pos:"DT", name:"Travis Jones",    ovr:74, attrs:{strength:80,tackle:76} },
      { pos:"LB", name:"Malik Harrison",  ovr:72, attrs:{tackle:74,coverage:68} },
      { pos:"CB", name:"Brandon Stephens",ovr:76, attrs:{coverage:78,speed:82} },
      { pos:"S",  name:"Geno Stone",      ovr:76, attrs:{coverage:74,tackle:78} },
      { pos:"K",  name:"Jeff Okudah",     ovr:65 },
    ]
  },
  PIT: {
    starters: [
      { pos:"QB", name:"Russell Wilson",  ovr:80, attrs:{passing:80,running:72,speed:74} },
      { pos:"RB", name:"Najee Harris",    ovr:78, attrs:{running:80,strength:78,speed:78} },
      { pos:"WR", name:"George Pickens",  ovr:84, attrs:{catching:86,speed:88} },
      { pos:"TE", name:"Pat Freiermuth",  ovr:78, attrs:{catching:80,blocking:74} },
      { pos:"OL", name:"Dan Moore Jr.",   ovr:76, attrs:{blocking:78,strength:76} },
      { pos:"DE", name:"T.J. Watt",       ovr:98, attrs:{pass_rush:98,speed:88,tackle:90} },
      { pos:"DT", name:"Cameron Heyward", ovr:88, attrs:{pass_rush:86,strength:92,tackle:88} },
      { pos:"LB", name:"Patrick Queen",   ovr:84, attrs:{tackle:86,coverage:76,speed:82} },
      { pos:"CB", name:"Joey Porter Jr.", ovr:80, attrs:{coverage:82,speed:86} },
      { pos:"S",  name:"Minkah Fitzpatrick",ovr:90,attrs:{coverage:88,tackle:84,speed:82} },
      { pos:"K",  name:"Chris Boswell",   ovr:86, attrs:{speed:55} },
    ],
    backups: [
      { pos:"QB", name:"Justin Fields",   ovr:76, attrs:{passing:74,running:86,speed:84} },
      { pos:"RB", name:"Cordarrelle Patterson",ovr:72,attrs:{running:74,speed:80} },
      { pos:"WR", name:"Van Jefferson",   ovr:72, attrs:{catching:74,speed:84} },
      { pos:"TE", name:"Darnell Washington",ovr:74,attrs:{catching:72,blocking:80} },
      { pos:"OL", name:"James Daniels",   ovr:74, attrs:{blocking:76,strength:74} },
      { pos:"DE", name:"Alex Highsmith",  ovr:82, attrs:{pass_rush:84,tackle:76} },
      { pos:"DT", name:"Montravius Adams",ovr:70, attrs:{strength:76,tackle:72} },
      { pos:"LB", name:"Cole Holcomb",    ovr:72, attrs:{tackle:74,coverage:70} },
      { pos:"CB", name:"Donte Jackson",   ovr:76, attrs:{coverage:78,speed:84} },
      { pos:"S",  name:"DeShon Elliott",  ovr:74, attrs:{coverage:72,tackle:76} },
      { pos:"K",  name:"Cameron Johnston",ovr:68 },
    ]
  },
  CLE: {
    starters: [
      { pos:"QB", name:"Deshaun Watson",  ovr:76, attrs:{passing:80,running:76,speed:78} },
      { pos:"RB", name:"Nick Chubb",      ovr:88, attrs:{running:92,strength:86,speed:84} },
      { pos:"WR", name:"Amari Cooper",    ovr:84, attrs:{catching:86,speed:88} },
      { pos:"TE", name:"David Njoku",     ovr:84, attrs:{catching:86,blocking:76,speed:82} },
      { pos:"OL", name:"Jack Conklin",    ovr:80, attrs:{blocking:82,strength:80} },
      { pos:"DE", name:"Myles Garrett",   ovr:98, attrs:{pass_rush:98,speed:90,tackle:88} },
      { pos:"DT", name:"Dalvin Tomlinson",ovr:82, attrs:{strength:88,pass_rush:78,tackle:84} },
      { pos:"LB", name:"Jeremiah Owusu-Koramoah",ovr:84,attrs:{tackle:84,coverage:82,speed:86} },
      { pos:"CB", name:"Denzel Ward",     ovr:86, attrs:{coverage:88,speed:88} },
      { pos:"S",  name:"Juan Thornhill",  ovr:78, attrs:{coverage:78,tackle:76} },
      { pos:"K",  name:"Dustin Hopkins",  ovr:80, attrs:{speed:52} },
    ],
    backups: [
      { pos:"QB", name:"Joe Flacco",      ovr:72, attrs:{passing:76,running:52} },
      { pos:"RB", name:"Jerome Ford",     ovr:74, attrs:{running:76,speed:86} },
      { pos:"WR", name:"Marquise Goodwin",ovr:70, attrs:{catching:72,speed:90} },
      { pos:"TE", name:"Jordan Akins",    ovr:70, attrs:{catching:72,blocking:68} },
      { pos:"OL", name:"Wyatt Teller",    ovr:78, attrs:{blocking:80,strength:80} },
      { pos:"DE", name:"Za'Darius Smith", ovr:78, attrs:{pass_rush:80,tackle:74} },
      { pos:"DT", name:"Maurice Hurst",   ovr:68, attrs:{strength:74,tackle:70} },
      { pos:"LB", name:"Mohamoud Diabate",ovr:70, attrs:{tackle:72,coverage:68} },
      { pos:"CB", name:"Greg Newsome II", ovr:78, attrs:{coverage:80,speed:86} },
      { pos:"S",  name:"Ronnie Harrison", ovr:72, attrs:{coverage:70,tackle:74} },
      { pos:"K",  name:"Matt Ammendola",  ovr:64 },
    ]
  },
  CIN: {
    starters: [
      { pos:"QB", name:"Joe Burrow",      ovr:92, attrs:{passing:94,running:72,speed:72} },
      { pos:"RB", name:"Zack Moss",       ovr:76, attrs:{running:78,strength:76,speed:78} },
      { pos:"WR", name:"Ja'Marr Chase",   ovr:96, attrs:{catching:96,speed:94} },
      { pos:"TE", name:"Mike Gesicki",    ovr:78, attrs:{catching:82,blocking:66,speed:78} },
      { pos:"OL", name:"Orlando Brown Jr.",ovr:82,attrs:{blocking:84,strength:82} },
      { pos:"DE", name:"Trey Hendrickson",ovr:90, attrs:{pass_rush:92,speed:84,tackle:82} },
      { pos:"DT", name:"DJ Reader",       ovr:84, attrs:{strength:90,pass_rush:80,tackle:86} },
      { pos:"LB", name:"Logan Wilson",    ovr:80, attrs:{tackle:82,coverage:76,speed:78} },
      { pos:"CB", name:"Cam Taylor-Britt",ovr:78, attrs:{coverage:80,speed:86} },
      { pos:"S",  name:"Dax Hill",        ovr:80, attrs:{coverage:80,tackle:78,speed:84} },
      { pos:"K",  name:"Evan McPherson",  ovr:84, attrs:{speed:54} },
    ],
    backups: [
      { pos:"QB", name:"Jake Browning",   ovr:70, attrs:{passing:72,running:62} },
      { pos:"RB", name:"Chase Brown",     ovr:74, attrs:{running:76,speed:84} },
      { pos:"WR", name:"Tee Higgins",     ovr:86, attrs:{catching:88,speed:84} },
      { pos:"TE", name:"Drew Sample",     ovr:70, attrs:{catching:68,blocking:76} },
      { pos:"OL", name:"Alex Cappa",      ovr:74, attrs:{blocking:76,strength:76} },
      { pos:"DE", name:"Sam Hubbard",     ovr:78, attrs:{pass_rush:80,tackle:76} },
      { pos:"DT", name:"Sheldon Rankins", ovr:72, attrs:{strength:78,tackle:74} },
      { pos:"LB", name:"Germaine Pratt",  ovr:74, attrs:{tackle:76,coverage:70} },
      { pos:"CB", name:"Mike Hilton",     ovr:76, attrs:{coverage:78,speed:78} },
      { pos:"S",  name:"Jordan Battle",   ovr:72, attrs:{coverage:70,tackle:74} },
      { pos:"K",  name:"Brad Robbins",    ovr:66 },
    ]
  },
  KC: {
    starters: [
      { pos:"QB", name:"Patrick Mahomes", ovr:99, attrs:{passing:98,running:82,speed:80} },
      { pos:"RB", name:"Isiah Pacheco",   ovr:82, attrs:{running:84,strength:80,speed:86} },
      { pos:"WR", name:"Rashee Rice",     ovr:82, attrs:{catching:84,speed:88} },
      { pos:"TE", name:"Travis Kelce",    ovr:95, attrs:{catching:96,blocking:78,speed:80} },
      { pos:"OL", name:"Jawaan Taylor",   ovr:82, attrs:{blocking:84,strength:82} },
      { pos:"DE", name:"Chris Jones",     ovr:96, attrs:{pass_rush:96,speed:86,tackle:88} },
      { pos:"DT", name:"Derrick Nnadi",   ovr:76, attrs:{strength:84,tackle:78} },
      { pos:"LB", name:"Nick Bolton",     ovr:84, attrs:{tackle:86,coverage:76,speed:82} },
      { pos:"CB", name:"Trent McDuffie",  ovr:88, attrs:{coverage:90,speed:88} },
      { pos:"S",  name:"Justin Reid",     ovr:82, attrs:{coverage:82,tackle:80} },
      { pos:"K",  name:"Harrison Butker", ovr:90, attrs:{speed:54} },
    ],
    backups: [
      { pos:"QB", name:"Carson Wentz",    ovr:70, attrs:{passing:72,running:68} },
      { pos:"RB", name:"Clyde Edwards-Helaire",ovr:72,attrs:{running:74,speed:82} },
      { pos:"WR", name:"Hollywood Brown", ovr:78, attrs:{catching:80,speed:90} },
      { pos:"TE", name:"Noah Gray",       ovr:72, attrs:{catching:74,blocking:68} },
      { pos:"OL", name:"Joe Thuney",      ovr:82, attrs:{blocking:84,strength:80} },
      { pos:"DE", name:"George Karlaftis",ovr:82, attrs:{pass_rush:84,tackle:78} },
      { pos:"DT", name:"Tershawn Wharton",ovr:74, attrs:{strength:80,pass_rush:72} },
      { pos:"LB", name:"Leo Chenal",      ovr:74, attrs:{tackle:76,coverage:68} },
      { pos:"CB", name:"L'Jarius Sneed",  ovr:84, attrs:{coverage:86,speed:86} },
      { pos:"S",  name:"Bryan Cook",      ovr:74, attrs:{coverage:72,tackle:76} },
      { pos:"K",  name:"Tommy Townsend",  ovr:74 },
    ]
  },
  BUF: {
    starters: [
      { pos:"QB", name:"Josh Allen",      ovr:97, attrs:{passing:94,running:90,speed:84} },
      { pos:"RB", name:"James Cook",      ovr:84, attrs:{running:86,speed:90,strength:74} },
      { pos:"WR", name:"Stefon Diggs",    ovr:88, attrs:{catching:90,speed:88} },
      { pos:"TE", name:"Dalton Kincaid",  ovr:78, attrs:{catching:82,blocking:68,speed:78} },
      { pos:"OL", name:"Spencer Brown",   ovr:78, attrs:{blocking:80,strength:80} },
      { pos:"DE", name:"Von Miller",      ovr:84, attrs:{pass_rush:88,speed:82,tackle:80} },
      { pos:"DT", name:"Ed Oliver",       ovr:86, attrs:{pass_rush:84,strength:88,tackle:86} },
      { pos:"LB", name:"Matt Milano",     ovr:86, attrs:{tackle:84,coverage:82,speed:84} },
      { pos:"CB", name:"Tre'Davious White",ovr:82,attrs:{coverage:84,speed:86} },
      { pos:"S",  name:"Micah Hyde",      ovr:82, attrs:{coverage:84,tackle:76} },
      { pos:"K",  name:"Tyler Bass",      ovr:82, attrs:{speed:56} },
    ],
    backups: [
      { pos:"QB", name:"Kyle Allen",      ovr:66, attrs:{passing:68,running:62} },
      { pos:"RB", name:"Latavius Murray", ovr:68, attrs:{running:70,strength:78} },
      { pos:"WR", name:"Gabe Davis",      ovr:76, attrs:{catching:78,speed:88} },
      { pos:"TE", name:"Quintin Morris",  ovr:68, attrs:{catching:70,blocking:65} },
      { pos:"OL", name:"Connor McGovern", ovr:72, attrs:{blocking:74,strength:74} },
      { pos:"DE", name:"Leonard Floyd",   ovr:78, attrs:{pass_rush:80,tackle:74} },
      { pos:"DT", name:"Tim Settle",      ovr:70, attrs:{strength:78,tackle:72} },
      { pos:"LB", name:"Tyrel Dodson",    ovr:72, attrs:{tackle:74,coverage:68} },
      { pos:"CB", name:"Taron Johnson",   ovr:78, attrs:{coverage:80,speed:82} },
      { pos:"S",  name:"Jordan Poyer",    ovr:78, attrs:{coverage:76,tackle:80} },
      { pos:"K",  name:"Sam Martin",      ovr:68 },
    ]
  },
  SF: {
    starters: [
      { pos:"QB", name:"Brock Purdy",     ovr:88, attrs:{passing:88,running:74,speed:72} },
      { pos:"RB", name:"Christian McCaffrey",ovr:98,attrs:{running:96,speed:92,catching:92,strength:80} },
      { pos:"WR", name:"Deebo Samuel",    ovr:88, attrs:{catching:88,speed:90} },
      { pos:"TE", name:"George Kittle",   ovr:94, attrs:{catching:92,blocking:88,speed:84} },
      { pos:"OL", name:"Trent Williams",  ovr:98, attrs:{blocking:98,strength:94} },
      { pos:"DE", name:"Nick Bosa",       ovr:97, attrs:{pass_rush:98,speed:88,tackle:86} },
      { pos:"DT", name:"Javon Hargrave",  ovr:88, attrs:{pass_rush:86,strength:90,tackle:88} },
      { pos:"LB", name:"Fred Warner",     ovr:94, attrs:{tackle:92,coverage:90,speed:86} },
      { pos:"CB", name:"Charvarius Ward", ovr:84, attrs:{coverage:86,speed:86} },
      { pos:"S",  name:"Talanoa Hufanga", ovr:84, attrs:{coverage:82,tackle:84} },
      { pos:"K",  name:"Jake Moody",      ovr:76, attrs:{speed:54} },
    ],
    backups: [
      { pos:"QB", name:"Sam Darnold",     ovr:72, attrs:{passing:74,running:68} },
      { pos:"RB", name:"Jordan Mason",    ovr:76, attrs:{running:78,strength:80,speed:80} },
      { pos:"WR", name:"Brandon Aiyuk",   ovr:88, attrs:{catching:90,speed:88} },
      { pos:"TE", name:"Ross Dwelley",    ovr:68, attrs:{catching:68,blocking:72} },
      { pos:"OL", name:"Mike McGlinchey", ovr:78, attrs:{blocking:80,strength:80} },
      { pos:"DE", name:"Uchenna Nwosu",   ovr:78, attrs:{pass_rush:80,tackle:74} },
      { pos:"DT", name:"Arik Armstead",   ovr:80, attrs:{strength:86,pass_rush:78,tackle:82} },
      { pos:"LB", name:"Dre Greenlaw",    ovr:82, attrs:{tackle:84,coverage:78} },
      { pos:"CB", name:"Ambry Thomas",    ovr:72, attrs:{coverage:74,speed:84} },
      { pos:"S",  name:"Ji'Ayir Brown",   ovr:70, attrs:{coverage:68,tackle:72} },
      { pos:"K",  name:"Mitch Wishnowsky",ovr:74 },
    ]
  },
  PHI: {
    starters: [
      { pos:"QB", name:"Jalen Hurts",     ovr:94, attrs:{passing:90,running:92,speed:84} },
      { pos:"RB", name:"Saquon Barkley",  ovr:96, attrs:{running:96,speed:92,strength:86} },
      { pos:"WR", name:"A.J. Brown",      ovr:94, attrs:{catching:94,speed:88} },
      { pos:"TE", name:"Dallas Goedert",  ovr:90, attrs:{catching:90,blocking:80,speed:80} },
      { pos:"OL", name:"Lane Johnson",    ovr:94, attrs:{blocking:94,strength:88} },
      { pos:"DE", name:"Haason Reddick",  ovr:86, attrs:{pass_rush:88,speed:86,tackle:80} },
      { pos:"DT", name:"Jalen Carter",    ovr:88, attrs:{pass_rush:86,strength:92,tackle:88} },
      { pos:"LB", name:"Nakobe Dean",     ovr:78, attrs:{tackle:80,coverage:74,speed:82} },
      { pos:"CB", name:"Darius Slay",     ovr:86, attrs:{coverage:88,speed:86} },
      { pos:"S",  name:"C.J. Gardner-Johnson",ovr:84,attrs:{coverage:84,tackle:80} },
      { pos:"K",  name:"Jake Elliott",    ovr:84, attrs:{speed:56} },
    ],
    backups: [
      { pos:"QB", name:"Kenny Pickett",   ovr:72, attrs:{passing:74,running:72} },
      { pos:"RB", name:"Kenneth Gainwell",ovr:72, attrs:{running:74,speed:82} },
      { pos:"WR", name:"DeVonta Smith",   ovr:86, attrs:{catching:88,speed:88} },
      { pos:"TE", name:"Grant Calcaterra",ovr:68, attrs:{catching:70,blocking:64} },
      { pos:"OL", name:"Jordan Mailata",  ovr:80, attrs:{blocking:82,strength:84} },
      { pos:"DE", name:"Josh Sweat",      ovr:82, attrs:{pass_rush:84,tackle:76} },
      { pos:"DT", name:"Milton Williams", ovr:76, attrs:{strength:82,pass_rush:74} },
      { pos:"LB", name:"Zack Baun",       ovr:76, attrs:{tackle:78,coverage:72} },
      { pos:"CB", name:"James Bradberry", ovr:78, attrs:{coverage:80,speed:80} },
      { pos:"S",  name:"Reed Blankenship",ovr:74, attrs:{coverage:72,tackle:76} },
      { pos:"K",  name:"Arryn Siposs",    ovr:68 },
    ]
  },
  DAL: {
    starters: [
      { pos:"QB", name:"Dak Prescott",    ovr:90, attrs:{passing:90,running:78,speed:76} },
      { pos:"RB", name:"Tony Pollard",    ovr:84, attrs:{running:86,speed:90,strength:76} },
      { pos:"WR", name:"CeeDee Lamb",     ovr:96, attrs:{catching:96,speed:92} },
      { pos:"TE", name:"Jake Ferguson",   ovr:80, attrs:{catching:82,blocking:74} },
      { pos:"OL", name:"Tyron Smith",     ovr:86, attrs:{blocking:88,strength:86} },
      { pos:"DE", name:"Micah Parsons",   ovr:98, attrs:{pass_rush:96,speed:92,tackle:90} },
      { pos:"DT", name:"Neville Gallimore",ovr:76,attrs:{strength:84,pass_rush:74,tackle:78} },
      { pos:"LB", name:"Leighton Vander Esch",ovr:82,attrs:{tackle:84,coverage:74} },
      { pos:"CB", name:"Trevon Diggs",    ovr:86, attrs:{coverage:88,speed:84} },
      { pos:"S",  name:"Jayron Kearse",   ovr:76, attrs:{coverage:74,tackle:78} },
      { pos:"K",  name:"Brandon Aubrey",  ovr:86, attrs:{speed:56} },
    ],
    backups: [
      { pos:"QB", name:"Cooper Rush",     ovr:68, attrs:{passing:70,running:62} },
      { pos:"RB", name:"Rico Dowdle",     ovr:72, attrs:{running:74,speed:82} },
      { pos:"WR", name:"Brandin Cooks",   ovr:76, attrs:{catching:78,speed:86} },
      { pos:"TE", name:"Luke Schoonmaker",ovr:72, attrs:{catching:74,blocking:70} },
      { pos:"OL", name:"Chuma Edoga",     ovr:70, attrs:{blocking:72,strength:72} },
      { pos:"DE", name:"DeMarcus Lawrence",ovr:80,attrs:{pass_rush:82,tackle:78} },
      { pos:"DT", name:"Osa Odighizuwa",  ovr:78, attrs:{strength:82,pass_rush:76,tackle:80} },
      { pos:"LB", name:"Damone Clark",    ovr:72, attrs:{tackle:74,coverage:68} },
      { pos:"CB", name:"DaRon Bland",     ovr:82, attrs:{coverage:84,speed:82} },
      { pos:"S",  name:"Malik Hooker",    ovr:74, attrs:{coverage:72,tackle:76} },
      { pos:"K",  name:"Bryan Anger",     ovr:72 },
    ]
  },
  GB: {
    starters: [
      { pos:"QB", name:"Jordan Love",     ovr:88, attrs:{passing:88,running:76,speed:76} },
      { pos:"RB", name:"Josh Jacobs",     ovr:84, attrs:{running:86,strength:82,speed:82} },
      { pos:"WR", name:"Jayden Reed",     ovr:80, attrs:{catching:82,speed:88} },
      { pos:"TE", name:"Luke Musgrave",   ovr:76, attrs:{catching:78,blocking:70} },
      { pos:"OL", name:"David Bakhtiari", ovr:88, attrs:{blocking:90,strength:84} },
      { pos:"DE", name:"Rashan Gary",     ovr:84, attrs:{pass_rush:86,speed:88,tackle:78} },
      { pos:"DT", name:"Kenny Clark",     ovr:88, attrs:{pass_rush:84,strength:92,tackle:88} },
      { pos:"LB", name:"De'Vondre Campbell",ovr:82,attrs:{tackle:84,coverage:76,speed:78} },
      { pos:"CB", name:"Jaire Alexander", ovr:90, attrs:{coverage:92,speed:90} },
      { pos:"S",  name:"Xavier McKinney", ovr:86, attrs:{coverage:86,tackle:82} },
      { pos:"K",  name:"Anders Carlson",  ovr:76, attrs:{speed:54} },
    ],
    backups: [
      { pos:"QB", name:"Sean Clifford",   ovr:64, attrs:{passing:66,running:68} },
      { pos:"RB", name:"AJ Dillon",       ovr:76, attrs:{running:78,strength:90,speed:74} },
      { pos:"WR", name:"Christian Watson",ovr:78, attrs:{catching:80,speed:92} },
      { pos:"TE", name:"Tucker Kraft",    ovr:74, attrs:{catching:76,blocking:72} },
      { pos:"OL", name:"Elgton Jenkins",  ovr:84, attrs:{blocking:86,strength:82} },
      { pos:"DE", name:"Preston Smith",   ovr:78, attrs:{pass_rush:80,tackle:74} },
      { pos:"DT", name:"Devonte Wyatt",   ovr:74, attrs:{strength:80,pass_rush:72} },
      { pos:"LB", name:"Isaiah McDuffie", ovr:70, attrs:{tackle:72,coverage:68} },
      { pos:"CB", name:"Eric Stokes",     ovr:74, attrs:{coverage:76,speed:86} },
      { pos:"S",  name:"Rudy Ford",       ovr:70, attrs:{coverage:68,tackle:72} },
      { pos:"K",  name:"Daniel Whelan",   ovr:70 },
    ]
  },
  MIA: {
    starters: [
      { pos:"QB", name:"Tua Tagovailoa",  ovr:88, attrs:{passing:90,running:70,speed:70} },
      { pos:"RB", name:"Raheem Mostert",  ovr:78, attrs:{running:80,speed:88,strength:70} },
      { pos:"WR", name:"Tyreek Hill",     ovr:96, attrs:{catching:92,speed:99} },
      { pos:"TE", name:"Durham Smythe",   ovr:68, attrs:{catching:70,blocking:74} },
      { pos:"OL", name:"Terron Armstead", ovr:88, attrs:{blocking:90,strength:84} },
      { pos:"DE", name:"Bradley Chubb",   ovr:82, attrs:{pass_rush:86,speed:82,tackle:78} },
      { pos:"DT", name:"Christian Wilkins",ovr:86,attrs:{pass_rush:82,strength:90,tackle:86} },
      { pos:"LB", name:"Jerome Baker",    ovr:80, attrs:{tackle:82,coverage:76,speed:82} },
      { pos:"CB", name:"Jalen Ramsey",    ovr:88, attrs:{coverage:90,speed:88} },
      { pos:"S",  name:"Jevon Holland",   ovr:82, attrs:{coverage:82,tackle:78} },
      { pos:"K",  name:"Jason Sanders",   ovr:80, attrs:{speed:54} },
    ],
    backups: [
      { pos:"QB", name:"Skylar Thompson", ovr:64, attrs:{passing:66,running:70} },
      { pos:"RB", name:"De'Von Achane",   ovr:82, attrs:{running:84,speed:96,strength:64} },
      { pos:"WR", name:"Jaylen Waddle",   ovr:88, attrs:{catching:88,speed:94} },
      { pos:"TE", name:"Julian Hill",     ovr:66, attrs:{catching:68,blocking:68} },
      { pos:"OL", name:"Robert Jones",    ovr:70, attrs:{blocking:72,strength:74} },
      { pos:"DE", name:"Emmanuel Ogbah",  ovr:76, attrs:{pass_rush:78,tackle:72} },
      { pos:"DT", name:"Raekwon Davis",   ovr:74, attrs:{strength:82,tackle:76} },
      { pos:"LB", name:"David Long Jr.",  ovr:74, attrs:{tackle:76,coverage:72} },
      { pos:"CB", name:"Kader Kohou",     ovr:74, attrs:{coverage:76,speed:82} },
      { pos:"S",  name:"Brandon Jones",   ovr:72, attrs:{coverage:70,tackle:74} },
      { pos:"K",  name:"Jake Bailey",     ovr:70 },
    ]
  },
  DET: {
    starters: [
      { pos:"QB", name:"Jared Goff",      ovr:88, attrs:{passing:90,running:64,speed:66} },
      { pos:"RB", name:"David Montgomery",ovr:82, attrs:{running:84,strength:82,speed:80} },
      { pos:"WR", name:"Amon-Ra St. Brown",ovr:90,attrs:{catching:92,speed:88} },
      { pos:"TE", name:"Sam LaPorta",     ovr:80, attrs:{catching:82,blocking:72,speed:80} },
      { pos:"OL", name:"Penei Sewell",    ovr:92, attrs:{blocking:92,strength:90} },
      { pos:"DE", name:"Aidan Hutchinson",ovr:92, attrs:{pass_rush:92,speed:88,tackle:86} },
      { pos:"DT", name:"Alim McNeill",    ovr:80, attrs:{strength:88,pass_rush:76,tackle:82} },
      { pos:"LB", name:"Alex Anzalone",   ovr:76, attrs:{tackle:78,coverage:72} },
      { pos:"CB", name:"Carlton Davis",   ovr:80, attrs:{coverage:82,speed:84} },
      { pos:"S",  name:"Kerby Joseph",    ovr:82, attrs:{coverage:82,tackle:78} },
      { pos:"K",  name:"Michael Badgley", ovr:74, attrs:{speed:54} },
    ],
    backups: [
      { pos:"QB", name:"Hendon Hooker",   ovr:68, attrs:{passing:70,running:74} },
      { pos:"RB", name:"Jahmyr Gibbs",    ovr:84, attrs:{running:86,speed:92,strength:72} },
      { pos:"WR", name:"Josh Reynolds",   ovr:72, attrs:{catching:74,speed:80} },
      { pos:"TE", name:"Brock Wright",    ovr:66, attrs:{catching:66,blocking:68} },
      { pos:"OL", name:"Taylor Decker",   ovr:78, attrs:{blocking:80,strength:78} },
      { pos:"DE", name:"John Cominsky",   ovr:70, attrs:{pass_rush:72,tackle:68} },
      { pos:"DT", name:"Isaiah Buggs",    ovr:68, attrs:{strength:76,tackle:70} },
      { pos:"LB", name:"Malcolm Rodriguez",ovr:72,attrs:{tackle:74,coverage:68} },
      { pos:"CB", name:"Cam Sutton",      ovr:76, attrs:{coverage:78,speed:80} },
      { pos:"S",  name:"C.J. Gardner-Johnson",ovr:76,attrs:{coverage:76,tackle:74} },
      { pos:"K",  name:"Jake Bates",      ovr:68 },
    ]
  },
  // Times restantes usam a geração genérica mas com nomes mais realistas
};

/* Fallback: para times sem roster detalhado, usa nomes genéricos realistas por posição */
const GENERIC_ROSTER = {
  QB: [["T. Williams","B. Johnson"],["M. Davis","C. Brown"]],
  RB: [["J. Anderson","D. Harris"],["R. Jones","A. Smith"]],
  WR: [["K. Moore","T. Johnson"],["D. Adams","S. Davis"]],
  TE: [["D. Waller","J. Thomas"],["M. Gesicki","K. Pitts"]],
  OL: [["Z. Martin","R. Incognito"],["T. Smith","A. Brooks"]],
  DE: [["J. Hunter","S. Young"],["K. Mack","L. Joseph"]],
  DT: [["A. Donald","N. Suh"],["D. Lawrence","S. McLendon"]],
  LB: [["B. Wagner","D. White"],["F. Warner","B. Baker"]],
  CB: [["J. Ramsey","X. Howard"],["C. Hayward","B. Breeland"]],
  S:  [["B. Poyer","J. Simmons"],["M. Jenkins","D. Sorensen"]],
  K:  [["E. McPherson","J. Tucker"],["R. Succop","C. McLaughlin"]],
};

// Times com rosters simplificados (estrelas conhecidas + suplentes plausíveis)
const EXTRA_ROSTERS = {
  NE: {
    starters: [
      {pos:"QB",name:"Drake Maye",ovr:78,attrs:{passing:78,running:76,speed:78}},
      {pos:"RB",name:"Rhamondre Stevenson",ovr:78,attrs:{running:80,strength:84,speed:76}},
      {pos:"WR",name:"Kendrick Bourne",ovr:72,attrs:{catching:74,speed:82}},
      {pos:"TE",name:"Hunter Henry",ovr:76,attrs:{catching:78,blocking:72}},
      {pos:"OL",name:"Mike Onwenu",ovr:78,attrs:{blocking:80,strength:82}},
      {pos:"DE",name:"Matthew Judon",ovr:84,attrs:{pass_rush:86,speed:82,tackle:78}},
      {pos:"DT",name:"Davon Godchaux",ovr:76,attrs:{strength:84,tackle:78}},
      {pos:"LB",name:"Ja'Whaun Bentley",ovr:76,attrs:{tackle:78,coverage:70}},
      {pos:"CB",name:"Christian Gonzalez",ovr:80,attrs:{coverage:82,speed:86}},
      {pos:"S",name:"Kyle Dugger",ovr:80,attrs:{coverage:78,tackle:82}},
      {pos:"K",name:"Chad Ryland",ovr:70,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Jacoby Brissett",ovr:68},{pos:"RB",name:"Ezekiel Elliott",ovr:72,attrs:{running:74,strength:80}},
      {pos:"WR",name:"JuJu Smith-Schuster",ovr:72,attrs:{catching:74,speed:80}},{pos:"TE",name:"Mike Gesicki",ovr:72,attrs:{catching:74,blocking:68}},
      {pos:"OL",name:"Calvin Anderson",ovr:68},{pos:"DE",name:"Keion White",ovr:72,attrs:{pass_rush:74,tackle:70}},
      {pos:"DT",name:"Lawrence Guy",ovr:72},{pos:"LB",name:"Anfernee Jennings",ovr:68},
      {pos:"CB",name:"Marcus Jones",ovr:72,attrs:{coverage:74,speed:84}},{pos:"S",name:"Jabrill Peppers",ovr:72},
      {pos:"K",name:"Matthew Slater",ovr:64},
    ]
  },
  NYJ: {
    starters:[
      {pos:"QB",name:"Aaron Rodgers",ovr:86,attrs:{passing:88,running:66,speed:66}},
      {pos:"RB",name:"Breece Hall",ovr:86,attrs:{running:88,speed:90,strength:76}},
      {pos:"WR",name:"Garrett Wilson",ovr:90,attrs:{catching:92,speed:90}},
      {pos:"TE",name:"Tyler Conklin",ovr:72,attrs:{catching:74,blocking:70}},
      {pos:"OL",name:"Duane Brown",ovr:76,attrs:{blocking:78,strength:78}},
      {pos:"DE",name:"Quinnen Williams",ovr:90,attrs:{pass_rush:88,strength:92,tackle:88}},
      {pos:"DT",name:"Solomon Thomas",ovr:72,attrs:{strength:78,tackle:74}},
      {pos:"LB",name:"C.J. Mosley",ovr:84,attrs:{tackle:86,coverage:78}},
      {pos:"CB",name:"Sauce Gardner",ovr:94,attrs:{coverage:96,speed:90}},
      {pos:"S",name:"Jordan Whitehead",ovr:76,attrs:{coverage:74,tackle:78}},
      {pos:"K",name:"Greg Zuerlein",ovr:74,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Zach Wilson",ovr:68},{pos:"RB",name:"Michael Carter",ovr:70,attrs:{running:72,speed:84}},
      {pos:"WR",name:"Allen Lazard",ovr:72,attrs:{catching:74,speed:78}},{pos:"TE",name:"Jeremy Ruckert",ovr:66},
      {pos:"OL",name:"Alijah Vera-Tucker",ovr:74},{pos:"DE",name:"Bryce Huff",ovr:78,attrs:{pass_rush:80,tackle:72}},
      {pos:"DT",name:"Sheldon Rankins",ovr:70},{pos:"LB",name:"Marcell Harris",ovr:70},
      {pos:"CB",name:"D.J. Reed",ovr:80,attrs:{coverage:82,speed:84}},{pos:"S",name:"Tony Adams",ovr:68},
      {pos:"K",name:"Thomas Morstead",ovr:70},
    ]
  },
  LAC: {
    starters:[
      {pos:"QB",name:"Justin Herbert",ovr:92,attrs:{passing:92,running:74,speed:74}},
      {pos:"RB",name:"Austin Ekeler",ovr:84,attrs:{running:86,speed:86,catching:88}},
      {pos:"WR",name:"Keenan Allen",ovr:86,attrs:{catching:90,speed:82}},
      {pos:"TE",name:"Gerald Everett",ovr:74,attrs:{catching:76,blocking:68}},
      {pos:"OL",name:"Rashawn Slater",ovr:90,attrs:{blocking:92,strength:86}},
      {pos:"DE",name:"Joey Bosa",ovr:88,attrs:{pass_rush:90,speed:84,tackle:84}},
      {pos:"DT",name:"Sebastian Joseph-Day",ovr:74,attrs:{strength:82,tackle:76}},
      {pos:"LB",name:"Eric Kendricks",ovr:80,attrs:{tackle:80,coverage:78}},
      {pos:"CB",name:"J.C. Jackson",ovr:78,attrs:{coverage:80,speed:84}},
      {pos:"S",name:"Derwin James",ovr:92,attrs:{coverage:90,tackle:90,speed:86}},
      {pos:"K",name:"Cameron Dicker",ovr:78,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Easton Stick",ovr:64},{pos:"RB",name:"Isaiah Spiller",ovr:70,attrs:{running:72,speed:80}},
      {pos:"WR",name:"Joshua Palmer",ovr:74,attrs:{catching:76,speed:82}},{pos:"TE",name:"Donald Parham",ovr:70},
      {pos:"OL",name:"Jamaree Salyer",ovr:70},{pos:"DE",name:"Morgan Fox",ovr:72,attrs:{pass_rush:74,tackle:70}},
      {pos:"DT",name:"Otito Ogbonnia",ovr:70},{pos:"LB",name:"Kenneth Murray",ovr:74,attrs:{tackle:76,coverage:70}},
      {pos:"CB",name:"Asante Samuel Jr.",ovr:76,attrs:{coverage:78,speed:82}},{pos:"S",name:"AJ Finley",ovr:66},
      {pos:"K",name:"Ty Long",ovr:66},
    ]
  },
  SEA: {
    starters:[
      {pos:"QB",name:"Geno Smith",ovr:80,attrs:{passing:82,running:72,speed:72}},
      {pos:"RB",name:"Kenneth Walker III",ovr:84,attrs:{running:86,speed:88,strength:76}},
      {pos:"WR",name:"DK Metcalf",ovr:90,attrs:{catching:88,speed:94}},
      {pos:"TE",name:"Noah Fant",ovr:76,attrs:{catching:78,blocking:70,speed:80}},
      {pos:"OL",name:"Charles Cross",ovr:80,attrs:{blocking:82,strength:78}},
      {pos:"DE",name:"Uchenna Nwosu",ovr:76,attrs:{pass_rush:78,speed:82,tackle:72}},
      {pos:"DT",name:"Dre'Mont Jones",ovr:78,attrs:{pass_rush:76,strength:82,tackle:78}},
      {pos:"LB",name:"Bobby Wagner",ovr:88,attrs:{tackle:90,coverage:80,speed:78}},
      {pos:"CB",name:"Riq Woolen",ovr:82,attrs:{coverage:82,speed:90}},
      {pos:"S",name:"Quandre Diggs",ovr:82,attrs:{coverage:82,tackle:78}},
      {pos:"K",name:"Jason Myers",ovr:80,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Drew Lock",ovr:68},{pos:"RB",name:"Zach Charbonnet",ovr:76,attrs:{running:78,strength:78,speed:78}},
      {pos:"WR",name:"Tyler Lockett",ovr:82,attrs:{catching:86,speed:86}},{pos:"TE",name:"Will Dissly",ovr:68},
      {pos:"OL",name:"Abe Lucas",ovr:72},{pos:"DE",name:"Jarran Reed",ovr:72,attrs:{pass_rush:72,strength:80}},
      {pos:"DT",name:"Bryan Mone",ovr:68},{pos:"LB",name:"Jerome Baker",ovr:74,attrs:{tackle:76,coverage:70}},
      {pos:"CB",name:"Michael Jackson",ovr:70,attrs:{coverage:72,speed:82}},{pos:"S",name:"Jerrick Reed II",ovr:68},
      {pos:"K",name:"Michael Dickson",ovr:74},
    ]
  },
  MIN: {
    starters:[
      {pos:"QB",name:"Sam Darnold",ovr:76,attrs:{passing:78,running:70,speed:72}},
      {pos:"RB",name:"Aaron Jones",ovr:80,attrs:{running:82,speed:84,strength:74}},
      {pos:"WR",name:"Justin Jefferson",ovr:98,attrs:{catching:98,speed:90}},
      {pos:"TE",name:"T.J. Hockenson",ovr:84,attrs:{catching:86,blocking:76,speed:80}},
      {pos:"OL",name:"Christian Darrisaw",ovr:84,attrs:{blocking:86,strength:82}},
      {pos:"DE",name:"Jonathan Greenard",ovr:80,attrs:{pass_rush:82,speed:82,tackle:76}},
      {pos:"DT",name:"Harrison Phillips",ovr:76,attrs:{strength:84,tackle:78}},
      {pos:"LB",name:"Jordan Hicks",ovr:76,attrs:{tackle:78,coverage:72}},
      {pos:"CB",name:"Byron Murphy Jr.",ovr:82,attrs:{coverage:84,speed:84}},
      {pos:"S",name:"Harrison Smith",ovr:84,attrs:{coverage:84,tackle:82}},
      {pos:"K",name:"Will Reichard",ovr:72,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Nick Mullens",ovr:64},{pos:"RB",name:"Ty Chandler",ovr:70,attrs:{running:72,speed:84}},
      {pos:"WR",name:"Jordan Addison",ovr:80,attrs:{catching:82,speed:88}},{pos:"TE",name:"Josh Oliver",ovr:68},
      {pos:"OL",name:"Blake Brandel",ovr:68},{pos:"DE",name:"Marcus Davenport",ovr:74,attrs:{pass_rush:76,tackle:70}},
      {pos:"DT",name:"Jalen Redmond",ovr:66},{pos:"LB",name:"Brian Asamoah",ovr:70,attrs:{tackle:72,coverage:66}},
      {pos:"CB",name:"Stephon Gilmore",ovr:76,attrs:{coverage:78,speed:78}},{pos:"S",name:"Josh Metellus",ovr:68},
      {pos:"K",name:"Ryan Wright",ovr:70},
    ]
  },
  NO: {
    starters:[
      {pos:"QB",name:"Derek Carr",ovr:80,attrs:{passing:82,running:64,speed:66}},
      {pos:"RB",name:"Alvin Kamara",ovr:88,attrs:{running:88,speed:86,catching:90}},
      {pos:"WR",name:"Chris Olave",ovr:84,attrs:{catching:86,speed:90}},
      {pos:"TE",name:"Juwan Johnson",ovr:74,attrs:{catching:76,blocking:70}},
      {pos:"OL",name:"Ryan Ramczyk",ovr:86,attrs:{blocking:88,strength:82}},
      {pos:"DE",name:"Cameron Jordan",ovr:84,attrs:{pass_rush:84,speed:80,tackle:82}},
      {pos:"DT",name:"David Onyemata",ovr:78,attrs:{strength:84,pass_rush:74,tackle:80}},
      {pos:"LB",name:"Demario Davis",ovr:84,attrs:{tackle:86,coverage:78,speed:78}},
      {pos:"CB",name:"Marshon Lattimore",ovr:84,attrs:{coverage:86,speed:86}},
      {pos:"S",name:"Tyrann Mathieu",ovr:82,attrs:{coverage:84,tackle:78}},
      {pos:"K",name:"Blake Grupe",ovr:72,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Jake Haener",ovr:64},{pos:"RB",name:"Kendre Miller",ovr:72,attrs:{running:74,speed:78}},
      {pos:"WR",name:"Michael Thomas",ovr:74,attrs:{catching:78,speed:78}},{pos:"TE",name:"Foster Moreau",ovr:70},
      {pos:"OL",name:"Lucas Patrick",ovr:70},{pos:"DE",name:"Tanoh Kpassagnon",ovr:68},
      {pos:"DT",name:"Malcolm Roach",ovr:68},{pos:"LB",name:"Eric Wilson",ovr:70,attrs:{tackle:72,coverage:66}},
      {pos:"CB",name:"Paulson Adebo",ovr:76,attrs:{coverage:78,speed:84}},{pos:"S",name:"Lonnie Johnson Jr.",ovr:66},
      {pos:"K",name:"Lou Hedley",ovr:68},
    ]
  },
  ATL: {
    starters:[
      {pos:"QB",name:"Kirk Cousins",ovr:84,attrs:{passing:86,running:64,speed:64}},
      {pos:"RB",name:"Bijan Robinson",ovr:90,attrs:{running:92,speed:88,strength:78}},
      {pos:"WR",name:"Drake London",ovr:82,attrs:{catching:84,speed:82}},
      {pos:"TE",name:"Kyle Pitts",ovr:84,attrs:{catching:88,blocking:66,speed:84}},
      {pos:"OL",name:"Jake Matthews",ovr:80,attrs:{blocking:82,strength:78}},
      {pos:"DE",name:"Arnold Ebiketie",ovr:76,attrs:{pass_rush:78,speed:84,tackle:72}},
      {pos:"DT",name:"Grady Jarrett",ovr:82,attrs:{pass_rush:80,strength:86,tackle:84}},
      {pos:"LB",name:"Kaden Elliss",ovr:74,attrs:{tackle:76,coverage:70}},
      {pos:"CB",name:"A.J. Terrell",ovr:86,attrs:{coverage:88,speed:88}},
      {pos:"S",name:"Jessie Bates III",ovr:84,attrs:{coverage:84,tackle:80}},
      {pos:"K",name:"Younghoe Koo",ovr:84,attrs:{speed:56}},
    ],
    backups:[
      {pos:"QB",name:"Taylor Heinicke",ovr:68},{pos:"RB",name:"Tyler Allgeier",ovr:74,attrs:{running:76,strength:80}},
      {pos:"WR",name:"Rondale Moore",ovr:72,attrs:{catching:74,speed:90}},{pos:"TE",name:"Charlie Woerner",ovr:66},
      {pos:"OL",name:"Matthew Bergeron",ovr:70},{pos:"DE",name:"Lorenzo Carter",ovr:70,attrs:{pass_rush:72,tackle:68}},
      {pos:"DT",name:"Calais Campbell",ovr:74,attrs:{strength:80,tackle:76}},{pos:"LB",name:"Nate Landman",ovr:68},
      {pos:"CB",name:"Kevin King",ovr:70,attrs:{coverage:72,speed:78}},{pos:"S",name:"DeMarcco Hellams",ovr:66},
      {pos:"K",name:"Lester Cotton",ovr:64},
    ]
  },
  TB: {
    starters:[
      {pos:"QB",name:"Baker Mayfield",ovr:82,attrs:{passing:84,running:72,speed:72}},
      {pos:"RB",name:"Rachaad White",ovr:78,attrs:{running:80,speed:82,catching:80}},
      {pos:"WR",name:"Mike Evans",ovr:92,attrs:{catching:92,speed:82}},
      {pos:"TE",name:"Cade Otton",ovr:72,attrs:{catching:74,blocking:72}},
      {pos:"OL",name:"Tristan Wirfs",ovr:94,attrs:{blocking:94,strength:90}},
      {pos:"DE",name:"Yaya Diaby",ovr:78,attrs:{pass_rush:80,speed:86,tackle:72}},
      {pos:"DT",name:"Vita Vea",ovr:90,attrs:{strength:96,pass_rush:80,tackle:90}},
      {pos:"LB",name:"Lavonte David",ovr:86,attrs:{tackle:88,coverage:80,speed:80}},
      {pos:"CB",name:"Jamel Dean",ovr:80,attrs:{coverage:82,speed:86}},
      {pos:"S",name:"Antoine Winfield Jr.",ovr:90,attrs:{coverage:88,tackle:86,speed:86}},
      {pos:"K",name:"Chase McLaughlin",ovr:76,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Kyle Trask",ovr:64},{pos:"RB",name:"Sean Tucker",ovr:70,attrs:{running:72,speed:82}},
      {pos:"WR",name:"Chris Godwin",ovr:84,attrs:{catching:86,speed:82}},{pos:"TE",name:"Ko Kieft",ovr:64},
      {pos:"OL",name:"Luke Goedeke",ovr:72},{pos:"DE",name:"Greg Gaines",ovr:72,attrs:{pass_rush:72,strength:80}},
      {pos:"DT",name:"Calijah Kancey",ovr:74,attrs:{pass_rush:76,strength:78}},{pos:"LB",name:"J.J. Russell",ovr:66},
      {pos:"CB",name:"Carlton Davis",ovr:78,attrs:{coverage:80,speed:82}},{pos:"S",name:"Christian Izien",ovr:68},
      {pos:"K",name:"Jake Camarda",ovr:72},
    ]
  },
  DEN: {
    starters:[
      {pos:"QB",name:"Bo Nix",ovr:76,attrs:{passing:76,running:76,speed:76}},
      {pos:"RB",name:"Javonte Williams",ovr:78,attrs:{running:80,strength:78,speed:78}},
      {pos:"WR",name:"Courtland Sutton",ovr:80,attrs:{catching:82,speed:80}},
      {pos:"TE",name:"Adam Trautman",ovr:68,attrs:{catching:70,blocking:70}},
      {pos:"OL",name:"Garett Bolles",ovr:80,attrs:{blocking:82,strength:80}},
      {pos:"DE",name:"Zach Allen",ovr:78,attrs:{pass_rush:76,strength:82,tackle:78}},
      {pos:"DT",name:"D.J. Jones",ovr:76,attrs:{strength:84,tackle:78}},
      {pos:"LB",name:"Alex Singleton",ovr:76,attrs:{tackle:78,coverage:70}},
      {pos:"CB",name:"Pat Surtain II",ovr:94,attrs:{coverage:96,speed:90}},
      {pos:"S",name:"Justin Simmons",ovr:84,attrs:{coverage:86,tackle:78}},
      {pos:"K",name:"Wil Lutz",ovr:80,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Zach Wilson",ovr:66},{pos:"RB",name:"Audric Estime",ovr:72,attrs:{running:74,strength:82}},
      {pos:"WR",name:"Jerry Jeudy",ovr:78,attrs:{catching:80,speed:88}},{pos:"TE",name:"Lucas Krull",ovr:64},
      {pos:"OL",name:"Quinn Meinerz",ovr:74},{pos:"DE",name:"Malcolm Roach",ovr:66,attrs:{pass_rush:68,tackle:66}},
      {pos:"DT",name:"Matt Henningsen",ovr:66},{pos:"LB",name:"Jonathon Cooper",ovr:72,attrs:{tackle:74,coverage:66}},
      {pos:"CB",name:"Ja'Quan McMillian",ovr:70,attrs:{coverage:72,speed:82}},{pos:"S",name:"P.J. Locke",ovr:68},
      {pos:"K",name:"John Haggerty",ovr:66},
    ]
  },
  LV: {
    starters:[
      {pos:"QB",name:"Aidan O'Connell",ovr:70,attrs:{passing:72,running:62,speed:64}},
      {pos:"RB",name:"Josh Jacobs",ovr:84,attrs:{running:86,strength:82,speed:82}},
      {pos:"WR",name:"Davante Adams",ovr:92,attrs:{catching:94,speed:84}},
      {pos:"TE",name:"Michael Mayer",ovr:72,attrs:{catching:74,blocking:72}},
      {pos:"OL",name:"Kolton Miller",ovr:84,attrs:{blocking:86,strength:82}},
      {pos:"DE",name:"Maxx Crosby",ovr:96,attrs:{pass_rush:96,speed:88,tackle:88}},
      {pos:"DT",name:"Jerry Tillery",ovr:72,attrs:{strength:80,pass_rush:72,tackle:74}},
      {pos:"LB",name:"Robert Spillane",ovr:76,attrs:{tackle:78,coverage:70}},
      {pos:"CB",name:"Nate Hobbs",ovr:78,attrs:{coverage:80,speed:84}},
      {pos:"S",name:"Marcus Epps",ovr:74,attrs:{coverage:72,tackle:76}},
      {pos:"K",name:"Daniel Carlson",ovr:86,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Gardner Minshew",ovr:70,attrs:{passing:72,running:68}},{pos:"RB",name:"Zamir White",ovr:72,attrs:{running:74,speed:78}},
      {pos:"WR",name:"Hunter Renfrow",ovr:74,attrs:{catching:78,speed:78}},{pos:"TE",name:"Cole Fotheringham",ovr:64},
      {pos:"OL",name:"John Simpson",ovr:70},{pos:"DE",name:"Malcolm Koonce",ovr:70,attrs:{pass_rush:72,tackle:68}},
      {pos:"DT",name:"Adam Butler",ovr:70,attrs:{strength:76,tackle:72}},{pos:"LB",name:"Divine Deablo",ovr:70},
      {pos:"CB",name:"Marcus Peters",ovr:74,attrs:{coverage:76,speed:78}},{pos:"S",name:"Tre'von Moehrig",ovr:72,attrs:{coverage:70,tackle:74}},
      {pos:"K",name:"A.J. Cole",ovr:70},
    ]
  },
  HOU: {
    starters:[
      {pos:"QB",name:"C.J. Stroud",ovr:88,attrs:{passing:90,running:72,speed:72}},
      {pos:"RB",name:"Devin Singletary",ovr:74,attrs:{running:76,speed:78,strength:72}},
      {pos:"WR",name:"Nico Collins",ovr:84,attrs:{catching:86,speed:86}},
      {pos:"TE",name:"Dalton Schultz",ovr:76,attrs:{catching:78,blocking:72}},
      {pos:"OL",name:"Laremy Tunsil",ovr:92,attrs:{blocking:94,strength:86}},
      {pos:"DE",name:"Will Anderson Jr.",ovr:86,attrs:{pass_rush:88,speed:88,tackle:80}},
      {pos:"DT",name:"Sheldon Rankins",ovr:72,attrs:{strength:80,pass_rush:70,tackle:74}},
      {pos:"LB",name:"Azeez Al-Shaair",ovr:78,attrs:{tackle:80,coverage:72}},
      {pos:"CB",name:"Derek Stingley Jr.",ovr:84,attrs:{coverage:86,speed:88}},
      {pos:"S",name:"Jalen Pitre",ovr:80,attrs:{coverage:78,tackle:82}},
      {pos:"K",name:"Ka'imi Fairbairn",ovr:80,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Case Keenum",ovr:66},{pos:"RB",name:"Dameon Pierce",ovr:70,attrs:{running:72,strength:76}},
      {pos:"WR",name:"Tank Dell",ovr:78,attrs:{catching:80,speed:88}},{pos:"TE",name:"Brevin Jordan",ovr:68},
      {pos:"OL",name:"George Fant",ovr:68},{pos:"DE",name:"Derek Barnett",ovr:70,attrs:{pass_rush:72,tackle:68}},
      {pos:"DT",name:"Foley Fatukasi",ovr:70},{pos:"LB",name:"Denzel Perryman",ovr:72,attrs:{tackle:74,coverage:66}},
      {pos:"CB",name:"Steven Nelson",ovr:72,attrs:{coverage:74,speed:78}},{pos:"S",name:"Jimmie Ward",ovr:72},
      {pos:"K",name:"Matt Haack",ovr:66},
    ]
  },
  IND: {
    starters:[
      {pos:"QB",name:"Anthony Richardson",ovr:78,attrs:{passing:76,running:90,speed:86}},
      {pos:"RB",name:"Jonathan Taylor",ovr:90,attrs:{running:92,speed:90,strength:82}},
      {pos:"WR",name:"Michael Pittman Jr.",ovr:84,attrs:{catching:86,speed:82}},
      {pos:"TE",name:"Mo Alie-Cox",ovr:68,attrs:{catching:68,blocking:76}},
      {pos:"OL",name:"Quenton Nelson",ovr:94,attrs:{blocking:96,strength:94}},
      {pos:"DE",name:"Kwity Paye",ovr:78,attrs:{pass_rush:80,speed:84,tackle:74}},
      {pos:"DT",name:"DeForest Buckner",ovr:90,attrs:{pass_rush:88,strength:92,tackle:90}},
      {pos:"LB",name:"Shaquille Leonard",ovr:80,attrs:{tackle:82,coverage:76}},
      {pos:"CB",name:"Kenny Moore II",ovr:80,attrs:{coverage:82,speed:82}},
      {pos:"S",name:"Rodney Thomas II",ovr:74,attrs:{coverage:72,tackle:76}},
      {pos:"K",name:"Matt Gay",ovr:80,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Gardner Minshew",ovr:70},{pos:"RB",name:"Zack Moss",ovr:72,attrs:{running:74,strength:76}},
      {pos:"WR",name:"Alec Pierce",ovr:72,attrs:{catching:74,speed:84}},{pos:"TE",name:"Kylen Granson",ovr:68},
      {pos:"OL",name:"Bernhard Raimann",ovr:72},{pos:"DE",name:"Samson Ebukam",ovr:72,attrs:{pass_rush:74,tackle:70}},
      {pos:"DT",name:"Laquon Treadwell",ovr:66},{pos:"LB",name:"Zaire Franklin",ovr:74,attrs:{tackle:76,coverage:70}},
      {pos:"CB",name:"Isaiah Rodgers",ovr:70,attrs:{coverage:72,speed:82}},{pos:"S",name:"Trevor Denbow",ovr:66},
      {pos:"K",name:"Rigoberto Sanchez",ovr:68},
    ]
  },
  TEN: {
    starters:[
      {pos:"QB",name:"Will Levis",ovr:74,attrs:{passing:76,running:74,speed:74}},
      {pos:"RB",name:"Tyjae Spears",ovr:76,attrs:{running:78,speed:84,strength:70}},
      {pos:"WR",name:"DeAndre Hopkins",ovr:84,attrs:{catching:90,speed:80}},
      {pos:"TE",name:"Chigoziem Okonkwo",ovr:74,attrs:{catching:76,blocking:68,speed:80}},
      {pos:"OL",name:"Taylor Lewan",ovr:78,attrs:{blocking:80,strength:78}},
      {pos:"DE",name:"Harold Landry III",ovr:78,attrs:{pass_rush:80,speed:84,tackle:74}},
      {pos:"DT",name:"Jeffrey Simmons",ovr:88,attrs:{pass_rush:84,strength:92,tackle:88}},
      {pos:"LB",name:"Arden Key",ovr:72,attrs:{tackle:72,pass_rush:74,speed:80}},
      {pos:"CB",name:"Kristian Fulton",ovr:78,attrs:{coverage:80,speed:82}},
      {pos:"S",name:"Amani Hooker",ovr:78,attrs:{coverage:78,tackle:76}},
      {pos:"K",name:"Nick Folk",ovr:78,attrs:{speed:52}},
    ],
    backups:[
      {pos:"QB",name:"Ryan Tannehill",ovr:70,attrs:{passing:74,running:68}},{pos:"RB",name:"Derrick Henry",ovr:84,attrs:{running:86,strength:90,speed:82}},
      {pos:"WR",name:"Treylon Burks",ovr:72,attrs:{catching:74,speed:82}},{pos:"TE",name:"Josh Whyle",ovr:66},
      {pos:"OL",name:"Dillon Radunz",ovr:70},{pos:"DE",name:"Denico Autry",ovr:74,attrs:{pass_rush:76,tackle:72}},
      {pos:"DT",name:"T'Vondre Sweat",ovr:70},{pos:"LB",name:"Jack Gibbens",ovr:68},
      {pos:"CB",name:"Roger McCreary",ovr:74,attrs:{coverage:76,speed:80}},{pos:"S",name:"Kevin Byard",ovr:80,attrs:{coverage:80,tackle:76}},
      {pos:"K",name:"Ryan Stonehouse",ovr:70},
    ]
  },
  JAC: {
    starters:[
      {pos:"QB",name:"Trevor Lawrence",ovr:86,attrs:{passing:88,running:76,speed:76}},
      {pos:"RB",name:"Travis Etienne Jr.",ovr:86,attrs:{running:88,speed:90,strength:74}},
      {pos:"WR",name:"Calvin Ridley",ovr:82,attrs:{catching:84,speed:86}},
      {pos:"TE",name:"Evan Engram",ovr:84,attrs:{catching:86,blocking:66,speed:82}},
      {pos:"OL",name:"Cam Robinson",ovr:80,attrs:{blocking:82,strength:82}},
      {pos:"DE",name:"Josh Hines-Allen",ovr:88,attrs:{pass_rush:90,speed:86,tackle:80}},
      {pos:"DT",name:"Arik Armstead",ovr:76,attrs:{strength:84,pass_rush:74,tackle:78}},
      {pos:"LB",name:"Foye Oluokun",ovr:82,attrs:{tackle:84,coverage:76,speed:80}},
      {pos:"CB",name:"Tyson Campbell",ovr:80,attrs:{coverage:82,speed:86}},
      {pos:"S",name:"Andre Cisco",ovr:78,attrs:{coverage:76,tackle:80}},
      {pos:"K",name:"Riley Patterson",ovr:74,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"C.J. Beathard",ovr:64},{pos:"RB",name:"D'Ernest Johnson",ovr:70,attrs:{running:72,speed:82}},
      {pos:"WR",name:"Gabe Davis",ovr:74,attrs:{catching:76,speed:88}},{pos:"TE",name:"Brenton Strange",ovr:66},
      {pos:"OL",name:"Walker Little",ovr:72},{pos:"DE",name:"Dawuane Smoot",ovr:72,attrs:{pass_rush:74,tackle:70}},
      {pos:"DT",name:"DaVon Hamilton",ovr:70,attrs:{strength:78,tackle:72}},{pos:"LB",name:"Ventrell Miller",ovr:68},
      {pos:"CB",name:"Darious Williams",ovr:74,attrs:{coverage:76,speed:80}},{pos:"S",name:"Darnell Savage",ovr:70},
      {pos:"K",name:"Andrew Wingard",ovr:64},
    ]
  },
  CHI: {
    starters:[
      {pos:"QB",name:"Caleb Williams",ovr:82,attrs:{passing:84,running:80,speed:80}},
      {pos:"RB",name:"D'Onta Foreman",ovr:72,attrs:{running:74,strength:78,speed:74}},
      {pos:"WR",name:"D.J. Moore",ovr:86,attrs:{catching:86,speed:88}},
      {pos:"TE",name:"Cole Kmet",ovr:76,attrs:{catching:78,blocking:74}},
      {pos:"OL",name:"Darnell Wright",ovr:76,attrs:{blocking:78,strength:78}},
      {pos:"DE",name:"Montez Sweat",ovr:86,attrs:{pass_rush:88,speed:88,tackle:78}},
      {pos:"DT",name:"Andrew Billings",ovr:74,attrs:{strength:82,tackle:76}},
      {pos:"LB",name:"T.J. Edwards",ovr:82,attrs:{tackle:84,coverage:74}},
      {pos:"CB",name:"Jaylon Johnson",ovr:82,attrs:{coverage:84,speed:86}},
      {pos:"S",name:"Kevin Byard",ovr:78,attrs:{coverage:78,tackle:76}},
      {pos:"K",name:"Cairo Santos",ovr:78,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Tyson Bagent",ovr:64},{pos:"RB",name:"Roschon Johnson",ovr:70,attrs:{running:72,strength:74}},
      {pos:"WR",name:"Keenan Allen",ovr:82,attrs:{catching:86,speed:78}},{pos:"TE",name:"Robert Tonyan",ovr:68},
      {pos:"OL",name:"Teven Jenkins",ovr:72},{pos:"DE",name:"Tremaine Edmunds",ovr:72,attrs:{pass_rush:72,tackle:70}},
      {pos:"DT",name:"Zacch Pickens",ovr:68},{pos:"LB",name:"Jack Sanborn",ovr:70,attrs:{tackle:72,coverage:66}},
      {pos:"CB",name:"Kyler Gordon",ovr:72,attrs:{coverage:74,speed:82}},{pos:"S",name:"Jaquan Brisker",ovr:72},
      {pos:"K",name:"Tory Taylor",ovr:66},
    ]
  },
  CAR: {
    starters:[
      {pos:"QB",name:"Bryce Young",ovr:74,attrs:{passing:76,running:74,speed:74}},
      {pos:"RB",name:"Miles Sanders",ovr:74,attrs:{running:76,speed:80,strength:72}},
      {pos:"WR",name:"Adam Thielen",ovr:78,attrs:{catching:82,speed:78}},
      {pos:"TE",name:"Hayden Hurst",ovr:70,attrs:{catching:72,blocking:68}},
      {pos:"OL",name:"Taylor Moton",ovr:82,attrs:{blocking:84,strength:82}},
      {pos:"DE",name:"Brian Burns",ovr:84,attrs:{pass_rush:86,speed:88,tackle:76}},
      {pos:"DT",name:"Derrick Brown",ovr:82,attrs:{strength:90,pass_rush:76,tackle:84}},
      {pos:"LB",name:"Shaq Thompson",ovr:78,attrs:{tackle:80,coverage:72}},
      {pos:"CB",name:"CJ Henderson",ovr:72,attrs:{coverage:74,speed:82}},
      {pos:"S",name:"Xavier Woods",ovr:72,attrs:{coverage:70,tackle:74}},
      {pos:"K",name:"Eddy Pineiro",ovr:72,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Andy Dalton",ovr:66},{pos:"RB",name:"Chuba Hubbard",ovr:72,attrs:{running:74,speed:80}},
      {pos:"WR",name:"Jonathan Mingo",ovr:70,attrs:{catching:72,speed:82}},{pos:"TE",name:"Ian Thomas",ovr:66},
      {pos:"OL",name:"Cade Mays",ovr:68},{pos:"DE",name:"A'Shawn Robinson",ovr:68,attrs:{pass_rush:66,strength:80}},
      {pos:"DT",name:"Shy Tuttle",ovr:70,attrs:{strength:78,tackle:72}},{pos:"LB",name:"Frankie Luvu",ovr:72,attrs:{tackle:74,coverage:68}},
      {pos:"CB",name:"Donte Jackson",ovr:72,attrs:{coverage:74,speed:84}},{pos:"S",name:"Vonn Bell",ovr:70},
      {pos:"K",name:"Johnny Hekker",ovr:68},
    ]
  },
  WAS: {
    starters:[
      {pos:"QB",name:"Jayden Daniels",ovr:82,attrs:{passing:82,running:88,speed:86}},
      {pos:"RB",name:"Austin Ekeler",ovr:78,attrs:{running:80,speed:84,catching:82}},
      {pos:"WR",name:"Terry McLaurin",ovr:86,attrs:{catching:86,speed:90}},
      {pos:"TE",name:"Zach Ertz",ovr:76,attrs:{catching:80,blocking:68}},
      {pos:"OL",name:"Charles Leno Jr.",ovr:78,attrs:{blocking:80,strength:76}},
      {pos:"DE",name:"Chase Young",ovr:80,attrs:{pass_rush:82,speed:84,tackle:76}},
      {pos:"DT",name:"Daron Payne",ovr:86,attrs:{strength:92,pass_rush:80,tackle:88}},
      {pos:"LB",name:"Bobby Wagner",ovr:82,attrs:{tackle:84,coverage:76,speed:76}},
      {pos:"CB",name:"Emmanuel Forbes Jr.",ovr:72,attrs:{coverage:74,speed:84}},
      {pos:"S",name:"Kam Curl",ovr:82,attrs:{coverage:80,tackle:84}},
      {pos:"K",name:"Austin Seibert",ovr:74,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Marcus Mariota",ovr:66},{pos:"RB",name:"Brian Robinson Jr.",ovr:74,attrs:{running:76,strength:82}},
      {pos:"WR",name:"Noah Brown",ovr:68,attrs:{catching:70,speed:78}},{pos:"TE",name:"Cole Turner",ovr:66},
      {pos:"OL",name:"Sam Cosmi",ovr:74},{pos:"DE",name:"Clelin Ferrell",ovr:70,attrs:{pass_rush:72,tackle:68}},
      {pos:"DT",name:"Jonathan Allen",ovr:80,attrs:{strength:86,pass_rush:76,tackle:82}},{pos:"LB",name:"Jamin Davis",ovr:70,attrs:{tackle:72,coverage:66}},
      {pos:"CB",name:"Benjamin St-Juste",ovr:72,attrs:{coverage:74,speed:80}},{pos:"S",name:"Percy Butler",ovr:68},
      {pos:"K",name:"Tress Way",ovr:70},
    ]
  },
  NYG: {
    starters:[
      {pos:"QB",name:"Daniel Jones",ovr:76,attrs:{passing:78,running:78,speed:76}},
      {pos:"RB",name:"Devin Singletary",ovr:72,attrs:{running:74,speed:78,strength:70}},
      {pos:"WR",name:"Malik Nabers",ovr:82,attrs:{catching:84,speed:88}},
      {pos:"TE",name:"Darren Waller",ovr:78,attrs:{catching:82,blocking:68,speed:78}},
      {pos:"OL",name:"Andrew Thomas",ovr:88,attrs:{blocking:90,strength:84}},
      {pos:"DE",name:"Kayvon Thibodeaux",ovr:82,attrs:{pass_rush:84,speed:88,tackle:76}},
      {pos:"DT",name:"Dexter Lawrence",ovr:90,attrs:{pass_rush:86,strength:96,tackle:90}},
      {pos:"LB",name:"Bobby Okereke",ovr:80,attrs:{tackle:82,coverage:74}},
      {pos:"CB",name:"Adoree' Jackson",ovr:78,attrs:{coverage:80,speed:84}},
      {pos:"S",name:"Jason Pinnock",ovr:70,attrs:{coverage:68,tackle:72}},
      {pos:"K",name:"Graham Gano",ovr:80,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Tommy DeVito",ovr:64},{pos:"RB",name:"Eric Gray",ovr:68,attrs:{running:70,speed:80}},
      {pos:"WR",name:"Jalin Hyatt",ovr:70,attrs:{catching:72,speed:90}},{pos:"TE",name:"Lawrence Cager",ovr:64},
      {pos:"OL",name:"Mark Glowinski",ovr:70},{pos:"DE",name:"Azeez Ojulari",ovr:76,attrs:{pass_rush:78,speed:84,tackle:70}},
      {pos:"DT",name:"A'Shawn Robinson",ovr:68,attrs:{strength:78,tackle:70}},{pos:"LB",name:"Isaiah Simmons",ovr:70},
      {pos:"CB",name:"Cor'Dale Flott",ovr:70,attrs:{coverage:72,speed:84}},{pos:"S",name:"Dane Belton",ovr:68},
      {pos:"K",name:"Jamie Gillan",ovr:66},
    ]
  },
  ARI: {
    starters:[
      {pos:"QB",name:"Kyler Murray",ovr:86,attrs:{passing:86,running:90,speed:88}},
      {pos:"RB",name:"James Conner",ovr:78,attrs:{running:80,strength:80,speed:76}},
      {pos:"WR",name:"Marvin Harrison Jr.",ovr:84,attrs:{catching:86,speed:88}},
      {pos:"TE",name:"Trey McBride",ovr:82,attrs:{catching:84,blocking:74,speed:78}},
      {pos:"OL",name:"D.J. Humphries",ovr:80,attrs:{blocking:82,strength:78}},
      {pos:"DE",name:"B.J. Hill",ovr:76,attrs:{pass_rush:74,strength:84,tackle:78}},
      {pos:"DT",name:"Zach Allen",ovr:76,attrs:{strength:82,pass_rush:72,tackle:78}},
      {pos:"LB",name:"Kyzir White",ovr:76,attrs:{tackle:78,coverage:72}},
      {pos:"CB",name:"Marco Wilson",ovr:72,attrs:{coverage:74,speed:82}},
      {pos:"S",name:"Budda Baker",ovr:88,attrs:{coverage:86,tackle:88,speed:86}},
      {pos:"K",name:"Matt Prater",ovr:78,attrs:{speed:52}},
    ],
    backups:[
      {pos:"QB",name:"Clayton Tune",ovr:62},{pos:"RB",name:"Emari Demercado",ovr:68,attrs:{running:70,speed:76}},
      {pos:"WR",name:"Michael Wilson",ovr:70,attrs:{catching:72,speed:80}},{pos:"TE",name:"Zach Ertz",ovr:72,attrs:{catching:76,blocking:66}},
      {pos:"OL",name:"Will Hernandez",ovr:70},{pos:"DE",name:"Xavier Thomas",ovr:68,attrs:{pass_rush:70,tackle:66}},
      {pos:"DT",name:"Roy Lopez",ovr:66,attrs:{strength:76,tackle:68}},{pos:"LB",name:"Victor Dimukeje",ovr:66},
      {pos:"CB",name:"Starling Thomas V",ovr:68,attrs:{coverage:70,speed:80}},{pos:"S",name:"Jalen Thompson",ovr:72,attrs:{coverage:70,tackle:74}},
      {pos:"K",name:"Ryan Longwell",ovr:62},
    ]
  },
  LAR: {
    starters:[
      {pos:"QB",name:"Matthew Stafford",ovr:84,attrs:{passing:88,running:62,speed:64}},
      {pos:"RB",name:"Kyren Williams",ovr:82,attrs:{running:84,speed:82,strength:74}},
      {pos:"WR",name:"Cooper Kupp",ovr:88,attrs:{catching:92,speed:82}},
      {pos:"TE",name:"Tyler Higbee",ovr:76,attrs:{catching:78,blocking:76}},
      {pos:"OL",name:"Rob Havenstein",ovr:78,attrs:{blocking:80,strength:82}},
      {pos:"DE",name:"Leonard Floyd",ovr:78,attrs:{pass_rush:80,speed:84,tackle:74}},
      {pos:"DT",name:"Aaron Donald (ret.) / Kobie Turner",ovr:80,attrs:{strength:88,pass_rush:76,tackle:80}},
      {pos:"LB",name:"Ernest Jones IV",ovr:76,attrs:{tackle:78,coverage:70}},
      {pos:"CB",name:"Ahkello Witherspoon",ovr:74,attrs:{coverage:76,speed:82}},
      {pos:"S",name:"Jordan Fuller",ovr:76,attrs:{coverage:74,tackle:78}},
      {pos:"K",name:"Lucas Havrisik",ovr:70,attrs:{speed:54}},
    ],
    backups:[
      {pos:"QB",name:"Jimmy Garoppolo",ovr:70,attrs:{passing:74,running:64}},{pos:"RB",name:"Ronnie Rivers",ovr:68,attrs:{running:70,speed:80}},
      {pos:"WR",name:"Puka Nacua",ovr:82,attrs:{catching:84,speed:82}},{pos:"TE",name:"Davis Allen",ovr:66},
      {pos:"OL",name:"Joe Noteboom",ovr:72},{pos:"DE",name:"Michael Hoecht",ovr:72,attrs:{pass_rush:72,tackle:70}},
      {pos:"DT",name:"Desjuan Johnson",ovr:66,attrs:{strength:74,tackle:68}},{pos:"LB",name:"Tre'Vius Hodges-Tomlinson",ovr:72,attrs:{tackle:72,coverage:68}},
      {pos:"CB",name:"Darious Williams",ovr:72,attrs:{coverage:74,speed:80}},{pos:"S",name:"Russ Yeast",ovr:64},
      {pos:"K",name:"Ethan Evans",ovr:64},
    ]
  },
};

// Mescla os dois objetos para ter todos os 32 times
const ALL_ROSTERS = { ...NFL_ROSTERS, ...EXTRA_ROSTERS };
