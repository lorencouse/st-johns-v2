"use client";

import { useEffect, useRef } from "react";

/**
 * A textarea that grows to fit its content, so the intro and summary read as
 * finished prose in the studio rather than as a scrolling form field.
 */
export function AutoTextarea({
  value,
  onChange,
  readOnly,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={`w-full resize-none bg-transparent text-sm leading-relaxed outline-none read-only:cursor-default ${className}`}
    />
  );
}
