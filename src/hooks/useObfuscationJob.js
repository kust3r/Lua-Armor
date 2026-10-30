import { normalizeToggles } from "@/lib/obfuscator/normalize-toggles";
import { describeGenerationFailure } from "@/lib/error-messages";
import { useEffect, useRef, useState } from "react";
import { emptyPhases, applyPhase } from "@/lib/job-contract";
import { saveJob, reconcileInterrupted, GENERATION_LOCK } from "@/lib/history-store";
import { DEFAULT_NAME_CONFIG } from "@/lib/obfuscator/types";
function useObfuscationJob() {
  const [state, setState] = useState("idle");
  const [phases, setPhases] = useState(emptyPhases);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState();
  const [warning, setWarning] = useState("");
  const [fileName, setFileName] = useState("");
  const [usedLevel, setUsedLevel] = useState();
  const [attempt, setAttempt] = useState(1);
  const active = useRef(false);
  const mounted = useRef(true);
  const worker = useRef();
  const finishLock = useRef();
  const abort = useRef();
  const record = useRef();
  const currentId = useRef("");
  useEffect(() => {
    mounted.current = true;
    if (navigator.locks) void navigator.locks.request(GENERATION_LOCK, { ifAvailable: true }, async (lock) => {
      if (lock) await reconcileInterrupted().catch(() => {
      });
    });
    const before = (e) => {
      if (active.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", before);
      worker.current?.terminate();
      const entry = record.current;
      if (active.current && entry?.status === "running") void saveJob({ ...entry, status: "interrupted", finishedAt: Date.now(), error: "A navega\xE7\xE3o interrompeu a ofusca\xE7\xE3o." }).catch(() => {
      }).finally(() => finishLock.current?.());
      else if (!active.current) finishLock.current?.();
      active.current = false;
    };
  }, []);
  const start = (input) => {
    if (active.current) return Promise.resolve(false);
    active.current = true;
    setState("starting");
    setError("");
    setDiagnostic(void 0);
    setWarning("");
    if (!navigator.locks) {
      active.current = false;
      setState("idle");
      setError("Este navegador n\xE3o consegue coordenar a ofusca\xE7\xE3o com seguran\xE7a entre abas. Use um Chrome, Firefox ou Safari atualizado.");
      return Promise.resolve(false);
    }
    return new Promise((resolveStart) => {
      let settled = false;
      let cancelled = false;
      abort.current = () => {
        cancelled = true;
      };
      const accept = (value) => {
        if (!settled) {
          settled = true;
          resolveStart(value);
        }
      };
      void navigator.locks.request(GENERATION_LOCK, { ifAvailable: true }, async (lock) => {
        if (cancelled) {
          active.current = false;
          setState("idle");
          setError("Ofusca\xE7\xE3o interrompida por voc\xEA. Nenhum arquivo foi gerado.");
          accept(false);
          return;
        }
        if (!lock) {
          active.current = false;
          setState("idle");
          setError("Outra aba est\xE1 gerando um arquivo. Aguarde terminar e tente de novo.");
          accept(false);
          return;
        }
        await reconcileInterrupted().catch(() => {
        });
        if (!mounted.current || cancelled) {
          active.current = false;
          if (mounted.current) {
            setState("idle");
            setError("Ofusca\xE7\xE3o interrompida por voc\xEA. Nenhum arquivo foi gerado.");
          }
          accept(false);
          return;
        }
        await new Promise((release) => {
          finishLock.current = release;
          let accepted = false;
          let completed = false;
          const fail = async (message, detail, interrupted = false) => {
            if (completed) return;
            completed = true;
            worker.current?.terminate();
            clearTimeout(readyTimeout);
            if (mounted.current) {
              setError(describeGenerationFailure(message, detail));
              setDiagnostic(detail);
              setState(accepted ? "error" : "idle");
              setPhases((prev) => {
                const next = prev.map((p) => ({ ...p }));
                const index = Math.max(0, next.findIndex((p) => p.status === "running"));
                next[index] = { status: "error", progress: 0 };
                return next;
              });
            }
            if (accepted && record.current) await saveJob({ ...record.current, status: interrupted ? "interrupted" : "failed", finishedAt: Date.now(), error: interrupted ? message : "A ofusca\xE7\xE3o falhou. Tente de novo com o c\xF3digo desta sess\xE3o." }).catch(() => {
            });
            active.current = false;
            accept(false);
            release();
          };
          const readyTimeout = setTimeout(() => {
            void fail("N\xE3o foi poss\xEDvel carregar o gerador. Verifique sua conex\xE3o e tente de novo.");
          }, 2e4);
          abort.current = () => {
            void fail("Ofusca\xE7\xE3o interrompida por voc\xEA. Nenhum arquivo foi gerado.", void 0, true);
          };
          try {
            const w = new Worker(new URL("../lib/obfuscation-worker.js", import.meta.url), { type: "module" });
            worker.current = w;
            w.onerror = () => {
              void fail("A ofusca\xE7\xE3o parou inesperadamente. Seu c\xF3digo foi preservado para tentar de novo.");
            };
            w.onmessageerror = () => {
              void fail("N\xE3o foi poss\xEDvel ler o resultado da ofusca\xE7\xE3o. Tente de novo.");
            };
            w.onmessage = async (message) => {
              const data = message.data;
              if (!data || typeof data !== "object" || completed || !mounted.current) return;
              if (data.type === "ready") {
                if (accepted) return;
                clearTimeout(readyTimeout);
                accepted = true;
                const id = crypto.randomUUID();
                currentId.current = id;
                const entry = { id, fileName: input.fileName, createdAt: Date.now(), status: "running", platform: input.platform, level: input.level, toggles: normalizeToggles(input.toggles), outputSize: 0 };
                record.current = entry;
                await saveJob(entry).catch(() => setWarning("O hist\xF3rico local est\xE1 indispon\xEDvel. Seu resultado ainda poder\xE1 ser baixado nesta sess\xE3o."));
                if (!mounted.current || completed) {
                  active.current = false;
                  accept(false);
                  release();
                  return;
                }
                setFileName(input.fileName);
                setOutput("");
                setUsedLevel(void 0);
                setPhases(emptyPhases());
                setAttempt(1);
                setState("running");
                accept(true);
                const hardenedVmVersion = input.level === 3 && (input.platform === "luau" || input.platform === "roblox") && import.meta.env.VITE_LURAPY_LEGACY_LEVEL3 !== "1" ? 4 : void 0;
                try {
                  w.postMessage({ type: "obfuscate", jobId: id, code: input.code, options: { code: input.code, platform: input.platform, optimizationLevel: input.level, toggles: normalizeToggles(input.toggles), nameConfig: DEFAULT_NAME_CONFIG, ...hardenedVmVersion ? { hardenedVmVersion } : {} } });
                } catch {
                  void fail("N\xE3o foi poss\xEDvel enviar o arquivo para ofuscar. Tente de novo.");
                }
                return;
              }
              if (!("jobId" in data) || data.jobId !== currentId.current || !accepted) return;
              if (data.type === "progress") {
                const event = data.event;
                if (!event || ![0, 1, 2].includes(event.phase) || !["running", "done"].includes(event.status) || !Number.isInteger(event.attempt) || event.attempt < 1) return;
                if (event.attempt > 1) {
                  void fail("N\xE3o foi poss\xEDvel concluir a ofusca\xE7\xE3o na intensidade escolhida. O gerador n\xE3o conseguiu validar o resultado; nenhum arquivo foi gerado.");
                  return;
                }
                setPhases((prev) => applyPhase(prev, event));
                setAttempt(event.attempt);
              } else if (data.type === "error") {
                void fail(typeof data.message === "string" ? data.message : "A ofusca\xE7\xE3o falhou.", data.diagnostic);
              } else if (data.type === "result") {
                if (typeof data.output !== "string" || !data.output.length || ![1, 2, 3].includes(data.usedLevel)) {
                  void fail("O arquivo gerado est\xE1 ausente ou inv\xE1lido.");
                  return;
                }
                completed = true;
                w.terminate();
                const artifact = new Blob([data.output], { type: "text/x-lua;charset=utf-8" });
                setOutput(data.output);
                setUsedLevel(data.usedLevel);
                setState("done");
                setPhases(emptyPhases().map(() => ({ status: "done", progress: 100 })));
                if (record.current) {
                  const finalEntry = { ...record.current, status: "completed", finishedAt: Date.now(), level: data.usedLevel, outputSize: artifact.size, artifact, generation: data.metadata };
                  record.current = finalEntry;
                  await saveJob(finalEntry).catch(() => {
                    if (mounted.current) setWarning("Seu arquivo est\xE1 pronto, mas n\xE3o p\xF4de ser salvo no hist\xF3rico. Baixe-o antes de sair desta p\xE1gina.");
                  });
                }
                active.current = false;
                release();
              }
            };
          } catch {
            void fail("N\xE3o foi poss\xEDvel iniciar a ofusca\xE7\xE3o. Seu c\xF3digo foi preservado.");
          }
        });
      }).catch(() => {
        active.current = false;
        setState("idle");
        setError("N\xE3o foi poss\xEDvel coordenar a ofusca\xE7\xE3o. Tente de novo.");
        accept(false);
      });
    });
  };
  const cancel = () => {
    if (active.current) abort.current?.();
  };
  const reset = () => {
    if (active.current) return;
    setState("idle");
    setOutput("");
    setError("");
    setDiagnostic(void 0);
    setWarning("");
    setPhases(emptyPhases());
  };
  return { state, phases, output, error, diagnostic, warning, fileName, usedLevel, attempt, start, cancel, reset };
}
export {
  useObfuscationJob
};
