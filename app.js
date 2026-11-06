    let HandLandmarker;
    let FilesetResolver;

    // --- ÉLÉMENTS DOM ---
    const video = document.getElementById("webcam-video");
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d", { alpha: false }); // alpha: false accélère le rendu Canvas sous Linux

    const modalOverlay = document.getElementById("modal-overlay");
    const loadingBox = document.getElementById("loading-box");
    const loadingMsg = document.getElementById("loading-msg");
    const btnStartWebcam = document.getElementById("btn-start-webcam");
    const lblStartWebcam = document.getElementById("lbl-start-webcam");
    const btnStartMouse = document.getElementById("btn-start-mouse");
    const btnToggleSkeleton = document.getElementById("btn-toggle-skeleton");
    const lblSkeleton = document.getElementById("lbl-skeleton");
    const btnToggleCamBg = document.getElementById("btn-toggle-cam-bg");
    const btnToggleAudio = document.getElementById("btn-toggle-audio");
    const iconAudio = document.getElementById("icon-audio");
    const btnOpenMenu = document.getElementById("btn-open-menu");
    const btnQuickSwitch = document.getElementById("btn-quick-switch");
    const lblQuickSwitch = document.getElementById("lbl-quick-switch");

    const cardGameSaber = document.getElementById("card-game-saber");
    const cardGameFruit = document.getElementById("card-game-fruit");
    const checkSaber = document.getElementById("check-saber");
    const checkFruit = document.getElementById("check-fruit");

    const hudScore = document.getElementById("hud-score");
    const hudMultiplier = document.getElementById("hud-multiplier");
    const hudCombo = document.getElementById("hud-combo");
    const hudAccuracy = document.getElementById("hud-accuracy");
    const hudStatLabel = document.getElementById("hud-stat-label");
    const hudGameBadge = document.getElementById("hud-game-badge");
    const hudFps = document.getElementById("hud-fps");
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");
    const telHands = document.getElementById("tel-hands");
    const telLeftCoords = document.getElementById("tel-left-coords");
    const telRightCoords = document.getElementById("tel-right-coords");
    const telVelocity = document.getElementById("tel-velocity");
    const telSlashStatus = document.getElementById("tel-slash-status");

    // --- CONSTANTES DE GAMEPLAY ---
    const HIT_ZONE_MIN_Z = 0.68;
    const HIT_ZONE_MAX_Z = 0.96;
    const MIN_SLASH_SPEED = 9; // Vitesse minimale pour trancher (oblige à bouger le doigt)

    // --- ÉTAT GLOBAL ---
    let handLandmarker = null;
    let isRunning = false;
    let selectedGame = window.BEAT_SABER_MODE.id;
    let controlMode = "NONE";
    let showSkeleton = true;
    let showCamBg = false; // Désactivé par défaut pour maximiser les FPS et la lisibilité (activable en 1 clic)

    let score = 0;
    let combo = 0;
    let multiplier = 1;
    let itemsSliced = 0;
    let itemsMissed = 0;

    // Mesure FPS & Cadence IA découplée (évite d'appeler MediaPipe 60x/s si la webcam est à 30fps)
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let currentFps = 60;
    let lastVideoTime = -1;
    let lastDetectionTimestamp = 0;
    const DETECTION_INTERVAL_MS = 32; // ~30 détections IA/sec = 60 FPS constants pour le rendu !

    // Connexions simplifiées pour dessiner le squelette ultra-rapidement en 1 seul Path
    const HAND_CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[0,17],[17,18],[18,19],[19,20]
    ];

    // ============================================================================
    // LES 2 SABRES DE COULEURS STRICTES : CYAN (#00f3ff) & ROSE (#ff0055)
    // ============================================================================
    const blades = [
      {
        id: "CYAN",
        name: "Sabre CYAN",
        color: "#00f3ff",
        active: false,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        vx: 0,
        vy: 0,
        speed: 0,
        trail: []
      },
      {
        id: "PINK",
        name: "Sabre ROSE",
        color: "#ff0055",
        active: false,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        vx: 0,
        vy: 0,
        speed: 0,
        trail: []
      }
    ];

    let detectedHandSkeletons = [];

    // Effets visuels (plafonnés pour garantir 60 FPS)
    let particles = [];
    let floatingTexts = [];
    let screenFlashColor = null;
    let screenFlashAlpha = 0;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // ============================================================================
    // SÉLECTION DU JEU
    // ============================================================================
    function selectGameMode(mode) {
      selectedGame = mode;
      cubes = [];
      slicedHalves = [];
      fruits = [];
      slicedFruits = [];
      juiceSplats = [];
      slowMoTimer = 0;

      if (mode === "BEAT_SABER") {
        cardGameSaber.className = "cursor-pointer rounded-2xl p-4 border-2 border-cyan-400 bg-cyan-500/15 transition transform hover:scale-[1.01] relative";
        cardGameFruit.className = "cursor-pointer rounded-2xl p-4 border-2 border-white/15 bg-white/5 hover:bg-white/10 transition transform hover:scale-[1.01] relative";
        checkSaber.className = "fa-solid fa-circle-check text-cyan-400 text-lg";
        checkFruit.className = "fa-regular fa-circle text-slate-500 text-lg";
        lblStartWebcam.textContent = window.BEAT_SABER_MODE.startLabel;
        hudGameBadge.textContent = window.BEAT_SABER_MODE.label;
        hudGameBadge.className = `px-2.5 py-0.5 rounded-full ${window.BEAT_SABER_MODE.badgeClass} font-cyber font-bold text-[11px]`;
        lblQuickSwitch.textContent = window.BEAT_SABER_MODE.quickSwitchLabel;
        hudStatLabel.textContent = window.BEAT_SABER_MODE.statLabel;
      } else {
        cardGameFruit.className = "cursor-pointer rounded-2xl p-4 border-2 border-pink-500 bg-pink-500/15 transition transform hover:scale-[1.01] relative";
        cardGameSaber.className = "cursor-pointer rounded-2xl p-4 border-2 border-white/15 bg-white/5 hover:bg-white/10 transition transform hover:scale-[1.01] relative";
        checkFruit.className = "fa-solid fa-circle-check text-pink-400 text-lg";
        checkSaber.className = "fa-regular fa-circle text-slate-500 text-lg";
        lblStartWebcam.textContent = window.FRUIT_NINJA_MODE.startLabel;
        hudGameBadge.textContent = window.FRUIT_NINJA_MODE.label;
        hudGameBadge.className = `px-2.5 py-0.5 rounded-full ${window.FRUIT_NINJA_MODE.badgeClass} font-cyber font-bold text-[11px]`;
        lblQuickSwitch.textContent = window.FRUIT_NINJA_MODE.quickSwitchLabel;
        hudStatLabel.textContent = window.FRUIT_NINJA_MODE.statLabel;
      }
      updateHUD();
    }

    cardGameSaber.addEventListener("click", () => selectGameMode(window.BEAT_SABER_MODE.id));
    cardGameFruit.addEventListener("click", () => selectGameMode(window.FRUIT_NINJA_MODE.id));

    btnQuickSwitch.addEventListener("click", () => {
      selectGameMode(selectedGame === "BEAT_SABER" ? "FRUIT_NINJA" : "BEAT_SABER");
    });

    // ============================================================================
    // 1. SYNTHÉTISEUR AUDIO PROCÉDURAL
    // ============================================================================
    class SynthwaveAudioEngine {
      constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.isMuted = false;
        this.bpm = 122;
        this.step = 0;
        this.timerId = null;
        this.bassScale = [55.0, 55.0, 65.41, 55.0, 43.65, 43.65, 49.0, 55.0];
        this.arpScale = [220, 261.63, 329.63, 440, 329.63, 261.63, 392.0, 329.63];
      }

      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioCtx();
        }
        if (this.ctx.state === "suspended") {
          this.ctx.resume();
        }
      }

      startBeatLoop(onBeatSpawnCallback) {
        this.init();
        if (this.isPlaying) return;
        this.isPlaying = true;

        const stepDurationMs = (60 / this.bpm / 2) * 1000;

        this.timerId = setInterval(() => {
          if (!isRunning) return;

          if (!this.isMuted && this.ctx) {
            const now = this.ctx.currentTime;
            if (selectedGame === "BEAT_SABER") {
              if (this.step % 2 === 0) this.playKick(now);
              else this.playHiHat(now);
              this.playBass(now, this.bassScale[this.step % this.bassScale.length]);
              this.playArp(now, this.arpScale[this.step % this.arpScale.length]);
            } else {
              if (this.step % 4 === 0) this.playKick(now);
              if (this.step % 2 === 1) this.playHiHat(now);
            }
          }

          if (this.step % 2 === 0 && onBeatSpawnCallback) {
            onBeatSpawnCallback(this.step);
          }

          this.step++;
        }, stepDurationMs);
      }

      playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(130, time);
        osc.frequency.exponentialRampToValueAtTime(32, time + 0.13);
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.17);
      }

      playHiHat(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(6400, time);
        gain.gain.setValueAtTime(0.04, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.05);
      }

      playBass(time, freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.11, time);
        gain.gain.exponentialRampToValueAtTime(0.005, time + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.19);
      }

      playArp(time, freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.04, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.12);
      }

      playSliceSound(isGold = false) {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isGold ? "triangle" : "sawtooth";
        osc.frequency.setValueAtTime(isGold ? 920 : 560 + Math.min(combo * 14, 400), now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.11);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(timeOrNow(now) + 0.13);
      }

      playFruitSquishSound(isBonus = false) {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isBonus ? "triangle" : "sine";
        osc.frequency.setValueAtTime(340 + Math.random() * 160, now);
        osc.frequency.exponentialRampToValueAtTime(isBonus ? 1200 : 860, now + 0.09);
        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
      }

      playBombExplosionSound() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.32);
        gain.gain.setValueAtTime(0.42, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      }

      playWrongColorSound() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.setValueAtTime(135, now + 0.07);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
      }

      playMissSound() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.linearRampToValueAtTime(75, now + 0.18);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    }

    function timeOrNow(t) { return t; }
    const audio = new SynthwaveAudioEngine();

    // ============================================================================
    // 2. INITIALISATION MEDIAPIPE ULTRA-LÉGÈRE (Caméra 320x240 = Gain FPS massif)
    // ============================================================================
    async function initMediaPipeAndCamera() {
      try {
        loadingBox.classList.remove("hidden");
        loadingMsg.textContent = "Chargement du modèle GPU MediaPipe (Optimisé Ubuntu)...";

        const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
        HandLandmarker = vision.HandLandmarker;
        FilesetResolver = vision.FilesetResolver;

        if (!handLandmarker) {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
          );

          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.45,
            minHandPresenceConfidence: 0.45,
            minTrackingConfidence: 0.45
          });
        }

        loadingMsg.textContent = "Activation Webcam basse latence (320x240)...";
        // Résolution 320x240 : 4x moins de pixels à transférer au WASM = FPS doublés sur laptop !
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });

        video.srcObject = stream;
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            video.play();
            resolve();
          };
        });

        controlMode = "WEBCAM";
        video.classList.toggle("hidden", !showCamBg);
        statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
        statusText.textContent = "2 Doigts Actifs";
        loadingBox.classList.add("hidden");
        startGameSession();
      } catch (err) {
        console.warn("Webcam indisponible, passage au mode Souris :", err);
        loadingBox.classList.remove("hidden");
        loadingMsg.textContent = "Webcam non détectée. Passage en Mode Souris 2 Couleurs !";
        setTimeout(() => {
          loadingBox.classList.add("hidden");
          startMouseFallbackMode();
        }, 1000);
      }
    }

    function startMouseFallbackMode() {
      controlMode = "MOUSE";
      video.classList.add("hidden");
      statusDot.className = "w-2.5 h-2.5 rounded-full bg-cyan-400";
      statusText.textContent = "Souris 2 Sabres";
      startGameSession();
    }

    function startGameSession() {
      modalOverlay.classList.add("hidden");
      isRunning = true;
      audio.startBeatLoop((beatStep) => {
        if (selectedGame === "BEAT_SABER") {
          spawnBeatCube(beatStep);
        }
      });
    }

    window.arcadeSession = {
      pause() {
        const state = { wasRunning: isRunning, controlMode };
        isRunning = false;
        if (audio.timerId) {
          clearInterval(audio.timerId);
          audio.timerId = null;
        }
        audio.isPlaying = false;
        if (video.srcObject) {
          video.srcObject.getTracks().forEach((track) => track.stop());
          video.srcObject = null;
        }
        canvas.classList.add("hidden");
        video.classList.add("hidden");
        return state;
      },
      resume(state) {
        canvas.classList.remove("hidden");
        if (!state?.wasRunning) return;
        if (state.controlMode === "WEBCAM") initMediaPipeAndCamera();
        else startMouseFallbackMode();
      }
    };

    // ============================================================================
    // 3. TRACKING 2 DOIGTS COLORÉS (Découplé à 30Hz + Interpolation 60FPS)
    // - Si 1 seule main est visible :
    //     Index (#8)  = Sabre CYAN
    //     Majeur (#12) = Sabre ROSE
    // - Si 2 mains sont visibles :
    //     Index Main Gauche (#8) = Sabre CYAN
    //     Index Main Droite (#8) = Sabre ROSE
    // ============================================================================
    function setBladeTarget(blade, tx, ty) {
      if (!blade.active) {
        blade.x = tx;
        blade.y = ty;
        blade.targetX = tx;
        blade.targetY = ty;
        blade.active = true;
      } else {
        blade.targetX = tx;
        blade.targetY = ty;
      }
    }

    function interpolateBladesEachFrame() {
      let maxSpeed = 0;
      for (let i = 0; i < blades.length; i++) {
        const b = blades[i];
        if (!b.active) {
          if (b.trail.length > 0) b.trail.shift();
          continue;
        }
        const nextX = b.x + (b.targetX - b.x) * 0.65;
        const nextY = b.y + (b.targetY - b.y) * 0.65;
        b.vx = nextX - b.x;
        b.vy = nextY - b.y;
        b.speed = Math.hypot(b.vx, b.vy);
        b.x = nextX;
        b.y = nextY;

        if (b.speed > maxSpeed) maxSpeed = b.speed;

        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 8) {
          b.trail.shift();
        }
      }

      // Mise à jour télémétrie légère (1 fois toutes les 6 frames pour économiser le DOM)
      if (frameCount % 6 === 0) {
        const spd = Math.round(maxSpeed);
        telVelocity.textContent = `${spd} px/f`;
        if ( blades[0].active ) {
          telLeftCoords.textContent = `X:${Math.round(blades[0].x)} Y:${Math.round(blades[0].y)}`;
        } else {
          telLeftCoords.textContent = "Inactif";
        }
        if ( blades[1].active ) {
          telRightCoords.textContent = `X:${Math.round(blades[1].x)} Y:${Math.round(blades[1].y)}`;
        } else {
          telRightCoords.textContent = "Inactif";
        }
      }
    }

    function processMediaPipeHands(now) {
      if (!handLandmarker || video.readyState < 2) return;
      // Limiter l'appel WebAssembly à ~30 fois par seconde maximum
      if (now - lastDetectionTimestamp < DETECTION_INTERVAL_MS) return;
      if (lastVideoTime === video.currentTime) return;

      lastDetectionTimestamp = now;
      lastVideoTime = video.currentTime;

      const results = handLandmarker.detectForVideo(video, now);
      detectedHandSkeletons = [];

      const numHands = results.landmarks ? results.landmarks.length : 0;

      if (numHands === 1) {
        // 1 SEULE MAIN : Index (#8) = CYAN, Majeur (#12) = ROSE
        const lm = results.landmarks[0];
        detectedHandSkeletons.push({ landmarks: lm, mode: "SINGLE_HAND" });

        const indexPt = lm[8];
        const middlePt = lm[12];

        setBladeTarget(blades[0], (1 - indexPt.x) * canvas.width, indexPt.y * canvas.height);
        setBladeTarget(blades[1], (1 - middlePt.x) * canvas.width, middlePt.y * canvas.height);
        if (frameCount % 10 === 0) telHands.textContent = "1 Main (Index + Majeur)";
      } else if (numHands >= 2) {
        // 2 MAINS : Main à gauche de l'écran = CYAN, Main à droite = ROSE
        const lm0 = results.landmarks[0];
        const lm1 = results.landmarks[1];
        const x0 = (1 - lm0[8].x) * canvas.width;
        const x1 = (1 - lm1[8].x) * canvas.width;

        const leftHand = x0 <= x1 ? lm0 : lm1;
        const rightHand = x0 <= x1 ? lm1 : lm0;

        detectedHandSkeletons.push({ landmarks: leftHand, color: "#00f3ff" });
        detectedHandSkeletons.push({ landmarks: rightHand, color: "#ff0055" });

        setBladeTarget(blades[0], (1 - leftHand[8].x) * canvas.width, leftHand[8].y * canvas.height);
        setBladeTarget(blades[1], (1 - rightHand[8].x) * canvas.width, rightHand[8].y * canvas.height);
        if (frameCount % 10 === 0) telHands.textContent = "2 Mains (2 Index)";
      } else {
        blades[0].active = false;
        blades[1].active = false;
        if (frameCount % 10 === 0) telHands.textContent = "Aucune main détectée";
      }
    }

    // Mode Souris : Les 2 doigts (Cyan à gauche du curseur, Rose à droite) bougent ensemble,
    // et Espace / Clic inverse leur position pour croiser les pistes !
    let mouseSwapped = false;
    let lastMouseX = window.innerWidth / 2;
    let lastMouseY = window.innerHeight / 2;

    function updateMouseBlades(clientX, clientY) {
      if (controlMode !== "MOUSE") return;
      lastMouseX = clientX;
      lastMouseY = clientY;
      const offset = mouseSwapped ? -55 : 55;
      setBladeTarget(blades[0], clientX - offset, clientY);
      setBladeTarget(blades[1], clientX + offset, clientY);
    }

    window.addEventListener("mousemove", (e) => updateMouseBlades(e.clientX, e.clientY));
    window.addEventListener("mousedown", () => {
      if (controlMode === "MOUSE") {
        mouseSwapped = !mouseSwapped;
        updateMouseBlades(lastMouseX, lastMouseY);
      }
    });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && controlMode === "MOUSE") {
        mouseSwapped = !mouseSwapped;
        updateMouseBlades(lastMouseX, lastMouseY);
      }
    });
    window.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length > 0) {
          updateMouseBlades(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );

    // ============================================================================
    // 5. RENDU GRAPHIQUE ULTRA-RAPIDE (ZÉRO shadowBlur = 60 FPS Ubuntu)
    // ============================================================================
    function drawAllMediaPipeSkeletons() {
      if (!showSkeleton || detectedHandSkeletons.length === 0) return;

      ctx.save();
      ctx.lineWidth = 2;

      for (let h = 0; h < detectedHandSkeletons.length; h++) {
        const hand = detectedHandSkeletons[h];
        const lm = hand.landmarks;

        ctx.strokeStyle = hand.color || "rgba(255, 255, 255, 0.5)";
        ctx.beginPath();
        for (let c = 0; c < HAND_CONNECTIONS.length; c++) {
          const p1 = lm[HAND_CONNECTIONS[c][0]];
          const p2 = lm[HAND_CONNECTIONS[c][1]];
          ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
          ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
        }
        ctx.stroke();

        // Points des articulations en un seul path
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        for (let i = 0; i < lm.length; i++) {
          const px = (1 - lm[i].x) * canvas.width;
          const py = lm[i].y * canvas.height;
          ctx.moveTo(px + 3, py);
          ctx.arc(px, py, 3, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      ctx.restore();
    }

    function drawBladeTrail(blade) {
      if (!blade.active || blade.trail.length < 2) return;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Passe 1 : Halo coloré externe
      ctx.beginPath();
      ctx.moveTo(blade.trail[0].x, blade.trail[0].y);
      for (let i = 1; i < blade.trail.length; i++) {
        ctx.lineTo(blade.trail[i].x, blade.trail[i].y);
      }
      ctx.strokeStyle = blade.color;
      ctx.lineWidth = 14;
      ctx.globalAlpha = 0.65;
      ctx.stroke();

      // Passe 2 : Coeur laser blanc
      ctx.beginPath();
      ctx.moveTo(blade.trail[0].x, blade.trail[0].y);
      for (let i = 1; i < blade.trail.length; i++) {
        ctx.lineTo(blade.trail[i].x, blade.trail[i].y);
      }
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.globalAlpha = 1;
      ctx.stroke();

      // Anneau d'identification de couleur sur le bout du doigt
      ctx.beginPath();
      ctx.arc(blade.x, blade.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = blade.color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(blade.x, blade.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.restore();
    }

    // ============================================================================
    // 6. BOUCLE PRINCIPALE 60 FPS
    // ============================================================================
    function gameLoop(now) {
      frameCount++;
      if (now - lastFrameTime >= 500) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFrameTime));
        hudFps.textContent = `${currentFps} FPS`;
        hudFps.className = currentFps >= 45
          ? "font-mono text-emerald-400 font-bold"
          : "font-mono text-amber-400 font-bold";
        frameCount = 0;
        lastFrameTime = now;
      }

      // Le canvas est opaque et placé au-dessus de la balise vidéo : on dessine donc la webcam ici.
      if (showCamBg && controlMode === "WEBCAM" && video.readyState >= 2) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.fillStyle = "rgba(6, 6, 16, 0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#06060e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // 1. Détection IA découplée (30 Hz) + Interpolation fluide des 2 sabres (60 Hz)
      if (isRunning && controlMode === "WEBCAM") {
        processMediaPipeHands(now);
      }
      interpolateBladesEachFrame();

      // 2. Décor du jeu actif
      if (selectedGame === "BEAT_SABER") {
        drawCyberTunnel(cx, cy);
      } else {
        drawFruitNinjaDojoBackdrop(cx);
      }

      // 3. Squelette IA
      drawAllMediaPipeSkeletons();

      updateBeatSaberGame(cx, cy);
      updateFruitNinjaGame(now);
      // 5. Moitiés de cubes (Beat Saber)
      for (let i = slicedHalves.length - 1; i >= 0; i--) {
        const h = slicedHalves[i];
        h.x += h.vx;
        h.y += h.vy;
        h.vy += 0.3;
        h.rotation += h.rotSpeed;
        h.alpha -= 0.035;

        if (h.alpha <= 0) {
          slicedHalves.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = h.alpha;
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rotation);
        ctx.strokeStyle = h.color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-h.size / 4, -h.size / 2, h.size / 2, h.size);
        ctx.restore();
      }

      // 6. Particules rapides (Zéro shadowBlur)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.04;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 7. Rendu des 2 Sabres (Cyan & Rose)
      drawBladeTrail(blades[0]);
      drawBladeTrail(blades[1]);

      // 8. Textes flottants (Zéro shadowBlur)
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy;
        ft.alpha -= 0.028;

        if (ft.alpha <= 0) {
          floatingTexts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.font = "900 21px 'Orbitron', sans-serif";
        ctx.fillStyle = ft.color;
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);

        if (ft.subText) {
          ctx.font = "700 11px 'Orbitron', sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(ft.subText, ft.x, ft.y + 16);
        }
        ctx.restore();
      }

      if (screenFlashAlpha > 0 && screenFlashColor) {
        ctx.fillStyle = `rgba(${screenFlashColor}, ${screenFlashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        screenFlashAlpha = Math.max(0, screenFlashAlpha - 0.04);
      }

      requestAnimationFrame(gameLoop);
    }

    // ============================================================================
    // 7. ÉVÉNEMENTS UI
    // ============================================================================
    btnStartWebcam.addEventListener("click", () => {
      audio.init();
      initMediaPipeAndCamera();
    });

    btnStartMouse.addEventListener("click", () => {
      audio.init();
      startMouseFallbackMode();
    });

    btnToggleSkeleton.addEventListener("click", () => {
      showSkeleton = !showSkeleton;
      lblSkeleton.textContent = showSkeleton ? "ON" : "OFF";
      btnToggleSkeleton.classList.toggle("border-cyan-400/50", showSkeleton);
    });

    btnToggleCamBg.addEventListener("click", () => {
      showCamBg = !showCamBg;
      const hasCameraStream = Boolean(video.srcObject);

      if (showCamBg && !hasCameraStream) {
        loadingBox.classList.remove("hidden");
        loadingMsg.textContent = "Activation de la webcam...";
        initMediaPipeAndCamera();
        return;
      }

      video.classList.toggle("hidden", !showCamBg || controlMode !== "WEBCAM");
      btnToggleCamBg.classList.toggle("border-pink-400/50", showCamBg);
      btnToggleCamBg.setAttribute("aria-pressed", String(showCamBg));
    });

    btnToggleAudio.addEventListener("click", () => {
      audio.isMuted = !audio.isMuted;
      iconAudio.className = audio.isMuted
        ? "fa-solid fa-volume-xmark text-rose-400"
        : "fa-solid fa-volume-high text-emerald-400";
    });

    btnOpenMenu.addEventListener("click", () => {
      isRunning = false;
      modalOverlay.classList.remove("hidden");
    });

    window.onload = () => {
      requestAnimationFrame(gameLoop);
    };
