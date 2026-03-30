import { slackSendAlert } from './composio';
import type { AlertChannel } from '../types/agent';

interface ScheduledDraftAlert {
  agentName: 'WPW-09' | 'BSW-10';
  draftUrl: string;
  topic: string;
  keyword: string;
  workspaceId: string;
  alertChannels: AlertChannel[];
  userId: string;
  runId?: string;
}

/**
 * Send alerts when a scheduled content agent creates a CMS draft.
 * Best-effort — never throws (failures are logged).
 */
export async function sendScheduledDraftAlert(alert: ScheduledDraftAlert): Promise<void> {
  const message = [
    `📝 *${alert.agentName}* created a new draft`,
    ``,
    `**Topic:** ${alert.topic || '(auto-generated)'}`,
    alert.keyword ? `**Keyword:** ${alert.keyword}` : null,
    `**Draft:** ${alert.draftUrl}`,
    ``,
    `⚠️ *Review before publishing* — this content was generated automatically.`,
  ].filter(Boolean).join('\n');

  for (const channel of alert.alertChannels) {
    try {
      if (channel === 'slack') {
        await slackSendAlert(message, '#elevay-drafts', alert.userId);
      }
      if (channel === 'email') {
        await sendDraftEmailAlert(alert);
      }
      if (channel === 'report') {
        // Report channel = stored in agent run output (no active push needed)
      }
    } catch (err) {
      console.error(`[notifications] Failed to send ${channel} alert:`, err instanceof Error ? err.message : err);
    }
  }
}

// ─── Email alert via Resend REST API ─────────────────────

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendDraftEmailAlert(alert: ScheduledDraftAlert): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[notifications] RESEND_API_KEY not set — email alert skipped');
    return;
  }

  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? 'Elevay <noreply@elevay.app>';

  // Fetch workspace owner email
  const { prisma } = await import('../../src/lib/prisma');
  const user = await prisma.user.findFirst({
    where: { workspaceId: alert.workspaceId },
    select: { email: true },
  });
  if (!user?.email) {
    console.warn('[notifications] No user email found for workspace:', alert.workspaceId);
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.elevay.io';
  const subject = `New draft ready — "${alert.topic || 'auto-generated content'}"`;

  const html = buildDraftEmailHtml({
    agentName: alert.agentName,
    topic: alert.topic,
    keyword: alert.keyword,
    draftUrl: alert.draftUrl,
    runId: alert.runId,
    baseUrl,
  });

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [user.email],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[notifications] Resend API error [${res.status}]: ${text.slice(0, 200)}`);
  }
}

// ─── Email HTML template ────────────────────────────────

function buildDraftEmailHtml(params: {
  agentName: string;
  topic: string;
  keyword: string;
  draftUrl: string;
  runId?: string;
  baseUrl: string;
}): string {
  const { agentName, topic, keyword, draftUrl, runId, baseUrl } = params;

  const approveUrl = runId
    ? `${baseUrl}/api/agents/seo-geo/drafts/validate?runId=${encodeURIComponent(runId)}&action=approve`
    : '';
  const rejectUrl = runId
    ? `${baseUrl}/api/agents/seo-geo/drafts/validate?runId=${encodeURIComponent(runId)}&action=reject`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#17C3B2,#2C6BED);padding:24px 32px;">
          <span style="color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.5px;">ELEVAY</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#18181b;">New draft ready</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#71717a;">
            <strong>${agentName}</strong> generated content automatically.
            Review and approve before publishing.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#71717a;width:100px;">Topic</td>
                  <td style="padding:4px 0;font-size:13px;color:#18181b;font-weight:500;">${escapeHtml(topic || '(auto-generated)')}</td>
                </tr>
                ${keyword ? `<tr>
                  <td style="padding:4px 0;font-size:13px;color:#71717a;">Keyword</td>
                  <td style="padding:4px 0;font-size:13px;color:#18181b;font-weight:500;">${escapeHtml(keyword)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#71717a;">Agent</td>
                  <td style="padding:4px 0;font-size:13px;color:#18181b;font-weight:500;">${agentName}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA: View Draft -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr><td align="center">
              <a href="${escapeHtml(draftUrl)}" target="_blank"
                 style="display:inline-block;padding:12px 32px;background-color:#17C3B2;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                View draft
              </a>
            </td></tr>
          </table>

          ${runId ? `<!-- Approve / Reject -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:8px;">
                <a href="${escapeHtml(approveUrl)}" target="_blank"
                   style="display:inline-block;padding:10px 24px;background-color:#2C6BED;color:#ffffff;font-size:13px;font-weight:500;text-decoration:none;border-radius:6px;margin-right:8px;">
                  ✓ Approve
                </a>
                <a href="${escapeHtml(rejectUrl)}" target="_blank"
                   style="display:inline-block;padding:10px 24px;background-color:#ffffff;color:#71717a;font-size:13px;font-weight:500;text-decoration:none;border-radius:6px;border:1px solid #e4e4e7;">
                  ✕ Reject
                </a>
              </td>
            </tr>
          </table>` : ''}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f4f4f5;">
          <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
            This content was generated automatically by Elevay. Review before publishing.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
