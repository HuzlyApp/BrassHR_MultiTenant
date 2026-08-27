export type LegalSection = {
  title: string
  paragraphs: string[]
}

export type LegalDocument = {
  title: string
  lastUpdated: string | null
  sections: LegalSection[]
}
