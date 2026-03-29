import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const sizes = {
  sm: 32,
  md: 56,
  lg: 80,
  xl: 120,
}

export default function Logo({ size = 'md', showText = false, className = '' }: LogoProps) {
  const px = sizes[size]

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: px, height: px }}>
        <Image
          src="/icon.png"
          alt="Times Work"
          width={px}
          height={px}
          priority
          className="object-contain"
          style={{
            filter: 'drop-shadow(0 0 12px rgba(201,168,76,0.3))',
          }}
        />
      </div>
      {showText && (
        <div className="text-center">
          <div
            className="font-bold tracking-[0.15em] uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: size === 'xl' ? '22px' : '14px',
              color: '#C9A84C',
              textShadow: '0 0 20px rgba(201,168,76,0.4)',
            }}
          >
            Times Work
          </div>
          <div
            className="tracking-wider text-center"
            style={{
              fontSize: size === 'xl' ? '11px' : '9px',
              color: '#8B6914',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            Tiempo de Trabajo
          </div>
        </div>
      )}
    </div>
  )
}
