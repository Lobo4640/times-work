interface SpinnerProps {
  size?: number
  color?: string
}

export default function LoadingSpinner({ size = 24, color = '#C9A84C' }: SpinnerProps) {
  return (
    <div
      className="rounded-full border-2 border-transparent animate-spin"
      style={{
        width: size,
        height: size,
        borderTopColor: color,
        borderRightColor: `${color}44`,
      }}
    />
  )
}
