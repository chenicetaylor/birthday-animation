import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { motion } from 'framer-motion'
import EnvelopeBody from './components/EnvelopeBody'
import EnvelopeBack from './components/EnvelopeBack'

/** Matches envelope layout in `EnvelopeBody` / `EnvelopeBack`. */
const DESIGN_W = 634
const DESIGN_H = 456

/**
 * Design-space bounding box used only for fitting the viewport.
 * Taller than the envelope so the invite can sit above the slot (peek / pull / settle)
 * without being clipped after `transform: scale(...)`.
 */
const FIT_CONTENT_W = 634
const FIT_CONTENT_H = 880

/** Multiply viewport-fitted scale — higher = larger envelope + card at start. */
const DISPLAY_SCALE_MULTIPLIER = 0.6

const flipTransition = {
  duration: 0.55,
  ease: [0.645, 0.045, 0.355, 1.0],
}

/** Show replay only after the back invite has been visible this long (ms). */
const REPLAY_SHOW_DELAY_MS = 3200

function useEnvelopeFitScale() {
  const mainRef = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = mainRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      const vv = window.visualViewport
      const h = vv?.height ? Math.min(el.clientHeight, vv.height) : el.clientHeight
      if (!w || !h) return
      const sx = w / FIT_CONTENT_W
      const sy = h / FIT_CONTENT_H
      const raw = Math.min(1, sx, sy)
      const clamped = Math.max(0.18, raw)
      setScale((prev) =>
        Math.abs(prev - clamped) > 0.002 ? clamped : prev,
      )
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)

    const vv = window.visualViewport
    vv?.addEventListener('resize', update)

    window.addEventListener('orientationchange', update)

    return () => {
      ro.disconnect()
      vv?.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return { mainRef, scale }
}

function App() {
  const [face, setFace] = useState('back')
  /** Bump to remount `EnvelopeBody` so flap / card / modal state fully resets. */
  const [envelopeResetKey, setEnvelopeResetKey] = useState(0)
  const [replayVisible, setReplayVisible] = useState(false)
  const replayShowTimerRef = useRef(null)
  const replayIconGradientId = `replay-icon-grad-${useId().replace(/:/g, '')}`
  const { mainRef, scale } = useEnvelopeFitScale()

  const displayScale = scale * DISPLAY_SCALE_MULTIPLIER
  /** Match `FIT_CONTENT_*` so peek / pull / settle above the envelope isn’t clipped. */
  const scaledW = FIT_CONTENT_W * displayScale
  const scaledH = FIT_CONTENT_H * displayScale

  const canFlipToFront = face === 'back'

  const handleEnvelopeActivate = () => {
    if (!canFlipToFront) return
    setFace('front')
  }

  const clearReplayShowTimer = useCallback(() => {
    if (replayShowTimerRef.current != null) {
      window.clearTimeout(replayShowTimerRef.current)
      replayShowTimerRef.current = null
    }
  }, [])

  const onBackInviteRevealActive = useCallback(
    (active) => {
      clearReplayShowTimer()
      if (!active) {
        setReplayVisible(false)
        return
      }
      replayShowTimerRef.current = window.setTimeout(() => {
        setReplayVisible(true)
        replayShowTimerRef.current = null
      }, REPLAY_SHOW_DELAY_MS)
    },
    [clearReplayShowTimer],
  )

  useEffect(() => () => clearReplayShowTimer(), [clearReplayShowTimer])

  const handleReplay = (e) => {
    e.stopPropagation()
    clearReplayShowTimer()
    setReplayVisible(false)
    setFace('back')
    setEnvelopeResetKey((k) => k + 1)
  }

  return (
    <main
      ref={mainRef}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        flex: 1,
        minHeight: '100dvh',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        backgroundColor: '#F5F5F5',
        position: 'relative',
      }}
    >
      {replayVisible ? (
        <motion.button
          type="button"
          aria-label="Replay from the beginning"
          onClick={handleReplay}
          initial={{ opacity: 0, scale: 0.82, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 22,
            mass: 0.7,
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          style={{
            position: 'fixed',
            right: 'max(10px, env(safe-area-inset-right))',
            bottom: 'max(10px, env(safe-area-inset-bottom))',
            zIndex: 2147483640,
            display: 'grid',
            placeItems: 'center',
            width: '52px',
            height: '52px',
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            filter: 'drop-shadow(0 3px 8px rgba(180, 60, 150, 0.35))',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{ display: 'block' }}
          >
            <defs>
              <linearGradient
                id={replayIconGradientId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#ff9ecf" />
                <stop offset="45%" stopColor="#d946a6" />
                <stop offset="100%" stopColor="#8e3d7a" />
              </linearGradient>
            </defs>
            <path
              stroke={`url(#${replayIconGradientId})`}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </motion.button>
      ) : null}
      <div
        role={canFlipToFront ? 'button' : 'presentation'}
        tabIndex={canFlipToFront ? 0 : -1}
        onClick={handleEnvelopeActivate}
        onKeyDown={(e) => {
          if (!canFlipToFront) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleEnvelopeActivate()
          }
        }}
        style={{
          perspective: '1000px',
          width: scaledW,
          height: scaledH,
          flexShrink: 0,
          cursor: canFlipToFront ? 'pointer' : 'default',
          overflow: 'visible',
          position: 'relative',
        }}
        aria-label={
          canFlipToFront ? 'Flip envelope to front' : 'Envelope front'
        }
        aria-disabled={!canFlipToFront}
      >
        <div
          style={{
            width: FIT_CONTENT_W,
            height: FIT_CONTENT_H,
            transform: `scale(${displayScale})`,
            transformOrigin: 'top left',
            overflow: 'visible',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: DESIGN_W,
              height: DESIGN_H,
              overflow: 'visible',
            }}
          >
          <motion.div
            animate={{ rotateY: face === 'back' ? 0 : 180 }}
            transition={flipTransition}
            style={{
              position: 'relative',
              width: DESIGN_W,
              height: DESIGN_H,
              transformStyle: 'preserve-3d',
              overflow: 'visible',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                overflow: 'visible',
              }}
            >
              <EnvelopeBack />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                overflow: 'visible',
              }}
            >
              <EnvelopeBody
                key={envelopeResetKey}
                onBackInviteRevealActive={onBackInviteRevealActive}
              />
            </div>
          </motion.div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
