// Unisce gli esercizi con nomi simili (es. "Bulgarian" e "Bulgarian Split Squat", "Hip trust" e "Hip Thrust Top Set") in un'unica progressione.
const STOP = new Set(["con", "di", "da", "dal", "dei", "del", "della", "a", "al", "ai", "alla", "su", "in", "il", "lo", "la", "le", "e", "the", "with", "and", "per", "un", "una"]);
const GENERICI = new Set(["squat", "curl", "press", "row", "fly", "raise", "extension", "pushdown", "deadlift", "lunge", "crunch", "plank", "rematore", "trazioni", "panca", "stacco", "push", "pull", "up", "machine", "cable", "cavo", "cavi"]);
const stem = (t) => (t.length > 4 && /[^s]s$/.test(t) ? t.slice(0, -1) : t);

export function tokenizza(nome) {
  let n = (nome || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  n = n.replace(/[()]/g, " ").replace(/^\s*\+\s*/, "");
  n = n.replace(/back[\s-]?off|top[\s-]?set/g, " ");
  n = n.replace(/\brdl\b/g, "romanian deadlift").replace(/stacco rumeno/g, "romanian deadlift").replace(/\bbulgar[io]\b|\bbulgara\b|\bbulgaro\b/g, "bulgarian");
  const base = n.split(/[^a-z]+/).filter(Boolean);
  const out = new Set();
  base.forEach((t) => { if (!STOP.has(t)) out.add(stem(t)); });
  for (let i = 0; i < base.length - 1; i++) out.add(stem(base[i] + base[i + 1])); // "kick back" -> "kickback"
  return [...out];
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const tokEq = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1);
const sub = (A, B) => A.every((a) => B.some((b) => tokEq(a, b)));
export function simili(A, B) {
  if (!A.length || !B.length) return false;
  const [S, L] = A.length <= B.length ? [A, B] : [B, A];
  if (!sub(S, L)) return false;
  if (S.length === 1 && GENERICI.has(S[0]) && L.length > 1) return false;
  return true;
}
const pulisci = (nome) => (nome || "").replace(/^\s*\+\s*/, "").replace(/\s*[-–]?\s*\b(top[\s-]?set|back[\s-]?off)\b/gi, "").replace(/\s+/g, " ").trim();

// esercizi: [{ id, nome, training_day_id? }], idPreferiti: Set di id del programma attivo. Ritorna { map: id -> id rappresentante, nomi: id rappresentante -> nome }
export function mappaCanonica(esercizi, idPreferiti = new Set()) {
  const lista = (esercizi || []).filter((e) => e && e.id);
  const tok = lista.map((e) => tokenizza(e.nome));
  const padre = lista.map((_, i) => i);
  const trova = (i) => (padre[i] === i ? i : (padre[i] = trova(padre[i])));
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) if (simili(tok[i], tok[j])) padre[trova(j)] = trova(i);
  const gruppi = {};
  lista.forEach((e, i) => { (gruppi[trova(i)] = gruppi[trova(i)] || []).push(e); });
  const map = {}, nomi = {};
  Object.values(gruppi).forEach((g) => {
    const migliore = [...g].sort((a, b) => (idPreferiti.has(b.id) ? 1 : 0) - (idPreferiti.has(a.id) ? 1 : 0) || pulisci(b.nome).length - pulisci(a.nome).length)[0];
    g.forEach((e) => { map[e.id] = migliore.id; });
    nomi[migliore.id] = pulisci(migliore.nome);
  });
  return { map, nomi };
}
