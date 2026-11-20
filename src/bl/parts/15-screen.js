/* The Saltmere Lanes: Moll's magic glass (issue #100, phase 8). After every ball, a classic bowling-alley screen pops up
   over the lane: a glowing glass in a carved frame, scanlines, chunky pixel letters and a little cartoon of what was
   bowled. A strike knocks ten pixel pins flying and stamps STRIKE (DOUBLE, TURKEY with a strutting cockatrice,
   HAMBONE, then FIVE BAGGER and on); a spare slashes across the glass; a split cracks the rack apart with lightning;
   a split made sparkles; a gutter ball is swallowed by a sea serpent; any other ball shows its count, big, and the
   pins still standing.
   Drawing only: nothing here is in the game's state. blScreenFor(ev, s, before) says which cartoon (the tests read it);
   blScreenDraw(c) draws it, timed on BLC.t from the ball's first frame at rest. */
const BL_SCREEN = { x: 320, y: 250, w: 404, h: 208, show: { mark: 2.1, count: 1.0 }, fade: .25,
  pal: ['#ff3b6b', '#ffd34a', '#4af0ff', '#7dff6a', '#c77dff'] };
// a 5 by 7 pixel font: seven rows of five bits, as hex pairs
const BL_GLYPH = {
  A: '0E11111F111111', B: '1E11111E11111E', C: '0E11101010110E', D: '1E11111111111E', E: '1F10101E10101F', F: '1F10101E101010',
  G: '0E11101711110F', H: '1111111F111111', I: '0E04040404040E', K: '11121418141211', L: '1010101010101F', M: '111B1515111111',
  N: '11191513111111', O: '0E11111111110E', P: '1E11111E101010', R: '1E11111E141211', S: '0F10100E01011E', T: '1F040404040404',
  U: '1111111111110E', V: '11111111110A04', W: '1111111515150A', X: '11110A040A1111', Y: '11110A04040404',
  0: '0E11131519110E', 1: '040C040404040E', 2: '0E11010204081F', 3: '1F02040201110E', 4: '02060A121F0202',
  5: '1F101E0101110E', 6: '0608101E11110E', 7: '1F010204080808', 8: '0E11110E11110E', 9: '0E11110F01020C',
  '!': '04040404040004', '/': '01010204081010', '-': '0000001F000000', '+': '0004041F040400', ' ': '00000000000000',
};
const BL_SPRITE = {
  pin: ['.w.', '.r.', 'www', 'www', 'www', 'www', '.w.'],
  pinDown: ['.......', 'wwwwrw.', '.......'],
  ball: ['.nnn.', 'nknnn', 'nnknn', 'nnnnn', '.nnn.'],
  // a cockatrice: a rooster's head and a serpent's tail
  bird: [['....rr......', '...bbbb.....', '..bkbbyy....', '...bbbbf....', 'g..bbbbbb...', 'gg.bwwwbbb..', '.gbbwwwbbb..', '..bbbbbbb...', '....o..o....', '...oo.oo....'],
    ['....rr......', '...bbbb.....', '..bkbbyy....', '...bbbb.f...', 'g..bbbbbb...', 'gg.bwwwbbb..', '.gbbwwwbbb..', '..bbbbbbb...', '...o...o....', '..oo....oo..']],
};
const BL_SPAL = { n: '#4a6ae8', w: '#f6f1e4', r: '#ff3b3b', b: '#c8762a', k: '#14100c', y: '#ffd34a', g: '#4fd06a', o: '#ff9a2a', f: '#ff6a2a' };
// the cartoon for a ball: { k, text, n, left (pins standing), streak }
function blScreenFor(ev, s, before) {
  const R = ev.roll, left = before.filter(p => !R.pins.includes(p)), st = GP && GP.streak ? GP.streak[s] : (R.strike ? 1 : 0);
  if (R.strike) { const n = Math.max(1, st), w = ['', 'STRIKE!', 'DOUBLE!', 'TURKEY!', 'HAMBONE!'][n] || `${['', '', '', '', '', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE'][n] || n} BAGGER!`;
    return { k: n >= 3 ? 'turkey' : 'strike', text: w, n: R.n, left, streak: n }; }
  if (R.spare) return before.length > 1 && blIsSplit(before) ? { k: 'splitmade', text: 'SPLIT MADE!', n: R.n, left, before } : { k: 'spare', text: 'SPARE!', n: R.n, left };
  if (ev.ball && ev.ball.gutter !== null && ev.ball.gutter !== undefined) return { k: 'gutter', text: 'GUTTER BALL', n: R.n, left };
  if (R.split) return { k: 'split', text: 'SPLIT!', n: R.n, left };
  return { k: 'count', text: R.n ? String(R.n) : '-', n: R.n, left, open: !!R.done && before.length < 10 };
}
// pixel text, centred on (cx, cy), P pixels a cell
function blPixText(c, t, cx, cy, P, col) {
  const w = t.length * 6 - 1, x0 = Math.round(cx - w * P / 2), y0 = Math.round(cy - 3.5 * P);
  c.fillStyle = col;
  for (let i = 0; i < t.length; i++) { const g = BL_GLYPH[t[i]] || BL_GLYPH[' '];
    for (let r = 0; r < 7; r++) { const bits = parseInt(g.substr(r * 2, 2), 16); for (let b = 0; b < 5; b++) if (bits & (16 >> b)) c.fillRect(x0 + (i * 6 + b) * P, y0 + r * P, P - (P > 3 ? 1 : 0), P - (P > 3 ? 1 : 0)); } }
}
function blPixMap(c, rows, x, y, P, pal) {
  for (let r = 0; r < rows.length; r++) for (let i = 0; i < rows[r].length; i++) { const ch = rows[r][i]; if (ch === '.') continue; c.fillStyle = (pal && pal[ch]) || BL_SPAL[ch] || ch; c.fillRect(Math.round(x + i * P), Math.round(y + r * P), P, P); }
}
// the rack from above, pixel pins: standing bright, down a dim dot. 7 8 9 10 at the back, the headpin in front
function blPixRack(c, cx, cy, P, standing) {
  const at = { 7: [-3, -3], 8: [-1, -3], 9: [1, -3], 10: [3, -3], 4: [-2, -2], 5: [0, -2], 6: [2, -2], 2: [-1, -1], 3: [1, -1], 1: [0, 0] };
  for (let n = 1; n <= 10; n++) { const [gx, gy] = at[n], x = cx + gx * P * 4.2 - 1.5 * P, y = cy + gy * P * 7.6;
    if (standing.includes(n)) blPixMap(c, BL_SPRITE.pin, x, y, P); else { c.fillStyle = 'rgba(120,160,200,.35)'; c.fillRect(x + P, y + 5 * P, P, P); } }
}
const blEase = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
function blScreenDraw(c) {
  if (!GP || !GP.last || !GP.anim || (GP.ph !== 'rest' && GP.ph !== 'over')) return;
  if (BLC.scrFor !== GP.last) { BLC.scrFor = GP.last; BLC.scr = Object.assign(blScreenFor(GP.last, GP.anim.s, GP.anim.before), { t0: BLC.t }); }
  const S = BLC.scr, K = BL_SCREEN, u = BLC.t - S.t0, D = S.k === 'count' ? K.show.count : K.show.mark;
  const a = u > D ? 1 - (u - D) / K.fade : 1; if (a <= 0) return;
  const pop = u < .16 ? .55 + .45 * blEase(u / .16) : 1, W = K.w, H = K.h, pal = K.pal, cyc = i => pal[(Math.floor(u * 9) + i) % pal.length];
  c.save(); c.globalAlpha = a; c.translate(K.x, K.y); c.scale(pop, pop);
  // the frame: carved dark wood, brass corners, a rune at the top
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-W / 2 - 8, -H / 2 - 4, W + 24, H + 22);
  c.fillStyle = '#3a2416'; c.fillRect(-W / 2 - 14, -H / 2 - 14, W + 28, H + 28);
  c.strokeStyle = '#6a4426'; c.lineWidth = 3; c.strokeRect(-W / 2 - 9, -H / 2 - 9, W + 18, H + 18);
  c.fillStyle = '#c9a24a'; for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc(x * (W / 2 + 7), y * (H / 2 + 7), 5, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#7ff0ff'; c.beginPath(); c.moveTo(0, -H / 2 - 13); c.lineTo(5, -H / 2 - 7); c.lineTo(0, -H / 2 - 1); c.lineTo(-5, -H / 2 - 7); c.closePath(); c.fill();
  // the glass
  c.save(); c.beginPath(); c.rect(-W / 2, -H / 2, W, H); c.clip();
  const g = c.createRadialGradient(0, 0, 20, 0, 0, W * .62); g.addColorStop(0, '#0d1830'); g.addColorStop(1, '#03050c'); c.fillStyle = g; c.fillRect(-W / 2, -H / 2, W, H);
  blScreenToon(c, S, u, cyc);
  // scanlines, a rolling bar, and the glass's sheen
  c.fillStyle = 'rgba(0,0,0,.3)'; for (let y = -H / 2; y < H / 2; y += 3) c.fillRect(-W / 2, y, W, 1);
  const bar = ((u * 70) % (H + 40)) - H / 2 - 20; c.fillStyle = 'rgba(160,220,255,.05)'; c.fillRect(-W / 2, bar, W, 18);
  c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.ellipse(-W * .18, -H * .3, W * .4, H * .16, -.12, 0, Math.PI * 2); c.fill();
  c.restore(); c.restore();
}
// the cartoon itself, in the glass's own coordinates (0, 0 its centre)
function blScreenToon(c, S, u, cyc) {
  const k = S.k, H = BL_SCREEN.h;
  if (k === 'strike' || k === 'turkey') {
    // rays behind, the ball comes in, the pins fly, the word stamps down
    c.save(); c.rotate(u * .6); for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.fillStyle = i % 2 ? 'rgba(255,211,74,.07)' : 'rgba(74,240,255,.06)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-30, -260); c.lineTo(30, -260); c.closePath(); c.fill(); } c.restore();
    const P = 4, hit = .3, bx = u < hit ? -200 + 220 * (u / hit) : 20 + (u - hit) * 300;
    if (bx < 220) blPixMap(c, BL_SPRITE.ball, bx - 10, 52, P);
    for (let i = 0; i < 10; i++) { const row = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3][i], col = [0, -.5, .5, -1, 0, 1, -1.5, -.5, .5, 1.5][i], x0 = 30 + col * 18, y0 = 40 - row * 9;
      if (u < hit) { blPixMap(c, BL_SPRITE.pin, x0, y0, P); continue; }
      const t = u - hit, vx = (col * 1.4 + (i % 3 - 1) * .8 + .6) * 160, vy = -(220 + (i * 37) % 120), x = x0 + vx * t, y = y0 + vy * t + 520 * t * t;
      blPixMap(c, Math.floor(t * 14 + i) % 2 ? BL_SPRITE.pin : BL_SPRITE.pinDown, x, y, P); }
    if (u > .4) { const sc = Math.max(1, 2.4 - (u - .4) * 9), P2 = Math.min(11, Math.floor(368 / (S.text.length * 6)));
      c.save(); c.scale(sc, sc); blPixText(c, S.text, 3 / sc, -42 / sc + 3, P2, 'rgba(0,0,0,.6)'); blPixText(c, S.text, 0, -42 / sc, P2, cyc(0)); c.restore(); }
    if (u > .7) { const n = Math.min(S.streak || 1, 6); for (let i = 0; i < n; i++) if (Math.floor(u * 6 + i) % 4) blPixText(c, 'X', (i - (n - 1) / 2) * 34, 80, 4, cyc(i + 1)); }
    if (k === 'turkey' && u > .55) { const x = -230 + (u - .55) * 260; blPixMap(c, BL_SPRITE.bird[Math.floor(u * 8) % 2], x, 30, 4);
      if (Math.floor(u * 5) % 2) { c.fillStyle = '#ff9a2a'; c.fillRect(x + 34, 39, 10, 4); c.fillStyle = '#ffd34a'; c.fillRect(x + 44, 40, 6, 2); } }
  } else if (k === 'spare') {
    // a slash across the glass, the last pins knocked off it, the word
    const L = blEase(u / .35), P = 6;
    for (let i = 0; i < 26 * L; i++) { const x = -110 + i * 9, y = 80 - i * 7; c.fillStyle = cyc(1); c.fillRect(x, y, P * 2, P * 2); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x, y, P, P); }
    S.left.forEach((n, i) => { const t = Math.max(0, u - .2); blPixMap(c, t ? BL_SPRITE.pinDown : BL_SPRITE.pin, 60 + i * 16 + t * 260, 40 - t * 200 + t * t * 500, 4); });
    if (u > .3) { const sc = Math.max(1, 2 - (u - .3) * 7); c.save(); c.scale(sc, sc); blPixText(c, S.text, 3, -40 / sc + 3, 10, 'rgba(0,0,0,.6)'); blPixText(c, S.text, 0, -40 / sc, 10, cyc(0)); c.restore(); }
  } else if (k === 'splitmade') {
    for (let i = 0; i < 40; i++) { const x = ((i * 97) % 380) - 190, y = ((i * 53) % 190) - 95; if ((Math.floor(u * 10) + i) % 3 === 0) { c.fillStyle = cyc(i); c.fillRect(x, y, 4, 4); c.fillRect(x - 4, y + 1, 12, 2); c.fillRect(x + 1, y - 4, 2, 12); } }
    const sc = Math.max(1, 2.2 - u * 7), P = Math.min(9, Math.floor(368 / (S.text.length * 6)));
    c.save(); c.scale(sc, sc); blPixText(c, S.text, 3, -10 / sc + 3, P, 'rgba(0,0,0,.6)'); blPixText(c, S.text, 0, -10 / sc, P, '#ffd34a'); c.restore();
    if (u > .4) blPixText(c, (S.before || []).join('-'), 0, 60, 4, '#4af0ff');
  } else if (k === 'split') {
    // the leave cracks in two, lightning between
    const L = S.left.slice().sort((x, y) => BL_SPOT[y][0] - BL_SPOT[x][0]), half = Math.ceil(L.length / 2), d = blEase(u / .4) * 60;
    L.forEach((n, i) => { const side = i < half ? -1 : 1, x = BL_SPOT[n][0] * -4 + side * d, y = 30 - (BL_SPOT[n][1] - BL_LANE.len) * .9; blPixMap(c, BL_SPRITE.pin, x - 6, y, 4); });
    if (u > .15 && Math.floor(u * 14) % 3) { c.strokeStyle = '#bfe8ff'; c.lineWidth = 3; c.beginPath(); let y = -H / 2; c.moveTo(0, y); while (y < H / 2) { y += 14; c.lineTo(((y * 7) % 23) - 11, y); } c.stroke(); }
    if (u > .25) blPixText(c, S.text, 0, -60, 10, '#ff9a5a');
    if (u > .5) blPixText(c, L.slice().sort((x, y) => x - y).join('-'), 0, 84, 4, '#efe4cc');
  } else if (k === 'gutter') {
    // the ball rolls into the gutter, and a sea serpent swallows it
    const P = 4, bx = -200 + Math.min(u, .6) / .6 * 210, sink = u > .6 ? (u - .6) * 60 : 0;
    c.fillStyle = '#1d4a52'; c.fillRect(-200, 72, 400, 30); c.fillStyle = 'rgba(120,220,220,.4)'; for (let i = 0; i < 10; i++) c.fillRect(((i * 47 + u * 90) % 420) - 210, 80 + (i % 3) * 6, 14, 2);
    if (u < 1.1) blPixMap(c, BL_SPRITE.ball, bx - 10, 56 + sink, P);
    if (u > .5) { const r = blEase((u - .5) / .4); for (let i = 0; i < 9; i++) { const y = 100 - i * 11 * r, x = 30 + Math.sin(i * .9 + u * 6) * 12; c.fillStyle = i % 2 ? '#3fae5a' : '#2f8a4a'; c.fillRect(x, y, 16, 12); }
      const hx = 30 + Math.sin(8 * .9 + u * 6) * 12 - 6, hy = 100 - 9 * 11 * r - 8, open = Math.floor(u * 6) % 2 ? 6 : 1;
      c.fillStyle = '#4fd06a'; c.fillRect(hx, hy, 28, 12); c.fillRect(hx, hy + 12 + open, 28, 6); c.fillStyle = '#ff3b3b'; c.fillRect(hx + 18, hy + 2, 4, 4); }
    if (u > .25) blPixText(c, S.text, 0, -62, Math.min(7, Math.floor(384 / (S.text.length * 6))), '#4af0ff');
  } else {
    // the count, big, and the pins still standing
    const pop = Math.max(1, 1.8 - u * 6);
    c.save(); c.translate(-88, -4); c.scale(pop, pop); blPixText(c, S.text, 4, 4, 15, 'rgba(0,0,0,.6)'); blPixText(c, S.text, 0, 0, 15, '#ffd34a'); c.restore();
    blPixRack(c, 92, 34, 3, S.left);
    if (S.open && u > .3) blPixText(c, 'OPEN', -88, 78, 4, '#ff9a5a');
  }
}
