// ==========================================
// 🔒 관리자 접속 비밀번호 설정 (원하는 비밀번호로 변경 가능)
// ==========================================
const ADMIN_PASSWORD = "2026";

// 상품 목록
const prizes = [
  "배달의민족 상품권 50,000원",
  "전국편의점 상품권 3,000원",
  "올리브영 상품권 30,000원",
  "다시 돌려보세요! (꽝)",
  "스타벅스 상품권 10,000원",
  "올리브영 상품권 5,000원",
];

// 각 상품별 가중치 (확률 합계: 100)
// index 0: 배달의민족 상품권 50,000원 -> 0%
// index 1: 전국편의점 상품권 3,000원   -> 50%
// index 2: 올리브영 상품권 30,000원   -> 0%
// index 3: 다시 돌려보세요! (꽝)       -> 20%
// index 4: 스타벅스 상품권 10,000원   -> 5%
// index 5: 올리브영 상품권 5,000원     -> 25%
const weights = [0, 50, 0, 20, 5, 25];

// DOM 요소
const wheel = document.getElementById("wheel");
const spinBtn = document.getElementById("spin-btn");
const resultDisplay = document.getElementById("result-display");

// 세그먼트 당 각도 (360도 / 6개 = 60도)
const segmentAngle = 360 / prizes.length;
let spinCount = 0;

// --- 사운드 효과 (Web Audio API - 별도 파일 없이 내장 오디오로 동작) ---
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// 룰렛 바늘이 핀을 칠 때의 틱(Tick) 사운드
function playTickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(650, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.03);

  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.03);
}

// 4초 동안 회전 속도에 맞춰 점차 느려지는 틱 효과음
function playSpinSound() {
  const duration = 4000;
  const startTime = Date.now();
  let delay = 35; // 시작 속도 (빠른 틱)

  function scheduleNextTick() {
    const elapsed = Date.now() - startTime;
    if (elapsed >= duration - 150) return;

    playTickSound();

    // 회전 감속 애니메이션(cubic-bezier)에 맞춰 간격을 점차 넓힘
    const progress = elapsed / duration;
    delay = 35 + Math.pow(progress, 2.8) * 480;

    setTimeout(scheduleNextTick, delay);
  }

  scheduleNextTick();
}

// 당첨 축하 팡파레 효과음
function playWinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // 밝은 아르페지오 (도 - 미 - 솔 - 높은도)
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    const startTime = ctx.currentTime + idx * 0.11;
    const dur = idx === notes.length - 1 ? 0.6 : 0.22;

    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.25, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + dur);
  });
}

// 꽝 아쉬운 효과음
function playLoseSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // 하강 멜로디 (솔 - 파 - 미 - 도)
  const notes = [392.0, 349.23, 311.13, 261.63];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    const startTime = ctx.currentTime + idx * 0.16;
    const dur = 0.2;

    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + dur);
  });
}

// 가중치 기반 랜덤 인덱스 선택 함수
function getWeightedRandom() {
  let totalWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    totalWeight += weights[i];
  }

  let random = Math.random() * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random < 0) {
      return i;
    }
  }
  return weights.length - 1;
}

// 룰렛 회전 애니메이션 및 실행 함수
function spinWheel() {
  spinBtn.disabled = true;
  resultDisplay.innerText = "두근두근... 결과는?!";
  resultDisplay.style.color = "#333";

  // 회전 효과음 재생 시작 (틱틱틱... 틱... 틱)
  playSpinSound();

  const winningIndex = getWeightedRandom();
  spinCount++;

  // 목표 각도 계산 (세그먼트 정중앙: winningIndex * 60도 + 30도)
  const targetAngle = winningIndex * segmentAngle + 30;

  // 칸의 폭: 60도 (정중앙 30도 기준 좌우 ±30도가 경계선)
  // 바늘이 경계선 선 위에 걸치는 판정 시비를 피하기 위해 4도의 안전 여유를 둡니다 (최대 ±26도).
  // 약 30% 확률로 경계선 바로 근처(±22도 ~ ±26도)에 아슬아슬하게 멈추는 긴장감 연출
  let randomOffset;
  if (Math.random() < 0.3) {
    // [아슬아슬 연출] 경계선 직전(±22도 ~ ±26도)에 멈춤
    const sign = Math.random() < 0.5 ? -1 : 1;
    randomOffset = sign * (22 + Math.floor(Math.random() * 5));
  } else {
    // [일반 연출] 중앙 및 폭넓은 범위(-20도 ~ +20도)에서 자연스럽게 멈춤
    randomOffset = Math.floor(Math.random() * 41) - 20;
  }
  // 5바퀴(1800도) 회전 + 목표 각도 + 랜덤 오프셋
  const totalRotation = spinCount * 1800 + targetAngle + randomOffset;

  wheel.style.transform = `rotate(-${totalRotation}deg)`;

  setTimeout(() => {
    showResult(winningIndex);
    spinBtn.disabled = false;
  }, 4000);
}

// 당첨 결과 화면 출력 함수
function showResult(winningIndex) {
  const wonPrize = prizes[winningIndex];

  if (winningIndex === 3) {
    // 3번 인덱스: 꽝 (다시 돌려보세요!)
    playLoseSound();
    resultDisplay.innerHTML =
      '아쉽네요! 😅<br><span style="color:#888; font-weight:normal;">[다시 돌려보세요!]</span>';
    resultDisplay.style.color = "#888";
  } else {
    // 당첨
    playWinSound();
    resultDisplay.innerHTML =
      `🎉 축하합니다! 🎉<br><span style="color:#d92525; font-size:1.3rem; font-weight:bold;">[${wonPrize}]</span> 당첨!`;
    resultDisplay.style.color = "#2b5a9f";
  }
}

// START 버튼 클릭 이벤트 연결
spinBtn.addEventListener("click", spinWheel);

// ==========================================
// 🔒 관리자 인증 및 화면 잠금 관리 (태블릿 환경 유지)
// ==========================================
const lockOverlay = document.getElementById("lock-overlay");
const mainContainer = document.getElementById("main-container");
const passwordInput = document.getElementById("admin-password");
const lockError = document.getElementById("lock-error");
const lockToggleBtn = document.getElementById("lock-toggle-btn");

// 로그인 처리 함수
function handleAdminLogin() {
  const entered = passwordInput.value.trim();

  if (entered === ADMIN_PASSWORD) {
    // 인증 성공: 내 태블릿에 영구 저장 (새로고침/재방문 시 자동 통과)
    localStorage.setItem("roulette_admin_auth", "true");
    lockError.innerText = "";
    passwordInput.value = "";
    unlockScreen();
  } else {
    // 인증 실패
    lockError.innerText = "비밀번호가 올바르지 않습니다.";
    passwordInput.value = "";
    passwordInput.focus();
  }
}

// 화면 잠금 해제
function unlockScreen() {
  if (lockOverlay) lockOverlay.style.display = "none";
  if (mainContainer) mainContainer.style.display = "flex";
}

// 화면 다시 잠금 (로그아웃)
function adminLogout() {
  localStorage.removeItem("roulette_admin_auth");
  if (lockOverlay) lockOverlay.style.display = "flex";
  if (mainContainer) mainContainer.style.display = "none";
  if (passwordInput) {
    passwordInput.value = "";
    passwordInput.focus();
  }
}

// 잠금 버튼 클릭 이벤트 연결
if (lockToggleBtn) {
  lockToggleBtn.addEventListener("click", adminLogout);
}

// 페이지 로드 시 기존 인증 여부 확인 (태블릿에서는 계속 열려있음)
(function checkAdminAuth() {
  const isAuth = localStorage.getItem("roulette_admin_auth");
  if (isAuth === "true") {
    unlockScreen();
  } else {
    adminLogout();
  }
})();
