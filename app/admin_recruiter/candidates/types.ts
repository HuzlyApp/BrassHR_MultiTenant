export type CandidateRow = {
  id: string
  name: string
  firstName: string
  lastName: string
  role: string
  email: string
  phone: string
  /** Full line for "Location" column */
  address: string
  city: string
  state: string
  zip: string
  address1: string
  address2: string
  status: string
  createdAt: string | null
  reference: string
  dateOfBirth: string | null
}
