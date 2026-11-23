/* u8i: the corrupted legends (issue #111, phase F). Loads after u8h-market.js (it wraps u8h's wUmbHexCut); changes
   earlier parts only by reassignment (saved originals carry the wWU8I prefix).

   Three legends wake with the Dread (u8c), one at each stage from the Stirring on, and stand on the dark world until
   beaten: optional, hard card-game boss fights in two phases (the light side's boss pattern: ENEMIES[id].phases, a
   second set of moves under half HP through the brain). Each is drawn in shadow in its own superstar kind.
     the Corrupted Kraken      the Stirring (3 pieces), the Drownfen. Drowns your hand: at the start of your next turn
                               cards in your hand go under (to the discard pile) and a Slimed comes up for each.
     the Corrupted Phoenix     the Raging (6 pieces), the Ashmaw. Burn; and once, when it would go down, it rises at
                               W_UMB8I.rise of its HP (killEnemy, e.uRise).
     the Corrupted Frost Wyrm  the Last Hour (8 pieces), by the Hollow Coliseum's way in. Weak and Exposed, and a
                               Blizzard: at the start of each of your turns a card in your hand freezes and can't be
                               played that turn (B.uFrost, the cards' uids; two a turn under half HP).
   Each stage's scene (u8c) gains a line about its legend. A legend's lair is a spot on the dark world (MAPS['u:world']
   .legends, k -> [x, y], placed when the maps are, as u2 places lanterns: never off the ground, on a road, a hazard, in
   a lantern's light or beside a place's way in, and never cutting anywhere off, all three standing at once). It stands there only while awake (its
   stage reached, not beaten, the Seal not forged): wNpcAt answers for it, so walking into it, facing it or clicking it
   opens the match card (the realm's own, with its two phases and the prize named). Shadows and pits keep off a lair.
   WG.umbral.legends: { k: 'awake' | 'beaten' } (absent before it wakes; an old save has no key).
   The prize: a Legend's Shard (WG.umbral.shards, a count), a rare card and W_UMB8I.gold gold; no trophy (a legend is a
   boss to the card game, but its prize is the shard). Lose: the dark side's blackout (u2); the legend stays, whole.
   A shard is spent on a round of the Seal: before the round starts (PLAY with Hollow Aurelia), set it on the round,
   for one hex fewer (wUmbHexCut, 'finale'; offered only while the round still draws one, wUmbShardRoom) or, in a card round, 15 Block at the start (WG.umbral.shardOn: { r, how }).
   It is spent when that round ends, won or lost; backing out of the round's card keeps it set on the round.
   Three Nadir lineups field a corrupted legend in place of one player (W_UMB8I.lineups, written into the lineup
   tables at load, so the finale's round in that sport fields it too): the Behemoth on the Cinder Pit's line
   (football), the Hydra on the Black Court (basketball) and the Djinn in the Drowned Lanes (bowling). The Behemoth and
   the Djinn play a level under the rest (lineups[k].down: at their team's level each took about 5 points off its
   champion's game in the labs; docs/realm/BALANCE.md). Their game cards name it; the side is drawn in shadow as every
   Nadir side is (u8e).

   W_UMB8I, wUmbLegendAwake, wUmbLegendAt, wUmbLegendMatch, wUmbPlaceLegends, wUmbShardUse
   Wraps: buildAllMaps (wWU8IBuildAllMaps: the lairs), wNpcAt (wWU8INpcAt: an awake legend stands there), wTalkTo
   (wWU8ITalkTo: its match card), wTryMove (wWU8ITryMove: walking into it), wUmbFreeAt (wWU8IFreeAt: shadows and pits
   keep off a lair), wLookText (wWU8ILookText), wPreGame (wWU8IPreGame: the phases and the prize on its card),
   combatRewards (wWU8ICombatRewards: no trophy for a legend), killEnemy (wWU8IKillEnemy: the Phoenix rises),
   playerTurnStart (wWU8IPlayerTurnStart: the drowned hand, the Blizzard), canPlay (wWU8ICanPlay: a frozen card),
   cardHTML (wWU8ICardHTML: Frozen), wMakePlayer (wWU8IMakePlayer: a lineup's legend a level down), bossOp (wWU8IBossOp: the drowning), intentInfo (wWU8IIntentInfo), wUmbDreadDoes
   (wWU8IDreadDoes: the stage's legend), wUmbHexCut (wWU8IHexCut: a shard's hex), W_ON_END.nadir (wWU8IOnNadir: a shard
   spent, legends woken), wStart (wWU8IStart: legends woken on a save past their stage), wUmbFinale (wWU8IFinale: the
   shard's question before a round), wUmbGfCard, wUmbBkCard, wUmbBlCard (wWU8IGfCard, wWU8IBkCard, wWU8IBlCard: the
   legend on the card), wUmbJournal (wWU8IJournal), wMapDraw (wWU8IMapDraw: the lairs on the dark world's map), wAudit
   (wWU8IAudit: every lair placed and reachable), renderHelp (wWU8IRenderHelp: #wHelpUmbLegends). */

const W_UMB8I = {
  legends: {
    kraken: { stage: 1, region: 'tide', near: 'saltmere', id: 'u_kraken', kind: 'kraken', n: 'The Corrupted Kraken', where: 'in the Drownfen', ring: [5, 13], water: 1,
      wake: 'In the Drownfen the black water heaves, and something with too many arms comes up to look at the cracked moon.',
      p1: 'It drowns your hand: at the start of your turn cards in your hand go under, and a Slimed comes up for each.',
      p2: 'Under half HP, the Maelstrom: it hits harder and drowns three at a time.',
      look: 'The Corrupted Kraken, half out of the black water. Its arms taste the air. It wants a game.' },
    phoenix: { stage: 2, region: 'ember', near: 'cinderhold', id: 'u_phoenix', kind: 'phoenix', n: 'The Corrupted Phoenix', where: 'in the Ashmaw', ring: [5, 13],
      wake: 'Over the Ashmaw a fire lights that gives no warmth. A bird of black flame settles on the cinders, and waits.',
      p1: 'It sets you alight: Burn, every turn it can.',
      p2: 'Under half HP, Wildfire: more Burn, and harder. And once, when it would go down, it rises again with two fifths of its HP.',
      look: 'The Corrupted Phoenix, burning black. The cinders under it are cold. It wants a game.' },
    wyrm: { stage: 3, region: null, near: 'coliseum', id: 'u_wyrm', kind: 'frostwyrm', n: 'The Corrupted Frost Wyrm', where: 'on the road to the Hollow Coliseum', ring: [3, 8],
      wake: 'Something huge and white lands on the road to the Hollow Coliseum, and the frost runs out from it a mile each way.',
      p1: 'Weak and Exposed, and a Blizzard: at the start of each of your turns a card in your hand freezes, and you can\'t play it that turn.',
      p2: 'Under half HP, Whiteout: it hits harder, and two cards freeze each turn.',
      look: 'The Corrupted Frost Wyrm, coiled across the cold ground by the Coliseum road. Its breath hangs in the air. It wants a game.' },
  },
  // (more Strength at kickoff: a legend plays alone, against a team)
  str: { kraken: 11, phoenix: 9, wyrm: 10 },
  gold: 120, block: 15, rise: .4, drown: [2, 3], freeze: [1, 2],
  // the three lineups that field one: the row it takes, its player, and how many levels under the rest it plays (down)
  lineups: {
    gridiron: { at: 2, p: { n: 'The Corrupted Behemoth', kind: 'behemoth', num: 99 }, where: 'on their line', down: 1 },
    court: { at: 4, p: { n: 'The Corrupted Hydra', kind: 'hydra', num: 50 }, where: 'in their five' },
    lanes: { at: 2, p: { n: 'The Corrupted Djinn', kind: 'djinn' }, where: 'in their five', down: 1 },
  },
};
ST.u_deep = { n: 'Undertow', col: '#5fffd2', desc: 'Its moves drown cards from your hand at the start of your next turn, and a Slimed comes up for each.' };
ST.u_rebirth = { n: 'Rebirth', col: '#ff4a6a', desc: 'Once, when it would go down, it rises again with two fifths of its HP.' };
ST.u_blizzard = { n: 'Blizzard', col: '#9fffe8', desc: 'At the start of each of your turns a card in your hand freezes: it can\'t be played that turn.' };

/* ---------- the three bosses ---------- */
const W_UMB8I_TEAM = { name: 'The Nadir', short: 'NDR', color: '#2a1e34', light: '#e4defa' };
EN('u_kraken', 'The Corrupted Kraken', 'kraken', [180, 190], {
  grip: { n: 'Tentacle Grip', ops: [['a', 7, 2]] },
  pull: { n: 'The Deep Pulls', ops: [['a', 9], ['udrown', W_UMB8I.drown[0]]] },
  ink: { n: 'Ink Cloud', ops: [['b', 14], ['p', 'weak', 1]] },
  whirl: { n: 'Maelstrom', ops: [['a', 5, 3], ['udrown', W_UMB8I.drown[1]]] },
  crush: { n: 'Crushing Deep', ops: [['a', 18]] },
}, { seq: ['grip', 'pull', 'ink'] }, { boss: 1, sport: 'soccer', team: W_UMB8I_TEAM, aura: 'wisps', flav: 'It slept under the Drownfen since before there was a league. The Dread woke it, and it came up hungry.' });
ENEMIES.u_kraken.brain = e => (e.phase ? ['whirl', 'crush', 'grip'][e.step % 3] : null);
ENEMIES.u_kraken.phases = [{ at: .5, n: 'The Maelstrom', sub: 'The water turns. It hits harder, and drowns three at a time.', fn: e => { addSt(e, 'str', 2); blockE(e, 12); } }];
EN('u_phoenix', 'The Corrupted Phoenix', 'phoenix', [158, 168], {
  dive: { n: 'Black Flame Dive', ops: [['a', 11], ['p', 'burn', 3]] },
  ash: { n: 'Ash Storm', ops: [['a', 4, 3], ['p', 'burn', 2]] },
  kindle: { n: 'Kindle', ops: [['b', 12], ['s', 'str', 2]] },
  inferno: { n: 'Inferno', ops: [['a', 8, 2], ['p', 'burn', 5]] },
  pyre: { n: 'Funeral Pyre', ops: [['b', 16], ['s', 'str', 2], ['p', 'burn', 2]] },
}, { seq: ['dive', 'ash', 'kindle'] }, { boss: 1, sport: 'basketball', team: W_UMB8I_TEAM, aura: 'embers', flav: 'A phoenix that died in the dark and came back wrong. It burns cold, and it does not stay down.' });
ENEMIES.u_phoenix.brain = e => (e.phase ? ['inferno', 'dive', 'pyre'][e.step % 3] : null);
ENEMIES.u_phoenix.phases = [{ at: .5, n: 'Wildfire', sub: 'The black flame spreads. More Burn, and harder.', fn: e => { addSt(e, 'str', 2); } }];
EN('u_wyrm', 'The Corrupted Frost Wyrm', 'frostwyrm', [192, 202], {
  breath: { n: 'Frost Breath', ops: [['a', 9], ['p', 'weak', 1], ['p', 'vuln', 1]] },
  tail: { n: 'Tail Sweep', ops: [['a', 6, 2]] },
  hoard: { n: 'Ice Hoard', ops: [['b', 16], ['s', 'str', 1]] },
  glacier: { n: 'Glacier', ops: [['a', 19]] },
  kill: { n: 'Killing Frost', ops: [['a', 7, 2], ['p', 'weak', 2], ['p', 'vuln', 2]] },
}, { seq: ['breath', 'tail', 'hoard'] }, { boss: 1, sport: 'golf', team: W_UMB8I_TEAM, aura: 'wisps', flav: 'It sleeps on the Deadspire for a hundred years at a time. The Dread woke it early, and it is in a foul temper.' });
ENEMIES.u_wyrm.brain = e => (e.phase ? ['kill', 'glacier', 'hoard'][e.step % 3] : null);
ENEMIES.u_wyrm.phases = [{ at: .5, n: 'Whiteout', sub: 'The snow comes in sideways. It hits harder, and two cards freeze each turn.', fn: e => { addSt(e, 'str', 2); blockE(e, 15); } }];
// (their signature marks, put on at kickoff: plain data on B, so a mid-match save keeps them)
onHook('fightStart', () => {
  if (!B || !B.enemies) return;
  for (const e of B.enemies) {
    if (e.id === 'u_kraken') e.st.u_deep = 1;
    if (e.id === 'u_phoenix') { e.uRise = 1; e.st.u_rebirth = 1; }
    if (e.id === 'u_wyrm') { e.uFrost = 1; e.st.u_blizzard = 1; }
    const k = Object.keys(W_UMB8I.legends).find(k => W_UMB8I.legends[k].id === e.id); if (k && W_UMB8I.str[k]) addSt(e, 'str', W_UMB8I.str[k]);
  }
});
// the Kraken's drowning: due at the start of your next turn (your hand is empty while it moves)
const wWU8IBossOp = bossOp;
bossOp = function (e, op) {
  if (op && op[0] === 'udrown') { B.uDrown = (B.uDrown || 0) + op[1]; fx({ k: 'say', e: e.uid, t: `Drowns ${op[1]}` }); log(`${e.n} drags at your bench: ${op[1]} cards will go under at the start of your turn.`, 'bad'); return; }
  return wWU8IBossOp.apply(this, arguments);
};
const wWU8IIntentInfo = intentInfo;
intentInfo = function (e) {
  const r = wWU8IIntentInfo.apply(this, arguments);
  if (r && r.kinds && (e.plan || (typeof planOps === 'function' ? planOps(e) : []) || []).some(o => o[0] === 'udrown') && !r.kinds.includes('debuff') && !e.disguised) r.kinds.push('debuff');
  return r;
};
function wUmbDrownNow() {
  const n = B.uDrown || 0; B.uDrown = 0; if (!n || !B.hand.length) return;
  const gone = [];
  for (let i = 0; i < n && B.hand.length; i++) {
    const can = B.hand.map((c, j) => [c, j]).filter(([c]) => c.id !== 'slimed'); if (!can.length) break;
    const [c, j] = pick(can); B.hand.splice(j, 1); B.discard.push(c); gone.push(def(c).n);
    B.hand.push(mkCard('slimed'));
  }
  if (!gone.length) return;
  fx({ k: 'num', p: 1, t: `Drowned: ${gone.length}`, col: '#5fffd2' });
  log(`Undertow: ${gone.join(', ')} ${gone.length === 1 ? 'goes' : 'go'} under, and ${gone.length === 1 ? 'a Slimed comes' : gone.length + ' Slimed come'} up.`, 'bad');
}
// the Blizzard: a card of the hand you drew can't be played this turn (two under half HP)
function wUmbBlizzard() {
  const w = B.enemies.find(e => e.uFrost && !e.dead && !e.fled); if (!w) return;
  const n = W_UMB8I.freeze[w.phase ? 1 : 0], can = B.hand.filter(c => def(c).cost >= 0 && c.id !== 'slimed'), got = [];
  for (let i = 0; i < n && can.length; i++) got.push(can.splice(Math.floor(R() * can.length), 1)[0]);
  if (!got.length) return;
  B.uFrost = got.map(c => c.uid);
  fx({ k: 'say', e: w.uid, t: 'Blizzard' });
  log(`Blizzard: ${got.map(c => def(c).n).join(' and ')} ${got.length === 1 ? 'freezes' : 'freeze'} in your hand. Not this turn.`, 'bad');
}
const wWU8IPlayerTurnStart = playerTurnStart;
playerTurnStart = function () {
  if (B && B.uFrost) B.uFrost = null;
  const r = wWU8IPlayerTurnStart.apply(this, arguments);
  if (B && !B.over && B.phase === 'player') { wUmbDrownNow(); wUmbBlizzard(); }
  return r;
};
const wWU8ICanPlay = canPlay;
canPlay = function (card) { if (card && B && B.uFrost && B.uFrost.includes(card.uid)) return false; return wWU8ICanPlay.apply(this, arguments); };
const wWU8ICardHTML = cardHTML;
cardHTML = function (card, o) {
  const h = wWU8ICardHTML.apply(this, arguments);
  if (!(o && o.live && card && B && B.uFrost && B.uFrost.includes(card.uid))) return h;
  return h.replace('<div class="card ', '<div class="card ufrozen ').replace(/(<div class="art"[^>]*>)/, '$1<span class="ufrost" title="Blizzard: it can\'t be played this turn">Frozen</span>');
};
(() => { if (typeof document === 'undefined') return; const st = document.createElement('style'); st.textContent = `.card.ufrozen .art{box-shadow:inset 0 0 0 2px #9fffe8;filter:saturate(.35) brightness(1.15)}.card .ufrost{position:absolute;left:calc(var(--cw)*.03);top:calc(var(--cw)*.4);font-family:var(--hud);font-size:calc(var(--cw)*.075);line-height:1;color:#0e2a30;background:#9fffe8;padding:2px 4px 0;border-radius:3px;z-index:2}`; document.head.appendChild(st); })();
// the Phoenix rises, once
const wWU8IKillEnemy = killEnemy;
killEnemy = function (e) {
  if (e && !e.dead && e.uRise) {
    e.uRise = 0; delete e.st.u_rebirth;
    e.hp = Math.max(1, Math.round(e.max * W_UMB8I.rise));
    for (const k of ['weak', 'vuln', 'psn', 'burn', 'stun']) delete e.st[k];
    fx({ k: 'phase', e: e.uid, t: 'Rises from the Ash', sub: 'It will not stay down. Not the first time.' });
    log(`${e.n} goes down, and the black flame takes it, and it rises again with ${e.hp} HP.`, 'foe');
    if (ENEMIES[e.id].phases) bossPhaseCheck(e);
    return;
  }
  return wWU8IKillEnemy.apply(this, arguments);
};

/* ---------- where they stand ---------- */
const wUmbLegends = () => { const U = wUmb(); if (!U) return {}; if (!U.legends || typeof U.legends !== 'object') U.legends = {}; return U.legends; };
function wUmbLegendAwake(k) {
  const U = wUmb(), L = W_UMB8I.legends[k];
  return !!(U && L && !U.sealed && wUmbDread() >= L.stage && (U.legends || {})[k] !== 'beaten');
}
// the legend awake on that tile of the dark world, or null
function wUmbLegendAt(x, y) {
  const m = MAPS['u:world']; if (!m || !m.legends || !WG || WG.map !== 'u:world') return null;
  for (const k in m.legends) { const p = m.legends[k]; if (p[0] === x && p[1] === y && wUmbLegendAwake(k)) return k; }
  return null;
}
const wUmbLairAt = (m, x, y) => !!(m && m.legends && Object.values(m.legends).some(p => p[0] === x && p[1] === y));
// a woken legend is marked awake (for the journal; an old save past its stage too)
function wUmbLegendsSync() {
  const U = wUmb(); if (!U) return;
  const S = wUmbLegends();
  for (const k in W_UMB8I.legends) if (!S[k] && wUmbLegendAwake(k)) S[k] = 'awake';
}
function wUmbPlaceLegends() {
  const m = MAPS['u:world']; if (!m) return;
  m.legends = {};
  const den = DB.locs.find(l => l.id === 'umbralden'); if (!den) return;
  const reach = () => bfsReach(m, den.x, den.y + 1), count = s => { let n = 0; for (let i = 0; i < s.length; i++) n += s[i]; return n; };
  const lan = Object.keys(m.meta).filter(k => m.meta[k].lantern).map(k => k.split(',').map(Number));
  const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // (every lair placed so far stands blocked while the next is tested, so no two together close a pass: all may be
  // awake at once)
  const held = [];
  try {
  for (const k in W_UMB8I.legends) {
    const L = W_UMB8I.legends[k], P = DB.locs.find(l => l.id === L.near); if (!P) continue;
    const base = reach(), n0 = count(base), cand = [];
    for (let r = L.ring[0]; r <= L.ring[1]; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = P.x + dx, y = P.y + dy, c = m.t[y] && m.t[y][x], td = c && DB.tiles[c];
      if (!td || !td.walk || !td.ground || td.enter || c === '=' || c === 'b' || m.meta[x + ',' + y] || !base[y * m.w + x]) continue;
      if (L.region && regionAt(x, y) !== L.region) continue;
      if (wUmbHazardAt(m, x, y) || wUmbLairAt(m, x, y) || (m.npcs || []).some(n => n.x === x && n.y === y)) continue;
      if (DB.locs.some(o => Math.abs(o.x - x) + Math.abs(o.y - y) <= 2)) continue;
      if (lan.some(([lx, ly]) => Math.hypot(lx - x, ly - y) <= W_UMB8C.lanternR + 1)) continue;
      // (the Kraken by the black water, if it can; the Wyrm beside the road, where you will pass it)
      const by = ch => sides.some(([ax, ay]) => ch.includes(m.t[y + ay] && m.t[y + ay][x + ax]));
      cand.push([x, y, (L.water && by(['~', 's']) ? 0 : 2) + (L.near === 'coliseum' && by(['=']) ? -1 : 0) + r * .01]);
    }
    cand.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of cand) {
      const c = m.t[y][x]; m.t[y][x] = W_UMB2.ch;
      const s = reach(), side = sides.some(([ax, ay]) => s[(y + ay) * m.w + x + ax]);
      m.t[y][x] = c;
      if (count(s) === n0 - 1 && side) { m.legends[k] = [x, y]; held.push([x, y, c]); m.t[y][x] = W_UMB2.ch; break; }
    }
  }
  } finally { for (const [x, y, c] of held) m.t[y][x] = c; }
}
// the dark world's reach from the portal road with every lair standing (as if all were awake)
function wUmbReachLairs(m, den) {
  const held = Object.values(m.legends || {}).map(([x, y]) => [x, y, m.t[y][x]]);
  for (const [x, y] of held) m.t[y][x] = W_UMB2.ch;
  try { return bfsReach(m, den.x, den.y + 1); } finally { for (const [x, y, c] of held) m.t[y][x] = c; }
}
const wWU8IBuildAllMaps = buildAllMaps;
buildAllMaps = function () { const r = wWU8IBuildAllMaps.apply(this, arguments); wUmbPlaceLegends(); return r; };
const wWU8IFreeAt = wUmbFreeAt;
wUmbFreeAt = function (m, x, y) { return !wUmbLairAt(m, x, y) && wWU8IFreeAt.apply(this, arguments); };
const wWU8INpcAt = wNpcAt;
wNpcAt = function (x, y) {
  const n = wWU8INpcAt.apply(this, arguments); if (n) return n;
  const k = wUmbLegendAt(x, y);
  return k ? { id: 'ulegend:' + k, x, y, fixed: true } : n;
};
const wWU8ITalkTo = wTalkTo;
wTalkTo = function (id) {
  if (typeof id === 'string' && id.startsWith('ulegend:')) { WUI.held = null; WUI.goto = null; const why = wUmbLegendMatch(id.slice(8)); if (why) wLog(why, 'd'); return; }
  return wWU8ITalkTo.apply(this, arguments);
};
const wWU8ITryMove = wTryMove;
wTryMove = function (dx, dy) {
  if (WG && WG.map === 'u:world') {
    const k = wUmbLegendAt(WG.x + dx, WG.y + dy);
    if (k) { WG.face = dx < 0 ? 'l' : dx > 0 ? 'r' : dy < 0 ? 'u' : 'd'; wTalkTo('ulegend:' + k); return false; }
  }
  return wWU8ITryMove.apply(this, arguments);
};
const wWU8ILookText = wLookText;
wLookText = function (x, y) { const k = wUmbLegendAt(x, y); return k ? W_UMB8I.legends[k].look : wWU8ILookText.apply(this, arguments); };

/* ---------- the match ---------- */
function wUmbLegendMatch(k) {
  const L = W_UMB8I.legends[k], U = wUmb(); if (!L || !U) return 'Nothing here wants a game.';
  if ((U.legends || {})[k] === 'beaten') return `${L.n} is gone. You beat it.`;
  if (!wUmbLegendAwake(k)) return 'Nothing here. Not yet.';
  wUmbLegendsSync();
  startMatch({ type: 'boss', ids: [L.id], tier: 3, lv: W_ROAD.maxLv, ambush: false, trait: false,
    world: { kind: 'ulegend', ref: { k }, region: L.region || 'plains', umbral: 1 } });
  return '';
}
W_ON_END.ulegend = function (r, ref) {
  const U = wUmb(), L = ref && W_UMB8I.legends[ref.k]; if (!U || !L) return;
  if (r === 'win') {
    const S = wUmbLegends(), first = S[ref.k] !== 'beaten';
    S[ref.k] = 'beaten';
    if (first) {
      U.shards = (U.shards || 0) + 1; RUN.gold += W_UMB8I.gold;
      wLog(`${L.n} comes apart into the dark, and leaves something behind: a Legend's Shard, cold and bright (${U.shards} held). ${W_UMB8I.gold} gold. Spend it on a round of the Seal.`, 'g');
      wGainCard({ pick: 3, rarity: 'r' }, L.n);
    }
  } else wLog(`${L.n} goes back to where it waits, whole again. It will be there.`, 'b');
  wInvalidate('u:world'); wSave();
};
// its match card: the two phases and the prize
const wWU8IPreGame = wPreGame;
wPreGame = function (enc) {
  const r = wWU8IPreGame.apply(this, arguments), W = enc && enc.world, L = W && W.kind === 'ulegend' && W.ref && W_UMB8I.legends[W.ref.k], txt = document.querySelector('#modalBox .wpgtxt');
  if (!L || !txt) return r;
  // (w10 names a boss as Sudden Death's: this one is the Umbral's own)
  const D = ENEMIES[L.id], boss = [...txt.querySelectorAll('p.wroom')].find(p => /Sudden Death boss/.test(p.textContent)), at = boss || txt.querySelector('.wpgwho');
  const h = `<p class="wroom wlegend">A corrupted legend: <b>${esc(L.n)}</b>. ${esc(D.flav || '')}</p><p class="hint wumbpg"><b>The fight.</b> ${esc(L.p1)} ${esc(L.p2)}</p>
    <p class="hint wumbpg"><b>The prize:</b> a Legend's Shard (spend it on a round of the Seal: one hex fewer, or ${W_UMB8I.block} Block in a card round), a rare card and ${W_UMB8I.gold} gold.</p>`;
  if (at) at.insertAdjacentHTML('afterend', h); else txt.insertAdjacentHTML('afterbegin', h);
  if (boss) boss.remove();
  return r;
};
// a legend is a boss to the card game, but it pays a shard, not a trophy
const wWU8ICombatRewards = combatRewards;
combatRewards = function () {
  const out = wWU8ICombatRewards.apply(this, arguments), W = RUN && RUN.pending && RUN.pending.world;
  if (W && W.kind === 'ulegend' && out) { out.relic = null; out.boss = null; }
  return out;
};

/* ---------- the scenes: each stage wakes its legend ---------- */
for (const k in W_UMB8I.legends) { const L = W_UMB8I.legends[k], S = W_UMB8C.scenes[L.stage]; if (S && !S.lines.includes(L.wake)) S.lines.push(L.wake); }
const wWU8IDreadDoes = wUmbDreadDoes;
wUmbDreadDoes = function (s) {
  const t = wWU8IDreadDoes.apply(this, arguments), k = Object.keys(W_UMB8I.legends).find(k => W_UMB8I.legends[k].stage === s);
  return k ? `${t} ${W_UMB8I.legends[k].n} is awake ${W_UMB8I.legends[k].where}: a hard fight, if you want one, for a Legend's Shard.` : t;
};
const wWU8IStart = wStart;
wStart = function () { const r = wWU8IStart.apply(this, arguments); wUmbLegendsSync(); return r; };

/* ---------- the shards, in the Seal ---------- */
// set a shard on a round of the Seal (the round being played, by default): how = 'hex' (one hex fewer) or 'block' (a
// card round: 15 Block at the start). '' when set, or why not. It is spent when that round ends.
function wUmbShardUse(how, round) {
  const U = wUmb(); if (!U) return 'Only on a journey with the Umbral open.';
  if (!((U.shards || 0) > 0)) return 'You hold no Legend\'s Shard.';
  const r = round != null ? round : (U.finale || 0);
  if (U.shardOn && U.shardOn.r === r) return 'A shard is already set on this round.';
  if (how !== 'hex' && how !== 'block') return 'A shard takes a hex off, or gives Block.';
  if (how === 'block' && W_UMB5.engine[wUmbFinaleSports()[r]]) return 'The Block is for a card round.';
  if (how === 'hex' && !wUmbShardRoom(r)) return `Round ${r + 1} draws no hexes now: a shard would take nothing off.`;
  U.shardOn = { r, how };
  if (!LAB) wLog(how === 'hex' ? `You set a Legend's Shard on round ${r + 1} of the Seal: one hex fewer.` : `You set a Legend's Shard on round ${r + 1} of the Seal: ${W_UMB8I.block} Block at the start.`, 'm');
  wSave(); return '';
}
// a round of the Seal (the one being played, by default) still draws a hex after every other cut (the clean or
// well-won piece's, in its entry's hexes; a Hex Ward's, in u8h's wUmbHexCut): only then can a shard take one off. A
// later round's entry is built for the moment with that round, then the current one is built again
function wUmbShardRoom(r) {
  const U = wUmb(); if (!U) return false;
  const cur = U.finale || 0; r = r == null ? cur : r;
  let n;
  if (r === cur) n = (wUmbFinaleEntry() || {}).hexes || 0;
  else { U.finale = r; try { n = (wUmbFinaleEntry() || {}).hexes || 0; } finally { U.finale = cur; wUmbFinaleEntry(); } }
  return n - (wWU8IHexCut('finale') || 0) > 0;
}
const wUmbShardSet = how => { const U = wUmb(); return !!(U && U.shardOn && U.shardOn.r === (U.finale || 0) && (U.shards || 0) > 0 && (!how || U.shardOn.how === how)); };
const wWU8IHexCut = wUmbHexCut;
wUmbHexCut = function (id) { return (wWU8IHexCut.apply(this, arguments) || 0) + (id === 'finale' && wUmbShardSet('hex') ? 1 : 0); };
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!B || !W || W.kind !== 'nadir' || !W.ref || W.ref.id !== 'finale' || !wUmbShardSet('block')) return;
  gainBlock(W_UMB8I.block, true);
  log(`The Legend's Shard: your team starts with ${W_UMB8I.block} Block.`, 'sys');
});
// spent when the round it was set on ends, won or lost; a round started without one leaves a shard set elsewhere alone
const wWU8IOnNadir = W_ON_END.nadir;
W_ON_END.nadir = function (r, ref) {
  // (spent first, so an error further down the chain can't leave it set for the next game; said after the game's lines)
  const U = wUmb(), spend = !!(U && ref && ref.id === 'finale' && wUmbShardSet());
  if (spend) { U.shards = Math.max(0, (U.shards || 0) - 1); U.shardOn = null; }
  try { return wWU8IOnNadir.apply(this, arguments); }
  finally { if (spend && !(RUN && RUN.over)) { if (!LAB) wLog(`The Legend's Shard goes dark in your captain's hand. It did its work (${U.shards} left).`, 'd'); wSave(); } wUmbLegendsSync(); }
};
// the round's game left half-played (its hexes, the shard's cut among them, were drawn at its kickoff)
const wUmbFinaleLive = () => { const U = wUmb(), e = U && W_UMB5.engine[wUmbFinaleSports()[U.finale || 0]]; return !!(e && W_UMB4.live[e] && W_UMB4.live[e]()); };
// before a round of the Seal starts: spend a shard on it?
const wWU8IFinale = wUmbFinale;
wUmbFinale = function () {
  const U = wUmb();
  // (a shard set for a hex on a round that has none left by the time it starts, a ward readied since, say: given back)
  if (U && !U.sealed && wUmbShardSet('hex') && !wUmbFinaleLive() && !wUmbShardRoom()) { U.shardOn = null; if (!LAB) wLog('This round draws no hexes now, so your Legend\'s Shard would take nothing off. You keep it.', 'm'); wSave(); }
  if (!U || LAB || U.sealed || !((U.shards || 0) > 0) || Object.keys(W_UMB_PIECES).some(p => !U.pieces.includes(p))) return wWU8IFinale.apply(this, arguments);
  const r = U.finale || 0, piece = wUmbFinaleSports()[r], eng = W_UMB5.engine[piece], card = !eng;
  // (a game of the round left half-played picks up where it was: its hexes were drawn at its kickoff)
  if (wUmbFinaleLive()) return wWU8IFinale.apply(this, arguments);
  const room = wUmbShardRoom();
  // (nothing a shard could do here: no hex left to take off, and no card round for the Block)
  if (!room && !card && !wUmbShardSet()) return wWU8IFinale.apply(this, arguments);
  if (wUmbShardSet()) { wLog(`Your Legend's Shard is set on this round: ${U.shardOn.how === 'hex' ? 'one hex fewer' : W_UMB8I.block + ' Block at the start'}.`, 'm'); return wWU8IFinale.apply(this, arguments); }
  const close = modal(`<header><h3>A Legend's Shard</h3><button class="ghost" data-close>Not now</button></header>
    <div class="wmsg"><p>You hold ${U.shards} Legend's Shard${U.shards === 1 ? '' : 's'}. Round ${r + 1} of the Seal is ${esc(W_UMB_PIECES[piece].sport)}. Spend one on it?</p>
    <p class="hint">It is spent when the round ends, won or lost. Back out of the round's card and it stays set on this round.</p>${room ? '' : '<p class="hint">This round draws no hexes now, so a shard can only give Block.</p>'}</div>
    <div class="row">${room ? '<button class="btn" data-ushard="hex">One hex fewer</button>' : ''}${card ? `<button class="${room ? 'ghost' : 'btn'}" data-ushard="block">${W_UMB8I.block} Block at the start</button>` : ''}<button class="ghost" data-ushard="">Keep it</button></div>`);
  $('modalBox').querySelectorAll('[data-ushard]').forEach(b => b.onclick = () => {
    const how = b.dataset.ushard; close();
    const no = how ? wUmbShardUse(how) : ''; if (no) wLog(no, 'b');
    const why = wWU8IFinale(); if (why) wLog(why, 'b');
    wDrain();
  });
  return '';
};

/* ---------- three lineups field one ---------- */
{
  const T = { gridiron: W_UMB4B.seven, court: W_UMB4D.five, lanes: W_UMB4G.five };
  for (const k in W_UMB8I.lineups) { const X = W_UMB8I.lineups[k], row = T[k][X.at]; if (row && !row.cap && !row.qb && !row.champ) T[k][X.at] = Object.assign({ legend: 1 }, X.p); }
}
// (a legend that swung its champion's game by more than about 5 points plays a level under the rest: docs/realm/BALANCE.md)
const W_UMB8I_DOWN = {}; for (const k in W_UMB8I.lineups) if (W_UMB8I.lineups[k].down) W_UMB8I_DOWN[W_UMB8I.lineups[k].p.n] = W_UMB8I.lineups[k].down;
const wWU8IMakePlayer = wMakePlayer;
wMakePlayer = function (o, src) { if (o && src === 'opp' && W_UMB8I_DOWN[o.n] && o.lvl > 1) o = Object.assign({}, o, { lvl: o.lvl - W_UMB8I_DOWN[o.n] }); return wWU8IMakePlayer.apply(this, [o].concat([].slice.call(arguments, 1))); };
const wUmbLineupNote = k => { const X = W_UMB8I.lineups[k]; return `<p class="hint wumbpg wlegend"><b>A corrupted legend:</b> ${esc(X.p.n)} plays ${esc(X.where)}, in shadow.</p>`; };
const wU8ICardNote = (f, k) => function () {
  const r = f.apply(this, arguments), box = $('modalBox'), m = box && box.querySelector('.wmsg');
  if (m && !m.querySelector('.wlegend')) { const p = m.querySelector('p'); if (p) p.insertAdjacentHTML('afterend', wUmbLineupNote(k)); }
  return r;
};
const wWU8IGfCard = wUmbGfCard, wWU8IBkCard = wUmbBkCard, wWU8IBlCard = wUmbBlCard;
wUmbGfCard = wU8ICardNote(wWU8IGfCard, 'gridiron'); wUmbBkCard = wU8ICardNote(wWU8IBkCard, 'court'); wUmbBlCard = wU8ICardNote(wWU8IBlCard, 'lanes');

/* ---------- drawing them on the dark world, and on its map ---------- */
W_ACTORS.push((acts, now, t) => {
  const m = WG && MAPS[WG.map]; if (!m || m.id !== 'u:world' || !m.legends || !wUmb()) return;
  for (const k in m.legends) {
    const [x, y] = m.legends[k]; if (!wUmbLegendAwake(k) || Math.abs(x - WG.x) > 24 || Math.abs(y - WG.y) > 16) continue;
    const L = W_UMB8I.legends[k], acc = W_UMB.accent[L.region || 'rime'] || '#c8b8ff';
    // (a cold ring on the ground under it, first in its row)
    acts.push({ x, y: y - .6, draw: (c, sx, sy) => {
      const cy = sy + 3 - WTILE / 2 + .6 * WTILE;
      c.save(); c.globalAlpha = .5 + Math.sin(t * 1.6 + x) * .15; c.strokeStyle = acc; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(sx, cy + 4, 17, 7, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = .22; c.fillStyle = acc; c.fill(); c.restore();
    } });
    acts.push({ x, y, who: { kind: L.kind, shade: 1, face: WG.x < x ? 'l' : 'r', walk: 0, seed: x * 3 + y }, size: 46 });
  }
});
const wWU8IMapDraw = wMapDraw;
wMapDraw = function (cv) {
  const r = wWU8IMapDraw.apply(this, arguments), m = MAPS['u:world'];
  if (!wUmbDark() || !m || !m.legends) return r;
  const c = cv.getContext('2d'), S = W_MAP.px;
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const k in m.legends) { const [x, y] = m.legends[k]; if (wUmbLegendAwake(k) && wFogSeen(x, y, 'u:world')) wMapLabel(c, '✶ ' + W_UMB8I.legends[k].n.replace('The Corrupted ', ''), x * S + S / 2, y * S + S / 2, 11, true, '#5a1a2a'); }
  c.restore();
  return r;
};

/* ---------- the journal, the audit, How to play ---------- */
const wWU8IJournal = wUmbJournal;
wUmbJournal = function () {
  const r = wWU8IJournal.apply(this, arguments), U = wUmb(); if (!U || U.sealed || !Array.isArray(r) || typeof r[1] !== 'string') return r;
  const S = U.legends || {}, ks = Object.keys(W_UMB8I.legends).filter(k => S[k]);
  if (!ks.length && !(U.shards > 0)) return r;
  const line = `<p class="hint">The legends: ${ks.length ? ks.map(k => `${esc(W_UMB8I.legends[k].n)} (${S[k] === 'beaten' ? 'beaten' : 'awake, ' + esc(W_UMB8I.legends[k].where)})`).join('; ') : 'none awake yet'}. Legend's Shards held: ${U.shards || 0}${wUmbShardSet() ? ' (one set on this round of the Seal)' : ''}.</p>`;
  return [r[0], r[1].replace(/<\/div>\s*$/, line + '</div>')];
};
const wWU8IAudit = wAudit;
wAudit = function () {
  const P = wWU8IAudit.apply(this, arguments), m = MAPS['u:world'], den = DB.locs.find(l => l.id === 'umbralden');
  if (!m || !den) return P;
  const s = wUmbReachLairs(m, den), sides = [[1, 0], [-1, 0], [0, 1], [0, -1]], near = (x, y) => !!s[y * m.w + x] || sides.some(([dx, dy]) => s[(y + dy) * m.w + x + dx]);
  for (const L of DB.locs) if (!near(L.x, L.y)) P.push('u:world: with every legend awake, cannot walk to ' + L.id);
  for (const q in m.meta) if (m.meta[q].lantern) { const [x, y] = q.split(',').map(Number); if (!near(x, y)) P.push('u:world: with every legend awake, cannot reach the lantern at ' + q); }
  for (const k in W_UMB8I.legends) {
    const p = m.legends && m.legends[k]; if (!p) { P.push('u:world: the legend ' + k + ' has no lair'); continue; }
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s[(p[1] + dy) * m.w + p[0] + dx])) P.push('u:world: cannot reach the legend ' + k);
    if (wUmbHazardAt(m, p[0], p[1])) P.push('u:world: the legend ' + k + ' stands on a hazard');
    if (!ENEMIES[W_UMB8I.legends[k].id]) P.push('the legend ' + k + ' has no match');
  }
  return P;
};
const wWU8IRenderHelp = renderHelp;
renderHelp = function () {
  const r = wWU8IRenderHelp.apply(this, arguments), u = $('wHelpUmbral');
  if (u && u.tagName === 'DIV' && !$('wHelpUmbLegends')) {
    const L = W_UMB8I.legends;
    u.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpUmbLegends"><b>The corrupted legends.</b> As the Dread rises, three legends wake on the dark world, one at each stage from the Stirring: ${Object.keys(L).map(k => `${esc(L[k].n)} ${esc(L[k].where)} (${esc(W_UMB8C.names[L[k].stage])})`).join(', ')}. Each is a hard card match against it alone, in two phases: the Kraken drowns cards from your hand, the Phoenix burns and rises once when it would go down, and the Frost Wyrm leaves you Weak and Exposed and freezes a card in your hand each turn. None has to be fought. Beat one for a <b>Legend's Shard</b>, a rare card and ${W_UMB8I.gold} gold. Before a round of the Seal, set a shard on it: one hex fewer, or in a card round ${W_UMB8I.block} Block at the start. Lose to a legend and you black out as on any loss on this side; it waits for you, whole again. Three champions also field a corrupted legend in their side: ${Object.values(W_UMB8I.lineups).map(X => esc(X.p.n)).join(', ')}.</p>`);
  }
  return r;
};
