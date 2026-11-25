# Realm lists (issue #117, phase 3): jousting ratings, the four (two riders, two squires), the mounts, the arm, the
# shake, the squires' corner, pressure and nerve.
# The engine: every league kind has seven jousting ratings with its own character (an elf's lance, a golem's seat, a
# minotaur's ride, a spider's care, a harpy's light seat); the captain's pick rides the best riders (the steadier nerve
# second) and squires the best squires; riders left out come from the ratings, the best rider for the tilt by nerve and
# lance; the ratings decide matches. An early couch tires the arm and a tired arm sways; a rocking hit kept shakes the
# rider (more sway, a worse seat), and it wears off. The corner: between courses with the same riders, two different
# jobs; tend gives back a share of the lost wind, steady the shake and the arm, the girth a seat for one course; care
# sets how much. A Squire's corner picks anything, a Knight's works it out and beats it; any corner beats none.
# Pressure: the last course behind and the tilt; nerve takes it off. On Play your squires' jobs are yours, your corner
# suggesting. Each mount has a case where it's the better pick. Phase 1's targets hold with real kinds.
# The Realm: every player has jousting ratings within a point of their kind, each level adds a point; an older save's
# players get theirs; the four: your players first, call-ups at your level; roles swap, a reserve steps in; a mount is
# picked or the captain's; your four go to the engine with their ratings, roles and mounts. The Lists tab, the practice
# match, the rider and squires rows, the Stats tab's Jousting view and the card, the box lines, and How to play.
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

HELP = r"""
window.__T = (ks, r, x) => Object.assign({ name: ks.join(''), short: ks[0].slice(0, 3), roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, r ? { r: Object.assign({}, r) } : {})) }, x || {});
window.__run = (n, s0, o) => { const w = [0, 0]; for (let i = 0; i < n; i++) w[wJT.simMatch(Object.assign({ seed: s0 + i }, o)).win]++; return w; };
window.__ride = () => { let k = 0; while (!wJT.G.over && k++ < 200) wJT.turn(); };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- ratings and roles ----------
        k = await pg.evaluate("""(() => { const stars = new Set(W_STARS.map(x => x.kind || x.id)), kinds = Object.keys(FA_NAMES).filter(k => !stars.has(k)), missing = kinds.filter(k => !Object.prototype.hasOwnProperty.call(wJT.kinds, k) || wJT.stats.some(s => wJT.rate(k)[s] === 6.5));
          const R = k => wJT.rate(k), range = kinds.every(k => wJT.stats.every(s => R(k)[s] >= 1 && R(k)[s] <= 12));
          return { stats: wJT.stats, cap: wJT.cap, missing, range, notes: { elf: R('elf').lance >= 10, golem: R('golem').seat === 12 && R('golem').ride <= 4, minotaur: R('minotaur').ride >= 11, spider: R('spider').care === 12, harpy: R('harpy').seat <= 3 } }; })()""")
        check(k['stats'] == ['lance', 'couch', 'seat', 'shield', 'ride', 'nerve', 'care'] and k['cap'] == 12 and not k['missing'] and k['range'] and all(k['notes'].values()),
              'every league kind has jousting ratings with a character: an elf\'s lance, a golem\'s seat (and its ride), a minotaur\'s charge, a spider\'s care, a harpy\'s light seat', k)
        a = await pg.evaluate("""(() => { const A = wJT.autoSquad([{ kind: 'spider' }, { kind: 'elf' }, { kind: 'kobold' }, { kind: 'golem' }]);
          const G = wJT.start({ seed: 3, teams: [__T(['spider', 'elf', 'kobold', 'golem'], {}), __T(['ogre', 'ogre', 'ogre', 'ogre'])] });
          const fit = wJT.fit(wJT.rs('elf'), 'rider') > wJT.fit(wJT.rs('spider'), 'rider') && wJT.fit(wJT.rs('spider'), 'squire') > wJT.fit(wJT.rs('elf'), 'squire');
          const bestB = wJT.bestOf([{ kind: 'goblin' }, { kind: 'lich' }], [0, 1]);
          return { A, riders: G.riders[0], squires: G.squires[0], best: G.best[0], bestB, other: [G.riders[1], G.squires[1]], fit }; })()""")
        check(a['A'] == {'riders': [1, 3], 'squires': [0, 2]} and a['fit'], 'the captain\'s pick: the elf and the golem ride (the golem\'s nerve the second heat), the spider and the kobold squire', a)
        check(a['riders'] == [1, 3] and a['squires'] == [0, 2] and a['best'] == 0 and a['bestB'] == 1, 'riders left out come from the ratings, the squires are the rest, and the best rider for the tilt is by nerve and lance (the elf; a lich over a goblin)', a)
        check(a['other'] == [[0, 1], [2, 3]], 'a roster that brings no ratings rides its first two, as before', a['other'])
        w = await pg.evaluate("""(() => ({ good: __run(40, 100, { skill: [1, 1], teams: [__T(['vampire', 'vampire', 'vampire', 'vampire'], { lance: 12, couch: 12, seat: 12, shield: 12 }), __T(['vampire', 'vampire', 'vampire', 'vampire'], { lance: 2, couch: 2, seat: 2, shield: 2 })] }),
          even: __run(120, 300, { skill: [1, 1], teams: [__T(['elf', 'golem', 'spider', 'witch']), __T(['elf', 'golem', 'spider', 'witch'])] }) }))()""")
        check(w['good'][0] >= 34 and .38 <= w['even'][0] / 120 <= .62, 'the ratings decide matches: fine riders beat poor ones, and two sides alike split them', w)

        # ---------- the arm, the shake, pressure ----------
        m = await pg.evaluate("""(() => { const rs = wJT.rs(''), sw = o => wJT.sway(Object.assign({ pace: 'canter', mount: 'destrier', rs, wind: 1, couch: 0 }, o));
          wJT.start({ seed: 5, skill: [1, 1] }); const G = wJT.G, P = { aim: 'shield', guard: 'square', pace: 'canter' }, ride = c => Object.assign(wJT.charge({ plan: P, rs, mount: 'destrier', wind: 1 }, () => .5), { couch: c, tip: { x: 40, y: 0 } });
          wJT.rideCourse([P, P], [ride(-.8), ride(0)], [.5, .5]); const arm = G.arm.slice();
          const hit = { broke: true, rock: 1 }, seat = sh => wJT.seat(hit, { guard: 'square', rs, mount: 'destrier', shaken: sh }, .5, () => .5).hold, girth = wJT.seat(hit, { guard: 'square', rs, mount: 'destrier', girth: .08 }, .5, () => .5).hold;
          return { arm, tired: [sw({}).sigma, sw({ arm: .4 }).sigma, sw({}).droop, sw({ arm: .4 }).droop], shake: [sw({ shaken: 1 }).sigma, seat(0), seat(1), girth],
            press: [sw({ press: 1, rs: Object.assign({}, rs, { nerve: 0 }) }).sigma, sw({ press: 1, rs: Object.assign({}, rs, { nerve: 1 }) }).sigma], nk: [wJT.nerveK(1, 0), wJT.nerveK(1, 1), wJT.nerveK(0, 0)] }; })()""")
        check(m['arm'][0] < m['arm'][1] < 1, 'every couch tires the arm, an early one (a long hold) most', m['arm'])
        t = m['tired']; s = m['shake']
        check(t[1] > t[0] and t[3] > t[2], 'a tired arm sways more and the tip sags', t)
        check(s[0] > t[0] and s[2] < s[1] < s[3], 'a shaken rider sways more and sits a hit worse; a tight girth sits it better', s)
        check(m['press'][0] > t[0] and abs(m['press'][1] - t[0]) < 1e-9 and m['nk'] == [1.6, 1, 1], 'pressure sways a nervy rider more; a perfect nerve feels nothing', m)
        sh = await pg.evaluate("""(() => { const out = { kept: null, fade: null, early: null, lastBehind: null, lastAhead: null, tilt: null };
          for (let i = 0; i < 400 && out.kept == null; i++) { wJT.start({ seed: 900 + i, skill: [1, 1], cornerBy: ['none', 'none'] }); const ev = wJT.turn(); const se = ev.imp.seat[0];
            if (se.rocked && !se.unhorse && !ev.rule.heatOver) { const a = wJT.G.shaken[0]; wJT.turn(); out.kept = a; out.fade = wJT.G.shaken[0]; } }
          const st = a => ({ at: a, unhorse: false }); wJT.start({ seed: 7, skill: [1, 1], courses: 3 }); out.early = wJT.pressure(0);
          wJT.rideCourse([{ aim: 'shield', guard: 'square', pace: 'canter' }, { aim: 'shield', guard: 'square', pace: 'canter' }]); const G = wJT.G; G.sc[1][0][0] = 2; G.sc[0][0][0] = 0; G.course = 2;
          out.lastBehind = [wJT.pressure(0), wJT.pressure(1)]; G.sc[0][0][0] = 2; out.lastAhead = wJT.pressure(0); G.course = 0; out.mid = wJT.pressure(1);
          return out; })()""")
        check(sh['kept'] is not None and sh['kept'] > .3 and sh['fade'] < sh['kept'], 'a rocking hit kept leaves the rider shaken, and it wears off', sh)
        check(sh['early'] == 0 and sh['lastBehind'] == [1, 0] and sh['lastAhead'] == 0 and sh['mid'] == 0, 'pressure: the last course of a heat for the side behind, nobody else', sh)
        tl = await pg.evaluate("""(() => { const st = a => ({ at: a, unhorse: false }); wJT.start({ seed: 8, skill: [1, 1], cornerBy: ['none', 'none'] }); const G = wJT.G;
          for (let i = 0; i < 6; i++) wJT.course([st('miss'), st('miss')]); G.wind = [.8, .8]; G.arm = [.85, .85]; return [wJT.inTilt(), wJT.pressure(0), wJT.pressure(1)]; })()""")
        check(tl == [True, 1, 1], 'pressure: every course of the tilt for the crown, both sides', tl)

        # ---------- the corner ----------
        c = await pg.evaluate("""(() => { const P = { aim: 'shield', guard: 'square', pace: 'gallop' }, out = {};
          const T = (care) => __T(['vampire', 'vampire', 'vampire', 'vampire'], null, { roster: ['vampire', 'vampire', 'witch', 'witch'].map((k, i) => ({ n: 'v' + i, kind: k, r: i > 1 ? { care } : {} })) });
          wJT.start({ seed: 11, skill: [1, 1], teams: [T(12), T(1)], riders: [[0, 1], [0, 1]], squires: [[2, 3], [2, 3]] }); const G = wJT.G;
          out.first = G.cornerDue.slice(); wJT.rideCourse([P, P], null, [.5, .5]); out.due = G.cornerDue.slice(); out.wind = G.wind.slice();
          out.same = wJT.cornerDo(0, ['tend', 'tend']); out.bad = wJT.cornerDo(0, ['tend', 'nap']);
          G.shaken = [.8, .8];
          const w0 = G.wind.slice(); out.ok = [wJT.cornerDo(0, ['tend', 'steady']), wJT.cornerDo(1, ['tend', 'steady'])]; out.again = wJT.cornerDo(0, ['tend', 'girth']);
          out.tend = [(G.wind[0] - w0[0]) / (1 - w0[0]), (G.wind[1] - w0[1]) / (1 - w0[1])]; out.shake = G.shaken.slice(); out.log = G.corners[0].length && G.corners[0][0].jobs;
          wJT.rideCourse([P, P], null, [.5, .5]); out.due2 = G.cornerDue.slice(); out.girth0 = G.girth.slice(); wJT.cornerDo(0, ['girth', 'tend']); wJT.cornerDo(1, ['girth', 'tend']); out.girth = G.girth.slice();
          wJT.rideCourse([P, P], null, [.5, .5]); out.after = { heat: G.heat, due: G.cornerDue.slice(), girth: G.girth.slice(), wind: G.wind.slice(), arm: G.arm.slice() };
          out.jobs = G.pst[0][2].jobs; return out; })()""")
        check(c['first'] == [False, False] and c['due'] == [True, True], 'no corner before a heat\'s first course; one is due between courses with the same riders', c)
        check(c['same'] != '' and c['bad'] != '' and c['ok'] == ['', ''] and c['again'] != '', 'two squires, two different jobs of the three, once between courses', c)
        check(c['tend'][0] > c['tend'][1] > 0 and c['shake'][0] < c['shake'][1] < .8, 'care sets how much: a careful squire gets more of the wind back, and more of the shake off', c)
        check(c['girth'][0] > c['girth'][1] > 0 and c['girth0'] == [0, 0], 'a girth tightened between courses holds for the next course', c)
        check(c['after']['heat'] == 1 and c['after']['due'] == [False, False] and c['after']['girth'] == [0, 0] and c['after']['wind'] == [1, 1] and c['after']['arm'] == [1, 1] and c['jobs'] == 2,
              'a new heat\'s rider starts fresh (wind, arm, no girth, no corner), and a squire\'s jobs are counted', c['after'])
        cp = await pg.evaluate("""(() => { const seen = new Set(), why = [];
          for (let i = 0; i < 30; i++) { wJT.start({ seed: 40 + i, skill: [0, 1] }); __ride(); for (const x of wJT.G.corners[0]) seen.add(x.jobs.join('/')); for (const x of wJT.G.corners[1]) why.push(x.why); }
          return { squire: seen.size, why: why.slice(0, 3), named: why.every(w => /tends the mount|steadies the rider|tightens the girth/.test(w) && /nobody spare to/.test(w)), n: why.length }; })()""")
        check(cp['squire'] >= 5 and cp['n'] > 20 and cp['named'], 'a Squire\'s corner picks any two jobs; a Knight\'s says which squire does what, and why', cp)
        kv = await pg.evaluate("""(() => { const a = __run(1000, 20000, { skill: [1, 1], cornerBy: [null, 0] }), b = __run(1000, 30000, { skill: [1, 1], cornerBy: [0, null] }), n = __run(600, 40000, { skill: [1, 1], cornerBy: [null, 'none'] });
          return { k: a[0] + b[1], sq: a[1] + b[0], none: n }; })()""")
        print('   (a Knight\'s corner v a Squire\'s, 2000 matches:', kv['k'], '-', kv['sq'], '; a Knight\'s corner v none, 600:', kv['none'], ')')
        check(kv['k'] / 2000 >= .51 and kv['none'][0] / 600 >= .55, 'a Knight\'s corner beats a Squire\'s, and any corner beats none', kv)

        # ---------- on Play: your squires' jobs ----------
        pl = await pg.evaluate("""(() => { wJT.start({ seed: 12, mode: 'play', skill: [1, 1] }); wJT.pause(true); const out = {};
          const to = ph => { let n = 0; while (wJT.phase !== ph && n++ < 6000) wJT.tick(.05); return wJT.phase === ph; };
          to('plan'); out.first = wJT.view.jobs; out.notYet = wJT.select({ jobs: ['tend', 'girth'] });
          wJT.setMode('watch'); to('after'); wJT.setMode('play'); to('plan');
          const V = wJT.view; out.jobs = V.jobs; out.squad = !!V.squad && V.squad.squires[0].length === 2;
          out.swap = wJT.select({ job: [0, V.jobs[1]] }); out.swapped = wJT.view.jobs; out.same = out.swapped[0] !== out.swapped[1];
          out.set = wJT.select({ jobs: ['girth', 'steady'] }); out.corner = wJT.select({ corner: true }); out.back = wJT.view.jobs; wJT.select({ jobs: ['girth', 'steady'] });
          const n0 = wJT.G.corners[0].length; wJT.press(); out.done = wJT.G.corners[0].slice(n0).map(x => [x.jobs, x.why]); out.girth = wJT.G.girth[0];
          return out; })()""")
        check(pl['first'] is None and pl['notYet'] != '', 'before a heat\'s first course your squires have nothing to do', pl)
        check(pl['jobs'] and pl['squad'] and pl['swap'] == '' and pl['same'] and pl['set'] == '' and pl['corner'] == '' and pl['back'] and len(pl['back']) == 2,
              'between courses your corner suggests two jobs; you can give either squire another (they swap rather than double up)', pl)
        check(pl['done'] == [[['girth', 'steady'], 'your call']] and pl['girth'] > 0, 'your squires do your jobs when you ride', pl)

        # ---------- the mounts ----------
        # each mount has a case where it is the better pick (paired seeds, a Knight on either side, against a side of vampires on Destriers)
        mt = await pg.evaluate("""(() => { const T = k => __T([k, k, k, k]), out = {};
          const run = (k, c, m) => __run(400, 70000, { skill: [1, 1], courses: c, teams: [T(k), T('vampire')], mounts: [[m, m], ['destrier', 'destrier']] })[0];
          for (const [k, c] of __CASES) out[k + c] = { charger: run(k, c, 'charger'), destrier: run(k, c, 'destrier'), courser: run(k, c, 'courser') };
          return out; })()""".replace('__CASES', '[["elf", 3], ["dwarf", 5], ["harpy", 5]]'))
        for k2, v2 in mt.items(): print(f'   ({k2}: {v2})')
        best = {k2: max(v2, key=v2.get) for k2, v2 in mt.items()}
        check(best == {'elf3': 'charger', 'dwarf5': 'destrier', 'harpy5': 'courser'}, 'each mount has a case where it is the better pick: a Charger under an elf\'s lance in a short heat, a Destrier under a dwarf in a long one, a Courser under a harpy', best)
        mf = await pg.evaluate("[['elf', 3], ['dwarf', 5], ['harpy', 5]].map(([k, c]) => wJT.mountFor(wJT.rs(k), c).m)")
        check(mf == ['charger', 'destrier', 'courser'], 'the captain picks those mounts for them', mf)

        # ---------- phase 1's targets with real kinds ----------
        rk = await pg.evaluate("""(() => { const o = { n: 300, br: 0, c: 0, helm: 0, mu: 0, w: [0, 0] }, A = ['werewolf', 'elf', 'gorgon', 'spider'], B = ['minotaur', 'golem', 'harpy', 'ogre'];
          for (let i = 0; i < o.n; i++) { const r = wJT.simMatch({ seed: 1000 + i, skill: [1, 1], teams: [__T(A, {}), __T(B, {})] }); o.w[r.win]++; let u = 0;
            for (const s of [0, 1]) { o.c += r.st[s].courses; o.br += r.st[s].breaks; o.helm += r.st[s].helms; u += r.st[s].unhorse; } if (u) o.mu++; }
          return { w: o.w, brk: +(o.br / o.c).toFixed(3), helm: +(o.helm / o.c).toFixed(3), unh: +(o.mu / o.n).toFixed(3) }; })()""")
        print('   (Mossgate\'s kinds v Cinderhold\'s, Knights, 300:', rk, ')')
        check(.42 <= rk['brk'] <= .6 and rk['helm'] <= .04 and .22 <= rk['unh'] <= .45, 'with real kinds a Knight still breaks in about half its courses, helm breaks are rare, and about one match in three has an unhorsing', rk)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        r = await pg.evaluate("""(() => { const R = wRoster(), st = wJT.stats;
          const ok = R.every(p => p.jt && st.every(s => p.jt[s] >= 1 && p.jt[s] <= 12) && p.jt.lv === (p.lvl || 1));
          const near = R.every(p => { const k = wJT.rate(p.kind); return st.every(s => Math.abs(p.jt[s] - (p.jt.got[s] || 0) - k[s]) <= 1.5); });
          const p = R[0], sum = () => st.reduce((a, s) => a + p.jt[s], 0), lv0 = p.lvl, s0 = sum(); p.lvl = lv0 + 3; wJtOf(p); const grew = sum() - s0; p.lvl = lv0;
          return { ok, near, grew }; })()""")
        check(r['ok'] and r['near'] and r['grew'] == 3, 'every player has jousting ratings within a point of their kind; each level adds a point', r)
        ol = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); for (const p of save.WG.roster) delete p.jt; delete save.WG.lists;
          wStart(save); return { all: wRoster().every(p => p.jt && p.jt.lv === (p.lvl || 1)), four: !!WG.lists, saved: !!JSON.parse(localStorage.getItem(wSaveKey())).WG.lists }; })()""")
        check(ol == {'all': True, 'four': True, 'saved': True}, 'an older save\'s players get their jousting ratings when it loads, and a four (saved)', ol)
        f = await pg.evaluate("""(() => { const C = wListsSync(), keys = C.four, own = keys.filter(k => typeof k !== 'string').length;
          return { roster: wRoster().length, own, cu: C.cu.length, distinct: new Set(keys).size === 4, cuRated: C.cu.every(c => c.jt && c.lvl === wNineTier() && /^j\\d+$/.test(c.cid)), json: JSON.stringify(JSON.parse(JSON.stringify(WG.lists))) === JSON.stringify(WG.lists) }; })()""")
        check(f['own'] == min(4, f['roster']) and f['cu'] == 4 - f['own'] and f['distinct'] and f['cuRated'] and f['json'], 'the four: your players first, call-ups at your level fill it, plain JSON', f)
        a = await pg.evaluate("""(() => { const kinds = ['spider', 'elf', 'golem', 'kobold', 'troll', 'lich', 'ogre']; let i = 0;
          while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern'));
          wListsAuto(); const C = WG.lists, res = wListsReserves(C), fit = (k, r) => wJtFit(wListsWho(k), r);
          return { cu: C.cu.length, own: C.four.every(k => typeof k !== 'string'), res: res.length, roster: wRoster().length,
            riders: res.every(k => fit(C.four[0], 'rider') >= fit(k, 'rider') && fit(C.four[1], 'rider') >= fit(k, 'rider')), squires: res.every(k => fit(C.four[2], 'squire') >= fit(k, 'squire') || fit(k, 'rider') > fit(C.four[2], 'rider')), mine: !!C.mine }; })()""")
        check(a['cu'] == 0 and a['own'] and a['res'] == a['roster'] - 4 and a['riders'] and not a['mine'], 'with a full roster the four are yours, the rest reserves, and the captain puts the best riders on the horses', a)
        ch = await pg.evaluate("""(() => { const C = wListsSync(), r0 = C.four[0], s0 = C.four[2], res = wListsReserves(C)[0];
          const a = wListsSetRole(r0, 2), swap = C.four[2] === r0 && C.four[0] === s0;
          const m1 = C.four[1]; const b = wListsSetRole(res, 1), inn = C.four[1] === res && wListsReserves(C).includes(m1);
          const m3 = C.four[3]; const c = wListsSetRole(m3, 'reserve'), out = wListsReserves(C).includes(m3) && C.four[3] !== m3;
          const rider = wListsWho(C.four[0]), cap = wJtMountOf(rider), d = wListsSetMount(C.four[0], 'courser'), set = wJtMountOf(rider) === 'courser' && rider.jtMount === 'courser';
          const e = wListsSetMount(C.four[0], 'toString'), f = wListsSetMount(C.four[0], 'auto'), back = !('jtMount' in rider) && wJtMountOf(rider) === cap;
          wListsSetMount(C.four[1], 'charger'); const T = wListsMine();
          return { r: [a, b, c, d, f], bad: e, swap, inn, out, set, back, mine: !!C.mine, team: { n: T.roster.length, riders: T.riders, squires: T.squires, mounts: T.mounts, first: T.roster[0].n === wListsWho(C.four[0]).n, r: Object.keys(T.roster[0].r), best: T.best === 0 || T.best === 1 || T.best === null } }; })()""")
        check(ch['r'] == ['', '', '', '', ''] and ch['bad'] != '' and ch['swap'] and ch['inn'] and ch['out'] and ch['mine'], 'a role change swaps; a reserve into a role takes it; to the reserves, the best reserve for it steps in', ch)
        check(ch['set'] and ch['back'], 'a rider\'s mount is picked on the player (only the stable\'s three), and the captain\'s again', ch)
        check(ch['team']['n'] == 4 and ch['team']['riders'] == [0, 1] and ch['team']['squires'] == [2, 3] and ch['team']['mounts'][1] == 'charger' and ch['team']['first'] and ch['team']['r'] == ['lance', 'couch', 'seat', 'shield', 'ride', 'nerve', 'care'] and ch['team']['best'],
              'your four go to the engine with their own ratings, their roles and their mounts', ch['team'])

        await pg.evaluate("wOpenCamp('lists')")
        await pg.wait_for_selector('#wCampBody .wlistsfour')
        t = await pg.evaluate("""(() => { const b = document.getElementById('wCampBody'); return { four: b.querySelectorAll('.wlistsfour [data-jrole]').length, mounts: b.querySelectorAll('.wlistsfour [data-jmount]').length, res: b.querySelectorAll('.wlistsres [data-jrole]').length,
          auto: !!b.querySelector('[data-jauto]'), practice: !!b.querySelector('[data-jpractice]'), tab: !!document.querySelector('[data-ctab="lists"][aria-pressed="true"]'), shed: !!document.querySelector('[data-ctab="shed"]') }; })()""")
        check(t['four'] == 4 and t['mounts'] == 2 and t['res'] >= 1 and t['auto'] and t['practice'] and t['tab'] and t['shed'], 'the Lists tab (beside the Shed tab): the four in their roles, a mount for each rider, the reserves, the captain\'s pick and a practice match', t)
        sel = await pg.evaluate("""(() => { const s = document.querySelector('#wCampBody .wlistsres [data-jrole]'), k = +s.closest('[data-cid]').dataset.cid; s.value = '0'; s.dispatchEvent(new Event('change'));
          const m = document.querySelector('#wCampBody .wlistsfour [data-jmount]'), mk = +m.closest('[data-cid]').dataset.cid; m.value = 'destrier'; m.dispatchEvent(new Event('change'));
          return { k, r0: WG.lists.four[0], mount: wListsWho(mk).jtMount }; })()""")
        check(sel['k'] == sel['r0'] and sel['mount'] == 'destrier', 'picking a role or a mount on the tab sets it', sel)
        await pg.click('#wCampBody [data-jpractice]')
        await pg.wait_for_function("UI.view === 'lists' && !!wJT.G && !!wJT.G.teams")
        pt = await pg.evaluate("""(() => { const G = wJT.G, T = G.teams[0], M = wListsMine(); return { clash: T.roster.filter(m => G.teams[1].roster.some(o => o.n === m.n)).length, names: T.roster.map(m => m.n), want: WG.lists.four.map(k => wListsWho(k).n),
          riders: G.riders[0], squires: G.squires[0], mounts: G.mounts[0], want_m: M.mounts, rated: T.roster.every(m => m.r && m.r.care >= 1), title: document.getElementById('wListsTitle').textContent }; })()""")
        check(pt['clash'] == 0 and pt['names'] == pt['want'] and pt['riders'] == [0, 1] and pt['squires'] == [2, 3] and pt['mounts'] == pt['want_m'] and pt['rated'] and 'practice' in pt['title'],
              'the practice match rides your four, in their roles, on their mounts, against the Lists\' own riders', pt)
        up = await pg.evaluate("""(() => { W_LISTS_MODE = 'play'; wJT.setMode('play'); wJT.pause(true); const to = ph => { let n = 0; while (wJT.phase !== ph && n++ < 20000) wJT.tick(.05); };
          to('plan'); wListsRows(); const first = { up: document.getElementById('wListsUp').textContent, sq: document.getElementById('wListsRowSq').hidden };
          wJT.setMode('watch'); to('after'); wJT.setMode('play'); to('plan'); wListsRows();
          const row = document.getElementById('wListsRowSq'), btn = row.querySelector('[data-jsq="1"][data-jjob="girth"]') || row.querySelector('[data-jsq="1"]:not(.on)'); const want = btn.dataset.jjob; btn.click(); wListsRows();
          return { first, up: document.getElementById('wListsUp').textContent, sq: !row.hidden, btns: row.querySelectorAll('[data-jjob]').length, picked: wJT.view.jobs[1] === want, on: !!row.querySelector(`[data-jsq="1"][data-jjob="${want}"].on`) }; })()""")
        check('Wind' in up['first']['up'] and 'Arm' in up['first']['up'] and up['first']['sq'], 'your course\'s rows say who rides, on what, the wind and the arm; no squires\' row before a heat\'s first course', up)
        check(up['sq'] and up['btns'] == 6 and up['picked'] and up['on'], 'between courses the squires\' row gives each squire the three jobs, and a pick shows', up)
        await pg.evaluate("wLeaveLists()")
        await pg.wait_for_function("UI.view === 'world'")
        rec = await pg.evaluate("""(() => { const S = wJT.simMatch({ seed: 5, skill: [1, 1], teams: [wListsMine(), wListsTeams()[1]] }), keys = WG.lists.four.slice(); wJtRecord(S, 0, keys); wJtRecord(S, 0, keys);
          const k = keys.find(x => typeof x === 'number'), L = WG.jtstats[k], i = keys.indexOf(k); return { m: L.m, c: L.c === 2 * (S.pst[0][i].courses || 0), brk: L.brk === 2 * (S.pst[0][i].breaks || 0), keys: Object.keys(L) }; })()""")
        check(rec['m'] == 2 and rec['c'] and rec['brk'] and rec['keys'] == ['m', 'c', 'brk', 'helm', 'unh', 'unhd', 'kept', 'jobs'], 'a match\'s box lines add up on each of your players (phase 5\'s matches record them)', rec)
        sv = await pg.evaluate("""(() => { WSTAT.view = 'jousting'; const h = wCampStats(); const p = wPlayer(WG.lists.four.find(x => typeof x === 'number')); WSTAT.view = 'curling'; const hc = wCampStats();
          return { btn: /data-wsview="jousting"/.test(h) && /data-wsview="jousting"/.test(hc), cols: ['Lan', 'Cou', 'Sea', 'Shi', 'Rid', 'Ner', 'Car', 'Brk', 'Helm', 'Unh', 'Kept'].every(c => h.includes('>' + c + '<')), rows: (h.match(/data-wsp="/g) || []).length, n: wRoster().length,
            card: /<h5>Jousting<\\/h5>/.test(wStatsCard(p)) && /In your four/.test(wStatsCard(p)) && /jousting match/.test(wStatsCard(p)) }; })()""")
        check(sv['btn'] and sv['cols'] and sv['rows'] == sv['n'] and sv['card'], 'the Stats tab has a Jousting view (ratings, roles and box lines), and a player\'s card a Jousting block', sv)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ tab: !!document.getElementById('wHelpListsTab'), how: ['Ratings.', 'Riders and squires.', 'Mounts.', 'The arm and the shake.', 'Your squires.', 'Nerve.'].every(w => (document.getElementById('wListsHow') || {}).textContent.includes(w)) })")
        check(hp == {'tab': True, 'how': True}, 'How to play explains the ratings, riders and squires, the mounts, the arm and the shake, the squires\' jobs and nerve', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
