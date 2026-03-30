'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'ok' | 'err' | 'info'

interface ToastProps {
  message: string
  type: ToastType
  onDismiss?: () => void
  duration?: number
}

const styles: Record<ToastType, { bg: string; border: string; color: string; Icon: any }> = {
  ok: {
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    color: '#10B981',
    Icon: CheckCircle,
  },
  err: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    color: '#EF4444',
    Icon: AlertCircle,
  },
  info: {
    bg: 'rgba(0,229,255,0.08)',
    border: 'rgba(0,229,255,0.25)',
    color: '#00E5FF',
    Icon: Info,
  },
}

export default function Toast({ message, type, onDismiss, duration = 3500 }: ToastProps) {
  const [visible, setVisible] = useState(false)
  const { bg, border, color, Icon } = styles[type]

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss?.(), 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ color, opacity: 0.6 }}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
