import { sendEmail } from '../client';
import { resolveContactInbox, resolveMailFrom } from '../routing';
import { siteConfig } from '@/lib/seo/site';
import type { ContactInput } from '@/lib/validators/contact';

/* ---------------------------------------------------------------------------
 * Contact form notification email
 *
 * Sent to the ARIOT team inbox when a visitor submits the public contact
 * form. Contains all submitted fields in a clean HTML layout.
 * ------------------------------------------------------------------------ */

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildContactHtml(data: ContactInput): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New contact message</title>
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
                New contact message
              </h1>
            </td>
          </tr>
          <!-- Accent line -->
          <tr>
            <td style="padding-bottom:24px;">
              <div style="height:2px;background:linear-gradient(90deg,#3DD8F7,transparent);border-radius:1px;"></div>
            </td>
          </tr>
          <!-- Fields -->
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0E1014;border:1px solid #2A3038;border-radius:10px;">
                <tr>
                  <td style="padding:24px;">
                    ${fieldRow('Name', data.name)}
                    ${data.company ? fieldRow('Company', data.company) : ''}
                    ${fieldRow('Email', data.email)}
                    ${data.phone ? fieldRow('Phone', data.phone) : ''}
                    ${fieldRow('Topic', capitalizeFirst(data.topic))}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Message -->
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#7C8593;text-transform:uppercase;letter-spacing:0.04em;">
                Message
              </p>
              <div style="background-color:#0E1014;border:1px solid #2A3038;border-radius:10px;padding:24px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#C7CDD6;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td>
              <div style="height:1px;background-color:#2A3038;margin-bottom:16px;"></div>
              <p style="margin:0;font-size:13px;color:#5B6472;">
                ${siteConfig.fullName}
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

function fieldRow(label: string, value: string): string {
  return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                      <tr>
                        <td style="font-size:13px;font-weight:600;color:#7C8593;text-transform:uppercase;letter-spacing:0.04em;padding-bottom:4px;">
                          ${label}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:15px;color:#E4E8EE;">
                          ${escapeHtml(value)}
                        </td>
                      </tr>
                    </table>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendContactNotification(
  data: ContactInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendEmail({
    // Env-driven routing (D2 / I-031): MAIL_FROM must sit on a Resend-
    // verified domain; MAIL_TO is the owner-approved inbox. Throws in
    // production when unconfigured — never a fake success.
    from: resolveMailFrom(),
    to: resolveContactInbox(),
    replyTo: data.email,
    subject: `[Contact] ${capitalizeFirst(data.topic)} — ${data.name}`,
    html: buildContactHtml(data),
  });
}
