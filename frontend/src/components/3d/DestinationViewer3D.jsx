import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Interactive 3D depth-enhanced photo viewer
 * Uses displacement mapping for 2.5D parallax effect
 */
function DepthImage({ imageUrl, onPoiClick }) {
  const meshRef = useRef();
  const [texture, setTexture] = useState(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (loadedTexture) => {
        if ('colorSpace' in loadedTexture && THREE.SRGBColorSpace) {
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
        }
        setTexture(loadedTexture);
      },
      undefined,
      (error) => console.error('Texture load error:', error)
    );
  }, [imageUrl]);

  // Gentle rotation animation
  useFrame((state) => {
    if (meshRef.current && hovered) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  if (!texture) return null;

  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (onPoiClick) {
          // Calculate click position on texture
          const uv = e.uv;
          onPoiClick({ x: uv.x, y: uv.y });
        }
      }}
    >
      <planeGeometry args={[8, 4.5, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        displacementScale={0.3}
        side={THREE.DoubleSide}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  );
}

/**
 * Point of Interest marker in 3D space
 */
function POIMarker({ position, label, packageId, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick(packageId);
        }}
      >
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={hovered ? '#ff6b35' : '#4ecdc4'}
          emissive={hovered ? '#ff6b35' : '#4ecdc4'}
          emissiveIntensity={hovered ? 0.8 : 0.5}
        />
      </mesh>
      {hovered && (
        <Html center distanceFactor={10}>
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontSize: '14px'
          }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Main 3D Destination Viewer Component
 */
export default function DestinationViewer3D({
  imageUrl,
  pointsOfInterest = [],
  onPackageSelect,
  fallbackComponent: FallbackComponent
}) {
  const [webglSupported, setWebglSupported] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [controlsEnabled, setControlsEnabled] = useState(true);

  useEffect(() => {
    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
      }
    } catch (e) {
      setWebglSupported(false);
    }

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setControlsEnabled(false);
    }
  }, []);

  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
    return (
      <div style={{ width: '100%', minHeight: '260px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '24px', background: 'var(--color-surface-container-low)' }}>
        <div><span className="material-symbols-outlined" style={{ fontSize: '42px', color: 'var(--color-on-surface-variant)' }}>image_not_supported</span><p className="text-body-md">No image data uploaded for the 3D explorer.</p></div>
      </div>
    );
  }

  const handlePoiClick = (uv) => {
    console.log('Clicked at UV:', uv);
  };

  if (!webglSupported || loadError) {
    return FallbackComponent ? <FallbackComponent /> : (
      <div style={{
        width: '100%',
        height: '400px',
        background: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '20px',
        textAlign: 'center'
      }}>
        <p>3D view unavailable</p>
        <img src={imageUrl} alt="Destination" style={{ maxWidth: '100%', maxHeight: '300px' }} />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '500px', position: 'relative' }}>
      <Canvas
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
        onError={() => setLoadError(true)}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
        
        <Suspense fallback={<Html center>Loading 3D scene...</Html>}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <pointLight position={[-10, -10, -5]} intensity={0.3} />
          
          <DepthImage imageUrl={imageUrl} onPoiClick={handlePoiClick} />
          
          {/* Points of Interest */}
          {pointsOfInterest.map((poi, index) => (
            <POIMarker
              key={index}
              position={[
                (poi.x - 0.5) * 8,
                (0.5 - poi.y) * 4.5,
                0.5
              ]}
              label={poi.label}
              packageId={poi.packageId}
              onClick={onPackageSelect}
            />
          ))}
          
          <OrbitControls
            enabled={controlsEnabled}
            enableZoom={true}
            enablePan={false}
            minDistance={6}
            maxDistance={15}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 4}
          />
          
          <Environment preset="sunset" />
        </Suspense>
      </Canvas>

      {/* Controls UI */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={() => setControlsEnabled(!controlsEnabled)}
          style={{
            padding: '8px 16px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          aria-label={controlsEnabled ? 'Disable controls' : 'Enable controls'}
        >
          {controlsEnabled ? '🔓 Controls On' : '🔒 Controls Off'}
        </button>
      </div>

      {/* Keyboard hints */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <div>🖱️ Drag to rotate • Scroll to zoom</div>
        <div>Click markers to explore packages</div>
      </div>
    </div>
  );
}
