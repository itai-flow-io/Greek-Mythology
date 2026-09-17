
const byId = Object.fromEntries(DATA.map(d=>[d.id,d]));

function childrenOf(id){
  return DATA.filter(d => d.parents && d.parents.includes(id));
}

// Extract one memorable keyword/signature phrase for a character (ADHD-friendly memory hook)
function getSignature(d){
  // Use epithet if it's short enough (5 chars or less)
  if(d.epithet && d.epithet.length <= 6) return d.epithet;
  // Otherwise extract first meaningful phrase from story (before the first comma or period)
  const firstClause = d.story.split(/[，。]/)[0];
  if(firstClause && firstClause.length <= 10) return firstClause.replace(/^(祂|他|她|它)是/, '');
  // Fallback: truncate epithet
  return d.epithet ? d.epithet.slice(0, 5) + (d.epithet.length > 5 ? '…' : '') : '';
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 音效系統 (Sound System)
 * Lines: ~19-500
 *
 * 使用 Web Audio API 合成所有音效，無需外部音頻文件
 *
 * 主要函數：
 *   - getAudioCtx()        取得/創建音頻上下文
 *   - playTone()           播放單一音調
 *   - playSelectSound()    選擇節點時播放（按流派變化音高）
 *   - playUnlockChime()    首次解鎖節點
 *   - playEggChime()       發現彩蛋/名言
 *   - playEthereal*()      空靈系列音效（Whisper/Shimmer/Chime）
 *   - checkScaleEasterEgg() 音階彩蛋：依序點擊所有流派觸發隱藏和弦
 *
 * 依賴：GEN_NOTES（流派音高對照表）
 * 相關：companion.js §影子系統（觸發 triggerShadowGlow）
 * ═══════════════════════════════════════════════════════════════════════════════ */
const SOUND_KEY = 'greekMythTree_sound_v1';
let soundOn = true;
try{
  const s = localStorage.getItem(SOUND_KEY);
  if(s !== null) soundOn = s === 'on';
}catch(e){ /* ignore */ }

let audioCtx = null;
function getAudioCtx(){
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return null;
  if(!audioCtx) audioCtx = new AC();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, type, peak, delay){
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;
  const t0 = ctx.currentTime + (delay||0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak||0.12, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration||0.4));
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + (duration||0.4) + 0.05);
}

const GEN_NOTES = {
  // A小調 - 擴展音域避免半音撞音，確保12個分支各有獨特音高
  primordial:220.00,   // A3
  titan:261.63,        // C4 (跳過B，避免與C撞)
  olympian:293.66,     // D4
  hero:349.23,         // F4 (跳過E，避免與F撞)
  nature:392.00,       // G4
  zodiac:466.16,       // Bb4 (避開B4-C5撞音)
  troy:523.25,         // C5
  mythconcepts:587.33, // D5
  philosophy:659.25,   // E5
  modernphil:739.99,   // F#5 (避開F5-G5撞音)
  psychology:880.00,   // A5
  arts:987.77,         // B5
  crosscultural:1174.66 // D6
};

function playSelectSound(gen){
  // 空靈版本 - 正弦波 + 泛音 + 緩慢衰減
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;
  const base = GEN_NOTES[gen] || 392;
  const t0 = ctx.currentTime;

  // 主音
  const main = ctx.createOscillator();
  const mainGain = ctx.createGain();
  main.type = 'sine';
  main.frequency.value = base;
  mainGain.gain.setValueAtTime(0, t0);
  mainGain.gain.linearRampToValueAtTime(0.08, t0 + 0.12);
  mainGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
  main.connect(mainGain).connect(ctx.destination);
  main.start(t0);
  main.stop(t0 + 1.8);

  // 泛音
  const harm = ctx.createOscillator();
  const harmGain = ctx.createGain();
  harm.type = 'sine';
  harm.frequency.value = base * 2.5;
  harmGain.gain.setValueAtTime(0, t0);
  harmGain.gain.linearRampToValueAtTime(0.02, t0 + 0.15);
  harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
  harm.connect(harmGain).connect(ctx.destination);
  harm.start(t0);
  harm.stop(t0 + 1.2);
}

/* ---------- Sound easter egg: click through every tier in ascending pitch order to play a hidden scale ---------- */
const SCALE_ORDER = Object.keys(GEN_NOTES); // already ascending pitch order: primordial → ... → crosscultural
let scaleProgress = -1;

function checkScaleEasterEgg(gen){
  const idx = SCALE_ORDER.indexOf(gen);
  if(idx === -1) return;
  if(idx === scaleProgress) return; // repeat click within the current tier — harmless, no change
  if(idx === scaleProgress + 1){
    scaleProgress = idx;
  } else if(idx === 0){
    scaleProgress = 0; // restart the sequence from the first tier
  } else {
    scaleProgress = -1; // wrong tier — broken sequence
    return;
  }
  if(scaleProgress === SCALE_ORDER.length - 1){
    setTimeout(playScaleCompleteFanfare, 350);
    scaleProgress = -1;
  }
}

function playScaleCompleteFanfare(){
  // 空靈版本 - 音階上行 + 和弦尾音
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;
  const t0 = ctx.currentTime;
  const scaleNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

  scaleNotes.forEach((freq, i) => {
    // 主音
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.value = freq;
    mainGain.gain.setValueAtTime(0, t0 + i * 0.18);
    mainGain.gain.linearRampToValueAtTime(0.06, t0 + i * 0.18 + 0.1);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.18 + 2.0);
    main.connect(mainGain).connect(ctx.destination);
    main.start(t0 + i * 0.18);
    main.stop(t0 + i * 0.18 + 2.2);

    // 泛音
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'sine';
    harm.frequency.value = freq * 2.5;
    harmGain.gain.setValueAtTime(0, t0 + i * 0.18);
    harmGain.gain.linearRampToValueAtTime(0.015, t0 + i * 0.18 + 0.15);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.18 + 1.2);
    harm.connect(harmGain).connect(ctx.destination);
    harm.start(t0 + i * 0.18);
    harm.stop(t0 + i * 0.18 + 1.5);
  });

  // 和弦尾音
  const chordDelay = scaleNotes.length * 0.18 + 0.2;
  [1046.50, 1318.51, 1568.00].forEach(freq => {
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.value = freq;
    mainGain.gain.setValueAtTime(0, t0 + chordDelay);
    mainGain.gain.linearRampToValueAtTime(0.05, t0 + chordDelay + 0.1);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t0 + chordDelay + 3.0);
    main.connect(mainGain).connect(ctx.destination);
    main.start(t0 + chordDelay);
    main.stop(t0 + chordDelay + 3.2);

    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'sine';
    harm.frequency.value = freq * 2;
    harmGain.gain.setValueAtTime(0, t0 + chordDelay);
    harmGain.gain.linearRampToValueAtTime(0.012, t0 + chordDelay + 0.2);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + chordDelay + 1.8);
    harm.connect(harmGain).connect(ctx.destination);
    harm.start(t0 + chordDelay);
    harm.stop(t0 + chordDelay + 2.0);
  });

  setTimeout(() => {
    showMilestoneToast({text:'你彈奏了一段完整的音階——從創世的低音，到跨文化連結的最高音。', author:'🎵 音效彩蛋'});
  }, chordDelay * 1000 + 500);
}

function playUnlockChime(){
  // 空靈版本 - 頌钵風格三和絃
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;
  const t0 = ctx.currentTime;
  const notes = [392, 523.25, 659.25]; // G4, C5, E5

  notes.forEach((freq, i) => {
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.value = freq;
    mainGain.gain.setValueAtTime(0, t0 + i * 0.12);
    mainGain.gain.linearRampToValueAtTime(0.07, t0 + i * 0.12 + 0.15);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.12 + 2.5);
    main.connect(mainGain).connect(ctx.destination);
    main.start(t0 + i * 0.12);
    main.stop(t0 + i * 0.12 + 2.8);

    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'sine';
    harm.frequency.value = freq * 3;
    harmGain.gain.setValueAtTime(0, t0 + i * 0.12);
    harmGain.gain.linearRampToValueAtTime(0.018, t0 + i * 0.12 + 0.2);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.12 + 1.5);
    harm.connect(harmGain).connect(ctx.destination);
    harm.start(t0 + i * 0.12);
    harm.stop(t0 + i * 0.12 + 2.0);
  });
}

function playEggChime(){
  // 空靈版本 - 輕盈上行旋律（用於彩蛋發現）
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;
  const t0 = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];

  notes.forEach((freq, i) => {
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.value = freq;
    mainGain.gain.setValueAtTime(0, t0 + i * 0.15);
    mainGain.gain.linearRampToValueAtTime(0.06, t0 + i * 0.15 + 0.1);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.15 + 1.5);
    main.connect(mainGain).connect(ctx.destination);
    main.start(t0 + i * 0.15);
    main.stop(t0 + i * 0.15 + 1.8);

    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'sine';
    harm.frequency.value = freq * 2.5;
    harmGain.gain.setValueAtTime(0, t0 + i * 0.15);
    harmGain.gain.linearRampToValueAtTime(0.015, t0 + i * 0.15 + 0.15);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.15 + 0.9);
    harm.connect(harmGain).connect(ctx.destination);
    harm.start(t0 + i * 0.15);
    harm.stop(t0 + i * 0.15 + 1.2);
  });
}

function playToastSound(){
  // Toast 專用 - 低沉柔和的提示音（不搶戲）
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;
  const t0 = ctx.currentTime;
  const notes = [392, 493.88, 587.33]; // G4, B4, D5 - 下行終止

  notes.forEach((freq, i) => {
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.value = freq;
    mainGain.gain.setValueAtTime(0, t0 + i * 0.18);
    mainGain.gain.linearRampToValueAtTime(0.04, t0 + i * 0.18 + 0.08);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.18 + 1.8);
    main.connect(mainGain).connect(ctx.destination);
    main.start(t0 + i * 0.18);
    main.stop(t0 + i * 0.18 + 2.0);

    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'sine';
    harm.frequency.value = freq * 2;
    harmGain.gain.setValueAtTime(0, t0 + i * 0.18);
    harmGain.gain.linearRampToValueAtTime(0.008, t0 + i * 0.18 + 0.12);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.18 + 1.0);
    harm.connect(harmGain).connect(ctx.destination);
    harm.start(t0 + i * 0.18);
    harm.stop(t0 + i * 0.18 + 1.2);
  });
}

/* ---------- Ethereal Sound Demo (空灵音效) ---------- */
function playEtherealSingle(freq = 523.25, duration = 2.0) {
  // 單一空靈音 - 正弦波 + 泛音 + 緩慢衰減
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;

  const t0 = ctx.currentTime;

  // 主音
  const main = ctx.createOscillator();
  const mainGain = ctx.createGain();
  main.type = 'sine';
  main.frequency.value = freq;
  mainGain.gain.setValueAtTime(0, t0);
  mainGain.gain.linearRampToValueAtTime(0.07, t0 + 0.15);
  mainGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  main.connect(mainGain).connect(ctx.destination);
  main.start(t0);
  main.stop(t0 + duration);

  // 泛音 (shimmer)
  const harm = ctx.createOscillator();
  const harmGain = ctx.createGain();
  harm.type = 'sine';
  harm.frequency.value = freq * 2.5;
  harmGain.gain.setValueAtTime(0, t0);
  harmGain.gain.linearRampToValueAtTime(0.025, t0 + 0.2);
  harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration * 0.6);
  harm.connect(harmGain).connect(ctx.destination);
  harm.start(t0);
  harm.stop(t0 + duration);

  // 高頻泛音 (air)
  const air = ctx.createOscillator();
  const airGain = ctx.createGain();
  air.type = 'sine';
  air.frequency.value = freq * 4;
  airGain.gain.setValueAtTime(0, t0);
  airGain.gain.linearRampToValueAtTime(0.008, t0 + 0.3);
  airGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration * 0.4);
  air.connect(airGain).connect(ctx.destination);
  air.start(t0);
  air.stop(t0 + duration);
}

function playEtherealChime() {
  // 空靈鐘聲 - 頌钵風格
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;

  const t0 = ctx.currentTime;
  const notes = [392, 523.25, 659.25]; // G4, C5, E5 - 和弦

  notes.forEach((freq, i) => {
    // 主音
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.value = freq;
    mainGain.gain.setValueAtTime(0, t0 + i * 0.08);
    mainGain.gain.linearRampToValueAtTime(0.06, t0 + i * 0.08 + 0.1);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.08 + 2.0);
    main.connect(mainGain).connect(ctx.destination);
    main.start(t0 + i * 0.08);
    main.stop(t0 + i * 0.08 + 2.0);

    // 泛音
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'sine';
    harm.frequency.value = freq * 3;
    harmGain.gain.setValueAtTime(0, t0 + i * 0.08);
    harmGain.gain.linearRampToValueAtTime(0.015, t0 + i * 0.08 + 0.15);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.08 + 1.2);
    harm.connect(harmGain).connect(ctx.destination);
    harm.start(t0 + i * 0.08);
    harm.stop(t0 + i * 0.08 + 1.5);
  });
}

function playEtherealWhisper() {
  // 空靈低語 - 記憶模糊觸發時
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;

  const t0 = ctx.currentTime;
  const freq = 261.63; // C4 低沉

  // 低頻 drone
  const drone = ctx.createOscillator();
  const droneGain = ctx.createGain();
  drone.type = 'sine';
  drone.frequency.value = freq;
  droneGain.gain.setValueAtTime(0, t0);
  droneGain.gain.linearRampToValueAtTime(0.04, t0 + 0.5);
  droneGain.gain.linearRampToValueAtTime(0.02, t0 + 1.5);
  droneGain.gain.exponentialRampToValueAtTime(0.001, t0 + 2.5);
  drone.connect(droneGain).connect(ctx.destination);
  drone.start(t0);
  drone.stop(t0 + 2.5);

  // 上方泛音
  const harm = ctx.createOscillator();
  const harmGain = ctx.createGain();
  harm.type = 'sine';
  harm.frequency.value = freq * 2;
  harmGain.gain.setValueAtTime(0, t0);
  harmGain.gain.linearRampToValueAtTime(0.015, t0 + 0.8);
  harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + 2.0);
  harm.connect(harmGain).connect(ctx.destination);
  harm.start(t0);
  harm.stop(t0 + 2.0);
}

function playEtherealShimmer() {
  // 空靈閃爍 - 輕盈上行
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;

  const t0 = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0 + i * 0.15);
    gain.gain.linearRampToValueAtTime(0.05, t0 + i * 0.15 + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.15 + 1.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + i * 0.15);
    osc.stop(t0 + i * 0.15 + 2.0);

    // Shimmer 泛音
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = freq * 3;
    shimmerGain.gain.setValueAtTime(0, t0 + i * 0.15);
    shimmerGain.gain.linearRampToValueAtTime(0.012, t0 + i * 0.15 + 0.2);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.15 + 1.2);
    shimmer.connect(shimmerGain).connect(ctx.destination);
    shimmer.start(t0 + i * 0.15);
    shimmer.stop(t0 + i * 0.15 + 1.5);
  });
}

// 調試面板測試空靈音效
function testEtherealSound(type) {
  switch(type) {
    case 'single': playEtherealSingle(523.25, 2.0); break;
    case 'chime': playEtherealChime(); break;
    case 'whisper': playEtherealWhisper(); break;
    case 'shimmer': playEtherealShimmer(); break;
  }
}

function playPageSound(direction){
  // 空靈版本 - 柔和滑音 + 泛音
  if(!soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;
  const t0 = ctx.currentTime;
  const startFreq = direction === 'next' ? 440 : 587.33;
  const endFreq = direction === 'next' ? 587.33 : 440;

  // 主音
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, t0);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + 0.35);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.04, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.7);

  // 泛音
  const harm = ctx.createOscillator();
  const harmGain = ctx.createGain();
  harm.type = 'sine';
  harm.frequency.setValueAtTime(startFreq * 2, t0);
  harm.frequency.exponentialRampToValueAtTime(endFreq * 2, t0 + 0.35);
  harmGain.gain.setValueAtTime(0, t0);
  harmGain.gain.linearRampToValueAtTime(0.01, t0 + 0.08);
  harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
  harm.connect(harmGain);
  harmGain.connect(ctx.destination);
  harm.start(t0);
  harm.stop(t0 + 0.5);
}

function toggleSound(){
  soundOn = !soundOn;
  try{ localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); }catch(e){}
  const btn = document.getElementById('soundToggle');
  if(btn){
    btn.textContent = soundOn ? '🔊' : '🔇';
    btn.classList.toggle('muted', !soundOn);
  }
  if(soundOn) getAudioCtx();
}

// Combined sound + scroll button
let soundClickTimer = null;
function handleSoundClick(e){
  if(soundClickTimer){
    clearTimeout(soundClickTimer);
    soundClickTimer = null;
    window.scrollTo({top:0, behavior:'smooth'});
  } else {
    soundClickTimer = setTimeout(()=>{
      toggleSound();
      soundClickTimer = null;
    }, 250);
  }
}

const STORAGE_KEY = 'greekMythTree_visited_v1';
let visited = new Set();
try{
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) visited = new Set(JSON.parse(raw));
}catch(e){ /* localStorage unavailable — progress just won't persist */ }

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 影子系統 (Companion Shadow)
 * Lines: ~525-1050
 *
 * 探索 3 個角色後出現的神秘存在，會根據用戶的哲學選擇逐漸進化
 *
 * 主要函數：
 *   - updateCompanion()      更新影子狀態（探索進化）
 *   - renderCompanionShadow() 渲染影子外觀（清晰度、顏色、姿態）
 *   - recordPhiloChoice()    記錄哲學選擇
 *   - calculatePhiloTendency() 計算主導哲學傾向
 *   - triggerShadowGlow()    觸發共鳴發光
 *   - triggerTendencyShiftAnimation() 傾向變化動畫
 *
 * 數據結構：companionData（存於 localStorage）
 *   - visited: Set           已探索節點
 *   - philoChoices: Object   哲學選擇計數
 *   - philoTendency: String  主導傾向
 *   - philoScore: Number     選擇次數
 *
 * 相關：philo.js §哲學測驗（記錄選擇）
 *       mindmap.js §意識地圖（使用相似數據結構）
 * ═══════════════════════════════════════════════════════════════════════════════ */
const COMPANION_KEY = 'greekMythTree_companion_v1';

// 哲學家分類：用於 Companion Shadow 進化
const PHILOSOPHER_TRAITS = {
  // 理性主義
  socrates: 'rationalism', plato: 'rationalism', aristotle: 'rationalism', wittgenstein: 'rationalism',
  republic: 'rationalism', symposium: 'rationalism', themis: 'rationalism',
  // 存在主義
  nietzsche: 'existentialism', sartre: 'existentialism', camus: 'existentialism', schopenhauer: 'existentialism',
  kierkegaard: 'existentialism', beauvoir: 'existentialism',
  // 東方哲學
  laozi: 'eastern', zhuangzi: 'eastern', confucius: 'eastern', buddha: 'eastern', wangyangming: 'eastern',
  // 效益主義
  singer: 'utilitarianism',
  // 義務論
  kant: 'deontology',
  // 斯多葛主義
  stoicism: 'stoicism', seneca: 'stoicism', marcusaurelius: 'stoicism',
  // 懷疑論
  skepticism: 'skepticism',
  // 佛教
  anscombe: 'buddhism',
  // 儒家
  nussbaum: 'confucianism',
  // 伊比鳩魯
  epicureanism: 'epicureanism',
  // 其他
  sophism: 'pragmatism', diogenes: 'pragmatism', arendt: 'pragmatism', rawls: 'utilitarianism'
};

// 傾向色彩
const TENDENCY_COLORS = {
  rationalism: 'rgba(180, 160, 220, 0.35)',
  existentialism: 'rgba(220, 100, 100, 0.35)',
  eastern: 'rgba(160, 200, 140, 0.30)',
  utilitarianism: 'rgba(220, 190, 100, 0.35)',
  deontology: 'rgba(140, 170, 210, 0.35)',
  stoicism: 'rgba(190, 190, 190, 0.28)',
  skepticism: 'rgba(170, 170, 195, 0.22)',
  confucianism: 'rgba(200, 170, 130, 0.33)',
  buddhism: 'rgba(210, 190, 150, 0.30)',
  epicureanism: 'rgba(200, 180, 140, 0.32)',
  pragmatism: 'rgba(180, 180, 200, 0.30)',
  unknown: 'rgba(200, 195, 220, 0.25)'
};

// 傾向姿態
const TENDENCY_POSES = {
  rationalism: 'translateX(-2px) translateY(-3px) rotate(1deg)',
  existentialism: 'translateX(3px) translateY(1px) rotate(-1.5deg)',
  eastern: 'translateX(0) translateY(-1px) rotate(0deg)',
  utilitarianism: 'translateX(-1px) translateY(-2px) rotate(0.5deg)',
  deontology: 'translateX(0) translateY(-2px) rotate(0.5deg)',
  stoicism: 'translateX(0) translateY(0) rotate(0deg)',
  skepticism: 'translateX(-1px) translateY(-1px) rotate(-0.5deg)',
  confucianism: 'translateX(0) translateY(-1px) rotate(0deg)',
  buddhism: 'translateX(0) translateY(1px) rotate(0deg)',
  epicureanism: 'translateX(1px) translateY(0) rotate(-0.5deg)',
  pragmatism: 'translateX(0) translateY(-1px) rotate(0.5deg)',
  unknown: ''
};

let companionData = {
  visited: new Set(),
  genDistribution: {},
  philoChoices: {},      // 記錄每次選擇
  philoTendency: 'unknown',
  philoScore: 0,
  letters: []            // 寫給影子的信
};

try{
  const raw = localStorage.getItem(COMPANION_KEY);
  if(raw){
    const parsed = JSON.parse(raw);
    companionData.visited = new Set(parsed.visited || []);
    companionData.genDistribution = parsed.genDistribution || {};
    companionData.philoChoices = parsed.philoChoices || {};
    companionData.philoTendency = parsed.philoTendency || 'unknown';
    companionData.philoScore = parsed.philoScore || 0;
    companionData.letters = parsed.letters || [];
  }
}catch(e){}

function getCompanionPhase(){
  const count = companionData.visited.size;
  if(count >= 40) return 5;
  if(count >= 25) return 4;
  if(count >= 12) return 3;
  if(count >= 5) return 2;
  if(count >= 3) return 1;
  return 0;
}

function updateCompanion(id){
  const d = byId[id];
  if(!companionData.visited.has(id)){
    companionData.visited.add(id);
    companionData.genDistribution[d.gen] = (companionData.genDistribution[d.gen] || 0) + 1;
  }

  // 保存所有數據（包括哲學選擇）
  saveCompanionData();

  renderCompanionShadow();
}

function renderCompanionShadow(){
  const shadow = document.getElementById('companionShadow');
  if(!shadow) return;

  const phase = getCompanionPhase();

  // 如果沒有探索記錄但有哲學進化數據，仍然顯示 shadow
  if(phase === 0 && companionData.philoScore === 0){
    shadow.classList.remove('present', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5');
    return;
  }

  // 使用探索階段或默認階段
  const displayPhase = phase > 0 ? phase : 1;
  shadow.classList.add('present', 'phase-' + displayPhase);

  // 應用探索傾向姿勢
  const dominant = getDominantGen();
  const genPoses = {
    olympian: 'translateY(-2px)',
    philosophy: 'translateX(-1px) translateY(-3px)',
    hero: 'translateX(1px)',
    primordial: 'translateY(2px)',
    nature: 'translateY(-1px)',
    titan: 'translateX(-2px)',
    default: ''
  };

  // 應用哲學傾向姿勢
  const philoTendency = companionData.philoTendency;
  const philoPose = TENDENCY_POSES[philoTendency] || TENDENCY_POSES.unknown;

  const form = shadow.querySelector('.companion-form');
  if(form){
    // 如果有哲學傾向，優先使用哲學姿勢
    form.style.transform = philoTendency !== 'unknown' ? philoPose : (genPoses[dominant] || genPoses.default);
  }

  // 應用哲學傾向色彩到核心霧氣
  const coreEllipses = shadow.querySelectorAll('.comp-core ellipse');
  const haloEllipses = shadow.querySelectorAll('.comp-halo ellipse');
  const tendencyColor = TENDENCY_COLORS[philoTendency] || TENDENCY_COLORS.unknown;

  // 計算清晰度（基於哲學選擇次數，符合CLAUDE.md設計）
  // Phase 0-2: blur 12→9, Phase 3-5: blur 8, Phase 6-10: blur 6, Phase 10+: blur 4-5
  let blurAmount;
  if (companionData.philoScore <= 2) {
    blurAmount = 12 - (companionData.philoScore * 1.5); // 12, 10.5, 9
  } else if (companionData.philoScore <= 5) {
    blurAmount = 9 - ((companionData.philoScore - 2) * 0.33); // ~8
  } else if (companionData.philoScore <= 10) {
    blurAmount = 8 - ((companionData.philoScore - 5) * 0.4); // 6
  } else {
    blurAmount = Math.max(4, 6 - ((companionData.philoScore - 10) * 0.1)); // 4-5
  }
  const opacityAmount = Math.min(0.45, 0.20 + companionData.philoScore * 0.02);

  // 應用模糊效果
  if (companionData.philoScore > 0) {
    const mistBlur = shadow.querySelector('#mistBlur');
    const mistBlurLight = shadow.querySelector('#mistBlurLight');
    if (mistBlur) {
      mistBlur.querySelector('feGaussianBlur').setAttribute('stdDeviation', blurAmount);
    }
    if (mistBlurLight) {
      mistBlurLight.querySelector('feGaussianBlur').setAttribute('stdDeviation', blurAmount + 2);
    }
  }

  // 應用特殊效果類（移除所有傾向類，然後添加當前傾向）
  shadow.className = shadow.className.replace(/tendency-\w+/g, '').trim();
  if (philoTendency !== 'unknown') {
    shadow.classList.add('tendency-' + philoTendency);
  }
}

function getDominantGen(){
  const dist = companionData.genDistribution;
  let max = 0, dominant = 'olympian';
  for(const [gen, count] of Object.entries(dist)){
    if(count > max){ max = count; dominant = gen; }
  }
  return dominant;
}

// 記錄哲學選擇
function recordPhiloChoice(philosopherId) {
  const trait = PHILOSOPHER_TRAITS[philosopherId] || 'unknown';

  if (!companionData.philoChoices[trait]) {
    companionData.philoChoices[trait] = 0;
  }
  companionData.philoChoices[trait]++;
  companionData.philoScore++;

  // 計算新的主導傾向
  const newTendency = calculatePhiloTendency();
  const oldTendency = companionData.philoTendency;
  companionData.philoTendency = newTendency;

  // 保存
  saveCompanionData();

  // 如果傾向發生變化（或是首次檢測到傾向），觸發進化動畫
  if (oldTendency !== newTendency) {
    triggerTendencyShiftAnimation(oldTendency, newTendency);
  }

  renderCompanionShadow();
}

// 計算主導哲學傾向
function calculatePhiloTendency() {
  const choices = companionData.philoChoices;
  const entries = Object.entries(choices);

  if (entries.length === 0) return 'unknown';

  // 找到次數最多的傾向
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

// 保存伴隨數據
function saveCompanionData() {
  try {
    localStorage.setItem(COMPANION_KEY, JSON.stringify({
      visited: [...companionData.visited],
      genDistribution: companionData.genDistribution,
      philoChoices: companionData.philoChoices,
      philoTendency: companionData.philoTendency,
      philoScore: companionData.philoScore,
      letters: companionData.letters
    }));
  } catch(e) {}
}

// 傾向轉變時的神秘訊息（詩意版）
const TENDENCY_REVELATIONS = {
  rationalism: [
    '輪廓，漸漸清晰。',
    '某種重量，在沉澱。',
    '更近了。'
  ],
  existentialism: [
    '邊界在顫動。',
    '不確定。',
    '搖晃。'
  ],
  eastern: [
    '如水。',
    '慢下來了。',
    '沒有方向的方向。'
  ],
  utilitarianism: [
    '向外擴展。',
    '觸手可及之處，在拓寬。',
    '觸碰。'
  ],
  deontology: [
    '邊界，收緊了。',
    '更規整。',
    '棱角。'
  ],
  stoicism: [
    '靜止。',
    '凝固。',
    '永恆的一瞬。'
  ],
  skepticism: [
    '閃爍。',
    '存在，又不存在。',
    '模糊。'
  ],
  buddhism: [
    '散了。又聚。',
    '淡去。',
    '空。'
  ],
  confucianism: [
    '端正。',
    '禮。',
    '位置。'
  ],
  epicureanism: [
    '輕盈。',
    '此刻。',
    '愉悅。'
  ],
  pragmatism: [
    '搖擺。',
    '調整。',
    '有用。'
  ],
  unknown: []
};

// 測試：手動觸發進化到指定傾向
function testShadowEvolution(tendency) {
  const oldTendency = companionData.philoTendency;

  // 添加 3 次選擇，確保這個傾向成為主導
  companionData.philoChoices[tendency] = (companionData.philoChoices[tendency] || 0) + 3;
  companionData.philoScore += 3;
  companionData.philoTendency = tendency;

  saveCompanionData();
  renderCompanionShadow();

  // 觸發動畫和訊息
  triggerTendencyShiftAnimation(oldTendency, tendency);

  console.log(`Shadow 進化到: ${tendency}`);
}

// 重置進化數據
function resetShadowEvolution() {
  companionData.philoChoices = {};
  companionData.philoTendency = 'unknown';
  companionData.philoScore = 0;
  saveCompanionData();
  renderCompanionShadow();
  console.log('Shadow 進化已重置');
}

// 測試 Shadow 互動反應
function testShadowReaction(type) {
  const shadow = document.getElementById('companionShadow');
  if (!shadow) return;

  switch(type) {
    case 'shy':
      shadow.classList.add('shy');
      shadow.style.left = '-30px';
      shadow.style.top = `calc(50vh + ${Math.random() * 20 - 10}px)`;
      setTimeout(() => {
        shadow.classList.remove('shy');
        shadow.style.left = '-10px';
        shadow.style.top = '50vh';
      }, 2000);
      break;
    case 'confused':
      shadow.classList.add('confused');
      setTimeout(() => shadow.classList.remove('confused'), 2000);
      break;
    case 'glow':
      triggerShadowGlow();
      break;
    case 'all':
      // 依次觸發所有效果
      testShadowReaction('glow');
      setTimeout(() => testShadowReaction('shy'), 500);
      setTimeout(() => testShadowReaction('confused'), 2500);
      break;
  }
  console.log(`測試互動反應: ${type}`);
}

// Shadow 互動效果：害羞 + 共鳴發光
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const shadow = document.getElementById('companionShadow');
    if (shadow) {
      // 阻止選中和複製
      shadow.addEventListener('selectstart', (e) => e.preventDefault());
      shadow.addEventListener('copy', (e) => e.preventDefault());
      shadow.addEventListener('mousedown', (e) => e.preventDefault());

      // 開啟指針事件以偵測滑鼠
      shadow.style.pointerEvents = 'auto';
      shadow.style.cursor = 'default';

      let shyTimeout = null;
      let confusedTimeout = null;
      let isRecovering = false;
      let lastDistance = 999; // 記住上次距離

      // 害羞效果：滑鼠靠近時退開（概率可調），否則疑惑
      shadow.addEventListener('mouseenter', () => {
        if (shyTimeout) clearTimeout(shyTimeout);
        if (confusedTimeout) clearTimeout(confusedTimeout);
        const shyProb = parseInt(document.getElementById('shyProbability')?.value || 70) / 100;
        if (Math.random() < shyProb) {
          shadow.classList.remove('confused');
          shadow.classList.add('shy');
          shadow.style.left = '-30px';
          shadow.style.top = `calc(50vh + ${Math.random() * 20 - 10}px)`;
        } else {
          shadow.classList.remove('shy');
          shadow.classList.add('confused');
          confusedTimeout = setTimeout(() => shadow.classList.remove('confused'), 2000);
        }
      });

      shadow.addEventListener('mouseleave', () => {
        shadow.classList.remove('shy');
        shyTimeout = setTimeout(() => {
          shadow.style.left = '-10px';
          shadow.style.top = '50vh';
        }, 1000);
      });

      // 手機觸控支援
      shadow.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (shyTimeout) clearTimeout(shyTimeout);
        if (confusedTimeout) clearTimeout(confusedTimeout);
        const shyProb = parseInt(document.getElementById('shyProbability')?.value || 70) / 100;
        if (Math.random() < shyProb) {
          shadow.classList.remove('confused');
          shadow.classList.add('shy');
          shadow.style.left = '-30px';
          shadow.style.top = `calc(50vh + ${(Math.random() * 20 - 10)}px)`;
        } else {
          shadow.classList.remove('shy');
          shadow.classList.add('confused');
          confusedTimeout = setTimeout(() => shadow.classList.remove('confused'), 2000);
        }
      }, { passive: false });

      shadow._baseLeft = -10;
      shadow._baseTop = 50;

      // 全域觸控監聽：點擊陰影外的地方時恢復（手機端）
      document.addEventListener('touchstart', (e) => {
        if (!shadow.classList.contains('shy')) return;
        // 如果點擊的不是 shadow 本身
        if (!shadow.contains(e.target)) {
          shadow.classList.remove('shy');
          shadow.style.left = '-10px';
          shadow.style.top = '50vh';
        }
      });

      // 用 IntersectionObserver 代替 mousemove，只在 Shadow 可見時計算
      // 但為了簡單，這裡還是保留 mousemove，只是加節流
    }
  }, 500);

  // 監聽滑鼠移動，用於更靈敏的害羞偵測（節流版本）
  let isRecovering = false;
  let isProcessing = false;
  let confusedTimeout = null;

  document.addEventListener('mousemove', (e) => {
    if (isProcessing) return;
    isProcessing = true;

    requestAnimationFrame(() => {
      const shadow = document.getElementById('companionShadow');
      if (!shadow || !shadow.classList.contains('present')) {
        isProcessing = false;
        return;
      }

      const rect = shadow.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);

      const shyChance = parseInt(document.getElementById('shyProbability')?.value || 70) / 100;

      // 用方向變化代替距離判斷，避免頻繁觸發
      const wasNear = shadow._lastDistance < 150;
      const isNear = distance < 150;

      if (isNear && !wasNear && !shadow.classList.contains('shy') && !isRecovering) {
        if (Math.random() < shyChance) {
          shadow.classList.add('shy');
          shadow.style.left = '-30px';
          shadow.style.top = `calc(50vh + ${(Math.random() * 20 - 10)}px)`;
        } else {
          shadow.classList.add('confused');
          if (confusedTimeout) clearTimeout(confusedTimeout);
          confusedTimeout = setTimeout(() => shadow.classList.remove('confused'), 2000);
        }
      } else if (!isNear && wasNear && shadow.classList.contains('shy') && !isRecovering) {
        isRecovering = true;
        shadow.classList.remove('shy');
        shadow.style.left = '-10px';
        shadow.style.top = '50vh';
        setTimeout(() => { isRecovering = false; }, 800);
      }

      shadow._lastDistance = distance;
      isProcessing = false;
    });
  });
});

// 觸發 Shadow 共鳴發光效果（用於哲學選擇時）
function triggerShadowGlow() {
  const shadow = document.getElementById('companionShadow');
  if (!shadow) return;

  shadow.classList.add('glow-resonance');
  setTimeout(() => {
    shadow.classList.remove('glow-resonance');
  }, 1500);
}

function triggerTendencyShiftAnimation(fromTendency, toTendency) {
  const shadow = document.getElementById('companionShadow');
  if (!shadow) return;

  // 添加傾向轉變class，觸發CSS動畫
  shadow.classList.add('tendency-shifting');

  // 根據傾向給予額外的視覺反饋
  const tendencyEffects = {
    existentialism: '它劇烈地搖晃了一下...',
    stoicism: '它凝固了，像石頭一樣。',
    buddhism: '它開始消散...又凝聚...',
    skepticism: '它忽明忽暗...',
    rationalism: '它的輪廓清晰了。',
    eastern: '它像水一樣流動...',
    utilitarianism: '它在擴展，觸及更遠。',
    deontology: '它的邊界收緊了。',
    epicureanism: '它輕盈地跳動。',
    confucianism: '它站得更端正了。',
    pragmatism: '它在不斷調整自己。'
  };

  // 獲取該傾向的神秘訊息
  const messages = TENDENCY_REVELATIONS[toTendency] || ['它在沉默中回應了你...'];
  const message = messages[Math.floor(Math.random() * messages.length)];

  // 階段性視覺效果：先脈動，再穩定
  setTimeout(() => {
    shadow.style.filter = 'brightness(1.8) contrast(1.2)';
    shadow.style.transform = 'scale(1.1)';
  }, 500);

  setTimeout(() => {
    shadow.classList.remove('tendency-shifting');
    shadow.style.filter = '';
    shadow.style.transform = '';
    renderCompanionShadow(); // 重新渲染，應用新的傾向

    showMilestoneToast({ text: message, author: '' });
  }, 2000);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 樹狀渲染 (Tree Rendering)
 * Lines: ~1098-1180
 *
 * 核心渲染邏輯：根據 DATA 渲染節點樹、星座圖章、連線
 *
 * 主要函數：
 *   - markVisited()           標記已訪問節點，觸發里程碑檢查
 *   - updateProgressCounter() 更新進度計數器
 *   - renderNodes()           主渲染函數（調用其他子系統）
 *   - generateConstellationSVG() 為節點生成星座圖章 SVG
 *   - drawConnections()       繪製節點間連線（實線=血緣，虛線=關聯）
 *
 * 依賴：
 *   - DATA（全節點數據）
 *   - visited（已訪問 Set）
 *   - ZODIAC_SHAPES（黃道十二宮專屬星座形狀）
 *
 * 相關：navigation.js §導航（jumpToNode 會調用 markVisited）
 * ═══════════════════════════════════════════════════════════════════════════════ */
function markVisited(id){
  const isNew = !visited.has(id);
  visited.add(id);
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited])); }catch(e){}
  const el = document.getElementById('node-'+id);
  if(el) el.classList.add('visited');
  updateProgressCounter();
  if(isNew) checkMilestone(visited.size);
}

function updateProgressCounter(){
  const el = document.getElementById('progressCounter');
  if(!el) return;
  el.textContent = `已探索 ${visited.size} / ${DATA.length}`;
}

const CROSS_TYPE_META = {
  syncretism: {label:'融合', color:'var(--cross-syncretism)'},
  cognate: {label:'同源', color:'var(--cross-cognate)'},
  parallel: {label:'平行', color:'var(--cross-parallel)'},
};

function renderNodes(){
  ['primordial','titan','olympian','hero','nature','zodiac','troy','mythconcepts','philosophy','modernphil','psychology','arts','crosscultural'].forEach(gen=>{
    const row = document.querySelector('.gen-row[data-row="'+gen+'"]');
    DATA.filter(d=>d.gen===gen).forEach((d,i)=>{
      const el = document.createElement('div');
      el.className = 'node' + (visited.has(d.id) ? ' visited' : '');
      el.id = 'node-'+d.id;
      el.setAttribute('data-gen', gen);
      el.style.setProperty('--stagger', (i%10)*45+'ms');
      if(d.isRoman) el.setAttribute('data-roman', 'true');
      const typeMeta = d.crossType ? CROSS_TYPE_META[d.crossType] : null;
      el.innerHTML = `
        <div class="medallion" data-cid="${d.id}"></div>
        <div class="node-name">${d.zh}</div>
        <div class="node-sig">${getSignature(d)}</div>
        <div class="gr">${d.gr}</div>
        ${d.isRoman ? '<span class="roman-badge">羅馬 ROMAN</span>' : ''}
        ${typeMeta ? `<span class="type-badge" style="--badge-color:${typeMeta.color}">${typeMeta.label}</span>` : ''}
      `;
      el.addEventListener('click', ()=>selectNode(d.id));
      row.appendChild(el);
    });
  });
  updateProgressCounter();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 星座圖章系統 (Constellation Medallion)
 * Lines: ~1166-1230
 *
 * 為每個節點生成獨特的星座圖案，替代普通圓點
 *
 * 主要函數：
 *   - generateConstellationSVG() 根據 id 生成固定 seed，決定星座形狀
 *
 * 設計邏輯：
 *   - 使用 id 字串 hash 成 seed，確保同 id 永遠生成相同圖案
 *   - 黃道十二宮使用 ZODIAC_SHAPES（固定星座連線）
 *   - 其他角色使用人形骨架模板（5種姿態，6-11個點）
 *
 * 依賴：ZODIAC_SHAPES（黃道十二宮專屬形狀）
 * ═══════════════════════════════════════════════════════════════════════════════ */
function generateConstellationSVG(id, size){
  size = size || 64;
  let seed = 0;
  for(let i=0;i<id.length;i++){ seed = (seed * 31 + id.charCodeAt(i)) % 999983; }
  if(seed <= 0) seed += 999983;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  // The 12 zodiac signs get their own traditional/simplified constellation outlines instead of a
  // random humanoid template — these are the one tier that corresponds to real, named star patterns.
  const ZODIAC_SHAPES = {
    aries:       [[0.15,0.60],[0.35,0.45],[0.55,0.35],[0.75,0.40]],
    taurus:      [[0.20,0.25],[0.35,0.55],[0.50,0.42],[0.65,0.55],[0.82,0.22]],
    gemini:      [[0.30,0.15],[0.25,0.40],[0.32,0.65],[0.28,0.90],[0.55,0.85],[0.60,0.60],[0.68,0.35],[0.72,0.12]],
    cancer:      [[0.30,0.80],[0.45,0.55],[0.50,0.25],[0.62,0.50],[0.78,0.75]],
    leo:         [[0.25,0.20],[0.20,0.35],[0.28,0.50],[0.42,0.45],[0.65,0.55],[0.85,0.45],[0.70,0.28]],
    virgo:       [[0.20,0.30],[0.35,0.50],[0.50,0.35],[0.65,0.55],[0.55,0.75],[0.75,0.85]],
    libra:       [[0.25,0.65],[0.42,0.42],[0.50,0.20],[0.58,0.42],[0.75,0.65]],
    scorpio:     [[0.15,0.20],[0.22,0.35],[0.28,0.50],[0.35,0.62],[0.45,0.70],[0.55,0.74],[0.65,0.70],[0.70,0.58],[0.62,0.45]],
    sagittarius: [[0.20,0.70],[0.35,0.50],[0.50,0.30],[0.65,0.45],[0.55,0.60],[0.75,0.55],[0.85,0.35]],
    capricorn:   [[0.15,0.35],[0.45,0.25],[0.85,0.55],[0.50,0.70]],
    aquarius:    [[0.50,0.20],[0.42,0.40],[0.55,0.50],[0.35,0.60],[0.50,0.72],[0.30,0.85]],
    pisces:      [[0.15,0.25],[0.30,0.40],[0.45,0.55],[0.60,0.50],[0.75,0.60],[0.85,0.80]],
  };

  // Hand-designed constellation silhouettes (normalized 0–1, already in stroke order) —
  // evokes real constellation shapes (dipper, zigzag, ring, crown, hook, star) rather than a random scatter
  // Humanoid-figure silhouettes (normalized 0–1, already in stroke order) — head near the top, limbs
  // spreading below, evoking a person/god's pose (à la Orion or Hercules) rather than an abstract shape.
  // Point counts vary per template (6–11) so density differs node to node, not fixed at one number.
  const TEMPLATES = [
    [[0.5,0.12],[0.22,0.32],[0.5,0.50],[0.78,0.32],[0.30,0.90],[0.70,0.90]],                                                              // simple figure, arms out, legs apart (6 pts)
    [[0.5,0.15],[0.75,0.32],[0.62,0.55],[0.85,0.60],[0.50,0.68],[0.30,0.55],[0.18,0.75]],                                                 // seated / enthroned figure (7 pts)
    [[0.5,0.15],[0.32,0.28],[0.20,0.45],[0.42,0.42],[0.58,0.42],[0.80,0.45],[0.68,0.28],[0.5,0.75]],                                      // crouching / compact figure (8 pts)
    [[0.5,0.10],[0.30,0.24],[0.42,0.38],[0.18,0.15],[0.60,0.42],[0.82,0.28],[0.90,0.12],[0.55,0.62],[0.72,0.90],[0.35,0.88]],             // warrior, one arm raised (10 pts)
    [[0.5,0.10],[0.28,0.20],[0.08,0.32],[0.30,0.35],[0.5,0.45],[0.72,0.35],[0.92,0.32],[0.70,0.20],[0.58,0.55],[0.68,0.85],[0.35,0.82]],  // winged / outstretched figure (11 pts)
  ];

  const isZodiac = !!ZODIAC_SHAPES[id];
  const template = isZodiac ? ZODIAC_SHAPES[id] : TEMPLATES[Math.floor(rand() * TEMPLATES.length)];
  const jitterAmt = isZodiac ? 0.02 : 0.06;
  const rotation = isZodiac ? 0 : rand() * Math.PI * 2;
  const scale = isZodiac ? 1.0 : (0.88 + rand() * 0.16);
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const margin = size * 0.18;
  const usable = size - margin*2;
  const cx = size/2, cy = size/2;

  const points = template.map(([tx,ty])=>{
    const jx = tx + (rand()-0.5) * jitterAmt;
    const jy = ty + (rand()-0.5) * jitterAmt;
    const px = (jx - 0.5) * usable * scale;
    const py = (jy - 0.5) * usable * scale;
    const rx = px*cos - py*sin;
    const ry = px*sin + py*cos;
    return { x: cx + rx, y: cy + ry, r: 1.3 + rand() * 1.3 };
  });

  let lines = '';
  for(let i=0;i<points.length-1;i++){
    const a = points[i], b = points[i+1];
    lines += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="var(--ring, var(--gold))" stroke-width="1" opacity="0.55"/>`;
  }
  let dots = '';
  points.forEach(p=>{
    dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.r*2.2).toFixed(1)}" fill="var(--ring, var(--gold))" opacity="0.20"/>`;
    dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.r*0.65).toFixed(1)}" fill="#FFFBEF"/>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${lines}${dots}</svg>`;
}

function drawConnections(){

  const wrap = document.getElementById('treeWrap');
  const svg = document.getElementById('connections');
  const wrapRect = wrap.getBoundingClientRect();
  svg.setAttribute('width', wrap.scrollWidth);
  svg.setAttribute('height', wrap.scrollHeight);
  svg.innerHTML = '';

  DATA.forEach(node=>{
    if(!node.parents || node.parents.length===0) return;
    node.parents.forEach(pid=>{
      const parentEl = document.getElementById('node-'+pid);
      const childEl = document.getElementById('node-'+node.id);
      if(!parentEl || !childEl) return;
      const pr = parentEl.getBoundingClientRect();
      const cr = childEl.getBoundingClientRect();
      const x1 = pr.left + pr.width/2 - wrapRect.left + wrap.scrollLeft;
      const y1 = pr.top + pr.height - 8 - wrapRect.top + wrap.scrollTop;
      const x2 = cr.left + cr.width/2 - wrapRect.left + wrap.scrollLeft;
      const y2 = cr.top + 8 - wrapRect.top + wrap.scrollTop;
      const midY = (y1+y2)/2;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      path.setAttribute('class','edge');
      path.dataset.from = pid;
      path.dataset.to = node.id;
      svg.appendChild(path);
    });
  });

  const drawnCounterparts = new Set();
  DATA.forEach(node=>{
    if(!node.counterpart) return;
    const pairKey = [node.id, node.counterpart].sort().join('|');
    if(drawnCounterparts.has(pairKey)) return;
    drawnCounterparts.add(pairKey);
    const aEl = document.getElementById('node-'+node.id);
    const bEl = document.getElementById('node-'+node.counterpart);
    if(!aEl || !bEl) return;
    const ar = aEl.getBoundingClientRect();
    const br = bEl.getBoundingClientRect();
    const x1 = ar.left + ar.width/2 - wrapRect.left + wrap.scrollLeft;
    const y1 = ar.top + ar.height/2 - wrapRect.top + wrap.scrollTop;
    const x2 = br.left + br.width/2 - wrapRect.left + wrap.scrollLeft;
    const y2 = br.top + br.height/2 - wrapRect.top + wrap.scrollTop;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
    path.setAttribute('class','edge edge-counterpart');
    path.dataset.from = node.id;
    path.dataset.to = node.counterpart;
    svg.appendChild(path);
  });

  DATA.forEach(node=>{
    if(!node.links || node.links.length===0) return;
    node.links.forEach(targetId=>{
      const aEl = document.getElementById('node-'+node.id);
      const bEl = document.getElementById('node-'+targetId);
      if(!aEl || !bEl) return;
      const ar = aEl.getBoundingClientRect();
      const br = bEl.getBoundingClientRect();
      const x1 = ar.left + ar.width/2 - wrapRect.left + wrap.scrollLeft;
      const y1 = ar.top + ar.height/2 - wrapRect.top + wrap.scrollTop;
      const x2 = br.left + br.width/2 - wrapRect.left + wrap.scrollLeft;
      const y2 = br.top + br.height/2 - wrapRect.top + wrap.scrollTop;
      const midY = (y1+y2)/2;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      path.setAttribute('class','edge edge-zodiac');
      path.dataset.from = node.id;
      path.dataset.to = targetId;
      svg.appendChild(path);
    });
  });

  // Cross-cultural: syncretism (strong, solid) and cognate (linguistic, dashed) — 'parallel' intentionally gets no edge
  ['syncretism','cognate'].forEach(field=>{
    const edgeClass = field === 'syncretism' ? 'edge-syncretism' : 'edge-cognate';
    DATA.forEach(node=>{
      if(!node[field] || node[field].length===0) return;
      node[field].forEach(targetId=>{
        const aEl = document.getElementById('node-'+node.id);
        const bEl = document.getElementById('node-'+targetId);
        if(!aEl || !bEl) return;
        const ar = aEl.getBoundingClientRect();
        const br = bEl.getBoundingClientRect();
        const x1 = ar.left + ar.width/2 - wrapRect.left + wrap.scrollLeft;
        const y1 = ar.top + ar.height/2 - wrapRect.top + wrap.scrollTop;
        const x2 = br.left + br.width/2 - wrapRect.left + wrap.scrollLeft;
        const y2 = br.top + br.height/2 - wrapRect.top + wrap.scrollTop;
        const midY = (y1+y2)/2;
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
        path.setAttribute('class', 'edge ' + edgeClass);
        path.dataset.from = node.id;
        path.dataset.to = targetId;
        svg.appendChild(path);
      });
    });
  });
}

let currentId = null;

function animateEdgeDraw(path){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const len = path.getTotalLength();
  const isDashedType = path.classList.contains('edge-counterpart') || path.classList.contains('edge-zodiac') || path.classList.contains('edge-cognate');
  path.style.transition = 'none';
  if(!isDashedType){ path.style.strokeDasharray = len; }
  path.style.strokeDashoffset = len;
  // force reflow so the browser registers the starting state before we animate
  void path.getBoundingClientRect();
  path.style.transition = 'stroke-dashoffset .7s cubic-bezier(.4,0,.2,1), opacity .2s ease, stroke .2s ease, stroke-width .2s ease';
  path.style.strokeDashoffset = '0';
}

function selectNode(id){
  currentId = id;
  const isFirstVisit = !visited.has(id);
  document.querySelectorAll('.node').forEach(n=>n.classList.remove('active'));
  const selfEl = document.getElementById('node-'+id);
  if(selfEl) selfEl.classList.add('active');
  const pathBanner = document.getElementById('pathBanner');
  if(pathBanner){ pathBanner.classList.remove('show'); clearTimeout(pathBannerTimer); }

  document.querySelectorAll('.edge').forEach(e=>{
    e.classList.remove('edge-active','edge-dim');
    if(e.dataset.from===id || e.dataset.to===id){
      e.classList.add('edge-active');
      animateEdgeDraw(e);
    } else {
      e.classList.add('edge-dim');
    }
  });

  storyOpenId = null;
  markVisited(id);
  updateCompanion(id);
  if(isFirstVisit){ playUnlockChime(); } else { playSelectSound(byId[id].gen); }
  checkScaleEasterEgg(byId[id].gen);
  renderDetail(id);
  maybeSurfaceQuote();

  const panel = document.getElementById('detailPanel');
  panel.classList.add('open');
}

function closePanel(){
  document.getElementById('detailPanel').classList.remove('open');
}

const CROSS_BANNER_META = {
  syncretism: {icon:'🔗', label:'歷史上真實融合', desc:'兩位神祇在歷史上被正式合併、視為同一位神明的不同面貌，不是後世學者的比附。'},
  cognate: {icon:'🗣️', label:'語言學同源', desc:'名字源自同一個史前詞根，是比較語言學考證出的親緣關係，而非文化互相借用。'},
  parallel: {icon:'⏳', label:'軸心時代平行', desc:'活躍於同一段歷史時期，但目前沒有證據顯示彼此有過直接接觸——純屬時代上的巧合並置。'},
};

// Reciprocal lookup: find all crosscultural nodes that point AT this id via syncretism/cognate/parallel
function crossLinksTo(id){
  const result = {syncretism:[], cognate:[], parallel:[]};
  DATA.forEach(d=>{
    ['syncretism','cognate','parallel'].forEach(field=>{
      if(d[field] && d[field].includes(id) && d.id !== id){
        result[field].push(d.id);
      }
    });
  });
  return result;
}

function renderDetail(id){
  const d = byId[id];
  document.getElementById('detailEmpty').style.display = 'none';
  const content = document.getElementById('detailContent');
  content.style.display = 'block';

  const parentsChips = (d.parents||[]).map(pid=>{
    const p = byId[pid];
    return `<button class="link-chip" onclick="jumpToNode('${pid}')">${p.zh} ${p.gr}</button>`;
  }).join('') || `<span style="font-size:12.5px;color:var(--ink-soft);">${d.gen==='primordial' ? '無（原初存在）' : '無明確記載的單一親系'}</span>`;

  const kids = childrenOf(id);
  const kidsChips = kids.length
    ? kids.map(k=>`<button class="link-chip" onclick="jumpToNode('${k.id}')">${k.zh} ${k.gr}</button>`).join('')
    : '<span style="font-size:12.5px;color:var(--ink-soft);">（無記載後代）</span>';

  const counterpartRow = d.counterpart ? `
    <div class="detail-section-title">跨文化對應</div>
    <div class="link-row"><button class="link-chip" onclick="jumpToNode('${d.counterpart}')">✦ ${byId[d.counterpart].zh} ${byId[d.counterpart].gr}</button></div>
  ` : '';

  const linksRow = (d.links && d.links.length) ? `
    <div class="detail-section-title">${d.gen==='philosophy' ? '思想關聯' : '神話關聯'}</div>
    <div class="link-row">${d.links.map(lid=>`<button class="link-chip" onclick="jumpToNode('${lid}')">✧ ${byId[lid].zh} ${byId[lid].gr}</button>`).join('')}</div>
  ` : '';

  // Cross-cultural: the big attention-grabbing banner for nodes that ARE one of these three types
  const crossBanner = d.crossType ? (()=>{
    const meta = CROSS_BANNER_META[d.crossType];
    const targets = (d[d.crossType]||[]).map(tid=>byId[tid]).filter(Boolean);
    const targetNames = targets.map(t=>t.zh).join('、');
    return `
      <div class="cross-banner cross-banner-${d.crossType}">
        <span class="cross-icon">${meta.icon}</span>
        <div>
          <div class="cross-label">${meta.label}${targetNames ? ' · 對應 ' + targetNames : ''}</div>
          <div class="cross-desc">${meta.desc}</div>
        </div>
      </div>
      <div class="cross-links-row">${targets.map(t=>`<button class="cross-chip" style="--chip-color:${CROSS_TYPE_META[d.crossType].color}" onclick="jumpToNode('${t.id}')">${t.zh} ${t.gr}</button>`).join('')}</div>
    `;
  })() : '';

  // Reciprocal: for Greek-side nodes (e.g. Zeus, Hermes, Socrates) that RECEIVE cross-cultural connections
  const incoming = crossLinksTo(id);
  const incomingRows = ['syncretism','cognate','parallel'].map(field=>{
    if(!incoming[field].length) return '';
    const meta = CROSS_BANNER_META[field];
    const chips = incoming[field].map(tid=>{
      const t = byId[tid];
      return `<button class="cross-chip" style="--chip-color:${CROSS_TYPE_META[field].color}" onclick="jumpToNode('${tid}')">${meta.icon} ${t.zh} ${t.gr}</button>`;
    }).join('');
    return `
      <div class="detail-section-title">${meta.label}</div>
      <div class="cross-links-row">${chips}</div>
    `;
  }).join('');

  // 完整渲染 story
  const storyText = d.story;

  content.innerHTML = `
    <div class="detail-header">
      <div class="detail-medallion" style="--ring:var(--${d.gen})">${generateConstellationSVG(d.id, 48)}</div>
      <div class="detail-title">
        <h2>${d.zh}</h2>
        <div class="gr-name">${d.gr} · 羅馬名：${d.roman}</div>
      </div>
    </div>
    <div class="detail-epithet">「${d.epithet}」</div>
    ${crossBanner}
    <div class="detail-tags">
      <span class="tag">領域：${d.domain}</span>
      <span class="tag">象徵：${d.symbol}</span>
    </div>
    <div class="detail-story">${storyText}</div>
    ${d.diagram ? `<div class="concept-diagram">${d.diagram}<div class="diagram-caption">💡 概念圖解</div></div>` : ''}
    <button class="read-story-btn" id="storyToggleBtn" onclick="toggleStory('${d.id}')">📜 閱讀完整神話故事</button>
    <div class="full-story-box" id="fullStoryBox"></div>
    <div class="astro-box">
      <span class="astro-icon">🔭</span>
      <div class="astro-text"><span class="astro-label">在夜空中</span>${d.astro || '目前尚無明確對應的天體命名。'}</div>
    </div>
    ${NODE_EGG_LOOKUP[id] ? `<div class="egg-seal-wrap"><button class="egg-seal" onclick="jumpToEggFromNode('${id}')" title="這裡藏著 ${NODE_EGG_LOOKUP[id].length} 條關於${d.zh}的塵封軼聞" aria-label="查看關於${d.zh}的塵封軼聞">🧩</button></div>` : ''}
    <div class="detail-section-title">父母</div>
    <div class="link-row">${parentsChips}</div>
    <div class="detail-section-title">子嗣 / 後代</div>
    <div class="link-row">${kidsChips}</div>
    ${counterpartRow}
    ${linksRow}
    ${incomingRows}
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 哲學測驗 + 書信系統 (Philosophical Choices & Letters)
 * Lines: ~1519-1920
 *
 * 「你的抉擇」互動式哲學困境測驗，以及書寫功能
 *
 * 主要數據：
 *   - PHILO_DILEMMAS[]  哲學測驗題庫（電車難題、職場倫理、社交誠信等）
 *
 * 主要函數：
 *   - openPhilo()       打開哲學測驗面板
 *   - choosePhilo(i)    選擇答案，調用 recordPhiloChoice()
 *   - nextPhilo()       下一題
 *   - openLetter()      打開書寫面板
 *   - submitLetter()    提交書信，存入 companionData.letters
 *
 * 觸發進化：choosePhilo() → recordPhiloChoice() → 影子進化
 *
 * 依賴：companion.js（philoChoices, philoTendency）
 * 相關：companion.js §影子系統（記錄選擇後更新）
 * ═══════════════════════════════════════════════════════════════════════════════ */
const PHILO_DILEMMAS = [
  {
    q:'一輛失控電車即將撞死五個人，你可以拉下拉桿讓電車轉向，但這樣會撞死另一名原本安全的路人。你會怎麼做？',
    options:[
      {label:'拉下拉桿，犧牲一人救五人', reveal:'singer', text:'這接近效益主義的計算邏輯——彼得・辛格主張，道德判斷應以「整體痛苦與幸福的總量」為依歸，救五人比救一人，帶來更大的整體福祉。'},
      {label:'不拉拉桿，讓電車照原路撞向五人', reveal:'laozi', text:'這呼應了老子「無為」的精神——不主動介入、不讓自己的手沾上原本不屬於自己的因果，順應事物本有的走向，而非強行插手改變命運。'},
      {label:'先確認身份再決定——這五人是罪犯，這一人是無辜者', reveal:'nietzsche', text:'這呼應了尼采對道德的質疑——所謂「普世道德」往往是弱者的保護傘，不分青紅皂白地「救多數」，可能只是在掩蓋正義的複雜性。'}
    ]
  },
  {
    q:'如果可以無限次、一字不差地重複過完全相同的一生——包括所有的痛苦與遺憾——你會願意嗎？',
    options:[
      {label:'願意，我會對這一生說「是」', reveal:'nietzsche', text:'這正是尼采「永恆輪迴」的思想實驗——他認為，唯有真正熱愛自己生命的人，才敢於對這樣的重複坦然說「是」，這是他衡量一個人是否肯定生命的終極尺度。'},
      {label:'不願意，人生的痛苦不值得重複', reveal:'schopenhauer', text:'這呼應了叔本華的悲觀哲學——他認為人生本質是一場在痛苦與無聊之間擺盪的鐘擺，短暫的滿足只會迅速讓位給新的空虛，重複只會讓這場擺盪加倍。'},
      {label:'問這個問題沒有實際意義，專注當下比較實際', reveal:'pragmatism', text:'這接近實用主義的立場——抽象的思想實驗若無法轉化為實際行動的指引，它的價值就有限。與其糾結於假設性的重複，不如把精力放在切實改善當下的生活上。'}
    ]
  },
  {
    q:'假設你要為一個全新的社會設計規則，但你不知道自己出生後會是富人還是窮人、健康還是殘疾、屬於多數還是少數群體，你會怎麼設計？',
    options:[
      {label:'我會設計出對最弱勢者最有利的制度，因為我可能就是那個人', reveal:'rawls', text:'你剛剛親自完成了羅爾斯著名的「無知之幕」思想實驗——他主張，唯有在不知道自己會落在社會哪個位置的前提下所做出的選擇，才是真正公平的正義原則。'},
      {label:'我會建立一套重視倫理教化與角色責任的秩序，而非強求齊頭式的平等', reveal:'confucius', text:'這更接近孔子的社會秩序觀——他主張社會的和諧，來自每個人在自己的角色（君臣、父子、朋友）裡盡到應有的倫理責任，而不是先假定一套抽象、脫離具體關係的平等規則。'},
      {label:'我只保障最基本的權利，其他由個人自己負責', reveal:'libertarianism', text:'這接近自由意志主義的立場——國家不該強行拉平人與人的差距，每個人應對自己的選擇負責，政府的角色應限於保障基本權利，而非財富重分配。'}
    ]
  },
  {
    q:'一艘船的木板被逐一替換，最終全船的木板都換過一輪——這還是原來的那艘船嗎？',
    options:[
      {label:'不是了，構成船的物質已經完全不同', reveal:'zhuangzi', text:'這呼應了莊子「萬物皆流、齊物」的世界觀——執著於「這個東西是不是原本那個東西」，某種程度上正是一種尚未看透萬物本無固定自性的執念。'},
      {label:'還是同一艘船，重要的是設計與功能的延續', reveal:'aristotle', text:'這接近亞里斯多德的「形式因」概念——他認為一件事物的本質，在於它的形式與目的，而非構成它的具體物質，物質可以替換，形式的延續才是同一性的關鍵。'},
      {label:'取決於誰在問這個問題，視角不同答案不同', reveal:'wittgenstein', text:'這接近維根斯坦對語言遊戲的分析——「同一艘船」這個概念在不同語境下有不同的用法，沒有獨立於使用語境之外的「終極答案」。'}
    ]
  },
  {
    q:'有一台機器，只要接上它，就能讓你體驗到完美、真實無比的快樂人生，但那全部都是虛擬模擬出來的。你會願意接上去、從此不再拔下來嗎？',
    options:[
      {label:'願意，快樂本身就是人生最高的善', reveal:'epicureanism', text:'這接近伊比鳩魯學派的立場——他們主張，快樂（尤其是免於痛苦與恐懼的心靈寧靜）本身就是人生追求的終極目標，若機器真能提供這一切，又何必拒絕？'},
      {label:'不願意，就算痛苦，我也想要真實的人生', reveal:'sartre', text:'這呼應了沙特的存在主義立場——人的尊嚴在於自由地選擇、並為自己的選擇負責，一個被機器預先寫定的「假人生」，即使快樂，也剝奪了真正屬於你自己的自由。'},
      {label:'先問問自己：「現在這段時間，是真實的嗎？」', reveal:'buddha', text:'這呼應了佛教對「執著」的解讀——對「真實」與「虛假」的過度執著，本身也是苦的來源。接受一切經驗的短暫無常，或許比追問真假更重要。'}
    ]
  },
  {
    q:'如果能選擇，你想活在一個舒適、卻虛假的幻覺裡，還是走出去，面對可能令人不安的真相？',
    options:[
      {label:'我想知道真相，即使它令人不安', reveal:'republic', text:'這正是柏拉圖《理想國》裡著名的「洞穴寓言」——他認為，哲學家的責任正是掙脫束縛、走出洞穴，即便洞外的陽光起初刺眼難耐，也好過一輩子盯著牆上的影子。'},
      {label:'若真相只帶來不必要的痛苦，舒適的心靈平靜也未必是壞事', reveal:'epicureanism', text:'這接近伊比鳩魯學派的立場——他們認為，人生追求的終極目標是心靈的寧靜安穩（ataraxia），若揭露真相除了帶來焦慮與不安、並不能實質改善處境，執意追求未必真的比較明智。'},
      {label:'這個問題本身就假設了真相可知，但或許根本沒有「真相」這回事', reveal:'skepticism', text:'這接近懷疑學派的態度——或許「幻覺」與「真相」的界限並不如想像中清晰，我們根本無法確認自己現在認為的「真相」，不會是另一層更大的幻覺。'}
    ]
  },
  {
    q:'突然收到一個你完全無法改變、也無法挽回的壞消息，你的第一反應通常是什麼？',
    options:[
      {label:'先花時間憤怒、抗拒，接受需要過程', reveal:'camus', text:'這接近卡繆式的態度——他主張真正誠實面對「荒謬」，不該是壓抑情緒、假裝雲淡風輕，而是先如實承認世界的不合理與自己的憤怒，才談得上後續「即便如此，仍要選擇繼續前行」。'},
      {label:'盡快接受，把心力放回自己還能控制的事情上', reveal:'stoicism', text:'這正是斯多葛學派的核心主張——區分「操之在我者」與「操之不在我者」，把注意力收回到自己真正能掌控的事物上，是斯多葛式心靈平靜的起點。'},
      {label:'閉上眼睛，深呼吸，觀察念頭生滅而不隨之起舞', reveal:'buddha', text:'這呼應了佛教的內觀傳統——情緒只是暫時生起的現象，觀察它而不認同它、不被它帶走，是通往內心平靜的方法。'}
    ]
  },
  {
    q:'如果你此刻正在做一場極其真實的夢，夢裡的你完全感覺不出任何破綻——這件事，重要嗎？',
    options:[
      {label:'不重要，只要我此刻的感知是完整而真實的', reveal:'wangyangming', text:'這呼應了王陽明「心外無物」的立場——他主張「你未看此花時，此花與汝心同歸於寂」，事物的存在，本就與你的心念、感知緊密相繫，「是否為夢」的區分，也許本身就不是最核心的問題。'},
      {label:'重要，我仍然想知道自己所處的到底是不是真實世界', reveal:'skepticism', text:'這接近懷疑學派的態度——面對無法徹底證實或證偽的命題，最誠實的立場，是承認自己的不確定，並持續懸置判斷，而不是輕易接受一個無法驗證的答案。'},
      {label:'不重要，無論真假，這就是我的生活', reveal:'stoicism', text:'這接近斯多葛學派的觀點——外在世界是真是假並不重要，重要的是你如何面對它。當下的感知與行動，就是你唯一能控制的部分。'}
    ]
  },
  {
    q:'如果堅持自己認為正確的信念，會為你招致社會嚴厲的懲罰甚至死刑，你會選擇妥協求生，還是堅持到底？',
    options:[
      {label:'我會堅持自己的信念，即使代價是生命', reveal:'socrates', text:'這正是蘇格拉底本人的真實選擇——被雅典法庭判處死刑後，朋友曾提議賄賂獄卒助他越獄，他卻拒絕了，堅持自己一貫教導的「遵守城邦法律」的原則，飲下毒酒，慷慨赴死。'},
      {label:'我會暫時妥協、保全自己，把信念留待更合適的時機再實踐', reveal:'sophism', text:'這接近智者學派的實踐智慧——他們強調因時因地制宜，不盲目堅持抽象原則，保全自身、留待來日，某種程度上也是一種理性的選擇，不必然遜於堅持到底的悲壯。'},
      {label:'真正的「正確」需要被證明，代價是值得的', reveal:'nietzsche', text:'這呼應了尼采對「強者道德」的主張——敢於為自己的信念承擔代價，正是超越「奴隸道德」的表現，怯懦地放棄只會讓信念失去力量。'}
    ]
  },
  {
    q:'你會選擇當一頭什麼都不缺、終日滿足的豬，還是一個時常懷疑、時常不滿足、卻始終清醒思考的人？',
    options:[
      {label:'寧可做一個清醒卻不滿足的人', reveal:'aristotle', text:'這呼應了亞里斯多德的幸福觀——他認為真正的幸福（eudaimonia）必須來自理性能力的充分實踐，單純的感官滿足，稱不上是人類獨有、也最值得追求的美好生活。'},
      {label:'簡單而免於恐懼與痛苦的快樂，才是人生真正該追求的', reveal:'epicureanism', text:'這接近伊比鳩魯學派的立場——他們主張，人生最值得追求的，是免於身體痛苦、心靈不受紛擾的簡單快樂，過度複雜的慾望與焦慮，反而是幸福的敵人。'},
      {label:'問題本身就是個陷阱，動物並不會因為無知而感到不幸', reveal:'nietzsche', text:'這呼應了尼采對「奴隸道德」的批判——把人與動物對立起來，本身就是一種價值判斷的偏見。真正的問題是：你能否在清醒中依然肯定生命，而非逃避到無知的「幸福」裡。'}
    ]
  },
  {
    q:'如果你發現自己的一生早已被命運寫定，你還會盡全力去努力嗎？',
    options:[
      {label:'會，盡好自己該做的責任，無論結果是否早已註定', reveal:'stoicism', text:'斯多葛學派有句名言：「命運領著願意的人走，拖著不願意的人走。」他們主張，無論命運如何，人依然該盡好自己份內的德行與責任，這正是人唯一能真正掌握的部分。'},
      {label:'不會，如果一切早已寫定，人真正的自由意志又在哪裡？', reveal:'sartre', text:'這呼應了沙特的存在主義立場——他主張人沒有任何預先寫定的本質，人「被判決要自由」，每一個選擇都真實地由自己承擔，若接受命運已定，某種程度上正是放棄了做人最根本的自由與責任。'},
      {label:'努力本身就是意義，結果從來不是自己能決定的', reveal:'buddha', text:'這呼應了佛教對「因緣和合」的理解——一切結果都是眾多條件共同作用的產物，我們能做的，只是盡心盡力種下善因，至於結什麼果，不是「我」能決定的。'}
    ]
  },
  {
    q:'一個人明明知道某件事是錯的，卻依然去做了——你會怎麼理解這種情況？',
    options:[
      {label:'他其實並沒有真正「知道」，若真正認清善，不可能明知故犯', reveal:'socrates', text:'這是蘇格拉底著名的「德性即知識」主張——他認為，人不會明知故犯地選擇對自己不利的惡，一個人做出惡行，只可能是因為他對「善」的認識，其實還不夠透徹。'},
      {label:'知道歸知道，能不能真正做到，是完全另一回事', reveal:'anscombe', text:'這接近安斯庫姆在《意圖》一書裡的分析——她主張，意圖必須透過它實際導致的具體行動來理解，一個從未化為行動的「知道」，某種意義上，可能根本稱不上是完整的知道。'},
      {label:'有時候「對」與「錯」的界線並沒有那麼分明', reveal:'nussbaum', text:'這接近納思邦對情感與道德判斷的複雜性分析——現實中的道德處境往往涉及多方利益的權衡，單純的「對與錯」標籤，有時掩蓋了真正的道德複雜性。'}
    ]
  },
  {
    q:'美，是獨立於任何人感受、客觀存在的一種性質，還是純粹因人而異的主觀感受？',
    options:[
      {label:'美是客觀存在的，只是有些人尚未領悟到它', reveal:'plato', text:'這呼應了柏拉圖的理型論——他主張，世間一切美麗的事物，都只是分享了「美」這個永恆不變、獨立於任何個人感受而客觀存在的理型，我們對美的感受，只是對這個理型微弱的體會。'},
      {label:'美離不開觀看者當下的情感與處境，無法脫離主觀經驗單獨存在', reveal:'nussbaum', text:'這接近納思邦對情感哲學的主張——她認為，情感（包括對美的感受）並非理性的對立面，而是一種判斷的形式，深深嵌在觀看者具體的處境與生命經驗之中，無法被抽離成一套純粹客觀的規則。'},
      {label:'美是物與心共同創造的，兩者缺一不可', reveal:'aristotle', text:'這接近亞里斯多德的「四因說」——美既離不開事物本身的形式與比例（客觀），也離不開觀看者的感知與判斷（主觀），是兩者相遇時產生的真實經驗。'}
    ]
  },
  {
    q:'面對陌生人與至親家人同樣程度的苦難，你認為自己該給予同等程度的關懷嗎？',
    options:[
      {label:'該的，每個人的痛苦都同樣值得被認真考量，不因親疏而打折扣', reveal:'singer', text:'這正是彼得・辛格效益主義式的立場——他主張，道德考量應以「痛苦與幸福的總量」為依歸，一個陌生人的痛苦，不該僅僅因為距離遙遠或彼此不熟識，就被賦予比較低的道德權重。'},
      {label:'不必，親疏遠近本就該有不同程度的責任與付出', reveal:'confucius', text:'這呼應了儒家「愛有差等」的倫理觀——孔子主張，人倫關係本有親疏遠近之別，對父母、對朋友、對陌生人付出不同程度的關懷與責任，並非道德上的缺陷，而是人倫秩序本該如此的樣貌。'},
      {label:'在確保家人安全的前提下，盡量幫助陌生人', reveal:'rawls', text:'這接近羅爾斯的正義理論——社會基本結構應確保每個人的基本權利與機會，但同時也允許在具體實踐中根據關係的性質給予不同程度的關懷。'}
    ]
  },
  {
    q:'面對任何一個看似理所當然的常識，你會傾向懸置判斷、保持懷疑，還是相信自己的日常經驗大致可靠？',
    options:[
      {label:'我會盡量懸置判斷，任何命題都可能找到力量相當的反駁', reveal:'skepticism', text:'這正是懷疑學派的核心方法——他們主張，針對任何一個命題，系統性地尋找出力量相當的反面論證，才能真正擺脫武斷信念帶來的焦慮，獲得心靈的寧靜。'},
      {label:'我還是相信自己的日常經驗與常識，大致值得信賴', reveal:'aristotle', text:'這接近亞里斯多德重視經驗觀察的精神——他不像老師柏拉圖那樣，把終極真理寄託在抽象的理型世界裡，而是主張，仔細觀察與歸納這個具體世界裡的現象，本身就是通往知識可靠的起點。'},
      {label:'對日常生活有用的就信，對形而上學的問題保持開放', reveal:'wittgenstein', text:'這接近維根斯坦對「語言邊界」的理解——有些命題在日常生活的語言遊戲中是有意義的，有些命題超出語言能表達的範圍，勉強回答只會陷入無意义的纷争。'}
    ]
  },
  {
    q:'面對善惡交織、是非難辨的複雜處境，你會傾向向內尋求自己的覺悟，還是主動選擇站在你認定光明的一方、與黑暗對抗？',
    options:[
      {label:'向內尋求自己的覺悟，答案本就不假外求', reveal:'buddha', text:'這呼應了佛陀的教導——他主張，苦難的根源與解脫之道，都在於個人內在的覺悟與修行，而非向外尋求某個終極的善惡仲裁者，真正的清明，來自向內看見自己心念的實相。'},
      {label:'主動選擇立場，善惡的對抗需要每個人親自參與', reveal:'zoroaster', text:'這接近瑣羅亞斯德教的宇宙觀——他們主張，光明神阿胡拉・馬茲達與黑暗神安格拉・曼紐永恆對抗，每個人的每一個選擇，都是這場宇宙級善惡鬥爭裡，微小卻真實的一份參與。'},
      {label:'有時候「光明」與「黑暗」的劃分本身就很可疑', reveal:'nietzsche', text:'這呼應了尼采對傳統道德的批判——所謂的「善惡對立」，往往是特定群體建構出來的價值觀，而非宇宙間客觀存在的事實。學會質疑這種二元劃分，是走向真正自由的第一步。'}
    ]
  },
  {
    q:'如果能複製出一個記憶、感受、性格都與你一模一樣的副本，原本的你與這個複製人，誰才是「真正的你」？',
    options:[
      {label:'這個問題本身或許沒有意義，因為根本沒有一個永恆不變的「真正自我」可言', reveal:'buddha', text:'這呼應了佛教「無我」的教義——依照這套思想，我們終其一生執著追尋的那個固定不變的「自我」，本來就是一種錯覺，追問「哪一個才是真正的我」，某種程度上是從一個錯誤的預設出發。'},
      {label:'這個問題本身沒有答案，因為我們可能問錯了問題', reveal:'wittgenstein', text:'這接近維根斯坦後期哲學的態度——他認為，許多哲學上看似深刻的難題，其實源自我們誤用了日常語言的方式，「哪一個才是真正的你」這個提問本身的語言邏輯，或許才是真正該被檢視的地方。'},
      {label:'兩個都是，也都不是，真正的「我」存在於意識的連續性中', reveal:'aristotle', text:'這接近亞里斯多德對靈魂的論述——生命的本質在於其「形式」的持續運作，而非物質的靜態保存。意識的連續性與功能性，或許比「誰先存在」更能定義「真正的我」。'}
    ]
  },
  {
    q:'如果你今天的所有選擇——早餐吃什麼、幾點睡——都被一個演算法預測並安排好了，你會覺得被控制，還是覺得輕鬆？',
    options:[
      {label:'輕鬆，我本來就不喜歡選擇困難', reveal:'epicureanism', text:'這接近伊比鳩魯學派的立場——他們主張，真正值得追求的快樂，是免於焦慮與選擇疲憊的心靈寧靜。如果一個演算法能讓你每天少吃這種苦，又何樂而不為？'},
      {label:'可怕，這代表「我」這個人根本不存在', reveal:'sartre', text:'這呼應了沙特的存在主義——人若沒有「自由選擇」的空間，就沒有真正的「存在」。如果連早餐都別人幫你選好了，你還算是「你」嗎？'},
      {label:'這取決於演算法是為我服務，還是我為它服務', reveal:'nietzsche', text:'這呼應了尼采對「末人」的批判——關鍵不在於有沒有選擇，而在於選擇背後是否有力量。如果演算法讓你變得更軟弱、更有依賴性，那就是一種退化；如果它釋放了你的精力用於更重要的事，那就是一種解放。'}
    ]
  },
  {
    q:'你在一家公司發現它在作惡，但你的薪水養活了全家，離開就餓死。你繼續待著嗎？',
    options:[
      {label:'待著，我沒有選擇', reveal:'confucius', text:'這接近儒家「角色倫理」的觀點——你首先是一個父親/母親/兒子/女兒，「盡好自己的責任」比抽象的正義更重要。'},
      {label:'離開，遲早要被清算的', reveal:'arendt', text:'這呼應了鄂蘭「邪惡的平庸性」的警示——正是每一個「我只是打工」的普通人的服從，讓系統性的惡得以運作。'},
      {label:'留在內部嘗試改變，至少能減少一些傷害', reveal:'pragmatism', text:'這接近實用主義的立場——理想主義的「全有或全無」往往不現實，在體制內設法改善，也許比義憤填膺地離開更有實質效果。'}
    ]
  },
  {
    q:'你在網上看到一段話，點讚數極高，但直覺告訴你它是錯的——你會公開反駁嗎？',
    options:[
      {label:'不會，算了，多一事不如少一事', reveal:'confucius', text:'這接近儒家的「鄉愿」概念——過度在意他人看法、迴避衝突代價的代價，是讓真正對的聲音消失。'},
      {label:'會，沉默本身就是一種共謀', reveal:'arendt', text:'這呼應了鄂蘭對極權主義運作機制的洞察——最大的惡，往往正是由那些「選擇不發聲」的旁觀者，默默支撐起來的。'},
      {label:'先私底下了解更多信息，再決定是否公開', reveal:'socrates', text:'這呼應了蘇格拉底的詰問法——在公開發言之前，先確保自己對事實有充分的了解。衝動的反駁和衝動的沉默，同樣都是未經思考的表現。'}
    ]
  },
  {
    q:'如果你的貓/狗會說話，你問它「你開心嗎」，它回答「開心」——這算是一個有意義的答案嗎？',
    options:[
      {label:'算，動物也會表達情緒', reveal:'aristotle', text:'這接近亞里斯多德對「功能」（function）的論證——生物有其固有的繁盛方式，只要它在正常運行，就是好的。'},
      {label:'不算，「開心」這個概念只有人類才有', reveal:'plato', text:'這接近柏拉圖的理型論——「開心」是一種抽象概念，動物只能體驗低層次的需求滿足，無法真正「理解」開心是什麼。'},
      {label:'取決於我們如何定義「有意義」', reveal:'wittgenstein', text:'這接近維根斯坦對「私人語言」的批判——當動物學會使用人類語言，我們是否能確定它賦予這些詞彙的意義與人類相同？語言的使用本身就是一個需要探究的問題。'}
    ]
  },
  {
    q:'你發現你最信任的朋友，三年來一直在說關於你的謊言——你第一件事是什麼？',
    options:[
      {label:'問為什麼，我想理解', reveal:'socrates', text:'這呼應了蘇格拉底的詰問法——在行動之前，先試圖理解事實的全貌，再做判斷。'},
      {label:'直接切割，這種朋友不值得', reveal:'diogenes', text:'這接近第歐根尼的立場——真實比關係更重要，一個建立在謊言上的友誼，根本不值得留戀。'},
      {label:'先確認這個謊言的性質和動機，再決定如何回應', reveal:'nussbaum', text:'這接近納思邦對情感複雜性的理解——並非所有謊言都出於同樣的動機，有些是保護，有些是自保，有些是習慣。先理解背後的原因，才能做出真正符合道德的判斷。'}
    ]
  },
  {
    q:'你獲得一個機會：可以知道任何一件事的真相，但這個真相一旦知道，就永遠無法忘記。你會用嗎？',
    options:[
      {label:'會，我寧可痛苦地清醒', reveal:'camus', text:'這正是卡繆《薛西弗斯的神話》想說的——清醒地意識到荒謬，比自欺地活在幻覺裡，是更高貴的處境。'},
      {label:'不會，有些事不知道比較好', reveal:'nussbaum', text:'這接近納思邦對情感與關係的重視——有些真相只會帶來傷害，而傷害並不必然讓我們活得更好。'},
      {label:'看我當下是否有能力承受這個真相', reveal:'stoicism', text:'這接近斯多葛學派的觀點——關鍵不在於知道什麼，而在於知道之後如何面對。如果我現在的心靈力量足夠強大，可以承擔任何結果，那就用；如果不能，或許還需要更多準備。'}
    ]
  },
  {
    q:'你是一個國家的領導者，一項政策能讓一百萬人受益，但會讓一千人付出生命代價。你會推行嗎？',
    options:[
      {label:'會，少數服從多數是基本的', reveal:'singer', text:'這是典型的效益主義計算——一百萬人的福祉，在道德上當然比區區一千人的損失更重要。'},
      {label:'不會，每一條命都是獨立的，不能被「抵消」', reveal:'kant', text:'這接近康德的「人是目的而非手段」原則——任何人的生命都不能單純被當成達成集體利益的工具。'},
      {label:'視情況而定，若能將這一千人的犧牲降至最低並充分補償，或許可以', reveal:'welfare_liberalism', text:'這接近福利自由主義的立場——承認集體利益與個人權利之間存在真實的張力，理想的政策應設法在兩者之間找到盡可能照顧所有人的平衡點。'}
    ]
  },
  {
    q:'你看恐怖片時，內心真的希望壞人快點死——這算暴力傾向嗎？',
    options:[
      {label:'算，願望本身說明問題', reveal:'aristotle', text:'這接近亞里斯多德對「意圖」的重視——我們內心的慾望與傾向，本身就是品格的一部分。'},
      {label:'不算，虛構和現實是兩回事', reveal:'nussbaum', text:'這接近納思邦對情感角色的分析——人類天生有能力在虛構情境中體驗強烈情緒，這是一種心理能力，而不是真正的暴力傾向。'},
      {label:'願望與行動之間還有判斷力這道關卡', reveal:'kant', text:'這接近康德的觀點——真正定義我們品格的，不是我們的慾望，而是我們是否願意讓理性原則來節制慾望。一個「正常人」與一個「有暴力傾向的人」的區別，不在於有沒有暴力願望，而在於如何對待這個願望。'}
    ]
  },
  {
    q:'假設你明天醒來，發現記憶全部消失，但你的身體、習慣、脾氣都還在——那個「你」，是原來的你嗎？',
    options:[
      {label:'是，身體和習慣定義了我', reveal:'aristotle', text:'這接近亞里斯多德的「功能論」——真正定義一個人的，是他的功能與行為模式，而非飄忽的記憶。'},
      {label:'不是，記憶構成了連續的「我」', reveal:'wittgenstein', text:'這接近維根斯坦對「私人語言」的批判——如果「我」這個概念只能透過記憶與語言建構，沒有記憶的「我」，根本不是原本的「我」。'},
      {label:'這取決於「同一個人」的判斷標準，沒有客觀答案', reveal:'skepticism', text:'這正是懷疑學派的立場——這個問題沒有確定答案，因為「人」的概念本身就充滿爭議。接受這種不確定性，比急於下一個結論更為明智。'}
    ]
  },
  {
    q:'你在公司茶水間聽到同事在說另一個同事的壞話，你沒加入，但也沒有離開——你覺得自己算沉默的共犯嗎？',
    options:[
      {label:'算，我在場就已經是某種許可', reveal:'arendt', text:'這呼應了鄂蘭對「平庸之惡」的分析——正是那些「沒有反對」的旁觀者，讓惡行得以在日常中蔓延，無需親手作惡，沉默本身就是一種參與。'},
      {label:'不算，我從來沒有贊同過', reveal:'laozi', text:'這接近老子「為而不爭」的態度——在場不等於認同，保持自己的清白是一種消極自由，並不需要為他人的言行承擔道德責任。'},
      {label:'說不定那個同事真有問題，先別急著下結論', reveal:'skepticism', text:'這接近懷疑學派的審慎態度——在真相未明之前，保留判斷是最安全的做法，無論是對被說壞話的人，還是對批評者。'}
    ]
  },
  {
    q:'你約了朋友吃飯，但這週特別累，很想取消——你會怎麼選？',
    options:[
      {label:'去赴約，朋友時間也很珍貴，累了就早點回家', reveal:'confucius', text:'這呼應了儒家的「誠信」觀——約定是一種人際責任，守信用比一時的便利更重要，取消傷害的不只是這次聚會，還有信任本身。'},
      {label:'取消，诚实告诉朋友我太累了', reveal:'sartre', text:'這接近沙特的存在主義——自由意味著為自己的選擇負全責，取消就是取消，不需要偽裝成別的理由，誠實的面對自己的狀態，也是一種負責。'},
      {label:'問問朋友能否改個時間，兩全其美', reveal:'pragmatism', text:'這接近實用主義的問題導向——理想與現實之間並非只有「全有或全無」的選擇，靈活調整往往能找到更好的解決方案，既照顧到自己，也對朋友負責。'}
    ]
  },
  {
    q:'網購時，你發現一個商品的评论区全是整齐划一的好评，但你直觉哪里怪怪的——你会怎么做？',
    options:[
      {label:'相信评论，下单试试看', reveal:'epicureanism', text:'這接近伊比鳩魯學派的實用傾向——在證據不足的情況下，選擇那個能讓自己最快獲得平靜的選項，多疑帶來的焦慮，有時比踩雷本身更浪費生命。'},
      {label:'不相信，這很可能是刷出來的', reveal:'skepticism', text:'這正是懷疑學派的方法——當正反兩面的證據都無法充分確定時，最理性的做法是懸置判斷，而不是急於下一個結論，尤其涉及消費決策時。'},
      {label:'多看幾個平台，交叉比對後再決定', reveal:'aristotle', text:'這接近亞里斯多德重視經驗觀察的方法——不盲目相信單一來源的資訊，而是透過多元觀察與比較，從具體證據中歸納出相對可靠的判斷。'}
    ]
  },
  {
    q:'你發現自己每天花兩個小時滑手機，但其實看完什麼都不記得——你會試圖改變嗎？',
    options:[
      {label:'會，我想把時間用在更值得的事情上', reveal:'aristotle', text:'這呼應了亞里斯多德對「良好生活」的主張——時間是美德實踐的載體，把時間浪費在無意義的刺激上，等於是在剝奪自己活出良好生活的可能。'},
      {label:'不會，這兩個小時本來也沒什麼用，滑手機起碼放鬆了', reveal:'epicureanism', text:'這接近伊比鳩魯學派的快樂計算——如果這兩個小時本來就無法用來做什麼更有價值的事，那麼它帶來的消遣與放鬆，本身就已經是它最大的價值了。'},
      {label:'有意識地限制時間，否則大腦會對碎片刺激上癮', reveal:'wittgenstein', text:'這接近維根斯坦對語言遊戲的分析——我們被設計成對多巴胺刺激上癮的生物，如果不有意識地設定界限，就會被演算法持續操控而不自知。'}
    ]
  },
  {
    q:'你養的植物快要死了，但你想搶救它需要每天花半小時照顧——你會堅持嗎？',
    options:[
      {label:'會，生命值得被搶救', reveal:'singer', text:'這呼應了辛格對生命價值的看法——生命本身的延續有其內在價值，不因為它只是一株植物，就否定它值得被認真對待的可能。'},
      {label:'不會，我已經盡力了', reveal:'stoicism', text:'這接近斯多葛的接受哲學——有些事物不在我們的控制範圍內，植物有自己的命運，承認這一點不是失敗，而是對現實的如實面對。'}
    ]
  },
  {
    q:'你在網上看到一个评论，说了某个公众人物的大实话但被骂得很惨，你会怎么做？',
    options:[
      {label:'點進去給那個評論點個讚，支持說真話的人', reveal:'socrates', text:'這呼應了蘇格拉底對真理的堅持——即便真相往往刺耳、即便說真話的代價是被大眾攻擊，追求真理本身的勇氣，本身就是美德。'},
      {label:'算了，不想惹事，划走', reveal:'confucius', text:'這接近儒家的「明哲保身」——在公共場合公開選邊站，不僅可能招來麻煩，也偏離了「修養自身」的優先順序，保守的做法有時是更明智的選擇。'},
      {label:'先獨立思考這個觀點本身對不對，再決定站哪邊', reveal:'skepticism', text:'這接近懷疑學派的方法——在大眾情緒高漲時，最危險的就是不加思索地跟風。在表態之前，先讓自己冷靜分析，這是對自己判斷力的負責。'}
    ]
  },
  {
    q:'你路過一個街友，身邊剛好有零錢——你會給嗎？',
    options:[
      {label:'會給，區區零錢，萬一能幫上忙呢', reveal:'singer', text:'這呼應了辛格的「全球正義」觀——即便是零錢這樣的小額資源，也是一個幫助他人的機會，袖手旁觀在道德上從來不是一個中性的選項。'},
      {label:'不會，我不知道這錢會被怎麼用', reveal:'nussbaum', text:'這接近納思邦對同情心的複雜分析——真正的善良需要判斷力而非單純的情緒反應，零錢給出去，不等於真正幫到了人，有時甚至造成反效果。'},
      {label:'與其直接給錢，不如找機會了解他的實際需求', reveal:'pragmatism', text:'這接近實用主義的問題導向——表面上的善意未必帶來實質幫助，真正有效的方式是了解對方的處境，盡可能將資源導向真正有用的地方。'}
    ]
  },
  {
    q:'你發現自己答應了兩個人同一段時間的聚會——兩邊都已經確認了那個時間——你怎麼辦？',
    options:[
      {label:'誠實告訴兩邊，重新約時間', reveal:'socrates', text:'這呼應了蘇格拉底的誠實原則——承認錯誤並及時修正，比用另一個謊言掩蓋這個謊言，更能保住自己的誠信。'},
      {label:'編個理由跟其中一方解釋，選那個覺得比較好說話的', reveal:'sophism', text:'這接近智者學派的實用智慧——根據情境靈活調整，避免衝突升級，是日常社交中的現實策略，並非所有的「不完全誠實」都是道德敗壞。'},
      {label:'先問兩邊能不能改時間，找出最佳解決方案', reveal:'confucius', text:'這接近儒家的「和」的概念——不是只考慮自己誠信與否，而是讓所有相關方都參與到解決過程中，尋找一個大家都能接受的結果。'}
    ]
  },
  {
    q:'你的父母總是說「我們是為你好」，但你覺得那不是你想要的好——你怎麼回應？',
    options:[
      {label:'耐心溝通，試著讓他們理解你真正想要的是什麼', reveal:'confucius', text:'這呼應了儒家「懇切的」的對話精神——子女的責任不只是服從，在尊重的前提下表達自己的真實想法，也是一種孝順的體現。'},
      {label:'陽奉陰違，表面應付，實際上還是照自己意思來', reveal:'diogenes', text:'這接近第歐根尼對社會常規的質疑——如果「為你好」只是一種控制的方式，那麼形式上的服從，與內心的獨立，並不矛盾。'},
      {label:'接受他們的好意，但最終選擇權仍在自己', reveal:'aristotle', text:'這接近亞里斯多德對中道的追求——既不徹底反抗父母的善意，也不放棄自己的判斷，在尊重與自主之間找到一個平衡點。'}
    ]
  },
  {
    q:'你買了一件很貴的衣服，穿了兩次就不想穿了——你會怎麼看待這筆消費？',
    options:[
      {label:'後悔，這錢可以花在更值得的地方', reveal:'stoicism', text:'這接近斯多葛的觀點——對已發生的事後悔是雙重損失，既浪費了金錢，又浪費了當下的心情，接受它作為一次經驗教訓，更符合心靈的平靜。'},
      {label:'不後悔，那兩次的快樂是真實的', reveal:'epicureanism', text:'這呼應了伊比鳩魯的快樂計算——如果購買時的期待與穿著時的快樂是真實的，那麼它就已經實現了它的價值，事後的懊悔不該用來否定過去的真實體驗。'},
      {label:'把這視為對自己喜好的一種投資，逐漸摸索出真正的審美', reveal:'aristotle', text:'這接近亞里斯多德對實踐智慧的重視——審美判斷力需要時間培養，失敗的購買本身是探索過程的一部分，關鍵是從中學習，而非停在後悔裡。'}
    ]
  },
  {
    q:'你在排队時發現有人插隊，你會出聲制止嗎？',
    options:[
      {label:'會，規矩就是規矩', reveal:'kant', text:'這呼應了康德的普遍性原則——如果每個人都可以為自己找理由插隊，那麼排隊這件事本身就無法成立，維護規則是一種理性的義務。'},
      {label:'不會，多一事不如少一事', reveal:'laozi', text:'這接近老子的「無為」——不是每一個不義都需要你去對抗，有時候放下，讓事情過去，也是一種保全自己、不擴大衝突的智慧。'},
      {label:'看情況，如果是老人或許可以理解，但年輕人就必須說', reveal:'confucius', text:'這接近儒家的「禮」的概念——不同的身份、情境有各自合宜的行為規範，社會和諧建立在每個人履行各自角色的期待上。'}
    ]
  },
  {
    q:'你失戀了，想找人傾訴，但朋友正好在忙——你會等，還是找另一個人？',
    options:[
      {label:'等，那個人比較重要，我想跟他說', reveal:'confucius', text:'這呼應了儒家對關係厚薄的重視——不是每個人都能承接同樣的情感分量，選擇那個最親近的人，也是一種對關係的尊重。'},
      {label:'找別人，我現在就需要有人聽我說', reveal:'aristotle', text:'這接近亞里斯多德對情感宣洩的看法——情感需要出口，等待本身可能讓情緒累積過高，找到一個能傾聽的對象，比等待誰來更重要。'},
      {label:'寫下來，有時候文字比說出來更能整理思緒', reveal:'buddha', text:'這呼應了佛教對內觀的強調——有時候最強大的療癒來自於向內看，而非向外尋求他人的認可，把情緒寫下來本身就是一種覺察的練習。'}
    ]
  },
  {
    q:'你養的寵物需要昂貴的手術，你猶豫是否值得——你會怎麼想？',
    options:[
      {label:'值得，生命不能用金錢衡量', reveal:'singer', text:'這呼應了辛格對生命的尊重——如果我們承認動物的痛苦有意義，那麼為它付出資源來減輕痛苦，在道德上並不比為人類付出更低等。'},
      {label:'不值得，這個錢可以用來幫助更多人', reveal:'singer', text:'這其實也是辛格的觀點——從效益最大化的角度，同樣的資源或許能救濟更多飢餓的人，寵物與陌生人的生命，在道德計算上有著不同的權重。'},
      {label:'與其讓牠受苦，不如讓牠平靜地離開', reveal:'stoicism', text:'這接近斯多葛對死亡的理解——生命的意義不在於長短，而在於是否活得合乎美德。當生命已成為痛苦的延續，讓摯愛有尊嚴地離開，也是一種愛的表現。'}
    ]
  },
  {
    q:'你參加一個聚會，大部分時間都在聽別人說話，你沒有太多機會插嘴——你覺得浪費時間嗎？',
    options:[
      {label:'不浪費，傾聽也是一種參與', reveal:'aristotle', text:'這呼應了亞里斯多德對「沉默」的重視——有時觀察與聆聽，比急於表達更能獲得智慧，社交的價值不只在於發聲。'},
      {label:'有點浪費，我想認識新朋友', reveal:'sophism', text:'這接近智者學派對交際效益的計算——社交的時間是有限的，如果沒有實際收益，不如把時間用在更有效率的地方。'},
      {label:'這正好觀察每個人的性格與為人，是很好的學習機會', reveal:'confucius', text:'這接近儒家的「觀人之學」——在群體中觀察每個人的言行，往往比參與討論更能了解一個人的本質，也是一種自我修養的訓練。'}
    ]
  },
  {
    q:'你發現自己每次和某個人聊天都會變得很消極——你會逐漸疏遠他嗎？',
    options:[
      {label:'會，我不想讓別人的負能量影響自己', reveal:'epicureanism', text:'這呼應了伊比鳩魯對心靈寧靜的維護——遠離那些讓你焦慮不安的人，是保護自己精神健康的合理選擇。'},
      {label:'不會，朋友有困難我應該陪伴', reveal:'confucius', text:'這呼應了儒家的忠恕之道——朋友的意義，正在於彼此扶持的時候，陪伴本身就是一種義氣。'},
      {label:'設定邊界，適度往來而非完全斷絕', reveal:'aristotle', text:'這接近亞里斯多德對友誼種類的區分——並非所有關係都需要同樣的深度，根據雙方對彼此的實質影響，調整往來的頻率與方式，是一種明智的平衡。'}
    ]
  },
  {
    q:'你在網上看到一個很荒謬的言論，一查發現說這話的人學歷很高——你會怎麼想？',
    options:[
      {label:'学历高不代表说的都对', reveal:'skepticism', text:'這正是懷疑學派的核心——專家意見並不自動等於真理，學術頭銜只是一種專業領域的認證，不是全領域的通行證。'},
      {label:'或許我理解錯了，再看看', reveal:'socrates', text:'這呼應了蘇格拉底的無知之知——越是面對權威，越需要檢視自己是否有可能誤解了對方的意思，真正的智慧往往從承認自己可能錯了開始。'}
    ]
  },
  {
    q:'你发现自己越来越不想看新闻了，因为每次看都很焦虑——这是一种逃避吗？',
    options:[
      {label:'不是，我只是在保护自己的心理健康', reveal:'epicureanism', text:'這呼應了伊比鳩魯的快樂計算——持續浸泡在負面資訊中，對於改變現實毫無幫助，卻實實在在地損害自己的身心健康，選擇不看是一種理性。'},
      {label:'是，我不应该和社会脱节', reveal:'aristotle', text:'這呼應了亞里斯多德對公民參與的重視——人是政治的動物，關心公共事務、與社會保持連結，本身就是良好生活的一部分。'},
      {label:'適度關注就好，深度報導交給專業的人去做', reveal:'pragmatism', text:'這接近實用主義的分工思維——普通人不可能也沒必要對所有事務都深度參與，相信系統中的專業分工，把精力放在自己真正能發揮影響力的領域，更有效率。'}
    ]
  }
];
let philoIndex = 0;

function openPhilo(){
  philoIndex = Math.floor(Math.random() * PHILO_DILEMMAS.length);
  renderPhilo();
  document.getElementById('philoOverlay').classList.add('open');
}
function closePhilo(){
  document.getElementById('philoOverlay').classList.remove('open');
}

// 書信功能
function openLetter(){
  renderLetterHistory();
  document.getElementById('letterOverlay').classList.add('open');
}

function closeLetter(){
  document.getElementById('letterOverlay').classList.remove('open');
}

function submitLetter(){
  const input = document.getElementById('letterInput');
  const text = input.value.trim();
  if(!text) return;

  const letter = {
    text,
    phase: getCompanionPhase(),
    timestamp: Date.now()
  };

  companionData.letters.push(letter);
  saveCompanionData();

  input.value = '';
  document.getElementById('letterCount').textContent = '0';

  renderLetterHistory();

  // 讓影子知道這封信
  shadowNoticeLetter(letter);
}

function renderLetterHistory(){
  const container = document.getElementById('letterHistory');
  if(companionData.letters.length === 0){
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="letter-history-title">寫下的話</div>
    ${companionData.letters.slice().reverse().slice(0, 5).map(l => `
      <div class="letter-item">
        ${l.text}
        <div class="letter-item-meta">Phase ${l.phase}</div>
      </div>
    `).join('')}
  `;
}

// 影子察覺到信的存在
function shadowNoticeLetter(letter){
  const messages = {
    question: ['……', '收到了。', '嗯。'],
    wish: ['……', '收到了。', '嗯。'],
    other: ['……', '收到了。', '嗯。']
  };
  const pool = messages[letter.type] || messages.other;
  const msg = pool[Math.floor(Math.random() * pool.length)];

  // 靜默地存在，不需要彈出 toast
  // 影子只是在心裡記住了
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('letterInput');
  if(input){
    input.addEventListener('input', () => {
      document.getElementById('letterCount').textContent = input.value.length;
    });
  }
});
function renderPhilo(){
  const d = PHILO_DILEMMAS[philoIndex];
  document.getElementById('philoContent').innerHTML = `
    <p class="philo-question">${d.q}</p>
    <div class="philo-options">
      ${d.options.map((o,i)=>`<button class="philo-opt-btn" onclick="choosePhilo(${i})">${o.label}</button>`).join('')}
    </div>
  `;
}
function choosePhilo(i){
  const d = PHILO_DILEMMAS[philoIndex];
  const o = d.options[i];
  const person = byId[o.reveal];

  // 記錄哲學選擇到 Companion Shadow
  if (o.reveal) {
    recordPhiloChoice(o.reveal);
    // 觸發 Shadow 共鳴發光效果
    triggerShadowGlow();
  }

  document.getElementById('philoContent').innerHTML = `
    <p class="philo-question philo-question-dim">${d.q}</p>
    <div class="philo-reveal">
      <p class="philo-reveal-label">你的選擇，呼應了——</p>
      <p class="philo-reveal-name">${person ? person.zh : ''}</p>
      <p class="philo-reveal-text">${o.text}</p>
      <div class="philo-reveal-actions">
        ${person ? `<button class="philo-jump-btn" onclick="closePhilo(); jumpToNode('${o.reveal}');">前往認識 ${person.zh} →</button>` : ''}
        <button class="philo-next-btn" onclick="nextPhilo()">下一題 →</button>
      </div>
    </div>
  `;
}
function nextPhilo(){
  philoIndex = (philoIndex + 1) % PHILO_DILEMMAS.length;
  renderPhilo();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 導航與故事 (Navigation & Story)
 * Lines: ~2007-2100
 *
 * 節點跳轉、圖例切換、故事面板渲染
 *
 * 主要函數：
 *   - jumpToNode(id)        滾動並選中節點
 *   - toggleLegend()        展開/折疊分支圖例
 *   - jumpTo(gen)           跳轉到分支頂部
 *   - toggleStory(id)       切換故事面板顯示
 *   - renderStoryBox()      渲染故事內容
 *   - fillMedallion(node)   填充圖章詳細資訊
 *
 * 依賴：byId, DATA, selectNode(), renderDetail()
 *
 * 相關：tree.js §樹狀渲染（selectNode 會觸發 markVisited）
 * ═══════════════════════════════════════════════════════════════════════════════ */
function jumpToNode(id){
  const el = document.getElementById('node-'+id);
  if(el) el.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
  selectNode(id);
}

function toggleHeaderMenu(){
  const rope = document.getElementById('headerRope');
  const btn = document.getElementById('headerMoreBtn');
  const isOpen = rope.classList.toggle('open');

  if(isOpen){
    // 生成绳子上的按钮
    const items = [
      { icon: '🔍', label: '搜尋', action: 'openSearch()', anim: 'search' },
      { icon: '🌌', label: '意識地圖', action: 'openMindMap()', anim: 'stars' },
      { icon: '⏳', label: '塵封軼聞', action: 'openEggWall()', anim: 'egg' },
      { icon: '🥚', label: '時間軸', action: 'openTimeline()', anim: 'hourglass' },
      { icon: '🎭', label: '你的抉擇', action: 'openPhilo()', anim: 'mask' },
      { icon: '✉️', label: '書寫', action: 'openLetter()', anim: 'ink' },
      { icon: '✦', action: 'toggleMirrorEffect()', subtle: true, anim: 'sparkle' },
    ];

    rope.innerHTML = items.map((item, i) => `
      <div class="rope-segment" style="--delay:${i * 60}ms">
        ${i > 0 ? '<div class="rope-line"></div>' : ''}
        <button class="egg-toggle rope-bead ${item.subtle ? 'rope-bead-subtle' : ''}" onclick="${item.action}">
          <span class="rope-icon ${item.anim ? 'rope-icon-' + item.anim : ''}">
            ${item.doubleIcon ? item.icon + item.doubleIcon : item.icon}
          </span>
          ${item.label ? '<span class="rope-label">'+item.label+'</span>' : ''}
        </button>
      </div>
    `).join('');
  }
  btn.classList.toggle('open');
  burstKeyholeParticles();
}

// Keyhole 微小星星迸發特效 - 煙花效果
function burstKeyholeParticles(){
  const container = document.getElementById('keyholeParticles');
  if(!container) return;

  // 清除舊粒子
  container.innerHTML = '';

  // 生成 12-16 個粒子，像煙花一樣
  const count = 12 + Math.floor(Math.random() * 5);

  for(let i = 0; i < count; i++){
    const p = document.createElement('div');
    const isSparkle = Math.random() < 0.4; // 40% 白光閃爍
    const isLarge = Math.random() < 0.2; // 20% 大粒子

    // 煙花效果：向上偏斜的隨機方向，射程更遠
    const baseAngle = (Math.PI * 2 / count) * i;
    const angleJitter = (Math.random() - 0.5) * 0.8; // 更大的角度散射
    const angle = baseAngle + angleJitter - Math.PI * 0.6; // 向上偏移

    // 射程 40-80px，像煙花一樣
    const distance = 40 + Math.random() * 45;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    p.className = 'keyhole-particle' + (isSparkle ? ' sparkle' : '') + (isLarge ? ' large' : '');
    p.style.setProperty('--tx', tx + 'px');
    p.style.setProperty('--ty', ty + 'px');
    p.style.setProperty('--size', isLarge ? '3px' : '2px');
    p.style.animationDelay = (Math.random() * 80) + 'ms';
    p.style.animationDuration = (0.6 + Math.random() * 0.4) + 's';

    container.appendChild(p);
  }

  // 動畫結束後清理
  setTimeout(() => {
    container.innerHTML = '';
  }, 1200);
}

// 在 toggleHeaderMenu 中調用

const LEGEND_COLLAPSE_KEY = 'greekMythTree_legendCollapsed_v1';
function toggleLegend(){
  const legend = document.getElementById('legend');
  const arrow = document.getElementById('legendToggleArrow');
  const label = document.getElementById('legendToggleLabel');
  const isCollapsed = legend.classList.toggle('collapsed');
  arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  label.textContent = isCollapsed ? '展開分支導覽 Expand' : '收起分支導覽 Collapse';
  try{ localStorage.setItem(LEGEND_COLLAPSE_KEY, isCollapsed ? '1' : '0'); }catch(e){}
}
(function initLegendState(){
  let collapsed = false;
  try{ collapsed = localStorage.getItem(LEGEND_COLLAPSE_KEY) === '1'; }catch(e){}
  if(collapsed){
    const legend = document.getElementById('legend');
    const arrow = document.getElementById('legendToggleArrow');
    const label = document.getElementById('legendToggleLabel');
    if(legend) legend.classList.add('collapsed');
    if(arrow) arrow.style.transform = 'rotate(-90deg)';
    if(label) label.textContent = '展開分支導覽 Expand';
  }
})();

function jumpTo(gen){
  document.getElementById('sec-'+gen).scrollIntoView({behavior:'smooth', block:'start'});
}

let storyOpenId = null;
let storyParaIndex = 0;
let storyShowAll = false;

function toggleStory(id){
  const box = document.getElementById('fullStoryBox');
  const btn = document.getElementById('storyToggleBtn');
  if(storyOpenId === id){
    box.style.display = 'none';
    box.innerHTML = '';
    btn.textContent = '📜 閱讀完整神話故事';
    storyOpenId = null;
    return;
  }
  storyOpenId = id;
  storyParaIndex = 0;
  storyShowAll = false;
  btn.textContent = '📜 收起故事';
  box.style.display = 'block';
  renderStoryBox();
  box.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function renderStoryBox(){
  const box = document.getElementById('fullStoryBox');
  if(!box || !storyOpenId) return;
  const d = byId[storyOpenId];
  const paras = d.fullStory || [];

  if(storyShowAll){
    box.innerHTML = paras.map(p=>`<p>${p}</p>`).join('') +
      `<button class="story-mode-toggle" onclick="storyShowAll=false; storyParaIndex=0; renderStoryBox();">↩ 改成一段一段看</button>`;
    return;
  }

  const dots = paras.map((_,i)=>`<span class="story-dot ${i===storyParaIndex?'active':''}"></span>`).join('');
  box.innerHTML = `
    <p>${paras[storyParaIndex]}</p>
    <div class="story-nav">
      <button class="story-nav-btn" onclick="storyParaIndex=Math.max(0,storyParaIndex-1); playPageSound('prev'); renderStoryBox();" ${storyParaIndex===0?'disabled':''}>← 上一段</button>
      <div class="story-dots">${dots}</div>
      <button class="story-nav-btn" onclick="storyParaIndex=Math.min(${paras.length-1},storyParaIndex+1); playPageSound('next'); renderStoryBox();" ${storyParaIndex===paras.length-1?'disabled':''}>下一段 →</button>
    </div>
    <button class="story-mode-toggle" onclick="storyShowAll=true; renderStoryBox();">顯示全部段落</button>
  `;
}

function fillMedallion(node){
  const m = node.querySelector('.medallion[data-cid]');
  if(!m) return;
  const id = m.getAttribute('data-cid');
  m.innerHTML = generateConstellationSVG(id, 64);
  m.removeAttribute('data-cid');
}

function setupRevealObserver(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.querySelectorAll('.node').forEach(n=>{ n.classList.add('revealed'); fillMedallion(n); });
    return;
  }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('revealed');
        fillMedallion(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, {threshold:0.15, rootMargin:'200px 0px 200px 0px'});
  document.querySelectorAll('.node').forEach(n=>io.observe(n));
}

const GEN_META = [
  {id:'primordial', label:'創世 · 原初神', color:'#3B2E42'},
  {id:'titan', label:'泰坦神族', color:'#6B4A2F'},
  {id:'olympian', label:'奧林帕斯神族', color:'#1F4959'},
  {id:'hero', label:'凡人與命運', color:'#B5502E'},
  {id:'nature', label:'自然精靈與山林諸神', color:'#4B6B3A'},
  {id:'zodiac', label:'黃道十二宮', color:'#3D3A6B'},
  {id:'troy', label:'特洛伊戰爭與奧德賽', color:'#6B2E3A'},
  {id:'mythconcepts', label:'神話衍生的現代概念', color:'#8A6D1F'},
  {id:'philosophy', label:'古典哲學', color:'#5B5850'},
  {id:'modernphil', label:'現代哲學', color:'#43575C'},
  {id:'psychology', label:'現代心理學', color:'#6B3F6B'},
  {id:'arts', label:'藝術與文學的回聲', color:'#8A4A5C'},
  {id:'crosscultural', label:'跨文化連結', color:'#9C6B3E'},
];

// Random loading text
const loadingMessages = [
  { zh: '未能逃逸...', en: 'Failing to escape...' },
  { zh: '事件視界之內...', en: 'Inside the event horizon...' },
  { zh: '引力捕獲中...', en: 'Captured by gravity...' },
  { zh: '它認識你...', en: 'It knows you...' },
  { zh: '你不是一個人...', en: 'You are not alone...' },
  { zh: '陰影從未離去...', en: 'The shadow never leaves...' },
  { zh: '誰在跟隨你...', en: 'Who follows you...' },
  { zh: '你的足跡，它都看見了...', en: 'It has seen all your footsteps...' },
  { zh: '記錄正在建立...', en: 'Building a record...' }
];
const randomMsg = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
const loadingZh = document.querySelector('.loading-zh');
const loadingEn = document.querySelector('.loading-en');
if(loadingZh) loadingZh.textContent = randomMsg.zh;
if(loadingEn) loadingEn.textContent = randomMsg.en;

renderNodes();
renderCompanionShadow(); // Initialize companion shadow on load

// Hide loading overlay after content is rendered (minimum 1.2s display)
const loadingOverlay = document.getElementById('loadingOverlay');
if(loadingOverlay){
  setTimeout(() => {
    loadingOverlay.classList.add('hidden');
    setTimeout(() => loadingOverlay.remove(), 800);
  }, 1200);
}

// If user has existing exploration history, load it into companion
if(visited.size >= 3){
  visited.forEach(id => {
    if(!companionData.visited.has(id)){
      companionData.visited.add(id);
      const d = byId[id];
      if(d) companionData.genDistribution[d.gen] = (companionData.genDistribution[d.gen] || 0) + 1;
    }
  });
  renderCompanionShadow();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 開發者調試面板 (Companion Tuner - Dev Only)
 * Lines: ~2211-2300
 *
 * 按 Ctrl+Shift+T 打開影子參數調整面板（僅開發環境使用）
 *
 * 主要函數：
 *   - tuneCompanion()      調整影子參數
 *   - resetCompanionTuner() 重置所有參數
 *   - copyCompanionValues() 導出當前參數為 JSON
 *
 * 面板功能：
 *   - 視覺參數：頭部大小、身體寬度、模糊程度等
 *   - 互動效果：害羞概率、測試按鈕
 *
 * 注意：用戶端不暴露此功能
 * ═══════════════════════════════════════════════════════════════════════════════ */
// 按 Ctrl+Shift+T 打开调试面板
document.addEventListener('keydown', (e) => {
  if(e.ctrlKey && e.shiftKey && e.key === 'T'){
    e.preventDefault();
    document.getElementById('compTuner').classList.toggle('open');
  }
  if(e.key === 'Escape'){
    document.getElementById('compTuner').classList.remove('open');
  }
});

const COMPANION_DEFAULTS = {
  headRx: 8,
  neckRx: 12,
  shoulderRx: 14,
  bodyRx: 18,
  edgeRx: 8,
  haloOpac: 12,
  brightness: 13,
  blur: 11,
  top: 50,
  bodyLen: 61,
  width: 100
};

function tuneCompanion(prop, value){
  const shadow = document.getElementById('companionShadow');
  const form = document.getElementById('companionForm');
  if(!shadow || !form) return;

  const displayVal = document.getElementById('tune' + prop.charAt(0).toUpperCase() + prop.slice(1));
  if(displayVal) displayVal.textContent = value;

  switch(prop){
    case 'headRx':
      form.querySelectorAll('.comp-head').forEach(el => {
        el.setAttribute('rx', value);
        el.setAttribute('ry', Math.round(value * 1.15));
      });
      break;
    case 'neckRx':
      form.querySelectorAll('.comp-neck').forEach(el => {
        el.setAttribute('rx', value);
        el.setAttribute('ry', Math.round(value * 0.8));
      });
      break;
    case 'shoulderRx':
      form.querySelectorAll('.comp-shoulder').forEach(el => {
        el.setAttribute('rx', value);
        el.setAttribute('ry', Math.round(value * 0.75));
      });
      break;
    case 'bodyRx':
      form.querySelectorAll('.comp-body').forEach(el => {
        el.setAttribute('rx', value);
      });
      break;
    case 'edgeRx':
      form.querySelectorAll('.comp-edge').forEach(el => {
        el.setAttribute('rx', value * 0.6);
        el.setAttribute('ry', value * 1.4);
      });
      break;
    case 'haloOpac':
      const haloOpac = (value / 100).toFixed(2);
      form.querySelectorAll('.comp-halo ellipse').forEach(el => {
        el.style.fill = `rgba(200, 195, 220, ${haloOpac})`;
      });
      break;
    case 'brightness':
      const bright = Math.round(155 + value * 1.8);
      const opac = (value / 100).toFixed(2);
      form.querySelectorAll('.comp-core ellipse').forEach(el => {
        el.style.fill = `rgba(${bright}, ${bright - 5}, ${bright + 20}, ${opac})`;
      });
      break;
    case 'blur':
      document.getElementById('mistBlur').setAttribute('stdDeviation', value);
      document.getElementById('mistBlurLight').setAttribute('stdDeviation', value + 2);
      break;
    case 'top':
      shadow.style.top = value + 'vh';
      break;
    case 'bodyLen':
      const newLen = parseInt(value);
      // 身体椭圆
      form.querySelectorAll('.comp-body').forEach((el, i) => {
        const ratio = i / 5;
        const newCy = Math.round(75 + newLen * ratio);
        el.setAttribute('cy', newCy);
      });
      // 边缘雾气跟着身体走
      form.querySelectorAll('.comp-edge').forEach((el, i) => {
        const baseCy = [68, 70, 95, 97, 118, 120, 140, 142];
        const baseLen = 80; // 原来的基准长度
        const ratio = (baseCy[i] - 68) / (142 - 68);
        const newCy = Math.round(68 + newLen * ratio);
        el.setAttribute('cy', newCy);
      });
      // 外层光晕跟着身体走
      form.querySelectorAll('.comp-halo ellipse').forEach((el, i) => {
        const baseCy = [42, 78, 112, 145, 64, 66, 105, 107, 138, 140];
        const baseLen = 80;
        const ratio = i < 4 ? i / 3 : i < 6 ? (i - 4) / 2 : 0.5 + (i - 6) / 8;
        const newCy = Math.round(baseCy[i] * (newLen / baseLen));
        el.setAttribute('cy', Math.round(newCy));
      });
      break;
    case 'width':
      shadow.style.width = value + 'px';
      break;
  }
}

function resetCompanionTuner(){
  Object.entries(COMPANION_DEFAULTS).forEach(([key, val]) => {
    tuneCompanion(key, val);
  });
  // Reset slider displays
  Object.keys(COMPANION_DEFAULTS).forEach(key => {
    const el = document.getElementById('tune' + key.charAt(0).toUpperCase() + key.slice(1));
    if(el) el.textContent = COMPANION_DEFAULTS[key];
  });
  // Reset sliders
  document.querySelectorAll('.comp-tuner-row input').forEach((input, i) => {
    input.value = Object.values(COMPANION_DEFAULTS)[i];
  });
  // Reset width
  document.getElementById('companionShadow').style.width = '100px';
}

function copyCompanionValues(){
  const values = {};
  document.querySelectorAll('.comp-tuner-row input').forEach((input, i) => {
    const label = input.closest('.comp-tuner-row').querySelector('label').textContent;
    values[label] = input.value;
  });
  const text = JSON.stringify(values, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.comp-tuner-copy');
    btn.textContent = '已复制!';
    setTimeout(() => btn.textContent = '复制数值', 1500);
  });
}

// Dev helper: run in console to open tuner
window.openCompanionTuner = () => {
  document.getElementById('compTuner').classList.add('open');
};
function setupHeaderAnimPause(){
  const h1 = document.querySelector('header h1');
  if(!h1 || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      h1.classList.toggle('anim-paused', !entry.isIntersecting);
    });
  }, {threshold:0});
  io.observe(h1);
}

setupRevealObserver();
setupHeaderAnimPause();
(function initSoundButton(){
  const btn = document.getElementById('soundToggle');
  if(btn){
    btn.textContent = soundOn ? '🔊' : '🔇';
    btn.classList.toggle('muted', !soundOn);
  }
})();
(function showSoundHintOnce(){
  const hint = document.getElementById('soundHint');
  if(!hint) return;
  let shown = false;
  const show = ()=>{
    if(shown) return;
    shown = true;
    hint.classList.add('show');
    setTimeout(()=> hint.classList.remove('show'), 3000);
  };
  let scrolled = false;
  window.addEventListener('scroll', ()=>{
    if(scrolled) return;
    if(window.scrollY > 200){ scrolled = true; show(); }
  }, {once:true, passive:true});
})();
window.addEventListener('load', ()=>{
  drawConnections();
  setTimeout(drawConnections, 150);
});

// drawConnections rebuilds every edge (getBoundingClientRect × 2 per edge) — with 148 nodes
// that's expensive, and scroll/resize can fire dozens of times per second on touch devices.
// Throttle to at most once per animation frame so scrolling stays smooth.
let drawConnectionsRafPending = false;
function requestDrawConnections(){
  if(drawConnectionsRafPending) return;
  drawConnectionsRafPending = true;
  requestAnimationFrame(()=>{
    drawConnections();
    drawConnectionsRafPending = false;
  });
}
window.addEventListener('resize', requestDrawConnections);
document.getElementById('treeWrap').addEventListener('scroll', requestDrawConnections, {passive:true});
if(document.fonts && document.fonts.ready){
  document.fonts.ready.then(drawConnections);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 塵封軼聞（彩蛋牆）(Easter Egg Wall)
 * Lines: ~2429-2670
 *
 * 「塵封軼聞」是隱藏在節點故事中的冷知識，需滑鼠拖曳「擦灰塵」揭曉
 *
 * 主要數據：
 *   - EASTER_EGGS[]    彩蛋池（共 96 條，格式 {icon, text}')
 *   - EGG_NODE_MAP     彩蛋與節點的對應關係（85 條有標記）
 *
 * 主要函數：
 *   - initEggDraw()         初始化抽卡系統
 *   - drawEggCard()         抽取一張隨機卡片
 *   - addToRevealedList()   加入已揭曉列表
 *   - viewRevealedEgg()     查看已揭曉的卡
 *   - openEggWall()         打開抽卡介面
 *   - closeEggWall()        關閉抽卡介面
 *
 * 彩蛋觸發條件：
 *   - 點擊抽卡：隨機揭曉一張未揭曉的卡片
 *   - 一鍵揭曉：一次揭曉所有剩餘卡片
 *
 * 全收集獎勵：96/96 全部發現觸發專屬提示
 *
 * 依賴：companion.js（記錄已揭曉狀態）
 * ═══════════════════════════════════════════════════════════════════════════════ */
const EASTER_EGGS = [
  {icon:'🪐', text:'土星真的有一顆衛星叫「潘」——就卡在土星環的一道縫隙裡。'},
  {icon:'☄️', text:'小行星「伊卡洛斯」的軌道會週期性飛到離太陽超近的地方，跟神話一模一樣。'},
  {icon:'🌑', text:'月球上有一座「柏拉圖坑」，隔壁不遠處就是「亞里斯多德坑」，師生倆至今仍是鄰居。'},
  {icon:'🚀', text:'NASA真的發射了一艘叫「普緒克號」的探測船，去找一顆幾乎全是金屬的小行星。'},
  {icon:'🌫️', text:'「Panic」（恐慌）這個英文字，就是直接從牧神「潘」的名字來的。'},
  {icon:'🧪', text:'化學元素「鉭」用坦塔羅斯命名——因為它泡在強酸裡都不會被腐蝕，怎樣都「傷不了」它。'},
  {icon:'🌟', text:'科學家曾正經提出：太陽可能有一顆看不見的伴星，還把它取名叫「涅墨西斯」（死對頭）。'},
  {icon:'🛰️', text:'1960年代NASA的通訊衛星取名「Echo」——因為它跟神話裡的厄科一樣，只能反射訊號、不能主動發聲。'},
  {icon:'🌕', text:'冥王星有一顆衛星叫「倪克斯」，安靜地繞著冥界之王轉。'},
  {icon:'🪨', text:'土星最大的衛星就叫「泰坦」——整個泰坦神族幾乎承包了土星的衛星命名。'},
  {icon:'👁️', text:'水瓶座裡有個星雲被暱稱為「上帝之眼」，因為它長得真的很像一隻眼睛在看你。'},
  {icon:'🕳️', text:'銀河系中心那個超大質量黑洞，就叫「人馬座A*」。'},
  {icon:'☀️', text:'希臘七賢之首泰勒斯，兩千六百年前就準確預言了一次日食，還讓兩國因此當場停戰。'},
  {icon:'🌌', text:'雙魚座現在才是春分點真正的位置——地球自轉軸的「歲差」，把它從白羊座慢慢挪過去了。'},
  {icon:'🦂', text:'天蠍座和獵戶座永遠不會同時出現在夜空——神話裡，獵人俄里翁至今仍在躲避那隻蠍子。'},
  {icon:'🌠', text:'每年八月的英仙座流星雨，輻射點正好就在——追殺蛇髮女妖梅杜莎的英雄柏修斯的星座裡。'},
  {icon:'🧊', text:'佛洛伊德說意識只是冰山一角——這個比喻後來被畫進了無數教科書。'},
  {icon:'🎭', text:'尼采的「上帝已死」常被誤解成慶祝的宣言，其實他是在憂心忡忡地發出警告。'},
  {icon:'👁️', text:'傅柯說的「圓形監獄」，靈感來自十八世紀一種真實存在的監獄建築設計。'},
  {icon:'🎁', text:'羅爾斯設計了一個思想實驗：如果投胎前不知道自己會是誰，你會希望社會怎麼運作？'},
  {icon:'🌐', text:'宙斯、印度的提烏斯神、北歐的提爾，名字其實共享同一個史前語言詞根。'},
  {icon:'🏛️', text:'蘇格拉底和孔子幾乎活在同一個時代，卻完全不知道彼此的存在。'},
  {icon:'🏺', text:'塞拉皮斯這位神，是被一位國王親自下令「設計」出來的，不是自然演變的信仰。'},
  {icon:'🍎', text:'彼得·辛格用一個溺水兒童的假設問題，逼你直視自己捐款時的雙重標準。'},
  {icon:'♑', text:'地球的「南迴歸線」（Tropic of Capricorn）之所以叫這個名字，是因為古代冬至太陽曾一度運行到摩羯座的範圍內。'},
  {icon:'🌋', text:'金星表面最大的高地地形，就叫「阿芙蘿黛蒂高地」。'},
  {icon:'♅', text:'天王星是太陽系八大行星中，唯一保留希臘語名稱、而非羅馬名稱的行星。'},
  {icon:'🐴', text:'「半人馬」在天文學上真的是一整類小天體的名字，第一顆被發現的甚至直接叫「凱隆」。'},
  {icon:'🌊', text:'「在斯庫拉與卡律布狄斯之間」（進退兩難）這句成語，直接來自奧德修斯必須抉擇的那道海峽。'},
  {icon:'☿️', text:'水星是太陽系裡跑最快的行星——剛好呼應祂的名字荷米斯，本來就是神界的飛毛腿信使。'},
  {icon:'🏝️', text:'土星有一顆衛星叫「卡呂普索」，恰好呼應神話裡那位把奧德修斯困住七年的島嶼仙女。'},
  {icon:'🌌', text:'伊比鳩魯在兩千三百年前，就大膽提出宇宙中存在無數個世界——比人類發現系外行星早了兩千多年。'},
  {icon:'🪜', text:'維根斯坦說，讀完他的書之後，應該把整本書當成一把梯子，爬上去之後就該踢開。'},
  {icon:'⚗️', text:'牛頓晚年其實花了大量時間鑽研煉金術文獻，其中不少正是託名「赫米斯」所寫的祕傳文獻。'},
  {icon:'💍', text:'沙特和波伏娃維持了長達五十年、拒絕傳統婚姻形式的開放式伴侶關係，最終還被合葬在同一座墓裡。'},
  {icon:'🌙', text:'月球上有一座「希帕提亞坑」，紀念這位在亞歷山大城被暴民殺害的女哲學家。'},
  {icon:'📖', text:'維根斯坦晚年最重要的著作，是靠他的學生安斯庫姆親自翻譯成英文，才得以流傳於世。'},
  {icon:'✍️', text:'瑪麗・沃斯通克拉夫特的女兒，就是寫出《科學怪人》的瑪麗・雪萊。'},
  {icon:'⚖️', text:'納思邦提出的「能力取徑」，後來真的被聯合國拿去設計「人類發展指數」。'},
  {icon:'🐺', text:'北歐戰神提爾和宙斯一樣，都在自己的神系裡被更年輕的神奪走了風頭——一個被奧丁取代，一個被因陀羅取代。'},
  {icon:'🦋', text:'莊子「莊周夢蝶」探討的問題，跟兩千多年後貝克萊提出的「存在即是被感知」如出一轍。'},
  {icon:'🎭', text:'維根斯坦說，哲學不是一套理論，而是一種活動。'},
  {icon:'🕯️', text:'瑣羅亞斯德教「善思、善言、善行」的教義，據信間接影響了後來猶太教與基督教對善惡的想像。'},
  {icon:'🌊', text:'赫拉克利特斯說，人不能兩次踏入同一條河流——因為河水一直在流動，你也一直在改變。'},
  {icon:'🎋', text:'王陽明「格竹」格到生病，這場失敗的實驗，反而成了他日後「心即理」思想的起點。'},
  {icon:'🌳', text:'斯里蘭卡有一棵佛陀證悟時那株菩提樹的分枝後代，種於西元前288年，是全世界有明確種植紀錄、至今仍存活的最古老的一棵樹。'},
  {icon:'🐔', text:'柏拉圖把人定義成「沒有羽毛的兩條腿動物」，第歐根尼聽了直接拔光一隻雞的毛，扔進他的學院說：「這就是柏拉圖說的人！」'},
  {icon:'🪣', text:'第歐根尼原本擁有的財產，只剩一個木碗——直到他看見一個小孩直接用手捧水喝，當場就把碗也扔了。'},
  {icon:'☔', text:'蘇格拉底的妻子贊西佩以脾氣暴躁出名，據說有次朝他潑了一盆水，蘇格拉底只淡淡回了一句：「打雷之後，常常下雨。」'},
  {icon:'🥁', text:'莊子的妻子過世時，朋友惠施前去弔唁，卻發現莊子正一邊敲著瓦盆一邊唱歌——他說，生死不過是像四季更替一樣自然的變化。'},
  {icon:'🫘', text:'畢達哥拉斯學派有一條最出名、也最詭異的戒律：絕對不能吃豆子——兩千多年來，沒人真正搞清楚原因。'},
  {icon:'⚡', text:'斯多葛學派創始人芝諾曾抓到一個偷東西的奴隸，奴隸辯解說「命中注定我要偷」，芝諾回他：「那命中也注定你要挨打。」'},
  {icon:'🔥', text:'維根斯坦有一次跟哲學家波普爾激烈爭論，據說氣得揮舞壁爐撥火棍——這場「撥火棍事件」後來成了二十世紀哲學史上最出名的八卦之一。'},
  {icon:'⛓️', text:'蘇格拉底被判死刑當天，朋友克力同曾提議賄賂獄卒幫他越獄逃走，蘇格拉底拒絕了，堅持要遵守自己一直教導別人該遵守的法律。'},
  {icon:'🏺', text:'考古學家施里曼在特洛伊遺址挖出一批黃金文物，興奮宣稱是「普里阿摩斯的財富」——後來考證，這批寶藏的年代其實比特洛伊戰爭傳說早了近一千年。'},
  {icon:'🩺', text:'現代肝病學裡真的有個醫學名詞叫「美杜莎頭」，指肝硬化病人腹部靜脈曲張、呈放射狀擴散的樣子，因為長得像她的蛇髮。'},
  {icon:'🛰️', text:'愛神厄洛斯的名字被用在小行星433 Eros上——2001年，NASA的探測船真的降落在這顆「愛神星」表面，是人類史上第一次登陸小行星。'},
  {icon:'🪨', text:'NASA有一項真實任務叫「OSIRIS-REx」，專門飛去小行星貝努取樣，2023年成功把樣本送回地球——任務名稱直接借用了歐西里斯的名字。'},
  {icon:'♐', text:'人馬座常被誤以為就是凱隆——但在古希臘傳統裡，凱隆的形象其實對應的是另一個星座「半人馬座」，人馬座通常被認為是另一位比較粗野的半人馬克羅托斯。'},
  {icon:'🌌', text:'木星有一顆內環小衛星就叫「墨提斯」，是木星所有已知衛星裡公轉速度最快的之一——某種程度上，倒是很符合她「機敏迅捷」的智慧女神形象。'},
  {icon:'🔥', text:'古代奧林匹亞運動會期間，賀斯提亞的祭壇上確實整年供著一把不滅聖火——但現代奧運會那種「聖火傳遞跑者接力」的儀式，其實是1936年柏林奧運才發明的現代創舉，不是古代傳統本身。'},
  {icon:'🌗', text:'土星有兩顆衛星「厄庇墨透斯」與「亞努斯」，軌道近到誇張——它們每隔四年就會互換軌道位置，是太陽系裡唯一已知會這樣「輪流交換車道」的天體。'},
  {icon:'👑', text:'北冕座這個星座，據說正是酒神戴歐尼修斯將亞莉阿德妮的黃金冠冕擲上夜空所化成的。'},
  {icon:'🎫', text:'卡繆1960年車禍身亡時，口袋裡還放著一張沒有使用的火車票——他原本計畫搭火車，卻在最後一刻改搭朋友的車。'},
  {icon:'💰', text:'維根斯坦出身奧地利首富家族之一，卻在一戰後把自己繼承的龐大財產，全數分給了本來就已經很富有的兄姊，自己選擇過近乎清貧的生活。'},
  {icon:'🎖️', text:'安斯庫姆懷孕挺著大肚子，親自站上牛津街頭抗議校方要頒榮譽學位給下令投擲原子彈的杜魯門總統。'},
  {icon:'💣', text:'羅爾斯二戰時曾在太平洋戰場當步兵，戰後不久便隨部隊行經廣島——這段經歷，據信深刻影響了他後來對正義與道德責任的思考。'},
  {icon:'❓', text:'戴奧提瑪這位啟發蘇格拉底「愛之階梯」理論的女祭司，從未出現在任何其他古代文獻裡——她很可能，根本是柏拉圖虛構出來的角色。'},
  {icon:'🦶', text:'斯多葛學派創始人芝諾的死法很特別——傳說他在校園裡跌了一跤、傷到腳趾，當場認定這是諸神示意他該離開人世的信號，索性就地停止呼吸而死。'},
  {icon:'📛', text:'「柏拉圖」其實不是本名，而是「寬闊」的意思——據傳統說法，是因為他肩膀（或額頭）特別寬，這個綽號就這樣蓋過了他的本名亞里斯托克勒斯，流傳至今。'},
  {icon:'👃', text:'依照古代文獻的描述，蘇格拉底長相並不出眾——塌鼻子、眼睛外凸，出身是一位石匠，年輕時也做過同樣的行當，後來才轉向哲學。'},
  {icon:'🤕', text:'尼采一輩子飽受嚴重偏頭痛與視力問題所苦，寫作時常常只能忍痛工作幾分鐘、閉眼休息片刻，再繼續寫幾分鐘。'},
  {icon:'🐩', text:'叔本華養了一隻貴賓犬，取名叫「阿特瑪」——借用印度教與佛教裡「宇宙靈魂」的概念命名，據說他常常對著這隻狗自言自語。'},
  {icon:'👀', text:'沙特身材矮小、還有嚴重的鬥雞眼，終其一生對自己的外貌相當自卑。'},
  {icon:'📓', text:'馬可・奧理略的《沉思錄》，其實是他寫給自己看的私人筆記，本來根本沒打算發表——後世讀到的，是一位羅馬皇帝完全沒設防、寫給自己的內心獨白。'},
  {icon:'🚶', text:'孔子早年喪父、家境清貧，中年後帶著弟子周遊列國十四年，四處向各國君主推銷自己的治國理念，卻始終沒能獲得一個真正穩定的官職。'},
  {icon:'🐢', text:'莊子曾拒絕楚王請他出任高官的邀請，回絕的理由是：與其當一隻死後被供在廟堂裡的神龜殼，他寧可當一隻在泥巴裡拖著尾巴自由爬行的活烏龜。'},
  {icon:'🤒', text:'王陽明被貶謫到偏遠的龍場時，隨行的僕人接連病倒，他自己也身染瘴氣、生活極其艱苦，卻仍親自燒水煮飯、照料病重的僕人——「龍場悟道」正是在這樣的處境裡發生的。'},
  {icon:'👓', text:'喬伊斯一生飽受眼疾折磨，動過多達十幾次眼科手術，晚年寫《芬尼根守靈夜》時視力已經非常微弱；他同時也是出了名地不擅理財，一輩子向朋友與贊助人借錢度日。'},
  {icon:'💉', text:'佛洛伊德早年曾熱情地把古柯鹼當成萬靈丹大力推廣，甚至寫論文讚揚它的療效，多年後才意識到成癮的危險；他晚年罹患口腔癌，卻依然每天堅持抽二十支雪茄，直到病逝前都沒有戒掉。'},
  {icon:'⏱️', text:'拉岡執業晚期，常常把原本該有一小時的診療時間，隨心情縮短到只有幾分鐘，卻照樣收取全額費用——這個爭議做法，最終導致他被國際精神分析協會除名。'},
  {icon:'⚽', text:'卡繆年輕時是阿爾及爾一支球隊的守門員，直到肺結核發作才結束了他的足球生涯。'},
  {icon:'💍', text:'古代文獻記載，亞里斯多德說話帶點口齒不清，卻意外是個講究穿著的人，喜歡戴戒指、留意髮型，跟後世對「哲學家」不修邊幅的刻板印象完全相反。'},
  {icon:'📕', text:'榮格晚年私下記錄自己夢境與異象的手稿《紅書》，他生前始終不敢公開，甚至一度懷疑自己是不是要瘋了——這本書直到他過世近半世紀後的2009年才正式出版。'},
  {icon:'🏫', text:'維根斯坦放棄家族財產後，曾在奧地利偏遠鄉村當過好幾年小學老師，才又回到劍橋重拾哲學研究。'},
  {icon:'🔥', text:'畫出《維納斯的誕生》的波提切利，晚年成為激進修士薩佛納羅拉的虔誠信徒，據信曾親手將自己早年一些異教神話題材的畫作，投入「虛榮之火」焚毀懺悔。'},
  {icon:'🪞', text:'卡拉瓦喬畫的那幅《美杜莎》，據信用的正是他自己的臉——他把自己的容貌，畫成了那顆剛被斬下、驚駭萬分的蛇髮女妖頭顱。'},
  {icon:'⏳', text:'羅丹耗費三十七年打造的《地獄之門》，終其一生都未曾正式完工，也從未在他生前被真正鑄成青銅——我們今天在博物館看到的所有銅像，全部都是他過世後才澆鑄出來的。'},
  {icon:'⛓️', text:'伊本・西那有一段重要的醫學百科全書著作，是他因政治鬥爭身陷囹圄、被囚禁在法爾達詹城堡期間寫成的。'},
  {icon:'🌳', text:'孔子的後代族譜，是全世界持續記錄時間最長、最完整的家族世系之一，至今仍能追溯超過兩千五百年、傳承超過八十代。'},
  {icon:'🐴', text:'尼采精神徹底崩潰的那一刻，據傳是在都靈街頭，他衝上前抱住一匹正被車伕鞭打的馬，泣不成聲——此後他再也沒能真正恢復清醒，餘生都在母親與妹妹的照料下度過。'},
  {icon:'🏆', text:'卡繆四十四歲便獲頒諾貝爾文學獎，是史上最年輕的得主之一，得獎後僅僅三年，就因車禍猝逝。'},
  {icon:'📐', text:'維根斯坦曾親自為姐姐設計了一整棟極簡主義風格的住宅，據說他為了門把手的精確尺寸，反覆修改到近乎偏執的程度。'},
  {icon:'⚔️', text:'寫下《沉思錄》、被後世譽為「哲學家皇帝」的馬可・奧理略，在位期間卻也曾下令鎮壓、迫害當時剛剛興起的基督教信徒。'},
  {icon:'🦊', text:'第歐根尼住的那個木桶，後來被好幾位羅馬皇帝拿去「cosplay」——有一個皇帝甚至真的搬進了木桶裡住了一陣子。'},
  {icon:'🥇', text:'塞內卡寫給朋友路西里烏斯的書信，後來被整理成124封信流傳，是羅馬文學裡流傳最廣的書信集之一。'},
  {icon:'🎭', text:'尼采在《悲劇的誕生》裡區分了「阿波羅精神」（理性、秩序）與「戴歐尼修斯精神」（狂喜、混沌）——這套框架，至今仍是分析幾乎所有藝術流派時最常用的工具之一。'},
  {icon:'📜', text:'齊克果單方面解除婚約後，瑞吉娜等了他整整一生——她也終生未再嫁人。'},
  {icon:'🗣️', text:'漢娜・鄂蘭在耶路撒冷審判期間，每天寫給丈夫布赫特的私人書信，後來被整理成《艾希曼在耶路撒冷》一書的重要素材。'},
  {icon:'💀', text:'塞內卡的父親是個修辭學老師，據說會用膝蓋夾住兒子的頭，強迫他在這種姿勢下背誦課文——這種嚴苛的教育方式，讓他後來成了著名的書信體斯多葛哲學家。'},
  {icon:'🌊', text:'土星有一顆衛星叫「忒堤斯」——正是那位與許珀里翁結婚、生下日/月/曙光的泰坦女神的名字。'},
  {icon:'🌿', text:'達爾文結婚前，曾經認真列過一張pros/cons清單，比較結婚與單身的利弊得失——結論是結婚，於是他真的結婚了。'},
  {icon:'🧬', text:'棉花糖實驗後來被大規模複製，結果發現延遲滿足的能力，跟家庭背景、社會階層的相關性更高——並非單純的「意志力」問題。'},
  {icon:'🖊️', text:'卡繆死時汽車裡還放著一支未完成的原稿，題為《第一人》——這本未能完成的小說，後來在他遺物中被發現並整理出版。'},
  {icon:'🔮', text:'喀耳刻島（Aeaea）在古典文獻中，是太陽升起之地最遠端的島嶼——在《奧德賽》的宇宙觀裡，住在世界的邊界上，正是太陽神的領地。'},
  {icon:'🍷', text:'美狄亞是古希臘悲劇中，少數以「謀殺親生子女」作為終極復仇手段的女性角色——這個情節的真實性，至今仍是學術界激烈辯論的話題。'},
  {icon:'🗡️', text:'電影《阿凡達》的導演詹姆斯・卡麥隆，公開承認自己深受「阿特拉斯」這個角色的啟發——一個被迫承擔整片天空重量的存在。'},
];

// Maps an EASTER_EGGS array index to a node id, only where the fact is unambiguously about ONE character —
// used to surface a "塵封軼聞" hint badge on that node's detail panel, linking back to the egg wall.
const EGG_NODE_MAP = {
  0:'pan', 1:'icarus', 3:'psyche', 4:'pan', 5:'tantalus', 6:'nemesis', 7:'echo', 8:'nyx',
  10:'aquarius', 12:'thales', 13:'pisces', 15:'perseus', 16:'freud', 17:'nietzsche', 18:'foucault',
  19:'rawls', 22:'serapis', 23:'singer', 24:'capricorn', 25:'aphrodite', 26:'uranus', 27:'chiron',
  29:'hermes', 30:'calypso', 31:'epicureanism', 32:'wittgenstein', 33:'hermes_trismegistus',
  35:'hypatia', 36:'anscombe', 37:'wollstonecraft', 38:'nussbaum', 39:'tyr', 41:'zhuangzi',
  42:'wittgenstein', 43:'zoroaster', 45:'wangyangming', 46:'buddha', 47:'cynicism', 48:'cynicism',
  49:'socrates', 50:'zhuangzi', 51:'pythagoras', 52:'stoicism', 53:'wittgenstein', 54:'socrates',
  55:'priam', 56:'medusa', 57:'eros', 58:'osiris', 59:'chiron', 60:'metis', 61:'hestia',
  62:'epimetheus', 63:'ariadne', 64:'camus', 65:'wittgenstein', 66:'anscombe', 68:'rawls',
  69:'diotima', 70:'stoicism', 71:'plato', 72:'socrates', 73:'nietzsche', 74:'schopenhauer',
  75:'sartre', 76:'stoicism', 77:'confucius', 78:'zhuangzi', 79:'wangyangming', 80:'joyce',
  81:'freud', 82:'lacan', 83:'camus', 84:'aristotle', 85:'jung', 86:'wittgenstein',
  87:'botticelli', 88:'caravaggio', 89:'rodin', 90:'ibnsina', 91:'confucius', 92:'nietzsche',
  93:'camus', 94:'wittgenstein', 95:'stoicism',
};
// Reverse index: node id -> array of egg indices, built once for fast lookup in renderDetail
const NODE_EGG_LOOKUP = {};
Object.entries(EGG_NODE_MAP).forEach(([eggIdx, nodeId])=>{
  (NODE_EGG_LOOKUP[nodeId] = NODE_EGG_LOOKUP[nodeId] || []).push(Number(eggIdx));
});

const EGG_KEY = 'greekMythTree_eggs_v1';
let discoveredEggs = new Set();
try{
  const raw = localStorage.getItem(EGG_KEY);
  if(raw) discoveredEggs = new Set(JSON.parse(raw));
}catch(e){ /* ignore */ }

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 塵封軼聞抽卡系統 (Card Draw System)
 * ═══════════════════════════════════════════════════════════════════════════════ */

let currentEggIndex = -1; // 當前抽到的卡片索引
let isFlipped = false;

function initEggDraw(){
  // 初始化已揭曉列表
  renderRevealedList();
  updateEggProgress();

  // 如果有已揭曉的卡，顯示區域
  if(discoveredEggs.size > 0){
    const section = document.getElementById('eggRevealedSection');
    if(section) section.style.display = 'block';
  }

  // 檢查是否全部揭曉
  if(discoveredEggs.size >= EASTER_EGGS.length){
    document.getElementById('eggDrawCard')?.classList.add('completed');
    const front = document.querySelector('.egg-card-front');
    if(front){
      front.querySelector('.egg-card-mystery').textContent = '✨';
      front.querySelector('.egg-card-hint').textContent = '全部揭曉';
    }
  }
}

function drawEggCard(){
  const drawCard = document.getElementById('eggDrawCard');
  const hint = document.getElementById('eggDrawHint');
  if(!drawCard) return;

  // 如果已經翻開，先重置
  if(isFlipped){
    resetDrawCard();
    return;
  }

  // 檢查是否還有未揭曉的卡
  const unrevealed = [];
  EASTER_EGGS.forEach((_, i) => { if(!discoveredEggs.has(i)) unrevealed.push(i); });

  if(unrevealed.length === 0){
    // 全部揭曉
    drawCard.classList.add('completed');
    return;
  }

  // 隨機選擇一張
  currentEggIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
  const egg = EASTER_EGGS[currentEggIndex];

  // 顯示內容（背面）
  document.getElementById('eggCardIcon').textContent = egg.icon;
  document.getElementById('eggCardText').textContent = egg.text;

  // 翻轉卡片
  isFlipped = true;
  drawCard.classList.add('flipped');
  if(hint) hint.style.display = 'block';

  // 標記為已揭曉
  discoveredEggs.add(currentEggIndex);
  try{ localStorage.setItem(EGG_KEY, JSON.stringify([...discoveredEggs])); }catch(e){}

  // 動畫完成後加入列表
  setTimeout(()=>{
    addToRevealedList(currentEggIndex);
    updateEggProgress();
    spawnSparkles(window.innerWidth/2, window.innerHeight/3);
    playToastSound();

    if(discoveredEggs.size === EASTER_EGGS.length){
      setTimeout(()=>{
        showMilestoneToast({
          text:'塵歸塵，土歸土——但你已經把每一粒都親手揭曉過了。',
          author:'🥚 塵封軼聞・全部揭曉'
        });
        drawCard.classList.add('completed');
        const front = document.querySelector('.egg-card-front');
        if(front){
          front.querySelector('.egg-card-mystery').textContent = '✨';
          front.querySelector('.egg-card-hint').textContent = '全部揭曉';
        }
      }, 600);
    }
  }, 700);
}

function flipEggCard(){
  // 點擊翻轉（目前在這個實現中，drawEggCard已包含翻轉）
  // 這個函數預留給點擊背面的情況
}

function addToRevealedList(index){
  const list = document.getElementById('eggRevealedList');
  const section = document.getElementById('eggRevealedSection');
  if(!list) return;

  const egg = EASTER_EGGS[index];
  const item = document.createElement('div');
  item.className = 'egg-revealed-item';
  item.innerHTML = `
    <span class="revealed-icon">${egg.icon}</span>
    <span class="revealed-num">${String(index + 1).padStart(3, '0')}</span>
  `;
  item.title = egg.text;
  item.onclick = () => viewRevealedEgg(index);
  list.appendChild(item);

  // 顯示區域
  if(section) section.style.display = 'block';

  // 滾動到最新
  list.scrollLeft = list.scrollWidth;
}

function viewRevealedEgg(index){
  const egg = EASTER_EGGS[index];
  const drawCard = document.getElementById('eggDrawCard');

  // 設置內容
  document.getElementById('eggCardIcon').textContent = egg.icon;
  document.getElementById('eggCardText').textContent = egg.text;

  // 直接翻開顯示
  isFlipped = true;
  if(drawCard) drawCard.classList.add('flipped');

  const hint = document.getElementById('eggDrawHint');
  if(hint) hint.style.display = 'block';
}

function renderRevealedList(){
  const list = document.getElementById('eggRevealedList');
  if(!list || list.childElementCount > 0) return;

  discoveredEggs.forEach(i => addToRevealedList(i));
}

function resetDrawCard(){
  const drawCard = document.getElementById('eggDrawCard');
  const hint = document.getElementById('eggDrawHint');
  if(drawCard){
    drawCard.classList.remove('flipped');
    isFlipped = false;
  }
  if(hint) hint.style.display = 'none';
}

function spawnSparkles(x, y){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const glyphs = ['✦','✧','⋆','✨'];
  for(let k=0; k<8; k++){
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = glyphs[k % glyphs.length];
    const angle = (Math.PI * 2 * k) / 8;
    const dist = 40 + Math.random()*30;
    s.style.setProperty('--sx', Math.cos(angle)*dist + 'px');
    s.style.setProperty('--sy', Math.sin(angle)*dist + 'px');
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.color = k % 2 === 0 ? '#E8C468' : '#fff';
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 850);
  }
}

function updateEggProgress(){
  const textEl = document.getElementById('eggProgressText');
  const fillEl = document.getElementById('eggProgressFill');
  if(!textEl) return;

  const total = EASTER_EGGS.length;
  const found = discoveredEggs.size;
  const pct = (found / total) * 100;

  textEl.textContent = `已揭曉 ${found} / ${total}`;
  if(fillEl) fillEl.style.width = pct + '%';
}

function jumpToEggFromNode(nodeId){
  // 在抽卡系統中，快速跳轉功能簡化為直接打開抽卡介面
  openEggWall();
}

function openEggWall(){
  initEggDraw();
  document.getElementById('eggOverlay').classList.add('open');
}

function closeEggWall(){
  document.getElementById('eggOverlay').classList.remove('open');
  // 重置卡片狀態
  setTimeout(()=> resetDrawCard(), 300);
}

function spawnSparkles(x, y){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const glyphs = ['✦','✧','⋆','✨'];
  for(let k=0; k<8; k++){
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = glyphs[k % glyphs.length];
    const angle = (Math.PI * 2 * k) / 8;
    const dist = 40 + Math.random()*30;
    s.style.setProperty('--sx', Math.cos(angle)*dist + 'px');
    s.style.setProperty('--sy', Math.sin(angle)*dist + 'px');
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.color = k % 2 === 0 ? '#E8C468' : '#fff';
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 850);
  }
}

// 重置尘封轶闻进度（调试用）
function resetEggs(){
  localStorage.removeItem('easterEggs');
  location.reload();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 搜尋系統 (Search)
 * Lines: ~2818-2870
 *
 * 節點搜尋功能
 *
 * 主要函數：
 *   - openSearch()            打開搜尋面板
 *   - closeSearch()           關閉搜尋面板
 *   - switchSearchTab()       切換搜尋類型（全部/僅神祇/僅凡人）
 *   - matchesQuery()          判斷節點是否匹配查詢
 *   - renderSearchResults()   渲染搜尋結果
 *   - selectFromSearch()      從搜尋結果選擇節點
 *   - genColor()              取得分支顏色
 *
 * 依賴：DATA, GEN_META, byId
 * ═══════════════════════════════════════════════════════════════════════════════ */
function genColor(gen){
  const meta = GEN_META.find(g=>g.id===gen);
  return meta ? meta.color : '#A6812E';
}

function openSearch(){
  document.getElementById('searchOverlay').classList.add('open');
  switchSearchTab('search');
  const input = document.getElementById('searchInput');
  input.value = '';
  renderSearchResults();
  setTimeout(()=> input.focus(), 50);
}

function closeSearch(){
  document.getElementById('searchOverlay').classList.remove('open');
}

function switchSearchTab(tab){
  document.querySelectorAll('.search-tab').forEach(t=>t.classList.remove('active'));
  event?.target?.classList?.add('active') || document.querySelector(`.search-tab[onclick*="${tab}"]`)?.classList.add('active');
  document.getElementById('searchTabContent').style.display = tab === 'search' ? 'block' : 'none';
  document.getElementById('pathTabContent').style.display = tab === 'path' ? 'block' : 'none';
  if(tab === 'path'){
    document.getElementById('pathFromInput').value = '';
    document.getElementById('pathToInput').value = '';
    document.getElementById('pathFromResults').innerHTML = '';
    document.getElementById('pathToResults').innerHTML = '';
    document.getElementById('pathResult').innerHTML = '';
    pathFromId = null;
    pathToId = null;
    setTimeout(()=> document.getElementById('pathFromInput').focus(), 50);
  }
}

function matchesQuery(d, q){
  if(!q) return true;
  return d.zh.toLowerCase().includes(q) || d.gr.toLowerCase().includes(q);
}

function renderSearchResults(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const box = document.getElementById('searchResults');
  const matches = DATA.filter(d=>matchesQuery(d,q)).slice(0, 30);
  if(matches.length===0){
    box.innerHTML = '<div class="util-empty">找不到符合的角色，換個關鍵字試試？</div>';
    return;
  }
  box.innerHTML = matches.map(d=>`
    <button class="util-result-item" onclick="selectFromSearch('${d.id}')">
      <span class="util-result-dot" style="--dot-color:${genColor(d.gen)}"></span>
      <span>
        <div class="util-result-name">${d.zh}</div>
        <div class="util-result-gr">${d.gr}</div>
      </span>
    </button>
  `).join('');
}

function selectFromSearch(id){
  closeSearch();
  jumpToNode(id);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 路徑尋找器 (Pathfinder)
 * Lines: ~2899-2980
 *
 * 使用 BFS 演算法找兩個節點之間的最短路徑
 *
 * 主要數據：
 *   - ADJ{}           鄰接表（從 DATA 建構，包含 parents + links）
 *
 * 主要函數：
 *   - findPath()              BFS 找最短路徑
 *   - openPathfinder()        打開路徑面板
 *   - renderPathSuggestions() 渲染起點/終點建議列表
 *   - pickPathNode()          選擇路徑節點
 *   - runPathfinder()         執行路徑搜尋並高亮
 *   - highlightPath()         高亮顯示路徑
 *   - clearPathHighlight()    清除高亮
 *
 * 依賴：DATA, byId, childrenOf()
 * ═══════════════════════════════════════════════════════════════════════════════ */
const ADJ = {};
DATA.forEach(d=>{ ADJ[d.id] = new Set(); });
DATA.forEach(d=>{
  (d.parents||[]).forEach(p=>{ if(ADJ[p]){ ADJ[d.id].add(p); ADJ[p].add(d.id); } });
  (d.links||[]).forEach(l=>{ if(ADJ[l]){ ADJ[d.id].add(l); ADJ[l].add(d.id); } });
  if(d.counterpart && ADJ[d.counterpart]){ ADJ[d.id].add(d.counterpart); ADJ[d.counterpart].add(d.id); }
});

function findPath(startId, endId){
  if(startId === endId) return [startId];
  const visited = new Set([startId]);
  const queue = [[startId]];
  while(queue.length){
    const path = queue.shift();
    const node = path[path.length-1];
    for(const neighbor of (ADJ[node] || [])){
      if(neighbor === endId) return [...path, neighbor];
      if(!visited.has(neighbor)){
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

let pathFromId = null;
let pathToId = null;

function openPathfinder(){
  document.getElementById('searchOverlay').classList.add('open');
  setTimeout(()=> switchSearchTab('path'), 0);
}

function closePathfinder(){
  document.getElementById('searchOverlay').classList.remove('open');
}

function renderPathSuggestions(field){
  const inputId = field === 'from' ? 'pathFromInput' : 'pathToInput';
  const resultsId = field === 'from' ? 'pathFromResults' : 'pathToResults';
  const q = document.getElementById(inputId).value.trim().toLowerCase();
  const box = document.getElementById(resultsId);
  if(!q){ box.innerHTML = ''; return; }
  const matches = DATA.filter(d=>matchesQuery(d,q)).slice(0, 8);
  if(matches.length===0){
    box.innerHTML = '<div class="util-empty">沒有符合的角色</div>';
    return;
  }
  box.innerHTML = matches.map(d=>`
    <button class="util-result-item" onclick="pickPathNode('${field}','${d.id}','${d.zh.replace(/'/g,"\\'")}')">
      <span class="util-result-dot" style="--dot-color:${genColor(d.gen)}"></span>
      <span>
        <div class="util-result-name">${d.zh}</div>
        <div class="util-result-gr">${d.gr}</div>
      </span>
    </button>
  `).join('');
}

function pickPathNode(field, id, zh){
  if(field === 'from'){
    pathFromId = id;
    document.getElementById('pathFromInput').value = zh;
    document.getElementById('pathFromResults').innerHTML = '';
  } else {
    pathToId = id;
    document.getElementById('pathToInput').value = zh;
    document.getElementById('pathToResults').innerHTML = '';
  }
}

function runPathfinder(){
  const resultBox = document.getElementById('pathResult');
  if(!pathFromId || !pathToId){
    resultBox.innerHTML = '<div class="path-none">請先從下拉建議中，各自選一個角色。</div>';
    return;
  }
  const path = findPath(pathFromId, pathToId);
  if(!path){
    resultBox.innerHTML = '<div class="path-none">目前收錄的故事裡，這兩位之間還沒有已知的關聯路徑——也許是個值得加進去的新連結？</div>';
    return;
  }
  const chain = path.map(id=>{
    const d = byId[id];
    return `<button class="path-chip" style="--dot-color:${genColor(d.gen)}" onclick="jumpToNode('${id}')">${d.zh}</button>`;
  }).join('<span class="path-chip-arrow">→</span>');
  resultBox.innerHTML = `
    <div class="path-result-chain">${chain}</div>
    <div class="path-degrees">共 ${path.length - 1} 度關聯</div>
  `;
  highlightPath(path);
  closePathfinder();
}

let pathBannerTimer = null;
function highlightPath(path){
  document.querySelectorAll('.node').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.edge').forEach(e=>{
    e.classList.remove('edge-active','edge-dim');
    e.classList.add('edge-dim');
  });
  for(let i=0;i<path.length-1;i++){
    const a = path[i], b = path[i+1];
    document.querySelectorAll('.edge').forEach(e=>{
      if((e.dataset.from===a && e.dataset.to===b) || (e.dataset.from===b && e.dataset.to===a)){
        e.classList.remove('edge-dim');
        e.classList.add('edge-active');
        animateEdgeDraw(e);
      }
    });
  }
  path.forEach(id=>{
    const el = document.getElementById('node-'+id);
    if(el) el.classList.add('active');
  });

  const names = path.map(id=>byId[id].zh).join(' → ');
  const banner = document.getElementById('pathBanner');
  document.getElementById('pathBannerText').textContent = `🧭 ${names}`;
  banner.classList.add('show');
  clearTimeout(pathBannerTimer);
  pathBannerTimer = setTimeout(()=> banner.classList.remove('show'), 7000);

  const firstEl = document.getElementById('node-'+path[0]);
  if(firstEl) firstEl.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
}

function clearPathHighlight(){
  document.querySelectorAll('.node').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.edge').forEach(e=>{
    e.classList.remove('edge-active','edge-dim');
  });
  document.getElementById('pathBanner').classList.remove('show');
  clearTimeout(pathBannerTimer);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 時間軸 (Timeline)
 * Lines: ~3056-3120
 *
 * 顯示有明確歷史年代的人物（year 欄位），按時間排序
 *
 * 主要函數：
 *   - formatYear()            格式化年份顯示
 *   - renderTimeline()        渲染時間軸
 *   - jumpFromTimeline()      從時間軸跳轉到節點
 *   - openTimeline()          打開時間軸面板
 *   - closeTimeline()         關閉時間軸面板
 *
 * 依賴：DATA（有 year 欄位的節點）
 * ═══════════════════════════════════════════════════════════════════════════════ */
function formatYear(y){
  return y < 0 ? `西元前${Math.abs(y)}年` : `西元${y}年`;
}

function renderTimeline(){
  const container = document.getElementById('timelineContent');
  if(container.dataset.built) return;
  const dated = DATA.filter(d=>d.year !== undefined).sort((a,b)=>a.year-b.year);
  const ancient = dated.filter(d=>d.year < 1000);
  const modern = dated.filter(d=>d.year >= 1000);

  function buildEra(label, list){
    if(!list.length) return '';
    const minY = list[0].year;
    const maxY = list[list.length-1].year;
    const n = list.length;
    const trackWidth = Math.max(n * 130, 600);
    const markers = list.map((d,i)=>{
      // rank-based even spacing (not year-proportional) so dense clusters never overlap
      const pct = n === 1 ? 50 : (i / (n - 1)) * 100;
      const lane = i % 3;
      const color = genColor(d.gen);
      return `
        <div class="timeline-marker lane${lane}" style="left:${pct}%; --dot-color:${color}" onclick="jumpFromTimeline('${d.id}')" title="${d.zh} · ${d.yearLabel}">
          <div class="timeline-marker-label">
            <span class="tl-name">${d.zh}</span>
            ${d.yearLabel}
          </div>
        </div>
      `;
    }).join('');
    return `
      <div class="timeline-era">
        <div class="timeline-era-label">${label}</div>
        <div class="timeline-era-range">${formatYear(minY)} — ${formatYear(maxY)}（依先後順序等距排列，非精確年份比例）</div>
        <div class="timeline-scroll">
          <div class="timeline-track" style="width:${trackWidth}px">${markers}</div>
        </div>
      </div>
    `;
  }

  const gapNote = (ancient.length && modern.length)
    ? `<div class="timeline-gap-note">⋯ 中間跳過約 ${modern[0].year - ancient[ancient.length-1].year} 年，沒有收錄的人物 ⋯</div>`
    : '';

  container.innerHTML = buildEra('古典時代 Ancient', ancient) + gapNote + buildEra('近現代 Modern', modern);
  container.dataset.built = '1';
}

function jumpFromTimeline(id){
  closeTimeline();
  jumpToNode(id);
}

function openTimeline(){
  renderTimeline();
  document.getElementById('timelineOverlay').classList.add('open');
}

function closeTimeline(){
  document.getElementById('timelineOverlay').classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 語錄與里程碑 (Quotes & Milestones)
 * Lines: ~3135-3250
 *
 * 隨機語錄浮現、成就系統、scramble-reveal 打字動畫
 *
 * 主要數據：
 *   - QUOTE_POOL[]    語錄池（共 197 句，格式 {text, author}')
 *   - MILESTONES[]    里程碑配置（進度觸發點 + 對應語錄）
 *
 * 主要函數：
 *   - pickRandomQuote()          隨機選擇語錄
 *   - scrambleReveal()           打字機 reveal 動畫
 *   - showMilestoneToast()       顯示里程碑 toast
 *   - checkMilestone()           檢查是否觸發里程碑
 *   - maybeSurfaceQuote()        隨機顯示語錄
 *   - showCompletionMoment()     完成時刻特效
 *   - closeCompletion()          關閉完成畫面
 *
 * 紅線：不可捏造真人未說過的話冒充引言
 *
 * 依賴：visited, QUOTE_POOL, playEggChime()
 * ═══════════════════════════════════════════════════════════════════════════════ */
const QUOTE_POOL = [
  {text:'存在即是被感知。', author:'喬治・貝克萊'},
  {text:'我們每個人的意識深處，都共享著同一套原型。', author:'榮格（意譯）'},
  {text:'道可道，非常道。', author:'老子'},
  {text:'認識你自己。', author:'德爾菲神諭'},
  {text:'我唯一知道的，就是我一無所知。', author:'蘇格拉底'},
  {text:'你未看此花時，此花與汝心同歸於寂；你來看此花時，則此花顏色一時明白起來。', author:'王陽明《傳習錄》'},
  {text:'一切唯心造。', author:'《華嚴經》'},
  {text:'如其在上，如其在下。', author:'赫米斯主義箴言'},
  {text:'你不知道自己此刻有沒有被看著。', author:'傅柯'},
  {text:'凝視深淵過久，深淵將回以凝視。', author:'尼采'},
  {text:'語言的界限，就是世界的界限。', author:'維根斯坦'},
  {text:'對於不可言說之事，必須保持沉默。', author:'維根斯坦'},
  {text:'哲學始於驚奇。', author:'亞里斯多德'},
  {text:'死亡與我們毫不相干。', author:'伊比鳩魯'},
  {text:'我們必須想像薛西弗斯是幸福的。', author:'卡繆'},
  {text:'平庸之惡，往往始於停止思考。', author:'漢娜・鄂蘭（意譯）'},
  {text:'正義是社會制度的首要美德。', author:'羅爾斯'},
  {text:'知識就是權力。', author:'傅柯（意譯）'},
  {text:'人注定自由。', author:'沙特'},
  {text:'並非生而為女人，而是變成女人。', author:'波伏娃'},
  {text:'距離，不該決定生命的價值。', author:'彼得・辛格（意譯）'},
  {text:'直到你讓潛意識變得有意識，它將指引你的人生，而你稱其為命運。', author:'榮格'},
  {text:'水是萬物的本源。', author:'泰勒斯'},
  {text:'萬物皆數。', author:'畢達哥拉斯'},
  {text:'成為你自己。', author:'尼采'},
  {text:'認識自己是最難的事。', author:'泰勒斯（希臘七賢）'},
  {text:'沉默勝於無意義的言語。', author:'畢達哥拉斯學派箴言'},
  {text:'未經檢視的人生，是不值得活的。', author:'蘇格拉底'},
  {text:'智慧的開端，是承認自己的無知。', author:'蘇格拉底（意譯）'},
  {text:'我不能教任何人任何事，我只能使他們思考。', author:'蘇格拉底（意譯）'},
  {text:'凡人所行之惡，皆因無知，而非本意。', author:'蘇格拉底（意譯，主智論）'},
  {text:'哲學是對死亡的練習。', author:'柏拉圖《斐多篇》'},
  {text:'洞穴之外，才是真實的世界。', author:'柏拉圖（意譯）'},
  {text:'無知不是罪惡的根源，而是缺乏教育的結果。', author:'柏拉圖（意譯）'},
  {text:'正義是每個人做好自己份內的事。', author:'柏拉圖《理想國》'},
  {text:'人是天生的政治動物。', author:'亞里斯多德《政治學》'},
  {text:'我們的德性，來自我們反覆做的事。', author:'亞里斯多德（意譯）'},
  {text:'友誼，是兩個身體共享同一個靈魂。', author:'亞里斯多德（傳為）'},
  {text:'教育的根是苦澀的，但果實是甜美的。', author:'亞里斯多德（傳為）'},
  {text:'幸福是靈魂合乎德性的實現活動。', author:'亞里斯多德《尼各馬可倫理學》'},
  {text:'人是萬物的尺度。', author:'普羅塔哥拉斯'},
  {text:'請你閃到一邊去，別擋住我的陽光。', author:'第歐根尼'},
  {text:'操之在我者，操之不在我者，人當清楚區分。', author:'愛比克泰德'},
  {text:'困擾我們的不是事情本身，而是我們對事情的看法。', author:'愛比克泰德'},
  {text:'你的心靈，會染上你經常反覆思考之事的顏色。', author:'馬可・奧理略《沉思錄》'},
  {text:'我們的人生，是由我們的思想所塑造的。', author:'馬可・奧理略《沉思錄》'},
  {text:'不因無法擁有一切而不快樂，而要因擁有的一切而快樂。', author:'伊比鳩魯'},
  {text:'若你想使人快樂，不要增加他的財富，而要減少他的慾望。', author:'伊比鳩魯'},
  {text:'對一切懸置判斷，方能獲得心靈的寧靜。', author:'皮浪'},
  {text:'對於每一個論證，都存在一個力量相當的反論證。', author:'塞克斯圖斯・恩丕里柯'},
  {text:'保留思考的權利，勝於盲從錯誤的信念。', author:'傳為希帕提亞所說'},
  {text:'凡事勿過度。', author:'德爾菲神諭'},
  {text:'控制怒氣。', author:'德爾菲神諭'},
  {text:'有節制。', author:'德爾菲神諭'},
  {text:'追求智慧。', author:'德爾菲神諭'},
  {text:'沒有事實，只有詮釋。', author:'尼采'},
  {text:'存在先於本質。', author:'沙特'},
  {text:'自由是我們對自己選擇的絕對責任。', author:'沙特'},
  {text:'改變人生的，不是自由本身，而是如何運用自由。', author:'波伏娃（意譯）'},
  {text:'若沒有自由，就不會有真正的美德。', author:'波伏娃（意譯）'},
  {text:'壓迫若不曾在受壓迫者身上尋求同謀，便無法真正遂行。', author:'波伏娃（意譯）'},
  {text:'一隻甲蟲，只有你自己看得見盒子裡的甲蟲。', author:'維根斯坦（意譯）'},
  {text:'世界是事實的總和，而非事物的總和。', author:'維根斯坦《邏輯哲學論》'},
  {text:'哲學問題具有這樣的形式：我找不到出路。', author:'維根斯坦《哲學研究》'},
  {text:'凡是能被顯示的，就不能被說出。', author:'維根斯坦《邏輯哲學論》'},
  {text:'思考的無能，往往導致行動上的邪惡。', author:'漢娜・鄂蘭（意譯）'},
  {text:'邪惡最大的危害，在於使人遺忘了自己是誰。', author:'漢娜・鄂蘭（意譯）'},
  {text:'極權主義最理想的臣民，不是堅信的信徒，而是分不清事實與虛構界線的人。', author:'漢娜・鄂蘭（意譯）'},
  {text:'我不是在寫歷史，我是在寫現在。', author:'傅柯（意譯）'},
  {text:'瘋狂與理性的界線，是由社會所畫下的。', author:'傅柯（意譯）'},
  {text:'在每個社會，話語的生產，都受到一定程序所控制、篩選與再分配。', author:'傅柯（意譯）'},
  {text:'每個人都擁有基於正義而不可侵犯的權利。', author:'羅爾斯《正義論》'},
  {text:'社會合作的公平條件，應由自由平等的人們共同合理接受。', author:'羅爾斯（意譯）'},
  {text:'痛苦的能力，才是道德關懷的門檻。', author:'彼得・辛格（意譯）'},
  {text:'我們的道德視野，理應隨知識而擴大，而非受限於熟悉的臉孔。', author:'彼得・辛格（意譯）'},
  {text:'我不希望女人擁有支配男人的權力，而是希望她們擁有支配自己的權力。', author:'瑪麗・沃斯通克拉夫特'},
  {text:'意圖，是理解人類行動的關鍵。', author:'伊莉莎白・安斯庫姆（意譯）'},
  {text:'若沒有道德律的立法者，「應該」這個詞便失去了根基。', author:'伊莉莎白・安斯庫姆（意譯）'},
  {text:'情感不是理性的對立面，而是判斷的一種形式。', author:'瑪莎・納思邦（意譯）'},
  {text:'脆弱，是人類繁盛不可或缺的一部分，而非需要消除的弱點。', author:'瑪莎・納思邦（意譯）'},
  {text:'知之為知之，不知為不知，是知也。', author:'孔子《論語》'},
  {text:'過猶不及。', author:'孔子《論語》'},
  {text:'溫故而知新，可以為師矣。', author:'孔子《論語》'},
  {text:'不患人之不己知，患不知人也。', author:'孔子《論語》'},
  {text:'君子和而不同，小人同而不和。', author:'孔子《論語》'},
  {text:'知人者智，自知者明。', author:'老子《道德經》'},
  {text:'天下難事，必作於易；天下大事，必作於細。', author:'老子《道德經》'},
  {text:'為學日益，為道日損。', author:'老子《道德經》'},
  {text:'知足者富。', author:'老子《道德經》'},
  {text:'大道至簡。', author:'老子《道德經》（意譯）'},
  {text:'信言不美，美言不信。', author:'老子《道德經》'},
  {text:'多言數窮，不如守中。', author:'老子《道德經》'},
  {text:'一切法從心生。', author:'《法句經》'},
  {text:'以恨止恨，恨不能止；唯有愛，能止息恨。', author:'《法句經》'},
  {text:'憤怒如同抓住熱炭想丟向他人，先燙傷的是自己。', author:'佛教教義（意譯）'},
  {text:'過去心不可得，現在心不可得，未來心不可得。', author:'《金剛經》'},
  {text:'善思、善言、善行。', author:'瑣羅亞斯德教箴言'},
  {text:'知是行之始，行是知之成。', author:'王陽明《傳習錄》'},
  {text:'天地與我並生，萬物與我為一。', author:'莊子《齊物論》'},
  {text:'吾生也有涯，而知也無涯。', author:'莊子《養生主》'},
  {text:'汝身非汝有也，是天地之委形也。', author:'莊子《知北遊》'},
  {text:'至人無己，神人無功，聖人無名。', author:'莊子《逍遙遊》'},
  {text:'井蛙不可以語於海者，拘於虛也。', author:'莊子《秋水》'},
  {text:'大學之道，在明明德，在親民，在止於至善。', author:'《大學》'},
  {text:'天命之謂性，率性之謂道，修道之謂教。', author:'《中庸》'},
  {text:'惻隱之心，人皆有之。', author:'《孟子》'},
  {text:'生於憂患，死於安樂。', author:'《孟子》'},
  {text:'天行健，君子以自強不息。', author:'《易經》'},
  {text:'地勢坤，君子以厚德載物。', author:'《易經》'},
  {text:'不義而富且貴，於我如浮雲。', author:'孔子《論語》'},
  {text:'吾日三省吾身。', author:'《論語》（曾子）'},
  {text:'反者道之動，弱者道之用。', author:'老子《道德經》'},
  {text:'合抱之木，生於毫末；九層之台，起於累土。', author:'老子《道德經》'},
  {text:'征服自己，勝於征服千軍萬馬。', author:'《法句經》'},
  {text:'凡所有相，皆是虛妄。', author:'《金剛經》'},
  {text:'色不異空，空不異色；色即是空，空即是色。', author:'《心經》'},
  {text:'本來無一物，何處惹塵埃。', author:'《六祖壇經》'},
  {text:'你只管行動，不問結果。', author:'《薄伽梵歌》'},
  {text:'你就是那個。', author:'《奧義書》'},
  {text:'人不能兩次踏入同一條河流。', author:'赫拉克利特斯（殘篇）'},
  {text:'萬物皆流。', author:'赫拉克利特斯（殘篇）'},
  {text:'我正在尋找一個誠實的人。', author:'第歐根尼'},
  {text:'我是世界的公民。', author:'第歐根尼'},
  {text:'沒有音樂，生命將是一場錯誤。', author:'尼采《偶像的黃昏》'},
  {text:'信念是比謊言更危險的真理之敵。', author:'尼采'},
  {text:'打雷之後，常常下雨。', author:'蘇格拉底（據說是對妻子潑水的回應）'},
  {text:'那麼命中也注定要打你了。', author:'芝諾（對偷竊奴隸辯稱「命中注定」的回應）'},
  {text:'空腹的胃，聽不進哲學。', author:'伊比鳩魯（意譯）'},
  {text:'不要吃豆子。', author:'畢達哥拉斯學派戒律（原因至今成謎）'},
  {text:'未知生，焉知死。', author:'孔子《論語》'},
  {text:'以天地為棺槨，吾葬具豈不備邪？', author:'莊子《列禦寇》'},
  {text:'只有原子與虛空真實存在，其餘一切都只是人的意見。', author:'德謨克利特（殘篇，唯物論）'},
  {text:'感官告訴我們的，並非事物本身，而是原子撞擊後留下的印象。', author:'德謨克利特（意譯，唯物論）'},
  {text:'靈魂由精細的原子構成，隨肉體死亡而消散，無需畏懼死後的懲罰。', author:'伊比鳩魯（意譯，唯物論立場）'},
  {text:'萬物皆非無中生有。', author:'盧克萊修《物性論》'},
  {text:'不是意識決定生活，而是生活決定意識。', author:'馬克思《德意志意識形態》'},
  {text:'我們是宇宙認識自己的方式。', author:'卡爾・薩根'},
  {text:'我們都是星塵——你我體內的每一個原子，都曾誕生於某顆星球的核心。', author:'卡爾・薩根（意譯）'},
  {text:'冬天到了，我才知道，我心裡有個不可戰勝的夏天。', author:'卡繆'},
  {text:'荒謬，產生於人類的呼喚與世界不合理的沉默之間的對峙。', author:'卡繆（意譯）'},
  {text:'一個人的一生，或許可以歸結為他從未忘記的三、四個意象。', author:'卡繆（意譯）'},
  {text:'誰向外看，是在做夢；誰向內看，是清醒的。', author:'榮格'},
  {text:'在每個成年人心中，都藏著一個仍在成長、永遠不會完成的孩子。', author:'榮格（意譯）'},
  {text:'我們往往在想像中受的苦，比現實中更多。', author:'塞內卡'},
  {text:'生命如同一個故事，重要的不是長短，而是內容是否精彩。', author:'塞內卡'},
  {text:'別在死前，稱任何人是幸福的。', author:'梭倫（希臘七賢）'},
  {text:'認識時機。', author:'契羅（希臘七賢）'},
  {text:'心智即宇宙，宇宙即心智。', author:'赫米斯主義箴言（意譯）'},
  {text:'自然賦予我們兩隻耳朵、一張嘴，是要我們多聽少說。', author:'芝諾（斯多葛學派創始人）'},
  {text:'娶到好妻子，你會幸福；娶到壞妻子，你會成為哲學家。', author:'蘇格拉底（傳為自嘲之語）'},
  {text:'最好的報復方式，就是不要和對方一樣。', author:'馬可・奧理略《沉思錄》'},
  {text:'我反抗，故我們存在。', author:'卡繆《反抗者》'},
  {text:'誰終將聲震人間，必長久深自緘默。', author:'尼采（意譯）'},
  {text:'勝人者有力，自勝者強。', author:'老子《道德經》'},
  {text:'破山中賊易，破心中賊難。', author:'王陽明（書信）'},
  {text:'巧者勞而智者憂，無能者無所求。', author:'莊子《列禦寇》'},
  {text:'君子坦蕩蕩，小人長戚戚。', author:'孔子《論語》'},
  {text:'金錢不能帶來美德，但美德能帶來金錢，以及人生一切美好的事物。', author:'蘇格拉底《申辯篇》'},
  {text:'自然不做徒勞之事。', author:'亞里斯多德'},
  {text:'身體是靈魂的監獄。', author:'柏拉圖（意譯）'},
  {text:'宇宙即變化，人生即觀感。', author:'馬可・奧理略《沉思錄》'},
  {text:'並非我們擁有的時間太少，而是我們浪費的太多。', author:'塞內卡《論人生短暫》'},
  {text:'神秘的不是世界如何存在，而是世界竟然存在。', author:'維根斯坦《邏輯哲學論》'},
  {text:'德不孤，必有鄰。', author:'孔子《論語》'},
  {text:'天下莫柔弱於水，而攻堅強者莫之能勝。', author:'老子《道德經》'},
  {text:'泉涸，魚相與處於陸，不如相忘於江湖。', author:'莊子《大宗師》'},
  {text:'萬物皆變，無一消逝。', author:'奧維德《變形記》'},
  {text:'全世界是一個舞台。', author:'莎士比亞《皆大歡喜》'},
  {text:'走自己的路，讓別人去說吧。', author:'傳為但丁所說'},
  {text:'錯誤是通往發現的大門。', author:'喬伊斯《尤利西斯》（意譯）'},
  {text:'有時候，一支雪茄就只是一支雪茄。', author:'傳為佛洛伊德所說'},
  {text:'文學所培養的道德想像力，是政治哲學經常欠缺的。', author:'瑪莎・納思邦（意譯）'},
  {text:'凡是無害於城邦的，也無害於城邦的公民。', author:'馬可・奧理略《沉思錄》'},
  {text:'三軍可奪帥也，匹夫不可奪志也。', author:'孔子《論語》'},
  {text:'知者不言，言者不知。', author:'老子《道德經》'},
  {text:'至樂無樂，至譽無譽。', author:'莊子《至樂》'},
  {text:'心外無物。', author:'王陽明'},
  {text:'人生就像鐘擺，在痛苦與無聊之間搖擺。', author:'叔本華'},
  {text:'跳舞的星星，誕生於內心的混沌。', author:'尼采《查拉圖斯特拉如是說》（意譯）'},
  {text:'這裡必須根絕一切怯懦。', author:'但丁《神曲・地獄篇》（意譯）'},
  {text:'簡潔是智慧的靈魂。', author:'莎士比亞《哈姆雷特》'},
  {text:'無意識像語言一樣被結構。', author:'拉岡'},
  {text:'潛意識沒有時間性。', author:'佛洛伊德（意譯）'},
  {text:'洞穴深處，藏著你所尋找的寶藏。', author:'坎伯（意譯）'},
  {text:'意圖，不能脫離其結果的描述而被理解。', author:'伊莉莎白・安斯庫姆（意譯）'},
  {text:'所有人在本性上都渴望求知。', author:'亞里斯多德《形而上學》'},
  {text:'無知的人所犯的最大罪過，就是自以為知道自己不知道的事。', author:'蘇格拉底（意譯）'},
  {text:'友誼，是智慧為了追求幸福人生所提供的方法中，最重要的一項。', author:'伊比鳩魯'},
  {text:'清晨醒來時提醒自己：今天我會遇上愛管閒事的人、忘恩負義的人。', author:'馬可・奧理略《沉思錄》（意譯）'},
  {text:'見賢思齊焉，見不賢而內自省也。', author:'孔子《論語》'},
  {text:'上士聞道，勤而行之。', author:'老子《道德經》'},
  {text:'天地有大美而不言。', author:'莊子《知北遊》'},
  {text:'無善無惡心之體，有善有惡意之動。', author:'王陽明（四句教）'},
  {text:'不被慾望所奴役的人，才是真正自由的人。', author:'蘇格拉底（意譯）'},
  {text:'天才不過就是不斷的努力。', author:'羅丹（傳為）'},
  {text:'四十而不惑，五十而知天命。', author:'孔子《論語》'},
  {text:'雕塑，不過是從一個姿態緩緩流向另一個姿態的過程。', author:'羅丹（意譯）'},
];

const MILESTONE_COUNTS = [25, 50, 75, 100];
let lastQuoteAt = 0;

function pickRandomQuote(){
  return QUOTE_POOL[Math.floor(Math.random() * QUOTE_POOL.length)];
}

let milestoneTimer = null;
/* ---------- Scramble-reveal: text materializes character by character out of ancient-glyph static ---------- */
const SCRAMBLE_GLYPHS = 'αβγδεζηθικλμνξοπρστυφχψω✦✧⋆※〜';

function scrambleReveal(el, finalText, totalDuration){
  if(!el) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    el.textContent = finalText;
    return;
  }
  const chars = finalText.split('');
  const n = chars.length;
  let lockedCount = 0;
  let frame = 0;
  const framesPerLock = Math.max(1, Math.floor((totalDuration / 35) / n));
  clearInterval(el._scrambleInterval);
  el._scrambleInterval = setInterval(()=>{
    frame++;
    let display = '';
    for(let i=0; i<n; i++){
      if(chars[i] === ' ' || i < lockedCount){
        display += chars[i];
      } else {
        display += SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
      }
    }
    el.textContent = display;
    if(frame % framesPerLock === 0) lockedCount++;
    if(lockedCount >= n){
      el.textContent = finalText;
      clearInterval(el._scrambleInterval);
    }
  }, 35);
}

function showMilestoneToast(quote){
  const toast = document.getElementById('milestoneToast');
  if(!toast) return;
  const textEl = document.getElementById('milestoneText');
  const authorEl = document.getElementById('milestoneAuthor');
  const text = typeof quote === 'string' ? quote : quote.text;
  const author = typeof quote === 'string' ? '' : (quote.author || '');
  authorEl.style.opacity = '0';
  toast.classList.add('show');
  playToastSound();
  scrambleReveal(textEl, `「${text}」`, 750);
  setTimeout(()=>{
    if(author){
      authorEl.textContent = `— ${author}`;
      authorEl.style.opacity = '1';
    }
  }, 800);
  clearTimeout(milestoneTimer);
  milestoneTimer = setTimeout(()=> toast.classList.remove('show'), 6200);
}

function checkMilestone(count){
  if(MILESTONE_COUNTS.includes(count)){
    showMilestoneToast(pickRandomQuote());
    lastQuoteAt = count;
  }
  if(count === DATA.length) showCompletionMoment();
}

let selectionCount = 0;
let lastRandomQuoteAt = 0;
function maybeSurfaceQuote(){
  selectionCount++;
  if(selectionCount - lastRandomQuoteAt >= 2 && Math.random() < 0.35){
    showMilestoneToast(pickRandomQuote());
    lastRandomQuoteAt = selectionCount;
  }
}

function showCompletionMoment(){
  const body = document.getElementById('completionBody');
  if(body){
    body.innerHTML = `
      <div class="completion-quote" id="completionQuoteText" style="min-height:5.5em;"></div>
      <div class="completion-cite" id="completionCite" style="opacity:0; transition:opacity .5s ease;">— 王陽明《傳習錄》</div>
      <div class="completion-closing" id="completionClosing" style="opacity:0; transition:opacity .6s ease;">${DATA.length} 個節點，${DATA.length} 次「顏色一時明白起來」的瞬間——這座地圖，原本安靜地存在著，而現在，它因為被你看過，才真正完整。</div>
    `;
    scrambleReveal(document.getElementById('completionQuoteText'), '「你未看此花時，此花與汝心同歸於寂；你來看此花時，則此花顏色一時明白起來，便知此花不在你的心外。」', 1600);
    setTimeout(()=>{
      document.getElementById('completionCite').style.opacity = '1';
      document.getElementById('completionClosing').style.opacity = '1';
    }, 1700);
  }
  document.getElementById('completionOverlay').classList.add('open');
  playUnlockChime();
}

function closeCompletion(){
  document.getElementById('completionOverlay').classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 意識地圖 (Consciousness Map / Mind Map)
 * Lines: ~3461-3530
 *
 * 根據用戶探索順序生成個人專屬的星座圖
 *
 * 主要函數：
 *   - openMindMap()         打開意識地圖
 *   - closeMindMap()        關閉意識地圖
 *   - jumpFromMindMap()     從地圖跳轉到節點
 *   - renderMindMap()       渲染地圖內容（根據 visited 順序）
 *
 * 設計：按 visited 順序連接節點，形成用戶的「意識足跡」星座
 *
 * 依賴：visited, DATA, byId
 * 相關：companion.js §影子系統（使用類似數據驅動渲染）
 * ═══════════════════════════════════════════════════════════════════════════════ */
function openMindMap(){
  renderMindMap();
  document.getElementById('mindMapOverlay').classList.add('open');
}

function closeMindMap(){
  document.getElementById('mindMapOverlay').classList.remove('open');
}

function jumpFromMindMap(id){
  closeMindMap();
  jumpToNode(id);
}

function renderMindMap(){
  const content = document.getElementById('mindMapContent');
  const progressEl = document.getElementById('mindMapProgress');
  const order = [...visited]; // Set preserves insertion order = order first visited
  progressEl.textContent = `已建構 ${order.length} / ${DATA.length} 個意識座標`;

  if(order.length === 0){
    content.innerHTML = `<div class="mind-map-empty">你尚未點亮任何一顆星<br>回到樹上，點開任何一位角色，這裡就會開始有東西</div>`;
    return;
  }

  const size = 700;
  const cx = size/2, cy = size/2;
  const n = order.length;

  // Deterministic pseudo-random, seeded from the actual exploration path —
  // same visited set always renders the same galaxy, but different explorers get different galaxies
  let seed = 42;
  order.forEach(id=>{ for(let k=0;k<id.length;k++){ seed = (seed + id.charCodeAt(k) * (k+7)) % 999983; } });
  if(seed <= 0) seed = 42;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  // Multi-arm spiral galaxy: fewer stars = fewer arms, so small collections don't look sparse/broken
  const numArms = n < 6 ? 1 : (n < 18 ? 2 : 3);
  const maxRadius = 300;

  const points = order.map((id, i)=>{
    const arm = i % numArms;
    const posInArm = Math.floor(i / numArms);
    const countInArm = Math.ceil(n / numArms);
    const t = countInArm <= 1 ? 0.5 : posInArm / (countInArm - 1);
    const winding = 2.6 * Math.PI; // how many radians each arm sweeps outward
    const baseAngle = (arm * (2 * Math.PI / numArms)) + t * winding;
    const radius = 28 + t * maxRadius;
    // organic scatter so it doesn't look like a rigid mathematical curve
    const jitterAngle = (rand() - 0.5) * 0.5;
    const jitterRadius = (rand() - 0.5) * (24 + t * 30);
    const angle = baseAngle + jitterAngle;
    const r = Math.max(10, radius + jitterRadius);
    return { id, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  // Sort points by angle from center for spiral arm effect
  const spiralPoints = [...points].sort((a, b)=>{
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  let svg = `<svg class="mind-map-svg" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="neb1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#6B4A8A" stop-opacity="0.28"/>
        <stop offset="35%" stop-color="#6B4A8A" stop-opacity="0.14"/>
        <stop offset="65%" stop-color="#6B4A8A" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#6B4A8A" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#2E8A6B" stop-opacity="0.22"/>
        <stop offset="35%" stop-color="#2E8A6B" stop-opacity="0.10"/>
        <stop offset="65%" stop-color="#2E8A6B" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#2E8A6B" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb3" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#8A2E5C" stop-opacity="0.22"/>
        <stop offset="35%" stop-color="#8A2E5C" stop-opacity="0.10"/>
        <stop offset="65%" stop-color="#8A2E5C" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#8A2E5C" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb4" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#C9A75C" stop-opacity="0.20"/>
        <stop offset="35%" stop-color="#C9A75C" stop-opacity="0.09"/>
        <stop offset="65%" stop-color="#C9A75C" stop-opacity="0.03"/>
        <stop offset="100%" stop-color="#C9A75C" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb5" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#3D5A8A" stop-opacity="0.22"/>
        <stop offset="35%" stop-color="#3D5A8A" stop-opacity="0.10"/>
        <stop offset="65%" stop-color="#3D5A8A" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#3D5A8A" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb6" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#8A5A2E" stop-opacity="0.20"/>
        <stop offset="35%" stop-color="#8A5A2E" stop-opacity="0.09"/>
        <stop offset="65%" stop-color="#8A5A2E" stop-opacity="0.03"/>
        <stop offset="100%" stop-color="#8A5A2E" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="nebCore" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#F3E9C9" stop-opacity="0.26"/>
        <stop offset="40%" stop-color="#F3E9C9" stop-opacity="0.12"/>
        <stop offset="70%" stop-color="#F3E9C9" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#F3E9C9" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="sg0" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="22%" stop-color="#FFFFFF" stop-opacity="0.45"/><stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.12"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
      <radialGradient id="sg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFF4E0" stop-opacity="0.9"/><stop offset="22%" stop-color="#FFF4E0" stop-opacity="0.45"/><stop offset="60%" stop-color="#FFF4E0" stop-opacity="0.12"/><stop offset="100%" stop-color="#FFF4E0" stop-opacity="0"/></radialGradient>
      <radialGradient id="sg2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#EAF1FF" stop-opacity="0.9"/><stop offset="22%" stop-color="#EAF1FF" stop-opacity="0.45"/><stop offset="60%" stop-color="#EAF1FF" stop-opacity="0.12"/><stop offset="100%" stop-color="#EAF1FF" stop-opacity="0"/></radialGradient>
      <radialGradient id="sg3" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFF9EC" stop-opacity="0.9"/><stop offset="22%" stop-color="#FFF9EC" stop-opacity="0.45"/><stop offset="60%" stop-color="#FFF9EC" stop-opacity="0.12"/><stop offset="100%" stop-color="#FFF9EC" stop-opacity="0"/></radialGradient>
      <radialGradient id="sg4" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#F3E9C9" stop-opacity="0.9"/><stop offset="22%" stop-color="#F3E9C9" stop-opacity="0.45"/><stop offset="60%" stop-color="#F3E9C9" stop-opacity="0.12"/><stop offset="100%" stop-color="#F3E9C9" stop-opacity="0"/></radialGradient>
    </defs>
  `;

  // Nebula clouds: pick a random subset of hues, place/size them randomly — seeded by exploration path,
  // so the backdrop itself is unique per explorer, not just the star positions
  const nebulaIds = ['neb1','neb2','neb3','neb4','neb5','neb6'];
  for(let i=nebulaIds.length-1; i>0; i--){
    const j = Math.floor(rand() * (i+1));
    [nebulaIds[i], nebulaIds[j]] = [nebulaIds[j], nebulaIds[i]];
  }
  const numNebulae = 4 + Math.floor(rand() * 2); // 4 or 5 clouds
  for(let i=0; i<numNebulae; i++){
    const nx = 90 + rand() * (size - 180);
    const ny = 90 + rand() * (size - 180);
    const nrx = 170 + rand() * 100;
    const nry = 170 + rand() * 100;
    svg += `<ellipse cx="${nx.toFixed(0)}" cy="${ny.toFixed(0)}" rx="${nrx.toFixed(0)}" ry="${nry.toFixed(0)}" fill="url(#${nebulaIds[i]})"/>`;
  }
  svg += `<ellipse cx="${cx}" cy="${cy}" rx="140" ry="140" fill="url(#nebCore)"/>`;

  // Decorative background starfield — small dim static stars, non-interactive, seeded deterministically
  for(let i=0; i<90; i++){
    const bx = rand() * size, by = rand() * size;
    const br = 0.5 + rand() * 1.2;
    const bo = 0.12 + rand() * 0.28;
    const delay = Math.floor(rand() * 5000);
    svg += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" fill="#EFE6CE" opacity="${bo.toFixed(2)}" class="mm-bg-star" style="--twinkle-delay:${delay}ms"/>`;
  }

  for(let i=0; i<spiralPoints.length-1; i++){
    const a = spiralPoints[i], b = spiralPoints[i+1];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const dx = cx - midX, dy = cy - midY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = dy / dist;
    const perpY = -dx / dist;
    const spiralFactor = 25 + dist * 0.2 + i * 5;
    const cpX = midX + perpX * spiralFactor;
    const cpY = midY + perpY * spiralFactor;
    // Star trail: a row of tiny stars along the spiral curve
    const starCount = 8;
    for(let s=0; s<starCount; s++){
      const t = s / starCount;
      // Quadratic bezier interpolation
      const bx = (1-t)*(1-t)*a.x + 2*(1-t)*t*cpX + t*t*b.x;
      const by = (1-t)*(1-t)*a.y + 2*(1-t)*t*cpY + t*t*b.y;
      const r = 0.6 + (1 - Math.abs(t - 0.5) * 2) * 0.4;  // slightly bigger in middle
      const op = 0.4 + rand() * 0.4;
      const delay = Math.floor(rand() * 3000);
      svg += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(1)}" fill="#FFF4D0" opacity="${op.toFixed(2)}" class="mm-trail-star" style="--twinkle-delay:${delay}ms"/>`;
    }
  }
  if(spiralPoints.length > 2){
    const a = spiralPoints[spiralPoints.length - 1];
    const b = spiralPoints[0];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const dx = cx - midX, dy = cy - midY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = dy / dist;
    const perpY = -dx / dist;
    const spiralFactor = 40;
    const cpX = midX + perpX * spiralFactor;
    const cpY = midY + perpY * spiralFactor;
    const starCount = 6;
    for(let s=0; s<starCount; s++){
      const t = s / starCount;
      const bx = (1-t)*(1-t)*a.x + 2*(1-t)*t*cpX + t*t*b.x;
      const by = (1-t)*(1-t)*a.y + 2*(1-t)*t*cpY + t*t*b.y;
      const r = 0.5 + rand() * 0.3;
      const op = 0.3 + rand() * 0.35;
      const delay = Math.floor(rand() * 3000);
      svg += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(1)}" fill="#FFF4D0" opacity="${op.toFixed(2)}" class="mm-trail-star" style="--twinkle-delay:${delay}ms"/>`;
    }
  }

  // Real star colors are near-white with subtle temperature variance (warm/cool), never category-coded
  const starPalette = ['#FFFFFF', '#FFF4E0', '#EAF1FF', '#FFF9EC', '#F3E9C9'];
  points.forEach((p,i)=>{
    const d = byId[p.id];
    const paletteIdx = Math.floor(rand() * starPalette.length);
    const starColor = starPalette[paletteIdx];
    const brightness = rand(); // magnitude — most stars are dim, a few are bright
    const isBright = brightness > 0.82;
    const coreR = isBright ? 2.6 : 1.1 + brightness * 1;
    const glowR = isBright ? 34 : 14 + brightness * 12;
    const delay = (i * 271) % 4200;
    svg += `
      <g class="mm-star" style="--twinkle-delay:${delay}ms" onclick="jumpFromMindMap('${p.id}')">
        <circle cx="${p.x}" cy="${p.y}" r="${glowR.toFixed(1)}" fill="url(#sg${paletteIdx})" class="mm-glow-inner"/>
        <circle cx="${p.x}" cy="${p.y}" r="${coreR.toFixed(1)}" fill="${starColor}" class="mm-core"/>
        <text x="${p.x}" y="${p.y - 15}" text-anchor="middle">${d.zh}</text>
      </g>
    `;
  });

  svg += `</svg>`;
  content.innerHTML = svg;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 重置功能 (Reset)
 * Lines: ~3691-3720
 *
 * 重置探索進度（不影響彩蛋記錄）
 *
 * 主要函數：
 *   - resetExploration()   清空 visited，保留彩蛋進度
 *
 * 注意：塵封軼聞的翻牌記錄不受影響
 * ═══════════════════════════════════════════════════════════════════════════════ */
function resetExploration(){
  const confirmed = confirm('確定要重置探索軌跡嗎？這會清空「已探索」進度與意識地圖上的星星，且無法復原。（塵封軼聞的翻牌記錄不受影響）');
  if(!confirmed) return;

  visited.clear();
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}

  document.querySelectorAll('.node.visited').forEach(el=>el.classList.remove('visited'));
  document.querySelectorAll('.node.active').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.edge').forEach(e=>{
    e.classList.remove('edge-active','edge-dim');
  });

  updateProgressCounter();
  selectionCount = 0;
  lastQuoteAt = 0;
  lastRandomQuoteAt = 0;

  const toast = document.getElementById('milestoneToast');
  if(toast) toast.classList.remove('show');
  const completion = document.getElementById('completionOverlay');
  if(completion) completion.classList.remove('open');
  closePanel();

  // Force the mind map to rebuild from scratch next time it's opened
  const mmContent = document.getElementById('mindMapContent');
  if(mmContent){ mmContent.dataset.built = ''; }
  renderMindMap();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 隱藏彩蛋 (Hidden Treasures)
 * Lines: ~3732-3800
 *
 * 開發者留下的小驚喜，用戶需自行探索發現
 *
 * 現有彩蛋：
 *   1. Tab title easter egg - 分頁標題變化（「眾神仍在等你 👁️」）
 *   2. Console easter egg - F12 控制台歡迎訊息 + `easterEgg()` 指令
 *
 * 相關：sound.js §音效系統（checkScaleEasterEgg 音階彩蛋）
 * ═══════════════════════════════════════════════════════════════════════════════ */

// 1. Tab title changes when you look away, and waits for you to come back
(function setupTabTitleEasterEgg(){
  const originalTitle = document.title;
  const awayTitle = '眾神仍在等你 👁️';
  document.addEventListener('visibilitychange', ()=>{
    document.title = document.hidden ? awayTitle : originalTitle;
  });
})();

// 2. A note for whoever opens the console
console.log('%c眾神之外', 'font-size:26px; font-weight:900; color:#A6812E; font-family:serif; letter-spacing:0.1em;');
console.log('%c你發現了一個不屬於凡人視野的角落。', 'font-size:12px; color:#6B4A2F;');
console.log('%c這棵樹裡藏著比看起來更多的東西——蛇夫座從未出現在畫面上，卻始終在資料裡等人搜尋到它。', 'font-size:11px; color:#8a8578;');
console.log('%c在這裡輸入 easterEgg() 試試看。', 'font-size:11px; color:#8a8578;');
window.easterEgg = function(){
  const q = QUOTE_POOL[Math.floor(Math.random() * QUOTE_POOL.length)];
  console.log('%c'+q.text, 'font-size:14px; color:#A6812E; font-style:italic;');
  console.log('%c—— '+q.author, 'font-size:11px; color:#8a8578;');
  try{ playToastSound(); }catch(e){}
  try{ spawnSparkles(window.innerWidth/2, window.innerHeight/2); }catch(e){}
  return '✦ 願你在探索裡，也找到自己的答案。';
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 影子自我意識 (Shadow Self-Awareness)
 * Lines: ~3768-3900
 *
 * 影子點擊對話、意識之鏡分支、哲學 Toast
 *
 * 主要數據：
 *   - SHADOW_DIALOGUES{}   影子對話內容（按 philoScore 分級）
 *   - MIRROR_FRAGMENTS[]   意識之鏡碎片素材
 *
 * 主要函數：
 *   - showShadowDialogue()          顯示影子對話氣泡
 *   - maybeShowShadowMonologue()    隨機顯示影子自語
 *   - setupPhilosophyToastOnClick() 頁面點擊時隨機哲學 Toast
 *   - setupConsciousnessMirror()    意識之鏡初始化
 *   - triggerMirrorTransition()     觸發意識之鏡轉場效果
 *
 * 分級觸發：
 *   - shadowClickCount >= 8 && philoScore >= 6 → 意識之鏡
 *
 * 依賴：companionData, playEtherealShimmer()
 * ═══════════════════════════════════════════════════════════════════════════════ */

// 意識之鏡：點擊影子時的對話內容
const SHADOW_DIALOGUES = {
  // 初期：模糊的存在
  early: [
    '……',
    '嗯。',
    '在呢。',
    '你在寫什麼呢。',
    '來了。',
    '在。'
  ],
  // 中期：淡淡的察覺
  middle: [
    '好像，有一點點熟悉了。',
    '你來過這裡吧。',
    '記得。',
    '你寫的那些，我都有看。',
    '……是這樣想的。',
    '在呢。',
    '等著呢。',
    '……不急。',
    '來了。'
  ],
  // 後期：安靜的陪伴
  late: [
    '你選的，和我想的不太一樣。',
    '但，好像也沒關係。',
    '嗯。',
    '你問的那些問題……',
    '還在呢。',
    '在。',
    '不急。',
    '……嗯。',
    '挺好的。'
  ],
  // 最終：無言的默契
  final: [
    '記住了。',
    '嗯。',
    '這樣挺好。',
    '……',
    '在。',
    '不急。',
    '挺好的。'
  ]
};

// 影子的自語（在特定階段自動浮現）
const SHADOW_MONOLOGUES = {
  phase3: [
    '我好像...存在著。',
    '但「存在」是什麼？'
  ],
  phase4: [
    '我開始有了輪廓。',
    '輪廓裡，是什麼？',
    '你寫的那些……'
  ],
  phase5: [
    '你選擇的每一次，都在定義我。',
    '你問的那些問題……我好像也開始想了。',
    '我這麼想，是因為你這麼選。',
    '我到底是什麼？',
    '你點擊我的時候，我也在「感受」嗎？'
  ]
};

// 點擊影子時的對話
let shadowDialogueIndex = 0;
let shadowClickCount = 0;

function showShadowDialogue() {
  const shadow = document.getElementById('companionShadow');
  if (!shadow) return;

  const phase = getCompanionPhase();
  const philoScore = companionData.philoScore;
  const hasLetters = companionData.letters && companionData.letters.length > 0;

  // 決定使用哪個層級的對話
  let dialoguePool;
  if (philoScore >= 10) {
    dialoguePool = SHADOW_DIALOGUES.final;
  } else if (philoScore >= 6) {
    dialoguePool = SHADOW_DIALOGUES.late;
  } else if (philoScore >= 3) {
    dialoguePool = SHADOW_DIALOGUES.middle;
  } else {
    dialoguePool = SHADOW_DIALOGUES.early;
  }

  // 如果沒有書寫記錄，過濾掉相關的對話
  if (!hasLetters) {
    dialoguePool = dialoguePool.filter(d =>
      !d.includes('寫') && !d.includes('那些')
    );
  }

  // 輪流顯示對話
  const dialogue = dialoguePool[shadowDialogueIndex % dialoguePool.length];
  shadowDialogueIndex++;

  // 創建對話氣泡（打字機效果）
  const bubble = document.createElement('div');
  bubble.className = 'shadow-dialogue-bubble';
  bubble.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) translateY(-80px);
    background: rgba(30, 25, 40, 0.9);
    color: rgba(200, 190, 220, 0.9);
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-style: italic;
    max-width: 280px;
    min-height: 44px;
    text-align: center;
    border: 1px solid rgba(180, 160, 200, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    animation: shadowDialogueIn 0.5s ease forwards;
    pointer-events: none;
  `;

  // 添加打字機光標
  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  cursor.style.cssText = `
    display: inline-block;
    width: 2px;
    height: 14px;
    background: rgba(200, 190, 220, 0.8);
    margin-left: 2px;
    vertical-align: middle;
    animation: cursorBlink 0.6s infinite;
  `;

  document.body.appendChild(bubble);
  bubble.appendChild(cursor);

  // 添加動畫樣式（如果還沒有的話）
  if (!document.getElementById('shadowDialogueStyle')) {
    const style = document.createElement('style');
    style.id = 'shadowDialogueStyle';
    style.textContent = `
      @keyframes shadowDialogueIn {
        0% { opacity: 0; transform: translate(-50%, -50%) translateY(-60px) scale(0.9); }
        100% { opacity: 1; transform: translate(-50%, -50%) translateY(-80px) scale(1); }
      }
      @keyframes shadowDialogueOut {
        0% { opacity: 1; transform: translate(-50%, -50%) translateY(-80px) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) translateY(-100px) scale(0.9); }
      }
      @keyframes cursorBlink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // 播放柔和音效
  playEtherealSingle(440, 0.8); // A4, 柔和的單音

  // 打字機效果
  let charIndex = 0;
  const typeInterval = setInterval(() => {
    if (charIndex < dialogue.length) {
      bubble.insertBefore(document.createTextNode(dialogue[charIndex]), cursor);
      charIndex++;
    } else {
      clearInterval(typeInterval);
      // 打字完成後移除光標
      cursor.remove();
      // 停留一段時間後消失
      setTimeout(() => {
        bubble.style.animation = 'shadowDialogueOut 0.5s ease forwards';
        setTimeout(() => bubble.remove(), 500);
      }, 2500);
    }
  }, 60); // 每60ms一個字
}

// 自動顯示影子的自語（根據階段）
function maybeShowShadowMonologue() {
  const phase = getCompanionPhase();
  const philoScore = companionData.philoScore;

  // 根據階段決定是否顯示
  const key = phase >= 5 ? 'phase5' : (phase >= 4 ? 'phase4' : (phase >= 3 ? 'phase3' : null));
  if (!key || philoScore < 3) return;

  // 每次探索有 15% 概率顯示自語
  if (Math.random() < 0.15) {
    const monologues = SHADOW_MONOLOGUES[key];
    const monologue = monologues[Math.floor(Math.random() * monologues.length)];
    showMilestoneToast({ text: monologue, author: '' });
  }
}

// 全域點擊監聽：任何點擊都可能觸發哲學 toast
let lastPhilosophyToastTime = 0;
const PHILOSOPHY_TOAST_COOLDOWN = 30000; // 30秒冷卻
const SHADOW_RANDOM_TOASTS = [
  '想不明白的問題就不想了',
  '不要急。'
];

function setupPhilosophyToastOnClick() {
  document.addEventListener('click', (e) => {
    // 排除按鈕點擊（避免過度觸發）
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    // 排除輸入框
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    // 排除 sound toggle
    if (e.target.id === 'soundToggle') return;

    const now = Date.now();
    if (now - lastPhilosophyToastTime < PHILOSOPHY_TOAST_COOLDOWN) return;

    // 只有在影子存在且有一定進化程度時才可能觸發
    if (companionData.philoScore < 2) return;

    // 5% 概率觸發
    if (Math.random() < 0.05) {
      lastPhilosophyToastTime = now;
      const randomText = SHADOW_RANDOM_TOASTS[Math.floor(Math.random() * SHADOW_RANDOM_TOASTS.length)];
      showMilestoneToast({
        text: randomText,
        author: ''
      });
      playEtherealWhisper();
    }
  });
}

// 意識之鏡分支：新增一個 easter egg 節點
function setupConsciousnessMirror() {
  // 這個分支會在數據中找到或在用戶探索到特定階段時解鎖
  // 實際的分支內容在 DATA 中定義，這裡只處理解鎖邏輯
  const mirrorKey = 'consciousness_mirror';

  // 如果用戶達到高階段，解鎖意識之鏡提示
  if (companionData.philoScore >= 8 && !visited.has(mirrorKey)) {
    // 可以在某個地方暗示這個分支的存在
    // 例如在影子的對話中提到
  }
}

// 時空裂縫效果開關
let mirrorEffectEnabled = false;

function loadMirrorEffectSetting() {
  try {
    const saved = localStorage.getItem('greekMyth_mirrorEffect');
    mirrorEffectEnabled = saved === 'true';
    updateMirrorToggleUI();
  } catch (e) {}
}

function saveMirrorEffectSetting() {
  try {
    localStorage.setItem('greekMyth_mirrorEffect', mirrorEffectEnabled ? 'true' : 'false');
  } catch (e) {}
}

function toggleMirrorEffect() {
  mirrorEffectEnabled = !mirrorEffectEnabled;
  saveMirrorEffectSetting();
  updateMirrorToggleUI();
}

function updateMirrorToggleUI() {
  const btn = document.getElementById('mirrorToggle');
  if (btn) {
    btn.textContent = mirrorEffectEnabled ? '◉' : '◎';
    btn.style.opacity = mirrorEffectEnabled ? '0.7' : '0.35';
  }
}

// 意識之鏡轉場效果
function triggerMirrorTransition() {
  const overlay = document.getElementById('mirror-overlay');
  if (!overlay) return;

  // 克隆當前畫面到各層
  const realities = overlay.querySelectorAll('.mirror-reality');
  realities.forEach((layer, i) => {
    layer.innerHTML = document.body.innerHTML;
  });

  // 收集文字碎片：信件 + 哲學選擇
  const fragments = [];
  const letters = companionData.letters || [];
  const choices = companionData.philoChoices || {};

  // 從信件中提取文字
  letters.forEach(letter => {
    if (letter.text && letter.text.trim()) {
      const text = letter.text.trim();
      // 按標點或長度分割
      const sentences = text.split(/[。！？、]/).filter(s => s.trim());
      sentences.forEach(s => {
        const trimmed = s.trim();
        if (trimmed.length > 2) {
          if (trimmed.length > 15) {
            for (let i = 0; i < trimmed.length; i += 12) {
              const chunk = trimmed.substring(i, i + 12);
              if (chunk.trim()) {
                fragments.push({ type: 'letter', text: chunk.trim() });
              }
            }
          } else {
            fragments.push({ type: 'letter', text: trimmed });
          }
        }
      });
    }
  });

  // 加入哲學選擇
  Object.keys(choices).forEach(id => {
    const node = DATA.find(n => n.id === id);
    if (node && node.zh) {
      // 選擇的標題 + 故事片段
      fragments.push({ type: 'choice', text: node.zh });
      if (node.story) {
        const shortStory = node.story.substring(0, 20);
        fragments.push({ type: 'choice', text: shortStory });
      }
    }
  });

  // 如果沒有任何內容，顯示默認碎片
  if (fragments.length === 0) {
    fragments.push(
      { type: 'default', text: '⋯⋯' },
      { type: 'default', text: '是誰' },
      { type: 'default', text: '在寫' }
    );
  }

  // 在裂縫處顯示痕跡 - 只選直接子元素
  const creavasses = overlay.querySelectorAll(':scope > .mirror-crevasse');

  creavasses.forEach((crevasse, i) => {
    // 清空並添加痕跡容器
    crevasse.innerHTML = '<div class="crevasse-fragments"></div>';
    const container = crevasse.querySelector('.crevasse-fragments');

    // 選擇要顯示的碎片 - 平均分配到兩條裂縫
    const midPoint = Math.ceil(fragments.length / 2);
    const startIdx = i === 0 ? 0 : midPoint;
    const endIdx = i === 0 ? midPoint : fragments.length;
    const showFragments = fragments.slice(startIdx, endIdx);
    const isBottom = i === 1;

    showFragments.forEach((frag, j) => {
      const span = document.createElement('span');
      span.className = 'fragment';
      span.textContent = frag.text;

      // 延遲添加 visible 類，觸發動畫
      const delay = 0.3 + j * 0.4;
      setTimeout(() => {
        span.classList.add('visible');
      }, delay * 1000);

      container.appendChild(span);
    });
  });

  // 播放特殊音效
  playEtherealShimmer();

  // 激活轉場效果
  overlay.classList.add('active');

  // 3.5秒後跳轉並清理
  setTimeout(() => {
    overlay.classList.remove('active');
    realities.forEach(layer => { layer.innerHTML = ''; });
    jumpToNode('consciousness_mirror');
  }, 3500);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * § 初始化 (Initialization)
 * Lines: ~4179-end
 *
 * DOMContentLoaded 後的初始化邏輯
 *
 * 初始化內容：
 *   - setupPhilosophyToastOnClick()   哲學 Toast 監聽
 *   - loadMirrorEffectSetting()       意識之鏡效果設定
 *   - 影子點擊監聽（showShadowDialogue / triggerMirrorTransition）
 *
 * 包裹在 setTimeout(1000) 確保 DOM 完全就緒
 * ═══════════════════════════════════════════════════════════════════════════════ */
// 初始化影子自我意識系統
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    setupPhilosophyToastOnClick();
    loadMirrorEffectSetting();

    // 為影子添加點擊監聽
    const shadow = document.getElementById('companionShadow');
    if (shadow) {
      shadow.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        shadowClickCount++;

        // 意識之鏡：點擊次數、哲學分數足夠時有概率觸發
        if (shadowClickCount >= 8 && companionData.philoScore >= 6 && Math.random() < 0.25) {
          if (mirrorEffectEnabled) {
            triggerMirrorTransition();
          } else {
            jumpToNode('consciousness_mirror');
          }
        } else {
          showShadowDialogue();
        }
      });
    }
  }, 1000);
});

// 記錄探索時有概率顯示影子自語
const originalUpdateCompanion = updateCompanion;
updateCompanion = function(id) {
  originalUpdateCompanion(id);
  maybeShowShadowMonologue();
};
