'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fetchAudios, uploadAudio, deleteAudio, fetchVoices, generateVoice, generateSound } from '@/lib/client';
import {
  VALIDATION_SLOTS, PHASE_SLOTS, COUNTDOWN_SLOTS, COMMUNE_SLOTS, SOUND_SLOTS, ALL_SLOTS, SLOT_GROUPS, defaultText,
} from '@/lib/slots';

const card = { border: '1px solid rgba(56,225,255,.18)', borderRadius: 10, background: 'rgba(10,28,48,.4)', padding: 18, fontFamily: "'Rajdhani',sans-serif", color: '#dceaff' };
const mono = { fontFamily: "'IBM Plex Mono',monospace" };

const GROUPS = { Validation: VALIDATION_SLOTS, 'Étapes': PHASE_SLOTS, 'Compte à rebours': COUNTDOWN_SLOTS, Communes: COMMUNE_SLOTS, 'Sons & Musique': SOUND_SLOTS };
const SLOT_MAP = Object.fromEntries(ALL_SLOTS.map((s) => [s.key, s]));

function btn(color, bg) {
  return { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, padding: '6px 10px', borderRadius: 6, border: '1px solid ' + color + '66', background: bg || 'transparent', color, cursor: 'pointer', whiteSpace: 'nowrap' };
}
function genLabel(slot, generating) {
  if (generating) return '…';
  if (slot.sound === 'music') return '🎵 Musique';
  if (slot.sound === 'sfx') return '💥 Effet';
  return '✨ Générer';
}

function SlotRow({ slot, audio, text, onText, onGenerate, generating, canGen, onUploaded, onDeleted, onError }) {
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const showGen = !slot.noTts || slot.sound;

  async function onPick(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProgress(0);
    try { await uploadAudio(slot.key, file, setProgress); onUploaded(); }
    catch (err) { onError('Échec upload (' + (err.message || err) + ')'); }
    finally { setProgress(null); if (fileRef.current) fileRef.current.value = ''; }
  }
  function preview() { if (audio && audio.url) { try { new Audio(audio.url).play(); } catch (e) { } } }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 7,
      border: '1px solid ' + (audio ? 'rgba(25,224,138,.35)' : 'rgba(56,225,255,.12)'),
      background: audio ? 'rgba(25,224,138,.06)' : 'transparent'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 14, color: audio ? '#19e08a' : 'rgba(150,190,225,.45)' }}>{audio ? (slot.sound ? '♬' : '♪') : '○'}</div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: '#eaf6ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.label}</div>
        {progress != null && <div style={{ ...mono, fontSize: 11, color: '#38e1ff' }}>{progress}%</div>}
        {audio && <button onClick={preview} title="Écouter" style={btn('#38e1ff')}>▶</button>}
        <button onClick={() => fileRef.current && fileRef.current.click()} style={btn('#9fc4e6')}>{audio ? 'Fichier' : 'Upload'}</button>
        {audio && <button onClick={() => onDeleted(slot.key)} title="Supprimer" style={btn('#ff6b6b')}>✕</button>}
        <input ref={fileRef} type="file" accept="audio/*" onChange={onPick} style={{ display: 'none' }} />
      </div>
      {showGen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={text} onChange={(e) => onText(slot.key, e.target.value)} placeholder={slot.sound ? 'Décrivez le son / la musique…' : 'Texte à dire…'}
            style={{ ...mono, flex: 1, minWidth: 0, fontSize: 12, padding: '7px 9px', borderRadius: 6, border: '1px solid rgba(56,225,255,.2)', background: 'rgba(2,8,16,.5)', color: '#dceaff', outline: 'none' }} />
          <button onClick={() => onGenerate(slot.key)} disabled={generating || !canGen} style={{ ...btn('#38e1ff', 'rgba(31,143,255,.18)'), opacity: (generating || !canGen) ? 0.5 : 1 }}>
            {genLabel(slot, generating)}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AudioManager() {
  const [audios, setAudios] = useState({});
  const [texts, setTexts] = useState({});
  const [voices, setVoices] = useState([]);
  const [voiceId, setVoiceId] = useState('');
  const [hasKey, setHasKey] = useState(true);
  const [error, setError] = useState('');
  const [openGroup, setOpenGroup] = useState('Validation');
  const [genSlot, setGenSlot] = useState(null);
  const [bulk, setBulk] = useState('');

  async function refresh() {
    try { const d = await fetchAudios(); setAudios(d.audios || {}); setError(''); }
    catch (e) { setError('Impossible de charger les audios (clé administrateur ?)'); }
  }
  useEffect(() => {
    refresh();
    (async () => {
      try { const v = await fetchVoices(); setVoices(v.voices || []); setHasKey(v.hasKey); setVoiceId(v.defaultVoice || (v.voices && v.voices[0] && v.voices[0].voice_id) || ''); }
      catch (e) { setHasKey(false); }
    })();
  }, []);

  function textFor(key) {
    if (texts[key] != null) return texts[key];
    const s = SLOT_MAP[key];
    return s && s.sound ? (s.prompt || '') : defaultText(key);
  }
  function onText(key, val) { setTexts((t) => ({ ...t, [key]: val })); }

  async function generateOne(key) {
    const s = SLOT_MAP[key];
    if (s && s.sound) return generateSound(key, textFor(key), s.sound, { duration: s.duration, durationMs: s.durationMs });
    return generateVoice(key, textFor(key), voiceId);
  }
  async function onGenerate(key) {
    if (!hasKey) { setError('Ajoutez ELEVENLABS_API_KEY pour générer.'); return; }
    setError(''); setGenSlot(key);
    try { await generateOne(key); await refresh(); }
    catch (e) { setError('Génération échouée : ' + (e.detail || e.message || e)); }
    finally { setGenSlot(null); }
  }

  async function onDelete(slot) { try { await deleteAudio(slot); refresh(); } catch (e) { setError('Suppression impossible.'); } }

  async function generateGroupMissing() {
    if (!hasKey) { setError('Ajoutez ELEVENLABS_API_KEY pour générer.'); return; }
    const slots = GROUPS[openGroup].filter((s) => !audios[s.key] && (s.sound || !s.noTts) && textFor(s.key));
    for (let i = 0; i < slots.length; i++) {
      setBulk((i + 1) + '/' + slots.length);
      try { await generateOne(slots[i].key); }
      catch (e) { setError('Arrêt : ' + (e.detail || e.message || e)); break; }
    }
    setBulk(''); refresh();
  }

  const showVoiceSel = hasKey && openGroup !== 'Sons & Musique';

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '.12em', color: '#eaf6ff', marginBottom: 6 }}>VOIX & SOUND DESIGN</div>
      <div style={{ ...mono, fontSize: 11.5, color: 'rgba(170,205,235,.65)', marginBottom: 12, lineHeight: 1.6 }}>
        Voix naturelles, effets sonores et musique générés par ElevenLabs (ou upload). Les communes
        s’enchaînent à la fin de chaque audio ; la musique tourne sous toute la séquence.
      </div>

      {!hasKey && (
        <div style={{ ...mono, fontSize: 11.5, color: '#ff9a3c', marginBottom: 12, lineHeight: 1.5 }}>
          ⚠ Aucune clé ElevenLabs détectée. Ajoutez <b>ELEVENLABS_API_KEY</b> pour la génération.
          L’upload de fichiers reste possible.
        </div>
      )}
      {error && <div style={{ ...mono, fontSize: 12, color: '#ff4d4d', marginBottom: 10 }}>{error}</div>}

      {showVoiceSel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ ...mono, fontSize: 11.5, color: 'rgba(170,205,235,.7)' }}>Voix :</span>
          <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
            style={{ ...mono, fontSize: 12, padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(56,225,255,.3)', background: 'rgba(2,8,16,.6)', color: '#eaf6ff' }}>
            {voices.map((v) => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
          </select>
          <span style={{ ...mono, fontSize: 10.5, color: 'rgba(150,190,225,.5)' }}>(voix féminine pour la Première Ministre)</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {SLOT_GROUPS.map((g) => {
          const count = GROUPS[g].filter((s) => audios[s.key]).length;
          return (
            <button key={g} onClick={() => setOpenGroup(g)}
              style={{
                ...mono, fontSize: 12, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid ' + (openGroup === g ? '#38e1ff' : 'rgba(56,225,255,.22)'),
                background: openGroup === g ? 'rgba(56,225,255,.12)' : 'transparent',
                color: openGroup === g ? '#38e1ff' : '#dceaff'
              }}>
              {g} <span style={{ color: 'rgba(150,190,225,.6)' }}>({count}/{GROUPS[g].length})</span>
            </button>
          );
        })}
      </div>

      {hasKey && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={generateGroupMissing} disabled={!!bulk}
            style={{ ...btn('#19e08a', 'rgba(25,224,138,.12)'), fontSize: 12, padding: '8px 14px' }}>
            {bulk ? 'Génération ' + bulk + '…' : '✨ Générer les manquants de « ' + openGroup + ' »'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 440, overflowY: 'auto', paddingRight: 4 }}>
        {GROUPS[openGroup].map((slot) => (
          <SlotRow key={slot.key} slot={slot} audio={audios[slot.key]} text={textFor(slot.key)}
            onText={onText} onGenerate={onGenerate} generating={genSlot === slot.key} canGen={hasKey}
            onUploaded={refresh} onDeleted={onDelete} onError={setError} />
        ))}
      </div>
    </div>
  );
}
