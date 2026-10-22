/* w13: the feel of the realm (phase 8, polish). Loads after w12-renown.js and changes earlier parts only by
   reassignment (saved originals carry the wW13 prefix) and by adding entries to Sudden Death's tables.

   Music. Seven realm themes join Sudden Death's THEMES (one per region, a town, a dungeon, and a night road), in
   the same data format, so SD's sequencer plays them. musicWanted is reassigned: the world view plays the theme of
   where you stand (calm), and a realm match plays its region's theme, or the dungeon's in a dungeon room, in the
   fight and hype modes. Bosses (the alphas and the Crown final) keep Sudden Death's act themes. No music in LAB.

   Tips. Realm coach's notes in SD's TIPS, shown once per profile through tip(id). A watcher, like SD's coach, looks
   at the world rather than threading calls through the model; the shut dungeon door and the first level-up come
   from wrappers. No tips in LAB (tip() refuses), and the realm tests mark them all seen (NOTIPS).

   Achievements. Realm ladders pushed onto SD's ACH, counted with achAdd/achSet (both do nothing in LAB). The Crown
   win goes in the record book through wRecordCrown(), which writes the same record entry as recordRun but never
   sets RUN.over or clears the save (recordRun does both, which is why w11 does not call it). A Hardcore loss still
   goes through recordRun, and is tagged as a realm journey. renderRecords is wrapped to show realm rows in realm words.

   The bag. Salves and trail rations do something now (W_BAG), from a Bag tab on the Team screen.

   Wrapped here: musicWanted, wGateCheck, wGiveXp, wAddPlayer, wDispatchEnd, wCupWon, recordRun, renderRecords,
   wOpenCamp, wRenderCamp, renderHelp. Added by assignment: THEMES.w_*, SCALES.ionian/lydian, TIPS.w_*, ACH entries,
   DB.items.salve/ration text. */

/* ---------- the numbers ---------- */
const W_BAG = {
  salve: { heal: .3, min: 10 },     // a salve heals 30% of the team's max HP; 10 minutes
  ration: { heal: .15, min: 120 },  // a trail ration: rest 2 hours where you stand and heal 15% of max HP
};
const W13 = { lvl: false, lastAlphas: null };

/* ---------- music ---------- */
SCALES.ionian = [0, 2, 4, 5, 7, 9, 11];
SCALES.lydian = [0, 2, 4, 6, 7, 9, 11];
// Melodies are 4 bars of 16 steps, scale degrees from the root; null (_) holds the note. On the road the themes play
// in calm mode, which drops the odd steps, so the tunes sit on the even ones.
THEMES.w_plains = { name: 'The Charter Road', bpm: 100, root: 55, scale: 'ionian', prog: [0, 3, 4, 0], lead: 'triangle', bass: 'sine', pad: 'triangle',
  // a walking tune in G: open road, nothing chasing you yet
  mel: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 0, _, _, _,
        2, _, _, _, 3, _, 4, _, 5, _, _, _, _, _, _, _,
        7, _, _, _, 6, _, 5, _, 4, _, _, _, 2, _, _, _,
        3, _, _, _, 2, _, 1, _, 0, _, _, _, _, _, _, _],
  bassPat: 'x...x...x...x...', drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x...x...x...x...' } };
THEMES.w_bloom = { name: 'Under the Mosswold', bpm: 88, root: 50, scale: 'dorian', prog: [0, 6, 3, 0], lead: 'sine', bass: 'triangle', pad: 'sine', bell: 1,
  // wind chimes in the canopy, a shaker for a drum
  mel: [0, _, 2, _, 4, _, _, _, 3, _, 2, _, 0, _, _, _,
        6, _, _, _, 5, _, 4, _, 3, _, _, _, _, _, _, _,
        4, _, 5, _, 7, _, _, _, 9, _, 7, _, 5, _, _, _,
        4, _, _, _, 3, _, _, _, 2, _, 1, _, 0, _, _, _],
  bassPat: 'x.......x.......', drums: { k: 'x.........x.....', s: '................', h: '..x...x...x...x.' } };
THEMES.w_tide = { name: 'Brinefen Mist', bpm: 72, root: 43, scale: 'aeolian', prog: [0, 5, 3, 4], lead: 'triangle', bass: 'sine', pad: 'sine',
  // slow and low, a wavering lead over still water
  mel: [4, _, _, _, _, _, 3, _, 2, _, _, _, _, _, _, _,
        0, _, _, _, 2, _, 3, _, 2, _, _, _, _, _, _, _,
        4, _, _, _, 5, _, _, _, 7, _, _, _, 6, _, 4, _,
        3, _, _, _, 2, _, _, _, 0, _, _, _, _, _, _, _],
  bassPat: 'x...........x...', drums: { k: 'x...............', s: '........x.......', h: '....x.......x...' } };
THEMES.w_ember = { name: 'The Cindermaw Forge', bpm: 132, root: 38, scale: 'phrygian', prog: [0, 1, 0, 4], lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth', heavy: 1,
  // hammer on the anvil: a flat second, a driving bass
  mel: [0, _, 1, _, 0, _, _, _, 3, _, _, _, 1, _, 0, _,
        4, _, _, _, 3, _, 1, _, 0, _, _, _, _, _, _, _,
        7, _, 8, _, 7, _, 5, _, 4, _, _, _, 3, _, 1, _,
        0, _, 1, _, 3, _, 1, _, 0, _, _, _, _, _, _, _],
  bassPat: 'x.x.x...x.x.x...', drums: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } };
THEMES.w_rime = { name: 'Frostspire Lights', bpm: 96, root: 57, scale: 'lydian', prog: [0, 1, 0, 4], lead: 'sine', bass: 'triangle', pad: 'sine', bell: 1,
  // high and bright: bells, a raised fourth, sleigh-bell hats
  mel: [7, _, _, _, 6, _, 4, _, 3, _, _, _, 4, _, _, _,
        1, _, _, _, 2, _, 4, _, 7, _, _, _, _, _, _, _,
        9, _, _, _, 8, _, 7, _, 6, _, 4, _, 3, _, _, _,
        4, _, _, _, 2, _, 1, _, 0, _, _, _, _, _, _, _],
  bassPat: 'x.......x.......', drums: { k: 'x.......x.......', s: '................', h: 'x.x.x.x.x.x.x.x.' } };
THEMES.w_town = { name: 'Market Day', bpm: 118, root: 48, scale: 'mixo', prog: [0, 3, 6, 4], lead: 'square', bass: 'triangle', pad: 'square', organ: 1,
  // a square-dance organ and an oom-pah bass
  mel: [0, _, 2, _, 4, _, 4, _, 5, _, 4, _, 2, _, _, _,
        3, _, _, _, 5, _, 3, _, 2, _, _, _, _, _, _, _,
        6, _, _, _, 5, _, 4, _, 4, _, 2, _, 4, _, _, _,
        5, _, 4, _, 2, _, 1, _, 0, _, _, _, _, _, _, _],
  bassPat: 'x...x.x.x...x.x.', drums: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' } };
THEMES.w_dungeon = { name: 'Below the Vaults', bpm: 78, root: 40, scale: 'harmonic', prog: [0, 5, 4, 0], lead: 'triangle', bass: 'sine', pad: 'sawtooth', heavy: 1,
  // dark and sparse, a raised seventh, drips for hats
  mel: [0, _, _, _, _, _, _, _, 6, _, _, _, 7, _, _, _,
        2, _, _, _, 1, _, _, _, 0, _, _, _, _, _, _, _,
        4, _, _, _, 5, _, _, _, 6, _, _, _, 7, _, _, _,
        5, _, _, _, 4, _, 2, _, 1, _, _, _, 0, _, _, _],
  bassPat: 'x.......x.......', drums: { k: 'x.......x.....x.', s: '................', h: '......x.......x.' } };
THEMES.w_night = { name: 'The Night Road', bpm: 70, root: 45, scale: 'aeolian', prog: [0, 5, 3, 4], lead: 'sine', bass: 'sine', pad: 'sine', bell: 1,
  // off the road after dark: quiet, and listening
  mel: [4, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _,
        6, _, _, _, 4, _, _, _, 2, _, _, _, _, _, _, _,
        3, _, _, _, _, _, 4, _, 5, _, _, _, _, _, _, _,
        4, _, _, _, 2, _, _, _, 0, _, _, _, _, _, _, _],
  bassPat: 'x...............', drums: { k: 'x...............', s: '................', h: '........x.......' } };
const W_MUSIC_REGION = { plains: 'w_plains', bloom: 'w_bloom', tide: 'w_tide', ember: 'w_ember', rime: 'w_rime' };

/* the theme of where you stand: a town, a dungeon, the night road off the beaten track, or the region */
function wMusicHere() {
  const m = wCurMap(); if (!m) return 'w_plains';
  if (m.kind === 'town') return 'w_town';
  if (m.kind === 'dungeon') return 'w_dungeon';
  if (wIsNight()) { const c = wTileAt(m, WG.x, WG.y); if (c !== '=' && c !== 'b') return 'w_night'; }
  return W_MUSIC_REGION[wRegionHere()] || 'w_plains';
}
/* a realm match: its region's theme, the dungeon's in a room; bosses keep Sudden Death's (null) */
function wMusicMatch(W) {
  if (!W || (B && B.type === 'boss')) return null;
  if (W.kind === 'room' || (MAPS[W.map] && MAPS[W.map].kind === 'dungeon')) return 'w_dungeon';
  return W_MUSIC_REGION[W.region] || 'w_plains';
}
const wW13MusicWanted = musicWanted;
musicWanted = function () {
  const base = wW13MusicWanted();
  if (!WG || !RUN || UI.screen !== 'run') return base;
  let out = base;
  if (UI.view === 'fight' && B && !B.over) {
    const th = wMusicMatch(RUN.pending && RUN.pending.world);
    if (th) out = [th, base[1]];
  } else if (UI.view === 'world' || UI.view === 'panel') out = [wMusicHere(), 'calm'];
  MUS.want = out[0];
  return out;
};

/* ---------- the bag: salves and trail rations ---------- */
function wBagHeal(k) { return Math.max(1, Math.ceil(RUN.maxhp * W_BAG[k].heal)); }
function wBagText(k) {
  const S = W_BAG[k], pc = Math.round(S.heal * 100);
  return k === 'salve' ? `Heals ${pc}% of your team's max HP. Use it from the Bag on the Team screen, outside a match. Takes ${S.min} minutes.`
    : `Rest where you stand for ${S.min / 60} hours and heal ${pc}% of your team's max HP. Use it from the Bag on the Team screen.`;
}
DB.items.salve.desc = DB.items.salve.use = wBagText('salve');
DB.items.ration.name = 'Trail Ration';
DB.items.ration.desc = DB.items.ration.use = wBagText('ration');
/* use one: '' when it worked, or why not */
function wUseItem(k) {
  if (!WG || !RUN) return 'There is no journey on.';
  const S = W_BAG[k], it = DB.items[k];
  if (!S || !it) return 'You cannot use that.';
  if (B && !B.over && UI.view === 'fight') return 'Not during a match.';
  if (!wHas(k)) return `You have no ${it.name}.`;
  if (RUN.hp >= RUN.maxhp) return 'Your team is already at full health.';
  const h0 = RUN.hp;
  wAddItem(k, -1);
  RUN.hp = Math.min(RUN.maxhp, RUN.hp + wBagHeal(k));
  wAdvance(S.min);
  wLog(k === 'salve' ? `You put salve on the worst of it. Your team heals ${RUN.hp - h0} HP (${RUN.hp}/${RUN.maxhp}).`
    : `You stop, eat a ${it.name} and rest for ${S.min / 60} hours. Your team heals ${RUN.hp - h0} HP (${RUN.hp}/${RUN.maxhp}).`, 'm');
  wSave();
  return '';
}
function wCampBag() {
  const ks = Object.keys(WG.items).filter(k => DB.items[k] && WG.items[k] > 0).sort((a, b) => (W_BAG[b] ? 1 : 0) - (W_BAG[a] ? 1 : 0) || DB.items[a].name.localeCompare(DB.items[b].name));
  const full = RUN.hp >= RUN.maxhp;
  return `<p class="hint">Salves and trail rations heal your team between matches. Ingredients go in meals (cook at an inn hearth); keys and keepsakes open doors and finish quests.</p>
    <table class="wshop wbag"><tbody>${ks.length ? ks.map(k => { const it = DB.items[k], use = W_BAG[k];
      return `<tr><td><b>${esc(it.name)}</b><small>${esc(it.desc || '')}</small></td><td class="wnum dim">have ${WG.items[k]}</td><td>${use ? `<button class="ghost" data-wuse="${k}" ${full ? 'disabled title="Your team is at full health"' : ''}>Use (+${wBagHeal(k)} HP)</button>` : ''}</td></tr>`; }).join('')
      : '<tr><td colspan="3" class="dim">Your bag is empty.</td></tr>'}</tbody></table>`;
}
const wW13OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  if (want === 'bag') WCAMP.tab = 'team'; // the Bag tab does not exist until the original has built the header
  wW13OpenCamp(tab === 'bag' ? undefined : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="bag"]')) return;
  tabs.insertAdjacentHTML('beforeend', '<button role="tab" data-ctab="bag">Bag</button>');
  tabs.querySelector('[data-ctab="bag"]').onclick = () => { WCAMP.tab = 'bag'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'bag') { WCAMP.tab = 'bag'; wRenderCamp(); }
};
const wW13RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'bag') return wW13RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="bag"]')) { WCAMP.tab = 'team'; return wW13RenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'bag'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  body.innerHTML = `<div class="wcsum"><span>Team HP <b class="whp">${RUN.hp}/${RUN.maxhp}</b></span><span>Gold <b class="wgold">${RUN.gold}</b></span><span>${esc(wPartOfDay())} ${wTimeStr()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampBag();
  body.querySelectorAll('[data-wuse]').forEach(b => b.onclick = () => { const r = wUseItem(b.dataset.wuse); WUI.hudKey = ''; wCampSay(r); wDrain(); });
};

/* ---------- tips ---------- */
Object.assign(TIPS, {
  w_walk: ['The realm', 'Walk with the arrow keys or WASD, or click where you want to go. Walk into people to talk, and type a word they stress (like CUP) to ask about it. Long grass, woods and fens hide wild teams.'],
  w_wild: ['A wild team', 'Every fight in the realm is a Sudden Death match. Your team’s HP carries on after it, so a night at an inn (or a salve) matters.'],
  w_blackout: ['You blacked out', 'A lost match costs a tenth of your gold and a quarter of your fans, and you wake at your last inn. Sleep at an inn to choose where you wake.'],
  w_level: ['Level up', 'A player who levels up raises your team’s max HP and picks a card of their own kind. Their cards only play while they start.'],
  w_recruit: ['A new player', 'Players can join from taverns, after games, and from quests. Open the Team screen (C) to change who starts: only the first three play.'],
  w_cup: ['In a cup', 'A cup is three rounds in a row. Lose one and you are out, but you can enter again. The next round’s card opens when you are ready.'],
  w_door: ['A shut door', 'Dungeons open as you win cups, and the Gene Vault also wants a keycard. The log says what is missing.'],
  w_renown: ['Renown', 'Every cup and boss you win makes the realm’s teams take you more seriously: more HP, and later Strength. The pre-game card shows it.'],
  w_champ: ['Championship week', 'The last days of the year. With all four cups, enter the Crown with Steward Crane at the Crown Coliseum.'],
  w_night: ['Night falls', 'After dark, wild teams come out more, the road is not safe, and some ambush you a score ahead. An inn is a good place to wait for morning.'],
  w_bag: ['Running low', 'Your team is under half its HP. Use a salve or rest with a trail ration from the Bag on the Team screen, or sleep at an inn.'],
});
/* the watcher: what the player is looking at decides the tip */
function wFeelTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run') return;
  const W = RUN.pending && RUN.pending.world;
  if (UI.view === 'world') {
    tip('w_walk');
    if (WG.blackouts) tip('w_blackout');
    if (W13.lvl || (WG.wprompts || []).some(p => p.t === 'level') || document.querySelector('#modalBox .wlvl')) tip('w_level');
    if ($('wSign') || (WG.wprompts || []).some(p => p.t === 'recruit')) tip('w_recruit');
    if (WG.cup) tip('w_cup');
    if (wRenown() > 0) tip('w_renown');
    if (wChampWeek()) tip('w_champ');
    if (wCurMap().kind === 'world' && wIsNight()) tip('w_night');
    if (RUN.hp < RUN.maxhp * .5 && (wHas('salve') || wHas('ration'))) tip('w_bag');
  }
  if (UI.view === 'fight' && B && !B.over && W) {
    if (W.kind === 'wild') tip('w_wild');
    if (W.kind === 'cup') tip('w_cup');
  }
}
setInterval(wFeelTips, 700);
const wW13GateCheck = wGateCheck;
wGateCheck = function (locId) {
  const g = wW13GateCheck(locId);
  if (!g.ok && WG && !LAB) tip('w_door');
  return g;
};
const wW13GiveXp = wGiveXp;
wGiveXp = function (p, n) {
  const l0 = p.lvl;
  wW13GiveXp(p, n);
  if (p.lvl > l0 && !LAB) W13.lvl = true;
};

/* ---------- achievements ---------- */
ACH.push(
  { id: 'w_cups', n: 'Silverware', d: 'Win regional cups in the realm', stat: 'realmCups', at: [1, 4, 12] },
  { id: 'w_alphas', n: 'Alpha Hunter', d: 'Beat the realm’s alphas (dungeon bosses and lairs)', stat: 'realmAlphas', at: [1, 6, 15] },
  { id: 'w_crown', n: 'Wear the Crown', d: 'Win the Crown', stat: 'realmCrowns', at: [1, 3, 10] },
  { id: 'w_iron', n: 'Iron Crown', d: 'Win the Crown on Hardcore', stat: 'realmHardCrowns', at: [1, 2, 5] },
  { id: 'w_scout', n: 'Talent Scout', d: 'Sign players in the realm', stat: 'realmRecruits', at: [3, 10, 30] },
  { id: 'w_renown', n: 'Household Name', d: 'Reach renown in one journey', stat: 'realmRenown', at: [3, 6, 10] },
  { id: 'w_regions', n: 'Cartographer', d: 'Visit the realm’s regions', stat: 'realmRegions', set: 1, at: [2, 4, 5] },
  { id: 'w_feet', n: 'Back on Your Feet', d: 'Get up after a blackout', stat: 'realmBlackouts', at: [1, 5, 20] },
);
/* the best renown this profile has reached in a journey */
function wAchRenown() {
  if (LAB || !WG) return;
  const n = wRenown();
  if (n > (ACHS.stats.realmRenown || 0)) { ACHS.stats.realmRenown = n; achCheck(); }
}
function wAlphaCount() { return WG ? Object.keys(WG.flags || {}).filter(f => /^alpha_/.test(f) && WG.flags[f]).length : 0; }
const wW13DispatchEnd = wDispatchEnd;
wDispatchEnd = function (W, r) {
  const a0 = wAlphaCount();
  wW13DispatchEnd(W, r);
  if (LAB || !W || !WG) return;
  const a1 = wAlphaCount();
  if (a1 > a0) achAdd('realmAlphas', a1 - a0);
  if (r === 'lose' && !WG.hardcore) achAdd('realmBlackouts', 1);
  wAchRenown();
};
const wW13CupWon = wCupWon;
wCupWon = function (id) {
  wW13CupWon(id);
  if (LAB || !WG) return;
  if (id === 'crown') { achAdd('realmCrowns', 1); if (WG.hardcore) achAdd('realmHardCrowns', 1); wRecordCrown(); }
  else achAdd('realmCups', 1);
  wAchRenown();
};
const wW13AddPlayer = wAddPlayer;
wAddPlayer = function (p) {
  const out = wW13AddPlayer(p);
  if (!LAB && p && p.from !== 'founder') achAdd('realmRecruits', 1);
  return out;
};
/* regions visited: counted as you walk */
setInterval(() => {
  if (LAB || !WG || UI.view !== 'world' || UI.screen !== 'run' || wCurMap().kind !== 'world') return;
  const r = regionAt(WG.x, WG.y), s = ACHS.sets.realmRegions || [];
  if (r && !s.includes(r)) achSet('realmRegions', r);
}, 1000);

/* ---------- the record book ---------- */
/* what a realm journey looked like when it was recorded */
function wRecordTag(kind) {
  return { kind, year: WG.year, day: WG.day, days: WG.dayAbs, cups: wCupsWon(), alphas: wAlphaCount(), crowns: (WG.crowns || []).length, hardcore: WG.hardcore ? 1 : 0, place: (MAPS[WG.map] || {}).name || '' };
}
/* the Crown: the same entry recordRun writes, without RUN.over or clearing the save, so the journey goes on */
function wRecordCrown() {
  if (LAB || !WG || !RUN) return null;
  const rec = loadRecords();
  const e = { when: Date.now(), diff: diffOf(RUN) === DIFFS[1] ? undefined : DIFFS.indexOf(diffOf(RUN)), club: RUN.club, party: RUN.party.map(p => [p.n, p.kind]), result: 'win',
    act: RUN.act, floor: RUN.floor || 0, score: runScore(RUN), killer: '', relics: RUN.relics.slice(), deck: wAllCards().length, sportsWins: RUN.stats.sportsWins || 0, style: RUN.style || 0,
    games: (RUN.games || []).map(g => ({ a: g.act, s: g.sport, t: g.type, u: g.us, h: g.them, o: g.opp, w: g.won ? 1 : 0, f: g.fell ? 1 : 0, l: g.hl, st: g.strokes, p: g.par, k: g.strike ? 1 : 0, n: g.turns, x: g.foes, q: g.q, ps: g.ps, m: g.mvp })),
    realm: wRecordTag('crown') };
  rec.runs.unshift(e); rec.runs = rec.runs.slice(0, 50);
  try { localStorage.setItem(pkey('sd-records'), JSON.stringify(rec)); } catch (x) { }
  return e;
}
/* a Hardcore loss goes through Sudden Death's recordRun (it ends the save); tag it as a realm journey */
const wW13RecordRun = recordRun;
recordRun = function (result) {
  const tag = WG && !LAB ? wRecordTag(result) : null;
  wW13RecordRun(result);
  if (!tag) return;
  const rec = loadRecords();
  if (rec.runs[0]) { rec.runs[0].realm = tag; try { localStorage.setItem(pkey('sd-records'), JSON.stringify(rec)); } catch (x) { } }
};
const wW13RenderRecords = renderRecords;
renderRecords = function () {
  wW13RenderRecords();
  const rec = loadRecords(), rows = document.querySelectorAll('#pg-rec .tablewrap table tbody tr');
  rec.runs.forEach((r, i) => {
    const R = r.realm, tr = rows[i]; if (!R || !tr || tr.children.length < 4) return;
    const hc = R.hardcore ? ' <span class="hlt" title="A lost match ended the journey">Hardcore</span>' : '';
    if (R.kind === 'crown') tr.children[2].innerHTML = `<b style="color:var(--torch)">Champions of the realm</b>${hc}`;
    else tr.children[2].innerHTML = `${r.result === 'quit' ? 'Conceded' : `Fell${r.killer ? ' to ' + esc(r.killer) : ''}`}${hc}`;
    tr.children[3].textContent = `The realm: year ${R.year}, day ${R.day}. ${R.cups} cup${R.cups === 1 ? '' : 's'}, ${R.alphas} alpha${R.alphas === 1 ? '' : 's'}`;
    tr.classList.add('wrealmrec');
  });
};

/* ---------- How to play ---------- */
const wW13RenderHelp = renderHelp;
renderHelp = function () {
  wW13RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelpFeel')) return;
  const row = k => `<tr><td>${esc(DB.items[k].name)}</td><td>+${Math.round(W_BAG[k].heal * 100)}% of max HP</td><td>${W_BAG[k].min >= 60 ? W_BAG[k].min / 60 + ' hours' : W_BAG[k].min + ' minutes'}</td><td>${(DB.shops.general || {})[k] || '?'} gold</td></tr>`;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelpFeel"><h4>The bag, music and medals</h4>
    <p class="hint"><b>Healing on the road.</b> Open the Team screen (<kbd>C</kbd>) and its Bag tab to use these, outside a match. A night at an inn still heals everything.</p>
    <div class="tablewrap"><table class="wbagtbl"><thead><tr><th>Item</th><th>Heals</th><th>Time</th><th>Shop price</th></tr></thead><tbody>${row('salve')}${row('ration')}</tbody></table></div>
    <p class="hint"><b>Music.</b> Every region, the towns, the dungeons and the night road have their own tune, and a match plays its region's tune (bosses keep their own).</p>
    <p class="hint"><b>Achievements and records.</b> The realm has its own medals in the record book: cups, alphas, the Crown, players signed, renown, regions visited. Winning the Crown goes in the record book, and your journey carries on.</p></div>`);
};
