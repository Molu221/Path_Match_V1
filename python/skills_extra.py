"""
skills_extra.py - more skills for the dictionary, in every field, in English and in French.

Why this file exists: the first list was written for industrial engineering, so most French skills
and most soft skills of other fields were missed. Here each skill is ONE English name with the ways it
is written in English AND in French, so a French posting and an English CV meet on the same name
("travailler sous pression" = "work under pressure" = "Works under pressure").

Rules for a spelling (alias):
  * written in lowercase without accents (the matcher removes accents from the text, so "rigueur",
    "Rigueur" and "RIGUEUR" are the same, and "qualité" is "qualite");
  * a plural "s" is added by the matcher, so give the singular;
  * no very short or very common word that means something else ("mes" is French for "my", "cad" is
    the Canadian dollar, "ai" is "j'ai"), and no word that mostly sits in a company's advertising
    ("innovation", "passion", "leader", "quality");
  * if a skill also exists in the OaSIS list, one spelling is its English OaSIS name, so both become
    one skill (see oasis.merge_skills) and not two.

MORE_ALIASES adds spellings to a skill that already exists in keyword_extractor.SKILLS.
NEW_SKILLS adds new skills. FIELDS says which area each new skill belongs to (for reading only).
"""

# ---------------------------------------------------------------------------------------------------------
# Spellings added to skills that already exist
# ---------------------------------------------------------------------------------------------------------
MORE_ALIASES = {
    "Communication": [
        "communication skill", "communication ability", "communications", "aptitudes en communication",
        "aptitudes de communication", "competences en communication", "habiletes en communication",
        "habiletes de communication", "aptitudes a communiquer", "capacite a communiquer",
        "communiquer efficacement", "communicateur", "communicatrice", "excellent communicator",
        "strong communicator", "good communicator",
    ],
    "Teamwork": [
        "work in a team", "work in teams", "work well in a team", "work effectively in a team",
        "work as part of a team", "work collaboratively", "team spirit", "team-oriented", "team oriented",
        "travailler en equipe", "travailler en collaboration", "capacite a travailler en equipe",
        "sens du travail d'equipe", "esprit de collaboration", "equipe de travail",
    ],
    "Collaboration": ["collaborative", "collaboratif", "collaborative approach", "collaborateur"],
    "Interpersonal skills": [
        "interpersonal", "people skills", "aptitudes interpersonnelles", "qualites interpersonnelles",
        "savoir-etre", "savoir etre", "sens relationnel", "competences relationnelles",
        "habiletes relationnelles", "aptitudes relationnelles", "aisance relationnelle", "relationnel",
    ],
    "Problem solving": [
        "solve problems", "solving problems", "problem resolution", "resolve problems", "resolving problems",
        "resoudre des problemes", "resoudre les problemes", "resoudre rapidement", "resolution des problemes",
        "capacite a resoudre des problemes", "esprit de resolution", "resoudre des problemes complexes",
        "solve complex problems", "complex problem solving",
    ],
    "Analytical skills": [
        "analytical thinking", "analytical mind", "analytical ability", "analytical abilities", "analytical",
        "pensee analytique", "capacites analytiques", "habiletes analytiques", "aptitudes analytiques",
        "rigueur analytique", "analytique", "sens analytique",
    ],
    "Initiative": [
        "take initiative", "taking initiative", "show initiative", "sens de l'initiative",
        "esprit d'initiative", "prise d'initiative", "prendre des initiatives", "faire preuve d'initiative",
        "self-starter", "self starter",
    ],
    "Autonomy": [
        "independence", "independent", "independently", "work independently", "work autonomously",
        "travailler de facon autonome", "travailler de maniere autonome", "de facon autonome",
        "de maniere autonome", "travail autonome", "en toute autonomie", "travailler en autonomie",
    ],
    "Organizational skills": [
        "organized", "well-organized", "well organised", "organisation du travail", "bien organise",
        "bonne organisation", "qualites organisationnelles", "aptitudes organisationnelles",
    ],
    "Curiosity": ["curious", "curieux", "curieuse", "esprit curieux", "intellectual curiosity", "curiosite intellectuelle"],
    "Perseverance": ["persistence", "persistent", "tenacity", "tenacite", "persistance", "perseverant", "perseverante", "determination"],
    "Leadership": ["esprit de leadership", "faire preuve de leadership", "leadership skills", "leadership abilities", "capacite de leadership", "leadership naturel"],
    "Bilingual (EN/FR)": ["bilinguisme", "bilingualism", "fluent in english and french", "fluent in french and english"],
    "French": ["french language", "langue francaise", "en francais", "maitrise du francais", "spoken and written french", "written and spoken french"],
    "English": ["english language", "langue anglaise", "en anglais", "maitrise de l'anglais", "spoken and written english", "written and spoken english"],
    "Project management": [
        "project manager", "project coordination", "coordination de projet", "coordination de projets",
        "project delivery", "livraison de projets", "execution de projets", "project execution",
        "pilotage de projet", "pilotage de projets", "chef de projet", "gestionnaire de projet",
        "program management", "gestion de programme", "gestion de programmes",
    ],
    "Process improvement": ["improve processes", "improving processes", "ameliorer les processus", "ameliorer les procedes", "amelioration des operations"],
    "Continuous improvement": ["amelioration constante", "amelioration permanente", "methodologies lean", "lean methodology", "lean methodologies", "lean thinking", "approche lean", "demarche lean", "principes lean", "outils lean", "lean tools"],
    "Documentation": ["documenter", "documentation technique", "technical documentation", "document control", "controle documentaire", "gestion documentaire", "document management", "gestion des documents"],
    "Data analysis": ["analyses de donnees", "data-driven", "axe sur les donnees", "analyzing data", "analyser les donnees", "data insights", "quantitative analysis", "analyse quantitative", "quantitative skills", "analytics"],
    "Statistical analysis": ["statistical", "statistical methods", "methodes statistiques", "statistical modeling", "modelisation statistique", "hypothesis testing", "tests d'hypotheses", "regression analysis", "analyse de regression", "design of experiments", "plan d'experiences", "plans d'experiences", "anova", "doe"],
    "Scheduling": ["echeancier", "gantt", "project schedule", "calendrier de projet", "resource scheduling"],
    "Simulation": ["discrete event simulation", "simulation a evenements discrets", "monte carlo", "modelisation et simulation", "modeling and simulation"],
    "Optimization": ["operations research", "recherche operationnelle", "linear programming", "programmation lineaire", "optimiser", "optimize", "optimizing", "mathematical optimization"],
    "Supply chain": ["supply chain management", "gestion de la chaine d'approvisionnement", "gestion de la chaine logistique", "scm", "supply-chain", "chaines d'approvisionnement", "supply planning", "planification de l'approvisionnement"],
    "Procurement": ["sourcing", "strategic sourcing", "approvisionnement strategique", "achat", "acheteur", "buyer", "vendor management", "supplier management", "gestion des fournisseurs", "gestion de fournisseurs", "purchase order", "bon de commande", "relations avec les fournisseurs", "supplier relations", "supplier development", "developpement de fournisseurs"],
    "Logistics": ["shipping", "expedition", "freight", "fret", "douanes", "customs", "import/export", "import export", "importation et exportation", "gestion du transport", "transport management", "dernier kilometre", "last mile"],
    "Inventory control": ["inventory", "inventaire", "cycle count", "comptage cyclique", "stock control", "niveaux de stock", "stock levels", "reapprovisionnement", "replenishment"],
    "Quality control": ["quality inspection", "inspection de la qualite", "inspection qualite", "controle de qualite", "quality checks", "controles de qualite", "quality testing"],
    "Quality assurance": ["qa", "assurance-qualite", "qa testing", "qa/qc"],
    "Root cause analysis": ["causes profondes", "cause profonde", "cause fondamentale", "causes fondamentales", "5 why", "5 whys", "cinq pourquoi", "5 pourquoi", "ishikawa", "fishbone", "diagramme d'ishikawa", "pareto", "diagramme de pareto"],
    "Process mapping": ["value stream mapping", "vsm", "cartographie de la chaine de valeur", "cartographie du flux de valeur", "swimlane", "bpmn", "diagramme de processus", "diagrammes de flux", "flow diagrams", "modelisation des processus", "process modeling", "process modelling"],
    "Industrial engineering": ["industrial engineer", "ingenieur industriel", "ingenieure industrielle"],
    "Mechanical engineering": ["mechanical engineer", "ingenieur mecanique", "ingenieure mecanique"],
    "Excel": ["microsoft excel", "ms excel", "tableaux croises dynamiques", "tableau croise dynamique", "pivot tables", "pivot table", "vlookup", "recherchev", "xlookup", "spreadsheet", "chiffrier", "tableur", "feuilles de calcul"],
    "PowerPoint": ["microsoft powerpoint", "ms powerpoint"],
    "Python": ["pandas", "numpy", "scikit-learn", "jupyter"],
    "SQL": ["sql server", "t-sql", "mysql", "postgresql", "postgres", "sqlite", "requetes sql", "sql queries", "pl/sql"],
    "SAP": ["sap erp", "s/4hana", "sap hana", "sap mm", "sap pp", "sap sd", "sap wm", "sap ewm", "sap fico", "sap ariba"],
    "ERP": ["enterprise resource planning", "progiciel de gestion integre", "erp system", "systemes erp", "systeme erp", "oracle erp", "netsuite", "dynamics 365", "microsoft dynamics", "jd edwards", "epicor"],
    "Automation": ["process automation", "robotic process automation", "rpa", "automatisation des processus", "automatisation des taches", "task automation", "scripts d'automatisation", "automation scripts"],
    "Dashboards": ["data visualization", "data visualisation", "visualisation de donnees", "visualisation des donnees", "dataviz", "tableaux de bord interactifs", "interactive dashboards", "business intelligence", "intelligence d'affaires", "informatique decisionnelle", "looker", "qlik", "qlik sense", "qlikview"],
    "KPIs": ["indicateurs de rendement", "indicateur de rendement", "metriques", "metrics", "performance metrics", "mesures de performance", "performance measurement", "mesure de la performance", "suivi de la performance", "performance tracking", "indicateurs", "scorecard", "balanced scorecard", "tableau de bord equilibre", "okr"],
    "Manufacturing experience": [
        "manufacturing", "manufacturier", "manufacturiere", "fabrication", "procedes de fabrication",
        "manufacturing processes", "production line", "ligne de production", "lignes de production",
        "shop floor", "plancher de production", "plancher d'usine", "production floor",
        "environnement manufacturier", "milieu manufacturier", "industrial environment",
        "environnement industriel", "milieu industriel", "manufacturing industry", "industrie manufacturiere",
    ],
    "Maintenance and reliability": [
        "maintenance", "entretien", "mro", "cmms", "gmao", "predictive maintenance", "maintenance predictive",
        "total productive maintenance", "tpm", "entretien preventif", "reliability centered maintenance", "rcm",
        "maintenance corrective", "corrective maintenance", "maintenance industrielle", "industrial maintenance",
    ],
}

# ---------------------------------------------------------------------------------------------------------
# New skills
# ---------------------------------------------------------------------------------------------------------
NEW_SKILLS = {
    # ====================================================================================== SOFT SKILLS
    "Time management": [
        "time management", "manage time", "managing time", "manage your time", "gestion du temps",
        "gerer son temps", "gestion de son temps",
    ],
    "Prioritization": [
        "prioritization", "prioritisation", "prioritize", "prioritise", "prioritizing", "manage priorities",
        "managing priorities", "competing priorities", "conflicting priorities", "shifting priorities",
        "changing priorities", "multiple priorities", "gestion des priorites", "gestion de priorites",
        "gerer les priorites", "gerer des priorites", "definir les priorites", "etablir les priorites",
        "etablir des priorites", "priorites concurrentes", "priorites multiples", "priorites variables",
        "priorites changeantes", "prioriser", "priorisation",
    ],
    "Multitasking": [
        "multitasking", "multi-tasking", "multitask", "multi-task", "multitache", "multitaches",
        "taches multiples", "plusieurs taches", "plusieurs projets simultanement", "projets simultanes",
        "gerer plusieurs projets", "manage multiple projects", "multiple projects", "plusieurs dossiers",
    ],
    "Works under pressure": [
        "work under pressure", "working under pressure", "works under pressure", "under pressure",
        "handle pressure", "perform under pressure", "stress tolerance", "handle stress", "manage stress",
        "stress management", "fast-paced", "fast paced", "rythme rapide", "environnement a rythme rapide",
        "travailler sous pression", "travail sous pression", "capacite a travailler sous pression",
        "sous pression", "gestion du stress", "gerer le stress", "tolerance au stress", "resistance au stress",
    ],
    "Meets deadlines": [
        "meet deadlines", "meeting deadlines", "meets deadlines", "tight deadlines", "strict deadlines",
        "deadline-driven", "deadline driven", "on time delivery", "timely delivery", "timely manner",
        "respecter les delais", "respect des delais", "delais serres", "echeanciers serres",
        "respecter les echeances", "respect des echeances", "echeances serrees", "respecter les echeanciers",
        "livrer dans les delais", "dans les delais", "delais de livraison",
    ],
    "Adaptability": [
        "adaptability", "adaptable", "adapt quickly", "adapt to change", "adapting to change",
        "ability to adapt", "flexibility", "adaptabilite", "capacite d'adaptation", "capacite a s'adapter",
        "s'adapter rapidement", "adapter rapidement", "s'adapter au changement", "faire preuve de flexibilite",
        "flexibilite", "souplesse", "agilite", "polyvalence", "polyvalent", "polyvalente", "versatile",
        "versatility", "environnement en constante evolution", "constante evolution", "environnement changeant",
    ],
    "Critical thinking": [
        "critical thinking", "think critically", "critical thinker", "esprit critique", "pensee critique",
        "sens critique", "analyse critique", "critical analysis", "critical reasoning",
    ],
    "Creativity": [
        "creativity", "creative thinking", "creative problem solving", "creativite", "esprit creatif",
        "pensee creative", "ingeniosite", "ingenuity", "out-of-the-box", "out of the box",
        "think outside the box", "sortir des sentiers battus",
    ],
    "Innovation": [
        "innovative thinking", "innovative mindset", "innovativeness", "esprit d'innovation",
        "esprit innovateur", "innovateur", "innovatrice", "solutions innovantes", "innovative solutions",
        "idees innovantes", "innovative ideas",
    ],
    "Proactivity": [
        "proactive", "proactively", "proactivity", "pro-active", "proactif", "proactivite",
        "de facon proactive", "de maniere proactive", "agir de facon proactive", "approche proactive",
        "anticiper", "anticipate", "anticipation des besoins", "anticipate needs", "forward-thinking",
        "forward thinking",
    ],
    "Resourcefulness": ["resourceful", "resourcefulness", "debrouillard", "debrouillarde", "debrouillardise", "ingenieux"],
    "Rigor": [
        "rigor", "rigour", "rigorous", "rigorously", "rigueur", "rigoureux", "rigoureuse", "rigoureusement",
        "faire preuve de rigueur", "grande rigueur", "methodique", "methodical", "methodically",
        "approche methodique", "esprit methodique", "sens de la methode",
    ],
    "Accountability": [
        "accountability", "accountable", "take ownership", "ownership", "sense of ownership", "responsabilisation",
        "sens des responsabilites", "sens de la responsabilite", "faire preuve de responsabilite",
        "imputabilite", "redevabilite", "sense of responsibility", "responsable des resultats",
    ],
    "Dependability": [
        "dependable", "dependability", "trustworthy", "trustworthiness", "personne fiable", "employe fiable",
        "digne de confiance", "personne de confiance", "tenir ses engagements", "keep commitments",
    ],
    "Punctuality": ["punctual", "punctuality", "attendance", "regular attendance", "ponctuel", "ponctuelle", "ponctualite", "assiduite", "assidu", "assidue"],
    "Professionalism": ["professionalism", "professional demeanor", "professional attitude", "professional conduct", "professionnalisme", "attitude professionnelle", "comportement professionnel", "maturite professionnelle"],
    "Integrity": [
        "integrity", "honesty", "ethical", "professional ethics", "work ethic", "strong work ethic",
        "integrite", "honnetete", "ethique professionnelle", "ethique de travail", "ethique du travail",
        "deontologie", "business ethics", "ethique des affaires",
    ],
    "Discretion and confidentiality": [
        "discretion", "discreet", "maintain confidentiality", "handle confidential", "confidential information",
        "sensitive information", "sens de la discretion", "discret", "sens de la confidentialite",
        "preserver la confidentialite", "respecter la confidentialite", "informations confidentielles",
        "donnees confidentielles", "donnees sensibles", "informations sensibles",
    ],
    "Customer service": [
        "customer service", "client service", "customer support", "client support", "customer care",
        "customer experience", "client experience", "customer satisfaction", "customer focus",
        "customer-oriented", "customer oriented", "client-focused", "client focused", "client-oriented",
        "customer relations", "client relations", "service orientation", "service-oriented",
        "service a la clientele", "service client", "service aux clients", "services aux clients",
        "support client", "relation client", "relations avec la clientele", "relations avec les clients",
        "satisfaction client", "satisfaction de la clientele", "orientation client", "orientation clientele",
        "axe sur le client", "axee sur le client", "centre sur le client", "centree sur le client",
        "approche centree sur le client", "experience client", "experience clientele", "sens du service",
        "orientation axee sur le service", "accueillir les clients", "servir les clients", "clients internes",
        "internal customers", "internal clients",
    ],
    "Active listening": [
        "active listening", "listening skills", "good listener", "ecoute active", "capacite d'ecoute",
        "sens de l'ecoute", "a l'ecoute", "bonne ecoute", "savoir ecouter", "ecoute attentive",
    ],
    "Empathy": ["empathy", "empathetic", "empathic", "compassion", "compassionate", "empathie", "empathique", "bienveillance", "bienveillant", "bienveillante", "concern for others", "preoccupation des autres"],
    "Emotional intelligence": ["emotional intelligence", "self-awareness", "self awareness", "intelligence emotionnelle", "intelligence relationnelle", "conscience de soi", "maitrise de soi", "self-control", "sang-froid", "sang froid"],
    "Diplomacy and tact": ["diplomacy", "diplomatic", "tact", "tactful", "diplomatie", "diplomate", "avec tact", "faire preuve de tact", "faire preuve de diplomatie", "courtoisie", "courtesy", "courteous", "courtois", "courtoise"],
    "Conflict resolution": ["conflict resolution", "resolve conflicts", "resolving conflicts", "manage conflict", "conflict management", "mediation", "dispute resolution", "resolution de conflits", "resolution des conflits", "gestion des conflits", "gerer les conflits", "gestion de conflits", "reglement des differends"],
    "Negotiation": ["negotiating", "negotiation", "negotiate", "negotiation skills", "negociation", "negocier", "habiletes de negociation", "aptitudes de negociation", "negociations", "contract negotiation", "negociation de contrats"],
    "Persuasion and influence": ["persuading", "persuasion", "persuasive", "influencing", "influence others", "influence without authority", "persuader", "pouvoir de persuasion", "capacite de persuasion", "capacite d'influence", "influencer", "influence sans autorite", "savoir convaincre", "convaincre"],
    "Decision making": ["decision making", "decision-making", "make decisions", "making decisions", "sound judgment", "good judgment", "prise de decision", "prise de decisions", "prendre des decisions", "processus decisionnel", "bon jugement", "jugement", "aide a la decision", "decision support", "decisions techniques", "technical decisions", "decisions strategiques"],
    "Presentation skills": ["presentation skills", "presentation skill", "public speaking", "present findings", "present results", "presenting results", "presenter des resultats", "presenter les resultats", "presentation des resultats", "presentation de resultats", "prise de parole en public", "parler en public", "habiletes de presentation", "competences en presentation", "capacite de presentation", "aptitudes de presentation", "presentations a la direction", "executive presentations", "vulgarisation", "aisance a l'oral", "storytelling", "data storytelling"],
    "Written communication": ["written communication", "written skills", "writing skills", "written", "communication ecrite", "communications ecrites", "habiletes redactionnelles", "competences redactionnelles", "qualite de redaction", "capacite redactionnelle", "capacites redactionnelles", "aptitudes redactionnelles", "a l'ecrit", "par ecrit", "ecrit", "ecrite", "redaction", "rediger", "report writing", "writing reports", "redaction de rapports", "redaction de documents", "business writing", "writing"],
    "Verbal communication": ["verbal communication", "oral communication", "oral skills", "verbal skills", "oral", "verbal", "orale", "communication orale", "communication verbale", "communications orales", "a l'oral", "expression orale", "oral comprehension", "oral expression", "comprehension orale", "communication en personne", "face-to-face communication", "phone skills", "telephone skills", "aisance au telephone"],
    "Strategic thinking": ["strategic thinking", "strategic vision", "strategic mindset", "big picture", "vision globale", "vision d'ensemble", "vue d'ensemble", "pensee strategique", "vision strategique", "esprit strategique", "strategic planning", "planification strategique", "plan strategique", "strategic plan", "orientations strategiques", "strategic direction", "projets strategiques", "strategic initiatives", "initiatives strategiques"],
    "Synthesis": ["synthesize", "synthesise", "synthesis skills", "esprit de synthese", "capacite de synthese", "sens de la synthese", "synthetiser", "synthesizing information", "synthetiser l'information", "summarize", "summarise", "resumer"],
    "Learning agility": ["active learning", "learning agility", "quick learner", "fast learner", "learn quickly", "learns quickly", "eager to learn", "willingness to learn", "desire to learn", "continuous learning", "lifelong learning", "self-taught", "apprentissage rapide", "apprentissage continu", "apprendre rapidement", "capacite d'apprentissage", "capacite d'apprendre", "volonte d'apprendre", "desir d'apprendre", "soif d'apprendre", "apprentissage actif", "apprend rapidement", "autodidacte", "apprentissage autonome", "desir constant d'apprendre", "open-minded", "open minded", "ouverture d'esprit", "ouvert d'esprit"],
    "Resilience": ["resilience", "resilient", "resiliente", "capacite de rebond", "bounce back", "handle setbacks"],
    "Motivation": ["motivation", "motivated", "self-motivated", "self motivated", "highly motivated", "self-driven", "self driven", "motive", "motivee", "automotivation", "auto-motivation", "personne motivee", "forte motivation", "ambitious", "ambition", "ambitieux", "ambitieuse", "esprit de competition", "competitive spirit", "competitive drive"],
    "Enthusiasm": ["enthusiasm", "enthusiastic", "positive attitude", "positive outlook", "positivity", "optimistic", "optimism", "enthousiasme", "enthousiaste", "dynamisme", "attitude positive", "esprit positif", "optimisme", "optimiste", "positive energy", "energie positive", "high energy", "personnalite dynamique", "personne dynamique", "can-do attitude", "can do attitude"],
    "Entrepreneurial spirit": ["entrepreneurial", "entrepreneurship", "entrepreneurial spirit", "entrepreneurial mindset", "esprit entrepreneurial", "esprit d'entreprise", "entrepreneuriat", "fibre entrepreneuriale", "mentalite entrepreneuriale", "intrapreneur"],
    "Cultural awareness": ["multicultural", "cross-cultural", "intercultural", "cultural awareness", "cultural sensitivity", "cultural competence", "interculturel", "interculturelle", "multiculturel", "multiculturelle", "sensibilite culturelle", "sensibilite interculturelle", "diversite culturelle", "equipes diversifiees", "equipes internationales", "international teams", "global teams", "equipes mondiales", "collegues internationaux", "international colleagues"],
    "Results orientation": ["results-oriented", "results oriented", "result-oriented", "result oriented", "results-driven", "results driven", "goal-oriented", "goal oriented", "goal-driven", "target-driven", "focus on results", "orientation resultats", "orientation vers les resultats", "axe sur les resultats", "axee sur les resultats", "oriente resultats", "orientee resultats", "oriente vers les resultats", "orientee vers les resultats", "sens des resultats", "atteindre les objectifs", "achieve goals", "achieving goals", "meet targets", "atteinte des objectifs", "atteinte d'objectifs", "deliver results", "delivering results", "livrer des resultats", "resultats concrets", "tangible results", "resultats mesurables", "measurable results"],
    "Team management": ["team management", "manage a team", "managing a team", "manage teams", "managing teams", "lead a team", "leading a team", "lead teams", "people management", "manage people", "staff management", "team lead", "team leader", "gestion d'equipe", "gestion d'equipes", "gestion de personnel", "gestion du personnel", "diriger une equipe", "diriger des equipes", "encadrement d'equipe", "encadrer une equipe", "encadrer des equipes", "supervision d'equipe", "supervision du personnel", "superviser", "supervise", "supervising", "chef d'equipe", "chefs d'equipe", "gestionnaire d'equipe", "mobiliser une equipe", "mobilisation des equipes", "motivate a team", "deleguer", "performance management", "gestion de la performance", "evaluations de rendement", "evaluation du rendement", "talent management", "gestion des talents", "employee engagement", "mobilisation des employes", "employee development", "developpement des employes", "succession planning", "planification de la releve"],
    "Mentoring and coaching": ["mentoring", "mentor", "mentorship", "coaching", "coach", "mentorat", "encadrer", "encadrement", "accompagnement", "accompagner", "tutorat", "tutoring", "guide others", "guider les autres", "knowledge transfer", "transfert de connaissances", "knowledge sharing", "partage de connaissances", "partage des connaissances", "partager ses connaissances", "share knowledge", "train new employees", "formation des nouveaux employes"],
    "Training and teaching": ["train others", "training delivery", "deliver training", "provide training", "conduct training", "training sessions", "formation du personnel", "formation des employes", "dispenser des formations", "dispenser de la formation", "donner des formations", "donner de la formation", "animer des formations", "former les employes", "former le personnel", "sessions de formation", "ateliers de formation", "formateur", "formatrice", "trainer", "instructor", "instruire", "instructing", "enseignement", "enseigner", "teaching", "teach", "teacher", "enseignant", "enseignante", "educator", "pedagogie", "pedagogique", "lesson plans", "plans de cours", "preparation de cours", "classroom management", "gestion de classe", "employee training"],
    "Stakeholder management": ["stakeholder management", "stakeholder engagement", "stakeholder relations", "stakeholder", "manage stakeholders", "gestion des parties prenantes", "parties prenantes", "partie prenante", "intervenants", "intervenant", "gestion des intervenants", "internal stakeholders", "external stakeholders", "partenaires externes", "external partners", "partenaires strategiques", "strategic partners", "partenaires d'affaires", "business partners", "business partnering", "relationship management", "gestion des relations", "relationship building", "build relationships", "etablir des relations", "etablir des relations de confiance", "developper des relations", "reseautage", "networking skills"],
    "Change management": ["change management", "manage change", "managing change", "lead change", "change leadership", "change agent", "gestion du changement", "conduite du changement", "accompagnement du changement", "gerer le changement", "accompagner le changement", "agent de changement", "gestion de la transition", "transition management"],

    # ====================================================================================== OPERATIONS AND QUALITY
    "Digital transformation": ["digital transformation", "transformation numerique", "transformation digitale", "digitalisation", "digitization", "digitalization", "numerisation", "industry 4.0", "industrie 4.0", "smart manufacturing", "fabrication intelligente", "usine intelligente", "smart factory", "iiot", "internet des objets", "internet of things", "iot", "digital twin", "jumeau numerique"],
    "Risk management": ["risk management", "manage risk", "risk assessment", "risk analysis", "risk mitigation", "risk identification", "risk register", "risk control", "gestion des risques", "gestion de risques", "evaluation des risques", "evaluation de risques", "analyse de risque", "analyse des risques", "attenuation des risques", "mitigation des risques", "identification des risques", "registre des risques", "plan d'attenuation", "mitigation plan", "risques potentiels", "gerer les risques", "reduire les risques", "reduction des risques", "maitrise des risques", "controle des risques", "contingency plan", "contingency planning", "plan de contingence", "business continuity", "continuite des affaires", "plan de continuite", "gestion de crise", "crisis management", "disaster recovery", "reprise apres sinistre", "enterprise risk management"],
    "Compliance": ["compliance", "regulatory compliance", "ensure compliance", "compliance monitoring", "conformite", "conformite reglementaire", "conformite aux normes", "conformite aux exigences", "conformite legale", "assurer la conformite", "veiller a la conformite", "respect de la reglementation", "respect des normes", "respect des politiques", "respect des procedures", "respecter les normes", "respecter les procedures", "respecter la reglementation", "normes reglementaires", "regulatory requirements", "exigences reglementaires", "reglementation", "regulations", "regulatory", "reglementaire", "regulatory affairs", "affaires reglementaires", "code de conduite", "code of conduct", "lois et reglements", "laws and regulations", "anti-money laundering", "lutte contre le blanchiment", "know your customer"],
    "Health and safety": ["health and safety", "health & safety", "occupational health and safety", "occupational health", "ohs", "ehs", "hse", "environment health and safety", "workplace safety", "safe work practices", "safety standards", "safety procedures", "safety rules", "safety protocols", "safety culture", "safety training", "safety compliance", "safety audits", "safety inspections", "safety management", "sante et securite", "sante securite", "sante-securite", "sante et securite au travail", "sst", "securite au travail", "securite des travailleurs", "securite des employes", "securite industrielle", "normes de securite", "culture de securite", "regles de securite", "procedures de securite", "protocoles de securite", "formation en securite", "inspections de securite", "audits de securite", "gestion de la securite", "milieu de travail securitaire", "environnement securitaire", "pratiques securitaires", "cnesst", "osha", "whmis", "simdut", "lockout tagout", "loto", "cadenassage", "ergonomics", "ergonomie", "ergonomic", "ergonomique", "personal protective equipment", "equipement de protection individuelle", "incident investigation", "enquete sur les incidents", "job safety analysis", "analyse securitaire des taches", "hazard identification", "identification des dangers", "hazard analysis", "analyse des dangers", "hazop", "dangerous goods", "matieres dangereuses", "marchandises dangereuses", "hazmat"],
    "Environmental sustainability": ["sustainability", "sustainable development", "environmental management", "environmental compliance", "environmental impact", "carbon footprint", "greenhouse gas", "esg", "corporate social responsibility", "life cycle assessment", "circular economy", "waste reduction", "recycling", "energy efficiency", "renewable energy", "decarbonization", "net zero", "developpement durable", "durabilite", "gestion environnementale", "conformite environnementale", "impact environnemental", "empreinte carbone", "gaz a effet de serre", "responsabilite sociale des entreprises", "responsabilite sociale", "rse", "analyse du cycle de vie", "economie circulaire", "reduction des dechets", "gestion des matieres residuelles", "matieres residuelles", "recyclage", "efficacite energetique", "energie renouvelable", "decarbonation", "carboneutralite", "carbone neutre", "transition energetique", "energy transition"],
    "Diversity and inclusion": ["diversity and inclusion", "equity diversity and inclusion", "inclusive workplace", "diversite et inclusion", "equite diversite et inclusion", "milieu de travail inclusif", "environnement inclusif", "inclusive leadership", "leadership inclusif", "accessibility standards", "normes d'accessibilite", "wcag", "conception accessible", "accessible design"],
    "Quality management": ["quality management", "quality management system", "qms", "quality system", "systeme de gestion de la qualite", "gestion de la qualite", "sgq", "systeme qualite", "systeme de management de la qualite", "management de la qualite", "quality manual", "manuel qualite", "quality policy", "politique qualite", "quality plan", "plan qualite", "quality standards", "normes de qualite", "quality improvement", "amelioration de la qualite", "quality metrics", "indicateurs de qualite", "quality documentation", "documentation qualite", "quality procedures", "procedures qualite", "quality requirements", "exigences qualite", "exigences de qualite", "quality issues", "problemes de qualite", "quality problems", "defect reduction", "reduction des defauts", "zero defect", "zero defaut", "defect rate", "taux de defauts", "scrap", "rebuts", "rework", "first pass yield", "rendement au premier passage", "ppm", "dpmo", "cpk", "process capability", "capabilite des processus", "capabilite de processus", "analyse de capabilite", "capability analysis", "gauge r&r", "msa", "measurement system analysis", "analyse des systemes de mesure"],
    "Statistical process control": ["statistical process control", "spc", "controle statistique des procedes", "controle statistique de processus", "controle statistique de procedes", "maitrise statistique des procedes", "maitrise statistique de processus", "cartes de controle", "carte de controle", "control charts", "control chart", "process control", "controle de processus", "controle des procedes", "controle de procede", "controle des processus", "process monitoring", "surveillance des procedes", "surveillance de processus"],
    "FMEA": ["fmea", "dfmea", "pfmea", "amdec", "failure mode and effects analysis", "failure modes and effects analysis", "failure mode effects analysis", "failure mode analysis", "analyse des modes de defaillance", "fmeca", "modes de defaillance", "failure modes"],
    "Control plans": ["control plan", "plan de controle", "plans de controle", "plan de surveillance", "inspection plan", "plan d'inspection", "sampling plan", "plan d'echantillonnage", "aql", "echantillonnage", "acceptance sampling", "controle par echantillonnage", "inspection par echantillonnage"],
    "APQP and PPAP": ["apqp", "advanced product quality planning", "planification avancee de la qualite des produits", "planification avancee de la qualite", "ppap", "production part approval process", "processus d'approbation des pieces de production", "approbation des pieces de production", "first article inspection", "inspection du premier article", "inspection de premier article", "premier article", "iatf", "iatf 16949", "as9100", "as 9100", "as9102", "nadcap", "customer specific requirements", "exigences specifiques du client"],
    "ISO standards": ["iso 9001", "iso 14001", "iso 13485", "iso 45001", "iso 27001", "iso 17025", "iso 22000", "iso 50001", "iso 26262", "iso 31000", "iso 19011", "iso standards", "iso standard", "iso certification", "iso certified", "iso audits", "normes iso", "norme iso", "certification iso", "certifie iso", "audits iso", "iso", "astm", "ansi", "csa standards", "normes csa", "nfpa", "asme", "ieee", "iec 61508", "iec 62304", "do-178", "do-254", "do 178", "do 254", "mil-std", "mil std", "normes de l'industrie", "industry standards", "normes industrielles", "industrial standards"],
    "GD&T": ["gd&t", "gdt", "geometric dimensioning and tolerancing", "geometric dimensioning & tolerancing", "geometric tolerancing", "tolerancement geometrique", "cotation et tolerancement geometrique", "cotation geometrique", "cotation fonctionnelle", "cotes et tolerances", "tolerance analysis", "analyse de tolerances", "tolerance stack-up", "stack-up analysis", "empilement de tolerances", "asme y14.5", "y14.5", "dimensional analysis", "analyse dimensionnelle", "dimensional inspection", "controle dimensionnel", "inspection dimensionnelle"],
    "Metrology and inspection": ["metrology", "metrologie", "cmm", "coordinate measuring machine", "machine a mesurer tridimensionnelle", "mmt", "optical comparator", "comparateur optique", "profilometer", "profilometre", "micrometer", "micrometre", "caliper", "pied a coulisse", "gauge", "jauge", "instruments de mesure", "measuring instruments", "measurement tools", "outils de mesure", "inspection", "inspect", "inspecter", "inspecteur", "inspectrice", "inspector", "inspection report", "rapports d'inspection", "rapport d'inspection", "visual inspection", "inspection visuelle", "non-destructive testing", "non destructive testing", "ndt", "essais non destructifs", "controle non destructif", "ressuage", "magnetoscopie", "ultrasonic testing", "radiography", "radiographie", "eddy current", "courants de foucault"],
    "Testing and validation": ["testing", "test cases", "cas de test", "cas d'essai", "test procedures", "procedures de test", "procedures d'essai", "test protocols", "protocoles de test", "protocoles d'essai", "test bench", "banc d'essai", "bancs d'essai", "banc de test", "bancs de test", "essais", "mise a l'essai", "tester", "tests", "unit testing", "unit tests", "tests unitaires", "test unitaire", "integration testing", "tests d'integration", "system testing", "tests systeme", "regression testing", "tests de regression", "functional testing", "tests fonctionnels", "performance testing", "tests de performance", "load testing", "tests de charge", "acceptance testing", "tests d'acceptation", "uat", "user acceptance testing", "automated testing", "automated tests", "test automation", "tests automatises", "test automatise", "automatisation des tests", "selenium", "cypress", "playwright", "junit", "pytest", "jmeter", "validation", "validate", "validating", "valider", "verification and validation", "v&v", "verification et validation", "validation et verification", "product validation", "validation de produit", "process validation", "validation de procede", "validation de processus", "validation des procedes", "iq oq pq", "iq/oq/pq", "installation qualification", "operational qualification", "performance qualification", "software validation", "computer system validation", "bug tracking", "suivi des bogues", "bug fixing", "correction de bogues", "bogues", "debugging", "debogage", "debug", "deboguer"],
    "Reporting": ["reporting", "prepare reports", "preparing reports", "report generation", "production de rapports", "preparation de rapports", "rediger des rapports", "rapports de gestion", "rapports d'activite", "weekly reports", "rapports hebdomadaires", "monthly reports", "rapports mensuels", "management reports", "status reports", "rapports d'etape", "rapports de statut", "progress reports", "rapports d'avancement"],

    # ====================================================================================== ENGINEERING
    "Mechanical design": ["mechanical design", "conception mecanique", "machine design", "conception de machines", "equipment design", "conception d'equipements", "design engineer", "ingenieur de conception", "ingenieure de conception", "design review", "revue de conception", "revues de conception", "detailed design", "conception detaillee", "preliminary design", "conception preliminaire"],
    "Product design": ["product design", "conception de produit", "conception de produits", "product development", "developpement de produits", "developpement de produit", "new product introduction", "npi", "new product development", "introduction de nouveaux produits", "product lifecycle management", "plm", "cycle de vie du produit", "gestion du cycle de vie des produits", "product management", "gestion de produit", "product roadmap", "feuille de route produit"],
    "Prototyping": ["prototype", "prototyping", "prototypage", "proof of concept", "preuve de concept", "maquette", "rapid prototyping", "prototypage rapide", "mvp"],
    "Research and development": ["research and development", "r&d", "recherche et developpement", "recherche appliquee", "applied research", "literature review", "revue de litterature", "scientific research", "recherche scientifique", "research methods", "methodes de recherche", "laboratory techniques", "techniques de laboratoire", "lab work", "travail en laboratoire"],
    "CAD": ["computer-aided design", "computer aided design", "cao", "conception assistee par ordinateur", "dessin assiste par ordinateur", "cad tools", "cad software", "cad design", "cad models", "3d cad", "2d cad", "cad/cam", "3d modeling", "3d modelling", "modelisation 3d", "solid modeling", "parametric modeling", "modelisation parametrique"],
    "Technical drawings": ["technical drawing", "engineering drawing", "dessin technique", "dessins techniques", "dessins d'ingenierie", "blueprint", "blueprints", "blueprint reading", "lecture de plans", "read blueprints", "lire des plans", "schematic", "schematics", "schemas electriques", "electrical schematics", "p&id", "shop drawings", "dessins d'atelier", "bill of materials", "bom", "nomenclature", "nomenclatures"],
    "Finite element analysis": ["finite element analysis", "finite element", "fea", "elements finis", "analyse par elements finis", "structural analysis", "analyse structurelle", "stress analysis", "analyse de contraintes", "engineering calculations", "calculs d'ingenierie", "design calculations", "calculs de conception"],
    "Thermal and fluid systems": ["thermodynamics", "thermodynamique", "heat transfer", "transfert de chaleur", "transfert thermique", "thermal analysis", "analyse thermique", "hvac", "cvac", "fluid mechanics", "mecanique des fluides", "fluid dynamics", "dynamique des fluides", "cfd", "hydraulics", "hydraulique", "pneumatics", "pneumatique", "piping", "tuyauterie"],
    "Electrical engineering": ["electrical engineering", "genie electrique", "ingenierie electrique", "electrical design", "conception electrique", "circuit design", "conception de circuits", "electrical systems", "systemes electriques", "power systems", "reseaux electriques", "power electronics", "electronique de puissance", "motor control", "commande de moteurs", "wiring", "cablage", "electrical installations", "installations electriques", "high voltage", "haute tension"],
    "Electronics": ["electronics", "electronique", "electronics design", "conception electronique", "pcb", "pcb design", "circuit imprime", "circuits imprimes", "microcontroller", "microcontroleur", "fpga", "vhdl", "verilog", "analog design", "conception analogique", "signal processing", "traitement du signal", "embedded systems", "systemes embarques", "embedded software", "logiciel embarque", "firmware", "rtos"],
    "Industrial controls and PLC": ["plc", "programmable logic controller", "automate programmable", "automates programmables", "scada", "hmi", "ladder logic", "industrial controls", "controles industriels", "commandes industrielles", "industrial automation", "automatisation industrielle", "reseaux industriels", "industrial networks", "allen-bradley", "rockwell", "siemens s7", "tia portal", "profibus", "profinet", "modbus", "instrumentation", "capteurs", "variateurs de frequence", "variable frequency drives", "servo", "motion control", "control systems", "systemes de controle", "systemes de commande", "pid control"],
    "Robotics": ["robotics", "robotique", "robot programming", "programmation de robots", "industrial robot", "robot industriel", "robots industriels", "cobot", "collaborative robots", "robots collaboratifs", "fanuc", "kuka", "yaskawa", "robotic cell", "cellule robotisee", "robotisation", "machine vision", "vision industrielle", "computer vision", "vision par ordinateur"],
    "CNC and machining": ["cnc", "cnc machining", "usinage cnc", "usinage", "machining", "machinist", "machiniste", "tournage", "fraisage", "commande numerique", "g-code", "mastercam", "cnc programming", "programmation cnc", "machine tools", "machines-outils", "tool and die", "outillage et matrices", "jigs and fixtures", "gabarits", "injection molding", "moulage par injection", "stamping", "estampage", "sheet metal", "tolerie", "metal fabrication", "fabrication metallique"],
    "Welding": ["welding", "welder", "soudage", "soudure", "soudeur", "soudeuse", "mig welding", "tig welding", "soudage mig", "soudage tig", "arc welding", "soudage a l'arc", "brazing", "weld inspection", "inspection des soudures"],
    "Assembly": ["assembly line", "ligne d'assemblage", "lignes d'assemblage", "chaine de montage", "assemblage", "assembly", "assembler", "assembleur", "assembleuse", "sub-assembly", "sous-assemblage", "final assembly", "assemblage final", "work instructions", "instructions de travail", "mechanical assembly", "assemblage mecanique", "electromechanical", "electromecanique", "kitting", "line balancing", "equilibrage de ligne", "takt time", "temps de takt", "cycle time", "temps de cycle", "throughput", "debit de production"],
    "Additive manufacturing": ["additive manufacturing", "fabrication additive", "3d printing", "impression 3d", "3d printer", "imprimante 3d", "stereolithography", "stereolithographie", "metal 3d printing", "impression 3d metallique"],
    "Materials engineering": ["materials science", "science des materiaux", "materials engineering", "genie des materiaux", "ingenierie des materiaux", "metallurgy", "metallurgie", "composites", "composite materials", "materiaux composites", "polymers", "polymeres", "materials selection", "selection de materiaux", "choix des materiaux", "corrosion", "heat treatment", "traitement thermique", "surface treatment", "traitement de surface", "coating", "revetement"],
    "Civil and structural engineering": ["civil engineering", "genie civil", "ingenierie civile", "structural engineering", "genie des structures", "ingenierie des structures", "structural design", "conception structurale", "geotechnical", "geotechnique", "water resources", "ressources hydriques", "transportation engineering", "genie des transports", "municipal engineering", "genie municipal", "roads and bridges", "routes et ponts", "reinforced concrete", "beton arme", "steel structures", "structures d'acier", "building code", "code du batiment", "code de construction", "surveying", "arpentage", "gis", "systemes d'information geographique", "geomatics", "geomatique"],
    "Construction and estimating": ["construction site", "chantier", "site supervision", "supervision de chantier", "construction management", "gestion de chantier", "gestion de construction", "cost estimating", "estimation des couts", "estimator", "estimateur", "estimatrice", "bidding", "tendering", "appel d'offres", "appels d'offres", "soumissions", "devis", "quantity takeoff", "releve de quantites", "revit", "bim", "navisworks", "civil 3d", "primavera", "bluebeam", "subcontractors", "sous-traitants", "general contractor", "entrepreneur general"],
    "Aerospace engineering": ["aerospace engineering", "genie aerospatial", "ingenierie aerospatiale", "avionics", "avionique", "aircraft systems", "systemes d'aeronefs", "aircraft maintenance", "entretien d'aeronefs", "aerodynamics", "aerodynamique", "flight test", "essais en vol", "airworthiness", "navigabilite", "gas turbine", "turbine a gaz", "turbines a gaz", "jet engines", "moteurs a reaction", "uav", "drone", "drones"],
    "Chemical and life-science processes": ["chemical engineering", "genie chimique", "ingenierie chimique", "process chemistry", "chimie des procedes", "analytical chemistry", "chimie analytique", "chromatography", "chromatographie", "hplc", "spectroscopy", "spectroscopie", "mass spectrometry", "spectrometrie de masse", "unit operations", "operations unitaires", "process safety", "securite des procedes", "pilot plant", "usine pilote", "scale-up", "mise a l'echelle", "pharmaceutical", "pharmaceutique", "biotechnology", "biotechnologie", "gmp", "bpf", "good manufacturing practices", "bonnes pratiques de fabrication", "glp", "bonnes pratiques de laboratoire", "good laboratory practices", "capa", "change control", "controle des changements", "batch records", "dossiers de lot", "sterile", "sterilisation", "cleanroom", "salle blanche", "salles blanches"],

    # ====================================================================================== SOFTWARE AND DATA
    "Software development": ["software development", "software engineering", "developpement logiciel", "genie logiciel", "ingenierie logicielle", "developpement de logiciels", "developpement d'applications", "application development", "software developer", "developpeur logiciel", "software engineer", "ingenieur logiciel", "full-stack", "full stack", "front-end", "frontend", "back-end", "backend", "web development", "developpement web", "mobile development", "developpement mobile", "software architecture", "architecture logicielle", "system architecture", "architecture des systemes", "object-oriented", "programmation orientee objet", "design patterns", "code review", "revue de code", "revues de code", "technical debt", "dette technique", "refactoring", "microservices", "rest api", "restful", "api", "apis", "web services", "services web", "sdlc"],
    "Programming": ["programming", "programmation", "programmer", "coding", "scripting", "programming languages", "langages de programmation", "langage de programmation", "algorithms", "algorithmes", "data structures", "structures de donnees", "bash", "shell scripting", "powershell", "perl", "ruby", "php", "scala", "kotlin"],
    "Java": ["java", "spring boot", "spring framework", "hibernate", "maven", "gradle", "jvm", "j2ee", "java ee"],
    "JavaScript and TypeScript": ["javascript", "typescript", "node.js", "nodejs", "react.js", "reactjs", "angular", "vue.js", "vuejs", "next.js", "html", "html5", "css", "css3", "jquery"],
    "C and C++": ["c++", "c/c++", "c#", ".net", "asp.net", "langage c"],
    "R and MATLAB": ["matlab", "simulink", "r programming", "langage r", "rstudio", "tidyverse", "labview", "octave"],
    "Version control": ["git", "github", "gitlab", "bitbucket", "version control", "source control", "controle de version", "gestion de versions", "gestion des versions", "svn", "pull request", "pull requests"],
    "DevOps and cloud": ["devops", "ci/cd", "cicd", "pipelines ci", "pipeline ci", "continuous integration", "continuous deployment", "continuous delivery", "integration continue", "deploiement continu", "livraison continue", "jenkins", "github actions", "terraform", "ansible", "docker", "kubernetes", "containers", "conteneurs", "infrastructure as code", "aws", "amazon web services", "azure", "microsoft azure", "gcp", "google cloud", "cloud computing", "infonuagique", "informatique en nuage", "environnements infonuagiques", "serverless", "linux", "unix", "system administration", "administration systeme", "observability", "grafana", "prometheus", "virtualization", "virtualisation", "vmware"],
    "Agile and Scrum": ["agile", "scrum", "kanban", "sprint", "sprints", "scrum master", "product owner", "proprietaire de produit", "agile methodology", "methodologie agile", "methodologies agiles", "methodes agiles", "scaled agile", "user stories", "backlog", "retrospective", "jira", "confluence", "trello", "asana", "smartsheet", "waterfall"],
    "Databases": ["database", "base de donnees", "bases de donnees", "donnees relationnelles", "relational database", "data modeling", "data modelling", "modelisation de donnees", "modelisation des donnees", "nosql", "mongodb", "cassandra", "redis", "elasticsearch", "oracle database", "data warehouse", "data warehousing", "entrepot de donnees", "entrepots de donnees", "data lake", "etl", "elt", "ssis", "ssrs", "talend", "informatica", "alteryx", "data pipeline", "pipelines de donnees", "data engineering", "ingenierie des donnees", "big data", "megadonnees", "snowflake", "databricks", "apache spark", "pyspark", "hadoop", "kafka", "airflow", "dbt", "bigquery", "redshift"],
    "Machine learning and AI": ["machine learning", "apprentissage automatique", "apprentissage machine", "deep learning", "apprentissage profond", "neural network", "reseaux de neurones", "artificial intelligence", "intelligence artificielle", "ia", "generative ai", "ia generative", "genai", "llm", "large language models", "grands modeles de langage", "nlp", "natural language processing", "traitement du langage naturel", "tensorflow", "pytorch", "keras", "hugging face", "langchain", "prompt engineering", "predictive modeling", "modelisation predictive", "modeles predictifs", "predictive analytics", "analyse predictive", "data science", "science des donnees", "data scientist", "scientifique des donnees", "mlops", "time series", "series temporelles"],
    "Cybersecurity": ["cybersecurity", "cybersecurite", "cyber security", "information security", "securite de l'information", "securite informatique", "securite des systemes d'information", "network security", "securite reseau", "application security", "securite applicative", "penetration testing", "pentest", "tests d'intrusion", "vulnerability management", "gestion des vulnerabilites", "vulnerability assessment", "threat modeling", "incident response", "reponse aux incidents", "soc", "siem", "firewall", "pare-feu", "encryption", "chiffrement", "cryptography", "cryptographie", "identity and access management", "gestion des identites et des acces", "access control", "controle d'acces", "zero trust", "nist", "soc 2", "pci dss", "cissp", "security architecture", "architecture de securite", "security controls", "controles de securite", "security engineering", "technological controls"],
    "Networking": ["computer networks", "reseaux informatiques", "reseautique", "tcp/ip", "dns", "dhcp", "vpn", "lan", "wan", "routing", "routage", "switching", "bgp", "ospf", "vlan", "cisco", "ccna", "network administration", "administration reseau", "network engineering", "network infrastructure", "infrastructure reseau", "telecommunications", "telecom", "fiber optic", "fibre optique", "voip", "wireless", "sans fil"],
    "IT support": ["it support", "technical support", "soutien technique", "support technique", "help desk", "helpdesk", "service desk", "centre de services", "assistance technique", "desktop support", "user support", "soutien aux utilisateurs", "itil", "servicenow", "zendesk", "ticketing", "billetterie", "active directory", "azure ad", "intune", "it infrastructure", "infrastructure ti", "infrastructure informatique", "technologies de l'information", "information technology"],
    "Tableau": ["tableau", "tableau desktop", "tableau server", "tableau prep"],
    "Visio": ["visio", "microsoft visio", "lucidchart", "draw.io", "miro"],
    "VBA": ["vba", "visual basic", "excel macros", "macros excel", "macro excel", "macros", "scripts vba"],
    "Microsoft Office": ["microsoft office", "ms office", "office 365", "microsoft 365", "m365", "suite microsoft office", "suite office", "microsoft office suite", "office suite", "pack office", "suite bureautique", "bureautique", "microsoft word", "ms word", "microsoft outlook", "microsoft teams", "ms teams", "onenote", "microsoft access", "ms access", "sharepoint", "power automate", "power apps", "power query", "power pivot", "dax", "power platform"],
    "Google Workspace": ["google workspace", "g suite", "gsuite", "google docs", "google sheets", "google slides", "google drive", "google forms", "google analytics", "google tag manager", "looker studio", "google apps script"],
    "CAD and engineering software": ["catia", "catia v5", "3dexperience", "siemens nx", "creo", "pro/engineer", "autodesk inventor", "fusion 360", "solid edge", "onshape", "rhino", "sketchup", "ansys", "abaqus", "nastran", "hypermesh", "comsol", "star-ccm", "openfoam", "enovia", "teamcenter", "windchill", "pdm", "product data management", "gestion des donnees de produit", "autocad electrical", "autocad mechanical", "solidworks simulation", "eplan", "altium", "altium designer", "orcad", "kicad", "ltspice", "multisim"],
    "Simulation software": ["flexsim", "anylogic", "simio", "extendsim", "promodel", "simul8", "plant simulation", "tecnomatix", "delmia", "simpy", "logiciel de simulation", "logiciels de simulation", "simulation software"],
    "Design and creative tools": ["photoshop", "illustrator", "indesign", "after effects", "premiere pro", "adobe creative suite", "adobe creative cloud", "suite adobe", "figma", "canva", "adobe xd", "graphic design", "design graphique", "graphiste", "graphic designer", "ui design", "ux design", "ui/ux", "ux/ui", "user experience", "experience utilisateur", "user interface", "interface utilisateur", "wireframe", "wireframes", "maquettes filaires", "design system", "systeme de design", "user research", "recherche utilisateur", "usability testing", "tests d'utilisabilite", "typography", "typographie", "video editing", "montage video", "motion design", "animation 2d", "animation 3d", "2d animation", "3d animation", "illustration"],
    "Game development": ["game development", "developpement de jeux", "developpement de jeux video", "game design", "conception de jeux", "conception de jeu", "level design", "conception de niveaux", "gameplay", "game engine", "moteur de jeu", "moteurs de jeu", "unity engine", "unity 3d", "unity3d", "unreal engine", "godot", "video games", "video game", "jeux video", "jeu video", "game programmer", "programmeur de jeux", "game artist", "artiste de jeux", "technical artist", "artiste technique", "live ops", "liveops", "live service", "free-to-play", "monetization", "monetisation", "player retention", "retention des joueurs", "game analytics", "playtest", "playtesting", "tests de jeu", "shaders", "shader", "rendering", "rendu 3d", "graphics programming", "programmation graphique", "opengl", "vulkan", "directx", "multiplayer", "multijoueur", "mobile games", "jeux mobiles"],

    # ====================================================================================== BUSINESS, FINANCE, PEOPLE, LAW, HEALTH, SERVICE (compact)
    "Accounting": ["accounting", "accountant", "comptabilite", "comptable", "bookkeeping", "tenue de livres", "general ledger", "grand livre", "journal entries", "ecritures comptables", "ecriture comptable", "month-end close", "cloture mensuelle", "cloture de fin de mois", "financial close", "bank reconciliation", "rapprochement bancaire", "rapprochements bancaires", "reconciliation", "reconciliations", "ifrs", "gaap", "normes comptables", "cpa", "cga", "cma", "quickbooks", "sage 50", "sage 300", "sage intacct", "acomba", "simple comptable", "xero", "accounting software", "logiciels de comptabilite", "chart of accounts", "plan comptable", "fixed assets", "immobilisations", "amortization", "amortissement", "consolidation", "financial statements", "etats financiers", "financial reporting", "rapports financiers", "balance sheet", "bilan", "income statement", "etat des resultats", "variance analysis", "analyse des ecarts budgetaires", "analyse des variations"],
    "Accounts payable and receivable": ["accounts payable", "accounts receivable", "comptes payables", "comptes recevables", "comptes fournisseurs", "comptes clients", "comptes a payer", "comptes a recevoir", "invoicing", "facturation", "billing", "invoice processing", "traitement des factures", "payment processing", "traitement des paiements", "collections", "recouvrement", "credit and collections", "credit et recouvrement", "credit management", "gestion du credit", "expense reports", "notes de frais", "purchase to pay", "order to cash", "3-way match", "three-way match"],
    "Payroll": ["payroll", "paie", "paye", "gestion de la paie", "traitement de la paie", "payroll processing", "payroll administration", "administration de la paie", "ceridian", "dayforce", "adp", "ukg", "kronos", "deductions a la source", "source deductions", "time and attendance", "presences et horaires", "shift scheduling", "gestion des horaires", "planification des horaires", "staff scheduling"],
    "Financial analysis": ["financial analysis", "analyse financiere", "analyses financieres", "financial modeling", "financial modelling", "modelisation financiere", "financial planning", "planification financiere", "fp&a", "financial planning and analysis", "dcf", "discounted cash flow", "valuation", "evaluation d'entreprise", "pro forma", "financial forecasting", "previsions financieres", "financial projections", "projections financieres", "scenario analysis", "analyse de scenarios", "sensitivity analysis", "analyse de sensibilite", "return on investment", "roi", "retour sur investissement", "npv", "irr", "payback", "periode de recuperation", "capex", "opex", "capital budgeting", "investment analysis", "analyse d'investissement", "cost-benefit analysis", "analyse cout-avantage", "analyse cout-benefice", "financial metrics", "indicateurs financiers", "ratios financiers", "financial ratios", "profitability analysis", "margin analysis", "analyse des marges", "pricing", "tarification", "fixation des prix", "treasury", "tresorerie", "cash management", "gestion de la tresorerie", "cash flow", "flux de tresorerie", "working capital", "fonds de roulement", "m&a", "mergers and acquisitions", "fusions et acquisitions", "due diligence", "diligence raisonnable", "private equity", "capital-investissement", "investment banking", "banque d'investissement", "equity research", "bloomberg", "cfa", "frm"],
    "Budgeting": ["budgeting", "budget management", "gestion de budget", "gestion budgetaire", "budgetisation", "budget annuel", "annual budget", "elaboration de budgets", "elaboration du budget", "preparation du budget", "budget preparation", "previsions budgetaires", "budget forecasts", "suivi budgetaire", "budget monitoring", "budget control", "controle budgetaire", "budgetary control", "budget vs actual", "budget versus reel", "cost center", "centre de couts", "centres de couts", "cost management", "gestion des couts", "cost control", "controle des couts", "reduction des couts", "cost reduction", "cost savings", "economies de couts", "cost analysis", "analyse des couts", "total cost of ownership", "cout total de possession", "tco", "cost estimation", "costing", "calcul des couts", "cout de revient", "prix de revient", "standard costing", "cout standard", "activity-based costing", "cost accounting", "comptabilite analytique", "comptabilite de gestion", "management accounting"],
    "Auditing": ["audit", "auditing", "auditor", "auditeur", "auditrice", "internal audit", "audit interne", "audits internes", "external audit", "audit externe", "financial audit", "audit financier", "operational audit", "audit operationnel", "compliance audit", "audit de conformite", "quality audit", "audit qualite", "audit de qualite", "audits de qualite", "supplier audit", "audits de fournisseurs", "process audit", "audit de processus", "audit trail", "piste d'audit", "audit findings", "constatations d'audit", "audit report", "rapport d'audit", "lead auditor", "auditeur principal", "sox", "sarbanes-oxley", "internal controls", "controles internes", "controle interne", "coso", "controls testing", "tests de controles"],
    "Taxation": ["taxation", "fiscalite", "impots", "impot", "tax compliance", "conformite fiscale", "tax planning", "planification fiscale", "tax preparation", "preparation de declarations", "tax returns", "declarations de revenus", "income tax", "impot sur le revenu", "corporate tax", "impot des societes", "sales tax", "taxes de vente", "gst/hst", "tps/tvq", "tps/tvh", "tps", "tvq", "tvh", "transfer pricing", "prix de transfert", "tax credits", "credits d'impot", "sr&ed", "rs&de", "rsde", "customs duties", "droits de douane", "cra", "revenu quebec", "tax law", "droit fiscal", "taxprep"],
    "Human resources": ["human resources", "ressources humaines", "rh", "hris", "systemes rh", "systeme rh", "dossiers employe", "dossiers des employes", "employee records", "personnel files", "dossiers du personnel", "hr administration", "administration des ressources humaines", "hr operations", "operations rh", "hr generalist", "generaliste rh", "generaliste en ressources humaines", "hr business partner", "hrbp", "partenaire d'affaires rh", "conseiller en ressources humaines", "conseillere en ressources humaines", "hr advisor", "hr coordinator", "coordonnateur rh", "coordonnatrice rh", "hr assistant", "hr policies", "politiques rh", "politiques de ressources humaines", "hr analytics", "analytique rh", "people analytics", "workforce planning", "planification de la main-d'oeuvre", "learning and development", "apprentissage et developpement", "organizational development", "developpement organisationnel", "employee experience", "experience employe", "employee survey", "sondage aupres des employes", "employee retention", "retention des employes", "offboarding", "employer branding", "marque employeur", "workday hcm", "successfactors", "bamboohr", "lms", "learning management system"],
    "Recruitment": ["recruitment", "recruiting", "recruiter", "recruteur", "recruteuse", "talent acquisition", "acquisition de talents", "candidate sourcing", "sourcing de candidats", "recherche de candidats", "candidate screening", "selection de candidats", "preselection", "pre-selection", "pre-screening", "screening candidates", "interviewing", "conduct interviews", "mener des entrevues", "behavioral interviews", "entrevues comportementales", "job postings", "affichage de postes", "offres d'emploi", "job descriptions", "descriptions de poste", "descriptions de postes", "offer letters", "lettres d'offre", "background checks", "verification des antecedents", "reference checks", "verification des references", "applicant tracking system", "ats", "systeme de suivi des candidatures", "greenhouse", "icims", "taleo", "smartrecruiters", "linkedin recruiter", "boolean search", "recherche booleenne", "headhunting", "chasseur de tetes", "executive search", "recherche de cadres", "campus recruitment", "recrutement universitaire", "job fairs", "career fairs", "salons de l'emploi", "talent pipeline", "bassin de talents", "talent pool", "full-cycle recruitment", "recrutement de bout en bout", "cycle complet de recrutement", "end-to-end recruitment", "integration des nouveaux employes", "orientation des nouveaux employes"],
    "Employee and labour relations": ["labour relations", "labor relations", "relations de travail", "relations du travail", "employee relations", "relations avec les employes", "relations syndicales", "union relations", "unionized", "milieu syndique", "collective agreement", "convention collective", "conventions collectives", "grievance", "grievances", "grief", "griefs", "arbitration", "arbitrage", "collective bargaining", "negociation collective", "employment standards", "normes du travail", "employment law", "droit du travail", "labour law", "labor law", "lois du travail", "human rights", "droits de la personne", "harassment", "harcelement", "harcelement psychologique", "workplace investigations", "enquetes en milieu de travail", "disciplinary", "mesures disciplinaires", "progressive discipline", "discipline progressive", "absence management", "gestion des absences", "disability management", "gestion de l'invalidite", "return to work", "retour au travail", "duty to accommodate", "obligation d'accommodement", "employee assistance program", "programme d'aide aux employes", "pae"],
    "Compensation and benefits": ["compensation and benefits", "remuneration globale", "total rewards", "salary administration", "administration des salaires", "salary benchmarking", "analyse comparative des salaires", "job evaluation", "evaluation des emplois", "evaluation de poste", "job grading", "classification des emplois", "pay equity", "equite salariale", "pay structure", "structure salariale", "salary bands", "echelles salariales", "benefits administration", "administration des avantages sociaux", "gestion des avantages sociaux", "employee benefits", "group benefits", "assurances collectives", "assurance collective", "pension plan", "regime de retraite", "regimes de retraite", "incentive plans", "regimes incitatifs", "executive compensation", "remuneration des dirigeants", "mercer", "willis towers watson", "korn ferry", "compensation surveys", "enquetes salariales"],
    "Contracts and legal": ["contract management", "gestion des contrats", "gestion de contrats", "contract drafting", "redaction de contrats", "contract review", "revision de contrats", "examen de contrats", "contract administration", "administration de contrats", "administration des contrats", "legal research", "recherche juridique", "legal writing", "redaction juridique", "legal analysis", "analyse juridique", "legal advice", "conseils juridiques", "legal opinions", "avis juridiques", "legal documents", "documents juridiques", "paralegal", "parajuriste", "legal assistant", "adjointe juridique", "adjoint juridique", "litigation", "litige", "litiges", "contentieux", "corporate law", "droit corporatif", "droit des societes", "commercial law", "droit commercial", "business law", "droit des affaires", "corporate governance", "gouvernance d'entreprise", "corporate secretary", "secretaire corporatif", "securities law", "droit des valeurs mobilieres", "real estate law", "droit immobilier", "intellectual property", "propriete intellectuelle", "patents", "brevets", "trademarks", "marques de commerce", "copyright", "droit d'auteur", "licensing agreements", "ententes de licence"],
    "Privacy and data protection": ["privacy law", "droit de la vie privee", "privacy compliance", "protection des renseignements personnels", "protection de la vie privee", "data protection", "protection des donnees", "data privacy", "loi 25", "bill 64", "pipeda", "lprpde", "gdpr", "rgpd", "ccpa", "privacy impact assessment", "evaluation des facteurs relatifs a la vie privee", "pia"],
    "Trade compliance": ["trade compliance", "conformite commerciale", "export controls", "controles a l'exportation", "controle des exportations", "itar", "controlled goods", "marchandises controlees", "programme des marchandises controlees", "customs compliance", "conformite douaniere", "tariff classification", "classification tarifaire", "harmonized system", "systeme harmonise", "hs codes", "codes sh", "cusma", "aceum", "usmca", "free trade agreements", "accords de libre-echange"],
    "Marketing": ["marketing", "digital marketing", "marketing numerique", "marketing digital", "content marketing", "marketing de contenu", "email marketing", "marketing par courriel", "courriel marketing", "campaign management", "gestion de campagnes", "gestion des campagnes", "marketing campaigns", "campagnes marketing", "marketing strategy", "strategie marketing", "strategie de marketing", "marketing plan", "plan marketing", "plan de marketing", "marketing communications", "communications marketing", "marcom", "marcomm", "product marketing", "marketing de produit", "growth marketing", "marketing de croissance", "performance marketing", "marketing de performance", "demand generation", "generation de la demande", "lead generation", "generation de leads", "generation de prospects", "generation de pistes", "account-based marketing", "abm", "marketing par comptes", "b2b marketing", "marketing b2b", "brand marketing", "marketing de marque", "field marketing", "event marketing", "marketing evenementiel", "event planning", "planification d'evenements", "organisation d'evenements", "event management", "gestion d'evenements", "trade shows", "salons professionnels", "marketing analytics", "analytique marketing", "marketing metrics", "metriques marketing", "marketing mix", "market segmentation", "segmentation de marche", "customer segmentation", "segmentation de la clientele", "personas", "buyer personas", "customer journey", "parcours client", "parcours de l'acheteur", "ab testing", "a/b testing", "tests a/b", "conversion rate optimization", "cro", "optimisation du taux de conversion", "landing pages", "pages d'atterrissage", "web analytics", "analytique web", "marketing automation", "automatisation du marketing", "automatisation marketing", "lead nurturing", "nurturing", "lead scoring", "go-to-market", "strategie de mise en marche", "strategie de commercialisation", "product launch", "lancement de produit", "lancements de produits", "value proposition", "proposition de valeur", "positioning", "positionnement", "competitive analysis", "analyse concurrentielle", "analyse de la concurrence", "competitive intelligence", "veille concurrentielle", "benchmarking", "analyse comparative"],
    "SEO and paid media": ["seo", "search engine optimization", "optimisation pour les moteurs de recherche", "referencement", "referencement naturel", "search engine marketing", "ppc", "pay per click", "publicite au clic", "paid search", "recherche payante", "paid media", "medias payants", "publicite payante", "paid social", "display advertising", "publicite display", "programmatic", "programmatique", "retargeting", "reciblage", "remarketing", "keyword research", "recherche de mots-cles", "backlinks", "link building", "technical seo", "seo technique", "semrush", "ahrefs", "google search console", "google ads", "meta ads", "facebook ads", "publicite facebook", "linkedin ads", "publicite linkedin", "tiktok ads", "adobe analytics", "adobe experience manager", "optimizely", "hotjar", "mixpanel", "amplitude", "attribution marketing", "attribution models", "modeles d'attribution", "utm"],
    "Social media and content": ["social media", "reseaux sociaux", "medias sociaux", "community management", "gestion de communaute", "gestion de communautes", "community manager", "gestionnaire de communaute", "social media management", "gestion des medias sociaux", "gestion des reseaux sociaux", "social media strategy", "strategie de medias sociaux", "social media content", "contenu pour les reseaux sociaux", "social listening", "ecoute sociale", "hootsuite", "sprout social", "content creation", "creation de contenu", "content creator", "createur de contenu", "content strategy", "strategie de contenu", "content calendar", "calendrier de contenu", "calendrier editorial", "editorial calendar", "content management", "gestion de contenu", "content production", "production de contenu", "copywriting", "redaction publicitaire", "redaction de contenu", "content writing", "content writer", "redacteur web", "web writing", "redaction web", "blog posts", "articles de blogue", "blogging", "newsletter", "infolettre", "infolettres", "press releases", "communiques de presse", "communique de presse", "media relations", "relations avec les medias", "relations medias", "public relations", "relations publiques", "crisis communications", "communications de crise", "internal communications", "communications internes", "communication interne", "corporate communications", "communications corporatives", "communications d'entreprise", "employee communications", "communications aux employes", "speechwriting", "redaction de discours", "proofreading", "relecture", "correction d'epreuves", "copy editing", "revision linguistique", "style guide", "guide de style", "translation", "traduction", "translator", "traducteur", "traductrice", "localization", "localisation", "interpretation", "interpretariat", "podcast", "balado", "video production", "production video", "motion graphics", "infographic", "infographie", "wordpress", "drupal", "shopify", "webflow", "cms", "e-commerce", "ecommerce", "commerce electronique", "commerce en ligne"],
    "Branding": ["branding", "brand management", "gestion de marque", "gestion de la marque", "brand strategy", "strategie de marque", "brand identity", "identite de marque", "identite visuelle", "visual identity", "brand guidelines", "normes de marque", "brand voice", "voix de marque", "ton de marque", "tone of voice", "brand awareness", "notoriete de marque", "brand equity", "brand positioning", "positionnement de marque", "rebranding", "image de marque", "brand image", "reputation management", "gestion de la reputation", "brand ambassador", "ambassadeur de marque", "sponsorship", "commandite", "commandites", "partnership development", "developpement de partenariats", "strategic partnerships", "partenariats strategiques", "strategic alliances", "alliances strategiques"],
    "Market research": ["market research", "etudes de marche", "etude de marche", "recherche de marche", "marketing research", "market analysis", "analyse de marche", "analyses de marche", "market sizing", "dimensionnement du marche", "market trends", "tendances du marche", "tendances de marche", "industry analysis", "analyse de l'industrie", "analyse sectorielle", "competitive landscape", "paysage concurrentiel", "survey design", "conception de sondages", "questionnaire design", "conception de questionnaires", "surveys", "sondages", "survey analysis", "analyse de sondages", "focus groups", "groupes de discussion", "qualitative research", "recherche qualitative", "quantitative research", "recherche quantitative", "primary research", "recherche primaire", "secondary research", "recherche secondaire", "customer research", "voice of the customer", "voix du client", "net promoter score", "nps", "customer satisfaction surveys", "sondages de satisfaction", "customer feedback", "retroaction des clients", "commentaires des clients", "spss", "sas", "stata", "qualtrics", "surveymonkey", "nielsen", "ipsos", "gartner", "forrester", "statista", "statistique canada", "statistics canada", "demographics", "demographie", "consumer insights", "perspectives consommateurs", "consumer behaviour", "comportement du consommateur", "comportement des consommateurs", "consumer behavior"],
    "Sales": ["sales", "ventes", "vente", "business development", "developpement des affaires", "developpement commercial", "developpement d'affaires", "business developer", "prospecting", "prospection", "cold calling", "appels a froid", "demarchage", "demarchage telephonique", "outbound calls", "appels sortants", "inbound calls", "appels entrants", "sales calls", "appels de vente", "sales presentations", "presentations de vente", "product demonstrations", "demonstrations de produits", "sales cycle", "cycle de vente", "cycles de vente", "closing deals", "conclure des ventes", "conclure des affaires", "sales targets", "objectifs de vente", "quotas", "quota", "sales quota", "sales performance", "performance des ventes", "sales growth", "croissance des ventes", "revenue growth", "croissance des revenus", "new business", "nouvelles affaires", "client acquisition", "acquisition de clients", "customer acquisition", "customer retention", "fidelisation de la clientele", "fidelisation client", "fidelisation", "loyalty programs", "programmes de fidelisation", "upselling", "vente incitative", "ventes incitatives", "cross-selling", "vente croisee", "ventes croisees", "account management", "gestion de comptes", "gestion des comptes", "gestion de compte", "account manager", "gestionnaire de comptes", "key account management", "gestion des comptes cles", "comptes cles", "key accounts", "account executive", "territory management", "gestion de territoire", "gestion du territoire", "channel sales", "ventes par canal", "indirect sales", "ventes indirectes", "inside sales", "ventes internes", "field sales", "ventes terrain", "b2b sales", "ventes b2b", "enterprise sales", "ventes aux grandes entreprises", "solution selling", "vente de solutions", "consultative selling", "vente consultative", "technical sales", "ventes techniques", "vente technique", "sales engineer", "ingenieur des ventes", "ingenieure des ventes", "technico-commercial", "sales support", "soutien aux ventes", "sales coordination", "coordination des ventes", "sales operations", "operations de vente", "operations des ventes", "sales enablement", "sales analytics", "sales forecasting", "previsions des ventes", "sales pipeline", "pipeline de ventes", "pipeline management", "gestion du pipeline", "commercial strategy", "strategie commerciale", "business acumen", "sens des affaires", "sens commercial", "acuite commerciale", "customer success", "succes client", "customer onboarding", "integration des clients", "renewals", "renouvellements", "churn", "attrition de la clientele"],
    "CRM tools": ["crm", "salesforce", "hubspot", "customer relationship management", "gestion de la relation client", "gestion de la relation clientele", "dynamics crm", "zoho crm", "pipedrive", "sales cloud", "service cloud", "marketing cloud", "pardot", "eloqua", "marketo", "mailchimp", "sendgrid", "braze", "klaviyo", "customer data platform", "cdp", "plateforme de donnees clients", "pega", "pega cdh"],
    "Healthcare and clinical": ["patient care", "soins aux patients", "soins au patient", "soins de sante", "healthcare", "health care", "clinical", "clinique", "clinician", "clinicien", "clinicienne", "nursing", "soins infirmiers", "infirmier", "infirmiere", "registered nurse", "infirmiere autorisee", "infirmier autorise", "oiiq", "infirmiere auxiliaire", "infirmier auxiliaire", "prepose aux beneficiaires", "preposee aux beneficiaires", "pab", "personal support worker", "psw", "first aid", "premiers soins", "secourisme", "cpr", "rcr", "reanimation cardiorespiratoire", "defibrillateur", "medical devices", "dispositifs medicaux", "dispositif medical", "appareils medicaux", "medical equipment", "equipement medical", "equipements medicaux", "fda", "health canada", "sante canada", "mdsap", "ce marking", "marquage ce", "510(k)", "clinical research", "recherche clinique", "clinical trials", "essais cliniques", "essai clinique", "clinical operations", "operations cliniques", "good clinical practice", "bonnes pratiques cliniques", "regulatory submissions", "soumissions reglementaires", "medical writing", "redaction medicale", "pharmacovigilance", "pharmacology", "pharmacologie", "pharmacist", "pharmacien", "pharmacienne", "pharmacy", "pharmacie", "pharmacy technician", "technicien en pharmacie", "medication administration", "administration de medicaments", "telemedicine", "telemedecine", "telehealth", "telesante", "electronic medical records", "dossiers medicaux electroniques", "dossier medical electronique", "emr", "electronic health records", "dossiers de sante electroniques", "ehr", "epic systems", "cerner", "medical coding", "codage medical", "icd-10", "cim-10", "medical billing", "facturation medicale", "ramq", "medical terminology", "terminologie medicale", "medical secretary", "secretaire medicale", "patient scheduling", "prise de rendez-vous", "gestion des rendez-vous", "appointment scheduling", "patient intake", "accueil des patients", "vital signs", "signes vitaux", "phlebotomy", "phlebotomie", "laboratory testing", "analyses de laboratoire", "medical laboratory", "laboratoire medical", "medical imaging", "imagerie medicale", "radiology", "radiologie", "ultrasound", "echographie", "physiotherapy", "physiotherapie", "physiotherapist", "physiotherapeute", "occupational therapy", "ergotherapie", "ergotherapeute", "speech-language pathology", "orthophonie", "psychology", "psychologie", "psychologue", "counselling", "counseling", "psychotherapy", "psychotherapie", "mental health", "sante mentale"],
    "Social and community services": ["social work", "travail social", "travailleur social", "travailleuse sociale", "case management", "gestion de cas", "case manager", "intervenant social", "intervenante sociale", "crisis intervention", "intervention de crise", "community services", "services communautaires", "community outreach", "sensibilisation communautaire", "action communautaire", "community engagement", "engagement communautaire", "mobilisation communautaire", "volunteer coordination", "coordination de benevoles", "volunteer management", "gestion des benevoles", "fundraising", "collecte de fonds", "levee de fonds", "grant writing", "redaction de demandes de subvention", "grant management", "gestion des subventions", "donor relations", "relations avec les donateurs", "philanthropy", "philanthropie", "non-profit", "sans but lucratif", "osbl", "obnl", "ngo", "ong"],
    "Food safety and hospitality": ["food safety", "salubrite", "salubrite alimentaire", "hygiene alimentaire", "haccp", "mapaq", "food handling", "manipulation des aliments", "food preparation", "preparation des aliments", "food service", "service alimentaire", "services alimentaires", "restauration", "culinary", "culinaire", "culinary arts", "arts culinaires", "kitchen operations", "operations de cuisine", "line cook", "cuisinier de ligne", "bartender", "barman", "barista", "hospitality", "hospitalite", "hotellerie", "hotel operations", "operations hotelieres", "front desk", "reception hoteliere", "housekeeping", "entretien menager", "guest services", "services aux invites", "guest experience", "experience des invites", "reservation systems", "systemes de reservation", "point of sale", "point de vente", "pos system", "systeme de point de vente", "cash handling", "manipulation d'argent", "maniement d'argent", "maniement de caisse", "gestion de caisse", "cashier", "caissier", "caissiere", "cash register", "caisse enregistreuse", "opening procedures", "closing procedures", "inventory counts", "inventaires physiques", "stock replenishment", "reapprovisionnement des stocks", "reapprovisionnement des tablettes", "stocking shelves", "garnir les tablettes", "mise en tablette", "mise en rayon", "visual merchandising", "marchandisage visuel", "merchandising", "marchandisage", "category management", "gestion de categories", "assortment planning", "planification de l'assortiment", "loss prevention", "prevention des pertes", "prevention des vols", "store operations", "operations en magasin", "operations de magasin", "store management", "gestion de magasin", "gestion de boutique", "retail operations", "operations de detail"],
    "Spanish": ["spanish", "espagnol"],
    "Mandarin and Chinese": ["mandarin", "mandarin chinese", "chinese", "chinois", "cantonese", "cantonais"],
    "Arabic": ["arabic", "arabe"],
    "German": ["german", "allemand"],
    "Italian": ["italian", "italien"],
    "Portuguese": ["portuguese", "portugais"],
    "Other languages": ["hindi", "punjabi", "pendjabi", "urdu", "tagalog", "vietnamese", "vietnamien", "korean", "coreen", "japanese", "japonais", "russian", "russe", "ukrainian", "ukrainien", "polish", "polonais", "greek", "grec", "turkish", "turc", "persian", "persan", "farsi", "hebrew", "hebreu", "haitian creole", "creole haitien", "multilingual", "multilingue", "plurilingue", "trilingual", "trilingue", "third language", "troisieme langue", "native speaker", "locuteur natif", "locutrice native"],
}


# ---------------------------------------------------------------------------------------------------------
# Close pairs: (skill the posting asks for, skill that is on the CV, why they are close).
# A close pair is shown, never counted as a match, and counts half in the second figure.
# Written both ways when each side is close to the other.
# ---------------------------------------------------------------------------------------------------------
# ---------------------------------------------------------------------------------------------
# PRUNE: spellings taken OUT of a skill after tracing them over 234 real postings.
# Each one fired on something that is not the skill: benefits perks ("regime de retraite"),
# the French word for a job interview ("entretien"), company "initiatives", an "achat de vacances", etc.
# Format: skill -> (aliases to remove, aliases to add instead).  Applied by keyword_extractor.py.
# ---------------------------------------------------------------------------------------------
# NO_PLURAL: words that must NOT also match with an added 's'. 'initiative' is a soft skill, but
# 'initiatives' is what a company runs ('strategic initiatives': 55 of the 79 hits in real postings).
NO_PLURAL = ["initiative"]

PRUNE = {
    "Compensation and benefits": (
        ["assurances collectives", "assurance collective", "pension plan", "regime de retraite", "regimes de retraite",
         "echelles salariales", "group benefits", "employee benefits"],
        []),
    "Employee and labour relations": (
        ["unionized", "milieu syndique", "harassment", "harcelement", "harcelement psychologique", "human rights",
         "droits de la personne", "employee assistance program", "programme d'aide aux employes", "pae",
         "return to work", "retour au travail"],
        []),
    "Recruitment": (
        ["recruiter", "recruteur", "recruteuse", "background checks", "verification des antecedents"],
        ["recruitment specialist", "specialiste en recrutement", "recrutement", "recruitment process"]),
    "Procurement": (
        ["achat"],           # 'l'achat d'un maximum de 2 semaines de vacances' is a perk
        ["commande d'achat", "commandes d'achat", "agent d'achat", "agent aux achats", "agente aux achats",
         "conseiller en achat", "gestion des achats", "service des achats", "departement des achats"]),
    "Maintenance and reliability": (
        ["entretien"],       # in French postings 'entretien' is mostly the job interview
        ["entretien des equipements", "entretien d'equipement", "entretien des batiments", "entretien du batiment",
         "entretien general", "entretien mecanique", "entretien electrique", "entretien industriel",
         "entretien de base", "entretien correctif", "entretien des machines", "entretien des installations"]),
    "Mentoring and coaching": (
        ["accompagnement", "accompagner"],   # 'nous vous accompagnons' is not mentoring
        ["accompagner les employes", "accompagner et developper", "accompagnement des employes",
         "accompagnement professionnel", "accompagner les membres", "coaching des employes"]),
    "Social media and content": (
        ["interpretation"],  # 'interpretation des donnees' is data analysis
        []),
    "Data analysis": (
        [],
        ["interpretation de donnees", "interpretation des donnees", "data interpretation", "interpreting data"]),
    "Assembly": (
        ["throughput"],      # throughput is a pipeline/logistics word as often as an assembly one
        []),
    "Game development": (
        ["monetisation", "monetization"],
        []),
    "Healthcare and clinical": (
        ["telemedecine", "telemedicine"],    # a perk ('incluant la telemedecine') in most postings
        []),
}

CLOSE_PAIRS = [
    ("Teamwork", "Collaboration", "working in a team and collaborating are the same habit"),
    ("Collaboration", "Teamwork", "working in a team and collaborating are the same habit"),
    ("Communication", "Written communication", "written communication is one kind of communication"),
    ("Communication", "Verbal communication", "verbal communication is one kind of communication"),
    ("Communication", "Presentation skills", "presenting is a form of communication"),
    ("Written communication", "Communication", "communication skills usually include writing"),
    ("Verbal communication", "Communication", "communication skills usually include speaking"),
    ("Verbal communication", "Presentation skills", "presenting is speaking to a group"),
    ("Presentation skills", "Verbal communication", "presenting is speaking to a group"),
    ("Time management", "Prioritization", "managing time means choosing what comes first"),
    ("Prioritization", "Time management", "managing time means choosing what comes first"),
    ("Time management", "Organizational skills", "organising work is how time is managed"),
    ("Multitasking", "Prioritization", "juggling tasks depends on setting priorities"),
    ("Prioritization", "Multitasking", "juggling tasks depends on setting priorities"),
    ("Works under pressure", "Resilience", "resilience is what keeps work steady under pressure"),
    ("Works under pressure", "Meets deadlines", "deadlines are the usual source of pressure"),
    ("Meets deadlines", "Time management", "meeting deadlines is a result of managing time"),
    ("Initiative", "Proactivity", "taking initiative is acting proactively"),
    ("Proactivity", "Initiative", "taking initiative is acting proactively"),
    ("Autonomy", "Initiative", "working on your own includes taking initiative"),
    ("Initiative", "Autonomy", "working on your own includes taking initiative"),
    ("Problem solving", "Critical thinking", "critical thinking is how problems are worked out"),
    ("Problem solving", "Analytical skills", "analysis is how problems are worked out"),
    ("Critical thinking", "Analytical skills", "both judge information carefully"),
    ("Analytical skills", "Critical thinking", "both judge information carefully"),
    ("Critical thinking", "Problem solving", "both work through a problem"),
    ("Analytical skills", "Problem solving", "both work through a problem"),
    ("Creativity", "Innovation", "innovation is creativity put to use"),
    ("Innovation", "Creativity", "innovation is creativity put to use"),
    ("Adaptability", "Learning agility", "learning quickly is how people adapt"),
    ("Learning agility", "Adaptability", "learning quickly is how people adapt"),
    ("Rigor", "Attention to detail", "rigour includes care for detail"),
    ("Attention to detail", "Rigor", "rigour includes care for detail"),
    ("Accountability", "Dependability", "being dependable is part of being accountable"),
    ("Dependability", "Accountability", "being dependable is part of being accountable"),
    ("Leadership", "Team management", "leading a team is a form of leadership"),
    ("Team management", "Leadership", "leadership is a part of managing a team"),
    ("Mentoring and coaching", "Training and teaching", "training others is close to coaching them"),
    ("Training and teaching", "Mentoring and coaching", "coaching others is close to training them"),
    ("Customer service", "Interpersonal skills", "serving people well relies on interpersonal skills"),
    ("Stakeholder management", "Collaboration", "managing stakeholders means working with them"),
    ("Quality management", "Quality assurance", "quality assurance is a part of a quality management system"),
    ("Quality management", "Quality control", "quality control is a part of a quality management system"),
    ("Quality assurance", "Quality management", "quality assurance sits inside quality management"),
    ("Quality control", "Quality management", "quality control sits inside quality management"),
    ("Statistical process control", "Statistical analysis", "SPC is statistics applied to a process"),
    ("Statistical process control", "Quality control", "SPC is a quality control method"),
    ("Statistical analysis", "Statistical process control", "SPC is statistics applied to a process"),
    ("Control plans", "Quality control", "a control plan sets out the quality checks"),
    ("FMEA", "Risk management", "FMEA is a risk method"),
    ("Risk management", "FMEA", "FMEA is a risk method"),
    ("FMEA", "Root cause analysis", "FMEA and root cause analysis both study failures"),
    ("Data analysis", "Statistical analysis", "statistics is a way of analysing data"),
    ("Statistical analysis", "Data analysis", "data analysis includes statistics"),
    ("Databases", "SQL", "SQL is how databases are queried"),
    ("SQL", "Databases", "SQL is the language of databases"),
    ("Software development", "Programming", "programming is the core of software development"),
    ("Programming", "Software development", "software development is built on programming"),
    ("Programming", "Python", "Python is a programming language"),
    ("Software development", "Python", "Python is used to build software"),
    ("Machine learning and AI", "Python", "Python is the main language of machine learning"),
    ("Machine learning and AI", "Statistical analysis", "machine learning builds on statistics"),
    ("Financial analysis", "Budgeting", "budgeting is one part of financial analysis"),
    ("Budgeting", "Financial analysis", "financial analysis includes budgets"),
    ("Accounting", "Financial analysis", "financial analysis works on accounting figures"),
    ("Financial analysis", "Accounting", "accounting supplies the figures for analysis"),
    ("Human resources", "Recruitment", "recruitment is a part of human resources"),
    ("Recruitment", "Human resources", "human resources includes recruitment"),
    ("Employee and labour relations", "Human resources", "labour relations is a branch of human resources"),
    ("Compensation and benefits", "Human resources", "pay and benefits are a branch of human resources"),
    ("Marketing", "Social media and content", "social media and content are part of marketing"),
    ("Marketing", "SEO and paid media", "search and paid media are part of marketing"),
    ("Social media and content", "Marketing", "content is made for marketing"),
    ("SEO and paid media", "Marketing", "paid media is made for marketing"),
    ("Sales", "Customer service", "both deal with customers"),
    ("Project management", "Agile and Scrum", "Agile is a way of managing projects"),
    ("Agile and Scrum", "Project management", "project management includes Agile methods"),
    ("Simulation", "Simulation software", "simulation software is how simulation is done"),
    ("Simulation software", "Simulation", "simulation is what simulation software does"),
    ("Microsoft Office", "Excel", "Excel is part of Microsoft Office"),
    ("Microsoft Office", "PowerPoint", "PowerPoint is part of Microsoft Office"),
    ("Excel", "Microsoft Office", "Excel is part of Microsoft Office"),
    ("PowerPoint", "Microsoft Office", "PowerPoint is part of Microsoft Office"),
    ("CAD", "SolidWorks", "SolidWorks is CAD software"),
    ("CAD", "AutoCAD", "AutoCAD is CAD software"),
    ("CAD and engineering software", "CAD", "CAD is a use of engineering software"),
    ("CAD and engineering software", "SolidWorks", "SolidWorks is engineering software"),
    ("CAD and engineering software", "AutoCAD", "AutoCAD is engineering software"),
    ("SolidWorks", "CAD", "SolidWorks is a CAD program"),
    ("AutoCAD", "CAD", "AutoCAD is a CAD program"),
    ("Industrial controls and PLC", "Automation", "PLCs are how factories are automated"),
    ("Robotics", "Automation", "robots are a form of automation"),
    ("Automation", "Industrial controls and PLC", "PLCs are how factories are automated"),
    ("Mechanical design", "Mechanical engineering", "mechanical design is mechanical engineering work"),
    ("Mechanical design", "CAD", "mechanical design is drawn in CAD"),
    ("Electrical engineering", "Electronics", "electronics is close to electrical engineering"),
    ("Electronics", "Electrical engineering", "electrical engineering is close to electronics"),
    ("Testing and validation", "Quality control", "testing is how quality is checked"),
    ("Metrology and inspection", "Quality control", "inspection is how quality is checked"),
    ("Quality control", "Metrology and inspection", "measuring and inspecting is how quality is controlled"),
    ("Health and safety", "Compliance", "safety rules are a kind of compliance"),
    ("Compliance", "Health and safety", "health and safety is one area of compliance"),
    ("Auditing", "Compliance", "audits check compliance"),
    ("Compliance", "Auditing", "audits are how compliance is checked"),
    ("Environmental sustainability", "Compliance", "environmental rules are a kind of compliance"),
    ("Reporting", "Dashboards", "dashboards are a form of reporting"),
    ("Reporting", "KPIs", "reports show the KPIs"),
    ("Dashboards", "Reporting", "reporting covers dashboards"),
    ("Decision making", "Critical thinking", "critical thinking is how decisions are made"),
    ("Strategic thinking", "Analytical skills", "analysis feeds strategy"),
    ("Change management", "Project management", "change is managed as a project"),
    ("Digital transformation", "Automation", "automation is one part of digital transformation"),
]
CLOSE_PAIRS = [p for p in CLOSE_PAIRS if p[0] != p[1]]
