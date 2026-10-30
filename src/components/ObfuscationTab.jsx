import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useObfuscationJob } from "@/hooks/useObfuscationJob";
import { emptyPhases } from "@/lib/job-contract";
import { updateSubmission } from "@/lib/obfuscation-session";
import ObfuscationComposer from "./ObfuscationComposer";
import ObfuscationExchange from "./ObfuscationExchange";
import { localGreeting } from "@/lib/greeting";
function ObfuscationTab() {
  const job = useObfuscationJob();
  const [entries, setEntries] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [greeting, setGreeting] = useState(() => localGreeting());
  const end = useRef(null);
  const dock = useRef(null);
  const busy = job.state === "starting" || job.state === "running";
  const chat = entries.length > 0;
  useEffect(() => {
    const element = dock.current;
    const main = element?.parentElement;
    if (!element || !main) return;
    const measure = () => main.style.setProperty("--obf-dock-height", `${element.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      main.style.removeProperty("--obf-dock-height");
    };
  }, []);
  useEffect(() => {
    const refresh = () => setGreeting(localGreeting());
    const timer = window.setInterval(refresh, 3e4);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function start(input) {
    const accepted = await job.start(input);
    if (accepted) {
      const id = crypto.randomUUID();
      setEntries((prev) => [...prev, { id, input, status: "running", output: "", error: "", phases: emptyPhases(), attempt: 1 }]);
      setActiveId(id);
    }
    return accepted;
  }
  useEffect(() => {
    if (!activeId) return;
    if (job.state === "running") setEntries((prev) => updateSubmission(prev, activeId, { status: "running", phases: job.phases, attempt: job.attempt }));
    else if (job.state === "done" && job.output) {
      setEntries((prev) => updateSubmission(prev, activeId, { status: "done", output: job.output, phases: job.phases }));
      setActiveId("");
    } else if (job.state === "error") {
      setEntries((prev) => updateSubmission(prev, activeId, { status: "error", error: job.error }));
      setActiveId("");
    }
  }, [activeId, job.state, job.phases, job.output, job.error, job.attempt]);
  useEffect(() => {
    if (chat) end.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [entries, chat]);
  return <MotionConfig reducedMotion="user">
    <div className="obf-transcript">
    <AnimatePresence initial={false}>
      {!chat && <motion.div key="welcome" className="obf-welcome" exit={{ opacity: 0, y: -16, height: 0, flex: 0 }} transition={{ duration: 0.3 }}><h1>{greeting}</h1><p>Pronto para ofuscar?</p></motion.div>}
    </AnimatePresence>
    {chat && <section className="obf-conversation" aria-label="Conversa de ofuscação" aria-live="polite">
      {entries.map((entry) => <motion.div key={entry.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <ObfuscationExchange entry={entry} />
      </motion.div>)}
      <div ref={end} />
    </section>}
    </div>
    <motion.div ref={dock} layout transition={{ type: "spring", stiffness: 220, damping: 30 }} className="obf-composer-dock">
      <ObfuscationComposer busy={busy} onSubmit={start} onCancel={job.cancel} externalError={job.state === "idle" || !activeId && !chat ? job.error : ""} />
      {job.warning && <p className="obf-notice" role="alert">{job.warning}</p>}
    </motion.div>
  </MotionConfig>;
}
export {
  ObfuscationTab as default
};
