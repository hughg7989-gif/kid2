/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Compass,
  RotateCcw,
  Sliders,
  Save,
  Copy,
  Check,
  Smartphone,
  Flame,
  Volume2,
  ArrowUpCircle,
  Wifi,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CalibrationSettings, MotionDataPayload } from '../types/game';
import {
  DEFAULT_CALIBRATION,
  decodePreset,
  encodePreset,
  normalizeAngleDeg,
} from '../utils/motion';
import { NetworkManager } from '../utils/webrtc';
import { soundSynth } from '../utils/audio';

interface MobileControllerProps {
  sessionId: string;
  networkManager?: NetworkManager;
  onBackToHost?: () => void;
}

export const MobileController: React.FC<MobileControllerProps> = ({
  sessionId,
  networkManager: propNetworkManager,
  onBackToHost,
}) => {
  const [netManager, setNetManager] = useState<NetworkManager | null>(propNetworkManager || null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [needsPermission, setNeedsPermission] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Calibration state
  const [calibration, setCalibration] = useState<CalibrationSettings>(() => {
    try {
      const saved = localStorage.getItem('tinydrive_calibration');
      if (saved) return decodePreset(saved);
    } catch {
      // ignore
    }
    return DEFAULT_CALIBRATION;
  });

  const [presetInput, setPresetInput] = useState<string>('');
  const [copiedPreset, setCopiedPreset] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Live sensor readings
  const [currentOrientation, setCurrentOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [currentAccel, setCurrentAccel] = useState({ x: 0, y: 0, z: 9.8 });

  // Action states
  const [isHornActive, setIsHornActive] = useState<boolean>(false);
  const [isBoostActive, setIsBoostActive] = useState<boolean>(false);
  const [isJumpActive, setIsJumpActive] = useState<boolean>(false);

  // Fallback virtual touch drag pad
  const touchPadRef = useRef<HTMLDivElement>(null);
  const isTouchDragging = useRef<boolean>(false);

  // Setup Network Manager if not provided
  useEffect(() => {
    if (propNetworkManager) {
      setNetManager(propNetworkManager);
      setIsConnected(propNetworkManager.getState() === 'connected');
      return;
    }

    const nm = new NetworkManager({
      onStateChange: (state, message) => {
        setConnectionStatus(message || state);
        setIsConnected(state === 'connected');
      },
    });

    nm.connectToHost(sessionId);
    setNetManager(nm);

    return () => {
      nm.destroy();
    };
  }, [sessionId, propNetworkManager]);

  // Check iOS permission requirements
  useEffect(() => {
    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DeviceOrientation !== 'undefined' && typeof DeviceOrientation.requestPermission === 'function') {
      setNeedsPermission(true);
    }
  }, []);

  const requestOrientationPermission = async () => {
    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DeviceOrientation?.requestPermission === 'function') {
      try {
        const response = await DeviceOrientation.requestPermission();
        if (response === 'granted') {
          setNeedsPermission(false);
        }
      } catch (err) {
        console.warn('Orientation permission denied:', err);
      }
    }
  };

  // Zero / Center button: records current angles as world (0,0,0)
  const handleSetZero = useCallback(() => {
    setCalibration((prev) => {
      const updated: CalibrationSettings = {
        ...prev,
        centerAlpha: currentOrientation.alpha,
        centerBeta: currentOrientation.beta,
        centerGamma: currentOrientation.gamma,
      };
      try {
        localStorage.setItem('tinydrive_calibration', encodePreset(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    soundSynth.playCheer();
  }, [currentOrientation]);

  // Motion event listeners
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Support both standard alpha and iOS webkitCompassHeading
      const rawAlpha = typeof (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading === 'number'
        ? (360 - (e as unknown as { webkitCompassHeading: number }).webkitCompassHeading)
        : (e.alpha ?? 0);

      setCurrentOrientation({
        alpha: rawAlpha,
        beta: e.beta ?? 0,
        gamma: e.gamma ?? 0,
      });
    };

    const handleMotion = (e: DeviceMotionEvent) => {
      if (e.accelerationIncludingGravity) {
        setCurrentAccel({
          x: e.accelerationIncludingGravity.x || 0,
          y: e.accelerationIncludingGravity.y || 0,
          z: e.accelerationIncludingGravity.z || 9.8,
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, []);

  // Continuous 60Hz network transmission loop
  useEffect(() => {
    let animId: number;
    let lastSendTime = 0;

    const loop = (time: number) => {
      // Stream at ~60Hz (~16ms intervals)
      if (time - lastSendTime >= 15) {
        lastSendTime = time;

        const payload: MotionDataPayload = {
          orientation: currentOrientation,
          acceleration: currentAccel,
          actions: {
            horn: isHornActive,
            boost: isBoostActive,
            jump: isJumpActive,
          },
          timestamp: Date.now(),
        };

        netManager?.sendMotionData(payload);
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [netManager, currentOrientation, currentAccel, isHornActive, isBoostActive, isJumpActive]);

  // Preset operations
  const handleSavePreset = () => {
    try {
      localStorage.setItem('tinydrive_calibration', encodePreset(calibration));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyPreset = () => {
    navigator.clipboard.writeText(encodePreset(calibration));
    setCopiedPreset(true);
    setTimeout(() => setCopiedPreset(false), 2000);
  };

  const handleApplyPresetString = () => {
    if (!presetInput.trim()) return;
    const decoded = decodePreset(presetInput, calibration);
    setCalibration(decoded);
    try {
      localStorage.setItem('tinydrive_calibration', encodePreset(decoded));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch {
      // ignore
    }
  };

  // Touch Virtual Joystick simulation for desktop or devices without gyro
  const handleTouchPad = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchPadRef.current) return;
    const rect = touchPadRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));

    if (calibration.steeringMode === 'yaw') {
      // In Yaw mode, horizontal dragging simulates turning the toy car flat on the floor
      setCurrentOrientation((prev) => ({
        ...prev,
        alpha: normalizeAngleDeg(calibration.centerAlpha + nx * calibration.maxTilt),
        beta: 0,
        gamma: 0,
      }));
    } else {
      setCurrentOrientation({
        alpha: 0,
        beta: -ny * 40,  // pitch
        gamma: nx * 40,   // roll
      });
    }
  };

  // Effective tilt angles for on-screen feedback
  let effYaw = normalizeAngleDeg(currentOrientation.alpha - calibration.centerAlpha);
  if (calibration.orientationMode === 'face-down') effYaw = -effYaw;
  if (calibration.invertYaw) effYaw = -effYaw;

  const effRoll = normalizeAngleDeg(currentOrientation.gamma - calibration.centerGamma);
  const effPitch = normalizeAngleDeg(currentOrientation.beta - calibration.centerBeta);

  return (
    <div className="relative w-full h-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none touch-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-sm shadow-md">
            TD
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Phone Controller</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Room: <span className="text-amber-400 font-bold">{sessionId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isConnected
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-amber-950 text-amber-400 border border-amber-800'
            }`}
          >
            <Wifi className="w-3 h-3" />
            <span>{isConnected ? 'Linked' : connectionStatus}</span>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Toggle Calibration Settings"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {onBackToHost && (
            <button
              onClick={onBackToHost}
              className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Host View
            </button>
          )}
        </div>
      </header>

      {/* iOS Motion Permission Banner */}
      {needsPermission && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 flex items-center justify-between text-xs font-bold shrink-0">
          <span>Enable phone motion sensors to steer</span>
          <button
            onClick={requestOrientationPermission}
            className="px-3 py-1 bg-slate-950 text-white rounded-lg shadow-sm"
          >
            Enable Sensors
          </button>
        </div>
      )}

      {/* Main Interactive Play Area */}
      <div className="flex-1 flex flex-col justify-between p-4 relative overflow-hidden">
        {/* Steering Mode Selector Badge */}
        <div className="flex items-center justify-center gap-1.5 shrink-0 mb-1">
          <button
            onClick={() => setCalibration({ ...calibration, steeringMode: 'yaw' })}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition border ${
              calibration.steeringMode === 'yaw'
                ? 'bg-amber-400 text-slate-950 border-white shadow-md'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>🏎️ Flat Toy Car (Yaw / Heading)</span>
          </button>
          <button
            onClick={() => setCalibration({ ...calibration, steeringMode: 'tilt' })}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition border ${
              calibration.steeringMode === 'tilt'
                ? 'bg-amber-400 text-slate-950 border-white shadow-md'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>📱 Tilt Steering</span>
          </button>
        </div>

        {/* Live Visual 3D Phone / Flat Toy Car Orientation Visualizer */}
        <div className="flex flex-col items-center justify-center py-1 shrink-0">
          <div className="relative w-40 h-28 rounded-3xl border-2 border-amber-400/40 bg-slate-900/90 shadow-2xl flex items-center justify-center p-2 perspective-500 overflow-hidden">
            {calibration.steeringMode === 'yaw' ? (
              // Flat Top-Down Toy Car Horizontal Turntable Visualizer
              <div
                className="relative w-24 h-16 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 border-3 border-white shadow-xl flex items-center justify-between px-2 text-slate-950 font-black text-[11px] transition-transform duration-75"
                style={{
                  transform: `rotate(${effYaw}deg)`,
                }}
              >
                {/* Left/Right turn arrows on car body */}
                <span className="text-[10px] opacity-70">L</span>
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-1.5 rounded-t bg-slate-950 mb-0.5" />
                  <span className="leading-none text-[9px] uppercase tracking-wider">CAR</span>
                </div>
                <span className="text-[10px] opacity-70">R</span>

                {/* Front nose indicator */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-amber-200 rounded-t-sm border border-slate-950" />
              </div>
            ) : (
              // Traditional 3D Tilted Phone Visualizer
              <div
                className="w-20 h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 border-2 border-white shadow-lg flex items-center justify-center text-slate-950 font-black text-[10px] transition-transform duration-75"
                style={{
                  transform: `rotate(${effRoll}deg) rotateX(${effPitch * 0.7}deg)`,
                }}
              >
                <Smartphone className="w-4 h-4 mr-1" />
                STEER
              </div>
            )}
          </div>

          {/* Real-time Angle Readouts */}
          <div className="flex flex-col items-center text-center mt-1.5">
            {calibration.steeringMode === 'yaw' ? (
              <>
                <div className="text-xs font-black tracking-wide">
                  {Math.abs(effYaw) <= calibration.deadzone ? (
                    <span className="text-emerald-400">Heading Straight (0°)</span>
                  ) : effYaw < 0 ? (
                    <span className="text-sky-300">Turning Left ({Math.round(effYaw)}°) ⬅️</span>
                  ) : (
                    <span className="text-amber-300">Turning Right (+{Math.round(effYaw)}°) ➡️</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Rotating horizontally on floor • Pitch & Roll ignored
                </span>
              </>
            ) : (
              <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
                <span>Roll: <strong className="text-amber-300">{Math.round(effRoll)}°</strong></span>
                <span>Pitch: <strong className="text-sky-300">{Math.round(effPitch)}°</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Virtual Drag Pad fallback */}
        <div
          ref={touchPadRef}
          onPointerDown={(e) => {
            isTouchDragging.current = true;
            handleTouchPad(e);
          }}
          onPointerMove={(e) => {
            if (isTouchDragging.current) handleTouchPad(e);
          }}
          onPointerUp={() => {
            isTouchDragging.current = false;
          }}
          className="mx-auto w-full max-w-xs h-24 rounded-3xl border-2 border-dashed border-slate-700 bg-slate-900/60 flex flex-col items-center justify-center text-center p-2 touch-none cursor-grab active:cursor-grabbing"
        >
          <Compass className="w-5 h-5 text-amber-400 mb-1" />
          <span className="text-xs font-bold text-slate-200">
            {calibration.steeringMode === 'yaw'
              ? 'Rotate Toy Car on Floor to Steer'
              : 'Tilt Phone to Steer'}
          </span>
          <span className="text-[10px] text-slate-500">
            {calibration.steeringMode === 'yaw'
              ? 'or slide finger left/right here to simulate flat rotation'
              : 'or drag your thumb here to steer manually'}
          </span>
        </div>

        {/* Big Tactile Action Buttons */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-md mx-auto pt-2 shrink-0">
          {/* Big Horn Button */}
          <button
            onPointerDown={() => {
              setIsHornActive(true);
              soundSynth.playHorn();
            }}
            onPointerUp={() => setIsHornActive(false)}
            onPointerLeave={() => setIsHornActive(false)}
            aria-label="Horn Beep"
            className={`h-22 rounded-3xl flex flex-col items-center justify-center gap-1 border-3 font-black text-xs uppercase tracking-wider transition-transform active:scale-95 shadow-lg ${
              isHornActive
                ? 'bg-amber-400 border-white text-slate-950 scale-95'
                : 'bg-amber-500/20 border-amber-400/60 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            <Volume2 className="w-6 h-6" />
            <span>Honk!</span>
          </button>

          {/* Big Jump Button */}
          <button
            onPointerDown={() => {
              setIsJumpActive(true);
              soundSynth.playJump();
            }}
            onPointerUp={() => setIsJumpActive(false)}
            onPointerLeave={() => setIsJumpActive(false)}
            aria-label="Jump Action"
            className={`h-22 rounded-3xl flex flex-col items-center justify-center gap-1 border-3 font-black text-xs uppercase tracking-wider transition-transform active:scale-95 shadow-lg ${
              isJumpActive
                ? 'bg-emerald-400 border-white text-slate-950 scale-95'
                : 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            <ArrowUpCircle className="w-6 h-6" />
            <span>Jump!</span>
          </button>

          {/* Big Turbo Boost Button */}
          <button
            onPointerDown={() => setIsBoostActive(true)}
            onPointerUp={() => setIsBoostActive(false)}
            onPointerLeave={() => setIsBoostActive(false)}
            aria-label="Turbo Boost"
            className={`h-22 rounded-3xl flex flex-col items-center justify-center gap-1 border-3 font-black text-xs uppercase tracking-wider transition-transform active:scale-95 shadow-lg ${
              isBoostActive
                ? 'bg-rose-500 border-white text-white scale-95'
                : 'bg-rose-500/20 border-rose-400/60 text-rose-300 hover:bg-rose-500/30'
            }`}
          >
            <Flame className="w-6 h-6" />
            <span>Boost!</span>
          </button>
        </div>

        {/* Set Zero / Center Button */}
        <div className="w-full max-w-md mx-auto pt-2 shrink-0">
          <button
            onClick={handleSetZero}
            aria-label="Set Center Zero Orientation"
            className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 border-2 border-white text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {calibration.steeringMode === 'yaw'
                ? 'Set Straight Ahead (Point Toy Car Forward & Tap)'
                : 'Calibrate Zero (Hold Flat & Tap)'}
            </span>
          </button>
        </div>
      </div>

      {/* Expandable Calibration & Preset Drawer */}
      {showSettings && (
        <div className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-slate-900 border-t-2 border-amber-400/50 rounded-t-3xl p-5 overflow-y-auto shadow-2xl z-20 space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 font-black text-sm text-slate-100">
              <Sliders className="w-4 h-4 text-amber-400" />
              Calibration & Preset Manager
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Steering Mode Toggle */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              Active Steering Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCalibration({ ...calibration, steeringMode: 'yaw' })}
                className={`py-2 px-3 rounded-xl font-bold border transition ${
                  calibration.steeringMode === 'yaw'
                    ? 'bg-amber-500 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                Flat Toy Car (Yaw / Heading)
              </button>
              <button
                onClick={() => setCalibration({ ...calibration, steeringMode: 'tilt' })}
                className={`py-2 px-3 rounded-xl font-bold border transition ${
                  calibration.steeringMode === 'tilt'
                    ? 'bg-amber-500 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                Tilt Steering (Roll / Pitch)
              </button>
            </div>
          </div>

          {/* Orientation Mode Toggle */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              Phone Placement on Toy Car
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCalibration({ ...calibration, orientationMode: 'face-up' })}
                className={`py-2 px-3 rounded-xl font-bold border transition ${
                  calibration.orientationMode === 'face-up'
                    ? 'bg-amber-500 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                Face-Up (Standard)
              </button>
              <button
                onClick={() => setCalibration({ ...calibration, orientationMode: 'face-down' })}
                className={`py-2 px-3 rounded-xl font-bold border transition ${
                  calibration.orientationMode === 'face-down'
                    ? 'bg-amber-500 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                Face-Down (On Toy Car)
              </button>
            </div>
          </div>

          {/* Deadzone Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
              <span className="text-slate-300">Deadzone (Ignore Micro-Tremors):</span>
              <span className="text-amber-400 font-mono">{calibration.deadzone}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={15}
              step={1}
              value={calibration.deadzone}
              onChange={(e) => setCalibration({ ...calibration, deadzone: Number(e.target.value) })}
              className="w-full accent-amber-400"
            />
          </div>

          {/* Sensitivity Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
              <span className="text-slate-300">Steering Sensitivity:</span>
              <span className="text-amber-400 font-mono">{calibration.sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={calibration.sensitivity}
              onChange={(e) => setCalibration({ ...calibration, sensitivity: Number(e.target.value) })}
              className="w-full accent-amber-400"
            />
          </div>

          {/* Invert Controls */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
              Invert Control Axes
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setCalibration({ ...calibration, invertRoll: !calibration.invertRoll })}
                className={`py-1.5 px-2 rounded-xl font-bold border text-[11px] ${
                  calibration.invertRoll
                    ? 'bg-amber-500 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {calibration.invertRoll ? '✓ Inv Roll' : 'Normal Roll'}
              </button>
              <button
                onClick={() => setCalibration({ ...calibration, invertPitch: !calibration.invertPitch })}
                className={`py-1.5 px-2 rounded-xl font-bold border text-[11px] ${
                  calibration.invertPitch
                    ? 'bg-amber-500 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {calibration.invertPitch ? '✓ Inv Pitch' : 'Normal Pitch'}
              </button>
              <button
                onClick={() => setCalibration({ ...calibration, invertYaw: !calibration.invertYaw })}
                className={`py-1.5 px-2 rounded-xl font-bold border text-[11px] ${
                  calibration.invertYaw
                    ? 'bg-amber-500 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {calibration.invertYaw ? '✓ Inv Yaw' : 'Normal Yaw'}
              </button>
            </div>
          </div>

          {/* Preset Manager: Save / Copy / Paste */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-bold text-slate-300">Preset String Manager</div>
            <div className="flex gap-2">
              <button
                onClick={handleSavePreset}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savedSuccess ? 'Saved!' : 'Save Preset'}</span>
              </button>
              <button
                onClick={handleCopyPreset}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5 border border-slate-700"
              >
                {copiedPreset ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPreset ? 'Copied!' : 'Copy Preset'}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste preset string (e.g. {&quot;dz&quot;:5...})"
                value={presetInput}
                onChange={(e) => setPresetInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 font-mono text-[11px] focus:outline-hidden focus:border-amber-400"
              />
              <button
                onClick={handleApplyPresetString}
                className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl"
              >
                Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
