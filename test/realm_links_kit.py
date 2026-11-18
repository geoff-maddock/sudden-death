# Realm links: gear and potions (issue #92, phase 7), by #61's conventions. Six pieces of golf gear (one a player): the
# Mossgate grocer's three, chests' three; gear reaches the engine through wLinksPlayer (ratings laid on, past the cap by
# W_GEAR_CFG.over at most; a Glove's focus and a Lucky Tee's power-shot mark as the engine's own), never the player's own
# ratings. Potions: the Stamina Draught (focus back), Still Water (no pressure on the next stroke), Moss Tonic (one
# player scrambles better this hole), Agatha's Oil (the next putt truer, the read longer); one a side a hole; yours from
# the Bag row in a real match only, out of your bag when given, with your caddie's advice; the CPU's caddie brings a bag
# by tier and gives at its skill, with a reason; your caddies never open your bag, and Simulate leaves it alone. The
# match card says what each club brings; How to play explains it.
# Asserts; exits nonzero on failure.
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
window.__to = (ph, n) => { let i = 0; while (wGL.phase !== ph && i++ < (n || 4000)) wGL.tick(0.05); return wGL.phase === ph; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['elf', 'spider', 'gorgon']; let i = 0; while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern')); wFourAuto(); })()")

        # ---------- the gear and where it comes from ----------
        g = await pg.evaluate("""(() => { const ids = Object.keys(W_LINKS_GEAR), shop = DB.shops.moss || {};
          return { n: ids.length, all: ids.every(id => W_GEAR[id] && W_GEAR[id].sport === 'links'), store: W_LINKS_KIT.store.every(id => shop[id] > 0),
            chests: ['gl_wedge', 'gl_putter', 'gl_glove'].every(id => Object.values(DB.chests).some(c => c.items && c.items[id])),
            pots: ['glstill', 'glmoss', 'gloil'].every(id => shop[id] > 0 && DB.items[id] && W_POTIONS[id]), draught: wPotionSports('draught').includes('links') }; })()""")
        check(g == {'n': 6, 'all': True, 'store': True, 'chests': True, 'pots': True, 'draught': True}, 'six pieces of golf gear (the grocer\'s three, chests\' three), and the potions for sale; the Stamina Draught serves the Links too', g)
        ge = await pg.evaluate("""(() => { const C = wFourSync(), id = C.four.putt, p = wPlayer(id), before = JSON.stringify(p.gl), put0 = wLinksPlayer(p).r.put;
          p.gear = Object.assign({}, p.gear, { links: 'gl_putter' }); const t = wLinksPlayer(p); const own = JSON.stringify(p.gl) === before;
          p.gl.put = wGL.cap; const capped = wLinksPlayer(p).r.put; p.gl = JSON.parse(before);
          p.gear.links = 'gl_glove'; const glove = wLinksPlayer(p); p.gear.links = 'gl_tee'; const tee = wLinksPlayer(p);
          wGL.start({ seed: 3, teams: [{ roster: [glove, wLinksPlayer(wPlayer(C.four.tee)), wLinksPlayer(wPlayer(C.four.approach)), wLinksPlayer(wPlayer(C.four.short))] }, { kinds: ['goblin', 'kobold', 'dwarf', 'troll'] }] });
          const gx = wGL.gxOf(0, 0); delete p.gear.links;
          return { put: [put0, t.r.put], tag: t.gear && t.gear.name, own, capped, cap: wGL.cap, gx, tee: tee.gear.fx.pshot }; })()""")
        check(ge['put'][1] == ge['put'][0] + 1 and ge['tag'] == 'Old Putter' and ge['own'], 'gear reaches the engine through wLinksPlayer (+1 putting from the Old Putter), never the player\'s own ratings', ge)
        check(ge['capped'] <= ge['cap'] + 2 and ge['gx'].get('focus') == 0.8 and ge['tee'] == 1.5, 'past the cap by two at most; a Glove\'s focus and a Lucky Tee\'s mark go to the engine as its own', ge)
        en = await pg.evaluate("""(() => { const r = { acc: .5 }, out = {};
          out.tee = [wGL.win(r, 1.05, 1), (() => { const W = wGL.meterRules; return 0; })()];
          // a Glove: a stroke costs a fifth less focus
          const shotCost = gx => { wGL.start({ seed: 4, teams: [{ roster: [{ n: 'A', kind: 'elf', gear: gx ? { name: 'g', fx: gx } : null }, { n: 'B', kind: 'elf' }, { n: 'C', kind: 'elf' }, { n: 'D', kind: 'elf' }], roles: { tee: 0, approach: 1, short: 2, putt: 3 } }, { kinds: ['elf', 'elf', 'elf', 'elf'] }] });
            const e = wGL.turn(); return e.side === 0 && e.ri === 0 ? +(1 - wGL.focus[0][0]).toFixed(3) : null; };
          out.cost = [shotCost(null), shotCost({ focus: .8 })];
          return out; })()""")
        check(en['cost'][0] is not None and abs(en['cost'][1] - en['cost'][0] * 0.8) < 1e-6, 'a Calfskin Glove: every stroke costs a fifth less focus', en)

        # ---------- potions in the engine ----------
        pe = await pg.evaluate("""(() => { const out = {}, G = wGL.start({ seed: 5, mode: 'play', teams: [{ kinds: ['ogre', 'elf', 'witch', 'spider'] }, { kinds: ['goblin', 'kobold', 'dwarf', 'troll'] }] }); __to('aim');
          G.focus[0][1] = .3; out.draught = [wGL.potion('draught', 1), +G.focus[0][1].toFixed(2), wGL.potionWhy('glstill', -1)];
          G.potHole[0] = -1; G.hole.done[1] = true; G.hole.st = [G.hole.st[0], G.hole.st[0] + 1]; out.still = [wGL.potion('glstill', -1), wGL.fxFor(0).nerve];
          G.potHole[0] = -1; G.ball[0].lie = 'S'; const s0 = G.teams[0].roster[0].r.scr; out.moss = wGL.potion('glmoss', 0); out.mossScr = [s0, wGL.G.moss[0]];
          return out; })()""")
        check(pe['draught'][0] == '' and pe['draught'][1] == 0.7 and pe['draught'][2] == 'One potion a hole.', 'a Stamina Draught gives a player two fifths of their focus back; one potion a hole', pe)
        check(pe['still'] == ['', 1] and pe['moss'] == '', 'Still Water takes the pressure off the next stroke; Moss Tonic is given for this hole', pe)
        oil = await pg.evaluate("""(() => { const G = wGL.start({ seed: 6, mode: 'play' }); __to('aim'); const H = wGL.course(0); G.ball[0] = { x: H.pin.x - 5, y: H.pin.y, lie: 'G' }; G.ball[1] = { x: H.tee.x, y: H.tee.y, lie: 'T' }; G.hole.st = [2, 0];
          wGL.setMode('watch'); wGL.setMode('play'); __to('aim'); const r0 = wGL.readLen(); const why = wGL.potion('gloil', -1); const fx = wGL.fxFor(0); return { why, putt: fx.putt, read: [r0, wGL.readLen()] }; })()""")
        check(oil['why'] == '' and oil['putt'] == 0.6 and oil['read'][1] > oil['read'][0] * 1.4, 'Agatha\'s Oil: the next putt truer, its read line half again as long', oil)
        cp = await pg.evaluate("""(() => { const G = wGL.start({ seed: 7, skill: [1, 1], bags: [null, { draught: 1, glstill: 1, gloil: 1 }] }); G.focus[1] = [.2, .3, .9, .9];
          const said = wGL.cpuPotion(1, 2), mine = wGL.cpuPotion(0, 0); return { said, mine, bag: wGL.bags[1], pots: wGL.pots }; })()""")
        check('Stamina Draught' in cp['said'] and cp['mine'] == '' and cp['bag'].get('draught') is None and cp['pots'][0]['why'], 'the CPU\'s caddie gives from its bag at its skill, with a reason; a null bag (yours) is never opened', cp)

        # ---------- your Bag in a real match ----------
        await pg.evaluate("WG.items = WG.items || {}; wAddItem('glstill', 1); wAddItem('draught', 2); WG.lkg = null")
        rb = await pg.evaluate("""(() => { const r = wStartLinks({ club: 'local', how: 'play' }); wGL.pause(true); __to('aim'); wLinksRows();
          const row = document.getElementById('wLinksRowBag'), btns = [...row.querySelectorAll('[data-lkuse]')].map(b => b.dataset.lkuse), theirs = wGL.bags[1], mine = wGL.bags[0];
          const G = wGL.G; G.focus[0][1] = .3; const sel = row.querySelector('[data-lkwho="draught"]'); if (sel) sel.value = '1';
          row.querySelector('[data-lkuse="draught"]').click(); const left = WG.items.draught, focus = +G.focus[0][1].toFixed(2), snap = WG.lkg.live.snap && WG.lkg.live.snap.G.focus[0][1];
          return { r, shown: !row.hidden, btns, theirs, mine, left, focus, snap }; })()""")
        check(rb['shown'] and 'glstill' in rb['btns'] and 'draught' in rb['btns'] and rb['mine'] is None and rb['theirs'] is not None, 'in a real match: the Bag row with your potions, and the other side\'s caddie has a bag by tier (yours is your own)', rb)
        check(rb['left'] == 1 and rb['focus'] == 0.7 and abs((rb['snap'] or 0) - 0.7) < 1e-6, 'given from the Bag, the potion comes out of your bag, and the match as saved has it', rb)
        rd = await pg.evaluate("""(() => { const n = WG.items.glstill || 0; wLeaveLinks(); WG.lkg = null; wLinksGame({ seed: 9, mode: 'play' }); wGL.pause(true); __to('aim'); wLinksRows(); const row = document.getElementById('wLinksRowBag');
          const why = wLinksPotion('glstill', -1); const msg = why; WG.lkg = null; wStartLinks({ club: 'local', how: 'sim' }); document.getElementById('modal').hidden = true; return { hidden: row.hidden, msg, still: WG.items.glstill === n }; })()""")
        check(rd['hidden'] and 'real matches' in rd['msg'] and rd['still'], 'a round has no Bag row and no potions; Simulate leaves your bag alone', rd)
        await pg.evaluate("wRunAct('lkcard')")
        await pg.wait_for_selector('#modalBox [data-lkclub]')
        card = await pg.evaluate("/What their caddies bring/.test(document.getElementById('modalBox').textContent)")
        check(card, 'the match card says what each club\'s caddie brings', card)
        await pg.evaluate("document.getElementById('modal').hidden = true; showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpLinksKit') || {}).textContent || ''; return ['Mossgate Driver', 'Calfskin Glove', 'Still Water', 'Moss Tonic', 'Oil', 'one potion a hole'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains golf\'s gear and potions', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
