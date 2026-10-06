import Image from "next/image";

/**
 * Brochure photo treatment: square corners, no border/shadow/filter, cropped
 * to a fixed aspect so layouts don't shift. `className` sets size/aspect.
 */
export function Photo({
  src,
  alt,
  sizes,
  className = "",
  imgClassName = "",
  preload = false,
  children,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  preload?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden bg-sage ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} preload={preload} className={`object-cover ${imgClassName}`} />
      {children}
    </div>
  );
}
