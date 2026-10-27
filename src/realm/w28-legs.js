/* w28: fatigue and the bench (epic 2, phase 5). Loads after w27-notices.js; changes earlier parts only by reassignment
   (saved originals carry the wW28 prefix).

   Every player has legs: p.legs counts the matches they have started since they last rested. At kickoff each starter
   who is Tired (W_FAT.tired or more) shuffles one Fatigue card into the draw pile, and one who is Spent (W_FAT.spent
   or more) two. Fatigue is Sudden Death's own junk card: it costs 1 to shake off, and melts at the end of the turn.
   Then every starter's legs go up by one, and every bench player's down by one: the bench is where legs come back.
   A night in a bed (an inn, your ground) takes W_FAT.bed off everyone's legs, and a night camping out W_FAT.camp.
   Card games only: ball games on the diamond have their own stamina.

   W_FAT, wLegs(p), wLegsState(p) ('fresh' | 'tired' | 'spent'), wFatCards(p), wRestLegs(n)
   Wrapped: wKickoff (legs after the match starts), wSleepInn (a bed), wMakeCamp (a camp), wPreGame (who is tired),
   wCampRow (each player's legs on the Team screen), renderHelp (a paragraph in #wHelpTeam).
   A fightStart hook shuffles the Fatigue cards in. Also a tip (w_legs). */

const W_FAT = { tired: 3, spent: 5, max: 8, bed: 4, camp: 2, card: 'fatigue', off: false };
const W_LEGS_WORD = { fresh: 'Fresh', tired: 'Tired', spent: 'Spent' };

function wLegs(p) { return (p && p.legs) || 0; }
function wLegsState(p) { const n = wLegs(p); return n >= W_FAT.spent ? 'spent' : n >= W_FAT.tired ? 'tired' : 'fresh'; }
function wFatCards(p) { if (W_FAT.off) return 0; const s = wLegsState(p); return s === 'spent' ? 2 : s === 'tired' ? 1 : 0; }
function wRestLegs(n) { for (const p of wRoster()) p.legs = Math.max(0, wLegs(p) - n); }
function wLegsText(p) {
  const s = wLegsState(p), n = wLegs(p);
  if (s === 'fresh') return n ? `Fresh (${n} game${n === 1 ? '' : 's'} since a rest)` : 'Fresh';
  return `${W_LEGS_WORD[s]}: ${n} games since a rest, ${wFatCards(p)} Fatigue card${wFatCards(p) === 1 ? '' : 's'} a match`;
}

/* ---------- at kickoff: Fatigue cards in, then the legs move ---------- */
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!WG || !WG.roster || !B || !W || W_FAT.off) return;
  const who = [];
  for (const p of wStarters()) {
    const n = wFatCards(p); if (!n) continue;
    for (let k = 0; k < n; k++) B.draw.splice(Math.floor(Math.random() * (B.draw.length + 1)), 0, mkCard(W_FAT.card));
    who.push(p.n);
  }
  if (!who.length) return;
  B.wTired = who.length;
  log(`Tired legs: ${who.join(', ')}. Fatigue cards go into your draw pile.`, 'bad');
});
const wW28Kickoff = wKickoff;
wKickoff = function (enc) {
  const r = wW28Kickoff(enc);
  if (WG && WG.roster && !W_FAT.off) {
    const st = wStarters();
    for (const p of wRoster()) p.legs = st.includes(p) ? Math.min(W_FAT.max, wLegs(p) + 1) : Math.max(0, wLegs(p) - 1);
  }
  return r;
};

/* ---------- rest ---------- */
const wW28SleepInn = wSleepInn;
wSleepInn = function (price) {
  const r = wW28SleepInn(price);
  if (!r && WG && WG.roster) wRestLegs(W_FAT.bed);
  return r;
};
const wW28MakeCamp = wMakeCamp;
wMakeCamp = function (roll) {
  const r = wW28MakeCamp(roll);
  if (!r && WG && WG.roster) wRestLegs(W_FAT.camp);
  return r;
};

/* ---------- words: the pre-game card and the Team screen ---------- */
const wW28PreGame = wPreGame;
wPreGame = function (enc) {
  wW28PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'); if (!box || W_FAT.off) return;
  const tired = wStarters().filter(p => wFatCards(p));
  if (!tired.length) return;
  const n = tired.reduce((s, p) => s + wFatCards(p), 0);
  box.insertAdjacentHTML('beforeend', `<p class="hint wlegs">Tired legs: ${tired.map(p => `${esc(p.n)} (${esc(W_LEGS_WORD[wLegsState(p)].toLowerCase())})`).join(', ')}. ${n} Fatigue card${n === 1 ? '' : 's'} go${n === 1 ? 'es' : ''} into your deck. Rest in a bed, or start someone fresh from the bench.</p>`);
};
const wW28CampRow = wCampRow;
wCampRow = function (p, i) {
  const h = wW28CampRow(p, i);
  if (W_FAT.off) return h;
  const s = wLegsState(p), tag = `<span class="wtag wlegs-${s}" title="${esc(wLegsText(p))}">${W_LEGS_WORD[s]}</span>`;
  return h.replace(/(<span class="wtag( wb)?">(Starts|Bench)<\/span>)/, `$1${tag}`);
};

/* ---------- a tip ---------- */
TIPS.w_legs = ['Tired legs', 'A starter who has played three matches without a rest is Tired, and brings a Fatigue card into every match. Sleep in a bed, or swap in someone fresh from the bench on the Team screen.'];
setInterval(() => {
  if (LAB || !SET.tips || !WG || !WG.roster || !RUN || UI.screen !== 'run' || UI.view !== 'world' || W_FAT.off) return;
  if (wStarters().some(p => wFatCards(p))) tip('w_legs');
}, 900);

/* ---------- How to play ---------- */
const wW28RenderHelp = renderHelp;
renderHelp = function () {
  wW28RenderHelp();
  const sec = $('wHelpTeam'); if (!sec || $('wHelpLegs')) return;
  sec.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpLegs"><b>Tired legs.</b> Each match a player starts adds to their legs; each match on the bench takes one off. After ${W_FAT.tired} matches without rest a starter is Tired and brings 1 Fatigue card into the deck at kickoff; after ${W_FAT.spent}, Spent, and 2. A Fatigue card costs 1 to shake off and melts at the end of the turn. A night in a bed takes ${W_FAT.bed} off everyone's legs, and camping out ${W_FAT.camp}. The Team screen shows who is Fresh, Tired or Spent: on a long road trip, rotate.</p>`);
};
