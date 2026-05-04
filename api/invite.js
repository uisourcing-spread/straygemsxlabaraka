import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS — accepte uniquement les requêtes depuis l'app
  const allowedOrigin = process.env.APP_URL || "https://straygemslabaraka.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Vérifie l'origine de la requête
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin.startsWith(allowedOrigin)) {
    return res.status(403).json({ error: "Origine non autorisée" });
  }

  // Vérifie que l'appelant est admin
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Non autorisé" });

  const token = authHeader.replace("Bearer ", "");
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

  const { email, orgId } = req.body;

  // Validation basique
  if (!email || !orgId) return res.status(400).json({ error: "Email et orgId requis" });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: "Email invalide" });

  // Vérifie que l'orgId cible est soit l'org de l'admin, soit une org managée par lui
  const { data: managedOrgs } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("managed_by", profile.org_id);
  const allowedOrgIds = [
    profile.org_id,
    ...(managedOrgs || []).map(o => o.id)
  ];
  if (!allowedOrgIds.includes(orgId)) {
    return res.status(403).json({ error: "Organisation non autorisée" });
  }

  // Récupère le nom de l'organisation
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const appUrl = process.env.APP_URL || "https://straygemslabaraka.vercel.app";

  // Crée l'invitation Supabase
  // Mail envoyé automatiquement par Supabase Auth via Gmail SMTP configuré
  // redirectTo → /set-password pour que le vendeur crée son mot de passe avant d'accéder à /vendeur
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { org_id: orgId, role: "vendor" },
    redirectTo: `${appUrl}/set-password`,
  });

  if (inviteError) return res.status(500).json({ error: inviteError.message });

  // Crée le profil immédiatement — sans ça, getProfile() retourne null et l'app plante
  // On upsert pour éviter un crash si le profil existe déjà (re-invitation)
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id:           inviteData.user.id,
        email:        email,
        role:         "vendor",
        org_id:       orgId,
        display_name: email.split("@")[0], // fallback — peut être mis à jour plus tard
      },
      { onConflict: "id" }
    );

  // On log l'erreur mais on ne bloque pas — l'invitation Auth est déjà envoyée
  if (profileError) {
    console.error("Erreur création profil vendeur:", profileError.message);
  }

  return res.status(200).json({ success: true, email });
}
