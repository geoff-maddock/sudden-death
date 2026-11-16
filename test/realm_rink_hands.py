# Realm rink by hand (issue #83, phase 2). You play Rimewatch: with the puck whoever has it, without it the skater
# nearest the puck (E switches); the goalie is never yours. Steering skates them and letting go glides; while you're at
# the keys the CPU keeps its hands off, and after a couple of idle seconds it plays on. Space: a tap is a wrist shot, a
# hold winds up a slap shot that gets harder, and one held too long goes on its own. The way you steer picks the target,
# and the goalie's place decides what it's worth (the post they left is open). Space while a pass is coming is a
# one-timer when it's timed, a fan when it's early. J passes toward where you steer, and held sends it hard. Without the
# puck J pokes (up close only, with a rest between), Space lunges into a check, Shift lifts your stick into the lane.
# At a face-off a press close to the drop wins more than none, and none more than a jump. The camera pushes in on the
# end the puck is in, holds while paused, and is not in the game's state. On the page: Watch and You play on the bar,
# the keys, and a pad under the rink whose labels follow the puck. Asserts; exits nonzero on failure.
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

# side 0 is yours: 0 C, 1 LW, 2 RW, 3 LD, 4 RD, 5 G; side 1: 6 to 11. In the first period you attack the right-hand goal.
SETUP = """window.__play = (seed, mode) => { wHK.start({ seed, mode: mode || 'play' }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
  const P = wHK.play; for (const p of P.pl) { p.vx = p.vy = 0; p.stun = 0; p.cd = 0; } return P; };
window.__away = (P, keep) => { P.pl.forEach((p, i) => { if (!keep.includes(i)) { p.x = 2.5; p.y = -8.5 + (i % 6) * .2; p.vx = p.vy = 0; } }); };
window.__put = (P, i, x, y) => { const p = P.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; p.stun = 0; p.cd = 0; p.act = ''; return p; };
window.__since = (P, n0) => P.evN > n0 ? P.ev.slice(-(P.evN - n0)) : [];
window.__clear = P => { wHK.input({ steer: [0, 0], shoot: false, pass: false, lift: false }); P.pokeAt = null; P.hitAt = null; P.lunge = null; }; 0"""

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

        # ---------- who you play ----------
        m = await pg.evaluate("""(() => { const P = __play(5); const mode = wHK.mode; __away(P, [1, 2, 6]);
          __put(P, 1, 20, 0); __put(P, 2, 20, 6); __put(P, 6, 26, 0); wHK.give(1); const withPuck = [wHK.me, wHK.puckMine];
          wHK.give(6); P.me = null; const without = [wHK.me, wHK.puckMine]; const sw = wHK.input({ act: 'switch' }); const after = wHK.me;
          wHK.give(5); const goalie = [wHK.me !== 5, wHK.puckMine];
          wHK.setMode('watch'); const off = [wHK.input({ steer: [1, 0] }), wHK.me, wHK.inputState.steer]; wHK.setMode('play');
          return { mode, withPuck, without, sw, after, goalie, off, back: wHK.mode }; })()""")
        check(m['mode'] == 'play' and m['withPuck'] == [1, True] and m['without'] == [1, False], 'with the puck you play whoever has it; without it, your skater nearest the puck', m)
        check(m['sw'] == 'switch' and m['after'] == 2 and m['goalie'] == [True, False], 'E switches to your next nearest skater; the goalie is never yours', m)
        check(m['off'] == ['', -1, [0, 0]] and m['back'] == 'play', 'in Watch the keys do nothing', m)

        # ---------- skating by hand, and the CPU's hands off ----------
        s = await pg.evaluate("""(() => { const P = __play(5); __away(P, [1]); const p = __put(P, 1, 12, 0); wHK.give(1); const n0 = P.evN;
          wHK.input({ steer: [1, 0] }); wHK.step(30); const pushed = { x: p.x, vx: p.vx, mine: wHK.puckMine };
          wHK.input({ steer: [0, 0] }); wHK.step(10); const glide = { vx: p.vx, x: p.x, mine: wHK.puckMine, carry: P.carry };
          wHK.step(20); const held = { mine: wHK.puckMine, ev: __since(P, n0).filter(e => ['pass', 'shot', 'dump', 'wind'].includes(e.k)).length };
          let acted = false; for (let t = 0; t < 150 && !acted; t++) { wHK.step(); acted = !!P.carry || P.puck.st !== 'held' || !!P.wind; }
          return { pushed, glide, held, acted }; })()""")
        check(s['pushed']['x'] > 14 and s['pushed']['vx'] > 3 and s['pushed']['mine'], 'steering skates your player the way you push', s)
        check(s['glide']['vx'] > s['pushed']['vx'] * .7 and s['glide']['x'] > s['pushed']['x'] + 1 and s['glide']['carry'] is None, 'let go and they glide on', s)
        check(s['held']['mine'] and s['held']['ev'] == 0 and s['acted'], 'while you are at the keys the CPU keeps its hands off your skater; idle for a couple of seconds and it plays on', s)

        # ---------- the shot by hand ----------
        sh = await pg.evaluate("""(() => { const P = __play(5), gx = wHK.goalX(0), H = wHK.hands; const set = () => { __clear(P); __away(P, [2, 11]); __put(P, 2, gx - 7, 0); wHK.give(2); };
          const v = () => Math.hypot(P.puck.vx, P.puck.vy);
          set(); const d1 = wHK.input({ shoot: true }); wHK.step(3); const m1 = wHK.meter, act1 = P.pl[2].act; const u1 = wHK.input({ shoot: false }); const wrist = { d1, u1, kind: wHK.shot().kind, rel: wHK.release, v: v(), m: m1 && m1.kind, act1 };
          set(); wHK.input({ shoot: true }); wHK.step(9); const m2 = wHK.meter; const u2 = wHK.input({ shoot: false }); const half = { u2, kind: wHK.shot().kind, pow: wHK.release.pow, v: v(), m: m2 };
          set(); wHK.input({ shoot: true }); wHK.step(18); const u3 = wHK.input({ shoot: false }); const full = { u3, pow: wHK.release.pow, v: v() };
          set(); wHK.input({ shoot: true }); let n = 0; while (wHK.meter && n++ < 60) wHK.step(); const late = { steps: n, shot: !!wHK.release && wHK.release.kind, meter: wHK.meter, held: P.puck.st };
          wHK.input({ shoot: false });
          return { wrist, half, full, late, lateAt: H.late, power: [wHK.power(.1), wHK.power(.25), wHK.power(.5), wHK.power(2)] }; })()""")
        check(sh['wrist']['d1'] == 'wind' and sh['wrist']['u1'] == 'wrist' and sh['wrist']['kind'] == 'wrist' and sh['wrist']['m'] == 'wrist' and sh['wrist']['act1'] == 'wind' and abs(sh['wrist']['v'] - 24) < .5, 'a tap of Space is a wrist shot', sh)
        check(sh['half']['u2'] == 'slap' and sh['half']['kind'] == 'slap' and .5 < sh['half']['pow'] < .7 and sh['full']['pow'] == 1 and sh['wrist']['v'] < sh['half']['v'] < sh['full']['v'] and abs(sh['full']['v'] - 32) < .5,
              'held, it winds up a slap shot: the longer the wind-up, the harder the shot', sh)
        check(sh['late']['shot'] == 'slap' and sh['late']['meter'] is None and sh['late']['held'] == 'free' and abs(sh['late']['steps'] / 30 - sh['lateAt']) < .1, 'held too long, it goes on its own', sh)
        check(sh['power'] == [.35, .5, 1, 1], 'a short wind-up is a soft slap shot, a full one the whole thing', sh)
        # aiming
        a = await pg.evaluate("""(() => { const P = __play(5), g = P.pl[11], gx = wHK.goalX(0); __clear(P); __away(P, [2, 11]); __put(P, 2, gx - 7, 0);
          const sp = wHK.goalSpot(1, gx - 7, 0); g.x = sp[0]; g.y = 0; g.vx = g.vy = 0;
          const T = { up: { y: -1, hi: false }, down: { y: 1, hi: false }, upHi: { y: -1, hi: true } };
          const centred = { up: wHK.aimFx(1, T.up), down: wHK.aimFx(1, T.down), upHi: wHK.aimFx(1, T.upHi), five: wHK.aimFx(1, 'five'), none: wHK.aimFx(1, null) };
          const mean = (centred.five.f + 2 * centred.up.f + 2 * centred.upHi.f) / 5;
          g.y = -1; const shifted = { near: wHK.aimFx(1, T.up).f, far: wHK.aimFx(1, T.down).f }; g.y = 0; g.vy = 3; const sliding = wHK.aimFx(1, 'five').f; g.vy = 0;
          wHK.input({ steer: [0, -1] }); const t1 = wHK.aimTarget(1); wHK.input({ steer: [1, 1] }); const t2 = wHK.aimTarget(1), t2b = wHK.aimTarget(-1); wHK.input({ steer: [1, 0] }); const t3 = wHK.aimTarget(1);
          wHK.input({ steer: [0, 1] }); wHK.input({ steer: [0, 0] }); const t4 = wHK.aimTarget(1); wHK.step(20); const t5 = wHK.aimTarget(1);
          __put(P, 2, gx - 7, 0); wHK.give(2); wHK.input({ steer: [0, 1] }); wHK.input({ shoot: true }); wHK.step(2); wHK.input({ shoot: false }); const S = wHK.shot();
          return { centred, mean, shifted, sliding, t1, t2, t2b, t3, t4, t5, aim: S.aim, res: S.res, vy: P.puck.vy }; })()""")
        c = a['centred']
        check(c['none'] == {'f': 1, 'miss': 0} and abs(c['up']['f'] - c['down']['f']) < 1e-9 and c['upHi']['f'] > c['up']['f'] and c['upHi']['miss'] > c['up']['miss'] and .9 < a['mean'] < 1.1,
              'against a goalie set in the middle the two posts are worth the same, the top corners score more and miss more, and aiming at random is worth about what the CPU\'s plain roll is', a)
        check(a['shifted']['far'] > a['shifted']['near'] * 2 and a['sliding'] > c['five']['f'] + .5, 'the post the goalie has left is open and the one they stand at is shut; between the pads is good on a goalie sliding across', a)
        check(a['t1'] == {'y': -1, 'hi': False} and a['t2'] == {'y': 1, 'hi': True} and a['t2b'] == {'y': 1, 'hi': False} and a['t3'] == 'five' and a['t4'] == {'y': 1, 'hi': False} and a['t5'] == 'five',
              'the target is the post you steer toward, the top corner with the way to the goal held as well, and between the pads with nothing held (a steer just let go still counts)', a)
        check(a['aim'] == {'y': 1, 'hi': False} and (a['res'] not in ('goal', 'miss') or a['vy'] > 0), 'a shot let go while steering down the screen goes for that post', a)

        # ---------- the one-timer ----------
        o = await pg.evaluate("""(() => { const P = __play(5), gx = wHK.goalX(0), H = wHK.hands;
          const go = how => { __clear(P); __away(P, [0, 2, 11]); __put(P, 0, gx - 9, -6); const b = __put(P, 2, gx - 6, 5); wHK.give(0); wHK.passTo(2);
            let pressed = how === 'early' ? wHK.input({ shoot: true }) : '', n = 0;
            while (P.puck.st === 'free' && P.puck.k === 'pass' && n++ < 80) { if (how === 'timed' && !pressed && Math.hypot(P.puck.x - b.x, P.puck.y - b.y) < 3) pressed = wHK.input({ shoot: true }); wHK.step(); }
            const out = { pressed, shot: wHK.shot() && wHK.shot().kind, rel: P.puck.k === 'shot' ? wHK.release.kind : null, st: P.puck.st, holder: P.puck.h, msg: wHK.msg }; wHK.input({ shoot: false }); return out; };
          return { timed: go('timed'), early: go('early'), none: go('none'), oneT: H.oneT }; })()""")
        check(o['timed']['pressed'] == 'ready' and o['timed']['shot'] == 'one' and o['timed']['rel'] == 'one', 'Space pressed just before a pass arrives shoots it as it lands: a one-timer', o)
        check(o['early']['rel'] == 'fan' and o['early']['shot'] == 'wrist' and 'fans' in o['early']['msg'], 'pressed too early, you fan on it', o)
        check(o['none']['st'] == 'held' and o['none']['holder'] == 2 and o['none']['shot'] is None, 'not pressed, the pass is just caught', o)

        # ---------- the pass ----------
        ps = await pg.evaluate("""(() => { const P = __play(5); const set = () => { __clear(P); __away(P, [0, 1, 2]); __put(P, 0, 20, 0); __put(P, 1, 22, -6); __put(P, 2, 22, 6); wHK.give(0); };
          set(); wHK.input({ steer: [0, 1] }); wHK.input({ pass: true }); const r1 = wHK.input({ pass: false }); const down = { r1, to: P.puck.to, k: P.puck.k };
          set(); wHK.input({ steer: [0, -1] }); wHK.input({ pass: true }); const r2 = wHK.input({ pass: false }); const up = { r2, to: P.puck.to };
          set(); wHK.input({ steer: [1, 0] }); wHK.input({ pass: true }); wHK.step(10); const r3 = wHK.input({ pass: false }); const hard = { r3, k: P.puck.k, to: P.puck.to, vx: P.puck.vx, vy: P.puck.vy };
          return { down, up, hard }; })()""")
        check(ps['down'] == {'r1': 'pass', 'to': 2, 'k': 'pass'} and ps['up'] == {'r2': 'pass', 'to': 1}, 'a tap of J passes to the teammate you are steering toward', ps)
        check(ps['hard']['r3'] == 'dump' and ps['hard']['k'] == 'dump' and ps['hard']['to'] == -1 and ps['hard']['vx'] > 15 and abs(ps['hard']['vy']) < 1, 'held, J sends the puck hard the way you steer', ps)

        # ---------- without the puck: the poke, the check, the lift ----------
        d = await pg.evaluate("""(() => { const P = __play(9); let pokes = 0, misses = 0, again = '', far = ''; const fouls = wHK.fouls; wHK.setFouls({ trip: 0, hook: 0, board: 0, rough: 0, interfere: 0 }); P.pl[1].r.def = 7; P.pl[1].r.siz = 6; P.pl[6].r.hnd = 6; P.pl[6].r.siz = 5;
          for (let t = 0; t < 60; t++) { __clear(P); __away(P, [1, 6]); __put(P, 6, 20, 0); __put(P, 1, 20.9, 0); wHK.give(6); P.me = 1; const r = wHK.input({ pass: true }); if (t === 0) again = wHK.input({ pass: false }) + wHK.input({ pass: true }); wHK.input({ pass: false }); if (r === 'poke') pokes++; else if (r === 'miss') misses++; }
          __clear(P); __put(P, 6, 20, 0); __put(P, 1, 23.5, 0); wHK.give(6); P.me = 1; far = wHK.input({ pass: true }); wHK.input({ pass: false });
          let hits = 0, lunged = 0, v0 = 0;
          for (let t = 0; t < 40; t++) { __clear(P); __away(P, [1, 6]); const c = __put(P, 6, 20, 0), me = __put(P, 1, 22.2, 0); wHK.give(6); P.me = 1; const n0 = P.evN;
            const r = wHK.input({ shoot: true }); wHK.input({ shoot: false }); if (r === 'check') lunged++; if (t === 0) v0 = me.vx;
            let n = 0; while (P.lunge && n++ < 20) wHK.step(); if (__since(P, n0).some(e => e.k === 'hit' && e.s === me.n)) hits++; }
          __clear(P); __away(P, [1, 6]); __put(P, 6, 14, 0); const me = __put(P, 1, 24, 0); wHK.give(6); P.me = 1; const n1 = P.evN; wHK.input({ shoot: true }); wHK.input({ shoot: false }); let n = 0; while (P.lunge && n++ < 20) wHK.step();
          const long = { hit: __since(P, n1).some(e => e.k === 'hit'), stun: me.stun > 0 };
          const lane = lift => { let got = 0; for (let t = 0; t < 40; t++) { __clear(P); __away(P, [1, 6, 7]); __put(P, 6, 15, 0); __put(P, 7, 25, 0); __put(P, 1, 20, 1.1); wHK.give(6); P.me = 1; wHK.passTo(7); wHK.input(lift ? { lift: true } : { steer: [0, 0] });
            let n = 0; while (P.puck.st === 'free' && P.puck.k === 'pass' && n++ < 40) wHK.step(); if (P.puck.st === 'held' && P.puck.h === 1) got++; } wHK.input({ lift: false }); return got; };
          const out = { pokes, misses, again, far, hits, lunged, v0, long, plain: lane(false), lifted: lane(true) }; wHK.setFouls(fouls); return out; })()""")
        check(6 <= d['pokes'] <= 45 and d['pokes'] + d['misses'] == 60 and d['again'] == '' and d['far'] == 'miss', 'J pokes at the puck: up close it comes off sometimes, from too far never, and there is a rest between pokes', d)
        check(d['lunged'] == 40 and d['v0'] < -5 and d['hits'] >= 8 and not d['long']['hit'] and d['long']['stun'], 'Space lunges at the carrier: reach them and it is a hit; from too far you miss, and are out of the play for a moment', d)
        check(d['plain'] == 0 and d['lifted'] >= 8, 'Shift held lifts your stick into the lane: passes going by just out of reach are picked off', d)

        # ---------- the face-off ----------
        f = await pg.evaluate("""(() => { const run = how => { let wins = 0, edge = 0; for (let s = 1; s <= 40; s++) { wHK.start({ seed: 500 + s, mode: 'play' }); let n = 0; while (wHK.phase !== 'drop' && n++ < 400) wHK.step();
            let r = ''; if (how === 'jump') r = wHK.input({ shoot: true }); if (how === 'good') { wHK.step(12); r = wHK.input({ shoot: true }); }
            n = 0; while (wHK.phase === 'drop' && n++ < 40) wHK.step(); wHK.input({ shoot: false }); const D = wHK.drew; edge = D.edge; if (D.win === 0) wins++; }
            return { wins, edge }; };
          return { good: run('good'), none: run('none'), jump: run('jump') }; })()""")
        check(.18 < f['good']['edge'] <= .3 and f['none']['edge'] == 0 and f['jump']['edge'] == -.15 and f['good']['wins'] > f['none']['wins'] > f['jump']['wins'],
              'at a face-off a press close to the drop wins more than no press, and no press more than a jump', f)

        # ---------- the Realm: the bar, the keys, the pad, the camera ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false"); await pg.evaluate(SETUP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wRinkGame({ seed: 7 })")
        await pg.wait_for_function("UI.view === 'rink' && wHK.phase === 'live' && !document.getElementById('wRinkPad').hidden")
        b = await pg.evaluate("({ modes: [...document.querySelectorAll('#wRinkModes button')].map(x => x.textContent), on: [...document.querySelectorAll('#wRinkModes button.on')].map(x => x.textContent), mode: wHK.mode, note: document.getElementById('wRinkNote').textContent })")
        check(b['modes'] == ['Watch', 'Manage', 'You play'] and b['on'] == ['You play'] and b['mode'] == 'play' and 'WASD' in b['note'], 'the bar has Watch, Manage and You play, You play to begin with, and the status line has the keys', b)
        await pg.evaluate("wHK.pause(true)")
        await pg.keyboard.down('d'); k1 = await pg.evaluate("wHK.inputState.steer"); await pg.keyboard.down('w'); k2 = await pg.evaluate("wHK.inputState.steer")
        await pg.keyboard.up('d'); await pg.keyboard.up('w'); k3 = await pg.evaluate("wHK.inputState.steer")
        await pg.keyboard.down('Shift'); k4 = await pg.evaluate("wHK.inputState.lift"); await pg.keyboard.up('Shift'); k5 = await pg.evaluate("wHK.inputState.lift")
        check(k1 == [1, 0] and k2 == [1, -1] and k3 == [0, 0] and k4 is True and k5 is False, 'the keys steer (WASD) and lift (Shift), and letting go is heard', [k1, k2, k3, k4, k5])
        # the pad follows the puck, and a held button is let go when it changes
        pad = await pg.evaluate("""(async () => { const P = wHK.play, tick = () => new Promise(r => setTimeout(r, 200)); wHK.give(6); P.me = 1; await tick();
          const none = [...document.querySelectorAll('#wRinkPad button')].map(x => x.textContent); wHK.give(1); await tick();
          const puck = [...document.querySelectorAll('#wRinkPad button')].map(x => x.textContent), keys = [...document.querySelectorAll('#wRinkPad button')].map(x => x.dataset.key);
          const sb = document.querySelector('#wRinkPad [data-kpad="shoot"]'); sb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })); const down = !!wHK.meter;
          sb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); const up = { meter: wHK.meter, shot: !!wHK.shot() };
          wHK.give(1); document.querySelector('#wRinkPad [data-kpad="shoot"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 })); const held = !!wHK.meter; wHK.give(6); await tick();
          return { none, puck, keys, down, up, held, after: { meter: wHK.meter, shoot: wHK.inputState.shoot, labels: [...document.querySelectorAll('#wRinkPad button')].map(x => x.textContent) } }; })()""")
        check(pad['none'] == ['Check', 'Poke', 'Lift stick', 'Switch', 'Change', 'Goalie'] and pad['puck'] == ['Shoot', 'Pass', 'Change', 'Goalie'] and pad['keys'] == ['Space', 'J', 'C', 'G'], 'the pad under the rink follows the puck: Shoot and Pass with it, Check, Poke, Lift stick and Switch without, Change and Goalie either way, each with its key', pad)
        check(pad['down'] and pad['up'] == {'meter': None, 'shot': True} and pad['held'] and pad['after']['meter'] is None and pad['after']['shoot'] is False and pad['after']['labels'][0] == 'Check',
              'the pad\'s Shoot winds up while held and shoots when let go; a button held when the puck changes hands is let go', pad)
        await pg.click('#wRinkModes [data-kmode="watch"]')
        w = await pg.evaluate("({ mode: wHK.mode, pad: document.getElementById('wRinkPad').hidden, on: [...document.querySelectorAll('#wRinkModes button.on')].map(x => x.textContent) })")
        await pg.keyboard.down('d'); w['steer'] = await pg.evaluate("wHK.inputState.steer"); await pg.keyboard.up('d')
        check(w == {'mode': 'watch', 'pad': True, 'on': ['Watch'], 'steer': [0, 0]}, 'Watch on the bar hands both sides to the CPU: the pad goes, and the keys do nothing', w)
        await pg.evaluate("showPage('help')"); hp = await pg.evaluate("document.getElementById('wRinkHow').textContent"); await pg.evaluate("showPage('play')")
        check('Playing it by hand' in hp and 'Aiming' in hp and 'one-timer by hand' in hp and 'face-off by hand' in hp, 'How to play explains playing by hand, aiming, the one-timer and the face-off', None)
        # the camera
        await pg.evaluate("wRinkGame({ seed: 4, mode: 'watch' })")
        await pg.wait_for_function("wHK.phase === 'intro' || wHK.phase === 'drop'")
        c0 = await pg.evaluate("({ cam: wHK.cam(), o: wHK.scr(0, -10), far: wHK.scr(40, 10) })")
        check(c0['cam']['u'] == 0 and c0['cam']['k'] == 1 and c0['o'] == {'x': 60, 'y': 168} and c0['far'] == {'x': 900, 'y': 488}, 'the game opens on the whole sheet', c0)
        await pg.evaluate("wHK.speed = 3")
        LOOK = "(() => { const P = wHK.play.puck, cam = wHK.cam(), s = wHK.scr(P.x, P.y); return { cam, far: Math.round((cam.end ? 40 - P.x : P.x) * 10) / 10, s, state: JSON.stringify(wHK.G).includes('\"cam\"') }; })()"
        seen = []
        for end in (0, 1):
            h = await pg.wait_for_function(f"wHK.cam().u === 1 && wHK.cam().end === {end} && wHK.phase === 'live' && {LOOK}", timeout=180000)
            v = await h.json_value(); seen.append(v)
            check(abs(v['cam']['k'] - 1.32) < 1e-6 and 0 <= v['far'] <= 16.5 and 0 <= v['s']['x'] <= 960 and 64 <= v['s']['y'] <= 600, f'the camera pushes in on the end the puck is in, and the puck is in the picture (end {end})', v)
            await pg.evaluate("wHK.pause(true)"); u0 = await pg.evaluate("JSON.stringify(wHK.cam())")
            await pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))")
            u1 = await pg.evaluate("JSON.stringify(wHK.cam())"); await pg.evaluate("wHK.pause(false)")
            check(u0 == u1, f'paused, the picture holds (end {end})', [u0, u1])
            await pg.wait_for_function("wHK.cam().u === 0", timeout=180000)
            z = await pg.evaluate("({ o: wHK.scr(0, -10), k: wHK.cam().k })")
            check(z['o'] == {'x': 60, 'y': 168} and z['k'] == 1, f'and pulls back to the whole sheet when the play leaves (end {end})', z)
        check(not any(v['state'] for v in seen), 'the camera is not in the game\'s state', None)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
