/* w21b: playing at a ground (issue #6, phase 2). Loads after w21-grounds.js; changes earlier parts only by
   reassignment (saved originals carry the wW21b prefix).

   Every groundskeeper puts on a GAME (act 'gmatch'): a card-game match locked to the ground's sport, against the
   city's own club. A Friendly is a normal match at the region's tier; a Challenge is a seeded side (an elite, with a
   scouting report) one tier up. One game a day at each ground, won or lost. Rewards are the usual ones for the
   match's type; a loss is a blackout, as on the road. The Ballpark's GAME stays a ball game on the diamond (w20d).

   The squad rule. A ground hosts your team only once you have recruited enough players for its sport
   (W_GRD_SQUAD): four for the one-on-one and small-side sports, up to seven for football. The ballpark's is the ball
   game's own (W_BALL.minOwn). Wild matches, cups and dungeons stay open from the start.

   WG.grd = { met: { groundId: dayAbs }, rec: { groundId: { w, l, last: { r, us, them, mode, day } } } }, plain data.
   wGrdProblems(id)          what stops your team playing at a ground today, as sentences (empty when it can)
   wStartGrd(id, mode)       '' when the pre-game card opened, or why not; mode 'friendly' | 'challenge'
   wOpenGrdCard(id)          the keeper's card: the squad, your record here, Friendly and Challenge
   W_ON_END.ground           the record, the scoreboard, and the day's game used up
   Wrapped: wRunAct (wW21bRunAct: 'gmatch'), wBuildEncounter (wW21bBuildEncounter: the sport is the ground's),
   wMatchTitle, wMatchTeam (the city club's name and the sport's colour), wPreGame (the ground's line), wUse (the
   scoreboard shows your record), wJRules (your record in the journal), renderHelp (#wHelpGrdPlay). */

const W_GRD_SQUAD = { golf: 4, jousting: 4, boxing: 4, curling: 4, bowling: 5, basketball: 5, baseball: W_BALL.minOwn, hockey: 6, football: 7 };
const W_GRD_WHY = {
  golf: 'four to a fourball', jousting: 'two to ride and two to squire', boxing: 'a boxer, a second, a cutman and a trainer',
  curling: 'a rink of four: lead, second, third and skip', bowling: 'five to a bowling side', basketball: 'five on the court',
  baseball: 'five of your own, and call-ups fill the nine', hockey: 'six on the ice', football: 'seven on the pitch',
};
const W_GRD_PLAY = {
  friendly: { n: 'Friendly', type: 'normal', up: 0, what: 'the city club, at the region\'s tier' },
  challenge: { n: 'Challenge', type: 'elite', up: 1, what: 'a seeded side with a trick or two, a tier up, for an elite\'s rewards' },
};

function wGrdState() {
  const G = WG.grd = WG.grd || { met: {}, rec: {} };
  G.met = G.met || {}; G.rec = G.rec || {};
  return G;
}
function wGrdNeed(id) { const g = wGrd(id); return g ? W_GRD_SQUAD[g.sport] || W_PARTY.max : 0; }
function wGrdTier(id, mode) { const g = wGrd(id); return clamp((W_TIER[W_GRD_REG[g.city]] || 1) + ((W_GRD_PLAY[mode] || {}).up || 0), 1, 3); }
function wGrdClub(g) { return `${W_GRD_CITY[g.city]} ${SPORT_NAME[g.sport]} Club`; }
function wGrdProblems(id) {
  const g = wGrd(id); if (!g) return ['There is no ground here.'];
  if (g.sport === 'baseball') return wBallProblems();
  const n = wRoster().length, need = wGrdNeed(id), out = [];
  if (n < need) out.push(`Recruit ${need - n} more player${need - n === 1 ? '' : 's'}: ${SPORT_NAME[g.sport].toLowerCase()} here needs a squad of ${need} (${W_GRD_WHY[g.sport]}), and you have ${n}.`);
  if (wGrdState().met[id] === WG.dayAbs) out.push(`You have played at ${g.name} today. Come back tomorrow.`);
  return out;
}
function wGrdRecText(id) {
  const h = wGrdState().rec[id]; if (!h || !(h.w + h.l)) return '';
  const L = h.last, sc = L && L.us != null && L.them != null && !['golf', 'bowling'].includes(wGrd(id).sport) ? `, ${L.us}–${L.them} on the scoreboard` : '';
  return `Your record here: ${h.w}–${h.l}.${L ? ` Last game: ${L.r === 'win' ? 'won' : 'lost'} the ${(W_GRD_PLAY[L.mode] || W_GRD_PLAY.friendly).n.toLowerCase()}${sc}.` : ''}`;
}

/* ---------- starting a game ---------- */
function wStartGrd(id, mode) {
  const g = wGrd(id), P = W_GRD_PLAY[mode];
  if (!g || !P || g.sport === 'baseball') return 'There is no game like that here.';
  const probs = wGrdProblems(id); if (probs.length) return probs[0];
  startMatch({ type: P.type, sport: g.sport, tier: wGrdTier(id, mode), world: { kind: 'ground', ref: { g: id, mode }, region: W_GRD_REG[g.city] } });
  return '';
}
// the card game is locked to the ground's sport, whichever team turns up
const wW21bBuildEncounter = wBuildEncounter;
wBuildEncounter = function (o) {
  const enc = wW21bBuildEncounter(o);
  if (enc.world.kind === 'ground' && o && o.sport) { enc.sport = o.sport; enc.world.team = enc.world.region; }
  return enc;
};

/* ---------- the keeper's card ---------- */
function wOpenGrdCard(id, msg) {
  const g = wGrd(id); if (!g) return;
  const probs = wGrdProblems(id), n = wRoster().length, need = wGrdNeed(id), S = SPORTS[g.sport], rec = wGrdRecText(id);
  const rows = Object.keys(W_GRD_PLAY).map(mode => {
    const P = W_GRD_PLAY[mode];
    return `<li class="wbcl"><span class="wbsw" style="background:${W_GRD_COL[g.sport]}"></span><div><b>${P.n}</b><small>Against ${esc(P.what)}. Tier ${wGrdTier(id, mode)}.</small></div>
      <div class="row"><button class="${mode === 'friendly' ? 'btn' : 'ghost'}" data-gplay="${mode}" ${probs.length ? 'disabled' : ''}>Play</button></div></li>`;
  }).join('');
  const close = modal(`<header><h3>A game at ${esc(g.name)}</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}
    <p class="wpgsport">${sportSVG(g.sport, 26)}<span><b>${esc(SPORT_NAME[g.sport])}</b> only: ${esc(S.rule)}. ${esc(SPORT_BRIEF[g.sport] || '')}</span></p>
    <p class="hint">Squad: ${n < need ? `<b>${n} of ${need}</b> players` : `<b>${n} players</b>, ${need} needed`} (${esc(W_GRD_WHY[g.sport])}). The ${esc(wGrdClub(g))} play you once a day, win or lose. A loss is a blackout, as on the road.${rec ? ' ' + esc(rec) : ''}</p>
    <ul class="wbclubs">${rows}</ul>`);
  $('modalBox').querySelectorAll('[data-gplay]').forEach(b => b.onclick = () => {
    close();
    const r = wStartGrd(id, b.dataset.gplay);
    if (r) wOpenGrdCard(id, r);
  });
}
for (const g of W_GRDS) if (g.sport !== 'baseball') {
  DB.chars['gk_' + g.id.slice(2)].topics.game = { t: `A ${SPORT_NAME[g.sport].toLowerCase()} side here is ${W_GRD_SQUAD[g.sport]}: ${W_GRD_WHY[g.sport]}. Here is what is on.`, act: 'gmatch' };
}
const wW21bRunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'gmatch') { const gid = 'g_' + String(id || '').replace(/^gk_/, ''); return LAB ? null : void wOpenGrdCard(wGrd(gid) ? gid : WG.map); }
  return wW21bRunAct(act, id);
};

/* ---------- the match's look ---------- */
const wW21bMatchTitle = wMatchTitle;
wMatchTitle = function (enc) {
  const W = enc.world, g = W.kind === 'ground' && W.ref && wGrd(W.ref.g);
  if (!g) return wW21bMatchTitle(enc);
  return `${(W_GRD_PLAY[W.ref.mode] || W_GRD_PLAY.friendly).n} at ${g.name}: the ${wGrdClub(g)}`;
};
const wW21bMatchTeam = wMatchTeam;
wMatchTeam = function (W) {
  const g = W && W.kind === 'ground' && W.ref && wGrd(W.ref.g);
  if (!g) return wW21bMatchTeam(W);
  const col = W_GRD_COL[g.sport];
  return { name: wGrdClub(g), short: W_GRD_CITY[g.city].slice(0, 3).toUpperCase(), color: col, light: tint(col, .55) };
};
const wW21bPreGame = wPreGame;
wPreGame = function (enc) {
  wW21bPreGame(enc);
  const W = enc.world, g = W.kind === 'ground' && W.ref && wGrd(W.ref.g), who = document.querySelector('#modalBox .wpgwho');
  if (g && who) who.insertAdjacentHTML('beforebegin', `<p class="wpground">${esc(g.name)}, ${esc(SPORT_NAME[g.sport].toLowerCase())} only. ${esc(wGrdRecText(g.id) || 'Your first game here.')}</p>`);
};

/* ---------- the end ---------- */
W_ON_END.ground = function (r, ref, W) {
  const g = ref && wGrd(ref.g); if (!g) return;
  const G = wGrdState(), h = G.rec[g.id] = G.rec[g.id] || { w: 0, l: 0 }, last = (RUN.games || [])[RUN.games.length - 1] || {};
  G.met[g.id] = WG.dayAbs;
  if (r === 'win') h.w++; else h.l++;
  h.last = { r: r === 'win' ? 'win' : 'lose', us: typeof last.us === 'number' ? last.us : null, them: typeof last.them === 'number' ? last.them : null, mode: ref.mode || 'friendly', day: WG.dayAbs };
  const at = g.name.replace(/^The /, 'the ');
  if (r === 'win') wLog(`You beat the ${wGrdClub(g)} at ${at}. The crowd stays to clap you off.`, 'g');
  else wLog(`The ${wGrdClub(g)} beat you at ${at}.`, 'b');
};

/* the scoreboard shows the last game here */
const wW21bUse = wUse;
wUse = function (x, y) {
  const m = wCurMap(), g = m.grd && wGrd(m.grd);
  if (!g || wTileAt(m, x, y) !== '%') return wW21bUse(x, y);
  const h = wGrdState().rec[g.id], L = h && h.last;
  if (!L || g.sport === 'baseball') return wW21bUse(x, y);
  const sc = L.us != null && L.them != null && !['golf', 'bowling'].includes(g.sport) ? `you ${L.us}, home ${L.them}, and ` : '';
  wLog(`The scoreboard: ${sc}${L.r === 'win' ? 'you won the match' : 'the home side won the match'}. Your record here: ${h.w}–${h.l}.`, 'g');
};

/* ---------- the journal and How to play ---------- */
const wW21bJRules = wJRules;
wJRules = function (id) {
  const out = wW21bJRules(id), g = wGrd(id);
  if (g && g.sport !== 'baseball') out.push(`A ${esc(SPORT_NAME[g.sport].toLowerCase())} squad is ${W_GRD_SQUAD[g.sport]} players. The groundskeeper puts on a GAME once a day.${wGrdRecText(id) ? ' ' + esc(wGrdRecText(id)) : ''}`);
  return out;
};
const wW21bRenderHelp = renderHelp;
renderHelp = function () {
  wW21bRenderHelp();
  const h = $('wHelpGrounds'); if (!h || $('wHelpGrdPlay')) return;
  const sq = Object.keys(W_GRD_SQUAD).sort((a, b) => W_GRD_SQUAD[a] - W_GRD_SQUAD[b] || a.localeCompare(b)).map(s => `${SPORT_NAME[s].toLowerCase()} ${W_GRD_SQUAD[s]}`).join(', ');
  h.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGrdPlay"><b>Games at the grounds.</b> Ask a groundskeeper for a GAME. A ground plays only its own sport, and hosts your team once you have recruited a full squad for it: ${sq}. A Friendly is against the city's club at the region's tier; a Challenge is a seeded side a tier up, with an elite's rewards. One game a day at each ground, and the scoreboard keeps your last result. A loss is a blackout, as on the road. Wild matches, cups and dungeons need no squad.</p>`);
};
