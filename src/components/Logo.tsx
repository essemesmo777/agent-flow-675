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
        style={{ width, height: height ?? "auto", maxWidth: "100%" }}
        className={`object-contain ${className}`}
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
