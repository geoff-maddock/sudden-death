import asyncio, sys, json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
# Difficulty probe. Usage: difficulty.py N '{"draw":4}' [dumb]
# Reports, for a skilled bot (and optionally a careless one): win rate, deaths by act, HP lost per Act 1 brawl,
# HP going into each boss, fight length. The gap between the two bots is a rough measure of how much skill matters.
DIFF = next((a.split('=')[1] for a in sys.argv if a.startswith('diff=')), 'null'); N = int(sys.argv[1]); tune = sys.argv[2] if len(sys.argv) > 2 else '{}'; both = 'dumb' in sys.argv
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.add_init_script('window.__SD_LAB = true;')
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.add_script_tag(path=ROOT + '/test/lab.js')
        for dumb in ([False, True] if both else [False]):
            r = await pg.evaluate(f"""(() => {{ Object.assign(TUNE, {tune}); const S = {{ win: 0, died: [0,0,0], a1lost: [], a1turns: [], boss: [[],[],[]], elLost: [] }};
              for (let i = 0; i < {N}; i++) {{ const l = LABRUN({{ route: 'balanced', dumb: {str(dumb).lower()}, diff: {DIFF} }});
                if (l.result === 'win') S.win++; else S.died[l.act]++;
                for (const f of l.fights) {{ if (f.act === 0 && f.type === 'normal' && f.res !== 'lose') {{ S.a1lost.push(f.lost); S.a1turns.push(f.turns); }} if (f.type === 'elite' && f.res !== 'lose') S.elLost.push(f.lost); }}
                for (const a of [0,1,2]) if (l['bossHp' + a] != null) S.boss[a].push(l['bossHp' + a]); }}
              const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-';
              return {{ win: (S.win / {N}).toFixed(2), died: S.died, a1lost: avg(S.a1lost), a1turns: avg(S.a1turns), eliteLost: avg(S.elLost), hpIntoBoss: S.boss.map(avg) }}; }})()""")
            print('careless' if dumb else 'skilled ', tune, json.dumps(r), flush=True)
        await b.close()
asyncio.run(main())
