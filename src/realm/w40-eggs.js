/* w40: eggs (issue #12, phases 1 and 2). Loads after w39-retire.js; changes earlier parts only by reassignment (saved
   originals carry the wW40 prefix).

   Nests hold eggs. Walk into a full nest and you take 1 or 2 of its region's eggs (W_EGG.minutes), and it is empty for
   W_EGG.days days: the empty nest's look and art, there since the port, now show. An alpha's nest stays shut until its
   alpha is beaten. There is one egg for each region, keyed by element like the bushes' forage (DB.eggs):
     aether  Meadow Egg   (the Charter Plains)     bloom  Moss Egg    (the Mosswold)
     tide    Brine Egg    (the Brinefen)           ember  Cinder Egg  (the Cindermaw)
     rime    Rime Egg     (the Frostspire)
   Eggs are for cooking, and only cooking: no kitchen sells an egg dish. Each region's egg makes one strong dish with
   its forage, at any hearth. All five eggs together make the Grand Tour, the strongest dish in the realm, which Old
   Wenna in Mossgate teaches once you bring her one egg of each (her GRAND topic, flag recipe_grandtour).

   W_EGG, DB.eggs; new items, recipes and meals in DB.items, DB.recipes and DB.meals.
   A meal can now rest your team's tired legs when you eat it (fx.legs, w28-legs.js).
   Wrapped: wUse (wW40Use: a nest), wEat (wW40Eat: fx.legs), renderHelp (wW40RenderHelp: #wHelpEggs). */

const W_EGG = { days: 4, minutes: 20, take: [1, 2] };
DB.eggs = { aether: 'meadowegg', bloom: 'mossegg', tide: 'brineegg', ember: 'cinderegg', rime: 'rimeegg' };
Object.assign(DB.items, {
  meadowegg: { name: 'Meadow Egg', desc: 'Speckled, warm from the grass. From Charter Plains nests.', use: 'Cooking: Aethercap Soufflé, and the Grand Tour.', price: 14 },
  mossegg: { name: 'Moss Egg', desc: 'Green as the moss it was laid in. From Mosswold nests.', use: 'Cooking: Mossberry Custard, and the Grand Tour.', price: 14 },
  brineegg: { name: 'Brine Egg', desc: 'Leathery, and it smells of the sea. From Brinefen nests.', use: 'Cooking: Brine Egg Bake, and the Grand Tour.', price: 14 },
  cinderegg: { name: 'Cinder Egg', desc: 'Black-shelled and still warm. From Cindermaw nests.', use: 'Cooking: Devilled Cinder Eggs, and the Grand Tour.', price: 14 },
  rimeegg: { name: 'Rime Egg', desc: 'Pale blue, and cold right through. From Frostspire nests.', use: 'Cooking: Frostmint Egg Flip, and the Grand Tour.', price: 14 },
});
Object.assign(DB.recipes, {
  souffle: { name: 'Aethercap Soufflé', needs: { meadowegg: 2, aethercap: 1 }, effect: { kind: 'meal', meal: 'souffle' } },
  custard: { name: 'Mossberry Custard', needs: { mossegg: 2, mossberry: 1 }, effect: { kind: 'meal', meal: 'custard' } },
  bake: { name: 'Brine Egg Bake', needs: { brineegg: 2, brinekelp: 1 }, effect: { kind: 'meal', meal: 'bake' } },
  devilled: { name: 'Devilled Cinder Eggs', needs: { cinderegg: 2, emberpepper: 1 }, effect: { kind: 'meal', meal: 'devilled' } },
  flip: { name: 'Frostmint Egg Flip', needs: { rimeegg: 2, frostmint: 1 }, effect: { kind: 'meal', meal: 'flip' } },
  grandtour: { name: 'The Grand Tour', need: 'recipe_grandtour', needs: { meadowegg: 1, mossegg: 1, brineegg: 1, cinderegg: 1, rimeegg: 1 }, effect: { kind: 'meal', meal: 'grandtour' }, desc: 'One egg from every region, in one pan. Old Wenna in Mossgate knows how.' },
});
Object.assign(DB.meals, {
  souffle: { name: 'Aethercap Soufflé', does: '2 more Stamina on the first turn of the next match.', fx: { energy: 2 } },
  custard: { name: 'Mossberry Custard', does: 'Start the next match with 10 Block and 3 Regen.', fx: { block: 10, st: { regen: 3 } } },
  bake: { name: 'Brine Egg Bake', does: 'Start the next match with 3 Footwork: Block from cards is 3 more.', fx: { st: { dex: 3 } } },
  devilled: { name: 'Devilled Cinder Eggs', does: 'Start the next match with 3 Strength.', fx: { st: { str: 3 } } },
  flip: { name: 'Frostmint Egg Flip', does: 'Draw 3 more cards and get 1 more Stamina on the first turn of the next match.', fx: { draw: 3, energy: 1 } },
  grandtour: { name: 'The Grand Tour', does: 'Eating it rests your team\'s legs. Next match: 3 Strength, 3 Footwork, 12 Block and Bedrock (your Block does not drain all match), and 2 more Stamina and 3 more cards on the first turn.', fx: { block: 12, st: { str: 3, dex: 3, barricade: 1 }, energy: 2, draw: 3, legs: 99 } },
});
// Old Wenna knows every nest; one egg of each region and she teaches the Grand Tour
(() => {
  const W = DB.chars.wenna; if (!W) return;
  if (W.topics.nest) W.topics.nest.t += ' Bring me an egg from every region, one of each, and I will show you the GRAND tour.';
  W.topics.grand = { t: 'One of each, from all five. Crack them into one pan, hottest first, the cold one last, and never stir it. That is the Grand Tour. Your cook knows it now, at any hearth.',
    take: Object.fromEntries(Object.values(DB.eggs).map(id => [id, 1])), once: 'recipe_grandtour',
    needNo: 'The Grand Tour takes an egg from every region: Meadow, Moss, Brine, Cinder and Rime, one of each. Bring them and I will teach you.',
    t2: 'You know the Grand Tour. One egg from every region, at any hearth.' };
})();

const wW40Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y);
  if ((DB.tiles[c] || {}).use !== 'nest') return wW40Use.apply(this, arguments);
  const meta = m.meta[x + ',' + y] || {};
  if (meta.alpha && !wFlag('alpha_' + meta.alpha)) return wLog('The alpha will not let you near its nest.', 'b');
  if (wDepleted(x, y, W_EGG.days)) return wLog(DB.tiles.N.look0, 'd');
  const el = meta.elem || REGION_ELEM[wRegionHere()] || 'aether', id = DB.eggs[el] || DB.eggs.aether, n = ri(W_EGG.take[0], W_EGG.take[1]);
  wAddItem(id, n); WG.harv[wHkey(x, y)] = WG.dayAbs; wAdvance(W_EGG.minutes); wInvalidate(WG.map);
  wLog(`You take ${n} ${DB.items[id].name}${n > 1 ? 's' : ''} from the nest. It will fill again in a few days.`, 'm');
};

// a meal that rests the team's legs does it when you eat it, so the next match starts fresh
const wW40Eat = wEat;
wEat = function (id) {
  const r = wW40Eat.apply(this, arguments), f = (DB.meals[id] || {}).fx || {};
  if (!r && f.legs && typeof wRestLegs === 'function') { wRestLegs(f.legs); wLog('Your team\'s legs are fresh again.', 'm'); }
  return r;
};

const wW40RenderHelp = renderHelp;
renderHelp = function () {
  wW40RenderHelp();
  const t = $('wHelpTowns'); if (!t || $('wHelpEggs')) return;
  t.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpEggs"><b>Eggs.</b> Walk into a full nest to take 1 or 2 of its region's eggs; it fills again in ${W_EGG.days} days, and an alpha's nest stays shut until you beat the alpha. Each region's egg cooks into a strong dish with that region's forage, at any hearth, and nobody sells them. One egg from every region makes the Grand Tour, the strongest dish in the realm: Old Wenna in Mossgate teaches it.</p>`);
};
