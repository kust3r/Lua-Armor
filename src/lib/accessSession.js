import { supabase } from "@/integrations/supabase/client";
const ACCESS_TOKEN_STORAGE = "lurapy_access_token";
const LEGACY_STORAGE = "lurapy_api_key";
function clearAccess() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE);
  localStorage.removeItem(LEGACY_STORAGE);
}
async function loginWithKey(key) {
  try {
    const { data, error } = await supabase.functions.invoke("access-key", { body: { action: "login", key } });
    if (error || !data?.ok || typeof data.token !== "string") return false;
    localStorage.removeItem(LEGACY_STORAGE);
    localStorage.setItem(ACCESS_TOKEN_STORAGE, data.token);
    return true;
  } catch {
    return false;
  }
}
async function verifyAccess() {
  localStorage.removeItem(LEGACY_STORAGE);
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE);
  if (!token) return false;
  try {
    const { data, error } = await supabase.functions.invoke("access-key", { body: { action: "verify", token } });
    if (error || !data?.ok) {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
export {
  ACCESS_TOKEN_STORAGE,
  clearAccess,
  loginWithKey,
  verifyAccess
};
