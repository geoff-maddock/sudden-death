# Realm rink: the call (issue #83, phase 5).
# Each side has a system with the puck and one without, a power-play and a penalty-kill setup, Tempo and Edge. The
# systems are rock, paper, scissors (a beaten Forecheck gives up a Rush, the Trap stops a Rush and does nothing against
# a Dump, a Collapse leaves the Point open and smothers a Cycle, a Box owns the front against a Crash), worth a little on
# every shot; the special-teams setups take over when a side is short. The scout reads a system kept on. A system
# decides how far up the ice a side goes at the carrier, and the Trap stands across the middle. A pushed Tempo tires a
# side; a Rough Edge hits more and is penalised more than a Clean one. One timeout a game, at a whistle, gives the
# skaters on the ice their breath back. Fixed calls (the lab's) never change. The CPU's coach: a Squire calls at random
# and is late with his lines; a Knight pushes when behind late; an Archmage answers your call; and over many games the
# better coach wins more. Manage: the skaters play and the calls are yours; the CPU's coach leaves them alone, and your
# goalie too. On the page: Manage on the bar, the coach's rows under the rink (lit, with what each does against their
# call), the line that says how it is going, the bench's buttons, and How to play. Asserts; exits nonzero on failure.
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

SETUP = """window.__eight = name => ({ name, short: name[0], color: '#3a6ab8', light: '#fff', kinds: ['vampire', 'harpy', 'witch', 'werewolf', 'troll', 'wraith', 'skeleton', 'gorgon'] });
window.__game = (seed, o) => { wHK.start(Object.assign({ seed, teams: [__eight('Aces'), __eight('Bears')], powers: false }, o || {})); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); return wHK.play; };
window.__away = (P, keep) => { P.pl.forEach((p, i) => { if (!keep.includes(i)) { p.x = 2.5; p.y = 8.5 - (i % 6) * .2; p.vx = p.vy = 0; } }); };
window.__put = (P, i, x, y) => { const p = P.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; p.stun = 0; p.cd = 0; p.act = ''; return p; }; 0"""

async def main():
    if not os.environ.get('SD_BUILT'): subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wHK !== 'undefined'")
        await pg.evaluate(SETUP)

        # ---------- the tables ----------
        t = await pg.evaluate("""(() => { const k = o => Object.keys(o); __game(3);
          return { atts: k(wHK.atts), defs: k(wHK.defs), pps: k(wHK.pps), pks: k(wHK.pks), tempos: k(wHK.tempos), edges: k(wHK.edges), names: [wHK.atts.dump.n, wHK.defs.fore.n, wHK.pps.front.n, wHK.pks.press.n, wHK.tempos.sit.n, wHK.edges.rough.n],
            desc: [wHK.atts, wHK.defs, wHK.pps, wHK.pks, wHK.tempos, wHK.edges].every(T => Object.values(T).every(v => v.desc.length >= 8)), call0: wHK.calls,
            e: [['rush', 'fore'], ['rush', 'trap'], ['dump', 'trap'], ['point', 'collapse'], ['crash', 'box'], ['cycle', 'collapse'], ['cycle', 'fore']].map(([a, d]) => wHK.edge(a, d)[0]), why: wHK.edge('rush', 'trap')[1],
            pp: [['umbrella', 'box'], ['umbrella', 'diamond'], ['overload', 'press'], ['front', 'box'], ['front', 'diamond']].map(([a, d]) => wHK.edgePP(a, d)[0]), bad: wHK.call(0, 'att', 'nope'), ok: wHK.call(0, 'att', 'rush'), now: wHK.calls[0].att }; })()""")
        check(t['atts'] == ['cycle', 'rush', 'dump', 'point', 'crash'] and t['defs'] == ['fore', 'trap', 'box', 'collapse', 'man'] and t['pps'] == ['umbrella', 'overload', 'front'] and t['pks'] == ['box', 'diamond', 'press']
              and t['tempos'] == ['push', 'bal', 'sit'] and t['edges'] == ['rough', 'bal', 'clean'] and t['names'] == ['Dump and chase', 'Forecheck', 'Net front', 'Pressure', 'Sit on it', 'Rough'] and t['desc'],
              'five systems with the puck, five without, three power-play and three penalty-kill setups, three Tempos and three Edges, each explained', t)
        check(t['e'] == [1, -1, 1, 1, -1, -1, 0] and len(t['why']) > 10 and t['pp'] == [1, -1, -1, -1, 0], 'the systems are rock, paper, scissors: a beaten Forecheck gives up a Rush, the Trap stops one, and so on, each with its reason', t)
        check(t['call0'][0] == {'att': 'cycle', 'def': 'man', 'pp': 'umbrella', 'pk': 'box', 'tempo': 'bal', 'edge': 'bal'} and t['bad'] != '' and t['ok'] == '' and t['now'] == 'rush', 'a side starts on Cycle and Man, balanced; a call takes, and a call that does not exist is refused', t)

        # ---------- what a call is worth ----------
        q = await pg.evaluate("""(() => { const odds = (c0, c1) => { const P = __game(4, { calls: [c0, c1] }), gx = wHK.goalX(0), g = P.pl[11]; __away(P, [2, 11]); const sp = wHK.goalSpot(1, gx - 6, 0); g.x = sp[0]; g.y = sp[1]; return { q: wHK.shotOdds(2, 'wrist', gx - 6, 0).q, cq: wHK.callQ(0), poke: wHK.callPoke(0), e: wHK.edgeNow(0)[0] }; };
          const good = odds({ att: 'rush' }, { def: 'fore' }), even = odds({ att: 'rush' }, { def: 'man' }), bad = odds({ att: 'rush' }, { def: 'trap' });
          const P = __game(4, { calls: [{ att: 'rush' }, { def: 'man' }] }), sc = [wHK.scout[0].n]; const cq = [wHK.callQ(0)];
          for (let i = 0; i < 3; i++) { wHK.faceoffCalls(); sc.push(wHK.scout[0].n); cq.push(wHK.callQ(0)); } wHK.call(0, 'att', 'cycle'); const reset = wHK.scout[0].n;
          wHK.penalty(1, P.pl[7].ri); wHK.lines(); const short = { att: wHK.attNow(0).n, def: wHK.defNow(1).n, e: wHK.edgeNow(0)[0], them: wHK.edgeNow(1)[0], high: wHK.defNow(1).high };
          return { good, even, bad, sc, cq, reset, short, R: wHK.callRules }; })()""")
        check(q['good']['e'] == 1 and q['bad']['e'] == -1 and abs(q['good']['q'] - q['even']['q'] - q['R']['q']) < 1e-9 and abs(q['even']['q'] - q['bad']['q'] - q['R']['q']) < 1e-9 and q['good']['poke'] < q['even']['poke'] < q['bad']['poke'],
              'a system that suits what they are in is worth a little on every shot, and makes the puck a little harder to poke away; one that doesn\'t costs the same', q)
        check(q['sc'] == [0, 1, 2, 2] and q['cq'][1] < q['cq'][0] and q['cq'][2] < q['cq'][1] and q['cq'][3] == q['cq'][2] and q['reset'] == 0, 'the scout: a system kept on from one face-off to the next is read a little better, twice over; a new one is fresh', q)
        check(q['short'] == {'att': 'Umbrella', 'def': 'Box', 'e': 1, 'them': 0, 'high': 10}, 'when a side is a skater short the power-play and penalty-kill setups take over', q)

        # ---------- what a system does on the ice ----------
        f = await pg.evaluate("""(() => { const near = def => { const P = __game(5, { mode: 'play', calls: [null, { def }] }); __away(P, [0]); const c = __put(P, 0, 18, 0); [6, 7, 8, 9, 10].forEach((i, k) => __put(P, i, 30, -6 + k * 3)); wHK.give(0); P.me = 0; wHK.setFouls({ trip: 0, hook: 0, board: 0, rough: 0 });
            for (let t = 0; t < 45; t++) { wHK.input({ steer: [0, 0] }); wHK.step(); c.x = 18; c.y = 0; c.vx = c.vy = 0; if (P.puck.st !== 'held') wHK.give(0); }
            return Math.min(...[6, 7, 8, 9, 10].map(i => Math.hypot(P.pl[i].x - 18, P.pl[i].y))); };
          const fore = near('fore'), box = near('box');
          const P = __game(6, { mode: 'play', calls: [null, { def: 'trap' }] }); __away(P, [3]); const c = __put(P, 3, 6, 0); [6, 7, 8, 9, 10].forEach((i, k) => __put(P, i, 30, -6 + k * 3)); wHK.give(3); P.me = 3;
          for (let t = 0; t < 90; t++) { wHK.input({ steer: [0, 0] }); wHK.step(); c.x = 6; c.y = 0; c.vx = c.vy = 0; if (P.puck.st !== 'held') wHK.give(3); }
          const trap = [6, 7, 8].map(i => Math.round(P.pl[i].x)), back = [9, 10].map(i => Math.round(P.pl[i].x));
          return { fore, box, trap, back }; })()""")
        check(f['fore'] < 2.5 and f['box'] > 5, 'a Forecheck goes at the carrier at centre ice; a Box leaves them alone out there', f)
        check(all(16 <= x <= 24 for x in f['trap']) and all(x > 24 for x in f['back']), 'the Trap stands three across the middle of the ice, with two behind them', f)
        st = await pg.evaluate("""(() => { wHK.setFouls({ trip: .035, hook: .04, board: .3, rough: .02 }); const run = (c, n) => { let hits = 0, pens = 0, sta = 0, m = 0; for (let i = 0; i < n; i++) { const s = wHK.simGame({ seed: 800 + i, teams: [__eight('Aces'), __eight('Bears')], calls: [c, {}], powers: false }); hits += s.box[0].tot.hit; pens += s.pens.filter(e => e.side === 0).length; }
            const P = __game(9, { calls: [c, {}] }), G = wHK.G; wHK.setFouls({ trip: 0, hook: 0, board: 0, rough: 0 }); wHK.step(30 * 12); const on = G.on[0].slice(0, 5); wHK.setFouls({ trip: .035, hook: .04, board: .3, rough: .02 });
            return { hits, pens, sta: on.reduce((a, i) => a + G.sta[0][i], 0) / 5 }; };
          const s = wHK.simGame({ seed: 3, teams: [__eight('Aces'), __eight('Bears')], calls: [{ att: 'dump', def: 'trap', tempo: 'sit', edge: 'clean' }, {}] });
          return { rough: run({ edge: 'rough' }, 16), clean: run({ edge: 'clean' }, 16), push: run({ tempo: 'push', def: 'fore' }, 0), sit: run({ tempo: 'sit', def: 'box' }, 0), fixed: s.calls[0], log: Object.keys(s.sysLog[0]), used: s.sysLog[0].dump.t > 30 && s.sysLog[0].cycle.t === 0 }; })()""")
        check(st['rough']['hits'] > st['clean']['hits'] * 1.5 and st['rough']['pens'] > st['clean']['pens'] * 2, 'a Rough Edge hits more, and is penalised more, than a Clean one', st)
        check(st['push']['sta'] < st['sit']['sta'] - .02, 'a pushed Tempo with a Forecheck tires a side more than sitting on it in a Box', st)
        check(st['fixed'] == {'att': 'dump', 'def': 'trap', 'pp': 'umbrella', 'pk': 'box', 'tempo': 'sit', 'edge': 'clean'} and st['used'] and st['log'] == ['cycle', 'rush', 'dump', 'point', 'crash'], 'a fixed call (the lab\'s) never changes, and the game keeps how each system went', st)

        # ---------- the timeout ----------
        to = await pg.evaluate("""(() => { const P = __game(10, { mode: 'manage' }), G = wHK.G; const live = wHK.timeout(0); for (const i of G.on[0].slice(0, 5)) G.sta[0][i] = .3;
          wHK.give(0); wHK.foul(6, 'hooking'); wHK.give(6); const ph = wHK.phase, took = wHK.timeout(0), sta = G.on[0].slice(0, 5).map(i => G.sta[0][i]), left = wHK.to.slice(), again = wHK.timeout(0), msg = wHK.msg;
          return { live, ph, took, sta, left, again, msg, R: wHK.callRules.to }; })()""")
        check(to['live'] == 'Only at a whistle.' and to['ph'] == 'dead' and to['took'] == '' and all(abs(v - .7) < .07 for v in to['sta']) and to['left'] == [0, 1] and to['again'] == 'No timeout left.' and 'Timeout' in to['msg'],
              'one timeout a game, only at a whistle: the skaters on the ice get their breath back', to)

        # ---------- the coaches ----------
        cp = await pg.evaluate("""(() => { const P = __game(11, { skill: [1, 2], calls: [{ att: 'rush', def: 'fore' }, null] }), G = wHK.G; const d = {}, a = {};
          for (let i = 0; i < 60; i++) { wHK.cpuCall(1); const c = wHK.calls[1]; d[c.def] = (d[c.def] || 0) + 1; a[c.att] = (a[c.att] || 0) + 1; }
          __game(12, { skill: [0, 1] }); const sq = new Set(); for (let i = 0; i < 60; i++) { wHK.cpuCall(0); sq.add(wHK.calls[0].att + '/' + wHK.calls[0].tempo); }
          __game(13, { skill: [1, 1] }); const G2 = wHK.G; G2.p = 3; G2.clock = G2.plen * .2; G2.score = [1, 2]; wHK.cpuCall(0); const behind = wHK.calls[0].tempo; G2.score = [2, 1]; G2.clock = G2.plen * .05; wHK.cpuCall(0); const ahead = wHK.calls[0].tempo;
          const s = wHK.simGame({ seed: 5, skill: [2, 0] });
          return { d, a, sq: sq.size, behind, ahead, skill: s.skill, names: wHK.skillNames }; })()""")
        check(cp['d'].get('trap', 0) >= 28 and cp['d']['trap'] == max(cp['d'].values()) and cp['a'].get('rush', 0) >= 30, 'an Archmage answers your call: against your Rush he goes to the Trap, and against your Forecheck he rushes', cp)
        check(cp['sq'] >= 6 and cp['behind'] == 'push' and cp['ahead'] == 'sit' and cp['skill'] == [2, 0] and cp['names'] == ['Squire', 'Knight', 'Archmage'], 'a Squire calls at random; a Knight pushes when behind late and sits on a lead at the end', cp)
        ln = await pg.evaluate("""(() => { const go = (skill, s) => { const P = __game(14, { skill: [skill, skill] }), G = wHK.G, i = s * 6 + 1, p = P.pl[i]; __away(P, [i]); __put(P, i, 16 + s * 8, -6); const c = s * 6; __put(P, c, s ? 10 : 30, 4); wHK.give(c); G.sta[s][p.ri] = .35; G.sta[s][6] = 1; G.sta[s][7] = 1;
            wHK.step(20); return wHK.changing().some(x => x[0] === i); };
          return { knight: go(1, 0), squire: go(0, 0), R: wHK.staRules }; })()""")
        check(ln['knight'] and not ln['squire'] and ln['R']['late'] < .35 < ln['R']['tired'], 'a Squire is late with his lines: a skater a Knight would send off stays on', ln)
        sk = await pg.evaluate("""(() => { const run = (a, b) => { let w = 0, d = 0; for (let i = 0; i < 70; i++) { const s = wHK.simGame({ seed: 7000 + i, teams: [__eight('Aces'), __eight('Bears')], skill: [a, b] }); if (s.win === 0) w++; d += s.score[0] - s.score[1]; } return [w, d]; };
          return { arch: run(2, 0), squire: run(0, 2) }; })()""")
        check(sk['arch'][0] > sk['squire'][0] + 8 and sk['arch'][1] > 0 > sk['squire'][1], 'over many games an Archmage beats a Squire more often than not, whichever bench he is on', sk)

        # ---------- Manage ----------
        mg = await pg.evaluate("""(() => { const P = __game(15, { mode: 'manage', skill: [1, 2] }), G = wHK.G; const hands = [wHK.input({ steer: [1, 0] }), wHK.me];
          wHK.call(0, 'att', 'dump'); wHK.call(0, 'def', 'collapse'); const theirs0 = JSON.stringify(wHK.calls[1]); let moved = false; for (let i = 0; i < 30; i++) { wHK.faceoffCalls(); if (JSON.stringify(wHK.calls[1]) !== theirs0) moved = true; }
          const mine = wHK.calls[0]; const auto = [wHK.benchAct('auto'), wHK.auto, wHK.benchAct('auto'), wHK.auto]; const pull = [wHK.benchAct('pull'), wHK.pulled(0), wHK.benchAct('pull'), wHK.pulled(0)];
          G.p = 3; G.clock = G.plen * .05; G.score = [0, 1]; __away(P, [1]); __put(P, 1, 28, 0); wHK.give(1); wHK.step(3); const cpuPull = wHK.pulled(0);
          __game(16, { mode: 'watch' }); const watch = [wHK.benchAct('auto'), wHK.benchAct('pull')];
          return { hands, mine, moved, auto, pull, cpuPull, watch, mode: 'manage' }; })()""")
        check(mg['hands'] == ['', -1] and mg['mine']['att'] == 'dump' and mg['mine']['def'] == 'collapse' and mg['moved'], 'in Manage the skaters play themselves and your calls stay yours, while their coach goes on changing his', mg)
        check(mg['auto'] == ['manual', False, 'auto', True] and mg['pull'] == ['pull', 'hand', 'back', ''] and mg['cpuPull'] == '' and mg['watch'] == ['', ''], 'the bench is yours in Manage: who changes your lines, and your goalie (the CPU never pulls yours); in Watch it is not', mg)

        # ---------- the page ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wRinkGame({ seed: 7, calls: [null, { att: 'rush', def: 'trap' }] })")
        await pg.wait_for_function("UI.view === 'rink' && wHK.phase === 'live' && !document.getElementById('wRinkCalls').hidden")
        pl = await pg.evaluate("({ rows: !document.getElementById('wRinkCalls').hidden, pad: !document.getElementById('wRinkPad').hidden, none: document.getElementById('wRinkCallsNone').hidden })")
        await pg.click('#wRinkModes [data-kmode="manage"]')
        u = await pg.evaluate("""(() => { const box = document.getElementById('wRinkCalls'), rows = [...box.querySelectorAll('.wccrow')], top = e => e.getBoundingClientRect().top;
          return { mode: wHK.mode, on: [...document.querySelectorAll('#wRinkModes button.on')].map(x => x.textContent), pad: document.getElementById('wRinkPad').hidden, labels: rows.map(r => r.querySelector('.wccl').textContent),
            lit: rows.slice(0, 6).map(r => [...r.querySelectorAll('button.on')].map(b => b.textContent)), counts: rows.slice(0, 6).map(r => r.querySelectorAll('button').length), under: top(box) >= document.querySelector('#v-rink canvas').getBoundingClientRect().bottom - 1, above: top(box) < top(document.getElementById('wRinkBox')),
            note: document.getElementById('wRinkNote').textContent, now: document.getElementById('wRinkNow').textContent, rushTip: box.querySelector('[data-rcall="att"][data-rid="rush"]').title, rushCls: box.querySelector('[data-rcall="att"][data-rid="rush"]').className, dumpCls: box.querySelector('[data-rcall="att"][data-rid="dump"]').className,
            bench: [...rows[rows.length - 1].querySelectorAll('button')].map(b => [b.textContent.trim(), b.disabled]), coach: rows[rows.length - 1].textContent.includes('Their coach: Knight') }; })()""")
        check(pl == {'rows': True, 'pad': True, 'none': True} and u['mode'] == 'manage' and u['on'] == ['Manage'] and u['pad'] and u['under'] and u['above'] and 'manage' in u['note'],
              'Manage on the bar: the pad goes, and the coach\'s rows sit under the rink, above the box scores (they are there in You play too)', [pl, u])
        check(u['labels'] == ['With the puck', 'Without it', 'Power play', 'Penalty kill', 'Tempo', 'Edge', 'Powers', 'The big ones', 'Bench'] and u['counts'] == [5, 5, 3, 3, 3, 3] and u['lit'] == [['Cycle'], ['Man'], ['Umbrella'], ['Box'], ['Balanced'], ['Balanced']],
              'the rows: with the puck, without it, power play, penalty kill, Tempo, Edge, the powers (w92) and the bench, with what is on lit', u)
        check('trap' in u['rushTip'] and 'Poor' in u['rushTip'] and 'wpoor' in u['rushCls'] and 'wgood' in u['dumpCls'] and 'Your Cycle against their Trap' in u['now'] and 'Their Rush against your Man' in u['now'],
              'each button says how it would do against what they are in, and a line says how yours is doing now', u)
        check([b[0] for b in u['bench']] == ['Change now', 'Lines: the coach', 'Timeout (1 left)', 'Pull goalie'] and u['bench'][0][1] is False and u['bench'][2][1] is True and u['coach'], 'the bench row: Change now, who changes your lines, the timeout (at a whistle only) and the goalie, and who their coach is', u)
        await pg.click('#wRinkCalls [data-rcall="att"][data-rid="dump"]'); await pg.click('#wRinkCalls [data-rbench="auto"]')
        c2 = await pg.evaluate("({ att: wHK.calls[0].att, lit: [...document.querySelector('#wRinkCalls .wccrow').querySelectorAll('button.on')].map(b => b.textContent), auto: wHK.auto, lines: document.querySelector('[data-rbench=\"auto\"]').textContent, now: document.getElementById('wRinkNow').textContent })")
        check(c2['att'] == 'dump' and c2['lit'] == ['Dump and chase'] and c2['auto'] is False and c2['lines'] == 'Lines: you' and 'Your Dump and chase against their Trap' in c2['now'], 'a click makes the call: the button lights, the line follows, and the lines are yours to change', c2)
        await pg.evaluate("(() => { wHK.give(0); wHK.foul(6, 'hooking'); wHK.give(6); })()")
        await pg.wait_for_function("!document.querySelector('[data-rbench=\"timeout\"]').disabled")
        await pg.click('[data-rbench="timeout"]')
        t2 = await pg.evaluate("({ to: wHK.to, btn: document.querySelector('[data-rbench=\"timeout\"]').textContent.trim(), dis: document.querySelector('[data-rbench=\"timeout\"]').disabled })")
        check(t2 == {'to': [0, 1], 'btn': 'Timeout (0 left)', 'dis': True}, 'at a whistle the Timeout button takes it, and it is gone', t2)
        await pg.click('#wRinkModes [data-kmode="watch"]')
        w = await pg.evaluate("({ rows: document.getElementById('wRinkCalls').hidden, none: !document.getElementById('wRinkCallsNone').hidden, text: document.getElementById('wRinkCallsNone').textContent })")
        check(w['rows'] and w['none'] and 'coaches make the calls' in w['text'], 'in Watch the rows go, and a line says the coaches make the calls', w)
        await pg.click('#wRinkModes [data-kmode="manage"]'); await pg.set_viewport_size({'width': 400, 'height': 800})
        ph = await pg.evaluate("({ scroll: document.documentElement.scrollWidth - innerWidth, rows: !document.getElementById('wRinkCalls').hidden })")
        check(ph['scroll'] <= 0 and ph['rows'], 'on a phone the rows wrap and nothing scrolls sideways', ph)
        await pg.set_viewport_size({'width': 1200, 'height': 1000})
        await pg.evaluate("showPage('help')"); hp = await pg.evaluate("(document.getElementById('wRinkHowCall') || {}).textContent || ''"); await pg.evaluate("showPage('play')")
        check('The call.' in hp and 'rock, paper, scissors' in hp and 'The scout.' in hp and 'Archmage' in hp and 'Dump and chase' in hp, 'How to play explains the call, the systems, the scout, the stances, the bench and their coach', None)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
