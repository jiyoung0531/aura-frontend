export default function AuraOrbOverlay({ orb, palette = [] }) {
  if (!orb.visible) return null;

  const primary = palette[0] || "#4edfff";
  const secondary = palette[1] || primary;
  const shadow = palette[2] || primary;

  return (
    <div
      className={`aura-orb${orb.injecting ? " injecting" : ""}`}
      style={{
        left: `${orb.x}px`,
        top: `${orb.y}px`,
        "--orb-primary": primary,
        "--orb-secondary": secondary,
        "--orb-shadow": shadow,
      }}
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
