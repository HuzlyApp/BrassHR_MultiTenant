"use client";

import { useRouter } from "next/navigation";
import {
  Award,
  BadgeDollarSign,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FileSignature,
  FileText,
  Fingerprint,
  GraduationCap,
  HandshakeIcon,
  IdCard,
  Mail,
  Package,
  PiggyBank,
  Pill,
  Search,
  ShieldCheck,
  Sparkles,
  Stamp,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import toast from "react-hot-toast";

import { WorkflowBuilder } from "@/app/components/workflow-builder";
import type { StepCategory, WorkflowState } from "@/app/components/workflow-builder";
import { DocumentIcon } from "@/app/components/workflow-builder/icons";

const STEP_LIBRARY: StepCategory[] = [
  {
    id: "custom-steps",
    label: "Custom Steps",
    steps: [
      {
        id: "custom-step",
        label: "Custom Step",
        icon: <DocumentIcon size={14} />,
        color: "customStepColor",
      },
    ],
  },
  {
    id: "application-profile",
    label: "Application & Profile",
    steps: [
      {
        id: "resume-basic-profile",
        label: "Resume & Basic Profile",
        icon: <DocumentIcon size={14} />,
        color: "resumeProfileColor",
      },
      {
        id: "parameterized-job-application",
        label: "Parameterized Job Application",
        icon: <Briefcase size={14} />,
        color: "jobApplicationColor",
      },
      {
        id: "references-collection",
        label: "References Collection",
        icon: <Users size={14} />,
        color: "customStepColor",
      },  
      {
        id: "skill-qualification-assessment",
        label: "Skill / Qualification Assessment",
        icon: <Award size={14} />,
        color: "skillQualificationAssessmentColor",
      },
      {
        id: "custom-application-form",
        label: "Custom Application Form",
        icon: <ClipboardList size={14} />,
        color: "customApplicationFormColor",
      },
    ],
  },
  {
    id: "document-esign",
    label: "Document & eSign",
    steps: [
      {
        id: "document-upload",
        label: "Document Upload",
        icon: <FileText size={14} />,
        color: "purple",
      },
      {
        id: "welcome-packet-esign",
        label: "Welcome Packet & eSign",
        icon: <Mail size={14} />,
        color: "pink",
      },
      {
        id: "i9-right-to-work-verification",
        label: "I-9 / Right to Work Verification",
        icon: <ShieldCheck size={14} />,
        color: "navy",
      },
      {
        id: "tax-forms",
        label: "Tax Forms (W-4 / State)",
        icon: <FileSignature size={14} />,
        color: "amber",
      },
      {
        id: "employee-agreement",
        label: "Employee Agreement / Contract eSign",
        icon: <Stamp size={14} />,
        color: "purple",
      },
      {
        id: "policy-acknowledgment",
        label: "Policy Acknowledgment",
        icon: <HandshakeIcon size={14} />,
        color: "rose",
      },
      {
        id: "equipment-badge-acknowledgment",
        label: "Equipment / Badge Acknowledgment",
        icon: <Package size={14} />,
        color: "navy",
      },
    ],
  },
  {
    id: "screening-compliance",
    label: "Screening & Compliance Steps",
    steps: [
      {
        id: "background-check",
        label: "Background Check",
        icon: <ShieldCheck size={14} />,
        color: "navy",
      },
      {
        id: "drug-test-screening",
        label: "Drug Test / Screening",
        icon: <Pill size={14} />,
        color: "teal",
      },
      {
        id: "oig-exclusion-check",
        label: "OIG / Exclusion Check",
        icon: <Search size={14} />,
        color: "indigo",
      },
      {
        id: "reference-verification",
        label: "Reference Verification",
        icon: <UserCheck size={14} />,
        color: "slate",
      },
      {
        id: "credential-license-verification",
        label: "Credential / License Verification",
        icon: <IdCard size={14} />,
        color: "purple",
      },
      {
        id: "ssn-identity-verification",
        label: "SSN / Identity Verification",
        icon: <Fingerprint size={14} />,
        color: "rose",
      },
    ],
  },
  {
    id: "payroll-financial",
    label: "Payroll & Financial Steps",
    steps: [
      {
        id: "direct-deposit-setup",
        label: "Direct Deposit Setup",
        icon: <CreditCard size={14} />,
        color: "amber",
      },
      {
        id: "benefits-enrollment",
        label: "Benefits Enrollment / Selection",
        icon: <ClipboardCheck size={14} />,
        color: "green",
      },
      {
        id: "401k-enrollment",
        label: "401K / Retirement Enrollment",
        icon: <PiggyBank size={14} />,
        color: "navy",
      },
      {
        id: "pay-rate-hire-date",
        label: "Pay Rate & Hire Date Entry",
        icon: <Calendar size={14} />,
        color: "teal",
      },
      {
        id: "payroll-profile-creation",
        label: "Payroll Profile Creation",
        icon: <BadgeDollarSign size={14} />,
        color: "purple",
      },
    ],
  },
  {
    id: "training-development",
    label: "Training & Development Steps",
    steps: [
      {
        id: "safety-training",
        label: "Safety Training",
        icon: <Dumbbell size={14} />,
        color: "rose",
      },
      {
        id: "training-modules-quiz",
        label: "Training Modules + Quiz",
        icon: <BookOpen size={14} />,
        color: "indigo",
      },
      {
        id: "orientation-video",
        label: "Orientation / Onboarding Video",
        icon: <Video size={14} />,
        color: "pink",
      },
      {
        id: "compliance-training",
        label: "Compliance Training",
        icon: <ShieldCheck size={14} />,
        color: "green",
      },
      {
        id: "certification-upload",
        label: "Certification Upload / Renewal",
        icon: <GraduationCap size={14} />,
        color: "amber",
      },
      {
        id: "compliance-final",
        label: "Compliance Final Check",
        icon: <CheckCircle2 size={14} />,
        color: "green",
      },
    ],
  },
];

export default function OnboardingBuilderPage() {
  const router = useRouter();

  const handleSave = (_state: WorkflowState) => {
    toast.success("Saved as template");
  };

  const handlePreview = (_state: WorkflowState) => {
    toast("Preview coming soon");
  };

  const handlePublish = (_state: WorkflowState) => {
    toast.success("Published to all new hires");
  };

  const handleExport = (_state: WorkflowState) => {
    toast("Export started");
  };

  return (
    <WorkflowBuilder
      title="Standard Hiring"
      subtitle="New Hire: Pre-Offer (ATS)"
      productName="Onboarding Builder"
      brandName="braas HR"
      stepLibrary={STEP_LIBRARY}
      lastUpdated={{ author: "Sam Smith", minutesAgo: 4 }}
      onBack={() => router.push("/braas-hr/dashboard/onboarding-flows")}
      onSaveAsTemplate={handleSave}
      onPreview={handlePreview}
      onPublish={handlePublish}
      onExportPDF={handleExport}
      onAddTrigger={() => toast("Add a trigger to start this flow")}
    />
  );
}
