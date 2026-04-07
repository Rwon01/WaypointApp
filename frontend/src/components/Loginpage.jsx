import { useState } from "react";
import { setToken } from "./auth";

export default function LoginPage({ onLogin }) {
  const [form,    setForm]    = useState({ username: "", password: "" });
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }
      const { token } = await res.json();
      setToken(token);
      onLogin();
    } catch (err) {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#0f172a",
    }}>
      <div style={{
        width: 320, background: "#1e293b",
        border: "1px solid #334155", borderRadius: 12,
        padding: "32px 28px",
      }}>
        {/* Logo / title */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48, borderRadius: 10,
            background: "#0f172a", border: "1px solid #334155", marginBottom: 12,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h7v7H3V3zM14 3h7v7h-7V3zM14 14h7v7h-7v-7zM3 14h7v7H3v-7z"
                stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#f1f5f9" }}>MC Map</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#0f172a", border: "1px solid #334155",
                borderRadius: 6, padding: "8px 10px",
                color: "#f1f5f9", fontSize: 13, outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#0f172a", border: "1px solid #334155",
                borderRadius: 6, padding: "8px 10px",
                color: "#f1f5f9", fontSize: 13, outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "7px 10px", borderRadius: 6,
              background: "#450a0a", border: "1px solid #dc2626",
              fontSize: 12, color: "#fca5a5",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: "9px 0", borderRadius: 6,
              background: loading ? "#1e3a5f" : "#2563eb",
              border: "none", color: loading ? "#475569" : "#fff",
              fontSize: 13, fontWeight: 500,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}