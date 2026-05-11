"use client"

import { useState } from "react"
import { supabase } from '@/lib/supabase'
import { useRouter } from "next/navigation"

type Props = {
open:boolean
setOpen:(v:boolean)=>void
}

export default function AuthModal({open,setOpen}:Props){

const router = useRouter()

const [email,setEmail] = useState("")
const [password,setPassword] = useState("")
const [loading,setLoading] = useState(false)

if(!open) return null


async function login(){

try{

setLoading(true)

const { data, error } = await supabase.auth.signInWithPassword({
email,
password
})

if(error){
alert(error.message)
setLoading(false)
return
}

setOpen(false)

router.push("/application/step-1-upload")

}catch(err){
console.log(err)
alert("Login failed")
}

setLoading(false)

}


return(

<div
className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
onClick={()=>setOpen(false)}
>

<div
className="bg-white w-[480px] rounded-2xl p-10 relative"
onClick={(e)=>e.stopPropagation()}
>

{/* CLOSE BUTTON */}

<button
onClick={()=>setOpen(false)}
className="absolute right-6 top-6 text-gray-500 text-xl"
>
✕
</button>

<p className="text-3xl font-semibold mb-8 text-gray-600">
Sign in
</p>


<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
className="w-full border rounded-xl p-4 mb-5 text-gray-600"
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
className="w-full border rounded-xl p-4 mb-6  text-gray-600"
/>

<button
onClick={login}
disabled={loading}
className="w-full bg-teal-600 text-white py-4 rounded-xl"
>

{loading ? "Logging in..." : "Login"}

</button>

<p className="text-center mt-6">

No account?

<span className="text-teal-600 ml-2 cursor-pointer">
Sign Up
</span>

</p>

</div>

</div>

)

}