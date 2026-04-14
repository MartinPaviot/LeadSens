'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui-brand-intel/button'
import { Input } from '@/components/ui-brand-intel/input'
import { Label } from '@/components/ui-brand-intel/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { toast } from 'sonner'
import { Paperclip, X } from '@phosphor-icons/react'

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300' },
] as const

type Urgency = (typeof URGENCY_LEVELS)[number]['value']

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif,application/pdf'

export default function ContactPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [subject, setSubject] = useState('')
  const [cc, setCc] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('medium')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('File too large (max 10 MB)')
      return
    }
    setFile(selected)
  }

  const removeFile = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject.trim()) {
      toast.error('Subject is required')
      return
    }
    if (!message.trim()) {
      toast.error('Message is required')
      return
    }

    setSending(true)
    try {
      const formData = new FormData()
      formData.append('subject', subject.trim())
      formData.append('urgency', urgency)
      formData.append('message', message.trim())
      if (cc.trim()) formData.append('cc', cc.trim())
      if (file) formData.append('attachment', file)

      const res = await fetch('/api/contact', { method: 'POST', body: formData })
      const text = await res.text()
      const body: unknown = text ? JSON.parse(text) : {}

      if (!res.ok) {
        throw new Error(((body as Record<string, unknown>).error as string) ?? 'Failed to send')
      }

      toast.success('Message sent! We\'ll get back to you soon.')
      setSubject('')
      setCc('')
      setUrgency('medium')
      setMessage('')
      removeFile()
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Failed to send'}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 flex items-center gap-3 shrink-0" style={{ height: '48px', minHeight: '48px' }}>
        <button
          onClick={() => router.back()}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256">
            <path fill="currentColor" d="M224 128a8 8 0 0 1-8 8H59.31l58.35 58.34a8 8 0 0 1-11.32 11.32l-72-72a8 8 0 0 1 0-11.32l72-72a8 8 0 0 1 11.32 11.32L59.31 120H216a8 8 0 0 1 8 8Z"/>
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Contact the team</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-elevay-mesh">
        <div className="max-w-3xl mx-auto p-6">
          <p className="text-sm text-muted-foreground mb-6 text-center">
            Have a question, feedback, or need help? Send us a message and we&apos;ll get back to you as soon as possible.
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Your message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What is this about?"
                    required
                  />
                </div>

                {/* CC */}
                <div className="space-y-2">
                  <Label htmlFor="cc">CC <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="cc"
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="colleague@company.com, other@company.com"
                  />
                </div>

                {/* Urgency */}
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <div className="flex flex-wrap gap-2">
                    {URGENCY_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setUrgency(level.value)}
                        className={`
                          rounded-full px-3 py-1.5 text-sm font-medium border transition-colors
                          ${urgency === level.value
                            ? level.color
                            : 'bg-muted text-muted-foreground border-transparent hover:border-gray-300'
                          }
                        `}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your question, issue, or feedback..."
                    required
                    rows={6}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[120px]"
                  />
                </div>

                {/* Attachment */}
                <div className="space-y-2">
                  <Label>Attachment <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  {file ? (
                    <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
                      <Paperclip className="size-4 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 w-full rounded-md border border-dashed border-input px-3 py-3 text-sm text-muted-foreground hover:border-gray-400 hover:text-foreground transition-colors"
                    >
                      <Paperclip className="size-4 shrink-0" />
                      <span>Add a screenshot or file (max 10 MB)</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              disabled={sending}
              className="w-full text-white font-semibold"
              style={{ background: 'var(--elevay-gradient-btn)' }}
            >
              {sending ? 'Sending...' : 'Send message'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
