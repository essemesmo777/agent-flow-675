interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  showTitle?: boolean;
  iconSize?: number;
}

export const Logo = ({ iconSize = 96, className = "", width, height }: LogoProps) => {
  if (width) {
    return (
      <img
        src="/rankbrum-logo.png"
        alt="Rankbrum.AI"
        width={width}
        height={height}
        className={`w-full max-w-[${width}px] h-auto object-contain ${className}`}
      />
    );
  }

  const size = height ?? iconSize;
  return (
    <img
      src="/rankbrum-logo.png"
      alt="Rankbrum.AI"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
};
