import type { CRMConfig, TimingSlot } from "../core/types"
import { TIMING_DEFAULTS } from "../core/constants"

export interface TimingProposal {
  date: string // ISO date
  time: string // HH:mm
  score: number // 0-100 confidence
  reason: string
}

/**
 * Calculate optimal send timing based on historical open rates.
 * Returns top 3 timing proposals with justification.
 */
export function calculateOptimalTiming(
  config: CRMConfig,
  preferredDate?: string,
  preferredTime?: string,
): TimingProposal[] {
  const proposals: TimingProposal[] = []

  if (config.bestTimings.length > 0) {
    // Use historical data
    const sorted = [...config.bestTimings].sort(
      (a, b) => b.openRate - a.openRate,
    )

    for (const slot of sorted.slice(0, 3)) {
      const nextDate = getNextOccurrence(slot.day)
      proposals.push({
        date: nextDate,
        time: slot.hour,
        score: Math.round(slot.openRate * 100),
        reason: `Best historical open rate (${(slot.openRate * 100).toFixed(1)}%) on ${slot.day} at ${slot.hour}`,
      })
    }
  } else {
    // Use defaults
    for (let i = 0; i < 3; i++) {
      const day = TIMING_DEFAULTS.bestDays[i]
      const hour = TIMING_DEFAULTS.bestHours[i]
      if (day && hour) {
        proposals.push({
          date: getNextOccurrence(day),
          time: hour,
          score: 70 - i * 10,
          reason: `Industry best practice: ${day} at ${hour}`,
        })
      }
    }
  }

  // If user has a preference, add it with adjusted score
  if (preferredDate && preferredTime) {
    proposals.unshift({
      date: preferredDate,
      time: preferredTime,
      score: 85,
      reason: "Requested by client",
    })
  }

  return proposals.slice(0, 3)
}

function getNextOccurrence(dayName: string): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  const today = new Date()
  const targetDay = days.indexOf(dayName)
  if (targetDay === -1) return today.toISOString().split("T")[0]

  const currentDay = today.getDay()
  let daysAhead = targetDay - currentDay
  if (daysAhead <= 0) daysAhead += 7

  const next = new Date(today)
  next.setDate(today.getDate() + daysAhead)
  return next.toISOString().split("T")[0]
}

/**
 * Check if a proposed timing conflicts with existing campaigns.
 * Conflict = another campaign within 2 hours of the proposed time.
 */
export function checkCalendarConflict(
  proposedDate: string,
  proposedTime: string,
  existingCampaigns: Array<{ scheduledAt: string }>,
): boolean {
  const proposedMs = new Date(`${proposedDate}T${proposedTime}`).getTime()
  if (isNaN(proposedMs)) return false

  const CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 hours

  return existingCampaigns.some((c) => {
    const existingMs = new Date(c.scheduledAt).getTime()
    if (isNaN(existingMs)) return false
    return Math.abs(proposedMs - existingMs) < CONFLICT_WINDOW_MS
  })
}
