export default function Button({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  className: string;
}) {
  const baseClassName =
    "flex h-11 items-center gap-2 rounded-lg border border-app-border px-4 text-sm font-medium disabled:opacity-50 hover:bg-gray-400";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClassName} ${className}`}
    >
      {children}
    </button>
  );
}
