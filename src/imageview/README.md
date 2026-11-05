# ImageView integration

Viewer, annotation helpers, styles and ZIP worker were imported from
`NDCLI/imageview` main commit `bedc1e2a130a68808d1a58a77a2ed809a168c8ad`.
The source checkout is `D:\Box\views`; its uncommitted changes were not imported.

`solid/pages/ViewerPage.jsx` retains the original two-buffer renderer, decoding,
paint handoff, zoom, pan, keyboard controls and box overlay. Its former browser
tab/storage/ZIP transport is replaced with a shared `ViewerSource`. CSS lives in
a Shadow DOM so it does not change the React app. Both Vite plugins have scoped
include/exclude filters; Solid JSX is not compiled with React.

Home owns the connection/file selection through `useFileProcessor`. All three
tools consume this selection. CVAT datasets retain `viewerPayload`, allowing
ImageView to use the same annotation/metadata snapshot without fetching another
copy on tab activation. Reload replaces the shared snapshot. ZIP receives the
selected dataset, including the selected XML in a multi-XML archive.

`metadata.ts` sorts full names with the original ZIP `localeCompare` comparator
and retains normalized CVAT frame IDs. Keys never depend on display order or
basename. Source-frame numbers used in included-frame metadata are converted
with the Task start frame and frame step.

Desktop frame sessions and the bounded disk cache live in
`desktop/imageview-service.cjs` and `desktop/imageview-cache.cjs`. ZIP's optional
web OPFS cache is disabled in this integration so it does not create a second
unbounded disk store. The ZIP worker still reads archive entries lazily. CVAT
uses compressed server frames; full-resolution ZIP images are not downsampled.

As of 1.1.2, `useJobImageCache` automatically starts full-Job caching on the
shared Home selection, independently of which tool tab is active. Background
requests remain in Electron and return only progress over IPC. The global
network scheduler prioritizes visible frames and bounds concurrency to three;
cache-key locks coalesce concurrent requests across viewer/background sessions.
Image metadata defines cache identity separately from annotation update dates.
Valid image cache is persistent across days. An active Job's keys are protected
from LRU eviction during download; insufficient quota is reported as an error.

Validation:

```powershell
npm run lint
npm test
npm run test:imageview:desktop
```

The desktop smoke test starts the actual production renderer/preload/main with
an isolated temporary profile and a local 5,000-frame fixture. It verifies the
single Home picker, shared snapshot/reload, frame identities, two-way navigation,
zoom, failed-image recovery, encrypted server-specific PAT storage and ZIP.
Reports/screenshots are written under ignored `build/imageview-smoke/`.

`desktop/imageview-live-smoke.cjs` is an optional read-only live test using the
local ignored `token.txt`. It never prints credentials. The optional baseline
benchmark needs the original ImageView build under `build/imageview-baseline`.
