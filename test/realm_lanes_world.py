# Realm lanes (issue #100, phase 5): bowling from the world.
# The hall (on with hall: true, off by default): the tide turns once at its frame and the lanes play heavier or drier;
# Moll's off-spot pin moves its spot, and a re-rack sets it right (yours, a Knight's for the headpin, an Archmage's for
# any pin, never a Squire's); the gutter crab, the swell and the gull now and then change what fell, at about their
# rates, and only pins that stood. Manage: your captain bowls your side on your line. A snapshot between balls resumes
# as it was and plays on to the end. Each bowler's box score adds up to the side's pins.
# The Realm: Moll Gutter offers a MATCH (BOWL stays the exhibition); the card lists the clubs with Play, Manage and
# Simulate, and the tide. Simulate settles at once: a win or a loss, XP for everyone, a line each for your five, gold
# only with a win, and each club once a day. Play: a real match with the hall, Save and leave and Concede on the bar,
# kept between balls; Save and leave goes back to the world with the match kept; a waiting match is asked about and
# Resume brings it back as it was; played out it settles. Concede is a loss. The Lanes tab has Bowl a match and the
# last matches; the Stats tab's Bowling view the lines. Asserts; exits nonzero on failure.
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
window.__five = () => ({ name: 'D', short: 'D', roster: [0, 1, 2, 3, 4].map(i => ({ n: 'd' + i, kind: 'dwarf', hand: 1 })) });
window.__to = (ph, max) => { let n = 0; while (wBL.phase !== ph && n++ < (max || 6000)) wBL.tick(0.05); return wBL.phase === ph; };
window.__out = () => { let n = 0; while (!(WBL && WBL.over) && n++ < 40000) wBL.tick(0.05); return !!(WBL && WBL.over); };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- the hall ----------
        h = await pg.evaluate("""(() => { const off = wBL.start({ seed: 1 }).hall; const G = wBL.start({ seed: 2, hall: true, tide: 'mid' }); G.tideTurn = { at: 2, to: 'high', done: false };
          let said = ''; for (let i = 0; i < 14; i++) { const t = wBL.turn(); if (t.tide) said = t.tide; } return { off, hall: G.hall, tide: wBL.tide, said, done: G.tideTurn.done }; })()""")
        check(h['off'] is False and h['hall'] and h['tide'] == 'high' and h['done'] and 'tide turns' in h['said'] and 'heavier' in h['said'], 'the tide under the floor turns once at its frame, and the lanes play heavier', h)
        o = await pg.evaluate("""(() => { const out = {}; let G = wBL.start({ seed: 3, hall: true, mode: 'play', teams: [__five(), __five()] }); wBL.pause(true); __to('aim');
          G.offspot[0] = { n: 1, dx: 2, dy: 0 }; out.marked = !!wBL.offspot[0]; const r = wBL.select({ rerack: true }); out.rr = [r, wBL.offspot[0], G.rerack[0]];
          const call = (sk, n) => { const G = wBL.start({ seed: 4, hall: true, skill: [sk, 1], teams: [__five(), __five()] }); G.offspot[0] = { n, dx: 2, dy: 1 }; const said = wBL.cpuCall(0); return [!!G.rerack[0], said.includes('re-rack')]; };
          out.squire = call(0, 1); out.knight1 = call(1, 1); out.knight6 = call(1, 6); out.arch6 = call(2, 6); return out; })()""")
        check(o['marked'] and o['rr'][0] is True and o['rr'][1] is None and o['rr'][2], 'Moll\'s off-spot pin, and your re-rack sets it right (once a game)', o)
        check(o['squire'] == [False, False] and o['knight1'] == [True, True] and o['knight6'] == [False, False] and o['arch6'] == [True, True], 'a Knight re-racks a headpin off its spot, an Archmage any pin, a Squire never', o)
        ev = await pg.evaluate("""(() => { wBL.start({ seed: 5, hall: true }); const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], R = wBL.hallRules; let crab = 0, crabOk = true, swell = 0, gull = 0, ok = true, pup = 0;
          const gut = { gutter: 300, path: [[-21, 300]] }, hit = { gutter: null, path: [] };
          for (let i = 0; i < 2000; i++) { const a = wBL.hallAfter(0, all, gut, []); if (a.down.length) { crab++; if (a.down.join() !== '10') crabOk = false; } }
          for (let i = 0; i < 4000; i++) { const a = wBL.hallAfter(0, all, hit, [1, 2, 3, 5, 6, 8, 9]); if (a.down.some(p => ![1, 2, 3, 5, 6, 8, 9, 4, 7, 10].includes(p))) ok = false; if (/booms/.test(a.said)) swell++; if (/gull/.test(a.said)) gull++; }
          for (let i = 0; i < 1000; i++) { const a = wBL.hallAfter(0, all, hit, [1, 2, 3, 4, 5, 6, 7, 8, 9]); if (/Brinepup/.test(a.said)) pup++; }
          return { crab: crab / 2000, crabOk, swell: swell / 4000, gull: gull / 4000, ok, pup: pup / 1000, R }; })()""")
        R = ev['R']
        check(abs(ev['crab'] - R['crab']) < .03 and ev['crabOk'], 'a gutter crab now and then clips a right-gutter ball back for the 10', ev)
        check(abs(ev['swell'] - R['swell']) < .015 and 0 < ev['gull'] < .03 and ev['ok'], 'the swell and the gull now and then take a pin that stood', ev)
        check(.2 < ev['pup'] < .5, 'the Brinepup barks at a pin left standing', ev)

        # ---------- Manage, the snapshot, the box score ----------
        mg = await pg.evaluate("""(() => { wBL.start({ seed: 7, mode: 'manage', teams: [__five(), __five()] }); wBL.pause(true); wBL.manage({ line: 'deep', tempo: 'quick' });
          let aim = false, n = 0; while (n++ < 3000 && wBL.G.n < 6) { wBL.tick(0.05); if (wBL.phase === 'aim') aim = true; }
          return { aim, line: wBL.line(0), tempo: wBL.stance(0).tempo, mgr: wBL.mgr }; })()""")
        check(not mg['aim'] and mg['line'] == 'deep' and mg['tempo'] == 'quick', 'Manage: your captain bowls your side on your line and tempo; you never set up a ball', mg)
        sn = await pg.evaluate("""(() => { wBL.start({ seed: 8, mode: 'watch', hall: true }); wBL.pause(true); let n = 0; while (wBL.G.n < 11 && n++ < 3000) wBL.tick(0.05); __to('next');
          const S = wBL.snapshot(), json = JSON.stringify(S) === JSON.stringify(JSON.parse(JSON.stringify(S))), want = JSON.stringify(S.G);
          wBL.start({ seed: 99 }); wBL.resume(S); const same = JSON.stringify(wBL.G) === want; n = 0; while (!wBL.G.over && n++ < 30000) wBL.tick(0.05);
          const G = wBL.G, pins = [0, 1].map(s => G.pst[s].reduce((a, p) => a + p.pins, 0)), st = [G.st[0].pins, G.st[1].pins];
          return { json, same, over: !!G.over, pins, st, frames: G.pst[0].reduce((a, p) => a + p.frames, 0) }; })()""")
        check(sn['json'] and sn['same'] and sn['over'], 'a snapshot between balls is plain JSON, resumes as it was, and plays on to the end', sn)
        check(sn['pins'] == sn['st'] and sn['frames'] >= 10, 'each bowler\'s box score adds up to the side\'s pins', sn)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['zombie', 'spider', 'gorgon']; let i = 0; while (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind: kinds[i++ % 3], lvl: 2 }, 'tavern')); wFiveAuto(); })()")
        t = await pg.evaluate("(() => { const K = DB.chars.gk_lanes; return { match: K.topics.match && K.topics.match.act, bowl: K.topics.bowl && K.topics.bowl.act, job: /MATCH/.test(K.topics.job.t) }; })()")
        check(t == {'match': 'lncard', 'bowl': 'lanesbowl', 'job': True}, 'Moll Gutter offers a MATCH (BOWL stays the exhibition)', t)
        await pg.evaluate("wRunAct('lncard')")
        await pg.wait_for_selector('#modalBox [data-lnclub]')
        c = await pg.evaluate("""(() => { const b = document.getElementById('modalBox'), clubs = [...new Set([...b.querySelectorAll('[data-lnclub]')].map(x => x.dataset.lnclub))];
          return { clubs: clubs.length, hows: [...b.querySelectorAll('[data-lnclub="' + clubs[0] + '"]')].map(x => x.dataset.lnhow), ex: !!document.getElementById('wLnExhib'), tide: /The tide is/.test(b.textContent) }; })()""")
        check(c['clubs'] >= 1 and c['hows'] == ['play', 'manage', 'sim'] and c['ex'] and c['tide'], 'the match card: the clubs, each with Play, Manage and Simulate, the tide, and the exhibition', c)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        s = await pg.evaluate("""(() => { const xp0 = Object.fromEntries(wRoster().map(p => [p.id, p.xp || 0])), gold0 = RUN.gold, B = wLng(), w0 = B.w + B.l;
          const r = wStartLanes({ club: 'local', how: 'sim' }); document.getElementById('modal').hidden = true; const g = B.games[0], five = WG.lanes.five.filter(k => typeof k === 'number');
          const xpUp = wRoster().every(p => (p.xp || 0) > xp0[p.id] || (p.lvl || 1) > 1), lines = five.every(id => WG.lnstats[id] && WG.lnstats[id].g === 1);
          const again = wStartLanes({ club: 'local', how: 'sim' });
          return { r, played: B.w + B.l - w0, g: { r: g.r, text: g.text, mvp: g.mvp != null, us: g.us }, live: !!B.live, met: B.met.local === WG.dayAbs, xpUp, lines, gold: g.r === 'win' ? RUN.gold > gold0 : RUN.gold === gold0, again }; })()""")
        check(s['r'] == '' and s['played'] == 1 and s['g']['r'] in ('win', 'lose') and s['g']['us'] > 0 and not s['live'] and s['met'], 'Simulate settles at once: a win or a loss, and the local side is met for today', s)
        check(s['xpUp'] and s['lines'] and s['gold'] and 'already bowled you today' in s['again'], 'everyone gets XP, your five a line each, gold only with a win; each club once a day', s)
        await pg.evaluate("WG.lng.met = {}")
        pl = await pg.evaluate("""(() => { const r = wStartLanes({ club: 'local', how: 'play' }); wBL.pause(true); __to('aim');
          const bar = { save: !$('wLanesSave').hidden, give: !$('wLanesGive').hidden, again: $('wLanesAgain').hidden, back: $('wLanesBack').hidden };
          wBL.drag(1, 0); __to('next'); const snap = !!WG.lng.live.snap; __to('aim');
          return { r, world: !!WBL.world, view: UI.view, hall: wBL.G.hall, bar, snap }; })()""")
        check(pl['r'] == '' and pl['world'] and pl['view'] == 'lanes' and pl['hall'], 'Play: a real match at the Lanes, with the hall', pl)
        check(pl['bar'] == {'save': True, 'give': True, 'again': True, 'back': True} and pl['snap'], 'Save and leave and Concede on the bar (not Another game), and the match is kept between balls', pl)
        lv = await pg.evaluate("""(() => { const sn = WG.lng.live.snap, want = JSON.stringify(sn.G); $('wLanesSave').click();
          const away = { view: UI.view, live: !!WG.lng.live, same: JSON.stringify(WG.lng.live.snap.G) === want };
          WLNG.asked = false; const asked = wNextPrompt(), text = $('modalBox').textContent; $('wLnRes').click();
          return { away, asked, waiting: /A bowling match is waiting/.test(text), back: { view: UI.view, same: JSON.stringify(wBL.G) === want, world: !!WBL.world } }; })()""")
        check(lv['away'] == {'view': 'world', 'live': True, 'same': True}, 'Save and leave: back in the world, the match kept as it was', lv)
        check(lv['asked'] and lv['waiting'] and lv['back'] == {'view': 'lanes', 'same': True, 'world': True}, 'a match waiting is asked about, and Resume brings it back as it was', lv)
        po = await pg.evaluate("""(() => { const B = wLng(), n0 = B.games.length; wBL.setMode('watch'); wBL.pause(true); const done = __out(); return { done, n: B.games.length - n0, note: $('wLanesNote').textContent, live: wLanesLive() }; })()""")
        check(po['done'] and po['n'] == 1 and 'Final:' in po['note'] and not po['live'], 'played out, the match settles and the bar says the final', po)
        await pg.evaluate("wLeaveLanes()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate("WG.lng.met = {}")
        await pg.evaluate("(() => { wStartLanes({ club: 'local', how: 'manage' }); wBL.pause(true); __to('addr'); $('wLanesGive').click(); })()")
        await pg.wait_for_function("!document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const b = [...document.querySelectorAll('#modalBox button')].find(x => x.textContent.trim() === 'Concede'); b.click(); })()")
        cd = await pg.evaluate("({ live: wLanesLive(), last: WG.lng.games[0].r, text: WG.lng.games[0].text, view: UI.view })")
        check(cd == {'live': False, 'last': 'lose', 'text': 'conceded', 'view': 'world'}, 'Concede counts as a loss, and leaves the lanes', cd)
        await pg.evaluate("wOpenCamp('lanes')")
        await pg.wait_for_selector('#wCampBody .wlanesfive')
        tb = await pg.evaluate("(() => { const b = $('wCampBody'); return { play: !!b.querySelector('[data-lnplay]'), recent: /Last bowling matches/.test(b.textContent) }; })()")
        check(tb == {'play': True, 'recent': True}, 'the Lanes tab: Bowl a match, and the last matches', tb)
        await pg.evaluate("WCAMP.close && WCAMP.close()")
        sv = await pg.evaluate("""(() => { WSTAT.view = 'bowling'; const h = wCampStats(); return { cols: ['>G<', '>X<', '>/<', '>Pins<'].every(c => h.includes(c)) }; })()""")
        check(sv['cols'], 'the Stats tab\'s Bowling view has each player\'s lines', sv)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ game: !!$('wHelpLanesGame'), how: ['Matches.', 'The hall.'].every(w => ($('wLanesHow') || {}).textContent.includes(w)) })")
        check(hp == {'game': True, 'how': True}, 'How to play explains matches and the hall', hp)

        # ---------- found in review ----------
        # a sim leaves the page's game alone: its tracks, and its seeded stream
        sm = await pg.evaluate("""(() => { const run = sim => { wBL.start({ seed: 21, mode: 'watch', teams: [__five(), __five()] }); wBL.pause(true); let n = 0; while (wBL.G.n < 4 && n++ < 3000) wBL.tick(0.05); __to('next');
            const tr = JSON.stringify(wBL.tracks); if (sim) { wBL.simGame({ teams: [__five(), __five()] }); wBL.simGame({ seed: 3, teams: [__five(), __five()] }); } const same = JSON.stringify(wBL.tracks) === tr;
            n = 0; while (wBL.G.n < 9 && n++ < 3000) wBL.tick(0.05); return { same, log: JSON.stringify(wBL.G.log) }; };
          const a = run(false), b = run(true); return { tracks: b.same, stream: a.log === b.log }; })()""")
        check(sm == {'tracks': True, 'stream': True}, 'a simulated game never touches the game on the lanes: not its tracks, nor its seeded stream', sm)
        # your own ball never teaches the coach a wrong line; your mark carries the line's miss
        cb = await pg.evaluate("""(() => { const go = line => { wBL.start({ seed: 5, mode: 'play', teams: [__five(), __five()] }); wBL.pause(true); __to('aim'); if (line) wBL.select({ line }); const b0 = JSON.stringify(wBL.G.bias[0]);
            wBL.press(); const win = wBL.view.meter.win; wBL.press(); let n = 0; while (wBL.view.meter && wBL.view.meter.st !== 'gone' && n++ < 400) wBL.tick(0.005); wBL.press(); __to('rest');
            return { win, same: JSON.stringify(wBL.G.bias[0]) === b0 }; };
          const p = go(null), d = go('deep'); return { bias: p.same && d.same, ratio: +(p.win / d.win).toFixed(3), want: wBL.lines.deep.err }; })()""")
        check(cb['bias'] and abs(cb['ratio'] - cb['want']) < .01, 'a ball you bowl by hand leaves the coach\'s read alone, and Deep inside narrows your mark as it widens the CPU\'s miss', cb)
        # the tenth: a fill ball is called one, and the pinch and re-rack are gone after the frame's first ball
        fl = await pg.evaluate("""(() => { wLanesGame({ seed: 4, mode: 'play' }); wBL.pause(true); __to('aim'); let k = 0; while (!(wBL.up() === 0 && wBL.frameNo(0) === wBL.G.frames) && k++ < 200) wBL.roll(wBL.up(), 0); wBL.roll(0, 10); wBL.setMode('watch'); wBL.setMode('play'); __to('aim');
          wLanesRows(); return { msg: wBL.msg, pinch: $('wLanesRowPinch').hidden, why: wBL.beforeFrame(0) }; })()""")
        check('fill ball' in fl['msg'] and fl['pinch'] and fl['why'], 'the tenth after a strike: the next ball is a fill ball, and the pinch row is gone', fl)
        # Save and leave while your ball rolls: the ball counts, and is never bowled again
        await pg.evaluate("(() => { if (WBL) wLeaveLanes(); WG.lng.met = {}; WG.lng.live = null; })()")
        sl = await pg.evaluate("""(() => { wStartLanes({ club: 'local', how: 'play' }); wBL.pause(true); __to('aim'); const n0 = wBL.G.n;
          wBL.press(); wBL.press(); let n = 0; while (wBL.view.meter && wBL.view.meter.st !== 'gone' && n++ < 400) wBL.tick(0.005); wBL.press(); __to('roll');
          const ph = wBL.phase; wLanesLeaveGame(); const L = WG.lng.live; return { ph, n0, kept: L && L.snap.G.n, live: !!L }; })()""")
        check(sl['ph'] == 'roll' and sl['live'] and sl['kept'] == sl['n0'] + 1, 'Save and leave while your ball rolls keeps the match after that ball', sl)
        await pg.evaluate("(() => { wResumeLanes(); wBL.pause(true); WG.lng.live && wLanesCallOff('test'); if (WBL) { WBL = null; } showView('world'); })()")

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
