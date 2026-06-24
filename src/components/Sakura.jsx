import { useMemo } from 'react'

const PETAL_COUNT = 22

export default function Sakura() {
  const petals = useMemo(() =>
    Array.from({ length: PETAL_COUNT }, (_, i) => {
      const isGold   = i % 5 === 0
      const isBig    = i % 7 === 0
      return {
        id:       i,
        left:     Math.random() * 110 - 5,
        size:     isBig ? 10 + Math.random() * 6 : 5 + Math.random() * 7,
        duration: 14 + Math.random() * 16,
        delay:    -(Math.random() * 25),   // negative = already mid-flight on load
        drift:    -80 + Math.random() * 160,
        rotStart: Math.random() * 360,
        opacity:  isGold ? 0.55 + Math.random() * 0.3 : 0.35 + Math.random() * 0.4,
        isGold,
      }
    })
  , [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      pointerEvents: 'none',
      zIndex: 0,
      overflow: 'hidden',
    }}>
      {petals.map(p => (
        <div
          key={p.id}
          className="sakura-petal"
          style={{
            left:              `${p.left}%`,
            width:             `${p.size}px`,
            height:            `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
            opacity:           p.opacity,
            background: p.isGold
              ? 'radial-gradient(circle at 30% 30%, rgba(255,215,60,0.95), rgba(201,162,39,0.4))'
              : 'radial-gradient(circle at 30% 30%, rgba(220,70,80,0.95), rgba(170,30,40,0.35))',
            '--drift':     `${p.drift}px`,
            '--rot-start': `${p.rotStart}deg`,
          }}
        />
      ))}
    </div>
  )
}
