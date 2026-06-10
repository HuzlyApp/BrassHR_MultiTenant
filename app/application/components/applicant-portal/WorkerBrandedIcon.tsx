import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { WORKER_BRAND_ICON_COLOR, WORKER_ICON_SIZE_CLASS } from "./worker-icons";

type WorkerBrandedIconProps = {
  src: string;
  className?: string;
};

export function WorkerBrandedIcon({ src, className = WORKER_ICON_SIZE_CLASS }: WorkerBrandedIconProps) {
  return (
    <BrandedSvgIcon
      src={src}
      className={`block ${className}`}
      color={WORKER_BRAND_ICON_COLOR}
    />
  );
}