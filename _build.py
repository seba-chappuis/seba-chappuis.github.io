import re
import json
from datetime import datetime

awkward_line_end_words_en = [
    # articles
    "a", "an", "the",

    # demonstratives
    "this", "that", "these", "those",

    # possessive determiners
    "my", "your", "his", "her", "its", "our", "their",

    # common quantifiers
    "some", "any", "each", "every", "either", "neither",
    "much", "many", "few", "several", "all", "both",

    # common prepositions
    "of", "to", "in", "on", "at", "by", "for", "with",
    "from", "into", "onto", "upon", "over", "under",
    "about", "before", "after", "between", "among",
    "through", "during", "without", "within", "around",

    # conjunctions
    "and", "or", "nor", "but", "so", "yet",
    "although", "though", "because", "since", "unless", "while",

    # auxiliary / modal verbs
    "am", "is", "are", "was", "were", "be", "been", "being",
    "do", "does", "did",
    "have", "has", "had",
    "can", "could", "may", "might", "must", "shall", "should", "will", "would",

    # pronouns (often weak at line end)
    "i", "you", "he", "she", "it", "we", "they",
    "me", "him", "us", "them",

    # relative / interrogative words
    "who", "whom", "whose", "which", "what", "when", "where", "why", "how",

    # other small function words
    "as", "if", "than", "then", "once", "only", "own", "per",
]

awkward_line_end_words_fr = [
    # articles définis / indéfinis / partitifs
    "le", "la", "les", "un", "une", "des", "du", "de", "l",

    # démonstratifs
    "ce", "cet", "cette", "ces",

    # possessifs
    "mon", "ma", "mes",
    "ton", "ta", "tes",
    "son", "sa", "ses",
    "notre", "nos",
    "votre", "vos",
    "leur", "leurs",

    # pronoms personnels
    "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
    "me", "te", "se", "moi", "toi", "lui", "eux",
    "y", "en",

    # prépositions courantes
    "à", "de", "par", "pour", "sans", "sous", "sur",
    "chez", "dans", "vers", "entre", "avec",

    # conjonctions
    "et", "ou", "où", "mais", "donc", "or", "ni", "car",
    "que", "qu", "si", "comme", "lorsque", "quand",

    # auxiliaires / verbes fréquents courts
    "ai", "as", "a", "avons", "avez", "ont",
    "suis", "es", "est", "sommes", "êtes", "sont",

    # relatifs / interrogatifs
    "qui", "que", "quoi", "dont",

    # adverbes courts fréquents
    "ne", "pas", "plus", "moins", "très", "trop", "bien", "mal",
    "déjà", "encore", "aussi", "ici", "là",
    
    # divers
    "»",
]

awkward_line_start_words_en = []
awkward_line_start_words_fr = ["?", "!", ":", ";" "»"]

awkward_line_end_words = {
    "en": awkward_line_end_words_en,
    "fr": awkward_line_end_words_fr,
}

awkward_line_start_words = {
    "en": awkward_line_start_words_en,
    "fr": awkward_line_start_words_fr,
}


def insert_nbsp(text, lang):
    words = re.split(r"( |~~|'|-)", text)
    words = [w if w != "~~" else "&nbsp;" for w in words]
    if lang not in awkward_line_end_words or lang not in awkward_line_start_words:
        return "".join(words)
    end_words = awkward_line_end_words[lang]
    start_words = awkward_line_start_words[lang]
    for i in range(len(words) - 1):
        word = words[i].lower()
        word_next = words[i + 1].lower()
        if word in end_words and word_next == " ":
            words[i + 1] = "&nbsp;"
    for i in range(1, len(words)):
        word = words[i].lower()
        word_prev = words[i - 1].lower()
        if word in start_words and word_prev == " ":
            words[i - 1] = "&nbsp;"
    return "".join(words)


def main():
    # Load "_lang/en.json" and convert to dict
    with open("_lang/en.json", "r") as f:
        lang_en = json.loads(f.read())
    
    # Load "_lang/fr.json" and convert to dict
    with open("_lang/fr.json", "r") as f:
        lang_fr = json.loads(f.read())
    
    # Load "_index_template.html"
    with open("_index_template.html", "r") as f:
        template = f.read()
    
    page_en = template
    page_fr = template
    
    # Replace "{{key}}" with the corresponding value
    for key in lang_en:
        text = lang_en[key]
        text = insert_nbsp(text, "en")
        page_en = page_en.replace("{{" + key + "}}", text)
    for key in lang_fr:
        text = lang_fr[key]
        text = insert_nbsp(text, "fr")
        page_fr = page_fr.replace("{{" + key + "}}", text)
    
    current_year = str(datetime.now().year)
    
    page_en = page_en.replace("{#CURRENT_YEAR#}", current_year)
    page_fr = page_fr.replace("{#CURRENT_YEAR#}", current_year)
    
    # Save pages as HTML files
    with open("index.html", "w") as f:
        f.write(page_fr)
    with open("fr/index.html", "w") as f:
        f.write(page_fr)
    with open("en/index.html", "w") as f:
        f.write(page_en)

if __name__ == "__main__":
    main()
