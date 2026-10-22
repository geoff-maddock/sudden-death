/* ---------- profiles on the title screen ---------- */
function profileChip() {
  let el = $('profRow');
  if (!el) { el = document.createElement('div'); el.id = 'profRow'; el.className = 'profrow'; const rr = $('resumeRow'); rr.parentNode.insertBefore(el, rr); }
  const n = ACH.filter(a => ACHS.got[a.id] != null).length;
  el.innerHTML = `<span>Playing as <b>${esc(profileName())}</b>${PROFILES.cur === 'guest' ? ' <small>(no profile)</small>' : ''} · ${n}/${ACH.length} achievements</span><button class="ghost" id="bProfile">${PROFILES.cur === 'guest' && !PROFILES.list.length ? 'Create a profile' : 'Switch player'}</button>`;
  $('bProfile').onclick = showProfiles;
}
function showProfiles() {
  const row = (id, name, sub) => `<div class="profline${PROFILES.cur === id ? ' cur' : ''}"><div><b>${esc(name)}</b><small>${sub}</small></div>${PROFILES.cur === id ? '<span class="hint">Playing now</span>' : `<button class="ghost" data-play="${id}">Play as ${esc(name)}</button>`}${id !== 'guest' ? `<button class="ghost" data-del="${id}" title="Delete this profile and all its progress" aria-label="Delete ${esc(name)}">✕</button>` : ''}</div>`;
  modal(`<header><h3>Who’s playing?</h3><button class="ghost" data-close>Close</button></header>
    <p class="hint">Each profile keeps its own run in progress, record book, player careers, achievements and coach’s notes on this device. Guest plays without a profile and keeps everything from before profiles existed.</p>
    <div class="proflist">${row('guest', 'Guest', 'No profile')}${PROFILES.list.map(p => row(p.id, p.name, 'Since ' + new Date(p.created).toLocaleDateString())).join('')}</div>
    <div class="row" style="margin-top:12px"><input id="newProf" maxlength="24" placeholder="New player name" aria-label="New player name" style="flex:1;font:inherit;padding:8px 10px;background:var(--stone2);color:var(--bone);border:1px solid var(--seam);border-radius:4px"><button class="btn" id="bMkProf" style="font-size:20px">Create and play</button></div>`);
  const box = $('modalBox');
  box.querySelectorAll('[data-play]').forEach(b => b.onclick = () => switchProfile(b.dataset.play));
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const p = PROFILES.list.find(x => x.id === b.dataset.del); if (p) askConfirm(`Delete ${p.name}?`, `All of ${p.name}’s progress on this device goes with it: the run in progress, record book, careers and achievements. This cannot be undone.`, 'Delete', () => { const wasCur = PROFILES.cur === p.id; deleteProfile(p.id); if (wasCur) location.reload(); else showProfiles(); }, showProfiles); });
  const mk = () => { const id = createProfile($('newProf').value); if (id) switchProfile(id); else $('newProf').focus(); };
  $('bMkProf').onclick = mk; $('newProf').onkeydown = e => { if (e.key === 'Enter') mk(); };
  setTimeout(() => $('newProf') && $('newProf').focus(), 50);
}
(() => { const _rt = renderTitle; renderTitle = function () { _rt(); profileChip(); }; if (UI.screen === 'title') profileChip(); })();

// who is playing, always visible in the header
(() => { const b = $('bWho'); if (!b) return; $('whoName').textContent = profileName(); b.setAttribute('aria-label', `Playing as ${profileName()}. Switch or create a profile`); b.onclick = showProfiles; })();

/* An in-game confirmation. The browser's own confirm() is blocked inside the claude.ai page frame (it returns
   false without showing anything), so every yes/no question goes through this instead. */
function askConfirm(title, body, okLabel, onYes, onNo) {
  const close = modal(`<header><h3>${esc(title)}</h3></header><p>${esc(body)}</p><div class="row"><button class="btn" id="cfYes" style="font-size:22px">${esc(okLabel || 'Yes')}</button><button class="ghost" id="cfNo">Cancel</button></div>`);
  $('cfNo').focus();
  $('cfYes').onclick = () => { close(); onYes && onYes(); };
  $('cfNo').onclick = () => { close(); onNo && onNo(); };
}
