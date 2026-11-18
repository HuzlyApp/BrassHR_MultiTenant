export type FaqRow = {
  id: string;
  tenant_id: string | null;
  category: string;
  question: string;
  answer: string;
  sort_order?: number;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type FaqListItem = FaqRow & {
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type FaqUpsertInput = {
  category: string;
  question: string;
  answer: string;
  sortOrder?: number;
  isPublished?: boolean;
};
