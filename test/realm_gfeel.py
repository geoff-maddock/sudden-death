# Realm grounds polish (issue #6, phase 7): every ground has its own theme (walking it and in a match there), the
# coach's tips for the grounds, the squad rule, your fixture and the training spots (never in LAB), the medals
# (Groundhopper: a game at every ground; Fixture List; Top of the Class), the League shop's team kit in Graftonbury
# (bought once, worn in a match, an old save's townsfolk places dropped once), match-day talk in the cities, and How
# to play. The audit is clean.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-gfeel-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .ghost, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; WG.wprompts = []; })()"""
ENTER = """(gid => { const L = DB.locs.find(l => l.id === gid); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1); wDrain(); return WG.map; })"""
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS)); tipQ.length = 0; if (document.getElementById('coach')) document.getElementById('coach').hidden = true"

async def new_journey(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenKit !== 'undefined'")
    await pg.evaluate(NOTIPS)
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
        await new_journey(pg)
        await pg.evaluate("RUN.gold = 500")

        # ---------- music ----------
        th = await pg.evaluate("""W_GRDS.map(g => { const t = THEMES['wg_' + g.id]; return [g.id, !!t && t.mel.length === 64 && t.mel.some(n => n != null) && !!SCALES[t.scale] && ['k', 's', 'h'].every(k => t.drums[k].length === 16) && t.bassPat.length === 16]; })""")
        check(len(th) == 10 and all(t[1] for t in th), 'every ground has a theme in Sudden Death\'s format', th)
        names = await pg.evaluate("new Set(W_GRDS.map(g => THEMES['wg_' + g.id].name)).size")
        check(names == 10, 'ten different themes', names)
        await pg.evaluate(ENTER + "('g_rink')")
        w = await pg.evaluate("musicWanted()")
        check(w == ['wg_g_rink', 'calm'], 'walking the Pond Rink plays its theme', w)
        await pg.evaluate("wEnterMap('rimewatch', MAPS.rimewatch.spawn[0], MAPS.rimewatch.spawn[1])")
        check(await pg.evaluate("musicWanted()[0]") == 'w_town', 'the city still plays the town theme')
        m = await pg.evaluate("[wMusicMatch({ kind: 'ground', ref: { g: 'g_bowl' }, region: 'ember' }), wMusicMatch({ kind: 'wild', region: 'ember' })]")
        check(m == ['wg_g_bowl', 'w_ember'], 'a match at a ground plays the ground\'s theme; a wild match its region\'s', m)

        # ---------- tips ----------
        t = await pg.evaluate("""(() => { const out = {}; SET.tips = true;
          for (const [where, id] of [['g_lists', 'in'], ['mossgate', 'town']]) {
            TIPS_SEEN.length = 0; tipQ.length = 0;
            if (where.startsWith('g_')) { const L = DB.locs.find(l => l.id === where); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1); }
            else wEnterMap(where, MAPS[where].spawn[0], MAPS[where].spawn[1]);
            wGrdTips(); out[id] = tipQ.slice(); }
          TIPS_SEEN.length = 0; tipQ.length = 0; LAB = true; wGrdTips(); out.lab = tipQ.slice(); LAB = false; return out; })()""")
        check('w_grounds' in t['in'] and 'w_squad' in t['in'], 'at a ground with three players: the grounds tip and the squad tip', t)
        check('w_spot' in t['town'] and 'w_grounds' not in t['town'], 'in a city: the training spots tip', t)
        check(t['lab'] == [], 'no tips in LAB', t)
        await pg.evaluate(NOTIPS)
        fx = await pg.evaluate("""(() => { const f = wMyFixture(); const L = DB.locs.find(l => l.id === f.g); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1);
          TIPS_SEEN.length = 0; tipQ.length = 0; wGrdTips(); const q = tipQ.slice(); tipQ.length = 0; TIPS_SEEN.push(...Object.keys(TIPS)); document.getElementById('coach').hidden = true; return { q, map: WG.map, g: f.g }; })()""")
        check(fx['map'] == fx['g'] and 'w_fixture' in fx['q'], 'at your fixture\'s ground: the fixture tip', fx)
        tl = await pg.evaluate("['w_grounds', 'w_squad', 'w_fixture', 'w_spot'].every(k => TIPS[k] && TIPS[k].length === 2 && TIPS[k][1].length < 260)")
        check(tl, 'each tip is a title and a short line')

        # ---------- medals ----------
        ach = await pg.evaluate("['w_grounds', 'w_fixtures', 'w_coach'].map(id => ACH.find(a => a.id === id)).map(a => a && [a.stat, a.at])")
        check(all(ach) and ach[0] == ['realmGrounds', [3, 6, 10]], 'three new medals; Groundhopper tops out at all ten grounds', ach)
        await pg.evaluate("(() => { const K = ['troll', 'harpy', 'golem', 'wraith', 'spider']; let i = 0; while (wRoster().length < 6 && i < 10) wRecruit({ kind: K[i++ % K.length], lvl: 3 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate(ENTER + "('g_lists')")
        await pg.evaluate("wStartGrd('g_lists', 'friendly')")
        await pg.wait_for_selector('#wPlay'); await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        kitless = await pg.evaluate("[musicWanted()[0], clubTeam().color === CLUBS[RUN.club].color]")
        check(kitless == ['wg_g_lists', True], 'in the match: the Lists\' theme, in your club\'s own colours', kitless)
        await pg.evaluate("(() => { B.over = 'lose'; B.phase = 'done'; B.forfeit = 1; finishFight(); })()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        s = await pg.evaluate("ACHS.sets.realmGrounds || []")
        check(s == ['g_lists'], 'a game at the Lists counts for Groundhopper, win or lose', s)
        f0 = await pg.evaluate("ACHS.stats.realmFixWins || 0")
        await pg.evaluate("(() => { const f = wMyFixture(); W_ON_END.ground('win', { g: f.g, mode: 'fixture', club: f.club, day: f.day }, {}); W_ON_END.ground('win', { g: 'g_court', mode: 'friendly' }, {}); })()")
        f1 = await pg.evaluate("({ n: ACHS.stats.realmFixWins || 0, s: ACHS.sets.realmGrounds.length })")
        check(f1['n'] == f0 + 1 and f1['s'] >= 2, 'a fixture won counts for Fixture List; a friendly does not', [f0, f1])
        await pg.evaluate("WG.map = 'g_ballpark'; wBall().live = { world: {} }; wBallSettle('lose', 1, 4, [], 9); WG.map = 'g_lists'")
        check(await pg.evaluate("ACHS.sets.realmGrounds.includes('g_ballpark')"), 'a ball game at the Ballpark counts for it')
        sp = await pg.evaluate("(() => { const a = ACHS.stats.realmSpotWins || 0; wSpotAnswer('sp_skittle', 'golf'); const b = ACHS.stats.realmSpotWins || 0; wSpotState('sp_cage').quiz = -1; wSpotAnswer('sp_cage', 'baseball'); return [a, b, ACHS.stats.realmSpotWins || 0]; })()")
        check(sp[1] == sp[0] and sp[2] == sp[0] + 1, 'a right answer counts for Top of the Class; a wrong one does not', sp)

        # ---------- the League shop ----------
        sh = await pg.evaluate("(() => { const m = MAPS.graftonbury, n = m.npcs.find(n => n.id === 'lg_shop'); return { n: !!n, fixed: n && n.fixed, homes: m.blds.length, say: wSay('lg_shop', 'kit').act, job: wSay('lg_shop', 'job').text.includes('KIT') }; })()")
        check(sh['n'] and sh['fixed'] and sh['say'] == 'kit' and sh['job'], 'Bunty Pennant keeps the League shop in Graftonbury and answers KIT', sh)
        reach = await pg.evaluate("""(() => { const m = MAPS.graftonbury, n = m.npcs.find(n => n.id === 'lg_shop'), seen = new Set([m.spawn.join(',')]), q = [m.spawn];
          while (q.length) { const [x, y] = q.pop(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Y = y + b, k = X + ',' + Y; if (seen.has(k) || !m.t[Y] || m.t[Y][X] == null) continue; const c = m.t[Y][X];
            if (!(walkCh(c) || c === '+')) continue; seen.add(k); q.push([X, Y]); } }
          return [[0, 1], [0, 2]].some(([a, b]) => seen.has(n.x + a + ',' + (n.y + b))); })()""")
        check(reach, 'you can walk up to the shop counter from the gate')
        await pg.evaluate("wEnterMap('graftonbury', MAPS.graftonbury.spawn[0], MAPS.graftonbury.spawn[1]); wRunAct('kit', 'lg_shop')")
        await pg.wait_for_selector('[data-wkit="charter"]')
        rows = await pg.evaluate("document.querySelectorAll('#modalBox .wbcl').length")
        check(rows == 7, 'seven kits on the rail: your own and six to buy', rows)
        await pg.screenshot(path='/tmp/realm-gfeel-kit.png')
        g0 = await pg.evaluate("RUN.gold")
        await pg.click('[data-wkit="charter"]')
        await pg.wait_for_function("WG.kit.on === 'charter'")
        k = await pg.evaluate("({ gold: RUN.gold, own: WG.kit.own, col: clubTeam().color, short: clubTeam().short === CLUBS[RUN.club].short, wearing: document.getElementById('modalBox').textContent.includes('Wearing') })")
        check(k['gold'] == g0 - 40 and k['own'] == ['home', 'charter'] and k['col'] == '#d9a63a' and k['short'] and k['wearing'], 'buying Charter gold: 40 gold, and your team wears it', k)
        await pg.click('[data-wkit="home"]'); await pg.wait_for_function("WG.kit.on === 'home'")
        await pg.click('[data-wkit="charter"]'); await pg.wait_for_function("WG.kit.on === 'charter'")
        check(await pg.evaluate("RUN.gold") == g0 - 40, 'a kit you own is free to wear again')
        poor = await pg.evaluate("(() => { RUN.gold = 10; return wBuyKit('away'); })()")
        check(poor.startswith('You cannot afford'), 'a kit you cannot afford', poor)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("RUN.gold = 500")
        await pg.evaluate("WG.grd.met = {}; wStartGrd('g_lists', 'challenge')")
        await pg.wait_for_selector('#wPlay'); await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        check(await pg.evaluate("clubTeam().color") == '#d9a63a', 'in a match, your team plays in the kit')
        await pg.screenshot(path='/tmp/realm-gfeel-kit-match.png')
        await pg.evaluate("(() => { B.over = 'lose'; B.phase = 'done'; B.forfeit = 1; finishFight(); })()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)

        # ---------- match days ----------
        md = await pg.evaluate("""(() => { const L = wLeague(); L.next = { day: WG.dayAbs + 1, games: [{ a: wLeagueClubs()[0], b: wLeagueClubs()[1], g: 'g_rink' }, { a: wLeagueClubs()[2], b: 'me', g: 'g_bowl' }] };
          L.results.unshift({ day: WG.dayAbs, a: wLeagueClubs()[3], b: wLeagueClubs()[4], sport: 'soccer', sa: null, sb: null, g: 'g_sheet' });
          const lines = new Set(); for (let i = 0; i < 40; i++) lines.add(wMatchDayLine('rimewatch'));
          return { rime: [...lines], cind: wMatchDayLine('cinderhold'), salt: wMatchDayLine('saltmere') }; })()""")
        check(any('poster' in l and 'Pond Rink' in l and 'tomorrow' in l for l in md['rime']) and any('Hoarfrost Pitch' in l and 'beat' in l for l in md['rime']), 'Rimewatch talks of tomorrow\'s game at the rink and today\'s result at the sheet', md['rime'])
        check(md['cind'] == '' and md['salt'] == '', 'your own fixture is not on the posters; no games, no talk', md)

        # ---------- an old save ----------
        await pg.evaluate("""(() => { delete WG.kit; WG.npc.graftonbury = MAPS.graftonbury.npcs.map(() => [1, 1]);
          localStorage.setItem(wSaveKey(), JSON.stringify({ v: REALM.v, WG, RUN })); })()""")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        old = await pg.evaluate("({ kit: WG.kit, shop: (n => [n.x, n.y])(MAPS.graftonbury.npcs.find(n => n.id === 'lg_shop')), want: [34, 22] })")
        check(old['kit'] == {'own': ['home'], 'on': 'home'} and old['shop'] == old['want'], 'an old save: home kit on, and Graftonbury\'s townsfolk back in their places', old)

        help_ = await pg.evaluate("(() => { renderHelp(); return [document.getElementById('wHelpGrdFeel'), document.getElementById('wHelpKit')].map(h => h ? h.textContent : ''); })()")
        check('Groundhopper' in help_[0] and 'music' in help_[0] and 'League shop' in help_[1], 'How to play: the grounds\' music, medals and the kit', help_)
        check(await pg.evaluate("wAudit().length === 0 && worldProblems().length === 0"), 'the audit is clean', await pg.evaluate("wAudit().concat(worldProblems())"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm gfeel passed')

asyncio.run(main())
