# The daily's shared board (issue #60, phase 5), on a stand-in for the claude.ai runtime (test/daily_fake_runtime.js).
# Asserts: other players' results on today's board, best first, with names; a daily finished goes on the board in its
# place, as you, written to your own document only, and old days pruned from it; yesterday's board; a viewer who can't
# write sees the board without a place on it; a board that can't be reached says so; and off the runtime (a saved
# copy, signed out) there is no board and the Daily page works as before. Exits non-zero on any failure.
import asyncio, subprocess, sys, os, json
from paths import ROOT, GAME_URL, GAME_BUILD
from playwright.async_api import async_playwright

subprocess.run(GAME_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
FAKE = open(os.path.join(ROOT, 'test', 'daily_fake_runtime.js')).read()
fails = []
def check(ok, what, info=''):
    print(('ok   ' if ok else 'FAIL ') + what + (f'  {json.dumps(info)[:500]}' if not ok and info != '' else ''))
    if not ok: fails.append(what)

SEED = """(() => { const k = dayKey(), y = dayBefore(k), f = 'sd_' + k.replace(/-/g, ''), fy = 'sd_' + y.replace(/-/g, '');
  __FAKE.seed('u_ada', { v: 1, [f]: 900, [fy]: 120, sd: { [k]: { st: 'win', score: 900, act: 2, floor: 15 }, [y]: { st: 'lose', score: 120, act: 0, floor: 4 } } });
  __FAKE.seed('u_bo', { v: 1, [f]: 40, sd: { [k]: { st: 'lose', score: 40, act: 0, floor: 2 } } });
  for (let i = 0; i < 12; i++) __FAKE.seed('u_x' + i, { v: 1, [f]: 500 + i, sd: { [k]: { st: 'lose', score: 500 + i, act: 1, floor: 9 } } }); })()"""
ROWS = """(() => [...document.querySelectorAll('[data-board]')].map(b => ({ title: b.querySelector('.dbh').textContent, ro: !!b.querySelector('[data-bro]'),
  text: b.textContent, rows: [...b.querySelectorAll('li')].map(li => ({ n: li.querySelector('.dbn').textContent, r: li.querySelector('.dbr').textContent, me: li.classList.contains('dbme'), pos: li.value })) })))()"""

async def page(b, cfg=None, fake=True):
    pg = await b.new_page(viewport={'width': 1200, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if fake:
        await pg.add_init_script('window.__FAKE_CFG = ' + json.dumps(cfg or {}) + ';\n' + FAKE)
    await pg.goto(GAME_URL)
    await pg.wait_for_function('typeof renderDaily === "function" && UI.screen === "title"')
    await pg.evaluate('localStorage.clear()')
    return pg, errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        names = {'u_me': 'Me', 'u_ada': 'Ada', 'u_bo': 'Bo'}
        pg, errs = await page(b, {'names': names})
        await pg.wait_for_function("BOARD.st === 'on'")
        await pg.evaluate(SEED)

        # ---------- other players' results ----------
        await pg.evaluate("showPage('daily')")
        await pg.wait_for_function("document.querySelectorAll('[data-board] li').length > 0 && ![...document.querySelectorAll('[data-bname]')].some(e => e.textContent === '…')")
        B = await pg.evaluate(ROWS)
        check([x['title'] for x in B] == ['Today’s board', 'Yesterday’s board'], "the Daily page has today's board and yesterday's", B)
        t = B[0]['rows']
        check(len(t) == 10 and t[0]['n'] == 'Ada' and 'Won the Cup: 900 points' in t[0]['r'] and t[1]['r'].endswith('511 points'), "today's board: the top ten, best first, with what each did", t)
        check(all(r['n'] == 'Someone' for r in t[1:]) and '14 on the board' in B[0]['text'], 'a player with no name to show is Someone, and the count is given', B[0]['text'][-80:])
        check(B[1]['rows'] and B[1]['rows'][0]['n'] == 'Ada' and 'Lost in act 1, floor 5: 120 points' in B[1]['rows'][0]['r'], "yesterday's board", B[1]['rows'])

        # ---------- your daily on the board ----------
        r = await pg.evaluate("""(async () => {
          const k = dayKey(), old = (() => { const d = dayDate(k); d.setDate(d.getDate() - 40); return dayKey(d); })();
          __FAKE.docs['boards/u_me'] = { v: 1, ['sd_' + old.replace(/-/g, '')]: 5, sd: { [old]: { st: 'lose', score: 5 } } };
          dailyStart(k); RUN.stats.fights = 9; RUN.act = 1; RUN.floor = 6;
          const want = runScore(RUN); recordRun('lose'); await BOARD.busy; await new Promise(r => setTimeout(r, 50));
          const d = __FAKE.docs['boards/u_me'] || {}, f = 'sd_' + k.replace(/-/g, '');
          return { want, rank: d[f], shown: (d.sd || {})[k], old: Object.keys(d).filter(x => x.startsWith('sd_')).length, oldShown: Object.keys(d.sd || {}), others: Object.keys(__FAKE.docs).length, writes: __FAKE.writes };
        })()""")
        check(r['rank'] == r['want'] and r['shown'] and r['shown']['st'] == 'lose' and r['shown']['act'] == 1, 'a finished daily goes on the board with its score', r)
        check(r['old'] == 1 and len(r['oldShown']) == 1, 'days older than a month are pruned from your document', r)
        check(r['writes'] == 1, 'one write, to your own document', r)
        await pg.evaluate("showPage('daily')")
        await pg.wait_for_function("document.querySelector('[data-board] .dbme')")
        B = await pg.evaluate(ROWS)
        me = [x for x in B[0]['rows'] if x['me']]
        check(me and me[0]['n'] == 'You', "you are on today's board, marked", B[0]['rows'])
        # someone else posting shows up live
        await pg.evaluate("""__FAKE.seed('u_bo', { v: 1, ['sd_' + dayKey().replace(/-/g, '')]: 5000, sd: { [dayKey()]: { st: 'win', score: 5000, act: 2, floor: 15 } } })""")
        await pg.wait_for_function("(document.querySelector('[data-board] li .dbr') || {}).textContent === 'Won the Cup: 5000 points'")
        n = await pg.evaluate("document.querySelector('[data-board] li .dbn').textContent")
        check(n == 'Bo', 'a result posted by someone else comes in live', n)
        n = await pg.evaluate("(() => { boardRedraw(); return [...document.querySelectorAll('[data-board] .dbn')].map(e => e.textContent).filter(t => t === '…').length; })()")
        check(n == 0, 'a redraw keeps the names already resolved (no flicker)', n)
        # the first result stands: playing again (another profile, device or a cleared record) doesn't replace it
        r = await pg.evaluate("""(async () => { const k = dayKey(), f = 'sd_' + k.replace(/-/g, ''), before = __FAKE.docs['boards/u_me'][f], w = __FAKE.writes;
          boardPost('sd', k, 99999, { st: 'win', score: 99999, act: 2, floor: 15 }); await BOARD.busy;
          return { before, after: __FAKE.docs['boards/u_me'][f], writes: __FAKE.writes - w }; })()""")
        check(r['after'] == r['before'] and r['writes'] == 0, "a day's first result stands", r)
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('helpBoard'); return e ? e.textContent : ''; })()")
        check('board' in h and 'claude.ai' in h, 'How to play explains the board', h)
        check(not errs, 'no page errors', errs[:3])
        await pg.close()

        # ---------- a forfeit goes on the board; a result that never landed goes on at the next load ----------
        pg, errs = await page(b, {'names': names})
        await pg.wait_for_function("BOARD.st === 'on'")
        r = await pg.evaluate("""(async () => { const k = dayKey(); dailyStart(k); RUN.act = 1; RUN.floor = 3; recordRun('quit'); await BOARD.busy;
          const d = __FAKE.docs['boards/u_me'] || {}; return { shown: (d.sd || {})[k] || null, text: BOARD.fmt.sd((d.sd || {})[k] || {}) }; })()""")
        check(r['shown'] and r['shown']['st'] == 'quit' and r['text'].startswith('Forfeited in act 2, floor 4'), 'a forfeited daily goes on the board, as a forfeit', r)
        r = await pg.evaluate("""(async () => { const y = dayBefore(dayKey()), old = (() => { const d = dayDate(dayKey()); d.setDate(d.getDate() - 45); return dayKey(d); })();
          const R = loadDaily(); R.days[y] = { st: 'win', score: 777, act: 2, floor: 15, sw: 3 }; R.days[old] = { st: 'win', score: 5, act: 2, floor: 15 }; saveDaily(R);
          BOARD.st = 'off'; boardInit(); await new Promise(r => setTimeout(r, 150)); await BOARD.busy;
          const d = __FAKE.docs['boards/u_me'] || {}; return { y: d['sd_' + y.replace(/-/g, '')], old: d['sd_' + old.replace(/-/g, '')] ?? null }; })()""")
        check(r['y'] == 777 and r['old'] is None, 'a finished day in the record but not on the board goes on at the next load (the last month only)', r)
        # your place below the rows fetched
        r = await pg.evaluate("""(async () => { const k = dayKey(), f = 'sd_' + k.replace(/-/g, '');
          for (let i = 0; i < 5; i++) __FAKE.seed('u_top' + i, { v: 1, [f]: 90000 + i, sd: { [k]: { st: 'win', score: 90000 + i, act: 2, floor: 15 } } });
          BOARD_CFG.fetch = 3; BOARD_CFG.top = 2; showPage('daily'); await new Promise(r => setTimeout(r, 200));
          const b = document.querySelector('[data-board]'); return { rows: [...b.querySelectorAll('li')].map(li => [li.querySelector('.dbp').textContent, li.querySelector('.dbn').textContent]), text: b.textContent }; })()""")
        check(r['rows'][-1] == ['3+', 'You'] and 'More than 3 on the board' in r['text'], 'your result below the rows fetched still shows, and the count says there are more', r)
        check(not errs, 'no page errors (forfeit, catch-up)', errs[:3])
        await pg.close()

        # ---------- a viewer who can't write ----------
        pg, errs = await page(b, {'canWrite': False, 'names': names})
        await pg.wait_for_function("BOARD.st === 'ro'")
        await pg.evaluate(SEED)
        await pg.evaluate("(async () => { dailyStart(dayKey()); recordRun('lose'); await BOARD.busy; })()")
        await pg.evaluate("showPage('daily')")
        await pg.wait_for_function("document.querySelectorAll('[data-board] li').length > 0")
        B = await pg.evaluate(ROWS)
        w = await pg.evaluate("__FAKE.writes")
        check(w == 0 and B[0]['ro'] and not any(x['me'] for x in B[0]['rows']), "a viewer who can't write sees the board, with a note, and no place on it", {'w': w, 'b': B[0]})
        check(not errs, 'no page errors (read-only)', errs[:3])
        await pg.close()

        # ---------- a board that can't be reached ----------
        pg, errs = await page(b, {'silent': True})
        await pg.wait_for_function("BOARD.st === 'on'")
        await pg.evaluate("BOARD_CFG.wait = 300; showPage('daily')")
        t0 = await pg.evaluate("document.querySelector('[data-board]').textContent")
        await pg.wait_for_function("document.querySelector('[data-board]').textContent.includes('can’t be reached')")
        check('Fetching' in t0, "while it fetches the board says so, then that it can't be reached", t0)
        await pg.close()

        # ---------- off the runtime ----------
        for label, cfg, fake in (('a saved copy (no runtime)', None, False), ('signed out (no db)', {'off': True}, True)):
            pg, errs = await page(b, cfg, fake)
            if fake: await pg.wait_for_function("__FAKE.uses >= 2")
            await pg.wait_for_function("BOARD.st === 'off'")
            await pg.evaluate("showPage('daily')")
            r = await pg.evaluate("({ st: BOARD.st, boards: document.querySelectorAll('[data-board]').length, go: !!document.getElementById('bDailyGo') })")
            await pg.evaluate("(() => { dailyStart(dayKey()); recordRun('lose'); })()")
            check(r['st'] == 'off' and r['boards'] == 0 and r['go'], f'{label}: no board, and the Daily page works as before', r)
            check(not errs, f'no page errors ({label})', errs[:3])
            await pg.close()

        await b.close()
    sys.exit(1 if fails else 0)

asyncio.run(main())
