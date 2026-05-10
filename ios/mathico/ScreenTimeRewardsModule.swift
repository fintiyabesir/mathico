import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity
import AuthenticationServices

/// React Native bridge module for Screen Time Rewards.
///
/// Exposes FamilyControls + ManagedSettings + DeviceActivity to JS.
/// All heavy lifting is done natively so the feature remains durable
/// even when the RN JS thread is killed.
///
/// Minimum iOS version: 16.0  (FamilyActivitySelection + ManagedSettingsStore
/// with identifier was introduced in iOS 16.)
@objc(ScreenTimeRewardsModule)
class ScreenTimeRewardsModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  // MARK: – Shared store (main app)

  private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("com.besirunlu.mathico.rewards"))

  // MARK: – Authorization

  /// Requests FamilyControls authorization from the guardian.
  /// Returns true when approved.
  @objc func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(false)
      return
    }
    Task {
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        let approved = AuthorizationCenter.shared.authorizationStatus == .approved
        resolve(approved)
      } catch {
        resolve(false)
      }
    }
  }

  /// Returns the current FamilyControls authorization status as a string.
  @objc func getAuthorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve("unavailable")
      return
    }
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved:     resolve("approved")
    case .denied:       resolve("denied")
    case .notDetermined: resolve("notDetermined")
    @unknown default:   resolve("restricted")
    }
  }

  // MARK: – App selection

  /// Presents FamilyActivityPicker so the parent can select apps/categories.
  /// The selection is stored in the App Group shared container so the
  /// DeviceActivityMonitor extension can also read it.
  @objc func presentFamilyActivityPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("UNSUPPORTED", "iOS 16+ required", nil)
      return
    }
    // FamilyActivityPicker is a SwiftUI view; we present it via a UIHostingController.
    DispatchQueue.main.async {
      guard let rootVC = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .first?.windows.first?.rootViewController else {
        reject("NO_ROOT_VC", "Cannot find root view controller", nil)
        return
      }

      let pickerVC = FamilyActivityPickerViewController { selection in
        ScreenTimeSharedStore.saveSelection(selection)
        resolve(nil)
      } onCancel: {
        resolve(nil)
      }

      rootVC.present(pickerVC, animated: true)
    }
  }

  /// Returns true when the parent has previously saved a FamilyActivitySelection.
  @objc func hasSelectedActivities(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(ScreenTimeSharedStore.hasSelection())
  }

  // MARK: – Restrictions

  /// Applies shields to the parent-selected apps.  Call this to block.
  @objc func applyRestrictions(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(nil); return
    }
    guard let selection = ScreenTimeSharedStore.loadSelection() else {
      resolve(nil); return
    }
    store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    store.shield.applicationCategories = selection.categoryTokens.isEmpty
      ? nil
      : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
    resolve(nil)
  }

  /// Removes all shields set by this store (used when disabling the feature).
  @objc func clearAllRestrictions(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else { resolve(nil); return }
    store.clearAllSettings()
    resolve(nil)
  }

  // MARK: – Reward session (unshield for N minutes, then re-block)

  /// Unshields the selected apps for `minutes` minutes.
  /// DeviceActivity schedules the automatic re-block even if the app is killed.
  @objc func startRewardSession(
    _ minutes: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("UNSUPPORTED", "iOS 16+ required", nil)
      return
    }

    let now = Date()
    let expiry = now.addingTimeInterval(minutes * 60)

    // 1. Remove shields for the duration
    store.shield.applications = nil
    store.shield.applicationCategories = nil

    // 2. Schedule DeviceActivityMonitor to re-block at expiry
    let center = DeviceActivityCenter()
    let activityName = DeviceActivityName("com.besirunlu.mathico.rewardSession")

    // Cancel any existing schedule first
    center.stopMonitoring([activityName])

    let calendar = Calendar.current
    let expiryComponents = calendar.dateComponents([.hour, .minute, .second], from: expiry)

    let schedule = DeviceActivitySchedule(
      intervalStart: calendar.dateComponents([.hour, .minute, .second], from: now),
      intervalEnd: expiryComponents,
      repeats: false
    )

    do {
      try center.startMonitoring(activityName, during: schedule)
    } catch {
      // Non-fatal: JS timer will still show countdown, but re-block relies on this.
      // If monitoring fails (e.g. simulator) we still lift the shield.
    }

    // 3. Persist session state in App Group for the extension to read
    let sessionData: [String: Any] = [
      "isActive": true,
      "startedAt": ISO8601DateFormatter().string(from: now),
      "expiresAt": ISO8601DateFormatter().string(from: expiry),
      "grantedMinutes": minutes,
    ]
    ScreenTimeSharedStore.saveSession(sessionData)

    resolve(sessionData as NSDictionary)
  }

  /// Manually ends the reward session and re-applies shields.
  @objc func stopRewardSession(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else { resolve(nil); return }

    // Stop DeviceActivity monitoring
    let center = DeviceActivityCenter()
    center.stopMonitoring([DeviceActivityName("com.besirunlu.mathico.rewardSession")])

    // Re-apply shields
    if let selection = ScreenTimeSharedStore.loadSelection() {
      if !selection.applicationTokens.isEmpty {
        store.shield.applications = selection.applicationTokens
      }
      if !selection.categoryTokens.isEmpty {
        store.shield.applicationCategories = .specific(selection.categoryTokens)
      }
    }

    // Clear session
    ScreenTimeSharedStore.clearSession()
    resolve(nil)
  }

  /// Returns the current session status object (or {isActive: false}).
  @objc func getRewardSessionStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let session = ScreenTimeSharedStore.loadSession() {
      // Check if the session has already expired
      let formatter = ISO8601DateFormatter()
      if let expiresAt = formatter.date(from: session["expiresAt"] as? String ?? ""),
         expiresAt <= Date() {
        // Session expired — clean up
        ScreenTimeSharedStore.clearSession()
        resolve(["isActive": false] as NSDictionary)
        return
      }
      resolve(session as NSDictionary)
    } else {
      resolve(["isActive": false] as NSDictionary)
    }
  }

  // MARK: – Required by RCTBridgeModule

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
