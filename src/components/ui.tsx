import * as React from "react";

export function Card({
  title,
  subtitle,
  children
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
      {(title || subtitle) && (
        <div className="mb-3">
          {title && <div className="text-lg font-semibold">{title}</div>}
          {subtitle && <div className="text-sm text-white/70">{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary"
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const base =
    "inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-semibold transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-blue-500 text-white hover:bg-blue-400"
      : "bg-white/10 text-white hover:bg-white/15";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-white/80">{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white outline-none placeholder:text-white/40 focus:border-white/20"
      />
    </label>
  );
}

