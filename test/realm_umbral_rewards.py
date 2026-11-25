# Realm: the Umbral's rewards and the after (issue #99, phase 6). How to play has only a closed line before the
# Crown, and the Umbral section after. The profile's medal grows with the pieces. Forging the Seal gives the Seal of the
# Crown (6 Block a match, a card more in your first hand), the cleanest-beaten champion as a recruit, and the legend
# mark on your team's portrait; a later journey sees the mark in the Hall of Legends and starts with the rumour.
# Asserts; exits nonzero on failure.
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbAch === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        await pg.evaluate("showPage('help')")
        h0 = await pg.evaluate("(() => { const h = document.getElementById('wHelpUmbral'); return h ? h.textContent : ''; })()")
        q0 = await pg.evaluate("!!document.querySelector('#wQuick [data-wq=\"umbral\"]')")
        await pg.evaluate("showPage('play'); wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; document.getElementById('wHelpUmbral') && document.getElementById('wHelpUmbral').remove(); showPage('help')")
        h1 = await pg.evaluate("(() => { const h = document.getElementById('wHelpUmbral'); return h ? h.textContent : ''; })()")
        await pg.evaluate("showPage('play')")
        check(not q0, 'before the Crown the Quick start has no Umbral tab', q0)
        check('After the Crown' in h0 and 'lantern' not in h0 and 'Aurelia' not in h0, 'before the Crown, How to play has only a closed line about the Umbral', h0[:200])
        check(all(w in h1 for w in ['portal', 'tier U', 'lantern', 'Gatekeeper', 'Hollow Aurelia', 'hexes']), 'after it opens, How to play explains the Umbral', h1[:300])
        await pg.evaluate("showPage('help')")
        qk = await pg.evaluate("(() => { const p = document.querySelector('#wQuick [data-wqp=\"umbral\"]'); return { tab: !!document.querySelector('#wQuick [data-wq=\"umbral\"]'), steps: p ? p.querySelectorAll('.wqsteps li').length : 0, text: p ? p.textContent : '' }; })()")
        await pg.evaluate("showPage('play')")
        check(qk['tab'] and qk['steps'] >= 10 and qk['text'].count('Dark traits that bend the rules') == 1 and 'undefined' not in qk['text'] and all(w in qk['text'] for w in ['Dark traits that bend the rules', 'The Phantom Pitch', 'The Ice Opens', 'Hoarfrost', 'Shades in the Deck']), 'once it is open, the Quick start has a tab of every way to play\'s hexes, each with its words (and the dark traits, phase E)', {k: qk[k] for k in ['tab', 'steps']})

        md = await pg.evaluate("""(() => { const U = WG.umbral; ACHS.stats.realmUmbral = 0; W_ON_END.nadir('win', { id: 'gate' }); const one = ACHS.stats.realmUmbral;
          return { one, ach: ACH.some(a => a.id === 'w_umbral') }; })()""")
        check(md == {'one': 1, 'ach': True}, 'the profile medal counts the first piece', md)

        sl = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; U.pieces = Object.keys(W_UMB_PIECES); U.tries = {}; U.beaten = { gate: WG.dayAbs };
          WG.legId = 'Ltest'; wLegendsSave([{ id: 'Ltest', name: 'Us', short: 'US', color: '#c94a3a', light: '#fff', year: WG.year, crowns: 1, at: '2026-11-21', players: [] }]);
          const n0 = wRoster().length; U.finale = W_UMB5.rounds - 1; wUmbSeal();
          // (the piece above left its card pick open: the world must be free for the scene)
          WG.cardOffer = null; for (let k = 0; k < 6 && !document.getElementById('modal').hidden; k++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          wNextPrompt(); out.relic = RUN.relics.includes('umbseal'); out.scene = !!document.getElementById('wUmbSealed');
          out.queued = (WG.wprompts || []).some(P => P.t === 'recruit' && P.p.n === 'Morrow Vane'); out.redeemed = U.redeemed;
          out.mark = (wLegendsAll().find(l => l.id === 'Ltest') || {}).sealed;
          // (a later Crown writes the portrait again: the mark stays)
          wCupWon('crown'); out.mark2 = (wLegendsAll().find(l => l.id === 'Ltest') || {}).sealed;
          out.medal = ACHS.stats.realmUmbral; out.rumour = JSON.parse(localStorage.getItem(pkey('sd-realm-umbral')) || 'null');
          const sc = document.getElementById('wUmbSealed'); if (sc) sc.click();
          for (const P of WG.wprompts.splice(0)) if (P.t === 'recruit') wAddPlayer(P.p); out.recruit = wRoster().length - n0 === 1 && wRoster().some(p => p.n === 'Morrow Vane');
          out.dreams = wSay('hq_inn', 'dreams').text;
          return out; })()""")
        check(sl['relic'] and sl['scene'] and sl['queued'] and sl['recruit'] and sl['redeemed'] == 'gate', 'forging the Seal gives the Seal of the Crown, shows its scene, and the cleanest-beaten champion asks to join once the world is free', sl)
        check(sl['mark2'] and 'stopped' in sl['dreams'], 'a later Crown keeps the legend mark; the innkeepers\' dreams are over', sl)
        check(sl['mark'] and sl['medal'] == 10 and sl['rumour'] and sl['rumour']['sealed'] == 1, 'it marks your team\'s portrait, fills the medal (gold for the Seal), and the profile remembers', sl)

        tr = await pg.evaluate("""(() => { const out = {}, keep = beginFight; beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); };
          const go = () => { RUN.pending = null; B = null; LAB = true; startMatch({ type: 'normal', ids: ['skelss'], tier: 1, world: { kind: 'wild', ref: null, region: 'plains' } }); LAB = false; const r = { block: B.P.block, hand: B.hand.length }; B = null; RUN.pending = null; return r; };
          wEnterMap('graftonbury', 5, 11); out.with = go(); RUN.relics = RUN.relics.filter(r => r !== 'umbseal'); out.without = go(); RUN.relics.push('umbseal'); beginFight = keep; return out; })()""")
        check(tr['with']['block'] - tr['without']['block'] == 6 and tr['with']['hand'] - tr['without']['hand'] == 1, 'the Seal of the Crown: 6 Block at the start of a match, and a card more in the first hand', tr)

        ng = await pg.evaluate("""(() => { wStart(null, {}); const rumour = WLOG.some(l => /but not locked/.test(l[0]));
          WG.legends = [{ id: 'Lold', name: 'Them', short: 'TH', color: '#3f5a8a', light: '#fff', year: 2, crowns: 1, at: '2026-11-20', players: [], sealed: 3 }]; wOpenLegends();
          const t = document.getElementById('modalBox').textContent; document.querySelector('#modalBox [data-close]').click(); return { rumour, hall: /sealed the Umbral in year 3/.test(t) }; })()""")
        check(ng == {'rumour': True, 'hall': True}, 'a later journey starts with the rumour, and the Hall of Legends shows the mark', ng)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
