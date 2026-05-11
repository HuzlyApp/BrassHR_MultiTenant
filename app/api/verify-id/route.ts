import { NextResponse } from "next/server"
import axios from "axios"

export async function POST(req:Request){

const {fileUrl} = await req.json()

const response = await axios.post(
"https://api.x.ai/v1/chat/completions",
{
model:"grok-2-vision-latest",
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
image_url:{url:fileUrl}
}
]
}
]
},
{
headers:{
Authorization:`Bearer ${process.env.GROK_API_KEY}`,
"Content-Type":"application/json"
}
}
)

return NextResponse.json({
result:response.data.choices[0].message.content
})

}