/* w97: your following (issue #79, phase 1). Loads after w96-rinkfeel.js; changes earlier parts only by reassignment
   (saved originals carry the wW97 prefix).

   Fans (RUN.fans) were a number nothing used. They are now your following: the more you hold, the more it is worth.
   Four steps (W_FOLLOW.at):

     A few regulars      25    the gate
     A supporters' club  100   the away end
     A travelling army   300   they sing all game
     A household name    750   doors open

   This part is the steps themselves: the Team screen, the top bar's tooltip, a line in the log each time you reach a
   step (and a note in the journal the first time), and How to play. What each step does comes in the parts after
   (W_FOLLOW.live says which are in). It sits beside your name in the regions (w31), which keeps its own count.

   The step is read from RUN.fans, never stored. WG.follow = { seen, top } only remembers which step was last
   announced (seen: it falls with your fans, so climbing back is announced again) and the highest ever (top: the
   journal's note is written once). Plain data.

   W_FOLLOW, wFans(), wFollowStep(), wFollowName(step), wFollowDoes(step), wFollowCheck(), wFollowHtml()
   Wrapped: wSave (wW97Save: a step reached is announced before the save), wCampTeam (wW97CampTeam: your following,
   above your name in the regions), renderHelp (wW97RenderHelp: #wHelpFollow). */

const W_FOLLOW = {
  at: [25, 100, 300, 750],
  names: ['No following yet', 'A few regulars', 'A supporters\' club', 'A travelling army', 'A household name'],
  said: ['', 'A few regulars have started turning up.', 'A supporters\' club has formed. They have a banner.', 'A travelling army follows you now. They sing all game.', 'You are a household name. Doors open.'],
  does: ['', 'The gate: a cut of the takings at every match at a ground.', 'The away end: your fans travel, and lift you at the start of a match away from home.',
    'They sing all game: the lift comes again when you are behind late, and the gate is bigger.', 'Doors open: lower fees for free agents, no cup entry fees, and bigger bids for your players.'],
  live: [false, false, false, false, false],   // which steps' effects are in the game yet (the parts after this one set them)
  off: false,
};
W_JWIN_KIND.fans = 'Fans';
function wFans() { return (RUN && RUN.fans) || 0; }
function wFollowStep() { if (W_FOLLOW.off) return 0; const n = wFans(); return W_FOLLOW.at.filter(a => n >= a).length; }
function wFollowName(step) { return W_FOLLOW.names[step == null ? wFollowStep() : step]; }
function wFollowDoes(step) { return W_FOLLOW.does[step] ? W_FOLLOW.does[step] + (W_FOLLOW.live[step] ? '' : ' (Coming.)') : ''; }
// a step reached since the last look: a line in the log, and the first time a note in the journal
function wFollowCheck() {
  if (LAB || !WG || !RUN || RUN.over || W_FOLLOW.off) return false;
  const F = WG.follow = WG.follow || { seen: 0, top: 0 }, s = wFollowStep();
  if (s <= F.seen) { F.seen = s; return false; }
  for (let k = F.seen + 1; k <= s; k++) {
    wLog(`${W_FOLLOW.said[k]} ${wFans()} fans. ${wFollowDoes(k)}`.trim(), 'g');
    if (k > F.top) { F.top = k; try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'fans', t: W_FOLLOW.names[k] + `: ${W_FOLLOW.at[k - 1]} fans` }); } catch (e) { console.error(e); } }
  }
  F.seen = s;
  return true;
}
const wW97Save = wSave;
wSave = function () { wFollowCheck(); return wW97Save.apply(this, arguments); };

/* ---------- the Team screen ---------- */
function wFollowHtml() {
  const n = wFans(), s = wFollowStep(), next = W_FOLLOW.at[s];
  const rows = W_FOLLOW.at.map((a, i) => `<li class="${i < s ? 'wfhave' : ''}"><b>${esc(W_FOLLOW.names[i + 1])}</b> <span class="wtag wrep-${i < s ? Math.min(3, i + 1) : 0}">${a} fans</span> <small>${esc(wFollowDoes(i + 1))}</small></li>`).join('');
  return `<h4>Your following</h4><p class="hint" id="wFollowNow"><b>${esc(W_FOLLOW.names[s])}</b>: ${n} fan${n === 1 ? '' : 's'}${next != null ? `, ${next - n} more for ${esc(W_FOLLOW.names[s + 1].toLowerCase())}` : ''}. Fans come from wins in the sports, cups, fixtures and adventures; a blackout loses a quarter of them.</p><ul class="wfollow">${rows}</ul>`;
}
const wW97CampTeam = wCampTeam;
wCampTeam = function () {
  const h = wW97CampTeam(); if (W_FOLLOW.off) return h;
  const at = h.indexOf('<h4>Your name</h4>');
  return at < 0 ? h + wFollowHtml() : h.slice(0, at) + wFollowHtml() + h.slice(at);
};

/* ---------- How to play ---------- */
const wW97RenderHelp = renderHelp;
renderHelp = function () {
  wW97RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpFollow')) return;
  const F = W_FOLLOW;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpFollow"><b>Your following.</b> Fans are the people who follow your team, everywhere. You win them with the sports, cups, fixtures and adventures, and a blackout loses a quarter of them. The more you hold, the more they are worth: at ${F.at[0]} ${F.names[1].toLowerCase()}, at ${F.at[1]} ${F.names[2].toLowerCase()}, at ${F.at[2]} ${F.names[3].toLowerCase()} and at ${F.at[3]} ${F.names[4].toLowerCase()}. The Team screen shows where you stand and what each step gives. Your name in a region is counted separately.</p>`);
};
