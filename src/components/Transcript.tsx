import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import type { TranscriptSegment } from "../desktop";

/** Strips surrounding punctuation so „Haus," looks up as "Haus". */
function cleanWord(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export default function Transcript({
  segments,
  currentTime,
  generating,
  error,
  onGenerate,
  onSeek,
  onSelectWord,
}: {
  segments: TranscriptSegment[];
  currentTime: number;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onSeek: (seconds: number) => void;
  onSelectWord: (word: string, sentence: string) => void;
}) {
  const [hidden, setHidden] = useState(false);
  const activeRef = useRef<HTMLParagraphElement>(null);

  const activeIndex = useMemo(() => {
    let found = -1;
    for (let i = 0; i < segments.length; i += 1) {
      if (segments[i].start <= currentTime + 0.15) found = i;
      else break;
    }
    return found;
  }, [segments, currentTime]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-app-border p-6 text-center">
        <p className="mb-4 text-sm text-slate-400">
          No transcript yet. Generate one with AI to read along and look up words.
        </p>
        {error && (
          <p
            className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Transcribing… this can take a minute" : "Generate transcript"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-app-border">
      <div className="flex items-center justify-between border-b border-app-border px-4 py-2">
        <h2 className="text-sm font-medium text-zinc-300">Transcript</h2>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 transition hover:text-white disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Regenerate
          </button>
          <button
            type="button"
            onClick={() => setHidden((value) => !value)}
            className="inline-flex items-center gap-1.5 transition hover:text-white"
          >
            {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {hidden ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {error && (
        <p
          className="m-3 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}

      {hidden ? (
        <p className="p-6 text-center text-sm text-slate-500">Transcript hidden — listen first, then reveal it.</p>
      ) : (
        <div className="max-h-[420px] space-y-1 overflow-y-auto p-3">
          {segments.map((segment, index) => {
            const active = index === activeIndex;
            return (
              <p
                key={`${segment.start}-${index}`}
                ref={active ? activeRef : undefined}
                className={`rounded-md px-3 py-2 leading-relaxed transition-colors ${
                  active ? "bg-indigo-500/15 text-white" : "text-gray-400"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSeek(segment.start)}
                  aria-label={`Play from ${Math.floor(segment.start)} seconds`}
                  className="mr-2 font-mono text-xs tabular-nums text-gray-500 hover:text-indigo-300"
                >
                  {Math.floor(segment.start / 60)}:
                  {Math.floor(segment.start % 60)
                    .toString()
                    .padStart(2, "0")}
                </button>
                {segment.text.split(/\s+/).map((token, tokenIndex) => (
                  <span key={tokenIndex}>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        const word = cleanWord(token);
                        if (word) onSelectWord(word, segment.text);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        const word = cleanWord(token);
                        if (word) onSelectWord(word, segment.text);
                      }}
                      className="cursor-pointer rounded hover:bg-indigo-400/20 hover:text-white"
                    >
                      {token}
                    </span>{" "}
                  </span>
                ))}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
