import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(){

const { data, error } = await supabase
.from("skill_questions")
.select(`
id,
question,
skill_categories (
 title
)
`)

return NextResponse.json(data)

}