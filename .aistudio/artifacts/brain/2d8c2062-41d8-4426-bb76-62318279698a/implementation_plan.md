# UI Streamlining & Modal Backdrop Dismiss Plan

Clean up the DropTop interface by decluttering test/diagnostic controls, removing secondary subtitles, simplifying Settings toggles, and enabling intuitive click/tap-outside dismissal on modals.

> [!IMPORTANT]
> **Summary of Requested Changes**:
> - **Bottom Dock Clean-up**: Remove the Security/PenTest button from the floating bottom dock (leaving Scan, History, Settings).
> - **Top Header Clean-up**: Remove the "Discoverable" pill badge and the subtitle "P2P Lossless Direct Share" under DropTop, leaving a pristine brand mark.
> - **Settings Simplification**:
>   - Rename "Sound Effects" to "Sound".
>   - Remove descriptive helper text under "Auto-Accept" ("Receive files without prompt") and "Sound" ("Play sounds on transfer").
>   - Remove the Penetration Audit card from Settings.
> - **History Card Touch-Outside-to-Close**: Add backdrop click/tap dismissal (`onClick` on backdrop with `stopPropagation` on card container).

---

## 1. Overview & Core Concept

This update streamlines the visual presentation of DropTop into a clean, distraction-free interface. By removing verbose sub-labels and developer/audit buttons, the user experience becomes lightweight and focused, while touch interaction is improved by supporting tap-outside dismissal on modals.

---

## 2. User Experience & Visual Design

```
+-------------------------------------------------------------------------+
| [Share2 Icon] DropTop                                                   |  <- Clean Header (Tagline & Badge Removed)
+-------------------------------------------------------------------------+
|                                                                         |
|            + - - - - - - - - - - - - - - - - - - - - - - - +            |
|            |                [ Radar Card ]                 |            |
|            |                                               |            |
|            |              (•) Center Avatar                |            |
|            |            [Your Device Name: Edit]           |            |
|            |                                               |            |
|            |        (•) Nearby Peers orbiting              |            |
|            + - - - - - - - - - - - - - - - - - - - - - - - +            |
|                                                                         |
|                +---------------------------------------+                |
|                |  [Refresh] Scan | [Clock] History | [Cog] Settings  |   <- Pristine 3-Action Dock
|                +---------------------------------------+                |
+-------------------------------------------------------------------------+

[ HISTORY MODAL TOUCH-OUTSIDE BEHAVIOR ]
+-------------------------------------------------------------------------+
| Backdrop (tap here -> closes modal)                                     |
|              +-------------------------------------------+              |
|              | History Card Container                    |              |
|              | (e.stopPropagation prevents close on card)|              |
|              +-------------------------------------------+              |
+-------------------------------------------------------------------------+
```

---

## 3. Implementation Steps

1. **Top Header Clean-Up (`src/App.tsx`)**:
   - Remove `<p className="text-[11px] text-[var(--secondary-text)]">P2P Lossless Direct Share</p>`.
   - Remove the `<div className="flex items-center gap-2 px-3 py-1.5 rounded-full ...">...Discoverable...</div>` pill badge from the header bar.
2. **Bottom Dock Clean-Up (`src/App.tsx`)**:
   - Remove the divider and the Security / PenTest button from the bottom dock, restoring the clean 3-button tray (`Scan | History | Settings`).
3. **Settings Modal Polish (`src/App.tsx`)**:
   - Remove `<p className="text-xs text-[var(--secondary-text)]">Receive files without prompt</p>` under Auto-Accept.
   - Rename "Sound Effects" to "Sound", and remove `<p className="text-xs text-[var(--secondary-text)]">Play sounds on transfer</p>`.
   - Remove the Penetration Audit card completely from the Settings options list.
4. **History Modal Outside-Tap Dismissal (`src/App.tsx`)**:
   - Update the History modal backdrop `motion.div` with `onClick={() => setShowHistory(false)}`.
   - Attach `onClick={(e) => e.stopPropagation()}` to the inner modal card so clicks inside do not close the card.
   - Ensure the same smooth outside-click dismissal works seamlessly on mobile touch and desktop.
5. **Verification**:
   - Run `lint_applet` and `compile_applet` to confirm zero regressions.
