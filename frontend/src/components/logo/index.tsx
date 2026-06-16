import { INFO } from "@/constants";
import { cn } from "@/lib/utils";
import github from "@/assets/logos/svg/github.svg";
import linkedin from "@/assets/logos/svg/linkedin.svg";
import logo from "@/assets/logo.svg";
import { useTheme } from "../shared/theme-provider";


interface LogoProps {
  src: string;
  alt?: string;
  className?: string;
  variant?: "light" | "dark";
}

export const LogoComponent = ({
  src,
  alt,
  className,
  variant,
}: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2 h-8", className)}>
      <img
        src={src}
        alt={alt || INFO.companyName}
        className={cn(
          "h-full w-auto object-contain",
          variant === "dark" && "invert opacity-90"
        )}
      />
    </div>
  );
};

export const GithubLogo = (props: Omit<LogoProps, "src">) => {
  const { theme } = useTheme();
  const variant = props.variant || (theme === "dark" ? "dark" : "light");
  return <LogoComponent src={github} {...props} variant={variant} />;
};

export const LinkedinLogo = (props: Omit<LogoProps, "src">) => {
  const { theme } = useTheme();
  const variant = props.variant || (theme === "dark" ? "dark" : "light");
  return <LogoComponent src={linkedin} {...props} variant={variant} />;
};

export const Logo = (props: Omit<LogoProps, "src">) => {
  const { theme } = useTheme();
  const variant = props.variant || (theme === "dark" ? "light" : "dark");
  return <LogoComponent src={logo} {...props} variant={variant} />;
};

export const LogoIcon = (props: Omit<LogoProps, "src">) => {
  const { theme } = useTheme();
  const variant = props.variant || (theme === "dark" ? "light" : "dark");
  return <LogoComponent src="/favicon.svg" {...props} variant={variant} />;
};