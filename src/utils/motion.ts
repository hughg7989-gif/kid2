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
  deadzone: 5,         // degrees
  sensitivity: 1.2,    // multiplier
  maxTilt: 45,         // degrees for full lock
  orientationMode: 'face-up',
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
 */
export function processMotionData(
  payload: MotionDataPayload,
  cal: CalibrationSettings
): ProcessedInput {
  const { orientation, acceleration } = payload;

  // Raw offsets from calibrated zero
  let rawAlpha = normalizeAngleDeg(orientation.alpha - cal.centerAlpha);
  let rawBeta = normalizeAngleDeg(orientation.beta - cal.centerBeta);
  let rawGamma = normalizeAngleDeg(orientation.gamma - cal.centerGamma);

  // If face-down mode, flip beta & gamma signs
  if (cal.orientationMode === 'face-down') {
    rawBeta = -rawBeta;
    rawGamma = -rawGamma;
  }

  // Check flip condition (> FLIP_THRESHOLD_DEG on either pitch or roll)
  const isFlipped =
    Math.abs(normalizeAngleDeg(orientation.beta)) > FLIP_THRESHOLD_DEG ||
    Math.abs(normalizeAngleDeg(orientation.gamma)) > FLIP_THRESHOLD_DEG;

  // Invert axes if requested
  const signedPitch = cal.invertPitch ? -rawBeta : rawBeta;
  const signedRoll = cal.invertRoll ? -rawGamma : rawGamma;
  const signedYaw = cal.invertYaw ? -rawAlpha : rawAlpha;

  // Apply deadzone
  const effectiveRoll = applyDeadzone(signedRoll, cal.deadzone);
  const effectivePitch = applyDeadzone(signedPitch, cal.deadzone);

  // Calculate steer: normalize to [-1, 1] using maxTilt and sensitivity
  const availableTilt = Math.max(1, cal.maxTilt - cal.deadzone);
  const steerNorm = Math.min(1, Math.max(-1, (effectiveRoll / availableTilt) * cal.sensitivity));

  // Pitch norm: tilt forward (positive beta) -> boost, tilt backward -> slow
  const pitchNorm = Math.min(1, Math.max(-1, (effectivePitch / availableTilt) * cal.sensitivity));

  // Speed multiplier: neutral = 1.0, forward tilt (positive pitch) boosts to 1.5, backward slows to 0.4
  let speedMultiplier = 1.0;
  if (pitchNorm > 0) {
    speedMultiplier = 1.0 + pitchNorm * 0.5; // up to 1.5x
  } else if (pitchNorm < 0) {
    speedMultiplier = Math.max(0.4, 1.0 + pitchNorm * 0.6); // down to 0.4x
  }

  // Jump detection: check raw acceleration Z or total acceleration spike
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
    };
  } catch {
    return base;
  }
}
