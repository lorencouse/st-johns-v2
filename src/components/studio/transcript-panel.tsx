"use client";

interface Segment {
  seq: number;
  startMs: number;
  endMs: number;
  text: string;
}

interface TranscriptPanelProps {
  segments: Segment[];
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptPanel({ segments }: TranscriptPanelProps) {
  if (segments.length === 0) {
    return (
      <p className="text-sm text-zinc-400">No transcript segments available.</p>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((seg) => (
        <div key={seg.seq} className="group">
          <span className="text-xs font-mono text-zinc-400">
            {formatMs(seg.startMs)}
          </span>
          <p className="mt-0.5 text-sm leading-relaxed">{seg.text}</p>
        </div>
      ))}
    </div>
  );
}
