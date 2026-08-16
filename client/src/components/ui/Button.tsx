/**
 * Shared button components for consistent styling across the app.
 * Consolidates 11+ repeated button class patterns.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "warning";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border-amber-400/30 bg-amber-400/10 text-amber-200/90 hover:bg-amber-400/20 hover:text-amber-100",
  secondary: "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
  danger: "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  warning: "border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3 py-1.5 text-[10px] sm:text-xs",
  md: "min-h-[44px] px-4 py-2 text-xs",
  lg: "min-h-[48px] px-6 py-3 text-sm",
};

/**
 * Primary rounded button with consistent mobile touch target (44px min-height).
 */
export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        flex items-center justify-center rounded-full border font-medium
        backdrop-blur-md transition-all duration-150
        hover:scale-105 active:scale-95
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `.trim().replace(/\s+/g, " ")}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Icon-only button (square with rounded corners).
 */
export function IconButton({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        flex min-h-[44px] min-w-[44px] items-center justify-center
        rounded-full border backdrop-blur-md transition-all duration-150
        hover:scale-105 active:scale-95
        ${variantClasses[variant]}
        ${className}
      `.trim().replace(/\s+/g, " ")}
      {...props}
    >
      {children}
    </button>
  );
}
