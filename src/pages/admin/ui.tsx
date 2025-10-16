// src/pages/admin/ui.tsx
// Lightweight design helpers to improve visuals without touching your data logic.
// Drop-in: create this file, import pieces gradually. No deps beyond Tailwind.

import * as React from "react";

/* ----------------------------------------------------
   Utilities
---------------------------------------------------- */
export const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

/* ----------------------------------------------------
   Primitives
---------------------------------------------------- */
export function Card({
  title,
  subtitle,
  toolbar,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-white rounded-2xl border shadow-sm", className)}>
      {(title || toolbar) && (
        <header className="flex items-start gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b">
          <div className="min-w-0">
            {title && <h3 className="font-semibold leading-none truncate">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-neutral-500 truncate">{subtitle}</p>}
          </div>
          {toolbar && <div className="ml-auto flex shrink-0 items-center gap-2">{toolbar}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Button({
  variant = "default",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "soft" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "h-8 px-2.5 text-xs",
    md: "h-9 px-3 text-sm",
    lg: "h-10 px-4",
  } as const;
  const variants = {
    default: "bg-white text-neutral-900 border hover:bg-neutral-50",
    primary: "bg-neutral-900 text-white hover:bg-neutral-800",
    soft: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100",
  } as const;
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "solid" | "outline" | "success" | "warning" | "danger";
  className?: string;
}) {
  const base = "inline-flex items-center rounded-full text-[11px] px-2 py-0.5";
  const variants = {
    default: "bg-neutral-100 text-neutral-900",
    solid: "bg-neutral-900 text-white",
    outline: "border text-neutral-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-900",
    danger: "bg-red-100 text-red-800",
  } as const;
  return <span className={cn(base, variants[variant], className)}>{children}</span>;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border px-3 py-2 text-sm bg-white",
          "focus:outline-none focus:ring-2 focus:ring-neutral-400",
          "placeholder:text-neutral-400",
          className
        )}
        {...props}
      />
    );
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-xl border px-3 py-2 text-sm bg-white",
          "focus:outline-none focus:ring-2 focus:ring-neutral-400",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border px-3 py-2 text-sm bg-white",
          "focus:outline-none focus:ring-2 focus:ring-neutral-400",
          className
        )}
        {...props}
      />
    );
  }
);

/* ----------------------------------------------------
   Layout helpers
---------------------------------------------------- */
export function Toolbar({ left, right, className }: { left?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="min-w-0 flex-1">{left}</div>
      <div className="flex gap-2">{right}</div>
    </div>
  );
}

export function KPI({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-white border rounded-2xl px-4 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-3xl font-semibold leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-neutral-500 mt-1">{hint}</div>}
    </div>
  );
}

/* ----------------------------------------------------
   Scroll shadow for long lists (pure UI)
---------------------------------------------------- */
export function ScrollArea({ height = 360, children }: { height?: number; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = React.useState(true);
  const [atBottom, setAtBottom] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const onScroll = () => {
      setAtTop(el.scrollTop <= 0);
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    };
    onScroll();
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative">
      <div ref={ref} style={{ maxHeight: height }} className="overflow-auto pr-1">
        {children}
      </div>
      {!atTop && <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white/90 to-transparent" />}
      {!atBottom && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white/90 to-transparent" />}
    </div>
  );
}

/* ----------------------------------------------------
   Quick style tokens (optional): paste into src/index.css
----------------------------------------------------
@layer utilities {
  .ring-focus { @apply focus:outline-none focus:ring-2 focus:ring-neutral-400; }
  .card      { @apply bg-white border rounded-2xl shadow-sm; }
  .btn       { @apply inline-flex items-center justify-center rounded-xl text-sm px-3 py-1.5 border transition-colors; }
  .btn-ghost { @apply btn bg-transparent hover:bg-neutral-100; }
  .btn-dark  { @apply btn bg-neutral-900 text-white hover:bg-neutral-800; }
  .btn-soft  { @apply btn bg-neutral-100 hover:bg-neutral-200; }
  .badge     { @apply inline-flex items-center rounded-full text-[11px] px-2 py-0.5 bg-neutral-100; }
}
---------------------------------------------------- */
