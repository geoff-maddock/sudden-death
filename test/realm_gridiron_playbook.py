# Realm gridiron playbook (issue #9, phase 4): plays tire with use and recover (question 4). Calling a play costs
# freshness and the others rest; the half freshens everything. A stale call is one the other side sees coming: a
# stale play gains less, and a stale defense gives up more. The coaches' counter-calls: they lean to what beats the
# other side's recent calls, and away from their own tired ones. In the Realm: each call button shows how fresh it is,
# the panel says what their coach has seen of your calls, and How it works explains it. Asserts; exits nonzero on
# failure. Screenshot: /tmp/realm-gridiron-playbook.png.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGF !== 'undefined'")

        # ---------- tiring and resting ----------
        t = await pg.evaluate("""(() => { const out = {};
          wGF.start({ seed: 1 }); out.start = wGF.fresh(0);
          // a whole game headless: everyone's calls tire and rest; nothing goes below 0 or above 1
          wGF.simGame({ seed: 3 }); const G = wGF.G; out.range = G.fresh.every(F => ['off', 'def'].every(k => Object.values(F[k]).every(v => v >= 0 && v <= 1)));
          out.json = JSON.stringify(JSON.parse(JSON.stringify(G.fresh))) === JSON.stringify(G.fresh) && Array.isArray(G.seen);
          return out; })()""")
        st = t['start']
        check(all(v == 1 for v in st['off'].values()) and all(v == 1 for v in st['def'].values()) and t['range'] and t['json'],
              'every play and defense starts fresh, stays between 0 and 1 through a game, and the playbook is plain JSON', t)
        h = await pg.evaluate("""(() => { const s = wGF.simGame({ seed: 11 }); const G = wGF.G;
          // after the game, every side has seen calls, and the halftime rest leaves no play untouched for long
          return { seen: G.seen.map(x => x.length), half: s.half }; })()""")
        check(all(n > 0 for n in h['seen']), "each coach sees the other side's calls through the game", h)

        # ---------- a stale call is one they see coming ----------
        s = await pg.evaluate("""(() => { const avg = (oc, dc, st) => { let g = 0; for (let i = 0; i < 200; i++) g += wGF.down(oc, dc, { seed: 1000 + i, st }).gain / 200; return +g.toFixed(1); };
          const out = {}; for (const [oc, dc] of [['run', 'zone'], ['short', 'man'], ['deep', 'man'], ['screen', 'blitz']]) out[oc + '/' + dc] = { fresh: avg(oc, dc), stale: avg(oc, dc, { read: 1 }), read: avg(oc, dc, { tell: 1 }) };
          return out; })()""")
        print('     stale:', s)
        check(all(v['stale'] < v['fresh'] for v in s.values()) and sum(v['fresh'] - v['stale'] for v in s.values()) / len(s) > 2,
              'a stale play gains less: the defense sees it coming (2+ yards a play on average)', s)
        check(all(v['read'] > v['fresh'] for v in s.values()), 'a stale defense gives up more: the offense reads it', s)

        # ---------- the coaches' counter-calls ----------
        k = await pg.evaluate("""(() => { const share = (fn, n) => { const c = {}; for (let i = 0; i < n; i++) { const x = fn(); c[x] = (c[x] || 0) + 1 / n; } return c; };
          wGF.start({ seed: 5 }); const G = wGF.G; const base = share(wGF.cpu.def, 600);
          // an offense that keeps throwing deep: the defense leans to the blitz
          G.seen[0] = Array.from({ length: 8 }, () => ({ oc: 'deep' })); const vsDeep = share(wGF.cpu.def, 600);
          // an offense that keeps running: the deep zone goes out of favour
          G.seen[0] = Array.from({ length: 8 }, () => ({ oc: 'run' })); const vsRun = share(wGF.cpu.def, 600);
          // a defense that keeps blitzing: the offense leans to the screen
          G.seen[0] = []; G.seen[1] = Array.from({ length: 8 }, () => ({ dc: 'blitz' })); const offBase = (() => { G.seen[1] = []; return share(wGF.cpu.off, 600); })();
          G.seen[1] = Array.from({ length: 8 }, () => ({ dc: 'blitz' })); const vsBlitz = share(wGF.cpu.off, 600);
          // a tired call is called less
          G.seen[1] = []; G.fresh[0].off.short = 0; const tired = share(wGF.cpu.off, 600);
          return { base, vsDeep, vsRun, offBase, vsBlitz, tired }; })()""")
        print('     counter:', {x: {a: round(b, 2) for a, b in y.items()} for x, y in k.items()})
        check(k['vsDeep'].get('blitz', 0) > k['base'].get('blitz', 0) + .15, 'against an offense that keeps throwing deep, their coach blitzes more', k)
        check(k['vsRun'].get('zone', 0) < k['base'].get('zone', 0) - .1, 'against an offense that keeps running, their coach drops the deep zone', k)
        check(k['vsBlitz'].get('screen', 0) > k['offBase'].get('screen', 0) + .1, 'against a defense that keeps blitzing, the offense calls the screen more', k)
        check(k['tired'].get('short', 0) < k['offBase'].get('short', 0) * .5, 'a tired play is called much less', k)

        # ---------- the coaches' games still play like football ----------
        g = await pg.evaluate("""(() => { let w = 0, l = 0, pts = 0; for (let i = 0; i < 150; i++) { const s = wGF.simGame({ seed: i + 1 }); if (s.score[0] > s.score[1]) w++; else if (s.score[0] < s.score[1]) l++; pts += (s.score[0] + s.score[1]) / 150; } return { w, l, pts }; })()""")
        check(.3 <= g['w'] / 150 <= .7 and 12 <= g['pts'] <= 45, "with the playbook in, the coaches' games stay near even and score like football", g)

        # ---------- in the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wGridironDrive({ mode: 'call', seed: 9 })")
        await pg.wait_for_function("wGF.phase === 'call'", timeout=10000)
        f0 = await pg.evaluate("({ fresh: wGF.fresh(0).off.run, word: document.querySelector('[data-gcall=\"run\"]').dataset.fresh })")
        # call the run twice: it tires (worn, then tired), the bar shows it, and the coach has seen it
        for _ in range(2):
            await pg.wait_for_function("wGF.phase === 'call' || wGF.phase === 'over'", timeout=30000)
            if await pg.evaluate("wGF.phase === 'over'"): break
            await pg.click('[data-gcall="run"]')
            await pg.wait_for_function("wGF.phase === 'live'", timeout=8000)
        await pg.wait_for_function("wGF.phase === 'call' || wGF.phase === 'over'", timeout=30000)
        f1 = await pg.evaluate("""({ fresh: wGF.fresh(0).off.run, short: wGF.fresh(0).off.short, word: document.querySelector('[data-gcall="run"]').dataset.fresh,
          title: document.querySelector('[data-gcall="run"]').title, seen: document.getElementById('wGridSeen').textContent, ph: wGF.phase })""")
        await pg.screenshot(path='/tmp/realm-gridiron-playbook.png')
        check(f0['fresh'] == 1 and f0['word'] == '' and abs(f1['fresh'] - .2) < 1e-9 and f1['short'] == 1 and f1['word'] == 'tired' and 'Fresh: 20%' in f1['title'],
              'two runs in a row: the run tires to 20%, the button says tired, and the others stay fresh', [f0, f1])
        check(f1['ph'] == 'over' or ('Run 100%' in f1['seen'] and 'beat it' in f1['seen']), 'the panel says what their coach has seen of your calls', f1)
        hw = await pg.evaluate("(renderHelp(), document.getElementById('wGridHow').textContent)")
        check('Plays tire' in hw and 'they see coming' in hw, 'How it works explains tiring plays and the counter-calls', hw[-500:])
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
