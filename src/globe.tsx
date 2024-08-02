import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './Globe.css';

const Globe: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Earth
    const earthGeometry = new THREE.SphereGeometry(5, 192, 192);
    const earthMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        uniform vec3 oceanColor;
        uniform vec3 landColor;
        uniform vec3 snowColor;
        uniform float time;

        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vPosition;

        // Simplex noise function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);

          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);

          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;

          i = mod289(i);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);

          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);

          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);

          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          // Generate terrain
          float elevation = snoise(vPosition * 0.4) * 0.5 + 0.5;
          elevation = pow(elevation, 1.5);

          // Ocean waves
          float wavePattern = snoise(vec3(vUv * 100.0, time * 0.05));
          vec3 oceanColor = mix(oceanColor, oceanColor * 1.2, wavePattern);

          // Land texture
          float landPattern = snoise(vPosition * 2.0);
          vec3 landColor = mix(landColor, landColor * 0.8, landPattern);

          // Snow caps (less exaggerated)
          float snowNoise = snoise(vPosition * 4.0);
          float snowThreshold = 0.8 + snowNoise * 0.05; // Increased threshold, reduced noise influence
          vec3 snowColor = mix(snowColor, snowColor * 0.9, snowNoise);

          // Combine textures
          vec3 surfaceColor = mix(oceanColor, landColor, smoothstep(0.4, 0.5, elevation));
          surfaceColor = mix(surfaceColor, snowColor, smoothstep(snowThreshold, snowThreshold + 0.05, elevation));

          // Enhanced day-night shading
          float dayLight = dot(vNormal, sunDirection);
          dayLight = smoothstep(-0.2, 0.5, dayLight); // Sharper transition
          surfaceColor *= mix(0.2, 1.2, dayLight); // Darker night side, brighter day side

          // Atmosphere
          float atmosphereIntensity = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
          vec3 atmosphereColor = vec3(0.6, 0.8, 1.0);
          surfaceColor = mix(surfaceColor, atmosphereColor, pow(atmosphereIntensity, 4.0) * 0.5);

          gl_FragColor = vec4(surfaceColor, 1.0);
        }
      `,
      uniforms: {
        sunDirection: { value: new THREE.Vector3(1, 0.1, 0.1).normalize() },
        oceanColor: { value: new THREE.Color(0x001a33) },
        landColor: { value: new THREE.Color(0x2d4f2f) },
        snowColor: { value: new THREE.Color(0xffffff) },
        time: { value: 0 }
      }
    });

    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthMesh);

    // Sun (larger and further away)
    const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.position.set(100, 10, 10);
    scene.add(sunMesh);

    // Sun light
    const sunLight = new THREE.PointLight(0xffffff, 1.5, 1000);
    sunLight.position.copy(sunMesh.position);
    scene.add(sunLight);

    // Atmosphere
    const atmosphereGeometry = new THREE.SphereGeometry(5.1, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          vec3 atmosphereColor = vec3(0.3, 0.6, 1.0);
          float sunEffect = max(dot(vNormal, sunDirection), 0.0);
          atmosphereColor = mix(atmosphereColor, vec3(0.8, 0.9, 1.0), sunEffect);
          gl_FragColor = vec4(atmosphereColor, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      uniforms: {
        sunDirection: { value: new THREE.Vector3(1, 0.1, 0.1).normalize() }
      }
    });

    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // Stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 5000;
    const starsPositions = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount * 3; i += 3) {
      starsPositions[i] = (Math.random() - 0.5) * 300;
      starsPositions[i + 1] = (Math.random() - 0.5) * 300;
      starsPositions[i + 2] = (Math.random() - 0.5) * 300;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.1, sizeAttenuation: true });
    const starsMesh = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starsMesh);

    // Camera position
    camera.position.z = 15;

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      
      // Rotate Earth
      earthMesh.rotation.y = elapsedTime * 0.05;

      // Update time uniform for ocean waves
      (earthMaterial as THREE.ShaderMaterial).uniforms.time.value = elapsedTime;
      
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="globe-container" />;
};

export default Globe;