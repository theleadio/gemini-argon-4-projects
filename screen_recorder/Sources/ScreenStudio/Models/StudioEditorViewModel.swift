import Foundation
import AVFoundation
import CoreVideo
import CoreImage
import CoreGraphics
import SwiftUI
import AppKit

@MainActor
public final class StudioEditorViewModel: ObservableObject {

    // MARK: - Navigation & Mode State

    @Published public var project: RecordingProject? {
        didSet {
            if oldValue?.id != project?.id {
                setupPlayersForCurrentProject()
            } else {
                renderCurrentFrameComposite()
            }
        }
    }

    @Published public var isShowingRecorderSheet: Bool = false
    @Published public var selectedZoomSegmentID: UUID?
    @Published public var isPickingZoomTargetOnCanvas: Bool = false

    // MARK: - Playback State

    @Published public var currentTime: TimeInterval = 0.0
    @Published public var isPlaying: Bool = false
    @Published public var isLooping: Bool = true
    @Published public var playbackRate: Float = 1.0

    // MARK: - Composited Output Preview

    @Published public private(set) var compositedPreviewImage: CGImage?
    @Published public private(set) var currentCameraState: EvaluatedCameraState = EvaluatedCameraState(
        zoomScale: 1.0,
        focusCenter: CGPoint(x: 0.5, y: 0.5),
        visibleNormalizedRect: CGRect(x: 0, y: 0, width: 1, height: 1),
        activeSegmentID: nil
    )
    @Published public private(set) var filmstripThumbnails: [NSImage] = []

    // MARK: - Child Engines

    public let recorderEngine = ScreenRecorderEngine()
    public let exportEngine = VideoExportEngine()

    // MARK: - Internal AVPlayer & Frame Extraction

    private var screenPlayer: AVPlayer?
    private var webcamPlayer: AVPlayer?
    private var screenVideoOutput: AVPlayerItemVideoOutput?
    private var webcamVideoOutput: AVPlayerItemVideoOutput?
    private var screenImageGenerator: AVAssetImageGenerator?
    private var webcamImageGenerator: AVAssetImageGenerator?

    private var latestScreenCGImage: CGImage?
    private var latestWebcamCGImage: CGImage?
    private var lastExtractedTime: TimeInterval = -1.0

    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])
    private var playbackTimer: Timer?

    public init() {}

    // MARK: - Project Loading

    public func loadProject(_ newProject: RecordingProject) {
        stopPlayback()
        self.selectedZoomSegmentID = newProject.zoomSegments.first?.id
        self.currentTime = newProject.trimStart
        self.project = newProject
        self.isShowingRecorderSheet = false
    }

    public func loadInteractiveDemo() async {
        do {
            let demo = try await SampleProjectGenerator.generateDemoProject()
            loadProject(demo)
        } catch {
            print("Failed to generate demo project: \(error)")
        }
    }

    // MARK: - Player Setup

    private func setupPlayersForCurrentProject() {
        stopPlayback()
        latestScreenCGImage = nil
        latestWebcamCGImage = nil
        lastExtractedTime = -1.0
        filmstripThumbnails = []

        guard let proj = project else {
            compositedPreviewImage = nil
            return
        }

        let pixelAttrs: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
        ]

        // Screen video player & output
        let screenAsset = AVURLAsset(url: proj.screenVideoURL)
        let screenItem = AVPlayerItem(asset: screenAsset)
        let sOutput = AVPlayerItemVideoOutput(pixelBufferAttributes: pixelAttrs)
        screenItem.add(sOutput)
        let sPlayer = AVPlayer(playerItem: screenItem)
        sPlayer.actionAtItemEnd = .pause

        let sGen = AVAssetImageGenerator(asset: screenAsset)
        sGen.appliesPreferredTrackTransform = true
        sGen.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 60)
        sGen.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 60)

        self.screenPlayer = sPlayer
        self.screenVideoOutput = sOutput
        self.screenImageGenerator = sGen

        // Optional Webcam player & output
        if let webcamURL = proj.webcamVideoURL, FileManager.default.fileExists(atPath: webcamURL.path) {
            let wAsset = AVURLAsset(url: webcamURL)
            let wItem = AVPlayerItem(asset: wAsset)
            let wOutput = AVPlayerItemVideoOutput(pixelBufferAttributes: pixelAttrs)
            wItem.add(wOutput)
            let wPlayer = AVPlayer(playerItem: wItem)
            wPlayer.actionAtItemEnd = .pause
            wPlayer.isMuted = true

            let wGen = AVAssetImageGenerator(asset: wAsset)
            wGen.appliesPreferredTrackTransform = true
            wGen.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 30)
            wGen.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 30)

            self.webcamPlayer = wPlayer
            self.webcamVideoOutput = wOutput
            self.webcamImageGenerator = wGen
        } else {
            self.webcamPlayer = nil
            self.webcamVideoOutput = nil
            self.webcamImageGenerator = nil
        }

        seek(to: proj.trimStart, forceExtract: true)
        generateFilmstripThumbnails(from: screenAsset, duration: proj.duration)
    }

    private func generateFilmstripThumbnails(from asset: AVAsset, duration: TimeInterval) {
        Task.detached(priority: .utility) {
            let generator = AVAssetImageGenerator(asset: asset)
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: 200, height: 120)
            let count = 10
            var images: [NSImage] = []
            for i in 0..<count {
                let t = duration * (Double(i) + 0.5) / Double(count)
                let cmTime = CMTime(seconds: t, preferredTimescale: 600)
                if let cgImg = try? generator.copyCGImage(at: cmTime, actualTime: nil) {
                    images.append(NSImage(cgImage: cgImg, size: NSSize(width: cgImg.width, height: cgImg.height)))
                }
            }
            let capturedImages = images
            await MainActor.run {
                self.filmstripThumbnails = capturedImages
            }
        }
    }

    // MARK: - Playback Controls

    public func togglePlayPause() {
        if isPlaying {
            pausePlayback()
        } else {
            startPlayback()
        }
    }

    public func startPlayback() {
        guard let proj = project, let sPlayer = screenPlayer else { return }
        if currentTime >= proj.trimEnd - 0.05 || currentTime < proj.trimStart {
            seek(to: proj.trimStart, forceExtract: true)
        }

        isPlaying = true
        sPlayer.rate = playbackRate
        webcamPlayer?.rate = playbackRate

        playbackTimer?.invalidate()
        playbackTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.tickPlayback()
            }
        }
    }

    public func pausePlayback() {
        isPlaying = false
        screenPlayer?.pause()
        webcamPlayer?.pause()
        playbackTimer?.invalidate()
        playbackTimer = nil
        renderCurrentFrameComposite()
    }

    public func stopPlayback() {
        pausePlayback()
    }

    public func seek(to time: TimeInterval, forceExtract: Bool = false) {
        guard let proj = project else { return }
        let clamped = min(max(time, 0.0), proj.duration)
        currentTime = clamped

        let cmTime = CMTime(seconds: clamped, preferredTimescale: 600)
        let tolerance = CMTime(value: 1, timescale: 60)
        screenPlayer?.seek(to: cmTime, toleranceBefore: tolerance, toleranceAfter: tolerance)
        webcamPlayer?.seek(to: cmTime, toleranceBefore: tolerance, toleranceAfter: tolerance)

        if forceExtract || abs(clamped - lastExtractedTime) > 0.015 {
            extractSourceFrames(at: cmTime)
            lastExtractedTime = clamped
        }
        renderCurrentFrameComposite()
    }

    private func tickPlayback() {
        guard isPlaying, let proj = project, let sPlayer = screenPlayer else { return }
        let playerSeconds = sPlayer.currentTime().seconds
        if playerSeconds.isFinite {
            currentTime = playerSeconds
        } else {
            currentTime += (1.0 / 60.0) * Double(playbackRate)
        }

        if currentTime >= proj.trimEnd {
            if isLooping {
                seek(to: proj.trimStart, forceExtract: true)
                sPlayer.rate = playbackRate
                webcamPlayer?.rate = playbackRate
            } else {
                seek(to: proj.trimEnd, forceExtract: true)
                pausePlayback()
            }
            return
        }

        let cmTime = CMTime(seconds: currentTime, preferredTimescale: 600)
        extractSourceFrames(at: cmTime)
        renderCurrentFrameComposite()
    }

    private func extractSourceFrames(at cmTime: CMTime) {
        if let sOutput = screenVideoOutput,
           sOutput.hasNewPixelBuffer(forItemTime: cmTime),
           let pb = sOutput.copyPixelBuffer(forItemTime: cmTime, itemTimeForDisplay: nil) {
            let ci = CIImage(cvPixelBuffer: pb)
            if let cg = ciContext.createCGImage(ci, from: ci.extent) {
                latestScreenCGImage = cg
            }
        } else if latestScreenCGImage == nil || !isPlaying {
            if let cg = try? screenImageGenerator?.copyCGImage(at: cmTime, actualTime: nil) {
                latestScreenCGImage = cg
            }
        }

        if let wOutput = webcamVideoOutput,
           wOutput.hasNewPixelBuffer(forItemTime: cmTime),
           let pb = wOutput.copyPixelBuffer(forItemTime: cmTime, itemTimeForDisplay: nil) {
            let ci = CIImage(cvPixelBuffer: pb)
            if let cg = ciContext.createCGImage(ci, from: ci.extent) {
                latestWebcamCGImage = cg
            }
        } else if (latestWebcamCGImage == nil || !isPlaying), let wGen = webcamImageGenerator {
            if let cg = try? wGen.copyCGImage(at: cmTime, actualTime: nil) {
                latestWebcamCGImage = cg
            }
        }
    }

    public func renderCurrentFrameComposite() {
        guard let proj = project else { return }

        let aspect = proj.canvasStyle.aspectRatio.targetAspectRatio(sourceSize: proj.sourceSize)
        // Render preview at crisp 720p/900p equivalent for 60fps interactive smoothness
        let previewHeight: CGFloat = 780
        let previewWidth = round(previewHeight * aspect)
        let previewSize = CGSize(width: max(360, previewWidth), height: previewHeight)

        let camState = CameraAndCursorEngine.evaluateCamera(
            at: currentTime,
            zoomSegments: proj.zoomSegments,
            springSpeed: proj.zoomSpringSpeed,
            telemetry: proj.telemetry
        )
        self.currentCameraState = camState

        let activeWebcamImg: CGImage? = latestWebcamCGImage ?? recorderEngine.webcamAndAudio.latestWebcamImage

        if let composite = FrameCompositor.renderCompositeFrame(
            screenImage: latestScreenCGImage,
            webcamImage: activeWebcamImg,
            at: currentTime,
            canvasSize: previewSize,
            sourceScreenSize: proj.sourceSize,
            canvasStyle: proj.canvasStyle,
            cursorStyle: proj.cursorStyle,
            webcamStyle: proj.webcamStyle,
            zoomSegments: proj.zoomSegments,
            zoomSpringSpeed: proj.zoomSpringSpeed,
            telemetry: proj.telemetry
        ) {
            self.compositedPreviewImage = composite
        }
    }

    // MARK: - Zoom Segment Manipulation

    public var selectedZoomSegment: ZoomSegment? {
        guard let proj = project, let selID = selectedZoomSegmentID else { return nil }
        return proj.zoomSegments.first(where: { $0.id == selID })
    }

    public func addZoomSegment(at time: TimeInterval? = nil, targetPoint: CGPoint? = nil) {
        guard var proj = project else { return }
        let start = max(0.0, min((time ?? currentTime), proj.duration - 0.5))
        let end = min(proj.duration, start + 1.8)

        let cursorAtTime = CameraAndCursorEngine.evaluateCursor(
            at: start,
            telemetry: proj.telemetry,
            style: proj.cursorStyle
        )

        let newSegment = ZoomSegment(
            startTime: start,
            endTime: end,
            zoomScale: proj.defaultAutoZoomScale,
            targetMode: targetPoint != nil ? .fixedPoint : .followCursor,
            targetPoint: targetPoint ?? cursorAtTime.position,
            isAutoGenerated: false
        )

        proj.zoomSegments.append(newSegment)
        proj.zoomSegments.sort { $0.startTime < $1.startTime }
        self.selectedZoomSegmentID = newSegment.id
        self.project = proj
    }

    public func updateZoomSegment(_ updated: ZoomSegment) {
        guard var proj = project,
              let idx = proj.zoomSegments.firstIndex(where: { $0.id == updated.id }) else { return }
        proj.zoomSegments[idx] = updated
        self.project = proj
    }

    public func deleteZoomSegment(id: UUID) {
        guard var proj = project else { return }
        proj.zoomSegments.removeAll { $0.id == id }
        if selectedZoomSegmentID == id {
            selectedZoomSegmentID = proj.zoomSegments.first?.id
        }
        self.project = proj
    }

    public func deleteSelectedZoomSegment() {
        guard let selID = selectedZoomSegmentID else { return }
        deleteZoomSegment(id: selID)
    }

    public func regenerateAutoZooms() {
        guard var proj = project else { return }
        proj.zoomSegments = CameraAndCursorEngine.generateAutoZoomSegments(
            from: proj.telemetry,
            duration: proj.duration,
            defaultScale: proj.defaultAutoZoomScale
        )
        self.selectedZoomSegmentID = proj.zoomSegments.first?.id
        self.project = proj
    }

    public func setManualTargetPointForSelectedSegment(_ normalizedPoint: CGPoint) {
        guard var seg = selectedZoomSegment else {
            addZoomSegment(at: currentTime, targetPoint: normalizedPoint)
            isPickingZoomTargetOnCanvas = false
            return
        }
        seg.targetMode = .fixedPoint
        seg.targetPoint = CGPoint(
            x: min(max(normalizedPoint.x, 0.0), 1.0),
            y: min(max(normalizedPoint.y, 0.0), 1.0)
        )
        updateZoomSegment(seg)
        isPickingZoomTargetOnCanvas = false
    }
}
