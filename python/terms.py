"""
terms.py - keywords from the WHOLE posting, in any field, with no skill list.

The skill dictionary (keyword_extractor.py + OaSIS) only knows the skills somebody wrote down. A posting for a
chef, a nurse or a welder is full of keywords that no list contains. This file reads every phrase instead.

HOW A PHRASE IS FOUND  (the same steps run in docs/matcher.js, and test/test_oasis.py checks they agree)
    1. The text is folded: lowercase, no accents, straight quotes and dashes.
    2. It is cut into words. Everything that is not a word is a break: punctuation, brackets, slashes, a dash
       with spaces around it, the end of a line.
    3. A run of words that is not interrupted by a break or by a "filler" word is a phrase.
       Filler words are the little words of English and French (the, of, de, pour...) and the words every
       posting repeats whatever the job is (experience, skills, ability, team, years, benefits...). They are
       listed below, so you can read and change them.
    4. Words that already belong to a skill from the dictionary are cut out first, so a skill is never
       counted twice. The words left over still become phrases.
    5. A run longer than four words is cut into pieces of three.
    6. Plurals are ignored ("dashboards" = "dashboard"). Each phrase is counted once, with how often it appears.

HOW A PHRASE IS COMPARED WITH THE CV  (nothing is guessed)
    MATCH  the same words, next to each other, are written on the CV.
    CLOSE  not the same phrase, but the CV has the same word stem ("planning" ~ "plan") or, for a phrase of two
           or more words, one of its main words on the same CV line. Listed with the CV line, never counted
           as a match, worth half in the second coverage figure.
    GAP    nothing like it on the CV.

Standard library only.
"""
import re

import oasis

# ---------------------------------------------------------------------------------------------------------
# THE WORD LISTS (folded: lowercase, no accents)
# ---------------------------------------------------------------------------------------------------------
STOP_EN = """a about above across after again against all almost along already also although always am among an and
any anyone are around as at be because been before being below between both but by can cannot could did do does doing
down during each either else etc even ever every few for from further had has have having he her here hers him his how
however i ie eg if in into is it its itself just let may me might more most much must my no nor not of off on once one
only onto or other others otherwise our ours out over own per perhaps rather same shall she should since so some
somewhat such than that the their theirs them themselves then there therefore these they this those though through
throughout thus to too toward towards under unless until up upon us very via vs versus was we were what whatever when
whenever where whereas whether which while who whom whose why will with within without would yet you your yours""".split()

STOP_FR = """a afin ai ainsi alors apres assez au aucun aussi autre autres aux avant avec avoir bien car ce ceci cela celle
celles celui ces cet cette ceux chaque chez comme comment contre dans de depuis des dessus devant donc dont du elle elles
en encore entre envers est et etc etre fait faut il ils je jusqu la le les leur leurs lors lorsque ma mais me meme mes
moi moins mon ne ni nos notre nous on ont or ou par parmi pas pendant peu peut peuvent plus plusieurs pour pourquoi puis
puisque qu quand que quel quelle quelles quels qui sa sans se selon ses si soit son sont sous sur ta tant te tel telle
tels tes toi ton tous tout toute toutes tres tu un une vers via voire vos votre vous y""".split()

# Words every posting repeats, whatever the job. They are never a keyword and they end a phrase.
FILLER = """
experience experiences experienced year years month months week weeks day days hour hours daily time times
skill skills ability abilities able capable capacity strong strongly excellent good great solid proven demonstrated
demonstrate knowledge knowledgeable understanding familiarity familiar proficiency proficient comfortable
working work works worked team teams role roles position positions job jobs candidate candidates applicant applicants
company companies organization organizations organisation organisations opportunity opportunities
responsibilities responsibility responsible requirement requirements required require requires requiring
qualification qualifications qualified preferred prefer prefers asset assets plus nice bonus ideal successful
including include includes included such well new high higher highly level levels related relevant various variety
several many multiple number range based specific certain similar existing current future ongoing regular overall key
main primary full part
ensure ensures ensuring support supports supporting provide provides providing use used uses using need needs needed
looking seek seeking join joining help helps helping make makes making take takes taking get gets getting want wants
like likely
develop develops developing developed manage manages managing managed perform performs performing performed
assist assists assisting participate participates participating collaborate collaborates collaborating
contribute contributes contributing maintain maintains maintaining conduct conducts conducting identify identifies
identifying prepare prepares preparing learn learns learning implement implements implementing deliver delivers
delivering communicate communicates communicating
apply application applications applying resume cv cover letter submit email contact website www http https com click
link follow
employer employment equal regardless race religion gender sexual orientation disability veteran accommodation
accommodations benefits benefit insurance vacation dental salary compensation pension retirement
internship internships intern interns stage stages stagiaire stagiaires co op coop student students etudiant etudiants
etudiante etudiantes winter summer fall spring autumn hiver ete automne printemps
january february march april may june july august september october november december
monday tuesday wednesday thursday friday saturday sunday
montreal quebec canada canadian ontario qc
experience experiences annee annees an ans mois semaine semaines jour jours heure heures temps
competence competences capacite capacites solide bon bonne bons bonnes excellente excellents excellentes
connaissance connaissances maitrise comprehension travail travailler travaille equipe equipes poste postes emploi
candidat candidate candidats candidates entreprise entreprises occasion occasions responsabilite responsabilites
exigence exigences requis requise requises qualifications atout atouts souhaite souhaitee souhaites
incluant inclut comprend notamment nouveau nouvelle niveau niveaux lie liee lies liees pertinent pertinente pertinents
divers diverse diverses assurer soutenir fournir utiliser utilisation besoin besoins recherche recherchons rejoindre
aider cle cles principal principale ensemble plein
avantages avantage assurance assurances vacances salaire remuneration egalite diversite
stagiaire stagiaires
aim aims aimed aiming offer offers offered offering promote promotes promoting define defines defined create creates
creating created organize organizes organise organises recommend recommends recommended meet meets complete completes
completed completing carry carries carried reside resides resided currently pursuing pursue pursues previous past
ready way ways success successfully actively closely directly independently effectively efficiently regularly
typically primarily approximately especially particularly ideally preferably additionally
one two three four five six seven eight nine ten half
un deux trois quatre cinq sept huit neuf dix
analyser analyserez preparer preparerez participer participerez animer animerez realiser realiserez effectuer
effectuerez collaborer collaborerez contribuer contribuerez developper developperez gerer identifier proposer suivre
assister assisterez communiquer produire travaillerez profil profile
avez etes serez soyez pouvez devez ferez invitons poser certaine maniere principalement exclusivement uniquement
egalement neanmoins toujours lire comprendre ecrire parfois sometimes read write understand consider selected given
regard attention version langue cliquez consultez effectue cours mesure place
weekly monthly yearly quarterly update updates enrolled tasks duties different
supported supports tracked happen empowered grow proud together person left end
interne internes externe externes nouveaux nouvelles differents differentes principaux principales important importants
importante importantes efficace efficaces solides fort forte forts fortes grand grande grands grandes minimum minimale
quotidien quotidienne quotidiens regulier reguliere possede possedez posseder environ membre membres offre offrons offrir
sens aptitude aptitudes habilete habiletes titre domaine domaines nombre type types partie parties
""".split()

STOP = frozenset(STOP_EN) | frozenset(STOP_FR) | frozenset(FILLER)

# Words too broad to say two phrases are close, and too broad to be a keyword on their own.
WEAK = frozenset("""management manager managers system systems process processes service services technical technique
general information business development environment solution solutions tool tools
gestion gestionnaire systeme systemes processus technique information developpement outil outils""".split())

MAX_WORDS = 4          # a run longer than this is cut into pieces of CHUNK words
CHUNK = 3

TOKEN_RE = re.compile(r"[a-z0-9]+(?:[.&][a-z0-9]+)*[+#]*")
NUMERIC_RE = re.compile(r"^(?:[0-9]+[+#]*|[0-9]+(?:\.[0-9]+)+)$")
YEAR_RE = re.compile(r"^(?:19|20)[0-9][0-9]$")
JOIN_RE = re.compile(r"^(?:[ \t ]+|-)$")      # what may sit between two words of one phrase
SUFFIXES = ("ation", "ment", "ing", "ers", "er", "ors", "or", "ed", "ly", "ity", "ive", "al")


def nw(word):
    """A word without its plural, so 'dashboards' and 'dashboard' are one word."""
    if len(word) > 3:
        if word.endswith("ies"):
            return word[:-3] + "y"
        if word.endswith(("sses", "xes", "ches", "shes")):
            return word[:-2]
        if word.endswith("s") and not word.endswith(("ss", "us", "is")):
            return word[:-1]
    return word


def stem(word):
    """A rough word stem: 'planning', 'planner' and 'plan' share one."""
    w = nw(word).replace("z", "s")
    for suf in SUFFIXES:
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            w = w[: -len(suf)]
            if len(w) > 3 and w[-1] == w[-2] and w[-1] not in "ls":
                w = w[:-1]
            break
    if len(w) > 4 and w.endswith("e"):
        w = w[:-1]
    return w


def _chunks(run):
    if len(run) <= MAX_WORDS:
        return [run]
    out, i = [], 0
    while len(run) - i > MAX_WORDS:
        out.append(run[i:i + CHUNK])
        i += CHUNK
    out.append(run[i:])
    return out


def runs_in_line(line, covered=()):
    """The phrases (lists of (word, start, end)) of one folded line. `covered` = spans taken by dictionary skills."""
    runs, cur, prev_end = [], [], 0

    def flush():
        nonlocal cur
        if cur:
            runs.append(cur)
        cur = []

    for m in TOKEN_RE.finditer(line):
        t, a, b = m.group(), m.start(), m.end()
        if cur and not JOIN_RE.match(line[prev_end:a]):
            flush()
        numeric = bool(NUMERIC_RE.match(t))
        if (len(t) < 2 or t in STOP or any(x <= a and b <= y for x, y in covered)
                or (numeric and (not cur or len(t) > 4 or YEAR_RE.match(t)))):
            flush()
            continue
        cur.append((t, a, b))
        prev_end = b
    flush()
    return [piece for run in runs for piece in _chunks(run)]


def usable(words):
    """A single word must be a real word: at least 3 letters, not a number, not a broad word."""
    if len(words) > 1:
        return True
    w = words[0]
    return len(w) >= 3 and not NUMERIC_RE.match(w) and w not in WEAK


def extract_terms(text, covered_fn=None):
    """Every phrase of the text: {key: {"words", "name", "count", "first", "line"}} in order of first appearance.
    covered_fn(folded_line) -> [(a, b), ...] gives the spans taken by dictionary skills on that line."""
    out = {}
    for n, raw in enumerate(str(text).split("\n")):
        line = oasis.fold(raw)
        covered = covered_fn(line) if covered_fn else ()
        for run in runs_in_line(line, covered):
            words = [nw(t) for t, _, _ in run]
            if not usable(words):
                continue
            key = " ".join(words)
            if key in out:
                out[key]["count"] += 1
            else:
                out[key] = {"words": words, "name": " ".join(t for t, _, _ in run), "count": 1,
                            "first": (n, run[0][1]), "line": line.strip()}
    return out


# ---------------------------------------------------------------------------------------------------------
# WHERE A PHRASE SITS IN THE POSTING (same heading words as docs/matcher.js)
# ---------------------------------------------------------------------------------------------------------
HEAD_PREFERRED = re.compile(r"nice to have|preferred|an asset|atout|assets\b|un plus|souhait")
HEAD_TASK = re.compile(r"responsibilit|responsabilit|what you.ll do|your role|votre role|\btasks\b|mandat|\btaches\b|your challenges|vos defis|accountabilit|contributions|vos fonctions|ce que vous ferez|what you will|\bduties\b|quotidien|day.to.day|a quoi ressemblera|what you.ll be doing|what will you|a quoi vous attendre|what to expect|description du poste|job description|a propos du poste|about the (role|position|job)")
HEAD_REQUIRED = re.compile(r"qualification|requirement|\brequis\b|exigence|your profile|votre profil|your skills|key skills|required skills|competences requises|how to thrive|what you bring|ce que vous apportez|profil recherche|profil du candidat|ce que nous recherchons|ideal candidate|must have|you have|vous avez|il vous faut|pour reussir|what you need|to succeed|looking for|nous recherchons|ce que nous cherchons|vous possedez|bring to the role|about you|a propos de vous")
HEAD_ABOUT = re.compile(r"about us|about the company|about our|who we are|our (story|values|culture|mission|company|people)|why join|why work|why you.ll|what we offer|we offer|benefits|perks|compensation|equal opportunity|diversity|inclusion|accommodat|how to apply|application process|a propos de nous|a propos de l.entreprise|qui sommes|notre (entreprise|culture|mission|histoire)|^a propos de |^about |travailler chez|work(ing)? (at|for) |life at|rejoignez|join (us|our)|avantages|ce que nous offrons|nous offrons|remuneration|egalite|diversite|comment postuler")
PREFERRED_LINE = re.compile(r"\bassets?\b|nice to have|preferred|\batouts?\b|un plus")


def line_tags(text):
    """One tag per line: "", "Required", "Task", "Preferred" or "About". A short line with a heading word
    (Responsibilities, Requirements, Benefits...) sets the tag for the lines under it, until the next heading.
    "About" = company, benefits, equal-opportunity and application text: its phrases are listed, not counted."""
    out, tag = [], ""
    for raw in str(text).split("\n"):
        t = oasis.fold(raw).strip()
        if t and len(t.split()) <= 8 and not re.search(r"[.;,]$", t) and not re.match(r"[-*\u2022\d]", t):
            new = ("Preferred" if HEAD_PREFERRED.search(t) else "Task" if HEAD_TASK.search(t)
                   else "Required" if HEAD_REQUIRED.search(t) else "About" if HEAD_ABOUT.search(t) else None)
            if new:
                tag = new
        out.append(tag)
    return out


def term_tag(entry, tags):
    """The tag of a phrase found by extract_terms: an 'asset' line is Preferred, else the heading above it."""
    if PREFERRED_LINE.search(entry.get("line", "")):
        return "Preferred"
    return tags[entry["first"][0]]


# ---------------------------------------------------------------------------------------------------------
# THE CV SIDE
# ---------------------------------------------------------------------------------------------------------
def index_cv(text):
    """The CV as lines of words: [{"line": folded text, "toks": [(nw, stem, start, end), ...]}]."""
    lines = []
    for raw in str(text).split("\n"):
        line = oasis.fold(raw)
        toks = [(nw(m.group()), stem(m.group()), m.start(), m.end()) for m in TOKEN_RE.finditer(line)]
        lines.append({"line": line.strip(), "toks": toks, "text": line})
    return lines


def _joined(text, a, b):
    return bool(JOIN_RE.match(text[a:b]))


def match_term(words, ix):
    """('M', info) when the phrase is written on the CV, ('R', info) when something close is, else ('G', None).
    info = {"line": the CV line, "shared": [words]} (for M, shared is the whole phrase)."""
    n = len(words)
    for item in ix:
        toks = item["toks"]
        for i in range(len(toks) - n + 1):
            if all(toks[i + k][0] == words[k] for k in range(n)) and \
                    all(_joined(item["text"], toks[i + k][3], toks[i + k + 1][2]) for k in range(n - 1)):
                return "M", {"line": item["line"], "shared": list(words), "span": (toks[i][2], toks[i + n - 1][3])}
    stems = [stem(w) for w in words]
    if n == 1:
        for item in ix:
            for t in item["toks"]:
                if t[1] == stems[0] and len(stems[0]) >= 3:
                    return "R", {"line": item["line"], "shared": [words[0]], "cv_word": t[0]}
        return "G", None
    main = [(w, s) for w, s in zip(words, stems) if w not in WEAK and len(w) >= 4]
    need = 1 if n <= 3 else 2
    best = None
    for item in ix:
        have = {t[1] for t in item["toks"]}
        shared = [w for w, s in main if s in have]
        if len(shared) >= need and (best is None or len(shared) > len(best["shared"])):
            best = {"line": item["line"], "shared": shared}
    return ("R", best) if best else ("G", None)


def match_terms(terms, ix):
    """{key: ('M' | 'R' | 'G', info)} for every phrase of a posting."""
    return {k: match_term(t["words"], ix) for k, t in terms.items()}
