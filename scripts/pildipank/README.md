# Pildipank (picture bank)

Word lists and scripts for the shared picture bank in the media library: the `Pildipank` folder
with a subfolder per category, whose pictures every member browses in the card editor and finds in
its search and bulk add (see `docs/rules/project/symbols-ai.md` and `media.md`).

## Files

The two lists are the source of truth; edit them by hand (any spreadsheet keeps the CSV format) and
rerun the import.

- `emoji.csv`: Fluent Emoji 3D pictures. `kaasa=jah` rows go into the bank with `sõna` as the word
  and `kategooria` as the folder; the others were left out, with the reason in `märkus` (flip one to
  `jah` and give it a word to add it). `fluent_pilt` is the picture's path in the Fluent repository
  at `FLUENT_SHA` (`lib.ts`).
- `sonavara.csv`: the words emoji can't show well (pronouns in their cases, question words,
  imperatives, particles, verbs, adjectives, family, body, kitchen, kindergarten, Estonian food and
  holidays, letters, numbers). `pilt` says where each picture comes from:
  - `emoji`: a Fluent picture from `emoji.csv` (`viide` is the emoji). A word that is also in
    `emoji.csv` moves that picture into this list's category instead of adding a second one;
  - `mulberry`: a Mulberry symbol (CC BY-SA 4.0) labelled exactly with the English word `inglise`
    (`viide` is its URL). Words whose English has several meanings ("back", "light", "cold", "cut")
    were left to AI;
  - `tekst`: a text tile (`viide` is the text): letters, numbers, function words, abstract verbs;
  - `kujund`: a drawn shape (`viide`: `ring`, `ruut`, `kolmnurk`, `ristkülik`, `ovaal`, `romb`,
    `värv:#hex`, `nädal`, `nädal:N` or `nädal:N-M` for weekdays, `lipp:ee`);
  - `AI`: generated in the card editor's pictogram style from `ai_kirjeldus` by `generate-ai.ts`
    (`viide` is the file in `ai-pildid/` once it exists).
- `lib.ts`: the pure parts (CSV, which media to create, tiles and shapes, SVG sanitising), tested in
  `tests/int/picture-bank.int.spec.ts`. `import.ts` and `generate-ai.ts` do the Payload and
  Workers AI work.

Estonian notes behind the lists: "mul on" instead of "omama"; pronouns in the cases children need
(mul, mulle, mind, sul, sulle, tal, talle, meil, meile), because the board's word-form fix only
changes the next word; imperatives as their own cards (anna, tule, aita, ära tee); particles for
particle verbs (maha, ära, kinni, lahti, tagasi, kaasa); question words in the local cases (kuhu,
kust, kellele); "leib" (rye) is not "sai" (white); compounds come from two cards (kõht + valus).

## Sources and licences

- Fluent Emoji (https://github.com/microsoft/fluentui-emoji), MIT, © Microsoft Corporation, at
  commit `FLUENT_SHA`. The import puts "Fluent Emoji © Microsoft Corporation, MIT" in each
  picture's caption; the notice also belongs on the site's licence page. Don't use Microsoft's name
  as our branding.
- Mulberry Symbols (https://globalsymbols.com), CC BY-SA 4.0, © Steve Lee: the import puts the
  licence and author in each Mulberry picture's caption.
- The emoji words started from the Unicode CLDR 46 Estonian names, and the categories from the
  Unicode 15.1 emoji subgroups (Unicode License v3); both lists were then written and reviewed for
  Suhtleja. Don't copy another AAC product's word lists or pictures.
- AI pictures: Workers AI FLUX.2 klein (`SYMBOL_GENERATION_MODEL`), generated for Suhtleja.

## AI pictures

```sh
PILDIPANK_LIMIT=5 pnpm payload run scripts/pildipank/generate-ai.ts   # try a few
pnpm payload run scripts/pildipank/generate-ai.ts                     # every pilt=AI word without a picture
PILDIPANK_REDO="kauss,pott" pnpm payload run scripts/pildipank/generate-ai.ts   # a new seed for these
```

`generate-ai.ts` makes one pictogram per word from `ai_kirjeldus` with the card editor's style
(`buildPictogramPrompt`; descriptions of several people use its group variant), through Workers AI
(`wrangler login`, billed to the account, about $0.001 a picture). It saves 512 px JPEGs (resized
with macOS `sips`) to `ai-pildid/` and writes each file name into the word's `viide`. The seed
comes from the word, so a rerun usually repeats a picture; `PILDIPANK_REDO` moves to the next seed,
notes the attempt in `märkus` and names the file after it (`…-ai-v2.jpg`), so the import adds the
new picture instead of seeing an unchanged file name. To fix a bad picture, sharpen its
`ai_kirjeldus`, redo it, import, and run the clean-up below to retire the old one.

`ai-pildid/` is not in git (13 MB). Once imported, the pictures live in R2; keep a backup of the
folder for re-imports.

## Importing

```sh
PILDIPANK_DRY_RUN=1 pnpm payload run scripts/pildipank/import.ts   # what would change
pnpm payload run scripts/pildipank/import.ts                      # local D1 and R2
```

`payload run` passes no arguments to the script, so options are environment variables. The import
creates missing folders in `CATEGORY_ORDER` (the order the card editor shows), puts each category's
cover word (`CATEGORY_COVERS`) first, and creates or updates one picture per word. AI words without
a file in `ai-pildid/` are skipped, so the import also runs on a machine without that folder. It
never deletes: a word renamed in a list gets a new picture, and the old one stays until an admin
removes it. Importing to production needs the remote bindings (`NODE_ENV=production`) and explicit
permission.

Clean-up: after a word's picture is replaced (a Mulberry symbol swapped for AI, a redone AI
picture), the old one stays until the clean-up retires it. The clean-up also removes copies: run
one import at a time, because two at once both create the missing pictures and Payload stores the
second copy as `<name>-1.<ext>` (or, for a name ending in digits like an emoji code, counts the
number up: `…-2705.png` becomes `…-2706.png`).

```sh
PILDIPANK_REMOVE_DUPLICATES=1 PILDIPANK_DRY_RUN=1 pnpm payload run scripts/pildipank/import.ts   # list them
PILDIPANK_REMOVE_DUPLICATES=1 pnpm payload run scripts/pildipank/import.ts                      # remove them
```

A retired picture is a bank file no longer in the lists whose word has exactly one picture that is
(homonyms like "või" and words removed from the lists are left for an admin). The clean-up first
points any board card, board thumbnail or connect-dots puzzle that uses one at the current picture,
then deletes it.
