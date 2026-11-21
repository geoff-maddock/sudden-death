# Realm pets (issue #104, phase 7): rivals' special pets. Every rival club has its own pet, and none can be hatched
# or bought. A club's match (a road meeting or a cup round) brings it across the table, with the match's tier as its
# skill; any other match has none. Its trait works from the start, its power on its moments, and its trick once a
# match: a skilled side waits until it hurts, a green one doesn't wait. Your pet answers it (the Rustnibbler eats its
# Block, the Jellycube swallows its debuff), and some tricks spook your pet. The match card says what it brings; the
# HUD shows it; a mid-fight save keeps it; How to play explains. Asserts; exits nonzero on failure.
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
# (a fight with a rival pet, and maybe a pet of yours, set up directly)
H = """window.__rv = (foe, skill, pet, ids) => { LAB = true; RUN.clock = 1 * MOON_EVERY; RUN.pet = pet ? { kind: pet, name: pet, bond: 1 } : null; RUN.foePet = foe ? { kind: foe, skill: skill || 3 } : null; RUN.hp = RUN.maxhp = 999; startCombat(ids || ['skelss', 'thief'], 'normal', 'baseball'); return B; }; 0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof FOE_PETS !== 'undefined' && typeof wRivalPetOf === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(H)

        d = await pg.evaluate("""({ clubs: CLUB_IDS.filter(c => !W_RIVAL_PET[c]), extra: Object.keys(FOE_PETS).filter(k => !CLUBS[FOE_PETS[k].club]), owned: Object.keys(FOE_PETS).filter(k => PETS[k]),
          parts: Object.keys(FOE_PETS).filter(k => { const F = FOE_PETS[k]; return !(F.n && F.trait && F.trait.d && F.power && F.power.d && F.trick && F.trick.n && F.trick.go); }) })""")
        check(d == {'clubs': [], 'extra': [], 'owned': [], 'parts': []}, 'every rival club has its own pet (a trait, a power, a trick), and none can be hatched or bought', d)

        k = await pg.evaluate("""(async () => { const out = {}; RUN.hp = RUN.maxhp = 999; WG.grace = 99;
          const play = async (o) => { startMatch(Object.assign({ ids: ['skelss'], type: 'normal', card: false, sport: 'baseball' }, o)); await new Promise(r => { const f = () => (UI.view === 'fight' && B && !B.over) ? r() : setTimeout(f, 20); f(); });
            const fp = B.foePet ? { kind: B.foePet.kind, skill: B.foePet.skill } : null; for (const e of B.enemies) { e.hp = 0; e.dead = true; } B.over = 'win'; consumeFx(); renderFightHUD(); finishFight();
            await new Promise(r => { const f = () => UI.view !== 'fight' ? r() : setTimeout(f, 20); f(); }); """ + ESC + """ return fp; };
          out.road = await play({ tier: 2, world: { kind: 'event', ref: { rival: 'ironmaw' }, region: 'plains' } });
          out.wild = await play({ tier: 1, world: { kind: 'wild', region: 'plains' } });
          return out; })()""")
        check(k == {'road': {'kind': 'wyvern', 'skill': 2}, 'wild': None}, 'a club\'s match brings its pet (the tier as its skill); any other match has none', k)

        t = await pg.evaluate("""(() => { const out = {};
          __rv('wyvern', 3); const lead = foeLead(); out.trait = sv(lead, 'str');
          B.P.block = 99; B.turn = 1; fire('turnEnd'); out.wait = B.foePet.used;
          B.P.block = 0; const h0 = RUN.hp; fire('turnEnd'); out.used = B.foePet.used; out.hit = h0 - RUN.hp; out.weak = sv(B.P, 'weak');
          B.foePet.used = true; B.turn = 3; B.P.block = 0; const h1 = RUN.hp; fire('turnEnd'); out.power = h1 - RUN.hp;
          // (a green side throws it whenever: here on turn 1, whatever the Block)
          const r0 = R; R = () => 0; __rv('griffon', 1, 'blinkpup'); B.P.block = 99; B.turn = 1; fire('turnEnd'); out.green = B.foePet.used; out.spooked = B.pet.spooked; R = r0;
          const snap = JSON.parse(JSON.stringify(B)); out.saved = !!snap.foePet && snap.foePet.used === true;
          return out; })()""")
        check(t['trait'] >= 2 and t['wait'] is False and t['used'] is True and t['hit'] > 0 and t['weak'] >= 1, 'a skilled side waits for its trick until it hurts (the Wyvern\'s Venom Sting with your Block down); its trait works from the start', t)
        check(t['power'] == 4 and t['green'] and t['spooked'] and t['saved'], 'its power on its moment (every third turn); a green side throws its trick whenever; the Griffon\'s Dive spooks your pet; the battle\'s state keeps it', t)

        a = await pg.evaluate("""(() => { const out = {};
          __rv('shrieker', 3, null); out.blockNo = alive().map(e => e.block);
          __rv('shrieker', 3, 'rustnibbler'); out.blockRust = alive().map(e => e.block);
          __rv('wisp', 3, null); out.weakNo = sv(B.P, 'weak');
          __rv('wisp', 3, 'jellycube'); out.weakJelly = sv(B.P, 'weak');
          return out; })()""")
        check(sum(a['blockRust']) < sum(a['blockNo']) and a['weakJelly'] < a['weakNo'], 'your pet answers it: the Rustnibbler eats the Block it gives, the Jellycube swallows its debuff', a)

        ui = await pg.evaluate("""(async () => { LAB = false; const enc = wBuildEncounter({ ids: ['skelss'], type: 'normal', tier: 1, sport: 'baseball', world: { kind: 'event', ref: { rival: 'frostfang' }, region: 'rime' } });
          wPreGame(enc); const card = document.querySelector('#modalBox .wrivalpet'), out = { card: !!card && /Remorhaz Grub/.test(card.textContent) && /Searing Coil/.test(card.textContent) };
          document.getElementById('wPlay').click(); await new Promise(r => { const f = () => (UI.view === 'fight' && B) ? r() : setTimeout(f, 20); f(); });
          const box = document.getElementById('foePetBox'); out.hud = !!box && /Remorhaz/.test(box.textContent) && /trick ready/.test(box.textContent);
          for (const e of B.enemies) { e.hp = 0; e.dead = true; } B.over = 'win'; consumeFx(); renderFightHUD(); finishFight(); return out; })()""")
        check(ui == {'card': True, 'hud': True}, 'the match card says which pet the club brings and what it does; the HUD shows it in the match', ui)
        await pg.wait_for_function("UI.view !== 'fight'", timeout=15000)
        await pg.evaluate(ESC + " showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpPetRivals'); return !!h && ['Wyvern Hatchling', 'Griffon Chick', 'once a match', 'Rustnibbler'].every(w => h.textContent.includes(w)); })()")
        check(hp, 'How to play explains rivals\' pets', hp)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
