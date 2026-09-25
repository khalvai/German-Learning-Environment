import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  getListening,
  getListeningAudio,
  updateListeningPosition,
  type Listening,
} from "../desktop";
import WaveformPlayer from "../components/WaveformPlayer";

export default function ListeningDetail() {
  const { id } = useParams();

  const [listening, setListening] = useState<Listening | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const record = await getListening(id);
        if (cancelled) return;
        if (!record) {
          setNotFound(true);
          return;
        }
        setListening(record);
        const audio = await getListeningAudio(id);
        if (!cancelled) setAudioBase64(audio);
      } catch {
        if (!cancelled) setError("Could not load this audio.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="flex h-screen items-center justify-center text-white">Audio not found</div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="flex h-16 items-center gap-4 border-b border-app-border px-6">
        <Link to="/listening" aria-label="Back to listening" className="text-gray-400 transition hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="truncate text-2xl font-bold">{listening?.title ?? "Loading…"}</h1>
      </nav>

      <div className="mx-auto max-w-4xl space-y-4 p-6">
        {error && (
          <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        {listening && <p className="text-sm text-gray-500">{listening.fileName}</p>}

        {audioBase64 && listening ? (
          <WaveformPlayer
            audioBase64={audioBase64}
            fileName={listening.fileName}
            initialPosition={listening.positionSeconds}
            onPositionCommit={(seconds) => {
              updateListeningPosition(listening.id, seconds).catch(() => {});
            }}
          />
        ) : (
          !error && <p className="p-4 text-slate-400">Loading audio…</p>
        )}
      </div>
    </div>
  );
}
