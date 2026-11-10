const TONES = {
  muted: "text-zinc-500 dark:text-zinc-400",
  accent: "text-blue-600 dark:text-blue-400",
};

/** The small heading above a panel or a group of controls. */
export function SectionLabel({
  children,
  tone = "muted",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <h3 className={`text-xs font-semibold uppercase ${TONES[tone]} ${className}`.trim()}>
      {children}
    </h3>
  );
}
