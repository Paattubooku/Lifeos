# Kickoff prompt for Claude Code

## Before you start (PTR)

The repo is already set up: docs, designs, `.gitignore`, `.env.example`, and the progress/decision/later files are on the `main` branch.

1. Clone it and switch to `main`:
   `git clone https://github.com/Paattubooku/lifeos.git && cd lifeos && git checkout main`
2. Create `.env` from `.env.example` and fill in your Supabase URL and anon key.
3. Run `claude` in the folder and paste the prompt below. Claude Code clones your old repos itself.

## Prompt to paste (session 1: read only, no code)

```
Read CLAUDE.md, PRD.md, design/INDEX.md and design/DESIGN_NOTES.md fully.

1. Clone the reference repos read-only into reference/ using the command in PRD.md §2,
   and add reference/ to .gitignore.
2. Read the files listed in PRD.md §2.2. Write REFERENCE_NOTES.md: for each row confirm
   the file exists, summarise what you'll port (2–4 bullets), and flag gaps vs the PRD.
3. Look at design/screens/Main.png, Components-1-Dark.png and Components-2-Dark.png and
   read design/source/Main.dc.html. List the tokens, fonts and shared components you'll
   create in src/ui for F00, and anything in the designs you can't do in React Native.
4. Stop and show me the reference notes and the component list. Don't write app code yet.
```

## Session 2: F00

```
Build F00 (Project scaffold) exactly as in PRD §8, with the tokens from PRD §7.2, both
themes, the fonts and the src/ui components from the component sheets in design/.
Run typecheck, lint and test. Update PROGRESS.md, tell me how to open it on my phone, stop.
```

## Every feature after that

```
next — build <F-ID>. Read its "Reference" files, its PRD spec, its rows in design/INDEX.md
(dark and light PNGs + .dc.html) and any rows about it in design/DESIGN_NOTES.md.
List the screens and states you'll build, build them, run all checks, update PROGRESS.md,
list any differences from the design and why, then stop.
```

Then test it on your phone, commit, and type `/clear` before the next feature.

## If something goes wrong

```
Stop. Re-read the acceptance criteria for <F-ID>. List which ones currently fail and why,
then fix only those. Don't touch other features.
```
