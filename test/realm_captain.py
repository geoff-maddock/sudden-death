# Realm captain (epic 2, phase 6): one starter wears the armband. While they start, their kind gives the team a
# bonus in every match (W_CAPTAIN, one per kind, run through hooks). A new journey names the first starter; the Team
# screen names another (only a starter); a benched captain gives nothing; releasing the captain hands the armband on;
# the pre-game card and the match log say so; the save keeps it; How to play explains it.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-captain-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
# start a wild match with the pre-game card, and return its text
PRE = """(() => { const L = DB.locs.find(l => l.map === 'graftonbury'); wEnterMap('world', L.x, L.y + 1); WG.min = 12 * 60; wWildMatch('plains');
  const e = document.querySelector('#modalBox .wcapt'); return e ? e.textContent : ''; })()"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_CAPTAIN !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- every kind has a bonus, and every bonus reads properly ----------
        kinds = await pg.evaluate("Object.keys(SIG).map(k => [k, !!W_CAPTAIN[k], W_CAPTAIN[k] && W_CAPTAIN[k].n, W_CAPTAIN[k] && W_CAPTAIN[k].d, W_CAPTAIN[k] && Object.keys(W_CAPTAIN[k].on)])")
        check(all(k[1] and k[2] and k[3] and k[4] for k in kinds), 'every kind that can join a team has a captain\'s bonus, with a name and words', [k for k in kinds if not k[1]])
        first = await pg.evaluate("({ cap: WG.captain, first: wStarters()[0].id })")
        check(first['cap'] == first['first'], 'a new journey makes the first starter captain', first)

        # ---------- the Team screen: the armband, and naming another ----------
        await pg.evaluate("wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); wOpenCamp()"); await pg.wait_for_timeout(300)
        ui = await pg.evaluate("[...document.querySelectorAll('#modalBox .wpr')].map(li => ({ pid: +li.dataset.pid, c: !!li.querySelector('.wcap'), btn: !!li.querySelector('[data-capt]') }))")
        check(ui[0]['c'] and not ui[0]['btn'] and ui[1]['btn'] and ui[2]['btn'] and not ui[3]['btn'] and sum(1 for u in ui if u['c']) == 1,
              'the captain wears the armband; the other starters have a Captain button, the bench does not', ui)
        await pg.screenshot(path='/tmp/realm-captain-team.png')
        await pg.click(f"li[data-pid='{ui[1]['pid']}'] [data-capt]")
        await pg.wait_for_timeout(200)
        now = await pg.evaluate("({ cap: WG.captain, log: WLOG.slice(-2).map(l => l[0]).join(' ') })")
        check(now['cap'] == ui[1]['pid'] and 'is your captain' in now['log'], 'the Captain button names a new captain', now)
        bench = await pg.evaluate(f"wSetCaptain({ui[3]['pid']})")
        check('bench' in bench, 'a bench player cannot be captain', bench)
        await pg.evaluate(CLOSE_ALL)

        # ---------- a dwarf captain: Shield Wall, 8 Block at kickoff ----------
        await pg.evaluate("(() => { const d = wRoster().find(p => p.kind === 'dwarf'); wSetOrder([d.id, ...wRoster().filter(p => p !== d).map(p => p.id)]); wSetCaptain(d.id); })()")
        pre = await pg.evaluate(PRE)
        check('Shield Wall' in pre and '8 Block' in pre, 'the pre-game card names the captain and their bonus', pre)
        await pg.screenshot(path='/tmp/realm-captain-pregame.png')
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        k = await pg.evaluate("({ blk: B.P.block, log: B.log.map(l => l.t || l[0] || String(l)).join(' | ') })")
        check(k['blk'] >= 8 and 'Shield Wall' in k['log'], 'at kickoff the team gets 8 Block, and the log says why', k)
        await pg.evaluate("(() => { B.over = 'lose'; B.forfeit = 1; finishFight(); })()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)

        # ---------- other bonuses, straight through the hooks ----------
        hooks = await pg.evaluate("""(() => {
          const out = {}, d = wRoster().find(p => p.kind === 'dwarf');
          const kick = kind => { d.kind = kind; RUN.pending = { world: { kind: 'wild', ref: null } }; startCombat([Object.keys(ENEMIES).find(id => !ENEMIES[id].boss && !ENEMIES[id].elite && !ENEMIES[id].ai.quarters)], 'normal', 'baseball'); return B; };
          let b = kick('lich'); out.lich = alive().every(e => sv(e, 'psn') >= 3);
          b = kick('werewolf'); out.werewolf = sv(B.P, 'str') >= 1;
          b = kick('harpy'); out.harpy = alive().every(e => sv(e, 'vuln') >= 1);
          b = kick('minotaur'); out.minotaur = alive().every(e => e.hp <= e.max - 4);
          const g0 = RUN.gold; d.kind = 'goblin'; fire('fightWon'); out.goblin = RUN.gold - g0;
          d.kind = 'dwarf'; RUN.pending = null; B = null; return out; })()""")
        check(hooks['lich'] and hooks['werewolf'] and hooks['harpy'] and hooks['minotaur'] and hooks['goblin'] == 6, 'each kind\'s bonus does what it says', hooks)

        # ---------- benched: nothing; released: the armband moves ----------
        bn = await pg.evaluate("""(() => { const d = wRoster().find(p => p.kind === 'dwarf'); wSetOrder([...wRoster().filter(p => p !== d).map(p => p.id), d.id]);
          return { cap: WG.captain === d.id, on: !!wCaptain() }; })()""")
        check(bn['cap'] and not bn['on'], 'a benched captain keeps the armband but gives nothing', bn)
        pre2 = await pg.evaluate(PRE)
        check('on the bench' in pre2, 'and the pre-game card says so', pre2)
        await pg.evaluate(CLOSE_ALL)
        rel = await pg.evaluate("(() => { const d = wRoster().find(p => p.kind === 'dwarf'); const why = wRelease(d.id); return { why, cap: WG.captain, first: wStarters()[0].id }; })()")
        check(rel['why'] == '' and rel['cap'] == rel['first'], 'releasing the captain hands the armband to the first starter', rel)

        # ---------- the save, How to play ----------
        cap = await pg.evaluate("(() => { wSetCaptain(wStarters()[2].id); wSave(); return WG.captain; })()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("WG.captain") == cap, 'the save keeps the captain')
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpCaptain'); return h ? h.textContent : ''; })()")
        check('captain' in help_ and 'Shield Wall' in help_, 'How to play explains the captain', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm captain passed')

asyncio.run(main())
