import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, ChevronUp, CodeXml, Copy, Download, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sessionArtifactName, downloadArtifact, formatKb } from "@/lib/job-contract";
import logoUrl from "@/assets/lurapy-logo.svg";
import { FileDownloadIcon } from "./ReferenceIcons";
const MAX_VISIBLE_LINES = 10;
const MAX_VISIBLE_CHARS = 900;
function isLong(code) {
  return code.length > MAX_VISIBLE_CHARS || code.split("\n").length > MAX_VISIBLE_LINES;
}
function UserCode({ code }) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const long = isLong(code);
  useEffect(() => {
    if (!expanded || typeof IntersectionObserver === "undefined") return;
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entryItem) => !entryItem.isIntersecting)) setExpanded(false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded]);
  return <div ref={rootRef} className={`obf-user-code${long && !expanded ? " obf-user-code-clamped" : ""}`}>
    <pre className="obf-user-code-text">{code}</pre>
    {long && <Button variant="ghost" size="sm" className="obf-user-code-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Mostrar menos" : "Mostrar mais"}{expanded ? <ChevronUp /> : <ChevronDown />}</Button>}
  </div>;
}
function ObfuscationExchange({ entry }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2e3);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const name = useMemo(() => sessionArtifactName(entry.input, entry.output), [entry.input, entry.output]);
  const working = entry.status === "running" || entry.status === "starting";
  const running = entry.phases.findIndex((p) => p.status === "running");
  const finished = entry.phases.filter((p) => p.status === "done").length;
  const stageIndex = Math.min(2, Math.max(running, finished));
  const stage = ["Pensando...", "Ofuscando...", "Finalizando..."][stageIndex];
  return <article className="obf-exchange" aria-label={`Ofusca\xE7\xE3o de ${entry.input.fileName}`}>
    <div className={`obf-user-message${entry.input.inputKind === "attachment" ? " obf-user-attachment" : ""}`}>
      {entry.input.inputKind === "attachment" ? <div className="obf-attachment-card"><CodeXml aria-hidden="true" /><div><strong>{entry.input.fileName}</strong><span>{formatKb(new Blob([entry.input.code]).size)}</span></div></div> : <UserCode code={entry.input.code} />}
    </div>
    <div className="obf-assistant-message">
      <div className="obf-agent-identity"><img src={logoUrl} alt="" width="24" height="24" /><span>LURAPY</span></div>
      {working && <div className="obf-chat-working" role="status"><span className="obf-chat-shimmer" data-stage={stageIndex}>{stage}</span></div>}
      {entry.status === "error" && <div className="obf-chat-error"><p role="alert">{entry.error}</p></div>}
      {entry.status === "done" && <>
        <div className="obf-chat-file">
          <div className="obf-file-heading"><FileDownloadIcon /><div><strong>{name}</strong><span>{formatKb(new Blob([entry.output]).size)}</span></div></div>
          <div className="obf-file-actions">
            <Dialog.Root open={expanded} onOpenChange={setExpanded}>
              <Dialog.Trigger asChild><Button variant="ghost" size="icon" aria-label="Expandir" title="Expandir"><Maximize2 /></Button></Dialog.Trigger>
              <Dialog.Portal><div className="obf-app obf-modal-host">
                <Dialog.Overlay className="obf-modal-overlay" />
                <Dialog.Content className="obf-raw-dialog" aria-describedby={void 0}>
                  <div className="obf-raw-header"><Dialog.Title className="obf-raw-title">{name}</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar" title="Fechar"><X /></Button></Dialog.Close></div>
                  <pre className="obf-raw-code" tabIndex={0} aria-label="Conteúdo ofuscado">{entry.output}</pre>
                </Dialog.Content>
              </div></Dialog.Portal>
            </Dialog.Root>
            <Button variant="ghost" size="icon" aria-label={copied ? "Copiado" : "Copiar"} title={copied ? "Copiado" : "Copiar"} onClick={() => {
    void navigator.clipboard.writeText(entry.output).then(() => {
      setCopied(true);
      setCopyError("");
    }).catch(() => setCopyError("N\xE3o foi poss\xEDvel copiar. Baixe o arquivo."));
  }}>{copied ? <Check /> : <Copy />}</Button>
            <Button variant="ghost" size="icon" aria-label="Baixar" title="Baixar" onClick={() => downloadArtifact(new Blob([entry.output], { type: "text/x-lua;charset=utf-8" }), name, true)}><Download /></Button>
          </div>
        </div>
        {copyError && <p role="alert">{copyError}</p>}
      </>}
    </div>
  </article>;
}
export {
  ObfuscationExchange as default
};
