import { useEffect, useState } from "react";
import { KeyRound, LoaderCircle, RotateCw, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

const KEY_CHECK_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Secure storage did not respond in time.")),
        KEY_CHECK_TIMEOUT_MS,
      );
    }),
  ]);
}

function KeyGate({
  title,
  hint,
  placeholder,
  hasCommand,
  saveCommand,
  removeCommand,
}: {
  title: string;
  hint: string;
  placeholder: string;
  hasCommand: string;
  saveCommand: string;
  removeCommand: string;
}) {
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void checkKey();
  }, []);

  async function checkKey() {
    setLoading(true);
    setError(null);
    try {
      setHasKey(await withTimeout(invoke<boolean>(hasCommand)));
    } catch {
      setError("Could not access secure storage. Try again after restarting the app.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const apiKey = inputValue.trim();
    if (!apiKey) {
      setError("API key cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await invoke(saveCommand, { apiKey });
      setInputValue("");
      setHasKey(true);
    } catch {
      setError("Failed to save API key.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      await invoke(removeCommand);
      setHasKey(false);
    } catch {
      setError("Failed to remove API key.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app-card flex h-40 w-64 flex-col items-center justify-center gap-3 rounded-xl text-sm text-slate-300">
        <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
        Checking {title}…
      </div>
    );
  }

  if (!hasKey) {
    return (
      <section className="app-card flex h-40 w-64 flex-col rounded-xl p-5" aria-labelledby={`${saveCommand}-title`}>
        <div className="mb-2 flex items-center gap-2">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
          <h3 id={`${saveCommand}-title`} className="font-semibold">{title}</h3>
        </div>
        <p className="mb-3 text-xs text-slate-300">{hint}</p>
        <input
          aria-label={title}
          type="password"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={placeholder}
          disabled={saving}
          className="mb-2 rounded-md border border-app-border bg-black/10 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
        />
        <button onClick={() => void handleSave()} disabled={saving} className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50">
          {saving ? "Saving…" : "Save key"}
        </button>
        {error && <p className="mt-2 text-xs text-red-300" role="alert">{error}</p>}
        {error && <button onClick={() => void checkKey()} className="mt-1 inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"><RotateCw className="h-3 w-3" />Retry</button>}
      </section>
    );
  }

  return (
    <section className="app-card flex h-40 w-64 flex-col items-center justify-center gap-3 rounded-xl p-5">
      <KeyRound className="h-7 w-7 text-emerald-400" aria-hidden="true" />
      <p className="text-sm font-medium">{title} configured</p>
      <button onClick={() => void handleRemove()} disabled={saving} className="inline-flex items-center gap-1 text-sm text-slate-300 transition hover:text-red-300 disabled:opacity-50">
        <Trash2 className="h-4 w-4" /> Remove key
      </button>
      {error && <p className="text-xs text-red-300" role="alert">{error}</p>}
    </section>
  );
}

export function ApiKeyGate() {
  return (
    <KeyGate
      title="AI API key"
      hint="Stored securely on this device."
      placeholder="sk-or-v1-..."
      hasCommand="has_api_key"
      saveCommand="save_api_key"
      removeCommand="remove_api_key"
    />
  );
}

export function GatewayKeyGate() {
  return (
    <KeyGate
      title="AI Gateway key"
      hint="Vercel AI Gateway API key, used to auto-grade grammar practice with Jev. Stored securely on this device."
      placeholder="AI Gateway API key..."
      hasCommand="has_gateway_key"
      saveCommand="save_gateway_key"
      removeCommand="remove_gateway_key"
    />
  );
}
