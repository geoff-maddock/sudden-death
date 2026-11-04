# Realm gridiron powers (issue #9, phase 6): monster powers on the field, working as they do on the diamond. Every kind
# has an offense power, a defense power and an ultimate. Team mana: 3 to start, 1 to both sides at each new drive, 1
# more when the other side scores, up to 6. A cast costs mana and the caster's stamina; an ultimate is once a game and
# leaves a zone for 3 plays or the drive. Powers change what happens on the field (measured on the same seeds), and the
# reason after a play says what was cast. The CPU casts at three skill levels: an Archmage casts only powers that suit
# its call; a Squire doesn't care. Auto powers, G and T, the tip box, the Sta column, How it works and How to play.
# Asserts; exits nonzero on failure. Screenshot: /tmp/realm-gridiron-powers.png.
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

# until it's your call with the ball: pick a defense whenever they have it
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGF !== 'undefined'")

        # ---------- the book: every kind has its powers ----------
        b = await pg.evaluate("""(() => { const B = wGF.powerBook; return wGF.kinds.filter(k => { const b = B[k];
          return !(b && b.off && b.def && b.ult && [1, 2].includes(b.off.cost) && [1, 2].includes(b.def.cost) && ['off', 'def'].includes(b.ult.role) && b.off.desc && b.def.desc && b.ult.desc); }); })()""")
        check(b == [], 'every kind has an offense power, a defense power and an ultimate, each with a cost and a description', b)

        # ---------- powers change the field (same seeds, with and without) ----------
        fx = await pg.evaluate("""(() => { const N = 60, avg = (oc, dc, pw) => { let g = 0; for (let i = 0; i < N; i++) g += wGF.down(oc, dc, { seed: 700 + i, st: pw ? { pw } : null }).gain; return g / N; };
          const evs = (oc, dc, pw) => { let n = 0; for (let i = 0; i < N; i++) { wGF.down(oc, dc, { seed: 700 + i, st: { pw } }); if (wGF.play.ev.some(e => e.k === 'pow')) n++; } return n; };
          let brk = 0; for (let i = 0; i < N; i++) { const r = wGF.down('short', 'man', { seed: 700 + i, st: { pw: { off: { id: 'glide', name: 'Glide', n: 'H' } } } }); if (r.what === 'int' || /broken up/.test(r.by)) brk++; }
          return { sprint: avg('run', 'zone', { off: { id: 'sprint', name: 'Wolf Sprint', n: 'W' } }) - avg('run', 'zone'),
            web: avg('run', 'zone', { def: { id: 'web', name: 'Web', n: 'S' } }) - avg('run', 'zone'),
            bog: avg('run', 'zone', { def: { id: 'bog', name: 'Bog Tide', n: 'T' } }) - avg('run', 'zone'),
            stampede: evs('run', 'man', { off: { id: 'stampede', name: 'Stampede', n: 'M' } }), glideBreak: brk }; })()""")
        check(fx['sprint'] > .8 and fx['web'] < -.8 and fx['bog'] < -.8, 'powers change the field: Wolf Sprint gains more on a run, Web and Bog Tide give up less (same seeds)', fx)
        check(fx['stampede'] > 20 and fx['glideBreak'] == 0, 'Stampede knocks over a tackler on most runs, and Glide is never broken up or picked off', fx)

        # ---------- headless games: mana, casts, the reason, stamina, CPU skill ----------
        g = await pg.evaluate("""(() => { const B = wGF.powerBook, fits = {}; for (const k in B) for (const r of ['off', 'def']) fits[B[k][r].n] = B[k][r].fits;
          const out = { casts: [0, 0], ults: 0, why: 0, castPlays: 0, mismatch: [0, 0], fitCasts: [0, 0], manaOk: true, stamDown: true, json: true };
          for (let i = 0; i < 16; i++) { wGF.simGame({ seed: 40 + i, skill: [2, 0] }); const G = wGF.G;
            out.manaOk = out.manaOk && G.mana.every(m => m >= 0 && m <= 6);
            out.json = out.json && JSON.stringify(JSON.parse(JSON.stringify({ m: G.mana, s: G.stam, z: G.zones, u: G.ultUsed }))) === JSON.stringify({ m: G.mana, s: G.stam, z: G.zones, u: G.ultUsed });
            out.stamDown = out.stamDown && G.stam.flat().some(v => v < 100);
            for (const d of G.drives) for (const e of d.plays) { if (!e.pw) continue; out.castPlays++; if (e.pw.every(c => e.why.includes(c.name))) out.why++;
              for (const c of e.pw) { out.casts[c.side]++; if (c.ult) { out.ults++; continue; }
                // offense casts only (the offense knows its play): does the power suit the call?
                if (c.side !== d.side) continue; const f = fits[c.name], kind = wGF.plays[e.oc] ? (e.oc === 'run' ? 'run' : 'pass') : null;
                if (!kind) continue; out.fitCasts[c.side]++; if (f !== 'any' && f !== kind) out.mismatch[c.side]++; } } }
          return out; })()""")
        check(g['casts'][0] > 40 and g['casts'][1] > 40 and g['ults'] > 0 and g['manaOk'], 'both coaches cast through a game, ultimates too, and mana stays between 0 and 6', g)
        check(g['why'] == g['castPlays'], 'the reason after a play names every power cast on it', g)
        check(g['mismatch'][0] == 0 and g['fitCasts'][0] > 10 and g['mismatch'][1] > 0, 'an Archmage casts only powers that suit its play; a Squire wastes some', g)
        check(g['stamDown'] and g['json'], 'stamina is spent through a game, and mana, stamina and zones are plain JSON', g)

        # ---------- on the field in You call: mana, G, the tip box, a cast ----------
        # (seed 7: your side receives the opening kickoff, so it's your call with the ball without watching a drive first)
        await pg.evaluate("wGridironGame({ mode: 'call', seed: 7 })")
        await pg.wait_for_function("UI.view === 'gridiron'")
        auto = await pg.evaluate("wGF.powers().auto")
        check(auto, 'Auto powers starts on in You call')
        ok = await pg.evaluate(TO_OFFENSE)
        check(ok, 'the game reaches your call with the ball')
        await pg.evaluate("wGF.pause(true)")
        await pg.keyboard.press('t')
        a2 = await pg.evaluate("({ auto: wGF.powers().auto, btn: document.getElementById('wGridAuto').textContent })")
        check(not a2['auto'] and 'off' in a2['btn'], 'T switches Auto powers, and the bar says so', a2)
        await pg.keyboard.press('g')
        P = await pg.evaluate("(() => { const P = wGF.powers(); return { pick: P.pick, mana: P.mana, list: P.list.length, sel: !!document.querySelector('#wGridPowList button.on'), tip: document.getElementById('wGridTip').textContent }; })()")
        check(P['pick'] and P['sel'] and 'mana' in P['tip'] and 'stamina' in P['tip'], 'G picks a power you can cast; it shows on the bar, and the tip box gives its cost in mana and stamina', P)
        o = await pg.evaluate("(() => { const P = wGF.powers(), o = P.list.find(x => x.key === P.pick); return { o, mana: P.mana, stam: wGF.G.stam[0][o.ri] }; })()")
        await pg.screenshot(path='/tmp/realm-gridiron-powers.png')
        await pg.evaluate("wGF.pause(false)")
        await pg.click('[data-gcall="short"]')
        await pg.wait_for_function("wGF.phase === 'pre' || wGF.phase === 'live'")
        c = await pg.evaluate("({ cast: wGF.powers().cast, mana: wGF.G.mana[0], stam: wGF.G.stam[0] })")
        exp_mana = o['mana'] - o['o']['cost']
        check(c['cast'] and c['cast']['off'] and c['cast']['off']['name'] == o['o']['name'] and c['mana'] == exp_mana
              and abs(c['stam'][o['o']['ri']] - (o['stam'] - o['o']['stamCost'])) < .01,
              'your pick is cast with the call: its mana and the caster\'s stamina are spent', [o, c])

        # ---------- Auto powers off: your side casts nothing it wasn't told to ----------
        await pg.wait_for_function("wGF.phase === 'post'", timeout=30000)
        mine = await pg.evaluate("""async () => { let n = 0; for (let i = 0; i < 4; i++) {
          await new Promise(r => { const w = () => wGF.phase === 'call' ? r() : setTimeout(w, 30); w(); });
          if (!wGF.live || wGF.phase === 'over') break;
          wGF.call(wGF.yourBall ? 'run' : 'zone'); await new Promise(r => { const w = () => wGF.phase === 'pre' || wGF.phase === 'kick' || wGF.phase === 'over' ? r() : setTimeout(w, 20); w(); });
          const c = wGF.powers().cast; if (wGF.phase === 'pre' && c) for (const x of [c.off, c.def]) if (x && x.side === 0) n++; } return n; }""")
        check(mine == 0, 'with Auto powers off and nothing picked, your side casts nothing', mine)

        # ---------- an ultimate: once a game, a zone for 3 plays or the drive ----------
        await pg.evaluate("wGridironGame({ mode: 'call', seed: 9 })")
        await pg.evaluate(TO_OFFENSE)
        u = await pg.evaluate("""(() => { const G = wGF.G; G.mana[0] = 6; const o = wGF.powers().list.find(x => x.ult && x.ok);
          if (!o) return { none: wGF.powers().list.map(x => x.name + ':' + x.why) }; wGF.pickPower(o.key); return { key: o.key, name: o.name, id: o.id }; })()""")
        check('key' in u, 'with 3 mana an offense ultimate can be picked', u)
        await pg.click('[data-gcall="run"]')
        await pg.wait_for_function("wGF.phase === 'pre'")
        z1 = await pg.evaluate(f"({{ zones: wGF.zones(), again: (wGF.powers().list.find(x => x.key === '{u.get('key')}') || {{}}).why }})")
        check(any(z['id'] == u.get('id') and z['left'] == 3 for z in z1['zones']) and z1['again'] == 'used this game',
              'the ultimate leaves its zone for 3 plays, and is used for the game', z1)
        await pg.wait_for_function("wGF.phase === 'post'", timeout=30000)
        z2 = await pg.evaluate("({ zones: wGF.zones(), end: wGF.G.drive.end })")
        zl = [z for z in z2['zones'] if z['id'] == u.get('id')]
        check((zl and zl[0]['left'] == 2) or (z2['end'] and not z2['zones']), 'after a play the zone has 2 left, or the drive is over and it is gone', z2)

        # ---------- a score gives the side scored on mana ----------
        sc = await pg.evaluate("""async () => { for (let i = 0; i < 30; i++) {
          await new Promise(r => { const w = () => wGF.phase === 'call' ? r() : setTimeout(w, 30); w(); });
          if (wGF.yourBall) { wGF.G.ball = 99; wGF.G.togo = 1; } wGF.setAuto(false);
          wGF.call(wGF.yourBall ? 'run' : 'zone');
          await new Promise(r => { const w = () => wGF.phase === 'live' || wGF.phase === 'kick' ? r() : setTimeout(w, 20); w(); });
          const before = wGF.G.mana.slice();
          await new Promise(r => { const w = () => wGF.phase === 'post' ? r() : setTimeout(w, 20); w(); });
          if (wGF.G.drive.end === 'td') { const s = wGF.G.drive.side; return { before, after: wGF.G.mana.slice(), s }; } } return null; }""")
        check(sc and sc['after'][1 - sc['s']] == min(6, sc['before'][1 - sc['s']] + 1) and sc['after'][sc['s']] == sc['before'][sc['s']],
              'a touchdown gives the side scored on 1 mana, and the scorers none', sc)

        # ---------- stamina on the field ----------
        st = await pg.evaluate("""(() => { const G = wGF.G, s = G.drive.side, T = G.teams[s], ri = T.off.QB; G.stam[s][ri] = 0;
          const row = wGF.lineup()[0].players.find(p => p.pos === 'QB'); return { stam: row.stam, spd: row.r.spd, base: row.base.spd }; })()""")
        check(st['stam'] == 0 and st['spd'] < st['base'], 'a player with no stamina plays on worn ratings, and the lineup shows it', st)
        await pg.evaluate("wGridBar()")
        sta = await pg.evaluate("[...document.querySelectorAll('#wGridLineup th')].some(t => t.textContent === 'Sta')")
        check(sta, 'the lineup has a Sta column')

        # ---------- the Realm: CPU skill by tier, How it works, How to play ----------
        r = await pg.evaluate("""(() => { renderHelp(); const h = document.getElementById('wHelpGfPowers'), how = document.getElementById('wGridHow').textContent;
          return { skill: [1, 2, 3].map(t => wGridSkill(t)[1]), help: h ? h.textContent : '', how: /ultimate/.test(how) && /Stamina/.test(how), book: document.querySelectorAll('.wgbook tbody tr').length }; })()""")
        check(r['skill'] == [0, 1, 2] and 'mana' in r['help'] and 'ultimate' in r['help'] and r['how'] and r['book'] == 18,
              'their CPU casts better by tier, How to play explains powers, and How it works lists every kind\'s', r)
        await pg.evaluate("wLeaveGridiron()")
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
