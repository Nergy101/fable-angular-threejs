import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { ThreeDemo } from '../core/three/three-demo';
import { LESSONS } from '../learn/lesson-data';

/**
 * Landing page. The hero background is itself a three.js scene —
 * a slowly tumbling field of wireframe solids — because the best
 * argument for learning this library is watching it run.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home extends ThreeDemo {
  protected readonly lessons = LESSONS;
  private readonly solids: THREE.Mesh[] = [];

  protected onInit(): void {
    this.camera.position.set(0, 0, 16);
    this.scene.fog = new THREE.Fog(0x0a0b0e, 12, 30);

    const geometries = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.TorusKnotGeometry(0.7, 0.22, 64, 8),
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.TetrahedronGeometry(1.1, 0),
      new THREE.TorusGeometry(0.8, 0.28, 8, 24),
    ];
    const palette = [0xd7ff3e, 0xff5566, 0x45d07b, 0x4d9fff, 0x9aa1b4];

    for (let i = 0; i < 26; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: palette[i % palette.length],
        wireframe: true,
        transparent: true,
        opacity: i % 5 === 0 ? 0.5 : 0.16,
      });
      const mesh = new THREE.Mesh(geometries[i % geometries.length], mat);
      mesh.position.set(
        (Math.random() - 0.5) * 26,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.6) * 12,
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const s = 0.5 + Math.random() * 1.3;
      mesh.scale.setScalar(s);
      mesh.userData['spin'] = (Math.random() - 0.5) * 0.45;
      mesh.userData['drift'] = Math.random() * Math.PI * 2;
      this.solids.push(mesh);
      this.scene.add(mesh);
    }
  }

  protected override onFrame(dt: number, t: number): void {
    for (const mesh of this.solids) {
      const spin = mesh.userData['spin'] as number;
      mesh.rotation.x += spin * dt;
      mesh.rotation.y += spin * 0.7 * dt;
      mesh.position.y += Math.sin(t * 0.4 + (mesh.userData['drift'] as number)) * dt * 0.12;
    }
    this.camera.position.x = Math.sin(t * 0.07) * 1.2;
    this.camera.lookAt(0, 0, 0);
  }
}
