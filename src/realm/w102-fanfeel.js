/* w102: the following's feel (issue #79, phase 7): a coach's note, medals, and the crowd when you reach a step. Loads
   after w101-fame.js; changes earlier parts only by reassignment (saved originals carry the wW102 prefix).

   Coach's notes: w_follow once you have a few regulars (what a following is, and the Team screen), w_stand once you
   have a supporters' club (the Supporters' Stand, and what spending costs).
   Medals: w_follow (a supporters' club, a travelling army, a household name: the highest step a journey reaches) and
   w_favour (favours asked at the Stand).
   A step reached is heard: the crowd, louder the higher the step. Nothing in LAB mode.
   wFollowTips()
   Wrapped: wFollowCheck (wW102FollowCheck: the sound, and the medal), wStandBuy (wW102StandBuy: the medal). */

Object.assign(TIPS, {
  w_follow: ['Your following', 'A few regulars have started turning up. Fans are your following: the more you hold, the more they are worth, from a gate at every match at a ground to a lift when you play away. Open the Team screen (C) to see where you stand and what the next step gives.'],
  w_stand: ['The Supporters\' Stand', 'You have a supporters\' club. Fans can be spent as well as held: at your home ground, or with Imelda Foss at the League office until you have one (ask about SUPPORTERS). A favour takes the fans out of your total, so spending can drop your following a step.'],
});
function wFollowTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world' || W_FOLLOW.off) return;
  if (wFollowStep() >= 1) tip('w_follow');
  if (wFollowStep() >= 2) tip('w_stand');
}
setInterval(wFollowTips, 900);

ACH.push(
  { id: 'w_follow', n: 'Known Everywhere', d: 'Build a following: a supporters\' club, then a travelling army, then a household name', stat: 'realmFollowTop', at: [2, 3, 4] },
  { id: 'w_favour', n: 'Give Them Something Back', d: 'Ask favours at the Supporters\' Stand', stat: 'realmFavours', at: [1, 10, 30] },
);
const wW102FollowCheck = wFollowCheck;
wFollowCheck = function () {
  const top0 = WG && WG.follow ? WG.follow.top : 0, up = wW102FollowCheck();
  if (!up || LAB) return up;
  const s = wFollowStep();
  try { sfx.crowd(1 + s * .35); } catch (e) { console.error(e); }
  // (the medal counts the highest step: only what is new on this journey is added, and only past the best so far)
  const best = (ACHS.stats.realmFollowTop || 0), top = WG.follow.top;
  if (top > top0 && top > best) achAdd('realmFollowTop', top - best);
  return up;
};
const wW102StandBuy = wStandBuy;
wStandBuy = function (id, arg) { const r = wW102StandBuy(id, arg); if (!r && !LAB) achAdd('realmFavours', 1); return r; };
