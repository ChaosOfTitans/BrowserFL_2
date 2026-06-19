/* sound-manager.js — Gerenciador de sons */

class SoundManager {
  constructor() {
    this.sounds = {
      td_home:       "sounds/td_home.wav",
      td_away:       "sounds/td_away.wav",
      turnover_bad:  "sounds/turnover_bad.wav",
      turnover_good: "sounds/turnover_good.wav",
      fieldgoal:     "sounds/fieldgoal.wav",
      whistle:       "sounds/whistle.wav",
    };
    this.enabled = true;
  }

  play(key) {
    if (!this.enabled) return;
    const src = this.sounds[key];
    if (!src) return;
    try { new Audio(src).play().catch(() => {}); } catch {}
  }

  /* possession = "home" significa que o JOGADOR (home) estava com a bola antes da jogada.
     Sons "bons" = home marcou / adversário perdeu bola.
     Sons "ruins" = adversário marcou / home perdeu bola.  */
  playForResult(event, description, turnover, possession, status = "") {
    const desc = description.toUpperCase(), st = status.toUpperCase();
    let key = null;

    if (event === "field_goal_good" || (st.includes("FIELD GOAL") && (st.includes("BOM") || st.includes("É BOM")))) {
      key = possession === "home" ? "fieldgoal" : "turnover_bad";
    } else if (desc.includes("TOUCHDOWN") || st.includes("TOUCHDOWN")) {
      key = possession === "home" ? "td_home" : "td_away";
    } else if (event === "interception") {
      // home perdeu a bola = bad; away perdeu = good
      key = possession === "home" ? "turnover_bad" : "turnover_good";
    } else if (event === "fumble") {
      key = possession === "home" ? "turnover_bad" : "turnover_good";
    }

    if (key) this.play(key);
  }
}
