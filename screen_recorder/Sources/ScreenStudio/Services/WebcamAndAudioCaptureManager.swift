import Foundation
import AVFoundation
import CoreImage
import CoreGraphics
import AppKit

public struct CaptureDeviceItem: Identifiable, Equatable, Hashable {
    public let id: String
    public let name: String
}

public final class WebcamAndAudioCaptureManager: NSObject, ObservableObject, AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {

    @Published public private(set) var availableCameras: [CaptureDeviceItem] = []
    @Published public private(set) var availableMicrophones: [CaptureDeviceItem] = []
    @Published public var selectedCameraID: String? {
        didSet {
            if oldValue != selectedCameraID && isPreviewRunning {
                reconfigureSession()
            }
        }
    }
    @Published public var selectedMicrophoneID: String? {
        didSet {
            if oldValue != selectedMicrophoneID && isPreviewRunning {
                reconfigureSession()
            }
        }
    }

    @Published public var isWebcamEnabled: Bool = false {
        didSet {
            if oldValue != isWebcamEnabled {
                reconfigureSession()
            }
        }
    }
    @Published public var isMicrophoneEnabled: Bool = true {
        didSet {
            if oldValue != isMicrophoneEnabled {
                reconfigureSession()
            }
        }
    }

    @Published public private(set) var latestWebcamImage: CGImage?
    @Published public private(set) var microphoneLevel: Float = 0.0

    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.screenstudio.avcapturesession", qos: .userInitiated)
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    private var videoOutput: AVCaptureVideoDataOutput?
    private var audioOutput: AVCaptureAudioDataOutput?
    private var isPreviewRunning: Bool = false

    // Recording writer for webcam video
    private let writerLock = NSLock()
    private var webcamAssetWriter: AVAssetWriter?
    private var webcamVideoInput: AVAssetWriterInput?
    private var isRecordingWebcam: Bool = false
    private var webcamRecordingPaused: Bool = false
    private var webcamSessionStarted: Bool = false
    private var webcamOutputURL: URL?

    // Callback to forward microphone CMSampleBuffers to main screen recording writer if desired
    public var onMicrophoneSampleBuffer: ((CMSampleBuffer) -> Void)?

    public override init() {
        super.init()
        refreshDevices()
    }

    public func refreshDevices() {
        let videoDiscovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .external],
            mediaType: .video,
            position: .unspecified
        )
        let cams = videoDiscovery.devices.map { CaptureDeviceItem(id: $0.uniqueID, name: $0.localizedName) }

        let audioDiscovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.microphone, .external],
            mediaType: .audio,
            position: .unspecified
        )
        let mics = audioDiscovery.devices.map { CaptureDeviceItem(id: $0.uniqueID, name: $0.localizedName) }

        DispatchQueue.main.async {
            self.availableCameras = cams
            self.availableMicrophones = mics
            if self.selectedCameraID == nil {
                self.selectedCameraID = AVCaptureDevice.default(for: .video)?.uniqueID ?? cams.first?.id
            }
            if self.selectedMicrophoneID == nil {
                self.selectedMicrophoneID = AVCaptureDevice.default(for: .audio)?.uniqueID ?? mics.first?.id
            }
        }
    }

    public func startPreviewIfNeeded() {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            self.isPreviewRunning = true
            self.configureSessionInputsAndOutputs()
        }
    }

    public func stopPreview() {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            self.isPreviewRunning = false
            if self.session.isRunning {
                self.session.stopRunning()
            }
            DispatchQueue.main.async {
                self.latestWebcamImage = nil
                self.microphoneLevel = 0.0
            }
        }
    }

    private func reconfigureSession() {
        sessionQueue.async { [weak self] in
            self?.configureSessionInputsAndOutputs()
        }
    }

    private func configureSessionInputsAndOutputs() {
        guard isPreviewRunning else { return }
        if !isWebcamEnabled && !isMicrophoneEnabled {
            if session.isRunning {
                session.stopRunning()
            }
            DispatchQueue.main.async {
                self.latestWebcamImage = nil
                self.microphoneLevel = 0.0
            }
            return
        }

        session.beginConfiguration()
        session.sessionPreset = .high

        // Remove existing inputs and outputs
        for input in session.inputs {
            session.removeInput(input)
        }
        for output in session.outputs {
            session.removeOutput(output)
        }

        // Configure camera input if enabled
        if isWebcamEnabled {
            let camStatus = AVCaptureDevice.authorizationStatus(for: .video)
            if camStatus == .notDetermined {
                AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                    if granted { self?.reconfigureSession() }
                }
            } else if camStatus == .authorized {
                let device: AVCaptureDevice?
                if let id = selectedCameraID {
                    device = AVCaptureDevice(uniqueID: id) ?? AVCaptureDevice.default(for: .video)
                } else {
                    device = AVCaptureDevice.default(for: .video)
                }
                if let device = device,
                   let vInput = try? AVCaptureDeviceInput(device: device),
                   session.canAddInput(vInput) {
                    session.addInput(vInput)

                    let vOutput = AVCaptureVideoDataOutput()
                    vOutput.videoSettings = [
                        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
                    ]
                    vOutput.alwaysDiscardsLateVideoFrames = true
                    vOutput.setSampleBufferDelegate(self, queue: sessionQueue)
                    if session.canAddOutput(vOutput) {
                        session.addOutput(vOutput)
                        self.videoOutput = vOutput
                    }
                }
            }
        } else {
            DispatchQueue.main.async {
                self.latestWebcamImage = nil
            }
        }

        // Configure microphone input if enabled
        if isMicrophoneEnabled {
            let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
            if micStatus == .notDetermined {
                AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in
                    if granted { self?.reconfigureSession() }
                }
            } else if micStatus == .authorized {
                let device: AVCaptureDevice?
                if let id = selectedMicrophoneID {
                    device = AVCaptureDevice(uniqueID: id) ?? AVCaptureDevice.default(for: .audio)
                } else {
                    device = AVCaptureDevice.default(for: .audio)
                }
                if let device = device,
                   let aInput = try? AVCaptureDeviceInput(device: device),
                   session.canAddInput(aInput) {
                    session.addInput(aInput)

                    let aOutput = AVCaptureAudioDataOutput()
                    aOutput.setSampleBufferDelegate(self, queue: sessionQueue)
                    if session.canAddOutput(aOutput) {
                        session.addOutput(aOutput)
                        self.audioOutput = aOutput
                    }
                }
            }
        } else {
            DispatchQueue.main.async {
                self.microphoneLevel = 0.0
            }
        }

        session.commitConfiguration()

        if !session.isRunning {
            session.startRunning()
        }
    }

    // MARK: - Webcam File Recording Lifecycle

    public func startWebcamRecordingIfNeeded(to url: URL) {
        writerLock.lock()
        defer { writerLock.unlock() }

        guard isWebcamEnabled else {
            isRecordingWebcam = false
            webcamOutputURL = nil
            return
        }

        try? FileManager.default.removeItem(at: url)
        guard let writer = try? AVAssetWriter(outputURL: url, fileType: .mov) else {
            isRecordingWebcam = false
            return
        }

        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: 1280,
            AVVideoHeightKey: 720,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 6_000_000
            ]
        ]

        let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        input.expectsMediaDataInRealTime = true
        if writer.canAdd(input) {
            writer.add(input)
        }

        writer.startWriting()
        self.webcamAssetWriter = writer
        self.webcamVideoInput = input
        self.webcamOutputURL = url
        self.webcamSessionStarted = false
        self.webcamRecordingPaused = false
        self.isRecordingWebcam = true
    }

    public func setRecordingPaused(_ paused: Bool) {
        writerLock.lock()
        self.webcamRecordingPaused = paused
        writerLock.unlock()
    }

    public func stopWebcamRecording() async -> URL? {
        let (writer, input, outputURL, hadStarted) = writerLock.withLock { () -> (AVAssetWriter?, AVAssetWriterInput?, URL?, Bool) in
            isRecordingWebcam = false
            let w = webcamAssetWriter
            let i = webcamVideoInput
            let u = webcamOutputURL
            let s = webcamSessionStarted
            webcamAssetWriter = nil
            webcamVideoInput = nil
            webcamOutputURL = nil
            webcamSessionStarted = false
            return (w, i, u, s)
        }

        guard let activeWriter = writer, hadStarted, activeWriter.status == .writing else {
            writer?.cancelWriting()
            return nil
        }

        input?.markAsFinished()
        await activeWriter.finishWriting()
        return activeWriter.status == .completed ? outputURL : nil
    }

    // MARK: - AVCaptureOutput Delegates

    public func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        if output == videoOutput {
            guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

            // Write to webcam file if recording
            writerLock.lock()
            if isRecordingWebcam, !webcamRecordingPaused, let writer = webcamAssetWriter, let input = webcamVideoInput {
                let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                if !webcamSessionStarted && writer.status == .writing {
                    writer.startSession(atSourceTime: pts)
                    webcamSessionStarted = true
                }
                if webcamSessionStarted && input.isReadyForMoreMediaData {
                    input.append(sampleBuffer)
                }
            }
            writerLock.unlock()

            // Convert to CGImage for live preview
            let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
            let rect = ciImage.extent
            if let cgImage = ciContext.createCGImage(ciImage, from: rect) {
                DispatchQueue.main.async {
                    self.latestWebcamImage = cgImage
                }
            }
        } else if output == audioOutput {
            updateAudioLevel(from: sampleBuffer)
            onMicrophoneSampleBuffer?(sampleBuffer)
        }
    }

    private func updateAudioLevel(from sampleBuffer: CMSampleBuffer) {
        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }
        var length = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        let status = CMBlockBufferGetDataPointer(
            blockBuffer,
            atOffset: 0,
            lengthAtOffsetOut: nil,
            totalLengthOut: &length,
            dataPointerOut: &dataPointer
        )
        guard status == kCMBlockBufferNoErr, let ptr = dataPointer, length >= 2 else { return }

        // Compute quick RMS peak over Int16 or Float32 samples
        let int16Count = min(512, length / 2)
        guard int16Count > 0 else { return }
        let int16Ptr = UnsafeRawPointer(ptr).assumingMemoryBound(to: Int16.self)
        var sumSquares: Float = 0
        for i in 0..<int16Count {
            let norm = Float(int16Ptr[i]) / Float(Int16.max)
            sumSquares += norm * norm
        }
        let rms = sqrt(sumSquares / Float(int16Count))
        let scaled = min(1.0, pow(rms * 3.8, 0.65))
        DispatchQueue.main.async {
            self.microphoneLevel = self.microphoneLevel * 0.6 + scaled * 0.4
        }
    }
}
