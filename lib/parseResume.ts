import * as pdfjs from "pdfjs-dist"

export async function extractPDFText(base64: string) {

  const raw = base64.split(",")[1]

  const buffer = Buffer.from(raw, "base64")

  const pdf = await pdfjs.getDocument({ data: buffer }).promise

  let text = ""

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i)

    const content = await page.getTextContent()

    const strings = content.items
      .map((item) => {
        if ("str" in item) return item.str
        return ""
      })
      .join(" ")

    text += strings + " "
  }

  return text
}