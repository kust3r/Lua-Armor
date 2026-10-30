import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "@/components/ApiKeyGate";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { verifyAccess } from "@/lib/accessSession";
function Protected({ children }) {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let alive = true;
    verifyAccess().then((v) => {
      if (alive) setOk(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (ok === null) return null;
  if (!ok) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
const App = () => <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/obfuscation" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
  path="/obfuscation"
  element={<Protected>
            <Dashboard />
          </Protected>}
/>
      <Route path="/dashboard/*" element={<Navigate to="/obfuscation" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>;
var App_default = App;
export {
  App_default as default
};
