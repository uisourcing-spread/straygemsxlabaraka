import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const allowedOrigin = process.env.APP_URL || "https://straygemslabaraka.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Vérifie que l'appelant est admin
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non autorisé" });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Token invalide" });

  const { data: adminProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé à l'admin" });
  }

  const { vendorId } = req.body;
  if (!vendorId) return res.status(400).json({ error: "vendorId requis" });

  // Supprime le profil
  await supabaseAdmin.from("profiles").delete().eq("id", vendorId);

  // Désactive le user dans Supabase Auth
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(vendorId, {
    ban_duration: "876600h", // ~100 ans = révocation permanente
  });

  if (banError) return res.status(500).json({ error: banError.message });

  return res.status(200).json({ success: true });
}
