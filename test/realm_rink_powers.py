# Realm rink: powers (issue #83, phase 7).
# Every kind has two puck powers, two checking powers and an ultimate, with ids no two share. A side's skaters on the
# ice can cast the puck power they bring while their side has the puck, and the checking power while it doesn't: for
# mana and some stamina, one at a time, in live play, for a few seconds. What it does is read by the play: a shot's
# odds, a goalie's set, a skater's speed. Mana comes back when a side is scored on and at each break. The roar fills on
# shots, hits, saves and goals; it pays for one ultimate a game, which leaves a mark on the ice and has one set of
# effects with the puck and another without; left alone, it lifts a spent line with nobody fresh behind it. The team's
# situation powers fit their moments, once each. The CPU casts by its skill, in the right end, what suits its system;
# yours are cast for you under Auto powers and not when it is off. Powers can be off, or one side's only, and the side
# with them does better. On the Rink tab each player picks which of each pair they bring; in a game the rows under the
# rink cast them, and Q and R do in You play. Asserts; exits nonzero on failure.
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

# side 0: a werewolf at centre (0), a harpy (1) and a kobold (2) on the wings, a dwarf (3) and a golem (4) behind, a spider in goal (5)
SETUP = """window.__team = (name, kinds, pw) => ({ name, short: name[0], color: '#3a6ab8', light: '#fff', roster: kinds.map((kind, i) => ({ kind, n: kind + i, num: i + 2, pw: pw && pw[i] })), spot: { C: 0, LW: 1, RW: 2, LD: 3, RD: 4, G: 5 } });
window.__K = ['werewolf', 'harpy', 'kobold', 'dwarf', 'golem', 'spider'];
window.__game = (seed, o) => { wHK.start(Object.assign({ seed, teams: [__team('Aces', __K), __team('Bears', ['witch', 'elf', 'goblin', 'ogre', 'troll', 'gorgon'])], calls: [{ att: 'rush' }, {}] }, o || {})); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); wHK.setFouls({ trip: 0, hook: 0, board: 0, rough: 0 }); return wHK.play; };
window.__away = (P, keep) => { P.pl.forEach((p, i) => { if (!keep.includes(i)) { p.x = 2.5; p.y = 8.5 - (i % 6) * .2; p.vx = p.vy = 0; } }); };
window.__put = (P, i, x, y) => { const p = P.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; p.stun = 0; p.cd = 0; p.act = ''; return p; }; 0"""

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

        # ---------- the tables ----------
        t = await pg.evaluate("""(() => { const P = wHK.pows, kinds = Object.keys(P), ids = wHK.powerIds(), keys = new Set(Object.keys(wHK.fx0));
          const all = kinds.flatMap(k => P[k].one.concat(P[k].two)), fxOk = all.every(p => Object.keys(p.fx).length > 0 && Object.keys(p.fx).every(k => keys.has(k))) && kinds.every(k => Object.keys(P[k].ult.o).concat(Object.keys(P[k].ult.d)).every(x => keys.has(x)));
          return { kinds: kinds.length, same: JSON.stringify(kinds.slice().sort()) === JSON.stringify(wHK.kinds.slice().sort()), pairs: kinds.every(k => P[k].one.length === 2 && P[k].two.length === 2 && P[k].ult.n), ids: ids.length, uniq: new Set(ids).size,
            costs: all.every(p => p.cost === 1 || p.cost === 2), desc: all.every(p => p.desc.length > 15 && p.n), fxOk, sits: Object.keys(wHK.sits), R: wHK.powRules }; })()""")
        check(t['kinds'] == 24 and t['same'] and t['pairs'] and t['ids'] == 120 and t['uniq'] == 120 and t['costs'] and t['desc'] and t['fxOk'] and t['sits'] == ['manup', 'killit', 'empty', 'sudden'],
              'every kind (the six superstars too, phase 9) has two puck powers, two checking powers and an ultimate, each named and explained, with effects the play knows and ids no two share; and four situation powers', t)

        # ---------- casting ----------
        c = await pg.evaluate("""(() => { const P = __game(3), G = wHK.G, R = wHK.powRules; __away(P, [0]); __put(P, 0, 30, 0); wHK.give(0);
          const mana0 = wHK.mana.slice(), opts = wHK.powerOptions(0), theirs = wHK.powerOptions(1).map(o => o.role), sta0 = G.sta[0][P.pl[0].ri], spd0 = wHK.fx(0, 'spd');
          const r = wHK.cast(0, 0), after = { mana: wHK.mana[0], sta: G.sta[0][P.pl[0].ri], fxs: wHK.fxs, spd: wHK.fx(0, 'spd'), theirSpd: wHK.fx(1, 'spd'), msg: wHK.msg }; const again = wHK.cast(0, 1);
          wHK.step(3); const ran = G.fxs.length ? G.fxs[0].t : -1; if (G.fxs.length) G.fxs[0].t = .01; wHK.step(1); const gone = { ran, n: wHK.fxs.length, spd: wHK.fx(0, 'spd') };
          const P2 = __game(4), G2 = wHK.G; wHK.give(0); G2.mana[0] = 0; const noMana = wHK.cast(0, 0); G2.mana[0] = 3; G2.sta[0][P2.pl[0].ri] = .1; const tired = wHK.cast(0, 0);
          wHK.give(6); const chk = wHK.powerOptions(0).map(o => [o.role, o.id]); wHK.give(0); wHK.foul(6, 'hooking'); wHK.give(6); const dead = [wHK.phase, wHK.cast(0, 1)];
          const P3 = __game(5, { teams: [__team('Aces', __K, [{ puck: 1, chk: 1 }]), __team('Bears', __K)] }); wHK.give(0); const second = wHK.powerOptions(0)[0].id; wHK.give(6); const second2 = wHK.powerOptions(0)[0].id, first = wHK.powerOptions(1)[0].id;
          return { mana0, opts: opts.map(o => [o.i, o.role, o.id, o.cost, o.ok]), theirs, sta0, r, after, again, gone, noMana, tired, chk, dead, second, second2, first, R }; })()""")
        check(c['mana0'] == [3, 3] and c['opts'] == [[0, 'puck', 'stride', 1, True], [1, 'puck', 'endtoend', 1, True], [2, 'puck', 'ember', 1, True], [3, 'puck', 'hammer', 1, True], [4, 'puck', 'standing', 1, True]] and set(c['theirs']) == {'chk'} and c['chk'][0] == ['chk', 'pounce'],
              'with the puck each skater on the ice offers their puck power, and the side without it their checking power', c)
        a = c['after']
        check(c['r'] == '' and a['mana'] == 2 and a['sta'] < c['sta0'] - .05 and len(a['fxs']) == 1 and a['fxs'][0]['id'] == 'stride' and a['fxs'][0]['t'] == c['R']['secs'] and abs(a['spd'] - 1.1) < 1e-9 and a['theirSpd'] == 1 and 'Wolf Stride' in a['msg'],
              'a cast costs mana and some of the caster\'s stamina, and its effect is on for that side', c)
        check(c['again'] == 'One power at a time.' and abs(c['gone']['ran'] - (c['R']['secs'] - .1)) < .01 and c['gone']['n'] == 0 and c['gone']['spd'] == 1 and c['noMana'] == 'Not enough mana.' and 'too tired' in c['tired'] and c['dead'] == ['dead', 'Only in live play.'],
              'one at a time a side; it lasts its seconds of play and is gone; no mana, a spent caster, or a whistle, and it can\'t be cast', c)
        check(c['second'] == 'howl' and c['second2'] == 'hunt' and c['first'] == 'stride', 'a player who picked the second of a pair brings that one', c)

        # ---------- what a power does on the ice ----------
        e = await pg.evaluate("""(() => { const P = __game(6), G = wHK.G, gx = wHK.goalX(0), g = P.pl[11]; __away(P, [2, 11]); const sp = wHK.goalSpot(1, gx - 6, 0); g.x = sp[0]; g.y = sp[1]; G.mana = [6, 6];
          const q = () => wHK.shotOdds(2, 'wrist', gx - 6, 0); wHK.give(2); const base = q(); wHK.cast(0, 2); const ember = q(); G.fxs.length = 0; wHK.cast(0, 4); const blind = q(); G.fxs.length = 0; wHK.give(6); wHK.give(2);
          const run = () => { const p = __put(P, 1, 8, 0); G.sta[0][p.ri] = 1; for (let t = 0; t < 60; t++) wHK.skate(1, 38, 0); return p.x - 8; };
          const plain = run(); wHK.cast(0, 1); const fast = run(); G.fxs.length = 0; wHK.give(2);
          const P2 = __game(7, { teams: [__team('Aces', __K), __team('Bears', ['golem', 'wraith', 'witch', 'skeleton', 'dwarf', 'gorgon'])] }), G2 = wHK.G, g2 = P2.pl[11]; G2.mana = [6, 6]; __away(P2, [2, 11]); const s2 = wHK.goalSpot(1, wHK.goalX(0) - 6, 0); g2.x = s2[0]; g2.y = s2[1];
          wHK.give(2); const q0 = wHK.shotOdds(2, 'wrist', wHK.goalX(0) - 6, 0).q; const who = wHK.powerOptions(1).find(o => o.id === 'crease'); wHK.cast(1, who.i); const saved = wHK.shotOdds(2, 'wrist', wHK.goalX(0) - 6, 0).q; G2.fxs.length = 0; wHK.give(6); wHK.give(2);
          const run2 = () => { const p = __put(P2, 1, 8, 0); G2.sta[0][p.ri] = 1; for (let t = 0; t < 60; t++) wHK.skate(1, 38, 0); return p.x - 8; };
          const free = run2(); wHK.cast(1, wHK.powerOptions(1).find(o => o.id === 'chill').i); const chilled = run2();
          return { base: [base.q, base.set], ember: ember.q, blind: [blind.q, blind.set], plain, fast, q0, saved, free, chilled }; })()""")
        check(abs(e['ember'] - e['base'][0] - .03) < 1e-9 and e['blind'][1] < e['base'][1] * .8 and e['blind'][0] > e['base'][0] + .05, 'Ember Shot makes every shot a little harder to stop; a Standing Stone in front hides it from their goalie', e)
        check(e['fast'] > e['plain'] * 1.08 and abs(e['q0'] - e['saved'] - .05) < 1e-9 and e['chilled'] < e['free'] * .95, 'End to End makes a side faster; Stand in the Crease stops more of their shots; Chill Touch slows them', e)

        # ---------- mana, the roar and the ultimate ----------
        u = await pg.evaluate("""(() => { const P = __game(8), G = wHK.G, R = wHK.powRules; const m0 = wHK.mana.slice(); wHK.goalBy(0); const scored = wHK.mana.slice(); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          G.clock = .05; n = 0; while (wHK.phase !== 'break' && n++ < 400) wHK.step(); const brk = wHK.mana.slice(); n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          const s0 = wHK.spirit.slice(); wHK.pondShot(0, false); const P2 = __game(9), G2 = wHK.G; __away(P2, [2, 11]); __put(P2, 2, wHK.goalX(0) - 5, 0); wHK.give(2); G2.spirit = [0, 0];
          const tooFew = wHK.ultOptions(0)[0]; G2.spirit[0] = 59; const still = wHK.ultOptions(0)[0].ok; G2.spirit[0] = 70; const opts = wHK.ultOptions(0); const r = wHK.castUlt(0, 2);
          const cast = { r, spirit: wHK.spirit[0], marks: wHK.marks, fxs: wHK.fxs.map(x => [x.k, x.id, x.t]), shot: wHK.fx(0, 'shot'), slow: wHK.fx(0, 'slow'), msg: wHK.msg }; wHK.give(6); const without = { shot: wHK.fx(0, 'shot'), slow: wHK.fx(0, 'slow') }; wHK.give(2);
          G2.spirit[0] = 100; const again = wHK.castUlt(0, 1); G2.fxs[0].t = .01; wHK.step(2); const over = { marks: wHK.marks.length, fxs: wHK.fxs.length, shot: wHK.fx(0, 'shot') };
          return { m0, scored, brk, tooFew: [tooFew.ok, tooFew.why], still, n: opts.length, names: opts.map(o => o.name), cast, without, again, over, R }; })()""")
        check(u['m0'] == [3, 3] and u['scored'] == [3, 4] and u['brk'] == [5, 6], 'a side gets a mana when it is scored on, and both get two at each break', u)
        k = u['cast']
        check(u['tooFew'] == [False, 'Not enough spirit.'] and not u['still'] and u['n'] == 5 and u['names'][2] == 'Bonfire' and k['r'] == '' and k['spirit'] == 10 and len(k['marks']) == 1 and k['marks'][0]['n'] == 'Bonfire' and k['fxs'] == [['ult', 'bonfire', u['R']['ultSecs']]],
              'the ultimate takes 60 of the roar, and leaves its mark on the ice', u)
        check(abs(k['shot'] - .03) < 1e-9 and k['slow'] == 1 and u['without']['shot'] == 0 and abs(u['without']['slow'] - .86) < 1e-9 and u['again'] == 'One ultimate a game.' and u['over'] == {'marks': 0, 'fxs': 0, 'shot': 0},
              'it has one set of effects with the puck and another without it, once a game, and the mark goes when it ends', u)
        sp = await pg.evaluate("""(() => { const P = __game(10), G = wHK.G, R = wHK.powRules.spirit; const add = () => wHK.spirit.slice(); G.spirit = [0, 0];
          __away(P, [2, 11]); __put(P, 2, wHK.goalX(0) - 5, 0); let saves = 0, goals = 0, n = 0;
          while (saves < 1 && n++ < 40) { G.spirit = [0, 0]; wHK.give(2); P.me = 2; const p = P.pl[2]; p.x = wHK.goalX(0) - 5; p.y = 0; wHK.input({}); const S0 = G.sog[0], g0 = G.score[0];
            wHK.setMode('play'); wHK.input({ shoot: true }); wHK.step(2); wHK.input({ shoot: false }); let k = 0; while (G.sog[0] === S0 && k++ < 40 && wHK.phase === 'live') wHK.step(); wHK.setMode('watch');
            if (G.sog[0] > S0 && G.score[0] === g0) { saves++; var onSave = wHK.spirit.slice(); } if (wHK.phase !== 'live') { let j = 0; while (wHK.phase !== 'live' && j++ < 400) wHK.step(); } }
          const P2 = __game(11, { teams: [__team('Aces', __K), __team('Bears', __K)] }), G2 = wHK.G; G2.spirit = [30, 0]; for (const i of G2.on[0].slice(0, 5)) G2.sta[0][i] = .2; wHK.step(2);
          const lift = { spirit: wHK.spirit[0], sta: G2.on[0].slice(0, 5).map(i => Math.round(G2.sta[0][i] * 100) / 100), msg: wHK.msg };
          return { onSave, R, lift }; })()""")
        check(sp['onSave'] == [sp['R']['sog'], sp['R']['save']], 'the roar fills on a shot on goal for the shooter\'s side, and on the save for the goalie\'s', sp)
        check(sp['lift']['spirit'] == 5 and all(v >= .49 for v in sp['lift']['sta']) and 'one more shift' in sp['lift']['msg'], 'left unspent, the roar lifts a spent line with nobody fresh behind it for one more shift', sp)

        # ---------- situation powers ----------
        s = await pg.evaluate("""(() => { const P = __game(12), G = wHK.G; G.mana = [6, 6]; const ok = () => Object.fromEntries(wHK.sitOptions(0).map(o => [o.id, o.ok]));
          const even = ok(); wHK.penalty(1, P.pl[7].ri); wHK.lines(); const pp = ok(), theirs = Object.fromEntries(wHK.sitOptions(1).map(o => [o.id, o.ok]));
          const r = wHK.castSit(0, 'manup'), on = { mana: wHK.mana[0], shot: wHK.fx(0, 'shot'), safe: wHK.fx(0, 'safe'), again: wHK.castSit(0, 'manup') }; G.box.length = 0; wHK.lines(); wHK.step(2); const ended = { fxs: wHK.fxs.length, shot: wHK.fx(0, 'shot') };
          wHK.pull(0, 'hand'); for (const i of G.on[0].slice(0, 5)) G.sta[0][i] = .4; const empty = ok().empty, re = wHK.castSit(0, 'empty'), legs = G.on[0].slice(0, 5).every(i => G.sta[0][i] >= .69);
          G.p = 4; G.sta[0] = G.sta[0].map(() => .3); const sudden = ok().sudden, rs = wHK.castSit(0, 'sudden'), fresh = G.sta[0].every(v => v === 1), mana = wHK.mana[0];
          return { even, pp, theirs, r, on, ended, empty, re, legs, sudden, rs, fresh, mana }; })()""")
        check(s['even'] == {'manup': False, 'killit': False, 'empty': False, 'sudden': False} and s['pp']['manup'] and not s['pp']['killit'] and s['theirs']['killit'] and not s['theirs']['manup'],
              'a situation power is there only in its moment: Man up on the power play, Kill it a skater short', s)
        check(s['r'] == '' and s['on']['mana'] == 5 and abs(s['on']['shot'] - .03) < 1e-9 and s['on']['safe'] == .6 and s['on']['again'] == 'Once a game.' and s['ended'] == {'fxs': 0, 'shot': 0},
              'Man up costs a mana, once a game, and ends with the penalty', s)
        check(s['empty'] and s['re'] == '' and s['legs'] and s['sudden'] and s['rs'] == '' and s['fresh'] and s['mana'] == 2, 'Empty net gives the skaters on the ice their legs back; Sudden death, in overtime, makes everyone fresh', s)

        # ---------- who casts ----------
        w = await pg.evaluate("""(() => { const cast = (o, x, n) => { const P = __game(13, o), G = wHK.G; __away(P, [0]); __put(P, 0, x, 0); wHK.give(0); wHK.puckStep(); G.mana = [4, 4]; const mine = () => G.casts.filter(c => c.side === 0); for (let i = 0; i < (n || 30) && !mine().length; i++) wHK.cpuPowers(); return mine().map(c => c.id); };
          const fits = {}; for (let i = 0; i < 20; i++) { const P = __game(20 + i, { skill: [1, 1] }), G = wHK.G; __away(P, [0]); __put(P, 0, 32, 0); wHK.give(0); wHK.puckStep(); G.mana = [4, 4]; const mine = () => G.casts.filter(c => c.side === 0); for (let k = 0; k < 30 && !mine().length; k++) wHK.cpuPowers(); const id = (mine()[0] || {}).id || 'none'; fits[id] = (fits[id] || 0) + 1; }
          return { ownEnd: cast({ skill: [1, 1] }, 8), fits, squire: cast({ skill: [0, 0] }, 8, 400).length, autoOn: cast({ mode: 'manage', skill: [1, 1] }, 32).length, autoOff: cast({ mode: 'manage', skill: [1, 1], autoPow: false }, 32).length }; })()""")
        check(w['ownEnd'] == [] and w['fits'].get('stride', 0) + w['fits'].get('endtoend', 0) >= 14 and w['fits'].get('none', 0) <= 3, 'a Knight casts when the puck is in the right end, and what suits his system first (in a Rush: Wolf Stride or End to End)', w)
        check(w['squire'] >= 1 and w['autoOn'] == 1 and w['autoOff'] == 0, 'a Squire casts now and then wherever the puck is; yours are cast for you under Auto powers, and never with it off', w)
        hd = await pg.evaluate("""(() => { const P = __game(14, { mode: 'play', autoPow: false }), G = wHK.G; __away(P, [1]); __put(P, 1, 30, 0); wHK.give(1); P.me = 1; const q = wHK.input({ act: 'power' }), id = (wHK.fxs[0] || {}).id; G.spirit[0] = 80; const r = wHK.input({ act: 'ult' }), ult = wHK.fxs.map(x => x.id);
          const sn = wHK.snapshot(); wHK.start({ seed: 1 }); wHK.resume(sn); const back = { mana: wHK.mana[0], fxs: wHK.fxs.map(x => x.id), spd: wHK.fx(0, 'spd'), used: wHK.G.ultUsed };
          return { q, id, r, ult, back, t: [wHK.benchAct('autopow'), wHK.autoPow, wHK.benchAct('autopow'), wHK.autoPow] }; })()""")
        check(hd['q'] == 'power' and hd['id'] == 'endtoend' and hd['r'] == 'ult' and hd['ult'] == ['endtoend', 'tailwind'] and hd['back']['fxs'] == ['endtoend', 'tailwind'] and hd['back']['mana'] == 2 and hd['back']['spd'] > 1.3 and hd['back']['used'] == [True, False] and hd['t'] == ['autopow', True, 'handpow', False],
              'in You play, Q casts the power of the skater you are playing and R their ultimate; a save point keeps what is going', hd)
        g = await pg.evaluate("""(() => { const T = () => [__team('Aces', __K.concat(['vampire', 'witch'])), __team('Bears', __K.concat(['vampire', 'witch']))]; let d = 0, casts = [0, 0], off = 0;
          for (let i = 0; i < 150; i++) { const a = wHK.simGame({ seed: 4000 + i, teams: T(), calls: [{}, {}], powers: [true, false] }), b = wHK.simGame({ seed: 4000 + i, teams: T(), calls: [{}, {}], powers: [false, true] });
            d += (a.score[0] - a.score[1]) + (b.score[1] - b.score[0]); casts[0] += a.casts.filter(c => c.side === 0).length; casts[1] += a.casts.filter(c => c.side === 1).length; }
          const none = wHK.simGame({ seed: 5, powers: false }), both = wHK.simGame({ seed: 5 });
          return { d: d / 300, casts, none: [none.casts.length, none.mana], both: both.casts.length, kinds: [...new Set(both.casts.map(c => c.k))] }; })()""")
        check(g['casts'][0] > 600 and g['casts'][1] == 0 and g['none'] == [0, [3, 3]] and g['both'] > 3 and g['d'] > .05, 'powers can be off, or one side\'s only; over 300 games the side with them outscores the side without', g)

        # ---------- the page ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['troll', 'harpy', 'spider', 'lich', 'witch', 'vampire', 'werewolf']; let i = 0; while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern')); for (let k = 0; k < 12 && !document.getElementById('modal').hidden; k++) { const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); } WG.cardOffer = null; })()")
        await pg.evaluate("wOpenCamp('rink')"); await pg.wait_for_selector('#wCampBody .wrinksix [data-hpow]')
        tb = await pg.evaluate("""(() => { const li = document.querySelector('.wrinksix li'), k = +li.dataset.hid, p = wPlayer(k), K = wHK.pows[p.kind]; const sels = [...li.querySelectorAll('[data-hpow]')];
          return { n: document.querySelectorAll('#wCampBody [data-hpow]').length, roles: sels.map(x => x.dataset.hpow), opts: sels.map(x => [...x.options].map(o => o.textContent)), want: [[K.one[0], K.two[0]], [K.one[1], K.two[1]]].map(pr => pr.map(P => `${P.n} (${P.cost})`)), ult: li.querySelector('.whult').textContent, ultName: K.ult.n, pw: p.hkPw, id: k }; })()""")
        check(tb['n'] == 16 and tb['roles'] == ['puck', 'chk'] and tb['opts'] == tb['want'] and tb['ultName'] in tb['ult'] and tb['pw'] == {'puck': 0, 'chk': 0}, 'the Rink tab has two pickers a player, their kind\'s two puck powers and two checking powers with their costs, and names their ultimate', tb)
        await pg.select_option('.wrinksix li:first-child [data-hpow="chk"]', '1')
        pk = await pg.evaluate(f"(() => {{ const p = wPlayer({tb['id']}); return {{ pw: p.hkPw, eng: wSixMine().roster[0].pw, r: Object.keys(wSixMine().roster[0].r), sel: document.querySelector('.wrinksix li:first-child [data-hpow=\"chk\"]').value }}; }})()")
        check(pk['pw'] == {'puck': 0, 'chk': 1} and pk['eng'] == {'puck': 0, 'chk': 1} and pk['sel'] == '1' and pk['r'] == ['spd', 'siz', 'hnd', 'sht', 'def', 'ref'], 'a pick is kept on the player and goes to the engine with them; their ratings are untouched', pk)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        await pg.evaluate("wRinkGame({ seed: 7, mode: 'manage', autoPow: false })")
        await pg.wait_for_function("UI.view === 'rink' && wHK.phase === 'live' && !!document.querySelector('#wRinkCalls .wrpowbox button')")
        await pg.evaluate("(() => { wHK.pause(true); wHK.give(0); wHK.G.mana = [3, 3]; wHK.G.spirit = [70, 0]; })()")
        await pg.wait_for_function("document.querySelectorAll('#wRinkCalls [data-rpow]:not([disabled])').length === 5 && document.querySelectorAll('#wRinkCalls [data-rult]:not([disabled])').length === 5")
        rw = await pg.evaluate("""(() => { const box = document.querySelector('#wRinkCalls .wrpowbox'), rows = [...box.querySelectorAll('.wccrow')];
          return { labels: rows.map(r => r.querySelector('.wccl').textContent), pows: [...box.querySelectorAll('[data-rpow]')].length, ults: [...box.querySelectorAll('[data-rult]')].length, sits: [...box.querySelectorAll('[data-rsit]')].map(b => [b.textContent.replace(/\\s+/g, ' ').trim(), b.disabled]),
            text: box.textContent.replace(/\\s+/g, ' '), auto: box.querySelector('[data-rbench="autopow"]').textContent, tip: box.querySelector('[data-rpow]').title.length > 20 }; })()""")
        check(rw['labels'] == ['Powers', 'The big ones'] and rw['pows'] == 5 and rw['ults'] == 5 and [x[0] for x in rw['sits']] == ['Man up 1', 'Kill it 1', 'Empty net 1', 'Sudden death 2'] and all(x[1] for x in rw['sits']) and 'Mana 3 of 6' in rw['text'] and 'Roar 70 of 100' in rw['text'] and 'puck powers' in rw['text'] and rw['auto'] == 'Auto powers: off' and rw['tip'],
              'in a game the rows under the rink have each skater\'s power for the moment with its cost, an ultimate each, the situation powers, the mana and the roar, and Auto powers', rw)
        await pg.click('#wRinkCalls [data-rpow]:not([disabled])')
        c1 = await pg.evaluate("({ mana: wHK.mana[0], fxs: wHK.fxs.length, text: document.querySelector('#wRinkCalls .wrpowbox').textContent.replace(/\\s+/g, ' '), dis: document.querySelectorAll('#wRinkCalls [data-rpow]:not([disabled])').length })")
        await pg.click('#wRinkCalls [data-rult]:not([disabled])'); await pg.click('#wRinkCalls [data-rbench="autopow"]')
        c2 = await pg.evaluate("({ fxs: wHK.fxs.map(x => x.k), spirit: wHK.spirit[0], marks: wHK.marks.length, auto: wHK.autoPow, btn: document.querySelector('#wRinkCalls [data-rbench=\"autopow\"]').textContent, ults: document.querySelectorAll('#wRinkCalls [data-rult]:not([disabled])').length })")
        check(c1['mana'] < 3 and c1['fxs'] == 1 and 'Going now' in c1['text'] and c1['dis'] == 0 and c2['fxs'] == ['pow', 'ult'] and c2['spirit'] == 10 and c2['marks'] == 1 and c2['auto'] is True and c2['btn'] == 'Auto powers: on' and c2['ults'] == 0,
              'a click casts: the mana goes down, the row says what is going, and the others wait; the ultimate spends the roar and marks the ice; Auto powers toggles', [c1, c2])
        await pg.evaluate("showPage('help')"); hp = await pg.evaluate("(document.getElementById('wRinkHowPow') || {}).textContent || ''"); await pg.evaluate("showPage('play')")
        check('Powers.' in hp and 'The choice.' in hp and 'ultimate' in hp and 'Situation powers' in hp and 'Auto powers' in hp and 'End to End' in hp, 'How to play explains powers, the choice, the roar and the ultimate, situation powers and who casts', None)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
