import { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Globe with destination markers
 * Converts lat/lng to 3D sphere coordinates
 */
function Globe({ destinations, onDestinationClick }) {
  const globeRef = useRef();

  // Convert lat/lng to 3D coordinates on sphere safely
  const latLngToVector3 = (lat, lng, radius = 2) => {
    const numLat = parseFloat(lat) || 0;
    const numLng = parseFloat(lng) || 0;
    const phi = (90 - numLat) * (Math.PI / 180);
    const theta = (numLng + 180) * (Math.PI / 180);

    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  };

  // Auto-rotate
  useFrame(() => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.001;
    }
  });

  const markers = useMemo(() => {
    return destinations.map(dest => ({
      ...dest,
      position: latLngToVector3(dest.latitude, dest.longitude)
    }));
  }, [destinations]);

  return (
    <group ref={globeRef}>
      {/* Earth sphere */}
      <Sphere args={[2, 64, 64]}>
        <meshStandardMaterial
          color="#1e88e5"
          roughness={0.7}
          metalness={0.3}
          emissive="#0d47a1"
          emissiveIntensity={0.2}
        />
      </Sphere>

      {/* Destination markers */}
      {markers.map((dest, index) => (
        <group key={index} position={dest.position}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onDestinationClick(dest);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'default';
            }}
          >
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial
              color={dest.theme_variant === 'ocean_blue' ? '#4fc3f7' :
                     dest.theme_variant === 'monsoon_green' ? '#66bb6a' :
                     dest.theme_variant === 'ice_blue' ? '#81d4fa' :
                     dest.theme_variant === 'sunset_orange' ? '#ff9800' : '#bdbdbd'}
              emissive="#ffffff"
              emissiveIntensity={0.5}
            />
          </mesh>
          
          <Html distanceFactor={8} position={[0, 0.15, 0]}>
            <div style={{
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}>
              {dest.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

/**
 * Interactive globe for destination selection
 */
export default function DestinationGlobe({ destinations = [], onDestinationSelect }) {
  const [webglSupported, setWebglSupported] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setWebglSupported(false);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  if (!webglSupported || hasError) {
    return (
      <div style={{
        width: '100%',
        minHeight: '400px',
        background: '#0a1929',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        borderRadius: '16px',
        textAlign: 'center'
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#4fc3f7', marginBottom: '1rem' }}>public</span>
        <h3>Interactive 3D Globe Unavailable</h3>
        <p style={{ maxWidth: '420px', opacity: 0.8, fontSize: '14px' }}>
          Your browser does not support hardware accelerated WebGL. Explore India using our curated cards view below.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative', background: '#0a1929', borderRadius: '16px', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        onError={() => setHasError(true)}
      >
        <Suspense fallback={<Html center><div style={{ color: 'white' }}>Rendering 3D Globe...</div></Html>}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1.2} />
          <pointLight position={[-10, -10, -10]} intensity={0.6} color="#81d4fa" />
          
          <Globe destinations={destinations} onDestinationClick={onDestinationSelect} />
          
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={3.5}
            maxDistance={9}
            rotateSpeed={0.5}
          />
        </Suspense>
      </Canvas>

      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'white',
        background: 'rgba(10, 25, 41, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        padding: '14px 18px',
        borderRadius: '12px',
        fontSize: '14px',
        pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4fc3f7' }}>public</span>
          <strong style={{ fontSize: '15px' }}>Interactive 3D Earth</strong>
        </div>
        <p style={{ margin: 0, opacity: 0.85, fontSize: '12px' }}>
          Rotate the globe • Click glowing markers to explore tours
        </p>
      </div>
    </div>
  );
}
