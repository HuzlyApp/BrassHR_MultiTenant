import { NextResponse } from "next/server"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { enforceRateLimit } from "@/lib/security/rate-limit"

export async function POST(req: Request){
const auth = await requireStaffApiSession()
if (auth instanceof NextResponse) return auth
const limited = await enforceRateLimit(req, {
namespace: "send-document",
key: auth.userId,
limit: Number(process.env.RATE_LIMIT_SIGNING_PER_HOUR ?? 20),
windowMs: 60 * 60 * 1000,
failClosed: true,
})
if (limited) return limited

const { email } = await req.json()
if (typeof email !== "string" || !email.includes("@")) {
return NextResponse.json({ error: "Invalid email" }, { status: 400 })
}

const response = await fetch(
"https://api.signeasy.com/v1/documents",
{
method: "POST",
headers: {
Authorization: `Bearer ${process.env.SIGNEASY_API_KEY}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
title: "Authorization Agreement",
signers: [
{
name: "Worker",
email: email,
role: "Signer"
}
],
files: [
{
name: "Authorization_agreement.pdf",
url: "https://yourdomain.com/docs/Authorization_agreement.pdf"
}
]
})
}
)

const data = await response.json()

return NextResponse.json(data)

}