import Foundation
import AVFoundation
import CoreGraphics
import CoreVideo
import AppKit

public final class VideoExportEngine: ObservableObject {

    @Published public private(set) var isExporting: Bool = false
    @Published public private(set) var progress: Double = 0.0
    @Published public private(set) var statusMessage: String = ""
    @Published public private(set) var lastExportedURL: URL?
    @Published public private(set) var exportError: String?

    private var exportTask: Task<Void, Never>?

    public init() {}

    @MainActor
    public func cancelExport() {
        exportTask?.cancel()
        exportTask = nil
        isExporting = false
        statusMessage = "Export cancelled"
    }

    @MainActor
    public func exportProject(_ project: RecordingProject, to destinationURL: URL) {
        guard !isExporting else { return }
        isExporting = true
        progress = 0.0
        exportError = nil
        lastExportedURL = nil
        statusMessage = "Preparing video compositor..."

        exportTask = Task {
            do {
                try await performExport(project: project, destinationURL: destinationURL)
                if !Task.isCancelled {
                    await MainActor.run {
                        self.progress = 1.0
                        self.isExporting = false
                        self.lastExportedURL = destinationURL
                        self.statusMessage = "Export complete!"
                    }
                }
            } catch {
                if !Task.isCancelled {
                    await MainActor.run {
                        self.isExporting = false
                        self.exportError = error.localizedDescription
                        self.statusMessage = "Export failed"
                    }
                }
            }
        }
    }

    private func performExport(project: RecordingProject, destinationURL: URL) async throws {
        try? FileManager.default.removeItem(at: destinationURL)

        let aspectRatio = project.canvasStyle.aspectRatio.targetAspectRatio(sourceSize: project.sourceSize)
        let outputSize = project.exportSettings.resolution.outputSize(for: aspectRatio)
        let width = Int(outputSize.width)
        let height = Int(outputSize.height)
        let fps = max(24, min(60, project.exportSettings.frameRate))

        let trimStart = max(0.0, project.trimStart)
        let trimEnd = max(trimStart + 0.2, min(project.duration, project.trimEnd))
        let exportDuration = trimEnd - trimStart
        let totalFrames = max(1, Int(ceil(exportDuration * Double(fps))))

        let fileType: AVFileType = destinationURL.pathExtension.lowercased() == "mov" ? .mov : .mp4
        let writer = try AVAssetWriter(outputURL: destinationURL, fileType: fileType)

        let codec: AVVideoCodecType = project.exportSettings.useHEVC ? .hevc : .h264
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: codec,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: max(10_000_000, width * height * 6)
            ]
        ]

        let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput.expectsMediaDataInRealTime = false

        let bufferAttributes: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ]

        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: videoInput,
            sourcePixelBufferAttributes: bufferAttributes
        )

        guard writer.canAdd(videoInput) else {
            throw NSError(domain: "VideoExportEngine", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot add video output track."])
        }
        writer.add(videoInput)

        // Setup image generators for accurate frame extraction
        let screenAsset = AVURLAsset(url: project.screenVideoURL)
        let screenGenerator = AVAssetImageGenerator(asset: screenAsset)
        screenGenerator.appliesPreferredTrackTransform = true
        screenGenerator.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 120)
        screenGenerator.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 120)

        var webcamGenerator: AVAssetImageGenerator?
        if project.webcamStyle.isEnabled, let webcamURL = project.webcamVideoURL, FileManager.default.fileExists(atPath: webcamURL.path) {
            let wAsset = AVURLAsset(url: webcamURL)
            let wGen = AVAssetImageGenerator(asset: wAsset)
            wGen.appliesPreferredTrackTransform = true
            wGen.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 60)
            wGen.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 60)
            webcamGenerator = wGen
        }

        // Optional audio passthrough reader/writer if source has audio tracks
        var audioReader: AVAssetReader?
        var audioReaderOutput: AVAssetReaderAudioMixOutput?
        var audioWriterInput: AVAssetWriterInput?

        let audioTracks = (try? await screenAsset.loadTracks(withMediaType: .audio)) ?? []
        if !audioTracks.isEmpty && (project.audioSettings.recordSystemAudio || project.audioSettings.recordMicrophone) {
            if let reader = try? AVAssetReader(asset: screenAsset) {
                reader.timeRange = CMTimeRange(
                    start: CMTime(seconds: trimStart, preferredTimescale: 600),
                    duration: CMTime(seconds: exportDuration, preferredTimescale: 600)
                )
                let outputSettings: [String: Any] = [
                    AVFormatIDKey: kAudioFormatLinearPCM,
                    AVSampleRateKey: 48000,
                    AVNumberOfChannelsKey: 2,
                    AVLinearPCMBitDepthKey: 16,
                    AVLinearPCMIsFloatKey: false,
                    AVLinearPCMIsBigEndianKey: false,
                    AVLinearPCMIsNonInterleaved: false
                ]
                let mixOutput = AVAssetReaderAudioMixOutput(audioTracks: audioTracks, audioSettings: outputSettings)
                if reader.canAdd(mixOutput) {
                    reader.add(mixOutput)
                    let aWriterSettings: [String: Any] = [
                        AVFormatIDKey: kAudioFormatMPEG4AAC,
                        AVSampleRateKey: 48000,
                        AVNumberOfChannelsKey: 2,
                        AVEncoderBitRateKey: 192_000
                    ]
                    let aInput = AVAssetWriterInput(mediaType: .audio, outputSettings: aWriterSettings)
                    aInput.expectsMediaDataInRealTime = false
                    if writer.canAdd(aInput) {
                        writer.add(aInput)
                        audioReader = reader
                        audioReaderOutput = mixOutput
                        audioWriterInput = aInput
                    }
                }
            }
        }

        writer.startWriting()
        writer.startSession(atSourceTime: .zero)
        audioReader?.startReading()

        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        var lastScreenFrame: CGImage?
        var lastWebcamFrame: CGImage?

        for frameIdx in 0..<totalFrames {
            try Task.checkCancellation()

            while !videoInput.isReadyForMoreMediaData {
                try await Task.sleep(nanoseconds: 2_000_000)
            }

            let sourceTimeSeconds = trimStart + Double(frameIdx) / Double(fps)
            let sourceCMTime = CMTime(seconds: sourceTimeSeconds, preferredTimescale: 600)
            let outputCMTime = CMTime(value: CMTimeValue(frameIdx), timescale: CMTimeScale(fps))

            if let extractedScreen = try? screenGenerator.copyCGImage(at: sourceCMTime, actualTime: nil) {
                lastScreenFrame = extractedScreen
            }
            if let wGen = webcamGenerator,
               let extractedWebcam = try? wGen.copyCGImage(at: sourceCMTime, actualTime: nil) {
                lastWebcamFrame = extractedWebcam
            }

            guard let compositedImage = FrameCompositor.renderCompositeFrame(
                screenImage: lastScreenFrame,
                webcamImage: lastWebcamFrame,
                at: sourceTimeSeconds,
                canvasSize: outputSize,
                sourceScreenSize: project.sourceSize,
                canvasStyle: project.canvasStyle,
                cursorStyle: project.cursorStyle,
                webcamStyle: project.webcamStyle,
                zoomSegments: project.zoomSegments,
                zoomSpringSpeed: project.zoomSpringSpeed,
                telemetry: project.telemetry
            ) else {
                continue
            }

            if let pool = adaptor.pixelBufferPool {
                var pixelBufferOut: CVPixelBuffer?
                CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBufferOut)
                if let pixelBuffer = pixelBufferOut {
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
                            ctx.draw(compositedImage, in: CGRect(x: 0, y: 0, width: width, height: height))
                        }
                    }
                    CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
                    adaptor.append(pixelBuffer, withPresentationTime: outputCMTime)
                }
            }

            if frameIdx % 3 == 0 || frameIdx == totalFrames - 1 {
                let frac = Double(frameIdx + 1) / Double(totalFrames)
                await MainActor.run {
                    self.progress = frac * 0.94
                    self.statusMessage = "Rendering frame \(frameIdx + 1) of \(totalFrames) (\(Int(frac * 100))%)..."
                }
            }
        }

        videoInput.markAsFinished()

        // Append audio samples if present
        if let aReader = audioReader,
           let aOutput = audioReaderOutput,
           let aInput = audioWriterInput {
            await MainActor.run {
                self.statusMessage = "Mixing audio tracks..."
            }
            while aReader.status == .reading {
                if Task.isCancelled { break }
                if aInput.isReadyForMoreMediaData {
                    if let sampleBuffer = aOutput.copyNextSampleBuffer() {
                        aInput.append(sampleBuffer)
                    } else {
                        break
                    }
                } else {
                    try? await Task.sleep(nanoseconds: 2_000_000)
                }
            }
            aInput.markAsFinished()
        }

        await MainActor.run {
            self.progress = 0.98
            self.statusMessage = "Finalizing MP4 container..."
        }

        await writer.finishWriting()
        if let err = writer.error {
            throw err
        }
    }
}
