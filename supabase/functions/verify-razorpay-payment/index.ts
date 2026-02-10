import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Not authenticated");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Not authenticated");
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature }: VerifyPaymentRequest = await req.json();

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const encoder = new TextEncoder();
    const key = encoder.encode(RAZORPAY_KEY_SECRET);
    const message = encoder.encode(body);
    
    const hmac = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", hmac, message);
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== razorpay_signature) {
      console.error("Signature verification failed");
      throw new Error("Invalid payment signature");
    }

    console.log("Payment signature verified successfully");

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("user_id", user.id)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment record not found");
    }

    const metadata = payment.metadata as { plan_id: string; billing_cycle: string };

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", metadata.plan_id)
      .single();

    if (planError || !plan) {
      throw new Error("Plan not found");
    }

    // Calculate subscription period
    const now = new Date();
    const periodEnd = new Date(now);
    if (metadata.billing_cycle === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Update payment status
    await supabase
      .from("payments")
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: "completed",
      })
      .eq("id", payment.id);

    // Create or update subscription
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (existingSub) {
      // Update existing subscription
      await supabase
        .from("subscriptions")
        .update({
          plan_id: metadata.plan_id,
          billing_cycle: metadata.billing_cycle,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", existingSub.id);
    } else {
      // Create new subscription
      await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan_id: metadata.plan_id,
        billing_cycle: metadata.billing_cycle,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      });
    }

    // Update user profile plan
    await supabase
      .from("profiles")
      .update({
        plan: plan.name,
        plan_expires_at: periodEnd.toISOString(),
      })
      .eq("id", user.id);

    // Link payment to subscription
    const { data: newSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (newSub) {
      await supabase
        .from("payments")
        .update({ subscription_id: newSub.id })
        .eq("id", payment.id);
    }

    console.log(`Successfully activated ${plan.name} subscription for user ${user.id}`);

    // Send payment success email
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-payment-success`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          email: user.email,
          planName: plan.display_name || plan.name,
          amount: payment.amount,
          currency: payment.currency,
          billingCycle: metadata.billing_cycle,
          periodEnd: periodEnd.toISOString(),
        }),
      });
      if (!response.ok) {
        console.error("Failed to send payment success email:", await response.text());
      }
    } catch (emailErr) {
      console.error("Error sending payment success email:", emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified and subscription activated",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in verify-razorpay-payment:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
