import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  href?: string | null;
}

export function Logo({ className, href = "/" }: LogoProps) {
  const image = (
    <Image
      src="/logo.png"
      alt="Blistrip"
      width={530}
      height={262}
      className={cn("h-16 w-auto", className)}
      priority
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {image}
      </Link>
    );
  }

  return image;
}
