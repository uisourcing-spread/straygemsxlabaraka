import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_KEY);

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

  const orgName = org?.name || "votre organisation";
  const appUrl  = process.env.APP_URL || "https://straygemslabaraka.vercel.app";

  // Crée l'invitation Supabase
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { org_id: orgId, role: "vendor" },
    redirectTo: `${appUrl}/vendeur`,
  });

  if (inviteError) return res.status(500).json({ error: inviteError.message });

  // Envoie l'email custom via Resend
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: `Invitation — Straygems × ${orgName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;background:#0D0D12;font-family:'Helvetica Neue',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:40px 20px;">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#13131A;border:1px solid rgba(139,92,246,0.2);border-radius:12px;overflow:hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background:#0A0A10;padding:28px 36px;border-bottom:1px solid rgba(139,92,246,0.1);">
                    <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.16em;color:#7B7490;text-transform:uppercase;">
                      ● Invitation
                    </p>
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#E5E0F0;">
                      Straygems <span style="color:#A78BFA;">×</span> ${orgName}
                    </h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 36px;">
                    <p style="margin:0 0 28px;font-size:15px;color:#9CA3AF;line-height:1.8;">
                      Salut,<br><br>
                      Tu as été invité à rejoindre <strong style="color:#E5E0F0;">Straygems</strong> en collaboration avec <strong style="color:#E5E0F0;">${orgName}</strong>.<br><br>
                      Bienvenue !
                    </p>
                    <a href="${inviteData?.properties?.action_link || '#'}"
                       style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#C084FC);color:#fff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.03em;">
                      Créer mon compte →
                    </a>
                    <p style="margin:24px 0 0;font-family:'Courier New',monospace;font-size:11px;color:#4A4560;line-height:1.7;">
                      Ce lien est valable 48 heures après réception.<br>
                      Si tu n'es pas concerné par cette invitation, ignore ce message.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:0 36px 28px;border-top:1px solid rgba(139,92,246,0.08);">
                    <p style="margin:20px 0 0;font-family:'Courier New',monospace;font-size:10px;color:#3D3A52;line-height:1.8;">
                      STRAYGEMS — Cultural curation in streetwear &amp; luxury fashion<br>
                      Ce mail a été envoyé automatiquement, merci de ne pas y répondre.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  return res.status(200).json({ success: true, email });
}
