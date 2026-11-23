# Realm: feats, resonance and the Seal's edges (issue #111, phase G). Every champion has a feat, named on their card;
# meeting it (or winning at the first try) wins the piece well, missing it still wins the piece. Golf, bowling and
# curling offer "Play without powers", which reaches the engine as powers [false, true] and is remembered in the game's
# ref. Each held piece's boon applies on the dark side, twice as strong won well (cheaper spikes and tolls, shorter
# shadow sight, Block in card and shadow matches, gold kept through a blackout). The Seal's round for a piece won well by
# its feat draws a hex fewer. Old journeys keep the first-try rule. The journal shows the Seal panel. Asserts.
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

CLOSE = "document.getElementById('modal').hidden = true; MODAL_NOW = null;"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        pg.set_default_timeout(120000)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbResonance === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; WG.hardcore = false; WG.umbral.dreadSeen = 3; RUN.gold = 999; wUmbWellInit(); wSave()")

        fs = await pg.evaluate("(() => Object.keys(W_NADIR).filter(k => W_NADIR[k].piece && k !== 'finale').map(k => [k, !!wUmbFeat(k)]))()")
        check(len(fs) == 9 and all(f[1] for f in fs), 'every one of the nine champions has a feat', fs)

        cd = await pg.evaluate(f"""(() => {{ const out = {{}};
          wNadirMatch('gate'); const b = document.querySelector('#modalBox .wumbfeat'); out.gate = b ? b.textContent : ''; {CLOSE}
          const U = WG.umbral; WG.min = 23 * 60; U.guards = {{ 'g_links:0': 1, 'g_links:1': 1 }}; U.gates = Object.assign(U.gates || {{}}, {{ links: 1 }});
          wNadirMatch('links'); const cb = document.getElementById('wUmbNoPow'); out.box = !!cb; if (cb) {{ cb.checked = true; cb.onchange(); }} out.chosen = U.nopow; {CLOSE}
          return out; }})()""")
        check('last legs' in cd['gate'] and 'first try' in cd['gate'], 'the Gatekeeper\'s card names the feat', cd)
        check(cd['box'] and cd['chosen'] == 'links', 'a golf champion\'s card offers Play without powers', cd)

        np = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; U.nopow = 'links'; W_UMB8J.lastPowers = null; let ref = null; WG.min = 23 * 60;
          const e0 = W_ON_END.unadirgl; W_ON_END.unadirgl = function (r, rf) { ref = rf; return e0.apply(this, arguments); };
          LAB = true; try { wNadirMatch('links'); } finally { LAB = false; W_ON_END.unadirgl = e0; }
          out.powers = W_UMB8J.lastPowers; out.ref = ref && ref.nopow; out.cleared = U.nopow;
          // a start that refuses gives the choice back
          U.nopow = 'links'; const o0 = WG.lkg.live; WG.lkg.live = { world: { kind: 'lkgame' } }; const why = wStartLinks({ club: 'nadir:links', how: 'sim', kind: 'unadirgl', ref: { id: 'links' }, cup: true }); WG.lkg.live = o0;
          out.refused = [!!why, U.nopow]; U.nopow = null; return out; })()""")
        check(np['powers'] == [False, True] and np['ref'] == 1 and np['cleared'] is None and np['refused'] == [True, 'links'], 'without powers reaches the engine as [false, true], in the game’s ref, and is used up', np)

        ft = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; const reset = p => { U.pieces = U.pieces.filter(x => x !== p); delete U.well[p]; };
          // margin feat (baseball by 4), not at the first try: a 5-0 win is well, a 3-1 win (meets the condition) is not
          reset('baseball'); U.tries.diamond = 1; W_ON_END.unadir_ball('win', { id: 'diamond' }, { us: 5, them: 0 }); out.wide = [U.pieces.includes('baseball'), !!U.well.baseball];
          reset('baseball'); U.tries.diamond = 1; W_ON_END.unadir_ball('win', { id: 'diamond' }, { us: 3, them: 1 }); out.narrow = [U.pieces.includes('baseball'), !!U.well.baseball];
          // first-try feat (basketball): won at the first try is well
          reset('basketball'); U.tries.court = 0; W_ON_END.unadirbk('win', { id: 'court' }, {}); out.first = [U.pieces.includes('basketball'), !!U.well.basketball];
          // night (football)
          reset('football'); U.tries.gridiron = 2; const m0 = WG.min; WG.min = 12 * 60; W_ON_END.unadirgf('win', { id: 'gridiron' }, {}); out.day = !!U.well.football;
          reset('football'); U.tries.gridiron = 2; WG.min = 23 * 60; W_ON_END.unadirgf('win', { id: 'gridiron' }, {}); out.night = !!U.well.football; WG.min = m0;
          // night, judged by the hour it kicked off, per champion: kicked off at night, another game in between, won by day
          reset('football'); U.tries.gridiron = 2; WG.min = 23 * 60; wUmbTollAtKickoff('gridiron'); WG.min = 12 * 60; wUmbTollAtKickoff('rink');
          W_ON_END.unadirgf('win', { id: 'gridiron' }, {}); out.kicked = !!U.well.football; WG.min = m0; U.kickNight = {};
          // nopowers (curling): the ref says so
          reset('curling'); U.tries.shed = 1; W_ON_END.unadircr('win', { id: 'shed', nopow: 1 }, {}); out.nopow = !!U.well.curling;
          reset('curling'); U.tries.shed = 1; W_ON_END.unadircr('win', { id: 'shed' }, {}); out.pow = !!U.well.curling;
          // brink (the card game), from the HP when the match was won
          reset('card'); U.tries.gate = 1; W_UMB8J.winHp = [10, 100]; W_ON_END.nadir('win', { id: 'gate' }, { kind: 'nadir' }); out.brink = !!U.well.card;
          reset('card'); U.tries.gate = 1; W_UMB8J.winHp = [60, 100]; W_ON_END.nadir('win', { id: 'gate' }, { kind: 'nadir' }); out.fresh = !!U.well.card;
          // the HP is read where the win is decided, before an on-win heal: a won match at 10 HP reads 10
          B = { over: null, enemies: [], P: { st: {} } }; RUN.pending = { world: { kind: 'nadir', ref: { id: 'gate' } } }; RUN.hp = 10; W_UMB8J.winHp = null;
          const sf = sportFinal; sportFinal = () => {}; try { checkWin(); } finally { sportFinal = sf; }
          out.snap = W_UMB8J.winHp && W_UMB8J.winHp[0]; B = null; RUN.pending = null; RUN.hp = RUN.maxhp;
          return out; })()""")
        check(ft['wide'] == [True, True] and ft['narrow'] == [True, False], 'a margin feat: a wide win is well, a narrower win still takes the piece', ft)
        check(ft['first'] == [True, True], 'a first-try win is well', ft)
        check(not ft['day'] and ft['night'] and ft['kicked'], 'the night feat: well after dark only, judged by the hour each game kicked off', ft)
        check(ft['nopow'] and not ft['pow'], 'the no-powers feat follows the game’s ref', ft)
        check(ft['brink'] and not ft['fresh'] and ft['snap'] == 10, 'the brink feat follows the HP as the match was won (read where the win is decided)', ft)

        rs = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; const all = Object.keys(W_UMB_PIECES);
          U.pieces = []; U.well = {}; out.none = [wUmbSpikeHp(), wUmbShadowSight()];
          U.pieces = ['basketball', 'baseball']; out.held = [wUmbResonance('basketball'), wUmbSpikeHp(), wUmbShadowSight()];
          U.well = { basketball: 1, baseball: 1 }; out.well = [wUmbResonance('basketball'), wUmbSpikeHp(), wUmbShadowSight()];
          // the Broken Bell: a toll 10 cheaper (20 won well)
          U.pieces.push('boxing'); U.tries.rink = 1; U.paid = {}; let g0 = RUN.gold; wUmbTollAtKickoff('rink'); out.toll = g0 - RUN.gold; out.tollKept = W_NADIR.rink.toll;
          // and through the card's gold check: 22 gold is enough for a 30-gold toll cut to 20
          RUN.gold = 22; U.guards = Object.assign(U.guards || {}, { 'g_rink:0': 1, 'g_rink:1': 1 }); U.gates = Object.assign(U.gates || {}, { rink: 1 });
          const why = wNadirMatch('rink'); out.tollWhy = why; out.card = !document.getElementById('modal').hidden; document.getElementById('modal').hidden = true; MODAL_NOW = null; RUN.gold = 999;
          // the Ash Ball: a blackout keeps half the gold
          U.pieces.push('football'); wEnterMap('u:umbralden', 5, 5); RUN.gold = 1000; LAB = true; try { wBlackout({ kind: 'wild', tier: 3 }, 'lose'); } finally { LAB = false; } out.black = RUN.gold;
          // old journey: a piece held before this part, never lost, is well by the first-try rule
          const keep = [U.well, U.wellLegacy]; U.well = {}; U.wellLegacy = ['hockey']; U.pieces.push('hockey'); U.tries.rink = 0; out.legacy = wUmbWell('hockey'); U.well = keep[0]; U.wellLegacy = keep[1];
          return out; })()""")
        check(rs['none'][0] == 2 and rs['held'][:2] == [1, 1] and rs['well'][:2] == [2, 0], 'the Black Net: spikes 1 HP cheaper held, 2 won well', rs)
        check(rs['held'][2] == rs['none'][1] - 1 and rs['well'][2] == max(1, rs['none'][1] - 2), 'the Iron Stitch: the shadows see 1 step less held, 2 won well', rs)
        check(rs['toll'] == 20 and rs['tollKept'] == 30 and not rs['tollWhy'] and rs['card'], 'the Broken Bell: a 30-gold toll costs 20, and the champion’s own toll is left alone', rs)
        check(rs['black'] == 950, 'the Ash Ball: a blackout on the dark side loses half the gold it would', rs)
        check(rs['legacy'], 'an old journey’s piece keeps the first-try rule', rs)

        bk = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; U.pieces = ['card', 'curling']; U.well = { card: 1 };
          const go = (w) => { LAB = true; RUN.pending = null; try { startMatch({ type: 'normal', tier: 3, world: Object.assign({ region: 'rime', umbral: 1 }, w) }); } finally { LAB = false; } const b = B && B.P ? B.P.block : -1; RUN.pending = null; B = null; return b; };
          wEnterMap('u:umbralden', 5, 5); out.wild = go({ kind: 'wild' }); out.shadow = go({ kind: 'shadow', ref: { id: 'x' } });
          U.pieces = []; out.bare = go({ kind: 'wild' }); showView('world'); return out; })()""")
        check(bk['wild'] - bk['bare'] == 8 and bk['shadow'] - bk['wild'] == 6, 'Block on the dark side: the Cracked Card won well 8, and the Sunken Stone 6 more against shadows', bk)

        fe = await pg.evaluate("""(() => { const U = WG.umbral, ps = Object.keys(W_UMB_PIECES); U.pieces = ps.slice(); U.finale = 0; U.finaleSports = ['hockey', 'golf', 'card'];
          U.tries.rink = 2; U.well = { hockey: 1 }; U.wellLegacy = []; const a = wUmbFinaleEntry().hexes;
          U.well = {}; const b = wUmbFinaleEntry().hexes; U.finaleSports = null; return [a, b]; })()""")
        check(fe == [1, 2], 'the Seal’s round for a piece won well by its feat draws a hex fewer', fe)

        jp = await pg.evaluate(f"""(() => {{ const U = WG.umbral; U.pieces = ['card']; U.well = {{ card: 1 }}; WJ.tab = 'umbral'; wOpenJournal(); const s = document.querySelector('#modalBox .wumbseal'); const t = s ? s.textContent : ''; {CLOSE} return t; }})()""")
        check('The Cracked Card' in jp and 'won well' in jp and 'still out' in jp, 'the journal shows the Seal panel', jp[:200])
        hp = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpUmbFeats'); return h ? h.textContent : ''; })()")
        check('won well' in hp, 'How to play explains feats and the pieces’ songs', hp[:160])
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\nall ok' if not FAILS else f'\n{len(FAILS)} FAILED'); sys.exit(1 if FAILS else 0)

asyncio.run(main())
