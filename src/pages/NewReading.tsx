import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveReading } from "../services/reading.repository";
import type { Reading } from "../services/reading.repository";
import Button from "../components/Button";
import { Save } from "lucide-react";

const LEVELS: Reading["level"][] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function NewReading() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<Reading["level"]>("A2");
  const [originalText, setOriginalText] = useState("");
  const [translation, setTranslation] = useState("");
  const [vocabulary, setVocabulary] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !originalText.trim()) {
      alert("Title and German text are required");
      return;
    }

    setSaving(true);

    try {
      const id = await saveReading(title, originalText, {
        translation: translation.trim() || undefined,
        vocabulary: vocabulary.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        level,
      });

      navigate(`/reading/${id}`);
    } catch (error) {
      console.error("Failed to save reading:", error);
      alert("Failed to save reading");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="h-16 px-6 flex items-center justify-between border-b border-app-border">
        <h1 className="text-2xl font-bold">New Reading</h1>
      </nav>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 space-y-6">
        <label className="block text-sm text-gray-400 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Ein Tag in Berlin"
          className="w-full bg-transparent border border-app-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary"
          required
        />

        <textarea
          value={originalText}
          onChange={(e) => setOriginalText(e.target.value)}
          placeholder="Paste the text here..."
          rows={8}
          className="w-full bg-transparent border border-app-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary resize-y"
          required
        />

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            disabled={saving}
            onClick={async () => {
              await handleSubmit();
            }}
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
