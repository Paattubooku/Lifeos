# Kickoff prompt for Claude Code

## Before you start (PTR)

1. Create a new GitHub repo `lifeos` (or an empty local folder) and put `PRD.md` and `CLAUDE.md` in its root.
2. Create a Supabase project named `lifeos`. Keep the URL + anon key ready, or connect the Supabase MCP to Claude Code.
3. Open the folder in Claude Code and paste the prompt below. Claude Code clones your old repos itself.

## Prompt to paste

```
Read CLAUDE.md and PRD.md fully.

1. Clone the reference repos read-only into reference/ using the command in PRD.md §2
   and add reference/ to .gitignore.
2. Read the files listed in PRD.md §2.2. Write REFERENCE_NOTES.md: for each row in §2.2,
   confirm the file exists, summarise the logic you will port in 2–4 bullets, and note any
   gap between the reference and the PRD. Flag anything useful in the repos that the PRD
   doesn't cover (don't build it; list it).
3. Then build F00 (Project scaffold) only, following PRD §8 and CLAUDE.md.

When F00's acceptance criteria pass and typecheck/lint/test are green, update PROGRESS.md,
tell me exactly how to run it on my phone, and stop.
```

## For every next feature

```
next — build <F-ID> exactly as specified in PRD.md. First read the reference files named in
its "Reference" line, then re-read its spec and acceptance criteria, list the files you'll
touch, build it, run all checks, update PROGRESS.md, then stop and tell me how to verify it
on my phone.
```

## If something goes wrong

```
Stop. Re-read the acceptance criteria for <F-ID>. List which ones currently fail and why,
then fix only those. Don't touch other features.
```
