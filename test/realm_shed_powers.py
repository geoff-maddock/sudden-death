# Realm shed (issue #102, phase 6): powers on the ice.
# The engine: a game has no powers unless asked; with them each rink starts with mana, and a shot made fills it (a miss
# doesn't); a curler's power is their draw power for a draw and their hit power for a hit; a cast costs mana, one a
# stone, and makes the miss smaller; a curse (a witch's frost hex) lands on the other rink's next stone, and a stone
# under it comes up short; a granite stone barely moves when it is hit; a smoke stone slides through a guard; a gust
# pushes their stone nearest the button back; the ultimate takes the roar, only at the start of an end, and marks that
# end for one side and against the other, until the end is scored; the Hammer fits only the end's last stone with the
# hammer; Steady only the skip's in the last end; powers for one side only leave the other with none; the CPU casts in a
# game. The Realm: every game at the Shed has powers; your stone's rows show the Powers row (mana, the roar, the power
# for the shot, which changes with the shot), and P casts it; the Shed tab picks each curler's draw and hit power, and
# the game brings the pick; Manage has Auto powers; How to play explains powers. Asserts; exits nonzero on failure.
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
window.__team = ks => ({ name: ks.join(''), short: 'T', roster: ks.map((k, i) => ({ n: k + i, kind: k })) });
window.__ri = (s, kind) => wCR.G.teams[s].roster.findIndex(m => m.kind === kind);
window.__to = (ph, max) => { let n = 0; while (wCR.phase !== ph && n++ < (max || 20000)) wCR.tick(0.05); return wCR.phase === ph; };
0"""
A = "['elf', 'witch', 'golem', 'harpy']"
B = "['wraith', 'troll', 'gorgon', 'spider']"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- mana, the power for the shot, a cast ----------
        e = await pg.evaluate(f"""(() => {{ const out = {{}};
          wCR.start({{ seed: 1, teams: [__team({A}), __team({B})] }}); out.off = [!!wCR.G.powers, wCR.fxFor(0).err];
          wCR.start({{ seed: 1, hammer: 1, powers: true, teams: [__team({A}), __team({B})] }}); const G = wCR.G, elf = __ri(0, 'elf');
          out.mana = G.mana.slice(); out.which = [wCR.powNow(0, elf, 'draw').id, wCR.powNow(0, elf, 'takeout').id];
          const k0 = wCR.errK(0, 'draw'), r = wCR.cast(0, 'pow', elf), k1 = wCR.errK(0, 'draw');
          out.cast = {{ r, mana: G.mana[0], again: wCR.cast(0, 'pow', elf), truer: k1.ang < k0.ang && k1.v < k0.v }};
          return out; }})()""")
        check(e['off'] == [False, 1], 'a game has no powers unless asked', e['off'])
        check(e['mana'] == [2, 2] and e['which'] == ['elveneye', 'arrowline'], 'each rink starts with mana; a curler\'s power is their draw power for a draw, their hit power for a hit', e)
        check(e['cast']['r'] == '' and e['cast']['mana'] == 0 and e['cast']['again'] != '' and e['cast']['truer'], 'a cast costs mana, one a stone, and makes the stone truer', e['cast'])
        mg = await pg.evaluate(f"""(() => {{ wCR.start({{ seed: 2, ends: 4, powers: true, powOnly: ['none', 'none'], teams: [__team({A}), __team({B})] }}); const G = wCR.G; let made = 0, bad = [], n = 0;
          while (!G.over && n++ < 200) {{ const m0 = G.mana.slice(); const ev = wCR.turn(); if (!ev || !ev.rule.ok || ev.rule.end) continue;
            const want = ev.made ? Math.min(6, m0[ev.side] + 1) : m0[ev.side]; if (ev.made) made++; if (G.mana[ev.side] !== want) bad.push([ev.made, m0[ev.side], G.mana[ev.side]]); }}
          return {{ made, bad: bad.slice(0, 4), roar: G.roar.slice() }}; }})()""")
        check(mg['made'] >= 3 and mg['bad'] == [] and max(mg['roar']) > 0, 'a shot made fills the mana (and the roar), a miss doesn\'t', mg)

        # ---------- the stone's powers ----------
        st = await pg.evaluate("""(() => { const ice = wCR.iceNew(), o = { ice, cold: 'mid' }, th = v => ({ id: 't', s: 0, x0: 0, ang: 0, v, h: 0 });
          const plain = wCR.run([], th(132), o).stop.y, heavy = wCR.run([], th(132), Object.assign({ fx: { heavy: 1.04 } }, o)).stop.y;
          const hit = g => { const r = wCR.run([Object.assign({ id: 'a', s: 1, x: 0, y: 0 }, g ? { g: 1 } : {})], th(152), o); const a = r.stones.find(b => b.id === 'a'); return a ? Math.hypot(a.x, a.y) : 999; };
          const guard = [{ id: 'g', s: 1, x: 0, y: -160 }], solid = wCR.run(guard, th(141.7), o), smoke = wCR.run(guard, th(141.7), Object.assign({ fx: { ghost: 1 } }, o));
          const gr = (fx) => { const r = wCR.run([{ id: 'a', s: 1, x: 0, y: 0 }], th(152), Object.assign({ fx }, o)), a = r.stones.find(b => b.id === 'a'), t = r.stones.find(b => b.id === 't'); return { d: a ? +Math.hypot(a.x, a.y).toFixed(1) : 999, g: t ? !!t.g : null }; };
          const two = wCR.run([{ id: 'g1', s: 1, x: 0, y: -170 }, { id: 'g2', s: 1, x: 0, y: -158 }], th(60), Object.assign({ fx: { ghost: 1 } }, o)), R2 = 2 * wCR.sheet.stoneR - .01;
          const clash = two.stones.some((p, i) => two.stones.some((q, j) => j > i && Math.hypot(p.x - q.x, p.y - q.y) < R2));
          return { plain, heavy, moved: [hit(false), hit(true)], thrownG: [gr(null), gr({ granite: 1 })], clash, solid: [solid.hits, solid.stop && solid.stop.y], smoke: [smoke.hits, smoke.stop && smoke.stop.y] }; })()""")
        check(st['heavy'] < st['plain'] - 12, 'a stone under a frost hex drags heavy and comes up short', st)
        check(st['moved'][1] < st['moved'][0] / 2, 'a granite stone barely moves when it is hit', st['moved'])
        check(st['thrownG'][0]['d'] == st['thrownG'][1]['d'] and st['thrownG'][1]['g'] is True, 'a granite stone is heavy only once at rest: it hits like any other, then keeps its weight', st['thrownG'])
        check(not st['clash'], 'a smoke stone that stops in a guard goes on clear of every stone', st)
        check(st['solid'][0] > 0 and st['smoke'][0] == 0 and st['smoke'][1] is not None and st['smoke'][1] > -100, 'a smoke stone slides through the guard it meets, and on into the house', st)
        cu = await pg.evaluate(f"""(() => {{ wCR.start({{ seed: 3, hammer: 1, powers: true, teams: [__team({A}), __team({B})] }}); const G = wCR.G, w = __ri(0, 'witch');
          G.callNow = {{ s: 0, shot: 'takeout' }}; const r = wCR.cast(0, 'pow', w); G.callNow = null; /* (the witch's hit power is the frost hex) */ const fx1 = wCR.fxFor(1).heavy, fx0 = wCR.fxFor(0).heavy;
          G.stones = [{{ id: '1:0', s: 1, x: 6, y: 4 }}]; const hp = __ri(0, 'harpy'); G.mana[0] = 6; G.powStone[0] = -1; G.callNow = {{ s: 0, shot: 'draw' }}; const g = wCR.cast(0, 'pow', hp); G.callNow = null;
          const aim = wCR.solveDraw(-45, -20, 1, G.ice, G.cold), plan = {{ shot: 'draw', x: -45, y: -20, h: 1, aim }}, ev = wCR.throwStone(0, plan, aim, null), theirs = G.stones.find(b => b.id === '1:0');
          return {{ r, fx1, fx0, g, gust: ev.gust, d: theirs ? Math.hypot(theirs.x, theirs.y) : null }}; }})()""")
        check(cu['fx1'] == 1.04 and cu['fx0'] == 1, 'a curse lands on the other rink\'s next stone, not your own', cu)
        check(cu['g'] == '' and (cu['gust'] or 0) > 0 and cu['d'] is not None and cu['d'] > 7.2 + 4, 'a gust pushes their stone nearest the button back', cu)

        # ---------- the ultimate, situations, one side, the CPU ----------
        u = await pg.evaluate(f"""(() => {{ wCR.start({{ seed: 4, hammer: 1, powers: true, teams: [__team({A}), __team({B})] }}); const G = wCR.G, out = {{}}, elf = __ri(0, 'elf');
          out.poor = wCR.powWhy(0, 'ult', elf); G.roar[0] = 80; out.ok = wCR.cast(0, 'ult', elf); out.mark = G.mark && G.mark.id; out.own = wCR.fxFor(0).err; out.riv = wCR.fxFor(1).err;
          let n = 0; while (G.end === 0 && n++ < 40) wCR.turn(); out.after = G.mark; G.roar[0] = 80; G.ultUsed[0] = false; G.k = 4; out.late = wCR.powWhy(0, 'ult', elf);
          G.k = 15; G.hammer = 1; out.hamWrong = wCR.powWhy(1, 'hammer') === '' ; G.k = 14; out.hamEarly = wCR.powWhy(1, 'hammer');
          out.steady = wCR.powWhy(G.k % 2 ? 1 : 0, 'steady');
          return out; }})()""")
        check(u['poor'] != '' and u['ok'] == '' and u['mark'] == 'feysheet' and u['own'] < 1 and u['riv'] == 1, 'the ultimate takes the roar, and marks the end for its side', u)
        check(u['after'] is None and u['late'] != '', 'the mark ends with its end; the ultimate is only cast at the start of an end', u)
        check(u['hamEarly'] != '' and u['steady'] != '', 'the Hammer fits only the end\'s last stone; Steady only the skip\'s in the last end', u)
        cp = await pg.evaluate(f"""(() => {{ const T = [__team({A}), __team({B})];
          const one = wCR.simGame({{ seed: 5, ends: 4, skill: [2, 2], powers: [true, false], teams: T }}), both = wCR.simGame({{ seed: 5, ends: 4, skill: [2, 2], powers: true, teams: T }});
          wCR.start({{ seed: 5, ends: 4, skill: [2, 2], powers: true, teams: T }}); let n = 0; while (!wCR.G.over && n++ < 200) wCR.turn(); const c = wCR.G.casts;
          return {{ sides: [c.filter(x => x.side === 0).length, c.filter(x => x.side === 1).length], mana: one.over ? 1 : 0 }}; }})()""")
        check(min(cp['sides']) >= 3, 'the CPU casts powers in a game, both rinks', cp)
        os_ = await pg.evaluate(f"""(() => {{ wCR.start({{ seed: 6, ends: 4, skill: [2, 2], powers: [true, false], teams: [__team({A}), __team({B})] }}); let n = 0; while (!wCR.G.over && n++ < 200) wCR.turn();
          const c = wCR.G.casts; return [c.filter(x => x.side === 0).length, c.filter(x => x.side === 1).length]; }})()""")
        check(os_[0] >= 3 and os_[1] == 0, 'powers for one side only: the other rink casts none', os_)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        await pg.evaluate("wOpenCamp('shed')")
        await pg.wait_for_selector('#wCampBody [data-crpw]')
        tb = await pg.evaluate("""(() => { const s = document.querySelector('#wCampBody [data-crpw="hit"]'), id = +s.closest('[data-cid]').dataset.cid; s.value = '1'; s.dispatchEvent(new Event('change'));
          const p = wPlayer(id); return { n: document.querySelectorAll('#wCampBody [data-crpw]').length, pick: p.crPw, brought: wShedPlayer(p).pw }; })()""")
        check(tb['n'] >= 8 and tb['pick'] == {'draw': 0, 'hit': 1} and tb['brought'] == {'draw': 0, 'hit': 1}, 'the Shed tab picks each curler\'s draw and hit power, and the game brings the pick', tb)
        await pg.evaluate("WCAMP.close && WCAMP.close()")
        rw = await pg.evaluate("""(() => { W_SHED_MODE = 'play'; wShedGame({ seed: 7, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); wCR.G.mana[wCR.view.you] = 6; wShedRows();
          const row = $('wShedPowRow'), p0 = row.querySelector('[data-crpow="pow"]').textContent; wCR.G.stones = [{ id: '1:0', s: 1, x: 4, y: 8 }]; const hit = ['takeout', 'peel', 'hitroll'].includes(wCR.view.sel.shot); wCR.select(hit ? { shot: 'draw' } : { shot: 'takeout', target: '1:0' }); wShedRows();
          const p1 = row.querySelector('[data-crpow="pow"]').textContent, m0 = wCR.G.mana[wCR.view.you]; wCR.pause(false);
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true })); wCR.pause(true);
          return { powers: !!wCR.G.powers && !!wCR.G.hall, shown: !row.hidden, mana: /Mana/.test(row.textContent), changes: p0 !== p1, spent: m0 - wCR.G.mana[wCR.view.you] }; })()""")
        check(rw['powers'] and rw['shown'] and rw['mana'] and rw['changes'], 'every game at the Shed has powers (and the Shed\'s ways); your stone\'s Powers row shows the mana and the power for the shot, which changes with the shot', rw)
        check(rw['spent'] == 2, 'P casts your curler\'s power, for its mana', rw)
        ma = await pg.evaluate("""(() => { $('wShedModes').querySelector('[data-cmode="manage"]').click(); wCR.pause(true); wShedRows(); const b = document.querySelector('[data-crauto]'); const before = wCR.autoPow; if (b) b.click();
          const r = { btn: !!b, on: wCR.autoPow !== before }; W_SHED_MODE = 'play'; return r; })()""")
        check(ma == {'btn': True, 'on': True}, 'Manage has Auto powers', ma)
        ub = await pg.evaluate("""(() => { wShedGame({ seed: 9, mode: 'manage', hammer: 1 }); wCR.pause(true); const G = wCR.G, you = wCR.view.you; let n = 0;
          while (!(wCR.phase === 'addr' && wCR.view.up === you) && n++ < 40000) wCR.tick(.05); const m0 = G.mana[you]; G.mana[you] = 6; wCR.autoPow = true;
          const r = wCR.cast(you, 'pow'); const spent = G.mana[you] < 6; wCR.setMode('play'); __to('aim');
          const back = G.mana[you] === m0 && G.powStone[you] !== G.n;
          const sn = wCR.snapshot(); wCR.setMode('manage'); wCR.autoPow = true; const sn2 = wCR.snapshot(); wCR.resume(sn2); const kept = wCR.autoPow;
          wCR.resume(sn); wCR.pause(true); __to('aim');
          const sh = wCR.view.sel.shot, hitk = ['takeout', 'peel', 'hitroll'].includes(sh); G.mana[you] = 6; G.stones = [{ id: '1:0', s: 1, x: 3, y: 6 }];
          const c = wCR.cast(you, 'pow'), lock = wCR.select(hitk ? { shot: 'draw' } : { shot: 'takeout', target: '1:0' }), same = wCR.view.sel.shot === sh;
          W_SHED_MODE = 'play'; return { r, spent, back, kept, c, lock: !!lock, same }; })()""")
        check(ub['spent'] and ub['back'], 'your captain\'s casts on a stone you take back to throw yourself are undone', ub)
        check(ub['kept'], 'Auto powers is kept when a match is saved and resumed', ub)
        check(ub['c'] == '' and ub['lock'] and ub['same'], 'once a power is cast, the shot keeps to its kind (a draw power, a draw-kind shot)', ub)
        wt = await pg.evaluate("""(() => { wShedGame({ seed: 11, mode: 'play', hammer: 1 }); wCR.pause(true); __to('aim'); const G = wCR.G, you = wCR.view.you; const w0 = wCR.yourWt(1.1);
          G.fx[you] = { wt: .7 }; const w1 = wCR.yourWt(1.1); G.fx[you] = null; W_SHED_MODE = 'play'; return [w0, +w1.toFixed(3)]; })()""")
        check(abs(wt[0] - 1.1) < 1e-9 and abs(wt[1] - 1.07) < 1e-6, 'a weight power makes your own meter\'s weight truer', wt)
        await pg.evaluate("wCR.pause(true); showPage('help')")
        hp = await pg.evaluate("({ help: !!$('wHelpShedPowers'), how: ['Powers.', 'The roar'].every(w => ($('wShedHow') || {}).textContent.includes(w)) })")
        check(hp == {'help': True, 'how': True}, 'How to play explains powers', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
