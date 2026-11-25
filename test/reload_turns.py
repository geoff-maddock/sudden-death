# Realm reloads (issue #120, phase 1): a reload never takes back a settled shot, frame or stone, in golf, bowling and
# curling from the world (w107, w116, w125), as jousting's never takes back a course (w150). Not a check itself: the
# checks are realm_reload_links, realm_reload_lanes and realm_reload_shed, one engine each (for time), which call run().
# Each engine: a match against the local side, reloaded right after its first result (the ball still flying or rolling,
# the stone just come to rest) comes back with that result, still counted as met today, and once it is over the club
# can't be played again that day; a few turns on, a reload brings back every result settled (none lost, none to play
# again); reloaded as the deciding result is still on its way, the match is settled as the page comes back, before
# anything is pressed (no match waiting, no Later: its result card), once, with the result it ended on.
# Phase 1's review: a resumed match says the last result's line before "Back at"; in Play, the word and a power spent
# at your aim stay spent (golf: the word in Manage too, and a shot kept addressed comes back addressed, as called); a
# golf swing or a bowling ball reloaded between its power press and its mark goes off on that power, late at the bottom
# of the meter; a finished match's score says who won it.
# Curling: a stone of yours reloaded mid-slide comes to rest on the release you made, it is never thrown again.
# Asserts; the check exits nonzero on failure.
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

SKIP = "(() => { let i = 0; while (!document.getElementById('modal').hidden && i++ < 20) { const b = [...document.querySelectorAll('#modalBox button')].find(x => /^(Skip|Done|Later|Not now|Close|OK|Continue)$/.test(x.textContent.trim())); if (!b) break; b.click(); } })()"
# each engine as the check sees it: the engine, the Realm's calls, its book (WG.lkg, .lng, .shg), what has been settled
# (n: how many results; sig: the results themselves), and its prompt's Resume button
HELP = r"""
window.__E = {
  links: { e: () => wGL, start: o => wStartLinks(o), resume: () => wResumeLinks(), live: () => wLinksLive(), B: () => wLkg(), res: 'wLkRes',
    n: G => G.log.length, sig: G => JSON.stringify([G.log.map(e => [e.k, e.side, e.ri]), G.won, G.res, G.ball]), score: sn => wLinksScore(sn),
    keep: G => JSON.stringify([G.word, G.wordOn, G.mana, (G.casts || []).length]),
    spend: () => { const G = wGL.G; G.mana[0] = 99; const w = wGL.select({ word: true }); const c = ['pow', 'steady', 'ult'].find(k => wGL.castMine(k) === ''); return { w, c: c || null }; },
    concede: () => { const s = wGL.summary() || {}; s.win = 1; s.text = 'conceded'; wLinksSettle(s); WGL = null; wW107LeaveLinks(); } },
  lanes: { e: () => wBL, start: o => wStartLanes(o), resume: () => wResumeLanes(), live: () => wLanesLive(), B: () => wLng(), res: 'wLnRes',
    n: G => G.fr[0].flat().length + G.fr[1].flat().length, sig: G => JSON.stringify([G.fr, G.stand]), score: sn => wLanesScore(sn),
    keep: G => JSON.stringify([G.word, G.wordOn, G.mana, (G.casts || []).length]),
    spend: () => { const G = wBL.G; G.mana[0] = 99; const w = wBL.select({ word: true }); const c = ['pow', 'ult', 'steady'].find(k => wBL.castMine(k) === ''); return { w, c: c || null }; },
    concede: () => { const s = wBL.summary() || {}; s.win = 1; s.text = 'conceded'; wLanesSettle(s); WBL = null; wW116LeaveLanes(); } },
  shed: { e: () => wCR, start: o => wStartShed(o), resume: () => wResumeShed(), live: () => wShedLive(), B: () => wShg(), res: 'wShRes',
    n: G => G.n, sig: G => JSON.stringify([G.n, G.sc, G.stones]), score: sn => wShedScore(sn),
    keep: G => JSON.stringify([G.mana, (G.casts || []).length]),
    spend: () => { const G = wCR.G; G.mana[0] = 99; const c = ['pow', 'ult', 'steady'].find(k => wCR.castMine(k) === ''); return { w: null, c: c || null }; },
    concede: () => { const s = wCR.summary() || {}; s.win = 1; s.text = 'conceded'; wShedSettle(s); WCR = null; wShedModeBack(); wW125LeaveShed(); } },
};
// on until f() holds, a tick at a time (it stops the moment it does: a result just counted, its ball still moving)
window.__to = (k, f, max) => { const E = __E[k], e = E.e(); let i = 0; while (!f(e) && i++ < (max || 60000)) e.tick(0.05); return !!f(e); };
window.__st = k => { const E = __E[k], e = E.e(), G = e.G, B = E.B(); return { live: E.live(), met: (B.met || {}).local === WG.dayAbs, n: G && G.teams ? E.n(G) : null, sig: G && G.teams ? E.sig(G) : null,
  ph: e.phase, games: (B.games || []).length, wl: (B.w || 0) + (B.l || 0), last: B.games && B.games[0] ? B.games[0].text : null, r: B.games && B.games[0] ? B.games[0].r : null, msg: e.msg || '', keep: G && G.teams ? E.keep(G) : null }; };
// on to your own shot (golf: a full one when full is set, a putt on the way is stroked): their putts are given
window.__aim = (k, full) => { const E = __E[k], e = E.e(); let g = 0;
  while (g++ < 300) {
    __to(k, e => e.phase === 'aim' || e.phase === 'offer' || !E.live() || !!(e.G && e.G.over), 200000);
    if (e.phase === 'offer') { e.offer(true); continue; }
    if (e.phase !== 'aim') return false;
    if (!full || !(e.view.sel && e.view.sel.putt)) return true;
    e.press(); let i = 0; while (e.phase === 'swing' && i++ < 400) { e.tick(0.05); if (i === 10) e.press(); }
  }
  return false; };
0"""

async def main(engines):
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("""(() => { for (const kind of ['elf', 'spider', 'golem']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern'));
          SET.linksHoles = wGL.rules.holesAt[0]; SET.lanesFrames = wBL.rules.framesAt[0]; SET.shedEnds = wCR.rules.endsAt[0]; wSave(); })()""")

        # the page goes, and comes back from the saved game; the match waiting is resumed (by its prompt, or the tab's).
        # before: as the page comes back, before anything is pressed (what the prompt says, and whether it offers Later)
        # (#120 review: a decided match is settled by w159 once every part's load has run, never inside the load's first
        # world draw; and a settle that throws leaves the match waiting and the load whole. throw: the settle throws once)
        SETTLE = {'links': 'wLinksSettle', 'lanes': 'wLanesSettle', 'shed': 'wShedSettle'}
        async def reload(k, resume=True, throw=False, save=None):
            await pg.reload(); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
            await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false"); await pg.evaluate(HELP)
            await pg.evaluate("""([fn, throwOnce]) => { window.__settled = []; let thrown = !throwOnce; const f0 = window[fn];
              window[fn] = function () { const st = new Error().stack || ''; if (!thrown) { thrown = true; throw new Error('a settle that fails'); }
                window.__settled.push({ viaKept: st.includes('wKeptEnds'), loading: typeof WKEPT === 'object' ? WKEPT.loading : 'none' }); return f0.apply(this, arguments); }; }""", [SETTLE[k], throw])
            if save: await pg.evaluate("s => localStorage.setItem(wSaveKey(), s)", save)
            ok = await pg.evaluate("(() => { try { wStart(wLoadSave()); return true; } catch (e) { return String(e); } })()")
            await pg.wait_for_function("UI.view === 'world' && !!WG")
            if throw: return { 'started': ok, 'live': await pg.evaluate("k => __E[k].live()", k), 'settled': await pg.evaluate("window.__settled") }
            # (the prompt, or a result card, comes as the world is drawn)
            try: await pg.wait_for_function("!document.getElementById('modal').hidden", timeout=4000)
            except Exception: pass
            return await pg.evaluate("""([k, resume]) => { const E = __E[k], B = E.B(), m = document.getElementById('modal');
              const before = { live: E.live(), met: (B.met || {}).local === WG.dayAbs, games: (B.games || []).length, wl: (B.w || 0) + (B.l || 0),
                prompt: m.hidden ? '' : document.getElementById('modalBox').innerText, later: !m.hidden && [...document.querySelectorAll('#modalBox button')].some(b => /^Later$/.test(b.textContent.trim())) };
              if (resume) { const b = document.getElementById(E.res); if (b) b.click(); else if (E.live()) E.resume(); }
              const e = E.e(); if (E.live() && resume) e.pause(true);
              return Object.assign(__st(k), { before }); }""", [k, resume])

        for k in engines:
            # ---------- a reload right after the first result ----------
            # (the result's line is what the page says once the ball or stone is at rest; the match is kept as it was
            # struck, bowled or came to rest, so the line comes back with it, before "Back at")
            a = await pg.evaluate("""k => { const E = __E[k]; E.B().met = {}; const r = E.start({ club: 'local', how: 'manage' }); const e = E.e(); e.pause(true);
              __to(k, e => e.G && E.n(e.G) >= 1); const st = __st(k); __to(k, e => e.phase === 'rest', 2000); return Object.assign(st, { r, said: e.msg }); }""", k)
            r1 = await reload(k)
            check(a['r'] == '' and a['n'] == 1 and r1['before']['live'] and r1['before']['met'] and r1['live'] and r1['n'] == 1 and r1['sig'] == a['sig'],
                  f'{k}: a reload right after the first result brings the match back with it, still met today (never called off)', [a, r1])
            check(bool(a['said']) and r1['msg'].startswith(a['said']) and 'Back at' in r1['msg'],
                  f'{k}: the resumed match says the result\'s line first, then where it is back at', [a['said'], r1['msg']])
            ag = await pg.evaluate("""k => { const E = __E[k]; if (E.live()) E.concede(); __E[k].B(); const again = E.start({ club: 'local', how: 'sim' }); return { again, live: E.live() }; }""", k)
            check('today' in ag['again'] and not ag['live'], f'{k}: after that reload the club can\'t be played again that day', ag)

            # ---------- a few turns on ----------
            # (golf: the caddie's word called in Manage on the way is kept too, called as a shot is addressed: the shot comes
            # back addressed, as called, its potion and powers not called again)
            b = await pg.evaluate("""k => { const E = __E[k]; E.B().met = {}; E.start({ club: 'local', how: 'manage' }); const e = E.e(); e.pause(true);
              __to(k, e => E.n(e.G) >= 2); for (let i = 0; i < 400; i++) e.tick(0.05); const n0 = E.n(e.G); __to(k, e => E.n(e.G) >= n0 + 4);
              if (k === 'links') { __to(k, e => e.phase === 'addr'); const w0 = e.G.word[0]; e.manage({ word: true }); return Object.assign(__st(k), { spent: w0 - e.G.word[0], cpu: JSON.stringify(e.view.cpu) }); }
              return __st(k); }""", k)
            r2 = await reload(k)
            check(r2['live'] and r2['n'] == b['n'] and r2['sig'] == b['sig'], f'{k}: a few turns on, a reload brings back every result settled: none lost, none to play again', [b['n'], r2['n'], b['ph'], r2['ph']])
            if k == 'links':
                cpu2 = await pg.evaluate("JSON.stringify(wGL.view.cpu)")
                check(b['spent'] == 1 and r2['keep'] == b['keep'], 'links: the caddie\'s word called in Manage is not given back by a reload', [b['spent'], b['keep'], r2['keep']])
                check(b['ph'] == 'addr' and r2['ph'] == 'addr' and cpu2 == b['cpu'], 'links: a shot kept as it was addressed comes back addressed, as called (its potion and powers not called again)', [b['ph'], r2['ph'], b['cpu'], cpu2])
            await pg.evaluate("k => { if (__E[k].live()) __E[k].concede(); }", k)

            # ---------- the deciding result, still on its way ----------
            # (golf and bowling count a shot or a ball as it is struck or bowled: the page goes as it flies or rolls; a
            # curling stone counts as it comes to rest, so the page goes as the last stone of the last end slides, the
            # match won whatever it does). The match is settled as the page comes back, before anything is pressed: no
            # match waiting, no Later, its result card instead; settled once, and its words say a finished match is won
            c = await pg.evaluate("""k => { const E = __E[k], e = E.e(); E.B().met = {}; E.start({ club: 'local', how: 'manage' }); e.pause(true); const g0 = E.B().games.length, wl0 = E.B().w + E.B().l;
              if (k === 'shed') { __to(k, e => e.phase === 'rest'); const G = e.G, n = G.ends - 1; G.end = n; G.sc = [Array(n).fill(0), Array(n).fill(0)]; G.sc[0][0] = 5; G.k = 15; G.stones = [];
                __to(k, e => e.phase === 'slide'); for (let i = 0; i < 4; i++) e.tick(0.05); }
              else __to(k, e => !!e.G.over || !E.live(), 400000);
              const sn = JSON.parse(JSON.stringify(E.B().live.snap)); sn.G.over = sn.G.over || { win: 0, text: '6 to 4' };
              return Object.assign(__st(k), { g0, wl0, over: k === 'shed' ? 'by the last stone' : e.G.over ? e.G.over.text || '' : null, win: e.G.over ? e.G.over.win : null, settle: k === 'shed' ? 1 : 0, words: E.score(sn), wonBy: sn.G.teams[sn.G.over.win].name }); }""", k)
            sn3 = await pg.evaluate("localStorage.getItem(wSaveKey())")
            rt = await reload(k, resume=False, throw=True)
            check(rt['started'] is True and len(rt['settled']) <= 1 and (rt['live'] or len(rt['settled']) == 1),
                  f'{k}: a settle that fails at load leaves the load whole (nothing thrown out of it) and the match waiting, or settled once on a later try', rt)
            r3 = await reload(k, resume=False, save=sn3)
            st3 = await pg.evaluate("window.__settled")
            check(len(st3) == 1 and st3[0]['viaKept'] and st3[0]['loading'] is False, f'{k}: the decided match is settled once, by w159, after every part\'s load (not in the load\'s first world draw)', st3)
            r3b = await pg.evaluate("""k => { const E = __E[k], e = E.e(); const b = document.getElementById(E.res); if (b) b.click(); else if (E.live()) E.resume(); let i = 0; while (E.live() && i++ < 400) e.tick(0.05); return __st(k); }""", k)
            B0 = r3['before']
            check(c['over'] is not None and c['live'] and not B0['live'] and B0['games'] == c['g0'] + 1 and B0['wl'] == c['wl0'] + 1 and r3['n'] == c['n'] + c['settle'],
                  f'{k}: reloaded as the deciding result is on its way, the match is settled as the page comes back, before anything is pressed', [c, B0, r3['n']])
            check('Final' in B0['prompt'] and 'waiting' not in B0['prompt'] and not B0['later'], f'{k}: no match waiting and no Later for a decided match: its result card instead', B0['prompt'][:300])
            check(not r3b['live'] and r3b['games'] == c['g0'] + 1 and r3b['wl'] == c['wl0'] + 1, f'{k}: the decided match is settled once (a Resume after finds nothing to play)', [c['g0'], r3b])
            if c['win'] is not None:
                check(r3b['r'] == ('win' if c['win'] == 0 else 'lose'), f'{k}: the result recorded is the one the match ended with', [c['win'], r3b['r']])
            check(c['wonBy'] in c['words'] and 'to play' not in c['words'], f'{k}: a finished match\'s score says who won it', c['words'])
            await pg.evaluate(SKIP)
            await pg.evaluate("(() => { if (UI.view !== 'world') showView('world'); })()")

            # ---------- Play: once-a-game calls and mana spent at your aim ----------
            d = await pg.evaluate("""k => { const E = __E[k], e = E.e(); E.B().met = {}; E.start({ club: 'local', how: 'play' }); e.pause(true);
              const at = __aim(k, false), keep0 = E.keep(e.G), sp = at ? E.spend() : null; return Object.assign(__st(k), { at, sp, keep0 }); }""", k)
            r5 = await reload(k)
            check(d['at'] and d['sp']['c'] and (k == 'shed' or d['sp']['w'] is True) and d['keep'] != d['keep0'] and r5['live'] and r5['keep'] == d['keep'],
                  f'{k}: a reload at your aim gives back no call or power spent there' + (' (the word and a power)' if k != 'shed' else ' (a power)'), [d['sp'], d['keep0'], d['keep'], r5['keep']])
            await pg.evaluate("k => { if (__E[k].live()) __E[k].concede(); }", k)

            # ---------- Play: a full swing reloaded between its power and its mark ----------
            if k in ('links', 'lanes'):
                f = await pg.evaluate("""k => { const E = __E[k], e = E.e(); E.B().met = {}; E.start({ club: 'local', how: 'play' }); e.pause(true);
                  const at = __aim(k, true), n0 = E.n(e.G); e.press(); const lvl = M => k === 'links' ? M.p : M.v; let i = 0;
                  while (e.view.meter && e.view.meter.st === 'up' && lvl(e.view.meter) < 0.85 && i++ < 200) e.tick(0.02);
                  e.press(); const M = e.view.meter; for (let j = 0; j < 3; j++) e.tick(0.05);
                  return Object.assign(__st(k), { at, n0, st: e.view.meter && e.view.meter.st, pow: k === 'links' ? M.pow : M.p }); }""", k)
                r6 = await reload(k)
                sw = await pg.evaluate("k => { const v = __E[k].e().view; return k === 'links' ? { swung: v.swung } : { meter: v.meter }; }", k)
                if k == 'links': gone = sw['swung'] and sw['swung']['inside'] is False and abs(sw['swung']['pow'] - f['pow']) < 1e-9 and sw['swung']['err'] > 0
                else: gone = sw['meter'] and sw['meter']['st'] == 'gone' and sw['meter']['err'] <= -0.2 and abs(sw['meter']['p'] - f['pow']) < 1e-9
                check(f['at'] and f['ph'] == 'swing' and f['st'] == 'down' and f['n'] == f['n0'] and r6['live'] and r6['n'] == f['n0'] + 1 and r6['ph'] not in ('aim', 'swing') and gone,
                      f'{k}: a swing reloaded after its power press goes off on that power, late at the bottom of the meter, never taken again', [f, {x: r6[x] for x in ['n', 'ph', 'live']}, sw])
                await pg.evaluate("k => { if (__E[k].live()) __E[k].concede(); }", k)

        # ---------- curling: a stone of yours reloaded mid-slide ----------
        if 'shed' in engines:
            d = await pg.evaluate("""(() => { const E = __E.shed; E.B().met = {}; E.start({ club: 'local', how: 'play' }); wCR.pause(true);
            const throwMine = () => { wCR.press(); let n = 0; while (wCR.view.meter && wCR.view.meter.v < 1 && n++ < 2000) wCR.tick(.002); wCR.press(); };
            let guard = 0; while (wCR.G.n < 3 && guard++ < 40) { __to('shed', e => e.phase === 'aim' || e.G.n >= 3, 20000); if (wCR.phase === 'aim') { throwMine(); __to('shed', e => e.phase !== 'slide' && e.phase !== 'swing', 20000); } }
            __to('shed', e => e.phase === 'aim'); const n0 = wCR.G.n; throwMine(); for (let i = 0; i < 4; i++) wCR.tick(0.05);
            return Object.assign(__st('shed'), { n0 }); })()""")
            r4 = await reload('shed')
            check(d['ph'] == 'slide' and d['n'] == d['n0'] and r4['live'] and r4['n'] == d['n0'] + 1,
                  'curling: a stone of yours reloaded mid-slide comes to rest on the release you made; it is never thrown again', [d, r4])
            await pg.evaluate("(() => { if (__E.shed.live()) __E.shed.concede(); })()")

        errs = [e for e in errs if 'a settle that fails' not in e]   # (the settle the check makes fail, logged by wKeptOne as meant)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

def run(engines):
    asyncio.run(main(engines))
