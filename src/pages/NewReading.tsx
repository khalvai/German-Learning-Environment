import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveReading } from "../desktop";
import Button from "../components/Button";
import { Save } from "lucide-react";

export default function NewReading() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !originalText.trim()) {
      setError("A title and German text are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const id = await saveReading(title.trim(), originalText.trim());

      navigate(`/reading/${id}`);
    } catch {
      setError("Could not save the reading. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <nav className="h-16 px-6 flex items-center justify-between border-b border-app-border">
        <h1 className="text-2xl font-bold">New Reading</h1>
      </nav>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 p-6">
        {error && <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</p>}

        <div>
          <label htmlFor="reading-title" className="mb-1 block text-sm text-gray-400">Title</label>
          <input
            id="reading-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ein Tag in Berlin"
            className="w-full rounded-lg border border-app-border bg-transparent px-4 py-2.5 focus:outline-none focus:border-indigo-400"
            required
          />
        </div>

        <div>
          <label htmlFor="reading-text" className="mb-1 block text-sm text-gray-400">German text</label>
          <textarea
            id="reading-text"
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder="Paste the text here..."
            rows={12}
            className="w-full resize-y rounded-lg border border-app-border bg-transparent px-4 py-3 focus:outline-none focus:border-indigo-400"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            disabled={saving}
            type="submit"
            className=""
          >
            <Save className="h-4 w-4" />
            Save
          </Button>

          <Button
            disabled={false}
            onClick={() => navigate("/reading")}
            className=""
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
