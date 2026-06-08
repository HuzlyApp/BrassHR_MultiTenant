import { NextResponse } from "next/server"
import axios from "axios"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

function isAllowedImageUrl(value: unknown): value is string {
if (typeof value !== "string") return false
let url: URL
try {
url = new URL(value)
} catch {
return false
}
if (url.protocol !== "https:") return false
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : ""
return Boolean(supabaseHost && url.host === supabaseHost)
}

export async function POST(req:Request){
const limited = await enforceRateLimit(req, {
namespace: "verify-id",
key: getClientIp(req),
limit: Number(process.env.RATE_LIMIT_AI_PER_HOUR ?? 20),
windowMs: 60 * 60 * 1000,
failClosed: true,
})
if (limited) return limited

const {fileUrl} = await req.json()
if (!isAllowedImageUrl(fileUrl)) {
return NextResponse.json({ error: "Invalid file URL" }, { status: 400 })
}

const response = await axios.post(
"https://api.x.ai/v1/chat/completions",
{
model: process.env.DOCUMENT_VERIFY_MODEL?.trim() || "grok-4.3",
messages:[
{
role:"system",
content:"You are an identity verification AI."
},
{
role:"user",
content:[
{
type:"text",
text:"Verify if this image contains a valid government ID or driver's license."
},
{
type:"image_url",
image_url:{url:fileUrl, detail:"high"}
}
]
}
]
},
{
headers:{
Authorization:`Bearer ${process.env.XAI_API_KEY || process.env.GROK_API_KEY}`,
"Content-Type":"application/json"
}
}
)

return NextResponse.json({
result:response.data.choices[0].message.content
})

}