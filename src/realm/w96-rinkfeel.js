/* w96: the feel of hockey (issue #83, phase 12), as w85 is for basketball. Sound on the ice, coach's notes and medals.

   Sound. Sudden Death's own effects (sfx), following your Sound effects setting, from the rink's events (wHK.onEv,
   each with the side that had the puck) and beats (wHK.onPhase): the horn and the bank for your goals (a click for
   theirs), a thud for a save or a shot off the pads, a duller one for a block, a crunch for a hit (and the bank for
   yours) and for the ice cracking, a quick slap for a poke or a pass picked off, a chime for a power or a potion and a
   bigger one for an ultimate (either side's), the whistle for a penalty, icing, a covered puck and a timeout, the
   bank's roar, the horn at each break, and the horn and the bank when you win. In a game you only watch, the first
   side (the home one) is yours for the bank. Only while the rink is on screen. The ground's own tune plays on this view (w160), as on the
   ground's map.
   Tips. TIPS.w_rink once your team can play hockey (W_HKG.minOwn players), TIPS.w_kettle once you have won a hockey
   game, from a watcher like w85's.
   Achievements, on SD's ACH: hockey games won (realmRinkWins), Pond Kettles (realmKettles), a hat trick by one of
   your own players in a game from the world (realmHatTricks) and a win without conceding (realmShutouts).

   Wraps: wHK.onEv (wW96OnEv: the sounds), wHK.onPhase (wW96OnPhase: the horn), wHK.onOver (wW96OnOver: the end),
   wRinkSettle (wW96RinkSettle), wKettleWon (wW96KettleWon), renderHelp (wW96RenderHelp: #wHelpRinkFeel after
   #wHelpRinkKettle). */

const wRinkSoundOn = () => !LAB && SET.sfx !== false && UI.view === 'rink' && !!wHK.G;
// was it your side's doing: for a goal or a shot, the side with the puck; for a check or a save, the other one
const wRinkSndMine = (e, has) => (e.side === wHK.you) === !!has;
function wRinkEvSound(e) {
  if (!wRinkSoundOn()) return;
  if (e.k === 'goal') { if (wRinkSndMine(e, true)) { sfx.horn(); sfx.crowd(1.6); } else sfx.card(); }
  else if (e.k === 'save' || e.k === 'rebound') { sfx.block(); if (wRinkSndMine(e, false)) sfx.crowd(.6); }
  else if (e.k === 'block') sfx.hit(.3);
  else if (e.k === 'hit') { sfx.crunch(); if (wRinkSndMine(e, false)) sfx.crowd(1); }
  else if (e.k === 'crack') sfx.crunch();
  else if (e.k === 'poke' || e.k === 'pick') sfx.card();
  else if (e.k === 'power' || e.k === 'sit' || e.k === 'potion') sfx.magic();
  else if (e.k === 'ult') sfx.crit();
  else if (e.k === 'roar' || e.k === 'lift') sfx.crowd(2);
  else if (e.k === 'foul' || e.k === 'icing' || e.k === 'freeze' || e.k === 'timeout') sfx.whistle();
  else if (e.k === 'sogoal') { sfx.coin(); sfx.crowd(1.2); }
  else if (e.k === 'sosave') sfx.block();
}
function wRinkPhSound(ph) {
  if (!wRinkSoundOn()) return;
  if (ph === 'break') sfx.horn();
}
function wRinkEndSound(s) {
  if (!wRinkSoundOn() || !s) return;
  // (a game you only watch, a scrimmage, ends with the horn and the bank)
  if (wHK.mode === 'watch' && !(WHK && WHK.world)) { sfx.horn(); sfx.crowd(1.4); return; }
  const you = wHK.you;
  if (s.score[you] > s.score[1 - you]) { sfx.horn(); sfx.crowd(2); } else sfx.bad();
}
const wW96OnEv = wHK.onEv;
wHK.onEv = e => { if (wW96OnEv) wW96OnEv(e); try { wRinkEvSound(e); } catch (er) { console.error(er); } };
const wW96OnPhase = wHK.onPhase;
wHK.onPhase = ph => { if (wW96OnPhase) wW96OnPhase(ph); try { wRinkPhSound(ph); } catch (er) { console.error(er); } };
const wW96OnOver = wHK.onOver;
wHK.onOver = s => { if (wW96OnOver) wW96OnOver(s); try { wRinkEndSound(s); } catch (er) { console.error(er); } };

Object.assign(TIPS, {
  w_rink: ['Hockey', 'Your team is big enough for hockey. Open the Team screen (C), then the Rink tab: set your six and your goalie, then Play a game against the local side or a rival club. Old Tove at the Pond Rink in Rimewatch books games too: ask for SHINNY.'],
  w_kettle: ['The Pond Kettle', 'Hockey has its own cup, every week. Ask Old Tove at the Pond Rink about the KETTLE, or use the Pond Kettle button on the Rink tab. Win it and your six drink from her kettle.'],
});
function wRinkTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (wRoster().length >= W_HKG.minOwn) tip('w_rink');
  if (WG.hkg && WG.hkg.w > 0) tip('w_kettle');
}
setInterval(wRinkTips, 700);

ACH.push(
  { id: 'w_rink', n: 'Pond Legs', d: 'Win hockey games at the Pond Rink', stat: 'realmRinkWins', at: [1, 10, 30] },
  { id: 'w_kettle', n: 'Kettle Drinkers', d: 'Win the Pond Kettle', stat: 'realmKettles', at: [1, 3, 8] },
  { id: 'w_hattrick', n: 'Hat Trick', d: 'One of your players scores three goals in a hockey game', stat: 'realmHatTricks', at: [1, 3, 10] },
  { id: 'w_shutout', n: 'Shut the Door', d: 'Win a hockey game without letting one in', stat: 'realmShutouts', at: [1, 3, 10] },
);
const wW96RinkSettle = wRinkSettle;
wRinkSettle = function (r, us, them, box, sum) {
  const m = wW96RinkSettle.apply(this, arguments);
  if (LAB) return m;
  if (r === 'win') { achAdd('realmRinkWins', 1); if (them === 0) achAdd('realmShutouts', 1); }
  const g = WG.hkg && WG.hkg.games[0], hat = g && g.line ? Object.values(g.line).filter(x => (x.g || 0) >= 3).length : 0;
  if (hat) achAdd('realmHatTricks', hat);
  return m;
};
const wW96KettleWon = wKettleWon;
wKettleWon = function () { wW96KettleWon(); if (!LAB) achAdd('realmKettles', 1); };

const wW96RenderHelp = renderHelp;
renderHelp = function () {
  wW96RenderHelp();
  const d = $('wHelpRinkKettle'); if (!d || $('wHelpRinkFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRinkFeel"><b>On the ice</b> you hear the horn and the bank for your goals, the pads for a save, the boards for a hit, the whistle for a penalty, icing and a covered puck, the bank's roar and the horn at each break; sounds follow your Sound effects setting, and the ground's own tune plays. Hockey games won, Pond Kettles, a hat trick by one of your players and a win without conceding have medals in the record book.</p>`);
};
