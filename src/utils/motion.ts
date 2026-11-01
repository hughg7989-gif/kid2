/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationSettings, MotionDataPayload, ProcessedInput } from '../types/game';

export const DEFAULT_CALIBRATION: CalibrationSettings = {
  centerAlpha: 0,
  centerBeta: 0,
  centerGamma: 0,
  invertPitch: false,
  invertRoll: false,
  invertYaw: false,
  deadzone: 4,         // degrees threshold for micro-tremors on floor
  sensitivity: 1.2,    // multiplier
  maxTilt: 35,         // degrees for full steering lock
  orientationMode: 'face-up',
  steeringMode: 'yaw', // DEFAULT to 'yaw' for flat physical toy car on floor!
  yawMode: 'relative',
};

export const JUMP_THRESHOLD = 15.0; // m/s^2 impulse along Z or total accel spike
export const FLIP_THRESHOLD_DEG = 80; // critical tilt angle where vehicle flips over

/**
 * Normalizes an angle in degrees into [-180, 180).
 */
export function normalizeAngleDeg(deg: number): number {
  let angle = (deg + 180) % 360;
  if (angle < 0) angle += 360;
  return angle - 180;
}

/**
 * Applies deadzone to an angle delta. If within [-deadzone, deadzone], returns 0.
 * Otherwise scales the remainder smoothly.
 */
export function applyDeadzone(value: number, deadzone: number): number {
  const abs = Math.abs(value);
  if (abs <= deadzone) {
    return 0;
  }
  const sign = Math.sign(value);
  return sign * (abs - deadzone);
}

/**
 * Process raw motion data from phone according to calibration settings.
 * Supports:
 * 1) 'yaw' mode: Phone mounted flat (face-up or face-down) on physical toy car.
 *    Steering is strictly derived from rotation around the vertical Z-axis (Yaw / Heading / Azimuth / Alpha).
 *    Pitch and Roll (tilting) are COMPLETELY IGNORED for steering and speed,
 *    used solely for physical flip detection if the toy car flips over.
 * 2) 'tilt' mode: Traditional racing game steering via roll/pitch.
 */
export function processMotionData(
  payload: MotionDataPayload,
  cal: CalibrationSettings
): ProcessedInput {
  const { orientation, acceleration } = payload;

  // Check flip condition (> FLIP_THRESHOLD_DEG on either pitch or roll)
  const isFlipped =
    Math.abs(normalizeAngleDeg(orientation.beta)) > FLIP_THRESHOLD_DEG ||
    Math.abs(normalizeAngleDeg(orientation.gamma)) > FLIP_THRESHOLD_DEG;

  let steerNorm = 0;
  let pitchNorm = 0;
  let speedMultiplier = 1.0;

  // Shortest angular distance around vertical Z-axis from calibrated forward center
  let rawAlpha = normalizeAngleDeg(orientation.alpha - cal.centerAlpha);

  if (cal.steeringMode === 'yaw') {
    // =========================================================================
    // PHYSICAL TOY CAR FLAT ROTATION MODE (Z-Axis / Yaw / Heading / Azimuth)
    // Completely ignores pitch and roll tilt!
    // =========================================================================
    if (cal.orientationMode === 'face-down') {
      // Invert yaw direction when phone is flipped face-down on car roof
      rawAlpha = -rawAlpha;
    }

    const signedYaw = cal.invertYaw ? -rawAlpha : rawAlpha;
    const effectiveYaw = applyDeadzone(signedYaw, cal.deadzone);

    // Map yaw rotation angle to [-1, 1] steer range
    const availableYaw = Math.max(1, cal.maxTilt - cal.deadzone);
    steerNorm = Math.min(1, Math.max(-1, (effectiveYaw / availableYaw) * cal.sensitivity));

    // Pitch is strictly ignored for speed in flat toy car mode
    pitchNorm = 0;
    speedMultiplier = payload.actions?.boost ? 1.5 : 1.0;

    // Jump detection: vertical acceleration impulse or explicit jump action
    const zAccel = Math.abs(acceleration.z);
    const totalMag = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
    const isJumpTriggered =
      Boolean(payload.actions?.jump) ||
      zAccel > JUMP_THRESHOLD ||
      totalMag > JUMP_THRESHOLD * 1.4;

    return {
      steer: steerNorm,
      pitch: pitchNorm,
      yaw: signedYaw,
      isFlipped,
      isJumpTriggered,
      speedMultiplier,
    };
  }

  // =========================================================================
  // TRADITIONAL TILT STEERING MODE (Roll / Pitch)
  // =========================================================================
  let rawBeta = normalizeAngleDeg(orientation.beta - cal.centerBeta);
  let rawGamma = normalizeAngleDeg(orientation.gamma - cal.centerGamma);

  if (cal.orientationMode === 'face-down') {
    rawBeta = -rawBeta;
    rawGamma = -rawGamma;
  }

  const signedPitch = cal.invertPitch ? -rawBeta : rawBeta;
  const signedRoll = cal.invertRoll ? -rawGamma : rawGamma;
  const signedYaw = cal.invertYaw ? -rawAlpha : rawAlpha;

  const effectiveRoll = applyDeadzone(signedRoll, cal.deadzone);
  const effectivePitch = applyDeadzone(signedPitch, cal.deadzone);

  const availableTilt = Math.max(1, cal.maxTilt - cal.deadzone);
  steerNorm = Math.min(1, Math.max(-1, (effectiveRoll / availableTilt) * cal.sensitivity));
  pitchNorm = Math.min(1, Math.max(-1, (effectivePitch / availableTilt) * cal.sensitivity));

  if (pitchNorm > 0) {
    speedMultiplier = 1.0 + pitchNorm * 0.5;
  } else if (pitchNorm < 0) {
    speedMultiplier = Math.max(0.4, 1.0 + pitchNorm * 0.6);
  }

  const zAccel = Math.abs(acceleration.z);
  const totalMag = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
  const isJumpTriggered =
    Boolean(payload.actions?.jump) ||
    zAccel > JUMP_THRESHOLD ||
    totalMag > JUMP_THRESHOLD * 1.4;

  return {
    steer: steerNorm,
    pitch: pitchNorm,
    yaw: signedYaw,
    isFlipped,
    isJumpTriggered,
    speedMultiplier,
  };
}

/**
 * Compact JSON preset encoding for easy copy/paste sharing.
 */
export function encodePreset(cal: CalibrationSettings): string {
  const compact = {
    ca: Math.round(cal.centerAlpha),
    cb: Math.round(cal.centerBeta),
    cg: Math.round(cal.centerGamma),
    ip: cal.invertPitch ? 1 : 0,
    ir: cal.invertRoll ? 1 : 0,
    iy: cal.invertYaw ? 1 : 0,
    dz: cal.deadzone,
    s: Number(cal.sensitivity.toFixed(2)),
    mt: cal.maxTilt,
    om: cal.orientationMode === 'face-down' ? 'd' : 'u',
    sm: cal.steeringMode === 'tilt' ? 't' : 'y',
  };
  return JSON.stringify(compact);
}

/**
 * Decodes a preset string into CalibrationSettings.
 */
export function decodePreset(
  str: string,
  base: CalibrationSettings = DEFAULT_CALIBRATION
): CalibrationSettings {
  try {
    const raw = JSON.parse(str.trim());
    return {
      centerAlpha: typeof raw.ca === 'number' ? raw.ca : base.centerAlpha,
      centerBeta: typeof raw.cb === 'number' ? raw.cb : base.centerBeta,
      centerGamma: typeof raw.cg === 'number' ? raw.cg : base.centerGamma,
      invertPitch: raw.ip === 1 || raw.invertPitch === true,
      invertRoll: raw.ir === 1 || raw.invertRoll === true,
      invertYaw: raw.iy === 1 || raw.invertYaw === true,
      deadzone: typeof raw.dz === 'number' ? raw.dz : base.deadzone,
      sensitivity: typeof raw.s === 'number' ? raw.s : base.sensitivity,
      maxTilt: typeof raw.mt === 'number' ? raw.mt : base.maxTilt,
      orientationMode: raw.om === 'd' || raw.orientationMode === 'face-down' ? 'face-down' : 'face-up',
      steeringMode: raw.sm === 't' || raw.steeringMode === 'tilt' ? 'tilt' : 'yaw',
      yawMode: base.yawMode || 'relative',
    };
  } catch {
    return base;
  }
}
