# Realm ring (issue #23, phase 1): the Anvil Ring boxes one bout, CPU against CPU: three rounds of 40 seconds, judged.
# The ring: punches cost stamina; a punch from out of range falls short; the guard takes most of a head punch but none
# of a body shot, which drains stamina too; a slip timed to the punch makes it miss and opens a counter window; a
# clinch ties both up until the referee breaks them; zero health is a knockdown, and the count follows. The bout: the
# bell, the judges' cards and the corner between rounds; a decision that agrees with the cards; the same seed boxes the
# same bout, and a headless bout leaves the one in the ring alone. Over many headless bouts the outcomes are mixed
# (decisions, stoppages and knockdowns, few draws). In the Realm: Ma Gristle at the Anvil Ring puts on a BOUT, in its
# own view behind W_ENGINES, which waits while another page is up; Back to the world parks the engine; How to play
# explains it. None of the engine's names reach the page. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-ring-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

# two fighters set up in the ring in round 1, standing still and fresh, d apart
SETUP = """(d, kinds) => { wBX.start({ fighters: (kinds || ['vampire', 'vampire']).map((k, i) => ({ n: 'F' + i, kind: k })), seed: 7 });
  for (let i = 0; i < 100 && wBX.phase === 'intro'; i++) wBX.step();
  const G = wBX.G; G.F[0].x = -d / 2; G.F[1].x = d / 2; G.F[0].y = G.F[1].y = 0;
  for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.mv = [0, 0]; } return G; }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined'")
        await pg.evaluate(f"window.__setup = {SETUP}")

        # ---------- the scope ----------
        leaks = await pg.evaluate("['bxStart', 'bxStep', 'bxBeat', 'bxThink', 'bxLand', 'BD', 'BXT', 'BXP', 'BXE', 'BX_PUNCH', 'BX_KIND', 'BX_PLAN', 'BX_JUDGES', 'bxDraw', 'bxSimBout'].filter(n => (0, eval)('typeof ' + n) !== 'undefined')")
        check(not leaks, 'none of the ring\'s names reach the page', leaks)

        # ---------- the ring ----------
        r = await pg.evaluate("""(() => { const G = __setup(2); const f = G.F[0], s0 = f.sta;
          const ok = wBX.act(0, 'hook'); const cost = s0 - f.sta, busy = f.a.k;
          __setup(wBX.range(0, 'jab') + 1); wBX.land(0, 'jab'); const short = wBX.ev[wBX.ev.length - 1];
          return { ok, cost, busy, short: [short.k, short.why] }; })()""")
        check(r['ok'] and r['cost'] == 7 and r['busy'] == 'hook', 'a punch costs stamina, and the fighter is busy throwing it', r)
        check(r['short'] == ['miss', 'short'], 'from out of range a punch falls short', r)
        g = await pg.evaluate("""(() => { const out = { open: [], guard: [], body: [], drain: [] };
          for (let i = 0; i < 300; i++) for (const k of ['open', 'guard', 'body']) {
            const G = __setup(2); const b = G.F[1], h0 = b.hp, s0 = b.sta;
            if (k !== 'open') b.a = { k: 'guard', t: 0, dur: 9, id: 0 };
            wBX.land(0, k === 'body' ? 'body' : 'jab'); const e = wBX.ev[wBX.ev.length - 1];
            if (e.k === 'land' || e.k === 'block') { out[k].push(h0 - b.hp); if (k === 'body') out.drain.push(s0 - b.sta); } }
          const avg = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
          return { open: avg(out.open), guard: avg(out.guard), body: avg(out.body), drain: avg(out.drain), n: [out.open.length, out.guard.length, out.body.length] }; })()""")
        check(g['n'][0] > 90 and g['guard'] < g['open'] * .3, 'the guard takes most of a head punch', g)
        check(g['body'] > g['open'] and g['drain'] > 2, 'a body shot goes under the guard and drains stamina', g)
        sl = await pg.evaluate("""(() => { const G = __setup(2); const b = G.F[1], h0 = b.hp;
          b.a = { k: 'slip', t: .1, dur: .38, id: 0 }; wBX.land(0, 'jab'); const e = wBX.ev[wBX.ev.length - 1];
          const ctr = b.ctr; wBX.act(1, 'jab'); return { k: e.k, side: e.side, hp: b.hp === h0, ctr, flagged: !!b.a.ctr, after: b.ctr }; })()""")
        check(sl['k'] == 'slip' and sl['side'] == 1 and sl['hp'] and sl['ctr'] > 0, 'a slip timed to the punch makes it miss, and opens a counter window', sl)
        check(sl['flagged'] and sl['after'] == 0, 'the next punch is the counter (and spends the window)', sl)
        cl = await pg.evaluate("""(() => { let G, ok = false; for (let i = 0; i < 40 && !ok; i++) { G = __setup(1.7); ok = wBX.clinch(0); }
          const both = G.F.map(f => f.a.k); let n = 0; while (G.F[0].a.k === 'clinch' && n++ < 200) wBX.step();
          return { ok, both, broke: G.F.map(f => f.a.k), d: +wBX.dist().toFixed(2), n }; })()""")
        check(cl['ok'] and cl['both'] == ['clinch', 'clinch'], 'from close in, a clinch ties both fighters up', cl)
        check(cl['broke'][0] != 'clinch' and cl['broke'][1] != 'clinch' and cl['d'] >= 2.5 and cl['n'] < 50, 'and the referee breaks it, standing them back to arm\'s length', cl)
        kd = await pg.evaluate("""(() => { const G = __setup(2); G.F[1].hp = .1; G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 };
          let n = 0; while (G.down == null && n++ < 50) wBX.land(0, 'hook');
          const down = [G.down, G.F[1].a.k], ph0 = wBX.phase; G.clock = 30; wBX.step(); const ph = wBX.phase, kds = G.kd.slice(), clock = G.clock;
          const counts = []; let m = 0; while (wBX.phase === 'kd' && m++ < 400) { wBX.step(); if (counts[counts.length - 1] !== wBX.count && wBX.count) counts.push(wBX.count); }
          const end = wBX.phase; return { down, ph0, ph, kds, clockStill: G.clock === clock, counts, end, how: G.over && G.over.how, hp: G.F[1].hp, hpMax: G.F[1].hpMax }; })()""")
        check(kd['down'] == [1, 'down'] and kd['ph'] == 'kd' and kd['kds'] == [0, 1], 'zero health is a knockdown, and the count starts', kd)
        check(kd['clockStill'] and kd['counts'][:2] == [1, 2] and all(b == a + 1 for a, b in zip(kd['counts'], kd['counts'][1:])), 'the count goes up one at a time, with the round clock stopped', kd)
        check((kd['end'] == 'rise' and 0 < kd['hp'] <= kd['hpMax']) or (kd['end'] == 'over' and kd['how'] == 'ko' and kd['counts'][-1] == 10),
              'up before ten they box on with some health back; at ten it is a knockout', kd)

        # ---------- a whole bout, headless ----------
        b = await pg.evaluate("""(() => { const f = [{ n: 'Brisket', kind: 'minotaur' }, { n: 'Fennel', kind: 'elf' }];
          const a = wBX.simBout({ fighters: f, seed: 11 }), c = wBX.simBout({ fighters: f, seed: 11 });
          return { a, same: JSON.stringify(a) === JSON.stringify(c) }; })()""")
        a = b['a']
        check(b['same'], 'the same seed boxes the same bout', None)
        check(a['over']['how'] in ('ko', 'tko', 'dec') and a['verdict'] and len(a['log']) > 3, 'a headless bout ends, with a verdict and a log', {k: a[k] for k in ('over', 'verdict')})
        n = len(a['cards'])
        check(n == (3 if a['over']['how'] == 'dec' else a['over']['round'] - 1) and len(a['rounds']) == n and all(len(r) == 3 for r in a['cards']),
              'each round boxed to the bell is on the three judges\' cards', {'cards': a['cards'], 'over': a['over']})
        many = await pg.evaluate("""(() => { const K = wBX.kinds, out = { how: {}, bad: [], kd: 0, n: 0, secs: [], wins: {} }; const t0 = performance.now();
          for (let i = 0; i < 240; i++) { const a = K[i % K.length], b = K[(i * 7 + 3) % K.length]; if (a === b) continue;
            const s = wBX.simBout({ fighters: [{ n: 'A', kind: a }, { n: 'B', kind: b }], seed: 500 + i }), v = s.over; out.n++;
            const key = v.how === 'dec' ? (v.win == null ? 'draw' : 'dec') : v.how; out.how[key] = (out.how[key] || 0) + 1;
            if (s.kd[0] + s.kd[1]) out.kd++;
            if (v.how === 'dec') { const T = s.totals, j = [0, 0]; T.forEach(t => { if (t[0] > t[1]) j[0]++; else if (t[1] > t[0]) j[1]++; });
              const w = j[0] >= 2 ? 0 : j[1] >= 2 ? 1 : null; if (w !== v.win || s.cards.length !== 3) out.bad.push({ i, T, v }); out.secs.push(s.secs); }
            if (v.how === 'tko' && Math.max(...s.kd) !== 3) out.bad.push({ i, tko: s.kd });
            for (const [side, k] of [[0, a], [1, b]]) { const r = out.wins[k] = out.wins[k] || [0, 0]; r[1]++; if (v.win === side) r[0]++; } }
          out.ms = (performance.now() - t0) / out.n; out.secs = [Math.min(...out.secs), Math.max(...out.secs)]; return out; })()""")
        N = many['n']; H = many['how']
        check(not many['bad'], 'every decision agrees with the judges\' cards, and every stoppage is the third knockdown', many['bad'][:3])
        check(118 <= many['secs'][0] and many['secs'][1] <= 122, 'a bout to the cards is three rounds of 40 seconds', many['secs'])
        stops = (H.get('ko', 0) + H.get('tko', 0)) / N
        check(.03 <= stops <= .3 and H.get('draw', 0) / N <= .06 and .3 <= many['kd'] / N <= .85,
              'over many bouts: mostly decisions, some stoppages, knockdowns in many, and few draws', {'how': H, 'n': N, 'kdBouts': many['kd']})
        rates = sorted(round(w / t, 2) for w, t in many['wins'].values())
        check(rates[0] >= .15 and rates[-1] <= .85, 'no kind always wins or always loses', rates)
        check(many['ms'] < 120, 'a headless bout is quick', round(many['ms'], 1))

        # ---------- in the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        t = await pg.evaluate("(() => { const K = DB.chars.gk_ring; return { bout: K.topics.bout && K.topics.bout.act, job: /BOUT/.test(K.topics.job.t) }; })()")
        check(t == {'bout': 'bout', 'job': True}, 'Ma Gristle at the Anvil Ring puts on a BOUT', t)
        # (Corners: the CPU's both sides, as in phase 1; your corner and your hands are realm_ring_hands)
        await pg.evaluate("W_RING_MODE = 'watch'; wRunAct('bout')")
        await pg.wait_for_function("UI.view === 'ring' && wBX.on")
        v = await pg.evaluate("""({ ring: !document.getElementById('v-ring').hidden, bar: !document.getElementById('wRingBar').hidden, runbar: document.getElementById('runbar').hidden,
          note: document.getElementById('wRingNote').textContent, fighters: wBX.G.F.map(f => f.kind), corners: wBX.G.corners.map(c => c.name) })""")
        check(v['ring'] and v['bar'] and v['runbar'] and 'three judges' in v['note'], 'the bout is in its own view, with its bar', v)
        check(v['corners'][0] == 'Cinderhold Boxing Club' and v['fighters'][0] in ('minotaur', 'dwarf', 'ogre', 'golem', 'kobold', 'troll'), 'the Cinderhold Boxing Club is in the red corner', v)
        await pg.screenshot(path='/tmp/realm-ring-intro.png')
        await pg.wait_for_function("wBX.phase === 'round' && wBX.G.clock < 34", timeout=20000)
        live = await pg.evaluate("({ thrown: wBX.G.F.reduce((n, f) => n + f.rs.thrown, 0), plain: JSON.stringify(JSON.parse(JSON.stringify(wBX.G))) === JSON.stringify(wBX.G) })")
        check(live['thrown'] > 0, 'in real time, the round is on and punches are thrown', live)
        check(live['plain'], 'the bout (G, with the fighters) is plain JSON', None)
        await pg.screenshot(path='/tmp/realm-ring-round.png')
        # another page up: the bout waits
        await pg.evaluate("showPage('help')"); c0 = await pg.evaluate("wBX.G.clock")
        await pg.wait_for_timeout(400)
        hp = await pg.evaluate("({ paused: wBX.paused, same: wBX.G.clock, help: !!document.getElementById('wHelpRing'), txt: (document.getElementById('wHelpRing') || {}).textContent || '' })")
        check(hp['paused'] and hp['same'] == c0, 'the bout waits while How to play is up', hp)
        check(hp['help'] and 'BOUT' in hp['txt'] and 'three judges' in hp['txt'] and 'knockdown' in hp['txt'], 'How to play explains the ring', hp['txt'][:200])
        await pg.evaluate("showPage('play')")
        await pg.wait_for_function("!wBX.paused && wBX.G.clock < " + str(c0 - .3), timeout=10000)
        # through to the corner: the cards, the plans, a log line
        await pg.evaluate("wBX.pause(true)")
        cr = await pg.evaluate("""(() => { let n = 0; while (wBX.phase !== 'corner' && wBX.phase !== 'over' && n++ < 4000) wBX.step(); const G = wBX.G;
          return { ph: wBX.phase, cards: G.cards.length, plans: G.plans.length, log: G.log.some(l => /^End of round 1/.test(l.msg)), round: G.round, clock: G.clock }; })()""")
        await pg.evaluate("wBX.pause(false)")
        if cr['ph'] == 'corner':
            check(cr['cards'] == 1 and cr['plans'] == 2 and cr['log'] and cr['round'] == 2 and cr['clock'] == 40, 'at the bell: the round on the cards, the corners\' plans for the next, and the clock back to 40', cr)
            await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/realm-ring-corner.png')
        else:
            check(cr['ph'] == 'over', 'the first round ends at the bell (or the bout ends inside it)', cr)
        await pg.evaluate("wBX.pause(true)")
        ov = await pg.evaluate("(() => { let n = 0; while (wBX.phase !== 'over' && n++ < 20000) wBX.step(); return wBX.phase; })()")
        await pg.evaluate("wBX.pause(false)")
        await pg.wait_for_function("WBX && WBX.over && document.getElementById('wRingNote').textContent === WBX.over.verdict")
        check(ov == 'over', 'the bout ends, and the bar says how', await pg.evaluate("document.getElementById('wRingNote').textContent"))
        await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/realm-ring-over.png')
        await pg.click('#wRingBack')
        back = await pg.evaluate("({ view: UI.view, on: wBX.on, ring: document.getElementById('v-ring').hidden, bar: document.getElementById('wRingBar').hidden })")
        check(back == {'view': 'world', 'on': False, 'ring': True, 'bar': True}, 'Back to the world parks the ring', back)
        sw = await pg.evaluate("(() => { wRunAct('bout'); showView('gridiron'); const r = { ring: wBX.on, grid: wGF.on }; showView('world'); return r; })()")
        check(sw == {'ring': False, 'grid': True}, 'another engine\'s view hides the ring', sw)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
