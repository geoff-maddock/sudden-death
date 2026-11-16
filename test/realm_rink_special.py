# Realm rink: penalties, the pulled goalie and the shootout (issue #83, phase 3).
# A foul by the side without the puck is delayed: play goes on until that side touches it, and the other side's goalie
# comes off for an extra skater; then the whistle, the box, and a face-off in the fouling side's end. A foul by the side
# with the puck is whistled at once. One penalty at a time. A goal while one is coming wipes it out. In the box a player
# is off the ice and their side a skater short; they come back when the time is up, or when the power play scores (a
# short-handed goal ends nothing). A side is never below three skaters, and the one waiting stays on the ice. With the
# centre in the box somebody else takes the face-off. A side that is short may ice the puck; an even one may not.
# The CPU pulls its goalie late in the third when a goal or two behind with the puck up the ice, and sends them back
# when level; never yours in You play, where G does it. An empty net is nearly a sure thing, and the goal says so. A
# face-off in a side's own half sends its goalie back.
# The shootout is played out: the shooter alone on the goalie from centre, a try at a time, in nobody's stats. By hand
# you shoot your own tries, the CPU keeps its hands off while you do, a try runs out of time, and against theirs your
# goalie is yours while you steer. Over many games penalties, power-play goals and empty-net goals all happen, and a
# power play scores more than a side that is short. On the page: the penalties list, penalty minutes in the box score,
# the Goalie button and the G key, and How to play. Asserts; exits nonzero on failure.
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

# side 0: 0 C, 1 LW, 2 RW, 3 LD, 4 RD, 5 G; side 1: 6 to 11. In the first period side 0 attacks the right-hand goal.
SETUP = """window.__play = (seed, mode) => { wHK.start({ seed, mode: mode || 'watch' }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
  const P = wHK.play; for (const p of P.pl) { p.vx = p.vy = 0; p.stun = 0; p.cd = 0; } return P; };
window.__away = (P, keep) => { P.pl.forEach((p, i) => { if (!keep.includes(i)) { p.x = 2.5; p.y = -8.5 + (i % 6) * .2; p.vx = p.vy = 0; } }); };
window.__put = (P, i, x, y) => { const p = P.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; p.stun = 0; p.cd = 0; p.act = ''; return p; };
window.__live = () => { let n = 0; while (wHK.phase !== 'live' && wHK.phase !== 'over' && n++ < 600) wHK.step(); return wHK.phase; };
window.__on = (P, s) => P.pl.filter(p => p.side === s && !p.off && p.pos !== 'G').length;
window.__since = (P, n0) => P.evN > n0 ? P.ev.slice(-(P.evN - n0)) : []; 0"""

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

        # ---------- the foul, delayed and called ----------
        d = await pg.evaluate("""(() => { const P = __play(5), G = wHK.G; wHK.setFouls({ trip: 0, hook: 0, board: 0, rough: 0 });
          __put(P, 6, 24, 0); __put(P, 1, 26, 0); wHK.give(6); wHK.foul(1, 'tripping');
          const coming = { delay: wHK.delay, ph: wHK.phase, pulled: wHK.pulled(1), inNet: [wHK.inNet(0), wHK.inNet(1)], box: G.box.length, msg: wHK.msg, six: P.pl.filter(q => q.side === 1 && !q.off).length };
          wHK.foul(2, 'hooking'); const second = wHK.delay.i;
          wHK.give(3); const called = { delay: wHK.delay, ph: wHK.phase, box: G.box.map(b => [b.side, b.ri, b.t]), pens: G.pens.map(e => [e.side, e.k, e.who === P.pl[1].n]), pim: G.stat[0][P.pl[1].ri].pim, msg: wHK.msg, pulled: wHK.pulled(1) };
          __live(); const after = { str: wHK.strength(), off: P.pl[1].off, on: [__on(P, 0), __on(P, 1)], inNet: wHK.inNet(1), foX: Math.round(P.ev.length && 10 * 8.5) / 10 };
          return { coming, second, called, after, minor: wHK.minor() }; })()""")
        c = d['coming']
        check(c['delay'] and c['delay']['side'] == 0 and c['delay']['k'] == 'tripping' and c['ph'] == 'live' and c['box'] == 0 and 'coming' in c['msg'],
              'a foul by the side without the puck is delayed: play goes on, and nobody is in the box yet', d)
        check(c['pulled'] == 'delay' and c['inNet'] == [True, False] and c['six'] == 6, 'meanwhile the other side\'s goalie comes off, and skates as an extra skater', d)
        check(d['second'] == 1, 'one penalty at a time: a second foul while one is coming is let go', d)
        k = d['called']
        check(k['delay'] is None and k['ph'] == 'dead' and k['box'] == [[0, d['called']['box'][0][1], d['minor']]] and k['pens'] == [[0, 'tripping', True]] and k['pim'] == 2 and 'box' in k['msg'] and 'power play' in k['msg'],
              'when the fouling side touches the puck the whistle goes: the player is in the box for a minor, with two penalty minutes', d)
        check(d['after']['str'] == [4, 5] and d['after']['off'] and d['after']['on'] == [4, 5] and d['after']['inNet'], 'then it is four skaters on five, and the other goalie is back in the net', d)
        fo = await pg.evaluate("(() => { const P = wHK.play, e = P.ev.filter(x => x.k === 'faceoff'); return { n: e.length, take: P.pl[wHK.taker(0)].pos }; })()")
        w = await pg.evaluate("""(() => { const P = __play(6), G = wHK.G; wHK.give(0); wHK.foul(1, 'hooking'); const now = { ph: wHK.phase, delay: wHK.delay, box: G.box.length, pulled: wHK.pulled(1) };
          const P2 = __play(7), G2 = wHK.G; wHK.give(6); wHK.foul(1, 'tripping'); const sc = G2.score.slice(); wHK.goalBy(6);
          return { now, wiped: { delay: wHK.delay, box: G2.box.length, pens: G2.pens.length, score: G2.score, was: sc, msg: wHK.msg, pulled: wHK.pulled(1), str: G2.log[0].str } }; })()""")
        check(w['now'] == {'ph': 'dead', 'delay': None, 'box': 1, 'pulled': ''}, 'a foul by the side with the puck is whistled at once', w)
        check(w['wiped']['delay'] is None and w['wiped']['box'] == 0 and w['wiped']['pens'] == 0 and w['wiped']['score'][1] == w['wiped']['was'][1] + 1 and 'wiped out' in w['wiped']['msg'] and w['wiped']['pulled'] == '',
              'a goal while a penalty is coming wipes it out', w)

        # ---------- serving it ----------
        s = await pg.evaluate("""(() => { const P = __play(8), G = wHK.G; wHK.give(0); wHK.foul(1, 'hooking'); __live(); const n0 = P.evN, t0 = G.box[0].t;
          let n = 0; while (G.box.length && wHK.phase !== 'over' && n++ < 6000) wHK.step();
          const ev = __since(P, n0); const out = { t0, steps: n, back: ev.some(e => e.k === 'back' && e.s === P.pl[1].n) || G.log.some(l => l.str === 'pp'), str: wHK.strength() }; __live(); out.off = P.pl[1].off; out.on = [__on(P, 0), __on(P, 1)];
          const P2 = __play(9), G2 = wHK.G; wHK.give(0); wHK.foul(1, 'hooking'); __live(); wHK.goalBy(6); const pp = { box: G2.box.length, str: G2.log[G2.log.length - 1].str, msg: wHK.msg }; __live(); pp.off = P2.pl[1].off;
          const P3 = __play(10), G3 = wHK.G; wHK.give(0); wHK.foul(1, 'hooking'); __live(); wHK.goalBy(2); const sh = { box: G3.box.length, str: G3.log[G3.log.length - 1].str, msg: wHK.msg };
          return { out, pp, sh }; })()""")
        check(s['out']['t0'] == 20 and s['out']['back'] and s['out']['str'] == [5, 5] and not s['out']['off'] and s['out']['on'] == [5, 5], 'a penalty runs on the game clock; when it is over the player is back on the ice and the sides are even', s)
        check(s['pp'] == {'box': 0, 'str': 'pp', 'msg': s['pp']['msg'], 'off': False} and 'power play' in s['pp']['msg'] and 'penalty is over' in s['pp']['msg'], 'a power-play goal ends the penalty', s)
        check(s['sh']['box'] == 1 and s['sh']['str'] == 'sh' and 'short-handed' in s['sh']['msg'], 'a short-handed goal ends nothing', s)
        t = await pg.evaluate("""(() => { const P = __play(11), G = wHK.G; const ri = i => P.pl[i].ri;
          wHK.penalty(0, ri(0)); wHK.lines(); const one = { on: __on(P, 0), take: wHK.taker(0), c: P.pl[0].off };
          wHK.penalty(0, ri(3)); wHK.penalty(0, ri(1)); wHK.lines(); const three = { box: G.box.length, wait: G.wait.length, on: [__on(P, 0), __on(P, 1)], waiting: P.pl[1].off, str: wHK.strength() };
          return { one, three }; })()""")
        check(t['one'] == {'on': 4, 'take': 1, 'c': True}, 'with the centre in the box, the next skater takes the face-off', t)
        check(t['three'] == {'box': 2, 'wait': 1, 'on': [3, 5], 'waiting': False, 'str': [3, 5]}, 'a side is never below three skaters: the third penalty waits, and that player stays on the ice until it starts', t)
        ic = await pg.evaluate("""(() => { const go = short => { const P = __play(12, 'play'), G = wHK.G; if (short) { wHK.penalty(0, P.pl[1].ri); wHK.lines(); }
            __away(P, [3]); __put(P, 3, 8, 6); wHK.give(3); P.me = 3; wHK.input({ steer: [1, 0] }); wHK.input({ pass: true }); wHK.step(10); wHK.input({ pass: false }); wHK.input({ steer: [0, 0] });
            const k = P.puck.k, ice = P.puck.ice; __away(P, []); let n = 0, maxX = 0; while (wHK.phase === 'live' && n++ < 90) { wHK.puckStep(); maxX = Math.max(maxX, P.puck.x); }
            return { k, ice, ph: wHK.phase, maxX: Math.round(maxX), icings: G.icings, msg: wHK.msg }; };
          return { even: go(false), short: go(true) }; })()""")
        check(ic['even']['k'] == 'dump' and ic['even']['ice'] == 0 and ic['even']['ph'] == 'dead' and ic['even']['icings'] == 1 and 'Icing' in ic['even']['msg'], 'at even strength a puck sent the length of the ice untouched is icing', ic)
        check(ic['short']['ice'] == -1 and ic['short']['ph'] == 'live' and ic['short']['icings'] == 0 and ic['short']['maxX'] >= 37, 'a side that is a skater short may ice it freely', ic)

        # ---------- pulling the goalie ----------
        # (in the third period, as in the first, side 0 attacks the right-hand goal: up the ice is a big x; in the second, a small one)
        pl = await pg.evaluate("""(() => { const R = wHK.pullRules; const go = (mode, p, frac, score, x) => { const P = __play(13, mode), G = wHK.G; G.p = p; G.clock = G.plen * frac; G.score = score.slice(); __away(P, [1]); __put(P, 1, x, 0); wHK.give(1); P.me = 1; if (mode === 'play') wHK.input({ steer: [0, 0] });
            wHK.step(2); return wHK.pulled(0); };
          const late = go('watch', 3, R.at * .8, [0, 1], 28), P = wHK.play, G = wHK.G; const on = P.pl.filter(q => q.side === 0 && !q.off).length, inNet = wHK.inNet(0), q = wHK.shotOdds(6, 'wrist', wHK.goalX(1) - wHK.dir(1) * 8, 0).q;
          G.score = [1, 1]; wHK.step(2); const level = wHK.pulled(0);
          return { late, on, inNet, q, level, ahead: go('watch', 3, R.at * .8, [1, 0], 28), early: go('watch', 3, R.at * 2, [0, 1], 28), second: go('watch', 2, R.at * .8, [0, 1], 12), far: go('watch', 3, R.at * .8, [0, 4], 28),
            back: go('watch', 3, R.at * .8, [0, 1], 10), yours: go('play', 3, R.at * .8, [0, 1], 28), R }; })()""")
        check(pl['late'] == 'late' and pl['on'] == 6 and not pl['inNet'] and pl['q'] > .9 and pl['level'] == '', 'late in the third, a goal behind with the puck up the ice, the CPU pulls its goalie: six skaters and an empty net; level again, the goalie goes back', pl)
        check([pl['ahead'], pl['early'], pl['second'], pl['far'], pl['back']] == [''] * 5, 'not when ahead, not earlier in the third, not in the second period, not when far behind, not with the puck in its own end', pl)
        check(pl['yours'] == '', 'in You play the CPU never pulls your goalie', pl)
        hp = await pg.evaluate("""(() => { const P = __play(14, 'play'), G = wHK.G; __away(P, [1]); __put(P, 1, 20, 0); wHK.give(1); P.me = 1;
          const a = wHK.input({ act: 'pull' }), was = wHK.pulled(0), b = wHK.input({ act: 'pull' }), now = wHK.pulled(0);
          wHK.input({ act: 'pull' }); wHK.foul(1, 'hooking'); __live(); const afterFo = wHK.pulled(0);
          let goal = null; wHK.setFouls({ trip: 0, hook: 0, board: 0, rough: 0 });
          for (let t = 0; t < 12 && !goal; t++) { const P2 = __play(20 + t, 'play'), G2 = wHK.G; wHK.pull(1, 'hand'); __away(P2, [2]); __put(P2, 2, wHK.goalX(0) - 4, 0); wHK.give(2); P2.me = 2; wHK.input({ shoot: true }); wHK.step(2); wHK.input({ shoot: false });
            let n = 0; while (wHK.phase === 'live' && n++ < 30) wHK.step(); if (G2.log.length) goal = { en: G2.log[0].en, msg: wHK.msg, sa: G2.stat[1][P2.pl[11].ri].sa, sog: G2.sog[0] }; }
          return { a, was, b, now, afterFo, goal }; })()""")
        check(hp['a'] == 'pull' and hp['was'] == 'hand' and hp['b'] == 'back' and hp['now'] == '' and hp['afterFo'] == '', 'by hand, G pulls your goalie and sends them back; a face-off in your own end sends them back too', hp)
        check(hp['goal'] and hp['goal']['en'] and 'empty net' in hp['goal']['msg'] and hp['goal']['sa'] == 0 and hp['goal']['sog'] == 1, 'a goal into an empty net says so, and is no shot faced by the goalie', hp)

        # ---------- the shootout, played out ----------
        so = await pg.evaluate("""(() => { const P = __play(31), G = wHK.G; G.p = 4; G.score = [2, 2]; G.clock = .05; const shots = G.sog.slice(); let n = 0; while (wHK.phase !== 'so' && n++ < 400) wHK.step();
          n = 0; while (!wHK.soTry && n++ < 200) wHK.step(); const T = wHK.soTry, sh = P.pl[T.i];
          const ready = { st: T.st, side: T.side, on: P.pl.filter(q => !q.off).length, at: [sh.x, sh.y], has: P.puck.st === 'held' && P.puck.h === T.i, goalie: T.gi === 11 && !P.pl[11].off, box: G.box.length };
          const order = []; let last = null, tries = 0; n = 0;
          while (wHK.phase !== 'over' && n++ < 30000) { wHK.step(); const U = wHK.soTry; if (U && U.st === 'done' && last !== G.so.tries.join()) { last = G.so.tries.join(); order.push(U.side); tries++; } }
          const S = wHK.summary();
          return { ready, order, tries, over: G.over, shots, after: G.sog.slice(), last: S.log[S.log.length - 1], msg: wHK.msg, goals: G.so.goals, triesBy: G.so.tries }; })()""")
        check(so['ready'] == {'st': 'ready', 'side': 0, 'on': 2, 'at': [20, 0], 'has': True, 'goalie': True, 'box': 0}, 'a try in the shootout starts at centre: the shooter with the puck, the goalie in the net, and nobody else on the ice', so)
        alt = all(so['order'][i] != so['order'][i + 1] for i in range(len(so['order']) - 1))
        check(so['tries'] >= 3 and alt and so['over'] and so['over']['so'] and abs(so['over']['score'][0] - so['over']['score'][1]) == 1 and so['last']['k'] == 'so' and so['last']['side'] == so['over']['win'] and so['shots'] == so['after'],
              'the sides take turns until it is settled, by one goal; the tries are in nobody\'s shots', so)
        hs = await pg.evaluate("""(() => { const start = seed => { const P = __play(seed, 'play'), G = wHK.G; G.p = 4; G.score = [1, 1]; G.clock = .05; let n = 0; while ((!wHK.soTry || wHK.soTry.st !== 'go') && n++ < 600) wHK.step(); return P; };
          let P = start(41), T = wHK.soTry, sh = P.pl[T.i], dir = wHK.dir(0), x0 = sh.x; wHK.input({ steer: [dir, 0] }); wHK.step(30);
          const steer = { mine: T.side === 0 && wHK.me === T.i, moved: (sh.x - x0) * dir, held: P.puck.st === 'held', puckMine: wHK.puckMine, st: wHK.soTry.st };
          wHK.input({ steer: [dir, 1] }); const dn = wHK.input({ shoot: true }); wHK.step(2); const up = wHK.input({ shoot: false }); let n = 0; while (wHK.soTry && wHK.soTry.st === 'go' && n++ < 60) wHK.step();
          const shot = { dn, up, st: wHK.soTry && wHK.soTry.st, rel: wHK.release && wHK.release.aim, tries: wHK.G.so.tries.slice() }; wHK.input({ steer: [0, 0] });
          P = start(42); T = wHK.soTry; n = 0; while (wHK.soTry && wHK.soTry.st === 'go' && n++ < 400) { wHK.input({ steer: [-wHK.dir(0), 0] }); wHK.step(); }
          const timeout = { secs: n / 30, st: wHK.soTry.st, scored: wHK.soTry.scored, msg: wHK.msg, max: wHK.pace.soMax }; wHK.input({ steer: [0, 0] });
          P = start(43); n = 0; while (wHK.soTry && wHK.soTry.st === 'go' && n++ < 400) wHK.step(); const idle = { done: wHK.soTry.st === 'done', secs: n / 30 };
          n = 0; while ((!wHK.soTry || wHK.soTry.side !== 1 || wHK.soTry.st !== 'go') && wHK.phase === 'so' && n++ < 600) wHK.step();
          let goalie = null; if (wHK.phase === 'so') { const g = P.pl[5], y0 = g.y; wHK.input({ steer: [0, 1] }); wHK.step(8); goalie = { me: wHK.soTry.gi, dy: g.y - y0 }; wHK.input({ steer: [0, 0] }); }
          return { steer, shot, timeout, idle, goalie }; })()""")
        check(hs['steer'] == {'mine': True, 'moved': hs['steer']['moved'], 'held': True, 'puckMine': True, 'st': 'go'} and hs['steer']['moved'] > 2, 'by hand you skate your own try in, and the CPU keeps its hands off while you do', hs)
        check(hs['shot']['dn'] == 'wind' and hs['shot']['up'] == 'wrist' and hs['shot']['st'] == 'done' and hs['shot']['rel'] == {'y': 1, 'hi': True} and hs['shot']['tries'] == [1, 0], 'Space shoots it, aimed where you steer, and that is the try', hs)
        check(abs(hs['timeout']['secs'] - hs['timeout']['max']) < .2 and hs['timeout']['st'] == 'done' and not hs['timeout']['scored'] and 'runs out of room' in hs['timeout']['msg'], 'a try that takes too long is over, with no goal', hs)
        check(hs['idle']['done'] and hs['idle']['secs'] < hs['timeout']['max'], 'leave the keys alone and your shooter takes the try themselves', hs)
        check(hs['goalie'] is None or (hs['goalie']['me'] == 5 and hs['goalie']['dy'] > .4), 'against their try, your goalie is yours while you steer up and down the screen', hs)

        # ---------- over many games ----------
        m = await pg.evaluate("""(() => { wHK.setFouls({ trip: .035, hook: .04, board: .3, rough: .02, interfere: .6 }); const out = []; for (let i = 0; i < 40; i++) out.push(wHK.simGame({ seed: 700 + i }));
          const sum = f => out.reduce((a, s) => a + f(s), 0), kinds = {}; for (const s of out) for (const e of s.pens) kinds[e.k] = (kinds[e.k] || 0) + 1;
          return { pens: sum(s => s.pens.length) / out.length / 2, kinds, pp: sum(s => s.log.filter(l => l.str === 'pp').length), sh: sum(s => s.log.filter(l => l.str === 'sh').length), en: sum(s => s.log.filter(l => l.en).length),
            pim: out.every(s => s.box[0].tot.pim + s.box[1].tot.pim === 2 * s.pens.length), so: out.filter(s => s.so).length, level: out.filter(s => s.score[0] === s.score[1]).length, goals: sum(s => s.score[0] + s.score[1]) / out.length / 2 }; })()""")
        check(.4 <= m['pens'] <= 2.5 and len(m['kinds']) >= 3 and m['pim'], 'over many games a side takes a penalty or two, of several kinds, two minutes each in the box score', m)
        check(m['pp'] > 0 and m['pp'] > m['sh'] * 2 and m['en'] > 0 and m['level'] == 0 and 1.5 <= m['goals'] <= 5.5, 'power plays score, far more than sides that are short; empty-net goals happen; no game ends level', m)

        # ---------- the page ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false"); await pg.evaluate(SETUP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wRinkGame({ seed: 7 })")
        await pg.wait_for_function("UI.view === 'rink' && wHK.phase === 'live' && !document.getElementById('wRinkPad').hidden")
        e0 = await pg.evaluate("document.getElementById('wRinkPens').textContent")
        await pg.evaluate("wHK.pause(true)")
        await pg.keyboard.press('g'); g1 = await pg.evaluate("wHK.pulled(0)"); await pg.keyboard.press('g'); g2 = await pg.evaluate("wHK.pulled(0)")
        await pg.evaluate("document.querySelector('#wRinkPad [data-kpad=\"pull\"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3 }))"); g3 = await pg.evaluate("wHK.pulled(0)")
        check('No penalties yet' in e0 and [g1, g2, g3] == ['hand', '', 'hand'], 'the G key and the pad\'s Goalie button pull your goalie and send them back', [e0, g1, g2, g3])
        await pg.evaluate("(() => { wHK.give(0); wHK.foul(1, 'hooking'); wHK.pause(false); })()")
        await pg.wait_for_function("document.querySelectorAll('#wRinkPens li[style]').length === 1")
        pe = await pg.evaluate("({ pens: document.getElementById('wRinkPens').textContent, pim: [...document.querySelectorAll('#wRinkBox th')].some(x => x.textContent === 'PIM'), row: [...document.querySelectorAll('#wRinkBox tr')].some(r => r.children.length > 8 && r.children[0].textContent.includes(wHK.G.pens[0].who) && r.children[8].textContent === '2') })")
        check('hooking' in pe['pens'] and pe['pim'] and pe['row'], 'a penalty is listed under the rink, and its two minutes are in the box score', pe)
        await pg.evaluate("showPage('help')"); hp2 = await pg.evaluate("document.getElementById('wRinkHow').textContent"); await pg.evaluate("showPage('play')")
        check('Penalties.' in hp2 and 'delayed penalty' in hp2 and 'Pulling the goalie' in hp2 and 'shootout' in hp2, 'How to play explains penalties, the delayed penalty, pulling the goalie and the shootout', None)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
