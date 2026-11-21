# Realm: corrupted monsters and the card game at tier U (issue #99, phase 3). A match on the dark side is an Umbral
# match: tier 3, then tier U (more HP and Strength on the other side, one card fewer in your hand), its players in
# shadow, each with its kind's dark trait; a light match of the same players is not. The Gatekeeper waits at the Gate
# on the dark road: PLAY opens a match card that names tier U and two hexes (and the lantern, not an inn); the hexes
# are applied. Win and the Cracked Card is yours (1 of 9); lose and the next hand costs a toll. A mid-match save keeps
# it all. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wNadirMatch === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 999; wSave()")

        # (the same players, in the light and in the dark: the fight is started straight, without its card)
        um = await pg.evaluate("""(() => { const out = {}, keep = beginFight; beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); };
          const go = (map) => { wEnterMap(map, map === 'graftonbury' ? 5 : 40, map === 'graftonbury' ? 11 : 40); RUN.pending = null; B = null; LAB = true;
            startMatch({ type: 'normal', ids: ['skelss', 'golemnt', 'harpyf'], tier: 2, world: { kind: 'wild', ref: null, region: 'plains' } }); LAB = false;
            const r = { tier: RUN.pending.world.tier, umb: !!RUN.pending.world.umbral, drawMod: B.drawMod || 0, hand: B.hand.length, shade: B.enemies.map(e => !!e.shade), str: B.enemies.map(e => (e.st.str || 0)), thorns: (B.enemies[0].st.thorns || 0), block: B.enemies[1].block || 0, weak: B.P.st.weak || 0, hp: B.enemies.map(e => e.max), log: B.log.map(l => l[0] || l.t || '').join(' ') };
            B = null; RUN.pending = null; return r; };
          out.light = go('graftonbury'); out.dark = go('u:world'); beginFight = keep; return out; })()""")
        L, D = um['light'], um['dark']
        check(not L['umb'] and D['umb'] and D['tier'] == 3 and L['tier'] == 2, 'a match on the dark side is an Umbral match, at tier 3; the same match in the light is not', um)
        check(D['drawMod'] == -1 and L['drawMod'] == 0 and D['hand'] == L['hand'] - 1 and all(D['shade']) and not any(L['shade']), 'tier U: you draw one card fewer, and its players are drawn in shadow', um)
        check(all(d >= l + 1 for d, l in zip(D['str'], L['str'])) and D['thorns'] == 2 and D['block'] >= 10 and D['weak'] >= 1 and 'tier U' in D['log'] and 'Rattle' in D['log'], 'each has more Strength and its kind\'s dark trait (the skeleton\'s Spikes, the golem\'s Bedrock, the harpy\'s Shriek), named in the log', um)

        await pg.evaluate("const C = W_NADIR.gate, m = MAPS[C.map], n = m.npcs.find(x => x.id === C.char); wEnterMap(C.map, n.x, n.y + 1); wDrain()")
        nd = await pg.evaluate("""(() => { const r = wSay('nadir_gate', 'play'); wRunAct(r.act, 'nadir_gate'); const box = document.getElementById('modalBox'), t = box ? box.textContent : '';
          return { act: r.act, card: !!document.getElementById('wPlay'), tierU: t.includes('tier U'), hexes: (RUN.pending ? null : null), text: t.slice(0, 900), lantern: t.includes('lantern') && !t.includes('last inn') }; })()""")
        hx = await pg.evaluate("wUmbHexes('gate', 2).map(h => W_UMB3.hexes[h].n)")
        check(nd['act'] == 'unadir:gate' and nd['card'] and nd['tierU'] and all(h in nd['text'] for h in hx) and nd['lantern'], 'the Gatekeeper\'s PLAY opens a match card naming tier U, two hexes, and the lantern you would wake by', {'nd': nd, 'hx': hx})
        await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'", timeout=15000)
        fs = await pg.evaluate("""(() => ({ ids: B.enemies.map(e => e.id), lead: B.enemies[0].n, hexes: RUN.pending.world.hexes, log: B.log.map(l => l[0] || l.t || '').join(' '), umb: B.umb, kind: RUN.pending.world.kind }))()""")
        check(fs['ids'] == ['u_gatekeeper', 'boneline'] and 'Gatekeeper' in fs['lead'] and fs['umb'] == 1 and fs['kind'] == 'nadir' and all(('Hex: ' + h) in fs['log'] for h in hx), 'the match is the Gatekeeper\'s, an Umbral one, with both hexes applied', fs)

        # (a save mid-match keeps the Umbral)
        await pg.evaluate("wSave()")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wNadirMatch === 'function'")
        await pg.evaluate("wStart(wLoadSave())")
        await pg.wait_for_function("UI.view === 'fight' && !!B", timeout=15000)
        rs = await pg.evaluate("(() => ({ umb: B.umb, drawMod: B.drawMod, shade: B.enemies.every(e => e.shade), hexes: RUN.pending.world.hexes }))()")
        check(rs['umb'] == 1 and rs['drawMod'] == -1 and rs['shade'] and rs['hexes'] == fs['hexes'], 'a save mid-match comes back an Umbral match, its hexes the same', rs)

        wn = await pg.evaluate("""(async () => { for (const e of B.enemies) { e.hp = 0; e.dead = true; } B.over = 'win'; consumeFx(); renderFightHUD(); finishFight();
          const t0 = Date.now(); await new Promise(r => { const f = () => (UI.view !== 'fight' || Date.now() - t0 > 8000) ? r() : setTimeout(f, 50); f(); });
          wReturnToWorld(); const U = WG.umbral; return { pieces: U.pieces.slice(), beaten: !!U.beaten.gate, again: wNadirMatch('gate') }; })()""")
        check(wn['pieces'] == ['card'] and wn['beaten'] and 'yours' in wn['again'], 'win, and the Cracked Card is yours (1 of 9); the Gatekeeper has nothing left to play for', wn)
        await pg.evaluate("for (let k = 0; k < 6 && !document.getElementById('modal').hidden; k++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));")

        tl = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = []; U.tries = {}; W_ON_END.nadir('lose', { id: 'gate' }); const out = { tries: U.tries.gate };
          RUN.gold = 10; out.poor = wNadirMatch('gate'); RUN.gold = 100; LAB = true; const keep = beginFight; beginFight = () => {}; out.rich = wNadirMatch('gate'); out.paid = 100 - RUN.gold; beginFight = keep; LAB = false; RUN.pending = null; B = null;
          return out; })()""")
        check(tl['tries'] == 1 and 'toll' in tl['poor'] and tl['rich'] == '' and tl['paid'] == 30, 'lose, and the next hand costs a toll (refused without the gold)', tl)
        aud = await pg.evaluate("wAudit()")
        check(aud == [], 'the audit is clean', aud)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
