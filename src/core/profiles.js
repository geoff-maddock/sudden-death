/* p2e: player profiles. Everything a player builds up (the run in progress, the record book, careers,
   achievements, coach's notes) is kept per profile on this device. Guest is the default and keeps the original
   storage keys, so play from before profiles existed stays with Guest. Settings are per device. */
const PROFILES = (() => { try { return JSON.parse(localStorage.getItem('sd-profiles') || 'null') || { cur: 'guest', list: [] }; } catch (e) { return { cur: 'guest', list: [] }; } })();
if (PROFILES.cur !== 'guest' && !PROFILES.list.some(p => p.id === PROFILES.cur)) PROFILES.cur = 'guest';
const pkey = k => PROFILES.cur === 'guest' ? k : `${k}@${PROFILES.cur}`;
const profileName = () => PROFILES.cur === 'guest' ? 'Guest' : (PROFILES.list.find(p => p.id === PROFILES.cur) || {}).name || 'Guest';
function saveProfiles() { try { localStorage.setItem('sd-profiles', JSON.stringify(PROFILES)); } catch (e) { } }
// switching reloads the page, so every system starts clean with the new profile's data
function switchProfile(id) {
  // keep the current player's run exactly where it is before handing the device over
  try { if (typeof snapBattle === 'function' && UI.view === 'fight' && B && !B.over) snapBattle(); else if (RUN && !RUN.over) saveRun(); } catch (e) { }
  window.__switching = true; // the page-close save must not write this player's game into the next profile
  PROFILES.cur = id; saveProfiles(); location.reload();
}
function createProfile(name) {
  name = String(name || '').trim().slice(0, 24); if (!name) return null;
  const id = 'p' + Date.now().toString(36); PROFILES.list.push({ id, name, created: Date.now() }); saveProfiles(); return id;
}
function deleteProfile(id) {
  for (const k of ['sd-run', 'sd-records', 'sd-players', 'sd-tips', 'sd-ach']) try { localStorage.removeItem(`${k}@${id}`); } catch (e) { }
  PROFILES.list = PROFILES.list.filter(p => p.id !== id); if (PROFILES.cur === id) PROFILES.cur = 'guest'; saveProfiles();
}
