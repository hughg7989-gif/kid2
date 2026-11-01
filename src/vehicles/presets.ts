/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VehicleDefinition } from '../types/game';

export const RED_CAR_CODE = `export default {
  id: "default_car",
  name: "Red Race Car",
  type: "ground",
  baseSpeed: 10,
  boostMultiplier: 1.5,
  slowMultiplier: 0.4,
  jumpForce: 12,
  dimensions: { length: 2.0, width: 1.2, height: 1.0 },

  sounds: {
    horn: "beep_beep",
    enginePitch: 1.0
  },

  geometry: function(THREE) {
    const group = new THREE.Group();

    // Main Car Body
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.5, 2.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // vibrant cherry red
      roughness: 0.25,
      metalness: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    group.add(body);

    // Front Hood slope
    const hoodGeo = new THREE.BoxGeometry(1.1, 0.2, 0.8);
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(0, 0.7, 0.7);
    group.add(hood);

    // Cute Bubble Cabin / Windshield
    const cabinGeo = new THREE.BoxGeometry(0.95, 0.55, 1.1);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.95, -0.15);
    group.add(cabin);

    // Headlights
    const lightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.6 });
    lightGeo.rotateX(Math.PI / 2);

    const lightL = new THREE.Mesh(lightGeo, lightMat);
    lightL.position.set(-0.4, 0.55, 1.12);
    const lightR = new THREE.Mesh(lightGeo, lightMat);
    lightR.position.set(0.4, 0.55, 1.12);
    group.add(lightL, lightR);

    // Rear Spoiler
    const spoilerWing = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.08, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
    );
    spoilerWing.position.set(0, 1.15, -1.0);
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), bodyMat);
    postL.position.set(-0.4, 0.95, -1.0);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), bodyMat);
    postR.position.set(0.4, 0.95, -1.0);
    group.add(spoilerWing, postL, postR);

    // Wheels (4 chunky cartoon tires with silver hubs)
    const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 18);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
    const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.27, 12);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.2 });

    const wheelPositions = [
      [-0.65, 0.35, 0.75],
      [0.65, 0.35, 0.75],
      [-0.65, 0.35, -0.75],
      [0.65, 0.35, -0.75]
    ];

    wheelPositions.forEach(pos => {
      const wGroup = new THREE.Group();
      wGroup.add(new THREE.Mesh(tireGeo, tireMat));
      wGroup.add(new THREE.Mesh(hubGeo, hubMat));
      wGroup.position.set(pos[0], pos[1], pos[2]);
      group.add(wGroup);
    });

    return group;
  }
};`;

export const EXCAVATOR_CODE = `export default {
  id: "yellow_excavator",
  name: "Construction Digger",
  type: "ground",
  baseSpeed: 8,
  boostMultiplier: 1.4,
  slowMultiplier: 0.4,
  jumpForce: 10,
  dimensions: { length: 2.4, width: 1.4, height: 1.4 },

  geometry: function(THREE) {
    const group = new THREE.Group();
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 }); // vivid amber/yellow
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Chassis Base
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 2.0), darkMat);
    chassis.position.y = 0.4;
    group.add(chassis);

    // Tread Tracks (Left and Right)
    const treadGeo = new THREE.BoxGeometry(0.35, 0.45, 2.3);
    const treadL = new THREE.Mesh(treadGeo, darkMat);
    treadL.position.set(-0.7, 0.3, 0);
    const treadR = new THREE.Mesh(treadGeo, darkMat);
    treadR.position.set(0.7, 0.3, 0);
    group.add(treadL, treadR);

    // Operator Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.0), yellowMat);
    cabin.position.set(-0.2, 0.95, -0.2);
    group.add(cabin);

    // Glass Window
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.45, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.85 })
    );
    windowMesh.position.set(-0.2, 1.05, 0.32);
    group.add(windowMesh);

    // Hydraulic Boom Arm
    const boom1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.2), yellowMat);
    boom1.position.set(0.35, 1.0, 0.4);
    boom1.rotation.x = -0.4;
    group.add(boom1);

    const boom2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), darkMat);
    boom2.position.set(0.35, 1.4, 0.85);
    boom2.rotation.x = 0.6;
    group.add(boom2);

    // Big Digger Shovel Bucket
    const bucket = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.35, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2 })
    );
    bucket.position.set(0.35, 1.0, 1.25);
    bucket.rotation.x = 0.2;
    group.add(bucket);

    return group;
  }
};`;

export const BLUE_JET_CODE = `export default {
  id: "sky_jet",
  name: "Sky Cruiser Jet",
  type: "air",
  baseSpeed: 16,
  boostMultiplier: 1.6,
  slowMultiplier: 0.5,
  jumpForce: 15,
  dimensions: { length: 2.6, width: 2.8, height: 0.9 },

  geometry: function(THREE) {
    const group = new THREE.Group();
    const jetBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const accentRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2 });

    // Streamlined Fuselage
    const fuselageGeo = new THREE.CylinderGeometry(0.35, 0.45, 2.6, 16);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, jetBlue);
    fuselage.position.y = 0.5;
    group.add(fuselage);

    // Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.35, 0.7, 16);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, accentRed);
    nose.position.set(0, 0.5, 1.65);
    group.add(nose);

    // Jet Wings
    const wingGeo = new THREE.BoxGeometry(2.8, 0.08, 0.8);
    const wings = new THREE.Mesh(wingGeo, whiteMat);
    wings.position.set(0, 0.48, -0.1);
    group.add(wings);

    // Wingtip Red Accents
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.6), accentRed);
    tipL.position.set(-1.4, 0.52, -0.1);
    const tipR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.6), accentRed);
    tipR.position.set(1.4, 0.52, -0.1);
    group.add(tipL, tipR);

    // Vertical Tail Fin
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.6), jetBlue);
    tailFin.position.set(0, 0.9, -1.05);
    tailFin.rotation.x = -0.3;
    group.add(tailFin);

    // Cockpit Canopy
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.1, transparent: true, opacity: 0.85 })
    );
    glass.scale.set(0.8, 0.7, 1.4);
    glass.position.set(0, 0.75, 0.4);
    group.add(glass);

    // Front Spinning Propeller / Turbine Ring
    const spinner = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.08, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 })
    );
    spinner.position.set(0, 0.5, 2.02);
    group.add(spinner);

    return group;
  }
};`;

export const ICE_CREAM_TRUCK_CODE = `export default {
  id: "ice_cream_van",
  name: "Sweet Treat Van",
  type: "ground",
  baseSpeed: 9,
  boostMultiplier: 1.4,
  slowMultiplier: 0.4,
  jumpForce: 11,
  dimensions: { length: 2.2, width: 1.3, height: 1.6 },

  geometry: function(THREE) {
    const group = new THREE.Group();
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    // Van Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 2.2), whiteMat);
    body.position.y = 0.75;
    group.add(body);

    // Pink Lower Stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.25, 2.22), pinkMat);
    stripe.position.y = 0.5;
    group.add(stripe);

    // Serving Window
    const serviceWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.45, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    serviceWindow.position.set(0.6, 0.85, -0.1);
    group.add(serviceWindow);

    // Cute Ice Cream Cone on Top!
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 })
    );
    cone.position.set(0, 1.4, 0);
    cone.rotation.z = Math.PI;

    const scoop = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 })
    );
    scoop.position.set(0, 1.6, 0);
    group.add(cone, scoop);

    // Wheels
    const tireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xf472b6 });

    const wheelPositions = [
      [-0.64, 0.32, 0.7],
      [0.64, 0.32, 0.7],
      [-0.64, 0.32, -0.7],
      [0.64, 0.32, -0.7]
    ];

    wheelPositions.forEach(pos => {
      const wGroup = new THREE.Group();
      wGroup.add(new THREE.Mesh(tireGeo, tireMat));
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.24, 12), hubMat);
      hub.rotateZ(Math.PI / 2);
      wGroup.add(hub);
      wGroup.position.set(...pos);
      group.add(wGroup);
    });

    return group;
  }
};`;

export const HELICOPTER_CODE = `export default {
  id: "chopper_1",
  name: "Whirly Chopper",
  type: "air",
  baseSpeed: 14,
  boostMultiplier: 1.5,
  slowMultiplier: 0.4,
  jumpForce: 14,
  dimensions: { length: 2.5, width: 2.2, height: 1.3 },

  geometry: function(THREE) {
    const group = new THREE.Group();
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

    // Rounded Egg Cockpit
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16), greenMat);
    cockpit.scale.set(0.9, 0.9, 1.4);
    cockpit.position.set(0, 0.8, 0.2);
    group.add(cockpit);

    // Front Windshield
    const windshield = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.85 })
    );
    windshield.scale.set(0.85, 0.85, 1.1);
    windshield.position.set(0, 0.85, 0.6);
    group.add(windshield);

    // Tail Boom
    const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 1.4, 12), greenMat);
    tailBoom.rotateX(Math.PI / 2);
    tailBoom.position.set(0, 0.85, -1.05);
    group.add(tailBoom);

    // Tail Rotor
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.08), yellowMat);
    tailRotor.position.set(0.14, 0.95, -1.75);
    group.add(tailRotor);

    // Landing Skids
    const skidGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8);
    skidGeo.rotateX(Math.PI / 2);
    const skidL = new THREE.Mesh(skidGeo, darkMat);
    skidL.position.set(-0.45, 0.15, 0.1);
    const skidR = new THREE.Mesh(skidGeo, darkMat);
    skidR.position.set(0.45, 0.15, 0.1);
    group.add(skidL, skidR);

    // Rotor Mast & Main Blades
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 12), darkMat);
    mast.position.set(0, 1.45, 0.2);
    const blades = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.18), yellowMat);
    blades.position.set(0, 1.62, 0.2);
    group.add(mast, blades);

    return group;
  }
};`;

export const TODDLER_TRAIN_CODE = `export default {
  id: "toddler_train",
  name: "Toddler Train",
  type: "ground",
  baseSpeed: 9,
  boostMultiplier: 1.4,
  slowMultiplier: 0.4,
  jumpForce: 10,
  dimensions: { length: 3.2, width: 1.8, height: 2.8 },

  sounds: {
    horn: "choo_choo",
    enginePitch: 0.9
  },

  geometry: function(THREE) {
    const group = new THREE.Group();

    // Materials
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.3 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.3 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x007aff, roughness: 0.3 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5 });
    const greyMat = new THREE.MeshStandardMaterial({ color: 0x8e8e93, roughness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    // Engine Boiler (Main Body along Z-axis)
    const boilerGeo = new THREE.CylinderGeometry(0.8, 0.8, 2.5, 16);
    boilerGeo.rotateX(Math.PI / 2);
    const boiler = new THREE.Mesh(boilerGeo, redMat);
    boiler.position.set(0, 1.0, 0);
    group.add(boiler);

    // Engineer Cabin (at Rear -Z)
    const cabinGeo = new THREE.BoxGeometry(1.6, 1.8, 1.6);
    const cabin = new THREE.Mesh(cabinGeo, yellowMat);
    cabin.position.set(0, 1.4, -1.2);
    group.add(cabin);

    // Cabin Roof
    const roofGeo = new THREE.BoxGeometry(1.8, 0.3, 1.8);
    const roof = new THREE.Mesh(roofGeo, blueMat);
    roof.position.set(0, 2.4, -1.2);
    group.add(roof);

    // Smokestack (towards Front +Z)
    const stackGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.2, 12);
    const stack = new THREE.Mesh(stackGeo, blackMat);
    stack.position.set(0, 2.0, 1.0);
    group.add(stack);

    // Smoke Puff
    const smokeGeo = new THREE.SphereGeometry(0.4, 12, 12);
    const smoke = new THREE.Mesh(smokeGeo, whiteMat);
    smoke.position.set(0, 2.8, 1.0);
    group.add(smoke);

    // Cowcatcher (Front wedge at +Z)
    const catcherGeo = new THREE.ConeGeometry(0.9, 1.2, 4);
    catcherGeo.rotateX(-Math.PI / 2);
    const catcher = new THREE.Mesh(catcherGeo, greyMat);
    catcher.position.set(0, 0.7, 1.6);
    group.add(catcher);

    // Wheels (3 pairs along length, spaced at X = ±0.9)
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
      { z: 1.0, x: 0.9 },
      { z: 1.0, x: -0.9 },
      { z: -0.2, x: 0.9 },
      { z: -0.2, x: -0.9 },
      { z: -1.4, x: 0.9 },
      { z: -1.4, x: -0.9 }
    ];

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, blackMat);
      wheel.position.set(pos.x, 0.5, pos.z);
      group.add(wheel);

      // Yellow Hubcap
      const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.35, 12);
      hubGeo.rotateZ(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, yellowMat);
      hub.position.set(pos.x, 0.5, pos.z);
      group.add(hub);
    });

    return group;
  }
};`;

export const PRESET_VEHICLES = [
  { id: 'default_car', code: RED_CAR_CODE, label: 'Red Race Car' },
  { id: 'toddler_train', code: TODDLER_TRAIN_CODE, label: 'Toddler Train' },
  { id: 'yellow_excavator', code: EXCAVATOR_CODE, label: 'Construction Digger' },
  { id: 'sky_jet', code: BLUE_JET_CODE, label: 'Sky Cruiser Jet' },
  { id: 'ice_cream_van', code: ICE_CREAM_TRUCK_CODE, label: 'Sweet Treat Van' },
  { id: 'chopper_1', code: HELICOPTER_CODE, label: 'Whirly Chopper' },
];
