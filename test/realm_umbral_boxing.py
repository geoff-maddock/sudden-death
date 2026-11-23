# Realm: boxing in the Umbral (issue #99, phase 4c). Tier U is tier 4 in the ring's tables (a bigger rating bonus, a
# full bag, the Lich in their corner) and the Lich decides differently from an Archmage. The engine's hexes do what
# they say, are logged before the first bell and kept on the scoreboard, and a bout without them is exactly as before.
# Brakka Knell waits at the far end of the Broken Ring; PLAY (past the guards, with the gate paid) opens the pairing
# with the hexes named, and Play starts a real card: tier U, the Lich, the Nadir in umbral form, the hexes in the ring,
# saved and resumed with them. Backing out costs nothing; a lost card counts a try (the next pays the toll at kickoff),
# and a won card pays the Broken Bell.
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbNadirEnd === 'function' && !!W_UMB4.start.ring")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")

        # ---------- the engine: tier U's numbers, the Lich, the hexes ----------
        eng = await pg.evaluate("""(() => {
          const out = {}, F = [{ n: 'A', kind: 'elf' }, { n: 'B', kind: 'lich' }], base = { fighters: F, seed: 4242, skill: [1, 2] };
          out.tier = { bonus: [W_BXG.oppBonus[3], W_BXG.oppBonus[4]], skill: wRingSkill(4), name: W_BALL_SKILL[wRingSkill(4)[1]], bag: W_RING_KIT.opp[4], potions: Object.keys(wBX.potions), t3: wRingSkill(3) };
          const s0 = wBX.simBout(base), s1 = wBX.simBout(Object.assign({}, base, { hexes: [] })), s2 = wBX.simBout(Object.assign({}, base, { hexes: ['nope'] }));
          out.same = JSON.stringify(s0) === JSON.stringify(s1) && JSON.stringify(s0) === JSON.stringify(s2);
          out.again = JSON.stringify(s0) === JSON.stringify(wBX.simBout(base));
          // the Lich: a different fight from the same seed, and a plan read off the other fighter before the first bell
          const L = wBX.simBout(Object.assign({}, base, { skill: [1, 3] }));
          out.lichDiffers = JSON.stringify(L.stats) !== JSON.stringify(s0.stats);
          const away = wBX.simBout({ fighters: [{ n: 'A', kind: 'elf', style: 'away' }, { n: 'B', kind: 'lich' }], seed: 7, skill: [1, 3] });
          const away2 = wBX.simBout({ fighters: [{ n: 'A', kind: 'elf', style: 'away' }, { n: 'B', kind: 'lich' }], seed: 7, skill: [1, 2] });
          out.read = [away.plans[0][1], away2.plans[0][1]];
          // over many seeds the Lich wins more than an Archmage with the same fighters
          const ks = wBX.kinds; let wa = 0, wl = 0;
          for (let i = 0; i < 300; i++) { const f = [{ n: 'A', kind: ks[i % 18] }, { n: 'B', kind: ks[(i * 7 + 5) % 18] }];
            if (wBX.simBout({ fighters: f, seed: 900 + i, skill: [1, 2] }).over.win === 1) wa++; if (wBX.simBout({ fighters: f, seed: 900 + i, skill: [1, 3] }).over.win === 1) wl++; }
          out.wins = [wa, wl];
          // each hex: logged before the first bell, and what it does
          out.logs = {}; for (const h of Object.keys(wBX.hexes)) { const s = wBX.simBout(Object.assign({}, base, { hexes: [h] })); out.logs[h] = s.log[0] && s.log[0].msg.startsWith('Hex: ' + wBX.hexes[h].n); }
          const water = wBX.simBout(Object.assign({}, base, { hexes: ['water'] }));
          out.waterDiffers = JSON.stringify(water.stats) !== JSON.stringify(s0.stats);
          // the Shrinking Ring, live: the ropes two feet in at round 2; the Quick Count, a longer count; hexes on the scoreboard
          wBX.start({ fighters: F, seed: 11, skill: [1, 1], hexes: ['shrink', 'count'], mode: 'watch' });
          out.r1 = wBX.rope(); out.words = wBX.hexWords(); out.hex = wBX.hex;
          for (let n = 0; n < 40000 && wBX.G.round < 2 && wBX.phase !== 'over'; n++) wBX.step();
          out.r2 = wBX.rope(); out.round = wBX.G.round;
          wBX.hide();
          return out; })()""")
        t = eng['tier']
        check(t['bonus'][1] > t['bonus'][0] and t['skill'] == [1, 3] and t['name'] == 'Lich' and t['t3'] == [1, 2] and all(t['bag'].get(k, 0) > 0 for k in t['potions']),
              'tier U is tier 4 in the ring\'s tables: a bigger rating bonus than tier 3, the Lich (skill 3) in their corner, a full bag; tier 3 still an Archmage', t)
        check(eng['same'] and eng['again'], 'a bout with no hexes (none, an empty list, or an unknown one) is exactly the bout without the option, from the same seed', eng)
        check(eng['lichDiffers'] and eng['read'] == ['press', 'counter'], 'the Lich fights differently from the same seed, and reads the other fighter before the first bell (it walks down a fighter who stays away, where an Archmage boxes its own style)', eng)
        check(eng['wins'][1] > eng['wins'][0], 'over 300 seeded bouts the Lich wins more than an Archmage with the same fighters', eng['wins'])
        check(all(eng['logs'].values()) and eng['waterDiffers'], 'each hex is announced in the log before the first bell, and changes the bout', eng['logs'])
        check(abs(eng['r1'] - 8.3) < 1e-9 and abs(eng['r2'] - 6.3) < 1e-9 and eng['round'] == 2, 'the Shrinking Ring: the ropes close in two feet by round 2', eng)
        check('Shrinking Ring' in eng['words'] and 'Quick Count' in eng['words'] and eng['hex'] == {'ids': ['shrink', 'count'], 'on': 0}, 'the hexes are on the scoreboard (the line under the clock) and in the bout\'s state', eng)

        # ---------- a journey, at the Broken Ring ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        st = await pg.evaluate("""(() => { wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 500;
          const kinds = ['elf', 'harpy', 'goblin', 'troll'].filter(k => !wRoster().some(p => p.kind === k));
          while (wRoster().length < 3) wRecruit({ kind: kinds.pop(), lvl: 3 }, 'tavern');
          const C = W_NADIR.ring, m = MAPS['u:g_ring'], at = m.npcs.find(n => n.id === C.char), ch = DB.chars[C.char];
          WG.map = 'u:g_ring'; WG.x = at.x; WG.y = at.y + 1; wSave();
          return { C, at: !!at, greet: ch.greet, play: ch.topics.play.act, audit: wAudit(), early: wNadirMatch('ring') }; })()""")
        check(st['at'] and st['C']['engine'] == 'ring' and st['C']['piece'] == 'boxing' and st['C']['ground'] == 'g_ring' and st['C']['region'] == 'ember',
              'Brakka Knell stands at the far end of the Broken Ring, holding the Broken Bell, and plays boxing', st)
        check('PLAY' in st['greet'] and 'RULES' in st['greet'] and st['play'] == 'unadir:ring' and 'Hand' in st['early'], 'their greet names PLAY and RULES, and PLAY goes to the guards first', st)
        check(st['audit'] == [], 'the audit is clean', st['audit'])

        # PLAY, past the guards and the gate: the pairing names tier U and the hexes; backing out costs nothing
        await pg.evaluate("WG.umbral.guards = { 'g_ring:0': WG.dayAbs, 'g_ring:1': WG.dayAbs }; WG.umbral.gates = { ring: WG.dayAbs }; wRunAct('unadir:ring', 'nadir_ring')")
        await pg.wait_for_selector('#wRingPairT')
        pr = await pg.evaluate("""(() => { const box = $('modalBox'), hx = wUmbRingHexes('ring', W_NADIR.ring.hexes);
          return { hexes: hx, names: hx.map(h => wBX.hexes[h].n), text: box.querySelector('[data-umbhex]').textContent, intro: box.textContent, champ: (box.querySelector('[data-umbchamp]') || {}).textContent || '', gold: RUN.gold }; })()""")
        check(1 <= len(pr['hexes']) <= 2 and all(n in pr['text'] for n in pr['names']) and 'tier U' in pr['intro'] and 'Lich' in pr['intro'],
              'PLAY opens the pairing: tier U, the Lich, and the one or two hexes drawn for this try, by name', pr)
        check('Death Knell' in pr['champ'] and 'The Last Bell' in pr['champ'] and 'Cracked Bronze' in pr['champ'], 'the champion\'s own nature and powers are on the pairing', pr['champ'])
        await pg.click('#modalBox [data-close]')
        g0 = await pg.evaluate("RUN.gold")
        check(g0 == pr['gold'] and not await pg.evaluate("wRingLive()"), 'backing out of the pairing starts nothing and costs nothing', [g0, pr['gold']])

        # Play: a real card in the ring
        await pg.evaluate("wRunAct('unadir:ring', 'nadir_ring')"); await pg.wait_for_selector('#wRingCardGo')
        await pg.click('#wRingCardGo')
        await pg.wait_for_function("UI.view === 'ring' && wRingLive() && !!wBX.G && !!WG.bxg.live.snap")
        pl = await pg.evaluate("""(() => { const L = WG.bxg.live, C = wBX.card, G = wBX.G, champ = C.sides[1].fighters[2];
          return { kind: L.world.kind, tier: L.world.tier, club: L.world.club, hexes: L.world.hexes, cardHex: C.hexes, hex: wBX.hex, skill: C.skill, gskill: G.skill,
            umb: C.sides[1].fighters.every(f => f.umb), champ: { n: champ.n, ult: champ.pw && champ.pw.ult.n, tr: champ.tr && champ.tr.n }, bag: C.bags[1],
            log: G.log.slice(0, 3).map(l => l.msg), words: wBX.hexWords(), note: $('wRingNote').textContent, snap: { cd: L.snap.CD.hexes, g: L.snap.G.hex } }; })()""")
        check(pl['kind'] == 'unbox' and pl['tier'] == 4 and pl['club'] == 'nadir' and pl['skill'] == [1, 3] and pl['gskill'] == [1, 3],
              'Play starts a real card against the Nadir at tier U, with the Lich in their corner', pl)
        check(pl['umb'] and pl['champ']['n'] == 'Brakka Knell' and pl['champ']['ult'] == 'The Last Bell' and pl['champ']['tr'] == 'Cracked Bronze' and all(pl['bag'].get(k, 0) > 0 for k in t['potions']),
              'the Nadir box in umbral form, Brakka in the main event with their own powers and nature, and their corner brings a full bag', pl)
        check(pl['hexes'] == pr['hexes'] and pl['cardHex'] == pr['hexes'] and pl['hex']['ids'] == pr['hexes'] and pl['hex']['on'] == 0,
              'the try\'s hexes are in the ring, against your side', pl)
        check(all(l.startswith('Hex: ') for l in pl['log'][:len(pr['hexes'])]) and pl['words'] and 'Hexes:' in pl['note'] and pl['snap']['cd'] == pr['hexes'] and pl['snap']['g']['ids'] == pr['hexes'],
              'they are announced before the bell, on the scoreboard and the ring bar, and kept in the save point', pl)

        # save and leave, then resume: the same card, the hexes still on
        await pg.click('#wRingSave')
        await pg.wait_for_function("UI.view !== 'ring' && wRingLive()")
        await pg.evaluate("wResumeRing()"); await pg.wait_for_function("UI.view === 'ring' && !!wBX.G")
        rs = await pg.evaluate("({ hex: wBX.hex, card: wBX.card.hexes, skill: wBX.G.skill })")
        check(rs['hex'] and rs['hex']['ids'] == pr['hexes'] and rs['card'] == pr['hexes'] and rs['skill'] == [1, 3], 'saved and resumed, the card comes back with its hexes and the Lich', rs)

        # concede: a lost card counts a try
        await pg.click('#wRingGive'); await pg.wait_for_selector('#cfYes'); await pg.click('#cfYes')
        await pg.wait_for_function("!wRingLive()")
        ls = await pg.evaluate("({ tries: WG.umbral.tries.ring || 0, pieces: WG.umbral.pieces.slice(), last: WG.lastMatch })")
        check(ls['tries'] == 1 and 'boxing' not in ls['pieces'] and ls['last']['kind'] == 'unbox', 'a lost card counts a try, and no piece', ls)
        await pg.evaluate("document.querySelectorAll('#wRingOk').forEach(b => b.click())")
        await pg.wait_for_function("document.getElementById('modal').hidden")

        # the next try: new hexes for the new try, the toll at kickoff (Manage), and a won card pays the piece
        # (where the frame charges the toll at kickoff, wUmbTollAtKickoff: backing out of a retry's pairing costs nothing)
        if await pg.evaluate("typeof wUmbTollAtKickoff === 'function'"):
            gb = await pg.evaluate("RUN.gold")
            await pg.evaluate("wRunAct('unadir:ring', 'nadir_ring')"); await pg.wait_for_selector('#wRingPairT')
            await pg.click('#modalBox [data-close]')
            check(await pg.evaluate("RUN.gold") == gb, 'backing out of a retry\'s pairing costs no toll', gb)
        g1 = await pg.evaluate("RUN.gold")
        hx2 =await pg.evaluate("wUmbRingHexes('ring', W_NADIR.ring.hexes)")
        await pg.evaluate("wRunAct('unadir:ring', 'nadir_ring')"); await pg.wait_for_selector('#wRingPairT')
        await pg.click('#modalBox [data-rgo="manage"]')
        await pg.wait_for_function("UI.view === 'ring' && wRingLive()")
        g2 = await pg.evaluate("RUN.gold")
        check(g1 - g2 == st['C']['toll'] and await pg.evaluate("WG.bxg.live.world.hexes") == hx2 and await pg.evaluate("wBX.mode") == 'call',
              'the next try pays the toll once, at kickoff, with the hexes drawn for that try, and Manage puts you in the corner', [g1, g2, hx2])
        won = await pg.evaluate("""(() => { const g = RUN.gold; wRingSettle({ win: 0, by: 'bouts', won: [2, 1] }, [], []);
          return { pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.ring, gold: RUN.gold - g, done: wNadirMatch('ring'), live: wRingLive() }; })()""")
        check('boxing' in won['pieces'] and won['beaten'] and won['gold'] >= st['C']['gold'] and 'yours' in won['done'] and not won['live'],
              'a won card pays the Broken Bell and the champion\'s gold, and Brakka has nothing left to play for', won)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
