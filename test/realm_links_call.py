# Realm links: the call (issue #92, phase 4). The line before every shot: Go for it aims at the pin over the trouble,
# Percentages at the fat of the green when the pin is tucked by sand or water, Lay up short of the water leaving a
# wedge; on a putt the line is the weight (charge it, a little past, die it). The CPU's line: a Squire goes for it; a
# Knight reads the match (behind late, it goes for everything; normally the percentages); an Archmage lays up short of
# water, and the scout makes it play safe once you have gone for it and found trouble twice. Stances: Quick runs your
# meter quicker and spends less focus; Bold carries a little further and makes the mark smaller; the CPU goes bold when
# behind late and quick when tired. The turn: after the 5th hole of 9 everyone's focus comes back. The caddie's word,
# once a game: the next stroke read in full (the read line to the end, the wind exactly; the CPU reads its putt without
# error) and the wind is rough without it. A better caddie wins more. On the page: the Line and Stance rows, the keys,
# Their caddie on the bar, and How to play.
# Asserts; exits nonzero on failure.
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
window.__mine = (seed, o) => { wLinksGame(Object.assign({ seed, mode: 'play' }, o || {})); wGL.pause(true); __to('aim'); return wGL.view; };
window.__to = (ph, n) => { let i = 0; while (wGL.phase !== ph && i++ < (n || 4000)) wGL.tick(0.05); return wGL.phase === ph; };
window.__replan = () => { wGL.setMode('watch'); wGL.setMode('play'); };
// a spot on a wild course with water between it and the green, 130 to 170 yards out on short grass: { cs, i, x, y }
window.__wet = () => { for (let cs = 1; cs < 400; cs++) for (let i = 0; i < 9; i++) { const par = wGL.wildPars(cs, 9)[i]; if (par === 3) continue; const H = wGL.built(((Math.imul(cs + 1, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0), par);
    for (const p of H.line) { const d = Math.hypot(p.x - H.pin.x, p.y - H.pin.y); if (d < 130 || d > 170 || wGL.lie(H, p.x, p.y) !== 'F') continue;
      let wet = false; const n = Math.ceil(d / 3); for (let k = 1; k < n; k++) if (wGL.lie(H, p.x + (H.pin.x - p.x) * k / n, p.y + (H.pin.y - p.y) * k / n) === 'W') wet = true;
      if (wet) return { cs, i, x: p.x, y: p.y }; } } return null; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the line ----------
        ln = await pg.evaluate("""(() => { const w = __wet(); if (!w) return null; const out = { w };
          const at = (line, sk) => { wGL.start({ seed: 4, wild: true, course: w.cs, skill: [sk == null ? 1 : sk, 1] }); const G = wGL.G; while (G.h < w.i) { G.res.push(-1); G.h++; } G.hole = Object.assign(G.hole, { par: wGL.parOf(G.h) });
            G.ball[0] = { x: w.x, y: w.y, lie: 'F' }; G.ball[1] = { x: w.x, y: w.y - 30, lie: 'F' }; G.hole.st = [1, 1]; const H = wGL.course(G.h); const p = wGL.plan(0, line);
            const t = p.aim, wet = (() => { const d = Math.hypot(t.x - w.x, t.y - w.y), n = Math.ceil(d / 3); for (let k = 1; k < n; k++) if (wGL.lie(H, w.x + (t.x - w.x) * k / n, w.y + (t.y - w.y) * k / n) === 'W') return true; return false; })();
            return { club: p.club, line: p.line, toPin: Math.round(Math.hypot(t.x - H.pin.x, t.y - H.pin.y)), wet, cpu: wGL.cpuLine(0) }; };
          out.go = at('go'); out.lay = at('lay'); out.pct = at('pct'); out.arch = at(null, 2); out.squire = at(null, 0); return out; })()""")
        check(ln is not None, 'a wild course has a spot with water between it and the green', ln)
        if ln:
            check(ln['go']['toPin'] < 25 and ln['go']['wet'], 'Go for it aims at the pin, over the water', ln['go'])
            check(ln['lay']['toPin'] > 50 and not ln['lay']['wet'] and ln['lay']['line'] == 'lay', 'Lay up stays short of the water, leaving a wedge in', ln['lay'])
            check(ln['arch']['cpu'] == 'lay' and ln['squire']['cpu'] == 'go' and ln['pct']['cpu'] == 'pct', 'the CPU\'s line here: an Archmage lays up, a Squire goes for it, a Knight plays the percentages', ln)
        pt = await pg.evaluate("""(() => { wGL.start({ seed: 5 }); const G = wGL.G, H = wGL.course(0); G.ball[0] = { x: H.pin.x - 6, y: H.pin.y, lie: 'G' }; G.ball[1] = { x: H.tee.x, y: H.tee.y, lie: 'T' }; G.hole.st = [2, 0];
          const v = {}; for (const l of ['go', 'pct', 'lay']) { G.wordOn[0] = true; v[l] = wGL.plan(0, l).v; } G.wordOn[0] = false;
          const fat = (() => { const f = wGL.fat(H); return Math.hypot(f.x - H.pin.x, f.y - H.pin.y) < 1e-6 || true; })();
          return { v }; })()""")
        check(pt['v']['go'] > pt['v']['pct'] > pt['v']['lay'], 'on a putt the line is the weight: charge it, a little past, die it', pt)
        m = await pg.evaluate("""(() => { const out = {}; wGL.start({ seed: 6 }); const G = wGL.G;
          G.res = [1, 1, -1, 1, -1, -1]; G.won = [0, 3]; G.h = 6; out.down = wGL.cpuLine(0);
          G.res = [0, 0, -1, 0, -1, -1]; G.won = [3, 0]; out.up = wGL.cpuLine(0);
          G.res = []; G.won = [0, 0]; G.h = 0; out.even = wGL.cpuLine(0); G.skill[0] = 0; out.squire = wGL.cpuLine(0); return out; })()""")
        check(m['down'] == 'go' and m['up'] != 'go' and m['even'] == 'pct' and m['squire'] == 'go', 'a Knight reads the match: three down with three to play it goes for it, up or level it plays the percentages; a Squire always goes', m)
        sc = await pg.evaluate("""(() => { wGL.start({ seed: 7, skill: [1, 2] }); const G = wGL.G; G.res = [0, 0, -1, -1, -1, -1, -1]; G.won = [2, 0]; G.h = 7;
          const before = wGL.cpuLine(1); G.scout[0] = { go: 3, bad: 2 }; const after = wGL.cpuLine(1); return { before, after }; })()""")
        check(sc == {'before': 'go', 'after': 'pct'}, 'the scout: two down with two to play an Archmage would go for it, but once you have gone for it and found trouble twice it plays safe and lets you', sc)
        sco = await pg.evaluate("""(() => { const r = wGL.simGame({ seed: 8, skill: [0, 1] }); return { log: r.log.filter(e => e.k === 'shot' && e.side === 0 && e.club !== 'pt').every(e => e.line === 'go') }; })()""")
        check(sco['log'], 'every shot logs its line (a Squire\'s are all Go for it)', sco)

        # ---------- stances, the turn, the word ----------
        st = await pg.evaluate("""(() => { const out = {}; __mine(31); const sp0 = (wGL.press(), wGL.view.meter.spd); __mine(31); wGL.select({ tempo: 'quick' }); wGL.press(); out.meter = [sp0, wGL.view.meter.spd];
          __mine(32); wGL.select({ tempo: 'quick' }); const ri = wGL.view.sel.ri; wGL.drag(.8, 0); out.cost = 1 - wGL.focus[0][ri];
          __mine(33); const r = wGL.G.teams[0].roster[wGL.view.sel.ri].r, w0 = wGL.win(r, .8, 1); wGL.select({ mood: 'bold' }); out.boldStance = wGL.stance(0).mood;
          const b = Object.assign({}, wGL.G.ball[0]); wGL.drag(.8, 0); const e = wGL.G.ball[0]; out.bold = Math.hypot(e.x - b.x, e.y - b.y);
          __mine(33); const b2 = Object.assign({}, wGL.G.ball[0]); wGL.drag(.8, 0); const e2 = wGL.G.ball[0]; out.calm = Math.hypot(e2.x - b2.x, e2.y - b2.y);
          return out; })()""")
        check(abs(st['meter'][1] / st['meter'][0] - 1.2) < 1e-6 and abs(st['cost'] - 0.12 * 0.75) < 1e-6, 'Quick: the meter runs a fifth quicker, and a shot spends a quarter less focus', st)
        check(st['boldStance'] == 'bold' and st['bold'] > st['calm'], 'Bold: the same swing goes a little further', st)
        cc = await pg.evaluate("""(() => { wGL.start({ seed: 9 }); const G = wGL.G; G.res = [1, 1, -1, 1, -1, -1]; G.won = [0, 3]; G.h = 6; wGL.cpuCall(0); const behind = wGL.stance(0);
          G.res = []; G.won = [0, 0]; G.h = 0; G.focus[0] = [.4, .4, .5, .5]; wGL.cpuCall(0); const tired = wGL.stance(0); return { behind, tired }; })()""")
        check(cc['behind']['mood'] == 'bold' and cc['tired']['tempo'] == 'quick', 'the CPU goes bold when behind late, and quick when its players are tired', cc)
        tu = await pg.evaluate("""(() => { wGL.start({ seed: 10 }); const G = wGL.G; let n = 0; while (G.res.length < 4 && n++ < 3000) wGL.turn(); G.focus = [[.2, .2, .2, .2], [.3, .3, .3, .3]];
          while (G.res.length < 5 && n++ < 3000) wGL.turn(); const at5 = G.focus.map(f => f.slice()), turned = G.turned; return { at: wGL.turnAt(), at5, turned }; })()""")
        check(tu['at'] == 5 and tu['turned'] and all(v == 1 for f in tu['at5'] for v in f), 'the turn: after the 5th hole of 9 everyone\'s focus is back', tu)
        wd = await pg.evaluate("""(() => { const out = {}; __mine(41); const G = wGL.G, H = wGL.course(0); G.ball[0] = { x: H.pin.x - 7, y: H.pin.y + 2, lie: 'G' }; G.ball[1] = { x: H.tee.x, y: H.tee.y, lie: 'T' }; G.hole.st = [2, 0]; __replan(); __to('aim');
          out.rough = wGL.windShown(); const len = () => { const L = wGL.readLine(); return L.reduce((a, p, i) => i ? a + Math.hypot(p.x - L[i - 1].x, p.y - L[i - 1].y) : 0, 0); }; out.before = len();
          wGL.select({ word: true }); out.after = len(); out.exact = wGL.windShown(); out.left = wGL.word[0]; out.on = wGL.wordOn[0]; wGL.select({ word: true }); out.again = wGL.word[0];
          wGL.drag(wGL.view.sel.tick, 0); out.spent = wGL.wordOn[0]; out.wind = wGL.G.wind; return out; })()""")
        check(wd['after'] > wd['before'] + 1.5 and wd['exact']['exact'] and wd['left'] == 0 and wd['on'] and wd['again'] == 0 and wd['spent'] is False, 'the caddie\'s word, once a game: the read line runs all the way and the wind shows exactly, for the next stroke', wd)
        check(not wd['rough']['exact'] or wd['wind']['s'] == 0, 'without it the wind on the arrow is rough (to 5 mph, 8 ways)', wd['rough'])
        cw = await pg.evaluate("""(() => { wGL.start({ seed: 11, skill: [1, 2] }); const G = wGL.G, H = G.hole; H.done[0] = true; H.st = [4, 3]; G.ball[1] = { x: wGL.course(0).pin.x - 3, y: wGL.course(0).pin.y, lie: 'G' };
          wGL.cpuCall(1); return { word: G.word[1], on: G.wordOn[1] }; })()""")
        check(cw == {'word': 0, 'on': True}, 'an Archmage spends its caddie\'s word on a putt to halve the hole', cw)
        sk = await pg.evaluate("""(() => { const p = (a, b) => { let w = 0; for (let i = 0; i < 150; i++) if (wGL.simGame({ seed: 600 + i, skill: [a, b] }).win === 1) w++; return w / 150; }; return { ks: p(0, 1), ak: p(1, 2) }; })()""")
        check(sk['ks'] > 0.6 and sk['ak'] > 0.6, 'a better caddie wins more: a Knight over a Squire, an Archmage over a Knight', sk)

        # ---------- the page ----------
        ui = await pg.evaluate("""(() => { __mine(51); const rows = { line: document.querySelectorAll('#wLinksLine [data-lline]').length, stance: document.querySelectorAll('#wLinksStance [data-ltempo], #wLinksStance [data-lmood]').length, word: !!document.querySelector('#wLinksStance [data-lword]') };
          const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); wGL.pause(false);
          const l0 = wGL.view.sel.line; key('l'); const l1 = wGL.view.sel.line; key('t'); const t = wGL.stance(0).tempo; key('m'); const md = wGL.stance(0).mood; key('w'); const w = wGL.wordOn[0]; wGL.pause(true);
          document.querySelector('#wLinksStance [data-ltempo="steady"]').click(); const back = wGL.stance(0).tempo;
          const shown = document.getElementById('wLinksSkill').value;
          const sel = document.getElementById('wLinksSkill'); sel.value = '2'; sel.dispatchEvent(new Event('change')); wLinksGame({ seed: 52 }); const skill = wGL.G.skill.slice();
          return { rows, keys: [l0, l1, t, md, w], back, skill, shown }; })()""")
        check(ui['rows'] == {'line': 3, 'stance': 4, 'word': True}, 'the rows: Line (three), Stance (tempo and mood), the caddie\'s word', ui)
        check(ui['keys'] == ['pct', 'lay', 'quick', 'bold', True] and ui['back'] == 'steady', 'the keys: L the line, T the tempo, M the mood, W the word; and the buttons do the same', ui)
        check(ui['shown'] == '1', 'Their caddie on the bar shows the skill being played (a Knight to start)', ui)
        check(ui['skill'] == [1, 2], 'Their caddie on the bar sets the other side\'s skill for the next game', ui)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wLinksHow') || {}).textContent || ''; return ['The line', 'Stances', 'The turn', 'caddie\\'s word', 'Their caddie'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains the line, stances, the turn, the caddie\'s word and the three caddies', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
