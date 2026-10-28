/* w29: the captain (epic 2, phase 6). Loads after w28-legs.js; changes earlier parts only by reassignment (saved
   originals carry the wW29 prefix).

   Name one starter captain on the Team screen. While the captain starts, their kind gives the whole team a bonus in
   every card-game match (W_CAPTAIN, one for each of the 18 kinds a player can be). The bonuses are declarative: each says what it does and when, as
   Sudden Death's trophies do (on: { event: fn }), and one onHook per event runs the captain's. A captain on the bench
   gives nothing until they start again. A new journey makes the first starter captain; so does an old save.

   WG.captain = player id, or null. W_CAPTAIN, wCaptain() (the player, if they start), wSetCaptain(pid)
   Wrapped: wNewGame (no captain yet), wStart (a captain for a new journey or an old save), wRelease (a released
   captain hands the armband to the first starter), wPreGame (the captain's line), wCampRow and wRenderCamp (the
   armband and the Captain button), renderHelp (a paragraph in #wHelpTeam). */

const W_CAPTAIN = {
  goblin:   { n: 'Pickpocket', d: '6 gold more after every win.', on: { fightWon: () => { RUN.gold += 6; } } },
  kobold:   { n: 'Firebug', d: 'Every enemy starts with 2 Burn.', on: { fightStart: () => { for (const e of alive()) addSt(e, 'burn', 2); } } },
  werewolf: { n: 'Pack Leader', d: '1 Strength at kickoff.', on: { fightStart: () => addSt(B.P, 'str', 1) } },
  dwarf:    { n: 'Shield Wall', d: '8 Block at kickoff.', on: { fightStart: () => { B.P.block += 8; } } },
  ogre:     { n: 'Looming', d: 'Every enemy starts Weak for a turn.', on: { fightStart: () => { for (const e of alive()) addSt(e, 'weak', 1); } } },
  minotaur: { n: 'Stampede', d: '4 damage to every enemy at kickoff.', on: { fightStart: () => { for (const e of alive()) hurtEnemy(e, 4, { raw: true }); } } },
  troll:    { n: 'Thick Hide', d: 'Heal 1 HP at the end of every turn.', on: { turnEndHeal: () => healP(1) } },
  golem:    { n: 'Bedrock', d: '1 Dexterity at kickoff.', on: { fightStart: () => addSt(B.P, 'dex', 1) } },
  harpy:    { n: 'Shriek', d: 'Every enemy starts Vulnerable for a turn.', on: { fightStart: () => { for (const e of alive()) addSt(e, 'vuln', 1); } } },
  elf:      { n: 'Light Feet', d: '4 Block at the start of each of the first three turns.', on: { turnStart: () => { if (B.turn <= 3) B.P.block += 4; } } },
  wraith:   { n: 'Dread', d: 'The toughest enemy starts Weak for two turns.', on: { fightStart: () => { const e = alive().slice().sort((a, b) => b.hp - a.hp)[0]; if (e) addSt(e, 'weak', 2); } } },
  vampire:  { n: 'Bloodthirst', d: 'Heal 3 HP whenever an enemy falls.', on: { enemyFalls: () => healP(3) } },
  lich:     { n: 'Rot', d: 'Every enemy starts with 3 Poison.', on: { fightStart: () => { for (const e of alive()) addSt(e, 'psn', 3); } } },
  zombie:   { n: 'Shamble', d: '2 Strength at the start of turn 3.', on: { turnStart: () => { if (B.turn === 3) addSt(B.P, 'str', 2); } } },
  gorgon:   { n: 'Stone Gaze', d: 'The toughest enemy starts Stunned: it loses its first turn.', on: { fightStart: () => { const e = alive().slice().sort((a, b) => b.hp - a.hp)[0]; if (e && !isBoss(e)) addSt(e, 'stun', 1); } } },
  spider:   { n: 'Web', d: 'Every enemy starts with 1 Poison and Weak for a turn.', on: { fightStart: () => { for (const e of alive()) { addSt(e, 'psn', 1); addSt(e, 'weak', 1); } } } },
  skeleton: { n: 'Bone Armour', d: '2 Block at the start of every turn.', on: { turnStart: () => { B.P.block += 2; } } },
  witch:    { n: 'Hex', d: 'One enemy starts Vulnerable for two turns.', on: { fightStart: () => { const e = pick(alive()); if (e) addSt(e, 'vuln', 2); } } },
};
const W_CAPT = { off: false };

/* ---------- who ---------- */
function wCaptainId() { return WG ? WG.captain : null; }
/* the captain, if they start; null on the bench or with none named */
function wCaptain() { const id = wCaptainId(); return id != null && wIsStarter(id) ? wPlayer(id) : null; }
function wCaptainFx() { const p = !W_CAPT.off && wCaptain(); return p ? W_CAPTAIN[p.kind] || null : null; }
/* '' or why not */
function wSetCaptain(pid) {
  const p = wPlayer(pid); if (!p) return 'There is nobody like that on the team.';
  if (!wIsStarter(pid)) return `${p.n} is on the bench. A captain must start.`;
  if (WG.captain === pid) return '';
  WG.captain = pid;
  const C = W_CAPTAIN[p.kind];
  wLog(`${p.n} is your captain${C ? `: ${C.n}. ${C.d}` : '.'}`, 'm');
  wSave();
  return '';
}
function wCaptainEnsure() { if (WG && WG.roster && (WG.captain == null || !wPlayer(WG.captain))) WG.captain = (wStarters()[0] || {}).id ?? null; }

/* ---------- the bonus: one hook per event, running the captain's ---------- */
for (const ev of [...new Set(Object.values(W_CAPTAIN).flatMap(C => Object.keys(C.on)))]) {
  onHook(ev, a => {
    if (!WG || !B || !RUN || !RUN.pending || !RUN.pending.world) return;
    const C = wCaptainFx(), f = C && C.on[ev]; if (!f) return;
    if (ev === 'fightStart') { const p = wCaptain(); log(`Captain ${p.n}: ${C.n}. ${C.d}`, 'good'); }
    f(a);
  });
}

/* ---------- a captain for every journey ---------- */
const wW29NewGame = wNewGame;
wNewGame = function (opts) { const r = wW29NewGame(opts); if (WG) WG.captain = null; return r; };
const wW29Start = wStart;
wStart = function (a, b) {
  const r = wW29Start(a, b);
  wCaptainEnsure();
  return r;
};
const wW29Release = wRelease;
wRelease = function (pid) {
  const was = WG && WG.captain === pid, why = wW29Release(pid);
  if (!why && was) { WG.captain = null; wCaptainEnsure(); const p = wPlayer(WG.captain); if (p) wLog(`${p.n} takes the captain's armband.`, 'm'); }
  return why;
};

/* ---------- words ---------- */
const wW29PreGame = wPreGame;
wPreGame = function (enc) {
  wW29PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'); if (!box || W_CAPT.off) return;
  const p = wCaptain(), C = p && W_CAPTAIN[p.kind];
  const sat = !p && wPlayer(wCaptainId());
  if (C) box.insertAdjacentHTML('beforeend', `<p class="hint wcapt">Captain ${esc(p.n)}: <b>${esc(C.n)}</b>. ${esc(C.d)}</p>`);
  else if (sat) box.insertAdjacentHTML('beforeend', `<p class="hint wcapt">Your captain, ${esc(sat.n)}, is on the bench: no captain's bonus.</p>`);
};
const wW29CampRow = wCampRow;
wCampRow = function (p, i) {
  let h = wW29CampRow(p, i);
  if (W_CAPT.off) return h;
  const C = W_CAPTAIN[p.kind], cap = wCaptainId() === p.id, st = i < W_PARTY.starters;
  const tag = cap ? `<span class="wtag wcap" title="${esc(C ? `${C.n}: ${C.d}${st ? '' : ' (not while on the bench)'}` : 'Captain')}">C</span>` : '';
  h = h.replace(/(<b>[^<]*<\/b>)/, `$1${tag}`);
  const btn = st && !cap ? `<button class="ghost" data-capt title="${esc(C ? `${C.n}: ${C.d}` : '')}">Captain</button>` : '';
  return btn ? h.replace('<div class="wpa">', `<div class="wpa">${btn}`) : h;
};
const wW29RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW29RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  body.querySelectorAll('[data-capt]').forEach(b => b.onclick = () => { const why = wSetCaptain(+b.closest('[data-pid]').dataset.pid); wCampSay(why); });
};

/* ---------- How to play ---------- */
const wW29RenderHelp = renderHelp;
renderHelp = function () {
  wW29RenderHelp();
  const sec = $('wHelpTeam'); if (!sec || $('wHelpCaptain')) return;
  sec.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpCaptain"><b>The captain.</b> Name one starter captain on the Team screen (the Captain button; the armband shows as C). While the captain starts, their kind gives the team a bonus in every match: a dwarf's Shield Wall is 8 Block at kickoff, a lich's Rot is 3 Poison on every enemy, a goblin's Pickpocket is 6 gold more after each win. The button says what each player's would be. A captain on the bench gives nothing.</p>`);
};
