/* ================= custom teams (the team builder) ================= */
var CUSTOM = [];
const getTeam = id => TEAMS[id] || CUSTOM.find(t => t.id === id) || TEAMS.ironmaw;
