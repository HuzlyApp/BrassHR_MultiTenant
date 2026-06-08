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
  const maskStyle: CSSProperties = {
    backgroundColor: color,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  }

  return <span className={`inline-block shrink-0 ${className ?? ""}`} style={maskStyle} aria-hidden />
}
