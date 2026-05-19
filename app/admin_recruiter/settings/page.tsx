import OnboardingStepsBuilderPanel from "@/app/components/onboarding/OnboardingStepsBuilderPanel";

export default function AdminRecruiterSettingsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A]">Worker onboarding</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Enable, reorder, and customize the steps applicants complete. Changes apply to new applications immediately.
        </p>
      </div>
      <OnboardingStepsBuilderPanel mode="admin-settings" />
    </main>
  );
}
