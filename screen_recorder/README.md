# ScreenStudio for macOS

A native macOS screen recorder and cinematic post-production studio inspired by **Screen Studio**, built with **Swift**, **SwiftUI**, **ScreenCaptureKit**, **AVFoundation**, and **CoreGraphics**.

## Key Features

1. **60 FPS Screen & Window Capture (`ScreenCaptureKit`)**
   - Record any full Retina display or individual application window at up to 60 FPS.
   - Simultaneous capture of **System Audio**, **Microphone narration** (with live RMS level metering), and **FaceTime / External Webcam** video.
   - Optionally hides the system cursor during capture so a crisp, scalable vector cursor can be composited non-destructively in post-production.

2. **120 Hz Cursor Telemetry & Smooth Auto-Zoom on Clicks**
   - Tracks mouse coordinates and button clicks at 120 Hz (`CursorTracker`).
   - Automatically clusters clicks and generates smooth **Zoom Segments** (`ZoomSegment`) with configurable spring physics (**Slow**, **Mellow**, **Quick**, **Rapid**).
   - Supports **Follow Cursor** tracking (with camera deadzone/damping) or **Manual Focus Point** selection directly on the preview canvas.

3. **Styled Studio Canvas & Wallpaper Gradients**
   - 12 curated Screen Studio multi-stop gradients (*Sequoia Aura*, *Sonoma Horizon*, *Cosmic Purple*, *Sunset Glow*, *Ocean Breeze*, *Neon Cyber*, etc.) plus custom gradient color pickers.
   - Real-time sliders for **Background Padding**, **Rounded Corner Radius**, **Diffused Drop Shadow** (blur & opacity), **Glass Rim Highlight**, and **Aspect Ratio** (`Auto`, `16:9`, `16:10`, `4:3`, `1:1`, `9:16`).

4. **Custom Vector Cursor, Click Ripples & Motion Blur**
   - Choose between *macOS Arrow*, *Sleek Studio Arrow*, *Touch Ring*, or *Minimal Dot*.
   - Critically-damped spring cursor smoothing, customizable cursor magnification (`0.8x` – `3.2x`), expanding **Click Ripple** rings, elastic **Click Bounce** animation, and **Directional Motion Blur** trail.

5. **Non-Destructive Webcam Picture-in-Picture (PiP)**
   - Synchronized separate webcam track allows repositioning (`Bottom Right`, `Bottom Left`, `Top Right`, `Top Left`), reshaping (`Circle`, `Squircle`, `Landscape Card`), resizing, bordering, mirroring, and **Auto-Shrinking during screen zoom** after recording.

6. **Multi-Track Timeline Editor & MP4/MOV Export**
   - **Screen Clip Track** with filmstrip thumbnails and draggable orange start/end **Trim Handles**.
   - **Click Markers Track** showing every mouse click event.
   - **Interactive Zoom Track** with draggable and resizable purple zoom keyframe blocks.
   - **Hardware-Accelerated Export** (`1080p`, `1440p`, `4K` at `30` or `60` FPS in H.264 / HEVC `.mp4` or `.mov`).

---

## Building & Running

### Run the Packaged App Bundle
```bash
./build_app.sh
open ScreenStudio.app
```

### Run via Swift Package Manager
```bash
swift run ScreenStudio
```

> **Tip:** Click **"Load Interactive Demo Project"** in the recorder launchpad (or press `⌘⇧D`) to immediately test the timeline editor, auto-zoom keyframes, cursor physics, and MP4 export with a synthesized multi-click recording and webcam overlay.
