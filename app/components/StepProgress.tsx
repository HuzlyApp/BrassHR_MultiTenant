"use client"

export default function StepProgress(){

const steps=[
"Add Resume",
"Professional License",
"Skill Assessment",
"Authorizations & Documents",
"Add References",
"Summary"
]

return(

<div className="flex items-center justify-between mb-10">

{steps.map((step,index)=>{

const active=index<=3

return(

<div key={index} className="flex flex-col items-center flex-1">

<div
className={`w-4 h-4 rounded-full ${
active ? "bg-teal-600" : "bg-gray-300"
}`}
></div>

<p
className={`text-xs mt-2 ${
active ? "text-teal-600" : "text-gray-400"
}`}
>
{step}
</p>

</div>

)

})}

</div>

)

}