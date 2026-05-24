import { useState, useEffect, useRef } from 'react'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { QrCode, RefreshCw, Copy, Check, Clock } from 'lucide-react'

const INVITE_DURATION = 100

export default function GenerateInvite() {
  const [code, setCode] = useState(null)
  const [timeLeft, setTimeLeft] = useState(INVITE_DURATION)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)

  const startCountdown = (secondsLeft) => {
    clearInterval(intervalRef.current)
    setTimeLeft(secondsLeft)
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current)
          setCode(null)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const generateCode = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/invite/generate')
      setCode(data.code)
      startCountdown(data.expiresInSeconds)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate code.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const copyCode = () => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const circumference = 2 * Math.PI * 45
  const strokeOffset = circumference * (1 - timeLeft / INVITE_DURATION)
  const urgency = timeLeft > 60 ? 'text-success' : timeLeft > 30 ? 'text-warn' : 'text-danger'
  const ringColor = timeLeft > 60 ? '#00ff88' : timeLeft > 30 ? '#ffaa00' : '#ff4466'

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text mb-1">Generate Invite Code</h1>
          <p className="text-text-dim text-sm font-mono">
            Create a one-time, 100-second invite code to share with someone
          </p>
        </div>

        <div className="panel p-8 text-center mb-6">
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded px-4 py-3 mb-4 font-mono text-sm">
              {error}
            </div>
          )}

          {!code ? (
            <>
              <div className="w-20 h-20 rounded-full bg-void border border-border flex items-center justify-center mx-auto mb-6">
                <QrCode className="w-9 h-9 text-muted" />
              </div>
              <p className="text-text-dim font-mono text-sm mb-8">
                No active invite code. Generate one to share.
              </p>
              <button
                onClick={generateCode}
                disabled={loading}
                className="btn-primary px-8 disabled:opacity-60"
              >
                {loading ? 'Generating...' : 'Generate Code'}
              </button>
            </>
          ) : (
            <>
              {/* Countdown ring */}
              <div className="relative w-32 h-32 mx-auto mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#1e1e30" strokeWidth="4" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke={ringColor} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={strokeOffset}
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Clock className={`w-4 h-4 ${urgency} mb-0.5`} />
                  <span className={`font-mono font-bold text-xl ${urgency}`}>{timeLeft}s</span>
                </div>
              </div>

              <div className="code-block text-2xl tracking-[0.3em] mb-3 select-all">
                {code.slice(0, 3)}&nbsp;{code.slice(3)}
              </div>

              <p className="text-text-dim text-xs font-mono mb-6">
                Share this code. It expires when the timer hits zero.
              </p>

              <div className="flex gap-3 justify-center">
                <button onClick={copyCode} className="btn-primary flex items-center gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
                <button
                  onClick={generateCode}
                  disabled={loading}
                  className="btn-ghost flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          {[
            'Code valid for exactly 100 seconds',
            'Can only be used once by one person',
            'Both parties must approve to connect',
            'Code invalidated after successful use',
          ].map((tip) => (
            <div key={tip} className="flex items-center gap-3 text-text-dim text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              {tip}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}