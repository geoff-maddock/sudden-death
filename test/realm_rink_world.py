# Realm rink: hockey from the world, and the Pond Rink's own ways (issue #83, phase 6).
# The pond: snow builds in its patches through a period (faster when it is snowing) and slows a puck sliding through
# it, until the break; a dead stretch of the old boards drops a puck and a lively one throws it back; a big hit by the
# boards cracks the ice, which slows skaters and skips the puck, until the break; three shots with no answer, a big hit
# or a goal brings the bank's roar, which helps that side for a few seconds. A save point is taken at each whistle,
# plain data, and a game resumed from one goes on from there to its end.
# In the world: a game needs three of your own; Old Tove's SHINNY opens the card (the local side, Play, Manage,
# Simulate); Simulate settles at once (gold, fans, XP, the record, your players' lines, once a day a club); a game you
# play shows Save and leave and Concede; leaving in live play waits for the whistle; a saved game resumes from the Rink
# tab and is asked about after a reload; Concede is a loss; a game played to the end settles and says so. The Stats
# tab's Hockey view and a player's card have the lines. Asserts; exits nonzero on failure.
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

SETUP = """window.__game = (seed, o) => { wHK.start(Object.assign({ seed, pond: true }, o || {})); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); return wHK.play; };
window.__away = (P, keep) => { P.pl.forEach((p, i) => { if (!keep.includes(i)) { p.x = 2.5; p.y = 8.5 - (i % 6) * .2; p.vx = p.vy = 0; } }); };
window.__put = (P, i, x, y) => { const p = P.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; p.stun = 0; p.cd = 0; p.act = ''; return p; };
window.__plain = v => { const ok = x => x === null || ['number', 'string', 'boolean'].includes(typeof x) || (Array.isArray(x) ? x.every(ok) : typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype && Object.values(x).every(ok)); return ok(v); }; 0"""
CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

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

        # ---------- the pond ----------
        d = await pg.evaluate("""(() => { wHK.start({ seed: 3 }); const none = wHK.pond; const P = __game(3), D = wHK.pond, R = wHK.pondRules, G = wHK.G; wHK.setFouls({ trip: 0, hook: 0, board: 0, rough: 0 });
          const start = { snow: D.snow.length, d0: D.snow.every(s => s.d === 0), boards: D.boards.length, kinds: [D.boards.some(b => b.e < .5), D.boards.some(b => b.e > .8)], crack: D.crack, roar: D.roar, plain: __plain(D) };
          const grow = snow => { __game(3, { snow }); let n = 0, t = 0; while (t < 600 && n++ < 6000) { if (wHK.phase === 'live') t++; wHK.step(); } return wHK.pond.snow[0].d; };
          const dry = grow(false), wet = grow(true);
          const P2 = __game(4), G2 = wHK.G; __away(P2, []); const s = G2.pond.snow[0]; s.x = 20; s.y = 0; s.r = 3; s.d = 0; G2.pond.snow.slice(1).forEach(q => { q.x = 2; q.y = 9; q.r = .1; });
          const slide = () => { wHK.loose(16, 0, 0, 9); let n = 0; while (Math.hypot(P2.puck.vx, P2.puck.vy) > 0 && n++ < 600) wHK.puckStep(); return P2.puck.x - 16; };
          const clean = slide(); s.d = 1; const deep = slide(), drag = [wHK.pondDrag(20, 0), wHK.pondDrag(30, 5)]; wHK.pondBreak(); const scraped = G2.pond.snow[0].d;
          return { none, start, dry, wet, clean, deep, drag, scraped, R }; })()""")
        st = d['start']
        check(d['none'] is None and st['snow'] == 4 and st['d0'] and st['boards'] == 3 and st['kinds'] == [True, True] and st['crack'] is None and st['roar'] is None and st['plain'],
              'a game at the Pond Rink has its own ways (four patches where the snow builds, three old stretches of boards, dead and lively), plain data; a game elsewhere has none', d)
        check(0 < d['dry'] < .4 and d['wet'] > d['dry'] * 1.8, 'snow builds on the ice as the period goes on, about twice as fast when it is snowing', d)
        check(d['deep'] < d['clean'] * .8 and d['drag'][0] > 2.5 and d['drag'][1] == 1 and d['scraped'] == 0, 'a puck sliding through deep snow slows and stops short; Old Tove scrapes the ice at the break', d)
        b = await pg.evaluate("""(() => { const P = __game(5), G = wHK.G; __away(P, []); const B = G.pond.boards; B[0] = { wall: 'top', x: 12, w: 4, e: wHK.pondRules.dead }; B[1] = { wall: 'top', x: 28, w: 4, e: wHK.pondRules.lively }; B[2] = { wall: 'bot', x: 20, w: .1, e: .55 };
          G.pond.snow.forEach(q => { q.x = 2; q.y = 9; q.r = .1; });
          const off = x => { wHK.loose(x, -6, -Math.PI / 2, 12); let hit = false, n = 0; while (n++ < 60) { wHK.puckStep(); if (P.puck.vy > 0) { hit = true; break; } } return hit ? Math.hypot(P.puck.vx, P.puck.vy) : 0; };
          return { dead: off(12), plain: off(20), lively: off(28), e: [wHK.pondBounce(12, -9.8), wHK.pondBounce(20, -9.8), wHK.pondBounce(28, -9.8), wHK.pondBounce(12, 0)] }; })()""")
        check(b['dead'] < b['plain'] * .5 and b['lively'] > b['plain'] * 1.4 and b['e'][0] < b['e'][1] < b['e'][2] and b['e'][3] == .55, 'a puck dies off a dead stretch of the old boards, and jumps back off a lively one', b)
        c = await pg.evaluate("""(() => { const P = __game(6), G = wHK.G, R = wHK.pondRules; __away(P, [1, 6]); __put(P, 6, 20, -9); __put(P, 1, 20.8, -8.6);
          wHK.pondHit(1, 6, R.crack - 1); const soft = G.pond.crack; __put(P, 6, 20, 0); wHK.pondHit(1, 6, R.crack + 1); const mid = G.pond.crack, roar1 = wHK.roaring(0);
          G.pond.roar = null; __put(P, 6, 20, -9); wHK.pondHit(1, 6, R.crack + 1); const crack = G.pond.crack, msg = wHK.msg;
          const skater = __put(P, 1, 14, -9); const run = on => { G.pond.crack = on ? { x: 22, y: -9, r: 8 } : null; skater.x = 16; skater.y = -9; skater.vx = skater.vy = 0; for (let t = 0; t < 45; t++) wHK.skate(1, 38, -9); return skater.x - 16; };
          const slowed = run(true); G.pond.crack = { x: 20, y: -6, r: R.crackR }; const dirs = new Set();
          for (let i = 0; i < 8; i++) { wHK.loose(15, -6, 0, 14); let n = 0; while (P.puck.x < 20.5 && n++ < 80) wHK.puckStep(); dirs.add(Math.round(Math.atan2(P.puck.vy, P.puck.vx) * 20)); }
          const free = run(false); G.pond.crack = { x: 20, y: -9, r: 1 }; wHK.pondBreak();
          return { soft, mid, roar1, crack, msg, slowed, free, dirs: dirs.size, flooded: G.pond.crack }; })()""")
        check(c['soft'] is None and c['mid'] is None and c['roar1'] and c['crack'] and abs(c['crack']['x'] - 20) < .01 and 'cracks' in c['msg'], 'a big enough hit by the boards cracks the ice there; out in the open it only brings a roar', c)
        check(c['slowed'] < c['free'] * .85 and c['dirs'] >= 3 and c['flooded'] is None, 'skaters are slowed over the crack and a puck skips off line there, until the break', c)
        r = await pg.evaluate("""(() => { const P = __game(7), G = wHK.G, R = wHK.pondRules.roar, gx = wHK.goalX(0), g = P.pl[11]; __away(P, [2, 11]); const sp = wHK.goalSpot(1, gx - 6, 0); g.x = sp[0]; g.y = sp[1];
          const q0 = wHK.shotOdds(2, 'wrist', gx - 6, 0).q; wHK.pondShot(0, false); wHK.pondShot(0, false); const two = wHK.roaring(0); wHK.pondShot(1, false); wHK.pondShot(0, false); wHK.pondShot(0, false); const broken = wHK.roaring(0);
          wHK.pondShot(0, false); const three = wHK.roaring(0), other = wHK.roaring(1), q1 = wHK.shotOdds(2, 'wrist', gx - 6, 0).q, t0 = G.pond.roar.t; wHK.pondShot(1, true); const held = wHK.roaring(0) && !wHK.roaring(1);
          let n = 0; while (wHK.roaring(0) && n++ < 3000) wHK.step(); G.pond.roar = null; wHK.pondShot(1, true); const goal = wHK.roaring(1);
          return { two, broken, three, other, dq: q1 - q0, t0, held, goal, R }; })()""")
        check(not r['two'] and not r['broken'] and r['three'] and not r['other'] and abs(r['dq'] - r['R']['q']) < 1e-9 and r['t0'] == r['R']['secs'] and r['held'] and r['goal'],
              'three shots on goal with no answer, or a goal, brings the bank\'s roar for that side: a little on every shot for a few seconds, and never over one already going', r)
        sn = await pg.evaluate("""(() => { const snaps = []; wHK.wantSnap = () => true; wHK.onSnap = s => snaps.push(s); const P = __game(8), G = wHK.G; wHK.call(0, 'att', 'rush'); let n = 0; while (snaps.length < 3 && n++ < 9000) wHK.step();
          const s = snaps[snaps.length - 1], was = { score: G.score.slice(), clock: G.clock, p: G.p, ph: wHK.phase, att: G.call[0].att, pond: G.pond.boards.length, on: JSON.stringify(G.on) };
          wHK.wantSnap = () => false; wHK.start({ seed: 99 }); wHK.resume(s); const G2 = wHK.G, now = { score: G2.score.slice(), clock: G2.clock, p: G2.p, ph: wHK.phase, att: G2.call[0].att, pond: G2.pond.boards.length, on: JSON.stringify(G2.on) };
          n = 0; while (wHK.phase !== 'over' && n++ < 60000) wHK.step(); const end = wHK.summary();
          wHK.wantSnap = null; wHK.onSnap = null;
          return { n: snaps.length, at: snaps.map(x => x.GD.ph), plain: __plain(s), was, now, over: wHK.phase, win: end.win, total: end.score[0] + end.score[1] >= was.score[0] + was.score[1] }; })()""")
        check(sn['n'] >= 3 and all(a in ('dead', 'break') for a in sn['at']) and sn['plain'] and sn['was'] == sn['now'], 'a save point is taken at each whistle, plain data; resumed, the game is where it was (score, clock, calls, lines, the pond)', sn)
        check(sn['over'] == 'over' and sn['win'] in (0, 1) and sn['total'], 'and it plays on from there to its end', sn)

        # ---------- the world ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false"); await pg.evaluate(SETUP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        g0 = await pg.evaluate("(() => { const n = wRoster().length; const save = wRoster().slice(); WG.roster.length = Math.min(n, 2); const few = wRinkProblems(), r = wStartRink({ club: 'local', how: 'sim' }); WG.roster = save; return { n, few, r, live: wRinkLive() }; })()")
        check(len(g0['few']) == 1 and 'needs 3 of your own' in g0['few'][0] and g0['r'] == g0['few'][0] and not g0['live'], 'a hockey game needs three players of your own', g0)
        await pg.evaluate("(() => { const kinds = ['troll', 'harpy', 'spider', 'lich', 'witch', 'vampire', 'werewolf']; let i = 0; while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern')); })()")
        await pg.evaluate(CLOSE_ALL)
        t = await pg.evaluate("(() => { const K = DB.chars.gk_rink; return { act: K.topics.shinny && K.topics.shinny.act, job: /SHINNY/.test(K.topics.job.t), scrim: K.topics.scrimmage.act }; })()")
        await pg.evaluate("wRunAct('hkcard')")
        await pg.wait_for_selector('#modalBox [data-hkclub]')
        cd = await pg.evaluate("({ title: document.querySelector('#modalBox h3').textContent, clubs: [...new Set([...document.querySelectorAll('#modalBox [data-hkclub]')].map(x => x.dataset.hkclub))], hows: [...document.querySelectorAll('#modalBox [data-hkclub=\"local\"]')].map(x => x.textContent), text: document.getElementById('modalBox').textContent, exhib: !!document.getElementById('wHkExhib') })")
        check(t == {'act': 'hkcard', 'job': True, 'scrim': 'rinkscrim'} and cd['title'] == 'Play a hockey game' and 'local' in cd['clubs'] and cd['hows'] == ['Play', 'Manage', 'Simulate'] and 'Nobody goes home level' in cd['text'] and cd['exhib'],
              'Old Tove\'s SHINNY opens the game card: the local side, to Play, Manage or Simulate, and the scrimmage still there', [t, cd])
        before = await pg.evaluate("({ gold: RUN.gold, fans: RUN.fans || 0, xp: wRoster().map(p => p.xp || 0), lvl: wRoster().map(p => p.lvl), day: WG.dayAbs, min: WG.min })")
        await pg.click('#modalBox [data-hkclub="local"][data-hkhow="sim"]')
        await pg.wait_for_selector('#wRinkOk')
        s1 = await pg.evaluate("""(() => { const B = WG.hkg, g = B.games[0], S = WG.hkstats, ids = wRoster().map(p => p.id);
          return { msg: document.querySelector('#modalBox .wmsg').textContent, live: B.live, rec: [B.w, B.l], g: g && { r: g.r, us: g.us, them: g.them, club: g.club, how: g.how, tier: g.tier, mvp: g.mvp }, met: B.met.local === WG.dayAbs, gold: RUN.gold, fans: RUN.fans || 0,
            lines: ids.filter(id => S[id] && S[id].gg === 1).length, secs: ids.map(id => (S[id] || {}).sec || 0), goals: ids.reduce((a, id) => a + ((S[id] || {}).g || 0), 0), last: WG.lastMatch, plain: __plain(WG.hkg) && __plain(WG.hkstats), xpUp: wRoster().some((p, i) => (p.xp || 0) !== 0 || p.lvl > 2), view: UI.view }; })()""")
        won = s1['g'] and s1['g']['r'] == 'win'
        check(s1['live'] is None and s1['rec'] == ([1, 0] if won else [0, 1]) and s1['g']['club'] == 'local' and s1['g']['how'] == 'sim' and s1['g']['us'] != s1['g']['them'] and s1['met'] and s1['msg'].startswith('Final') and s1['plain'] and s1['view'] == 'world',
              'Simulate settles the game at once: a result card, the record, and that club played for today; all plain data', s1)
        check((s1['gold'] > before['gold'] and s1['fans'] > before['fans']) == bool(won) and s1['lines'] >= 6 and s1['goals'] == s1['g']['us'] - (0 if 'shootout' not in s1['msg'] or not won else 1) and s1['last']['kind'] == 'hkgame',
              'a win pays gold and fans, and either way your players who played get their lines (their goals add up to yours)', [before, s1])
        await pg.click('#wRinkOk'); await pg.evaluate(CLOSE_ALL)
        again = await pg.evaluate("wStartRink({ club: 'local', how: 'sim' })")
        check('already played you at hockey today' in again, 'a club plays you at hockey once a day', again)
        # a game you manage: the bar, Save and leave, Resume, the reload prompt, Concede
        await pg.evaluate("(() => { delete WG.hkg.met.local; })()")
        r0 = await pg.evaluate("wStartRink({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'rink' && wHK.on")
        bar = await pg.evaluate("({ r: '" + "' + String(0) + '" + "', mode: wHK.mode, save: !document.getElementById('wRinkSave').hidden, give: !document.getElementById('wRinkGive').hidden, again: document.getElementById('wRinkAgain').hidden, back: document.getElementById('wRinkBack').hidden, mins: document.getElementById('wRinkMins').parentElement.hidden, pond: !!wHK.pond, ordered: wHK.G.ordered, title: document.getElementById('wRinkTitle').textContent, live: wRinkLive(), world: wRinkWorld(), rows: !document.getElementById('wRinkCalls').hidden })")
        check(r0 == '' and bar['mode'] == 'manage' and bar['save'] and bar['give'] and bar['again'] and bar['back'] and bar['mins'] and bar['pond'] and bar['ordered'] == [True, False] and bar['live'] and bar['world'] and bar['rows'] and ' against ' in bar['title'],
              'a game you Manage opens on the rink with Save and leave and Concede on the bar, your bench in your order, the coach\'s rows, and the pond\'s ways', bar)
        await pg.evaluate("wHK.speed = 6"); await pg.wait_for_function("wHK.phase === 'live' && !!WG.hkg.live.snap", timeout=120000)
        await pg.click('#wRinkSave')
        lv = await pg.evaluate("({ text: document.getElementById('wRinkSave').textContent, dis: document.getElementById('wRinkSave').disabled, view: UI.view })")
        check('next whistle' in lv['text'] and lv['dis'] and lv['view'] == 'rink', 'Save and leave pressed in live play waits for the next whistle', lv)
        await pg.wait_for_function("UI.view === 'world'", timeout=120000)
        sv = await pg.evaluate("({ live: !!WG.hkg.live, snap: !!WG.hkg.live.snap, score: WG.hkg.live.snap.G.score, clock: WG.hkg.live.snap.G.clock, p: WG.hkg.live.snap.G.p, on: wHK.on, log: (WG.log || []).slice(-1)[0], saved: JSON.parse(localStorage.getItem(pkey('sd-realm')) || 'null') })")
        check(sv['live'] and sv['snap'] and not sv['on'], 'the game is kept at that whistle, and the rink is parked', {k: sv[k] for k in ['live', 'snap', 'score', 'clock', 'on']})
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wOpenCamp('rink')"); await pg.wait_for_selector('[data-hkresume]')
        await pg.click('[data-hkresume]'); await pg.wait_for_function("UI.view === 'rink' && wHK.on")
        rs = await pg.evaluate("({ score: wHK.G.score, clock: wHK.G.clock, p: wHK.G.p, save: !document.getElementById('wRinkSave').hidden, mode: wHK.mode, ph: wHK.phase })")
        check(rs['score'] == sv['score'] and rs['clock'] == sv['clock'] and rs['p'] == sv['p'] and rs['save'] and rs['mode'] == 'manage', 'Resume on the Rink tab puts it back where it was', [rs, sv['score'], sv['clock']])
        await pg.evaluate("wHK.pause(true)")
        rl = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); wHK.hide(); WHK = null; WHKG.asked = false; wStart(save); showView('world'); return { live: wRinkLive(), view: UI.view }; })()""")
        await pg.evaluate("wNextPrompt()")
        await pg.wait_for_selector('#wHkRes')
        pr = await pg.evaluate("document.getElementById('modalBox').textContent")
        await pg.click('#wHkRes'); await pg.wait_for_function("UI.view === 'rink' && wHK.on")
        check(rl['live'] and 'A hockey game is waiting' in pr and await pg.evaluate("wRinkWorld()"), 'after a reload a saved game is asked about once, and resumes', [rl, pr[:120]])
        await pg.click('#wRinkGive'); await pg.wait_for_selector('#cfYes'); await pg.click('#cfYes')
        await pg.wait_for_function("UI.view === 'world' && !wRinkLive()")
        cn = await pg.evaluate("({ g: WG.hkg.games[0].r, rec: [WG.hkg.w, WG.hkg.l], n: WG.hkg.games.length })")
        check(cn['g'] == 'lose' and cn['n'] == 2 and cn['rec'][1] >= 1, 'Concede counts as a loss', cn)
        # played to the end
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("(() => { delete WG.hkg.met.local; })()")
        await pg.evaluate("wStartRink({ club: 'local', how: 'manage' })"); await pg.wait_for_function("UI.view === 'rink' && wHK.on")
        await pg.evaluate("wHK.speed = 8")
        await pg.wait_for_function("wHK.phase === 'over' && !wRinkLive()", timeout=240000)
        en = await pg.evaluate("({ note: document.getElementById('wRinkNote').textContent, save: document.getElementById('wRinkSave').hidden, back: !document.getElementById('wRinkBack').hidden, n: WG.hkg.games.length, g: WG.hkg.games[0], score: wHK.G.score })")
        check(en['note'].startswith('Final') and en['save'] and en['back'] and en['n'] == 3 and [en['g']['us'], en['g']['them']] == en['score'] and en['g']['how'] == 'manage', 'a game played to the end settles in the world, and the bar says how it went', en)
        await pg.click('#wRinkBack'); await pg.wait_for_function("UI.view === 'world'"); await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wOpenCamp('rink')"); await pg.wait_for_selector('#wCampBody .wrinksix')
        tb = await pg.evaluate("({ play: !!document.querySelector('[data-hkplay]'), recent: (document.querySelector('#wCampBody .wstlog') || {}).textContent || '', head: (document.querySelector('#wCampBody .wbrh') || {}).textContent || '' })")
        await pg.click('[data-ctab="stats"]'); await pg.click('[data-wsview="hockey"]')
        vs = await pg.evaluate("({ gp: [...document.querySelectorAll('#wCampBody table.wstats tbody tr')].map(r => r.children[2].textContent), heads: [...document.querySelectorAll('#wCampBody table.wstats thead th')].map(x => x.textContent.trim()).slice(0, 5) })")
        await pg.click('#wCampBody [data-wsp-open]')
        cardt = await pg.evaluate("(document.querySelector('#wCampBody .whkc .wbdbox') || {}).textContent || ''")
        check(tb['play'] and 'Last hockey games' in tb['head'] and 'against' in tb['recent'] and vs['heads'] == ['Player', 'Spot', 'GP', 'Min', 'G'] and any(x not in ('–', '0') for x in vs['gp']) and 'hockey game' in cardt,
              'the Rink tab has Play a game and the last games; the Stats tab\'s Hockey view and a player\'s card have the lines', [tb, vs, cardt])
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("showPage('help')"); hp = await pg.evaluate("(document.getElementById('wHelpRinkGame') || {}).textContent || ''"); await pg.evaluate("showPage('play')")
        check('Hockey games.' in hp and 'SHINNY' in hp and 'Save and leave' in hp and 'roars' in hp, 'How to play explains hockey games and the Pond Rink\'s ways', None)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
