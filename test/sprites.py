import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
# 1) parity: every kind drawn through the sprite cache matches a live draw at the same moment
# 2) speed: frame cost with and without sprites
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        r = await pg.evaluate("""(() => { const out = []; const team = CLUBS.ironmaw;
          const mk = () => { const cv = document.createElement('canvas'); cv.width = 600; cv.height = 500; return cv; };
          const kinds = Object.keys(KIND).filter(k => !BESPOKE.has(k));
          for (const kind of kinds) for (const hpx of [108, 150]) for (const flip of [false, true]) {
            const a = mk(), b2 = mk(), ca = a.getContext('2d'), cb = b2.getContext('2d');
            G.time = 3.0; const o = { num: 7, wpn: KIND_WPN[kind], wang: -1.15, flip };
            drawAny(ca, kind, 300, 420, hpx, team, Object.assign({}, o));
            SPR.clear(); drawWho(cb, kind, 300, 420, hpx, team, Object.assign({}, o, { sid: 'x', idle: true }));
            const da = ca.getImageData(0, 0, 600, 500).data, db = cb.getImageData(0, 0, 600, 500).data; let diff = 0, ink = 0;
            for (let i = 3; i < da.length; i += 4) { if (da[i] > 40) ink++; if (Math.abs(da[i] - db[i]) > 60) diff++; }
            if (diff / Math.max(1, ink) > .02) out.push(`${kind} ${hpx} ${flip ? 'flip' : ''}: ${(100 * diff / ink).toFixed(1)}% differs`);
          }
          return out; })()""")
        print('parity problems:', r or 'none')
        for on in [False, True]:
            t = await pg.evaluate(f"""(() => {{ SPR_ON = {str(on).lower()}; newRun('ironmaw',[0,1,2]); RUN.path=[]; beginFight({{ids:['skelss','lb','thief'], type:'normal', sport:'hockey'}}); A.banner = null; for (const k in A.ent) A.ent[k].enter = null;
              const c = cv.getContext('2d'); const T = []; for (let i = 0; i < 40; i++) {{ const t0 = performance.now(); c.setTransform(cv._d,0,0,cv._d,0,0); drawFight(c, 1/60); A.t += 1/60; G.time += 1/60; T.push(performance.now() - t0); }} T.sort((a,b)=>a-b); return T[20].toFixed(2); }})()""")
            print('sprites', 'on ' if on else 'off', 'median frame ms', t)
        print(errs)
        await b.close()
asyncio.run(main())
