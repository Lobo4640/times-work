'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Root() {
  const router = useRouter()
  useEffect(() => { router.replace('/clock') }, [router])
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="w-8 h-8 border-2 border-gold rounded-full border-t-transparent animate-spin" />
    </div>
  )
}
