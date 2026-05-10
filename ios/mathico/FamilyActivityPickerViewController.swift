import UIKit
import SwiftUI
import FamilyControls

/// UIViewController wrapper around SwiftUI FamilyActivityPicker.
@available(iOS 16.0, *)
class FamilyActivityPickerViewController: UIViewController {

  private let onSelect: (FamilyActivitySelection) -> Void
  private let onCancel: () -> Void

  init(
    onSelect: @escaping (FamilyActivitySelection) -> Void,
    onCancel: @escaping () -> Void
  ) {
    self.onSelect = onSelect
    self.onCancel = onCancel
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .formSheet
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) not implemented") }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground

    let pickerView = FamilyActivityPickerWrapperView(
      onSelect: { [weak self] selection in
        self?.dismiss(animated: true) {
          self?.onSelect(selection)
        }
      },
      onCancel: { [weak self] in
        self?.dismiss(animated: true) {
          self?.onCancel()
        }
      }
    )

    let host = UIHostingController(rootView: pickerView)
    addChild(host)
    host.view.frame = view.bounds
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(host.view)
    host.didMove(toParent: self)
  }
}

// MARK: – SwiftUI wrapper

@available(iOS 16.0, *)
private struct FamilyActivityPickerWrapperView: View {
  let onSelect: (FamilyActivitySelection) -> Void
  let onCancel: () -> Void

  @State private var selection = FamilyActivitySelection()

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Uygulama Seç")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("İptal") { onCancel() }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Tamam") { onSelect(selection) }
          }
        }
    }
  }
}
