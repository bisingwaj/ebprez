'use client';

// Étoile Bleue cinematic — faithful React port of the original DCLogic Component
// (Etoile Bleue.dc.html, lines 266-570). Reused by both screens:
//   role="control"     -> only standby + auth; calls onValidated() when the code is accepted.
//   role="projection"  -> waits on standby, then auto-runs the full sequence when triggered
//                         (props.command === 'run' with a new props.epoch), ending in the video.

import React from 'react';
import * as A from '@/lib/audio';
import * as voice from '@/lib/voice';
import { getNodes } from '@/lib/nodes';
import { communeSlot } from '@/lib/slots';

// Parse a CSS declaration string into a React style object (keeps original CSS verbatim).
function css(str) {
  const o = {};
  if (!str) return o;
  str.split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    let v = decl.slice(i + 1).trim();
    if (!k) return;
    const ck = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[ck] = v;
  });
  return o;
}

export default class Cinematic extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      phase: 'standby', code: '', err: false, boot: 0,
      scanPct: 0, communes: 0, count: 10, act: 0, tsub: -1,
      showVideo: false, flash: '', flashOp: 0, clock: '--:--:--',
      videoPlaying: false,
    };
    this.canvasRef = React.createRef();
    this.videoRef = React.createRef();
    this._timers = [];
    this._lastEpoch = null;
  }

  get CODE() { return (this.props.activationCode || '332003'); }
  get videoSrc() { return (this.props.videoSrc || ''); }
  get role() { return this.props.role || 'control'; }
  get auto() { return !!this.props.auto; }

  onVideoPlay() { this.setState({ videoPlaying: true }); }

  componentDidMount() {
    this.setupCanvas();
    this._key = (e) => this.onKey(e);
    window.addEventListener('keydown', this._key);
    this._clock = setInterval(() => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      this.setState({ clock: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) });
    }, 1000);
    // boot count-up for standby stats
    const t0 = performance.now();
    const boot = () => { const f = Math.min(1, (performance.now() - t0) / 1600); this.setState({ boot: f }); if (f < 1) this._bootRaf = requestAnimationFrame(boot); };
    boot();

    // dev override: ?phase=deploy
    let sp = this.props.startPhase;
    try { const q = new URLSearchParams(window.location.search).get('phase'); if (q) sp = q; } catch (e) {}
    if (sp && sp !== 'standby') this.after(60, () => this.go(sp));

    // projection: preload buffer reporting + register the video element for arming
    if (this.role === 'projection') {
      if (this.props.registerVideo) this.props.registerVideo(this.videoRef.current);
      this._buf = setInterval(() => this.reportBuffered(), 400);
    }
    // projection may already have a pending run command on mount
    this.syncCommand();
  }

  componentDidUpdate(prevProps) {
    if (this.props.videoSrc !== prevProps.videoSrc && this.role === 'projection') {
      // new active video selected upstream — reload so it preloads
      const v = this.videoRef.current; if (v) { try { v.load(); } catch (e) {} }
    }
    this.syncCommand();
  }

  // React to remote run/reset commands (projection only), de-duplicated by epoch.
  syncCommand() {
    if (this.role !== 'projection') return;
    const { command, epoch } = this.props;
    if (epoch == null || epoch === this._lastEpoch) return;
    this._lastEpoch = epoch;
    if (command === 'init') {
      // President initialised: run analysis -> initialisation of the communes,
      // then PAUSE (the deploy step signals init-done and waits for activation).
      this._mode = 'init';
      this.go('analysis');
    } else if (command === 'activate') {
      // President confirmed activation: confirm voice -> countdown -> 199 -> video.
      this.startActivate();
    } else if (command === 'run') {
      // admin rehearsal: full sequence end-to-end, no pause
      this._mode = 'full';
      this.go('analysis');
    } else if (command === 'reset') {
      this.resetToStandby();
    }
  }

  startActivate() {
    this.clearTimers();
    const run = () => this.go('countdown');
    if (voice.has('president_confirm')) voice.play('president_confirm').then(run); else run();
  }

  resetToStandby() {
    this.clearTimers();
    this.stopScore();
    voice.stopEverything();
    this.setState({
      phase: 'standby', code: '', err: false, scanPct: 0, communes: 0,
      count: 10, act: 0, tsub: -1, showVideo: false, videoPlaying: false, flash: '', flashOp: 0,
    });
    const v = this.videoRef.current; if (v) { try { v.pause(); v.currentTime = 0; } catch (e) {} }
  }

  reportBuffered() {
    const v = this.videoRef.current;
    if (!v || !this.props.onBuffered) return;
    let pct = 0; let ready = false;
    try {
      if (v.duration && v.buffered && v.buffered.length) {
        pct = Math.min(1, v.buffered.end(v.buffered.length - 1) / v.duration);
      }
      ready = v.readyState >= 4 || pct >= 0.99;
    } catch (e) {}
    this.props.onBuffered(Math.round(pct * 100), ready);
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this._key);
    clearInterval(this._clock); this.clearTimers();
    if (this._buf) clearInterval(this._buf);
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._bootRaf) cancelAnimationFrame(this._bootRaf);
    window.removeEventListener('resize', this._resize);
    try { A.stopAmbience(); voice.stopEverything(); } catch (e) {}
  }

  /* ---------- timers ---------- */
  after(ms, fn) { const id = setTimeout(fn, ms); this._timers.push(id); return id; }
  clearTimers() {
    this._timers.forEach(clearTimeout); this._timers = [];
    if (this._scanIv) { clearInterval(this._scanIv); this._scanIv = null; }
    if (this._comIv) { clearInterval(this._comIv); this._comIv = null; }
    this._runToken = (this._runToken || 0) + 1; // cancels pending audio-driven steps
  }
  // play an uploaded voice for a phase (non-blocking)
  phaseVoice(slot) { if (voice.has(slot)) voice.play(slot); }
  // start the underscore: synth ambience + optional uploaded background music
  startScore() {
    if (this._score) return;
    this._score = true;
    A.startAmbience(0.05);
    if (voice.has('bg_ambience')) voice.playLoop('bg_ambience', 0.3);
  }
  stopScore() {
    this._score = false;
    A.stopAmbience();
    voice.stop('bg_ambience');
  }

  /* ---------- flash ---------- */
  flash(color) {
    this.setState({ flash: color, flashOp: 0.92 });
    requestAnimationFrame(() => this.setState({ flashOp: 0.92 }));
    this.after(120, () => this.setState({ flashOp: 0 }));
  }

  /* ---------- phase machine ---------- */
  go(phase) {
    this.clearTimers();
    voice.stopAll();
    this.setState({ phase });
    if (phase === 'auth') { this.setState({ code: '', err: false }); }
    else if (phase === 'analysis') { this.startScore(); this.phaseVoice('phase_analysis'); this.runAnalysis(); }
    else if (phase === 'validation') { this.phaseVoice('phase_validation'); this.flash('radial-gradient(circle,rgba(160,255,210,.9),rgba(25,224,138,.3))'); A.sOk(); A.sSwell(); this.after(3600, () => this.go('deploy')); }
    else if (phase === 'deploy') { this.setState({ communes: 0 }); this.runDeploy(); }
    else if (phase === 'countdown') { this.runCountdown(); }
    else if (phase === 'activation') { this.runActivation(); }
    else if (phase === 'transition') { this.runTransition(); }
  }

  runAnalysis() {
    this.setState({ scanPct: 0 });
    A.sTick(false);
    this._scanIv = setInterval(() => {
      this.setState((s) => {
        let p = s.scanPct + Math.max(1, Math.round((100 - s.scanPct) * 0.045));
        if ([22, 46, 72, 93].some((th) => s.scanPct < th && p >= th)) A.sBeep();
        if (p >= 100) { clearInterval(this._scanIv); this._scanIv = null; A.sOk(); this.after(700, () => this.go('validation')); return { scanPct: 100 }; }
        return { scanPct: p };
      });
    }, 45);
  }

  runDeploy() {
    const token = this._runToken;
    if (voice.has('sfx_deploy')) voice.play('sfx_deploy'); // network-activation sweep
    const start = () => { if (token === this._runToken && this.state.phase === 'deploy') this.communeStep(0, token); };
    // optional deploy intro voice, then start lighting communes one by one
    if (voice.has('phase_deploy')) voice.play('phase_deploy').then(start);
    else start();
  }
  // Each commune lights up, its voice plays ("Service activé à Kalamu"), and only
  // when that clip ENDS do we move to the next commune. Falls back to a fixed
  // delay when a commune has no audio.
  communeStep(i, token) {
    if (token !== this._runToken || this.state.phase !== 'deploy') return;
    if (i >= 24) {
      // initialisation of all communes finished
      const done = () => {
        if (token !== this._runToken) return;
        if (this._mode === 'init') {
          // pause and let the President confirm the activation
          if (this.props.onInitDone) this.props.onInitDone();
        } else if (this.auto) {
          this.go('countdown');
        }
      };
      if (voice.has('phase_init_done')) voice.play('phase_init_done').then(() => this.after(500, done));
      else this.after(1600, done);
      return;
    }
    // 1) light the commune up (visual + soft tick)
    this.setState({ communes: i + 1 });
    A.sTick(true);
    const advance = () => { if (token === this._runToken) this.communeStep(i + 1, token); };
    // 3) after the voice: a short confirmation sound, a small beat, then next
    const afterVoice = () => {
      if (token !== this._runToken) return;
      if (voice.has('sfx_commune')) voice.play('sfx_commune'); else A.tone(1040, 0.06, 'triangle', 0.12);
      this.after(380, advance);
    };
    // 2) speak "Service activé à <commune>" (or a short delay if no voice)
    const slot = communeSlot(i);
    if (voice.has(slot)) voice.play(slot).then(afterVoice);
    else this.after(650, afterVoice);
  }

  runCountdown() {
    const token = this._runToken;
    const start = () => { if (token === this._runToken && this.state.phase === 'countdown') this.countStep(10); };
    // speak the intro first, THEN start counting (no overlap)
    if (voice.has('phase_countdown')) voice.play('phase_countdown').then(() => { if (token === this._runToken) this.after(550, start); });
    else start();
  }

  countStep(n) {
    this.setState({ count: n });
    if (n <= 0) { A.sBoom(); this.flash('radial-gradient(circle,rgba(255,255,255,.95),rgba(56,225,255,.4))'); this.after(820, () => this.go('activation')); return; }
    if (n === 4) { // dramatic build into the activation (ElevenLabs riser if provided)
      if (voice.has('sfx_countdown')) voice.play('sfx_countdown'); else A.riser(3.5);
    }
    // spoken countdown 10..1 (nothing spoken at 0); soft tick for rhythm
    if (voice.has('count_' + n)) { A.sTick(true); voice.play('count_' + n); }
    else { A.sTick(true); A.tone(n <= 3 ? 520 : 330, 0.18, 'sine', 0.12); }
    this.after(1000, () => this.countStep(n - 1));
  }

  runActivation() {
    const token = this._runToken;
    this.setState({ act: 0 });
    this.flash('radial-gradient(circle,rgba(255,255,255,.95),rgba(56,225,255,.35))');
    A.sSwell();
    this.after(1300, () => { this.setState({ act: 1 }); A.sOk(); });
    this.after(2700, () => { this.setState({ act: 2 }); A.sBoom(); if (voice.has('sting_activation')) voice.play('sting_activation'); });
    // operational announcement, then the video starts ~1s after it ends
    if (!this.auto) return;
    const toVideo = () => { if (token === this._runToken && this.state.phase === 'activation') this.go('transition'); };
    if (voice.has('phase_activation')) {
      voice.play('phase_activation').then(() => { if (token === this._runToken) this.after(1000, toVideo); });
    } else {
      this.after(4600, toVideo);
    }
  }

  runTransition() {
    if (voice.has('sfx_transition')) voice.play('sfx_transition'); // whoosh into the video
    this.stopScore(); // hand the soundstage over to the video
    this.setState({ tsub: 2, showVideo: true }); A.tone(880, 0.1, 'sine', 0.1);
    this.after(120, () => { this.playVideo(); });
  }

  playVideo() {
    const v = this.videoRef.current; if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {
      // autoplay-with-sound blocked -> start muted then unmute
      v.muted = true;
      v.play().then(() => { v.muted = false; }).catch(() => {});
    });
  }

  /* ---------- input ---------- */
  onStageClick() {
    if (this.role === 'projection') return; // projection never advances by click
    A.unlockAudio();
    this.advance();
  }
  advance() {
    const p = this.state.phase;
    if (p === 'standby') this.go('auth');
  }
  onKey(e) {
    if (this.role === 'projection') return; // projection ignores the keyboard
    const p = this.state.phase;
    if (p === 'auth') {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); this.pressKey(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); this.back(); }
      else if (e.key === 'Enter') { e.preventDefault(); this.validate(); }
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.advance(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); this.advance(); }
  }
  pressKey(d) {
    if (this.state.code.length >= 6) return;
    A.sBeep();
    const code = this.state.code + d;
    this.setState({ code, err: false });
    if (code.length === 6) this.after(380, () => this.validate());
  }
  back() { A.sBeep(); this.setState((s) => ({ code: s.code.slice(0, -1), err: false })); }
  validate() {
    if (this.state.code.length < 6) return;
    if (this.state.code === this.CODE) {
      A.sOk();
      if (this.role === 'control') { if (this.props.onValidated) this.props.onValidated(); return; }
      this.go('analysis');
    } else {
      A.sErr(); this.setState({ err: true }); this.after(700, () => this.setState({ code: '', err: false }));
    }
  }

  /* ---------- background canvas ---------- */
  setupCanvas() {
    const cv = this.canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); let W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    this._resize = resize; window.addEventListener('resize', resize); resize();
    const N = 90; const ps = [];
    for (let i = 0; i < N; i++) ps.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: Math.random() * 1.6 + .4 });
    let rings = [];
    const draw = () => {
      const phase = this.state.phase;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.48;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fillStyle = 'rgba(120,190,240,' + (0.18 + p.r * 0.18) + ')'; ctx.fill();
      }
      ctx.lineWidth = 0.6;
      for (let i = 0; i < N; i++) { for (let j = i + 1; j < N; j++) { const a = ps[i], b = ps[j]; const dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy; if (d2 < 14000) { ctx.strokeStyle = 'rgba(56,225,255,' + (0.10 * (1 - d2 / 14000)) + ')'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } } }
      if (phase === 'activation') { if (Math.random() < 0.04) rings.push({ r: 10, a: 0.5 }); }
      rings = rings.filter((r) => r.a > 0.02);
      for (const r of rings) { r.r += 6; r.a *= 0.97; ctx.beginPath(); ctx.arc(cx, cy, r.r, 0, 7); ctx.strokeStyle = 'rgba(56,225,255,' + r.a + ')'; ctx.lineWidth = 1.4; ctx.stroke(); }
      this._raf = requestAnimationFrame(draw);
    };
    draw();
  }

  /* ---------- derived values (port of renderVals) ---------- */
  vals() {
    const s = this.state, p = s.phase;
    const STATUS = {
      standby: ['ÉTAT SYSTÈME · NOMINAL', '#38e1ff'], auth: ['CANAL SÉCURISÉ · CHIFFREMENT ACTIF', '#ff9a3c'],
      analysis: ['VÉRIFICATION DES AUTORISATIONS', '#ff9a3c'], validation: ['AUTORISATION CONFIRMÉE', '#19e08a'],
      deploy: ['INITIALISATION DU RÉSEAU · KINSHASA', '#38e1ff'], countdown: ['SÉQUENCE ENGAGÉE', '#ff9a3c'],
      activation: ['SERVICE OPÉRATIONNEL', '#19e08a'], transition: ['PREMIERS APPELS D’URGENCE', '#38e1ff'],
    };
    const HINT = {
      standby: '[ ESPACE ] INITIER LE PROTOCOLE', auth: 'SAISIR LE CODE · [ ENTRÉE ] VALIDER · [ ⌫ ] CORRIGER',
      analysis: '', validation: '', deploy: s.communes >= 24 ? '[ ESPACE ] ENGAGER LA SÉQUENCE D’ACTIVATION' : 'DÉPLOIEMENT EN COURS…',
      countdown: '', activation: s.act >= 2 ? '[ ESPACE ] LANCER LA CHAÎNE DE SECOURS' : '', transition: '',
    };
    const boot = s.boot;
    const stats = [
      { label: 'HÔPITAUX CONNECTÉS', n: 142 }, { label: 'ANTENNES RELAIS', n: 38 },
      { label: 'CENTRES DE RÉGULATION', n: 6 }, { label: 'AMBULANCES EN RÉSEAU', n: 210 },
    ].map((x) => ({ label: x.label, val: Math.round(x.n * boot) }));

    const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
    const keypad = labels.map((l) => {
      const isAct = l === 'OK', isClr = l === 'C';
      const onClick = (e) => { e.stopPropagation(); A.unlockAudio(); if (isAct) this.validate(); else if (isClr) this.back(); else this.pressKey(l); };
      return {
        label: isAct ? '⏎' : l, onClick, isAct,
        bg: isAct ? 'rgba(31,143,255,.22)' : (isClr ? 'rgba(255,154,60,.12)' : 'rgba(10,28,48,.55)'),
        border: isAct ? 'rgba(56,225,255,.6)' : (isClr ? 'rgba(255,154,60,.5)' : 'rgba(56,225,255,.22)'),
        color: isAct ? '#38e1ff' : (isClr ? '#ff9a3c' : '#dceaff'),
      };
    });
    const codeCells = Array.from({ length: 6 }).map((_, i) => {
      const filled = i < s.code.length;
      return { ch: filled ? '●' : '', border: s.err ? '#ff4d4d' : (filled ? '#38e1ff' : 'rgba(56,225,255,.25)'),
        glow: s.err ? '0 0 16px rgba(255,77,77,.5)' : (filled ? '0 0 16px rgba(56,225,255,.45)' : 'none') };
    });

    const cdef = [['CERTIFICAT PRÉSIDENTIEL', 22], ['SIGNATURE BIOMÉTRIQUE', 46], ['NIVEAU D’HABILITATION', 72], ['INTÉGRITÉ DU RÉSEAU', 93]];
    const checks = cdef.map(([label, th]) => {
      const ok = s.scanPct >= th; const prog = s.scanPct >= th - 12 && !ok;
      return { label, state: ok ? '✓ VALIDÉ' : (prog ? '…ANALYSE' : 'EN ATTENTE'), color: ok ? '#19e08a' : (prog ? '#38e1ff' : 'rgba(150,190,225,.45)') };
    });

    const nodes = getNodes();
    const lit = s.communes;
    const communeList = nodes.map((n, i) => { const on = i < lit; return {
      name: n.name, x: n.x + '%', y: n.y + '%', size: on ? '13px' : '8px',
      fill: on ? '#38e1ff' : 'rgba(80,120,160,.45)', ring: on ? '#bfeeff' : 'rgba(56,225,255,.3)',
      glow: on ? '0 0 16px rgba(56,225,255,.9),0 0 30px rgba(56,225,255,.4)' : 'none',
      text: on ? '#bfeeff' : 'rgba(140,175,210,.5)' };
    });
    const lines = nodes.map((n, i) => { const on = i < lit; return {
      x: n.x, y: n.y, color: on ? '#38e1ff' : 'rgba(56,225,255,.12)', w: on ? '1.4' : '0.7',
      dash: on ? '0' : '3 4', style: on ? 'filter:drop-shadow(0 0 3px rgba(56,225,255,.7))' : '' };
    });

    const hintText = this.role === 'projection' ? '' : (HINT[p] || '');

    return {
      showVideoFallback: !s.videoPlaying,
      videoOpacity: (p === 'transition' && s.showVideo) ? 1 : 0,
      videoPointerEvents: (p === 'transition' && s.showVideo) ? 'auto' : 'none',
      statusText: (STATUS[p] || ['', ''])[0], statusDot: (STATUS[p] || ['', '#38e1ff'])[1], clock: s.clock,
      hintText,
      isStandby: p === 'standby', isAuth: p === 'auth', isAnalysis: p === 'analysis', isValidation: p === 'validation',
      isDeploy: p === 'deploy', isCountdown: p === 'countdown', isActivation: p === 'activation', isTransition: p === 'transition',
      statsList: stats, keypad, codeCells, errMsg: s.err ? 'CODE INVALIDE — NOUVELLE TENTATIVE' : '', shake: s.err,
      scanPct: s.scanPct, checks,
      deployTitle: s.communes >= 24 ? 'RÉSEAU INITIALISÉ' : 'INITIALISATION DU RÉSEAU',
      communeList, lines, communesLit: lit, deployPct: (lit / 24 * 100) + '%', deployComplete: lit >= 24,
      count: s.count,
      showService: s.act >= 1, showNumber: s.act >= 2,
      showSequence: !s.showVideo,
      t1c: s.tsub >= 0 ? '#38e1ff' : 'rgba(56,225,255,.12)', t2c: s.tsub >= 1 ? '#dceaff' : 'rgba(56,225,255,.1)', t3c: s.tsub >= 2 ? '#9fc4e6' : 'rgba(56,225,255,.08)',
      flashColor: s.flash || 'transparent', flashOpacity: s.flashOp,
    };
  }

  render() {
    const v = this.vals();
    const countStyle = {
      fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 'clamp(220px,34vw,460px)', lineHeight: 1,
      color: this.state.count <= 3 ? '#ff7a3c' : '#fff',
      textShadow: this.state.count <= 3 ? '0 0 80px rgba(255,122,60,.8)' : '0 0 80px rgba(56,225,255,.85),0 0 150px rgba(31,143,255,.5)',
      animation: 'ebCount .95s cubic-bezier(.2,.7,.2,1) both',
    };

    return (
      <div onClick={() => this.onStageClick()} style={css("position:fixed;inset:0;font-family:'Rajdhani',sans-serif;color:#dceaff;background:radial-gradient(120% 120% at 50% 40%,#08182c 0%,#040b16 55%,#02060d 100%);overflow:hidden;cursor:default;-webkit-user-select:none;user-select:none;")}>

        <canvas ref={this.canvasRef} style={css('position:absolute;inset:0;width:100%;height:100%;display:block;')} />

        <div style={css('position:absolute;inset:0;background-image:linear-gradient(rgba(56,225,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(56,225,255,.05) 1px,transparent 1px);background-size:64px 64px;animation:ebGrid 6s linear infinite;mask-image:radial-gradient(circle at 50% 50%,#000 30%,transparent 78%);-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 30%,transparent 78%);pointer-events:none;')} />
        <div style={css('position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,transparent 40%,rgba(2,6,13,.55) 80%,rgba(2,6,13,.92) 100%);pointer-events:none;')} />

        {/* corner frame */}
        <div style={css('position:absolute;top:26px;left:26px;width:54px;height:54px;border-top:2px solid rgba(56,225,255,.5);border-left:2px solid rgba(56,225,255,.5);pointer-events:none;')} />
        <div style={css('position:absolute;top:26px;right:26px;width:54px;height:54px;border-top:2px solid rgba(56,225,255,.5);border-right:2px solid rgba(56,225,255,.5);pointer-events:none;')} />
        <div style={css('position:absolute;bottom:26px;left:26px;width:54px;height:54px;border-bottom:2px solid rgba(56,225,255,.5);border-left:2px solid rgba(56,225,255,.5);pointer-events:none;')} />
        <div style={css('position:absolute;bottom:26px;right:26px;width:54px;height:54px;border-bottom:2px solid rgba(56,225,255,.5);border-right:2px solid rgba(56,225,255,.5);pointer-events:none;')} />

        {/* TOP HUD */}
        <div style={css("position:absolute;top:30px;left:96px;right:96px;display:flex;align-items:center;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.18em;pointer-events:none;")}>
          <div style={css('display:flex;align-items:center;gap:12px;')}>
            <div style={css('width:24px;height:24px;position:relative;display:flex;align-items:center;justify-content:center;')}>
              <div style={css('position:absolute;inset:0;border:1.5px solid rgba(56,225,255,.55);transform:rotate(45deg);')} />
              <div style={css('width:7px;height:7px;background:#38e1ff;transform:rotate(45deg);box-shadow:0 0 10px #38e1ff;')} />
            </div>
            <span style={css("font-family:'Rajdhani';font-weight:700;letter-spacing:.32em;font-size:15px;color:#eaf6ff;")}>{'ÉTOILE BLEUE'}</span>
            <span style={css('color:rgba(150,185,220,.55);')}>· SAMU NATIONAL · RDC</span>
          </div>
          <div style={css('display:flex;align-items:center;gap:10px;color:#38e1ff;')}>
            <span style={{ ...css('width:7px;height:7px;border-radius:50%;animation:ebBlink 1.6s infinite;'), background: v.statusDot, boxShadow: '0 0 8px ' + v.statusDot }} />
            <span style={css('color:rgba(190,220,245,.8);')}>{v.statusText}</span>
          </div>
          <div style={css('display:flex;align-items:center;gap:18px;color:rgba(150,185,220,.6);')}>
            <span>4°19′S · 15°19′E</span>
            <span style={css('color:#eaf6ff;')}>{v.clock}</span>
          </div>
        </div>

        {/* ÉCRAN 1 · ATTENTE */}
        {v.isStandby && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:ebRise .8s ease both;')}>
            <div style={css('position:relative;width:170px;height:170px;display:flex;align-items:center;justify-content:center;margin-bottom:30px;animation:ebFloat 6s ease-in-out infinite;')}>
              <div style={css('position:absolute;inset:0;border:1px solid rgba(56,225,255,.25);border-radius:50%;animation:ebSpin 28s linear infinite;')} />
              <div style={css('position:absolute;inset:20px;border:1px dashed rgba(31,143,255,.4);border-radius:50%;animation:ebSpinR 18s linear infinite;')} />
              <div style={css('position:absolute;inset:0;border-radius:50%;animation:ebBreathe 3.4s ease-in-out infinite;box-shadow:0 0 60px rgba(56,225,255,.35),inset 0 0 40px rgba(56,225,255,.18);')} />
              <div style={css('font-size:74px;color:#eaf6ff;text-shadow:0 0 26px rgba(56,225,255,.85);transform:translateY(-4px);')}>✦</div>
            </div>
            <div style={css("font-family:'IBM Plex Mono';font-size:13px;letter-spacing:.46em;color:rgba(150,190,225,.7);margin-bottom:14px;")}>PROTOCOLE D'ACTIVATION</div>
            <div style={css('font-weight:700;font-size:64px;letter-spacing:.16em;color:#f3f9ff;text-shadow:0 0 30px rgba(31,143,255,.5);line-height:1;')}>ÉTOILE BLEUE</div>
            <div style={css('margin-top:34px;display:flex;align-items:center;gap:16px;')}>
              <div style={css('height:1px;width:70px;background:linear-gradient(90deg,transparent,rgba(56,225,255,.7));')} />
              <div style={css('font-weight:600;font-size:30px;letter-spacing:.28em;color:#38e1ff;animation:ebBreathe 2.6s ease-in-out infinite;')}>SYSTÈME PRÊT</div>
              <div style={css('height:1px;width:70px;background:linear-gradient(90deg,rgba(56,225,255,.7),transparent);')} />
            </div>
            <div style={css("margin-top:14px;font-family:'IBM Plex Mono';font-size:15px;letter-spacing:.22em;color:rgba(170,205,235,.72);")}>En attente de l'autorisation présidentielle</div>
            <div style={css("margin-top:54px;display:flex;gap:0;font-family:'IBM Plex Mono';")}>
              {v.statsList.map((s2, i) => (
                <div key={i} style={css('padding:0 34px;text-align:center;border-left:1px solid rgba(56,225,255,.14);')}>
                  <div style={css("font-family:'Rajdhani';font-weight:700;font-size:38px;color:#eaf6ff;letter-spacing:.04em;")}>{s2.val}</div>
                  <div style={css('font-size:11px;letter-spacing:.18em;color:rgba(150,190,225,.62);margin-top:4px;')}>{s2.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÉCRAN 2 · AUTHENTIFICATION */}
        {v.isAuth && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:ebRise .7s ease both;')}>
            <div style={css("font-family:'IBM Plex Mono';font-size:12px;letter-spacing:.4em;color:#ff9a3c;margin-bottom:10px;display:flex;align-items:center;gap:10px;")}><span style={css('width:6px;height:6px;border-radius:50%;background:#ff9a3c;box-shadow:0 0 8px #ff9a3c;animation:ebBlink 1s infinite;')} />CANAL SÉCURISÉ · AES-256</div>
            <div style={css('font-weight:700;font-size:42px;letter-spacing:.18em;color:#f3f9ff;')}>AUTHENTIFICATION REQUISE</div>
            <div style={css("margin-top:8px;font-family:'IBM Plex Mono';font-size:14px;letter-spacing:.2em;color:rgba(170,205,235,.7);")}>Veuillez saisir le code d'activation présidentiel</div>
            <div style={{ ...css('margin-top:38px;display:flex;gap:14px;'), animation: v.shake ? 'ebShake .5s' : undefined }}>
              {v.codeCells.map((c, i) => (
                <div key={i} style={{ ...css('width:54px;height:66px;border-radius:6px;background:rgba(10,28,48,.55);display:flex;align-items:center;justify-content:center;font-size:30px;color:#eaf6ff;transition:all .2s;'), border: '1.5px solid ' + c.border, boxShadow: c.glow }}>{c.ch}</div>
              ))}
            </div>
            <div style={css("height:18px;margin-top:12px;font-family:'IBM Plex Mono';font-size:13px;letter-spacing:.24em;color:#ff4d4d;")}>{v.errMsg}</div>
            <div style={css('margin-top:18px;display:grid;grid-template-columns:repeat(3,84px);gap:12px;')}>
              {v.keypad.map((k, i) => (
                <button key={i} onClick={k.onClick} className={'eb-key' + (k.isAct ? ' eb-key-ok' : '')} style={{ ...css("height:72px;border-radius:8px;font-family:'Rajdhani';font-weight:600;font-size:26px;letter-spacing:.05em;cursor:pointer;display:flex;align-items:center;justify-content:center;"), border: '1px solid ' + k.border, background: k.bg, color: k.color }}>{k.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* ÉCRAN 3 · ANALYSE */}
        {v.isAnalysis && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:ebRise .6s ease both;')}>
            <div style={css('position:relative;width:300px;height:300px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%;')}>
              <div style={css('position:absolute;inset:0;border:1px solid rgba(56,225,255,.25);border-radius:50%;animation:ebSpin 12s linear infinite;')} />
              <div style={css('position:absolute;inset:28px;border:1px solid rgba(31,143,255,.3);border-radius:50%;animation:ebSpinR 9s linear infinite;')} />
              <div style={css('position:absolute;inset:56px;border:1px dashed rgba(56,225,255,.4);border-radius:50%;animation:ebSpin 7s linear infinite;')} />
              <div style={css('position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(56,225,255,.4);')} />
              <div style={css('position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(56,225,255,.4);')} />
              <div style={css('position:absolute;left:50%;top:50%;width:150px;height:150px;transform-origin:top left;background:conic-gradient(from 0deg,rgba(56,225,255,.32),transparent 38%);border-radius:50%;animation:ebSpin 2.4s linear infinite;margin:-1px 0 0 -1px;')} />
              <div style={css('position:absolute;left:8px;right:8px;height:2px;background:linear-gradient(90deg,transparent,#38e1ff,transparent);animation:ebScan 2.2s linear infinite;box-shadow:0 0 12px #38e1ff;')} />
              <div style={css("position:relative;font-family:'Rajdhani';font-weight:700;font-size:54px;color:#eaf6ff;text-shadow:0 0 18px rgba(56,225,255,.8);")}>{v.scanPct}<span style={css('font-size:24px;')}>%</span></div>
            </div>
            <div style={css('margin-top:34px;font-weight:600;font-size:32px;letter-spacing:.22em;color:#38e1ff;')}>VÉRIFICATION DES AUTORISATIONS</div>
            <div style={css("margin-top:26px;display:flex;flex-direction:column;gap:11px;font-family:'IBM Plex Mono';font-size:14px;letter-spacing:.12em;min-width:440px;")}>
              {v.checks.map((c, i) => (
                <div key={i} style={{ ...css('display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(56,225,255,.12);padding-bottom:9px;'), color: c.color }}>
                  <span>{c.label}</span><span style={css('font-weight:600;')}>{c.state}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÉCRAN 4 · VALIDATION */}
        {v.isValidation && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:ebRise .55s ease both;')}>
            <div style={css('position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center;margin-bottom:34px;')}>
              <div style={css('position:absolute;inset:0;border-radius:50%;border:2px solid rgba(25,224,138,.5);animation:ebPulse 1.8s ease-out infinite;')} />
              <div style={css('position:absolute;inset:0;border-radius:50%;border:2px solid rgba(25,224,138,.3);animation:ebPulse 1.8s ease-out infinite .9s;')} />
              <div style={css('width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,rgba(25,224,138,.3),rgba(25,224,138,.05));border:2px solid #19e08a;display:flex;align-items:center;justify-content:center;font-size:70px;color:#19e08a;box-shadow:0 0 50px rgba(25,224,138,.6);')}>✓</div>
            </div>
            <div style={css('font-weight:700;font-size:60px;letter-spacing:.14em;color:#eafff4;text-shadow:0 0 34px rgba(25,224,138,.7);')}>INITIALISATION ENGAGÉE</div>
            <div style={css("margin-top:16px;font-family:'IBM Plex Mono';font-size:17px;letter-spacing:.22em;color:rgba(160,230,195,.85);")}>Déploiement du réseau en cours</div>
          </div>
        )}

        {/* ÉCRAN 5 · DÉPLOIEMENT */}
        {v.isDeploy && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:ebRise .6s ease both;')}>
            <div style={css("font-family:'IBM Plex Mono';font-size:12px;letter-spacing:.4em;color:rgba(150,190,225,.7);margin-bottom:4px;")}>VILLE-PROVINCE DE KINSHASA · 24 COMMUNES</div>
            <div style={css('font-weight:700;font-size:36px;letter-spacing:.2em;color:#f3f9ff;')}>{v.deployTitle}</div>
            <div style={css('position:relative;width:min(74vw,940px);height:min(56vh,540px);margin-top:18px;')}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={css('position:absolute;inset:0;width:100%;height:100%;overflow:visible;')}>
                {v.lines.map((l, i) => (
                  <line key={i} x1={l.x} y1={l.y} x2="50" y2="50" stroke={l.color} strokeWidth={l.w} vectorEffect="non-scaling-stroke" strokeDasharray={l.dash} style={css(l.style)} />
                ))}
              </svg>
              <div style={css('position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:118px;height:118px;display:flex;align-items:center;justify-content:center;')}>
                <div style={css('position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(56,225,255,.4);animation:ebRing 2.6s ease-out infinite;')} />
                <div style={css('width:54px;height:54px;border-radius:50%;background:radial-gradient(circle,rgba(56,225,255,.6),rgba(31,143,255,.15));border:1.5px solid #38e1ff;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 0 30px rgba(56,225,255,.7);')}>✦</div>
                <div style={css("position:absolute;bottom:-26px;font-family:'IBM Plex Mono';font-size:10px;letter-spacing:.16em;color:#38e1ff;white-space:nowrap;")}>CRRA · RÉGULATION</div>
              </div>
              {v.communeList.map((n, i) => (
                <div key={i} style={{ ...css('position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:4px;transition:all .4s;'), left: n.x, top: n.y }}>
                  <div style={{ ...css('border-radius:50%;transition:all .4s;'), width: n.size, height: n.size, background: n.fill, border: '1px solid ' + n.ring, boxShadow: n.glow }} />
                  <div style={{ ...css("font-family:'IBM Plex Mono';font-size:9.5px;letter-spacing:.05em;white-space:nowrap;transition:all .4s;"), color: n.text }}>{n.name}</div>
                </div>
              ))}
            </div>
            <div style={css('margin-top:14px;display:flex;align-items:center;gap:20px;')}>
              <div style={css("font-family:'IBM Plex Mono';font-size:15px;letter-spacing:.16em;color:#38e1ff;")}>{v.communesLit} / 24 COMMUNES</div>
              <div style={css('width:300px;height:4px;background:rgba(56,225,255,.15);border-radius:2px;overflow:hidden;')}>
                <div style={{ ...css('height:100%;background:linear-gradient(90deg,#1f8fff,#38e1ff);box-shadow:0 0 10px #38e1ff;transition:width .3s;'), width: v.deployPct }} />
              </div>
            </div>
            {v.deployComplete && (
              <div style={css('margin-top:18px;font-weight:700;font-size:30px;letter-spacing:.18em;color:#19e08a;text-shadow:0 0 24px rgba(25,224,138,.6);animation:ebRise .6s ease both;')}>INITIALISATION TERMINÉE · 24 COMMUNES</div>
            )}
          </div>
        )}

        {/* ÉCRAN 6 · COMPTE À REBOURS */}
        {v.isCountdown && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;')}>
            <div style={css("font-family:'IBM Plex Mono';font-size:15px;letter-spacing:.44em;color:#38e1ff;animation:ebBlink 1s infinite;")}>SÉQUENCE D'ACTIVATION ENGAGÉE</div>
            <div style={css('position:relative;display:flex;align-items:center;justify-content:center;margin:10px 0;')}>
              <div style={css('position:absolute;width:520px;height:520px;border-radius:50%;border:1px solid rgba(56,225,255,.18);animation:ebSpin 22s linear infinite;')} />
              <div style={css('position:absolute;width:420px;height:420px;border-radius:50%;border:1px dashed rgba(31,143,255,.25);animation:ebSpinR 16s linear infinite;')} />
              <div key={this.state.count} style={countStyle}>{String(this.state.count)}</div>
            </div>
            <div style={css("font-family:'IBM Plex Mono';font-size:14px;letter-spacing:.3em;color:rgba(170,205,235,.6);")}>ACTIVATION NATIONALE IMMINENTE</div>
          </div>
        )}

        {/* ÉCRAN 7 · ACTIVATION */}
        {v.isActivation && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;')}>
            <div style={css('font-weight:700;font-size:clamp(56px,11vw,150px);letter-spacing:.08em;color:#f3f9ff;text-shadow:0 0 60px rgba(56,225,255,.85);animation:ebBigIn 1s ease both;line-height:.96;')}>ÉTOILE BLEUE</div>
            {v.showService && (
              <div style={css('margin-top:14px;font-weight:600;font-size:clamp(26px,4vw,52px);letter-spacing:.34em;color:#19e08a;text-shadow:0 0 30px rgba(25,224,138,.7);animation:ebBigIn .8s ease both;')}>SERVICE ACTIVÉ</div>
            )}
            {v.showNumber && (
              <div style={css('margin-top:6px;display:flex;flex-direction:column;align-items:center;animation:ebBigIn 1s ease both;')}>
                <div style={css("font-family:'IBM Plex Mono';font-size:clamp(13px,1.6vw,20px);letter-spacing:.5em;color:rgba(170,205,235,.75);margin-bottom:-10px;")}>NUMÉRO D'URGENCE NATIONAL</div>
                <div style={css('font-weight:700;font-size:clamp(160px,30vw,440px);letter-spacing:.02em;color:#fff;line-height:1;text-shadow:0 0 70px rgba(56,225,255,.9),0 0 140px rgba(31,143,255,.6);')}>199</div>
                <div style={css("margin-top:6px;font-family:'IBM Plex Mono';font-weight:600;font-size:clamp(13px,1.5vw,19px);letter-spacing:.34em;color:#19e08a;text-shadow:0 0 24px rgba(25,224,138,.6);")}>100% OPÉRATIONNEL · VILLE DE KINSHASA</div>
              </div>
            )}
          </div>
        )}

        {/* TRANSITION sequence text */}
        {v.isTransition && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;')}>
            {v.showSequence && (
              <div style={css('display:flex;flex-direction:column;align-items:center;gap:26px;')}>
                <div style={{ ...css('font-weight:700;font-size:48px;letter-spacing:.18em;text-shadow:0 0 30px rgba(56,225,255,.6);transition:all .6s;'), color: v.t1c }}>PREMIER APPEL ENTRANT</div>
                <div style={{ ...css('font-weight:600;font-size:36px;letter-spacing:.2em;transition:all .6s;'), color: v.t2c }}>ROUTAGE DE L'URGENCE</div>
                <div style={{ ...css('font-weight:500;font-size:30px;letter-spacing:.22em;transition:all .6s;'), color: v.t3c }}>INITIALISATION DE LA CHAÎNE DE SECOURS</div>
                <div style={css('margin-top:10px;width:46px;height:46px;border:2px solid rgba(56,225,255,.25);border-top-color:#38e1ff;border-radius:50%;animation:ebSpin 1s linear infinite;')} />
              </div>
            )}
          </div>
        )}

        {/* bottom hint */}
        <div style={css('position:absolute;bottom:34px;left:0;right:0;display:flex;justify-content:center;pointer-events:none;')}>
          <div style={css("font-family:'IBM Plex Mono';font-size:12.5px;letter-spacing:.24em;color:rgba(150,190,225,.6);")}>{v.hintText}</div>
        </div>

        {/* ALWAYS-MOUNTED FULLSCREEN VIDEO (projection only — preloads from page load) */}
        {this.role === 'projection' && (
          <div style={{ ...css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;transition:opacity 0.8s ease;z-index:90;'), opacity: v.videoOpacity, pointerEvents: v.videoPointerEvents }}>
            <video ref={this.videoRef} src={this.videoSrc || undefined} preload="auto" playsInline onPlay={() => this.onVideoPlay()} style={css('width:100%;height:100%;object-fit:cover;z-index:2;position:relative;')} />
            {v.showVideoFallback && (
              <div style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;pointer-events:none;color:rgba(150,190,225,.5);font-family:'IBM Plex Mono';font-size:14px;letter-spacing:.2em;text-align:center;z-index:3;")}>
                <div style={css('width:84px;height:84px;border-radius:50%;border:1.5px solid rgba(56,225,255,.4);display:flex;align-items:center;justify-content:center;font-size:30px;color:#38e1ff;')}>▶</div>
                <div>VIDÉO OFFICIELLE</div>
              </div>
            )}
          </div>
        )}

        {/* flash overlay */}
        <div style={{ ...css('position:absolute;inset:0;pointer-events:none;transition:opacity .8s ease;'), background: v.flashColor, opacity: v.flashOpacity }} />
      </div>
    );
  }
}
