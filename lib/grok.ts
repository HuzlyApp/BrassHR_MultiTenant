export async function grokParseResume(text:string){

const res = await fetch("https://api.x.ai/v1/chat/completions",{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${process.env.GROK_API_KEY}`
},
body:JSON.stringify({
model:"grok-2-latest",
messages:[
{
role:"system",
content:`Extract structured resume data in JSON format:
{
firstName,
lastName,
email,
phone,
address1,
address2,
city,
state,
jobRole
}`
},
{
role:"user",
content:text
}
],
temperature:0
})
})

const data = await res.json()

return JSON.parse(data.choices[0].message.content)

}