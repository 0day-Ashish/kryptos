"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

function createRibbon(
  points: Array<[number, number, number]>,
  radius: number,
  opacity: number,
) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  const geometry = new THREE.TubeGeometry(curve, 260, radius, 28, false);

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: opacity * 0.28,
  });

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.9,
    thickness: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    ior: 1.08,
  });

  const group = new THREE.Group();
  const glow = new THREE.Mesh(geometry, glowMaterial);
  const shell = new THREE.Mesh(geometry, shellMaterial);

  glow.scale.setScalar(1.06);
  group.add(glow, shell);

  return group;
}

export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xffffff, 0.055);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.3, 9.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 2.2);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    const fillLight = new THREE.PointLight(0xffffff, 28, 30, 2);
    const rimLight = new THREE.PointLight(0xffffff, 18, 26, 2);

    keyLight.position.set(-4, 5, 7);
    fillLight.position.set(0, 0, 10);
    rimLight.position.set(6, 2, 4);

    scene.add(ambient, keyLight, fillLight, rimLight);

    const rig = new THREE.Group();
    scene.add(rig);

    const leftRibbon = createRibbon(
      [
        [-6.8, -3.2, -1.3],
        [-4.7, -4.5, -1],
        [-2.1, -3.6, -0.5],
        [0.4, -0.4, -0.1],
        [1.2, 2.7, 0.3],
        [0.1, 4.5, 0.55],
        [-1.3, 3.2, 0.15],
        [-2.8, 0.1, -0.2],
        [-4.8, -2.5, -0.6],
      ],
      0.36,
      0.72,
    );
    leftRibbon.rotation.z = -0.2;
    leftRibbon.position.set(-0.5, 0.1, -0.5);

    const horizonRibbon = createRibbon(
      [
        [-8.5, -1.4, 0.6],
        [-5.7, -1.15, 0.4],
        [-2.8, -0.9, 0.25],
        [0.4, -0.75, 0.15],
        [3.1, -0.7, 0.05],
        [6.5, -0.92, -0.15],
        [8.6, -1.05, -0.22],
      ],
      0.52,
      0.52,
    );
    horizonRibbon.rotation.z = 0.03;
    horizonRibbon.position.set(0, -0.65, -1.3);

    const rightRibbon = createRibbon(
      [
        [4.7, -3.2, -1],
        [4.8, -0.9, -0.45],
        [4.2, 1.7, -0.05],
        [4.8, 3.8, 0.22],
        [6.2, 3.3, 0.35],
        [6.4, 1.6, 0.18],
        [5.6, -0.9, -0.1],
        [6.1, -3.6, -0.45],
      ],
      0.34,
      0.68,
    );
    rightRibbon.position.set(-0.1, -0.3, -0.7);
    rightRibbon.rotation.z = 0.06;

    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 48, 48),
      new THREE.MeshPhysicalMaterial({
        color: 0xf9fdff,
        transparent: true,
        opacity: 0.4,
        roughness: 0.04,
        transmission: 1,
        thickness: 2,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
    );
    bubble.position.set(1.7, 1.25, 0.1);

    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.13,
      }),
    );
    haze.position.set(0, 0.9, -3.8);

    rig.add(leftRibbon, horizonRibbon, rightRibbon, bubble, haze);

    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;

    const resize = () => {
      const { clientWidth, clientHeight } = mount;

      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();

      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.5;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.24;
    };

    resize();
    window.addEventListener("resize", resize);
    mount.addEventListener("pointermove", handlePointerMove);

    const clock = new THREE.Clock();
    let frameId = 0;

    const render = () => {
      const elapsed = clock.getElapsedTime();

      pointerX += (targetX - pointerX) * 0.035;
      pointerY += (targetY - pointerY) * 0.035;

      rig.rotation.y = pointerX + Math.sin(elapsed * 0.18) * 0.08;
      rig.rotation.x = -pointerY + Math.cos(elapsed * 0.16) * 0.04;
      rig.position.y = Math.sin(elapsed * 0.45) * 0.12;

      leftRibbon.rotation.x = Math.sin(elapsed * 0.34) * 0.08;
      leftRibbon.rotation.y = Math.cos(elapsed * 0.28) * 0.06;
      horizonRibbon.rotation.x = Math.sin(elapsed * 0.24) * 0.03;
      rightRibbon.rotation.x = -Math.cos(elapsed * 0.31) * 0.06;
      bubble.position.y = 1.25 + Math.sin(elapsed * 1.1) * 0.18;
      bubble.position.x = 1.7 + Math.cos(elapsed * 0.7) * 0.08;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeChild(renderer.domElement);

      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;

        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });

      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0"
      aria-hidden="true"
    />
  );
}
