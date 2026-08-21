import type { SkillAssessmentCatalog, SkillCategoryDraft, SkillQuestionDraft } from "@/lib/skill-assessment/types";
import { DEFAULT_SKILL_ASSESSMENT_CATALOG_FLAGS, DEFAULT_SKILL_ASSESSMENT_SCORING } from "@/lib/skill-assessment/types";
import { splitSkillQuestionDetail } from "@/lib/skill-assessment/question-display";

type SeedQuestion = { id: string; quizNumber: number; question: string };

function ratingQuestion(seed: SeedQuestion): SkillQuestionDraft {
  const display = splitSkillQuestionDetail(seed.question, null);
  return {
    id: seed.id,
    text: display.title,
    description: display.detail,
    type: "rating",
    required: true,
    sortOrder: seed.quizNumber,
    points: 1,
    options: [],
    correctAnswer: null,
  };
}

function category(
  id: string,
  slug: string,
  name: string,
  description: string,
  sortOrder: number,
  questions: SeedQuestion[]
): SkillCategoryDraft {
  return {
    id,
    name,
    description,
    instructions: null,
    slug,
    sortOrder,
    isActive: true,
    questions: questions
      .slice()
      .sort((a, b) => a.quizNumber - b.quizNumber)
      .map(ratingQuestion),
  };
}

/** Default catalog IDs match the global `skill_categories` / `skill_questions` seed so existing answers keep mapping. */
export function createDefaultSkillAssessmentCatalog(): SkillAssessmentCatalog {
  return {
    enabled: DEFAULT_SKILL_ASSESSMENT_CATALOG_FLAGS.enabled,
    allowSkip: DEFAULT_SKILL_ASSESSMENT_CATALOG_FLAGS.allowSkip,
    scoring: { ...DEFAULT_SKILL_ASSESSMENT_SCORING },
    categories: [
      category(
        "880c1f95-f033-4ab7-9b5f-1721564901b0",
        "basic-care",
        "Basic Patient Care & Hygiene",
        "Compassionate daily support and safe personal care practices.",
        1,
        [
          {
            id: "54db3f8c-b518-47af-ad6c-51d17a046502",
            quizNumber: 1,
            question:
              "Activities of daily living (bathing: sitz, tub, bed, shower; mouth care; nail care; elimination needs)",
          },
          {
            id: "93b165b2-7aff-4aab-bc73-34f64a16f9ec",
            quizNumber: 2,
            question: "Body alignment and positioning (includes range of motion)",
          },
          {
            id: "3da1a63a-47a0-4e74-a2f6-1f9ff61561a3",
            quizNumber: 3,
            question: "Skin care (includes decubitus care)",
          },
          { id: "6b4ae8e9-3856-4545-9176-9bc4a538b41e", quizNumber: 4, question: "Nutritional check and support" },
          { id: "088dda1c-3cbf-4bc9-bb96-41cb94943385", quizNumber: 5, question: "Provide comfort, safety, and privacy" },
          { id: "4b21af6f-5ec2-42c2-b1f8-faf0a1777429", quizNumber: 6, question: "Hand hygiene" },
          { id: "68d588ef-243b-4ee3-9822-4ecb470f2a07", quizNumber: 7, question: "Restraints (use and monitoring)" },
          {
            id: "0c7b5326-1259-45ec-a4e2-5b4f397053d9",
            quizNumber: 8,
            question: "Enemas (cleansing, retention, Harris flush) and suppositories",
          },
          {
            id: "1268e140-4c81-48de-9bb7-750738fc5ddf",
            quizNumber: 9,
            question: "Ear drops and topical medication application",
          },
          { id: "5f1b95de-bd19-49e7-b646-1586f24e42f1", quizNumber: 10, question: "Binders" },
        ]
      ),
      category(
        "030beb6c-df9f-4d51-a5cc-10c4620b1a85",
        "mobility",
        "Mobility, Positioning & Patient Handling",
        "Safe movement, transfers, and patient handling.",
        2,
        [
          { id: "cf16fa68-dbb7-4782-94d1-d041f4cfce26", quizNumber: 1, question: "Ambulation (includes crutch walking)" },
          {
            id: "11367940-ac3f-4de7-b0db-5a3e177a75c8",
            quizNumber: 2,
            question: "Patient transfer and transport (wheelchair, gurney, chair)",
          },
          {
            id: "ec403678-e05d-466c-8973-f6a3f2546d63",
            quizNumber: 3,
            question: "Body systems review (head-to-toe data collection)",
          },
          { id: "337136e4-2c9d-45fe-8b0d-6edfd7271385", quizNumber: 4, question: "Cast care and traction" },
          { id: "4289844a-bfbe-44df-bf83-8565b15975ab", quizNumber: 5, question: "Application of heat and cold" },
          { id: "9c73bb2d-804b-4220-9bd9-8e82720b06de", quizNumber: 6, question: "Pre-op and post-op care" },
          { id: "33b269a3-df29-46bc-b9c6-57d2d7b68518", quizNumber: 7, question: "Surgical preps" },
          { id: "3387fbe9-d7c7-45ae-9b9b-9ef359aeb499", quizNumber: 8, question: "Bandaging and dressing (sterile)" },
        ]
      ),
      category(
        "e363b853-8c53-4b63-88fb-dd2a3003ba87",
        "clinical",
        "Clinical Skills & Procedures",
        "Core clinical procedures and treatments.",
        3,
        [
          {
            id: "11758df1-0ad1-4e9b-8494-271202e2f1ec",
            quizNumber: 1,
            question: "Administration of medication (oral, IM, SQ; dosage computation)",
          },
          { id: "b54eb702-033f-4478-9337-82651292e0be", quizNumber: 2, question: "Catheterization / Foley catheter care" },
          { id: "a0a9699d-6f4d-4d60-8409-148c44e682b5", quizNumber: 3, question: "Colostomy care and irrigation" },
          { id: "0494e827-4972-492d-af1b-38eb8464e61f", quizNumber: 4, question: "IV monitoring and infusion site checks" },
          { id: "19b36c33-f799-4c51-88c3-c8bdca724540", quizNumber: 5, question: "Oxygen administration and pulse oximetry" },
          { id: "d940d504-bb21-40b3-b367-c9b965bb7a51", quizNumber: 6, question: "Oral suction and tracheostomy suctioning" },
          { id: "f881f6a0-c50e-4d56-b820-e9663a109e10", quizNumber: 7, question: "Diabetic testing and monitoring" },
          { id: "13c8c1a8-8720-4d56-bc75-7c51e114d16b", quizNumber: 8, question: "Vital signs and weight monitoring" },
          { id: "c3eb6f72-dc7e-41d8-9195-80a4701d91a7", quizNumber: 9, question: "Neurological check" },
          { id: "dbb4eb11-bcd5-4145-ae12-e82cce611970", quizNumber: 10, question: "Postural drainage" },
        ]
      ),
      category(
        "a86761a6-2751-42ab-9f75-6fc80117977e",
        "monitoring",
        "Assessment, Monitoring & Emergency Response",
        "Observation, monitoring, and emergency response.",
        4,
        [
          {
            id: "4e7df2a9-b2fa-4b99-87ac-c137d1cc6b9a",
            quizNumber: 1,
            question: "Patient observation and monitoring for body system changes",
          },
          { id: "b8c9ec37-08da-4203-a37e-df31f2764030", quizNumber: 2, question: "Pain assessment" },
          { id: "01ffebde-2282-4bc2-8b4d-779636fc2c7e", quizNumber: 3, question: "Assist with medical examinations" },
          { id: "0c6209d6-9487-4569-ab88-efef17ab5bd8", quizNumber: 4, question: "CPR" },
          { id: "016647a9-6519-4b38-9458-33d2c86eb934", quizNumber: 5, question: "Observe safety procedures and precautions" },
          { id: "6b514aad-859c-4429-b92d-23f8bdbf2066", quizNumber: 6, question: "Report patient observations and changes" },
          { id: "b417b32d-4933-4ee5-a448-11630757905f", quizNumber: 7, question: "Aseptic technique" },
          { id: "06cfa03c-cac6-4dc3-b755-a64ce739abb0", quizNumber: 8, question: "Isolation procedure for specimen collection" },
          { id: "54d0a901-1ef7-436f-ba76-7884978b8b52", quizNumber: 9, question: "Draping" },
        ]
      ),
      category(
        "089c06cc-7ce2-446b-9f56-1c7a9cb068fd",
        "documentation",
        "Professional Practices & Documentation",
        "Documentation, infection control, and professional standards.",
        5,
        [
          { id: "2d6a5efb-cb88-4308-a218-1339ce9c2e9a", quizNumber: 1, question: "Infection control precautions" },
          {
            id: "8f962ce2-46f7-4d31-a095-80ac54f12020",
            quizNumber: 2,
            question: "Specimen collection (urine, stool, sputum, culture)",
          },
          { id: "90fc3cfb-ff83-4346-8c50-33bfd96bb4ba", quizNumber: 3, question: "Admission of patients" },
          { id: "441a6f26-07d2-4f4d-b2cb-54dadbd9ad9d", quizNumber: 4, question: "Discharge patients" },
          { id: "6b13a6d4-be29-4d3a-a8ad-3043e7ea59c4", quizNumber: 5, question: "Patient care plans" },
          { id: "843ba2bd-7635-4794-ab43-52d100961af9", quizNumber: 6, question: "Charting and computerized documentation" },
          { id: "27ade349-5f02-40d4-80bc-5bd3c62ffd20", quizNumber: 7, question: "EHR medical record competency" },
          { id: "f7cba8ea-50b1-4be5-acb5-0f1d6284a055", quizNumber: 8, question: "Urine test for glucose/ acetone" },
          { id: "3cdf13ab-94a0-4db9-8120-3418d680f689", quizNumber: 9, question: "Transfer/ transport patients: gurney" },
          { id: "9f553cd0-00be-497f-bfe0-21317db11039", quizNumber: 10, question: "Traction" },
        ]
      ),
    ],
  };
}
