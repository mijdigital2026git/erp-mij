# Project-Scoped Rules & Architecture Guidelines

These rules ensure consistent development, testing, and operation of the ERP-MIJ workspace across future sessions.

---

## 1. Session Isolation (Admin vs. Client)
* **Rule**: Keep Admin and Client sessions completely isolated to allow developers and users to log in as both roles simultaneously on the same browser/device.
* **Architecture**:
  * **Admin Cookies**: Admin uses cookie `session_user_admin`.
  * **Client Cookies**: Client uses cookie `session_user_client`.
  * **Routing**: Dynamic cookie routing is configured in [middleware.ts](file:///root/erp-mij/src/middleware.ts) based on URL pathname.
  * **Logout**: Logout endpoint in [logout.ts](file:///root/erp-mij/src/pages/api/logout.ts) detects the origin path and deletes only the matching session cookie.

---

## 2. Active Session Management (Auto-Kick)
* **Rule**: Do not hard-block logins when the limit of 2 active devices is reached.
* **Architecture**: 
  * If a user logs in and exceeds the limit, the system in [auth.ts](file:///root/erp-mij/src/pages/api/auth.ts) automatically deletes the oldest session from the D1 database and registers the new session. This prevents lockout issues.

---

## 3. Google Drive Integration & Sanitization
* **Rule**: Support seamless credentials parsing and fallback safety.
* **Precedence**: OAuth client credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) take precedence over Service Account (`GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`) in [googleDrive.ts](file:///root/erp-mij/src/utils/googleDrive.ts).
* **Sanitization**: All loaded environment variables must be passed through `sanitizeEnvValue` to automatically strip surrounding double (`"`) or single (`'`) quotes that might be copy-pasted into Cloudflare.
* **Resumable Fallback**: If the initial request to the target `GOOGLE_DRIVE_FOLDER_ID` returns a 404 or 400 error (invalid or deleted folder ID), the upload helper must automatically catch the error and fallback to uploading the file directly to the **root** folder of the Google Drive instead of throwing a 500.

---

## 4. Multi-Project CRUD Management
* **Rule**: Allow managing multiple projects per client.
* **Endpoints**: 
  * `src/pages/api/projects.ts` handles:
    * `GET`: Fetch projects by `clientId`.
    * `POST`: Create a new project.
    * `PATCH`: Update project name, deadlines, contact.
    * `DELETE`: Cascades deletion of the project and all tasks underneath.
* **UI**: 
  * The client database [client_database.astro](file:///root/erp-mij/src/pages/client_database.astro) lists all clients. Under each client, an expandable project details row can be toggled to perform inline creation, editing, and deletion of project specifications.
