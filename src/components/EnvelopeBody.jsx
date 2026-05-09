import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGroup, animate, motion, useMotionValue } from 'framer-motion'
import backLayer from '../assets/envelope/back.png'
import topFlap from '../assets/envelope/top-flap.svg'
import leftFlap from '../assets/envelope/left-flap.svg'
import rightFlap from '../assets/envelope/right-flap.svg'
import bottomFlap from '../assets/envelope/bottom-flap.svg'
import frontInvite from '../assets/envelope/front-invite.png'
import backInvite from '../assets/envelope/back-invite.png'

/** Flap flip — soft spring with a tiny ease-in so it doesn’t feel snappy. */
const flapOpenTransition = {
  type: 'spring',
  stiffness: 78,
  damping: 16,
  mass: 1.08,
  restDelta: 0.01,
  restSpeed: 0.01,
}

/** Closing / cancelling — smooth tween, no bounce. */
const flapCloseTransition = {
  type: 'tween',
  duration: 0.55,
  ease: [0.22, 1, 0.32, 1],
}

/**
 * Card peek — tween (no spring overshoot) so the slide doesn’t bounce past `CARD_PEEK_Y`.
 * `scaleY` is set to `1` instantly when opening (never animate −1 → 1 or it passes through 0).
 */
const cardOpenTransition = {
  type: 'tween',
  duration: 0.4,
  ease: [0.22, 1, 0.32, 1],
}

/** Card snap after pull / release — quicker than the flap so it feels responsive. */
const cardSnapTransition = {
  duration: 0.48,
  ease: [0.645, 0.045, 0.355, 1.0],
}

/** Upward drag distance (px) that maps from closed → fully open (180°). */
const DRAG_OPEN_DISTANCE_PX = 140
/** Release gesture: if dragged up at least this far from touch/mousedown, snap open. */
const OPEN_COMMIT_DRAG_PX = 56

/** Invite peek (flap open) and pull-out / settle targets (design px). */
const CARD_PEEK_Y = -56
/** When `cardY` is at or above this (more negative), the card counts as fully pulled out of the slot. */
const CARD_FULLY_OUT_Y = -220
/** After release when fully out: vertically centered in the “above envelope” band. */
const CARD_SETTLE_Y = -300
/** In-plane turn so the invite reads upright after leaving the slot (deg). */
const CARD_FINAL_ROTATE_Z = 90
/** Extra clockwise lean on the expanded invite only (CSS deg; positive = clockwise). */
const CARD_CLOCKWISE_TILT_Z = 5
/** Expanded reading view: upright 90° plus a small tilt. */
const CARD_DISPLAY_ROTATE_Z = CARD_FINAL_ROTATE_Z + CARD_CLOCKWISE_TILT_Z
/** Expanded invite back face Z (deg); front uses `CARD_DISPLAY_ROTATE_Z`. */
const CARD_EXPANDED_BACK_ROTATE_Z = -5

/**
 * Shared `layoutId` grow (settled → expanded) — softer spring so the zoom reads smooth, not snappy.
 */
const cardExpandTransition = {
  type: 'spring',
  stiffness: 38,
  damping: 26,
  mass: 1.35,
  restDelta: 0.008,
  restSpeed: 0.008,
}

/** Expanded invite front ↔ back (rotateY). */
const expandedInviteFlipTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.32, 1],
}

const envelopeSideShiftTransition = {
  type: 'spring',
  stiffness: 64,
  damping: 18,
  mass: 1.05,
  restDelta: 0.01,
  restSpeed: 0.01,
}

const INVITE_LAYOUT_ID = 'front-invite-focus'

/** Expanded view: shift envelope left (design px) so it sits beside a viewport-centered card. */
const ENVELOPE_EXPANDED_X = -440

/** Back layer art width (px); frame is wider — center the invite on this, not the full frame. */
const BACK_LAYER_WIDTH_PX = 624

/** Corner radius for the in-envelope invite (design px; matches `width: 610px` layout). */
const CARD_INVITE_CORNER_RADIUS_PX = 8
/** Corner radius for the expanded (portal) invite in viewport px. */
const CARD_INVITE_EXPANDED_CORNER_RADIUS_PX = 16

/**
 * @param {{ onBackInviteRevealActive?: (active: boolean) => void }} props
 */
function EnvelopeBody({ onBackInviteRevealActive }) {
  const [isFlapOpened, setIsFlapOpened] = useState(false)
  const [isCardOut, setIsCardOut] = useState(false)
  /** True only after a full pull-out commit — raises the invite above flaps for settle + final pose. */
  const [cardFinishingOut, setCardFinishingOut] = useState(false)
  /** Focused reading view: large card centered on viewport, envelope shrinks to the side. */
  const [isCardExpanded, setIsCardExpanded] = useState(false)
  /** Expanded modal: `rotateY` flip to show `backInvite`. */
  const [isExpandedInviteFlipped, setIsExpandedInviteFlipped] = useState(false)
  const rotateX = useMotionValue(0)
  const cardY = useMotionValue(0)
  /** Upside-down in the slot; goes to 1 when the invite settles after a full pull-out. */
  const cardScaleY = useMotionValue(-1)
  /** Z rotation (deg): 0 in the slot; animates to `CARD_FINAL_ROTATE_Z` (90°) on full pull-out. */
  const cardRotate = useMotionValue(0)
  const envelopeRef = useRef(null)
  const openAnimationRef = useRef(false)
  const flapDragRef = useRef(null)

  useEffect(() => {
    if (!isFlapOpened) {
      cardY.set(0)
      cardScaleY.set(-1)
      cardRotate.set(0)
      return
    }
    // Peek is kicked off in parallel with `rotateX → 180` in `openFlapFully` / `handleFlapPointerUp`
    // so the card moves as soon as the flap starts opening, not after it finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally `isFlapOpened` + `isCardOut` only
  }, [isFlapOpened, isCardOut])

  const handleCardDragEnd = useCallback(
    async () => {
      if (!isFlapOpened || isCardOut) return
      const y = cardY.get()
      if (y <= CARD_FULLY_OUT_Y) {
        setCardFinishingOut(true)
        try {
          await Promise.all([
            animate(cardY, CARD_SETTLE_Y, cardSnapTransition),
            animate(cardScaleY, 1, cardSnapTransition),
            animate(cardRotate, CARD_FINAL_ROTATE_Z, cardSnapTransition),
          ])
          setIsCardOut(true)
        } finally {
          setCardFinishingOut(false)
        }
      } else {
        // Stay at `scaleY: 1` / upright — don’t spring back to `-1` or the invite visibly flips in the slot.
        await animate(cardY, CARD_PEEK_Y, cardSnapTransition)
      }
    },
    [isFlapOpened, isCardOut, cardY, cardScaleY, cardRotate],
  )

  const toggleCardExpanded = useCallback(() => {
    if (!isCardOut) return
    setIsCardExpanded((v) => !v)
  }, [isCardOut])

  useEffect(() => {
    if (!isCardExpanded) return
    const onKey = (e) => {
      if (e.key === 'Escape') setIsCardExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isCardExpanded])

  useEffect(() => {
    if (!isCardExpanded) setIsExpandedInviteFlipped(false)
  }, [isCardExpanded])

  useEffect(() => {
    const backInviteVisible = isCardExpanded && isExpandedInviteFlipped
    onBackInviteRevealActive?.(backInviteVisible)
  }, [
    isCardExpanded,
    isExpandedInviteFlipped,
    onBackInviteRevealActive,
  ])

  useEffect(() => {
    return () => {
      onBackInviteRevealActive?.(false)
    }
  }, [onBackInviteRevealActive])

  const handleCardDragStart = useCallback(() => {
    if (!isFlapOpened || isCardOut) return
    /** Dragging with `scaleY: -1` mirrors transforms and reads as repeated flipping — lock upright for the pull. */
    cardScaleY.set(1)
    cardRotate.set(0)
  }, [isFlapOpened, isCardOut, cardScaleY, cardRotate])

  const openFlapFully = useCallback(async () => {
    if (isFlapOpened || openAnimationRef.current) return
    openAnimationRef.current = true
    try {
      if (!isCardOut) {
        // Upright before peek motion — don’t tween scaleY from −1 (would pass through 0 and flash).
        cardScaleY.set(1)
        cardRotate.set(0)
        void animate(cardY, CARD_PEEK_Y, cardOpenTransition)
      }
      // Mark open before the flap finishes so stacking uses low flap z-index (12) while the card peeks.
      setIsFlapOpened(true)
      await animate(rotateX, 180, flapOpenTransition)
    } finally {
      openAnimationRef.current = false
    }
  }, [isFlapOpened, isCardOut, rotateX, cardY, cardScaleY, cardRotate])

  const isPointerAboveEnvelopeTop = useCallback((info) => {
    const el = envelopeRef.current
    if (!el) return false
    const top = el.getBoundingClientRect().top
    return info.point.y < top
  }, [])

  const releaseFlapPointerCapture = useCallback((target, pointerId) => {
    try {
      target.releasePointerCapture(pointerId)
    } catch {
      // Already released or capture unsupported
    }
  }, [])

  const handleFlapPointerDown = useCallback(
    (e) => {
      if (isFlapOpened || openAnimationRef.current) return
      flapDragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        baseRotate: rotateX.get(),
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [isFlapOpened, rotateX],
  )

  const handleFlapPointerMove = useCallback(
    (e) => {
      const session = flapDragRef.current
      if (
        !session ||
        session.pointerId !== e.pointerId ||
        isFlapOpened ||
        openAnimationRef.current
      ) {
        return
      }

      if (
        isPointerAboveEnvelopeTop({
          point: { x: e.clientX, y: e.clientY },
        })
      ) {
        flapDragRef.current = null
        releaseFlapPointerCapture(e.currentTarget, e.pointerId)
        void openFlapFully()
        return
      }

      const dyUp = session.startY - e.clientY
      rotateX.set(
        Math.min(
          180,
          Math.max(
            0,
            session.baseRotate + (dyUp / DRAG_OPEN_DISTANCE_PX) * 180,
          ),
        ),
      )
    },
    [
      isFlapOpened,
      isPointerAboveEnvelopeTop,
      openFlapFully,
      releaseFlapPointerCapture,
      rotateX,
    ],
  )

  const handleFlapPointerUp = useCallback(
    async (e) => {
      const session = flapDragRef.current
      if (!session || session.pointerId !== e.pointerId) return

      flapDragRef.current = null
      releaseFlapPointerCapture(e.currentTarget, e.pointerId)

      if (isFlapOpened || openAnimationRef.current) return

      const dyUp = session.startY - e.clientY
      const current = rotateX.get()

      if (current >= 92 || dyUp >= OPEN_COMMIT_DRAG_PX) {
        if (!isCardOut) {
          cardScaleY.set(1)
          cardRotate.set(0)
          void animate(cardY, CARD_PEEK_Y, cardOpenTransition)
        }
        setIsFlapOpened(true)
        await animate(rotateX, 180, flapOpenTransition)
      } else {
        await animate(rotateX, 0, flapCloseTransition)
      }
    },
    [
      isFlapOpened,
      isCardOut,
      releaseFlapPointerCapture,
      rotateX,
      cardY,
      cardScaleY,
      cardRotate,
    ],
  )

  const handleFlapPointerCancel = useCallback(
    (e) => {
      const session = flapDragRef.current
      if (!session || session.pointerId !== e.pointerId) return

      flapDragRef.current = null
      releaseFlapPointerCapture(e.currentTarget, e.pointerId)

      if (isFlapOpened || openAnimationRef.current) return

      void animate(rotateX, 0, flapCloseTransition)
    },
    [isFlapOpened, releaseFlapPointerCapture, rotateX],
  )

  const handleFlapLostPointerCapture = useCallback(
    (e) => {
      const session = flapDragRef.current
      if (!session || session.pointerId !== e.pointerId) return

      flapDragRef.current = null

      if (isFlapOpened || openAnimationRef.current) return

      void animate(rotateX, 0, flapCloseTransition)
    },
    [isFlapOpened, rotateX],
  )

  const frameStyle = {
    position: 'relative',
    width: '634px',
    height: '456px',
    transformStyle: 'preserve-3d',
    /** Let the invite animate above the slot without clipping (temp). */
    overflow: 'visible',
    transformOrigin: '50% 55%',
  }

  const imageCommonStyle = {
    position: 'absolute',
    userSelect: 'none',
    pointerEvents: 'none',
    display: 'block',
  }
  const envelopeLayerOpacity = 0.99

  const expandedCardPortal =
    isCardOut &&
    isCardExpanded &&
    typeof document !== 'undefined' &&
    createPortal(
      <motion.div
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.32, 1] }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            background: 'transparent',
          }}
          onClick={() => setIsCardExpanded(false)}
          aria-hidden
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            boxSizing: 'border-box',
            paddingTop: 'max(16px, env(safe-area-inset-top))',
            paddingRight: 'max(16px, env(safe-area-inset-right))',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(16px, env(safe-area-inset-left))',
            pointerEvents: 'none',
          }}
        >
          <motion.div
            layout
            layoutId={INVITE_LAYOUT_ID}
            role="button"
            tabIndex={0}
            initial={{ rotate: CARD_FINAL_ROTATE_Z }}
            animate={{
              rotate: isExpandedInviteFlipped
                ? CARD_EXPANDED_BACK_ROTATE_Z
                : CARD_DISPLAY_ROTATE_Z,
            }}
            transition={{
              layout: cardExpandTransition,
              default: cardExpandTransition,
              rotate: expandedInviteFlipTransition,
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsExpandedInviteFlipped((v) => !v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                setIsExpandedInviteFlipped((v) => !v)
              }
            }}
            aria-label={
              isExpandedInviteFlipped
                ? 'Show front of invite'
                : 'Show back of invite'
            }
            style={{
              transformStyle: 'preserve-3d',
              cursor: 'pointer',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                perspective: 'min(1200px, 200vw)',
                borderRadius: CARD_INVITE_EXPANDED_CORNER_RADIUS_PX,
              }}
            >
              <motion.div
                initial={false}
                animate={{ rotateY: isExpandedInviteFlipped ? 180 : 0 }}
                transition={expandedInviteFlipTransition}
                style={{
                  position: 'relative',
                  width: 'min(88vw, 680px)',
                  aspectRatio: '745 / 1024',
                  maxHeight: 'min(86dvh, 900px)',
                  margin: '0 auto',
                  transformStyle: 'preserve-3d',
                  transformOrigin: 'center center',
                }}
              >
                <div
                  aria-hidden={isExpandedInviteFlipped}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                >
                  <img
                    src={frontInvite}
                    alt=""
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      borderRadius: CARD_INVITE_EXPANDED_CORNER_RADIUS_PX,
                      display: 'block',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      boxShadow: 'none',
                    }}
                  />
                </div>
                <div
                  aria-hidden={!isExpandedInviteFlipped}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'rotateY(180deg)',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                >
                  <img
                    src={backInvite}
                    alt="Birthday invite details"
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      borderRadius: CARD_INVITE_EXPANDED_CORNER_RADIUS_PX,
                      display: 'block',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      boxShadow: 'none',
                    }}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>,
      document.body,
    )

  return (
    <LayoutGroup>
      {expandedCardPortal}
      <motion.div
        ref={envelopeRef}
        style={frameStyle}
        animate={
          isCardOut && isCardExpanded
            ? { scale: 0.54, x: ENVELOPE_EXPANDED_X, rotate: -27 }
            : { scale: 1, x: 0, rotate: 0 }
        }
        transition={envelopeSideShiftTransition}
      >
      <img
        src={backLayer}
        alt="Envelope back"
        style={{
          ...imageCommonStyle,
          top: 0,
          left: 0,
          width: '624px',
          height: '456px',
          zIndex: 10,
          transform: 'translateZ(0)',
          opacity: envelopeLayerOpacity,
        }}
        draggable="false"
      />
      <div
        style={{
          position: 'absolute',
          left: `${BACK_LAYER_WIDTH_PX / 2}px`,
          top: 0,
          width: '610px',
          height: '456px',
          transform: 'translateX(-50%)',
          zIndex:
            isCardOut || (isFlapOpened && cardFinishingOut) ? 65 : 15,
          transformStyle: 'preserve-3d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: isFlapOpened || isCardOut ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '610px',
            height: '444px',
          }}
        >
          {isCardOut && !isCardExpanded ? (
            <motion.img
              layout
              layoutId={INVITE_LAYOUT_ID}
              src={frontInvite}
              alt="Front invite"
              role="button"
              tabIndex={0}
              aria-expanded={isCardExpanded}
              aria-label="Open invite full screen"
              transition={{
                layout: cardExpandTransition,
                default: cardExpandTransition,
              }}
              onClick={(e) => {
                e.stopPropagation()
                toggleCardExpanded()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleCardExpanded()
                }
              }}
              style={{
                display: 'block',
                width: '610px',
                height: '444px',
                borderRadius: CARD_INVITE_CORNER_RADIUS_PX,
                background: 'transparent',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                userSelect: 'none',
                pointerEvents: 'auto',
                touchAction: 'manipulation',
                transformOrigin: 'center center',
                y: CARD_SETTLE_Y,
                rotate: CARD_FINAL_ROTATE_Z,
                scaleY: 1,
                cursor: 'pointer',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
              }}
              draggable={false}
            />
          ) : !isCardOut ? (
            <motion.img
              src={frontInvite}
              alt="Front invite"
              style={{
                display: 'block',
                width: '610px',
                height: '444px',
                borderRadius: CARD_INVITE_CORNER_RADIUS_PX,
                background: 'transparent',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                userSelect: 'none',
                y: cardY,
                scaleY: cardScaleY,
                rotate: cardRotate,
                transformOrigin: 'center center',
                cursor: isFlapOpened ? 'grab' : 'default',
                touchAction: isFlapOpened ? 'none' : undefined,
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
              }}
              drag={isFlapOpened ? 'y' : false}
              dragListener={Boolean(isFlapOpened)}
              dragConstraints={{ top: -360, bottom: 72 }}
              dragElastic={0.22}
              dragMomentum={false}
              onPointerDown={(e) => e.stopPropagation()}
              onDragStart={handleCardDragStart}
              onDragEnd={handleCardDragEnd}
              whileTap={isFlapOpened ? { cursor: 'grabbing' } : undefined}
              draggable={false}
            />
          ) : null}
        </div>
      </div>
      <img
        src={bottomFlap}
        alt="Bottom flap"
        style={{
          ...imageCommonStyle,
          bottom: 0,
          left: 0,
          width: '624px',
          height: 'auto',
          zIndex: 20,
          opacity: envelopeLayerOpacity,
        }}
        draggable="false"
      />
      <img
        src={leftFlap}
        alt="Left flap"
        style={{
          ...imageCommonStyle,
          top: 0,
          left: 0,
          height: '456px',
          width: 'auto',
          zIndex: 30,
          opacity: envelopeLayerOpacity,
        }}
        draggable="false"
      />
      <img
        src={rightFlap}
        alt="Right flap"
        style={{
          ...imageCommonStyle,
          top: 0,
          right: '10px',
          height: '456px',
          width: 'auto',
          zIndex: 40,
          opacity: envelopeLayerOpacity,
        }}
        draggable="false"
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '312px',
          zIndex: isFlapOpened ? 12 : 50,
          transform: isFlapOpened
            ? 'translateX(-50%) translateZ(-56px)'
            : 'translateX(-50%)',
          transformStyle: 'preserve-3d',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          onPointerDown={handleFlapPointerDown}
          onPointerMove={handleFlapPointerMove}
          onPointerUp={handleFlapPointerUp}
          onPointerCancel={handleFlapPointerCancel}
          onLostPointerCapture={handleFlapLostPointerCapture}
          style={{
            position: 'relative',
            top: 0,
            left: 0,
            width: '624px',
            rotateX,
            transformOrigin: 'top center',
            transformStyle: 'preserve-3d',
            WebkitBackfaceVisibility: 'visible',
            backfaceVisibility: 'visible',
            opacity: envelopeLayerOpacity,
            pointerEvents: isFlapOpened ? 'none' : 'auto',
            cursor: isFlapOpened ? 'default' : 'grab',
            touchAction: 'none',
          }}
          whileTap={isFlapOpened ? undefined : { cursor: 'grabbing' }}
        >
          <img
            src={topFlap}
            alt="Top flap"
            style={{
              display: 'block',
              width: '624px',
              height: 'auto',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        </motion.div>
      </div>
    </motion.div>
    </LayoutGroup>
  )
}

export default EnvelopeBody
