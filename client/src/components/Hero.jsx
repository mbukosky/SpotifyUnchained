const EQ_DELAYS = ['0s', '.15s', '.3s', '.07s', '.22s', '.4s', '.12s', '.28s'];

export default function Hero() {
  return (
    <section className="hero">
      <p className="hero-eyebrow">The New Music Friday Archive</p>
      <h1 className="hero-title">
        <span className="line">Every Friday,</span>
        <span className="line liquid">preserved.</span>
      </h1>
      <p className="hero-sub">
        Spotify's New Music Friday refreshes every week — and last week's discoveries
        vanish. We archive every edition, in every region, so the music you almost
        loved is never lost.
      </p>
      <div className="hero-eq" aria-hidden="true">
        {EQ_DELAYS.map((delay, i) => (
          <span key={i} style={{ animationDelay: delay }} />
        ))}
      </div>
    </section>
  );
}
