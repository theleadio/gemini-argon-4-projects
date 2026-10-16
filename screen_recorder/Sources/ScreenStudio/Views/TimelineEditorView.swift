import SwiftUI
import AppKit

public struct TimelineEditorView: View {
    @ObservedObject var viewModel: StudioEditorViewModel

    @State private var draggingZoomID: UUID?
    @State private var zoomDragInitialStart: TimeInterval = 0
    @State private var zoomDragInitialEnd: TimeInterval = 0
    @State private var isDraggingLeftTrim: Bool = false
    @State private var isDraggingRightTrim: Bool = false

    private let trackHeaderWidth: CGFloat = 116

    public init(viewModel: StudioEditorViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            timelineControlBar

            Divider().overlay(Color.white.opacity(0.08))

            if let proj = viewModel.project {
                HStack(spacing: 0) {
                    trackLabelsColumn(project: proj)

                    Divider().overlay(Color.white.opacity(0.08))

                    GeometryReader { geo in
                        let width = max(100, geo.size.width - 28)
                        ZStack(alignment: .topLeading) {
                            VStack(spacing: 6) {
                                // Time Ruler
                                timeRulerView(duration: proj.duration, width: width)
                                    .frame(height: 22)

                                // Track 1: Video Filmstrip + Trim Handles
                                videoFilmstripTrack(project: proj, width: width)
                                    .frame(height: 46)

                                // Track 2: Click Telemetry Markers
                                clickEventsTrack(project: proj, width: width)
                                    .frame(height: 24)

                                // Track 3: Interactive Zoom Segments Track
                                zoomSegmentsTrack(project: proj, width: width)
                                    .frame(height: 44)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)

                            // Playhead Line Overlay
                            playheadOverlay(duration: proj.duration, width: width, height: geo.size.height)
                        }
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { value in
                                    guard draggingZoomID == nil && !isDraggingLeftTrim && !isDraggingRightTrim else { return }
                                    let localX = value.location.x - 14
                                    let fraction = min(max(localX / width, 0.0), 1.0)
                                    let targetTime = Double(fraction) * proj.duration
                                    if viewModel.isPlaying {
                                        viewModel.pausePlayback()
                                    }
                                    viewModel.seek(to: targetTime)
                                }
                        )
                    }
                }
                .frame(height: 164)
                .background(Color(red: 0.07, green: 0.08, blue: 0.11))
            }
        }
        .background(Color(red: 0.09, green: 0.10, blue: 0.14))
    }

    // MARK: - Top Control Bar

    private var timelineControlBar: some View {
        HStack(spacing: 14) {
            // Transport Controls
            HStack(spacing: 8) {
                Button {
                    if let proj = viewModel.project {
                        viewModel.seek(to: proj.trimStart, forceExtract: true)
                    }
                } label: {
                    Image(systemName: "backward.end.fill")
                        .font(.system(size: 12))
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.07))
                        .foregroundColor(.white.opacity(0.85))
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(.plain)
                .help("Jump to Trim Start")

                Button {
                    viewModel.togglePlayPause()
                } label: {
                    Image(systemName: viewModel.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 13, weight: .bold))
                        .frame(width: 34, height: 28)
                        .background(Color(red: 0.36, green: 0.46, blue: 0.98))
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.space, modifiers: [])
                .help("Play / Pause (Space)")

                Button {
                    viewModel.isLooping.toggle()
                } label: {
                    Image(systemName: "repeat")
                        .font(.system(size: 12, weight: .semibold))
                        .frame(width: 28, height: 28)
                        .background(viewModel.isLooping ? Color.blue.opacity(0.25) : Color.white.opacity(0.07))
                        .foregroundColor(viewModel.isLooping ? Color(red: 0.5, green: 0.7, blue: 1.0) : .white.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(.plain)
                .help("Toggle Loop Playback")
            }

            // Timecode Readout
            if let proj = viewModel.project {
                HStack(spacing: 4) {
                    Text(formatTimestamp(viewModel.currentTime))
                        .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                    Text("/")
                        .foregroundColor(.white.opacity(0.35))
                    Text(formatTimestamp(proj.duration))
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.6))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                // Current Live Zoom Factor Badge
                HStack(spacing: 4) {
                    Image(systemName: "viewfinder")
                        .font(.system(size: 11))
                    Text(String(format: "%.2fx", viewModel.currentCameraState.zoomScale))
                        .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                }
                .foregroundColor(viewModel.currentCameraState.zoomScale > 1.05 ? Color(red: 0.65, green: 0.55, blue: 1.0) : .white.opacity(0.5))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.white.opacity(0.05))
                .clipShape(Capsule())
            }

            Spacer()

            // Zoom Segment Actions
            HStack(spacing: 10) {
                Button {
                    viewModel.addZoomSegment(at: viewModel.currentTime)
                } label: {
                    Label("Add Zoom at Playhead", systemImage: "plus.magnifyingglass")
                        .font(.system(size: 11.5, weight: .semibold))
                        .padding(.horizontal, 11)
                        .padding(.vertical, 6)
                        .background(Color(red: 0.45, green: 0.34, blue: 0.92).opacity(0.35))
                        .foregroundColor(Color(red: 0.78, green: 0.72, blue: 1.0))
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .stroke(Color(red: 0.55, green: 0.45, blue: 1.0).opacity(0.5), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button {
                    viewModel.regenerateAutoZooms()
                } label: {
                    Label("Auto-Zoom from Clicks", systemImage: "wand.and.stars")
                        .font(.system(size: 11.5, weight: .medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.white.opacity(0.07))
                        .foregroundColor(.white.opacity(0.85))
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(.plain)

                if viewModel.selectedZoomSegmentID != nil {
                    Button {
                        viewModel.deleteSelectedZoomSegment()
                    } label: {
                        Label("Delete Zoom", systemImage: "trash")
                            .font(.system(size: 11.5, weight: .medium))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.red.opacity(0.18))
                            .foregroundColor(Color(red: 1.0, green: 0.45, blue: 0.45))
                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // MARK: - Left Track Labels Column

    private func trackLabelsColumn(project: RecordingProject) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TIMELINE")
                .font(.system(size: 9.5, weight: .bold))
                .foregroundColor(.white.opacity(0.4))
                .frame(height: 22, alignment: .leading)

            HStack(spacing: 6) {
                Image(systemName: "film")
                    .font(.system(size: 11))
                    .foregroundColor(.orange)
                Text("Screen Clip")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundColor(.white.opacity(0.85))
            }
            .frame(height: 46, alignment: .leading)

            HStack(spacing: 6) {
                Image(systemName: "cursorarrow.click.2")
                    .font(.system(size: 11))
                    .foregroundColor(.cyan)
                Text("Clicks (\(project.telemetry.clicks.count))")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))
            }
            .frame(height: 24, alignment: .leading)

            HStack(spacing: 6) {
                Image(systemName: "plus.magnifyingglass")
                    .font(.system(size: 11))
                    .foregroundColor(Color(red: 0.65, green: 0.50, blue: 1.0))
                Text("Zoom (\(project.zoomSegments.count))")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundColor(.white.opacity(0.85))
            }
            .frame(height: 44, alignment: .leading)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(width: trackHeaderWidth, alignment: .leading)
        .background(Color.black.opacity(0.2))
    }

    // MARK: - Time Ruler

    private func timeRulerView(duration: TimeInterval, width: CGFloat) -> some View {
        Canvas { ctx, size in
            let step: TimeInterval = duration <= 12 ? 1.0 : (duration <= 30 ? 2.0 : 5.0)
            let subStep = step / 2.0
            var t: TimeInterval = 0
            while t <= duration + 0.001 {
                let x = CGFloat(t / max(0.1, duration)) * width
                let isMajor = abs(t.remainder(dividingBy: step)) < 0.01

                var path = Path()
                path.move(to: CGPoint(x: x, y: isMajor ? 4 : 12))
                path.addLine(to: CGPoint(x: x, y: size.height))
                ctx.stroke(path, with: .color(.white.opacity(isMajor ? 0.35 : 0.16)), lineWidth: 1)

                if isMajor {
                    let label = Text(String(format: "%.0fs", t))
                        .font(.system(size: 9.5, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))
                    ctx.draw(label, at: CGPoint(x: min(max(12, x + 14), width - 14), y: 8))
                }
                t += subStep
            }
        }
    }

    // MARK: - Track 1: Video Filmstrip & Trim Handles

    private func videoFilmstripTrack(project: RecordingProject, width: CGFloat) -> some View {
        let trimStartX = CGFloat(project.trimStart / max(0.1, project.duration)) * width
        let trimEndX = CGFloat(project.trimEnd / max(0.1, project.duration)) * width

        return ZStack(alignment: .leading) {
            // Base filmstrip container
            HStack(spacing: 1) {
                if viewModel.filmstripThumbnails.isEmpty {
                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                } else {
                    ForEach(Array(viewModel.filmstripThumbnails.enumerated()), id: \.offset) { _, img in
                        Image(nsImage: img)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity, maxHeight: 44)
                            .clipped()
                    }
                }
            }
            .frame(width: width, height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
            )

            // Dimmed trimmed-out regions
            if trimStartX > 1 {
                Rectangle()
                    .fill(Color.black.opacity(0.68))
                    .frame(width: trimStartX, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            if width - trimEndX > 1 {
                Rectangle()
                    .fill(Color.black.opacity(0.68))
                    .frame(width: max(0, width - trimEndX), height: 44)
                    .offset(x: trimEndX)
            }

            // Active Trim Range Border
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.orange.opacity(0.85), lineWidth: 2)
                .frame(width: max(12, trimEndX - trimStartX), height: 44)
                .offset(x: trimStartX)

            // Left Trim Handle
            trimHandleView(isLeft: true)
                .offset(x: max(0, trimStartX - 6))
                .gesture(
                    DragGesture()
                        .onChanged { val in
                            isDraggingLeftTrim = true
                            let newX = min(max(0, val.location.x), trimEndX - 24)
                            let newStart = Double(newX / width) * project.duration
                            viewModel.project?.trimStart = max(0, newStart)
                            viewModel.seek(to: max(0, newStart))
                        }
                        .onEnded { _ in
                            isDraggingLeftTrim = false
                        }
                )

            // Right Trim Handle
            trimHandleView(isLeft: false)
                .offset(x: min(width - 12, trimEndX - 6))
                .gesture(
                    DragGesture()
                        .onChanged { val in
                            isDraggingRightTrim = true
                            let newX = max(trimStartX + 24, min(width, val.location.x))
                            let newEnd = Double(newX / width) * project.duration
                            viewModel.project?.trimEnd = min(project.duration, newEnd)
                            viewModel.seek(to: min(project.duration, newEnd))
                        }
                        .onEnded { _ in
                            isDraggingRightTrim = false
                        }
                )
        }
    }

    private func trimHandleView(isLeft: Bool) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(Color.orange)
                .frame(width: 12, height: 46)
            RoundedRectangle(cornerRadius: 1)
                .fill(Color.black.opacity(0.65))
                .frame(width: 2, height: 18)
        }
        .help(isLeft ? "Drag to trim start" : "Drag to trim end")
    }

    // MARK: - Track 2: Click Telemetry Markers

    private func clickEventsTrack(project: RecordingProject, width: CGFloat) -> some View {
        ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.white.opacity(0.03))
                .frame(width: width, height: 22)

            ForEach(project.telemetry.clicks) { click in
                let xPos = CGFloat(click.time / max(0.1, project.duration)) * width
                Button {
                    viewModel.seek(to: click.time, forceExtract: true)
                } label: {
                    ZStack {
                        Circle()
                            .fill(Color.cyan.opacity(0.28))
                            .frame(width: 16, height: 16)
                        Circle()
                            .fill(Color.cyan)
                            .frame(width: 7, height: 7)
                    }
                }
                .buttonStyle(.plain)
                .position(x: min(max(8, xPos), width - 8), y: 11)
                .help(String(format: "Click at %.2fs — Click to seek", click.time))
            }
        }
    }

    // MARK: - Track 3: Interactive Zoom Segments Track

    private func zoomSegmentsTrack(project: RecordingProject, width: CGFloat) -> some View {
        ZStack(alignment: .leading) {
            // Track background
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.white.opacity(0.04))
                .frame(width: width, height: 42)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.white.opacity(0.07), lineWidth: 1)
                )

            if project.zoomSegments.isEmpty {
                Text("No zoom segments — Click '+ Add Zoom at Playhead' or 'Auto-Zoom from Clicks'")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.35))
                    .frame(width: width, alignment: .center)
            }

            ForEach(project.zoomSegments) { segment in
                zoomSegmentBlock(segment: segment, duration: project.duration, trackWidth: width)
            }
        }
    }

    private func zoomSegmentBlock(
        segment: ZoomSegment,
        duration: TimeInterval,
        trackWidth: CGFloat
    ) -> some View {
        let isSelected = viewModel.selectedZoomSegmentID == segment.id
        let startX = CGFloat(segment.startTime / max(0.1, duration)) * trackWidth
        let endX = CGFloat(segment.endTime / max(0.1, duration)) * trackWidth
        let blockWidth = max(28, endX - startX)

        return ZStack(alignment: .leading) {
            // Block Body with Ease-in / Ease-out Envelope Curve
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: isSelected
                                ? [Color(red: 0.48, green: 0.36, blue: 0.98), Color(red: 0.62, green: 0.35, blue: 0.94)]
                                : [Color(red: 0.34, green: 0.27, blue: 0.74).opacity(0.85), Color(red: 0.44, green: 0.28, blue: 0.78).opacity(0.85)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                // Subtle S-curve zoom ramp visualization inside block
                Canvas { ctx, size in
                    var path = Path()
                    let rampW = min(22.0, size.width * 0.28)
                    path.move(to: CGPoint(x: 0, y: size.height))
                    path.addCurve(
                        to: CGPoint(x: rampW, y: 6),
                        control1: CGPoint(x: rampW * 0.45, y: size.height),
                        control2: CGPoint(x: rampW * 0.55, y: 6)
                    )
                    path.addLine(to: CGPoint(x: size.width - rampW, y: 6))
                    path.addCurve(
                        to: CGPoint(x: size.width, y: size.height),
                        control1: CGPoint(x: size.width - rampW * 0.55, y: 6),
                        control2: CGPoint(x: size.width - rampW * 0.45, y: size.height)
                    )
                    ctx.stroke(path, with: .color(.white.opacity(0.32)), lineWidth: 1.5)
                }

                // Label
                HStack(spacing: 5) {
                    Image(systemName: segment.targetMode == .followCursor ? "cursorarrow.motionlines" : "scope")
                        .font(.system(size: 10, weight: .bold))
                    Text(String(format: "%.1fx", segment.zoomScale))
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 10)
                .lineLimit(1)
            }
            .frame(width: blockWidth, height: 38)
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(isSelected ? Color.white : Color.white.opacity(0.22), lineWidth: isSelected ? 2 : 1)
            )
            // Dragging center body moves the entire zoom segment
            .gesture(
                DragGesture(minimumDistance: 2)
                    .onChanged { value in
                        if draggingZoomID != segment.id {
                            draggingZoomID = segment.id
                            zoomDragInitialStart = segment.startTime
                            zoomDragInitialEnd = segment.endTime
                            viewModel.selectedZoomSegmentID = segment.id
                        }
                        let deltaSeconds = Double(value.translation.width / trackWidth) * duration
                        let segLen = zoomDragInitialEnd - zoomDragInitialStart
                        let newStart = min(max(0.0, zoomDragInitialStart + deltaSeconds), max(0, duration - segLen))
                        var updated = segment
                        updated.startTime = newStart
                        updated.endTime = newStart + segLen
                        viewModel.updateZoomSegment(updated)
                    }
                    .onEnded { _ in
                        draggingZoomID = nil
                    }
            )
            .simultaneousGesture(
                TapGesture()
                    .onEnded {
                        viewModel.selectedZoomSegmentID = segment.id
                    }
            )

            // Left Edge Resize Handle
            Rectangle()
                .fill(Color.white.opacity(0.001))
                .frame(width: 10, height: 38)
                .overlay(
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(Color.white.opacity(isSelected ? 0.85 : 0.35))
                        .frame(width: 3, height: 16)
                )
                .gesture(
                    DragGesture(minimumDistance: 1)
                        .onChanged { value in
                            if draggingZoomID != segment.id {
                                draggingZoomID = segment.id
                                zoomDragInitialStart = segment.startTime
                                zoomDragInitialEnd = segment.endTime
                                viewModel.selectedZoomSegmentID = segment.id
                            }
                            let deltaSeconds = Double(value.translation.width / trackWidth) * duration
                            let newStart = min(max(0.0, zoomDragInitialStart + deltaSeconds), zoomDragInitialEnd - 0.35)
                            var updated = segment
                            updated.startTime = newStart
                            viewModel.updateZoomSegment(updated)
                        }
                        .onEnded { _ in
                            draggingZoomID = nil
                        }
                )

            // Right Edge Resize Handle
            Rectangle()
                .fill(Color.white.opacity(0.001))
                .frame(width: 10, height: 38)
                .overlay(
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(Color.white.opacity(isSelected ? 0.85 : 0.35))
                        .frame(width: 3, height: 16)
                )
                .offset(x: blockWidth - 10)
                .gesture(
                    DragGesture(minimumDistance: 1)
                        .onChanged { value in
                            if draggingZoomID != segment.id {
                                draggingZoomID = segment.id
                                zoomDragInitialStart = segment.startTime
                                zoomDragInitialEnd = segment.endTime
                                viewModel.selectedZoomSegmentID = segment.id
                            }
                            let deltaSeconds = Double(value.translation.width / trackWidth) * duration
                            let newEnd = max(zoomDragInitialStart + 0.35, min(duration, zoomDragInitialEnd + deltaSeconds))
                            var updated = segment
                            updated.endTime = newEnd
                            viewModel.updateZoomSegment(updated)
                        }
                        .onEnded { _ in
                            draggingZoomID = nil
                        }
                )
        }
        .offset(x: startX)
        .contextMenu {
            Button("Follow Cursor") {
                var updated = segment
                updated.targetMode = .followCursor
                viewModel.updateZoomSegment(updated)
            }
            Button("Pick Manual Focus Point on Canvas") {
                viewModel.selectedZoomSegmentID = segment.id
                viewModel.isPickingZoomTargetOnCanvas = true
            }
            Divider()
            Button("Delete Zoom Segment", role: .destructive) {
                viewModel.deleteZoomSegment(id: segment.id)
            }
        }
    }

    // MARK: - Playhead Overlay

    private func playheadOverlay(duration: TimeInterval, width: CGFloat, height: CGFloat) -> some View {
        let fraction = CGFloat(viewModel.currentTime / max(0.1, duration))
        let xPos = 14.0 + min(max(fraction, 0.0), 1.0) * width

        return ZStack(alignment: .top) {
            Rectangle()
                .fill(Color.white)
                .frame(width: 2, height: max(20, height - 8))
                .shadow(color: .black.opacity(0.5), radius: 2)

            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(Color.white)
                .frame(width: 12, height: 14)
        }
        .offset(x: xPos - 6, y: 4)
        .allowsHitTesting(false)
    }

    private func formatTimestamp(_ seconds: TimeInterval) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        let hundredths = Int((seconds - floor(seconds)) * 100)
        return String(format: "%02d:%02d.%02d", mins, secs, hundredths)
    }
}
