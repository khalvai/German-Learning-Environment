import { Link } from "react-router-dom";

interface SkillCardProps {
  title: string;
  path: string;
}

export default function SkillCard({ title, path }: SkillCardProps) {
  return (
    <Link to={path}>
      <div
        className="
          w-64
          h-40
          flex
          app-card
          items-center
          justify-center
          cursor-pointer
        "
      >
        <h2 className="text-2xl text-stone-300 font-bold">{title}</h2>
      </div>
    </Link>
  );
}
