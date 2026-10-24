// Rule-based classifier for job-application emails, English and French.
// Pure JavaScript with no runtime-specific APIs, so Deno (Edge Functions) and Node (tests) both import it.
//
// kind: confirmation | interview | rejection | offer | verification | other
// A heuristic, not a promise: every result carries confidence and the reasons that fired, and anything
// the matcher cannot place with confidence goes to the user for review instead of being guessed.

export const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’´`]/g, "'")
    .replace(/[ \s]+/g, " ")
    .trim();

const any = (res, text) => res.map((re) => (re.test(text) ? re.source.slice(0, 40) : null)).filter(Boolean);

// ---- phrase lists (all matched against accent-stripped, lower-case text) -------------------------
const REJECTION = [
  /we regret to (inform|let you know|tell you)/,
  /we are sorry to (inform|let you know|tell you)/,
  /unfortunately,? (we|your|after|the|at this|you)/,
  /will not be (moving|proceeding|going) forward/,
  /(not|won't|will not) be moving forward/,
  /decided to (move|go|proceed|continue) (forward )?with (other|another)/,
  /(pursue|pursuing|proceed with) (other|another) (candidate|applicant)/,
  /not (been )?selected/,
  /position (has been|is now|was) (filled|closed)/,
  /no longer (being )?(under )?consider/,
  /malheureusement/,
  /nous regrettons/,
  /nous avons le regret/,
  /(n'a|ne sera) pas (ete )?retenue?/,
  /ne (donnerons|pouvons donner) pas suite/,
  /poursuivre (avec|notre processus avec) d'autres/,
  /poste (a ete|est) (pourvu|comble)/,
];
const OFFER = [
  /(pleased|delighted|happy|thrilled) to (offer|extend)/,
  /offer of employment/,
  /(formal|written|verbal) (job )?offer/,
  /attached (is )?(your )?offer letter/,
  /nous avons le plaisir de vous (offrir|proposer|confirmer)/,
  /lettre d'offre/,
  /offre d'emploi (formelle|ferme)/,
];
const INTERVIEW = [
  /invit(e|ing|ation)[^.]{0,40}\b(interview|call|chat|conversation|screen|screening|assessment|meeting)\b/,
  /\b(schedule|book|arrange|set up|plan)\b[^.]{0,30}\b(an?|your|the)\b[^.]{0,15}\b(interview|call|phone screen|screening|chat|meeting|conversation)\b/,
  /\b(phone|video|virtual|technical|first[- ]round|second[- ]round|final[- ]round|initial) (screen|screening|interview|round)\b/,
  /(select|choose|pick)[^.]{0,20}\b(time|slot|date)\b/,
  /\bcalendly\b|\bgoodtime\b|\bavailabilit(y|ies)\b/,
  /online assessment|coding (challenge|test)|\bhackerrank\b|\bcodility\b|\bcodesignal\b|take-home (test|assignment|exercise)|assessment (link|invitation)/,
  /(aimerions|souhaitons|voudrions)[^.]{0,25}\b(vous )?(rencontrer|inviter|convier|planifier|organiser)/,
  /(planifier|fixer|organiser|prendre)[^.]{0,25}\b(entrevue|entretien|rendez-vous|appel)\b/,
  /invitation (a|pour) (une|un)[^.]{0,15}(entrevue|entretien)/,
  /vos disponibilites|choisir (un )?(moment|creneau|horaire)/,
];
const CONFIRMATION = [
  /thank(s| you) (you )?for (applying|your application|submitting|your interest in)/,
  /(we|have)( have)? (successfully )?received your (application|candidacy|resume|cv)/,
  /your application (has been |was )?(successfully )?(received|submitted|sent)/,
  /application (has been |was )?(successfully )?(received|submitted|sent)/,
  /you(?:'ve| have) (successfully )?applied/,
  /we(?:'ll| will) (review|be reviewing) your (application|resume|profile|cv)/,
  /merci (d'avoir postule|de votre candidature|pour votre candidature|de votre interet)/,
  /(nous )?avons (bien )?recu votre (candidature|cv)/,
  /votre candidature (a ete|est bien) (recue|soumise|transmise|enregistree)/,
  /vous avez (bien )?postule/,
];
const ALERT_SUBJECT = [
  /job alert|jobs? (you may|for you|matching)|recommended jobs?|new jobs? (for|in|matching)|jobs? you might/,
  /alerte (d')?emploi|offres? (d'emploi )?(pour vous|recommandee)/,
];

// Sentences that look like keywords but are boilerplate in almost every confirmation email.
const CONDITIONAL = /\b(if|should|once|when|as soon as|si|advenant|lorsque|dans le cas ou)\b/;
const CONDITIONAL_TOPIC = /(select|shortlist|qualif|match|suitable|retenu|profil|candidature|chosen|successful)/;
const NO_INDIVIDUAL_REPLY = /(respond|reply|answer|contact|get back|repondre|communiquer)[^.]{0,40}(each|every|all|individual|chaque|tous|toutes)|individually|a chacun|chaque candidat/;

const sentences = (t) => t.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

function declarative(text) {
  return sentences(text)
    .filter((s) => !(CONDITIONAL.test(s) && CONDITIONAL_TOPIC.test(s)))
    .filter((s) => !NO_INDIVIDUAL_REPLY.test(s))
    .join(". ");
}

export function classifyEmail({ subject = "", body = "", fromEmail = "", fromName = "" } = {}) {
  const subj = norm(subject);
  const full = norm(String(body).slice(0, 8000));
  const all = `${subj}. ${full}`;
  const from = norm(`${fromName} ${fromEmail}`);

  // 1. Gmail forwarding handshake: the user needs the code to finish setting up forwarding.
  if (/forwarding-noreply@google\.com|mail-noreply@google\.com/.test(from) || /gmail forwarding confirmation|confirmation de transfert gmail/.test(subj)) {
    const m = all.match(/(?:confirmation code|code de confirmation)\D{0,12}(\d{6,10})/) || all.match(/\b(\d{9})\b/);
    return { kind: "verification", confidence: m ? "high" : "medium", reasons: ["Gmail forwarding confirmation"], code: m ? m[1] : null };
  }

  // 2. Job-alert newsletters are not about a specific application.
  if (any(ALERT_SUBJECT, subj).length && !any(CONFIRMATION, subj).length) {
    return { kind: "other", confidence: "high", reasons: ["job alert / newsletter"] };
  }

  const clean = declarative(all);

  const rej = any(REJECTION, clean);
  if (rej.length) return { kind: "rejection", confidence: rej.length > 1 || /unfortunately|malheureusement|regret/.test(subj) ? "high" : "medium", reasons: rej };

  const off = any(OFFER, clean);
  if (off.length) return { kind: "offer", confidence: "medium", reasons: off };

  const iv = any(INTERVIEW, clean);
  if (iv.length) return { kind: "interview", confidence: iv.length > 1 ? "high" : "medium", reasons: iv };

  const conf = any(CONFIRMATION, all);
  if (conf.length) return { kind: "confirmation", confidence: any(CONFIRMATION, subj).length || conf.length > 1 ? "high" : "medium", reasons: conf };

  return { kind: "other", confidence: "low", reasons: [] };
}
