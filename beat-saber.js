window.BEAT_SABER_MODE = Object.freeze({
  id: "BEAT_SABER",
  label: "⚡ HAND SABER",
  startLabel: "Jouer à Hand Saber (Webcam)",
  quickSwitchLabel: "Passer à Fruit Ninja 🍉",
  statLabel: "Précision",
  badgeClass: "bg-cyan-500/20 text-cyan-300"
});

let cubes = [];
    function getLaneScreenCoords(lane, z, cx, cy) {
      const easeZ = z * z;
      const endX = lane.endFactorX * canvas.width;
      const endY = lane.endFactorY * canvas.height;
      return {
        x: cx + lane.startOffsetX * (1 - easeZ) + endX * easeZ,
        y: cy + lane.startOffsetY * (1 - easeZ) + endY * easeZ
      };
    }

let slicedHalves = [];
let tunnelRings = [0.15, 0.45, 0.75];
    // 4A. JEU #1 : HAND SABER (2 Couleurs Strictes + Croisements Anti-Camping)
    // ============================================================================
    const LANES = [
      { id: 0, startOffsetX: -70, startOffsetY: -15, endFactorX: -0.32, endFactorY: -0.08 },
      { id: 1, startOffsetX: -25, startOffsetY:  25, endFactorX: -0.11, endFactorY:  0.16 },
      { id: 2, startOffsetX:  25, startOffsetY:  25, endFactorX:  0.11, endFactorY:  0.16 },
      { id: 3, startOffsetX:  70, startOffsetY: -15, endFactorX:  0.32, endFactorY: -0.08 }
    ];

    // Flèches directionnelles de coupe (Beat Saber style : Haut, Bas, Gauche, Droite, ou Point libre)
    const SLASH_DIRS = [
      { id: "ANY",   symbol: "●", vx: 0,  vy: 0 },
      { id: "LEFT",  symbol: "◄", vx: -1, vy: 0 },
      { id: "RIGHT", symbol: "►", vx: 1,  vy: 0 },
      { id: "UP",    symbol: "▲", vx: 0,  vy: -1 },
      { id: "DOWN",  symbol: "▼", vx: 0,  vy: 1 }
    ];

    function spawnBeatCube(beatStep) {
      if (cubes.length > 7) return;

      // 1 fois sur 3, on lance un accord de 2 cubes simultanés (1 Cyan + 1 Rose)
      const isDouble = beatStep % 6 === 0;
      const count = isDouble ? 2 : 1;
      const usedLanes = new Set();

      for (let i = 0; i < count; i++) {
        let laneIdx = Math.floor(Math.random() * LANES.length);
        while (usedLanes.has(laneIdx)) {
          laneIdx = (laneIdx + 1) % LANES.length;
        }
        usedLanes.add(laneIdx);

        const lane = LANES[laneIdx];
        const isGold = beatStep % 16 === 0 && i === 0;

        // ANTI-CAMPING : La couleur du cube N'EST PAS attachée à la piste !
        // Un cube ROSE peut arriver à gauche et un cube CYAN à droite, forçant à bouger/croiser les doigts.
        let requiredBlade = "CYAN";
        if (isGold) {
          requiredBlade = "ANY";
        } else if (isDouble) {
          requiredBlade = i === 0 ? "CYAN" : "PINK";
        } else {
          // 40% de chance d'inverser le côté naturel pour forcer le joueur à traverser l'écran !
          const naturalCyan = laneIdx <= 1;
          const crossover = Math.random() < 0.42;
          requiredBlade = (naturalCyan !== crossover) ? "CYAN" : "PINK";
        }

        const cubeColor =
          requiredBlade === "ANY"
            ? "#ffee00"
            : requiredBlade === "CYAN"
            ? "#00f3ff"
            : "#ff0055";

        const dirSpec = SLASH_DIRS[Math.floor(Math.random() * SLASH_DIRS.length)];

        cubes.push({
          requiredBlade, // "CYAN" | "PINK" | "ANY"
          isCrossover: (requiredBlade === "CYAN" && laneIdx >= 2) || (requiredBlade === "PINK" && laneIdx <= 1),
          dirSpec,
          lane,
          color: cubeColor,
          z: 0.02,
          speedZ: 0.0088 + Math.min(score / 80000, 0.004),
          rotation: 0,
          rotSpeed: (Math.random() - 0.5) * 0.012,
          x: canvas.width / 2 + lane.startOffsetX,
          y: canvas.height / 2 + lane.startOffsetY,
          size: 16,
          warnCooldown: 0
        });
      }
    }

    function sliceCube(cube, index, blade) {
      cubes.splice(index, 1);
      itemsSliced++;
      combo++;
      multiplier = combo >= 20 ? 8 : combo >= 10 ? 4 : combo >= 4 ? 2 : 1;

      const isGold = cube.requiredBlade === "ANY";
      const crossoverBonus = cube.isCrossover ? 50 : 0;
      const earned = (isGold ? 250 : 100 + crossoverBonus) * multiplier;
      score += earned;

      audio.playSliceSound(isGold);
      updateHUD();

      const sliceAngle = Math.atan2(blade.vy || 1, blade.vx || 1);
      const perpAngle = sliceAngle + Math.PI / 2;

      [-1, 1].forEach((dir) => {
        slicedHalves.push({
          x: cube.x,
          y: cube.y,
          vx: Math.cos(perpAngle) * dir * 6.5 + blade.vx * 0.15,
          vy: Math.sin(perpAngle) * dir * 6.5 - 3,
          size: cube.size,
          color: cube.color,
          rotation: cube.rotation,
          rotSpeed: dir * 0.12,
          alpha: 1
        });
      });

      spawnParticles(cube.x, cube.y, cube.color, 10);

      floatingTexts.push({
        x: cube.x,
        y: cube.y - 15,
        text: isGold ? `★ OR +${earned} ★` : cube.isCrossover ? `⚡ CROSS +${earned}` : `+${earned}`,
        subText: blade.name,
        color: cube.color,
        alpha: 1,
        vy: -2.4
      });
    }

    // ============================================================================
    function drawCyberTunnel(cx, cy) {
      ctx.save();

      for (let i = 0; i < LANES.length; i++) {
        const lane = LANES[i];
        const pStart = getLaneScreenCoords(lane, 0.02, cx, cy);
        const pHitMin = getLaneScreenCoords(lane, HIT_ZONE_MIN_Z, cx, cy);
        const pHitMax = getLaneScreenCoords(lane, HIT_ZONE_MAX_Z, cx, cy);
        const pEnd = getLaneScreenCoords(lane, 1.05, cx, cy);

        ctx.beginPath();
        ctx.moveTo(pStart.x, pStart.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        ctx.lineWidth = 2;
        ctx.stroke();

        const laneHintColor = i <= 1 ? "#00f3ff" : "#ff0055";
        ctx.beginPath();
        ctx.moveTo(pHitMin.x, pHitMin.y);
        ctx.lineTo(pHitMax.x, pHitMax.y);
        ctx.strokeStyle = laneHintColor;
        ctx.lineWidth = 5;
        ctx.stroke();

        const pTarget = getLaneScreenCoords(lane, 0.84, cx, cy);
        ctx.beginPath();
        ctx.arc(pTarget.x, pTarget.y, 26, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (let i = 0; i < tunnelRings.length; i++) {
        tunnelRings[i] += 0.004;
        if (tunnelRings[i] > 1) tunnelRings[i] = 0.05;
        const r = (tunnelRings[i] ** 2) * Math.max(canvas.width, canvas.height) * 0.55;
        ctx.strokeStyle = `rgba(255, 255, 255, ${tunnelRings[i] * 0.1})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - r, cy - r * 0.55, r * 2, r * 1.1);
      }

      ctx.font = "700 12px 'Orbitron', sans-serif";
      ctx.fillStyle = "#00f3ff";
      ctx.textAlign = "center";
      ctx.fillText("⚡ DOIGT CYAN = CUBES CYANS   |   DOIGT ROSE = CUBES ROSES (ATTENTION AUX CROISEMENTS !) ⚡", cx, 88);

      ctx.restore();
    }

    function drawNeonCube(cube) {
      const inHitZone = cube.z >= HIT_ZONE_MIN_Z && cube.z <= HIT_ZONE_MAX_Z;

      ctx.save();
      ctx.translate(cube.x, cube.y);
      ctx.rotate(cube.rotation);

      const s = cube.size;
      const half = s / 2;

      ctx.globalAlpha = inHitZone ? 1.0 : Math.max(0.28, cube.z * 0.75);

      // Halo externe rapide (Zéro shadowBlur !)
      if (inHitZone) {
        ctx.strokeStyle = cube.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, half * 1.35, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = inHitZone ? "#10142a" : "#0a0c1a";
      ctx.strokeStyle = inHitZone ? "#ffffff" : cube.color;
      ctx.lineWidth = inHitZone ? 4 : 2.5;

      ctx.strokeRect(-half, -half, s, s);
      ctx.fillRect(-half, -half, s, s);

      // Cadre intérieur de la couleur stricte du doigt requis
      ctx.strokeStyle = cube.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(-half + 5, -half + 5, s - 10, s - 10);

      // Flèche directionnelle / Symbole au centre du cube
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${Math.max(11, Math.round(s * 0.42))}px 'Orbitron', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cube.dirSpec.symbol, 0, 0);

      // Badge "CROSS" si le cube a croisé la piste opposée
      if (cube.isCrossover && inHitZone) {
        ctx.font = "800 10px 'Orbitron', sans-serif";
        ctx.fillStyle = cube.color;
        ctx.fillText("CROSS", 0, -half - 8);
      }

      ctx.restore();
    }

    // Rendu de lame ultra-rapide en 2 passes (Halo large + Coeur blanc) sans shadowBlur

    function updateBeatSaberGame(cx, cy) {
      // 4A. LOGIQUE & RENDU : HAND SABER (Vérification stricte de la couleur du doigt !)
      if (isRunning && selectedGame === "BEAT_SABER") {
        for (let i = cubes.length - 1; i >= 0; i--) {
          const c = cubes[i];
          c.z += c.speedZ;
          c.rotation += c.rotSpeed;
          if (c.warnCooldown > 0) c.warnCooldown--;

          const pos = getLaneScreenCoords(c.lane, c.z, cx, cy);
          c.x = pos.x;
          c.y = pos.y;
          c.size = 18 + (c.z * c.z) * 90;

          drawNeonCube(c);

          if (c.z >= HIT_ZONE_MIN_Z && c.z <= HIT_ZONE_MAX_Z) {
            const hitRadius = c.size * 0.65;
            let slicedBy = null;

            for (let b = 0; b < blades.length; b++) {
              const blade = blades[b];
              if (!blade.active || blade.trail.length < 2) continue;

              const prev = blade.trail[blade.trail.length - 2];
              const d = distToSegment(c.x, c.y, prev.x, prev.y, blade.x, blade.y);

              if (d <= hitRadius) {
                // 1) Vérifier la vitesse minimale (interdit de laisser son doigt sur place)
                if (blade.speed < MIN_SLASH_SPEED) {
                  if (c.warnCooldown === 0) {
                    c.warnCooldown = 25;
                    floatingTexts.push({
                      x: c.x,
                      y: c.y - 25,
                      text: "BOUGEZ LE DOIGT !",
                      subText: "Doigt trop statique",
                      color: "#ffaa00",
                      alpha: 1,
                      vy: -1.8
                    });
                  }
                  continue;
                }

                // 2) Vérifier la COULEUR STRICTE du doigt !
                const colorMatches =
                  c.requiredBlade === "ANY" || c.requiredBlade === blade.id;

                if (!colorMatches) {
                  if (c.warnCooldown === 0) {
                    c.warnCooldown = 30;
                    combo = 0;
                    multiplier = 1;
                    audio.playWrongColorSound();
                    updateHUD();
                    floatingTexts.push({
                      x: c.x,
                      y: c.y - 28,
                      text: "✖ MAUVAIS DOIGT !",
                      subText: c.requiredBlade === "CYAN" ? "Utilisez le doigt CYAN" : "Utilisez le doigt ROSE",
                      color: "#ff3355",
                      alpha: 1,
                      vy: -2.0
                    });
                  }
                  continue;
                }

                slicedBy = blade;
                break;
              }
            }

            if (slicedBy) {
              sliceCube(c, i, slicedBy);
              continue;
            }
          }

          if (c.z >= 1.12) {
            cubes.splice(i, 1);
            itemsMissed++;
            combo = 0;
            multiplier = 1;
            audio.playMissSound();
            updateHUD();

            floatingTexts.push({
              x: c.x,
              y: c.y,
              text: "MANQUÉ",
              subText: "",
              color: "#ff3355",
              alpha: 1,
              vy: -1.6
            });
          }
        }
      }

    }
