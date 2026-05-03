import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const allowedOrigin = process.env.APP_URL || "https://straygemslabaraka.vercel.app";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non autorisé" });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Token invalide" });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé à l'admin" });
  }

  const { data, error } = await supabaseAdmin
    .from("logs")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ logs: data });
}
