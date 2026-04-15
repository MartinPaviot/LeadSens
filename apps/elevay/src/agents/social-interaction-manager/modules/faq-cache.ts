import type { FAQEntry } from "../core/types"

export class FAQCache {
  private entries: Map<string, FAQEntry> = new Map()

  load(entries: FAQEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.id, entry)
    }
  }

  get(id: string): FAQEntry | undefined {
    return this.entries.get(id)
  }

  getAll(): FAQEntry[] {
    return [...this.entries.values()]
  }

  add(entry: FAQEntry): void {
    this.entries.set(entry.id, entry)
  }

  remove(id: string): boolean {
    return this.entries.delete(id)
  }

  /** Fuzzy match incoming message against FAQ keywords. */
  match(messageContent: string): FAQEntry | null {
    const lower = messageContent.toLowerCase()
    let bestMatch: FAQEntry | null = null
    let bestScore = 0

    for (const entry of this.entries.values()) {
      const matchedKeywords = entry.keywords.filter((kw) =>
        lower.includes(kw.toLowerCase()),
      )
      const score = matchedKeywords.length / entry.keywords.length

      if (score > bestScore && score >= 0.5) {
        bestScore = score
        bestMatch = entry
      }
    }

    return bestMatch
  }

  incrementHit(id: string): void {
    const entry = this.entries.get(id)
    if (entry) {
      entry.hitCount++
    }
  }
}
