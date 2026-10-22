import asyncio
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950})
        errs=[]; pg.on('console', lambda m: errs.append(m.text[:400]) if m.type=='error' and 'resource' not in m.text else None)
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(500)
        r = await pg.evaluate("""(() => { const bad = []; const cv = document.querySelector('#v-fight canvas') || document.querySelector('canvas'); 
          const ids = Object.keys(ENEMIES); const sts = Object.keys(ST);
          for (const id of ids) for (const sport of ['baseball','hockey','football','basketball','golf','bowling','boxing','curling','jousting']) {
            try { newRun(pick(CLUB_IDS),[0,1,2]); RUN.path=[]; RUN.clock = ri(0, 80); startCombat([id], ENEMIES[id].boss ? 'boss' : 'normal', sport); showView('fight'); renderFightHUD && renderFightHUD();
              for (const e of B.enemies) { for (const s of sts) if (Math.random() < .4) e.st[s] = ri(1, 9); e.hp = ri(1, e.max); e.block = ri(0, 30); }
              for (const s of sts) if (Math.random() < .3) B.P.st[s] = ri(1, 5);
              RUN.hp = ri(1, RUN.maxhp); B.sc.us = ri(0, 9); B.sc.them = ri(0, 9);
              for (const e of B.enemies) if (ENEMIES[e.id].boss) { try { bossPhaseCheck(e); } catch (x) { bad.push('phase ' + id + ': ' + x.message); } }
              const c = cv.getContext('2d');
              for (let f = 0; f < 4; f++) { consumeFx(); A.t += .3; c.setTransform(1,0,0,1,0,0); drawFight(c, .3); if (c.shadowBlur || c.filter !== 'none' || c.globalAlpha !== 1) { bad.push(`state leak ${id}/${sport}: blur ${c.shadowBlur} filter ${c.filter} alpha ${c.globalAlpha}`); c.shadowBlur = 0; c.filter = 'none'; c.globalAlpha = 1; } }
            } catch (x) { bad.push(id + '/' + sport + ': ' + x.message + ' ' + (x.stack || '').split('\\n')[1]); }
          }
          return [...new Set(bad)].slice(0, 20); })()""")
        print('\n'.join(r) or 'clean'); print(errs[:5])
        await b.close()
asyncio.run(main())
