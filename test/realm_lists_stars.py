# Realm lists (issue #117, phase 9): superstars at the Lists, and the riders drawn as themselves.
# Each of the six superstars has a jousting kind: ratings of its own (not an average rider's), two lance and two shield
# powers, one of the four a curse, and an ultimate, every effect one the engine reads; every id they add ends in 'jt',
# none is one of the engine's own (powers, ultimates, situation powers), none repeats; the figures know them in the
# engine's scope. The Realm: a superstar made now has jousting ratings from its kind (marked), and one from an older save
# (an average player's) is made again from its kind once, on load, and the captain picks the four again on the new
# ratings, keeping the call-ups; a match with superstars rides (they cast their own powers); a superstar's curse lands
# and a squire may lift it; its ultimate marks the course; the herald's card names a superstar's powers; the Lists tab
# offers a superstar's own picks; a superstar rider is drawn as itself (not as the goblin a kind the figures don't know
# falls back to); How to play and Jousting: how it works have the superstars. Screenshots go to /tmp. Asserts; exits
# nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

STARS = ['phoenix', 'kraken', 'behemoth', 'djinn', 'hydra', 'frostwyrm']
HELP = r"""
window.__T = (ks, o) => ({ name: 'Side', short: 'SID', color: '#2a6ac8', roster: ks.map((k, i) => Object.assign({ n: 'R' + i, kind: k }, o || {})) });
window.__to = (ph, max) => { let n = 0; while (wJT.phase !== ph && n++ < (max || 20000)) wJT.tick(0.05); return wJT.phase === ph; };
// the lists drawn once, as a string, for a side of four of one kind against a side of goblins, every rating the same
window.__pic = kind => { const r = { lance: 7, couch: 7, seat: 7, shield: 7, ride: 7, nerve: 7, care: 7 };
  wListsGame({ seed: 7, mode: 'play', powers: false, ground: false, mounts: [['destrier', 'destrier'], ['destrier', 'destrier']], teams: [__T([kind, kind, kind, kind], { r }), __T(['goblin', 'goblin', 'goblin', 'goblin'], { r })] });
  wJT.pause(true); __to('plan'); wJT.render(0); return document.querySelector('#v-lists canvas').toDataURL(); };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- the tables ----------
        t = await pg.evaluate(f"""(() => {{ const stars = {json.dumps(STARS)}, own = new Set(), mine = [], fx0 = Object.keys(wJT.fx0), bad = [];
          for (const k of Object.keys(wJT.pow)) if (!stars.includes(k)) {{ for (const P of wJT.pow[k].concat(wJT.pow2[k])) own.add(P.id); own.add(wJT.ult[k].id); }}
          for (const k of Object.keys(wJT.sit)) own.add(wJT.sit[k].id);
          const keys = (x, where) => {{ for (const k of Object.keys(x || {{}})) if (!fx0.includes(k)) bad.push(where + ':' + k); }};
          const avg = wJT.rate('');
          const each = stars.map(k => {{ const r = wJT.rate(k), P = (wJT.pow[k] || []).concat(wJT.pow2[k] || []), U = wJT.ult[k];
            P.forEach(x => {{ mine.push(x.id); keys(x.fx, x.id); keys(x.on, x.id); keys(x.curse, x.id); }}); if (U) {{ mine.push(U.id); keys(U.own, U.id); keys(U.rival, U.id); }}
            const lance = [wJT.powOf(k, 'lance', 0), wJT.powOf(k, 'lance', 1)], shield = [wJT.powOf(k, 'shield', 0), wJT.powOf(k, 'shield', 1)];
            return {{ k, rated: wJT.stats.every(s => r[s] >= 1 && r[s] <= wJT.cap) && wJT.stats.some(s => r[s] !== avg[s]) && !!wJT.kinds[k],
              four: (wJT.pow[k] || []).length === 2 && (wJT.pow2[k] || []).length === 2, own: lance.concat(shield).every(x => x.id.endsWith('jt')),
              curse: P.filter(x => x.curse).length === 1, ult: !!U && !!(U.own || U.rival) }}; }});
          const sums = Object.fromEntries(stars.map(k => [k, wJT.kinds[k].reduce((a, b) => a + b, 0)]));
          return {{ each: each.filter(e => !(e.rated && e.four && e.own && e.curse && e.ult)), ends: mine.every(id => id.endsWith('jt')), clash: mine.filter(id => own.has(id)),
            uniq: new Set(mine).size === mine.length, n: mine.length, bad, figs: stars.filter(k => !wJT.figKinds().includes(k)), sums }}; }})()""")
        check(t['each'] == [], 'each superstar has a jousting kind: its own ratings, two lance and two shield powers (one a curse), an ultimate', t['each'])
        check(t['ends'] and t['clash'] == [] and t['uniq'] and t['n'] == 30, 'every superstar id ends in "jt", none is the engine\'s own, none repeats (30 ids)', t)
        check(t['bad'] == [], 'every superstar effect is one the engine reads', t['bad'])
        check(t['figs'] == [], 'the superstars\' figures are in the engine\'s scope', t['figs'])
        print('     rating totals:', t['sums'])

        # ---------- the engine: a match with superstars, a curse, an ultimate, the herald's card ----------
        g = await pg.evaluate("""(() => { const T = __T(['phoenix', 'kraken', 'behemoth', 'djinn']), U = __T(['dwarf', 'elf', 'golem', 'spider']), out = { over: 0, own: 0 };
          for (let s = 1; s <= 4; s++) { const m = wJT.simMatch({ seed: s, skill: [2, 1], powers: true, teams: [T, U] }); out.over += m.over ? 1 : 0; out.own += m.powers.casts.filter(c => c.side === 0 && c.id.endsWith('jt')).length; }
          // the Djinn's Mirage: a curse on the other rider for the heat; their squires may lift it
          wJT.start({ seed: 5, teams: [__T(['djinn', 'djinn', 'djinn', 'djinn'], { pw: { lance: 1, shield: 0 } }), U], powers: true }); wJT.pause(true);
          const why = wJT.cast(0, 'lance', 'a test'), cu = wJT.G.curse[1], late = wJT.fxFor(1).late; wJT.turn();
          out.curse = { why, id: cu && cu.id, sway: cu && cu.fx.sway, late, still: !!wJT.G.curse[1], lift: wJT.jobsFor(1).includes('lift') };
          // the Behemoth's Earthquake marks the course against the other rider
          wJT.start({ seed: 6, teams: [__T(['behemoth', 'behemoth', 'behemoth', 'behemoth']), U], powers: true }); wJT.pause(true); wJT.G.cheer[0] = 50;
          out.ult = { why: wJT.cast(0, 'ult', 'a test'), id: wJT.G.casts[0].id, hold: wJT.fxFor(1).hold, sway: wJT.fxFor(1).sway, mine: wJT.fxFor(0).hold };
          // the herald's card: the Hydra you're about to meet
          wJT.start({ seed: 7, teams: [U, __T(['hydra', 'hydra', 'hydra', 'hydra'], { pw: { lance: 0, shield: 1 } })], powers: true }); wJT.pause(true);
          const K = wJT.card(0); out.card = [K.pow.lance.id, K.pow.shield.id, K.pow.ult.id];
          return out; })()""")
        check(g['over'] == 4 and g['own'] >= 3, 'a match with superstars rides, and they cast their own powers', g)
        c = g['curse']
        check(c['why'] == '' and c['id'] == 'miragejt' and c['sway'] > 1 and c['late'] > 0 and c['still'] and c['lift'], 'a superstar\'s curse lands on the other rider for the heat, and their squires may lift it', c)
        u = g['ult']
        check(u['why'] == '' and u['id'] == 'quakejt' and u['hold'] < 0 and u['sway'] > 1 and u['mine'] == 0, 'a superstar\'s ultimate marks the course against the other rider', u)
        check(g['card'] == ['threeheadjt', 'scalesjt', 'regrowjt'], 'the herald\'s card names a superstar\'s own powers and ultimate', g['card'])

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        r = await pg.evaluate("""(() => { const p = wMakePlayer({ kind: 'behemoth', lvl: 3, n: 'Behemoth' }, 'tavern'); wAddPlayer(p);
          // (a short roster: the call-ups the captain's repick keeps, each in an open place)
          const allR = wRoster; wRoster = () => allR().slice(0, 2); WG.lists = null; const C = wListsSync(); C.mine = false; const cus = C.cu.map(c => c.cid); wListsRepick(C);
          const keptCu = cus.length > 0 && cus.every(cid => WG.lists.cu.some(c => c.cid === cid) && WG.lists.four.includes(cid)); wRoster = allR; WG.lists = null; wListsSync();
          // (a long one: an older save's Djinn, a poor rider till it is made again, rides on its own ratings)
          for (let i = 0; i < 4; i++) wAddPlayer(wMakePlayer({ kind: 'goblin', lvl: 1, n: 'Gob' + i }, 'tavern'));
          const q = wMakePlayer({ kind: 'djinn', lvl: 3, n: 'Djinn' }, 'tavern'); wAddPlayer(q); q.jt = { lv: 3, got: {}, lance: 2, couch: 2, seat: 2, shield: 2, ride: 2, nerve: 2, care: 2 };
          const C2 = wListsSync(); C2.mine = false; wListsAutoPick(C2); wListsSync(); const outBefore = !WG.lists.four.slice(0, 2).includes(q.id);
          const save = JSON.parse(JSON.stringify({ WG, RUN })); wStart(save); const Q = wPlayer(q.id), P = wPlayer(p.id);
          const djinnIn = WG.lists.four.slice(0, 2).includes(q.id), again = wListsStarFix(Q);
          // a set four is left as you set it
          const save2 = JSON.parse(JSON.stringify({ WG, RUN })); const D = save2.WG.roster.find(x => x.id === q.id); D.jt = { lv: 3, got: {}, lance: 2, couch: 2, seat: 2, shield: 2, ride: 2, nerve: 2, care: 2 };
          save2.WG.lists.mine = true; const four2 = JSON.stringify(save2.WG.lists.four); wStart(save2);
          return { made: !!(P.jt && P.jt.st), seat: P.jt.seat, fixed: !!(Q.jt && Q.jt.st), lance: Q.jt.lance, keptCu, outBefore, djinnIn, again, kept: JSON.stringify(WG.lists.four) === four2, fixed2: wPlayer(q.id).jt.lance >= 10 }; })()""")
        check(r['made'] and r['seat'] >= 11, 'a superstar made now has jousting ratings from its kind (the Behemoth sits best)', r)
        check(r['fixed'] and r['lance'] >= 10 and r['outBefore'] and r['djinnIn'] and not r['again'], 'a superstar from an older save is made again from its kind, once, on load, and the captain picks the four on the new ratings', r)
        check(r['keptCu'], 'the captain\'s repick keeps the call-ups, each in an open place', r)
        check(r['kept'] and r['fixed2'], 'a four you set yourself is left as you set it (the ratings still made again)', r)

        # the Lists tab offers a superstar's own picks
        await pg.evaluate("wOpenCamp('lists')")
        await pg.wait_for_selector('#wCampBody [data-jtpw]')
        l = await pg.evaluate("""(() => { const q = wRoster().find(p => p.kind === 'djinn'), row = document.querySelector(`#wCampBody [data-cid="${q.id}"]`);
          const opts = row ? [...row.querySelectorAll('[data-jtpw] option')].map(o => o.textContent) : [], s = row && row.querySelector('[data-jtpw="lance"]');
          if (s) { s.value = '1'; s.dispatchEvent(new Event('change')); } const m = wListsPlayer(wPlayer(q.id));
          return { opts, pw: m.pw.lance, r: m.r.lance }; })()""")
        await pg.evaluate("document.getElementById('modal').hidden = true")
        check(any('Wish Lance' in o for o in l['opts']) and any('Mirage' in o for o in l['opts']) and l['pw'] == 1 and l['r'] >= 10, 'the Lists tab offers a superstar\'s own lance and shield powers, and the match brings the pick', l)

        # ---------- drawn as themselves ----------
        d = await pg.evaluate("""(() => { const gob = __pic('goblin'), gob2 = __pic('goblin'), none = __pic('nosuchkind'), out = { same: gob === gob2, fallback: none === gob, stars: {} };
          for (const k of ['phoenix', 'kraken', 'behemoth', 'djinn', 'hydra', 'frostwyrm']) out.stars[k] = __pic(k) !== gob;
          return out; })()""")
        check(d['same'] and d['fallback'], 'the lists draw the same twice, and a kind the figures don\'t know is drawn as a goblin', d)
        check(all(d['stars'].values()), 'a superstar rider is drawn as itself, not as a goblin', d['stars'])
        await pg.evaluate("""(() => { wListsGame({ seed: 9, mode: 'watch', teams: [__T(['phoenix', 'kraken', 'djinn', 'hydra']), __T(['behemoth', 'frostwyrm', 'elf', 'golem'])] }); wJT.pause(true);
          __to('charge'); let n = 0; while (wJT.phase === 'charge' && wJT.view.charge && wJT.view.charge.p < .8 && n++ < 400) wJT.tick(.01); wJT.render(0); })()""")
        await pg.locator('#v-lists canvas').screenshot(path='/tmp/lists_stars_charge.png')

        # ---------- How to play ----------
        await pg.evaluate("wJT.pause(true); showPage('help')")
        hp = await pg.evaluate("(() => { const h = $('wHelpListsStars'); return !!h && ['Phoenix', 'Kraken', 'Behemoth', 'Djinn', 'Hydra', 'Frost Wyrm'].every(n => h.textContent.includes(n)) && h.textContent.includes('Three Wishes'); })()")
        check(hp, 'How to play has each superstar\'s game at the Lists', hp)
        how = await pg.evaluate("(() => { const d = document.createElement('div'); d.innerHTML = wListsHowHTML(); const h = d.querySelector('#wListsHowStars'); return !!h && h.textContent.includes('Blizzard') && h.textContent.includes('Earthquake'); })()")
        check(how, 'Jousting: how it works has the superstars', how)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
