"use client"

import { useEffect,useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  BASIC_PATIENT_CARE_CATEGORY_ID,
  BASIC_PATIENT_CARE_QUESTION_LIMIT,
} from "@/lib/basic-patient-care-category"
import { useRouter } from "next/navigation"

interface Question{
 id:string
 question:string
}

export default function SkillQuiz({
 categoryId,
 title,
 description
}:{
 categoryId:string
 title:string
 description:string
}){

 const router = useRouter()

 const [questions,setQuestions] = useState<Question[]>([])
 const [answers,setAnswers] = useState<Record<string,number>>({})
 const [loading,setLoading] = useState(true)

 useEffect(()=>{

  const load = async()=>{

   let q = supabase
    .from("skill_questions")
    .select("id,question")
    .eq("category_id",categoryId)
    .order("quiz_number",{ascending:true})

   if (categoryId === BASIC_PATIENT_CARE_CATEGORY_ID) {
    q = q.limit(BASIC_PATIENT_CARE_QUESTION_LIMIT)
   }

   const { data,error } = await q

   if(data) setQuestions(data)

   setLoading(false)
  }

  load()

 },[categoryId])

 const selectAnswer=(id:string,val:number)=>{

  setAnswers(prev=>({
   ...prev,
   [id]:val
  }))

 }

 if(loading){
  return(
   <div className="p-10">Loading Questions...</div>
  )
 }

 return(

 <div className="min-h-screen bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center p-10">

 <div className="bg-white rounded-xl shadow-xl w-[900px] flex overflow-hidden">

 {/* LEFT QUIZ */}

 <div className="w-2/3 p-8">

 <div className="flex justify-between mb-4">

 <div>

 <h1 className="text-xl font-bold text-gray-800">
 {title}
 </h1>

 <p className="text-sm text-gray-500">
 {description}
 </p>

 </div>

 <button className="text-teal-600 text-sm">
 Skip for Now →
 </button>

 </div>

 <div className="grid grid-cols-6 text-gray-500 mb-4">

 <div className="col-span-2 font-semibold">
 Skills
 </div>

 <div className="text-center">1</div>
 <div className="text-center">2</div>
 <div className="text-center">3</div>
 <div className="text-center">4</div>

 </div>

 <div className="space-y-4">

 {questions.map((q,index)=>(
  
 <div key={q.id} className="grid grid-cols-6 items-center border-b pb-3">

 <div className="col-span-2 flex gap-3">

 <div className="w-6 h-6 rounded-full border border-teal-500 flex items-center justify-center text-xs text-teal-600">
 {index+1}
 </div>

 <p className="text-sm text-gray-700">
 {q.question}
 </p>

 </div>

 {[1,2,3,4].map(num=>(
  
 <div key={num} className="flex justify-center">

 <button
 onClick={()=>selectAnswer(q.id,num)}
 className={`w-5 h-5 rounded-full border ${
  answers[q.id]===num
  ?"bg-teal-500 border-teal-500"
  :"border-gray-400"
 }`}
 />

 </div>

 ))}

 </div>

 ))}

 </div>

 <div className="flex justify-between mt-8">

 <button
 onClick={()=>router.back()}
 className="border px-6 py-2 rounded text-gray-600"
 >
 Back
 </button>

 <button className="bg-teal-600 text-white px-6 py-2 rounded">
 Save & Next
 </button>

 </div>

 </div>

 {/* RIGHT PANEL */}

 <div className="w-1/3 bg-gray-100 flex items-center justify-center">

 <div className="text-center p-6">

 <img
 src="/nexus-logo.png"
 className="w-32 mx-auto mb-6"
 />

 <p className="text-sm text-gray-500">
 Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
 </p>

 </div>

 </div>

 </div>

 </div>

 )

}