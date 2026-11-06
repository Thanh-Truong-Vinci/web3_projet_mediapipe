const CHOICES = [
  { id: "pierre", label: "Pierre", icon: "✊", beats: "ciseaux" },
  { id: "feuille", label: "Feuille", icon: "✋", beats: "pierre" },
  { id: "ciseaux", label: "Ciseaux", icon: "✌️", beats: "feuille" }
];

const panel = document.getElementById("chifumi-panel");
const camera = document.getElementById("chifumi-camera");
const cameraStatus = document.getElementById("chifumi-camera-status");
const cameraDot = document.getElementById("chifumi-camera-dot");
const gestureStatus = document.getElementById("chifumi-gesture-status");
const startCameraButton = document.getElementById("btn-start-chifumi-camera");
const playerChoice = document.getElementById("chifumi-player-choice");
const aiChoice = document.getElementById("chifumi-ai-choice");
const aiHand = document.getElementById("chifumi-ai-hand");
const roundStatus = document.getElementById("chifumi-round-status");
const result = document.getElementById("chifumi-result");
const playerScoreLabel = document.getElementById("chifumi-player-score");
const aiScoreLabel = document.getElementById("chifumi-ai-score");
const roundLabel = document.getElementById("chifumi-round");
const progress = document.getElementById("chifumi-progress");
const choiceButtons = document.querySelectorAll("[data-chifumi-choice]");

let playerScore = 0;
let aiScore = 0;
let round = 0;
let resolving = false;
let landmarker = null;
let cameraStream = null;
let detectionFrame = 0;
let stableGesture = null;
let stableGestureCount = 0;
let pausedArcadeState = null;

function getChoice(id) { return CHOICES.find((choice) => choice.id === id); }

function displayChoice(element, choice, fallback) {
  element.textContent = choice ? `${choice.icon} ${choice.label}` : fallback;
}

function updateScore() {
  playerScoreLabel.textContent = playerScore;
  aiScoreLabel.textContent = aiScore;
  roundLabel.textContent = `${round + 1} / 5`;
  progress.style.width = `${Math.min((Math.max(playerScore, aiScore) / 3) * 100, 100)}%`;
}

function resetGame() {
  playerScore = 0;
  aiScore = 0;
  round = 0;
  resolving = false;
  stableGesture = null;
  stableGestureCount = 0;
  displayChoice(playerChoice, null, "En attente");
  displayChoice(aiChoice, null, "IA prête");
  aiHand.textContent = "🤖";
  roundStatus.textContent = "Manche 1 : montrez votre geste (premier à 3 victoires)";
  result.textContent = "Pierre, feuille ou ciseaux avec votre main.";
  choiceButtons.forEach((button) => {
    button.disabled = true;
    button.classList.remove("is-selected");
  });
  updateScore();
}

function animateAiHand() {
  const sequence = ["✊", "✋", "✌️", "✊", "✋", "✌️"];
  let step = 0;
  aiHand.classList.add("is-revealing");
  const timer = window.setInterval(() => {
    aiHand.textContent = sequence[step++ % sequence.length];
  }, 130);
  return timer;
}

function resolveRound(playerId) {
  if (resolving || playerScore >= 3 || aiScore >= 3) return;
  resolving = true;
  const player = getChoice(playerId);
  const ai = CHOICES[Math.floor(Math.random() * CHOICES.length)];
  const timer = animateAiHand();

  displayChoice(playerChoice, player, "En attente");
  displayChoice(aiChoice, null, "...");
  roundStatus.textContent = "L’IA choisit sa main...";
  gestureStatus.textContent = "Geste reconnu. Ne bougez plus pendant la révélation.";
  choiceButtons.forEach((button) => { button.disabled = true; });

  window.setTimeout(() => {
    window.clearInterval(timer);
    aiHand.classList.remove("is-revealing");
    aiHand.textContent = ai.icon;
    displayChoice(aiChoice, ai, "IA prête");
    round += 1;

    if (player.id === ai.id) {
      result.textContent = "Égalité, aucun point cette manche.";
    } else if (player.beats === ai.id) {
      playerScore += 1;
      result.textContent = "Vous remportez la manche !";
    } else {
      aiScore += 1;
      result.textContent = "L’IA remporte la manche.";
    }

    updateScore();
    if (playerScore >= 3 || aiScore >= 3) {
      const winner = playerScore > aiScore ? "Vous gagnez le match !" : "L’IA gagne le match.";
      roundStatus.textContent = winner;
      result.textContent = `${winner} Score final : ${playerScore} - ${aiScore}.`;
    } else {
      roundStatus.textContent = `Manche ${round + 1} : montrez votre geste`;
      gestureStatus.textContent = "Montrez un nouveau geste à la caméra.";
    }
    stableGesture = null;
    stableGestureCount = 0;
    resolving = false;
  }, 1000);
}

function classifyGesture(landmarks) {
  const fingers = [
    landmarks[8].y < landmarks[6].y,
    landmarks[12].y < landmarks[10].y,
    landmarks[16].y < landmarks[14].y,
    landmarks[20].y < landmarks[18].y
  ];
  const raised = fingers.filter(Boolean).length;
  if (raised === 0) return "pierre";
  if (raised >= 4) return "feuille";
  if (fingers[0] && fingers[1] && !fingers[2] && !fingers[3]) return "ciseaux";
  return null;
}

async function startCamera() {
  if (cameraStream) return;
  try {
    cameraStatus.textContent = "Chargement de MediaPipe...";
    gestureStatus.textContent = "Autorisez la webcam puis placez votre main face à l’objectif.";
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
    const fileset = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
    const options = {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    };
    try {
      landmarker = await vision.HandLandmarker.createFromOptions(fileset, options);
    } catch (gpuError) {
      console.warn("MediaPipe GPU indisponible, repli CPU :", gpuError);
      landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" }
      });
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 }, audio: false });
    camera.srcObject = cameraStream;
    await camera.play();
    cameraStatus.textContent = "Main détectée par IA";
    cameraDot.className = "w-2 h-2 rounded-full bg-emerald-400";
    startCameraButton.textContent = "Caméra active";
    detectGesture();
  } catch (error) {
    cameraStatus.textContent = "Caméra indisponible";
    cameraDot.className = "w-2 h-2 rounded-full bg-rose-400";
    gestureStatus.textContent = "Ouvrez la page via http://localhost pour autoriser la webcam, puis réessayez.";
    console.error("Chifumi MediaPipe:", error);
  }
}

function detectGesture() {
  if (!landmarker || camera.readyState < 2) return;
  detectionFrame += 1;
  if (detectionFrame % 2 === 0 && playerScore < 3 && aiScore < 3 && !resolving) {
    const resultData = landmarker.detectForVideo(camera, performance.now());
    const gesture = resultData.landmarks?.[0] ? classifyGesture(resultData.landmarks[0]) : null;
    if (gesture && gesture === stableGesture) stableGestureCount += 1;
    else { stableGesture = gesture; stableGestureCount = gesture ? 1 : 0; }
    if (gesture) gestureStatus.textContent = `Geste reconnu : ${getChoice(gesture).label}. Gardez-le stable...`;
    if (stableGestureCount >= 12) resolveRound(gesture);
  }
  window.requestAnimationFrame(detectGesture);
}

function openChifumi() {
  pausedArcadeState = window.arcadeSession?.pause() || null;
  document.getElementById("modal-overlay").classList.add("hidden");
  panel.classList.remove("hidden");
  resetGame();
  startCamera();
}

function closeChifumi() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  camera.srcObject = null;
  panel.classList.add("hidden");
  if (pausedArcadeState?.wasRunning) {
    window.arcadeSession.resume(pausedArcadeState);
  } else {
    document.getElementById("modal-overlay").classList.remove("hidden");
  }
  pausedArcadeState = null;
}

document.getElementById("btn-open-chifumi").addEventListener("click", openChifumi);
document.getElementById("btn-modal-chifumi").addEventListener("click", openChifumi);
document.getElementById("btn-close-chifumi").addEventListener("click", closeChifumi);
document.getElementById("btn-reset-chifumi").addEventListener("click", resetGame);
startCameraButton.addEventListener("click", startCamera);
