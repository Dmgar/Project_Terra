import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Header, Icon, units } from "../ui";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";

export default function Account() {
  const { user, loading, parcels, login, register, logout, deleteParcel } = useAuth();
  const { t, featureLabel } = useI18n();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, name, password });
      }
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header
        title={
          <>
            {t("accountTitle1")}<br />
            <em>{t("accountTitle2")}</em>
          </>
        }
        description={t("accountDesc")}
      />

      {loading ? (
        <div className="panel loading">{t("loading")}</div>
      ) : !user ? (
        <div className="panel" style={{ maxWidth: 460, margin: "24px auto" }}>
          <div className="presets" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`preset ${mode === "login" ? "active" : ""}`}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              {t("tabLogin")}
            </button>
            <button
              type="button"
              className={`preset ${mode === "register" ? "active" : ""}`}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              {t("tabRegister")}
            </button>
          </div>

          <form onSubmit={onSubmit} className="field-grid" style={{ gridTemplateColumns: "1fr" }}>
            {mode === "register" && (
              <div className="field">
                <label htmlFor="auth-name">{t("nameLabel")}</label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="auth-email">{t("emailLabel")}</label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="auth-password">
                {t("passwordLabel")}{" "}
                {mode === "register" && <span>{t("passwordHint")}</span>}
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button type="submit" className="button" disabled={busy}>
              {mode === "login" ? t("loginBtn") : t("registerBtn")} <Icon />
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <strong>{t("signedInAs")}:</strong> {user.name} ({user.email})
            </div>
            <button type="button" className="button secondary" onClick={logout}>
              {t("logoutBtn")}
            </button>
          </div>

          <div className="panel">
            <h2>{t("savedParcelsTitle")} ({parcels.length})</h2>
            {parcels.length === 0 ? (
              <p className="panel-caption">{t("noParcelsYet")}</p>
            ) : (
              <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
                {parcels.map((p) => (
                  <div
                    key={p.id}
                    className="callout"
                    style={{ display: "grid", gap: 8, textAlign: "left" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                      <strong>
                        {p.name}
                        {p.department ? ` · ${p.department}` : ""}
                      </strong>
                      {p.recommendedCluster !== null && p.recommendedCluster !== undefined && (
                        <span>
                          {t("ecoregion")} {p.recommendedCluster}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.9rem", opacity: 0.85, display: "flex", flexWrap: "wrap", gap: "8px 14px" }}>
                      {Object.entries(p.values || {}).map(([k, v]) => (
                        <span key={k}>
                          <b>{featureLabel(k)}:</b> {v} {units[k] || ""}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                      <Link
                        className="button"
                        to="/producto/recomendar"
                        state={{ values: p.values }}
                      >
                        {t("loadInRecommend")} <Icon />
                      </Link>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => deleteParcel(p.id)}
                      >
                        {t("deleteParcel")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
