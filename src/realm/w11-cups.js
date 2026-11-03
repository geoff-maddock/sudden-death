/* w11: cups, rivals and the Crown (phase 6).

   Town cups. Each town's registrar takes entries (the topic ENTER, act 'cup:<id>'). A cup is three rounds played in
   order: a local side (normal), a named elite with a scouting trait, then the region's rival club. A loss knocks you
   out; you can pay the fee and enter again at once. Rounds are played in the cup's region sports. The field gets
   harder with every cup you already hold (W_CUP.tier and W_CUP.lvPerCup), so the fourth is the hard one, whichever it
   is. Winning a cup sets its flag (cup_moss ...), cups1..cupsN, pays a prize and goes on the Wall of Awards.
   WG.cup = { id, round, ready?, clubs? } is the cup you are in (plain data, saved with WG).

   Rivals remember you. The four rival slots (TC's companies) play as the SD clubs in WG.rivals (w6-party.js). They are round 3 of the
   town cups, the first two rounds of the Crown, and the road's 'rival' event. Every match against one is kept in
   WG.h2h[clubId] = { w, l, last: { r, us, them, sport, day } } ('apex' for the Crown final), shown on the Camp and on
   the pre-game card ("They remember last time: you won, 3-1.").

   The Crown. At the Crown Coliseum (Steward Crane, topic ENTER, act 'cup:crown'), only in championship week and only
   with four cups: two rival clubs (the two with the best record against you), then the apex club, Apex Athletic,
   fielding a Sudden Death Act 3 boss. Win it and 'champion' is set and the champion ending shows, with a button to keep
   exploring (the save goes on). Once per year. The steward's WAIT (act 'waitweek') is for entrants with four cups.

   Realm functions wrapped here (saved originals carry the wW11 prefix): wRunAct (the cup acts and waitweek),
   wPreGame (round line and the rivals' memory), wMatchTitle, wMatchTeam (club, town and Apex colours), wOpenEvent
   (the road rival is one of your rivals), wWallText (years won), wCampTeam (head to head), wNextPrompt (the next
   round's card), wReturnToWorld (the champion ending). Sudden Death's renderHelp is reassigned (wW11RenderHelp).
   W_ON_END.cup is new; W_ON_END.event is wrapped to keep the head to head. */

/* ---------- the numbers (phase 7 tunes these) ---------- */
const W_CUP = {
  fee: 30,                          // gold to enter a town cup, and to enter again after a loss
  rounds: ['normal', 'elite', 'rival'],
  tier: [1, 2, 3, 3],               // the field's tier by cups already won (bot-tuned, phase 7: the first cup is the way in)
  lv: [0, 1, 1],                    // level by round, before cups
  lvPerCup: .5,                     // plus floor(cups won x this) levels, at most W_ROAD.maxLv
  prize: { gold: 120, fans: 40, pick: 3, rarity: 'r' },   // a town cup: gold, fans, and a pick of rare cards
  crown: { tier: 3, lv: [1, 2, 3], prize: { gold: 300, fans: 120 } },
  home: { moss: 'wildgraft', salt: 'cauldron', cind: 'thaumagen', rime: 'helix' },  // each cup's rival slot (DB.companies)
  apexTeam: { name: 'Apex Athletic', short: 'APX', color: '#f2c14e', light: '#fff1c2' },
};
const W11 = { ending: false };
const W_TOWN_CUPS = ['moss', 'salt', 'cind', 'rime'];

/* the rival's and the registrars' CUP lines, for the cup rules below (the crown's name and the rival's job are in w1) */
DB.chars.rival.topics.cup.t = 'Every cup puts a rival club in the last round. We do not throw matches. We have shareholders. And we remember every score.';
for (const id of ['moss_reg', 'salt_reg', 'cind_reg', 'rime_reg']) if (DB.chars[id]) DB.chars[id].topics.cup.t = `Three rounds, back to back: a local side, a seeded team with a trick or two, then a rival club. Lose once and you are out, but you can enter again. Win all three and the cup goes on your wall. The League sets the field to your record, so it never gets easier. Entry is ${W_CUP.fee} gold. Say ENTER when your team is ready.`;

/* ---------- head to head ---------- */
function wH2h() { return (WG.h2h = WG.h2h || {}); }
function wH2hName(k) { return k === 'apex' ? DB.apex.name : CLUBS[k] ? CLUBS[k].name : k; }
// at: the game's { us, them, sport } when it wasn't a card-game match (the last one in RUN.games is used otherwise)
function wH2hRecord(k, r, at) {
  if (!k || !WG) return;
  const H = wH2h(), h = H[k] = H[k] || { w: 0, l: 0 }, gs = RUN.games || [], g = at || gs[gs.length - 1] || {};
  if (r === 'win') h.w++; else h.l++;
  h.last = { r: r === 'win' ? 'win' : 'lose', us: typeof g.us === 'number' ? g.us : null, them: typeof g.them === 'number' ? g.them : null, sport: g.sport || null, day: WG.dayAbs };
}
function wH2hLast(k) {
  const h = WG && WG.h2h && WG.h2h[k]; if (!h || !h.last) return '';
  const L = h.last, sc = L.us != null && L.them != null && L.sport !== 'golf' && L.sport !== 'bowling' ? `, ${L.us}–${L.them}` : '';
  return `They remember last time: ${L.r === 'win' ? 'you won' : 'they won'}${sc}${L.sport ? ` (${SPORT_NAME[L.sport] || L.sport})` : ''}. Head to head: ${h.w}–${h.l}.`;
}

/* ---------- who you play ---------- */
function wCupDef(id) { return DB.cups[id]; }
/* 'the Mosswold Cup', 'the Crown' */
function wCupThe(id) { const C = DB.cups[id]; return !C ? 'the cup' : id === 'crown' ? 'the Crown' : 'the ' + C.name; }
function wCupRival(id) { return (WG.rivals || {})[W_CUP.home[id]] || null; }
function wClubCaptain(club) { const c = CLUBS[club]; return c ? c.roster[0][0] : 'Their captain'; }
/* the two rival clubs with the best record against you go to the Crown */
function wCrownClubs() {
  const H = wH2h(), cl = Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i);
  const sc = c => { const h = H[c] || { w: 0, l: 0 }; return (h.l - h.w) * 10 + h.w + h.l; };
  return cl.map((c, i) => [c, sc(c), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).slice(0, 2).map(x => x[0]);
}
/* the round's opponent: { name, club?, apex? } */
function wCupWho(id, i) {
  const C = wCupDef(id);
  if (id === 'crown') {
    if (i < 2) { const club = WG.cup && WG.cup.clubs && WG.cup.clubs[i]; return { name: wClubCaptain(club), club }; }
    return { name: null, apex: 1 };
  }
  if (i === 2) { const club = wCupRival(id); return { name: wClubCaptain(club), club }; }
  const who = (C.rounds[i === 0 ? 0 : 2] || {}).who || 'The locals';
  return { name: who.split(',')[0] };
}
function wCupSports(id) {
  if (id !== 'crown') return Object.fromEntries(DB.regions[wCupDef(id).elem].sports);
  const out = {}; for (const r in DB.regions) for (const [s, w] of DB.regions[r].sports) out[s] = (out[s] || 0) + w;
  return out;
}
/* the startMatch options for round i of cup id */
function wCupMatch(id, i) {
  const C = wCupDef(id), who = wCupWho(id, i), crown = id === 'crown', cups = wCupsWon();
  const type = crown ? (i < 2 ? 'rival' : 'boss') : W_CUP.rounds[i];
  const tier = crown ? W_CUP.crown.tier : W_CUP.tier[Math.min(cups, 3)];
  const lv = crown ? W_CUP.crown.lv[i] : Math.min(W_ROAD.maxLv, W_CUP.lv[i] + Math.floor(cups * W_CUP.lvPerCup));
  const region = crown ? 'plains' : C.elem;
  return { type, tier, lv, ambush: false, sport: wpick(wCupSports(id)), name: who.name, world: { kind: 'cup', ref: { cup: id, round: i, club: who.club || (who.apex ? 'apex' : null) }, region } };
}

/* ---------- entering and playing ---------- */
/* '' if you may enter (or carry on), or why not */
function wCupProblem(id) {
  const C = wCupDef(id); if (!C) return 'There is no such cup.';
  if (WG.cup && WG.cup.id === id) return '';
  if (id === 'crown') {
    if (wFlag('champion') && WG.crownYear === WG.year) return 'You hold the crown this year. Come back next championship week to defend it.';
    if (wCupsWon() < 4) return `Four regional cups to enter. You hold ${wCupsWon()}.`;
    if (!wChampWeek()) return `Entries open in championship week, in ${wDaysToChamp()} day${wDaysToChamp() === 1 ? '' : 's'}.`;
    return '';
  }
  if (wFlag(C.flag)) return `${wCap(wCupThe(id))} is already on your wall.`;
  if (RUN.gold < W_CUP.fee) return `Entry is ${W_CUP.fee} gold, and you have ${RUN.gold}.`;
  return '';
}
/* enter a cup (or carry on with the one you are in). o.card === false skips the pre-game card (tests). Returns '' or why not. */
function wCupEnter(id, o) {
  o = o || {};
  const why = wCupProblem(id); if (why) { wLog(why, 'b'); return why; }
  const C = wCupDef(id);
  if (!WG.cup || WG.cup.id !== id) {
    if (WG.cup) wLog(`You withdraw from ${wCupThe(WG.cup.id)}.`, 'd');
    WG.cup = { id, round: 0 };
    if (id === 'crown') { WG.cup.clubs = wCrownClubs(); WG.cup.year = WG.year; }
    else { RUN.gold -= W_CUP.fee; wLog(`You pay ${W_CUP.fee} gold and sign up for ${wCupThe(id)}.`, 'm'); }
    if (id === 'crown') wLog('You are entered for the Crown. Three rounds, and the last is against Apex Athletic.', 'g');
  }
  wSave();
  return wCupPlay(o);
}
function wCupPlay(o) {
  o = o || {};
  const S = WG && WG.cup; if (!S) return 'You are not in a cup.';
  S.ready = 0;
  const spec = wCupMatch(S.id, S.round);
  if (o.card === false) spec.card = false;
  startMatch(spec);
  return '';
}
function wCupWithdraw() { if (!WG || !WG.cup) return; wLog(`You withdraw from ${wCupThe(WG.cup.id)}.`, 'd'); WG.cup = null; wSave(); }

/* ---------- when a cup match ends ---------- */
W_ON_END.cup = function (r, ref, W) {
  if (!ref) return;
  if (ref.club) wH2hRecord(ref.club, r);
  const S = WG.cup, C = wCupDef(ref.cup);
  if (!S || S.id !== ref.cup || S.round !== ref.round || !C) return;
  if (r !== 'win') {
    WG.cup = null;
    wLog(`Knocked out of ${wCupThe(ref.cup)} in round ${ref.round + 1}.${ref.cup === 'crown' ? ' You can enter again with the steward while championship week lasts.' : ` Enter again with the registrar whenever you like (${W_CUP.fee} gold).`}`, 'b');
    return;
  }
  S.round++;
  if (S.round >= 3) { wCupWon(ref.cup); return; }
  S.ready = 1;
  const nx = wCupWho(ref.cup, S.round);
  wLog(`${C.name}: through to round ${S.round + 1} of 3${nx.club ? `, against the ${CLUBS[nx.club].name}` : nx.apex ? ', the final' : ''}.`, 'g');
};
function wCupWon(id) {
  const C = wCupDef(id);
  WG.cup = null;
  wSetFlag(C.flag);
  WG.cupLog = WG.cupLog || {}; WG.cupLog[id] = { year: WG.year, day: WG.day };
  if (id === 'crown') {
    WG.crownYear = WG.year; WG.crowns = (WG.crowns || []).concat(WG.year);
    const P = W_CUP.crown.prize; RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
    wLog(`You win the Crown! Apex Athletic's run is over. ${P.gold} gold and ${P.fans} fans.`, 'g');
    W11.ending = true;
    return;
  }
  const n = wCupsWon();
  for (let k = 1; k <= n; k++) wSetFlag('cups' + k);
  const P = W_CUP.prize; RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  wLog(`You win ${wCupThe(id)}! It goes up on the Wall of Awards (${n} of 4). ${P.gold} gold and ${P.fans} fans.${n === 4 ? ' Four cups: the Crown Coliseum will take your entry in championship week.' : ''}`, 'g');
  wGainCard({ pick: P.pick, rarity: P.rarity }, wCupThe(id) + ' prize');
}
/* the road's rival event keeps the head to head too */
const wW11OnEvent = W_ON_END.event;
W_ON_END.event = function (r, ref, W) {
  if (wW11OnEvent) wW11OnEvent(r, ref, W);
  if (ref && ref.rival) wH2hRecord(ref.rival, r);
};

/* ---------- the champion ending: Sudden Death's end screen, and the road goes on ---------- */
function wCrownEnding() {
  if (LAB) return;
  showEnd('win');
  const h2 = document.querySelector('#scr-end h2'); if (h2) h2.textContent = 'Champions of the realm';
  const hint = document.querySelector('#scr-end .panel > p.hint'); if (hint) hint.textContent = `${profileName()}'s journey${WG.hardcore ? ', Hardcore' : ''}`;
  const lede = document.querySelector('#scr-end .lede');
  if (lede) lede.textContent = `The ${CLUBS[RUN.club].name} beat Apex Athletic at the Crown Coliseum, on day ${WG.day} of year ${WG.year}. ${RUN.party.map(p => p.n).join(', ')} carry the crown around the sand, and Old Nell sweeps up after them.`;
  const es = document.querySelector('#scr-end .endstats');
  if (es) es.insertAdjacentHTML('afterbegin', `<div><b>${wCupsWon()}</b>cups</div><div><b>${(WG.crowns || []).length}</b>crown${(WG.crowns || []).length === 1 ? '' : 's'}</div>`);
  const b = $('bAgain');
  if (b) {
    b.textContent = 'Keep exploring';
    b.onclick = () => { showView('world'); WUI.hudKey = ''; wDrain(); };
    b.insertAdjacentHTML('afterend', '<button class="ghost" id="wEndTitle">Back to the title</button>');
    $('wEndTitle').onclick = () => { wSave(); RUN = null; B = null; WG = null; renderTitle(); };
  }
}
const wW11ReturnToWorld = wReturnToWorld;
wReturnToWorld = function () {
  wW11ReturnToWorld();
  if (W11.ending) { W11.ending = false; wSave(); wCrownEnding(); }
};

/* ---------- talk acts ---------- */
const wW11RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act && act.startsWith('cup:')) {
    const cup = act.slice(4), why = wCupProblem(cup);
    if (why) { wLog(why, 'b'); wTalkReply(why); return; }
    if (!LAB) wTalkReply(WG.cup && WG.cup.id === cup ? `Round ${WG.cup.round + 1} of 3. Your opponents are waiting.` : cup === 'crown' ? 'Then let us see what you have built.' : `Sign here. And here. ${W_CUP.fee} gold, thank you.`);
    wCupEnter(cup);
    return;
  }
  if (act === 'waitweek') {
    if (!wChampWeek() && wCupsWon() < 4) { const t = `The guest rooms are for entrants. Come back with four cups (you hold ${wCupsWon()}).`; wLog(t, 'b'); wTalkReply(t); return; }
    wW11RunAct(act, id); wSave(); return;
  }
  return wW11RunAct(act, id);
};
/* the talk panel shows what the steward or registrar actually said */
function wTalkReply(t) { if (LAB || typeof WUI === 'undefined' || !WUI.talk) return; WUI.talk.text = t; wRenderTalk(); }

/* ---------- the pre-game card ---------- */
function wCupRoundText(W) {
  const ref = W.ref || {}, C = wCupDef(ref.cup); if (!C) return '';
  const what = ref.cup === 'crown' ? (ref.round === 2 ? 'The final' : `Round ${ref.round + 1} of 3`) : `Round ${ref.round + 1} of 3`;
  return `${C.name}. ${what}. Lose and you are out of the cup.`;
}
const wW11MatchTitle = wMatchTitle;
wMatchTitle = function (enc) {
  const W = enc.world, ref = W.ref || {};
  if (W.kind !== 'cup' || !wCupDef(ref.cup)) return wW11MatchTitle(enc);
  const boss = enc.ids.find(id => ENEMIES[id].boss), C = wCupDef(ref.cup);
  const who = ref.club === 'apex' ? `Apex Athletic and ${boss ? ENEMIES[boss].n.split(',')[0] : wFoeNames(enc)[0]}` : ref.club && CLUBS[ref.club] ? `the ${CLUBS[ref.club].name}` : (W.name || wFoeNames(enc).join(' and '));
  return `${C.name}, ${ref.cup === 'crown' && ref.round === 2 ? 'the final' : 'round ' + (ref.round + 1)}: ${who}`;
};
const wW11PreGame = wPreGame;
wPreGame = function (enc) {
  wW11PreGame(enc);
  const W = enc.world, box = document.querySelector('#modalBox .wpgtxt'); if (!box) return;
  const ref = W.ref || {}, club = W.kind === 'cup' ? ref.club : W.kind === 'event' ? ref.rival : null;
  const bits = [];
  if (W.kind === 'cup') bits.push(`<p class="wcupround"><b>${esc(wCupRoundText(W))}</b></p>`);
  const mem = club && wH2hLast(club);
  if (mem) bits.push(`<p class="wh2hline">${esc(mem)}</p>`);
  else if (club) bits.push(`<p class="wh2hline">First meeting with the ${esc(wH2hName(club))}. They will remember this one.</p>`);
  if (bits.length) box.insertAdjacentHTML('afterbegin', bits.join(''));
  if (W.kind === 'cup') { const ny = $('wNotYet'); if (ny) ny.title = 'You stay in the cup: talk to the registrar to play this round.'; }
};
/* team colours: a rival club in its own, the Crown final in Apex gold, the rest of a cup in the town's colours */
const wW11MatchTeam = wMatchTeam;
wMatchTeam = function (W) {
  if (W && W.kind === 'cup' && W.ref) {
    const c = W.ref.club;
    if (c === 'apex') return Object.assign({}, W_CUP.apexTeam);
    if (c && CLUBS[c]) return { name: CLUBS[c].name, short: CLUBS[c].short, color: CLUBS[c].color, light: CLUBS[c].light };
    return W_WILD_TEAM[W.region] || null;
  }
  return wW11MatchTeam(W);
};

/* ---------- the next round's card, when the world is free ---------- */
const wW11NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (W11.ending) return false; // the champion ending first; level-ups wait for Keep exploring
  if (wW11NextPrompt()) return true;
  if (!WG || !WG.cup || !WG.cup.ready || LAB || WG.cardOffer || WG.event || (WG.wprompts || []).length || !wActive()) return false;
  wCupPlay();
  return true;
};

/* ---------- the road's rival is one of yours ---------- */
const wW11OpenEvent = wOpenEvent;
wOpenEvent = function () {
  const S = WG && WG.event, rv = Object.values((WG && WG.rivals) || {}).filter(c => CLUBS[c]);
  if (S && S.rival && !S.wr && rv.length) { S.wr = 1; if (!rv.includes(S.rival)) S.rival = pick(rv); }
  return wW11OpenEvent();
};

/* ---------- the Wall of Awards and the Camp ---------- */
const wW11WallText = wWallText;
wWallText = function () {
  const L = WG.cupLog || {}, won = Object.keys(DB.cups).filter(c => wFlag(DB.cups[c].flag));
  if (!won.length) return wW11WallText();
  wLog('The Wall of Awards. Your cups: ' + won.map(c => DB.cups[c].name + (L[c] ? ` (year ${L[c].year})` : '')).join(', ') + `. ${wCupsWon()} of 4 regional cups${wFlag('champion') ? ', and the crown' : ''}.`, 'g');
};
function wH2hHtml() {
  const H = WG.h2h || {}, ks = Object.keys(H).filter(k => H[k].w + H[k].l);
  if (!ks.length) return '';
  return `<p class="hint wh2h">Head to head: ${ks.map(k => { const h = H[k], L = h.last; return `the ${esc(wH2hName(k))} ${h.w}–${h.l}${L ? ` (last: ${L.r === 'win' ? 'won' : 'lost'}${L.us != null && L.them != null && L.sport !== 'golf' && L.sport !== 'bowling' ? ' ' + L.us + '–' + L.them : ''}, day ${L.day})` : ''}`; }).join('; ')}.</p>`;
}
function wCupStatusHtml() {
  const S = WG.cup, C = S && wCupDef(S.id);
  const won = W_TOWN_CUPS.filter(c => wFlag(DB.cups[c].flag)).map(c => DB.cups[c].name);
  return `<p class="hint wcups">Cups: ${won.length ? esc(won.join(', ')) : 'none yet'} (${won.length} of 4)${wFlag('champion') ? '. Champions of the realm' : ''}.${C ? ` In ${esc(wCupThe(S.id))}: round ${S.round + 1} of 3 next.` : ''}</p>`;
}
const wW11CampTeam = wCampTeam;
wCampTeam = function () { return wW11CampTeam() + wCupStatusHtml() + wH2hHtml(); };

/* ---------- How to play ---------- */
const wW11RenderHelp = renderHelp;
renderHelp = function () {
  wW11RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelpCups')) return;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelpCups"><h4>Cups, rivals and the Crown</h4>
    <p class="hint"><b>Town cups.</b> Mossgate, Saltmere, Cinderhold and Rimewatch each hold a cup. Enter with the town's registrar (ask about the CUP, then ENTER) for ${W_CUP.fee} gold. A cup is three rounds in a row, in the region's sports: a local side, a seeded team with a scouting report, then a rival club. Lose once and you are out, but you can enter again. Each cup you already hold makes the next field tougher. Win all three rounds for gold, fans, a rare card, and a place on the Wall of Awards.</p>
    <p class="hint"><b>Rivals.</b> Four rival clubs follow you round the realm: in the last round of the cups, in the Crown, and on the road. They keep score. The pre-game card says how the last game went, and the Team screen shows your record against each of them.</p>
    <p class="hint"><b>The Crown.</b> Once a year, in championship week (the last ${DB.meta.champWeek} days of the year), Steward Crane at the Crown Coliseum takes entries from teams with all four cups. Three rounds: the two rivals with the best record against you, then Apex Athletic, who field a monster from Sudden Death's last act. Win it and you are champions of the realm, and the road goes on. With four cups and the week still to come, you can WAIT at the Coliseum.</p></div>`);
};
