export function splitSkillQuestionDetail(
  question: string,
  description?: string | null
): { title: string; detail: string | null } {
  if (description?.trim()) {
    const clean = description.trim();
    const withBrackets =
      clean.startsWith("(") && clean.endsWith(")")
        ? clean
        : `(${clean.replace(/^\(+|\)+$/g, "")})`;
    return { title: question, detail: withBrackets };
  }

  const match = question.match(/^(.*?)(\s*\(.*\))$/);
  if (!match) {
    return { title: question, detail: null };
  }

  return {
    title: match[1].trim(),
    detail: match[2].trim(),
  };
}
