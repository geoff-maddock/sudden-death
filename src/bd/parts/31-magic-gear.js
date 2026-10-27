/* ================= Magic bats and balls (rule: "Magic gear") ================= */
// Every club owns a locker of gear and brings one equipped bat and one equipped ball to each game.
// Consumables lose a charge each use and are gone at zero; the costly ones refill before every game.
// Lockers: the season club's lives in S.gear (paid from S.gold); other clubs' in localStorage bd-gear, each with its own purse.
RULE_DEFS.push({ k: 'gear', label: 'Magic bats and balls', opts: [[true, 'On'], [false, 'Off']], def: true, help: "Each club's equipped magic bat and ball show up as an extra batting stance and an extra pitch. Off: gear stays in the locker." });

var GEAR = {
  splinter:    { name: 'Splinter Bat',     type: 'bat',  price: 15,  uses: 3, desc: 'Cheap and angry. Power +20%.', pw: 1.2 },
  hornet:      { name: 'Hornet-Nest Bat',  type: 'bat',  price: 25,  uses: 3, desc: 'A buzzing barrel that finds the ball: sweet spot +45%.', r: 1.45 },
  thunder:     { name: 'Thunderclap Bat',  type: 'bat',  price: 35,  uses: 2, desc: 'Power +35%. On a fair hit, the thunder staggers every fielder for 1 s.', pw: 1.35, stagger: 1 },
  lodestone:   { name: 'Lodestone Bat',    type: 'bat',  price: 95,  uses: 2, recharge: true, desc: 'Pulls the ball in: sweet spot +60%, timing window +30%.', r: 1.6, win: 1.3 },
  dragonbone:  { name: 'Dragonbone Bat',   type: 'bat',  price: 120, uses: 2, recharge: true, desc: 'Power +55% and launch +8°. Built for the moon.', pw: 1.55, launch: 8 },
  leaden:      { name: 'Leaden Ball',      type: 'ball', price: 15,  uses: 3, desc: 'A fastball as heavy as a tombstone: anything hit off it loses 25% of its power.', base: 'fastball', dead: .75 },
  ghost:       { name: 'Ghost Ball',       type: 'ball', price: 30,  uses: 3, desc: 'A slider that vanishes after release and reappears at the plate.', base: 'slider', fx: 'phantom' },
  hellfire:    { name: 'Hellfire Ball',    type: 'ball', price: 35,  uses: 2, desc: 'A heater that bursts into flame: contact risks a scorched bat, and it burns a batter it hits.', base: 'heater', fx: 'fire' },
  quicksilver: { name: 'Quicksilver Ball', type: 'ball', price: 100, uses: 3, recharge: true, desc: 'A heater that arrives 15% sooner.', base: 'heater', fast: .85 },
  wyrmeye:     { name: 'Wyrm-Eye Ball',    type: 'ball', price: 90,  uses: 2, recharge: true, desc: 'A slider that goes where it is aimed: scatter −60%.', base: 'slider', ctrl: .4 },
};
const GEAR_START_GOLD = 80, GEAR_WIN = 25, GEAR_LOSS = 10;
const gearTxt = g => `${g.uses} use${g.uses === 1 ? '' : 's'}${g.recharge ? ' a game, recharges' : ', then gone'}`;

/* ---------- lockers ---------- */
var LOCKERS = {};
try { LOCKERS = JSON.parse(localStorage.getItem('bd-gear') || 'null') || {}; } catch (e) { LOCKERS = {}; }
function saveLockers() { try { localStorage.setItem('bd-gear', JSON.stringify(LOCKERS)); } catch (e) { } }
function newItem(id) { return { uid: uid(), id, uses: GEAR[id].uses }; }
function starterLocker() { const b = newItem('splinter'), l = newItem('leaden'); return { gold: GEAR_START_GOLD, items: [b, l], bat: b.uid, ball: l.uid }; }
// the locker for a club id ('club' = your season club)
function lockerOf(id) {
  if (id === 'club') { if (!S) return null; if (!S.gear) { const b = newItem('splinter'); S.gear = { items: [b], bat: b.uid, ball: null }; } return S.gear; }
  if (!LOCKERS[id]) { LOCKERS[id] = starterLocker(); saveLockers(); }
  return LOCKERS[id];
}
const purse = id => id === 'club' ? (S ? S.gold : 0) : lockerOf(id).gold;
function spend(id, n) { if (id === 'club') S.gold -= n; else lockerOf(id).gold -= n; }
function saveLocker(id) { if (id === 'club') { if (S) saveSeason(); } else saveLockers(); }
// season rivals carry gear that grows with their level (rebuilt for each game)
function rivalLocker(o) {
  const lv = o.final ? 9 : o.level || 1, items = [];
  if (lv >= 2) items.push(newItem(lv >= 4 ? 'thunder' : 'splinter'));
  if (lv >= 3) items.push(newItem(lv >= 5 ? 'ghost' : 'leaden'));
  if (lv >= 6) items.push(newItem('lodestone'));
  if (lv >= 7) items.push(newItem('quicksilver'));
  const pickT = t => { const c = items.filter(x => GEAR[x.id].type === t); return c.length ? c[c.length - 1].uid : null; };
  return { items, bat: pickT('bat'), ball: pickT('ball') };
}
// called by newGame for each side: attach the locker and refill the rechargeable gear
function attachGear(t) {
  t.gear = null; t.gearId = null;
  const d = t.def; let L = null;
  if (d.id === 'club') { L = lockerOf('club'); t.gearId = 'club'; }
  else if (G.season || d.level != null) L = rivalLocker(d);
  else if (d.id) { L = lockerOf(d.id); t.gearId = d.id; }
  if (!L) return;
  for (const it of L.items) if (GEAR[it.id] && GEAR[it.id].recharge) it.uses = GEAR[it.id].uses;
  t.gear = L;
}
function equipped(team, type) {
  if (!rule('gear') || !team || !team.gear) return null;
  const u = team.gear[type]; const it = u && team.gear.items.find(x => x.uid === u);
  return it && it.uses > 0 && GEAR[it.id] ? it : null;
}
// the extra batting stance and the extra pitch
function gearStance(team) { const it = equipped(team, 'bat'); if (!it) return null; const g = GEAR[it.id]; return { k: 'gear', gear: it.id, it, name: `⚒ ${g.name} ×${it.uses}` }; }
function gearPitch(team) {
  const it = equipped(team, 'ball'); if (!it) return null; const g = GEAR[it.id], b = PITCHES[g.base];
  return { ...b, k: 'gear:' + it.id, name: `⚒ ${g.name} ×${it.uses}`, cost: 0, magic: false, ult: false, fx: g.fx || b.fx, gear: it.id, it };
}
// at the release: spend the charges, change the pitch; returns the scatter
function gearOnRelease(pc, pd, st, ctrl) {
  const bat = batter(), pt = pitcher();
  if (st && st.k === 'gear' && st.it && st.it.uses > 0) {
    const g = GEAR[st.gear]; st.it.uses--; pc.bgear = st.gear;
    useTag('gear', `${shortName(bat)}: ${g.name}${g.recharge ? '' : ` (${st.it.uses} left)`}`); abUse(bat, 'gear:' + st.gear);
    addFx('abil', { text: g.name, side: 'bat' }); tone(330, .08, 'sawtooth', .05);
  }
  if (pd && pd.gear && pd.it && pd.it.uses > 0) {
    const g = GEAR[pd.gear]; pd.it.uses--; pc.pgear = pd.gear;
    useTag('gear', `${shortName(pt)}: ${g.name}${g.recharge ? '' : ` (${pd.it.uses} left)`}`); abUse(pt, 'gear:' + pd.gear);
    if (g.fast) pc.T *= g.fast;
    if (g.ctrl) ctrl *= g.ctrl;
    if (g.dead) pc.dead = g.dead;
    if (g.fx === 'fire') sfx.fire();
    addFx('callout', { text: g.name + '!', col: g.fx === 'fire' ? '#ff9a3a' : '#e8d9b0' });
  }
  return ctrl;
}
// swing modifiers from the bat (and the leaden ball)
function gearSwing(pc) { const g = pc.bgear ? GEAR[pc.bgear] : {}; return { r: g.r || 1, pw: (g.moonPw && typeof moonIdx === 'function' && skyOn() && moonIdx() === 4 ? g.moonPw : g.pw || 1) * (pc.dead || 1), win: g.win || 1, launch: g.launch || 0 }; }
function gearReach(k) { if (k !== 'gear' || !G.P) return { r: 1, win: 1 }; const s = G.P.stances[G.P.si], g = s && s.gear ? GEAR[s.gear] : {}; return { r: g.r || 1, win: g.win || 1 }; }

/* ---------- when the CPU (or Auto powers) reaches for the gear ---------- */
function gearMoment(forBall) {
  let w = forBall ? .08 : .1;
  if (G.bases[2] || G.bases[3]) w += .15;
  if (forBall && G.strikes === 2) w += .15;
  if (!forBall && G.balls > G.strikes) w += .05;
  if (G.inning >= G.innings - 1 && Math.abs(G.teams[0].R - G.teams[1].R) <= 2) w += .12;
  return w;
}
function gearCpuStance() {
  const P = G.P, i = P.stances.findIndex(s => s.k === 'gear'); if (i < 0) return;
  const s = P.stances[i], w = gearMoment(false) * (GEAR[s.gear].recharge ? 1.6 : .5);
  if (P.stances[P.si].k === 'ult') return;
  if (R() < w) { P.si = i; P.autoPick = true; }
}
function gearCpuPitch() {
  const P = G.P, i = P.pitches.findIndex(p => p.gear); if (i < 0) return;
  if (P.pitches[P.pi].ult) return;
  const w = gearMoment(true) * (GEAR[P.pitches[i].gear].recharge ? 1.6 : .5);
  if (R() < w) { P.pi = i; P.autoPick = true; }
}

/* ---------- after the game: purses, clean-up, and the CPU shops ---------- */
function gearAfterGame() {
  if (!G.teams) return;
  const [a, h] = G.teams, winner = a.R > h.R ? a : h;
  for (const t of G.teams) {
    if (!t.gear) continue;
    t.gear.items = t.gear.items.filter(x => x.uses > 0 || (GEAR[x.id] && GEAR[x.id].recharge));
    if (t.gearId && t.gearId !== 'club') {
      const L = lockerOf(t.gearId); L.gold += t === winner ? GEAR_WIN : GEAR_LOSS;
      if (t.ctl === 'cpu' && !G.teams.some(x => x.gearId === t.gearId && x.ctl !== 'cpu')) cpuShop(t.gearId);
    }
  }
  saveLockers();
}
// buy the best thing the club can afford for an empty or spent slot, then equip the best of each kind
function cpuShop(id) {
  const L = lockerOf(id); if (!L) return [];
  const bought = [];
  for (const type of ['bat', 'ball']) {
    const have = L.items.filter(x => GEAR[x.id].type === type && x.uses > 0);
    const hasRecharge = have.some(x => GEAR[x.id].recharge);
    if (hasRecharge || have.length >= 2) continue;
    const reserve = id === 'club' ? 30 : 10;
    const ownBest = Math.max(0, ...have.map(x => GEAR[x.id].price));
    const cands = Object.entries(GEAR).filter(([k, g]) => g.type === type && g.price + reserve <= purse(id) && g.price > ownBest).sort((x, y) => y[1].price - x[1].price);
    if (!cands.length) continue;
    const [k, g] = cands[0]; spend(id, g.price); const it = newItem(k); L.items.push(it); bought.push(g.name);
  }
  const was = [L.bat, L.ball]; gearAutoEquip(L, true);
  for (const t of ['bat', 'ball']) if (L[t] && !was.includes(L[t])) { const it = L.items.find(x => x.uid === L[t]); if (it) bought.push(`equipped the ${GEAR[it.id].name}`); }
  if (bought.length) saveLocker(id);
  return bought;
}
function gearAutoEquip(L, force) {
  for (const type of ['bat', 'ball']) {
    const cur = L.items.find(x => x.uid === L[type] && x.uses > 0);
    if (cur && !force) continue;
    const best = L.items.filter(x => GEAR[x.id].type === type && x.uses > 0).sort((x, y) => GEAR[y.id].price - GEAR[x.id].price)[0];
    L[type] = best ? best.uid : null;
  }
}

/* ---------- the Armory page ---------- */
const AR = { club: null };
function armoryClubs() {
  const out = [];
  if (S && S.active) out.push({ id: 'club', name: S.club.name + ' (season)', color: S.club.color });
  for (const t of Object.values(TEAMS)) out.push({ id: t.id, name: t.name, color: t.color });
  for (const t of CUSTOM) out.push({ id: t.id, name: t.name + ' ★', color: t.color });
  return out;
}
const clubBusy = id => gameLive() && G.teams.some(t => t.gearId === id);
function renderArmory() {
  const el = document.getElementById('armory'); if (!el) return;
  const clubs = armoryClubs(); if (!AR.club || !clubs.some(c => c.id === AR.club)) AR.club = clubs[0].id;
  const id = AR.club, L = lockerOf(id), c = clubs.find(x => x.id === id), gold = purse(id), busy = clubBusy(id);
  const slot = type => { const it = L.items.find(x => x.uid === L[type]); return it ? `<b>${esc(GEAR[it.id].name)}</b> <span class="sub">${it.uses}/${GEAR[it.id].uses}${GEAR[it.id].recharge ? ' · recharges' : ''}</span>` : '<span class="sub">nothing equipped</span>'; };
  const rows = L.items.map(it => { const g = GEAR[it.id]; if (!g) return ''; const on = L[g.type] === it.uid;
    return `<div class="offer"><div><b>${esc(g.name)}</b> <span class="ar-ty ar-${g.type}">${g.type}</span>${g.recharge ? ' <span class="ar-re">recharges</span>' : ''}${on ? ' <span class="ar-on">equipped</span>' : ''}<div class="sub">${esc(g.desc)} ${it.uses}/${g.uses} charges${g.recharge ? ' (full again next game)' : ''}.</div></div>
      <div class="row" style="gap:6px;flex-wrap:nowrap"><button class="buy" data-ar="equip" data-u="${it.uid}" ${busy || on || it.uses <= 0 ? 'disabled' : ''}>${on ? 'Equipped' : 'Equip'}</button><button class="buy" data-ar="sell" data-u="${it.uid}" ${busy ? 'disabled' : ''}>Sell ${sellPrice(it)}g</button></div></div>`; }).join('');
  const shop = Object.entries(GEAR).map(([k, g]) => `<div class="offer"><div><b>${esc(g.name)}</b> <span class="ar-ty ar-${g.type}">${g.type}</span>${g.recharge ? ' <span class="ar-re">recharges</span>' : ''}<div class="sub">${esc(g.desc)} ${gearTxt(g)}.</div></div><button class="buy" data-ar="buy" data-k="${k}" ${busy || gold < g.price ? 'disabled' : ''}>${g.price}g</button></div>`).join('');
  el.innerHTML = `
    <h2 class="pgh">Armory</h2>
    <p class="lede2">Magic bats and balls. Every club owns its gear and brings one equipped bat and one equipped ball to each game, where they show up as an extra batting stance and an extra pitch marked ⚒. Cheap gear runs out; the costly pieces recharge before every game. Buy and swap between games.</p>
    <div class="rv-row" role="group" aria-label="Club">${clubs.map(x => `<button class="rchip ${x.id === id ? 'on' : ''}" data-ar="club" data-v="${x.id}" style="border-bottom:3px solid ${x.color}">${esc(x.name)}</button>`).join('')}</div>
    ${rule('gear') ? '' : `<p class="hint">Magic bats and balls are switched off for ${gameLive() ? 'this game' : 'the next game'} in <a href="#settings" data-page="settings">Settings</a>.</p>`}
    <div class="market" style="margin-top:14px">
      <section class="card"><h4 style="color:${c.color}">${esc(c.name)}</h4>
        <p class="sub">${id === 'club' ? 'Season purse' : 'Club purse'}: <b style="color:var(--torch)">${gold}g</b>${id === 'club' ? ' (the same gold as the Clubhouse market)' : ` · +${GEAR_WIN}g per win, +${GEAR_LOSS}g per loss in exhibition games`}</p>
        ${busy ? '<p class="hint">This club is playing right now. The locker opens again after the final out.</p>' : ''}
        <div class="offer"><div><span class="sub">BAT</span><br>${slot('bat')}</div><button class="buy" data-ar="unequip" data-t="bat" ${busy || !L.bat ? 'disabled' : ''}>Unequip</button></div>
        <div class="offer"><div><span class="sub">BALL</span><br>${slot('ball')}</div><button class="buy" data-ar="unequip" data-t="ball" ${busy || !L.ball ? 'disabled' : ''}>Unequip</button></div>
        <h4 style="margin-top:14px">Locker</h4>${rows || '<p class="sub">Empty. Buy something from the shop.</p>'}
        ${id !== 'club' || !(S && S.cpu) ? '' : '<p class="sub">The CPU manager shops for this club before each game.</p>'}
      </section>
      <section class="card"><h4>Shop</h4>${shop}</section>
    </div>`;
}
const sellPrice = it => { const g = GEAR[it.id]; return Math.floor(g.price / 2 * (g.recharge ? 1 : it.uses / g.uses)); };
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-ar]'); if (!b || b.disabled) return;
  const a = b.dataset.ar;
  if (a === 'club') { AR.club = b.dataset.v; renderArmory(); return; }
  const id = AR.club, L = lockerOf(id); if (!L || clubBusy(id)) return;
  if (a === 'buy') { const g = GEAR[b.dataset.k]; if (purse(id) < g.price) return; spend(id, g.price); const it = newItem(b.dataset.k); L.items.push(it); if (!L[g.type]) L[g.type] = it.uid; }
  else if (a === 'equip') { const it = L.items.find(x => x.uid === b.dataset.u); if (it) L[GEAR[it.id].type] = it.uid; }
  else if (a === 'unequip') L[b.dataset.t] = null;
  else if (a === 'sell') { const it = L.items.find(x => x.uid === b.dataset.u); if (it) { spend(id, -sellPrice(it)); L.items = L.items.filter(x => x !== it); for (const t of ['bat', 'ball']) if (L[t] === it.uid) L[t] = null; } }
  saveLocker(id); renderArmory(); if (id === 'club' && typeof renderClub === 'function' && PAGE === 'season') renderClub();
});
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-arclub]'); if (a) { AR.club = a.dataset.arclub; renderArmory(); } });
function gearCardHTML() {
  const L = lockerOf('club'), eq = t => { const it = L.items.find(x => x.uid === L[t]); return it ? `${esc(GEAR[it.id].name)} (${it.uses}/${GEAR[it.id].uses})` : 'none'; };
  return `<section class="card"><h4>Magic bats and balls</h4><p class="sub">Equipped bat: <b>${eq('bat')}</b><br>Equipped ball: <b>${eq('ball')}</b><br>${L.items.length} piece${L.items.length === 1 ? '' : 's'} in the locker.</p>
      <p><a class="buy" href="#armory" data-page="armory" data-arclub="club" style="text-decoration:none">Open the Armory</a></p><p class="sub">Paid from the same gold as this market. Cheap gear runs out; the costly pieces recharge every game.</p></section>`;
}
try { renderSetupRules(); } catch (e) { }
// pages opened straight from the address bar rendered before these parts loaded: draw them again
try { if (PAGE === 'season') renderClub(); else if (PAGE === 'settings') renderSettings(); else if (PAGE === 'armory') renderArmory(); } catch (e) { }
