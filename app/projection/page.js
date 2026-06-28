'use client';

import React, { useEffect, useRef, useState } from 'react';
import Cinematic from '@/components/Cinematic';
import { useSession } from '@/lib/sync';
import { fetchVideos, signalInitDone } from '@/lib/client';
import { unlockAudio } from '@/lib/audio';
import * as voice from '@/lib/voice';
import ValidationOverlay from '@/components/ValidationOverlay';

const HANDLED_KEY = 'eb_handled_epoch';
const mono = { fontFamily: "'IBM Plex Mono',monospace" };

export default function ProjectionPage() {
  const session = useSession(500);
  const [armed, setArmed] = useState(false);
  const [activeUrl, setActiveUrl] = useState('');
  const [activeName, setActiveName] = useState('');
  const [buffered, setBuffered] = useState(0);
  const [ready, setReady] = useState(false);
  const [trigger, setTrigger] = useState({ command: 'idle', epoch: 0 });
  const videoElRef = useRef(null);
  const handledRef = useRef(0);          // cinematic run/reset epoch
  const flowHandledRef = useRef(0);      // validation-voice epoch
  const armedRef = useRef(false);

  // Load active video for preload (before arming, from page load).
  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const data = await fetchVideos();
        const active = (data.videos || []).find((v) => v.id === data.activeVideoId) || (data.videos || [])[0];
        if (!stop && active) { setActiveUrl(active.url); setActiveName(active.name); }
      } catch (e) {}
    }
    load();
    const iv = setInterval(load, 4000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    try {
      handledRef.current = Number(sessionStorage.getItem(HANDLED_KEY) || 0);
      flowHandledRef.current = Number(sessionStorage.getItem('eb_flow_epoch') || 0);
    } catch (e) {}
  }, []);

  // Keep the voice player's audio set in sync with the admin uploads (preload).
  useEffect(() => {
    if (session && session.audios) voice.setAudios(session.audios);
  }, [session && JSON.stringify(session.audios)]);

  // Cinematic command trigger (init / activate / run / reset), once armed.
  useEffect(() => {
    if (!session) return;
    const { command, epoch } = session;
    if (command === 'reset') {
      if (epoch !== handledRef.current) { handledRef.current = epoch; persistHandled(epoch); }
      setTrigger({ command: 'reset', epoch });
      return;
    }
    if (['init', 'activate', 'run'].includes(command) && armed && epoch > handledRef.current) {
      handledRef.current = epoch; persistHandled(epoch);
      setTrigger({ command, epoch });
    }
  }, [session, armed]);

  // Validation voices, played on the projection as the flow advances.
  useEffect(() => {
    if (!session || !session.flow || !armedRef.current) return;
    const { step, epoch } = session.flow;
    if (!epoch || epoch <= flowHandledRef.current) return; // never replay an old/handled transition
    flowHandledRef.current = epoch;
    try { sessionStorage.setItem('eb_flow_epoch', String(epoch)); } catch (e) {}
    voice.stopAll(); // cut any lingering one-shot voice before speaking the next
    if (step === 'pm') { voice.play('sfx_validation'); voice.play('validation_minister'); }
    else if (step === 'president') { voice.play('sfx_validation'); voice.playSequence(['validation_pm', 'president_prompt']); }
    else if (step === 'president_activate') { voice.play('sfx_validation'); voice.play('president_activate_prompt'); }
    // president_confirm is spoken by the cinematic at the start of the activation segment
  }, [session && session.flow && session.flow.epoch]);

  function persistHandled(epoch) { try { sessionStorage.setItem(HANDLED_KEY, String(epoch)); } catch (e) {} }

  function arm() {
    unlockAudio();
    voice.unlock();
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    const v = videoElRef.current;
    if (v) { v.muted = true; v.play().then(() => { v.pause(); v.currentTime = 0; v.muted = false; }).catch(() => {}); }
    // don't replay validation voices that happened before arming
    if (session && session.flow) flowHandledRef.current = session.flow.epoch || 0;
    armedRef.current = true;
    setArmed(true);
  }

  const runVideoUrl = (session && session.videoUrl) ? session.videoUrl : activeUrl;
  const running = ['init', 'activate', 'run'].includes(trigger.command);

  return (
    <div className="eb-projection" style={{ position: 'fixed', inset: 0, background: '#02060d' }}>
      <Cinematic
        role="projection"
        auto
        videoSrc={runVideoUrl}
        command={trigger.command}
        epoch={trigger.epoch}
        registerVideo={(el) => { videoElRef.current = el; }}
        onBuffered={(pct, rdy) => { setBuffered(pct); setReady(rdy); }}
        onInitDone={() => signalInitDone()}
      />

      {armed && !running && session && <ValidationOverlay flow={session.flow} />}

      {armed && !running && !ready && (
        <div style={{ position: 'absolute', bottom: 70, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 95 }}>
          <div style={{ ...mono, fontSize: 12, letterSpacing: '.2em', color: 'rgba(150,190,225,.7)' }}>
            {!activeUrl ? 'AUCUNE VIDÉO ACTIVE' : 'PRÉCHARGEMENT VIDÉO … ' + buffered + '%'}
          </div>
        </div>
      )}

      {!armed && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 22,
          background: 'radial-gradient(120% 120% at 50% 40%,#08182c 0%,#040b16 55%,#02060d 100%)',
          fontFamily: "'Rajdhani',sans-serif", color: '#dceaff', textAlign: 'center', padding: 24,
        }}>
          <div style={{ fontWeight: 700, fontSize: 54, letterSpacing: '.14em', color: '#f3f9ff', textShadow: '0 0 30px rgba(31,143,255,.5)' }}>ÉTOILE BLEUE</div>
          <div style={{ ...mono, fontSize: 13, letterSpacing: '.24em', color: 'rgba(170,205,235,.75)', maxWidth: 560, lineHeight: 1.7 }}>
            ÉCRAN DE PROJECTION. Cliquez pour activer l'affichage (son, plein écran, préchargement),
            puis laissez cet écran en attente des validations.
          </div>
          <button onClick={arm} style={{
            ...mono, marginTop: 8, fontSize: 16, letterSpacing: '.18em', padding: '18px 40px', borderRadius: 10,
            border: '1px solid #38e1ff', background: 'rgba(31,143,255,.22)', color: '#38e1ff', cursor: 'pointer',
            boxShadow: '0 0 30px rgba(56,225,255,.3)',
          }}>
            ▶ ACTIVER L'AFFICHAGE
          </button>
          <div style={{ ...mono, fontSize: 11.5, color: 'rgba(150,190,225,.5)', marginTop: 6 }}>
            {!activeUrl ? 'En attente d’une vidéo active (gérée depuis l’admin)…'
              : (ready ? '✓ Vidéo préchargée · ' + activeName : 'Préchargement : ' + buffered + '% · ' + activeName)}
          </div>
        </div>
      )}
    </div>
  );
}
