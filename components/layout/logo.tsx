import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Trimmed wordmark asset — 438×119 after removing square PNG padding. */
const LOGO_WIDTH = 438;
const LOGO_HEIGHT = 119;

interface LogoProps {
  className?: string;
  href?: string | null;
  /** Visual height of the wordmark (header stays fixed). */
  size?: "nav" | "footer";
}

export function Logo({ className, href = "/", size = "nav" }: LogoProps) {
  const image = (
    <Image
      src="/logo.png"
      alt="Blistrip"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={cn(
        "w-auto object-contain object-left",
        size === "footer" ? "h-[37px] sm:h-[44px]" : "h-[33px] sm:h-[37px]",
        // Source art is light-on-dark; invert for the ivory site theme.
        "brightness-0 opacity-[0.88]",
        className
      )}
      priority={size === "nav"}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center">
        {image}
      </Link>
    );
  }

  return image;
}
