"use client"

import Image from "next/image"
import { useState } from "react"

export default function ParseResume() {

const steps = [
"Upload Resume",
"Professional License",
"Skill Assessment",
"Authorizations & Documents",
"Summary"
]

const [currentStep] = useState(1)

return (

<div className="min-h-screen bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center p-6">

<div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex">

{/* LEFT PANEL */}

<div className="w-full md:w-1/2 p-10">

{/* STEP PROGRESS */}

<div className="flex items-center justify-between mb-8">

{steps.map((step,index)=>{

const stepNumber=index+1

return(

<div key={index} className="flex-1 text-center relative">

<div
className={`w-6 h-6 mx-auto rounded-full mb-2 ${
stepNumber<=currentStep
? "bg-teal-600"
: "bg-gray-300"
}`}
/>

{index!==steps.length-1 && (
<div className="absolute top-3 left-1/2 w-full h-[2px] bg-gray-300 -z-10"/>
)}

<p className="text-xs text-gray-500 hidden md:block">
{step}
</p>

</div>

)

})}

</div>

{/* HEADER */}

<h2 className="text-xl font-semibold mb-4">
Review resume details
</h2>

{/* FORM */}

<div className="space-y-4">

<div className="flex gap-4">

<input
placeholder="First Name"
className="border rounded-lg p-2 w-full"
/>

<input
placeholder="Last Name"
className="border rounded-lg p-2 w-full"
/>

</div>

<input
placeholder="Address"
className="border rounded-lg p-2 w-full"
/>

<input
placeholder="Address 2"
className="border rounded-lg p-2 w-full"
/>

<div className="flex gap-4">

<input
placeholder="City"
className="border rounded-lg p-2 w-full"
/>

<input
placeholder="State"
className="border rounded-lg p-2 w-full"
/>

</div>

<div className="flex gap-4">

<input
placeholder="(201) 555-5555"
className="border rounded-lg p-2 w-full"
/>

<input
placeholder="Email"
className="border rounded-lg p-2 w-full"
/>

</div>

<input
placeholder="Job Role"
className="border rounded-lg p-2 w-full"
/>

</div>

{/* BUTTONS */}

<div className="flex justify-between mt-8">

<button className="border px-5 py-2 rounded-lg">
Back
</button>

<button className="bg-teal-600 text-white px-6 py-2 rounded-lg">
Save & Continue
</button>

</div>

</div>

{/* RIGHT PANEL */}

<div className="hidden md:flex w-1/2 relative">

<Image
src="/images/nurse.jpg"
alt="Nurse"
fill
className="object-cover grayscale"
/>

<div className="absolute inset-0 bg-white/40"></div>

<div className="relative z-10 flex flex-col items-center justify-center text-center px-10">

<Image
src="/images/nexus-logo.png"
alt="logo"
width={120}
height={40}
className="mb-4"
/>

<p className="text-gray-700 text-sm">
Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
</p>

</div>

</div>

</div>

</div>

)

}