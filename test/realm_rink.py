# Realm rink (issue #83, phase 1): Black Ice plays one hockey game at the Pond Rink, CPU against CPU: five skaters and a
# goalie a side, three periods on the game clock, face-offs, icing, sudden death and a shootout.
# The play: nobody stops dead on ice (a skater told to turn back is still gliding the old way a moment later), and
# speed gets a skater there sooner; a loose puck slows, stops, and comes back off the boards; a shot is harder to stop
# from close in, from in front, as a one-timer, and with a better shot; a goalie out of place (a puck moved across
# faster than they follow it) gives up far more, and better reflexes get across sooner; a skater in the lane can block.
# The game: the same seed plays the same game; a headless game leaves the one on the rink alone; the box score adds up
# (the team's goals are the players' and the score; saves are shots faced less goals against; every face-off has a
# winner); no game ends level. Over many headless games the scores look like hockey (a few goals a side, saves about
# four in five, all three kinds of shot scoring, hits, blocks, takeaways, assists and icings, both sides winning some);
# a longer game has more shots. Sudden death is three skaters a side, and a shootout settles what is still level.
# In the Realm: Old Tove at the Pond Rink puts on a SCRIMMAGE in its own view behind W_ENGINES, laid out as the other
# sports' pages are, which waits while another page is up; the game length is a setting (Settings and the bar); a game
# watched to the end shows the final, the box score and every goal; a phone gets the scoreboard strip and no sideways
# scroll; Back to the world parks the engine; How to play explains it. None of the engine's names reach the page.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-rink-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

PLAIN = "v => { const ok = x => x === null || ['number', 'string', 'boolean'].includes(typeof x) || (Array.isArray(x) ? x.every(ok) : typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype && Object.values(x).every(ok)); return ok(v); }"
# a game on the rink, stepped to the first live play, with everyone but the players named moved out of the way
SETUP = """window.__rink = (seed) => { wHK.start({ seed }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
  const P = wHK.play; for (const p of P.pl) { p.vx = p.vy = 0; p.stun = 0; } return P; };
window.__away = (P, keep) => { P.pl.forEach((p, i) => { if (!keep.includes(i)) { p.x = 2.5; p.y = -8.5 + (i % 6) * .2; p.vx = p.vy = 0; } }); }; 0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wHK !== 'undefined'")
        await pg.evaluate(f"window.__plain = {PLAIN}; 0"); await pg.evaluate(SETUP)

        # ---------- the scope ----------
        leaks = await pg.evaluate("['hkStart', 'hkTick', 'hkStep', 'hkThink', 'hkShoot', 'hkShotOdds', 'hkPass', 'hkPickup', 'hkDraw', 'hkSimGame', 'HK_KIND', 'HK_PACE', 'HKP', 'HKT', 'GD', 'L', 'HK_BIG', 'hkScr', 'hkGoalie'].filter(n => (0, eval)('typeof ' + n) !== 'undefined')")
        check(not leaks, 'none of the rink\'s names reach the page', leaks)

        # ---------- the play ----------
        r = await pg.evaluate("""(() => { wHK.start({ seed: 5 }); const ph0 = wHK.phase; let n = 0;
          while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          const G = wHK.G, P = wHK.play, fo = P.ev.find(e => e.k === 'faceoff'), c = [0, 1].map(s => P.pl[s * 6]);
          return { ph0, ph: wHK.phase, six: [0, 1].map(s => P.pl.filter(p => p.side === s && !p.off).length), goalies: [0, 1].map(s => { const g = P.pl[s * 6 + 5]; return g.pos === 'G' && Math.abs(g.x - wHK.goalX(1 - s)) < 1.6; }),
            won: fo && fo.s, poss: G.poss, winnerSide: c.findIndex(p => fo && p.n === fo.s), fot: c.map(p => G.stat[p.side][p.ri].fot), fow: c.map(p => G.stat[p.side][p.ri].fow), plain: __plain(G) && __plain(P) }; })()""")
        check(r['ph0'] == 'intro' and r['ph'] == 'live' and r['six'] == [6, 6] and r['goalies'] == [True, True] and r['plain'], 'a game opens on a face-off at centre; then it is live, six a side with a goalie in each net; the game and the play are plain data', r)
        check(r['winnerSide'] in (0, 1) and r['poss'] == r['winnerSide'] and r['fot'] == [1, 1] and sorted(r['fow']) == [0, 1], 'one centre wins the face-off, and their side has the puck', r)
        # skating: no stopping dead, and speed matters
        k = await pg.evaluate("""(() => { const P = __rink(5), i = 1, p = P.pl[i]; __away(P, [i]); wHK.loose(38, 9, 0, 0);
          const run = (spd, secs) => { p.r.spd = spd; p.x = 8; p.y = 0; p.vx = p.vy = 0; for (let t = 0; t < secs * 30; t++) wHK.skate(i, 38, 0); return { x: p.x, v: p.vx }; };
          const slow = run(3, 1.5), fast = run(10, 1.5), early = run(7, .3), late = run(7, 2.5);
          p.x = 8; p.y = 0; p.vx = p.vy = 0; for (let t = 0; t < 45; t++) wHK.skate(i, 38, 0); const going = p.vx;
          for (let t = 0; t < 6; t++) wHK.skate(i, 0, 0); const after = p.vx; let n = 0; while (p.vx > 0 && n++ < 200) wHK.skate(i, 0, 0);
          return { slow: slow.x, fast: fast.x, early: early.v, late: late.v, going, after, turn: n / 30 }; })()""")
        check(k['fast'] > k['slow'] + 2 and k['early'] < k['late'] * .6, 'a skater builds speed over a second or so, and a faster one covers more ice', k)
        check(k['going'] > 5 and k['after'] > 2 and .3 < k['turn'] < 2, 'nobody stops dead on ice: told to turn back, a skater is still gliding the old way for a moment', k)
        # the puck: it slows and stops, and comes back off the boards
        pk = await pg.evaluate("""(() => { const P = __rink(5); __away(P, []); wHK.loose(8, 0, 0, 8); let n = 0; while (Math.hypot(P.puck.vx, P.puck.vy) > 0 && n++ < 900) wHK.puckStep();
          const slide = { x: P.puck.x, secs: n / 30 };
          wHK.loose(20, 4, Math.PI / 2, 12); let maxY = 0, back = false; for (let t = 0; t < 60; t++) { wHK.puckStep(); maxY = Math.max(maxY, P.puck.y); if (P.puck.vy < 0) back = true; }
          wHK.loose(36, 8.5, Math.PI / 4, 10); let inside = true; for (let t = 0; t < 90; t++) { wHK.puckStep(); if (P.puck.x > 40 || Math.abs(P.puck.y) > 10) inside = false; }
          return { slide, maxY, back, inside, y: P.puck.y }; })()""")
        check(13 < pk['slide']['x'] < 30 and pk['slide']['secs'] < 8, 'a loose puck slides, slows and stops', pk)
        check(pk['back'] and 9.5 < pk['maxY'] <= 10 and pk['inside'], 'a puck comes back off the boards, and stays inside them in a corner', pk)
        # the shot's odds
        o = await pg.evaluate("""(() => { const P = __rink(5), s = 0, me = 1, gi = 6 + 5, g = P.pl[gi], gx = wHK.goalX(s), dir = wHK.dir(s); __away(P, [me, gi]);
          const at = (u, v) => [gx - dir * u, v], set = (x, y) => { const t = wHK.goalSpot(1, x, y); g.x = t[0]; g.y = t[1]; };
          const odds = (kind, u, v) => { const [x, y] = at(u, v); set(x, y); return wHK.shotOdds(me, kind, x, y); };
          const near = odds('wrist', 5, 0), far = odds('wrist', 13, 0), wide = odds('wrist', 2, 4.6), one = odds('one', 5, 0), slap = odds('slap', 11, 0), wristFar = odds('wrist', 11, 0);
          const keep = P.pl[me].r; P.pl[me].r = Object.assign({}, keep, { sht: 10 }); const sniper = odds('wrist', 5, 0); P.pl[me].r = Object.assign({}, keep, { sht: 2 }); const poor = odds('wrist', 5, 0); P.pl[me].r = keep;
          const gk = g.r; g.r = Object.assign({}, gk, { ref: 10 }); const wall = odds('wrist', 5, 0); g.r = Object.assign({}, gk, { ref: 2 }); const sieve = odds('wrist', 5, 0); g.r = gk;
          const [x, y] = at(5, 0); set(x, y); g.y += 1.2; const outOfPlace = wHK.shotOdds(me, 'wrist', x, y);
          set(x, y); const d = P.pl[6 + 3]; d.x = gx - dir * 2.5; d.y = 0; const blocked = wHK.shotOdds(me, 'wrist', x, y);
          const behind = wHK.shotOdds(me, 'wrist', gx + dir * 1, 3);
          return { near: [near.q, near.miss, near.set], far: [far.q, far.miss], wide: wide.q, one: one.q, slap: slap.q, wristFar: wristFar.q, sniper: sniper.q, poor: poor.q, wall: wall.q, sieve: sieve.q,
            out: [outOfPlace.q, outOfPlace.set], blocked: [!!blocked.block, blocked.blockP], open: !!near.block, behind: behind.ok }; })()""")
        check(o['near'][2] > .95 and o['near'][0] > o['far'][0] + .05 and o['far'][1] > o['near'][1] and o['near'][0] > o['wide'] + .03, 'a shot is harder to stop from close in and from in front, and a long one misses the net more', o)
        check(o['one'] > o['near'][0] and o['slap'] > o['wristFar'], 'a one-timer beats a wrist shot from the same place, and from a long way out the slap shot beats it too', o)
        check(o['sniper'] > o['poor'] + .05 and o['sieve'] > o['wall'] + .08, 'a better shot scores more, and better reflexes stop more', o)
        check(o['out'][1] < .2 and o['out'][0] > o['near'][0] + .25, 'a goalie out of place gives up far more', o)
        check(o['blocked'][0] and o['blocked'][1] > .1 and not o['open'] and not o['behind'], 'a skater in the lane may block it; there is no shot from behind the goal line', o)
        # the goalie follows the puck a moment late, and reflexes get them across sooner
        gl = await pg.evaluate("""(() => { const P = __rink(5), g = P.pl[6 + 5], gx = wHK.goalX(0), dir = wHK.dir(0); __away(P, [6 + 5]);
          const run = ref => { g.r.ref = ref; const a = [gx - dir * 6, -6], b = [gx - dir * 6, 6]; wHK.loose(a[0], a[1], 0, 0); for (let t = 0; t < 150; t++) wHK.goalieStep(1);
            const before = wHK.goalSet(1, a[0], a[1]); wHK.loose(b[0], b[1], 0, 0); const at0 = wHK.goalSet(1, b[0], b[1]);
            for (let t = 0; t < 8; t++) wHK.goalieStep(1); const soon = wHK.goalSet(1, b[0], b[1]); for (let t = 0; t < 90; t++) wHK.goalieStep(1); return { before, at0, soon, later: wHK.goalSet(1, b[0], b[1]) }; };
          return { slow: run(3), quick: run(10) }; })()""")
        check(gl['slow']['before'] > .95 and gl['slow']['at0'] < .2 and gl['slow']['later'] > .95, 'a goalie set for the puck on one side is out of place the moment it is moved across, and gets there in time', gl)
        check(gl['quick']['soon'] > gl['slow']['soon'] + .1, 'better reflexes get a goalie across sooner', gl)

        # ---------- whole games ----------
        g = await pg.evaluate("""(() => { const a = wHK.simGame({ seed: 11 }), b = wHK.simGame({ seed: 11 }), c = wHK.simGame({ seed: 12 });
          return { same: JSON.stringify(a) === JSON.stringify(b), differ: JSON.stringify(a) !== JSON.stringify(c), a, plain: __plain(a) }; })()""")
        a = g['a']
        check(g['same'] and g['differ'] and g['plain'], 'the same seed plays the same game, another seed another; the summary is plain data', {k: a[k] for k in ['score', 'p', 'ot', 'so', 'shots']})
        ok = []
        for s, b in enumerate(a['box']):
            t, other = b['tot'], a['box'][1 - s]['tot']
            ok.append(t['g'] + (1 if a['so'] and a['win'] == s else 0) == a['score'][s] == sum(1 for l in a['log'] if l['side'] == s))
            ok.append(t['sog'] == a['shots'][s] and t['g'] <= t['sog'] <= t['att'] and t['a'] <= 2 * t['g'])
            ok.append(t['sa'] == other['sog'] and t['sv'] == t['sa'] - other['g'] and t['fot'] == a['drops'])
            ok.append(all(r_['sa'] == 0 for r_ in b['rows'] if r_['pos'] != 'G') and abs(next(r_['sec'] for r_ in b['rows'] if r_['pos'] == 'G') - a['secs']) <= 1)
        check(all(ok) and a['box'][0]['tot']['fow'] + a['box'][1]['tot']['fow'] == a['drops'], 'the box score adds up: the team\'s goals are the score and the log; saves are shots faced less goals against; every face-off has a winner; the goalie is on all game', a['box'])
        check(all(l['side'] in (0, 1) and l['k'] in ('wrist', 'slap', 'one', 'so') and len(l['a']) <= 2 for l in a['log']), 'every goal is in the log, by side, with how it was scored and up to two assists', a['log'][:4])
        m = await pg.evaluate("""(() => { const out = []; for (let i = 0; i < 24; i++) out.push(wHK.simGame({ seed: 100 + i }));
          const tot = (s, k) => s.box[0].tot[k] + s.box[1].tot[k], sum = f => out.reduce((a, s) => a + f(s), 0);
          const kinds = {}; for (const s of out) for (const l of s.log) kinds[l.k] = (kinds[l.k] || 0) + 1;
          const short = [1, 2, 3].map(i => wHK.simGame({ seed: 300 + i, mins: 3 })), long = [1, 2, 3].map(i => wHK.simGame({ seed: 300 + i, mins: 12 }));
          return { goals: sum(s => tot(s, 'g')) / out.length / 2, shots: sum(s => tot(s, 'sog')) / out.length / 2, sv: sum(s => tot(s, 'sv')) / sum(s => tot(s, 'sa')), kinds,
            hit: sum(s => tot(s, 'hit')), blk: sum(s => tot(s, 'blk')), take: sum(s => tot(s, 'take')), ast: sum(s => tot(s, 'a')), icings: sum(s => s.icings),
            wins: [out.filter(s => s.win === 0).length, out.filter(s => s.win === 1).length], level: out.filter(s => s.win == null || s.score[0] === s.score[1]).length, ot: out.filter(s => s.ot).length,
            watch: sum(s => s.watch) / out.length, shotsShort: short.reduce((a, s) => a + s.shots[0] + s.shots[1], 0) / 3, shotsLong: long.reduce((a, s) => a + s.shots[0] + s.shots[1], 0) / 3 }; })()""")
        check(1.5 <= m['goals'] <= 5 and 10 <= m['shots'] <= 30 and .72 <= m['sv'] <= .9, 'over many games a side scores a few goals on 10 to 30 shots in six minutes, and about four shots in five are saved', m)
        check(all(m['kinds'].get(k_, 0) > 0 for k_ in ['wrist', 'slap', 'one']) and m['hit'] > 0 and m['blk'] > 0 and m['take'] > 0 and m['ast'] > 0 and m['icings'] > 0,
              'wrist shots, slap shots and one-timers all score; hits, blocks, takeaways, assists and icings all happen', m)
        check(min(m['wins']) >= 5 and m['level'] == 0, 'both sides win some, and no game ends level', m)
        check(m['shotsLong'] > m['shotsShort'] * 2.5 and 370 <= m['watch'] <= 540, 'a 12-minute game has far more shots than a 3-minute one; six minutes takes about seven to watch, with the whistles', m)
        # sudden death, and the shootout, through the game's own flow
        sd = await pg.evaluate("""(() => { wHK.start({ seed: 31 }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          const G = wHK.G; G.p = 3; G.score = [2, 2]; G.clock = .05; n = 0; while (wHK.phase !== 'break' && n++ < 400) wHK.step(); const brk = wHK.phase;
          n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          const P = wHK.play, ot = { p: G.p, name: wHK.clock().name, on: [0, 1].map(s => P.pl.filter(q => q.side === s && !q.off && q.pos !== 'G').length), goalies: P.pl.filter(q => q.pos === 'G' && !q.off).length };
          G.clock = .05; n = 0; while (wHK.phase === 'live' && n++ < 400) wHK.step(); const so = wHK.phase;
          n = 0; while (wHK.phase !== 'over' && n++ < 4000) wHK.step();
          const S = wHK.summary(); return { brk, ot, so, over: G.over, last: S.log[S.log.length - 1], msg: wHK.msg, tries: G.so.tries }; })()""")
        check(sd['brk'] == 'break' and sd['ot'] == {'p': 4, 'name': 'OT', 'on': [3, 3], 'goalies': 2}, 'level after the third it is sudden death: three skaters and a goalie a side', sd)
        check(sd['so'] == 'so' and sd['over'] and sd['over']['so'] and abs(sd['over']['score'][0] - sd['over']['score'][1]) == 1 and sd['last']['k'] == 'so' and sd['last']['side'] == sd['over']['win'] and 'shootout' in sd['msg'],
              'still level after sudden death, a shootout settles it by one goal, and the winning try is in the log', sd)
        # a headless game leaves the one on the rink alone
        kp = await pg.evaluate("""(() => { wHK.start({ seed: 21 }); wHK.step(300); const before = JSON.stringify(wHK.G);
          wHK.simGame({ seed: 4, keep: true }); return before === JSON.stringify(wHK.G); })()""")
        check(kp, 'a headless game (keep) leaves the game on the rink as it was', kp)

        # ---------- the Realm ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        t = await pg.evaluate("(() => { const K = DB.chars.gk_rink; return { act: K.topics.scrimmage && K.topics.scrimmage.act, job: /SCRIMMAGE/.test(K.topics.job.t), court: DB.chars.gk_court.topics.scrimmage && DB.chars.gk_court.topics.scrimmage.act }; })()")
        check(t['act'] == 'rinkscrim' and t['job'] and t['court'] != 'rinkscrim', 'Old Tove at the Pond Rink offers a SCRIMMAGE of her own', t)
        await pg.evaluate("wRunAct('rinkscrim')")
        await pg.wait_for_function("UI.view === 'rink' && wHK.on")
        v = await pg.evaluate("({ bar: !document.getElementById('wRinkBar').hidden, rink: !document.getElementById('v-rink').hidden, others: [wBD.on, wGF.on, wBX.on, wBK.on], mins: wHK.G.mins, sel: document.getElementById('wRinkMins').value, teams: wHK.G.teams.map(T => T.name), six: wHK.G.teams.map(T => T.roster.length >= 6) })")
        check(v['bar'] and v['rink'] and v['others'] == [False] * 4 and v['mins'] == 6 and v['sel'] == '6' and v['teams'] == ['Rimewatch Hockey Club', 'Cinderhold Hockey Club'] and all(v['six']),
              'a SCRIMMAGE opens the rink view with its bar: Rimewatch against Cinderhold; the other engines stay parked; six minutes by default', v)
        lay = await pg.evaluate("""(() => { const top = e => Math.round(e.getBoundingClientRect().top), cv = document.querySelector('#v-rink canvas'), T = [...document.querySelectorAll('#wRinkBox table')], note = document.getElementById('wRinkNote');
          return { note: note.classList.contains('wsnote') && note.textContent.length > 20 && top(note) > top(document.getElementById('wRinkAgain')), tables: T.length, under: T.length === 2 && top(T[0]) > cv.getBoundingClientRect().bottom,
            side: T.length === 2 && Math.abs(top(T[0]) - top(T[1])) < 4 && T[1].getBoundingClientRect().left > T[0].getBoundingClientRect().right - 2, log: document.getElementById('wRinkLog').textContent, logUnder: top(document.getElementById('wRinkLog')) > top(T[0]) }; })()""")
        check(lay['note'] and lay['tables'] == 2 and lay['under'] and lay['side'] and 'No goals yet' in lay['log'] and lay['logUnder'], 'the page is laid out as the other sports\' are: the status line under the bar, the rink, two box scores side by side, then This game', lay)
        await pg.wait_for_function("wHK.phase === 'live' && wHK.G.clock < wHK.G.plen - 1")
        await pg.screenshot(path='/tmp/realm-rink-live.png')
        await pg.evaluate("showPage('help')")
        await pg.wait_for_function("wHK.paused")
        w = await pg.evaluate("(async () => { const c = JSON.stringify(wHK.G.clock); for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r)); return { paused: wHK.paused, still: c === JSON.stringify(wHK.G.clock), how: !!document.getElementById('wRinkHow'), help: !!document.getElementById('wHelpRink') }; })()")
        check(w['paused'] and w['still'] and w['how'] and w['help'], 'the game waits while How to play is up, and How to play has the rink and Hockey: how it works', w)
        await pg.evaluate("showPage('play')")
        check(not await pg.evaluate("wHK.paused"), 'back on Play, the game goes on', None)
        # the length setting: on Settings (and the bar), and the next game is that long
        await pg.evaluate("showSettings()")
        await pg.wait_for_selector('#sRinkMins')
        await pg.select_option('#sRinkMins', '3')
        await pg.click('#sSfx')
        await pg.wait_for_selector('#sRinkMins')
        st = await pg.evaluate("({ set: SET.rinkMins, saved: JSON.parse(localStorage.getItem('sd-settings')).rinkMins, row: document.getElementById('sRinkMins').value, court: !!document.getElementById('sCourtMins') })")
        check(st == {'set': 3, 'saved': 3, 'row': '3', 'court': True}, 'Settings has the hockey game length beside basketball\'s; it is saved, and stays on the panel when it redraws', st)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        await pg.click('#wRinkAgain')
        n = await pg.evaluate("({ mins: wHK.G.mins, plen: wHK.G.plen, sel: document.getElementById('wRinkMins').value })")
        check(n == {'mins': 3, 'plen': 60, 'sel': '3'}, 'Another game plays at the new length, and the bar shows it', n)
        # watched to the end: the final, the box score and every goal under the rink
        await pg.evaluate("wHK.speed = 8")
        await pg.wait_for_function("wHK.phase === 'over' && document.getElementById('wRinkNote').textContent.startsWith('Final')", timeout=180000)
        e = await pg.evaluate("({ note: document.getElementById('wRinkNote').textContent, rows: document.querySelectorAll('#wRinkBox tr').length, tables: document.querySelectorAll('#wRinkBox table').length, goals: document.querySelectorAll('#wRinkLog li[style]').length, log: wHK.G.log.length, score: wHK.G.score })")
        check(e['note'].startswith('Final') and e['tables'] == 2 and e['rows'] >= 16 and e['goals'] == e['log'] == sum(e['score']), 'a game watched to the end shows the final, a box score for each side, and every goal under This game', e)
        await pg.screenshot(path='/tmp/realm-rink-final.png', full_page=True)
        # a phone: the strip of real text over the rink, and nothing scrolls sideways
        await pg.set_viewport_size({'width': 400, 'height': 800})
        await pg.wait_for_function("!!document.getElementById('wSbRink') && !document.getElementById('wSbRink').hidden")
        ph = await pg.evaluate("({ strip: document.getElementById('wSbRink').textContent, shown: getComputedStyle(document.getElementById('wSbRink')).display !== 'none', scroll: document.documentElement.scrollWidth - innerWidth, score: wHK.G.score })")
        check(ph['shown'] and 'Final' in ph['strip'] and 'Rimewatch' in ph['strip'] and str(ph['score'][0]) in ph['strip'] and ph['scroll'] <= 0, 'on a phone the scoreboard strip is over the rink, and nothing scrolls sideways', ph)
        await pg.screenshot(path='/tmp/realm-rink-phone.png', full_page=True)
        await pg.set_viewport_size({'width': 1200, 'height': 1000})
        await pg.click('#wRinkBack')
        b = await pg.evaluate("({ view: UI.view, on: wHK.on, bar: document.getElementById('wRinkBar').hidden })")
        check(b == {'view': 'world', 'on': False, 'bar': True}, 'Back to the world parks the rink', b)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
