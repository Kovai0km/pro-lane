import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  type: "assignment" | "deadline_reminder" | "mention" | "status_change";
  userId: string;
  projectId: string;
  projectTitle: string;
  message?: string;
  dueDate?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, userId, projectId, projectTitle, message, dueDate }: NotificationEmailRequest = await req.json();

    // Get user profile and check email notification preferences
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, notification_email, notification_assignments, notification_mentions, notification_status_changes")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("User profile not found");
    }

    // Check if user has email notifications enabled
    if (!profile.notification_email) {
      console.log("User has email notifications disabled");
      return new Response(JSON.stringify({ skipped: true, reason: "Email notifications disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check specific notification type preferences
    if (type === "assignment" && !profile.notification_assignments) {
      return new Response(JSON.stringify({ skipped: true, reason: "Assignment notifications disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (type === "mention" && !profile.notification_mentions) {
      return new Response(JSON.stringify({ skipped: true, reason: "Mention notifications disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (type === "status_change" && !profile.notification_status_changes) {
      return new Response(JSON.stringify({ skipped: true, reason: "Status change notifications disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const projectUrl = `${supabaseUrl.replace(".supabase.co", ".lovableproject.com")}/project/${projectId}`;

    let subject = "";
    let htmlContent = "";

    switch (type) {
      case "assignment":
        subject = `You've been assigned to "${projectTitle}"`;
        htmlContent = `
          <h1>You've Been Assigned to a Project</h1>
          <p>Hello ${profile.full_name || "there"},</p>
          <p>You have been assigned to work on the project <strong>"${projectTitle}"</strong>.</p>
          <p><a href="${projectUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold;">View Project</a></p>
        `;
        break;

      case "deadline_reminder":
        subject = `Deadline reminder: "${projectTitle}" is due soon`;
        htmlContent = `
          <h1>Project Deadline Reminder</h1>
          <p>Hello ${profile.full_name || "there"},</p>
          <p>This is a reminder that the project <strong>"${projectTitle}"</strong> is due on <strong>${dueDate}</strong>.</p>
          <p><a href="${projectUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold;">View Project</a></p>
        `;
        break;

      case "mention":
        subject = `You were mentioned in "${projectTitle}"`;
        htmlContent = `
          <h1>You Were Mentioned</h1>
          <p>Hello ${profile.full_name || "there"},</p>
          <p>You were mentioned in a comment on the project <strong>"${projectTitle}"</strong>.</p>
          ${message ? `<p style="background-color: #f5f5f5; padding: 16px; border-left: 4px solid #000;">${message}</p>` : ""}
          <p><a href="${projectUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold;">View Project</a></p>
        `;
        break;

      case "status_change":
        subject = `Project status updated: "${projectTitle}"`;
        htmlContent = `
          <h1>Project Status Updated</h1>
          <p>Hello ${profile.full_name || "there"},</p>
          <p>The status of project <strong>"${projectTitle}"</strong> has been updated.</p>
          ${message ? `<p><strong>New status:</strong> ${message}</p>` : ""}
          <p><a href="${projectUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold;">View Project</a></p>
        `;
        break;
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PROORBIT <onboarding@resend.dev>",
        to: [profile.email],
        subject,
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
                        ${htmlContent}
                        <p style="margin-top: 32px; font-size: 14px; color: #666666;">
                          You're receiving this email because you have email notifications enabled in your PROORBIT settings.
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
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
