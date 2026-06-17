export type FacilityFormInput = {
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  mailingAddress?: string;
  facilityType?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  notes?: string;
};

export type FacilityListItem = {
  id: string;
  name: string;
  primaryAddress: string;
  secondaryAddress: string;
  distance: string;
  assignedAt?: string | null;
  assignmentId?: string | null;
};

export type FacilityAssignmentsResponse = {
  active: FacilityListItem[];
  potential: FacilityListItem[];
  recent: FacilityListItem[];
  meta: FacilityAssignmentsMeta;
};

export type FacilityAssignmentsMeta = {
  tenantId: string;
  assignedFacilityIds: string[];
  totalTenantFacilities: number;
  unassignedCount: number;
  assignedCount: number;
};

export type CreateFacilityResult = {
  facility: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    about: string | null;
    created_at: string;
  };
  assigned: boolean;
  assignmentId?: string;
};

export type DuplicateFacilityResult = {
  duplicate: true;
  facility: FacilityListItem;
};

export type FacilityManagementItem = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  facilityType: string | null;
  createdAt: string;
  assignedCount: number;
};

export type FacilityAssignedWorker = {
  workerId: string;
  assignmentId: string;
  assignedAt: string;
  assignmentStatus: string;
  firstName: string | null;
  lastName: string | null;
  jobRole: string | null;
  status: string | null;
  city: string | null;
  state: string | null;
  location: string;
};

export type FacilitiesListResponse = {
  facilities: FacilityManagementItem[];
  meta: { tenantId: string; total: number };
};
