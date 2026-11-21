# Realm pets (issue #104, phase 5): bond and treats. A card match won with a pet at your side gives it a bond point
# (fightWon); at 6 points it reaches bond 2, at 16 bond 3, and the battle's RUN.pet follows; a level reached says what
# it opens. Bond never goes down; a hungry pet's doesn't grow. Treats: its favourite gives 3 points and a pet biscuit 1,
# once a day each; any treat feeds a hungry pet; it won't eat anything else. Every pet's favourite is a real item. The
# Pets tab shows bond points and the favourite, and gives treats; the pet shops sell biscuits. A real card match won in
# the world grows the bond. How to play explains. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wPetTreat === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        w = await pg.evaluate("""(() => { const q = wPetAdd('hootling', 'keeper:moss'), out = {};
          fire('fightWon'); out.one = q.xp;
          const A = W_PBOND.at; q.xp = A[2] - 1; fire('fightWon'); out.two = [q.bond, RUN.pet.bond, /grows to 2 of 3/.test(WLOG.map(l => l[0]).join(' ')), /Now:/.test(WLOG[WLOG.length - 1][0])];
          q.xp = A[3] - 1; fire('fightWon'); out.three = [q.bond, RUN.pet.bond]; q.xp = 99; fire('fightWon'); out.cap = q.bond;
          q.bond = 1; q.xp = 0; q.hungry = true; fire('fightWon'); out.hungry = q.xp; q.hungry = false;
          // (no pet at your side: nothing, and nothing thrown)
          const side = wPets().side; wPets().side = null; wPetSync(); fire('fightWon'); out.none = q.xp; wPets().side = side; wPetSync();
          return out; })()""")
        check(w['one'] == 1, 'a card match won with a pet at your side gives it a bond point', w)
        check(w['two'] == [2, 2, True, True] and w['three'] == [3, 3] and w['cap'] == 3, 'at its points bond 2, then bond 3 (W_PBOND.at; the battle follows; it says what each opens); never past 3', w)
        check(w['hungry'] == 0 and w['none'] == 0, 'a hungry pet\'s bond doesn\'t grow; no pet at your side, nothing', w)
        t = await pg.evaluate("""(() => { const q = wPets().owned.find(x => x.kind === 'hootling'), out = {}; q.xp = 0; q.bond = 1; q.treat = null;
          out.fav = W_PBOND.fav_of.hootling; wAddItem('mossberry', 2); wAddItem('pettreat', 2); wAddItem('jerky', 1);
          out.no = wPetTreat(q.id, 'jerky') !== '' && wHas('jerky');
          q.hungry = true; wPetTreat(q.id, 'mossberry'); out.first = [q.xp, q.hungry]; q.hungry = true; wPetTreat(q.id, 'pettreat'); out.second = [q.xp, q.hungry, WG.items.pettreat];
          const keep = WG.items.mossberry || 0; out.useless = wPetTreat(q.id, 'mossberry') !== '' && (WG.items.mossberry || 0) === keep;
          // (let go and had back the same day: still treated today)
          wPetLetGo(q.id); wPetReclaim(WG.petAway.findIndex(a => a.kind === 'hootling')); const q2 = wPets().owned.find(x => x.kind === 'hootling'); out.kept = wPetTreat(q2.id, 'mossberry') !== '' && q2.xp === 3; wPetSide(q2.id);
          WG.dayAbs++; wPetTreat(q2.id, 'pettreat'); out.next = q2.xp; out.none = wPetTreat(q2.id, 'pettreat') !== '';
          wAddItem('pettreat', 1); WG.dayAbs++; q2.hungry = true; wPetSync(); RUN.gold = 500; B = { over: null }; UI.view = 'fight';
          out.busy = wPetTreat(q2.id, 'pettreat') === 'Not during a match.' && wPetFeed(q2.id) === 'Not during a match.' && RUN.pet.hungry === true && wPetTreatsFor(q2).length === 0 && !/data-petfeed/.test(wPetCard(q2, true));
          B = null; UI.view = 'world'; q2.hungry = false; wPetSync();
          out.items = Object.keys(PETS).filter(k => !DB.items[W_PBOND.fav_of[k]]); return out; })()""")
        check(t['useless'] and t['kept'] and t['busy'], 'a treat that would do nothing isn\'t given (the item kept), letting go doesn\'t reset the day, and not to the pet at your side mid-match', t)
        check(t['no'] and t['first'] == [3, False] and t['second'] == [3, False, 1] and t['next'] == 4 and t['none'], 'its favourite gives 3 points, a biscuit 1, once a day each; any treat feeds a hungry pet; it won\'t eat anything else', t)
        check(t['items'] == [], 'every pet\'s favourite is a real item', t)
        tab = await pg.evaluate("""(async () => { const q = wPets().owned.find(x => x.kind === 'hootling'); wAddItem('mossberry', 1); WG.dayAbs++; const x0 = q.xp;
          wOpenCamp('pets'); await new Promise(r => { const f = () => document.querySelector('#wCampBody .wpetbond') ? r() : setTimeout(f, 20); f(); });
          const card = document.querySelector('#wCampBody [data-petid="' + q.id + '"]'), txt = card.textContent;
          card.querySelector('[data-pettreat][data-item="mossberry"]').click();
          const r = { points: /Bond points/.test(txt), fav: /favourite: Mossberry/.test(txt), gave: q.xp - x0, open: !!document.getElementById('wCampBody') }; """ + ESC + """ return r; })()""")
        check(tab == {'points': True, 'fav': True, 'gave': 3, 'open': True}, 'the Pets tab shows bond points and the favourite, and gives a treat', tab)
        sh = await pg.evaluate("""(() => { WG.flags.q_petshop_salt = 1; RUN.gold = 50; const n0 = WG.items.pettreat || 0; wPshopOpen('salt'); const bb = document.querySelector('#modalBox [data-psbisc]'); bb.focus(); bb.click(); bb.click();
          const focused = document.activeElement === bb && document.body.contains(bb);
          const inplace = document.getElementById('wPshopGold').textContent === 'Gold: ' + RUN.gold + '.' && document.getElementById('wBiscN').textContent === String(WG.items.pettreat);
          // (bought down to under a biscuit's price: what it can't afford turns off)
          const paid = 50 - RUN.gold; RUN.gold = 9; bb.click(); const third = 9 - RUN.gold; const off = bb.disabled && [...document.querySelectorAll('#modalBox [data-psbuy]')].every(b => b.disabled);
          // (two bought: one Escape closes the window, and leaves no other behind)
          let drains = 0; const d0 = wDrain; wDrain = function () { drains++; return d0.apply(this, arguments); }; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const closed = document.getElementById('modal').hidden; modal('<p>x</p>'); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); wDrain = d0;
          return { got: (WG.items.pettreat || 0) - n0 - 1, paid, third, closed, drains, focused, inplace, off }; })()""")
        check(sh == {'got': 2, 'paid': 16, 'third': 8, 'closed': True, 'drains': 1, 'focused': True, 'inplace': True, 'off': True}, 'the pet shops sell pet biscuits, the window open between buys, with no listener left behind', sh)

        # (a real card match in the world, won: the bond point comes)
        await pg.evaluate("(() => { const q = wPets().owned.find(x => x.kind === 'hootling'); wPetSide(q.id); q.xp = 0; q.bond = 1; q.hungry = false; wPetSync(); RUN.hp = 999; RUN.maxhp = 999; WG.grace = 99; startMatch({ ids: ['skelss'], type: 'normal', tier: 1, card: false, sport: 'baseball', world: { kind: 'wild', region: 'plains' } }); })()")
        await pg.wait_for_function("UI.view === 'fight' && B && B.pet", timeout=15000)
        await pg.evaluate("(() => { for (const e of B.enemies) { e.hp = 0; e.dead = true; } B.over = 'win'; consumeFx(); renderFightHUD(); finishFight(); })()")
        await pg.wait_for_function("(wPets().owned.find(x => x.kind === 'hootling') || {}).xp >= 1", timeout=15000)
        check(True, 'a real card match won in the world grows the bond')

        await pg.evaluate(ESC + " showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpPetBond'); return !!h && ['favourite', 'biscuit', 'once a day', 'never goes down'].every(w => h.textContent.includes(w)); })()")
        check(hp, 'How to play explains bond and treats', hp)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
