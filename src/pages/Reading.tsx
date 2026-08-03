import { getReadings } from "../services/readingService";
import type { Reading } from "../services/readingService";
import { useNavigate } from "react-router-dom";

export default function Reading() {
  const readings: Reading[] = getReadings();
  const navigate = useNavigate();

  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold mb-8">Reading</h1>

      <div className="grid grid-cols-2 gap-6">
        {readings.map((reading) => (
          <div
            key={reading.id}
            onClick={() => navigate(`/readings/${reading.id}`)}
            className="app-card cursor-pointer"
          >
            <h2 className="text-xl font-bold">{reading.title}</h2>

            <p>Level: {reading.level}</p>

            <p>Category: {reading.category}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
