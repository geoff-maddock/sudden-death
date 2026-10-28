# Realm Hall of Legends (epic 2, phase 12): a Crown puts your team (name, colours, starting three) in the Hall, kept
# per profile outside the journey's save. Later journeys meet those champions: at the Crown Coliseum (Steward Crane's
# LEGENDS, once a journey each) and, with two cups, on the road. A journey never meets its own legend. A win pays
# gold, fans and a pick of rare cards. Checks the Hall, a new journey, a real match, the road, the cap and How to play.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-legends-*.png.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_LEG !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- an empty Hall ----------
        await pg.evaluate("(() => { wEnterMap('coliseum', MAPS.coliseum.spawn[0], MAPS.coliseum.spawn[1]); wRunAct(wSay('steward', 'legends').act, 'steward'); })()")
        bare = await pg.evaluate("document.getElementById('modalBox').textContent")
        check('walls are bare' in bare, 'with no champions yet, the Hall is bare', bare[:200])
        await pg.evaluate(CLOSE_ALL)

        # ---------- a Crown puts this team in the Hall, once a journey ----------
        hall = await pg.evaluate("""(() => { WG.crowns = [WG.year]; WG.cup = { id: 'crown', round: 2 }; wCupWon('crown'); W11.ending = false;
          const a = wLegendsAll(); WG.crowns.push(WG.year + 1); WG.cup = { id: 'crown', round: 2 }; wCupWon('crown'); W11.ending = false; const b = wLegendsAll();
          return { n: a.length, n2: b.length, L: b[0], st: wStarters().map(p => p.n), team: wPartyTeam().name, mine: wLegends().length, id: WG.legId }; })()""")
        check(hall['n'] == 1 and hall['n2'] == 1 and hall['L']['crowns'] >= 2, 'a Crown puts your team in the Hall; a later crown updates the same entry', hall)
        check(hall['L']['name'] == hall['team'] and [p['n'] for p in hall['L']['players']] == hall['st'], 'with your name and starting three', hall['L'])
        check(hall['mine'] == 0, 'a journey never meets its own legend', hall)
        await pg.evaluate(CLOSE_ALL)

        # ---------- a new journey meets them ----------
        nj = await pg.evaluate("""(() => { const old = wLegendsAll()[0]; wStart(null, { club: CLUB_IDS.find(c => c !== RUN.club) }); return { n: wLegends().length, id: wLegends()[0] && wLegends()[0].id, old: old.id, legId: WG.legId || null }; })()""")
        check(nj['n'] == 1 and nj['id'] == nj['old'] and nj['legId'] is None, 'a new journey has the Hall\'s champions', nj)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { wEnterMap('coliseum', MAPS.coliseum.spawn[0], MAPS.coliseum.spawn[1]); wOpenLegends(); })()")
        await pg.wait_for_selector('[data-legend]')
        await pg.screenshot(path='/tmp/realm-legends-hall.png')
        await pg.click('[data-legend]'); await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("document.querySelector('#modalBox .wtaunt') ? document.querySelector('#modalBox .wtaunt').textContent : ''")
        check('Hall of Legends' in pre and hall['team'] in pre and hall['st'][0] in pre, 'the pre-game card names the legend and their players', pre)
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        m = await pg.evaluate("({ names: B.enemies.map(e => e.n), type: B.type, tier: RUN.pending.world.tier, team: B.enemies.map(e => e.team && e.team.name), kind: RUN.pending.world.kind })")
        check(m['names'] == hall['st'] and m['kind'] == 'legend' and m['tier'] == 3, 'their starting three take the field, by name, at the top tier', m)
        check(all(t == hall['team'] for t in m['team']), 'in their colours', m['team'])
        await pg.wait_for_timeout(500); await pg.screenshot(path='/tmp/realm-legends-match.png')
        await pg.evaluate(LEAVE); await pg.wait_for_function("UI.view === 'world'"); await pg.evaluate(CLOSE_ALL)
        still = await pg.evaluate("!wLegBeaten(wLegends()[0].id)")
        check(still, 'lose, and they are still there to play')
        win = await pg.evaluate("""(() => { const L = wLegends()[0], g0 = RUN.gold; W_ON_END.legend('win', { id: L.id }, {}); const offer = !!WG.cardOffer; WG.cardOffer = null;
          return { gold: RUN.gold - g0, beat: wLegBeaten(L.id), offer, again: wLegendMatch(L.id) === null }; })()""")
        check(win['gold'] == 120 and win['beat'] and win['offer'] and win['again'], 'beat them for 120 gold and a pick of rare cards; once a journey', win)
        await pg.evaluate(CLOSE_ALL)

        # ---------- on the road, with two cups ----------
        road0 = await pg.evaluate("""(() => { const all = wLegendsAll(); all.push(Object.assign({}, all[0], { id: 'Ltest', name: 'The Old Guard', year: 9 })); localStorage.setItem(wLegKey(), JSON.stringify(all));
          WG.legends = wLegendsAll().filter(l => l.id !== WG.legId); const L = DB.locs.find(l => l.map === 'graftonbury'); wEnterMap('world', L.x, L.y + 1); WG.min = 12 * 60;
          return wCupsWon(); })()""")
        HOOK = """(() => { WG.grace = 0; WG.event = null; RUN.pending = null; const sv = { l: W_LEG.roadP, t: W_TOUR.p, d: W_DEF.huntP, r: W_ROAD.eventP, m: W_ENC.mult };
          W_LEG.roadP = 1; W_TOUR.p = 0; W_DEF.huntP = 0; W_ROAD.eventP = 0; W_ENC.mult = 0;
          try { wEncounterHook('plains', '.', null); } finally { W_LEG.roadP = sv.l; W_TOUR.p = sv.t; W_DEF.huntP = sv.d; W_ROAD.eventP = sv.r; W_ENC.mult = sv.m; }
          const t = document.querySelector('#modalBox .wtaunt'); return t ? t.textContent : ''; })()"""
        t0 = await pg.evaluate(HOOK)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("for (const id of ['moss', 'salt']) wSetFlag(DB.cups[id].flag)")
        t1 = await pg.evaluate(HOOK)
        road = {'cups0': road0, 'none': t0 == '', 't': t1}
        check(road['none'] and 'The Old Guard' in road['t'], 'with two cups, a legend you have not beaten may stop you on the road', road)
        await pg.evaluate(CLOSE_ALL)
        cap = await pg.evaluate("(() => { const L = wLegendsAll()[0]; const many = Array.from({ length: 14 }, (_, i) => Object.assign({}, L, { id: 'x' + i })); wLegendsSave(many); return wLegendsAll().length; })()")
        check(cap == 10, 'the Hall keeps the latest 10', cap)
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpLegends'); return h ? h.textContent : ''; })()")
        check('Hall of Legends' in help_ and 'LEGENDS' in help_, 'How to play explains the Hall of Legends', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm legends passed')

asyncio.run(main())
