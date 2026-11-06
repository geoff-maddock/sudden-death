/* w69: adventures, phase 4 (issue #47): The Fixed Game, a mystery. Someone is fixing games across the League. Marco
   Fine, the bookie at the Crown, has seen the odds move before games that should be even. Ask him about the ODDS
   (a keyword of its own: no cups needed).

     1  Long odds: Marco has you play the club the fixer is paying (whichever rival club fits this journey: the
        journal only ever calls it "the club they're paying", so a story carried to a new journey stays true). You
        win, and they clearly threw it.
     2  Three clues and a name, in any order:
          a marked ball      the Graftonbury Ballpark keeper kept one; beat her side at baseball for it
          a ledger page      on the Saltmere docks, after dark: payments, signed O.V.
          the referee        Referee Dunmore in Rimewatch called games as he was paid to. He'll tell the League,
                             once you win a game with his CROOKED calls against you (every opposing player starts
                             with 8 Block, and you start Weak)
          Orla Vantage       a club backer in Graftonbury, who signs her letters O.V. (after the ledger)
     3  The accusation: Imelda Foss puts it before the League; name the fixer. A pinnacle: name the wrong one and the
        trail goes cold for good.
     4  The grudge final: the club they're paying, at full strength, in their best game (W_FXG.best: each club's,
        by its character; in the card game it's the club's own side, as a league grudge match is). Lose and play it
        again, the same day if you like.
   Reward: 80 fans and 150 gold on the journey you finish it; Rook Halloran, the fixer's best player, joins at the
   team's level and waits with Herald Pim at the Crown on any later journey (ask about ROOK); and a League honour on
   the Team screen, for good.

   The fixer (Orla Vantage) and the referee stand in Graftonbury and Rimewatch beside the training coaches (w23).
   Wraps: wRenderCamp (wW69RenderCamp: the League honour on the Team screen), renderHelp (wW69RenderHelp:
   #wHelpCrooked). Crooked calls are a fightStart hook (onHook). */

/* ---------- the club they're paying, and what they play best ---------- */
/* each club's best game, by its character (the Marauders and Brutes box, the Tusks and Feasters play football, the
   Rollers and Glaciers play baseball, the Hexers and Banshees out-think you at cards) */
const W_FXG = { best: { ironmaw: 'ring', bramblegate: 'ring', cragspire: 'grid', duskhollow: 'grid', rattlebone: 'ball', frostfang: 'ball', mirewood: 'card', gallowmere: 'card', apex: 'card' },
  crooked: { block: 8, weak: 1 }, honour: 'Cleaned up the League: exposed the fixer of the Fixed Game.' };
function wFixClub() { return wLeagueClubs()[0]; } // this journey's first rival (apex when there are none)
function wFixEngine() { return W_FXG.best[wFixClub()] || 'card'; }
Object.assign(W_ADV_TOKENS, {
  fixclub: () => wClubName(wFixClub()),
  fixclubid: () => wFixClub(),
  fixengine: () => wFixEngine(),
  fixgame: () => W_ADV_CFG.engines[wFixEngine()],
});

/* ---------- crooked calls ---------- */
W_ADV_RULES.crooked = `Crooked calls: every opposing player starts with ${W_FXG.crooked.block} Block, and you start Weak.`;
onHook('fightStart', () => {
  const W = WG && RUN && RUN.pending && RUN.pending.world;
  if (!W || W.rules !== 'crooked' || !B) return;
  for (const e of alive()) e.block = (e.block || 0) + W_FXG.crooked.block;
  addSt(B.P, 'weak', W_FXG.crooked.weak);
});

/* ---------- the fixer and the referee ---------- */
const W_FIX_PEOPLE = [
  { id: 'adv_orla', city: 'graftonbury', at: [43, 12], name: 'Orla Vantage', kind: 'vampire', look: { coat: '#2a1a2e', acc: 'scarf', hair: '#1a1210' },
    greet: 'Do I know you? I know everyone worth knowing.', job: 'I back clubs. Money in, results out. It is a very simple business, really.' },
  { id: 'adv_ref', city: 'rimewatch', at: [27, 23], name: 'Referee Dunmore', kind: 'dwarf', look: { coat: '#1a1a1a', acc: 'cap', hair: '#8a857e' },
    greet: 'I have retired. I am watching the hockey. Go away.', job: 'Thirty years with a whistle. I called every game fair. Nearly every game.' },
];
for (const P of W_FIX_PEOPLE) {
  W_CITIES[P.city].npcs.push([P.id, P.at[0], P.at[1], 1]);
  DB.chars[P.id] = { name: P.name, kind: P.kind, look: P.look, greet: P.greet, topics: { job: { t: P.job } } };
}
DB.chars.adv_ref.topics.calls = { t: 'Every call I made was the right one. Mostly. Leave it.' };
DB.chars.adv_orla.topics.league = { t: 'The League? A wonderful institution. I give it so much money.' };
DB.chars.bookie.topics.odds = { t: 'The odds are the odds. Sometimes they move before a game for no reason at all. Funny, that.' };

/* ---------- the story ---------- */
Object.assign(W_ADV_ITEMS, {
  fx_ball: { n: 'A marked ball', d: 'Scuffed on one side so it dips late. The Graftonbury Ballpark keeper kept it.' },
  fx_ledger: { n: 'A ledger page', d: 'Payments to a club, a week before each of their losses. Signed O.V.' },
});
W_ADV.push({
  id: 'fixed', title: 'The Fixed Game', regions: ['plains', 'tide', 'rime'],
  teaser: 'Someone is fixing games across the League.',
  rumours: ['Marco Fine at the Crown has been muttering about the ODDS. Says they move before games that ought to be even.',
    'They say a referee in Rimewatch retired very suddenly, with a very new house. Marco Fine at the Crown knows about the ODDS.'],
  starter: { who: 'bookie', kw: 'odds', learn: 'Marco Fine thinks someone is fixing games. The club they\'re paying loses games it should win, and the odds move first.',
    t: 'Somebody is fixing games. The odds move a day early, every time, and it is always the same club losing: @fixclub. You are due to meet them. Play them for me, and WATCH how they lose.' },
  lostText: 'The League cleared the one you named, and the real fixer left on the next coach. The odds still move before some games. Nobody asks why any more.',
  chapters: [
    { t: 'Long odds', sum: 'Marco Fine at the Crown wants you to play the club they\'re paying, and watch how they lose.', pay: { gold: 40 }, steps: [
      { k: 'match', who: 'bookie', kw: 'watch', engine: 'card', tier: 2, club: '@fixclubid', t: '"@fixclub. Even money. Go and win it, and watch them."',
        win: 'You win. Too easily: their keeper stepped aside on the last play. Marco writes something in a small black book.', lose: 'They beat you fair and square, for once. Marco sighs. "Again. I need to see them throw it."',
        learn: 'The club they\'re paying threw the game against you. Somebody is paying them to lose.' }] },
    { t: 'Three clues and a name', sum: 'Marco says to look in three places: the Graftonbury Ballpark (a MARKED ball), the Saltmere docks after dark, and a retired referee in Rimewatch (his CALLS).', pay: { gold: 60 }, any: true, steps: [
      { k: 'talk', who: 'gk_ballpark', kw: 'marked', t: 'Marked balls, yes. Scuffed so they dip late. I kept one. Beat my side at baseball, and you can have it: ask for a DIAMOND game.', learn: 'The Graftonbury Ballpark keeper kept a marked ball. Beat the keeper\'s side at baseball for it (a DIAMOND game).' },
      { k: 'match', who: 'gk_ballpark', kw: 'diamond', after: 0, engine: 'ball', tier: 2, club: 'local', give: { fx_ball: 1 }, t: 'Nine innings. The keeper is pitching.',
        win: 'The keeper hands you a scuffed ball. "Stamped by the supplier. Look who pays the supplier."', lose: '"Not today. Come back."' },
      { k: 'visit', loc: 'saltmere', need: { night: true }, give: { fx_ledger: 1 }, tNo: 'The docks are busy by day. Whatever is hidden here, you would want to look after dark.',
        t: 'On the dock after dark, a crate in @fixclub colours. Under it, a torn ledger page: payments, a week before each loss. Signed O.V.', learn: 'A ledger page from the Saltmere docks: payments to the club they\'re paying, signed O.V.' },
      { k: 'talk', who: 'adv_orla', kw: 'league', after: 2, t: 'Orla Vantage. I back winners. ... A ledger? How dreadful. I sign everything O.V., of course, but so do a great many people.', learn: 'Orla Vantage, a club backer in Graftonbury, signs everything O.V.' },
      { k: 'talk', who: 'adv_ref', kw: 'calls', t: 'Fine. I called some games the way I was paid to call them. I will say it to the League, but only to a team that has won with my calls going against it. CROOKED calls. Ask me for that game.', learn: 'Referee Dunmore will testify, if you win a game with his CROOKED calls against you.' },
      { k: 'match', who: 'adv_ref', kw: 'crooked', after: 4, engine: 'card', tier: 2, rules: 'crooked', t: 'Dunmore blows the whistle and points the wrong way, twice, before the first play.',
        win: 'Dunmore puts the whistle away. "You won through all that. All right. The money came through a backer. O.V."', lose: '"Told you. You cannot beat the calls." Ask him again when you are ready.',
        learn: 'Referee Dunmore will tell the League the money came from a backer who signs as O.V.' }] },
    { t: 'The accusation', sum: 'Take the evidence to Imelda Foss at the League office in Graftonbury, and name the fixer. You get one go.', steps: [
      { k: 'talk', who: 'clerk', kw: 'fixing', take: { fx_ball: 1, fx_ledger: 1 }, tNo: 'Bring me evidence: the marked ball and the ledger page. Words are cheap in this office.',
        t: 'A marked ball, a ledger, and a referee who will talk. That is enough to put before the League. I will write it up and send it to Herald Pim at the Crown. Tell me who to name: ACCUSE whoever you think it is. You get one go, and the League does not forgive a wrong name.', learn: 'Imelda Foss will put your accusation before the League. One go.' },
      { k: 'choice', who: 'clerk', kw: 'accuse', after: 0, pinnacle: true, q: 'Who has been fixing games?', right: 1,
        opts: ['Marco Fine, the bookie', 'Orla Vantage, the backer', 'Herald Pim', 'Referee Dunmore'],
        win: 'Orla Vantage goes white. The League bans her from every ground in the realm, and her money with her.', lose: 'The League clears the one you named. By the time anyone thinks of the backer, she has left on the night coach.' }] },
    { t: 'The grudge final', sum: 'The club they were paying want it settled: a grudge final at full strength. Ask Herald Pim for the FINAL.', steps: [
      { k: 'match', who: 'herald', kw: 'final', engine: '@fixengine', club: '@fixclubid', tier: 3,
        t: '@fixclub want it settled, at full strength, at @fixgame. "No more favours," says their captain. "Just the game."',
        win: 'You beat them clean. The crowd has been waiting years to see a game nobody paid for.', lose: '@fixclub take it. Fair and square, this time. Ask Pim again when you are ready.' }] }],
  end: { t: 'the fixer is banned, the League is clean, and the odds are just the odds again.', pay: { gold: 150, fans: 80 },
    unlock: { at: 'herald', kw: 'rook', recruit: { kind: 'werewolf', n: 'Rook Halloran', lvl: 'team', flav: 'The best player Orla Vantage ever paid, and the only one who never took the money. Plays angry.' },
      t: 'Rook Halloran shakes your hand. "I never threw a game in my life. Let me play one for somebody honest."' } },
});

/* ---------- the League honour on the Team screen (kept on the profile) ---------- */
const wW69RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW69RenderCamp();
  if (WCAMP.tab !== 'team') return;
  const A = wAdvState('fixed'), sum = document.querySelector('#wCampBody .wcsum'); if (!A || A.st !== 'won' || !sum || $('wAdvHonour')) return;
  sum.insertAdjacentHTML('afterend', `<p class="hint" id="wAdvHonour"><b>League honour:</b> ${esc(W_FXG.honour)}</p>`);
};

/* ---------- How to play: crooked calls ---------- */
const wW69RenderHelp = renderHelp;
renderHelp = function () {
  wW69RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpCrooked')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpCrooked"><b>Crooked calls.</b> Some games have a referee against you: every opposing player starts with ${W_FXG.crooked.block} Block, and you start Weak. The game card says so.</p>`);
};
