import { motion } from "motion/react";
import React from "react";
import { cn } from "../lib/utils";

export type CardProps = React.PropsWithChildren<React.ComponentProps<typeof motion.div>>;

export function Card({ children, className, ...props }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-surface backdrop-blur-md border border-border p-8 rounded-sm shadow-[0_10px_40px_rgba(0,0,0,0.3)] relative",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PanelBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute -top-3 left-8 bg-bg border border-accent-yellow text-accent-yellow px-3 py-1 font-oswald text-xs uppercase tracking-[0.1em] -rotate-2 z-10">
      {children}
    </div>
  );
}

export type ButtonProps = React.PropsWithChildren<React.ComponentProps<"button">> & {
  variant?: 'primary' | 'outline' | 'danger';
};

export function Button({ children, className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "px-6 py-3 font-oswald font-bold uppercase tracking-[0.05em] transition-all duration-300 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
        variant === 'primary' && "bg-accent-yellow text-bg hover:bg-[#f0c56f] hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(232,186,94,0.3)]",
        variant === 'outline' && "bg-transparent border border-accent-pink text-accent-pink hover:bg-accent-pink-glow hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(212,113,127,0.3)]",
        variant === 'danger' && "bg-danger/10 border border-danger text-danger hover:bg-danger/20 hover:-translate-y-0.5",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "bg-black/40 border border-border text-text-primary px-4 py-3 font-space rounded-sm transition-all duration-300 w-full placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed",
        "glow-focus",
        props.className
      )}
    />
  );
}
