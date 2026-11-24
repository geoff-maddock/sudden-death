# Football's roar (issue #115, phase 3: src/gf/parts/19-roar.js, w143-gfroar.js), a crowd meter that lifts a cast.
# Asserts: with it off (no roar, null, or both sides off) a seeded game plays exactly the same and keeps no state; the
# stands fill each side's roar by the rules (checked against every play in the log of whole games), never past the
# most; a lift: an everyday power's effects half again as strong (a multiplier to its power of 1.5, a number half again,
# a flag or a count left alone, and a power that is only those can't be lifted), more yards on the same seeds, the
# ultimate's zone a play longer, 3 spent and the call cleared; you lift only when you call for it (or with Auto powers);
# the CPU spends it by its skill, each lift in the log with its reason; it is kept in the snapshot; the Realm plays it in
# every game (off in LAB unless W_GFROAR.lab); on the field: the Roar on the powers row, called for and spent on an
# ultimate; How it works and How to play. Exits nonzero on failure. Screenshot: /tmp/realm-gridiron-roar.png.
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

TEAMS = """(i) => { const k = wGF.kinds; return [0, 1].map(j => ({ name: 'T' + j, roster: Array.from({ length: 7 }, (_, m) => ({ n: 'P' + j + m, kind: k[(m * 3 + j + i) % k.length] })) })); }"""
TO_OFFENSE = """async () => { for (let i = 0; i < 80; i++) {
  await new Promise(r => { const w = () => wGF.phase === 'call' ? r() : setTimeout(w, 30); w(); });
  if (wGF.yourBall) return true;
  wGF.call('zone'); await new Promise(r => { const w = () => wGF.phase !== 'call' ? r() : setTimeout(w, 30); w(); }); } return false; }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1100})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGF !== 'undefined' && typeof W_GFROAR === 'object'")
        await pg.evaluate(f"window.__teams = {TEAMS}; 0")

        r = await pg.evaluate("wGF.roarRules")
        check(r['max'] == 6 and r['cost'] == 3 and r['amp'] == 1.5, 'the roar: up to 6, 3 to lift a cast, half again', r)

        # ---------- off: as before ----------
        off = await pg.evaluate("""(() => { LAB = true; const out = [];
          for (const P of [undefined, null, { on: [false, false] }]) { const o = { teams: __teams(2), seed: 41, skill: [1, 2] }; if (P !== undefined) o.roar = P;
            const g = wGF.simGame(o); out.push(JSON.stringify([g.score, g.plays, g.ends, g.box])); }
          const g = wGF.simGame({ teams: __teams(2), seed: 41, skill: [1, 2], roar: true }), on = JSON.stringify([g.score, g.plays, g.ends, g.box]);
          wGF.simGame({ teams: __teams(2), seed: 41, roar: null }); const plain = !wGF.G.roar; LAB = false;
          return { same: out[0] === out[1] && out[1] === out[2], differs: on !== out[0], plain }; })()""")
        check(off['same'] and off['plain'], 'with the roar off (none, null, or both sides off) a seeded game plays exactly the same, and keeps no state', off)
        check(off['differs'], 'with it on, the same game goes differently', off)

        # ---------- the stands fill it by the rules ----------
        fill = await pg.evaluate("""(() => { LAB = true; const bad = [], seen = {}; let max = 0;
          for (let i = 0; i < 8; i++) { wGF.simGame({ teams: __teams(i), seed: 300 + i, skill: [1, 1 + i % 2], roar: true }); const G = wGF.G, Q = G.roar, want = { gain: 0, sack: 0, to: 0, downs: 0, td: 0, fg: 0, safety: 0 };
            for (const d of G.drives) d.plays.forEach((e, j) => { const last = j === d.plays.length - 1, end = last ? d.end : null;
              if (e.what === 'sack') want.sack++;
              const lost = e.what === 'int' || (e.what === 'fum' && last && (end === 'fum' || end === 'fumtd'));
              if (lost) want.to++; else if (e.gain >= 15 && e.oc !== 'fg' && e.oc !== 'punt') want.gain++;
              if (end === 'downs') want.downs++; if (end === 'td' || end === 'fumtd') want.td++; if (end === 'fg') want.fg++; if (end === 'safety') want.safety++; });
            for (const k in want) { seen[k] = (seen[k] || 0) + Q.tally[k]; if (want[k] !== Q.tally[k]) bad.push([i, k, want[k], Q.tally[k]]); }
            max = Math.max(max, ...Q.v); if (Q.v.some(v => v < 0)) bad.push([i, 'below 0', Q.v]); }
          LAB = false; return { bad, seen, max }; })()""")
        check(not fill['bad'], 'the stands fill it on every big gain, sack, turnover, stop on downs and score in the log (8 whole games)', fill)
        check(fill['max'] <= 6 and all(fill['seen'].get(k, 0) > 0 for k in ('gain', 'sack', 'td', 'fg')), 'never past 6, and every kind of moment seen', fill)

        # ---------- the lift ----------
        amp = await pg.evaluate("""(() => { const one = (id, amp) => wGF.fxOf({ off: Object.assign({ id, name: id, n: 'X' }, amp ? { amp: true } : {}) });
          const N = 60, avg = amp => { let g = 0; for (let i = 0; i < N; i++) g += wGF.down('run', 'zone', { seed: 700 + i, st: { pw: { off: Object.assign({ id: 'sprint', name: 'Wolf Sprint', n: 'W' }, amp ? { amp: true } : {}) } } }).gain; return g / N; };
          return { sprint: [one('sprint').cSpd, one('sprint', 1).cSpd], hold: [one('holdline').dStr, one('holdline', 1).dStr, one('holdline', 1).cSpd], shadow: [one('shadowstep').breakN, one('shadowstep', 1).breakN],
            stone: one('stoneskin', 1).shed, gain: [avg(false), avg(true)] }; })()""")
        check(abs(amp['sprint'][0] - 1.12) < 1e-9 and abs(amp['sprint'][1] - 1.12 ** 1.5) < 1e-9, 'lifted, a multiplier goes to its power of 1.5 (Wolf Sprint: 1.12 to 1.185)', amp)
        check(amp['hold'][1] == 4.5 and abs(amp['hold'][2] - .95 ** 1.5) < 1e-9 and amp['shadow'] == [1, 1] and 0 < amp['stone'] < .25, 'a number half again (Hold the Line +3 to +4.5), a count left alone (a broken tackle), and never below nothing', amp)
        check(amp['gain'][1] > amp['gain'][0] + .2, 'a lifted Wolf Sprint gains more on the same seeds', amp['gain'])
        lifts = await pg.evaluate("""(() => { LAB = true; wGF.game({ teams: __teams(1), seed: 5, mode: 'call', roar: true }); wGF.pause(true); wGF.hide(); LAB = false;
          const G = wGF.G, Q = G.roar, s = G.poss, out = {};
          G.mana = [6, 6]; Q.v = [6, 6];
          // a power that is only a flag or a count can't be lifted
          const ops = wGF.options(s), flat = ops.find(o => !o.ult && !o.sit && ['shadowstep', 'glide', 'undying', 'rattlebones'].includes(o.id));
          out.flat = flat ? wGF.roarLifts(flat.key) : 'none here';
          // the ultimate: its zone a play longer, 3 spent (the CPU's, the stands full)
          // (whichever side has an ultimate for its side of the ball; yours too, with Auto powers on as it starts in You call)
          const cpu = [1, 0].find(x => wGF.options(x).some(o => o.ult && o.ok)), u = cpu == null ? null : wGF.options(cpu).find(o => o.ult && o.ok);
          if (u) { const c = wGF.castAt(cpu, u.key); out.ult = { left: (G.zones.find(z => z.id === u.id) || {}).left, v: Q.v[cpu], amp: !!c.amp, cast: Q.casts.slice(-1)[0] }; }
          // yours: with Auto powers off and the call not made, nothing; called for, lifted, and the call cleared
          wGF.setAuto(false); Q.v[0] = 6; const mine = wGF.options(0).find(o => !o.ult && !o.sit && o.ok && wGF.roarLifts(o.key));
          if (mine) { G.mana[0] = 6; const c0 = wGF.castAt(0, mine.key); Q.v[0] = 3; wGF.armRoar(true); const a = wGF.roar().arm[0]; G.mana[0] = 6;
            const c1 = wGF.castAt(0, mine.key); out.mine = { plain: !!c0.amp, armed: a, lifted: !!c1.amp, v: Q.v[0], arm: Q.arm[0], why: Q.casts.slice(-1)[0].why };
            Q.v[0] = 2; out.short = wGF.armRoar(true); }
          out.notes = wGF.notes().filter(n => n.k === 'roar').map(n => n.msg);
          return out; })()""")
        check(lifts['flat'] in (False, 'none here'), 'a power that only breaks a tackle or stops a break-up can\'t be lifted', lifts)
        check(lifts.get('ult') and lifts['ult']['left'] == 4 and lifts['ult']['v'] == 3 and lifts['ult']['cast']['k'] == 'ult' and lifts['ult']['cast']['why'] == 'the stands are full', 'an ultimate lifted: its zone lasts 4 plays, not 3, and 3 roar are spent', lifts)
        check(lifts.get('mine') and not lifts['mine']['plain'] and lifts['mine']['armed'] and lifts['mine']['lifted'] and lifts['mine']['v'] == 0 and not lifts['mine']['arm'] and lifts['mine']['why'] == 'called for', 'yours: nothing unless you call for it (Auto powers off); called for, it lifts the cast, spends 3 and clears the call', lifts)
        check('needs 3' in (lifts.get('short') or ''), 'you can\'t call for it under 3', lifts)
        check(len(lifts['notes']) >= 2 and all(n.startswith('♪ The roar lifts ') and n.endswith(').') for n in lifts['notes']), 'each lift waits for the play\'s log line, with its reason', lifts['notes'])

        # ---------- the CPU spends it by its skill ----------
        cpu = await pg.evaluate("""(() => { LAB = true; const by = [0, 0, 0], games = [0, 0, 0]; let why = 0, n = 0;
          for (let i = 0; i < 24; i++) { const sk = i % 3; wGF.simGame({ teams: __teams(i), seed: 900 + i, skill: [sk, sk], roar: true }); const Q = wGF.G.roar;
            by[sk] += Q.casts.length; games[sk]++; for (const c of Q.casts) { n++; if (c.why) why++; } }
          LAB = false; return { per: by.map((b, i) => b / games[i]), why, n }; })()""")
        check(cpu['n'] > 0 and cpu['why'] == cpu['n'], 'the CPU spends the roar, every lift with a reason', cpu)
        check(cpu['per'][2] > cpu['per'][0], 'an Archmage lifts more casts than a Squire', cpu)

        # ---------- kept in the snapshot ----------
        sn = await pg.evaluate("""(() => { const G = wGF.G; G.roar.v = [4, 5]; G.roar.arm = [true, false]; const s = wGF.snapshot(); const keep = JSON.stringify(s.G.roar);
          LAB = true; wGF.simGame({ teams: __teams(3), seed: 1, roar: null, keep: true }); LAB = false; wGF.resume(s); wGF.hide(); const back = wGF.G.roar;
          return { saved: JSON.parse(keep).v, back: back && back.v, arm: back && back.arm }; })()""")
        check(sn['saved'] == [4, 5] and sn['back'] == [4, 5] and sn['arm'] == [True, False], 'the roar and your call are kept in the snapshot, and come back with the game', sn)

        # ---------- the Realm: on in every game, off in LAB ----------
        rl = await pg.evaluate("""(() => { wGF.simGame({ teams: __teams(4), seed: 2 }); const on = !!wGF.G.roar && wGF.G.roar.on.every(Boolean);
          LAB = true; wGF.simGame({ teams: __teams(4), seed: 2 }); const lab = !!wGF.G.roar; W_GFROAR.lab = { on: [true, false] }; wGF.simGame({ teams: __teams(4), seed: 2 }); const asked = wGF.G.roar && wGF.G.roar.on; W_GFROAR.lab = null; LAB = false;
          return { on, lab, asked }; })()""")
        check(rl['on'] and not rl['lab'] and rl['asked'] == [True, False], 'the Realm plays the roar in every game; LAB leaves it out unless W_GFROAR.lab asks', rl)

        # ---------- on the field ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wGF.speed = 6; wGridironGame({ mode: 'call', seed: 9 })")
        await pg.evaluate(TO_OFFENSE)
        await pg.evaluate("wGridBar()")
        row = await pg.evaluate("(() => { const b = document.getElementById('wGridRoarBtn'), t = document.getElementById('wGridRoar'); return { shown: !b.hidden && !t.hidden, txt: t.textContent, dis: b.disabled, roar: wGF.roar().v[0] }; })()")
        check(row['shown'] and row['txt'].startswith('Roar ') and (row['dis'] == (row['roar'] < 3)), 'the powers row shows your roar, and Roar is lit only with 3 or more', row)
        u = await pg.evaluate("""(() => { const G = wGF.G; G.mana[0] = 6; G.roar.v[0] = 3; wGridBar(); const o = wGF.powers().list.find(x => x.ult && x.ok);
          if (!o) return { none: wGF.powers().list.map(x => x.name + ':' + x.why) }; wGF.pickPower(o.key); wGridBar(); return { key: o.key, id: o.id }; })()""")
        check('key' in u, 'an offense ultimate to pick', u)
        await pg.click('#wGridRoarBtn')
        armed = await pg.evaluate("({ txt: document.getElementById('wGridRoarBtn').textContent, arm: wGF.roar().arm[0], mark: document.getElementById('wGridRoarBtn').classList.contains('on') })")
        check(armed['arm'] and armed['mark'] and 'next cast' in armed['txt'], 'pressing Roar calls for it on your next cast', armed)
        await pg.screenshot(path='/tmp/realm-gridiron-roar.png')
        await pg.click('[data-gcall="run"]')
        await pg.wait_for_function("wGF.phase === 'pre'")
        z = await pg.evaluate(f"({{ zones: wGF.zones(), v: wGF.roar().v[0], arm: wGF.roar().arm[0] }})")
        check(any(x['id'] == u.get('id') and x['left'] == 4 for x in z['zones']) and z['v'] == 0 and not z['arm'], 'cast with the call: the ultimate\'s zone lasts 4 plays, and the roar is spent', z)
        await pg.evaluate("wGF.pause(true)")
        hp = await pg.evaluate("(() => { renderHelp(); const a = document.getElementById('wHelpGfRoar'), how = document.getElementById('wGridHow'); return { a: a ? a.textContent : '', how: how ? how.textContent : '' }; })()")
        check('The roar' in hp['a'] and 'half again' in hp['a'] and 'The roar.' in hp['how'], 'How to play and Football: how it works explain the roar', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\nFAILED: ' + ', '.join(FAILS) if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
