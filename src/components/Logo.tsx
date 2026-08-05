import rankbrumLogo from "@/assets/rankbrum-logo.png.asset.json";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  showTitle?: boolean;
  iconSize?: number;
}

export const Logo = ({ iconSize = 96, className = "", width, height }: LogoProps) => {
  const size = width ?? height ?? iconSize;
  return (
    <img
      src={rankbrumLogo.url}
      alt="Rankbrum.AI"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
};
