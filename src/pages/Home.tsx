import SkillCard from "../components/SkillCard";
import { ApiKeyGate } from "../components/APIGate";

export default function Home() {
  return (
    <div className="mt-20 flex flex-col items-center justify-center gap-10">
      <div className="grid grid-cols-2 gap-8">
        <SkillCard title="Reading" path="/reading" />
        <SkillCard title="Listening" path="/listening" />
        <SkillCard title="Speaking" path="/speaking" />
        <SkillCard title="Grammar" path="/grammar" />
        <SkillCard title="Writing" path="/writings" />
        <ApiKeyGate />
      </div>
    </div>
  );
}
