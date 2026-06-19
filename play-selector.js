/* play-selector.js — Lógica de seleção de jogadas (agressividade + playbook + foco) */

const OFF_PLAYS = [
  { name:"Inside Run",     type:PlayType.RUN_INSIDE,  risk:1, reward:2, idealDown:[1,2], idealDistance:"short" },
  { name:"Sweep",          type:PlayType.RUN_OUTSIDE, risk:2, reward:3, idealDown:[1,2], idealDistance:"any" },
  { name:"Slant Pass",     type:PlayType.PASS_SHORT,  risk:1, reward:2, idealDown:[1,2,3], idealDistance:"short" },
  { name:"Crossing Route", type:PlayType.PASS_MEDIUM, risk:2, reward:3, idealDown:[2,3], idealDistance:"medium" },
  { name:"Fly Route",      type:PlayType.PASS_DEEP,   risk:4, reward:5, idealDown:[2,3], idealDistance:"long" },
  { name:"Play Action",    type:PlayType.PLAY_ACTION, risk:3, reward:4, idealDown:[1,2], idealDistance:"any" },
  { name:"Screen Pass",    type:PlayType.SCREEN,      risk:2, reward:3, idealDown:[2,3], idealDistance:"medium" },
  { name:"QB Draw",        type:PlayType.QB_SCRAMBLE, risk:3, reward:3, idealDown:[3], idealDistance:"medium" },
  { name:"Field Goal",     type:PlayType.FIELD_GOAL,  risk:1, reward:3, idealDown:[4], idealDistance:"any" },
  { name:"Punt",           type:PlayType.PUNT,        risk:1, reward:1, idealDown:[4], idealDistance:"any" },
];

const DEF_PLAYS = [
  { name:"Cover 2 Zone", type:PlayType.DEF_ZONE,    risk:1, reward:2, idealDown:[1,2], idealDistance:"any" },
  { name:"Man Coverage", type:PlayType.DEF_MAN,     risk:3, reward:3, idealDown:[2,3], idealDistance:"any" },
  { name:"5-Man Blitz",  type:PlayType.DEF_BLITZ,   risk:4, reward:5, idealDown:[3], idealDistance:"long" },
  { name:"Prevent D",    type:PlayType.DEF_PREVENT, risk:1, reward:1, idealDown:[3,4], idealDistance:"long" },
  { name:"DL Bull Rush", type:PlayType.DEF_RUSH,    risk:2, reward:3, idealDown:[2,3], idealDistance:"medium" },
];

const RUN_PLAYS  = ["Inside Run","Sweep","QB Draw"];
const PASS_PLAYS = ["Slant Pass","Crossing Route","Fly Route","Play Action","Screen Pass"];

const PLAYBOOKS = {
  "Pro Style":  ["Play Action","Crossing Route","Inside Run"],
  "Air Raid":   ["Fly Route","Crossing Route","Play Action"],
  "Power Run":  ["Inside Run","Sweep","QB Draw"],
  "West Coast": ["Slant Pass","Screen Pass","Crossing Route"],
  "Spread":     ["Fly Route","Slant Pass","Screen Pass"],
  "Option":     ["QB Draw","Sweep","Inside Run"],
};

const AGGRO_LABELS = { conservative:"Conservador", balanced:"Equilibrado", aggressive:"Agressivo" };
const FOCUS_LABELS = { run:"Corrida", balanced:"Balanceado", pass:"Passe" };

function aggroWeight(risk, aggressiveness) {
  if (aggressiveness === "conservative") return Math.max(0.2, 5 - risk);
  if (aggressiveness === "aggressive")   return Math.max(0.2, risk);
  return 2.5;
}

function weightedChoice(candidates, weights) {
  const total = weights.reduce((a,b) => a+b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function makePlay(p) {
  return new Play(p.name, p.type, p.risk, p.reward, p.idealDown, p.idealDistance);
}

function pickOffense(aggressiveness, playbook, focus, down, yardsToGo) {
  if (down === 4) {
    if (aggressiveness === "aggressive") {
      if (yardsToGo <= 3) {
        const pool = OFF_PLAYS.filter(p => RUN_PLAYS.includes(p.name));
        return makePlay(pool.length ? choice(pool) : OFF_PLAYS[0]);
      } else if (yardsToGo <= 8) {
        const pool = OFF_PLAYS.filter(p => PASS_PLAYS.includes(p.name));
        return makePlay(pool.length ? choice(pool) : OFF_PLAYS[2]);
      }
    } else if (aggressiveness === "balanced" && yardsToGo <= 2) {
      const pool = OFF_PLAYS.filter(p => RUN_PLAYS.includes(p.name));
      return makePlay(pool.length ? choice(pool) : OFF_PLAYS[0]);
    }
    const fg  = OFF_PLAYS.find(p => p.name === "Field Goal");
    const pnt = OFF_PLAYS.find(p => p.name === "Punt");
    return makePlay(yardsToGo <= 5 ? fg : pnt);
  }

  const bonus = new Set(PLAYBOOKS[playbook] || []);
  const nRun  = OFF_PLAYS.filter(p => RUN_PLAYS.includes(p.name)).length;
  const nPass = OFF_PLAYS.filter(p => PASS_PLAYS.includes(p.name)).length;
  const runRatio = { run:0.72, balanced:0.50, pass:0.28 }[focus] ?? 0.50;

  const candidates = [], weights = [];
  for (const p of OFF_PLAYS) {
    if (p.name === "Field Goal" || p.name === "Punt") continue;
    const isRun = RUN_PLAYS.includes(p.name);
    let w = aggroWeight(p.risk, aggressiveness);
    w *= isRun ? (runRatio / Math.max(1,nRun)) : ((1-runRatio) / Math.max(1,nPass));
    if (bonus.has(p.name)) w *= 2.2;
    if (p.idealDown.length && !p.idealDown.includes(down)) w *= 0.4;
    if (p.idealDistance === "short" && yardsToGo >= 7) w *= 0.3;
    if (p.idealDistance === "long"  && yardsToGo < 7)  w *= 0.3;
    candidates.push(p); weights.push(Math.max(0.001, w));
  }
  return makePlay(weightedChoice(candidates, weights));
}

function pickDefense(aggressiveness, down, yardsToGo, defPlaybook = "4-3") {
  const bonus = new Set(DEF_PLAYBOOKS[defPlaybook] || []);
  const candidates = [], weights = [];
  for (const p of DEF_PLAYS) {
    let w = aggroWeight(p.risk, aggressiveness);
    if (bonus.has(p.name)) w *= 2.0;
    if (p.idealDown.length && !p.idealDown.includes(down)) w *= 0.5;
    if (p.idealDistance === "long" && yardsToGo < 7) w *= 0.4;
    candidates.push(p); weights.push(Math.max(0.001, w));
  }
  return makePlay(weightedChoice(candidates, weights));
}
