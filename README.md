# tipón Federation — Queuing System

QR-based recruitment and visitor queuing for TIPON Federation. The web frontend is hosted on GitHub Pages; Google Apps Script manages shared Google Sheets queue data.

**Application:** https://jericknoelsabang-hue.github.io/tipon-queuing-system/  
**Brand reference:** https://tipon.coop/

## Features

- Federation-wide queuing; no MPC selection.
- QR registration with name, position/purpose, and transaction; an active ticket is reused for the same first and last name on the same day.
- NH (New Hire), RH (Rehire), TR (Transfer), plus customizable transaction categories.
- Call Next, Recall, Complete, and additional service windows.
- Staff Console controls for Refresh Queue and Enable / Test Sound (removed from TV Display).
- Staff Console **Edit TV Announcement**: save or restore a message. The backend stores it in Google Sheets `SETTINGS`, and TV screens synchronize automatically on a 2.5-second polling cycle.
- **Full Screen** toggle in the TV Display, with Exit Full Screen or the Esc key to leave.
- Website-inspired typographic scale and TIPON promotional logo artwork sourced from the federation website. Fallback wordmark is shown if the website image cannot load.
- No **Staff PIN** field or backend PIN check.

## Important security warning

**Removing the Staff PIN also removes access control for the existing Staff Console actions.** The current `/exec` endpoint is available to anyone who has its URL, including users who may obtain it by scanning the public QR code. Do not deploy this PIN-free configuration for sensitive or uncontrolled operations without implementing proper staff authentication and authorization at the server.

## Update Google Apps Script (required)

Pushing GitHub Pages does **not** redeploy Apps Script. The frontend requires **Federation v3** for the editable announcement and no-PIN controls.

1. Open your existing TIPON Queuing Apps Script project.
2. Replace the contents of its `Code.gs` with [apps-script/Code.gs](apps-script/Code.gs).
3. Save and run `setupTiponQueueSystem` once to ensure the `QUEUE`, `WINDOWS`, `TRANSACTION_TYPES`, and `SETTINGS` tabs exist. It does **not** clear existing ticket history.
4. Go to **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the same `/exec` URL by editing your deployment.
5. In the application, open **Setup**, paste your web app `/exec` URL (if it is not already saved), then **Save Connection** and **Test Connection**.
6. Go to **Staff Console**. Edit the announcement, select **Save Announcement**, and verify that TV Display updates on a second device.
7. On the actual TV computer, click **Staff Console → Enable / Test Sound**, then return to **TV Display**. Browser audio permissions are device/browser-specific and must be activated with a local click.
8. Click **Full Screen** on TV Display. Use the button or **Esc** to exit.

If the app asks to redeploy Federation v3, the live Apps Script deployment is still on the old code even if GitHub is updated.

### Google Sheets

Database: https://docs.google.com/spreadsheets/d/1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik/edit

| Tab | Purpose |
| --- | --- |
| `QUEUE` | Queue tickets and status history |
| `WINDOWS` | Active ticket per service window |
| `TRANSACTION_TYPES` | NH, RH, TR and custom transaction codes |
| `SETTINGS` | Key `ANNOUNCEMENT`, message, last update |
| `MPC_CONFIG` | Legacy sheet, not read by the Federation app |

The historical MPC fields in `QUEUE` and `WINDOWS` remain for compatibility. New queue tickets are labeled `TIPON` / `TIPON Federation`.

## GitHub Pages

Publish `main` from the repository root in GitHub **Settings → Pages**. Source updates appear at:

https://jericknoelsabang-hue.github.io/tipon-queuing-system/

### Verification scope

Frontend and Apps Script JavaScript syntax were checked, and the editable announcement persistence path was tested using a mock Google Sheets backend. Real camera/TV, browser audio, Google Apps Script deployment, and cross-device synchronization still require an operational test after deployment.
