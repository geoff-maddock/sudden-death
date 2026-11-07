# Seeded runs (issue #60, phase 1): the same seed gives the same run, however you play the rooms before it.
# Asserts; exits non-zero on any failure.
import asyncio, os, re, subprocess, sys
from paths import ROOT, GAME_URL, GAME_BUILD
from playwright.async_api import async_playwright

subprocess.run(GAME_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script('window.__SD_LAB = true;')
        await pg.goto(GAME_URL)
        await pg.add_script_tag(path=os.path.join(ROOT, 'test', 'lab.js'))
        r = await pg.evaluate("""(() => {
          const out = {};
          const run = (seed, o = {}) => JSON.stringify(LABRUN(Object.assign({ seed, club: 'ironmaw', picks: [0, 1, 2], diff: 0 }, o)));
          const deck = () => RUN.deck.map(c => c.id + (c.up ? '+' : '')).join(',');
          // 1. the same seed, played the same way, twice (and again after unseeded runs in between)
          const a = run(12345), da = deck();
          LABRUN({ club: 'ironmaw', picks: [0, 1, 2] }); LABRUN({ club: 'ironmaw', picks: [0, 1, 2] });
          const a2 = run(12345), da2 = deck();
          out.same = a === a2 && da === da2; out.fights = JSON.parse(a).fights.length;
          out.diff = run(99) !== a;
          // 2. each act's map depends only on the seed
          const maps = s => { newRun('ironmaw', [0, 1, 2], undefined, undefined, s); return [0, 1, 2].map(k => JSON.stringify(genMap(k).nodes)); };
          const m1 = maps(777); for (let i = 0; i < 50; i++) R(); const m2 = maps(777);
          out.maps = m1.join() === m2.join(); out.mapsDiffer = maps(778)[0] !== m1[0];
          // 3. the first act's map, and the first fight, don't care how carefully you play
          const first = o => { const l = LABRUN(Object.assign({ seed: 4242, club: 'ironmaw', picks: [0, 1, 2], diff: 0 }, o)); return l.fights[0].ids + '|' + l.fights[0].sport; };
          const firstMap = () => { newRun('ironmaw', [0, 1, 2], undefined, undefined, 4242); return JSON.stringify(RUN.map.nodes); };
          out.firstFight = first({}) === first({ dumb: true });
          out.firstMap = firstMap() === firstMap();
          // 4. the fight stream is saved with B, so a restored fight carries on the same way
          newRun('ironmaw', [0, 1, 2], undefined, undefined, 31337); RUN.path = []; RUN.pos = RUN.map.start ? RUN.map.start : Object.keys(RUN.map.nodes)[0];
          startCombat(['lb', 'skelss'], 'normal', 'hockey');
          const snap = JSON.parse(JSON.stringify(B)); const seqA = [R(), R(), R(), R()].join();
          restoreBattle(snap); const seqB = [R(), R(), R(), R()].join();
          out.restore = seqA === seqB; out.bHasRng = typeof snap.rng === 'number';
          // 5. a fight doesn't move the room's run stream
          const rs = RUN.rng; R(); R(); out.fightKeepsRun = RUN.rng === rs;
          // 6. no seed (the Realm, older saves, most tests): Math.random as before
          newRun('ironmaw', [0, 1, 2]); out.unseeded = RUN.seed == null; out.unseededVaries = [R(), R()].join() !== [R(), R()].join();
          startCombat(['lb'], 'normal', 'hockey'); out.unseededFight = B.rng == null;
          // 7. a new run ignores an unfinished fight from an earlier one
          const map0 = s => { newRun('ironmaw', [0, 1, 2], undefined, undefined, s); return JSON.stringify(RUN.map.nodes) + JSON.stringify(RUN.goals); };
          const clean = map0(555); newRun('ironmaw', [0, 1, 2], undefined, undefined, 9); RUN.path = []; RUN.pos = Object.keys(RUN.map.nodes)[0];
          startCombat(['lb'], 'normal', 'hockey'); out.leftover = !B.over && B.rng != null; out.afterFight = map0(555) === clean;
          // 8. the act's boss is the same whether the map screen or the boss room asks first
          const bossFrom = pos => { newRun('ironmaw', [0, 1, 2], undefined, undefined, 2024); RUN.pos = pos; return bossId(); };
          out.boss = [null, 'boss', Object.keys(RUN.map.nodes)[3]].map(bossFrom); out.bossSame = new Set(out.boss).size === 1;
          // 9. the season goal's rare cards are rolled once: Later and reopening shows the same three
          newRun('ironmaw', [0, 1, 2], undefined, undefined, 808); RUN.path = []; RUN.rareTokens = 1;
          RUN.panel = { t: 'reward', type: 'normal', rw: { gold: 10, cards: [], sports: null } };
          const offer = () => { renderPanel(); const b = [...document.querySelectorAll('#rwList .reward')].find(x => /rare card/.test(x.textContent)); b.click();
            const ids = [...document.querySelectorAll('#modalBox [data-gr]')].map(x => x.textContent).join('|'); document.querySelector('#modalBox [data-close]').click(); return ids; };
          const o1 = offer(); R(); R(); RUN.pos = Object.keys(RUN.map.nodes)[2]; const o2 = offer(); out.rareSame = !!o1 && o1 === o2;
          // 10. a lab run on a seed, free agents and club picks included, plays the same twice
          const free = () => JSON.stringify(LABRUN({ seed: 77, free: true, diff: 0 })) + RUN.party.map(p => p.n).join();
          const club = () => JSON.stringify(LABRUN({ seed: 78, diff: 0 }));
          out.labFree = free() === free(); out.labClub = club() === club();
          return out;
        })()""")
        print(r)
        check(r['fights'] > 0, 'the seeded bot run played some fights')
        check(r['same'], 'the same seed played the same way gives the same run (fights, result and deck)')
        check(r['diff'], 'a different seed gives a different run')
        check(r['maps'], "each act's map depends only on the seed")
        check(r['mapsDiffer'], 'a different seed gives a different map')
        check(r['firstMap'], 'the first map is the same every time for a seed')
        check(r['firstFight'], 'the first fight is the same however carefully you play')
        check(r['bHasRng'], 'the fight stream is saved in B as a number')
        check(r['restore'], 'a fight restored from a snapshot draws the same numbers')
        check(r['fightKeepsRun'], "drawing in a fight doesn't move the run stream")
        check(r['leftover'] and r['afterFight'], 'a new run ignores an unfinished fight from an earlier run')
        check(r['bossSame'], f"the act's boss doesn't depend on where it is first asked for {r['boss']}")
        check(r['rareSame'], "the season goal's three rare cards stay the same after Later and in another room")
        check(r['labFree'] and r['labClub'], 'a seeded lab run (free agents, or a club and picks from the seed) plays the same twice')
        check(r['unseeded'] and r['unseededVaries'] and r['unseededFight'], 'a run without a seed uses Math.random')
        # the cosmetic code never takes from the seeded streams
        cosmetic = ['src/ui/fight/scene.js', 'src/ui/fight/arena.js', 'src/ui/fight/field.js', 'src/ui/fight/sky-view.js', 'src/app/sound.js', 'src/app/music.js',
                    'src/render/vfx.js', 'src/render/boss-art.js', 'src/render/creatures.js', 'src/ui/screens/treasure.js']
        for f in cosmetic:
            src = open(os.path.join(ROOT, f)).read()
            check(not re.search(r'(?<![\w.])(R|pick|shuffle|ri|d20|wpick|randomRelic)\(', src), f'{f} uses Math.random or pickFx, never the seeded helpers')
        check(not errs, f'no page errors {errs[:2]}')
        await b.close()

asyncio.run(main())
if fails:
    print('errors:', fails); sys.exit(1)
print('all seeded checks passed')
