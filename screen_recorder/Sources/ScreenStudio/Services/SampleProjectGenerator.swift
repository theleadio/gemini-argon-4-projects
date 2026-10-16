import Foundation
import AVFoundation
import CoreGraphics
import CoreVideo
import AppKit

public enum SampleProjectGenerator {

    /// Synthesizes a realistic 8-second 60fps macOS app recording with cursor telemetry, click events,
    /// auto-zoom segments, and a simulated webcam feed so the user can test all Studio Editor features immediately.
    public static func generateDemoProject() async throws -> RecordingProject {
        let duration: TimeInterval = 8.0
        let fps: Int = 30
        let totalFrames = Int(duration * Double(fps))
        let screenSize = CGSize(width: 1600, height: 1000)
        let webcamSize = CGSize(width: 480, height: 480)

        let demoFolder = FileManager.default.temporaryDirectory
            .appendingPathComponent("ScreenStudioRecordings", isDirectory: true)
            .appendingPathComponent("demo_\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: demoFolder, withIntermediateDirectories: true)

        let screenURL = demoFolder.appendingPathComponent("demo_screen.mov")
        let webcamURL = demoFolder.appendingPathComponent("demo_webcam.mov")

        // 1. Build realistic cursor path and 3 deliberate button clicks
        let clicks: [ClickEvent] = [
            ClickEvent(time: 1.35, releaseTime: 1.50, x: 0.22, y: 0.34, buttonNumber: 0),
            ClickEvent(time: 3.80, releaseTime: 3.96, x: 0.64, y: 0.48, buttonNumber: 0),
            ClickEvent(time: 6.10, releaseTime: 6.25, x: 0.78, y: 0.22, buttonNumber: 0)
        ]

        var samples: [CursorSample] = []
        let sampleRate = 120.0
        let sampleCount = Int(duration * sampleRate)

        let waypoints: [(t: Double, x: CGFloat, y: CGFloat)] = [
            (0.0, 0.50, 0.55),
            (0.7, 0.32, 0.42),
            (1.30, 0.22, 0.34), // Hover & click sidebar item
            (2.20, 0.24, 0.35),
            (3.45, 0.64, 0.48), // Move to primary card action button
            (3.75, 0.64, 0.48), // Click primary card button
            (4.70, 0.66, 0.50),
            (5.85, 0.78, 0.22), // Move to top-right "Publish" button
            (6.05, 0.78, 0.22), // Click "Publish"
            (7.10, 0.52, 0.46),
            (8.00, 0.50, 0.50)
        ]

        for i in 0...sampleCount {
            let t = Double(i) / sampleRate
            let pt = interpolateWaypoints(t: t, waypoints: waypoints)
            let isPressed = clicks.contains { t >= $0.time && t <= $0.releaseTime }
            samples.append(CursorSample(time: t, x: pt.x, y: pt.y, isPressed: isPressed))
        }

        let telemetry = CursorTelemetryTrack(
            samples: samples,
            clicks: clicks,
            capturedFrameSize: screenSize
        )

        // 2. Write synthetic screen video
        try await writeSyntheticVideo(
            to: screenURL,
            size: screenSize,
            fps: fps,
            totalFrames: totalFrames
        ) { ctx, frameIdx in
            let t = Double(frameIdx) / Double(fps)
            drawMockMacAppWindow(in: ctx, size: screenSize, time: t, clicks: clicks)
        }

        // 3. Write synthetic presenter webcam video
        try await writeSyntheticVideo(
            to: webcamURL,
            size: webcamSize,
            fps: fps,
            totalFrames: totalFrames
        ) { ctx, frameIdx in
            let t = Double(frameIdx) / Double(fps)
            drawMockWebcamAvatar(in: ctx, size: webcamSize, time: t)
        }

        let autoZooms = CameraAndCursorEngine.generateAutoZoomSegments(
            from: telemetry,
            duration: duration,
            defaultScale: 2.15
        )

        var webcamStyle = WebcamStyle()
        webcamStyle.isEnabled = true
        webcamStyle.shape = .squircle
        webcamStyle.position = .bottomRight

        return RecordingProject(
            title: "Product Walkthrough Demo",
            screenVideoURL: screenURL,
            webcamVideoURL: webcamURL,
            duration: duration,
            sourceSize: screenSize,
            zoomSegments: autoZooms,
            zoomSpringSpeed: .mellow,
            defaultAutoZoomScale: 2.15,
            telemetry: telemetry,
            webcamStyle: webcamStyle
        )
    }

    // MARK: - Waypoint Helper

    private static func interpolateWaypoints(
        t: Double,
        waypoints: [(t: Double, x: CGFloat, y: CGFloat)]
    ) -> CGPoint {
        guard let first = waypoints.first else { return CGPoint(x: 0.5, y: 0.5) }
        if t <= first.t { return CGPoint(x: first.x, y: first.y) }
        guard let last = waypoints.last else { return CGPoint(x: first.x, y: first.y) }
        if t >= last.t { return CGPoint(x: last.x, y: last.y) }

        for i in 0..<(waypoints.count - 1) {
            let w0 = waypoints[i]
            let w1 = waypoints[i + 1]
            if t >= w0.t && t <= w1.t {
                let span = max(0.001, w1.t - w0.t)
                let u = CGFloat((t - w0.t) / span)
                let eased = CameraAndCursorEngine.springEaseInOut(u)
                return CGPoint(
                    x: w0.x + (w1.x - w0.x) * eased,
                    y: w0.y + (w1.y - w0.y) * eased
                )
            }
        }
        return CGPoint(x: 0.5, y: 0.5)
    }

    // MARK: - Video Writer Helper

    private static func writeSyntheticVideo(
        to url: URL,
        size: CGSize,
        fps: Int,
        totalFrames: Int,
        drawFrame: @escaping (CGContext, Int) -> Void
    ) async throws {
        try? FileManager.default.removeItem(at: url)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let width = Int(size.width)
        let height = Int(size.height)

        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 10_000_000
            ]
        ]

        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = false

        let pixelBufferAttrs: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ]

        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: pixelBufferAttrs
        )

        writer.add(input)
        writer.startWriting()
        writer.startSession(atSourceTime: .zero)

        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()

        for frameIdx in 0..<totalFrames {
            while !input.isReadyForMoreMediaData {
                try await Task.sleep(nanoseconds: 2_000_000)
            }

            guard let pool = adaptor.pixelBufferPool else { continue }
            var pixelBufferOut: CVPixelBuffer?
            CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBufferOut)
            guard let pixelBuffer = pixelBufferOut else { continue }

            CVPixelBufferLockBaseAddress(pixelBuffer, [])
            if let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) {
                let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
                if let ctx = CGContext(
                    data: baseAddress,
                    width: width,
                    height: height,
                    bitsPerComponent: 8,
                    bytesPerRow: bytesPerRow,
                    space: colorSpace,
                    bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
                ) {
                    // Top-left coordinate system
                    ctx.translateBy(x: 0, y: CGFloat(height))
                    ctx.scaleBy(x: 1.0, y: -1.0)
                    drawFrame(ctx, frameIdx)
                }
            }
            CVPixelBufferUnlockBaseAddress(pixelBuffer, [])

            let pts = CMTime(value: CMTimeValue(frameIdx), timescale: CMTimeScale(fps))
            adaptor.append(pixelBuffer, withPresentationTime: pts)
        }

        input.markAsFinished()
        await writer.finishWriting()
    }

    // MARK: - Synthetic macOS Dashboard UI Renderer

    private static func drawMockMacAppWindow(
        in ctx: CGContext,
        size: CGSize,
        time: TimeInterval,
        clicks: [ClickEvent]
    ) {
        let w = size.width
        let h = size.height

        // Dark macOS window background
        ctx.setFillColor(CGColor(srgbRed: 0.09, green: 0.10, blue: 0.14, alpha: 1.0))
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))

        // Top Window Titlebar
        ctx.setFillColor(CGColor(srgbRed: 0.13, green: 0.14, blue: 0.19, alpha: 1.0))
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: 56))

        // macOS Traffic Light Buttons
        let trafficColors: [CGColor] = [
            CGColor(srgbRed: 1.0, green: 0.37, blue: 0.34, alpha: 1.0),
            CGColor(srgbRed: 1.0, green: 0.74, blue: 0.18, alpha: 1.0),
            CGColor(srgbRed: 0.16, green: 0.78, blue: 0.25, alpha: 1.0)
        ]
        for (i, col) in trafficColors.enumerated() {
            ctx.setFillColor(col)
            ctx.fillEllipse(in: CGRect(x: 24 + CGFloat(i) * 24, y: 20, width: 14, height: 14))
        }

        // Left Sidebar
        ctx.setFillColor(CGColor(srgbRed: 0.11, green: 0.12, blue: 0.17, alpha: 1.0))
        ctx.fill(CGRect(x: 0, y: 56, width: 320, height: h - 56))

        // Sidebar navigation rows (Click #1 happens at t=1.35 around (0.22, 0.34) -> x=352, y=340)
        let firstClicked = time >= 1.35
        for row in 0..<5 {
            let rowY = 110.0 + CGFloat(row) * 62.0
            let isTargetRow = (row == 3)
            let rowRect = CGRect(x: 24, y: rowY, width: 272, height: 48)
            let path = CGPath(roundedRect: rowRect, cornerWidth: 10, cornerHeight: 10, transform: nil)
            ctx.addPath(path)
            if isTargetRow && firstClicked {
                ctx.setFillColor(CGColor(srgbRed: 0.32, green: 0.46, blue: 0.96, alpha: 0.92))
            } else {
                ctx.setFillColor(CGColor(srgbRed: 0.16, green: 0.18, blue: 0.25, alpha: 0.85))
            }
            ctx.fillPath()

            // Pill label inside sidebar row
            ctx.setFillColor(CGColor(srgbRed: 0.88, green: 0.90, blue: 0.96, alpha: isTargetRow && firstClicked ? 0.95 : 0.55))
            ctx.fill(CGRect(x: 48, y: rowY + 18, width: 140, height: 12))
        }

        // Top-right "Publish Release" button (Click #3 at t=6.10 around (0.78, 0.22) -> x=1248, y=220)
        let thirdClicked = time >= 6.10
        let publishRect = CGRect(x: w * 0.70, y: 185, width: 240, height: 64)
        let publishPath = CGPath(roundedRect: publishRect, cornerWidth: 14, cornerHeight: 14, transform: nil)
        ctx.addPath(publishPath)
        if thirdClicked {
            ctx.setFillColor(CGColor(srgbRed: 0.16, green: 0.78, blue: 0.52, alpha: 1.0))
        } else {
            ctx.setFillColor(CGColor(srgbRed: 0.38, green: 0.42, blue: 0.95, alpha: 1.0))
        }
        ctx.fillPath()

        // Button text bar
        ctx.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.92))
        ctx.fill(CGRect(x: publishRect.minX + 48, y: publishRect.minY + 25, width: 144, height: 14))

        // Main Hero Analytics Card in Center
        let cardRect = CGRect(x: 368, y: 280, width: w - 420, height: 390)
        let cardPath = CGPath(roundedRect: cardRect, cornerWidth: 20, cornerHeight: 20, transform: nil)
        ctx.addPath(cardPath)
        ctx.setFillColor(CGColor(srgbRed: 0.14, green: 0.16, blue: 0.22, alpha: 1.0))
        ctx.fillPath()

        // Interactive Action Button inside Hero Card (Click #2 at t=3.80 around (0.64, 0.48) -> x=1024, y=480)
        let secondClicked = time >= 3.80
        let actionBtnRect = CGRect(x: w * 0.55, y: 445, width: 280, height: 70)
        let actionBtnPath = CGPath(roundedRect: actionBtnRect, cornerWidth: 16, cornerHeight: 16, transform: nil)
        ctx.addPath(actionBtnPath)
        if secondClicked {
            ctx.setFillColor(CGColor(srgbRed: 0.88, green: 0.34, blue: 0.58, alpha: 1.0))
        } else {
            ctx.setFillColor(CGColor(srgbRed: 0.24, green: 0.28, blue: 0.38, alpha: 1.0))
        }
        ctx.fillPath()

        ctx.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.9))
        ctx.fill(CGRect(x: actionBtnRect.minX + 54, y: actionBtnRect.minY + 28, width: 172, height: 14))

        // Animated telemetry bars inside card
        for bar in 0..<12 {
            let bx = 410.0 + CGFloat(bar) * 44.0
            let wave = sin(time * 3.2 + Double(bar) * 0.55) * 0.5 + 0.5
            let bh = 50.0 + CGFloat(wave) * (secondClicked ? 160.0 : 95.0)
            let by = 620.0 - bh
            let barRect = CGRect(x: bx, y: by, width: 26, height: bh)
            let bPath = CGPath(roundedRect: barRect, cornerWidth: 6, cornerHeight: 6, transform: nil)
            ctx.addPath(bPath)
            ctx.setFillColor(
                CGColor(
                    srgbRed: secondClicked ? 0.38 : 0.28,
                    green: secondClicked ? 0.78 : 0.56,
                    blue: 0.98,
                    alpha: 0.9
                )
            )
            ctx.fillPath()
        }
    }

    private static func drawMockWebcamAvatar(
        in ctx: CGContext,
        size: CGSize,
        time: TimeInterval
    ) {
        let w = size.width
        let h = size.height

        // Warm studio background in presenter room
        ctx.setFillColor(CGColor(srgbRed: 0.16, green: 0.19, blue: 0.28, alpha: 1.0))
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))

        // Subtle head bobbing animation
        let bobY = CGFloat(sin(time * 2.4)) * 6.0
        let tiltX = CGFloat(cos(time * 1.7)) * 5.0

        // Shoulders / torso
        ctx.setFillColor(CGColor(srgbRed: 0.28, green: 0.45, blue: 0.85, alpha: 1.0))
        ctx.fillEllipse(in: CGRect(x: w * 0.18 + tiltX * 0.4, y: h * 0.62 + bobY * 0.5, width: w * 0.64, height: h * 0.55))

        // Head circle
        ctx.setFillColor(CGColor(srgbRed: 0.95, green: 0.78, blue: 0.66, alpha: 1.0))
        ctx.fillEllipse(in: CGRect(x: w * 0.32 + tiltX, y: h * 0.24 + bobY, width: w * 0.36, height: h * 0.38))

        // Eyes
        ctx.setFillColor(CGColor(srgbRed: 0.12, green: 0.14, blue: 0.18, alpha: 1.0))
        ctx.fillEllipse(in: CGRect(x: w * 0.41 + tiltX, y: h * 0.39 + bobY, width: 14, height: 14))
        ctx.fillEllipse(in: CGRect(x: w * 0.55 + tiltX, y: h * 0.39 + bobY, width: 14, height: 14))

        // Smile arc
        ctx.setStrokeColor(CGColor(srgbRed: 0.75, green: 0.38, blue: 0.36, alpha: 1.0))
        ctx.setLineWidth(5.0)
        ctx.addArc(
            center: CGPoint(x: w * 0.50 + tiltX, y: h * 0.46 + bobY),
            radius: 22,
            startAngle: 0.15 * .pi,
            endAngle: 0.85 * .pi,
            clockwise: false
        )
        ctx.strokePath()
    }
}
