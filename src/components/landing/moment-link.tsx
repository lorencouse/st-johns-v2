import { momentUrl } from "@/app/landing-service";

/** A link into the demonstration service at `time`, opening YouTube in a new tab. */
export function MomentLink({
  time,
  className,
  children,
}: {
  time: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={momentUrl(time)} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
