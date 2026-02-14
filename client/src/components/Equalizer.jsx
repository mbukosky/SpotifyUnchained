export default function Equalizer() {
  return (
    <div className="equalizer" aria-hidden="true">
      {[...Array(7)].map((_, i) => (
        <span key={i} className="eq-bar" />
      ))}
    </div>
  );
}
