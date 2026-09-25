import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
  type IBorderOptions,
} from "docx";
import type { SubmissionResume } from "./submission-resume";

const NAVY = "011C46";
const SLATE = "334155";
const MUTED = "667085";
const RULE: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 6,
  color: "E5E7EB",
  space: 1,
};

function textParagraph(
  text: string,
  opts?: {
    bold?: boolean;
    size?: number;
    color?: string;
    spacingAfter?: number;
    spacingBefore?: number;
  }
): Paragraph {
  return new Paragraph({
    spacing: {
      after: opts?.spacingAfter ?? 120,
      before: opts?.spacingBefore ?? 0,
    },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 20,
        color: opts?.color ?? SLATE,
        font: "Calibri",
      }),
    ],
  });
}

function sectionTitle(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: RULE },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 21,
        color: NAVY,
        font: "Calibri",
      }),
    ],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 360 },
    children: [
      new TextRun({
        text: `•  ${text}`,
        size: 20,
        color: SLATE,
        font: "Calibri",
      }),
    ],
  });
}

/** Editable Word deliverable for the optimized submission résumé. */
export async function renderSubmissionResumeDocx(resume: SubmissionResume): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: resume.fullName || "Candidate",
          bold: true,
          size: 36,
          color: NAVY,
          font: "Calibri",
        }),
      ],
    })
  );

  if (resume.headline) {
    children.push(textParagraph(resume.headline, { size: 22, color: SLATE, spacingAfter: 60 }));
  }

  const contact = [resume.location, resume.email, resume.phone].filter(Boolean).join("   ·   ");
  if (contact) {
    children.push(textParagraph(contact, { size: 18, color: MUTED, spacingAfter: 160 }));
  }

  if (resume.summary) {
    children.push(sectionTitle("Professional summary"));
    children.push(textParagraph(resume.summary, { spacingAfter: 120 }));
  }

  if (resume.skills.length) {
    children.push(sectionTitle("Core qualifications"));
    children.push(textParagraph(resume.skills.join("  ·  "), { spacingAfter: 120 }));
  }

  if (resume.experience.length) {
    children.push(sectionTitle("Relevant experience"));
    for (const job of resume.experience) {
      const heading = [job.title, job.company].filter(Boolean).join("  —  ");
      if (heading) {
        children.push(textParagraph(heading, { bold: true, size: 21, color: NAVY, spacingAfter: 40 }));
      }
      if (job.dates) {
        children.push(textParagraph(job.dates, { size: 18, color: MUTED, spacingAfter: 60 }));
      }
      for (const bullet of job.bullets) {
        if (bullet.trim()) children.push(bulletParagraph(bullet.trim()));
      }
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }

  if (resume.education.length) {
    children.push(sectionTitle("Education"));
    for (const item of resume.education) {
      const line = [item.credential, item.school, item.year].filter(Boolean).join("  —  ");
      if (line) children.push(textParagraph(line, { spacingAfter: 80 }));
    }
  }

  if (resume.licenses.length) {
    children.push(sectionTitle("Licenses & certifications"));
    for (const item of resume.licenses) {
      if (item.trim()) children.push(bulletParagraph(item.trim()));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
