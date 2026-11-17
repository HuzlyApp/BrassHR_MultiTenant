import RoleEditorClient from "@/app/admin_recruiter/settings/RoleEditorClient";

type PageProps = {
  params: Promise<{ roleKey: string }>;
};

export default async function EditCustomRolePage({ params }: PageProps) {
  const { roleKey } = await params;
  return <RoleEditorClient mode="edit" roleKey={decodeURIComponent(roleKey)} />;
}
