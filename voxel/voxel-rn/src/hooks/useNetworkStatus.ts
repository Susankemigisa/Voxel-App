import { useEffect, useState, useRef } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function checkOnline() {
    try {
      const res = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        cache: 'no-cache',
      })
      setIsOnline(res.status === 204 || res.ok)
    } catch {
      setIsOnline(false)
    }
  }

  useEffect(() => {
    checkOnline()
    // Poll every 10 seconds
    intervalRef.current = setInterval(checkOnline, 10_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { isOnline }
}
