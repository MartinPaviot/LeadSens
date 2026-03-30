import { OpenAIToolSet } from 'composio-core';
import type { ConnectionItem } from 'composio-core';
import { ToolUnavailableError } from '../types';
import { requireEnv } from '../../src/lib/env';

// ─── Composio client (singleton) ─────────────────────────

let _toolset: OpenAIToolSet | null = null;

function getToolset(): OpenAIToolSet {
  if (!_toolset) {
    _toolset = new OpenAIToolSet({
      apiKey: requireEnv('COMPOSIO_API_KEY'),
    });
  }
  return _toolset;
}

// ─── Integration IDs from env ─────────────────────────────
// Each value is a Composio integrationId (not authConfigId)

const INTEGRATIONS = {
  gsc:     requireEnv('COMPOSIO_GSC_AUTH_CONFIG_ID'),
  ga:      requireEnv('COMPOSIO_GA_AUTH_CONFIG_ID'),
  sheets:  requireEnv('COMPOSIO_SHEETS_AUTH_CONFIG_ID'),
  slack:   requireEnv('COMPOSIO_SLACK_AUTH_CONFIG_ID'),
  ahrefs:  requireEnv('COMPOSIO_AHREFS_AUTH_CONFIG_ID'),
  semrush: requireEnv('COMPOSIO_SEMRUSH_AUTH_CONFIG_ID'),
  hubspot: requireEnv('COMPOSIO_HUBSPOT_AUTH_CONFIG_ID'),
  shopify: requireEnv('COMPOSIO_SHOPIFY_AUTH_CONFIG_ID'),
};

export type ComposioTool = keyof typeof INTEGRATIONS;

// ─── Types ────────────────────────────────────────────────

export interface OAuthConnection {
  tool: ComposioTool;
  connectedAccountId: string;
  status: 'active' | 'expired' | 'error';
}

export interface InitiateOAuthResult {
  redirectUrl: string;
  connectionId: string;
}

// ─── OAuth connection management ──────────────────────────

export async function initiateOAuth(
  tool: ComposioTool,
  userId: string,
  redirectUrl: string,
): Promise<InitiateOAuthResult> {
  try {
    const toolset = getToolset();
    const integrationId = INTEGRATIONS[tool];

    const connection = await toolset.connectedAccounts.initiate({
      integrationId,
      entityId: userId,
      redirectUri: redirectUrl,
    });

    return {
      redirectUrl: connection.redirectUrl ?? '',
      connectionId: connection.connectedAccountId,
    };
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError(`composio:oauth:${tool}`, 'core/tools');
  }
}

export async function getOAuthConnection(
  tool: ComposioTool,
  userId: string,
): Promise<OAuthConnection | null> {
  try {
    const toolset = getToolset();
    const integrationId = INTEGRATIONS[tool];

    const accounts = await toolset.connectedAccounts.list({
      entityId: userId,
      integrationId,
      showActiveOnly: true,
    });

    const match = accounts.items?.find(
      (a: ConnectionItem) => a.status === 'ACTIVE' && !a.isDisabled,
    );

    if (!match) return null;

    return {
      tool,
      connectedAccountId: match.id,
      status: 'active',
    };
  } catch {
    return null;
  }
}

export async function isToolConnected(
  tool: ComposioTool,
  userId: string,
): Promise<boolean> {
  const connection = await getOAuthConnection(tool, userId);
  return connection !== null;
}

// ─── Execute action ───────────────────────────────────────

export async function executeAction(
  tool: ComposioTool,
  action: string,
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  try {
    const toolset = getToolset();
    const connection = await getOAuthConnection(tool, userId);

    if (!connection) {
      throw new ToolUnavailableError(`composio:${tool}:not_connected`, 'core/tools');
    }

    // SDK boundary — ActionExecuteResponse shape is not typed in public API
    const result = await toolset.executeAction({
      action,
      params: params as Record<string, string>,
      connectedAccountId: connection.connectedAccountId,
      entityId: userId,
    }) as unknown as { data: unknown; error?: string; successful?: boolean };

    return result.data ?? result;
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError(`composio:${tool}:${action}`, 'core/tools');
  }
}

// ─── Google Search Console ────────────────────────────────

export async function gscGetTopPages(
  siteUrl: string,
  userId: string,
  days = 90,
  limit = 100,
): Promise<{
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}[]> {
  try {
    const endDate = new Date().toISOString().split('T')[0]!;
    const startDate = new Date(Date.now() - days * 86400000)
      .toISOString()
      .split('T')[0]!;

    const result = await executeAction(
      'gsc',
      'GOOGLEWEBMASTERS_SEARCH_ANALYTICS_QUERY',
      {
        siteUrl,
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: limit,
      },
      userId,
    ) as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] };

    return (result.rows ?? []).map((row) => ({
      url: row.keys[0] ?? '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('composio:gsc:topPages', 'core/tools');
  }
}

export async function gscGetLowHangingFruit(
  siteUrl: string,
  userId: string,
): Promise<{
  keyword: string;
  url: string;
  position: number;
  impressions: number;
  clicks: number;
}[]> {
  try {
    const endDate = new Date().toISOString().split('T')[0]!;
    const startDate = new Date(Date.now() - 90 * 86400000)
      .toISOString()
      .split('T')[0]!;

    const result = await executeAction(
      'gsc',
      'GOOGLEWEBMASTERS_SEARCH_ANALYTICS_QUERY',
      {
        siteUrl,
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: 500,
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'query',
            operator: 'notContains',
            expression: 'brand',
          }],
        }],
      },
      userId,
    ) as { rows?: { keys: string[]; position: number; impressions: number; clicks: number }[] };

    return (result.rows ?? [])
      .filter((row) => row.position >= 4 && row.position <= 15)
      .map((row) => ({
        keyword: row.keys[0] ?? '',
        url: row.keys[1] ?? '',
        position: row.position,
        impressions: row.impressions,
        clicks: row.clicks,
      }));
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('composio:gsc:lowHangingFruit', 'core/tools');
  }
}

// ─── Google Sheets ────────────────────────────────────────

export async function sheetsCreateDashboard(
  title: string,
  data: Record<string, unknown>[],
  userId: string,
): Promise<string> {
  try {
    const result = await executeAction(
      'sheets',
      'GOOGLESHEETS_CREATE_SPREADSHEET',
      { title },
      userId,
    ) as { spreadsheetId?: string };

    const spreadsheetId = result.spreadsheetId;
    if (!spreadsheetId) throw new Error('No spreadsheet ID returned');

    if (data.length > 0) {
      const headers = Object.keys(data[0]!);
      const rows = data.map((row) => headers.map((h) => String(row[h] ?? '')));
      const values = [headers, ...rows];

      await executeAction(
        'sheets',
        'GOOGLESHEETS_BATCH_UPDATE',
        {
          spreadsheetId,
          data: [{ range: 'Sheet1!A1', values }],
        },
        userId,
      );
    }

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('composio:sheets:createDashboard', 'core/tools');
  }
}

// ─── Slack ────────────────────────────────────────────────

export async function slackSendAlert(
  message: string,
  channel: string,
  userId: string,
): Promise<void> {
  try {
    await executeAction(
      'slack',
      'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
      { channel, text: message },
      userId,
    );
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('composio:slack:sendAlert', 'core/tools');
  }
}

// ─── HubSpot CMS ─────────────────────────────────────────

export async function hubspotUpdatePageMeta(
  pageId: string,
  metaTitle: string,
  metaDescription: string,
  userId: string,
): Promise<void> {
  try {
    await executeAction(
      'hubspot',
      'HUBSPOT_UPDATE_A_SITE_PAGE',
      {
        id: pageId,
        htmlTitle: metaTitle,
        metaDescription,
      },
      userId,
    );
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('composio:hubspot:updatePageMeta', 'core/tools');
  }
}

// ─── Shopify ──────────────────────────────────────────────

export async function shopifyUpdateProductMeta(
  productId: string,
  metaTitle: string,
  metaDescription: string,
  userId: string,
): Promise<void> {
  try {
    await executeAction(
      'shopify',
      'SHOPIFY_UPDATE_AN_EXISTING_PRODUCT',
      {
        id: productId,
        metafields: [
          { namespace: 'global', key: 'title_tag', value: metaTitle, type: 'single_line_text_field' },
          { namespace: 'global', key: 'description_tag', value: metaDescription, type: 'single_line_text_field' },
        ],
      },
      userId,
    );
  } catch (err) {
    if (err instanceof ToolUnavailableError) throw err;
    throw new ToolUnavailableError('composio:shopify:updateProductMeta', 'core/tools');
  }
}
