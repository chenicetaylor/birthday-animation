import backViewLayer from '../assets/envelope/back-view.png'
import topFlap from '../assets/envelope/top-flap.svg'
import leftFlap from '../assets/envelope/left-flap.svg'
import rightFlap from '../assets/envelope/right-flap.svg'
import bottomFlap from '../assets/envelope/bottom-flap.svg'
import blankCard from '../assets/envelope/blank-card.png'

const labelStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 60,
  fontFamily: '"Imperial Script", cursive',
  fontSize: '36px',
  lineHeight: 1.35,
  color: '#651A2D',
  textAlign: 'center',
  pointerEvents: 'none',
  userSelect: 'none',
}

function EnvelopeBack() {
  const frameStyle = {
    position: 'absolute',
    inset: 0,
    width: '634px',
    height: '456px',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  }

  const imageCommonStyle = {
    position: 'absolute',
    userSelect: 'none',
    pointerEvents: 'none',
    display: 'block',
  }
  const envelopeLayerOpacity = 0.99

  return (
    <div style={frameStyle}>
      <img
        src={topFlap}
        alt="Top flap"
        style={{
          ...imageCommonStyle,
          top: 0,
          left: '312px',
          width: '624px',
          height: 'auto',
          transform: 'translateX(-50%)',
          zIndex: 10,
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
        src={bottomFlap}
        alt="Bottom flap"
        style={{
          ...imageCommonStyle,
          bottom: 0,
          left: 0,
          width: '624px',
          height: 'auto',
          zIndex: 40,
          opacity: envelopeLayerOpacity,
        }}
        draggable="false"
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '624px',
          height: '456px',
          zIndex: 45,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <img
          src={blankCard}
          alt="Blank card"
          style={{
            display: 'block',
            width: '610px',
            height: '444px',
            borderRadius: '8px',
            background: 'transparent',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable="false"
        />
      </div>
      <img
        src={backViewLayer}
        alt="Envelope back view"
        style={{
          ...imageCommonStyle,
          top: 0,
          left: 0,
          width: '624px',
          height: '456px',
          zIndex: 50,
          opacity: envelopeLayerOpacity,
        }}
        draggable="false"
      />
      <div style={labelStyle} aria-hidden="true">
        <div>to: My friend</div>
        <div>from: Chenice </div>
      </div>
    </div>
  )
}

export default EnvelopeBack
