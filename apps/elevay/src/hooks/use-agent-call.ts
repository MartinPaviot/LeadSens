'use client'

import { useState, useCallback, useRef } from 'react'

export interface NoConfigState {
  missing: string[]
  tab: string
}

export type AgentCallState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'streaming'; data: Partial<T> }
  | { status: 'success'; data: T }
  | { status: 'no-config'; missing: string[]; tab: string }
  | { status: 'error'; message: string }

interface SSECallbacks<T> {
  onStatus?: (payload: { step: number | string; label?: string; message?: string }) => void
  onResult?: (payload: unknown) => void
  onTextDelta?: (delta: string) => void
  onComplete?: (data: T) => void
}

/**
 * Generic hook for calling Elevay agent routes.
 * Handles NO_CONFIG detection, SSE streaming, and error states.
 *
 * Suppresses toast errors for NO_CONFIG — the calling component should
 * render <NoConfigBanner /> when `state.status === 'no-config'`.
 */
export function useAgentCall<T = unknown>(endpoint: string) {
  const [state, setState] = useState<AgentCallState<T>>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(
    async (body?: unknown, callbacks?: SSECallbacks<T>) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({ status: 'loading' })

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as Record<string, unknown>

          if (json.error === 'NO_CONFIG') {
            setState({
              status: 'no-config',
              missing: (json.missing as string[]) ?? [],
              tab: (json.tab as string) ?? 'company',
            })
            return
          }

          setState({
            status: 'error',
            message: (json.message as string) ?? (json.error as string) ?? `Error ${res.status}`,
          })
          return
        }

        const contentType = res.headers.get('content-type') ?? ''

        if (contentType.includes('text/event-stream')) {
          await consumeSSE(res, setState, callbacks, controller.signal)
        } else {
          const data = (await res.json()) as T
          callbacks?.onComplete?.(data)
          setState({ status: 'success', data })
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState({ status: 'error', message: (err as Error).message ?? 'Unknown error' })
      }
    },
    [endpoint],
  )

  const runGet = useCallback(
    async (callbacks?: SSECallbacks<T>) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({ status: 'loading' })

      try {
        const res = await fetch(endpoint, { signal: controller.signal })

        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as Record<string, unknown>
          if (json.error === 'NO_CONFIG') {
            setState({
              status: 'no-config',
              missing: (json.missing as string[]) ?? [],
              tab: (json.tab as string) ?? 'company',
            })
            return
          }
          setState({ status: 'error', message: (json.message as string) ?? `Error ${res.status}` })
          return
        }

        const data = (await res.json()) as T
        callbacks?.onComplete?.(data)
        setState({ status: 'success', data })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState({ status: 'error', message: (err as Error).message ?? 'Unknown error' })
      }
    },
    [endpoint],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({ status: 'idle' })
  }, [])

  return { state, run, runGet, reset }
}

async function consumeSSE<T>(
  res: Response,
  setState: (s: AgentCallState<T>) => void,
  callbacks: SSECallbacks<T> | undefined,
  signal: AbortSignal,
) {
  const reader = res.body?.getReader()
  if (!reader) {
    setState({ status: 'error', message: 'No response body' })
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = '' // for text-delta streaming
  let lastData: T | null = null

  setState({ status: 'streaming', data: {} as Partial<T> })

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let event = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          event = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6)
          try {
            const data = JSON.parse(raw) as Record<string, unknown>
            switch (event) {
              case 'status':
                callbacks?.onStatus?.(data as Parameters<NonNullable<SSECallbacks<T>['onStatus']>>[0])
                break
              case 'result':
                callbacks?.onResult?.(data)
                break
              case 'text-delta':
                accumulated += (data.delta as string) ?? ''
                break
              case 'complete':
                lastData = data as T
                callbacks?.onComplete?.(lastData)
                break
              case 'finish':
                break
              case 'error':
                setState({ status: 'error', message: (data.message as string) ?? 'Agent error' })
                return
            }
          } catch {
            // ignore unparseable lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (lastData) {
    setState({ status: 'success', data: lastData })
  } else if (accumulated) {
    setState({ status: 'success', data: { text: accumulated } as unknown as T })
  } else {
    setState({ status: 'success', data: {} as T })
  }
}
