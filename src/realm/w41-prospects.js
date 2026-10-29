/* w41: rare eggs, Pell's incubator and the prospects who hatch (issue #12, phases 3 to 5). Loads after w40-eggs.js;
   changes earlier parts only by reassignment (saved originals carry the wW41 prefix).

   Rare eggs. Five nests hold one rare egg each, once a journey: the four dungeon nests in the alphas' rooms (shut
   until the alpha is beaten, w40) and the nest at the end of the Road to Nowhere, which gives it only after dark.
   Taking one sets rare_<map>, the flag the audit already expected, and the Road's egg finishes "The road to nowhere".
   After that, a rare nest is an ordinary one (w40). DB.rareEggs lists them, keyed by map.

   The incubator. Dr. Pell's incubator in Graftonbury takes one rare egg at a time, for W_HATCH.energy energy of the
   egg's element, and it hatches W_HATCH.days days later. Walk into the incubator: put an egg in, check on it, or, once
   it is due, meet who hatched. Ask Pell about the INCUBATOR.

   The prospect. A rare egg hatches into a one-of-a-kind level 1 player: their kind comes from where the egg was found
   (one of that region's kinds, at random; a werewolf from the Road), their name is their own, and they bring a card
   no one else has (a hatchling card, rarity 'h', never in a shop or a reward). They grow fast: double XP until level
   W_HATCH.xpTo. The Team screen says they hatched at Pell's.

   WG.incu = { egg: mapId, due: dayAbs } or null. Players: p.hatched = mapId (plain JSON).
   Wrapped: wUse (wW41Use: rare nests and the incubator), wMakePlayer (wW41MakePlayer: keeps p.hatched),
   wAddPlayer (wW41AddPlayer: the hatchling card), wGiveXp (wW41GiveXp: double XP), renderHelp (#wHelpHatch). */

const W_HATCH = { days: 3, energy: 6, xpTo: 10 };
DB.rareEggs = {
  genevault: { item: 'vaultegg', el: 'aether', card: 'hx_spark', from: 'the Sealed Vault' },
  emberdeep: { item: 'queenegg', el: 'ember', card: 'hx_brood', from: 'Emberdeep Warren' },
  hatchery: { item: 'clutchegg', el: 'tide', card: 'hx_clutch', from: 'the Drowned Hatchery' },
  deepseam: { item: 'wyrmegg', el: 'ember', card: 'hx_coil', from: 'the Deep Seam' },
  umbralden: { item: 'duskegg', el: 'rime', card: 'hx_howl', from: 'the Road to Nowhere', kinds: ['werewolf'], night: 1 },
};
Object.assign(DB.items, {
  vaultegg: { name: 'Vault Egg', desc: 'Heavy, and it hums. From the Vault Warden\'s nest.', use: 'Bring it to Dr. Pell\'s incubator in Graftonbury.', price: 0 },
  queenegg: { name: 'Ember Queen\'s Egg', desc: 'Too hot to hold for long. From the Ember Queen\'s nest.', use: 'Bring it to Dr. Pell\'s incubator in Graftonbury.', price: 0 },
  clutchegg: { name: 'Hatchmother\'s Egg', desc: 'Wet, and something inside it is swimming. From the Hatchmother\'s nest.', use: 'Bring it to Dr. Pell\'s incubator in Graftonbury.', price: 0 },
  wyrmegg: { name: 'Seam Wyrm Egg', desc: 'Stone-shelled, ringed like a seam of ore. From the Seam Wyrm\'s nest.', use: 'Bring it to Dr. Pell\'s incubator in Graftonbury.', price: 0 },
  duskegg: { name: 'Dusk Egg', desc: 'Dark as the road it came from, and it howls when the moon is up.', use: 'Bring it to Dr. Pell\'s incubator in Graftonbury.', price: 0 },
});
// the hatchling cards: one for each rare egg, brought only by the prospect who hatched from it
K('hx_spark', 'Warden\'s Spark', 'any', 'skl', 0, 'h', 'self', [['nrg', 1], ['draw', 1]], { ex: 1, fl: 'Hatched humming.' });
K('hx_brood', 'Queen\'s Brood', 'any', 'atk', 1, 'h', 'one', [['d', 4, 3]], { fl: 'Never just one of them.' });
K('hx_clutch', 'Clutch Guard', 'any', 'skl', 1, 'h', 'self', [['b', 9], ['draw', 1]], { fl: 'Sits on it. Nobody gets past.' });
K('hx_coil', 'Wyrm Coil', 'any', 'atk', 2, 'h', 'one', [['d', 14], ['s', 'weak', 2]], { fl: 'Tightens on the way out.' });
K('hx_howl', 'Dusk Howl', 'any', 'atk', 1, 'h', 'one', [['d', 8], ['s', 'vuln', 2]], { fl: 'Heard from the end of the road.' });
W_FROM.hatched = 'hatched at Pell\'s';
// a name nobody else has: two halves, from the place and the hatch
const W_HATCH_NAMES = { a: ['Ash', 'Brine', 'Dusk', 'Ember', 'Frost', 'Gale', 'Moss', 'Rime', 'Shale', 'Vault', 'Wick', 'Cinder', 'Tide', 'Hollow'], b: ['kit', 'ling', 'wick', 'fell', 'spark', 'shade', 'fang', 'mote', 'brand', 'drift', 'tail', 'crest'] };
function wHatchName() {
  const taken = new Set(wRoster().map(p => p.n));
  for (let i = 0; i < 50; i++) { const n = pick(W_HATCH_NAMES.a) + pick(W_HATCH_NAMES.b); if (!taken.has(n)) return n; }
  return 'Hatchling ' + WG.pid;
}
function wHatchKinds(mapId) {
  const E = DB.rareEggs[mapId]; if (E.kinds) return E.kinds;
  const L = DB.locs.find(l => l.id === mapId), reg = L ? regionAt(L.x, L.y) : 'plains';
  return (DB.regions[reg] || DB.regions.plains).kinds;
}
function wRareEggsHeld() { return Object.keys(DB.rareEggs).filter(k => wHas(DB.rareEggs[k].item)); }

const wW41Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y), use = (DB.tiles[c] || {}).use, meta = m.meta[x + ',' + y] || {};
  // a rare nest: its one rare egg, then it is an ordinary nest
  const E = use === 'nest' && meta.rare && DB.rareEggs[m.id];
  if (E && !wFlag('rare_' + m.id) && !(meta.alpha && !wFlag('alpha_' + meta.alpha))) {
    if (E.night && wDarkness() < .3) return wLog(DB.tiles.N.look + ' Nothing stirs in it by daylight.', 'd');
    wAddItem(E.item, 1); wSetFlag('rare_' + m.id); wAdvance(W_EGG.minutes);
    wLog(`At the bottom of the nest, under the down: ${DB.items[E.item].name}. Dr. Pell in Graftonbury will want to see it.`, 'm');
    const sp = DB.sideplots.find(s => s.id === 'rare_' + m.id); if (sp) wLog('Done: ' + sp.title + '.', 'g');
    wSave(); return;
  }
  if (use === 'eggs') return wIncubator();
  return wW41Use.apply(this, arguments);
};

/* the incubator: put a rare egg in, check on it, or meet who hatched */
function wIncubator() {
  const I = WG.incu;
  if (I) {
    if (WG.dayAbs < I.due) { const d = I.due - WG.dayAbs; return wLog(`The ${DB.items[DB.rareEggs[I.egg].item].name} is warm under the lamp. It is due in ${d} day${d === 1 ? '' : 's'}.`, 'd'); }
    return wHatchEgg();
  }
  const held = wRareEggsHeld();
  if (!held.length) return wLog(DB.tiles.E.look + ' Dr. Pell keeps it for rare eggs: the kind alphas guard.', 'd');
  const id = held[0], E = DB.rareEggs[id], have = WG.energy[E.el] || 0, el = DB.elems.names[E.el];
  if (have < W_HATCH.energy) return wLog(`The ${DB.items[E.item].name} needs ${W_HATCH.energy} ${el} energy to warm it. You have ${have}.`, 'b');
  wAddItem(E.item, -1); WG.energy[E.el] -= W_HATCH.energy; WG.incu = { egg: id, due: WG.dayAbs + W_HATCH.days };
  wLog(`The ${DB.items[E.item].name} goes into the incubator with ${W_HATCH.energy} ${el} energy. It is due in ${W_HATCH.days} days.`, 'm');
  wSave();
}
function wHatchEgg() {
  const I = WG.incu, E = DB.rareEggs[I.egg];
  const spec = { kind: pick(wHatchKinds(I.egg)), n: wHatchName(), lvl: 1, num: ri(0, 99), hatched: I.egg,
    flav: `Hatched at Pell's from a ${DB.items[E.item].name}, found in ${E.from}. There is nobody else like them.` };
  WG.incu = null;
  wLog(`The incubator clicks open. Out of the ${DB.items[E.item].name} comes ${spec.n}, a ${wKindName(spec.kind)} nobody has seen the like of.`, 'g');
  if (LAB || wRoster().length < W_PARTY.max) wRecruit(spec, 'hatched'); else wShowRecruit(wMakePlayer(spec, 'hatched'), 'hatched');
  wSave();
}

// a prospect keeps where they hatched, brings their own card, and grows fast
const wW41MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW41MakePlayer.apply(this, arguments); if (spec && spec.hatched) p.hatched = spec.hatched; return p; };
const wW41AddPlayer = wAddPlayer;
wAddPlayer = function (p) {
  const r = wW41AddPlayer.apply(this, arguments);
  const E = p && p.hatched && DB.rareEggs[p.hatched];
  if (E) wGainCard({ id: E.card, pid: p.id }, `${p.n}'s own card: nobody else has one`);
  return r;
};
const wW41GiveXp = wGiveXp;
wGiveXp = function (p, n) { return wW41GiveXp.call(this, p, p && p.hatched && p.lvl < W_HATCH.xpTo ? n * 2 : n); };

// Pell takes it from here
(() => {
  const P = DB.chars.pell; if (!P) return;
  P.topics.job.t += ' And if you find a rare egg, the kind alphas sit on, my INCUBATOR is in the back.';
  P.topics.incubator = { t: `Rare eggs: the alphas' nests have one each, and there is one at the end of that road in the north, after dark. Put it in the incubator in the back with ${W_HATCH.energy} energy of its own element, and in ${W_HATCH.days} days you will have a player nobody has seen before. They grow quickly, too, at first.` };
  const sp = DB.sideplots.find(s => s.id === 'rare_umbralden'); if (sp) sp.pay = 'A Dusk Egg. Take it to Dr. Pell\'s incubator.';
})();

const wW41RenderHelp = renderHelp;
renderHelp = function () {
  wW41RenderHelp();
  const e = $('wHelpEggs'); if (!e || $('wHelpHatch')) return;
  e.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpHatch"><b>Rare eggs.</b> Each dungeon's alpha guards a nest with one rare egg in it, and there is one at the end of the Road to Nowhere, after dark. Take one to Dr. Pell's incubator in Graftonbury with ${W_HATCH.energy} energy of its element, and ${W_HATCH.days} days later it hatches into a prospect: a level 1 player like no other, of a kind from where the egg was found, with a card only they bring. Prospects earn double XP until level ${W_HATCH.xpTo}.</p>`);
};
