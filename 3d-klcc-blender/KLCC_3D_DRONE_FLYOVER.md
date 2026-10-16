# 3D Drone Flyover of KLCC (Kuala Lumpur City Centre) — 10-Second Blender Animation

## Overview
This project procedurally builds and renders a complete **10-second (240 frames @ 24 fps) 3D drone flyover of KLCC** in **Blender 5.2 LTS** (`BLENDER_EEVEE` with raytracing & bloom compositing), featuring:

1. **Petronas Twin Towers (Tower 1 & Tower 2)**
   - Authentic **8-pointed Rub el Hizb star + 8 semi-circular lobes** cross-section (`bmesh` procedural profile).
   - 5 setback tiers, 88 illuminated office floors, brushed stainless-steel horizontal sunshade rings, faceted crown lanterns, and 452m-proportion pinnacle spires with red aviation beacons.
   - **Double-Deck Skybridge** at Floors 41–42 (`Z = 76m–80m`) with its iconic diagonal V-arch support struts springing from Floor 29.

2. **KLCC Precinct & Surrounding Skyline**
   - **Suria KLCC** 6-story crescent shopping mall podium and illuminated glass Esplanade canopy.
   - **Menara Maxis**, **Menara ExxonMobil**, **Petronas Tower 3 (Menara Carigali)**, **Mandarin Oriental**, **Four Seasons Place**, plus background **Menara KL (KL Tower)** and **Merdeka 118** silhouettes.
   - **KLCC Park & Lake Symphony**: Reflective water basin, curved elevated pedestrian viewing bridge, 90+ tropical royal palm trees, and **36 animated musical fountain water jets** dancing in cyan, gold, and magenta.

3. **Real Multi-Lane Traffic System (55+ Animated Vehicles)**
   - **Jalan Ampang** (6-lane divided boulevard with palm median, crosswalks, lane markings, and traffic light gantries) & **Persiaran KLCC / Jalan P. Ramlee** intersection + Suria KLCC drop-off loop.
   - Sculpted 3D **Sedans, SUVs, KL Taxis, and RapidKL / GoKL City Buses** with rotating wheels, glowing warm-white LED headlights (with moving road light pools), and ruby-red LED taillights.
   - Continuous multi-lane traffic flow + vehicles turning smoothly through the signalized intersection across all 240 frames.

4. **Real Walking Pedestrians (95+ Articulated 3D People)**
   - Articulated 3D characters (Head, Torso, swinging Left/Right Arms, striding Left/Right Legs) with phase-offset walk-cycle animations.
   - Pedestrians actively walking across **Jalan Ampang zebra crosswalks**, **sidewalk promenades**, **Suria KLCC Esplanade**, and the **Lake Symphony curved pedestrian bridge**.

5. **10-Second Drone Flyover Camera & Hero Quadcopter Drone**
   - **240 frames at 24 FPS (10.0 seconds)** at **1920×1080 Full HD**.
   - **Frames 1–85 (0.0s–3.5s)**: Low-altitude sweeping pass over the bustling Jalan Ampang intersection, moving traffic lanes, and crosswalk pedestrians, tilting up toward Suria KLCC and the Twin Towers base.
   - **Frames 85–165 (3.5s–6.9s)**: Ascending banking curve over Lake Symphony's dancing fountains, the pedestrian bridge, and KLCC Park palms, revealing the Double-Deck Skybridge.
   - **Frames 165–240 (6.9s–10.0s)**: High-altitude heroic orbit revealing the full Petronas Twin Towers spires, glowing KL skyline, and rivers of traffic below.
   - Includes a physical **3D Quadcopter Cinema Drone** with spinning rotors and red/green navigation LEDs banking ahead of the camera path.

---

## Project Files
- `KLCC_3D_DRONE_FLYOVER.md` — Architecture, scene layout, animation breakdown, and usage guide.
- `generate_klcc_drone.py` — Self-contained Blender Python script that builds the entire 3D KLCC scene, materials, lighting, traffic, walking pedestrians, drone camera rig, and render settings.
- `klcc_drone_flyover.blend` — Generated Blender 5.2 scene file ready for interactive inspection or re-rendering.
- `klcc_drone_flyover_10s.mp4` — Rendered 10-second Full HD (1920×1080, 24 fps) MP4 animation.
- `renders/` — Keyframe still renders (`frame_0020.png`, `frame_0120.png`, `frame_0220.png`) for preview.

---

## How to Run / Re-Generate

### 1. Build the `.blend` file and render key preview frames:
```bash
blender -b -P generate_klcc_drone.py -- --preview
```

### 2. Render the full 10-second (240-frame) MP4 animation:
```bash
blender -b klcc_drone_flyover.blend -a
```
*(Or run `blender -b -P generate_klcc_drone.py -- --render-all` to build and render in one step.)*
