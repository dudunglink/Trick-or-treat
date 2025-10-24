import React, { useEffect, useRef, useState } from "react";

/**
 * 🎃 Dudung Ghost Catch — 390×844 Dark Mode (stable, responsive fixed)
 */

const USER_SPLASH_URL  = "./splash.png";
const USER_DUDUNG_URL  = "./dudung.png";
const USER_PUMPKIN_URL = "./pumpkin.png";
const USER_GHOST_URL   = "./ghost.png";

const CANVAS_W = 390;
const CANVAS_H = 844;
const GAME_MS = 15_000;

const GHOST_SPAWN_MS = 400;
const PUMPKIN_SPAWN_MS = 600;
const GHOST_SPEED = 0.8;
const PUMPKIN_SPEED = GHOST_SPEED * 0.6;
const ENTITY_RADIUS = 26;
const HIT_RADIUS = 34;
const DUDUNG_RADIUS = 60;

const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));
const dist = (x1,y1,x2,y2)=>Math.hypot(x1-x2,y1-y2);
const makeDataUrl = (svg)=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function randSpawnEdge(){
  const edge = Math.floor(Math.random()*4);
  const m = 30;
  switch(edge){
    case 0: return { x: Math.random()*CANVAS_W, y: -m };
    case 1: return { x: CANVAS_W + m, y: Math.random()*CANVAS_H };
    case 2: return { x: Math.random()*CANVAS_W, y: CANVAS_H + m };
    default: return { x: -m, y: Math.random()*CANVAS_H };
  }
}
function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload=()=>resolve(img); img.onerror=()=>reject(new Error('이미지 로드 실패')); img.src=src;
  });
}
function roundRect(ctx, x, y, w, h, r=10){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

const DEF_SPLASH = makeDataUrl(`
<svg xmlns='http://www.w3.org/2000/svg' width='390' height='844' viewBox='0 0 390 844'>
  <defs>
    <linearGradient id='bg' x1='0' x2='0' y1='0' y2='1'>
      <stop offset='0%' stop-color='#101a2e'/>
      <stop offset='100%' stop-color='#122034'/>
    </linearGradient>
  </defs>
  <rect width='390' height='844' fill='url(#bg)'/>
</svg>`);
const DEF_DUDUNG = makeDataUrl(`
<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>
  <defs><radialGradient id='g' cx='40%' cy='40%' r='60%'>
    <stop offset='0%' stop-color='#9BF08E'/><stop offset='100%' stop-color='#3CB371'/>
  </radialGradient></defs>
  <circle cx='60' cy='60' r='50' fill='url(#g)'/>
  <circle cx='48' cy='46' r='8' fill='white' fill-opacity='0.6'/>
</svg>`);
const DEF_PUMPKIN = makeDataUrl(`
<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'>
  <circle cx='28' cy='30' r='20' fill='#f59e0b'/>
  <rect x='25' y='8' width='6' height='10' rx='2' fill='#065f46'/>
  <path d='M20 30c3 2 6 2 8 0 2 2 5 2 8 0' stroke='#92400e' stroke-width='3' fill='none'/>
</svg>`);

export default function GhostCatch(){
  const canvasRef = useRef(null);

  // 화면/스코어/타임
  const [screen, setScreen] = useState('splash'); // 'splash' | 'playing' | 'ended'
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_MS);

  // 최신값 ref
  const screenRef = useRef('splash');
  const scoreRef = useRef(0);
  const timeLeftRef = useRef(GAME_MS);
  useEffect(() => { screenRef.current = screen; draw(); }, [screen]);

  // 이미지
  const splashImgRef = useRef(null);
  const dudungImgRef = useRef(null);
  const pumpkinImgRef = useRef(null);
  const ghostImgRef = useRef(null);

  // 런타임
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const lastGhostRef = useRef(0);
  const lastPumpkinRef = useRef(0);
  const entitiesRef = useRef([]);

  // 버튼 히트영역
  const splashBtnRectRef = useRef({x:0,y:0,w:0,h:0});
  const endRetryRectRef = useRef({x:0,y:0,w:0,h:0});
  const endSaveRectRef  = useRef({x:0,y:0,w:0,h:0});

  // 캔버스 픽셀 고정
  useEffect(()=>{
    const c = canvasRef.current; if(!c) return;
    c.style.width = CANVAS_W+"px"; c.style.height = CANVAS_H+"px";
    c.width = CANVAS_W; c.height = CANVAS_H;
  },[]);

  // 이미지 로드
  useEffect(()=>{ (async()=>{
    try{ splashImgRef.current  = await loadImage(USER_SPLASH_URL  || DEF_SPLASH); }catch{ splashImgRef.current=null; }
    try{ dudungImgRef.current  = await loadImage(USER_DUDUNG_URL  || DEF_DUDUNG); }catch{ dudungImgRef.current=null; }
    try{ pumpkinImgRef.current = await loadImage(USER_PUMPKIN_URL || DEF_PUMPKIN); }catch{ pumpkinImgRef.current=null; }
    try{ ghostImgRef.current   = USER_GHOST_URL ? await loadImage(USER_GHOST_URL) : null; }catch{ ghostImgRef.current=null; }
    draw();
  })(); },[]);

  // 입력
  useEffect(()=>{
    const c = canvasRef.current; if(!c) return;
    const onDown = (e)=>{
      const rect = c.getBoundingClientRect();
      const scaleX = c.width  / rect.width;
      const scaleY = c.height / rect.height;
      const x = clamp((e.clientX - rect.left) * scaleX, 0, c.width);
      const y = clamp((e.clientY - rect.top)  * scaleY, 0, c.height);

      if (screenRef.current==='splash'){
        const r = splashBtnRectRef.current;
        const inButton = (x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h);
        if (inButton){
          setScore(0); setTimeLeft(GAME_MS); entitiesRef.current = [];
          const t0 = performance.now();
          startRef.current = t0; lastGhostRef.current = t0; lastPumpkinRef.current = t0;
          scoreRef.current = 0; timeLeftRef.current = GAME_MS;
          screenRef.current='playing'; setScreen('playing'); draw();
        }
        return;
      }

      if (screenRef.current==='playing'){
        for (let i=entitiesRef.current.length-1; i>=0; i--){
          const en = entitiesRef.current[i];
          if (dist(x,y,en.x,en.y) <= HIT_RADIUS){
            if (en.kind==='ghost') { scoreRef.current += 1; setScore(s=>s+1); }
            else { scoreRef.current -= 3; setScore(s=>s-3); }
            entitiesRef.current.splice(i,1);
            draw();
            break;
          }
        }
        return;
      }

      if (screenRef.current==='ended'){
        const r1 = endRetryRectRef.current; const r2 = endSaveRectRef.current;
        if (x>=r1.x && x<=r1.x+r1.w && y>=r1.y && y<=r1.y+r1.h){ restart(); return; }
        if (x>=r2.x && x<=r2.x+r2.w && y>=r2.y && y<=r2.y+r2.h){ saveImage(); return; }
      }
    };
    c.addEventListener('pointerdown', onDown);
    return ()=> c.removeEventListener('pointerdown', onDown);
  }, []);

  function drawGhostVector(ctx){
    const bodyW=30, bodyH=38;
    const gg=ctx.createLinearGradient(0,-bodyH,0,bodyH);
    gg.addColorStop(0,'#ffffff'); gg.addColorStop(1,'#dbe3ee');
    ctx.fillStyle=gg; ctx.beginPath(); ctx.moveTo(0,-bodyH);
    ctx.quadraticCurveTo(bodyW/2,-bodyH/2, bodyW/2,0); ctx.lineTo(bodyW/2,bodyH);
    for(let i=-2;i<=2;i++) ctx.quadraticCurveTo(i*6,bodyH+6,(i+1)*6,bodyH);
    ctx.lineTo(-bodyW/2,0); ctx.quadraticCurveTo(-bodyW/2,-bodyH/2,0,-bodyH); ctx.fill();
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(-7,-14,3,0,Math.PI*2); ctx.arc(7,-14,3,0,Math.PI*2); ctx.fill();
  }

  const draw = ()=>{
    const c = canvasRef.current; if(!c) return; const ctx = c.getContext('2d'); if(!ctx) return;
    ctx.clearRect(0,0,c.width,c.height);

    const splash = splashImgRef.current;
    if (splash) ctx.drawImage(splash, 0,0, c.width,c.height); else {
      const g = ctx.createLinearGradient(0,0,0,c.height); g.addColorStop(0,'#0b1220'); g.addColorStop(1,'#0e1626');
      ctx.fillStyle = g; ctx.fillRect(0,0,c.width,c.height);
    }

    const dud = dudungImgRef.current; const cx = c.width/2, cy = c.height/2;
    if (dud) ctx.drawImage(dud, cx-60, cy-60, 120, 120);

    entitiesRef.current.forEach(en=>{
      ctx.save(); ctx.translate(en.x, en.y);
      if (en.kind==='ghost'){
        if (ghostImgRef.current){
          const img = ghostImgRef.current; const iw = img.naturalWidth || img.width; const ih = img.naturalHeight || img.height;
          const maxW = 56, maxH = 68, PAD = 0.9; const s = Math.min(maxW/iw, maxH/ih) * PAD;
          const dw = Math.max(1, Math.floor(iw*s)); const dh = Math.max(1, Math.floor(ih*s));
          ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
        } else {
          drawGhostVector(ctx);
        }
      } else {
        const img = pumpkinImgRef.current; if (img) ctx.drawImage(img, -28,-28,56,56); else {
          ctx.fillStyle='#f59e0b'; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#065f46'; ctx.fillRect(-3,-22,6,12);
        }
      }
      ctx.restore();
    });

    if (screenRef.current==='playing'){
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.font = 'bold 18px ui-sans-serif, system-ui';
      const hudSec = Math.ceil(timeLeftRef.current/1000);
      ctx.strokeText(`TIME  ${hudSec}s`, 16, 32);
      ctx.fillText(`TIME  ${hudSec}s`, 16, 32);
      ctx.strokeText(`SCORE ${scoreRef.current}`, 16, 56);
      ctx.fillText(`SCORE ${scoreRef.current}`, 16, 56);
    }

    if (screenRef.current==='splash'){
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.38)'; ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle='#e2e8f0'; ctx.font='bold 24px ui-sans-serif, system-ui'; ctx.textAlign='center';
      ctx.fillText('유령한테서 두둥이를 지켜줘!', cx, cy-200);
      ctx.font='15px ui-sans-serif, system-ui'; ctx.fillStyle='rgba(226,232,240,0.9)';
      ctx.fillText('15초 동안 유령을 잡고, 호박은 피하세요', cx, cy-170);
      const bw = 240, bh = 52; const bx = cx - bw/2; const by = CANVAS_H - 110;
      ctx.fillStyle = '#111827'; roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
      ctx.fillStyle = '#f9fafb'; ctx.font='bold 18px ui-sans-serif, system-ui'; ctx.fillText('게임 시작', cx, by + bh/2 + 6);
      splashBtnRectRef.current = { x: bx, y: by, w: bw, h: bh };
      ctx.restore();
    }

    if (screenRef.current==='ended'){
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.font='bold 28px ui-sans-serif, system-ui';
      ctx.fillText(`SCORE: ${scoreRef.current}`, cx, cy-10);
      const gap = 16; const bw = 140, bh = 46; const totalW = bw*2 + gap; const bx0 = cx - totalW/2; const by = cy + 24;
      ctx.fillStyle = '#111827'; roundRect(ctx, bx0, by, bw, bh, 10); ctx.fill();
      ctx.fillStyle = '#f9fafb'; ctx.font='bold 16px ui-sans-serif, system-ui'; ctx.fillText('다시하기', bx0 + bw/2, by + bh/2 + 5);
      endRetryRectRef.current = { x: bx0, y: by, w: bw, h: bh };
      const bx1 = bx0 + bw + gap;
      ctx.fillStyle = '#e5e7eb'; roundRect(ctx, bx1, by, bw, bh, 10); ctx.fill();
      ctx.fillStyle = '#111827'; ctx.font='bold 16px ui-sans-serif, system-ui'; ctx.fillText('이미지 저장', bx1 + bw/2, by + bh/2 + 5);
      endSaveRectRef.current = { x: bx1, y: by, w: bw, h: bh };
      ctx.restore();
    }
  };

  const loop = () => {
    if (screenRef.current !== 'playing') return;

    const now = performance.now();
    const elapsed = now - startRef.current;
    const remain = Math.max(0, GAME_MS - elapsed);
    timeLeftRef.current = remain;
    setTimeLeft(remain);

    const t = elapsed / GAME_MS;
    const ghostInterval = Math.max(260, GHOST_SPAWN_MS - 300*t);
    const pumpkinInterval = Math.max(900, PUMPKIN_SPAWN_MS - 200*t);

    if (now - lastGhostRef.current >= ghostInterval){
      lastGhostRef.current = now; const p = randSpawnEdge();
      const angle = Math.atan2(CANVAS_H/2 - p.y, CANVAS_W/2 - p.x);
      entitiesRef.current.push({ kind:'ghost', x:p.x, y:p.y, vx:Math.cos(angle)*GHOST_SPEED, vy:Math.sin(angle)*GHOST_SPEED, born: now });
    }
    if (now - lastPumpkinRef.current >= pumpkinInterval){
      lastPumpkinRef.current = now; const p = randSpawnEdge();
      const angle = Math.atan2(CANVAS_H/2 - p.y, CANVAS_W/2 - p.x);
      entitiesRef.current.push({ kind:'pumpkin', x:p.x, y:p.y, vx:Math.cos(angle)*PUMPKIN_SPEED, vy:Math.sin(angle)*PUMPKIN_SPEED, born: now });
    }

    const cx = CANVAS_W/2, cy = CANVAS_H/2;
    const next = [];
    for (const en of entitiesRef.current){
      en.x += en.vx; en.y += en.vy;

      if (en.kind==='ghost' && dist(en.x,en.y,cx,cy) <= DUDUNG_RADIUS){
        screenRef.current = 'ended';
        setScreen('ended');
        draw();
        return;
      }
      if (dist(en.x,en.y,cx,cy) < ENTITY_RADIUS + 20) continue;
      next.push(en);
    }
    entitiesRef.current = next;

    draw();

    if (remain <= 0){
      screenRef.current = 'ended';
      setScreen('ended');
      return;
    }
  };

  useEffect(() => {
    if (screenRef.current === 'playing') {
      startRef.current = performance.now();
      lastGhostRef.current = startRef.current;
      lastPumpkinRef.current = startRef.current;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const tick = () => {
        if (screenRef.current !== 'playing') return;
        loop();
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    }
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [screen]);

  const saveImage = ()=>{
    const c = canvasRef.current; if(!c) return;
    try{
      const url = c.toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = `dudung_score_${scoreRef.current}.png`; a.click();
    }catch{ alert('이미지 저장이 차단되었어요.'); }
  };

  const restart = ()=>{
    screenRef.current='splash';
    scoreRef.current = 0;
    timeLeftRef.current = GAME_MS;
    setScreen('splash'); setScore(0); setTimeLeft(GAME_MS); entitiesRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    draw();
  };

  // ✅ Responsive Fit (contain) — 단일 이펙트
  useEffect(() => {
    const inner = document.getElementById("game-inner");
    if (!inner) return;

    inner.style.transformOrigin = "0 0";

    const getViewport = () => {
      const vv = window.visualViewport;
      return { vw: vv?.width ?? window.innerWidth, vh: vv?.height ?? window.innerHeight };
    };

    const readEnv = (name) => {
      try {
        // 일부 브라우저는 env 값이 공백일 수 있음
        const v = getComputedStyle(document.documentElement).getPropertyValue(`env(${name})`) || "0";
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      } catch { return 0; }
    };

    const fit = () => {
      const { vw, vh } = getViewport();

      // CSS.supports 체크 (있을 때만 env 사용 시도)
      let safeTop = 0, safeBottom = 0;
      if (window.CSS && typeof window.CSS.supports === "function") {
        if (CSS.supports("top: env(safe-area-inset-top)")) safeTop = readEnv("safe-area-inset-top");
        if (CSS.supports("bottom: env(safe-area-inset-bottom)")) safeBottom = readEnv("safe-area-inset-bottom");
      }

      const usableH = vh - safeTop - safeBottom;
      const scale = Math.min(vw / CANVAS_W, usableH / CANVAS_H);

      const dx = Math.round((vw - CANVAS_W * scale) / 2);
      const dy = Math.round((usableH - CANVAS_H * scale) / 2 + safeTop);

      inner.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    };

    fit();

    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", onResize);
      vv.addEventListener("scroll", onResize);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (vv) {
        vv.removeEventListener("resize", onResize);
        vv.removeEventListener("scroll", onResize);
      }
    };
  }, []);

  // === JSX 출력 (컨테이너 + #game-inner 추가) ===
  return (
    <div
      id="game-root"
      style={{
        position: "fixed",
        inset: 0,
        background: "#0b1220",
        overflow: "hidden",
        touchAction: "none"
      }}
    >
      <div
        id="game-inner"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "absolute",
          left: 0,
          top: 0,
          willChange: "transform"
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
