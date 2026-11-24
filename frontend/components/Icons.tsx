type P = { className?: string };
const base = (className = "h-4 w-4") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const Plus = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const ArrowUp = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
export const ArrowUpRight = ({ className }: P) => (
  <svg {...base(className)}><path d="M7 17 17 7M8 7h9v9" /></svg>
);
export const ArrowLeft = ({ className }: P) => (
  <svg {...base(className)}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
);
export const Check = ({ className }: P) => (
  <svg {...base(className)}><path d="M5 12.5 10 17 19 7" /></svg>
);
export const Chart = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const Sparkle = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
);
export const X = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const Refresh = ({ className }: P) => (
  <svg {...base(className)}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
);
