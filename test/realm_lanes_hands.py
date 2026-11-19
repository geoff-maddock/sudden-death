# Realm lanes (issue #100, phase 2): the Lanes' page, and bowling by hand.
# Moll Gutter at the Saltmere Lanes puts on a game when asked to BOWL: the lanes' own view with its bar, the canvas on
# and the other engines off. Watch plays a whole game, the sheet and This game following it, and the end is heard.
# You play: your ball starts on the coach's line; the keys move your feet (the arrows) and your arrow (A and D), change
# the ball (B) and the revs (R), and put the coach's line back (G); a click on the lane sets the arrow (or the feet near
# the foul line). Space three times bowls: the speed is where the second press stops the meter, and a third press on
# the mark sends the ball where it was aimed (early pulls it left, for a right-hander). A drag up the lane from the
# bowler is a throw too. The keys do nothing while the ball rolls. Watch takes over a ball you were setting up.
# Frames in Settings set the next game's length. The phone's strip covers the Lanes. Back to the world parks it.
# Asserts; exits nonzero on failure.
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

# move the game on by hand (the page's own loop is paused, so only these ticks count)
HELP = r"""
window.__tickTo = (pred, max) => { let n = 0; while (!pred() && n++ < (max || 4000)) wBL.tick(0.05); return pred(); };
window.__meterTo = (st, v) => { let n = 0; while (n++ < 400) { const M = wBL.view.meter; if (!M || M.st !== st) return false; if (st === 'up' ? M.v >= v : M.v <= v) return true; wBL.tick(0.005); } return false; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)

        # ---------- Moll Gutter puts on a game ----------
        k = await pg.evaluate("""(() => { const K = DB.chars.gk_lanes, r = wSay('gk_lanes', 'bowl'); return { job: K.topics.job.t.includes('BOWL'), act: K.topics.bowl.act, reg: W_ENGINES.lanes.sport }; })()""")
        check(k == {'job': True, 'act': 'lanesbowl', 'reg': 'bowling'}, 'Moll Gutter offers to BOWL, and the lanes are bowling in W_ENGINES', k)
        v = await pg.evaluate("""(() => { W_LANES_MODE = 'watch'; wRunAct('lanesbowl'); wBL.pause(true);
          return { view: UI.view, bar: !$('wLanesBar').hidden, host: !$('v-lanes').hidden, on: wBL.on, others: ['links', 'rink', 'court'].map(k => W_ENGINES[k].api.on), frames: wBL.G.frames, teams: wBL.G.teams.map(t => t.roster.length), mode: wBL.mode }; })()""")
        check(v['view'] == 'lanes' and v['bar'] and v['host'] and v['on'] and v['others'] == [False, False, False], 'BOWL opens the lanes\' own view: its bar, the canvas on, the other engines off', v)
        check(v['frames'] == 10 and v['teams'] == [5, 5] and v['mode'] == 'watch', 'a game is ten frames, five a side', v)

        # ---------- Watch: a whole game ----------
        w = await pg.evaluate("""(() => { const ok = window.__tickTo(() => !!WBL && !!WBL.over, 20000); const G = wBL.G;
          return { ok, over: !!G.over, rows: $('wLanesRows').hidden, sheet: $('wLanesSheet').textContent.includes(String(wBL.total(0))), log: $('wLanesLog').querySelectorAll('li').length, phase: wBL.phase, n: G.n, note: $('wLanesNote').textContent }; })()""")
        check(w['ok'] and w['over'] and w['phase'] in ('rest', 'over'), 'Watch bowls a whole game to the end, and the end is heard', w)
        check(w['rows'] and w['sheet'] and w['log'] >= 20, 'the sheet carries the totals and This game every frame; no rows in Watch', w)

        # ---------- You play: the setup ----------
        a = await pg.evaluate("""(() => { W_LANES_MODE = 'play'; wLanesGame({ seed: 5, mode: 'play' }); wBL.pause(true);
          window.__tickTo(() => wBL.phase === 'aim'); const V = wBL.view; return { ph: V.ph, up: V.up, sel: V.sel, rows: !$('wLanesRows').hidden, guide: !!wBL.guide() }; })()""")
        check(a['ph'] == 'aim' and a['up'] == 0 and a['rows'] and a['guide'] and a['sel']['ball'] == 'strike' and a['sel']['revs'] == 'normal', 'You play: your first ball starts on the coach\'s line, with the rows and the guide', a)
        s0 = a['sel']
        await pg.evaluate("wBL.pause(false)")   # (input is refused while the game is held, as under How to play)
        for key in ['ArrowLeft', 'ArrowLeft', 'a', 'b', 'r']:
            await pg.keyboard.press(key)
        s1 = await pg.evaluate("wBL.view.sel")
        check(abs(s1['stand'] - min(39, s0['stand'] + 2)) < .01 and abs(s1['arrow'] - (s0['arrow'] + .5)) < .01 and s1['ball'] == 'spare' and s1['revs'] == 'more', 'the arrows move your feet, A your arrow, B the ball, R the revs', [s0, s1])
        await pg.keyboard.press('g')
        s2 = await pg.evaluate("wBL.view.sel")
        check(s2 == s0, 'G puts the coach\'s line back', s2)
        # a click on the lane at the arrows sets your arrow; near the foul line, your feet
        ck = await pg.evaluate("""(() => { const r = wBL.unscr ? null : null; const c = document.querySelector('#v-lanes canvas').getBoundingClientRect(), k = c.width / 960;
          const [ax, ay] = wBL.scr(wBL.boardX(12), 180), [fx, fy] = wBL.scr(wBL.boardX(25), 20); return { a: [c.left + ax * k, c.top + ay * k], f: [c.left + fx * k, c.top + fy * k] }; })()""")
        await pg.mouse.click(*ck['a']); s3 = await pg.evaluate("wBL.view.sel")
        await pg.mouse.click(*ck['f']); s4 = await pg.evaluate("wBL.view.sel")
        check(abs(s3['arrow'] - 12) <= .5 and abs(s4['stand'] - 25) <= .5, 'a click on the lane sets the arrow, and near the foul line the feet', [s3, s4])
        await pg.keyboard.press('g')
        await pg.evaluate("wBL.pause(true)")

        # ---------- the meter: Space three times ----------
        m = await pg.evaluate("""(() => { const n0 = wBL.G.n, sel = wBL.view.sel; wBL.press(); const p1 = wBL.phase;
          window.__meterTo('up', 1.0); wBL.press(); const sp = wBL.view.meter.p; window.__meterTo('down', 0.0); wBL.press();
          const N = wBL.swingNums(), last = wBL.last; return { p1, sp, N, ph: wBL.phase, n: wBL.G.n - n0, rel: last.release, plan: last.plan, sel }; })()""")
        check(m['p1'] == 'swing' and abs(m['sp'] - 1) < .03 and m['ph'] == 'roll' and m['n'] == 1, 'Space starts the approach, the second press sets the speed, the third bowls', m)
        check(abs(m['N']['err']) <= m['N']['win'] and abs(m['rel']['ang'] - m['plan']['ang']) < .2, 'a release on the mark sends the ball nearly where it was aimed', m)
        # the keys do nothing while the ball rolls
        before = await pg.evaluate("JSON.stringify(wBL.view.sel)")
        await pg.keyboard.press('ArrowLeft'); after = await pg.evaluate("JSON.stringify(wBL.view.sel)")
        check(before == after, 'the keys do nothing while the ball rolls', [before, after])
        e = await pg.evaluate("""(() => { window.__tickTo(() => wBL.phase === 'aim'); const sel = wBL.view.sel; wBL.press(); window.__meterTo('up', 1.0); wBL.press(); window.__meterTo('down', 0.12); wBL.press();
          const L = wBL.last; return { early: L.release.ang - L.plan.ang, err: wBL.swingNums().err, hand: L.release.hand }; })()""")
        check(e['err'] > 0 and e['early'] * e['hand'] > .1, 'early on the mark pulls the ball (left, for a right-hander)', e)

        # ---------- a drag up the lane is a throw ----------
        d = await pg.evaluate("""(() => { window.__tickTo(() => wBL.phase === 'aim'); const c = document.querySelector('#v-lanes canvas').getBoundingClientRect(), k = c.width / 960, sel = wBL.view.sel;
          const [bx, by] = wBL.scr(wBL.boardX(sel.stand), -26); return { from: [c.left + bx * k, c.top + (by - 20) * k], n: wBL.G.n, k }; })()""")
        await pg.evaluate("wBL.pause(false)")
        await pg.mouse.move(*d['from']); await pg.mouse.down()
        await pg.mouse.move(d['from'][0], d['from'][1] - 120 * d['k'], steps=6); await pg.mouse.move(d['from'][0], d['from'][1] - 220 * d['k'], steps=6); await pg.mouse.up()
        dr = await pg.evaluate(f"(() => {{ wBL.pause(true); return {{ ph: wBL.phase, n: wBL.G.n - {d['n']} }}; }})()")
        check(dr == {'ph': 'roll', 'n': 1}, 'a drag up the lane from the bowler bowls the ball', dr)

        # ---------- Watch takes over; frames for the next game; the strip; leaving ----------
        t = await pg.evaluate("""(() => { window.__tickTo(() => wBL.phase === 'aim'); document.querySelector('[data-nmode="watch"]').click(); const ph = wBL.phase;
          window.__tickTo(() => wBL.phase === 'addr' || wBL.phase === 'roll', 200); return { ph, now: wBL.phase, rows: $('wLanesRows').hidden }; })()""")
        check(t['ph'] == 'next' and t['now'] in ('addr', 'roll') and t['rows'], 'Watch takes over a ball you were setting up', t)
        f = await pg.evaluate("""(() => { SET.lanesFrames = 5; wLanesGame({ seed: 9, mode: 'watch' }); wBL.pause(true); const n = wBL.G.frames; SET.lanesFrames = 10; return { n, strip: W_SB_HTML.lanes().includes(wBL.G.teams[0].name) }; })()""")
        check(f == {'n': 5, 'strip': True}, 'Frames in Settings set the next game\'s length; the phone\'s strip covers the Lanes', f)
        h = await pg.evaluate("""(() => { showPage('help'); const ok = !!$('wLanesHow') && !!$('wHelpLanes'); showPage('play'); return ok; })()""")
        check(h, 'How to play has Bowling: how it works, and the Lanes\' line', h)
        await pg.click('#wLanesBack')
        b = await pg.evaluate("({ view: UI.view, on: wBL.on, bar: $('wLanesBar').hidden })")
        check(b == {'view': 'world', 'on': False, 'bar': True}, 'Back to the world parks the lanes', b)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
