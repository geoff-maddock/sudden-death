# Realm court, games from the world (issue #77, phase 5). The engine: a snapshot at each stoppage (plain JSON) that
# resume puts back as it was; the Charter Court's own ways in its games (two waxed patches where a player turns slower,
# a bent rim after a big dunk that makes shots on it harder until a timeout re-hangs it, the yard's roar that lifts a
# side), and none of them elsewhere. In the Realm: Nim Hoopwright's HOOPS opens the game card with the clubs at your
# tier; a game needs three players of your own; Simulate settles at once (XP, gold and fans on a win, box lines into
# WG.bkstats, the head to head, the last games, the clock), and a club plays you once a day; Manage puts the game on
# the court with Save and leave and Concede on the bar; Save and leave pressed in live play leaves at the next stoppage,
# the game waits in the save, a reload asks to resume it, and it goes on from the same score; played to the end it
# settles; Concede is a loss. The Court tab has Play a game and the last games, the Stats tab's Basketball view the box
# lines, and How to play the games and the ground. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-court-world.png.
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

PLAIN = "v => { const ok = x => x === null || ['number', 'string', 'boolean'].includes(typeof x) || (Array.isArray(x) ? x.every(ok) : typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype && Object.values(x).every(ok)); return ok(v); }"

async def boot(pg, fresh=True):
    if fresh:
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await boot(pg)
        await pg.evaluate(f"window.__plain = {PLAIN}; 0")

        # ---------- save points ----------
        sv = await pg.evaluate("""(() => { const snaps = []; wBK.wantSnap = () => true; wBK.onSnap = sn => snaps.push(sn);
          wBK.start({ seed: 21, court: true }); let n = 0; while (snaps.length < 3 && n++ < 30 * 300) wBK.step();
          const sn = snaps[snaps.length - 1], plain = __plain(sn), ph = sn.GD.ph, score = sn.G.score.slice(), clock = sn.G.clock;
          wBK.step(30 * 20); wBK.resume(sn); wBK.hide(); const back = { ph: wBK.phase, score: wBK.G.score.slice(), clock: wBK.G.clock, court: !!wBK.G.court };
          n = 0; while (wBK.phase !== 'over' && n++ < 30 * 900) wBK.step(); const done = wBK.phase;
          wBK.wantSnap = () => false; wBK.onSnap = () => {};
          return { n: snaps.length, plain, ph, score, clock, back, done }; })()""")
        check(sv['n'] >= 3 and sv['plain'] and sv['ph'] in ('dead', 'break', 'ft'), 'a snapshot at each stoppage, as plain JSON', sv)
        check(sv['back'] == {'ph': sv['ph'], 'score': sv['score'], 'clock': sv['clock'], 'court': True} and sv['done'] == 'over', 'resume puts the game back where it was, and it plays on to the end', sv)

        # ---------- the ground ----------
        gd = await pg.evaluate("""(() => { wBK.start({ seed: 22, court: true }); const C = wBK.court(), off = (wBK.start({ seed: 22 }), wBK.court());
          wBK.start({ seed: 22, court: true }); let n = 0; while (wBK.phase !== 'live' && n++ < 300) wBK.step();
          const P = wBK.play, G = wBK.G, w = G.court.wax[0];
          // a turn on the wax against a turn off it: how much of the new way the player picks up in a moment
          const turn = onWax => { const p = P.pl[0]; p.x = onWax ? w.x : 2; p.y = onWax ? w.y : -6.5; p.vx = 6; p.vy = 0; p.stun = 0; const x0 = p.x;
            p.act = ''; const at = [p.x, p.y + 5]; for (let i = 0; i < 4; i++) { const dx = at[0] - p.x, dy = at[1] - p.y, d = Math.hypot(dx, dy), sp = 7, k = Math.min(1, 1 / 30 * 7 * (onWax ? wBK.courtRules.wax.turn : 1)); p.vx += (dx / d * sp - p.vx) * k; p.vy += (dy / d * sp - p.vy) * k; } return p.vy; };
          const i = P.pl.findIndex(p => p.side === G.poss && p.pos === 'SF'), x = wBK.hoopX(G.poss) - wBK.dir(G.poss) * 5;
          const straight = wBK.shotP(i, x, 0).p; G.court.bent = [true, true]; const bent = wBK.shotP(i, x, 0).p; G.court.bent = [false, false];
          G.court.roar = { side: G.poss, t: 5 }; const roar = wBK.shotP(i, x, 0).p; G.court.roar = null;
          return { wax: C.wax.length, off, straight, bent, roar }; })()""")
        check(gd['wax'] == 2 and gd['off'] is None, 'a game at the Charter Court has two waxed patches; a game anywhere else has none of the ground\'s ways', gd)
        check(gd['bent'] < gd['straight'] - .03 and gd['roar'] > gd['straight'], 'a bent rim makes shots on it harder; the roar makes them a little easier for its side', gd)
        tl = await pg.evaluate("""(() => { const T = [{ name: 'A', kinds: ['goblin', 'elf', 'werewolf', 'minotaur', 'troll', 'kobold', 'zombie'] }, { name: 'B', kinds: ['kobold', 'vampire', 'gorgon', 'spider', 'golem', 'harpy', 'skeleton'] }];
          const t = { slip: 0, bent: 0, roar: 0 }, none = { slip: 0, bent: 0, roar: 0 };
          for (let i = 0; i < 10; i++) { const s = wBK.simGame({ teams: T, seed: 90 + i, court: true }); for (const k in t) t[k] += s.tally[k]; const z = wBK.simGame({ teams: T, seed: 90 + i }); for (const k in none) none[k] += z.tally[k]; }
          wBK.start({ seed: 23, court: true, skill: [0, 0] }); let n = 0; const G = wBK.G; while (!(wBK.phase === 'live' && wBK.play.ball.st === 'held') && n++ < 30 * 60) wBK.step();
          G.court.bent = [true, false]; const r = wBK.timeout(G.poss); return { t, none, rehung: r === '' && !G.court.bent[0], msg: wBK.msg }; })()""")
        check(all(v > 0 for v in tl['t'].values()) and all(v == 0 for v in tl['none'].values()), 'over CPU games at the Court players slip on the wax, dunks bend the rim and the yard roars; elsewhere, never', tl)
        check(tl['rehung'] and 're-hangs' in tl['msg'], 'a timeout: Nim re-hangs a bent rim', tl)

        # ---------- the Realm (a fresh page: the checks above replaced the save-point hooks the Realm sets) ----------
        await boot(pg)
        await pg.evaluate(f"window.__plain = {PLAIN}; 0")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        ok = await pg.evaluate("(() => { const K = DB.chars.gk_court; return { act: K.topics.hoops && K.topics.hoops.act, job: /HOOPS/.test(K.topics.job.t), probs: wCourtProblems().length, roster: wRoster().length }; })()")
        check(ok['act'] == 'bkcard' and ok['job'], 'Nim Hoopwright offers HOOPS', ok)
        await pg.evaluate("""(() => { const kinds = ['elf', 'troll', 'werewolf', 'goblin', 'minotaur']; let i = 0; while (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind: kinds[i++ % kinds.length], lvl: 2 }, 'tavern')); wCourtAuto(); })()""")
        await pg.evaluate("wRunAct('bkcard')"); await pg.wait_for_selector('#modalBox [data-bkclub]')
        cd = await pg.evaluate("({ clubs: [...new Set([...document.querySelectorAll('#modalBox [data-bkclub]')].map(b => b.dataset.bkclub))], how: [...document.querySelectorAll('#modalBox [data-bkclub=\"local\"]')].map(b => b.dataset.bkhow) })")
        check('local' in cd['clubs'] and cd['how'] == ['play', 'manage', 'sim'], 'the game card: the local side and the rival clubs, each with Play, Manage and Simulate', cd)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        # Simulate settles at once
        sm = await pg.evaluate("""(() => { const R = wRoster(), xp0 = R.map(p => p.xp || 0), lv0 = R.map(p => p.lvl), gold0 = RUN.gold, min0 = WG.dayAbs * 1440 + WG.min;
          const r = wStartCourt({ club: 'local', how: 'sim' }); const B = WG.bkg, g = B.games[0];
          const again = wStartCourt({ club: 'local', how: 'sim' });
          const S = WG.bkstats || {}, lines = Object.values(S), xp = R.some((p, i) => (p.xp || 0) > xp0[i] || p.lvl > lv0[i]);
          return { r, live: B.live, games: B.games.length, res: g && g.r, score: g && [g.us, g.them], won: g && g.r === 'win', gold: RUN.gold - gold0, xp, lines: lines.length, line: lines[0], again,
            clock: WG.dayAbs * 1440 + WG.min - min0, plain: __plain(WG.bkg) && __plain(WG.bkstats) }; })()""")
        check(sm['r'] == '' and sm['live'] is None and sm['games'] == 1 and sm['xp'] and sm['lines'] >= 3 and sm['plain'] and sm['clock'] >= 90, 'Simulate settles at once: XP, a result in the last games, box lines for your players, an hour and a half on the clock, plain JSON', sm)
        check((sm['gold'] > 0) == sm['won'] and 'already played' in sm['again'], 'a win pays gold (a loss doesn\'t); the same club won\'t play you again today', sm)
        ln = sm['line']
        check(ln and ln['gg'] == 1 and ln['pts'] == 2 * ln['fgm'] + ln['tpm'] + ln['ftm'] and ln['sec'] > 0, 'a box line adds up: a game, minutes, points from field goals, threes and free throws', ln)
        # (the Simulate result card is shown: close it, as you would)
        await pg.evaluate("const b = document.getElementById('wCourtOk'); if (b) b.click()")
        # Manage: on the court, Save and leave at the next stoppage, the reload, Resume
        rv = await pg.evaluate("""(() => { const c = wBallClubs().find(k => k !== 'local'); if (!c) return { skip: true }; const r = wStartCourt({ club: c, how: 'manage' }); return { r, c, view: UI.view, world: WBK && WBK.world, save: !document.getElementById('wCourtSave').hidden, give: !document.getElementById('wCourtGive').hidden, again: document.getElementById('wCourtAgain').hidden, court: !!wBK.court() }; })()""")
        check(rv.get('skip') or (rv['r'] == '' and rv['view'] == 'court' and rv['world'] and rv['save'] and rv['give'] and rv['again'] and rv['court']), 'Manage puts the game on the court, at the Charter Court\'s own boards, with Save and leave and Concede on the bar (no Another game)', rv)
        if not rv.get('skip'):
            await pg.evaluate("wBK.speed = 6")
            await pg.wait_for_function("!!WG.bkg.live.snap && wBK.phase === 'live'", timeout=60000)
            await pg.click('#wCourtSave')
            lv = await pg.evaluate("({ leaving: document.getElementById('wCourtSave').textContent, view: UI.view })")
            await pg.wait_for_function("UI.view === 'world'", timeout=60000)
            sn = await pg.evaluate("({ live: !!WG.bkg.live, snap: !!WG.bkg.live.snap, score: WG.bkg.live.snap.G.score, ph: WG.bkg.live.snap.GD.ph, saved: !!JSON.parse(localStorage.getItem(pkey('sd-realm'))).WG.bkg.live })")
            check('next stoppage' in lv['leaving'] and lv['view'] == 'court' and sn['live'] and sn['snap'] and sn['saved'], 'Save and leave in live play waits for the next stoppage, then leaves; the game is in the save', {**lv, **sn})
            # a reload: the save comes back (as wStart takes it), and the game is offered once
            rl = await pg.evaluate("""(() => { const save = JSON.parse(localStorage.getItem(pkey('sd-realm'))); wStart(save); WBKG.asked = false;
              const asked = wNextPrompt(), card = !!document.getElementById('wBkRes'); return { asked, card }; })()""")
            check(rl['asked'] and rl['card'], 'after a reload, a waiting basketball game is offered once', rl)
            await pg.click('#wBkRes')
            await pg.wait_for_function("UI.view === 'court' && wBK.on")
            rs = await pg.evaluate("({ score: wBK.G.score, world: WBK.world, title: document.getElementById('wCourtTitle').textContent })")
            check(rs['score'] == sn['score'] and rs['world'], 'after a reload the game is waiting: Resume puts it back on the court at the same score', rs)
            await pg.screenshot(path='/tmp/realm-court-world.png')
            await pg.evaluate("wBK.speed = 8")
            await pg.wait_for_function("!WG.bkg.live && WBK && !!WBK.msg", timeout=240000)
            en = await pg.evaluate("({ games: WG.bkg.games.length, note: document.getElementById('wCourtNote').textContent, back: !document.getElementById('wCourtBack').hidden, save: document.getElementById('wCourtSave').hidden })")
            check(en['games'] == 2 and en['note'].startswith('Final') and en['back'] and en['save'], 'played to the end the game settles: the final on the bar, Back to the world, no Save and leave', en)
            await pg.click('#wCourtBack')
        # leaving at a stoppage saves the game as it is then: a sub made at the dead ball is in the save
        sl = await pg.evaluate("""(async () => { const c = wBallClubs().filter(k => k !== 'local')[2]; if (!c) return { skip: true };
          wStartCourt({ club: c, how: 'manage' }); wBK.speed = 8; for (let i = 0; i < 400 && wBK.phase !== 'dead'; i++) await new Promise(r => setTimeout(r, 25));
          wBK.pause(true); const you = wBK.you, out = wBK.onFloor()[you][0], inn = wBK.bench(you)[0]; if (inn == null) return { skip: true };
          const r = wBK.sub(you, out, inn); wCourtLeaveGame(); const sn = WG.bkg.live && WG.bkg.live.snap;
          const kept = !!sn && sn.G.on[you][0] === inn; wResumeCourt(); const back = wBK.onFloor()[you][0] === inn; wBK.pause(true);
          document.getElementById('wCourtGive').click(); document.getElementById('cfYes').click(); return { r, kept, back }; })()""")
        check(sl.get('skip') or (sl['r'] == '' and sl['kept'] and sl['back']), 'Save and leave at a stoppage keeps what was done in it: a sub made at the dead ball is in the save, and back after Resume', sl)
        # Concede is a loss
        cn = await pg.evaluate("""(() => { const c = wBallClubs().filter(k => k !== 'local')[1]; if (!c) return { skip: true }; const l0 = WG.bkg.l; wStartCourt({ club: c, how: 'manage' }); return { c, l0 }; })()""")
        if not cn.get('skip'):
            await pg.wait_for_function("UI.view === 'court' && wBK.on")
            # (a level-up prompt from the last game may be up: press the buttons themselves)
            await pg.evaluate("document.getElementById('wCourtGive').click()"); await pg.wait_for_selector('#cfYes'); await pg.evaluate("document.getElementById('cfYes').click()")
            await pg.wait_for_function("!WG.bkg.live")
            cc = await pg.evaluate(f"({{ l: WG.bkg.l - {cn['l0']}, live: WG.bkg.live, last: WG.bkg.games[0].r, view: UI.view }})")
            check(cc == {'l': 1, 'live': None, 'last': 'lose', 'view': 'world'}, 'Concede counts as a loss and goes back to the world', cc)
        # the Court tab and the Stats tab
        await pg.evaluate("wOpenCamp('court')"); await pg.wait_for_selector('#modalBox .wcourt')
        tb = await pg.evaluate("({ play: !!document.querySelector('#modalBox [data-bkplay]'), recent: /Last basketball games/.test(document.getElementById('wCampBody').textContent) })")
        check(tb == {'play': True, 'recent': True}, 'the Court tab: Play a game, and the last games', tb)
        await pg.evaluate("WCAMP.close(); WSTAT.view = 'basketball'; wOpenCamp('stats')"); await pg.wait_for_selector('#modalBox [data-wsview="basketball"]')
        st = await pg.evaluate("""(() => { const id = Object.keys(WG.bkstats)[0], row = document.querySelector(`#modalBox tr[data-wsp="${id}"]`); return { cells: row ? [...row.querySelectorAll('td')].map(t => t.textContent) : null, card: wStatsCard(wPlayer(+id)).includes('basketball game') }; })()""")
        check(st['cells'] and st['cells'][1] != '–' and int(st['cells'][1]) >= 1 and st['card'], 'the Stats tab\'s Basketball view has the box lines, and a player\'s card says them in words', st)
        await pg.evaluate("WCAMP.close && WCAMP.close(); showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpCourtGame'); return !!h && /HOOPS/.test(h.textContent) && /waxed/.test(h.textContent) && /re-hangs/.test(h.textContent) && /roars/.test(h.textContent); })()")
        check(hp, 'How to play explains the games, and the waxed boards, the bent rim and the roar', hp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
