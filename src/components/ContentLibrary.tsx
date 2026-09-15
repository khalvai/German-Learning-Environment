import type { ReactNode } from "react";
import { Plus } from "lucide-react";

type ContentLibraryProps = {
  title: string;
  itemLabel: string;
  loading?: boolean;
  error?: string | null;
  onCreate: () => void;
  children: ReactNode;
};

/** Shared collection layout for saved learning material. */
export default function ContentLibrary({
  title,
  itemLabel,
  loading = false,
  error,
  onCreate,
  children,
}: ContentLibraryProps) {
  return (
    <main className="min-h-screen">
      <header className="flex h-16 items-center border-b border-app-border px-6">
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>

      <section className="p-6" aria-label={title}>
        {error && (
          <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="p-4 text-slate-400">Loading {itemLabel}s…</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,195px)] justify-center gap-4">
            <button
              type="button"
              onClick={onCreate}
              aria-label={`Create new ${itemLabel}`}
              className="app-card flex h-[260px] w-[195px] flex-col items-center justify-center rounded-lg p-4"
            >
              <Plus className="h-12 w-12" aria-hidden="true" />
              <span className="mt-3 text-sm font-medium">New {itemLabel}</span>
            </button>
            {children}
          </div>
        )}
      </section>
    </main>
  );
}
