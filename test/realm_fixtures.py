# Realm fixtures (issue #6, phase 5): every league round is drawn up in advance, each game at one of the home side's
# grounds, with you in it, away. On the round day the clubs' games are played there: the result has the ground, the
# scoreboard there shows it, the inns post it, and your unplayed fixture is postponed. Play your fixture at its ground
# (the keeper's GAME card): a rival match in the ground's sport against that club, which goes on the table, the
# results and the head to head, and the crowd adds fans. The fans greet you by your place in the table; the keepers
# post the FIXTURES; the save keeps the draw; How to play says so; the audit is clean.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-fixtures-*.png.
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
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 600); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 120) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; for (const e of alive()) e.hp = Math.max(1, Math.floor(e.hp * .5)); runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''
ENTER = """(gid => { const L = DB.locs.find(l => l.id === gid); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1); wDrain(); return WG.map; })"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wFixtures !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the draw ----------
        F = await pg.evaluate("""(() => { const F = wFixtures(), clubs = wLeagueClubs().concat('me'), seen = F.games.flatMap(f => [f.a, f.b]);
          return { day: F.day, now: WG.dayAbs, every: W_LEAGUE.every, n: F.games.length, each: clubs.every(c => seen.filter(x => x === c).length === 1),
            home: F.games.every(f => wGrd(f.g) && wGrd(f.g).city === wClubTown(f.a)), mine: wMyFixture() }; })()""")
        check(F['n'] == 3 and F['each'], 'a round pairs off the five clubs and you, everyone once', F)
        check(F['home'] and F['day'] > F['now'] and F['day'] % F['every'] == 0, 'each game is at one of the home side\'s grounds, on the next round day', F)
        m = F['mine']
        check(m and m['b'] == 'me' and m['g'] != 'g_ballpark', 'your fixture is away, and not at the Ballpark', m)

        # ---------- the round day ----------
        await pg.evaluate("wLeague().results = []")
        played = await pg.evaluate("""(() => { const F = wFixtures(), before = JSON.stringify(wLeague().table);
          let k = 0; while (WG.dayAbs < F.day && k++ < 10) wAdvance(24 * 60);
          const L = wLeague(), clubGames = F.games.filter(f => f.a !== 'me' && f.b !== 'me');
          return { res: L.results.map(r => [r.a, r.b, r.g, r.sport]), want: clubGames.map(f => [f.g, wGrd(f.g).sport]), next: L.next.day, old: F.day,
            log: WLOG.slice(-12).map(l => l[0]).join(' '), mine: F.games.find(f => f.b === 'me').g }; })()""")
        got = sorted([r[2], r[3]] for r in played['res'])
        check(got == sorted(played['want']), 'on the round day the clubs play at the drawn grounds, in those grounds\' sports', played)
        check('postponed' in played['log'], 'your unplayed fixture is postponed', played['log'][-300:])
        check(played['next'] > played['old'], 'and the next round is drawn', played)
        g0 = played['res'][0][2]
        await pg.evaluate(ENTER + f"('{g0}')")
        await pg.evaluate("WLOG.length = 0; wUse(11, 2); wDrain()")
        board = await pg.evaluate("WLOG.map(l => l[0]).join(' ')")
        check('Last league game here' in board, 'the scoreboard at the ground shows the league game played there', board)
        html = await pg.evaluate("wLeagueHtml()")
        check('Next round' in html and ' at ' in html and 'Your fixture' in html, 'the inns\' table posts the next round, the grounds, and your fixture', html[-400:])
        await pg.evaluate("(() => { const r = wSay('gk_' + WG.map.slice(2), 'fixtures'); wRunAct(r.act, 'gk_' + WG.map.slice(2)); })()")
        check(await pg.evaluate("document.getElementById('modalBox').textContent.includes('Fixtures at')"), 'a groundskeeper posts the FIXTURES')
        await pg.evaluate(CLOSE_ALL)

        # ---------- your fixture ----------
        await pg.evaluate("(() => { const K = ['troll', 'harpy', 'golem', 'wraith', 'spider']; let i = 0; while (wRoster().length < 7 && i < 10) wRecruit({ kind: K[i++ % K.length], lvl: 3 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)
        # (a card match: a fixture drawn at the Ash Bowl is a football game, in test/realm_gridiron_cup.py)
        mine = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me');
          if (f.g === 'g_bowl') f.g = W_GRDS.find(g => g.id !== 'g_bowl' && g.sport !== 'baseball').id; return wMyFixture(); })()""")
        other = await pg.evaluate(f"W_GRDS.find(g => g.id !== '{mine['g']}' && g.id !== 'g_bowl' && g.sport !== 'baseball').id")
        await pg.evaluate(ENTER + f"('{other}')")
        await pg.evaluate(f"wOpenGrdCard('{other}')")
        elsewhere = await pg.evaluate("({ row: !!document.querySelector('[data-gfix]'), text: document.getElementById('modalBox').textContent })")
        check(not elsewhere['row'] and 'Your league fixture this round is at' in elsewhere['text'], 'any other ground\'s card says where your fixture is', elsewhere['text'][-200:])
        await pg.evaluate(CLOSE_ALL)
        at = await pg.evaluate(ENTER + f"('{mine['g']}')")
        await pg.evaluate(f"(() => {{ const id = 'gk_' + '{mine['g']}'.slice(2), r = wSay(id, 'game'); wRunAct(r.act, id); }})()")
        card = await pg.evaluate("({ fix: !!document.querySelector('[data-gfix]') && !document.querySelector('[data-gfix]').disabled, rows: document.querySelectorAll('#modalBox .wbcl').length, text: document.getElementById('modalBox').textContent })")
        check(at == mine['g'] and card['fix'] and card['rows'] == 3, 'at the fixture\'s ground, the keeper\'s card has a League fixture row as well as Friendly and Challenge', card)
        await pg.screenshot(path='/tmp/realm-fixtures-card.png')
        L0 = await pg.evaluate(f"({{ me: wLeague().me, club: wLeague().table['{mine['club']}'], fans: RUN.fans || 0, h2h: (WG.h2h || {{}})['{mine['club']}'] || null }})")
        await pg.click('[data-gfix]')
        await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("({ text: document.getElementById('modalBox').textContent, crowd: !!document.querySelector('#modalBox .wcrowd') })")
        check('League fixture at' in pre['text'] and pre['crowd'], 'the pre-game card: a League fixture, and how the crowd takes you', pre['text'][:300])
        await pg.screenshot(path='/tmp/realm-fixtures-pregame.png')
        await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        fx = await pg.evaluate(f"({{ type: B.type, sport: B.sport, want: wGrd('{mine['g']}').sport, team: B.enemies.filter(e => !isBoss(e) && !ENEMIES[e.id].team).map(e => e.team && e.team.name), name: wClubName('{mine['club']}'), ref: RUN.pending.world.ref }})")
        check(fx['type'] == 'rival' and fx['sport'] == fx['want'] and fx['ref']['mode'] == 'fixture', 'the fixture: a rival match in the ground\'s sport', fx)
        check(all(t == fx['name'] for t in fx['team']), 'against the club, in its colours', fx)
        view = await pg.evaluate(WIN)
        check(view == 'panel', 'the fixture is won', view)
        await pg.click('#bCont'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        L1 = await pg.evaluate(f"({{ me: wLeague().me, club: wLeague().table['{mine['club']}'], fans: RUN.fans || 0, h2h: (WG.h2h || {{}})['{mine['club']}'] || null, res: wLeague().results[0], done: wMyFixture().done, log: WLOG.map(l => l[0]).join(' ') }})")
        check(L1['me']['w'] == L0['me']['w'] + 1 and L1['club']['l'] == L0['club']['l'] + 1, 'the win goes on your row of the table, and the loss on theirs', [L0, L1])
        check(L1['res']['a'] == 'me' and L1['res']['b'] == mine['club'] and L1['res']['g'] == mine['g'] and L1['done'], 'and on the league\'s results, at the ground; the fixture is played', L1)
        check(L1['h2h'] and L1['h2h']['w'] == ((L0['h2h'] or {}).get('w', 0)) + 1, 'the head to head counts it', L1['h2h'])
        check(L1['fans'] - L0['fans'] >= 5 and 'Two points' in L1['log'], 'the crowd adds fans', [L0['fans'], L1['fans']])
        gone = await pg.evaluate(f"(() => {{ wOpenGrdCard('{mine['g']}'); return !!document.querySelector('[data-gfix]'); }})()")
        check(not gone, 'a played fixture is off the card')
        await pg.evaluate(CLOSE_ALL)

        # ---------- the fans ----------
        fan = await pg.evaluate(f"wSay('gf_' + '{mine['g']}'.slice(2), '').text")
        check('table' in fan.lower(), 'the fans at the grounds greet you by your place in the table', fan)

        # ---------- the save ----------
        nx = await pg.evaluate("JSON.stringify(wLeague().next)")
        await pg.evaluate("wSave()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        check(await pg.evaluate("JSON.stringify(wLeague().next)") == nx, 'the save keeps the draw')
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpFixtures'); return h ? h.textContent : ''; })()")
        check('League fixtures' in help_, 'How to play explains the fixtures', help_)
        check(await pg.evaluate("wAudit().length === 0 && worldProblems().length === 0"), 'the audit is clean', await pg.evaluate("wAudit().concat(worldProblems())"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm fixtures passed')

asyncio.run(main())
