const Logo = ({ className = "", size = "default" }: { className?: string; size?: "small" | "default" | "large" }) => {
  const sizeClasses = {
    small: "text-xl",
    default: "text-2xl",
    large: "text-4xl"
  };

  return (
    <div className={`font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent ${sizeClasses[size]} ${className}`}>
      Floe
    </div>
  );
};

export default Logo;
