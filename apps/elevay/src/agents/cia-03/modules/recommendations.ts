import type { Threat, Opportunity, ActionPhase, RecommendationsContext, StrategicZone, CompetitorScore } from "../types";
import type { CiaSessionContext } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function zonesWithStatus(zones: StrategicZone[], statuses: StrategicZone["zone"][]): StrategicZone[] {
  return zones.filter(z => statuses.includes(z.zone));
}

function topCompetitorsByScore(scores: CompetitorScore[], topN = 2): CompetitorScore[] {
  return [...scores]
    .filter(s => !s.is_client)
    .sort((a, b) => b.global_score - a.global_score)
    .slice(0, topN);
}

function brandScore(scores: CompetitorScore[]): CompetitorScore | undefined {
  return scores.find(s => s.is_client);
}

// ── Threats ───────────────────────────────────────────────────────────────────

function buildThreats(
  zones: StrategicZone[],
  scores: CompetitorScore[],
): Threat[] {
  const threats: Threat[] = [];
  const brand = brandScore(scores);
  const topCompetitors = topCompetitorsByScore(scores);

  // Menace 1 — zones rouges = retard critique
  const redZones = zonesWithStatus(zones, ["red"]);
  for (const z of redZones.slice(0, 2)) {
    threats.push({
      description: `Retard critique sur l'axe ${z.axis} — concurrents significativement plus forts. ${z.directive}`,
      urgency:     "critical",
      source:      z.axis,
    });
  }

  // Menace 2 — concurrent dominant
  if (topCompetitors[0] && brand) {
    const gap = topCompetitors[0].global_score - brand.global_score;
    if (gap > 20) {
      threats.push({
        description: `${topCompetitors[0].entity} présente un écart de ${gap} points sur le score global — risque de captation marché à court terme`,
        urgency:     gap > 35 ? "critical" : "medium",
        source:      "benchmark",
      });
    }
  }

  // Menace 3 — zones saturées = pression concurrentielle
  const saturatedZones = zonesWithStatus(zones, ["saturated"]);
  if (saturatedZones.length > 0) {
    threats.push({
      description: `${saturatedZones.length} axe(s) saturé(s) (${saturatedZones.map(z => z.axis).join(", ")}) — différenciation difficile sans repositionnement`,
      urgency:     "medium",
      source:      "benchmark",
    });
  }

  return threats.slice(0, 3);
}

// ── Opportunities ─────────────────────────────────────────────────────────────

function buildOpportunities(
  zones: StrategicZone[],
  context: CiaSessionContext,
): Opportunity[] {
  const opportunities: Opportunity[] = [];

  // Zones vertes = quick wins
  const greenZones = zonesWithStatus(zones, ["green"]);
  for (const z of greenZones.slice(0, 2)) {
    opportunities.push({
      description: `Axe ${z.axis} faiblement exploité — prise de position rapide possible. ${z.directive}`,
      effort:      "low",
      impact:      "high",
      timeframe:   "< 30 jours",
    });
  }

  // Zones neutres selon l'objectif
  const neutralZones = zonesWithStatus(zones, ["neutral"]);
  if (context.objective === "retention" && neutralZones.length > 0) {
    const z = neutralZones[0];
    opportunities.push({
      description: `Axe ${z.axis} en position neutre — investissement modéré pour prendre la tête du secteur`,
      effort:      "medium",
      impact:      "medium",
      timeframe:   "30-60 jours",
    });
  }

  // Opportunity générique selon canaux prioritaires
  if (opportunities.length < 3) {
    const channelOpps: Record<string, Opportunity> = {
      SEO: {
        description: "Optimisation SEO ciblée sur les mots-clés à faible concurrence pour capturer du trafic organique qualifié",
        effort:      "medium",
        impact:      "high",
        timeframe:   "30-60 jours",
      },
      paid: {
        description: "Campagnes paid ciblées sur les audiences délaissées par les concurrents pour optimiser le CPL",
        effort:      "medium",
        impact:      "high",
        timeframe:   "< 30 jours",
      },
      social: {
        description: "Stratégie social media axée sur les formats et tons non exploités par les concurrents",
        effort:      "low",
        impact:      "medium",
        timeframe:   "< 30 jours",
      },
      product: {
        description: "Repositionnement messaging produit sur les angles différenciants non exploités",
        effort:      "low",
        impact:      "high",
        timeframe:   "< 30 jours",
      },
      global: {
        description: "Approche multi-canal coordonnée pour couvrir rapidement les zones d'opportunité identifiées",
        effort:      "high",
        impact:      "high",
        timeframe:   "30-60 jours",
      },
    };
    const channelOpp = context.priority_channels
      .map(ch => channelOpps[ch])
      .find(Boolean);
    if (channelOpp) opportunities.push(channelOpp);
  }

  return opportunities.slice(0, 3);
}

// ── Plan d'action 60 jours ────────────────────────────────────────────────────

function buildActionPlan(
  zones: StrategicZone[],
  context: CiaSessionContext,
): ActionPhase[] {
  const greenZones = zonesWithStatus(zones, ["green"]);
  const redZones   = zonesWithStatus(zones, ["red"]);

  // Phase 1 : J1-30 — selon objectif
  const phase1Actions: string[] = [];
  if (context.objective === "lead_gen" || context.objective === "acquisition") {
    // Exploiter les zones vertes (lead_gen = SEO/contenu, acquisition = social/paid)
    for (const z of greenZones.slice(0, 2)) {
      phase1Actions.push(`Prendre position sur l'axe ${z.axis} : ${z.directive}`);
    }
    phase1Actions.push(`Lancer des actions ${context.priority_channels.join(", ")} ciblées sur les zones d'opportunité`);
    phase1Actions.push("Auditer le messaging concurrent pour identifier les angles différenciants non exploités");
  } else if (context.objective === "retention") {
    // Combler les zones rouges
    for (const z of redZones.slice(0, 2)) {
      phase1Actions.push(`Rattrapage axe ${z.axis} : ${z.directive}`);
    }
    phase1Actions.push("Analyser les meilleures pratiques des leaders sur chaque axe déficitaire");
    phase1Actions.push("Établir des KPIs de parité concurrentielle pour chaque axe rouge");
  } else {
    // branding — vue équilibrée
    phase1Actions.push("Cartographier les forces et faiblesses actuelles par axe avec des métriques précises");
    phase1Actions.push("Identifier les quick wins à faible effort / fort impact pour valider la stratégie");
    phase1Actions.push("Documenter le positionnement actuel vs concurrents et construire le récit de marque");
  }

  // Phase 2 : J31-60 — consolidation
  const phase2Actions: string[] = [];
  if (context.objective === "lead_gen" || context.objective === "acquisition") {
    phase2Actions.push("Mesurer les premiers résultats et doubler sur les actions les plus performantes");
    phase2Actions.push(`Étendre la présence sur ${context.priority_channels.join(", ")} avec du contenu original`);
    phase2Actions.push("Tester 2-3 angles de messaging différenciants auprès de l'audience cible");
  } else if (context.objective === "retention") {
    phase2Actions.push("Consolider les gains sur les axes améliorés et attaquer un axe neutre");
    phase2Actions.push("Mettre en place un processus de veille concurrentielle mensuel");
    phase2Actions.push("Lancer des initiatives de thought leadership sur les axes stratégiques clés");
  } else {
    phase2Actions.push("Renforcer la cohérence de marque sur tous les canaux identifiés");
    phase2Actions.push("Démontrer la traction sur 2-3 métriques clés vs concurrents");
    phase2Actions.push("Définir la roadmap marketing 6 mois avec jalons mesurables");
  }

  return [
    {
      phase:     1,
      label:     "J1-30 — Lancement et quick wins",
      objective: context.objective === "lead_gen"
        ? "Générer les premiers leads qualifiés via les zones d'opportunité identifiées"
        : context.objective === "acquisition"
          ? "Lancer les premières campagnes d'acquisition sur les canaux prioritaires"
          : context.objective === "retention"
            ? "Combler les écarts critiques sur les axes déficitaires"
            : "Cartographier et documenter la position concurrentielle",
      actions: phase1Actions,
    },
    {
      phase:     2,
      label:     "J31-60 — Consolidation et accélération",
      objective: context.objective === "lead_gen"
        ? "Amplifier le pipeline de leads et optimiser le coût d'acquisition"
        : context.objective === "acquisition"
          ? "Étendre les canaux performants et améliorer le taux de conversion"
          : context.objective === "retention"
            ? "Atteindre la parité concurrentielle et initier la domination"
            : "Consolider la notoriété et mesurer l'impact sur la perception de marque",
      actions: phase2Actions,
    },
  ];
}

// ── Module principal (zéro appel API) ─────────────────────────────────────────

export function buildRecommendations(
  zones: StrategicZone[],
  scores: CompetitorScore[],
  context: CiaSessionContext,
  priorityChannels: string[],
  contentTypeToExploit: string,
  repositioningAngle: string,
): RecommendationsContext {
  const threats      = buildThreats(zones, scores);
  const opportunities = buildOpportunities(zones, context);
  const action_plan_template = buildActionPlan(zones, context);

  return {
    repositioning_angle:    repositioningAngle,
    priority_channels:      priorityChannels,
    content_type_to_exploit: contentTypeToExploit,
    threats,
    opportunities,
    action_plan_template,
  };
}
