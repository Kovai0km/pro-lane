import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  to: string;
  inviterName: string;
  inviterEmail: string;
  type: "project" | "team";
  itemName: string;
  inviteToken?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, inviterName, inviterEmail, type, itemName, inviteToken }: InvitationEmailRequest = await req.json();

    console.log(`Sending ${type} invitation email to ${to}`);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const signupUrl = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovableproject.com")}/auth${inviteToken ? `?token=${inviteToken}` : ""}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Invitations <onboarding@resend.dev>",
        to: [to],
        subject: `You've been invited to join a ${type}!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000;">
                    <tr>
                      <td style="padding: 40px;">
                        <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: bold; color: #000000;">
                          You're Invited!
                        </h1>
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #333333;">
                          <strong>${inviterName || inviterEmail}</strong> has invited you to join the ${type}:
                        </p>
                        <p style="margin: 0 0 24px 0; font-size: 20px; font-weight: bold; color: #000000;">
                          "${itemName}"
                        </p>
                        <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 24px; color: #333333;">
                          Click the button below to accept the invitation and join.
                        </p>
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="background-color: #000000; padding: 16px 32px;">
                              <a href="${signupUrl}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">
                                Accept Invitation
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 32px 0 0 0; font-size: 14px; color: #666666;">
                          If you didn't expect this invitation, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify(emailData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-invitation-email function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
