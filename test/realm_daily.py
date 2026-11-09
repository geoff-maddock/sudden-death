# The Realm daily (issue #60, phase 4): one match a day, the same for everyone. Asserts the day's match comes from the
# date alone (the same every time, every game seen, the tier by weekday, the card game's sport and side, never against
# your own club); a simulated baseball and football daily (the record, the bonus on a win, one attempt a day); boxing
# (the pairing called off isn't an attempt, boxed it is); the card game (the club's side, the day used at kickoff, a win
# through the reward panel, a loss through a blackout); the record kept through a reload; the Daily tab (the day's
# match, the buttons, the streak, past days, the result); the log line; and How to play. Exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox button'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 900); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 160) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; for (const e of alive()) e.hp = Math.max(1, Math.floor(e.hp * .4)); runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''
DAY = lambda k: f"wRdailyToday = () => '{k}'"
REC = "(k => wRdailyAll().days[k] || null)"

async def new_journey(pg, clear=False):
    await pg.goto(REALM_URL)
    if clear: await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wRdailyOf === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg, clear=True)
        await pg.evaluate("(() => { while (wRoster().length < W_PARTY.max - 1) wAddPlayer(wMakePlayer({ kind: 'dwarf', lvl: 4 }, 'tavern')); })()")

        # ---- the day's match, from the date alone ----
        r = await pg.evaluate("""(() => { const out = { same: true, eng: {}, tierOk: true, card: true, notMine: true, days: {} };
          const d0 = dayDate('2026-11-01');
          for (let i = 0; i < 280; i++) { const d = new Date(d0); d.setDate(d.getDate() + i); const k = dayKey(d);
            const a = wRdailyOf(k), b = wRdailyOf(k); if (JSON.stringify(a) !== JSON.stringify(b)) out.same = false;
            out.eng[a.eng] = (out.eng[a.eng] || 0) + 1; (out.days[a.eng] = out.days[a.eng] || []).push(k);
            if (a.tier !== [1, 1, 2, 2, 2, 3, 3][d.getDay()]) out.tierOk = false;
            if (a.eng === 'card' && !(a.ids && a.ids.length && SPORTS[a.sport] && a.ids.every(id => ENEMIES[id]) && (!ENEMIES[a.ids[0]].sport || ENEMIES[a.ids[0]].sport === a.sport))) out.card = false;
            if (a.eng !== 'card' && a.sport !== { ball: 'baseball', grid: 'football', ring: 'boxing' }[a.eng]) out.card = false;
            if (!CLUBS[a.club]) out.notMine = false;
            if (wRdailyOf(k, a.club).club === a.club) out.notMine = false; }
          out.mine = wRdailyMine(); return out; })()""")
        check(r['same'], 'the day\'s match is the same every time it is worked out')
        check(len(r['eng']) == 4 and min(r['eng'].values()) > 30, 'all four games come up, each often', r['eng'])
        check(r['tierOk'], 'the tier follows the weekday: 1 Sunday and Monday, 2 Tuesday to Thursday, 3 Friday and Saturday')
        check(r['card'], 'a card-game day has the sport its side plays; the engines play their own sport')
        check(r['notMine'], 'the club is a real club, and never your own (the day\'s second club stands in)')
        days = r['days']

        # ---- baseball and football, simulated ----
        for eng, label in (('ball', 'baseball'), ('grid', 'football')):
            k = days[eng][0]
            await pg.evaluate(DAY(k))
            g0 = await pg.evaluate("RUN.gold"); n0 = await pg.evaluate("(WLOG.length = 0, 0)")
            why = await pg.evaluate("wRdailyStart('sim')")
            await pg.evaluate(CLOSE_ALL)
            e = await pg.evaluate(REC + f"('{k}')")
            check(why == '' and e and e['st'] in ('win', 'lose', 'tie') and e['eng'] == eng,
                  f'a simulated {label} daily is played and its result written', {'why': why, 'e': e})
            log = await pg.evaluate(f"WLOG.slice({n0}).map(l => l[0]).join(' | ')")
            check(log.find('Final:') < log.find('daily') if 'Final:' in log else True, f'the {label} daily\'s line comes after the final', log[-300:])
            if e and e['st'] == 'win':
                tier = e['tier']; g1 = await pg.evaluate("RUN.gold")
                check('You win the daily! +%d gold' % (25 * tier) in log and g1 - g0 >= 25 * tier, f'a {label} daily win pays the bonus on top', {'log': log[-300:], 'gold': g1 - g0})
            else:
                check('daily' in log and 'You win the daily' not in log, f'a {label} daily loss or draw says so, with no bonus', log[-300:])
            why2 = await pg.evaluate("wRdailyStart('sim')")
            check('played today' in why2, f'a second {label} daily that day is turned away', why2)

        # ---- boxing: the pairing called off isn't an attempt ----
        k = days['ring'][0]
        await pg.evaluate(DAY(k))
        why = await pg.evaluate("wRdailyStart('play')")
        has = await pg.evaluate("document.querySelectorAll('#modalBox [data-rgo]').length")
        check(why == '' and has >= 2, 'a boxing daily opens the pairing', {'why': why, 'go': has})
        await pg.evaluate(CLOSE_ALL)
        e = await pg.evaluate(REC + f"('{k}')")
        check(e is None, 'calling the pairing off is not an attempt', e)
        await pg.evaluate("wRdailyStart('play')")
        await pg.click('#modalBox [data-rgo="sim"]')
        await pg.evaluate(CLOSE_ALL)
        e = await pg.evaluate(REC + f"('{k}')")
        check(e and e['eng'] == 'ring' and e['st'] in ('win', 'lose', 'tie'), 'boxing the pairing is the attempt, and its result is written', e)

        # ---- the card game: a win ----
        k = days['card'][0]
        await pg.evaluate(DAY(k))
        why = await pg.evaluate("wRdailyStart()")
        m = await pg.evaluate("""(() => { const D = wRdailyDay(), P = RUN.pending, W = P && P.world;
          return { why: '', kind: W && W.kind, ref: W && W.ref, ids: P && P.ids, want: D.ids, sport: P && P.sport, wsport: D.sport, tier: W && W.tier, wtier: D.tier, st: (wRdailyAll().days[D.key] || {}).st || null, view: UI.view }; })()""")
        check(why == '' and m['kind'] == 'rdaily' and m['ref'] == k and m['ids'] == m['want'] and m['sport'] == m['wsport'] and m['tier'] == m['wtier'],
              'a card-game daily kicks off against the day\'s side, sport and tier', m)
        check(m['st'] == 'on', 'the day is used at kickoff', m['st'])
        g0 = await pg.evaluate("RUN.gold")
        view = await pg.evaluate(WIN)
        if view == 'panel': await pg.click('#bCont')
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        e = await pg.evaluate(REC + f"('{k}')")
        log = await pg.evaluate("WLOG.map(l => l[0]).join(' | ')")
        check(e and e['st'] == 'win' and 'You win the daily' in log, 'a card-game daily won is written, with the bonus', {'e': e, 'log': log[-200:]})

        # ---- the card game: a loss, through a blackout ----
        k = days['card'][1]
        await pg.evaluate(DAY(k))
        await pg.evaluate("wRdailyStart()")
        await pg.evaluate("(() => { B.over = 'lose'; finishFight(); })()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        e = await pg.evaluate(REC + f"('{k}')")
        check(e and e['st'] == 'lose', 'a card-game daily lost is written as a loss', e)

        # ---- the Daily tab ----
        k = days['ball'][1]
        await pg.evaluate(DAY(k))
        await pg.evaluate("wOpenCamp('daily')")
        await pg.wait_for_selector('#wCampBody [data-rdwhat]')
        t = await pg.evaluate("""(() => { const b = document.getElementById('wCampBody');
          return { what: b.querySelector('[data-rdwhat]').textContent, go: [...b.querySelectorAll('[data-rdgo]')].map(x => x.dataset.rdgo), past: b.querySelectorAll('[data-rdpast] li').length,
            streak: b.querySelector('[data-rdstreak]').textContent, tab: !!document.querySelector('#modalBox [data-ctab="daily"][aria-pressed="true"]'), want: wRdailyWhat(wRdailyDay()) }; })()""")
        check(t['tab'] and t['want'] in t['what'] and t['go'] == ['play', 'manage', 'sim'], 'the Daily tab shows the day\'s match and its buttons', t)
        check(t['past'] == 5, 'the Daily tab lists the past days', t['past'])
        check(t['streak'] == '0', 'the streak counts days in a row (none here: the test\'s days are far apart)', t['streak'])
        await pg.click('#wCampBody [data-rdgo="sim"]')
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wOpenCamp('daily')")
        await pg.wait_for_selector('#wCampBody [data-rdst]')
        t = await pg.evaluate("(() => { const b = document.getElementById('wCampBody'); return { st: b.querySelector('[data-rdst]').dataset.rdst, go: b.querySelectorAll('[data-rdgo]').length, text: b.querySelector('[data-rdst]').textContent }; })()")
        check(t['go'] == 0 and t['st'] in ('win', 'lose', 'tie') and 'tomorrow' in t['text'], 'played from the tab, the day shows its result and no buttons', t)
        await pg.evaluate(CLOSE_ALL)

        # ---- the top bar's Daily page is the Realm daily, not Sudden Death's daily run ----
        k = days['grid'][1]
        await pg.evaluate(DAY(k))
        await pg.evaluate("showPage('daily')")
        t = await pg.evaluate("""(() => { const el = document.getElementById('pg-daily'); return { sd: !!document.getElementById('bDailyGo'), what: (el.querySelector('[data-rdwhat]') || {}).textContent || '',
          want: wRdailyWhat(wRdailyDay()), go: [...el.querySelectorAll('[data-rdgo]')].map(b => b.dataset.rdgo), past: el.querySelectorAll('[data-rdpast] li').length }; })()""")
        check(not t['sd'] and t['want'] in t['what'] and t['go'] == ['play', 'manage', 'sim'] and t['past'] >= 6, 'the top bar\'s Daily page shows the Realm daily, not Sudden Death\'s', t)
        await pg.click('#pg-daily [data-rdgo="sim"]')
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate(f"({{ page: document.getElementById('pg-play').hidden ? 'other' : 'play', e: {REC}('{k}') }})")
        check(r['page'] == 'play' and r['e'] and r['e']['st'] in ('win', 'lose', 'tie') and r['e']['eng'] == 'grid', 'played from the Daily page, it goes back to the world and the result is written', r)

        # a streak: three days in a row
        await pg.evaluate("""(() => { const R = wRdailyAll(); R.days['2027-03-01'] = { st: 'win', eng: 'ball', club: CLUB_IDS[0], tier: 1, t: 1 }; R.days['2027-03-02'] = { st: 'lose', eng: 'ring', club: CLUB_IDS[1], tier: 1, t: 1 }; wRdailySave(R); })()""")
        n = await pg.evaluate("(() => [wRdailyStreak(wRdailyAll().days, '2027-03-03'), wRdailyStreak(wRdailyAll().days, '2027-03-02'), wRdailyStreak(wRdailyAll().days, '2027-03-05')])()")
        check(n == [2, 2, 0], 'the streak counts up to yesterday while today is still to play, and breaks on a missed day', n)

        # ---- kept through a reload, on a new journey ----
        k = days['grid'][0]
        await new_journey(pg)
        await pg.evaluate(DAY(k))
        why = await pg.evaluate("wRdailyStart('sim')")
        check('played today' in why, 'a day played stays played on a new journey', why)
        r = await pg.evaluate("({ log: WLOG.map(l => l[0]).join(' | '), played: !!wRdailyAll().days[dayKey()] })")
        check(("Today’s daily" in r['log']) != r['played'], 'a journey starts with the day\'s daily in the log, while it is still to play', r)

        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpRDaily'); return e ? e.textContent : ''; })()")
        check('one attempt' in h and 'Daily tab' in h and 'Sunday' in h, 'How to play explains the daily', h[:200])
        check(not errs, 'no page errors', errs[:4])
        print('errors:', errs[:4])
        await br.close()
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
