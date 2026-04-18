<p align="center">
   <img src="./assets/images/icon.png" alt="UniRide Logo" width="120" height="120" />
</p>

<h1 align="center">UniRide Mobile App</h1>

<p align="center">
   Campus ride-hailing application for riders and drivers, built with Expo, React Native, and Expo Router.
</p>

## Overview

UniRide Mobile is the primary client used by both riders and drivers on campus.
It supports role-aware authentication, ride discovery, booking flows, active ride tracking,
check-in verification, notifications, and profile/security management.

This app works with:

- UniRide backend API in `../UniRide-Backend`
- UniRide admin web dashboard in `../UniRide-Web`

## Feature Highlights

- Rider and driver experiences in one app with role-based routes.
- Lock-first startup flow with secure re-entry and auth-safe navigation.
- Live map experiences with provider support and 3D preference sync.
- Realtime updates through Socket.IO (requests, bookings, ride state changes).
- Bottom sheet-driven home dashboards for quick actions and context.
- Push notification registration and foreground/background handling.
- Support for location permissions, route search, and nearby activity.
- User settings for profile, security, devices, and notification preferences.

## Tech Stack

- Expo SDK 54 + React Native 0.81
- Expo Router for file-based navigation
- Zustand for state management
- NativeWind + Tailwind CSS for styling
- @gorhom/bottom-sheet for draggable panels
- Socket.IO client for realtime updates
- Map rendering via configurable provider (Mapbox and native map integration)

## App Architecture

### Route Groups

- `app/auth`: login, register, verification, password reset, legal screens.
- `app/(users)`: rider home, search, bookings, active ride, profile, notifications.
- `app/(drivers)`: driver home, requests, ride creation, active ride, earnings, profile.
- `app/settings`: account, security, device sessions, notification preferences.

### State Stores

- `store/useAuthStore.ts`: authentication, user session, role information.
- `store/useBootstrapStore.ts`: startup/bootstrap flags and app readiness.
- `store/useRideStore.ts`: ride lists, active ride context, booking status.
- `store/useLocationStore.ts`: map region, selected locations, location tracking.
- `store/useNotificationStore.ts`: in-app notification state and unread counts.
- `store/usePlatformSettingsStore.ts`: server-driven platform/map behavior.

### Service Layer

- `lib/api.ts`, `lib/rideApi.ts`, `lib/driverApi.ts`: HTTP clients and route wrappers.
- `lib/pushNotifications.ts`, `lib/notificationPresentation.ts`: notification logic.
- `lib/post-auth.ts`: post-login initialization workflows.
- `lib/eventBus.ts`: cross-feature app events.

## Project Structure

```text
uniride/
   app/
      (users)/
      (drivers)/
      auth/
      settings/
   components/
      auth/
      map/
      navigation/
      notifications/
      onboarding/
      ride/
      ui/
   hooks/
   lib/
   store/
   assets/images/
```

## Prerequisites

- Node.js 18+
- npm 9+
- Xcode (for iOS simulator builds)
- Android Studio (for Android emulator builds)
- EAS CLI (for cloud builds/submission)

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Configure environment variables in `.env`

3. Start the app

```bash
npm run start
```

4. Run platform builds

```bash
npm run ios
npm run android
```

## Environment Variables

The app reads runtime config from `.env` and build-time config from `app.config.js`.

| Variable                               | Required                 | Purpose                                            |
| -------------------------------------- | ------------------------ | -------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`                  | Yes                      | Base URL for UniRide backend API                   |
| `EXPO_PUBLIC_WEB_URL`                  | Recommended              | URL of web dashboard/portal used by linked flows   |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`    | If uploads enabled       | Cloudinary cloud name                              |
| `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | If uploads enabled       | Cloudinary unsigned upload preset                  |
| `EXPO_PUBLIC_MAPBOX_TOKEN`             | If Mapbox enabled        | Public Mapbox token for map rendering              |
| `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`         | For native Mapbox builds | Mapbox downloads token for native SDK              |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`      | If Google maps enabled   | Google Maps key used by app config                 |
| `GOOGLE_MAPS_API_KEY`                  | Optional alias           | Alternate Google Maps key fallback in config       |
| `GOOGLE_SERVICES_JSON`                 | Android push production  | Path to Android google-services config file        |
| `EXPO_PUBLIC_TRANSLATOR_API_KEY`       | Optional                 | Translator service API key                         |
| `EXPO_PUBLIC_TRANSLATOR_ENDPOINT`      | Optional                 | Translator service endpoint                        |
| `EXPO_PUBLIC_TRANSLATOR_REGION`        | Optional                 | Translator service region                          |
| `EXPO_PUBLIC_EAS_PROJECT_ID`           | Recommended              | EAS project identifier for cloud build integration |

Notes:

- `app.config.js` still accepts legacy Mapbox env names but warns when used.
- Missing Mapbox download token affects native map builds.
- Missing Google services file can impact Android push delivery.

## Available Scripts

| Command                          | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `npm run start`                  | Start Expo development server                        |
| `npm run ios`                    | Build and run iOS target locally                     |
| `npm run android`                | Build and run Android target locally                 |
| `npm run web`                    | Run app in web target mode                           |
| `npm run lint`                   | Run Expo lint checks                                 |
| `npm run reset-project`          | Reset scaffold helper script                         |
| `npm run build:android:internal` | EAS Android production profile + internal submission |
| `npm run build:android:prod`     | EAS Android production profile                       |
| `npm run submit:android:prod`    | Submit existing Android build to Play track          |

## Notifications and Realtime

- Push registration and token handling live in hooks and notification services.
- API + socket channels keep home feeds and active rides up to date.
- Notification tap navigation is lock-aware and replayed safely post-auth.

## Maps and Platform Settings

- Mobile map behavior can be controlled by backend platform settings.
- 3D map preference is synced from web admin to backend to mobile clients.
- Home and active ride screens use auto-zoom behavior tuned for clearer context.

## QA Checklist

Before release, verify:

- Rider and driver login flows.
- Lock screen and post-notification navigation.
- Home bottom sheet interactions and reopen behavior.
- Ride request, accept/confirm, check-in, and completion flows.
- Online/offline driver transitions.
- Push notification receipt in foreground/background.
- Realtime map updates and 3D setting sync.

## Troubleshooting

- If maps fail to render, verify Mapbox/Google keys and provider settings.
- If Android push is inconsistent, verify `GOOGLE_SERVICES_JSON` and Expo credentials.
- If socket updates lag, confirm backend URL and network reachability.
- If native build fails, re-check EAS secrets and map token configuration.

## Related Services

- Backend API: `../UniRide-Backend`
- Admin Web Dashboard: `../UniRide-Web`
