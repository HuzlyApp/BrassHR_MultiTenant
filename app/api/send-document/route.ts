import { NextResponse } from "next/server"

export async function POST(req: Request){

const { email } = await req.json()

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