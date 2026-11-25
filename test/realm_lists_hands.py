# Realm lists (issue #117, phase 2): the Tilting Lists' page, and riding by hand.
# Sir Ruddock offers to JOUST, and JOUST opens the Lists' own view: its bar, the canvas on, the other engines off; a
# match is the courses on Settings, two riders a side. Watch rides a whole match to the end, the tourney board and This
# match keeping every course. You ride: your course starts on your squire's plan (an aim, a guard and a pace, with the
# reason) with the rows showing; the rows and the keys (1 to 3, Q and W, E and R, G) change it. The charge's inputs
# reach the model through the same sway() and speed(): a run spurred on every beat, couched at the right moment and
# held on the mark comes in faster, with a clean couch and the tip on the mark, and breaks far more often than a run
# not spurred, couched late and left to sway; a lance never couched is a miss, and one couched too early droops. When
# their lance breaks on you the balance moment follows: leaning against the wobble keeps your seat better than not, and
# your lean is what the seat is decided with. The keys and the pointer ride too (Space: ride, spur, hold to couch; a
# tap spurs, a held press couches and a drag aims). No other course can be ridden while yours is under way. Watch and
# You ride switch mid-match; the match waits under How to play; Back to the world leaves the Lists. At phone width the
# page doesn't scroll sideways. Asserts; exits nonzero on failure.
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
window.__to = (ph, max) => { let n = 0; while (wJT.phase !== ph && n++ < (max || 20000)) wJT.tick(0.05); return wJT.phase === ph; };
// tick the charge on to p (of the way down)
window.__p = p => { const R = wJT.playRules; let n = 0; while (wJT.phase === 'charge' && wJT.view.charge.p < p - 1e-9 && n++ < 400) wJT.tick(Math.min(.02, (p - wJT.view.charge.p) * R.charge + 1e-6)); };
/* ride one course of yours: o = { spur: true|false, couchAt: p | null, hold: true|false (correct the tip onto the mark) };
   returns the course as ridden (wJT.last) */
window.__ride = (seed, o, plan) => {
  wListsGame({ seed, mode: 'play' }); wJT.pause(true); __to('plan'); if (plan) wJT.select(plan);
  const R = wJT.playRules, A = wJT.planRules.aim[wJT.view.sel.aim], beat = R.spur.beat[wJT.view.sel.pace]; wJT.press();
  if (o.spur) for (let k = 1; k * beat < R.spur.until * R.charge; k++) { __p(k * beat / R.charge); wJT.spur(); }
  if (o.couchAt != null) { __p(o.couchAt); wJT.couch(true); }
  let n = 0; while (wJT.phase === 'charge' && n++ < 400) {
    const C = wJT.view.charge; if (o.hold && C.tip) wJT.aim(C.hand.x - (C.tip.x - A.x), C.hand.y - (C.tip.y - A.y));
    wJT.tick(.01);
  }
  if (wJT.phase === 'seat') { let m = 0; while (wJT.phase === 'seat' && m++ < 400) wJT.tick(.02); }
  return Object.assign({ mark: A }, wJT.last);
};
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; SET.listsCourses = 5")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)

        # ---------- Sir Ruddock puts on a tourney ----------
        k = await pg.evaluate("""(() => { const K = DB.chars.gk_lists; return { job: K.topics.job.t.includes('JOUST'), act: K.topics.joust.act, game: K.topics.game.act, scoring: wSay('gk_lists', 'jousting').key !== 'joust' }; })()""")
        check(k == {'job': True, 'act': 'listsjoust', 'game': 'gmatch', 'scoring': True}, 'Sir Ruddock offers to JOUST (GAME is still the card-game match, and JOUSTING how card-game jousting scores)', k)
        v = await pg.evaluate("""(() => { W_LISTS_MODE = 'watch'; wRunAct('listsjoust'); wJT.pause(true);
          return { view: UI.view, bar: !$('wListsBar').hidden, host: !$('v-lists').hidden, on: wJT.on, others: ['shed', 'lanes', 'links', 'rink'].map(k => W_ENGINES[k].api.on), courses: wJT.G.courses, teams: wJT.G.teams.map(t => t.roster.length), riders: wJT.G.riders, mode: wJT.mode }; })()""")
        check(v['view'] == 'lists' and v['bar'] and v['host'] and v['on'] and v['others'] == [False] * 4, 'JOUST opens the Lists\' own view: its bar, the canvas on, the other engines off', v)
        check(v['courses'] == 5 and v['teams'] == [4, 4] and v['riders'] == [[0, 1], [0, 1]] and v['mode'] == 'watch', 'a match is the courses on Settings, two riders from a side of four', v)

        # ---------- Watch: a whole match ----------
        w = await pg.evaluate("""(() => { let n = 0; while (!(WJT && WJT.over) && n++ < 60000) wJT.tick(0.1); const G = wJT.G;
          return { over: !!G.over, courses: G.log.length, board: $('wListsBoard').textContent.includes(String(wJT.total(0))), log: $('wListsLog').querySelectorAll('li').length, rows: $('wListsRows').hidden, call: wJT.call }; })()""")
        check(w['over'] and w['courses'] >= 2 and w['log'] == w['courses'] and w['board'] and len(w['call']) > 10, 'Watch rides a whole match to the end; the tourney board and This match keep every course; the herald calls it', w)
        check(w['rows'], 'no rows in Watch', w)

        # ---------- You ride: the plan ----------
        a = await pg.evaluate("""(() => { W_LISTS_MODE = 'play'; wListsGame({ seed: 5, mode: 'play' }); wJT.pause(true); __to('plan'); const V = wJT.view;
          return { ph: V.ph, sel: V.sel, rows: !$('wListsRows').hidden, btns: $('wListsRows').querySelectorAll('[data-jf]').length, msg: wJT.msg.includes('squire') }; })()""")
        check(a['ph'] == 'plan' and a['rows'] and a['btns'] == 7 and a['sel']['aim'] in ('shield', 'body', 'helm') and a['sel']['why'] and a['msg'], 'You ride: your course starts on your squire\'s plan, with the reason and the rows', a)
        c = await pg.evaluate("""(() => { const out = {}; $('wListsRows').querySelector('[data-jf="aim"][data-jv="helm"]').click(); out.row = wJT.view.sel.aim;
          out.bad = wJT.select({ aim: 'toString' }); wJT.select({ guard: 'angled', pace: 'canter' }); out.both = [wJT.view.sel.guard, wJT.view.sel.pace]; return out; })()""")
        check(c['row'] == 'helm' and c['bad'] and c['both'] == ['angled', 'canter'], 'the rows and select change the plan, and refuse what isn\'t one', c)
        await pg.evaluate("wJT.pause(false)")
        for key in ['2', 'w', 'r']: await pg.keyboard.press(key)
        kk = await pg.evaluate("wJT.view.sel")
        check([kk['aim'], kk['guard'], kk['pace']] == ['body', 'square', 'gallop'], 'the keys: 2 the body, W square, R a gallop', kk)
        await pg.keyboard.press('g')
        kg = await pg.evaluate("wJT.view.sel")
        check(kg['aim'] == a['sel']['aim'] and kg['pace'] == a['sel']['pace'], 'G puts your squire\'s plan back', kg)
        await pg.evaluate("wJT.pause(true)")

        # ---------- the charge's inputs reach the model ----------
        r = await pg.evaluate("""(() => { const plan = { aim: 'shield', pace: 'canter' }, out = { good: [], bad: [] };
          for (let i = 0; i < 24; i++) { out.good.push(__ride(100 + i, { spur: true, couchAt: wJT.playRules.couch.ideal, hold: true }, plan)); out.bad.push(__ride(100 + i, { spur: false, couchAt: .97, hold: false }, plan)); }
          const sum = L => ({ q: L.reduce((a, x) => a + x.rides[0].spurQ, 0) / L.length, speed: L.reduce((a, x) => a + x.rides[0].speed, 0) / L.length, couch: L.reduce((a, x) => a + Math.abs(x.rides[0].couch), 0) / L.length,
            off: L.reduce((a, x) => a + Math.hypot(x.rides[0].tip.x - x.mark.x, x.rides[0].tip.y - x.mark.y), 0) / L.length, broke: L.filter(x => x.broke[0]).length, n: L.length });
          const up = __ride(300, { spur: true, couchAt: null, hold: false }, plan), early = __ride(301, { spur: false, couchAt: wJT.playRules.spur.until + .01, hold: false }, plan);
          const eg = [0, 1, 2, 3, 4, 5].map(i => __ride(310 + i, { spur: false, couchAt: wJT.playRules.spur.until + .01, hold: false }, plan)), lg = [0, 1, 2, 3, 4, 5].map(i => __ride(310 + i, { spur: false, couchAt: wJT.playRules.couch.ideal, hold: false }, plan));
          const dy = L => L.reduce((a, x) => a + (x.rides[0].tip.y - x.mark.y), 0) / L.length;
          return { good: sum(out.good), bad: sum(out.bad), up: [up.rides[0].up, up.res[0].at, up.pts[0] <= 0], early: early.rides[0].couch, droop: [dy(eg), dy(lg)] }; })()""")
        g, b = r['good'], r['bad']
        print('   (well ridden:', {k: round(v, 3) if isinstance(v, float) else v for k, v in g.items()}, ')'); print('   (badly ridden:', {k: round(v, 3) if isinstance(v, float) else v for k, v in b.items()}, ')')
        check(g['q'] > .95 and b['q'] == 0 and g['speed'] > b['speed'] * 1.1, 'spurring on every beat builds speed; no spur leaves it at the bottom of the range', [g, b])
        check(g['couch'] < .05 and b['couch'] > .9, 'a couch at the right moment is clean; one at the last moment is as late as it gets', [g['couch'], b['couch']])
        check(g['off'] < 3 and b['off'] > g['off'] * 2, 'holding the tip on the mark brings it in on the mark; left to sway, it lands well off', [g['off'], b['off']])
        check(g['broke'] > b['broke'] + 5, 'the well ridden course breaks its lance far more often', [g['broke'], b['broke']])
        check(r['up'] == [True, 'miss', True], 'a lance never couched comes in high: a miss', r['up'])
        check(r['early'] < -.6 and r['droop'][0] < r['droop'][1] - 2, 'a lance couched too early droops: the tip comes in low', r)

        # ---------- the seat ----------
        st = await pg.evaluate("""(() => { const find = () => { for (let s = 400; s < 700; s++) { wListsGame({ seed: s, mode: 'play' }); wJT.pause(true); __to('plan'); wJT.select({ aim: 'shield', guard: 'square', pace: 'canter' }); wJT.press();
              let n = 0; while (wJT.phase === 'charge' && n++ < 500) wJT.tick(.01); if (wJT.phase === 'seat') return s; } return -1; };
            const s0 = find(); if (s0 < 0) return { found: false };
            const lean = how => { wListsGame({ seed: s0, mode: 'play' }); wJT.pause(true); __to('plan'); wJT.select({ aim: 'shield', guard: 'square', pace: 'canter' }); wJT.press();
              let n = 0; while (wJT.phase === 'charge' && n++ < 500) wJT.tick(.01); const ph = wJT.phase, rows = !$('wListsSeatRow').hidden; let q = 0;
              while (wJT.phase === 'seat' && n++ < 2000) { const S = wJT.view.seat; if (how === 'good') wJT.lean(-S.w); else if (how === 'wrong') wJT.lean(S.w); q = S.q; wJT.tick(.01); }
              return { ph, rows, q, lean: wJT.last.lean[0], kept: !wJT.last.res[1].unhorse }; };
            return { found: true, good: lean('good'), none: lean('none'), wrong: lean('wrong') }; })()""")
        if check(st.get('found'), 'their lance breaks on you in some course (a seed found)', st):
            check(st['good']['ph'] == 'seat' and st['good']['rows'], 'when their lance breaks on you, the balance moment follows, with the Lean row', st['good'])
            check(st['good']['q'] > .8 and st['good']['q'] > st['none']['q'] + .2 and st['none']['q'] > st['wrong']['q'], 'leaning against the wobble holds it; not leaning, less; leaning with it, worst', st)
            check(abs(st['good']['lean'] - st['good']['q']) < .05 and abs(st['wrong']['lean'] - st['wrong']['q']) < .05, 'your lean is what your seat is decided with', st)

        # ---------- the keys and the pointer ride too ----------
        await pg.evaluate("wListsGame({ seed: 21, mode: 'play' }); wJT.pause(true); __to('plan'); wJT.pause(false)")
        await pg.keyboard.press(' ')
        kp = await pg.evaluate("wJT.phase")
        await pg.evaluate("wJT.pause(true); __p(wJT.playRules.spur.beat[wJT.view.plans[0].pace] / wJT.playRules.charge); wJT.pause(false)")
        await pg.keyboard.press(' ')
        ks = await pg.evaluate("({ hits: wJT.view.charge.hits, bad: wJT.view.charge.bad })")
        await pg.evaluate("wJT.pause(true); __p(.6); wJT.pause(false)")
        await pg.keyboard.down(' ')
        kd = await pg.evaluate("wJT.view.charge.down")
        await pg.keyboard.down('ArrowUp'); await pg.wait_for_function("wJT.view.charge && wJT.view.charge.hand.y > 1"); await pg.keyboard.up('ArrowUp')
        await pg.keyboard.up(' ')
        ku = await pg.evaluate("wJT.view.charge && wJT.view.charge.down")
        check(kp == 'charge' and ks['hits'] + ks['bad'] == 1 and kd is True and ku is False, 'Space rides, taps the spur, and held couches the lance (the arrows move the tip); let go, it comes up', [kp, ks, kd, ku])
        n0 = await pg.evaluate("wJT.G.n")
        tn = await pg.evaluate("wJT.turn()")
        check(tn is None and await pg.evaluate("wJT.G.n") == n0, 'no other course can be ridden while yours is under way', tn)
        await pg.evaluate("wListsGame({ seed: 22, mode: 'play' }); wJT.pause(true); __to('plan'); wJT.press(); wJT.pause(false)")
        box = await pg.evaluate("(() => { const r = document.querySelector('#v-lists canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
        await pg.mouse.click(box['x'], box['y'])
        ps = await pg.evaluate("wJT.view.charge.hits + wJT.view.charge.bad")
        await pg.evaluate("wJT.pause(true); __p(.6); wJT.pause(false)")
        await pg.mouse.move(box['x'], box['y']); await pg.mouse.down()
        pd = await pg.evaluate("wJT.view.charge.down")
        await pg.mouse.move(box['x'] + 30, box['y'] - 30, steps=3)
        ph = await pg.evaluate("wJT.view.charge.hand")
        await pg.mouse.up()
        pu = await pg.evaluate("wJT.view.charge && wJT.view.charge.down")
        check(ps == 1 and pd is True and ph['x'] > 5 and ph['y'] > 5 and pu is False, 'a tap spurs; a held press couches and a drag moves the tip; let go, it comes up', [ps, pd, ph, pu])
        await pg.evaluate("wJT.pause(true)")

        # ---------- modes, How to play, leaving ----------
        m = await pg.evaluate("""(() => { wListsGame({ seed: 23, mode: 'play' }); wJT.pause(true); __to('plan'); $('wListsModes').querySelector('[data-jmode="watch"]').click(); const a = wJT.mode; __to('charge'); $('wListsModes').querySelector('[data-jmode="play"]').click(); const b = wJT.mode;
          wJT.pause(false); showPage('help'); const held = wJT.paused; const how = [!!$('wListsHow'), !!$('wHelpLists'), /unhorsing/.test(($('wListsHow') || {}).textContent || ''), /couch/i.test(($('wListsHow') || {}).textContent || '')]; showPage('play'); const free = !wJT.paused;
          $('wListsBack').click(); return { a, b, held, how, free, view: UI.view, on: wJT.on }; })()""")
        check(m['a'] == 'watch' and m['b'] == 'play', 'Watch and You ride switch mid-match', m)
        check(m['held'] and m['how'] == [True] * 4 and m['free'], 'the match waits under How to play, which explains jousting', m)
        check(m['view'] == 'world' and not m['on'], 'Back to the world leaves the Lists and stops its canvas', m)

        # ---------- a phone ----------
        ph = await br.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        ph.on('pageerror', lambda e: errs.append('phone: ' + str(e)))
        await ph.goto(REALM_URL); await ph.wait_for_function("typeof wJT !== 'undefined'")
        await ph.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await ph.evaluate(HELP)
        sw = await ph.evaluate("""(() => { wListsGame({ seed: 3, mode: 'play' }); wJT.pause(true); __to('plan'); const a = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          wJT.press(); __p(.6); wJT.couch(true); const b = document.documentElement.scrollWidth - document.documentElement.clientWidth, cv = document.querySelector('#v-lists canvas').getBoundingClientRect().width;
          return { a, b, cv, strip: !!document.getElementById('wSbLists') }; })()""")
        check(sw['a'] <= 0 and sw['b'] <= 0 and sw['cv'] <= 390, 'at phone width the Lists don\'t scroll sideways, and the canvas fits', sw)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
