import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  errorMessage,
  getListening,
  getListeningAudio,
  transcribeListening,
  updateListeningPosition,
  type Listening,
  type TranscriptSegment,
} from "../desktop";
import WaveformPlayer, { type WaveformPlayerHandle } from "../components/WaveformPlayer";
import Transcript from "../components/Transcript";
import GermanWordLookup from "../components/GermanWordLookup";

export default function ListeningDetail() {
  const { id } = useParams();

  const [listening, setListening] = useState<Listening | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [lookup, setLookup] = useState<{ word: string; sentence: string } | null>(null);
  const playerRef = useRef<WaveformPlayerHandle>(null);

  const handleTranscribe = useCallback(async () => {
    if (!id) return;
    setTranscribing(true);
    setTranscriptError(null);
    try {
      setTranscript(await transcribeListening(id));
    } catch (e) {
      setTranscriptError(errorMessage(e, "Transcription failed."));
    } finally {
      setTranscribing(false);
    }
  }, [id]);

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
        setTranscript(record.transcript);
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
    return <div className="flex h-screen items-center justify-center text-white">Audio not found</div>;
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
            handleRef={playerRef}
            onTimeChange={setCurrentTime}
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

        {listening && audioBase64 && (
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Transcript
              segments={transcript}
              currentTime={currentTime}
              generating={transcribing}
              error={transcriptError}
              onGenerate={handleTranscribe}
              onSeek={(seconds) => playerRef.current?.seekTo(seconds, true)}
              onSelectWord={(word, sentence) => setLookup({ word, sentence })}
            />
            {lookup && (
              <aside className="rounded-xl border border-app-border p-4">
                <GermanWordLookup
                  selectedWord={lookup.word}
                  contextSentence={lookup.sentence}
                  onClose={() => setLookup(null)}
                />
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
