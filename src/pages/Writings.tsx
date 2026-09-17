import { useCallback, useEffect, useState } from "react";
import {
  getWritings,
  removeWriting,
  getCommonMistakes,
  type Writing,
  type CommonMistake,
} from "../desktop";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw, Trash } from "lucide-react";
import ContentLibrary from "../components/ContentLibrary";
import MistakeSummaryCard from "../components/MistakeSummaryCard";

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

const MAX_CATEGORIES_IN_SUMMARY = 4;

function CommonMistakesSection({
  mistakes,
  refreshing,
  onRefresh,
}: {
  mistakes: CommonMistake[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-8 rounded-xl border border-app-border bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Most Common Mistakes</h2>
        <div className="flex items-center gap-4">
          <Link
            to="/writings/mistakes"
            className="text-xs text-slate-400 transition hover:text-slate-200"
          >
            Review all mistakes →
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh most common mistakes"
            className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {mistakes.slice(0, MAX_CATEGORIES_IN_SUMMARY).map((mistake) => (
          <MistakeSummaryCard key={mistake.slug} mistake={mistake} />
        ))}
      </div>
    </div>
  );
}

export default function Writings() {
  const [writings, setWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commonMistakes, setCommonMistakes] = useState<CommonMistake[]>([]);
  const [mistakesLoading, setMistakesLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getWritings()
      .then(setWritings)
      .catch(() => setError("Could not load your writings."))
      .finally(() => setLoading(false));
  }, []);

  const loadCommonMistakes = useCallback(async () => {
    setMistakesLoading(true);
    try {
      setCommonMistakes(await getCommonMistakes());
    } catch {
      // Common mistakes are a bonus insight, not critical — fail quietly and keep the last known list.
    } finally {
      setMistakesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommonMistakes();
  }, [loadCommonMistakes]);

  return (
    <ContentLibrary
      title="My Writings"
      itemLabel="writing"
      loading={loading}
      error={error}
      onCreate={() => navigate("/writings/new")}
      beforeContent={
        commonMistakes.length > 0 ? (
          <CommonMistakesSection
            mistakes={commonMistakes}
            refreshing={mistakesLoading}
            onRefresh={loadCommonMistakes}
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
