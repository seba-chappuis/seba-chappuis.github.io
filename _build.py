import json
from datetime import datetime

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
        page_en = page_en.replace("{{" + key + "}}", lang_en[key])
    for key in lang_fr:
        page_fr = page_fr.replace("{{" + key + "}}", lang_fr[key])
    
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
