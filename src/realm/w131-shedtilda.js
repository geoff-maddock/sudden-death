/* w131: Tilda Spindle at the Curling Shed (issue #102, phase 5's fan). Tilda is the Shed's fan, a spider: "Eight legs,
   eight brooms. Nobody sweeps like me, and nobody lets me play." She keeps the pebble for Hennock, sweeping the empty
   sheet between games, and she reads it better than anyone: ask her about the ICE and she says what the day's cold has
   done to it (wShedColdNow, the same all day), and how the frost lies along the boards.
   Ask her to PLAY: until your four has won a curling match from the world she doesn't believe you have a rink. Once
   you have, she joins your team, once a journey: a spider at the team's level (wStarLvl), the best sweeper there is
   (her curling sweep at the cap). A full roster asks who goes, as any recruit does. After that she greets you as one
   of your own.
   WG.flags: tilda_joined (she has joined: once a journey)
   wTildaReady()   your four has won a curling match from the world
   wTildaJoin()    she joins ('' or why not); the PLAY topic's act ('tildaplay')
   Wraps: wSay (wW131Say: her greeting and the ICE topic, which change), wRunAct (wW131RunAct: 'tildaplay'), wAddPlayer
   (wW131AddPlayer: her sweeping), renderHelp (wW131RenderHelp: a line in #wHelpShedGame). */

const W_TILDA = { n: 'Tilda Spindle', kind: 'spider', flav: 'Eight legs, eight brooms. Hennock\'s pebble-keeper, at last on a rink of her own.' };
const wTildaReady = () => !!(WG && WG.shg && WG.shg.w > 0);
(() => {
  const T = DB.chars.gf_shed; if (!T) return;
  T.topics.sweep = { t: 'Hennock lets me sweep the sheet when it is empty, to keep the pebble. Eight brooms at once: it comes up like glass. Then a game starts and I go back to the gallery. Every time.' };
  T.topics.ice = { t: 'Let me look at it.' };
  T.topics.play = { t: 'You want me to PLAY? For your rink?', act: 'tildaplay' };
  T.topics.job = { t: 'I keep the ice for Brush Hennock. Ask me about the ICE before you curl, or ask me to SWEEP. Or ask me to PLAY. Go on. Nobody ever does.' };
})();
function wTildaJoin() {
  if (!WG) return '';
  if (wFlag('tilda_joined')) return 'I am on your team already. Put me on the brooms.';
  if (!wTildaReady()) return 'A rink? Win a curling match here first, a real one against a club, and I will believe you have one.';
  // (the flag is set when she really joins, in wAddPlayer: a full roster you won't make room on leaves her asking)
  wRecruitTopic({ kind: W_TILDA.kind, n: W_TILDA.n, lvl: wStarLvl(), flav: W_TILDA.flav });
  return 'You mean it? Hold this. No, all of these. I will be at the Shed before you are.';
}
const wW131RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'tildaplay') { const say = wTildaJoin(); if (say) wLog(`${W_TILDA.n}: "${say}"`, 'g'); return; } return wW131RunAct.apply(this, arguments); };
// her greeting once she is yours, and the day's ice
const wW131Say = wSay;
wSay = function (id, kw) {
  const r = wW131Say(id, kw);
  if (id !== 'gf_shed' || !WG || !r) return r;
  if (!(kw || '').trim() && wFlag('tilda_joined')) return Object.assign({}, r, { text: 'Back at the Shed? I come in early to keep the pebble. Old habits. Then I get to sweep it for real.' });
  if (r.key === 'ice') {
    const cold = wShedColdNow(), said = cold === 'heavy' ? 'Heavy today: a warm wind off the sea, and frost on the pebble. Throw it firm, and your sweepers will earn their supper.'
      : cold === 'keen' ? 'Keen today: a hard frost last night, and it runs like a hare. Throw it soft, and let it come to you.' : 'As Hennock likes it today: honest ice. Throw it as you mean it.';
    return Object.assign({}, r, { text: `${said} And mind the boards late on: the frost creeps in from the windows, and a stone near them drags.` });
  }
  return r;
};
// her sweeping: the best there is, whatever her roll
const wW131AddPlayer = wAddPlayer;
wAddPlayer = function (p) {
  const q = wW131AddPlayer(p);
  if (q && q.n === W_TILDA.n && q.kind === W_TILDA.kind && !wFlag('tilda_joined')) { wSetFlag('tilda_joined'); const b = wCrOf(q); if (b) b.swp = Math.max(b.swp, wCrCap()); }
  return q;
};
const wW131RenderHelp = renderHelp;
renderHelp = function () {
  wW131RenderHelp();
  const g = $('wHelpShedGame'); if (!g || g.querySelector('.wtilda')) return;
  g.insertAdjacentHTML('beforeend', ` <span class="wtilda">Tilda Spindle, the Shed's fan, reads the ICE for you before a match; win one there and she will PLAY for you.</span>`);
};
