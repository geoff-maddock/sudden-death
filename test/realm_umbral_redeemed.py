# Realm: the redeemed captain as a superstar (issue #111, phase I1). Forging the Seal queues the cleanest-beaten Nadir
# champion as a star (p.star = their character id, wStar finds them), with their own number and signature card; the
# recruit card shows that card and says so; turned down, they wait at camp; the Team screen tags them Superstar and
# the Stars tab names them. For each of the nine, forced as the redeemed one: the recruit is a star, has their card,
# plays a card match and a whole game in every engine (Simulate) without errors, and carries their own ultimate in
# their own sport only (and the minotaur's specials stay in the ring). An old save, with the redeemed captain signed
# as a plain player before this part, loads and is made the star. How to play's 'When it shuts' line says so.
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

CHAMPS = ['gate', 'diamond', 'gridiron', 'ring', 'court', 'rink', 'links', 'lanes', 'shed']

# a fresh LAB journey with n players: n - 1 of league kinds the champion isn't, then the champion, redeemed through the
# Seal (the real path: u6 queues them, u9 makes them the star), first in the lineup
LAB_JS = r"""
window.U9 = {
  team(k, n) {
    LAB = true; wStart(null, { club: pick(CLUB_IDS) });
    const C = W_NADIR[k], kind = DB.chars[C.char].kind;
    const league = () => shuffle(Object.keys(SIG).filter(x => FA_NAMES[x] && !W_STARS.some(s => s.kind === x) && wGF.kinds.includes(x) && x !== kind && !wRoster().some(p => p.kind === x)));
    while (wRoster().length > n - 1) WG.roster.pop(); wNormalizeLineup(); wSyncParty();
    while (wRoster().length < n - 1) wRecruit({ kind: league()[0], lvl: 3 }, 'tavern');
    wUmbralUnlock(); const U = wUmb(); U.pieces = Object.keys(W_UMB_PIECES); U.tries = {}; U.beaten = { [k]: 1 }; U.redeemed = null;
    WG.wprompts = []; wUmbSeal();
    const P = WG.wprompts.find(x => x.t === 'recruit'); WG.wprompts = [];
    const p = wAddPlayer(P.p);
    for (const q of wRoster()) { q.lvl = 3; q.xp = 0; }
    wMovePlayer(p.id, 0);
    WG.captain = wStarters().find(q => q.id !== p.id).id; WG.seven = null; WG.nine = null; WG.court = null; WG.rink = null; WG.links = null; WG.lanes = null; WG.shed = null;
    RUN.gold = 1000; RUN.hp = RUN.maxhp;
    return { p, queued: { star: P.p.star, from: P.p.from, n: P.p.n, num: P.p.num } };
  },
  card(k) {
    const { p, queued } = U9.team(k, 3), s = wStar(p.star); wSyncParty();
    const keep = beginFight; beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); };
    RUN.pending = null; B = null;
    try { startMatch({ type: 'normal', tier: 1, world: { kind: 'wild', ref: null, region: 'tide' } }); } finally { beginFight = keep; }
    const inMatch = B.draw.concat(B.hand, B.discard).some(c => c.id === s.sig);
    B = null; RUN.pending = null;
    return { queued, star: p.star, redeemed: !!(s && s.redeemed), kind: p.kind, name: p.n, num: p.num, from: p.from, sig: s && s.sig,
      own: wCardsOf(p.id).some(c => c.id === s.sig), kindSig: wCardsOf(p.id).some(c => c.id === SIG[p.kind]), inMatch, rarS: CARDS[s.sig].rar === 's', ws: WG.star || null };
  },
  // (each: a whole game, Simulate; then the same teams put into the engine (start), and the ultimate read from the
  // engine itself: its own team, or the ultimate it offers or would cast for them. own: the champion's own ultimate)
  gf(k) {
    const { p } = U9.team(k, W_GFG.minOwn); for (const q of wRoster()) wGfOf(q); wSevenSync();
    const club = Object.values(WG.rivals)[0]; wGfg().opp = {};
    const opp = wGridOpp(club, 2), sq = wGridSquad(opp), on = sq.team.roster.some(r => r.n === p.n);
    const g = wGF.simGame({ teams: [sq.team, opp], skill: wGridSkill(2), powers: true });
    wGF.start({ teams: [sq.team, opp], skill: wGridSkill(2), powers: true }); const m = wGF.G.teams[0].roster.find(r => r.n === p.n);
    const named = m ? wGridPowNames(m).ult.n : null, kindN = (wGF.powerBook[p.kind].ult || {}).n;
    return { on, ult: (m && m.ult) || null, named: m && m.ult ? named === 'Eclipse' : named === kindN, game: Array.isArray(g.score) && g.score.every(n => n >= 0) };
  },
  bd(k) {
    const { p } = U9.team(k, W_BALL.minOwn); for (const q of wRoster()) wBdOf(q); wNineSync();
    const club = Object.values(WG.rivals)[0], def = wNineDef(), on = def.roster.concat(def.pen).some(r => r.n === p.n);
    wBD.sim({ defs: [def, wBallOpp(club, 2)], innings: W_BALL.innings, diff: W_BALL.diff[2], rules: W_BALL.rules });
    const G = wBD.G, T = G.teams[0], m = T.def.roster.concat(T.pen, T.used || []).find(r => r.n === p.n);
    const card = /Dead Ball/.test(wBdCard(p));
    return { on, card, ult: m && m.pitches && m.pitches.includes('deadball') ? 'deadball' : null, game: G.phase === 'over' && G.inning >= W_BALL.innings && G.teams[0].R !== G.teams[1].R };
  },
  bx(k) {
    const { p } = U9.team(k, 3);
    const side = wRingSide(new Set()), f = side.fighters.find(x => x.n === p.n), P = f && f.pw, opp = wRingOpp(Object.values(WG.rivals)[0], 1, new Set());
    const r = wBX.simCard({ sides: [side, opp], skill: [1, 1] });
    wBX.start({ fighters: [f, opp.fighters[0]], mode: 'watch', you: 0, skill: [1, 1] }); const U = wBX.powers(0).ult;
    return { on: !!f, ult: U && U.id === 'lastbell' ? U.id : null, kindUlt: wBX.powerData[p.kind].ult.id, engUlt: U && U.id, sp: P ? [P.sp.id, P.sp2 && P.sp2.id] : null,
      kindSp: [wBX.powerData[p.kind].sp.id, wBX.powerData[p.kind].sp2 && wBX.powerData[p.kind].sp2.id], game: !!r.result && r.bouts.every(b => b.over) };
  },
  bk(k) {
    const { p } = U9.team(k, 5); for (const q of wRoster()) { delete q.bk; wBkOf(q); } wCourtSync();
    const club = Object.values(WG.rivals)[0]; wBkg().opp = {};
    const opp = wCourtOpp(club, 2), sq = wCourtSquad(opp), on = sq.team.roster.slice(0, 5).some(r => r.n === p.n);
    const g = wBK.simGame({ teams: [sq.team, opp], skill: wCourtSkill(2), mins: 5, court: true, ordered: [true, false] });
    wBK.start({ teams: [sq.team, opp], skill: wCourtSkill(2), mins: 5, court: true, ordered: [true, false], powers: true });
    const o = wBK.ultOptions(0).find(u => u.who === p.n);
    return { on, ult: o && o.own ? o.id : null, offered: !!o, game: Array.isArray(g.score) && g.score[0] !== g.score[1] };
  },
  hk(k) {
    const { p } = U9.team(k, 6); for (const q of wRoster()) { delete q.hk; wHkOf(q); } wSixSync();
    // (at centre: a goalie casts nothing, so in goal there is no ultimate to read)
    const C = WG.rink, at = wHK.pos.find(pos => C.six[pos] === p.id); if (at && at !== 'C') [C.six[at], C.six.C] = [C.six.C, C.six[at]]; C.mine = true;
    const club = Object.values(WG.rivals)[0]; wHkg().opp = {};
    const opp = wRinkOpp(club, 2), sq = wRinkSquad(opp), on = sq.team.roster.slice(0, 6).some(r => r.n === p.n);
    const g = wHK.simGame({ teams: [sq.team, opp], skill: wRinkSkill(2), mins: 6, pond: true, ordered: [true, false] });
    wHK.start({ teams: [sq.team, opp], skill: wRinkSkill(2), mins: 6, pond: true, ordered: [true, false], powers: true });
    const o = wHK.ultOptions(0).find(u => u.n === p.n);
    return { on, ult: o && o.own ? o.id : null, offered: !!o, game: g.win === 0 || g.win === 1 };
  },
  gl(k) {
    const { p } = U9.team(k, 4); wFourSync();
    const club = Object.values(WG.rivals)[0], opp = wLinksOpp(club, 2), sq = wLinksSquad(opp), on = sq.team.roster.some(r => r.n === p.n);
    const g = wGL.simGame({ teams: [sq.team, opp], skill: wLinksSkill(2), holes: wLinksHoles(), powers: true });
    wGL.start({ teams: [sq.team, opp], skill: wLinksSkill(2), holes: wLinksHoles(), powers: true }); const m = wGL.G.teams[0].roster.find(r => r.n === p.n);
    return { on, ult: (m && m.ult) || null, game: g.win === 0 || g.win === 1 };
  },
  bl(k) {
    const { p } = U9.team(k, 5); for (const q of wRoster()) { delete q.bl; wBlOf(q); } wFiveSync();
    const club = Object.values(WG.rivals)[0]; wLng().opp = {};
    const opp = wLanesOpp(club, 2), sq = wLanesSquad(opp), on = sq.team.roster.some(r => r.n === p.n);
    const g = wBL.simGame({ teams: [sq.team, opp], skill: wLanesSkillOf(2), frames: 10, hall: true, powers: true });
    wBL.start({ teams: [sq.team, opp], skill: wLanesSkillOf(2), frames: 10, hall: true, powers: true });
    const U = wBL.ultOf(0, wBL.G.teams[0].roster.findIndex(r => r.n === p.n));
    return { on, ult: U && wBL.ultOwn[U.id] ? U.id : null, game: g.win === 0 || g.win === 1 };
  },
  cr(k) {
    const { p } = U9.team(k, 4); for (const q of wRoster()) { delete q.cr; wCrOf(q); } wFourSyncCr();
    const club = Object.values(WG.rivals)[0]; wShg().opp = {};
    const opp = wShedOpp(club, 2), sq = wShedSquad(opp), on = sq.team.roster.some(r => r.n === p.n);
    const g = wCR.simGame({ teams: [sq.team, opp], skill: wShedSkillOf(2), ends: 6, hall: true, powers: true, hammer: 1 });
    wCR.start({ teams: [sq.team, opp], skill: wShedSkillOf(2), ends: 6, hall: true, powers: true, hammer: 1 });
    const U = wCR.ultOf(0, wCR.G.teams[0].roster.findIndex(r => r.n === p.n));
    return { on, ult: U && wCR.ultOwn[U.id] ? U.id : null, game: g.win === 0 || g.win === 1 };
  },
};
"""

# each engine, the champion whose sport it is, and their ultimate's id there
HOME = {'gf': ('gridiron', 'nadirEclipse'), 'bd': ('diamond', 'deadball'), 'bx': ('ring', 'lastbell'), 'bk': ('court', 'lightsout'),
        'hk': ('rink', 'longnight'), 'gl': ('links', 'hollowflag'), 'bl': ('lanes', 'drownbell'), 'cr': ('shed', 'sunkenstone')}


async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbStarOf === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; wSave()")

        # ---------- the registry: nine stars, each found by wStar, none of them in W_STARS ----------
        rg = await pg.evaluate("""(() => Object.keys(W_UMB9).map(k => { const s = wStar(W_NADIR[k].char); return s && [k, s.id, s.kind, s.name, s.num, !!CARDS[s.sig], s.home, s.ult ? s.ult.id : null]; }))()""")
        check(len(rg) == 9 and all(r and r[5] for r in rg), 'each of the nine champions has a superstar entry, found by wStar, with a signature card', rg)
        nw = await pg.evaluate("W_STARS.length === 6 && !W_STARS.some(s => s.redeemed) && !wCourtStarKind('lich') && !wRinkStarKind('wraith')")
        check(nw, 'the redeemed are not legend superstars: W_STARS and the engines\' star kinds are unchanged', nw)
        ids = await pg.evaluate("(() => { const out = {}; for (const k in W_UMB9) { const u = W_UMB9[k].ult; if (u) out[k] = u.id; } return { out, gf: !!wGF.ult('nadirEclipse'), bk: !!wBK.ultBook('lightsout'), gl: !!wGL.ultOwn.hollowflag, bl: !!wBL.ultOwn.drownbell, cr: !!wCR.ultOwn.sunkenstone }; })()")
        check(all(ids[k] for k in ['gf', 'bk', 'gl', 'bl', 'cr']), 'each home ultimate is an id the engine already has (the one the champion used as an opponent)', ids)

        # ---------- the real Seal in a real journey: the recruit card, camp, the Team screen ----------
        sl = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; U.pieces = Object.keys(W_UMB_PIECES); U.tries = {}; U.beaten = { rink: WG.dayAbs };
          WG.wprompts = []; wUmbSeal(); U.sealScene = 0; WG.cardOffer = null;
          const P = WG.wprompts.find(x => x.t === 'recruit'); out.p = P && [P.p.n, P.p.kind, P.p.num, P.p.star, P.p.from]; out.redeemed = U.redeemed;
          wNextPrompt(); const box = document.getElementById('modalBox');
          out.card = !!box.querySelector('.wrecsig .card') && box.querySelector('.wrecsig').textContent.includes('The Long Night'); out.lede = box.querySelector('.wrecwho').textContent;
          document.getElementById('wPass').click(); out.wait = (WG.wwait || []).some(q => q.star === 'nadir_rink');
          return out; })()""")
        check(sl['p'] == ['Hollis Grael', 'wraith', 9, 'nadir_rink', 'redeemed'] and sl['redeemed'] == 'rink', 'forging the Seal queues the redeemed champion as a superstar, with their own name and number', sl)
        check(sl['card'] and 'superstar' in sl['lede'].lower() and 'The Long Night' in sl['lede'], 'the recruit card shows their own signature card and says they are a superstar, with their own ultimate', sl)
        check(sl['wait'], 'turned down, the redeemed captain waits at camp', sl)
        ws = await pg.evaluate("(() => { wOpenCamp('stars'); const st = !!document.querySelector('#modalBox [data-u9star]'); document.querySelector('#modalBox [data-close]').click(); return st; })()")
        check(not ws, 'while they wait at camp, the Stars tab does not say they play for you', ws)
        cp = await pg.evaluate("""(() => { const i = WG.wwait.findIndex(q => q.star === 'nadir_rink'); wSignWaiting(i); const p = wRoster().find(q => q.star === 'nadir_rink'), out = {};
          out.joined = !!p; out.card = !!p && wCardsOf(p.id).some(c => c.id === 'u9_night'); out.ws = WG.star || null;
          wOpenCamp('team'); out.tag = !!document.querySelector(`#modalBox [data-pid="${p.id}"] .wu9star`) && !!document.querySelector(`#modalBox [data-pid="${p.id}"]`).textContent.match(/edeemed in the Umbral/);
          out.other = document.querySelectorAll('#modalBox .wu9star').length;
          wOpenCamp('stars'); const st = document.querySelector('#modalBox [data-u9star]'); out.stars = st ? st.textContent : '';
          document.querySelector('#modalBox [data-close]') ? document.querySelector('#modalBox [data-close]').click() : closeModal(); return out; })()""")
        check(cp['joined'] and cp['card'] and cp['ws'] is None, 'signed from camp, they join with their own card, and the journey\'s one legend superstar is still free', cp)
        check(cp['tag'] and cp['other'] == 1, 'the Team screen tags them Superstar (redeemed in the Umbral), and nobody else', cp)
        check('Hollis Grael' in cp['stars'] and 'The Long Night' in cp['stars'], 'the Stars tab names the redeemed superstar', cp)
        rk = await pg.evaluate("""(() => { const p = wRoster().find(q => q.star === 'nadir_rink'), C = wSixSync(), h = wSixRow(p.id, C);
          const w = wAddPlayer(wMakePlayer({ kind: 'wraith', n: 'Pale Understudy', lvl: 2 }, 'tavern')), hw = wSixRow(w.id, wSixSync());
          const why = wRelease(p.id); return { row: h.includes('Ultimate: <b>The Long Night</b>'), plain: hw.includes('Ultimate: <b>') && !hw.includes('The Long Night'), why, gone: !wAllCards().some(c => c.id === 'u9_night'), heir: wCardsOf(w.id).length >= 1 }; })()""")
        check(rk['row'] and rk['plain'], 'the Rink tab names The Long Night as their ultimate (another wraith keeps the wraith\'s)', rk)
        check(rk['why'] == '' and rk['gone'] and rk['heir'], 'released, their own card leaves with them; another of their kind keeps their other cards', rk)
        hp = await pg.evaluate("(() => { showPage('help'); const p = [...document.querySelectorAll('#wHelpUmbral p')].find(e => /When it shuts/.test(e.textContent)); const t = p ? p.textContent : ''; showPage('play'); return t; })()")
        check('as a superstar' in hp and 'signature card' in hp and 'ultimate' in hp and hp.count('asks to join') == 1, "How to play's 'When it shuts' line says the captain joins as a superstar", hp)

        # ---------- an old save: the Seal forged before this part, the captain signed as a plain player ----------
        await pg.evaluate("""(() => { for (const q of wRoster().filter(q => q.star)) { WG.roster = WG.roster.filter(x => x !== q); RUN.deck = RUN.deck.filter(c => c.wp !== q.id); }
          WG.umbral.redeemed = 'ring'; const p = wAddPlayer(wMakePlayer({ kind: 'minotaur', n: 'Brakka Knell', lvl: 3 }, 'quest')); delete p.star;
          RUN.deck = RUN.deck.filter(c => c.id !== 'u9_knell'); wSave(); })()""")
        await pg.reload(); await pg.wait_for_function("typeof wUmbStarOf === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate("wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG")
        od = await pg.evaluate("""(() => { const p = wRoster().find(q => q.n === 'Brakka Knell'); return { p: !!p, star: p && p.star, num: p && p.num, card: !!p && wCardsOf(p.id).some(c => c.id === 'u9_knell'),
          ult: p ? (wBxFighter(p).pw || {}).ult : null, count: wRoster().filter(q => q.n === 'Brakka Knell').length,
          sp2: !!p && (() => { p.bxSp = 'sp2'; const f = wBxFighter(p); delete p.bxSp; return f.sp === 'sp2' && f.pw.sp.id === wBX.powerData.minotaur.sp2.id && f.pw.ult.id === 'lastbell'; })() }; })()""")
        check(od['p'] and od['count'] == 1, 'an old save with the redeemed captain signed as a plain player still loads, with them on the team', od)
        check(od['star'] == 'nadir_ring' and od['num'] == 7 and od['card'] and od['ult'] and od['ult']['id'] == 'lastbell', 'and they are made the superstar: their number, their card, and The Last Bell in the ring', od)
        check(od['sp2'], 'in the ring the special picked on the Ring tab is the one they bring (and the tape names), with The Last Bell', od)
        lm = await pg.evaluate("""(() => { const p = wRoster().find(q => q.n === 'Brakka Knell'); delete p.star; RUN.battle = { turn: 1 };
          const n = wUmbStarsFixAll(), during = !!p.star; RUN.battle = null; wNextPrompt(); return { n, during, after: p.star || null }; })()""")
        check(lm == {'n': 0, 'during': False, 'after': 'nadir_ring'}, 'with a match live the old-save fix-up waits, and the world\'s next free moment does it', lm)

        # ---------- each of the nine, forced as the redeemed: a star with their card, in every engine ----------
        await pg.add_script_tag(content=LAB_JS)
        for k in CHAMPS:
            r = await pg.evaluate(f"(() => {{ try {{ return U9.card('{k}'); }} catch (e) {{ return {{ err: String(e.stack || e) }}; }} }})()")
            check('err' not in r and r['star'] == r['queued']['star'] and r['redeemed'] and r['from'] == 'redeemed' and r['own'] and r['inMatch'] and r['rarS'] and r['ws'] is None,
                  f'{k}: the recruit is a superstar, joins with their own signature card, and plays it in a card match', r)
            for e, (home, ult) in HOME.items():
                g = await pg.evaluate(f"(() => {{ try {{ return U9.{e}('{k}'); }} catch (e) {{ return {{ err: String(e.stack || e) }}; }} }})()")
                want = ult if k == home else None
                ok = 'err' not in g and g['on'] and g['game'] and g['ult'] == want
                if e == 'bx' and ok: ok = (g['sp'] == g['kindSp']) if k == 'ring' else (g['sp'] is None and g['engUlt'] == g['kindUlt'])
                if e in ('bk', 'hk') and ok: ok = g['offered']
                if e == 'gf' and ok: ok = g['named']
                if e == 'bd' and ok: ok = g['card'] == (k == 'diamond')
                check(ok, f'{k} in {e}: plays a whole game in your lineup' + (f', with their own {ult}' if want else ', with their kind\'s powers and no ultimate of a champion'), g)
        # ---------- your Powers row in a game you play names the ultimate the engine casts ----------
        # (golf, bowling and curling build the row from the kind; the view is the engine's, frozen at a ball to aim)
        pr = await pg.evaluate("""(() => { const out = {};
          const as = (E, v, fn) => { const d = Object.getOwnPropertyDescriptor(E, 'view'); Object.defineProperty(E, 'view', { get: () => v, configurable: true }); try { return fn(); } finally { Object.defineProperty(E, 'view', d); } };
          { const { p } = U9.team('links', 4); LAB = false; wFourSync(); wStartLinks({ club: Object.values(WG.rivals)[0], how: 'play' });
            const V = wGL.view, ri = wGL.G.teams[V.you].roster.findIndex(r => r.n === p.n), txt = () => document.querySelector('#wLinksRowPow [data-lpow="ult"]').textContent;
            wLinksPowRow(Object.assign({}, V, { sel: { ri } }), true); out.gl = txt(); wLinksPowRow(Object.assign({}, V, { sel: { ri: (ri + 1) % 4 } }), true); out.gl2 = txt(); }
          { const { p } = U9.team('lanes', 5); LAB = false; for (const q of wRoster()) { delete q.bl; wBlOf(q); } wFiveSync(); wStartLanes({ club: Object.values(WG.rivals)[0], how: 'play' });
            const V = wBL.view, ri = wBL.G.teams[0].roster.findIndex(r => r.n === p.n), txt = () => document.querySelector('#wLanesRowPow [data-npow="ult"]').textContent;
            out.bl = as(wBL, Object.assign({}, V, { ph: 'aim', up: V.you, bowler: ri }), () => { wLanesRows(); return txt(); });
            out.bl2 = as(wBL, Object.assign({}, V, { ph: 'aim', up: V.you, bowler: (ri + 1) % 5 }), () => { wLanesRows(); return txt(); }); }
          { U9.team('shed', 4); LAB = false; for (const q of wRoster()) { delete q.cr; wCrOf(q); } wFourSyncCr(); wStartShed({ club: Object.values(WG.rivals)[0], how: 'play' });
            out.cr = as(wCR, Object.assign({}, wCR.view, { ph: 'aim', up: wCR.view.you, mode: 'play' }), () => { wShedRows(); return document.querySelector('#wShedPowRow [data-crpow="ult"]').textContent; }); }
          return out; })()""")
        check(pr['gl'].startswith('The Hollow Flag') and not pr['gl2'].startswith('The Hollow Flag') and pr['bl'].startswith('The Drowning Bell') and not pr['bl2'].startswith('The Drowning Bell') and pr['cr'].startswith('The Sunken Stone'),
              'your Powers row in golf, bowling and curling names their own ultimate (the others\' their kind\'s)', pr)
        await pg.evaluate("LAB = false")
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
