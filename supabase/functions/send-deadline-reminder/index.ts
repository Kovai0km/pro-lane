import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting deadline reminder check...");

    // Get current time and 24 hours from now
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find projects with due dates within the next 24 hours
    // that haven't been completed or closed
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        due_date,
        created_by,
        assigned_to,
        status
      `)
      .gte("due_date", now.toISOString())
      .lte("due_date", tomorrow.toISOString())
      .not("status", "in", '("completed","closed","delivered")');

    if (projectsError) {
      throw projectsError;
    }

    console.log(`Found ${projects?.length || 0} projects with upcoming deadlines`);

    const remindersToSend: Array<{
      userId: string;
      projectId: string;
      projectTitle: string;
      dueDate: string;
    }> = [];

    // Collect all users to notify for each project
    for (const project of projects || []) {
      const usersToNotify = new Set<string>();

      // Notify project creator
      if (project.created_by) {
        usersToNotify.add(project.created_by);
      }

      // Notify assignee
      if (project.assigned_to) {
        usersToNotify.add(project.assigned_to);
      }

      // Get project members
      const { data: members } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", project.id);

      members?.forEach((m) => usersToNotify.add(m.user_id));

      // Format due date for display
      const dueDate = new Date(project.due_date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Add reminders for each user
      for (const userId of usersToNotify) {
        remindersToSend.push({
          userId,
          projectId: project.id,
          projectTitle: project.title,
          dueDate,
        });
      }
    }

    console.log(`Sending ${remindersToSend.length} reminder emails...`);

    // Send reminder emails
    const results = await Promise.allSettled(
      remindersToSend.map(async (reminder) => {
        try {
          // Create in-app notification
          await supabase.from("notifications").insert({
            user_id: reminder.userId,
            type: "deadline_reminder",
            title: "Deadline Reminder",
            message: `Project "${reminder.projectTitle}" is due on ${reminder.dueDate}`,
            link: `/project/${reminder.projectId}`,
          });

          // Send email notification via existing edge function
          const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: "deadline_reminder",
              userId: reminder.userId,
              projectId: reminder.projectId,
              projectTitle: reminder.projectTitle,
              dueDate: reminder.dueDate,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send email for ${reminder.userId}:`, errorText);
          }

          return { success: true, userId: reminder.userId };
        } catch (error) {
          console.error(`Error sending reminder to ${reminder.userId}:`, error);
          return { success: false, userId: reminder.userId, error };
        }
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success
    ).length;
    const failed = results.length - successful;

    console.log(`Sent ${successful} reminders, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        projectsChecked: projects?.length || 0,
        remindersSent: successful,
        remindersFailed: failed,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-deadline-reminder function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
