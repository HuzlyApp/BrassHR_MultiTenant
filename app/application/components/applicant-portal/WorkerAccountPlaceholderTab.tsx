"use client";

import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

type WorkerAccountPlaceholderTabProps = {
  title: string;
  description: string;
};

export function WorkerAccountPlaceholderTab({ title, description }: WorkerAccountPlaceholderTabProps) {
  return (
    <section className={`${WORKER_SCHEDULE_CARD_CLASS} p-8 text-center`}>
      <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7280]">{description}</p>
      <p className="mt-4 text-sm font-medium text-[#9CA3AF]">Coming soon</p>
    </section>
  );
}
