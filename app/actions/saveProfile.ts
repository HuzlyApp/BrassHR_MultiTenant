"use server"

import { supabase } from "@/lib/supabase"

/*
Type definition for the parsed resume
This ensures TypeScript does not allow "any"
*/

export type ResumeProfile = {
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  phone: string
  email: string
  jobRole: string
}

/*
Save parsed resume profile to Supabase
*/

export async function saveProfile(data: ResumeProfile) {

  try {

    const { error } = await supabase
      .from("profiles")
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        address: data.address,
        city: data.city,
        state: data.state,
        phone: data.phone,
        email: data.email,
        job_role: data.jobRole
      })

    if (error) {
      console.error("Supabase Insert Error:", error)
      return {
        success: false,
        message: "Failed to save profile"
      }
    }

    return {
      success: true,
      message: "Profile saved successfully"
    }

  } catch (err) {

    console.error("Server Error:", err)

    return {
      success: false,
      message: "Unexpected server error"
    }
  }
}