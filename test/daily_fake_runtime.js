// A stand-in for the claude.ai artifact runtime's db and user capabilities (window.claude.use), for the daily board's
// tests (test/daily_board.py, test/realm_daily.py). Set window.__FAKE_CFG before it runs to change it:
//   { uid, canWrite, off (use() resolves null), silent (subscriptions never answer), names: { uid: name } }.
// It keeps the rules the board is published with: a viewer writes only boards/<their id>, and nothing when they can't
// write. Reads are open. window.__FAKE.docs holds every document by path.
(() => {
  const C = Object.assign({ uid: 'u_me', canWrite: true, off: false, silent: false, names: { u_me: 'Me' } }, window.__FAKE_CFG || {});
  const F = window.__FAKE = { cfg: C, docs: {}, writes: 0, subs: [], uses: 0 };
  const clone = x => JSON.parse(JSON.stringify(x));
  const snap = (path) => { const d = F.docs[path]; return { id: path.split('/').pop(), exists: !!d, data: () => d ? Object.freeze(clone(d)) : undefined, metadata: { fromCache: false, hasPendingWrites: false } }; };
  const deliver = s => {
    if (C.silent) return;
    let docs = Object.keys(F.docs).filter(p => p.startsWith(s.col + '/') && p.split('/').length === 2);
    for (const [f, op, v] of s.where) docs = docs.filter(p => { const x = F.docs[p][f]; return typeof x === 'number' && (op === '>' ? x > v : op === '>=' ? x >= v : op === '==' ? x === v : true); });
    if (s.order) docs.sort((a, b) => (F.docs[b][s.order[0]] - F.docs[a][s.order[0]]) * (s.order[1] === 'desc' ? 1 : -1));
    docs = docs.slice(0, s.lim || 1000).map(snap);
    setTimeout(() => s.next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }), 5);
  };
  const query = (col, st) => ({
    where: (f, op, v) => query(col, Object.assign({}, st, { where: st.where.concat([[f, op, v]]) })),
    orderBy: (f, dir) => query(col, Object.assign({}, st, { order: [f, dir || 'asc'] })),
    limit: n => query(col, Object.assign({}, st, { lim: n })),
    get: async () => { let out; deliver(Object.assign({ col, next: s => { out = s; } }, st)); await new Promise(r => setTimeout(r, 10)); return out; },
    onSnapshot: (next, err) => { const s = Object.assign({ col, next, err, live: true }, st); F.subs.push(s); deliver(s); return () => { s.live = false; }; },
  });
  const db = Object.freeze({
    doc: path => ({ id: path.split('/').pop(), path, get: async () => snap(path),
      set: async data => {
        if (!C.canWrite || path !== 'boards/' + C.uid) throw { code: 'invalid_argument', message: 'not allowed' };
        F.docs[path] = clone(data); F.writes++;
        for (const s of F.subs) if (s.live) deliver(s);
      } }),
    collection: col => query(col, { where: [] }),
  });
  const user = Object.freeze({
    id: async () => C.uid, can: async n => n === 'data.write' ? C.canWrite : null, isOwner: async () => false, canEdit: async () => false,
    profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: C.names[i] || '', isMe: i === C.uid }])),
  });
  window.claude = { use: name => { F.uses++; return new Promise(res => setTimeout(() => res(C.off ? null : ({ db, user })[name] || null), 20)); } };
  // another player's whole document: seed(uid, body)
  F.seed = (uid, body) => { F.docs['boards/' + uid] = clone(body); for (const s of F.subs) if (s.live) deliver(s); };
})();
