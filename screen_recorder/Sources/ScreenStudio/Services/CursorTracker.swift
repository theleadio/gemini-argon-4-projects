import Foundation
import AppKit
import CoreGraphics

public final class CursorTracker {
    private var timer: DispatchSourceTimer?
    private var globalMouseDownMonitor: Any?
    private var globalMouseUpMonitor: Any?
    private var localMouseDownMonitor: Any?
    private var localMouseUpMonitor: Any?

    private let lock = NSLock()
    private var startTime: TimeInterval = 0
    private var pausedDuration: TimeInterval = 0
    private var pauseStartTimestamp: TimeInterval?
    private var isPaused: Bool = false

    private var captureFrameInQuartz: CGRect = CGRect(x: 0, y: 0, width: 1920, height: 1080)
    private var samples: [CursorSample] = []
    private var clicks: [ClickEvent] = []
    private var wasButtonPressed: Bool = false
    private var activeClickIndex: Int?

    public init() {}

    deinit {
        stopTracking()
    }

    public func startTracking(captureFrameQuartz: CGRect) {
        stopTracking()

        lock.lock()
        self.captureFrameInQuartz = captureFrameQuartz
        self.samples.removeAll(keepingCapacity: true)
        self.clicks.removeAll(keepingCapacity: true)
        self.startTime = ProcessInfo.processInfo.systemUptime
        self.pausedDuration = 0
        self.pauseStartTimestamp = nil
        self.isPaused = false
        self.wasButtonPressed = false
        self.activeClickIndex = nil
        lock.unlock()

        // High-frequency 120Hz sampling timer
        let queue = DispatchQueue(label: "com.screenstudio.cursortracker", qos: .userInteractive)
        let sourceTimer = DispatchSource.makeTimerSource(queue: queue)
        sourceTimer.schedule(deadline: .now(), repeating: .milliseconds(8), leeway: .milliseconds(1))
        sourceTimer.setEventHandler { [weak self] in
            self?.sampleCurrentMouseState()
        }
        self.timer = sourceTimer
        sourceTimer.resume()

        // Also register global + local event monitors for instantaneous click capture
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.globalMouseDownMonitor = NSEvent.addGlobalMonitorForEvents(
                matching: [.leftMouseDown, .rightMouseDown]
            ) { [weak self] event in
                self?.handleExplicitMouseDown(button: event.buttonNumber)
            }
            self.globalMouseUpMonitor = NSEvent.addGlobalMonitorForEvents(
                matching: [.leftMouseUp, .rightMouseUp]
            ) { [weak self] _ in
                self?.handleExplicitMouseUp()
            }
            self.localMouseDownMonitor = NSEvent.addLocalMonitorForEvents(
                matching: [.leftMouseDown, .rightMouseDown]
            ) { [weak self] event in
                self?.handleExplicitMouseDown(button: event.buttonNumber)
                return event
            }
            self.localMouseUpMonitor = NSEvent.addLocalMonitorForEvents(
                matching: [.leftMouseUp, .rightMouseUp]
            ) { [weak self] event in
                self?.handleExplicitMouseUp()
                return event
            }
        }
    }

    public func pauseTracking() {
        lock.lock()
        defer { lock.unlock() }
        guard !isPaused else { return }
        isPaused = true
        pauseStartTimestamp = ProcessInfo.processInfo.systemUptime
    }

    public func resumeTracking() {
        lock.lock()
        defer { lock.unlock() }
        guard isPaused else { return }
        if let pauseStart = pauseStartTimestamp {
            pausedDuration += (ProcessInfo.processInfo.systemUptime - pauseStart)
        }
        pauseStartTimestamp = nil
        isPaused = false
    }

    public func updateCaptureFrame(_ newQuartzFrame: CGRect) {
        lock.lock()
        self.captureFrameInQuartz = newQuartzFrame
        lock.unlock()
    }

    @discardableResult
    public func stopTracking() -> CursorTelemetryTrack {
        timer?.cancel()
        timer = nil

        let gDown = globalMouseDownMonitor
        let gUp = globalMouseUpMonitor
        let lDown = localMouseDownMonitor
        let lUp = localMouseUpMonitor
        globalMouseDownMonitor = nil
        globalMouseUpMonitor = nil
        localMouseDownMonitor = nil
        localMouseUpMonitor = nil

        DispatchQueue.main.async {
            if let gDown = gDown { NSEvent.removeMonitor(gDown) }
            if let gUp = gUp { NSEvent.removeMonitor(gUp) }
            if let lDown = lDown { NSEvent.removeMonitor(lDown) }
            if let lUp = lUp { NSEvent.removeMonitor(lUp) }
        }

        lock.lock()
        let result = CursorTelemetryTrack(
            samples: samples,
            clicks: clicks,
            capturedFrameSize: captureFrameInQuartz.size
        )
        lock.unlock()
        return result
    }

    // MARK: - Internal Sampling

    private func currentRecordingTimeLocked() -> TimeInterval {
        let now = ProcessInfo.processInfo.systemUptime
        let raw = now - startTime - pausedDuration
        return max(0, raw)
    }

    private func normalizedMouseLocationLocked() -> CGPoint {
        let cocoaPt = NSEvent.mouseLocation
        let primaryScreenHeight = NSScreen.screens.first?.frame.height ?? CGFloat(CGDisplayPixelsHigh(CGMainDisplayID()))
        let quartzX = cocoaPt.x
        let quartzY = primaryScreenHeight - cocoaPt.y

        let normX = (quartzX - captureFrameInQuartz.minX) / max(1.0, captureFrameInQuartz.width)
        let normY = (quartzY - captureFrameInQuartz.minY) / max(1.0, captureFrameInQuartz.height)

        return CGPoint(
            x: min(max(normX, 0.0), 1.0),
            y: min(max(normY, 0.0), 1.0)
        )
    }

    private func sampleCurrentMouseState() {
        lock.lock()
        defer { lock.unlock() }
        guard !isPaused else { return }

        let t = currentRecordingTimeLocked()
        let normPt = normalizedMouseLocationLocked()
        let pressedMask = NSEvent.pressedMouseButtons
        let isPressed = (pressedMask & 0x3) != 0

        samples.append(
            CursorSample(
                time: t,
                x: normPt.x,
                y: normPt.y,
                isPressed: isPressed
            )
        )

        // Fallback click state transition via polling (works even without Accessibility permissions)
        if isPressed && !wasButtonPressed {
            wasButtonPressed = true
            // Check if explicit monitor already recorded a click within last 35ms
            if let lastClick = clicks.last, abs(t - lastClick.time) < 0.035 {
                activeClickIndex = clicks.count - 1
            } else {
                let button = (pressedMask & 0x2) != 0 ? 1 : 0
                let click = ClickEvent(
                    time: t,
                    releaseTime: t + 0.14,
                    x: normPt.x,
                    y: normPt.y,
                    buttonNumber: button
                )
                clicks.append(click)
                activeClickIndex = clicks.count - 1
            }
        } else if !isPressed && wasButtonPressed {
            wasButtonPressed = false
            if let idx = activeClickIndex, idx < clicks.count {
                clicks[idx].releaseTime = max(clicks[idx].time + 0.06, t)
            }
            activeClickIndex = nil
        }
    }

    private func handleExplicitMouseDown(button: Int) {
        lock.lock()
        defer { lock.unlock() }
        guard !isPaused else { return }

        let t = currentRecordingTimeLocked()
        let normPt = normalizedMouseLocationLocked()

        if let lastClick = clicks.last, abs(t - lastClick.time) < 0.035 {
            return
        }

        wasButtonPressed = true
        let click = ClickEvent(
            time: t,
            releaseTime: t + 0.14,
            x: normPt.x,
            y: normPt.y,
            buttonNumber: button
        )
        clicks.append(click)
        activeClickIndex = clicks.count - 1
    }

    private func handleExplicitMouseUp() {
        lock.lock()
        defer { lock.unlock() }
        guard !isPaused else { return }

        let t = currentRecordingTimeLocked()
        wasButtonPressed = false
        if let idx = activeClickIndex, idx < clicks.count {
            clicks[idx].releaseTime = max(clicks[idx].time + 0.06, t)
        }
        activeClickIndex = nil
    }
}
