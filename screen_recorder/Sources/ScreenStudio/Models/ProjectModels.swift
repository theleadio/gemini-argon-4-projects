import Foundation
import SwiftUI
import AppKit
import CoreGraphics

// MARK: - Codable Color Helper

public struct CodableColor: Codable, Equatable, Hashable {
    public var red: Double
    public var green: Double
    public var blue: Double
    public var alpha: Double

    public init(red: Double, green: Double, blue: Double, alpha: Double = 1.0) {
        self.red = red
        self.green = green
        self.blue = blue
        self.alpha = alpha
    }

    public init(nsColor: NSColor) {
        let converted = nsColor.usingColorSpace(.sRGB) ?? nsColor
        self.red = Double(converted.redComponent)
        self.green = Double(converted.greenComponent)
        self.blue = Double(converted.blueComponent)
        self.alpha = Double(converted.alphaComponent)
    }

    public init(color: Color) {
        self.init(nsColor: NSColor(color))
    }

    public var color: Color {
        Color(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
    }

    public var nsColor: NSColor {
        NSColor(srgbRed: CGFloat(red), green: CGFloat(green), blue: CGFloat(blue), alpha: CGFloat(alpha))
    }

    public var cgColor: CGColor {
        CGColor(srgbRed: CGFloat(red), green: CGFloat(green), blue: CGFloat(blue), alpha: CGFloat(alpha))
    }
}

// MARK: - Background Presets

public enum BackgroundPreset: String, CaseIterable, Codable, Identifiable {
    case sequoiaAura = "Sequoia Aura"
    case sonomaHorizon = "Sonoma Horizon"
    case cosmicPurple = "Cosmic Purple"
    case sunsetGlow = "Sunset Glow"
    case oceanBreeze = "Ocean Breeze"
    case neonCyber = "Neon Cyber"
    case emeraldForest = "Emerald Mist"
    case peachSorbet = "Peach Sorbet"
    case midnightSlate = "Midnight Slate"
    case obsidianDark = "Obsidian Dark"
    case studioSilver = "Studio Silver"
    case customGradient = "Custom Gradient"

    public var id: String { rawValue }

    public var gradientColors: [CodableColor] {
        switch self {
        case .sequoiaAura:
            return [
                CodableColor(red: 0.14, green: 0.18, blue: 0.48),
                CodableColor(red: 0.42, green: 0.20, blue: 0.62),
                CodableColor(red: 0.85, green: 0.36, blue: 0.45)
            ]
        case .sonomaHorizon:
            return [
                CodableColor(red: 0.08, green: 0.32, blue: 0.52),
                CodableColor(red: 0.18, green: 0.58, blue: 0.68),
                CodableColor(red: 0.92, green: 0.62, blue: 0.38)
            ]
        case .cosmicPurple:
            return [
                CodableColor(red: 0.18, green: 0.08, blue: 0.36),
                CodableColor(red: 0.45, green: 0.16, blue: 0.68),
                CodableColor(red: 0.78, green: 0.25, blue: 0.75)
            ]
        case .sunsetGlow:
            return [
                CodableColor(red: 0.95, green: 0.32, blue: 0.38),
                CodableColor(red: 0.98, green: 0.55, blue: 0.24),
                CodableColor(red: 0.99, green: 0.78, blue: 0.32)
            ]
        case .oceanBreeze:
            return [
                CodableColor(red: 0.05, green: 0.22, blue: 0.48),
                CodableColor(red: 0.08, green: 0.52, blue: 0.78),
                CodableColor(red: 0.24, green: 0.85, blue: 0.82)
            ]
        case .neonCyber:
            return [
                CodableColor(red: 0.06, green: 0.07, blue: 0.18),
                CodableColor(red: 0.38, green: 0.10, blue: 0.55),
                CodableColor(red: 0.05, green: 0.78, blue: 0.92)
            ]
        case .emeraldForest:
            return [
                CodableColor(red: 0.05, green: 0.24, blue: 0.22),
                CodableColor(red: 0.12, green: 0.48, blue: 0.38),
                CodableColor(red: 0.36, green: 0.76, blue: 0.56)
            ]
        case .peachSorbet:
            return [
                CodableColor(red: 0.96, green: 0.48, blue: 0.58),
                CodableColor(red: 0.98, green: 0.68, blue: 0.52),
                CodableColor(red: 0.99, green: 0.86, blue: 0.72)
            ]
        case .midnightSlate:
            return [
                CodableColor(red: 0.09, green: 0.11, blue: 0.16),
                CodableColor(red: 0.16, green: 0.20, blue: 0.28),
                CodableColor(red: 0.22, green: 0.27, blue: 0.38)
            ]
        case .obsidianDark:
            return [
                CodableColor(red: 0.05, green: 0.05, blue: 0.07),
                CodableColor(red: 0.11, green: 0.11, blue: 0.15),
                CodableColor(red: 0.07, green: 0.07, blue: 0.09)
            ]
        case .studioSilver:
            return [
                CodableColor(red: 0.88, green: 0.90, blue: 0.94),
                CodableColor(red: 0.78, green: 0.82, blue: 0.88),
                CodableColor(red: 0.93, green: 0.94, blue: 0.97)
            ]
        case .customGradient:
            return [
                CodableColor(red: 0.25, green: 0.30, blue: 0.85),
                CodableColor(red: 0.70, green: 0.25, blue: 0.75)
            ]
        }
    }
}

// MARK: - Aspect Ratio Presets

public enum AspectRatioPreset: String, CaseIterable, Codable, Identifiable {
    case auto = "Auto (Source)"
    case widescreen16x9 = "16:9 Widescreen"
    case mac16x10 = "16:10 macOS"
    case classic4x3 = "4:3 Classic"
    case square1x1 = "1:1 Square"
    case vertical9x16 = "9:16 Vertical"

    public var id: String { rawValue }

    public var shortLabel: String {
        switch self {
        case .auto: return "Auto"
        case .widescreen16x9: return "16:9"
        case .mac16x10: return "16:10"
        case .classic4x3: return "4:3"
        case .square1x1: return "1:1"
        case .vertical9x16: return "9:16"
        }
    }

    public func targetAspectRatio(sourceSize: CGSize) -> CGFloat {
        switch self {
        case .auto:
            guard sourceSize.height > 0 else { return 16.0 / 9.0 }
            return sourceSize.width / sourceSize.height
        case .widescreen16x9:
            return 16.0 / 9.0
        case .mac16x10:
            return 16.0 / 10.0
        case .classic4x3:
            return 4.0 / 3.0
        case .square1x1:
            return 1.0
        case .vertical9x16:
            return 9.0 / 16.0
        }
    }
}

// MARK: - Zoom & Camera Models

public enum ZoomSpringSpeed: String, CaseIterable, Codable, Identifiable {
    case slow = "Slow"
    case mellow = "Mellow"
    case quick = "Quick"
    case rapid = "Rapid"

    public var id: String { rawValue }

    public var transitionDuration: TimeInterval {
        switch self {
        case .slow: return 0.75
        case .mellow: return 0.52
        case .quick: return 0.36
        case .rapid: return 0.22
        }
    }

    public var cursorFollowSmoothing: Double {
        switch self {
        case .slow: return 0.18
        case .mellow: return 0.12
        case .quick: return 0.08
        case .rapid: return 0.04
        }
    }
}

public enum ZoomTargetMode: String, CaseIterable, Codable, Identifiable {
    case followCursor = "Follow Cursor"
    case fixedPoint = "Manual Target"

    public var id: String { rawValue }
}

public struct ZoomSegment: Identifiable, Codable, Equatable {
    public var id: UUID
    public var startTime: TimeInterval
    public var endTime: TimeInterval
    public var zoomScale: CGFloat // e.g., 2.0x
    public var targetMode: ZoomTargetMode
    /// Normalized coordinates in (0...1, 0...1) where (0,0) is top-left of captured screen
    public var targetPoint: CGPoint
    public var isAutoGenerated: Bool

    public init(
        id: UUID = UUID(),
        startTime: TimeInterval,
        endTime: TimeInterval,
        zoomScale: CGFloat = 2.0,
        targetMode: ZoomTargetMode = .followCursor,
        targetPoint: CGPoint = CGPoint(x: 0.5, y: 0.5),
        isAutoGenerated: Bool = false
    ) {
        self.id = id
        self.startTime = max(0, startTime)
        self.endTime = max(startTime + 0.3, endTime)
        self.zoomScale = min(max(zoomScale, 1.15), 4.5)
        self.targetMode = targetMode
        self.targetPoint = CGPoint(
            x: min(max(targetPoint.x, 0.0), 1.0),
            y: min(max(targetPoint.y, 0.0), 1.0)
        )
        self.isAutoGenerated = isAutoGenerated
    }

    public var duration: TimeInterval {
        max(0.1, endTime - startTime)
    }
}

// MARK: - Cursor & Click Telemetry

public struct CursorSample: Codable, Equatable {
    /// Timestamp in seconds from recording start
    public var time: TimeInterval
    /// Normalized X in 0...1 (left to right)
    public var x: CGFloat
    /// Normalized Y in 0...1 (top to bottom)
    public var y: CGFloat
    /// Whether primary or secondary mouse button is pressed at this sample
    public var isPressed: Bool

    public init(time: TimeInterval, x: CGFloat, y: CGFloat, isPressed: Bool = false) {
        self.time = time
        self.x = min(max(x, 0.0), 1.0)
        self.y = min(max(y, 0.0), 1.0)
        self.isPressed = isPressed
    }

    public var point: CGPoint {
        CGPoint(x: x, y: y)
    }
}

public struct ClickEvent: Identifiable, Codable, Equatable {
    public var id: UUID
    public var time: TimeInterval
    public var releaseTime: TimeInterval
    /// Normalized X in 0...1 (left to right)
    public var x: CGFloat
    /// Normalized Y in 0...1 (top to bottom)
    public var y: CGFloat
    public var buttonNumber: Int

    public init(
        id: UUID = UUID(),
        time: TimeInterval,
        releaseTime: TimeInterval? = nil,
        x: CGFloat,
        y: CGFloat,
        buttonNumber: Int = 0
    ) {
        self.id = id
        self.time = time
        self.releaseTime = releaseTime ?? (time + 0.14)
        self.x = min(max(x, 0.0), 1.0)
        self.y = min(max(y, 0.0), 1.0)
        self.buttonNumber = buttonNumber
    }

    public var point: CGPoint {
        CGPoint(x: x, y: y)
    }
}

public struct CursorTelemetryTrack: Codable, Equatable {
    public var samples: [CursorSample]
    public var clicks: [ClickEvent]
    public var capturedFrameSize: CGSize

    public init(
        samples: [CursorSample] = [],
        clicks: [ClickEvent] = [],
        capturedFrameSize: CGSize = CGSize(width: 1920, height: 1080)
    ) {
        self.samples = samples
        self.clicks = clicks
        self.capturedFrameSize = capturedFrameSize
    }
}

// MARK: - Styling Configurations

public enum CursorShapeStyle: String, CaseIterable, Codable, Identifiable {
    case macOSPointer = "macOS Arrow"
    case sleekPointer = "Sleek Studio Arrow"
    case circleRing = "Touch Ring"
    case minimalDot = "Minimal Dot"

    public var id: String { rawValue }
}

public struct CursorStyle: Codable, Equatable {
    public var showCustomCursor: Bool = true
    public var hideSystemCursorOnCapture: Bool = true
    public var cursorShape: CursorShapeStyle = .macOSPointer
    public var cursorScale: CGFloat = 1.65
    /// 0.0 = raw cursor, 1.0 = maximum spring smoothing
    public var smoothingFactor: Double = 0.68
    public var showClickRipple: Bool = true
    public var rippleColor: CodableColor = CodableColor(red: 0.38, green: 0.56, blue: 1.0, alpha: 0.85)
    public var clickBounceAnimation: Bool = true
    /// 0.0 = off, 1.0 = strong directional motion blur trail
    public var motionBlurStrength: Double = 0.55
    public var autoHideIdleCursor: Bool = false

    public init() {}
}

public enum WebcamCornerPosition: String, CaseIterable, Codable, Identifiable {
    case bottomRight = "Bottom Right"
    case bottomLeft = "Bottom Left"
    case topRight = "Top Right"
    case topLeft = "Top Left"

    public var id: String { rawValue }
}

public enum WebcamMaskShape: String, CaseIterable, Codable, Identifiable {
    case circle = "Circle"
    case squircle = "Squircle"
    case roundedRectangle = "Landscape Card"

    public var id: String { rawValue }
}

public struct WebcamStyle: Codable, Equatable {
    public var isEnabled: Bool = true
    public var position: WebcamCornerPosition = .bottomRight
    public var shape: WebcamMaskShape = .squircle
    /// Relative size compared to canvas shorter dimension (0.14 ... 0.36)
    public var relativeSize: CGFloat = 0.22
    public var cornerRadius: CGFloat = 28.0
    public var borderWidth: CGFloat = 3.0
    public var borderColor: CodableColor = CodableColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.85)
    public var shadowOpacity: Double = 0.55
    public var mirrorHorizontally: Bool = true
    public var shrinkDuringZoom: Bool = true
    public var margin: CGFloat = 36.0

    public init() {}
}

public struct CanvasStyle: Codable, Equatable {
    public var backgroundPreset: BackgroundPreset = .sequoiaAura
    public var customColorStart: CodableColor = CodableColor(red: 0.22, green: 0.28, blue: 0.82)
    public var customColorEnd: CodableColor = CodableColor(red: 0.78, green: 0.25, blue: 0.64)
    /// Padding around the screen frame in reference 1080p canvas pixels (0 ... 160)
    public var padding: CGFloat = 64.0
    /// Corner radius of the screen frame in reference 1080p canvas pixels (0 ... 44)
    public var cornerRadius: CGFloat = 18.0
    /// Shadow blur radius (0 ... 70)
    public var shadowRadius: CGFloat = 38.0
    public var shadowOpacity: Double = 0.60
    public var insetBorderOpacity: Double = 0.28
    public var aspectRatio: AspectRatioPreset = .widescreen16x9

    public init() {}

    public var activeGradientColors: [CodableColor] {
        if backgroundPreset == .customGradient {
            return [customColorStart, customColorEnd]
        }
        return backgroundPreset.gradientColors
    }
}

public struct AudioMixSettings: Codable, Equatable {
    public var recordSystemAudio: Bool = true
    public var recordMicrophone: Bool = true
    public var systemAudioVolume: Float = 1.0
    public var microphoneVolume: Float = 1.0

    public init() {}
}

// MARK: - Export Settings

public enum ExportResolutionPreset: String, CaseIterable, Codable, Identifiable {
    case hd1080p = "1080p Full HD"
    case qhd1440p = "1440p 2K QHD"
    case uhd4k = "2160p 4K UHD"

    public var id: String { rawValue }

    public var baseHeight: CGFloat {
        switch self {
        case .hd1080p: return 1080
        case .qhd1440p: return 1440
        case .uhd4k: return 2160
        }
    }

    public func outputSize(for aspectRatio: CGFloat) -> CGSize {
        let h = baseHeight
        let rawW = round(h * aspectRatio)
        // Ensure even dimensions for H.264 / HEVC hardware encoder
        let evenW = Int(rawW) % 2 == 0 ? Int(rawW) : Int(rawW) + 1
        let evenH = Int(h) % 2 == 0 ? Int(h) : Int(h) + 1
        return CGSize(width: CGFloat(max(320, evenW)), height: CGFloat(max(320, evenH)))
    }
}

public struct ExportSettings: Codable, Equatable {
    public var resolution: ExportResolutionPreset = .hd1080p
    public var frameRate: Int = 60
    public var useHEVC: Bool = false

    public init() {}
}

// MARK: - Recording Project

public struct RecordingProject: Identifiable, Equatable {
    public var id: UUID
    public var title: String
    public var createdAt: Date
    public var screenVideoURL: URL
    public var webcamVideoURL: URL?
    public var duration: TimeInterval
    public var sourceSize: CGSize
    public var trimStart: TimeInterval
    public var trimEnd: TimeInterval
    public var zoomSegments: [ZoomSegment]
    public var zoomSpringSpeed: ZoomSpringSpeed
    public var defaultAutoZoomScale: CGFloat
    public var telemetry: CursorTelemetryTrack
    public var canvasStyle: CanvasStyle
    public var cursorStyle: CursorStyle
    public var webcamStyle: WebcamStyle
    public var audioSettings: AudioMixSettings
    public var exportSettings: ExportSettings

    public init(
        id: UUID = UUID(),
        title: String = "Screen Studio Recording",
        createdAt: Date = Date(),
        screenVideoURL: URL,
        webcamVideoURL: URL? = nil,
        duration: TimeInterval,
        sourceSize: CGSize = CGSize(width: 1920, height: 1080),
        trimStart: TimeInterval = 0,
        trimEnd: TimeInterval? = nil,
        zoomSegments: [ZoomSegment] = [],
        zoomSpringSpeed: ZoomSpringSpeed = .mellow,
        defaultAutoZoomScale: CGFloat = 2.0,
        telemetry: CursorTelemetryTrack = CursorTelemetryTrack(),
        canvasStyle: CanvasStyle = CanvasStyle(),
        cursorStyle: CursorStyle = CursorStyle(),
        webcamStyle: WebcamStyle = WebcamStyle(),
        audioSettings: AudioMixSettings = AudioMixSettings(),
        exportSettings: ExportSettings = ExportSettings()
    ) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
        self.screenVideoURL = screenVideoURL
        self.webcamVideoURL = webcamVideoURL
        self.duration = max(0.5, duration)
        self.sourceSize = sourceSize
        self.trimStart = max(0, trimStart)
        self.trimEnd = min(self.duration, trimEnd ?? self.duration)
        self.zoomSegments = zoomSegments
        self.zoomSpringSpeed = zoomSpringSpeed
        self.defaultAutoZoomScale = defaultAutoZoomScale
        self.telemetry = telemetry
        self.canvasStyle = canvasStyle
        self.cursorStyle = cursorStyle
        self.webcamStyle = webcamStyle
        self.audioSettings = audioSettings
        self.exportSettings = exportSettings
    }

    public var trimmedDuration: TimeInterval {
        max(0.1, trimEnd - trimStart)
    }
}
