# Realm links by hand (issue #92, phase 2). Agatha Divot at the Links puts on a ROUND: the Links view laid out as the
# other sports' pages, the course drawn, the bar (Watch, You play, holes, speed), the rows under it, the scorecard.
# Your shot: the caddie's pick to start (the hitter, the club, the aim), then yours: a hitter who may hit, a club the
# lie allows, the aim inside its reach, the shape, the height and the spin; from the trees only a punch.
# The swing: three presses (start, power, the mark). On the mark it flies nearly straight; early hooks it left and late
# slices it right; past full is a power shot with a smaller mark, a more accurate player has a wider one; no power press
# takes the top, no mark press goes off at the bottom, far off line. The phone's drag gives the same numbers.
# A putt: the putter only, two presses, a read line as long as the putter is good. Their short putt: Give it, or make
# them putt. The keys work only in You play with the course on screen. Watch plays it out to the end, the scorecard and
# This game fill in, and the phone strip shows the match. How to play has golf, the game waits under it, Settings sets the
# holes, and Back leaves. Every check moves the game on by hand (the loop paused) or waits on state.
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

# a game of yours, paused, at your first shot; __to(ph) ticks until that beat; __lat: how far right (+) of the aim line (looking along it)
HELP = r"""
window.__mine = (seed, o) => { wLinksGame(Object.assign({ seed, mode: 'play' }, o || {})); wGL.pause(true); __to('aim'); return wGL.view; };
// after moving a ball by hand: back to the top of the turn (Watch and back; the same mode again changes nothing)
window.__replan = () => { wGL.setMode('watch'); wGL.setMode('play'); };
window.__to = (ph, n) => { let i = 0; while (wGL.phase !== ph && i++ < (n || 4000)) wGL.tick(0.05); return wGL.phase === ph; };
window.__lat = (from, aim, p) => { const ax = aim.x - from.x, ay = aim.y - from.y, L = Math.hypot(ax, ay); return ((p.x - from.x) * ay - (p.y - from.y) * ax) / L; };
window.__swing = (pow, m) => { const v0 = wGL.view, from = Object.assign({}, wGL.G.ball[v0.you]), aim = v0.sel.aim;
  wGL.press(); wGL.tick(pow * wGL.meterRules.up); wGL.press(); wGL.tick((pow - m) * wGL.meterRules.down); wGL.press();
  const v = wGL.view; return { sw: v.swung, ev: v.last, from, aim, land: wGL.G.log.length ? null : null }; };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)

        leaks = await pg.evaluate("['GD', 'GLP', 'GLC', 'glTick', 'glDraw', 'glPress', 'glDrag', 'glSelect', 'GL_METER', 'glStrike'].filter(n => (0, eval)('typeof ' + n) !== 'undefined')")
        check(not leaks, 'the page, the meter and the drawing stay inside the wGL scope', leaks)
        t = await pg.evaluate("(() => { const K = DB.chars.gk_links; return { act: K.topics.round && K.topics.round.act, job: /ROUND/.test(K.topics.job.t), game: K.topics.game && K.topics.game.act }; })()")
        check(t['act'] == 'linksround' and t['job'] and t['game'] == 'gmatch', 'Agatha Divot at the Links offers a ROUND of her own (GAME is still the card-game match)', t)

        # ---------- the view ----------
        await pg.evaluate("wRunAct('linksround')")
        await pg.wait_for_function("UI.view === 'links' && wGL.on && !!wGL.phase")
        await pg.wait_for_function("(() => { const c = document.querySelector('#v-links canvas'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const s = new Set(); for (let i = 0; i < x.length; i += 4000) s.add(x[i] >> 4 << 8 | x[i + 1] >> 4); return s.size > 12; })()")
        v = await pg.evaluate("""(() => ({ bar: !document.getElementById('wLinksBar').hidden, host: !document.getElementById('v-links').hidden, others: ['rink', 'court'].map(k => W_ENGINES[k].api.on),
          modes: [...document.querySelectorAll('#wLinksModes button')].map(b => b.textContent), holes: document.getElementById('wLinksHoles').value, card: !!document.querySelector('#wLinksCard table'), how: !!document.getElementById('wLinksHowBtn') }))()""")
        check(v['bar'] and v['host'] and v['others'] == [False, False] and v['modes'] == ['Watch', 'You play'] and v['holes'] == '9' and v['card'] and v['how'], 'a ROUND opens the Links view: the bar (Watch, You play, 9 holes), the course drawn, the scorecard; the other engines off', v)

        # ---------- your shot: the caddie's pick, then yours ----------
        a = await pg.evaluate("""(() => { const V = __mine(3), G = wGL.G, rows = document.getElementById('wLinksRows');
          return { ph: V.ph, sel: V.sel, clubs: V.clubs, hitters: V.hitters, rows: !rows.hidden, who: rows.querySelectorAll('[data-lri]').length, clubB: [...rows.querySelectorAll('[data-lclub]')].map(b => b.dataset.lclub), msg: wGL.msg }; })()""")
        s = a['sel']
        check(a['ph'] == 'aim' and s['ri'] == 0 and s['club'] == 'dr' and not s['putt'] and 0.5 < s['tick'] <= 1, 'your tee shot starts as the caddie would play it: a hitter, the driver, the aim and its tick', a)
        check(a['rows'] and a['who'] == 4 and a['clubB'] == a['clubs'] and 'dr' in a['clubs'] and 'pt' not in a['clubs'] and a['hitters'] == [0, 1, 2, 3], 'the rows under the course: four hitters (all may hit off the tee), and the clubs the tee allows (no putter)', a)
        c = await pg.evaluate("""(() => { const b = wGL.G.ball[0], d = s => Math.hypot(s.aim.x - b.x, s.aim.y - b.y);
          wGL.select({ club: 'mi' }); const mi = wGL.view.sel; wGL.aimPush(200); const far = wGL.view.sel; const reach = wGL.reach('mi', 'T', wGL.G.teams[0].roster[mi.ri].r, 1).carry;
          wGL.select({ ri: 2, shape: 'draw', traj: 'lob', spin: -1 }); const o = wGL.view.sel; wGL.select({ club: 'pt' }); const pt = wGL.view.sel.club;
          wGL.select({ shape: 'nonsense', traj: '', spin: 0 });
          return { mi: [mi.club, mi.tick], far: [d(far), reach], o: [o.ri, o.shape, o.traj, o.spin], pt }; })()""")
        check(c['mi'][0] == 'mi' and abs(c['far'][0] - c['far'][1]) < 1, 'a mid iron can be picked, and the ring stays inside its reach', c)
        check(c['o'] == [2, 'draw', 'lob', -1] and c['pt'] == 'mi', 'the hitter, the shape, the height and the spin can be set; the putter is refused off the tee', c)
        tr = await pg.evaluate("""(() => { __mine(4); const G = wGL.G; G.ball[0].lie = 'O'; wGL.select({}); const V = wGL.view; G.ball[0].lie = 'T'; return { traj: V.sel.traj, clubs: wGL.view.clubs }; })()""")
        check(tr['traj'] == 'punch', 'from the trees only a punch', tr)

        # ---------- the swing ----------
        n = await pg.evaluate("""(() => { const r = { acc: .5 }, N = (p, m) => wGL.swingNums(p, m, r), w = wGL.win(r, 1);
          return { mid: N(.8, 0), early: N(.8, .1), late: N(.8, -.1), edge: N(.8, w), wide: [wGL.win({ acc: .9 }, 1) > w, wGL.win(r, 1.05) < w] }; })()""")
        check(n['mid']['err'] == 0 and n['mid']['inside'] and n['early']['err'] < 0 and n['late']['err'] > 0 and abs(n['early']['err'] + n['late']['err']) < 1e-9 and not n['early']['inside'], 'on the mark it flies straight; early is a hook (minus), late a slice (plus), as far either way', n)
        check(abs(n['edge']['err'] + 0.25) < 1e-9 and n['wide'] == [True, True], 'a mark is wider for a more accurate player, and smaller on a power shot', n)
        sw = await pg.evaluate("""(() => { const out = {};
          for (const [k, m] of [['true', 0], ['early', .12], ['late', -.12]]) { __mine(11); const r = __swing(.85, m), b = wGL.G.ball[0];
            out[k] = { pow: r.sw.pow, err: r.sw.err, lat: __lat(r.from, r.aim, wGL.view.last.water ? r.aim : b), ev: wGL.view.last.k, club: wGL.view.last.club, ph: wGL.phase }; }
          return out; })()""")
        tt, ee, ll = sw['true'], sw['early'], sw['late']
        check(abs(tt['pow'] - 0.85) < 0.06 and abs(tt['err']) < 0.1 and tt['ev'] == 'shot' and tt['club'] == 'dr' and tt['ph'] == 'fly', 'three presses: start, the power, the mark; a good swing goes off at that power, nearly straight, and the ball flies', sw)
        check(ee['err'] < -0.5 and ll['err'] > 0.5 and ee['lat'] < tt['lat'] - 5 and ll['lat'] > tt['lat'] + 5, 'early on the mark hooks it left of the line, late slices it right', sw)
        au = await pg.evaluate("""(() => { __mine(12); wGL.press(); wGL.tick(1.3); const top = wGL.view.meter; wGL.tick(1.6); const v = wGL.view; return { top: [top.st, top.pow], gone: [v.ph, v.swung && v.swung.pow, v.swung && v.swung.err] }; })()""")
        check(au['top'][0] == 'down' and abs(au['top'][1] - 1.1) < 1e-6 and au['gone'][0] == 'fly' and au['gone'][2] > 1, 'no power press takes the top of the bar; no press on the mark goes off at the bottom, far right', au)
        dr = await pg.evaluate("""(() => { const r = wGL.G ? null : null; __mine(13); const rat = wGL.G.teams[0].roster[wGL.view.sel.ri].r, w = wGL.win(rat, .8);
          wGL.drag(.8, 0); const a = wGL.view.swung; __mine(13); wGL.drag(.8, wGL.hands.dragAcc); const b = wGL.view.swung; const want = wGL.swingNums(.8, w, rat);
          return { a, b, want, ph: wGL.phase }; })()""")
        check(dr['a']['pow'] == 0.8 and dr['a']['err'] == 0 and abs(dr['b']['err'] - dr['want']['err']) < 1e-9 and dr['b']['err'] < 0 and dr['ph'] == 'fly', 'the phone\'s drag gives the same two numbers: the pull is the power, a pull off the line the miss', dr)

        # the pointer on the course: a click moves the aim; a drag back from the ball and let go is a swing. The loop runs
        # (a paused game takes no input), so each press is placed from the camera in the same frame it is sent
        pt = await pg.evaluate("""(() => { __mine(14); wGL.pause(false); const cv = document.querySelector('#v-links canvas');
          const send = (type, sx, sy) => { const r = cv.getBoundingClientRect(), f = r.width / 960; cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + sx * f, clientY: r.top + sy * f, pointerId: 7, bubbles: true, cancelable: true })); };
          const a0 = wGL.view.sel.aim, [ax, ay] = wGL.scr(a0.x, a0.y); send('pointerdown', ax, ay + 40); send('pointerup', ax, ay + 40); const a1 = wGL.view.sel.aim;
          const b = wGL.G.ball[0], [bx, by] = wGL.scr(b.x, b.y), aim = wGL.view.sel.aim, [tx, ty] = wGL.scr(aim.x, aim.y), d = Math.hypot(tx - bx, ty - by), ux = (tx - bx) / d, uy = (ty - by) / d, pull = .7 * wGL.hands.drag;
          send('pointerdown', bx, by); send('pointermove', bx - ux * pull / 2, by - uy * pull / 2); const mid = wGL.phase; send('pointermove', bx - ux * pull, by - uy * pull); send('pointerup', bx - ux * pull, by - uy * pull);
          const v = wGL.view; wGL.pause(true); return { a0, a1, mid, ph: v.ph, sw: v.swung }; })()""")
        check(pt['a1']['x'] - pt['a0']['x'] > 1, 'a click on the course moves the aim (lower on the screen is right of the hole)', pt)
        check(pt['mid'] == 'aim' and pt['ph'] == 'fly' and abs(pt['sw']['pow'] - 0.7) < 0.02 and abs(pt['sw']['err']) < 0.05, 'a drag back from the ball, straight down the line and let go, swings at the pull\'s power, straight', pt)

        # ---------- a putt ----------
        pu = await pg.evaluate("""(() => { __mine(21); const G = wGL.G, H = wGL.course(0); G.ball[0] = { x: H.pin.x - 4, y: H.pin.y - 3, lie: 'G' }; G.ball[1] = { x: H.tee.x, y: H.tee.y, lie: 'T' }; G.hole.st = [2, 0];
          __replan(); __to('aim'); const V = wGL.view, L = wGL.readLine(), len = L.reduce((a, p, i) => i ? a + Math.hypot(p.x - L[i - 1].x, p.y - L[i - 1].y) : 0, 0), rl = wGL.readLen();
          G.teams[0].roster[V.sel.ri].r.put = 1; const rl2 = wGL.readLen(); G.teams[0].roster[V.sel.ri].r.put = .5;
          wGL.press(); wGL.tick(V.sel.tick * wGL.meterRules.puttUp); wGL.press(); const after = wGL.view;
          return { putt: V.sel.putt, clubs: V.clubs, rows: document.getElementById('wLinksRowShot').hidden, len, rl, rl2, sw: after.swung, ev: after.last && after.last.club, ph: after.ph, tick: V.sel.tick }; })()""")
        check(pu['putt'] and pu['clubs'] == ['pt'] and pu['rows'], 'on the green: the putter only, and no shape, height or spin', pu)
        check(abs(pu['len'] - pu['rl']) < 0.6 and pu['rl2'] > pu['rl'] + 2, 'the read line shows the putt\'s first yards, longer for a better putter', pu)
        check(abs(pu['sw']['pow'] - pu['tick']) < 0.03 and pu['ev'] == 'pt' and pu['ph'] == 'fly', 'a putt is two presses: start, then the weight; stopped on the tick it is struck at that weight', pu)

        # ---------- their short putt ----------
        of = await pg.evaluate("""(() => { const set = () => { const G = wGL.G, H = wGL.course(0); G.ball[0] = { x: H.pin.x + .2, y: H.pin.y, lie: 'G' }; G.ball[1] = { x: H.pin.x, y: H.pin.y - .5, lie: 'G' }; G.hole.st = [3, 3]; __replan(); __to('offer', 5); };
          __mine(31); set(); const ph = wGL.phase, row = !document.getElementById('wLinksRowGive').hidden; document.querySelector('[data-lgive="1"]').click();
          const g = wGL.G.log[wGL.G.log.length - 1], st = wGL.G.hole.st.slice(), done = wGL.G.hole.done.slice();
          __mine(31); set(); wGL.offer(false); const v = wGL.view;
          return { ph, row, g: [g.k, g.side, g.by], st, done, no: [v.ph, v.cpu && v.cpu.side, v.cpu && v.cpu.plan.putt] }; })()""")
        check(of['ph'] == 'offer' and of['row'], 'their short putt is yours to give: the Give it row shows', of)
        check(of['g'] == ['given', 1, 0] and of['st'][1] == 4 and of['done'][1], 'Give it: counted as holed in one more', of)
        check(of['no'] == ['addr', 1, True], 'Make them putt: they address the putt', of)

        # ---------- the keys ----------
        k = await pg.evaluate("""(() => { __mine(41); wGL.pause(false); const b = wGL.G.ball[0], ang = () => { const a = wGL.view.sel.aim; return Math.atan2(a.y - b.y, a.x - b.x); };
          const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
          const a0 = ang(); key('ArrowLeft'); const a1 = ang(); key('2'); const ri = wGL.view.sel.ri; key('e'); const club = wGL.view.sel.club; key('z'); const shape = wGL.view.sel.shape;
          key(' '); const ph = wGL.phase; wGL.setMode('watch'); key(' '); const w = wGL.view.meter;
          return { turned: a1 - a0, ri, club, shape, ph, watch: wGL.phase }; })()""")
        check(k['turned'] > 0.01 and k['ri'] == 1 and k['club'] == 'wd' and k['shape'] == 'draw' and k['ph'] == 'swing', 'the keys: arrows aim, 1 to 4 the hitter, E a shorter club, Z the shape, Space the swing', k)
        check(k['watch'] != 'swing', 'in Watch your swing is the CPU\'s again (the keys do nothing)', k)

        # ---------- Watch, to the end ----------
        w = await pg.evaluate("""(() => { wLinksGame({ seed: 51, mode: 'watch', holes: 3 }); wGL.pause(true); let i = 0; while (!WGL.over && i++ < 40000) wGL.tick(0.05);
          const G = wGL.G, js = JSON.stringify(JSON.parse(JSON.stringify(G))) === JSON.stringify(G);
          return { over: !!WGL.over, ph: wGL.phase, card: G.card.length, played: G.res.length, rows: [...document.querySelectorAll('#wLinksLog li')].length, note: document.getElementById('wLinksNote').textContent,
            text: wGL.matchText(0), sb: W_SB_HTML.links(), js, shots: G.pst[0].concat(G.pst[1]).reduce((a, p) => a + p.shots, 0) }; })()""")
        check(w['over'] and w['ph'] in ('rest', 'over') and w['card'] == w['played'] >= 2 and w['rows'] == w['card'] and w['shots'] > 4, 'Watch plays it out to the end: a card for every hole and a line in This game', w)
        check(w['js'] and ('Won' in w['text'] or 'Lost' in w['text']) and w['text'] in w['sb'] and ('Won' in w['note'] or 'win the match' in w['note']), 'the game stays plain JSON, the match text is the result, and the phone strip shows it', w)

        # (from the review of #93) a playoff hole has its column on the scorecard while it is played
        po = await pg.evaluate("""(() => { wLinksGame({ seed: 71, mode: 'watch', holes: 3 }); wGL.pause(true); const G = wGL.G;
          G.res = [-1, -1, -1]; G.card = [0, 1, 2].map(i => ({ no: i + 1, par: G.pars[i], st: [4, 4], done: [true, true], up: [false, false], res: -1 })); G.h = 3; G.playoff = 1; G.hole.st = [2, 1];
          wLinksCard(); const t = document.querySelector('#wLinksCard table'); return { cols: t.rows[0].cells.length - 1, live: [...t.rows[2].cells].pop().textContent }; })()""")
        check(po == {'cols': 4, 'live': '2'}, 'a playoff hole has its column on the scorecard, with the strokes so far', po)

        # (from the second review of #93)
        r2 = await pg.evaluate("""(() => { const out = {};
          // the ball that ends a hole stays in the cup through the rest beat
          __mine(81); const G = wGL.G, H = wGL.course(0); G.ball[0] = { x: H.pin.x, y: H.pin.y - 1.2, lie: 'G' }; G.ball[1] = { x: H.pin.x + 1, y: H.pin.y, lie: 'G' }; G.hole.st = [3, 5]; G.hole.done[1] = false;
          __replan(); __to('aim'); wGL.aimAt(H.pin.x, H.pin.y); const sel = wGL.view.sel; wGL.drag(sel.tick, 0); let holed = wGL.view.last.holed, n = 0; while (wGL.phase === 'fly' && n++ < 400) wGL.tick(0.05);
          out.end = { holed, ph: wGL.phase, res: wGL.view.last.res, drawnAway: (() => { const c = wGL.cam(); return wGL.G.h; })() };
          // the putter is not offered from far out on the fairway
          __mine(82); G.ball = wGL.G.ball; const H2 = wGL.course(0); const p = H2.line.find(q => wGL.lie(H2, q.x, q.y) === 'F' && Math.hypot(q.x - H2.pin.x, q.y - H2.pin.y) > 60);
          wGL.G.ball[0] = { x: p.x, y: p.y, lie: 'F' }; wGL.G.hole.st = [1, 1]; wGL.G.ball[1] = { x: H2.tee.x, y: H2.tee.y, lie: 'F' }; __replan(); __to('aim'); out.farClubs = wGL.view.clubs;
          // a 2-foot putt's aim stays on the cup
          __mine(83); const H3 = wGL.course(0); wGL.G.ball[0] = { x: H3.pin.x - .6, y: H3.pin.y, lie: 'G' }; wGL.G.ball[1] = { x: H3.tee.x, y: H3.tee.y, lie: 'T' }; wGL.G.hole.st = [2, 0]; __replan(); __to('aim');
          const a = wGL.view.sel.aim; out.shortAim = Math.hypot(a.x - H3.pin.x, a.y - H3.pin.y);
          // You play during your side's address: the shot is yours
          wLinksGame({ seed: 84, mode: 'watch' }); wGL.pause(true); __to('addr'); const side = wGL.view.cpu.side; wGL.setMode('play'); wGL.tick(0.05); out.addr = { side, ph: wGL.phase };
          // the meter turning at the top is heard
          __mine(85); let picks = 0; const was = wGL.onPick; wGL.onPick = () => { picks++; was && was(); }; wGL.press(); wGL.tick(1.2); out.turn = { st: wGL.view.meter.st, picks }; wGL.onPick = was;
          return out; })()""")
        check(r2['end']['holed'] and r2['end']['res'] == 0 and r2['end']['ph'] == 'rest', 'the putt that wins the hole drops, and the rest beat follows', r2['end'])
        dball = await pg.evaluate("(() => { const H = wGL.course(0), b = wGL.animBall(); return { anim: b, ph: wGL.phase }; })()")
        check('pt' not in r2['farClubs'] and len(r2['farClubs']) > 2, 'the putter is not offered from far out on the fairway', r2['farClubs'])
        check(r2['shortAim'] < 0.01, 'a 2-foot putt is aimed at the cup, not past it', r2['shortAim'])
        check(r2['addr']['ph'] == 'aim' if r2['addr']['side'] == 0 else r2['addr']['ph'] in ('addr', 'fly'), 'switching to You play while your ball is addressed gives you the shot', r2['addr'])
        check(r2['turn'] == {'st': 'down', 'picks': 1}, 'when the meter turns at the top by itself the rows hear it (the button says Mark)', r2['turn'])
        # the drawn ball after the holing putt: the hole on show keeps it in the cup (not back where it was struck)
        cup = await pg.evaluate("""(() => { __mine(86); const G = wGL.G, H = wGL.course(0); G.ball[0] = { x: H.pin.x, y: H.pin.y - 1.2, lie: 'G' }; G.ball[1] = { x: H.pin.x + 1, y: H.pin.y, lie: 'G' }; G.hole.st = [3, 5];
          __replan(); __to('aim'); wGL.aimAt(H.pin.x, H.pin.y); wGL.drag(wGL.view.sel.tick, 0); let n = 0; while (wGL.phase === 'fly' && n++ < 400) wGL.tick(0.05);
          wGL.render(); const px = wGL.scr(H.pin.x, H.pin.y - 1.2), cv = document.querySelector('#v-links canvas'), d = cv.width / 960, x = cv.getContext('2d').getImageData(Math.round(px[0] * d), Math.round(px[1] * d), 1, 1).data;
          return { holed: wGL.view.last.holed, ph: wGL.phase, white: x[0] > 235 && x[1] > 235 && x[2] > 225 }; })()""")
        check(cup['holed'] and not cup['white'], 'after the hole is won, the holed ball is not drawn back where it was struck', cup)
        # Space during their offer is the course's: it never presses the focused button
        sp = await pg.evaluate("""(() => { __mine(87); wGL.pause(false); const set = () => { const G = wGL.G, H = wGL.course(0); G.ball[0] = { x: H.pin.x + .2, y: H.pin.y, lie: 'G' }; G.ball[1] = { x: H.pin.x, y: H.pin.y - .5, lie: 'G' }; G.hole.st = [3, 3]; __replan(); __to('offer', 5); }; set();
          const b = document.getElementById('wLinksAgain'); let clicked = 0; const f = () => clicked++; b.addEventListener('click', f); b.focus();
          const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }); b.dispatchEvent(e); b.removeEventListener('click', f); wGL.pause(true);
          return { ph: wGL.phase, prevented: e.defaultPrevented }; })()""")
        check(sp['ph'] == 'offer' and sp['prevented'], 'Space during their offer is taken by the course, not the focused button', sp)

        # (from the third review of #93) the status line says the beat as it comes, and the result once the ball stops
        r3 = await pg.evaluate("""(() => { const out = {}; wLinksGame({ seed: 91, mode: 'play' }); wGL.pause(true); const seen = []; const was = wGL.onPhase;
          wGL.onPhase = ph => { was && was(ph); seen.push([ph, document.getElementById('wLinksNote').textContent]); }; __to('aim');
          out.aim = (seen.find(x => x[0] === 'aim') || [])[1] || ''; const sel = wGL.view.sel; wGL.drag(.9, 0);
          out.fly = document.getElementById('wLinksNote').textContent; out.flyMsg = wGL.msg; let n = 0; while (wGL.phase === 'fly' && n++ < 400) wGL.tick(0.05);
          out.rest = wGL.msg; wGL.onPhase = was;
          // after the game, Space is the page's again (the focused Another game works)
          wLinksGame({ seed: 92, mode: 'play', holes: 3 }); wGL.pause(true); wGL.setMode('watch'); let i = 0; while (!WGL.over && i++ < 40000) wGL.tick(0.05); wGL.setMode('play'); wGL.pause(false);
          const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }); document.getElementById('wLinksAgain').dispatchEvent(e); out.overSpace = e.defaultPrevented; wGL.pause(true);
          return out; })()""")
        check('Space to start the swing' in r3['aim'], 'the status line says your shot as the beat comes (not the shot before)', r3)
        check(r3['flyMsg'].endswith('…') and r3['rest'] != r3['flyMsg'] and ('yards' in r3['rest'] or 'water' in r3['rest']), 'while the ball flies the line says only who hit what; where it went comes once it stops', r3)
        check(not r3['overSpace'], 'after the game Space is the page\'s again (the focused button works)', r3)

        # (from the fourth review of #93) a held Space's repeats, a cancelled touch, and the same mode clicked again
        r4 = await pg.evaluate("""(() => { const out = {}, key = (k, rep) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, repeat: !!rep, bubbles: true, cancelable: true }));
          __mine(95); wGL.pause(false); key(' '); key(' ', 1); key(' ', 1); out.repeat = { ph: wGL.phase, st: wGL.view.meter.st }; wGL.pause(true);
          __mine(96); wGL.pause(false); const cv = document.querySelector('#v-links canvas'), send = (type, sx, sy) => { const r = cv.getBoundingClientRect(), f = r.width / 960; cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + sx * f, clientY: r.top + sy * f, pointerId: 9, bubbles: true, cancelable: true })); };
          const b = wGL.G.ball[0], [bx, by] = wGL.scr(b.x, b.y); send('pointerdown', bx, by); send('pointermove', bx - 100, by); send('pointercancel', bx - 100, by); out.cancel = { ph: wGL.phase, strokes: wGL.G.hole.st[0] }; wGL.pause(true);
          __mine(97); wGL.select({ club: 'mi', shape: 'fade' }); const before = JSON.stringify(wGL.view.sel); document.querySelector('[data-lmode="play"]').click(); wGL.tick(0.05);
          out.same = { ph: wGL.phase, kept: JSON.stringify(wGL.view.sel) === before };
          return out; })()""")
        check(r4['repeat'] == {'ph': 'swing', 'st': 'up'}, 'a held Space\'s repeats are not more presses (the swing waits for the next real one)', r4)
        check(r4['cancel'] == {'ph': 'aim', 'strokes': 0}, 'a cancelled touch calls the drag off: no swing, no stroke', r4)
        check(r4['same'] == {'ph': 'aim', 'kept': True}, 'clicking You play again changes nothing: your shot and its choices stay', r4)

        # (from the fifth review of #93) Space mid-round never presses a bar button; a box over the course holds the
        # meter; the phone strip waits for the ball
        r5 = await pg.evaluate("""(() => { const out = {}; __mine(101); wGL.pause(false); wGL.drag(.9, 0);
          const b = document.getElementById('wLinksAgain'); let clicked = 0; const f = () => clicked++; b.addEventListener('click', f); b.focus();
          const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }); b.dispatchEvent(e); b.removeEventListener('click', f); out.fly = { ph: wGL.phase, prevented: e.defaultPrevented }; wGL.pause(true);
          // the phone strip: while the putt that wins a hole rolls, it still shows the hole being played
          __mine(102); const G = wGL.G, H = wGL.course(0); G.ball[0] = { x: H.pin.x, y: H.pin.y - 1.2, lie: 'G' }; G.ball[1] = { x: H.pin.x + 1, y: H.pin.y, lie: 'G' }; G.hole.st = [3, 5];
          __replan(); __to('aim'); wGL.aimAt(H.pin.x, H.pin.y); wGL.drag(wGL.view.sel.tick, 0); out.strip = { holed: wGL.view.last.holed, ph: wGL.phase, html: W_SB_HTML.links(), live: wGL.G.h };
          return out; })()""")
        check(r5['fly']['prevented'] and r5['fly']['ph'] in ('fly', 'rest', 'next', 'addr', 'aim'), 'Space mid-round, the ball in the air, is the course\'s: it never presses a focused bar button', r5['fly'])
        check(r5['strip']['holed'] and r5['strip']['ph'] == 'fly' and 'Hole 1' in r5['strip']['html'] and r5['strip']['live'] == 1, 'while the putt that wins the hole rolls, the phone strip still shows the hole being played', r5['strip'])
        await pg.evaluate("__mine(103); wGL.pause(false); wGL.press(); showSettings()")
        await pg.wait_for_selector('#sLinksHoles')
        p0 = await pg.evaluate("wGL.view.meter.p")
        await pg.wait_for_function("new Promise(r => { let n = 0; const f = () => ++n >= 20 ? r(true) : requestAnimationFrame(f); requestAnimationFrame(f); })")
        mb = await pg.evaluate("(() => { const v = { p: wGL.view.meter.p, ph: wGL.phase }; document.getElementById('modal').hidden = true; wGL.pause(true); return v; })()")
        check(mb['ph'] == 'swing' and abs(mb['p'] - p0) < 1e-9, 'a box open over the course holds a swing in progress (it doesn\'t run out and go off)', [p0, mb])

        # ---------- How to play, Settings, leaving ----------
        await pg.evaluate("wLinksGame({ seed: 61, mode: 'play' }); wGL.pause(false)")
        await pg.click('#wLinksHowBtn')
        h = await pg.evaluate("({ how: !!document.getElementById('wLinksHow'), line: !!document.getElementById('wHelpLinks'), paused: wGL.paused, text: (document.getElementById('wLinksHow') || {}).textContent || '' })")
        check(h['how'] and h['line'] and h['paused'] and 'twice running' in h['text'] and 'read line' in h['text'], 'How to play has Golf: how it works (the hitter rule, the swing, the read line), and the game waits under it', {**h, 'text': h['text'][:80]})
        await pg.evaluate("showPage('play')")
        check(not await pg.evaluate("wGL.paused"), 'back on the course the game goes on', None)
        await pg.evaluate("showSettings()")
        await pg.wait_for_selector('#sLinksHoles')
        await pg.select_option('#sLinksHoles', '6')
        st = await pg.evaluate("(() => { const s = SET.linksHoles; document.getElementById('modal').hidden = true; wLinksGame({ seed: 62 }); return { s, holes: wGL.G.holes, bar: document.getElementById('wLinksHoles').value }; })()")
        check(st == {'s': 6, 'holes': 6, 'bar': '6'}, 'Settings sets the holes (6), and the next game is that long', st)
        await pg.evaluate("SET.linksHoles = 9; saveSettings()")
        await pg.click('#wLinksBack')
        b = await pg.evaluate("({ view: UI.view, on: wGL.on, bar: document.getElementById('wLinksBar').hidden })")
        check(b == {'view': 'world', 'on': False, 'bar': True}, 'Back to the world leaves the Links', b)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
