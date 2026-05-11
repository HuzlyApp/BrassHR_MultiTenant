import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const supabase = createClient(url, key)

const { workerId,email } = await req.json()

const response = await fetch(
"https://api.signeasy.com/v1/documents",
{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.SIGNEASY_API_KEY}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
title:"Authorization Agreement",
files:[
{
name:"Authorization_agreement.pdf",
url:`${process.env.NEXT_PUBLIC_APP_URL}/docs/Authorization_agreement.pdf`
}
],
signers:[
{
name:"Worker",
email,
role:"Signer"
}
],
webhook_url:`${process.env.NEXT_PUBLIC_APP_URL}/api/signeasy/webhook`
})
}
)

const data = await response.json()

const { data: workerRow } = await supabase
  .from("worker")
  .select("tenant_id")
  .eq("id", workerId)
  .maybeSingle()
if (workerRow?.tenant_id != null) {
  await supabase.from("worker_documents").insert({
    tenant_id: String(workerRow.tenant_id),
    worker_id: workerId,
    document_name: "Authorization_agreement.pdf",
    document_id: data.id,
  })
}

return NextResponse.json(data)

}