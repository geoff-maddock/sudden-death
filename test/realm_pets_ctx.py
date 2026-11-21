# Realm pets (issue #104, phase 6): pets in context. A pet is 25% stronger for each thing about a match that suits it:
# one of its sports, one of its moons, its own ground, and a foe of an element its own beats; none of it outside them.
# Every pet has its sports, and its moons are real phases. The new moments fire: a highlight and a score (both sides).
# The Axebeak's first touchdown in football gives Strength, once. In the Realm the pet at your side learns its ground
# and foe at kickoff (the match's region's element), and a mid-fight save keeps them. The battle tooltip says what
# suits it today; the Pets tab says what suits each pet; How to play explains. Asserts; exits nonzero on failure.
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

ESC = "for (let k = 0; k < 6 && !document.getElementById('modal').hidden; k++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof petCtx === 'function' && typeof wKickoff === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        c = await pg.evaluate("""(() => { const out = {}; RUN.clock = 0; // (the new moon: only the Imp's)
          beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' });
          const q = (kind, o) => Object.assign({ kind, bond: 1, hungry: false }, o || {});
          out.none = [petCtx(q('frostpup')), petPow(8, q('frostpup'))];
          B.sport = 'hockey'; out.sport = [petCtx(q('frostpup')), petPow(8, q('frostpup'))];
          out.home = [petCtx(q('frostpup', { here: 'rime' })), petPow(8, q('frostpup', { here: 'rime' }))];
          out.foe = [petCtx(q('frostpup', { here: 'rime', foe: 'aether' })), petPow(8, q('frostpup', { here: 'rime', foe: 'aether' }))];
          out.notFoe = petCtx(q('frostpup', { foe: 'tide' }));
          RUN.clock = 4 * MOON_EVERY; out.moon = petCtx(q('hootling')); window.SKY_OFF = true; out.skyOff = petCtx(q('hootling')); window.SKY_OFF = false;
          out.all = petPow(8, q('frostpup', { here: 'rime', foe: 'aether' }));
          RUN.clock = 0; out.imp = petCtx(q('imp'));
          out.data = Object.keys(PETS).filter(k => !(PETS[k].sports || []).length || (PETS[k].sports || []).some(s => !SPORTS[s]) || (PETS[k].moon || []).some(i => !MOON[i]));
          out.beats = Object.keys(PET_BEATS).every(e => PET_BEATS[PET_BEATS[e]] !== e || ['aether', 'rime'].includes(e));
          return out; })()""")
        check(c['none'] == [[], 8] and c['sport'] == [['sport'], 10] and c['home'] == [['sport', 'home'], 12] and c['foe'] == [['sport', 'home', 'foe'], 14], 'each thing that suits a pet makes it 25% stronger: its sport, its ground, a foe it beats', c)
        check(c['notFoe'] == ['sport'] and c['moon'] == ['moon'] and c['skyOff'] == [] and c['all'] == 16 and c['imp'] == ['moon'], 'one of its moons counts (the Full Moon for the Hootling and the Frostpup, the New Moon for the Imp); a foe it doesn\'t beat doesn\'t', c)
        check(c['data'] == [] and c['beats'], 'every pet has its sports, and its moons are real phases', c)

        ev = await pg.evaluate("""(() => { const seen = []; onHook('highlight', id => seen.push('hl:' + id)); onHook('score', a => seen.push('score:' + a.side));
          RUN.clock = 1; RUN.pet = { kind: 'axebeak', name: 'Peck', bond: 1 }; beginFight({ ids: ['skelss'], type: 'normal', sport: 'football' });
          const s0 = sv(B.P, 'str'); scoreUs(7, 'touchdown'); const s1 = sv(B.P, 'str'); scoreUs(7, 'touchdown'); const s2 = sv(B.P, 'str'); scoreThem(3); addHL(Object.keys(HL_NAME)[0]);
          return { seen, str: [s0, s1, s2] }; })()""")
        check('score:0' in ev['seen'] and 'score:1' in ev['seen'] and any(s.startswith('hl:') for s in ev['seen']), 'the new moments fire: a score (both sides) and a highlight', ev)
        check(ev['str'][1] - ev['str'][0] >= 1 and ev['str'][2] == ev['str'][1], 'the Axebeak\'s first touchdown in football gives Strength, once a fight', ev)

        rk = await pg.evaluate("""(async () => { const q = wPetAdd('hootling', 'keeper:moss'); wPetSide(q.id); RUN.hp = 999; RUN.maxhp = 999; WG.grace = 99;
          startMatch({ ids: ['skelss'], type: 'normal', tier: 1, card: false, sport: 'golf', world: { kind: 'wild', region: 'bloom' } });
          await new Promise(r => { const f = () => (UI.view === 'fight' && B && B.pet) ? r() : setTimeout(f, 20); f(); });
          const out = { here: B.pet.here, foe: B.pet.foe, ctx: petCtx(B.pet) };
          renderFightHUD(); const tip = document.querySelector('#petBox .petbadge').dataset.tip; out.tip = /Suits it today/.test(tip) && /its sport/.test(tip) && /home ground/.test(tip);
          const snap = JSON.parse(JSON.stringify(B)); out.saved = snap.pet.here === 'bloom' && snap.pet.foe === 'bloom';
          for (const e of B.enemies) { e.hp = 0; e.dead = true; } B.over = 'win'; consumeFx(); renderFightHUD(); finishFight(); return out; })()""")
        check(rk['here'] == 'bloom' and rk['foe'] == 'bloom' and rk['ctx'] == ['sport', 'home'] and rk['saved'], 'in the Realm the pet learns its ground and foe at kickoff (the region\'s element); the battle\'s state keeps them', rk)
        check(rk['tip'], 'the battle tooltip says what suits it today', rk)
        await pg.wait_for_function("UI.view !== 'fight'", timeout=15000)
        await pg.evaluate(ESC)

        tab = await pg.evaluate("""(async () => { wOpenCamp('pets'); await new Promise(r => { const f = () => document.querySelector('#wCampBody .wpetctx') ? r() : setTimeout(f, 20); f(); });
          const t = [...document.querySelectorAll('#wCampBody .wpetctx')].map(x => x.textContent).join(' | '); """ + ESC + """ return { golf: /Stronger in Golf/.test(t), moon: /Full Moon/.test(t), beats: /against Tide teams/.test(t) }; })()""")
        check(tab == {'golf': True, 'moon': True, 'beats': True}, 'the Pets tab says what suits each pet', tab)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpPetCtx'); return !!h && ['sports', 'moons', 'region', 'ember beats bloom', '25%'].every(w => h.textContent.includes(w)); })()")
        check(hp, 'How to play explains pets in context', hp)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
