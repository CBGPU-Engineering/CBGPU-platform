'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LoadingSpinner } from '@/components/ui/spinner';

/** Renders a .3mf model in an interactive, orbit-controllable WebGL viewport. */
export function Model3MFViewer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setLoading(true);
    setError(null);

    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(1, 2, 3);
    scene.add(dirLight);

    const loader = new ThreeMFLoader();
    loader.load(
      src,
      (object) => {
        if (disposed) return;
        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.1, roughness: 0.75 });
          }
        });
        scene.add(object);

        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        camera.position.set(center.x + maxDim, center.y + maxDim * 0.8, center.z + maxDim);
        camera.near = maxDim / 100;
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();
        controls.target.copy(center);
        controls.update();

        setLoading(false);
      },
      undefined,
      () => {
        if (!disposed) { setError('모델을 불러오지 못했습니다.'); setLoading(false); }
      }
    );

    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).geometry?.dispose();
        }
      });
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [src]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border-2 border-border/60 bg-muted/10" style={{ height: 420 }}>
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size={40} label="모델 불러오는 중" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="text-xs font-bold text-muted-foreground">{error}</p>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
      {!loading && !error && (
        <p className="absolute bottom-2 right-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">드래그: 회전 · 스크롤: 확대</p>
      )}
    </div>
  );
}
