/* w68: adventures, phase 3 (issue #47): The Marigold's Crew. The Marigold carried the last champion team before
   Vance's run and was lost on the outer sands. Captain Marrowbone always said the crew lived, and the ship's log
   (q_shiplog) lists five who swam for it. The story starts once the log is home (the first time; after that it
   carries across journeys), and it can't be lost: the last game counts win or lose.

     1  Four who swam, one who didn't (any order). Each lives somewhere new and comes back only for the sport they
        loved, in every engine:
          Bosun Gale     a troll, minding the harbour light on the Saltmere quay: a BASEBALL game (the diamond)
          Kestrel Ashby  a harpy, mining at Cinderhold: a boxing card of three BOUTS (the ring)
          Liss Varo      an elf at the Rimewatch abbey: SOCCER in a blizzard (the card game)
          Coach Horne    a minotaur coaching children at Mossgate: a FOOTBALL game against his pupils (the gridiron)
          Pip Tarrow     never made it. Dusty Rowe, who coached them, knows where the crew buried Pip: on the dunes
                         by the wreck
     2  One last game: the four play you together at the Crown (ask Herald Pim for the REUNION). Win or lose, the
        story ends; a win gets the better ending.
   Reward, kept for good: Bosun Gale joins at the team's level (and on any later journey, ask him to JOIN on the
   Saltmere quay), with Drop Anchor (a Hall of Fame card) and the Marigold's Flag (a trophy no pool offers: 3 more
   fans after every win).

   The four stand in their cities beside the training coaches (w23), on open ground the test checks.
   While Gale plays for you, his figure on the quay steps off the map (wCrewPlace).
   Wraps: wSay (wW68Say: Marrowbone's CREW hint once the log is home, until the story starts; Gale leaving the quay),
   wEnterMap (wW68EnterMap: Gale's place on the quay). The Marigold's Flag answers fightWon and matchWon, so it pays
   for a win in every engine. */

/* ---------- the four, placed in their cities ---------- */
const W_CREW = [
  { id: 'adv_gale', city: 'saltmere', at: [18, 26], name: 'Bosun Gale', kind: 'troll', look: { coat: '#235c9c', acc: 'hat', hair: '#8a857e' },
    greet: 'Mind the rope. The light does not mind itself.', job: 'I mind the harbour light here on the quay. Quiet work. I used to play first base for a living.' },
  { id: 'adv_kestrel', city: 'cinderhold', at: [32, 26], name: 'Kestrel Ashby', kind: 'harpy', look: { coat: '#5a3a2a', acc: 'goggles', hair: '#1a1210' },
    greet: 'You are standing on my pick.', job: 'Seam work, deep shift. I box on Sundays to keep my hands honest.' },
  { id: 'adv_liss', city: 'rimewatch', at: [30, 11], name: 'Liss Varo', kind: 'elf', look: { coat: '#bfe6f2', acc: 'robe', hair: '#f2c14e' },
    greet: 'The abbey is closed to visitors. I am not, apparently.', job: 'I copy books for the abbey. I kick a ball against its wall when nobody is looking.' },
  { id: 'adv_horne', city: 'mossgate', at: [9, 12], name: 'Coach Horne', kind: 'minotaur', look: { coat: '#4a6a4a', acc: 'cap', hair: '#6c625c', tall: 1 },
    greet: 'Whistle first, questions after.', job: 'I coach the Mossgate youngsters. Football, mostly. They are better than you would think.' },
];
for (const C of W_CREW) {
  W_CITIES[C.city].npcs.push([C.id, C.at[0], C.at[1], 1]);
  DB.chars[C.id] = { name: C.name, kind: C.kind, look: C.look, greet: C.greet, topics: { job: { t: C.job } } };
}
// what each says about the Marigold when the story isn't answering (before it starts, or once their part is done)
DB.chars.adv_gale.topics.marigold = { t: 'She was a good ship. I do not talk about her much.' };
DB.chars.adv_kestrel.topics.marigold = { t: 'Old news. Mine it somewhere else.' };
DB.chars.adv_liss.topics.marigold = { t: 'I copied her log once, for the abbey. I did not tell them I was in it.' };
DB.chars.adv_horne.topics.marigold = { t: 'I tell the youngsters about her when they will not listen to anything else.' };
DB.chars.marrowbone.topics.crew = { t: 'They lived. I know they did. The log says where they swam for, if you have the log.' };

/* ---------- the reward ---------- */
RELICS.marigold = { n: "The Marigold's Flag", adv: 1, desc: 'After every win, 3 more fans come to watch.', ico: 'horn' };
// a win in any engine: the card game fires fightWon, baseball, football and boxing fire matchWon (w20d, w44, w53)
const W_CREW_FLAG = 3;
const wCrewFlagFans = () => { RUN.fans = (RUN.fans || 0) + W_CREW_FLAG; };
TROPHY_FX.marigold = { on: { fightWon: wCrewFlagFans, matchWon: wCrewFlagFans } };
Object.assign(RELICS.marigold, TROPHY_FX.marigold); // (core/hooks.js copied TROPHY_FX into RELICS at its load, before this part)
K('adv_anchor', 'Drop Anchor', 'none', 'skl', 1, 'l', 'self', [['b', 12], ['s', 'weak', 1, 'all']], { fl: 'Bosun Gale\'s old call. The whole crew knew what came next.' });

/* ---------- the story ---------- */
W_ADV.push({
  id: 'crew', title: "The Marigold's Crew", regions: ['tide', 'ember', 'rime', 'bloom', 'plains'],
  teaser: 'The Marigold\'s champion crew, scattered across the realm since the wreck.',
  rumours: ['Captain Marrowbone in Saltmere swears the Marigold\'s CREW lived. Nobody believes him. Bring him the ship\'s log and ask.',
    'There is a troll on the Saltmere quay who will not talk about a ship called the Marigold. Marrowbone knows about the CREW.'],
  starter: { who: 'marrowbone', kw: 'crew', need: ['q_shiplog'], learn: 'The Marigold\'s log lists five who swam: Bosun Gale for the Saltmere quay, Kestrel Ashby for Cinderhold, Liss Varo for the Rimewatch abbey, and Horne for Mossgate. Pip Tarrow: Dusty Rowe, who coached them, would know.',
    t: 'The last page of the log. Five names, and where each swam for. Gale, for the Saltmere quay. Kestrel Ashby, for Cinderhold. Liss Varo, for the abbey at Rimewatch. Horne, for Mossgate. And Pip Tarrow. Dusty Rowe coached them; ask him about Pip. Ask each of the others about the MARIGOLD.' },
  chapters: [
    { t: 'Four who swam, one who didn\'t', sum: 'Find the crew: Bosun Gale in Saltmere, Kestrel Ashby in Cinderhold, Liss Varo in Rimewatch and Coach Horne in Mossgate (ask each about the MARIGOLD), and ask Dusty Rowe in Graftonbury about PIP.', pay: { gold: 80, fans: 20 }, any: true, steps: [
      { k: 'talk', who: 'adv_gale', kw: 'marigold', t: 'Marrowbone sent you. Course he did. I will come back for one game with the old crew, if you show me you can play mine first. BASEBALL. Nine innings.', learn: 'Bosun Gale will come back if you beat him at BASEBALL.' },
      { k: 'match', who: 'adv_gale', kw: 'baseball', after: 0, engine: 'ball', tier: 2, club: 'local', t: 'Gale whistles up a side from the quay. "Nine innings. Play ball."',
        win: 'Gale laughs till the light shakes. "All right. One last game."', lose: 'Gale coils his rope. "Again, when your swing is better."' },
      { k: 'talk', who: 'adv_kestrel', kw: 'marigold', t: 'Gale is alive? Then so am I, I suppose. I will play the old crew\'s game if you go three BOUTS with my Sunday lot first.', learn: 'Kestrel Ashby will come back if you win a card of three BOUTS.' },
      { k: 'match', who: 'adv_kestrel', kw: 'bouts', after: 2, engine: 'ring', tier: 2, club: 'local', t: 'Kestrel tapes her hands. "Three bouts. Pick your order."',
        win: 'Kestrel grins through a split lip. "Fine. I will be there."', lose: '"Come back with harder hands."' },
      { k: 'talk', who: 'adv_liss', kw: 'marigold', t: 'I have been waiting for someone to ask. I will come, but you will play me first: SOCCER, in the snow, the way we played on the deck in the Frostspire crossings.', learn: 'Liss Varo will come back if you win a game of SOCCER in a Rimewatch blizzard.' },
      { k: 'match', who: 'adv_liss', kw: 'soccer', after: 4, engine: 'card', sport: 'soccer', tier: 2, cond: { weather: 'blizzard' }, t: 'Liss pulls her hood up. "Snow on the ball. Just like the crossings."',
        win: 'Liss is laughing as the snow comes down. "I will tell the abbey I am going on a pilgrimage."', lose: '"The snow beat you, not me. Come back in the next blizzard."' },
      { k: 'talk', who: 'adv_horne', kw: 'marigold', t: 'My youngsters have heard about the Marigold their whole lives. Play them at FOOTBALL. If they beat you, they will never let me forget it. If you beat them, I will come.', learn: 'Coach Horne will come back if you beat his pupils at FOOTBALL.' },
      { k: 'match', who: 'adv_horne', kw: 'football', after: 6, engine: 'grid', tier: 1, club: 'local', t: 'The youngsters line up, very serious. Horne blows the whistle.',
        win: 'The youngsters mob Horne. "Go on, coach. Go and play."', lose: 'The youngsters are unbearable about it. "Again," says Horne, "when you can stand the shame."' },
      { k: 'talk', who: 'rowe', kw: 'pip', set: ['clue_marigold'], t: 'Pip. Fastest wing I ever coached. Pip went back for the others and did not come up. The crew buried Pip on the dunes by the wreck. Go and see. Say I sent you.', learn: 'Pip Tarrow went back for the others. The crew buried Pip on the dunes by the Marigold wreck.' },
      { k: 'visit', loc: 'marigold', after: 8, t: 'On the dunes above the wreck, a cairn of driftwood. Carved on the top plank: PIP TARROW, WHO WENT BACK.', learn: 'You found Pip\'s cairn on the dunes above the wreck.' }] },
    { t: 'One last game', sum: 'The four will play you together at the Crown Coliseum. Ask Herald Pim for the REUNION game.', steps: [
      { k: 'talk', who: 'marrowbone', kw: 'crew', t: 'All four. And Pip\'s cairn. ... They want one last game together, at the Crown, against you. Ask Herald Pim for the REUNION.', learn: 'The crew will play you at the Crown Coliseum. Ask Herald Pim for the REUNION.' },
      { k: 'match', who: 'herald', kw: 'reunion', after: 0, engine: 'card', tier: 3, type: 'elite', name: 'The Marigold Crew', always: true, mark: 'won',
        t: 'Herald Pim has hung the Marigold\'s colours over the Coliseum gate. The old crew, together again, against you. Win or lose, this is the last game.',
        win: 'You beat the Marigold crew. They carry you off the pitch anyway.', lose: 'The Marigold crew win one more. They are crying, and so is Marrowbone.' }] }],
  end: { t: 'the Marigold crew played their last game, and Bosun Gale is going with you.', tWin: 'you beat the champions of the Marigold in their last game, and Bosun Gale is going with you.',
    pay: { gold: 150, fans: 30 },
    unlock: { at: 'adv_gale', kw: 'join', recruit: { kind: 'troll', n: 'Bosun Gale', lvl: 'team', flav: 'First base on the Marigold, the last champions before Vance. Drops anchor when it matters.' },
      relic: 'marigold', cards: ['adv_anchor'], t: 'Gale picks up his old glove. "Right. Where are we playing?"' } },
});

/* Marrowbone hints at the crew once the log is home (until the story starts) */
const wW68Say = wSay;
wSay = function (id, kw) {
  const r = wW68Say(id, kw);
  const L = DB.chars.marrowbone.topics.log;
  if (id === 'marrowbone' && WG && r && r.key === 'log' && wFlag('q_shiplog') && !wAdvState('crew') && (r.text === L.t || r.text === L.t2))
    r.text += ' Five names on the last page. The CREW lived, I tell you.';
  if (r && r.key === 'join' && id === 'adv_gale') wCrewPlace();
  return r;
};
/* while Gale plays for you, his place on the quay is empty (he steps off the map, and comes back if you let him go) */
function wCrewPlace() {
  const C = W_CREW[0], M = MAPS[C.city], n = M && (M.npcs || []).find(x => x.id === C.id); if (!n || !WG) return;
  const away = wRoster().some(p => p.n === 'Bosun Gale'), x = away ? -1 : C.at[0], y = away ? -1 : C.at[1];
  if (n.x !== x || n.y !== y) { n.x = x; n.y = y; wInvalidate(C.city); }
}
const wW68EnterMap = wEnterMap;
wEnterMap = function (id, x, y) { const r = wW68EnterMap(id, x, y); try { if (id === W_CREW[0].city) wCrewPlace(); } catch (e) { console.error(e); } return r; };
