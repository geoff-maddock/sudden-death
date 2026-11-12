# Realm court cup and fixtures (issue #77, phase 9). The Charter Net: Nim Hoopwright's NET topic opens it; entry costs
# the fee and draws a field of eight (you first, rivals and regional sides). Your quarter-final (Simulate) settles, and
# back in the world the rest of the round is played out on the court engine, with basketball scores; the semi-final is
# played on the court and the round catches up when you're back; a game level at the end goes to the rebounds; winning
# the final pays the prize (gold, fans, a pick of basketball cards, a piece of court gear), the journal and the Wall of
# Awards. Once a week; lose and the bracket is played to a champion. League fixtures at the Charter Court: your fixture
# there is a basketball game (Play, Manage or Simulate) that counts on the table, and the clubs' games there get real
# basketball scores. The Court tab's and the game card's buttons, How to play, the save, and a phone. Asserts; exits
# nonzero on failure. Screenshots: /tmp/realm-net-*.png.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox #wCourtOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 30 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox #wCourtOk, #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.bkcup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, games: D.games }; })()"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenNet === 'function'"); await pg.evaluate("wBK.speed = 8")  # the court at 8 steps a frame: the same game, sooner
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # Nim Hoopwright's topic, and the squad rule
        await pg.evaluate("(() => { const r = wSay('gk_court', 'net'); wRunAct(r.act, 'gk_court'); })()"); await pg.wait_for_selector('#modalBox #wNetEnter')
        off = await pg.evaluate("""(() => { const R = WG.roster; WG.roster = R.slice(0, 2); const why = wNetProblems().join(' '); WG.roster = R;
          return { card: !!document.getElementById('wNetEnter'), title: document.querySelector('#modalBox h3').textContent, why }; })()""")
        check(off['card'] and off['title'] == 'The Charter Net' and 'Recruit' in off['why'], 'Nim Hoopwright opens the Charter Net; without three players of your own you cannot enter', off)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf', 'goblin', 'dwarf']) if (wRoster().length < 6) wRecruit({ kind, lvl: 2 }, 'tavern'); RUN.gold = 500; })()")
        await pg.evaluate(CLOSE_ALL)

        # entry
        await pg.evaluate("wOpenNet()"); await pg.wait_for_selector('#modalBox #wNetEnter:not([disabled])')
        await pg.click('#wNetEnter'); await pg.wait_for_selector('#modalBox [data-nethow]')
        D = await pg.evaluate(CUP); f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f), 'entry: a field of eight, you first, rivals and regional sides', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')
        await pg.screenshot(path='/tmp/realm-net-entry.png')

        # quarter-final: simulate, forced to a win; the Final card, then the bracket
        await pg.evaluate("W_NET.force = 'win'")
        await pg.click('#modalBox [data-nethow="sim"]')
        await pg.wait_for_selector('#wCourtOk'); await pg.click('#wCourtOk')
        check(await pg.evaluate(UNTIL_BRACKET), 'after the Final card, the bracket shows')
        D = await pg.evaluate(CUP); qf = D['games'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and all(isinstance(g['ra'], int) and isinstance(g['rb'], int) and g['w'] in (g['a'], g['b']) for g in qf)
              and qf[0]['w'] == 'me', 'the quarter-final: yours settles, the rest are played out on the court with basketball scores', qf)
        check(all(g['ba'] > 0 and g['bb'] > 0 for g in qf), 'every game, yours too, carries both sides\' rebounds', qf)
        others = [g for g in qf[1:]]
        check(all((g['ra'] + g['rb']) % 1 == 0 and (g['ra'] != g['rb'] or g['w'] == (g['a'] if g['ba'] > g['bb'] else g['b']) or g['ba'] == g['bb']) for g in others),
              'a level game goes through on the rebounds', others)
        await pg.screenshot(path='/tmp/realm-net-bracket.png')

        # semi-final: on the field
        await pg.evaluate("W_NET.force = 'win'")
        await pg.click('#modalBox [data-nethow="manage"]')
        await pg.wait_for_function("UI.view === 'court' && wBK.live && WG.bkg.live && WG.bkg.live.world.kind === 'bkcup'", timeout=15000)
        tier = await pg.evaluate("WG.bkg.live.world.tier")
        check(tier == 2, 'the semi-final is tier 2 (a Knight)', tier)
        await pg.evaluate("(() => { const G = wBK.G; G.q = 4; G.clock = 1; G.score = [40, 0]; wBK.setMode('watch'); })()")
        await pg.wait_for_function("wBK.phase === 'over' && !WG.bkg.live", timeout=60000)
        await pg.click('#wCourtBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['games'][1]) == 2 and D['games'][1][0]['w'] == 'me', 'the semi-finals are in: on to the final', D['games'][1])
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.bkcup && s.WG.bkcup.round; })()")
        check(sv == 2, 'the cup is in the save', sv)

        # the final, won
        g0 = await pg.evaluate("RUN.gold")
        await pg.evaluate("(() => { window.__offers = []; const o = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return o.apply(this, arguments); }; })()")
        await pg.evaluate("W_NET.force = 'win'")
        await pg.click('#modalBox [data-nethow="sim"]')
        await pg.wait_for_selector('#wCourtOk'); await pg.click('#wCourtOk')
        await pg.evaluate(UNTIL_BRACKET)
        await pg.wait_for_function("WG.bkcup.done")
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.bkcupWins, journal: wJ().wins.map(w => w.t) })")
        check(D['champ'] == 'me' and won['wins'] == 1 and await pg.evaluate("RUN.gold") - g0 >= 150, 'win the final: the Charter Net, and its gold', [D['champ'], won])
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick, pool: (o.pool || []).length, basketball: (o.pool || []).every(id => CARDS[id].sport === 'basketball') }))")
        check(any(o['pick'] == 3 and o['pool'] >= 3 and o['basketball'] for o in offers), 'the prize includes a pick of 3 basketball cards', offers)
        check('Won the Charter Net' in won['journal'], 'it goes in the journal', won['journal'])
        gear = await pg.evaluate("W_COURT_KIT.cup.filter(id => (WG.items[id] || 0) > 0)")
        check(gear == ['bk_pads'], 'and a piece of court gear you did not have', gear)
        tb = await pg.evaluate("[wNetWinner('a', 'b', 30, 30, 9, 12), wNetWinner('a', 'b', 30, 30, 12, 9), wNetWinner('a', 'b', 31, 30, 0, 20)]")
        check(tb == ['b', 'a', 'a'], 'a game level at the end goes to the side with more rebounds; the score comes first', tb)
        mt = await pg.evaluate("""(() => { const keep = JSON.stringify(WG.bkcup); WG.bkcup = { week: 99, field: ['me', 'x'], round: 0, games: [[], [], []], pending: false, out: false, done: false };
          W_ON_END.bkcup('tie', { week: 99, round: 0 }, { club: 'x', us: 30, them: 30, reb: [12, 9] }); const won = WG.bkcup.games[0][0], out1 = WG.bkcup.out;
          WG.bkcup.games = [[], [], []]; W_ON_END.bkcup('tie', { week: 99, round: 0 }, { club: 'x', us: 30, them: 30, reb: [9, 12] }); const lost = WG.bkcup.games[0][0], out2 = WG.bkcup.out;
          WG.bkcup = JSON.parse(keep); return { won: [won.w, won.tb, out1], lost: [lost.w, lost.tb, out2] }; })()""")
        check(mt == {'won': ['me', True, False], 'lost': ['x', True, True]}, 'your own game, level at the end: through with more rebounds, out with fewer', mt)
        await pg.evaluate(CLOSE_ALL)
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-2).map(l => l[0]).join(' '); })()")
        check('Charter Net' in wall, 'and on the Wall of Awards', wall)
        check('once a week' in await pg.evaluate("wNetEnter()"), 'the next cup is next week')

        # a new week: lose, and the rest is played to a champion
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.bkg.met = {}")
        await pg.evaluate("wNetEnter(); W_NET.force = 'lose'; wNetPlay('sim')")
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.bkcup.done", timeout=30000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['games'][2]) == 1 and len(D['games'][1]) == 2, 'lose, and the rest of the bracket is played to a champion', D)
        await pg.evaluate(CLOSE_ALL)

        # ---------- league fixtures at the Charter Court ----------
        fx = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); f.g = 'g_court'; f.done = 0; wSave();
          wOpenGrdCard('g_court'); const hows = [...document.querySelectorAll('#modalBox [data-bkfixhow]')].map(b => b.dataset.bkfixhow);
          return { hows, club: f.a === 'me' ? f.b : f.a }; })()""")
        check(fx['hows'] == ['play', 'manage', 'sim'], 'your fixture at the Charter Court is a basketball game on the court: Play, Manage or Simulate', fx)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const L = wLeague(), me0 = L.me.w + L.me.l, n0 = L.results.length; const r = wBkfixPlay('sim'); const g = WG.bkg.games[0], F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me');
          return { r, res: g.r, club: g.club, rival: wIsRival(g.club), errs: (window.__sdErrs || []).slice(-3), done: !!f.done, top: L.results[0], me: L.me.w + L.me.l - me0, more: L.results.length - n0 }; })()""")
        ok_tie = r['res'] == 'tie' and r['done'] and r['me'] == 0
        top = r['top'] or {}
        ok_res = r['res'] != 'tie' and r['done'] and r['me'] == 1 and top.get('sport') == 'basketball' and top.get('g') == 'g_court' and isinstance(top.get('sa'), int)
        check(r['r'] == '' and (ok_tie or ok_res), 'Simulate the fixture: it counts once on the table, with the basketball score at the Charter Court (a tie, no points)', r)
        await pg.evaluate(CLOSE_ALL)
        c = await pg.evaluate("""(() => { const cl = wLeagueClubs(), L = wLeague(), a = cl[0], b = cl[1], w0 = L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l;
          let sims = 0; const sim0 = wBK.simGame; wBK.simGame = o => { sims++; return sim0(o); };
          wCourtOpp(a, 3); const mine = JSON.stringify(WG.bkg.opp[a]);
          const res = wSimAt(a, b, 'g_court'); wBK.simGame = sim0; res.sims = sims; res.kept = JSON.stringify(WG.bkg.opp[a]) === mine; return { res, played: L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l - w0 }; })()""")
        check(c['res']['sport'] == 'basketball' and c['res']['sa'] >= c['res']['sb'] and c['played'] == 2 and c['res']['sa'] % 1 == 0 and c['res']['sims'] == 1 and c['res']['kept'], 'the clubs\' fixtures at the Charter Court are played on the court engine, with basketball scores, and a rival\'s squad for its games against you is left alone', c)

        bt = await pg.evaluate("""(() => { wOpenCamp('court'); const tab = !!document.querySelector('#wCampBody [data-bknet]'); WCAMP.close();
          wOpenCourtCard(); const card = !!document.querySelector('#modalBox [data-bknet]'); return { tab, card }; })()""")
        check(bt['tab'] and bt['card'], 'the Court tab and the game card have a Charter Net button', bt)
        await pg.evaluate(CLOSE_ALL)
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpCourtNet'); return h ? h.textContent : ''; })()")
        check('Charter Net' in help_ and 'NET' in help_ and 'fixtures at the Charter Court' in help_, 'How to play explains the Charter Net and fixtures at the Court', help_)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        await pg.set_viewport_size({'width': 390, 'height': 800})
        await pg.evaluate("wOpenNet()"); await pg.wait_for_selector('#modalBox .wdcb')
        await pg.screenshot(path='/tmp/realm-net-phone.png')
        check(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), 'the bracket fits a phone')
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
