# Realm court (issue #77, phase 1): the Charter Court plays one basketball game, CPU against CPU: five a side on a full
# court, four quarters on the game clock, a 14-second shot clock, shots, rebounds, fouls and free throws.
# The play: a shot settles at the release from the distance, touch and the contest (an open look goes in more often
# than a smothered one; a three is harder than a layup; size and hops help at the rim); the tip-off goes to a side;
# the walk up the floor puts both fives at their spots. The game: the same seed plays the same game; a headless game
# leaves the one on the court alone; the box score adds up (points are 2 a field goal, 1 more a three, 1 a free throw,
# and the team's are the players'); minutes add up to five on the floor for the game's length. Over many headless games
# the scores look like basketball (about a point a possession, a mix of twos, threes and free throws, some blocks,
# steals and offensive rebounds, both sides winning some); a longer game has more possessions. In the Realm: Nim
# Hoopwright at the Charter Court puts on a SCRIMMAGE in its own view behind W_ENGINES, which waits while another page
# is up; the game length is a setting (Settings and the bar); a game watched to the end shows the final and the box
# score; Back to the world parks the engine; How to play explains it. None of the engine's names reach the page.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-court-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

PLAIN = "v => { const ok = x => x === null || ['number', 'string', 'boolean'].includes(typeof x) || (Array.isArray(x) ? x.every(ok) : typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype && Object.values(x).every(ok)); return ok(v); }"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBK !== 'undefined'")
        await pg.evaluate(f"window.__plain = {PLAIN}; 0")

        # ---------- the scope ----------
        leaks = await pg.evaluate("['bkStart', 'bkTick', 'bkStep', 'bkThink', 'bkShoot', 'bkShotP', 'bkPass', 'bkRebound', 'bkDraw', 'bkSimGame', 'BK_KIND', 'BK_SPOT', 'BK_PACE', 'BKP', 'BKT', 'GD', 'L', 'BK_BIG', 'bkScr'].filter(n => (0, eval)('typeof ' + n) !== 'undefined')")
        check(not leaks, 'none of the court\'s names reach the page', leaks)

        # ---------- the play ----------
        # a game on, stepped through the tip to the first live play
        r = await pg.evaluate("""(() => { wBK.start({ seed: 5 }); const ph0 = wBK.phase; let n = 0;
          while (wBK.phase === 'intro' && n++ < 200) wBK.step();
          const G = wBK.G, P = wBK.play; const h = P.ball.st === 'held' ? P.pl[P.ball.h] : null;
          return { ph0, ph: wBK.phase, poss: G.poss, side: h ? h.side : -1, n: P.pl.length, five: [0, 1].map(s => P.pl.filter(p => p.side === s).length), plain: __plain(G) && __plain(P) }; })()""")
        check(r['ph0'] == 'intro' and r['ph'] == 'live' and r['side'] == r['poss'] and r['five'] == [5, 5] and r['plain'],
              'a game opens on the tip; then it is live, ten on the floor (five a side), the ball with the side that won it; the game and the play are plain data', r)
        # the shot's odds: open against smothered, a three against a layup, a big at the rim against a small one
        o = await pg.evaluate("""(() => { const P = wBK.play, G = wBK.G, s = G.poss, me = P.pl.findIndex(p => p.side === s && p.pos === 'SF'), hx = wBK.hoopX(s), dir = wBK.dir(s);
          const away = () => { for (const p of P.pl) if (p.side !== s) { p.x = wBK.rules.len / 2 - dir * 6; p.y = 6; } };
          const at = (u, v) => [hx - dir * u, v];
          away(); const open3 = wBK.shotP(me, ...at(7, 0)), open2 = wBK.shotP(me, ...at(3.5, 0)), rim = wBK.shotP(me, ...at(1, 0));
          const d = P.pl.find(p => p.side !== s); [d.x, d.y] = at(6.4, 0); const tight3 = wBK.shotP(me, ...at(7, 0));
          away(); const keep = P.pl[me].r; P.pl[me].r = Object.assign({}, keep, { siz: 10, hop: 7 }); const big = wBK.shotP(me, ...at(1, 0));
          P.pl[me].r = Object.assign({}, keep, { siz: 2, hop: 3 }); const small = wBK.shotP(me, ...at(1, 0));
          P.pl[me].r = Object.assign({}, keep, { tch: 9 }); const pure = wBK.shotP(me, ...at(7, 0)); P.pl[me].r = Object.assign({}, keep, { tch: 3 }); const brick = wBK.shotP(me, ...at(7, 0)); P.pl[me].r = keep;
          return { open3: [open3.p, open3.three], open2: open2.p, rim: [rim.p, rim.rim], tight3: [tight3.p, tight3.con], big: [big.p, big.dunk], small: [small.p, small.dunk], pure: pure.p, brick: brick.p }; })()""")
        check(o['open3'][1] and o['open3'][0] < o['open2'] < o['rim'][0] and o['rim'][1], 'a three is harder than a two, and a two harder than a layup', o)
        check(o['tight3'][0] < o['open3'][0] - .1 and o['tight3'][1] > .3, 'a defender in the shooter\'s face (the contest) costs a lot', o)
        check(o['big'][0] > o['small'][0] + .1 and o['big'][1] and not o['small'][1], 'at the rim size and hops count, and a big leaper dunks', o)
        check(o['pure'] > o['brick'] + .1, 'touch makes a jumper', o)
        # the free throw is touch
        ft = await pg.evaluate("[wBK.ftChance({ tch: 3 }), wBK.ftChance({ tch: 6 }), wBK.ftChance({ tch: 9 })]")
        check(ft[0] < ft[1] < ft[2] and .6 < ft[1] < .85, 'a free throw is touch: more touch, more of them go in (about three in four at 6)', ft)

        # ---------- whole games ----------
        g = await pg.evaluate("""(() => { const a = wBK.simGame({ seed: 11 }), b = wBK.simGame({ seed: 11 }), c = wBK.simGame({ seed: 12 });
          return { same: JSON.stringify(a) === JSON.stringify(b), differ: JSON.stringify(a) !== JSON.stringify(c), a, plain: __plain(a) }; })()""")
        a = g['a']
        check(g['same'] and g['differ'] and g['plain'], 'the same seed plays the same game, another seed another; the summary is plain data', {k: a[k] for k in ['score', 'q', 'ot', 'poss']})
        box_ok = []
        for s, b in enumerate(a['box']):
            for r_ in b['rows']:
                box_ok.append(r_['pts'] == 2 * r_['fgm'] + r_['tpm'] + r_['ftm'] and r_['reb'] == r_['oreb'] + r_['dreb'] and r_['fgm'] <= r_['fga'] and r_['tpm'] <= r_['tpa'] <= r_['fga'] and r_['ftm'] <= r_['fta'])
            box_ok.append(b['tot']['pts'] == a['score'][s] == sum(r_['pts'] for r_ in b['rows']))
        mins = [round(sum(r_['sec'] for r_ in b['rows'])) for b in a['box']]
        length = a['mins'] * 60 + a['ot'] * 30
        check(all(box_ok), 'the box score adds up: 2 a field goal, 1 more a three, 1 a free throw; rebounds are offensive and defensive; the team\'s points are the players\' and the score', a['box'])
        check(all(abs(m - 5 * length) <= 1 for m in mins), 'minutes add up to five on the floor for the length of the game', {'mins': mins, 'length': length})
        check(all(l['side'] in (0, 1) and l['pts'] in (1, 2, 3) and l['k'] in ('ft', 'layup', 'dunk', 'jumper', 'three') for l in a['log']) and sum(l['pts'] for l in a['log'] if l['side'] == 0) == a['score'][0],
              'every score is in the log, by side, and they add up to the score', a['log'][:4])
        m = await pg.evaluate("""(() => { const out = []; for (let i = 0; i < 24; i++) out.push(wBK.simGame({ seed: 100 + i }));
          const tot = (s, k) => s.box[0].tot[k] + s.box[1].tot[k], sum = f => out.reduce((a, s) => a + f(s), 0);
          const pts = sum(s => s.score[0] + s.score[1]), poss = sum(s => s.poss[0] + s.poss[1]);
          const kinds = {}; for (const s of out) for (const l of s.log) kinds[l.k] = (kinds[l.k] || 0) + 1;
          const short = [1, 2, 3].map(i => wBK.simGame({ seed: 300 + i, mins: 3 })), long = [1, 2, 3].map(i => wBK.simGame({ seed: 300 + i, mins: 12 }));
          return { avg: pts / out.length / 2, ppp: pts / poss, wins: [out.filter(s => s.win === 0).length, out.filter(s => s.win === 1).length], kinds,
            fg: sum(s => tot(s, 'fgm')) / sum(s => tot(s, 'fga')), three: sum(s => tot(s, 'tpa')) / sum(s => tot(s, 'fga')),
            blk: sum(s => tot(s, 'blk')), stl: sum(s => tot(s, 'stl')), oreb: sum(s => tot(s, 'oreb')), ast: sum(s => tot(s, 'ast')), pf: sum(s => tot(s, 'pf')),
            watch: sum(s => s.watch) / out.length, possShort: short.reduce((a, s) => a + s.poss[0] + s.poss[1], 0) / 3, possLong: long.reduce((a, s) => a + s.poss[0] + s.poss[1], 0) / 3 }; })()""")
        check(15 <= m['avg'] <= 35 and .8 <= m['ppp'] <= 1.25, 'over many games a side scores about 15 to 35 in five minutes, about a point a possession', m)
        check(all(m['kinds'].get(k, 0) > 0 for k in ['ft', 'layup', 'dunk', 'jumper', 'three']) and .3 <= m['fg'] <= .55 and .2 <= m['three'] <= .6,
              'a mix of layups, dunks, jumpers, threes and free throws; field goals and threes at believable rates', m)
        check(m['blk'] > 0 and m['stl'] > 0 and m['oreb'] > 0 and m['ast'] > 0 and m['pf'] > 0 and min(m['wins']) >= 4, 'blocks, steals, offensive rebounds, assists and fouls all happen, and both sides win some', m)
        check(m['possLong'] > m['possShort'] * 2.5 and 240 <= m['watch'] <= 420, 'a 12-minute game has far more possessions than a 3-minute one; five minutes takes about five to watch', m)
        # a headless game leaves the one on the court alone
        k = await pg.evaluate("""(() => { wBK.start({ seed: 21 }); wBK.step(300); const before = JSON.stringify(wBK.G);
          wBK.simGame({ seed: 4, keep: true }); return before === JSON.stringify(wBK.G); })()""")
        check(k, 'a headless game (keep) leaves the game on the court as it was', k)

        # ---------- the Realm ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        t = await pg.evaluate("(() => { const K = DB.chars.gk_court; return { act: K.topics.scrimmage && K.topics.scrimmage.act, job: /SCRIMMAGE/.test(K.topics.job.t) }; })()")
        check(t['act'] == 'scrimmage' and t['job'], 'Nim Hoopwright at the Charter Court offers a SCRIMMAGE', t)
        await pg.evaluate("wRunAct('scrimmage')")
        await pg.wait_for_function("UI.view === 'court' && wBK.on")
        v = await pg.evaluate("({ bar: !document.getElementById('wCourtBar').hidden, court: !document.getElementById('v-court').hidden, others: [wBD.on, wGF.on, wBX.on], mins: wBK.G.mins, sel: document.getElementById('wCourtMins').value })")
        check(v['bar'] and v['court'] and v['others'] == [False, False, False] and v['mins'] == 5 and v['sel'] == '5', 'a SCRIMMAGE opens the court view with its bar; the other engines stay parked; five minutes by default', v)
        await pg.wait_for_function("wBK.phase === 'live' && wBK.G.clock < wBK.G.qlen - 1")
        await pg.screenshot(path='/tmp/realm-court-live.png')
        await pg.evaluate("showPage('help')")
        await pg.wait_for_function("wBK.paused")
        w = await pg.evaluate("(async () => { const c = JSON.stringify(wBK.G.clock); for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r)); return { paused: wBK.paused, still: c === JSON.stringify(wBK.G.clock), how: !!document.getElementById('wCourtHow'), help: !!document.getElementById('wHelpCourt') }; })()")
        check(w['paused'] and w['still'] and w['how'] and w['help'], 'the game waits while How to play is up, and How to play has the court and Basketball: how it works', w)
        await pg.evaluate("showPage('play')")
        check(not await pg.evaluate("wBK.paused"), 'back on Play, the game goes on', None)
        # the length setting: on Settings (and the bar), and the next game is that long
        await pg.evaluate("showSettings()")
        await pg.wait_for_selector('#sCourtMins')
        await pg.select_option('#sCourtMins', '3')
        # a redraw of the panel keeps the row
        await pg.click('#sSfx')
        await pg.wait_for_selector('#sCourtMins')
        st = await pg.evaluate("({ set: SET.courtMins, saved: JSON.parse(localStorage.getItem('sd-settings')).courtMins, row: document.getElementById('sCourtMins').value })")
        check(st == {'set': 3, 'saved': 3, 'row': '3'}, 'Settings has the basketball game length; it is saved, and stays on the panel when it redraws', st)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        await pg.click('#wCourtAgain')
        n = await pg.evaluate("({ mins: wBK.G.mins, qlen: wBK.G.qlen, sel: document.getElementById('wCourtMins').value })")
        check(n == {'mins': 3, 'qlen': 45, 'sel': '3'}, 'Another game plays at the new length, and the bar shows it', n)
        # watched to the end: the final, and the box score under the court
        await pg.evaluate("wBK.speed = 8")
        await pg.wait_for_function("wBK.phase === 'over' && document.getElementById('wCourtNote').textContent.startsWith('Final')", timeout=180000)
        e = await pg.evaluate("({ note: document.getElementById('wCourtNote').textContent, rows: document.querySelectorAll('#wCourtBox tr').length, tables: document.querySelectorAll('#wCourtBox table').length, msg: wBK.msg })")
        check(e['note'].startswith('Final') and e['tables'] == 2 and e['rows'] >= 14, 'a game watched to the end shows the final, and a box score for each side under the court', e)
        await pg.screenshot(path='/tmp/realm-court-final.png', full_page=True)
        await pg.click('#wCourtBack')
        b = await pg.evaluate("({ view: UI.view, on: wBK.on, bar: document.getElementById('wCourtBar').hidden })")
        check(b == {'view': 'world', 'on': False, 'bar': True}, 'Back to the world parks the court', b)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
