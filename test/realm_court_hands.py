# Realm court, by hand (issue #77, phase 2). You play your side: the release meter (hold Space, let go at the top; the
# window's width from the look; dead on is a swish, well off misses; held too long it goes up late), the pass to the
# teammate you steer toward, the lob (held), the alley-oop, picks (switch, over, trap), the crossover and the spin, and
# on defense the swipe, the jump in time with the shot (and goaltending), the box-out and switching players; free
# throws on the meter. The hot hand: three makes in a row and a player is on fire, with a better look, until a miss.
# Fast breaks, picks, lobs, moves and alley-oops come up in CPU games too. Idle, your player plays on. In the Realm:
# Watch and You play on the bar, the pad under the court following the side of the ball, Space on the keyboard shooting
# on the meter, and How to play. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-court-hands.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

# a game in You play, live, the ball with `side`'s player at `pos`, standing u metres from the rim it attacks (v across),
# the other side's five far away (unless near), everyone still
PLACE = """(side, pos, u, v, near) => {
  const P = wBK.play, G = wBK.G; wBK.give(side);
  const i = P.pl.findIndex(p => p.side === side && p.pos === pos), hx = wBK.hoopX(side), dir = wBK.dir(side);
  P.pl.forEach((p, j) => { p.vx = p.vy = 0; p.stun = 0; p.act = ''; p.cut = null; p.x = hx - dir * (3 + j % 5 * 1.5); p.y = (j % 5 - 2) * 2.5; if (p.side !== side && !near) { p.x = wBK.rules.len / 2 - dir * 4; p.y = (j % 5 - 2) * 2.5; } });
  P.pl[i].x = hx - dir * u; P.pl[i].y = v || 0;
  Object.assign(P.ball, { st: 'held', h: i, to: -1, lob: false }); P.shot = null; P.pick = null; P.trap = null; P.moveCd = 0; P.drive = false; P.me = -1; P.think = 9;
  G.shot = 14; G.clock = Math.max(G.clock, 40); return i; }"""
SETUP = """(side, pos, u, v, seed, near) => { wBK.start({ seed: seed || 3, mode: 'play', skill: [0, 0], powers: false }); let n = 0; while (wBK.phase !== 'live' && n++ < 300) wBK.step(); return __place(side, pos, u, v, near); }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBK !== 'undefined'")
        await pg.evaluate(f"window.__place = {PLACE}; window.__setup = {SETUP}; 0")

        # ---------- the release meter ----------
        m = await pg.evaluate("""(() => { const i = __setup(0, 'SF', 5, 0); const r0 = wBK.input({ shoot: true }), M0 = wBK.meter;
          let n = 0; while (wBK.meter && wBK.meter.now < 1 - wBK.meter.T * 0 && n++ < 200 && wBK.meter.now + 1 / 30 / wBK.meter.T <= 1) wBK.step();
          const at = wBK.meter ? wBK.meter.now : null, r1 = wBK.input({ shoot: false }); const S = wBK.shot(), e = wBK.release && wBK.release.e;
          __setup(0, 'SF', 5, 0); wBK.input({ shoot: true }); let k = 0; while (wBK.meter && k++ < 400) wBK.step(); const late = [wBK.shot() && wBK.shot().hand, wBK.release.e];
          return { r0, ft: M0 && M0.ft, rising: M0 && M0.now === 0, at, r1, hand: S && S.hand, e, late, me: wBK.me === i }; })()""")
        check(m['r0'] == 'rise' and m['me'] and m['at'] is not None and m['at'] > .9, 'with the ball, Space starts the rise and the meter climbs toward the top', m)
        check(m['r1'] == 'shot' and m['hand'] and m['e'] < .1, 'letting go at the top puts the shot up, by hand, a hair off the top', m)
        check(m['late'][0] and m['late'][1] >= .4, 'held too long, the shot goes up late on its own', m)
        w = await pg.evaluate("""({ make: [0, .09, .15, .6].map(e => wBK.handMake(.4, e)), w: [wBK.window(.2), wBK.window(.6)], p: .4 })""")
        mk = w['make']
        check(mk[0] > mk[1] > mk[2] > mk[3] and mk[0] > .7 and mk[1] > w['p'] and mk[2] < w['p'] and mk[3] < .1 and w['w'][1] > w['w'][0],
              'dead on is a swish, in the window better than the CPU\'s look, just outside worse, well off nearly never; a better look has a wider window', w)
        st = await pg.evaluate("""(() => { const out = {}; for (const e of [0, .6]) { let made = 0; for (let t = 0; t < 120; t++) { __setup(0, 'SF', 4, 0, 50 + t); const S = wBK.shootAt(e); made += S.made ? 1 : 0; } out[e] = made; } return out; })()""")
        check(st['0'] > 75 and st['0.6'] < 20, 'over 120 open shots, a perfect release goes in far more than one well off', st)

        # ---------- passing ----------
        pa = await pg.evaluate("""(() => { const i = __setup(0, 'PG', 7, 0), P = wBK.play;
          const j = P.pl.findIndex(p => p.side === 0 && p.pos === 'SF'); P.pl[j].x = P.pl[i].x + 4 * wBK.dir(0) * 0; P.pl[j].y = 6; P.pl[j].x = P.pl[i].x;
          const k = P.pl.findIndex(p => p.side === 0 && p.pos === 'SG'); P.pl[k].x = P.pl[i].x; P.pl[k].y = -6;
          const clear = () => P.pl.forEach((p, q) => { if (p.side === 0 && q !== i && q !== j && q !== k) { p.x = P.pl[i].x + wBK.dir(0) * 4; p.y = q % 2 ? 1 : -1; } }); clear();
          wBK.input({ steer: [0, 1] }); wBK.input({ pass: true }); const r = wBK.input({ pass: false }); const tap = [r, P.ball.to === j, P.ball.lob];
          __place(0, 'PG', 7, 0); P.pl[k].x = P.pl[i].x; P.pl[k].y = -6; P.pl[j].x = P.pl[i].x; P.pl[j].y = 6; clear();
          wBK.input({ steer: [0, -1] }); wBK.input({ pass: true }); wBK.step(10); wBK.input({ steer: [0, 0] }); const r2 = wBK.input({ pass: false });
          return { tap, held: [r2, P.ball.to === k, P.ball.lob] }; })()""")
        check(pa['tap'] == ['pass', True, False], 'a tap of J passes to the teammate you steer toward', pa)
        check(pa['held'] == ['lob', True, True], 'held, it is a lob, to the teammate you were steering toward', pa)
        al = await pg.evaluate("""(() => { const i = __setup(0, 'PG', 7, 0, 9), P = wBK.play, c = P.pl.findIndex(p => p.side === 0 && p.pos === 'C'), hx = wBK.hoopX(0), dir = wBK.dir(0);
          P.pl[c].r = Object.assign({}, P.pl[c].r, { hop: 10 }); P.pl[c].x = hx - dir * 1.6; P.pl[c].y = .4;
          wBK.pass(c, true); let n = 0; while (!wBK.shot() && n++ < 120) wBK.step(); const S = wBK.shot(); return S && { alley: S.alley, dunk: S.dunk, i: S.i === c }; })()""")
        check(al and al['alley'] and al['dunk'] and al['i'], 'a lob caught near the rim by a leaper goes straight up: the alley-oop', al)
        lb = await pg.evaluate("""(() => { const out = { pass: 0, lob: 0 }; for (const lob of [false, true]) for (let t = 0; t < 150; t++) {
            const i = __setup(0, 'PG', 9, 0, 200 + t), P = wBK.play, j = P.pl.findIndex(p => p.side === 0 && p.pos === 'SF'); P.pl[j].x = P.pl[i].x; P.pl[j].y = 6;
            const d = P.pl.find(p => p.side === 1); d.x = P.pl[i].x; d.y = 3; d.r = Object.assign({}, d.r, { def: 9 });
            wBK.pass(j, lob); if (P.ball.stl >= 0) out[lob ? 'lob' : 'pass']++; } return out; })()""")
        check(lb['pass'] > 15 and lb['lob'] < lb['pass'] / 2, 'a defender in the middle of the lane picks off passes; a lob over him, far fewer', lb)

        # ---------- the pick ----------
        pk = await pg.evaluate("""(() => { const seen = {}; let ok = true;
          for (let t = 0; t < 30; t++) { const i = __setup(0, 'PG', 8, 0, 300 + t, true), P = wBK.play; const d = P.pl.findIndex(p => p.side === 1 && p.mark === i);
            P.pl[d].x = P.pl[i].x + wBK.dir(0) * .9; P.pl[d].y = P.pl[i].y;
            const big = P.pl.findIndex(p => p.side === 0 && p.pos === 'C'); P.pl[big].x = P.pl[i].x + wBK.dir(0) * 2; P.pl[big].y = 1.5;
            const r = wBK.input({ act: 'pick' }); if (!r) { ok = false; continue; }
            let n = 0; while (P.pick && n++ < 120) { wBK.input({ steer: [0, 0] }); wBK.step(); }
            const k = P.pickLast; seen[k] = (seen[k] || 0) + 1;
            if (k === 'switch' && P.pl[d].mark === i) ok = false; if (k === 'trap' && !P.trap) ok = false; if (k === 'over' && !(P.pl[d].stun > 0 || n > 0)) ok = false;
            if (!(P.pl[big].cut)) ok = false; }
          return { seen, ok }; })()""")
        check(pk['ok'] and all(pk['seen'].get(k, 0) > 0 for k in ['switch', 'over', 'trap']),
              'E calls a pick: the defense switches (men swapped), goes over or traps, and the big rolls to the rim', pk)

        # ---------- moves ----------
        mv = await pg.evaluate("""(() => { const res = (hnd, def, k) => { const out = { beat: 0, stripped: 0, stumble: 0 }; for (let t = 0; t < 150; t++) {
              const i = __setup(0, 'PG', 7, 0, 400 + t, true), P = wBK.play; P.pl[i].r = Object.assign({}, P.pl[i].r, { hnd });
              const d = P.pl.find(p => p.side === 1); d.x = P.pl[i].x + wBK.dir(0) * .8; d.y = P.pl[i].y; d.r = Object.assign({}, d.r, { def });
              P.pl.filter(p => p.side === 1 && p !== d).forEach(p => { p.x = wBK.rules.len / 2; });
              const r = wBK.move(k); if (out[r] != null) out[r]++; } return out; };
          return { good: res(9, 3, 'cross'), bad: res(3, 9, 'cross'), spin: res(3, 9, 'spin') }; })()""")
        check(mv['good']['beat'] > 110 and mv['bad']['beat'] < mv['good']['beat'] / 3 and mv['bad']['stripped'] > 5 and mv['spin']['stripped'] > mv['bad']['stripped'],
              'a crossover: a great handle beats a poor defender most times; a poor handle against a great defender gets picked; a spin risks more', mv)

        # ---------- defense ----------
        sw = await pg.evaluate("""(() => { const out = { steal: 0, foul: 0, miss: 0 }; for (let t = 0; t < 150; t++) {
            const i = __setup(1, 'PG', 7, 0, 500 + t, true), P = wBK.play, me = wBK.me; const d = P.pl[me]; d.x = P.pl[i].x + wBK.dir(1) * .7; d.y = P.pl[i].y; d.r = Object.assign({}, d.r, { def: 8 });
            P.swipeAt = null; const r = wBK.input({ pass: true }); wBK.input({ pass: false }); if (out[r] != null) out[r]++; } return out; })()""")
        check(sw['steal'] > 10 and sw['foul'] > 3 and sw['miss'] > sw['steal'], 'on defense J swipes at the ball: a steal sometimes, a foul up close sometimes, mostly a miss', sw)
        jp = await pg.evaluate("""(() => { const out = { jumped: 0, still: 0 }; for (const k of ['jumped', 'still']) for (let t = 0; t < 200; t++) {
            const i = __setup(1, 'C', 1.4, 0, 600 + t, true), P = wBK.play, me = wBK.me, d = P.pl[me];
            P.pl.filter(p => p.side === 0 && p !== d).forEach(p => { p.x = wBK.rules.len / 2; });
            d.x = P.pl[i].x + wBK.dir(1) * .6; d.y = P.pl[i].y; d.r = Object.assign({}, d.r, { hop: 9, siz: 9, def: 9 });
            if (k === 'jumped') wBK.input({ shoot: true }); else wBK.input({ steer: [0, 0] });
            wBK.step(3); const S = wBK.shootAt(); if (S && S.block) out[k]++; } return out; })()""")
        check(jp['jumped'] > 2 * jp['still'] and jp['jumped'] > 30, 'Space on defense: a jump just before the shot blocks far more than standing there', jp)
        gt = await pg.evaluate("""(() => { const i = __setup(1, 'SF', 5, 0, 700), P = wBK.play, G = wBK.G, me = wBK.me, s0 = G.score[1];
          const S = wBK.shootAt(1); const was = S.made; let n = 0; while (P.ball.st === 'shot' && P.ball.t / P.ball.T < .6 && n++ < 60) wBK.step();
          const d = P.pl[me]; d.x = wBK.hoopX(1) - wBK.dir(1) * .5; d.y = 0; const r = wBK.input({ shoot: true });
          n = 0; while (P.ball.st === 'shot' && n++ < 60) wBK.step(); return { was, r, pts: G.score[1] - s0, msg: wBK.msg }; })()""")
        check(gt['r'] == 'goaltend' and gt['pts'] >= 2 and 'Goaltending' in gt['msg'], 'a jump at a ball already coming down at the rim is goaltending: the basket counts', gt)
        bx = await pg.evaluate("""(() => { const out = { on: 0, off: 0 }; for (const k of ['on', 'off']) for (let t = 0; t < 200; t++) {
            __setup(1, 'PG', 7, 0, 800 + t, true); const P = wBK.play, me = wBK.me, d = P.pl[me], o = P.pl.find(p => p.side === 1);
            P.pl.forEach(p => { p.x = 3; p.y = 7; }); const x = 10, y = 0; d.x = x + .9; d.y = 0; o.x = x - .7; o.y = 0;
            d.r = Object.assign({}, d.r, { siz: 5, hop: 5 }); o.r = Object.assign({}, o.r, { siz: 5, hop: 5 });
            wBK.input({ box: k === 'on' }); Object.assign(P.ball, { st: 'loose', h: -1, fx: x, fy: y, tx: x, ty: y, t: .54, T: .55, z0: 3 });
            wBK.step(); if (P.ball.st === 'held' && P.ball.h === me) out[k]++; wBK.input({ box: false }); } return out; })()""")
        check(bx['on'] > bx['off'] * 1.2, 'holding Shift boxes out: more of the rebounds near your player are yours', bx)
        sv = await pg.evaluate("""(() => { __setup(1, 'PG', 7, 0, 900, true); const a = wBK.me, r = wBK.input({ act: 'switch' }), b = wBK.me; return { r, a, b, side: wBK.play.pl[b].side }; })()""")
        check(sv['r'] == 'switch' and sv['a'] != sv['b'] and sv['side'] == 0, 'E on defense switches you to another of your players', sv)

        # ---------- free throws on the meter ----------
        ft = await pg.evaluate("""(() => { const i = __setup(0, 'SF', 5, 0, 950), G = wBK.G; wBK.freeThrows(0, i, 2); const ph = wBK.phase;
          const fta0 = G.box[0][wBK.play.pl[i].ri].fta; wBK.input({ shoot: true }); const M = wBK.meter;
          let n = 0; while (wBK.meter && wBK.meter.now + 1 / 30 / wBK.meter.T <= 1 && n++ < 200) wBK.step(); wBK.input({ shoot: false });
          const after = G.box[0][wBK.play.pl[i].ri].fta; wBK.input({ steer: [0, 0] }); wBK.step(60); const still = wBK.phase === 'ft' && G.box[0][wBK.play.pl[i].ri].fta === after;
          return { ph, ft: M && M.ft, one: after - fta0, e: wBK.release.e, still }; })()""")
        check(ft['ph'] == 'ft' and ft['ft'] and ft['one'] == 1 and ft['e'] < .1 and ft['still'], 'at the line Space works the meter, and the next shot waits for you while you are at the keys', ft)

        # ---------- the hot hand ----------
        hh = await pg.evaluate("""(() => { let i = __setup(0, 'SF', 1, 0, 1000); const P = wBK.play, G = wBK.G, ri = P.pl[i].ri;
          const p0 = wBK.shotP(i, wBK.hoopX(0) - wBK.dir(0) * 5, 0).p; let made = 0;
          for (let k = 0; k < 8 && made < 3; k++) { i = __place(0, 'SF', 1, 0); const S = wBK.shootAt(0); let n = 0; while (P.ball.st === 'shot' && n++ < 60) wBK.step(); if (S.made) made++; else G.hot[0][ri] = 0; }
          const fire = wBK.onFire(i), p1 = wBK.shotP(i, wBK.hoopX(0) - wBK.dir(0) * 5, 0).p, tally = G.tally.fire;
          let out = false; for (let k = 0; k < 10 && !out; k++) { i = __place(0, 'SF', 9, 0); const S = wBK.shootAt(1); let n = 0; while (P.ball.st === 'shot' && n++ < 60) wBK.step(); if (!S.made) out = !wBK.onFire(i); }
          return { made, fire, up: Math.round((p1 - p0) * 100) / 100, tally, out }; })()""")
        check(hh['made'] == 3 and hh['fire'] and hh['up'] >= .07 and hh['tally'] >= 1, 'three makes in a row and the shooter is on fire: a better look', hh)
        check(hh['out'], 'a miss puts the fire out', hh)

        # ---------- in CPU games, and idle ----------
        cg = await pg.evaluate("""(() => { const t = { break: 0, fire: 0, screen: 0, lob: 0, beat: 0, alley: 0 }; let pts = 0;
          for (let i = 0; i < 16; i++) { const s = wBK.simGame({ seed: 1200 + i }); for (const k in t) t[k] += s.tally[k]; pts += s.score[0] + s.score[1]; }
          return { t, avg: pts / 32 }; })()""")
        check(all(cg['t'][k] > 0 for k in cg['t']) and 15 <= cg['avg'] <= 35, 'in CPU games there are fast breaks, hot hands, picks, lobs, moves and alley-oops, and the scores still look like basketball', cg)

        # ---------- the Realm ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wRunAct('scrimmage')")
        await pg.wait_for_function("UI.view === 'court' && wBK.on && wBK.phase === 'live'")
        r = await pg.evaluate("({ mode: wBK.mode, on: document.querySelector('#wCourtModes .on').dataset.cmode, pad: !document.getElementById('wCourtPad').hidden })")
        check(r == {'mode': 'play', 'on': 'play', 'pad': True}, 'a SCRIMMAGE starts in You play, with the pad under the court', r)
        # the keyboard: hand Graftonbury the ball, then Space on the meter
        await pg.evaluate(f"window.__place = {PLACE}; wBK.pause(true); __place(0, 'SF', 4, 0); wBK.pause(false)")
        await pg.wait_for_function("document.getElementById('wCourtPad').dataset.side === 'off'")
        labels = await pg.evaluate("[...document.querySelectorAll('#wCourtPad button')].map(b => b.textContent)")
        await pg.keyboard.down(' ')
        await pg.wait_for_function("!!wBK.meter")
        await pg.screenshot(path='/tmp/realm-court-hands.png')
        await pg.wait_for_function("!wBK.meter || wBK.meter.now > .95")
        await pg.keyboard.up(' ')
        await pg.wait_for_function("!!wBK.release")
        kb = await pg.evaluate("({ rel: wBK.release, shot: !!wBK.shot() || wBK.phase !== 'live' })")
        check(labels[:2] == ['Shoot', 'Pass'] and kb['rel'] is not None and kb['shot'], 'with the ball the pad has Shoot and Pass; Space held and let go shoots on the meter', {'labels': labels, **kb})
        await pg.evaluate("wBK.pause(true); __place(1, 'PG', 7, 0); wBK.pause(false)")
        await pg.wait_for_function("document.getElementById('wCourtPad').dataset.side === 'def'")
        dl = await pg.evaluate("[...document.querySelectorAll('#wCourtPad button')].map(b => b.textContent)")
        check(dl == ['Jump', 'Swipe', 'Box out', 'Switch'], 'on defense the pad has Jump, Swipe, Box out and Switch', dl)
        # a held pad button when the ball changes hands: let go for you, never stuck on
        sk = await pg.evaluate("""(async () => { const b = document.querySelector('#wCourtPad [data-cpad="box"]');
          b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 })); const held = wBK.inputState.box;
          wBK.pause(true); __place(0, 'SF', 4, 0); wBK.pause(false);
          for (let i = 0; i < 40 && document.getElementById('wCourtPad').dataset.side !== 'off'; i++) await new Promise(r => setTimeout(r, 20));
          return { held, after: wBK.inputState.box, side: document.getElementById('wCourtPad').dataset.side }; })()""")
        check(sk == {'held': True, 'after': False, 'side': 'off'}, 'a pad button held as the ball changes hands is let go when the pad redraws', sk)
        # a shooter halfway up when the input clears (Watch, a lost focus) comes back down, free to move
        rz = await pg.evaluate("""(() => { wBK.pause(true); const i = __place(0, 'SF', 5, 0); wBK.input({ shoot: true }); const up = wBK.play.pl[i].act;
          wBK.setMode('watch'); const r = { up, act: wBK.play.pl[i].act, meter: wBK.meter }; wBK.setMode('play'); wBK.pause(false); return r; })()""")
        check(rz == {'up': 'rise', 'act': '', 'meter': None}, 'a shooter rising when the input is cleared comes back down', rz)
        await pg.click('[data-cmode="watch"]')
        wt = await pg.evaluate("({ mode: wBK.mode, pad: document.getElementById('wCourtPad').hidden })")
        check(wt == {'mode': 'watch', 'pad': True}, 'Watch hands both sides to the CPU, and the pad goes', wt)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wCourtHow'); return !!h && /You play/.test(h.textContent) && /alley-oop/.test(h.textContent) && /on fire/.test(h.textContent) && /goaltending/.test(h.textContent) && /pick and roll/i.test(h.textContent); })()")
        check(hp, 'How to play explains playing by hand, the pick and roll, the alley-oop, the hot hand and goaltending', hp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
