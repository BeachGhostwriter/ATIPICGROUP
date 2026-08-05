# Adding WAVE Merge to your local Neptune1 app

## What "the website" actually is

Clicking `launch_neptune.bat` starts a small local web server (Streamlit)
on your own PC and opens it in your browser — that's why it looks like a
website. It's not the same thing as `adrian-clements.com`, which is a
separate static page that just describes/links to Neptune1. The real app
and its code only exist in your local folder:
`E:\general\OneDrive\AMC website\Claude\Neptune1`

So "putting this into the website" = adding files into that local folder
so they show up next time you launch it.

## Steps

1. **Locate your Neptune1 folder.** It should already contain `Home.py`,
   `launch_neptune.bat`, and a `utils/` folder. If there's no `pages/`
   folder yet, that's fine — Streamlit creates the sidebar navigation
   automatically from whatever's inside `pages/`.

2. **Copy two things from this download into that folder:**

   ```
   <your Neptune1 folder>/
   ├── Home.py                    (already there)
   ├── launch_neptune.bat         (already there)
   ├── utils/                     (already there)
   ├── pages/
   │   └── 7_WAVE_Merge.py        <- copy this in
   └── wave_merge/                <- copy this whole folder in
       ├── __init__.py
       ├── models.py
       ├── wave_adapter.py
       ├── excel_cost_engine.py
       ├── pretreatment.py
       ├── posttreatment.py
       ├── concentrate.py
       ├── blue_circle.py
       ├── merge_engine.py
       └── report.py
   ```

   If you already have other pages in `pages/` (e.g. `1_Company_Data.py`),
   just drop `7_WAVE_Merge.py` in alongside them — the number just controls
   sidebar ordering.

3. **Close Neptune1 if it's running, then double-click `launch_neptune.bat`
   again.** A new sidebar entry called "WAVE Merge" should appear.

4. **Open Neptune1's Home page first** (Company Data / Treatment Solutions
   tabs) so `total_inlet_flow`, `selected_treatments`, etc. are populated —
   the new page reads those live, it doesn't ask you to re-enter anything.

5. **Go to the WAVE Merge page**, upload
   `Calculation_BQ_3stages_80m³_master_spain.xlsx` (or your real WAVE
   Detailed Report export, if you have one by then) in the second upload
   box, and the merged report renders inline.

## If step 3 shows an import error

Most likely cause: `pip install openpyxl` hasn't been run in whatever
Python environment `launch_neptune.bat` uses. Open a terminal in the
Neptune1 folder and run:

```
pip install openpyxl
```

then relaunch.

## Why this design (vs. the standalone HTML report from before)

Running inside Neptune1 means the merge reads `total_inlet_flow`,
`selected_treatments`, and the rest straight from the live session —
no export/import step, no risk of comparing stale numbers. The
`neptune_export_snippet.py` / `neptune_adapter.py` JSON path from before
still exists and is useful if you ever want to run this merge *outside*
Neptune1 (e.g., as a scheduled script producing a report without opening
the app), but for day-to-day use inside the app, this page is the way to
go.

## One rough edge to know about

`wave_merge/merge_engine.py` and its neighbours import each other with
plain names (`import pretreatment`, not `import wave_merge.pretreatment`).
That's intentional and works fine — the page script adds the `wave_merge/`
folder itself to `sys.path`, so those files resolve as top-level modules —
but it does mean, technically, some classes get imported twice under two
different names if you ever import from both `wave_merge.models` and
`models` in the same session. Doesn't cause problems for this page as
written. If it ever does, the fix is switching the internal imports to
`from wave_merge import pretreatment` style — say the word and I'll do it.
