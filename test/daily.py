# The daily challenge (issue #60, phase 2): the day's game from the date, one go a day, the record, the streak, the
# Daily tab and How to play. Asserts; exits non-zero on any failure.
import asyncio, subprocess, sys
from paths import ROOT, GAME_URL, GAME_BUILD
from playwright.async_api import async_playwright

subprocess.run(GAME_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
fails = []
def check(ok, what, info=''):
    print(('ok   ' if ok else 'FAIL ') + what + (f'  {info}' if not ok and info != '' else ''))
    if not ok: fails.append(what)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL)
        await pg.wait_for_function('typeof renderDaily === "function" && UI.screen === "title"')

        # ---------- the day's game, from the date alone ----------
        r = await pg.evaluate("""(() => {
          const out = {};
          const a = JSON.stringify(dailyOf('2026-11-07')), b = JSON.stringify(dailyOf('2026-11-07'));
          out.same = a === b; out.differs = a !== JSON.stringify(dailyOf('2026-11-08'));
          // Sunday 8 November 2026 to Saturday 14 November
          out.week = ['08', '09', '10', '11', '12', '13', '14'].map(d => { const D = dailyOf('2026-11-' + d); return [D.dow, D.diff]; });
          // a day for each twist
          out.byTwist = {}; const d = new Date(2026, 0, 1);
          for (let i = 0; i < 800 && Object.keys(out.byTwist).length < Object.keys(DAILY_TWISTS).length; i++) { const k = dayKey(d); const t = dailyOf(k).twist; if (!out.byTwist[t]) out.byTwist[t] = k; d.setDate(d.getDate() + 1); }
          out.lines = Object.values(out.byTwist).every(k => { const D = dailyOf(k); return D.line.length === 3 && new Set(D.picks).size === 3 && D.line.every(x => x && KIND_NAME[x[1]]); });
          return out;
        })()""")
        check(r['same'] and r['differs'], "a day's game comes from the date: the same each time, and different the next day")
        check(r['week'] == [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3]], 'difficulty rises from Rookie on Sunday to Hall of Fame on Saturday', r['week'])
        check(len(r['byTwist']) == 8, 'every twist turns up on some day', r['byTwist'])
        check(r['lines'], 'every day has a line of three different players')
        days = r['byTwist']

        # ---------- each twist does what it says, and a day's run is the same twice ----------
        r = await pg.evaluate("""(days => {
          const out = {}, base = () => { const R0 = newRun('ironmaw', [0, 1, 2], undefined, undefined, 1); return { gold: R0.gold, hp: R0.maxhp, deck: R0.deck.length, checks: R0.deck.filter(c => c.id === 'check').length, relics: R0.relics.length }; };
          const b0 = base();
          const run = k => { newDailyRun(k); return RUN; };
          let R1 = run(days.purse); out.purse = R1.gold === 250 && R1.twist === 'purse' && R1.daily === days.purse;
          R1 = run(days.heirloom); out.heirloom = R1.relics.length === b0.relics + 1;
          R1 = run(days.lean); out.lean = R1.deck.filter(c => c.id === 'check').length === b0.checks - 2;
          R1 = run(days.glass); out.glass = R1.maxhp === b0.hp - 15 && R1.deck.length === b0.deck + 1 && CARDS[R1.deck[R1.deck.length - 1].id].rar === 'r';
          R1 = run(days.iron); out.iron = R1.maxhp === b0.hp + 15 && R1.hp === R1.maxhp && R1.deck.some(c => c.id === 'penalty');
          R1 = run(days.scouted); out.scouted = R1.party.filter(p => R1.deck.find(c => c.id === SIG[p.kind]).up).length === 1;
          // the bots' twist in place of the day's: the same club and line, the other twist, or none
          const D0 = dailyOf(days.purse), Dn = dailyOf(days.purse, 'none'), Dl = dailyOf(days.purse, 'lean');
          out.forced = Dn.club === D0.club && JSON.stringify(Dn.line) === JSON.stringify(D0.line) && Dn.twist === 'none' && Dl.twist === 'lean' && (() => { newDailyRun(days.purse, 'none'); return RUN.gold !== 250 && RUN.club === D0.club; })();
          R1 = run(days.medicine); out.medicine = R1.tonics.every(t => t);
          R1 = run(days.free); out.free = R1.club === 'free' && R1.relics.length >= 1;
          const snap = k => { newDailyRun(k); return JSON.stringify([RUN.seed, RUN.diff, RUN.party, RUN.map.nodes, RUN.deck.map(c => c.id + c.up), RUN.relics, RUN.tonics, RUN.gold, RUN.maxhp]); };
          out.twice = Object.values(days).every(k => snap(k) === snap(k));
          out.diffSet = (() => { newDailyRun('2026-11-14'); return RUN.diff; })();
          // looking at a Free Agents day never moves a live fight's or room's stream
          newRun('ironmaw', [0, 1, 2], undefined, undefined, 99); RUN.path = []; RUN.pos = Object.keys(RUN.map.nodes)[0]; startCombat(['lb'], 'normal', 'hockey');
          const s0 = [B.rng, RUN.rng, RUN.rngAt]; dailyOf(days.free); dailyOf(days.purse); out.untouched = JSON.stringify(s0) === JSON.stringify([B.rng, RUN.rng, RUN.rngAt]) && RUN.seed === 99;
          RUN = null; B = null; localStorage.removeItem(pkey('sd-run'));
          return out;
        })""", days)
        for t in ['purse', 'heirloom', 'lean', 'glass', 'iron', 'scouted', 'medicine', 'free']:
            check(r[t], f'the {t} twist does what it says')
        check(r['forced'], "the bots' twist override keeps the day's club and line, and 'none' plays it plain")
        check(r['twice'], "a day's run is the same every time (line, map, deck, trophies, tonics, gold, HP)")
        check(r['diffSet'] == 3, "the run is played at the day's difficulty", r['diffSet'])
        check(r['untouched'], "working out a day's game never moves the live run's or fight's streams")

        # ---------- the Daily tab and one go a day ----------
        await pg.evaluate("localStorage.removeItem(pkey('sd-daily')); localStorage.removeItem(pkey('sd-run')); renderTitle()")
        t = await pg.evaluate("$('bDaily').textContent")
        check(t.startswith('Today’s daily:'), "the title screen's Daily button names today", t)
        await pg.click('#bDaily')
        r = await pg.evaluate("""(() => { const D = dailyOf(dayKey()), el = $('pg-daily'); return { shown: !el.hidden, text: el.textContent, imgs: el.querySelectorAll('.dline img').length, go: !!$('bDailyGo'),
          day: dayName(dayKey(), true), diff: DIFFS[D.diff].n, club: D.free ? 'Free Agents' : CLUBS[D.club].name, twist: DAILY_TWISTS[D.twist].n, names: D.line.map(x => x[0]) }; })()""")
        check(r['shown'], 'the Daily button opens the Daily tab')
        check(all(x in r['text'] for x in [r['day'], r['diff'], r['club'], r['twist']] + r['names']), "the tab shows today's date, difficulty, club, line and twist")
        check(r['imgs'] == 3 and r['go'], 'three portraits and a Play button')
        await pg.click('#bDailyGo')
        await pg.wait_for_function("UI.view === 'map'")
        r = await pg.evaluate("""(() => { const k = dayKey(), e = loadDaily().days[k]; return { daily: RUN.daily === k, seed: RUN.seed === dailyOf(k).seed, diff: RUN.diff === dailyOf(k).diff, st: e && e.st, saved: (loadRun() || {}).daily === k, again: dailyStart(k), key: localStorage.getItem(pkey('sd-daily')) != null }; })()""")
        check(r['daily'] and r['seed'] and r['diff'], "Play starts today's run at the day's seed and difficulty", r)
        check(r['st'] == 'on' and r['saved'], 'starting it uses the day up, and the run is saved like any run', r)
        check(r['again'] is False, "today's daily can't be started a second time")
        check(r['key'], "the record is kept under the profile's key")
        r = await pg.evaluate("(() => { RUN = null; renderTitle(); showPage('daily'); return { btn: $('bDailyGo') && $('bDailyGo').textContent, title: $('bDaily').textContent }; })()")
        check(r['btn'] == 'Continue today’s game' and r['title'] == 'The Daily', 'while it is on, the tab offers Continue, and the title button stops naming the day', r)
        await pg.click('#bDailyGo')
        await pg.wait_for_function("UI.view === 'map' && RUN && RUN.daily === dayKey()")
        check(True, 'Continue resumes the daily run')
        # it ends: the result goes on the day
        r = await pg.evaluate("""(() => { RUN.act = 1; RUN.floor = 4; recordRun('lose'); const e = loadDaily().days[dayKey()]; RUN = null; showPage('daily');
          return { st: e.st, act: e.act, score: e.score, done: ($('dailyDone') || {}).textContent || '', btn: !!$('bDailyGo'), row: $('dTable').textContent, rec: loadRecords().runs.length }; })()""")
        check(r['st'] == 'lose' and r['act'] == 1 and isinstance(r['score'], int), "the day's result and score are recorded", r)
        check('Lost in act 2, floor 5' in r['done'] and not r['btn'], 'once played, the tab shows how it went and no Play button', r)
        check('Lost in act 2' in r['row'] and r['rec'] >= 1, 'the day is in the table, and the run in Records as usual', r)

        # ---------- streak, abandoned days, and a run in progress ----------
        r = await pg.evaluate("""(() => { const days = {}, k0 = '2026-11-07'; let k = k0; for (let i = 0; i < 4; i++) { days[k] = { st: 'win' }; k = dayBefore(k); } days[dayBefore(k)] = { st: 'lose' };
          return { today: dailyStreak(days, k0), tomorrow: dailyStreak(days, '2026-11-08'), gap: dailyStreak(days, '2026-11-09'), monthEdge: dayBefore('2026-03-01'), yearEdge: dayBefore('2027-01-01'),
            gone: dailyState('2026-11-01', { st: 'on' }, null), on: dailyState('2026-11-01', { st: 'on' }, { daily: '2026-11-01' }) }; })()""")
        check(r['today'] == 4 and r['tomorrow'] == 4 and r['gap'] == 0, "the streak counts days in a row, up to today or yesterday, and a missed day ends it", r)
        check(r['monthEdge'] == '2026-02-28' and r['yearEdge'] == '2026-12-31', 'days count back across months and years', r)
        check(r['gone'] == 'gone' and r['on'] == 'on', 'a started daily whose save was replaced counts as abandoned', r)
        # a run in progress: the daily asks before replacing it
        await pg.evaluate("""(() => { localStorage.removeItem(pkey('sd-daily')); newRun('ironmaw', [0, 1, 2], undefined, undefined, 5); RUN = null; showPage('daily'); })()""")
        await pg.click('#bDailyGo')
        r = await pg.evaluate("({ modal: !$('modal').hidden, text: $('modalBox').textContent, started: !!loadDaily().days[dayKey()] })")
        check(r['modal'] and 'replaces it' in r['text'] and not r['started'], 'with a run in progress, the daily asks before replacing it', r)
        await pg.evaluate("$('modalBox').querySelector('.btn').click()")
        await pg.wait_for_function("UI.view === 'map'")
        check(await pg.evaluate("(loadDaily().days[dayKey()] || {}).st === 'on' && RUN.daily === dayKey()"), 'and confirming starts it')

        # ---------- How to play, a phone, errors ----------
        t = await pg.evaluate("(() => { showPage('help'); renderHelp(); return { n: document.querySelectorAll('#helpDaily').length, t: ($('helpDaily') || {}).textContent || '' }; })()")
        check(t['n'] == 1 and 'Hall of Fame on Saturday' in t['t'] and 'one go' in t['t'], 'How to play explains the daily, once', t)
        await pg.set_viewport_size({'width': 375, 'height': 800})
        await pg.evaluate("RUN = null; showPage('daily')")
        r = await pg.evaluate("({ sw: document.documentElement.scrollWidth, w: innerWidth })")
        check(r['sw'] <= r['w'], 'the Daily tab fits a phone with no sideways scroll', r)
        await pg.screenshot(path='/tmp/daily-phone.png', full_page=True)
        await pg.set_viewport_size({'width': 1200, 'height': 900})
        await pg.screenshot(path='/tmp/daily.png', full_page=True)
        check(not errs and not await pg.evaluate('window.__sdErrs.length'), 'no page errors', errs[:2])
        await b.close()

asyncio.run(main())
if fails:
    print('errors:', fails); sys.exit(1)
print('all daily checks passed')
