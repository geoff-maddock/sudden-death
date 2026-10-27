/* ================= Offseason dungeon crawl (optional; Settings > Dungeon crawls) ================= */
// Between season games, send 1-3 players into a dungeon. The crawl is simulated room by room:
// fights (POW + ARM), traps (SPD + FLD), puzzles (CON), treasure and shrines. Each room is a d20 check for the
// party's best at it against the dungeon's number, which climbs as they go deeper. Wins bring gold, XP, essence and
// sometimes items or gear; failures cost health, and bad ones cause injuries that sideline a player for games.
// The approach decides when the party turns back: Careful leaves early, Reckless pushes to the bottom.
// (The seed of a future press-your-luck dungeon game.)
PREF_DEFS.push({ k: 'dungeon', label: 'Dungeon crawls', opts: [[true, 'On'], [false, 'Off']], help: 'In a season, send up to three players into a dungeon between games for gold, XP and loot, at the risk of injuries.' });
{ const g = prefGet, s = prefSet;
  prefGet = function (k) { return k === 'dungeon' ? SET.dungeon !== false : g.apply(this, arguments); };
  prefSet = function (k, v) { if (k === 'dungeon') { SET.dungeon = v; saveSettings(); if (PAGE === 'season') renderClub(); return; } return s.apply(this, arguments); }; }
const dungeonOn = () => SET.dungeon !== false;

var DUNGEONS = [
  { id: 'crypt', name: 'The Flooded Crypt', diff: 1, rooms: 4, fee: 5, desc: 'Damp tombs and a few restless dead. A good first crawl.', lean: { fight: 3, trap: 2, puzzle: 2, treasure: 3, shrine: 1 }, foes: ['a drowned ghoul', 'a knot of bone rats', 'a weeping shade'] },
  { id: 'warren', name: 'The Goblin Warrens', diff: 2, rooms: 5, fee: 10, desc: 'Tunnels full of snares and very rude goblins.', lean: { fight: 3, trap: 4, puzzle: 1, treasure: 3, shrine: 1 }, foes: ['a goblin war-band', 'a cave bear', 'a goblin shaman'] },
  { id: 'orchard', name: 'The Bone Orchard', diff: 3, rooms: 6, fee: 15, desc: 'A haunted garden of bone trees and riddling statues.', lean: { fight: 2, trap: 2, puzzle: 4, treasure: 3, shrine: 1 }, foes: ['a bone golem', 'a thorn wight', 'a crow swarm'] },
  { id: 'sump', name: "The Wyrm's Sump", diff: 4, rooms: 7, fee: 20, desc: 'Flooded lairs, acid pools and a very old wyrm.', lean: { fight: 4, trap: 3, puzzle: 2, treasure: 3, shrine: 1 }, foes: ['a sump wyrmling', 'an acid ooze', 'a lizard-knight'] },
  { id: 'pit', name: 'The Brimstone Pit', diff: 5, rooms: 8, fee: 30, desc: 'Where the league got its name. Everything down here is on fire.', lean: { fight: 4, trap: 3, puzzle: 3, treasure: 4, shrine: 1 }, foes: ['a pit fiend', 'a magma hound pack', 'the Ash Baron'] },
];
const APPROACH = { careful: { name: 'Careful', turn: .6, luck: 0, desc: 'Turns back once the party is hurt.' }, bold: { name: 'Bold', turn: .35, luck: 1, desc: 'Presses on until someone is badly hurt.' }, reckless: { name: 'Reckless', turn: 0, luck: 2, desc: 'Goes to the bottom no matter what. +2 on treasure.' } };
const DG = { dungeon: 'crypt', party: [], approach: 'careful', report: null, open: false };

// the party's best at a room type, and a readable name for the check
const ROOM_CHECK = { fight: { st: ['pow', 'arm'], txt: 'POW+ARM' }, trap: { st: ['spd', 'fld'], txt: 'SPD+FLD' }, puzzle: { st: ['con', 'con'], txt: 'CON' }, treasure: { st: ['fld', 'con'], txt: 'FLD+CON' } };
function partyBest(party, type) {
  const c = ROOM_CHECK[type]; let best = null, v = -1;
  for (const p of party) { if (p.dgDown) continue; const s = Math.round((p[c.st[0]] + p[c.st[1]]) / 2 * (1 - .4 * Math.max(0, (60 - (p.hp ?? 100)) / 60))); if (s > v) { v = s; best = p; } }
  return { p: best, v: Math.max(0, v) };
}
function pickRoom(D) { const bag = []; for (const [k, n] of Object.entries(D.lean)) for (let i = 0; i < n; i++) bag.push(k); return pick(bag); }

function runCrawl(D, party, approach) {
  const A = APPROACH[approach], log = [], loot = { gold: 0, ess: 0, xp: 0, items: [], gear: [] }, hurt = [];
  for (const p of party) { p.dgDown = false; p.dgHp0 = p.hp ?? 100; }
  let rooms = 0, turned = false;
  const dmg = (p, n, why, severe) => {
    const d = Math.round(n * (1.3 + .12 * D.diff)); p.hp = Math.max(0, (p.hp ?? 100) - d);
    let line = `${p.n} is hurt (−${d})`;
    if (severe && injOn() && R() < .55) { const g = 1 + (R() * 3 | 0); p.out = { games: Math.max(g, (p.out && p.out.games) || 0), what: why }; line += `: ${why}, out ${g} game${g > 1 ? 's' : ''}`; hurt.push(p.n); }
    if (p.hp <= 0) { p.dgDown = true; p.hp = 5; line += '. Carried out by the others'; if (injOn() && !(p.out && p.out.games)) p.out = { games: 1, what: 'beaten senseless in a dungeon' }; hurt.push(p.n); }
    return line;
  };
  for (let i = 0; i < D.rooms; i++) {
    const up = party.filter(p => !p.dgDown); if (!up.length) break;
    // press your luck: turn back if the party is worn down (unless reckless)
    const hpShare = up.reduce((a, p) => a + (p.hp ?? 100), 0) / (party.length * 100);
    if (i > 0 && A.turn && (hpShare < A.turn || up.length < party.length)) { turned = true; log.push({ t: 'turn', room: 'turn', txt: `The party turns back after room ${i}.` }); break; }
    rooms++;
    const type = pickRoom(D), depth = i + 1, dc = 9 + Math.round(D.diff * 2.5) + depth;
    if (type === 'shrine') { const heal = 10 + D.diff * 3; for (const p of up) p.hp = Math.min(100, (p.hp ?? 100) + heal); log.push({ t: 'shrine', room: 'shrine', heal, txt: `Room ${depth}: a quiet shrine. Everyone heals ${heal}.` }); continue; }
    const { p, v } = partyBest(up, type), roll = d20(), luckB = type === 'treasure' ? A.luck : 0, tot = roll + v + luckB + luck(p), ok = roll !== 1 && (roll === 20 || tot >= dc), margin = tot - dc;
    const who = p.n, check = `d20 ${roll} + ${v + luckB + luck(p)} (${who}, ${ROOM_CHECK[type].txt}) vs ${dc}`;
    if (type === 'fight') {
      const foe = pick(D.foes);
      if (ok) { const g = 6 + D.diff * 10 + (R() * 8 | 0); loot.gold += g; loot.xp += 6 + D.diff * 3; log.push({ t: 'win', room: 'fight', who, foe, gold: g, txt: `Room ${depth}: ${who} leads the fight against ${foe} and wins. +${g}g.`, check }); if (R() < .25) { const t = pick(up.filter(x => x !== p)) || p; log.push({ t: 'hurt', room: 'fight', victim: t.n, txt: '  ' + dmg(t, 4 + D.diff * 2, 'bruised in the brawl', false), down: !!t.dgDown }); } }
      else { const t = pick(up); log.push({ t: 'lose', room: 'fight', who, foe, victim: t.n, txt: `Room ${depth}: ${foe} gets the better of them. ${dmg(t, 12 + D.diff * 5 + (margin < -5 ? 10 : 0), pick(['a broken arm', 'a cracked skull', 'a gored leg']), margin < -5 || roll === 1)}.`, check, down: !!t.dgDown }); }
    } else if (type === 'trap') {
      if (ok) { loot.xp += 4 + D.diff * 2; log.push({ t: 'win', room: 'trap', who, trap: pick(['spike pit', 'swinging blade', 'poison dart', 'falling portcullis']), txt: `Room ${depth}: ${who} spots the trap and gets everyone past it.`, check }); }
      else { const t = pick(up), tr = pick(['spike pit', 'swinging blade', 'poison dart', 'falling portcullis']); log.push({ t: 'lose', room: 'trap', who, trap: tr, victim: t.n, txt: `Room ${depth}: a ${tr} springs. ${dmg(t, 10 + D.diff * 4 + (margin < -5 ? 8 : 0), pick(['a torn hamstring', 'a poisoned wound', 'a crushed foot']), margin < -5 || roll === 1)}.`, check, down: !!t.dgDown }); }
    } else if (type === 'puzzle') {
      if (ok) { const e = D.diff >= 3 ? 2 : 1; loot.ess += e; loot.xp += 5 + D.diff * 2; const pz = pick(['riddle door', 'rune lock', 'talking skull', 'mirror maze']); log.push({ t: 'win', room: 'puzzle', who, puzzle: pz, ess: e, txt: `Room ${depth}: ${who} solves the ${pz}. +${e} essence.`, check }); }
      else { const t = pick(up); log.push({ t: 'lose', room: 'puzzle', who, victim: t.n, txt: `Room ${depth}: the puzzle bites back. ${dmg(t, 6 + D.diff * 3, 'a curse that will not lift', roll === 1)}.`, check, down: !!t.dgDown }); }
    } else { // treasure
      if (ok) {
        const g = 10 + D.diff * 16 + (R() * 12 | 0); loot.gold += g; let extra = '';
        if (R() < .12 + D.diff * .06) { const k = pick(Object.keys(ITEMS)); loot.items.push(k); extra = ` and a ${ITEMS[k].name}`; }
        else if (D.diff >= 3 && R() < .1 * D.diff) { const k = pick(Object.keys(GEAR).filter(x => !GEAR[x].recharge || D.diff >= 5)); loot.gear.push(k); extra = ` and a ${GEAR[k].name}`; }
        log.push({ t: 'loot', room: 'treasure', who, gold: g, extra: extra.replace(/^ and an? /, ''), txt: `Room ${depth}: treasure! ${who} pries it open: ${g}g${extra}.`, check });
      } else { const t = pick(up); log.push({ t: 'lose', room: 'mimic', who, victim: t.n, txt: `Room ${depth}: the chest was a mimic. ${dmg(t, 8 + D.diff * 4, 'bitten to the bone by a mimic', roll === 1)}.`, check, down: !!t.dgDown }); }
    }
  }
  const cleared = !turned && rooms === D.rooms && party.some(p => !p.dgDown);
  if (cleared) { const g = 25 * D.diff; loot.gold += g; loot.xp += 10 * D.diff; log.push({ t: 'loot', room: 'hoard', gold: g, txt: `The party reaches the bottom of ${D.name}! Bonus hoard: +${g}g.` }); }
  // pay out
  S.gold += loot.gold; S.essence += loot.ess;
  for (const k of loot.items) S.inv.push(k);
  if (loot.gear.length) { const L = lockerOf('club'); for (const k of loot.gear) L.items.push(newItem(k)); }
  const lines = [];
  for (const p of party) {
    const xp = Math.round(loot.xp / party.length); p.xp += xp; let ups = 0; while (p.xp >= xpNeed(p.lvl)) { p.lvl++; p.pts += 2; ups++; }
    p.sta = Math.max(5, p.sta - (8 + D.diff * 3 + rooms * 2)); delete p.dgDown; const hp0 = p.dgHp0; delete p.dgHp0;
    lines.push({ n: p.n, xp, ups, hp: Math.round(p.hp ?? 100), hpLost: Math.round(hp0 - (p.hp ?? 100)), out: p.out && p.out.games ? p.out.games : 0 });
  }
  const res = { dungeonId: D.id, party: party.map(p => ({ n: p.n, kind: p.kind, num: p.num, hand: p.hand, wpn: p.wpn })), club: { color: S.club.color, light: S.club.light, short: S.club.short, trim: S.club.trim }, dungeon: D.name, diff: D.diff, approach: A.name, rooms, of: D.rooms, cleared, turned, loot, lines, log, game: S.game };
  S.crawl = { game: S.game, last: res };
  seasonLog(`Dungeon crawl, ${D.name}: ${rooms}/${D.rooms} rooms${cleared ? ' (cleared!)' : ''}. +${loot.gold}g${loot.ess ? `, +${loot.ess} essence` : ''}${loot.items.length + loot.gear.length ? `, ${loot.items.length + loot.gear.length} loot` : ''}${hurt.length ? `. Hurt: ${[...new Set(hurt)].join(', ')}` : ''}.`);
  return res;
}
// what the card needs
function crawlUsedThisWeek() { return !!(S.crawl && S.crawl.game === S.game); }
function partyOk(p) { return p && !(p.out && p.out.games > 0) && (p.hp ?? 100) >= 40; }
function dungeonHTML() {
  if (!S || !S.active || !dungeonOn()) return '';
  const D = DUNGEONS.find(d => d.id === DG.dungeon) || DUNGEONS[0], used = crawlUsedThisWeek();
  DG.party = DG.party.filter(id => partyOk(SP(id)));
  const pow = DG.party.map(SP).reduce((a, p) => a + p.pow + p.con + p.spd + p.arm + p.fld, 0), rec = 60 + D.diff * 14;
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const rep = S.crawl && S.crawl.last;
  return `<section class="card dg">
    <h4>Dungeon crawl</h4>
    <p class="sub">Between games, send up to three players into a dungeon. Fights test POW and ARM, traps SPD and FLD, puzzles CON; treasure pays gold, essence, XP and sometimes items or gear. Failures cost health, and bad ones injure players for games. They come back tired either way. One crawl per week.</p>
    ${used ? `<p class="sub"><b>This week's crawl is done.</b> The next one opens after game ${S.game + 1}.</p>` : `
    <div class="dg-list">${DUNGEONS.map(d => `<button class="dg-d ${d.id === D.id ? 'on' : ''}" data-dg="dungeon" data-a="${d.id}"><b>${esc(d.name)}</b><span class="dg-st">${stars(d.diff)}</span><span class="sub">${esc(d.desc)} ${d.rooms} rooms · ${d.fee}g supplies</span></button>`).join('')}</div>
    <p class="sub" style="margin:8px 0 4px">Party (${DG.party.length}/3) · party strength ${pow || 0}, about ${rec} or more recommended for ${esc(D.name)}${DG.party.length && pow < rec ? ' <span class="warnt">(under-strength)</span>' : ''}</p>
    <div class="dg-party">${S.players.map(p => { const ok = partyOk(p), on = DG.party.includes(p.id); return `<label class="dg-p ${on ? 'on' : ''} ${ok ? '' : 'no'}"><input type="checkbox" data-dg="member" data-a="${p.id}" ${on ? 'checked' : ''} ${!ok || (!on && DG.party.length >= 3) ? 'disabled' : ''}><span><b>${esc(p.n)}</b> <span class="sub">${p.pos} · Lv ${p.lvl} · ${ok ? `POW ${p.pow} CON ${p.con} SPD ${p.spd} ARM ${p.arm} FLD ${p.fld} · health ${Math.round(p.hp ?? 100)}` : 'too hurt to go'}</span></span></label>`; }).join('')}</div>
    <div class="row dg-go">${Object.entries(APPROACH).map(([k, a]) => `<button class="rchip ${DG.approach === k ? 'on' : ''}" data-dg="approach" data-a="${k}" title="${esc(a.desc)}">${a.name}</button>`).join('')}
      <button class="go" data-dg="go" ${!DG.party.length || S.gold < D.fee ? 'disabled' : ''}>Send them in · ${D.fee}g</button></div>
    <p class="sub">${esc(APPROACH[DG.approach].desc)}</p>`}
    ${rep ? `<details class="dg-rep" ${DG.open ? 'open' : ''}><summary><b>Last crawl:</b> ${esc(rep.dungeon)} · ${rep.approach} · ${rep.rooms}/${rep.of} rooms${rep.cleared ? ' · cleared!' : rep.turned ? ' · turned back' : ''} · +${rep.loot.gold}g${rep.loot.ess ? ` +${rep.loot.ess}✧` : ''}</summary>
      <ul class="dg-log">${rep.log.map(l => `<li class="dg-${l.t}">${esc(l.txt)}${l.check ? `<span class="sub"> · ${esc(l.check)}</span>` : ''}</li>`).join('')}</ul>
      <p class="sub">${rep.lines.map(x => `${esc(x.n)}: +${x.xp} XP${x.ups ? ` (level up ×${x.ups})` : ''}, health ${x.hp}${x.hpLost > 0 ? ` (−${x.hpLost})` : ''}${x.out ? `, <span class="warnt">out ${x.out} game${x.out > 1 ? 's' : ''}</span>` : ''}`).join(' · ')}${rep.loot.items.length ? ` · Items to the satchel: ${rep.loot.items.map(k => ITEMS[k].name).join(', ')}` : ''}${rep.loot.gear.length ? ` · Gear to the locker: ${rep.loot.gear.map(k => GEAR[k].name).join(', ')}` : ''}</p></details>` : ''}
  </section>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-dg]'); if (!b || b.disabled || !S) return;
  const k = b.dataset.dg;
  if (k === 'member') { const id = b.dataset.a; DG.party = b.checked ? [...new Set([...DG.party, id])].slice(0, 3) : DG.party.filter(x => x !== id); renderClub(); return; }
  if (k === 'dungeon') DG.dungeon = b.dataset.a;
  else if (k === 'approach') DG.approach = b.dataset.a;
  else if (k === 'go') {
    const D = DUNGEONS.find(d => d.id === DG.dungeon); const party = DG.party.map(SP).filter(partyOk);
    if (!D || !party.length || S.gold < D.fee || crawlUsedThisWeek()) return;
    S.gold -= D.fee; runCrawl(D, party, DG.approach); DG.party = []; DG.open = true; saveSeason();
  }
  renderClub();
});
document.addEventListener('toggle', e => { if (e.target && e.target.classList && e.target.classList.contains('dg-rep')) DG.open = e.target.open; }, true);
// the CPU manager sends a couple of rested bench players into an easy dungeon, carefully
{ const o = cpuManage; cpuManage = function () {
  const moves = o.apply(this, arguments) || [];
  try {
    if (S && S.active && dungeonOn() && !crawlUsedThisWeek()) {
      const cands = S.bench.map(SP).filter(p => partyOk(p) && p.sta > 60).slice(0, 2);
      const D = DUNGEONS[Math.min(DUNGEONS.length - 1, Math.floor(S.game / 3))];
      if (cands.length && S.gold >= D.fee + 30 && R() < .6) { S.gold -= D.fee; const r = runCrawl(D, cands, 'careful'); moves.push(`sent ${cands.map(p => p.n).join(' and ')} into ${D.name}: ${r.rooms}/${r.of} rooms, +${r.loot.gold}g${r.lines.some(x => x.out) ? ', with injuries' : ''}`); saveSeason(); }
    }
  } catch (e) { }
  return moves;
}; }
var DG_READY = true;
try { if (PAGE === 'season') renderClub(); } catch (e) { }
