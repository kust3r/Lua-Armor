import { Check, X } from "lucide-react";
import { estimatedCompletion } from "@/lib/job-contract";
const labels = ["Preparing & Compiling", "Obfuscating", "Finishing Up"];
function ObfuscationProgress({ phases, fileName, ready = false, attempt = 1 }) {
  const percent = estimatedCompletion(phases, ready);
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  return <div className="obf-progress">
    <div className="obf-overall"><h2>Overall Completion:</h2>
      <div className="obf-ring" role="progressbar" aria-label="Estimated overall completion" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <svg viewBox="0 0 240 240" aria-hidden="true"><circle className="obf-ring-track" cx="120" cy="120" r={radius} /><circle className="obf-ring-value" cx="120" cy="120" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} /></svg>
        <div className="obf-ring-label"><strong>{percent}<small>%</small></strong><span title={fileName}>{fileName}</span></div>
      </div>
      {!ready && <small className="obf-estimate">Estimated{attempt > 1 ? ` \xB7 Attempt ${attempt}` : ""}</small>}
    </div>
    <div className="obf-stages"><h2>Obfuscation Status</h2>{labels.map((label, i) => {
    const status = phases[i]?.status || "pending";
    return <div key={label} className={`obf-stage obf-stage-${i}`} data-status={status}>
        <span className="obf-step-number">{status === "done" ? <Check /> : status === "error" ? <X /> : i + 1}</span>
        <h3>{label}</h3><div className="obf-stage-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={status === "running" ? void 0 : status === "done" ? 100 : 0}><div className="obf-stage-fill" /></div>
      </div>;
  })}</div>
  </div>;
}
export {
  ObfuscationProgress as default
};
