/**
 * Simon David — Dynamic Portfolio Engine
 * Features:
 * - Client-Side Studio Background Removal & Edge-Feather Cutout for Simon's Portrait
 * - Interactive 3D Perspective Card Tilt & Parallax
 * - Floating Stardust / Ambient Light Particles
 * - Native <dialog> Modal Management with Light Dismiss
 * - One-Click Email Copy with Toast Notification
 * - Resume Download & Interactive Contact Form
 */

document.addEventListener('DOMContentLoaded', () => {
  initPortraitCutout();
  initMouseParallax();
  initAmbientParticles();
  initModals();
  initEmailCopy();
  initContactForm();
});

/* ==========================================================================
   1. PORTRAIT CUTOUT & EDGE-FEATHER BLENDING
   Removes the solid white studio background from simon.jpg via Canvas BFS,
   preserves shirt collar/eyes, feathers edges, and dissolves the bottom into the card.
   ========================================================================== */
function initPortraitCutout() {
  const canvas = document.getElementById('portraitCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = 'simon.jpg';

  img.onload = () => {
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      canvas.width = w;
      canvas.height = h;

      // Draw original portrait
      ctx.drawImage(img, 0, 0);

      // Extract pixel data
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      // Background flood-fill detection
      const isBg = new Uint8Array(w * h);
      const queue = [];

      // Detect white/off-white studio backdrop
      function isStudioBackdrop(idx) {
        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];
        // Studio backdrop in simon.jpg is pure white/light grey (r>218, g>218, b>218)
        return r > 218 && g > 218 && b > 218;
      }

      // 1. Seed top border
      for (let x = 0; x < w; x++) {
        const idx = x * 4;
        if (isStudioBackdrop(idx)) {
          isBg[x] = 1;
          queue.push(x, 0);
        }
      }

      // 2. Seed left & right borders
      for (let y = 0; y < h; y++) {
        const lIdx = y * w * 4;
        if (isStudioBackdrop(lIdx) && !isBg[y * w]) {
          isBg[y * w] = 1;
          queue.push(0, y);
        }
        const rIdx = (y * w + (w - 1)) * 4;
        if (isStudioBackdrop(rIdx) && !isBg[y * w + (w - 1)]) {
          isBg[y * w + (w - 1)] = 1;
          queue.push(w - 1, y);
        }
      }

      // 3. BFS traversal to fill all connected background
      let head = 0;
      while (head < queue.length) {
        const qx = queue[head++];
        const qy = queue[head++];

        const neighbors = [
          [qx + 1, qy],
          [qx - 1, qy],
          [qx, qy + 1],
          [qx, qy - 1]
        ];

        for (let i = 0; i < 4; i++) {
          const nx = neighbors[i][0];
          const ny = neighbors[i][1];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nPos = ny * w + nx;
            if (!isBg[nPos]) {
              const idx = nPos * 4;
              if (isStudioBackdrop(idx)) {
                isBg[nPos] = 1;
                queue.push(nx, ny);
              }
            }
          }
        }
      }

      // 4. Alpha processing, anti-aliased edge feathering, and bottom dissolve
      const fadeStartY = Math.floor(h * 0.80);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const pos = y * w + x;
          const idx = pos * 4;

          if (isBg[pos] === 1) {
            d[idx + 3] = 0; // Transparent background
          } else {
            // Edge smoothing check (anti-aliasing)
            let nearBgDist = 99;
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const sx = x + dx;
                const sy = y + dy;
                if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                  if (isBg[sy * w + sx] === 1) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < nearBgDist) nearBgDist = dist;
                  }
                }
              }
            }

            if (nearBgDist <= 2.2) {
              const r = d[idx], g = d[idx + 1], b = d[idx + 2];
              const lum = (r + g + b) / 3;
              if (lum > 195) {
                const featherFactor = Math.max(0, (255 - lum) / 60);
                d[idx + 3] = Math.floor(d[idx + 3] * featherFactor);
              }
            }

            // Smooth dissolve into the obsidian card at the bottom of Simon's sweater
            if (y > fadeStartY) {
              const progress = (y - fadeStartY) / (h - fadeStartY);
              const fade = Math.pow(Math.max(0, 1 - progress), 1.6);
              d[idx + 3] = Math.floor(d[idx + 3] * fade);
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      canvas.classList.add('loaded');
    } catch (err) {
      console.warn('Canvas pixel processing fallback:', err);
      // Fallback: draw directly
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      canvas.classList.add('loaded');
    }
  };

  img.onerror = () => {
    console.error('Could not load portrait image: simon.jpg');
  };
}

/* ==========================================================================
   2. 3D PERSPECTIVE CARD TILT & PARALLAX
   Subtle mouse movement response providing depth and tactile feedback.
   ========================================================================== */
function initMouseParallax() {
  const card = document.getElementById('portfolioCard');
  const container = document.querySelector('.portfolio-container');
  const halo = document.querySelector('.violet-halo');
  const cornerGlow = document.querySelector('.corner-glow');
  const portraitImg = document.getElementById('portraitImg');

  if (!card || !container) return;

  // Only enable on non-touch devices
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let ticking = false;

    container.addEventListener('mousemove', (e) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const cardX = e.clientX - rect.left;
          const cardY = e.clientY - rect.top;

          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          const deltaX = (cardX - centerX) / centerX;
          const deltaY = (cardY - centerY) / centerY;

          // Subtle tilt angle
          const rotateX = -deltaY * 3.5;
          const rotateY = deltaX * 4.5;

          card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

          // Subtle shift for halo & spotlight
          if (halo) {
            halo.style.transform = `translate(calc(-50% + ${deltaX * 12}px), calc(-10% + ${deltaY * 12}px)) scale(1.02)`;
          }
          if (cornerGlow) {
            cornerGlow.style.transform = `translate(${deltaX * 16}px, ${deltaY * 16}px)`;
          }
          if (portraitImg) {
            portraitImg.style.transform = `translate(${deltaX * 8}px, ${deltaY * 6}px)`;
          }

          ticking = false;
        });
        ticking = true;
      }
    });

    container.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
      if (halo) {
        halo.style.transform = 'translate(-50%, -10%) scale(1)';
      }
      if (cornerGlow) {
        cornerGlow.style.transform = 'translate(0px, 0px)';
      }
      if (portraitImg) {
        portraitImg.style.transform = 'translate(0px, 0px)';
      }
    });
  }
}

/* ==========================================================================
   3. AMBIENT BACKGROUND PARTICLES
   Ethereal soft floating specks of light in the outer lavender canvas.
   ========================================================================== */
function initAmbientParticles() {
  const canvas = document.getElementById('ambientCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particleCount = Math.min(35, Math.floor((width * height) / 30000));
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.2 + 0.8,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.45 + 0.15,
      pulseSpeed: Math.random() * 0.02 + 0.008
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;

      // Wrap around edges
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      // Soft opacity oscillation
      p.opacity += Math.sin(Date.now() * p.pulseSpeed) * 0.003;
      p.opacity = Math.max(0.1, Math.min(0.6, p.opacity));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
    });

    requestAnimationFrame(render);
  }

  render();
}

/* ==========================================================================
   4. MODAL MANAGEMENT (About, Projects, Contact, Resume)
   Native <dialog> with smooth backdrop and outside click to close.
   ========================================================================== */
function initModals() {
  const modalTriggers = document.querySelectorAll('[data-modal]');
  const closeButtons = document.querySelectorAll('[data-close]');
  const allModals = document.querySelectorAll('.glass-modal');

  modalTriggers.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute('data-modal');
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.showModal();
        document.body.style.overflow = 'hidden';
      }
    });
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const modal = document.getElementById(modalId);
      if (modal) {
        closeModal(modal);
      }
    });
  });

  // Close when clicking backdrop
  allModals.forEach((modal) => {
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      // If clicked on backdrop outside dialog content
      if (e.target === modal) {
        closeModal(modal);
      }
    });

    modal.addEventListener('cancel', () => {
      document.body.style.overflow = '';
    });
  });

  function closeModal(dialog) {
    dialog.close();
    document.body.style.overflow = '';
  }
}

/* ==========================================================================
   5. EMAIL COPY & TOAST NOTIFICATION
   ========================================================================== */
function initEmailCopy() {
  const copyBtn = document.getElementById('copyEmailBtn');
  const emailText = document.getElementById('emailText');

  if (!copyBtn || !emailText) return;

  copyBtn.addEventListener('click', () => {
    const email = emailText.textContent.trim();
    navigator.clipboard.writeText(email).then(() => {
      showToast('Copied menosimon6@gmail.com to clipboard!');
      copyBtn.querySelector('.copy-text').textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.querySelector('.copy-text').textContent = 'Copy';
      }, 2500);
    }).catch(() => {
      showToast('Email: menosimon6@gmail.com');
    });
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('active');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('active');
  }, 3200);
}

/* ==========================================================================
   6. CONTACT FORM INTERACTION
   ========================================================================== */
function initContactForm() {
  window.submitContactForm = function () {
    const status = document.getElementById('formStatus');
    const nameInput = document.getElementById('contactName');
    const emailInput = document.getElementById('contactEmail');
    const msgInput = document.getElementById('contactMsg');
    const submitBtn = document.getElementById('submitFormBtn');

    if (!nameInput || !emailInput || !msgInput) return;
    if (!nameInput.value.trim() || !emailInput.value.trim() || !msgInput.value.trim()) {
      if (status) {
        status.innerHTML = '<span style="color: #f87171; font-weight: 500;">Please fill out all fields.</span>';
      }
      return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const msg = msgInput.value.trim();

    submitBtn.textContent = 'Opening Email Client...';
    submitBtn.disabled = true;

    // Compose direct mailto link prefilled with sender's info & message
    const subject = encodeURIComponent(`Portfolio Inquiry from ${name}`);
    const body = encodeURIComponent(
      `Hello Simon,\n\n${msg}\n\n---\nSender: ${name}\nEmail: ${email}`
    );
    const mailtoUrl = `mailto:menosimon6@gmail.com?subject=${subject}&body=${body}`;

    // Trigger user's default email client
    window.location.href = mailtoUrl;

    if (status) {
      status.innerHTML = '<span style="color: #4ade80; font-weight: 500;">✓ Launching your email client... You can also email directly at menosimon6@gmail.com.</span>';
    }

    setTimeout(() => {
      submitBtn.textContent = 'Send Message Directly';
      submitBtn.disabled = false;
    }, 3500);
  };
}

/* ==========================================================================
   7. RESUME DOWNLOAD ACTION (OFFICIAL PDF)
   ========================================================================== */
window.downloadResume = function () {
  const link = document.createElement('a');
  link.href = 'Menoh_Simon_David_Resume.pdf';
  link.download = 'Menoh_Simon_David_Resume.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Downloading Menoh Simon David Official Resume (PDF)...');
};
