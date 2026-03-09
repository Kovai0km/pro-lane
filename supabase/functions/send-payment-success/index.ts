import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentSuccessRequest {
  email: string;
  planName: string;
  amount: number;
  currency: string;
  billingCycle: string;
  periodEnd: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, planName, amount, currency, billingCycle, periodEnd }: PaymentSuccessRequest = await req.json();

    if (!email || !planName) {
      throw new Error("Missing required fields");
    }

    const formattedAmount = `${currency} ${amount.toLocaleString('en-IN')}`;
    const formattedDate = new Date(periodEnd).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const emailResponse = await resend.emails.send({
      from: "PROORBIT <noreply@proorbit.com>",
      to: [email],
      subject: `Payment Successful - ${planName} Plan Activated`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #000; margin-bottom: 24px;">Payment Successful! 🎉</h1>
          
          <p>Your payment has been processed successfully and your <strong>${planName}</strong> plan is now active.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <h3 style="margin-top: 0;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #666;">Plan</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${planName}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Amount</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${formattedAmount}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Billing Cycle</td><td style="padding: 8px 0; text-align: right;">${billingCycle}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Valid Until</td><td style="padding: 8px 0; text-align: right;">${formattedDate}</td></tr>
            </table>
          </div>
          
          <p>Thank you for choosing PROORBIT. Enjoy your upgraded features!</p>
          
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            If you have any questions, please contact our support team.
          </p>
        </div>
      `,
    });

    console.log("Payment success email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending payment success email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
