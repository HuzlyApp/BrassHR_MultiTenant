// components/layout/DashboardLayout.tsx
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}