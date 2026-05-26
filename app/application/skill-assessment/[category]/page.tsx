"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  BASIC_PATIENT_CARE_CATEGORY_ID,
  BASIC_PATIENT_CARE_QUESTION_LIMIT,
} from "@/lib/basic-patient-care-category"

interface Question{
 id:string
 question:string
 description?: string | null
 quiz_number:number | null
}

export default function QuizPage(){

 const params = useParams()
 const slug = params.category as string

 const [questions,setQuestions] = useState<Question[]>([])
 const [answers,setAnswers] = useState<Record<string,number>>({})
 const [loading,setLoading] = useState(true)

 useEffect(()=>{

  async function loadData(){

   /* get category */

   const { data:category } = await supabase
   .from("skill_categories")
   .select("id,title")
   .eq("slug",slug)
   .single()

   if(!category){
    setLoading(false)
    return
   }

   /* get questions */

   let qBuilder = supabase
   .from("skill_questions")
   .select("id, question, quiz_number")
   .eq("category_id",category.id)
   .order("quiz_number",{ascending:true})

   if (category.id === BASIC_PATIENT_CARE_CATEGORY_ID) {
    qBuilder = qBuilder.limit(BASIC_PATIENT_CARE_QUESTION_LIMIT)
   }

   const { data:q } = await qBuilder

   setQuestions(q || [])
   setLoading(false)
  }

  loadData()

 },[slug])


 function selectAnswer(qid:string,value:number){

  setAnswers({
   ...answers,
   [qid]:value
  })

 }


 if(loading){

  return(
   <div className="min-h-screen flex items-center justify-center text-white">
    Loading quiz...
   </div>
  )

 }

 return(

<div className="min-h-screen bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center p-12">

<div className="w-[1180px] bg-white rounded-xl shadow-xl flex overflow-hidden">

{/* LEFT PANEL */}

<div className="flex-1 p-10">

{/* STEPS */}

<div className="flex items-center gap-6 text-sm text-gray-500 mb-8">

<div className="flex items-center gap-2 text-teal-600 font-medium">
✔ Add Resume
</div>

<div className="flex items-center gap-2 text-teal-600 font-medium">
✔ Professional License
</div>

<div className="flex items-center gap-2 text-teal-600 font-medium">
● Skill Assessment
</div>

<div>Authorizations & Documents</div>
<div>Character References</div>
<div>Summary</div>

</div>


{/* TITLE */}

<h2 className="text-2xl font-semibold mb-1 capitalize">
{slug.replaceAll("-"," ")}
</h2>

<p className="text-gray-500 mb-6">
Compassionate daily support and safe personal care practices.
</p>


{/* SKILL HEADER */}

<div className="flex justify-between items-center mb-3">

<div className="font-semibold text-gray-700">
Skills
</div>

<div className="flex gap-10 text-gray-400 pr-10">
<span>1</span>
<span>2</span>
<span>3</span>
<span>4</span>
</div>

</div>


{/* QUESTIONS */}

<div className="space-y-6">

{questions.map((q,index)=>(

<div
key={q.id}
className="flex items-center justify-between border-b pb-4"
>

<div className="flex gap-4">

<div className="w-7 h-7 border border-teal-500 text-teal-600 rounded-full flex items-center justify-center">
{index+1}
</div>

<div>

<div className="font-medium text-gray-800">
{q.question}
</div>

{q.description ? (
<div className="text-sm text-gray-400">
{q.description}
</div>
) : null}

</div>

</div>


{/* RATING */}

<div className="flex gap-10 pr-10">

{[1,2,3,4].map(n=>(
<div
key={n}
onClick={()=>selectAnswer(q.id,n)}
className={`w-5 h-5 rounded-full border cursor-pointer
${answers[q.id]===n
 ? "bg-teal-500 border-teal-500"
 : "border-gray-400"}
`}
/>
))}

</div>

</div>

))}

</div>


{/* FOOTER */}

<div className="flex justify-between items-center mt-10">

<div className="text-gray-400 text-sm">
1 of 2
</div>

<div className="flex gap-3">

<button className="border px-6 py-2 rounded-md">
Back
</button>

<button className="bg-teal-600 text-white px-6 py-2 rounded-md">
Save & Next →
</button>

</div>

</div>

</div>


{/* RIGHT PANEL */}

<div className="w-[380px] bg-gray-50 flex flex-col items-center justify-center p-10">

<img
src="/nexus-logo.png"
className="w-44 mb-6"
/>

<p className="text-center text-gray-600 text-sm">
Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
</p>

</div>

</div>

</div>

 )
}