# Realm court, gear and potions (issue #77, phase 7). Five pieces of court gear (items, one slot a player: Court Shoes,
# Wrist Bands and Lucky Socks in the Graftonbury store, Knee Pads and Ankle Braces in chests); a player wears one, it
# reaches the engine (its effects on the player) without changing their own ratings, and it can't be changed during a
# game. Nerve at the line in a close finish. Potions at a stoppage, one a side a stoppage: the Stamina Draught (shared
# with football and boxing), Second Wind (at a timeout only), the Hot Hand Elixir, Steady Drops (no nerve for the
# half). The CPU's bench brings its bag by tier and gives at its skill, with a reason in the line; your bench's advice.
# In the Realm: a real game's Bag under the court gives from your bag (one comes out), Simulate leaves your bag alone,
# their bag is in the game, the card says what each club brings, and How to play explains it. Asserts; exits nonzero on
# failure. Screenshot: /tmp/realm-court-kit.png.
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

T = "[{ name: 'A', kinds: ['goblin', 'elf', 'werewolf', 'minotaur', 'troll', 'kobold', 'zombie'] }, { name: 'B', kinds: ['kobold', 'vampire', 'gorgon', 'spider', 'golem', 'harpy', 'skeleton'] }]"
# a game stopped at a dead ball (powers off, so nothing else moves stamina), side 0 yours in Manage
DEAD = f"""(seed, skill, bags) => {{ wBK.start({{ teams: {T}, seed: seed || 5, skill: skill || [0, 0], mode: 'manage', powers: false, bags }}); let n = 0;
  while (wBK.phase !== 'dead' && n++ < 30 * 300) wBK.step(); return wBK.G; }}"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1100})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBK !== 'undefined'")
        await pg.evaluate(f"window.__dead = {DEAD}; 0")

        # ---------- the pieces and where they are ----------
        gp = await pg.evaluate("""(() => { const ids = Object.keys(W_COURT_GEAR); return { gear: ids.map(id => [id, W_GEAR[id].sport, !!DB.items[id] && DB.items[id].gear === 'court']),
          store: W_COURT_KIT.store.every(id => DB.shops.hq[id]), pots: ['bkhot', 'bksteady'].every(id => DB.shops.hq[id] && DB.items[id]) && !!DB.shops.hq.secondwind && W_POTIONS.secondwind.sports.includes('court') && Object.values(DB.items).filter(i => i.name === 'Second Wind').length === 1, draught: W_POTIONS.draught.sports,
          chests: [['hatchery_prize', 'bk_pads'], ['deepseam_prize', 'bk_braces']].every(([c, it]) => DB.chests[c].items[it] > 0), sports: W_GEAR_CFG.sports.court }; })()""")
        check(len(gp['gear']) == 5 and all(g[1] == 'court' and g[2] for g in gp['gear']) and gp['store'] and gp['pots'] and gp['chests'] and 'court' in gp['draught'] and gp['sports'] == 'basketball',
              'five pieces of court gear (items), the store\'s three and the potions in Graftonbury, two in chests; the Stamina Draught and Second Wind (one item each) serve the court too', gp)

        # ---------- nerve and potions in the engine ----------
        nv = await pg.evaluate("""(() => { const G = __dead(); const early = wBK.nerve(0); G.q = 4; G.clock = 40; G.score = [20, 18]; const late = wBK.nerve(0); G.score = [30, 18]; const blowout = wBK.nerve(0); G.score = [20, 18];
          const r = wBK.potion('bksteady', -1); const steady = wBK.nerve(0), again = wBK.potionWhy('draught', G.on[0][0]); return { early, late, blowout, r, steady, again }; })()""")
        check(nv['early'] == 0 and nv['late'] > .05 and nv['blowout'] == 0, 'nerve: free throws are harder in the last minute of a close game, not before, not in a blowout', nv)
        check(nv['r'] == '' and nv['steady'] == 0 and 'One potion' in nv['again'], 'Steady Drops take the nerve away; one potion a side a stoppage', nv)
        pt = await pg.evaluate("""(() => { let G = __dead(6); const ri = G.on[0][1]; G.stam[0][ri] = 30; const d = wBK.potion('draught', ri), st = G.stam[0][ri];
          G = __dead(7); const w = wBK.potionWhy('secondwind', -1); const i = G.on[0][2]; const h = wBK.potion('bkhot', i), fire = G.hot[0][i];
          const live = (() => { let n = 0; while (wBK.phase !== 'live' && n++ < 400) wBK.step(); return wBK.potionWhy('draught', G.on[0][0]); })();
          return { d, st, w, h, fire, live, pots: wBK.pots().map(p => p.id) }; })()""")
        check(pt['d'] == '' and pt['st'] == 70 and pt['h'] == '' and pt['fire'] >= 3, 'the Stamina Draught gives 40 stamina back; the Hot Hand Elixir starts a player on fire', pt)
        check('timeout' in pt['w'] and 'stoppage' in pt['live'] and pt['pots'] == ['bkhot'], 'Second Wind only at a timeout; no potion in live play; each given is recorded', pt)
        tw = await pg.evaluate("""(() => { const G = __dead(8); let n = 0; const r = wBK.timeout(G.poss); const on = G.on[0].map(ri => (G.stam[0][ri] = 40, ri)); const w = wBK.potion('secondwind', -1); return { r, w, ph: wBK.phase, st: G.on[0].map(ri => G.stam[0][ri]) }; })()""")
        check(tw['w'] == '' and tw['ph'] == 'timeout' and all(s == 60 for s in tw['st']), 'at a timeout Second Wind gives the whole five 20 stamina back', tw)
        # one potion a stoppage, a timeout in it included; Steady Drops only from the second half; an old save point resumes
        os = await pg.evaluate("""(() => { let G = __dead(10); const a = wBK.potion('draught', G.on[0][0]); G.stam[0][G.on[0][0]] = 50; wBK.timeout(G.poss); const b = wBK.potionWhy('secondwind', -1);
          G = __dead(11); const early = wBK.potionWhy('bksteady', -1);
          const sn = wBK.snapshot(); for (const k of ['mana', 'spirit', 'zones', 'ultUsed', 'sitUsed', 'kept', 'bags', 'pots', 'steady']) delete sn.G[k]; let err = 'ok'; try { wBK.resume(sn); wBK.hide(); wBK.advice({ bksteady: 1 }); wBK.potionWhy('draught', 0); wBK.step(60); } catch (e) { err = String(e); }
          return { a, b, early, err }; })()""")
        check(os['a'] == '' and 'One potion' in os['b'], 'one potion a stoppage: a timeout called in it doesn\'t start the count again', os)
        check('second half' in os['early'] and os['err'] == 'ok', 'Steady Drops only from the second half; a save point from before gear and potions resumes and plays on', os)
        cpu = await pg.evaluate("""(() => { const bag = { draught: 2 }; let gave = 0, notes = 0, used = null; for (let i = 0; i < 6; i++) { wBK.start({ teams: """ + T + """, seed: 30 + i, skill: [1, 1], bags: [null, Object.assign({}, bag)] }); let n = 0;
            while (wBK.phase !== 'over' && n++ < 30 * 900) wBK.step(); const P = wBK.pots(); gave += P.filter(p => p.side === 1).length; if (P.some(p => p.side === 0)) used = 'yours'; if (P.length && P[0].why) notes++; }
          const sq = wBK.simGame({ teams: """ + T + """, seed: 50, skill: [0, 0], bags: [null, { draught: 5 }] });
          return { gave, notes, used, left: wBK.bags(), sq: sq.box ? true : false }; })()""")
        check(cpu['gave'] > 0 and cpu['notes'] > 0 and cpu['used'] is None, 'the CPU\'s bench gives from its bag (with a reason); a null bag is the page\'s, and never opened', cpu)
        ad = await pg.evaluate("""(() => { const G = __dead(9); const ri = G.on[0][3]; G.stam[0][ri] = 20; const a = wBK.advice({ draught: 1 }), none = wBK.advice({}); return { a, ri, none }; })()""")
        check(ad['a'] and ad['a']['id'] == 'draught' and ad['a']['ri'] == ad['ri'] and ad['none'] is None, 'your bench\'s advice: the potion worth most now, for whom', ad)

        # ---------- the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""(() => { const kinds = ['elf', 'troll', 'werewolf']; let i = 0; while (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind: kinds[i++ % 3], lvl: 2 }, 'tavern')); wCourtAuto();
          wAddItem('bk_shoes', 1); wAddItem('draught', 3); wAddItem('secondwind', 1); })()""")
        gr = await pg.evaluate("""(() => { const k = WG.court.five.PG, p = wPlayer(k), r0 = JSON.stringify(p.bk); const r = wGearPutOn(k, 'bk_shoes');
          const mine = wCourtMine(), t = mine.roster[wCourtKeys(WG.court).indexOf(k)]; return { r, gear: p.gear.court, tag: t.gear && t.gear.id, same: JSON.stringify(p.bk) === r0, card: wStatsCard(p).includes('Court Shoes') }; })()""")
        check(gr['r'] == '' and gr['gear'] == 'bk_shoes' and gr['tag'] == 'bk_shoes' and gr['same'] and gr['card'], 'a player wears court gear: it goes into the game, their own ratings unchanged, on their stats', gr)
        sm = await pg.evaluate("""(() => { const n0 = WG.items.draught; wStartCourt({ club: 'local', how: 'sim' }); const b = document.getElementById('wCourtOk'); if (b) b.click(); return { same: WG.items.draught === n0 }; })()""")
        check(sm['same'], 'Simulate leaves your bag alone', sm)
        rg = await pg.evaluate("""(() => { const c = wBallClubs().find(k => k !== 'local'); const tier = wBallTier(c); wStartCourt({ club: c, how: 'manage' }); const lock = wGearTakeOff(WG.court.five.PG, 'court');
          return { theirs: wBK.bags()[1], want: W_COURT_KIT.opp[tier], mine: wBK.bags()[0], lock, gx: wBK.G.teams[0].roster[0].gx }; })()""")
        check(json.dumps(rg['theirs'], sort_keys=True) == json.dumps(rg['want'], sort_keys=True) and rg['mine'] is None and 'match is on' in rg['lock'] and rg['gx'] and rg['gx']['spd'] == 1.02,
              'a real game: their bench brings its tier\'s bag, yours is your own; gear can\'t change mid-game, and the shoes are on the court', rg)
        await pg.evaluate("wBK.speed = 6")
        await pg.wait_for_function("wBK.phase === 'dead' && !!document.querySelector('#wCourtCalls .wcckit [data-ckuse]')", timeout=60000)
        await pg.evaluate("wBK.pause(true); wCourtCalls(true)")
        bg = await pg.evaluate("""(() => { const n0 = WG.items.draught, G = wBK.G, you = wBK.you, ri = G.on[you][0]; G.stam[you][ri] = 25; wCourtCalls(true);
          const sel = document.querySelector('[data-ckwho="draught"]'); sel.value = String(ri); document.querySelector('[data-ckuse="draught"]').click();
          return { n: WG.items.draught - n0, st: G.stam[you][ri], buttons: [...document.querySelectorAll('#wCourtCalls [data-ckuse]')].map(b => b.dataset.ckuse) }; })()""")
        check(bg['n'] == -1 and bg['st'] == 65 and 'secondwind' in bg['buttons'], 'the Bag under the court gives from your bag: one comes out, and the player gets their stamina back', bg)
        sn2 = await pg.evaluate("(() => { const sn = WG.bkg.live.snap, you = wBK.you, ri = wBK.G.on[you][0]; return { st: Math.round(sn.G.stam[you][ri]), used: sn.GD.potUsed[you] }; })()")
        check(sn2['st'] == 65 and sn2['used'], 'the save point is the game with the potion given (a reload can\'t lose it, or give it back)', sn2)
        await pg.screenshot(path='/tmp/realm-court-kit.png', full_page=True)
        await pg.evaluate("wBK.pause(false); document.getElementById('wCourtGive').click(); document.getElementById('cfYes').click()")
        await pg.evaluate("wRunAct('bkcard')"); await pg.wait_for_selector('#modalBox .wbclubs')
        cd = await pg.evaluate("/benches bring/.test(document.getElementById('modalBox').textContent)")
        check(cd, 'the game card says what each tier\'s bench brings', cd)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click(); showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpCourtKit'); return !!h && /Court Shoes/.test(h.textContent) && /Steady Drops/.test(h.textContent) && /nerves/.test(h.textContent); })()")
        check(hp, 'How to play explains court gear, the potions and nerves', hp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
