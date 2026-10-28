/* w21: sports grounds on the world map (issue #6, phase 1). Loads after w20f-feel.js; changes earlier parts only by
   reassignment (saved originals carry the wW21 prefix).

   Every city has two grounds just outside it, one for each of its region's sports, joined to the city by a road:

     Graftonbury   the Ballpark (baseball), the Charter Court (basketball)
     Mossgate      the Links (golf), the Tilting Lists (jousting)
     Saltmere      the Lanes (bowling), the Curling Shed (curling)
     Cinderhold    the Ash Bowl (football), the Anvil Ring (boxing)
     Rimewatch     the Pond Rink (hockey), the Hoarfrost Pitch (soccer; it was a curling sheet, and keeps the id g_sheet)

   A ground is a location (DB.locs kind 'ground', world tile 'U') with a small walk-in map built like a town
   (buildTown): the field drawn whole for its sport (tile 'd', m.field), stands ('J'), a scoreboard ('%'), a
   groundskeeper who explains how the sport scores, and a fan. The Ballpark's keeper also books ball games (act
   'ball', w20d) and the Diamond Cup (act 'dcup', w20e). Exhibitions at the other grounds are phase 2.

   The world. The grounds are placed after the rest of the world is built, so wells, bushes and old saves stay where
   they were: each takes the clear spot nearest its planned one (no well, bush, nest or entrance in reach), and a
   road is carved from its city's gate to it.

   W_GRDS     the grounds
   Wrapped: buildWorld (wW21BuildWorld: place the grounds), buildTown (wW21BuildTown: the field on the map),
   wRunAct (wW21RunAct: 'ball'), wJRules (wW21JRules: the journal's line for a ground), renderHelp (wW21RenderHelp:
   #wHelpGrounds). */

const W_GRD_REG = { graftonbury: 'plains', mossgate: 'bloom', saltmere: 'tide', cinderhold: 'ember', rimewatch: 'rime' };
const W_GRD_GC = { plains: '.', bloom: '.', tide: ':', ember: 'a', rime: 'n' };
const W_GRD_TREE = { plains: 'T', bloom: 'T', tide: 'T', ember: 'R', rime: 'T' };
// the pennant colour of each sport, as on Sudden Death's field
const W_GRD_COL = { baseball: '#c94a3a', football: '#3f7a3a', hockey: '#3a6ab8', basketball: '#e0742a', golf: '#3d6a3a', bowling: '#9b3a7a', jousting: '#3a5a9a', curling: '#b83a3a', boxing: '#8a1a1a', soccer: '#5fa8c9' };
const W_GRD_INDOOR = { bowling: 1, curling: 1, boxing: 1 };

const W_GRDS = [
  { id: 'g_ballpark', city: 'graftonbury', sport: 'baseball', name: 'Graftonbury Ballpark', at: [43, 42],
    look: 'Graftonbury Ballpark. Floodlights on poles, and the smell of cut grass and fried onions.',
    keeper: { name: 'Dusty Marl', kind: 'ogre', look: { coat: '#3f7a3a', acc: 'cap', hair: '#5e4026' },
      greet: 'Off the infield, please. I raked it this morning and I will rake it again tonight.',
      job: 'Groundskeeper. I keep the diamond: chalk, dirt, the grass that grows back where the pitcher stands. Ask me how BASEBALL scores. Bring a team of five and I will book you a GAME on the real diamond, and the League clerk keeps the DIAMOND cup.' },
    fan: { name: 'Pip Tumbler', kind: 'goblin', look: { coat: '#c94a3a', acc: 'cap', hair: '#2a1d16' }, greet: 'I have caught four foul balls here. Three with my face.' },
    arrive: 'Graftonbury Ballpark. The diamond is raked, the chalk is fresh, and somebody has left a glove on the mound.',
    ambient: ['A ball boy practises his throw against the backstop.', 'The floodlights hum, although it is daytime.', 'Somebody in the stands is already shouting at the umpire, who is not here.'] },
  { id: 'g_court', city: 'graftonbury', sport: 'basketball', name: 'The Charter Court', at: [52, 36],
    look: 'The Charter Court. A boarded court in a walled yard, and the bounce of a ball you cannot see.',
    keeper: { name: 'Nim Hoopwright', kind: 'elf', look: { coat: '#e0742a', acc: 'scarf', hair: '#d8c890' },
      greet: 'Mind the boards. They were waxed for a final that never happened.',
      job: 'I keep the court and I re-hang the hoops after every dunk. Ask me how BASKETBALL scores. Bring a full squad and I will put on a GAME.' },
    fan: { name: 'Gus Rivet', kind: 'kobold', look: { coat: '#e0742a', acc: 'goggles', hair: '#3a2c1a' }, greet: 'They say a dwarf once dunked here. On a ladder, but still.' },
    arrive: 'The Charter Court. The boards shine, the nets are chains, and the echo is louder than any crowd.',
    ambient: ['A ball bounces somewhere behind the stands, then stops.', 'The chain nets chime in the wind.', 'A sweeper pushes a wide broom from one end of the court to the other.'] },
  { id: 'g_links', city: 'mossgate', sport: 'golf', name: 'Mossgate Links', at: [21, 50],
    look: 'Mossgate Links. A long green fairway between the trees, and a flag on the far green.',
    keeper: { name: 'Agatha Divot', kind: 'gorgon', look: { coat: '#3d6a3a', acc: 'hat', hair: '#4b8c3f' },
      greet: 'Replace your divots. All of them. I count.',
      job: 'Greenkeeper. I cut the fairway, rake the bunker and talk to the moss so it stays off the green. Ask me how GOLF scores. Bring a full squad and I will put on a GAME.' },
    fan: { name: 'Webb Lightfoot', kind: 'spider', look: { coat: '#3d6a3a', acc: 'clip', hair: '#2a1d16' }, greet: 'Quiet, please. Somebody might be about to putt. Nobody is, but they might be.' },
    arrive: 'Mossgate Links. The fairway runs green between the trees, and the flag on the far green barely moves.',
    ambient: ['A ball drops out of a tree, much later than it went in.', 'Bees work the clover in the rough.', 'The flag on the green stirs and settles.'] },
  { id: 'g_lists', city: 'mossgate', sport: 'jousting', name: 'The Tilting Lists', at: [26, 51],
    look: 'The Tilting Lists. A barrier down a long sand yard, and striped tents at either end.',
    keeper: { name: 'Sir Ruddock', kind: 'werewolf', look: { coat: '#3a5a9a', acc: 'helmet', hair: '#5e4026' },
      greet: 'Stay off the sand, unless you are holding a lance. Then stay on your own side of it.',
      job: 'Marshal of the lists. I rake the sand, mend the barrier and sweep up the splinters. Ask me how JOUSTING scores. Bring a full squad and I will put on a GAME.' },
    fan: { name: 'Fenna Moss', kind: 'elf', look: { coat: '#f2c14e', acc: 'scarf', hair: '#c98a3a' }, greet: 'I come for the lances breaking. The sound. Nobody else understands.' },
    arrive: 'The Tilting Lists. The barrier runs down the middle of the sand, and the splinters of the last match are still in it.',
    ambient: ['A pennant snaps on a tent pole.', 'Somebody is mending a lance with string, hopefully.', 'Hoofprints cross the sand, both ways, fast.'] },
  { id: 'g_lanes', city: 'saltmere', sport: 'bowling', name: 'The Saltmere Lanes', at: [79, 49],
    look: 'The Saltmere Lanes. A long low hall of tarred timber, and the crash of pins from inside.',
    keeper: { name: 'Moll Gutter', kind: 'zombie', look: { coat: '#9b3a7a', acc: 'apron', hair: '#8a857e' },
      greet: 'Shoes off the lanes. They are oiled, and so will you be.',
      job: 'I keep the lanes oiled and set the pins by hand, all ten, every frame. Ask me how BOWLING scores. Bring a full squad and I will put on a GAME.' },
    fan: { name: 'Barnaby Keel', kind: 'troll', look: { coat: '#2f7898', acc: 'hat', hair: '#3a2c1a' }, greet: 'A strike here sounds like the harbour wall coming down. In a good way.' },
    arrive: 'The Saltmere Lanes. Four lanes of oiled wood, the pins set at the far end, and the sea booming under the floor.',
    ambient: ['Somewhere down the hall, the pins go over all at once.', 'The lamps sway on their chains when the tide turns.', 'A pinsetter whistles a sea shanty, badly.'] },
  { id: 'g_shed', city: 'saltmere', sport: 'curling', name: 'The Curling Shed', at: [69, 51],
    look: 'The Curling Shed. A barn on the sand with frost on its windows, in a town where nothing else freezes.',
    keeper: { name: 'Brush Hennock', kind: 'wraith', look: { coat: '#b83a3a', acc: 'robe', hair: '#cfe8f0' },
      greet: 'Close the door. The ice does not like the sea air, and neither do I.',
      job: 'Icemaker. I flood the sheets at night and pebble them in the morning, and I keep the cold in somehow. Ask me how CURLING scores. Bring a full squad and I will put on a GAME.' },
    fan: { name: 'Tilda Spindle', kind: 'spider', look: { coat: '#b83a3a', acc: 'scarf', hair: '#2a1d16' }, greet: 'Eight legs, eight brooms. Nobody sweeps like me, and nobody lets me play.' },
    arrive: 'The Curling Shed. Two sheets of ice under a timber roof, the houses painted on, and your breath in the air.',
    ambient: ['A stone slides the length of the sheet with a sound like far thunder.', 'Frost creeps up the inside of the windows.', 'Somebody sweeps the ice that nobody is playing on.'] },
  { id: 'g_bowl', city: 'cinderhold', sport: 'football', name: 'The Ash Bowl', at: [79, 14],
    look: 'The Ash Bowl. A pitch dug into the ash, with stands of black basalt all round it.',
    keeper: { name: 'Clinker Dunn', kind: 'minotaur', look: { coat: '#3f7a3a', acc: 'goggles', hair: '#43332e' },
      greet: 'Wipe your hooves. The grass here is hard won.',
      job: 'Groundsman. Grass does not want to grow on ash, so I carry it in, and I water it twice a day with a bucket. Ask me how FOOTBALL scores. Bring a full squad and I will put on a GAME.' },
    fan: { name: 'Sooty Pike', kind: 'kobold', look: { coat: '#ff8a3c', acc: 'cap', hair: '#2a1d16' }, greet: 'Best touchdown I ever saw went through the stands and into the lava. Still counted.' },
    arrive: 'The Ash Bowl. Green grass in a black bowl, the only green for miles, and the goalposts scorched at the top.',
    ambient: ['Ash drifts onto the pitch, and the groundsman sweeps it off again.', 'Heat shimmers over the basalt stands.', 'A kicker practises field goals at an empty end.'] },
  { id: 'g_ring', city: 'cinderhold', sport: 'boxing', name: 'The Anvil Ring', at: [79, 20],
    look: 'The Anvil Ring. A forge hall with a boxing ring where the anvils used to be.',
    keeper: { name: 'Ma Gristle', kind: 'golem', look: { coat: '#8a1a1a', acc: 'apron', hair: '#6c625c' },
      greet: 'If you are bleeding, bleed on the canvas. I just mopped the boards.',
      job: 'I keep the ring: tighten the ropes, ring the bell, mop up after. Ask me how BOXING scores. Bring a full squad and I will put on a GAME.' },
    fan: { name: 'Hob Clatter', kind: 'ogre', look: { coat: '#8a1a1a', acc: 'cap', hair: '#3a2c1a' }, greet: 'I come for the bell. Every third round. Ding. Lovely.' },
    arrive: 'The Anvil Ring. A ring roped in red, white and blue, the boards scorched black, and the bell hung from a forge chain.',
    ambient: ['The bell swings on its chain and nearly rings.', 'Somebody is skipping rope in the corner, very loudly.', 'The forge next door roars, and the ropes hum.'] },
  { id: 'g_rink', city: 'rimewatch', sport: 'hockey', name: 'The Pond Rink', at: [26, 15],
    look: 'The Pond Rink. A frozen pond with boards round it, and the scrape of skates.',
    keeper: { name: 'Old Tove', kind: 'witch', look: { coat: '#3a6ab8', acc: 'scarf', hair: '#eef2ef' },
      greet: 'Skates on, or stay on the bank. The ice is thick. I checked. With my head, once.',
      job: 'I keep the rink: scrape the ice, paint the lines, pull the children out of the goal. Ask me how HOCKEY scores. Bring a full squad and I will put on a GAME.' },
    fan: { name: 'Little Brann', kind: 'harpy', look: { coat: '#3a6ab8', acc: 'cap', hair: '#2a1d16' }, greet: 'I am going to play for Rimewatch when I am bigger. I am already very fast. Watch.' },
    arrive: 'The Pond Rink. The pond is frozen solid, the lines are painted on, and the boards are older than the abbey.',
    ambient: ['A puck cracks against the boards and nobody is there.', 'Children skate in a long chain, shrieking.', 'The ice groans, deep down, and settles.'] },
  { id: 'g_sheet', city: 'rimewatch', sport: 'soccer', name: 'The Hoarfrost Pitch', at: [16, 21],
    look: 'The Hoarfrost Pitch. A snow pitch in the pines below the abbey, a goal at each end, smoke rising from its stove.',
    keeper: { name: 'Sister Hogline', kind: 'lich', look: { coat: '#5fa8c9', acc: 'robe', hair: '#cfe8ff' },
      greet: 'Stamp the snow off. Then go back out in it: this pitch is for kicking.',
      job: 'The abbey keeps the pitch, and I keep it for the abbey: roll the snow, chalk the lines blue, bless the ball. Ask me how SOCCER scores. It is eleven a side: bring five of your own, the call-ups make up the rest, and I will put on a GAME.' },
    fan: { name: 'Halla Frost', kind: 'vampire', look: { coat: '#9fe6ff', acc: 'scarf', hair: '#1a1210' }, greet: 'It is always cold out here. I like it. The sun cannot find me under all this snow.' },
    arrive: 'The Hoarfrost Pitch. Snow packed hard and chalked blue, a goal at each end, and the abbey bell for full time.',
    ambient: ['A ball thumps into the net and the snow falls off the crossbar.', 'The stove by the bench ticks, and nobody stands near it for long.', 'Somebody chants a passing drill under their breath: one, two, three, shoot.'] },
];
function wGrd(id) { return W_GRDS.find(g => g.id === id) || null; }
function wGrdOfMap(mapId) { return wGrd(mapId); }
function wGrdsOf(city) { return W_GRDS.filter(g => g.city === city); }

/* ---------- tiles ---------- */
Object.assign(DB.tiles, {
  U: { name: 'sports ground', walk: 1, enter: 1, look: 'A sports ground. You can hear the crowd from here.' },
  d: { name: 'field', walk: 1, ground: 1, look: 'The field of play, marked out for its sport.' },
  J: { name: 'stands', walk: 0, look: 'The stands: rows of benches, worn smooth by a great many seats.' },
  '%': { name: 'scoreboard', walk: 0, use: 'sign', look: 'The scoreboard.' },
});

/* ---------- people ---------- */
for (const g of W_GRDS) {
  const S = SPORTS[g.sport], K = g.keeper, kw = g.sport;
  const topics = {
    job: { t: K.job },
    [kw]: { t: 'In a match here it goes like this. ' + S.desc, xp: 5 },
    fixtures: { t: 'The League draws up a fixture list for every ground, one day. Until then it is friendlies and challenges, one GAME a day, and I like it that way.' },
  };
  if (g.sport === 'baseball') Object.assign(topics, {
    game: { t: 'Five of your own players and the call-ups fill the nine. Here is the card.', act: 'ball' },
    diamond: { t: 'Eight nines, three rounds, once a week, and the final under these lights. Here is the bracket.', act: 'dcup' },
  });
  DB.chars['gk_' + g.id.slice(2)] = { name: K.name, kind: K.kind, look: K.look, greet: K.greet, topics };
  DB.chars['gf_' + g.id.slice(2)] = { name: g.fan.name, kind: g.fan.kind, look: g.fan.look, greet: g.fan.greet, topics: {} };
}

/* ---------- the ground maps: built by buildTown like the towns ---------- */
const W_GRD_F = { x: 5, y: 3, w: 14, h: 8 };   // the field
const W_GRD_CITY = { graftonbury: 'Graftonbury', mossgate: 'Mossgate', saltmere: 'Saltmere', cinderhold: 'Cinderhold', rimewatch: 'Rimewatch' };
function wGrdDef(g) {
  const reg = W_GRD_REG[g.city], gc = W_GRD_GC[reg], F = W_GRD_F, decor = [];
  for (let x = 3; x <= 20; x++) for (const y of [1, 2]) decor.push(['J', x, y]);
  for (let y = 3; y < F.y + F.h; y++) for (const x of [3, 4, 19, 20]) decor.push(['J', x, y]);
  decor.push(['%', 11, 2, { text: g.name + ' scoreboard. Home 0, away 0, and nobody has played here this season.' }], ['%', 12, 2]);
  decor.push(['l', 2, 11], ['l', 21, 11], ['x', 10, 12], ['x', 14, 12]);
  decor.push(['S', 13, 15, { text: g.name.toUpperCase() + '. The ' + SPORTS[g.sport].n.toLowerCase() + ' ground of ' + W_GRD_CITY[g.city] + '. Keep off the field unless you are on it.' }]);
  return { id: g.id, name: g.name, ground: gc, tree: W_GRD_TREE[reg], w: 24, h: 18, trees: 10, spawn: [12, 16],
    streets: [[12, F.y + F.h, 12, 17]], water: [[F.x, F.y, F.w, F.h, 'd']], buildings: [], decor,
    npcs: [['gk_' + g.id.slice(2), 9, 13, 1], ['gf_' + g.id.slice(2), 16, 14]],
    arrive: g.arrive, ambient: g.ambient, field: Object.assign({ sport: g.sport, gc }, F), grd: g.id };
}
for (const g of W_GRDS) DB.towns.push(wGrdDef(g));

const wW21BuildTown = buildTown;
buildTown = function (def) {
  const m = wW21BuildTown(def);
  if (def.field) { m.field = def.field; m.grd = def.grd; }
  return m;
};

/* ---------- on the world ---------- */
function wGrdLoc(g) { return { id: g.id, kind: 'ground', x: g.at[0], y: g.at[1], tile: 'U', map: g.id, name: g.name, city: g.city, sport: g.sport }; }
// the clear spot nearest the planned one: no well, bush, nest or entrance within reach, the city's region, not a road
function wGrdSpot(map, g) {
  const reg = W_GRD_REG[g.city], [px, py] = g.at;
  const ok = (x, y) => {
    if (x < 2 || y < 2 || x >= WW - 2 || y >= WH - 3 || map.region[y * WW + x] !== reg) return false;
    if (['=', 'b', '~', 'L'].includes(map.t[y][x])) return false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const k = (x + dx) + ',' + (y + dy), c = map.t[y + dy][x + dx];
      if (map.meta[k] || (DB.tiles[c] && DB.tiles[c].enter)) return false;
    }
    return true;
  };
  for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (ok(px + dx, py + dy)) return [px + dx, py + dy];
  }
  return [px, py];
}
const wW21BuildWorld = buildWorld;
buildWorld = function () {
  DB.locs = DB.locs.filter(l => l.kind !== 'ground');
  const map = wW21BuildWorld();
  for (const g of W_GRDS) {
    const [x, y] = wGrdSpot(map, g), gc = W_GRD_GC[W_GRD_REG[g.city]], city = DB.locs.find(l => l.id === g.city);
    // clear the ground's own tile and anything in the way round it, but keep the roads
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = map.t[y + dy][x + dx]; if (!walkCh(c) || c === '~') map.t[y + dy][x + dx] = gc; }
    map.t[y][x] = 'U'; map.meta[x + ',' + y] = { loc: g.id, under: gc, look: g.look };
    const L = wGrdLoc(g); L.x = x; L.y = y; DB.locs.push(L);
    carvePath(map, city.x, city.y + 1, x, y + 1, true);
  }
  return map;
};

/* ---------- acts ---------- */
const wW21RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'ball') return void wOpenBallCard({});
  return wW21RunAct(act, id);
};

/* ---------- drawing ---------- */
WPRI.d = 0; // the field has hard edges: no grass spills onto it, and it spills onto nothing
// the whole field, drawn in field pixels from its top-left; each 'd' tile draws its own piece of it
function wGrdArt(c, sp, W, H) {
  const chalk = 'rgba(250,246,232,.88)';
  const rect = (x, y, w, h, f) => { c.fillStyle = f; c.fillRect(x, y, w, h); };
  const disc = (x, y, r, f) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = f; c.fill(); };
  const ring = (x, y, r, col, w) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.lineWidth = w || 2; c.strokeStyle = col || chalk; c.stroke(); };
  const box = (x, y, w, h, col, lw) => { c.lineWidth = lw || 2; c.strokeStyle = col || chalk; c.strokeRect(x, y, w, h); };
  const bands = (base, n, k) => { for (let i = 0; i * n < W; i++) rect(i * n, 0, n, H, tint(base, i % 2 ? -(k || .05) : (k || .05) * .8)); };
  const planks = (base, gap) => { rect(0, 0, W, H, base); for (let y = 0, i = 0; y < H; y += gap, i++) { rect(0, y, W, gap, tint(base, ((i * 37) % 7 - 3) * .012)); wLine(c, [[0, y], [W, y]], .7, 'rgba(29,20,15,.32)'); for (let x = (i * 53) % 90; x < W; x += 90) wLine(c, [[x, y], [x, y + gap]], .7, 'rgba(29,20,15,.28)'); } };
  const ice = () => { rect(0, 0, W, H, '#e3eef4'); for (let i = 0; i < 26; i++) { const x = (i * 97) % W, y = (i * 61) % H; wLine(c, [[x, y], [x + 40, y + 6]], 1, 'rgba(255,255,255,.7)'); } };
  switch (sp) {
    case 'baseball': {
      bands('#5f9a44', 32); rect(0, 0, W, 12, '#a87a4a');
      const hx = W / 2, hy = H - 24, d = 132, pt = (u, v) => [hx + u * d * .72, hy - v * d * .72];
      const dia = k => pPoly([[hx, hy + k], [hx + d * .72 + k, hy - d * .72], [hx, hy - d * 1.44 - k], [hx - d * .72 - k, hy - d * .72]]);
      c.fillStyle = '#b07a48'; c.fill(dia(20)); c.fillStyle = '#62a046'; c.fill(dia(-18)); wStroke(c, dia(20), 1.2, 'rgba(29,20,15,.5)');
      wLine(c, [[hx, hy], [hx + 400, hy - 400]], 2, chalk); wLine(c, [[hx, hy], [hx - 400, hy - 400]], 2, chalk);
      disc(hx, hy - d * .72, 13, '#b07a48'); rect(hx - 5, hy - d * .72 - 1.5, 10, 3, '#f2ead8');
      for (const [u, v] of [[1, 1], [0, 2], [-1, 1]]) { const [x, y] = pt(u, v); rect(x - 6, y - 6, 12, 12, '#f2ead8'); box(x - 6, y - 6, 12, 12, 'rgba(29,20,15,.6)', .8); }
      c.fillStyle = '#f2ead8'; c.fill(pPoly([[hx - 7, hy - 6], [hx + 7, hy - 6], [hx + 7, hy], [hx, hy + 6], [hx - 7, hy]]));
      box(hx - 22, hy - 10, 12, 18, chalk, 1.4); box(hx + 10, hy - 10, 12, 18, chalk, 1.4);
      break;
    }
    case 'football': {
      bands('#4f8a3c', W / 14, .06); const ez = W / 12;
      rect(0, 0, ez, H, '#7a2a2a'); rect(W - ez, 0, ez, H, '#2a4a7a');
      for (let i = 0; i <= 10; i++) { const x = ez + i * (W - 2 * ez) / 10; wLine(c, [[x, 8], [x, H - 8]], i === 5 ? 3.5 : 2, chalk); }
      for (let i = 1; i < 50; i++) { const x = ez + i * (W - 2 * ez) / 50; for (const y of [H * .36, H * .64]) wLine(c, [[x, y - 3], [x, y + 3]], 1.2, chalk); }
      box(6, 6, W - 12, H - 12, chalk, 2.5);
      for (const x of [ez * .45, W - ez * .45]) { wLine(c, [[x, H / 2 - 26], [x, H / 2 + 26]], 4, '#f2c14e'); disc(x, H / 2, 4, '#c9962a'); }
      break;
    }
    case 'hockey': {
      ice(); const red = '#c83a3a', blue = '#3a6ab8';
      wLine(c, [[W / 2, 6], [W / 2, H - 6]], 5, red); wLine(c, [[W * .33, 6], [W * .33, H - 6]], 5, blue); wLine(c, [[W * .67, 6], [W * .67, H - 6]], 5, blue);
      ring(W / 2, H / 2, 36, blue, 2.5); disc(W / 2, H / 2, 4, blue);
      for (const x of [W * .16, W * .84]) for (const y of [H * .3, H * .7]) { ring(x, y, 24, red, 2); disc(x, y, 3.5, red); }
      for (const [x, s] of [[W * .06, 1], [W * .94, -1]]) { wLine(c, [[x, 10], [x, H - 10]], 1.6, red); c.beginPath(); c.arc(x, H / 2, 20, -Math.PI / 2, Math.PI / 2, s < 0); c.fillStyle = 'rgba(120,170,230,.55)'; c.fill(); rect(x - (s > 0 ? 10 : 0), H / 2 - 10, 10, 20, 'rgba(200,58,58,.85)'); }
      c.save(); const b = pRR(3, 3, W - 6, H - 6, 44); c.lineWidth = 6; c.strokeStyle = '#f6f2e8'; c.stroke(b); wStroke(c, b, 2.2); c.restore();
      break;
    }
    case 'basketball': {
      planks('#c8925a', 10); box(10, 10, W - 20, H - 20, chalk, 2.5);
      wLine(c, [[W / 2, 10], [W / 2, H - 10]], 2.5, chalk); ring(W / 2, H / 2, 32); ring(W / 2, H / 2, 10, '#a8462e', 3);
      for (const [x, s] of [[10, 1], [W - 10, -1]]) {
        const kw = 72, kh = 76; rect(s > 0 ? x : x - kw, H / 2 - kh / 2, kw, kh, 'rgba(168,70,46,.55)'); box(s > 0 ? x : x - kw, H / 2 - kh / 2, kw, kh);
        ring(x + s * kw, H / 2, 24); c.beginPath(); c.arc(x + s * 14, H / 2, H * .42, -Math.PI / 2, Math.PI / 2, s < 0); c.lineWidth = 2; c.strokeStyle = chalk; c.stroke();
        wLine(c, [[x + s * 6, H / 2 - 18], [x + s * 6, H / 2 + 18]], 3, '#efe4cc'); ring(x + s * 14, H / 2, 7, '#e0742a', 2.5);
      }
      break;
    }
    case 'golf': {
      rect(0, 0, W, H, '#3f6a34'); for (let i = 0; i < 140; i++) rect((i * 89) % W, (i * 47) % H, 2, 2, 'rgba(20,40,10,.3)');
      const fw = new Path2D(); fw.moveTo(10, H * .55); fw.bezierCurveTo(W * .25, H * .1, W * .45, H * .95, W * .7, H * .35); fw.bezierCurveTo(W * .8, H * .1, W * .95, H * .3, W * .93, H * .55); fw.bezierCurveTo(W * .9, H * .8, W * .6, H * .7, W * .5, H * .78); fw.bezierCurveTo(W * .3, H * .95, W * .2, H * .8, 10, H * .75); fw.closePath();
      c.fillStyle = '#6aa84e'; c.fill(fw); wStroke(c, fw, 1.2, 'rgba(29,20,15,.45)');
      c.save(); c.clip(fw); for (let i = 0; i * 26 < W; i++) if (i % 2) rect(i * 26, 0, 26, H, 'rgba(255,255,230,.07)'); c.restore();
      rect(16, H * .58, 26, 20, '#7ab85a'); box(16, H * .58, 26, 20, 'rgba(29,20,15,.5)', 1);
      const gr = pEl(W * .82, H * .44, 46, 34); c.fillStyle = '#86c466'; c.fill(gr); wStroke(c, gr, 1.4, 'rgba(29,20,15,.55)');
      const bk = pEl(W * .66, H * .74, 30, 15); c.fillStyle = '#e6d098'; c.fill(bk); wStroke(c, bk, 1.2, 'rgba(29,20,15,.5)');
      const hx = W * .84, hy = H * .42; disc(hx, hy, 4, '#111'); wLine(c, [[hx, hy], [hx, hy - 40]], 2, '#efe4cc'); c.fillStyle = '#e0533a'; c.fill(pPoly([[hx + 1, hy - 40], [hx + 24, hy - 33], [hx + 1, hy - 26]]));
      break;
    }
    case 'bowling': {
      rect(0, 0, W, H, '#2e2420');
      const n = 4, lw = (W - 40) / n;
      for (let i = 0; i < n; i++) {
        const x = 20 + i * lw + 10, w = lw - 20;
        rect(x - 6, 0, 6, H, '#1a1410'); rect(x + w, 0, 6, H, '#1a1410');
        rect(x, 0, w, H, '#d8b07a'); for (let k = 1; k < 6; k++) wLine(c, [[x + k * w / 6, 0], [x + k * w / 6, H]], .7, 'rgba(90,50,20,.35)');
        wLine(c, [[x, H - 40], [x + w, H - 40]], 2.4, '#3a2a22');
        c.fillStyle = '#3a2a22'; for (let k = 1; k < 6; k++) c.fill(pPoly([[x + k * w / 6, H - 82], [x + k * w / 6 - 3, H - 74], [x + k * w / 6 + 3, H - 74]]));
        for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) { const px = x + w / 2 + (j - row / 2) * 13, py = 52 - row * 11; disc(px, py, 4.2, '#f4efe2'); ring(px, py, 4.2, 'rgba(29,20,15,.7)', .8); }
        wStroke(c, pRR(x, 0, w, H, 0), 1, 'rgba(29,20,15,.6)');
      }
      break;
    }
    case 'jousting': {
      rect(0, 0, W, H, '#c9a46c'); for (let i = 0; i < 260; i++) rect((i * 71) % W, (i * 43) % H, 2, 2, i % 3 ? 'rgba(110,80,30,.25)' : 'rgba(255,240,200,.3)');
      for (let i = 0; i < 6; i++) wLine(c, [[20, 24 + i * 8], [W - 20, 24 + i * 8]], .8, 'rgba(110,80,30,.25)');
      const y = H / 2; for (let x = 28; x <= W - 28; x += 32) { rect(x - 3, y - 10, 6, 20, '#5e4026'); box(x - 3, y - 10, 6, 20, WINKC, 1); }
      for (let x = 28; x < W - 28; x += 32) { rect(x, y - 5, 32, 6, (x / 32 | 0) % 2 ? '#3a5a9a' : '#f2c14e'); }
      wLine(c, [[28, y - 5], [W - 28, y - 5]], 1, WINKC); wLine(c, [[28, y + 1], [W - 28, y + 1]], 1, WINKC);
      for (const [x, col] of [[14, '#3a5a9a'], [W - 14, '#c94a3a']]) { const p = pPoly([[x - 9, y - 30], [x + 9, y - 30], [x + 9, y - 14], [x, y - 6], [x - 9, y - 14]]); wFlat(c, p, col, 1.2); }
      break;
    }
    case 'soccer': { // a snow pitch: grass through the snow, the lines chalked blue, a goal at each end
      rect(0, 0, W, H, '#e8f0f4');
      for (let i = 0; i < 30; i++) { const x = (i * 83) % W, y = (i * 47) % H; c.beginPath(); c.ellipse(x, y, 14 + (i % 4) * 5, 4, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(95,140,75,.22)'; c.fill(); }
      const blue = 'rgba(60,90,150,.8)';
      box(6, 6, W - 12, H - 12, blue, 2); wLine(c, [[W / 2, 6], [W / 2, H - 6]], 2, blue); ring(W / 2, H / 2, 34, blue, 2); disc(W / 2, H / 2, 3, blue);
      for (const x of [6, W - 62]) box(x, H / 2 - 60, 56, 120, blue, 2);
      for (const x of [0, W - 10]) { rect(x, H / 2 - 26, 10, 52, 'rgba(244,244,240,.9)'); box(x, H / 2 - 26, 10, 52, 'rgba(29,20,15,.6)', 1); }
      break;
    }
    case 'curling': {
      ice();
      for (const sy of [H * .25, H * .75]) {
        const top = sy - H * .22, bot = sy + H * .22;
        wLine(c, [[8, top], [W - 8, top]], 2, 'rgba(40,40,60,.55)'); wLine(c, [[8, bot], [W - 8, bot]], 2, 'rgba(40,40,60,.55)');
        wLine(c, [[8, sy], [W - 8, sy]], 1, 'rgba(40,40,60,.35)');
        for (const x of [W * .3, W * .7]) wLine(c, [[x, top], [x, bot]], 2.4, 'rgba(200,58,58,.7)');
        for (const hx of [W * .1, W * .9]) { for (const [r, col] of [[24, '#3a6ab8'], [16, '#f6f9fb'], [9, '#c83a3a'], [3, '#f6f9fb']]) disc(hx, sy, r, col); ring(hx, sy, 24, 'rgba(29,20,15,.5)', .8); wLine(c, [[hx, top], [hx, bot]], 1, 'rgba(40,40,60,.45)'); }
      }
      break;
    }
    case 'boxing': {
      planks('#5a3a2a', 12);
      const s = H - 44, x0 = W / 2 - s / 2, y0 = 22;
      rect(x0 - 12, y0 - 12, s + 24, s + 24, '#2a3a6a'); box(x0 - 12, y0 - 12, s + 24, s + 24, WINKC, 1.6);
      rect(x0, y0, s, s, '#d8c8a8'); disc(W / 2, y0 + s / 2, 28, 'rgba(168,50,30,.25)');
      ['#c83a3a', '#f2f2f2', '#3a6ab8'].forEach((col, k) => box(x0 + 2 + k * 4, y0 + 2 + k * 4, s - 4 - k * 8, s - 4 - k * 8, col, 2.2));
      [[x0, y0, '#c83a3a'], [x0 + s, y0, '#3a6ab8'], [x0, y0 + s, '#f2f2f2'], [x0 + s, y0 + s, '#f2f2f2']].forEach(([x, y, col]) => { disc(x, y, 6, col); ring(x, y, 6, WINKC, 1.2); });
      break;
    }
  }
  c.lineWidth = 2.4; c.strokeStyle = WINKC; c.strokeRect(1, 1, W - 2, H - 2);
}
WGND.d = (c, P, r, e) => {
  const F = e.m.field;
  if (!F) { c.fillStyle = P.grass; c.fillRect(0, 0, 32, 32); return; }
  const ix = e.x - F.x, iy = e.y - F.y;
  if (ix < 0 || iy < 0 || ix >= F.w || iy >= F.h) return void (WGND[F.gc] || WGND['.'])(c, P, r, e); // under the stands
  c.save(); c.translate(-ix * WTILE, -iy * WTILE);
  try { wGrdArt(c, F.sport, F.w * WTILE, F.h * WTILE); } finally { c.restore(); }
};
// the stands: three terraces of benches, every seat taken by somebody in a scarf
WOBJ.J = (c, P, r, e) => {
  const sp = (e.m.field || {}).sport, cols = [W_GRD_COL[sp] || '#c94a3a', '#efe4cc', '#3a6ab8', '#f2c14e', W_GRD_COL[sp] || '#c94a3a'];
  for (let i = 0; i < 3; i++) {
    const y = 2 + i * 10, b = pRR(-1, y, 34, 9, 1);
    wCel(c, b, tint('#a8a398', -i * .08), 1, 1);
    for (let k = 0; k < 3; k++) { const hx = 5 + k * 11 + r() * 3, hy = y + 2; c.fillStyle = cols[(r() * cols.length) | 0]; c.beginPath(); c.arc(hx, hy, 3.2, 0, 7); c.fill(); c.lineWidth = .8; c.strokeStyle = WINKC; c.stroke(); }
  }
};
// the scoreboard, on two posts above the top stand
WOBJ['%'] = (c, P, r, e) => {
  const sp = (e.m.field || {}).sport, left = e.at(1, 0) === '%';
  wFlat(c, pRR(left ? 6 : 24, 12, 2.6, 20, .6), '#2f3140', 1);
  const b = pRR(left ? 2 : -2, -14, 32, 26, 1.5); wCel(c, b, '#1f3a2a', 1, 1.4);
  c.fillStyle = W_GRD_COL[sp] || '#c94a3a'; c.fillRect(left ? 4 : 0, -12, 28, 4);
  c.fillStyle = '#ffd877'; for (let i = 0; i < 2; i++) for (let k = 0; k < 4; k++) c.fillRect((left ? 6 : 2) + k * 7, -3 + i * 7, 3, 3);
};
// on the world: a little bowl of stands round a field, or a hall for the indoor sports, with the sport's pennant
WOBJ.U = (c, P, r, e) => {
  const mt = wMeta(e.m, e.x, e.y) || {}, g = wGrd(mt.loc) || { sport: 'baseball' }, col = W_GRD_COL[g.sport] || '#c94a3a';
  wShadow(c, 17, 29, 16, 4, .32);
  if (W_GRD_INDOOR[g.sport]) {
    wHouse(c, 3, 13, 26, 15, col, P, r, g.sport === 'boxing');
  } else {
    const field = { baseball: '#5f9a44', football: '#4f8a3c', hockey: '#dbe8ef', basketball: '#c8925a', golf: '#6aa84e', jousting: '#c9a46c', soccer: '#e6eef2' }[g.sport] || '#5f9a44';
    const bowl = pEl(16, 20, 15, 9); wCel(c, bowl, '#d8ccb0', 1.2, 1.3);
    for (let i = 0; i < 9; i++) { const a = Math.PI * (.08 + i * .105); c.fillStyle = '#7a6a54'; c.fillRect(16 - Math.cos(a) * 13 - 1, 20 + Math.sin(a) * 7 - 1, 2, 2); }
    const f = pEl(16, 19, 10, 5); wFlat(c, f, field, 1);
    if (g.sport === 'baseball') { c.fillStyle = '#b07a48'; c.fill(pPoly([[16, 22], [19.5, 19], [16, 16], [12.5, 19]])); }
    else wLine(c, [[16, 14.5], [16, 23.5]], .8, 'rgba(255,255,255,.75)');
  }
  wLine(c, [[28, 26], [28, 4]], 1.2);
  wFlat(c, pPoly([[28, 4], [35, 6.5], [28, 9]]), col, .9);
};

/* ---------- the journal: a ground's rules ---------- */
const wW21JRules = wJRules;
wJRules = function (id) {
  const out = wW21JRules(id), g = wGrd(id); if (!g) return out;
  const S = SPORTS[g.sport];
  out.push(`<b>${esc(g.name)}.</b> The ${esc(S.n.toLowerCase())} ground of ${esc(W_GRD_CITY[g.city])}. ${esc(S.rule)}: ${esc(S.desc)}${g.sport === 'baseball' ? ' The groundskeeper books ball games (GAME) and the Diamond Cup (DIAMOND).' : ''}`);
  return out;
};

/* ---------- How to play ---------- */
const wW21RenderHelp = renderHelp;
renderHelp = function () {
  wW21RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpGrounds')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpGrounds"><b>Sports grounds.</b> Every city has two grounds just outside it, one for each sport its region plays, on a road from the city gate: a ballpark and a court at Graftonbury, links and lists at Mossgate, lanes and a curling shed at Saltmere, a football bowl and a boxing ring at Cinderhold, a rink and a snow pitch for soccer at Rimewatch. Walk in to see the field. The groundskeeper explains how the sport scores, and at the Graftonbury Ballpark books ball games and the Diamond Cup.</p>`);
};
