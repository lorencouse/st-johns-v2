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
  fieldId,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  /** Lets other parts of the page find and focus this field. */
  fieldId?: string;
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
      data-post-field={fieldId}
      className={`w-full resize-none bg-transparent text-sm leading-relaxed outline-none read-only:cursor-default rounded-sm focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`}
    />
  );
}
