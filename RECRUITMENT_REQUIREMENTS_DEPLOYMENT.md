# TIPON TAWAG — Recruitment Requirements Configuration and Camera OCR

## Current deployment architecture

- **Queue website:** GitHub Pages. Recruitment queue number deduplication remains handled by Apps Script + Google Sheets.
- **Applicant camera capture:** GitHub Pages, in the applicant's browser (secure HTTPS). Repeat Capture Photo as needed, with no configured numerical photo cap. The applicant can remove photos, finish capturing and check them.
- **OCR:** Tesseract.js 7, loaded on demand after the applicant chooses Check Captured Documents. Browser OCR only; no photos or extracted document text are sent to the Apps Script public GET endpoint.
- **Recruiter requirements list:** `REQUIREMENTS_CONFIG` tab in the existing Google Sheet. Empty initially. The name, multiple transaction assignments and optional recognition terms can be edited by authorized recruiters.
- **Auth for editing:** Separate Google Apps Script web-app deployment, **execute as user accessing the web app**, accessible only to authorized Google Workspace staff. `TIPON_RECRUITER_EMAILS` must list permitted full email addresses. There is no reusable Recruiter Management Key.
- **Actual AI Vision/API:** NOT active. The open-source browser OCR is preliminary, can be wrong, and cannot authenticate IDs or certify complete requirements. Human recruiter inspection remains mandatory.

## Google Apps Script setup — REQUIRED after GitHub push

The GitHub push does **not** deploy a Google Apps Script project. Update this existing project:

https://script.google.com/u/0/home/projects/1140JUpc5DcZ8I5zgFhXWyX-Pje0wGcde1zWEEo1Ervm0uVVCjzkwgrt5/edit

1. Back up current `Code.gs` first, and confirm spreadsheet backup and original deployment URL.
2. Replace `Code.gs` with the latest version from `main/apps-script/Code.gs`.
3. Add two new **HTML** files named `RequirementsStaffBridge` and `RequirementsStaffEditor` (without .html in the file naming UI). Copy content from the matching files under `main/apps-script/`. The editor provides a direct, signed-in fallback when Chrome blocks the embedded staff bridge.
4. Under **Project Settings → Script properties**, add `TIPON_RECRUITER_EMAILS` with approved comma-separated full staff Google accounts, for example `recruiter1@company.example,recruiter2@company.example`. Do not place access secrets in the GitHub repository. Only listed addresses may manage the requirements.
5. Save. Run `setupTiponQueueSystem` once, complete the authorization, and check that it **does not clear or replace queue history**.
6. Update the **existing public queue deployment**: Deploy → Manage deployments → Edit → New version → Deploy. Keep the current public `/exec` URL. This enables public read-only `requirements` plus ordinary queue actions. Public JSONP staff requirement writes are no longer allowed.
7. Create a **separate recruiter-only web app deployment** of the same project. Set **Execute as: User accessing the web app** and **Who has access: Only your authorized Workspace users / organization**, depending on available workspace options. This deployment should not be shared with applicants; each recruiter must sign in and may need to authorize the script and have appropriate spreadsheet access.
8. Copy the recruiter-only `/exec` URL into TIPON website → **Setup → Google Apps Script Connection → Recruiter Setup Connection**; select **Save Recruiter Connection**. The recruiter may need to click **Open / Authorize Recruiter Access** once to authorize in a new tab, then return to Setup. If cross-site iframes are blocked, the new tab is a complete standalone requirements editor. There is no Recruiter Management Key.
9. Test **Add / Edit / Delete** using sample requirement names and combinations of transactions. Verify `REQUIREMENTS_CONFIG` and refresh the applicant Get Queue page.
10. Confirm **Recruitment** shows the Yes/No option. When **No**, Get Queue Number remains visible. When **Yes**, it stays hidden until consent, camera capture and a document-review attempt complete. **Member Concern** bypasses this feature entirely.
11. Test mobile camera permission, front/back document captures, 1, 10 and 30+ photos, photo removal, offline/poor-network OCR behavior, repeat ticket issuance and date resetting. Use only synthetic test documents, not real ID photos.

## Recognition terms

The **Suggest Recognition Terms** button uses a standard curated recognition vocabulary for common PH document classes (for example NBI, PSA, SSS, PhilHealth, Pag-IBIG, BIR). This is a **local** dictionary, not a live internet query. It does not hard-code which documents a recruiter must request. For unknown document titles, the full title remains a starting OCR term. Recruiters must review/adjust suggestions.

Examples of common terms:
- NBI: National Bureau of Investigation, Multi-Purpose Clearance.
- PSA: Philippine Statistics Authority, Certificate of Live Birth.
- PhilHealth: Member Data Record, Philippine Health Insurance Corporation.
- Pag-IBIG: Home Development Mutual Fund, Member's Data Form.

## Security and operational caveats

- **Do not** process real, identifiable applicant documents with the existing public JSONP API or add an OpenAI API key to client-side JavaScript.
- A site navigation tab is **not** authorization; the separate staff-only deployment and allowlist guard the requirement write methods.
- Browser OCR loads code and language assets from a public CDN. Document images themselves remain in the browser. No upload to the private Drive folder is implemented in this release.
- The existing queue endpoints still use public JSONP/GET with no authentication for unrelated staff queue actions; a full production security review is needed.
- OCR results show **Possible Match / Needs Recruiter Review / Not Detected**, never official Valid, Authentic or Approved. You must still check original physical documents.
- Unlimited photo *count* is not unlimited storage or processing capability: mobile browser memory and battery constrain practical batch size. Avoid capturing unnecessary personal data.
- When the backend reports **Unknown action**, the public Apps Script deployment still runs an older Code.gs. Redeploy the existing project, not just GitHub.
- When recruiter Setup shows **Staff connection not ready**, check the separate staff deployment, Google sign-in, email allowlist, authorizations, and browser third-party-cookie restrictions. Open the staff deployment directly in a new tab if an iframe cannot initialize.

## Paid AI Vision (future)

The prior experimental AI source lives in `feature/secure-ai-precheck-20261031`. It is not merged or deployed because it still needs authenticated, secured document upload, retention policy, data subject consent design, billing setup and real image QA. Current browser OCR does **not** require an OpenAI API key or incur OpenAI API charges.
