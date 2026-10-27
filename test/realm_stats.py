# Realm player stats: every match a player starts adds to their journey line (games, wins, damage, points, player
# of the game, by sport) and the game is tagged with who played; benched players add nothing; an older save without
# lines rebuilds them from its games; the Team screen has a Stats tab (journey and career, sortable, a page per
# player) and a Stats button on each lineup row; How to play explains it. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-stats-*.png.
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

HELP = r'''window.__wbot = function (maxTurns) {
  let g = 0;
  while (B && !B.over && g++ < (maxTurns || 60)) {
    let guard = 0;
    while (B.phase === 'player' && !B.over && guard++ < 30) {
      const al = alive(); if (!al.length) break;
      const tgt = al.slice().sort((a, b) => (a.hp + a.block) - (b.hp + b.block))[0];
      let best = -1, bs = -1;
      B.hand.forEach((c, i) => { if (!canPlay(c)) return; const d = def(c); if (d.type === 'junk' || d.type === 'curse') return; const s = d.type === 'atk' ? 3 : d.type === 'pow' ? 2 : 1; if (s > bs) { bs = s; best = i; } });
      if (best < 0) break;
      playCard(best, B.enemies.indexOf(tgt));
    }
    if (B.over) break;
    runSteps(endTurn());
  }
  return B && B.over;
};
window.__wlose = function () { let g = 0; while (B && !B.over && g++ < 40) { RUN.hp = 1; runSteps(endTurn()); } return B && B.over; };
window.__wend = function () { consumeFx(); renderFightHUD(); finishFight(); };
window.__match = function (sport) { WG.grace = 99; for (const k in W_PARTY.recruitOdds) W_PARTY.recruitOdds[k] = 0;
  startMatch({ type: 'normal', tier: 1, card: false, sport, world: { kind: 'wild' } }); };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStart === 'function' && typeof wStatsOf === 'function'")
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def back_to_world(pg):
    await pg.wait_for_selector('#bCont'); await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world' && !RUN.pending")
    # level-up picks and the like: take the first offer until the world is clear
    for _ in range(6):
        await pg.evaluate("wDrain()")
        if await pg.evaluate("document.getElementById('modal').hidden"): break
        await pg.evaluate("(() => { const b = document.querySelector('#modalBox [data-pick], #modalBox .cardgrid .card, #modalBox [data-close]'); if (b) b.click(); })()")
        await pg.wait_for_timeout(150)

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for vp, tag in [({'width': 1280, 'height': 800}, 'desk'), ({'width': 390, 'height': 844}, 'phone')]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == 'phone' else 1, is_mobile=tag == 'phone', has_touch=tag == 'phone')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, tag=tag: errs.append(tag + ': ' + str(e)))
            pg.on('console', lambda m, tag=tag: errs.append(tag + ' console: ' + m.text) if m.type == 'error' else None)
            await boot(pg)
            await new_journey(pg)
            if tag == 'desk':
                # ---------- a win: the starters' lines grow, the bench's do not ----------
                await pg.evaluate("""(() => { const R = wRoster(); const extra = { ...R[0], id: WG.pid++, n: 'Benchley', kind: R.find(p => p).kind === 'ogre' ? 'troll' : 'ogre', lvl: 1, xp: 0, from: 'tavern', joined: 1 }; WG.roster.push(extra); })()""")
                ids = await pg.evaluate("({ st: wStarters().map(p => ({ id: p.id, kind: p.kind })), bench: wBenchList().map(p => p.id) })")
                await pg.evaluate("__match('baseball')")
                await pg.wait_for_function("UI.view === 'fight' && !!B")
                await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = 300; for (const e of alive()) e.hp = Math.min(e.hp, 6)")
                over = await pg.evaluate("__wbot(120)")
                await pg.evaluate("__wend()")
                await back_to_world(pg)
                w = await pg.evaluate("""(() => { const g = RUN.games[RUN.games.length - 1];
                  return { over: g && !g.fell, sport: g.sport, wp: g.wp, ps: g.ps, lines: wStarters().map(p => wStatsOf(p.id)), bench: wBenchList().map(p => wStatsOf(p.id)), mvp: g.mvp }; })()""")
                check(over == 'win' and w['sport'] == 'baseball', 'a baseball match is won', {'over': over, 'sport': w['sport']})
                check(all(w['wp'].get(s['kind']) == s['id'] for s in ids['st']), 'the game is tagged with the player who started for each kind', w['wp'])
                st_ok = all(L['g'] == 1 and L['w'] == 1 and L['sp'].get('baseball', {}).get('g') == 1 for L in w['lines'])
                dmg_ok = all(L['d'] == (w['ps'].get(s['kind']) or {}).get('d', 0) for L, s in zip(w['lines'], ids['st']))
                check(st_ok and dmg_ok, 'each starter has one game, one win, baseball, and the damage they did', w['lines'])
                check(sum(L['mvp'] for L in w['lines']) == (1 if w['mvp'] else 0), 'player of the game is counted once', w['lines'])
                check(all(L['g'] == 0 for L in w['bench']), 'the bench adds nothing', w['bench'])

                # ---------- a loss ----------
                await pg.evaluate("RUN.hp = 30; __match('hockey')")
                await pg.wait_for_function("UI.view === 'fight' && !!B")
                await pg.evaluate("__wlose(); __wend(); const wk = document.getElementById('wWake'); if (wk) wk.click();")
                await pg.wait_for_function("UI.view === 'world'")
                l = await pg.evaluate("wStarters().map(p => wStatsOf(p.id))")
                check(all(L['g'] == 2 and L['w'] == 1 and L['sp'].get('hockey', {}).get('w') == 0 for L in l), 'a loss counts as a game, not a win', l)

                # ---------- an older save: lines rebuilt from its games ----------
                rb = await pg.evaluate("""(() => { const before = JSON.stringify(WG.pstats); delete WG.pstats; wEnsureStats(); const after = JSON.stringify(WG.pstats);
                  const keep = WG.pstats, tags = RUN.games.map(g => g.wp); delete WG.pstats; for (const g of RUN.games) delete g.wp; wEnsureStats();
                  const old = wStarters().filter(p => RUN.games.some(g => g.ps[p.kind])).map(p => WG.pstats[p.id] && WG.pstats[p.id].d === keep[p.id].d);
                  WG.pstats = keep; RUN.games.forEach((g, i) => g.wp = tags[i]); return { before, after, old }; })()""")
                check(rb['before'] == rb['after'], 'lines rebuilt from tagged games come out the same', rb)
                check(len(rb['old']) > 0 and all(rb['old']), 'games from before tagging still credit each kind\'s numbers to that player', rb['old'])
                saved = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(pkey('sd-realm'))); return !!(s && s.WG && s.WG.pstats); })()")
                check(saved, 'the lines are saved with the journey')

            # ---------- the Stats tab ----------
            await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click()); wOpenCamp('team')")
            await pg.wait_for_selector('li[data-pid] [data-pstats]')
            check(await pg.evaluate("document.querySelectorAll('li[data-pid] [data-pstats]').length === wRoster().length"), f'[{tag}] every lineup row has a Stats button')
            tabs = await pg.evaluate("[...document.querySelectorAll('#modalBox [data-ctab]')].map(b => b.dataset.ctab)")
            check(tabs[:3] == ['team', 'deck', 'stats'] and 'bag' in tabs, f'[{tag}] the tabs are Lineup, Deck, Stats, Bag', tabs)
            await pg.click('li[data-pid] [data-pstats]')
            await pg.wait_for_selector('.wstcard')
            first = await pg.evaluate("wRoster()[0].n")
            card = await pg.evaluate("document.querySelector('.wstcard').textContent")
            check(first in card and (tag == 'phone' or ('Baseball' in card and 'Hockey' in card and 'Lost' in card and 'Won' in card)), f'[{tag}] a player\'s Stats button opens their page: record by sport and last games', card[:300])
            await pg.screenshot(path=f'/tmp/realm-stats-{tag}.png')
            rows = await pg.evaluate("document.querySelectorAll('.wstats tbody tr').length === wRoster().length")
            check(rows, f'[{tag}] the table has a row for every player')
            if tag == 'phone':
                over = await pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                check(not over, '[phone] the Stats tab does not widen the page')
            else:
                await pg.click('[data-wsort="d"]')
                order = await pg.evaluate("[...document.querySelectorAll('.wstats tbody tr')].map(tr => wStatsOf(+tr.dataset.wsp).d)")
                check(order == sorted(order, reverse=True), 'sorting by damage puts the biggest hitter first', order)
                await pg.click('[data-wsview="career"]')
                car = await pg.evaluate("""(() => { const tr = document.querySelector('.wstats tbody tr'), p = wPlayer(+tr.dataset.wsp), c = wCareer(p);
                  return { cell: tr.querySelectorAll('td')[0].textContent, games: c ? c.games : 0, wins: tr.querySelectorAll('td')[1].textContent }; })()""")
                check(car['cell'] == str(car['games']) and car['games'] >= 2 and car['wins'] == '–', 'the Career view shows the career numbers (no wins kept there)', car)
                await pg.click('[data-wsp-close]')
                check(await pg.evaluate("!document.querySelector('.wstcard')"), 'Close shuts the player page')
                await pg.evaluate("renderHelp()")
                check(await pg.evaluate("!!document.getElementById('wHelpStats')"), 'How to play explains the Stats tab')

            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, f'[{tag}] no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    print('ok: realm stats passed' if not FAILS else f'FAILED: {len(FAILS)} checks')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
