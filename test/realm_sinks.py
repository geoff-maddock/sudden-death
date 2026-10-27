# Realm gold sinks (epic 2, phase 10): a paid training camp at every training spot (after the week's free drill;
# each session that week costs more), and League coaches between the five cities (from any inn: a fare by distance,
# half the walking time, no encounters, you arrive at the inn). Checks prices, the drill, the coach, the save and How
# to play.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-sinks-*.png.
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
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_SINK !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- training camp: only after the free drill, then rising prices ----------
        await pg.evaluate("(() => { RUN.gold = 500; for (let i = 0; i < 6; i++) wGainCard(Object.keys(CARDS).find(id => CARDS[id].kind === 'any' && CARDS[id].rar === 'c' && practicable(mkCard(id)))); WG.cardOffer = null; wEnterMap('graftonbury', 44, 15); wOpenSpot('sp_cage'); })()")
        pre = await pg.evaluate("({ dis: document.getElementById('wCampDrill').disabled, t: document.getElementById('wCampDrill').closest('li').textContent })")
        check(pre['dis'] and 'After the free drill' in pre['t'], 'training camp waits for the week\'s free drill', pre)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wSpotDrill('sp_cage', wSpotCards('baseball')[0]); wOpenSpot('sp_cage')")
        await pg.screenshot(path='/tmp/realm-sinks-camp.png')
        await pg.click('#wCampDrill'); await pg.wait_for_selector('#modalBox .cardgrid .card')
        uid = await pg.evaluate("+document.querySelector('#modalBox .cardgrid .card').dataset.uid")
        g0 = await pg.evaluate("({ gold: RUN.gold, min: WG.min })")
        await pg.click('#modalBox .cardgrid .card'); await pg.wait_for_selector('#wCampDrill')
        d = await pg.evaluate(f"({{ sk: RUN.deck.find(c => c.uid === {uid}).sk, gold: RUN.gold, min: WG.min, next: wCampPrice() }})")
        check(d['sk'] == 1 and g0['gold'] - d['gold'] == 30 and d['min'] - g0['min'] == 60, 'a camp session: Practice ★ for 30 gold and an hour', [g0, d])
        check(d['next'] == 45, 'the next session this week costs more', d)
        await pg.evaluate(CLOSE_ALL)
        poor = await pg.evaluate("(() => { RUN.gold = 10; const c = RUN.deck.find(c => practicable(c) && !c.sk); return wCampDrill('sp_cage', c); })()")
        check('45 gold' in poor, 'not without the gold', poor)
        wk = await pg.evaluate("(() => { WG.dayAbs += 7; WG.day += 7; return wCampPrice(); })()")
        check(wk == 30, 'a new week, back to the first price', wk)

        # ---------- coaches ----------
        trip = await pg.evaluate("""(() => { const out = {}; for (const a of W_COACH_CITIES) for (const b of W_COACH_CITIES) if (a !== b) out[a + '>' + b] = wCoachTrip(a, b); return out; })()""")
        check(len(trip) == 20 and all(t and t['price'] >= 10 and t['minutes'] > 0 for t in trip.values()), 'a coach runs between every pair of cities, with a fare and a time', trip)
        sym = all(trip[f'{a}>{b}'] == trip[f'{b}>{a}'] for a, b in [k.split('>') for k in trip])
        check(sym, 'the fare is the same both ways')
        await pg.evaluate("(() => { RUN.gold = 200; wEnterMap('graftonbury', MAPS.graftonbury.spawn[0], MAPS.graftonbury.spawn[1]); wOpenInn(12, 'The innkeeper'); })()")
        check(await pg.evaluate("!!document.getElementById('wInnCoach')"), 'the inn has a Coach button')
        await pg.click('#wInnCoach'); await pg.wait_for_selector('[data-coach]')
        await pg.screenshot(path='/tmp/realm-sinks-coach.png')
        t = await pg.evaluate("wCoachTrip('graftonbury', 'rimewatch')")
        c0 = await pg.evaluate("({ gold: RUN.gold, abs: WG.dayAbs * 1440 + WG.min })")
        await pg.click('[data-coach="rimewatch"]')
        await pg.wait_for_function("WG.map === 'rimewatch'")
        c1 = await pg.evaluate("({ gold: RUN.gold, abs: WG.dayAbs * 1440 + WG.min, map: WG.map, at: [WG.x, WG.y], inn: wInnSpot('rimewatch'), log: WLOG.slice(-2).map(l => l[0]).join(' ') })")
        check(c0['gold'] - c1['gold'] == t['price'] and c1['abs'] - c0['abs'] == t['minutes'], 'the coach charges its fare and takes its time', [t, c0, c1])
        check(c1['at'] == c1['inn'] and 'coach' in c1['log'], 'you arrive at the inn', c1)
        bad = await pg.evaluate("(() => { RUN.gold = 0; return wTakeCoach('saltmere'); })()")
        check('fare' in bad, 'no fare, no coach', bad)
        talk = await pg.evaluate("({ job: wSay('rime_inn', 'job').text.includes('COACH'), act: wSay('rime_inn', 'coach').act })")
        check(talk['job'] and talk['act'] == 'coach', 'innkeepers mention the COACH', talk)

        # ---------- the save, How to play ----------
        sv = await pg.evaluate("(() => { wSave(); return JSON.stringify(WG.sink); })()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("JSON.stringify(WG.sink)") == sv, 'the save keeps the week\'s sessions')
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpSinks'); return h ? h.textContent : ''; })()")
        check('Training camp' in help_ and 'COACH' in help_, 'How to play explains training camp and coaches', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm sinks passed')

asyncio.run(main())
