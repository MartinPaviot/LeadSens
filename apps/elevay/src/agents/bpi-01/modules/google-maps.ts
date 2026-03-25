import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { GoogleMapsData, SentimentData } from "../types";
import { TTL } from "../../_shared/cache";

// ─── Cache ────────────────────────────────────────────────────────────────────

/** Cache in-memory V1 — clé `gmaps:${brandName}:${country}` */
const gmapsCache = new Map<string, { data: GoogleMapsData; fetchedAt: number }>();

// ─── Types internes ───────────────────────────────────────────────────────────

interface PlaceResult {
  id: string
  displayName?: { text: string }
  rating?: number
  userRatingCount?: number
  formattedAddress?: string
}

interface ReviewEntry {
  authorAttribution?: { displayName?: string }
  rating?: number
  text?: { text?: string; languageCode?: string }
  relativePublishTimeDescription?: string
}

interface PlaceDetails {
  id: string
  displayName?: { text: string }
  rating?: number
  userRatingCount?: number
  reviews?: ReviewEntry[]
  websiteUri?: string
}

interface ReviewNormalized {
  author: string
  rating: number
  text: string
  time: string
  language: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Trouve le Place ID d'une marque via Places API (New) Text Search.
 * Retourne le premier résultat ou null si non trouvé.
 */
async function searchPlace(
  brandName: string,
  _brandUrl: string,
  country: string,
): Promise<PlaceResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.rating",
        "places.userRatingCount",
        "places.formattedAddress",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: `${brandName} ${country}`,
      languageCode: "fr",
      maxResultCount: 1,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as { places?: PlaceResult[] };
  return data.places?.[0] ?? null;
}

/**
 * Récupère les détails et avis d'un lieu via Place Details.
 * Retourne null si l'appel échoue.
 */
async function getPlaceReviews(placeId: string): Promise<{
  place_id: string
  name: string
  rating: number
  review_count: number
  reviews: ReviewNormalized[]
  website: string
} | null> {
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "id",
          "displayName",
          "rating",
          "userRatingCount",
          "reviews",
          "regularOpeningHours",
          "websiteUri",
        ].join(","),
      },
    },
  );

  if (!res.ok) return null;
  const place = await res.json() as PlaceDetails;

  return {
    place_id: place.id,
    name: place.displayName?.text ?? "",
    rating: place.rating ?? 0,
    review_count: place.userRatingCount ?? 0,
    reviews: (place.reviews ?? []).map((r) => ({
      author: r.authorAttribution?.displayName ?? "Anonymous",
      rating: r.rating ?? 3,
      text: r.text?.text ?? "",
      time: r.relativePublishTimeDescription ?? "",
      language: r.text?.languageCode ?? "fr",
    })),
    website: place.websiteUri ?? "",
  };
}

/**
 * Analyse le sentiment des avis sans appel LLM — basé uniquement sur la note.
 * positive : rating >= 4
 * neutral  : rating === 3
 * negative : rating <= 2
 */
function analyzeSentiment(reviews: { rating: number }[]): SentimentData {
  let positive = 0;
  let neutral = 0;
  let negative = 0;

  for (const r of reviews) {
    if (r.rating >= 4) positive++;
    else if (r.rating === 3) neutral++;
    else negative++;
  }

  const dominant =
    positive >= negative && positive >= neutral
      ? "positive"
      : negative > positive && negative >= neutral
        ? "negative"
        : "neutral";

  return { positive, neutral, negative, dominant };
}

/**
 * Score réputation /100 :
 * - Note /5 * 40      = max 40pts (note moyenne)
 * - Volume capped/100 * 30 = max 30pts (volume d'avis)
 * - Ratio positif * 30     = max 30pts (sentiment)
 */
function calculateReputationScore(
  rating: number,
  reviewCount: number,
  sentiment: SentimentData,
): number {
  const ratingScore   = (rating / 5) * 40;
  const volumeScore   = Math.min(reviewCount / 100, 1) * 30;
  const total         = sentiment.positive + sentiment.neutral + sentiment.negative;
  const sentimentScore = total > 0 ? (sentiment.positive / total) * 30 : 0;
  return Math.round(ratingScore + volumeScore + sentimentScore);
}

// ─── Module ───────────────────────────────────────────────────────────────────

/**
 * Module Google Maps — Réputation & avis clients
 * Source : Places API (New)
 * Cache : 24h, clé `gmaps:${brandName}:${country}`
 * Retry : ×1 si erreur réseau
 */
export async function fetchGoogleMapsReputation(
  profile: ElevayAgentProfile,
): Promise<ModuleResult<GoogleMapsData>> {
  if (!process.env.GOOGLE_MAPS_KEY) {
    return {
      success: false,
      data: { found: false, degraded: true },
      source: "gmaps:no-key",
      degraded: true,
      error: { code: "NO_API_KEY", message: "GOOGLE_MAPS_KEY absent" },
    };
  }

  const cacheKey = `gmaps:${profile.brand_name}:${profile.country}`;
  const cached = gmapsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < TTL.BENCHMARK * 1000) {
    return { success: true, data: cached.data, source: "gmaps:cache" };
  }

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const place = await searchPlace(
        profile.brand_name,
        profile.brand_url,
        profile.country,
      );

      if (!place) {
        console.log("[gmaps] Place not found for:", profile.brand_name);
        const notFound: GoogleMapsData = { found: false, degraded: false };
        return { success: true, data: notFound, source: "gmaps:places-api" };
      }

      console.log("[gmaps] Place found:", place.displayName?.text);

      const details = await getPlaceReviews(place.id);
      if (!details) {
        const notFound: GoogleMapsData = { found: false, degraded: false };
        return { success: true, data: notFound, source: "gmaps:places-api" };
      }

      console.log("[gmaps] Rating:", details.rating, "Reviews:", details.review_count);

      const sentiment        = analyzeSentiment(details.reviews);
      const reputation_score = calculateReputationScore(
        details.rating,
        details.review_count,
        sentiment,
      );

      console.log("[gmaps] Reputation score:", reputation_score);

      const top_positive_reviews = details.reviews
        .filter((r) => r.rating >= 4 && r.text.trim())
        .slice(0, 3)
        .map((r) => r.text);

      const top_negative_reviews = details.reviews
        .filter((r) => r.rating <= 2 && r.text.trim())
        .slice(0, 3)
        .map((r) => r.text);

      const result: GoogleMapsData = {
        found: true,
        place_id: details.place_id,
        name: details.name,
        rating: details.rating,
        review_count: details.review_count,
        sentiment,
        reputation_score,
        top_positive_reviews,
        top_negative_reviews,
        degraded: false,
      };

      gmapsCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
      return { success: true, data: result, source: "gmaps:places-api" };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      const message = err instanceof Error ? err.message : "Google Maps error";
      console.error("[gmaps] Error after retry:", message);
      return {
        success: false,
        data: { found: false, degraded: true },
        source: "gmaps:places-api",
        degraded: true,
        error: { code: "FETCH_ERROR", message },
      };
    }
  }

  // Unreachable — required by TypeScript exhaustiveness
  return {
    success: false,
    data: { found: false, degraded: true },
    source: "gmaps:places-api",
    degraded: true,
    error: { code: "UNKNOWN", message: "Unexpected exit from retry loop" },
  };
}
