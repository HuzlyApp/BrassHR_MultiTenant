"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { applicationPath } from "@/lib/tenant/with-tenant";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Next.js Link that preserves `?tenant=` for application routes. */
export default function TenantApplicationLink({ href, ...rest }: Props) {
  return <Link href={applicationPath(href)} {...rest} />;
}
