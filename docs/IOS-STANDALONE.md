# Life as a standalone iPhone app — free (SideStore)

Without Apple's paid developer account ($99/year) the only free way to run Life as its own app (own icon, no Expo Go) is **sideloading**: GitHub builds an unsigned `Life.ipa`, and **SideStore** on the iPhone signs it with your **free Apple ID** and installs it.

## What to expect

- The signature lasts **7 days**. SideStore refreshes it over Wi-Fi (keep LocalDevVPN connected; a Shortcuts automation can refresh daily). If it lapses, Life won't open until refreshed — your data is safe in Supabase.
- A free Apple ID allows **3 sideloaded apps at once** (SideStore counts as one).
- **Apple Health is off** in this build (free Apple IDs can't sign it); steps come from the iPhone motion sensor. **Push notifications are off** too; Life's reminders are local, so they still work.
- **Over-the-air updates are off.** A new version = build a new IPA and install it over the old one in SideStore (data stays).
- Sign-in links keep working (`lifeos://`), and nothing changes in Supabase.

## 1. One-time: GitHub secrets

GitHub → the Lifeos repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | the URL from your `.env` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the anon/publishable key from your `.env` |

## 2. Build `Life.ipa`

The workflow is `.github/workflows/ios-unsigned.yml` (macOS runner, ~20–40 min).

- **From any branch:** GitHub → **Releases → Draft a new release → Choose a tag**, type `ios-1` (next time `ios-2`, …), set **Target** to the branch, and publish. Pushing the tag starts the build.
- **Once the workflow is on the default branch:** GitHub → **Actions → iOS unsigned IPA (SideStore) → Run workflow**.

When it finishes: open the run → **Artifacts → Life-ipa** → download and unzip → `Life.ipa`.

Cost: free for public repos. Private repos get 2,000 free Actions minutes a month, but macOS minutes count ×10 (about 5–8 builds a month).

## 3. One-time: SideStore on the iPhone

Follow the official guide at [sidestore.io](https://sidestore.io) — current steps (check there first, they change):

1. iPhone: install **LocalDevVPN** from the App Store.
2. Computer (Windows/Mac/Linux): install **iloader** from [iloader.app](https://iloader.app) or [github.com/nab138/iloader](https://github.com/nab138/iloader) (Windows also needs iTunes).
3. Plug the iPhone in, open iloader, sign in with your Apple ID, choose **Install SideStore**; let it create the **pairing file**.
4. iPhone: Settings → General → VPN & Device Management → trust your Apple ID; turn on **Developer Mode** (Settings → Privacy & Security) and restart.
5. Open SideStore with LocalDevVPN connected and finish its setup.

## 4. Install Life

Send `Life.ipa` to the iPhone (AirDrop / Files), then in SideStore → **My Apps → +** → pick `Life.ipa`. Life appears on the home screen. Sign in as usual.

## Troubleshooting

- **Build fails at "Generate the native iOS project" or "Build":** open the failing step's log and send it to Claude.
- **SideStore can't install:** make sure LocalDevVPN is connected and you're under the 3-app limit.
- **"Life" won't open after a week:** open SideStore and refresh.
