# Realm rink cup and fixtures (issue #83, phase 10). The Pond Kettle: Old Tove's KETTLE topic opens it; entry costs the
# fee and draws a field of eight (you first, rivals and regional sides). Your quarter-final (Simulate) settles, and back
# in the world the rest of the round is played out on the rink engine, with hockey scores and a winner every time (no
# game ends level); the semi-final is played on the ice and the round catches up when you're back; winning the final
# pays the prize (gold, fans, a pick of hockey cards, a piece of rink gear), the journal and the Wall of Awards. Once a
# week; lose and the bracket is played to a champion. League fixtures at the Pond Rink: your fixture there is a hockey
# game (Play, Manage or Simulate) that counts on the table, and the clubs' games there get real hockey scores. The Rink
# tab's and the game card's buttons, How to play, the save, the audit and a phone. Asserts; exits nonzero on failure.
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
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 30 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox #wRinkOk, #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.hkcup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, games: D.games }; })()"

async def main():
    if not os.environ.get('SD_BUILT'): subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenKettle === 'function'"); await pg.evaluate("wHK.speed = 8")  # the rink at 8 steps a frame: the same game, sooner
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # Old Tove's topic, and the squad rule
        await pg.evaluate("(() => { const r = wSay('gk_rink', 'kettle'); wRunAct(r.act, 'gk_rink'); })()"); await pg.wait_for_selector('#modalBox #wKettleEnter')
        off = await pg.evaluate("""(() => { const R = WG.roster; WG.roster = R.slice(0, 2); const why = wKettleProblems().join(' '); WG.roster = R;
          return { card: !!document.getElementById('wKettleEnter'), title: document.querySelector('#modalBox h3').textContent, why }; })()""")
        check(off['card'] and off['title'] == 'The Pond Kettle' and 'Recruit' in off['why'], 'Old Tove opens the Pond Kettle; without three players of your own you cannot enter', off)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf', 'goblin', 'dwarf', 'spider']) if (wRoster().length < 7) wRecruit({ kind, lvl: 2 }, 'tavern'); RUN.gold = 500; })()")
        await pg.evaluate(CLOSE_ALL)

        # entry
        await pg.evaluate("wOpenKettle()"); await pg.wait_for_selector('#modalBox #wKettleEnter:not([disabled])')
        await pg.click('#wKettleEnter'); await pg.wait_for_selector('#modalBox [data-kettlehow]')
        D = await pg.evaluate(CUP); f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f), 'entry: a field of eight, you first, rivals and regional sides', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')

        # quarter-final: simulate, forced to a win; the Final card, then the bracket
        await pg.evaluate("W_KETTLE.force = 'win'")
        await pg.click('#modalBox [data-kettlehow="sim"]')
        await pg.wait_for_selector('#wRinkOk'); await pg.click('#wRinkOk')
        check(await pg.evaluate(UNTIL_BRACKET), 'after the Final card, the bracket shows')
        D = await pg.evaluate(CUP); qf = D['games'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and all(isinstance(g['ra'], int) and isinstance(g['rb'], int) and g['w'] in (g['a'], g['b']) for g in qf)
              and qf[0]['w'] == 'me', 'the quarter-final: yours settles, the rest are played out on the ice with hockey scores', qf)
        others = qf[1:]
        check(all(g['ra'] != g['rb'] and g['w'] == (g['a'] if g['ra'] > g['rb'] else g['b']) and g['end'] in ('', 'ot', 'so') and g['ra'] + g['rb'] <= 20 for g in others), 'no game ends level: every one has a winner, by the score', others)
        await pg.screenshot(path='/tmp/realm-kettle-bracket.png')

        # semi-final: on the ice
        await pg.evaluate("W_KETTLE.force = 'win'")
        await pg.click('#modalBox [data-kettlehow="manage"]')
        await pg.wait_for_function("UI.view === 'rink' && wHK.live && WG.hkg.live && WG.hkg.live.world.kind === 'hkcup'", timeout=15000)
        tier = await pg.evaluate("WG.hkg.live.world.tier")
        check(tier == 2, 'the semi-final is tier 2 (a Knight)', tier)
        await pg.wait_for_function("wHK.phase === 'live'", timeout=30000)
        await pg.evaluate("(() => { const G = wHK.G; G.p = 3; G.clock = .5; G.score = [6, 0]; wHK.setMode('watch'); })()")
        await pg.wait_for_function("wHK.phase === 'over' && !WG.hkg.live", timeout=60000)
        await pg.click('#wRinkBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['games'][1]) == 2 and D['games'][1][0]['w'] == 'me', 'the semi-finals are in: on to the final', D['games'][1])
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.hkcup && s.WG.hkcup.round; })()")
        check(sv == 2, 'the cup is in the save', sv)

        # the final, won
        g0 = await pg.evaluate("RUN.gold")
        await pg.evaluate("(() => { window.__offers = []; const o = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return o.apply(this, arguments); }; })()")
        await pg.evaluate("W_KETTLE.force = 'win'")
        await pg.click('#modalBox [data-kettlehow="sim"]')
        await pg.wait_for_selector('#wRinkOk'); await pg.click('#wRinkOk')
        await pg.evaluate(UNTIL_BRACKET)
        await pg.wait_for_function("WG.hkcup.done")
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.hkcupWins, journal: wJ().wins.map(w => w.t) })")
        check(D['champ'] == 'me' and won['wins'] == 1 and await pg.evaluate("RUN.gold") - g0 >= 150, 'win the final: the Pond Kettle, and its gold', [D['champ'], won])
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick, pool: (o.pool || []).length, hockey: (o.pool || []).every(id => CARDS[id].sport === 'hockey') }))")
        check(any(o['pick'] == 3 and o['pool'] >= 3 and o['hockey'] for o in offers), 'the prize includes a pick of 3 hockey cards', offers)
        check('Won the Pond Kettle' in won['journal'], 'it goes in the journal', won['journal'])
        gear = await pg.evaluate("W_RINK_KIT.cup.filter(id => (WG.items[id] || 0) > 0)")
        check(gear == ['hk_mask'], 'and a piece of rink gear you did not have', gear)
        await pg.evaluate(CLOSE_ALL)
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-2).map(l => l[0]).join(' '); })()")
        check('kettle' in wall, 'and on the Wall of Awards', wall)
        check('once a week' in await pg.evaluate("wKettleEnter()"), 'the next cup is next week')

        # a new week: lose, and the rest is played to a champion
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.hkg.met = {}")
        await pg.evaluate("wKettleEnter(); W_KETTLE.force = 'lose'; wKettlePlay('sim')")
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.hkcup.done", timeout=30000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['games'][2]) == 1 and len(D['games'][1]) == 2, 'lose, and the rest of the bracket is played to a champion', D)
        await pg.evaluate(CLOSE_ALL)

        # ---------- league fixtures at the Pond Rink ----------
        fx = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); f.g = 'g_rink'; f.done = 0; wSave();
          wOpenGrdCard('g_rink'); const hows = [...document.querySelectorAll('#modalBox [data-hkfixhow]')].map(b => b.dataset.hkfixhow);
          return { hows, club: f.a === 'me' ? f.b : f.a, text: document.getElementById('modalBox').textContent.includes('Played on the ice with your six') }; })()""")
        check(fx['hows'] == ['play', 'manage', 'sim'] and fx['text'], 'your fixture at the Pond Rink is a hockey game on the ice: Play, Manage or Simulate', fx)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const L = wLeague(), me0 = L.me.w + L.me.l, n0 = L.results.length; const r = wHkfixPlay('sim'); const g = WG.hkg.games[0], F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me');
          return { r, res: g.r, club: g.club, rival: wIsRival(g.club), done: !!f.done, top: L.results[0], me: L.me.w + L.me.l - me0, more: L.results.length - n0 }; })()""")
        top = r['top'] or {}
        check(r['r'] == '' and r['res'] in ('win', 'lose') and r['done'] and r['me'] == 1 and top.get('sport') == 'hockey' and top.get('g') == 'g_rink' and isinstance(top.get('sa'), int) and top['sa'] != top['sb'],
              'Simulate the fixture: it counts once on the table, with the hockey score at the Pond Rink', r)
        await pg.evaluate(CLOSE_ALL)
        c = await pg.evaluate("""(() => { const cl = wLeagueClubs(), L = wLeague(), a = cl[0], b = cl[1], w0 = L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l;
          let sims = 0; const sim0 = wHK.simGame; wHK.simGame = o => { sims++; return sim0(o); };
          wRinkOpp(a, 3); const mine = JSON.stringify(WG.hkg.opp[a]);
          const res = wSimAt(a, b, 'g_rink'); wHK.simGame = sim0; res.sims = sims; res.kept = JSON.stringify(WG.hkg.opp[a]) === mine; const other = wSimAt(a, b, 'g_court'); return { res, other: other.sport, played: L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l - w0 }; })()""")
        check(c['res']['sport'] == 'hockey' and c['res']['sa'] > c['res']['sb'] and c['played'] == 4 and c['res']['sims'] == 1 and c['res']['kept'] and c['other'] == 'basketball',
              'the clubs\' fixtures at the Pond Rink are played on the rink engine, with hockey scores, and a rival\'s squad for its games against you is left alone; the Court\'s are still basketball', c)

        bt = await pg.evaluate("""(() => { wOpenCamp('rink'); const tab = !!document.querySelector('#wCampBody [data-hkkettle]'); WCAMP.close();
          wOpenRinkCard(); const card = !!document.querySelector('#modalBox [data-hkkettle]'); return { tab, card }; })()""")
        check(bt['tab'] and bt['card'], 'the Rink tab and the game card have a Pond Kettle button', bt)
        await pg.evaluate(CLOSE_ALL)
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpRinkKettle'); return h ? h.textContent : ''; })()")
        check('Pond Kettle' in help_ and 'KETTLE' in help_ and 'fixtures at the Pond Rink' in help_, 'How to play explains the Pond Kettle and fixtures at the Rink', help_)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        await pg.set_viewport_size({'width': 390, 'height': 800})
        await pg.evaluate("wOpenKettle()"); await pg.wait_for_selector('#modalBox .wdcb')
        await pg.screenshot(path='/tmp/realm-kettle-phone.png')
        check(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), 'the bracket fits a phone')
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
