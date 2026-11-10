/* w72: match gear and the match bag, phase 1 (issue #61): the plumbing. Boxing (the Anvil Ring) and football (Cinder
   Gridiron) get equipment a player wears into a match, and potions kept in the bag for use during one.

   Settled with Geoff: one gear slot per player in each sport (a boxer's piece and a footballer's piece); gear is found
   and bought (chests, dungeons, shops, cup prizes), never crafted or upgraded.

   W_GEAR: id -> { sport: 'ring'|'grid', name, desc (what it does, in plain words), price?, fx }, where fx.r adds to
   the engine's ratings ({ pow: 1 }); phases 2 and 3 add the effects only one sport has (cuts, fumbles...), read by the
   engines from the fighter's or player's gear. Every piece is also an item (DB.items[id], with gear: sport), so shops,
   chests and the Bag carry it like anything else; while a player wears it, it is out of the bag.
   W_POTIONS: id -> { sport (or sports: [...]), ... }: the potions each sport uses in a match (football's two from w48 and four from w74; boxing's from w73).
   wMatchBag(sport) lists the ones in your bag.

   State: p.gear = { ring?: id, grid?: id } on a roster player (plain JSON, in the save). A released player's gear goes
   back in the bag. Gear changes the ratings the engines get (wBxFighter, wSevenPlayer), never the ratings kept on the
   player (p.bx, p.gf), so taking it off puts them back, and a rating can go up to W_GEAR_CFG.over past the cap.

   wGearPutOn(pid, id), wGearTakeOff(pid, sport) return '' when it worked, or why not.
   Wraps: wRelease (wW72Release: gear back in the bag), wBxFighter (wW72BxFighter) and wSevenPlayer (wW72SevenPlayer):
   gear's ratings and the piece itself; wStatsCard (wW72StatsCard: the Gear block), wCampBag (wW72CampBag: Put gear on),
   renderHelp (wW72RenderHelp: #wHelpGear). Put on and Take off are one click handler on the page. */

const W_GEAR_CFG = { over: 2, sports: { ring: 'boxing', grid: 'football' } };
const W_GEAR = {};
const W_POTIONS = {};
// a piece of gear: in W_GEAR and, as an item, in DB.items
function wGearAdd(id, def) {
  W_GEAR[id] = def;
  DB.items[id] = { name: def.name, desc: def.desc, gear: def.sport, price: def.price,
    use: `Gear for ${W_GEAR_CFG.sports[def.sport]}: one player wears it into every ${def.sport === 'ring' ? 'bout' : 'game'}. Put it on from the Bag or the player's stats.` };
  return def;
}
function wPotionAdd(id, def) { W_POTIONS[id] = def; return def; }
// the sports a potion is for (sport, or sports when it serves more than one)
const wPotionSports = id => { const P = W_POTIONS[id]; return P ? P.sports || [P.sport] : []; };
// football's potions, from w48
for (const id of Object.keys(W_GF_POTIONS)) wPotionAdd(id, Object.assign({ sport: 'grid' }, W_GF_POTIONS[id]));

/* ---------- who wears what ---------- */
function wGearOf(p, sport) { const id = p && p.gear && p.gear[sport]; return id && W_GEAR[id] ? Object.assign({ id }, W_GEAR[id]) : null; }
function wGearPutOn(pid, id) {
  if (!WG || !RUN) return 'There is no journey on.';
  const p = wPlayer(pid), G = W_GEAR[id];
  if (!p) return 'Nobody by that name.';
  if (!G) return 'That is not gear.';
  if (wGearLive(G.sport)) return `Not while a ${W_GEAR_CFG.sports[G.sport]} match is on.`;
  if (!wHas(id)) return `You have no ${G.name}.`;
  const was = wGearOf(p, G.sport);
  if (was && was.id === id) return `${p.n} is already wearing it.`;
  wAddItem(id, -1);
  if (was) wAddItem(was.id, 1);
  p.gear = Object.assign({}, p.gear, { [G.sport]: id });
  wLog(`${p.n} puts on the ${G.name}${was ? ` (the ${was.name} goes back in the bag)` : ''}.`, 'm');
  wSave();
  return '';
}
function wGearTakeOff(pid, sport) {
  if (!WG || !RUN) return 'There is no journey on.';
  const p = wPlayer(pid), was = wGearOf(p, sport);
  if (!p) return 'Nobody by that name.';
  if (!was) return `${p.n} has no ${W_GEAR_CFG.sports[sport] || ''} gear on.`;
  if (wGearLive(sport)) return `Not while a ${W_GEAR_CFG.sports[sport]} match is on.`;
  delete p.gear[sport];
  wAddItem(was.id, 1);
  wLog(`${p.n} takes off the ${was.name}. It goes back in the bag.`, 'm');
  wSave();
  return '';
}
// a match in that sport is on (gear is fixed for its length: the engines took the ratings at the start)
function wGearLive(sport) { return sport === 'ring' ? wRingLive() : sport === 'grid' ? wGridLive() : false; }
const wW72Release = wRelease;
wRelease = function (pid) {
  const p = wPlayer(pid), had = p && p.gear ? Object.values(p.gear).filter(id => W_GEAR[id]) : [];
  const r = wW72Release(pid);
  // (released: they are no longer on the roster)
  if (had.length && !wPlayer(pid)) { for (const id of had) wAddItem(id, 1); wLog(`Their gear stays: ${had.map(id => W_GEAR[id].name).join(', ')}, back in the bag.`, 'm'); wSave(); }
  return r;
};

/* ---------- gear in the engines ---------- */
function wGearRate(r, G, cap) {
  if (!G || !G.fx || !G.fx.r) return r;
  const out = Object.assign({}, r);
  for (const s in G.fx.r) if (out[s] != null) out[s] = Math.max(1, Math.min(cap + W_GEAR_CFG.over, out[s] + G.fx.r[s]));
  return out;
}
// what an engine's player carries of their gear: the piece and its effects, plain data
const wGearTag = G => G ? { id: G.id, name: G.name, fx: JSON.parse(JSON.stringify(G.fx || {})) } : null;
const wW72BxFighter = wBxFighter;
wBxFighter = function (p) {
  const f = wW72BxFighter(p), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'ring') : null;
  if (G) { f.r = wGearRate(f.r, G, W_BXG.cap); f.gear = wGearTag(G); }
  return f;
};
const wW72SevenPlayer = wSevenPlayer;
wSevenPlayer = function (p) {
  const s = wW72SevenPlayer(p), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'grid') : null;
  if (G) { s.r = wGearRate(s.r, G, W_GFR.cap); s.gear = wGearTag(G); }
  return s;
};

/* ---------- the match bag ---------- */
// the potions in your bag that this sport uses in a match: [{ id, n, name, desc }]
function wMatchBag(sport) {
  if (!WG || !WG.items) return [];
  return Object.keys(W_POTIONS).filter(id => wPotionSports(id).includes(sport) && (WG.items[id] || 0) > 0 && DB.items[id])
    .map(id => ({ id, n: WG.items[id], name: DB.items[id].name, desc: DB.items[id].desc }));
}

/* ---------- on screen ---------- */
function wGearFxText(G) {
  const R = G.fx && G.fx.r ? Object.entries(G.fx.r).map(([s, n]) => `${n > 0 ? '+' : ''}${n} ${wGearStatName(G.sport, s)}`) : [];
  return R.join(', ');
}
const W_GEAR_STATN = { ring: { reach: 'reach', pow: 'power', spd: 'speed', chin: 'chin', sta: 'stamina', gui: 'guile' },
  grid: { spd: 'speed', str: 'strength', hnd: 'hands', arm: 'arm', kck: 'kicking', tkl: 'tackling' } };
function wGearStatName(sport, s) { return (W_GEAR_STATN[sport] || {})[s] || s; }
// the Gear block on a player's stats: what they wear in each sport, with Take off
function wGearCard(p) {
  const rows = Object.keys(W_GEAR_CFG.sports).map(sp => {
    const G = wGearOf(p, sp);
    return `<li data-gearrow="${sp}"><span>${wCap(W_GEAR_CFG.sports[sp])}:</span> ${G ? `<b>${esc(G.name)}</b> <small>${esc(G.desc)}</small> <button class="ghost" data-gearoff="${sp}" data-gearpid="${p.id}">Take off</button>` : '<span class="dim">nothing</span>'}</li>`;
  }).join('');
  return `<div class="wbd wgearc"><h5>Gear</h5><ul class="wgearl">${rows}</ul><p class="hint">One piece for each sport: ${Object.values(W_GEAR_CFG.sports).join(', ').replace(/, ([^,]*)$/, ' and $1')}. Put gear on from the Bag.</p></div>`;
}
const wW72StatsCard = wStatsCard;
wStatsCard = function (p) { return wW72StatsCard(p).replace(/<\/section>\s*$/, wGearCard(p) + '</section>'); };
// the Bag: under the bag, the gear in it and who could wear it
const wW72CampBag = wCampBag;
wCampBag = function () {
  const ids = Object.keys(W_GEAR).filter(id => (WG.items[id] || 0) > 0);
  if (!ids.length) return wW72CampBag();
  const rows = ids.map(id => { const G = W_GEAR[id];
    const opts = wRoster().map(p => { const on = wGearOf(p, G.sport); return `<option value="${p.id}">${esc(p.n)}${on ? ` (now: ${esc(on.name)})` : ''}</option>`; }).join('');
    return `<tr data-gearitem="${id}"><td><b>${esc(G.name)}</b><small>${esc(wCap(W_GEAR_CFG.sports[G.sport]))}. ${esc(G.desc)}</small></td>
      <td><select data-gearwho="${id}" aria-label="Who wears the ${esc(G.name)}">${opts}</select> <button class="ghost" data-gearon="${id}">Put on</button></td></tr>`; }).join('');
  return wW72CampBag() + `<h5 class="wbrh">Put gear on</h5><table class="wshop wbag wgearbag"><tbody>${rows}</tbody></table>`;
};
// Put on and Take off, wherever the Team screen draws them (the Bag, a player's stats)
document.addEventListener('click', e => {
  const on = e.target.closest('[data-gearon]'), off = e.target.closest('[data-gearoff]');
  if (!on && !off) return;
  if (on) { const id = on.dataset.gearon, sel = document.querySelector(`[data-gearwho="${id}"]`); WCAMP.msg = sel ? wGearPutOn(+sel.value, id) : ''; }
  else WCAMP.msg = wGearTakeOff(+off.dataset.gearpid, off.dataset.gearoff);
  if (typeof wRenderCamp === 'function' && $('wCampBody')) wRenderCamp();
});

/* ---------- How to play ---------- */
const wW72RenderHelp = renderHelp;
renderHelp = function () {
  wW72RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpGear')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpGear"><b>Gear.</b> Players can wear one piece of gear in each sport that has its own game: one for boxing, one for football, one for basketball. Gear is found in chests and dungeons, bought in towns and won in cups. Put it on from the Bag on the Team screen; it shows on the player's stats, with Take off. A piece changes how they play while they wear it (its card says how), and goes back in the bag when it comes off or the player leaves. You can't change gear in the middle of a match.</p>`);
};
