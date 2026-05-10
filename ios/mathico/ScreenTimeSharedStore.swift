import Foundation
import FamilyControls

/// App-Group-backed storage shared between the main app and the
/// DeviceActivityMonitorExtension.
///
/// App Group ID: group.com.besirunlu.mathico.screentime
/// (must be added in Xcode → Signing & Capabilities → App Groups for BOTH
///  the main app target AND the DeviceActivityMonitor extension target)
enum ScreenTimeSharedStore {

  private static let suiteName = "group.com.besirunlu.mathico.screentime"
  private static let selectionKey = "familyActivitySelection"
  private static let sessionKey = "rewardSession"

  // MARK: – FamilyActivitySelection

  @available(iOS 16.0, *)
  static func saveSelection(_ selection: FamilyActivitySelection) {
    guard let defaults = UserDefaults(suiteName: suiteName) else { return }
    let encoder = PropertyListEncoder()
    if let data = try? encoder.encode(selection) {
      defaults.set(data, forKey: selectionKey)
    }
  }

  @available(iOS 16.0, *)
  static func loadSelection() -> FamilyActivitySelection? {
    guard let defaults = UserDefaults(suiteName: suiteName),
          let data = defaults.data(forKey: selectionKey) else { return nil }
    let decoder = PropertyListDecoder()
    return try? decoder.decode(FamilyActivitySelection.self, from: data)
  }

  static func hasSelection() -> Bool {
    guard let defaults = UserDefaults(suiteName: suiteName) else { return false }
    return defaults.data(forKey: selectionKey) != nil
  }

  // MARK: – Reward session

  static func saveSession(_ session: [String: Any]) {
    guard let defaults = UserDefaults(suiteName: suiteName) else { return }
    defaults.set(session, forKey: sessionKey)
  }

  static func loadSession() -> [String: Any]? {
    guard let defaults = UserDefaults(suiteName: suiteName) else { return nil }
    return defaults.dictionary(forKey: sessionKey)
  }

  static func clearSession() {
    guard let defaults = UserDefaults(suiteName: suiteName) else { return }
    defaults.removeObject(forKey: sessionKey)
  }
}
