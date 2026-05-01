// Atmosphere effects for The Office

let ATMOSPHERE_ENABLED = true;
const particles = [];
const PARTICLE_COUNT = 18;

// Particle class
class Particle {
  constructor(zone) {
    this.reset(zone);
  }
  
  reset(zone) {
    this.x = Math.random() * 36 * 16;
    this.y = Math.random() * 22 * 16;
    this.zone = zone;
    this.speed = 0.2 + Math.random() * 0.3;
    this.size = 1 + Math.random();
    this.alpha = 0.3 + Math.random() * 0.5;
    
    const zoneColors = {
      OFFICE: '#3b82f6',
      FOCUS_ROOM: '#8b5cf6',
      CAFETERIA: '#f59e0b',
      ARCADE: '#ec4899',
      STUDIO: '#06b6d4',
    };
    this.color = zoneColors[zone] || '#3b82f6';
  }
  
  update() {
    this.y -= this.speed;
    if (this.y < 0) {
      this.y = 22 * 16;
      this.x = Math.random() * 36 * 16;
    }
  }
}

export function initAtmosphere() {
  // Initialize particles
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle('OFFICE'));
  }
}

export function setAtmosphere(enabled) {
  ATMOSPHERE_ENABLED = enabled;
}

export function isEnabled() {
  return ATMOSPHERE_ENABLED;
}

// Main render function
export function renderAtmosphere(ctx, width, height, currentZone, lastTime) {
  if (!ATMOSPHERE_ENABLED) return;
  
  // Scanlines (3% opacity)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
  for (let y = 0; y < height; y += 2) {
    ctx.fillRect(0, y, width, 1);
  }
  
  // Vignette
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Zone glow (8% opacity)
  const zoneColors = {
    OFFICE: '#3b82f6',
    FOCUS_ROOM: '#8b5cf6',
    CAFETERIA: '#f59e0b',
    ARCADE: '#ec4899',
    STUDIO: '#06b6d4',
  };
  const zoneGlow = zoneColors[currentZone] || '#3b82f6';
  
  ctx.fillStyle = zoneGlow + '15'; // 8% approx in hex
  ctx.fillRect(0, 0, width, height);
  
  // Particles (near camera)
  particles.forEach(p => {
    p.update();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha * 0.3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;
}