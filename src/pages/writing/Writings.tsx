import { useEffect, useState } from "react";
import {
  getWritings,
  removeWriting,
  getRecentMistakes,
  type Writing,
  type RecentMistake,
} from "../../desktop";
import { Link, useNavigate } from "react-router-dom";
import { Trash } from "lucide-react";
import ContentLibrary from "../../components/ContentLibrary";

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

const MAX_RECENT_MISTAKES_IN_SUMMARY = 4;

function RecentMistakeCard({ mistake }: { mistake: RecentMistake }) {
  return (
    <Link
      to={`/writings/mistakes/${mistake.categorySlug}`}
      className="block rounded-lg border border-app-border bg-[rgb(57,57,58)] p-4 transition hover:bg-[rgb(73,73,74)]"
    >
      <h3 className="mb-2 text-sm font-medium">{mistake.categoryTitle}</h3>
      <p className="text-xs leading-5">
        <span className="text-red-300 line-through">{mistake.original}</span>
        {mistake.fix && (
          <span className="ml-1.5 text-emerald-300">{mistake.fix}</span>
        )}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        {mistake.explanation}
      </p>
    </Link>
  );
}

function RecentMistakesSection({ mistakes }: { mistakes: RecentMistake[] }) {
  return (
    <div className="mb-8 rounded-xl border border-app-border bg-white/5 p-6">
      <h2 className="mb-4 text-lg font-semibold">Recent Mistakes</h2>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {mistakes
          .slice(0, MAX_RECENT_MISTAKES_IN_SUMMARY)
          .map((mistake, index) => (
            <RecentMistakeCard key={index} mistake={mistake} />
          ))}
      </div>
    </div>
  );
}

export default function Writings() {
  const [writings, setWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentMistakes, setRecentMistakes] = useState<RecentMistake[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getWritings()
      .then(setWritings)
      .catch(() => setError("Could not load your writings."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getRecentMistakes()
      .then(setRecentMistakes)
      .catch(() => {
        // Recent mistakes are a bonus insight, not critical — fail quietly.
      });
  }, []);

  return (
    <ContentLibrary
      title="My Writings"
      itemLabel="writing"
      loading={loading}
      error={error}
      onCreate={() => navigate("/writings/topics")}
      beforeContent={
        recentMistakes.length > 0 ? (
          <RecentMistakesSection mistakes={recentMistakes} />
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
              setWritings((prev) =>
                prev.filter((item) => item.id !== writing.id),
              );
            } catch {
              setError(`Could not delete “${writing.title}”.`);
            }
          }}
        />
      ))}
    </ContentLibrary>
  );
}
