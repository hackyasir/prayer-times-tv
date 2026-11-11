# Shared masjid settings (masjid codes)

Give every screen in a masjid the same **masjid code** and they all show that masjid's settings: change iqamah times, Jumu'ah, Eid or announcements once and every screen updates. Each screen still works offline: it keeps running on its saved settings and the last copy it downloaded.

There are two ways to hold the shared settings. You choose one for your whole deployment.

|                         | **Google Sheet** (`sheet`)                                                                                                 | **Cloudflare** (`cloudflare`)                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Where the settings live | Self-serve masjids: signed rows in your one registration sheet (A1). Or a Google Sheet per masjid you list (A2)            | A small Cloudflare service you deploy once (`worker/`)              |
| How admins change them  | Self-serve: on a managing screen, in the display's own **Settings**, then **Apply and publish**. Own sheet: edit the sheet | On a managing screen, in **Settings**, then **Apply and publish**   |
| How fast screens update | Within about 3 minutes                                                                                                     | Within seconds (pushed), with a check every 15 minutes as a back-up |
| Proof to publish        | Self-serve: the masjid's publish passphrase (nobody signs in). Own sheet: who can edit it                                  | Cloudflare Access (email code or Google)                            |
| Cost                    | Free                                                                                                                       | Free on the Workers Free plan at masjid scale                       |
| Server to run           | None                                                                                                                       | One Cloudflare Worker                                               |

Nothing here is secret: anyone with a masjid's code (or the sheet's ID) can read that masjid's settings, which are what the screens show anyway. Don't put anything private in the settings.

---

## 1. Choose the source (GitHub)

The source is set when the display is built. In your GitHub repository go to **Settings → Secrets and variables → Actions → Variables** and add:

| Variable                 | Value                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `SETTINGS_SOURCE`        | `sheet`, `cloudflare` or `none` (each screen keeps its own settings; the default)                                                  |
| `SETTINGS_API_URL`       | Cloudflare only: the Worker's address, e.g. `https://settings.your-domain.org`                                                     |
| `REGISTER_FORM_URL`      | Google Sheet only, for self-serve masjids: the registration form's pre-filled link. Turns on **Register your masjid** (section A1) |
| `REGISTRATIONS_SHEET_ID` | Google Sheet only, for self-serve masjids: the form's responses sheet, where their signed settings are kept (section A1)           |

Then re-run the **Deploy to GitHub Pages** workflow (Actions tab → _Run workflow_), or push any change. To switch later, change the variable and deploy again; screens keep their masjid codes.

For local development put the same values in `.env.local` as `VITE_SETTINGS_SOURCE`, `VITE_SETTINGS_API_URL`, `VITE_REGISTER_FORM_URL` and `VITE_REGISTRATIONS_SHEET_ID` — copy [env.example](env.example) to `.env.local` to start. Or, for one session only, in PowerShell: `$env:VITE_SETTINGS_SOURCE='sheet'; npm run dev`.

## 2. Followers and the masjid's screens

Every screen answers one question in **Settings → Share & follow**: _How is this screen used?_

|                       | **My own screen**                                      | **A screen in the masjid**                                             | **I manage this masjid**                                            |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Who                   | Anyone in the community                                | The TVs in the masjid                                                  | The masjid's committee                                              |
| How                   | The follow link or QR code, or find the masjid by name | The masjid-screen link (`…&screen=masjid`), or this answer in Settings | Register the masjid here, or use its code and publish passphrase    |
| The masjid's settings | Locked                                                 | Locked; everything comes from the masjid                               | Nothing is locked                                                   |
| Apply                 | Saves this screen's own display                        | Saves this screen                                                      | **Apply and publish**: saves and sends the settings to every screen |
| PIN                   | Never                                                  | Settings is behind the deployment's PIN                                | Settings is behind the deployment's PIN                             |

### What a follower can and can't change

| The masjid's — locked on every screen that follows it         | Each person's own                            |
| ------------------------------------------------------------- | -------------------------------------------- |
| Location and timezone                                         | Language                                     |
| Calculation method, Asr, high-latitude rule, Hijri adjustment | Theme, eco mode, text size, viewing distance |
| Iqamah, Jumu'ah, Eid (times, venue, notice days)              | Progress style, ticker style and speed       |
| Masjid name and logo                                          | Beeps                                        |
| The masjid's announcements                                    | Blackout during prayer; automatic notices    |

On a following screen the masjid's settings are shown greyed out with _come from Masjid Al-Noor_, and the city search is off. They're re-applied at every check and whenever Settings closes, so they can't drift. A masjid screen takes the masjid's display settings as well, each time the masjid publishes a new version; the **screen label** and **viewing calibration** always stay with each physical screen.

### Follow a masjid

- **Find your masjid:** **Settings → Share & follow → My own screen**, search by name or city, press **Follow**. The list is `public/masjids.json` plus the approved self-serve masjids, which the deploy adds.
- **Link or QR code:** the masjid shares `https://you.github.io/prayer-times-tv/?masjid=TOR4K7Q` — on its website, or as a QR code on a poster (any QR generator works). Opening it once is enough; the screen remembers.
- **Masjid screens:** set them up with `…?masjid=TOR4K7Q&screen=masjid`, or choose **A screen in the masjid** in Settings. Both links are shown, with **Copy** buttons, in **Settings → Share & follow** on any following or managing screen.
- A screen that follows a masjid never asks for the device's location.

Codes are 4–16 letters or digits; avoid look-alikes such as `0`/`O` and `1`/`I` so they're easy to type with a TV remote. **Stop following** returns the screen to its own settings.

The section shows the status: _Up to date · checked 10:42_, _Live_ (Cloudflare masjid screens), _Offline; running on the saved settings_, or what's wrong. Followers check every 30 minutes; masjid screens every 3 minutes (sheet) or live (Cloudflare). While Settings is open, an update waits until it closes.

### The PIN

The deployment's Settings PIN (`VITE_SETTINGS_PIN`) is asked for on masjid screens, managing screens and screens that don't follow a masjid — never on a follower's screen, whose Settings only holds their own display choices. The answer is a convenience, not security: any screen only reads public settings, and only the masjid's publish passphrase (or a Cloudflare sign-in, or edit rights on its sheet) can change them.

---

## Option A — Google Sheet

There are two kinds of masjid with this source, and a deployment can have both:

- **A1. Self-serve masjids (recommended).** Masjids register and publish from the display's own Settings. Their settings are kept as signed rows in one Google Sheet: your registration form's responses sheet. Nobody makes or edits a sheet, and nobody signs in to Google.
- **A2. A masjid with its own sheet.** You list the masjid's own Google Sheet in `masjids.json`, and its admins edit the sheet.

### A1. Self-serve masjids

**How it works.**

- **Registering:** a masjid's admin chooses a _publish passphrase_ and presses **Register**. The app makes a new code for the masjid and, from the passphrase and code, the masjid's signing key. It sends the screen's settings, signed with that key, to your form in the background, together with the masjid's name, city, code and public key.
- **Approving:** you tick **Approved** on that row. The tick means "this public key speaks for this code".
- **Publishing:** later changes go the same way, as new signed rows. There's nothing new to approve.
- **Following:** screens read only their masjid's rows and apply the newest one signed with the approved key. Anyone can send the form, but a row without the masjid's signature is ignored.

**Set it up once (about 15 minutes, in your Google account):**

1. Create a Google Form, _Register a masjid_, with exactly these questions. Use these titles, because the app and the deploy find the columns by them. Leave every question **optional**.
   - **Masjid name**: short answer
   - **City**: short answer
   - **Masjid code**: short answer
   - **Settings**: paragraph
   - **Publish key**: short answer
2. In the form's **Settings → Responses**:
   - set _Collect email addresses_ to **Do not collect**;
   - leave _Limit to 1 response_ **off**;
   - if it's a Google Workspace account, leave _Restrict to users in your organisation_ **off** too.

   The app sends answers without anyone signing in, and the responses sheet is public, so it mustn't hold anyone's personal details.

3. **Responses → Link to Sheets** creates the responses sheet. In it, add a column titled **Approved** to the right of the others, and make it checkboxes (**Insert → Checkbox**). Keep the responses on the sheet's **first tab**.
4. Share the responses sheet **Anyone with the link → Viewer**, and copy its ID (the part between `/d/` and `/edit`).
5. In the form: **⋮ → Get pre-filled link**. Answer _Masjid name_ `NAME`, _City_ `CITY`, _Masjid code_ `CODE`, _Settings_ `SETTINGS` and _Publish key_ `KEY`, then **Get link → Copy link**.
6. In GitHub, add the variables `SETTINGS_SOURCE` = `sheet`, `REGISTER_FORM_URL` (the link from step 5) and `REGISTRATIONS_SHEET_ID` (the ID from step 4), and deploy (section 1).
7. Recommended: install the clean-up script (below), so the sheet keeps one row per masjid.

**What a masjid does:**

1. Sets up the display for the masjid as usual: name and location (**Masjid** tab), calculation method (**Prayer Times**), iqamah and Jumu'ah, announcements.
2. Opens **Settings → Share & follow** and chooses **I manage this masjid**. The form shows what will be shared: name, location, method and Jumu'ah.
3. Types a publish passphrase twice (at least 12 characters), ticks _I'm authorised_ and presses **Register**. This takes up to a minute.
4. The screen now manages the masjid's new code, with nothing locked, and says it's waiting for approval. The follower and masjid-screen links are there to share.

**What you do:**

- **Approve:** open the responses sheet, check the masjid is genuine (for example, through its public website), and tick **Approved** on its row. Its screens apply the settings within minutes. With the clean-up script, the masjid's later changes are merged into that ticked row, so it stays approved. It appears in **Find your masjid** after the next deploy: within 6 hours, or straight away from **Actions → Deploy to GitHub Pages → Run workflow**.
- **Remove:** untick the row. The masjid's screens keep running on the settings they have.

**Changing the masjid's settings (admins):**

1. On the managing screen, change anything in any tab, as on any screen.
2. Press **Apply and publish** (the usual Apply button, renamed on a managing screen) and type the publish passphrase. Settings stays open until the change is confirmed in the sheet (up to a minute), then closes.
3. Masjid screens update within about 3 minutes, and followers within 30.

To manage from another phone or laptop: **Settings → Share & follow → I manage this masjid → Already registered?**, then the code and the passphrase. That screen takes the masjid's current settings and can publish from then on. A screen that follows the masjid can also switch to **I manage this masjid** with the passphrase. The passphrase is asked for once each time Settings is open; it's never saved.

While the masjid waits for approval, you can still publish from a managing screen: other screens get it once you approve.

**A lost passphrase.** Nobody can look it up or reset it. An admin presses **Lost the passphrase?** in **Share & follow** on a managing screen and registers the masjid again with a new one. The masjid keeps its code. You tick the new row, and from then on the newest approved row's key counts. Only tick a second row for a code if the masjid has asked you to.

**What's public, and why it's safe:**

- **Who can read:** anyone with the sheet's ID can read it, including each masjid's settings, name, city and public key. Screens show those settings anyway.
- **Who can publish:** only someone with the masjid's passphrase can make a row its screens accept. Screens check every row's Ed25519 signature against the approved key, so a changed setting, another key, a row copied to another code, or an old update sent again is ignored.
- **The passphrase stays on the device:** it never leaves the admin's device. Argon2id (64 MiB) makes each guess slow, so a long passphrase can't be found from the public key. The key is kept in memory only while the admin publishes.
- **Junk rows:** if someone floods the form with rows for one masjid, its screens can miss new updates (they look at that masjid's newest 10 rows) until you delete the junk. They keep running on what they have. A screen never goes back to an older update than the one it has, so old rows sent again change nothing on it.
- **Old rows:** every publish adds a row. The clean-up script (below) merges them into the masjid's ticked row. Without it, you can delete old update rows by hand, but keep the row you ticked.

**Limits:** the logo isn't shared (a sheet cell holds at most 50,000 characters, and the settings must fit in one), so set it on each screen. Very long announcements can make the settings too long to publish; the app says so.

**Keep the sheet tidy: one row per masjid (recommended, about 5 minutes)**

Every publish adds a row to the sheet. The clean-up script, [`registration-sheet.gs`](registration-sheet.gs), runs inside the sheet after each new response and leaves:

- **An approved masjid:** its ticked row, still ticked, with its newest settings copied in. Its other rows are removed.
- **A newer request under a different publish key:** a masjid registering again after losing its passphrase, or someone else. It stays, the newest one only, until you tick it or delete it.
- **A masjid waiting for approval:** its newest row.
- **Anything not validly signed** (your test rows, junk, rows edited by hand): removed.

It checks every row's signature with the same code the screens use, so a row sent by anyone else can never replace a masjid's settings.

To install it:

1. In the responses sheet: **Extensions → Apps Script**.
2. Replace everything in `Code.gs` with the whole of [`registration-sheet.gs`](registration-sheet.gs) and press **Save**.
3. Reload the sheet. A **Masjids** menu appears.
4. **Masjids → Tidy automatically after each response.** Google asks you to allow it; because the script is your own and not published, it shows _Google hasn't verified this app_: choose **Advanced → Go to … (unsafe)** and **Allow**. The script can only see this spreadsheet.
5. It tidies once straight away and says what it did. **Masjids → Tidy now** runs it again at any time.

The form keeps its own copy of every response (the form's **Responses** tab); screens never read it, and you can clear it with **Responses → ⋮ → Delete all responses** without affecting the sheet. After changing `src/lib/registrations.js` or `src/lib/signatures.js`, rebuild the script with `npm run build:sheet-script` and paste it in again.

### A2. A masjid with its own sheet

**Set it up (about 10 minutes):**

1. On any screen, set the masjid up as usual in Settings, then press **Settings → Share & follow → Download sheet template**. You get `masjid-settings-sheet.csv`: one setting per row (`key`, `value`).
2. In Google Sheets: **File → Import → Upload** the file, choose **Replace spreadsheet**, and **untick "Convert text to numbers, dates, and formulas"**.
3. Select column **B** and choose **Format → Number → Plain text**. _(Important: Google's reader blanks values whose type doesn't match the rest of the column. Blank values are ignored rather than wiping a setting, but they won't update either.)_
4. **Share → General access → Anyone with the link → Viewer**. Editors are whoever you add by email.
5. Copy the sheet's ID from its address — the part between `/d/` and `/edit`.
6. In GitHub, edit [`public/masjids.json`](../public/masjids.json) and add the masjid:

   ```json
   {
     "TOR4K7Q": { "name": "Masjid Al-Noor", "city": "Toronto", "sheetId": "1AbC…the ID…" }
   }
   ```

   `name` and `city` are what people search in **Find your masjid**; add `"listed": false` to leave a masjid out of the list (it can still be followed by its link). Commit; the site redeploys in a minute or two.

7. Connect the screens with the code (section 2).

Keep the settings on the **first tab** of the sheet.

**Editing the sheet:**

- Change a value in column B; screens pick it up within about 3 minutes (followers within 30). Column C explains each row and the values it accepts.
- Groups and lists use dots, counting from 1: `iqamah.fajr` (minutes), `jumuah.1.time` (`13:15`), `jumuah.2.enabled` (`TRUE`/`FALSE`).
- Announcements can span several lines in one cell (Alt+Enter / Ctrl+Enter), with the same markup as the ticker (`!` for urgent, `@2026-12-31` to expire).
- Rows you delete keep the screen's current value. Rows starting with `#` are notes.
- Unknown settings and unreadable values are skipped; the screen's status says how many.
- The logo isn't in the sheet (a cell holds at most 50,000 characters): set it on each screen, or use the Cloudflare source.

A masjid can also host its own CSV file instead of a Google Sheet: use `"csvUrl": "https://…/settings.csv"` in `masjids.json` (the server must allow cross-site reads).

---

## Option B — Cloudflare (Publish from Settings, pushed to screens)

### Deploy the service (once, about 30 minutes)

You need a free Cloudflare account and, for the sign-in step, a domain on Cloudflare (the free plan is fine).

1. Install Node.js, then in the `worker/` folder run `npx wrangler login` and `npx wrangler deploy`.
2. Give the Worker your own address: **Workers & Pages → prayer-times-settings → Settings → Domains & Routes → Add custom domain**, e.g. `settings.your-domain.org`.
3. Protect publishing with **Cloudflare Access** (Zero Trust → Access → Applications → _Add an application → Self-hosted_):
   - Domain: `settings.your-domain.org`, path `m/*/publish`.
   - Policy: _Allow_ — the emails of the people who may publish (or your Google Workspace domain). Login methods: one-time PIN and/or Google.
   - Copy the application's **Audience (AUD) tag**, and note your team domain (`yourteam.cloudflareaccess.com`).
   - Access is free for up to 50 users.
4. Set the Worker's variables (dashboard → the Worker → Settings → Variables, or `[vars]` in `worker/wrangler.toml` and deploy again):

   | Variable                     | Value                                                                                                                                                    |
   | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `ALLOWED_ORIGINS`            | The display's address, e.g. `https://you.github.io` (comma-separate several)                                                                             |
   | `ACCESS_TEAM_DOMAIN`         | `yourteam.cloudflareaccess.com`                                                                                                                          |
   | `ACCESS_AUD`                 | the AUD tag                                                                                                                                              |
   | `MASJID_ADMINS` _(optional)_ | Which emails may publish which code: `{"TOR4K7Q":["admin@masjid.org"],"*":["you@example.org"]}`. Without it, anyone Access lets in may publish any code. |

   Publishing is refused until `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set.

5. In GitHub set `SETTINGS_SOURCE=cloudflare` and `SETTINGS_API_URL=https://settings.your-domain.org`, and deploy (section 1).
6. To list a masjid in **Find your masjid**, add it to [`public/masjids.json`](../public/masjids.json) with just its name and city: `"TOR4K7Q": { "name": "Masjid Al-Noor", "city": "Toronto" }`.

### Publishing

1. On any screen (or a laptop or phone with the display open), go to **Settings → Share & follow → I manage this masjid** and enter the masjid's code.
2. Nothing is locked on that screen. Make the changes in any tab.
3. Press **Apply and publish**. From a managing screen, every setting is published, as on a masjid screen (but never a screen's label or viewing calibration).
4. A tab opens on the settings service: sign in (first time), check the summary, and press **Publish to all screens**. Masjid screens update within seconds; followers within 30 minutes; screens that were off catch up when they start.

The first publish for a new code creates it — until then screens following that code show _This code isn't set up yet_.

### What the service stores and shows

- Per code: the settings, a version number, the time, and the email of whoever published (kept for your records, never shown to screens).
- `GET /m/<CODE>` returns `{ version, updatedAt, settings }` to anyone; `/m/<CODE>/live` pushes new versions.
- Free-plan limits (Workers and Durable Objects, 2026): 100,000 requests a day. A masjid screen uses up to about 200 a day (96 checks plus its live connection's keep-alive messages, which count 20 to a request); a follower about 48 (a check every 30 minutes, no live connection). So, for example, 100 masjid screens and 1,500 followers fit. Above that, the Workers Paid plan is $5/month.
- The service doesn't know or record who follows a masjid.

---

## Troubleshooting

| Status                                            | What to check                                                                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _This code isn't set up yet_                      | Self-serve: the code has a row in the registration sheet. Own sheet: the code is in `public/masjids.json` (and the site has redeployed). Cloudflare: publish once for that code. |
| _Registered; waiting for approval_                | Tick **Approved** on the masjid's row; check the _Approved_ column is checkboxes.                                                                                                |
| _No valid update from the masjid yet_             | None of the masjid's newest 10 rows is signed with the approved key: delete junk rows for that code.                                                                             |
| _The registration sheet isn't set up …_           | The responses are on the first tab, with the column titles in A1 (Timestamp, Masjid code, Settings, Publish key).                                                                |
| _There's no masjid with that code yet_            | Check the code; a new masjid is registered with **I manage this masjid → Register**.                                                                                             |
| _That isn't this masjid's publish passphrase_     | Passphrases are case-sensitive. If it's lost, use **Lost the passphrase?** (A1).                                                                                                 |
| _Sent, but it hasn't appeared … yet_              | The form accepts responses, doesn't need sign-in, has no required questions, and the pre-filled link has all five answers.                                                       |
| _The form didn't accept it_ (Register)            | Open the pre-filled link in a private window and submit it: the form must accept it without signing in, ask for no email, and have no required questions.                        |
| _This browser couldn't work out the masjid's key_ | Use an up-to-date Chrome, Edge, Firefox or Safari. (The Google Sheet source lets the page run WebAssembly, which the passphrase step needs.)                                     |
| _Can't read the masjid's sheet_                   | The sheet is shared _Anyone with the link: Viewer_; the ID in `masjids.json` is right.                                                                                           |
| _Offline; running on the saved settings_          | The screen has no internet. It carries on as it is and updates when it's back.                                                                                                   |
| _The shared settings couldn't be read_            | The sheet or published file isn't valid settings; nothing was changed on the screen.                                                                                             |
| _Not published_                                   | Sign in again on the publish tab; check `MASJID_ADMINS` includes you and `ALLOWED_ORIGINS` includes the display's address.                                                       |
| _The publish tab was blocked_                     | Allow pop-ups for the display's site.                                                                                                                                            |
