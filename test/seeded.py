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
          const snap = JSON.stringify(B); const seqA = [R(), R(), R(), R()].join();
          B = JSON.parse(snap); const seqB = [R(), R(), R(), R()].join();
          out.restore = seqA === seqB; out.bHasRng = typeof JSON.parse(snap).rng === 'number';
          // 5. a fight doesn't move the room's run stream
          const rs = RUN.rng; R(); R(); out.fightKeepsRun = RUN.rng === rs;
          // 6. no seed (the Realm, older saves, most tests): Math.random as before
          newRun('ironmaw', [0, 1, 2]); out.unseeded = RUN.seed == null; out.unseededVaries = [R(), R()].join() !== [R(), R()].join();
          startCombat(['lb'], 'normal', 'hockey'); out.unseededFight = B.rng == null;
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
        check(r['unseeded'] and r['unseededVaries'] and r['unseededFight'], 'a run without a seed uses Math.random')
        # the cosmetic code never takes from the seeded streams
        for f in ['src/ui/fight/scene.js', 'src/app/sound.js', 'src/render/vfx.js', 'src/ui/screens/treasure.js']:
            src = open(os.path.join(ROOT, f)).read()
            check(not re.search(r'(?<![\w.])(R\(\)|pick\(|shuffle\()', src), f'{f} uses Math.random, not R/pick/shuffle')
        check(not errs, f'no page errors {errs[:2]}')
        await b.close()

asyncio.run(main())
if fails:
    print('errors:', fails); sys.exit(1)
print('all seeded checks passed')
