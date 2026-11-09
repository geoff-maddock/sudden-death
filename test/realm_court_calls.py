# Realm court, the call (issue #77, phase 4). Six offense sets and five defenses: each set has defenses it beats and
# defenses that beat it, and each defense stops some set (the table); the sets change how a possession is played
# (Spread for three takes more threes, Post up more shots by the bigs at the rim, Pick and roll sets screens, Motion
# makes more cuts and assists, Isolation puts the ball in the star's hands), and the defenses change what they give up
# (the zone and the pack give up threes and take away the rim, the press gets steals, Switch everything switches every
# pick); over many fixed-call games the matchups show in points a trip. The scout: a set run again is guarded better.
# Stances: Push plays faster and loses it more, Grind slower; Gamble steals and fouls more, Sit back fouls less. Timeouts:
# three a half, breath back, the other side's hot hand cools, one more in overtime, and none left means none. The CPU
# at three skill levels: an Archmage beats a Squire more often than not. In the Realm: Manage on the bar, the calls
# panel (your set, defense, Pace, Pressure, timeouts, subs at a stoppage), the CPU picker, T for a timeout, and How to
# play. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-court-calls.png.
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
# n fixed-call games, both ways round: side 0 runs `off` against `def`, side 1 runs motion against man; the totals
LAB = f"""(off, def, n, extra) => {{ const T = (extra && extra.teams) || {T}; const t = {{ pts: 0, poss: 0, tpa: 0, fga: 0, rim: 0, big: 0, ast: 0, stl: 0, screen: 0, beat: 0, pf: 0, tov: 0, games: 0, possAll: 0 }};
  for (let i = 0; i < n; i++) for (const sw of [0, 1]) {{ const teams = sw ? [T[1], T[0]] : T;
    const s = wBK.simGame(Object.assign({{ teams, seed: 3000 + i, calls: [Object.assign({{ off, def: 'man' }}, extra && extra[0]), Object.assign({{ off: 'motion', def }}, extra && extra[1])] }}, extra && extra.opts));
    const L = s.sets[0][off] || {{ n: 0, pts: 0 }}, b = s.box[0].tot; t.pts += L.pts; t.poss += L.n; t.tpa += b.tpa; t.fga += b.fga; t.ast += b.ast; t.stl += s.box[1].tot.stl; t.pf += s.box[1].tot.pf; t.tov += b.tov; t.games++; t.possAll += s.poss[0] + s.poss[1];
    t.rim += s.log.filter(l => l.side === 0 && (l.k === 'layup' || l.k === 'dunk')).length; t.screen += s.tally.screen; t.beat += s.tally.beat; }}
  t.ppp = t.pts / Math.max(1, t.poss); t.three = t.tpa / Math.max(1, t.fga); return t; }}"""

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
        await pg.evaluate(f"window.__lab = {LAB}; 0")

        # ---------- the table ----------
        tb = await pg.evaluate("""(() => { const S = Object.keys(wBK.sets), D = Object.keys(wBK.defs);
          return { sets: S.length, defs: D.length, setOk: S.filter(s => s !== 'hot').every(s => D.some(d => wBK.edge(s, d)[0] > 0) && D.some(d => wBK.edge(s, d)[0] < 0)),
            defOk: D.every(d => S.some(s => wBK.edge(s, d)[0] < 0)), why: S.every(s => D.every(d => !wBK.edge(s, d)[0] || wBK.edge(s, d)[1].length > 10)) }; })()""")
        check(tb == {'sets': 6, 'defs': 5, 'setOk': True, 'defOk': True, 'why': True}, 'six sets and five defenses: each set beats some defense and loses to another, each defense stops some set, each with a reason', tb)

        # ---------- the sets change the play ----------
        st = await pg.evaluate("""(() => { const n = 8, r = {}; for (const s of ['motion', 'spread', 'post', 'pick', 'iso']) r[s] = __lab(s, 'man', n); const sh = { teams: [{ name: 'S', kinds: ['elf', 'lich', 'skeleton', 'witch', 'golem'] }, { name: 'B', kinds: ['kobold', 'vampire', 'gorgon', 'spider', 'golem'] }] };
          r.spreadSw = __lab('spread', 'switch', n, sh); r.motionSw = __lab('motion', 'switch', n, sh); return r; })()""")
        m = st['motion']
        check(st['spreadSw']['three'] > st['motionSw']['three'] + .08, 'with shooters, Spread for three takes far more threes than Motion (against Switch everything, which neither beats the other at the arc)', {k: round(v['three'], 2) for k, v in st.items()})
        check(st['post']['rim'] > m['rim'] * 1.1, 'Post up gets more shots at the rim', {k: v['rim'] for k, v in st.items()})
        check(st['pick']['screen'] > m['screen'] * 1.8, 'Pick and roll sets far more screens', {k: v['screen'] for k, v in st.items()})
        check(m['ast'] > st['iso']['ast'] and st['iso']['beat'] > m['beat'] * 1.15, 'Motion moves the ball for more assists; Isolation goes one on one (more defenders beaten off the dribble)', {k: [v['ast'], v['beat']] for k, v in st.items()})
        df = await pg.evaluate("""(() => { const n = 8, r = {}; for (const d of ['man', 'zone', 'pack', 'press', 'switch']) r[d] = __lab('motion', d, n); return r; })()""")
        check(df['zone']['three'] > df['man']['three'] and df['pack']['three'] > df['man']['three'], 'the zone and packing the paint give up more threes than man', {k: round(v['three'], 2) for k, v in df.items()})
        check(df['pack']['rim'] < df['man']['rim'] and df['zone']['rim'] < df['man']['rim'], 'and take away shots at the rim', {k: v['rim'] for k, v in df.items()})
        check(df['press']['stl'] > df['man']['stl'] * 1.25, 'the press gets more steals', {k: v['stl'] for k, v in df.items()})
        sw = await pg.evaluate("""(() => { const T = """ + T + """; let sw = 0, all = 0; for (let i = 0; i < 6; i++) { wBK.start({ teams: T, seed: 70 + i, calls: [{ off: 'pick', def: 'man' }, { off: 'motion', def: 'switch' }] });
          for (let k = 0; k < 30 * 120 && wBK.phase !== 'over'; k++) { wBK.step(); const P = wBK.play; if (P && P.pickLast && wBK.calls().cur.side === 0) { all++; if (P.pickLast === 'switch') sw++; } if (P) P.pickLast = null; } } return { sw, all }; })()""")
        check(sw['all'] > 5 and sw['sw'] == sw['all'], 'against Switch everything every pick is a switch', sw)
        mx = await pg.evaluate("""(() => { const n = 14, pair = (o, a, b) => [__lab(o, a, n).ppp, __lab(o, b, n).ppp];
          return { spread: pair('spread', 'zone', 'man'), iso: pair('iso', 'man', 'pack'), post: pair('post', 'press', 'pack'), pick: pair('pick', 'man', 'switch') }; })()""")
        check(all(v[0] > v[1] for v in mx.values()), 'over many games the matchups show in points a trip: each set scores more against the defense it beats than against the one that beats it', mx)

        # ---------- the scout ----------
        sc = await pg.evaluate("""(() => { wBK.start({ seed: 5, calls: [{ off: 'spread', def: 'man' }, { off: 'motion', def: 'man' }] }); let n = 0, seen = [];
          while (wBK.phase !== 'over' && n++ < 30 * 200 && seen.length < 6) { wBK.step(); const c = wBK.calls().cur; if (c && c.side === 0 && seen[seen.length - 1] !== JSON.stringify(c) ) seen.push(JSON.stringify(c)); }
          const stales = seen.map(s => JSON.parse(s).stale);
          const P = wBK.play, i = P.pl.findIndex(p => p.side === 0 && p.pos === 'SF'), G = wBK.G; G.poss = 0; G.cur = { side: 0, off: 'spread', def: 'man', stale: 0, star: 0 };
          const x = wBK.hoopX(0) - wBK.dir(0) * 5, fresh = wBK.shotP(i, x, 0).p; G.cur.stale = 2; const stale = wBK.shotP(i, x, 0).p;
          return { stales, fresh, stale }; })()""")
        check(sc['stales'][:3] == [0, 1, 2] and max(sc['stales']) == 2 and sc['stale'] < sc['fresh'] - .05, 'the scout: the same set again is guarded better (stale 0, 1, then 2 and no more), a few points off every shot', sc)

        # a defense changed mid-possession waits for the next one; a timeout can't stop a shot already rising; bad ids don't crash
        nx = await pg.evaluate("""(() => { wBK.start({ seed: 15, skill: [0, 0], mode: 'manage' }); const G = wBK.G; let n = 0;
          while (!(wBK.phase === 'live' && G.poss === 1) && n++ < 30 * 120) wBK.step(); const before = G.cur.def, pick = before === 'zone' ? 'pack' : 'zone';
          wBK.call('def', pick); const during = G.cur.def; n = 0; while (G.poss === 1 && n++ < 30 * 60) wBK.step(); n = 0; while (G.poss === 0 && n++ < 30 * 60) wBK.step();
          const next = G.cur.side === 1 ? G.cur.def : null;
          wBK.start({ seed: 16, skill: [0, 0], mode: 'play' }); n = 0; while (!(wBK.phase === 'live' && wBK.G.poss === 0 && wBK.play.ball.st === 'held' && wBK.play.ball.h === wBK.me) && n++ < 30 * 120) wBK.step();
          wBK.input({ shoot: true }); const rising = !!wBK.meter, to = wBK.timeout(), still = !!wBK.meter; wBK.input({ shoot: false });
          let bad = 'ok'; try { wBK.simGame({ seed: 3, calls: [{ off: 'spred', def: 'nope' }, null] }); } catch (e) { bad = String(e); }
          return { before, during, next, pick, rising, to, still, bad }; })()""")
        check(nx['during'] == nx['before'] and nx['next'] == nx['pick'], 'a defense changed during their possession takes hold from the next one, not this one', nx)
        check(nx['rising'] and nx['to'] != '' and nx['still'] and nx['bad'] == 'ok', 'no timeout while your shooter is rising; unknown call ids are ignored, not a crash', nx)

        # ---------- stances ----------
        ss = await pg.evaluate("""(() => { const n = 8; return { push: __lab('motion', 'man', n, [{ pace: 'push' }, null]), bal: __lab('motion', 'man', n), grind: __lab('motion', 'man', n, [{ pace: 'grind' }, null]),
          gamble: __lab('motion', 'man', n, [null, { press: 'gamble' }]), sit: __lab('motion', 'man', n, [null, { press: 'sit' }]) }; })()""")
        poss = {k: v['poss'] for k, v in ss.items()}
        check(ss['push']['poss'] > ss['bal']['poss'] > ss['grind']['poss'], 'Pace: Push has more possessions than Balanced, and Grind fewer', poss)
        check(ss['push']['tov'] > ss['grind']['tov'], 'Push turns it over more than Grind', {k: v['tov'] for k, v in ss.items()})
        check(ss['gamble']['stl'] > ss['bal']['stl'] > ss['sit']['stl'] and ss['gamble']['pf'] > ss['sit']['pf'] * 1.3, 'Pressure: Gamble steals and fouls more, Sit back less', {k: [v['stl'], v['pf']] for k, v in ss.items()})

        # ---------- timeouts ----------
        to = await pg.evaluate("""(() => { const T = """ + T + """; wBK.start({ teams: T, seed: 9, skill: [0, 0], mode: 'manage' }); let n = 0; while (wBK.phase !== 'live' && n++ < 300) wBK.step();
          const G = wBK.G; while (!(wBK.phase === 'live' && G.poss === 0 && wBK.play.ball.st === 'held') && n++ < 30 * 60) wBK.step();
          G.stam[0][0] = 50; G.hot[1][0] = 3; const r = wBK.timeout(), ph = wBK.phase, sta = G.stam[0][0], cooled = G.hot[1][0], left = G.to[0];
          n = 0; while (wBK.phase === 'timeout' && n++ < 400) wBK.step(); const after = wBK.phase, poss = G.poss;
          G.to[0] = 0; const none = wBK.timeout();
          return { r, ph, sta, cooled, left, after, poss, none }; })()""")
        check(to['r'] == '' and to['ph'] == 'timeout' and to['sta'] > 50 and to['cooled'] == 0 and to['left'] == 2, 'a timeout with your ball: breath back, their hot hand cools, one fewer left', to)
        check(to['after'] in ('walk', 'live') and to['poss'] == 0 and to['none'] != '', 'play restarts with your ball; with none left there is no timeout', to)
        # timeouts only where they belong: never in a break; one mid-walk is the same possession (not a new one, not scouted again)
        tw = await pg.evaluate("""(() => { wBK.start({ seed: 14, skill: [0, 0], mode: 'manage' }); const G = wBK.G; let n = 0;
          while (wBK.phase !== 'walk' && n++ < 30 * 120) wBK.step(); const side = G.poss, p0 = G.poss0[side], st0 = G.scout[side].n;
          const r = wBK.timeout(side); n = 0; while (wBK.phase !== 'live' && n++ < 600) wBK.step();
          const same = { r, poss: G.poss0[side] - p0, scout: G.scout[side].n - st0 };
          G.q = 2; G.clock = .02; n = 0; while (wBK.phase !== 'break' && n++ < 30 * 60) wBK.step(); const brk = wBK.timeout(0), to = G.to.slice();
          return { same, brk, to }; })()""")
        check(tw['same'] == {'r': '', 'poss': 0, 'scout': 0} and tw['brk'] != '' and tw['to'] == [3, 3], 'a timeout mid-walk keeps the same possession (not counted or scouted again); none in a break, so halftime still brings three', tw)
        # the CPU doesn't spend its timeouts on back-to-back dead balls
        ct = await pg.evaluate("""(() => { let worst = 0; for (let i = 0; i < 12; i++) { const s = wBK.simGame({ seed: 4000 + i, skill: [2, 2] }); worst = Math.max(worst, ...s.timeouts); } return worst; })()""")
        check(ct <= 6, 'the CPU never uses more than its six a game (three a half)', ct)
        hl = await pg.evaluate("""(() => { const s = wBK.simGame({ seed: 31, mins: 3 }); wBK.start({ seed: 31, mins: 3, skill: [0, 0] }); const G = wBK.G; G.to = [0, 1]; G.q = 2; G.clock = 0.05; let n = 0;
          while (wBK.phase !== 'break' && n++ < 30 * 60) wBK.step(); return { to: G.to.slice(), q: G.q, half: wBK.phase }; })()""")
        check(hl['to'] == [3, 3], 'a new half brings three timeouts again', hl)
        # ---------- the coaches ----------
        sk = await pg.evaluate("""(() => { const T = """ + T + """; let w = 0, n = 0; for (let i = 0; i < 40; i++) for (const sw of [0, 1]) { const s = wBK.simGame({ teams: sw ? [T[1], T[0]] : T, seed: 2000 + i, skill: [2, 0] }); if (s.win === 0) w++; if (s.win != null) n++; }
          const sq = wBK.simGame({ teams: T, seed: 5, skill: [0, 0] }); return { w, n, sqTo: sq.timeouts }; })()""")
        check(sk['w'] > sk['n'] * .52 and sk['sqTo'] == [0, 0], 'an Archmage beats a Squire more often than not; a Squire never calls a timeout', sk)

        # ---------- the Realm ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        modes = await pg.evaluate("[...document.querySelectorAll('#wCourtModes button')].map(b => b.dataset.cmode)")
        check(modes == ['watch', 'manage', 'play'], 'the bar: Watch, Manage and You play', modes)
        await pg.evaluate("document.getElementById('wCourtSkill').value = '2'; document.getElementById('wCourtSkill').dispatchEvent(new Event('change')); wRunAct('scrimmage')")
        await pg.wait_for_function("UI.view === 'court' && wBK.on")
        await pg.click('[data-cmode="manage"]')
        await pg.wait_for_function("!document.getElementById('wCourtCalls').hidden")
        pn = await pg.evaluate("""({ skill: wBK.G.skill, mode: wBK.mode, off: document.querySelectorAll('#wCourtCalls [data-ccall="off"]').length, def: document.querySelectorAll('#wCourtCalls [data-ccall="def"]').length,
          pace: document.querySelectorAll('#wCourtCalls [data-ccall="pace"]').length, press: document.querySelectorAll('#wCourtCalls [data-ccall="press"]').length, to: !!document.getElementById('wCourtTO'), pad: document.getElementById('wCourtPad').hidden,
          tip: document.querySelector('#wCourtCalls [data-cid="spread"]').title })""")
        check(pn['skill'] == [2, 2] and pn['mode'] == 'manage' and [pn['off'], pn['def'], pn['pace'], pn['press']] == [6, 5, 3, 3] and pn['to'] and pn['pad'] and 'Good against' in pn['tip'],
              'Manage: the calls panel has six sets, five defenses, Pace, Pressure and timeouts (each set says what it beats); no pad; the CPU picker set the skill', pn)
        await pg.click('#wCourtCalls [data-cid="spread"]'); await pg.click('#wCourtCalls [data-cid="zone"]'); await pg.click('#wCourtCalls [data-cid="grind"]')
        cl = await pg.evaluate("wBK.calls().call[wBK.you]")
        check(cl['off'] == 'spread' and cl['def'] == 'zone' and cl['pace'] == 'grind', 'the panel\'s buttons make your calls', cl)
        # a stoppage: the subs are there
        await pg.evaluate("wBK.speed = 8")
        await pg.wait_for_function("['dead', 'break', 'timeout'].includes(wBK.phase) && !!document.getElementById('wCourtSubGo')", timeout=60000)
        await pg.evaluate("wBK.pause(true)")
        sb = await pg.evaluate("""(() => { const out = +document.getElementById('wCourtSubOut').value, inn = +document.getElementById('wCourtSubIn').value; document.getElementById('wCourtSubGo').click(); return { on: wBK.onFloor()[wBK.you].includes(inn), off: !wBK.onFloor()[wBK.you].includes(out) }; })()""")
        check(sb == {'on': True, 'off': True}, 'at a stoppage Subs swaps who you pick', sb)
        await pg.screenshot(path='/tmp/realm-court-calls.png', full_page=True)
        await pg.evaluate("wBK.pause(false); wBK.speed = 1")
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wCourtHow'); return { table: !!h.querySelector('.wcedge'), words: /scout/.test(h.textContent) && /Archmage/.test(h.textContent) && /Timeouts/.test(h.textContent) && /Grind/.test(h.textContent), help: !!document.getElementById('wHelpCourtCall') }; })()")
        check(hp == {'table': True, 'words': True, 'help': True}, 'How to play has the matchups table, the scout, stances, timeouts and the coaches', hp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
