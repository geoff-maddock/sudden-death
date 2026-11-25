/* w154: jousting gear and potions (issue #117, phase 7), by #61's conventions, as w127 is the Shed's; the engine's side
   is src/jt/parts/13-kit.js, the plumbing (W_GEAR, W_POTIONS, the slot, the Bag) is w72.
   Gear (W_LISTS_GEAR, one piece a player, p.gear.lists): an Ironwood Lance (the tip sways less), a Kite Shield (an
   angled shield turns more) and a War Saddle (a firmer seat) from Sir Ruddock's rack at the Lists and the Mossgate
   grocer's; Rowelled Spurs (a little faster, for less wind), a Crested Helm (a lance on your helm breaks less often) and
   a Lucky Favour (pressure weighs less) from chests. Small effects (measured; phase 12's lab measures them again). Gear
   only does anything for a rider (squires don't ride). It reaches the engine through wListsPlayer (the engine's copy
   of the rider), never through p.jt, and shows on the stats card's Gear block and the Lists tab.
   Potions: the Stamina Draught (football's item, serving the Lists too: here it gives the mount's wind back), and a
   Steadying Tonic, Ruddock's Liniment and Squire's Oil from the same shops. In a real match, before one of your courses
   (You ride, or Manage when the calls are yours), from the Bag row under the lists, one a course, with your squire's
   advice; each comes out of your bag when given, and the match is saved with it at once, so the saved bag and the
   saved match always agree. Your squires never open your bag (Watch, Manage left to your squires and Auto powers
   don't), and Simulate leaves it alone. The other side brings W_LISTS_KIT.opp[tier] and gives at its skill, between
   courses; every use goes in the course log with its reason, and the match card says what each club brings.
   W_LISTS_KIT.prize lists what the Gilded Lance (phase 10) may hand out.
   wListsPotion(id)   gives one of yours ('' or why not)
   Wraps: wGearLive (wW154GearLive: the Lists), wListsPlayer (wW154ListsPlayer: gear's ratings and the piece),
   wStartLists (wW154StartLists: their bag goes in, for that match only), wResumeLists (wW154ResumeLists: an older save's bag), wListsRows
   (wW154ListsRows: the Bag row), wListsRow (wW154ListsRow: the gear on the Lists tab), wOpenListsCard
   (wW154OpenListsCard: the bags on the card), wListsLogHTML (wW154ListsLogHTML: the potions), wListsHowHTML
   (wW154ListsHow: #wListsHowKit), renderHelp (wW154RenderHelp: #wHelpListsKit); wJT.start and wJT.simMatch (the bags go
   in) and wJT.onPhase (a refusal goes with its course). */

W_GEAR_CFG.sports.lists = 'jousting';
W_GEAR_STATN.lists = { lance: 'lance', couch: 'couch', seat: 'seat', shield: 'shield', ride: 'ride', nerve: 'nerve', care: 'care' };
const W_LISTS_GEAR = {
  jt_ironwood: { sport: 'lists', name: 'Ironwood Lance', price: 55, desc: 'Ironwood, stiff and true: the tip sways a twentieth less.', fx: { sway: .95 } },
  jt_kite: { sport: 'lists', name: 'Kite Shield', price: 50, desc: 'Long and tapered: angled, it turns a lance more (a lance on it breaks a sixth less often; not one that passes through an angled shield, as a wraith\'s does).', fx: { kite: .85 } },
  jt_saddle: { sport: 'lists', name: 'War Saddle', price: 60, desc: 'A high cantle at your back: a firmer seat.', fx: { hold: .05 } },
  jt_spurs: { sport: 'lists', name: 'Rowelled Spurs', price: 45, desc: 'A sharper word to the mount: a touch faster, and each course costs it a tenth less wind.', fx: { speed: 1.01, wind: .9 } },
  jt_helm: { sport: 'lists', name: 'Crested Helm', price: 50, desc: 'A rounded crest: a lance on your helm breaks a fifth less often.', fx: { helmTurn: .8 } },
  jt_favour: { sport: 'lists', name: 'Lucky Favour', price: 45, desc: 'A token from the gallery, tied to the lance: pressure weighs a third less on them.', fx: { nerve: .35 } },
};
for (const id of Object.keys(W_LISTS_GEAR)) wGearAdd(id, W_LISTS_GEAR[id]);
const W_LISTS_KIT = {
  potions: { jttonic: 35, jtliniment: 30, jtoil: 45 },
  store: ['jt_ironwood', 'jt_kite', 'jt_saddle'],
  opp: { 1: { draught: 1 }, 2: { draught: 1, jtliniment: 1 }, 3: { draught: 1, jtliniment: 1, jttonic: 1, jtoil: 1 } },
  // (phase 10: the Gilded Lance's prizes come from here)
  prize: ['jt_spurs', 'jt_helm', 'jt_favour', 'jtoil'],
};
for (const id of Object.keys(wJT.potions)) {
  const P = wJT.potions[id];
  if (id === 'draught') {
    W_POTIONS[id].sports = (W_POTIONS[id].sports || ['grid']).concat('lists');
    DB.items[id].desc += ` At the Lists: ${P.desc.charAt(0).toLowerCase()}${P.desc.slice(1)}`;
    DB.items[id].use += ' Or in a jousting match, before a course, one a course.';
    continue;
  }
  wPotionAdd(id, { sport: 'lists' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a jousting match, before one of your courses: the Bag row under the lists. One potion a course.', price: W_LISTS_KIT.potions[id] };
}
// Sir Ruddock's rack at the Lists, and the Mossgate grocer's
DB.shops.lists = Object.assign({}, W_LISTS_KIT.potions, { draught: (DB.shops.hq || {}).draught || 30 });
for (const id of W_LISTS_KIT.store) DB.shops.lists[id] = W_LISTS_GEAR[id].price;
if (DB.shops.moss) { for (const id of Object.keys(W_LISTS_KIT.potions)) DB.shops.moss[id] = W_LISTS_KIT.potions[id]; for (const id of W_LISTS_KIT.store) DB.shops.moss[id] = W_LISTS_GEAR[id].price; }
(() => {
  const K = DB.chars.gk_lists; if (!K) return;
  K.shop = 'lists';
  K.topics.job.t += ' And I keep a rack of tilting KIT: lances, shields, saddles, and a few bottles.';
  K.topics.kit = { t: 'Ironwood lances, kite shields, a war saddle or two. And my liniment: rub it in the arm and you can couch all day.', act: 'shop' };
})();
for (const [c, it] of [['hatchery_c6', 'jt_spurs'], ['deepseam_c3', 'jt_helm'], ['chapel_chest', 'jt_favour'], ['emberdeep_c6', 'jtoil'], ['genevault_c6', 'jttonic']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}
const wW154GearLive = wGearLive;
wGearLive = function (sport) { return sport === 'lists' ? wListsLive() : wW154GearLive(sport); };
const wW154ListsPlayer = wListsPlayer;
wListsPlayer = function (p) {
  const m = wW154ListsPlayer(p), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'lists') : null;
  if (G) { m.r = wGearRate(m.r, G, wJT.cap); m.gear = wGearTag(G); }
  return m;
};

/* ---------- the bags go in ---------- */
const WJTK = { next: null };
let W_LISTS_KITMSG = '';
const wListsBagMine = () => Object.fromEntries(wMatchBag('lists').filter(x => wJT.potions[x.id]).map(x => [x.id, x.n]));
const wListsBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0 && wJT.potions[id]); return ks.length ? ks.map(id => `${bag[id]} ${wJT.potions[id].n}`).join(', ') : 'nothing'; };
const wW154StartLists = wStartLists;
wStartLists = function (o) {
  W_LISTS_KITMSG = '';
  WJTK.next = [null, Object.assign({}, W_LISTS_KIT.opp[(o && o.tier) || (o && o.club ? wBallTier(o.club) : 1)] || {})];
  try { return wW154StartLists(o); } finally { WJTK.next = null; }
};
// (the bag is taken by the first match started after it is set, and only that one: a Simulate's two hours can roll the
// day over onto a league round, whose clubs' matches at the Lists are jousted on the engine too, with no bag; phase 12)
const wW154Start = wJT.start, wW154SimMatch = wJT.simMatch;
const wJtkTake = o => { const b = WJTK.next; WJTK.next = null; return b ? Object.assign({}, o, { bags: b }) : o; };
wJT.start = o => wW154Start(wJtkTake(o));
wJT.simMatch = o => wW154SimMatch(wJtkTake(o));
// a match saved before bags came in: potions from here on (the other club's bag by its tier)
const wW154ResumeLists = wResumeLists;
wResumeLists = function () {
  wW154ResumeLists();
  const L = WG.jtg && WG.jtg.live, G = wJT.G;
  if (L && L.world && G && G.teams && !G.bags && WJT && WJT.world) {
    Object.assign(G, { bags: [null, Object.assign({}, W_LISTS_KIT.opp[L.world.tier || wBallTier(L.world.club) || 1] || {})], pots: [], potCourse: [-1, -1], potAsk: [-1, -1], tonic: [-1, -1], oil: [-1, -1] });
    L.snap = wJT.snapshot(); wSave(); wListsRows();
  }
};

/* ---------- your Bag, in a real match ---------- */
// (the bag and the match are saved together, at once: a reload finds them agreeing)
function wListsPotion(id) {
  if (!wListsWorld()) return 'Potions are for real matches, not exhibitions or practice.';
  if (!wHas(id)) return `You have no ${(wJT.potions[id] || {}).n || 'such potion'}.`;
  const r = wJT.potion(id); if (r) return r;
  wAddItem(id, -1); if (WG.jtg && WG.jtg.live) WG.jtg.live.snap = wJT.snapshot(); wSave(); return '';
}
$('wListsPowRow').insertAdjacentHTML('afterend', '<div id="wListsBagRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Bag</span><span id="wListsBag"></span></div></div>');
const wW154ListsRows = wListsRows;
wListsRows = function () {
  wW154ListsRows();
  const row = $('wListsBagRow'), V = WJT && !WJT.over && wJT.G && wJT.G.teams ? wJT.view : null;
  const calls = !!V && (V.mode === 'play' || (V.mode === 'manage' && !V.mgrAuto));
  const show = !!V && wListsWorld() && !V.yard && ((calls && V.ph === 'plan' && !!V.sel) || V.mode === 'manage');
  row.hidden = !show; if (!show) return;
  const G = wJT.G, s = V.you, bag = wListsBagMine(), ids = Object.keys(bag), can = calls && V.ph === 'plan', adv = can ? wJT.advice(bag) : null;
  const theirs = (G.pots || []).filter(x => x.side !== s && x.at === G.n).map(x => `${wJT.potions[x.id].n} (${x.why})`);
  $('wListsBag').innerHTML = (ids.length ? ids.map(id => { const P = wJT.potions[id], why = can ? wJT.potionWhy(s, id) : 'Only before your course, when the calls are yours.';
      return `<button class="ghost${adv && adv.id === id ? ' on' : ''}" data-jtkuse="${id}" ${can ? '' : 'disabled'} title="${esc(P.desc + (why ? ` (${why})` : ''))}">${esc(P.n)} (${bag[id]})</button>`; }).join(' ') : '<small class="hint">No jousting potions in your bag. Sir Ruddock\'s rack and the Mossgate grocer\'s sell them.</small>')
    + (W_LISTS_KITMSG ? ` <small class="wbad">${esc(W_LISTS_KITMSG)}</small>` : '') + (adv ? ` <small class="hint">Your squire says: <b>${esc(wJT.potions[adv.id].n)}</b>, ${esc(adv.why)}.</small>` : '')
    + (theirs.length ? ` <small class="hint">Their squire gives ${esc(theirs.join(' and '))}.</small>` : '');
};
// (a refusal is for the course it was about: a new course clears it)
const wW154OnPhase = wJT.onPhase;
wJT.onPhase = ph => { if (ph === 'next') W_LISTS_KITMSG = ''; wW154OnPhase(ph); };
$('wListsBagRow').addEventListener('click', e => {
  const b = e.target.closest('[data-jtkuse]'); if (!b || b.disabled) return;
  W_LISTS_KITMSG = wListsPotion(b.dataset.jtkuse); wListsRows(); wListsBarNote();
});
// every potion given, in the course log (with the course it was given before)
const wW154ListsLogHTML = wListsLogHTML;
wListsLogHTML = function () {
  const html = wW154ListsLogHTML(), G = wJT.G; if (!G || !G.pots || !G.pots.length || !G.log.length) return html;
  const items = html.split('</li>').slice(0, G.log.length), n = G.log.length;
  return items.map((li, j) => {
    const at = n - 1 - j, P = G.pots.filter(x => x.at === at);
    return li + (P.length ? ` <small class="wjtpot">${P.map(x => `⚗ ${esc(G.teams[x.side].short || G.teams[x.side].name)}: ${esc(wJT.potions[x.id].n)}${x.why ? ` (${esc(x.why)})` : ''}`).join('; ')}.</small>` : '') + '</li>';
  }).join('');
};

/* ---------- the Lists tab and the card ---------- */
const wW154ListsRow = wListsRow;
wListsRow = function (k, C) {
  const html = wW154ListsRow(k, C), p = wListsWho(k), g = p && typeof k === 'number' ? wGearOf(p, 'lists') : null;
  return g ? html.replace('<small class="wnst"', `<small class="wnst" title="${esc(g.desc)}">Rides with the <b>${esc(g.name)}</b>.</small><small class="wnst"`) : html;
};
const wW154OpenListsCard = wOpenListsCard;
wOpenListsCard = function () {
  wW154OpenListsCard();
  const ul = document.querySelector('#modalBox .wbclubs'); if (!ul) return;
  ul.insertAdjacentHTML('afterend', `<p class="hint">What their squires bring: ${[1, 2, 3].map(t => `tier ${t}, ${esc(wListsBagWords(W_LISTS_KIT.opp[t]))}`).join('; ')}. Yours is your bag: give from it before a course, in the Bag row under the lists.</p>`);
};

const wW154ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  return wW154ListsHow() + `<p class="hint" id="wListsHowKit"><b>Gear and potions.</b> Each player can carry one piece for the Lists, and it counts when they ride: an Ironwood Lance (the tip sways less), a Kite Shield (an angled shield turns more) and a War Saddle (a firmer seat) from Sir Ruddock's rack (ask him for KIT) and the Mossgate grocer's; Rowelled Spurs (a little faster, for less wind), a Crested Helm (a lance on your helm breaks less often) and a Lucky Favour (pressure weighs less) from chests. In a real match, before one of your courses, give a potion from the Bag row (one a course): the Stamina Draught (the mount's wind back), a Steadying Tonic (no pressure on your rider this course, when it weighs on them), Ruddock's Liniment (the lance arm's strength back) or Squire's Oil (your lance hardly ever glances this course). Your squire advises, but never opens your bag; their squires give theirs between courses.</p>`;
};
const wW154RenderHelp = renderHelp;
renderHelp = function () {
  wW154RenderHelp();
  const after = $('wHelpListsPowers') || $('wHelpListsGame'); if (!after || $('wHelpListsKit')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsKit"><b>Jousting gear and potions.</b> One piece of jousting gear a player (Sir Ruddock's rack and the Mossgate grocer's sell an Ironwood Lance, a Kite Shield and a War Saddle; chests hold the rest), and jousting potions from your bag in a real match, one a course, from the Bag row under the lists. See Jousting: how it works.</p>`);
};
