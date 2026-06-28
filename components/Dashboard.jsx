'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fetchVideos, uploadVideo, setActiveVideo, deleteVideo } from '@/lib/client';

const card = {
  border: '1px solid rgba(56,225,255,.18)', borderRadius: 10, background: 'rgba(10,28,48,.4)',
  padding: 18, fontFamily: "'Rajdhani',sans-serif", color: '#dceaff',
};
const mono = { fontFamily: "'IBM Plex Mono',monospace" };

function fmtSize(b) {
  if (!b) return '';
  const mb = b / (1024 * 1024);
  return mb >= 1 ? mb.toFixed(1) + ' Mo' : (b / 1024).toFixed(0) + ' Ko';
}

export default function Dashboard() {
  const [videos, setVideos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [persistent, setPersistent] = useState(true);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function refresh() {
    try {
      const data = await fetchVideos();
      setVideos(data.videos || []);
      setActiveId(data.activeVideoId || null);
      setPersistent(data.persistent !== false);
    } catch (e) { /* ignore */ }
  }
  useEffect(() => { refresh(); }, []);

  async function onPick(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(''); setBusy(true); setProgress(0);
    try {
      await uploadVideo(file, (p) => setProgress(p));
      await refresh();
    } catch (err) {
      setError("Échec de l'upload : " + (err.message || err) + ' (clé administrateur correcte ?)');
    } finally {
      setBusy(false); setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onSetActive(id) {
    setError('');
    try { await setActiveVideo(id); await refresh(); }
    catch (e) { setError('Impossible de définir la vidéo active (clé administrateur ?)'); }
  }
  async function onDelete(id) {
    setError('');
    try { await deleteVideo(id); await refresh(); }
    catch (e) { setError('Suppression impossible.'); }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '.14em', color: '#eaf6ff' }}>GESTION DES VIDÉOS</div>
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}
          style={{ ...mono, fontSize: 13, letterSpacing: '.1em', padding: '10px 16px', borderRadius: 8,
            border: '1px solid rgba(56,225,255,.5)', background: 'rgba(31,143,255,.2)', color: '#38e1ff',
            cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'ENVOI…' : '+ UPLOADER UNE VIDÉO'}
        </button>
        <input ref={fileRef} type="file" accept="video/*" onChange={onPick} style={{ display: 'none' }} />
      </div>

      {!persistent && (
        <div style={{ ...mono, fontSize: 12, color: '#ff9a3c', marginBottom: 12, lineHeight: 1.5 }}>
          ⚠ Stockage temporaire (mémoire locale). Sur Vercel, configurez Vercel KV + Blob pour
          que les vidéos et la synchro persistent entre les appareils.
        </div>
      )}

      {progress != null && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...mono, fontSize: 12, color: '#38e1ff', marginBottom: 4 }}>Upload… {progress}%</div>
          <div style={{ height: 6, background: 'rgba(56,225,255,.15)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg,#1f8fff,#38e1ff)', transition: 'width .2s' }} />
          </div>
        </div>
      )}

      {error && <div style={{ ...mono, fontSize: 12, color: '#ff4d4d', marginBottom: 12 }}>{error}</div>}

      {videos.length === 0 && (
        <div style={{ ...mono, fontSize: 13, color: 'rgba(150,190,225,.6)', padding: '16px 0' }}>
          Aucune vidéo. Uploadez la vidéo officielle pour commencer.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {videos.map((vid) => {
          const isActive = vid.id === activeId;
          return (
            <div key={vid.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8,
              border: '1px solid ' + (isActive ? '#38e1ff' : 'rgba(56,225,255,.14)'),
              background: isActive ? 'rgba(56,225,255,.08)' : 'transparent',
            }}>
              <div style={{ fontSize: 18, color: isActive ? '#38e1ff' : 'rgba(150,190,225,.5)' }}>{isActive ? '●' : '○'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, color: '#eaf6ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vid.name}</div>
                <div style={{ ...mono, fontSize: 11, color: 'rgba(150,190,225,.5)' }}>
                  {isActive ? 'ACTIVE · ' : ''}{fmtSize(vid.size)}
                </div>
              </div>
              {!isActive && (
                <button onClick={() => onSetActive(vid.id)}
                  style={{ ...mono, fontSize: 11, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(56,225,255,.4)', background: 'transparent', color: '#38e1ff', cursor: 'pointer' }}>
                  DÉFINIR ACTIVE
                </button>
              )}
              <button onClick={() => onDelete(vid.id)} title="Supprimer"
                style={{ ...mono, fontSize: 11, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,77,77,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
