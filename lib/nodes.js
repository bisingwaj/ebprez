// 24 communes of Kinshasa + their radial node geometry (ported from lines 273, 280-294).

export const COMMUNES = [
  'Gombe', 'Lingwala', 'Barumbu', 'Kinshasa', 'Kasa-Vubu', 'Kalamu', 'Kintambo',
  'Bandalungwa', 'Bumbu', 'Makala', 'Ngiri-Ngiri', 'Ngaba', 'Lemba', 'Matete',
  'Limete', 'Kisenso', 'Ngaliema', 'Selembao', 'Mont-Ngafula', 'Kimbanseke',
  'Masina', 'Ndjili', 'Nsele', 'Maluku',
];

let _nodes = null;

export function getNodes() {
  if (_nodes) return _nodes;
  const rings = [{ c: 6, r: 15, o: 0 }, { c: 9, r: 27, o: 0.45 }, { c: 9, r: 40, o: 0.2 }];
  const out = [];
  let i = 0;
  rings.forEach((ring) => {
    for (let k = 0; k < ring.c; k++) {
      const a = (k / ring.c) * Math.PI * 2 + ring.o;
      out.push({
        name: COMMUNES[i] || ('C' + i),
        x: +(50 + Math.cos(a) * ring.r * 1.32).toFixed(2),
        y: +(50 + Math.sin(a) * ring.r * 0.94).toFixed(2),
      });
      i++;
    }
  });
  _nodes = out;
  return out;
}
