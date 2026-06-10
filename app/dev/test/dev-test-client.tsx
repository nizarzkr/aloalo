'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MOCK_TRANSCRIPTS } from '@/lib/dev/mock-transcripts'

// Composant client du simulateur. Le gating prod/dev est fait par le Server
// Component parent (page.tsx) qui appelle notFound() en production — un
// 'use client' ne peut pas lire l'env serveur en sécurité.

type SimResult = {
  success: boolean
  transcript_used: string
  webhook_status: number
  webhook_response: Record<string, unknown>
}

export function DevTestClient() {
  const router = useRouter()
  const [loading, setLoading] = useState<number | null>(null)
  const [results, setResults] = useState<SimResult[]>([])

  async function simulateCall(index: number) {
    setLoading(index)
    try {
      const res = await fetch('/api/dev/simulate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptIndex: index }),
      })
      const data = await res.json()
      // Sur succès, on file direct sur la liste des appels — l'appel apparaît
      // en "pending" puis bascule en "analyzed" au bout de 30-60s (refresh
      // manuel nécessaire, pas de live updates). En échec, on reste sur la
      // page pour montrer le détail technique.
      if (data.success) {
        router.push('/dashboard/calls')
        return
      }
      setResults(prev => [{ ...data }, ...prev])
    } catch (err) {
      setResults(prev => [
        { success: false, transcript_used: MOCK_TRANSCRIPTS[index].title, webhook_status: 0, webhook_response: { error: String(err) } },
        ...prev
      ])
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      {/* Header */}
      <div className="max-w-2xl mx-auto">
        <div className="mb-2 inline-block bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
          DEV ONLY
        </div>
        <h1 className="text-2xl font-bold mb-1">Simulateur d&apos;appels</h1>
        <p className="text-gray-400 mb-8 text-sm">
          Déclenche un faux appel Ringover → le webhook reçoit le payload → un enregistrement est créé en base.
        </p>

        {/* Boutons de simulation */}
        <div className="space-y-3 mb-10">
          {MOCK_TRANSCRIPTS.map((transcript, index) => (
            <button
              key={transcript.id}
              onClick={() => simulateCall(index)}
              disabled={loading !== null}
              className="w-full text-left p-4 rounded-lg border border-gray-700 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{transcript.title}</div>
                  <div className="text-gray-400 text-xs mt-1 leading-relaxed">
                    {transcript.description}
                  </div>
                  <div className="text-gray-500 text-xs mt-2">
                    {Math.floor(transcript.duration_seconds / 60)} min {transcript.duration_seconds % 60}s
                    · {transcript.segments.length} répliques
                  </div>
                </div>
                {loading === index ? (
                  <div className="text-yellow-400 text-sm animate-pulse shrink-0">En cours…</div>
                ) : (
                  <div className="text-blue-400 text-sm shrink-0">▶ Simuler</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Résultats */}
        {results.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Résultats ({results.length})
            </h2>
            <div className="space-y-3">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border text-sm ${
                    result.success
                      ? 'border-green-700 bg-green-950'
                      : 'border-red-700 bg-red-950'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span>{result.success ? '✅' : '❌'}</span>
                    <span className="font-medium">{result.transcript_used}</span>
                    <span className="text-gray-400 ml-auto">HTTP {result.webhook_status}</span>
                  </div>
                  <pre className="text-xs text-gray-400 overflow-auto">
                    {JSON.stringify(result.webhook_response, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
