/* ================= Brawling (rule, off by default) ================= */
// Any side can start a brawl between pitches: B for Player 1, N for Player 2 (press twice to confirm), the pause
// menu, or the phone panel. The CPU may start one after a hit batter or a devoured runner. Both benches empty onto
// the field and fight until the umpire pushes through the crowd to break it up. Punches cost health (with the
// Injuries setting) and stamina, and fighters spend mana on their powers: Devour swallows, Quake and Seismic
// stomp, Petrify, Web, Mesmerize and Shriek disable, Bull Rush and Pounce charge, Invisibility and Shadowstep
// vanish, and so on. It plays out on the field with a live play-by-play feed. However it ends, the side that
// started it has its ringleader (most damage dealt) ejected; a call-up (or a reliever, for a pitcher) replaces him.
RULE_DEFS.push({ k: 'brawl', label: 'Brawling', opts: [[false, 'Off'], [true, 'On']], def: false, help: 'Either side can start a bench-clearing brawl between pitches (B for Player 1, N for Player 2, pressed twice). It lasts until the umpire breaks it up. Players get hurt and tired, and use their powers. The side that started it has a player ejected.' });
const brawlOn = () => !!rule('brawl');
var BR = null;
const BR_UMP = { id: 'ump', color: '#1f1f22', light: '#f2f2f2', short: 'U', trim: '#000' };
// what each power does in a brawl
const BR_KIND = {
  devour: 'swallow', quake: 'stomp', seismic: 'stomp', shriek: 'disable', haunt: 'disable', mesmer: 'disable', petrify: 'stone', web: 'disable',
  axe: 'smash', crush: 'smash', pact: 'smash', boulder: 'smash', sticky: 'smash', gaze: 'disable', bunt: 'charge', eagle: 'smash',
  bullrush: 'charge', pounce: 'charge', sprint: 'charge', fleet: 'charge', glide: 'charge', flight: 'charge',
  shadowstep: 'vanish', invis: 'vanish', swarm: 'vanish', telek: 'throw', undying: 'heal', block: 'guard', dispel: 'dispel',
};
const BR_SAY = { swallow: 'tries to swallow', stomp: 'shakes the ground', disable: 'locks down', stone: 'turns to stone', smash: 'winds up a haymaker', charge: 'charges', vanish: 'vanishes into the pile', throw: 'hurls a bat with his mind at', heal: 'refuses to go down', guard: 'shields his teammates', dispel: 'breaks every spell in the pile' };
function brawlPower(p) { for (const id of [p.field, p.bat, p.run]) if (id && AB[id] && !AB[id].passive && BR_KIND[id]) return id; return null; }
const brawlKey = () => `${G.inning}${G.half}`;

/* ---------- starting ---------- */
function canBrawlNow() { if (!G.teams || G.paused || G.tutorial) return false; if (G.phase === 'between') return true; return G.phase === 'plate' && G.P && (G.P.stage === 'select' || G.P.stage === 'result') && !(G.P.intro > 0); }
function requestBrawl(side, why) {
  if (!brawlOn() || !G.teams || !gameOn() || BR) return false;
  G.brawled = G.brawled || {};
  if (G.brawled[side] === brawlKey()) { addFx('callout', { text: 'Already brawled this half-inning', col: '#c9c2ad', small: true }); return false; }
  G.brawlPending = { side, why: why || 'bad blood' };
  if (!canBrawlNow()) addFx('callout', { text: 'Brawl called: it starts when this play is over', col: '#ff8a5a', small: true });
  return true;
}
function startBrawl(side, why) {
  const T = G.teams, prev = { phase: G.phase }, hbp = /pitch/.test(why);
  const cx = 0, cy = hbp ? 10 : 34, fighters = [];
  const onBase = new Set([1, 2, 3].map(b => G.bases[b]).filter(Boolean));
  T.forEach((t, s) => {
    const fielding = s !== G.half, dug = s === 0 ? -1 : 1;
    t.def.roster.forEach((p, i) => {
      if (p.ko > 0 || p.ejected) return;
      let x, y;
      if (fielding) { const h = POSN[p.pos] || { x: 0, y: 60 }; x = h.x; y = h.y; }
      else if (p === batter()) { x = -4; y = 1; }
      else if (onBase.has(p)) { const b = [1, 2, 3].find(k => G.bases[k] === p); x = BASE[b].x; y = BASE[b].y; }
      else { x = dug * (70 + i * 5); y = -8 - (i % 3) * 5; }
      fighters.push({ p, s, x, y, cd: .3 + R() * .8, stun: 0, vanish: 0, guard: 0, mult: 1, down: false, used: false, pw: brawlPower(p), hits: 0, dealt: 0, taken: 0 });
    });
  });
  BR = { side, why, prev, cx, cy, t: 0, F: fighters, ump: { x: 0, y: -40, stun: 0 }, rally: [0, 0], rallyCd: [0, 0], fx: [], feed: [], end: 0, ringleader: null, cpuCd: [1, 1] };
  G.brawled = G.brawled || {}; G.brawled[side] = brawlKey(); G.brawlPending = null;
  G.phase = 'brawl';
  const st = T[side];
  banner('BRAWL!', `The ${st.def.name} start it${why && why !== 'bad blood' ? ` (${why})` : ''}. Benches clear!`, 2);
  sfx.crowd(2.5); sfx.bad(); G.shake = .4; try { musicSting('rally'); } catch (e) { }
  logLine(`BRAWL! The ${st.def.name} start a fight${why && why !== 'bad blood' ? ` after ${why}` : ''}, and both benches empty.`, true);
  brFeed(`${st.def.short} charge out of the dugout!`, st.def.color);
}
function brFeed(text, col) { if (!BR) return; BR.feed.unshift({ text, col: col || COL.bone, t: BR.t }); BR.feed = BR.feed.slice(0, 7); }

/* ---------- the fight ---------- */
const brDist = (a, b) => hyp(a.x - b.x, a.y - b.y);
const alive2 = s => BR.F.filter(f => f.s === s && !f.down);
function brHit(f, t, dmg, how, big) {
  if (t.down) return;
  if (t.vanish > 0) { if (big) brFeed(`${shortName(f.p)} swings at thin air: ${shortName(t.p)} isn't there`, '#c9c2ad'); return; }
  let d = dmg * (t.guard > 0 ? .5 : 1) * (t.p.run === 'stoneskin' || t.p.kind === 'golem' ? .6 : 1);
  d = Math.round(d); const h0 = t.p.hp ?? 100; hurt(t.p, d, how, { raw: true, quiet: true }); const lost = Math.max(0, Math.round(h0 - (t.p.hp ?? 100)));
  drain(t.p, 1.5 + d * .2, 'effort');
  f.hits++; f.dealt += d; t.taken += injOn() ? lost : d; if (lost) pst(t.p).inj++;
  try { injRisk(t.p, .012, 'collide', 'the brawl'); } catch (e) { }
  BR.fx.push({ type: 'pow', x: (f.x + t.x) / 2, y: (f.y + t.y) / 2, t: 0, word: big ? pick(['KRAK!', 'WHAM!', 'THOOM!']) : pick(['POW!', 'BAM!', 'SMACK!', 'THUD!', 'OOF!']), big: !!big });
  tone(140 + R() * 80, .06, 'square', .05); if (big) { G.shake = Math.max(G.shake, .25); sfx.crack(.3); }
  if (big || d >= 10) brFeed(`${shortName(f.p)} ${big ? 'lands a huge blow on' : pick(['decks', 'wallops', 'clobbers', 'flattens'])} ${shortName(t.p)}${lost ? ` (−${lost})` : ''}`, G.teams[f.s].def.light || COL.bone);
  if (t.p.ko > 0 || (t.p.hp != null && t.p.hp <= 0)) { t.down = true; brFeed(`${t.p.n} is out cold!`, '#ff8a7a'); logLine(`Brawl: ${t.p.n} is knocked out cold by ${f.p.n}.`, false, [{ k: 'hurt', t: `${shortName(t.p)} KO'd in the brawl`, n: 1 }]); }
  else if (t.taken >= (injOn() ? 36 : 60) && !t.dropped) { t.dropped = true; t.down = true; brFeed(`${shortName(t.p)} goes down in a heap and stays there`, '#ffb0a0'); }
}
function brCast(f) {
  const t = G.teams[f.s], id = f.pw, cost = abCost(f.p, id); if (!id || f.used || f.down || t.mana < cost) return false;
  t.mana -= cost; f.used = true; abUse(f.p, id); drain(f.p, 3 * cost, 'spell', TYPE_KIND ? TYPE_KIND[AB[id].type] : 'field');
  const kind = BR_KIND[id], foes = alive2(1 - f.s).filter(x => x.vanish <= 0).sort((a, b) => brDist(a, f) - brDist(b, f)), tg = foes[0];
  addFx('callout', { text: `${shortName(f.p)}: ${AB[id].name}!`, col: '#d6c4ff', small: true }); sfx.magic();
  brFeed(`${shortName(f.p)} ${BR_SAY[kind]}${tg && ['swallow', 'disable', 'stone', 'charge', 'throw'].includes(kind) ? ' ' + shortName(tg.p) : ''} (${AB[id].name})`, '#d6c4ff');
  let line = `Brawl: ${f.p.n} uses ${AB[id].name}`;
  if (kind === 'swallow' && tg) { const roll = d20(), ok = roll >= 12; addRoll(`${shortName(f.p)} tries to swallow ${shortName(tg.p)}`, 'd20 ≥ 12', roll, ok); if (ok) { f.x = tg.x; f.y = tg.y; brHit(f, tg, 26, 'half-swallowed in the brawl', true); tg.stun = 4; line += ` and swallows ${tg.p.n} whole, then spits him out`; } else { f.stun = 2; line += `, but chokes on ${tg.p.n}`; } }
  else if (kind === 'stomp') { G.shake = .6; BR.fx.push({ type: 'ring', x: f.x, y: f.y, t: 0 }); let n = 0; for (const e of foes) if (brDist(e, f) < 32) { e.stun = Math.max(e.stun, 1.6); brHit(f, e, 5, 'thrown down by the quake'); n++; } line += `: ${n} go sprawling`; }
  else if ((kind === 'disable' || kind === 'stone') && tg) { tg.stun = Math.max(tg.stun, kind === 'stone' ? 3.2 : 2.4); tg.stone = kind === 'stone' ? 3.2 : 0; BR.fx.push({ type: 'beam', f, tgt: tg, t: 0, col: kind === 'stone' ? '#9fe38a' : '#ff4d6d' }); line += ` on ${tg.p.n}`; }
  else if (kind === 'smash') { f.mult = 2.3; line += ' and winds up'; }
  else if (kind === 'charge' && tg) { f.x = tg.x - 4; f.y = tg.y; brHit(f, tg, (4 + f.p.pow * .8) * 1.6, 'trampled in the brawl', true); const d = brDist(tg, BR) || 1; tg.x += (tg.x - BR.cx) / d * 12; tg.y += (tg.y - BR.cy) / d * 12; tg.stun = Math.max(tg.stun, .9); line += ` straight through ${tg.p.n}`; }
  else if (kind === 'vanish') { f.vanish = 3; f.mult = 1.8; line += ' and disappears'; }
  else if (kind === 'throw' && tg) { BR.fx.push({ type: 'beam', f, tgt: tg, t: 0, col: '#c9a4ff' }); brHit(f, tg, 12, 'hit by a flying bat', true); line += ` to hurl a bat at ${tg.p.n}`; }
  else if (kind === 'heal') { f.p.hp = Math.min(100, (f.p.hp ?? 100) + 20); f.dropped = false; line += ' and gets back up'; }
  else if (kind === 'guard') { for (const a of alive2(f.s)) if (brDist(a, f) < 22) a.guard = 3; line += ' to cover his teammates'; }
  else if (kind === 'dispel') { for (const e of alive2(1 - f.s)) { e.vanish = 0; e.guard = 0; e.mult = 1; } if (tg) tg.stun = Math.max(tg.stun, 1); line += ': every spell in the pile fizzles'; }
  logLine(line + '.', false, [{ k: 'magic', t: `${shortName(f.p)}: ${AB[id].name}`, n: 1 }]);
  return true;
}
function brawlUpdate(dt) {
  const B = BR; if (!B) return; B.t += dt;
  for (const e of B.fx) e.t += dt; B.fx = B.fx.filter(e => e.t < .8);
  if (B.end > 0) { B.end -= dt; if (B.end <= 0) endBrawl(); return; }
  B.rally = B.rally.map(v => Math.max(0, v - dt)); B.rallyCd = B.rallyCd.map(v => Math.max(0, v - dt));
  // human input: G unleashes a power, V rallies the side
  G.teams.forEach((t, s) => {
    const human = isHuman(t), I = human ? INP[t.ctl] : null;
    if (I && I.p.abil) { const f = alive2(s).filter(x => x.pw && !x.used && t.mana >= abCost(x.p, x.pw)).sort((a, b) => brDist(a, B) - brDist(b, B))[0]; if (!f || !brCast(f)) { tone(140, .1, 'square', .04); if (!B.noMsg || B.t - B.noMsg > 1.2) { B.noMsg = B.t; addFx('callout', { text: t.mana < 1 ? 'No mana left' : 'No powers left to use', col: '#c9c2ad', small: true }); } } }
    if (I && I.p.hus && !B.rallyCd[s]) brRally(s);
    if (!human || AUTO) { B.cpuCd[s] -= dt; if (B.cpuCd[s] <= 0) { B.cpuCd[s] = .6 + R() * .8; const f = alive2(s).find(x => x.pw && !x.used && t.mana >= abCost(x.p, x.pw) && brDist(x, B) < 30); if (f && R() < .5) brCast(f); else if (!B.rallyCd[s] && !human && R() < .15) brRally(s); } }
  });
  // fighters
  for (const f of B.F) {
    if (f.down) continue;
    if (f.vanish > 0) f.vanish -= dt; if (f.guard > 0) f.guard -= dt; if (f.stone > 0) f.stone -= dt;
    if (f.stun > 0) { f.stun -= dt; continue; }
    const foes = alive2(1 - f.s).filter(x => x.vanish <= 0);
    let tx = B.cx + Math.sin(f.p.num + B.t) * 6, ty = B.cy + Math.cos(f.p.num) * 6, tg = null;
    if (foes.length) { tg = foes.sort((a, b) => brDist(a, f) - brDist(b, f))[0]; tx = tg.x; ty = tg.y; }
    const d = hyp(tx - f.x, ty - f.y), sp = (14 + f.p.spd * 1.1) * (1 - .35 * fk(f.p)) * (B.rally[f.s] ? 1.2 : 1);
    if (d > 5) { const m = Math.min(d - 4.5, sp * dt); f.x += (tx - f.x) / d * m; f.y += (ty - f.y) / d * m; f.mv = true; }
    else { f.mv = false; f.x += Math.sin(B.t * 9 + f.p.num) * .15; }
    f.cd -= dt;
    if (tg && d <= 6 && f.cd <= 0) {
      f.cd = Math.max(.35, .75 + R() * .5 - f.p.spd * .025) * (fatigue(f.p) < .2 ? 1.5 : 1);
      drain(f.p, 1.2, 'effort');
      const hitC = .55 + (f.p.con - tg.p.spd) * .025 - (tg.stone > 0 ? -.3 : 0);
      if (R() < hitC) { const big = f.mult > 1; brHit(f, tg, (2 + f.p.pow * .45) * (.6 + R() * .7) * (B.rally[f.s] ? 1.3 : 1) * f.mult, pick(['caught a fist in the brawl', 'kicked in the pile', 'headbutted in the brawl', 'bitten in the scrum']), big); f.mult = 1; }
      else if (R() < .12) brFeed(`${shortName(tg.p)} ducks a wild swing from ${shortName(f.p)}`, '#c9c2ad');
    }
  }
  // the umpire works his way in; fighting near him slows him, and now and then he gets flattened
  const U = B.ump;
  if (U.stun > 0) U.stun -= dt;
  else {
    const near = B.F.filter(f => !f.down && brDist(f, U) < 14).length, d = hyp(B.cx - U.x, B.cy - U.y);
    const sp = 12.5 * (near >= 4 ? .5 : near >= 2 ? .75 : 1);
    if (d > .1) { U.x += (B.cx - U.x) / d * Math.min(d, sp * dt); U.y += (B.cy - U.y) / d * Math.min(d, sp * dt); }
    if (near && R() < .22 * dt * near / 3) { U.stun = 1.2; U.y -= 5; brFeed(pick(['The umpire is knocked flat!', 'Someone steps on the umpire', 'The umpire loses his hat in the pile']), '#ffd34a'); addFx('callout', { text: 'Umpire down!', col: '#ffd34a', small: true }); }
    if (d < 5) { B.end = 1.2; B.brokenUp = true; }
  }
  if (!B.end && (!alive2(0).length || !alive2(1).length || B.t > 18)) { B.end = 1.2; B.backup = true; }
  if (B.end) { banner('Break it up!', B.backup ? 'The umpires pour in and pull them apart' : 'The umpire wades in and pulls them apart', 1.6); sfx.ump(); brFeed('The umpire breaks it up!', '#ffd34a'); }
}
function brRally(s) { BR.rally[s] = 3; BR.rallyCd[s] = 6; for (const f of alive2(s)) drain(f.p, 2, 'effort'); addFx('callout', { text: `${G.teams[s].def.short} rally in the pile!`, col: '#ffb547', small: true }); brFeed(`${G.teams[s].def.short} pile in harder!`, G.teams[s].def.light); }

/* ---------- the end: somebody gets tossed ---------- */
function ejectPlayer(team, p) {
  const ros = team.def.roster, i = ros.indexOf(p); if (i < 0) return null;
  p.ejected = true; team.used.push(p);
  let sub = null;
  if (p.pos === 'P' && team.pen.length) { team.pen.sort((a, b) => fatigue(b) - fatigue(a)); sub = team.pen.shift(); }
  else { const taken = new Set(ros.map(x => x.n)); sub = genPlayer(1, p.pos, taken); sub.src = { id: 'callup-' + uid() }; sub.callup = true; sub.ck = null; initStamina(sub); }
  sub.pos = p.pos; ros[i] = sub;
  for (const b of [1, 2, 3]) if (G.bases[b] === p) G.bases[b] = sub;
  return sub;
}
function endBrawl() {
  const B = BR; if (!B) return;
  const st = G.teams[B.side], mine = B.F.filter(f => f.s === B.side);
  const ring = mine.slice().sort((a, b) => b.dealt - a.dealt || b.hits - a.hits)[0] || { p: pick(st.def.roster) };
  const wasBatter = ring.p === batter(), wasPitcher = ring.p === pitcher();
  const sub = ejectPlayer(st, ring.p);
  const hurtList = B.F.filter(f => f.taken > 0).sort((a, b) => b.taken - a.taken).slice(0, 4).map(f => `${f.p.n} (${f.taken})`);
  logLine(`The umpire breaks up the brawl${B.backup ? ' with help' : ''} after ${Math.round(B.t)} seconds. ${ring.p.n} of the ${st.def.name} is ejected as the ringleader${sub ? `; ${sub.n}${sub.callup ? ', a call-up,' : ''} replaces him at ${sub.pos}` : ''}.${hurtList.length ? ` Worst beaten: ${hurtList.join(', ')}.` : ''}`, true, [{ k: 'hurt', t: `${shortName(ring.p)} ejected`, n: 1 }]);
  banner('Ejected!', `${ring.p.n} is tossed from the game${sub ? ` · ${sub.n} comes in` : ''}`, 2.2); sfx.out();
  BR = null; G.phase = B.prev.phase;
  if (G.phase === 'plate' && G.P && G.P.stage === 'select' && (wasBatter || wasPitcher)) startPitch(false);
  else if (G.phase === 'plate' && G.P && G.P.stage === 'select') { G.P.cpuT = Math.max(G.P.cpuT || 0, 1); }
  renderLineScore();
}

/* ---------- hooks ---------- */
{ const o = update; update = function (dt, rdt) {
  o.apply(this, arguments);
  if (G.phase === 'brawl') { brawlUpdate(dt); return; }
  if (G.brawlPending && brawlOn() && canBrawlNow()) startBrawl(G.brawlPending.side, G.brawlPending.why);
}; }
// the CPU loses its temper now and then: a hit batter, or a teammate eaten
{ const o = showResult; showResult = function (big, small, t, code) {
  o.apply(this, arguments);
  try { if (code === 'HBP' && brawlOn()) { const s = G.half, tm = G.teams[s]; G.brawlCPU = G.brawlCPU || {}; if (!isHuman(tm) && !G.brawlCPU[s] && R() < .22) { G.brawlCPU[s] = 1; requestBrawl(s, 'a hit batter'); } } } catch (e) { }
}; }
{ const o = outRunner; outRunner = function (r, how) {
  o.apply(this, arguments);
  try { if (how === 'devoured' && brawlOn()) { const s = G.half, tm = G.teams[s]; G.brawlCPU = G.brawlCPU || {}; if (!isHuman(tm) && !G.brawlCPU[s] && R() < .3) { G.brawlCPU[s] = 1; requestBrawl(s, 'a teammate got eaten'); } } } catch (e) { }
}; }
// B (Player 1) / N (Player 2): press twice to confirm
let BR_ASK = null;
function humanBrawl(ctl) {
  if (!brawlOn() || !gameOn() || BR) return;
  const s = G.teams.findIndex(t => t.ctl === ctl); if (s < 0) return;
  if (BR_ASK && BR_ASK.s === s && G.time - BR_ASK.t < 2) { BR_ASK = null; requestBrawl(s); return; }
  BR_ASK = { s, t: G.time };
  addFx('callout', { text: `Press ${ctl === 'p1' ? 'B' : 'N'} again to start a brawl (one of yours gets ejected)`, col: '#ff8a5a', small: true });
}
window.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) || PAGE !== 'play' || G.paused) return;
  if (e.code === 'KeyB') humanBrawl('p1'); else if (e.code === 'KeyN' && G.mode === '2p') humanBrawl('p2');
});
// pause menu button
{ const row = document.querySelector('#pause .row'); if (row) { row.insertAdjacentHTML('afterbegin', '<button class="ghost" type="button" id="bBrawl" hidden>Start a brawl</button>'); document.getElementById('bBrawl').addEventListener('click', () => { const s = G.teams ? G.teams.findIndex(t => t.ctl === 'p1') : -1; togglePause(); if (s >= 0) requestBrawl(s); }); } }
{ const o = togglePause; togglePause = function () { o.apply(this, arguments); const b = document.getElementById('bBrawl'); if (b) b.hidden = !(brawlOn() && G.teams && G.teams.some(t => t.ctl === 'p1') && gameOn() && !BR); }; }
// phone panel button
{ const o = mpRender; mpRender = function () {
  o.apply(this, arguments);
  try { if (mpEl.hidden || !brawlOn()) return; const s = G.teams.findIndex(t => t.ctl === 'p1'); if (s < 0) return; let ex = mpEl.querySelector('.mp-extra'); if (!ex) { ex = document.createElement('div'); ex.className = 'mp-extra'; mpEl.appendChild(ex); } if (!ex.querySelector('[data-brawl]')) ex.insertAdjacentHTML('beforeend', '<button class="mp-x" data-brawl="1">Brawl!</button>'); } catch (e) { }
}; }
mpEl.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('[data-brawl]')) { e.preventDefault(); humanBrawl('p1'); } });

/* ---------- drawing: the brawl on the field, with a play-by-play feed ---------- */
{ const o = render; render = function () {
  if (G.phase !== 'brawl' || !BR) return o.apply(this, arguments);
  const c = ctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
  if (!bgField) buildFieldBg();
  c.save(); if (G.shake > 0) c.translate((R() - .5) * G.shake * 16, (R() - .5) * G.shake * 16);
  // lean the camera in on the pile
  const z = 1.45, f0 = fp(BR.cx, BR.cy), tx = clamp(480 - f0.x * z, W - W * z, 0), ty = clamp(330 - f0.y * z, H - H * z, 0);
  c.save(); c.translate(tx, ty); c.scale(z, z);
  c.drawImage(bgField, 0, 0, W, H); torches(c, FIELD_TORCHES);
  drawBrawlScene(c);
  c.restore(); c.restore();
  drawScoreboard(c); drawOverlayFx(c); drawBrawlHud(c);
  if (G.paused) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 0, W, H); }
}; }
function drawBrawlScene(c) {
  const B = BR, pile = B.F.filter(f => !f.down && brDist(f, B) < 16).length;
  // a dust cloud over the pile
  for (let i = 0; i < 10 + pile * 2; i++) { const a = i * 2.4 + B.t * (1 + i % 3), r = 6 + (i % 5) * 4 + Math.sin(B.t * 3 + i) * 3, p = fp(B.cx + Math.cos(a) * r, B.cy + Math.sin(a) * r * .6); circ(c, p.x, p.y - 10, 7 + (i % 4) * 2, `rgba(200,180,150,${Math.min(.28, .05 + pile * .02)})`); }
  const ents = B.F.map(f => ({ y: f.y, f })); ents.push({ y: B.ump.y, ump: true });
  ents.sort((a, b) => b.y - a.y).forEach(e => {
    if (e.ump) { const p = fp(B.ump.x, B.ump.y); c.save(); if (B.ump.stun > 0) { c.translate(p.x, p.y); c.rotate(-1.3); drawFig(c, 'lich', 0, 0, 40, BR_UMP, { num: '' }); c.restore(); stunStars(c, p.x, p.y - 20); } else { drawFig(c, 'lich', p.x, p.y, 40, BR_UMP, { num: '', run: G.time * 14 }); c.restore(); } txt(c, 'UMP', p.x, p.y + 12, F_HUD(13), '#ffd34a', 'center'); return; }
    const f = e.f, p = fp(f.x, f.y), team = G.teams[f.s].def;
    c.save();
    if (f.down) { c.translate(p.x, p.y); c.rotate(f.s ? 1.35 : -1.35); drawFig(c, f.p.kind, 0, 0, 38, team, { num: f.p.num, alpha: .8 }); c.restore(); txt(c, 'z', p.x + 10, p.y - 18 - (G.time * 8 % 6), F_HUD(13), '#c9d8ff'); return; }
    const jab = !f.mv && f.cd < .15 ? 3 : 0;
    drawFig(c, f.p.kind, p.x + (f.s ? -jab : jab), p.y, 38, team, { num: f.p.num, run: f.mv ? G.time * 18 : Math.sin(G.time * 10 + f.p.num) * .6, alpha: f.vanish > 0 ? .25 : undefined, stone: f.stone > 0, lift: f.stun > 0 && !f.stone ? 0 : 0 });
    c.restore();
    if (f.stun > 0 && !(f.stone > 0)) stunStars(c, p.x, p.y - 44);
    if (f.guard > 0) { c.strokeStyle = 'rgba(160,200,255,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y - 18, 20, 0, Math.PI * 2); c.stroke(); }
    if (BR.rally[f.s] > 0) effortAura(c, p.x, p.y, .8);
  });
  for (const e of B.fx) {
    if (e.type === 'pow') { const p = fp(e.x, e.y), k = e.t / .8; c.save(); c.globalAlpha = 1 - k; c.translate(p.x, p.y - 30 - k * 14); const s = (e.big ? 1.4 : 1) * (1 + k * .3);
      c.beginPath(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r = (i % 2 ? 10 : 20) * s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fillStyle = e.big ? '#ff6a3a' : '#ffd34a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
      c.font = `900 ${Math.round(11 * s)}px "Alegreya Sans", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = INK; c.strokeText(e.word, 0, 1); c.fillStyle = '#fff'; c.fillText(e.word, 0, 1); c.restore(); }
    else if (e.type === 'ring') { const p = fp(e.x, e.y), k = e.t / .8; c.strokeStyle = `rgba(200,168,110,${.7 - k * .7})`; c.lineWidth = 3; c.beginPath(); c.ellipse(p.x, p.y, 60 * k * FS, 44 * k * FS, 0, 0, Math.PI * 2); c.stroke(); }
    else if (e.type === 'beam') { const a = fp(e.f.x, e.f.y), b = fp(e.tgt.x, e.tgt.y); c.strokeStyle = e.col; c.globalAlpha = 1 - e.t / .8; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x, a.y - 20); c.lineTo(b.x, b.y - 20); c.stroke(); c.globalAlpha = 1; }
  }
}
function drawBrawlHud(c) {
  const B = BR; if (!B) return;
  // play-by-play feed, top right under the scoreboard
  const x = W - 330, w = 320; let y = 12;
  c.save(); rr(c, x, y, w, 26 + B.feed.length * 22, 8); c.fillStyle = 'rgba(8,10,12,.82)'; c.fill(); c.strokeStyle = 'rgba(255,106,90,.5)'; c.lineWidth = 1.5; c.stroke();
  txt(c, `BRAWL · ${G.teams[B.side].def.short} STARTED IT · ${Math.floor(B.t)}s`, x + 12, y + 18, F_HUD(16), '#ff8a5a');
  c.font = F_TXT(13.5, 700);
  B.feed.forEach((f, i) => { const age = B.t - f.t; let s = f.text; while (c.measureText(s).width > w - 24 && s.length > 8) s = s.slice(0, -2); if (s !== f.text) s = s.trimEnd() + '…'; c.globalAlpha = i === 0 ? 1 : Math.max(.45, 1 - i * .1); txt(c, s, x + 12, y + 40 + i * 22, F_TXT(13.5, i === 0 && age < 1 ? 800 : 600), f.col); });
  c.restore();
  // each side: standing, down, mana; the umpire's distance
  const U = B.ump, dist = Math.round(hyp(B.cx - U.x, B.cy - U.y));
  G.teams.forEach((t, s) => { const st = alive2(s).length, dn = B.F.filter(f => f.s === s && f.down).length, px = s ? W - 250 : 10;
    rr(c, px, H - 58, 240, 48, 8); c.fillStyle = 'rgba(8,10,12,.82)'; c.fill(); c.fillStyle = t.def.color; c.fillRect(px + 6, H - 52, 4, 36);
    txt(c, `${t.def.short} · ${st} standing${dn ? ` · ${dn} down` : ''}`, px + 18, H - 36, F_HUD(18), COL.bone);
    const h = isHuman(t) ? keyHints(t.ctl) : null; txt(c, h ? `${h.ab} power · ${h.hus} rally${B.rallyCd[s] ? ' (wait)' : ''}` : (B.rally[s] ? 'rallying!' : 'CPU'), px + 18, H - 17, F_TXT(12.5, 600), COL.faint);
    manaGems(c, px + 158, H - 22, t.mana, t); });
  pill(c, U.stun > 0 ? 'The umpire is down!' : `Umpire ${dist} ft from the pile`, H - 24, U.stun > 0 ? '#ffd34a' : '#ede4cd', 17);
}
try { const b = document.getElementById('bTips'); if (b) b.closest('p').insertAdjacentHTML('afterend', '<p class="hint"><b>Brawling</b> (off by default; turn it on in <a href="#settings" data-page="settings">Settings</a>): between pitches press <kbd>B</kbd> twice (Player 2: <kbd>N</kbd>), or use the pause menu, to start a brawl. Both benches clear and fight on the field until the umpire breaks it up; a feed shows the blow-by-blow. Press <kbd>G</kbd> to unleash a fighter\'s power (costs mana) and <kbd>V</kbd> to rally your side (costs stamina). Players get hurt and tired. Afterwards the side that started it loses its ringleader to an ejection. The CPU may start one after a hit batter or an eaten runner.</p>'); } catch (e) { }
try { renderSetupRules(); if (PAGE === 'settings') renderSettings(); } catch (e) { }
// every game starts with a clean slate: no brawl in progress, no cooldowns, the CPU's temper reset
{ const o = newGame; newGame = function () { BR = null; G.brawled = {}; G.brawlCPU = {}; G.brawlPending = null; return o.apply(this, arguments); }; }
{ const o = resumeSnap; resumeSnap = function () { BR = null; G.brawled = {}; G.brawlCPU = {}; G.brawlPending = null; return o.apply(this, arguments); }; }
