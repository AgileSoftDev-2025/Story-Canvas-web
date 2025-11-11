import re
import spacy
from langdetect import detect

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Fallback if spaCy model not available
    nlp = None

def analyze_project_description(description):
    """Analyze project description using NLP"""
    if nlp is None:
        return {
            "domain": "General",
            "potential_users": ["User", "Admin"],
            "potential_features": ["use the system"],
            "language": "en"
        }
    
    doc = nlp(description)
    entities = [ent.text for ent in doc.ents]
    nouns = [token.text for token in doc if token.pos_ == "NOUN"]
    
    domain = detect_domain(description)
    potential_users = extract_potential_users(description)
    potential_features = extract_potential_features(description)
    
    try:
        language = detect(description)
    except:
        language = "en"

    return {
        "domain": domain,
        "entities": entities,
        "key_nouns": nouns,
        "potential_users": potential_users,
        "potential_features": potential_features,
        "language": language
    }

def detect_domain(description):
    """Detect project domain from description"""
    description_lower = description.lower()
    
    domain_keywords = {
        "E-commerce": ["shop", "buy", "product", "cart", "order", "payment", "ecommerce"],
        "Healthcare": ["patient", "doctor", "medical", "health", "appointment", "hospital"],
        "Education": ["student", "teacher", "learn", "course", "assignment", "school"],
        "Finance": ["bank", "money", "account", "transaction", "payment", "financial"],
        "Social Media": ["social", "profile", "post", "share", "connect", "message"],
    }
    
    for domain, keywords in domain_keywords.items():
        if any(keyword in description_lower for keyword in keywords):
            return domain
    return "General"

def extract_potential_users(description):
    """Extract potential user roles from description"""
    patterns = [
        r"Users?:([^\.\n]+)",
        r"As a ([^,]+),",
        r"for ([^,\.\n]+)s?",
    ]
    
    users = []
    for pattern in patterns:
        matches = re.findall(pattern, description, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = match[0]
            users.extend([user.strip() for user in match.split(',') if len(user.strip()) > 2])
    
    users = list(set(users))
    users = [user for user in users if user.lower() not in [
        "the", "and", "for", "with", "that", "this", "system", "project"
    ]]
    
    return users if users else ["User", "Admin"]

def extract_potential_features(description):
    """Extract potential features from description"""
    patterns = [
        r"Features?:([^\.\n]+)",
        r"want to ([^,\.\n]+)",
        r"need to ([^,\.\n]+)",
        r"able to ([^,\.\n]+)",
    ]
    
    features = []
    for pattern in patterns:
        matches = re.findall(pattern, description, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = match[0]
            features.extend([feature.strip() for feature in match.split(',') if len(feature.strip()) > 3])
    
    features = list(set(features))
    return features[:10] if features else ["use the system", "manage content"]