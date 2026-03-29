'use client'
import { useCallback } from 'react'

export function useNotifications() {
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    const result = await Notification.requestPermission()
    return result === 'granted'
  }, [])

  const scheduleAlert = useCallback((elapsedSeconds: number, sessionActive: boolean) => {
    if (!sessionActive) return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then(reg => {
      // 3h 45min = 13500s → alert at 13500s
      const msTo4h = Math.max(0, (3 * 3600 + 45 * 60 - elapsedSeconds)) * 1000
      const msTo8h = Math.max(0, (7 * 3600 + 45 * 60 - elapsedSeconds)) * 1000

      if (msTo4h > 0 && reg.active) {
        reg.active.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          payload: {
            delay: msTo4h,
            title: '⏰ Times Work · Aviso de Jornada',
            body: 'Faltan 15 minutos para completar 4 horas. Recuerda tu derecho a descanso (Art. 34.4 ET).',
            tag: 'alert-4h',
          },
        })
      }

      if (msTo8h > 0 && reg.active) {
        reg.active.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          payload: {
            delay: msTo8h,
            title: '⏰ Times Work · Jornada Completa',
            body: 'Faltan 15 minutos para las 8 horas máximas legales (RD 8/2019).',
            tag: 'alert-8h',
          },
        })
      }
    })
  }, [])

  const cancelAlerts = useCallback(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({ type: 'CANCEL_NOTIFICATIONS' })
    })
  }, [])

  return { requestPermission, scheduleAlert, cancelAlerts }
}
