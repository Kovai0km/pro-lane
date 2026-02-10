import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  organizationId: string;
  userId: string;
  email: string;
  organizationName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organizationId, userId, email, organizationName }: OTPRequest = await req.json();

    // Generate OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTPs for this org/user
    await supabase
      .from('org_delete_otp')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    // Insert new OTP
    const { error: insertError } = await supabase
      .from('org_delete_otp')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        code,
      });

    if (insertError) {
      throw new Error(`Failed to create OTP: ${insertError.message}`);
    }

    // Send email if Resend API key is configured
    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "PROORBIT <noreply@resend.dev>",
          to: [email],
          subject: `Delete Organization Verification Code - ${organizationName}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Organization Deletion Verification</h2>
              <p>You have requested to delete the organization <strong>${organizationName}</strong>.</p>
              <p style="font-size: 14px; color: #666;">Your verification code is:</p>
              <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
              </div>
              <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
              <p style="font-size: 14px; color: #dc2626; font-weight: bold;">
                ⚠️ Warning: This action is irreversible. All data associated with this organization will be permanently deleted.
              </p>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        console.error("Failed to send email:", await emailResponse.text());
      }
    } else {
      console.log("RESEND_API_KEY not configured, OTP code:", code);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-delete-otp:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
