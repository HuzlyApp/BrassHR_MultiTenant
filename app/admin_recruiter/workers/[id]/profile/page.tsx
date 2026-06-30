import { AdminWorkerProfileClient } from "./AdminWorkerProfileClient";

export default async function AdminWorkerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminWorkerProfileClient workerId={id} />;
}
