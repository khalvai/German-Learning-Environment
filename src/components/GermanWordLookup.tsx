import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Search,
  Sparkles,
  Volume2,
  X,
  XIcon,
} from "lucide-react";
import { explainWord, ExplanationResponse } from "../services/ai-integration";

/**
 * GermanWordLookup
 * ------------------------------------------------------------------
 * Dictionary data (part of speech, article/gender, plural, verb forms,
 * definitions, pronunciation audio) comes entirely from Wiktionary —
 * it's free, fast, and doesn't need an AI call.
 *
 * The AI (`explainWord`) is used for exactly one thing Wiktionary can't
 * do: explaining what the word means *in this specific sentence*. It's
 * opt-in via the "Explain with AI" button so a lookup never triggers an
 * AI request by itself — only clicking the button does.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AudioClipData {
  url: string;
  title: string;
  region: string | null;
}

interface NounInfo {
  gender: "m" | "f" | "n" | null;
  plural: string | null;
  genitive: string | null;
}

interface VerbFormInfo {
  form: string;
  label: string;
}

interface DictEntry {
  pos: string;
  headwordText: string;
  definitions: string[];
}

interface LookupResult {
  word: string;
  entries: DictEntry[];
  audio: AudioClipData[];
}

interface GermanWordLookupProps {
  selectedWord: string;
  contextSentence: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Wiktionary / Commons endpoints
// ---------------------------------------------------------------------------

const WIKT_HTML = (word: string) =>
  `https://en.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(word)}`;

const COMMONS_SEARCH = (word: string) =>
  `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=8&format=json&origin=*&srsearch=${encodeURIComponent(
    `filetype:audio intitle:"De-${word}"`,
  )}`;

const COMMONS_IMAGEINFO = (titles: string[]) =>
  `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    titles.join("|"),
  )}&prop=imageinfo&iiprop=url&format=json&origin=*`;

const GENDER_LABEL: Record<string, string> = {
  m: "der (masculine)",
  f: "die (feminine)",
  n: "das (neuter)",
};

const REGION_FLAG: Record<string, string> = {
  Germany: "🇩🇪",
  Austria: "🇦🇹",
  Switzerland: "🇨🇭",
};

function regionFlag(region: string | null): string {
  if (!region) return "🔊";
  const key = Object.keys(REGION_FLAG).find((k) => region.includes(k));
  return key ? REGION_FLAG[key] : "🔊";
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function safeFetch(url: string, label: string): Promise<Response> {
  try {
    return await fetch(url);
  } catch {
    throw new Error(
      `${label}: request blocked before reaching the server (likely a network/CORS restriction in this environment).`,
    );
  }
}

function fixProtocolRelative(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

function filenameFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(url.split("/").pop() || "");
    return last
      .replace(/^De-/, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/_/g, " ");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Wiktionary HTML parsing
// ---------------------------------------------------------------------------

function germanSectionNodes(doc: Document): Element[] | null {
  const headings = Array.from(doc.querySelectorAll("h2, h3, h4, h5"));
  const startIdx = headings.findIndex(
    (h) => h.id === "German" || h.textContent?.trim() === "German",
  );
  if (startIdx === -1) return null;

  const allNodes = Array.from(doc.body.querySelectorAll("*"));
  const startPos = allNodes.indexOf(headings[startIdx]);
  const nextH2 = headings.slice(startIdx + 1).find((h) => h.tagName === "H2");
  const endPos = nextH2 ? allNodes.indexOf(nextH2) : allNodes.length;
  return allNodes.slice(startPos, endPos);
}

/** Part of speech, headword line, and definitions — straight from Wiktionary. */
function parseGermanEntries(doc: Document): DictEntry[] | null {
  const nodes = germanSectionNodes(doc);
  if (!nodes) return null;

  const posHeadings = nodes.filter(
    (n): n is HTMLElement =>
      (n.tagName === "H3" || n.tagName === "H4") &&
      /^(Noun|Verb|Adjective|Adverb)$/i.test(n.textContent?.trim() || ""),
  );

  return posHeadings.map((posHeading) => {
    const pos = posHeading.textContent?.trim() || "";
    let node = posHeading.nextElementSibling as HTMLElement | null;
    let headwordText = "";
    const definitions: string[] = [];

    while (node && !/^H[2-4]$/.test(node.tagName)) {
      if (!headwordText && node.classList?.contains("headword-line")) {
        headwordText = node.textContent?.replace(/\s+/g, " ").trim() || "";
      }
      if (node.tagName === "OL") {
        Array.from(node.children).forEach((li) => {
          const clone = li.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("ul, dl").forEach((el) => el.remove());
          const text = clone.textContent?.replace(/\s+/g, " ").trim();
          if (text) definitions.push(text);
        });
      }
      node = node.nextElementSibling as HTMLElement | null;
    }

    return { pos, headwordText, definitions };
  });
}

function extractNounInfo(headwordText: string): NounInfo {
  const genderMatch = headwordText.match(/\b([mfn])\b(?!\w)/);
  const pluralMatch = headwordText.match(/plural\s+([A-ZÄÖÜa-zäöüß\u2011-]+)/i);
  const genitiveMatch = headwordText.match(
    /genitive[^,]*\s([A-ZÄÖÜa-zäöüß\u2011-]+)/i,
  );
  return {
    gender: (genderMatch?.[1] ?? null) as NounInfo["gender"],
    plural: pluralMatch?.[1] ?? null,
    genitive: genitiveMatch?.[1] ?? null,
  };
}

function extractVerbInfo(headwordText: string): VerbFormInfo[] {
  return headwordText
    .split(/,\s*(?=[a-zäöüß])/i)
    .map((part) => part.match(/^([A-Za-zÄÖÜäöüß]+)\s*\(([^)]+)\)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ form: m[1], label: m[2] }));
}

/** Audio + region qualifier ("Germany" / "Austria" / "Switzerland" / ...) straight from the page's Pronunciation section. */
function extractPronunciations(doc: Document): AudioClipData[] {
  const nodes = germanSectionNodes(doc);
  if (!nodes) return [];

  const pronHeading = nodes.find(
    (n) =>
      /^H[2-5]$/.test(n.tagName) &&
      /^Pronunciation/i.test(n.textContent?.trim() || ""),
  ) as HTMLElement | undefined;
  if (!pronHeading) return [];

  const clips: AudioClipData[] = [];
  let node = pronHeading.nextElementSibling as HTMLElement | null;
  while (node && !/^H[2-5]$/.test(node.tagName)) {
    const items =
      node.tagName === "LI" ? [node] : Array.from(node.querySelectorAll("li"));
    items.forEach((li) => {
      const audioEl = li.querySelector("audio");
      const src =
        audioEl?.querySelector("source")?.getAttribute("src") ||
        audioEl?.getAttribute("src");
      if (!src) return;

      const url = fixProtocolRelative(src);
      let region = li.querySelector(".ib-content")?.textContent?.trim() || null;
      if (!region) {
        const matches = Array.from(
          (li.textContent || "").matchAll(/\(([^)]+)\)/g),
        ).map((m) => m[1].trim());
        region = matches.find((m) => m.toLowerCase() !== "key") || null;
      }
      clips.push({ url, region, title: filenameFromUrl(url) });
    });
    node = node.nextElementSibling as HTMLElement | null;
  }

  const seen = new Set<string>();
  return clips.filter((c) =>
    seen.has(c.url) ? false : (seen.add(c.url), true),
  );
}

/** Fallback when the page has no in-context Pronunciation audio to parse — can't be region-labeled. */
async function fetchAudioClipsFromCommons(
  word: string,
): Promise<AudioClipData[]> {
  const searchRes = await safeFetch(COMMONS_SEARCH(word), "Commons search");
  if (!searchRes.ok) return [];
  const titles: string[] = ((await searchRes.json())?.query?.search || []).map(
    (r: any) => r.title,
  );
  if (titles.length === 0) return [];

  const infoRes = await safeFetch(
    COMMONS_IMAGEINFO(titles),
    "Commons imageinfo",
  );
  if (!infoRes.ok) return [];
  const pages = (await infoRes.json())?.query?.pages || {};
  return Object.values(pages)
    .map((p: any) => ({
      url: p.imageinfo?.[0]?.url as string | undefined,
      title: (p.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
      region: null as string | null,
    }))
    .filter((c): c is AudioClipData => !!c.url);
}

async function fetchWiktionaryData(word: string): Promise<LookupResult> {
  const htmlRes = await safeFetch(WIKT_HTML(word), "Wiktionary page");
  if (!htmlRes.ok) {
    throw new Error(
      htmlRes.status === 404
        ? `No Wiktionary entry found for "${word}".`
        : `Wiktionary request failed (HTTP ${htmlRes.status}).`,
    );
  }
  const doc = new DOMParser().parseFromString(
    await htmlRes.text(),
    "text/html",
  );
  const entries = parseGermanEntries(doc);
  if (!entries || entries.length === 0) {
    throw new Error(`No German-language entry found for "${word}".`);
  }

  const audio = extractPronunciations(doc);
  return {
    word,
    entries,
    audio:
      audio.length > 0
        ? audio
        : await fetchAudioClipsFromCommons(word).catch(() => []),
  };
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function AudioPill({ url, title, region }: AudioClipData) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <button
      type="button"
      onClick={() => audioRef.current?.play()}
      title={title}
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full pl-2 pr-3 py-1.5 border transition-colors ${
        isPlaying
          ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-200"
          : "bg-[#2e2e38] border-[#3e3e4a] text-slate-200 hover:bg-[#3a3a46] hover:border-[#4a4a58]"
      }`}
    >
      <Volume2
        className={`w-3.5 h-3.5 shrink-0 ${isPlaying ? "text-indigo-300" : "text-slate-400"}`}
      />
      {region && <span className="leading-none">{regionFlag(region)}</span>}
      <span className="leading-none">{region ?? "Listen"}</span>
      <audio
        ref={audioRef}
        src={url}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </button>
  );
}

function GrammarRow({ entry }: { entry: DictEntry }) {
  if (entry.pos === "Noun") {
    const noun = extractNounInfo(entry.headwordText);
    if (!noun.gender && !noun.plural) {
      return (
        <p className="text-xs italic text-slate-500">{entry.headwordText}</p>
      );
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-slate-300">
        {noun.gender && <span>{GENDER_LABEL[noun.gender]}</span>}
        {noun.plural && <span>Plural: die {noun.plural}</span>}
      </div>
    );
  }

  if (entry.pos === "Verb") {
    const forms = extractVerbInfo(entry.headwordText);
    if (forms.length === 0) {
      return (
        <p className="text-xs italic text-slate-500">{entry.headwordText}</p>
      );
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-slate-300">
        {forms.map((f, idx) => (
          <span key={idx}>
            <span className="text-slate-500">{f.label}:</span> {f.form}
          </span>
        ))}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GermanWordLookup({
  selectedWord,
  contextSentence,
  onClose,
}: GermanWordLookupProps) {
  const [input, setInput] = useState(selectedWord);

  useEffect(() => {
    setInput(selectedWord);
  }, [selectedWord]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(
    null,
  );

  const lookup = useCallback(async (rawWord: string) => {
    const word = rawWord.trim();
    if (!word) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await fetchWiktionaryData(word));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  const requestAiExplanation = useCallback(
    async (word: string, sentence: string | null) => {
      setAiLoading(true);
      setAiError(null);
      try {
        setExplanation(await explainWord(word, sentence));
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "AI explanation failed.");
      } finally {
        setAiLoading(false);
      }
      console.log(explanation);
    },
    [selectedWord, contextSentence],
  );

  useEffect(() => {
    setInput(selectedWord);
    setExplanation(null);
    setAiError(null);
    lookup(selectedWord);
  }, [selectedWord, lookup]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const word = input.trim();
    if (!word) return;

    const sentence = word === selectedWord ? contextSentence : null;

    await requestAiExplanation(word, sentence);
  };
  const primaryPos = result?.entries[0]?.pos ?? null;

  return (
    <div className="flex w-full flex-col gap-3 px-5 py-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-xl font-bold text-indigo-100">{selectedWord}</h3>
          {primaryPos && (
            <span className="text-[10px] font-semibold bg-[#2e2e38] px-2 py-0.5 rounded border border-[#3e3e4a]">
              {primaryPos}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-[#2e2e38] border border-[#3e3e4a] text-slate-400 hover:text-white hover:bg-[#3a3a46] transition-colors"
        >
          X
        </button>
      </div>

      {result && result.audio.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.audio.map((clip) => (
            <AudioPill key={clip.url} {...clip} />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {result.entries.map((entry, i) => (
            <div
              key={i}
              className="border-t border-[#3e3e4a] pt-3 first:border-t-0 first:pt-0 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {entry.pos}
                </span>
              </div>
              <GrammarRow entry={entry} />
              {entry.definitions.length > 0 && (
                <ol className="list-decimal list-inside space-y-1 text-sm text-slate-300">
                  {entry.definitions.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[#3e3e4a] pt-3">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Tisch, gehen, schön"
            className="flex-1 px-3 py-2 rounded-lg bg-[#2e2e38] border border-[#3e3e4a] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={aiLoading || !input?.trim()}
            className="px-3 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium disabled:opacity-40 flex items-center gap-2"
          >
            {aiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </button>
        </form>

        {aiError && <p className="text-xs text-red-300 mt-1">{aiError}</p>}

        {explanation && (
          <div className="text-[13px] mt-10 text-slate-300 space-y-1">
            <span className="text-[10px] mb-10 font-semibold bg-[#2e2e38] px-2 py-0.5 rounded border border-[#3e3e4a]">
              {explanation.partOfSpeech}
            </span>
            <div className="mt-10 flex flex-wrap gap-2">
              {explanation.definitions?.map((d, idx) => (
                <span key={idx}>
                  {d}
                  {idx < explanation.definitions.length - 1 && ","}
                </span>
              ))}
            </div>

            {explanation.partOfSpeech === "Noun" && (
              <div className="flex gap-2">
                <p>
                  {" "}
                  {explanation.grammar?.noun?.article}{" "}
                  {explanation.grammar?.noun?.singular},
                </p>
                {explanation.grammar?.noun?.plural && (
                  <p> die {explanation.grammar?.noun?.plural}</p>
                )}
              </div>
            )}

            {explanation.partOfSpeech === "Verb" && (
              <div className="flex gap-2">
                <p> {explanation.grammar?.verb?.infinitive}</p>
                <p> {explanation.grammar?.verb?.presentThirdPerson}</p>
                <p> {explanation.grammar?.verb?.präteritumThirdPerson}</p>
                <p>
                  {explanation.grammar?.verb?.perfectAuxiliary === "haben"
                    ? "hat"
                    : "ist"}{" "}
                  {explanation.grammar?.verb?.perfectParticiple}
                </p>
              </div>
            )}

            {explanation.partOfSpeech === "Adjective" && (
              <div className="flex gap-2">
                <p> {explanation.grammar?.adjective?.comparative} </p>
                <p> {explanation.grammar?.adjective?.superlative}</p>
              </div>
            )}

            <div className="mt-10 flex flex-col gap-2">
              <p className="">
                {" > "}
                {explanation.exampleSentenceGerman}
              </p>

              <p className="">
                {" > "}
                {explanation.exampleSentenceEnglish}
              </p>

              <p className=" text-slate-500">{explanation.meaningInContext}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
