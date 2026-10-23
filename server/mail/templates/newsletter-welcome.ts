import { sendEmail } from '../client';
import { resolveMailFrom } from '../routing';
import { siteConfig } from '@/lib/seo/site';

/* ---------------------------------------------------------------------------
 * Newsletter welcome email
 *
 * Sent to the subscriber after they opt in to the ARIOT newsletter.
 * Confirms the subscription and sets expectations for what they'll receive.
 * ------------------------------------------------------------------------ */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNewsletterWelcomeHtml(email: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to the ARIOT newsletter</title>
</head>
<body style="margin:0;padding:0;background-color:#08090B;font-family:Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08090B;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:'Space Grotesk',system-ui,sans-serif;font-size:20px;font-weight:600;color:#E4E8EE;letter-spacing:0.05em;">
                    ARIOT
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding-bottom:24px;">
              <h1 style="margin:0;font-family:'Space Grotesk',system-ui,sans-serif;font-size:28px;font-weight:600;color:#E4E8EE;letter-spacing:-0.02em;">
                Welcome to the newsletter
              </h1>
            </td>
          </tr>
          <!-- Accent line -->
          <tr>
            <td style="padding-bottom:24px;">
              <div style="height:2px;background:linear-gradient(90deg,#3DD8F7,transparent);border-radius:1px;"></div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding-bottom:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0E1014;border:1px solid #2A3038;border-radius:10px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#C7CDD6;">
                      You're in. We'll send you updates on ARIOT's robotics and IoT work — product launches, engineering deep-dives, and field notes from building autonomous systems in Bangladesh.
                    </p>
                    <p style="margin:0;font-size:15px;line-height:1.6;color:#C7CDD6;">
                      Expect one or two emails per month. No spam, no noise — just the work we think is worth your attention.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- What to expect -->
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#3DD8F7;text-transform:uppercase;letter-spacing:0.04em;">
                What to expect
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0E1014;border:1px solid #2A3038;border-radius:10px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 8px;font-size:15px;color:#E4E8EE;">
                      <span style="color:#3DD8F7;">&#x2022;</span> Product announcements and release notes
                    </p>
                    <p style="margin:0 0 8px;font-size:15px;color:#E4E8EE;">
                      <span style="color:#3DD8F7;">&#x2022;</span> Engineering deep-dives from the robotics lab
                    </p>
                    <p style="margin:0 0 8px;font-size:15px;color:#E4E8EE;">
                      <span style="color:#3DD8F7;">&#x2022;</span> IoT field reports from Bangladesh deployments
                    </p>
                    <p style="margin:0;font-size:15px;color:#E4E8EE;">
                      <span style="color:#3DD8F7;">&#x2022;</span> Case studies and partner spotlights
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding-bottom:32px;" align="center">
              <a href="${siteConfig.url}" style="display:inline-block;background-color:#3DD8F7;color:#08090B;font-family:'Space Grotesk',system-ui,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px;">
                Explore ARIOT
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td>
              <div style="height:1px;background-color:#2A3038;margin-bottom:16px;"></div>
              <p style="margin:0 0 8px;font-size:13px;color:#5B6472;">
                ${siteConfig.fullName}
              </p>
              <p style="margin:0;font-size:12px;color:#3F4753;">
                You received this because you subscribed at ${escapeHtml(email)}. If this wasn't you, simply ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendNewsletterWelcome(
  email: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendEmail({
    // Env-driven sender (D2 / I-031): MAIL_FROM must sit on a Resend-
    // verified domain. The recipient is the subscriber.
    from: resolveMailFrom(),
    to: email,
    subject: `Welcome to the ARIOT newsletter`,
    html: buildNewsletterWelcomeHtml(email),
  });
}
