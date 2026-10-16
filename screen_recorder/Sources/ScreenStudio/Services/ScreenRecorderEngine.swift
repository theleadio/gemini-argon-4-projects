import Foundation
import ScreenCaptureKit
import AVFoundation
import CoreMedia
import CoreVideo
import CoreImage
import AppKit

public enum CaptureTargetMode: String, CaseIterable, Identifiable {
    case display = "Full Display"
    case window = "App Window"

    public var id: String { rawValue }
}

public struct ShareableDisplayItem: Identifiable, Equatable {
    public let id: CGDirectDisplayID
    public let scDisplay: SCDisplay
    public let title: String
    public let frame: CGRect
    public var thumbnail: NSImage?

    public static func == (lhs: ShareableDisplayItem, rhs: ShareableDisplayItem) -> Bool {
        lhs.id == rhs.id && lhs.frame == rhs.frame
    }
}

public struct ShareableWindowItem: Identifiable, Equatable {
    public let id: CGWindowID
    public let scWindow: SCWindow
    public let title: String
    public let appName: String
    public let frame: CGRect
    public var appIcon: NSImage?
    public var thumbnail: NSImage?

    public static func == (lhs: ShareableWindowItem, rhs: ShareableWindowItem) -> Bool {
        lhs.id == rhs.id && lhs.frame == rhs.frame
    }
}

public final class ScreenRecorderEngine: NSObject, ObservableObject, SCStreamOutput, SCStreamDelegate {

    // MARK: - Published UI State

    @Published public var targetMode: CaptureTargetMode = .display
    @Published public private(set) var availableDisplays: [ShareableDisplayItem] = []
    @Published public private(set) var availableWindows: [ShareableWindowItem] = []
    @Published public var selectedDisplayID: CGDirectDisplayID?
    @Published public var selectedWindowID: CGWindowID?

    @Published public var captureSystemAudio: Bool = true
    @Published public var autoZoomOnClicks: Bool = true
    @Published public var hideSystemCursorForCustomRender: Bool = true
    @Published public var targetFPS: Int = 60

    @Published public private(set) var isRecording: Bool = false
    @Published public private(set) var isPaused: Bool = false
    @Published public private(set) var elapsedSeconds: TimeInterval = 0
    @Published public private(set) var permissionError: String?
    @Published public private(set) var isPreparingDemo: Bool = false
    @Published public private(set) var livePreviewFrame: CGImage?

    public let webcamAndAudio = WebcamAndAudioCaptureManager()
    private let cursorTracker = CursorTracker()

    // MARK: - Internal Stream & Writer State

    private let captureQueue = DispatchQueue(label: "com.screenstudio.screencapture", qos: .userInteractive)
    private let writerLock = NSLock()
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    private var stream: SCStream?
    private var assetWriter: AVAssetWriter?
    private var videoWriterInput: AVAssetWriterInput?
    private var systemAudioWriterInput: AVAssetWriterInput?
    private var micAudioWriterInput: AVAssetWriterInput?
    private var writerSessionStarted: Bool = false
    private var currentScreenOutputURL: URL?
    private var currentWebcamOutputURL: URL?
    private var currentCapturedSize: CGSize = CGSize(width: 1920, height: 1080)
    private var recordingTimer: Timer?
    private var recordingStartUptime: TimeInterval = 0
    private var accumulatedPausedTime: TimeInterval = 0
    private var pauseBeganUptime: TimeInterval?
    private var frameCounter: Int = 0

    public override init() {
        super.init()
        webcamAndAudio.onMicrophoneSampleBuffer = { [weak self] sampleBuffer in
            self?.appendMicrophoneSampleBuffer(sampleBuffer)
        }
    }

    // MARK: - Shareable Content Discovery

    @MainActor
    public func refreshShareableContent() async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            self.permissionError = nil

            var displayItems: [ShareableDisplayItem] = []
            for (idx, d) in content.displays.enumerated() {
                let name = idx == 0 ? "Primary Display (\(d.width)×\(d.height))" : "Display \(idx + 1) (\(d.width)×\(d.height))"
                displayItems.append(
                    ShareableDisplayItem(
                        id: d.displayID,
                        scDisplay: d,
                        title: name,
                        frame: d.frame,
                        thumbnail: nil
                    )
                )
            }

            let ownBundleID = Bundle.main.bundleIdentifier
            var windowItems: [ShareableWindowItem] = []
            for w in content.windows {
                guard w.frame.width >= 160, w.frame.height >= 120 else { continue }
                guard w.windowLayer == 0 else { continue }
                let appName = w.owningApplication?.applicationName ?? "Application"
                let winTitle = (w.title?.isEmpty == false) ? w.title! : appName
                if let bundleID = w.owningApplication?.bundleIdentifier, bundleID == ownBundleID {
                    continue
                }
                var icon: NSImage?
                if let pid = w.owningApplication?.processID,
                   let runningApp = NSRunningApplication(processIdentifier: pid) {
                    icon = runningApp.icon
                }
                windowItems.append(
                    ShareableWindowItem(
                        id: w.windowID,
                        scWindow: w,
                        title: winTitle,
                        appName: appName,
                        frame: w.frame,
                        appIcon: icon,
                        thumbnail: nil
                    )
                )
            }

            self.availableDisplays = displayItems
            self.availableWindows = windowItems

            if self.selectedDisplayID == nil || !displayItems.contains(where: { $0.id == self.selectedDisplayID }) {
                self.selectedDisplayID = displayItems.first?.id
            }
            if self.selectedWindowID == nil || !windowItems.contains(where: { $0.id == self.selectedWindowID }) {
                self.selectedWindowID = windowItems.first?.id
            }
        } catch {
            self.permissionError = "Screen Recording permission is required to capture displays and windows. Grant access in System Settings → Privacy & Security → Screen & System Audio Recording, or click 'Load Interactive Demo' to try the Studio Editor immediately."
        }
    }

    // MARK: - Start Recording

    @MainActor
    public func startRecording() async throws {
        if availableDisplays.isEmpty && availableWindows.isEmpty {
            await refreshShareableContent()
        }

        let filter: SCContentFilter
        let quartzFrame: CGRect
        let pixelWidth: Int
        let pixelHeight: Int

        switch targetMode {
        case .display:
            guard let displayItem = availableDisplays.first(where: { $0.id == selectedDisplayID }) ?? availableDisplays.first else {
                throw NSError(domain: "ScreenRecorderEngine", code: 1, userInfo: [NSLocalizedDescriptionKey: "No display available to record."])
            }
            filter = SCContentFilter(display: displayItem.scDisplay, excludingWindows: [])
            quartzFrame = displayItem.frame
            // Capture crisp Retina resolution up to 2880w
            let scale: CGFloat = displayItem.scDisplay.width <= 1920 ? 2.0 : 1.0
            pixelWidth = max(640, Int(CGFloat(displayItem.scDisplay.width) * scale) & ~1)
            pixelHeight = max(360, Int(CGFloat(displayItem.scDisplay.height) * scale) & ~1)

        case .window:
            guard let windowItem = availableWindows.first(where: { $0.id == selectedWindowID }) ?? availableWindows.first else {
                throw NSError(domain: "ScreenRecorderEngine", code: 2, userInfo: [NSLocalizedDescriptionKey: "No application window selected to record."])
            }
            filter = SCContentFilter(desktopIndependentWindow: windowItem.scWindow)
            quartzFrame = windowItem.frame
            pixelWidth = max(640, Int(windowItem.frame.width * 2.0) & ~1)
            pixelHeight = max(360, Int(windowItem.frame.height * 2.0) & ~1)
        }

        let sessionFolder = FileManager.default.temporaryDirectory
            .appendingPathComponent("ScreenStudioRecordings", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: sessionFolder, withIntermediateDirectories: true)

        let screenURL = sessionFolder.appendingPathComponent("screen_raw.mov")
        let webcamURL = sessionFolder.appendingPathComponent("webcam_raw.mov")

        try setupAssetWriter(outputURL: screenURL, width: pixelWidth, height: pixelHeight)

        let streamConfig = SCStreamConfiguration()
        streamConfig.width = pixelWidth
        streamConfig.height = pixelHeight
        streamConfig.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(targetFPS))
        streamConfig.queueDepth = 6
        streamConfig.pixelFormat = kCVPixelFormatType_32BGRA
        streamConfig.showsCursor = !hideSystemCursorForCustomRender
        streamConfig.capturesAudio = captureSystemAudio
        streamConfig.sampleRate = 48000
        streamConfig.channelCount = 2

        let newStream = SCStream(filter: filter, configuration: streamConfig, delegate: self)
        try newStream.addStreamOutput(self, type: .screen, sampleHandlerQueue: captureQueue)
        if captureSystemAudio {
            try? newStream.addStreamOutput(self, type: .audio, sampleHandlerQueue: captureQueue)
        }

        // Start webcam file writer if enabled
        webcamAndAudio.startPreviewIfNeeded()
        if webcamAndAudio.isWebcamEnabled {
            webcamAndAudio.startWebcamRecordingIfNeeded(to: webcamURL)
            self.currentWebcamOutputURL = webcamURL
        } else {
            self.currentWebcamOutputURL = nil
        }

        // Start cursor & click telemetry tracker
        cursorTracker.startTracking(captureFrameQuartz: quartzFrame)

        try await newStream.startCapture()

        self.stream = newStream
        self.currentScreenOutputURL = screenURL
        self.currentCapturedSize = CGSize(width: CGFloat(pixelWidth), height: CGFloat(pixelHeight))
        self.isRecording = true
        self.isPaused = false
        self.elapsedSeconds = 0
        self.recordingStartUptime = ProcessInfo.processInfo.systemUptime
        self.accumulatedPausedTime = 0
        self.pauseBeganUptime = nil

        startElapsedTimer()
    }

    // MARK: - Pause / Resume / Stop Recording

    @MainActor
    public func togglePause() {
        guard isRecording else { return }
        if isPaused {
            isPaused = false
            if let pauseStart = pauseBeganUptime {
                accumulatedPausedTime += (ProcessInfo.processInfo.systemUptime - pauseStart)
            }
            pauseBeganUptime = nil
            cursorTracker.resumeTracking()
            webcamAndAudio.setRecordingPaused(false)
        } else {
            isPaused = true
            pauseBeganUptime = ProcessInfo.processInfo.systemUptime
            cursorTracker.pauseTracking()
            webcamAndAudio.setRecordingPaused(true)
        }
    }

    @MainActor
    public func stopRecordingAndBuildProject() async -> RecordingProject? {
        guard isRecording else { return nil }
        recordingTimer?.invalidate()
        recordingTimer = nil

        let activeStream = self.stream
        self.stream = nil
        self.isRecording = false
        self.isPaused = false

        if let activeStream = activeStream {
            try? await activeStream.stopCapture()
        }

        let telemetry = cursorTracker.stopTracking()
        let recordedWebcamURL = await webcamAndAudio.stopWebcamRecording()

        let (writer, vInput, sysAInput, micAInput, hadStarted) = writerLock.withLock { () -> (AVAssetWriter?, AVAssetWriterInput?, AVAssetWriterInput?, AVAssetWriterInput?, Bool) in
            let w = self.assetWriter
            let v = self.videoWriterInput
            let sa = self.systemAudioWriterInput
            let ma = self.micAudioWriterInput
            let s = self.writerSessionStarted
            self.assetWriter = nil
            self.videoWriterInput = nil
            self.systemAudioWriterInput = nil
            self.micAudioWriterInput = nil
            self.writerSessionStarted = false
            return (w, v, sa, ma, s)
        }

        if let writer = writer, hadStarted, writer.status == .writing {
            vInput?.markAsFinished()
            sysAInput?.markAsFinished()
            micAInput?.markAsFinished()
            await writer.finishWriting()
        } else {
            writer?.cancelWriting()
        }

        guard let screenURL = currentScreenOutputURL,
              FileManager.default.fileExists(atPath: screenURL.path) else {
            return nil
        }

        let asset = AVURLAsset(url: screenURL)
        let loadedDuration = (try? await asset.load(.duration))?.seconds ?? elapsedSeconds
        let finalDuration = max(0.5, loadedDuration.isFinite && loadedDuration > 0.2 ? loadedDuration : elapsedSeconds)

        let autoZooms: [ZoomSegment]
        if autoZoomOnClicks {
            autoZooms = CameraAndCursorEngine.generateAutoZoomSegments(
                from: telemetry,
                duration: finalDuration,
                defaultScale: 2.0
            )
        } else {
            autoZooms = []
        }

        var cursorStyle = CursorStyle()
        cursorStyle.showCustomCursor = hideSystemCursorForCustomRender
        cursorStyle.hideSystemCursorOnCapture = hideSystemCursorForCustomRender

        var webcamStyle = WebcamStyle()
        webcamStyle.isEnabled = (recordedWebcamURL != nil)

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MMM d, HH:mm"

        return RecordingProject(
            title: "Recording \(dateFormatter.string(from: Date()))",
            screenVideoURL: screenURL,
            webcamVideoURL: recordedWebcamURL,
            duration: finalDuration,
            sourceSize: currentCapturedSize,
            zoomSegments: autoZooms,
            telemetry: telemetry,
            cursorStyle: cursorStyle,
            webcamStyle: webcamStyle
        )
    }

    // MARK: - AssetWriter Setup & Stream Output Handling

    private func setupAssetWriter(outputURL: URL, width: Int, height: Int) throws {
        writerLock.lock()
        defer { writerLock.unlock() }

        try? FileManager.default.removeItem(at: outputURL)
        let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)

        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: max(12_000_000, width * height * 5),
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            ]
        ]

        let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        vInput.expectsMediaDataInRealTime = true
        if writer.canAdd(vInput) {
            writer.add(vInput)
        }

        let audioSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 48000,
            AVNumberOfChannelsKey: 2,
            AVEncoderBitRateKey: 192_000
        ]

        var sysInput: AVAssetWriterInput?
        if captureSystemAudio {
            let input = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
            input.expectsMediaDataInRealTime = true
            if writer.canAdd(input) {
                writer.add(input)
                sysInput = input
            }
        }

        var micInput: AVAssetWriterInput?
        if webcamAndAudio.isMicrophoneEnabled {
            let input = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
            input.expectsMediaDataInRealTime = true
            if writer.canAdd(input) {
                writer.add(input)
                micInput = input
            }
        }

        writer.startWriting()

        self.assetWriter = writer
        self.videoWriterInput = vInput
        self.systemAudioWriterInput = sysInput
        self.micAudioWriterInput = micInput
        self.writerSessionStarted = false
        self.frameCounter = 0
    }

    public func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard sampleBuffer.isValid else { return }

        switch outputType {
        case .screen:
            guard let attachmentsArray = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
                  let attachments = attachmentsArray.first,
                  let statusRaw = attachments[.status] as? Int,
                  let status = SCFrameStatus(rawValue: statusRaw),
                  status == .complete else {
                return
            }

            writerLock.lock()
            let paused = self.isPaused
            if !paused, let writer = self.assetWriter, let vInput = self.videoWriterInput {
                let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                if !self.writerSessionStarted && writer.status == .writing {
                    writer.startSession(atSourceTime: pts)
                    self.writerSessionStarted = true
                }
                if self.writerSessionStarted && vInput.isReadyForMoreMediaData {
                    vInput.append(sampleBuffer)
                }
            }
            self.frameCounter += 1
            let shouldUpdatePreview = (self.frameCounter % 4 == 0)
            writerLock.unlock()

            if shouldUpdatePreview, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) {
                let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
                if let cgImg = ciContext.createCGImage(ciImage, from: ciImage.extent) {
                    DispatchQueue.main.async {
                        self.livePreviewFrame = cgImg
                    }
                }
            }

        case .audio:
            writerLock.lock()
            if !self.isPaused,
               self.writerSessionStarted,
               let sysInput = self.systemAudioWriterInput,
               sysInput.isReadyForMoreMediaData {
                sysInput.append(sampleBuffer)
            }
            writerLock.unlock()

        case .microphone:
            break

        @unknown default:
            break
        }
    }

    private func appendMicrophoneSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
        writerLock.lock()
        defer { writerLock.unlock() }
        guard isRecording, !isPaused, writerSessionStarted else { return }
        if let micInput = micAudioWriterInput, micInput.isReadyForMoreMediaData {
            micInput.append(sampleBuffer)
        }
    }

    public func stream(_ stream: SCStream, didStopWithError error: Error) {
        DispatchQueue.main.async {
            if self.isRecording {
                self.permissionError = "Capture stream interrupted: \(error.localizedDescription)"
            }
        }
    }

    private func startElapsedTimer() {
        recordingTimer?.invalidate()
        recordingTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self, self.isRecording, !self.isPaused else { return }
            let now = ProcessInfo.processInfo.systemUptime
            self.elapsedSeconds = max(0, now - self.recordingStartUptime - self.accumulatedPausedTime)
        }
    }
}
