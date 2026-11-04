# Realm ring cup and fixtures (issue #23, phase 6). The Anvil Belt: Ma Gristle's BELT topic opens it; entry costs the
# fee and draws a field of eight (you first, rivals and regional sides). Your quarter-final (Simulate, after the
# pairing) settles, and back in the world the rest of the round is boxed out on the engine, with bouts won; the
# semi-final is boxed in the ring (Manage) and the round catches up when you're back; a drawn card goes to the coin;
# winning the final pays the prize (gold, fans, a pick of boxing cards), the journal and the Wall of Awards. Once a
# week; lose and the bracket is boxed to a champion. League fixtures at the Anvil Ring: your fixture there is a card
# in the ring (Play, Manage or Simulate) that counts on the table, and the clubs' fixtures there get real results.
# How to play, the save, and a phone. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-bcup-*.png.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox #wRingOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 30 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox #wRingOk, #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.bcup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, cards: D.cards }; })()"
# the card in the ring boxed to its end on the engine's clock (iron chins, so no bout drags on a knockdown count)
BOX_OUT = """(() => { wBX.pause(true); let n = 0;
  while (WG.bxg.live && n++ < 40000) { if (wBX.wait) wBX.call(wBX.wait.plan); if (wBX.phase === 'over') { if (!wBX.cardNext()) break; WBX.over = null; continue; } for (const f of wBX.G.F) f.r.chin = 60; wBX.step(); }
  wBX.pause(false); return !WG.bxg.live; })()"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenBcup === 'function'"); await pg.evaluate("wBX.speed = 4")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # Ma Gristle's topic, and the fee
        await pg.evaluate("(() => { RUN.gold = 10; const r = wSay('gk_ring', 'belt'); wRunAct(r.act, 'gk_ring'); })()"); await pg.wait_for_selector('#modalBox #wBcupEnter')
        off = await pg.evaluate("({ off: document.getElementById('wBcupEnter').disabled, why: (document.querySelector('#modalBox .wbad') || {}).textContent || '' })")
        check(off['off'] and 'entry fee' in off['why'], 'Ma Gristle opens the Anvil Belt; without the fee you cannot enter', off)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf']) if (wRoster().length < 4) wRecruit({ kind, lvl: 2 }, 'tavern'); RUN.gold = 500; })()")
        await pg.evaluate(CLOSE_ALL)

        # entry
        await pg.evaluate("wOpenBcup()"); await pg.wait_for_selector('#modalBox #wBcupEnter:not([disabled])')
        await pg.click('#wBcupEnter'); await pg.wait_for_selector('#modalBox [data-bchow]')
        D = await pg.evaluate(CUP); f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f), 'entry: a field of eight, you first, rivals and regional sides', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')
        await pg.screenshot(path='/tmp/realm-bcup-entry.png')

        # quarter-final: the pairing, then Simulate, forced to a win; the result card, then the bracket
        await pg.evaluate("W_BCUP.force = 'win'")
        await pg.click('#modalBox [data-bchow="sim"]')
        await pg.wait_for_selector('[data-rgo="sim"]'); await pg.click('[data-rgo="sim"]')
        await pg.wait_for_selector('#wRingOk'); await pg.click('#wRingOk')
        check(await pg.evaluate(UNTIL_BRACKET), 'after the result card, the bracket shows')
        D = await pg.evaluate(CUP); qf = D['cards'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and qf[0]['w'] == 'me' and all(isinstance(g['ra'], int) and isinstance(g['rb'], int) and g['w'] in (g['a'], g['b']) for g in qf),
              'the quarter-final: yours settles, the rest are boxed out on the engine, with bouts won', qf)
        others = qf[1:]
        check(all(g['ra'] + g['rb'] <= 3 and (g['toss'] or g['w'] == (g['a'] if g['ra'] > g['rb'] else g['b']) or g['ra'] == g['rb']) for g in others),
              'the side that won more bouts goes through (level, it was settled on knockdowns, points or the coin)', others)
        await pg.screenshot(path='/tmp/realm-bcup-bracket.png')

        # semi-final: in the ring
        await pg.evaluate("W_BCUP.force = 'win'")
        await pg.click('#modalBox [data-bchow="manage"]')
        await pg.wait_for_selector('[data-rgo="manage"]'); await pg.click('[data-rgo="manage"]')
        await pg.wait_for_function("UI.view === 'ring' && WG.bxg.live && WG.bxg.live.world.kind === 'bcup'", timeout=15000)
        tier = await pg.evaluate("WG.bxg.live.world.tier")
        check(tier == 2, 'the semi-final is tier 2 (Knight)', tier)
        check(await pg.evaluate(BOX_OUT), 'the semi-final is boxed out in the ring')
        await pg.click('#wRingBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['cards'][1]) == 2 and D['cards'][1][0]['w'] == 'me', 'the semi-finals are in: on to the final', D['cards'][1])
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.bcup && s.WG.bcup.round; })()")
        check(sv == 2, 'the Belt is in the save', sv)

        # the final, won
        g0 = await pg.evaluate("RUN.gold")
        await pg.evaluate("(() => { window.__offers = []; const o = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return o.apply(this, arguments); }; })()")
        await pg.evaluate("W_BCUP.force = 'win'")
        await pg.click('#modalBox [data-bchow="sim"]')
        await pg.wait_for_selector('[data-rgo="sim"]'); await pg.click('[data-rgo="sim"]')
        await pg.wait_for_selector('#wRingOk'); await pg.click('#wRingOk')
        await pg.evaluate(UNTIL_BRACKET)
        await pg.wait_for_function("WG.bcup.done")
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.bcupWins, journal: wJ().wins.map(w => w.t) })")
        check(D['champ'] == 'me' and won['wins'] == 1 and await pg.evaluate("RUN.gold") - g0 >= 150, 'win the final: the Anvil Belt, and its gold', [D['champ'], won])
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick, pool: (o.pool || []).length, boxing: (o.pool || []).every(id => CARDS[id].sport === 'boxing') }))")
        check(any(o['pick'] == 3 and o['pool'] >= 3 and o['boxing'] for o in offers), 'the prize includes a pick of 3 boxing cards', offers)
        check('Won the Anvil Belt' in won['journal'], 'it goes in the journal', won['journal'])
        await pg.evaluate(CLOSE_ALL)
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-2).map(l => l[0]).join(' '); })()")
        check('Anvil Belt' in wall, 'and on the Wall of Awards', wall)
        check('once a week' in await pg.evaluate("wBcupEnter()"), 'the next Belt is next week')

        # a new week: lose, and the rest is boxed to a champion
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.bxg.met = {}")
        await pg.evaluate("wBcupEnter(); W_BCUP.force = 'lose'; wBcupPlay('sim')")
        await pg.wait_for_selector('[data-rgo="sim"]'); await pg.click('[data-rgo="sim"]')
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.bcup.done", timeout=30000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['cards'][2]) == 1 and len(D['cards'][1]) == 2, 'lose, and the rest of the bracket is boxed to a champion', D)
        await pg.evaluate(CLOSE_ALL)

        # ---------- league fixtures at the Anvil Ring ----------
        fx = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); f.g = 'g_ring'; f.done = 0; wSave();
          wOpenGrdCard('g_ring'); const hows = [...document.querySelectorAll('#modalBox [data-bfixhow]')].map(b => b.dataset.bfixhow);
          return { hows, club: f.a === 'me' ? f.b : f.a }; })()""")
        check(fx['hows'] == ['play', 'manage', 'sim'], 'your fixture at the Anvil Ring is a card in the ring: Play, Manage or Simulate', fx)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("WG.bxg.met = {}; window.__f0 = (() => { const L = wLeague(); return { me: L.me.w + L.me.l, n: L.results.length }; })(); wBfixPlay('sim')")
        await pg.wait_for_selector('[data-rgo="sim"]'); await pg.click('[data-rgo="sim"]')
        await pg.wait_for_selector('#wRingOk')
        r = await pg.evaluate("""(() => { const L = wLeague(), g = WG.bxg.cards[0], F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me');
          return { res: g.r, kind: g.how, done: !!f.done, top: L.results[0], me: L.me.w + L.me.l - __f0.me }; })()""")
        top = r['top'] or {}
        ok_tie = r['res'] == 'tie' and r['done'] and r['me'] == 0
        ok_res = r['res'] != 'tie' and r['done'] and r['me'] == 1 and top.get('sport') == 'boxing' and top.get('g') == 'g_ring' and isinstance(top.get('sa'), int)
        check(ok_tie or ok_res, 'Simulate the fixture: it counts once on the table, with the bouts won at the Anvil Ring (a drawn card, no points)', r)
        await pg.evaluate(CLOSE_ALL)
        pp = await pg.evaluate("""(() => { const L = wLeague(), F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'), club = f.a === 'me' ? f.b : f.a, me0 = L.me.w + L.me.l, n0 = L.results.length, d0 = f.done;
          W_ON_END.bfix('win', { g: 'g_ring', club, day: F.day - 7 }, { us: 2, them: 1 }); return { me: L.me.w + L.me.l - me0, results: L.results.length - n0, done: f.done === d0, log: WLOG.slice(-1)[0][0] }; })()""")
        check(pp['me'] == 0 and pp['results'] == 0 and pp['done'] and 'postponed' in pp['log'], 'a fixture card finished after its round day counts as a card, not on the table (and leaves the new round\'s fixture alone)', pp)
        c = await pg.evaluate("""(() => { const cl = wLeagueClubs(), L = wLeague(), a = cl[0], b = cl[1], w0 = L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l;
          const res = wSimAt(a, b, 'g_ring'); return { res, played: L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l - w0, live: WG.bxg.live }; })()""")
        check(c['res']['sport'] == 'boxing' and c['res']['sa'] >= c['res']['sb'] and c['res']['sa'] <= 3 and c['played'] == 2 and c['live'] is None,
              'the clubs\' fixtures at the Anvil Ring are boxed on the engine, with bouts won (and leave no card of yours behind)', c)

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpBcup'); return h ? h.textContent : ''; })()")
        check('Anvil Belt' in help_ and 'BELT' in help_ and 'fixture at the Anvil Ring' in help_, 'How to play explains the Anvil Belt and fixtures at the Ring', help_)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        await pg.set_viewport_size({'width': 390, 'height': 800})
        await pg.evaluate("wOpenBcup()"); await pg.wait_for_selector('#modalBox .wdcb')
        await pg.screenshot(path='/tmp/realm-bcup-phone.png')
        bf = await pg.evaluate("(() => { const b = document.getElementById('modalBox'); return { sw: b.scrollWidth, cw: b.clientWidth, doc: document.documentElement.scrollWidth <= window.innerWidth + 1 }; })()")
        check(bf['sw'] <= bf['cw'] + 1 and bf['doc'], 'the bracket fits a phone (nothing cut off inside its box)', bf)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
