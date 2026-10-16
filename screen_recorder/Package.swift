// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ScreenStudio",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "ScreenStudio", targets: ["ScreenStudio"])
    ],
    targets: [
        .executableTarget(
            name: "ScreenStudio",
            path: "Sources/ScreenStudio",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("ScreenCaptureKit"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("CoreImage"),
                .linkedFramework("CoreMedia"),
                .linkedFramework("CoreVideo"),
                .linkedFramework("QuartzCore")
            ]
        )
    ]
)
