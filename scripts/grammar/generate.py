"""Writes the board's word forms (see docs/rules/project/boards.md, "Word form rules"):

- src/utilities/grammar/verbForms.ts: the present stem and da-infinitive of every verb the board
  conjugates: the picture bank's (every word, or last word of a phrase, in -ma that Vabamorf
  conjugates) and verbs.txt;
- src/utilities/grammar/wordForms.ts: the partitive of the picture bank's nouns (a plural noun's in
  the plural), adjectives and numerals (and of the people in words.txt), for objects ("tahan õuna")
  and numbers ("kaks kassi").

Vabamorf (EstNLTK) makes the forms and tells nouns from adjectives. It is only needed here, on a
developer's machine; the app reads the generated files.

    python3 -m venv /tmp/estnltk && /tmp/estnltk/bin/pip install estnltk==1.7.5
    /tmp/estnltk/bin/python scripts/grammar/generate.py

A word with two forms of the same kind (Vabamorf knows "jooksta" and "joosta", "kooli" and
"koola") stops the script until PREFERRED names the one the board says.
"""

import csv
import re
import sys
from pathlib import Path

from estnltk.vabamorf.morf import Vabamorf, synthesize

ROOT = Path(__file__).resolve().parents[2]
BANK = ROOT / 'scripts/pildipank/sonavara.csv'
EMOJI = ROOT / 'scripts/pildipank/emoji.csv'
EXTRA_VERBS = ROOT / 'scripts/grammar/verbs.txt'
EXTRA_WORDS = ROOT / 'scripts/grammar/words.txt'
VERBS_OUT = ROOT / 'src/utilities/grammar/verbForms.ts'
WORDS_OUT = ROOT / 'src/utilities/grammar/wordForms.ts'

# The form the board says where Vabamorf gives two: (word, form) -> word. A verb's 1st person
# singular sets its stem; a person form with two variants then takes the one on that stem ("lähe"
# gives "läheme", not "lähme"). For homonyms, the meaning the picture bank has (kool is a school,
# not cola; kurk a cucumber, tall a lamb).
PREFERRED: dict[tuple[str, str], str] = {
    # Verbs
    ('jooksma', 'da'): 'joosta',
    ('lõppema', 'n'): 'lõpen',
    ('mõtlema', 'da'): 'mõelda',
    ('sulgema', 'n'): 'sulen',
    ('sügelema', 'da'): 'sügeleda',
    ('ütlema', 'da'): 'öelda',
    # Nouns
    ('hall', 'S'): 'halli',
    ('jogurt', 'S'): 'jogurtit',
    ('kann', 'S'): 'kannu',
    ('kapp', 'S'): 'kappi',
    ('kook', 'S'): 'kooki',
    ('kool', 'S'): 'kooli',
    ('kott', 'S'): 'kotti',
    ('kruus', 'S'): 'kruusi',
    ('kurk', 'S'): 'kurki',
    ('lõvi', 'S'): 'lõvi',
    ('muuseum', 'S'): 'muuseumi',
    ('mänd', 'S'): 'mändi',
    ('müts', 'S'): 'mütsi',
    ('nukk', 'S'): 'nukku',
    ('pakk', 'S'): 'pakki',
    ('peomüts', 'S'): 'peomütsi',
    ('puding', 'S'): 'pudingut',
    ('rula', 'S'): 'rulat',
    ('ruut', 'S'): 'ruutu',
    ('siil', 'S'): 'siili',
    ('silm', 'S'): 'silma',
    ('sool', 'S'): 'soola',
    ('süst', 'S'): 'süsti',
    ('tall', 'S'): 'talle',
    ('tulp', 'S'): 'tulpi',
    ('vaal', 'S'): 'vaala',
    ('õlg', 'S'): 'õlga',
    # Adjectives
    ('armas', 'A'): 'armsat',
    # Numerals
    ('üks', 'N'): 'ühte',
    ('kaks', 'N'): 'kahte',
    ('üksteist', 'N'): 'ühteteist',
    ('kaksteist', 'N'): 'kahteteist',
    ('kolmteist', 'N'): 'kolmeteist',
    ('neliteist', 'N'): 'neljateist',
    ('viisteist', 'N'): 'viitteist',
    ('kuusteist', 'N'): 'kuutteist',
    ('seitseteist', 'N'): 'seitsetteist',
    ('kaheksateist', 'N'): 'kaheksatteist',
    ('üheksateist', 'N'): 'üheksatteist',
    ('kakskümmend', 'N'): 'kahtekümmend',
    ('kolmkümmend', 'N'): 'kolmekümmend',
    ('nelikümmend', 'N'): 'neljakümmend',
    ('viiskümmend', 'N'): 'viitekümmend',
    ('kuuskümmend', 'N'): 'kuutekümmend',
    ('seitsekümmend', 'N'): 'seitsetkümmend',
    ('kaheksakümmend', 'N'): 'kaheksatkümmend',
    ('üheksakümmend', 'N'): 'üheksatkümmend',
    ('sada', 'N'): 'sadat',
}

# The present forms besides the 1st person singular, with the ending each adds to the stem.
PERSON_ENDINGS = {'d': 'd', 'b': 'b', 'me': 'me', 'te': 'te', 'vad': 'vad'}

MA = re.compile(r'^[a-zäöüõšž]{2,}ma$')
ONE_WORD = re.compile(r'^[a-zäöüõšž]{2,}$')

# Words that keep their form in a sentence, though Vabamorf inflects them: "valmis" and "täis" don't
# inflect before a noun ("täis klaasi"), and "kohe" is "at once" (Vabamorf: "fluffy").
NOT_INFLECTED = {'kohe', 'täis', 'valmis'}

# Vabamorf's parts of speech the board inflects, and the names of their lists in wordForms.ts.
WORD_LISTS = {'S': 'NOUN_PARTITIVE', 'A': 'ADJECTIVE_PARTITIVE', 'N': 'NUMERAL_PARTITIVE'}


def bank_rows():
    with BANK.open(encoding='utf-8') as f:
        yield from (row for row in csv.DictReader(f) if row['kaasa'] == 'jah')
    with EMOJI.open(encoding='utf-8') as f:
        yield from (row for row in csv.DictReader(f) if row['kaasa'] == 'jah')


def word_list(path: Path) -> set[str]:
    words = set()
    for line in path.read_text(encoding='utf-8').splitlines():
        word = line.strip()
        if word and not word.startswith('#'):
            words.add(word)
    return words


def one(word: str, form: str, part: str, problems: list[str], on_stem: str | None = None) -> str:
    found = synthesize(word, form, part)
    if on_stem and len(found) > 1 and on_stem in found:
        return on_stem
    key_ = (word, form) if part == 'V' else (word, part)
    if key_ in PREFERRED:
        preferred = PREFERRED[key_]
        if preferred not in found:
            problems.append(f'{word} {form} {part}: PREFERRED {preferred!r} is not one of {found}')
        return preferred
    if len(found) != 1:
        problems.append(f'{word} {form} {part}: {found or "no form"}')
        return found[0] if found else ''
    return found[0]


def verbs(problems: list[str]) -> tuple[list[tuple[str, str, str, dict[str, str]]], int, list[str]]:
    bank: set[str] = set()
    skipped: list[str] = []
    with BANK.open(encoding='utf-8') as f:
        for row in csv.DictReader(f):
            last = row['sõna'].strip().lower().split(' ')[-1]
            if not MA.match(last):
                continue
            if synthesize(last, 'n', 'V'):
                bank.add(last)
            else:
                skipped.append(row['sõna'])

    rows = []
    for verb in sorted(bank | word_list(EXTRA_VERBS)):
        first = one(verb, 'n', 'V', problems)
        if not first.endswith('n'):
            problems.append(f'{verb} n: {first!r} does not end in -n')
            continue
        stem = first[:-1]
        irregular = {}
        for form, ending in PERSON_ENDINGS.items():
            word = one(verb, form, 'V', problems, on_stem=stem + ending)
            if word != stem + ending:
                irregular[form] = word
        rows.append((verb, stem, one(verb, 'da', 'V', problems), irregular))
    return rows, len(bank), skipped


def words(problems: list[str]) -> tuple[dict[str, dict[str, str]], list[str]]:
    """The partitive of every one-word bank word Vabamorf knows as a noun, adjective or numeral in the
    nominative singular, by part of speech. A word that is both (punane, tark) is in both lists."""
    candidates = sorted(
        {row['sõna'].strip().lower() for row in bank_rows() if row['kategooria'] != 'Tähed'}
        | word_list(EXTRA_WORDS)
    )
    candidates = [word for word in candidates if ONE_WORD.match(word) and word not in NOT_INFLECTED]
    analyses = Vabamorf.instance().analyze(candidates, guess=False, disambiguate=False, propername=False)

    lists: dict[str, dict[str, str]] = {part: {} for part in WORD_LISTS}
    unknown = []
    for word, analysis in zip(candidates, analyses):
        if not analysis['analysis']:
            unknown.append(word)
            continue
        parts = {
            a['partofspeech']
            for a in analysis['analysis']
            if a['form'] == 'sg n' and re.sub(r'[_=+]', '', a['root']) == word
        }
        for part in parts & set(WORD_LISTS):
            lists[part][word] = one(word, 'sg p', part, problems)
        # A noun in the plural ("helbed", "lihapallid") takes the plural partitive: the short one
        # where there are two (kingi, sokke, not kingasid, sokkisid).
        if not parts:
            lemmas = {a['lemma'] for a in analysis['analysis'] if a['form'] == 'pl n' and a['partofspeech'] == 'S'}
            found = sorted({form for lemma in lemmas for form in synthesize(lemma, 'pl p', 'S')})
            if found:
                lists['S'][word] = min(found, key=len)
    return lists, unknown


def main() -> None:
    problems: list[str] = []
    verb_rows, bank_verbs, skipped = verbs(problems)
    word_lists, unknown = words(problems)

    if problems:
        print('Fix these (PREFERRED or the lists):', *problems, sep='\n  ', file=sys.stderr)
        sys.exit(1)

    header = [
        '// Generated by scripts/grammar/generate.py with Vabamorf (EstNLTK). Edit the word lists there',
        "// (scripts/grammar/*.txt, the picture bank's CSV files) and rerun it; don't edit this file.",
        '//',
    ]

    lines = header + [
        '// Each verb: its present stem (the forms are the stem plus -n, -d, -b, -me, -te, -vad, and the',
        '// stem alone after "ei") and its da-infinitive.',
        'export const VERB_FORMS: Record<string, readonly [present: string, da: string]> = {',
    ]
    for verb, stem, da, _ in verb_rows:
        lines.append(f"  {key(verb)}: ['{stem}', '{da}'],")
    lines += ['}', '', "// Present forms that are not the stem plus the ending, by Vabamorf's form code."]
    lines.append("export const IRREGULAR_PRESENT: Record<string, Partial<Record<'d' | 'b' | 'me' | 'te' | 'vad', string>>> = {")
    for verb, _, _, irregular in verb_rows:
        if irregular:
            forms = ', '.join(f"{form}: '{word}'" for form, word in irregular.items())
            lines.append(f'  {key(verb)}: {{ {forms} }},')
    lines += ['}', '']
    VERBS_OUT.write_text('\n'.join(lines), encoding='utf-8')

    lines = header + ['// The partitive singular of nouns, adjectives and numerals, by their nominative.']
    for part, name in WORD_LISTS.items():
        lines.append(f'export const {name}: Record<string, string> = {{')
        for word, partitive in sorted(word_lists[part].items()):
            lines.append(f"  {key(word)}: '{partitive}',")
        lines += ['}', '']
    WORDS_OUT.write_text('\n'.join(lines), encoding='utf-8')

    print(f'{len(verb_rows)} verbs ({bank_verbs} from the picture bank) -> {VERBS_OUT.relative_to(ROOT)}')
    counts = ', '.join(f'{len(word_lists[part])} {name}' for part, name in WORD_LISTS.items())
    print(f'{counts} -> {WORDS_OUT.relative_to(ROOT)}')
    if skipped:
        print('Bank words in -ma that are not verbs:', ', '.join(skipped))
    if unknown:
        print('Words Vabamorf does not know (not inflected):', ', '.join(unknown))


def key(word: str) -> str:
    return word if re.fullmatch(r'[a-zäöüõšž]+', word) else f"'{word}'"


if __name__ == '__main__':
    main()
