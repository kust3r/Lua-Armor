import { useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowUp, Check, CodeXml, Paperclip, Square, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import LevelSlider from "./LevelSlider";
import CodeEditor from "./CodeEditor";
import { VM_PLATFORMS, restoreVmPlatform } from "@/lib/obfuscator/platforms";
import { supportedFile, formatKb } from "@/lib/job-contract";
function save(key, value) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
  }
}
function ObfuscationComposer({ busy, onSubmit, onCancel, externalError }) {
  const [code, setCode] = useState("");
  const [attachment, setAttachment] = useState();
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
      const stored = JSON.parse(localStorage.getItem("lpy_toggles") || "{}");
      for (const key of Object.keys(defaults)) if (typeof stored?.[key] === "boolean") defaults[key] = stored[key];
    } catch {
    }
    return defaults;
  });
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [starting, setStarting] = useState(false);
  const fileInput = useRef(null);
  const submitting = useRef(false);
  const locked = busy || reading || starting;
  const empty = !(attachment?.code ?? code).trim();
  const selected = VM_PLATFORMS.find((p) => p.id === platform);
  async function read(file) {
    if (!file || locked) return;
    if (!supportedFile(file.name) || /^(image|video|audio)\//i.test(file.type)) {
      setError("Escolha um arquivo de texto .lua, .luau ou .txt.");
      return;
    }
    setReading(true);
    setError("");
    try {
      const text = await file.text();
      if (/[\u0000-\u0008\u000e-\u001f\ufffd]/.test(text)) {
        setError("O anexo deve ser um arquivo de texto, n\xE3o m\xEDdia ou conte\xFAdo bin\xE1rio.");
        return;
      }
      if (!text.trim()) {
        setError("O arquivo selecionado est\xE1 vazio.");
        return;
      }
      setAttachment({ code: text, name: file.name });
    } catch {
      setError("N\xE3o foi poss\xEDvel ler o arquivo.");
    } finally {
      setReading(false);
    }
  }
  async function submit() {
    if (submitting.current || locked) return;
    const source = attachment?.code ?? code;
    if (!source.trim()) {
      setError("Cole seu c\xF3digo ou anexe um arquivo para ofuscar.");
      return;
    }
    submitting.current = true;
    setStarting(true);
    setError("");
    try {
      const input = { code: source, fileName: attachment?.name ?? "script.lua", platform, level, toggles, ...attachment ? { inputKind: "attachment" } : {} };
      if (await onSubmit(input)) {
        setCode("");
        setAttachment(void 0);
      }
    } catch {
      setError("N\xE3o foi poss\xEDvel iniciar. Seu c\xF3digo foi preservado.");
    } finally {
      submitting.current = false;
      setStarting(false);
    }
  }
  return <div className="obf-composer-area">
    <form className="obf-composer" aria-label="Ofuscar script" onSubmit={(e) => {
    e.preventDefault();
    void submit();
  }}>
      {attachment && <div className="obf-attachment-row"><div className="obf-attachment-card"><CodeXml aria-hidden="true" /><div><strong>{attachment.name}</strong><span>{formatKb(new Blob([attachment.code]).size)}</span></div><Button type="button" variant="ghost" size="icon" aria-label="Remover anexo" title="Remover anexo" disabled={locked} onClick={() => {
    setAttachment(void 0);
    setError("");
  }}><X /></Button></div></div>}
      <CodeEditor value={code} onChange={(value) => {
    setCode(value);
    setError("");
  }} placeholder="--Cole seu script Lua para ofuscar." readOnly={locked || !!attachment} integrated />
      <div className="obf-composer-toolbar">
        <div className="obf-composer-tools">
          <input ref={fileInput} aria-label="Arquivo Lua" type="file" accept="text/plain,.lua,.luau,.txt" hidden disabled={locked} onChange={(e) => {
    void read(e.target.files?.[0]);
    e.target.value = "";
  }} />
          <Button type="button" variant="ghost" size="icon" disabled={locked} aria-label="Anexar arquivo" title="Anexar arquivo" onClick={() => fileInput.current?.click()}><Paperclip /></Button>
          <Menu.Root><Menu.Trigger asChild><Button type="button" variant="ghost" size="icon" className="obf-platform-trigger" disabled={locked} aria-label={`Plataforma: ${platform === "roblox" ? "Roblox" : "LuaU"}`} title={`Plataforma: ${platform === "roblox" ? "Roblox" : "LuaU"}`}><CodeXml /></Button></Menu.Trigger><Menu.Portal><Menu.Content className="obf-composer-menu" align="start" sideOffset={8} collisionPadding={12}>
            <Menu.RadioGroup value={platform} onValueChange={(value) => {
    const p = restoreVmPlatform(value);
    setPlatform(p);
    save("lpy_platform", p);
  }}>
              {VM_PLATFORMS.map((p) => <Menu.RadioItem className="obf-menu-item" key={p.id} value={p.id}><span>{p.label}</span><Menu.ItemIndicator><Check /></Menu.ItemIndicator></Menu.RadioItem>)}
            </Menu.RadioGroup>
          </Menu.Content></Menu.Portal></Menu.Root>
          <Menu.Root><Menu.Trigger asChild><Button type="button" variant="ghost" size="icon" disabled={locked} aria-label="Opções de ofuscação" title="Opções de ofuscação"><Zap /></Button></Menu.Trigger><Menu.Portal><Menu.Content className="obf-composer-menu obf-settings-menu" align="start" sideOffset={8} collisionPadding={12}>
            {selected?.toggles.map((t) => <Menu.CheckboxItem key={t.id} className="obf-menu-item obf-menu-option" checked={!t.disabled && !!toggles[t.id]} disabled={t.disabled} onSelect={(e) => e.preventDefault()} onCheckedChange={(checked) => {
    const next = { ...toggles, [t.id]: checked };
    setToggles(next);
    save("lpy_toggles", next);
  }} aria-describedby={`composer-${t.id}`}>
              <span className="obf-option-check" aria-hidden="true"><Menu.ItemIndicator><span /></Menu.ItemIndicator></span>
              <span><strong>{t.label}</strong><span className="obf-option-description" id={`composer-${t.id}`}>{t.description}</span></span>
            </Menu.CheckboxItem>)}
          </Menu.Content></Menu.Portal></Menu.Root>
        </div>
        <div className="obf-composer-send">
          <LevelSlider
    value={level}
    onChange={(next) => {
      setLevel(next);
      save("lpy_level", String(next));
    }}
    disabled={locked}
    levels={[{ label: "Level 1" }, { label: "Level 2" }, { label: "Level 3" }]}
  />
          <Button type={busy ? "button" : "submit"} size="icon" className="obf-composer-submit" data-working={busy} aria-label={busy ? "Interromper ofusca\xE7\xE3o" : "Ofuscar"} title={busy ? "Interromper ofusca\xE7\xE3o" : "Ofuscar"} disabled={busy ? !onCancel : locked || empty} onClick={busy ? onCancel : void 0}>{busy ? <Square fill="currentColor" aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}</Button>
        </div>
      </div>
    </form>
    {(error || externalError) && <p id="obf-input-error" className="obf-error obf-composer-error" role="alert">{error || externalError}</p>}
  </div>;
}
export {
  ObfuscationComposer as default
};
