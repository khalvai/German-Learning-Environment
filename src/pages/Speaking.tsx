import BackLink from "../components/BackLink";

export default function Speaking() {
  return (
    <main className="min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-app-border px-6">
        <BackLink to="/" label="Back home" />
        <h1 className="text-2xl font-bold">Speaking</h1>
      </header>
      <p className="p-6 text-slate-400">Coming soon.</p>
    </main>
  );
}
