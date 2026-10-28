import asyncio, json, sys, collections
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PATCH = sys.argv[2] if len(sys.argv) > 2 else ''   # optional JS run after load, to try a tuning, e.g. "SOCCER.theirs = 6"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script('window.__SD_LAB = true;')
        await pg.goto(GAME_URL)
        if PATCH: await pg.evaluate(PATCH)
        await pg.add_script_tag(path=ROOT + '/test/lab.js')
        logs = await pg.evaluate(f'(() => {{ const out = []; for (let i = 0; i < {N}; i++) {{ try {{ out.push(LABRUN()); }} catch (e) {{ out.push({{ err: String(e.stack || e) }}); }} }} return out; }})()')
        json.dump(logs, open('/tmp/lab.json', 'w'))
        errsR = [l['err'] for l in logs if 'err' in l]
        print('page errors', errs[:3]); print('run errors', len(errsR), errsR[:2])
        ok = [l for l in logs if 'err' not in l]
        res = collections.Counter(l['result'] for l in ok); print('results', dict(res))
        acts = collections.Counter(l['act'] for l in ok if l['result'] == 'lose'); print('died in act', dict(acts))
        deaths = collections.Counter(l['death'] for l in ok if l['death']); print('killers', deaths.most_common(12))
        stall = sum(1 for l in ok for f in l['fights'] if f['stall']); print('stalls', stall)
        # damage taken per encounter
        agg = collections.defaultdict(list)
        for l in ok:
            for f in l['fights']: agg[f['ids']].append((f['lost'], f['turns']))
        for k, v in sorted(agg.items(), key=lambda kv: -sum(x[0] for x in kv[1]) / len(kv[1])):
            print(f"  {k:28s} n={len(v):4d} lost={sum(x[0] for x in v)/len(v):6.1f} turns={sum(x[1] for x in v)/len(v):5.1f}")
        sp = collections.defaultdict(list)
        for l in ok:
            for f in l['fights']:
                if f['type'] == 'normal': sp[(f['act'], f['sport'])].append(f['lost'])
        print('by act/sport (normal fights):')
        for k in sorted(sp): print('  ', k, len(sp[k]), round(sum(sp[k]) / len(sp[k]), 1))
        clubs = collections.defaultdict(lambda: [0, 0])
        for l in ok: clubs[l['club']][0] += 1; clubs[l['club']][1] += l['result'] == 'win'
        print('clubs', dict(clubs))
        sw = collections.defaultdict(lambda: [0, 0]); hls = collections.Counter()
        for l in ok:
            for f in l['fights']:
                if f['res'] == 'win': sw[f['sport']][0] += 1; sw[f['sport']][1] += f['sw']
                for h in f['hl']: hls[h] += 1
        print('sports win rate', {k: (v[0], round(v[1] / v[0], 2)) for k, v in sw.items()})
        print('highlights', hls.most_common())
        await b.close()
asyncio.run(main())
