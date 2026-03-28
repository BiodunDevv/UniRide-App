# Expo Push Notifications End to End

This app uses `expo-notifications` on the client and the Expo Push API on the backend.

## Full delivery flow

1. The mobile app requests notification permission.
2. The app gets an `ExpoPushToken` with `Notifications.getExpoPushTokenAsync({ projectId })`.
3. The app sends that token to the backend with:
   - `user_id`
   - `device_id`
   - `platform`
4. The backend stores multiple tokens per user, one per device.
5. The backend sends push payloads to Expo.
6. Expo forwards them to:
   - FCM on Android
   - APNs on iOS
7. The OS delivers the notification to the device.

## Token types

### Expo push token
- Format: `ExponentPushToken[...]`
- Used with Expo Push API
- Best fit for Expo apps

### Native device token
- Android: FCM token
- iOS: APNs token
- Used only if you send directly to Firebase or Apple

This app uses Expo push tokens.

## Important production rules

- Each device gets its own token.
- The same user can have multiple tokens.
- Tokens can change after reinstall, logout/login, app data reset, or OS refresh.
- Tokens should be synced:
  - on login
  - on session restore
  - on app foreground
- Invalid tokens must be removed when Expo reports `DeviceNotRegistered`.

## Expo Go on Android

Remote push notifications are not supported in Expo Go on Android for SDK 53+.

That means:
- local notifications may still work
- remote push needs a development build or production build

## Development build setup

Install EAS CLI:

```bash
npm install -g eas-cli
```

Log in:

```bash
eas login
```

Configure builds:

```bash
eas build:configure
```

Install dev client:

```bash
npx expo install expo-dev-client
```

Build Android development client:

```bash
eas build --profile development --platform android
```

Install the generated APK on your device.

Start Metro for dev client:

```bash
npx expo start --dev-client
```

Open the installed dev build, not Expo Go.

## Current app implementation

- Shared client push helper: `lib/pushNotifications.ts`
- Root lifecycle registration: `hooks/use-push-notifications.ts`
- Auth-time token sync: `store/useAuthStore.ts`
- Backend token sync endpoint: `POST /api/settings/push-sync`
- Backend send service: `UniRide-Backend/src/services/pushNotificationService.js`

## Real-world backend storage shape

Recommended record per device:

```ts
type UserPushToken = {
  userId: string;
  deviceId: string;
  token: string;
  platform: "android" | "ios";
  lastSyncedAt: string;
};
```

Rules:
- replace old token for the same device
- keep multiple devices per user
- remove the token on logout from that device
- if the same token appears under another user, rebind it safely

## Typical failure cases

### `DeviceNotRegistered`
- token is stale
- remove it from the database

### No push arrives in development
- app is running in Expo Go on Android
- permission is denied
- token was never synced to backend
- Expo/FCM/APNs credentials are missing for the built app

### Login push saved but not sent
- token synced but send flag was false
- or no usable Expo token was available at auth time

## Best practices

- store many tokens per user, not one
- log Expo ticket failures
- show push health in-app
- respect master push toggle and category toggles
- route taps from foreground, background, and cold-start flows
- prefer static imports for `expo-notifications` in production-ready app code

