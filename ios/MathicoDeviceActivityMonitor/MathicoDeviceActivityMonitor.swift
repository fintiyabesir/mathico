import DeviceActivity
import ManagedSettings
import FamilyControls

/// DeviceActivityMonitor extension — runs in a separate process.
///
/// iOS calls `intervalDidEnd` when the DeviceActivity schedule finishes,
/// even if the main app is backgrounded or killed.
/// We re-apply shields here to ensure Minecraft is blocked after expiry.
///
/// Bundle ID: com.besirunlu.mathico.DeviceActivityMonitor
/// Extension type: com.apple.deviceactivity.monitor-extension
@main
class MathicoDeviceActivityMonitor: DeviceActivityMonitor {

  private let store = ManagedSettingsStore(
    named: ManagedSettingsStore.Name("com.besirunlu.mathico.rewards")
  )

  /// Called when the monitored interval ends — this is where we re-block.
  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)

    guard activity.rawValue == "com.besirunlu.mathico.rewardSession" else { return }

    reApplyShields()
    clearSession()
  }

  /// Called when the monitored interval starts.  We use this to lift shields
  /// in edge cases where the native module call did not reach the store.
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)

    guard activity.rawValue == "com.besirunlu.mathico.rewardSession" else { return }

    // Shields were already lifted by the native module; this is a no-op backup.
  }

  // MARK: – Helpers

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
