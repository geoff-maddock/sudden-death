# The superstars' second powers, phase 6 of issue #61: each of the six has a second boxing special and a second
# offense and defense power on the gridiron, as every league kind does. Asserts: each is in the book and different
# from the first; each second special does what its data says in the ring, and each second power's effects reach the
# play on the gridiron; neither makes a superstar much stronger than its first does (seeded bouts against the same
# opponents, both specials); and in the Realm, a superstar of yours gets the Special list on the Ring tab and the two
# power lists on the Seven tab, and brings what is picked. Exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
SETUP = """(d, kinds, sp) => { wBX.start({ fighters: kinds.map((k, i) => ({ n: 'F' + i, kind: k, sp: (sp || [])[i] })), seed: 7 });
  for (let i = 0; i < 100 && wBX.phase === 'intro'; i++) wBX.step();
  const G = wBX.G; G.F[0].x = -d / 2; G.F[1].x = d / 2; G.F[0].y = G.F[1].y = 0;
  for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.mv = [0, 0]; f.think = 99; f.r.chin = 60; f.spirit = 100; } return G; }"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wSevenSetPw === 'function' && typeof wRingSetSp === 'function'")
        await pg.evaluate(f"wBX.speed = 4; window.__setup = {SETUP}; 0")
        stars = await pg.evaluate("W_STARS.filter(s => s.kind).map(s => s.kind)")
        check(len(stars) == 6, 'six superstars', stars)

        bk = await pg.evaluate("""(K => K.map(k => { const R = wBX.powerBook[k], F = wGF.powerBook[k];
          return [k, !!(R.sp2 && R.sp2.desc && R.sp2.n !== R.sp.n), !!(F.off2 && F.def2 && F.off2.desc && F.def2.desc && F.off2.n !== F.off.n && F.def2.n !== F.def.n)]; }))""", stars)
        check(all(b[1] for b in bk), 'each superstar has a second boxing special, different from its first', bk)
        check(all(b[2] for b in bk), 'each has a second offense and defense power on the gridiron, different from its first', bk)

        # ---- the ring: each second special does what it says ----
        each = await pg.evaluate("""(K => { const D = wBX.powerData, bad = [];
          for (const kind of K) { const P = D[kind].sp2, N = P.now || {};
            const G = __setup(2, [kind, 'golem'], ['sp2', null]), f = G.F[0], o = G.F[1]; f.hp = 50; f.sta = f.staMax - 20;
            const before = { fhp: f.hp, ohp: o.hp, osta: o.sta, fsta: f.sta };
            if (!wBX.cast(0, 'sp')) { bad.push(kind + ': not cast'); continue; } const why = [];
            if (N.stun && o.a.k !== 'stun') why.push('no stun'); if ((N.dmg || N.hits) && !(o.hp < before.ohp)) why.push('no damage');
            if (N.hp && !(f.hp > before.fhp)) why.push('no health back'); if (N.mySta && !(f.sta > before.fsta - wBX.powerCost.sp)) why.push('no stamina back');
            if (P.fx) { const on = P.fx.who === 'self' ? f : o; if (!on.fx.some(s => s.id === P.id)) why.push('no status on ' + P.fx.who); }
            if (why.length) bad.push(kind + ': ' + why.join(', ')); }
          return bad; })""", stars)
        check(not each, 'each superstar\'s second special does what it says at once, and leaves its status', each)
        # neither special makes them far stronger: win rates against the same opponents and seeds, sp and sp2
        bal = await pg.evaluate("""(K => { const opp = ['ogre', 'elf', 'minotaur', 'vampire', 'dwarf', 'harpy'], out = {};
          for (const k of K) { const w = { sp: 0, sp2: 0 }; let n = 0;
            for (let i = 0; i < 48; i++) { n++; for (const sp of ['sp', 'sp2']) { const s = wBX.simBout({ fighters: [{ n: 'S', kind: k, sp }, { n: 'O', kind: opp[i % opp.length] }], seed: 1200 + i, skill: [1, 1] });
              w[sp] += s.over.win === 0 ? 1 : s.over.win == null ? .5 : 0; } }
            out[k] = [Math.round(100 * w.sp / n), Math.round(100 * w.sp2 / n)]; }
          return out; })""", stars)
        check(all(abs(a - b) <= 20 for a, b in bal.values()), 'in the ring, a superstar wins about as often with either special (48 seeded bouts each, within 20 points)', bal)

        # ---- the gridiron: each second power's effects reach the play ----
        fx = await pg.evaluate("""(K => { const B = wGF.powerBook, bad = [], MUL = ['oSpd','dSpd','cSpd','rSpd','rushSpd','coverSpd','backSpd','midSpd','deepSpd','shed','int','errM','ballV','qbT','fum'];
          for (const k of K) for (const r of ['off2', 'def2']) { const P = B[k][r];
            const L = wGF.snap('run', 'man', { seed: 5, st: { pw: r === 'off2' ? { off: { id: P.id, name: P.n }, def: null } : { off: null, def: { id: P.id, name: P.n } } } });
            for (const key in P.fx) if (Math.abs(L.fx[key] - P.fx[key]) > 1e-9) bad.push(`${k} ${P.n}: ${key} ${L.fx[key]}`); }
          return bad; })""", stars)
        check(not fx, 'each superstar\'s second gridiron power reaches the play', fx)

        # ---- in the Realm ----
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        pid = await pg.evaluate("(() => { const p = wMakePlayer({ kind: 'kraken', lvl: 3 }, 'tavern'); wAddPlayer(p); while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf', lvl: 3 }, 'tavern')); wSevenSync(); return p.id; })()")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wOpenCamp('ring')")
        rg = await pg.evaluate("""(pid => { const s = document.querySelector(`#wCampBody select[data-rsp="${pid}"]`); if (!s) return null; s.value = 'sp2'; s.dispatchEvent(new Event('change'));
          return { kept: wPlayer(pid).bxSp, f: wBxFighter(wPlayer(pid)).sp }; })""", pid)
        check(rg == {'kept': 'sp2', 'f': 'sp2'}, 'a superstar of yours gets the Special list on the Ring tab, and brings what is picked', rg)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wOpenCamp('seven')")
        sv = await pg.evaluate("""(pid => { const s = document.querySelector(`#wCampBody select[data-gpw="off"][data-gpwid="${pid}"]`), d = document.querySelector(`#wCampBody select[data-gpw="def"][data-gpwid="${pid}"]`);
          if (!s || !d) return { lists: false, inSeven: wSevenSync().ids.includes(pid) }; s.value = '1'; s.dispatchEvent(new Event('change'));
          return { lists: true, kept: wPlayer(pid).gfPw, pw: wSevenPlayer(wPlayer(pid)).pw }; })""", pid)
        check(sv.get('lists') and sv.get('kept') == {'off': 1, 'def': 0} and sv.get('pw') == {'off': 1, 'def': 0}, 'and the two power lists on the Seven tab, bringing what is picked', sv)
        await pg.evaluate(CLOSE_ALL)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print(f'\n{len(FAILS)} failed' if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
