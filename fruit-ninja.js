window.FRUIT_NINJA_MODE = Object.freeze({
  id: "FRUIT_NINJA",
  label: "🍉 FRUIT NINJA",
  startLabel: "Jouer à Fruit Ninja (Webcam)",
  quickSwitchLabel: "Passer à Hand Saber ⚡",
  statLabel: "Fruits Coupés",
  badgeClass: "bg-pink-500/20 text-pink-300"
});

let fruits = [];
let slicedFruits = [];
let juiceSplats = [];
let lastFruitWaveTime = 0;
let slowMoTimer = 0;
    // 4B. JEU #2 : CYBER FRUIT NINJA (Avec Banane Gel Slow-Mo ❄️ & Pastèque Royale 👑)
    // ============================================================================
    const FRUIT_CATALOG = [
      { name: "Pastèque",        rindColor: "#16a34a", fleshColor: "#f43f5e", radius: 44, points: 110, special: "NONE" },
      { name: "Orange",          rindColor: "#ea580c", fleshColor: "#fb923c", radius: 36, points: 100, special: "NONE" },
      { name: "Citron",          rindColor: "#ca8a04", fleshColor: "#facc15", radius: 35, points: 100, special: "NONE" },
      { name: "Kiwi",            rindColor: "#65a30d", fleshColor: "#a3e635", radius: 34, points: 120, special: "NONE" },
      { name: "Fraise",          rindColor: "#e11d48", fleshColor: "#fda4af", radius: 32, points: 140, special: "NONE" },
      { name: "Banane Gel ❄️",   rindColor: "#0284c7", fleshColor: "#38bdf8", radius: 40, points: 200, special: "FREEZE" },
      { name: "Fruit Dragon 👑", rindColor: "#eab308", fleshColor: "#fef08a", radius: 42, points: 350, special: "CROWN" }
    ];

    function spawnFruitWave(now) {
      const interval = slowMoTimer > 0 ? 1900 : 1250;
      if (now - lastFruitWaveTime < interval) return;
      lastFruitWaveTime = now;

      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const isBomb = Math.random() < 0.16 && i === count - 1;
        // Sélection pondérée (fruits normaux fréquents, Banane Gel et Fruit Dragon plus rares)
        const rand = Math.random();
        let spec = FRUIT_CATALOG[Math.floor(Math.random() * 5)];
        if (rand > 0.88) spec = FRUIT_CATALOG[6];      // Fruit Dragon 👑
        else if (rand > 0.76) spec = FRUIT_CATALOG[5]; // Banane Gel ❄️

        const startX = canvas.width * (0.15 + Math.random() * 0.7);
        const startY = canvas.height + 45;
        const targetX = canvas.width * (0.25 + Math.random() * 0.5);

        const vx = (targetX - startX) * 0.017;
        const vy = -(canvas.height * (0.0195 + Math.random() * 0.004));

        fruits.push({
          isBomb,
          name: isBomb ? "BOMBE" : spec.name,
          special: isBomb ? "BOMB" : spec.special,
          rindColor: isBomb ? "#1e293b" : spec.rindColor,
          fleshColor: isBomb ? "#ef4444" : spec.fleshColor,
          radius: isBomb ? 38 : spec.radius,
          points: isBomb ? -400 : spec.points,
          x: startX,
          y: startY,
          vx,
          vy,
          gravity: 0.25,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.08
        });
      }
    }

    function sliceFruitItem(fruit, index, blade) {
      fruits.splice(index, 1);

      if (fruit.isBomb) {
        combo = 0;
        multiplier = 1;
        score = Math.max(0, score - 400);
        screenFlashColor = "239, 68, 68";
        screenFlashAlpha = 0.55;
        audio.playBombExplosionSound();
        spawnParticles(fruit.x, fruit.y, "#ef4444", 16);
        floatingTexts.push({
          x: fruit.x,
          y: fruit.y,
          text: "💥 BOMBE -400 !",
          subText: "Attention aux pièges",
          color: "#ef4444",
          alpha: 1,
          vy: -2.2
        });
        updateHUD();
        return;
      }

      // Effets spéciaux fun
      if (fruit.special === "FREEZE") {
        slowMoTimer = 240; // 4 secondes de Slow-Motion !
        screenFlashColor = "56, 189, 248";
        screenFlashAlpha = 0.35;
      } else if (fruit.special === "CROWN") {
        screenFlashColor = "250, 204, 21";
        screenFlashAlpha = 0.35;
      }

      itemsSliced++;
      combo++;
      multiplier = combo >= 20 ? 8 : combo >= 10 ? 4 : combo >= 4 ? 2 : 1;
      const earned = fruit.points * multiplier;
      score += earned;

      audio.playFruitSquishSound(fruit.special !== "NONE");
      updateHUD();

      // Limiter le nombre de taches de jus au sol à 10 maximum pour les FPS
      if (juiceSplats.length > 10) juiceSplats.shift();
      juiceSplats.push({
        x: fruit.x,
        y: fruit.y,
        radius: fruit.radius * 1.25,
        color: fruit.fleshColor,
        alpha: 0.38
      });

      const sliceAngle = Math.atan2(blade.vy || 1, blade.vx || 1);
      [-1, 1].forEach((dir) => {
        slicedFruits.push({
          x: fruit.x,
          y: fruit.y,
          vx: fruit.vx + dir * 4.5,
          vy: fruit.vy - 2,
          radius: fruit.radius,
          rindColor: fruit.rindColor,
          fleshColor: fruit.fleshColor,
          rotation: sliceAngle + (dir === 1 ? 0 : Math.PI),
          rotSpeed: dir * 0.1,
          alpha: 1
        });
      });

      spawnParticles(fruit.x, fruit.y, fruit.fleshColor, 10);

      let label = `+${earned}`;
      if (fruit.special === "FREEZE") label = `❄️ SLOW-MO +${earned}`;
      else if (fruit.special === "CROWN") label = `👑 ROYAL +${earned}`;

      floatingTexts.push({
        x: fruit.x,
        y: fruit.y - 18,
        text: label,
        subText: `${fruit.name} (${blade.name})`,
        color: fruit.fleshColor,
        alpha: 1,
        vy: -2.4
      });
    }

    function spawnParticles(x, y, color, count = 10) {
      // Plafond strict de 45 particules max à l'écran pour 60 FPS garantis
      if (particles.length > 45) particles.splice(0, count);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 8;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          radius: 3 + Math.random() * 3.5,
          color,
          alpha: 1
        });
      }
    }

    function updateHUD() {
      hudScore.textContent = score.toLocaleString("fr-FR");
      hudMultiplier.textContent = `x${multiplier}`;
      hudCombo.textContent = `${combo}`;
      if (selectedGame === "BEAT_SABER") {
        const total = itemsSliced + itemsMissed;
        const acc = total > 0 ? Math.round((itemsSliced / total) * 100) : 100;
        hudAccuracy.textContent = `${acc}%`;
      } else {
        hudAccuracy.textContent = `${itemsSliced} 🍉`;
      }
    }

    function distToSegment(px, py, x1, y1, x2, y2) {
      const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
      if (l2 === 0) return Math.hypot(px - x1, py - y1);
      let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    // ============================================================================
    function drawFruitNinjaDojoBackdrop(cx) {
      ctx.save();

      for (let i = juiceSplats.length - 1; i >= 0; i--) {
        const s = juiceSplats[i];
        s.alpha -= 0.002;
        if (s.alpha <= 0) {
          juiceSplats.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.font = "700 12px 'Orbitron', sans-serif";
      ctx.fillStyle = slowMoTimer > 0 ? "#38bdf8" : "#ff6699";
      ctx.textAlign = "center";
      ctx.fillText(
        slowMoTimer > 0
          ? `❄️ MODE GEL SLOW-MOTION ACTIF (${(slowMoTimer / 60).toFixed(1)}s) ! TRANCHEZ TOUT ! ❄️`
          : "🍉 TRANCHEZ LES FRUITS • ❄️ BANANE BLEUE = SLOW-MO • 👑 FRUIT OR = +350 • 💣 ÉVITEZ LES BOMBES",
        cx,
        88
      );
      ctx.restore();
    }

    function drawFruitEntity(f) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      if (f.isBomb) {
        // Halo externe sans shadowBlur
        ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
        ctx.beginPath();
        ctx.arc(0, 0, f.radius * 1.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#111827";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-12, -12);
        ctx.lineTo(12, 12);
        ctx.moveTo(12, -12);
        ctx.lineTo(-12, 12);
        ctx.stroke();

        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(0, -f.radius - 5, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Halo externe rapide (remplace shadowBlur)
        ctx.fillStyle = f.fleshColor;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(0, 0, f.radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = f.rindColor;
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, f.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = f.fleshColor;
        ctx.beginPath();
        ctx.arc(0, 0, f.radius * 0.76, 0, Math.PI * 2);
        ctx.fill();

        if (f.special === "FREEZE" || f.special === "CROWN") {
          ctx.fillStyle = "#ffffff";
          ctx.font = "700 18px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(f.special === "FREEZE" ? "❄️" : "👑", 0, 0);
        }
      }

      ctx.restore();
    }

    // Dessin du squelette optimisé en 1 seul appel batch ctx.stroke()

    function updateFruitNinjaGame(now) {
      // 4B. LOGIQUE & RENDU : FRUIT NINJA (Avec Slow-Mo & Multi-Slice Blitz)
      if (isRunning && selectedGame === "FRUIT_NINJA") {
        if (slowMoTimer > 0) slowMoTimer--;
        const timeScale = slowMoTimer > 0 ? 0.45 : 1.0;

        spawnFruitWave(now);

        let slicedThisFrame = 0;
        let lastSlicedPos = null;

        for (let i = fruits.length - 1; i >= 0; i--) {
          const f = fruits[i];
          f.x += f.vx * timeScale;
          f.y += f.vy * timeScale;
          f.vy += f.gravity * timeScale;
          f.rotation += f.rotSpeed * timeScale;

          drawFruitEntity(f);

          let slicedBy = null;
          for (let b = 0; b < blades.length; b++) {
            const blade = blades[b];
            if (!blade.active || blade.trail.length < 2) continue;
            if (blade.speed < MIN_SLASH_SPEED) continue;

            const prev = blade.trail[blade.trail.length - 2];
            const d = distToSegment(f.x, f.y, prev.x, prev.y, blade.x, blade.y);
            if (d <= f.radius * 1.15) {
              slicedBy = blade;
              break;
            }
          }

          if (slicedBy) {
            if (!f.isBomb) {
              slicedThisFrame++;
              lastSlicedPos = { x: f.x, y: f.y };
            }
            sliceFruitItem(f, i, slicedBy);
            continue;
          }

          if (f.y > canvas.height + 90 && f.vy > 0) {
            fruits.splice(i, 1);
            if (!f.isBomb) {
              itemsMissed++;
              combo = 0;
              multiplier = 1;
              updateHUD();
            }
          }
        }

        // Bonus BLITZ si le joueur tranche 2 fruits ou plus d'un seul coup !
        if (slicedThisFrame >= 2 && lastSlicedPos) {
          const blitzBonus = slicedThisFrame * 150;
          score += blitzBonus;
          updateHUD();
          floatingTexts.push({
            x: lastSlicedPos.x,
            y: lastSlicedPos.y - 45,
            text: `⚡ BLITZ x${slicedThisFrame} +${blitzBonus} !`,
            subText: "Coupe multiple !",
            color: "#ffee00",
            alpha: 1,
            vy: -2.8
          });
        }

        for (let i = slicedFruits.length - 1; i >= 0; i--) {
          const sf = slicedFruits[i];
          sf.x += sf.vx * timeScale;
          sf.y += sf.vy * timeScale;
          sf.vy += 0.32 * timeScale;
          sf.rotation += sf.rotSpeed * timeScale;
          sf.alpha -= 0.025;

          if (sf.alpha <= 0) {
            slicedFruits.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = sf.alpha;
          ctx.translate(sf.x, sf.y);
          ctx.rotate(sf.rotation);
          ctx.fillStyle = sf.rindColor;
          ctx.beginPath();
          ctx.arc(0, 0, sf.radius, 0, Math.PI, false);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = sf.fleshColor;
          ctx.beginPath();
          ctx.arc(0, 0, sf.radius * 0.8, 0, Math.PI, false);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

    }
