# Realm quick starts: take the screenshots for each sport's Quick start (How to play, w112) from the game itself, and
# write them into src/realm/w112a-quickshots.js as W_QUICK_IMG (JPEG data URLs). Not a check: run it when a sport's
# look changes, then rebuild. Each shot sets the game up through its API (a setup may wait on the game), freezes it,
# lays labels with arrows over it and takes the picture: the canvas, and any bar above it that the step is about.
#   python3 test/realm_quick_shots.py              every sport
#   python3 test/realm_quick_shots.py links lanes   some sports (the others' shots are kept; shed is curling; pets and
#                                                   petfield are the Pets tab's)
# A label: { t: text, x, y: where the arrow points, in the canvas's own pixels (or el: a page element, the arrow at its
# middle), dx, dy: where the text sits from there (canvas pixels), al: 'l' or 'r' to hang the text off that side }.
import asyncio, base64, os, re, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

OUT = os.path.join(ROOT, 'src/realm/w112a-quickshots.js')
WIDTH = 680          # each shot is scaled to this width
QUALITY = 0.6

HELP_JS = r"""
window.__until = (f, ms) => new Promise((ok, no) => { const t0 = performance.now(); const go = () => { let v = false; try { v = f(); } catch (e) { } if (v) ok(v); else if (performance.now() - t0 > (ms || 15000)) no(new Error('timed out: ' + f)); else setTimeout(go, 30); }; go(); });
window.__closeModals = () => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox .btn, #modalBox button'); if (!b) break; b.click(); } if (typeof WG !== 'undefined' && WG) WG.cardOffer = null; };
// lay the labels over the region (the canvas cv, and the elements in more), and return the region to take
window.__label = (cv, W, more, items) => {
  document.querySelectorAll('.__qlab').forEach(e => e.remove());
  const r = cv.getBoundingClientRect(), k = r.width / W;
  let L = r.left, T = r.top, R = r.right, B = r.bottom;
  for (const el of more) { if (!el || el.offsetParent === null) continue; const q = el.getBoundingClientRect(); L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); }
  const box = document.createElement('div'); box.className = '__qlab';
  Object.assign(box.style, { position: 'fixed', left: L + 'px', top: T + 'px', width: (R - L) + 'px', height: (B - T) + 'px', pointerEvents: 'none', zIndex: 99999 });
  let svg = `<svg width="${R - L}" height="${B - T}" style="position:absolute;left:0;top:0;overflow:visible"><defs><marker id="qa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#ffe14a"/></marker></defs>`, html = '';
  for (const it of items) {
    let x, y;
    if (it.el) { const q = it.el.getBoundingClientRect(); x = q.left + q.width / 2 - L; y = q.top + q.height / 2 - T; }
    else { x = r.left - L + it.x * k; y = r.top - T + it.y * k; }
    const lx = x + (it.dx || 0) * k, ly = y + (it.dy || 0) * k;
    if (it.dx || it.dy) svg += `<line x1="${lx}" y1="${ly}" x2="${x}" y2="${y}" stroke="#000" stroke-opacity=".6" stroke-width="5"/><line x1="${lx}" y1="${ly}" x2="${x}" y2="${y}" stroke="#ffe14a" stroke-width="2.5" marker-end="url(#qa)"/>`;
    const tx = it.al === 'l' ? '0' : it.al === 'r' ? '-100%' : '-50%';
    html += `<div style="position:absolute;left:${lx}px;top:${ly}px;transform:translate(${tx},-50%);background:#14200f;color:#fff6d0;border:2px solid #ffe14a;border-radius:6px;padding:3px 8px;font:600 ${Math.max(13, 16 * k)}px system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5)">${it.t}</div>`;
  }
  box.innerHTML = svg + '</svg>' + html; document.body.appendChild(box);
  // keep every label inside the picture (its arrow still points where it did)
  for (const d of box.querySelectorAll(':scope > div')) {
    const q = d.getBoundingClientRect(), over = q.right - (R - 4), under = (L + 4) - q.left;
    if (over > 0) d.style.left = (parseFloat(d.style.left) - over) + 'px'; else if (under > 0) d.style.left = (parseFloat(d.style.left) + under) + 'px';
    const q2 = d.getBoundingClientRect(), dn = q2.bottom - (B - 4), up = (T + 4) - q2.top;
    if (dn > 0) d.style.top = (parseFloat(d.style.top) - dn) + 'px'; else if (up > 0) d.style.top = (parseFloat(d.style.top) + up) + 'px';
  }
  return { x: L, y: T, width: R - L, height: B - T };
};
0"""

# ---------- golf ----------
GOLF = {
  'prep': "window.__to = (ph, n) => { let i = 0; while (wGL.phase !== ph && i++ < (n || 8000)) wGL.tick(0.05); return wGL.phase === ph; }; 0",
  'cv': "document.querySelector('#v-links canvas')", 'W': 960,
  # the camera has stopped: where a fixed point is drawn is the same as 200 ms ago
  'still': "(() => { const v = JSON.stringify(wGL.scr(0, 0)); const ok = window.__cam === v; window.__cam = v; return ok; })()",
  'shots': [
    ('links-aim', "(() => { wLinksGame({ seed: 11, mode: 'play', holes: 9 }); wGL.pause(true); __to('aim'); })()",
     """(() => { const G = wGL.G, b = G.ball[wGL.you], [bx, by] = wGL.scr(b.x, b.y), a = wGL.view.sel.aim, [ax, ay] = wGL.scr(a.x, a.y);
       return [{ t: 'Your ball', x: bx, y: by + 8, dx: 0, dy: 90 }, { t: 'The ring: where a good swing lands', x: ax, y: ay - 14, dx: 0, dy: -90 }, { t: 'The swing meter: press Space to start', x: 480, y: 538, dx: 0, dy: -80 }]; })()"""),
    ('links-power', "(() => { wGL.press(); let i = 0; const t = wGL.view.sel.tick; while (wGL.view.meter.p < t - 0.14 && i++ < 400) wGL.tick(0.01); })()",
     """(() => { const X = p => 200 + (p + 0.18) / 1.28 * 560, t = wGL.view.sel.tick;
       return [{ t: 'The arrow runs right', x: X(wGL.view.meter.p), y: 534, dx: -150, dy: -70 }, { t: 'Press Space at the yellow line: the power', x: X(t), y: 541, dx: -60, dy: -150 }, { t: 'Red: more power, harder to hit straight', x: X(1.06), y: 548, dx: 0, dy: -230, al: 'r' }]; })()"""),
    ('links-mark', "(() => { wGL.press(); let i = 0; while (wGL.view.meter.p > 0.22 && i++ < 400) wGL.tick(0.01); })()",
     """(() => { const X = p => 200 + (p + 0.18) / 1.28 * 560;
       return [{ t: 'Press Space inside the green block: straight', x: X(0), y: 543, dx: 0, dy: -170 }, { t: 'Before it: curves left', x: X(0.13), y: 548, dx: 120, dy: -90, al: 'l' }, { t: 'After it: curves right', x: X(-0.13), y: 548, dx: -40, dy: -90, al: 'r' }]; })()"""),
    ('links-putt', """(() => { wLinksGame({ seed: 11, mode: 'play', holes: 9 }); wGL.pause(true); __to('aim');
       const sn = wGL.snapshot(), G = sn.G, H = wGL.course(G.h); G.ball[0] = { x: H.pin.x - 6, y: H.pin.y + 2.5, lie: 'G' }; G.ball[1] = { x: H.pin.x - 2.5, y: H.pin.y - 1, lie: 'G' }; G.hole.st = [2, 2];
       wGL.resume(sn); wGL.pause(true); __to('aim'); })()""",
     """(() => { const G = wGL.G, H = wGL.course(G.h), b = G.ball[wGL.you], [bx, by] = wGL.scr(b.x, b.y), [px, py] = wGL.scr(H.pin.x, H.pin.y), t = wGL.view.sel.tick, X = p => 200 + p * 560;
       return [{ t: 'The read line: how the putt will break', x: bx + (px - bx) * 0.3, y: by + (py - by) * 0.3, dx: 0, dy: -120 }, { t: 'A putt: press Space, then again at the yellow line', x: X(t), y: 541, dx: 0, dy: -90 }]; })()"""),
  ],
}

# ---------- baseball (its page is in a shadow root; wBD.G.paused freezes it with no Time out box) ----------
BALL = {
  'prep': "(() => { while (wRoster().length < 5) wRecruit({ kind: ['troll', 'harpy', 'ogre'][wRoster().length % 3], lvl: 2 }, 'tavern'); wDrain(); __closeModals(); })()",
  'cv': "document.getElementById('v-diamond').shadowRoot.querySelector('canvas')", 'W': 960,
  'shots': [
    ('ball-bat', """(async () => { wStartBall({ club: 'local', how: 'play' }); __closeModals();
       await __until(() => wBD.G && wBD.G.phase === 'plate' && wBD.G.P && wBD.G.P.stage === 'flight' && wBD.G.P.t > 0.22 && !wBD.G.P.swing);
       const P = wBD.G.P; P.pci.x = P.pitch.fx0 + 0.35; P.pci.h = P.pitch.fh0 - 0.25; wBD.G.banner = null; wBD.G.paused = true; })()""",
     """(() => { const P = wBD.G.P, [mx, my] = wBD.scr(P.pitch.fx0, 0, P.pitch.fh0), [cx, cy] = wBD.scr(P.pci.x, 0, P.pci.h);
       return [{ t: 'The ring: where the ball will cross', x: mx, y: my, dx: -230, dy: -90, al: 'r' }, { t: 'Your circle: move it over the ring (WASD)', x: cx, y: cy, dx: 200, dy: 70, al: 'l' }, { t: 'Swing (Space) when the ring turns gold', x: 560, y: 494, dx: 140, dy: -40, al: 'l' }]; })()"""),
    ('ball-pitch', """(async () => { const P0 = wBD.G.P; wBD.G.paused = false;
       await __until(() => wBD.G.phase === 'plate' && wBD.G.P && wBD.G.P.stage === 'select' && wBD.G.teams[wBD.G.half === 0 ? 1 : 0].ctl === 'p1' && !(wBD.G.P.intro > 0), 1000).catch(() => null);
       if (!(wBD.G.P && wBD.G.P.stage === 'select' && wBD.G.teams[wBD.G.half === 0 ? 1 : 0].ctl === 'p1')) { wBD.G.half = 1; }
       const P = wBD.G.P; P.aim.x = 0.25; P.aim.h = 2.6; P.stage = 'windup'; P.t = 0.3; wBD.G.banner = null; wBD.G.paused = true; })()""",
     """(() => { const P = wBD.G.P, [ax, ay] = wBD.scr(P.aim.x, 0, P.aim.h);
       return [{ t: 'Aim with WASD: green is a strike', x: ax, y: ay, dx: -220, dy: 60, al: 'r' }, { t: 'Press Space again in the gold band', x: 560, y: 190, dx: 120, dy: -60, al: 'l' }, { t: 'Pick a pitch: 1 to 6', x: 830, y: 400, dx: -60, dy: -130 }]; })()"""),
  ],
}

# ---------- football ----------
GRID = {
  'prep': BALL['prep'],
  'cv': "document.querySelector('#v-gridiron canvas')", 'W': 960, 'more': ["document.getElementById('wGridBar')", "document.getElementById('wGridCalls')"],   # (the play buttons are a row under the field)
  'shots': [
    ('grid-call', """(async () => { const r = wStartGrid({ club: 'local', how: 'play' }); if (r) throw new Error('wStartGrid: ' + r); __closeModals();
       // (on defense the game waits for your call too: call one, until it is your ball)
       for (let i = 0; i < 40; i++) { await __until(() => wGF.phase === 'call', 60000); if (wGF.yourBall) break; __closeModals(); document.querySelector('#wGridDefs button').click(); await __until(() => wGF.phase !== 'call', 5000); }
       wGF.pause(true); wGridBar(); })()""",
     """[{ t: 'Click a play: every down waits for you', el: document.querySelector('#wGridCalls button'), dx: 60, dy: -110, al: 'l' }, { t: 'Your call', x: 480, y: 49, dx: 160, dy: 60, al: 'l' }]"""),
    ('grid-pass', """(async () => { wGF.pause(false); wGF.call('short'); await __until(() => wGF.hands, 15000); wGF.input({ hold: true }); await new Promise(r => setTimeout(r, 450)); wGF.pause(true); })()""",
     """[{ t: 'Hold Space: the marker runs out to the ringed receiver. Let go to throw.', x: 480, y: 586, dx: 0, dy: -70 }]"""),
    ('grid-kick', """(async () => { wGF.input({ hold: false }); wGF.pause(false); await __until(() => wGF.phase === 'call', 60000);
       wGF.G.down = 4; wGF.call('punt'); await __until(() => wGF.phase === 'kick' && wGF.meter, 15000);
       await new Promise(r => setTimeout(r, 500)); wGF.pause(true); })()""",
     """[{ t: 'First press: the power (the white line is enough)', x: 480, y: 460, dx: -40, dy: -110 }, { t: 'Second press: when the aim is in the green', x: 480, y: 505, dx: 200, dy: 60, al: 'l' }]"""),
  ],
}

# ---------- boxing ----------
RING = {
  'cv': "document.querySelector('#v-ring canvas')", 'W': 960, 'more': ["document.getElementById('wRingBar')"],
  'shots': [
    ('ring-plan', """(async () => { wRingBout({ kinds: ['minotaur', 'elf'], seed: 5 }); wBX.pause(true);
       let i = 0; while (!(wBX.wait && wBX.wait.plan) && i++ < 400) wBX.step(); })()""",
     """[{ t: 'Before each round: click a plan', el: document.querySelector('[data-rplan]'), dx: 40, dy: 170, al: 'l' }]"""),
    ('ring-fight', """(async () => { wBX.call('counter'); for (let i = 0; i < 40; i++) wBX.step(); const F = wBX.G.F; F[0].x = -1.3; F[1].x = 1.3; F[0].y = F[1].y = 0; document.getElementById('wRingBar').hidden = true;
       wBX.act(1, 'hook'); for (let i = 0; i < 3; i++) wBX.step(); wBX.render(); })()""",
     """(() => { const F = wBX.G.F, [ox, oy] = wBX.scr(F[1].x, F[1].y, 0);
       return [{ t: 'Health', x: 150, y: 58, dx: -40, dy: 115 }, { t: 'Stamina (blue): every punch costs some', x: 260, y: 67, dx: 20, dy: 190, al: 'l' }, { t: 'Arm drawn back: a punch is coming. Guard (Space) or slip (Shift)', x: ox, y: oy - 120, dx: 40, dy: 260, al: 'l' }]; })()"""),
  ],
}

# ---------- basketball ----------
COURT = {
  'cv': "document.querySelector('#v-court canvas')", 'W': 960,
  'shots': [
    ('court-ball', """(async () => { wRunAct('scrimmage'); await __until(() => UI.view === 'court' && wBK.on && wBK.phase === 'live', 20000);
       await __until(() => wBK.offense, 30000); await new Promise(r => setTimeout(r, 600)); wBK.pause(true); })()""",
     """(() => { const { x, y } = wBK.scr(wBK.play.pl[wBK.me].x, wBK.play.pl[wBK.me].y); return [{ t: 'You (the yellow arrow): move with WASD, pass with J', x, y: y - 60, dx: 0, dy: -100 }]; })()"""),
    ('court-shot', """(async () => { wBK.pause(false); wBK.input({ shoot: true }); await __until(() => wBK.meter && wBK.meter.now > 0.55, 5000); wBK.pause(true); })()""",
     """(() => { const { x, y } = wBK.scr(wBK.play.pl[wBK.me].x, wBK.play.pl[wBK.me].y); return [{ t: 'Hold Space; let go when the bar is in the green, near the top', x: x + 30, y: y - 40, dx: -40, dy: -140, al: 'r' }]; })()"""),
    ('court-def', """(async () => { wBK.input({ shoot: false }); wBK.pause(false); await __until(() => !wBK.offense && wBK.phase === 'live', 30000); await new Promise(r => setTimeout(r, 700)); wBK.pause(true); })()""",
     """(() => { const { x, y } = wBK.scr(wBK.play.pl[wBK.me].x, wBK.play.pl[wBK.me].y); return [{ t: 'On defense: J to steal, Space to block, E to switch', x, y: y - 60, dx: 0, dy: -100 }]; })()"""),
  ],
}

# ---------- hockey ----------
RINK = {
  'cv': "document.querySelector('#v-rink canvas')", 'W': 960,
  'shots': [
    ('rink-faceoff', """(async () => { wRinkGame({ seed: 7 }); wHK.pause(true);
       let i = 0; while (wHK.phase !== 'drop' && i++ < 400) wHK.step(1); wHK.step(24); wHK.render(); })()""",
     """[{ t: 'Face-off: press Space as the ring closes', x: 480, y: 330, dx: 0, dy: -150 }]"""),
    ('rink-puck', """(async () => { wHK.give(1); wHK.step(6); wHK.render(); })()""",
     """(() => { const p = wHK.play.pl[wHK.me], { x, y } = wHK.scr(p.x, p.y); return [{ t: 'You (the yellow ring): skate with WASD, pass with J', x, y: y - 30, dx: 0, dy: -110 }]; })()"""),
    ('rink-shot', """(async () => { wHK.give(1); wHK.input({ shoot: false }); wHK.step(1); wHK.input({ shoot: true }); for (let i = 0; i < 60 && !(wHK.meter && wHK.meter.pow > 0.7); i++) wHK.step(1); if (!wHK.meter) throw new Error('no wind-up: ' + JSON.stringify(wHK.meter)); wHK.render(); })()""",
     """(() => { const p = wHK.play.pl[wHK.me], { x, y } = wHK.scr(p.x, p.y); return [{ t: 'Tap Space to shoot, or hold it for a slap shot (the bar turns orange)', x: x + 14, y: y - 20, dx: 30, dy: -130 }]; })()"""),
  ],
}

# ---------- bowling ----------
# (the meter's marker: x 590, from v -0.22 at y 470 up to v 1.1 at y 150; the yellow line is v 1, the green block v 0)
LANES = {
  'prep': "window.__to = (ph, n) => { let i = 0; while (wBL.phase !== ph && i++ < (n || 8000)) wBL.tick(0.05); return wBL.phase === ph; }; window.__mY = v => 470 - (v + 0.22) / 1.32 * 320; 0",
  'cv': "document.querySelector('#v-lanes canvas')", 'W': 960,
  'shots': [
    ('lanes-aim', "(() => { W_LANES_MODE = 'play'; wLanesGame({ seed: 5, mode: 'play' }); wBL.pause(true); __to('aim'); for (const m of wBL.G.teams[wBL.view.you].roster) if (m.style) m.style.hand = 1; wBL.select({ suggest: true }); for (let i = 0; i < 40; i++) wBL.render(0.05); })()",
     """(() => { const S = wBL.view.sel, g = wBL.geo, [fx, fy] = wBL.scr(wBL.boardX(S.stand), 0), [ax, ay] = wBL.scr(wBL.boardX(S.arrow), g.arrows), [px, py] = wBL.scr(0, g.len);
       return [{ t: 'The guide line: where a good ball goes', x: (ax + px) / 2 + 6, y: (ay + py) / 2, dx: 150, dy: -40, al: 'l' }, { t: 'The arrow you roll over (A, D)', x: ax + 12, y: ay, dx: 150, dy: 30, al: 'l' }, { t: 'Your feet (the left and right arrows)', x: fx - 10, y: fy, dx: -150, dy: -60, al: 'r' }]; })()"""),
    ('lanes-speed', "(() => { wBL.press(); let i = 0; while (wBL.view.meter.v < 0.82 && i++ < 400) wBL.tick(0.01); for (let j = 0; j < 4; j++) wBL.render(0.02); })()",
     """[{ t: 'The marker climbs', x: 604, y: __mY(wBL.view.meter.v), dx: -170, dy: 40, al: 'r' }, { t: 'Press Space at the yellow line: the speed', x: 578, y: __mY(1), dx: -130, dy: -40, al: 'r' }, { t: 'Red: a power ball', x: 600, y: __mY(1.05), dx: 110, dy: 70, al: 'l' }]"""),
    ('lanes-mark', "(() => { wBL.press(); let i = 0; while (wBL.view.meter.v > 0.3 && i++ < 400) wBL.tick(0.01); for (let j = 0; j < 4; j++) wBL.render(0.02); })()",
     """[{ t: 'Press Space inside the green block', x: 578, y: __mY(0), dx: -170, dy: -30, al: 'r' }, { t: 'Before it: pulled left', x: 600, y: __mY(0.15), dx: 120, dy: -60, al: 'l' }, { t: 'After it: pushed right', x: 600, y: __mY(-0.15), dx: 120, dy: 40, al: 'l' }]"""),
  ],
}

# ---------- curling ----------
# (the meter: x 584, from v .82 at y 470 up to v 1.22 at y 150; the yellow line is v 1, at y 326)
SHED = {
  'prep': "window.__to = (ph, n) => { let i = 0; while (wCR.phase !== ph && i++ < (n || 8000)) wCR.tick(0.05); return wCR.phase === ph; }; window.__mY = v => 470 - (v - 0.82) / 0.4 * 320; 0",
  'cv': "document.querySelector('#v-shed canvas')", 'W': 960,
  'shots': [
    ('shed-aim', "(() => { W_SHED_MODE = 'play'; wShedGame({ seed: 7, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); wCR.select({ suggest: true }); for (let i = 0; i < 40; i++) wCR.render(0.05); })()",
     """(() => { const S = wCR.view.sel, [bx, by] = wCR.scr(S.x, S.y), [hx, hy] = wCR.houseScr(S.x, S.y);
       return [{ t: 'Your skip\\'s broom: where the stone should stop', x: bx, y: by, dx: -60, dy: 150, al: 'r' }, { t: 'The house from above: the broom again', x: hx, y: hy, dx: -10, dy: 200, al: 'r' }]; })()"""),
    ('shed-weight', "(() => { wCR.press(); let i = 0; while (wCR.view.meter && wCR.view.meter.v < 0.94 && i++ < 2000) wCR.tick(0.002); for (let j = 0; j < 4; j++) wCR.render(0.02); })()",
     """[{ t: 'The marker climbs', x: 604, y: __mY(wCR.view.meter.v), dx: 120, dy: 50, al: 'l' }, { t: 'Press Space on the yellow line: the called weight', x: 570, y: __mY(1), dx: -160, dy: -50, al: 'r' }, { t: 'Above it: heavy (runs long)', x: 584, y: __mY(1.15), dx: 110, dy: -40, al: 'l' }, { t: 'Below it: light (stops short)', x: 584, y: __mY(0.88), dx: -150, dy: 40, al: 'r' }]"""),
    ('shed-sweep', "(() => { let i = 0; while (wCR.view.meter && wCR.view.meter.v < 0.9 && i++ < 2000) wCR.tick(0.002); wCR.press(); i = 0; while (wCR.phase === 'slide' && i++ < 34) wCR.tick(0.05); wCR.sweep = true; for (let j = 0; j < 30; j++) { wCR.tick(0.02); wCR.render(0.02); } })()",
     """(() => { const T = wCR.slideStone || { x: 0, y: -600 }, [sx, sy] = wCR.scr(T.x, T.y);
       return [{ t: 'Hold Space: your two sweepers sweep it', x: sx, y: sy - 20, dx: 170, dy: 90, al: 'l' }, { t: 'Your skip\\'s call: sweep, or let it go', x: 310, y: 190, dx: 150, dy: -60, al: 'l' }]; })()"""),
  ],
}

# ---------- pets: the Pets tab and a hatching (dialogs), a match with both pets on the field ----------
PETS = {
  'prep': "0",
  'cv': "document.getElementById('modalBox')", 'W': "document.getElementById('modalBox').getBoundingClientRect().width",
  'shots': [
    ('pets-tab', "(async () => { __closeModals(); const L0 = LAB; LAB = true; const q = wPetAdd('hootling', 'keeper:moss'); wPetAdd('blinkpup', 'shop:hq'); LAB = L0; wAddItem('mossberry', 1); q.xp = 8; wOpenCamp('pets'); await __until(() => document.querySelector('#wCampBody .wpetc')); })()",
     """(() => { const side = document.querySelector('#wCampBody [data-petside]'), bond = document.querySelector('#wCampBody .wpetbond'), treat = document.querySelector('#wCampBody [data-pettreat]');
       return [{ t: 'At my side: the pet that goes into your matches', el: side, dx: -40, dy: -60, al: 'r' }, { t: 'Its bond, and what it likes to eat', el: bond, dx: 60, dy: 50, al: 'l' }].concat(treat ? [{ t: 'Give it a treat', el: treat, dx: 20, dy: -55, al: 'r' }] : []); })()"""),
    ('pets-hatch', "(async () => { __closeModals(); WG.petEggs = WG.petEggs || {}; WG.petEggs.aether = { kind: 'pseudodragon', due: WG.dayAbs }; wPeggOpen('aether'); await __until(() => document.getElementById('wHatchName')); })()",
     """[{ t: 'An egg hatched at its hatching place: name your pet', el: document.getElementById('wHatchName'), dx: 0, dy: -70 }]"""),
  ],
}
PETFIELD = {
  'prep': "0",
  'cv': "document.querySelector('#v-fight #cv')", 'W': 960, 'more': ["document.getElementById('petBox')", "document.getElementById('foePetBox')"],
  'shots': [
    ('pets-field', "(async () => { __closeModals(); const L0 = LAB; LAB = true; const q = wPets().owned.find(x => x.kind === 'hootling') || wPetAdd('hootling', 'keeper:moss'); LAB = L0; wPetSide(q.id); RUN.foePet = { kind: 'griffon', skill: 2 }; beginFight({ ids: ['skelss', 'thief'], type: 'normal', sport: 'baseball' }); await __until(() => UI.view === 'fight' && (!A.banner || A.t > A.banner.t0 + A.banner.life)); })()",
     """[{ t: 'Your pet: it acts on its own', x: 420, y: 410, dx: -120, dy: -150, al: 'r' }, { t: 'A rival club brings its own', x: entA('foepet').x || 490, y: 410, dx: 120, dy: -170, al: 'l' },
       { t: 'Hover: what it does. The button: its trick (T), once a match', el: document.getElementById('bPetTrick'), dx: 120, dy: -40, al: 'l' }]"""),
  ],
}

SHOTS = {'links': GOLF, 'lanes': LANES, 'shed': SHED, 'ball': BALL, 'grid': GRID, 'ring': RING, 'court': COURT, 'rink': RINK, 'pets': PETS, 'petfield': PETFIELD}

async def main():
    only = sys.argv[1:] or list(SHOTS)
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    imgs = {}
    if os.path.exists(OUT):
        for k, v in re.findall(r"^  '([a-z0-9-]+)': '(data:[^']+)',$", open(OUT).read(), re.M): imgs[k] = v
    async with async_playwright() as p:
        br = await p.chromium.launch()
        errs = []
        for sport in only:
            S = SHOTS[sport]
            # a fresh page and journey for each sport, so one sport's game can't get in the next one's way
            pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
            await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
            await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false; SET.sfx = false; SET.music = false")
            await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
            if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
            await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
            await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
            await pg.evaluate(HELP_JS)
            if S.get('prep'): await pg.evaluate(S['prep'])
            for sid, setup, labels_js in S['shots']:
                try:
                    await pg.evaluate(setup)
                    if S.get('still'): await pg.wait_for_function(S['still'], polling=200, timeout=10000)
                    await pg.wait_for_timeout(400)   # (a few frames, so the frozen moment is drawn)
                    clip = await pg.evaluate(f"() => __label({S['cv']}, {S['W']}, [{','.join(S.get('more', []))}], {labels_js})")
                    png = await pg.screenshot(clip=clip, type='jpeg', quality=85)
                    await pg.evaluate("document.querySelectorAll('.__qlab').forEach(e => e.remove())")
                    # scaled to WIDTH in the page itself (a canvas), so no image library is needed
                    small = await pg.evaluate("""async ([src, w, q]) => { const im = new Image(); im.src = src; await im.decode(); const h = Math.round(im.height * w / im.width), c = document.createElement('canvas'); c.width = w; c.height = h;
                      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h); return c.toDataURL('image/jpeg', q); }""", ['data:image/jpeg;base64,' + base64.b64encode(png).decode(), WIDTH, QUALITY])
                    imgs[sid] = small
                    print(f'{sid}: {len(small) // 1024} KB')
                except Exception as e:
                    print(f'{sid}: FAILED {str(e)[:300]}')
            await pg.close()
        await br.close()
        if errs: print('page errors:', errs[:5])
    body = ''.join(f"  '{k}': '{v}',\n" for k, v in sorted(imgs.items()))
    open(OUT, 'w').write(f"""/* w112a: the Quick start screenshots (W_QUICK_IMG), taken from the game by test/realm_quick_shots.py. Generated: don't
   edit by hand; run the script again when a sport's look changes, then rebuild. */
const W_QUICK_IMG = {{
{body}}};
""")
    print(f'{len(imgs)} shots, {os.path.getsize(OUT) // 1024} KB in {os.path.relpath(OUT, ROOT)}')

asyncio.run(main())
