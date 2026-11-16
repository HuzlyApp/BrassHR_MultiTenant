"use client";

import Link from "next/link";
import { ArrowRight, FileSignature, Mail, Workflow } from "lucide-react";

interface TemplateHubCard {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof FileSignature;
}

const TEMPLATE_CARDS: TemplateHubCard[] = [
  {
    title: "Document templates",
    description:
      "Browse uncategorized templates and libraries, create folders, and open the document template builder.",
    href: "/admin_recruiter/template-builder",
    cta: "Open Templates",
    icon: FileSignature,
  },
  {
    title: "Email templates",
    description: "Edit messages sent to candidates and staff.",
    href: "/admin_recruiter/email-templates",
    cta: "Open email templates",
    icon: Mail,
  },
  {
    title: "Onboarding templates",
    description: "Manage templates used in hiring workflows.",
    href: "/admin_recruiter/dashboard/templates",
    cta: "Open onboarding templates",
    icon: Workflow,
  },
];

export default function TemplatesSettingsPanel() {
  return (
    <div className="flex flex-col gap-4">
      
      {TEMPLATE_CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-start gap-4 rounded-xl border border-[#EAECF0] bg-white p-5 transition-all duration-150 hover:border-[#D0D5DD] hover:shadow-sm"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F2F4F7] text-[#012352]">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[#101828] transition-colors group-hover:text-[color:var(--brand-primary,#012352)] sm:text-base">
                {card.title}
              </h2>
              <p className="mt-1 text-xs text-[#667085] sm:text-sm">{card.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-primary,#012352)]">
                {card.cta}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
