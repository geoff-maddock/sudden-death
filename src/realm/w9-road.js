/* w9: the road (phase 4). Tiers and levels for every match, region-flavoured wild teams, night ambushes, elemental
   energy for wins, and TC's road events as event cards. Loads after w8, so it wraps earlier realm functions by
   reassignment instead of editing them.

   The tier model. Tier sets the SD act a match is played at (RUN.act = tier - 1: TUNE, spawn and the encounter tables):
     tier 1  the Charter Plains and its roads           (W_TIER, w5)
     tier 2  the four outer regions, Hatchery, Emberdeep (W_TIER, W_DUNGEON_TIER)
     tier 3  the Gene Vault, the Deep Seam (and later the Crown)
   Level (0 to 4) is a finer step inside a tier, added up and shown on the pre-game card:
     +1 per 11 tiles beyond the first 4 from Graftonbury (at most +3; not in dungeons), +1 per two cups won,
     +1 for a night game off the road. Each level gives the other team +8% HP, and from level 2 Strength (W_ROAD.strAt).
   It works through enemy HP and Strength (a status you can see on them), so it never touches atkDmg.
   Night off-road wild games are ambushes half the time: the other team opens a score ahead (Sudden Death's "Hot start"),
   or in golf, bowling and boxing, with 1 Strength each. Shown on the pre-game card.

   The phase 2 act problem, decided: in the realm, Sudden Death's season goals are off (checkGoals returns nothing:
   they are per act, and an act here is just a tier), and SD's "easy" encounter pool is used for your first two wins
   in each tier (WG.tierFights) instead of RUN.actFights, which never resets in the realm. Realm goals can come later.

   Sudden Death functions reassigned here: rollEncounter (region kinds, per-tier easy games), checkGoals (off in the realm).
   Realm functions wrapped here: wBuildEncounter (level, ambush, team), wPreGame (level and ambush lines), wFoeTeam,
   wEncounterHook (road events), wStart (reopens an unfinished event card), renderHelp (via w9b). Adds W_ON_END.event. */

const W_ROAD = {
  distFree: 4, distBand: 11, distMax: 3,    // level from distance to Graftonbury, in world tiles
  cupsPerLv: 2,                             // +1 level per two cups won
  maxLv: 4, hpPerLv: .08, strAt: [0, 0, 1, 1, 2],
  ambushOdds: .5,                           // a night off-road wild game is an ambush this often
  eventP: .018,                             // TC: a road event on a world step that did not roll a match
  eventGrace: 6, nativeOdds: .65,           // how often a wild team is drawn from the region's own kinds
};
/* wild teams wear their region's colours */
const W_WILD_TEAM = {
  plains: { name: 'Charter Plains Pickups', short: 'CPP', color: '#c9a24a', light: '#fff1c2' },
  bloom: { name: 'Mosswold Wildlings', short: 'MOS', color: '#3a7f45', light: '#bfe8b0' },
  tide: { name: 'Brinefen Bogtrotters', short: 'BOG', color: '#235c9c', light: '#bfe3ff' },
  ember: { name: 'Cindermaw Scorchers', short: 'CIN', color: '#a83a1e', light: '#ff9a7a' },
  rime: { name: 'Frostspire Howlers', short: 'FRO', color: '#6aa6c4', light: '#e3f3ff' },
};
const W9 = { encRegion: null, preTeam: null };

/* ---------- level inside a tier ---------- */
function wCupsWon() { return ['cup_moss', 'cup_salt', 'cup_cind', 'cup_rime'].filter(wFlag).length; }
function wOnRoad() { const m = wCurMap(); if (m.kind !== 'world') return false; const c = wTileAt(m, WG.x, WG.y); return c === '=' || c === 'b'; }
function wDistHome() {
  const hq = DB.locs.find(l => l.id === 'graftonbury'), m = wCurMap();
  let x = WG.x, y = WG.y;
  if (m.kind !== 'world') { const L = DB.locs.find(l => l.map === m.id); if (!L) return 0; x = L.x; y = L.y; }
  return Math.hypot(x - hq.x, y - hq.y);
}
/* { lv, why: [reasons] } for a match here; night is the match's own night flag */
function wLevelInfo(night) {
  const why = [], m = wCurMap(); let lv = 0;
  if (m.kind !== 'dungeon') {
    const d = clamp(Math.floor((wDistHome() - W_ROAD.distFree) / W_ROAD.distBand), 0, W_ROAD.distMax);
    if (d) { lv += d; why.push(d >= 2 ? 'far from Graftonbury' : 'out from Graftonbury'); }
  }
  const c = Math.floor(wCupsWon() / W_ROAD.cupsPerLv);
  if (c) { lv += c; why.push(wCupsWon() + ' cups won'); }
  if (night && !wOnRoad()) { lv += 1; why.push('night, off the road'); }
  return { lv: Math.min(W_ROAD.maxLv, lv), why };
}
function wLevelText(lv) {
  const s = W_ROAD.strAt[lv] || 0;
  return `foes have +${Math.round(W_ROAD.hpPerLv * lv * 100)}% HP${s ? ` and ${s} Strength` : ''}`;
}
function wAmbushText(sport) { return SPORT_UNIT[sport] ? 'they open the game a score ahead' : 'they start with 1 Strength each'; }

/* the encounter: level, ambush and team colours ride on enc.world (plain data) */
const wW5BuildEncounter = wBuildEncounter;
wBuildEncounter = function (o) {
  o = o || {};
  W9.encRegion = (o.world && o.world.region) || wRegionHere();
  let enc;
  try { enc = wW5BuildEncounter(o); } finally { W9.encRegion = null; }
  const W = enc.world, L = o.lv != null ? { lv: clamp(o.lv, 0, W_ROAD.maxLv), why: [] } : wLevelInfo(W.night);
  W.lv = L.lv; W.lvWhy = L.why;
  W.ambush = o.ambush != null ? (o.ambush ? 1 : 0) : (W.kind === 'wild' && W.night && !wOnRoad() && Math.random() < W_ROAD.ambushOdds ? 1 : 0);
  if (W.kind === 'wild' || W.kind === 'event') W.team = W.region;
  return enc;
};

/* Sudden Death's encounter roll, for the realm: the easy pool for your first two wins in a tier, and wild teams drawn
   from the region's own kinds when the act's tables have them (Sudden Death's tables otherwise) */
const wSdRollEncounter = rollEncounter;
rollEncounter = function (type, want) {
  if (!WG || type === 'boss') return wSdRollEncounter(type, want);
  const E = ENCOUNTERS[RUN.act], tf = (WG.tierFights || {})[RUN.act + 1] || 0;
  const pool = type === 'elite' || type === 'rival' ? E.elite : tf < 2 ? E.easy : E.normal;
  const fits = want ? pool.filter(p => !ENEMIES[p[0]].sport || ENEMIES[p[0]].sport === want) : pool;
  let P2 = fits.length ? fits : pool;
  const kinds = (DB.regions[W9.encRegion] || {}).kinds || [];
  const nat = P2.filter(ids => ids.some(id => kinds.includes(ENEMIES[id].kind)));
  if (nat.length && Math.random() < W_ROAD.nativeOdds) P2 = nat;
  let ids, tries = 0;
  do { ids = pick(P2).slice(); } while (tries++ < 6 && ids.join() === RUN.lastEnc && P2.length > 1);
  RUN.lastEnc = ids.join();
  const fixed = ENEMIES[ids[0]].sport;
  return { ids, type, sport: fixed || want || wpick(ACT_SPORTS[RUN.act]) };
};

/* season goals are per act; in the realm an act is only a tier, so they are off (see the note at the top) */
const wSdCheckGoals = checkGoals;
checkGoals = function () { if (WG) return []; return wSdCheckGoals(); };

/* ---------- at kickoff: level, team colours, ambush ---------- */
onHook('fightStart', () => {
  if (!WG || !RUN || !B || !RUN.pending || !RUN.pending.world) return;
  const W = RUN.pending.world, team = wMatchTeam(W);
  if (team) for (const e of B.enemies) if (!isBoss(e) && !ENEMIES[e.id].team) e.team = Object.assign({}, team);
  if (W.lv) {
    const m = 1 + W_ROAD.hpPerLv * W.lv, s = W_ROAD.strAt[W.lv] || 0;
    for (const e of alive()) { e.max = e.hp = Math.round(e.hp * m); if (s) addSt(e, 'str', s); }
    log(`Level ${W.lv} game${W.lvWhy && W.lvWhy.length ? ' (' + W.lvWhy.join(', ') + ')' : ''}: ${wLevelText(W.lv)}.`, 'bad');
  }
  if (W.ambush) {
    B.wAmbush = 1;
    if (SPORT_UNIT[B.sport] && B.sc) { B.sc.them += SPORT_UNIT[B.sport]; momentumCheck(); }
    else for (const e of alive()) addSt(e, 'str', 1);
    fx({ k: 'banner', t: 'Ambush!', sub: 'They jumped you in the dark: ' + wAmbushText(B.sport) + '.', small: 1 });
    log('Ambush: ' + wAmbushText(B.sport) + '.', 'bad');
  }
});
/* a win counts toward the tier's easy games, and leaves energy of the region's element in your jars */
function wWinElem(W) { const d = DB.dungeons.find(x => x.id === W.map); return d ? d.elem : REGION_ELEM[W.region] || 'aether'; }
onHook('fightWon', () => {
  if (!WG || !RUN || !RUN.pending || !RUN.pending.world) return;
  const W = RUN.pending.world;
  WG.tierFights = WG.tierFights || {}; WG.tierFights[W.tier] = (WG.tierFights[W.tier] || 0) + 1;
  const el = wWinElem(W), n = W.tier + (B && (B.type === 'elite' || B.type === 'rival') ? 1 : 0);
  WG.energy[el] = (WG.energy[el] || 0) + n;
  wLog(`The win leaves ${n} ${DB.elems.names[el]} energy in your jars, for the enchanter.`, 'm');
});

/* the pre-game card: say how hard it is and why, and warn of an ambush */
function wMatchTeam(W) {
  const club = W.kind === 'event' && W.ref && W.ref.rival && CLUBS[W.ref.rival];
  return club ? { name: club.name, short: club.short, color: club.color, light: club.light } : W_WILD_TEAM[W.team] || null;
}
const wW5FoeTeam = wFoeTeam;
wFoeTeam = function (id, tier) { return W9.preTeam && !ENEMIES[id].team ? W9.preTeam : wW5FoeTeam(id, tier); };
const wW5PreGame = wPreGame;
wPreGame = function (enc) {
  W9.preTeam = wMatchTeam(enc.world);
  try { wW5PreGame(enc); } finally { W9.preTeam = null; }
  const W = enc.world, box = document.querySelector('#modalBox .wpgtxt'); if (!box) return;
  const who = box.querySelector('.wpgwho');
  if (who) who.insertAdjacentHTML('afterend', `<p class="wpglv">Level ${W.lv || 0} of ${W_ROAD.maxLv}${W.lv ? ` (${esc((W.lvWhy || []).join(', ') || 'set')}): ${esc(wLevelText(W.lv))}` : ': no extra edge for them'}.</p>`);
  if (W.ambush) box.insertAdjacentHTML('afterbegin', `<p class="wambush"><b>Ambush!</b> They jumped you in the dark: ${esc(wAmbushText(enc.sport))}.</p>`);
};

/* ---------- road events ---------- */
const wW5EncounterHook = wEncounterHook;
wEncounterHook = function (region, tileCh, info) {
  if (info || !WG || !RUN) return wW5EncounterHook(region, tileCh, info);
  const m = wCurMap();
  if (wEncounterRoll(m, tileCh, Math.random()) === 'fight') return wWildMatch(region);
  if (m.kind === 'world' && Math.random() < W_ROAD.eventP) return wRoadEvent();
};
function wEventDef(id) { return DB.events.find(e => e.id === id); }
function wEventMatches(ev) { return (ev.choices || []).some(c => c.match || c.failMatch); }
function wEventOk(ev) {
  const night = wIsNight();
  if (ev.time === 'day' && night) return false;
  if (ev.time === 'night' && !night) return false;
  if (ev.region && !ev.region.includes(wRegionHere())) return false;
  if (ev.need && !wFlag(ev.need)) return false;
  if (wOnRoad() && !night && wEventMatches(ev)) return false; // by day on the road, nothing that means a match
  return true;
}
function wRange(v) { return Array.isArray(v) ? ri(v[0], v[1]) : v; }
/* start a road event: an id forces one (tests, debugging) */
function wRoadEvent(id) {
  const ev = id ? wEventDef(id) : wWpick(DB.events.filter(wEventOk));
  if (!ev) return null;
  WG.grace = W_ROAD.eventGrace;
  const S = { id: ev.id, done: null };
  if (ev.who && ev.who.rival) S.rival = pick(CLUB_IDS.filter(c => c !== RUN.club));
  WG.event = S;
  WUI.held = null; WUI.goto = null;
  if (ev.auto) { const bits = wApplyEffects(ev.auto); S.done = bits.join(', ') || ' '; wLog(ev.text + (bits.length ? ' (' + bits.join(', ') + ')' : ''), 'g'); }
  else wLog(ev.text, 'g');
  wSave();
  wOpenEvent();
  return S;
}
function wEventWho(S) {
  const ev = wEventDef(S.id), w = ev.who || {};
  if (w.rival && CLUBS[S.rival]) { const c = CLUBS[S.rival], cap = c.roster[0]; return { name: `${cap[0]} of the ${c.name}`, short: cap[0], kind: cap[1], team: c }; }
  return w;
}
function wAffordable(c) {
  const k = c.cost || {};
  if (k.gold && RUN.gold < k.gold) return false;
  if (k.hp && RUN.hp <= k.hp) return false;
  for (const i in k.items || {}) if (!wHas(i, k.items[i])) return false;
  if (c.practice && !RUN.deck.some(practicable)) return false;
  if (c.upgrade && !RUN.deck.some(upgradable)) return false;
  return true;
}
function wPayCost(c) {
  const k = c.cost || {}; if (k.gold) RUN.gold -= k.gold; if (k.hp) RUN.hp -= k.hp;
  for (const i in k.items || {}) wAddItem(i, -k.items[i]);
}
/* effects: returns short lines for the log and the card ("+20 gold") */
function wApplyEffects(e) {
  const bits = [];
  if (e.gold) { const n = wRange(e.gold); RUN.gold += n; bits.push('+' + n + ' gold'); }
  if (e.fans) { RUN.fans = (RUN.fans || 0) + e.fans; bits.push('+' + e.fans + ' fans'); }
  for (const k in e.items || {}) { wAddItem(k, e.items[k]); bits.push('+' + e.items[k] + ' ' + DB.items[k].name); }
  for (const k in e.energy || {}) { const el = k === 'here' ? REGION_ELEM[wRegionHere()] || 'aether' : k, n = wRange(e.energy[k]); WG.energy[el] = (WG.energy[el] || 0) + n; bits.push('+' + n + ' ' + DB.elems.names[el] + ' energy'); }
  if (e.time) wAdvance(e.time);
  if (e.healPct) { const h = Math.min(RUN.maxhp - RUN.hp, Math.ceil(RUN.maxhp * e.healPct)); RUN.hp += h; bits.push('+' + h + ' HP'); }
  if (e.snack) { WG.pantry = WG.pantry || {}; WG.pantry[e.snack] = (WG.pantry[e.snack] || 0) + 1; bits.push(DB.meals[e.snack].name + ' in your pantry'); }
  if (e.charm) { WG.charm = e.charm; bits.push(DB.meals[e.charm].name + ' for the next match'); }
  if (e.steal) {
    const ks = Object.keys(WG.items).filter(k => DB.items[k] && DB.items[k].price);
    if (ks.length) { const k = pick(ks); wAddItem(k, -1); bits.push('it took a ' + DB.items[k].name); } else bits.push('there was nothing worth taking');
  }
  if (e.lore) bits.push('it is ' + pick(DB.lore));
  if (e.card || e.cards || e.cardChoice) { wPayCards(e, 'from the road'); bits.push(e.cardChoice ? 'a choice of cards' : 'a card'); }
  return bits;
}
/* what a choice does, in a few words, under its label */
function wChoiceText(c) {
  const out = [];
  if (c.match) { const w = c.match.win || {}; out.push('A match.' + (w.gold || w.fans ? ` Win it for ${[w.gold ? (Array.isArray(w.gold) ? w.gold.join('-') : w.gold) + ' gold' : '', w.fans ? w.fans + ' fans' : ''].filter(Boolean).join(' and ')}.` : '') + ' Lose and you black out.'); }
  if (c.chance != null) out.push(`A ${Math.round(c.chance * 100)}% chance.` + (c.failMatch ? ' If it goes wrong, a match in the dark.' : ''));
  if (c.gold) out.push(Array.isArray(c.gold) ? `${c.gold[0]} to ${c.gold[1]} gold.` : `+${c.gold} gold.`);
  if (c.fans) out.push(`+${c.fans} fans.`);
  for (const k in c.energy || {}) out.push(`+${Array.isArray(c.energy[k]) ? c.energy[k].join('-') : c.energy[k]} ${k === 'here' ? DB.elems.names[REGION_ELEM[wRegionHere()] || 'aether'] : DB.elems.names[k]} energy.`);
  for (const k in c.items || {}) out.push(`+${c.items[k]} ${DB.items[k].name}.`);
  if (c.healPct) out.push(`Heal ${Math.round(c.healPct * 100)}% of your team HP.`);
  if (c.snack) out.push(`${DB.meals[c.snack].name}: ${DB.meals[c.snack].does}`);
  if (c.charm) out.push(DB.meals[c.charm].does);
  if (c.practice) out.push('Practice a card: ★, better at every sport.');
  if (c.upgrade) out.push('Upgrade a card.');
  if (c.time) out.push(`Takes ${c.time >= 60 ? (c.time / 60) + (c.time === 60 ? ' hour' : ' hours') : c.time + ' minutes'}.`);
  return out.join(' ');
}
function wEventArt(who) {
  if (who.kind && KIND[who.kind]) { let src = ''; try { src = portraitURL(who.kind, who.team || wNpcTeam(who.kind), '', 96); } catch (e) { } if (src) return `<img src="${src}" alt="">`; }
  const ico = { purse: ICO.bag, shed: ICO.gem, wisp: ICO.lantern }[who.scene] || ICO.event;
  return `<span class="wevscene">${svgI(ico)}</span>`;
}
function wOpenEvent() {
  const S = WG && WG.event; if (!S || LAB) return;
  const ev = wEventDef(S.id); if (!ev) { WG.event = null; return; }
  const who = wEventWho(S);
  const body = ev.who && ev.who.rival ? ev.text.replace("A rival club's", `The ${CLUBS[S.rival].name}'`) : ev.text;
  let closed = false;
  const close = modal(`<header><h3>${esc(who.name || 'On the road')}</h3></header>
    <div class="wpg wev"><div class="wpgfoes">${wEventArt(who)}</div><div class="wpgtxt"><p class="wpgwho">${esc(body)}</p>${S.done && S.done.trim() ? `<p class="result">${esc(S.done)}</p>` : ''}</div></div>
    ${!S.done && ev.choices ? `<div class="opts">${ev.choices.map((c, i) => `<button class="opt" data-wev="${i}" ${wAffordable(c) ? '' : 'disabled title="You cannot afford that"'}><b>${esc(c.label)}</b><small>${esc(wChoiceText(c))}</small></button>`).join('')}</div>
      <div class="row"><button class="ghost" id="wEvWalk">Walk on</button></div>` : '<div class="row"><button class="btn" id="wEvDone">Carry on</button></div>'}`,
    () => { if (closed) return; closed = true; if (WG.event === S) { if (!S.done) wLog('You walk on.', 'd'); WG.event = null; wSave(); } wDrain(); });
  const shut = () => close();
  if ($('wEvWalk')) $('wEvWalk').onclick = shut;
  if ($('wEvDone')) { $('wEvDone').onclick = shut; $('wEvDone').focus(); }
  $('modalBox').querySelectorAll('[data-wev]').forEach(b => b.onclick = () => { closed = true; close(); wEventChoose(+b.dataset.wev); });
}
/* choose: o.roll forces a gamble's roll (tests) */
function wEventChoose(i, o) {
  o = o || {};
  const S = WG && WG.event, ev = S && wEventDef(S.id), c = ev && ev.choices && ev.choices[i];
  if (!c || S.done) return false;
  if (!wAffordable(c)) { wOpenEvent(); return false; }
  const region = wRegionHere();
  if (c.match) {
    wPayCost(c); WG.event = null;
    const who = wEventWho(S);
    wLog(c.label + '.', 'd');
    startMatch({ type: c.match.type || 'normal', tier: wTierHere(), name: c.match.name || (S.rival ? who.short : null), world: { kind: 'event', ref: { ev: S.id, c: i, rival: S.rival || null }, region } });
    return true;
  }
  if (c.practice || c.upgrade) {
    const mode = c.practice ? 'practice' : 'upgrade';
    wPickCard(RUN.deck.filter(c.practice ? practicable : upgradable), c.practice ? 'Practice a card' : 'Upgrade a card', c.practice ? 'A practiced card (★) gets better at every sport.' : 'The + version, for good.', card => {
      if (!card) { wOpenEvent(); return; }
      wPayCost(c);
      if (mode === 'practice') { card.sk = 1; achAdd('practice', 1); } else card.up = true;
      const bits = wApplyEffects(c); bits.unshift(wCardName(card.id, card.up) + (mode === 'practice' ? ' ★' : ''));
      S.done = (c.result || '') + ' (' + bits.join(', ') + ')';
      wLog(S.done.trim(), 'm'); wSave(); wOpenEvent();
    });
    return true;
  }
  wPayCost(c);
  const ok = c.chance == null || (o.roll != null ? o.roll : Math.random()) < c.chance;
  if (!ok && c.failMatch) {
    WG.event = null; wLog(c.fail || 'It goes wrong.', 'b'); wSave();
    startMatch({ type: c.failMatch.type || 'normal', tier: wTierHere(), ambush: true, world: { kind: 'wild', region } });
    return true;
  }
  const bits = ok ? wApplyEffects(c) : [];
  S.done = ((ok ? c.result : c.fail) || 'Done.') + (bits.length ? ' (' + bits.join(', ') + ')' : '');
  wLog(S.done, ok ? 'm' : 'b');
  wSave(); wOpenEvent(); wDrain();
  return true;
}
W_ON_END.event = function (r, ref) {
  if (r !== 'win' || !ref) return;
  const ev = wEventDef(ref.ev), c = ev && ev.choices[ref.c]; if (!c || !c.match) return;
  const bits = wApplyEffects(c.match.win || {});
  wLog((c.match.winText || 'You win.') + (bits.length ? ' (' + bits.join(', ') + ')' : ''), 'g');
};
/* a card picker over a list of deck cards (Sudden Death's pickFromDeck look). done(card) or done(null) on cancel. */
function wPickCard(list, title, hint, done) {
  let cb = done;
  const close = modal(`<header><h3>${esc(title)}</h3><button class="ghost" data-close>Cancel</button></header>
    <p class="hint">${esc(hint || '')}</p><div class="cardgrid pickable">${sortDeck(list).map(c => cardHTML(c, { flav: false })).join('') || '<p class="hint">No cards fit.</p>'}</div>`, () => { const f = cb; cb = null; if (f) f(null); });
  $('modalBox').querySelectorAll('.card').forEach(el => {
    const card = RUN.deck.find(c => c.uid == el.dataset.uid);
    const go = () => { const f = cb; cb = null; close(); if (f) f(card); };
    el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
}

/* an unfinished event card comes back after a reload, or as soon as a card pick that was open ahead of it closes.
   Order when the world is free: a pending card pick, then the event, then level-ups and recruits (w6-party.js). */
const wW8Start = wStart;
wStart = function (save, opts) {
  wW8Start(save, opts);
  if (WG && WG.event && UI.view === 'world' && !WG.cardOffer) wOpenEvent();
};
const wW6NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (WG && WG.event && !WG.cardOffer && !LAB && wActive()) { wOpenEvent(); return true; }
  return wW6NextPrompt();
};
