import React, { useState } from 'react';
import { Code2, Copy, Check, X } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface SwiftCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SWIFT_FILES: Record<string, string> = {
  'SatuLorongApp.swift': `import SwiftUI

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
}`,
  'Models.swift': `import Foundation
import SwiftUI

enum FulfillmentMode: String, CaseIterable, Identifiable {
    case pickup = "Counter Pickup"
    case curbside = "Lorong 14 Curbside"
    case dineIn = "Shophouse Table"
    var id: String { rawValue }
}

@MainActor
final class ShophouseStore: ObservableObject {
    @Published var fulfillment: FulfillmentMode = .curbside
    @Published var carPlate: String = "WYY 4821"
    @Published var selectedTable: String = "L-01"
    @Published var activeOrderStage: Int = 2 // 0..4 KB90 Extraction
    @Published var curbsideBeaconActive: Bool = false
    @Published var stamps: Int = 6
    @Published var walletBalanceRM: Double = 64.50
}`,
  'BrewLiveActivity.swift': `import ActivityKit
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
}`,
  'ContentView.swift': `import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: ShophouseStore
    @State private var selectedCategory: MenuCategory = .signature
    @State private var showingCheckout = false

    var body: some View {
        TabView {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        headerBanner
                        fulfillmentPicker
                        menuList
                    }
                    .padding(.horizontal, 16)
                }
                .background(Color(red: 0.08, green: 0.07, blue: 0.06))
                .navigationTitle("Satu Lorong · TTDI")
            }
            .tabItem { Label("Order", systemImage: "cup.and.saucer.fill") }

            BrewTrackerSwiftView()
                .tabItem { Label("Brew #408", systemImage: "gauge.with.dots.needle.67percent") }

            LoyaltyPassSwiftView()
                .tabItem { Label("Kelab Pass", systemImage: "wallet.pass.fill") }
        }
        .tint(Color(red: 0.85, green: 0.47, blue: 0.21))
    }
}`,
};

export const SwiftCodeModal: React.FC<SwiftCodeModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<string>('SatuLorongApp.swift');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const code = SWIFT_FILES[selectedFile] || '';

  return (
    <div className="swift-modal-backdrop" onClick={onClose}>
      <div className="swift-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="swift-modal-header">
          <div className="swift-modal-title">
            <Code2 size={18} className="text-amber" />
            <span>Native SwiftUI Source (`ios/SatuLorongTTDI/`)</span>
          </div>
          <button type="button" className="ios-sheet-close static-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="swift-file-tabs">
          {Object.keys(SWIFT_FILES).map((fname) => (
            <button
              key={fname}
              type="button"
              className={`swift-file-tab ${selectedFile === fname ? 'active' : ''}`}
              onClick={() => {
                haptics.impactLight();
                setSelectedFile(fname);
              }}
            >
              {fname}
            </button>
          ))}
        </div>

        <div className="swift-code-block-wrap">
          <button
            type="button"
            className="swift-copy-btn"
            onClick={() => {
              haptics.impactLight();
              navigator.clipboard?.writeText(code).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy Swift'}</span>
          </button>
          <pre className="swift-pre">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
