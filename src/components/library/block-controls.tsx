import { ArrowUpToLine, ArrowDownToLine, X, Plus } from "lucide-react";
import { formatTimestampMs } from "@/lib/format";

interface BlockControlsProps {
  startMs: number;
  onDelete: () => void;
  onMarkStart: () => void;
  onMarkEnd: () => void;
  onInsertBelow: () => void;
}

// A compact column beside the block on fine pointers. On touch layouts the
// controls sit in a row above the text, so each can be a full 44px target
// without its hit box reaching over a neighbour.
const buttonClass =
  "rounded p-0.5 text-zinc-500 dark:text-zinc-400 pointer-coarse:flex pointer-coarse:size-11 pointer-coarse:items-center pointer-coarse:justify-center";

export function BlockControls({
  startMs,
  onDelete,
  onMarkStart,
  onMarkEnd,
  onInsertBelow,
}: BlockControlsProps) {
  return (
    <div className="flex flex-col items-center justify-between pt-0.5 pb-0.5 shrink-0 w-7 pointer-coarse:w-auto pointer-coarse:flex-row pointer-coarse:justify-start pointer-coarse:gap-0.5">
      <div className="flex flex-col items-center gap-0.5 pointer-coarse:flex-row">
        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums pointer-coarse:text-xs">
          {formatTimestampMs(startMs)}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className={`${buttonClass} hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30`}
          title="Delete this paragraph"
          aria-label="Delete this paragraph"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col items-center gap-0.5 pointer-coarse:flex-row">
        <button
          type="button"
          onClick={onMarkStart}
          className={`${buttonClass} hover:bg-emerald-50 hover:text-emerald-500 dark:hover:bg-emerald-950/30`}
          title="Start the post here"
          aria-label="Start the post here"
        >
          <ArrowUpToLine className="h-3 w-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onMarkEnd}
          className={`${buttonClass} hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30`}
          title="End the post here"
          aria-label="End the post here"
        >
          <ArrowDownToLine className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={onInsertBelow}
        className={`${buttonClass} hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800`}
        title="Add a paragraph below"
          aria-label="Add a paragraph below"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
