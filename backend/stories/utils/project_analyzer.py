# stories/utils/project_analyzer.py
import re
import spacy
from langdetect import detect
from typing import Dict, List, Any

class ProjectAnalyzer:
    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Fallback jika spaCy model tidak tersedia
            self.nlp = None
            print("⚠️ spaCy model 'en_core_web_sm' not available. Using fallback NLP analysis.")
    
    def analyze_project_description(self, description: str) -> Dict[str, Any]:
        """Analyze project description using NLP - EXACT SAME AS COLAB"""
        if self.nlp is None:
            return {
                "domain": "General",
                "entities": [],
                "key_nouns": [],
                "key_verbs": [],
                "potential_users": ["User", "Admin"],
                "potential_features": ["use the system"],
                "language": "en"
            }
        
        doc = self.nlp(description)
        entities = [ent.text for ent in doc.ents]
        nouns = [token.text for token in doc if token.pos_ == "NOUN"]
        verbs = [token.lemma_ for token in doc if token.pos_ == "VERB"]
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
            "key_verbs": verbs,
            "potential_users": potential_users,
            "potential_features": potential_features,
            "language": language
        }
    
    def detect_domain(self, description: str) -> str:
        return detect_domain(description)
    
    def extract_potential_users(self, description: str) -> List[str]:
        return extract_potential_users(description)
    
    def extract_potential_features(self, description: str) -> List[str]:
        return extract_potential_features(description)
    
    def format_project_description(self, project_info: Dict) -> str:
        return format_project_description(project_info)

class SimpleProjectAnalyzer:
    """Simplified analyzer tanpa spaCy dependency - matches Colab fallback logic"""
    
    def analyze_project_description(self, description: str) -> Dict[str, Any]:
        return {
            "domain": detect_domain(description),
            "entities": [],
            "key_nouns": [],
            "key_verbs": [],
            "potential_users": extract_potential_users(description),
            "potential_features": extract_potential_features(description),
            "language": "en"
        }
    
    def detect_domain(self, description: str) -> str:
        return detect_domain(description)
    
    def extract_potential_users(self, description: str) -> List[str]:
        return extract_potential_users(description)
    
    def extract_potential_features(self, description: str) -> List[str]:
        return extract_potential_features(description)
    
    def format_project_description(self, project_info: Dict) -> str:
        return format_project_description(project_info)

# Standalone functions - EXACT SAME AS COLAB
def analyze_project_description(description: str) -> Dict[str, Any]:
    """Analyze project description using NLP - EXACT SAME AS COLAB"""
    analyzer = ProjectAnalyzer()
    return analyzer.analyze_project_description(description)

def detect_domain(description: str) -> str:
    """Detect project domain from description - EXACT SAME AS COLAB"""
    description_lower = description.lower()
    
    domain_keywords = {
        "E-commerce": ["shop", "buy", "product", "cart", "order", "payment", "ecommerce"],
        "Healthcare": ["patient", "doctor", "medical", "health", "appointment", "hospital", "monitoring", "vital"],
        "Education": ["student", "teacher", "learn", "course", "assignment", "school"],
        "Finance": ["bank", "money", "account", "transaction", "payment", "financial"],
        "Social Media": ["social", "profile", "post", "share", "connect", "message"],
        "Enterprise": ["business", "enterprise", "company", "organization", "workflow"],
        "IoT": ["iot", "internet of things", "sensor", "device", "smart"],
        "Gaming": ["game", "player", "level", "score", "multiplayer"],
        "Agriculture": ["farm", "crop", "soil", "irrigation", "yield", "harvest", "agriculture"],
        "Mental Health": ["mood", "therapy", "mental", "wellness", "stress", "anxiety", "meditation"]
    }
    
    for domain, keywords in domain_keywords.items():
        if any(keyword in description_lower for keyword in keywords):
            return domain
    return "General"

def extract_potential_users(description: str) -> List[str]:
    """Extract potential user roles from description - EXACT SAME AS COLAB"""
    patterns = [
        r"Users?:([^\.\n]+)",
        r"As a ([^,]+),",
        r"for ([^,\.\n]+)s?",
        r"\b([A-Z][a-z]+s?)\b(?:,|\.|$)"
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
        "the", "and", "for", "with", "that", "this", "system", "project",
        "title", "objective", "users", "features", "scope", "flow", "additional", "information"
    ]]
    
    return users if users else ["User", "Admin"]

def extract_potential_features(description: str) -> List[str]:
    """Extract potential features from description - EXACT SAME AS COLAB"""
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

    # Extract features from flow description - EXACT SAME AS COLAB
    flow_match = re.search(r"Flow:([^\.\n]+)", description, re.IGNORECASE)
    if flow_match:
        flow_parts = re.split(r"[→\-/>]", flow_match.group(1))
        features.extend([part.strip() for part in flow_parts if len(part.strip()) > 3])

    features = list(set(features))
    return features[:10] if features else ["use the system", "manage content"]

def format_project_description(project_info: Dict) -> str:
    """Format project description for LLM prompts - EXACT SAME AS COLAB"""
    description = f"""
    Title: {project_info.get('title', 'Untitled Project')}
    Objective: {project_info.get('objective', 'Not specified')}
    Users: {', '.join(project_info.get('users', []))}
    Features: {', '.join(project_info.get('features', []))}
    Scope: {project_info.get('scope', 'Not specified')}
    Flow: {project_info.get('flow', 'Not specified')}
    Additional Information: {project_info.get('additional_info', 'None')}
    """
    return description

def clean_role_name(role: str) -> str:
    """Clean and normalize role names for consistent grouping - EXACT SAME AS COLAB"""
    # Remove content in parentheses for grouping purposes
    cleaned = re.sub(r'\([^)]*\)', '', role).strip()
    # Normalize whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned)
    # Capitalize first letter of each word
    cleaned = ' '.join(word.capitalize() for word in cleaned.split())
    return cleaned

def extract_feature_from_action(action: str) -> str:
    """Extract a feature name from an action description - EXACT SAME AS COLAB"""
    if not action:
        return "General"

    # Extract first meaningful words from action
    words = action.split()[:3]
    feature = " ".join(words)

    # Clean up common patterns
    feature = re.sub(r'\b(?:to|a|an|the|my|our)\b', '', feature, flags=re.IGNORECASE)
    feature = re.sub(r'[^a-zA-Z0-9\s]', '', feature)
    feature = re.sub(r'\s+', ' ', feature).strip()

    return feature if feature else "General"

def group_stories_by_role(user_stories: List[Dict]) -> Dict:
    """Group user stories by cleaned role names - EXACT SAME AS COLAB"""
    stories_by_role = {}

    for story in user_stories:
        if isinstance(story, dict):
            role = story.get('role', 'General')
            # Clean the role name for consistent grouping
            clean_role = clean_role_name(role)
            stories_by_role.setdefault(clean_role, []).append(story)

    return stories_by_role

def collect_project_info_form() -> Dict:
    """Collect project information interactively - EXACT SAME AS COLAB"""
    print("=" * 60)
    print("PROJECT INFORMATION FORM")
    print("=" * 60)
    print("Please provide details about your project:\n")

    project_info = {}
    project_info["title"] = input("Title: ").strip()
    if not project_info["title"]:
        print("Title is required!")
        return None

    print("\nObjective (What is the main goal of the project?):")
    project_info["objective"] = input("> ").strip()

    print("\nUsers (comma-separated list of user roles):")
    users_input = input("> ").strip()
    project_info["users"] = [user.strip() for user in users_input.split(",") if user.strip()]

    print("\nFeatures (comma-separated list of key features):")
    features_input = input("> ").strip()
    project_info["features"] = [feature.strip() for feature in features_input.split(",") if feature.strip()]

    print("\nScope (What is included and excluded from the project?):")
    project_info["scope"] = input("> ").strip()

    print("\nFlow (Describe the main workflow or process flow):")
    project_info["flow"] = input("> ").strip()

    print("\nAdditional Information (any other relevant details):")
    project_info["additional_info"] = input("> ").strip()

    project_info["collected_date"] = "2024-01-01"  # Will be replaced with actual timestamp

    return project_info

def infer_specific_page(actor: str, action: str, goal: str) -> str:
    """Generate natural, domain-aware page names - EXACT SAME AS COLAB"""
    action_lower = action.lower()
    domain = detect_domain(f"{action} {goal} {actor}")

    page_templates = {
        "healthcare": {
            "appointment": "Appointment Scheduling",
            "medical": "Medical Records",
            "patient": "Patient Portal",
            "prescription": "Prescription Management"
        },
        "ecommerce": {
            "product": "Product Catalog",
            "cart": "Shopping Cart",
            "checkout": "Checkout",
            "order": "Order History"
        },
        "mental_health": {
            "mood": "Mood Tracking",
            "meditation": "Meditation Practice",
            "therapy": "Therapy Sessions",
            "progress": "Progress Dashboard"
        }
    }

    # Try domain-specific page names first
    if domain in page_templates:
        for keyword, page_name in page_templates[domain].items():
            if keyword in action_lower:
                return page_name

    # Fallback to natural page names
    if "login" in action_lower:
        return "Login Page"
    elif "search" in action_lower:
        return "Search Interface"
    elif "profile" in action_lower:
        return "Profile Settings"

    return "Main Interface"

def get_natural_actor_name(actor: str) -> str:
    """Convert formal actor names to natural names - EXACT SAME AS COLAB"""
    # Remove long formal descriptions
    natural_names = {
        "individuals seeking daily mental health maintenance": "a user",
        "users with mild to moderate stress/anxiety": "someone managing stress",
        "administrator": "an admin",
        "customer": "a customer",
        "patient": "a patient",
        "student": "a student",
        "teacher": "a teacher"
    }

    # Direct mapping for common cases
    for formal, natural in natural_names.items():
        if formal.lower() in actor.lower():
            return natural

    # Generic simplification
    if len(actor.split()) > 3:
        return "a user"

    return f"a {actor.lower()}"

def extract_action_from_story(story_text: str) -> str:
    """Extract action from user story text - EXACT SAME AS COLAB"""
    try:
        if 'I want to' in story_text:
            action_part = story_text.split('I want to')[1]
            if 'so that' in action_part:
                return action_part.split('so that')[0].strip()
            return action_part.strip()
        return "use the system"
    except:
        return "use the system"

def extract_benefit_from_story(story_text: str) -> str:
    """Extract benefit from user story text - EXACT SAME AS COLAB"""
    try:
        if 'so that' in story_text:
            return story_text.split('so that')[1].strip().rstrip('.')
        return "achieve their goals"
    except:
        return "achieve their goals"

# Auto-select the appropriate analyzer - MATCHES COLAB INITIALIZATION
try:
    # Try to load spaCy exactly like Colab does
    nlp = spacy.load("en_core_web_sm")
    project_analyzer = ProjectAnalyzer()
    print("✅ ProjectAnalyzer initialized with spaCy")
except OSError:
    # Fallback exactly like Colab
    print("⚠️ spaCy model 'en_core_web_sm' not available. Using SimpleProjectAnalyzer.")
    project_analyzer = SimpleProjectAnalyzer()
except Exception as e:
    print(f"⚠️ Error initializing spaCy: {e}. Using SimpleProjectAnalyzer.")
    project_analyzer = SimpleProjectAnalyzer()