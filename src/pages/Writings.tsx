import { useCallback, useEffect, useState } from "react";
import {
  getWritings,
  removeWriting,
  getCommonMistakes,
  analyzeCommonMistakes,
  type Writing,
  type CommonMistake,
} from "../desktop";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw, Trash } from "lucide-react";
import ContentLibrary from "../components/ContentLibrary";

function WritingCard({
  writing,
  onRemove,
}: {
  writing: Writing;
  onRemove: () => Promise<void>;
}) {
  return (
    <div className="group flex flex-col items-center p-4 h-[260px] w-[195px] border app-card rounded-lg relative">
      <button
        onClick={async (e) => {
          e.preventDefault(); // prevent Link navigation
          e.stopPropagation();
          await onRemove();
        }}
        aria-label={`Delete ${writing.title}`}
        className="absolute top-3 right-3 invisible group-hover:visible text-gray-500 hover:text-red-500 transition"
      >
        <Trash className="w-4 h-4" />
      </button>

      <Link
        to={`/writings/${writing.id}`}
        className="flex flex-col w-full h-full"
      >
        <h2 className="text-base font-medium mb-2 line-clamp-2">
          {writing.title}
        </h2>

        <pre className="text-sm text-gray-400 whitespace-pre-wrap py-2 flex-1 overflow-hidden ">
          {writing.content}
        </pre>

        <p className="text-gray-500 text-xs pt-2">
          {writing.createdAt.toLocaleString()}
        </p>
      </Link>
    </div>
  );
}

function CommonMistakesSection({
  mistakes,
  loading,
  error,
  onRefresh,
}: {
  mistakes: CommonMistake[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-8 rounded-xl border border-app-border bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Most Common Mistakes</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh most common mistakes"
          className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : loading && !mistakes ? (
        <p className="text-sm text-slate-400">Looking for patterns across your writings…</p>
      ) : mistakes && mistakes.length === 0 ? (
        <p className="text-sm text-slate-400">No recurring mistakes found yet — nice work.</p>
      ) : mistakes ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {mistakes.map((mistake, index) => (
            <div
              key={index}
              className="rounded-lg border border-app-border bg-[rgb(57,57,58)] p-4"
            >
              <h3 className="mb-1.5 text-sm font-medium">{mistake.title}</h3>
              <p className="text-xs leading-5 text-slate-400">{mistake.description}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Writings() {
  const [writings, setWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commonMistakes, setCommonMistakes] = useState<CommonMistake[] | null>(null);
  const [mistakesLoading, setMistakesLoading] = useState(false);
  const [mistakesError, setMistakesError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getWritings()
      .then(setWritings)
      .catch(() => setError("Could not load your writings."))
      .finally(() => setLoading(false));
  }, []);

  const hasAnalyzedWriting = writings.some((writing) => writing.aiCritics);

  const runCommonMistakesAnalysis = useCallback(async () => {
    setMistakesLoading(true);
    setMistakesError(null);
    try {
      const result = await analyzeCommonMistakes();
      setCommonMistakes(result.mistakes);
    } catch (error) {
      setMistakesError(
        typeof error === "string" ? error : "Could not analyze your writings for common mistakes.",
      );
    } finally {
      setMistakesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading || !hasAnalyzedWriting) return;
    let cancelled = false;
    getCommonMistakes()
      .then((cached) => {
        if (cancelled) return;
        if (cached) setCommonMistakes(cached.mistakes);
        else runCommonMistakesAnalysis();
      })
      .catch(() => {
        if (!cancelled) runCommonMistakesAnalysis();
      });
    return () => {
      cancelled = true;
    };
  }, [loading, hasAnalyzedWriting, runCommonMistakesAnalysis]);

  return (
    <ContentLibrary
      title="My Writings"
      itemLabel="writing"
      loading={loading}
      error={error}
      onCreate={() => navigate("/writings/new")}
      beforeContent={
        hasAnalyzedWriting ? (
          <CommonMistakesSection
            mistakes={commonMistakes}
            loading={mistakesLoading}
            error={mistakesError}
            onRefresh={runCommonMistakesAnalysis}
          />
        ) : undefined
      }
    >
      {writings.map((writing) => (
            <WritingCard
              key={writing.id}
              writing={writing}
              onRemove={async () => {
                try {
                  await removeWriting(writing.id);
                  setWritings((prev) => prev.filter((item) => item.id !== writing.id));
                } catch {
                  setError(`Could not delete “${writing.title}”.`);
                }
              }}
            />
      ))}
    </ContentLibrary>
  );
}
