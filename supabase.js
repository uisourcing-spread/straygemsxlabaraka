import { createClient } from "@supabase/supabase-js";

// ─── CLIENT ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
  }
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

const authHeaders = (session) => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${session.access_token}`,
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// ─── CONVERTERS ───────────────────────────────────────────────────────────────
export const fromDB = (r) => ({
  id:             r.id,
  ref:            r.ref           || "",
  name:           r.name          || "",
  category:       r.category      || "",
  status:         r.status        || "active",
  buyPrice:       r.buy_price     || 0,
  sellPrice:      r.sell_price    || 0,
  finalPrice:     r.final_price   || null,
  depositDate:    r.deposit_date  || null,
  saleDate:       r.sale_date     || null,
  channel:        r.channel       || null,
  paymentMethod:  r.payment_method || "CB",
  notes:          r.notes         || "",
  organizationId: r.organization_id || null,
  createdBy:      r.created_by    || null,
});

const toDB = (item) => ({
  ref:             item.ref,
  name:            item.name,
  category:        item.category      || null,
  status:          item.status        || "active",
  buy_price:       item.buyPrice      || null,
  sell_price:      item.sellPrice     || null,
  final_price:     item.finalPrice    || null,
  deposit_date:    item.depositDate   || null,
  sale_date:       item.saleDate      || null,
  channel:         item.channel       || null,
  payment_method:  item.paymentMethod  || "CB",
  notes:           item.notes         || null,
  organization_id: item.organizationId || null,
  created_by:      item.createdBy     || null,
});

// Vendeur — champs restreints uniquement
const toDBVendorUpdate = (item) => ({
  status:        item.status,
  sale_date:     item.saleDate      || null,
  final_price:   item.finalPrice    || null,
  channel:       item.channel       || null,
  payment_method: item.paymentMethod || "CB",
});

// ─── API ITEMS ────────────────────────────────────────────────────────────────
export const fetchAll = async () => {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(fromDB);
};

export const createRecord = async (item, profile) => {
  const { data, error } = await supabase
    .from("items")
    .insert({
      ...toDB(item),
      organization_id: profile?.org_id || null,
      created_by:      profile?.id     || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromDB(data);
};

export const updateRecord = async (id, item) => {
  const { data, error } = await supabase
    .from("items")
    .update(toDB(item))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromDB(data);
};

export const updateRecordVendor = async (id, item) => {
  const { data, error } = await supabase
    .from("items")
    .update(toDBVendorUpdate(item))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromDB(data);
};

export const deleteRecord = async (id) => {
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  return true;
};

// ─── API LOYERS ───────────────────────────────────────────────────────────────
export const fetchLoyers = async () => {
  const { data, error } = await supabase
    .from("loyers")
    .select("*")
    .order("year", { ascending: true });
  if (error) throw new Error(error.message);
  const map = {};
  data.forEach(r => {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    map[key] = r.amount;
  });
  return map;
};

export const upsertLoyer = async (year, month, amount) => {
  const { data, error } = await supabase
    .from("loyers")
    .upsert({ year, month, amount }, { onConflict: "year,month" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// ─── API SETTINGS ─────────────────────────────────────────────────────────────
export const fetchSettings = async () => {
  const { data, error } = await supabase
    .from("settings")
    .select("*");
  if (error) throw new Error(error.message);
  const map = {};
  data.forEach(r => { map[r.key] = r.value; });
  return map;
};

export const upsertSetting = async (key, value) => {
  const { data, error } = await supabase
    .from("settings")
    .upsert({ key, value: String(value) }, { onConflict: "key" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// ─── API LOGS (via serverless — sécurisé) ────────────────────────────────────
export const writeLog = async (eventType, payload = {}) => {
  try {
    const session = await getSession();
    if (!session) return;
    // Appel serverless pour éviter l'exposition de la logique de log côté client
    await fetch("/api/log", {
      method: "POST",
      headers: authHeaders(session),
      body: JSON.stringify({ eventType, payload }),
    });
  } catch(e) {
    console.warn("Log failed silently:", e.message);
  }
};

export const fetchLogs = async () => {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  const res = await fetch("/api/logs", {
    headers: { "Authorization": `Bearer ${session.access_token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur logs");
  return data.logs;
};

// ─── API TEAM (via serverless — bypass RLS sécurisé) ─────────────────────────
export const fetchTeam = async () => {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  const res = await fetch("/api/team", {
    headers: { "Authorization": `Bearer ${session.access_token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur équipe");
  return data.team;
};

// Met à jour le profil d'un vendeur via serverless
export const updateProfile = async (id, updates) => {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  const res = await fetch("/api/team", {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ vendorId: id, updates }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur mise à jour");
  return data.profile;
};

// ─── API INVITATIONS ──────────────────────────────────────────────────────────
export const inviteVendor = async (email, orgId) => {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  const res = await fetch("/api/invite", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ email, orgId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur invitation");
  return data;
};

// ─── API RÉVOCATION ───────────────────────────────────────────────────────────
export const revokeVendor = async (session, vendorId) => {
  const res = await fetch("/api/revoke", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ vendorId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur révocation");
  return data;
};

// ─── API ASSIGNATION AUTEUR ───────────────────────────────────────────────────
export const assignItemAuthor = async (itemId, vendorId) => {
  const { data, error } = await supabase
    .from("items")
    .update({ created_by: vendorId })
    .eq("id", itemId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};
