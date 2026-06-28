'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import * as A from '@/lib/audio';
import { submitValidation } from '@/lib/client';
import { useSession } from '@/lib/sync';
import { ROLE_LABEL, FLOW_ORDER } from '@/lib/slots';

const mono = { fontFamily: "'IBM Plex Mono',monospace" };
const pageBg = {
  position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Rajdhani',sans-serif", color: '#dceaff', padding: 24, textAlign: 'center', gap: 14,
  background: 'radial-gradient(120% 120% at 50% 40%,#08182c 0%,#040b16 55%,#02060d 100%)',
};
function idx(step) { return FLOW_ORDER.indexOf(step); }

export default function ValidatePage() {
  const params = useParams();
  const role = params.role;
  const session = useSession(500);
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const valid = ['minister', 'pm', 'president'].includes(role);
  const flow = session && session.flow;

  useEffect(() => { setVal(''); setErr(''); setSubmitting(false); }, [flow && flow.epoch, flow && flow.step]);

  async function send(roleToSend, code) {
    if (submitting) return;
    setSubmitting(true);
    try { A.unlockAudio(); A.sOk(); await submitValidation(roleToSend, code || ''); }
    catch (e) {
      A.sErr();
      setErr(e.code === 'bad-code' ? 'CODE INVALIDE' : e.code === 'not-your-turn' ? 'CE N’EST PAS VOTRE TOUR' : e.code === 'no-active-video' ? 'AUCUNE VIDÉO ACTIVE (ADMIN)' : 'ERREUR');
      setVal(''); setSubmitting(false);
    }
  }
  function press(d) {
    if (submitting || val.length >= 6) return;
    A.unlockAudio(); A.sBeep();
    const next = val + d; setVal(next); setErr('');
    if (next.length === 6) setTimeout(() => send('president' === role ? 'president' : role, next), 350);
  }
  function back() { A.sBeep(); setVal((v) => v.slice(0, -1)); setErr(''); }

  if (!valid) return <div style={pageBg}><div style={{ fontSize: 22 }}>Rôle inconnu.</div></div>;

  const Header = (
    <>
      <div style={{ ...mono, fontSize: 12, letterSpacing: '.4em', color: '#ff9a3c', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff9a3c', boxShadow: '0 0 8px #ff9a3c', animation: 'ebBlink 1s infinite' }} />
        CANAL SÉCURISÉ · AES-256
      </div>
      <div style={{ fontWeight: 700, fontSize: 34, letterSpacing: '.1em', color: '#f3f9ff' }}>{ROLE_LABEL[role]}</div>
    </>
  );
  const Done = (title, sub) => (
    <div style={pageBg}>{Header}
      <div style={{ fontSize: 54, color: '#19e08a', textShadow: '0 0 30px rgba(25,224,138,.6)' }}>✓</div>
      <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: '.08em', color: '#eafff4' }}>{title}</div>
      {sub && <div style={{ ...mono, fontSize: 12, color: 'rgba(160,230,195,.8)' }}>{sub}</div>}
    </div>
  );
  const Waiting = (label) => (
    <div style={pageBg}>{Header}
      <div style={{ marginTop: 8, width: 44, height: 44, border: '2px solid rgba(56,225,255,.25)', borderTopColor: '#38e1ff', borderRadius: '50%', animation: 'ebSpin 1s linear infinite' }} />
      <div style={{ ...mono, fontSize: 14, letterSpacing: '.16em', color: 'rgba(170,205,235,.75)' }}>{label}</div>
    </div>
  );

  if (!flow) return <div style={pageBg}>{Header}<div style={{ ...mono, fontSize: 13, color: 'rgba(170,205,235,.6)' }}>Connexion…</div></div>;
  const step = flow.step;

  /* ---------------- PRESIDENT (two steps) ---------------- */
  if (role === 'president') {
    if (step === 'minister' || step === 'pm') return Waiting('EN ATTENTE — ' + (ROLE_LABEL[step] || '').toUpperCase());
    if (step === 'initializing') return Waiting('INITIALISATION EN COURS…');
    if (step === 'launched') return Done('SYSTÈME ACTIVÉ ET LANCÉ');
    if (step === 'president_activate') {
      return (
        <div style={pageBg}>{Header}
          <div style={{ ...mono, fontSize: 13, color: 'rgba(170,205,235,.85)', maxWidth: 480, lineHeight: 1.6, marginTop: 2 }}>
            Le réseau a été initialisé dans les 24 communes de Kinshasa.<br />
            Monsieur le Président, confirmez-vous l’<b style={{ color: '#19e08a' }}>activation</b> du système Étoile Bleue ?
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 260, height: 260, marginTop: 6 }}>
            {!submitting && <>
              <div style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', border: '2px solid rgba(25,224,138,.45)', animation: 'ebPulse 1.9s ease-out infinite', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', border: '2px solid rgba(56,225,255,.3)', animation: 'ebPulse 1.9s ease-out infinite .95s', pointerEvents: 'none' }} />
            </>}
            <button className="eb-activate" onClick={() => send('president_activate')} disabled={submitting}
              style={{ position: 'relative', zIndex: 2, width: 184, height: 184, borderRadius: '50%', cursor: 'pointer',
                border: '2px solid #19e08a', color: '#eafff4',
                background: 'radial-gradient(circle at 50% 36%, rgba(25,224,138,.4), rgba(31,143,255,.18) 65%, rgba(8,22,40,.65))',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ fontSize: 58, lineHeight: 1, textShadow: '0 0 22px rgba(25,224,138,.8)' }}>⏻</div>
              <div style={{ ...mono, fontSize: 13, letterSpacing: '.24em', color: '#bfffe0' }}>{submitting ? 'ACTIVATION…' : 'ACTIVER'}</div>
            </button>
          </div>

          <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: '.12em', color: '#eafff4', marginTop: 2 }}>SYSTÈME ÉTOILE BLEUE</div>
          <div style={{ ...mono, fontSize: 11.5, letterSpacing: '.2em', color: 'rgba(170,205,235,.6)' }}>APPUYEZ POUR LANCER L’ACTIVATION NATIONALE</div>
          {err && <div style={{ ...mono, fontSize: 13, color: '#ff4d4d', marginTop: 6 }}>{err}</div>}
        </div>
      );
    }
    // step === 'president' -> INITIALISATION code
    return KeypadView('SAISISSEZ VOTRE CODE — INITIALISATION', 'Monsieur le Président, voulez-vous initialiser le système Étoile Bleue ?');
  }

  /* ---------------- MINISTER / PM ---------------- */
  if (idx(step) > idx(role)) return Done('VALIDATION ENREGISTRÉE', 'En attente des validations suivantes…');
  if (step !== role) return Waiting('EN ATTENTE — ' + (ROLE_LABEL[step] || '').toUpperCase());
  return KeypadView('SAISISSEZ VOTRE CODE D’ACTIVATION');

  /* ---------------- keypad ---------------- */
  function KeypadView(title, sub) {
    const cells = Array.from({ length: 6 }).map((_, i) => {
      const filled = i < val.length;
      return { ch: filled ? '●' : '', border: err ? '#ff4d4d' : (filled ? '#38e1ff' : 'rgba(56,225,255,.25)'),
        glow: err ? '0 0 16px rgba(255,77,77,.5)' : (filled ? '0 0 16px rgba(56,225,255,.45)' : 'none') };
    });
    const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
    return (
      <div style={pageBg}>
        {Header}
        <div style={{ ...mono, fontSize: 13, letterSpacing: '.18em', color: '#38e1ff', marginTop: 2 }}>{title}</div>
        {sub && <div style={{ ...mono, fontSize: 12, color: 'rgba(170,205,235,.7)', maxWidth: 460, lineHeight: 1.5 }}>{sub}</div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, animation: err ? 'ebShake .5s' : undefined }}>
          {cells.map((c, i) => (
            <div key={i} style={{ width: 50, height: 62, borderRadius: 6, background: 'rgba(10,28,48,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#eaf6ff', border: '1.5px solid ' + c.border, boxShadow: c.glow, transition: 'all .2s' }}>{c.ch}</div>
          ))}
        </div>
        <div style={{ height: 18, ...mono, fontSize: 13, letterSpacing: '.22em', color: '#ff4d4d' }}>{err}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,80px)', gap: 12 }}>
          {labels.map((l, i) => {
            const isAct = l === 'OK', isClr = l === 'C';
            return (
              <button key={i} className={'eb-key' + (isAct ? ' eb-key-ok' : '')} disabled={submitting}
                onClick={() => { if (isAct) send(role, val); else if (isClr) back(); else press(l); }}
                style={{ height: 68, borderRadius: 8, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 24,
                  cursor: submitting ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: submitting ? 0.5 : 1,
                  border: '1px solid ' + (isAct ? 'rgba(56,225,255,.6)' : (isClr ? 'rgba(255,154,60,.5)' : 'rgba(56,225,255,.22)')),
                  background: isAct ? 'rgba(31,143,255,.22)' : (isClr ? 'rgba(255,154,60,.12)' : 'rgba(10,28,48,.55)'),
                  color: isAct ? '#38e1ff' : (isClr ? '#ff9a3c' : '#dceaff') }}>{isAct ? '⏎' : l}</button>
            );
          })}
        </div>
      </div>
    );
  }
}
