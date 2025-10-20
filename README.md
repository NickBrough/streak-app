# Streak (Expo + React Native)

A Revolut‑inspired fitness app focused on building daily habits (push‑ups and squats) with motion detection, streaks, and a polished native experience.

## Current Features

- Core
  - Expo (managed), TypeScript, Expo Router (file‑based navigation)
  - NativeWind v4 (Tailwind RN) with shared `Screen` wrapper for consistent background and safe‑area padding
  - React Native Reanimated, Gesture Handler, Haptics, LinearGradient, BlurView
- Authentication
  - Supabase email/password; session persisted in AsyncStorage
  - App redirects to Sign In if not authenticated
- Supabase data model (high‑level)
  - Tables: `profiles`, `exercises`, `sessions`, `session_reps`, `daily_totals`, `friends`, `feed_events`
  - Functions/Triggers: `handle_new_user`, `init_default_exercises`, `create_achievement_event`
  - RLS: enabled; users manage their own rows; feed visible to friends
- Home (Dashboard)
  - Current Streak component (correct singular/plural for “day”), 7‑day dots
  - Exercise cards with progress bars and “Start Workout” launcher (glassy bottom sheet)
  - Confetti for day‑complete
- Workout
  - Auto rep counting via accelerometer with haptics; manual controls (−1 / +1 / +5)
  - Pause/Resume auto detection; End Workout persists `sessions`, `session_reps`, and updates `daily_totals`
  - Guards against auth race: waits for `useAuth().loading === false` and a non‑null `user` before inserting a session
- History
  - Weekly streak ring (7‑day progress)
  - 30‑day heatmap (tap for per‑day totals and daily completion state)
- Settings
  - Handle edit (profiles)
  - Per‑exercise daily goals and enable/disable (exercises upsert)
  - Sign Out

## Tech Stack

- React Native + Expo
- Expo Router, Reanimated, Gesture Handler
- NativeWind v4 (Tailwind RN)
- Supabase (auth, Postgres, RLS, realtime) via `@supabase/supabase-js`
- Haptics, LinearGradient, BlurView, Confetti

## Project Structure (key files)

```
app/
  _layout.tsx               # Router root with auth guard + StatusBar
  (tabs)/_layout.tsx        # Blurred tab bar
  (tabs)/index.tsx          # Home (Screen wrapper)
  (tabs)/history.tsx        # History (heatmap + ring)
  (tabs)/settings.tsx       # Settings
  (auth)/sign-in.tsx        # Sign In (NativeWind)
  (auth)/sign-up.tsx        # Sign Up (NativeWind)
  workout/[exerciseId].tsx  # Workout screen (auto + manual)
components/
  StreakDisplay.tsx
  ExerciseCard.tsx
  ui/
    Screen.tsx              # Shared background + safe area + padding
    Avatar.tsx              # Gradient fallback avatar with initials
    Button.tsx, Input.tsx
hooks/
  useAuth.ts                # Supabase auth state + helpers
  useMotionDetector.ts      # Accelerometer rep detection + haptics
lib/
  supabase.ts               # Supabase client (AsyncStorage session)
metro.config.js             # NativeWind v4 integration
babel.config.js             # Expo preset + nativewind + reanimated plugin
```

## Setup

1. Install

```bash
npm i
npx expo install react-native-reanimated react-native-gesture-handler expo-sensors expo-haptics expo-linear-gradient expo-router expo-constants expo-linking expo-status-bar expo-blur react-native-svg
```

2. NativeWind v4 configuration (already applied)

- `tailwind.config.js` includes `presets: [require('nativewind/preset')]`
- `metro.config.js` uses `withNativeWind(config, { input: './global.css' })`
- `babel.config.js`:
  - `presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel']`
  - `plugins: ['react-native-reanimated/plugin']` (keep last)
- `App.tsx` imports `./global.css`

3. Environment

Create `.env` with your Supabase project keys:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

4. Run

```bash
npx expo start
```

5. iOS dev client (CocoaPods notes)

If you hit CocoaPods shim conflicts (asdf), prefer Homebrew’s pod:

```bash
brew unlink cocoapods && brew link cocoapods
PATH="/opt/homebrew/bin:$PATH" npx expo run:ios
```

If the simulator fails to install, try resetting it:

```bash
killall Simulator || true
xcrun simctl shutdown all || true
xcrun simctl erase all || true
PATH="/opt/homebrew/bin:$PATH" npx expo run:ios
```

## Implementation Notes

- Workout auth race: the workout screen waits for auth to finish loading and a non‑null user before creating `sessions` and starting motion detection.
- Daily totals update: on End Workout we merge today’s counts, recompute `met_goal` using enabled exercises, and update/insert into `daily_totals`.
- Consistent UI: use `components/ui/Screen` on every page for gradient background, subtle glow, and top safe‑area padding.
- If `session_reps` inserts fail intermittently, verify RLS allows inserts where `auth.uid()` matches the `sessions.user_id`. Log DB errors in dev.

## Roadmap / Future Features

- Streak milestones and badges
  - 3/7/14/30/100 day milestones; animated badge case; pre‑milestone glow
- Daily quests & weekly spotlight
  - Rotating weekly exercise with XP multipliers; daily mini‑quests (e.g., +10 over goal)
- Duo streaks and friend boosts
  - “Duo Streak” that breaks only if both miss; partner nudges
- Streak Freeze / Repair tokens
  - Earn a freeze every 7 consecutive days; auto‑redeem on miss
- Social feed
  - Streak milestones and day‑complete events; friend request/accept
- Notifications
  - Daily time picker in Settings using `expo-notifications`; schedule/cancel; store time in Supabase
- Avatar upload
  - Supabase Storage + image picker; `profiles.avatar_url` displayed in header
- Offline queue
  - Queue `sessions`/`session_reps` when offline; sync on reconnect
- Motion sensitivity
  - Adjustable thresholds (low/med/high) in Settings; small live accel indicator during workout
- Visual polish
  - Sound + haptic packs; alternate gradient themes; parallax background
- Analytics
  - Session duration, average pace, best day; privacy‑respecting, opt‑in

## Contributing (local)

- Keep `react-native-reanimated/plugin` last in Babel
- Prefer `Screen` wrapper for new pages
- Follow tokens in Tailwind config; use NativeWind utilities
- Keep DB writes logged in dev to catch RLS issues early
