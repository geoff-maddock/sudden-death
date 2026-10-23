/* The page Brimstone Diamond thinks it owns (issue #4, phase 1). This file opens the wBD scope, ahead of src/bd/'s
   parts, and declares the page names they use, so that inside the scope, and only there:
   - document finds ids and selectors in a shadow root inside #v-diamond, so its ids (cv, pg-play, bAgain…) and its
     stylesheet cannot meet ours. Its listeners sit on that root, where an event's target is the real element and
     not the host; body is the page wrapper, head is the root.
   - window's listeners, requestAnimationFrame and setInterval only act while the diamond is on screen (BDX.on), so
     its keys never fire in the world and its frame loop is parked until it is shown.
   - localStorage is a Map in memory (the Realm keeps the saves), and location and history are stubs (no hash pages).
   Its fonts are added to the real page the first time it is shown. */
const BDX_DOC = globalThis.document, BDX_WIN = globalThis;
const BDX = { on: false, parked: [], gate: new Map(), host: null, root: null, page: null, fonts: false, onOver: null, onQuit: null };
/* our rules for its page: only the field, the speed bar, the pitch readout and the play-by-play show */
const BDX_OWN_CSS = `:host{display:block}:host([hidden]){display:none}
.bdpage{padding:0 0 24px;background:transparent}
header.top,.rotate-note,#menu,#sOver,#over .row,#pause .row a,#touch,.page:not(#pg-play),#bSaveQuit,[data-end="save"]{display:none!important}`;
(() => {
  const h = BDX_DOC.createElement('div'); h.id = 'v-diamond'; h.hidden = true;
  (BDX_DOC.getElementById('v-world') || BDX_DOC.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  BDX.host = h; BDX.root = h.attachShadow({ mode: 'open' });
  // a shadow root has no :root, html or body: those rules go to the host and the page wrapper
  const css = BDX_CSS.replace(/:root\b/g, ':host').replace(/(^|[\s,}])(?:html,body|body)(?=\s*\{)/g, '$1.bdpage');
  BDX.root.innerHTML = `<style>${css}\n${BDX_OWN_CSS}</style><div class="bdpage">${BDX_SHELL.slice(BDX_SHELL.lastIndexOf('</style>') + 8)}</div>`;
  BDX.page = BDX.root.querySelector('.bdpage');
})();
const document = new Proxy(BDX_DOC, {
  get(t, k) {
    switch (k) {
      case 'getElementById': return id => BDX.root.getElementById(id);
      case 'querySelector': return s => BDX.root.querySelector(s);
      case 'querySelectorAll': return s => BDX.root.querySelectorAll(s);
      case 'addEventListener': return (ty, fn, o) => BDX.root.addEventListener(ty, fn, o);
      case 'removeEventListener': return (ty, fn, o) => BDX.root.removeEventListener(ty, fn, o);
      case 'activeElement': return BDX.root.activeElement;
      case 'body': return BDX.page;
      case 'head': return BDX.root;
    }
    const v = Reflect.get(t, k);
    return typeof v === 'function' ? v.bind(t) : v;
  }
});
const localStorage = (() => {
  const m = new Map();
  return {
    getItem: k => m.has(String(k)) ? m.get(String(k)) : null, setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); }, clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; }
  };
})();
const location = { hash: '', reload() { } };
const history = { replaceState() { } };
const window = new Proxy(BDX_WIN, {
  get(t, k) {
    switch (k) {
      case 'addEventListener': return (ty, fn, o) => {
        if (ty === 'hashchange') return;
        const g = e => { if (BDX.on) return fn(e); };
        BDX.gate.set(fn, g); BDX_WIN.addEventListener(ty, g, o);
      };
      case 'removeEventListener': return (ty, fn, o) => BDX_WIN.removeEventListener(ty, BDX.gate.get(fn) || fn, o);
      case 'scrollTo': return () => { };
      case 'document': return document;
      case 'localStorage': return localStorage;
      case 'location': return location;
      case 'history': return history;
    }
    const v = Reflect.get(t, k);
    // bind methods (matchMedia…), but not constructors (AudioContext), which must stay usable with new
    return typeof v === 'function' && !/^[A-Z]/.test(String(k)) ? v.bind(t) : v;
  }
});
const requestAnimationFrame = cb => BDX.on ? BDX_WIN.requestAnimationFrame(cb) : (BDX.parked.push(cb), 0);
const cancelAnimationFrame = id => BDX_WIN.cancelAnimationFrame(id);
const setInterval = (fn, ms) => BDX_WIN.setInterval(() => { if (BDX.on) fn(); }, ms);
function bdxShow() {
  if (!BDX.fonts) {
    BDX.fonts = true;
    const l = BDX_DOC.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Pirata+One&display=swap'; BDX_DOC.head.appendChild(l);
  }
  BDX.on = true; BDX.host.hidden = false;
  for (const cb of BDX.parked.splice(0)) BDX_WIN.requestAnimationFrame(cb);
}
function bdxHide() { BDX.on = false; BDX.host.hidden = true; }
