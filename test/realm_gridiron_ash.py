# The Ash Bowl's own ways (issue #115, phase 4: src/gf/parts/20-ash.js, w144-ashbowl.js): ashfall and the heat shimmer.
# Asserts: off, a seeded game plays the same and keeps no state, and on, the same seed plays the same game twice; the ash
# settles in patches on the field that grow through the half and are swept at the half and at a timeout (one a half a
# side; the CPU calls its own from Knight up, a Squire never); a carrier cutting on the ash slows and may stumble, a Knight
# holds his line there instead, and off the ash nothing happens; a loose ball on the ash dies (no return) and a punt that
# comes down on it loses its roll; the heat end switches at the half; a deep pass toward it wobbles and a field goal toward
# it is less likely by the rule, a punt toward it falls short, and away from it nothing changes; a Knight saves its deep
# calls for the other end; the snapshot keeps it all; the Realm plays it in every game (LAB leaves it out unless
# W_GFASH.lab asks), the Timeout button sweeps at your call, the bar names the heat, Clinker Dunn's line and How to play
# explain it. Exits nonzero on failure. Screenshot: /tmp/realm-gridiron-ash.png.
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

TEAMS = """(i) => { const k = wGF.kinds; return [0, 1].map(j => ({ name: 'T' + j, roster: Array.from({ length: 7 }, (_, m) => ({ n: 'P' + j + m, kind: k[(m * 3 + j + i) % k.length] })) })); }"""
# a run play with the back given the ball, running on a slant at (4, 0) from the line, no defender near, one ash patch
# under him (or 30 yards away)
CUT = """(o) => { wGF.snap('run', 'zone', { teams: __teams(1), seed: 3, ash: true, skill: o.skill }); const G = wGF.G, L = wGF.play, A = G.ash, c = L.id.RB, p = L.pl[c];
  L.handed = true; L.carrier = c; Object.assign(L.ball, { st: 'held', h: c }); Object.assign(p, { x: 4, y: 0, vx: 5, vy: 5, slow: 0, stun: 0 });
  for (const d of L.pl) if (d.side === 1) Object.assign(d, { x: 45, y: 20, stun: 99 });
  const ax = G.poss === 0 ? G.ball + 4 : 100 - G.ball - 4; A.patches = [{ x: ax + (o.away ? 30 : 0), y: 0, at: 0, m: 6 }]; A.t = 999;
  const keep = wGF.ashRules.slip; wGF.ashRules.slip = o.slip; try { wGF.step(); } finally { wGF.ashRules.slip = keep; }
  return { slow: +p.slow.toFixed(2), stun: +p.stun.toFixed(2), ev: L.ev.filter(e => e.k === 'ash').map(e => e.o), tally: A.tally }; }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1100})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGF !== 'undefined' && typeof W_GFASH === 'object'")
        await pg.evaluate(f"window.__teams = {TEAMS}; window.__cut = {CUT}; 0")
        R = await pg.evaluate("wGF.ashRules")

        # ---------- off and on ----------
        same = await pg.evaluate("""(() => { LAB = true; const k = g => JSON.stringify([g.score, g.plays, g.ends, g.box.map(b => b.line)]), o = { teams: __teams(2), seed: 41, skill: [1, 2] };
          const a = k(wGF.simGame(o)), b = k(wGF.simGame(Object.assign({ ash: false }, o))), plain = wGF.G.ash === undefined && wGF.ash() === null;
          const c = k(wGF.simGame(Object.assign({ ash: true }, o))), d = k(wGF.simGame(Object.assign({ ash: true }, o)));
          LAB = false; return { off: a === b, plain, again: c === d, differs: c !== a }; })()""")
        check(same == {'off': True, 'plain': True, 'again': True, 'differs': True}, 'off, a seeded game plays the same and keeps no state; on, the same seed plays the same game twice (and not the game without it)', same)
        st = await pg.evaluate("""(() => { wGF.start({ teams: __teams(3), seed: 7, ash: true }); const A = wGF.ash();
          return { n: A.patches.length, inField: A.patches.every(P => P.x >= 0 && P.x <= 100 && Math.abs(P.y) <= 26 && P.m >= wGF.ashRules.m[0] && P.m <= wGF.ashRules.m[1]),
            settle: A.patches.every(P => P.at >= 0 && P.at <= wGF.ashRules.settle * 360), hot: A.hot, to: A.to, facing: A.facing, said: A.said, t: A.t }; })()""")
        check(st['n'] == R['n'] and st['inField'] and st['settle'] and st['hot'] in (0, 1) and st['to'] == [R['to'], R['to']] and st['facing'] == [st['hot'] == 1, st['hot'] == 0]
              and 'Clinker Dunn' in st['said'] and st['t'] == 0, 'start({ ash: true }): the patches to fall this half, on the field, one hot end (one side faces it), a timeout each, Clinker\'s line', st)
        gr = await pg.evaluate("""(() => { const A = wGF.G.ash, P = A.patches[0], r = () => wGF.ash().patches[0].r, at = (x, y) => wGF.ashAt(x, y);
          A.t = Math.max(0, P.at - 1); const before = r(), inBefore = at(P.x, P.y); A.t = P.at; const r0 = r(); A.t = P.at + 40; const r1 = r(); A.t = P.at + 9999; const big = r();
          return { before, inBefore, r0: +r0.toFixed(2), grew: r1 > r0, cap: big === P.m, inside: at(P.x, P.y), edge: at(P.x + P.m * .9, P.y), out: at(P.x + P.m + .5, P.y) }; })()""")
        check(gr['before'] == 0 and not gr['inBefore'] and gr['r0'] == R['r0'] and gr['grew'] and gr['cap'] and gr['inside'] and gr['edge'] and not gr['out'],
              'a patch is nothing before it settles, then starts at r0 yards and grows with play, up to its own size; the ash is where the patch is and nowhere else', gr)

        # ---------- the carrier on the ash ----------
        sq = await pg.evaluate("__cut({ skill: [0, 0], slip: 1 })")
        check(sq['ev'] == ['slip'] and sq['stun'] == R['stun'] and sq['slow'] == R['slow'] and sq['tally']['cut'] == 1 and sq['tally']['slip'] == 1, 'a carrier cutting on the ash slows, and (slip certain here) stumbles', sq)
        sq0 = await pg.evaluate("__cut({ skill: [0, 0], slip: 0 })")
        check(sq0['ev'] == ['cut'] and sq0['stun'] == 0 and sq0['slow'] == R['slow'] and sq0['tally']['slip'] == 0, 'without the stumble, he only slows', sq0)
        off = await pg.evaluate("__cut({ skill: [0, 0], slip: 1, away: true })")
        check(off['ev'] == [] and off['slow'] == 0 and off['stun'] == 0, 'the same cut off the ash costs nothing', off)
        kn = await pg.evaluate("__cut({ skill: [1, 1], slip: 1 })")
        check(kn['ev'] == [] and kn['stun'] == 0 and kn['tally']['cut'] == 0, 'a Knight\'s carrier holds his line on the ash rather than cut there', kn)

        # ---------- the ball on the ash ----------
        fum = await pg.evaluate("""(() => { LAB = true; const base = wGF.fumRules.base, keep = Object.assign({}, wGF.ashRules); wGF.fumRules.base = .25;
          const n = { on: 0, onRet: 0, off: 0, offRet: 0, dead: 0 };
          try { Object.assign(wGF.ashRules, { n: 1, m: [500, 500], r0: 500, settle: 0 });
            for (let s = 0; s < 6; s++) for (const ash of [true, false]) { wGF.simGame({ teams: __teams(s), seed: 70 + s, skill: [1, 1], ash }); const G = wGF.G;
              for (const d of G.drives) for (const e of d.plays) if (e.what === 'fum') { n[ash ? 'on' : 'off']++; if (/runs it back/.test(e.msg || '')) n[ash ? 'onRet' : 'offRet']++; }
              if (ash) n.dead += G.ash.tally.dead; } }
          finally { wGF.fumRules.base = base; Object.assign(wGF.ashRules, keep); LAB = false; }
          return n; })()""")
        check(fum['on'] > 3 and fum['onRet'] == 0 and fum['offRet'] > 0 and fum['dead'] > 0, 'a loose ball on the ash skids and dies: nobody runs it back (with ash over the whole field), as they do on the grass', fum)
        pu = await pg.evaluate("""(() => { wGF.start({ teams: __teams(4), seed: 12, ash: true }); const G = wGF.G, A = G.ash; G.poss = 0; G.ball = 30; A.patches = []; A.hot = 0;
          const plain = wGF.ashPunt(45); A.patches = [{ x: 50, y: 0, at: 0, m: 500 }]; A.t = 1e6; const dead = wGF.ashPunt(45), tally = A.tally.dead;
          A.patches = []; A.hot = 1; const short = []; for (let i = 0; i < 40; i++) short.push(wGF.ashPunt(45));
          return { plain, dead, tally, max: Math.max(...short), min: Math.min(...short), some: short.filter(y => y < 45).length }; })()""")
        check(pu['plain'] == 45 and pu['dead'] == 45 - R['roll'] and pu['tally'] == 1 and pu['max'] <= 45 and pu['some'] > 5 and pu['min'] >= 45 - 20 * R['puntK'] * 4,
              'a punt away from the heat with no ash goes as kicked; one coming down on the ash loses its roll; one toward the heat wobbles short, never long', pu)

        # ---------- the heat shimmer ----------
        fg = await pg.evaluate("""(() => { wGF.start({ teams: __teams(5), seed: 4, ash: true }); const G = wGF.G; G.poss = 0; G.ball = 65; G.down = 4;
          G.ash.hot = 0; const away = wGF.kick().chance; G.ash.hot = 1; const k = wGF.kick(); return { away, toward: k.chance, dist: k.dist }; })()""")
        want = (fg['dist'] - R['fgFrom']) * R['fgK']
        check(abs((fg['away'] - fg['toward']) - want) < 1e-9 and fg['toward'] > .05, 'a field goal toward the heat is (distance - 25) x 0.7% less likely, and the kick button shows it', dict(fg, want=want))
        sh = await pg.evaluate("""(() => { const got = [], none = [];
          for (let s = 1; s <= 30; s++) for (const hot of [1, 0]) { wGF.snap('deep', 'man', { teams: __teams(s), seed: 200 + s, ash: true, skill: [0, 0] }); const G = wGF.G; G.ash.hot = hot;
            let L = wGF.play; for (let i = 0; i < 400 && !L.thrown && !L.done; i++) L = wGF.step();
            const f = G.poss === 0 ? hot === 1 : hot === 0; if (L.thrown) (f ? got : none).push({ shim: L.shim || 0, deep: +(L.ball.tx - L.ball.fx).toFixed(1) }); }
          return { got: got.filter(x => x.shim > 0).length, of: got.length, none: none.filter(x => x.shim > 0).length, ofNone: none.length, sane: got.every(x => x.shim <= (x.deep + 8 - 12) * .07 + 1e-9 || x.shim === 0) }; })()""")
        check(sh['got'] >= 5 and sh['none'] == 0 and sh['ofNone'] > 10 and sh['sane'], 'a deep pass toward the heat wobbles (more the deeper), and none away from it', sh)
        hf = await pg.evaluate("""(() => { LAB = true; const out = [];
          for (let s = 1; s <= 10; s++) { const o = { teams: __teams(s), seed: 400 + s, skill: [s % 2, (s + 1) % 2], ash: true }; wGF.start(o); const h0 = wGF.G.ash.hot;
            const g = wGF.simGame(o), A = wGF.G.ash; out.push({ half: g.half, h0, h: A.hot, sweeps: A.sweeps }); }
          LAB = false; return out; })()""")
        check(all((x['h'] == (1 - x['h0'] if x['half'] == 2 else x['h0'])) and x['sweeps'] >= x['half'] - 1 for x in hf), 'the heat end switches at the half (and back for Sudden Death), and Clinker sweeps each time', hf)
        to = await pg.evaluate("""(() => { wGF.start({ teams: __teams(6), seed: 8, ash: true }); const A = wGF.G.ash, before = JSON.stringify(A.patches); A.t = 120;
          const a = wGF.ashTimeout(), after = wGF.ash(), b = wGF.ashTimeout();
          return { a, b, to: after.to, sweeps: after.sweeps, t: after.t, redrawn: JSON.stringify(after.patches.map(({ r, ...P }) => P)) !== before, note: wGF.notes().map(n => n.msg).join(' ') }; })()""")
        check(to['a'] == '' and to['b'] == 'No timeouts left this half.' and to['to'][0] == 0 and to['sweeps'] == 1 and to['t'] == 0 and to['redrawn'] and 'Clinker Dunn sweeps' in to['note'],
              'a timeout: Clinker sweeps the pitch and the ash starts again, noted for the log; one a half', to)
        cpu = await pg.evaluate("""(() => { LAB = true; const out = { k: 0, kg: 0, s: 0, sg: 0 };
          for (let s = 1; s <= 12; s++) for (const sk of [1, 0]) { wGF.simGame({ teams: __teams(s), seed: 600 + s, skill: [sk, sk], ash: true }); const G = wGF.G, extra = G.ash.sweeps - (G.half - 1);
            if (sk) { out.k += extra; out.kg++; } else { out.s += extra; out.sg++; } }
          LAB = false; return out; })()""")
        check(cpu['k'] > 0 and cpu['s'] == 0, 'the CPU calls its timeouts for a sweep from Knight up; a Squire never does', cpu)
        lean = await pg.evaluate("""(() => { LAB = true; const n = { f: 0, fd: 0, a: 0, ad: 0 };
          for (let s = 1; s <= 16; s++) { const o = { teams: __teams(s), seed: 800 + s, skill: [1, 1], ash: true }; wGF.start(o); const h0 = wGF.G.ash.hot; wGF.simGame(o);
            for (const d of wGF.G.drives) { const hot = d.half === 2 ? 1 - h0 : h0, f = hot === (d.side === 0 ? 1 : 0);
              for (const e of d.plays) if (wGF.plays[e.oc]) { n[f ? 'f' : 'a']++; if (e.oc === 'deep') n[f ? 'fd' : 'ad']++; } } }
          LAB = false; return { facing: +(n.fd / n.f).toFixed(3), away: +(n.ad / n.a).toFixed(3), n }; })()""")
        check(lean['facing'] < lean['away'] * .75, 'a Knight saves its deep calls for the other end', lean)
        sn = await pg.evaluate("""(() => { wGF.start({ teams: __teams(2), seed: 2, ash: true }); const G = wGF.G; G.ash.to = [0, 1]; G.ash.t = 77; const s = wGF.snapshot(), keep = JSON.stringify(s.G.ash);
          LAB = true; wGF.simGame({ teams: __teams(3), seed: 1, keep: true }); LAB = false; wGF.resume(s); wGF.hide(); return { same: JSON.stringify(wGF.G.ash) === keep, to: wGF.G.ash.to, t: wGF.G.ash.t }; })()""")
        check(sn == {'same': True, 'to': [0, 1], 't': 77}, 'the ash and the heat are kept in the snapshot, and come back with the game', sn)

        # ---------- the Realm ----------
        rl = await pg.evaluate("""(() => { const o = { teams: __teams(4), seed: 2 }; wGF.simGame(o); const on = !!wGF.G.ash; wGF.simGame(Object.assign({ ash: false }, o)); const no = !wGF.G.ash;
          LAB = true; wGF.simGame(o); const lab = !!wGF.G.ash; W_GFASH.lab = true; wGF.simGame(o); const asked = !!wGF.G.ash; W_GFASH.lab = false; LAB = false;
          return { on, no, lab, asked }; })()""")
        check(rl == {'on': True, 'no': True, 'lab': False, 'asked': True}, 'the Realm plays the Ash Bowl\'s ways in every game; a game that says no doesn\'t; LAB leaves them out unless W_GFASH.lab asks', rl)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wGF.speed = 6; wGridironGame({ mode: 'call', seed: 9 })")
        await pg.wait_for_function("wGF.phase === 'call' && !!wGF.ash()")
        await pg.evaluate("(() => { const G = wGF.G, A = G.ash; A.to = [1, 1]; A.hot = G.poss === 0 ? 1 : 0; A.patches.forEach((P, i) => { P.x = 50 + (i - 2) * 12; P.at = 0; }); A.t = 200; wGridBar(); })()")
        bt = await pg.evaluate("(() => { const b = document.getElementById('wGridTimeout'); return { shown: !b.hidden, dis: b.disabled, txt: b.textContent, note: document.getElementById('wGridNote').textContent, yours: wGF.yourBall }; })()")
        check(bt['shown'] and not bt['dis'] and bt['txt'] == 'Timeout (1)' and (('heat shimmer' in bt['note']) == bt['yours']), 'the bar has Timeout (1) at your call, and names the heat when you drive toward it', bt)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/realm-gridiron-ash.png')
        await pg.click('#wGridTimeout')
        af = await pg.evaluate("(() => { const b = document.getElementById('wGridTimeout'), A = wGF.ash(); return { to: A.to[0], sweeps: A.sweeps, t: A.t, dis: b.disabled, txt: b.textContent }; })()")
        check(af['to'] == 0 and af['sweeps'] >= 1 and af['t'] == 0 and af['dis'] and af['txt'] == 'Timeout (0)', 'pressing Timeout sweeps the pitch and uses your timeout for the half', af)
        await pg.evaluate("wGF.pause(true)")
        hp = await pg.evaluate("(() => { renderHelp(); const a = document.getElementById('wHelpGfAsh'), how = document.getElementById('wGridHow'); return { a: a ? a.textContent : '', how: how ? how.textContent : '', said: DB.chars.gk_bowl.topics.gridiron.t }; })()")
        check('Ash Bowl' in hp['a'] and 'Ashfall' in hp['how'] and 'heat shimmer' in hp['how'] and 'Timeout' in hp['how'] and 'ash' in hp['said'] and 'heat' in hp['said'],
              'How to play, Football: how it works and Clinker Dunn\'s GRIDIRON line explain the ash and the heat', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\nFAILED: ' + ', '.join(FAILS) if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
