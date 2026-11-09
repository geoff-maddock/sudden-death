# Realm ring, powers (issue #23, phase 4): every kind has a special (once a round) and an ultimate (once a bout). Each
# power does what its data says: what it does at once (a stun, damage through the guard, a push to the ropes, a dash in,
# stamina off, health back, a counter window) and the status it leaves, on the right fighter. A few end to end:
# Petrify freezes them in stone, Vanish and Take Flight make punches miss, Stone Skin and Rampart take the damage off,
# Drain heals on what lands, Undying stays up on 1, Grave Hands roots them. The limits: once a round and once a bout,
# the stamina, never down, stunned, clinched, mid-punch or outside a round, none with powers off; statuses wear off and
# end at the bell. The CPU casts in its bouts (none with powers off), and no kind always wins or loses with them. In the
# (spirit, issue #61 phase 4: the checks that cast at once fill each fighter's meter first; test/realm_ring_spirit.py tests the meter)
# Realm: Q and R (and the pad's buttons, named for your fighter's powers) cast in You box; in You corner your fighter
# casts by themselves; How to play has every kind's powers. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-ring-powers-*.png.
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

# two fighters set up in round 1, standing still, fresh and d apart (kinds: [yours, theirs])
SETUP = """(d, kinds, o) => { wBX.start(Object.assign({ fighters: (kinds || ['vampire', 'vampire']).map((k, i) => ({ n: 'F' + i, kind: k })), seed: 7 }, o || {}));
  for (let i = 0; i < 100 && wBX.phase === 'intro'; i++) wBX.step();
  const G = wBX.G; G.F[0].x = -d / 2; G.F[1].x = d / 2; G.F[0].y = G.F[1].y = 0;
  for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.mv = [0, 0]; f.think = 99; f.r.chin = 60; f.spirit = 100; } return G; }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined'"); await pg.evaluate(f"wBX.speed = 4; window.__setup = {SETUP}; 0")

        # ---------- every kind, two powers (the 18 league kinds and the Phoenix, a superstar: issue #24) ----------
        bk = await pg.evaluate("(() => { const B = wBX.powerBook; return { kinds: Object.keys(B).length, all: wBX.kinds.every(k => B[k] && B[k].sp.n && B[k].sp.desc && B[k].ult.n && B[k].ult.desc), cost: wBX.powerCost }; })()")
        STARS = await pg.evaluate("W_STARS.filter(s => s.kind).length")  # superstars built so far (issue #24): each is a kind of its own
        check(bk['kinds'] == 18 + STARS and bk['all'] and bk['cost'] == {'sp': 8, 'ult': 15}, 'every kind has a special and an ultimate, named and described; a special costs 8 stamina, an ultimate 15', bk)

        # ---------- each power does what its data says ----------
        each = await pg.evaluate("""(() => { const D = wBX.powerData, bad = [];
          for (const kind of wBX.kinds) for (const which of ['sp', 'ult']) {
            const P = D[kind][which], N = P.now || {}, G = __setup(N.dash ? 5 : 2, [kind, 'golem']), f = G.F[0], o = G.F[1];
            f.hp = 50; const before = { fhp: f.hp, ohp: o.hp, osta: o.sta, fsta: f.sta, d: wBX.dist(), ox: o.x, fx: f.x };
            const ok = wBX.cast(0, which); const why = [];
            if (!ok) { bad.push(kind + ' ' + which + ': not cast'); continue; }
            if (Math.round(before.fsta - f.sta) !== wBX.powerCost[which]) why.push('stamina ' + (before.fsta - f.sta));
            if (N.stun && o.a.k !== 'stun') why.push('no stun');
            if ((N.dmg || N.hits) && !(o.hp < before.ohp)) why.push('no damage');
            if (N.push && !(Math.abs(o.x) > Math.abs(before.ox) + .5 || Math.abs(o.x) >= 8.2)) why.push('no push');
            if (N.dash && !(f.x > before.fx + .5)) why.push('no dash');
            if (N.hp && !(f.hp > before.fhp)) why.push('no health back');
            if (N.sta && !(o.sta < before.osta)) why.push('no stamina off');
            if (N.ctr && !(f.ctr > 0)) why.push('no counter window');
            if (P.fx) { const on = P.fx.who === 'self' ? f : o, off = P.fx.who === 'self' ? o : f;
              if (!on.fx.some(s => s.id === P.id)) why.push('no status on ' + P.fx.who); if (off.fx.some(s => s.id === P.id)) why.push('status on the wrong fighter'); }
            if (why.length) bad.push(kind + ' ' + which + ': ' + why.join(', ')); }
          return bad; })()""")
        check(not each, 'each of the 36 powers does what it says at once, and leaves its status on the right fighter, for its stamina', each)

        # ---------- a few end to end ----------
        e2e = await pg.evaluate("""(() => { const out = {}, last = () => wBX.ev[wBX.ev.length - 1];
          let G = __setup(2, ['gorgon', 'elf']); wBX.cast(0, 'sp'); out.petrify = [G.F[1].a.k, !!G.F[1].a.stone];
          G = __setup(2, ['wraith', 'ogre']); wBX.cast(0, 'sp'); wBX.land(1, 'hook'); out.vanish = [last().k, last().why];
          G = __setup(2, ['harpy', 'ogre']); wBX.cast(0, 'sp'); wBX.land(1, 'body'); out.flight = [last().k, last().why];
          const dmgs = (kind, cast, k) => { let n = 0, t = 0; for (let i = 0; i < 60; i++) { const G = __setup(2, [kind, 'ogre']); G.F[0].r.chin = 5; if (cast) wBX.cast(0, cast);
            G.F[0].a = { k: 'stun', t: 0, dur: 9, id: 0 }; const h = G.F[0].hp, n0 = wBX.ev.length; wBX.land(1, k); if (wBX.ev.slice(n0).some(e => e.k === 'land')) { n++; t += h - G.F[0].hp; } } return t / Math.max(1, n); };
          out.stone = [dmgs('golem', null, 'hook'), dmgs('golem', 'sp', 'hook')]; out.rampart = [dmgs('golem', 'ult', 'hook'), dmgs('golem', 'ult', 'body'), dmgs('golem', null, 'body')];
          G = __setup(2, ['vampire', 'ogre']); G.F[0].hp = 40; wBX.cast(0, 'sp'); G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; let tries = 0; while (last().k !== 'land' && tries++ < 40) wBX.land(0, 'hook'); out.drain = G.F[0].hp > 40;
          G = __setup(2, ['zombie', 'ogre']); wBX.cast(0, 'sp'); G.F[0].hp = .5; G.F[0].r.chin = 1; G.F[0].a = { k: 'stun', t: 0, dur: 9, id: 0 }; tries = 0; while (G.F[0].hp === .5 && tries++ < 40) wBX.land(1, 'hook');
          out.undying = [G.F[0].hp, G.down, G.F[0].fx.some(s => s.undying)];
          G = __setup(4, ['lich', 'elf']); wBX.cast(0, 'ult'); const x0 = G.F[1].x; G.F[1].mv = [1, 0]; G.F[1].think = 99; for (let i = 0; i < 10; i++) wBX.step(); out.root = Math.abs(G.F[1].x - x0) < .01;
          return out; })()""")
        check(e2e['petrify'] == ['stun', True], 'Petrify freezes them, in stone', e2e)
        check(e2e['vanish'] == ['miss', 'through'] and e2e['flight'] == ['miss', 'over'], 'Vanish: punches pass through; Take Flight: body shots go under', e2e)
        st, rp = e2e['stone'], e2e['rampart']
        check(st[1] < st[0] * .5 and rp[0] == 0 and rp[1] < rp[2] * .6, 'Stone Skin takes most of the damage off; under Rampart a head punch does nothing and a body shot half', e2e)
        check(e2e['drain'], 'Drain: what lands comes back as health', e2e)
        check(e2e['undying'] == [1, None, False], 'Undying: the knockdown that should come, they stay up on 1, and it is spent', e2e)
        check(e2e['root'], 'Grave Hands: they can\'t move', e2e)

        # ---------- the edges: one knockdown at a time, Rampart, what heals, Vanish against a power, a leaky guard ----------
        ed = await pg.evaluate("""(() => { const out = {}, ev0 = () => wBX.ev.length;
          // A under Plague at the last of their health lands the punch that drops B: B goes down, A stays up
          let G = __setup(2, ['ogre', 'elf']); const [A, B] = G.F; A.r.chin = 60; B.r.chin = 1; B.hp = .1;
          A.fx = [{ id: 'plague', n: 'Plague Cloud', t: 5, regHp: -2 }]; A.hp = .05; wBX.act(0, 'hook'); B.a = { k: 'stun', t: 0, dur: 9, id: 0 };
          A.a.t = A.a.hitAt - .01; const R0 = Math.random; for (let i = 0; i < 2 && G.down == null; i++) wBX.step();
          out.oneKd = { down: G.down, A: A.a.k, B: B.a.k, Ahp: A.hp > 0 };
          // Rampart: a head punch scores nothing and leaves the Axe's buff for a body shot
          G = __setup(2, ['golem', 'dwarf']); wBX.cast(1, 'sp'); wBX.cast(0, 'ult'); G.F[0].a = { k: 'stun', t: 0, dur: 9, id: 0 }; const l0 = G.F[1].rs.landed, h0 = G.F[0].hp, n0 = ev0();
          wBX.land(1, 'hook'); out.rampart = { landed: G.F[1].rs.landed - l0, hp: h0 - G.F[0].hp, ev: wBX.ev.slice(n0).map(e => e.k), buff: G.F[1].fx.some(s => s.nextMul) };
          // Drain heals on what lands, not on a block
          G = __setup(2, ['vampire', 'ogre']); G.F[0].hp = 40; wBX.cast(0, 'sp'); G.F[1].a = { k: 'guard', t: 0, dur: 9, id: 0 }; let n = 0, blk = 0; const hpB = G.F[0].hp;
          while (n++ < 60) { const e0 = ev0(); wBX.land(0, 'jab'); if (wBX.ev.slice(e0).some(e => e.k === 'block')) blk++; } out.drainBlock = { blocks: blk, healed: G.F[0].hp - hpB };
          // a power's hit passes through Vanish
          G = __setup(2, ['ogre', 'wraith']); wBX.cast(1, 'sp'); const hv = G.F[1].hp; G.F[0].sta = 99; wBX.cast(0, 'sp'); out.vanish = G.F[1].hp === hv;
          // a leaky guard lets through twice as much
          const thru = leaky => { let t = 0, k = 0; for (let i = 0; i < 80; i++) { const G = __setup(2, ['ogre', 'elf']); G.F[1].r.chin = 5; G.F[1].a = { k: 'guard', t: 0, dur: 9, id: 0 }; if (leaky) G.F[1].fx = [{ id: 'firebreath', n: 'Fire Breath', t: 9, leaky: 1 }];
            const h = G.F[1].hp, e0 = wBX.ev.length; wBX.land(0, 'jab'); if (wBX.ev.slice(e0).some(e => e.k === 'block')) { k++; t += h - G.F[1].hp; } } return t / Math.max(1, k); };
          out.leaky = [thru(false), thru(true)];
          return out; })()""")
        check(ed['oneKd'] == {'down': 1, 'A': 'idle', 'B': 'down', 'Ahp': True}, 'one knockdown at a time: a status tick can\'t drop the puncher in the step their punch drops the other', ed['oneKd'])
        check(ed['rampart'] == {'landed': 0, 'hp': 0, 'ev': ['block'], 'buff': True}, 'under Rampart a head punch scores nothing, and the Axe\'s buff is kept for one that lands', ed['rampart'])
        check(ed['drainBlock']['blocks'] > 20 and ed['drainBlock']['healed'] == 0, 'Drain heals on what lands, not on a blocked punch', ed['drainBlock'])
        check(ed['vanish'], 'a power\'s hit passes through a fighter who has vanished', ed)
        lk = ed['leaky']
        check(1.7 < lk[1] / max(.01, lk[0]) < 2.3, 'a leaky guard lets twice as much through', lk)

        # ---------- each kind's nature (a trait for some): the edges and the weaknesses ----------
        nt = await pg.evaluate("""(() => { const out = {}, avg = (fn, n) => { let s = 0, k = 0; for (let i = 0; i < n; i++) { const v = fn(); if (v != null) { s += v; k++; } } return k ? s / k : null; };
          const even = { reach: 5, pow: 5, spd: 5, chin: 5, sta: 5, gui: 5 }, pair = (a, b, d) => { const G = __setup(d || 2, [a, b]); for (const f of G.F) Object.assign(f.r, even); return G; };
          // spider: a longer jab, and a landed jab halts a fighter coming forward
          let G = pair('spider', 'elf'); out.reach = +(wBX.range(0, 'jab') - wBX.range(1, 'jab')).toFixed(2);
          G = pair('spider', 'elf'); G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; let n = 0; while (!(G.F[1].halt > 0) && n++ < 40) wBX.land(0, 'jab');
          G.F[1].a = { k: 'idle', t: 0, dur: 0, id: 0 }; const x0 = G.F[1].x; G.F[1].mv = [-1, 0]; G.F[1].think = 99; wBX.step(); out.stick = { halt: G.F[1].halt > 0, held: Math.abs(G.F[1].x - x0) < .01 };
          // a body shot on a skeleton, against the same on an elf: less damage, no breath taken
          const body = kind => avg(() => { const G = pair('ogre', kind); G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; const h = G.F[1].hp, s = G.F[1].sta, e0 = wBX.ev.length; wBX.land(0, 'body'); return wBX.ev.slice(e0).some(e => e.k === 'land') ? [h - G.F[1].hp, s - G.F[1].sta] : null; }, 1) || [0, 0];
          const bodyAvg = kind => { let d = 0, s = 0, k = 0; for (let i = 0; i < 60; i++) { const G = pair('ogre', kind); G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; const h = G.F[1].hp, st = G.F[1].sta, e0 = wBX.ev.length; wBX.land(0, 'body'); if (wBX.ev.slice(e0).some(e => e.k === 'land')) { d += h - G.F[1].hp; s += st - G.F[1].sta; k++; } } return [d / k, s / k]; };
          out.hollow = [bodyAvg('skeleton'), bodyAvg('elf')];
          // a counter from a lich, and a counter taken by a minotaur, against plain fighters
          const ctr = (a, b) => { let d = 0, k = 0; for (let i = 0; i < 60; i++) { const G = pair(a, b); G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; G.F[0].ctr = 1; wBX.act(0, 'jab'); G.F[0].a.done = true; const h = G.F[1].hp, e0 = wBX.ev.length; wBX.land(0, 'jab'); if (wBX.ev.slice(e0).some(e => e.k === 'land')) { d += h - G.F[1].hp; k++; } } return d / k; };
          out.ctr = { lich: ctr('lich', 'elf'), minotaur: ctr('elf', 'minotaur'), plain: ctr('elf', 'elf') };
          // a werewolf's second wind, once
          G = pair('werewolf', 'elf'); G.F[0].sta = 5; G.F[0].hp = 20; wBX.step(); const s1 = G.F[0].sta; G.F[0].sta = 5; wBX.step(); out.wind = [s1 > 15, G.F[0].sta < 15];
          // a kobold's corner: all its breath back
          G = pair('kobold', 'ogre'); for (const f of G.F) f.r.chin = 60; n = 0; while (G.clock > .1 && n++ < 4000) wBX.step(); for (const f of G.F) f.sta = 10; n = 0; while (wBX.phase !== 'corner' && n++ < 40) wBX.step(); out.corner = [G.F[0].sta === G.F[0].staMax, G.F[1].sta < G.F[1].staMax];
          // an ogre's breath comes back slower than an elf's of the same stamina
          G = pair('ogre', 'elf'); for (const f of G.F) { f.sta = 10; f.think = 99; } G.F[0].x = -6; G.F[1].x = 6; for (let i = 0; i < 20; i++) wBX.step(); out.breath = G.F[0].sta < G.F[1].sta;
          // a zombie loses more of its most health to a hook
          const rot = kind => { let d = 0, k = 0; for (let i = 0; i < 40; i++) { const G = pair('ogre', kind); G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; const m = G.F[1].hpMax, e0 = wBX.ev.length; wBX.land(0, 'hook'); if (wBX.ev.slice(e0).some(e => e.k === 'land')) { d += m - G.F[1].hpMax; k++; } } return d / k; };
          out.rot = [rot('zombie'), rot('elf')];
          return { out, book: Object.keys(wBX.traits).length }; })()""")
        o = nt['out']
        check(nt['book'] == 11 + STARS and abs(o['reach'] - .3) < .01 and o['stick'] == {'halt': True, 'held': True}, 'Long Arms: the spider\'s jab reaches further, and a landed jab stops a fighter coming forward', o)
        check(o['hollow'][0][0] < o['hollow'][1][0] * .9 and o['hollow'][0][1] == 0 and o['hollow'][1][1] > 0, 'Hollow: a body shot hurts a skeleton less and takes none of its breath', o['hollow'])
        check(o['ctr']['lich'] > o['ctr']['plain'] * 1.15 and o['ctr']['minotaur'] > o['ctr']['plain'] * 1.15, 'Cold Read: a lich counters harder; Charges In: a minotaur takes counters harder', o['ctr'])
        check(o['wind'] == [True, True], 'Second Wind: once a bout, badly hurt, a werewolf gets its breath back', o['wind'])
        check(o['corner'] == [True, True], 'Quick Recovery: a kobold has all its breath back between rounds (the other side doesn\'t)', o['corner'])
        check(o['breath'] and o['rot'][0] > o['rot'][1] * 1.3, 'Heavy Breather: an ogre\'s breath comes back slower; Rotting: a zombie loses more of its most health to a hook', o)

        # ---------- the limits ----------
        lim = await pg.evaluate("""(() => { const out = {}; let G = __setup(2, ['troll', 'elf']); const f = G.F[0];
          out.first = wBX.cast(0, 'sp'); out.again = [wBX.cast(0, 'sp'), wBX.powers(0).sp.why]; out.ult = wBX.cast(0, 'ult'); out.ult2 = [wBX.cast(0, 'ult'), wBX.powers(0).ult.why];
          G = __setup(2, ['troll', 'elf']); G.F[0].sta = 3; out.breath = [wBX.cast(0, 'sp'), wBX.powers(0).sp.why];
          for (const k of ['stun', 'down', 'clinch']) { G = __setup(2, ['troll', 'elf']); G.F[0].a = { k, t: 0, dur: 9, id: 0 }; out[k] = wBX.cast(0, 'sp'); }
          G = __setup(2, ['troll', 'elf']); wBX.act(0, 'hook'); out.punching = wBX.cast(0, 'sp');
          G = __setup(2, ['troll', 'elf']); G.F[1].a = { k: 'down', t: 0, dur: 9, id: 0 }; out.theyDown = wBX.cast(0, 'sp');
          wBX.start({ fighters: [{ n: 'A', kind: 'troll' }, { n: 'B', kind: 'elf' }], seed: 3 }); out.intro = wBX.cast(0, 'sp');
          G = __setup(2, ['troll', 'elf'], { powers: false }); out.off = [wBX.cast(0, 'sp'), wBX.powers(0).sp];
          // a new round brings the special back; the ultimate stays spent; statuses end at the bell
          G = __setup(2, ['golem', 'elf']); wBX.cast(0, 'sp'); wBX.cast(0, 'ult'); out.fxOn = G.F[0].fx.length;
          for (const x of G.F) x.r.chin = 60; let n = 0; while (wBX.phase !== 'corner' && n++ < 4000) wBX.step(); out.fxBell = G.F[0].fx.length;
          n = 0; while (wBX.phase !== 'round' && n++ < 400) wBX.step(); for (const x of G.F) { x.a = { k: 'idle', t: 0, dur: 0, id: 0 }; x.spirit = 100; }
          out.next = [wBX.powers(0).sp.ok, wBX.powers(0).ult.ok, wBX.powers(0).ult.why];
          G = __setup(2, ['werewolf', 'elf']); wBX.cast(0, 'ult'); const t0 = G.F[0].fx[0].t; for (let i = 0; i < 20; i++) wBX.step(); out.wear = [t0, G.F[0].fx.length ? G.F[0].fx[0].t : 0];
          for (let i = 0; i < 160; i++) wBX.step(); out.gone = G.F[0].fx.length;
          return out; })()""")
        check(lim['first'] and lim['again'] == [False, 'used this round'] and lim['ult'] and lim['ult2'] == [False, 'used this bout'], 'a special once a round, an ultimate once a bout', lim)
        check(lim['breath'] == [False, 'no breath'], 'without the stamina, no power', lim)
        check(not any([lim['stun'], lim['down'], lim['clinch'], lim['punching'], lim['theyDown'], lim['intro']]), 'no power while stunned, down, clinched, mid-punch, with them down, or before the round', lim)
        check(lim['off'] == [False, None], 'with powers off, there are none', lim)
        check(lim['fxOn'] == 2 and lim['fxBell'] == 0 and lim['next'] == [True, False, 'used this bout'], 'statuses end at the bell; the next round brings the special back, not the ultimate', lim)
        check(lim['wear'][1] < lim['wear'][0] - .9 and lim['gone'] == 0, 'statuses wear off with time', lim)

        # ---------- the CPU casts; the balance ----------
        cpu = await pg.evaluate("""(() => { const K = wBX.kinds, W = {}; let casts = 0, castsOff = 0, n = 0;
          for (let i = 0; i < 540; i++) { const a = K[i % 18], b = K[(i * 7 + 3 + Math.floor(i / 18)) % 18]; if (a === b) continue; n++;
            const s = wBX.simBout({ fighters: [{ n: 'A', kind: a }, { n: 'B', kind: b }], seed: 3000 + i }); casts += s.stats[0].pw + s.stats[1].pw;
            if (s.over.win != null) for (const [side, k] of [[0, a], [1, b]]) { const r = W[k] = W[k] || [0, 0]; r[1]++; if (s.over.win === side) r[0]++; } }
          for (let i = 0; i < 20; i++) { const s = wBX.simBout({ fighters: [{ n: 'A', kind: 'witch' }, { n: 'B', kind: 'ogre' }], seed: 50 + i, powers: false }); castsOff += s.stats[0].pw + s.stats[1].pw; }
          return { casts: casts / n, castsOff, rates: Object.values(W).map(([w, t]) => Math.round(100 * w / t) / 100).sort((x, y) => x - y) }; })()""")
        check(cpu['casts'] >= 4 and cpu['castsOff'] == 0, 'the CPU casts in its bouts (both fighters), and none with powers off', cpu)
        check(cpu['rates'][0] >= .12 and cpu['rates'][-1] <= .88, 'with powers, no kind always wins or always loses (of the bouts decided; about 55 a kind here, so the band is wide: the lab measures it finer)', cpu['rates'])

        # ---------- in the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wBX.speed = 4; W_RING_MODE = 'play'; wRingBout({ kinds: ['gorgon', 'elf'], seed: 4 })")
        await pg.wait_for_function("UI.view === 'ring' && !!wBX.wait")
        await pg.click('[data-rplan="press"]')
        await pg.wait_for_function("wBX.phase === 'round'")
        await pg.evaluate("wBX.pause(true); (() => { const G = wBX.G; G.F[0].x = -1; G.F[1].x = 1; G.F[0].y = G.F[1].y = 0; for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.think = 99; f.spirit = 100; } wRingBarNote(); })()")
        pad = await pg.evaluate("(() => { const b = k => document.querySelector(`[data-rpad=\"${k}\"]`); return { sp: [b('sp').textContent, b('sp').hidden, b('sp').disabled], ult: [b('ult').textContent, b('ult').hidden] }; })()")
        check(pad == {'sp': ['Petrify', False, False], 'ult': ['Stone Garden', False]}, 'the pad has your fighter\'s special and ultimate, by name', pad)
        await pg.keyboard.press('q')
        q = await pg.evaluate("(() => { for (let i = 0; i < 3; i++) wBX.step(); return { used: wBX.powers(0).sp.used, them: wBX.G.F[1].a.k, btn: document.querySelector('[data-rpad=\"sp\"]').disabled, log: wBX.G.log.some(l => /casts Petrify/.test(l.msg)) }; })()")
        check(q == {'used': True, 'them': 'stun', 'btn': True, 'log': True}, 'Q casts your special: Petrify freezes them, the log says so, and its button goes out', q)
        # (no breath coming back while it waits: how long 400 ms of play is depends on the machine's load)
        await pg.evaluate("wBX.G.F[0].sta = 2; wBX.G.F[0].fx.push({ id: 'test', n: 'test', t: 99, noReg: 1 }); wBX.pause(false)"); await pg.wait_for_timeout(400)
        nb = await pg.evaluate("({ btn: document.querySelector('[data-rpad=\"ult\"]').disabled, why: wBX.powers(0).ult.why }); ")
        await pg.evaluate("wBX.pause(true); wBX.G.F[0].fx = wBX.G.F[0].fx.filter(x => x.id !== 'test'); wBX.G.F[0].sta = wBX.G.F[0].staMax")
        check(nb['btn'] and nb['why'] in ('no breath', 'busy'), 'without the breath the ultimate\'s button is out, kept up to date during the round', nb)
        await pg.evaluate("wBX.pause(false)"); await pg.wait_for_timeout(250); await pg.screenshot(path='/tmp/realm-ring-powers-cast.png'); await pg.evaluate("wBX.pause(true)")
        await pg.evaluate("(() => { for (const f of wBX.G.F) f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; document.querySelector('[data-rpad=\"ult\"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3 })); for (let i = 0; i < 3; i++) wBX.step(); })()")
        u = await pg.evaluate("({ used: wBX.powers(0).ult.used, stone: !!wBX.G.F[1].a.stone })")
        check(u == {'used': True, 'stone': True}, 'the pad\'s ultimate button casts it (Stone Garden: stone)', u)
        # You corner: your fighter casts by themselves
        await pg.click('[data-rmode="call"]')
        yc = await pg.evaluate("(() => { const G = wBX.G; for (const f of G.F) { f.r.chin = 60; f.think = 0; f.spirit = 100; } let n = 0; const c0 = G.F[0].rs.pw; while (wBX.phase !== 'over' && n++ < 6000) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); } return G.F[0].bs.pw - c0 + G.F[0].rs.pw; })()")
        check(yc >= 1, 'in You corner your fighter casts powers by themselves', yc)
        await pg.evaluate("wBX.pause(false)")
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ rows: document.querySelectorAll('.wrpow tr').length, text: (document.getElementById('wRingHow') || {}).textContent || '' })")
        check(hp['rows'] == 19 + STARS and 'once a round' in hp['text'] and 'Q your special' in hp['text'] and 'Petrify' in hp['text'] and 'Long Arms' in hp['text'] and 'Nature' in hp['text'], 'How to play explains powers and each kind\'s nature, with every kind\'s', hp['rows'])
        await pg.evaluate("showPage('play')")

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
