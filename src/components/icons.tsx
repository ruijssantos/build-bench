/**
 * Inline SVG icon set — docs/PLAN.md §4.1: 24px grid, fill="none", stroke 2
 * (1.9–2.6 for emphasis), round caps/joins. No emoji anywhere in the UI.
 */
import type { SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function base(props: IconProps, strokeWidth = 2) {
  const { size = 24, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export function ThinnerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z" />
    </svg>
  );
}

/** A small screw-lid paint pot — the Tamiya mini bottle shape — rather than
 * a tall narrow-neck bottle. Lid, jar body, label band. */
export function PaintsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8.5" y="3" width="7" height="3.5" rx="1.2" />
      <rect x="6" y="6.5" width="12" height="14.5" rx="3" />
      <path d="M6 13.2h12" />
    </svg>
  );
}

export function KitsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
      <path d="M3 7l9 4 9-4" />
      <path d="M12 11v10" />
    </svg>
  );
}

export function ShoppingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h2l2.5 10h10L20 8H6" />
      <circle cx="10" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </svg>
  );
}

export function LogIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4z" />
      <path d="M9 8h6M9 12h4" />
    </svg>
  );
}

export function AirbrushIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.1-2.1z" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** The unsorted state of a sortable column header — both directions, quiet,
 * signalling "click to sort" without claiming a direction. */
export function SortIcon(props: IconProps) {
  return (
    <svg {...base(props, 1.8)}>
      <path d="M8 10l4-4 4 4" />
      <path d="M8 14l4 4 4-4" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props, 2)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5" />
      <path d="M12 16v.01" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M19 12H9m10 0-3.5-3.5M19 12l-3.5 3.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props, 2.6)}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props, 2.6)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** "Look this up somewhere else" — the shelf's find-a-shop link. */
export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8.5 8.5" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

/** A part-empty bottle: the running-low mark. */
export function LowBottleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2h4v4l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3V2z" />
      <path d="M8 16h8" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    </svg>
  );
}
