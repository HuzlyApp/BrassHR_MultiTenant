/** Shared mobile layout classes for skill quiz pages (see basic-care). */
export const SKILL_QUIZ_SHELL_CLASS =
  "flex h-full min-w-0 flex-col px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 min-[1200px]:px-10"

export const SKILL_QUIZ_CONTENT_CLASS = "flex flex-1 flex-col pt-6 sm:pt-8"

/** Keeps 1–4 rating columns aligned with the header on narrow screens. */
export const QUIZ_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-x-2 min-[1200px]:grid-cols-[minmax(0,1fr)_9.5rem] min-[1200px]:items-center min-[1200px]:gap-x-4"

export const RATING_TRACK_GRID = "grid w-full grid-cols-4 justify-items-center gap-0.5 min-[1200px]:gap-6"
