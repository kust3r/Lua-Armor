import { useEffect, useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./level-slider.css";
const THUMB_SPARKS = [[58, 0], [50, 29], [30, 54], [-5, 56], [-40, 50], [-56, 21], [-61, -10], [-43, -38], [-18, -61], [19, -56], [46, -43], [56, -11]];
const STARS = [
  [5.5, 48, 1.5, 0.55, 8.4, -2.1],
  [8.2, 54, 2, 0.7, 10.2, -6.3],
  [14.4, 39, 2.8, 0.8, 7.5, -3.9],
  [19, 66, 1.5, 0.45, 11.4, -0.6],
  [28.8, 25, 1.8, 0.7, 9.3, -8.1],
  [40.6, 36, 2.5, 0.85, 8.1, -2.7],
  [47.5, 31, 2.4, 0.65, 10.8, -5.4],
  [47.9, 59, 1.7, 0.5, 6.9, -1.2],
  [55.4, 49, 1.8, 0.6, 11.7, -6.9],
  [60.2, 70, 1.6, 0.45, 9.6, -3.3],
  [72.7, 40, 3.2, 0.8, 8.7, -5.1],
  [81.4, 61, 1.5, 0.4, 11.1, -1.8],
  [87.6, 76, 2, 0.55, 7.8, -6],
  [93, 34, 1.5, 0.5, 9.9, -4.2]
];
const DEFAULT_DESCRIPTIONS = ["Prote\xE7\xE3o leve", "Prote\xE7\xE3o equilibrada", "Prote\xE7\xE3o m\xE1xima"];
const LEVEL_MARKS = [1, 2, 3];
function snapLevel(position) {
  const rounded = Math.round(position);
  return rounded <= 1 ? 1 : rounded >= 3 ? 3 : 2;
}
function LevelSlider({ value, onChange, levels, defaultValue = 2, disabled }) {
  const titleId = useId();
  const descriptionId = useId();
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const previousLevel = useRef(value);
  const lastRequestedLevel = useRef(value);
  const [burst, setBurst] = useState(0);
  const [emitting, setEmitting] = useState(false);
  useEffect(() => {
    lastRequestedLevel.current = value;
  }, [value]);
  function changeLevel(next) {
    if (disabled || next === lastRequestedLevel.current) return;
    lastRequestedLevel.current = next;
    onChange(next);
    try {
      navigator.vibrate?.(8);
    } catch {
    }
  }
  useEffect(() => {
    if (previousLevel.current !== 3 && value === 3 && open) {
      setBurst((count) => count + 1);
      setEmitting(true);
    } else if (value !== 3 || !open) {
      setEmitting(false);
    }
    previousLevel.current = value;
  }, [value, open]);
  useEffect(() => {
    if (!emitting) return;
    const timeout = window.setTimeout(() => setEmitting(false), 560);
    return () => window.clearTimeout(timeout);
  }, [emitting, burst]);
  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open]);
  const selected = levels[value - 1];
  const description = selected.description ?? DEFAULT_DESCRIPTIONS[value - 1];
  return <Popover.Root onOpenChange={(next) => {
    setOpen(next);
    setPosition(null);
    setDragging(false);
  }}>
    <Popover.Trigger asChild>
      <Button
    type="button"
    variant="secondary"
    className="obf-level-trigger"
    disabled={disabled}
    aria-label={`Intensidade de ofuscamento: ${value}`}
    title={`Intensidade de ofuscamento: ${value}`}
  >
        <span>{selected.label}</span><ChevronDown aria-hidden="true" />
      </Button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
    className="level-popover"
    side="top"
    align="end"
    sideOffset={8}
    collisionPadding={16}
    aria-labelledby={titleId}
    data-level={value}
  >
        <div className="level-slider-heading">
          <div className="level-slider-heading-text">
            <h2 className="level-slider-title" id={titleId}>{selected.label}</h2>
            <p className="level-slider-description" id={descriptionId}>{description}</p>
          </div>
          <Button
    type="button"
    variant="ghost"
    size="icon"
    className="level-slider-reset"
    aria-label="Restaurar nível padrão"
    title="Restaurar nível padrão (Level 2)"
    disabled={disabled}
    onClick={() => {
      setPosition(null);
      setDragging(false);
      changeLevel(defaultValue);
    }}
  >
            <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </div>
        <Slider.Root
    className="level-slider"
    data-dragging={dragging}
    data-ready={ready}
    style={{ "--level-progress": ((position ?? value) - 1) / 2 }}
    value={[position ?? value]}
    min={1}
    max={3}
    step={1e-3}
    disabled={disabled}
    onPointerDownCapture={() => {
      if (!disabled) setDragging(true);
    }}
    onPointerUpCapture={() => {
      setDragging(false);
      setPosition(null);
    }}
    onPointerCancel={() => {
      setDragging(false);
      setPosition(null);
    }}
    onKeyDownCapture={(event) => {
      if (disabled) return;
      const next = event.key === "Home" ? 1 : event.key === "End" ? 3 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? snapLevel(value - 1) : event.key === "ArrowRight" || event.key === "ArrowUp" ? snapLevel(value + 1) : null;
      if (next === null) return;
      event.preventDefault();
      setPosition(null);
      changeLevel(next);
    }}
    onValueChange={(values) => {
      const next = values[0];
      if (next === void 0) return;
      setPosition(next);
      changeLevel(snapLevel(next));
    }}
    onValueCommit={(values) => {
      const next = values[0];
      setPosition(null);
      setDragging(false);
      if (next !== void 0) changeLevel(snapLevel(next));
    }}
  >
          <Slider.Track className="level-slider-track">
            <Slider.Range className="level-slider-range">
              <span className="level-nebula" aria-hidden="true" />
              <span className="level-starfield" aria-hidden="true">
                {STARS.map(([x, y, size, opacity, duration, delay], i) => <i
    className="level-particle"
    data-glow={i === 2 || i === 5 || i === 10}
    key={i}
    style={{ "--px": `${x}%`, "--py": `${y}%`, "--star-size": `${size}px`, "--star-opacity": opacity, "--star-duration": `${duration}s`, "--star-delay": `${delay}s` }}
  />)}
              </span>
          </Slider.Range>
            <span className="level-slider-marks" aria-hidden="true">
              {LEVEL_MARKS.map((mark) => <i key={mark} />)}
            </span>
          </Slider.Track>
          <Slider.Thumb
    className="level-slider-thumb"
    aria-label="Intensidade de ofuscamento"
    aria-valuetext={selected.label}
    aria-describedby={descriptionId}
  >
            <span className="level-thumb-sparks" key={burst} data-emitting={emitting} aria-hidden="true">
              {THUMB_SPARKS.map(([x, y], i) => <i key={i} style={{ "--sx": `${x}px`, "--sy": `${y}px` }} />)}
            </span>
          </Slider.Thumb>
        </Slider.Root>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
export {
  LevelSlider as default,
  snapLevel
};
