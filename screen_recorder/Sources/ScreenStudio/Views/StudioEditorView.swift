import SwiftUI
import AppKit
import UniformTypeIdentifiers

public struct StudioEditorView: View {
    @ObservedObject var viewModel: StudioEditorViewModel
    @ObservedObject var exportEngine: VideoExportEngine

    @State private var showExportModal: Bool = false

    public init(viewModel: StudioEditorViewModel) {
        self.viewModel = viewModel
        self.exportEngine = viewModel.exportEngine
    }

    public var body: some View {
        ZStack {
            Color(red: 0.06, green: 0.07, blue: 0.10)
                .ignoresSafeArea()

            if viewModel.project != nil {
                VStack(spacing: 0) {
                    topStudioToolbar

                    Divider().overlay(Color.white.opacity(0.08))

                    HStack(spacing: 0) {
                        centerCanvasStage
                            .frame(maxWidth: .infinity, maxHeight: .infinity)

                        Divider().overlay(Color.white.opacity(0.08))

                        InspectorSidebarView(viewModel: viewModel)
                    }

                    Divider().overlay(Color.white.opacity(0.08))

                    TimelineEditorView(viewModel: viewModel)
                }
            } else {
                // Welcome / Recorder Launchpad
                RecorderHUDView(viewModel: viewModel)
                    .padding(32)
            }

            // Floating Recorder HUD Modal when "New Recording" is clicked from Editor
            if viewModel.isShowingRecorderSheet && viewModel.project != nil {
                Color.black.opacity(0.62)
                    .ignoresSafeArea()
                    .onTapGesture {
                        if !viewModel.recorderEngine.isRecording {
                            viewModel.isShowingRecorderSheet = false
                        }
                    }

                RecorderHUDView(viewModel: viewModel)
                    .transition(.scale(scale: 0.95).combined(with: .opacity))
            }

            // Export Progress / Completion Modal
            if showExportModal {
                exportOverlayModal
            }
        }
        .frame(minWidth: 1120, minHeight: 740)
    }

    // MARK: - Top Studio Toolbar

    private var topStudioToolbar: some View {
        HStack(spacing: 14) {
            // App Logo & Project Title
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.42, green: 0.35, blue: 0.98), Color(red: 0.88, green: 0.32, blue: 0.58)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 28, height: 28)
                    Image(systemName: "sparkles.tv.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                }

                if let proj = viewModel.project {
                    TextField(
                        "Project Title",
                        text: Binding(
                            get: { proj.title },
                            set: { viewModel.project?.title = $0 }
                        )
                    )
                    .textFieldStyle(.plain)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .frame(width: 220)
                }
            }

            Divider()
                .frame(height: 18)
                .overlay(Color.white.opacity(0.12))

            // New Recording Button
            Button {
                viewModel.pausePlayback()
                viewModel.isShowingRecorderSheet = true
            } label: {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                    Text("New Recording")
                        .font(.system(size: 12, weight: .semibold))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.08))
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)

            Spacer()

            // Quick Canvas Info Pills
            if let proj = viewModel.project {
                HStack(spacing: 8) {
                    Label(proj.canvasStyle.aspectRatio.shortLabel, systemImage: "aspectratio")
                        .font(.system(size: 11.5, weight: .medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.white.opacity(0.06))
                        .foregroundColor(.white.opacity(0.8))
                        .clipShape(Capsule())

                    Label("\(proj.exportSettings.resolution.rawValue) • \(proj.exportSettings.frameRate)fps", systemImage: "film.stack")
                        .font(.system(size: 11.5, weight: .medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.white.opacity(0.06))
                        .foregroundColor(.white.opacity(0.8))
                        .clipShape(Capsule())
                }
            }

            Spacer()

            // Export MP4 Button
            Button {
                promptAndStartExport()
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: "square.and.arrow.up.fill")
                        .font(.system(size: 12, weight: .bold))
                    Text("Export Video")
                        .font(.system(size: 12.5, weight: .bold))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 7)
                .background(
                    LinearGradient(
                        colors: [Color(red: 0.36, green: 0.46, blue: 0.98), Color(red: 0.56, green: 0.36, blue: 0.96)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .shadow(color: Color.blue.opacity(0.35), radius: 8, x: 0, y: 3)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(Color(red: 0.09, green: 0.10, blue: 0.14))
    }

    // MARK: - Center Interactive Canvas Stage

    private var centerCanvasStage: some View {
        ZStack {
            // Subtle dark studio radial backdrop
            RadialGradient(
                colors: [
                    Color(red: 0.12, green: 0.14, blue: 0.20),
                    Color(red: 0.06, green: 0.07, blue: 0.10)
                ],
                center: .center,
                startRadius: 20,
                endRadius: 520
            )

            VStack(spacing: 12) {
                if viewModel.isPickingZoomTargetOnCanvas {
                    HStack(spacing: 8) {
                        Image(systemName: "scope")
                            .foregroundColor(.orange)
                        Text("Click anywhere on the preview frame to set the manual zoom focus point")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white)
                        Button("Cancel") {
                            viewModel.isPickingZoomTargetOnCanvas = false
                        }
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.orange)
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Color.black.opacity(0.75))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Color.orange.opacity(0.6), lineWidth: 1))
                }

                GeometryReader { geo in
                    ZStack {
                        if let cgImg = viewModel.compositedPreviewImage {
                            let imgAspect = CGFloat(cgImg.width) / max(1, CGFloat(cgImg.height))
                            let containerAspect = geo.size.width / max(1, geo.size.height)
                            let fittedSize: CGSize = {
                                if imgAspect > containerAspect {
                                    let w = max(100, geo.size.width - 36)
                                    return CGSize(width: w, height: w / imgAspect)
                                } else {
                                    let h = max(100, geo.size.height - 24)
                                    return CGSize(width: h * imgAspect, height: h)
                                }
                            }()

                            ZStack {
                                Image(decorative: cgImg, scale: 1.0)
                                    .resizable()
                                    .interpolation(.high)
                                    .frame(width: fittedSize.width, height: fittedSize.height)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(
                                                viewModel.isPickingZoomTargetOnCanvas ? Color.orange : Color.white.opacity(0.14),
                                                lineWidth: viewModel.isPickingZoomTargetOnCanvas ? 2 : 1
                                            )
                                    )
                                    .shadow(color: Color.black.opacity(0.55), radius: 24, x: 0, y: 12)
                                    .gesture(
                                        DragGesture(minimumDistance: 0)
                                            .onEnded { value in
                                                let normX = min(max(value.location.x / max(1, fittedSize.width), 0.0), 1.0)
                                                let normY = min(max(value.location.y / max(1, fittedSize.height), 0.0), 1.0)
                                                if viewModel.isPickingZoomTargetOnCanvas {
                                                    viewModel.setManualTargetPointForSelectedSegment(CGPoint(x: normX, y: normY))
                                                }
                                            }
                                    )
                                    .simultaneousGesture(
                                        TapGesture(count: 2)
                                            .onEnded {
                                                // Double-click canvas to add zoom at current time
                                                viewModel.addZoomSegment(at: viewModel.currentTime)
                                            }
                                    )
                            }
                            .frame(width: geo.size.width, height: geo.size.height)
                        } else {
                            ProgressView("Rendering Studio Canvas...")
                                .foregroundColor(.white.opacity(0.7))
                                .frame(width: geo.size.width, height: geo.size.height)
                        }
                    }
                }

                // Helpful hint footer below preview
                HStack(spacing: 16) {
                    Label("Double-click canvas or click '+ Add Zoom' to insert zoom keyframe", systemImage: "hand.tap")
                    Text("•")
                    Label("Drag purple zoom blocks on timeline to adjust timing", systemImage: "timeline.selection")
                }
                .font(.system(size: 11))
                .foregroundColor(.white.opacity(0.42))
                .padding(.bottom, 6)
            }
            .padding(14)
        }
    }

    // MARK: - Export Action & Modal

    private func promptAndStartExport() {
        guard let proj = viewModel.project else { return }
        viewModel.pausePlayback()

        let savePanel = NSSavePanel()
        savePanel.title = "Export ScreenStudio Video"
        savePanel.allowedContentTypes = [.mpeg4Movie, .quickTimeMovie]
        let cleanTitle = proj.title.replacingOccurrences(of: " ", with: "_").replacingOccurrences(of: ":", with: "-")
        savePanel.nameFieldStringValue = "\(cleanTitle).mp4"
        savePanel.canCreateDirectories = true

        let response = savePanel.runModal()
        if response == .OK, let targetURL = savePanel.url {
            showExportModal = true
            exportEngine.exportProject(proj, to: targetURL)
        }
    }

    private var exportOverlayModal: some View {
        ZStack {
            Color.black.opacity(0.68)
                .ignoresSafeArea()

            VStack(spacing: 18) {
                HStack {
                    Image(systemName: exportEngine.isExporting ? "gearshape.2.fill" : (exportEngine.exportError != nil ? "exclamationmark.triangle.fill" : "checkmark.seal.fill"))
                        .font(.system(size: 24))
                        .foregroundColor(exportEngine.isExporting ? .blue : (exportEngine.exportError != nil ? .red : .green))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(exportEngine.isExporting ? "Exporting Studio Video..." : (exportEngine.exportError != nil ? "Export Failed" : "Video Export Complete"))
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                        Text(exportEngine.statusMessage)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.68))
                    }
                    Spacer()
                }

                if exportEngine.isExporting {
                    ProgressView(value: exportEngine.progress, total: 1.0)
                        .progressViewStyle(.linear)
                        .tint(Color(red: 0.42, green: 0.54, blue: 1.0))
                }

                if let err = exportEngine.exportError {
                    Text(err)
                        .font(.system(size: 12))
                        .foregroundColor(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                HStack(spacing: 12) {
                    Spacer()

                    if exportEngine.isExporting {
                        Button("Cancel") {
                            exportEngine.cancelExport()
                            showExportModal = false
                        }
                        .buttonStyle(.bordered)
                    } else {
                        if let exportedURL = exportEngine.lastExportedURL {
                            Button {
                                NSWorkspace.shared.activateFileViewerSelecting([exportedURL])
                            } label: {
                                Label("Reveal in Finder", systemImage: "folder.fill")
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 0.36, green: 0.46, blue: 0.98))

                            Button {
                                NSWorkspace.shared.open(exportedURL)
                            } label: {
                                Label("Play Video", systemImage: "play.circle.fill")
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                            }
                            .buttonStyle(.bordered)
                        }

                        Button("Done") {
                            showExportModal = false
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            .padding(24)
            .frame(width: 440)
            .background(Color(red: 0.11, green: 0.12, blue: 0.17))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.15), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.6), radius: 30, x: 0, y: 15)
        }
    }
}
