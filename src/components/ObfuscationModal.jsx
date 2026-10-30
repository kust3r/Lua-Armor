import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import CodeEditor from "@/components/CodeEditor";
import { VM_PLATFORMS, restoreVmPlatform } from "@/lib/obfuscator/platforms";
import { supportedFile } from "@/lib/job-contract";
import logo from "@/assets/lurapy-logo.svg";
const descriptions = {
  intenseVm: "Adds extra VM structures to make analysis more difficult. It does not guarantee resistance to deobfuscation.",
  gcFixes: "Releases consumed encrypted string blocks after decoding to reduce retained memory."
};
function ObfuscationModal({ open, onOpenChange, onSubmit, busy, externalError, onAcceptedFocus }) {
  const [platform, setPlatform] = useState(() => {
    try {
      return restoreVmPlatform(localStorage.getItem("lpy_platform"));
    } catch {
      return "roblox";
    }
  });
  const [level, setLevel] = useState(() => {
    try {
      const n = Number(localStorage.getItem("lpy_level"));
      if (n === 1 || n === 2 || n === 3) return n;
    } catch {
    }
    return 2;
  });
  const [toggles, setToggles] = useState(() => {
    const defaults = Object.fromEntries((VM_PLATFORMS.find((p) => p.id === platform)?.toggles ?? []).map((t) => [t.id, t.defaultValue]));
    try {
      const saved = JSON.parse(localStorage.getItem("lpy_toggles") || "{}");
      for (const key of Object.keys(defaults)) if (typeof saved?.[key] === "boolean") defaults[key] = saved[key];
    } catch {
    }
    return defaults;
  });
  const [mode, setMode] = useState("upload");
  const [upload, setUpload] = useState({ code: "", fileName: "" });
  const [paste, setPaste] = useState({ code: "", fileName: "script.lua" });
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [drag, setDrag] = useState(false);
  const submitting = useRef(false);
  const accepted = useRef(false);
  const fileRef = useRef(null);
  const save = (key, value) => {
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {
    }
  };
  const read = async (file) => {
    if (!file || busy) return;
    if (!supportedFile(file.name)) {
      setError("Choose a .lua, .luau, or .txt file.");
      return;
    }
    setReading(true);
    setError("");
    try {
      const code = await file.text();
      if (!code.trim()) {
        setError("The selected file is empty.");
        return;
      }
      setUpload({ code, fileName: file.name });
    } catch {
      setError("Could not read the selected file.");
    } finally {
      setReading(false);
    }
  };
  const submit = async () => {
    if (submitting.current || busy || reading) return;
    const input = mode === "upload" ? upload : paste;
    if (!input.code.trim()) {
      setError(mode === "upload" ? "Choose a non-empty source file." : "Paste your source code.");
      return;
    }
    if (!input.fileName.trim()) {
      setError("Enter a file name.");
      return;
    }
    if (!supportedFile(input.fileName)) {
      setError("Use a .lua, .luau, or .txt file name.");
      return;
    }
    submitting.current = true;
    setError("");
    try {
      const ok = await onSubmit({ ...input, platform, level, toggles });
      if (ok) {
        accepted.current = true;
        onOpenChange(false);
      }
    } finally {
      submitting.current = false;
    }
  };
  const selected = VM_PLATFORMS.find((p) => p.id === platform);
  return <Dialog.Root open={open} onOpenChange={(value) => {
    if (!busy) {
      accepted.current = false;
      onOpenChange(value);
    }
  }}><Dialog.Portal>
   <div className="obf-app obf-modal-host">
     <Dialog.Overlay className="obf-modal-overlay" />
     <Dialog.Content className="obf-modal" aria-describedby={void 0} onEscapeKeyDown={(e) => {
    if (busy) e.preventDefault();
  }} onPointerDownOutside={(e) => {
    if (busy) e.preventDefault();
  }} onCloseAutoFocus={(e) => {
    e.preventDefault();
    if (accepted.current) onAcceptedFocus();
    else document.getElementById("upload-new-file")?.focus();
  }}>
       <div className="obf-modal-header"><img src={logo} alt="" /><Dialog.Title>Lurapy Obfuscation</Dialog.Title><Dialog.Close asChild><Button size="icon" variant="ghost" disabled={busy} aria-label="Close settings"><X /></Button></Dialog.Close></div>
       <div className="obf-modal-body">
         <div className="obf-config">
           <div className="obf-field"><label htmlFor="obf-platform">Platform</label><select id="obf-platform" value={platform} disabled={busy} onChange={(e) => {
    const p = restoreVmPlatform(e.target.value);
    setPlatform(p);
    save("lpy_platform", p);
  }}><option value="roblox">Roblox</option><option value="luau">LuaU</option></select></div>
           <div className="obf-field"><label htmlFor="obf-level">Level</label><select id="obf-level" value={level} disabled={busy} onChange={(e) => {
    const n = Number(e.target.value);
    if (n === 1 || n === 2 || n === 3) {
      setLevel(n);
      save("lpy_level", String(n));
    }
  }}><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></div>
         </div>
         <div className="obf-options"><h3 className="obf-options-title">Options:</h3>{selected?.toggles.map((t) => <label key={t.id} className="obf-option" data-selected={t.id === "intenseVm" && !!toggles[t.id]} data-disabled={!!t.disabled}>
           <input type="checkbox" checked={!!toggles[t.id]} disabled={busy || t.disabled} aria-describedby={`description-${t.id}`} onChange={(e) => {
    const next = { ...toggles, [t.id]: e.target.checked };
    setToggles(next);
    save("lpy_toggles", next);
  }} />
           <div><strong>{t.label}</strong><p id={`description-${t.id}`}>{descriptions[t.id] || t.description}</p>{t.disabled && <span className="obf-option-note">Not available in direct output — functional limitation.</span>}</div>
         </label>)}</div>
         <div className="obf-input"><div className="obf-input-tabs" role="group" aria-label="Source input method"><Button disabled={busy} variant={mode === "upload" ? "default" : "secondary"} aria-pressed={mode === "upload"} onClick={() => {
    setMode("upload");
    setError("");
  }}><Upload />Upload file</Button><Button disabled={busy} variant={mode === "paste" ? "default" : "secondary"} aria-pressed={mode === "paste"} onClick={() => {
    setMode("paste");
    setError("");
  }}><FileText />Paste code</Button></div>
           {mode === "upload" ? <><input ref={fileRef} type="file" accept=".lua,.luau,.txt" hidden onChange={(e) => {
    void read(e.target.files?.[0]);
    e.target.value = "";
  }} /><Button variant="ghost" className="obf-drop" data-drag={drag} disabled={busy || reading} onClick={() => fileRef.current?.click()} onDragOver={(e) => {
    e.preventDefault();
    setDrag(true);
  }} onDragLeave={() => setDrag(false)} onDrop={(e) => {
    e.preventDefault();
    setDrag(false);
    void read(e.dataTransfer.files[0]);
  }}><Upload /><strong>{reading ? "Reading file\u2026" : upload.fileName || "Choose a source file"}</strong><span>.lua, .luau, .txt</span></Button></> : <div className="obf-editor"><div className="obf-field"><label htmlFor="obf-filename">File name</label><input id="obf-filename" value={paste.fileName} disabled={busy} onChange={(e) => setPaste((v) => ({ ...v, fileName: e.target.value }))} /></div><CodeEditor value={paste.code} onChange={(code) => setPaste((v) => ({ ...v, code }))} placeholder="-- Paste your Lua code here..." readOnly={busy} /></div>}
           {(error || externalError) && <p id="obf-input-error" className="obf-error" role="alert">{error || externalError}</p>}
         </div>
       </div>
       <div className="obf-modal-footer"><Button className="obf-submit" disabled={busy || reading} onClick={() => {
    void submit();
  }}>{busy ? "Starting\u2026" : "OBFUSCATE"}</Button></div>
     </Dialog.Content>
   </div>
 </Dialog.Portal></Dialog.Root>;
}
export {
  ObfuscationModal as default
};
