import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// ─── DESIGN TOKENS (sync avec Vendeur.jsx) ────────────────────────────────────
const C = {
  bg: "#0D0D12", surface: "#13131A",
  purple: "#8B5CF6", accent: "#C084FC",
  text: "#E5E0F0", textDim: "#7B7490",
  danger: "#EF4444", active: "#4ADE80",
  border: "rgba(139,92,246,0.2)",
};

// ─── ACCEPT INVITE ────────────────────────────────────────────────────────────
export default function AcceptInvite() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [status, setStatus]       = useState("idle"); // idle | loading | success | error
  const [error, setError]         = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [shake, setShake]         = useState(false);

  // ─── Récupère le token depuis le hash de l'URL ─────────────────────────────
  // Supabase envoie : /accept-invite#access_token=...&type=invite
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      setError("Lien invalide ou expiré. Demande une nouvelle invitation.");
      return;
    }

    const params = new URLSearchParams(hash.replace("#", ""));
    const accessToken  = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type         = params.get("type");

    if (type !== "invite" || !accessToken) {
      setError("Ce lien n'est pas un lien d'invitation valide.");
      return;
    }

    // Établit la session avec le token du lien d'invitation
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken || "" })
      .then(({ error }) => {
        if (error) {
          setError("Session expirée. Demande une nouvelle invitation.");
        } else {
          setSessionReady(true);
          // Nettoie le hash de l'URL pour éviter de rejouer le token
          window.history.replaceState(null, "", window.location.pathname);
        }
      });
  }, []);

  // ─── Validation ───────────────────────────────────────────────────────────
  const validate = () => {
    if (password.length < 8) return "Minimum 8 caractères.";
    if (password !== confirm) return "Les mots de passe ne correspondent pas.";
    return null;
  };

  // ─── Soumission ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setStatus("loading");
    setError("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setStatus("error");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else {
      setStatus("success");
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: C.bg, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Space Grotesk', sans-serif", padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-8px); }
          40%,80%  { transform: translateX(8px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .invite-card { animation: fadeIn 0.35s ease; }
      `}</style>

      <div className="invite-card" style={{
        background: C.surface,
        border: `1px solid rgba(139,92,246,0.3)`,
        borderRadius: 12,
        padding: "36px 28px",
        width: "100%", maxWidth: 360,
        textAlign: "center",
        animation: shake ? "shake 0.4s ease" : undefined,
      }}>

        {/* ── En-tête ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.purple, boxShadow: "0 0 10px #8B5CF6" }} />
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.06em", color: C.text }}>LA BARAKA</span>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.textDim, letterSpacing: "0.1em", marginBottom: 28 }}>
          CRÉATION DE COMPTE
        </div>

        {/* ── États ── */}
        {!sessionReady && !error && (
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textDim, padding: "20px 0" }}>
            Vérification du lien…
          </div>
        )}

        {error && !sessionReady && (
          <>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.danger, marginBottom: 20, lineHeight: 1.6 }}>
              {error}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.textDim }}>
              Contacte ton administrateur pour recevoir un nouveau lien.
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: C.active, marginBottom: 8 }}>Compte créé</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.textDim, marginBottom: 24 }}>
              Ton mot de passe est enregistré.
            </div>
            <button
              onClick={() => window.location.href = "/vendeur"}
              style={{
                width: "100%", background: `linear-gradient(135deg, ${C.purple}, ${C.accent})`,
                border: "none", color: "#fff", padding: "12px", borderRadius: 6,
                cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600,
              }}>
              Accéder à mon espace →
            </button>
          </>
        )}

        {sessionReady && status !== "success" && (
          <>
            {/* ── Champ mot de passe ── */}
            <div style={{ marginBottom: 12, textAlign: "left" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.textDim, letterSpacing: "0.1em", marginBottom: 6 }}>
                MOT DE PASSE
              </div>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="Minimum 8 caractères"
                autoFocus
                style={{
                  width: "100%", background: "#0A0A0F",
                  border: `1px solid ${error ? "rgba(239,68,68,0.5)" : C.border}`,
                  borderRadius: 6, color: C.text,
                  padding: "11px 14px",
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 14,
                  outline: "none", boxSizing: "border-box", letterSpacing: "0.04em",
                }}
              />
            </div>

            {/* ── Confirmation ── */}
            <div style={{ marginBottom: 20, textAlign: "left" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.textDim, letterSpacing: "0.1em", marginBottom: 6 }}>
                CONFIRMER
              </div>
              <input
                type="password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="Répète ton mot de passe"
                style={{
                  width: "100%", background: "#0A0A0F",
                  border: `1px solid ${error ? "rgba(239,68,68,0.5)" : C.border}`,
                  borderRadius: 6, color: C.text,
                  padding: "11px 14px",
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 14,
                  outline: "none", boxSizing: "border-box", letterSpacing: "0.04em",
                }}
              />
            </div>

            {/* ── Erreur inline ── */}
            {error && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.danger, marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* ── Bouton ── */}
            <button
              onClick={handleSubmit}
              disabled={status === "loading"}
              style={{
                width: "100%",
                background: status === "loading" ? "#1A1A24" : `linear-gradient(135deg, ${C.purple}, ${C.accent})`,
                border: "none",
                color: status === "loading" ? C.textDim : "#fff",
                padding: "12px", borderRadius: 6,
                cursor: status === "loading" ? "not-allowed" : "pointer",
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600,
              }}>
              {status === "loading" ? "Enregistrement…" : "Créer mon compte"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
