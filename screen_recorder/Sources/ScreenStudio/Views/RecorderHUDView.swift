import SwiftUI
import AppKit

public struct RecorderHUDView: View {
    @ObservedObject var viewModel: StudioEditorViewModel
    @ObservedObject var recorder: ScreenRecorderEngine
    @ObservedObject var webcamAudio: WebcamAndAudioCaptureManager

    @State private var isStartingRecording: Bool = false
    @State private var isGeneratingDemo: Bool = false
    @State private var localErrorMessage: String?

    public init(viewModel: StudioEditorViewModel) {
        self.viewModel = viewModel
        self.recorder = viewModel.recorderEngine
        self.webcamAudio = viewModel.recorderEngine.webcamAndAudio
    }

    public var body: some View {
        VStack(spacing: 0) {
            headerBar

            Divider().overlay(Color.white.opacity(0.08))

            if recorder.isRecording {
                activeRecordingPanel
            } else {
                configurationPanel
            }

            Divider().overlay(Color.white.opacity(0.08))

            bottomActionBar
        }
        .frame(width: 720)
        .background(
            ZStack {
                Color(red: 0.08, green: 0.09, blue: 0.13)
                LinearGradient(
                    colors: [
                        Color(red: 0.22, green: 0.25, blue: 0.52).opacity(0.22),
                        Color.clear
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.55), radius: 30, x: 0, y: 16)
        .task {
            await recorder.refreshShareableContent()
            webcamAudio.refreshDevices()
            webcamAudio.startPreviewIfNeeded()
        }
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 0.42, green: 0.35, blue: 0.98), Color(red: 0.88, green: 0.32, blue: 0.58)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 34, height: 34)
                Image(systemName: "record.circle.fill")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("ScreenStudio Recorder")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                Text("Cinematic macOS screen recorder with smooth auto-zoom & cursor physics")
                    .font(.system(size: 11.5))
                    .foregroundColor(.white.opacity(0.6))
            }

            Spacer()

            if viewModel.project != nil && !recorder.isRecording {
                Button {
                    viewModel.isShowingRecorderSheet = false
                } label: {
                    Label("Back to Editor", systemImage: "slider.horizontal.below.rectangle")
                        .font(.system(size: 12, weight: .semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.white.opacity(0.1))
                        .foregroundColor(.white)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 16)
    }

    // MARK: - Configuration Panel (Pre-Recording)

    private var configurationPanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            // 1. Target Mode Picker (Full Display vs App Window)
            HStack(spacing: 12) {
                ForEach(CaptureTargetMode.allCases) { mode in
                    let isSelected = recorder.targetMode == mode
                    Button {
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                            recorder.targetMode = mode
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: mode == .display ? "display" : "macwindow")
                                .font(.system(size: 14, weight: .semibold))
                            Text(mode.rawValue)
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(isSelected ? Color(red: 0.36, green: 0.44, blue: 0.96) : Color.white.opacity(0.06))
                        )
                        .foregroundColor(isSelected ? .white : .white.opacity(0.75))
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    Task {
                        await recorder.refreshShareableContent()
                        webcamAudio.refreshDevices()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .semibold))
                        .frame(width: 38, height: 38)
                        .background(Color.white.opacity(0.07))
                        .foregroundColor(.white.opacity(0.85))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .help("Refresh Displays & Windows")
            }

            // Permission Banner if ScreenCaptureKit needs permission
            if let permErr = recorder.permissionError {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.shield.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.orange)
                    Text(permErr)
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.88))
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer()
                    Button("Open Settings") {
                        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .controlSize(.small)
                }
                .padding(12)
                .background(Color.orange.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.orange.opacity(0.4), lineWidth: 1)
                )
            }

            // 2. Source Selection Grid
            sourceSelectionSection

            // 3. Camera, Microphone & System Audio Controls
            deviceAndAudioSection

            // 4. Smart Studio Options
            smartStudioTogglesSection

            if let localErr = localErrorMessage {
                Text(localErr)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.red)
            }
        }
        .padding(22)
    }

    private var sourceSelectionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(recorder.targetMode == .display ? "SELECT DISPLAY" : "SELECT APPLICATION WINDOW")
                .font(.system(size: 10.5, weight: .bold))
                .foregroundColor(.white.opacity(0.45))
                .tracking(0.8)

            if recorder.targetMode == .display {
                if recorder.availableDisplays.isEmpty {
                    emptySourcePlaceholder(text: "No displays detected yet. Grant Screen Recording permission or click Refresh.")
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(recorder.availableDisplays) { item in
                                let isSelected = recorder.selectedDisplayID == item.id
                                Button {
                                    recorder.selectedDisplayID = item.id
                                } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: "display")
                                            .font(.system(size: 22))
                                            .foregroundColor(isSelected ? Color(red: 0.55, green: 0.65, blue: 1.0) : .white.opacity(0.6))
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(item.title)
                                                .font(.system(size: 12.5, weight: .semibold))
                                                .foregroundColor(.white)
                                            Text("Retina 60 FPS Ready")
                                                .font(.system(size: 11))
                                                .foregroundColor(.white.opacity(0.55))
                                        }
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                    .background(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .fill(isSelected ? Color(red: 0.32, green: 0.40, blue: 0.92).opacity(0.32) : Color.white.opacity(0.05))
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(isSelected ? Color(red: 0.45, green: 0.56, blue: 1.0) : Color.white.opacity(0.1), lineWidth: isSelected ? 1.5 : 1)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            } else {
                if recorder.availableWindows.isEmpty {
                    emptySourcePlaceholder(text: "No on-screen application windows found.")
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(recorder.availableWindows) { win in
                                let isSelected = recorder.selectedWindowID == win.id
                                Button {
                                    recorder.selectedWindowID = win.id
                                } label: {
                                    HStack(spacing: 10) {
                                        if let icon = win.appIcon {
                                            Image(nsImage: icon)
                                                .resizable()
                                                .frame(width: 28, height: 28)
                                        } else {
                                            Image(systemName: "macwindow")
                                                .font(.system(size: 20))
                                                .foregroundColor(.white.opacity(0.7))
                                                .frame(width: 28, height: 28)
                                        }
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(win.title)
                                                .font(.system(size: 12, weight: .semibold))
                                                .foregroundColor(.white)
                                                .lineLimit(1)
                                            Text("\(win.appName) • \(Int(win.frame.width))×\(Int(win.frame.height))")
                                                .font(.system(size: 10.5))
                                                .foregroundColor(.white.opacity(0.55))
                                                .lineLimit(1)
                                        }
                                    }
                                    .frame(width: 210, alignment: .leading)
                                    .padding(10)
                                    .background(
                                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                                            .fill(isSelected ? Color(red: 0.32, green: 0.40, blue: 0.92).opacity(0.32) : Color.white.opacity(0.05))
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                                            .stroke(isSelected ? Color(red: 0.45, green: 0.56, blue: 1.0) : Color.white.opacity(0.1), lineWidth: isSelected ? 1.5 : 1)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
        }
    }

    private func emptySourcePlaceholder(text: String) -> some View {
        HStack {
            Image(systemName: "sparkles.tv")
                .foregroundColor(.white.opacity(0.45))
            Text(text)
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.6))
            Spacer()
        }
        .padding(14)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: - Camera, Microphone & System Audio Section

    private var deviceAndAudioSection: some View {
        HStack(spacing: 12) {
            // Webcam Card
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Toggle(isOn: $webcamAudio.isWebcamEnabled) {
                        Label("Webcam Overlay", systemImage: "video.fill")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundColor(.white)
                    }
                    .toggleStyle(.switch)
                    .controlSize(.small)

                    Spacer()

                    if let camImg = webcamAudio.latestWebcamImage, webcamAudio.isWebcamEnabled {
                        Image(decorative: camImg, scale: 1.0)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 34, height: 34)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(Color.white.opacity(0.6), lineWidth: 1)
                            )
                    }
                }

                Picker("Camera", selection: $webcamAudio.selectedCameraID) {
                    if webcamAudio.availableCameras.isEmpty {
                        Text("Default FaceTime Camera").tag(Optional<String>.none)
                    } else {
                        ForEach(webcamAudio.availableCameras) { cam in
                            Text(cam.name).tag(Optional(cam.id))
                        }
                    }
                }
                .labelsHidden()
                .controlSize(.small)
                .disabled(!webcamAudio.isWebcamEnabled)
            }
            .padding(12)
            .frame(maxWidth: .infinity)
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            // Microphone + System Audio Card
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Toggle(isOn: $webcamAudio.isMicrophoneEnabled) {
                        Label("Microphone", systemImage: "mic.fill")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundColor(.white)
                    }
                    .toggleStyle(.switch)
                    .controlSize(.small)

                    Spacer()

                    // Live Mic Level Meter
                    HStack(spacing: 2) {
                        ForEach(0..<8, id: \.self) { bar in
                            let threshold = Float(bar) / 8.0
                            let active = webcamAudio.isMicrophoneEnabled && webcamAudio.microphoneLevel > threshold
                            RoundedRectangle(cornerRadius: 1.5)
                                .fill(bar > 5 ? Color.orange : Color.green)
                                .opacity(active ? 1.0 : 0.2)
                                .frame(width: 3, height: 12)
                        }
                    }
                }

                HStack(spacing: 8) {
                    Picker("Mic", selection: $webcamAudio.selectedMicrophoneID) {
                        if webcamAudio.availableMicrophones.isEmpty {
                            Text("Default Microphone").tag(Optional<String>.none)
                        } else {
                            ForEach(webcamAudio.availableMicrophones) { mic in
                                Text(mic.name).tag(Optional(mic.id))
                            }
                        }
                    }
                    .labelsHidden()
                    .controlSize(.small)
                    .disabled(!webcamAudio.isMicrophoneEnabled)

                    Toggle("System Audio", isOn: $recorder.captureSystemAudio)
                        .toggleStyle(.checkbox)
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.85))
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity)
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    // MARK: - Smart Studio Toggles

    private var smartStudioTogglesSection: some View {
        HStack(spacing: 14) {
            studioFeaturePill(
                icon: "plus.magnifyingglass",
                title: "Auto-Zoom on Clicks",
                subtitle: "Creates smooth zoom keyframes",
                isOn: $recorder.autoZoomOnClicks
            )

            studioFeaturePill(
                icon: "cursorarrow.motionlines",
                title: "Smooth Studio Cursor",
                subtitle: "Vector scaling, ripples & blur",
                isOn: $recorder.hideSystemCursorForCustomRender
            )
        }
    }

    private func studioFeaturePill(
        icon: String,
        title: String,
        subtitle: String,
        isOn: Binding<Bool>
    ) -> some View {
        Button {
            isOn.wrappedValue.toggle()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(isOn.wrappedValue ? Color(red: 0.45, green: 0.65, blue: 1.0) : .white.opacity(0.4))
                    .frame(width: 32, height: 32)
                    .background(isOn.wrappedValue ? Color.blue.opacity(0.2) : Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                    Text(subtitle)
                        .font(.system(size: 10.5))
                        .foregroundColor(.white.opacity(0.55))
                }

                Spacer()

                Image(systemName: isOn.wrappedValue ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 16))
                    .foregroundColor(isOn.wrappedValue ? Color(red: 0.40, green: 0.62, blue: 1.0) : .white.opacity(0.3))
            }
            .padding(10)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(isOn.wrappedValue ? Color.blue.opacity(0.45) : Color.white.opacity(0.08), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Active Recording Panel

    private var activeRecordingPanel: some View {
        VStack(spacing: 18) {
            HStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(Color.red.opacity(0.25))
                        .frame(width: 48, height: 48)
                    Circle()
                        .fill(recorder.isPaused ? Color.orange : Color.red)
                        .frame(width: 18, height: 18)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(recorder.isPaused ? "RECORDING PAUSED" : "RECORDING IN PROGRESS")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(recorder.isPaused ? .orange : .red)
                        .tracking(0.8)

                    Text(formatDuration(recorder.elapsedSeconds))
                        .font(.system(size: 32, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                }

                Spacer()

                if let liveImg = recorder.livePreviewFrame {
                    Image(decorative: liveImg, scale: 1.0)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 160, height: 96)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                }
            }

            Text("Click anywhere on your screen while recording — ScreenStudio tracks your cursor at 120Hz and automatically builds smooth zoom keyframes around your clicks.")
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.68))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
        }
        .padding(26)
    }

    // MARK: - Bottom Action Bar

    private var bottomActionBar: some View {
        HStack(spacing: 12) {
            if !recorder.isRecording {
                Button {
                    isGeneratingDemo = true
                    Task {
                        await viewModel.loadInteractiveDemo()
                        isGeneratingDemo = false
                    }
                } label: {
                    HStack(spacing: 7) {
                        if isGeneratingDemo {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: "wand.and.stars")
                        }
                        Text(isGeneratingDemo ? "Building Demo Recording..." : "Load Interactive Demo Project")
                            .font(.system(size: 12.5, weight: .semibold))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(Color.white.opacity(0.09))
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(isGeneratingDemo || isStartingRecording)

                Spacer()

                Button {
                    startCaptureAction()
                } label: {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 10, height: 10)
                        Text(isStartingRecording ? "Starting..." : "Start Recording")
                            .font(.system(size: 13.5, weight: .bold))
                    }
                    .padding(.horizontal, 22)
                    .padding(.vertical, 10)
                    .background(
                        LinearGradient(
                            colors: [Color(red: 0.95, green: 0.24, blue: 0.30), Color(red: 0.85, green: 0.16, blue: 0.42)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                    .shadow(color: Color.red.opacity(0.4), radius: 10, x: 0, y: 4)
                }
                .buttonStyle(.plain)
                .disabled(isStartingRecording || isGeneratingDemo)
            } else {
                Button {
                    recorder.togglePause()
                } label: {
                    Label(recorder.isPaused ? "Resume" : "Pause", systemImage: recorder.isPaused ? "play.fill" : "pause.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 9)
                        .background(Color.white.opacity(0.12))
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    Task {
                        if let newProj = await recorder.stopRecordingAndBuildProject() {
                            viewModel.loadProject(newProj)
                        }
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "stop.fill")
                        Text("Finish & Open in Studio Editor")
                            .font(.system(size: 13.5, weight: .bold))
                    }
                    .padding(.horizontal, 22)
                    .padding(.vertical, 10)
                    .background(Color(red: 0.35, green: 0.45, blue: 0.98))
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 14)
        .background(Color.black.opacity(0.22))
    }

    private func startCaptureAction() {
        localErrorMessage = nil
        isStartingRecording = true
        Task {
            do {
                try await recorder.startRecording()
            } catch {
                localErrorMessage = error.localizedDescription
            }
            isStartingRecording = false
        }
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        let tenths = Int((seconds - floor(seconds)) * 10)
        return String(format: "%02d:%02d.%d", mins, secs, tenths)
    }
}
