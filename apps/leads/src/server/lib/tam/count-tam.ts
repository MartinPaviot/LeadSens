/**
 * TAM Engine — Apollo TAM Count.
 *
 * Uses Apollo People Search (direct API) with per_page=1 to get
 * total_entries counts. Costs $0 per query.
 */

import { searchPeople } from "@/server/lib/connectors/apollo";
import { logger } from "@/lib/logger";
import type { InferredICP } from "./infer-icp";

// ─── Types ───────────────────────────────────────────────

export interface TAMCount {
  total: number;
  byRole: Array<{ role: string; count: number }>;
  byGeo: Array<{ region: string; count: number }>;
  bySize: Array<{ label: string; min: number; max: number; count: number }>;
}

// ─── Size Ranges ─────────────────────────────────────────

const SIZE_RANGES = [
  { label: "1-50", min: 1, max: 50 },
  { label: "51-200", min: 51, max: 200 },
  { label: "201-1000", min: 201, max: 1000 },
  { label: "1001-5000", min: 1001, max: 5000 },
  { label: "5001+", min: 5001, max: 100000 },
] as const;

// ─── Count Function ──────────────────────────────────────

function getApolloKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY not set in environment");
  return key;
}

/**
 * Count TAM via Apollo People Search (per_page=1 to get total_entries).
 * Makes separate queries per role × geo combination for breakdown.
 */
export async function countTAM(
  icp: InferredICP,
  _workspaceId: string,
): Promise<TAMCount> {
  const apolloKey = getApolloKey();
  const roles = icp.roles.slice(0, 5);
  const geos = icp.companies.geography.length > 0
    ? icp.companies.geography.slice(0, 5)
    : ["United States"];

  // Build title list for search
  const allTitles = roles.flatMap((r) => [r.title, ...r.variations]);
  const empRange = `${icp.companies.employeeRange.min},${icp.companies.employeeRange.max}`;

  // Main count: all roles × all geos
  const totalCount = await countPeopleDirect(apolloKey, {
    titles: allTitles,
    locations: geos,
    employeeRange: empRange,
  });

  // Breakdown by role (parallel)
  const byRolePromises = roles.map(async (role) => {
    const titles = [role.title, ...role.variations];
    const count = await countPeopleDirect(apolloKey, {
      titles,
      locations: geos,
      employeeRange: empRange,
    });
    return { role: role.title, count };
  });

  // Breakdown by geo (parallel)
  const byGeoPromises = geos.map(async (region) => {
    const count = await countPeopleDirect(apolloKey, {
      titles: allTitles,
      locations: [region],
      employeeRange: empRange,
    });
    return { region, count };
  });

  // Breakdown by size (parallel, use relevant ranges)
  const relevantSizes = SIZE_RANGES.filter(
    (s) => s.min <= icp.companies.employeeRange.max && s.max >= icp.companies.employeeRange.min,
  );

  const bySizePromises = relevantSizes.map(async (size) => {
    const count = await countPeopleDirect(apolloKey, {
      titles: allTitles,
      locations: geos,
      employeeRange: `${size.min},${size.max}`,
    });
    return { label: size.label, min: size.min, max: size.max, count };
  });

  const [byRole, byGeo, bySize] = await Promise.all([
    Promise.all(byRolePromises),
    Promise.all(byGeoPromises),
    Promise.all(bySizePromises),
  ]);

  return {
    total: totalCount,
    byRole,
    byGeo,
    bySize,
  };
}

// ─── Direct Apollo Count Helper ──────────────────────────

interface CountParams {
  titles: string[];
  locations: string[];
  employeeRange: string;
}

/**
 * Count people matching criteria via Apollo People Search (per_page=1).
 * Uses totalEntries from the response pagination.
 * Returns 0 on failure (graceful degradation).
 */
async function countPeopleDirect(
  apolloKey: string,
  params: CountParams,
): Promise<number> {
  try {
    const result = await searchPeople(apolloKey, {
      person_titles: params.titles,
      person_locations: params.locations,
      organization_num_employees_ranges: [params.employeeRange],
      per_page: 1,
      page: 1,
    });

    return result?.totalEntries ?? 0;
  } catch (err) {
    logger.warn("[tam/count] Apollo count failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
