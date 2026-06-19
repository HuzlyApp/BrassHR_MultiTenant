export type FaqRow = {
  id: string;
  tenant_id: string | null;
  category: string;
  question: string;
  answer: string;
};

export type FaqListItem = FaqRow & {
  created_at: string;
};
