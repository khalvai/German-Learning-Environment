import { Trash } from "lucide-react";
import { getTopics, removeTopic, type Topic } from "../../desktop";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ContentLibrary from "../../components/ContentLibrary";

function TopicCard({
  topic,
  onRemove,
}: {
  topic: Topic;
  onRemove: () => Promise<void>;
}) {
  return (
    <div className="group relative flex flex-col items-center p-4 h-[260px] w-[195px] border app-card rounded-lg">
      <button
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await onRemove();
        }}
        aria-label={`Delete ${topic.title}`}
        className="ml-auto invisible text-gray-500 transition hover:text-red-500 group-hover:visible"
      >
        <Trash className="w-4 h-4" />
      </button>

      <Link
        to={`/writings/new?topic=${topic.id}`}
        className="flex flex-col w-full h-full"
      >
        <h2 className="text-base font-medium mb-2 line-clamp-2">
          {topic.title}
        </h2>

        <pre className="line-clamp-8 text-sm text-gray-400 whitespace-pre-wrap flex-1">
          {topic.question}
        </pre>
      </Link>
    </div>
  );
}

export default function WritingTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getTopics()
      .then(setTopics)
      .catch(() => setError("Could not load your writing topics."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ContentLibrary
      title="Writing Topics"
      itemLabel="topic"
      loading={loading}
      error={error}
      onCreate={() => navigate("/writings/topics/new")}
    >
      {topics.map((topic) => (
        <TopicCard
          key={topic.id}
          topic={topic}
          onRemove={async () => {
            try {
              await removeTopic(topic.id);
              setTopics((prev) => prev.filter((item) => item.id !== topic.id));
            } catch {
              setError(`Could not delete “${topic.title}”.`);
            }
          }}
        />
      ))}
    </ContentLibrary>
  );
}
