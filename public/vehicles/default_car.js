export default {
  id: "default_car",
  name: "Red Race Car",
  type: "ground",
  baseSpeed: 10,
  boostMultiplier: 1.5,
  slowMultiplier: 0.4,
  jumpForce: 12,
  dimensions: { length: 2.0, width: 1.2, height: 1.0 },

  sounds: {
    horn: "beep_beep.mp3",
    enginePitch: 1.0
  },

  geometry: function(THREE) {
    const group = new THREE.Group();

    // Main Body
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.6, 2.0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    group.add(body);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(0.9, 0.5, 1.0);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.8 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.95, -0.1);
    group.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    wheelGeo.rotateZ(Math.PI / 2);

    const positions = [
      [-0.65, 0.3, 0.7],
      [0.65, 0.3, 0.7],
      [-0.65, 0.3, -0.7],
      [0.65, 0.3, -0.7]
    ];

    positions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(...pos);
      group.add(wheel);
    });

    return group;
  }
};
