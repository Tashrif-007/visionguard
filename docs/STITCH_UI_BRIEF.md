# VisionGuard AI — UI Design Brief (for Google Stitch)

Paste this whole file into Stitch, or paste one screen section at a time (global sections 1–3 first, then a screen from section 4). Desktop web app first (1440×900), with a responsive pass for tablet and mobile.

---

## 1. Product

**VisionGuard AI** is a CCTV surveillance web console that makes hazy or smoggy camera footage clear in real time. It detects motion, picks out the moving region, removes the haze from just that region, and logs each detection as a searchable event.

**Users:** security guards, building operators, and campus, warehouse and parking-lot surveillance teams. They watch screens for long shifts, so the UI must be calm, legible and low-fatigue. A guard glances at it; it should never shout.

**Roles:**
- **Operator:** monitors cameras, browses and searches events, manages their own profile.
- **Admin:** everything an operator does, plus creating operator accounts, activating or deactivating accounts, and deleting events. There is no public signup.

**Personality:** a soft, professional control room. Trustworthy, quiet and precise. Clear cyan is the payoff colour ("clear sky through the haze") and is used only for live or active state and primary actions. Everything else stays neutral.

---

## 2. Design system

**Theme:** light and dark mode, with a toggle in the top bar. Dark mode is the hero for the live monitoring screens.

**Colour tokens**

| Token | Light | Dark |
|---|---|---|
| background | `#F7F7F5` | `#14181B` |
| card / popover | `#FFFFFF` | `#1B2226` |
| foreground (text) | `#1C1B1A` | `#E6EEEF` |
| muted surface | `#F0EFEC` | `#1F2A2F` |
| muted text | `#6F6D67` | `#8BA0A6` |
| border / input | `#E5E3DF` | `#263036` |
| **primary (cyan)** | `#0E7490` | `#22D3EE` |
| primary text-on | `#FFFFFF` | `#04272E` |
| success | `#15803D` | `#4ADE80` |
| warning | `#B45309` | `#FBBF24` |
| destructive | `#DC2626` | `#F87171` |

**Typography:** Geist (variable). Monospace (Geist Mono) for timestamps, camera names, ROI coordinates, status codes and small uppercase labels. Headlines are bold with tight tracking. Section labels are small, uppercase and widely tracked.

**Shape and elevation:** base radius about 10px. Panels use 8–10px, video tiles and small chips use about 4px. Cards have a 1px border and a very soft shadow. No heavy gradients and no glassmorphism, except a dark gradient scrim on video overlays.

**Spacing:** 24px page gutters, 16px gaps between panels, 8px grid.

**Components (shadcn/ui style):** Button (default cyan, outline, ghost, destructive; sizes sm, md, lg), Input, Label, Badge (success, destructive, muted, outline), Card, Dialog, AlertDialog (confirm), Tabs, Table, Dropdown menu, Avatar, Separator, Skeleton loaders, toast notifications.

**Signature elements**
- **Live dot:** a small pulsing cyan or green dot beside the camera name on live tiles.
- **ROI box:** a thin cyan rectangle with corner brackets drawn over the video where motion was detected and dehazed. This is the product's visual motif and should echo in the logo, empty states and the landing hero.
- **Hazy → Dehazed split:** a diagonal split visual, grey and washed out on the left, crisp dark teal with a faint grid on the right.

**Icons:** Lucide (outline, 1.5px stroke).

**Accessibility:** WCAG AA contrast, visible focus rings in cyan, 44px touch targets on mobile, never rely on colour alone for status (always pair with a label).

---

## 3. Global layout (authenticated app shell)

- **Top bar** (56px, card surface, bottom border): page title on the left. On the right, a mono live clock ("Thursday, 2 October 2026, 14:32"), a thin divider, a theme toggle, and a user menu (avatar with initials, name, role badge; dropdown with Profile, Admin (admin only) and Sign out).
- **Navigation:** Dashboard, Events, Profile, Admin (admin only). Use a slim left rail or top tabs. Keep the video area as large as possible.
- **Page body** scrolls independently of the fixed top bar.

---

## 4. Screens

### 4.1 Landing page (public)
- Header: shield-eye logo mark plus "VisionGuard AI" on the left, "Sign in" button on the right ("Go to dashboard" if already signed in).
- **Hero**, an asymmetric split (60/40):
  - Left: headline "See clearly through **fog and smog**" (the last words in cyan), subtext "VisionGuard AI restores visibility in hazy CCTV footage in real time — only on the regions where motion happens, so a single CPU keeps up at 30 FPS.", a large primary button "Sign in to monitor", a text link "See how it works ↓", and a mono caption row "CPU-only · No GPU required · 30 FPS".
  - Right: the hazy → dehazed diagonal split visual with a "Hazy" tag top-left, a "Dehazed" tag in cyan top-right, and a cyan ROI box with corner brackets at the bottom right.
- **How it works:** a horizontal four-step sequence joined by a thin line, numbered circles with cyan outlines:
  1. Motion detection: every frame is checked for motion first.
  2. ROI extraction: only the region around the motion is processed.
  3. Hybrid dehazing: physics-based dark channel prior, refined by a tiny CNN.
  4. Event log: logged and searchable in plain English.
- Footer: "VisionGuard AI — hybrid dark channel prior + tiny CNN dehazing, built for edge deployment."

### 4.2 Login
- Centred card on the background, logo above it.
- Title "Sign in", subtitle "Use the account your administrator created for you."
- Fields: Email, Password (with show/hide toggle). Primary full-width "Sign in" button with a loading state.
- Inline error: "Invalid email or password" or "This account has been deactivated".
- No signup link. Add a muted line: "Accounts are created by an administrator."

### 4.3 Dashboard — Live monitoring (the main screen)
- **Header strip:** title "Live monitoring" with a mono subtitle "3 active sources". On the right, compact system-status badges (API, DB and "Pipeline: idle", each green, red or grey), a grid / focus view toggle (two icon buttons, the active one cyan-filled), and a primary "+ Add camera" button.
- **Camera chip bar:** a horizontal row of chips, one per active camera (live dot, name), plus a small search input to filter cameras. Clicking a chip switches to focus view for that camera.
- **Main area, grid view:** a responsive grid of camera tiles (1 column on mobile, 2 on tablet, 2–3 on desktop). Each tile is a 16:9 video with:
  - the dehazed frame, with a cyan ROI rectangle where motion is occurring;
  - a bottom gradient overlay: live dot plus camera name in mono uppercase on the left, and on the right a source-type pill ("Webcam", "IP Camera" or "Upload") and a small square **Stop** button that appears on hover;
  - loading skeleton, and an "offline" state when frames stop arriving.
- **Focus view:** a single large tile, centred (max width about 1000px).
- **Empty state** (no cameras): a centred illustration of a camera with an ROI bracket, "No cameras running", "Add a webcam, an RTSP URL, or upload a video to start monitoring.", and a primary "Add camera" button.
- **Add camera dialog:** title "Add a camera", description "Start a live feed from a webcam, RTSP URL, or upload a video file." Fields: Camera name, Source (webcam index or RTSP/HTTP URL), an "or upload a video file" drop zone with a progress bar, and Cancel / Start buttons. Show an inline error if the source can't be opened.
- **Recent events strip** (pinned at the bottom, with a top border): label "RECENT EVENTS" with a "View all" link on the right. A horizontal scroll row of small cards, each with a snapshot thumbnail, a "motion" badge, and a mono time ("14:31:07").

### 4.4 Events — Timeline and natural-language search
- **Search bar** at the top, full width, with a search icon and placeholder *"Try: any motion last night?"*. Under it, **parsed-filter chips** that show how the query was understood: "From: 1 Oct 20:00", "To: 2 Oct 06:00", "Type: motion". Each chip can be removed. If the query couldn't be parsed, show a muted note: "Showing all events."
- **List header:** mono uppercase "ALL EVENTS (128)" or "SEARCH RESULTS (14)".
- **Timeline list:** reverse-chronological rows, grouped by day with sticky day headings ("Today", "Yesterday", "29 Sep"). Each row:
  - a 96×64 snapshot thumbnail (shows the dehazed frame with its ROI box) that opens a larger preview on click;
  - a "motion" badge, the camera name, and a mono timestamp;
  - mono ROI details "x 120 · y 84 · 240×160" and a frame number in muted text.
- Loading skeleton rows, and an empty state: "No events match your search" with a "Clear search" button.
- Pagination or "Load more" at the bottom.
- **Snapshot preview dialog:** large image, metadata list (time, camera, ROI, frame), and a "Delete event" button for admins only.

### 4.5 Profile
- A centred column (max about 640px) with two cards:
  - **Profile:** avatar with initials, Name and Email fields, role shown as a read-only badge, and a "Save changes" button.
  - **Change password:** Current password, New password (8 or more characters, with a helper line), Confirm, and an "Update password" button.
- Success and error toasts.

### 4.6 Admin (admin only)
- Two tabs: **Accounts** and **Events**.
- **Accounts tab:**
  - A "Create operator" card with Name, Email, Temporary password and Role (operator or admin), and a "Create account" button.
  - A "User accounts" card with subtitle "3 accounts — deactivating blocks sign-in without deleting the account", a small search input ("Search name or email"), and a table with the columns Name, Email, Role (outline badge), Status (green "Active" or grey "Inactive" badge), Created (mono), and Action (outline "Deactivate" button, or cyan "Activate" for inactive users).
  - The Deactivate button is disabled with a tooltip on your own row ("You can't deactivate your own account").
  - A confirm dialog: "Deactivate Maria?" with "They won't be able to sign in until reactivated. This doesn't delete the account."
- **Events tab:** a table with the columns Snapshot (thumbnail), Type, Time, ROI, and a Delete action, with a destructive confirm dialog "Delete this event? This permanently removes the event record and its snapshot image."

### 4.7 States to include across screens
Loading skeletons, empty states, inline form validation, toast notifications (success and error), 401 session-expired redirect to Login, and a 403 "Admins only" screen for operators.

---

## 5. Sample content (use realistic data)

- **Cameras:** "Parking Lot A" (IP Camera), "Warehouse Dock" (IP Camera), "Lobby Webcam" (Webcam), "foggy_street_demo.mp4" (Upload).
- **Events:** motion at 02:14:09, 02:14:41 and 05:48:22 on "Parking Lot A", ROI sizes between 120×90 and 400×300.
- **Users:** Admin "Sumon Ahmed" (admin), operators "Maria Chen" and "Daniel Okoye".
- **Search queries:** "any motion last night?", "show events from the warehouse yesterday morning".

---

## 6. Out of scope (do not design)

Object or intrusion detection overlays, GPU or ONNX settings, public signup, billing, and any AI chat panel. Natural-language search is a single search bar, not a chatbot.
