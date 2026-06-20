/* season.js — Sistema de temporada estilo NFL */

const NFL_STRUCTURE = {
  AFC: {
    Norte: [["Ravens","Baltimore","BAL"],["Steelers","Pittsburgh","PIT"],["Browns","Cleveland","CLE"],["Bengals","Cincinnati","CIN"]],
    Sul:   [["Texans","Houston","HOU"],["Colts","Indianapolis","IND"],["Titans","Tennessee","TEN"],["Jaguars","Jacksonville","JAC"]],
    Leste: [["Patriots","New England","NE"],["Bills","Buffalo","BUF"],["Dolphins","Miami","MIA"],["Jets","New York","NYJ"]],
    Oeste: [["Chiefs","Kansas City","KC"],["Raiders","Las Vegas","LV"],["Chargers","Los Angeles","LAC"],["Broncos","Denver","DEN"]],
  },
  NFC: {
    Norte: [["Packers","Green Bay","GB"],["Vikings","Minnesota","MIN"],["Bears","Chicago","CHI"],["Lions","Detroit","DET"]],
    Sul:   [["Saints","New Orleans","NO"],["Buccaneers","Tampa Bay","TB"],["Falcons","Atlanta","ATL"],["Panthers","Carolina","CAR"]],
    Leste: [["Cowboys","Dallas","DAL"],["Eagles","Philadelphia","PHI"],["Giants","New York","NYG"],["Commanders","Washington","WAS"]],
    Oeste: [["49ers","San Francisco","SF"],["Seahawks","Seattle","SEA"],["Rams","Los Angeles","LAR"],["Cardinals","Arizona","ARI"]],
  },
};

const TEAM_STRENGTHS = {
  BAL:85,PIT:80,CLE:75,CIN:82, HOU:77,IND:76,TEN:74,JAC:72,
  NE:78,BUF:84,MIA:79,NYJ:70, KC:90,LV:72,LAC:78,DEN:74,
  GB:83,MIN:79,CHI:71,DET:78, NO:77,TB:80,ATL:73,CAR:68,
  DAL:82,PHI:84,NYG:72,WAS:73, SF:86,SEA:78,LAR:76,ARI:70,
};

class TeamRecord {
  constructor(data) {
    Object.assign(this, {
      name:"", city:"", abbreviation:"", conference:"", division:"",
      strength:75, wins:0, losses:0, ties:0,
      pointsFor:0, pointsAgainst:0, isPlayer:false, eliminated:false,
      // Estatísticas da temporada (para o time do jogador)
      seasonPassYards:0, seasonRushYards:0, seasonTotalYards:0,
      seasonTDs:0, seasonFGs:0, seasonTurnovers:0, seasonFirstDowns:0,
      seasonGames:0,
      // Roster persistente e cap salarial
      roster: null,    // null = usa roster gerado dinamicamente
      capUsed: 0,      // cap utilizado em $M
      capTotal: 180,   // cap total em $M
    }, data);
  }
  get gamesPlayed() { return this.wins + this.losses + this.ties; }
  get winPct() { return this.wins / Math.max(1, this.gamesPlayed); }
  get pointDiff() { return this.pointsFor - this.pointsAgainst; }
  get recordStr() { return `${this.wins}-${this.losses}` + (this.ties ? `-${this.ties}` : ""); }
}

class GameResult {
  constructor(data) {
    Object.assign(this, {
      week:1, home:"", away:"", homeScore:0, awayScore:0,
      isPlayerGame:false, played:false,
    }, data);
  }
  get winner() {
    if (this.homeScore > this.awayScore) return this.home;
    if (this.awayScore > this.homeScore) return this.away;
    return null;
  }
}

class Season {
  constructor(data = {}) {
    this.year = data.year ?? 2025;
    this.currentWeek = data.currentWeek ?? 1;
    this.phase = data.phase ?? "regular";
    this.teams = data.teams ?? {};
    this.schedule = data.schedule ?? [];
    this.playoffBracket = data.playoffBracket ?? {};
    this.playerTeam = data.playerTeam ?? "PHI";
    this.champion = data.champion ?? "";
  }

  getStandings(conference = null, division = null) {
    let teams = Object.values(this.teams);
    if (conference) teams = teams.filter(t => t.conference === conference);
    if (division)   teams = teams.filter(t => t.division === division);
    return teams.sort((a,b) =>
      (b.winPct - a.winPct) || (b.pointDiff - a.pointDiff) || (b.wins - a.wins));
  }

  getWeekGames(week) { return this.schedule.filter(g => g.week === week); }
  getTeamGames(abbr) { return this.schedule.filter(g => g.home === abbr || g.away === abbr); }

  getPlayoffSeeds(conference) {
    const divWinners = [], wildcards = [];
    for (const div of ["Norte","Sul","Leste","Oeste"]) {
      const divTeams = this.getStandings(conference, div);
      if (divTeams.length) {
        divWinners.push(divTeams[0]);
        wildcards.push(...divTeams.slice(1));
      }
    }
    divWinners.sort((a,b) => (b.winPct - a.winPct) || (b.pointDiff - a.pointDiff));
    wildcards.sort((a,b) => (b.winPct - a.winPct) || (b.pointDiff - a.pointDiff));
    return [...divWinners.slice(0,4), ...wildcards.slice(0,3)];
  }
}

function buildSeason(playerAbbr, playerName = null, playerCity = null) {
  const season = new Season({ playerTeam: playerAbbr });
  for (const [conf, divisions] of Object.entries(NFL_STRUCTURE)) {
    for (const [div, teams] of Object.entries(divisions)) {
      for (const [name, city, abbr] of teams) {
        const isPlayer = abbr === playerAbbr;
        season.teams[abbr] = new TeamRecord({
          name: (isPlayer && playerName) ? playerName : name,
          city: (isPlayer && playerCity) ? playerCity : city,
          abbreviation: abbr, conference: conf, division: div,
          strength: (TEAM_STRENGTHS[abbr] ?? 75) + randInt(-3, 3),
          isPlayer,
        });
      }
    }
  }
  season.schedule = generateSchedule(season.teams, playerAbbr);
  return season;
}

function generateSchedule(teams, playerAbbr) {
  const schedule = [];
  const abbrs = Object.keys(teams);

  for (let week = 1; week <= 17; week++) {
    const weekTeams = new Set();
    const weekGames = [];

    const possibleOpponents = abbrs.filter(a => a !== playerAbbr);
    const opp = choice(possibleOpponents);
    const home = (week % 2 === 1) ? playerAbbr : opp;
    const away = (week % 2 === 1) ? opp : playerAbbr;
    weekGames.push(new GameResult({ week, home, away, isPlayerGame: true }));
    weekTeams.add(playerAbbr); weekTeams.add(opp);

    const remaining = abbrs.filter(a => !weekTeams.has(a));
    shuffle(remaining);
    for (let i = 0; i < remaining.length - 1; i += 2) {
      weekGames.push(new GameResult({ week, home: remaining[i], away: remaining[i+1] }));
    }
    schedule.push(...weekGames);
  }
  return schedule;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function simulateGameQuick(home, away) {
  // Modelo calibrado para placares realistas de NFL (média ~22 pts/time, total ~44, raramente acima de 38 por time)
  const hStr = home.strength + randGauss(0, 3);
  const aStr = away.strength + randGauss(0, 3);
  const rawRatio = hStr / Math.max(1, aStr);
  const ratio = Math.pow(rawRatio, 0.4); // amortece fortemente a vantagem do time mais forte

  let hScore = Math.max(3, Math.round(randGauss(21 * ratio, 5)));
  let aScore = Math.max(3, Math.round(randGauss(21 / ratio, 5)));

  hScore = Math.min(38, hScore);
  aScore = Math.min(38, aScore);

  if (hScore === aScore) {
    if (Math.random() > 0.5) hScore += 3; else aScore += 3;
  }
  return [hScore, aScore];
}

function processWeekResults(season, week, playerHomeScore = null, playerAwayScore = null) {
  for (const game of season.schedule) {
    if (game.week !== week || game.played) continue;

    if (game.isPlayerGame) {
      if (playerHomeScore !== null) {
        game.homeScore = playerHomeScore;
        game.awayScore = playerAwayScore;
        game.played = true;
      }
      continue;
    }

    const homeTeam = season.teams[game.home];
    const awayTeam = season.teams[game.away];
    const [h, a] = simulateGameQuick(homeTeam, awayTeam);
    game.homeScore = h; game.awayScore = a; game.played = true;
    updateRecord(season, game.home, game.away, h, a);
  }

  const playerGame = season.schedule.find(g =>
    g.week === week && g.isPlayerGame && g.played);
  if (playerGame) {
    updateRecord(season, playerGame.home, playerGame.away,
                 playerGame.homeScore, playerGame.awayScore);
  }
}

function updateRecord(season, homeAbbr, awayAbbr, h, a) {
  const home = season.teams[homeAbbr];
  const away = season.teams[awayAbbr];
  home.pointsFor += h; home.pointsAgainst += a;
  away.pointsFor += a; away.pointsAgainst += h;
  if (h > a) { home.wins += 1; away.losses += 1; }
  else if (a > h) { away.wins += 1; home.losses += 1; }
  else { home.ties += 1; away.ties += 1; }
}

function advanceToPlayoffs(season) {
  season.phase = "wildcard";
  const bracket = {};
  for (const conf of ["AFC","NFC"]) {
    const seeds = season.getPlayoffSeeds(conf).slice(0,7);
    bracket[conf] = seeds.map(t => t.abbreviation);
  }
  season.playoffBracket = bracket;
}

function simulatePlayoffGame(season, homeAbbr, awayAbbr) {
  return simulateGameQuick(season.teams[homeAbbr], season.teams[awayAbbr]);
}

/* ─── Persistência via localStorage ────────────────────────────────────────── */

const SAVES_KEY = "gridiron_saves";

function listSaves() {
  const raw = localStorage.getItem(SAVES_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function saveSeasonToStorage(saveId, season, saveName) {
  const saves = listSaves();
  saves[saveId] = {
    saveName: saveName || saves[saveId]?.saveName || "Temporada",
    createdAt: saves[saveId]?.createdAt || new Date().toLocaleDateString("pt-BR"),
    year: season.year,
    currentWeek: season.currentWeek,
    phase: season.phase,
    playerTeam: season.playerTeam,
    champion: season.champion,
    teams: season.teams,
    schedule: season.schedule,
    playoffBracket: season.playoffBracket,
  };
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

function loadSeasonFromStorage(saveId) {
  const saves = listSaves();
  const data = saves[saveId];
  if (!data) return null;
  const season = new Season({
    year: data.year, currentWeek: data.currentWeek, phase: data.phase,
    playerTeam: data.playerTeam, champion: data.champion,
    playoffBracket: data.playoffBracket,
  });
  for (const [abbr, td] of Object.entries(data.teams)) {
    season.teams[abbr] = new TeamRecord(td);
  }
  for (const gd of data.schedule) {
    season.schedule.push(new GameResult(gd));
  }
  return season;
}

function deleteSave(saveId) {
  const saves = listSaves();
  delete saves[saveId];
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}
