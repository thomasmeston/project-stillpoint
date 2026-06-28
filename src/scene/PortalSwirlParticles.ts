import * as THREE from 'three';

const PARTICLE_COUNT = 32;

type ParticleState = {
  angle: number;
  radius: number;
  speed: number;
  wobble: number;
  wobbleSpeed: number;
};

/** Soft additive swirl on a portal disc (local XY plane, +Z normal). Parent to the disc mesh. */
export class PortalSwirlParticles {
  readonly points: THREE.Points;
  private readonly particles: ParticleState[] = [];
  private readonly basePositions: Float32Array;
  private readonly portalRadius: number;
  private dimmed = false;
  private time = 0;

  constructor(portalRadius: number) {
    this.portalRadius = portalRadius;

    const geometry = new THREE.BufferGeometry();
    this.basePositions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      const angle = t * Math.PI * 2 + Math.random() * 0.4;
      const radius = portalRadius * (0.2 + Math.random() * 0.72);
      this.particles.push({
        angle,
        radius,
        speed: 0.55 + Math.random() * 1.1,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 1.2 + Math.random() * 1.8,
      });

      this.writeParticlePosition(i, angle, radius, 0);
      const shade = 0.72 + Math.random() * 0.28;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.92;
      colors[i * 3 + 2] = Math.min(1, shade * 1.08);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.basePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: portalRadius * 0.11,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.position.z = portalRadius * 0.04;
  }

  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    const mat = this.points.material as THREE.PointsMaterial;
    mat.opacity = dimmed ? 0.28 : 0.82;
    mat.size = this.portalRadius * (dimmed ? 0.07 : 0.11);
  }

  update(dt: number): void {
    this.time += dt;
    const positions = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = this.particles[i];
      p.angle += p.speed * dt * (this.dimmed ? 0.35 : 1);
      p.wobble += p.wobbleSpeed * dt;
      const spiral = 0.78 + 0.22 * Math.sin(this.time * 0.9 + p.wobble);
      const radius = p.radius * spiral;
      const lift = 0.025 * Math.sin(p.wobble);
      this.writeParticlePosition(i, p.angle, radius, lift);
      positions.setXYZ(
        i,
        this.basePositions[i * 3],
        this.basePositions[i * 3 + 1],
        this.basePositions[i * 3 + 2],
      );
    }

    positions.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }

  private writeParticlePosition(index: number, angle: number, radius: number, lift: number): void {
    this.basePositions[index * 3] = Math.cos(angle) * radius;
    this.basePositions[index * 3 + 1] = Math.sin(angle) * radius;
    this.basePositions[index * 3 + 2] = lift;
  }
}
