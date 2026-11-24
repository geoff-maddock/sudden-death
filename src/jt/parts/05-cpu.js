/* The Tilting Lists: the CPU's plan and its hands (issue #117, phase 1).
   Before each course each CPU rider picks a plan (an aim, a guard and a pace), with the reason; then rides it with
   its skill's hands (JT_SKILL: how far its tip strays, how well it times the couch, how well it leans into a hit).
   - A Squire picks a plan at random and rides plainly (its hands stray most).
   - A Knight reads the score and the heat. Behind by more than it can make up with plain breaks in the courses left
     (and in the last course of the match behind at all): the helm at a gallop. Two or more ahead: the shield, a
     square guard and a canter (take no chances, stay on). In the tilt for the crown: the body, square, at a gallop.
     Otherwise the shield or the body, either guard, and a gallop while the mount has its wind.
   - An Archmage reads the score as a Knight does, with surer hands, and saves its gallop for when it counts: the last
     course of a heat, the tilt, or behind. Reading the other rider's habits comes in phase 4 (G.plans keeps them).
   A plan is { aim, guard, pace, why }. */
const JT_SKILL = [
  { n: 'Squire', aim: 1.3, couch: .5, lean: .3 },
  { n: 'Knight', aim: 1, couch: .3, lean: .5 },
  { n: 'Archmage', aim: .85, couch: .2, lean: .62 }];
const JT_GALLOP_WIND = .55;
// what side s needs: { lead (points ahead, + or -), left (courses still to ride for its riders, this one included), last }
function jtSituation(s) {
  const lead = jtTotal(s) - jtTotal(1 - s), tilt = jtInTilt();
  const left = tilt ? 1 : (G.courses - G.course) + (G.heat === 0 ? G.courses : 0);
  return { lead, left, tilt, last: !tilt && G.course === G.courses - 1, lastOfMatch: !tilt && G.heat === JT_RULES.heats - 1 && G.course === G.courses - 1 };
}
function jtPlan(s) {
  const sk = G.skill[s], W = G.wind[s], Q = jtSituation(s);
  if (sk <= 0) {
    const aim = wpick({ shield: 4, body: 3.5, helm: 2.5 }), guard = R() < .5 ? 'angled' : 'square', pace = R() < .5 ? 'gallop' : 'canter';
    return { aim, guard, pace, why: 'it suits them' };
  }
  const saving = sk >= 2;
  if (Q.tilt) return { aim: 'body', guard: 'square', pace: 'gallop', why: 'the tilt for the crown: a sure break and keep the seat' };
  if (Q.lead < 0 && (-Q.lead > Q.left || Q.lastOfMatch)) return { aim: 'helm', guard: R() < .5 ? 'angled' : 'square', pace: 'gallop', why: `behind by ${-Q.lead} with ${Q.left === 1 ? 'one course' : Q.left + ' courses'} left: go for the helm` };
  if (Q.lead >= 2) return { aim: 'shield', guard: 'square', pace: 'canter', why: `ahead by ${Q.lead}: take no chances and stay on` };
  const aim = R() < .55 ? 'shield' : 'body';
  const pace = saving ? (Q.last || Q.lead < 0 ? 'gallop' : 'canter') : (W >= JT_GALLOP_WIND ? 'gallop' : 'canter');
  const guard = saving && (Q.last || Q.lead > 0) ? 'square' : R() < .5 ? 'angled' : 'square';
  const why = saving && pace === 'gallop' ? (Q.last ? 'the last course of the heat: the gallop saved for it' : 'behind: time for the gallop')
    : pace === 'gallop' ? 'the mount is fresh: a gallop' : saving ? 'a canter, the gallop saved for when it counts' : 'the mount is blown: a canter';
  return { aim, guard, pace, why };
}
// side s's hands, by skill
const jtHands = s => JT_SKILL[clamp(G.skill[s] | 0, 0, JT_SKILL.length - 1)];
// side s's lean into a hit (0 to 1), by skill
const jtLean = s => clamp(jtHands(s).lean + .2 * gauss(), 0, 1);
