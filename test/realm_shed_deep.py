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
        l = await pg.evaluate("""(() => { const R = wCR.sheet.stoneR, H = wCR.sheet.halfW; wCR.start({ seed: 9, deep: true, hammer: 1 }); const G = wCR.G, d = G.deep;
          // his next spot by the boards: a stone against them, 12 inches off it (a push either way would take it off the
          // sheet); and a stone 6 inches off it with another touching it on the far side (a push either way runs into it)
          d.nx = H - 18; d.ny = -20; const A = { id: '1:7', s: 1, x: H - R - .2, y: -20 }, B = { id: '1:8', s: 1, x: H - 24, y: -20 }, C = { id: '0:9', s: 0, x: H - 24 - 2 * R - .05, y: -20 };
          G.stones.push(Object.assign({}, A), Object.assign({}, B), Object.assign({}, C));
          const s = wCR.up(); wCR.throwStone(s, { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: 0, v: 60, h: 1 }, null);
          const at = id => G.stones.find(o => o.id === id), still = (o, w) => !!o && o.x === w.x && o.y === w.y;
          const on = G.stones.every(o => wCR.onSheet(o)), n = G.stones.length, ov = G.stones.some((p, i) => G.stones.some((q, j) => j > i && Math.hypot(p.x - q.x, p.y - q.y) < 2 * R - 1e-3));
          return { on, n, overlap: ov, boards: still(at('1:7'), A), blocked: still(at('1:8'), B) }; })()""")
        check(l == {'on': True, 'n': 3, 'overlap': False, 'boards': True, 'blocked': True}, 'a bump never puts a stone off the sheet or into another: a stone at the boards, or with one behind it, tries half and is left be', l)
        fg = await pg.evaluate("""(() => { wCR.start({ seed: 6, deep: true, hammer: 1 }); const G = wCR.G, d = G.deep, s = wCR.up();
          // their guard in the free guard zone, peeled by the first stone: the rules put it back and take the stone off
          d.x = -50; d.y = -10; d.nx = -50; d.ny = 30; const W = { id: `${1 - s}:5`, s: 1 - s, x: -46, y: 30 };
          G.stones.push({ id: `${1 - s}:6`, s: 1 - s, x: 0, y: -150 }, Object.assign({}, W)); const was = JSON.stringify(G.deep);
          const ev = wCR.throwStone(s, { shot: 'peel', x: 0, y: -150, h: 1 }, { ang: 0, v: 220, h: 0 }, null);
          const w = G.stones.find(o => o.id === W.id);
          return { fgz: !!(ev && ev.rule && ev.rule.fgz), stays: JSON.stringify(G.deep) === was, ring: !!w && w.x === W.x && w.y === W.y }; })()""")
        check(fg == {'fgz': True, 'stays': True, 'ring': True}, 'a stone the free guard zone takes off: Old Grey neither swims nor bumps (his ring still says where he goes next)', fg)
        gr = await pg.evaluate("""(() => { wCR.start({ seed: 5, deep: true, hammer: 1 }); const G = wCR.G, d = G.deep; const W = { id: '1:9', s: 1, x: d.nx + (d.nx > 0 ? -5 : 5), y: d.ny, g: 1 };
          G.stones.push(Object.assign({}, W)); const s = wCR.up(); wCR.throwStone(s, { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: 0, v: 60, h: 1 }, null);
          const w = G.stones.find(o => o.id === '1:9'); return !!w && w.x === W.x && w.y === W.y; })()""")
        check(gr, 'a Granite Stone at rest is not moved by Old Grey (the power says it won\'t be)', gr)
        tr = await pg.evaluate("""(() => { const out = {}; for (const sk of [1, 2]) { wCR.start({ seed: 5, deep: true, hammer: 1, skill: [sk, sk] }); const G = wCR.G, d = G.deep;
            G.stones.push({ id: '1:9', s: 1, x: d.nx + (d.nx > 0 ? -5 : 5), y: d.ny }); const st = wCR.deepTry(wCR.up(), { ang: 0, v: 60, h: 1 }).find(o => o.id === '1:9');
            out[sk] = st.x !== G.stones.find(o => o.id === '1:9').x; } return out; })()""")
        check(tr == {'1': False, '2': True}, "a skip's trial run bumps the stones as Old Grey will for an Archmage, not for a Knight", tr)
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

        # ---- the page ----
        pgm = await pg.evaluate("""(() => { wCR.start({ seed: 21, deep: true, ends: 2, mode: 'watch', fixShot: ['guard', 'guard'] }); const G = wCR.G, d = G.deep; let open = '', n = 0;
          // (a stone of theirs where he swims next; the first stone held to a guard, so it isn't taken out first)
          G.stones.push({ id: '1:9', s: 1, x: d.nx + (d.nx > 0 ? -4 : 4), y: d.ny });
          while (G.n < 1 && n++ < 20000) { wCR.tick(.05); if (!open && wCR.msg) open = wCR.msg; }
          return { open: open.startsWith("Old Grey's under the ice today"), said: /Old Grey turns under the ice and nudges/.test(wCR.msg) }; })()""")
        check(pgm == {'open': True, 'said': True}, "the page opens on Hennock's word about Old Grey, and says when he nudges a stone", pgm)

        # ---- the Realm ----
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); SET.shedEnds = 4; })()")
        rl = await pg.evaluate("""(() => { const mr = Math.random, out = {};
          const go = (roll, o) => { Math.random = () => roll; try { wShg().met = {}; const r = wStartShed(Object.assign({ club: 'local', how: 'play' }, o || {})); wCR.pause(true); return { r, deep: !!(wCR.G && wCR.G.deep) }; } finally { Math.random = mr; } };
          const off = () => { if (wShedLive()) wShedCallOff('Called off for the test.'); };
          out.club = go(0); out.clubMsg = !!wCR.G.deepSaid; off();
          out.noRoll = go(.99); off();
          out.cup = go(0, { cup: true, kind: 'crcup', ref: { week: 0, round: 0 } }); off();
          out.fix = go(0, { cup: true, kind: 'crfix', ref: { g: 'g_shed', club: 'local', day: 0 } }); off();
          Math.random = () => 0; try { wShedGame({}); out.exh = !!wCR.G.deep; } finally { Math.random = mr; }
          // Simulate: the engine's sim game is asked for the deep
          const sg = wCR.simGame; let seen = null; wCR.simGame = o => { const r = sg(o); seen = r.deep; return r; };
          Math.random = () => 0; try { wShg().met = {}; wStartShed({ club: 'local', how: 'sim' }); } finally { Math.random = mr; wCR.simGame = sg; }
          for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) document.querySelector('#modalBox .btn, #modalBox button').click();
          out.sim = !!seen && typeof seen.bumps === 'number';
          return out; })()""")
        check(rl['club'] == {'r': '', 'deep': True} and rl['clubMsg'], 'a wild club match can have Old Grey (one in three: the roll under W_DEEP.p), with Hennock\'s word', rl)
        check(rl['noRoll'] == {'r': '', 'deep': False}, 'a club match whose roll misses has no deep', rl)
        check(not rl['cup']['deep'] and not rl['fix']['deep'] and not rl['exh'], 'never in the Brass Broom, a league fixture or the exhibition, however the roll falls', rl)
        check(rl['sim'], 'Simulate plays him too: the sim game has the deep', rl)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpShedDeep'), all = document.getElementById('pg-help'); return { pointer: !!h && /Old Grey/.test(h.textContent) && /club match/.test(h.textContent) && /how it works/i.test(h.textContent) && h.textContent.length < 240, once: (all.textContent.match(/nudges any stone lying there/g) || []).length }; })()")
        check(hp == {'pointer': True, 'once': 1}, 'How to play names Old Grey in a line (club matches only) and explains him once, in Curling: how it works', hp)
        # (a frame of the Shed with him under the ice: nothing thrown, and a picture to look at)
        await pg.evaluate("showPage('play')")
        await pg.evaluate("(() => { wShedGame({ seed: 31, deep: true, ends: 2, mode: 'watch' }); wCR.pause(true); const G = wCR.G; G.stones.push({ id: '0:8', s: 0, x: 10, y: -10 }, { id: '1:8', s: 1, x: -30, y: 20 }); showView('shed'); })()")
        await pg.wait_for_timeout(400)
        await pg.screenshot(path='/tmp/shed-deep.png')

        if errs: check(False, 'no page errors', errs[:5])
        await br.close()
    print('FAILED: ' + '; '.join(FAILS) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
