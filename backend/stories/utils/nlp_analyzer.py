# stories/utils/nlp_analyzer.py
import re
import spacy
from langdetect import detect

class ProjectAnalyzer:
    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Fallback jika spaCy model tidak tersedia
            self.nlp = None
            print("⚠️ spaCy model 'en_core_web_sm' not available. Using fallback NLP analysis.")
    
    def analyze_project_description(self, project_info):
        """Analyze project description dengan NLP - mirrors original logic"""
        description = self._format_project_description(project_info)
        
        entities = []
        nouns = []
        verbs = []
        
        if self.nlp:
            doc = self.nlp(description)
            entities = [ent.text for ent in doc.ents]
            nouns = [token.text for token in doc if token.pos_ == "NOUN"]
            verbs = [token.lemma_ for token in doc if token.pos_ == "VERB"]
        
        domain = self._detect_domain(description)
        potential_users = self._extract_potential_users(description)
        potential_features = self._extract_potential_features(description)
        
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
    
    def _detect_domain(self, description):
        """Detect project domain - mirrors original logic"""
        description_lower = description.lower()
        domain_keywords = {
            "E-commerce": ["shop", "buy", "product", "cart", "order", "payment", "ecommerce", "shopping"],
            "Healthcare": ["patient", "doctor", "medical", "health", "appointment", "hospital", "monitoring", "clinic"],
            "Education": ["student", "teacher", "learn", "course", "assignment", "school", "education", "learning"],
            "Finance": ["bank", "money", "account", "transaction", "payment", "financial", "investment", "loan"],
            "Social Media": ["social", "profile", "post", "share", "connect", "message", "network", "community"],
            "Agriculture": ["crop", "farm", "soil", "irrigation", "yield", "harvest", "agriculture", "farming"],
            "IoT": ["iot", "sensor", "device", "smart", "connected", "internet of things"],
            "Gaming": ["game", "player", "level", "score", "multiplayer", "gaming", "entertainment"]
        }
        
        for domain, keywords in domain_keywords.items():
            if any(keyword in description_lower for keyword in keywords):
                return domain
        return "General"
    
    def _extract_potential_users(self, description):
        """Extract potential users - mirrors original logic"""
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
    
    def _extract_potential_features(self, description):
        """Extract potential features - mirrors original logic"""
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
        
        flow_match = re.search(r"Flow:([^\.\n]+)", description, re.IGNORECASE)
        if flow_match:
            flow_parts = re.split(r"[→\-/>]", flow_match.group(1))
            features.extend([part.strip() for part in flow_parts if len(part.strip()) > 3])
        
        features = list(set(features))
        return features[:10] if features else ["use the system", "manage content"]
    
    def _format_project_description(self, project_info):
        """Format project description untuk analysis"""
        description = f"""
        Title: {project_info.get('title', 'Untitled Project')}
        Objective: {project_info.get('objective', 'Not specified')}
        Users: {', '.join([str(user) for user in project_info.get('users', [])])}
        Features: {', '.join([str(feature) for feature in project_info.get('features', [])])}
        Scope: {project_info.get('scope', 'Not specified')}
        Flow: {project_info.get('flow', 'Not specified')}
        Additional Information: {project_info.get('additional_info', 'None')}
        """
        return description

    def analyze_user_story(self, story_text):
        """Analyze individual user story untuk extract insights"""
        if not story_text:
            return {}
        
        if self.nlp:
            doc = self.nlp(story_text)
            entities = [ent.text for ent in doc.ents]
            verbs = [token.lemma_ for token in doc if token.pos_ == "VERB"]
            nouns = [token.text for token in doc if token.pos_ == "NOUN"]
        else:
            entities = []
            verbs = []
            nouns = []
        
        # Extract action dan benefit dari user story
        action_match = re.search(r'I (?:want to|need to|should be able to) ([^,\.]+)', story_text, re.IGNORECASE)
        benefit_match = re.search(r'so that ([^,\.]+)', story_text, re.IGNORECASE)
        
        return {
            "action": action_match.group(1).strip() if action_match else "",
            "benefit": benefit_match.group(1).strip() if benefit_match else "",
            "entities": entities,
            "key_verbs": verbs,
            "key_nouns": nouns,
            "complexity": self._assess_complexity(story_text)
        }
    
    def _assess_complexity(self, text):
        """Assess complexity dari user story text"""
        word_count = len(text.split())
        sentence_count = len(re.split(r'[.!?]+', text))
        
        if word_count > 30 or sentence_count > 3:
            return "High"
        elif word_count > 15:
            return "Medium"
        else:
            return "Low"

# Fallback analyzer untuk case spaCy tidak tersedia
class SimpleProjectAnalyzer:
    """Simplified analyzer tanpa spaCy dependency"""
    
    def analyze_project_description(self, project_info):
        description = self._format_project_description(project_info)
        
        return {
            "domain": self._detect_domain(description),
            "entities": [],
            "key_nouns": [],
            "key_verbs": [],
            "potential_users": self._extract_potential_users(description),
            "potential_features": self._extract_potential_features(description),
            "language": "en"
        }
    
    def _detect_domain(self, description):
        description_lower = description.lower()
        domain_keywords = {
            "E-commerce": ["shop", "buy", "product", "cart", "order", "payment"],
            "Healthcare": ["patient", "doctor", "medical", "health", "appointment"],
            "Education": ["student", "teacher", "learn", "course", "assignment"],
            "Finance": ["bank", "money", "account", "transaction", "payment"],
        }
        
        for domain, keywords in domain_keywords.items():
            if any(keyword in description_lower for keyword in keywords):
                return domain
        return "General"
    
    def _extract_potential_users(self, description):
        users = []
        matches = re.findall(r'As a ([^,]+),', description, re.IGNORECASE)
        for match in matches:
            users.extend([user.strip() for user in match.split(',')])
        return users if users else ["User", "Admin"]
    
    def _extract_potential_features(self, description):
        features = []
        matches = re.findall(r'want to ([^,\.]+)', description, re.IGNORECASE)
        for match in matches:
            features.extend([feature.strip() for feature in match.split(',')])
        return features[:5] if features else ["use the system"]
    
    def _format_project_description(self, project_info):
        return f"{project_info.get('title', '')} {project_info.get('objective', '')}"

# Auto-select the appropriate analyzer
try:
    nlp = spacy.load("en_core_web_sm")
    project_analyzer = ProjectAnalyzer()
except (OSError, ImportError):
    print("⚠️ Using SimpleProjectAnalyzer (spaCy not available)")
    project_analyzer = SimpleProjectAnalyzer()