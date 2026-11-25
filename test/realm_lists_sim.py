# Realm lists (issue #117, phase 1): the course model and one match, CPU against CPU.
# The model is pure: the same rides and the same random numbers give the same strikes, and it reads and writes no
# match. The target: the shield on the left, the helm small and high, below the belt, the mount and the barrier fouls.
# The plan plays off itself: an angled shield turns strikes on it into glances (but the helm is a bigger mark), a helm
# strike misses more, a gallop hits harder but the tip strays more, and an early couch droops the tip. A broken lance
# rocks the rider, and a good seat, a square guard and a good lean keep them on; a glance never unhorses. The mounts:
# a Charger hits hardest and sways most, a Destrier sways least, a Courser gets its wind back quickest. The CPU's plan:
# a Knight behind with too few courses left goes for the helm at a gallop, ahead it weighs the points against it
# double, and in the tilt it rides the best expected margin; an Archmage saves its gallop for the heat's last course;
# a Squire picks anything. The plan is a real choice: at a Knight's hands no aim is best everywhere and each is best
# somewhere. The course is a game (phase 2's review): no plan always ridden, and neither guard always held, beats a
# Knight; every plan always ridden loses to an Archmage, whose read beats a fixed plan by more than a Knight's plan does
# and loses nothing to a Knight's; angled is the better guard against a rider who aims at the shield, square against
# one who aims at the body; your squire's word does as well as a Knight's own plan; every reason is true to the plan.
# A match, CPU against CPU (calibrated): a Knight breaks a lance in about half its courses, helm breaks are rare,
# about one match in three has an unhorsing, every match has a winner, and each skill beats the one below. The tilt
# is capped, and the marshal's count settles it. simMatch leaves the match on the lists and its seeded stream alone,
# and the same seed rides the same match. Asserts; exits nonzero on failure.
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
// a seeded stream for the model (mulberry32), independent of the engine's
window.__rng = n => { let a = n >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
window.__rs = () => wJT.rs('');
// ride n courses of plan a against a defender with guard g: the share of each result
window.__try = (plan, g, n, seed, o) => { const rnd = __rng(seed), out = { n, broke: 0, glance: 0, miss: 0, foul: 0, helm: 0, unh: 0, rock: 0 };
  for (let i = 0; i < n; i++) { const a = wJT.charge(Object.assign({ plan, rs: __rs(), mount: 'destrier', wind: 1, hands: { aim: 1, couch: .3 } }, o || {}), rnd);
    const d = { guard: g, rs: __rs(), mount: 'destrier' }, st = wJT.strike(a, d, rnd), se = wJT.seat(st, d, .5, rnd);
    if (st.broke) out.broke++; else if (st.at === 'glance') out.glance++; else if (st.at === 'miss') out.miss++; else out.foul++;
    if (st.zone === 'helm') out.helm++; if (se.unhorse) out.unh++; out.rock += st.rock; }
  for (const k of ['broke', 'glance', 'miss', 'foul', 'helm', 'unh', 'rock']) out[k] = +(out[k] / n).toFixed(3); return out; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wJT !== 'undefined'")
        await pg.evaluate(HELP)

        # ---------- the target ----------
        z = await pg.evaluate("""(() => { const A = wJT.planRules.aim, at = (p, g) => wJT.zoneAt(p.x, p.y, g);
          return { aims: [at(A.shield, 'square'), at(A.body, 'square'), at(A.helm, 'square'), at(A.shield, 'angled'), at(A.body, 'angled')],
            low: wJT.zoneAt(0, -15, 'square'), mount: wJT.zoneAt(0, -30, 'square'), barrier: wJT.zoneAt(-20, -10, 'square'), miss: [wJT.zoneAt(20, 0, 'square'), wJT.zoneAt(0, 40, 'square')],
            angledHelm: [wJT.zoneAt(0, 24, 'square'), wJT.zoneAt(0, 24, 'angled')], angledBody: [wJT.zoneAt(1.5, 2, 'square'), wJT.zoneAt(1.5, 2, 'angled')] }; })()""")
        check(z['aims'] == ['shield', 'body', 'helm', 'shield', 'body'], 'each aim point lands on its mark, square or angled', z['aims'])
        check(z['low'] == 'low' and z['mount'] == 'mount' and z['barrier'] == 'barrier' and z['miss'] == ['miss', 'miss'], 'below the belt, the mount and the barrier are fouls; wide or high is a miss', z)
        check(z['angledHelm'] == ['miss', 'helm'] and z['angledBody'] == ['shield', 'body'], 'an angled shield leaves the helm a bigger mark and more of the body open', z)

        # ---------- the model is pure ----------
        pu = await pg.evaluate("""(() => { const one = () => { const rnd = __rng(5), a = wJT.charge({ plan: { aim: 'shield', guard: 'square', pace: 'gallop' }, rs: __rs(), mount: 'charger', wind: 1 }, rnd),
            b = wJT.charge({ plan: { aim: 'body', guard: 'angled', pace: 'canter' }, rs: __rs(), mount: 'courser', wind: .5 }, rnd); return JSON.stringify(wJT.impact([a, b], [.5, .5], rnd)); };
          const g0 = wJT.G === null ? 'null' : JSON.stringify(wJT.G); const x = one(), y = one(); return { same: x === y, untouched: (wJT.G === null ? 'null' : JSON.stringify(wJT.G)) === g0, res: JSON.parse(x).res }; })()""")
        check(pu['same'] and pu['untouched'] and len(pu['res']) == 2 and all('at' in r and 'unhorse' in r for r in pu['res']), 'the course model is pure: the same rides and random numbers give the same strikes, a strike for the rules each way, and no match is touched', pu)

        # ---------- the plan plays off itself ----------
        pl = await pg.evaluate("""(() => { const N = 3000, P = (aim, pace) => ({ aim, guard: 'square', pace: pace || 'canter' });
          return { shSq: __try(P('shield'), 'square', N, 1), shAng: __try(P('shield'), 'angled', N, 2), bodySq: __try(P('body'), 'square', N, 3), bodyAng: __try(P('body'), 'angled', N, 4),
            helmSq: __try(P('helm'), 'square', N, 5), helmAng: __try(P('helm'), 'angled', N, 6), gal: __try(P('shield', 'gallop'), 'square', N, 7),
            early: __try(P('shield'), 'square', N, 8, { hands: { aim: 1, couch: 1.6 } }),
            sway: [wJT.sway({ pace: 'canter' }).sigma, wJT.sway({ pace: 'gallop' }).sigma, wJT.sway({ pace: 'canter', couch: -.6 }).droop, wJT.sway({ pace: 'canter', couch: .6 }).sigma,
              wJT.sway({ pace: 'canter', rs: Object.assign(__rs(), { lance: 1 }) }).sigma, wJT.sway({ pace: 'canter', wind: .2 }).sigma],
            speed: [wJT.rideSpeed({ pace: 'canter' }), wJT.rideSpeed({ pace: 'gallop' }), wJT.rideSpeed({ pace: 'gallop', wind: .2 })] }; })()""")
        check(pl['shAng']['glance'] > pl['shSq']['glance'] + .25 and pl['shAng']['broke'] < pl['shSq']['broke'] - .25, 'an angled shield turns most strikes on the shield into glances', [pl['shSq'], pl['shAng']])
        check(pl['helmAng']['helm'] > pl['helmSq']['helm'] + .1 and pl['bodyAng']['broke'] > pl['bodySq']['broke'] - .05, 'but an angled guard leaves the helm a bigger mark, and the body is as open', [pl['helmSq'], pl['helmAng'], pl['bodySq'], pl['bodyAng']])
        check(pl['helmSq']['miss'] > pl['shSq']['miss'] + .3 and pl['helmSq']['helm'] < .5, 'a helm strike misses far more than a shield strike', [pl['helmSq'], pl['shSq']])
        check(pl['gal']['rock'] > pl['shSq']['rock'] * 1.2 and pl['gal']['miss'] > pl['shSq']['miss'] and pl['sway'][1] > pl['sway'][0] * 1.2 and pl['speed'][1] > pl['speed'][0] * 1.3,
              'a gallop is faster and hits harder, but the tip strays more', {'gal': pl['gal'], 'canter': pl['shSq'], 'sway': pl['sway'], 'speed': pl['speed']})
        check(pl['sway'][2] > 2 and pl['sway'][3] > pl['sway'][0] * 1.3 and pl['sway'][4] < pl['sway'][0] * .8 and pl['sway'][5] > pl['sway'][0] * 1.2 and pl['speed'][2] < pl['speed'][1] * .9,
              'too early a couch droops the tip and too late scatters it; a good lance sways less; a blown mount sways more and slows', pl['sway'])
        check(pl['early']['foul'] > pl['shSq']['foul'] + .01, 'a rider whose couch comes early fouls more (the tip droops below the belt)', [pl['early'], pl['shSq']])

        # ---------- the seat and the mounts ----------
        se = await pg.evaluate("""(() => { const rnd = __rng(11), N = 4000, st = { broke: true, rock: .9, at: 'body' }, gl = { broke: false, rock: .9, at: 'glance' }, c = (d, lean, s) => { let u = 0; for (let i = 0; i < N; i++) if (wJT.seat(s || st, d, lean, rnd).unhorse) u++; return +(u / N).toFixed(3); };
          const d = (seat, guard, mount) => ({ guard, mount: mount || 'courser', rs: Object.assign(__rs(), { seat }) });
          const M = wJT.mounts, f = m => wJT.rideSpeed({ pace: 'gallop', mount: m }) * M[m].hit;
          return { weak: c(d(0, 'angled'), 0), strong: c(d(1, 'angled'), 0), square: c(d(0, 'square'), 0), lean: c(d(0, 'angled'), 1), glance: c(d(0, 'angled'), 0, gl),
            mounts: { hit: [f('charger'), f('destrier'), f('courser')], sway: ['charger', 'destrier', 'courser'].map(m => wJT.sway({ pace: 'canter', mount: m }).sigma), rec: [M.charger.rec, M.destrier.rec, M.courser.rec] } }; })()""")
        check(se['weak'] > se['strong'] + .2 and se['weak'] > se['square'] and se['weak'] > se['lean'] + .2 and se['glance'] == 0, 'a hard broken lance unhorses a poor seat; a good seat, a square guard and a good lean keep them on; a glance never unhorses', se)
        mh, ms, mr = se['mounts']['hit'], se['mounts']['sway'], se['mounts']['rec']
        check(mh[0] > mh[1] and mh[0] > mh[2] and ms[0] > ms[2] > ms[1] and mr[2] > mr[0] and mr[2] > mr[1], 'a Charger hits hardest and sways most, a Destrier sways least, a Courser gets its wind back quickest', se['mounts'])

        # ---------- the CPU's plan ----------
        cp = await pg.evaluate("""(() => { const st = (a, b) => ({ at: a, unhorse: false }), out = {};
          wJT.start({ seed: 3, skill: [1, 1] }); wJT.course([st('miss'), st('helm')]); wJT.course([st('miss'), st('helm')]); wJT.course([st('miss'), st('miss')]);
          out.behind = wJT.plan(0); out.ahead = wJT.plan(1); out.behindMix = wJT.planMix(0).filter(p => p.aim === 'helm').reduce((a, p) => a + p.share, 0);
          wJT.start({ seed: 4, skill: [2, 2] }); out.arch = [wJT.plan(0).pace]; wJT.course([st('miss'), st('miss')]); wJT.course([st('miss'), st('miss')]); out.arch.push(wJT.plan(0).pace, wJT.plan(0).guard);
          wJT.start({ seed: 5, skill: [1, 1] }); for (let i = 0; i < 6; i++) wJT.course([st('miss'), st('miss')]); out.tilt = wJT.plan(0);
          wJT.start({ seed: 6, skill: [0, 0] }); const seen = new Set(); for (let i = 0; i < 60; i++) { const p = wJT.plan(0); seen.add(p.aim + '/' + p.guard + '/' + p.pace); } out.squire = seen.size;
          return out; })()""")
        check(cp['behindMix'] >= .5 and 'riding for the points' in cp['behind']['why'], 'a Knight four behind with three courses left goes for the helm most of the time, and says why', [cp['behindMix'], cp['behind']])
        check(cp['ahead']['why'].startswith('ahead by 4: weighing the points against it double'), 'a Knight well ahead weighs the points against it double, and says so', cp['ahead'])
        check(cp['arch'][:2] == ['canter', 'gallop'], 'an Archmage canters level early and saves its gallop for the heat\'s last course', cp['arch'])
        check(cp['tilt']['why'].startswith('the tilt for the crown') and 'expected margin' in cp['tilt']['why'] and 'sure' not in cp['tilt']['why'], 'in the tilt for the crown a Knight rides the best expected margin over their lance, and says so (no "sure break")', cp['tilt'])
        check(cp['squire'] >= 8, 'a Squire picks its plan at random', cp['squire'])

        # ---------- a match, CPU against CPU (calibrated) ----------
        g = await pg.evaluate("""(() => { const sum = (n, sk, s0) => { const o = { n, w: [0, 0], c: 0, br: [0, 0], helm: 0, mUnh: 0, over: 0 };
            for (let i = 0; i < n; i++) { const r = wJT.simMatch({ seed: s0 + i, skill: sk }); if (r.over && r.win >= 0 && r.tot[0] !== r.tot[1] || (r.over && r.over.marshal)) o.over++; o.w[r.win]++;
              let u = 0; for (const s of [0, 1]) { o.c += r.st[s].courses; o.br[s] += r.st[s].breaks; o.helm += r.st[s].helms; u += r.st[s].unhorse; } if (u) o.mUnh++; }
            return { n, w: o.w, over: o.over, brk: +((o.br[0] + o.br[1]) / o.c).toFixed(3), helm: +(o.helm / o.c).toFixed(3), unh: +(o.mUnh / n).toFixed(3) }; };
          return { kk: sum(300, [1, 1], 1000), ak: sum(300, [2, 1], 3000), ks: sum(300, [1, 0], 2000) }; })()""")
        kk = g['kk']; print('   (Knight v Knight:', kk, ')'); print('   (Archmage v Knight:', g['ak'], ')'); print('   (Knight v Squire:', g['ks'], ')')
        check(kk['over'] == kk['n'] and .42 <= kk['brk'] <= .58, 'Knight against Knight: every match decided, and a lance broken in about half the courses', kk)
        check(kk['helm'] <= .04, 'helm breaks are rare', kk['helm'])
        check(.22 <= kk['unh'] <= .45, 'about one match in three has an unhorsing', kk['unh'])
        check(.4 <= kk['w'][0] / kk['n'] <= .6, 'two Knights: even', kk['w'])
        check(g['ak']['w'][0] > g['ak']['w'][1] * 1.1 and g['ks']['w'][0] > g['ks']['w'][1] * 1.3, 'an Archmage beats a Knight, and a Knight beats a Squire', [g['ak']['w'], g['ks']['w']])

        # ---------- the plan is a real choice (phase 1's review) ----------
        # what each aim is worth at a Knight's hands, fresh and tired, at each pace against each guard: the points it
        # scores less the points scored on it, against a Knight cantering at the shield or the body
        mx = await pg.evaluate("""(() => { const rs = __rs(), N = 6000, H = { aim: 1, couch: .3 }, out = {};
          for (const wind of [1, .6]) for (const g of ['square', 'angled']) for (const pace of ['canter', 'gallop']) { const row = {};
            for (const aim of ['shield', 'body', 'helm']) { const rnd = __rng(11); let net = 0;
              for (let i = 0; i < N; i++) { const a = wJT.charge({ plan: { aim, guard: 'square', pace }, rs, mount: 'destrier', wind, hands: H }, rnd);
                const d = wJT.charge({ plan: { aim: rnd() < .5 ? 'shield' : 'body', guard: g, pace: 'canter' }, rs, mount: 'destrier', wind: 1, hands: H }, rnd);
                const I = wJT.impact([a, d], [.5, .5], rnd), p = s => I.res[s].unhorse ? 3 : (wJT.rules.pts[I.res[s].at] || 0); net += p(0) - p(1); }
              row[aim] = +(net / N).toFixed(3); }
            out[(wind === 1 ? 'fresh' : 'tired') + ' ' + g + ' ' + pace] = { row, best: Object.keys(row).sort((x, y) => row[y] - row[x])[0] }; }
          return out; })()""")
        for k2, v2 in mx.items(): print(f"   ({k2}: {v2['row']} best {v2['best']})")
        bests = [v2['best'] for v2 in mx.values()]
        for wd in ('fresh', 'tired'):
            check(len({v2['best'] for k2, v2 in mx.items() if k2.startswith(wd)}) >= 2, f'{wd}, no aim is best against both guards at both paces', {k2: v2['best'] for k2, v2 in mx.items() if k2.startswith(wd)})
        check(all(a2 in bests for a2 in ('shield', 'body', 'helm')), 'each aim is the best somewhere: the shield, the body and the helm', bests)
        check(all(mx[f'{wd} square canter']['best'] == 'shield' for wd in ('fresh', 'tired')), 'the shield at a canter is the safe point against a square guard', mx)
        check(all(mx[f'{wd} angled {pc}']['row']['shield'] < mx[f'{wd} angled {pc}']['row']['body'] for wd in ('fresh', 'tired') for pc in ('canter', 'gallop')), 'an angled guard turns the shield aside: the body is the better aim against it', mx)
        # (phase 2's review) the course is a game: a Knight rides the mix nobody beats by always riding one plan, so no
        # plan always ridden (and neither guard always held) beats it by more than the noise; an Archmage reads the riders
        # it faces, so every plan always ridden loses to it, and it beats a fixed plan by more than a Knight's plan does;
        # angled is the better guard against a rider who aims at the shield, square against one who aims at the body; the
        # squire's word is the right call by the odds
        pol = await pg.evaluate("""(() => { const run = (o, n, s0) => { const w = [0, 0]; for (let i = 0; i < n; i++) w[wJT.simMatch(Object.assign({ seed: s0 + i }, o)).win]++; return w[0] / n; }, N = 300, out = { fk: {}, fa: {} };
          for (const aim of ['shield', 'body', 'helm']) for (const guard of ['angled', 'square']) for (const pace of ['canter', 'gallop']) { const f = { aim, guard, pace }, k = `${aim}/${guard}/${pace}`;
            out.fk[k] = run({ skill: [1, 1], fix: [f, null] }, N, 40000); out.fa[k] = run({ skill: [1, 2], fix: [f, null] }, N, 40000); }
          out.gk = { angled: run({ skill: [1, 1], guardBy: ['angled', null] }, 600, 40000), square: run({ skill: [1, 1], guardBy: ['square', null] }, 600, 40000) };
          const sh = { aim: 'shield', guard: 'square', pace: 'canter' }, bd = { aim: 'body', guard: 'square', pace: 'canter' };
          out.vsShield = { angled: run({ skill: [1, 1], guardBy: ['angled', null], fix: [null, sh] }, 400, 41000), square: run({ skill: [1, 1], guardBy: ['square', null], fix: [null, sh] }, 400, 41000) };
          out.vsBody = { angled: run({ skill: [1, 1], guardBy: ['angled', null], fix: [null, bd] }, 400, 41000), square: run({ skill: [1, 1], guardBy: ['square', null], fix: [null, bd] }, 400, 41000) };
          out.read = { arch: run({ skill: [2, 1], handsBy: [1, null], fix: [null, sh] }, 400, 42000), knight: run({ skill: [1, 1], fix: [null, sh] }, 400, 42000) };
          out.aVk = run({ skill: [2, 1], handsBy: [1, null] }, 600, 43000); out.kVr = run({ skill: [1, 1], planBy: [null, 0] }, 400, 9000);
          out.word = { k: run({ skill: [1, 1], planBy: ['word', null] }, 600, 44000), a: run({ skill: [1, 2], planBy: ['word', null] }, 600, 44000), kk: run({ skill: [1, 1] }, 600, 44000), ka: run({ skill: [1, 2] }, 600, 44000) };
          return out; })()""")
        print('   (a plan always ridden v a Knight:', pol['fk'], ')'); print('   (... v an Archmage:', pol['fa'], ')')
        print('   (a Knight with its guard held v a Knight:', pol['gk'], '; against always the shield:', pol['vsShield'], '; against always the body:', pol['vsBody'], ')')
        print('   (against always the shield, an Archmage\'s plan (a Knight\'s hands):', pol['read']['arch'], 'a Knight\'s:', pol['read']['knight'], '; an Archmage\'s plan v a Knight\'s:', pol['aVk'], '; a Knight\'s v a random one:', pol['kVr'], ')')
        print('   (riding your squire\'s word, a Knight\'s hands, v a Knight:', pol['word']['k'], 'v an Archmage:', pol['word']['a'], '; a Knight\'s own plan v them:', pol['word']['kk'], pol['word']['ka'], ')')
        check(max(pol['fk'].values()) <= .56 and max(pol['gk'].values()) <= .55, 'no plan always ridden, and neither guard always held, beats a Knight by more than the noise', [pol['fk'], pol['gk']])
        check(max(pol['fa'].values()) < .5, 'every plan always ridden loses to an Archmage (it reads them)', pol['fa'])
        check(pol['vsShield']['angled'] > pol['vsShield']['square'] and pol['vsBody']['square'] > pol['vsBody']['angled'], 'angled is the better guard against a rider who aims at the shield, square against one who aims at the body', [pol['vsShield'], pol['vsBody']])
        check(pol['read']['arch'] > pol['read']['knight'] + .03 and pol['aVk'] >= .47 and pol['kVr'] >= .55, 'an Archmage\'s read beats a fixed plan by more than a Knight\'s plan does, and loses nothing to a Knight\'s; a Knight\'s plan beats a random one', pol)
        check(pol['word']['k'] >= pol['word']['kk'] - .02 and pol['word']['a'] >= pol['word']['ka'] - .02, 'your squire\'s word is the right call by the odds: riding it does as well as a Knight\'s own plan, against a Knight and an Archmage', pol['word'])
        # every reason is true to the plan: a gallop "with no more courses in the heat" only in a heat's last course, the
        # wind "saved" only on a canter, and nothing claims a sure break
        wy = await pg.evaluate("""(() => { const bad = []; let n = 0;
          for (let i = 0; i < 60; i++) { wJT.start({ seed: 6000 + i, skill: [2, i % 3], courses: i % 2 ? 5 : 3 }); let k = 0; while (!wJT.G.over && k++ < 100) wJT.turn();
            for (const p of wJT.G.plans[0]) { n++; const last = p.heat < 2 && p.course === wJT.G.courses - 1;
              if (/no more courses in the heat/.test(p.why) && !(last && p.pace === 'gallop')) bad.push(p);
              if (/saving the mount/.test(p.why) && p.pace !== 'canter') bad.push(p);
              if (/sure break|saved for it/.test(p.why)) bad.push(p);
              if (!p.why.includes(wJT.planRules.aim[p.aim].n) || !p.why.includes(wJT.planRules.pace[p.pace].n) || !p.why.includes(p.guard)) bad.push(p); } }
          return { n, bad: bad.slice(0, 4) }; })()""")
        check(wy['n'] > 300 and not wy['bad'], 'every reason says what the plan does (its aim, pace and guard) and claims nothing it didn\'t do', wy)

        # ---------- the tilt's cap and the marshal's count ----------
        m = await pg.evaluate("""(() => { const st = a => ({ at: a, unhorse: false }), out = {};
          wJT.newMatch({}); wJT.course([st('shield'), st('miss')]); wJT.course([st('miss'), st('body')]); wJT.course([st('mount'), st('miss')]); wJT.course([st('miss'), st('mount')]);
          wJT.course([st('miss'), st('miss')]); wJT.course([st('miss'), st('miss')]); let n = 0; while (!wJT.G.over && n < 40) { wJT.course([st('shield'), st('body')]); n++; }
          out.even = [n, wJT.G.over, wJT.matchText(0)];
          wJT.newMatch({}); wJT.course([st('shield'), st('low')]); wJT.course([st('miss'), st('shield')]); wJT.course([st('miss'), st('shield')]); for (let i = 0; i < 3; i++) wJT.course([st('miss'), st('miss')]);
          n = 0; while (!wJT.G.over && n < 40) { wJT.course([st('miss'), st('miss')]); n++; } out.count = [n, wJT.G.over.win, wJT.G.over.marshal];
          return out; })()""")
        check(m['even'][0] == 12 and m['even'][1]['marshal'] and m['even'][1]['win'] == 0 and 'marshal' in m['even'][2], 'the tilt stops at twelve courses still level; the marshal\'s count (the lance broken first, the rest even) settles it, and says so', m['even'])
        check(m['count'] == [12, 1, True], 'level at the cap, the side with more lances broken wins on the marshal\'s count', m['count'])

        # ---------- outside keys: only a table's own (nothing inherited, such as toString) ----------
        ok = await pg.evaluate("""(() => { const fin = o => Object.values(o).every(v => typeof v === 'number' && isFinite(v)), out = {};
          out.rs = ['toString', 'constructor', '__proto__'].every(k => fin(wJT.rs(k)) && fin(wJT.rate(k)));
          out.sway = ['toString', 'constructor', '__proto__'].every(k => fin(wJT.sway({ pace: k, mount: k })) && isFinite(wJT.rideSpeed({ pace: k, mount: k })));
          const c = wJT.charge({ plan: { aim: 'toString', guard: 'valueOf', pace: 'constructor' }, rs: wJT.rs(''), mount: '__proto__', wind: 1 }, __rng(3));
          out.charge = [isFinite(c.tip.x) && isFinite(c.tip.y) && isFinite(c.speed), c.aim, c.guard, c.pace, c.mount];
          const st = wJT.strike(c, { guard: 'toString', rs: wJT.rs(''), mount: 'toString' }, __rng(4)); out.strike = isFinite(st.force) && isFinite(st.rock) && typeof st.at === 'string';
          wJT.start({ seed: 2, mounts: [['toString', 'charger'], ['constructor', '__proto__']] }); out.mounts = wJT.G.mounts;
          return out; })()""")
        check(ok['rs'] and ok['sway'] and ok['strike'] and ok['charge'] == [True, 'shield', 'square', 'canter', 'destrier'] and ok['mounts'] == [['destrier', 'charger'], ['destrier', 'destrier']],
              'a kind, pace, aim, guard or mount named by an inherited key (toString, constructor, __proto__) falls back to the default, and the numbers stay finite', ok)

        # ---------- the sim leaves the match alone ----------
        d = await pg.evaluate("""(() => { wJT.start({ seed: 9, skill: [1, 1] }); for (let i = 0; i < 2; i++) wJT.turn(); const want = JSON.stringify(wJT.G);
          const a = wJT.simMatch({ seed: 77 }), b = wJT.simMatch({ seed: 77 }), c = wJT.simMatch({ seed: 78 }); wJT.simMatch({});
          const same = JSON.stringify(wJT.G) === want;
          const s1 = (() => { wJT.start({ seed: 31, skill: [1, 1] }); for (let i = 0; i < 4; i++) wJT.turn(); return JSON.stringify(wJT.G.log); })();
          const s2 = (() => { wJT.start({ seed: 31, skill: [1, 1] }); for (let i = 0; i < 2; i++) wJT.turn(); wJT.simMatch({}); wJT.simMatch({ seed: 5 }); for (let i = 0; i < 2; i++) wJT.turn(); return JSON.stringify(wJT.G.log); })();
          const t = wJT.turn(); return { same, repeat: JSON.stringify(a) === JSON.stringify(b), differ: JSON.stringify(a.log) !== JSON.stringify(c.log), stream: s1 === s2, json: want === JSON.stringify(JSON.parse(want)),
            turn: !!t && t.plans.length === 2 && t.rides.length === 2 && !!t.rule && t.plans.every(p => p.why), box: Object.keys(a.st[0]) }; })()""")
        check(d['same'] and d['repeat'] and d['differ'] and d['stream'] and d['json'], 'simMatch leaves the match on the lists and its seeded stream alone; the same seed rides the same match; the match is plain JSON', d)
        check(d['turn'] and d['box'] == ['courses', 'breaks', 'helms', 'unhorse', 'unhorsed', 'glances', 'misses', 'fouls', 'rocked', 'kept'], 'a course ridden says each side\'s plan (with its reason), ride and result; the box score counts breaks, helms, unhorsings and seats kept', d)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
