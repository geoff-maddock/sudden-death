"""Your following (issue #79, phase 1): fans are steps (25, 100, 300, 750), read from RUN.fans. Reaching a step is
logged (and noted in the journal the first time); falling and climbing back is logged again; the Team screen shows
where you stand and what each step gives; How to play explains it."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright
FAILS = []
def check(ok, what, got=None):
    if not ok:
        FAILS.append(what); print('FAIL', what + ':', str(got)[:500])
    else:
        print('ok', what)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={'width': 1200, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wFollowStep === 'function'"); await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo'); await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        s = await pg.evaluate("""(() => { const at = n => { RUN.fans = n; return wFollowStep(); };
          return { steps: [0, 24, 25, 99, 100, 299, 300, 749, 750, 5000].map(at), names: W_FOLLOW.names.length, at: W_FOLLOW.at, off: (() => { W_FOLLOW.off = true; const r = at(999); W_FOLLOW.off = false; return r; })() }; })()""")
        check(s['steps'] == [0, 0, 1, 1, 2, 2, 3, 3, 4, 4] and s['names'] == 5 and s['at'] == [25, 100, 300, 750] and s['off'] == 0, 'the steps are read from your fans: 25, 100, 300 and 750', s)

        a = await pg.evaluate("""(() => { const logs = () => WLOG.map(l => l[0]), wins = () => wJ().wins.filter(e => e.k === 'fans').map(e => e.t);
          RUN.fans = 0; WG.follow = null; wSave(); const n0 = logs().length;
          RUN.fans = 30; wSave(); const one = logs().slice(n0), j1 = wins();
          wSave(); const quiet = logs().length - n0 - one.length;
          RUN.fans = 320; wSave(); const two = logs().slice(n0 + one.length), j2 = wins();
          RUN.fans = 20; wSave(); const fell = { seen: WG.follow.seen, top: WG.follow.top, n: logs().length };
          RUN.fans = 110; wSave(); const back = logs().slice(fell.n), j3 = wins();
          return { one, quiet, two, fell, back, j1, j2, j3, plain: JSON.stringify(WG.follow) }; })()""")
        check(len(a['one']) == 1 and 'regulars' in a['one'][0] and '30 fans' in a['one'][0] and a['quiet'] == 0 and a['j1'] == ['A few regulars: 25 fans'], 'reaching a step is logged once, and noted in the journal', a)
        check(len(a['two']) == 2 and "supporters' club" in a['two'][0] and 'travelling army' in a['two'][1] and len(a['j2']) == 3, 'two steps at once are both announced', a)
        check(a['fell'] == {'seen': 0, 'top': 3, 'n': a['fell']['n']} and len(a['back']) == 2 and len(a['j3']) == 3 and a['plain'] == '{"seen":2,"top":3}', 'fall and climb back: logged again, the journal not written twice; plain data', a)

        t = await pg.evaluate("""(() => { RUN.fans = 130; const h = wCampTeam(), d = document.createElement('div'); d.innerHTML = h;
          const rows = [...d.querySelectorAll('.wfollow li')]; return { now: d.querySelector('#wFollowNow').textContent, rows: rows.length, have: rows.filter(r => r.classList.contains('wfhave')).length,
            before: h.indexOf('Your following') >= 0 && h.indexOf('Your following') < h.indexOf('<h4>Your name</h4>'), first: rows[0].textContent }; })()""")
        check("A supporters' club: 130 fans, 170 more for a travelling army" in t['now'] and t['rows'] == 4 and t['have'] == 2 and t['before'] and 'The gate' in t['first'], 'the Team screen shows your following, what the next step needs and what each gives', t)
        bar = await pg.evaluate("(() => { wDrain(); const e = document.querySelector('.wfans'); return e ? [e.title, e.textContent] : null; })()")
        check(bar and 'following' in bar[0] and '130' in bar[1], 'the top bar says fans are your following', bar)
        hp = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpFollow'); return h ? h.textContent : ''; })()")
        check('Your following.' in hp and 'at 25 a few regulars' in hp and 'household name' in hp and 'counted separately' in hp, 'How to play explains the following', hp)
        lab = await pg.evaluate("(() => { const n = WLOG.length; WG.follow = null; RUN.fans = 800; LAB = true; let r; try { r = wFollowCheck(); } finally { LAB = false; } return [r, WLOG.length - n]; })()")
        check(lab == [False, 0], 'nothing is announced in LAB mode', lab)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
