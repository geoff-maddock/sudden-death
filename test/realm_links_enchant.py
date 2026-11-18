# Realm links: the enchanted course (issue #92, phase 6b). Every hole has will-o'-wisps, walking trees, a web and a
# runestone; some have fairy rings, a mimic bunker, the creeping bog and the troll home under his bridge; each hole's are
# the same on every load and a wild nine's are its own. Each, on a ball placed by it: a fairy ring sends it to the other
# (an elf's only when that helps); the mimic swallows (a drop and a stroke) or spits it out (always spits an ogre's);
# the troll takes a mana from a ball over his stretch of the stream, bats it back to the near bank with none to pay, and
# lets a troll by; a wisp carries it off (never a harpy's); walking trees put it in the trees (not a wraith's); the bog
# creeps further with every hole played and takes it (not a zombie's); a web holds it, and the next shot goes half as
# far (a spider walks out); a runestone gives a mana (a dwarf two); the wyvern now and then carries one off (never a
# gorgon's). The bare engine has none of it; the Realm's games do. Drawn, and in How to play.
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

HELP = r"""
// a game with the enchanted course and powers; side 0 one kind (hitter 0), on hole i of the standing nine
window.__eg = (kind, i, o) => { const G = wGL.start(Object.assign({ seed: 5, enchant: true, powers: true, teams: [{ kinds: [kind, 'goblin', 'kobold', 'dwarf'] }, { kinds: ['goblin', 'kobold', 'dwarf', 'troll'] }] }, o || {}));
  while (G.h < (i || 0)) { G.res.push(-1); G.h++; } G.hole.par = wGL.parOf(G.h); return G; };
window.__at = (p, lie) => { wGL.G.ball[0] = { x: p.x, y: p.y, lie: lie || wGL.lie(wGL.course(wGL.G.h), p.x, p.y) }; };
// the first standing hole with this enchantment
window.__hole = k => { for (let i = 0; i < 9; i++) if (wGL.enchant(wGL.course(i))[k]) return i; return -1; };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- where they are ----------
        h = await pg.evaluate("""(() => { const all = [], some = { rings: 0, mimic: 0, bridge: 0, bog: 0 };
          for (let i = 0; i < 9; i++) { const E = wGL.enchant(wGL.course(i)); all.push(E.wisps.length === 2 && E.ents.length === 2 && !!E.web && !!E.rune); for (const k in some) if (E[k]) some[k]++; }
          const sig = JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => wGL.enchant(wGL.course(i)))), wild = JSON.stringify(wGL.enchant(wGL.built(12345, 4)));
          return { all: all.every(Boolean), some, sig: sig.length, same: sig === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => wGL.enchant(wGL.course(i)))), wildDiff: wild !== JSON.stringify(wGL.enchant(wGL.course(0))) }; })()""")
        check(h['all'] and all(v >= 1 for v in h['some'].values()) and h['same'] and h['wildDiff'], 'every hole has wisps, walking trees, a web and a runestone; some have rings, a mimic, the bog, the troll home; always the same on a hole, a wild nine its own', h)

        # ---------- each, and its kind ----------
        rg = await pg.evaluate("""(() => { const i = __hole('rings'); if (i < 0) return null; const out = {};
          __eg('goblin', i); const E = wGL.enchant(wGL.course(i)), H = wGL.course(i), [A, B] = E.rings; __at(A); const r = wGL.enchantAfter(0, 0); const b = wGL.G.ball[0]; out.sent = [r.ev.ench, Math.hypot(b.x - B.x, b.y - B.y) < 0.01];
          const far = Math.hypot(A.x - H.pin.x, A.y - H.pin.y) > Math.hypot(B.x - H.pin.x, B.y - H.pin.y) ? A : B, near = far === A ? B : A;
          __eg('elf', i); __at(near); const e = wGL.enchantAfter(0, 0); out.elf = [e.ev.ench || null, /reads the fairy ring/.test(e.t)]; return out; })()""")
        check(rg is not None and rg['sent'] == ['ring', True], 'a fairy ring sends a ball to the other ring', rg)
        check(rg is not None and rg['elf'] == [None, True], 'an elf reads a ring that would send it further away, and steps out', rg)
        mm = await pg.evaluate("""(() => { const i = __hole('mimic'); if (i < 0) return null; const E = wGL.enchant(wGL.course(i)), seen = { mimic: 0, spat: 0 }; let strokes = 0;
          for (let t = 0; t < 30; t++) { __eg('goblin', i, { seed: 100 + t }); wGL.G.hole.st = [2, 2]; __at(E.mimic, 'S'); const r = wGL.enchantAfter(0, 0); seen[r.ev.ench] = (seen[r.ev.ench] || 0) + 1; if (r.ev.ench === 'mimic') strokes = Math.max(strokes, wGL.G.hole.st[0]); }
          let ogre = 0; for (let t = 0; t < 20; t++) { __eg('ogre', i, { seed: 200 + t }); __at(E.mimic, 'S'); if (wGL.enchantAfter(0, 0).ev.ench === 'mimic') ogre++; } return { seen, strokes, ogre }; })()""")
        check(mm is not None and mm['seen']['mimic'] > 0 and mm['seen']['spat'] > 0 and mm['strokes'] == 3 and mm['ogre'] == 0, 'the mimic swallows a ball (a drop and a stroke) or spits it out, and always spits out an ogre\'s', mm)
        tr = await pg.evaluate("""(() => { const i = __hole('bridge'); if (i < 0) return { none: true }; const H = wGL.course(i), E = wGL.enchant(H), Bd = E.bridge;
          const r = { path: [{ x: Bd.x, y: Bd.y - 40, z: 0 }, { x: Bd.x, y: Bd.y + 30, z: 0 }], land: { x: Bd.x, y: Bd.y + 30 } }, plan = { putt: false };
          const go = (kind, mana) => { __eg(kind, i); wGL.G.mana[0] = mana; wGL.G.ball[0] = { x: Bd.x, y: Bd.y + 30, lie: wGL.lie(H, Bd.x, Bd.y + 30) }; const x = wGL.enchantAfter(0, 0, r, plan); return { ench: x.ev.ench || null, mana: wGL.G.mana[0], y: wGL.G.ball[0].y }; };
          const paid = go('goblin', 2), poor = go('goblin', 0), troll = go('troll', 2); return { paid, poor, troll, bridgeY: Bd.y }; })()""")
        if not tr.get('none'):
            check(tr['paid']['ench'] == 'toll' and tr['paid']['mana'] == 1, 'the troll takes a mana from a ball carried over his stretch of the stream', tr)
            check(tr['poor']['ench'] == 'troll' and tr['poor']['y'] < tr['bridgeY'] and tr['troll']['ench'] is None and tr['troll']['mana'] == 2, 'with no mana he bats it back to the near bank; a troll he lets by', tr)
        else:
            check(True, 'no troll home on the standing nine today (checked on its holes)', tr)
        ws = await pg.evaluate("""(() => { const out = {}; for (const kind of ['goblin', 'harpy']) { __eg(kind, 0); const H = wGL.course(0), E = wGL.enchant(H), w = wGL.wispAt(E.wisps[0], 0);
            const b0 = { x: w.x, y: w.y }; wGL.G.ball[0] = { x: w.x, y: w.y, lie: 'F' }; const r = wGL.enchantAfter(0, 0, { path: [{ x: w.x, y: w.y - 100, z: 0 }, b0], land: b0 }, { putt: false }); const b = wGL.G.ball[0];
            out[kind] = [r.ev.ench === 'wisp' || r.ev.ench === 'wyvern', +Math.hypot(b.x - b0.x, b.y - b0.y).toFixed(1)]; } return out; })()""")
        check(ws['goblin'][0] and ws['goblin'][1] >= 5 and ws['harpy'][1] == 0, 'a will-o\'-wisp carries a ball off a few yards; never a harpy\'s', ws)
        en = await pg.evaluate("""(() => { const out = {}; for (const kind of ['goblin', 'wraith']) { __eg(kind, 0); const E = wGL.enchant(wGL.course(0)), p = wGL.entAt(E.ents[0], 0); wGL.G.ball[0] = { x: p.x, y: p.y, lie: 'r' };
            const r = wGL.enchantAfter(0, 0); out[kind] = [r.ev.ench || null, wGL.G.ball[0].lie]; } __eg('goblin', 0); const E = wGL.enchant(wGL.course(0)), a = wGL.entAt(E.ents[0], 0), b = wGL.entAt(E.ents[0], 3); out.moves = Math.hypot(a.x - b.x, a.y - b.y) > 1; return out; })()""")
        check(en['goblin'] == ['ent', 'O'] and en['wraith'][0] is None and en['moves'], 'walking trees move between strokes, and a ball among them lies in the trees; a wraith\'s passes through', en)
        bg = await pg.evaluate("""(() => { const i = __hole('bog'); if (i < 0) return null; const H = wGL.course(i), E = wGL.enchant(H);
          __eg('goblin', i); const r0 = wGL.bogReach(H); const G = wGL.G; G.res = G.res.concat([-1, -1, -1, -1]); const r1 = wGL.bogReach(H);
          const a = Math.atan2(H.pin.y - E.bog.y, H.pin.x - E.bog.x); let p = null; for (let d = r0 + 0.5; d < r1; d += 0.5) { const x = E.bog.x + Math.cos(a) * d, y = E.bog.y + Math.sin(a) * d, l = wGL.lie(H, x, y); if (l !== 'B' && l !== 'W' && l !== 'G') { p = { x, y, l }; break; } }
          if (!p) return { r0, r1, nospot: true };
          G.ball[0] = { x: p.x, y: p.y, lie: p.l }; const g = wGL.enchantAfter(0, 0); const took = [g.ev.ench, G.ball[0].lie];
          __eg('zombie', i); wGL.G.res = wGL.G.res.concat([-1, -1, -1, -1]); wGL.G.ball[0] = { x: p.x, y: p.y, lie: p.l }; const z = wGL.enchantAfter(0, 0); return { r0, r1, took, zombie: z.ev.ench || null }; })()""")
        check(bg is not None and bg['r1'] > bg['r0'] and (bg.get('nospot') or (bg['took'] == ['bog', 'B'] and bg['zombie'] is None)), 'the bog creeps out further with every hole played and takes a ball in its reach; a zombie\'s it lets go', bg)
        wb = await pg.evaluate("""(() => { const out = {}; for (const kind of ['goblin', 'spider']) { __eg(kind, 0); const E = wGL.enchant(wGL.course(0)); __at(E.web, 'R'); const r = wGL.enchantAfter(0, 0); out[kind] = [r.ev.ench || null, wGL.webbed[0]]; }
          // a webbed ball's next shot goes half as far (the same swing, from the same spot)
          const shot = web => { __eg('goblin', 0); const G = wGL.G, E = wGL.enchant(wGL.course(0)); G.ball[0] = { x: E.web.x, y: E.web.y, lie: 'R' }; G.webbed[0] = web; G.hole.st = [1, 1]; const Hc = wGL.course(0); G.ball[1] = { x: Hc.pin.x + 3, y: Hc.pin.y, lie: 'G' };
            const b = Object.assign({}, G.ball[0]); const e = wGL.turn(); const a = G.ball[0]; return { d: Math.hypot(a.x - b.x, a.y - b.y), side: e.side, after: wGL.webbed[0] }; };
          out.free = shot(false); out.held = shot(true); return out; })()""")
        check(wb['goblin'] == ['web', True] and wb['spider'] == [None, False], 'a web holds a ball; a spider walks out', wb)
        check(wb['held']['side'] == 0 and wb['held']['d'] < wb['free']['d'] * 0.75 and wb['held']['after'] is False, 'from a web the next shot goes about half as far, and then the ball is free', wb)
        rn = await pg.evaluate("""(() => { const out = {}; for (const kind of ['goblin', 'dwarf']) { __eg(kind, 0); const E = wGL.enchant(wGL.course(0)); wGL.G.mana[0] = 1; __at(E.rune); const r = wGL.enchantAfter(0, 0); out[kind] = [r.ev.ench, wGL.G.mana[0]]; } return out; })()""")
        check(rn == {'goblin': ['rune', 2], 'dwarf': ['rune', 3]}, 'a runestone gives a mana to a ball beside it; a dwarf reads it twice', rn)
        wy = await pg.evaluate("""(() => { const count = kind => { let n = 0; for (let t = 0; t < 1500; t++) { if (t % 50 === 0) __eg(kind, 0, { seed: 900 + t }); const G = wGL.G, H = wGL.course(0), p = H.line[40]; G.ball[0] = { x: p.x, y: p.y, lie: 'F' };
            const r = wGL.enchantAfter(0, 0, { path: [{ x: p.x, y: p.y - 150, z: 0 }, { x: p.x, y: p.y, z: 0 }], land: { x: p.x, y: p.y } }, { putt: false }); if (r.ev.ench === 'wyvern') n++; } return n / 1500; };
          return { goblin: count('goblin'), gorgon: count('gorgon') }; })()""")
        check(0.003 < wy['goblin'] < 0.025 and wy['gorgon'] == 0, 'the wyvern carries off a ball in the air about one shot in a hundred; never a gorgon\'s', wy)
        off = await pg.evaluate("""(() => { wGL.start({ seed: 5, powers: true }); const E = wGL.enchant(wGL.course(0)); wGL.G.ball[0] = { x: E.rune.x, y: E.rune.y, lie: 'r' }; return wGL.enchantAfter(0, 0).t; })()""")
        check(off == '', 'the bare engine has none of it', off)

        # ---------- in the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        rl = await pg.evaluate("""(() => { wLinksGame({ seed: 81, mode: 'watch' }); wGL.pause(true); const on = wGL.G.enchant; let i = 0; while (wGL.G.res.length < 3 && i++ < 20000) wGL.tick(0.05); wGL.render(); return { on, played: wGL.G.res.length }; })()""")
        check(rl['on'] and rl['played'] >= 3, 'a Realm round has the enchanted course, and plays on with it drawn', rl)
        await pg.evaluate("wLeaveLinks(); showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wLinksHow') || {}).textContent || ''; return ['enchanted course', 'Fairy rings', 'mimic', 'troll', 'Will-o', 'Walking trees', 'bog creeps', 'Webs', 'runestone', 'wyvern'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains every enchantment and the kinds it spares', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
