import { kga08InputSchema } from '../schemas';
import { AgentContext, AgentSession } from '../../../core/types';
import { Kga08Inputs, Kga08Output } from './types';
import {
  collectLowHangingFruit,
  expandKeywords,
  scoreGeoMarkets,
  detectCityLandingPages,
  buildActionPlan,
  buildClusterMap,
  buildGbpAudit,
  buildHreflangPlan,
} from './workflow';
import { KGA08_SYSTEM_PROMPT } from './prompt';

export async function activate(
  context: AgentContext,
  inputs: Kga08Inputs,
  seedKeywords: string[],
): Promise<AgentSession> {
  kga08InputSchema.parse(inputs);
  const session: AgentSession = {
    sessionId: context.sessionId,
    agentCode: 'AGT-SEO-KGA-08',
    startedAt: new Date(),
    steps: [],
    output: null,
  };

  // Step 1 — Fruits mûrs (GSC pos. 4-15)
  const lowHanging = await collectLowHangingFruit(inputs, context.clientProfile.id);
  session.steps.push({
    id: 'low_hanging',
    name: 'Fruits mûrs GSC (pos. 4-15)',
    status: inputs.gscConnected ? 'done' : 'skipped',
  });

  // Step 2 — Expand KW research
  const expanded = await expandKeywords(inputs, seedKeywords, context.clientProfile.id);
  session.steps.push({
    id: 'expand_kw',
    name: 'GEO keyword expansion',
    status: expanded.length > 0 ? 'done' : 'error',
  });

  if (expanded.length === 0 && lowHanging.length === 0) {
    session.output = { error: 'Aucun mot-clé collecté — DataForSEO indisponible' };
    return session;
  }

  const allKw = [...lowHanging, ...expanded];

  // Step 3 — Score GEO markets
  const geoMarketScores = scoreGeoMarkets(inputs, allKw);
  session.steps.push({ id: 'geo_scoring', name: 'Scoring marchés GEO', status: 'done' });

  // Step 4 — City landing pages
  const cityLandingPages = detectCityLandingPages(inputs, allKw);
  session.steps.push({
    id: 'city_pages',
    name: 'Détection city landing pages',
    status: 'done',
  });

  // Step 5 — Action plan + cluster map
  const actionPlan = buildActionPlan(allKw);
  const clusterMap = buildClusterMap(allKw);
  session.steps.push({ id: 'action_plan', name: "Plan d'action 90 jours", status: 'done' });

  // Step 6 — GBP audit (optional)
  const gbpAudit = inputs.gbpId ? await buildGbpAudit(inputs.gbpId, inputs) : undefined;
  if (inputs.gbpId) {
    session.steps.push({ id: 'gbp', name: 'Audit Google Business Profile', status: 'done' });
  }

  // Step 7 — Hreflang plan (optional)
  const hreflangPlan = await buildHreflangPlan(inputs);
  if (inputs.multiCountry) {
    session.steps.push({
      id: 'hreflang',
      name: `Plan architecture hreflang (${hreflangPlan.errors.length} erreur${hreflangPlan.errors.length !== 1 ? 's' : ''})`,
      status: 'done',
    });
  }

  const output: Kga08Output = {
    kwScores: allKw,
    geoMarketScores,
    cityLandingPages,
    actionPlan,
    clusterMap,
    gbpAudit,
    hreflangPlan,
  };

  session.output = output;
  return session;
}

export { KGA08_SYSTEM_PROMPT };
export * from './types';
