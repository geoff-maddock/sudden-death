# Realm shed (issue #102, phase 2): the Curling Shed's page, and throwing by hand.
# Brush Hennock offers to CURL, and CURL opens the Shed's own view: its bar, the canvas on, the other engines off; a
# game is the ends on Settings, four a side. Watch plays a whole game to the end, the end board and This game keeping
# every end. You play: your stone starts on your skip's call (a shot, the broom, a handle) with the rows showing; the
# shot, the broom and the handle change the aim (the keys do it too: 1 to 6, the arrows, I and O, G for the skip's call
# again). The throw: Space starts the meter, Space at the line sends the call's weight, and a draw thrown on the line
# comes to rest near the broom; while it slides, holding Space sweeps it (the skip calls the weight as it goes), and a
# light stone swept goes further than the same stone left alone. A drag throws too. A second throw can't start while one slides, and the one sliding counts once. Watch and You play
# switch mid-game; the game waits under How to play; Back to the world leaves the Shed. Asserts; exits nonzero on failure.
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

HELP = r"""
window.__to = (ph, max) => { let n = 0; while (wCR.phase !== ph && n++ < (max || 20000)) wCR.tick(0.05); return wCR.phase === ph; };
window.__meterTo = v => { let n = 0; while (n++ < 2000) { const M = wCR.view.meter; if (!M || M.st !== 'up') return false; if (M.v >= v) return true; wCR.tick(0.002); } return false; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; SET.shedEnds = 4")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)

        # ---------- Brush Hennock puts on a game ----------
        k = await pg.evaluate("""(() => { const K = DB.chars.gk_shed; return { job: K.topics.job.t.includes('CURL'), act: K.topics.curl.act, scoring: wSay('gk_shed', 'curling').key !== 'curl' }; })()""")
        check(k == {'job': True, 'act': 'shedcurl', 'scoring': True}, 'Brush Hennock offers to CURL (and CURLING is still how card-game curling scores)', k)
        v = await pg.evaluate("""(() => { W_SHED_MODE = 'watch'; wRunAct('shedcurl'); wCR.pause(true);
          return { view: UI.view, bar: !$('wShedBar').hidden, host: !$('v-shed').hidden, on: wCR.on, others: ['links', 'lanes', 'rink'].map(k => W_ENGINES[k].api.on), ends: wCR.G.ends, teams: wCR.G.teams.map(t => t.roster.length), mode: wCR.mode }; })()""")
        check(v['view'] == 'shed' and v['bar'] and v['host'] and v['on'] and v['others'] == [False, False, False], 'CURL opens the Shed\'s own view: its bar, the canvas on, the other engines off', v)
        check(v['ends'] == 4 and v['teams'] == [4, 4] and v['mode'] == 'watch', 'a game is the ends on Settings, four a side', v)

        # ---------- Watch: a whole game ----------
        w = await pg.evaluate("""(() => { let n = 0; while (!(WCR && WCR.over) && n++ < 60000) wCR.tick(0.1); const G = wCR.G;
          return { over: !!G.over, ends: G.log.length, board: $('wShedBoard').textContent.includes(String(wCR.total(0))), log: $('wShedLog').querySelectorAll('li').length, rows: $('wShedRows').hidden, phase: wCR.phase }; })()""")
        check(w['over'] and w['ends'] >= 4 and w['log'] == w['ends'] and w['board'], 'Watch plays a whole game to the end; the end board and This game keep every end', w)
        check(w['rows'], 'no rows in Watch', w)

        # ---------- You play: the setup ----------
        a = await pg.evaluate("""(() => { W_SHED_MODE = 'play'; wShedGame({ seed: 5, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); const V = wCR.view;
          return { ph: V.ph, up: V.up, sel: V.sel, rows: !$('wShedRows').hidden, shots: $('wShedShot').querySelectorAll('button').length }; })()""")
        check(a['ph'] == 'aim' and a['up'] == 0 and a['rows'] and a['shots'] == 6 and a['sel']['aim'] and a['sel']['shot'] in ('draw', 'guard'), 'You play: your stone starts on your skip\'s call, with the rows', a)
        s0 = a['sel']
        c = await pg.evaluate("""(() => { const out = {}; const s0 = wCR.view.sel;
          wCR.select({ x: s0.x + 20 }); out.broom = wCR.view.sel.aim.ang !== s0.aim.ang;
          wCR.select({ h: -s0.h }); out.handle = wCR.view.sel.h === -s0.h && wCR.view.sel.aim.ang !== s0.aim.ang;
          wCR.select({ shot: 'guard' }); out.guard = [wCR.view.sel.shot, wCR.view.sel.y];
          wCR.select({ suggest: true }); out.back = wCR.view.sel.shot === s0.shot && wCR.view.sel.x === s0.x; return out; })()""")
        check(c['broom'] and c['handle'] and c['guard'] == ['guard', -190] and c['back'], 'the broom, the handle and the shot change the aim; the skip\'s call puts it back', c)
        await pg.evaluate("wCR.pause(false)")
        x0 = await pg.evaluate("wCR.view.sel.x")
        for key in ['ArrowLeft', 'ArrowLeft', 'i', '2']:
            await pg.keyboard.press(key)
        kk = await pg.evaluate("wCR.view.sel")
        check(kk['h'] == -1 and kk['shot'] == 'guard', 'the keys: I the in-turn, 2 a guard', kk)
        await pg.keyboard.press('g')
        kg = await pg.evaluate("wCR.view.sel")
        await pg.keyboard.press('ArrowLeft')
        kl = await pg.evaluate("wCR.view.sel")
        check(abs(kl['x'] - kg['x'] - 3) < .01, 'the left arrow moves the broom left', [kg['x'], kl['x']])
        await pg.evaluate("wCR.pause(true); wCR.select({ suggest: true })")

        # ---------- the throw on the line, and the sweep ----------
        t = await pg.evaluate("""(() => { wShedGame({ seed: 7, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); wCR.select({ shot: 'draw', x: 0, y: 0 });
          wCR.press(); const sw = wCR.phase; __meterTo(wCR.playRules.meter.line); wCR.press(); const ph = wCR.phase;
          // a second throw while this one slides is refused, and changes nothing
          const n0 = wCR.G.n; const ov = wCR.turn(); const refused = ov && ov.rule && ov.rule.ok === false;
          let calls = new Set(), n = 0; while (wCR.phase === 'slide' && n++ < 4000) { wCR.tick(0.05); if (wCR.view.call) calls.add(wCR.view.call); }
          const L = wCR.last; return { sw, ph, stop: L.stop, refused, counted: wCR.G.n - n0, made: L.made, calls: [...calls] }; })()""")
        check(t['sw'] == 'swing' and t['ph'] == 'slide', 'Space starts the meter, and Space at the line sends the stone', t)
        check(t['stop'] and abs(t['stop']['x']) < 30 and abs(t['stop']['y']) < 36, 'a draw thrown on the line comes to rest near the broom', t)
        check(t['refused'] and t['counted'] == 1 and len(t['calls']) >= 1, 'a second throw can\'t start while one slides; the one sliding counts once; the skip calls the weight as it goes', t)
        sp = await pg.evaluate("""(() => { const run = sweep => { wShedGame({ seed: 8, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); wCR.select({ shot: 'draw', x: 0, y: 0 });
            wCR.press(); __meterTo(.9); wCR.press(); let n = 0, sw = 0; while (wCR.phase === 'slide' && n++ < 4000) { wCR.sweep = sweep; wCR.tick(0.05); const L = wCR.live; if (L && L.sw > sw) sw = L.sw; } wCR.sweep = false; return { stop: wCR.last.stop, sw }; };
          return { plain: run(false), swept: run(true) }; })()""")
        check(sp['swept']['sw'] > 0 and sp['plain']['sw'] == 0 and sp['swept']['stop'] and sp['plain']['stop'] and sp['swept']['stop']['y'] > sp['plain']['stop']['y'] + 30,
              'holding Space sweeps: a light stone swept goes further than the same stone left alone', sp)
        dg = await pg.evaluate("""(() => { wShedGame({ seed: 9, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); const ok = wCR.drag(1, 0); return { ok, ph: wCR.phase }; })()""")
        check(dg == {'ok': True, 'ph': 'slide'}, 'a drag throws the stone', dg)
        pt = await pg.evaluate("""(() => { wShedGame({ seed: 10, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); const [hx, hy] = wCR.houseScr(30, 10);
          const cv = document.querySelector('#v-shed canvas'), r = cv.getBoundingClientRect(), k = r.width / 960; return { x: r.left + hx * k, y: r.top + hy * k }; })()""")
        await pg.evaluate("wCR.pause(false)")
        await pg.mouse.click(pt['x'], pt['y'])
        bm = await pg.evaluate("wCR.view.sel")
        check(abs(bm['x'] - 30) < 3 and abs(bm['y'] - 10) < 3, 'a click on the house puts the broom there', bm)
        await pg.evaluate("wCR.pause(true)")

        # ---------- found in review ----------
        rv = await pg.evaluate("""(() => { const out = {}, R = wCR.sheet.stoneR;
          // the game moved on under the page (a CPU stone called, then thrown from outside): no freeze, the page goes on
          W_SHED_MODE = 'watch'; wShedGame({ seed: 12, mode: 'watch' }); wCR.pause(true); __to('addr'); out.busy = wCR.turn().rule.ok;
          let n = 0; while (wCR.G.n < 2 && n++ < 4000) wCR.tick(0.05); out.going = wCR.G.n >= 2;
          // a freeze snaps in front of their stone, and one that comes to rest touching it is made
          W_SHED_MODE = 'play'; wShedGame({ seed: 13, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); const G = wCR.G;
          G.stones.push({ id: '1:9', s: 1, x: 20, y: 10 }, { id: '0:9', s: 0, x: -30, y: 0 });
          wCR.select({ shot: 'freeze', x: 25, y: 0 }); const S = wCR.view.sel; out.freeze = [S.x, +(S.y).toFixed(1)];
          // a hit: a click on your own stone takes your own stone
          wCR.select({ shot: 'takeout' }); wCR.select({ x: -29, y: 1 }); out.own = wCR.view.sel.target;
          // the skip's hit and roll keeps its roll (positions tried until the skip calls one)
          out.roll = null; for (let i = 0; i < 60 && out.roll == null; i++) { G.stones = [{ id: '1:9', s: 1, x: (i * 7) % 50 - 25, y: (i * 11) % 60 - 30 }, { id: '0:8', s: 0, x: (i * 13) % 70 - 35, y: -60 + (i * 5) % 40 }];
            wCR.select({ suggest: true }); if (wCR.view.sel.shot === 'hitroll') out.roll = wCR.view.sel.roll; }
          out.R = R;
          return out; })()""")
        check(rv['busy'] is False and rv['going'], 'a stone thrown from outside while the page has one called is refused, and the page goes on', rv)
        check(rv['freeze'] == [20, round(10 - 2 * rv['R'] - .5, 1)] and rv['own'] == '0:9', 'a freeze snaps in front of their stone; on a hit, a click on your own stone takes it', rv)
        check(rv['roll'] in (3, -3), 'your skip\'s hit and roll keeps the roll it chose', rv)
        # a sweep held on the canvas and let go off it stops; Space held on from the weight's press doesn't sweep
        await pg.evaluate("(() => { wShedGame({ seed: 14, mode: 'play', hammer: 1 }); wCR.pause(false); __to('aim'); wCR.select({ shot: 'draw', x: 0, y: 0 }); wCR.press(); __meterTo(1); wCR.press(); })()")
        cvb = await pg.evaluate("(() => { const r = document.querySelector('#v-shed canvas').getBoundingClientRect(); return { x: r.left + 200, y: r.top + 300 }; })()")
        await pg.mouse.move(cvb['x'], cvb['y']); await pg.mouse.down()
        await pg.wait_for_timeout(120)
        held = await pg.evaluate("wCR.sweep")
        await pg.mouse.move(cvb['x'], cvb['y'] + 700); await pg.mouse.up()
        await pg.wait_for_timeout(120)
        let_go = await pg.evaluate("wCR.sweep")
        check(held is True and let_go is False, 'a sweep held on the canvas and let go off it stops', [held, let_go])
        await pg.evaluate("(() => { let n = 0; while (wCR.phase === 'slide' && n++ < 4000) wCR.tick(0.05); __to('aim'); wCR.press(); __meterTo(1); })()")
        await pg.keyboard.down(' ')
        rep = await pg.evaluate("""(async () => { const ph = wCR.phase; window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true }));
          await new Promise(r => setTimeout(r, 80)); const held = wCR.sweep;
          window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
          await new Promise(r => setTimeout(r, 80)); const fresh = wCR.sweep; window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })); return { ph, held, fresh }; })()""")
        await pg.keyboard.up(' ')
        check(rep['ph'] == 'slide' and rep['held'] is False and rep['fresh'] is True, 'Space held on from the weight\'s press doesn\'t sweep: a fresh press does', rep)
        await pg.evaluate("wCR.pause(true)")

        # ---------- modes, How to play, leaving ----------
        m = await pg.evaluate("""(() => { $('wShedModes').querySelector('[data-cmode="watch"]').click(); const a = wCR.mode; __to('slide'); $('wShedModes').querySelector('[data-cmode="play"]').click(); const b = wCR.mode;
          showPage('help'); const held = wCR.paused; const how = !!$('wShedHow') && !!$('wHelpShed'); showPage('play'); const free = !wCR.paused;
          $('wShedBack').click(); return { a, b, held, how, free, view: UI.view, on: wCR.on }; })()""")
        check(m['a'] == 'watch' and m['b'] == 'play', 'Watch and You play switch mid-game', m)
        check(m['held'] and m['how'] and m['free'], 'the game waits under How to play, which explains curling', m)
        check(m['view'] == 'world' and not m['on'], 'Back to the world leaves the Shed and stops its canvas', m)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
