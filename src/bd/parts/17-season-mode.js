/* ================= season mode (roguelike gauntlet) ================= */
const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P'];
const STATS = ['pow', 'con', 'spd', 'arm', 'fld'];
const STAT_CAP = 12, SEASON_GAMES = 8, LIVES = 3, BENCH_MAX = 4;
const ITEMS = {
  boots:   { name: 'Boots of Haste',        price: 45, desc: '+2 SPD.', mod: { spd: 2 } },
  gaunt:   { name: 'Ogre-Grip Gauntlets',   price: 50, desc: '+2 POW.', mod: { pow: 2 } },
  owl:     { name: 'Owl-Eye Monocle',       price: 50, desc: '+2 CON.', mod: { con: 2 } },
  sling:   { name: 'Sling Bracer',          price: 40, desc: '+2 ARM.', mod: { arm: 2 } },
  glove:   { name: 'Troll-Hide Glove',      price: 40, desc: '+2 FLD.', mod: { fld: 2 } },
  cursed:  { name: 'Cursed Club',           price: 40, desc: '+3 POW, −1 CON. It whispers.', mod: { pow: 3, con: -1 } },
  amulet:  { name: 'Amulet of Endurance',   price: 45, desc: '+25 max stamina, 40% less fatigue from everything, and recovers faster between games.', flag: 'endure' },
  salve:   { name: 'Troll-Blood Salve',     price: 40, desc: 'Regenerates: +5 health every half-inning and heals 25 more between games.', flag: 'regen' },
  hourglass: { name: 'Hourglass of the Undying', price: 50, desc: 'Swings and spells cost this player no stamina. Pitches still do.', flag: 'noTire' },
  skull:   { name: 'Lucky Rabbit Skull',    price: 35, desc: '+3 on every d20 this player rolls.', flag: 'luck' },
  ring:    { name: 'Ring of Swiftcasting',  price: 55, desc: "This player's spells and magic pitches cost 1 less (min 1).", flag: 'discount' },
  chalice: { name: 'Mana Chalice',          price: 60, desc: 'Your club starts every game with +1 mana.', flag: 'chalice' },
};
const CLUB_PLACES = ['Cinderhollow', 'Gutterfen', 'Ashen Vale', 'Grimspire', 'Blackwater', 'Thornmoor', 'Hollowmere', 'Duskreach', 'Saltbarrow', 'Wormwood', 'Rattlecairn', 'Emberdeep'];
const CLUB_NAMES = ['Imps', 'Ghouls', 'Wyrms', 'Revenants', 'Gargoyles', 'Banshees', 'Bogles', 'Hexhounds', 'Cravens', 'Mandrakes', 'Barrow Kings', 'Nightjars'];
const CLUB_COLORS = [['#b8475e', '#f0a0b2'], ['#6f7fd8', '#b7c2ff'], ['#c9a13a', '#f5dc8a'], ['#7fb04a', '#c8ef9a'], ['#9b5fd0', '#d8b8ff'], ['#d07a3a', '#ffc393'], ['#4aa6c9', '#a8e6ff'], ['#c95a9d', '#ffb0de']];
const MOTTOS = ['Nothing is buried forever.', 'We play at midnight or not at all.', 'Three strikes and you are dinner.', 'The bog provides.', 'Bring your own bones.', 'Fear the ninth inning.', 'Our fans are mostly ghosts.', 'Win, or be sung about.'];
const SYL_A = ['Grim', 'Mog', 'Vex', 'Skar', 'Bram', 'Thal', 'Ul', 'Kraz', 'Nib', 'Sorn', 'Hask', 'Mire', 'Ash', 'Gor', 'Zil', 'Rot', 'Quill', 'Brak', 'Fen', 'Oss', 'Morg', 'Sly', 'Drub', 'Kett'];
const SYL_B = ['ak', 'ula', 'rik', 'mo', 'thar', 'gar', 'ix', 'wen', 'bone', 'ash', 'tooth', 'grin', 'ley', 'ra', 'ok', 'ith', 'nak', 'zo', 'mire', 'lock'];
const FLAVS = ['Signed for a sack of teeth.', 'Once struck out a lighthouse.', 'Claims to have invented the bunt.', 'Sleeps in the dugout. Possibly lives there.', 'Crowd favourite in three graveyards.', 'Hates day games. Hates the sun more.', 'Collects broken bats, and fingers.', 'Has never lost a staring contest.'];
const MAGIC_PITCHES = ['fireball', 'meteor', 'frost', 'hex', 'phantom'];

// ability kit per creature kind, taken from the two founding clubs
const TEMPL = {};
for (const t of Object.values(TEAMS)) for (const p of t.roster) TEMPL[p.kind] = p;
const KINDS = Object.keys(TEMPL);

let S = null; // the season save
const uid = () => Math.random().toString(36).slice(2, 9);
const xpNeed = l => 20 * l * (l + 1) / 2;
// saveSeason / loadSeason live with the save system below

function makeSP(src, over = {}) {
  return {
    id: uid(), n: src.n, kind: src.kind, race: src.race, pos: src.pos, num: src.num, hand: src.hand, wpn: src.wpn,
    pow: src.pow, con: src.con, spd: src.spd, arm: src.arm, fld: src.fld, bat: src.bat || null, run: src.run || null, field: src.field || null,
    pitches: src.pitches ? src.pitches.slice() : null, flav: src.flav, tiers: { bat: 1, run: 1, field: 1, pitch: 1 },
    lvl: 1, xp: 0, pts: 0, item: null, sta: 100, hp: 100, ult: src.ult || ULT_BY_KIND[src.kind] || null, ck: src.ck || null, ...over,
  };
}
function genName(taken) { for (let i = 0; i < 40; i++) { const n = pick(SYL_A) + pick(SYL_B); if (!taken.has(n)) { taken.add(n); return n[0].toUpperCase() + n.slice(1); } } return 'Nameless ' + ((R() * 99) | 0); }
function genPlayer(level, pos, taken, kind) {
  const T = TEMPL[kind || pick(KINDS)];
  const p = makeSP(T, { n: genName(taken), pos, num: (R() * 99) | 0, hand: R() < .6 ? 'R' : 'L', flav: pick(FLAVS), ck: null });
  for (const s of STATS) p[s] = clamp(Math.round(T[s] + (R() * 2 - 1) * 1.6 + level * .45), 1, STAT_CAP);
  if (pos === 'P') {
    if (!p.pitches) {
      const m = MAGIC_PITCHES.slice().sort(() => R() - .5);
      p.pitches = [pick(['heater', 'fastball']), pick(['slider', 'curve']), 'change', ...m.slice(0, 1 + (R() < .5 ? 1 : 0))];
    }
    p.arm = clamp(p.arm + 1, 1, STAT_CAP);
  }
  const tierUp = () => (level >= 6 && R() < .5 ? 3 : level >= 3 && R() < .55 ? 2 : 1);
  p.tiers = { bat: tierUp(), run: tierUp(), field: tierUp(), pitch: tierUp() };
  p.lvl = 1 + Math.floor(level / 2);
  return p;
}
function genClub(level, taken) {
  const used = new Set(S ? S.opp.map(o => o.name) : []);
  let name; for (let i = 0; i < 30; i++) { name = `${pick(CLUB_PLACES)} ${pick(CLUB_NAMES)}`; if (!used.has(name)) break; }
  const [color, light] = pick(CLUB_COLORS);
  const players = POSITIONS.map(pos => genPlayer(level, pos, taken));
  const order = players.filter(p => p.pos !== 'P').sort((a, b) => (b.spd + b.con) - (a.spd + a.con)).slice(0, 2);
  const rest = players.filter(p => !order.includes(p)).sort((a, b) => (b.pow - a.pow) || (a.pos === 'P' ? 1 : -1));
  const pen = level >= 2 ? [genPlayer(level, 'P', taken)] : [];
  return { id: 'opp' + uid(), name, short: name.split(' ').slice(-1)[0].slice(0, 3).toUpperCase(), color, trim: '#141014', light, motto: pick(MOTTOS), level, roster: [...order, ...rest.filter(p => p.pos !== 'P'), rest.find(p => p.pos === 'P')], pen };
}
function clubFromTeam(t, level, taken) {
  const roster = t.roster.map(p => { taken.add(p.n); const sp = makeSP(p); for (const s of STATS) sp[s] = clamp(sp[s] + Math.round(level * .45), 1, STAT_CAP); return sp; });
  return { id: 'opp' + uid(), name: t.name, short: t.short, color: t.color, trim: t.trim, light: t.light, motto: t.motto, level, roster, pen: [genPlayer(level, 'P', taken)] };
}
function allStars(taken) {
  const best = {};
  for (const t of Object.values(TEAMS)) for (const p of t.roster) { const v = STATS.reduce((a, s) => a + p[s], 0); if (!best[p.pos] || v > best[p.pos].v) best[p.pos] = { p, v }; }
  const roster = Object.values(best).map(o => { const sp = makeSP(o.p); for (const s of STATS) sp[s] = clamp(sp[s] + 3, 1, STAT_CAP); sp.tiers = { bat: 3, run: 3, field: 3, pitch: 3 }; return sp; });
  roster.sort((a, b) => (a.pos === 'P') - (b.pos === 'P') || (b.spd + b.con) - (a.spd + a.con));
  return { id: 'allstars', name: 'Brimstone All-Stars', short: 'BAS', color: '#e8e2cf', trim: '#1a1216', light: '#ffb547', motto: 'The final. Nobody has beaten them twice.', level: 8, final: true, roster, pen: [genPlayer(7, 'P', taken), genPlayer(7, 'P', taken)] };
}

function newSeason(teamId) {
  const t = getTeam(teamId), other = TEAMS[teamId === 'ironmaw' ? 'mirewood' : 'ironmaw'];
  const taken = new Set();
  S = { v: 1, active: true, over: null, teamId, club: { id: 'club', name: t.name, short: t.short, color: t.color, trim: t.trim, light: t.light, motto: t.motto, css: t.css },
    players: [], lineup: [], bench: [], gold: 60, essence: 2, font: 0, game: 0, wins: 0, losses: 0, lives: LIVES, opp: [], inv: [], market: null, log: [], sel: null, innings: 3, diff: 1, pendingSummary: null };
  for (const p of t.roster) { taken.add(p.n); const sp = makeSP(p); S.players.push(sp); S.lineup.push({ id: sp.id, pos: p.pos }); }
  const rel = genPlayer(0, 'P', taken); rel.ck = 'gen:' + rel.id; S.players.push(rel); S.bench.push(rel.id);
  for (let i = 0; i < SEASON_GAMES; i++) {
    if (i === SEASON_GAMES - 1) S.opp.push(allStars(taken));
    else if (i === 3) S.opp.push(clubFromTeam(other, i, taken));
    else S.opp.push(genClub(i, taken));
  }
  S.taken = [...taken];
  rollMarket();
  seasonLog(`A new season begins. ${t.name} take on the gauntlet: ${SEASON_GAMES} clubs, ${LIVES} losses and you're out.`);
  saveSeason();
}
const SP = id => S.players.find(p => p.id === id);
function seasonLog(t) { S.log.unshift(t); S.log = S.log.slice(0, 30); }
function pval(p) { return STATS.reduce((a, s) => a + p[s], 0) + (p.lvl - 1) * 3 + (p.bat ? 2 : 0) + (p.run ? 2 : 0) + (p.field ? 2 : 0) + (p.pitches ? 4 : 0) + Object.values(p.tiers).reduce((a, t) => a + (t - 1) * 3, 0); }
function rollMarket() {
  const taken = new Set(S.taken || []);
  const lvl = Math.min(7, S.game + 1);
  const items = Object.keys(ITEMS).sort(() => R() - .5).slice(0, 3);
  const agents = [0, 1, 2, 3, 4].map(i => { const pos = i === 0 ? 'P' : pick(POSITIONS.slice(0, 8)); const p = genPlayer(lvl, pos, taken); return { p, price: Math.round(18 + pval(p) * .9) }; });
  // trade offers from upcoming clubs: one of theirs for one of yours of similar value
  const trades = [];
  const future = S.opp.slice(S.game + 1, SEASON_GAMES - 1);
  const mine = S.players.filter(p => p.pos !== 'P' || S.players.filter(q => q.pitches).length > 1);
  for (let k = 0; k < 2 && future.length && mine.length; k++) {
    const club = pick(future), theirs = pick(club.roster.filter(p => p.pos !== 'P'));
    const yours = mine.slice().sort((a, b) => Math.abs(pval(a) - pval(theirs) * .95) - Math.abs(pval(b) - pval(theirs) * .95))[k % 2 === 0 ? 0 : 1] || mine[0];
    if (theirs && yours && !trades.some(t => t.yours === yours.id)) trades.push({ club: club.id, theirs: theirs.id, yours: yours.id });
  }
  S.market = { items: items.map(k => ({ k, sold: false })), agents, trades, shrineUsed: false };
  S.taken = [...taken];
}

/* ---------- turning season players into players on the field ---------- */
function effPlayer(sp, slotPos, fromOpp) {
  const it = sp.item ? ITEMS[sp.item] : null, g = { ...sp, pos: slotPos, src: sp };
  if (it && it.mod) for (const s in it.mod) g[s] += it.mod[s];
  if (it && it.flag === 'endure') g.endure = true;
  if (it && it.flag === 'luck') g.luck = 3;
  if (it && it.flag === 'discount') g.discount = 1;
  if (it && it.flag === 'noTire') g.noTire = true;
  if (it && it.flag === 'regen') g.regen = true;
  if (!g.ult) g.ult = ULT_BY_KIND[g.kind] || null;
  g.hp = sp.hp ?? 100;
  if (!fromOpp && slotPos !== 'P') {
    const t = sp.sta; if (t < 35) { g.spd -= 2; g.con -= 2; } else if (t < 60) { g.spd -= 1; g.con -= 1; }
    if (slotPos !== sp.pos && slotPos !== 'DH') g.fld -= 2;
  }
  for (const s of STATS) g[s] = clamp(g[s], 1, STAT_CAP);
  g.fresh = fromOpp ? 1 : Math.max(.15, sp.sta / 100);
  if (slotPos === 'P' && !g.pitches) g.pitches = ['fastball', 'change', 'curve'];
  return g;
}
function lineupProblems() {
  const probs = [];
  const pos = S.lineup.map(l => l.pos);
  for (const p of POSITIONS) if (!pos.includes(p)) probs.push(`Nobody is playing ${p}.`);
  const dup = pos.filter((p, i) => pos.indexOf(p) !== i); if (dup.length) probs.push(`Two players are set at ${[...new Set(dup)].join(', ')}.`);
  const pl = S.lineup.find(l => l.pos === 'P'); if (pl && !SP(pl.id).pitches) probs.push(`${SP(pl.id).n} has no pitches and can't take the mound.`);
  return probs;
}
function clubDef() {
  const roster = S.lineup.map(l => effPlayer(SP(l.id), l.pos));
  const pen = S.bench.map(SP).filter(p => p.pitches).map(p => effPlayer(p, 'RP'));
  const chal = S.players.some(p => p.item === 'chalice') ? 1 : 0;
  return { ...S.club, roster, pen, manaBonus: S.font + chal };
}
function oppDef(o) { return { ...o, roster: o.roster.map(p => effPlayer(p, p.pos, true)), pen: o.pen.map(p => effPlayer(p, 'RP', true)), manaBonus: o.final ? 1 : 0 }; }
function quickPen(def, innings) {
  const taken = new Set(def.roster.map(p => p.n)), n = innings >= 9 ? 2 : 1, out = [];
  for (let i = 0; i < n; i++) { const p = genPlayer(1, 'P', taken); out.push({ ...p, pos: 'RP' }); }
  return out;
}

function startSeasonGame(quiet) {
  if (!S || !S.active) return;
  const probs = lineupProblems(); if (probs.length) { renderClub(); return; }
  const o = S.opp[S.game], home = S.game % 2 === 1; // alternate home and away
  const mine = clubDef(), theirs = oppDef(o);
  const diff = o.final ? 2 : o.level <= 1 ? 0 : o.level <= 4 ? 1 : 2;
  const opts = S.cpu ? { mode: 'demo', defs: home ? [theirs, mine] : [mine, theirs], innings: S.innings, diff, season: true } : { mode: '1p', defs: home ? [theirs, mine] : [mine, theirs], humanSide: home ? 1 : 0, innings: S.innings, diff, season: true };
  document.getElementById('menu').hidden = true; document.getElementById('over').hidden = true; document.getElementById('sOver').hidden = true;
  PL = null; G.opts = opts; newGame(opts); seasonLiveSave();
  if (!quiet) showPage('play');
}

/* ---------- after the final out ---------- */
function seasonAfterGame() {
  const side = G.teams.findIndex(t => t.def.id === 'club'); const me = G.teams[side], them = G.teams[1 - side];
  const won = me.R > them.R, o = S.opp[S.game];
  const gold = (won ? 40 : 15) + 3 * me.R + (o.final && won ? 100 : 0);
  const ess = Math.max(0, me.mana) + 1 + (won ? 1 : 0);
  S.gold += gold; S.essence += ess;
  const lines = [];
  // XP and fatigue
  const played = new Map();
  for (const g of [...me.def.roster, ...me.used]) played.set(g.src.id, g);
  for (const sp of S.players) {
    const g = played.get(sp.id);
    if (g) {
      const st = G.pstats.get(g) || { h: 0, hr: 0, r: 0, k: 0, outs: 0 };
      const xp = 8 + st.h * 6 + st.hr * 10 + st.r * 4 + st.k * 5 + st.outs * 2 + (won ? 5 : 0);
      sp.xp += xp; let ups = 0;
      while (sp.xp >= xpNeed(sp.lvl)) { sp.lvl++; sp.pts += 2; ups++; }
      const bits = []; if (st.h) bits.push(`${st.h} H`); if (st.hr) bits.push(`${st.hr} HR`); if (st.r) bits.push(`${st.r} R`); if (st.k) bits.push(`${st.k} K`); if (st.outs) bits.push(`${st.outs} outs`);
      lines.push({ n: sp.n, xp, ups, lvl: sp.lvl, bits: bits.join(', ') });
      // whatever stamina they finished with carries into the next game
      sp.sta = Math.min(sp.sta, 100 * fatigue(g)) - (g.pos === 'C' ? 8 : g.pos === 'P' || g.pos === 'RP' ? 4 : 5);
      sp.hp = clamp((g.hp ?? 100) + (typeof INJ !== 'undefined' && INJ ? INJ.heal[injLevel()] : 40) + (sp.item === 'salve' ? 25 : 0) + (sp.kind === 'troll' ? 20 : 0), 5, 100);
    } else { sp.sta += 28; sp.hp = Math.min(100, (sp.hp ?? 100) + 60); }
    sp.sta = clamp(sp.sta + 12 + (sp.item === 'amulet' ? 10 : 0) + Math.round((sp.pow + sp.arm) / 5), 5, 100);
  }
  try { injAfterSeasonGame(played); } catch (e) { }
  const res = won ? 'W' : 'L';
  if (won) S.wins++; else { S.losses++; S.lives--; }
  recordSeasonGame(me, them, o, won, gold, ess, lines);
  seasonLog(`${won ? 'Beat' : 'Lost to'} the ${o.name} ${me.R}-${them.R}. +${gold} gold, +${ess} essence.`);
  let verdict = '';
  if (o.final && won) { S.active = false; S.over = 'champion'; verdict = 'Champions of the Brimstone Cup!'; seasonLog('Won the Brimstone Cup.'); }
  else if (S.lives <= 0) { S.active = false; S.over = 'out'; verdict = `Eliminated in game ${S.game + 1}.`; seasonLog('Out of lives. The run is over.'); }
  else if (won || !o.final) { S.game = Math.min(SEASON_GAMES - 1, S.game + 1); }
  if (S.over) archiveRun(S.over);
  if (S.active) rollMarket();
  S.pendingSummary = null; S.live = null;
  saveSeason();
  // results overlay
  const el = document.getElementById('sOver');
  document.getElementById('sOverTitle').textContent = verdict || (won ? `Victory, ${me.R}-${them.R}` : `Defeat, ${me.R}-${them.R}`);
  document.getElementById('sOverSub').textContent = `${won ? 'You beat' : 'You fell to'} the ${o.name}. +${gold} gold · +${ess} essence (${Math.max(0, me.mana)} from leftover mana)${!won && S.active ? ` · ${S.lives} ${S.lives === 1 ? 'life' : 'lives'} left` : ''}${!won && o.final && S.active ? ' · the final must be replayed' : ''}`;
  document.getElementById('sOverXP').innerHTML = lines.map(l => `<li><b>${esc(l.n)}</b> +${l.xp} XP${l.ups ? ` <span class="up">Level ${l.lvl}! +${l.ups * 2} stat points</span>` : ''}${l.bits ? ` <i>${esc(l.bits)}</i>` : ''}</li>`).join('');
  el.hidden = !!G.sim;
  renderClub(); updateSeasonTab();
  if (typeof cpuAfterResult === 'function') cpuAfterResult();
}

/* ---------- clubhouse actions ---------- */
function actSeason(act, a, b) {
  if (saveAct(act, a)) return;
  if (!S) return;
  const sel = S.sel ? SP(S.sel) : null;
  switch (act) {
    case 'select': S.sel = a; break;
    case 'up': case 'down': { const i = S.lineup.findIndex(l => l.id === a), j = act === 'up' ? i - 1 : i + 1; if (j >= 0 && j < S.lineup.length) [S.lineup[i], S.lineup[j]] = [S.lineup[j], S.lineup[i]]; break; }
    case 'pos': { const l = S.lineup.find(l => l.id === a); if (l) { const clash = S.lineup.find(x => x.pos === b && x.id !== a); if (clash) clash.pos = l.pos; l.pos = b; } break; }
    case 'sub': { // bench player b replaces starter a
      const i = S.lineup.findIndex(l => l.id === a), bi = S.bench.indexOf(b); if (i < 0 || bi < 0) break;
      S.bench[bi] = a; S.lineup[i] = { id: b, pos: S.lineup[i].pos }; break;
    }
    case 'stat': if (sel && sel.pts > 0 && sel[a] < STAT_CAP) { sel[a]++; sel.pts--; } break;
    case 'enhance': { if (!sel) break; const t = sel.tiers[a] || 1, cost = t === 1 ? 3 : 6; if (t < 3 && S.essence >= cost) { S.essence -= cost; sel.tiers[a] = t + 1; seasonLog(`${sel.n}'s ${a === 'pitch' ? 'magic pitches' : AB[sel[a]].name} rose to tier ${'I'.repeat(t + 1)}.`); } break; }
    case 'equip': { if (!sel) break; const k = S.inv[+a]; if (k == null) break; if (sel.item) S.inv.push(sel.item); sel.item = k; S.inv.splice(+a, 1); break; }
    case 'unequip': if (sel && sel.item) { S.inv.push(sel.item); sel.item = null; } break;
    case 'buyItem': { const m = S.market.items[+a], it = ITEMS[m.k]; if (!m.sold && S.gold >= it.price) { S.gold -= it.price; m.sold = true; S.inv.push(m.k); seasonLog(`Bought the ${it.name}.`); } break; }
    case 'sign': { const ag = S.market.agents[+a]; if (!ag || ag.signed || S.gold < ag.price || S.bench.length >= BENCH_MAX) break; S.gold -= ag.price; ag.signed = true; const p = { ...ag.p, id: uid() }; p.ck = 'gen:' + p.id; S.players.push(p); S.bench.push(p.id); seasonLog(`Signed free agent ${p.n}, ${p.race}.`); break; }
    case 'trade': {
      const tr = S.market.trades[+a]; if (!tr || tr.done) break;
      const club = S.opp.find(o => o.id === tr.club); const ti = club && club.roster.findIndex(p => p.id === tr.theirs); const yours = SP(tr.yours);
      if (!club || ti < 0 || !yours) break;
      const theirs = club.roster[ti];
      const incoming = { ...theirs, id: uid(), sta: 100, xp: 0, pts: 0, item: null }; if (!incoming.ck) incoming.ck = 'gen:' + incoming.id;
      const outgoing = { ...yours, pos: theirs.pos, item: null };
      club.roster[ti] = outgoing;
      if (yours.item) S.inv.push(yours.item);
      S.players = S.players.filter(p => p.id !== yours.id); S.players.push(incoming);
      const li = S.lineup.findIndex(l => l.id === yours.id);
      if (li >= 0) S.lineup[li] = { id: incoming.id, pos: S.lineup[li].pos }; else S.bench[S.bench.indexOf(yours.id)] = incoming.id;
      tr.done = true; S.sel = incoming.id;
      seasonLog(`Traded ${yours.n} to the ${club.name} for ${incoming.n}.`); break;
    }
    case 'release': { if (!sel || !S.bench.includes(sel.id)) break; S.bench = S.bench.filter(id => id !== sel.id); S.players = S.players.filter(p => p.id !== sel.id); if (sel.item) S.inv.push(sel.item); S.gold += 10; seasonLog(`Released ${sel.n}. +10 gold.`); S.sel = null; break; }
    case 'font': if (S.essence >= 6 && S.font < 2) { S.essence -= 6; S.font++; seasonLog(`The mana well deepens: +${S.font} starting mana.`); } break;
    case 'rest': if (!S.market.shrineUsed && S.gold >= 25) { S.gold -= 25; S.market.shrineUsed = true; for (const p of S.players) { p.sta = Math.min(100, p.sta + 35); p.hp = Math.min(100, (p.hp ?? 100) + 30); }; seasonLog('Held a recovery ritual. Everyone feels fresher.'); } break;
    case 'train': if (sel && S.gold >= 20) { S.gold -= 20; sel.xp += 25; while (sel.xp >= xpNeed(sel.lvl)) { sel.lvl++; sel.pts += 2; } } break;
    case 'innings': S.innings = +a; break;
    case 'abandon': if (S.confirmAbandon) { if (S.hist && S.hist.games.length) archiveRun('abandoned'); S = null; saveSeason(); renderClub(); updateSeasonTab(); return; } S.confirmAbandon = true; renderClub(); setTimeout(() => { if (S) { S.confirmAbandon = false; renderClub(); } }, 3500); return;
    case 'newrun': { const t = S.teamId; newSeason(t); break; }
    case 'play': startSeasonGame(); return;
    case 'cpuwatch': if (CPU_MGR) { CPU_MGR = null; cpuNextGame('watch', true); } else cpuBetweenGames(true); return;
    case 'cpusim': cpuNextGame('sim'); return;
    case 'cpusimall': simRestOfSeason(); return;
    case 'cpumgr': S.cpu = !S.cpu; if (!S.cpu) SIM_RUNNING = false; break;
    case 'autonext': S.autoNext = !S.autoNext; break;
  }
  saveSeason(); renderClub();
}

/* ---------- clubhouse page ---------- */
const bar = (v, max, cls) => `<span class="bar ${cls || ''}"><i style="width:${clamp(v / max * 100, 0, 100).toFixed(0)}%"></i></span>`;
const staCls = v => v > 60 ? 'ok' : v > 35 ? 'warn' : 'bad';
const gem = n => `<span class="mn">${'◆'.repeat(n)}</span>`;
function renderClub() {
  const el = document.getElementById('club'); if (!el) return;
  if (!S) {
    el.innerHTML = savesCardWrap() + `<h2 class="pgh">Clubhouse</h2><p class="lede2">No season in progress. Pick <strong>Season</strong> in the setup on the Play page, choose your club and press Play ball (innings come from Settings) to start a run: ${SEASON_GAMES} escalating rivals, the Brimstone All-Stars waiting at the end, and ${LIVES} losses before you're out.</p><p><a class="go" href="#play" data-page="play" style="text-decoration:none;display:inline-block">Go to setup</a></p>`;
    return;
  }
  const o = S.opp[S.game], probs = lineupProblems(), sel = S.sel ? SP(S.sel) : null, club = S.club;
  const lives = '♥'.repeat(Math.max(0, S.lives)) + '♡'.repeat(LIVES - Math.max(0, S.lives));
  const ladder = S.opp.map((c, i) => `<li class="${i < S.game || (S.over === 'champion' && i === S.game) ? 'done' : i === S.game ? 'now' : ''}${c.final ? ' final' : ''}"><b>${i + 1}</b><span>${esc(c.name)}</span><em>Lv ${c.level}${typeof clubRating === 'function' && LEAGUES ? ' ' + lgBadge(clubRating(c)) : ''}</em></li>`).join('');
  const row = (l, i) => {
    const p = SP(l.id), off = l.pos !== p.pos && !(l.pos === 'P' && p.pitches);
    return `<tr class="${S.sel === p.id ? 'sel' : ''}">
      <td class="ord">${i + 1}</td>
      <td><button class="lnk" data-act="select" data-a="${p.id}">${esc(p.n)}</button><div class="sub">${esc(p.race)} · Lv ${p.lvl}${p.pts ? ` · <span class="pts">${p.pts} pts</span>` : ''}${p.item ? ' · ✦' : ''}</div></td>
      <td><select data-act="pos" data-a="${p.id}" aria-label="Position for ${esc(p.n)}">${POSITIONS.map(x => `<option ${x === l.pos ? 'selected' : ''}>${x}</option>`).join('')}</select>${off ? `<div class="sub warnt">plays ${p.pos}${l.pos === 'P' ? '' : ' · −2 FLD'}</div>` : ''}</td>
      <td>${bar(p.sta, 100, staCls(p.sta))}<br>${bar(p.hp ?? 100, 100, 'hp')}${injuredOut(p) ? ` <span class="warnt">${p.out && p.out.games ? `injured · out ${p.out.games}` : 'too hurt to play'}</span>` : (p.hp ?? 100) < 60 ? ' <span class="warnt">hurt</span>' : ''}</td>
      <td class="nowrap"><button class="ic" data-act="up" data-a="${p.id}" aria-label="Move up">▲</button><button class="ic" data-act="down" data-a="${p.id}" aria-label="Move down">▼</button></td>
      <td>${S.bench.length ? `<select data-act="sub" data-a="${p.id}" aria-label="Substitute for ${esc(p.n)}"><option value="">Sub in…</option>${S.bench.map(id => { const b = SP(id); return `<option value="${b.id}">${esc(b.n)} (${b.pos})</option>`; }).join('')}</select>` : ''}</td>
    </tr>`;
  };
  const benchRows = S.bench.map(id => { const p = SP(id); return `<tr class="${S.sel === p.id ? 'sel' : ''}"><td class="ord">·</td><td><button class="lnk" data-act="select" data-a="${p.id}">${esc(p.n)}</button><div class="sub">${esc(p.race)} · ${p.pos}${p.pitches ? ' · in the bullpen' : ''} · Lv ${p.lvl}${p.pts ? ` · <span class="pts">${p.pts} pts</span>` : ''}</div></td><td colspan="2">${bar(p.sta, 100, staCls(p.sta))}</td><td colspan="2" class="sub">resting +28 stamina a game</td></tr>`; }).join('');
  const detail = sel ? playerDetail(sel) : `<div class="card"><p class="sub">Pick a player's name to train stats, enhance powers and equip items.</p></div>`;
  const mk = S.market;
  el.innerHTML = `
  <div class="clubhead">
    <div><h2 class="pgh">${esc(club.name)}</h2><p class="lede2" style="margin-bottom:0">${esc(club.motto)}</p></div>
    <div class="chips">
      <span class="chip"><em>Record</em>${S.wins}–${S.losses}</span>
      <span class="chip life"><em>Lives</em>${lives}</span>
      <span class="chip gold"><em>Gold</em>${S.gold}</span>
      <span class="chip ess"><em>Essence</em>${S.essence}</span>
      <span class="chip"><em>Mana well</em>+${S.font}</span>
      ${typeof clubRating === 'function' && LEAGUES ? (() => { const r = clubRating('club'); return r ? `<span class="chip" title="Roster ${r.parts.roster} · gear ${r.parts.gear} · gold ${r.parts.gold} · items ${r.parts.items} · record ${r.parts.record}"><em>League</em><span style="color:${r.league.col}">${r.league.short} ${r.rating}</span></span>` : ''; })() : ''}
    </div>
  </div>
  ${S.over ? `<div class="card verdict ${S.over}"><h3>${S.over === 'champion' ? 'Champions of the Brimstone Cup' : 'The run is over'}</h3><p>${S.over === 'champion' ? `Undefeated in the final, ${S.wins}–${S.losses} overall.` : `Eliminated after ${S.wins} wins. The All-Stars are still waiting.`}</p><button class="go" data-act="newrun">Start a new run</button></div>` : `
  <div class="card next">
    <div><h4>Game ${S.game + 1} of ${SEASON_GAMES}${o.final ? ' · The final' : ''} · ${S.game % 2 ? 'at home' : 'on the road'}</h4>
      <h3 style="color:${o.color}">${esc(o.name)}</h3><p class="sub">${esc(o.motto)} Level ${o.level}. Keep an eye on ${o.roster.slice().sort((a, b) => pval(b) - pval(a)).slice(0, 2).map(p => `${esc(p.n)} (${esc(p.race)}, ${p.pos})`).join(' and ')}.</p></div>
    ${S.live ? `<div class="playbox"><p class="sub">Game in progress: ${esc(liveLine())}</p><button class="go" data-act="resume">Resume game</button></div>` : `<div class="playbox">
      <label class="sub">Innings <select data-act="innings">${[3, 5, 9].map(n => `<option ${n === S.innings ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${S.cpu ? `<div class="row"><button class="go" data-act="cpuwatch" ${probs.length || SIM_RUNNING ? 'disabled' : ''}>Watch game ${S.game + 1}</button><button class="buy" data-act="cpusim" ${SIM_RUNNING ? 'disabled' : ''}>Simulate it</button><button class="buy" data-act="cpusimall" ${SIM_RUNNING ? 'disabled' : ''}>${SIM_RUNNING ? 'Simulating…' : 'Simulate the rest'}</button></div>
      <label class="sub"><input type="checkbox" data-act="autonext" ${S.autoNext ? 'checked' : ''}> Keep going after each watched game</label>` : `<button class="go" data-act="play" ${probs.length ? 'disabled' : ''}>Play game ${S.game + 1}</button>`}
      <label class="sub"><input type="checkbox" data-act="cpumgr" ${S.cpu ? 'checked' : ''}> The CPU manages this club${S.cpu ? ': it spends points, essence and gold, signs players and rests the tired before every game' : ''}</label>
      ${probs.length ? `<p class="warnt">${probs.map(esc).join(' ')}</p>` : ''}
    </div>`}
  </div>`}
  <ol class="ladder">${ladder}</ol>
  <div class="clubgrid">
    <section class="card">
      <h3>Lineup</h3>
      <p class="sub">Batting order top to bottom. Tired players (low stamina bar) lose speed and contact; sit them to recover. Pitchers on the bench are your bullpen: press C in a game to bring one in.</p>
      <div class="tablewrap"><table class="lu"><thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Stamina</th><th>Order</th><th>Bench</th></tr></thead>
      <tbody>${S.lineup.map(row).join('')}</tbody>
      <tbody class="bench"><tr><th colspan="6">Bench (${S.bench.length}/${BENCH_MAX})</th></tr>${benchRows || '<tr><td colspan="6" class="sub">Nobody on the bench. Sign a free agent below.</td></tr>'}</tbody></table></div>
    </section>
    <section>${detail}</section>
  </div>
  ${S.active ? `
  ${DG_READY ? (() => { try { return dungeonHTML(); } catch (e) { return ''; } })() : ''}
  <h3 style="margin-top:28px">Market</h3>
  <div class="market">
    ${typeof gearCardHTML === 'function' && GEAR ? gearCardHTML() : ''}
    <section class="card"><h4>Magic items</h4>${mk.items.map((m, i) => { const it = ITEMS[m.k]; return `<div class="offer"><div><b>${esc(it.name)}</b><div class="sub">${esc(it.desc)}</div></div><button class="buy" data-act="buyItem" data-a="${i}" ${m.sold || S.gold < it.price ? 'disabled' : ''}>${m.sold ? 'Sold' : it.price + 'g'}</button></div>`; }).join('')}
      <p class="sub">Bought items go to your satchel; equip them from a player's card.</p></section>
    <section class="card"><h4>Front office: free agents</h4>${mk.agents.map((ag, i) => `<div class="offer ag"><img class="por sm" alt="" src="${portraitURL(ag.p, S.club)}"><div><b>${esc(ag.p.n)}</b> <span class="sub">${esc(ag.p.race)} · ${ag.p.pos}</span><div class="sub">${STATS.map(s => `${s.toUpperCase()} ${ag.p[s]}`).join(' · ')}</div><div class="sub">${[ag.p.bat, ag.p.run, ag.p.field].filter(Boolean).map(k => AB[k].name).join(', ')}${ag.p.pitches ? (ag.p.bat || ag.p.run || ag.p.field ? ' · ' : '') + ag.p.pitches.map(k => PITCHES[k].name).join(', ') : ''}</div></div><button class="buy" data-act="sign" data-a="${i}" ${ag.signed || S.gold < ag.price || S.bench.length >= BENCH_MAX ? 'disabled' : ''}>${ag.signed ? 'Signed' : ag.price + 'g'}</button></div>`).join('')}
      <p class="sub">${S.bench.length >= BENCH_MAX ? 'Bench is full: release someone first (pick him, then Release on his card).' : 'Signed players join the bench.'}</p>
      <p><button class="buy" data-fo="scout" ${S.gold < 15 ? 'disabled' : ''}>Scout new prospects · 15g</button> <span class="sub">Replaces the unsigned free agents.</span></p></section>
    ${typeof frontOfficeHTML === 'function' && FO_READY ? (() => { try { return frontOfficeHTML(); } catch (e) { return ''; } })() : ''}
    <section class="card"><h4>Trade offers</h4>${mk.trades.length ? mk.trades.map((tr, i) => { const club = S.opp.find(o => o.id === tr.club), th = club && club.roster.find(p => p.id === tr.theirs), yo = SP(tr.yours); if (!th || !yo) return ''; return `<div class="offer"><div><div class="sub">The ${esc(club.name)} offer</div><b>${esc(th.n)}</b> <span class="sub">${esc(th.race)} · ${th.pos} · ${STATS.map(s => th[s]).join('/')}</span><div class="sub">for your <b>${esc(yo.n)}</b> (${yo.pos} · ${STATS.map(s => yo[s]).join('/')}${yo.lvl > 1 ? ` · Lv ${yo.lvl}` : ''})</div></div><button class="buy" data-act="trade" data-a="${i}" ${tr.done ? 'disabled' : ''}>${tr.done ? 'Done' : 'Accept'}</button></div>`; }).join('') : '<p class="sub">No offers this week.</p>'}
      <p class="sub">Stats shown as POW/CON/SPD/ARM/FLD. Traded players arrive fresh.</p></section>
    <section class="card"><h4>The shrine</h4>
      <div class="offer"><div><b>Deepen the mana well</b><div class="sub">+1 starting mana every game (max +2). Costs 6 essence.</div></div><button class="buy" data-act="font" ${S.essence < 6 || S.font >= 2 ? 'disabled' : ''}>6 ✧</button></div>
      <div class="offer"><div><b>Recovery ritual</b><div class="sub">Everyone regains 35 stamina. Once per week.</div></div><button class="buy" data-act="rest" ${mk.shrineUsed || S.gold < 25 ? 'disabled' : ''}>${mk.shrineUsed ? 'Done' : '25g'}</button></div>
      <p class="sub">Essence comes from the mana your club still holds when a game ends, plus 1 per game and 1 more per win. Spend it on a player's card to enhance powers.</p></section>
  </div>` : ''}
  <div style="margin-top:24px">${savesCard()}</div>
  <div class="clubfoot"><p><a class="buy" href="#records" data-page="records" style="text-decoration:none">Season history and records</a></p><section><h4>Season log</h4><ul class="slog">${S.log.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
  ${S.active ? `<p><button class="ghost" data-act="abandon">${S.confirmAbandon ? 'Click again to abandon this run' : 'Abandon run'}</button></p>` : ''}</div>`;
}
function playerDetail(p) {
  const need = xpNeed(p.lvl), prev = xpNeed(p.lvl - 1);
  const abRow = (type, id) => {
    const t = p.tiers[type] || 1, cost = t === 1 ? 3 : 6, name = type === 'pitch' ? 'Magic pitches' : AB[id].name, desc = type === 'pitch' ? 'Tier II: magic pitches cost 1 less. Tier III: they also land 25% more accurately.' : AB[id].desc;
    const passive = type !== 'pitch' && AB[id].passive;
    return `<div class="abrow"><div><span class="ty">${type.toUpperCase()}</span> <b>${esc(name)}</b> <span class="tier">${'I'.repeat(t)}</span><div class="sub">${esc(desc)}</div></div>${passive ? '' : `<button class="buy" data-act="enhance" data-a="${type}" ${t >= 3 || S.essence < cost ? 'disabled' : ''}>${t >= 3 ? 'Max' : cost + ' ✧'}</button>`}</div>`;
  };
  const skills = ['bat', 'run', 'field'].map(k => physOf(p, k)).filter(Boolean).map(id => `<div class="abrow"><div><span class="ty">SKILL</span> <b>${esc(AB[id].name)}</b> <span class="stm">⚡${AB[id].stam} stamina</span><div class="sub">${esc(AB[id].desc)}</div></div></div>`).join('');
  const ultId = p.ult || ULT_BY_KIND[p.kind];
  const abs = [ultId && `<div class="abrow"><div><span class="ty">ULT</span> <b>${esc(AB[ultId].name)}</b> <span class="mn">◆◆◆</span> <span class="sub">once a game${ULT[ultId].role === 'pitch' ? ' · a pitch' : ULT[ultId].role === 'bat' ? ' · a batting stance' : ULT[ultId].role === 'run' ? ' · while running' : ' · while fielding'}</span><div class="sub">${esc(AB[ultId].desc)}</div></div></div>`, p.bat && abRow('bat', p.bat), p.run && abRow('run', p.run), p.field && abRow('field', p.field), p.pitches && p.pitches.some(k => PITCHES[k].magic) && abRow('pitch')].filter(Boolean).join('');
  const it = p.item ? ITEMS[p.item] : null;
  return `<div class="card pdet">
    <header><img class="por" alt="Portrait of ${esc(p.n)}" src="${portraitURL(p, S.club)}" width="72" height="72"><div><h3>${esc(p.n)}</h3><div class="sub">#${p.num} · ${esc(p.race)} · ${p.pos} · bats ${p.hand === 'R' ? 'right' : 'left'}${typeof moonTag === 'function' && MOON && moonTag(p) ? ` · ☾ ${moonTag(p)}` : ''}</div><div class="sub">Level ${p.lvl} · ${p.xp - prev}/${need - prev} XP ${bar(p.xp - prev, need - prev, 'xp')}</div><div class="sub">Health ${Math.round(p.hp ?? 100)} ${bar(p.hp ?? 100, 100, 'hp')}</div><div class="sub">Stamina ${Math.round(p.sta)} ${bar(p.sta, 100, staCls(p.sta))}</div></div></header>
    <div class="statgrid">${STATS.map(s => `<div><b>${p[s]}${it && it.mod && it.mod[s] ? `<small>${it.mod[s] > 0 ? '+' : ''}${it.mod[s]}</small>` : ''}</b>${s.toUpperCase()}<button class="ic" data-act="stat" data-a="${s}" ${p.pts > 0 && p[s] < STAT_CAP ? '' : 'disabled'} aria-label="Raise ${s}">+</button></div>`).join('')}</div>
    <p class="sub">${p.pts ? `<span class="pts">${p.pts} stat points to spend.</span>` : 'Earn XP in games to level up: 2 stat points per level.'} Stats cap at ${STAT_CAP}.</p>
    ${(() => { try { const ck = p.ck, e = ck && CAREER && CAREER[ck]; if (!e) return ''; const sp = S.runId && e.spans[S.runId]; const line = L => { const D = derived(L); return `${L.g} G · ${rate3(D.avg)} AVG · ${L.hr} HR · ${L.rbi} RBI${L.outsP ? ` · ${ipStr(L.outsP)} IP · ${isFinite(D.era) ? D.era.toFixed(2) : '—'} ERA · ${L.k} K` : ''}`; }; return `<h4>Stats</h4><p class="sub">${sp ? `This season: ${line(sp)}<br>` : ''}Career: ${line(totalOf(e))} · <a href="#stats" data-page="stats">all stats</a></p>`; } catch (err) { return ''; } })()}
    <h4>Powers</h4>${abs || '<p class="sub">No magic.</p>'}
    <h4>Physical skills</h4>${skills || '<p class="sub">Magic covers everything; no physical skills needed.</p>'}
    <p class="sub">Skills follow stats: raise POW, CON, SPD, ARM or FLD and a player can switch to a stronger skill.</p>
    <h4>Item</h4>
    <div class="abrow"><div>${it ? `<b>${esc(it.name)}</b><div class="sub">${esc(it.desc)}</div>` : '<span class="sub">Nothing equipped.</span>'}</div>${it ? '<button class="buy" data-act="unequip">Unequip</button>' : ''}</div>
    ${S.inv.length ? `<div class="satchel">${S.inv.map((k, i) => `<button class="buy" data-act="equip" data-a="${i}">Equip ${esc(ITEMS[k].name)}</button>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:10px"><button class="buy" data-act="train" ${S.gold < 20 ? 'disabled' : ''}>Private coaching: +25 XP (20g)</button>${S.bench.includes(p.id) ? '<button class="buy" data-act="release">Release (+10g)</button>' : ''}</div>
  </div>`;
}
function liveLine() {
  const L = S.live; if (!L) return '';
  const [a, h] = L.defs, [ta, th] = L.teams;
  return `${L.half ? 'Bottom' : 'Top'} of the ${ORD(L.inning)}, ${L.outs} out${L.outs === 1 ? '' : 's'} · ${a.short} ${ta.R}, ${h.short} ${th.R}`;
}
const savesCardWrap = () => (Object.values(SLOTCACHE).some(Boolean) ? `<div style="margin-bottom:22px">${savesCard()}</div>` : '');
function updateSeasonTab() { const t = document.querySelector('.tab[data-page=season]'); if (t) t.hidden = !S; }
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#club [data-act], #sOver [data-act]'); if (!b || b.tagName === 'SELECT') return;
  if (b.disabled) return;
  if (b.dataset.act === 'toclub') { document.getElementById('sOver').hidden = true; if (G.phase === 'over') { G.phase = 'menu'; clearGameUI(); document.getElementById('menu').hidden = false; } showPage('season'); return; }
  actSeason(b.dataset.act, b.dataset.a, b.dataset.b);
});
document.addEventListener('change', e => {
  const s = e.target.closest && e.target.closest('#club select[data-act]'); if (!s) return;
  if (s.dataset.act === 'innings') return actSeason('innings', s.value);
  if (s.dataset.act === 'sub' && s.value) return actSeason('sub', s.dataset.a, s.value);
  if (s.dataset.act === 'pos') return actSeason('pos', s.dataset.a, s.value);
});


