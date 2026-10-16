import Foundation
import SwiftUI

enum FulfillmentMode: String, CaseIterable, Identifiable {
    case pickup = "Skip Queue"
    case curbside = "Curbside Lrg 14"
    case dineIn = "Shophouse Table"

    var id: String { rawValue }
}

enum MenuCategory: String, CaseIterable, Identifiable {
    case all = "All Menu"
    case signature = "TTDI Signatures"
    case espresso = "Espresso Bar"
    case filter = "V60 Hand Brew"
    case bakehouse = "6AM Sourdough"
    case roastery = "Roastery Beans"

    var id: String { rawValue }
}

struct CafeMenuItem: Identifiable, Equatable {
    let id: String
    let name: String
    let malaySubtitle: String
    let category: MenuCategory
    let priceRM: Double
    let prepMinutes: Int
    let calories: Int
    let caffeineMg: Int
    let badge: String?
    let originNote: String
    let description: String
    let tastingNotes: [String]
    let symbolName: String
}

struct CartLineItem: Identifiable {
    let id = UUID()
    let item: CafeMenuItem
    var quantity: Int
    let milkChoice: String
    let hopperChoice: String
    let sweetness: String
    var unitPriceRM: Double
}

struct ShophouseTableItem: Identifiable {
    let id: String
    let label: String
    let zone: String
    let seats: Int
    var isAvailable: Bool
    let hasOutlet: Bool
    let isPetFriendly: Bool
}

@MainActor
final class ShophouseStore: ObservableObject {
    @Published var fulfillment: FulfillmentMode = .curbside
    @Published var carPlate: String = "WYY 4821"
    @Published var carDesc: String = "Slate Grey Civic FE"
    @Published var selectedTable: String = "L-01"
    @Published var cart: [CartLineItem] = []
    @Published var activeOrderNumber: String = "TTDI-408"
    @Published var activeOrderStage: Int = 2 // 0..4
    @Published var curbsideBeaconActive: Bool = false
    @Published var stamps: Int = 6
    @Published var walletBalanceRM: Double = 64.50
    @Published var runClubJoined: Bool = false

    @Published var tables: [ShophouseTableItem] = [
        ShophouseTableItem(id: "T-01", label: "KB90 Espresso Bar Stool", zone: "Ground Bar", seats: 2, isAvailable: true, hasOutlet: true, isPetFriendly: false),
        ShophouseTableItem(id: "T-03", label: "Lorong 14 Window Bench", zone: "Ground Bar", seats: 2, isAvailable: true, hasOutlet: false, isPetFriendly: false),
        ShophouseTableItem(id: "L-01", label: "Skylight Timber Communal", zone: "Skylight Loft", seats: 6, isAvailable: true, hasOutlet: true, isPetFriendly: false),
        ShophouseTableItem(id: "L-02", label: "Vinyl Corner Lounge", zone: "Skylight Loft", seats: 4, isAvailable: false, hasOutlet: true, isPetFriendly: false),
        ShophouseTableItem(id: "C-01", label: "Monstera Back Courtyard", zone: "Pet Courtyard", seats: 4, isAvailable: true, hasOutlet: false, isPetFriendly: true)
    ]

    let menu: [CafeMenuItem] = [
        CafeMenuItem(
            id: "kajai-dirty",
            name: "Kajai Dirty",
            malaySubtitle: "Kopi Susu Sejuk Gula Apong Sarawak",
            category: .signature,
            priceRM: 16.0,
            prepMinutes: 3,
            calories: 165,
            caffeineMg: 145,
            badge: "TTDI #1 Bestseller",
            originNote: "70% Cerrado Brazil · 30% Guji Ethiopia · Sarawak Nipah",
            description: "Double ristretto floated over -2°C Hokkaido milk and Sarawak Gula Apong palm nectar in a frosted glass.",
            tastingNotes: ["Salted Caramel", "Roasted Hazelnut", " Malted Cream"],
            symbolName: "cup.and.saucer.fill"
        ),
        CafeMenuItem(
            id: "asam-boi-tonic",
            name: "Asam Boi Cascara Espresso Tonic",
            malaySubtitle: "Kopi Tonik Limau Kasturi & Asam Boi",
            category: .signature,
            priceRM: 17.0,
            prepMinutes: 4,
            calories: 95,
            caffeineMg: 140,
            badge: "Post-Bukit Kiara Trail",
            originNote: "Guji Uraga Washed + Raub Liberica Cascara",
            description: "Sun-dried Pahang cascara steeped with salted asam boi, Pasar TTDI calamansi lime, and bright Ethiopian espresso.",
            tastingNotes: ["Calamansi Zest", "Salted Plum", "Bergamot"],
            symbolName: "sparkles"
        ),
        CafeMenuItem(
            id: "hojicha-pepper",
            name: "Sarawak Black Pepper Hojicha",
            malaySubtitle: "Hojicha Panggang Lada Hitam Bario",
            category: .signature,
            priceRM: 16.0,
            prepMinutes: 4,
            calories: 140,
            caffeineMg: 65,
            badge: "Roaster's Craft",
            originNote: "Uji First-Harvest Hojicha + Bario Peppercorn",
            description: "Charcoal-roasted Uji hojicha whisked to order with a warm aromatic crack of Sarawak highlands black pepper.",
            tastingNotes: ["Toasted Nori", "Warm Pepper", "Dark Cocoa"],
            symbolName: "flame.fill"
        ),
        CafeMenuItem(
            id: "flat-white",
            name: "Bukit Kiara Flat White (6oz)",
            malaySubtitle: "Kopi Susu Panas Baldu",
            category: .espresso,
            priceRM: 13.0,
            prepMinutes: 3,
            calories: 120,
            caffeineMg: 145,
            badge: "Daily Staple",
            originNote: "Bukit Kiara House Blend · 93.2°C KB90",
            description: "18g dose pulled at 9.0 bar into silky 62°C microfoam with dark chocolate and toasted almond finish.",
            tastingNotes: ["70% Dark Choc", "Toasted Almond", "Silky"],
            symbolName: "mug.fill"
        ),
        CafeMenuItem(
            id: "cameron-v60",
            name: "Cameron Highlands Anaerobic V60",
            malaySubtitle: "Seduhan Manual Arabika Tanah Rata",
            category: .filter,
            priceRM: 20.0,
            prepMinutes: 5,
            calories: 5,
            caffeineMg: 165,
            badge: "Malaysian Grown · 1,450m",
            originNote: "Ringlet, Pahang · 96h Carbonic Maceration",
            description: "Hand-poured on Origami dripper at 91°C. Bursting with ripe jackfruit, cacao nibs, and wild Tualang honey.",
            tastingNotes: ["Ripe Jackfruit", "Cacao Nibs", "Tualang Honey"],
            symbolName: "drop.fill"
        ),
        CafeMenuItem(
            id: "kouign-amann",
            name: "Gula Melaka Sea Salt Kouign-Amann",
            malaySubtitle: "Pastri Lapis Mentega Perancis & Gula Melaka",
            category: .bakehouse,
            priceRM: 13.0,
            prepMinutes: 2,
            calories: 340,
            caffeineMg: 0,
            badge: "6:00 AM Hearth Batch",
            originNote: "T55 French Flour + 18% Rye Levain · Bario Salt",
            description: "27-layer sourdough laminated Breton pastry caramelized with artisanal Melaka coconut palm sugar.",
            tastingNotes: ["Caramelized Crust", "Cultured Butter", "Flaky Salt"],
            symbolName: "birthday.cake.fill"
        ),
        CafeMenuItem(
            id: "kaya-sourdough",
            name: "Burnt Butter Pandan Kaya Toast",
            malaySubtitle: "Roti Sourdough Kaya Pandan & Mentega",
            category: .bakehouse,
            priceRM: 15.0,
            prepMinutes: 4,
            calories: 380,
            caffeineMg: 0,
            badge: "36h Country Loaf",
            originNote: "Organic Pandan Leaf + Lescure AOP Butter",
            description: "Thick-cut blistered country sourdough topped with slow-simmered pandan kaya and cold French butter slabs.",
            tastingNotes: ["Fragrant Pandan", "Tangy Crumb", "Salted Butter"],
            symbolName: "leaf.fill"
        ),
        CafeMenuItem(
            id: "beans-bukit-kiara",
            name: "Bukit Kiara Espresso Blend (250g)",
            malaySubtitle: "Biji Kopi Panggang Rumah TTDI",
            category: .roastery,
            priceRM: 48.0,
            prepMinutes: 2,
            calories: 0,
            caffeineMg: 0,
            badge: "Roasted Tuesdays",
            originNote: "Loring S15 Falcon Roaster · Whole Bean / Ground",
            description: "Our signature TTDI shophouse espresso blend engineered for syrupy milk drinks and chocolatey black pulls.",
            tastingNotes: ["Milk Chocolate", "Hazelnut Praline", "Brown Sugar"],
            symbolName: "shippingbox.fill"
        )
    ]

    init() {
        if let first = menu.first {
            cart = [
                CartLineItem(
                    item: first,
                    quantity: 1,
                    milkChoice: "Hokkaido Milk (+RM3)",
                    hopperChoice: "Bukit Kiara Blend",
                    sweetness: "50% TTDI Standard",
                    unitPriceRM: 16.0
                )
            ]
        }
    }

    var cartCount: Int {
        cart.reduce(0) { $0 + $1.quantity }
    }

    var cartTotalRM: Double {
        cart.reduce(0) { $0 + ($1.unitPriceRM * Double($1.quantity)) }
    }

    func addToBag(
        _ item: CafeMenuItem,
        quantity: Int = 1,
        milk: String = "Full Cream Dairy",
        hopper: String = "Bukit Kiara Blend",
        sweetness: String = "50% TTDI Standard"
    ) {
        let extra = (milk.contains("+RM3") && item.id != "kajai-dirty") ? 3.0 : 0.0
        let line = CartLineItem(
            item: item,
            quantity: quantity,
            milkChoice: milk,
            hopperChoice: hopper,
            sweetness: sweetness,
            unitPriceRM: item.priceRM + extra
        )
        cart.append(line)
    }

    func advanceBrewStage() {
        activeOrderStage = (activeOrderStage + 1) % 5
    }

    func completeOrder(totalRM: Double, useWallet: Bool) {
        if useWallet {
            walletBalanceRM = max(0, walletBalanceRM - totalRM)
        }
        stamps += 1
        activeOrderNumber = "TTDI-\(Int.random(in: 410...499))"
        activeOrderStage = 1
        cart.removeAll()
    }
}
