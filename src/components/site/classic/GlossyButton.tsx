import { forwardRef, type ButtonHTMLAttributes } from "react";

import { blocky, glossyGold } from "../../../lib/shape";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "ghost";
  size?: "md" | "lg";
}

const sizes = {
  md: "px-6 py-3 text-sm",
  lg: "px-9 py-4 text-base",
};

const GlossyButton = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "gold", size = "md", className = "", children, ...rest }, ref) => {
    if (variant === "ghost") {
      return (
        <button
          ref={ref}
          className={`${blocky} ${sizes[size]} font-semibold tracking-wide text-gold-bright border border-gold/40 bg-ink/40 hover:border-gold/80 hover:bg-ink/70 transition-all duration-300 ${className}`}
          {...rest}
        >
          {children}
        </button>
      );
    }

    return (
      <button
        ref={ref}
        className={`group relative ${blocky} ${sizes[size]} font-bold tracking-wide text-on-gold ${glossyGold} transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.99] ${className}`}
        {...rest}
      >
        <span className="relative z-10">{children}</span>
        {/* Hover shine */}
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ borderRadius: "inherit" }}
        >
          <span className="absolute -inset-y-4 -left-1/2 w-1/3 rotate-12 bg-white/40 blur-md opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-700 ease-out" />
        </span>
      </button>
    );
  },
);

GlossyButton.displayName = "GlossyButton";
export default GlossyButton;