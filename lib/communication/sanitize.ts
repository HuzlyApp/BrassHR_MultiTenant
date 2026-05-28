const EMAIL_SUBJECT_MAX = 500;
const EMAIL_BODY_MAX = 50_000;
const SMS_BODY_MAX = 1600;

export function sanitizeEmailSubject(subject: string): string {
  return subject.replace(/\0/g, "").trim().slice(0, EMAIL_SUBJECT_MAX);
}

export function sanitizeEmailBody(body: string): string {
  return body.replace(/\0/g, "").trim().slice(0, EMAIL_BODY_MAX);
}

export function sanitizeSmsBody(body: string): string {
  return body.replace(/\0/g, "").trim().slice(0, SMS_BODY_MAX);
}

export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.5;">${escaped.replace(/\n/g, "<br />")}</div>`;
}
