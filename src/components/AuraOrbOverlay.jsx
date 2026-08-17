export default function AuraOrbOverlay({ orb }) {
  if (!orb.visible) return null;

  return (
    <div
      className={`aura-orb${orb.injecting ? " injecting" : ""}`}
      style={{ left: `${orb.x}px`, top: `${orb.y}px` }}
      aria-hidden="true"
    >
      <span className="aura-orb-glow" />
      <span className="aura-orb-ring aura-orb-ring-one" />
      <span className="aura-orb-ring aura-orb-ring-two" />
      <span className="aura-orb-ring aura-orb-ring-three" />
      <span className="aura-orb-core" />
    </div>
  );
}
