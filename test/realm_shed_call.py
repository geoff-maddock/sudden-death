# Realm shed (issue #102, phase 4): the call and the read.
# The game in the end's value: before the last end a single with the hammer is worth less than a blank that keeps it;
# in the last end, tied with the hammer, a single wins (worth far more than a blank), and two down a single is a loss.
# The reason: the skip says why (they have shot stone, a centre guard without the hammer, a corner guard with it, a
# single to win it). In the last end, tied, with the hammer and the last stone and an empty house, a Knight draws for the
# single. An Archmage looks a stone ahead (its plan plays the other rink's reply) and beats a Knight. The ice chart:
# drawn on a canvas, the pebble's wear and every stone's path this game (the page keeps them), hatched past what the
# skip reads (a reader of 12 sees further back than a reader of 1); C or the Ice chart button opens it in a box, and the
# rows say the skip's reason; How to play explains the call and the chart. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

TEAM = r"""window.__team = (ks, r) => ({ name: ks.join(''), short: 'T', roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, r ? { r: Object.assign(wCR.rate(k), r) } : {})) });
window.__to = (ph, max) => { let n = 0; while (wCR.phase !== ph && n++ < (max || 20000)) wCR.tick(0.05); return wCR.phase === ph; }; 0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(TEAM)

        # ---------- the game in the end's value ----------
        v = await pg.evaluate("""(() => { const D = __team(['dwarf', 'dwarf', 'dwarf', 'dwarf']); wCR.start({ seed: 1, ends: 6, teams: [D, D] }); const G = wCR.G;
          const early = { single: wCR.endValue(1, 1, 0, 1), blank: wCR.endValue(1, 0, 1, 1) };
          G.end = 5; G.sc = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; const tied = { single: wCR.endValue(1, 1, 0, 1), blank: wCR.endValue(1, 0, 1, 1) };
          G.sc = [[2, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; const down2 = { single: wCR.endValue(1, 1, 0, 1), two: wCR.endValue(1, 2, 0, 1), three: wCR.endValue(1, 3, 0, 1) };
          return { early, tied, down2 }; })()""")
        check(v['early']['blank'] > v['early']['single'], 'before the last end, a blank that keeps the hammer is worth more than a single that gives it up', v['early'])
        check(v['tied']['single'] > v['tied']['blank'] + 2, 'in the last end, tied with the hammer, a single wins: worth far more than a blank', v['tied'])
        check(v['down2']['single'] < 0 and v['down2']['two'] < v['down2']['three'] and v['down2']['three'] > 0, 'two down in the last end, a single loses (and two only ties)', v['down2'])

        # ---------- the reason, and the last stone ----------
        r = await pg.evaluate("""(() => { const D = __team(['dwarf', 'dwarf', 'dwarf', 'dwarf']); wCR.start({ seed: 2, ends: 6, teams: [D, D] }); const G = wCR.G, out = {};
          G.stones = [{ id: '0:0', s: 0, x: 3, y: 4 }]; out.take = wCR.reason(1, { shot: 'takeout', target: '0:0' });
          G.hammer = 0; out.cguard = wCR.reason(1, { shot: 'guard', x: 0, y: -190 }); G.hammer = 1; out.kguard = wCR.reason(1, { shot: 'guard', x: 50, y: -180 }); out.hcguard = wCR.reason(1, { shot: 'guard', x: 0, y: -190 });
          out.voice = ['takeout', 'peel', 'hitroll', 'freeze', 'guard', 'draw'].map(k => wCR.reason(1, { shot: k, x: 0, y: 0, target: '0:0' })).filter(t => /\byou\b|\btheirs?\b/.test(t));
          // the last end, tied, the hammer, the last stone, an empty house
          G.end = 5; G.sc = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; G.k = 15; G.hammer = 1; G.stones = [];
          const P = wCR.plan(1); out.last = { shot: P.shot, reason: P.reason, inHouse: wCR.inHouse({ x: P.x, y: P.y }) };
          return out; })()""")
        check('shot stone' in r['take'] and 'steal' in r['cguard'] and 'two' in r['kguard'] and 'centre' in r['hcguard'], 'the skip says why: the other rink lies shot; a centre guard to steal; a corner guard to set up two (a guard\'s reason says where it is)', r)
        check(r['voice'] == [], 'every reason is worded for either rink (no "you" or "theirs"), so it reads right on the CPU\'s stones too', r['voice'])
        check(r['last']['shot'] == 'draw' and r['last']['inHouse'] and 'wins' in r['last']['reason'], 'the last end, tied, with the hammer and the last stone into an empty house: the skip draws for the single that wins it', r['last'])
        a = await pg.evaluate("""(() => { const T = __team(['dwarf', 'gorgon', 'wraith', 'vampire']); let w = 0; const n = 14;
          for (let i = 0; i < n; i++) if (wCR.simGame({ seed: 700 + i, ends: 4, skill: [2, 1], hammer: i % 2, teams: [T, T] }).win === 0) w++; return w / n; })()""")
        check(a > .5, 'an Archmage, looking a stone ahead, beats a Knight', a)

        # ---------- the ice chart ----------
        c = await pg.evaluate("""(() => { const out = {};
          wCR.start({ seed: 3, ends: 4, mode: 'watch', teams: [__team(['dwarf', 'dwarf', 'dwarf', 'dwarf'], { red: 12 }), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'], { red: 1 })] }); wCR.pause(true);
          let n = 0; while (wCR.G.n < 6 && n++ < 20000) wCR.tick(.05); __to('next');
          out.paths = wCR.paths; out.read = [wCR.readIn(0), wCR.readIn(1)]; out.sheet = wCR.sheet;
          const cv = document.createElement('canvas'); cv.width = 600; cv.height = 220; out.drawn = wCR.chart(cv, 1);
          const d = cv.getContext('2d').getImageData(0, 0, 600, 220).data; const cols = new Set(); for (let i = 0; i < d.length; i += 4 * 97) cols.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); out.colours = cols.size;
          return out; })()""")
        check(c['paths'] >= 6 and c['drawn'] and c['colours'] > 8, 'the ice chart draws the pebble\'s wear and every stone\'s path this game', c)
        check(c['read'][0] > c['read'][1] + 100 and c['read'][0] >= c['sheet']['hog'] - 1 and c['read'][1] >= c['sheet']['houseR'], 'a skip who reads the ice well sees to the hog line, one who doesn\'t still sees the whole house', c['read'])

        # ---------- in the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(TEAM)
        m = await pg.evaluate("""(() => { W_SHED_MODE = 'play'; wShedGame({ seed: 5, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); wShedRows();
          return { why: (document.querySelector('#wShedShot .wshedwhy') || {}).textContent || '', btn: !!document.querySelector('#wShedGo [data-cchart]') }; })()""")
        check(m['why'].startswith('Your skip:') and m['btn'], 'your stone\'s rows say the skip\'s reason, and have an Ice chart button', m)
        rs = await pg.evaluate("(() => { const s0 = wCR.view.sel.shot; wCR.select({ shot: s0 === 'guard' ? 'draw' : 'guard' }); wShedRows(); return { reason: wCR.view.sel.reason, shown: !!document.querySelector('#wShedShot .wshedwhy') }; })()")
        check(rs == {'reason': '', 'shown': False}, 'a call you change is yours: the skip\'s reason goes', rs)
        await pg.evaluate("wCR.pause(false)")
        await pg.keyboard.press('c')
        await pg.wait_for_selector('#modalBox #wShedChartCv')
        held = await pg.evaluate("wCR.paused")
        await pg.click('#modalBox [data-close]')
        after = await pg.evaluate("wCR.paused")
        check(held and not after, 'C opens the ice chart in a box; the game waits while it is open', [held, after])
        wt = await pg.evaluate("(async () => { $('wShedModes').querySelector('[data-cmode=\"watch\"]').click(); wCR.pause(false); await new Promise(r => setTimeout(r, 50)); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true })); await new Promise(r => setTimeout(r, 50)); const open = !!document.getElementById('wShedChartCv'); const b = document.querySelector('#modalBox [data-close]'); if (b) b.click(); return { open, btn: !!document.getElementById('wShedChartBtn') }; })()")
        check(wt == {'open': True, 'btn': True}, 'in Watch, C opens the ice chart too, and an Ice chart button sits beside How to play', wt)
        await pg.evaluate("wCR.pause(true); showPage('help')")
        hp = await pg.evaluate("['The skip\\'s call.', 'The ice chart'].every(w => (document.getElementById('wShedHow') || {}).textContent.includes(w))")
        check(hp, 'How to play explains the skip\'s call and the ice chart', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
