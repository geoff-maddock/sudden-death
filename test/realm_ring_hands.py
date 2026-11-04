# Realm ring, by hand (issue #23, phase 2): your corner and your hands. Three modes on the bar: Corners (the CPU's), You
# corner and You box. With a corner of your own the bout waits for your plan before the first round and between rounds,
# with your corner's advice marked; the cut-man works once a break. In You box your fighter does nothing you didn't
# press: the keys (J, K, L, Space held, Shift, E, WASD) and the pad under the ring throw punches, guard, slip, clinch and
# move them; a press while busy waits a moment; let go of the steering and their feet follow the plan. In You corner they
# box your plan themselves. Switching modes goes on with the same bout. Keys do nothing outside You box. Headless bouts
# are the same whatever the mode. How to play has Boxing: how it works. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-ring-hands-*.png.
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

# beats on the engine's clock, with the page's own loop held still; and a calm moment: both fighters standing still and
# apart, the other one not about to do anything (so your fighter's instincts have nothing to react to)
STEP = "(n) => { for (let i = 0; i < n && wBX.phase !== 'over'; i++) wBX.step(); return wBX.phase; }"
CALM = """() => { const G = wBX.G, [f, o] = G.F; for (const x of G.F) { x.a = { k: 'idle', t: 0, dur: 0, id: 0 }; x.mv = [0, 0]; x.sta = x.staMax; }
  f.x = -1.2; o.x = 1.2; f.y = o.y = 0; o.think = 99; wBX.input({ steer: [0, 0], guard: false }); }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined'")
        await pg.evaluate(f"window.__step = {STEP}; window.__calm = {CALM}; 0")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- headless bouts don't care about the mode ----------
        h = await pg.evaluate("""(() => { const f = [{ n: 'A', kind: 'ogre' }, { n: 'B', kind: 'harpy' }];
          return JSON.stringify(wBX.simBout({ fighters: f, seed: 3 })) === JSON.stringify(wBX.simBout({ fighters: f, seed: 3, mode: 'play' })); })()""")
        check(h, 'a headless bout is the same whatever the mode', None)

        # ---------- the bar, and the wait before the first round ----------
        await pg.evaluate("wRingBout({ kinds: ['minotaur', 'elf'], seed: 5 })")
        await pg.wait_for_function("UI.view === 'ring' && wBX.on")
        await pg.evaluate("wBX.pause(true)")
        b = await pg.evaluate("""(() => { const modes = [...document.querySelectorAll('#wRingModes button')].map(x => [x.textContent, x.classList.contains('on')]);
          __step(80); return { modes, mode: wBX.mode, ph: wBX.phase, wait: wBX.wait, call: !document.getElementById('wRingCall').hidden,
            advised: [...document.querySelectorAll('#wRingCall [data-rplan].on')].map(x => x.dataset.rplan), plans: document.querySelectorAll('#wRingCall [data-rplan]').length,
            pad: !document.getElementById('wRingPad').hidden, note: document.getElementById('wRingNote').textContent }; })()""")
        check(b['modes'] == [['Corners', False], ['You corner', False], ['You box', True]] and b['mode'] == 'play', 'three modes on the bar; You box to start with', b['modes'])
        check(b['ph'] == 'intro' and b['wait'] and b['wait']['plan'] == 'press', 'before the first round the bout waits for your plan', b)
        check(b['call'] and b['plans'] == 5 and b['advised'] == ['press'] and 'Your corner says Press' in b['note'], 'the bar has the five plans, your corner\'s advice marked', b)
        check(b['pad'], 'the pad is under the ring in You box', None)
        await pg.screenshot(path='/tmp/realm-ring-hands-intro.png')
        await pg.click('[data-rplan="counter"]')
        c = await pg.evaluate("(() => { const plan = wBX.G.F[0].plan, w = wBX.wait; const ph = __step(30); return { plan, w, ph, hidden: document.getElementById('wRingCall').hidden }; })()")
        check(c['plan'] == 'counter' and c['w'] is None and c['ph'] == 'round' and c['hidden'], 'a plan picked, the bell goes and round 1 is boxed to it', c)

        # ---------- your hands ----------
        q = await pg.evaluate("""(() => { const f = wBX.G.F[0], t0 = f.rs.thrown, s0 = f.rs.slips; __step(60);
          return { thrown: f.rs.thrown - t0, other: wBX.G.F[1].rs.thrown, guard: f.a.k }; })()""")
        check(q['thrown'] == 0 and q['other'] > 0 and q['guard'] != 'guard', 'in You box your fighter throws nothing you didn\'t press (the other one does)', q)
        await pg.evaluate("__calm()")
        await pg.keyboard.press('j')
        k = await pg.evaluate("(() => { const f = wBX.G.F[0], t0 = f.rs.thrown; __step(1); return { k: f.a.k, thrown: f.rs.thrown - t0 }; })()")
        check(k == {'k': 'jab', 'thrown': 1}, 'J throws a jab', k)
        await pg.keyboard.press('k')
        k2 = await pg.evaluate("(() => { const f = wBX.G.F[0], t0 = f.rs.thrown, ks = []; for (let i = 0; i < 12; i++) { __step(1); if (ks[ks.length - 1] !== f.a.k) ks.push(f.a.k); } return { ks, thrown: f.rs.thrown - t0 }; })()")
        check('hook' in k2['ks'] and k2['thrown'] == 1, 'K pressed mid-jab waits, then throws the hook: a one-two', k2)
        await pg.evaluate("__calm()")
        await pg.keyboard.press('l')
        l = await pg.evaluate("(() => { __step(1); return wBX.G.F[0].a.k; })()")
        check(l == 'body', 'L throws a body shot', l)
        bf = await pg.evaluate("(() => { __step(20); wBX.input({ act: 'jab' }); __step(Math.ceil(wBX.buffer / .05) + 2); return wBX.inputState.q; })()")
        check(bf is None, 'a press waits only a moment', bf)
        await pg.evaluate("__calm()")
        await pg.keyboard.down(' ')
        g = await pg.evaluate("(() => { const f = wBX.G.F[0]; __step(2); const a = f.a.k; __step(30); return [a, f.a.k]; })()")
        await pg.keyboard.up(' ')
        g2 = await pg.evaluate("(() => { __step(14); return wBX.G.F[0].a.k; })()")
        check(g == ['guard', 'guard'] and g2 != 'guard', 'holding Space keeps the guard up; letting go drops it', [g, g2])
        await pg.evaluate("__calm()")
        await pg.keyboard.press('Shift')
        sl = await pg.evaluate("(() => { __step(1); return wBX.G.F[0].a.k; })()")
        check(sl == 'slip', 'Shift slips', sl)
        mv = await pg.evaluate("""(() => { const G = wBX.G, f = G.F[0], o = G.F[1]; __step(10);
          f.x = -4; f.y = 0; o.x = 4; o.y = 0; wBX.input({ steer: [0, -1] }); const y0 = f.y; __step(12); const up = f.y - y0;
          wBX.input({ steer: [0, 0] }); f.x = -4; f.y = 0; o.x = 4; o.y = 0; const x0 = f.x; __step(12); return { up, feet: f.x - x0 }; })()""")
        check(mv['up'] < -.5, 'steering up moves them to the far side', mv)
        check(mv['feet'] > .3, 'let go, and their feet follow the plan (in toward the other fighter)', mv)
        cl = await pg.evaluate("""(() => { const G = wBX.G, f = G.F[0], o = G.F[1]; for (const x of G.F) x.a = { k: 'idle', t: 0, dur: 0, id: 0 };
          f.x = -.85; o.x = .85; f.y = o.y = 0; const c0 = f.rs.clinch; wBX.input({ act: 'clinch' }); __step(1); return f.rs.clinch - c0; })()""")
        check(cl == 1, 'E (or the pad) goes for a clinch', cl)
        pd = await pg.evaluate("""(() => { __calm(); const f = wBX.G.F[0], t0 = f.rs.thrown, B = s => document.querySelector(`[data-rpad="${s}"]`);
          B('hook').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })); __step(1); const hook = f.a.k;
          __calm(); B('guard').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 })); __step(10); const held = f.a.k;
          B('guard').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2 })); __step(14);
          return { hook, held, after: f.a.k, thrown: f.rs.thrown - t0 }; })()""")
        check(pd['hook'] == 'hook' and pd['held'] == 'guard' and pd['after'] != 'guard', 'the pad under the ring does the same: a hook on the press, the guard while held', pd)
        await pg.evaluate("wBX.pause(false)"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/realm-ring-hands-round.png')
        await pg.evaluate("wBX.pause(true)")

        # ---------- input across changes: a clinch, a change of mode, How to play ----------
        bc = await pg.evaluate("""(() => { __calm(); const G = wBX.G; for (const x of G.F) x.a = { k: 'clinch', t: 0, dur: 2, id: 0 };
          wBX.input({ act: 'jab' }); __step(Math.ceil(wBX.buffer / .05) + 2); const q = wBX.inputState.q; const k = G.F[0].a.k; __calm(); return { q, k }; })()""")
        check(bc['q'] is None and bc['k'] == 'clinch', 'a press made in a clinch waits only its moment, not the whole clinch', bc)
        await pg.evaluate("wBX.input({ guard: true, steer: [1, 0] })")
        await pg.click('[data-rmode="call"]'); await pg.click('[data-rmode="play"]')
        ms = await pg.evaluate("wBX.inputState")
        check(not ms['guard'] and ms['steer'] == [0, 0], 'a change of mode lets go of the guard and the steering', ms)
        await pg.evaluate("showPage('help')"); await pg.keyboard.press('j')
        hk = await pg.evaluate("({ q: wBX.inputState.q, paused: wBX.paused })")
        await pg.evaluate("showPage('play'); wBX.pause(true)")
        check(hk == {'q': None, 'paused': True}, 'with How to play up the keys are the page\'s, and nothing is queued', hk)

        # ---------- between rounds: your call, and the cut-man ----------
        # (Space held through the bell, with the bar's Another bout focused: its repeats and its release mustn't click it)
        await pg.evaluate("__calm(); document.getElementById('wRingAgain').focus()")
        await pg.keyboard.down(' ')
        G0 = await pg.evaluate("(window.__G0 = wBX.G, __step(1), wBX.G.F[0].a.k)")
        # (both fighters given iron chins here, so the rounds surely go to the bell)
        cr = await pg.evaluate("(() => { for (const f of wBX.G.F) f.r.chin = 60; let n = 0; while (wBX.phase !== 'corner' && wBX.phase !== 'over' && n++ < 4000) wBX.step(); return wBX.phase; })()")
        check(cr == 'corner', 'round 1 goes to the bell', cr)
        await pg.keyboard.down(' '); await pg.keyboard.up(' ')
        sp = await pg.evaluate("({ same: wBX.G === __G0, ph: wBX.phase, guard: wBX.inputState.guard })")
        check(G0 == 'guard' and sp == {'same': True, 'ph': 'corner', 'guard': False}, 'Space held through the bell, then let go, leaves the bar alone: the same bout, in the corner', [G0, sp])
        pz = await pg.evaluate("(() => { document.querySelector('[data-rpad=\"jab\"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5 })); return wBX.inputState.q; })()")
        check(pz is None, 'a press on the pad between rounds is dropped (it would fire at the bell)', pz)
        w = await pg.evaluate("""(() => { __step(200); const f = wBX.G.F[0]; return { ph: wBX.phase, wait: !!wBX.wait, hp: f.hp, max: f.hpMax, patches: f.patches,
          btn: !document.getElementById('wRingPatch').disabled, txt: document.getElementById('wRingPatch').textContent }; })()""")
        check(w['ph'] == 'corner' and w['wait'] and w['btn'] and w['txt'] == 'Cut-man (2 left)', 'between rounds the bout waits for your call, the cut-man ready', w)
        await pg.screenshot(path='/tmp/realm-ring-hands-corner.png')
        await pg.click('#wRingPatch')
        pt = await pg.evaluate("""(() => { const f = wBX.G.F[0]; return { hp: f.hp, max: f.hpMax, patches: f.patches, btn: document.getElementById('wRingPatch').disabled,
          txt: document.getElementById('wRingPatch').textContent, again: wBX.patch(), log: wBX.G.log.some(l => /cut-man works on/.test(l.msg)) }; })()""")
        check(pt['patches'] == 1 and pt['hp'] > w['hp'] - .01 and pt['max'] >= w['max'] and pt['btn'] and pt['txt'] == 'Cut-man (1 left)' and pt['again'] is False and pt['log'],
              'the cut-man works once a break: health back, a patch used, the button off', [w, pt])
        # Corners mid-break takes your corner's advice and goes on with the same bout
        sw = await pg.evaluate("""(() => { const G = wBX.G, adv = wBX.wait.plan; document.querySelector('[data-rmode="watch"]').click();
          const r = { same: wBX.G === G, mode: wBX.mode, wait: wBX.wait, plan: G.F[0].plan, adv, call: document.getElementById('wRingCall').hidden, pad: document.getElementById('wRingPad').hidden };
          r.ph = __step(30); return r; })()""")
        check(sw['same'] and sw['mode'] == 'watch' and sw['wait'] is None and sw['plan'] == sw['adv'] and sw['call'] and sw['pad'] and sw['ph'] == 'round',
              'switching to Corners mid-break takes your corner\'s advice, and the same bout goes on', sw)
        th = await pg.evaluate("(() => { const f = wBX.G.F[0], t0 = f.rs.thrown; __step(100); return f.rs.thrown - t0; })()")
        check(th > 0, 'in Corners your fighter boxes by themselves again', th)
        await pg.keyboard.press('j')
        kw = await pg.evaluate("wBX.inputState.q")
        check(kw is None, 'keys do nothing outside You box', kw)
        # You corner: asked at the next break; they box the plan themselves
        await pg.click('[data-rmode="call"]')
        nx = await pg.evaluate("(() => { let n = 0; while (wBX.phase !== 'corner' && wBX.phase !== 'over' && n++ < 4000) wBX.step(); return { ph: wBX.phase, wait: !!wBX.wait }; })()")
        check(nx['ph'] == 'corner' and nx['wait'], 'in You corner the next break waits for your call', nx)
        await pg.click('[data-rplan="body"]')
        yc = await pg.evaluate("(() => { __step(30); const f = wBX.G.F[0], t0 = f.rs.thrown; __step(120); return { plan: f.plan, thrown: f.rs.thrown - t0, pad: document.getElementById('wRingPad').hidden }; })()")
        check(yc['plan'] == 'body' and yc['thrown'] > 0 and yc['pad'], 'and your fighter boxes your plan by themselves (no pad)', yc)
        await pg.evaluate("wBX.pause(false)")

        # ---------- the cut-man, once a break, across a change of mode ----------
        await pg.evaluate("W_RING_MODE = 'watch'; wRingBout({ kinds: ['ogre', 'elf'], seed: 8 }); wBX.pause(true)")
        cm = await pg.evaluate("""(() => { const f = wBX.G.F[0]; for (const x of wBX.G.F) x.r.chin = 60; let n = 0;
          while (wBX.phase !== 'round' && n++ < 200) wBX.step(); f.hp = 30;
          while (wBX.phase !== 'corner' && wBX.phase !== 'over' && n++ < 4000) { wBX.step(); if (wBX.phase === 'round') f.hp = Math.min(f.hp, 30); }
          const after = f.patches; document.querySelector('[data-rmode="call"]').click();
          const r = { ph: wBX.phase, cpu: 2 - after, wait: wBX.wait, again: wBX.patch(), patches: f.patches, lines: wBX.G.log.filter(l => /cut-man works on/.test(l.msg)).length };
          wBX.pause(false); return r; })()""")
        check(cm['ph'] == 'corner' and cm['cpu'] == 1 and cm['wait'] and not cm['wait']['patch'] and cm['again'] is False and cm['patches'] == 1 and cm['lines'] == 1,
              'the CPU corner\'s patch counts: switching to You corner in that break, the cut-man can\'t work again', cm)

        # ---------- How to play ----------
        await pg.click('#wRingHowBtn')
        hw = await pg.evaluate("""(() => { const s = document.getElementById('wRingHow'); return { h: s && s.querySelector('h3').textContent, t: s ? s.textContent : '', paused: wBX.paused }; })()""")
        check(hw['h'] == 'Boxing: how it works' and all(w in hw['t'] for w in ['J jab', 'Shift to slip', 'Cover up', 'Body work', 'Brass', 'cut-man', 'You box', 'knockdown wins the round 10–8', 'a body shot half the time']) and hw['paused'],
              'How to play boxing opens Boxing: how it works (keys, plans, judges, the cut-man), and the bout waits', {'h': hw['h'], 'paused': hw['paused']})
        await pg.evaluate("showPage('play')")

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
