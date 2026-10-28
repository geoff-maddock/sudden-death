import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
# every trophy that has a hook does what it says, checked one at a time in a lab fight
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.add_init_script('window.__SD_LAB = true;')
        await pg.goto(GAME_URL); await pg.add_script_tag(path=ROOT + '/test/lab.js')
        r = await pg.evaluate("""(() => { LAB = true; const res = {};
          const fight = (rel) => { newRun('ironmaw', [0,1,2]); RUN.relics = rel ? [rel] : []; RUN.path = []; RUN.clock = 1; startCombat(['skelss','lb'], 'normal', 'golf'); return B; };
          const base = fight(null); const b0 = { blk: B.P.block, str: sv(B.P,'str'), dex: sv(B.P,'dex'), hand: B.hand.length, en: B.energy, e: B.enemies.map(e => ({ psn: sv(e,'psn'), weak: sv(e,'weak'), vuln: sv(e,'vuln'), str: sv(e,'str'), hp: e.hp, max: e.max })) };
          const chk = (rel, fn) => { try { fight(rel); res[rel] = fn() ? 'ok' : 'FAIL'; } catch (x) { res[rel] = 'ERR ' + x.message; } };
          chk('boots', () => B.P.block >= 10 && sv(B.P,'dex') === b0.dex + 1);
          chk('gauntlets', () => sv(B.P,'str') === b0.str + 1);
          chk('bracers', () => sv(B.P,'dex') === b0.dex + 1);
          chk('lantern', () => B.enemies.every(e => sv(e,'psn') >= 3));
          chk('horn', () => B.enemies.every(e => sv(e,'weak') >= 2 && sv(e,'vuln') >= 1));
          chk('whistle', () => B.enemies.every(e => sv(e,'vuln') >= 1));
          chk('clipboard', () => B.enemies.every(e => sv(e,'str') >= 1) && B.hand.length === b0.hand + 2);
          chk('oldball', () => B.enemies.every(e => e.hp <= e.max - 3));
          chk('goldpuck', () => B.hand.some(c => c.id === 'frostbite'));
          chk('speed', () => B.energy === b0.en + 1);
          chk('playbook', () => B.hand.length === b0.hand + 1);
          chk('bag', () => B.hand.length === b0.hand + 2);
          chk('luckstone', () => mod('d20') === 2);
          chk('mitt', () => mod('rewardGold') === 10);
          chk('champring', () => { const g = RUN.gold; gainGold(100); return RUN.gold - g === 125; });
          chk('cupreplica', () => mod('choices') === 1);
          chk('goldenboot', () => { const golf = mod('passes'); B.sport = 'soccer'; const n = mod('passes'); B.sport = 'golf'; return golf === 0 && n === 1; });
          chk('bowling', () => { B.hand.unshift(mkCard('check')); B.energy = 9; const t = B.enemies[0], h = t.hp + t.block; playCard(0, t.uid); const first = h - (t.hp + t.block); B.hand.unshift(mkCard('check')); const h2 = t.hp + t.block; playCard(0, t.uid); const second = h2 - (t.hp + t.block); return first === second + 8; });
          chk('chalice', () => { RUN.hp = 50; B.enemies[0].hp = 1; B.hand.unshift(mkCard('check')); B.energy = 9; playCard(0, B.enemies[0].uid); return RUN.hp === 53; });
          chk('skates', () => { const n = B.hand.length; B.hand.unshift(mkCard('hold')); B.energy = 9; playCard(0); return B.hand.length === n + 1; });
          chk('towel', () => { B.energy = 9; for (let i = 0; i < 4; i++) B.hand.unshift(mkCard('hold')); for (let i = 0; i < 4; i++) playCard(0); return B.energy === 9 - 4 + 1; });
          chk('jersey', () => { RUN.hp = 3; loseHP(10, 'test'); return RUN.hp === 15 && !B.over; });
          chk('icepack', () => { RUN.hp = 40; fire('fightWon'); return RUN.hp === 44; });
          chk('ring', () => { RUN.hp = 40; fire('turnEndHeal'); return RUN.hp === 41; });
          chk('rallycap', () => { RUN.hp = 10; B.P.block = 0; fire('turnEnd'); return B.P.block === 6; });
          chk('foam', () => { B.energy = 9; const t = B.enemies[1]; for (let i = 0; i < 3; i++) B.hand.unshift(mkCard('check')); const before = B.enemies[0].hp + B.enemies[0].block; for (let i = 0; i < 3; i++) playCard(0, t.uid); return B.enemies[0].hp + B.enemies[0].block <= before - 5; });
          chk('sled', () => { B.turn = 2; fire('turnStart'); const a = sv(B.P,'str'); B.turn = 3; fire('turnStart'); return sv(B.P,'str') === a + 2; });
          return res; })()""")
        bad = {k: v for k, v in r.items() if v != 'ok'}
        print(len(r), 'trophies checked; problems:', bad or 'none')
        await b.close()
asyncio.run(main())
