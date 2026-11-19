# Realm lanes (issue #100, phase 4): the call and the read.
# The line moves where the bowler stands (deep inside further in, up the boards further out) and how true the ball goes
# (deep misses more, the boards less). On a split, convert goes at the front pin to slide it into the rest, safe at the
# bigger group. Stances: a heavy ball hits harder and costs more arm, a quick tempo costs less arm and runs the meter
# quicker. The coach's word: once a game, this ball's guide follows the oil as it is, and it is spent on the ball. The
# turn: the first ball after the halfway frame reads all the oil; otherwise a bowler reads as far as their read
# rating allows (a witch further than a troll). The CPU's call: a Squire always the pocket; a Knight deep when behind
# late, up the boards when well ahead, the word for the tenth; an Archmage deep once the track has dried or once it
# has scouted the same line, converts a baby split but not the 7-10, and pinches a spent anchor in the last frame.
# The page: the Line, Split, Stance and Pinch rows and their keys; the lane chart opens in a box and the game waits; a
# swipe that bends the way the ball hooks puts on more revs. How to play explains it. Asserts; exits nonzero on failure.
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
window.__team = (ks, r) => ({ name: ks.join(''), short: 'T', roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k, hand: 1 }, r ? { r: Object.assign(wBL.rate(k), r) } : {})) });
window.__five = () => __team(['dwarf', 'dwarf', 'dwarf', 'dwarf', 'dwarf']);
window.__tickTo = (pred, max) => { let n = 0; while (!pred() && n++ < (max || 4000)) wBL.tick(0.05); return pred(); };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- the line, the split, the stances ----------
        ln = await pg.evaluate("""(() => { const G = wBL.start({ seed: 2, teams: [__five(), __five()] }), x = {};
          for (const l of ['deep', 'pocket', 'boards']) { G.line[0] = l; x[l] = wBL.boardX ? wBL.xBoard(wBL.plan(0).x0) : 0; }
          const L = wBL.lines; return { x, err: [L.deep.err, L.pocket.err, L.boards.err] }; })()""")
        check(ln['x']['deep'] > ln['x']['pocket'] > ln['x']['boards'], 'the line moves where a right-hander stands: deep inside further in, up the boards further out', ln)
        check(ln['err'][0] > ln['err'][1] > ln['err'][2], 'deep misses more, the boards less', ln['err'])
        sp = await pg.evaluate("""(() => { const G = wBL.start({ seed: 2, teams: [__five(), __five()] }); G.stand[0] = [3, 10]; G.rb[0] = 1; G.fr[0] = [[8]];
          G.split[0] = 'safe'; const safe = wBL.plan(0); G.split[0] = 'convert'; const conv = wBL.plan(0); return { safe: [safe.aim.x, safe.why], conv: [conv.aim.x, conv.why] }; })()""")
        check(abs(sp['safe'][0] - -6) < .01 and sp['conv'][0] > sp['safe'][0] and 'convert' in sp['conv'][1] and 'safe' in sp['safe'][1], 'on the 3-10, safe aims at the 3; convert takes the 3 on its left to slide it into the 10', sp)
        stc = await pg.evaluate("""(() => { const S = wBL.stanceRules; return { mass: S.heavy.mass > S.light.mass, armH: S.heavy.arm > S.light.arm, quick: S.quick.arm < S.steady.arm && S.quick.meter > S.steady.meter }; })()""")
        check(stc == {'mass': True, 'armH': True, 'quick': True}, 'a heavy ball hits harder and costs more arm; a quick tempo costs less arm and runs the meter quicker', stc)

        # ---------- the word, the turn, the read ----------
        wd = await pg.evaluate("""(() => { wBL.start({ seed: 5, mode: 'play', teams: [__five(), __five()] }); wBL.pause(true);
          for (let i = 0; i < 16; i++) wBL.turn();
          __tickTo(() => wBL.phase === 'aim'); const fresh = JSON.stringify(wBL.guide().path.slice(-3));
          const a = wBL.select({ word: true }), on = wBL.wordOn[0], now = JSON.stringify(wBL.guide().path.slice(-3)), b = wBL.select({ word: true }), left = wBL.word[0];
          wBL.press(); __tickTo(() => wBL.view.meter.v >= 1); wBL.press(); __tickTo(() => wBL.view.meter.v <= 0); wBL.press();
          return { a, on, moved: fresh !== now, b, left, after: wBL.wordOn[0] }; })()""")
        check(wd['a'] is True and wd['on'] and wd['moved'] and wd['left'] == 0, 'the coach\'s word: this ball\'s guide follows the oil as it is', wd)
        check(isinstance(wd['b'], str) and not wd['after'], 'once a game, and spent on the ball', wd)
        rd = await pg.evaluate("""(() => { const G = wBL.start({ seed: 6, teams: [__team(['witch', 'witch', 'witch', 'witch', 'witch']), __team(['troll', 'troll', 'troll', 'troll', 'troll'])] });
          const r = [wBL.readFt(0), wBL.readFt(1)]; for (let i = 0; i < 10; i++) { wBL.roll(wBL.up(), 3); wBL.roll(wBL.up(), 4); }
          return { r, frame: wBL.frameNo(0), turn: wBL.turnBall(0), ft: wBL.readFt(0), next: (() => { wBL.roll(0, 3); return wBL.turnBall(0); })() }; })()""")
        check(rd['r'][0] > rd['r'][1] and rd['r'][1] >= 25, 'a witch reads the oil further down the lane than a troll', rd)
        check(rd['frame'] == 6 and rd['turn'] and rd['ft'] == 60 and not rd['next'], 'the turn: the first ball after the halfway frame reads all of it', rd)

        # ---------- the CPU's call ----------
        cc = await pg.evaluate("""(() => { const out = {}; const set = (sk, gap) => { const G = wBL.start({ seed: 7, skill: [sk, 1], teams: [__five(), __five()] });
            for (let i = 0; i < 12; i++) { wBL.roll(wBL.up(), 4); wBL.roll(wBL.up(), 4); }
            for (let f = 0; f < 5; f++) G.fr[1][f] = gap > 0 ? [10] : [0, 0]; return G; };
          let G = set(0, 1); wBL.cpuCall(0); out.squire = G.line[0];
          G = set(1, 1); wBL.cpuCall(0); out.behind = G.line[0];
          G = set(1, -1); wBL.cpuCall(0); out.ahead = G.line[0];
          G = wBL.start({ seed: 7, skill: [1, 1], teams: [__five(), __five()] }); for (let i = 0; i < 36; i++) wBL.roll(wBL.up(), 4 - (i % 2) * 4); const w0 = G.word[0]; const said = wBL.cpuCall(0); out.word = [w0, G.word[0], G.wordOn[0], said];
          return out; })()""")
        check(cc['squire'] == 'pocket' and cc['behind'] == 'deep' and cc['ahead'] == 'boards', 'a Squire plays the pocket; a Knight goes deep when behind late, up the boards when well ahead', cc)
        check(cc['word'][0] == 1 and cc['word'][1] == 0 and cc['word'][2] and 'word' in cc['word'][3], 'a Knight takes the coach\'s word for the tenth\'s first ball', cc['word'])
        am = await pg.evaluate("""(() => { const out = {}; let G = wBL.start({ seed: 9, skill: [2, 1], teams: [__five(), __five()] });
          wBL.cpuCall(0); out.fresh = G.line[0];
          G.scout[0] = { same: 3, lane: wBL.lane(0), board: 14 }; wBL.cpuCall(0); out.scout = G.line[0];
          G = wBL.start({ seed: 9, skill: [2, 1], teams: [__five(), __five()] }); const lane = wBL.lane(0), path = []; for (let y = 0; y <= 720; y += 12) path.push([wBL.boardX(9), y]);
          for (let i = 0; i < 40; i++) G.oil[lane] = wBL.wear(G.oil[lane], path); out.dry = wBL.trackDry(lane, 1); wBL.cpuCall(0); out.dryLine = G.line[0];
          G.stand[0] = [3, 10]; G.rb[0] = 1; G.fr[0] = [[8]]; wBL.cpuCall(0); out.baby = G.split[0]; G.stand[0] = [7, 10]; wBL.cpuCall(0); out.big = G.split[0];
          return out; })()""")
        check(am['fresh'] == 'pocket' and am['scout'] == 'deep', 'an Archmage plays the pocket on a fresh lane, and goes deep once it has scouted the same line on it', am)
        check(am['dry'] and am['dryLine'] == 'deep', 'an Archmage goes deep once the track has dried', am)
        check(am['baby'] == 'convert' and am['big'] == 'safe', 'an Archmage converts the 3-10, and plays the 7-10 safe', am)
        pn = await pg.evaluate("""(() => { const G = wBL.start({ seed: 9, skill: [2, 1], teams: [__five(), __five()] }); for (let i = 0; i < 36; i++) wBL.roll(wBL.up(), 4 - (i % 2) * 4);
          const ri = wBL.bowler(0); G.arm[0] = [1, 1, 1, 1, 1]; G.arm[0][ri] = .3; const said = wBL.cpuCall(0); return { was: ri, now: wBL.bowler(0), said, used: G.pinched[0] }; })()""")
        check(pn['now'] != pn['was'] and pn['used'] and 'bowls for' in pn['said'], 'an Archmage sends in a fresher pinch bowler for a spent anchor in the last frame', pn)

        # ---------- the page ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        rw = await pg.evaluate("""(() => { wLanesGame({ seed: 11, mode: 'play', teams: [__five(), __five()] }); wBL.pause(true); __tickTo(() => wBL.phase === 'aim');
          const vis = id => !$(id).hidden; const r = { line: vis('wLanesRowLine'), split: vis('wLanesRowSplit'), stance: vis('wLanesRowStance'), pinch: vis('wLanesRowPinch'), pinchBtns: $('wLanesPinch').querySelectorAll('[data-npinch]').length, word: !!$('wLanesStance').querySelector('[data-nword]:not([disabled])') };
          const x0 = wBL.view.sel.stand; document.querySelector('[data-nline="deep"]').click(); r.deep = [wBL.line(0), wBL.view.sel.stand > x0]; return r; })()""")
        check(rw['line'] and not rw['split'] and rw['stance'] and rw['pinch'] and rw['pinchBtns'] == 4 and rw['word'], 'your first ball: the Line, Stance and Pinch rows (four to pinch with), no Split row', rw)
        check(rw['deep'] == ['deep', True], 'Deep inside puts the coach\'s deeper setup on your feet', rw['deep'])
        await pg.evaluate("wBL.pause(false)")
        for key in ['l', 't', 'h']:
            await pg.keyboard.press(key)
        ky = await pg.evaluate("({ line: wBL.line(0), st: wBL.stance(0) })")
        check(ky == {'line': 'pocket', 'st': {'tempo': 'quick', 'ball': 'light'}}, 'L cycles the line (deep, then the pocket), T the tempo, H the ball', ky)
        await pg.keyboard.press('c')
        await pg.wait_for_selector('#wLanesChartCv')
        ch = await pg.evaluate("""(() => { const cv = $('wLanesChartCv'), d = cv.getContext('2d').getImageData(cv.width / 4, cv.height / 2, 1, 1).data; const t0 = wBL.view.ph; return { drawn: d[3] > 0, ph: t0, open: !$('modal').hidden, tracks: wBL.tracks[0].length + wBL.tracks[1].length }; })()""")
        await pg.wait_for_timeout(300)
        held = await pg.evaluate("wBL.phase")
        await pg.click('#modal [data-close]')
        check(ch['drawn'] and ch['open'] and held == 'aim', 'C opens the lane chart, drawn, and the game waits', [ch, held])
        sw = await pg.evaluate("""(() => { const c = document.querySelector('#v-lanes canvas').getBoundingClientRect(), k = c.width / 960, sel = wBL.view.sel; wBL.select({ revs: 'normal' });
          const [bx, by] = wBL.scr(wBL.boardX(sel.stand), -26); return { x: c.left + bx * k, y: c.top + (by - 20) * k, k }; })()""")
        await pg.mouse.move(sw['x'], sw['y']); await pg.mouse.down()
        for i in range(1, 7): await pg.mouse.move(sw['x'], sw['y'] - 30 * i * sw['k'])
        for i in range(1, 7): await pg.mouse.move(sw['x'] - 12 * i * sw['k'], sw['y'] - (180 + 20 * i) * sw['k'])
        await pg.mouse.up()
        sr = await pg.evaluate("(() => { wBL.pause(true); return { ph: wBL.phase, revs: wBL.last && wBL.last.plan ? null : null, rpm: wBL.last.release.rpm, base: wBL.G.teams[0].roster[wBL.last.ri].style.rpm }; })()")
        check(sr['ph'] == 'roll' and sr['rpm'] > sr['base'], 'a swipe that bends left at the end (the way a right-hander\'s ball hooks) puts on more revs', sr)
        tk = await pg.evaluate("(() => { const n = wBL.G.n; return { n, tracks: wBL.tracks[0].length + wBL.tracks[1].length }; })()")
        check(tk['n'] > 0 and tk['tracks'] == tk['n'], 'every ball bowled is on the chart', tk)
        sp2 = await pg.evaluate("""(() => { wLanesGame({ seed: 12, mode: 'play', teams: [__five(), __five()] }); wBL.pause(true); __tickTo(() => wBL.phase === 'aim');
          const G = wBL.G; G.stand[0] = [3, 10]; G.rb[0] = 1; G.fr[0] = [[8]]; wLanesRows(); const vis = !$('wLanesRowSplit').hidden, line = $('wLanesRowLine').hidden, made = /can be made/.test($('wLanesSplit').textContent);
          document.querySelector('[data-nsplit="convert"]').click(); return { vis, line, made, split: wBL.split(0) }; })()""")
        check(sp2 == {'vis': True, 'line': True, 'made': True, 'split': 'convert'}, 'on a split the Split row shows (and says it can be made), and Convert takes it', sp2)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("['The line', 'Splits', 'Stances', 'The lane chart', 'Pinch', 'Their call.'].every(w => ($('wLanesHow') || {}).textContent.includes(w))")
        check(hp, 'How to play explains the line, splits, stances, the chart and the read, the pinch and their call', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
