import asyncio, json
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.add_init_script('window.__SD_LAB = true;')
        await pg.goto(GAME_URL)
        await pg.add_script_tag(path=ROOT + '/test/maps.js')
        for act in [0, 1, 2]:
            print(json.dumps(await pg.evaluate(f'MAPSTATS(400, {act})')))
        await b.close()
asyncio.run(main())
