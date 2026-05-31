import { memo, type ReactNode } from "react";

type Accent = "neutral" | "good" | "bad" | "warn" | "info";

const accentText: Record<Accent, string> = {
  neutral: "text-neutral-100",
  good: "text-emerald-300",
  bad: "text-red-300",
  warn: "text-amber-300",
  info: "text-sky-300",
};

const accentBorder: Record<Accent, string> = {
  neutral: "border-neutral-800",
  good: "border-emerald-700/40",
  bad: "border-red-700/40",
  warn: "border-amber-700/40",
  info: "border-sky-700/40",
};

const accentBg: Record<Accent, string> = {
  neutral: "bg-neutral-900/40",
  good: "bg-emerald-950/20",
  bad: "bg-red-950/20",
  warn: "bg-amber-950/20",
  info: "bg-sky-950/20",
};

export const Card = memo(
  ({
    children,
    accent = "neutral",
    padding = "md",
    className = "",
  }: {
    children: ReactNode;
    accent?: Accent;
    padding?: "sm" | "md" | "lg";
    className?: string;
  }) => {
    const pad = padding === "sm" ? "p-3" : padding === "lg" ? "p-5" : "p-3.5";
    return (
      <section
        className={`rounded-xl border ${accentBorder[accent]} ${accentBg[accent]} ${pad} shadow-md shadow-black/20 ${className}`}
      >
        {children}
      </section>
    );
  }
);
Card.displayName = "UICard";

export const SectionHeader = memo(
  ({
    title,
    subtitle,
    actions,
    eyebrow,
  }: {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    eyebrow?: ReactNode;
  }) => (
    <div className="flex items-start justify-between gap-3 mb-2.5 flex-wrap">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[9px] uppercase tracking-[0.18em] font-black text-amber-400/80 mb-0.5">
            {eyebrow}
          </div>
        )}
        <h2 className="text-sm font-bold tracking-tight text-neutral-100">{title}</h2>
        {subtitle && <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-1.5 flex-wrap shrink-0">{actions}</div>}
    </div>
  )
);
SectionHeader.displayName = "UISectionHeader";

export const PageHeader = memo(
  ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
  }) => (
    <header className="flex items-start justify-between gap-3 flex-wrap pb-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </header>
  )
);
PageHeader.displayName = "UIPageHeader";

export const Stat = memo(
  ({
    label,
    value,
    sub,
    accent = "neutral",
    size = "md",
  }: {
    label: string;
    value: string | ReactNode;
    sub?: string | ReactNode;
    accent?: Accent;
    size?: "sm" | "md" | "lg";
  }) => {
    const valSize =
      size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
        <div className={`font-bold font-mono mt-1 ${valSize} ${accentText[accent]}`}>{value}</div>
        {sub && <div className="text-[10px] text-neutral-500 mt-0.5">{sub}</div>}
      </div>
    );
  }
);
Stat.displayName = "UIStat";

export const Pill = memo(
  ({ children, accent = "neutral" }: { children: ReactNode; accent?: Accent }) => {
    const palette = {
      neutral: "bg-neutral-800 text-neutral-300 border-neutral-700",
      good: "bg-emerald-950/40 text-emerald-300 border-emerald-700/40",
      bad: "bg-red-950/40 text-red-300 border-red-700/40",
      warn: "bg-amber-950/40 text-amber-300 border-amber-700/40",
      info: "bg-sky-950/40 text-sky-300 border-sky-700/40",
    } as const;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${palette[accent]}`}>
        {children}
      </span>
    );
  }
);
Pill.displayName = "UIPill";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md";

export const Button = memo(
  ({
    children,
    onClick,
    variant = "secondary",
    size = "md",
    disabled,
    type = "button",
    className = "",
    title,
  }: {
    children: ReactNode;
    onClick?: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    type?: "button" | "submit";
    className?: string;
    title?: string;
  }) => {
    const variantClass: Record<ButtonVariant, string> = {
      primary: "bg-amber-400 text-neutral-950 hover:bg-amber-300 shadow-sm",
      secondary: "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-700",
      ghost: "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60",
      danger: "bg-red-600 text-white hover:bg-red-500",
      success: "bg-emerald-600 text-white hover:bg-emerald-500",
    };
    const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`inline-flex items-center justify-center rounded-lg font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass} ${className}`}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "UIButton";

export const EmptyState = memo(
  ({
    icon,
    title,
    description,
    action,
  }: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
  }) => (
    <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
      {icon && <div className="text-4xl mb-3 opacity-70">{icon}</div>}
      <h3 className="text-base font-semibold text-neutral-200 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
);
EmptyState.displayName = "UIEmptyState";

export const StatGrid = memo(
  ({ cols = 4, children }: { cols?: 2 | 3 | 4; children: ReactNode }) => {
    const colClass =
      cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
    return <div className={`grid grid-cols-1 ${colClass} gap-3`}>{children}</div>;
  }
);
StatGrid.displayName = "UIStatGrid";

export const PageContainer = memo(({ children }: { children: ReactNode }) => (
  <div className="space-y-3">{children}</div>
));
PageContainer.displayName = "UIPageContainer";

export const LoadingPlaceholder = memo(({ height = "h-48" }: { height?: string }) => (
  <div
    className={`rounded-2xl border border-neutral-800 bg-neutral-900/40 ${height} flex items-center justify-center`}
  >
    <div className="text-xs text-neutral-500 animate-pulse">carregando…</div>
  </div>
));
LoadingPlaceholder.displayName = "UILoadingPlaceholder";
