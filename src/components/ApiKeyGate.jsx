import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import logoUrl from "@/assets/lurapy-logo.svg";
import loginBackground from "@/assets/luraph-background.webp.asset.json";
import { loginWithKey, verifyAccess } from "@/lib/accessSession";
function Login() {
  const [authed, setAuthed] = useState(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    document.title = "Lurapy | Login";
    let alive = true;
    verifyAccess().then((v) => {
      if (alive) setAuthed(v);
    });
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Nunito+Sans:wght@400;500;600;700;800;900&family=Poppins:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(fontLink);
    return () => {
      alive = false;
      fontLink.remove();
    };
  }, []);
  const submit = (e) => {
    e.preventDefault();
    if (loading) return;
    const submittedKey = input.trim();
    setError("");
    setLoading(true);
    loginWithKey(submittedKey).then((ok) => {
      if (ok) {
        setAuthed(true);
      } else {
        setLoading(false);
        setError("Chave inv\xE1lida. Tente novamente.");
      }
    });
  };
  if (authed === null) return null;
  if (authed) return <Navigate to="/obfuscation" replace />;
  return <div className="login-screen relative overflow-hidden">
      <img src={loginBackground.url} alt="" aria-hidden="true" width={1e3} height={1e3} className="login-wave pointer-events-none absolute" />
      <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="login-form relative mx-auto"
  >
        <div className="login-brand flex items-center justify-center">
          <img src={logoUrl} alt="" className="login-brand-icon brightness-0 invert" />
          <span className="login-brand-name uppercase">LURAPY</span>
        </div>
        {loading ? <div className="login-loading" role="status" aria-label="Entrando">
            <span className="login-spinner" aria-hidden="true" />
          </div> : <form onSubmit={submit}>
        <h1 className="login-heading text-center font-extrabold">Login to your account</h1>
        <div className="login-field-group">
          <div className="login-label-row">
            <label htmlFor="access-key" className="login-label block">Key</label>
            {error && <span id="key-error" role="alert" className="login-error">{error}</span>}
          </div>
          <div className="login-input-wrap relative">
            <input
    id="access-key"
    required
    type={showKey ? "text" : "password"}
    value={input}
    onChange={(e) => {
      setInput(e.target.value);
      setError("");
    }}
    autoComplete="off"
    aria-invalid={Boolean(error)}
    aria-describedby={error ? "key-error" : void 0}
    maxLength={128}
    className="login-input w-full border outline-none"
  />
            <button
    type="button"
    onClick={() => setShowKey((v) => !v)}
    aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
    className="login-eye absolute"
  >
              {showKey ? <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" width="18" height="18">
                  <path d="M.143 2.31a.75.75 0 0 1 1.047-.167l14.5 10.5a.75.75 0 1 1-.88 1.214l-2.248-1.628C11.346 13.19 9.792 14 8 14c-1.981 0-3.67-.992-4.933-2.078C1.797 10.832.88 9.577.43 8.9a1.619 1.619 0 0 1 0-1.797c.353-.533.995-1.42 1.868-2.305L.31 3.357A.75.75 0 0 1 .143 2.31Zm1.536 5.622A.12.12 0 0 0 1.657 8c0 .021.006.045.022.068.412.621 1.242 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.195 0 2.31-.488 3.29-1.191L9.063 9.695A2 2 0 0 1 6.058 7.52L3.529 5.688a14.207 14.207 0 0 0-1.85 2.244ZM8 3.5c-.516 0-1.017.09-1.499.251a.75.75 0 1 1-.473-1.423A6.207 6.207 0 0 1 8 2c1.981 0 3.67.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.11.166-.248.365-.41.587a.75.75 0 1 1-1.21-.887c.148-.201.272-.382.371-.53a.119.119 0 0 0 0-.137c-.412-.621-1.242-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5Z" />
                </svg> : <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" width="18" height="18">
                  <path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z" />
                </svg>}
            </button>
          </div>
        </div>
        <Button type="submit" className="login-button w-full font-bold uppercase">
          LOGIN
        </Button>
        </form>}
      </motion.div>
      <div className="login-foreground pointer-events-none absolute" aria-hidden="true" />
    </div>;
}
export {
  Login as default
};
