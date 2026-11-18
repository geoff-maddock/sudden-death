# Realm links: powers (issue #92, phase 6). Every league kind has a long-game and a short-game power, a second of each,
# and an ultimate, every id unique. Team mana starts at GL_MANA.start and good shots fill it; a power costs mana, works
# on the hitter's stroke (or, a curse, on the other side's next one) and is gone after it; one a stroke. The roar pays
# for the ultimate (once a game, a mark on the rest of the hole: one set of effects for its side, another for the other)
# and steadies a stroke that wins or halves. Situation powers only when they fit: Dormie, Playoff, Up and down. In the
# model: a power through the branches drops a ball from the trees into the rough, one from the water brings it back
# with no stroke, a webbed cup can't lip out, a stone curse stops a ball where it lands, riding the wind takes it away.
# The CPU casts by skill; a side with powers beats one without more often than not, but not always. On the page: the
# Powers row (mana, the roar, the hitter's power, the ultimate, Steady, the tip), the keys, Auto powers in Manage, the
# hole card, the Links tab's second powers, and How to play.
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
window.__to = (ph, n) => { let i = 0; while (wGL.phase !== ph && i++ < (n || 4000)) wGL.tick(0.05); return wGL.phase === ph; };
window.__flat = (fill, slope) => { const rows = []; for (let r = 0; r < 100; r++) { let line = ''; for (let c = 0; c < 40; c++) {
    const x = (c + .5) * 5, y = (r + .5) * 5; line += Math.hypot(x - 100, y - 400) < 15 ? 'G' : (fill ? fill(x, y) : 'F'); } rows.push(line); }
  return { seed: 0, par: 4, len: 390, w: 40, h: 100, cell: 5, grid: rows, tee: { x: 100, y: 10 }, green: { x: 100, y: 400, rx: 15, ry: 15 }, pin: { x: 100, y: 400 },
    path: [{ x: 100, y: 10 }, { x: 100, y: 400 }], line: [], slope: slope || { a: 0, g: 0, w: 0, k: 0, p: 0 } }; };
// a game with powers: side 0 of these kinds (one each), side 1 even
window.__pg = (kinds, o) => wGL.start(Object.assign({ seed: 3, powers: true, teams: [{ kinds }, { kinds: ['dwarf', 'wraith', 'vampire', 'goblin'] }] }, o || {}));
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

        # ---------- the tables ----------
        t = await pg.evaluate("""(() => { const stars = new Set(W_STARS.map(x => x.kind || x.id)), kinds = Object.keys(FA_NAMES).filter(k => !stars.has(k));
          const miss = kinds.filter(k => !(wGL.pow[k] && wGL.pow[k].length === 2 && wGL.pow2[k] && wGL.pow2[k].length === 2 && wGL.ult[k]));
          const ids = []; for (const k in wGL.pow) for (const P of wGL.pow[k].concat(wGL.pow2[k])) ids.push(P.id); for (const k in wGL.ult) ids.push(wGL.ult[k].id); for (const k in wGL.sit) ids.push(k);
          const named = ['ridewind', 'stonedrive', 'webcup', 'hex', 'stare', 'throughtrunk', 'backdeep'].every(id => ids.includes(id));
          return { miss, n: ids.length, unique: new Set(ids).size === ids.length, named, desc: Object.values(wGL.pow).every(a => a.every(P => P.desc && P.n)) }; })()""")
        check(not t['miss'] and t['unique'] and t['named'] and t['desc'], 'every league kind has a long and a short power, a second of each and an ultimate; every id unique; the issue\'s own are there (ride the wind, Stone Drive, webbing the cup, the Hex, the Stare, through a tree, back from the water)', t)

        # ---------- mana, casting, the stroke ----------
        m = await pg.evaluate("""(() => { const G = __pg(['harpy', 'elf', 'witch', 'spider']), out = { start: G.mana.slice(), roar: G.roar.slice() };
          const P = wGL.powNow(0, 0); out.pow = [P.n, P.which, P.cost]; out.poor = wGL.powWhy(0, 'pow', 0);
          G.mana[0] = 4; const r = wGL.cast(0, 'pow', 0); out.cast = [r, G.mana[0], wGL.fxFor(0).wind, wGL.powWhy(0, 'pow', 0)];
          const e = wGL.turn(); out.after = [e.side, e.ri, !G.fx[0], wGL.fxFor(0).wind, e.lie, G.mana[0]];
          return out; })()""")
        check(m['start'] == [1, 1] and m['roar'] == [0, 0], 'mana starts at 1 a side, the roar at 0', m)
        check(m['pow'] == ['Ride the Wind', 'long', 2] and 'costs 2 mana' in m['poor'], 'the harpy\'s tee shot power is Ride the Wind, a long-game power for 2 mana (too dear at 1)', m)
        check(m['cast'][0] == '' and m['cast'][1] == 2 and m['cast'][2] == 0 and m['cast'][3] == 'One power a stroke.', 'cast: the mana goes, the stroke has no wind, and one power a stroke', m)
        check(m['after'][0] == 0 and m['after'][2] and m['after'][3] == 1 and m['after'][5] == (3 if m['after'][4] == 'F' else 2), 'after the stroke the power is gone; a tee shot on the fairway earns a mana', m)
        cu = await pg.evaluate("""(() => { const G = __pg(['witch', 'elf', 'harpy', 'gorgon']); G.teams[0].roster[0].pw = { long: 1, short: 0 }; G.mana[0] = 4;
          const P = wGL.powNow(0, 0), r = wGL.cast(0, 'pow', 0); return { n: P.n, r, mine: wGL.fxFor(0).cross, theirs: wGL.fxFor(1).cross }; })()""")
        check(cu == {'n': 'Hex', 'r': '', 'mine': 0, 'theirs': 12}, 'a curse (the witch\'s second power, the Hex) puts a 12 mph crosswind on the other side\'s next stroke, not yours', cu)
        u = await pg.evaluate("""(() => { const G = __pg(['harpy', 'elf', 'witch', 'spider']); const poor = wGL.powWhy(0, 'ult', 0); G.roar[0] = 70; const r = wGL.cast(0, 'ult', 0);
          const roar = G.roar[0], mark = wGL.mark, mine = wGL.fxFor(0).wind, theirs = wGL.fxFor(1).wind, again = wGL.powWhy(0, 'ult', 0); let n = 0; const h = G.h; while (G.h === h && n++ < 200) wGL.turn();
          return { poor, r, roar, mark: mark && [mark.id, mark.side, mark.h], mine, theirs, again, next: wGL.fxFor(0).wind }; })()""")
        check('60 roar' in u['poor'] and u['r'] == '' and u['roar'] == 10 and u['mark'] == ['stormwing', 0, 0], 'the ultimate takes 60 roar: the harpy\'s Storm Wing marks the hole', u)
        check(u['mine'] == 0 and u['theirs'] == 1.5 and u['again'] == 'Once a game.' and u['next'] == 1, 'the mark: no wind on your strokes and half again on theirs, for the rest of the hole only; once a game', u)
        st = await pg.evaluate("""(() => { const G = __pg(['dwarf', 'elf', 'witch', 'spider']), H = G.hole; const none = wGL.powWhy(0, 'steady'); H.done[1] = true; H.st = [3, 4]; G.roar[0] = 30;
          const p0 = wGL.pressure(0), r = wGL.cast(0, 'steady'); return { none, p0, r, nerve: wGL.fxFor(0).nerve, roar: G.roar[0] }; })()""")
        check('Nothing riding' in st['none'] and st['p0'] == 1 and st['r'] == '' and st['nerve'] == 1 and st['roar'] == 5, 'Steady: 25 roar takes the pressure off a stroke that wins or halves (and only then)', st)
        si = await pg.evaluate("""(() => { const G = __pg(['dwarf', 'elf', 'witch', 'spider']); G.mana[0] = 5; const out = { early: wGL.powWhy(0, 'dormie'), po: wGL.powWhy(0, 'playoff'), ud: wGL.powWhy(0, 'updown') };
          G.res = [1, -1, -1, -1, -1, -1, -1, -1]; G.won = [0, 1]; G.h = 8; G.focus[0] = [.2, .3, .4, .5]; out.dormie = wGL.cast(0, 'dormie'); out.focus = G.focus[0].slice(); out.twice = wGL.powWhy(0, 'dormie');
          G.res = [0, 1, -1, -1, -1, -1, -1, -1, -1]; G.won = [1, 1]; G.h = 9; out.playoff = wGL.cast(0, 'playoff'); out.err = wGL.fxFor(0).err; return out; })()""")
        check('one down with one to play' in si['early'] and 'playoff' in si['po'] and 'close by' in si['ud'], 'situation powers only when they fit', si)
        check(si['dormie'] == '' and si['focus'] == [1, 1, 1, 1] and si['twice'] == 'Once a game.' and si['playoff'] == '' and si['err'] == 0.5, 'Dormie gives everyone their focus back (once); Playoff halves the next swing\'s miss', si)

        # ---------- in the model ----------
        md = await pg.evaluate("""(() => { const shot = (H, o) => wGL.flight(Object.assign({ hole: H, from: { x: 100, y: 10 }, lie: 'T', club: 'mi', aim: { x: 100, y: 300 }, pow: 1, err: 0, rat: { pow: .5, scr: .5 } }, o));
          const Ht = __flat((x, y) => y > 140 && y < 175 ? 'O' : 'F'), Hw = __flat((x, y) => y > 150 && y < 175 ? 'W' : 'F');
          const trees = [shot(Ht, {}).lie, shot(Ht, { trees: 1 }).lie], water = shot(Hw, { water: 1 }), wet = shot(Hw, {});
          const H = __flat(), roll = [shot(H, {}).roll, shot(H, { rollK: 0 }).roll];
          const Hs = __flat(), from = { x: 100, y: 398.5 }, fast = { hole: Hs, from, a: Math.PI / 2, v: 3.1 };
          return { trees, water: [water.water, water.saved, water.lie !== 'W'], wet: wet.water, roll, lip: [wGL.putt(fast).holed, wGL.putt(Object.assign({ lip: 2 }, fast)).holed] }; })()""")
        check(md['trees'] == ['O', 'R'] and md['water'] == [False, True, True] and md['wet'], 'through the branches the ball drops into the rough; from the water it comes back with no stroke', md)
        check(md['roll'][0] > 0 and md['roll'][1] == 0 and md['lip'] == [False, True], 'a stone curse stops the ball where it lands; a webbed cup takes a putt that would have lipped out', md)

        # ---------- the CPU, and what powers are worth ----------
        cp = await pg.evaluate("""(() => { const T = [{ kinds: ['dwarf', 'wraith', 'vampire', 'goblin'] }, { kinds: ['dwarf', 'wraith', 'vampire', 'goblin'] }];
          const casts = sk => { let n = 0; for (let i = 0; i < 80; i++) n += wGL.simGame({ seed: 300 + i, teams: T, powers: true, skill: [sk, sk] }).casts.filter(c => c.k === 'pow').length; return n / 80; };
          let w = 0; for (let i = 0; i < 200; i++) if (wGL.simGame({ seed: 500 + i, teams: T, powers: [true, false] }).win === 0) w++;
          return { squire: casts(0), knight: casts(1), arch: casts(2), oneSide: w / 200 }; })()""")
        check(cp['knight'] > 2 and cp['arch'] < cp['knight'] and cp['squire'] > 0, 'the CPU casts by skill: a Knight on the shots that matter, an Archmage less (saving it), a Squire now and then', cp)
        check(0.52 < cp['oneSide'] < 0.78, 'a side with powers beats one without more often than not, but not always', cp)

        # ---------- the page ----------
        ui = await pg.evaluate("""(() => { const kinds = ['harpy', 'spider', 'golem']; let i = 0; while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern')); wFourAuto();
          wLinksGame({ seed: 71, mode: 'play' }); wGL.pause(true); __to('aim'); const G = wGL.G; G.mana[0] = 4; wLinksRows();
          const row = document.getElementById('wLinksRowPow'), btns = [...row.querySelectorAll('[data-lpow]')].map(b => b.dataset.lpow), text = row.textContent;
          const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); wGL.pause(false); key('p'); const castN = wGL.casts.length; wGL.pause(true);
          return { shown: !row.hidden, btns, mana: /Mana/.test(text), roar: /Roar/.test(text), castN, powers: G.powers }; })()""")
        check(ui['powers'] and ui['shown'] and 'pow' in ui['btns'] and 'ult' in ui['btns'] and 'steady' in ui['btns'] and ui['mana'] and ui['roar'], 'the Powers row: mana and the roar, the hitter\'s power, the ultimate and Steady', ui)
        check(ui['castN'] == 1, 'P casts the hitter\'s power', ui)
        mg = await pg.evaluate("""(() => { wLinksGame({ seed: 72, mode: 'manage' }); wGL.pause(true); let i = 0; while (i++ < 30) wGL.tick(0.05); wLinksRows(); const b = document.querySelector('[data-lauto]');
          const on = wGL.autoPow; b.click(); return { has: !!b, on, off: wGL.autoPow }; })()""")
        check(mg == {'has': True, 'on': True, 'off': False}, 'Manage has Auto powers, on to start, and it turns off', mg)
        lt = await pg.evaluate("""(() => { wLeaveLinks(); wOpenCamp('links'); const s = document.querySelector('#wCampBody .wlinksfour [data-gpw="long"]'), k = s.closest('[data-gid]').dataset.gid; s.value = '1'; s.dispatchEvent(new Event('change'));
          const p = wFourWho(/^g\\d+$/.test(k) ? k : +k), T = wFourMine(), at = wGL.roles.findIndex(r => WG.links.four[r] === (/^g\\d+$/.test(k) ? k : +k)); document.getElementById('modal').hidden = true;
          return { pw: p.glPw, eng: T.roster[at].pw }; })()""")
        check(lt['pw']['long'] == 1 and lt['eng']['long'] == 1, 'the Links tab picks a player\'s second power, and it goes to the engine', lt)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wLinksHow') || {}).textContent || ''; return ['Powers.', 'mana', 'roar', 'ultimate', 'Situation powers', 'Auto powers'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains the powers, mana, the roar, ultimates, situation powers and Auto powers', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
