# Realm gridiron Play mode (issue #9, phase 2): you call your side's plays and play its offense by hand; on defense you
# call and watch (question 3). On the field, through the engine's test handle: the quarterback waits for you on a pass,
# holding Space and letting go throws to the ringed receiver (Q and E pick another), a hand-thrown pass does about as
# well as the coaches' quarterback, WASD steers the carrier, a quarterback past the line runs and can't throw, and Space
# with the ball is a stiff-arm, once a play. In the Realm, with real keys: the three mode buttons, a pass thrown with
# Space, and a field goal kicked on the two-tap meter. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-gridiron-play-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGF !== 'undefined'")  # (not sped up: the plays by hand are timed in real seconds)

        # ---------- on the field, through the test handle ----------
        e = await pg.evaluate("""(() => { const out = {};
          // a short pass by hand: hold Space at .6 s, let go at 1.0 s
          const th = { n: 40, thrown: 0, tgt: 0, gain: 0, cpu: 0 };
          for (let i = 0; i < th.n; i++) { let L = wGF.snap('short', 'zone', { seed: 100 + i, mode: 'play' }), tgt = -1;
            while (!L.done) { if (Math.abs(L.t - .6) < .02) wGF.input({ hold: true }); if (Math.abs(L.t - 1) < .02) { tgt = L.ctl.tgt; wGF.input({ hold: false }); } L = wGF.step(); }
            if (L.ev.some(x => x.k === 'throw')) th.thrown++; if (L.ball.tgt === tgt) th.tgt++; th.gain += L.done.gain / th.n;
            th.cpu += wGF.down('short', 'zone', { seed: 100 + i }).gain / th.n; }
          out.th = th;
          // no keys on a pass: no throw
          let none = 0; for (let i = 0; i < 15; i++) { let L = wGF.snap('deep', 'man', { seed: 200 + i, mode: 'play' }); while (!L.done) L = wGF.step(); if (L.ev.some(x => x.k === 'throw')) none++; }
          out.none = none;
          // Q and E pick another receiver, and the pass goes to the one picked
          { let L = wGF.snap('short', 'man', { seed: 7, mode: 'play' }); L = wGF.step(); const a = L.ctl.tgt; wGF.input({ pick: 1 }); const b = L.ctl.tgt;
            for (let k = 0; k < 20; k++) L = wGF.step(); wGF.input({ hold: true }); for (let k = 0; k < 6; k++) L = wGF.step(); wGF.input({ hold: false });
            out.pick = { a, b, ball: L.ball.tgt, kept: L.ctl.tgt === b }; }
          // steering moves the carrier where the keys say (down the screen is +y for the home side)
          const ys = s => { let acc = 0; for (let i = 0; i < 20; i++) { let L = wGF.snap('run', 'zone', { seed: 300 + i, mode: 'play' }); if (s) wGF.input({ steer: s }); let n = 0; while (!L.done && n++ < 45) L = wGF.step(); acc += L.pl[L.id.RB].y / 20; } return acc; };
          out.steer = { none: ys(null), down: ys([0, 1]), up: ys([0, -1]) };
          // the quarterback scrambles over the line: a run, and no throw from there
          // (out wide first, then up the field: straight into the line is a sack)
          { const sc = { crossed: 0, thrown: 0, sacked: 0 };
            for (let i = 0; i < 20; i++) { let L = wGF.snap('deep', 'zone', { seed: 11 + i, mode: 'play' }); wGF.input({ steer: [0, 1] }); let tried = false;
              while (!L.done) { if (L.t > .5) wGF.input({ steer: [1, .3] }); if (L.pl[L.id.QB].x > .5 && !tried) { tried = true; wGF.input({ hold: true }); wGF.input({ hold: false }); } L = wGF.step(); }
              if (tried) { sc.crossed++; if (L.thrown) sc.thrown++; if (L.done.what === 'sack') sc.sacked++; } }
            out.scramble = sc; }
          // the stiff-arm: once a play, and it shrugs off the next tackle
          let used = 0, twice = 0, br0 = 0, br1 = 0;
          for (let i = 0; i < 40; i++) { let L = wGF.snap('run', 'man', { seed: 400 + i, mode: 'play' }), on = false;
            while (!L.done) { if (L.handed && !on) { on = true; wGF.input({ hold: true }); wGF.input({ hold: false }); wGF.input({ hold: true }); } L = wGF.step(); }
            const s = L.ev.filter(x => x.k === 'stiff').length; if (s) used++; if (s > 1) twice++; br1 += L.broken;
            br0 += (() => { let M = wGF.snap('run', 'man', { seed: 400 + i, mode: 'play' }); while (!M.done) M = wGF.step(); return M.broken; })(); }
          out.stiff = { used, twice, broken: br1, without: br0 };
          // in watch mode none of it is there
          out.watchHands = wGF.snap('short', 'zone', { seed: 5 }).hands;
          return out; })()""")
        print('     hands:', e)
        t = e['th']
        check(t['thrown'] == t['n'] and t['tgt'] == t['n'], 'hold Space and let go: the quarterback throws, to the ringed receiver', t)
        check(abs(t['gain'] - t['cpu']) < 4, 'a pass thrown by hand does about as well as the coaches\' quarterback', t)
        check(e['none'] == 0, 'with no keys on a pass, the quarterback waits for you (no throw without you)', e['none'])
        pk = e['pick']
        check(pk['a'] != pk['b'] and pk['b'] >= 0 and pk['kept'] and pk['ball'] == pk['b'], 'Q and E pick another receiver, and the pass goes to them', pk)
        s = e['steer']
        check(s['down'] > s['none'] + 3 and s['up'] < s['none'] - 3, 'WASD steers the carrier', s)
        check(e['scramble']['crossed'] >= 3 and not e['scramble']['thrown'] and not e['scramble']['sacked'], 'a quarterback over the line runs it, and can\'t throw from there', e['scramble'])
        st = e['stiff']
        check(st['used'] == 40 and st['twice'] == 0 and st['broken'] > st['without'], 'Space with the ball is a stiff-arm, once a play, and it breaks tackles', st)
        check(e['watchHands'] is False, 'without Play mode, the field plays itself as before')

        # ---------- in the Realm, with real keys ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wGridironDrive({ mode: 'watch', seed: 21 })")
        m = await pg.evaluate("[...document.querySelectorAll('#wGridModes button')].map(b => [b.dataset.gmode, b.textContent, b.classList.contains('on')])")
        check([x[0] for x in m] == ['watch', 'call', 'play'] and m[0][2] and not m[2][2], 'three mode buttons: Coaches, You call, You play, the one in use lit', m)
        await pg.click('[data-gmode="play"]')
        await pg.wait_for_function("wGF.phase === 'call'", timeout=30000)
        check(await pg.evaluate("document.querySelector('#wGridModes .on').dataset.gmode") == 'play', 'You play is lit once picked')
        await pg.click('[data-gcall="short"]')
        await pg.wait_for_function("wGF.hands", timeout=8000)
        await pg.wait_for_timeout(500)
        note = await pg.evaluate("document.getElementById('wGridNote').textContent")
        await pg.keyboard.down(' ')
        await pg.wait_for_timeout(350)
        await pg.screenshot(path='/tmp/realm-gridiron-play-lead.png')
        await pg.keyboard.up(' ')
        await pg.wait_for_function("wGF.play.thrown || !!wGF.play.done", timeout=4000)
        th = await pg.evaluate("({ thrown: wGF.play.thrown, ev: wGF.play.ev.filter(x => x.k === 'throw').length })")
        check('Space' in note and th['thrown'] and th['ev'] == 1, 'in the Realm: Space held and let go throws the pass, and the bar says how', [note, th])

        # a field goal on the meter: two taps, and the kick waits for them (a minute for the next call: on a busy machine,
        # with other checks beside it, the play and the pause after it can take a while)
        await pg.wait_for_function("wGF.phase === 'call'", timeout=60000)
        await pg.evaluate("(() => { const G = wGF.G; G.ball = 75; G.down = 4; G.togo = 5; wGridBar(); })()")
        await pg.click('[data-gkick="fg"]')
        await pg.wait_for_function("wGF.phase === 'kick' && !!wGF.meter", timeout=4000)
        await pg.wait_for_timeout(900)
        still = await pg.evaluate("wGF.phase")
        # set the power near the top of its swing (it rises over .65 s), then the aim when it crosses the middle
        # (the field is paused at the moment, so a slow key press can't miss it: the meter only moves while it runs)
        await pg.wait_for_function("wGF.meter && wGF.meter.st === 0 && wGF.meter.now > .9 && (wGF.pause(true), true)", timeout=4000, polling=10)
        await pg.keyboard.press(' '); await pg.evaluate("wGF.pause(false)")
        await pg.wait_for_function("wGF.meter && wGF.meter.st === 1 && Math.abs(wGF.meter.now) < .05 && (wGF.pause(true), true)", timeout=4000, polling=10)
        await pg.screenshot(path='/tmp/realm-gridiron-play-meter.png')
        await pg.keyboard.press(' '); await pg.evaluate("wGF.pause(false)")
        await pg.wait_for_function("wGF.phase === 'post' || wGF.phase === 'over'", timeout=4000)
        k = await pg.evaluate("({ end: wGF.G.drive.end, why: wGF.why })")
        check(still == 'kick' and k['end'] == 'fg' and 'Power' in k['why'], 'a field goal on the meter: it waits for both taps, and strong and straight is good from 42 yards', [still, k])

        h = await pg.evaluate("(() => { renderHelp(); return document.getElementById('wHelpGridiron').textContent + ' ' + document.getElementById('wGridHow').textContent; })()")
        check('stiff-arm' in h and 'You play' in h and 'tap Space' in h.replace('Tap', 'tap'), 'How to play and How it works explain playing it by hand', h[-300:])
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
