import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number;
};

export function DocumentIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 13 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8.19995 0.85022V1.90022C8.19995 2.89002 8.19995 3.38492 8.50795 3.69222C8.81455 4.00022 9.30945 4.00022 10.3 4.00022H11.35"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.3 6.80024H8.9M3.3 8.90024H8.9M3.3 11.0002H6.219M0.5 10.3002V4.70024C0.5 2.72064 0.5 1.73014 1.1153 1.11554C1.7299 0.500244 2.7204 0.500244 4.7 0.500244H7.6204C7.906 0.500244 8.0495 0.500244 8.1783 0.553444C8.3064 0.606644 8.4079 0.707444 8.6102 0.910444L11.2898 3.59004C11.4928 3.79304 11.5936 3.89384 11.6468 4.02264C11.7 4.15074 11.7 4.29424 11.7 4.57984V10.3002C11.7 12.2798 11.7 13.2703 11.0847 13.8849C10.4701 14.5002 9.4796 14.5002 7.5 14.5002H4.7C2.7204 14.5002 1.7299 14.5002 1.1153 13.8849C0.5 13.2703 0.5 12.2798 0.5 10.3002Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
