import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const allowedOrigin = process.env.APP_URL || "https://straygemslabaraka.vercel.app";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non autorisé" });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Token invalide" });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return res.status(400).json({ error: "Profil introuvable" });

  const { eventType, payload } = req.body;
  const allowed = ["auth.login", "auth.logout", "item.deposit", "item.sold", "item.updated"];
  if (!eventType || !allowed.includes(eventType)) {
    return res.status(400).json({ error: "Type d'événement invalide" });
  }

  await supabaseAdmin.from("logs").insert({
    org_id:     profile.org_id,
    user_id:    user.id,
    event_type: eventType,
    payload:    payload || {},
  });

  return res.status(200).json({ success: true });
}
