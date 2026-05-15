import { useEffect, useRef, useMemo, forwardRef } from 'react';

interface FightAnimationProps {
  song1: { title: string; artist: string; album_art_url?: string; avg_score?: number };
  song2: { title: string; artist: string; album_art_url?: string; avg_score?: number };
  winner: 'song1' | 'song2';
  onComplete?: () => void;
  autoPlay?: boolean;
  isFinal?: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Stable "random" values so stars/city don't re-randomise on re-render
function makeSeeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function FightAnimation({ song1, song2, winner, onComplete, autoPlay, isFinal }: FightAnimationProps) {
  const winnerId   = winner === 'song1' ? 'p1' : 'p2';
  const loserId    = winner === 'song1' ? 'p2' : 'p1';
  const winnerSong = winner === 'song1' ? song1 : song2;

  // DOM refs — we drive the animation imperatively, exactly like the prototype
  const screenRef     = useRef<HTMLDivElement>(null);
  const af1Ref        = useRef<HTMLDivElement>(null);
  const af2Ref        = useRef<HTMLDivElement>(null);
  const flashRef      = useRef<HTMLDivElement>(null);
  const sparkRef      = useRef<HTMLDivElement>(null);
  const hp1Ref        = useRef<HTMLDivElement>(null);
  const hp2Ref        = useRef<HTMLDivElement>(null);
  const hp1OuterRef   = useRef<HTMLDivElement>(null);
  const hp2OuterRef   = useRef<HTMLDivElement>(null);
  const roundCardRef  = useRef<HTMLDivElement>(null);
  const fightTextRef  = useRef<HTMLDivElement>(null);
  const koTextRef     = useRef<HTMLDivElement>(null);
  const winnerOverRef = useRef<HTMLDivElement>(null);
  const startedRef    = useRef(false);

  // Stable background decorations
  const rand = useMemo(() => makeSeeded(42), []);
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    key: i, sz: rand() < 0.15 ? 2 : 1,
    top: rand() * 100, left: rand() * 100, op: 0.15 + rand() * 0.85,
  })), []);
  const buildings = useMemo(() => [20,14,26,12,18,22,16,20,12,28,14,18,22,16,20,14].map((w,i) => ({
    key: i, w, h: [50,38,75,32,60,85,42,65,36,95,48,58,80,40,70,45][i],
  })), []);
  const crowd = useMemo(() => Array.from({ length: 34 }, (_, i) => i), []);

  // ── Helpers ──────────────────────────────────────────────────
  const afRef = (id: string) => id === 'p1' ? af1Ref : af2Ref;
  const hpInnerRef = (id: string) => id === 'p1' ? hp1Ref : hp2Ref;
  const hpORef = (id: string) => id === 'p1' ? hp1OuterRef : hp2OuterRef;

  async function flashScreen(color = '#fff', op = 0.7) {
    if (!flashRef.current) return;
    flashRef.current.style.background = color;
    flashRef.current.style.opacity = String(op);
    await sleep(65);
    if (flashRef.current) flashRef.current.style.opacity = '0';
  }

  function shakeScreen() {
    const el = screenRef.current;
    if (!el) return;
    el.classList.remove('fa-shake');
    void el.offsetWidth;
    el.classList.add('fa-shake');
    setTimeout(() => el.classList.remove('fa-shake'), 300);
  }

  function setHP(songId: string, pct: number) {
    const inner = hpInnerRef(songId).current;
    const outer = hpORef(songId).current;
    if (!inner || !outer) return;
    inner.style.width = Math.max(0, pct) + '%';
    outer.className = 'fa-hp-outer' + (songId === 'p2' ? ' fa-hp2' : '');
    if (pct <= 0)       inner.style.width = '0%';
    else if (pct <= 25) outer.classList.add('fa-hp-red');
    else if (pct <= 50) outer.classList.add('fa-hp-yellow');
    const af = afRef(songId).current;
    if (!af) return;
    if (pct <= 0)       af.classList.add('fa-shattered');
    else if (pct <= 35) af.classList.add('fa-cracked');
  }

  function showSpark(targetId: string) {
    const af = afRef(targetId).current;
    const s  = sparkRef.current;
    const sc = screenRef.current;
    if (!af || !s || !sc) return;
    const fr = af.getBoundingClientRect();
    const sr = sc.getBoundingClientRect();
    const x  = targetId === 'p1' ? (fr.right - sr.left - 8) : (fr.left - sr.left + 8);
    const y  = fr.top - sr.top + 26;
    s.style.left = x + 'px';
    s.style.top  = y + 'px';
    s.style.animation = 'none';
    void s.offsetWidth;
    s.style.animation = 'fa-spark 0.4s ease-out forwards';
  }

  async function doPunch(atkId: string, defId: string) {
    const atk = afRef(atkId).current;
    const def = afRef(defId).current;
    if (!atk || !def) return;

    atk.classList.remove('fa-idle-p1', 'fa-idle-p2');
    def.classList.remove('fa-idle-p1', 'fa-idle-p2');

    atk.classList.add('fa-punching');
    const lean = atkId === 'p2' ? 'scaleX(-1) translateX(28px)' : 'translateX(28px)';
    atk.style.transition = 'transform 0.1s ease-out';
    atk.style.transform  = lean;

    await sleep(130);
    showSpark(defId);
    flashScreen('#fff', 0.5);
    shakeScreen();

    const knock = defId === 'p2' ? 'scaleX(-1) translateX(10px)' : 'translateX(-10px)';
    def.style.transition = 'transform 0.08s ease-out, filter 0.05s';
    def.style.filter     = 'brightness(3.5) saturate(0)';
    def.style.transform  = knock;

    await sleep(110);

    atk.classList.remove('fa-punching');
    atk.style.transition = 'transform 0.18s ease-out';
    atk.style.transform  = atkId === 'p2' ? 'scaleX(-1)' : '';

    def.style.filter = '';
    def.style.transition = 'transform 0.2s ease-out, filter 0.1s';
    def.style.transform  = defId === 'p2' ? 'scaleX(-1)' : '';

    await sleep(180);
    atk.classList.add(atkId === 'p1' ? 'fa-idle-p1' : 'fa-idle-p2');
    def.classList.add(defId === 'p1' ? 'fa-idle-p1' : 'fa-idle-p2');
  }

  async function doKO(losingId: string) {
    const af = afRef(losingId).current;
    if (!af) return;
    af.classList.remove('fa-idle-p1', 'fa-idle-p2');
    af.classList.add('fa-shattered');
    const spin = losingId === 'p1'
      ? 'translateY(120px) translateX(-30px) rotate(-120deg) scale(0.6)'
      : 'scaleX(-1) translateY(120px) translateX(-30px) rotate(120deg) scale(0.6)';
    af.style.transition = 'transform 0.7s cubic-bezier(0.4,0,1,1), opacity 0.55s 0.25s, filter 0.3s';
    af.style.filter     = 'brightness(0.25) saturate(0)';
    af.style.transform  = spin;
    af.style.opacity    = '0';
    await sleep(750);
  }

  async function runFight() {
    if (startedRef.current) return;
    startedRef.current = true;

    const af1 = af1Ref.current;
    const af2 = af2Ref.current;
    if (!af1 || !af2) return;

    af1.style.transform = '';
    af2.style.transform = 'scaleX(-1)';
    af1.classList.add('fa-idle-p1');
    af2.classList.add('fa-idle-p2');

    // Round card
    const card = roundCardRef.current;
    if (card) {
      card.style.transition = 'opacity 0.35s, transform 0.35s cubic-bezier(0.17,0.67,0.83,0.67)';
      card.style.opacity    = '1';
      card.style.transform  = 'scale(1)';
    }
    await sleep(1600);
    if (card) { card.style.opacity = '0'; card.style.transform = 'scale(0.65)'; }
    await sleep(400);

    // FIGHT!
    const ft = fightTextRef.current;
    if (ft) {
      ft.style.transition = 'all 0.14s cubic-bezier(0.17,0.67,0.83,0.67)';
      ft.style.opacity    = '1';
      ft.style.transform  = 'scale(1.05)';
    }
    flashScreen('#ffff0011', 0.2);
    await sleep(600);
    if (ft) { ft.style.transition = 'all 0.2s ease-in'; ft.style.opacity = '0'; ft.style.transform = 'scale(1.7)'; }
    await sleep(250);

    // Punch sequence
    const wId = winnerId, lId = loserId;
    await sleep(280);
    await doPunch(wId, lId); setHP(lId, 65);
    await sleep(580);
    await doPunch(lId, wId); setHP(wId, 86);
    await sleep(440);
    await doPunch(wId, lId); setHP(lId, 33);
    await sleep(390);
    await doPunch(lId, wId); setHP(wId, 78);
    await sleep(330);
    await doPunch(wId, lId); setHP(lId, 10);
    await sleep(260);

    flashScreen('#ff000044', 0.6);
    await doPunch(wId, lId); setHP(lId, 0);
    await sleep(150);

    await doKO(lId);
    await sleep(400);

    // K.O. text
    const ko = koTextRef.current;
    if (ko) {
      ko.style.transition = 'all 0.18s cubic-bezier(0.17,0.67,0.83,0.67)';
      ko.style.opacity    = '1';
      ko.style.transform  = 'scale(1)';
    }
    shakeScreen();
    await sleep(120);
    if (ko) ko.style.transform = 'scale(1.08)';
    await sleep(1500);
    if (ko) { ko.style.transition = 'opacity 0.3s'; ko.style.opacity = '0'; }
    await sleep(400);

    // Winner screen
    const wo = winnerOverRef.current;
    if (wo) { wo.style.transition = 'opacity 0.5s'; wo.style.opacity = '1'; wo.style.pointerEvents = 'all'; }
    onComplete?.();
  }

  useEffect(() => {
    if (!autoPlay) return;
    const t = setTimeout(runFight, 500);
    return () => clearTimeout(t);
  }, [autoPlay]);

  // ── Render ────────────────────────────────────────────────────
  const px = (n: number): React.CSSProperties => ({ position: 'absolute' as const });

  return (
    <>
      <style>{`
        @keyframes fa-float-p1 {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes fa-float-p2 {
          0%,100% { transform: scaleX(-1) translateY(0); }
          50%      { transform: scaleX(-1) translateY(-5px); }
        }
        @keyframes fa-shake {
          0%,100% { transform:translate(0,0); }
          20% { transform:translate(-5px,-2px); }
          40% { transform:translate(4px,3px); }
          60% { transform:translate(-4px,2px); }
          80% { transform:translate(3px,-2px); }
        }
        @keyframes fa-spark {
          0%   { transform:translate(-50%,-50%) scale(0);   opacity:1; }
          50%  { transform:translate(-50%,-50%) scale(1.5); opacity:1; }
          100% { transform:translate(-50%,-50%) scale(0.8); opacity:0; }
        }
        @keyframes fa-blink { 50% { opacity:0; } }

        .fa-idle-p1 { animation: fa-float-p1 1.5s ease-in-out infinite; }
        .fa-idle-p2 { animation: fa-float-p2 1.5s ease-in-out infinite 0.25s; }
        .fa-shake   { animation: fa-shake 0.3s ease-in-out; }

        .fa-punching .fa-glove-front { transform: translateX(38px) rotate(-6deg) !important; }
        .fa-punching .fa-arm-front   { transform: scaleX(2.2) !important; }

        .fa-hp-outer  { height:8px; background:#0a0a14; border:1px solid #2a2a44; overflow:hidden; position:relative; }
        .fa-hp-yellow .fa-hp-inner { background: linear-gradient(to right,#ccaa00,#ffdd00) !important; }
        .fa-hp-red    .fa-hp-inner { background: linear-gradient(to right,#880000,#ff2200) !important; }
        .fa-hp2.fa-hp-yellow .fa-hp-inner { background: linear-gradient(to left,#ccaa00,#ffdd00) !important; }
        .fa-hp2.fa-hp-red    .fa-hp-inner { background: linear-gradient(to left,#880000,#ff2200) !important; }

        .fa-cracked .fa-crack { opacity:1 !important; }
        .fa-shattered .fa-crack {
          opacity:1 !important;
          background:
            linear-gradient(135deg,transparent 18%,rgba(255,255,255,0.35) 19%,transparent 22%),
            linear-gradient(80deg,transparent 33%,rgba(255,255,255,0.25) 34%,transparent 37%),
            linear-gradient(165deg,transparent 12%,rgba(255,255,255,0.3) 13%,transparent 16%),
            linear-gradient(50deg,transparent 58%,rgba(255,255,255,0.2) 59%,transparent 62%) !important;
        }
      `}</style>

      {/* Shared SVG gradient defs — referenced by all fighter glove SVGs */}
      <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
        <defs>
          <radialGradient id="fa-glov-body" cx="32%" cy="28%" r="68%">
            <stop offset="0%"   stopColor="#ff6644" />
            <stop offset="40%"  stopColor="#cc1100" />
            <stop offset="100%" stopColor="#770600" />
          </radialGradient>
          <radialGradient id="fa-glov-thumb" cx="38%" cy="30%" r="65%">
            <stop offset="0%"   stopColor="#ff5533" />
            <stop offset="100%" stopColor="#991100" />
          </radialGradient>
          <linearGradient id="fa-glov-tape" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e0e0e0" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Fight screen ── */}
      <div ref={screenRef} style={{ width:'100%', height:220, position:'relative', overflow:'hidden', background:'#0a0018', border:'2px solid #222', boxShadow:'0 0 30px #00ffff1a,0 0 60px #00000088', borderRadius:8 }}>

        {/* CRT scanlines */}
        <div style={{ position:'absolute', inset:0, background:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)', pointerEvents:'none', zIndex:100 }} />
        {/* CRT vignette */}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,0.65) 100%)', pointerEvents:'none', zIndex:101 }} />

        {/* Stage bg */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,#050010 0%,#12003a 40%,#0a0f28 70%,#07060f 100%)' }} />

        {/* Stars */}
        <div style={{ position:'absolute', width:'100%', height:'65%', top:0 }}>
          {stars.map(s => <div key={s.key} style={{ position:'absolute', width:s.sz, height:s.sz, background:'#fff', borderRadius:'50%', top:`${s.top}%`, left:`${s.left}%`, opacity:s.op }} />)}
        </div>

        {/* City */}
        <div style={{ position:'absolute', bottom:'16%', width:'100%', height:'15%', display:'flex', alignItems:'flex-end', gap:2, padding:'0 3%' }}>
          {buildings.map(b => <div key={b.key} style={{ background:'#08000f', flexShrink:0, width:b.w*0.6, height:`${b.h}%` }} />)}
        </div>

        {/* Crowd */}
        <div style={{ position:'absolute', bottom:'14%', width:'100%', height:'12%', display:'flex', alignItems:'flex-end', gap:1, padding:'0 2%' }}>
          {crowd.map(i => <div key={i} style={{ flex:1, background:i%3===0?'#040008':i%2===0?'#090012':'#06000f', borderTopLeftRadius:'50% 100%', borderTopRightRadius:'50% 100%', minHeight:i%3===0?'100%':i%2===0?'80%':'55%' }} />)}
        </div>

        {/* Floor */}
        <div style={{ position:'absolute', bottom:0, width:'100%', height:'14%', background:'linear-gradient(to bottom,#13103a,#090718)', borderTop:'2px solid rgba(100,80,255,0.35)' }}>
          <div style={{ position:'absolute', top:0, width:'100%', height:4, background:'linear-gradient(90deg,transparent,#6644ff66 20%,#aa88ffbb 50%,#6644ff66 80%,transparent)' }} />
        </div>

        {/* ── HUD ── */}
        <div style={{ position:'absolute', top:0, left:0, right:0, padding:'6px 8px', display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.85)', borderBottom:'2px solid #1a1a2e', zIndex:50 }}>
          {/* P1 */}
          <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:30, height:30, flexShrink:0, borderRadius:3, overflow:'hidden', border:'2px solid #00ffff', boxShadow:'0 0 6px #00ffff55' }}>
              {song1.album_art_url ? <img src={song1.album_art_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center' }}>🎵</div>}
            </div>
            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3 }}>
              <div style={{ fontSize:5, fontFamily:"'Press Start 2P',monospace", color:'#00ffff', letterSpacing:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{song1.title}</div>
              <div className="fa-hp-outer" ref={hp1OuterRef}>
                <div ref={hp1Ref} className="fa-hp-inner" style={{ height:'100%', width:'100%', background:'linear-gradient(to right,#00aa44,#00ff66)', transition:'width 0.4s ease', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', inset:0, background:'repeating-linear-gradient(90deg,transparent,transparent 5px,rgba(0,0,0,0.22) 5px,rgba(0,0,0,0.22) 6px)' }} />
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'rgba(255,255,255,0.25)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* P2 */}
          <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, flexDirection:'row-reverse' }}>
            <div style={{ width:30, height:30, flexShrink:0, borderRadius:3, overflow:'hidden', border:'2px solid #ff44ff', boxShadow:'0 0 6px #ff44ff55' }}>
              {song2.album_art_url ? <img src={song2.album_art_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center' }}>🎵</div>}
            </div>
            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3, alignItems:'flex-end' }}>
              <div style={{ fontSize:5, fontFamily:"'Press Start 2P',monospace", color:'#ff44ff', letterSpacing:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', width:'100%', textAlign:'right' }}>{song2.title}</div>
              <div className="fa-hp-outer fa-hp2" ref={hp2OuterRef} style={{ direction:'rtl', width:'100%' }}>
                <div ref={hp2Ref} className="fa-hp-inner" style={{ height:'100%', width:'100%', background:'linear-gradient(to left,#00aa44,#00ff66)', transition:'width 0.4s ease', position:'relative', overflow:'hidden', float:'right' }}>
                  <div style={{ position:'absolute', inset:0, background:'repeating-linear-gradient(90deg,transparent,transparent 5px,rgba(0,0,0,0.22) 5px,rgba(0,0,0,0.22) 6px)' }} />
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'rgba(255,255,255,0.25)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fighters ── */}
        <div style={{ position:'absolute', bottom:'14%', left:0, right:0, height:'50%', display:'flex', alignItems:'flex-end', justifyContent:'center', gap:8 }}>
          <AlbumFighter ref={af1Ref} song={song1} playerId="p1" />
          <AlbumFighter ref={af2Ref} song={song2} playerId="p2" />
        </div>

        {/* Hit spark */}
        <div ref={sparkRef} style={{ position:'absolute', width:50, height:50, opacity:0, pointerEvents:'none', zIndex:85, transform:'translate(-50%,-50%)' }}>
          {[0,45,90,135,180,225,270,315].map((deg, i) => (
            <div key={deg} style={{ position:'absolute', top:'50%', left:'50%', height:3, width:[24,16,20,14,22,12,18,14][i], background:i%2===0?'#ffff00':'#ff8800', transformOrigin:'left center', transform:`rotate(${deg}deg) translateY(-50%)`, borderRadius:2 }} />
          ))}
        </div>

        {/* Screen flash */}
        <div ref={flashRef} style={{ position:'absolute', inset:0, background:'#fff', opacity:0, pointerEvents:'none', zIndex:90 }} />

        {/* Round card */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:70 }}>
          <div ref={roundCardRef} style={{ background:'rgba(0,0,0,0.85)', border:'3px solid #ffb800', padding:'14px 28px', textAlign:'center', opacity:0, transform:'scale(0.4)' }}>
            <div style={{ fontSize:8, fontFamily:"'Press Start 2P',monospace", color:'#ffb800', letterSpacing:3, marginBottom:6 }}>ROUND 1</div>
            <div style={{ fontSize:5, fontFamily:"'Press Start 2P',monospace", color:'#888', letterSpacing:2 }}>★ &nbsp; FIGHT! &nbsp; ★</div>
          </div>
        </div>

        {/* FIGHT! */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:70 }}>
          <div ref={fightTextRef} style={{ fontSize:36, fontFamily:"'Press Start 2P',monospace", color:'#ffff00', textShadow:'4px 4px 0 #cc0000,-2px -2px 0 #000', opacity:0, transform:'scale(0.2)', letterSpacing:4 }}>FIGHT!</div>
        </div>

        {/* K.O. */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:70 }}>
          <div ref={koTextRef} style={{ fontSize:44, fontFamily:"'Press Start 2P',monospace", color:'#ff1111', textShadow:'5px 5px 0 #000,-3px -3px 0 #880000', opacity:0, transform:'scale(2.5)', letterSpacing:6 }}>K.O.</div>
        </div>

        {/* Winner overlay */}
        <div ref={winnerOverRef} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, opacity:0, pointerEvents:'none', zIndex:75 }}>
          <div style={{ position:'relative' }}>
            {isFinal && <div style={{ position:'absolute', top:-16, left:'50%', transform:'translateX(-50%)', fontSize:18 }}>👑</div>}
            {winnerSong.album_art_url
              ? <img src={winnerSong.album_art_url} alt="" style={{ width:60, height:60, borderRadius:6, border:'3px solid #ffb800', boxShadow:'0 0 20px #ffb80099,0 0 40px #ffb80033', display:'block' }} />
              : <div style={{ width:60, height:60, borderRadius:6, border:'3px solid #ffb800', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🎵</div>
            }
          </div>
          <div style={{ fontSize:6, fontFamily:"'Press Start 2P',monospace", color:'#ffb800', letterSpacing:3 }}>★ WINNER ★</div>
          <div style={{ fontSize:9, fontFamily:"'Press Start 2P',monospace", color:'#fff', textAlign:'center', lineHeight:1.8, padding:'0 12px' }}>{winnerSong.title}</div>
          <div style={{ fontSize:6, fontFamily:"'Press Start 2P',monospace", color:'#aaa' }}>{winnerSong.artist}</div>
          {winnerSong.avg_score != null && (
            <div style={{ fontSize:6, fontFamily:"'Press Start 2P',monospace", color:'#00ffff' }}>AVG SCORE: {winnerSong.avg_score}/10</div>
          )}
        </div>

        {/* Press Start (manual mode) */}
        {!autoPlay && (
          <button onClick={runFight} style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', fontFamily:"'Press Start 2P',monospace", fontSize:7, background:'transparent', border:'2px solid #00ffff', color:'#00ffff', padding:'8px 14px', cursor:'pointer', zIndex:200, animation:'fa-blink 1s steps(1) infinite' }}>
            ▶ PRESS START
          </button>
        )}
      </div>
    </>
  );
}

// ── Album Art Fighter ─────────────────────────────────────────────────────────
interface AlbumFighterProps {
  song: { title: string; album_art_url?: string };
  playerId: 'p1' | 'p2';
}

const AlbumFighter = forwardRef<HTMLDivElement, AlbumFighterProps>(({ song, playerId }, ref) => {
  const isP2 = playerId === 'p2';
  const armColor  = isP2 ? '#880066' : '#0055bb';
  const legColor  = isP2 ? '#660055' : '#00337a';
  const bandBg    = isP2 ? '#ee22cc' : '#00ddcc';
  const bandGlow  = isP2 ? '0 0 5px #ff44ff99' : '0 0 5px #00ffff99';
  const bandTail  = isP2 ? '#cc11aa' : '#00bbaa';
  const imgBorder = isP2 ? '3px solid #ff44ff' : '3px solid #00ffff';
  const imgGlow   = isP2 ? '0 0 12px #ff44ff77,0 0 28px #ff44ff33' : '0 0 12px #00ffff77,0 0 28px #00ffff33';
  const A: React.CSSProperties = { position: 'absolute' };

  const GloveSVG = ({ className, style }: { className: string; style: React.CSSProperties }) => (
    <svg className={className} style={{ ...A, ...style }} viewBox="0 0 46 58">
      <rect x="8" y="40" width="30" height="17" rx="6" fill="url(#fa-glov-tape)" />
      <rect x="11" y="44" width="24" height="2.5" rx="1" fill="#ccc" opacity="0.7" />
      <rect x="11" y="49" width="24" height="1.5" rx="1" fill="#ccc" opacity="0.5" />
      <path d="M 11,43 L 11,24 C 11,9 17,3 25,3 C 33,3 41,9 41,21 C 41,31 37,39 29,43 Z" fill="url(#fa-glov-body)" />
      <path d="M 11,16 C 5,13 2,17 3,24 C 4,30 8,34 11,32 Z" fill="url(#fa-glov-thumb)" />
      <path d="M 11,16 C 11,22 11,28 11,34" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" fill="none" strokeDasharray="3,2.5" />
      <path d="M 21,7 Q 32,4 39,13" stroke="rgba(255,255,255,0.48)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 23,20 Q 33,18 40,22" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 23,26 Q 32,25 39,28" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M 39,21 C 41,29 39,37 31,43 L 29,43 C 37,37 39,29 37,21 Z" fill="rgba(0,0,0,0.18)" />
    </svg>
  );

  return (
    <div ref={ref} style={{ position:'relative', width:120, height:115, willChange:'transform', transform: isP2 ? 'scaleX(-1)' : '' }}>

      {/* Headband */}
      <div style={{ ...A, top:10, left:26, width:68, height:11, background:bandBg, boxShadow:bandGlow, zIndex:5, borderRadius:2 }}>
        <div style={{ position:'absolute', top:3, left:5, right:5, height:2, background:'rgba(255,255,255,0.5)', borderRadius:1 }} />
        <div style={{ position:'absolute', top:1, left:-11, width:13, height:8, background:bandTail, borderRadius:'0 0 3px 3px', transform:'rotate(-15deg)' }} />
      </div>

      {/* Album art */}
      {song.album_art_url
        ? <img src={song.album_art_url} alt={song.title} style={{ ...A, top:0, left:26, width:68, height:68, objectFit:'cover', borderRadius:6, zIndex:3, border:imgBorder, boxShadow:imgGlow }} />
        : <div style={{ ...A, top:0, left:26, width:68, height:68, borderRadius:6, zIndex:3, border:imgBorder, background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🎵</div>
      }

      {/* Crack overlay */}
      <div className="fa-crack" style={{ ...A, top:0, left:26, width:68, height:68, borderRadius:6, zIndex:6, opacity:0, pointerEvents:'none', transition:'opacity 0.3s', background:'linear-gradient(135deg,transparent 38%,rgba(255,255,255,0.2) 39%,transparent 41%),linear-gradient(80deg,transparent 52%,rgba(255,255,255,0.15) 53%,transparent 55%),linear-gradient(165deg,transparent 28%,rgba(255,255,255,0.18) 29%,transparent 31%)' }} />

      {/* Back arm + glove */}
      <div style={{ ...A, top:39, left:3, width:26, height:9, borderRadius:5, background:armColor, zIndex:2, opacity:0.7 }} />
      <GloveSVG className="fa-glove-back" style={{ top:25, left:-5, width:35, height:44, zIndex:2, opacity:0.75 }} />

      {/* Front arm + glove */}
      <div className="fa-arm-front" style={{ ...A, top:39, left:93, width:26, height:9, borderRadius:5, background:armColor, zIndex:4, transformOrigin:'left center', transition:'transform 0.1s ease-out' }} />
      <GloveSVG className="fa-glove-front" style={{ top:24, left:93, width:35, height:44, zIndex:4, transformOrigin:'left center', transition:'transform 0.1s ease-out' }} />

      {/* Legs */}
      <div style={{ ...A, top:66, left:38, width:13, height:30, borderRadius:'3px 3px 2px 2px', background:legColor, zIndex:2 }} />
      <div style={{ ...A, top:66, left:69, width:13, height:30, borderRadius:'3px 3px 2px 2px', background:legColor, zIndex:2 }} />

      {/* Shoes */}
      <div style={{ ...A, top:93, left:31, width:18, height:9, borderRadius:'2px 5px 5px 2px', background:'#111', boxShadow:'0 2px 0 #333', zIndex:2 }} />
      <div style={{ ...A, top:93, left:66, width:21, height:9, borderRadius:'2px 6px 6px 2px', background:'#111', boxShadow:'0 2px 0 #333', zIndex:2 }} />

      {/* Ground shadow */}
      <div style={{ position:'absolute', bottom:-4, left:30, right:20, height:7, background:'rgba(0,0,0,0.35)', borderRadius:'50%', filter:'blur(3px)', zIndex:1 }} />
    </div>
  );
});
AlbumFighter.displayName = 'AlbumFighter';
