import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: ShophouseStore
    @State private var selectedTab: Int = 0
    @State private var selectedCategory: MenuCategory = .all
    @State private var searchText: String = ""
    @State private var customizingItem: CafeMenuItem?
    @State private var showingCheckout = false

    private let amber = Color(red: 0.85, green: 0.47, blue: 0.21)
    private let bgDark = Color(red: 0.08, green: 0.07, blue: 0.06)
    private let cardBg = Color(red: 0.12, green: 0.10, blue: 0.09)

    var filteredMenu: [CafeMenuItem] {
        store.menu.filter { item in
            let matchesCat = selectedCategory == .all || item.category == selectedCategory
            let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let matchesSearch = q.isEmpty ||
                item.name.lowercased().contains(q) ||
                item.malaySubtitle.lowercased().contains(q)
            return matchesCat && matchesSearch
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        headerLocationCard
                        fulfillmentPicker
                        morningRitualCard
                        categoryStrip
                        menuList
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 100)
                }
                .background(bgDark.ignoresSafeArea())
                .navigationTitle("Satu Lorong · TTDI")
                .navigationBarTitleDisplayMode(.inline)
                .searchable(text: $searchText, prompt: "Search Kajai Dirty, V60, Sourdough...")
                .overlay(alignment: .bottom) {
                    if !store.cart.isEmpty {
                        floatingBagBar
                    }
                }
            }
            .tabItem {
                Label("Order", systemImage: "cup.and.saucer.fill")
            }
            .tag(0)

            BrewTrackerSwiftView()
                .tabItem {
                    Label("Brew #\(store.activeOrderNumber.replacingOccurrences(of: "TTDI-", with: ""))", systemImage: "gauge.with.dots.needle.67percent")
                }
                .tag(1)

            ShophouseSwiftView()
                .tabItem {
                    Label("Shophouse", systemImage: "building.2.fill")
                }
                .tag(2)

            LoyaltyPassSwiftView()
                .tabItem {
                    Label("Kelab Pass", systemImage: "wallet.pass.fill")
                }
                .tag(3)
        }
        .tint(amber)
        .sheet(item: $customizingItem) { item in
            ItemCustomizerSheetView(item: item)
                .environmentObject(store)
        }
        .sheet(isPresented: $showingCheckout) {
            CheckoutSwiftSheetView(onOrderSuccess: {
                selectedTab = 1
            })
            .environmentObject(store)
        }
    }

    private var headerLocationCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.caption2)
                        .foregroundStyle(amber)
                    Text("34 LORONG RAHIM KAJAI 14 · TTDI")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                }
                Text("Satu Lorong")
                    .font(.system(size: 28, weight: .bold, design: .serif))
                    .foregroundStyle(.white)
            }
            Spacer()
            Button {
                selectedTab = 1
            } label: {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 8, height: 8)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("KB90 QUEUE")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.secondary)
                        Text("~3m · 2 cups")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(amber)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(cardBg, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private var fulfillmentPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("Fulfillment", selection: $store.fulfillment) {
                ForEach(FulfillmentMode.allCases) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)

            HStack {
                if store.fulfillment == .curbside {
                    Image(systemName: "car.fill")
                        .foregroundStyle(amber)
                    Text("Curbside Drop: **\(store.carPlate)** (\(store.carDesc))")
                        .font(.caption)
                } else if store.fulfillment == .dineIn {
                    Image(systemName: "fork.knife")
                        .foregroundStyle(amber)
                    Text("Checked In: **Table \(store.selectedTable)**")
                        .font(.caption)
                } else {
                    Image(systemName: "storefront.fill")
                        .foregroundStyle(amber)
                    Text("Express Window at 34 Lorong Rahim Kajai 14")
                        .font(.caption)
                }
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(amber.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private var morningRitualCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("🔥 6:00 AM HEARTH BATCH #2")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(amber.opacity(0.25), in: Capsule())
                    .foregroundStyle(amber)
                Text("6 Kouign-Amann Left")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.yellow)
            }
            Text("TTDI Morning Ritual Pair")
                .font(.title3.bold())
                .foregroundStyle(.white)
            Text("Chilled Kajai Dirty (Sarawak Gula Apong) + warm Gula Melaka Sea Salt Kouign-Amann.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button {
                if let dirty = store.menu.first(where: { $0.id == "kajai-dirty" }),
                   let ka = store.menu.first(where: { $0.id == "kouign-amann" }) {
                    store.addToBag(dirty, milk: "Hokkaido Milk (+RM3)")
                    store.addToBag(ka)
                }
            } label: {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text("Add Morning Pair · RM 27.00")
                        .fontWeight(.bold)
                }
                .font(.caption)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(amber, in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(.white)
            }
            .padding(.top, 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Color(red: 0.18, green: 0.11, blue: 0.06), cardBg],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 20)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(amber.opacity(0.35), lineWidth: 1)
        )
    }

    private var categoryStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(MenuCategory.allCases) { category in
                    Button {
                        selectedCategory = category
                    } label: {
                        Text(category.rawValue)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                selectedCategory == category ? amber : cardBg,
                                in: Capsule()
                            )
                            .foregroundStyle(selectedCategory == category ? .white : .secondary)
                    }
                }
            }
        }
    }

    private var menuList: some View {
        VStack(spacing: 12) {
            ForEach(filteredMenu) { item in
                Button {
                    customizingItem = item
                } label: {
                    HStack(spacing: 14) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(amber.opacity(0.16))
                                .frame(width: 68, height: 68)
                            Image(systemName: item.symbolName)
                                .font(.title2)
                                .foregroundStyle(amber)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            if let badge = item.badge {
                                Text(badge.uppercased())
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundStyle(amber)
                            }
                            Text(item.name)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.leading)
                            Text(item.malaySubtitle)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            HStack(spacing: 6) {
                                Text(String(format: "RM %.2f", item.priceRM))
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.white)
                                Text("· \(item.prepMinutes)m prep")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.top, 2)
                        }
                        Spacer()
                        Button {
                            store.addToBag(item)
                        } label: {
                            Image(systemName: "plus")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.white)
                                .frame(width: 34, height: 34)
                                .background(amber, in: Circle())
                        }
                    }
                    .padding(13)
                    .background(cardBg, in: RoundedRectangle(cornerRadius: 18))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var floatingBagBar: some View {
        Button {
            showingCheckout = true
        } label: {
            HStack {
                HStack(spacing: 10) {
                    Text("\(store.cartCount)")
                        .font(.caption.bold())
                        .frame(width: 24, height: 24)
                        .background(Color.black.opacity(0.28), in: Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text("View Order Bag")
                            .font(.footnote.weight(.bold))
                        Text(store.fulfillment == .curbside ? "Curbside · \(store.carPlate)" : store.fulfillment.rawValue)
                            .font(.caption2)
                            .opacity(0.85)
                    }
                }
                Spacer()
                Text(String(format: "Checkout · RM %.2f", store.cartTotalRM))
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 8))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(amber, in: RoundedRectangle(cornerRadius: 18))
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
            .shadow(color: .black.opacity(0.4), radius: 12, y: 6)
        }
    }
}

struct ItemCustomizerSheetView: View {
    @EnvironmentObject var store: ShophouseStore
    @Environment(\.dismiss) private var dismiss
    let item: CafeMenuItem

    @State private var milkChoice = "Hokkaido Milk (+RM3)"
    @State private var hopperChoice = "Bukit Kiara Blend"
    @State private var sweetness = "50% TTDI Standard"
    @State private var quantity = 1

    private let amber = Color(red: 0.85, green: 0.47, blue: 0.21)

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(item.malaySubtitle)
                            .font(.caption)
                            .foregroundStyle(amber)
                        Text(item.name)
                            .font(.title2.bold())
                        Text(item.description)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("Mythos MY75 Bean Hopper") {
                    Picker("Hopper", selection: $hopperChoice) {
                        Text("Bukit Kiara Blend").tag("Bukit Kiara Blend")
                        Text("Cameron Anaerobic (+RM3)").tag("Cameron Anaerobic (+RM3)")
                        Text("Swiss Water Decaf (+RM2)").tag("Swiss Water Decaf (+RM2)")
                    }
                }

                Section("Milk & Dairy Alternative") {
                    Picker("Milk", selection: $milkChoice) {
                        Text("Full Cream Dairy").tag("Full Cream Dairy")
                        Text("Oatside Barista (+RM3)").tag("Oatside Barista (+RM3)")
                        Text("Hokkaido Milk (+RM3)").tag("Hokkaido Milk (+RM3)")
                    }
                }

                Section("Sarawak Gula Apong Sweetness") {
                    Picker("Sweetness", selection: $sweetness) {
                        Text("0% Unsweetened").tag("0% Unsweetened")
                        Text("50% TTDI Standard").tag("50% TTDI Standard")
                        Text("100% Regular").tag("100% Regular")
                    }
                    .pickerStyle(.segmented)
                }

                Section("Quantity") {
                    Stepper("Cups / Portions: \(quantity)", value: $quantity, in: 1...10)
                }
            }
            .navigationTitle("Customize Spec")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add to Bag") {
                        store.addToBag(item, quantity: quantity, milk: milkChoice, hopper: hopperChoice, sweetness: sweetness)
                        dismiss()
                    }
                    .fontWeight(.bold)
                }
            }
        }
    }
}

struct CheckoutSwiftSheetView: View {
    @EnvironmentObject var store: ShophouseStore
    @Environment(\.dismiss) private var dismiss
    var onOrderSuccess: () -> Void

    @State private var byoCup = false
    @State private var paymentMethod = "Apple Pay"

    var finalTotal: Double {
        let sub = store.cartTotalRM - (byoCup ? 2.0 : 0.0)
        return max(0, sub * 1.06)
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Lorong 14 Fulfillment") {
                    Picker("Mode", selection: $store.fulfillment) {
                        ForEach(FulfillmentMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    if store.fulfillment == .curbside {
                        TextField("Car Plate", text: $store.carPlate)
                        TextField("Vehicle Description", text: $store.carDesc)
                    }
                }

                Section("Items in Bag") {
                    ForEach(store.cart) { line in
                        HStack {
                            VStack(alignment: .leading) {
                                Text("\(line.quantity)x \(line.item.name)")
                                    .font(.subheadline.bold())
                                Text("\(line.hopperChoice) · \(line.milkChoice)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(String(format: "RM %.2f", line.unitPriceRM * Double(line.quantity)))
                                .font(.subheadline.bold())
                        }
                    }
                }

                Section("Sustainability & Payment") {
                    Toggle("Bring My Own Tumbler (-RM 2.00)", isOn: $byoCup)
                    Picker("Payment Method", selection: $paymentMethod) {
                        Text("Pay (Face ID)").tag("Apple Pay")
                        Text("DuitNow QR").tag("DuitNow QR")
                        Text(String(format: "Lorong Pass (RM %.2f)", store.walletBalanceRM)).tag("Lorong Pass")
                    }
                }

                Section {
                    Button {
                        store.completeOrder(totalRM: finalTotal, useWallet: paymentMethod == "Lorong Pass")
                        dismiss()
                        onOrderSuccess()
                    } label: {
                        HStack {
                            Spacer()
                            Text(String(format: "Pay with %@ · RM %.2f", paymentMethod, finalTotal))
                                .font(.headline)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Checkout Bag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

struct BrewTrackerSwiftView: View {
    @EnvironmentObject var store: ShophouseStore
    private let amber = Color(red: 0.85, green: 0.47, blue: 0.21)
    private let stages = [
        "Ticket Queued at Espresso Bar",
        "Grinding 18.0g on Mythos MY75 (42°C)",
        "La Marzocco KB90 9.0 Bar Extraction (93.2°C)",
        "Chilled Glass Layering & Deck Hearth Torch",
        "Ready at 34 Lorong Rahim Kajai 14!"
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("LIVE KB90 TELEMETRY")
                            .font(.caption2.bold())
                            .foregroundStyle(amber)
                        Text("Order #\(store.activeOrderNumber)")
                            .font(.largeTitle.bold())
                        Text("Curbside Plate: \(store.carPlate) · Head Barista Aiman R.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)

                        Button {
                            store.advanceBrewStage()
                        } label: {
                            Label("Simulate Next Barista Step", systemImage: "play.fill")
                                .font(.caption.bold())
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(amber.opacity(0.2), in: Capsule())
                                .foregroundStyle(amber)
                        }
                        .padding(.top, 4)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 20))

                    // Curbside Beacon
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Image(systemName: "car.fill")
                                .foregroundStyle(amber)
                            Text("Lorong 14 Double-Park Express")
                                .font(.headline)
                            Spacer()
                            Text(store.carPlate)
                                .font(.caption.monospaced().bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
                        }
                        Text("Pulled up outside No. 34 with hazard lights on? Alert our runner for 45-second window drop-off.")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Button {
                            store.curbsideBeaconActive.toggle()
                        } label: {
                            Label(
                                store.curbsideBeaconActive
                                    ? "Hazard Beacon Active · Runner Syafiq Dispatched!"
                                    : "I'm Outside on Lorong 14 (Flash Hazards)",
                                systemImage: "dot.radiowaves.left.and.right"
                            )
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(store.curbsideBeaconActive ? Color.green : amber, in: RoundedRectangle(cornerRadius: 14))
                            .foregroundStyle(.black)
                        }
                    }
                    .padding(16)
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 20))

                    // Stages
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Extraction Progress")
                            .font(.headline)
                        ForEach(0..<stages.count, id: \.self) { idx in
                            HStack(spacing: 12) {
                                Image(systemName: idx <= store.activeOrderStage ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(idx <= store.activeOrderStage ? amber : .secondary)
                                Text(stages[idx])
                                    .font(.subheadline)
                                    .fontWeight(idx == store.activeOrderStage ? .bold : .regular)
                                    .foregroundStyle(idx <= store.activeOrderStage ? .white : .secondary)
                            }
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 20))
                }
                .padding(16)
            }
            .background(Color(red: 0.08, green: 0.07, blue: 0.06).ignoresSafeArea())
            .navigationTitle("Live Brew Tracker")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct ShophouseSwiftView: View {
    @EnvironmentObject var store: ShophouseStore
    private let amber = Color(red: 0.85, green: 0.47, blue: 0.21)

    var body: some View {
        NavigationStack {
            List {
                Section("Shophouse Live Table Check-In") {
                    ForEach(store.tables) { table in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("\(table.id) · \(table.label)")
                                    .font(.subheadline.bold())
                                Text("\(table.zone) · \(table.seats) seats\(table.hasOutlet ? " · 240V Power" : "")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button {
                                store.selectedTable = table.id
                                store.fulfillment = .dineIn
                            } label: {
                                Text(store.selectedTable == table.id ? "Checked In" : (table.isAvailable ? "Hold 15m" : "Busy"))
                                    .font(.caption.bold())
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(store.selectedTable == table.id ? Color.green : amber.opacity(0.2), in: Capsule())
                            }
                            .disabled(!table.isAvailable)
                        }
                    }
                }

                Section("Shophouse Fiber Wi-Fi (800 Mbps)") {
                    HStack {
                        Label("SatuLorong_TTDI_5G", systemImage: "wifi")
                        Spacer()
                        Text("Key: lorong14kopi")
                            .font(.caption.monospaced())
                            .foregroundStyle(amber)
                    }
                }

                Section("Bukit Kiara Saturday 7:00 AM Run Club") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("7km Twin Peaks Trail + Free Asam Boi Espresso Tonic")
                            .font(.subheadline.bold())
                        Button {
                            store.runClubJoined.toggle()
                        } label: {
                            Text(store.runClubJoined ? "✓ RSVP Confirmed for Sat 7:00 AM" : "RSVP Free Runner Spot")
                                .font(.caption.bold())
                        }
                    }
                }
            }
            .navigationTitle("34 Lorong Rahim Kajai 14")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct LoyaltyPassSwiftView: View {
    @EnvironmentObject var store: ShophouseStore
    private let amber = Color(red: 0.85, green: 0.47, blue: 0.21)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("KELAB LORONG · TTDI PASS")
                                .font(.caption.bold())
                                .foregroundStyle(amber)
                            Spacer()
                            Text("FOUNDING MEMBER")
                                .font(.caption2.monospaced().bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(amber.opacity(0.2), in: Capsule())
                                .foregroundStyle(amber)
                        }

                        HStack(spacing: 24) {
                            VStack(alignment: .leading) {
                                Text("STORED CREDIT")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                Text(String(format: "RM %.2f", store.walletBalanceRM))
                                    .font(.title2.bold())
                            }
                            VStack(alignment: .leading) {
                                Text("KOPI STAMPS")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                Text("\(store.stamps) / 8")
                                    .font(.title2.bold())
                            }
                        }

                        HStack {
                            Button {
                                store.stamps += 1
                            } label: {
                                Label("+1 NFC Stamp", systemImage: "seal.fill")
                                    .font(.caption.bold())
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(amber, in: Capsule())
                                    .foregroundStyle(.black)
                            }

                            Button {
                                store.walletBalanceRM += 55.0
                            } label: {
                                Label("Top Up RM50 (+RM5)", systemImage: "plus.circle.fill")
                                    .font(.caption.bold())
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(Color.white.opacity(0.12), in: Capsule())
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                    .padding(20)
                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 22))
                }
                .padding(16)
            }
            .background(Color(red: 0.08, green: 0.07, blue: 0.06).ignoresSafeArea())
            .navigationTitle("Kelab Lorong Pass")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
