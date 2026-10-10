import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/** Arrow shown at the start of a page header to return to the parent page. */
export default function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} aria-label={label} className="text-slate-400 transition hover:text-slate-200">
      <ArrowLeft className="h-5 w-5" />
    </Link>
  );
}
