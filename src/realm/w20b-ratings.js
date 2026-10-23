/* w20b: baseball ratings (issue #4, phase 2). Every Realm player has Brimstone Diamond ratings, p.bd, for the games on
   the diamond: a position and a hand, the five stats (POW, CON, SPD, ARM, FLD, 1 to 12), a batting, running and
   fielding power, the kind's ultimate, and pitches for pitchers. They are seeded from the kind's player on Brimstone
   Diamond's two founding clubs, each stat moved by up to 1, and every level above 1 adds a point to one stat, picked
   with the kind's strengths as weights. So a recruit who joins at level 5 has had 4 points, and an older save's
   players get theirs when it loads.

   p.bd  { pos, hand, wpn, bat, run, field, ult, pitches, pow, con, spd, arm, fld, lv, got: { stat: points from levels } }
         lv is the level the ratings have caught up to.
   wBdOf(p)  p's ratings, made or caught up first
   Wrapped: wMakePlayer (every recruit), wGiveXp (level-ups), wStart (founders and older saves), wStatsCard (a Baseball
   block on each player's stats), renderHelp (a paragraph after #wHelpStats). */

const W_BDR = {
  cap: 12,
  stat: { pow: ['POW', 'Power: how far the ball goes'], con: ['CON', 'Contact: how often the bat finds the ball'],
    spd: ['SPD', 'Speed: on the bases and in the field'], arm: ['ARM', 'Arm: throws, and pitch speed'], fld: ['FLD', 'Fielding: clean catches and quick reactions'] },
  pos: { P: 'pitcher', C: 'catcher', '1B': 'first base', '2B': 'second base', '3B': 'third base', SS: 'shortstop', LF: 'left field', CF: 'centre field', RF: 'right field' }
};
let W_BDNAMES = null;
function wBdNames() { return W_BDNAMES || (W_BDNAMES = wBD.names()); }

function wBdOf(p) {
  if (!p || !p.kind) return null;
  if (!p.bd) p.bd = Object.assign(wBD.rate(p.kind), { lv: 1, got: {} });
  const b = p.bd, lvl = p.lvl || 1;
  while (b.lv < lvl) { b.lv++; const s = wBdGrowStat(p); if (s) { b[s]++; b.got[s] = (b.got[s] || 0) + 1; } }
  return b;
}
/* a level's point: any stat below the cap, weighted by the kind's own numbers, so a goblin gets quicker, an ogre stronger */
function wBdGrowStat(p) {
  const T = wBD.templ(p.kind) || {}, open = wBD.stats.filter(s => p.bd[s] < W_BDR.cap);
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + (T[s] || 1), 0);
  for (const s of open) { r -= T[s] || 1; if (r < 0) return s; }
  return open[open.length - 1];
}
function wBdAll() {
  if (!WG) return;
  for (const p of WG.roster || []) wBdOf(p);
  for (const p of WG.wwait || []) wBdOf(p);
}

const wW20MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW20MakePlayer(spec, from); wBdOf(p); return p; };
const wW20GiveXp = wGiveXp;
wGiveXp = function (p, n) { const r = wW20GiveXp(p, n); wBdOf(p); return r; };
const wW20Start = wStart;
wStart = function (save, opts) { const r = wW20Start(save, opts); wBdAll(); if (save) wSave(); return r; };

/* ---------- the Baseball block on a player's stats ---------- */
function wBdCard(p) {
  const b = wBdOf(p), N = wBdNames(); if (!b) return '';
  const pitcher = b.pos === 'P';
  const bars = wBD.stats.map(s => { const [ab, what] = W_BDR.stat[s], got = b.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * b[s] / W_BDR.cap)}%"></em></i><b>${b[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const pw = [['bat', 'Batting'], ['run', 'Running'], ['field', 'Fielding']].filter(([k]) => b[k] && N.ab[b[k]])
    .map(([k, w]) => `<li><b>${esc(N.ab[b[k]].n)}</b> <small>${w}</small><span>${esc(N.ab[b[k]].desc)}</span></li>`);
  if (b.ult && N.ult[b.ult]) pw.push(`<li><b>&#9733; ${esc(N.ult[b.ult].n)}</b> <small>Ultimate</small><span>${esc(N.ult[b.ult].desc)}</span></li>`);
  const pitches = pitcher && b.pitches ? `<p class="wbdpit">Pitches: ${b.pitches.filter(k => N.pitch[k]).map(k => N.pitch[k].magic ? `<b title="${esc(N.pitch[k].desc)}">${esc(N.pitch[k].n)}</b>` : esc(N.pitch[k].n)).join(', ')}</p>` : '';
  const hand = pitcher ? `throws ${b.hand === 'L' ? 'left' : 'right'}` : `bats ${b.hand === 'L' ? 'left' : 'right'}`;
  return `<div class="wbd"><h5>Baseball</h5><p class="wbdpos">Plays ${W_BDR.pos[b.pos] || b.pos}, ${hand}.</p>
    <div class="wbdbars">${bars}</div>${pitches}${pw.length ? `<ul class="wbdpw">${pw.join('')}</ul>` : ''}
    <p class="hint">Each level adds a point to one stat (shown as +). Ratings run from 1 to ${W_BDR.cap}.</p></div>`;
}
const wW20StatsCard = wStatsCard;
wStatsCard = function (p) { return wW20StatsCard(p).replace(/<\/section>\s*$/, wBdCard(p) + '</section>'); };

const wW20RenderHelp = renderHelp;
renderHelp = function () {
  wW20RenderHelp();
  const st = $('wHelpStats'); if (!st || $('wHelpBaseball')) return;
  st.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpBaseball"><b>Baseball ratings.</b> Every player also has ratings for baseball: a position, power, contact, speed, arm and fielding (1 to ${W_BDR.cap}), and the powers their kind brings to the diamond. Each level adds a point, mostly to what their kind is good at. Pick a player on the Stats tab to see them.</p>`);
};
