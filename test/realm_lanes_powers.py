# Realm lanes (issue #100, phase 6): monster powers at the Lanes.
# Every league kind has a strike power, a spare power, a second of each, and an ultimate, and every id is unique. No
# powers unless a game asks; with them, each side starts with mana and no roar. A strike fills mana and a little roar,
# a double or a turkey more roar, a split made the most. The bowler's power costs mana and works on their ball, one a
# ball; a curse lands on the other side's next ball; a Drain takes their roar at once. The ultimate is once a game,
# before a frame's first ball, and its mark works on both sides that frame and then goes. Steady only in the last
# frame. The situation powers fit their moments. The effects work: a Ghost Ball saves a light ball, a stone pin is
# harder to topple, a web catches a gutter ball, a Hex makes the ball skid long. The CPU casts, and powOnly limits a
# side to one power. The page: the Powers row on your ball (mana, the roar, P, U, K), Auto powers in Manage, the power
# picks on the Lanes tab reaching the engine, and How to play. Asserts; exits nonzero on failure.
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

HELP = r"""
window.__team = ks => ({ name: ks.join(''), short: 'T', roster: ks.map((k, i) => ({ n: k + i, kind: k, hand: 1 })) });
window.__to = (ph, max) => { let n = 0; while (wBL.phase !== ph && n++ < (max || 6000)) wBL.tick(0.05); return wBL.phase === ph; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- the tables ----------
        t = await pg.evaluate("""(() => { const stars = new Set(W_STARS.map(x => x.kind || x.id)), kinds = Object.keys(FA_NAMES).filter(k => !stars.has(k));
          const missing = kinds.filter(k => !wBL.pow[k] || !wBL.pow2[k] || !wBL.ult[k]);
          const ids = []; for (const T of [wBL.pow, wBL.pow2]) for (const k in T) T[k].forEach(P => ids.push(P.id)); for (const k in wBL.ult) ids.push(wBL.ult[k].id); for (const k in wBL.sit) ids.push(k); ids.push('steady');
          return { missing, n: ids.length, unique: new Set(ids).size === ids.length, dup: ids.filter((x, i) => ids.indexOf(x) !== i) }; })()""")
        check(not t['missing'] and t['unique'], 'every league kind has a strike power, a spare power, a second of each and an ultimate; every id is unique', t)
        s0 = await pg.evaluate("""(() => { const a = wBL.start({ seed: 1 }); const off = !a.powers; const G = wBL.start({ seed: 1, powers: true }); return { off, mana: G.mana, roar: G.roar }; })()""")
        check(s0['off'] and s0['mana'] == [2, 2] and s0['roar'] == [0, 0], 'no powers unless asked; with them, mana to start and no roar', s0)

        # ---------- mana and the roar ----------
        mr = await pg.evaluate("""(() => { const G = wBL.start({ seed: 2, powers: true }), R = wBL.roarRules, M = wBL.manaRules; G.mana = [0, 0];
          wBL.powersAfter(0, { strike: true }, [1,2,3,4,5,6,7,8,9,10], 1); const one = [G.mana[0], G.roar[0]];
          wBL.powersAfter(0, { strike: true }, [1,2,3,4,5,6,7,8,9,10], 2); const two = G.roar[0] - one[1];
          wBL.powersAfter(0, { strike: true }, [1,2,3,4,5,6,7,8,9,10], 3); const three = G.roar[0] - one[1] - two;
          const m0 = G.mana[0], r0 = G.roar[0]; wBL.powersAfter(0, { spare: true }, [7, 10], 0); const split = [G.mana[0] - m0, G.roar[0] - r0];
          return { one, two, three, split, R, M }; })()""")
        R, M = mr['R'], mr['M']
        check(mr['one'] == [M['strike'], R['strike']] and mr['two'] == R['strike'] + R['double'] and mr['three'] == R['strike'] + R['turkey'], 'a strike fills mana and a little roar; a double more, a turkey more', mr)
        check(mr['split'] == [M['spare'] + M['split'], R['splitMade']], 'a split made fills mana twice over, and the most roar', mr['split'])

        # ---------- casting ----------
        c = await pg.evaluate("""(() => { const out = {}; let G = wBL.start({ seed: 3, powers: true, teams: [__team(['dwarf', 'gorgon', 'vampire', 'elf', 'zombie']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf', 'dwarf'])], order: [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4]] });
          const P = wBL.powNow(0, 0); out.p = [P.which, P.id, P.cost]; out.cast = wBL.cast(0, 'pow', 0); out.mana = G.mana[0]; out.fx = wBL.fxFor(0).err; out.again = wBL.cast(0, 'pow', 0); out.notYours = wBL.cast(1, 'pow', 0);
          wBL.turn(); out.after = [G.fx[0], wBL.fxFor(0).err];
          G = wBL.start({ seed: 3, powers: true, teams: [__team(['gorgon', 'gorgon', 'gorgon', 'gorgon', 'gorgon']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf', 'dwarf'])] }); G.stand[0] = [7, 10]; G.rb[0] = 1; G.fr[0] = [[8]];
          out.stare = [wBL.cast(0, 'pow', wBL.bowler(0)), !!G.curse[1], wBL.fxFor(1).stone];
          G = wBL.start({ seed: 3, powers: true, teams: [__team(['vampire', 'vampire', 'vampire', 'vampire', 'vampire']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf', 'dwarf'])] }); G.roar = [0, 50];
          out.drain = [wBL.cast(0, 'pow', 0), G.roar.slice()];
          return out; })()""")
        check(c['p'] == ['strike', 'forged', 2] and c['cast'] == '' and c['mana'] == 0 and c['fx'] < 1 and c['again'] == 'One power a ball.' and c['notYours'] == 'Not your ball.', 'the bowler\'s strike power costs mana and works on their ball; one a ball; only on your ball', c)
        check(c['after'][0] is None and c['after'][1] == 1, 'it is spent on the ball', c['after'])
        check(c['stare'][0] == '' and c['stare'][1] and c['stare'][2] == 1, 'a gorgon\'s Stare at a spare is a curse on the other side\'s next ball: a stone pin', c['stare'])
        check(c['drain'] == ['', [20, 30]], 'a Drain takes 20 of their roar at once', c['drain'])
        u = await pg.evaluate("""(() => { const out = {}; const G = wBL.start({ seed: 4, powers: true, teams: [__team(['wraith', 'wraith', 'wraith', 'wraith', 'wraith']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf', 'dwarf'])] }); G.roar = [100, 0];
          out.cast = wBL.cast(0, 'ult'); out.mark = wBL.mark.n; out.them = wBL.fxFor(1).err; out.us = wBL.fxFor(0).err; out.twice = wBL.cast(0, 'ult');
          wBL.roll(0, 3); wBL.roll(0, 4); out.still = !!wBL.mark; G.mana[1] = 0;
          // (the mark goes when both sides have bowled the frame: powersAfter is the ball's end)
          wBL.roll(1, 3); wBL.roll(1, 4); wBL.powersAfter(1, { done: true }, [1], 0); out.gone = wBL.mark;
          out.steadyEarly = wBL.powWhy(0, 'steady');
          const G2 = wBL.start({ seed: 4, powers: true }); G2.roar = [100, 0]; wBL.roll(0, 3); out.mid = wBL.powWhy(0, 'ult');
          return out; })()""")
        check(u['cast'] == '' and u['mark'] == 'Haunting' and u['them'] > 1 and u['us'] == 1 and u['twice'] == 'Once a game.', 'the ultimate marks the frame (a wraith\'s Haunting makes their balls wilder), once a game', u)
        check(u['still'] and u['gone'] is None, 'the mark lasts until both sides have bowled the frame', u)
        check('last frame' in u['steadyEarly'] and 'first ball' in u['mid'], 'Steady only in the last frame; the ultimate only before a frame\'s first ball', u)
        sit = await pg.evaluate("""(() => { const out = {}; let G = wBL.start({ seed: 5, powers: true, frames: 10 }); G.mana = [6, 6];
          out.clean0 = wBL.powWhy(0, 'clean'); for (let i = 0; i < 14; i++) { wBL.roll(wBL.up(), 10); } out.clean = wBL.powWhy(0, 'clean'); out.rolloff = wBL.powWhy(0, 'rolloff');
          for (let i = 0; i < 4; i++) wBL.roll(wBL.up(), 10); out.frame = wBL.frameNo(0); out.fill0 = wBL.powWhy(0, 'fill'); wBL.roll(0, 10); out.fill = wBL.powWhy(0, 'fill');
          const ri = wBL.bowler(0); G.arm[0][ri] = .3; wBL.cast(0, 'fill'); out.arm = wBL.arm[0][ri]; return out; })()""")
        check(sit['clean0'] != '' and sit['clean'] == '' and sit['rolloff'] != '', 'Clean Game from the 8th frame with no open frame (not before); Roll-off only in a roll-off', sit)
        check(sit['frame'] == 10 and sit['fill0'] != '' and sit['fill'] == '' and sit['arm'] == 1, 'the Fill in the last frame after a strike: the bowler\'s arm back', sit)

        # ---------- the effects ----------
        fx = await pg.evaluate("""(() => { const all = [1,2,3,4,5,6,7,8,9,10], m = Math.tan(4.6 * Math.PI / 180), v = 16.5 * 17.6, N = 60;
          const rate = (b, extra) => { let st = 0; for (let s = 0; s < N; s++) if (wBL.deck(all, Object.assign({ x: wBL.boardX(b), m, v, spin: .4, hand: 1, mass: 15 }, extra), s * 7919 + 13).down.length === 10) st++; return st / N; };
          const H = wBL.house(), off = wBL.ball({ x0: wBL.boardX(18), ang: -4.5, mph: 17, rpm: 350, hand: 1 }, H, 'mid'), web = wBL.ball({ x0: wBL.boardX(18), ang: -4.5, mph: 17, rpm: 350, hand: 1, web: true }, H, 'mid');
          const plain = wBL.ball({ x0: wBL.boardX(18), ang: -1.4, mph: 17, rpm: 350, hand: 1 }, H, 'mid'), hex = wBL.ball({ x0: wBL.boardX(18), ang: -1.4, mph: 17, rpm: 350, hand: 1, oilK: 1.35 }, H, 'mid');
          return { light: [rate(16, {}), rate(16, { ghost: [1] })], stone: [rate(17.5, {}), rate(17.5, { stone: 1 })], web: [off.gutter, web.gutter, web.webbed], hex: [plain.skid, hex.skid] }; })()""")
        check(fx['light'][1] > fx['light'][0] + .3, 'a Ghost Ball saves a light ball', fx['light'])
        check(fx['stone'][1] < fx['stone'][0], 'a stone pin is harder to topple', fx['stone'])
        check(fx['web'][0] is not None and fx['web'][1] is None and fx['web'][2], 'a web catches a gutter ball and sets it back on the lane', fx['web'])
        check(fx['hex'][1] > fx['hex'][0], 'a Hex makes the ball skid long', fx['hex'])
        cp = await pg.evaluate("""(() => { let n = [0, 0], only = true; for (let i = 0; i < 12; i++) { wBL.start({ seed: 40 + i, powers: true, skill: [1, 2], powOnly: [null, 'arrowline'], teams: [__team(['dwarf', 'gorgon', 'wraith', 'zombie', 'spider']), __team(['elf', 'elf', 'elf', 'elf', 'elf'])] });
            while (wBL.turn()); for (const c of wBL.casts) { n[c.side]++; if (c.side === 1 && c.id !== 'arrowline') only = false; } } return { n, only }; })()""")
        check(cp['n'][0] >= 24 and cp['only'], 'the CPU casts (a Knight a few powers a game), and powOnly holds a side to the one power', cp)

        # ---------- the page ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['zombie', 'spider', 'gorgon', 'wraith']; let i = 0; while (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind: kinds[i++ % 4], lvl: 2 }, 'tavern')); wFiveAuto(); })()")
        await pg.evaluate("wOpenCamp('lanes')")
        await pg.wait_for_selector('#wCampBody .wlanesfive')
        pk = await pg.evaluate("""(() => { const b = $('wCampBody'), sels = b.querySelectorAll('.wlanesfive [data-npw]'), s = sels[0], k = +s.closest('[data-nid]').dataset.nid; s.value = '1'; s.dispatchEvent(new Event('change'));
          const p = wPlayer(k), m = wLanesPlayer(p); return { n: sels.length, pw: p.blPw, m: m.pw }; })()""")
        check(pk['n'] == 10 and pk['pw']['strike'] == 1 and pk['m'] == {'strike': 1, 'spare': 0}, 'the Lanes tab picks each bowler\'s strike and spare power, and the pick reaches the engine', pk)
        await pg.evaluate("WCAMP.close && WCAMP.close()")
        pr = await pg.evaluate("""(() => { wLanesGame({ seed: 21, mode: 'play' }); wBL.pause(true); __to('aim'); const G = wBL.G; G.mana[0] = 6;
          wLanesRows(); const row = $('wLanesRowPow'), vis = !row.hidden, txt = row.textContent, ult = row.querySelector('[data-npow="ult"]'); return { powers: G.powers, vis, mana: /Mana 6/.test(txt), ultOff: !!ult && ult.disabled }; })()""")
        check(pr['powers'] and pr['vis'] and pr['mana'] and pr['ultOff'], 'every game at the Lanes has powers: the Powers row on your ball, with the mana, and the ultimate shut until the roar is up', pr)
        await pg.evaluate("wBL.pause(false)")
        await pg.keyboard.press('p')
        kp = await pg.evaluate("({ casts: wBL.casts.length, mana: wBL.mana[0] })")
        check(kp['casts'] == 1 and kp['mana'] < 6, 'P casts the bowler\'s power', kp)
        mg = await pg.evaluate("""(() => { wLanesGame({ seed: 22, mode: 'manage' }); wBL.pause(true); wLanesRows(); const b = $('wLanesRowPow').querySelector('[data-nauto]'); const on0 = wBL.autoPow; b.click(); return { vis: !$('wLanesRowPow').hidden, on0, on1: wBL.autoPow }; })()""")
        check(mg == {'vis': True, 'on0': True, 'on1': False}, 'Manage: Auto powers, on to start, and the button turns it off', mg)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(($('wLanesHow') || {}).textContent || '').includes('Powers.')")
        check(hp, 'How to play explains the powers', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
