import { Bot } from "lucide-react";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  showTitle?: boolean;
  iconSize?: number;
}

export const Logo = ({ iconSize = 96, className = "", showTitle = true, width, height }: LogoProps) => {
  const size = width ?? height ?? iconSize;
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <Bot size={size} className="text-primary" strokeWidth={1.75} />
      {showTitle && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Plataforma de IA
          </span>
          <span className="font-sans font-bold uppercase tracking-tight leading-none text-primary text-5xl">
            Q7 Pipeline
          </span>
        </div>
      )}
    </div>
  );
};
