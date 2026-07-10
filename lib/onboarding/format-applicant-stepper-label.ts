/**
 * Formats tenant step titles for the applicant stepper (2 lines max, no orphan "/").
 */
export function formatApplicantStepperLabel(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return trimmed

  // "Authorization / Background Check" → "Authorization\nBackground Check"
  const slashParts = trimmed.split(/\s+\/\s+/)
  if (slashParts.length === 2) {
    const [line1, line2] = slashParts.map((part) => part.trim())
    if (line1 && line2) return `${line1}\n${line2}`
  }

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 2) {
    return `${words[0]}\n${words[1]}`
  }

  if (words.length > 2) {
    return `${words[0]}\n${words.slice(1).join(" ")}`
  }

  return trimmed
}
