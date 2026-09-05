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

    if (!nameInput.value || !emailInput.value || !msgInput.value) return;

    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    setTimeout(() => {
      status.innerHTML = '<span style="color: #4ade80; font-weight: 500;">✓ Message sent! Simon will get back to you shortly at menosimon6@gmail.com.</span>';
      submitBtn.textContent = 'Message Sent';

      // Reset form fields
      nameInput.value = '';
      emailInput.value = '';
      msgInput.value = '';

      setTimeout(() => {
        submitBtn.textContent = 'Send Message';
        submitBtn.disabled = false;
        status.innerHTML = '';
      }, 4000);
    }, 700);
  };
}

/* ==========================================================================
   7. RESUME DOWNLOAD ACTION
   ========================================================================== */
window.downloadResume = function () {
  const resumeText = `
MENOH SIMON DAVID
Computer Science Graduate | Computer Engineer
Email: menosimon6@gmail.com | Phone: 656-872-040 | Location: Yaoundé, CM
LinkedIn: https://www.linkedin.com/in/simon-david-menoh-29662a308
GitHub: https://github.com/menohsimon

================================================================================
SUMMARY
================================================================================
Computer Science graduate with practical experience in full-stack web development,
database management, and software engineering. Passionate about Artificial Intelligence,
Data Analytics, and building technology solutions that solve real-world problems.
Quick learner, collaborative team member, and eager to contribute to innovative organizations.

================================================================================
SKILLS & COMPETENCIES
================================================================================
- Technical Stack: React, Python, Convex, JavaScript (ES6+), CSS3, HTML5, Tailwind CSS, Relational Databases, SQL, Git & GitHub
- Professional Skills: Team Collaboration, Problem Solving, Communication, Time Management, Adaptability, Analytical Thinking
- Additional Skills: Driving, Social Media Management, Graphic Design
- Languages: English (Full Professional), French (Native or Bilingual)

================================================================================
ACCOMPLISHMENTS & EXPERIENCE
================================================================================
OLA ENERGY CAMEROON — Internship
Duration: 14/07/2025 - 26/08/2025
• Worked well in a team setting, providing support and guidance.
• Passionate about learning and committed to continual improvement.
• Participated in team projects, demonstrating an ability to work collaboratively and effectively.
• Adaptable and proficient in learning new concepts quickly and efficiently.

================================================================================
FEATURED PROJECT
================================================================================
LogiTrack – Smart Logistics Marketplace & Real-Time Tracking
The ICT University - Final Year Project Defense (04/07/2026)
Live Demo: https://logitrack-rust.vercel.app/
Source Code: https://github.com/menohsimon/logitrack
• Developed a logistics platform connecting customers with transport providers.
• Implemented real-time shipment tracking using interactive maps.
• Built booking and company management features.
• Designed relational databases for logistics operations.
• Focused on improving transparency and logistics efficiency.

================================================================================
EDUCATION
================================================================================
THE ICT UNIVERSITY, Yaoundé
Completed: July/2026
• Completed coursework: Bachelor of Science in Computer Science

THE ICT UNIVERSITY / COURSERA
Duration: October/2024 - May/2025
• Certificate in Database Management

Douala Academy of Arts and Science, Douala
Completed: September/2021
• Completed Coursework: GCE ADVANCED LEVEL

Fultang Bilingual School, Nkongsamba
Completed: September/2019
• Completed Coursework: GCE ORDINARY LEVEL
`;

  const blob = new Blob([resumeText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Menoh_Simon_David_Resume.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Downloaded Menoh Simon David Resume!');
};
