# TIPON TAWAG: AI Scanner Deployment (NOT YET ACTIVE)

The existing production Google Apps Script cannot be deployed through the connected GitHub or Google Drive actions. The source files in this branch must be installed in the user's **existing** Apps Script project.

## Files to install

- `apps-script/Code.gs` — replace existing Code.gs **after taking a backup**.
- `apps-script/PrecheckAI.gs` — create new script file.
- `apps-script/ScanBridge.html` — create new HTML file.

## Google Apps Script Script Properties

Under **Project Settings -> Script properties**, set privately:

- `TIPON_OPENAI_API_KEY` = an API key from the separate OpenAI API platform.
- `TIPON_DOC_FOLDER_ID` = an appropriately access-restricted Google Drive folder ID.
- `TIPON_AI_ENABLED` = `true` only **after** testing and security approval.
- `TIPON_AI_DAILY_LIMIT` = `25` for controlled test (or another approved maximum).
- `TIPON_REQ_ADMIN_KEY` = independently generated secret, length 16+.
- `TIPON_OPENAI_MODEL` = `gpt-4.1-mini` (verify account's current model access).

Never share the API key, admin key, or private image URL in GitHub, URL query parameters, screenshots, or a spreadsheet.

## Deployment

1. Back up current production Apps Script and spreadsheet.
2. Install all three files and run `setupTiponQueueSystem` manually in Apps Script to authorize and initialize the schema.
3. In the **existing** deployment choose **Deploy -> Manage deployments -> Edit -> New version -> Deploy**. Keep the same `/exec` URL.
4. Check the healthy queue and staff console before testing document workflow.
5. Complete privacy/security review and **restrict who can invoke Apps Script** before any real applicant photographs.

## Key security limitations

This branch is *infrastructure only*. The original queue application and public Apps Script JSONP endpoint are not sufficiently authenticated for sensitive recruitment data. The HTMLService bridge supports server-side operations, but `ALLOWALL` and origin checks are **not user authorization**; a dedicated authenticated server or Apps Script access control must be enforced for staff and applicant transactions before processing real documents. Existing queue endpoints still expose unauthenticated state and staff actions. Do not set `TIPON_AI_ENABLED=true` in production until that is resolved.

Only synthetic documents should be used for integration QA. Formal tests must cover photo quality, arbitrary transaction config, duplicate queues, partial uploads, processing budget, mismatched document names, denial of consent, lost connection, and data retention and deletion. Actual authenticity is never guaranteed by a language model.

## Current state

- Code added in development branch; **no new Apps Script deployment**.
- No OpenAI API key has been configured and no API request has been run.
- No real applicant image has been uploaded, analyzed, or stored.
- The frontend remains on the existing preliminary manual/photo checklist.
- There is no functioning end-to-end AI document capture yet.

To complete: integrate the secure bridge client with UI, implement staff authentication, capture/confirm extracted fields, and verify with synthetic documents before production launch.
