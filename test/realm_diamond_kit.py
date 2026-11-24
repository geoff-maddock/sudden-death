# Realm diamond (issue #115, phase 1): baseball gear and potions.
# The engine: a bat a player wears is their own ⚒ batting stance, a ball their own ⚒ pitch, each with its uses a game
# (spent when used, back the next game), and nobody else on the side has them; a Rosin Bag tightens the wearer's
# pitches and the Steadyhand Balm the side's; a glove reaches further and bobbles less; Owl-Eye Drops make the swing
# circle bigger for the side's next half at bat and are spent with it, the balm with the side's next half in the field.
# Potions: one a side a break between half-innings, and only in the break (the first pitch of the half closes it); the
# Brimstone Tonic gives two mana, the Stamina Draught the pitcher's stamina (not to a fresh one); a CPU with a bag gives
# at its skill, with a reason in the play-by-play; a side without a bag (yours) never does.
# The Realm: thirteen pieces of baseball gear (six in the Graftonbury store, seven in chests, the Diamond Cup adds one)
# and three baseball potions in the store; a piece worn reaches the game (its rating and its tag) and not the player's
# own ratings, shows on the Nine tab, and can't change during a ball game; in a game you play their bag goes in by tier
# and yours stays your own; the Bag row gives a potion from your bag (it comes out), refuses a second one in the break
# (it stays in the bag), and the save point keeps it; Simulate leaves your bag alone; an exhibition has no Bag row; the
# game card says what each club brings; How to play explains it. Asserts; exits nonzero on failure.
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
window.__club = (id, mod) => { const d = wBD.club(id, 3); if (mod) mod(d); return d; };
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 60000)) wBD.step(1); return !!f(); };
window.__sel = () => wBD.G.phase === 'plate' && wBD.G.P && wBD.G.P.stage === 'select';
window.__thrown = () => wBD.G.phase === 'play' || (wBD.G.phase === 'plate' && !!wBD.G.P && !!wBD.G.P.pitch);
// a game as the Realm starts one (its rules over the engine's defaults; off screen, so only __to moves it)
window.__game = o => { wBD.start(Object.assign({ innings: 3, diff: 1, rules: W_BALL.rules }, o)); wBD.pause(false); };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBD !== 'undefined' && typeof wStartBall === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- gear in the engine ----------
        g = await pg.evaluate("""(() => { const out = {};
          const a = __club('ironmaw', d => { const b = d.roster[0]; b.gear = 'Hornet-Nest Bat'; b.gx = { bat: 'hornet' }; });
          const h = __club('mirewood', d => { const P = d.roster.find(p => p.pos === 'P'); P.gear = 'Ghost Ball'; P.gx = { ball: 'ghost' }; });
          __game({ mode: 'demo', defs: [a, h] });
          const G = wBD.G; __to(__sel);
          const P = G.P, si = P.stances.findIndex(s => s.k === 'gear'), pi = P.pitches.findIndex(x => x.gear);
          out.stance = si >= 0 && P.stances[si].gear; out.pitch = pi >= 0 && P.pitches[pi].gear; out.uses0 = [a.roster[0].kit.uses, h.roster.find(p => p.pos === 'P').kit.uses];
          P.si = si; __to(() => G.P.stage === 'windup'); G.P.pi = pi; __to(__thrown);
          out.spent = [a.roster[0].kit.uses, h.roster.find(p => p.pos === 'P').kit.uses]; out.pc = [G.P.pitch && G.P.pitch.pgear, G.P.pitch && G.P.pitch.bgear];
          // the next batter has no bat of their own
          __to(() => G.teams[0].idx === 1 && __sel()); out.next = G.P.stances.some(s => s.k === 'gear');
          // a new game: the uses are back
          __game({ mode: 'demo', defs: [a, h] }); out.back = a.roster[0].kit.uses;
          return out; })()""")
        check(g['stance'] == 'hornet' and g['pitch'] == 'ghost' and g['uses0'] == [3, 3], 'a bat worn is the batter\'s own stance, a ball worn the pitcher\'s own pitch, with their uses', g)
        check(g['spent'] == [2, 2] and g['pc'] == ['ghost', 'hornet'], 'using them spends a use, and the pitch carries both', g)
        check(g['next'] is False and g['back'] == 3, 'the next batter has no bat of their own, and the uses come back the next game', g)
        r = await pg.evaluate("""(() => { const out = {};
          const run = (gx, steady) => { const h = __club('mirewood', d => { const P = d.roster.find(p => p.pos === 'P'); if (gx) P.gx = gx; });
            __game({ mode: 'demo', defs: [__club('ironmaw'), h] }); __to(__sel); if (steady) wBD.kit.steady[1] = true; __to(__thrown); return wBD.G.P.pitch.kitCtrl || 1; };
          out.ctrl = [run(null, false), run({ ctrl: .9 }, false), run(null, true), run({ ctrl: .9 }, true)];
          out.reach = [wBD.kitProbe.reach({}), wBD.kitProbe.reach({ gx: { reach: 1 } })]; out.bob = [wBD.kitProbe.bob({}), wBD.kitProbe.bob({ gx: { bob: .67 } })];
          return out; })()""")
        check(r['ctrl'] == [1, 0.9, 0.8, 0.72], 'a Rosin Bag tightens the wearer\'s pitches, the Steadyhand Balm the side\'s, and together both', r['ctrl'])
        check(r['reach'][1] == r['reach'][0] + 1 and r['bob'] == [1, 0.67], 'a glove reaches a foot further and bobbles a third less', r)

        # ---------- potions in the engine ----------
        pt = await pg.evaluate("""(() => { const out = {};
          __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 0, bags: [null, { draught: 1 }] });
          const G = wBD.G, K = wBD.kit;
          out.bags = JSON.parse(JSON.stringify(K.bags)); out.open = K.open && G.phase === 'between';
          out.fresh = wBD.potionWhy(0, 'draught');
          G.teams[0].mana = 1; out.tonic = [wBD.potion('bdtonic'), G.teams[0].mana];
          out.again = wBD.potion('bdeye');
          __to(__thrown); out.closed = wBD.potionWhy(0, 'bdeye');
          __to(() => G.half === 1 && __sel());
          const p0 = G.teams[0].def.roster.find(p => p.pos === 'P'); p0.stam = p0.maxStam * .3;
          out.draught = [wBD.potion('draught'), +(p0.stam / p0.maxStam).toFixed(3)];
          out.mine = K.pots.filter(x => x.side === 0).map(x => x.id);
          return out; })()""")
        check(pt['bags'] == [None, {'draught': 1}] and pt['open'], 'a game\'s bags: theirs in the engine, yours (null) kept by the page; the break before the first half is open', pt)
        check(pt['tonic'] == ['', 3] and pt['again'] == 'One potion a break.', 'the Brimstone Tonic gives two mana; one potion a break', pt)
        check(pt['closed'].startswith('Only between half-innings') and 'fresh' in pt['fresh'], 'the first pitch of the half closes the break; no draught for a fresh pitcher', pt)
        check(pt['draught'] == ['', 0.7] and pt['mine'] == ['bdtonic', 'draught'], 'at the next break the Stamina Draught gives your pitcher two fifths of their stamina', pt)
        ey = await pg.evaluate("""(() => { __game({ mode: 'demo', defs: [__club('ironmaw'), __club('mirewood')] });
          const G = wBD.G, K = wBD.kit; K.eye[0] = true; K.eye[1] = true; K.steady[1] = true; K.steady[0] = true; const on = wBD.kitProbe.eye();
          __to(() => G.half === 1); const mid = { eye: K.eye.slice(), steady: K.steady.slice(), now: wBD.kitProbe.eye() };
          __to(() => G.half === 0 && G.inning === 2); return { on, mid, end: { eye: K.eye.slice(), steady: K.steady.slice() } }; })()""")
        check(ey['on'] == 1.2 and ey['mid'] == {'eye': [False, True], 'steady': [True, False], 'now': 1.2} and ey['end'] == {'eye': [False, False], 'steady': [False, False]},
              'Owl-Eye Drops grow the swing circle and are spent with the side\'s half at bat; the balm with its half in the field', ey)
        cpu = await pg.evaluate("""(() => { const P = [], B = { draught: 2, bdtonic: 1, bdeye: 1, bdsteady: 1 };
          for (let i = 0; i < 3; i++) { wBD.sim({ defs: [__club('ironmaw'), __club('mirewood')], innings: 3, diff: 3, rules: W_BALL.rules, bags: [null, Object.assign({}, B)] }); P.push(...wBD.kit.pots); }
          const log = wBD.G.full.filter(e => e.text.startsWith('⚗')).map(e => e.text);
          return { n: P.length, mine: P.filter(x => x.side === 0).length, why: P.every(x => x.why), log: log.slice(0, 2), logged: log.length === wBD.kit.pots.length }; })()""")
        check(cpu['n'] >= 3 and cpu['mine'] == 0 and cpu['why'] and cpu['logged'], 'a CPU with a bag gives potions at its skill, each with a reason in the play-by-play; a side without one never does', cpu)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); WG.cardOffer = null; })()")
        rg = await pg.evaluate("""(() => { const ids = Object.keys(W_GEAR).filter(k => W_GEAR[k].sport === 'diamond'), shop = DB.shops.hq || {};
          const store = ids.filter(id => shop[id] > 0), chest = ids.filter(id => Object.values(DB.chests).some(c => c.items && c.items[id]));
          const pots = ['bdtonic', 'bdeye', 'bdsteady'].every(id => shop[id] > 0 && W_POTIONS[id] && W_POTIONS[id].sport === 'diamond') && wPotionSports('draught').includes('diamond');
          const p = wRoster()[0], d0 = wNineDef().roster.find(x => x.rid === p.id), own0 = wBdOf(p).spd;
          wAddItem('bd_spikes', 1); const put = wGearPutOn(p.id, 'bd_spikes'), d1 = wNineDef().roster.find(x => x.rid === p.id);
          return { n: ids.length, store: store.length, chest: chest.length, both: store.filter(id => chest.includes(id)), pots, put, up: d1 && d0 ? d1.spd - d0.spd : null, own: wBdOf(p).spd - own0, tag: d1 && [d1.gear, d1.gid, d1.gx] }; })()""")
        check(rg['n'] == 13 and rg['store'] == 6 and rg['chest'] == 7 and not rg['both'] and rg['pots'], 'thirteen pieces of baseball gear (six in the Graftonbury store, seven in chests) and three potions in the store; the draught serves the diamond too', rg)
        check(rg['put'] == '' and rg['up'] == 1 and rg['own'] == 0 and rg['tag'] == ['Iron Spikes', 'bd_spikes', {}], 'a piece worn reaches the game (its rating and its tag), not the player\'s own ratings', rg)
        nt = await pg.evaluate("(() => { wOpenCamp('nine'); const t = $('wCampBody').textContent; WCAMP.close(); return /Plays with the Iron Spikes/.test(t); })()")
        check(nt, 'the Nine tab shows the gear a player wears', nt)

        mt = await pg.evaluate("""(() => { wAddItem('bdtonic', 2); wAddItem('draught', 1); wBall().met = {}; const r = wStartBall({ club: 'local', how: 'play' }); wBD.pause(true);
          const K = wBD.kit, G = wBD.G, L = WG.ball.live; wBallBagRows(true); const row = $('wBallBagRow');
          const out = { r, mine: K.bags[0], theirs: K.bags[1], tier: L.world.tier, shown: !row.hidden, during: wGearTakeOff(wRoster()[0].id, 'diamond') };
          G.teams[0].mana = 1; const n0 = WG.items.bdtonic, d0 = WG.items.draught;
          row.querySelector('[data-bkuse="bdtonic"]').click(); out.used = n0 - (WG.items.bdtonic || 0); out.mana = G.teams[0].mana;
          const b = row.querySelector('[data-bkuse="draught"]'); out.off = !!b && b.disabled;
          out.refused = wBallPotion('draught'); out.kept = (WG.items.draught || 0) === d0;
          __to(__sel); wBD.snapNow(); out.snap = L.snap && L.snap.kit ? [L.snap.kit.used[0] === L.snap.kit.key, L.snap.kit.pots.map(x => x.id)] : null;
          __to(__thrown); wBallBagRows(true); out.closed = !!row.querySelector('[data-bkuse]:not([disabled])') === false && /next break/.test(row.textContent);
          return out; })()""")
        check(mt['r'] == '' and mt['mine'] is None and mt['theirs'] == await pg.evaluate(f"W_DIAMOND_KIT.opp[{mt['tier']}]"), 'in a game you play their bag goes in by tier, and yours stays your own', mt)
        check(mt['shown'] and mt['used'] == 1 and mt['mana'] == 3, 'the Bag row gives a potion from your bag, and it comes out', mt)
        check(mt['off'] and mt['refused'] == 'One potion a break.' and mt['kept'], 'a second potion in the same break is refused, and stays in the bag', mt)
        check(mt['snap'] == [True, ['bdtonic']], 'the save point keeps the potion given', mt)
        check(mt['closed'], 'once the half\'s first pitch is thrown, the Bag row waits for the next break', mt)
        check('Not while' in mt['during'], 'gear can\'t change during a ball game', mt)
        await pg.evaluate("(() => { wBD.pause(false); $('wBallGive').click(); const b = [...document.querySelectorAll('#modalBox button')].find(x => x.textContent.trim() === 'Concede'); if (b) b.click(); })()")
        await pg.wait_for_function("!wBallLive() && UI.view === 'world'")

        sm = await pg.evaluate("""(() => { wBall().met = {}; const it0 = JSON.stringify([WG.items.bdtonic || 0, WG.items.draught || 0]); const r = wStartBall({ club: 'local', how: 'sim' });
          const ok = document.getElementById('wBallOk'); if (ok) ok.click();
          return { r, same: JSON.stringify([WG.items.bdtonic || 0, WG.items.draught || 0]) === it0, mine: wBD.kit.pots.filter(x => x.side === 0).length }; })()""")
        check(sm['r'] == '' and sm['same'] and sm['mine'] == 0, 'Simulate leaves your bag alone', sm)
        ex = await pg.evaluate("""(() => { wNineWatch(); wBD.pause(true); wBallBagRows(true); const out = { r: wBallPotion('bdtonic'), hidden: $('wBallBagRow').hidden }; wLeaveDiamond(); return out; })()""")
        check(ex['r'] != '' and ex['hidden'], 'an exhibition takes no potions, and has no Bag row', ex)
        cd = await pg.evaluate("(() => { wOpenBallCard(); const t = $('modalBox').textContent; document.querySelector('#modalBox [data-close]').click(); return /What their nines bring/.test(t); })()")
        check(cd, 'the game card says what each club brings', cd)
        cp = await pg.evaluate("""(() => { WG.dcup = { field: ['me', 'local'], games: [[], [], [{ a: 'me', b: 'local', ra: 3, rb: 1, w: 'me' }]], done: true, champ: 'me' }; const n0 = WG.items.bd_dragonbone || 0;
          wDcupWon(); WG.cardOffer = null; while (!$('modal').hidden) { const b = document.querySelector('#modalBox [data-close], #modalBox .btn'); if (!b) break; b.click(); }
          return (WG.items.bd_dragonbone || 0) - n0; })()""")
        check(cp == 1, 'the Diamond Cup adds a piece of baseball gear you don\'t have', cp)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ kit: ($('wHelpBallKit') || {}).textContent || '', gear: ($('wHelpGear') || {}).textContent || '' })")
        check('Baseball gear and potions.' in hp['kit'] and 'Owl-Eye Drops' in hp['kit'] and 'baseball' in hp['gear'], 'How to play explains baseball gear and potions, and gear lists baseball', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
