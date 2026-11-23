"""Umbral screenshots (issue #99, phase 8's visual pass): each Umbral screen staged through the game's own functions,
at desktop (1280 x 900) and phone (400 x 860) width, into /tmp/umbral-shots/, with a contact sheet a width.

  python3 test/realm_umbral_shots.py            every shot
  python3 test/realm_umbral_shots.py scene card only the shots named

Not a check (it asserts nothing but prints what failed to stage and any page errors); the visual pass reads the sheets.
Shots: scene (the Crown scene, mid-speech), sceneend (its last word), herald, world (the dark world by a lantern; the
world map draws as open sea in headless Chromium, on main too, so judge it in a real browser),
town (a dark town), ground (a dark ground at the champion's end), card (a champion's game card, with a condition),
gate (the Gatekeeper's match card), fight (an Umbral card match), journal (its Umbral chapter), help (How to play's
Umbral section), quick (the Quick start's hexes), seal (the Seal's end scene)."""
import asyncio, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

OUT = '/tmp/umbral-shots'
WIDTHS = {'desk': (1280, 900), 'phone': (400, 860)}
CLOSE = "for (let i = 0; i < 8 && !document.getElementById('modal').hidden; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.getElementById('modal').hidden = true; if (typeof closePause === 'function') closePause(); if (typeof showPage === 'function') showPage('play');"
SETUP = """wSetFlag('champion'); const U = WG.umbral; U.seen = WG.dayAbs; U.guards = {}; U.gates = {}; RUN.gold = 9999; RUN.hp = RUN.maxhp;
  for (const id in W_NADIR) { const C = W_NADIR[id]; if (C.ground) { U.guards[C.ground + ':0'] = U.guards[C.ground + ':1'] = 1; U.gates[id] = 1; } } WG.min = 23 * 60; 0"""
# each shot: JS run after closing whatever is open; the page is captured once it settles
SHOTS = {
  'scene': ("WUS.speed = 1; wUmbScene(true); 0", 5200),
  'sceneend': ("WUS.speed = 40; wUmbScene(true); 0", 1800),
  'herald': ("wEnterMap('coliseum', MAPS.coliseum.spawn[0], MAPS.coliseum.spawn[1]); const c = DB.chars.uherald; if (c && c.at) { WG.x = c.at[0]; WG.y = c.at[1] + 1; } wSay('uherald', ''); 0", 600),
  'world': ("const w = MAPS['u:world'], k = Object.keys(w.meta).find(k => w.meta[k].lantern).split(',').map(Number); wEnterMap('u:world', k[0], k[1] + 1); WG.min = 22 * 60; 0", 700),
  'town': ("const m = MAPS['u:graftonbury']; wEnterMap('u:graftonbury', m.spawn[0], m.spawn[1]); 0", 700),
  'ground': ("const C = W_NADIR.gridiron, m = MAPS[C.map], at = Object.keys(m.meta || {}).find(k => (m.meta[k] || {}).npc === C.char); let x = m.spawn[0], y = m.spawn[1]; if (at) { [x, y] = at.split(',').map(Number); y += 2; } wEnterMap(C.map, x, y); 0", 700),
  'card': ("WG.map = W_NADIR.diamond.map; wNadirMatch('diamond'); 0", 600),
  'gate': ("WG.map = 'u:umbralden'; wNadirMatch('gate'); 0", 600),
  'fight': ("WG.map = 'u:umbralden'; const keep = beginFight; beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); }; try { delete WG.umbral.guards['g_bowl:0']; wUmbGuardMatch('g_bowl', 0); } finally { beginFight = keep; } 0", 1200),
  'journal': ("wOpenJournal('umbral'); 0", 600),
  'help': ("showPage('help'); const h = document.getElementById('wHelpUmbral'); if (h) h.scrollIntoView(); 0", 600),
  'quick': ("showPage('help'); const t = document.querySelector('#wQuick [data-wq=\"umbral\"]'); if (t) { t.click(); t.scrollIntoView(); } 0", 600),
  'seal': ("WG.umbral.pieces = Object.keys(W_UMB_PIECES); wUmbSealScene(); 0", 2500),
}

async def main():
    want = sys.argv[1:] or list(SHOTS)
    os.makedirs(OUT, exist_ok=True)
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    bad = []
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for wn, (w, h) in WIDTHS.items():
            pg = await br.new_page(viewport={'width': w, 'height': h})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
            await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbScene === 'function'")
            await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
            await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
            if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
            await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
            await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
            await pg.evaluate("LAB = true; for (const k of ['goblin', 'dwarf', 'ogre', 'elf', 'troll']) wRecruit({ kind: k, lvl: 6 }, 'tavern'); LAB = false; " + SETUP)
            for k in want:
                js, wait = SHOTS[k]
                try:
                    await pg.evaluate(CLOSE + "\n" + SETUP)
                    await pg.evaluate("(() => { " + js + " })()")
                    await pg.wait_for_timeout(wait)
                    await pg.screenshot(path=f'{OUT}/{wn}-{k}.png')
                    ov = await pg.evaluate("(() => { const d = document.documentElement, mb = document.getElementById('modalBox'); return { page: d.scrollWidth - innerWidth, modal: mb && !document.getElementById('modal').hidden ? mb.scrollWidth - mb.clientWidth : 0 }; })()")
                    if ov['page'] > 1 or ov['modal'] > 1: bad.append(f'{wn}-{k}: scrolls sideways {ov}')
                except Exception as e:
                    bad.append(f'{wn}-{k}: {str(e)[:200]}')
            if errs: bad.append(f'{wn} page errors: {errs[:3]}')
            await pg.close()
        # contact sheets, made by the browser (no image library): a grid of the shots, a sheet a width
        for wn in WIDTHS:
            got = [k for k in want if os.path.exists(f'{OUT}/{wn}-{k}.png')]
            if not got: continue
            tw, cols = (420, 4) if wn == 'desk' else (190, 7)
            html = '<body style="margin:0;background:#282828;display:grid;grid-template-columns:repeat(%d,%dpx);gap:4px;font:11px sans-serif;color:#ccc">' % (cols, tw)
            html += ''.join(f'<div><img src="file://{OUT}/{wn}-{k}.png" style="width:{tw}px;display:block">{k}</div>' for k in got)
            open(f'{OUT}/sheet-{wn}.html', 'w').write(html)
            sp = await br.new_page(viewport={'width': cols * (tw + 4), 'height': 400})
            await sp.goto(f'file://{OUT}/sheet-{wn}.html'); await sp.wait_for_timeout(300)
            await sp.screenshot(path=f'{OUT}/sheet-{wn}.png', full_page=True); await sp.close()
        await br.close()
    print('shots in', OUT, '| order:', ' '.join(want))
    print('problems:', bad or 'none')

asyncio.run(main())
