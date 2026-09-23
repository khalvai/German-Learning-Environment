import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell, Sparkles } from "lucide-react";
import { getCommonMistakes, type CommonMistake } from "../desktop";

export default function Grammar() {
  const [mistakes, setMistakes] = useState<CommonMistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getCommonMistakes()
      .then(setMistakes)
      .catch(() => setError("Could not load your mistakes."))
      .finally(() => setLoading(false));
  }, []);

  const dueMistakes = mistakes.filter((mistake) => mistake.dueCount > 0);

  return (
    <main className="min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-app-border px-6">
        <Link to="/" aria-label="Back home" className="text-slate-400 transition hover:text-slate-200">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Grammar</h1>
      </header>

      <section className="p-6">
        {error && (
          <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="p-4 text-slate-400">Loading your mistakes…</p>
        ) : mistakes.length === 0 ? (
          <p className="p-4 text-slate-400">
            No mistakes tracked yet.{" "}
            <Link to="/writings" className="underline underline-offset-2 hover:text-slate-200">
              Analyze a few writings
            </Link>{" "}
            first, then come back here to drill them.
          </p>
        ) : dueMistakes.length === 0 ? (
          <p className="p-4 text-slate-400">
            You're all caught up — nothing is due for practice right now. Rated mistakes come back around later; check back then.
          </p>
        ) : (
          <>
            <button
              onClick={() => navigate("/grammar/practice")}
              className="app-card mb-6 flex w-full max-w-2xl items-center gap-3 text-left"
            >
              <Sparkles className="h-6 w-6 shrink-0 text-indigo-400" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Practice my weak spots</h2>
                <p className="text-sm text-slate-400">A mixed set built from what's due right now.</p>
              </div>
            </button>

            <h2 className="mb-3 text-sm font-medium text-slate-400">Or drill one category</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              {dueMistakes.map((mistake) => (
                <button
                  key={mistake.slug}
                  onClick={() => navigate(`/grammar/practice?category=${mistake.slug}`)}
                  className="block rounded-lg border border-app-border bg-[rgb(57,57,58)] p-4 text-left transition hover:bg-[rgb(73,73,74)]"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">{mistake.title}</h3>
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                      {mistake.dueCount} due
                    </span>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Dumbbell className="h-3 w-3" aria-hidden="true" /> Practice this
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
