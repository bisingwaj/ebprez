import './cinematic.css';

export const metadata = {
  title: 'Étoile Bleue — SAMU National RDC',
  description: "Protocole d'activation Étoile Bleue",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
