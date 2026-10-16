import SwiftUI

public enum InspectorTab: String, CaseIterable, Identifiable {
    case canvas = "Canvas"
    case zoom = "Zoom"
    case cursor = "Cursor"
    case webcam = "Camera"

    public var id: String { rawValue }

    public var iconName: String {
        switch self {
        case .canvas: return "paintbrush.pointed.fill"
        case .zoom: return "plus.magnifyingglass"
        case .cursor: return "cursorarrow.motionlines"
        case .webcam: return "video.badge.checkmark"
        }
    }
}

public struct InspectorSidebarView: View {
    @ObservedObject var viewModel: StudioEditorViewModel
    @State private var selectedTab: InspectorTab = .canvas

    public init(viewModel: StudioEditorViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            tabSelectorBar

            Divider().overlay(Color.white.opacity(0.08))

            if viewModel.project != nil {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        switch selectedTab {
                        case .canvas:
                            canvasInspectorSection
                        case .zoom:
                            zoomInspectorSection
                        case .cursor:
                            cursorInspectorSection
                        case .webcam:
                            webcamAndExportInspectorSection
                        }
                    }
                    .padding(16)
                }
            } else {
                Spacer()
            }
        }
        .frame(width: 315)
        .background(Color(red: 0.09, green: 0.10, blue: 0.14))
    }

    // MARK: - Top Tab Selector Bar

    private var tabSelectorBar: some View {
        HStack(spacing: 4) {
            ForEach(InspectorTab.allCases) { tab in
                let isSelected = selectedTab == tab
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.iconName)
                            .font(.system(size: 13, weight: .semibold))
                        Text(tab.rawValue)
                            .font(.system(size: 10.5, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(isSelected ? Color(red: 0.36, green: 0.45, blue: 0.96).opacity(0.28) : Color.clear)
                    )
                    .foregroundColor(isSelected ? Color(red: 0.62, green: 0.72, blue: 1.0) : .white.opacity(0.55))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(8)
        .background(Color.black.opacity(0.18))
    }

    // MARK: - 1. Canvas & Background Inspector

    private var canvasInspectorSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            inspectorCard(title: "WALLPAPER & GRADIENT") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 56), spacing: 8)], spacing: 8) {
                    ForEach(BackgroundPreset.allCases) { preset in
                        let isSelected = viewModel.project?.canvasStyle.backgroundPreset == preset
                        Button {
                            viewModel.project?.canvasStyle.backgroundPreset = preset
                        } label: {
                            VStack(spacing: 4) {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(
                                        LinearGradient(
                                            colors: preset.gradientColors.map { $0.color },
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(height: 36)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .stroke(isSelected ? Color.white : Color.white.opacity(0.15), lineWidth: isSelected ? 2 : 1)
                                    )

                                Text(preset.rawValue.components(separatedBy: " ").first ?? preset.rawValue)
                                    .font(.system(size: 9.5, weight: isSelected ? .bold : .medium))
                                    .foregroundColor(isSelected ? .white : .white.opacity(0.6))
                                    .lineLimit(1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                if viewModel.project?.canvasStyle.backgroundPreset == .customGradient {
                    Divider().overlay(Color.white.opacity(0.08)).padding(.vertical, 4)
                    HStack {
                        ColorPicker(
                            "Start",
                            selection: Binding(
                                get: { viewModel.project?.canvasStyle.customColorStart.color ?? .blue },
                                set: { viewModel.project?.canvasStyle.customColorStart = CodableColor(color: $0) }
                            )
                        )
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.8))

                        Spacer()

                        ColorPicker(
                            "End",
                            selection: Binding(
                                get: { viewModel.project?.canvasStyle.customColorEnd.color ?? .purple },
                                set: { viewModel.project?.canvasStyle.customColorEnd = CodableColor(color: $0) }
                            )
                        )
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.8))
                    }
                }
            }

            inspectorCard(title: "CANVAS DIMENSIONS") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Aspect Ratio")
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(.white.opacity(0.75))

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                        ForEach(AspectRatioPreset.allCases) { ratio in
                            let isSelected = viewModel.project?.canvasStyle.aspectRatio == ratio
                            Button {
                                viewModel.project?.canvasStyle.aspectRatio = ratio
                            } label: {
                                Text(ratio.shortLabel)
                                    .font(.system(size: 11, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 6)
                                    .background(isSelected ? Color(red: 0.36, green: 0.46, blue: 0.98) : Color.white.opacity(0.06))
                                    .foregroundColor(isSelected ? .white : .white.opacity(0.7))
                                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            inspectorCard(title: "FRAME & SHADOW STYLING") {
                sliderRow(
                    label: "Background Padding",
                    valueText: "\(Int(viewModel.project?.canvasStyle.padding ?? 64)) px",
                    value: Binding(
                        get: { Double(viewModel.project?.canvasStyle.padding ?? 64) },
                        set: { viewModel.project?.canvasStyle.padding = CGFloat($0) }
                    ),
                    range: 0...160
                )

                sliderRow(
                    label: "Corner Radius",
                    valueText: "\(Int(viewModel.project?.canvasStyle.cornerRadius ?? 18)) px",
                    value: Binding(
                        get: { Double(viewModel.project?.canvasStyle.cornerRadius ?? 18) },
                        set: { viewModel.project?.canvasStyle.cornerRadius = CGFloat($0) }
                    ),
                    range: 0...44
                )

                sliderRow(
                    label: "Shadow Blur",
                    valueText: "\(Int(viewModel.project?.canvasStyle.shadowRadius ?? 38)) px",
                    value: Binding(
                        get: { Double(viewModel.project?.canvasStyle.shadowRadius ?? 38) },
                        set: { viewModel.project?.canvasStyle.shadowRadius = CGFloat($0) }
                    ),
                    range: 0...70
                )

                sliderRow(
                    label: "Shadow Intensity",
                    valueText: "\(Int((viewModel.project?.canvasStyle.shadowOpacity ?? 0.6) * 100))%",
                    value: Binding(
                        get: { viewModel.project?.canvasStyle.shadowOpacity ?? 0.6 },
                        set: { viewModel.project?.canvasStyle.shadowOpacity = $0 }
                    ),
                    range: 0...1.0
                )

                sliderRow(
                    label: "Glass Rim Highlight",
                    valueText: "\(Int((viewModel.project?.canvasStyle.insetBorderOpacity ?? 0.28) * 100))%",
                    value: Binding(
                        get: { viewModel.project?.canvasStyle.insetBorderOpacity ?? 0.28 },
                        set: { viewModel.project?.canvasStyle.insetBorderOpacity = $0 }
                    ),
                    range: 0...0.85
                )
            }
        }
    }

    // MARK: - 2. Zoom & Camera Physics Inspector

    private var zoomInspectorSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            inspectorCard(title: "CAMERA SPRING PHYSICS") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Zoom Animation Speed")
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(.white.opacity(0.75))

                    HStack(spacing: 6) {
                        ForEach(ZoomSpringSpeed.allCases) { speed in
                            let isSelected = viewModel.project?.zoomSpringSpeed == speed
                            Button {
                                viewModel.project?.zoomSpringSpeed = speed
                            } label: {
                                Text(speed.rawValue)
                                    .font(.system(size: 11, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 6)
                                    .background(isSelected ? Color(red: 0.48, green: 0.36, blue: 0.96) : Color.white.opacity(0.06))
                                    .foregroundColor(isSelected ? .white : .white.opacity(0.7))
                                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                sliderRow(
                    label: "Default Auto-Zoom Scale",
                    valueText: String(format: "%.1fx", viewModel.project?.defaultAutoZoomScale ?? 2.0),
                    value: Binding(
                        get: { Double(viewModel.project?.defaultAutoZoomScale ?? 2.0) },
                        set: { viewModel.project?.defaultAutoZoomScale = CGFloat($0) }
                    ),
                    range: 1.25...3.5
                )

                HStack(spacing: 8) {
                    Button {
                        viewModel.addZoomSegment(at: viewModel.currentTime)
                    } label: {
                        Label("Add Zoom Here", systemImage: "plus")
                            .font(.system(size: 11.5, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(Color(red: 0.45, green: 0.34, blue: 0.92))
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    Button {
                        viewModel.regenerateAutoZooms()
                    } label: {
                        Label("Reset Auto", systemImage: "wand.and.stars")
                            .font(.system(size: 11.5, weight: .medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(Color.white.opacity(0.08))
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }

            if let selectedSeg = viewModel.selectedZoomSegment {
                inspectorCard(title: "SELECTED ZOOM SEGMENT") {
                    HStack {
                        Text(String(format: "%.2fs – %.2fs (%.1fs)", selectedSeg.startTime, selectedSeg.endTime, selectedSeg.duration))
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundColor(Color(red: 0.72, green: 0.65, blue: 1.0))
                        Spacer()
                        if selectedSeg.isAutoGenerated {
                            Text("AUTO")
                                .font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.purple.opacity(0.25))
                                .foregroundColor(.purple)
                                .clipShape(Capsule())
                        }
                    }

                    sliderRow(
                        label: "Zoom Magnification",
                        valueText: String(format: "%.2fx", selectedSeg.zoomScale),
                        value: Binding(
                            get: { Double(selectedSeg.zoomScale) },
                            set: { newVal in
                                var updated = selectedSeg
                                updated.zoomScale = CGFloat(newVal)
                                viewModel.updateZoomSegment(updated)
                            }
                        ),
                        range: 1.2...4.0
                    )

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Camera Tracking Mode")
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundColor(.white.opacity(0.75))

                        Picker("Mode", selection: Binding(
                            get: { selectedSeg.targetMode },
                            set: { newMode in
                                var updated = selectedSeg
                                updated.targetMode = newMode
                                viewModel.updateZoomSegment(updated)
                            }
                        )) {
                            ForEach(ZoomTargetMode.allCases) { mode in
                                Text(mode.rawValue).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                    }

                    if selectedSeg.targetMode == .fixedPoint {
                        Button {
                            viewModel.isPickingZoomTargetOnCanvas.toggle()
                        } label: {
                            HStack {
                                Image(systemName: "scope")
                                Text(viewModel.isPickingZoomTargetOnCanvas ? "Click Anywhere on Preview..." : "Pick Target Point on Canvas")
                                    .font(.system(size: 11.5, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(viewModel.isPickingZoomTargetOnCanvas ? Color.orange : Color.white.opacity(0.1))
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        sliderRow(
                            label: "Target Focus X",
                            valueText: "\(Int(selectedSeg.targetPoint.x * 100))%",
                            value: Binding(
                                get: { Double(selectedSeg.targetPoint.x) },
                                set: { val in
                                    var updated = selectedSeg
                                    updated.targetPoint.x = CGFloat(val)
                                    viewModel.updateZoomSegment(updated)
                                }
                            ),
                            range: 0...1
                        )

                        sliderRow(
                            label: "Target Focus Y",
                            valueText: "\(Int(selectedSeg.targetPoint.y * 100))%",
                            value: Binding(
                                get: { Double(selectedSeg.targetPoint.y) },
                                set: { val in
                                    var updated = selectedSeg
                                    updated.targetPoint.y = CGFloat(val)
                                    viewModel.updateZoomSegment(updated)
                                }
                            ),
                            range: 0...1
                        )
                    }

                    Button(role: .destructive) {
                        viewModel.deleteZoomSegment(id: selectedSeg.id)
                    } label: {
                        Label("Remove Zoom Segment", systemImage: "trash")
                            .font(.system(size: 11.5, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(Color.red.opacity(0.18))
                            .foregroundColor(Color(red: 1.0, green: 0.45, blue: 0.45))
                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                inspectorCard(title: "SELECTED ZOOM SEGMENT") {
                    Text("Click any purple zoom block on the timeline below to customize its magnification and tracking target.")
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.55))
                }
            }
        }
    }

    // MARK: - 3. Cursor & Click Effects Inspector

    private var cursorInspectorSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            inspectorCard(title: "CUSTOM VECTOR CURSOR") {
                Toggle(
                    "Render Smooth Studio Cursor",
                    isOn: Binding(
                        get: { viewModel.project?.cursorStyle.showCustomCursor ?? true },
                        set: { viewModel.project?.cursorStyle.showCustomCursor = $0 }
                    )
                )
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white)
                .toggleStyle(.switch)
                .controlSize(.small)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Cursor Appearance")
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(.white.opacity(0.75))

                    Picker("Shape", selection: Binding(
                        get: { viewModel.project?.cursorStyle.cursorShape ?? .macOSPointer },
                        set: { viewModel.project?.cursorStyle.cursorShape = $0 }
                    )) {
                        ForEach(CursorShapeStyle.allCases) { shape in
                            Text(shape.rawValue).tag(shape)
                        }
                    }
                    .labelsHidden()
                }

                sliderRow(
                    label: "Cursor Size",
                    valueText: String(format: "%.2fx", viewModel.project?.cursorStyle.cursorScale ?? 1.65),
                    value: Binding(
                        get: { Double(viewModel.project?.cursorStyle.cursorScale ?? 1.65) },
                        set: { viewModel.project?.cursorStyle.cursorScale = CGFloat($0) }
                    ),
                    range: 0.8...3.2
                )

                sliderRow(
                    label: "Spring Smoothing",
                    valueText: "\(Int((viewModel.project?.cursorStyle.smoothingFactor ?? 0.68) * 100))%",
                    value: Binding(
                        get: { viewModel.project?.cursorStyle.smoothingFactor ?? 0.68 },
                        set: { viewModel.project?.cursorStyle.smoothingFactor = $0 }
                    ),
                    range: 0.0...0.95
                )

                sliderRow(
                    label: "Motion Blur Trail",
                    valueText: "\(Int((viewModel.project?.cursorStyle.motionBlurStrength ?? 0.55) * 100))%",
                    value: Binding(
                        get: { viewModel.project?.cursorStyle.motionBlurStrength ?? 0.55 },
                        set: { viewModel.project?.cursorStyle.motionBlurStrength = $0 }
                    ),
                    range: 0.0...1.0
                )
            }

            inspectorCard(title: "CLICK INTERACTION EFFECTS") {
                Toggle(
                    "Click Ripple Highlight",
                    isOn: Binding(
                        get: { viewModel.project?.cursorStyle.showClickRipple ?? true },
                        set: { viewModel.project?.cursorStyle.showClickRipple = $0 }
                    )
                )
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white.opacity(0.9))

                if viewModel.project?.cursorStyle.showClickRipple == true {
                    ColorPicker(
                        "Ripple Color",
                        selection: Binding(
                            get: { viewModel.project?.cursorStyle.rippleColor.color ?? .blue },
                            set: { viewModel.project?.cursorStyle.rippleColor = CodableColor(color: $0) }
                        )
                    )
                    .font(.system(size: 11.5))
                    .foregroundColor(.white.opacity(0.75))
                }

                Toggle(
                    "Elastic Click Bounce",
                    isOn: Binding(
                        get: { viewModel.project?.cursorStyle.clickBounceAnimation ?? true },
                        set: { viewModel.project?.cursorStyle.clickBounceAnimation = $0 }
                    )
                )
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white.opacity(0.9))

                Toggle(
                    "Dim Cursor When Idle",
                    isOn: Binding(
                        get: { viewModel.project?.cursorStyle.autoHideIdleCursor ?? false },
                        set: { viewModel.project?.cursorStyle.autoHideIdleCursor = $0 }
                    )
                )
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white.opacity(0.9))
            }
        }
    }

    // MARK: - 4. Webcam & Export Settings Inspector

    private var webcamAndExportInspectorSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            inspectorCard(title: "WEBCAM PICTURE-IN-PICTURE") {
                Toggle(
                    "Show Webcam Overlay",
                    isOn: Binding(
                        get: { viewModel.project?.webcamStyle.isEnabled ?? true },
                        set: { viewModel.project?.webcamStyle.isEnabled = $0 }
                    )
                )
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white)
                .toggleStyle(.switch)
                .controlSize(.small)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Corner Position")
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(.white.opacity(0.75))

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                        ForEach(WebcamCornerPosition.allCases) { pos in
                            let isSelected = viewModel.project?.webcamStyle.position == pos
                            Button {
                                viewModel.project?.webcamStyle.position = pos
                            } label: {
                                Text(pos.rawValue)
                                    .font(.system(size: 11, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 6)
                                    .background(isSelected ? Color(red: 0.36, green: 0.46, blue: 0.98) : Color.white.opacity(0.06))
                                    .foregroundColor(isSelected ? .white : .white.opacity(0.7))
                                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Mask Shape")
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(.white.opacity(0.75))

                    Picker("Shape", selection: Binding(
                        get: { viewModel.project?.webcamStyle.shape ?? .squircle },
                        set: { viewModel.project?.webcamStyle.shape = $0 }
                    )) {
                        ForEach(WebcamMaskShape.allCases) { shape in
                            Text(shape.rawValue).tag(shape)
                        }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                }

                sliderRow(
                    label: "Overlay Size",
                    valueText: "\(Int((viewModel.project?.webcamStyle.relativeSize ?? 0.22) * 100))%",
                    value: Binding(
                        get: { Double(viewModel.project?.webcamStyle.relativeSize ?? 0.22) },
                        set: { viewModel.project?.webcamStyle.relativeSize = CGFloat($0) }
                    ),
                    range: 0.12...0.38
                )

                sliderRow(
                    label: "Border Width",
                    valueText: "\(Int(viewModel.project?.webcamStyle.borderWidth ?? 3)) px",
                    value: Binding(
                        get: { Double(viewModel.project?.webcamStyle.borderWidth ?? 3) },
                        set: { viewModel.project?.webcamStyle.borderWidth = CGFloat($0) }
                    ),
                    range: 0...10
                )

                Toggle(
                    "Auto-Shrink During Screen Zoom",
                    isOn: Binding(
                        get: { viewModel.project?.webcamStyle.shrinkDuringZoom ?? true },
                        set: { viewModel.project?.webcamStyle.shrinkDuringZoom = $0 }
                    )
                )
                .font(.system(size: 11.5, weight: .medium))
                .foregroundColor(.white.opacity(0.85))

                Toggle(
                    "Mirror Camera Horizontally",
                    isOn: Binding(
                        get: { viewModel.project?.webcamStyle.mirrorHorizontally ?? true },
                        set: { viewModel.project?.webcamStyle.mirrorHorizontally = $0 }
                    )
                )
                .font(.system(size: 11.5, weight: .medium))
                .foregroundColor(.white.opacity(0.85))
            }

            inspectorCard(title: "EXPORT PRESET") {
                Picker("Resolution", selection: Binding(
                    get: { viewModel.project?.exportSettings.resolution ?? .hd1080p },
                    set: { viewModel.project?.exportSettings.resolution = $0 }
                )) {
                    ForEach(ExportResolutionPreset.allCases) { res in
                        Text(res.rawValue).tag(res)
                    }
                }
                .font(.system(size: 11.5))
                .foregroundColor(.white.opacity(0.85))

                Picker("Frame Rate", selection: Binding(
                    get: { viewModel.project?.exportSettings.frameRate ?? 60 },
                    set: { viewModel.project?.exportSettings.frameRate = $0 }
                )) {
                    Text("30 FPS").tag(30)
                    Text("60 FPS Smooth").tag(60)
                }
                .pickerStyle(.segmented)
            }
        }
    }

    // MARK: - Reusable Styling Components

    private func inspectorCard<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.white.opacity(0.42))
                .tracking(0.8)

            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    private func sliderRow(
        label: String,
        valueText: String,
        value: Binding<Double>,
        range: ClosedRange<Double>
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundColor(.white.opacity(0.8))
                Spacer()
                Text(valueText)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(.white.opacity(0.6))
            }
            Slider(value: value, in: range)
                .controlSize(.small)
                .tint(Color(red: 0.45, green: 0.56, blue: 1.0))
        }
    }
}
