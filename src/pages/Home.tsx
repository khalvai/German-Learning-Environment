import SkillCard from "../components/SkillCard";

export default function Home() {
  return (
    <div
      className="
      mt-20
        flex
        flex-col
        items-center
        justify-center
        gap-10
      "
    >
      <div
        className="
          grid
          grid-cols-2
          gap-8
        "
      >
        <SkillCard title="Reading" path="/reading" />

        <SkillCard title="Listening" path="/listening" />

        <SkillCard title="Speaking" path="/speaking" />

        <SkillCard title="Grammar" path="/grammar" />
      </div>
    </div>
  );
}
