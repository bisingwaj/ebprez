import Link from 'next/link';

const mono = { fontFamily: "'IBM Plex Mono',monospace" };
const tile = {
  display: 'block', border: '1px solid rgba(56,225,255,.25)', borderRadius: 12,
  background: 'rgba(10,28,48,.45)', padding: '24px 28px', textDecoration: 'none', color: '#dceaff', width: 300,
};

function Tile({ href, title, desc }) {
  return (
    <Link href={href} style={tile}>
      <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '.08em', color: '#eaf6ff' }}>{title}</div>
      <div style={{ ...mono, fontSize: 11.5, color: 'rgba(170,205,235,.7)', marginTop: 8, lineHeight: 1.6 }}>{desc}</div>
    </Link>
  );
}

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
      fontFamily: "'Rajdhani',sans-serif", color: '#dceaff', padding: 32,
      background: 'radial-gradient(120% 120% at 50% 25%,#08182c 0%,#040b16 55%,#02060d 100%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 48, letterSpacing: '.16em', color: '#f3f9ff', textShadow: '0 0 30px rgba(31,143,255,.5)' }}>ÉTOILE BLEUE</div>
        <div style={{ ...mono, fontSize: 12, letterSpacing: '.3em', color: 'rgba(170,205,235,.7)', marginTop: 8 }}>SAMU NATIONAL · RDC — PROTOCOLE D'ACTIVATION</div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Tile href="/admin" title="⚙ ADMINISTRATION" desc="Vidéos, voix par étape & par commune, codes d'activation, contrôle des répétitions." />
        <Tile href="/projection" title="📺 PROJECTION" desc="Grands écrans + sonorisation. Affiche la séquence et joue les voix après validation." />
      </div>

      <div style={{ ...mono, fontSize: 12, letterSpacing: '.1em', color: 'rgba(170,205,235,.6)', marginTop: 4 }}>VALIDATEURS</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Tile href="/validate/minister" title="🩺 MINISTRE" desc="Ministre de la Santé — 1ʳᵉ validation." />
        <Tile href="/validate/pm" title="🏛 PREMIÈRE MINISTRE" desc="2ᵉ validation." />
        <Tile href="/validate/president" title="🎖 PRÉSIDENT" desc="Validation finale — déclenche le lancement." />
      </div>
    </div>
  );
}
