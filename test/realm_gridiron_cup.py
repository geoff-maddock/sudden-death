# Realm gridiron cup and fixtures (issue #9, phase 7). The Cinder Cup: Clinker Dunn's CINDER topic opens it; entry
# costs the fee and draws a field of eight (you first, rivals and regional sides). Your quarter-final (Simulate)
# settles, and back in the world the rest of the round is played out on the gridiron engine, with football scores; the
# semi-final is played on the field and the round catches up when you're back; a tie after Sudden Death goes to the
# yards; winning the final pays the prize (gold, fans, a pick of football cards), the journal and the Wall of Awards.
# Once a week; lose and the bracket is played to a champion. League fixtures at the Ash Bowl: your fixture there is a
# gridiron game (Play, Manage or Simulate) that counts on the table, and the clubs' games there get real football
# scores. How to play, the save, and a phone. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-gcup-*.png.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox #wGridOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 30 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox #wGridOk, #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.gcup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, games: D.games }; })()"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenGcup === 'function'"); await pg.evaluate("wGF.speed = 4")  # the field at 4 steps a frame: the same game, sooner
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # Clinker Dunn's topic, and the squad rule
        await pg.evaluate("(() => { const r = wSay('gk_bowl', 'cinder'); wRunAct(r.act, 'gk_bowl'); })()"); await pg.wait_for_selector('#modalBox #wGcupEnter')
        off = await pg.evaluate("({ off: document.getElementById('wGcupEnter').disabled, why: (document.querySelector('#modalBox .wbad') || {}).textContent || '' })")
        check(off['off'] and 'Recruit' in off['why'], 'Clinker Dunn opens the Cinder Cup; without five players you cannot enter', off)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf', 'goblin', 'dwarf']) if (wRoster().length < 6) wRecruit({ kind, lvl: 2 }, 'tavern'); RUN.gold = 500; })()")
        await pg.evaluate(CLOSE_ALL)

        # entry
        await pg.evaluate("wOpenGcup()"); await pg.wait_for_selector('#modalBox #wGcupEnter:not([disabled])')
        await pg.click('#wGcupEnter'); await pg.wait_for_selector('#modalBox [data-gchow]')
        D = await pg.evaluate(CUP); f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f), 'entry: a field of eight, you first, rivals and regional sides', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')
        await pg.screenshot(path='/tmp/realm-gcup-entry.png')

        # quarter-final: simulate, forced to a win; the Final card, then the bracket
        await pg.evaluate("W_GCUP.force = 'win'")
        await pg.click('#modalBox [data-gchow="sim"]')
        await pg.wait_for_selector('#wGridOk'); await pg.click('#wGridOk')
        check(await pg.evaluate(UNTIL_BRACKET), 'after the Final card, the bracket shows')
        D = await pg.evaluate(CUP); qf = D['games'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and all(isinstance(g['ra'], int) and isinstance(g['rb'], int) and g['w'] in (g['a'], g['b']) for g in qf)
              and qf[0]['w'] == 'me', 'the quarter-final: yours settles, the rest are played out on the gridiron with football scores', qf)
        others = [g for g in qf[1:]]
        check(all((g['ra'] + g['rb']) % 1 == 0 and (g['ra'] != g['rb'] or g['w'] == (g['a'] if g['ya'] > g['yb'] else g['b']) or g['ya'] == g['yb']) for g in others),
              'a tie goes through on the yards', others)
        await pg.screenshot(path='/tmp/realm-gcup-bracket.png')

        # semi-final: on the field
        await pg.evaluate("W_GCUP.force = 'win'")
        await pg.click('#modalBox [data-gchow="manage"]')
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.isGame && WG.gfg.live && WG.gfg.live.world.kind === 'gcup'", timeout=15000)
        tier = await pg.evaluate("WG.gfg.live.world.tier")
        check(tier == 2, 'the semi-final is tier 2 (Knight)', tier)
        await pg.wait_for_function("wGF.phase === 'call'", timeout=30000)
        await pg.evaluate("(() => { const G = wGF.G; G.half = 2; G.clock = 1; G.score = [28, 0]; wGF.setMode('watch'); })()")
        await pg.wait_for_function("wGF.phase === 'over' && !WG.gfg.live", timeout=60000)
        await pg.click('#wGridBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['games'][1]) == 2 and D['games'][1][0]['w'] == 'me', 'the semi-finals are in: on to the final', D['games'][1])
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.gcup && s.WG.gcup.round; })()")
        check(sv == 2, 'the cup is in the save', sv)

        # the final, won
        g0 = await pg.evaluate("RUN.gold")
        await pg.evaluate("(() => { window.__offers = []; const o = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return o.apply(this, arguments); }; })()")
        await pg.evaluate("W_GCUP.force = 'win'")
        await pg.click('#modalBox [data-gchow="sim"]')
        await pg.wait_for_selector('#wGridOk'); await pg.click('#wGridOk')
        await pg.evaluate(UNTIL_BRACKET)
        await pg.wait_for_function("WG.gcup.done")
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.gcupWins, journal: wJ().wins.map(w => w.t) })")
        check(D['champ'] == 'me' and won['wins'] == 1 and await pg.evaluate("RUN.gold") - g0 >= 150, 'win the final: the Cinder Cup, and its gold', [D['champ'], won])
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick, pool: (o.pool || []).length, football: (o.pool || []).every(id => CARDS[id].sport === 'football') }))")
        check(any(o['pick'] == 3 and o['pool'] >= 3 and o['football'] for o in offers), 'the prize includes a pick of 3 football cards', offers)
        check('Won the Cinder Cup' in won['journal'], 'it goes in the journal', won['journal'])
        await pg.evaluate(CLOSE_ALL)
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-2).map(l => l[0]).join(' '); })()")
        check('Cinder Cup' in wall, 'and on the Wall of Awards', wall)
        check('once a week' in await pg.evaluate("wGcupEnter()"), 'the next cup is next week')

        # a new week: lose, and the rest is played to a champion
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.gfg.met = {}")
        await pg.evaluate("wGcupEnter(); W_GCUP.force = 'lose'; wGcupPlay('sim')")
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.gcup.done", timeout=30000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['games'][2]) == 1 and len(D['games'][1]) == 2, 'lose, and the rest of the bracket is played to a champion', D)
        await pg.evaluate(CLOSE_ALL)

        # ---------- league fixtures at the Ash Bowl ----------
        fx = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); f.g = 'g_bowl'; f.done = 0; wSave();
          wOpenGrdCard('g_bowl'); const hows = [...document.querySelectorAll('#modalBox [data-gfixhow]')].map(b => b.dataset.gfixhow);
          return { hows, club: f.a === 'me' ? f.b : f.a }; })()""")
        check(fx['hows'] == ['play', 'manage', 'sim'], 'your fixture at the Ash Bowl is a gridiron game: Play, Manage or Simulate', fx)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const L = wLeague(), me0 = L.me.w + L.me.l, n0 = L.results.length; const r = wGfixPlay('sim'); const g = WG.gfg.games[0], F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me');
          return { r, res: g.r, club: g.club, rival: wIsRival(g.club), errs: (window.__sdErrs || []).slice(-3), done: !!f.done, top: L.results[0], me: L.me.w + L.me.l - me0, more: L.results.length - n0 }; })()""")
        ok_tie = r['res'] == 'tie' and r['done'] and r['me'] == 0
        top = r['top'] or {}
        ok_res = r['res'] != 'tie' and r['done'] and r['me'] == 1 and top.get('sport') == 'football' and top.get('g') == 'g_bowl' and isinstance(top.get('sa'), int)
        check(r['r'] == '' and (ok_tie or ok_res), 'Simulate the fixture: it counts once on the table, with the football score at the Ash Bowl (a tie, no points)', r)
        await pg.evaluate(CLOSE_ALL)
        c = await pg.evaluate("""(() => { const cl = wLeagueClubs(), L = wLeague(), a = cl[0], b = cl[1], w0 = L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l;
          const res = wSimAt(a, b, 'g_bowl'); return { res, played: L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l - w0 }; })()""")
        check(c['res']['sport'] == 'football' and c['res']['sa'] >= c['res']['sb'] and c['played'] == 2 and c['res']['sa'] % 1 == 0, 'the clubs\' fixtures at the Ash Bowl are played on the gridiron, with football scores', c)

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpGcup'); return h ? h.textContent : ''; })()")
        check('Cinder Cup' in help_ and 'CINDER' in help_ and 'fixtures at the Ash Bowl' in help_, 'How to play explains the Cinder Cup and fixtures at the Bowl', help_)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        await pg.set_viewport_size({'width': 390, 'height': 800})
        await pg.evaluate("wOpenGcup()"); await pg.wait_for_selector('#modalBox .wdcb')
        await pg.screenshot(path='/tmp/realm-gcup-phone.png')
        check(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), 'the bracket fits a phone')
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
