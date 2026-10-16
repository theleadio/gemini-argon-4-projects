import Foundation
import CoreGraphics
import CoreImage
import AppKit

public enum FrameCompositor {

    /// Renders a single composited Screen Studio frame into a `CGImage` at `canvasSize`.
    /// Uses a top-left coordinate system for all layout, camera zoom, cursor telemetry, and webcam PiP.
    public static func renderCompositeFrame(
        screenImage: CGImage?,
        webcamImage: CGImage?,
        at time: TimeInterval,
        canvasSize: CGSize,
        sourceScreenSize: CGSize,
        canvasStyle: CanvasStyle,
        cursorStyle: CursorStyle,
        webcamStyle: WebcamStyle,
        zoomSegments: [ZoomSegment],
        zoomSpringSpeed: ZoomSpringSpeed,
        telemetry: CursorTelemetryTrack
    ) -> CGImage? {
        let width = max(2, Int(canvasSize.width))
        let height = max(2, Int(canvasSize.height))
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()

        guard let ctx = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) else {
            return nil
        }

        ctx.interpolationQuality = .high
        ctx.setShouldAntialias(true)
        ctx.setAllowsAntialiasing(true)

        // Flip context so (0,0) is top-left, matching normalized telemetry and SwiftUI
        ctx.translateBy(x: 0, y: CGFloat(height))
        ctx.scaleBy(x: 1.0, y: -1.0)

        let canvasRect = CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height))
        let scaleFactor = CGFloat(height) / 1080.0

        // 1. Draw Styled Gradient Wallpaper Background
        drawBackground(in: ctx, rect: canvasRect, style: canvasStyle)

        // 2. Compute Padded Screen Frame Rect preserving source aspect ratio
        let screenRect = computeScreenFrameRect(
            canvasRect: canvasRect,
            sourceSize: sourceScreenSize,
            padding: canvasStyle.padding * scaleFactor
        )

        // 3. Evaluate Camera Zoom & Cursor State at timestamp
        let cameraState = CameraAndCursorEngine.evaluateCamera(
            at: time,
            zoomSegments: zoomSegments,
            springSpeed: zoomSpringSpeed,
            telemetry: telemetry
        )
        let cursorState = CameraAndCursorEngine.evaluateCursor(
            at: time,
            telemetry: telemetry,
            style: cursorStyle
        )

        let cornerRadius = canvasStyle.cornerRadius * scaleFactor
        let screenPath = CGPath(
            roundedRect: screenRect,
            cornerWidth: cornerRadius,
            cornerHeight: cornerRadius,
            transform: nil
        )

        // 4. Draw Diffused Drop Shadow behind Screen Frame
        if canvasStyle.shadowOpacity > 0.01 && canvasStyle.shadowRadius > 0.5 {
            ctx.saveGState()
            let shadowOffset = CGSize(width: 0, height: -14.0 * scaleFactor) // negative Y in flipped context = downward shadow
            let shadowColor = CGColor(
                srgbRed: 0,
                green: 0,
                blue: 0,
                alpha: CGFloat(canvasStyle.shadowOpacity)
            )
            ctx.setShadow(
                offset: shadowOffset,
                blur: canvasStyle.shadowRadius * scaleFactor,
                color: shadowColor
            )
            ctx.setFillColor(CGColor(srgbRed: 0.06, green: 0.06, blue: 0.09, alpha: 1.0))
            ctx.addPath(screenPath)
            ctx.fillPath()
            ctx.restoreGState()
        }

        // 5. Clip to Rounded Screen Frame & Draw Zoomed Screen Content + Cursor + Click Ripples
        ctx.saveGState()
        ctx.addPath(screenPath)
        ctx.clip()

        // Fill base dark backing
        ctx.setFillColor(CGColor(srgbRed: 0.07, green: 0.08, blue: 0.11, alpha: 1.0))
        ctx.fill(screenRect)

        // Compute transform mapping full normalized screen (0...1, 0...1) into zoomed screenRect
        let vis = cameraState.visibleNormalizedRect
        let zoomedFullWidth = screenRect.width / max(0.05, vis.width)
        let zoomedFullHeight = screenRect.height / max(0.05, vis.height)
        let zoomedOriginX = screenRect.minX - vis.minX * zoomedFullWidth
        let zoomedOriginY = screenRect.minY - vis.minY * zoomedFullHeight
        let transformedScreenRect = CGRect(
            x: zoomedOriginX,
            y: zoomedOriginY,
            width: zoomedFullWidth,
            height: zoomedFullHeight
        )

        if let screenImage = screenImage {
            drawCGImageTopLeft(screenImage, in: transformedScreenRect, ctx: ctx)
        }

        // 6. Draw Click Ripples inside the zoomed screen space
        if cursorStyle.showClickRipple {
            for ripple in cursorState.ripples {
                let rx = transformedScreenRect.minX + ripple.position.x * transformedScreenRect.width
                let ry = transformedScreenRect.minY + ripple.position.y * transformedScreenRect.height
                let maxRadius = 46.0 * scaleFactor * CGFloat(sqrt(cameraState.zoomScale))
                let minRadius = 8.0 * scaleFactor
                let currentRadius = minRadius + (maxRadius - minRadius) * ripple.progress

                ctx.saveGState()
                let baseColor = cursorStyle.rippleColor
                let strokeAlpha = CGFloat(baseColor.alpha) * ripple.alpha
                let fillAlpha = strokeAlpha * 0.24

                let rippleRect = CGRect(
                    x: rx - currentRadius,
                    y: ry - currentRadius,
                    width: currentRadius * 2.0,
                    height: currentRadius * 2.0
                )

                ctx.setFillColor(
                    CGColor(
                        srgbRed: CGFloat(baseColor.red),
                        green: CGFloat(baseColor.green),
                        blue: CGFloat(baseColor.blue),
                        alpha: fillAlpha
                    )
                )
                ctx.fillEllipse(in: rippleRect)

                ctx.setStrokeColor(
                    CGColor(
                        srgbRed: CGFloat(baseColor.red),
                        green: CGFloat(baseColor.green),
                        blue: CGFloat(baseColor.blue),
                        alpha: strokeAlpha
                    )
                )
                ctx.setLineWidth(max(1.5, 3.2 * scaleFactor * (1.0 - ripple.progress * 0.5)))
                ctx.strokeEllipse(in: rippleRect)
                ctx.restoreGState()
            }
        }

        // 7. Draw Custom Vector Cursor with Directional Motion Blur & Click Bounce
        if cursorStyle.showCustomCursor {
            let cursorCanvasPoint = CGPoint(
                x: transformedScreenRect.minX + cursorState.position.x * transformedScreenRect.width,
                y: transformedScreenRect.minY + cursorState.position.y * transformedScreenRect.height
            )

            // Scale cursor slightly with camera zoom so it feels natural
            let zoomCursorFactor = pow(cameraState.zoomScale, 0.45)
            let effectiveCursorScale = cursorStyle.cursorScale * zoomCursorFactor * cursorState.clickBounceScale * scaleFactor

            // Directional Motion Blur Trail when moving quickly
            let speed = hypot(cursorState.velocity.dx, cursorState.velocity.dy)
            if cursorStyle.motionBlurStrength > 0.05 && speed > 0.18 {
                let trailSamples = 5
                let blurStrength = CGFloat(cursorStyle.motionBlurStrength)
                for i in (1...trailSamples).reversed() {
                    let fraction = CGFloat(i) / CGFloat(trailSamples)
                    // Offset backward along velocity vector
                    let lagTime: CGFloat = 0.026 * blurStrength * fraction
                    let ghostNormX = cursorState.position.x - cursorState.velocity.dx * lagTime
                    let ghostNormY = cursorState.position.y - cursorState.velocity.dy * lagTime
                    let ghostPt = CGPoint(
                        x: transformedScreenRect.minX + ghostNormX * transformedScreenRect.width,
                        y: transformedScreenRect.minY + ghostNormY * transformedScreenRect.height
                    )
                    let ghostAlpha = cursorState.opacity * (1.0 - fraction * 0.78) * 0.28 * blurStrength
                    drawVectorCursor(
                        in: ctx,
                        at: ghostPt,
                        shape: cursorStyle.cursorShape,
                        scale: effectiveCursorScale * (1.0 - fraction * 0.06),
                        opacity: ghostAlpha,
                        withShadow: false
                    )
                }
            }

            // Primary sharp vector cursor
            drawVectorCursor(
                in: ctx,
                at: cursorCanvasPoint,
                shape: cursorStyle.cursorShape,
                scale: effectiveCursorScale,
                opacity: cursorState.opacity,
                withShadow: true
            )
        }

        ctx.restoreGState() // End screen frame clip

        // 8. Draw Subtle Glass Rim Border around Screen Frame
        if canvasStyle.insetBorderOpacity > 0.01 {
            ctx.saveGState()
            let insetRect = screenRect.insetBy(dx: 0.75 * scaleFactor, dy: 0.75 * scaleFactor)
            let borderPath = CGPath(
                roundedRect: insetRect,
                cornerWidth: max(0, cornerRadius - 0.75 * scaleFactor),
                cornerHeight: max(0, cornerRadius - 0.75 * scaleFactor),
                transform: nil
            )
            ctx.addPath(borderPath)
            ctx.setStrokeColor(
                CGColor(
                    srgbRed: 1.0,
                    green: 1.0,
                    blue: 1.0,
                    alpha: CGFloat(canvasStyle.insetBorderOpacity)
                )
            )
            ctx.setLineWidth(1.5 * scaleFactor)
            ctx.strokePath()
            ctx.restoreGState()
        }

        // 9. Draw Webcam Picture-in-Picture Overlay if enabled and available
        if webcamStyle.isEnabled, let webcamImage = webcamImage {
            drawWebcamOverlay(
                in: ctx,
                webcamImage: webcamImage,
                canvasRect: canvasRect,
                cameraZoomScale: cameraState.zoomScale,
                style: webcamStyle,
                scaleFactor: scaleFactor
            )
        }

        return ctx.makeImage()
    }

    // MARK: - Layout Computation

    public static func computeScreenFrameRect(
        canvasRect: CGRect,
        sourceSize: CGSize,
        padding: CGFloat
    ) -> CGRect {
        let availableW = max(64, canvasRect.width - padding * 2.0)
        let availableH = max(64, canvasRect.height - padding * 2.0)
        let sourceAspect = sourceSize.height > 0 ? (sourceSize.width / sourceSize.height) : (16.0 / 9.0)
        let availableAspect = availableW / availableH

        let fittedW: CGFloat
        let fittedH: CGFloat
        if sourceAspect > availableAspect {
            fittedW = availableW
            fittedH = availableW / sourceAspect
        } else {
            fittedH = availableH
            fittedW = availableH * sourceAspect
        }

        let originX = canvasRect.minX + (canvasRect.width - fittedW) * 0.5
        let originY = canvasRect.minY + (canvasRect.height - fittedH) * 0.5
        return CGRect(x: originX, y: originY, width: fittedW, height: fittedH)
    }

    // MARK: - Background Drawing

    private static func drawBackground(
        in ctx: CGContext,
        rect: CGRect,
        style: CanvasStyle
    ) {
        let colors = style.activeGradientColors.map { $0.cgColor }
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()

        if colors.count >= 2,
           let gradient = CGGradient(
               colorsSpace: colorSpace,
               colors: colors as CFArray,
               locations: nil
           ) {
            ctx.saveGState()
            ctx.drawLinearGradient(
                gradient,
                start: CGPoint(x: rect.minX, y: rect.minY),
                end: CGPoint(x: rect.maxX, y: rect.maxY),
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )

            // Add a soft radial ambient highlight in top-right / center-left for Screen Studio depth
            if colors.count >= 3,
               let accentGradient = CGGradient(
                   colorsSpace: colorSpace,
                   colors: [
                       colors[1].copy(alpha: 0.42) ?? colors[1],
                       CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 0)
                   ] as CFArray,
                   locations: [0.0, 1.0]
               ) {
                let glowCenter = CGPoint(x: rect.width * 0.75, y: rect.height * 0.25)
                ctx.drawRadialGradient(
                    accentGradient,
                    startCenter: glowCenter,
                    startRadius: 0,
                    endCenter: glowCenter,
                    endRadius: max(rect.width, rect.height) * 0.65,
                    options: []
                )
            }
            ctx.restoreGState()
        } else {
            ctx.setFillColor(colors.first ?? CGColor(srgbRed: 0.1, green: 0.1, blue: 0.15, alpha: 1.0))
            ctx.fill(rect)
        }
    }

    // MARK: - Custom Vector Cursor Renderer

    private static func drawVectorCursor(
        in ctx: CGContext,
        at point: CGPoint,
        shape: CursorShapeStyle,
        scale: CGFloat,
        opacity: CGFloat,
        withShadow: Bool
    ) {
        ctx.saveGState()
        ctx.setAlpha(opacity)
        ctx.translateBy(x: point.x, y: point.y)
        ctx.scaleBy(x: scale, y: scale)

        if withShadow {
            ctx.setShadow(
                offset: CGSize(width: 1.0, height: -3.0),
                blur: 6.0,
                color: CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 0.50 * opacity)
            )
        }

        switch shape {
        case .macOSPointer:
            // Classic crisp macOS arrow cursor path (tip at 0,0 in top-left space)
            let path = CGMutablePath()
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 0, y: 19.5))
            path.addLine(to: CGPoint(x: 4.5, y: 15.2))
            path.addLine(to: CGPoint(x: 7.9, y: 22.8))
            path.addLine(to: CGPoint(x: 10.7, y: 21.5))
            path.addLine(to: CGPoint(x: 7.3, y: 13.8))
            path.addLine(to: CGPoint(x: 13.5, y: 13.8))
            path.closeSubpath()

            // White outer border + black interior just like macOS cursor
            ctx.addPath(path)
            ctx.setFillColor(CGColor(srgbRed: 0.06, green: 0.06, blue: 0.08, alpha: 1.0))
            ctx.fillPath()

            ctx.addPath(path)
            ctx.setStrokeColor(CGColor(srgbRed: 1.0, green: 1.0, blue: 1.0, alpha: 0.98))
            ctx.setLineJoin(.round)
            ctx.setLineWidth(1.8)
            ctx.strokePath()

        case .sleekPointer:
            // Modern rounded Screen Studio pointer arrow
            let path = CGMutablePath()
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 1.2, y: 18.5))
            path.addLine(to: CGPoint(x: 6.4, y: 14.0))
            path.addLine(to: CGPoint(x: 14.8, y: 13.0))
            path.closeSubpath()

            ctx.addPath(path)
            ctx.setFillColor(CGColor(srgbRed: 0.10, green: 0.12, blue: 0.18, alpha: 0.96))
            ctx.fillPath()

            ctx.addPath(path)
            ctx.setStrokeColor(CGColor(srgbRed: 1.0, green: 1.0, blue: 1.0, alpha: 0.98))
            ctx.setLineJoin(.round)
            ctx.setLineWidth(2.1)
            ctx.strokePath()

        case .circleRing:
            let radius: CGFloat = 11.0
            let circleRect = CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2)
            ctx.setFillColor(CGColor(srgbRed: 1.0, green: 1.0, blue: 1.0, alpha: 0.25))
            ctx.fillEllipse(in: circleRect)
            ctx.setStrokeColor(CGColor(srgbRed: 1.0, green: 1.0, blue: 1.0, alpha: 0.95))
            ctx.setLineWidth(2.2)
            ctx.strokeEllipse(in: circleRect)

        case .minimalDot:
            let radius: CGFloat = 7.5
            let dotRect = CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2)
            ctx.setFillColor(CGColor(srgbRed: 0.98, green: 0.98, blue: 1.0, alpha: 0.95))
            ctx.fillEllipse(in: dotRect)
            ctx.setStrokeColor(CGColor(srgbRed: 0.12, green: 0.14, blue: 0.20, alpha: 0.9))
            ctx.setLineWidth(1.6)
            ctx.strokeEllipse(in: dotRect)
        }

        ctx.restoreGState()
    }

    // MARK: - Webcam PiP Overlay Renderer

    private static func drawWebcamOverlay(
        in ctx: CGContext,
        webcamImage: CGImage,
        canvasRect: CGRect,
        cameraZoomScale: CGFloat,
        style: WebcamStyle,
        scaleFactor: CGFloat
    ) {
        let baseMinDim = min(canvasRect.width, canvasRect.height)
        // Optionally shrink webcam slightly when screen is zoomed in so it doesn't cover focused UI
        let zoomDuckMultiplier: CGFloat
        if style.shrinkDuringZoom && cameraZoomScale > 1.05 {
            let zoomProgress = min(1.0, (cameraZoomScale - 1.0) / 1.5)
            zoomDuckMultiplier = 1.0 - 0.24 * zoomProgress
        } else {
            zoomDuckMultiplier = 1.0
        }

        let baseSize = baseMinDim * style.relativeSize * zoomDuckMultiplier
        let pipWidth: CGFloat
        let pipHeight: CGFloat
        switch style.shape {
        case .circle, .squircle:
            pipWidth = baseSize
            pipHeight = baseSize
        case .roundedRectangle:
            pipWidth = baseSize * 1.32
            pipHeight = baseSize * 0.96
        }

        let margin = style.margin * scaleFactor
        let originX: CGFloat
        let originY: CGFloat
        switch style.position {
        case .bottomRight:
            originX = canvasRect.maxX - pipWidth - margin
            originY = canvasRect.maxY - pipHeight - margin
        case .bottomLeft:
            originX = canvasRect.minX + margin
            originY = canvasRect.maxY - pipHeight - margin
        case .topRight:
            originX = canvasRect.maxX - pipWidth - margin
            originY = canvasRect.minY + margin
        case .topLeft:
            originX = canvasRect.minX + margin
            originY = canvasRect.minY + margin
        }

        let pipRect = CGRect(x: originX, y: originY, width: pipWidth, height: pipHeight)
        let cornerRad: CGFloat
        switch style.shape {
        case .circle:
            cornerRad = min(pipWidth, pipHeight) * 0.5
        case .squircle:
            cornerRad = min(pipWidth, pipHeight) * 0.28
        case .roundedRectangle:
            cornerRad = style.cornerRadius * scaleFactor
        }

        let maskPath = CGPath(
            roundedRect: pipRect,
            cornerWidth: cornerRad,
            cornerHeight: cornerRad,
            transform: nil
        )

        // Drop shadow for webcam PiP
        if style.shadowOpacity > 0.01 {
            ctx.saveGState()
            ctx.setShadow(
                offset: CGSize(width: 0, height: -8.0 * scaleFactor),
                blur: 22.0 * scaleFactor,
                color: CGColor(srgbRed: 0, green: 0, blue: 0, alpha: CGFloat(style.shadowOpacity))
            )
            ctx.setFillColor(CGColor(srgbRed: 0.08, green: 0.08, blue: 0.1, alpha: 1.0))
            ctx.addPath(maskPath)
            ctx.fillPath()
            ctx.restoreGState()
        }

        // Clip and draw center-cropped webcam image
        ctx.saveGState()
        ctx.addPath(maskPath)
        ctx.clip()

        let imgW = CGFloat(webcamImage.width)
        let imgH = CGFloat(webcamImage.height)
        let targetAspect = pipRect.width / max(1, pipRect.height)
        let imgAspect = imgW / max(1, imgH)

        var drawRect = pipRect
        if imgAspect > targetAspect {
            let scaledW = pipRect.height * imgAspect
            drawRect.origin.x -= (scaledW - pipRect.width) * 0.5
            drawRect.size.width = scaledW
        } else {
            let scaledH = pipRect.width / imgAspect
            drawRect.origin.y -= (scaledH - pipRect.height) * 0.5
            drawRect.size.height = scaledH
        }

        drawCGImageTopLeft(
            webcamImage,
            in: drawRect,
            ctx: ctx,
            mirrorHorizontally: style.mirrorHorizontally
        )
        ctx.restoreGState()

        // Border stroke
        if style.borderWidth > 0.2 {
            ctx.saveGState()
            ctx.addPath(maskPath)
            ctx.setStrokeColor(style.borderColor.cgColor)
            ctx.setLineWidth(style.borderWidth * scaleFactor)
            ctx.strokePath()
            ctx.restoreGState()
        }
    }

    // MARK: - Top-Left CGImage Helper

    private static func drawCGImageTopLeft(
        _ image: CGImage,
        in rect: CGRect,
        ctx: CGContext,
        mirrorHorizontally: Bool = false
    ) {
        ctx.saveGState()
        ctx.translateBy(x: rect.midX, y: rect.midY)
        ctx.scaleBy(x: mirrorHorizontally ? -1.0 : 1.0, y: -1.0)
        let localRect = CGRect(
            x: -rect.width * 0.5,
            y: -rect.height * 0.5,
            width: rect.width,
            height: rect.height
        )
        ctx.draw(image, in: localRect)
        ctx.restoreGState()
    }
}
