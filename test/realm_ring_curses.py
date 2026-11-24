# Boxing's situation powers and curses (issue #115, phase 3: src/bx/parts/15-more.js, w142-ringmore.js). Asserts:
# the tables (three situation powers; a curse for seven league kinds and every superstar, each id unique against every
# boxing power); with them off a seeded bout boxes exactly as with no layer at all; each kind of curse does what it says
# (slower punches, a leakier guard, slower breath, a dearer next special, paid off once), lasts the rest of the round
# and the next, then wears off; once a bout, for spirit, never on a fighter already cursed; the cut-man washes it off in
# place of a patch (your corner says when; the CPU by its skill); each situation power only when its moment fits, once
# a bout, for spirit, leaving its status; the CPU casts them all, logged with a reason; a curse is kept in the bout's
# snapshot between rounds; in the Realm they are on in every bout (off in LAB unless W_BXPOW.lab); the pad's Curse and
# situation power buttons, the wash on the bar, the stats card and How to play. Exits nonzero on failure.
# Screenshot: /tmp/realm-ring-curses.png.
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

# two fighters in round 1, still, fresh and d apart, full of spirit (kinds: [yours, theirs])
SETUP = """(d, kinds, o) => { wBX.start(Object.assign({ fighters: kinds.map((k, i) => ({ n: 'F' + i, kind: k })), seed: 7, bxpow: { sit: true, curse: true } }, o || {}));
  for (let i = 0; i < 100 && wBX.phase === 'intro'; i++) wBX.step();
  const G = wBX.G; G.F[0].x = -d / 2; G.F[1].x = d / 2; G.F[0].y = G.F[1].y = 0;
  for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.mv = [0, 0]; f.think = 99; f.r.chin = 60; f.spirit = 100; } return G; }"""
# (the rest of the round, and the corner: with both corners the CPU's the bout goes on into the next round by itself)
TO_CORNER = "(() => { for (let i = 0; i < 4000 && wBX.phase !== 'corner'; i++) { const G = wBX.G; for (const f of G.F) { f.think = 99; f.a = f.a.k === 'down' ? f.a : { k: 'idle', t: 0, dur: 0, id: 0 }; } wBX.step(); } return wBX.phase; })()"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined' && typeof W_BXPOW === 'object'")
        await pg.evaluate(f"wBX.speed = 4; window.__setup = {SETUP}; 0")

        # ---------- the tables ----------
        t = await pg.evaluate("""(() => { const C = wBX.curses, D = wBX.powerData, ids = [];
          for (const k in D) for (const w of ['sp', 'sp2', 'ult']) if (D[k][w]) ids.push(D[k][w].id);
          const cu = Object.values(C).map(c => c.id), stars = W_STARS.filter(s => s.kind && wBX.kinds.includes(s.kind)).map(s => s.kind);
          return { sits: Object.keys(wBX.sits), league: Object.keys(C).filter(k => !stars.includes(k)).length, stars: stars.filter(k => C[k]).length, nstars: stars.length,
            clash: cu.filter(id => ids.includes(id)), dup: cu.length - new Set(cu).size, kinds: [...new Set(Object.values(C).map(c => c.k))].sort(),
            whole: Object.values(C).every(c => c.n && c.desc && c.fx && wBX.curseKinds[c.k]), cost: wBX.spirit.cu }; })()""")
        check(t['sits'] == ['canvas', 'last', 'bell'], 'three situation powers: Off the Canvas, the Last Round, Saved by the Bell', t)
        check(t['league'] == 7 and t['stars'] == t['nstars'] and t['nstars'] == 6, 'a curse for seven league kinds and every superstar', t)
        check(not t['clash'] and t['dup'] == 0, 'every curse id is unique, against each other and every boxing power', t)
        check(t['kinds'] == ['dear', 'leaky', 'slow', 'tired'] and t['whole'] and t['cost'] == 30, 'four kinds of curse, each named and described, 30 spirit', t)

        # ---------- off: as before ----------
        off = await pg.evaluate("""(() => { const F = [{ n: 'A', kind: 'witch' }, { n: 'B', kind: 'lich' }], out = [];
          for (const P of [undefined, null, { sit: false, curse: false }]) { const o = { fighters: F, seed: 31, skill: [1, 2] }; if (P !== undefined) o.bxpow = P;
            LAB = true; const s = wBX.simBout(o); LAB = false; out.push(JSON.stringify([s.over, s.cards, s.stats, s.log.map(l => l.msg)])); }
          const on = (() => { LAB = true; const s = wBX.simBout({ fighters: F, seed: 31, skill: [1, 2], bxpow: { sit: true, curse: true } }); LAB = false; return JSON.stringify([s.over, s.cards, s.stats, s.log.map(l => l.msg)]); })();
          return { same: out[0] === out[1] && out[1] === out[2], differs: on !== out[0], plain: !wBX.simBout({ fighters: F, seed: 3, bxpow: null }).bxp }; })()""")
        check(off['same'] and off['plain'], 'with the layer off (no bxpow, null, or both parts off) a seeded bout boxes exactly the same, and keeps no state', off)
        check(off['differs'], 'with it on, the same bout goes differently', off)

        # ---------- each kind of curse at work ----------
        cu = await pg.evaluate("""(() => { const out = {};
          // slow: a punch takes longer
          let G = __setup(3, ['wraith', 'golem']); const t0 = wBX.tempo(1); const ok = wBX.curseAt(0); out.slow = { ok, tempo: [t0, wBX.tempo(1)], spirit: G.F[0].spirit, on: G.F[1].curse && G.F[1].curse.until };
          // leaky: the guard lets twice as much through
          G = __setup(3, ['vampire', 'golem']); wBX.curseAt(0); out.leaky = wBX.fxNow(1).leaky;
          // tired: breath back slower
          const regen = kinds => { const G = __setup(9, kinds); if (kinds[0] === 'lich') wBX.curseAt(0); G.F[1].sta = 20; for (let i = 0; i < 40; i++) { G.F[1].think = 99; G.F[0].think = 99; wBX.step(); } return G.F[1].sta - 20; };
          out.tired = [regen(['golem', 'golem']), regen(['lich', 'golem'])];
          // dear: their next special costs 15 more, and paying it ends the curse
          G = __setup(2, ['witch', 'ogre']); wBX.curseAt(0); const need = wBX.powers(1).need.sp, s0 = G.F[1].spirit, cast = wBX.cast(1, 'sp');
          out.dear = { need, paid: s0 - G.F[1].spirit, cast, gone: !G.F[1].curse, log: G.log.some(l => /pays the Evil Eye off/.test(l.msg)) };
          return out; })()""")
        check(cu['slow']['ok'] and cu['slow']['tempo'][1] > cu['slow']['tempo'][0] * 1.1 and cu['slow']['spirit'] == 70 and cu['slow']['on'] == 2, 'a slow curse: their punches slower; it costs 30 spirit and lasts into round 2', cu['slow'])
        check(cu['leaky'] == 1, 'a leaky curse: their guard leaks (through every status, curse and all)', cu)
        check(cu['tired'][1] < cu['tired'][0] * .75 and cu['tired'][1] > 0, 'a tired curse: their breath comes back about a third slower', cu['tired'])
        check(cu['dear']['need'] == 40 and cu['dear']['cast'] and round(cu['dear']['paid']) == 40 and cu['dear']['gone'] and cu['dear']['log'], 'a dear curse: their next special costs 15 more spirit, and paying it ends the curse', cu['dear'])
        lim = await pg.evaluate("""(() => { let G = __setup(3, ['goblin', 'golem']); const a = wBX.curseAt(0), b = wBX.more(0).cu; G.F[0].cuUsed = false; const again = wBX.curseAt(0), why = wBX.more(0).cu.why;
          G = __setup(3, ['goblin', 'golem']); G.F[0].spirit = 20; const poor = wBX.more(0).cu;
          G = __setup(3, ['golem', 'goblin']); const none = wBX.more(0).cu, fx = wBX.powers(1).fx;
          G = __setup(3, ['goblin', 'golem'], { bxpow: { curse: false } }); const offc = wBX.more(0).cu;
          return { a, used: [b.used, b.why], again, why, poor: [poor.ok, poor.why], none, offc }; })()""")
        check(lim['a'] and lim['used'] == [True, 'used this bout'] and not lim['again'] and lim['why'] == 'they are cursed already', 'once a bout, and never on a fighter already cursed', lim)
        check(lim['poor'] == [False, 'needs spirit'] and lim['none'] is None and lim['offc'] is None, 'it needs the spirit; a kind without one has none, nor anyone with curses off', lim)

        # ---------- how long: the rest of the round and the next; the wash ----------
        dur = await pg.evaluate(f"""(() => {{ const G = __setup(3, ['zombie', 'golem']); G.F[1].hp = G.F[1].hpMax; wBX.curseAt(0); G.skill = [1, 1];
          // (their corner would rather patch: so it keeps the curse and we watch it run)
          G.F[1].hp = 10; G.F[1].patches = 2;
          const ph1 = {TO_CORNER}, r2 = {{ round: G.round, on: !!G.F[1].curse, washed: G.log.some(l => /washes/.test(l.msg)) }};
          for (let i = 0; i < 400 && wBX.phase !== 'round'; i++) wBX.step();
          const ph2 = {TO_CORNER}; return {{ ph1, r2, round: G.round, after: !!G.F[1].curse, wore: G.log.some(l => /wears off/.test(l.msg)) }}; }})()""")
        check(dur['r2']['round'] == 2 and dur['r2']['on'] and not dur['r2']['washed'], 'a curse cast in round 1 is still on in round 2 when the cut-man patches instead', dur)
        check(dur['round'] == 3 and not dur['after'] and dur['wore'], 'and it wears off at the bell after round 2', dur)
        wash = await pg.evaluate(f"""(() => {{ const G = __setup(3, ['zombie', 'golem']); wBX.curseAt(0); G.F[1].hp = G.F[1].hpMax;
          const ph = {TO_CORNER}; return {{ ph, on: !!G.F[1].curse, patched: G.F[1].patched, patches: G.F[1].patches, log: G.log.filter(l => /washes/.test(l.msg)).map(l => l.msg) }}; }})()""")
        check(wash['ph'] == 'corner' and not wash['on'] and wash['patched'] == 2 and wash['patches'] == 2 and wash['log'], 'a Knight\'s corner with nothing to patch washes the curse off: the cut-man\'s job that break, no patch used', wash)
        mine = await pg.evaluate(f"""(() => {{ const G = __setup(3, ['golem', 'zombie'], {{ mode: 'call', you: 0 }}); if (wBX.wait) wBX.call(wBX.wait.plan);
          for (let i = 0; i < 200 && wBX.phase !== 'round'; i++) wBX.step();
          for (const f of G.F) {{ f.a = {{ k: 'idle', t: 0, dur: 0, id: 0 }}; f.think = 99; }} G.F[1].spirit = 100; wBX.curseAt(1); G.F[0].hp = G.F[0].hpMax;
          for (let i = 0; i < 4000 && wBX.phase !== 'corner'; i++) {{ for (const f of G.F) {{ f.think = 99; }} wBX.step(); }}
          const w = wBX.wait, before = !!G.F[0].curse, washed = wBX.wash(), patch = wBX.patch(), again = wBX.wash();
          return {{ ph: wBX.phase, wash: w && w.wash, wpatch: w && w.patch, before, washed, after: !!G.F[0].curse, patch, again }}; }})()""")
        check(mine['ph'] == 'corner' and mine['wash'] and not mine['wpatch'] and mine['before'], 'your corner says to wash a curse off (and not to patch) when nothing needs patching', mine)
        check(mine['washed'] and not mine['after'] and not mine['patch'] and not mine['again'], 'Wash: the curse is gone, and the cut-man has done his job for the break (no patch after it)', mine)

        alt = await pg.evaluate(f"""(() => {{ const G = __setup(3, ['golem', 'zombie'], {{ mode: 'call', you: 0 }}); if (wBX.wait) wBX.call(wBX.wait.plan);
          for (let i = 0; i < 200 && wBX.phase !== 'round'; i++) wBX.step();
          for (const f of G.F) {{ f.a = {{ k: 'idle', t: 0, dur: 0, id: 0 }}; f.think = 99; }} G.F[1].spirit = 100; wBX.curseAt(1); G.F[0].hp = G.F[0].hpMax;
          for (let i = 0; i < 4000 && wBX.phase !== 'corner'; i++) {{ for (const f of G.F) {{ f.think = 99; }} wBX.step(); }}
          const w = wBX.wait, said = !!(w && w.wash), patch = wBX.patch();
          return {{ said, patch, after: !!(wBX.wait && wBX.wait.wash), cursed: !!G.F[0].curse }}; }})()""")
        check(alt['said'] and alt['patch'] and not alt['after'] and alt['cursed'], 'Patch in place of the advised wash: the corner stops saying to wash, and the curse stays', alt)

        # ---------- situation powers ----------
        sit = await pg.evaluate("""(() => { const out = {};
          let G = __setup(3, ['golem', 'golem']); out.none = ['canvas', 'last', 'bell'].map(k => wBX.sitAt(0, k));
          G.F[0].hp = 20; G.clock = 8; const s0 = G.F[0].spirit; out.bell = wBX.sitAt(0, 'bell'); out.bellFx = wBX.fxNow(0).dmgIn; out.bellPaid = s0 - G.F[0].spirit; out.bellAgain = wBX.sitAt(0, 'bell');
          G = __setup(3, ['golem', 'golem']); G.F[0].rose = G.secs; const st0 = G.F[0].sta = 30; out.canvas = wBX.sitAt(0, 'canvas'); out.canvasSta = G.F[0].sta - st0; out.canvasFx = wBX.fxNow(0).dmgOut;
          G = __setup(3, ['golem', 'golem']); G.round = G.rounds; out.last = wBX.sitAt(0, 'last'); out.lastFx = wBX.fxNow(0).spd;
          G = __setup(3, ['golem', 'golem']); G.F[0].spirit = 5; G.F[0].hp = 20; G.clock = 8; out.poor = wBX.sitAt(0, 'bell');
          G = __setup(3, ['golem', 'golem'], { bxpow: { sit: false } }); G.F[0].hp = 20; G.clock = 8; out.off = wBX.sitAt(0, 'bell');
          out.casts = wBX.bxp; return out; })()""")
        check(all(sit['none']), 'no situation power outside its moment', sit['none'])
        check(sit['bell'] == '' and abs(sit['bellFx'] - .65) < 1e-9 and sit['bellPaid'] == 10 and sit['bellAgain'] == 'once a bout', 'Saved by the Bell: hurt with the bell close, 10 spirit, punches do 35% less, once a bout', sit)
        check(sit['canvas'] == '' and sit['canvasSta'] == 20 and abs(sit['canvasFx'] - 1.2) < 1e-9, 'Off the Canvas: just up, 20 stamina back and 20% harder', sit)
        check(sit['last'] == '' and abs(sit['lastFx'] - 1.15) < 1e-9, 'the Last Round: level in the last round, 15% quicker', sit)
        check(sit['poor'] == 'needs spirit' and sit['off'] == 'situation powers are off', 'they need the spirit, and do nothing when off', sit)

        # ---------- the CPU casts them, with a reason ----------
        cpu = await pg.evaluate("""(() => { LAB = true; const K = ['witch', 'lich', 'wraith', 'vampire', 'gorgon', 'zombie', 'goblin', 'ogre', 'golem', 'elf'], n = {}, why = []; let wash = 0;
          for (let i = 0; i < 60; i++) { const s = wBX.simBout({ fighters: [{ n: 'A', kind: K[i % 10] }, { n: 'B', kind: K[(i * 3 + 1) % 10] }], seed: 200 + i, skill: [1, 1 + i % 3], bxpow: { sit: true, curse: true } });
            for (const c of s.bxp.casts) { n[c.k === 'sit' ? c.id : 'curse'] = (n[c.k === 'sit' ? c.id : 'curse'] || 0) + 1; if (!c.why) why.push(c); } wash += s.bxp.wash[0] + s.bxp.wash[1];
            if (i === 0) n.logged = s.log.filter(l => /✦ .*\\(.*\\)\\.$/.test(l.msg)).length; }
          LAB = false; return { n, why: why.slice(0, 3), wash }; })()""")
        check(all(cpu['n'].get(k, 0) > 0 for k in ('canvas', 'last', 'bell', 'curse')) and cpu['wash'] > 0, 'the CPU casts every situation power and its curses, and its cut-man washes', cpu)
        check(not cpu['why'] and cpu['n'].get('logged', 0) > 0, 'every cast in the log with its reason (✦ …)', cpu)

        # ---------- kept in the snapshot ----------
        sn = await pg.evaluate(f"""(() => {{ const G = __setup(3, ['vampire', 'golem']); wBX.curseAt(0); G.F[1].hp = 10; G.F[1].patches = 2;
          const ph = {TO_CORNER}, snap = wBX.snapshot(), on = snap && snap.G.F[1].curse && snap.G.F[1].curse.id, bxp = !!(snap && snap.G.bxp);
          wBX.start({{ fighters: [{{ n: 'X', kind: 'elf' }}, {{ n: 'Y', kind: 'elf' }}], seed: 1 }}); wBX.resume(snap); wBX.hide();
          return {{ ph, on, bxp, back: wBX.G.F[1].curse && wBX.G.F[1].curse.id, more: !!wBX.bxp }}; }})()""")
        check(sn['on'] == 'thrallmark' and sn['bxp'] and sn['back'] == 'thrallmark' and sn['more'], 'a curse still on at the corner is in the snapshot, and comes back with the bout', sn)

        # ---------- the Realm: on in every bout, off in LAB ----------
        rl = await pg.evaluate("""(() => { const side = (n, k) => ({ name: n, short: n.slice(0, 3), color: '#a33', light: '#fcc', fighters: k.map((x, i) => ({ n: n + i, kind: x })) });
          const o = () => ({ sides: [side('Ours', ['witch', 'lich', 'goblin']), side('Them', ['vampire', 'zombie', 'gorgon'])], skill: [1, 1], seed: 9 });
          const on = wBX.simCard(o()).bouts.every(b => b.bxp && b.bxp.sit && b.bxp.curse);
          LAB = true; const lab = wBX.simCard(o()).bouts.some(b => b.bxp); W_BXPOW.lab = { sit: true, curse: false }; const asked = wBX.simCard(o()).bouts.every(b => b.bxp && !b.bxp.curse); W_BXPOW.lab = null; LAB = false;
          return { on, lab, asked }; })()""")
        check(rl['on'] and not rl['lab'] and rl['asked'], 'the Realm boxes them in every bout; LAB leaves them out unless W_BXPOW.lab asks', rl)

        # ---------- on screen ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("W_RING_MODE = 'play'; wRingBout({ kinds: ['witch', 'goblin'], seed: 4 }); wBX.pause(true); if (wBX.wait) wBX.call(wBX.wait.plan); for (let i = 0; i < 80 && wBX.phase !== 'round'; i++) wBX.step(); wBX.G.F[0].spirit = 100; wRingBarNote()")
        await pg.wait_for_function("!document.querySelector('#wRingPad [data-rpad=\"cu\"]').hidden")
        pad = await pg.evaluate("(() => { const b = document.querySelector('#wRingPad [data-rpad=\"cu\"]'); return { txt: b.textContent, dis: b.disabled, title: b.title }; })()")
        check(pad['txt'] == 'Evil Eye' and not pad['dis'] and 'once a bout' in pad['title'], 'You box: the pad has your curse by name, lit with the spirit to cast it (C)', pad)
        await pg.evaluate("wBX.pause(false)")
        await pg.dispatch_event('#wRingPad [data-rpad="cu"]', 'pointerdown')
        await pg.wait_for_function("!!wBX.G.F[1].curse", timeout=5000)
        await pg.evaluate("wBX.pause(true); const G = wBX.G; G.F[0].hp = 20; G.clock = 8; W_RING_SITKEY = ''; wRingMorePad()")
        await pg.wait_for_selector('#wRingSits [data-rsit="bell"]')
        await pg.click('#wRingSits [data-rsit="bell"]')
        sb = await pg.evaluate("({ used: wBX.bxp.used[0].bell, gone: !document.querySelector('#wRingSits [data-rsit=\"bell\"]'), cursed: wBX.G.F[1].curse.n, fx: wBX.powers(1).fx.map(x => x.n) })")
        check(sb['used'] and sb['gone'] and sb['cursed'] == 'Evil Eye' and '☾ Evil Eye' in sb['fx'], 'the pad: Curse put the Evil Eye on them (on the bar with their statuses); Saved by the Bell lit in its moment, and went once pressed', sb)
        await pg.screenshot(path='/tmp/realm-ring-curses.png')
        # your fighter cursed, at the corner: Wash on the bar
        await pg.evaluate("(() => { const G = wBX.G; G.F[1].spirit = 100; G.F[1].cuUsed = false; delete G.F[0].curse; G.F[1].think = 99; G.F[1].a = { k: 'idle', t: 0, dur: 0, id: 0 }; wBX.curseAt(1); G.F[0].hp = G.F[0].hpMax; G.clock = .1; for (let i = 0; i < 60 && wBX.phase !== 'corner'; i++) wBX.step(); wRingBarNote(); })()")
        wb = await pg.evaluate("(() => { const b = document.getElementById('wRingWash'); return { ph: wBX.phase, hidden: b.hidden, dis: b.disabled, on: b.classList.contains('on'), txt: b.textContent, note: document.getElementById('wRingNote').textContent }; })()")
        check(wb['ph'] == 'corner' and not wb['hidden'] and not wb['dis'] and wb['on'] and 'Jinx' in wb['txt'] and 'wash off' in wb['note'], 'your fighter cursed at the corner: Wash off on the bar, lit as your corner\'s advice', wb)
        await pg.click('#wRingWash')
        wd = await pg.evaluate("({ curse: !!wBX.G.F[0].curse, hidden: document.getElementById('wRingWash').hidden, patch: document.getElementById('wRingPatch').disabled })")
        check(not wd['curse'] and wd['hidden'] and wd['patch'], 'pressing it washes the curse off, and the cut-man is done for the break', wd)
        await pg.evaluate("wBX.pause(false); wLeaveRing()")
        # the stats card and How to play
        card = await pg.evaluate("(() => { const p = wMakePlayer({ kind: 'lich', lvl: 2 }, 'tavern'); return wBxCard(p) || ''; })()")
        check('data-rcucard' in card and 'Withering Curse' in card, 'the stats card names a boxer\'s curse', card[:200])
        hp = await pg.evaluate("(() => { renderHelp(); const a = document.getElementById('wRingHowMore'), b = document.getElementById('wHelpRingMore'); return { a: a ? a.textContent : '', b: b ? b.textContent : '' }; })()")
        check(all(w in hp['a'] for w in ('Situation powers', 'Off the Canvas', 'Saved by the Bell', 'Curses', 'Wash off', 'Evil Eye', 'Cinder Brand')) and 'curse' in hp['b'], 'How to play: Boxing, how it works explains situation powers and curses with every kind\'s', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\nFAILED: ' + ', '.join(FAILS) if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
