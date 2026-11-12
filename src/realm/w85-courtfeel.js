/* w85: the feel of basketball (issue #77, phase 11), as w47 is for football and w55 for boxing. Sound on the court,
   coach's notes and medals.

   Sound. Sudden Death's own effects (sfx), following your Sound effects setting, from the court's events (wBK.onEv)
   and beats (wBK.onPhase): the rim for a miss, a thud for a block, a quick slap for a steal, the crowd for your
   baskets (louder for a three, loudest for a dunk or an alley-oop), a click for theirs, a chime for a power and a
   bigger one for an ultimate (either side's), the whistle for a foul's free throws, a timeout and goaltending, the buzzer at each
   break, the yard's roar and a hot hand (either side's: the yard cheers a show), and a horn and the crowd when you
   win. In a game you only watch, the first side (the home one) is yours for the crowd. Only while the court is on screen. The realm's music
   plays on, as it does at any ground.
   Tips. TIPS.w_court once your team can play basketball (W_BKG.minOwn players), TIPS.w_net once you have won a
   basketball game, from a watcher like w47's.
   Achievements. Basketball games won (realmCourtWins) and Charter Nets (realmNets), on SD's ACH.

   Wraps: wBK.onEv (wW85OnEv: the sounds), wBK.onPhase (wW85OnPhase: the whistle and the buzzer), wBK.onOver
   (wW85OnOver: the end), wCourtSettle (wW85CourtSettle), wNetWon (wW85NetWon), renderHelp (wW85RenderHelp:
   #wHelpCourtFeel after #wHelpCourtNet). */

const WCSND = { shot: '' };
const wCourtSoundOn = () => !LAB && SET.sfx !== false && UI.view === 'court' && !!wBK.G;
// whose play it was: the side with the ball (a basket, a miss), or the side defending (a steal, a block)
const wCourtSndMine = off => { const G = wBK.G, c = G && G.cur; return !!c && (c.side === wBK.you) === !!off; };
function wCourtEvSound(e) {
  if (!wCourtSoundOn()) return;
  if (e.k === 'shot') { WCSND.shot = e.o; return; }
  if (e.k === 'made') {
    const big = WCSND.shot === 'dunk' || WCSND.shot === 'alley';
    if (!wCourtSndMine(true)) { sfx.card(); return; }
    if (big) sfx.crunch(); else sfx.coin();
    sfx.crowd(big ? 1.6 : e.o === 3 ? 1.2 : .7);
  }
  else if (e.k === 'miss') sfx.block();
  else if (e.k === 'block') { sfx.hit(.4); if (wCourtSndMine(false)) sfx.crowd(1.1); }
  else if (e.k === 'steal') { sfx.card(); if (wCourtSndMine(false)) sfx.crowd(.7); }
  else if (e.k === 'pow' || e.k === 'sit' || e.k === 'potion') sfx.magic();
  else if (e.k === 'ult') sfx.crit();
  else if (e.k === 'fire') { sfx.crit(); sfx.crowd(1.4); }
  else if (e.k === 'roar') sfx.crowd(2);
  else if (e.k === 'bent') sfx.crunch();
  else if (e.k === 'timeout' || e.k === 'goaltend') sfx.whistle();
}
function wCourtPhSound(ph) {
  if (!wCourtSoundOn()) return;
  if (ph === 'ft') sfx.whistle();
  else if (ph === 'break') sfx.horn();
}
function wCourtEndSound(s) {
  if (!wCourtSoundOn() || !s) return;
  // (a game you only watch, a scrimmage, ends with the buzzer and the crowd)
  if (wBK.mode === 'watch' && !(WBK && WBK.world)) { sfx.horn(); sfx.crowd(1.4); return; }
  const you = wBK.you;
  if (s.score[you] > s.score[1 - you]) { sfx.horn(); sfx.crowd(2); } else if (s.score[you] < s.score[1 - you]) sfx.bad(); else sfx.whistle();
}
const wW85OnEv = wBK.onEv;
wBK.onEv = e => { if (wW85OnEv) wW85OnEv(e); try { wCourtEvSound(e); } catch (er) { console.error(er); } };
const wW85OnPhase = wBK.onPhase;
wBK.onPhase = ph => { if (wW85OnPhase) wW85OnPhase(ph); try { wCourtPhSound(ph); } catch (er) { console.error(er); } };
const wW85OnOver = wBK.onOver;
wBK.onOver = s => { if (wW85OnOver) wW85OnOver(s); try { wCourtEndSound(s); } catch (er) { console.error(er); } };

Object.assign(TIPS, {
  w_court: ['Basketball', 'Your team is big enough for basketball. Open the Team screen (C), then the Court tab: set your five, then Play a game against the local side or a rival club. Nim Hoopwright at the Charter Court books games too: ask for HOOPS.'],
  w_net: ['The Charter Net', 'Basketball has its own cup, every week. Ask Nim Hoopwright at the Charter Court about the NET, or use the Charter Net button on the Court tab. Win it and your five cut the net down.'],
});
function wCourtTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (wRoster().length >= W_BKG.minOwn) tip('w_court');
  if (WG.bkg && WG.bkg.w > 0) tip('w_net');
}
setInterval(wCourtTips, 700);

ACH.push(
  { id: 'w_court', n: 'Court Vision', d: 'Win basketball games at the Charter Court', stat: 'realmCourtWins', at: [1, 10, 30] },
  { id: 'w_net', n: 'Net Cutters', d: 'Win the Charter Net', stat: 'realmNets', at: [1, 3, 8] },
);
const wW85CourtSettle = wCourtSettle;
wCourtSettle = function (r, us, them, box, ot) {
  const m = wW85CourtSettle.apply(this, arguments);
  if (!LAB && r === 'win') achAdd('realmCourtWins', 1);
  return m;
};
const wW85NetWon = wNetWon;
wNetWon = function () { wW85NetWon(); if (!LAB) achAdd('realmNets', 1); };

const wW85RenderHelp = renderHelp;
renderHelp = function () {
  wW85RenderHelp();
  const d = $('wHelpCourtNet'); if (!d || $('wHelpCourtFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourtFeel"><b>On the court</b> you hear the rim, the blocks and steals, the crowd for your baskets (loudest for a dunk), the whistle for free throws and timeouts, the buzzer at each break and the walled yard's roar; sounds follow your Sound effects setting, and the realm's music plays on. Basketball games won and Charter Nets have medals in the record book.</p>`);
};
