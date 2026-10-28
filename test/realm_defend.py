# Realm defend the title (epic 2, phase 11): after the Crown the journey goes on with you as the champions. Each
# crown adds to renown; from the next year the cups on your wall take your entry again as title defences, a level
# harder; rival clubs hunt you in the open (a rival match a level up, a purse for a win); the Crown is a level
# harder for each crown held. The Team screen says so, the save keeps it, How to play explains it.
# Asserts; exits nonzero on failure.
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
LEAVE = "(() => { if (B && !B.over) { B.over = 'lose'; B.forfeit = 1; finishFight(); } })()"

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_DEF !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- four cups and the Crown ----------
        base = await pg.evaluate("""(() => { RUN.gold = 400; for (const id of W_TOWN_CUPS) { WG.cup = { id, round: 2 }; wCupWon(id); } WG.cardOffer = null;
          const r0 = wRenown(), salt = wCupProblem('salt'), crownLv = wCupMatch('crown', 0).lv; WG.cup = { id: 'crown', round: 2, clubs: wCrownClubs() };
          wCupWon('crown'); W11.ending = false; return { r0, r1: wRenown(), salt, crownLv, champs: wChamps(), day: WG.crownDay, abs: WG.dayAbs, after: wCupProblem('salt'), crown2: wCupMatch('crown', 0).lv }; })()""")
        check(base['champs'] == 1 and base['day'] == base['abs'], 'the Crown makes you champions', base)
        check(base['r1'] - base['r0'] == 2, 'each crown adds 2 to renown', base)
        check('wall' in base['salt'] and 'wall' in base['after'], 'the same year, a cup on your wall stays closed', base)
        check(base['crown2'] == base['crownLv'] + 1, 'the Crown is a level harder for each crown held', base)

        # ---------- next year: a title defence ----------
        await pg.evaluate(CLOSE_ALL)
        nx = await pg.evaluate("""(() => { WG.year++; const why = wCupProblem('salt'), plain = wCupMatch('salt', 0).lv;
          wEnterMap('saltmere', MAPS.saltmere.spawn[0], MAPS.saltmere.spawn[1]); const g0 = RUN.gold; wCupEnter('salt', { card: false });
          return { why, plain, def: WG.cup && WG.cup.defence, lv: RUN.pending && RUN.pending.world.lv, paid: g0 - RUN.gold, log: WLOG.slice(-3).map(l => l[0]).join(' ') }; })()""")
        check(nx['why'] == '' and nx['def'] == 1 and nx['paid'] == 30, 'next year the registrar takes your entry again, as a title defence', nx)
        check(nx['lv'] == nx['plain'] + 1 and 'title defence' in nx['log'], 'a level harder than before', nx)
        await pg.evaluate(LEAVE); await pg.wait_for_function("UI.view === 'world'"); await pg.evaluate(CLOSE_ALL)
        won = await pg.evaluate("(() => { WG.cup = { id: 'salt', round: 2, defence: 1 }; wCupWon('salt'); WG.cardOffer = null; return { D: WG.defend.cups, y: WG.year, again: wCupProblem('salt') }; })()")
        check(won['D'].get('salt') == [won['y']] and 'wall' in won['again'], 'win it and it is defended for the year', won)
        await pg.evaluate(CLOSE_ALL)

        # ---------- the hunt ----------
        await pg.evaluate("""(() => { const L = DB.locs.find(l => l.map === 'graftonbury'); wEnterMap('world', L.x, L.y + 1); WG.min = 12 * 60; WG.grace = 0; WG.grudge = null; WG.event = null;
          WG.dayAbs = WG.crownDay + 1; const p0 = W_DEF.huntP, t0 = W_TOUR.p; W_DEF.huntP = 1; W_TOUR.p = 0; wEncounterHook('plains', '.', null); W_DEF.huntP = p0; W_TOUR.p = t0; })()""")
        await pg.wait_for_selector('#wPlay')
        h = await pg.evaluate("({ t: document.querySelector('#modalBox .wtaunt') ? document.querySelector('#modalBox .wtaunt').textContent : '' })")
        check('champions' in h['t'], 'a rival club turns up to hunt the champions', h)
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B")
        hm = await pg.evaluate("({ type: B.type, ref: RUN.pending.world.ref })")
        check(hm['type'] == 'rival' and hm['ref'].get('hunt') == 1, 'a rival match', hm)
        await pg.evaluate(LEAVE); await pg.wait_for_function("UI.view === 'world'"); await pg.evaluate(CLOSE_ALL)
        purse = await pg.evaluate("""(() => { const club = Object.values(WG.rivals)[0], g0 = RUN.gold, L0 = wLeague().me.w; (RUN.games = RUN.games || []).push({ sport: 'baseball', won: true, us: 1, them: 0 });
          W_ON_END.event('win', { rival: club, hunt: 1 }, { kind: 'event' }); return { gold: RUN.gold - g0, me: wLeague().me.w - L0, beaten: WG.defend.beaten }; })()""")
        check(purse['gold'] >= 40 and purse['me'] == 1 and purse['beaten'] == 1, 'a win pays the purse and counts on the table', purse)

        # ---------- the Team screen, the save, How to play ----------
        await pg.evaluate("wOpenCamp()"); await pg.wait_for_timeout(300)
        team = await pg.evaluate("(() => { const e = document.querySelector('#modalBox .wchamps'); return e ? e.textContent : ''; })()")
        check('Champions of the realm' in team and 'hunting' in team and 'defended: 1' in team, 'the Team screen names the champions', team)
        await pg.evaluate(CLOSE_ALL)
        sv = await pg.evaluate("(() => { wSave(); return JSON.stringify([WG.defend, WG.crownDay]); })()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("JSON.stringify([WG.defend, WG.crownDay])") == sv, 'the save keeps the defences')
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpDefend'); return h ? h.textContent : ''; })()")
        check('Defend the title' in help_ and 'hunting' in help_, 'How to play explains defending the title', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm defend passed')

asyncio.run(main())
