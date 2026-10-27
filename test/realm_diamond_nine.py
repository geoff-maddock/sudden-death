# Realm baseball nine (issue #4, phase 3): a new journey has a nine: nine positions, each held once, the three
# founders in it (at their own position when free), call-ups at the team's level for the rest, a pitcher with pitches;
# as a Brimstone Diamond team it is nine players with the pitcher's pitches, out of position fielding 2 worse. A new
# player takes a call-up's place (a pitcher takes the mound); a released one leaves a gap a call-up fills; call-ups
# keep up with the team's level. Only a player with pitches can pitch; positions swap; the batting order moves; a
# player can sit out and come back. The nine saves. The Nine tab on the Team screen shows and changes it, and Watch
# them play puts it on the diamond to a final. How to play explains it; the tab fits a phone.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-nine-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

POS9 = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P']
NINE = """(() => { const N = wNineSync(); return { order: N.order.map(r => { const p = wNineWho(r.id); return { id: r.id, pos: r.pos, kind: p.kind, n: p.n, lvl: p.lvl,
  own: wBdOf(p).pos, cu: typeof r.id === 'string', pitches: !!(wBdOf(p).pitches || []).length }; }), cu: N.cu.length, tier: wNineTier(), probs: wNineProblems(),
  roster: WG.roster.map(p => p.id) }; })()"""

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wNineSync === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

def valid(n):
    return sorted(r['pos'] for r in n['order']) == sorted(POS9) and len(n['order']) == 9 and not n['probs']

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await boot(pg); await new_journey(pg)

        # ---------- a new journey's nine ----------
        n = await pg.evaluate(NINE)
        check(valid(n), 'a new journey has a nine: nine positions, each held once, nothing in the way', n)
        ids = [r['id'] for r in n['order']]
        check(all(i in ids for i in n['roster']) and n['cu'] == 9 - len(n['roster']), 'every founder plays; call-ups fill the rest', n)
        own = {}
        for r in n['order']:
            if not r['cu']: own.setdefault(r['own'], []).append(r)
        check(all(any(r['pos'] == pos for r in rs) for pos, rs in own.items() if pos != 'P'), 'founders play their own position when it is free', n['order'])
        P = next(r for r in n['order'] if r['pos'] == 'P')
        check(P['pitches'], 'the pitcher has pitches', P)
        check(all(r['lvl'] == n['tier'] for r in n['order'] if r['cu']) and n['order'][-1]['pos'] == 'P', 'call-ups are at the team\'s level; the pitcher bats last', n)

        d = await pg.evaluate("""(() => { const d = wNineDef(), N = WG.nine; return { name: d.name, n: d.roster.length, pos: d.roster.map(p => p.pos), names: d.roster.map(p => p.n),
          want: N.order.map(r => wNineWho(r.id).n), P: (d.roster.find(p => p.pos === 'P') || {}).pitches, keys: d.roster.every(p => p.race && p.hand && p.kind && p.tiers && ['pow','con','spd','arm','fld'].every(s => p[s] >= 1 && p[s] <= 12)),
          json: JSON.stringify(d).length > 0, team: wPartyTeam().name }; })()""")
        check(d['n'] == 9 and d['pos'] == [r['pos'] for r in n['order']] and d['names'] == d['want'] and d['P'] and d['keys'] and d['name'] == d['team'],
              'as a Brimstone Diamond team: the nine in batting order, with the pitcher\'s pitches', d)

        # ---------- out of position ----------
        off = await pg.evaluate("""(() => { const N = wNineSync(), a = N.order.find(r => r.pos !== 'P' && typeof r.id !== 'string'), b = N.order.find(r => r.pos !== 'P' && r !== a);
          const pa = wNineWho(a.id), f0 = wBdOf(pa).fld, msg = wNineSetPos(a.id, b.pos), d = wNineDef(), g = d.roster.find(x => x.rid === a.id);
          return { msg, now: a.pos, other: b.pos, fld: g.fld, f0, own: wBdOf(pa).pos, swapped: N.order.filter(r => r.pos === a.pos).length === 1 && b.pos !== a.pos }; })()""")
        check(off['msg'] == '' and off['swapped'] and (off['now'] == off['own'] or off['fld'] == max(1, off['f0'] - 2)), 'positions swap; out of position a player fields 2 worse', off)
        nopitch = await pg.evaluate("""(() => { const N = wNineSync(), a = N.order.find(r => r.pos !== 'P' && !(wBdOf(wNineWho(r.id)).pitches || []).length); return { msg: wNineSetPos(a.id, 'P'), pos: a.pos }; })()""")
        check('no pitches' in nopitch['msg'] and nopitch['pos'] != 'P', 'only a player with pitches can pitch', nopitch)

        # ---------- the batting order ----------
        mv = await pg.evaluate("""(() => { const N = wNineSync(), id = N.order[3].id; wNineMove(id, 0); return N.order[0].id === id && N.order.length === 9; })()""")
        check(mv, 'the batting order moves')

        # ---------- new players, released players ----------
        add = await pg.evaluate("""(() => { const cu0 = WG.nine.cu.length; const p = wAddPlayer(wMakePlayer({ kind: 'elf', lvl: 1 }, 'tavern')); const N = wNineSync();
          const r = N.order.find(x => x.id === p.id); return { inNine: !!r, pos: r && r.pos, own: wBdOf(p).pos, cu: N.cu.length, cu0 }; })()""")
        check(add['inNine'] and add['cu'] == add['cu0'] - 1, 'a new player takes a call-up\'s place', add)
        kob = await pg.evaluate("""(() => { const p = wAddPlayer(wMakePlayer({ kind: 'kobold', lvl: 1 }, 'tavern')); const N = wNineSync(); const r = N.order.find(x => x.id === p.id);
          return { pos: r && r.pos, pen: wNineDef().pen.length }; })()""")
        check(kob['pos'] == 'P', 'a pitcher who joins takes the mound from the called-up pitcher', kob)
        rel = await pg.evaluate("""(() => { const p = WG.roster.find(q => q.kind === 'elf'); wRelease(p.id); const N = wNineSync();
          return { gone: !N.order.some(r => r.id === p.id), n: N.order.length, ok: !wNineProblems().length }; })()""")
        check(rel['gone'] and rel['n'] == 9 and rel['ok'], 'a released player leaves a gap a call-up fills', rel)
        up = await pg.evaluate("""(() => { for (const p of WG.roster) wGiveXp(p, 3000); const N = wNineSync(); return { tier: wNineTier(), lv: N.cu.map(c => c.lvl), bd: N.cu.map(c => c.bd.lv) }; })()""")
        check(up['tier'] > 1 and all(l == up['tier'] for l in up['lv']) and up['lv'] == up['bd'], 'call-ups keep up with the team\'s level', up)

        # ---------- sitting out ----------
        sit = await pg.evaluate("""(() => { const N = wNineSync(), r = N.order.find(x => typeof x.id !== 'string' && x.pos !== 'P'), pid = r.id, pos = r.pos;
          const m1 = wNineSit(pid), out = !N.order.some(x => x.id === pid), cid = r.id; const m2 = wNinePutIn(pid, cid);
          return { m1, out, back: r.id === pid && r.pos === pos, m2, cuGone: !N.cu.some(c => c.cid === cid) }; })()""")
        check(sit['out'] and 'sits out' in sit['m1'] and sit['back'] and sit['m2'] == '' and sit['cuGone'], 'a player can sit out for a call-up, and come back', sit)

        # ---------- saving ----------
        before = await pg.evaluate("wSave(), JSON.stringify(WG.nine)")
        await pg.reload(); await pg.wait_for_function("typeof wNineSync === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bResume'); await pg.wait_for_function("UI.view === 'world' && !!WG")
        after = await pg.evaluate("JSON.stringify(wNineSync())")
        check(after == before, 'the nine saves')

        # ---------- the Nine tab ----------
        await pg.evaluate("wOpenCamp('nine')"); await pg.wait_for_selector('#modalBox .wnine')
        ui = await pg.evaluate("""(() => { const b = document.getElementById('modalBox'); return { rows: b.querySelectorAll('.wnr').length, sel: b.querySelectorAll('.wnr select').length,
          tab: b.querySelector('[data-ctab="nine"]').getAttribute('aria-selected'), cu: b.querySelectorAll('.wnr.wcu').length, watch: !b.querySelector('[data-nwatch]').disabled }; })()""")
        check(ui['rows'] == 9 and ui['sel'] == 9 and ui['tab'] == 'true' and ui['cu'] >= 1 and ui['watch'], 'the Nine tab shows the nine: nine rows, a position each, call-ups marked', ui)
        await pg.screenshot(path='/tmp/realm-nine-desk.png')
        first = await pg.evaluate("WG.nine.order[1].id")
        await pg.click('#modalBox .wnr:nth-child(2) [data-nup]')
        check(await pg.evaluate("WG.nine.order[0].id") == first, 'its arrows move a player up the order')
        sw = await pg.evaluate("""(() => { const r = WG.nine.order.find(x => x.pos === 'C'), o = WG.nine.order.find(x => x.pos === 'SS'); return [r.id, o.id]; })()""")
        await pg.select_option(f'#modalBox [data-nid="{sw[0]}"] [data-npos]', 'SS')
        now = await pg.evaluate(f"""(() => {{ const f = id => WG.nine.order.find(x => String(x.id) === String(id)).pos; return [f({json.dumps(sw[0])}), f({json.dumps(sw[1])})]; }})()""")
        check(now == ['SS', 'C'], 'its position menu swaps two players', now)
        dis = await pg.evaluate("[...document.querySelectorAll('#modalBox .wnr')].filter(li => li.querySelector('option[value=\"P\"]').disabled).length")
        check(dis >= 7, 'the mound is greyed out for players without pitches', dis)
        await pg.click('#modalBox [data-nwatch]')
        await pg.wait_for_function("UI.view === 'diamond' && wBD.G.phase !== 'menu'")
        g = await pg.evaluate("({ name: wBD.G.teams[0].def.name, names: wBD.G.teams[0].def.roster.map(p => p.n), want: WG.nine.order.map(r => wNineWho(r.id).n), team: wPartyTeam().name })")
        check(g['name'] == g['team'] and g['names'] == g['want'], 'Watch them play puts your nine on the diamond', g)
        await pg.evaluate("wBD.simToEnd(true)"); await pg.wait_for_function("!!WD && !!WD.over")
        await pg.click('#wDiamondBack'); await pg.wait_for_function("UI.view === 'world'")
        check(True, 'and it plays to a final, then back to the world')

        # ---------- How to play, a phone ----------
        await pg.evaluate("showPage('help')")
        h = await pg.evaluate("(() => { const a = document.getElementById('wHelpBaseball'), b = document.getElementById('wHelpNine'); return !!b && a.nextElementSibling === b && /call/.test(b.textContent); })()")
        check(h, 'How to play explains the nine, after the ratings')
        await pg.evaluate("showPage('play')")
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(200)
        await pg.evaluate("wOpenCamp('nine')"); await pg.wait_for_selector('#modalBox .wnine')
        fit = await pg.evaluate("(() => { const b = document.getElementById('modalBox'), r = b.getBoundingClientRect(); return { right: r.right, vw: innerWidth, sw: b.scrollWidth, cw: b.clientWidth, rows: [...b.querySelectorAll('.wnr')].every(li => li.scrollWidth <= li.clientWidth + 1) }; })()")
        check(fit['right'] <= fit['vw'] + 1 and fit['sw'] <= fit['cw'] + 1 and fit['rows'], 'the Nine tab fits a phone', fit)
        await pg.screenshot(path='/tmp/realm-nine-phone.png', full_page=True)

        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm diamond nine passed')

asyncio.run(main())
