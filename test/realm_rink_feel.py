# Realm rink feel (issue #83, phase 12). The coach's notes: Hockey once your team has three players, the Pond Kettle
# once you have won a hockey game. Sound on the ice: saves, hits and goals through a game, from the engine's events
# (wHK.onEv), nothing with Sound effects off, and none from a game simulated behind the scenes. Medals: a hockey game
# won, a Pond Kettle won, a hat trick and a shutout count, and all four are in the book. How to play. Asserts; exits
# nonzero on failure.
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

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wRinkOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
# count the sounds instead of playing them
SPY = "(() => { window.__snd = {}; for (const k of Object.keys(sfx)) sfx[k] = () => { __snd[k] = (__snd[k] || 0) + 1; }; })()"

async def main():
    if not os.environ.get('SD_BUILT'): subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wRinkTips === 'function'"); await pg.evaluate("wHK.speed = 8")  # the rink at 8 steps a frame: the same game, sooner
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS).filter(k => k !== 'w_rink' && k !== 'w_kettle')); SET.tips = true")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the coach's notes ----------
        await pg.wait_for_function("tipQ.includes('w_rink') || TIPS_SEEN.includes('w_rink')", timeout=5000)
        coach = await pg.evaluate("(document.getElementById('coach') || {}).textContent || ''")
        check('Hockey' in coach and 'Rink tab' in coach and 'SHINNY' in coach, "with three players, a coach's note says how to play hockey", coach)
        if await pg.evaluate("!!document.getElementById('cOk')"): await pg.click('#cOk')
        check(not await pg.evaluate("TIPS_SEEN.includes('w_kettle') || tipQ.includes('w_kettle')"), 'no Pond Kettle note before a hockey game is won')

        # ---------- sound on the ice ----------
        await pg.evaluate("SET.sfx = true; SND.on = true")
        await pg.evaluate(SPY)
        await pg.evaluate("wStartRink({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'rink' && wHK.live", timeout=30000)
        await pg.evaluate("wHK.setMode('watch')")
        await pg.wait_for_function("(window.__snd.block || 0) >= 2 && (window.__snd.card || 0) >= 2", timeout=90000)
        s = await pg.evaluate("__snd")
        check(set(s) <= {'block', 'coin', 'card', 'crunch', 'crowd', 'hit', 'magic', 'crit', 'whistle', 'horn', 'bad'} and s.get('block', 0) >= 2, 'the play makes its sounds: saves, pokes, hits, the bank', s)
        ev = await pg.evaluate("""(() => { window.__snd = {}; const you = wHK.you; const say = (k, side) => wHK.onEv({ k, s: 'x', o: '', side });
          say('goal', you); const mine = Object.assign({}, __snd); window.__snd = {}; say('goal', 1 - you); const theirs = Object.assign({}, __snd); window.__snd = {};
          say('hit', 1 - you); const hit = Object.assign({}, __snd); window.__snd = {}; say('save', 1 - you); const save = Object.assign({}, __snd); window.__snd = {};
          say('ult', you); say('roar', you); say('icing', you); say('foul', you); say('crack', you); const rest = Object.assign({}, __snd); window.__snd = {}; return { mine, theirs, hit, save, rest }; })()""")
        check(ev['mine'] == {'horn': 1, 'crowd': 1} and ev['theirs'] == {'card': 1} and ev['hit'] == {'crunch': 1, 'crowd': 1} and ev['save'] == {'block': 1, 'crowd': 1} and ev['rest'] == {'crit': 1, 'crowd': 1, 'whistle': 2, 'crunch': 1},
              'your goal brings the horn and the bank, theirs does not; your hit and your goalie\'s save bring the bank; an ultimate, the roar, a whistle and the ice cracking each have a sound', ev)
        quiet = await pg.evaluate("(() => { window.__snd = {}; const club = Object.values(WG.rivals)[0]; wRinkSimClubs(club, 'local', 1); const n = Object.keys(__snd).length; return { n, hook: typeof wHK.onEv }; })()")
        check(quiet == {'n': 0, 'hook': 'function'}, 'a game simulated behind the scenes makes no sound, and the rink keeps its sounds after it', quiet)
        await pg.evaluate("(() => { SET.sfx = false; window.__snd = {}; window.__evs = 0; const f = wHK.onEv; wHK.onEv = e => { __evs++; f(e); }; window.__evOff = () => { wHK.onEv = f; }; return 0; })()")
        await pg.wait_for_function("window.__evs >= 12", timeout=30000)
        q = await pg.evaluate("(() => { __evOff(); return { snd: Object.keys(__snd).length, evs: __evs }; })()")
        check(q['snd'] == 0 and q['evs'] >= 12, 'with Sound effects off, the rink is quiet while the play goes on', q)
        await pg.evaluate("SET.sfx = true")

        # ---------- medals: a game won, a shutout, a hat trick ----------
        w0 = await pg.evaluate("({ w: ACHS.stats.realmRinkWins || 0, s: ACHS.stats.realmShutouts || 0, h: ACHS.stats.realmHatTricks || 0 })")
        await pg.wait_for_function("wHK.phase === 'live'", timeout=60000)
        await pg.evaluate("""(() => { const G = wHK.G, P = wHK.play; wHK.pause(true); const i = P.pl.findIndex(p => p.side === 0 && p.pos !== 'G' && WG.hkg.live.world.ids[p.ri] != null);
          G.score = [0, 0]; for (const b of G.stat[0]) b.g = 0; G.log.length = 0; wHK.goalBy(i); wHK.goalBy(i); wHK.goalBy(i); G.score[1] = 0; G.p = 3; G.clock = .3;
          const end = wHK.onOver; wHK.onOver = s => { window.__snd = {}; end(s); window.__end = Object.assign({}, __snd); wHK.onOver = end; }; wHK.pause(false); })()""")
        await pg.wait_for_function("wHK.phase === 'over' && !WG.hkg.live", timeout=60000)
        s = await pg.evaluate("window.__end")
        check(s.get('horn') == 1 and s.get('crowd') == 1 and 'bad' not in s, 'a win ends with the horn and the bank', s)
        w1 = await pg.evaluate("({ w: ACHS.stats.realmRinkWins || 0, s: ACHS.stats.realmShutouts || 0, h: ACHS.stats.realmHatTricks || 0, g: WG.hkg.games[0] })")
        check(w1['g']['r'] == 'win' and w1['g']['them'] == 0 and w1['w'] == w0['w'] + 1 and w1['s'] == w0['s'] + 1 and w1['h'] == w0['h'] + 1, 'a won hockey game counts for Pond Legs, a win without conceding for Shut the Door, and three goals by one of yours for Hat Trick', [w0, {k: w1[k] for k in 'wsh'}, w1['g']['us'], w1['g']['them']])
        await pg.click('#wRinkBack'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        await pg.wait_for_function("tipQ.includes('w_kettle') || TIPS_SEEN.includes('w_kettle')", timeout=5000)
        coach = await pg.evaluate("(document.getElementById('coach') || {}).textContent || ''")
        check('Pond Kettle' in coach and 'KETTLE' in coach, 'after a win, a coach\'s note points to the Pond Kettle', coach)
        if await pg.evaluate("!!document.getElementById('cOk')"): await pg.click('#cOk')

        # ---------- medals: a cup won ----------
        d0 = await pg.evaluate("ACHS.stats.realmKettles || 0")
        await pg.evaluate("(() => { RUN.gold = 500; WG.hkg.met = {}; wKettleEnter(); WG.hkcup.round = 2; WG.hkcup.games = [[{ a: 'me', b: WG.hkcup.field[1], ra: 3, rb: 2, w: 'me', end: '' }], [{ a: 'me', b: WG.hkcup.field[2], ra: 3, rb: 2, w: 'me', end: '' }], [{ a: 'me', b: WG.hkcup.field[4], ra: 4, rb: 3, w: 'me', end: 'ot' }]]; wKettleWon(); })()")
        check(await pg.evaluate("ACHS.stats.realmKettles || 0") == d0 + 1 and await pg.evaluate("['w_rink', 'w_kettle', 'w_hattrick', 'w_shutout'].every(id => ACH.some(a => a.id === id))"), 'a won Pond Kettle counts for its medal; all four medals are in the book')
        await pg.evaluate(CLOSE_ALL)

        # ---------- speed in Watch and Manage; the face-off line; mana comes back; how strong powers are ----------
        await pg.evaluate("showPage('play'); wRinkGame({ seed: 12, mode: 'watch' })")
        await pg.wait_for_function("wHK.phase === 'intro' || wHK.phase === 'live'")
        sp = await pg.evaluate("""(() => { const sel = document.getElementById('wRinkSpeed'), L = document.getElementById('wRinkSpeedL'); const shown = !L.hidden;
          sel.value = '4'; sel.dispatchEvent(new Event('change')); const at4 = wHK.speed;
          document.querySelector('#wRinkModes [data-kmode="play"]').click(); const play = [wHK.speed, L.hidden];
          document.querySelector('#wRinkModes [data-kmode="manage"]').click(); const man = [wHK.speed, L.hidden];
          sel.value = '1'; sel.dispatchEvent(new Event('change')); return { shown, at4, play, man, back: wHK.speed }; })()""")
        check(sp == {'shown': True, 'at4': 4, 'play': [1, True], 'man': [4, False], 'back': 1}, 'Speed runs a watched or managed game at up to 8 times; You play is always at 1', sp)
        await pg.evaluate("wRinkGame({ seed: 13, mode: 'play' })")
        await pg.wait_for_function("wHK.phase === 'live'")
        fo = await pg.evaluate("wHK.msg")
        check("didn't press" in fo, 'a face-off you did not press at says so', fo)
        mn = await pg.evaluate("""(() => { const R = wHK.powRules; wHK.start({ seed: 5, powers: true, mode: 'watch' }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          let d = null; for (let i = 0; i < 200 && d == null; i++) { const m = wHK.G.mana.slice(), f = (wHK.G.fxs || []).length; wHK.step(); if (wHK.phase === 'live' && (wHK.G.fxs || []).length === f && wHK.G.mana[0] > m[0]) d = wHK.G.mana[0] - m[0]; }
          return { k: R.k, mana: R.mana, d }; })()""")
        check(mn['k'] == 1.5 and mn['mana']['start'] == 4 and mn['mana']['max'] == 8 and mn['mana']['every'] == 30 and mn['d'] is not None and 0 < mn['d'] < .01, 'mana starts at 4 of 8 and comes back as play goes on; powers are one and a half times as strong', mn)
        hw = await pg.evaluate("(() => { showPage('help'); const t = document.getElementById('wRinkHow').textContent; showPage('play'); return t; })()")
        check('Speed.' in hw and '2, 4 or 8 times' in hw and 'how your timing was' in hw, 'How to play explains Speed and the face-off line', None)
        await pg.evaluate(CLOSE_ALL)

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpRinkFeel'); return h ? h.textContent : ''; })()")
        check('Sound effects' in help_ and 'medals' in help_ and 'hat trick' in help_, 'How to play mentions the sound and the medals', help_)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
