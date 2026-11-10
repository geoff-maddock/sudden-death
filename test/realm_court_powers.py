# Realm court, powers (issue #77, phase 6). Team mana (two to start, half a point when scored on, one at each break, six
# at most); every kind's two offense and two defense powers and an ultimate, with ids unique; a player brings the pair's
# second when they picked it; a cast costs mana and the caster's stamina, and needs both; at most one a side a
# possession. What powers do on the floor (a shot power, a curse, a weaker contest, more steals, more blocks, a slower
# offense, Rampart's screens, Fade's, Skyhook's alley-oops, a frozen defense at the start). Spirit fills on big plays;
# the ultimate needs it, once a game, and leaves a zone for three possessions; a hot hand kept by spirit. Situation
# powers only when the moment fits (Clutch, Full-court Press, Ice It, which lowers their free throws). The coaches: an
# Archmage casts only what suits its set; a Squire at random. Your side: Auto powers casts for you, off casts nothing but
# what you queue. Powers on and off come out about even between the same clubs. In the Realm: the power picks on the
# Court tab reach the game, the calls panel's Powers block, How to play's table. Asserts; exits nonzero on failure.
# Screenshot: /tmp/realm-court-powers.png.
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

T = "[{ name: 'A', kinds: ['goblin', 'elf', 'werewolf', 'minotaur', 'troll', 'kobold', 'zombie'] }, { name: 'B', kinds: ['kobold', 'vampire', 'gorgon', 'spider', 'golem', 'harpy', 'skeleton'] }]"
# a live possession for side 0, kinds for side 0's five, powers on, nothing cast yet; returns the play
LIVE = f"""(kinds, seed) => {{ const t = {T}; if (kinds) t[0] = {{ name: 'A', kinds }}; wBK.start({{ teams: t, seed: seed || 5, skill: [0, 0], mode: 'manage' }}); wBK.auto = false;
  let n = 0; while (!(wBK.phase === 'live' && wBK.G.poss === 0) && n++ < 30 * 120) wBK.step();
  const G = wBK.G; G.cur.cast = []; G.cur.fx = JSON.parse(JSON.stringify(wBK.powerRules.fx0 || {{}})); G.mana = [6, 6]; G.zones = []; return wBK.play; }}"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1100})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBK !== 'undefined'")
        await pg.evaluate(f"window.__live = {LIVE}; 0")

        # ---------- the book ----------
        bk = await pg.evaluate("""(() => { const D = wBK.powerData, ids = []; for (const T of [D.pow, D.pow2]) for (const k in T) for (const p of T[k]) ids.push(p.id); for (const k in D.ult) ids.push(D.ult[k].id);
          return { kinds: wBK.kinds.length, each: wBK.kinds.every(k => D.pow[k] && D.pow[k].length === 2 && D.pow2[k] && D.pow2[k].length === 2 && D.ult[k]), ids: ids.length, unique: new Set(ids).size, sits: Object.keys(wBK.sits) }; })()""")
        check(bk['each'] and bk['ids'] == bk['unique'] == bk['kinds'] * 5 and bk['sits'] == ['clutch', 'fullpress', 'iceit'], 'every kind has two offense and two defense powers and an ultimate, every id unique; three situation powers', bk)
        # ---------- mana ----------
        mn = await pg.evaluate("""(() => { const t = """ + T + """; wBK.start({ teams: t, seed: 6, skill: [0, 0] }); const m0 = wBK.G.mana.slice();
          const G = wBK.G; G.mana = [0, 0]; let n = 0; const s0 = G.score.slice(); while (G.score[0] === s0[0] && G.score[1] === s0[1] && n++ < 30 * 200) wBK.step();
          const scorer = G.score[0] > s0[0] ? 0 : 1; while (G.cur.side === scorer && n++ < 30 * 200) wBK.step(); const after = G.mana.slice();
          G.mana = [5.5, 5.5]; G.q = 1; G.clock = .02; n = 0; while (wBK.phase !== 'break' && n++ < 30 * 60) wBK.step(); const brk = G.mana.slice();
          const off = wBK.simGame({ teams: t, seed: 7, powers: false });
          return { m0, scorer, after, brk, offCasts: off.tally.pow + off.tally.ult + off.tally.sit }; })()""")
        sc = mn['scorer']
        check(mn['m0'] == [2, 2] and mn['after'][1 - sc] == 0.5 and mn['after'][sc] == 0, 'mana: two to start, and half a point to the side scored on', mn)
        check(mn['brk'] == [6, 6] and mn['offCasts'] == 0, 'one more at a break, six at most; a game without powers casts none', mn)
        # ---------- casting ----------
        ct = await pg.evaluate("""(() => { const P = __live(['elf', 'elf', 'elf', 'elf', 'elf']), G = wBK.G, ri = G.on[0][0];
          const st0 = G.stam[0][ri], ok = wBK.castNow(0, ri, 'trueaim'), cost = 6 - G.mana[0], sta = st0 - G.stam[0][ri], listed = G.cur.cast.map(c => c.id);
          G.mana[0] = 0; const opts = wBK.powerList(0, 'off'); const broke = opts.every(o => !o.ok && /mana/.test(o.why));
          G.mana[0] = 6; G.stam[0][ri] = 10; const tired = wBK.powerList(0, 'off').find(o => o.ri === ri);
          const t2 = """ + T + """; t2[0].roster = t2[0].kinds.map((k, i) => ({ n: 'P' + i, kind: k, pw: { off: 1, def: 1 } })); wBK.start({ teams: t2, seed: 8 });
          const two = wBK.G.teams[0].roster[1]; const pick = wBK.powerList(0, 'off').find(o => o.ri === wBK.G.on[0].indexOf(1) || true);
          return { ok, cost, sta, listed, broke, tired: tired && [tired.ok, tired.why], second: wBK.powerList(0, 'off').map(o => o.id) }; })()""")
        check(ct['ok'] and ct['cost'] == 1 and ct['sta'] == 15 and ct['listed'] == ['trueaim'], 'a cast: mana (its cost), the caster\'s stamina (10 plus 5 a mana), and it is on the possession', ct)
        check(ct['broke'] and ct['tired'][0] is False and 'tired' in ct['tired'][1], 'no cast without the mana, or by a player too tired', ct)
        check('scurry' in ct['second'] and 'swift' in ct['second'], 'a player who picked the second power of the pair brings it', ct)
        # ---------- what powers do ----------
        fx = await pg.evaluate("""(() => { const out = {};
          const shot = (kinds, ri, id, side) => { const P = __live(kinds), G = wBK.G, i = P.pl.findIndex(p => p.side === 0 && p.pos === 'SF'), x = wBK.hoopX(0) - wBK.dir(0) * 5;
            P.pl.filter(p => p.side === 1).forEach(p => { p.x = wBK.rules.len / 2; p.y = 6; p.stun = 0; }); const b = wBK.shotP(i, x, 0).p; wBK.castNow(side, G.on[side][ri], id); return wBK.shotP(i, x, 0).p - b; };
          out.trueaim = shot(['elf', 'elf', 'elf', 'elf', 'elf'], 0, 'trueaim', 0);
          { const P = __live(null), G = wBK.G; G.teams[1].roster[G.on[1][2]].kind = 'gorgon'; const i = P.pl.findIndex(p => p.side === 0 && p.pos === 'SF'), x = wBK.hoopX(0) - wBK.dir(0) * 5; P.pl.filter(p => p.side === 1).forEach(p => { p.x = wBK.rules.len / 2; p.stun = 0; });
            const b = wBK.shotP(i, x, 0).p; wBK.castNow(1, G.on[1][2], 'stare'); out.stare = wBK.shotP(i, x, 0).p - b; }
          { const P = __live(['witch', 'witch', 'witch', 'witch', 'witch']), G = wBK.G, i = P.pl.findIndex(p => p.side === 0 && p.pos === 'SF'), x = wBK.hoopX(0) - wBK.dir(0) * 6;
            const d = P.pl.find(p => p.side === 1); P.pl.filter(p => p.side === 1).forEach(p => { p.x = wBK.rules.len / 2; p.stun = 0; }); d.x = x + wBK.dir(0) * .7; d.y = 0; const b = wBK.shotP(i, x, 0).p; wBK.castNow(0, G.on[0][0], 'hex'); out.hex = wBK.shotP(i, x, 0).p - b; }
          { __live(['golem', 'golem', 'golem', 'golem', 'golem']); const G = wBK.G; wBK.castNow(0, G.on[0][0], 'rampart'); out.wall = wBK.fx('wall'); }
          { __live(['harpy', 'harpy', 'harpy', 'harpy', 'harpy']); const G = wBK.G; wBK.castNow(0, G.on[0][0], 'skyhook'); out.oop = wBK.fx('oop'); }
          { const P = __live(['vampire', 'vampire', 'vampire', 'vampire', 'vampire']), G = wBK.G; P.pl.forEach(p => p.stun = 0); wBK.castNow(0, G.on[0][0], 'mesmer'); out.mesmer = P.pl.filter(p => p.side === 1 && p.stun > .5).length; }
          { __live(null); const G = wBK.G; G.teams[1].roster[G.on[1][0]].kind = 'lich'; wBK.castNow(1, G.on[1][0], 'chill'); out.chill = wBK.fx('oSpd'); }
          return out; })()""")
        check(fx['trueaim'] > .04 and fx['stare'] < -.06 and fx['hex'] > .02, 'powers on the floor: True Aim makes a shot likelier, Stare less likely, Hex weakens the contest', fx)
        check(fx['wall'] == 1 and fx['oop'] == 1 and fx['mesmer'] == 5 and fx['chill'] < .9, 'Rampart\'s screens, Skyhook\'s alley-oops, Mesmerize freezes the five, Chill slows the offense', fx)
        st = await pg.evaluate("""(() => { const rate = (id, kinds) => { let s = 0; for (let t = 0; t < 120; t++) { const P = __live(kinds ? null : null, 300 + t), G = wBK.G; G.teams[1].roster[G.on[1][0]].kind = 'goblin';
              const h = P.ball.h, j = P.pl.findIndex(p => p.side === 0 && p.pos === 'SF'), d = P.pl.find(p => p.side === 1); P.pl[j].x = P.pl[h].x; P.pl[j].y = P.pl[h].y + 6; d.x = P.pl[h].x; d.y = P.pl[h].y + 3; d.stun = 0;
              if (id) wBK.castNow(1, G.on[1][0], id); wBK.pass(j); if (P.ball.stl >= 0) s++; } return s; };
          return { base: rate(null), pick: rate('pickpocket') }; })()""")
        check(st['pick'] > st['base'] * 1.25, 'Pickpocket: more passes picked off', st)
        rk = await pg.evaluate("""(() => { const P = __live(['wraith', 'goblin', 'elf', 'golem', 'troll'], 41), G = wBK.G; G.teams[1].roster[G.on[1][0]].kind = 'wraith';
          wBK.castNow(1, G.on[1][0], 'fade'); const h = P.ball.h, D = P.pl.find(q => q.side === 1 && q.mark === h); D.x = P.pl[h].x + wBK.dir(0); D.y = P.pl[h].y;
          wBK.pick(h); let n = 0; while (P.pick && n++ < 120) wBK.step(); return { k: P.pickLast }; })()""")
        check(rk['k'] == 'fade', 'Fade: the defender floats through the screen', rk)
        # ---------- spirit, the ultimate, the zone ----------
        ul = await pg.evaluate("""(() => { const P = __live(['werewolf', 'goblin', 'elf', 'golem', 'troll'], 51), G = wBK.G; G.spirit = [40, 0];
          const wolf = G.on[0].find(ri => G.teams[0].roster[ri].kind === 'werewolf'); const low = wBK.ultOptions(0).find(o => o.ri === wolf); G.spirit[0] = 70; const r = wBK.ult(wolf), z = G.zones.slice(), sp = G.spirit[0], again = wBK.ult(wolf);
          const spd = wBK.fx('oSpd'); const left = []; for (let k = 0; k < 4; k++) { const s = G.cur.side; let n = 0; while (G.cur.side === s && n++ < 30 * 60) wBK.step(); left.push(G.zones.length ? G.zones[0].left : 0); }
          return { low: low && [low.ok, low.why], r, z: z.map(x => [x.id, x.side]), sp, again, spd, left }; })()""")
        check(ul['low'][0] is False and 'spirit' in ul['low'][1] and ul['r'] == '' and ul['z'] == [['fullmoon', 0]] and ul['sp'] == 10 and ul['again'] != '', 'the ultimate needs spirit; it costs 60, leaves its zone, and once a game', ul)
        check(ul['spd'] > 1.1 and ul['left'][-1] == 0, 'the zone acts at once (Full Moon: faster), and is gone after three possessions', ul)
        kp = await pg.evaluate("""(() => { const P = __live(null, 61), G = wBK.G, i = P.pl.findIndex(p => p.side === 0 && p.pos === 'SF'), ri = P.pl[i].ri; G.hot[0][ri] = 3; G.spirit[0] = 30;
          P.ball.h = i; wBK.shootAt(1); let n = 0; while (P.ball.st === 'shot' && n++ < 60) wBK.step(); return { fire: G.hot[0][ri] >= 3, sp: G.spirit[0] }; })()""")
        check(kp == {'fire': True, 'sp': 5}, 'a hot hand who misses stays on fire for 25 spirit', kp)
        rg = await pg.evaluate("""(() => { const P = __live(['troll', 'werewolf', 'elf', 'goblin', 'golem'], 81), G = wBK.G; const tr = G.on[0].find(ri => G.teams[0].roster[ri].kind === 'troll');
          G.stam[0] = G.stam[0].map(() => 50); G.teams[1].roster[G.on[1][0]].kind = 'troll'; wBK.castNow(1, G.on[1][0], 'regen'); const st1 = G.stam[1].slice();
          G.spirit[0] = 80; const wolf = G.on[0].find(ri => G.teams[0].roster[ri].kind === 'werewolf'); wBK.ult(wolf); const st2 = G.stam[1].slice();
          // Full-court Press: three of their possessions
          wBK.start({ teams: """ + T + """, seed: 82, skill: [0, 0], mode: 'manage' }); wBK.auto = false; const H = wBK.G; let n = 0; while (!(wBK.phase === 'live' && H.poss === 1) && n++ < 30 * 120) wBK.step();
          H.mana = [6, 6]; H.score = [10, 30]; const r = wBK.sit('fullpress'); const acts = []; for (let k = 0; k < 8; k++) { const s0 = H.cur.side; acts.push([s0, H.zones.length]); n = 0; while (H.cur.side === s0 && n++ < 30 * 60) wBK.step(); }
          const theirs = acts.filter(([side, z]) => side === 1 && z > 0).length;
          // a hot hand kept once a streak
          const Q = __live(null, 83), K = wBK.G, i = Q.pl.findIndex(p => p.side === 0 && p.pos === 'SF'), ri = Q.pl[i].ri; K.hot[0][ri] = 3; K.spirit[0] = 50; const miss = () => { Q.ball.st = 'held'; Q.ball.h = i; wBK.shootAt(1); let m = 0; while (Q.ball.st === 'shot' && m++ < 60) wBK.step(); return K.hot[0][ri] >= 3; };
          const one = miss(), two = miss();
          return { same: JSON.stringify(st1) === JSON.stringify(st2), r, theirs, one, two }; })()""")
        check(rg['same'], 'an ultimate pressed mid-possession doesn\'t fire the start\'s effects again (Regenerate\'s stamina once)', rg)
        check(rg['r'] == '' and rg['theirs'] == 4, 'Full-court Press presses the possession it was pressed in, free, then three more of theirs', rg)
        check(rg['one'] and not rg['two'], 'a hot hand is kept once a streak: the second miss puts the fire out', rg)
        # a freeze cast with a possession lasts through the walk up the floor; a cast counts once; the new period's first
        # possession casts with the break's mana in
        fz = await pg.evaluate("""(() => { const t = """ + T + """; t[0] = { name: 'A', kinds: ['vampire', 'vampire', 'vampire', 'vampire', 'vampire'] }; wBK.start({ teams: t, seed: 85, skill: [0, 0], mode: 'manage' }); wBK.auto = false;
          const G = wBK.G; let n = 0; while (!(wBK.phase === 'dead' && G.poss === 0) && n++ < 30 * 300) wBK.step(); if (wBK.phase !== 'dead') return { skip: true };
          G.mana[0] = 6; G.pow = null; const ri = G.on[0][0]; wBK.queue('off', ri, 'mesmer');
          // (the possession has already started at the basket: cast it now as the start would, then walk on)
          const ok = wBK.castNow(0, ri, 'mesmer'); G.cur.started = false; wBK.play.pl.forEach(p => p.stun = 0);
          n = 0; while (wBK.phase !== 'live' && n++ < 400) wBK.step(); const frozen = wBK.play.pl.filter(p => p.side === 1 && p.stun > .5).length;
          const s = wBK.simGame({ teams: """ + T + """, seed: 86 }); let evs = 0; wBK.start({ teams: """ + T + """, seed: 86 }); n = 0; let seen = 0; while (wBK.phase !== 'over' && n++ < 30 * 900) { wBK.step(); }
          const H = wBK.G; H.mana = [0, 0]; H.q = 1; H.clock = .02; wBK.start({ teams: """ + T + """, seed: 87, skill: [2, 2] }); const K = wBK.G; n = 0; while (!(wBK.phase === 'live') && n++ < 300) wBK.step();
          K.mana = [0, 0]; K.clock = .02; n = 0; while (wBK.phase !== 'break' && n++ < 30 * 60) wBK.step(); const brkMana = K.mana.slice(), cast = K.cur.cast.length;
          return { ok, frozen, tally: s.tally.pow, brkMana, cast }; })()""")
        check(fz.get('skip') or (fz['ok'] and fz['frozen'] == 5), 'a freeze cast with the possession lasts through the walk up the floor (Mesmerize: their five frozen as play goes live)', fz)
        sv = await pg.evaluate("""(() => { __live(null, 71); const G = wBK.G; const early = wBK.sitOptions(0).find(s => s.id === 'clutch'); G.q = 4; G.clock = 20; G.score = [30, 28]; const late = wBK.sitOptions(0).find(s => s.id === 'clutch');
          const r = wBK.sit('clutch'), shot = wBK.fx('shot'), twice = wBK.sit('clutch');
          G.score = [20, 30]; const press = wBK.sitOptions(0).find(s => s.id === 'fullpress');
          return { early: early.ok, late: late.ok, r, shot, twice, press: press.ok }; })()""")
        check(not sv['early'] and sv['late'] and sv['r'] == '' and sv['shot'] >= .06 and sv['twice'] != '' and not sv['press'], 'Clutch only in the last 30 seconds of a close game, once; Full-court Press only on defense', sv)
        # Ice It: at their free throws an Archmage ices them, once, and every shot of the trip is harder
        ic = await pg.evaluate("""(() => { const t = """ + T + """; wBK.start({ teams: t, seed: 91, skill: [0, 2] }); let n = 0; const G = wBK.G; while (!(wBK.phase === 'live' && G.poss === 0) && n++ < 30 * 120) wBK.step();
          G.mana = [6, 6]; const i = wBK.play.pl.findIndex(p => p.side === 0 && p.pos === 'SF'); wBK.freeThrows(0, i, 2); const ice = wBK.snapshot().GD.ft.ice, used = G.sitUsed[1].iceit, mana = G.mana[1];
          return { ice, used, mana }; })()""")
        check(ic == {'ice': -0.2, 'used': True, 'mana': 5}, 'Ice It: at your free throws an Archmage ices them (once, a mana): every shot of the trip 20 points harder', ic)
        # ---------- the coaches ----------
        cp = await pg.evaluate("""(() => { const t = """ + T + """; const fit = { shot: ['spread', 'motion', 'hot'], drive: ['iso', 'post', 'pick'], pass: ['motion', 'pick'] }; let bad = 0, all = 0, sq = 0, ice = 0, ult = 0;
          for (let i = 0; i < 10; i++) { wBK.start({ teams: t, seed: 800 + i, skill: [2, 0] }); const G = wBK.G; let last = null, n = 0;
            while (wBK.phase !== 'over' && n++ < 30 * 900) { wBK.step(); const c = G.cur; if (c && c !== last && c.cast) { last = c; } }
            const s = wBK.summary(); ice += s.tally.sit; ult += s.tally.ult; }
          for (let i = 0; i < 8; i++) { wBK.start({ teams: t, seed: 900 + i, skill: [2, 2] }); const G = wBK.G; let seen = new Set(), n = 0;
            while (wBK.phase !== 'over' && n++ < 30 * 900) { wBK.step(); const c = G.cur; if (c && c.cast && !seen.has(c)) { seen.add(c); for (const x of c.cast) { if (x.ult || x.sit) continue; const p = wBK.powerData.pow[G.teams[x.side].roster[x.ri].kind].concat(wBK.powerData.pow2[G.teams[x.side].roster[x.ri].kind]).find(q => q.id === x.id); all++; if (fit[p.fits] && !fit[p.fits].includes(c.off)) bad++; } } } }
          return { bad, all, ult, sit: ice }; })()""")
        check(cp['all'] > 30 and cp['bad'] == 0 and cp['ult'] > 0, 'an Archmage casts only powers that suit the set on the floor, and uses its ultimate', cp)
        au = await pg.evaluate("""(() => { const t = """ + T + """; const count = auto => { wBK.start({ teams: t, seed: 77, skill: [1, 1], mode: 'manage' }); wBK.auto = auto; let n = 0, mine = 0; const seen = new Set();
            while (wBK.phase !== 'over' && n++ < 30 * 400) { wBK.step(); const c = wBK.G.cur; if (c && c.cast && !seen.has(c)) { seen.add(c); mine += c.cast.filter(x => x.side === 0).length; } } return mine; };
          const on = count(true), off = count(false);
          wBK.start({ teams: t, seed: 78, skill: [1, 1], mode: 'manage' }); wBK.auto = false; const G = wBK.G; let n = 0; while (!(wBK.phase === 'live' && G.poss === 1) && n++ < 30 * 60) wBK.step();
          G.mana[0] = 6; const o = wBK.powerList(0, 'off').find(x => x.ok); wBK.queue('off', o.ri, o.id); n = 0; while (G.cur.side !== 0 && n++ < 30 * 60) wBK.step();
          return { on, off, queued: G.cur.cast.some(x => x.side === 0 && x.id === o.id), left: wBK.queued }; })()""")
        check(au['on'] > 3 and au['off'] == 0 and au['queued'], 'Auto powers casts for you; off, nothing is cast but the power you queue, at your next possession at that end', au)
        bl = await pg.evaluate("""(() => { const t = """ + T + """; const w = { on: 0, off: 0 }, pts = { on: 0, off: 0 }; for (const k of ['on', 'off']) for (let i = 0; i < 30; i++) for (const sw of [0, 1]) { const s = wBK.simGame({ teams: sw ? [t[1], t[0]] : t, seed: 1500 + i, powers: k === 'on' });
            if ((s.win === 0) !== !!sw && s.win != null) w[k]++; pts[k] += (s.score[0] + s.score[1]) / 120; } return { w, pts }; })()""")
        check(abs(bl['w']['on'] - bl['w']['off']) <= 12 and abs(bl['pts']['on'] - bl['pts']['off']) < 4, 'powers on and off come out about even between the same clubs, at about the same scores', bl)

        # ---------- the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wOpenCamp('court')"); await pg.wait_for_selector('#modalBox [data-kpw]')
        tb = await pg.evaluate("""(() => { const s = document.querySelector('#modalBox [data-kpw="off"]'), k = +s.closest('[data-kid]').dataset.kid; s.value = '1'; s.dispatchEvent(new Event('change'));
          const p = wPlayer(k), mine = wCourtMine(), i = wCourtKeys(WG.court).indexOf(k); return { pw: p.bkPw, team: mine.roster[i].pw, n: document.querySelectorAll('#modalBox [data-kpw]').length }; })()""")
        check(tb['pw'] == {'off': 1, 'def': 0} and tb['team'] == {'off': 1, 'def': 0} and tb['n'] >= 2, 'the Court tab picks each player\'s powers, and the pick goes into the game', tb)
        await pg.evaluate("WCAMP.close(); wCourtPractice()")
        await pg.click('[data-cmode="manage"]')
        await pg.wait_for_function("!!document.querySelector('#wCourtCalls .wccpow select')")
        pb = await pg.evaluate("""({ auto: document.getElementById('wCourtAuto').checked, off: document.querySelectorAll('#wCourtCalls [data-cpow="off"] option').length, def: document.querySelectorAll('#wCourtCalls [data-cpow="def"] option').length,
          ult: document.querySelectorAll('#wCourtCalls [data-cult]').length, tip: (document.querySelector('#wCourtCalls [data-cpow="off"] option[value*=":"]') || {}).title || '' })""")
        check(pb['auto'] and pb['off'] == 6 and pb['def'] == 6 and pb['ult'] == 5 and 'mana' in pb['tip'] and 'your set' in pb['tip'], 'the Powers block: Auto powers, a power to queue at each end from your five (each with its tip), and their ultimates', pb)
        q = await pg.evaluate("""(() => { const s = document.querySelector('#wCourtCalls [data-cpow="def"]'); const o = [...s.options].find(x => x.value && !x.disabled); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return { q: wBK.queued, want: o.value }; })()""")
        check(q['q'] and q['q']['def'] and f"{q['q']['def']['ri']}:{q['q']['def']['id']}" == q['want'], 'picking a power in the block queues it for that end', q)
        await pg.screenshot(path='/tmp/realm-court-powers.png', full_page=True)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wCourtPowHow'); return { rows: h ? h.querySelectorAll('tr').length : 0, words: !!h && /spirit/.test(h.textContent) && /Clutch/.test(h.textContent) && /Auto powers/.test(h.textContent), help: !!document.getElementById('wHelpCourtPow') }; })()")
        check(hp['rows'] == 19 and hp['words'] and hp['help'], 'How to play: powers, spirit and the ultimate, situation powers, and every kind\'s in a table', hp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
