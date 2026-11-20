# Realm pets (issue #104, phase 3): pet eggs. Every egg pet has its egg's spot, and every element its hatching place,
# on the maps. An alpha's egg can't be taken while the alpha stands; the Cockatrice's only after dark; each once a
# journey. A hatching place takes an egg of its element only, one at a time; after its days it hatches as you walk in,
# and you name the pet, which goes into the kennel (from its hatching place). At a full kennel the pet waits there,
# can still be named, and can be taken back there for nothing once there is room. The tiles show an egg or not. Pell
# has a PETS topic; How to play explains pet eggs; the save keeps an egg in a place. Screenshots of the five places go
# to /tmp. Asserts; exits nonzero on failure.
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
# (the spot of a tile on a map: [x, y])
FIND = "const find = (mid, ch, key, v) => { const m = MAPS[mid]; for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (m.t[y][x] === ch && m.meta[k][key] === v) return [x, y]; } return null; };"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wPeggOpen === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        sp = await pg.evaluate("(() => { " + FIND + " return { eggs: Object.keys(PETS).filter(k => PETS[k].how === 'egg').filter(k => !W_PEGG.eggs[k] || !find(W_PEGG.eggs[k].map, W_PEGG_CH.egg, 'petegg', k)), places: Object.keys(W_PEGG.places).filter(el => !find(W_PEGG.places[el].map, W_PEGG_CH.hatch, 'pethatch', el)), audit: wAudit().filter(s => /pet|egg|hatch/.test(s)) }; })()")
        check(sp == {'eggs': [], 'places': [], 'audit': []}, 'every egg pet has its egg\'s spot, and every element its hatching place, on the maps', sp)

        tk = await pg.evaluate("""(() => { """ + FIND + """
          const use = (mid, k) => { const at = find(mid, W_PEGG_CH.egg, 'petegg', k); WG.map = mid; wUse(at[0], at[1]); return wHas(wPeggItem(k)); };
          const v = (mid, k) => { const at = find(mid, W_PEGG_CH.egg, 'petegg', k); return wTileVariant(MAPS[mid], at[0], at[1], W_PEGG_CH.egg); };
          const out = { v0: v('genevault', 'pseudodragon') };
          out.alphaUp = use('genevault', 'pseudodragon'); wSetFlag('alpha_vaultwarden'); const inv0 = wInvalidate; let inv = 0; wInvalidate = function () { inv++; return inv0.apply(this, arguments); }; out.alphaDown = use('genevault', 'pseudodragon'); wInvalidate = inv0; out.redrawn = inv > 0; out.v1 = v('genevault', 'pseudodragon');
          wAddItem(wPeggItem('pseudodragon'), -1); out.again = use('genevault', 'pseudodragon');
          WG.min = 12 * 60; out.day = use('umbralden', 'cockatrice'); WG.min = 23 * 60; out.night = use('umbralden', 'cockatrice');
          out.sprite = use('hollowshrine', 'sprite');
          wAddItem(wPeggItem('pseudodragon'), 1); WG.map = 'graftonbury'; return out; })()""")
        check(tk['alphaUp'] is False and tk['alphaDown'] is True and tk['again'] is False, 'an alpha\'s egg can\'t be taken while the alpha stands, then can, once a journey', tk)
        check(tk['day'] is False and tk['night'] is True and tk['sprite'] is True, 'the Cockatrice\'s egg only after dark; a quiet corner\'s egg any time', tk)
        check(tk['v0'] == '1' and tk['v1'] == '0' and tk['redrawn'], 'the nest shows its egg until it is taken, and the map redraws then', tk)

        pl = await pg.evaluate("""(() => { """ + FIND + """
          const at = find('graftonbury', W_PEGG_CH.hatch, 'pethatch', 'aether'); WG.map = 'graftonbury'; wUse(at[0], at[1]);
          const box = document.getElementById('modalBox'), btns = [...box.querySelectorAll('[data-pegg]')].map(b => b.dataset.pegg), other = /hatch elsewhere/.test(box.textContent);
          box.querySelector('[data-pegg="pseudodragon"]').click();
          const r = { btns, other, closed: document.getElementById('modal').hidden, egg: JSON.parse(JSON.stringify(WG.petEggs.aether || null)), held: wHas(wPeggItem('pseudodragon')), v: wTileVariant(MAPS.graftonbury, at[0], at[1], W_PEGG_CH.hatch) };
          wAddItem(wPeggItem('pseudodragon'), 1); r.second = wPeggPlace('aether', 'pseudodragon'); r.wrong = wPeggPlace('bloom', 'pseudodragon'); wAddItem(wPeggItem('pseudodragon'), -1);
          wUse(at[0], at[1]); r.due = /due in 3 days/.test(document.getElementById('modalBox').textContent); """ + ESC + """ return r; })()""")
        check(pl['btns'] == ['pseudodragon'] and pl['other'] and pl['closed'] and pl['egg'] and pl['egg']['kind'] == 'pseudodragon' and not pl['held'] and pl['v'] == 'aether1', 'the glasshouse takes an aether egg (and says where the others hatch): it goes in, and shows', pl)
        check(pl['second'] != '' and pl['wrong'] != '' and pl['due'], 'one egg at a time, of its element only; it says when it is due', pl)

        await pg.evaluate("WG.dayAbs += 3")
        ht = await pg.evaluate("""(async () => { """ + FIND + """
          const at = find('graftonbury', W_PEGG_CH.hatch, 'pethatch', 'aether'); wUse(at[0], at[1]);
          const inp = document.getElementById('wHatchName'); const scene = !!inp && /It hatched/.test(document.getElementById('modalBox').textContent);
          inp.value = ''; document.getElementById('wHatchOk').click(); const emptySaid = !document.getElementById('wHatchWhy').hidden && !document.getElementById('modal').hidden;
          inp.value = 'Puff'; document.getElementById('wHatchOk').click();
          const q = wPets().owned.find(x => x.kind === 'pseudodragon');
          return { emptySaid, longest: Object.values(PETS).every(d => d.n.length <= W_PET.nameMax), scene, name: q && q.name, from: q && q.from, empty: !WG.petEggs.aether, side: wPetSideOf() && wPetSideOf().name, closed: document.getElementById('modal').hidden }; })()""")
        check(ht == {'emptySaid': True, 'longest': True, 'scene': True, 'name': 'Puff', 'from': 'hatch:aether', 'empty': True, 'side': 'Puff', 'closed': True}, 'after its days it hatches as you walk in: you name it (an empty name says so; every default name fits), and it joins the kennel (at your side, the first)', ht)

        fu = await pg.evaluate("""(async () => { """ + FIND + """
          for (const k of ['blinkpup', 'axebeak', 'hootling', 'chestnut', 'jellycube']) wPetAdd(k, 'shop:x');
          WG.petEggs.bloom = { kind: 'sprite', due: WG.dayAbs }; wAddItem(wPeggItem('sprite'), -1);
          const at = find('mossgate', W_PEGG_CH.hatch, 'pethatch', 'bloom'); WG.map = 'mossgate'; wUse(at[0], at[1]);
          const waitsSaid = /wait here/.test(document.getElementById('modalBox').textContent); const inp = document.getElementById('wHatchName'); inp.value = 'Jarvis'; document.getElementById('wHatchOk').click();
          const away = WG.petAway.find(a => a.kind === 'sprite');
          // (the full-kennel question comes after the scene: closed, the Sprite stays waiting)
          await new Promise(res => { const t0 = Date.now(), w = () => document.getElementById('wPetFullWhy') || Date.now() - t0 > 3000 ? res() : setTimeout(w, 20); w(); }); const asked = !!document.getElementById('wPetFullWhy'); """ + ESC + """
          wUse(at[0], at[1]); const box = document.getElementById('modalBox'), btn = box.querySelector('[data-pegback]'), disabled = btn && btn.disabled; """ + ESC + """
          wPetLetGo(wPets().owned.find(x => x.kind === 'chestnut').id); const g0 = RUN.gold;
          wUse(at[0], at[1]); document.querySelector('#modalBox [data-pegback]').click();
          const back = wPets().owned.find(x => x.kind === 'sprite');
          return { waitsSaid, named: away && away.name, asked, disabled, back: back && back.name, free: RUN.gold === g0, still: WG.petAway.some(a => a.kind === 'sprite'), closed: document.getElementById('modal').hidden }; })()""")
        check(fu['waitsSaid'] and fu['named'] == 'Jarvis' and fu['asked'], 'at a full kennel a hatched pet waits at its hatching place, named all the same, and you\'re asked which one goes', fu)
        check(fu['disabled'] and fu['back'] == 'Jarvis' and fu['free'] and not fu['still'] and fu['closed'], 'there you can take it back for nothing, once there is room', fu)

        sv = await pg.evaluate("""(() => { WG.petEggs.ember = { kind: 'imp', due: WG.dayAbs + 2 }; wSave(); const save = JSON.parse(JSON.stringify({ WG, RUN })); wStart(save); return JSON.parse(JSON.stringify(WG.petEggs.ember || null)); })()""")
        check(sv and sv['kind'] == 'imp', 'the save keeps an egg in its place', sv)
        pe = await pg.evaluate("(() => { const P = DB.chars.pell; return { job: /PETS/.test(P.topics.job.t), topic: !!(P.topics.pets && /glasshouse/.test(P.topics.pets.t)) }; })()")
        check(pe == {'job': True, 'topic': True}, 'Dr. Pell has a PETS topic', pe)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpPetEggs'); return !!h && ['glasshouse', 'warm spring', 'rock pool', 'forge', 'ice-house', 'after dark'].every(w => h.textContent.includes(w)); })()")
        check(hp, 'How to play explains pet eggs', hp)
        await pg.evaluate("showPage('play')")

        # (the five places, drawn: each with an egg in it)
        for el in ['aether', 'bloom', 'tide', 'ember', 'rime']:
            await pg.evaluate("(() => { " + FIND + " const P = W_PEGG.places['" + el + "'], at = find(P.map, W_PEGG_CH.hatch, 'pethatch', '" + el + "'); WG.petEggs['" + el + "'] = { kind: Object.keys(W_PEGG.eggs).find(k => PETS[k].el === '" + el + "'), due: WG.dayAbs + 9 }; wEnterMap(P.map, at[0], at[1] + 1); wDrain(); })()")
            await pg.wait_for_function("document.getElementById('modal').hidden && UI.view === 'world'")
            await pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            await pg.screenshot(path=f'/tmp/pets_hatch_{el}.png')

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
