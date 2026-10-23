import { sendEmail } from '../client';
import { resolveContactInbox, resolveMailFrom } from '../routing';
import { siteConfig } from '@/lib/seo/site';
import type { QuoteInput } from '@/lib/validators/quote';

/* ---------------------------------------------------------------------------
 * Quote request notification email
 *
 * Sent to the ARIOT sales inbox when a visitor submits a B2B quote
 * request. Contains project details, product interest, and contact info.
 * ------------------------------------------------------------------------ */

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTimeline(value: string): string {
  switch (value) {
    case 'urgent':
      return 'Urgent (within 2 weeks)';
    case 'quarter':
      return 'This quarter';
    case 'planning':
      return 'Planning phase (3+ months)';
    default:
      return capitalizeFirst(value);
  }
}

function formatCategory(value: string): string {
  switch (value) {
    case 'robotics':
      return 'Robotics / Autonomous Systems';
    case 'iot':
      return 'IoT / Sensor Networks';
    case 'education':
      return 'Education / Robotics Kits';
    case 'custom':
      return 'Custom R&D / Embedded';
    default:
      return capitalizeFirst(value);
  }
}

function buildQuoteHtml(data: QuoteInput): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New quote request</title>
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
                New quote request
              </h1>
            </td>
          </tr>
          <!-- Accent line -->
          <tr>
            <td style="padding-bottom:24px;">
              <div style="height:2px;background:linear-gradient(90deg,#3DD8F7,transparent);border-radius:1px;"></div>
            </td>
          </tr>
          <!-- Project details -->
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#3DD8F7;text-transform:uppercase;letter-spacing:0.04em;">
                Project Details
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0E1014;border:1px solid #2A3038;border-radius:10px;">
                <tr>
                  <td style="padding:24px;">
                    ${fieldRow('Industry', capitalizeFirst(data.industry))}
                    ${fieldRow('Timeline', formatTimeline(data.timeline))}
                    ${fieldRow('Product Category', formatCategory(data.productCategory))}
                    ${fieldRow('Use Case', data.useCase)}
                    ${data.scaleHint ? fieldRow('Scale', data.scaleHint) : ''}
                    ${data.technicalNotes ? fieldRow('Technical Notes', data.technicalNotes) : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Contact details -->
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#3DD8F7;text-transform:uppercase;letter-spacing:0.04em;">
                Contact Details
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0E1014;border:1px solid #2A3038;border-radius:10px;">
                <tr>
                  <td style="padding:24px;">
                    ${fieldRow('Name', data.name)}
                    ${fieldRow('Company', data.company)}
                    ${data.role ? fieldRow('Role', data.role) : ''}
                    ${fieldRow('Email', data.email)}
                    ${data.phone ? fieldRow('Phone', data.phone) : ''}
                    ${fieldRow('Preferred Channel', capitalizeFirst(data.preferredChannel))}
                  </td>
                </tr>
              </table>
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
                        <td style="font-size:15px;color:#E4E8EE;white-space:pre-wrap;">
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

export async function sendQuoteNotification(
  data: QuoteInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendEmail({
    // Env-driven routing (D2 / I-031) — shared with the contact
    // notification: MAIL_FROM (Resend-verified sender) + MAIL_TO (inbox).
    from: resolveMailFrom(),
    to: resolveContactInbox(),
    replyTo: data.email,
    subject: `[Quote] ${data.company} — ${formatCategory(data.productCategory)}`,
    html: buildQuoteHtml(data),
  });
}
