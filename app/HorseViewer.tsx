"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const HORSES = [
  { id: "Thoroughbred", label: "Thoroughbred" },
  { id: "Halla", label: "Halla" },
  { id: "Shire", label: "Shire" },
  { id: "Shetland", label: "Shetland" },
] as const;

type HorseId = (typeof HORSES)[number]["id"];

export default function HorseViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef<((id: HorseId) => void) | null>(null);
  const [active, setActive] = useState<HorseId>(HORSES[0].id);
  const [loading, setLoading] = useState(true);

  // Three.js 씬은 한 번만 생성하고, 탭 전환 시 모델만 교체한다
  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(1, 1.4, 1);
    scene.add(ground);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.55;

    const draco = new DRACOLoader().setDecoderPath("/draco/");
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const cache = new Map<HorseId, THREE.Object3D>();
    let current: THREE.Object3D | null = null;
    let requestId = 0;

    const show = (model: THREE.Object3D) => {
      if (current) scene.remove(current);
      current = model;
      scene.add(model);
    };

    // 크기를 높이 1 기준으로 정규화하고 바닥 중앙에 배치
    const normalize = (root: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const scale = 1 / size.y;
      root.scale.setScalar(scale);
      box.setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    };

    loadRef.current = (id) => {
      const req = ++requestId;
      const cached = cache.get(id);
      if (cached) {
        show(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      loader.load(
        `/3dmodel/${id}.glb`,
        (gltf) => {
          normalize(gltf.scene);
          cache.set(id, gltf.scene);
          if (req === requestId) {
            show(gltf.scene);
            setLoading(false);
          }
        },
        undefined,
        () => req === requestId && setLoading(false),
      );
    };

    camera.position.set(2.4, 1.1, 2.4);
    controls.target.set(0, 0.5, 0);
    controls.update();


    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    loadRef.current(HORSES[0].id);

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      draco.dispose();
      cache.forEach((obj) =>
        obj.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
          }
        }),
      );
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      loadRef.current = null;
    };
  }, []);

  const select = (id: HorseId) => {
    if (id === active) return;
    setActive(id);
    loadRef.current?.(id);
  };

  return (
    <div className="flex h-dvh flex-col bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-900">
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Horse 3D Viewer</h1>
        <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">드래그해서 돌리고, 휠·핀치로 확대해 보세요</p>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={mountRef} className="absolute inset-0 touch-none" />
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-900" />
          </div>
        )}
      </div>

      <nav className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          role="tablist"
          className="mx-auto grid max-w-md grid-cols-4 gap-1 rounded-2xl bg-white/70 p-1 shadow-sm backdrop-blur"
        >
          {HORSES.map((h) => (
            <button
              key={h.id}
              role="tab"
              aria-selected={active === h.id}
              onClick={() => select(h.id)}
              className={`rounded-xl px-1 py-2.5 text-[11px] font-medium transition-colors sm:text-sm ${
                active === h.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-200/70"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
