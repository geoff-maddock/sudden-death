/* u3: corrupted monsters and the card game at tier U (issue #99, phase 3). Loads after u2-world.js; changes earlier parts
   only by reassignment (saved originals carry the wWU3 prefix).

   Every card match on the dark side is an Umbral match (enc.world.umbral): tier 3, and on top of it tier U
   (W_UMB3.card): the other side has more HP and Strength, and you draw as at the Hall of Fame (B.drawMod, one card
   fewer). Its players are their umbral forms: drawn in shadow (e.shade: drained colours, pale glowing eyes, in the
   fight and on the map) and each with its kind's dark trait (W_UMB3.traits, named on the match's log).
   The Nadir champions hold the Seal's nine pieces (W_UMB_PIECES). Each waits somewhere on the dark side (W_NADIR) and
   plays when asked (PLAY): a match that draws hexes (W_UMB3.hexes: one or two, announced on the match card and in the
   log), a piece to the winner. Lose, and the next try costs a toll. The first is the Gatekeeper, at the Gate on the
   dark road just through the portal: the card game, played straight, the gentlest of the nine. The others come with
   their sports (phase 4).
   A new curse: the Umbral Shade (u_shade), unplayable, 1 HP lost if it is in your hand at the end of your turn, and it
   fades at the end of the match like any match-only card.

   W_UMB3, W_UMB_PIECES, W_NADIR, wNadirMatch, wUmbHexes
   Wraps: wBuildEncounter (wWU3BuildEncounter: an Umbral match is tier 3 and carries its hexes), wPreGame (wWU3PreGame:
   the match card names tier U and the hexes), wRunAct (wWU3RunAct: PLAY), buildAllMaps (wWU3BuildAllMaps: the
   champions on their maps), wDrawActor (wWU3DrawActor: the dark side's people in shadow), wAudit (wWU3Audit: the
   champions are placed when the maps are, and every piece has a champion). */

const W_UMB3 = {
  card: { hp: 1.25, str: 1, draw: -1 },
  darkKinds: ['wild', 'event', 'camp', 'legend'],   // what the dark side starts: wild, road events (hunters, grudges), camp ambushes, road legends
  traits: {
    goblin: { n: 'Light Fingers', d: '1 more Strength.', go: e => addSt(e, 'str', 1) },
    kobold: { n: 'Swarming', d: 'A fifth more HP.', go: e => wUmbHp(e, 1.2) },
    werewolf: { n: 'Moon-Mad', d: 'Gains Strength every turn (Full Moon 1).', go: e => addSt(e, 'ritual', 1) },
    dwarf: { n: 'Iron Beard', d: 'Starts with 8 Block.', go: e => blockE(e, 8) },
    ogre: { n: 'Won\'t Flinch', d: 'Starts with 12 Block.', go: e => blockE(e, 12) },
    minotaur: { n: 'Bull Rush', d: '2 more Strength.', go: e => addSt(e, 'str', 2) },
    troll: { n: 'Rot-Regrowth', d: 'Regen 3.', go: e => addSt(e, 'regen', 3) },
    golem: { n: 'Bedrock', d: 'Starts with 10 Block.', go: e => blockE(e, 10) },
    harpy: { n: 'Shriek', d: 'You start Weak 1.', go: () => debuffP('weak', 1) },
    elf: { n: 'Pale Arrow', d: '1 more Strength.', go: e => addSt(e, 'str', 1) },
    wraith: { n: 'Half There', d: '1 more Strength, and starts with 6 Block.', go: e => { addSt(e, 'str', 1); blockE(e, 6); } },
    vampire: { n: 'Thirst', d: 'Regen 2.', go: e => addSt(e, 'regen', 2) },
    lich: { n: 'Phylactery', d: 'A quarter more HP.', go: e => wUmbHp(e, 1.25) },
    zombie: { n: 'Rot', d: 'Three tenths more HP.', go: e => wUmbHp(e, 1.3) },
    gorgon: { n: 'Stone Gaze', d: 'You start Exposed 1.', go: () => debuffP('vuln', 1) },
    spider: { n: 'Webs the Bench', d: 'A Slimed in your draw pile.', go: () => wUmbSlip('slimed', 1) },
    skeleton: { n: 'Rattle', d: 'Spikes 2.', go: e => addSt(e, 'thorns', 2) },
    witch: { n: 'Hex', d: 'An Umbral Shade in your draw pile.', go: () => wUmbSlip('u_shade', 1) },
  },
  // the card game's hexes: a Nadir match draws one or two
  hexes: {
    shades: { n: 'Shades in the Deck', d: 'Two Umbral Shades are shuffled into your draw pile.', go: () => wUmbSlip('u_shade', 2) },
    grudge: { n: 'Old Grudge', d: 'Every player on the other side starts with 2 Strength.', go: () => { for (const e of B.enemies) addSt(e, 'str', 2); } },
    chill: { n: 'Cold Hands', d: 'You start Weak 2.', go: () => debuffP('weak', 2) },
    bare: { n: 'Bad Light', d: 'You start Exposed 2.', go: () => debuffP('vuln', 2) },
    wall: { n: 'The Wall', d: 'Every player on the other side starts with 8 Block.', go: () => { for (const e of B.enemies) blockE(e, 8); } },
  },
};
function wUmbHp(e, k) { e.max = Math.round(e.max * k); e.hp = Math.round(e.hp * k); }
// cards into your draw pile for this match only
function wUmbSlip(id, n) { for (let i = 0; i < n; i++) B.draw.splice(ri(0, B.draw.length), 0, mkCard(id)); }
K('u_shade', 'Umbral Shade', 'none', 'curse', -1, 'x', 'self', [], { endHurt: 1, fl: 'Unplayable. While in hand at the end of your turn, lose 1 HP. It fades when the match is over.' });

// the nine pieces of the Seal of the Crown, one for every way to play
const W_UMB_PIECES = {
  card: { n: 'The Cracked Card', sport: 'the card game' }, baseball: { n: 'The Iron Stitch', sport: 'baseball' }, basketball: { n: 'The Black Net', sport: 'basketball' },
  golf: { n: 'The Hollow Flag', sport: 'golf' }, bowling: { n: 'The Drowned Pin', sport: 'bowling' }, curling: { n: 'The Sunken Stone', sport: 'curling' },
  football: { n: 'The Ash Ball', sport: 'football' }, boxing: { n: 'The Broken Bell', sport: 'boxing' }, hockey: { n: 'The Dead Puck', sport: 'hockey' },
};
// the Nadir champions: where each waits, who they field, what they hold. Phase 4 adds the sports' champions.
const W_NADIR = {
  gate: { piece: 'card', char: 'nadir_gate', map: 'u:umbralden', at: [9, 4], region: 'rime', ids: ['u_gatekeeper', 'boneline'], type: 'elite', hexes: 2, toll: 30, gold: 80 },
};
EN('u_gatekeeper', 'The Gatekeeper', 'lich', [150, 160], {
  stack: { n: 'Stack the Deck', ops: [['b', 14], ['s', 'str', 2]] },
  deal: { n: 'Deal from the Bottom', ops: [['a', 12], ['add', 'u_shade', 1, 'discard']] },
  cut: { n: 'Cut Three Ways', ops: [['a', 6, 3]] },
  fold: { n: 'Make You Fold', ops: [['p', 'weak', 2], ['p', 'vuln', 1], ['a', 4]] },
}, { seq: ['stack', 'deal', 'cut', 'fold'] }, { team: { name: 'The Nadir', short: 'NDR', color: '#3a2a4a', light: '#c8b8ff' }, aura: 'wisps', flav: 'Has dealt every hand ever played on this side of the door, and never once from the top.' });
DB.chars.nadir_gate = { name: 'Morrow Vane, the Gatekeeper', kind: 'lich', look: { coat: '#3a2a4a', acc: 'hat' },
  greet: 'You came through. They always do, the first time. I hold the CARD. Say PLAY when you want to lose it to me again. Ask about the RULES first, if you like.',
  topics: {
    job: { t: 'I keep the Gate. Nobody comes further in without playing me first. Nobody has to, but they all do.' },
    card: { t: 'The Cracked Card. One ninth of your Seal. Win a hand of ours and it is yours. Lose, and the next hand costs you a TOLL.' },
    rules: { t: 'Our cards, our rules. Everything here is harder: my side has more in it, you hold one card fewer, and before we start I draw the HEXES. Two, for you.' },
    hexes: { t: 'A little something extra on the table. Shades in your deck, a grudge, cold hands. You will see which before we start.' },
    toll: { t: 'Thirty gold a hand, after the first. The first is free. Nothing else here is.' },
    play: { t: 'Then sit down.', act: 'unadir:gate' },
  } };

/* ---------- every match on the dark side is an Umbral match ---------- */
const wWU3BuildEncounter = wBuildEncounter;
wBuildEncounter = function (o) {
  // (a match the dark side starts: wild, a road event, or one marked umbral. Not one started from a screen that works
  // anywhere, like the realm daily, which is the same for everyone)
  const kind = (o && o.world && o.world.kind) || 'wild', umb = !!(o && o.world && o.world.umbral) || (wUmbDark() && W_UMB3.darkKinds.includes(kind));
  const enc = wWU3BuildEncounter.call(this, umb ? Object.assign({}, o, { tier: 3 }) : o);
  if (umb) { enc.world.umbral = 1; if (o.world && o.world.hexes) enc.world.hexes = o.world.hexes.slice(); }
  return enc;
};
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world; if (!B || !W || !W.umbral) return;
  B.umb = 1; B.drawMod = (B.drawMod || 0) + W_UMB3.card.draw;
  if (W.kind === 'nadir' && W.ref && W.ref.toll) { RUN.gold = Math.max(0, RUN.gold - W.ref.toll); log(`You pay the toll: ${W.ref.toll} gold.`, 'sys'); }
  const named = wUmbForm(B.enemies);
  log(`The Umbral: tier U. The other side has more HP and Strength, and you draw one card fewer.${Object.keys(named).length ? ' ' + Object.keys(named).map(n => `${n}: ${named[n]}`).join(' ') : ''}`, 'bad');
  for (const h of W.hexes || []) { const H = W_UMB3.hexes[h]; if (H) { H.go(); log(`Hex: ${H.n}. ${H.d}`, 'bad'); } }
});
// the umbral form: shadow, more HP and Strength, the kind's dark trait; once for each player (e.shade marks it done)
function wUmbForm(es) {
  const named = {};
  for (const e of es) {
    if (e.shade || e.dead) continue;
    e.shade = 1; wUmbHp(e, W_UMB3.card.hp); addSt(e, 'str', W_UMB3.card.str);
    const T = W_UMB3.traits[e.kind]; if (T) { T.go(e); named[T.n] = T.d; }
  }
  return named;
}
// a player who joins mid-match (summoned) takes the form at the start of your next turn
onHook('turnStart', () => { if (B && B.umb && B.enemies.some(e => !e.shade && !e.dead)) wUmbForm(B.enemies); });
const wWU3PreGame = wPreGame;
wPreGame = function (enc) {
  const r = wWU3PreGame.apply(this, arguments), W = enc && enc.world, box = $('modalBox'), txt = box && box.querySelector('.wpgtxt');
  if (W && W.umbral && txt) {
    // (a blackout on this side wakes you by a lantern, not at an inn)
    for (const p of txt.querySelectorAll('p.hint')) if (p.innerHTML.includes('wake at your last inn')) p.innerHTML = p.innerHTML.replace('wake at your last inn', 'wake by your last lantern (or by the portal)');
    const hx = (W.hexes || []).map(h => W_UMB3.hexes[h]).filter(Boolean);
    txt.insertAdjacentHTML('beforeend', `<p class="hint wumbpg"><b>The Umbral: tier U.</b> The other side has more HP and Strength, each player has its kind's dark trait, and you draw one card fewer.</p>${hx.length ? `<p class="hint wumbpg"><b>Hexes:</b> ${hx.map(H => `${esc(H.n)} (${esc(H.d)})`).join(' ')}</p>` : ''}`);
  }
  return r;
};

/* ---------- the champions ---------- */
// a champion's hexes for this try: drawn from the table, fixed for the try (so a reload doesn't redraw them)
function wUmbHexes(id, n) {
  const U = wUmb(), ks = Object.keys(W_UMB3.hexes), r = mulberry(wUmbHash(id) + 977 * ((U && U.tries[id]) || 0) + (WG.year || 1));
  const out = []; while (out.length < Math.min(n, ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
function wNadirMatch(id) {
  const C = W_NADIR[id], U = wUmb(); if (!C || !U) return 'Nobody here plays.';
  if (U.pieces.includes(C.piece)) return `${DB.chars[C.char].name} has nothing left to play for: ${W_UMB_PIECES[C.piece].n} is yours.`;
  const tries = U.tries[id] || 0;
  // (the toll is paid at kickoff: backing away from the match card costs nothing)
  if (tries > 0 && RUN.gold < C.toll) return `Another hand costs a toll of ${C.toll} gold, and you have ${RUN.gold}.`;
  const ch = DB.chars[C.char];
  startMatch({ type: C.type, ids: C.ids.slice(), tier: 3, lv: W_ROAD.maxLv, ambush: false, trait: false, name: ch.name,
    world: { kind: 'nadir', ref: { id, toll: tries > 0 ? C.toll : 0 }, region: C.region, umbral: 1, hexes: wUmbHexes(id, C.hexes) } });
  return '';
}
W_ON_END.nadir = function (r, ref) {
  const C = ref && W_NADIR[ref.id], U = wUmb(); if (!C || !U) return;
  if (r === 'win') {
    if (!U.pieces.includes(C.piece)) U.pieces.push(C.piece);
    U.beaten[ref.id] = WG.dayAbs; RUN.gold += C.gold;
    wLog(`You beat ${DB.chars[C.char].name}, and ${W_UMB_PIECES[C.piece].n} is yours: ${U.pieces.length} of 9 pieces of the Seal. ${C.gold} gold.`, 'g');
    wGainCard({ pick: 3, rarity: 'r' }, DB.chars[C.char].name);
  } else U.tries[ref.id] = (U.tries[ref.id] || 0) + 1;
  wSave();
};
const wWU3RunAct = wRunAct;
wRunAct = function (act, id) {
  if (typeof act === 'string' && act.startsWith('unadir:')) { WUI.held = null; if (WUI.talk) wCloseTalk(); const why = wNadirMatch(act.slice(7)); if (why) wLog(why, 'b'); return; }
  return wWU3RunAct.apply(this, arguments);
};
// each champion stands on their map, on the free tile nearest their spot that keeps everything reachable
function wUmbPlaceChamps() {
  for (const id in W_NADIR) {
    const C = W_NADIR[id], m = MAPS[C.map]; if (!m || C.ground || m.npcs.some(n => n.id === C.char)) continue; // (a dark ground's champion: u4 places them)
    const s = bfsReach(m, m.spawn[0], m.spawn[1]), [hx, hy] = C.at;
    const ok = (x, y) => { const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c]; return td && td.walk && !td.enter && c !== '=' && !m.npcs.some(n => n.x === x && n.y === y) && !m.meta[x + ',' + y] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s[(y + dy) * m.w + x + dx]); };
    let at = null;
    for (let r = 0; !at && r < 6; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(hx + dx, hy + dy)) at = [hx + dx, hy + dy];
    if (at) m.npcs.push({ id: C.char, x: at[0], y: at[1], fixed: true });
  }
}
const wWU3BuildAllMaps = buildAllMaps;
buildAllMaps = function () { const r = wWU3BuildAllMaps.apply(this, arguments); wUmbPlaceChamps(); return r; };
// on the dark side, its people are in shadow (your team and your pet are not)
const wWU3DrawActor = wDrawActor;
wDrawActor = function (c, who, px, py, t, opts) {
  if (who && !who.team && !who.shade && wUmbDark()) who = Object.assign({}, who, { shade: 1 });
  return wWU3DrawActor.call(this, c, who, px, py, t, opts);
};
const wWU3Audit = wAudit;
wAudit = function () {
  const P = wWU3Audit.apply(this, arguments).filter(s => !Object.values(W_NADIR).some(C => s === 'character ' + C.char + ' is never placed on a map'));
  for (const id in W_NADIR) { const C = W_NADIR[id], m = MAPS[C.map]; if (!m || !m.npcs.some(n => n.id === C.char)) P.push('the Nadir champion ' + id + ' has nowhere to stand on ' + C.map); if (!W_UMB_PIECES[C.piece]) P.push('the Nadir champion ' + id + ' holds no piece'); }
  return P;
};
