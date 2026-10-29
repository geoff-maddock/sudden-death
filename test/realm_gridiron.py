# Realm gridiron (issue #9, phase 1): Cinder Gridiron plays one drive, seven a side, CPU against CPU or with your calls.
# The drive: from the 25 to a touchdown, a field goal, a punt, a turnover or a safety, through the same flow on the field
# and headless (a seeded drive plays the same twice). The calls settle nothing themselves; the field does, and the
# spec's matchups come out of it over 200 seeded downs each: the blitz beats the deep pass, the screen beats the blitz,
# and the deep zone gives up short runs. In the Realm: Clinker Dunn at the Ash Bowl puts on a DRIVE; it plays in its own
# view behind W_ENGINES, with a bar to call the plays (only when it's your call), and leaving it parks the engine.
# None of the engine's names reach the page. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-gridiron-*.png.
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

        # ---------- the scope ----------
        leaks = await pg.evaluate("['gfSnap', 'gfStep', 'gfTick', 'gfStart', 'gfSim', 'GF_PLAYS', 'GF_DEFS', 'GFP', 'GD', 'GFT', 'gfDraw', 'GF_KIND'].filter(n => (0, eval)('typeof ' + n) !== 'undefined')")
        check(not leaks, 'none of the gridiron\'s names reach the page', leaks)

        # ---------- headless drives ----------
        d = await pg.evaluate("""(() => { const ends = {}; let plays = 0, bad = 0; const t0 = performance.now();
          for (let i = 0; i < 300; i++) { const s = wGF.sim({ seed: i + 1 }); ends[s.end] = (ends[s.end] || 0) + 1; plays += s.plays;
            if (!s.log.length || s.log.some(p => !p.what)) bad++; }
          const a = wGF.sim({ seed: 42 }), b = wGF.sim({ seed: 42 });
          return { ends, plays: plays / 300, bad, ms: (performance.now() - t0) / 302, same: JSON.stringify(a) === JSON.stringify(b) }; })()""")
        known = {'td', 'fg', 'miss', 'punt', 'downs', 'int', 'safety'}
        check(set(d['ends']) <= known and not d['bad'], 'every drive ends in a touchdown, a kick, a punt, a turnover or a safety, and logs every play', d)
        td = d['ends'].get('td', 0) / 300
        check(.1 <= td <= .4 and d['ends'].get('punt', 0) / 300 <= .7 and 3 <= d['plays'] <= 12, 'drives play like football: 10% to 40% end in a touchdown, at most 70% in a punt, 3 to 12 plays', d)
        check(d['same'] and d['ms'] < 50, 'a seeded drive plays the same twice, and a headless drive takes well under 50 ms', d)

        # ---------- the matchups ----------
        m = await pg.evaluate("""(() => { const avg = (oc, dc) => { let g = 0; for (let i = 0; i < 200; i++) g += wGF.down(oc, dc, { seed: 1000 + i }).gain; return g / 200; };
          const M = {}; for (const oc of Object.keys(wGF.plays)) for (const dc of Object.keys(wGF.defs)) M[oc + '/' + dc] = +avg(oc, dc).toFixed(1);
          return M; })()""")
        print('     yards a play:', m)
        check(m['deep/blitz'] < m['deep/man'] - 3 and m['deep/blitz'] < m['deep/zone'] - 3, 'the blitz beats the deep pass', m)
        check(m['screen/blitz'] > m['screen/man'] + 3 and m['screen/blitz'] > m['screen/zone'] + 3, 'the screen beats the blitz', m)
        check(m['run/zone'] > m['run/man'] + 1.5 and m['run/zone'] > m['run/blitz'] + 1.5, 'the deep zone gives up short runs', m)
        check(all(-6 < v < 18 for v in m.values()), 'no call gains or loses a silly amount against any defense', m)

        # ---------- in the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        k = await pg.evaluate("""(() => { const K = DB.chars.gk_bowl, r = wSay('gk_bowl', 'drive');
          return { job: K.topics.job.t.includes('DRIVE'), act: r.act, reg: W_ENGINES.gridiron && W_ENGINES.gridiron.api === wGF && W_ENGINES.gridiron.sport }; })()""")
        check(k == {'job': True, 'act': 'drive', 'reg': 'football'}, 'Clinker Dunn puts on a DRIVE, and the gridiron is in W_ENGINES for football', k)
        await pg.evaluate("(() => { const r = wSay('gk_bowl', 'drive'); wRunAct(r.act, 'gk_bowl'); })()")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.on && wGF.phase === 'live'", timeout=15000)
        v = await pg.evaluate("""({ bar: !document.getElementById('wGridBar').hidden, field: !document.getElementById('v-gridiron').hidden, world: document.getElementById('v-world').hidden,
          calls: document.getElementById('wGridCalls').hidden, teams: wGF.G.teams.map(t => t.name), side: wGF.G.teams[0].roster.length })""")
        check(v['bar'] and v['field'] and v['world'] and v['calls'] and v['side'] == 7 and v['teams'][0] == 'Cinderhold Football Club',
              'the drive plays in its own view: the Cinderhold Football Club, seven a side, the coaches calling it', v)
        await pg.wait_for_timeout(700)
        await pg.screenshot(path='/tmp/realm-gridiron-live.png')

        # your calls: the buttons work only when it's your call, and the play goes in as called
        await pg.click('#wGridMode')
        await pg.wait_for_function("wGF.phase === 'call'")
        c = await pg.evaluate("""(() => { const b = [...document.querySelectorAll('[data-gcall]')];
          return { shown: !document.getElementById('wGridCalls').hidden, enabled: b.every(x => !x.disabled), n: b.length, note: document.getElementById('wGridNote').textContent }; })()""")
        check(c['shown'] and c['enabled'] and c['n'] == 4 and 'Your call' in c['note'], 'Call the plays: four calls on the bar, open when it is your call', c)
        await pg.wait_for_timeout(600)
        still = await pg.evaluate("wGF.phase")
        await pg.click('[data-gcall="screen"]')
        await pg.wait_for_function("wGF.phase === 'live'", timeout=8000)
        e = await pg.evaluate("({ oc: wGF.play.oc, off: [...document.querySelectorAll('[data-gcall]')].every(x => x.disabled) })")
        check(still == 'call' and e == {'oc': 'screen', 'off': True}, 'the drive waits for your call, then runs the play you called (and the buttons close)', [still, e])
        await pg.screenshot(path='/tmp/realm-gridiron-call.png')

        # back to the world: the engine is parked
        await pg.click('#wGridBack')
        b = await pg.evaluate("({ view: UI.view, on: wGF.on, bar: document.getElementById('wGridBar').hidden, field: document.getElementById('v-gridiron').hidden })")
        check(b == {'view': 'world', 'on': False, 'bar': True, 'field': True}, 'Back to the world parks the gridiron', b)
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpGridiron'); return e ? e.textContent : ''; })()")
        check('Clinker Dunn' in h and 'DRIVE' in h, 'How to play says where to see a drive', h)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
