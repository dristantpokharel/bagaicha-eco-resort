import { Icon, type IconName } from "./icons";

type Item = { icon: IconName; label: string };

/**
 * Brochure icon row: line icon above a tracked uppercase label, thin vertical
 * hairlines between items. Wraps into a 2-column grid on phones.
 */
export function IconRow({
  items,
  tone = "dark",
  className = "",
}: {
  items: readonly Item[];
  tone?: "dark" | "light";
  className?: string;
}) {
  const color = tone === "dark" ? "text-icon" : "text-cream";
  const divider = tone === "dark" ? "md:border-icon/40" : "md:border-cream/40";
  return (
    <ul className={`grid grid-cols-2 gap-y-8 md:flex md:flex-wrap md:justify-center md:gap-y-6 ${color} ${className}`}>
      {items.map((item, i) => (
        <li
          key={item.label}
          className={`flex flex-col items-center gap-3 px-3 text-center md:px-8 ${
            i > 0 ? `md:border-l ${divider}` : ""
          } ${items.length % 2 === 1 && i === items.length - 1 ? "col-span-2" : ""}`}
        >
          <Icon name={item.icon} size={36} />
          <span className="text-label max-w-[14ch]">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
