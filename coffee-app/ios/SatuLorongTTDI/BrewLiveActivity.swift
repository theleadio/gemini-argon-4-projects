import ActivityKit
import SwiftUI
import WidgetKit

struct SatuLorongBrewAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var stageIndex: Int
        var stageTitle: String
        var estimatedMinutesLeft: Int
        var baristaName: String
        var pressureBar: Double
    }

    var orderNumber: String
    var fulfillmentLabel: String
    var carPlate: String?
}
