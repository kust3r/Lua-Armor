import { useRef, useCallback } from "react";
const CodeEditor = ({ value, onChange, placeholder, readOnly = false, integrated = false }) => {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const lines = value ? value.split("\n") : [""];
  const lineCount = lines.length;
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);
  return <div className={integrated ? "obf-integrated-editor" : "space-y-0"}>
      {!integrated && <div className="flex items-center justify-between px-4 py-3 glass border-b-0 rounded-t-2xl">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Source code</span>
        <span className="text-xs font-mono text-muted-foreground/60">{value.length} characters</span>
      </div>}

      <div className={integrated ? "obf-code-area" : "relative flex h-[280px] min-h-0 max-h-[280px] border border-t-0 border-border/50 rounded-b-2xl overflow-hidden bg-card/70 backdrop-blur-xl"}>
        <div
    ref={lineNumbersRef}
    aria-hidden="true"
    className={integrated ? "obf-line-numbers" : "h-full flex-shrink-0 overflow-hidden select-none py-5 pl-3 pr-2 text-right border-r border-border/30"}
    style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", lineHeight: "1.7" }}
  >
          {Array.from({ length: lineCount }, (_, i) => <div key={i} className="px-1 text-muted-foreground/40">
              {i + 1}
            </div>)}
        </div>

        <textarea
    aria-label="Source code"
    aria-describedby="obf-input-error"
    ref={textareaRef}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onScroll={handleScroll}
    placeholder={placeholder}
    readOnly={readOnly}
    wrap="off"
    spellCheck={false}
    className="h-full min-h-0 min-w-0 flex-1 overflow-auto whitespace-pre p-5 bg-transparent text-foreground font-mono text-sm resize-none outline-none focus:ring-0"
    style={{ fontFamily: "var(--font-mono)", lineHeight: "1.7" }}
  />
      </div>
    </div>;
};
var CodeEditor_default = CodeEditor;
export {
  CodeEditor_default as default
};
