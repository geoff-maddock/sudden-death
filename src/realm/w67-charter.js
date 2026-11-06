/* w67: adventures, phase 2 (issue #47): The Lost Charter. The League was founded in Graftonbury, and its charter was
   torn into five pieces when the old hall burned. Imelda Foss finds that the First Bracket was framed with a page of
   it (so the story starts once q_bracket is done, the first time; after that it carries across journeys).

     1  The torn page: Gant Vesper took one piece. He gives it up if you beat him at his old game, basketball, at the
        Charter Court (ask the keeper there about VESPER).
     2  The four pieces, in any order:
          Mosswold   Hermit Oak, at the Hollow Shrine, wants a game under the old RULES (no gear, no set plays, no
                     Hall of Fame cards, no trophies)
          Brinefen   in the Marigold wreck, reachable only at low tide after dark (ask Marrowbone about the TIDE)
          Cindermaw  a pit fighter brought one up out of the Deep Seam; Ma Gristle puts on a BOUT for it at the Anvil
                     Ring (the ring engine)
          Frostspire Brother Halvard rings it down out of the Frozen Chapel's bell if you win a game in Rimewatch in
                     the SNOW (a blizzard); then go to the chapel
     3  The founding rule: Foss reads the charter aloud. Its lost rule: a game is won by three clear points, under the
        old rules. Herald Pim stages an EXHIBITION under it at the Crown Coliseum. A pinnacle: lose it and the charter
        goes back in a drawer for good.
   Reward: the Founder's Charm (a trophy no pool offers: 1 Strength and 1 Footwork at the start of every fight) and
   The Founding Rule (a Hall of Fame card no pool offers), handed over again by Foss on any later journey (FOUNDERS).

   Also here: the tide (wTide: a 12.4-hour tide on the running clock, so two low waters a day, two hours each, about
   48 minutes later each day; Marrowbone tells you when), old rules in the card game (no gear, set plays or Hall of
   Fame cards, and the trophies sit out until the match has ended), and a fix for the Frozen Chapel bell, which never
   set its quest flag (rq_aur2, once Halvard has sent you: rq_aur1).

   Wraps: wSay (wW67Say: Marrowbone's TIDE), wBuildEncounter (wW67BuildEncounter: carries world.rules), startCombat (wSdStartCombat: old rules thin the
   deck to basic cards and set the trophies aside), finishFight (wW67FinishFight: the trophies come back),
   wEncounterHook (wW67EncounterHook: the bell sets its flag), relicPool (wSdRelicPool: no pool offers an adventure
   trophy), renderHelp (wW67RenderHelp: #wHelpOldRules, #wHelpTide). */

/* ---------- the tide ---------- */
/* a 12.4-hour tide on the realm's running clock (so two low waters a day, about 48 minutes later each day, and no
   jump at midnight) */
const W_TIDE = { low: 2, period: 12.4, first: 2 };
function wTideNow() { return WG ? WG.dayAbs * 24 + wHour() : 0; }
function wTidePhase(t) { const P = W_TIDE.period; return (((t == null ? wTideNow() : t) - W_TIDE.first) % P + P) % P; }
function wTide(t) {
  if (!WG) return 'high';
  const d = wTidePhase(t), P = W_TIDE.period;
  return d < W_TIDE.low ? 'low' : d < P / 2 ? 'rising' : d < P / 2 + W_TIDE.low ? 'high' : 'falling';
}
/* when today's low waters start, as clock times */
function wTideTimes() {
  const day0 = WG.dayAbs * 24, P = W_TIDE.period, out = [];
  let s = wTideNow() - wTidePhase();
  while (s >= day0) s -= P;
  for (s += P; s < day0 + 24; s += P) if (s >= day0) out.push(s);
  return out.map(x => { const m = Math.round((x - day0) * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
}
function wTideLine() {
  const T = wTideTimes(), now = wTide();
  return `Low water today about ${T.join(' and ')}, two hours each, a little later every day. It is ${now} now. The Marigold's hold is only dry at low water.`;
}
const wW67Say = wSay;
wSay = function (id, kw) {
  const k = (kw || '').trim().toLowerCase();
  if (id === 'marrowbone' && WG && wKwHit('tide', k)) { // the line changes with the clock, so it is written when asked
    const r = { text: wTideLine(), key: 'tide' };
    try { wJHeard(id, k, r); } catch (e) { console.error(e); }
    return r;
  }
  const r = wW67Say(id, kw);
  if (id === 'clerk' && WG && r && r.text != null) {
    const A = wAdvState('charter');
    // the charter's fallback line follows the story; the frame hint only until the story starts
    const T = DB.chars.clerk.topics;
    if (r.key === 'charter' && A && r.text === T.charter.t) r.text = A.st === 'won' ? 'Framed, whole, and back in the rulebook. Ask about the FOUNDERS whenever you like.'
      : A.st === 'lost' ? 'In the drawer. The League calls it a curiosity. Let us not talk about it.' : 'You know as much as I do now. Your journal has the rest.';
    if (r.key === 'bracket' && wFlag('q_bracket') && !A && (r.text === T.bracket.t || r.text === T.bracket.t2)) r.text += ' Odd: the frame was backed with a torn page of something. The old CHARTER, I think.';
  }
  return r;
};

/* ---------- old rules in the card game ---------- */
/* what the old rules allow: everything but gear, set plays and Hall of Fame cards (as the match card says) */
function wAdvOldOk(c) {
  const d = CARDS[c.id]; if (!d) return false;
  return d.rar !== 'l' && d.type !== 'gear' && d.type !== 'play';
}
const wW67BuildEncounter = wBuildEncounter;
wBuildEncounter = function (o) {
  const enc = wW67BuildEncounter(o);
  if (enc && o && o.world && o.world.rules) enc.world.rules = o.world.rules;
  return enc;
};
const wSdStartCombat = startCombat;
startCombat = function () {
  const W = WG && RUN && RUN.pending && RUN.pending.world;
  if (!W || W.rules !== 'old') return wSdStartCombat.apply(this, arguments);
  const deck = RUN.deck, keep = deck.filter(wAdvOldOk);
  RUN.deck = keep.length ? keep : deck; // (a deck of nothing but gear, plays and Hall of Fame cards can't be played at all)
  if (!RUN.oldRelics) { RUN.oldRelics = RUN.relics; RUN.relics = []; }
  try { return wSdStartCombat.apply(this, arguments); } finally { RUN.deck = deck; }
};
function wAdvRelicsBack() { if (RUN && RUN.oldRelics) { RUN.relics = RUN.oldRelics; delete RUN.oldRelics; } }
const wW67FinishFight = finishFight;
// after the match's own end (its fightWon trophies and reward gold included), so no trophy pays out for an old-rules game
finishFight = function () { try { return wW67FinishFight.apply(this, arguments); } finally { wAdvRelicsBack(); } };

/* ---------- the Frozen Chapel bell sets its flag (it only ever logged) ---------- */
const wW67EncounterHook = wEncounterHook;
wEncounterHook = function (region, tileCh, info) {
  // (only once Halvard has sent you, rq_aur1: the side quest's own order)
  if (info && info.kind === 'bell' && info.ring && info.ring.set && WG && wFlag('rq_aur1') && !wFlag(info.ring.set)) {
    wSetFlag(info.ring.set);
    const sp = DB.sideplots.find(x => x.id === info.ring.set); if (sp) wLog('Done: ' + sp.title + '.', 'g');
  }
  return wW67EncounterHook(region, tileCh, info);
};

/* ---------- the reward: a trophy and a card no pool offers ---------- */
RELICS.founders = { n: "Founder's Charm", adv: 1, desc: 'Start each fight with 1 Strength and 1 Footwork.', ico: 'boot' };
TROPHY_FX.founders = { on: { fightStart: () => { addSt(B.P, 'str', 1); addSt(B.P, 'dex', 1); } } };
Object.assign(RELICS.founders, TROPHY_FX.founders); // (core/hooks.js copied TROPHY_FX into RELICS at its load, before this part)
const wSdRelicPool = relicPool;
relicPool = function (rar) { return wSdRelicPool(rar).filter(k => !RELICS[k].adv); };
K('adv_founding', 'The Founding Rule', 'none', 'skl', 1, 'l', 'self', [['b', 9], ['s', 'str', 1, 'self'], ['s', 'dex', 1, 'self']], { fl: 'Written in 1 AL, torn in the fire, read aloud again by you.' });

/* ---------- the story ---------- */
Object.assign(W_ADV_ITEMS, {
  ch_vesper: { n: 'Charter piece (Graftonbury)', d: 'The opening of the League charter, kept in Gant Vesper\'s scarf drawer for forty years.' },
  ch_moss: { n: 'Charter piece (Mosswold)', d: 'Pressed flat under the Hollow Shrine\'s altar stone. Smells of moss.' },
  ch_tide: { n: 'Charter piece (Brinefen)', d: 'Salt-stiff, from the Marigold\'s hold. The ink held.' },
  ch_ember: { n: 'Charter piece (Cindermaw)', d: 'Scorched at one corner. A pit fighter brought it up out of the Deep Seam.' },
  ch_rime: { n: 'Charter piece (Frostspire)', d: 'Rang down out of the old chapel bell, cold as the bell.' },
});
W_ADV.push({
  id: 'charter', title: 'The Lost Charter', regions: ['plains', 'bloom', 'tide', 'ember', 'rime'],
  teaser: 'The League\'s founding charter, torn in five when the old hall burned.',
  rumours: ['Imelda Foss has been squinting at the back of that old frame in the League office. Something about a CHARTER.',
    'They say the League CHARTER burned with the old hall. Imelda Foss in Graftonbury does not think so.'],
  starter: { who: 'clerk', kw: 'charter', need: ['q_bracket'], learn: 'The First Bracket was framed with a page of the League charter. The rest was torn up the night the old hall burned. Foss thinks Gant Vesper knows more.',
    t: 'Look at this. The First Bracket was framed with a page of the old CHARTER, torn along the top. The charter itself was lost the night the hall burned, in five pieces, they say. Vesper was there that night. Ask him.' },
  lostText: 'Herald Pim\'s side won the exhibition, and the League called the founding rule a curiosity. The charter went back in a drawer, and nobody has asked about it since.',
  chapters: [
    { t: 'The torn page', sum: 'Gant Vesper has one piece of the charter. Talk to him in Graftonbury.', pay: { gold: 40 }, steps: [
      { k: 'talk', who: 'vesper', kw: 'charter', t: 'Fine. I took a piece the night the hall burned. Somebody had to save something. You want it, you beat me at my old game: basketball, at the Charter Court, east of the square. Tell the keeper you are there for the VESPER game.', learn: 'Vesper will give up his piece for a win over him at basketball, at the Charter Court. Ask the keeper for the VESPER game.' },
      { k: 'match', who: 'gk_court', kw: 'vesper', engine: 'card', sport: 'basketball', tier: 1, name: 'Gant Vesper', t: 'Vesper is already stretching. He says he will go easy on you. He will not.',
        give: { ch_vesper: 1 }, win: 'Vesper hands over a folded page from his scarf. "The other four went out with the crews that night, one to every region. Foss will know where to look."', lose: 'Vesper sinks the last shot and grins. "Come back when you have practised."' }] },
    { t: 'Four pieces', sum: 'One piece in each region: the Hollow Shrine in the Mosswold, the Marigold wreck in the Brinefen, the Anvil Ring in Cindermaw, and the Frozen Chapel in the Frostspire. Ask about the CHARTER there.', pay: { gold: 60, fans: 15 }, any: true, steps: [
      { k: 'talk', who: 'clerk', kw: 'pieces', set: ['clue_shrine', 'clue_marigold', 'clue_chapel'], t: 'Four crews, four regions. Hermit Oak at the Hollow Shrine in the Mosswold. Captain Marrowbone in Saltmere, for the Brinefen. Ma Gristle at the Anvil Ring, for Cindermaw. Brother Halvard in Rimewatch. I have marked the old places on your map.', learn: 'Foss marked the Hollow Shrine, the Marigold wreck and the Frozen Chapel on the map.' },
      { k: 'talk', who: 'hermit', kw: 'charter', after: 0, t: 'The founders played here once, before trophies and gear and all your clever plays. I keep their page under the altar. Play me under their old RULES and it is yours.', learn: 'Hermit Oak wants a game under the old RULES: no gear, no set plays, no Hall of Fame cards, no trophies.' },
      { k: 'match', who: 'hermit', kw: 'rules', after: 1, engine: 'card', tier: 2, rules: 'old', name: 'Hermit Oak', t: 'The hermit clears the moss off a flat stone. "No gear. No tricks. Just the game."',
        give: { ch_moss: 1 }, win: 'The hermit lifts the altar stone and hands you a pressed, green-edged page.', lose: '"Again, when you have remembered how the game goes without the trimmings."' },
      { k: 'talk', who: 'marrowbone', kw: 'charter', after: 0, t: 'A page in the Marigold? Could be. Her hold floods at every tide. You would want low water, and after dark, when the eels sleep. Ask me about the TIDE.', learn: 'The Brinefen piece is in the Marigold\'s hold, which is only dry at low tide. Go after dark. Marrowbone knows the TIDE.' },
      { k: 'visit', loc: 'marigold', after: 3, need: { night: true, tide: 'low' }, tNo: 'The Marigold\'s hold is under water, or the eels are awake. Come back at low tide, after dark (ask Marrowbone about the TIDE).',
        t: 'The tide is out and the hold is dry. In a sealed tin behind the galley stove: a salt-stiff page.', give: { ch_tide: 1 } },
      { k: 'talk', who: 'gk_ring', kw: 'charter', after: 0, t: 'That scrap? A pit fighter brought it up out of the Deep Seam and won\'t sell it. He will box for it, though. Ask me for the BOUT.', learn: 'A pit fighter at the Anvil Ring will box for the Cindermaw piece. Ask Ma Gristle for the BOUT.' },
      { k: 'match', who: 'gk_ring', kw: 'bout', after: 5, engine: 'ring', tier: 2, club: 'local', t: 'Three bouts. Win the card and the fighter hands it over.',
        give: { ch_ember: 1 }, win: 'The pit fighter spits, laughs, and hands you a scorched page.', lose: 'The pit fighter pockets the page again. "Next time."' },
      { k: 'talk', who: 'halvard', kw: 'charter', after: 0, t: 'There is a page wedged in the first bell, in the old chapel. I have heard it rattle for years. I will climb up and ring it loose if you win a game here, in the SNOW. The bell rings truest in a blizzard.', learn: 'Brother Halvard will ring the Frostspire piece out of the chapel bell if you win a game in Rimewatch in a blizzard. Ask him about the SNOW.' },
      { k: 'match', who: 'halvard', kw: 'snow', after: 7, engine: 'card', tier: 2, cond: { weather: 'blizzard' }, t: 'Halvard pulls his hood up. "A game first. The bell after."',
        win: 'Halvard nods and sets off for the chapel with a rope over his shoulder. "Meet me there."', lose: 'Halvard shakes the snow off. "Another blizzard will come. They always do."' },
      { k: 'visit', loc: 'frozenchapel', after: 8, t: 'Halvard rings the old bell. Something rattles, then flutters down: a page, cold as the bronze.', give: { ch_rime: 1 } }] },
    { t: 'The founding rule', sum: 'Bring all five pieces to Imelda Foss in Graftonbury.', steps: [
      { k: 'talk', who: 'clerk', kw: 'pieces', take: { ch_vesper: 1, ch_moss: 1, ch_tide: 1, ch_ember: 1, ch_rime: 1 }, tNo: 'All five pieces, please. I have the frame waiting.',
        t: 'All five. ... "A game shall be won by three clear points, and played by the players alone." The founders\' rule, and it is not in the modern rulebook. Herald Pim at the Crown Coliseum could stage an EXHIBITION under it. Win it and the League will have to listen.', learn: 'The charter\'s lost rule: a game is won by three clear points, under the old rules. Herald Pim at the Crown Coliseum will stage an EXHIBITION.' },
      { k: 'match', who: 'herald', kw: 'exhibition', engine: 'card', tier: 3, type: 'elite', rules: 'old', cond: { margin: 3 }, pinnacle: true, name: 'The League Select',
        t: 'Herald Pim has filled the stands. "One exhibition, under the founders\' rule. The League is watching. So is everyone else."',
        win: 'The crowd is on its feet. Pim reads the rule aloud from the Coliseum steps, and Foss frames the charter.', lose: 'The League Select take it. Pim calls the rule "a charming curiosity", and Foss puts the charter back in its drawer.' }] }],
  end: { t: 'the charter is whole and framed in the League office, and the founding rule is back in the rulebook.', pay: { gold: 200, fans: 40 },
    unlock: { at: 'clerk', kw: 'founders', relic: 'founders', cards: ['adv_founding'], t: 'The founders would have wanted you to have these. The League office keeps copies.', t2: 'You have them already.' } },
});
// Foss notices the frame when you bring the First Bracket home
// what she says when the adventure isn't answering (before the First Bracket is home; later lines follow the story, wW67Say)
if (DB.chars.clerk) DB.chars.clerk.topics.charter = { t: 'The League charter burned with the old hall, they say. I have my doubts. The First BRACKET might know more, if anyone ever finds it.' };

/* ---------- How to play: the tide ---------- */
const wW67RenderHelp = renderHelp;
renderHelp = function () {
  wW67RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpTide')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpOldRules"><b>Old rules.</b> Some games are played the way the League's founders played: no gear, no set plays, no Hall of Fame cards, and your trophies sit the game out. Your other cards play as usual, and everything comes back when the game ends. The game card says when a game is under old rules.</p>`);
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpTide"><b>The tide.</b> The Brinefen coast has two low waters a day, two hours each, and they come about 48 minutes later every day. Captain Marrowbone in Saltmere will tell you when (ask about the TIDE).</p>`);
};
