/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Car,
  Plane,
  QrCode,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import {
  CalibrationSettings,
  MotionDataPayload,
  ObstacleInstance,
  ProcessedInput,
  TerrainChunk,
  VehicleDefinition,
} from '../types/game';
import { DEFAULT_CALIBRATION, processMotionData } from '../utils/motion';
import {
  CHUNK_SEGMENTS,
  CHUNK_SIZE,
  getChunkKey,
  getDistanceToRoad,
  getGroundNormal,
  getRoadCenterX,
  getTerrainHeight,
} from '../utils/noise';
import { soundSynth } from '../utils/audio';
import { NetworkManager } from '../utils/webrtc';
import { loadDefaultVehicle } from '../vehicles/vehicleLoader';
import { QRCodeModal } from './QRCodeModal';
import { VehicleModal } from './VehicleModal';

// Pre-allocated reusable math vectors (Zero GC in animation loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();
const _eulerA = new THREE.Euler(0, 0, 0, 'YXZ');
const _colorA = new THREE.Color();

interface HostGameProps {
  sessionId: string;
  networkManager?: NetworkManager;
  onOpenSplitView?: () => void;
  autostart?: boolean;
}

export const HostGame: React.FC<HostGameProps> = ({
  sessionId,
  networkManager: propNetworkManager,
  onOpenSplitView,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundSynth.getIsMuted());
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(10);
  const [connectionStatus, setConnectionStatus] = useState<string>('Waiting for phone');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeVehicle, setActiveVehicle] = useState<VehicleDefinition | null>(null);
  const [isFlippedDisplay, setIsFlippedDisplay] = useState<boolean>(false);

  // Mutable refs for high-frequency 60Hz loop
  const activeVehicleRef = useRef<VehicleDefinition | null>(null);
  const vehicleGroupRef = useRef<THREE.Group | null>(null);
  const vehicleModelRef = useRef<THREE.Group | null>(null);
  const wheelMeshesRef = useRef<THREE.Mesh[]>([]);
  const rotorMeshesRef = useRef<THREE.Mesh[]>([]);

  // Vehicle dynamic state
  const vehiclePosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const vehicleHeadingRef = useRef<number>(0); // radians around Y
  const vehiclePitchRef = useRef<number>(0);
  const vehicleRollRef = useRef<number>(0);
  const verticalVelocityRef = useRef<number>(0);
  const isGroundedRef = useRef<boolean>(true);
  const currentSpeedMultRef = useRef<number>(1.0);
  const slowImpactTimerRef = useRef<number>(0);
  const flipAngleRef = useRef<number>(0);

  // Motion inputs
  const latestMotionRef = useRef<MotionDataPayload>({
    orientation: { alpha: 0, beta: 0, gamma: 0 },
    acceleration: { x: 0, y: 0, z: 9.8 },
    timestamp: Date.now(),
  });
  const calibrationRef = useRef<CalibrationSettings>(DEFAULT_CALIBRATION);
  const keyStateRef = useRef<Record<string, boolean>>({});

  // Terrain chunks cache
  const chunksRef = useRef<Map<string, TerrainChunk>>(new Map());
  const activeObstaclesRef = useRef<ObstacleInstance[]>([]);
  const particleGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<
    Array<{
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      rotSpeed: THREE.Vector3;
      life: number;
      maxLife: number;
    }>
  >([]);

  // Camera Orbit refs
  const cameraOrbitRef = useRef({
    distance: 12,
    pitch: 0.35, // radians up from vehicle
    yawOffset: 0, // radians relative to vehicle heading
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
  });

  // Setup Network Manager
  useEffect(() => {
    let nm: NetworkManager;
    if (propNetworkManager) {
      nm = propNetworkManager;
    } else {
      nm = new NetworkManager({
        onStateChange: (state, message) => {
          setConnectionStatus(message || state);
          setIsConnected(state === 'connected');
        },
        onDataReceived: (payload) => {
          latestMotionRef.current = payload;
          if (payload.actions?.horn) soundSynth.playHorn();
          if (payload.actions?.jump) triggerJump();
        },
      });
      nm.initHost(sessionId);
    }

    return () => {
      if (!propNetworkManager) {
        nm.destroy();
      }
    };
  }, [sessionId, propNetworkManager]);

  // Load default vehicle on start
  useEffect(() => {
    loadDefaultVehicle().then((v) => {
      setActiveVehicle(v);
      activeVehicleRef.current = v;
    });
  }, []);

  // Jump trigger handler
  const triggerJump = useCallback(() => {
    if (isGroundedRef.current && activeVehicleRef.current) {
      verticalVelocityRef.current = activeVehicleRef.current.jumpForce || 12;
      isGroundedRef.current = false;
      soundSynth.playJump();
    }
  }, []);

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      keyStateRef.current[e.code] = true;

      if (e.code === 'KeyH') {
        soundSynth.playHorn();
      }
      if (e.code === 'Space') {
        triggerJump();
      }
      if (e.code === 'KeyM') {
        const muted = soundSynth.toggleMute();
        setIsMuted(muted);
      }
      if (e.code === 'KeyC') {
        // Re-center orientation
        calibrationRef.current.centerBeta = latestMotionRef.current.orientation.beta;
        calibrationRef.current.centerGamma = latestMotionRef.current.orientation.gamma;
        soundSynth.playCheer();
      }
      if (e.code === 'KeyV') {
        setIsVehicleModalOpen(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keyStateRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerJump]);

  // Main Three.js Scene Setup (Mounted ONCE)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software-WebGL Probe (Three.js Directive)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc); // vivid cartoon blue sky
    scene.fog = new THREE.Fog(0x7dd3fc, 80, 260);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.5,
      600
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Environment reflection map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-Point Cartoon Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x86efac, 0.85); // sky to grass reflection
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(60, 100, 50);
    sunLight.castShadow = !isSoftwareGl;
    if (sunLight.castShadow) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 250;
      const d = 50;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    // Vehicle Root Group
    const vehicleRoot = new THREE.Group();
    scene.add(vehicleRoot);
    vehicleGroupRef.current = vehicleRoot;

    // Contact Shadow beneath vehicle (added to scene so it stays flush on ground)
    const shadowGeo = new THREE.PlaneGeometry(3.2, 4.2);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x14532d,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(contactShadow);

    // Particles Group (confetti stars, dust, sparks)
    const particleGroup = new THREE.Group();
    scene.add(particleGroup);
    particleGroupRef.current = particleGroup;

    // Sun / Rainbow cartoon sky elements
    const rainbowGroup = createRainbow();
    rainbowGroup.position.set(0, 30, -180);
    scene.add(rainbowGroup);

    // Chunk generation helper
    const buildChunk = (cx: number, cz: number): TerrainChunk => {
      const key = getChunkKey(cx, cz);
      const worldOriginX = cx * CHUNK_SIZE;
      const worldOriginZ = cz * CHUNK_SIZE;

      // Ground plane geometry with height displacement
      const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
      geo.rotateX(-Math.PI / 2);

      const posAttr = geo.attributes.position;
      const colAttr = new Float32Array(posAttr.count * 3);

      for (let i = 0; i < posAttr.count; i++) {
        const lx = posAttr.getX(i);
        const lz = posAttr.getZ(i);
        const wx = worldOriginX + lx;
        const wz = worldOriginZ + lz;

        const h = getTerrainHeight(wx, wz);
        posAttr.setY(i, h);

        // Cartoon Grass and Road gradient tinting
        const roadD = getDistanceToRoad(wx, wz);
        if (roadD < 4.0) {
          // Road asphalt
          colAttr[i * 3 + 0] = 0.22;
          colAttr[i * 3 + 1] = 0.25;
          colAttr[i * 3 + 2] = 0.30;
        } else if (roadD < 5.8) {
          // Yellow roadside curb line
          colAttr[i * 3 + 0] = 0.95;
          colAttr[i * 3 + 1] = 0.80;
          colAttr[i * 3 + 2] = 0.25;
        } else {
          // Vibrant rolling green grass
          const v = (Math.sin(wx * 0.08) * Math.cos(wz * 0.08) + 1) * 0.5;
          colAttr[i * 3 + 0] = 0.15 + v * 0.08;
          colAttr[i * 3 + 1] = 0.65 + v * 0.12;
          colAttr[i * 3 + 2] = 0.20 + v * 0.06;
        }
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colAttr, 3));
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.05,
        flatShading: true,
      });

      const groundMesh = new THREE.Mesh(geo, mat);
      groundMesh.position.set(worldOriginX, 0, worldOriginZ);
      groundMesh.receiveShadow = !isSoftwareGl;
      scene.add(groundMesh);

      // Generate playful destructible obstacles
      const obstacles: ObstacleInstance[] = [];
      const obsTypes: Array<'tree' | 'fence' | 'present' | 'balloon' | 'snowman' | 'flower'> = [
        'tree',
        'fence',
        'present',
        'balloon',
        'snowman',
        'flower',
      ];

      // Spawn 10 - 15 items per chunk along sides of roads
      const count = 12;
      for (let j = 0; j < count; j++) {
        const offsetZ = (Math.random() - 0.5) * (CHUNK_SIZE - 12);
        const wz = worldOriginZ + offsetZ;
        const roadCenterX = getRoadCenterX(wz);

        // Place on left or right side of road with varied clearance
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = 6.5 + Math.random() * 25;
        const wx = roadCenterX + side * dist;
        const wy = getTerrainHeight(wx, wz);

        const type = obsTypes[Math.floor(Math.random() * obsTypes.length)];
        const mesh = createObstacleMesh(type);
        mesh.position.set(wx, wy, wz);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        scene.add(mesh);

        const obs: ObstacleInstance = {
          id: `${key}_${j}`,
          type,
          position: new THREE.Vector3(wx, wy, wz),
          mesh,
          hit: false,
          hitTime: 0,
          points: type === 'present' ? 50 : type === 'balloon' ? 30 : 10,
        };
        obstacles.push(obs);
        activeObstaclesRef.current.push(obs);
      }

      return {
        key,
        cx,
        cz,
        mesh: groundMesh,
        obstacles,
      };
    };

    // Spawn initial chunks
    const updateChunks = (centerX: number, centerZ: number) => {
      const curCx = Math.round(centerX / CHUNK_SIZE);
      const curCz = Math.round(centerZ / CHUNK_SIZE);
      const range = 2; // 5x5 chunks for wide draw distance

      const neededKeys = new Set<string>();

      for (let dx = -range; dx <= range; dx++) {
        for (let dz = -range; dz <= range; dz++) {
          const cx = curCx + dx;
          const cz = curCz + dz;
          const k = getChunkKey(cx, cz);
          neededKeys.add(k);

          if (!chunksRef.current.has(k)) {
            const chunk = buildChunk(cx, cz);
            chunksRef.current.set(k, chunk);
          }
        }
      }

      // Recycle distant chunks
      chunksRef.current.forEach((chunk, k) => {
        if (!neededKeys.has(k)) {
          scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          if (Array.isArray(chunk.mesh.material)) {
            chunk.mesh.material.forEach((m) => m.dispose());
          } else {
            chunk.mesh.material.dispose();
          }

          chunk.obstacles.forEach((obs) => {
            scene.remove(obs.mesh);
            const idx = activeObstaclesRef.current.indexOf(obs);
            if (idx !== -1) activeObstaclesRef.current.splice(idx, 1);
          });

          chunksRef.current.delete(k);
        }
      });
    };

    // Initial vehicle spawn at (0, y, 0)
    const initH = getTerrainHeight(0, 0);
    vehiclePosRef.current.set(0, initH, 0);
    updateChunks(0, 0);

    // Mouse drag orbit & wheel zoom listeners
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        cameraOrbitRef.current.isDragging = true;
        cameraOrbitRef.current.lastMouseX = e.clientX;
        cameraOrbitRef.current.lastMouseY = e.clientY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (cameraOrbitRef.current.isDragging) {
        const dx = e.clientX - cameraOrbitRef.current.lastMouseX;
        const dy = e.clientY - cameraOrbitRef.current.lastMouseY;
        cameraOrbitRef.current.lastMouseX = e.clientX;
        cameraOrbitRef.current.lastMouseY = e.clientY;

        cameraOrbitRef.current.yawOffset -= dx * 0.006;
        cameraOrbitRef.current.pitch = Math.max(
          0.1,
          Math.min(1.2, cameraOrbitRef.current.pitch + dy * 0.005)
        );
      }
    };

    const handleMouseUp = () => {
      cameraOrbitRef.current.isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      cameraOrbitRef.current.distance = Math.max(
        6,
        Math.min(30, cameraOrbitRef.current.distance + e.deltaY * 0.015)
      );
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: true });

    // Confetti / Explosion burst spawner
    const spawnConfetti = (pos: THREE.Vector3, count = 25) => {
      if (!particleGroupRef.current) return;
      const colors = [0xff0055, 0xffcc00, 0x00ccff, 0x33ff33, 0xff6600, 0xaa00ff];
      const starGeo = new THREE.BoxGeometry(0.35, 0.35, 0.08);

      for (let i = 0; i < count; i++) {
        const col = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({ color: col });
        const pMesh = new THREE.Mesh(starGeo, mat);
        pMesh.position.copy(pos);

        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        const vel = new THREE.Vector3(
          Math.cos(angle) * speed,
          4 + Math.random() * 7,
          Math.sin(angle) * speed
        );

        particleGroupRef.current.add(pMesh);
        particlesRef.current.push({
          mesh: pMesh,
          velocity: vel,
          rotSpeed: new THREE.Vector3(
            Math.random() * 10,
            Math.random() * 10,
            Math.random() * 10
          ),
          life: 0,
          maxLife: 1.0 + Math.random() * 0.6,
        });
      }
    };

    // 60Hz Game Loop with Software WebGL pacing
    let frameId = 0;
    let lastTickTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 60);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTickTime) / 1000);
      lastTickTime = now;
      const vDef = activeVehicleRef.current;

      if (vDef && vehicleGroupRef.current) {
        // Process Motion Inputs (Phone or Keyboard)
        const processed = processMotionData(latestMotionRef.current, calibrationRef.current);

        // Apply Keyboard Overrides if active
        let steerInput = processed.steer;
        let pitchInput = processed.pitch;

        if (keyStateRef.current['ArrowLeft'] || keyStateRef.current['KeyA']) {
          steerInput = -1.0;
        } else if (keyStateRef.current['ArrowRight'] || keyStateRef.current['KeyD']) {
          steerInput = 1.0;
        }

        if (keyStateRef.current['ArrowUp'] || keyStateRef.current['KeyW']) {
          pitchInput = 1.0;
        } else if (keyStateRef.current['ArrowDown'] || keyStateRef.current['KeyS']) {
          pitchInput = -1.0;
        }

        // Vehicle Flipping Check (> 80 deg threshold)
        const isFlipped = processed.isFlipped;
        setIsFlippedDisplay(isFlipped);

        if (isFlipped) {
          // Vehicle flips on its side and stops forward motion!
          flipAngleRef.current = THREE.MathUtils.damp(
            flipAngleRef.current,
            Math.PI / 2,
            8,
            delta
          );
          currentSpeedMultRef.current = THREE.MathUtils.damp(
            currentSpeedMultRef.current,
            0,
            10,
            delta
          );
        } else {
          // Instantly rights itself and resumes forward velocity
          flipAngleRef.current = THREE.MathUtils.damp(
            flipAngleRef.current,
            0,
            12,
            delta
          );

          // Calculate Target Speed Multiplier
          let targetMult = 1.0;
          if (pitchInput > 0) targetMult = vDef.boostMultiplier || 1.5;
          else if (pitchInput < 0) targetMult = vDef.slowMultiplier || 0.4;

          // If recently hit obstacle, apply brief slowdown (15% for 0.5s)
          if (slowImpactTimerRef.current > 0) {
            slowImpactTimerRef.current -= delta;
            targetMult *= 0.85;
          }

          currentSpeedMultRef.current = THREE.MathUtils.damp(
            currentSpeedMultRef.current,
            targetMult,
            5,
            delta
          );
        }

        const effectiveSpeed = vDef.baseSpeed * currentSpeedMultRef.current;
        setCurrentSpeed(Math.round(effectiveSpeed * 10) / 10);

        // Sound engine update
        soundSynth.updateEngine(currentSpeedMultRef.current, effectiveSpeed > 0.5);

        // Steering (Turns left/right)
        const turnRate = 2.2 * (vDef.type === 'air' ? 1.6 : 1.2);
        vehicleHeadingRef.current -= steerInput * turnRate * delta;

        // Forward Velocity Direction Vector (front of car is +Z)
        const forwardX = Math.sin(vehicleHeadingRef.current);
        const forwardZ = Math.cos(vehicleHeadingRef.current);

        // Advance vehicle in world coordinates
        vehiclePosRef.current.x += forwardX * effectiveSpeed * delta;
        vehiclePosRef.current.z += forwardZ * effectiveSpeed * delta;

        // Ground Height & Slopes
        const groundY = getTerrainHeight(vehiclePosRef.current.x, vehiclePosRef.current.z);

        if (vDef.type === 'ground') {
          // Jump gravity physics
          if (!isGroundedRef.current) {
            verticalVelocityRef.current -= 28 * delta; // gravity
            vehiclePosRef.current.y += verticalVelocityRef.current * delta;

            if (vehiclePosRef.current.y <= groundY) {
              vehiclePosRef.current.y = groundY;
              verticalVelocityRef.current = 0;
              isGroundedRef.current = true;
            }
          } else {
            // Ground Plane Snapping: vehicle aligns to slope and NEVER penetrates ground
            vehiclePosRef.current.y = groundY;
          }

          // Orient vehicle to ground normal
          const normal = getGroundNormal(vehiclePosRef.current.x, vehiclePosRef.current.z);
          _vec3A.set(normal.nx, normal.ny, normal.nz); // surface up
          _vec3B.set(forwardX, 0, forwardZ).normalize(); // heading forward

          // Calculate surface-aligned forward and right vectors
          _vec3C.crossVectors(_vec3A, _vec3B).normalize(); // right
          _vec3B.crossVectors(_vec3C, _vec3A).normalize(); // surface forward

          // Column 0 = Right, Column 1 = Up, Column 2 = Forward (+Z)
          const m4 = new THREE.Matrix4().makeBasis(_vec3C, _vec3A, _vec3B);
          _quatA.setFromRotationMatrix(m4);

          // Apply side flip rotation around heading axis
          _quatB.setFromAxisAngle(_vec3B, flipAngleRef.current);
          _quatA.multiply(_quatB);

          vehicleGroupRef.current.quaternion.slerp(_quatA, Math.min(1, 15 * delta));
        } else {
          // Air vehicle: Full 3D orientation & altitude climbing
          const climbRate = pitchInput * 12;
          vehiclePosRef.current.y += climbRate * delta;
          // Minimum altitude above terrain
          if (vehiclePosRef.current.y < groundY + 3.0) {
            vehiclePosRef.current.y = groundY + 3.0;
          }

          _eulerA.set(
            pitchInput * 0.5,
            vehicleHeadingRef.current,
            -steerInput * 0.45 + flipAngleRef.current,
            'YXZ'
          );
          vehicleGroupRef.current.quaternion.setFromEuler(_eulerA);
        }

        vehicleGroupRef.current.position.copy(vehiclePosRef.current);

        // Project contact shadow onto terrain ground directly beneath vehicle
        contactShadow.position.set(
          vehiclePosRef.current.x,
          groundY + 0.04,
          vehiclePosRef.current.z
        );
        contactShadow.rotation.y = vehicleHeadingRef.current;
        if (vDef.type === 'air') {
          const altitude = vehiclePosRef.current.y - groundY;
          const s = Math.max(0.3, 1.0 - altitude * 0.03);
          contactShadow.scale.set(s, 1, s);
          shadowMat.opacity = Math.max(0.08, 0.35 - altitude * 0.015);
        } else {
          contactShadow.scale.set(1, 1, 1);
          shadowMat.opacity = 0.35;
        }
        wheelMeshesRef.current.forEach((w) => {
          w.rotation.x += effectiveSpeed * 0.6 * delta;
        });

        // Spin rotors / propellers
        rotorMeshesRef.current.forEach((r) => {
          r.rotation.y += 30 * delta;
        });

        // Obstacle Collisions Check (Toddler-Friendly / Non-blocking)
        const hitRadius = 2.4;
        activeObstaclesRef.current.forEach((obs) => {
          if (obs.hit) {
            // Animate shattered obstacle bouncing or sinking
            obs.mesh.position.y -= 3.5 * delta;
            obs.mesh.scale.multiplyScalar(Math.max(0, 1 - 2 * delta));
            return;
          }

          const distSq = vehiclePosRef.current.distanceToSquared(obs.position);
          if (distSq < hitRadius * hitRadius) {
            obs.hit = true;
            obs.hitTime = Date.now();
            slowImpactTimerRef.current = 0.5; // slight speed drop
            soundSynth.playImpact();
            spawnConfetti(obs.position, 30);
            setScore((prev) => prev + obs.points);
          }
        });

        // Update Particle Simulation
        for (let pIdx = particlesRef.current.length - 1; pIdx >= 0; pIdx--) {
          const p = particlesRef.current[pIdx];
          p.life += delta;
          if (p.life >= p.maxLife) {
            particleGroup.remove(p.mesh);
            p.mesh.geometry.dispose();
            particlesRef.current.splice(pIdx, 1);
            continue;
          }

          p.velocity.y -= 15 * delta; // gravity
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.mesh.rotation.x += p.rotSpeed.x * delta;
          p.mesh.rotation.y += p.rotSpeed.y * delta;
          const progress = 1 - p.life / p.maxLife;
          p.mesh.scale.setScalar(progress);
        }

        // Procedural Infinite Terrain Chunk Updating
        updateChunks(vehiclePosRef.current.x, vehiclePosRef.current.z);

        // Smooth Third-Person Follow Camera (stationed behind vehicle looking forward)
        const orbit = cameraOrbitRef.current;
        const camYaw = vehicleHeadingRef.current + orbit.yawOffset;
        const camDist = orbit.distance;
        const camHeight = Math.sin(orbit.pitch) * camDist + 2.5;
        const camHPlane = Math.cos(orbit.pitch) * camDist;

        // Position camera behind vehicle
        const targetCamX = vehiclePosRef.current.x - Math.sin(camYaw) * camHPlane;
        const targetCamZ = vehiclePosRef.current.z - Math.cos(camYaw) * camHPlane;
        const targetCamY = vehiclePosRef.current.y + camHeight;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 6, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 6, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 6, delta);

        // Look at point slightly in front of the vehicle
        _vec3A.set(
          vehiclePosRef.current.x + Math.sin(vehicleHeadingRef.current) * 4,
          vehiclePosRef.current.y + 1.2,
          vehiclePosRef.current.z + Math.cos(vehicleHeadingRef.current) * 4
        );
        camera.lookAt(_vec3A);

        // Keep sun shadows centered on vehicle
        sunLight.position.set(
          vehiclePosRef.current.x + 60,
          vehiclePosRef.current.y + 100,
          vehiclePosRef.current.z + 50
        );
        sunLight.target.position.copy(vehiclePosRef.current);
        sunLight.target.updateMatrixWorld();
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    // Pre-warm shaders
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    tick();

    // Window Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);

      soundSynth.stopEngine();

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update 3D vehicle mesh whenever activeVehicle changes
  useEffect(() => {
    if (!activeVehicle || !vehicleGroupRef.current) return;

    // Remove previous vehicle model
    if (vehicleModelRef.current) {
      vehicleGroupRef.current.remove(vehicleModelRef.current);
      disposeHierarchy(vehicleModelRef.current);
      vehicleModelRef.current = null;
      wheelMeshesRef.current = [];
      rotorMeshesRef.current = [];
    }

    // Build fresh model using geometry function
    try {
      const model = activeVehicle.geometry(THREE);
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Categorize rotating parts
          const geoType = mesh.geometry?.type || '';
          if (mesh.name.includes('wheel') || geoType.includes('Cylinder')) {
            wheelMeshesRef.current.push(mesh);
          }
          if (mesh.name.includes('blade') || mesh.name.includes('rotor')) {
            rotorMeshesRef.current.push(mesh);
          }
        }
      });

      vehicleGroupRef.current.add(model);
      vehicleModelRef.current = model;
      activeVehicleRef.current = activeVehicle;
      soundSynth.playCheer();
    } catch (e) {
      console.error('Failed to instantiate vehicle model:', e);
    }
  }, [activeVehicle]);

  return (
    <div className="relative w-full h-screen bg-sky-200 overflow-hidden select-none">
      {/* Three.js Isolated Canvas Mount (Directive 4) */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Banner (Specs & Game Info) */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-xs rounded-2xl shadow-lg border-2 border-amber-300">
          <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center font-black text-slate-900 shadow-sm">
            {activeVehicle?.type === 'air' ? <Plane className="w-5 h-5" /> : <Car className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 tracking-tight leading-tight">
              {activeVehicle?.name || 'Loading Vehicle...'}
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              {activeVehicle?.type} • Speed {currentSpeed} mph
            </div>
          </div>
        </div>

        {/* Star Points Badge */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-400 text-slate-950 font-black rounded-2xl shadow-lg text-xs">
          <Sparkles className="w-4 h-4 fill-slate-950" />
          <span>{score} Stars</span>
        </div>

        {/* Flipped Notice Alert if tilted > 80 deg */}
        {isFlippedDisplay && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 text-white font-black rounded-2xl shadow-lg text-xs animate-bounce">
            <span>Upside Down! Turn phone upright to drive!</span>
          </div>
        )}
      </div>

      {/* Top Right Buttons (QR Connect & Sound) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Connection status button */}
        <button
          onClick={() => setIsQRModalOpen(true)}
          aria-label="Connect Phone Controller via QR Code"
          className="flex items-center gap-2 px-3.5 py-2 bg-white/95 rounded-2xl shadow-lg border-2 border-amber-300 font-bold text-xs text-slate-800 hover:bg-amber-50 transition"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
          />
          <QrCode className="w-4 h-4 text-amber-600" />
          <span>{isConnected ? 'Phone Connected' : 'Connect Phone'}</span>
        </button>

        {/* Vehicle Switcher Button */}
        <button
          onClick={() => setIsVehicleModalOpen(true)}
          aria-label="Change or Generate Vehicles"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-2xl shadow-lg transition"
        >
          <Car className="w-4 h-4" />
          <span>Vehicles</span>
        </button>

        {/* Sound Mute Toggle */}
        <button
          onClick={() => setIsMuted(soundSynth.toggleMute())}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className="w-10 h-10 rounded-2xl bg-white/95 border-2 border-slate-200 text-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-100 transition"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5 text-emerald-600" />}
        </button>
      </div>

      {/* Unified Ergonomic Bottom Control Dock (Directive 5) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
        {/* Collapse / Expand Cinema Mode Toggle */}
        <button
          onClick={() => setIsHudCollapsed(!isHudCollapsed)}
          aria-label={isHudCollapsed ? 'Show Controls Dock' : 'Hide Controls Dock'}
          className="mb-1.5 px-3 py-1 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 shadow-md transition backdrop-blur-xs"
        >
          {isHudCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{isHudCollapsed ? 'Show Controls (H)' : 'Hide Controls'}</span>
        </button>

        {!isHudCollapsed && (
          <div className="bg-white/95 rounded-3xl p-3 shadow-2xl border-3 border-amber-300 flex items-center gap-3 text-xs font-bold text-slate-700 max-w-[94vw] flex-wrap justify-center">
            {/* Direct On-Screen Action Buttons for Toddlers & Desktop Users */}
            <button
              onClick={() => soundSynth.playHorn()}
              aria-label="Honk Car Horn"
              className="px-3.5 py-2 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-black flex items-center gap-1.5 shadow-sm transition"
            >
              <Volume2 className="w-4 h-4" />
              <span>Honk!</span>
            </button>

            <button
              onClick={triggerJump}
              aria-label="Make Vehicle Jump"
              className="px-3.5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black flex items-center gap-1.5 shadow-sm transition"
            >
              <ArrowUp className="w-4 h-4" />
              <span>Jump! (Space)</span>
            </button>

            {/* Reset Camera View */}
            <button
              onClick={() => {
                cameraOrbitRef.current.yawOffset = 0;
                cameraOrbitRef.current.pitch = 0.35;
                cameraOrbitRef.current.distance = 12;
              }}
              aria-label="Reset Camera Angle"
              className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Cam</span>
            </button>

            {/* Dual Screen Split View button */}
            {onOpenSplitView && (
              <button
                onClick={onOpenSplitView}
                aria-label="Open Split Dual Screen Mode"
                className="px-3 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1.5 border border-indigo-200 transition"
              >
                <span>Split Screen Test</span>
              </button>
            )}

            {/* Desktop Keyboard Hints */}
            <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 font-medium px-2">
              <span>Keys:</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[10px] font-mono text-slate-600">WASD / Arrows</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[10px] font-mono text-slate-600">Space</kbd>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        sessionId={sessionId}
        isConnected={isConnected}
        onOpenSplitView={onOpenSplitView}
      />

      {/* Dynamic Vehicle Modal */}
      {activeVehicle && (
        <VehicleModal
          isOpen={isVehicleModalOpen}
          onClose={() => setIsVehicleModalOpen(false)}
          currentVehicle={activeVehicle}
          onVehicleLoaded={(newVeh) => {
            setActiveVehicle(newVeh);
            activeVehicleRef.current = newVeh;
          }}
        />
      )}
    </div>
  );
};

// Clean disposal helper for Three.js objects
function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    }
  });
}

// Procedural 3-12 Part Cartoon Obstacle Generator
function createObstacleMesh(
  type: 'tree' | 'fence' | 'present' | 'balloon' | 'snowman' | 'flower'
): THREE.Group {
  const group = new THREE.Group();

  if (type === 'tree') {
    // 3-part cartoon pine or round tree
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 1.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 })
    );
    trunk.position.y = 0.9;
    group.add(trunk);

    const foliage1 = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8, flatShading: true })
    );
    foliage1.position.y = 2.4;
    const foliage2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 1.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8, flatShading: true })
    );
    foliage2.position.y = 3.3;
    group.add(foliage1, foliage2);
  } else if (type === 'present') {
    // Gift box with ribbon
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    box.position.y = 0.7;
    const ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(1.44, 1.44, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 })
    );
    ribbon.position.y = 0.7;
    group.add(box, ribbon);
  } else if (type === 'balloon') {
    // Floating air balloon
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.2 })
    );
    sphere.position.y = 3.5;
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    string.position.y = 1.6;
    group.add(sphere, string);
  } else if (type === 'snowman') {
    // Snowman with carrot nose
    const bottom = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    bottom.position.y = 0.9;
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    top.position.y = 2.2;
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xf97316 })
    );
    nose.rotateX(Math.PI / 2);
    nose.position.set(0, 2.2, 0.8);
    group.add(bottom, top, nose);
  } else if (type === 'fence') {
    // Wooden cartoon post fence
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.8 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), postMat);
    p1.position.set(-0.8, 0.6, 0);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), postMat);
    p2.position.set(0.8, 0.6, 0);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.08), postMat);
    rail.position.set(0, 0.7, 0);
    group.add(p1, p2, rail);
  } else {
    // Giant colorful flower
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x22c55e })
    );
    stem.position.y = 0.7;
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 })
    );
    center.position.y = 1.4;
    const petals = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e })
    );
    petals.position.y = 1.4;
    group.add(stem, center, petals);
  }

  return group;
}

// Giant cartoon rainbow arch in sky
function createRainbow(): THREE.Group {
  const group = new THREE.Group();
  const colors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6, 0x8b5cf6];
  let radius = 90;

  colors.forEach((col) => {
    const geo = new THREE.TorusGeometry(radius, 1.4, 8, 32, Math.PI);
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    radius += 2.5;
  });

  return group;
}
