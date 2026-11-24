# Realm shed: the frozen deep (issue #108). Old Grey, a great pike under the Curling Shed's ice, in about one wild match
# in three: the ice over him runs keen (a stone slides further and curls less), and after every stone he swims to his
# next spot (always shown) and bumps what lies there, never off the sheet or into another stone. A Squire doesn't see
# him, a Knight reads the keen ice, an Archmage and the Lich the bumps too. Off, a game is the same game as before.
# The Realm: on only in wild club matches (never a cup, a fixture, the exhibition or the Umbral), Simulate too; the
# opening line, the bump in the status line and How to play name him. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

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
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")

        # ---- the engine ----
        a = await pg.evaluate("""(() => { const D = wCR.deepRules, B = D.box, inBox = d => Math.abs(d.x) <= B.x + 1e-6 && d.y >= B.y0 - 1e-6 && d.y <= B.y1 + 1e-6;
          wCR.start({ seed: 7 }); const off = wCR.deep;
          wCR.start({ seed: 7, deep: true }); const d = wCR.deep;
          return { off, has: !!d && ['x', 'y', 'nx', 'ny', 'hd'].every(k => typeof d[k] === 'number'), here: !!d && inBox(d), next: !!d && inBox({ x: d.nx, y: d.ny }),
            step: !!d && Math.hypot(d.nx - d.x, d.ny - d.y) <= D.step + 1 }; })()""")
        check(a == {'off': None, 'has': True, 'here': True, 'next': True, 'step': True}, 'start({ deep: true }) puts Old Grey in his box (far hog line to back line) with his next spot a swim away; without it, none', a)
        s = await pg.evaluate("""(() => { const k = r => JSON.stringify({ b: r.board, t: r.tot, st: r.st });
          const one = k(wCR.simGame({ seed: 11, ends: 4 })), two = k(wCR.simGame({ seed: 11, ends: 4, deep: false })), on = wCR.simGame({ seed: 11, ends: 4, deep: true });
          const off = wCR.simGame({ seed: 11, ends: 4 });
          return { same: one === two, offNull: off.deep === null, on: !!on.deep && typeof on.deep.bumps === 'number' && typeof on.deep.swings === 'number' && on.deep.swings <= on.deep.bumps }; })()""")
        check(s == {'same': True, 'offNull': True, 'on': True}, 'off, the same seed plays the same game; a summary carries the deep (bumps, swings) only when it is on', s)
        k = await pg.evaluate("""(() => { const D = wCR.deepRules; wCR.start({ seed: 3, deep: true }); const d = wCR.deep, G = wCR.G;
          const mid = wCR.deepMu(d.x, d.y), far = wCR.deepMu(d.x + D.reach + 10 > 90 ? d.x - D.reach - 10 : d.x + D.reach + 10, d.y);
          // a lone stone sent the same way, over him and with him gone
          const aim = wCR.solveDraw(d.x, d.y, 1, null, 'mid'); const th = { id: 'x', s: 0, x0: 0, ang: aim.ang, v: aim.v, h: 1 };
          const over = wCR.run([], th, { ice: G.ice, cold: 'mid' }).last; const keep = G.deep; G.deep = null; const gone = wCR.run([], th, { ice: G.ice, cold: 'mid' }).last; G.deep = keep;
          return { mid: +mid.toFixed(4), want: +(1 - D.keen).toFixed(4), far, further: over.y > gone.y + 1 }; })()""")
        check(k['mid'] == k['want'] and k['far'] == 1 and k['further'], 'the ice over Old Grey is keen (1 - keen where he lies, plain past his reach), and a stone over him slides further', k)
        b = await pg.evaluate("""(() => { const D = wCR.deepRules; wCR.start({ seed: 5, deep: true, hammer: 1 }); const G = wCR.G, d = G.deep, nx = d.nx, ny = d.ny;
          const sx = nx + (nx > 0 ? -5 : 5); G.stones.push({ id: '1:9', s: 1, x: sx, y: ny });
          const s = wCR.up(); const ev = wCR.throwStone(s, { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: 0, v: 60, h: 1 }, null);
          const st = G.stones.find(o => o.id === '1:9'), moved = st ? Math.hypot(st.x - sx, st.y - ny) : -1, away = st ? Math.hypot(st.x - nx, st.y - ny) > 5 : false;
          return { ok: ev && ev.rule && ev.rule.ok, moved: +moved.toFixed(2), inRange: moved >= D.minBump - .01 && moved <= D.bump + .01, away, at: G.deep.x === nx && G.deep.y === ny, bumps: G.deep.bumps, said: /Old Grey/.test(G.hallSaid || '') }; })()""")
        check(b['ok'] and b['inRange'] and b['away'] and b['at'] and b['bumps'] == 1 and b['said'], 'after a stone, Old Grey swims to his next spot and bumps a stone lying there a few inches straight away from him, and the status line says so', b)
        l = await pg.evaluate("""(() => { const D = wCR.deepRules, R = wCR.sheet.stoneR, H = wCR.sheet.halfW; wCR.start({ seed: 9, deep: true, hammer: 1 }); const G = wCR.G, d = G.deep;
          // put his next spot by the boards, a stone against them, and two touching stones inside his reach
          d.nx = H - 26; d.ny = -20; G.stones.push({ id: '1:7', s: 1, x: H - R - .2, y: -20 }, { id: '1:8', s: 1, x: H - 30, y: -20 - 3 }, { id: '0:9', s: 0, x: H - 30, y: -20 - 3 - 2 * R - .1 });
          const s = wCR.up(); wCR.throwStone(s, { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: 0, v: 60, h: 1 }, null);
          const on = G.stones.every(o => wCR.onSheet(o)), n = G.stones.length, ov = G.stones.some((p, i) => G.stones.some((q, j) => j > i && Math.hypot(p.x - q.x, p.y - q.y) < 2 * R - 1e-3));
          return { on, n, overlap: ov }; })()""")
        check(l == {'on': True, 'n': 3, 'overlap': False}, 'a bump never puts a stone off the sheet or into another (it tries half, then leaves it be)', l)
        r = await pg.evaluate("""(() => { wCR.start({ seed: 4, deep: true }); const before = JSON.stringify(wCR.G.deep), s = wCR.up();
          const ev = wCR.throwStone(1 - s, { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: 0, v: 141, h: 1 }, null);
          return { refused: !!ev && ev.rule && ev.rule.ok === false, same: JSON.stringify(wCR.G.deep) === before }; })()""")
        check(r == {'refused': True, 'same': True}, 'a stone refused by the rules leaves Old Grey where he was', r)
        bx = await pg.evaluate("""(() => { const B = wCR.deepRules.box; let bad = 0, n = 0;
          for (const seed of [1, 2, 3, 4, 5]) { wCR.start({ seed, deep: true, ends: 8 }); while (!wCR.G.over && n < 4000) { const ev = wCR.turn(); if (!ev) break; n++; const d = wCR.G.deep;
            if (!(Math.abs(d.x) <= B.x + 1e-6 && d.y >= B.y0 - 1e-6 && d.y <= B.y1 + 1e-6 && Math.abs(d.nx) <= B.x + 1e-6 && d.ny >= B.y0 - 1e-6 && d.ny <= B.y1 + 1e-6)) bad++; } }
          return { n, bad }; })()""")
        check(bx['n'] >= 300 and bx['bad'] == 0, 'over five eight-end games Old Grey never leaves his box', bx)
        sg = await pg.evaluate("""(() => { wCR.start({ seed: 2, deep: true, skill: [0, 2] }); const a = [wCR.deepSee(0), wCR.deepSee(1)];
          wCR.start({ seed: 2, deep: true, skill: [1, 3] }); return a.concat([wCR.deepSee(0), wCR.deepSee(1)]); })()""")
        check(sg == [0, 2, 1, 2], 'the CPU reads him by skill: a Squire not at all, a Knight the keen ice, an Archmage and the Lich the bumps too', sg)
        sn = await pg.evaluate("""(() => { wCR.start({ seed: 8, deep: true }); for (let i = 0; i < 5; i++) wCR.turn(); const was = JSON.stringify(wCR.G.deep), snap = wCR.snapshot();
          wCR.start({ seed: 1 }); wCR.resume(JSON.parse(JSON.stringify(snap))); const back = JSON.stringify(wCR.G.deep) === was;
          const old = JSON.parse(JSON.stringify(snap)); delete old.G.deep; wCR.resume(old); const none = wCR.G.deep == null; let ok = true; try { wCR.turn(); } catch (e) { ok = String(e); }
          return { back, none, ok }; })()""")
        check(sn == {'back': True, 'none': True, 'ok': True}, 'a match kept and resumed keeps Old Grey where he was; an older save has none and plays on', sn)

        if errs: check(False, 'no page errors', errs[:5])
        await br.close()
    print('FAILED: ' + '; '.join(FAILS) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
