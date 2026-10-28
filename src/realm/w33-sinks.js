/* w33: small gold sinks (epic 2, phase 10). Loads after w32-tour.js; changes earlier parts only by reassignment
   (saved originals carry the wW33 prefix).

   Training camp. At any training spot, after the week's free drill, pay to drill another card that suits the sport
   (Practice ★). Each paid drill in a week costs more than the last (W_SINK.camp), and an hour.
   Coaches. The League's coaches run between the five cities. Take one from any inn (ask the innkeeper about the
   COACH, or the inn's Coach button): it costs W_SINK.coach.base plus a gold for every W_SINK.coach.per tiles, takes
   half the time walking would, and nobody stops a League coach on the road. You arrive at the inn.

   WG.sink = { week, drills, coaches }, plain data. W_SINK, wCampPrice(), wCampDrill(id, card), wCoachTrip(from, to),
   wTakeCoach(to)
   Wrapped: wOpenSpot (the Training camp row), wOpenInn (the Coach button), wRunAct (act 'coach'), renderHelp
   (#wHelpSinks). */

const W_SINK = { camp: [30, 45, 65, 90, 120], minutes: 60, coach: { base: 10, per: 3, speed: 2 } };
const W_COACH_CITIES = ['graftonbury', 'mossgate', 'saltmere', 'cinderhold', 'rimewatch'];

function wSink() {
  const S = WG.sink = WG.sink || { week: -1, drills: 0, coaches: 0 };
  if (S.week !== wWeek()) { S.week = wWeek(); S.drills = 0; }
  return S;
}

/* ---------- training camp ---------- */
function wCampPrice() { const n = wSink().drills; return W_SINK.camp[Math.min(n, W_SINK.camp.length - 1)]; }
/* '' or why not */
function wCampDrill(id, card) {
  const s = wSpot(id); if (!s) return 'There is no spot like that.';
  if (wSpotState(id).drill !== wWeek()) return 'Take the free drill first.';
  const price = wCampPrice();
  if (RUN.gold < price) return `A camp session is ${price} gold. You have ${RUN.gold}.`;
  if (!card || !RUN.deck.includes(card) || !practicable(card)) return 'That card cannot take a drill.';
  RUN.gold -= price; card.sk = 1; wSink().drills++;
  achAdd('practice', 1);
  wAdvance(W_SINK.minutes);
  wLog(`Training camp with ${s.coach.name}: ${wCardName(card.id, card.up)} gains Practice ★ (${price} gold).`, 'm');
  wSave();
  return '';
}
const wW33OpenSpot = wOpenSpot;
wOpenSpot = function (id, msg) {
  wW33OpenSpot(id, msg);
  const s = wSpot(id), ul = document.querySelector('#modalBox .wbclubs'); if (!s || !ul || $('wCampDrill')) return;
  const free = wSpotState(id).drill === wWeek(), price = wCampPrice(), cards = wSpotCards(s.sport).filter(c => !c.sk);
  const why = !free ? 'After the free drill.' : !cards.length ? 'Every card that could take a drill has Practice ★.' : RUN.gold < price ? `You have ${RUN.gold} gold.` : '';
  ul.insertAdjacentHTML('beforeend', `<li class="wbcl"><span class="wbsw" style="background:#c9a23a"></span><div><b>Training camp</b><small>Drill another card that suits ${esc(SPORT_NAME[s.sport].toLowerCase())}: ${price} gold and an hour. Each session this week costs more.${why ? ' <b>' + esc(why) + '</b>' : ''}</small></div>
    <div class="row"><button class="ghost" id="wCampDrill" ${why ? 'disabled' : ''}>Pay ${price} gold</button></div></li>`);
  $('wCampDrill').onclick = () => {
    $('modalBox').querySelector('[data-close]').click();
    wPickCard(cards, 'Training camp', `${price} gold. The card gains Practice ★.`, card => {
      if (!card) return wOpenSpot(id);
      const r = wCampDrill(id, card); wDrain();
      wOpenSpot(id, { ok: !r, t: r || `${wCardName(card.id, card.up)} gains Practice ★.` });
    });
  };
};

/* ---------- coaches ---------- */
function wCityLoc(city) { return DB.locs.find(l => l.map === city && l.kind !== 'ground') || null; }
/* { dist, price, minutes } from one city to another, or null */
function wCoachTrip(from, to) {
  const a = wCityLoc(from), b = wCityLoc(to); if (!a || !b || from === to) return null;
  const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y), C = W_SINK.coach;
  return { dist, price: C.base + Math.ceil(dist / C.per), minutes: Math.round(dist * WSTEP_MIN.world / C.speed) };
}
function wCoachTime(min) { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} minutes` : ''}` : `${m} minutes`; }
/* '' or why not */
function wTakeCoach(to) {
  const from = WG.map, T = wCoachTrip(from, to);
  if (!W_COACH_CITIES.includes(from)) return 'Coaches leave from the cities\' inns.';
  if (!T) return 'There is no coach to there.';
  if (RUN.gold < T.price) return `The fare is ${T.price} gold. You have ${RUN.gold}.`;
  RUN.gold -= T.price; wSink().coaches++;
  wAdvance(T.minutes);
  const at = wInnSpot(to);
  wEnterMap(to, at[0], at[1]); WG.face = 'd'; WG.grace = W_ENC.grace;
  if (typeof wResetParty === 'function' && WUI.built) wResetParty();
  wLog(`The League coach rattles into ${wTownName(to)} after ${wCoachTime(T.minutes)} (${T.price} gold).`, 'm');
  wSave();
  return '';
}
function wOpenCoach(msg) {
  if (LAB) return;
  const from = WG.map;
  const rows = W_COACH_CITIES.filter(c => c !== from).map(c => { const T = wCoachTrip(from, c); return `<li class="wbcl"><span class="wbsw" style="background:#8a6a3a"></span><div><b>${esc(wTownName(c))}</b><small>${esc(wCap(wRegThe(W_GRD_REG[c])))}. ${wCoachTime(T.minutes)}, ${T.price} gold.</small></div>
    <div class="row"><button class="btn" data-coach="${c}" ${RUN.gold < T.price ? 'disabled' : ''}>Go, ${T.price} gold</button></div></li>`; }).join('');
  const close = modal(`<header><h3>The League coach</h3><button class="ghost" data-close>Not now</button></header>
    ${msg ? `<p class="wbad" role="status">${esc(msg)}</p>` : ''}
    <p class="hint">It leaves from the inn yard and runs to every city, twice as fast as walking. Nobody stops a League coach on the road. You have ${RUN.gold} gold.</p>
    <ul class="wbclubs">${rows}</ul>`);
  $('modalBox').querySelectorAll('[data-coach]').forEach(b => b.onclick = () => { const r = wTakeCoach(b.dataset.coach); close(); wCloseTalk(); if (r) wOpenCoach(r); wDrain(); });
}
for (const id of W_TAVERN_INNS) {
  const ch = DB.chars[id]; if (!ch) continue;
  ch.topics.coach = { t: 'The League coach leaves from the yard for every city. Faster than walking, and safe.', act: 'coach' };
  ch.topics.job.t += ' The COACH leaves from the yard.';
}
const wW33RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'coach') return wOpenCoach();
  return wW33RunAct(act, id);
};
const wW33OpenInn = wOpenInn;
wOpenInn = function (price, who) {
  wW33OpenInn(price, who);
  const row = $('wSleep') && $('wSleep').parentNode; if (!row || $('wInnCoach') || !W_COACH_CITIES.includes(WG.map)) return;
  row.insertAdjacentHTML('beforeend', '<button class="ghost" id="wInnCoach">Coach</button>');
  $('wInnCoach').onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenCoach(); };
};

/* ---------- How to play ---------- */
const wW33RenderHelp = renderHelp;
renderHelp = function () {
  wW33RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpSinks')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpSinks"><b>Training camp and coaches.</b> At a training spot, after the week's free drill, pay for a camp session to drill another card (Practice ★): ${W_SINK.camp.slice(0, 3).join(', ')} gold and up, rising with each session that week. The League COACH runs from every city's inn to the others: ${W_SINK.coach.base} gold plus 1 for every ${W_SINK.coach.per} tiles, half the walking time, and nothing stops it on the road.</p>`);
};
