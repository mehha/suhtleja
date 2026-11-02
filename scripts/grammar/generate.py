"""Writes the board's word forms (see docs/rules/project/boards.md, "Word form rules"):

- src/utilities/grammar/verbForms.ts: the present stem, da-infinitive, past stem, past 3rd person
  singular and nud-participle (for "ei läinud") of every verb the board conjugates: the picture bank's (every word, or last word of a phrase, in -ma that Vabamorf
  conjugates) and verbs.txt;
- src/utilities/grammar/wordForms.ts: the partitive of the picture bank's nouns (a plural noun's in
  the plural), adjectives and numerals (and of the people in words.txt), for objects ("tahan õuna")
  and numbers ("kaks kassi"); the local cases of the places in places.txt ("lähen kooli", "olen
  koolis") and of the adjectives, for the adjectives before a place ("lähen suurde parki"); the
  comitative of the nouns and the genitive of the adjectives and numerals ("mängin suure autoga"),
  and the picture bank's vehicles ("sõidan bussiga") and animals (an owner: "kassi toit"); the plural partitive of the nouns and
  adjectives ("palju suuri kasse") and the substances in mass.txt ("palju vett").

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
PLACES = ROOT / 'scripts/grammar/places.txt'
MASS = ROOT / 'scripts/grammar/mass.txt'
VERBS_OUT = ROOT / 'src/utilities/grammar/verbForms.ts'
WORDS_OUT = ROOT / 'src/utilities/grammar/wordForms.ts'

# The form the board says where Vabamorf gives two: (word, form) -> word, and (word, part of
# speech) -> word for a noun's, adjective's or numeral's partitive. A verb's 1st person singular sets
# its stem; a person form with two variants then takes the one on that stem ("lähe" gives "läheme",
# not "lähme"). For homonyms, the meaning the picture bank has (kool is a school, not cola; kurk a
# cucumber, tall a lamb).
PREFERRED: dict[tuple[str, str], str] = {
    # Verbs
    ('jooksma', 'da'): 'joosta',
    ('lõppema', 'n'): 'lõpen',
    ('mõtlema', 'da'): 'mõelda',
    ('sulgema', 'n'): 'sulen',
    ('sügelema', 'da'): 'sügeleda',
    ('ütlema', 'da'): 'öelda',
    # "pidin minema" (had to), not "pidasin" (held)
    ('pidama', 'sin'): 'pidin',
    ('pidama', 's'): 'pidi',
    ('julgema', 'nud'): 'julgenud',
    ('laskma', 'sin'): 'lasin',
    ('laskma', 's'): 'lasi',
    ('mõtlema', 'nud'): 'mõelnud',
    ('sügelema', 'nud'): 'sügelenud',
    ('ütlema', 'nud'): 'öelnud',
    # Nouns
    ('hall', 'S'): 'halli',
    ('jogurt', 'S'): 'jogurtit',
    ('kann', 'S'): 'kannu',
    ('kapp', 'S'): 'kappi',
    ('kook', 'S'): 'kooki',
    ('kool', 'S'): 'kooli',
    ('kool', 'adt'): 'kooli',
    ('kool', 'sg in'): 'koolis',
    ('kool', 'sg el'): 'koolist',
    ('kapp', 'adt'): 'kappi',
    ('kapp', 'sg in'): 'kapis',
    ('kapp', 'sg el'): 'kapist',
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
    ('staadion', 'S'): 'staadionit',
    ('süst', 'S'): 'süsti',
    ('tall', 'S'): 'talle',
    ('tulp', 'S'): 'tulpi',
    ('vaal', 'S'): 'vaala',
    ('õlg', 'S'): 'õlga',
    # Comitatives
    ('jogurt', 'sg kom'): 'jogurtiga',
    ('kaste', 'sg kom'): 'kastmega',
    ('puding', 'sg kom'): 'pudinguga',
    ('päike', 'sg kom'): 'päikesega',
    ('põrsas', 'sg kom'): 'põrsaga',
    ('äike', 'sg kom'): 'äikesega',
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
# The past forms on the past stem besides the 1st person singular (the 3rd person singular is its own).
PAST_ENDINGS = {'sid': 'd', 'sime': 'me', 'site': 'te'}

MA = re.compile(r'^[a-zäöüõšž]{2,}ma$')
ONE_WORD = re.compile(r'^[a-zäöüõšž]{2,}$')

# Words that keep their form in a sentence, though Vabamorf inflects them: "valmis" and "täis" don't
# inflect before a noun ("täis klaasi"), and "kohe" is "at once" (Vabamorf: "fluffy").
NOT_INFLECTED = {'kohe', 'täis', 'valmis'}

# Places whose short illative is rarer than the long one ("tsirkusesse", not "tsirkusse").
LONG_ILLATIVE = {'bussipeatus', 'tsirkus'}

# The local cases of a place: sisse (illative, inessive, elative) or peale (allative, adessive,
# ablative), each where to, where and where from.
PLACE_CASES = {'sisse': ('ill', 'sg in', 'sg el'), 'peale': ('sg all', 'sg ad', 'sg abl')}
# The adjective cases, in this order, for the adjectives before a place.
ADJECTIVE_PLACE_CASES = ('ill', 'sg in', 'sg el', 'sg all', 'sg ad', 'sg abl')

# The picture bank's Transport words that are not vehicles; the Sport ones that are.
NOT_VEHICLES = {'bussipeatus', 'foor', 'tankla', 'vilkur'}
SPORT_VEHICLES = {'kelk', 'suusad', 'uisud'}

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
    key_ = (word, part) if form == 'sg p' and part != 'V' else (word, form)
    if key_ in PREFERRED:
        preferred = PREFERRED[key_]
        if preferred not in found:
            problems.append(f'{word} {form} {part}: PREFERRED {preferred!r} is not one of {found}')
        return preferred
    if len(found) != 1:
        problems.append(f'{word} {form} {part}: {found or "no form"}')
        return found[0] if found else ''
    return found[0]


def illative(word: str, part: str, problems: list[str], short: bool = True) -> str:
    """The short illative where Vabamorf has one (kooli, koju, majja), else the long (haiglasse)."""
    if short and synthesize(word, 'adt', part):
        return one(word, 'adt', part, problems)
    return one(word, 'sg ill', part, problems)


PLACE_KINDS = {'ruum', 'ese'}


def places(problems: list[str]) -> tuple[dict[str, tuple[str, str, str]], set[str], dict[str, str]]:
    """The local cases of every place in places.txt, the places whose cases are "on" (peale), and the
    rooms and things the bank files as things, by their kind (ruum, ese)."""
    listed: dict[str, tuple[str, str]] = {}
    kinds: dict[str, str] = {}
    for line in PLACES.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        word, cases, *rest = line.split()
        if cases not in (*PLACE_CASES, '-'):
            problems.append(f'places.txt: {word}: {cases!r} is not sisse, peale or -')
            continue
        kind = next((token for token in rest if token in PLACE_KINDS), None)
        lemma = next((token for token in rest if token not in PLACE_KINDS), word)
        if kind:
            kinds[word] = kind
        listed[word] = (cases, lemma)

    bank_places = {
        row['sõna'].strip().lower()
        for row in bank_rows()
        if row['kategooria'] == 'Kohad' and ONE_WORD.match(row['sõna'].strip().lower())
    }
    for word in sorted(bank_places - set(listed)):
        problems.append(f'places.txt: the picture bank place {word!r} is not listed')

    forms: dict[str, tuple[str, str, str]] = {}
    on: set[str] = set()
    for word, (cases, lemma) in sorted(listed.items()):
        if cases == '-':
            continue
        where_to, where, where_from = PLACE_CASES[cases]
        to = illative(lemma, 'S', problems, short=lemma not in LONG_ILLATIVE) if where_to == 'ill' else one(lemma, where_to, 'S', problems)
        forms[word] = (to, one(lemma, where, 'S', problems), one(lemma, where_from, 'S', problems))
        if cases == 'peale':
            on.add(word)
    return forms, on, kinds


def adjective_place_forms(adjectives: list[str]) -> dict[str, tuple[str, ...]]:
    """Each adjective in the local cases. Where Vabamorf has two forms the first is taken (väikeses,
    not väikses): both are right, and this list isn't reviewed word by word. The short illative only
    where it is the usual one before a noun (suurde, uude, väikesse); "musta majja" is "mustasse"."""
    result = {}
    for word in adjectives:
        found = []
        for case in ADJECTIVE_PLACE_CASES:
            if case == 'ill':
                short = [form for form in synthesize(word, 'adt', 'A') if form.endswith(('de', 'sse'))]
                found.append((short or synthesize(word, 'sg ill', 'A') or [''])[0])
            else:
                found.append((synthesize(word, case, 'A') or [''])[0])
        if all(found):
            result[word] = tuple(found)
    return result


def verbs(problems: list[str]) -> tuple[list[tuple[str, str, str, dict[str, str], tuple[str, str, str], dict[str, str]]], int, list[str]]:
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
        # The past: its stem from the 1st person singular (läksin, andsin), the 3rd person singular
        # on its own (läks, andis), and the nud-participle after "ei" (ei läinud).
        first_past = one(verb, 'sin', 'V', problems)
        if not first_past.endswith('n'):
            problems.append(f'{verb} sin: {first_past!r} does not end in -n')
            continue
        past_stem = first_past[:-1]
        irregular_past = {}
        for form, ending in PAST_ENDINGS.items():
            word = one(verb, form, 'V', problems, on_stem=past_stem + ending)
            if word != past_stem + ending:
                irregular_past[form] = word
        past = (past_stem, one(verb, 's', 'V', problems), one(verb, 'nud', 'V', problems))
        rows.append((verb, stem, one(verb, 'da', 'V', problems), irregular, past, irregular_past))
    return rows, len(bank), skipped


def comitative(word: str, partitive: str, plural: bool, problems: list[str]) -> str:
    """A noun's comitative (autoga, nukuga, klotsidega). Of two, the one on the partitive's stem
    (nukku gives nukuga, kooli kooliga)."""
    found = synthesize(word, 'pl kom' if plural else 'sg kom', 'S')
    if (word, 'sg kom') in PREFERRED and not plural:
        return one(word, 'sg kom', 'S', problems)
    if len(found) > 1:
        on_stem = [form for form in found if form[-3] == partitive[-1]]
        found = on_stem if len(on_stem) == 1 else found
    if len(found) != 1:
        problems.append(f'{word} kom: {found or "no form"}')
        return found[0] if found else ''
    return found[0]


def animals() -> set[str]:
    return {
        row['sõna'].strip().lower()
        for row in bank_rows()
        if row['kategooria'] == 'Loomad' and ONE_WORD.match(row['sõna'].strip().lower())
    }


def vehicles() -> set[str]:
    return {
        row['sõna'].strip().lower()
        for row in bank_rows()
        if ONE_WORD.match(row['sõna'].strip().lower())
        and (row['kategooria'] == 'Transport' or row['sõna'].strip().lower() in SPORT_VEHICLES)
    } - NOT_VEHICLES


def words(problems: list[str]) -> tuple[dict[str, dict[str, str]], list[str]]:
    """The partitive of every one-word bank word Vabamorf knows as a noun, adjective or numeral in the
    nominative singular, by part of speech. A word that is both (punane, tark) is in both lists."""
    extra_places = {line.split()[0] for line in word_list(PLACES)}
    candidates = sorted(
        {row['sõna'].strip().lower() for row in bank_rows() if row['kategooria'] != 'Tähed'}
        | word_list(EXTRA_WORDS)
        | extra_places
        | word_list(MASS)
    )
    candidates = [word for word in candidates if ONE_WORD.match(word) and word not in NOT_INFLECTED]
    analyses = Vabamorf.instance().analyze(candidates, guess=False, disambiguate=False, propername=False)

    lists: dict[str, dict[str, str]] = {part: {} for part in WORD_LISTS}
    lists['kom'] = {}
    lists['g'] = {}
    lists['pl'] = {}
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
            if part in ('S', 'A') and word not in lists['pl']:
                # After "palju": the short plural partitive where there are two (kasse, not
                # kassisid; õunu, not õunasid).
                plural = synthesize(word, 'pl p', part)
                if plural:
                    lists['pl'][word] = min(plural, key=len)
            if part == 'S':
                lists['kom'][word] = comitative(word, lists[part][word], False, problems)
            elif word not in lists['g']:
                # Before a noun in the comitative: suure autoga, kahe autoga (väikese, not väikse).
                lists['g'][word] = (synthesize(word, 'sg g', part) or [''])[0]
        # A noun in the plural ("helbed", "lihapallid") takes the plural partitive: the short one
        # where there are two (kingi, sokke, not kingasid, sokkisid).
        if not parts:
            lemmas = {a['lemma'] for a in analysis['analysis'] if a['form'] == 'pl n' and a['partofspeech'] == 'S'}
            found = sorted({form for lemma in lemmas for form in synthesize(lemma, 'pl p', 'S')})
            if found:
                lists['S'][word] = min(found, key=len)
                lists['pl'][word] = lists['S'][word]
                with_ = sorted({form for lemma in lemmas for form in synthesize(lemma, 'pl kom', 'S')})
                if with_:
                    lists['kom'][word] = min(with_, key=len)
    return lists, unknown


def main() -> None:
    problems: list[str] = []
    verb_rows, bank_verbs, skipped = verbs(problems)
    word_lists, unknown = words(problems)
    place_forms, on_places, place_kinds = places(problems)
    adjective_forms = adjective_place_forms(sorted(word_lists['A']))

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
        '// stem alone after "ei"), its da-infinitive, its past stem (plus -n, -d, -me, -te, -d), its past',
        '// 3rd person singular and its nud-participle (after "ei" in the past).',
        'export const VERB_FORMS: Record<',
        '  string,',
        '  readonly [present: string, da: string, past: string, past3: string, nud: string]',
        '> = {',
    ]
    for verb, stem, da, _, (past, past3, nud), _ in verb_rows:
        lines.append(f"  {key(verb)}: ['{stem}', '{da}', '{past}', '{past3}', '{nud}'],")
    lines += ['}', '', "// Present forms that are not the stem plus the ending, by Vabamorf's form code."]
    lines.append("export const IRREGULAR_PRESENT: Record<string, Partial<Record<'d' | 'b' | 'me' | 'te' | 'vad', string>>> = {")
    for verb, _, _, irregular, _, _ in verb_rows:
        if irregular:
            forms = ', '.join(f"{form}: '{word}'" for form, word in irregular.items())
            lines.append(f'  {key(verb)}: {{ {forms} }},')
    lines += ['}', '', "// Past forms that are not the past stem plus the ending, by Vabamorf's form code."]
    lines.append("export const IRREGULAR_PAST: Record<string, Partial<Record<'sid' | 'sime' | 'site', string>>> = {")
    for verb, _, _, _, _, irregular_past in verb_rows:
        if irregular_past:
            forms = ', '.join(f"{form}: '{word}'" for form, word in irregular_past.items())
            lines.append(f'  {key(verb)}: {{ {forms} }},')
    lines += ['}', '']
    VERBS_OUT.write_text('\n'.join(lines), encoding='utf-8')

    lines = header + ['// The partitive singular of nouns, adjectives and numerals, by their nominative.']
    for part, name in WORD_LISTS.items():
        lines.append(f'export const {name}: Record<string, string> = {{')
        for word, partitive in sorted(word_lists[part].items()):
            lines.append(f"  {key(word)}: '{partitive}',")
        lines += ['}', '']
    lines.append('// Places in the local cases: where to, where, where from (kooli, koolis, koolist).')
    lines.append('export const PLACE_FORMS: Record<string, readonly [to: string, at: string, from: string]> = {')
    for word, (to, at, from_) in place_forms.items():
        lines.append(f"  {key(word)}: ['{to}', '{at}', '{from_}'],")
    lines += ['}', '']
    lines.append('// Rooms the bank files as things: places all the same ("söön köögis").')
    lines.append('export const ROOM_PLACES = new Set([' + ', '.join(f"'{w}'" for w, k in sorted(place_kinds.items()) if k == 'ruum') + '])')
    lines.append('')
    lines.append('// Things that are also places: after a verb that takes no object ("magan voodis"), not after one that does.')
    lines.append('export const THING_PLACES = new Set([' + ', '.join(f"'{w}'" for w, k in sorted(place_kinds.items()) if k == 'ese') + '])')
    lines.append('')
    lines.append("// Places whose cases are \"on\" (turule, turul, turult), for the adjectives before them.")
    lines.append('export const ON_PLACES = new Set([' + ', '.join(f"'{word}'" for word in sorted(on_places)) + '])')
    lines.append('')
    lines.append('// The comitative of nouns: autoga, nukuga, klotsidega.')
    lines.append('export const NOUN_COMITATIVE: Record<string, string> = {')
    for word, form in sorted(word_lists['kom'].items()):
        lines.append(f"  {key(word)}: '{form}',")
    lines += ['}', '']
    lines.append('// The genitive of adjectives and numerals, before a noun in the comitative: suure autoga, kahe autoga.')
    lines.append('export const GENITIVE: Record<string, string> = {')
    for word, form in sorted(word_lists['g'].items()):
        if form:
            lines.append(f"  {key(word)}: '{form}',")
    lines += ['}', '']
    lines.append('// The plural partitive of nouns and adjectives, after "palju": palju suuri kasse.')
    lines.append('export const PLURAL_PARTITIVE: Record<string, string> = {')
    for word, form in sorted(word_lists['pl'].items()):
        lines.append(f"  {key(word)}: '{form}',")
    lines += ['}', '']
    mass = sorted(word_list(MASS))
    for word in mass:
        if word not in word_lists['S']:
            problems.append(f'mass.txt: {word!r} is not a noun Vabamorf knows')
    if problems:
        print('Fix these:', *problems, sep='\n  ', file=sys.stderr)
        sys.exit(1)
    lines.append('// Substances, after "palju" in the partitive singular: palju vett.')
    lines.append('export const MASS_NOUNS = new Set([' + ', '.join(f"'{word}'" for word in mass) + '])')
    lines.append('')
    lines.append("// The picture bank's animals, which can own what comes after them: \"kassi toit\".")
    lines.append('export const ANIMALS = new Set([' + ', '.join(f"'{word}'" for word in sorted(animals())) + '])')
    lines.append('')
    lines.append("// The picture bank's vehicles: \"sõidan bussiga\".")
    lines.append('export const VEHICLES = new Set([' + ', '.join(f"'{word}'" for word in sorted(vehicles())) + '])')
    lines.append('')
    lines.append('// Adjectives in the local cases: illative, inessive, elative, allative, adessive, ablative.')
    lines.append('export const ADJECTIVE_PLACE_FORMS: Record<string, readonly string[]> = {')
    for word, forms in adjective_forms.items():
        lines.append(f"  {key(word)}: [{', '.join(repr(form) for form in forms)}],")
    lines += ['}', '']
    WORDS_OUT.write_text('\n'.join(lines), encoding='utf-8')

    print(f'{len(verb_rows)} verbs ({bank_verbs} from the picture bank) -> {VERBS_OUT.relative_to(ROOT)}')
    counts = ', '.join(f'{len(word_lists[part])} {name}' for part, name in WORD_LISTS.items())
    print(f'{counts}, {len(place_forms)} places, {len(adjective_forms)} adjectives in the local cases -> {WORDS_OUT.relative_to(ROOT)}')
    if skipped:
        print('Bank words in -ma that are not verbs:', ', '.join(skipped))
    if unknown:
        print('Words Vabamorf does not know (not inflected):', ', '.join(unknown))


def key(word: str) -> str:
    return word if re.fullmatch(r'[a-zäöüõšž]+', word) else f"'{word}'"


if __name__ == '__main__':
    main()
