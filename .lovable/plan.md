

## Verify Free-Tier Limits & Upgrade Prompts

This is a **manual verification task** — you need to test it in the live preview yourself.

### Steps to Test

1. **Sign up as a new user** at `/auth` (new accounts default to free tier with `pilot` role, no subscription)
2. **Go to Dashboard** — verify:
   - Tier label shows "Pilot (Free)"
   - Projects remaining counter shows "3 remaining this month"
   - Storage limit shows 1 GB
3. **Create 3 projects** — after the 3rd, try creating a 4th and verify the **Upgrade Prompt dialog** appears with the lock icon and "View Plans" button
4. **Check feature gates** — on a project detail page, look for any locked features (share links, point cloud, contour export, priority processing) that should show `UpgradeBanner` or trigger `UpgradePrompt`
5. **Verify image limit** — free tier allows 500 images per project; uploading more should be blocked or warned

### What to Look For

| Area | Expected for Free Tier |
|------|----------------------|
| Projects/month | 3 limit, counter visible |
| Storage | 1 GB cap |
| Images/project | 500 max |
| Share links | Locked |
| Point cloud | Locked |
| Priority processing | Disabled |
| Upgrade prompt | Appears when hitting limits |
| "View Plans" button | Navigates to `/#pricing` |

### No Code Changes Needed

The subscription limits logic in `subscription-limits.ts` and upgrade prompts in `UpgradePrompt.tsx` are already implemented. The `AuthContext` defaults to `subscriptionTier: null` (mapped to "free") for users without a Stripe subscription. This is purely a manual QA check.

