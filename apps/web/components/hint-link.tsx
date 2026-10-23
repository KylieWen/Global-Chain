"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

/** Delayed explanation with keyboard/Escape support and a separate touch target. */
export function HintLink({ href, label, explanation, className }: { href: string; label: string; explanation: string; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissed = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") { clear(); setOpen(false); dismissed.current = true; }
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [open]);
  return <span className="action-hint" onPointerEnter={event => {
    if (event.pointerType !== "mouse" || dismissed.current) return;
    clear(); timer.current = setTimeout(() => setOpen(true), 600);
  }} onPointerLeave={event => { clear(); dismissed.current = false; if (!event.currentTarget.contains(document.activeElement)) setOpen(false); }} onFocusCapture={event => {
    if (event.target instanceof HTMLAnchorElement && event.target.matches(":focus-visible")) setOpen(true);
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { clear(); setOpen(false); dismissed.current = false; } }} onKeyDown={event => {
    if (event.key === "Escape") { clear(); setOpen(false); dismissed.current = true; event.stopPropagation(); }
  }}>
    <Link className={className} href={href} aria-describedby={open ? id : undefined}>{label}</Link>
    <button type="button" className="hint-toggle" aria-label={`了解“${label.replace(/ →$/, "")}”的作用`} aria-expanded={open} aria-controls={open ? id : undefined} aria-describedby={open ? id : undefined} onClick={() => { clear(); setOpen(value => !value); }}>?</button>
    {open && <span id={id} role="tooltip" className="action-hint-content">{explanation}</span>}
  </span>;
}
