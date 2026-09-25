import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveListening } from "../desktop";
import Button from "../components/Button";
import { Save, Upload } from "lucide-react";

/** Reads a File into a base64 data URL (the backend strips the prefix). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function NewListening() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Choose an audio file first.");
      return;
    }
    const finalTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");
    if (!finalTitle) {
      setError("A title is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const dataUrl = await readAsDataUrl(file);
      const id = await saveListening(finalTitle, file.name, dataUrl);
      navigate(`/listening/${id}`);
    } catch {
      setError("Could not save the audio. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <nav className="h-16 px-6 flex items-center justify-between border-b border-app-border">
        <h1 className="text-2xl font-bold">New Audio</h1>
      </nav>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 p-6">
        {error && (
          <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="listening-title" className="mb-1 block text-sm text-gray-400">
            Title
          </label>
          <input
            id="listening-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tagesschau — 20 Uhr"
            className="w-full rounded-lg border border-app-border bg-transparent px-4 py-2.5 focus:outline-none focus:border-indigo-400"
          />
          <p className="mt-1 text-xs text-gray-500">Leave blank to use the file name.</p>
        </div>

        <div>
          <label htmlFor="listening-file" className="mb-1 block text-sm text-gray-400">
            Audio file
          </label>
          <label
            htmlFor="listening-file"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-app-border px-4 py-10 text-center transition hover:border-indigo-400"
          >
            <Upload className="h-8 w-8 text-gray-400" aria-hidden="true" />
            <span className="text-sm">{file ? file.name : "Click to choose an audio file"}</span>
            {file && <span className="text-xs text-gray-500">{(file.size / 1_048_576).toFixed(1)} MB</span>}
          </label>
          <input
            id="listening-file"
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setFile(chosen);
              if (chosen && !title.trim()) setTitle(chosen.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button disabled={saving} type="submit" className="">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>

          <Button disabled={saving} onClick={() => navigate("/listening")} className="">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
