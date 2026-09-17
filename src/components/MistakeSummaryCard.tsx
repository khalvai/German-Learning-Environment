import { Link } from "react-router-dom";
import type { CommonMistake } from "../desktop";

export default function MistakeSummaryCard({ mistake }: { mistake: CommonMistake }) {
  const preview = mistake.examples[0];
  return (
    <Link
      to={`/writings/mistakes/${mistake.slug}`}
      className="block rounded-lg border border-app-border bg-[rgb(57,57,58)] p-4 transition hover:bg-[rgb(73,73,74)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{mistake.title}</h3>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
          {mistake.count}×
        </span>
      </div>

      {preview && (
        <p className="text-xs leading-5">
          <span className="text-red-300 line-through">{preview.original}</span>
          {preview.fix && <span className="ml-1.5 text-emerald-300">{preview.fix}</span>}
        </p>
      )}
    </Link>
  );
}
