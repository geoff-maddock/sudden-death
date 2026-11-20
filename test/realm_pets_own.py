# Realm pets (issue #104, phase 2): owning pets. A new journey has an empty kennel and no pet in the battles. A pet
# added goes into the kennel and, the first, at your side: the card battle's RUN.pet follows it (its name, bond and
# hunger). You can own several (up to the kennel's size) but only one is at your side: change it, and RUN.pet follows;
# not during a match. A full kennel asks which one goes (the new one too). Let one go and it waits where it came from,
# and comes back when reclaimed. Rename one. Every week, as it turns, each pet's upkeep is paid; what can't be paid
# leaves pets hungry, the newest paid first (a hungry pet's numbers are halved in the battle), until fed. The
# Pets tab on the Team screen shows the kennel and its buttons; the pet at your side follows the team on the map (it
# is drawn); the save keeps it all; How to play explains pets. Asserts; exits nonzero on failure.
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

CLOSE = "(() => { for (let i = 0; i < 8 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); } })()"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wPetAdd === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        a = await pg.evaluate("""(() => { const out = { empty: wPets().owned.length, run0: RUN.pet };
          const p1 = wPetAdd('blinkpup', 'shop:hq'); out.first = { side: wPets().side === p1.id, run: JSON.parse(JSON.stringify(RUN.pet)) };
          const p2 = wPetAdd('hootling', 'keeper:moss'); out.second = { side: wPets().side === p1.id, n: wPets().owned.length };
          out.swap = [wPetSide(p2.id), RUN.pet.kind]; B = { over: null }; UI.view = 'fight'; out.busy = wPetSide(p1.id); B = null; UI.view = 'world';
          out.rename = [wPetRename(p2.id, 'Hoots <b>'), wPetOf(p2.id).name, RUN.pet.name];
          return out; })()""")
        check(a['empty'] == 0 and a['run0'] is None, 'a new journey has an empty kennel, and no pet in the battles', a)
        check(a['first']['side'] and a['first']['run'] == {'kind': 'blinkpup', 'name': 'Blinkpup', 'bond': 1, 'hungry': False}, 'the first pet goes at your side, and the battle\'s RUN.pet follows it', a['first'])
        check(a['second'] == {'side': True, 'n': 2} and a['swap'] == ['', 'hootling'] and a['busy'] != '', 'you can own several, one at your side: change it and the battle follows; not during a match', a)
        check(a['rename'][0] == '' and a['rename'][1] == 'Hoots b' and a['rename'][2] == 'Hoots b', 'rename one (no markup), and the battle follows', a['rename'])
        f = await pg.evaluate("""(async () => { for (const k of ['sprite', 'bogfrog', 'chestnut', 'jellycube']) wPetAdd(k, 'egg:x'); const n = wPets().owned.length;
          const r = wPetAdd('imp', 'egg:deepseam'); await new Promise(res => { const w = () => document.getElementById('modal').hidden ? setTimeout(w, 20) : res(); w(); }); const asked = !document.getElementById('modal').hidden;
          const keep = document.querySelector('#modalBox [data-petgo="' + wPets().owned[1].id + '"]'); if (keep) keep.click();
          return { n, r, asked, after: wPets().owned.length, imp: wPets().owned.some(q => q.kind === 'imp'), away: WG.petAway.map(a => a.kind) }; })()""")
        check(f['n'] == 6 and f['r'] and f['r']['waits'] and f['asked'] and f['after'] == 6 and f['imp'] and f['away'] == ['hootling'], 'a full kennel asks which one goes (here the Hootling): it waits where it came from, and the new one comes in', f)
        fc = await pg.evaluate("""(async () => { const n0 = WG.petAway.length; wPetAdd('glowbeetle', 'shop:cind'); await new Promise(res => { const w = () => document.getElementById('modal').hidden ? setTimeout(w, 20) : res(); w(); }); const asked = !document.getElementById('modal').hidden;
          const waitsAtOnce = WG.petAway.length - n0;
          // (closed with Escape, no choice made)
          document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return { asked, waitsAtOnce, waits: WG.petAway.length - n0, last: (WG.petAway[WG.petAway.length - 1] || {}).kind, kennel: wPets().owned.length }; })()""")
        check(fc['asked'] and fc['waitsAtOnce'] == 1 and fc['waits'] == 1 and fc['last'] == 'glowbeetle' and fc['kennel'] == 6, 'a full kennel\'s question closed without a choice: the new one waits where it came from, not lost', fc)
        ref = await pg.evaluate("""(async () => { const side = wPetSideOf(); wPetAdd('glowbeetle', 'shop:cind'); await new Promise(res => { const w = () => document.getElementById('modal').hidden ? setTimeout(w, 20) : res(); w(); }); B = { over: null }; UI.view = 'fight'; const b = document.querySelector('#modalBox [data-petgo="' + side.id + '"]'); b.click();
          const why = document.getElementById('wPetFullWhy'), r = { said: why && !why.hidden && /match/.test(why.textContent), open: !document.getElementById('modal').hidden, kennel: wPets().owned.length };
          const nb = [...document.querySelectorAll('#modalBox [data-petgo]')].pop(); nb.click(); B = null; UI.view = 'world'; r.after = wPets().owned.length; return r; })()""")
        check(ref == {'said': True, 'open': True, 'kennel': 6, 'after': 6}, 'the one at your side can\'t be let go in a match: the question says so and stays open, and the kennel never goes over', ref)
        # (the two Glowbeetles that went back are set aside, so the let-go check below counts only its own)
        await pg.evaluate("WG.petAway = WG.petAway.filter(a => a.kind !== 'glowbeetle')")
        # (two in a row at a full kennel: the second waits for the first question, and neither is lost)
        tw = await pg.evaluate("""(async () => { const n0 = WG.petAway.length, last = () => [...document.querySelectorAll('#modalBox [data-petgo]')].pop(), esc = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          const open = () => new Promise(res => { const w = () => document.getElementById('modal').hidden || !last() ? setTimeout(w, 20) : res(); w(); });
          wPetAdd('mephitling', 'egg:x'); wPetAdd('axebeak', 'egg:y');
          await open(); const firstAsk = last().textContent; last().click();
          await open(); const secondAsk = last().textContent; esc();
          // (a window that closes and opens another straight after doesn't bury the question, nor the question it)
          wPetAdd('hippogriff', 'egg:z'); modal('<p>one window</p>', () => wDrain()); esc(); modal('<p>another window</p>', () => wDrain());
          const t0 = W_PET_ASK.tries || 0; await new Promise(res => { const w = () => (W_PET_ASK.tries || 0) >= t0 + 2 ? res() : setTimeout(w, 20); w(); }); const kept = document.getElementById('modalBox').textContent.includes('another window'); esc();
          await open(); const thirdAsk = last().textContent; esc();
          const r = { firstAsk, secondAsk, kept, thirdAsk, waits: WG.petAway.slice(n0).map(x => x.kind), closed: document.getElementById('modal').hidden };
          WG.petAway = WG.petAway.filter(x => !['mephitling', 'axebeak', 'hippogriff'].includes(x.kind)); return r; })()""")
        check(tw['firstAsk'].startswith('Mephitling') and tw['secondAsk'].startswith('Axebeak') and tw['waits'] == ['mephitling', 'axebeak', 'hippogriff'] and tw['closed'], 'two at a full kennel in a row: one question at a time, and both wait where they came from', tw)
        check(tw['kept'] and 'Hippogriff' in tw['thirdAsk'], 'a window that closes and opens another at once keeps it, and the question comes after, not lost', tw)
        hr = await pg.evaluate("""(() => { const q = wPets().owned.find(x => x.kind === 'chestnut'); q.hungry = true; const got = q.got; wPetLetGo(q.id);
          wPetReclaim(WG.petAway.findIndex(a => a.kind === 'chestnut')); const b = wPets().owned.find(x => x.kind === 'chestnut'); const r = { back: !!b, hungry: b && b.hungry, got: b && b.got === got }; if (b) b.hungry = false; wPetSync(); return r; })()""")
        check(hr == {'back': True, 'hungry': True, 'got': True}, 'a hungry pet let go and reclaimed comes back hungry, and keeps the day it came', hr)
        g = await pg.evaluate("""(() => { const q = wPets().owned.find(x => x.kind === 'sprite'); const r = wPetLetGo(q.id); const away = WG.petAway.length; const back = wPetReclaim(WG.petAway.findIndex(a => a.kind === 'hootling'));
          return { r, away, back, has: wPets().owned.some(x => x.kind === 'hootling' && x.name === 'Hoots b'), left: WG.petAway.map(a => a.kind) }; })()""")
        check(g['r'] == '' and g['away'] == 2 and g['back'] == '' and g['has'] and g['left'] == ['sprite'], 'let one go and it waits where it came from; reclaimed, it comes back as it was (its name)', g)
        u = await pg.evaluate("""(() => { const P = wPets(); P.owned.forEach((q, k) => q.got = k + 1); const cost = P.owned.reduce((n, q) => n + W_PET.upkeep[PETS[q.kind].rar], 0); RUN.gold = cost + 5; const g0 = RUN.gold;
          WG.petWeek = wWeek() - 1; wNewDay(); const paid = g0 - RUN.gold, hungry0 = P.owned.filter(q => q.hungry).length;
          // (7 gold: the newest paid first, then each one still affordable; the rest hungry)
          RUN.gold = 7; WG.petWeek = wWeek() - 1; wNewDay(); const hungry = P.owned.filter(q => q.hungry).map(q => q.got), fed = P.owned.filter(q => !q.hungry).map(q => q.got);
          const oldestHungry = (() => { let g = 7; return P.owned.slice().sort((a, b) => b.got - a.got).every(q => { const c = W_PET.upkeep[PETS[q.kind].rar], pay = g >= c; if (pay) g -= c; return pay === !q.hungry; }); })();
          const side = wPetSideOf(); side.hungry = true; wPetSync(); const runHungry = RUN.pet.hungry;
          RUN.gold = 500; const fd = wPetFeed(side.id);
          // (a hungry pet whose upkeep is paid the next week eats: it isn't hungry any more)
          P.owned.forEach(q => q.hungry = true); RUN.gold = 9999; WG.petWeek = wWeek() - 1; wNewDay(); const ateAll = P.owned.every(q => !q.hungry);
          return { ateAll, paid, cost, hungry0, someHungry: hungry.length > 0, oldestHungry, runHungry, fd, after: wPetSideOf().hungry, runAfter: RUN.pet.hungry }; })()""")
        check(u['paid'] == u['cost'] and u['hungry0'] == 0, 'as the week turns, each pet\'s upkeep is paid', u)
        check(u['someHungry'] and u['oldestHungry'] and u['runHungry'], 'the newest are paid first, then each one still affordable; the rest go hungry, and the battle knows', u)
        check(u['fd'] == '' and u['after'] is False and u['runAfter'] is False and u['ateAll'], 'feeding a hungry pet (its upkeep) puts it right, and so does its upkeep paid the next week', u)
        await pg.evaluate("wOpenCamp('pets')"); await pg.wait_for_function("!!document.querySelector('#wCampBody .wpetc')")
        t = await pg.evaluate("""(async () => { const b = document.getElementById('wCampBody');
          return { tab: !!document.querySelector('#modalBox [data-ctab="pets"]'), cards: b.querySelectorAll('.wpetc').length, side: !!b.querySelector('[data-petside]'), name: !!b.querySelector('[data-petname]'), go: !!b.querySelector('[data-petletgo]'), upkeep: /gold a week/.test(b.textContent) }; })()""")
        check(t == {'tab': True, 'cards': 6, 'side': True, 'name': True, 'go': True, 'upkeep': True}, 'the Pets tab on the Team screen: the kennel, with At my side, Rename and Let go, and the week\'s upkeep', t)
        lg = await pg.evaluate("""(() => { const b = document.getElementById('wCampBody'), n = wPets().owned.length; b.querySelector('[data-petletgo]').click();
          const asked = !!b.querySelector('[data-petgoyes]'); b.querySelector('[data-petgoyes]').click();
          return { asked, open: !document.getElementById('modal').hidden && !!document.getElementById('wCampBody'), n: n - wPets().owned.length, said: /Waiting where/.test(document.getElementById('wCampBody').textContent) }; })()""")
        check(lg == {'asked': True, 'open': True, 'n': 1, 'said': True}, 'Let go on the Pets tab asks in its own row, and the Team screen stays open', lg)
        await pg.evaluate("wPetReclaim(WG.petAway.length - 1)")
        await pg.evaluate(CLOSE)
        mp = await pg.evaluate("""(() => { const acts = []; for (const f of W_ACTORS) f(acts, performance.now(), 0); return { pet: acts.some(a => typeof a.draw === 'function') }; })()""")
        check(mp == {'pet': True}, 'the pet at your side is drawn on the map, behind the team', mp)
        sv = await pg.evaluate("""(() => { wSave(); const save = JSON.parse(JSON.stringify({ WG, RUN })); const n = WG.pets.owned.length, side = WG.pets.side; wStart(save); return { n: wPets().owned.length === n, side: wPets().side === side, run: !!RUN.pet && RUN.pet.kind === wPetSideOf().kind }; })()""")
        check(sv == {'n': True, 'side': True, 'run': True}, 'the save keeps the kennel and the pet at your side, and the battle\'s pet follows on load', sv)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpPets'); return !!h && ['kennel', 'trick', 'spooks', 'upkeep', 'hungry'].every(w => h.textContent.includes(w)); })()")
        check(hp, 'How to play explains pets', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
