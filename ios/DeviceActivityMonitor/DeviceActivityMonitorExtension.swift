import DeviceActivity
import ManagedSettings
import FamilyControls

// Entry point is set via NSExtensionPrincipalClass in Info.plist — do NOT use @main
class MathicoDeviceActivityMonitor: DeviceActivityMonitor {

  private let store = ManagedSettingsStore(
    named: ManagedSettingsStore.Name("com.besirunlu.mathico.rewards")
  )

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    guard activity.rawValue == "com.besirunlu.mathico.rewardSession" else { return }
    reApplyShields()
    clearSession()
  }

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
  }

  private func reApplyShields() {
    guard #available(iOS 16.0, *) else { return }
    guard let selection = ScreenTimeSharedStore.loadSelection() else { return }
    if !selection.applicationTokens.isEmpty {
      store.shield.applications = selection.applicationTokens
    }
    if !selection.categoryTokens.isEmpty {
      store.shield.applicationCategories = .specific(selection.categoryTokens)
    }
  }

  private func clearSession() {
    ScreenTimeSharedStore.clearSession()
  }
}
