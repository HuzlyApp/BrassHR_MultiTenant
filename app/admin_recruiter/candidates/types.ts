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
  /** Raw pipeline/employment status key used for claim eligibility. */
  statusKey?: string | null
  /** Latest job-application pipeline status (All candidates Progress Status). */
  progressStatusApplicationId?: string | null
  progressStatusId?: string | null
  progressStatusName?: string | null
  progressStatusKey?: string | null
  progressStatusAmbiguous?: boolean
  createdAt: string | null
  reference: string
  dateOfBirth: string | null
  profilePhotoUrl?: string | null
  appliedJobCount?: number
  assignedRecruiterUserId?: string | null
  assignedRecruiterName?: string | null
  applicationJobTitle?: string | null
  applicationJobTitlesText?: string | null
  applicationSearchText?: string | null
  matchApplicationId?: string | null
  aiMatchStatus?: string | null
  aiMatchScore?: number | null
  aiMatchCategory?: string | null
  aiMatchDisplayCategory?: string | null
}
