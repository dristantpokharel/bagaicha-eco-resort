import type { SVGProps } from "react";
import {
  BedDouble,
  Cake,
  Leaf,
  Mountain,
  Plane,
  Presentation,
  Sun,
  Trees,
  Handshake,
  Users,
  UsersRound,
  UtensilsCrossed,
  Waves,
  Wifi,
  Wine,
  type LucideIcon,
} from "lucide-react";

/** Brochure-style line icons: 1.5 stroke, current colour, always decorative. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function Rings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="14" r="5.5" />
      <circle cx="15" cy="14" r="5.5" />
      <path d="M7.5 6.5 9 4.5l1.5 2" />
    </Svg>
  );
}

function Bridge(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 17h20M4 17V9m16 8V9M4 9c4 0 6 4 8 4s4-4 8-4M8 17v-4.5m8 4.5v-4.5M12 17v-4" />
    </Svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 20.5 5 16.2A8.5 8.5 0 1 1 8 19.2z" />
      <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9c-1.2-.5-2.3-1.6-2.8-2.8l.9-1-1-2z" />
    </Svg>
  );
}

const lucide = (Icon: LucideIcon) =>
  function LucideBrandIcon({ size = 24, ...props }: IconProps) {
    return <Icon size={size} strokeWidth={1.5} aria-hidden="true" {...(props as object)} />;
  };

export const icons = {
  leaf: lucide(Leaf),
  bed: lucide(BedDouble),
  food: lucide(UtensilsCrossed),
  people: lucide(Users),
  wifi: lucide(Wifi),
  sun: lucide(Sun),
  rings: Rings,
  cake: lucide(Cake),
  glasses: lucide(Wine),
  presentation: lucide(Presentation),
  group: lucide(UsersRound),
  team: lucide(Handshake),
  plane: lucide(Plane),
  conservation: lucide(Trees),
  park: lucide(Mountain),
  bridge: Bridge,
  waves: lucide(Waves),
} satisfies Record<string, (props: IconProps) => React.ReactNode>;

export type IconName = keyof typeof icons;

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = icons[name];
  return <Component {...props} />;
}
