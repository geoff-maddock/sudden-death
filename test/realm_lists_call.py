# Realm lists (issue #117, phase 4): the plan and the read.
# The herald's card: the rider you're about to meet, what their side has ridden this match (the counts, their last four
# courses and where each lance went), their usual mix and the read. Your squire's word: before anything is ridden it
# says so; against a side that keeps its shield angled it aims for the body and says they've angled it; against a
# square shield it aims for the shield and says so; its words match its plan. The CPU's read by skill: a Squire reads
# nothing, a Knight's mix doesn't change with what you've ridden, an Archmage's read does, and a "human" who always
# rides one plan is punished more by an Archmage than by a Knight. On Play an Archmage reads your own plans. The card
# shows under the lists before each of your courses, at desktop and phone width (no sideways scroll), and not in the
# charge or in Watch. How to play explains the plan's three choices, the card and reading the other rider.
# Phase 4's review: a lance couched high and let go at the last instant keeps its reach (one never lowered doesn't); on
# a heat's last course the squire never says to save the wind; before anything is ridden it claims a habit only on a
# real lean (as the card does); their plan is hidden in your plan beat (the view, the drawing) and the charge shows it.
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

HELP = r"""
window.__to = (ph, max) => { let n = 0; while (wJT.phase !== ph && !(wJT.G && wJT.G.over) && n++ < (max || 20000)) wJT.tick(0.05); return wJT.phase === ph; };
// ride your courses on Play with plan p each time (the lance couched at the right moment, the tip left to sway) until k of yours are ridden
window.__mine = (k, p) => { let n = 0; while (wJT.G.plans[0].length < k && !wJT.G.over && n++ < 40) { if (!__to('plan')) break; wJT.select(p); wJT.press();
  let m = 0; while (wJT.phase === 'charge' && m++ < 800) { const C = wJT.view.charge; if (C && C.p >= wJT.playRules.couch.ideal && !C.down) wJT.couch(true); wJT.tick(.01); }
  m = 0; while (wJT.phase === 'seat' && m++ < 400) wJT.tick(.02); } return wJT.G.plans[0].length; };
window.__run = (n, s0, o) => { const w = [0, 0]; for (let i = 0; i < n; i++) w[wJT.simMatch(Object.assign({ seed: s0 + i }, o)).win]++; return w[0] / n; };
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
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- the herald's card ----------
        c = await pg.evaluate("""(() => { wJT.start({ seed: 21, skill: [1, 1], courses: 5, cornerBy: ['none', 'none'], fix: [null, { aim: 'shield', guard: 'angled', pace: 'canter' }] }); const before = wJT.card(0);
          let k = 0; while (wJT.G.plans[1].length < 5 && !wJT.G.over && k++ < 20) wJT.turn(); const K = wJT.card(0), P = wJT.G.plans[1], R = wJT.riders();
          const u = K.usual, sum = Object.values(u.aim).reduce((a, b) => a + b, 0);
          return { before: [before.counts.n, before.text, before.last.length], n: K.counts.n, plans: P.length, angled: K.counts.angled, shield: K.counts.shield, last: K.last.length, newest: K.last[K.last.length - 1], lastPlan: P[P.length - 1],
            name: K.name === wJT.G.teams[1].roster[R ? R[1] : 0].n, text: K.text, sum: +sum.toFixed(2), read: K.read, mount: K.mount, skill: K.skill }; })()""")
        check(c['before'] == [0, 'Nothing ridden yet this match.', 0], 'before anything is ridden the card says so', c['before'])
        check(c['n'] == c['plans'] and c['angled'] == c['n'] and c['shield'] == c['n'] and c['last'] == min(4, c['n']) and c['newest']['at'] == c['lastPlan']['at'] and c['name'] and c['mount'] and c['skill'] == 'Knight',
              'the card counts what their side has ridden, shows their last four courses (newest last, where each lance went) and names the rider you meet, their mount and skill', c)
        check(f"angled {c['n']} of {c['n']}" in c['text'] and 'at the shield' in c['text'] and .98 <= c['sum'] <= 1.02 and c['read']['read'] and c['read']['angled'] >= .5,
              'the card in words, their usual mix, and the read it makes', c)

        # ---------- your squire's word ----------
        w = await pg.evaluate("""(() => { const out = {};
          wJT.start({ seed: 30, mode: 'play', skill: [1, 1] }); wJT.pause(true); __to('plan'); out.first = wJT.view.sel;
          wJT.start({ seed: 31, mode: 'play', skill: [1, 1], courses: 5, cornerBy: ['none', 'none'], fix: [null, { aim: 'shield', guard: 'angled', pace: 'canter' }] }); wJT.pause(true); __mine(3, { aim: 'body', guard: 'square', pace: 'canter' }); __to('plan'); out.angled = wJT.view.sel; out.nA = wJT.G.plans[1].length;
          wJT.start({ seed: 32, mode: 'play', skill: [1, 1], courses: 5, cornerBy: ['none', 'none'], fix: [null, { aim: 'body', guard: 'square', pace: 'canter' }] }); wJT.pause(true); __mine(3, { aim: 'body', guard: 'square', pace: 'canter' }); __to('plan'); out.square = wJT.view.sel; out.nS = wJT.G.plans[1].length;
          return out; })()""")
        check(w['first']['why'].startswith('Nothing to read yet'), 'before anything is ridden, your squire says there is nothing to read yet', w['first'])
        check(w['angled']['aim'] == 'body' and 'had the shield angled' in w['angled']['why'] and 'aim for the body' in w['angled']['why'],
              'against a side that keeps its shield angled, your squire aims for the body and says they\'ve angled it', w['angled'])
        check(w['square']['aim'] == 'shield' and 'square' in w['square']['why'] and 'aim for the shield' in w['square']['why'], 'against a square shield, your squire aims for the shield and says it has been square', w['square'])
        words = {'shield': 'aim for the shield', 'body': 'aim for the body', 'helm': 'helm'}
        ok = all(words[x['aim']] in x['why'] and (('angle your shield' in x['why'] or 'angle it' in x['why']) if x['guard'] == 'angled' else 'square' in x['why']) and (('gallop' in x['why']) if x['pace'] == 'gallop' else ('canter' in x['why'])) for x in (w['first'], w['angled'], w['square']))
        check(ok, 'your squire\'s words match the plan: its aim, its guard and its pace', w)

        # ---------- the CPU's read by skill ----------
        rd = await pg.evaluate("""(() => { const out = {}, F = { aim: 'shield', guard: 'angled', pace: 'canter' };
          // a Squire reads nothing: its plans are the same whatever you've ridden
          const sq = plans => { wJT.start({ seed: 40, skill: [1, 0] }); wJT.G.plans[0] = plans; const c = {}; for (let i = 0; i < 300; i++) { const p = wJT.plan(1); c[p.aim] = (c[p.aim] || 0) + 1; } return c; };
          const many = k => Array.from({ length: 6 }, (_, i) => Object.assign({ heat: 0, course: i, at: 'glance', lead: 0, ri: 0 }, k));
          out.squire = [sq([]), sq(many(F))];
          // a Knight's mix is the same whatever you've ridden; an Archmage's read moves with it
          wJT.start({ seed: 41, skill: [1, 1] }); const k0 = JSON.stringify(wJT.planMix(1)); wJT.G.plans[0] = many(F); out.knight = k0 === JSON.stringify(wJT.planMix(1));
          wJT.start({ seed: 41, skill: [1, 2] }); const a0 = wJT.habit(1); wJT.G.plans[0] = many(F); const a1 = wJT.habit(1); out.arch = [a0.angled, a1.angled, a0.aim.shield, a1.aim.shield, a1.read, wJT.plan(1).aim];
          return out; })()""")
        same = all(abs(rd['squire'][0].get(a, 0) - rd['squire'][1].get(a, 0)) <= 30 for a in ('shield', 'body', 'helm'))
        check(same, 'a Squire reads nothing: its plans don\'t change with what you\'ve ridden', rd['squire'])
        check(rd['knight'], 'a Knight\'s mix doesn\'t change with what you\'ve ridden (it can\'t be read, and it reads nothing of you)', rd['knight'])
        a = rd['arch']
        check(a[1] > a[0] + .2 and a[3] > a[2] and a[4] and a[5] != 'shield', 'an Archmage\'s read moves with what you\'ve ridden, and it rides against it (you keep your shield angled: it aims past it)', a)
        hm = await pg.evaluate("""(() => { const F = [['shield', 'angled', 'canter'], ['shield', 'square', 'canter'], ['body', 'square', 'gallop'], ['body', 'angled', 'canter'], ['helm', 'square', 'canter']], out = {};
          for (const [aim, guard, pace] of F) { const f = [{ aim, guard, pace }, null]; out[`${aim}/${guard}/${pace}`] = [__run(250, 52000, { skill: [1, 1], fix: f }), __run(250, 52000, { skill: [1, 2], handsBy: [null, 1], fix: f })]; }
          return out; })()""")
        for k2, v2 in hm.items(): print(f'   (always {k2}, v a Knight {v2[0]:.3f}, v an Archmage with a Knight\'s hands {v2[1]:.3f})')
        diffs = [v2[0] - v2[1] for v2 in hm.values()]
        # (a plan near the course's balance, such as the body angled at a canter, can't be punished much by anyone: no
        # plan answers it by much; the rest are punished hard)
        check(all(d > -.02 for d in diffs) and sum(diffs) / len(diffs) >= .08 and sum(d > .05 for d in diffs) >= 3, 'a "human" who always rides one plan is punished more by an Archmage\'s read than by a Knight (the same hands)', hm)

        # ---------- on Play, an Archmage reads you ----------
        pa = await pg.evaluate("""(() => { wJT.start({ seed: 60, mode: 'play', skill: [1, 2], courses: 5, cornerBy: ['none', 'none'] }); wJT.pause(true); const n = __mine(4, { aim: 'shield', guard: 'angled', pace: 'canter' });
          const h = wJT.habit(1), mine = wJT.G.plans[0].map(p => p.aim + '/' + p.guard); return { n, h, mine, plan: wJT.G.over ? null : wJT.plan(1) }; })()""")
        check(pa['n'] >= 3 and pa['h']['read'] and pa['h']['angled'] >= .5 and pa['h']['aim']['shield'] >= .5 and (pa['plan'] is None or pa['plan']['aim'] != 'shield') and all(m == 'shield/angled' for m in pa['mine']),
              'on Play an Archmage reads the plans you ride (always the shield, angled) and rides against them', pa)

        # ---------- the card on the page ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        cd = await pg.evaluate("""(() => { W_LISTS_MODE = 'play'; wListsGame({ seed: 70, mode: 'play' }); wJT.pause(true); __to('plan'); wListsRows(); const first = { shown: !$('wListsRowCard').hidden, text: $('wListsCard').textContent };
          __mine(2, { aim: 'body', guard: 'square', pace: 'canter' }); __to('plan'); wListsRows(); const R = $('wListsRowCard'), K = wJT.card(0);
          const out = { first, shown: !R.hidden, text: $('wListsCard').textContent, items: R.querySelectorAll('.wjtlast li').length, n: K.counts.n, name: K.name };
          wJT.press(); wJT.tick(.05); wListsRows(); out.charge = !R.hidden; W_LISTS_MODE = 'watch'; wJT.setMode('watch'); __to('herald'); wListsRows(); out.watch = !R.hidden; return out; })()""")
        check(cd['first']['shown'] and 'Nothing ridden yet' in cd['first']['text'], 'the card shows before your first course, and says nothing is ridden yet', cd['first'])
        check(cd['shown'] and cd['name'] in cd['text'] and 'Their shield angled' in cd['text'] and 'Their usual' in cd['text'] and cd['items'] == min(4, cd['n']) and cd['n'] >= 1,
              'before each of your courses the card names the rider, counts what their side has ridden, lists their last courses and their usual mix', cd)
        check(not cd['charge'] and not cd['watch'], 'the card is not shown in the charge or in Watch', cd)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("""(() => { const t = (document.getElementById('wListsHow') || {}).textContent || ''; return { call: !!document.getElementById('wHelpListsCall'), parts: ['How the plan plays off itself.', 'The herald\\'s card', 'Reading the other rider.'].every(w => t.includes(w)), angled: /Against an angled shield, aim for the body/.test(t) }; })()""")
        check(hp == {'call': True, 'parts': True, 'angled': True}, 'How to play explains the plan\'s three choices and how they play off each other, the herald\'s card and reading the other rider', hp)
        await pg.evaluate("showPage('play')")

        # ---------- a phone ----------
        ph = await br.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        ph.on('pageerror', lambda e: errs.append('phone: ' + str(e)))
        await ph.goto(REALM_URL); await ph.wait_for_function("typeof wJT !== 'undefined'")
        await ph.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await ph.evaluate(HELP)
        pw = await ph.evaluate("""(() => { wListsGame({ seed: 71, mode: 'play' }); wJT.pause(true); __mine(3, { aim: 'shield', guard: 'square', pace: 'canter' }); __to('plan'); wListsRows();
          const R = document.getElementById('wListsRowCard'), r = R.getBoundingClientRect(), d = document.documentElement;
          return { shown: !R.hidden, w: Math.round(r.right), side: d.scrollWidth - d.clientWidth, items: R.querySelectorAll('.wjtlast li').length }; })()""")
        check(pw['shown'] and pw['w'] <= 390 and pw['side'] <= 0 and pw['items'] >= 1, 'at phone width the card shows and fits, and the page doesn\'t scroll sideways', pw)

        # ---------- phase 4's review ----------
        # 1. a lance lowered and let go at the last instant keeps the reach of where its tip was; one never lowered doesn't
        rl = await pg.evaluate("""(() => { const one = (seed, how) => { wJT.start({ seed, mode: 'play', skill: [1, 1] }); wJT.pause(true); __to('plan');
            wJT.select({ aim: 'helm', guard: 'square', pace: 'canter' }); wJT.press(); let m = 0;
            if (how !== 'never') { while (wJT.phase === 'charge' && wJT.view.charge.p < wJT.playRules.couch.ideal && m++ < 1000) wJT.tick(.01); wJT.couch(true);
              m = 0; while (wJT.phase === 'charge' && wJT.view.charge.p < .985 && m++ < 1000) { wJT.aim(9, 6); wJT.tick(.01); } if (how === 'release') wJT.couch(false); }
            m = 0; while (wJT.phase === 'charge' && m++ < 2000) wJT.tick(.01); m = 0; while (wJT.phase === 'seat' && m++ < 1000) wJT.tick(.02);
            const L = wJT.last; return { high: L && L.high ? L.high[0] : null, up: L && L.rides[0].up }; };
          const rel = [], never = [], held = []; for (let i = 0; i < 6; i++) { rel.push(one(300 + i, 'release')); never.push(one(300 + i, 'never')); held.push(one(300 + i, 'hold')); }
          return { rel, never, held }; })()""")
        check(all(r['high'] is True and r['up'] for r in rl['rel']) and all(r['high'] is True for r in rl['held']), 'a lance couched high and let go at the last instant still reaches past the head (the reach cost stays)', rl['rel'])
        check(all(r['high'] is False and r['up'] for r in rl['never']), 'a lance never lowered reaches for nothing', rl['never'])
        # 2. on a heat's last course there is no wind to save
        lw = await pg.evaluate("""(() => { const bad = [], seen = { last: 0, canter: 0 }; for (let sd = 0; sd < 24; sd++) { wJT.start({ seed: 700 + sd, mode: 'play', skill: [1, sd % 3] }); wJT.pause(true);
            let k = 0; while (!wJT.G.over && k++ < 20) { if (!__to('plan')) break; const G = wJT.G, last = !wJT.inTilt() && G.course === G.courses - 1, S = wJT.view.sel;
              if (last) { seen.last++; if (S.pace === 'canter') { seen.canter++; if (/save the wind/.test(S.why)) bad.push(S.why); } }
              wJT.press(); let m = 0; while (['charge', 'seat'].includes(wJT.phase) && m++ < 4000) { const C = wJT.view.charge; if (C && C.p >= wJT.playRules.couch.ideal && !C.down) wJT.couch(true); wJT.tick(.02); } } }
          return { seen, bad: bad.slice(0, 3), n: bad.length }; })()""")
        check(lw['seen']['canter'] >= 3 and lw['n'] == 0, 'on a heat\'s last course your squire never says to save the wind (fresh mounts next heat)', lw)
        # 3. before anything is ridden, the squire claims a habit only when it is a real lean, as the card does
        hb = await pg.evaluate("""(() => { const out = []; for (const sk of [0, 1, 2]) for (const sd of [5, 6, 7]) { wJT.start({ seed: sd, mode: 'play', skill: [1, sk] }); wJT.pause(true); __to('plan');
            const K = wJT.card(0), U = K.usual, w = wJT.view.sel.why, lean = U.angled >= .6 ? 'angles' : U.angled <= .4 ? 'squares' : null;
            out.push({ sk, angled: U.angled, lean, why: w, claims: /usually (angles|squares)/.test(w) ? w.match(/usually (angles|squares)/)[1] : null, leans: /open beside an angled shield|leaves the helm open|square, it breaks clean/.test(w), none: /no habit/.test(w) }); }
          return out; })()""")
        check(all(r['claims'] == r['lean'] for r in hb), 'before anything is ridden the squire claims a guard habit only when their usual leans that way (as the card says)', [r for r in hb if r['claims'] != r['lean']][:3])
        check(all(not r['leans'] for r in hb if r['lean'] is None) and all(r['none'] for r in hb if r['lean'] is None) and any(r['lean'] is None for r in hb), 'with no lean to read, the squire says so and its aim doesn\'t lean on one', [r for r in hb if r['lean'] is None][:3])
        # 4. their plan is hidden until both are committed: not in the view, not drawn, not printed
        hd = await pg.evaluate("""(() => { wJT.start({ seed: 11, mode: 'play', skill: [1, 2] }); wJT.pause(true); __to('plan'); const V = wJT.view, said = [], ft = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (t) { said.push(String(t)); return ft.apply(this, arguments); }; try { wJT.render(0); } finally { CanvasRenderingContext2D.prototype.fillText = ft; }
            const plan = { theirs: V.plans ? V.plans[1] : null, printed: said.filter(t => /Their guard/.test(t)) };
            wJT.press(); wJT.tick(.05); const C = wJT.view; return { plan, charge: C.plans && C.plans[1] ? C.plans[1].guard : null }; })()""")
        check(hd['plan']['theirs'] is None and not hd['plan']['printed'] and hd['charge'] in ('angled', 'square'), 'their plan is hidden in your plan beat (not in the view, their guard not printed), and the charge reveals it', hd)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
