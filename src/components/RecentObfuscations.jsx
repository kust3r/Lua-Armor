import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, Check, X, Loader2, Clock, Info, MoreHorizontal } from "lucide-react";
import { FileDownloadIcon } from "./ReferenceIcons";
import { Button } from "@/components/ui/button";
import { getJobs, deleteJob, clearAll, subscribeHistory } from "@/lib/history-store";
import { downloadArtifact } from "@/lib/job-contract";
function RecentObfuscations() {
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(6);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [remove, setRemove] = useState();
  const [deleting, setDeleting] = useState(false);
  const [info, setInfo] = useState(false);
  const [actions, setActions] = useState();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => subscribeHistory(() => setRevision((v) => v + 1)), []);
  useEffect(() => {
    let stale = false;
    setLoading(true);
    void getJobs(limit, 0).then((result) => {
      if (!stale) {
        setItems(result.items);
        setMore(result.hasMore);
        setError("");
      }
    }).catch(() => {
      if (!stale) setError("Could not load local history. Your browser may have disabled storage.");
    }).finally(() => {
      if (!stale) setLoading(false);
    });
    return () => {
      stale = true;
    };
  }, [limit, revision]);
  const confirm = async () => {
    if (!remove) return;
    setDeleting(true);
    try {
      if (remove === "all") await clearAll();
      else await deleteJob(remove);
      setRemove(void 0);
      setRevision((v) => v + 1);
    } catch {
      setError("Could not remove the saved file. Please retry.");
    } finally {
      if (alive.current) setDeleting(false);
    }
  };
  return <section className="obf-history" aria-labelledby="history-title">
   <div className="obf-history-head"><h2 id="history-title">Recent Obfuscations</h2>{items.length > 0 && <div className="obf-history-menu obf-clear"><Button size="icon" variant="ghost" aria-label="History actions" title="History actions" aria-expanded={actions === "all"} onClick={() => setActions((v) => v === "all" ? void 0 : "all")}><MoreHorizontal /></Button>{actions === "all" && <div className="obf-secondary-menu" onKeyDown={(e) => {
    if (e.key === "Escape") setActions(void 0);
  }}><Button variant="ghost" onClick={() => {
    setRemove("all");
    setActions(void 0);
  }}><Trash2 />Clear history</Button></div>}</div>}</div>
   <div className="obf-history-caption"><span>Stored on this browser</span><Button size="icon" variant="ghost" aria-label="About local history" title="About local history" onClick={() => setInfo(true)}><Info /></Button></div>
   {error && <div className="obf-empty" role="alert">{error}<Button variant="link" onClick={() => setRevision((v) => v + 1)}>Retry</Button></div>}
   {items.length > 0 && <div className="obf-history-columns" aria-hidden="true"><span /><span>Status</span><span>Action</span></div>}
   <div className="obf-history-list">{items.map((entry) => <div key={entry.id} className="obf-history-row">
     <div className="obf-file-info"><strong>{entry.fileName}</strong><code>{entry.id}</code><time dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>
     <span className="obf-history-status" role="img" aria-label={entry.status} title={entry.error || entry.status}>{entry.status === "completed" ? <Check size={23} /> : entry.status === "running" ? <Clock size={23} /> : <X size={23} />}</span>
     <div className="obf-history-actions"><Button variant="default" size="icon" className="obf-history-download" disabled={!entry.artifact || entry.status !== "completed"} aria-label={entry.artifact ? `Download ${entry.fileName}` : `Download unavailable: ${entry.status}`} title={entry.artifact ? "Download file" : entry.error || "File is not ready"} onClick={() => {
    if (entry.artifact) downloadArtifact(entry.artifact, entry.fileName);
  }}><FileDownloadIcon /></Button><div className="obf-history-menu"><Button variant="ghost" size="icon" aria-label={`Actions for ${entry.fileName}`} title="File actions" aria-expanded={actions === entry.id} onClick={() => setActions((v) => v === entry.id ? void 0 : entry.id)}><MoreHorizontal /></Button>{actions === entry.id && <div className="obf-secondary-menu" onKeyDown={(e) => {
    if (e.key === "Escape") setActions(void 0);
  }}><Button variant="ghost" disabled={entry.status === "running"} onClick={() => {
    setRemove(entry.id);
    setActions(void 0);
  }}><Trash2 />Delete {entry.fileName}</Button></div>}</div></div>
   </div>)}</div>
   {loading && <div className="obf-empty" role="status"><Loader2 className="mx-auto animate-spin" aria-label="Loading history" /></div>}
   {!loading && !error && !items.length && <p className="obf-empty">No obfuscations yet.</p>}
   {more && !loading && <Button variant="ghost" className="obf-more" onClick={() => setLimit((v) => v + 6)}>LOAD MORE +</Button>}
   <Dialog.Root open={info} onOpenChange={setInfo}><Dialog.Portal><div className="obf-app obf-modal-host"><Dialog.Overlay className="obf-modal-overlay" /><Dialog.Content className="obf-modal obf-confirm"><Dialog.Title>Local history</Dialog.Title><Dialog.Description>Saved in this browser only, shared with anyone using this browser profile. Clearing browser data removes saved files; logging out does not. Original source code and credentials are never saved in history. Use file actions to delete a saved file, or history actions to clear all records.</Dialog.Description><div className="obf-confirm-actions"><Dialog.Close asChild><Button>Close</Button></Dialog.Close></div></Dialog.Content></div></Dialog.Portal></Dialog.Root>
   <Dialog.Root open={!!remove} onOpenChange={(open) => {
    if (!open && !deleting) setRemove(void 0);
  }}><Dialog.Portal><div className="obf-app obf-modal-host"><Dialog.Overlay className="obf-modal-overlay" /><Dialog.Content className="obf-modal obf-confirm"><Dialog.Title>Delete saved {remove === "all" ? "history" : "file"}?</Dialog.Title><Dialog.Description>This removes {remove === "all" ? "all completed, failed and interrupted records and files" : "this record and its saved file"} from this browser. This cannot be undone.</Dialog.Description><div className="obf-confirm-actions"><Dialog.Close asChild><Button variant="secondary" disabled={deleting}>Keep files</Button></Dialog.Close><Button variant="destructive" disabled={deleting} onClick={() => {
    void confirm();
  }}>Delete</Button></div></Dialog.Content></div></Dialog.Portal></Dialog.Root>
 </section>;
}
export {
  RecentObfuscations as default
};
