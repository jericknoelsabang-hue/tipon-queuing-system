# TIPON Federation Queuing System

QR-based TIPON Federation recruitment and member service queue powered by GitHub Pages and Google Sheets.

## Federation update

- One federation-wide queue. **No MPC selection**, MPC filtering, or cooperative-specific QR screen.
- Redesigned blue-and-white interface with coral and yellow accents, based on the TIPON Federation website: https://tipon.coop/.
- QR scan registration with name, purpose, transaction, and same-day active-ticket deduplication.
- Default transactions: **NH - New Hire**, **RH - Rehire**, **TR - Transfer**; staff may add more.
- Dynamic windows, Call Next, Recall, Complete, live TV waiting queue, chime and voice notifications.
- No existing records are deleted. Historical MPC columns and data are retained for compatibility, but new entries are marked TIPON Federation.

## Critical: Apps Script redeployment required

GitHub Pages updates **do not update the deployed Google Apps Script**. Until you deploy the updated backend, the frontend correctly displays a Federation-version mismatch rather than submitting incompatible queue records.

1. Open the existing TIPON Queuing Apps Script project.
2. Copy the entire updated [apps-script/Code.gs](apps-script/Code.gs) into its Code.gs.
3. Save and run `setupTiponQueueSystem` once. It does not clear your queue history.
4. Select **Deploy > Manage deployments > Edit > New version > Deploy**.
5. In the frontend Setup page, reuse or paste the Google Apps Script `/exec` URL.
6. Click **Test Connection**, then register a test ticket and verify Call Next, Recall and Complete.
7. On the display device, click **Enable / Test Sound** to unlock browser audio.

The backend requires a configured `STAFF_PIN` Script Property; change the default PIN before production use. Do not commit PINs or secret tokens to GitHub.

**Google Sheet:** https://docs.google.com/spreadsheets/d/1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik/edit

The existing `QUEUE`, `WINDOWS`, and `TRANSACTION_TYPES` tabs remain. `MPC_CONFIG` is now a legacy tab and is not read by the new backend.

## GitHub Pages

https://jericknoelsabang-hue.github.io/tipon-queuing-system/

Configure **Settings > Pages > Deploy from branch > main > /(root)** if not already enabled.
