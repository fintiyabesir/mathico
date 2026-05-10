# Mathico — 4 İşlem Pratik Uygulaması

Çocuklardan yetişkinlere dört işlem pratiği yapılabilen, tamamen cihaz içinde çalışan (offline-first) bir mobil uygulama.

---

## Özellikler

- **Çoklu profil** — aynı cihazda farklı kullanıcılar
- **4 işlem + karışık mod** — toplama, çıkarma, çarpma, bölme
- **Genişletilmiş soru tipleri** — Eksik Sayı (`7+?=12`), Hata Bul (işlem doğru mu?), Karşılaştır (hangisi büyük?), Örüntü (`2,4,6,?,10`), Çarpım Tablosu drili
- **Adaptif seviye motoru** — işlem türü bazlı bağımsız seviyeler, performans trendine göre otomatik ayarlama
- **Hız + doğruluk puanlaması** — sabit süreye değil, seviye beklentisine göre hız çarpanı
- **Günlük hedefler ve gamification** — rozetler, seriler, ünvanlar
- **Ebeveyn puan cüzdanı** — PIN korumalı; çocuğun puanları gerçek ödüllere dönüştürülebilir
- **Ekran Süresi Ödülleri** (iOS 16+) — çocuk puan kazanarak engellenen uygulamalara (Minecraft vb.) geçici erişim açabilir
- **Ekran Süresi Etkinlik Raporu** — ebeveyn ekranında günlük kullanım, harcanan puanlar, çözülen sorular
- **Offline-first** — internet bağlantısı gerekmez
- **3 tema** — küçük çocuk, genç, yetişkin

---

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Mobil | React Native 0.81.5 |
| Çatı | Expo SDK ~54.0.0 |
| Dil | TypeScript (strict) |
| Veritabanı | SQLite (`expo-sqlite`) |
| Depolama | `AsyncStorage`, `expo-secure-store` |
| Navigasyon | React Navigation 7 |
| iOS native | Swift + ObjC bridge |
| Screen Time | FamilyControls, ManagedSettings, DeviceActivity |
| Build | EAS Build (cloud) |

---

## Proje Yapısı

```
mathico/
├── App.tsx
├── index.ts
├── app/
│   ├── context/          # AppContext (profil, tema)
│   ├── navigation/       # AppNavigator, types
│   └── screens/
│       ├── HomeScreen.tsx
│       ├── SessionScreen.tsx
│       ├── SessionEndScreen.tsx
        ├── MultiplicationTableScreen.tsx   # çarpım tablosu seçim + drill
        ├── ReportsScreen.tsx
        ├── RewardsScreen.tsx
        ├── ScreenTimeRedeemScreen.tsx   # çocuk ekranı — puan → ekran süresi
        ├── ParentScreen.tsx
        ├── ProfileSelectScreen.tsx
        ├── CreateProfileScreen.tsx
        └── components/
            ├── ScreenTimeRewardsSection.tsx  # ebeveyn yapılandırma bölümü
            └── ScreenTimeReportSection.tsx   # ebeveyn aktivite raporu
├── features/
│   ├── practice/         # soru üretim motoru
│   │   └── extendedGenerators.ts  # 5 yeni soru tipi üreticisi
│   ├── scoring/          # puanlama motoru
│   ├── progression/      # adaptif seviye motoru
│   ├── reporting/        # rapor ve snapshot üretimi
│   ├── gamification/     # rozetler, seriler, günlük hedefler
│   ├── rewards-wallet/   # puan ledger (kazanma/harcama)
│   ├── profile/          # profil CRUD
│   └── screen-time/      # Ekran Süresi Ödülleri iş mantığı
│       ├── types.ts
│       ├── screenTimeRewardCalculator.ts
│       ├── screenTimeRewardValidationService.ts
│       ├── screenTimeNativeService.ts
│       ├── screenTimeSettingsService.ts
│       ├── screenTimeRewardRedemptionService.ts
│       ├── screenTimeActivityLogService.ts   # günlük aktivite logu
│       └── __tests__/
├── shared/
│   ├── types/
│   ├── ui/               # tema, NumericPad, MultipleChoice
│   ├── lib/
│   └── storage/          # SQLite şema ve erişim
└── ios/
    ├── mathico/
    │   ├── ScreenTimeRewardsModule.swift    # RN native modül
    │   ├── ScreenTimeRewardsModule.m        # ObjC bridge
    │   ├── ScreenTimeSharedStore.swift      # App Group paylaşımlı depo
    │   └── FamilyActivityPickerViewController.swift
    └── DeviceActivityMonitor/              # iOS extension
        ├── DeviceActivityMonitorExtension.swift
        ├── ScreenTimeSharedStore.swift
        └── Info.plist
```

---

## Kurulum

### Gereksinimler

- Node.js 20+
- Xcode 16+ (iOS geliştirmesi için)
- EAS CLI: `npm install -g eas-cli`

### Adımlar

```bash
git clone https://github.com/fintiyabesir/mathico.git
cd mathico/mathico
npm install
cd ios && pod install && cd ..
```

### Simülatörde çalıştır

```bash
npx expo start --ios
```

> **Not:** FamilyControls API'leri simülatörde çalışmaz. Ekran Süresi Ödülleri özelliğini test etmek için gerçek bir iPhone gerekir (iOS 16+).

---

## Build ve Yayın

### Cloud build (EAS)

```bash
cd mathico
eas build --platform ios --profile production
```

### TestFlight'a gönder

```bash
eas submit --platform ios --latest
```

### Xcode'da manual build

```bash
cd ios
xcodebuild -workspace mathico.xcworkspace \
  -scheme mathico \
  -destination 'generic/platform=iOS' \
  build
```

---

## Ekran Süresi Ödülleri — iOS Kurulum Notları

Bu özellik Apple'ın özel entitlement'larını gerektirir. Aşağıdaki adımlar Xcode'da **bir kez** yapılmalıdır:

1. `mathico` target → Signing & Capabilities → **+ Capability → Family Controls**
2. `mathico` target → **+ Capability → App Groups** → `group.com.besirunlu.mathico.screentime`
3. `DeviceActivityMonitor` extension target için aynı iki capability
4. Extension **Build Settings → CODE_SIGN_ENTITLEMENTS**: `DeviceActivityMonitor/DeviceActivityMonitor.entitlements`
5. Minimum deployment target: **16.0** (her iki target)

> App Store dağıtımı için [developer.apple.com/contact/request/family-controls-distribution](https://developer.apple.com/contact/request/family-controls-distribution) üzerinden Family Controls (Distribution) onayı alınmalıdır.

---

## Testler

```bash
cd mathico
npx jest features/screen-time/__tests__/screenTimeRewards.test.ts
```

---

## Sürüm Geçmişi

| Build | Tarih | Notlar |
|---|---|---|
| v1.0.0 #7 | Ocak 2026 | İlk TestFlight yayını |
| v1.0.0 #8 | 10 Mayıs 2026 | Ekran Süresi Ödülleri — FamilyControls/ManagedSettings/DeviceActivity entegrasyonu |
| v1.0.0 #9 | 10 Mayıs 2026 | 5 yeni soru tipi (Eksik Sayı, Hata Bul, Karşılaştır, Örüntü, Çarpım Tablosu), Ebeveyn Ekran Süresi Etkinlik Raporu |

---

## Lisans

Özel proje — tüm hakları saklıdır.
