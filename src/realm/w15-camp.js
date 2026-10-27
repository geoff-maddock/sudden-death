/* w15: camping out. Loads after w14-ground.js; changes earlier parts only by reassignment (saved originals carry the
   wW15 prefix), one fightStart hook and one W_ON_END entry.

   Anywhere in the wild (the world map, not a town or a dungeon) you can make camp from the Bag tab. It uses up a
   Trail Ration and you sleep until morning, healing half your max HP; an inn heals it all. The risk: a wild team may
   find you in the night, more often in cover (long grass, woods, fens) than in the open or on the road. If one does,
   you are caught asleep: you have only healed a quarter, the match starts at once (no pre-game card, no running),
   they are a score ahead (the ambush rule, w9-road.js), and your team is Weak for the first turn. Win, and you sleep
   on for the other quarter; lose, and it is a blackout like any other.

   W_CAMP          the numbers
   wCanCamp()      '' if you can make camp here, else why not
   wMakeCamp(roll) roll (0..1) is for tests; returns '' or why not
   Wrapped: wRenderCamp (the Make camp row in the Bag tab), renderHelp (a paragraph in #wHelpFeel). */

const W_CAMP = {
  item: 'ration',     // used up for each night out
  heal: .5,           // a quiet night heals half the team's max HP
  risk: .33,          // a wild team finds you this often in cover (a tile where wild teams roam)
  riskOpen: .2,       // and this often in the open or on the road
  wakeAt: 7 * 60,     // you wake at 7
  attackAt: 2 * 60,   // and if they come, they come at 2
};
function wCampRisk() {
  const m = wCurMap(), c = wTileAt(m, WG.x, WG.y), td = DB.tiles[c] || {};
  return !wOnRoad() && td.enc ? W_CAMP.risk : W_CAMP.riskOpen;
}
function wCanCamp() {
  if (!WG || !RUN) return 'There is no journey on.';
  if (B && !B.over && UI.view === 'fight') return 'Not during a match.';
  const m = wCurMap();
  if (m.kind === 'town') return 'You are in town. Sleep at the inn.';
  if (m.kind !== 'world') return 'Not in here. Make camp out in the open.';
  if (!wHas(W_CAMP.item)) return `You need a ${DB.items[W_CAMP.item].name} to make camp.`;
  return '';
}
/* minutes from now until the next time the clock shows `at` (a full day if it is that time now) */
function wUntil(at) { return ((at - WG.min) % 1440 + 1440) % 1440 || 1440; }
function wCampHeal(share) { const h0 = RUN.hp; RUN.hp = Math.min(RUN.maxhp, RUN.hp + Math.ceil(RUN.maxhp * share)); return RUN.hp - h0; }
function wMakeCamp(roll) {
  const why = wCanCamp(); if (why) return why;
  const risk = wCampRisk();
  wAddItem(W_CAMP.item, -1);
  if ((roll != null ? roll : Math.random()) < risk) {
    // they come at 2 in the morning, half way through your rest
    wAdvance(wUntil(W_CAMP.attackAt));
    const got = wCampHeal(W_CAMP.heal / 2);
    wLog(`You make camp and get some sleep (+${got} HP). In the small hours, something is moving outside the firelight.`, 'b');
    WUI.held = null; WUI.goto = null;
    startMatch({ type: 'normal', tier: wTierHere(), ambush: true, card: false, world: { kind: 'camp', ref: { heal: W_CAMP.heal / 2 }, region: wRegionHere() } });
    return '';
  }
  wAdvance(wUntil(W_CAMP.wakeAt));
  const got = wCampHeal(W_CAMP.heal);
  WG.grace = W_ENC.grace;
  wLog(`You make camp and sleep under the stars. Nobody comes. It is morning, and your team is rested (+${got} HP, ${RUN.hp}/${RUN.maxhp}).`, 'm');
  wSave();
  return '';
}

/* caught asleep: Weak for the first turn, on top of the ambush's score */
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!WG || !B || !W || W.kind !== 'camp') return;
  addSt(B.P, 'weak', 1);
  B.wCamp = 1;
  log('Caught asleep: your team is Weak for the first turn.', 'bad');
  if (!LAB) fx({ k: 'banner', t: 'Caught asleep!', sub: 'They found your camp in the night. Weak for a turn, and they start a score ahead.', small: 1 });
});
W_ON_END.camp = function (r, ref, W) {
  if (r !== 'win') return;
  wAdvance(wUntil(W_CAMP.wakeAt));
  const got = wCampHeal((ref && ref.heal) || 0);
  wLog(`You see them off and sleep until morning (+${got} HP, ${RUN.hp}/${RUN.maxhp}).`, 'g');
};

/* ---------- the Bag tab: Make camp ---------- */
const wW15RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW15RenderCamp();
  if (WCAMP.tab !== 'bag') return;
  const body = $('wCampBody'); if (!body || $('wMakeCamp')) return;
  const why = wCanCamp(), it = DB.items[W_CAMP.item];
  const risk = why ? 0 : Math.round(wCampRisk() * 100);
  const sum = body.querySelector('.wcsum');
  const html = `<div class="wcampout"><p><b>Make camp.</b> Sleep here until morning, healing half your max HP. Uses a ${esc(it.name)} (you have ${WG.items[W_CAMP.item] || 0}).${why ? '' : ` A wild team may find you in the night: about ${risk}% here${risk > W_CAMP.riskOpen * 100 ? ' in cover, less in the open or on the road' : ''}. If one does, you play half asleep.`}</p>
    <button class="ghost" id="wMakeCamp" ${why ? `disabled title="${esc(why)}"` : ''}>Make camp</button>${why ? `<small class="dim"> ${esc(why)}</small>` : ''}</div>`;
  if (sum) sum.insertAdjacentHTML('afterend', html); else body.insertAdjacentHTML('afterbegin', html);
  $('wMakeCamp').onclick = () => {
    const r = wCanCamp();
    if (r) { wCampSay(r); return; }
    if (WCAMP.close) WCAMP.close();
    wMakeCamp();
    WUI.hudKey = ''; wDrain();
  };
};

const wW15RenderHelp = renderHelp;
renderHelp = function () {
  wW15RenderHelp();
  const feel = $('wHelpFeel'); if (!feel || $('wHelpCampOut')) return;
  feel.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpCampOut"><b>Camping out.</b> Out in the wild, Make camp (in the Bag) uses a Trail Ration and sleeps until morning, healing half your max HP. A wild team may find you in the night: about ${Math.round(W_CAMP.risk * 100)}% of the time in long grass, woods and fens, ${Math.round(W_CAMP.riskOpen * 100)}% in the open or on the road. If one does, you play at once, half asleep: you have healed only a quarter, they start a score ahead, and your team is Weak for the first turn. Win and you sleep on.</p>`);
};
