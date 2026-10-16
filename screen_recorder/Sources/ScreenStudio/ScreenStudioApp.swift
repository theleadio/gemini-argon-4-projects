import SwiftUI
import AppKit

public final class AppDelegate: NSObject, NSApplicationDelegate {
    public func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.appearance = NSAppearance(named: .darkAqua)
        NSApp.activate(ignoringOtherApps: true)
    }

    public func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

@main
public struct ScreenStudioApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var editorViewModel = StudioEditorViewModel()

    public init() {}

    public var body: some Scene {
        WindowGroup("ScreenStudio") {
            StudioEditorView(viewModel: editorViewModel)
                .preferredColorScheme(.dark)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1280, height: 820)
        .commands {
            CommandMenu("Recording & Timeline") {
                Button("New Screen Recording...") {
                    editorViewModel.pausePlayback()
                    editorViewModel.isShowingRecorderSheet = true
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])

                Button("Load Interactive Demo Project") {
                    Task {
                        await editorViewModel.loadInteractiveDemo()
                    }
                }
                .keyboardShortcut("d", modifiers: [.command, .shift])

                Divider()

                Button(editorViewModel.isPlaying ? "Pause Playback" : "Play Timeline") {
                    editorViewModel.togglePlayPause()
                }
                .keyboardShortcut(.space, modifiers: [])
                .disabled(editorViewModel.project == nil)

                Button("Add Zoom Segment at Playhead") {
                    editorViewModel.addZoomSegment(at: editorViewModel.currentTime)
                }
                .keyboardShortcut("z", modifiers: [.command, .option])
                .disabled(editorViewModel.project == nil)

                Button("Regenerate Auto-Zooms from Clicks") {
                    editorViewModel.regenerateAutoZooms()
                }
                .keyboardShortcut("r", modifiers: [.command, .option])
                .disabled(editorViewModel.project == nil)

                Button("Delete Selected Zoom Segment") {
                    editorViewModel.deleteSelectedZoomSegment()
                }
                .keyboardShortcut(.delete, modifiers: [])
                .disabled(editorViewModel.selectedZoomSegmentID == nil)
            }
        }
    }
}
