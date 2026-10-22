import asyncio, json, sys, collections, statistics as st
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BOSSES={'argus','groundskeeper','cube','zamboni','banshee','baron','wyrm','mirror'}
ENEMY_BOSS=lambda d: d in BOSSES or 'kqueen' in d
from playwright.async_api import async_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 120
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script('window.__SD_LAB = true;')
        await pg.goto('file://' + ROOT + '/sudden-death.html')
        await pg.add_script_tag(path=ROOT + '/test/lab.js')
        allres = {}
        for route in ['safe', 'balanced', 'greedy']:
            logs = await pg.evaluate(f"(() => {{ const o=[]; for (let i=0;i<{N};i++) {{ try {{ o.push(LABRUN({{route:'{route}'}})); }} catch(e) {{ o.push({{err:String(e.stack||e)}}); }} }} return o; }})()")
            ok = [l for l in logs if 'err' not in l]; bad = [l['err'] for l in logs if 'err' in l]
            allres[route] = ok
            win = sum(l['result'] == 'win' for l in ok) / len(ok)
            died = collections.Counter(l['act'] for l in ok if l['result'] == 'lose')
            bh = {a: round(st.mean([l['bossHp%d' % a] for l in ok if 'bossHp%d' % a in l]), 1) for a in range(3) if any('bossHp%d' % a in l for l in ok)}
            reach = collections.Counter(min(l['act'], 2) + (1 if l['result'] == 'win' else 0) for l in ok)
            el = round(st.mean([l.get('elites', 0) for l in ok]), 1)
            bk = collections.Counter(l['death'] for l in ok if l['death'] and ENEMY_BOSS(l['death']))
            print(f"{route:9s} win={win:.2f} died_in_act={dict(sorted(died.items()))} boss_hp={bh} elites={el} boss_deaths={dict(bk)} deck={st.mean([l['deck'] for l in ok]):.0f} maxhp={st.mean([l['maxhp'] for l in ok]):.0f} errs={len(bad)} {bad[:1]}")
        json.dump(allres, open('/tmp/policy.json', 'w'))
        print('page errors', errs[:2])
        await b.close()
asyncio.run(main())
