import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "outline" | "icon";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#1a365d] text-white hover:bg-[#122744] active:bg-[#0f2440] active:shadow-inner",
  secondary:
    "bg-[#64748b] text-white hover:bg-[#556275] active:bg-[#475569] active:shadow-inner",
  danger:
    "bg-[#dc2626] text-white hover:bg-[#c52020] active:bg-[#b91c1c] active:shadow-inner",
  success:
    "bg-[#047857] text-white hover:bg-[#036c4e] active:bg-[#065f46] active:shadow-inner",
  outline:
    "bg-transparent border-2 border-[#1a365d] text-[#1a365d] hover:bg-[#1a365d]/5 active:bg-[#1a365d]/10 active:shadow-inner",
  icon:
    "bg-transparent text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] active:bg-[#e2e8f0] active:shadow-inner",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-4 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-sm",
};

const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", icon, className = "", children, disabled, ...props }, ref) => {
    const isIconOnly = variant === "icon" || (!children && icon);

    const classes = [
      "inline-flex items-center justify-center font-bold uppercase tracking-wide",
      "transition-all duration-150 select-none",
      "disabled:opacity-50 disabled:pointer-events-none",
      VARIANT_CLASSES[variant],
      isIconOnly ? ICON_SIZE_CLASSES[size] : SIZE_CLASSES[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} className={classes} disabled={disabled} {...props}>
        {icon && <span className={children ? "mr-2" : ""}>{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
