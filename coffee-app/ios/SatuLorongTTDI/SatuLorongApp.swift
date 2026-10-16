// xcode: set sdk=iOS

import SwiftUI

@main
struct SatuLorongApp: App {
    @StateObject private var store = ShophouseStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        }
    }
}
