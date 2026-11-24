"""Umbral screenshots (issue #99, phase 8's visual pass): each Umbral screen staged through the game's own functions,
at desktop (1280 x 900) and phone (400 x 860) width, into /tmp/umbral-shots/, with a contact sheet a width.

  python3 test/realm_umbral_shots.py            every shot
  python3 test/realm_umbral_shots.py scene card only the shots named

Not a check (it asserts nothing but prints what failed to stage and any page errors); the visual pass reads the sheets.
Shots: scene (the Crown scene, mid-speech), sceneend (its last word), herald, world (the dark world by a lantern; the
world map draws as open sea in headless Chromium, on main too, so judge it in a real browser),
town (a dark town), ground (a dark ground at the champion's end), card (a champion's game card, with a condition),
gate (the Gatekeeper's match card), fight (an Umbral card match), journal (its Umbral chapter), help (How to play's
Umbral section), quick (the Quick start's hexes), seal (the Seal's end scene); from #111: dread (a stage's scene),
shadows (the dark world with spikes, pits and hungry shadows), gauntlet (a dark ground's railing and gate, shut),
legend and legendcard (the Corrupted Kraken on the dark world, and its match card), trophy (a dark shop's trophy list),
feat (a champion's card with its feat and the no-powers choice), sealpanel (the journal's Seal panel)."""
import asyncio, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

OUT = '/tmp/umbral-shots'
WIDTHS = {'desk': (1280, 900), 'phone': (400, 860)}
CLOSE = "for (let i = 0; i < 8 && !document.getElementById('modal').hidden; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.getElementById('modal').hidden = true; if (typeof closePause === 'function') closePause(); if (typeof showPage === 'function') showPage('play');"
SETUP = """wSetFlag('champion'); const U = WG.umbral; U.seen = WG.dayAbs; U.guards = {}; U.gates = {}; RUN.gold = 9999; RUN.hp = RUN.maxhp; U.pieces = []; U.well = {}; U.dreadSeen = 3; U.dreadScene = 0; U.shadows = [];
  for (const id in W_NADIR) { const C = W_NADIR[id]; if (C.ground) { U.guards[C.ground + ':0'] = U.guards[C.ground + ':1'] = 1; U.gates[id] = 1; } } WG.min = 23 * 60; 0"""
# each shot: JS run after closing whatever is open; the page is captured once it settles
SHOTS = {
  'scene': ("WUS.speed = 1; wUmbScene(true); 0", 5200),
  'sceneend': ("WUS.speed = 40; wUmbScene(true); 0", 1800),
  'herald': ("wEnterMap('coliseum', MAPS.coliseum.spawn[0], MAPS.coliseum.spawn[1]); const c = DB.chars.uherald; if (c && c.at) { WG.x = c.at[0]; WG.y = c.at[1] + 1; } wSay('uherald', ''); 0", 600),
  'world': ("const w = MAPS['u:world'], k = Object.keys(w.meta).find(k => w.meta[k].lantern).split(',').map(Number); wEnterMap('u:world', k[0], k[1] + 1); WG.min = 22 * 60; wDrain(); 0", 700),
  'town': ("const m = MAPS['u:graftonbury']; wEnterMap('u:graftonbury', m.spawn[0], m.spawn[1]); wDrain(); 0", 700),
  'ground': ("const C = W_NADIR.gridiron, m = MAPS[C.map], at = Object.keys(m.meta || {}).find(k => (m.meta[k] || {}).npc === C.char); let x = m.spawn[0], y = m.spawn[1]; if (at) { [x, y] = at.split(',').map(Number); y += 2; } wEnterMap(C.map, x, y); 0", 700),
  'card': ("WG.map = W_NADIR.diamond.map; wNadirMatch('diamond'); 0", 600),
  'gate': ("WG.map = 'u:umbralden'; wNadirMatch('gate'); 0", 600),
  'fight': ("WG.map = 'u:umbralden'; const keep = beginFight; beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); }; try { delete WG.umbral.guards['g_bowl:0']; wUmbGuardMatch('g_bowl', 0); } finally { beginFight = keep; } 0", 1200),
  'journal': ("wOpenJournal('umbral'); 0", 600),
  'help': ("showPage('help'); const h = document.getElementById('wHelpUmbral'); if (h) h.scrollIntoView(); 0", 600),
  'quick': ("showPage('help'); const t = document.querySelector('#wQuick [data-wq=\"umbral\"]'); if (t) { t.click(); t.scrollIntoView(); } 0", 600),
  'seal': ("WG.umbral.pieces = Object.keys(W_UMB_PIECES); wUmbSealScene(); 0", 2500),
  # issue #111: the Dread, the shadows and hazards, the gauntlet, a legend, the trophy shop, a feat on a card, the Seal panel
  'dread': ("const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES).slice(0, 6); U.dreadSeen = 1; U.dreadScene = 0; wUmbDreadCheck(); wNextPrompt(); 0", 700),
  'shadows': ("const U = WG.umbral, G = DB.locs.find(l => l.id === 'g_ballpark'); U.pieces = Object.keys(W_UMB_PIECES).slice(0, 3); U.dreadSeen = 3; WG.min = 12 * 60; wEnterMap('u:world', G.x, G.y + 1); WG.grace = 0; U.shadows = [{ id: 'sa', x: G.x + 3, y: G.y + 3, hx: G.x + 3, hy: G.y + 3 }, { id: 'sb', x: G.x - 3, y: G.y + 4, hx: G.x - 3, hy: G.y + 4 }, { id: 'sf', x: G.x + 6, y: G.y + 2, hx: G.x + 6, hy: G.y + 2 }]; wInvalidate('u:world'); wDrain(); 0", 900),
  'gauntlet': ("const U = WG.umbral, m = MAPS['u:g_ballpark']; delete U.gates.diamond; delete U.guards['g_ballpark:0']; delete U.guards['g_ballpark:1']; let gx = -1, gy = -1; for (let y = 0; y < m.h && gx < 0; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === '\u0220') { gx = x; gy = y; break; } const dy = Math.sign(m.spawn[1] - gy) || 1; wEnterMap('u:g_ballpark', gx, gy + 3 * dy); wUmbGauntletSyncAll && wUmbGauntletSyncAll(); WG.min = 12 * 60; wDrain(); 0", 900),
  'legend': ("const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES).slice(0, 3); U.dreadSeen = 3; WG.min = 12 * 60; const m = MAPS['u:world'], p = m.legends && m.legends.kraken; if (p) { wEnterMap('u:world', p[0], p[1] + 2); wDrain(); } 0", 900),
  'legendcard': ("const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES).slice(0, 3); U.dreadSeen = 3; wUmbLegendMatch('kraken'); 0", 700),
  'trophy': ("RUN.relics = Object.keys(RELICS).filter(k => !RELICS[k].gain && !RELICS[k].club && k !== 'umbseal' && k !== 'belt').slice(0, 2); wEnterMap('u:graftonbury', MAPS['u:graftonbury'].spawn[0], MAPS['u:graftonbury'].spawn[1]); wUmbShop('general', 'A dark shop'); const t = document.getElementById('wUmbTrade'); if (t) t.scrollIntoView(); 0", 700),
  'feat': ("WG.map = W_NADIR.links.map; WG.min = 23 * 60; wNadirMatch('links'); 0", 700),
  'sealpanel': ("const U = WG.umbral; U.pieces = ['card', 'baseball', 'hockey']; U.well = { card: 1, hockey: 1 }; WJ.tab = 'umbral'; wOpenJournal(); const s = document.querySelector('#modalBox .wumbseal'); if (s) s.scrollIntoView(); 0", 700),
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
