/* w5: the match seam. Every fight in the realm is a Sudden Death match, played by SD's own engine and screens.

   startMatch(o)   o = { ids?, type: 'normal'|'elite'|'rival'|'boss', sport?, tier: 1..3, trait?, stakes?, name?,
                         card?: false to skip the pre-game card, world: { kind, ref } }
     Builds an SD encounter for the tier (RUN.act = tier - 1 while it is played, so TUNE and spawn scale it),
     shows the pre-game card, and kicks off with SD's beginFight. The world context rides on the encounter as plain
     data (RUN.pending.world), so a mid-match save restores it; the party never moves while a match is on.
   When it ends, W_ON_END[world.kind](result, ref, world) runs by name. RUN and B never hold a callback.
   Win: SD's own path (afterCombat, combatRewards, settleStakes, the reward panel), whose Continue comes back here.
   Loss: a blackout (wake at the last inn, poorer), or in Hardcore the end of the save.

   Sudden Death functions reassigned here (never redeclared), and why:
     saveRun, loadRun, clearRun   the realm keeps one save, { v: 2, WG, RUN }, under pkey('sd-realm')
     finishFight                  carry the world context to the reward panel; losses black out instead of ending
     backToMap, advanceAct        the reward panel's Continue returns to the world; a boss never advances SD acts
     renderReward                 its Continue button says where it goes
     renderRunBar                 a tier instead of act and floor, and Concede (a blackout) instead of Forfeit
     openPause                    a Concede button, and the realm's place instead of act and floor
     showEnd                      the Hardcore ending: no "draft a new line", back to the title instead
     renderHelp                   a short "The realm" section
   Also here: the encounter hook (wild matches and alphas) and wGainCard, the one way cards reach the deck from the
   world (chests, topics, and in phase 3, players). */

/* ---------- tiers: a small table, phase 4 tunes it ---------- */
const W_TIER = { plains: 1, bloom: 2, tide: 2, ember: 2, rime: 2 };
const W_DUNGEON_TIER = { hatchery: 2, emberdeep: 2, genevault: 3, deepseam: 3 };
const W_ENC = { mult: 1, runMin: 30, runHp: 3, runFailNight: .4, grace: 8 };
function wTierHere() {
  const m = wCurMap();
  if (m.kind === 'dungeon') return W_DUNGEON_TIER[m.id] || 2;
  return W_TIER[wRegionHere()] || 1;
}

/* ---------- the save: Sudden Death's save calls all land in the realm's one record ---------- */
saveRun = function () { if (LAB) return; if (WG) wSave(); };
loadRun = function () { const s = wLoadSave(); return s && s.RUN && !s.RUN.over ? s.RUN : null; };
clearRun = function () { try { localStorage.removeItem(wSaveKey()); } catch (e) { } };

/* ---------- building and starting a match ---------- */
function wBuildEncounter(o) {
  const tier = clamp(Math.round(o.tier || wTierHere()), 1, 3), type = o.type || 'normal', act0 = RUN.act;
  const world = Object.assign({ kind: 'wild', ref: null }, o.world || {});
  const region = world.region || wRegionHere(), R = DB.regions[region] || DB.regions.plains;
  const want = o.sport || wpick(Object.fromEntries(R.sports));
  let enc;
  RUN.act = tier - 1;
  try {
    if (o.ids && o.ids.length) enc = { ids: o.ids.slice(), type, sport: ENEMIES[o.ids[0]].sport || want };
    else enc = rollEncounter(type, want);
  } finally { RUN.act = act0; }
  if (o.trait !== undefined) { if (o.trait) enc.trait = o.trait; }
  else if (type === 'elite') enc.trait = pick(Object.keys(ELITE_TRAITS));
  if (o.stakes) enc.stakes = o.stakes;
  enc.world = { kind: world.kind, ref: world.ref == null ? null : world.ref, tier, act0, region, map: WG.map, x: WG.x, y: WG.y,
    night: wNightOut() ? 1 : 0, name: o.name || null };
  return enc;
}
function wNightOut() { return wCurMap().kind === 'world' && wIsNight(); }

function startMatch(o) {
  if (!WG || !RUN) return null;
  o = o || {};
  const enc = wBuildEncounter(o);
  WUI.held = null; WUI.goto = null;
  if (o.card === false || LAB) wKickoff(enc); else wPreGame(enc);
  return enc;
}
function wKickoff(enc) {
  RUN.act = enc.world.tier - 1;
  RUN.pending = enc; RUN.battle = null; RUN.panel = null; RUN.wend = null;
  if (typeof wCloseTalk === 'function') wCloseTalk();
  saveRun();
  beginFight(enc);
  wNameLead();
}
/* an alpha leads its own team: the first enemy takes its name */
function wNameLead() {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!W || !W.name || !B || !B.enemies[0]) return;
  B.enemies[0].n = W.name;
  if (!LAB) renderFightHUD();
}

/* ---------- the pre-game card ---------- */
function wFoeTeam(id, tier) { return ENEMIES[id].team || ACTS[tier - 1].team; }
function wFoeNames(enc) { return [...new Set(enc.ids.map(id => ENEMIES[id].n.split(',')[0]))]; }
function wMatchTitle(enc) {
  const W = enc.world, foes = wFoeNames(enc).join(' and ');
  if (W.name) return `${W.name} wants a game`;
  if (W.kind === 'wild') return (W.night ? 'Night game: ' : 'Pickup game: ') + foes;
  return foes;
}
function wPreGame(enc) {
  const W = enc.world, wild = W.kind === 'wild', S = SPORTS[enc.sport];
  const ports = enc.ids.map(id => { const E = ENEMIES[id]; let src = ''; try { src = portraitURL(E.kind, wFoeTeam(id, W.tier), '', 96); } catch (e) { } return src ? `<img src="${src}" alt="${esc(E.n)}" title="${esc(E.n)}">` : ''; }).join('');
  const foes = wFoeNames(enc);
  const T = enc.trait && ELITE_TRAITS[enc.trait];
  let chose = false;
  const close = modal(`<header><h3>${esc(wMatchTitle(enc))}</h3></header>
    <div class="wpg">
      <div class="wpgfoes">${ports}</div>
      <div class="wpgtxt">
        <p class="wpgwho">${W.name ? `${esc(W.name)} and ${esc(foes.join(', '))}` : esc(foes.join(', '))}. ${W.tier === 1 ? 'An easy' : W.tier === 2 ? 'A tough' : 'A very hard'} game (tier ${W.tier}).</p>
        <p class="wpgsport">${sportSVG(enc.sport, 26)}<span><b>${esc(SPORT_NAME[enc.sport])}</b>: ${esc(S.rule)}. ${esc(SPORT_BRIEF[enc.sport] || '')}</span></p>
        ${T ? `<p class="hint">Scouting report: <b>${esc(T.n)}</b>. ${esc(T.desc)} Pays ${esc(T.pay.charAt(0).toLowerCase() + T.pay.slice(1))}</p>` : ''}
        <p class="hint">Your team: ${RUN.hp}/${RUN.maxhp} HP.${WG.hardcore ? ' <b class="wbad">Hardcore: lose and the journey ends.</b>' : ' Lose and you black out, and wake at your last inn.'}</p>
      </div>
    </div>
    <div class="row"><button class="btn" id="wPlay">Play</button>${wild ? `<button class="ghost" id="wRun">Run (${W_ENC.runMin} minutes, ${W_ENC.runHp} HP${W.night ? ', may fail at night' : ''})</button>` : '<button class="ghost" id="wNotYet">Not yet</button>'}</div>`,
    () => { if (!chose) { chose = true; if (wild) wRunAway(enc); else wLog('You back away. It will be here when you are ready.', 'd'); wDrain(); } });
  $('wPlay').focus();
  $('wPlay').onclick = () => { chose = true; close(); wKickoff(enc); };
  if ($('wRun')) $('wRun').onclick = () => close();
  if ($('wNotYet')) $('wNotYet').onclick = () => close();
}
/* running costs time and a little HP; at night it may fail */
function wRunAway(enc) {
  if (enc.world.night && Math.random() < W_ENC.runFailNight) { wLog('You run, but they cut you off in the dark. You have to play.', 'b'); wKickoff(enc); return false; }
  RUN.hp = Math.max(1, RUN.hp - W_ENC.runHp); wAdvance(W_ENC.runMin); WG.grace = 4;
  wLog('You get away, the long way round. (' + W_ENC.runHp + ' HP, ' + W_ENC.runMin + ' minutes)', 'd');
  wSave(); wDrain();
  return true;
}

/* ---------- encounters on the road (TC's encounterRoll) ---------- */
/* one roll per step: the day road is safe, the night road is not, and off-road at night is 25% busier */
function wEncounterRoll(m, c, r) {
  if (m.kind === 'town') return null;
  const td = DB.tiles[c] || {}, night = m.kind === 'world' && wIsNight(), road = m.kind === 'world' && (c === '=' || c === 'b'), N = DB.meta.night;
  let p = td.enc || 0;
  if (road) p = night ? N.roadEnc : 0;
  else if (night) p *= N.encMult;
  p *= W_ENC.mult;
  return r < p ? 'fight' : null;
}
wEncounterHook = function (region, tileCh, info) {
  if (!WG || !RUN) return;
  if (info) {
    if (info.kind === 'alpha' || info.kind === 'lair') return wStartAlpha(info);
    if (info.kind === 'wild') return wWildMatch(region);
    return; // the chapel bell and the cups come in later phases (w3 has already said so)
  }
  if (wEncounterRoll(wCurMap(), tileCh, Math.random()) === 'fight') wWildMatch(region);
};
function wWildMatch(region) {
  return startMatch({ type: 'normal', tier: wTierHere(), world: { kind: 'wild', ref: null, region: region || wRegionHere() } });
}
function wStartAlpha(info) {
  const a = DB.alphas[info.alpha]; if (!a || wFlag('alpha_' + info.alpha)) return null;
  return startMatch({ type: 'elite', tier: wTierHere(), name: wCap(a.name), world: { kind: info.kind, ref: { alpha: info.alpha, loc: info.loc || null } } });
}

/* ---------- what each kind of match does in the world when it ends, looked up by name ---------- */
const W_ON_END = {
  wild(r, ref, W) {
    if (r === 'win') wLog(`You win the pickup game against ${W.foes || 'the locals'}. They wander off to lick their wounds.`, 'g');
  },
  alpha(r, ref, W) {
    if (r !== 'win' || !ref) return;
    wSetFlag('alpha_' + ref.alpha); wInvalidate();
    wLog(`${W.name || 'The alpha'} yields. Its strongbox is yours to open.`, 'g');
  },
  lair(r, ref, W) {
    if (r !== 'win' || !ref) return;
    wSetFlag('alpha_' + ref.alpha); wInvalidate();
    wLog(`${W.name || 'The alpha'} yields, and the lair goes quiet.`, 'g');
  },
};
function wDispatchEnd(W, r) {
  if (!W) return;
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  const f = W_ON_END[W.kind];
  if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
}

/* ---------- the end of a match ---------- */
const wSdFinishFight = finishFight;
finishFight = function () {
  if (!WG) return wSdFinishFight();
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!W || !B) { UI.busy = false; return; } // a stale timer after the match was already settled
  if (B.over === 'lose') return wMatchLost(B.forfeit ? 'quit' : 'lose');
  RUN.wend = Object.assign({}, W, { result: 'win', foes: wFoeNames(RUN.pending).join(' and ') });
  wSdFinishFight(); // afterCombat, combatRewards, settleStakes, the reward panel; clears RUN.pending
};
/* the reward panel's Continue (and every other way SD would go back to its act map) returns to the world */
const wSdBackToMap = backToMap, wSdAdvanceAct = advanceAct;
backToMap = function () { if (!WG) return wSdBackToMap(); wReturnToWorld(); };
advanceAct = function () { if (!WG) return wSdAdvanceAct(); wReturnToWorld(); };
function wReturnToWorld() {
  const W = RUN.wend;
  RUN.wend = null; RUN.panel = null; RUN.pending = null; RUN.battle = null;
  if (W) RUN.act = W.act0;
  WG.grace = W_ENC.grace;
  showView('world');
  wDispatchEnd(W, 'win');
  wSave(); wDrain();
}
function wMatchLost(result) {
  UI.busy = false;
  const W = RUN.pending.world;
  RUN.battle = null;
  logGame(true);
  if (WG.hardcore) {
    WG.lastMatch = { kind: W.kind, result, day: WG.dayAbs, tier: W.tier };
    recordRun(result === 'quit' ? 'quit' : 'lose'); // clears the save
    showEnd(result === 'quit' ? 'quit' : 'lose');
    return;
  }
  RUN.pending = null; RUN.act = W.act0;
  wBlackout(W, result);
}
/* where you wake: next to the innkeeper of your last inn, or Graftonbury's */
function wInnSpot(mapId) {
  const m = MAPS[mapId];
  const inn = (m.npcs || []).find(n => { const ch = DB.chars[n.id]; return ch && Object.values(ch.topics || {}).some(t => t.act === 'inn'); });
  if (inn) {
    let best = null;
    for (let y = inn.y - 3; y <= inn.y + 3; y++) for (let x = inn.x - 3; x <= inn.x + 3; x++) {
      const c = wTileAt(m, x, y), td = c && DB.tiles[c];
      if (!td || !td.walk || td.enter || (m.npcs || []).some(n => n.x === x && n.y === y)) continue;
      const d = Math.abs(x - inn.x) + Math.abs(y - inn.y);
      if (!best || d < best[2]) best = [x, y, d];
    }
    if (best) return [best[0], best[1]];
  }
  return m.spawn.slice();
}
function wBlackout(W, result) {
  const lostG = Math.floor(RUN.gold * .1), lostF = Math.floor((RUN.fans || 0) * .25);
  RUN.gold -= lostG; RUN.fans = (RUN.fans || 0) - lostF;
  RUN.hp = Math.max(RUN.hp, Math.ceil(RUN.maxhp * .5));
  const home = (WG.home && MAPS[WG.home]) ? WG.home : 'graftonbury', at = wInnSpot(home);
  wEnterMap(home, at[0], at[1]); WG.face = 'd';
  wAdvance(240);
  WG.grace = W_ENC.grace; WG.blackouts = (WG.blackouts || 0) + 1;
  const how = result === 'quit' ? 'You walk off the field' : 'Your team goes down';
  const msg = `${how}, and the next thing you know you are waking up at the inn in ${MAPS[home].name}. You lost ${lostG} gold${lostF ? ` and ${lostF} fans` : ''}, and your team is back up to ${RUN.hp}/${RUN.maxhp} HP.`;
  wLog(msg, 'b');
  wDispatchEnd(W, 'lose');
  wSave();
  showView('world');
  if (!LAB) {
    const close = modal(`<header><h3>Blackout</h3></header><div class="wmsg"><p>${esc(msg)}</p><p class="hint">Sleep at an inn to heal fully, and to choose where you wake next time.</p></div><div class="row"><button class="btn" id="wWake">Get up</button></div>`);
    $('wWake').focus(); $('wWake').onclick = () => close();
  }
}
/* conceding: a loss like any other (a blackout, or the end in Hardcore) */
function wConcede() {
  if (!B || B.over || UI.view !== 'fight') return;
  askConfirm('Concede this match?', WG.hardcore ? 'Hardcore: a lost match ends your journey for good.' : 'It counts as a loss: you black out and wake at your last inn, a little poorer.', 'Concede', () => {
    if (UI.paused) closePause();
    if (!B || B.over) return;
    B.over = 'lose'; B.phase = 'done'; B.forfeit = 1;
    if (!UI.busy) finishFight(); // otherwise the enemy turn in progress sees B.over and finishes it
  });
}

/* ---------- Sudden Death screens, told about the realm ---------- */
const wSdRenderReward = renderReward;
renderReward = function () {
  wSdRenderReward();
  if (!WG) return;
  const b = $('bCont'); if (b) b.textContent = 'Back to the road';
};
const wSdRenderRunBar = renderRunBar;
renderRunBar = function () {
  wSdRenderRunBar();
  if (!WG || !RUN) return;
  const W = (RUN.pending && RUN.pending.world) || RUN.wend;
  const st = [...document.querySelectorAll('#runbar .stat')].find(s => { const sm = s.querySelector('small'); return sm && sm.textContent === 'Act'; });
  if (st) st.innerHTML = `<small>Tier</small><b>${W ? W.tier : RUN.act + 1}</b>${WG.hardcore ? '<small class="whard">Hardcore</small>' : ''}`;
  const ab = $('bAbandon');
  if (ab) {
    ab.textContent = 'Concede'; ab.title = 'Give up this match';
    ab.hidden = !(UI.view === 'fight' && B && !B.over);
    ab.onclick = wConcede;
  }
};
const wSdOpenPause = openPause;
openPause = function () {
  wSdOpenPause();
  if (!WG || !RUN || !UI.paused) return;
  const inFight = UI.view === 'fight' && B && !B.over;
  const hint = document.querySelector('#pause .pbox p.hint');
  if (hint && !inFight) hint.textContent = `${wCurMap().name}. ${RUN.hp}/${RUN.maxhp} HP, ${RUN.gold} gold.`;
  const btns = document.querySelector('#pause .pbtns');
  if (btns && inFight && !$('pConcede')) {
    btns.insertAdjacentHTML('beforeend', '<button class="ghost" id="pConcede">Concede the match</button>');
    $('pConcede').onclick = wConcede;
  }
  const sv = $('pSave'); if (sv) sv.textContent = 'Save and quit to title';
};
const wSdShowEnd = showEnd;
showEnd = function (result) {
  wSdShowEnd(result);
  if (!WG) return;
  const W = WG.lastMatch, lede = document.querySelector('#scr-end .lede');
  const place = (MAPS[WG.map] || {}).name || 'the realm';
  if (lede && result !== 'win') lede.textContent = `Hardcore. ${result === 'quit' ? 'You walked off the field' : 'Your team went down'} near ${place}, on day ${WG.day} of year ${WG.year}. The journey ends here.`;
  // the realm's own numbers: no difficulty line, no dungeon score, acts or bosses
  const hint = document.querySelector('#scr-end .panel > p.hint'); if (hint) hint.textContent = `${profileName()}'s journey, Hardcore`;
  const h2 = document.querySelector('#scr-end h2'); if (h2 && result !== 'win') h2.textContent = 'The journey ends';
  const es = document.querySelector('#scr-end .endstats');
  if (es) {
    const alphas = Object.keys(WG.flags).filter(f => f.startsWith('alpha_')).length, R = WG.roster || [];
    const st = [[WG.dayAbs, 'days on the road'], [RUN.stats.fights, 'matches won'], [alphas, 'alphas beaten'], [RUN.stats.sportsWins || 0, 'sports wins'], [RUN.fans || 0, 'fans'], [RUN.stats.gold, 'gold earned']];
    if (R.length) st.push([R.length, 'players'], [Math.max(...R.map(p => p.lvl || 1)), 'top level']);
    es.innerHTML = st.map(([n, t]) => `<div><b>${n}</b>${t}</div>`).join('');
  }
  const b = $('bAgain');
  if (b) { b.textContent = 'Back to the title'; b.onclick = () => { RUN = null; B = null; WG = null; renderTitle(); }; }
};
const wSdRenderHelp = renderHelp;
renderHelp = function () {
  wSdRenderHelp();
  const two = document.querySelector('#pg-help .two');
  if (!two || $('wHelp')) return;
  two.insertAdjacentHTML('beforebegin', `<section id="wHelp" class="whelp"><h3>The realm</h3>
    <p class="hint">You walk the realm with your team. Every fight on the road is a match, played exactly like a Sudden Death fight: wild teams jump you in long grass, woods and fens (more often at night, and the night road is not safe either), and alphas wait in their lairs. Before each match you see who you are facing and the sport. You can try to run from a wild team: it costs time and a little HP, and at night they may cut you off.</p>
    <p class="hint">Your team's HP carries from match to match. A night at an inn heals it fully, and that inn becomes the place you wake up. Win a match and you get the usual rewards: gold, a card, sometimes a trophy. Cards also come from strongboxes and from people you help.</p>
    <p class="hint"><b>Lose a match</b> and you black out: you wake at your last inn (Graftonbury's, if you have not slept anywhere yet) with half your HP back, a tenth of your gold gone, and a quarter of your fans. <b>Hardcore</b> is a choice you make when you start a journey: lose one match, and the journey is over.</p></section>`);
};

/* ---------- cards from the world: the one way in, for chests, topics, and (phase 3) players ----------
   wGainCard('id' | { id, up? }, why)                        adds that card and says so in the log
   wGainCard({ pick: 3, rarity?, kind?, pool? }, why)        offers a pick of N with Skip, in SD's card-choice row
   rarity: 'c'|'u'|'r'|'l' or a list; kind: an SD kind ('any' for league cards); pool: a list of card ids.
   Without rarity, kind or pool, the pick is SD's own cardChoices (the party's cards and the league's). */
function wCardName(id, up) { const c = CARDS[id]; return c ? c.n + (up ? '+' : '') : id; }
function wGainCard(spec, why) {
  if (!RUN || spec == null) return null;
  if (typeof spec === 'string' || spec.id) {
    const id = typeof spec === 'string' ? spec : spec.id, up = !!(spec && spec.up);
    if (!CARDS[id]) return null;
    const c = mkCard(id, up);
    RUN.deck.push(c); RUN.stats.cards = (RUN.stats.cards || 0) + 1;
    assignOwners();
    wLog(`New card: ${wCardName(id, up)}${why ? ' (' + why + ')' : ''}.`, 'm');
    if (!LAB && typeof sfx !== 'undefined' && sfx.card) sfx.card();
    wSave();
    return c;
  }
  const list = wCardOffer(spec);
  if (!list.length) return null;
  WG.cardOffer = { list, why: why || '' };
  wSave();
  wShowCardOffer();
  return list;
}
function wCardOffer(spec) {
  const n = Math.max(1, spec.pick || 3);
  let ids = null;
  if (spec.pool) ids = spec.pool.filter(id => CARDS[id]);
  else if (spec.rarity || spec.kind) {
    const rars = [].concat(spec.rarity || ['c', 'u', 'r']);
    ids = rars.flatMap(r => cardPool(r)).filter(c => !spec.kind || c.kind === spec.kind).map(c => c.id);
  }
  if (ids) return shuffle([...new Set(ids)]).slice(0, n).map(id => ({ id, up: false }));
  return cardChoices('normal', n).map(c => ({ id: c.id, up: !!c.up }));
}
function wShowCardOffer() {
  const O = WG && WG.cardOffer; if (!O || LAB) return;
  const close = modal(`<header><h3>Pick a card</h3><button class="ghost" data-close>Skip</button></header>
    <p class="hint">${O.why ? esc(wCap(O.why)) + '. ' : ''}Take one for your deck, or skip them all.</p>${cardChoiceRow(O.list, 'wco')}`,
    () => { if (WG && WG.cardOffer === O) { WG.cardOffer = null; wLog('You leave the cards where they are.', 'd'); wSave(); wDrain(); } });
  $('modalBox').querySelectorAll('[data-wco]').forEach(el => {
    const go = () => { const c = O.list[+el.dataset.wco]; WG.cardOffer = null; close(); wGainCard({ id: c.id, up: c.up, pid: O.pid }, O.why); wDrain(); };
    el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
}
