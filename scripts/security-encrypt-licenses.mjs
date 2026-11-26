#!/usr/bin/env node
// Run inside an approved secret-bearing environment with Node 24 and --conditions=react-server.
// Default mode reads only counts; --apply is explicitly tenant-scoped and never logs identifiers.
import { createClient } from "@supabase/supabase-js";
import { encryptField, isFieldEncryptionConfigured } from "../lib/security/field-encryption.ts";
const apply = process.argv.includes("--apply");
const tenantId = process.env.SECURITY_BACKFILL_TENANT_ID?.trim();
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const expectedHost = process.env.SECURITY_BACKFILL_EXPECTED_HOST?.trim();
if (!tenantId || !/^[a-f0-9-]{36}$/i.test(tenantId) || !projectUrl || !expectedHost || new URL(projectUrl).hostname !== expectedHost || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
 throw new Error("Require validated tenant ID, explicit expected project hostname, Supabase URL and server-only service key.");
}
if (apply && !isFieldEncryptionConfigured()) throw new Error("Approved field encryption key is not configured.");
const client = createClient(projectUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const { count, error } = await client.from("worker_license_records").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).not("license_number","is",null);
if (error) throw new Error("Could not inspect tenant license inventory.");
console.log(JSON.stringify({mode:apply?"apply":"dry-run",plaintextRows:count ?? 0}));
if (apply) {
 let encrypted=0;
 for (;;) {
  const batch=await client.from("worker_license_records").select("id,license_number,updated_at").eq("tenant_id",tenantId).not("license_number","is",null).is("license_number_encrypted",null).limit(100);
  if (batch.error) throw new Error("Could not read scoped license batch.");
  if (!batch.data?.length) break;
  for (const row of batch.data) {
   const plaintext=String(row.license_number);
   let query=client.from("worker_license_records").update({license_number_encrypted:encryptField(plaintext),license_number_last_four:plaintext.length>4?plaintext.slice(-4):null,license_number:null,updated_at:new Date().toISOString()}).eq("tenant_id",tenantId).eq("id",row.id).is("license_number_encrypted",null);
   query=row.updated_at?query.eq("updated_at",row.updated_at):query.is("updated_at",null);
   const saved=await query.select("id");
   if (saved.error || saved.data?.length!==1) throw new Error("License changed during encryption; stop and review before retrying.");
   encrypted++;
  }
 }
 const remaining=await client.from("worker_license_records").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).not("license_number","is",null);
 if (remaining.error || remaining.count) throw new Error("Plaintext remains; review conflicting encryption state before accepting control.");
 await client.from("activity_logs").insert({tenant_id:tenantId,action:"security.license_encryption.backfill",entity_type:"security_control",details:{control:"SEC-C02",encrypted_rows:encrypted}}).then(({error})=>{if(error)throw new Error("Backfill completed but audit write failed; retain operator evidence.");});
 console.log(JSON.stringify({encryptedRows:encrypted,plaintextRowsRemaining:remaining.count ?? 0}));
}
