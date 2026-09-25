import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  webm: "audio/webm",
};

function mimeFor(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "audio/mpeg";
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Analyzes the clip at a fixed high resolution (independent of how many bars
 * end up on screen), so the drawing code can resample down to whatever bar
 * count fits the current width without re-reading the audio.
 */
function computePeaks(buffer: AudioBuffer, buckets: number): number[] {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / buckets));
  const peaks = new Array<number>(buckets).fill(0);
  for (let i = 0; i < buckets; i += 1) {
    const start = i * blockSize;
    let peak = 0;
    for (let j = 0; j < blockSize; j += 1) {
      const value = Math.abs(channel[start + j] ?? 0);
      if (value > peak) peak = value;
    }
    peaks[i] = peak;
  }
  // Normalize against a high percentile so one transient doesn't flatten the rest.
  const sorted = [...peaks].sort((a, b) => a - b);
  const reference = sorted[Math.floor(sorted.length * 0.95)] || Math.max(...peaks, 0.0001);
  return peaks.map((peak) => Math.min(1, peak / reference));
}

/** Downsamples `source` to `target` bars, keeping the loudest peak per group. */
function resample(source: number[], target: number): number[] {
  if (target <= 0) return [];
  if (target >= source.length) return source.slice();
  const out = new Array<number>(target).fill(0);
  const ratio = source.length / target;
  for (let i = 0; i < target; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let peak = 0;
    for (let j = start; j < end && j < source.length; j += 1) if (source[j] > peak) peak = source[j];
    out[i] = peak;
  }
  return out;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

const SOURCE_BUCKETS = 2400;
const BAR_SLOT = 6; // px per bar including the gap — controls density
const BAR_WIDTH = 3; // px of the drawn bar itself
const PLAYED_COLOR = "#818cf8"; // indigo-400
const UNPLAYED_COLOR = "rgb(150, 150, 154)";
const PLAYHEAD_COLOR = "#e0e7ff"; // indigo-100
const TICK_INTERVALS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

type Hover = { x: number; time: number };

export default function WaveformPlayer({
  audioBase64,
  fileName,
  initialPosition = 0,
  onPositionCommit,
  height = 160,
}: {
  audioBase64: string;
  fileName: string;
  initialPosition?: number;
  onPositionCommit?: (positionSeconds: number) => void;
  /** Waveform height in CSS pixels (full peak-to-trough span). */
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peaksRef = useRef<number[]>([]);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(initialPosition);
  const [hover, setHover] = useState<Hover | null>(null);

  const latestPosition = useRef(initialPosition);
  const commit = useRef(onPositionCommit);
  commit.current = onPositionCommit;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (canvas.width !== Math.round(cssWidth * ratio) || canvas.height !== Math.round(cssHeight * ratio)) {
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    const source = peaksRef.current;
    if (source.length === 0) return;

    const barCount = Math.max(1, Math.floor(cssWidth / BAR_SLOT));
    const bars = resample(source, barCount);
    const middle = cssHeight / 2;
    const progress = duration > 0 ? currentTime / duration : 0;
    const playheadPx = progress * cssWidth;

    for (let i = 0; i < bars.length; i += 1) {
      const barHeight = Math.max(3, bars[i] * (cssHeight - 4));
      const x = i * BAR_SLOT + (BAR_SLOT - BAR_WIDTH) / 2;
      context.fillStyle = x < playheadPx ? PLAYED_COLOR : UNPLAYED_COLOR;
      context.fillRect(x, middle - barHeight / 2, BAR_WIDTH, barHeight);
    }

    // Hover cursor — where a click would land.
    if (hover) {
      context.fillStyle = "rgba(255, 255, 255, 0.4)";
      context.fillRect(Math.min(cssWidth - 1, Math.max(0, hover.x)), 0, 1, cssHeight);
    }

    // Playhead — the current position.
    if (duration > 0) {
      context.fillStyle = PLAYHEAD_COLOR;
      context.fillRect(Math.min(cssWidth - 2, Math.max(0, playheadPx - 1)), 0, 2, cssHeight);
    }
  }, [currentTime, duration, hover]);

  // Keep a stable reference to the latest draw for the resize listener.
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let audioContext: AudioContext | null = null;

    (async () => {
      try {
        const bytes = base64ToBytes(audioBase64);
        objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeFor(fileName) }));
        if (cancelled) return;
        setAudioUrl(objectUrl);

        audioContext = new AudioContext();
        const decoded = await audioContext.decodeAudioData(bytes.slice().buffer as ArrayBuffer);
        if (cancelled) return;
        peaksRef.current = computePeaks(decoded, SOURCE_BUCKETS);
        setReady(true);
        drawRef.current();
      } catch {
        if (!cancelled) setError("Could not read this audio file.");
      } finally {
        audioContext?.close().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBase64, fileName]);

  // Single redraw path — fires on any state the drawing depends on.
  useEffect(() => {
    draw();
  }, [draw, ready]);

  useEffect(() => {
    const onResize = () => drawRef.current();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      commit.current?.(latestPosition.current);
    };
  }, []);

  const persist = useCallback((seconds: number) => {
    latestPosition.current = seconds;
    commit.current?.(seconds);
  }, []);

  const seekToClientX = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      const audio = audioRef.current;
      if (!canvas || !audio || !duration) return;
      const rect = canvas.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const target = fraction * duration;
      audio.currentTime = target;
      setCurrentTime(target);
      persist(target);
    },
    [duration, persist],
  );

  const seekTo = useCallback(
    (target: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const clamped = Math.min(duration, Math.max(0, target));
      audio.currentTime = clamped;
      setCurrentTime(clamped);
      persist(clamped);
    },
    [duration, persist],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => setError("Playback failed."));
    else audio.pause();
  }, []);

  const rulerTicks = useMemo(() => {
    if (!duration || !Number.isFinite(duration)) return [];
    const ideal = duration / 8;
    const interval = TICK_INTERVALS.find((value) => value >= ideal) ?? 3600;
    const ticks: number[] = [];
    for (let t = 0; t <= duration + 0.001; t += interval) ticks.push(t);
    return ticks;
  }, [duration]);

  if (error) {
    return (
      <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-app-border p-5">
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          setDuration(audio.duration);
          if (initialPosition > 0 && initialPosition < audio.duration) {
            audio.currentTime = initialPosition;
            setCurrentTime(initialPosition);
          }
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setCurrentTime(audio.currentTime);
          latestPosition.current = audio.currentTime;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          persist(audioRef.current?.currentTime ?? 0);
        }}
        onEnded={() => {
          setPlaying(false);
          persist(0);
        }}
      />

      <div className="relative">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onClick={(event) => seekToClientX(event.clientX)}
          onMouseMove={(event) => {
            if (!duration) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
            setHover({ x, time: (x / rect.width) * duration });
          }}
          onMouseLeave={() => setHover(null)}
          onKeyDown={(event) => {
            const audio = audioRef.current;
            if (!audio) return;
            if (event.key === "ArrowLeft") { seekTo(audio.currentTime - 5); event.preventDefault(); }
            else if (event.key === "ArrowRight") { seekTo(audio.currentTime + 5); event.preventDefault(); }
            else if (event.key === "Home") { seekTo(0); event.preventDefault(); }
            else if (event.key === "End") { seekTo(duration); event.preventDefault(); }
            else if (event.key === " ") { togglePlay(); event.preventDefault(); }
          }}
          style={{ height }}
          className={`w-full rounded outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${ready ? "cursor-pointer" : "opacity-40"}`}
          aria-label="Audio waveform — click or use arrow keys to choose where to resume"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        />

        {hover && duration > 0 && (
          <div
            className="pointer-events-none absolute top-1 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-xs tabular-nums text-white shadow"
            style={{ left: hover.x }}
          >
            {formatTime(hover.time)}
          </div>
        )}
      </div>

      {duration > 0 && (
        <div className="relative mt-1.5 h-4 select-none text-[10px] text-gray-500">
          {rulerTicks.map((t) => {
            const pct = (t / duration) * 100;
            const transform = pct <= 0 ? "none" : pct >= 99 ? "translateX(-100%)" : "translateX(-50%)";
            return (
              <span key={t} className="absolute top-0 tabular-nums" style={{ left: `${pct}%`, transform }}>
                {formatTime(t)}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!audioUrl}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={() => seekTo((audioRef.current?.currentTime ?? 0) - 10)}
          disabled={!ready}
          aria-label="Back 10 seconds"
          className="flex items-center gap-1 text-sm text-gray-300 transition hover:text-white disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
          10s
        </button>

        <button
          type="button"
          onClick={() => seekTo((audioRef.current?.currentTime ?? 0) + 10)}
          disabled={!ready}
          aria-label="Forward 10 seconds"
          className="flex items-center gap-1 text-sm text-gray-300 transition hover:text-white disabled:opacity-40"
        >
          <RotateCw className="h-4 w-4" />
          10s
        </button>

        <span className="ml-auto font-mono text-sm tabular-nums text-gray-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {!ready && <p className="mt-3 text-sm text-slate-400">Analyzing waveform…</p>}
    </div>
  );
}
