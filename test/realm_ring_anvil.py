# The Anvil Ring's own ways (issue #115, phase 4: src/bx/parts/16-anvil.js, w145-anvilring.js). Asserts: the tables;
# with the ways off (no anvil, false or null) a seeded bout boxes exactly the same and keeps no state, and with them on
# the same bout goes differently; a seeded bout with them draws the same forge corner and ropes every time, and across
# bouts both neutral corners and all four sides come up; the forge corner's heat (breath back slower, and some taken)
# near its corner and none across the ring; the slack ropes (slack from the bell, all the way out late in the round,
# slower feet and easier to hit on them, nothing on the other sides); Ma Gristle tightens them at each bell and another
# side goes slack; her line before the first bell and her ROPES and FORGE; the CPU steps out of them by its skill, and a
# Squire spends longer in them than an Archmage; kept in the bout's snapshot; every bout on a card has them, and the forge corner changes each bout; in the Realm
# on in every bout (off in LAB unless W_ANVIL.lab; never in the Umbral's Broken Ring); drawn on the ring (the forge
# corner glows) and in How to play. Exits nonzero on failure. Screenshot: /tmp/realm-ring-anvil.png.
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

# two fighters in round 1 with the Anvil Ring's ways, still and fresh (kinds: [side 0, side 1]); o: more options
SETUP = """(kinds, o) => { wBX.start(Object.assign({ fighters: kinds.map((k, i) => ({ n: 'F' + i, kind: k })), seed: 7, anvil: true }, o || {}));
  for (let i = 0; i < 100 && wBX.phase === 'intro'; i++) wBX.step();
  const G = wBX.G; for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.mv = [0, 0]; f.think = 99; f.r.chin = 60; } return G; }"""
# steps with nobody thinking (so nobody moves or punches)
STILL = "(n) => { for (let i = 0; i < n; i++) { for (const f of wBX.G.F) { f.think = 99; f.mv = [0, 0]; f.a = f.a.k === 'down' ? f.a : { k: 'idle', t: 0, dur: 0, id: 0 }; } wBX.step(); } }"
TO_PHASE = "(ph) => { for (let i = 0; i < 6000 && wBX.phase !== ph && wBX.phase !== 'over'; i++) wBX.step(); return wBX.phase; }"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined' && typeof W_ANVIL === 'object'")
        await pg.evaluate(f"wBX.speed = 4; window.__setup = {SETUP}; window.__still = {STILL}; window.__to = {TO_PHASE}; 0")

        # ---------- the tables ----------
        t = await pg.evaluate("({ A: wBX.anvilRules, forge: wBX.forgeNames, slack: wBX.slackNames })")
        A = t['A']
        check(A['forge']['corners'] == [1, 2] and set(t['forge']) >= {'1', '2'} and len(t['slack']) == 4, 'the forge is one of the two neutral corners, and there are four sides of ropes, each named', t)
        check(0 < A['forge']['regK'] < 1 and A['forge']['drain'] > 0 and A['forge']['r0'] < A['forge']['r'] and 0 < A['slack']['move'] < 1 and A['slack']['pin'] > 0, 'the numbers: breath back slower and some taken in the forge; slower feet and easier to hit on the slack ropes', A)
        check(A['read']['out'][0] < A['read']['out'][1] < A['read']['out'][2] and A['read']['herd'][0] == 0 and 0 < A['read']['herd'][1] < A['read']['herd'][2], 'the CPU reads them by its skill: a Squire only just steps out and never walks anyone in, an Archmage more than a Knight', A['read'])

        # ---------- off: as before; on: different, and seeded ----------
        off = await pg.evaluate("""(() => { const F = [{ n: 'A', kind: 'troll' }, { n: 'B', kind: 'harpy' }], key = s => JSON.stringify([s.over, s.cards, s.stats, s.log.map(l => l.msg)]), out = [];
          LAB = true;
          for (const a of [undefined, false, null]) { const o = { fighters: F, seed: 31, skill: [1, 2] }; if (a !== undefined) o.anvil = a; const s = wBX.simBout(o); out.push([key(s), !!s.anvil]); }
          const on = wBX.simBout({ fighters: F, seed: 31, skill: [1, 2], anvil: true }), again = wBX.simBout({ fighters: F, seed: 31, skill: [1, 2], anvil: true });
          const firsts = { forge: {}, slack: {} };
          for (let i = 0; i < 40; i++) { wBX.start({ fighters: F, seed: 1000 + i, anvil: true, headless: true }); firsts.forge[wBX.anvil.forge] = 1; firsts.slack[wBX.anvil.slack] = 1; }
          LAB = false;
          return { same: out.every(x => x[0] === out[0][0]), kept: out.some(x => x[1]), differs: key(on) !== out[0][0], seeded: key(on) === key(again) && JSON.stringify(on.anvil) === JSON.stringify(again.anvil), anvil: on.anvil,
            forges: Object.keys(firsts.forge).sort(), sides: Object.keys(firsts.slack).sort() }; })()""")
        check(off['same'] and not off['kept'], 'with the ways off (no anvil, false or null) a seeded bout boxes exactly the same, and keeps no state', off)
        check(off['differs'] and off['anvil'] and off['anvil']['forge'] in (1, 2), 'with them on the same bout goes differently, and its summary says where the forge was', off)
        check(off['seeded'], 'a seeded bout with them boxes the same every time, the forge and the ropes included', off)
        check(off['forges'] == ['1', '2'] and off['sides'] == ['0', '1', '2', '3'], 'across bouts the forge comes up in both neutral corners, and every side of ropes goes slack first', off)

        # ---------- the forge corner ----------
        fg = await pg.evaluate("""(() => { const run = hot => { const G = __setup(['golem', 'golem']), [cx, cy] = wBX.forgeXY();
            G.F[0].x = 0; G.F[0].y = 0; G.F[1].x = hot ? cx * .95 : -cx * .95; G.F[1].y = hot ? cy * .95 : -cy * .95; G.F[1].sta = 30; G.F[0].sta = 30;
            const at = wBX.anvilAt(1), at0 = wBX.anvilAt(0), regK = wBX.fxNow(1).regK; __still(40);
            return { at, at0, regK, gain: G.F[1].sta - 30, gain0: G.F[0].sta - 30, heat: wBX.anvil.heat }; };
          return { hot: run(true), cool: run(false) }; })()""")
        h, c = fg['hot'], fg['cool']
        check(h['at']['forge'] and h['at']['heat'] == 1 and abs(h['regK'] - A['forge']['regK']) < 1e-9 and not h['at0']['forge'], 'in the forge corner a fighter is in its full heat (their breath back at the forge\'s rate); in the middle of the ring, none', fg)
        check(not c['at']['forge'] and c['regK'] == 1, 'across the ring, in the other neutral corner, no heat at all', c)
        check(c['gain'] > 0 and h['gain'] < c['gain'] * .4 and abs(h['gain0'] - c['gain0']) < 1e-6, 'two seconds standing in the forge corner get back well under half the breath the same two seconds in the other corner do (the other fighter the same either way)', fg)
        check(h['heat'][1] > 1.5 and h['heat'][0] == 0, 'the time in the heat is kept, for the fighter in it', h['heat'])

        # ---------- the slack ropes, and Ma Gristle at the bell ----------
        sl = await pg.evaluate("""(() => { const G = __setup(['golem', 'golem']), A = wBX.anvil, S = A.slack, ax = S >= 2 ? 'x' : 'y', sg = S % 2 ? 1 : -1, rp = wBX.rope();
          const s0 = wBX.slackNow(), first = G.log.slice(0, 3).map(l => l.msg);
          // fighter 1 against the slack side, fighter 0 against the side across from it
          G.F[1][ax] = sg * (rp - .3); G.F[1][ax === 'x' ? 'y' : 'x'] = 0; G.F[0][ax] = -sg * (rp - .3); G.F[0][ax === 'x' ? 'y' : 'x'] = 0;
          const early = { at: wBX.anvilAt(1), move: wBX.fxNow(1).move };
          G.clock = 3; const late = { s: wBX.slackNow(), at: wBX.anvilAt(1), move: wBX.fxNow(1).move, other: wBX.anvilAt(0), otherMove: wBX.fxNow(0).move };
          const sides = [S], tight = [], said = [];
          for (let r = 2; r <= 3; r++) { const ph = __to('corner'); tight.push([ph, wBX.slackNow(), wBX.G.round]); sides.push(wBX.anvil.slack); __to('round'); }
          said.push(...wBX.G.log.filter(l => /Ma Gristle tightens/.test(l.msg)).map(l => l.msg));
          return { s0, first, early, late, sides, tight, said, forge: wBX.forgeNames[A.forge], slackN: wBX.slackNames[S] }; })()""")
        check(abs(sl['s0'] - A['slack']['s0']) < .02 and sl['early']['at']['slack'] and sl['early']['move'] < 1, 'the slack ropes are a little loose from the bell, and a fighter against them is already a little slower off them', sl)
        check(sl['late']['s'] == 1 and abs(sl['late']['move'] - A['slack']['move']) < 1e-9 and abs(sl['late']['at']['pin'] - A['slack']['pin']) < 1e-9, 'late in the round they are all the way out: feet off them at the slack rate, and punches find the fighter on them more often', sl['late'])
        check(not sl['late']['other']['slack'] and sl['late']['otherMove'] == 1 and sl['late']['other']['pin'] == 0, 'the ropes across the ring are tight: nothing changes there', sl['late'])
        check(all(x[0] == 'corner' and x[1] == 0 for x in sl['tight']) and [x[2] for x in sl['tight']] == [2, 3], 'between rounds the ropes are tight (Ma Gristle has been round them)', sl['tight'])
        check(all(sl['sides'][i] != sl['sides'][i + 1] for i in range(2)), 'each round another side goes slack, never the same side twice running', sl['sides'])
        check(len(sl['said']) == 2 and 'round 2' in sl['said'][0] and 'round 3' in sl['said'][1], 'Ma Gristle tightens the ropes at each bell and says which side goes next', sl['said'])
        check(any('Ma Gristle:' in m and sl['forge'] in m and sl['slackN'] in m for m in sl['first']), 'Ma Gristle names the forge corner and the slack side before the first bell', sl['first'])

        # ---------- the CPU reads them ----------
        rd = await pg.evaluate("""(() => { const out = {};
          // a fighter in the forge's heat: how hard it wants to go away from the corner, by skill (its step, along the line out of the corner)
          for (const sk of [0, 2]) { let sum = 0; for (let i = 0; i < 30; i++) { const G = __setup(['elf', 'elf'], { seed: 50 + i, skill: [sk, 1] }), [cx, cy] = wBX.forgeXY(); G.F[0].x = cx * .85; G.F[0].y = cy * .85; G.F[1].x = cx * .85 - Math.sign(cx) * 4; G.F[1].y = cy * .85;
            const [mx, my] = wBX.feet(0), d = Math.hypot(cx, cy); sum += (-mx * cx - my * cy) / d; } out['out' + sk] = sum / 30; }
          // whole bouts, the same kinds each side: a Squire against an Archmage, both ways round
          LAB = true; const K = wBX.kinds, t = { heat: [0, 0], rope: [0, 0] };
          for (let i = 0; i < 60; i++) { const k = K[i % K.length], sk = i % 2 ? [0, 2] : [2, 0], s = wBX.simBout({ fighters: [{ n: 'A', kind: k }, { n: 'B', kind: k }], seed: 4000 + i, skill: sk, anvil: true });
            const sq = sk[0] === 0 ? 0 : 1; t.heat[0] += s.anvil.heat[sq]; t.heat[1] += s.anvil.heat[1 - sq]; t.rope[0] += s.anvil.rope[sq]; t.rope[1] += s.anvil.rope[1 - sq]; }
          LAB = false; out.squireArch = t; return out; })()""")
        check(rd['out2'] > rd['out0'] + .3, 'an Archmage in the forge\'s heat steps out of it much harder than a Squire', rd)
        sa = rd['squireArch']
        check(sa['heat'][0] > sa['heat'][1] and sa['rope'][0] > sa['rope'][1] * 1.5, 'over 60 bouts a Squire spends longer in the forge\'s heat and on the slack ropes than the Archmage across the ring (seconds: Squire, Archmage)', sa)

        # ---------- kept in the snapshot ----------
        sn = await pg.evaluate("""(() => { const G = __setup(['vampire', 'golem']); const ph = __to('corner'), snap = wBX.snapshot(), was = JSON.stringify(wBX.anvil);
          wBX.start({ fighters: [{ n: 'X', kind: 'elf' }, { n: 'Y', kind: 'elf' }], seed: 1, anvil: false }); const gone = wBX.anvil;
          wBX.resume(snap); wBX.hide(); return { ph, kept: !!(snap && snap.G.anvil), gone, back: JSON.stringify(wBX.anvil) === was }; })()""")
        check(sn['ph'] == 'corner' and sn['kept'] and sn['gone'] is None and sn['back'], 'the forge and the ropes are in the snapshot at the corner, and come back with the bout', sn)

        # ---------- a card: every bout ----------
        cd = await pg.evaluate("""(() => { const side = (n, k) => ({ name: n, short: n.slice(0, 3), color: '#a33', light: '#fcc', fighters: k.map((x, i) => ({ n: n + i, kind: x })) });
          const o = s => ({ sides: [side('Ours', ['witch', 'lich', 'goblin']), side('Them', ['vampire', 'zombie', 'gorgon'])], skill: [1, 1], seed: s });
          LAB = true; const c = wBX.cardStart(Object.assign(o(3), { anvil: true })), live = !!wBX.anvil;
          let mixed = false; const all = []; for (let s = 0; s < 6; s++) { const r = wBX.simCard(Object.assign(o(10 + s), { anvil: true })); all.push(r.bouts.every(b => b.anvil)); if (new Set(r.bouts.map(b => b.anvil.forge)).size > 1) mixed = true; }
          LAB = false; return { card: !!c.anvil, live, all: all.every(Boolean), mixed }; })()""")
        check(cd['card'] and cd['live'] and cd['all'], 'a card with the ways has them in every bout, live and headless', cd)
        check(cd['mixed'], 'the forge corner is drawn again for each bout on a card', cd)
        alt = await pg.evaluate("""(() => { const side = (n, k) => ({ name: n, short: n.slice(0, 3), color: '#a33', light: '#fcc', fighters: k.map((x, i) => ({ n: n + i, kind: x })) });
          const o = s => ({ sides: [side('Ours', ['witch', 'lich', 'goblin']), side('Them', ['vampire', 'zombie', 'gorgon'])], skill: [1, 1], seed: s }), alts = f => f.every((x, i) => !i || x !== f[i - 1]);
          LAB = true; const sims = []; for (let s = 0; s < 12; s++) sims.push(wBX.simCard(Object.assign(o(30 + s), { anvil: true })).bouts.map(b => b.anvil.forge));
          const lives = []; for (let s = 0; s < 3; s++) { wBX.cardStart(Object.assign(o(60 + s), { anvil: true })); const f = [];
            for (let i = 0; i < 3; i++) { f.push(wBX.anvil.forge); wBX.pause(true); for (let k = 0; k < 20000 && wBX.phase !== 'over'; k++) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); } wBX.pause(false); if (i < 2) wBX.cardNext(); }
            lives.push(f); }
          wBX.hide(); LAB = false; return { sims, lives, sim: sims.every(alts), live: lives.every(alts) }; })()""")
        check(alt['sim'] and alt['live'], 'on a card, the forge corner changes each bout: the next bout takes the other neutral corner (headless and live)', alt)

        # ---------- the Realm: on in every bout, off in LAB, never in the Umbral ----------
        rl = await pg.evaluate("""(() => { const side = (n, k) => ({ name: n, short: n.slice(0, 3), color: '#a33', light: '#fcc', fighters: k.map((x, i) => ({ n: n + i, kind: x })) });
          const o = () => ({ sides: [side('Ours', ['witch', 'lich', 'goblin']), side('Them', ['vampire', 'zombie', 'gorgon'])], skill: [1, 1], seed: 9 });
          const on = wBX.simCard(o()).bouts.every(b => b.anvil), bout = !!wBX.simBout({ fighters: [{ n: 'A', kind: 'elf' }, { n: 'B', kind: 'ogre' }], seed: 2 }).anvil;
          const no = wBX.simCard(Object.assign(o(), { anvil: false })).bouts.some(b => b.anvil);
          LAB = true; const lab = wBX.simCard(o()).bouts.some(b => b.anvil); W_ANVIL.lab = true; const asked = wBX.simCard(o()).bouts.every(b => b.anvil); W_ANVIL.lab = false; LAB = false;
          WU4C.hexes = ['lead']; const um = wBX.simCard(o()).bouts; WU4C.hexes = null;
          return { on, bout, no, lab, asked, umbral: um.some(b => b.anvil), umHex: um.every(b => /Leaden Gloves/.test(b.log.map(l => l.msg).join(' '))) }; })()""")
        check(rl['on'] and rl['bout'] and not rl['no'], 'the Realm boxes every card and bout with the ways (anvil: false leaves them out)', rl)
        check(not rl['lab'] and rl['asked'], 'LAB mode leaves them out unless W_ANVIL.lab asks', rl)
        check(not rl['umbral'] and rl['umHex'], 'the Umbral\'s Broken Ring has its hexes and not the Anvil Ring\'s ways', rl)
        mg = await pg.evaluate("(() => { const K = DB.chars.gk_ring; return { job: K.topics.job.t, ropes: (K.topics.ropes || {}).t || '', forge: (K.topics.forge || {}).t || '' }; })()")
        check('ROPES' in mg['job'] and 'FORGE' in mg['job'] and 'tighten' in mg['ropes'] and 'corner' in mg['forge'], 'Ma Gristle tells you about the ROPES and the FORGE', mg)

        # ---------- on screen ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("W_RING_MODE = 'watch'; wRingBout({ kinds: ['ogre', 'harpy'], seed: 4 }); wBX.pause(true); for (let i = 0; i < 200 && wBX.phase !== 'round'; i++) wBX.step(); wBX.G.clock = 6; wBX.pause(false)")
        await pg.wait_for_function("!!wBX.anvil && wBX.phase === 'round'")
        await pg.wait_for_timeout(400)
        await pg.evaluate("wBX.pause(true)")
        px = await pg.evaluate("""(() => { const cv = document.querySelector('#v-ring canvas'), c = cv.getContext('2d'), k = cv.width / 960, [cx, cy] = wBX.forgeXY(), G = wBX.G, A = G.anvil;
          const warm = (x, y) => { const [sx, sy] = wBX.scr(x, y); const d = c.getImageData(Math.round(sx * k) - 3, Math.round(sy * k) - 3, 7, 7).data; let w = 0; for (let i = 0; i < d.length; i += 4) w += d[i] - d[i + 2]; return w / (d.length / 4); };
          // (the same spot just inside the forge corner, drawn with the ways and without them)
          wBX.render(); const on = warm(cx * .8, cy * .8); delete G.anvil; wBX.render(); const off = warm(cx * .8, cy * .8); G.anvil = A; wBX.render();
          return { on, off, live: !!wBX.anvil }; })()""")
        check(px['live'] and px['on'] > px['off'] + 15, 'the forge corner glows on the canvas (the same spot is redder with the forge than without it)', px)
        await pg.screenshot(path='/tmp/realm-ring-anvil.png')
        await pg.evaluate("wBX.pause(false); wLeaveRing()")
        hp = await pg.evaluate("(() => { renderHelp(); const a = document.getElementById('wRingHowAnvil'), b = document.getElementById('wHelpRingAnvil'); return { a: a ? a.textContent : '', b: b ? b.textContent : '' }; })()")
        check(all(w in hp['a'] for w in ('forge corner', 'slack ropes', 'Ma Gristle', 'breath')) and 'Anvil Ring' in hp['b'], 'How to play: Boxing, how it works explains the forge corner and the slack ropes', hp)

        # (the words say what the forge does: breath taken there, and back slower; not "half as fast", which its rate isn't)
        words = [hp['a'], hp['b'], mg['forge']]
        check(all('slower' in w for w in words) and not any('half as fast' in w for w in words), 'the forge\'s words match its numbers: it takes breath, and breath comes back slower (not half as fast)', words)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\nFAILED: ' + ', '.join(FAILS) if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
