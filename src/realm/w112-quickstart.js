/* w112: Quick start, the simple how-to for each sport you can play by hand: golf, bowling, baseball, football,
   boxing, basketball and hockey. A few numbered steps with a screenshot each (W_QUICK_IMG, w112a, taken from the game by
   test/realm_quick_shots.py), the keys you need and nothing else, then where the full rules are.
   It sits at the top of How to play (#wQuick, before #wHelp), one tab a sport. Each sport's bar gets a Quick start
   button beside its How to play button (baseball's beside Back to the world), which opens the page on that sport's
   tab: the game waits while you read, as it does for How to play (baseball calls Time out).
   W_QUICK is the table: a sport's { id, n: name, where, lede, steps: [{ img, h, t }], keys: [[keys, what]], phone,
   more: the full rules' section id, foot: an ending of its own (else the sports' one) }. A new sport is a row (and its
   shots in the script).

   Wraps: renderHelp (wW112RenderHelp: #wQuick). */

const W_QUICK = [
  { id: 'links', n: 'Golf', where: 'Mossgate Links', more: 'wLinksHow',
    lede: 'Your caddie has already picked the player, the club and where to aim. All you have to do is swing: press Space three times.',
    steps: [
      { img: 'links-aim', h: 'Look at the ring', t: 'The ring is where a good swing lands. To aim somewhere else, click the course, or use the arrow keys (left and right turn it, up and down move it further or shorter).' },
      { img: 'links-power', h: 'Press Space, then press again at the yellow line', t: 'The first press starts the swing and an arrow runs right along the bar. Press again when it reaches the yellow line: that is the power to reach the ring. The red end hits it further, but makes the next press harder.' },
      { img: 'links-mark', h: 'Press a third time in the green block', t: 'The arrow comes back. Press while it is inside the green block and the ball flies straight. Too soon and it curves left; too late and it curves right.' },
      { img: 'links-putt', h: 'On the green, two presses', t: 'Press Space to start, then again at the yellow line. The thin read line shows how the putt will break: aim to one side to allow for the slope.' },
    ],
    tip: 'Every hole has its own hazards and magic. Point at anything on the course with the mouse to see what it does to your ball, good or bad; on a phone, press This hole on the bar.',
    keys: [['Space', 'swing (three presses; two for a putt)'], ['Click, or the arrows', 'aim'], ['1 to 4', 'pick who hits'], ['Q, E', 'change club'], ['P', 'use a power']],
    phone: 'On a phone, touch your ball, drag back away from where you want it to go, and let go. A longer pull hits it further.' },
  { id: 'lanes', n: 'Bowling', where: 'the Saltmere Lanes', more: 'wLanesHow',
    lede: 'Your coach has already set your feet and your arrow for the pocket. All you have to do is throw: press Space three times.',
    steps: [
      { img: 'lanes-aim', h: 'Look at the guide line', t: 'The dashed yellow line is where a good ball goes. Your feet are the yellow marker at the foul line, and the ring is the arrow you roll over, fifteen feet down. To move them, use the left and right arrows for your feet and A and D for the arrow, or click the lane.' },
      { img: 'lanes-speed', h: 'Press Space, then press again at the yellow line', t: 'The first press starts the approach and the marker climbs the bar. Press again at the yellow line: that is your bowler\'s own speed. The red end above it is a power ball: faster, with more revs, but a smaller mark.' },
      { img: 'lanes-mark', h: 'Press a third time in the green block', t: 'The marker comes back down. Press while it is inside the green block and the ball goes where the guide line goes. Too soon and it is pulled left; too late and it is pushed right (for a right-hander).' },
    ],
    tip: 'At a spare, press B for the spare ball, which rolls straight: the coach sets you up for it. After every ball, Moll\'s glass shows what you bowled.',
    keys: [['Space', 'throw (three presses)'], ['Left, right arrows', 'move your feet'], ['A, D', 'move your arrow'], ['B', 'strike ball or spare ball'], ['G', 'back to the coach\'s line'], ['P', 'use a power']],
    phone: 'On a phone, drag up the lane from the bowler and let go. How far you pull is the speed; a pull off straight misses.' },
  { id: 'shed', n: 'Curling', where: 'the Curling Shed', more: 'wShedHow',
    lede: 'Your skip has already called the shot and put the broom down. All you have to do is throw it, then sweep: press Space twice, then hold it.',
    steps: [
      { img: 'shed-aim', h: 'Look at the broom', t: 'The yellow broom in the house is where your skip wants the stone, and the house on the right shows it from above. Your skip says what the shot is and why. Change it if you like (1 to 6 for the shot, the arrows to move the broom, I and O for the handle), or press G for the skip\'s call again.' },
      { img: 'shed-weight', h: 'Press Space twice: start, then stop on the yellow line', t: 'The first press starts the slide and the marker climbs the bar. Press again on the yellow line for the weight the skip called. Early is light (it stops short), late is heavy (it runs long).' },
      { img: 'shed-sweep', h: 'Hold Space to sweep', t: 'While your stone slides, hold Space and your two sweepers sweep it: it runs further and curls less. Listen to your skip: "Hurry hard!" means sweep, "Off!" or "Whoa!" means let it go. Their legs tire over an end.' },
    ],
    tip: 'Before your stone, cast your curler\'s power (P) or the ultimate at the start of an end (U). Press C for the ice chart: every stone\'s path, and where the pebble is worn.',
    keys: [['Space', 'throw (two presses), then hold to sweep'], ['1 to 6', 'the shot'], ['Arrows', 'move the broom'], ['I, O', 'the handle'], ['G', 'the skip\'s call again'], ['P, U, K', 'a power, the ultimate, Steady'], ['C', 'the ice chart']],
    phone: 'On a phone, touch the house to put the broom down, then drag back from the stone and let go: how far you pull is the weight. Hold the button marked Hold to sweep while it slides.' },
  { id: 'ball', n: 'Baseball', where: 'the Ballpark', more: 'wHelpBall',
    lede: 'You bat first. Batting is two things: put the circle over the ball, and swing when it turns gold. Running and fielding happen by themselves.',
    steps: [
      { img: 'ball-bat', h: 'Batting: circle over the ball, swing on gold', t: 'When the pitch is thrown, a ring shows where the ball will cross the plate. Move your circle over it with WASD or the arrows, and press Space when the ring turns gold. Swinging too early or late, or with the ring outside your circle, misses. Leave a pitch outside the box alone: it is a ball.' },
      { img: 'ball-pitch', h: 'Pitching: press Space to throw', t: 'Press Space and your pitcher winds up and throws. To pitch better, pick a pitch (1 to 6), aim the crosshair with WASD (green is a strike, orange a ball), and press Space again when the release bar reaches the gold band.' },
    ],
    keys: [['Space', 'swing, or pitch'], ['WASD or the arrows', 'move the circle, or aim the pitch'], ['1 to 6', 'a batting stance, or a pitch'], ['Esc', 'time out']],
    phone: 'On a phone held upright, the buttons under the field pick a stance or a pitch.' },
  { id: 'grid', n: 'Football', where: 'the Ash Bowl', more: 'wGridHow',
    lede: 'Football goes one play at a time, and the game waits for you. Pick a play, then on a pass, throw it.',
    steps: [
      { img: 'grid-call', h: 'Pick a play', t: 'Before every play, click one of the buttons under the field. With the ball: Run, Short pass, Deep pass or Screen, or kick it away. Without it: Blitz, Deep zone or Man to man, then just watch.' },
      { img: 'grid-pass', h: 'On a pass, hold Space and let go to throw', t: 'Your quarterback waits for you. Hold Space and a marker runs out ahead of the ringed receiver; let go to throw it to them. Q and E pick another receiver. On a run, steer whoever has the ball with WASD, or let them find their own way.' },
      { img: 'grid-kick', h: 'Kicks: two presses', t: 'For a punt or a field goal, press Space once for the power (at the white line is enough), then again while the aim is in the green.' },
    ],
    keys: [['Click a play', 'every down'], ['Space', 'hold and let go to throw; two presses to kick'], ['Q, E', 'pick a receiver'], ['WASD or the arrows', 'steer the ball carrier']],
    phone: 'Football needs a keyboard for passing. On a phone, pick Run plays, or switch to You call and let your players do the rest.' },
  { id: 'ring', n: 'Boxing', where: 'the Anvil Ring', more: 'wRingHow',
    lede: 'Pick a plan before each round, then throw punches. Your boxer moves and defends a little on their own.',
    steps: [
      { img: 'ring-plan', h: 'Pick a plan', t: 'Before each round the bout waits for you to click a plan on the bar (your corner\'s advice is lit). The plan decides how your boxer moves when you are not steering.' },
      { img: 'ring-fight', h: 'Punch, and watch the blue bar', t: 'J is a quick jab, K a big hook, L a body shot that tires them out. Every punch costs stamina (the blue bar): when it runs low, stop and let it fill. Hold Space to guard. When the other boxer draws their arm back, a punch is coming: guard, or Shift to slip it and hit back.' },
    ],
    keys: [['J, K, L', 'jab, hook, body shot'], ['Space (hold)', 'guard'], ['Shift', 'slip a punch'], ['WASD or the arrows', 'move'], ['Q, R', 'special, ultimate']],
    phone: 'On a phone, use the buttons under the ring: Jab, Hook, Body, Guard (hold) and Slip.' },
  { id: 'court', n: 'Basketball', where: 'the Charter Court', more: 'wCourtHow',
    lede: 'You play whoever has the ball, or on defense whoever is nearest it (the yellow arrow). Move, pass, and shoot by holding Space and letting go at the top.',
    steps: [
      { img: 'court-ball', h: 'Move and pass', t: 'WASD or the arrows move your player. J passes to the teammate you are moving towards. Stop pressing keys for two seconds and your player plays on by themselves.' },
      { img: 'court-shot', h: 'Shoot: hold Space, let go at the top', t: 'Hold Space and your player jumps; a bar fills beside them. Let go while it is in the green part, near the top, for a good shot. A closer, more open shot has a bigger green part.' },
      { img: 'court-def', h: 'Defense: steal and block', t: 'Without the ball, J swipes at it for a steal and Space jumps to block a shot. E switches you to another player.' },
    ],
    keys: [['WASD or the arrows', 'move'], ['Space', 'shoot (hold, let go at the top); block on defense'], ['J', 'pass; steal on defense'], ['E', 'switch player on defense']],
    phone: 'On a phone, use the buttons under the court: Shoot and Pass (hold), or Jump and Swipe on defense.' },
  { id: 'rink', n: 'Hockey', where: 'the Pond Rink', more: 'wRinkHow',
    lede: 'You play whoever has the puck, or the skater nearest it (the yellow ring). Skate with WASD and shoot with Space. The goalie plays by themselves.',
    steps: [
      { img: 'rink-puck', h: 'Skate and pass', t: 'WASD or the arrows skate. J passes to the teammate you are skating towards. Leave the keys alone for two seconds and your skater plays on by themselves.' },
      { img: 'rink-shot', h: 'Shoot with Space', t: 'Tap Space for a quick wrist shot, or hold it for a harder slap shot (the bar beside your skater turns orange). Hold up or down as you let go to aim at a corner.' },
      { img: 'rink-faceoff', h: 'Face-offs and defense', t: 'At a face-off, press Space as the ring around the dot closes. Without the puck, Space checks the carrier and J pokes at the puck. E switches to another skater.' },
    ],
    keys: [['WASD or the arrows', 'skate'], ['Space', 'shoot (tap or hold); check on defense; win a face-off'], ['J', 'pass; poke on defense'], ['E', 'switch skater']],
    phone: 'On a phone, use the buttons under the rink: Shoot and Pass, or Check and Poke on defense.' },
];

function wQuickHTML() {
  const img = id => typeof W_QUICK_IMG !== 'undefined' && W_QUICK_IMG[id] ? `<img class="wqimg" src="${W_QUICK_IMG[id]}" alt="">` : '';
  const tabs = W_QUICK.map((s, i) => `<button class="ghost${i ? '' : ' on'}" data-wq="${s.id}">${s.n}</button>`).join(' ');
  const panes = W_QUICK.map((s, i) => `<div class="wqpane" data-wqp="${s.id}"${i ? ' hidden' : ''}>
    <p class="hint"><b>${s.n} at ${s.where}.</b> ${s.lede}</p>
    <ol class="wqsteps">${s.steps.map(st => `<li><b>${st.h}.</b> ${st.t}${img(st.img)}</li>`).join('')}</ol>
    ${s.tip ? `<p class="hint"><b>Tip.</b> ${s.tip}</p>` : ''}
    <table class="wqkeys">${s.keys.map(([k, w]) => `<tr><td><kbd>${k}</kbd></td><td>${w}</td></tr>`).join('')}</table>
    <p class="hint">${s.phone}</p>
    <p class="hint"><small>${s.foot || `That's all you need for a first game. The full rules, and everything optional (powers, stances, calls), are further down: <a href="#" data-wqmore="${s.more}">${s.n}: how it works</a>.`}</small></p></div>`).join('');
  return `<section id="wQuick" class="whelp"><h3>Quick start: playing the sports</h3>
    <p class="hint">Eight sports have games you can play yourself at their grounds; the last tab is for pets. Pick one for the few things you need to know.</p>
    <div class="wqtabs">${tabs}</div>${panes}</section>`;
}
function wQuickShow(id) {
  const q = $('wQuick'); if (!q) return;
  q.querySelectorAll('[data-wq]').forEach(b => b.classList.toggle('on', b.dataset.wq === id));
  q.querySelectorAll('[data-wqp]').forEach(p => { p.hidden = p.dataset.wqp !== id; });
}
// open How to play on a sport's quick start (the game waits, as for How to play; baseball calls Time out)
function wQuickOpen(id) {
  if (id === 'ball' && typeof wBallLive === 'function' && wBallLive() && !wBD.paused) wBD.pause(true);
  showPage('help'); wQuickShow(id);
  const q = $('wQuick'); if (q) q.scrollIntoView({ block: 'start' });
}

const wW112RenderHelp = renderHelp;
renderHelp = function () {
  wW112RenderHelp();
  const h = $('wHelp'); if (!h || $('wQuick')) return;
  h.insertAdjacentHTML('beforebegin', wQuickHTML());
  const q = $('wQuick');
  q.addEventListener('click', e => {
    const t = e.target.closest('[data-wq]'); if (t) { wQuickShow(t.dataset.wq); return; }
    const m = e.target.closest('[data-wqmore]'); if (m) { e.preventDefault(); const d = $(m.dataset.wqmore); if (d) d.scrollIntoView({ block: 'start' }); }
  });
};

// the Quick start buttons: beside each sport's How to play button (baseball's on its bar)
for (const [how, id] of [['wLinksHowBtn', 'links'], ['wLanesHowBtn', 'lanes'], ['wShedHowBtn', 'shed'], ['wGridHowBtn', 'grid'], ['wRingHowBtn', 'ring'], ['wCourtHowBtn', 'court'], ['wRinkHowBtn', 'rink']]) {
  const b = $(how); if (!b) continue;
  b.insertAdjacentHTML('beforebegin', `<button class="ghost" id="wQuick_${id}">Quick start</button> `);
  $('wQuick_' + id).addEventListener('click', () => wQuickOpen(id));
}
{ const back = $('wDiamondBack'); if (back) { back.insertAdjacentHTML('beforebegin', '<button class="ghost" id="wQuick_ball">Quick start</button>'); $('wQuick_ball').addEventListener('click', () => wQuickOpen('ball')); } }

document.head.insertAdjacentHTML('beforeend', `<style>
#wQuick .wqtabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 10px; }
#wQuick .wqtabs .on { outline: 2px solid var(--gold, #e3b341); }
#wQuick .wqsteps { padding-left: 1.4em; }
#wQuick .wqsteps li { margin: 0 0 14px; line-height: 1.45; }
#wQuick .wqimg { display: block; width: 100%; max-width: 720px; height: auto; margin-top: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.15); }
#wQuick .wqkeys { border-collapse: collapse; margin: 6px 0 10px; }
#wQuick .wqkeys td { padding: 3px 12px 3px 0; vertical-align: top; }
</style>`);
