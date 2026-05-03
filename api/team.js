import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const verifyAdmin = async (req) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role, org_id").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return null;
  return { user, profile };
};

export default async function handler(req, res) {
  const allowedOrigin = process.env.APP_URL || "https://straygemslabaraka.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: "Accès refusé" });

  // GET — liste des vendeurs de l'org admin + orgs managées par cet admin
  if (req.method === "GET") {
    // Récupère les orgs managées par l'org admin (ex: Straygems manage La Baraka)
    const { data: managedOrgs } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("managed_by", admin.profile.org_id);

    // Liste des org_ids visibles : la sienne + celles qu'elle manage
    const visibleOrgIds = [
      admin.profile.org_id,
      ...(managedOrgs || []).map(o => o.id)
    ];

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .in("org_id", visibleOrgIds)
      .eq("role", "vendor")
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ team: data });
  }

  // PATCH — mise à jour d'un vendeur (display_name, individual_goal uniquement)
  if (req.method === "PATCH") {
    const { vendorId, updates } = req.body || {};
    if (!vendorId || !updates) return res.status(400).json({ error: "vendorId et updates requis" });

    // Vérifie que le vendeur appartient à l'org admin ou une org managée
    const { data: vendor } = await supabaseAdmin
      .from("profiles").select("org_id").eq("id", vendorId).single();
    const { data: managedOrgs2 } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("managed_by", admin.profile.org_id);
    const visibleOrgIds2 = [
      admin.profile.org_id,
      ...(managedOrgs2 || []).map(o => o.id)
    ];
    if (!vendor || !visibleOrgIds2.includes(vendor.org_id)) {
      return res.status(403).json({ error: "Vendeur non trouvé dans votre organisation" });
    }

    // Whitelist des champs autorisés
    const allowed = ["display_name", "individual_goal"];
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );
    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({ error: "Aucun champ valide à mettre à jour" });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(safeUpdates)
      .eq("id", vendorId)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ profile: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
