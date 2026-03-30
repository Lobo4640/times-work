'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, ListOrdered, User } from 'lucide-react'

const tabs = [
  { href: '/clock', icon: Clock, label: 'Reloj' },
  { href: '/history', icon: ListOrdered, label: 'Lista' },
  { href: '/profile', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="flex-shrink-0"
      style={{
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(201,168,76,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all duration-200"
              style={{
                background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
              }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2 : 1.5}
                style={{
                  color: active ? '#C9A84C' : '#4A4A5A',
                  filter: active ? 'drop-shadow(0 0 6px #C9A84C88)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              />
              <span
                className="text-[10px] font-medium tracking-widest uppercase"
                style={{ color: active ? '#C9A84C' : '#4A4A5A', transition: 'color 0.2s' }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
