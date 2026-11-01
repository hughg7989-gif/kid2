# Master Technical Specification: Motion-Controlled Procedural Kids Game (3D WebGL / WebRTC)

## 1. Project Overview & Target Audience
*   **Target Audience:** Toddlers / Young Children.
*   **Design Philosophy:** Zero frustation, infinite exploration, high tactile feedback, visual rewards, bright cartoon aesthetics.
*   **Core Mechanic:** The player uses a physical mobile smartphone (attached to a physical toy car, held by hand, or laid flat) as a motion controller via gyroscope/accelerometer to steer a 3D vehicle on a desktop display in real time.

---

## 2. System Architecture & Setup Flow

```
+--------------------------+                      +--------------------------+
|      Desktop Host        |                      |    Mobile Controller     |
|   (Browser / Display)    |                      |      (Web Browser)       |
|                          |                      |                          |
|  1. Display QR Code      | <--- WebRTC/P2P ---> |  1. Scan QR Code         |
|  2. Three.js Engine      |  (PeerJS DataConn)   |  2. Load Calibration UI  |
|  3. Procedural Map Gen   |                      |  3. Read Gyro/Accel Data |
|  4. Dynamic Script Engine|                      |  4. Save/Copy Presets    |
+--------------------------+                      +--------------------------+
```

### Phase 1: Connection Setup
1. **Host (Desktop):**
   * Generates a unique PeerJS / Socket session ID.
   * Displays a prominent QR code encoding the mobile controller URL: `https://<domain>/?session=<SESSION_ID>`.
2. **Controller (Mobile):**
   * Scans QR code with camera, opening the mobile controller web page.
   * Auto-connects via Data Channel (PeerJS/WebRTC).
   * Displays connection status indicator on both Desktop host and Mobile web screen.

### Phase 2: Calibration & Preset Manager (Mobile Controller View)
To allow setting up the phone on flat surfaces, face-up, face-down, or attached to a toy:

* **Calibration Features:**
  * **Set Zero / Center Button:** Sets current phone orientation to vector $(0,0,0)$ in world coordinates.
  * **Invert Controls:** Toggles for Invert Pitch, Invert Roll, and Invert Yaw.
  * **Deadzone Slider:** Adjustable threshold (default: $5^\circ$) to ignore slight surface unlevelness or micro-tremors.
  * **Sensitivity & Max Tilt Sliders:** Maps maximum desired phone rotation to maximum vehicle turning angle.
  * **Orientation Mode Toggle:** Face-Up vs. Face-Down placement options.
* **Preset Manager:**
  * **Save Preset:** Saves settings to `localStorage`.
  * **Copy Preset String:** Encodes calibration settings into a compact text string (e.g., `{"cz":0,"ir":false,"ip":true,"dz":5,"s":1.2}`).
  * **Load/Paste Preset:** Text input box to paste string for instant automated configuration.

---

## 3. Motion Controls, Physics & Vehicle Movement

### Input Data Transmission
Mobile controller emits motion events at 60Hz:
* `orientation`: `{ alpha, beta, gamma }` (Degrees)
* `acceleration`: `{ x, y, z }` (Raw accelerometer values for jump detection)

### Physics & Input Rules per Vehicle Type

#### A. Ground Vehicles (Cars, Excavators, Trucks)
1. **Constant Baseline Forward Speed (`baseSpeed`):**
   * The vehicle constantly moves forward at `baseSpeed` defined in the active vehicle `.js` file.
   * The child does not need to hold an acceleration button.
2. **Steering (Roll / Yaw):**
   * Tilting phone left/right turns the car left/right with 1:1 proportional response adjusted by sensitivity and deadzone settings.
3. **Speed Boost & Slowdown (Pitch):**
   * **Tilt Phone Forward:** Triggers a temporary speed boost ($1.5\times$ `baseSpeed`).
   * **Tilt Phone Backward:** Triggers temporary slowdown ($0.4\times$ `baseSpeed`).
   * **Return to Neutral Pitch:** Smoothly interpolates (LERP) back to `baseSpeed`.
4. **Side Flip & Ground Lock Logic:**
   * **Ground Plane Snapping:** Vehicle geometry aligns to ground slope. It **must never clip or penetrate through the ground mesh**.
   * **Flipping Condition:** If real phone roll/pitch exceeds critical angle threshold (e.g., $> 80^\circ$), the in-game vehicle flips over onto its side/top and **stops all forward movement**.
   * **Recovery:** When the real phone is returned right-side up, the in-game vehicle instantly rights itself and resumes forward motion.
5. **Jump Action (Vertical Acceleration):**
   * Detected when accelerometer $Z$-axis impulse exceeds `JUMP_THRESHOLD` (e.g., throwing phone upward in hand).
   * **Condition:** Jump force applied **only when vehicle is currently grounded** (`isGrounded === true`).
   * Disables jump trigger while airborne to prevent double-jumping into space.

#### B. Air Vehicles (Planes, Helicopters, Jets)
1. **Full 3D Orientation Mapping:**
   * Vehicle Pitch, Roll, and Yaw map continuously to the phone's 3D orientation.
2. **Altitude Control:**
   * Tilt Phone Up $\rightarrow$ Plane climbs.
   * Tilt Phone Down $\rightarrow$ Plane descends.
3. **Speed Controls:** Same boost/slowdown dynamics via forward/backward tilt.
4. **Collision with Airborne Objects:** Plane collides gently with sky elements (clouds, floating balloons) triggering temporary speed drops and visual particle explosions.

---

## 4. Procedural Infinite Terrain & Environment

### Terrain Engine Features
* **Infinite Procedural Generation:** Chunk-based grid system (e.g., 3x3 active chunks relative to vehicle position). Chunks are generated dynamically and unloaded when out of view.
* **Zero Hard Walls / Barriers:** No static solid walls or map boundaries exist. Toddlers can never get stuck against geometry.
* **Paths & Clearings:**
  * Clean paved roads generated through procedural noise.
  * Open passages cleared through forests for easy driving.
* **Camera System:**
  * Third-person smooth follow camera.
  * User can manually orbit/zoom the camera on desktop using mouse drag / scroll.

### Destructible Obstacles & Toddler-Friendly FX
* **World Objects:** Houses, fences, trees, roadside posts, floating clouds.
* **Collision Behavior:**
  * Objects **do not stop** the vehicle.
  * On impact, objects collapse, drop down into ground, or shatter outward instantly.
  * The vehicle experiences a slight, brief speed decrease (e.g., $15\%$ slowdown for $0.5$ seconds) but continues moving.
* **Visual & Audio FX:**
  * High-contrast, bright, vibrant cartoon colors.
  * Fireworks, confetti particle emitters, and starburst effects on object impact.
  * Cheerful, playful sound effects (sound synthesis or audio clips).

---

## 5. Modular Vehicle System & Dynamic Loader Architecture

All vehicles are self-contained JavaScript ES Modules loaded from the `/vehicles/` directory or injected dynamically via user input.

### File Structure (`/vehicles/default_car.js`)
```javascript
export default {
  id: "default_car",
  name: "Red Race Car",
  type: "ground", // Options: "ground" | "air"
  baseSpeed: 10,
  boostMultiplier: 1.5,
  slowMultiplier: 0.4,
  jumpForce: 12,
  dimensions: { length: 2.0, width: 1.2, height: 1.0 },
  
  // Custom sound triggers
  sounds: {
    horn: "beep_beep.mp3",
    enginePitch: 1.0
  },

  // 3D Visual Mesh Builder using Three.js primitives
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
```

---

## 6. Dynamic Vehicle Generator UI & AI Prompt Blueprint

### In-Game Interface Requirements
1. **"Generate Vehicle" Modal Button:**
   * Opens dynamic loader overlay.
2. **"Copy AI Prompt" Button:** Copies standardized instructions for LLM vehicle creation.
3. **Vehicle Code Loader:**
   * **Text Area:** Paste raw `.js` module string directly to instantiate vehicle in real time using Dynamic Blob URL Imports (`URL.createObjectURL(new Blob([code], {type: 'application/javascript'}))`).
   * **Drag & Drop Target:** Accept drop of local `.js` vehicle file to load directly into active game session.

---

### Embedded AI System Prompt
*(Standard prompt provided by the "Copy AI Prompt" button)*

```text
You are an expert Three.js 3D vehicle generator for a modular toddler driving game. 
Generate a complete, fully valid JavaScript ES Module file according to the specifications below.

RULES:
1. Return strictly valid JavaScript ES module code starting with `export default {`. Do not wrap code in markdown tags if saving directly.
2. Use baseline reference speed `baseSpeed: 10` for normal ground vehicles. Adjust proportionally for high-speed jets (e.g., 18) or heavy excavators (e.g., 6).
3. `type` must be either "ground" or "air".
4. Build the vehicle visual representation strictly inside the `geometry(THREE)` function using THREE primitives (BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, ExtrudeGeometry, etc.).
5. Apply bright, toddler-friendly, high-contrast colors and materials.
6. Return a unified `THREE.Group()` object containing all components.

USER REQUEST:
[INSERT USER TEXT DESCRIPTION HERE OR ATTACH IMAGE ANALYSIS DETAILS, e.g., "Yellow construction excavator with big tread wheels and bucket arm"]
```

---

## 7. Development Checklist & Implementation Roadmap

1. [ ] **Networking:** Setup WebRTC (PeerJS) signaling and test high-frequency orientation streaming.
2. [ ] **Mobile Web App:** Build responsive touch UI with live orientation visualizer, calibration math (center offsets, deadzones, axis inversions), and JSON preset import/export.
3. [ ] **3D Physics & Movement System:** Implement baseline constant auto-velocity, motion tilt mapping, flipping lock/unlock thresholds, and jump acceleration filters.
4. [ ] **Terrain & Procedural Engine:** Construct infinite ground chunk generation with noise maps, obstacle spawner, and non-blocking collision system.
5. [ ] **Dynamic Loader:** Implement Blob-based dynamic import for vehicle `.js` scripts via drag-and-drop or string paste.
6. [ ] **Visual Polish:** Add confetti/particle emitters, camera follow smoothing, screen shake on impact, and toddler-friendly audio effects.