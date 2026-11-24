/* w141: baseball's picks, situation powers and the crowd (issue #115, phase 2), by the shape of the later sports
   (w126 is the Shed's); the engine's side is src/bd/parts/52-powers.js.
   The picks: a kind's abilities stay as they are (no new ones), but each player brings one of a pair a role. In
   batting, running and fielding the pair is the kind's own magic (mana) or the physical skill it would have without
   it (stamina; Brimstone Diamond picks which by their ratings); a kind without that magic keeps its physical skill, and
   a passive one (Stone Skin) has nothing to pick. A pitcher with a pair of magic pitches (W_BD_PAIRS: the Fireball or
   the Meteor, the Hex Knuckler or the Phantom) brings one of them. Picked on the Nine tab, kept on the player
   (p.bdPw { bat, run, field, pitch }, 0 the first, 1 the second); call-ups pick too. The other nine's players pick by
   name (wBdPickByName: the same each time), and the play-by-play names each side's picks at the first pitch.
   Situation powers (Bases Loaded, Last Licks, Extra Innings, Full Count) and the crowd that lifts a cast are on in every
   ball game the Realm plays (Play, Manage, Simulate, the Diamond Cup, the Umbral, exhibitions); in LAB mode they are off
   unless the lab sets W_BDPOW.lab (the rules it plays), so the other balance numbers stand. Your Powers row above the
   field (under the Bag) shows mana and the crowd, the situation powers whose moment it is, and Crowd, to lift your next
   cast; with Auto powers on your coach casts and spends as a Knight would.
   Wraps: wNineBdPlayer (wW141NineBdPlayer: your pick goes with the player), wNineRow (wW141NineRow: the picks on the
   Nine tab), wRenderCamp (wW141RenderCamp: their changes), wBdCard (wW141BdCard: the picks on the stats card),
   renderHelp (wW141RenderHelp: #wHelpBallPow); and wBD.start, wBD.sim (the powers and the picks go in). */

const W_BDPOW = { on: true, lab: null };
const W_BD_PAIRS = [['fireball', 'meteor'], ['hex', 'phantom']];
const W_BD_ROLES = { bat: 'Batting', run: 'Running', field: 'Fielding', pitch: 'Pitching' };

/* ---------- the pairs ---------- */
// the pair engine player g picks between in a role: [first, second] (ability or pitch ids), or null when there is none
function wBdPair(g, role) {
  if (!g || !W_BD_ROLES[role]) return null;
  if (role === 'pitch') { const P = g.pitches || [], pr = W_BD_PAIRS.find(([a, b]) => P.includes(a) && P.includes(b)); return pr ? pr.slice() : null; }
  const id = g[role], A = id && wBdNames().ab[id]; if (!A || A.passive) return null;
  const ph = wBD.physOf(Object.assign({}, g, { [role]: null }), role);
  return ph ? [id, ph] : null;
}
// the other nine's: the same each time, from the name
function wBdPickByName(n) {
  let h = 7; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { bat: h & 1, run: (h >> 1) & 1, field: (h >> 2) & 1, pitch: (h >> 3) & 1 };
}
// g as it takes the field with its picks: the role's magic left off for the physical skill, one pitch of a pair (on g
// itself, so a nine handed to the engine keeps its players)
function wBdPickApply(g, pw) {
  const out = g, took = [], pairs = Object.fromEntries(Object.keys(W_BD_ROLES).map(r => [r, wBdPair(g, r)]));
  for (const role of Object.keys(W_BD_ROLES)) {
    const pr = pairs[role]; if (!pr) continue;
    const k = pw && pw[role] === 1 ? 1 : 0;
    if (role === 'pitch') out.pitches = g.pitches.filter(x => x !== pr[1 - k]); else if (k) out[role] = null;
    took.push(pr[k]);
  }
  out.bdPick = took;
  return out;
}
// a nine with its picks: yours (the nine's id is 'realm') as you set them, any other by name
function wBdPickDef(def) {
  if (!def || !Array.isArray(def.roster) || def.bdPicked) return def;
  const mine = def.id === 'realm';
  for (const g of def.roster.concat(def.pen || [])) wBdPickApply(g, mine ? g.bdPw : wBdPickByName(g.n));
  def.bdPicked = true;
  return def;
}
const wBdPickName = id => { const N = wBdNames(); return (N.ab[id] || N.pitch[id] || { n: id }).n; };
const wBdPickCost = id => { const N = wBdNames(), A = N.ab[id]; return A && A.stam ? `${A.stam} stamina` : `${(A || N.pitch[id] || {}).cost || 0} mana`; };
function wBdSetPw(id, role, v) {
  const p = wNineWho(id); if (!p || !W_BD_ROLES[role]) return '';
  p.bdPw = Object.assign({ bat: 0, run: 0, field: 0, pitch: 0 }, p.bdPw, { [role]: v === 1 ? 1 : 0 });
  wSave(); return '';
}
const wW141NineBdPlayer = wNineBdPlayer;
wNineBdPlayer = function (p) { const g = wW141NineBdPlayer.apply(this, arguments); if (p && p.bdPw) g.bdPw = Object.assign({}, p.bdPw); return g; };

/* ---------- the powers and the picks go in ---------- */
function wBdPowRules() {
  if (!W_BDPOW.on) return null;
  if (LAB) return W_BDPOW.lab ? JSON.parse(JSON.stringify(W_BDPOW.lab)) : null;
  return { on: [true, true], sit: true, crowd: true, picks: true };
}
// (a game whose rules already say, as a lab's may, plays them; the picks go in whenever the powers do)
function wBdPowNext(o) {
  if (!o) return o;
  const own = o.rules && o.rules.bdpow !== undefined, P = own ? o.rules.bdpow : wBdPowRules(); if (!P) return o;
  const r = own ? Object.assign({}, o) : Object.assign({}, o, { rules: Object.assign({}, o.rules || {}, { bdpow: P }) });
  if (P.picks !== false && Array.isArray(o.defs)) r.defs = o.defs.map(wBdPickDef);
  return r;
}
// each side's picks, in the play-by-play before the first pitch
function wBdPickSay() {
  const G = wBD.G; if (!G || !G.teams || !G.bdp) return;
  for (const t of G.teams) {
    const ps = t.def.roster.concat(t.pen || []).filter(g => g.bdPick && g.bdPick.length);
    if (ps.length) wBD.say(`${t.def.short || t.def.name} bring: ${ps.map(g => `${g.n.split(' ').slice(-1)[0]} ${g.bdPick.map(wBdPickName).join(', ')}`).join('; ')}.`);
  }
}
const wW141Start = wBD.start, wW141Sim = wBD.sim;
wBD.start = o => { const r = wW141Start(wBdPowNext(o)); wBdPickSay(); return r; };
wBD.sim = o => wW141Sim(wBdPowNext(o));

/* ---------- your Powers row, above the field ---------- */
$('wBallBagRow').insertAdjacentHTML('afterend', '<div id="wBallPowRow" class="wdbar wdbag" hidden><b>Powers</b><span id="wBallPow"></span></div>');
let W_BALL_POWKEY = '', W_BALL_POWMSG = '';
function wBallPowRows(force) {
  const row = $('wBallPowRow'), L = WD && WD.ball && wBallLive() && WG.ball.live, B = wBD.bdp;
  const show = UI.view === 'diamond' && !!L && L.world.how !== 'sim' && wBD.live && !!B;
  if (row.hidden !== !show) row.hidden = !show;
  if (!show) { W_BALL_POWKEY = ''; return; }
  const G = wBD.G, you = L.world.home ? 1 : 0, C = wBD.crowdRules, S = wBD.sit, auto = L.world.how === 'manage';
  const sits = B.sitOn && B.on[you] ? Object.keys(S).filter(k => wBD.sitFit(you, k)) : [];
  const why = Object.fromEntries(sits.map(k => [k, wBD.sitWhy(you, k)]));
  const key = JSON.stringify([G.teams[you].mana, B.crowd[you], B.arm[you], why, auto, W_BALL_POWMSG]);
  if (!force && key === W_BALL_POWKEY) return;
  W_BALL_POWKEY = key;
  const crowd = B.crowd[you], up = crowd >= C.cost;
  $('wBallPow').innerHTML = `<small class="hint" title="Mana pays for every power. The crowd: your stands fill it on runs, home runs, strikeouts, double plays and stolen bases.">Mana <b>${G.teams[you].mana}</b>/6 · Crowd <b>${crowd}</b>/${C.max}</small> `
    + (B.crowdOn && B.on[you] ? `<button class="ghost${B.arm[you] ? ' on' : ''}" data-bdarm aria-pressed="${!!B.arm[you]}" ${up || B.arm[you] ? '' : 'disabled'} title="${esc(`${C.cost} crowd: your next ability with a strength works half again as strongly, or your next ultimate's zone lasts an at-bat more. Mana pays as usual.`)}">${B.arm[you] ? 'Crowd: on your next cast' : `Crowd (${C.cost})`}</button>` : '')
    + sits.map(k => ` <button class="ghost" data-bdsit="${k}" ${why[k] ? 'disabled' : ''} title="${esc(why[k] ? `${S[k].desc} (${why[k]})` : S[k].desc)}">${esc(S[k].n)} (${S[k].cost})</button>`).join('')
    + (auto ? ' <small class="hint">Auto powers: your coach calls the situation powers and the crowd too.</small>' : '')
    + (W_BALL_POWMSG ? ` <small class="wbad">${esc(W_BALL_POWMSG)}</small>` : '');
}
$('wBallPowRow').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const B = wBD.bdp, L = WG && WG.ball && WG.ball.live, you = L && L.world.home ? 1 : 0;
  if (b.dataset.bdsit) { W_BALL_POWMSG = wBD.castSit(b.dataset.bdsit); if (!W_BALL_POWMSG) wBD.snapNow(); }
  else if (b.dataset.bdarm != null && B) W_BALL_POWMSG = wBD.arm(!B.arm[you]);
  b.blur(); wBallPowRows(true);
});
setInterval(() => wBallPowRows(), 250);

/* ---------- the Nine tab and the stats card ---------- */
const wW141NineRow = wNineRow;
wNineRow = function (r) {
  const html = wW141NineRow.apply(this, arguments), p = wNineWho(r.id); if (!p) return html;
  const g = wNineBdPlayer(p, r.pos), cur = p.bdPw || {};
  const sel = Object.keys(W_BD_ROLES).map(role => {
    const pr = wBdPair(g, role); if (!pr) return '';
    const k = cur[role] === 1 ? 1 : 0, N = wBdNames(), d = id => (N.ab[id] || N.pitch[id] || {}).desc || '';
    return `<label class="wsvl" title="${esc(pr.map(id => `${wBdPickName(id)} (${wBdPickCost(id)}): ${d(id)}`).join(' / '))}">${W_BD_ROLES[role]} <select data-bdpw="${role}" aria-label="${esc(p.n)}'s ${role === 'pitch' ? 'magic pitch' : W_BD_ROLES[role].toLowerCase() + ' power'}">${pr.map((id, j) => `<option value="${j}"${j === k ? ' selected' : ''}>${esc(wBdPickName(id))} (${esc(wBdPickCost(id))})</option>`).join('')}</select></label>`;
  }).join('');
  return sel ? html.replace(/(<\/div>\s*<div class="wpa">)/, `<div class="wbdpick">${sel}</div>$1`) : html;
};
const wW141RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW141RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'nine') return;
  const idOf = el => { const k = el.closest('[data-nid]').dataset.nid; return /^c\d+$/.test(k) ? k : +k; };
  body.querySelectorAll('[data-bdpw]').forEach(s => s.onchange = () => wCampSay(wBdSetPw(idOf(s), s.dataset.bdpw, +s.value)));
};
const wW141BdCard = wBdCard;
wBdCard = function (p) {
  const html = wW141BdCard.apply(this, arguments); if (!html || !p) return html;
  const g = wNineBdPlayer(p, wBdOf(p).pos), took = wBdPickApply(g, p.bdPw).bdPick;
  return took.length ? html.replace(/(<p class="hint">Each level)/, `<p class="wbdpos">Brings to the diamond (picked on the Nine tab): ${took.map(id => `<b>${esc(wBdPickName(id))}</b>`).join(', ')}.</p>$1`) : html;
};

const wW141RenderHelp = renderHelp;
renderHelp = function () {
  wW141RenderHelp();
  const after = $('wHelpBallKit') || $('wHelpBall'); if (!after || $('wHelpBallPow')) return;
  const C = wBD.crowdRules, S = wBD.sit;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpBallPow"><b>Baseball powers.</b> Each player brings one power of a pair in each role, picked on the Nine tab. In batting, running and fielding the pair is their kind's own magic (paid with mana) or the physical skill they'd have without it (paid with stamina); a kind without that magic keeps its skill. A pitcher with two magic pitches of a pair brings one of them. The other nine picks too, the same each time, and the play-by-play names each side's picks. Situation powers are your team's, once a game each, for mana, when the moment fits: ${Object.values(S).map(x => `<b>${esc(x.n)}</b> (${x.cost} mana): ${esc(x.desc.charAt(0).toLowerCase() + x.desc.slice(1))}`).join(' ')} The crowd fills on runs, home runs, strikeouts, double plays and stolen bases (up to ${C.max}, shown in gold under each side's mana). Press Crowd in the Powers row above the field to spend ${C.cost} on your next cast: an ability with a strength works half again as strongly, or an ultimate's zone lasts an at-bat more. Sure things like Shadowstep can't be lifted. The CPU casts and spends by its skill, and Auto powers lets your coach do it for you.</p>`);
};
