import type { CSSProperties } from "react"

/** Same SVG artwork as `/icons/*.svg`, tinted with tenant primary. */
export default function BrandedSvgIcon({
  src,
  className,
  color,
}: {
  src: string
  className?: string
  color: string
}) {
  // Quote + encode so commas/spaces in filenames (e.g. sidebar Figma assets) do not break CSS url().
  const maskSrc = `url("${encodeURI(src)}")`;

  const maskStyle: CSSProperties = {
    backgroundColor: color,
    WebkitMaskImage: maskSrc,
    maskImage: maskSrc,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  }

  return <span className={`inline-block shrink-0 ${className ?? ""}`} style={maskStyle} aria-hidden />
}
