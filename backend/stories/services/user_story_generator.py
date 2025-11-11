import os
import json
import re
import replicate
from typing import Dict, List
from django.conf import settings
from stories.models import Project, UserStory
from stories.utils.project_analyzer import analyze_project_description

class UserStoryGenerator:
    def __init__(self):
        self.model_id = "ibm-granite/granite-3.3-8b-instruct"
        
    def call_api_model(self, prompt: str, max_tokens: int = 1024,
                      temperature: float = 0.0, top_p: float = 1.0) -> str:
        """Call Replicate API model - SAME AS COLAB"""
        try:
            input_data = {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p
            }

            output = replicate.run(self.model_id, input=input_data)

            if isinstance(output, list):
                return "".join([str(item) for item in output])
            elif isinstance(output, dict):
                return json.dumps(output)
            else:
                return str(output)
        except Exception as e:
            print(f"Error calling API model: {e}")
            return '{"user_stories": []}'

    def parse_json_output_userstories(self, output_text: str) -> Dict:
        """MAXIMUM AGGRESSIVE JSON parsing - handles virtually any LLM output - SAME AS COLAB"""
        
        def ultra_clean_json_text(text: str) -> str:
            """Ultra-aggressive text cleaning for JSON parsing"""
            # Remove code blocks
            text = re.sub(r'```[a-z]*\s*', '', text, flags=re.IGNORECASE)
            text = re.sub(r'\s*```\s*', '', text, flags=re.IGNORECASE)

            # Fix ALL quote issues
            text = re.sub(r'[“”]', '"', text)  # Smart quotes to straight quotes
            text = re.sub(r'[‘’]', "'", text)   # Smart single quotes

            # Handle escaped and unescaped quotes in a balanced way
            def balance_quotes(match):
                content = match.group(1)
                # Count quotes to determine if we need to escape
                quote_count = content.count('"')
                if quote_count % 2 != 0:  # Odd number of quotes, need balancing
                    # Add escape to the last unescaped quote
                    content = re.sub(r'(?<!\\)"(?=[^"]*$)', r'\"', content)
                return f'"{content}"'

            # Apply quote balancing to all string values
            text = re.sub(r'"([^"]*)"', balance_quotes, text)

            # Remove control characters but keep normal whitespace
            text = re.sub(r'[\x00-\x1F\x7F]', ' ', text)

            # Fix common JSON syntax errors
            text = re.sub(r',\s*([}\]])', r'\1', text)  # Trailing commas
            text = re.sub(r',\s*,', ',', text)  # Double commas
            text = re.sub(r',\s*$', '', text)  # Trailing comma at end

            # Fix unquoted keys
            text = re.sub(r'([{,]\s*)(\w+)(\s*:)', r'\1"\2"\3', text)

            # Fix missing commas between objects
            text = re.sub(r'}\s*{', '},{', text)

            # Fix array issues
            text = re.sub(r'\[\s*,', '[', text)  # Leading comma in array
            text = re.sub(r',\s*]', ']', text)   # Trailing comma in array

            # Normalize whitespace but preserve structure
            text = re.sub(r'\s+', ' ', text)
            text = re.sub(r'\s*([\{\}\[\]",:])\s*', r'\1', text)

            # Add spaces back for readability in values
            text = re.sub(r'":"', '": "', text)
            text = re.sub(r'","', '", "', text)

            return text.strip()

        def extract_json_candidates(text: str) -> List[str]:
            """Extract multiple JSON candidates using various patterns"""
            candidates = []

            patterns = [
                r'\{[^{}]*"user_stories"[^{}]*\[.*?\]\s*\}',  # Object with user_stories array
                r'\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]',      # Array of objects
                r'\{.*"user_stories".*\}',                    # Any object with user_stories
                r'\[\s*\{[^\[\]]*?\}\s*\]',                   # Simple array of objects
            ]

            for pattern in patterns:
                matches = re.findall(pattern, text, re.DOTALL)
                candidates.extend(matches)

            # Also try to find the largest JSON-like structure
            brace_count = 0
            start_idx = -1
            json_blocks = []

            for i, char in enumerate(text):
                if char == '{':
                    if brace_count == 0:
                        start_idx = i
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0 and start_idx != -1:
                        json_blocks.append(text[start_idx:i+1])
                        start_idx = -1

            candidates.extend(json_blocks)

            # Remove duplicates and sort by length (longer is usually better)
            candidates = list(set(candidates))
            candidates.sort(key=len, reverse=True)

            return candidates[:5]  # Return top 5 candidates

        def is_valid_story_parts(role: str, action: str, benefit: str) -> bool:
            """Validate that story parts are reasonable"""
            return (
                len(role) >= 2 and
                len(action) >= 5 and
                len(benefit) >= 5 and
                not role.lower() in ['user', 'actor', 'person'] and
                not action.lower() in ['use the system', 'do something'] and
                not benefit.lower() in ['i can benefit', 'it works', 'achieve goal']
            )

        def create_story_from_parts(role: str, action: str, benefit: str) -> Dict:
            """Create a complete story object from parts"""
            def extract_feature_from_text(action_text: str) -> str:
                """Extract feature category from action text"""
                if not action_text:
                    return "General"

                # Common feature categories based on keywords
                action_lower = action_text.lower()

                if any(word in action_lower for word in ['train', 'teach', 'educate', 'learn']):
                    return "Training"
                elif any(word in action_lower for word in ['access', 'view', 'see', 'read', 'browse']):
                    return "Access Control"
                elif any(word in action_lower for word in ['manage', 'organize', 'arrange', 'sort']):
                    return "Management"
                elif any(word in action_lower for word in ['create', 'add', 'make', 'build']):
                    return "Creation"
                elif any(word in action_lower for word in ['edit', 'modify', 'update', 'change']):
                    return "Editing"
                elif any(word in action_lower for word in ['delete', 'remove', 'archive']):
                    return "Deletion"
                elif any(word in action_lower for word in ['search', 'find', 'locate', 'discover']):
                    return "Search"
                elif any(word in action_lower for word in ['secure', 'protect', 'encrypt', 'authenticate']):
                    return "Security"
                elif any(word in action_lower for word in ['analyze', 'report', 'statistics', 'metrics']):
                    return "Analytics"
                elif any(word in action_lower for word in ['export', 'import', 'download', 'upload']):
                    return "Data Transfer"
                else:
                    # Extract first meaningful words
                    words = action_text.split()[:2]
                    return ' '.join(words).title() if words else "General"

            return {
                "text": f"As a {role}, I want to {action} so that {benefit}",
                "role": role,
                "feature": extract_feature_from_text(action),
                "acceptance_criteria": [
                    f"The system allows {role} to {action}",
                    f"Proper feedback is provided during the process",
                    f"The benefit '{benefit}' is achieved"
                ],
                "priority": "Medium",
                "id": f"US{hash(role + action + benefit) % 10000:04d}"  # Simple ID
            }

        def extract_stories_from_any_text(text: str) -> List[Dict]:
            """Extract stories from ANY text format using multiple approaches"""
            stories = []

            # Approach 1: Look for complete user story patterns
            story_patterns = [
                r'"As a ([^"]+?), I (?:want to|need to|should be able to) ([^"]+?) so that ([^"]+?)"',
                r'As a ([^",]+?), I (?:want to|need to|should be able to) ([^",]+?) so that ([^",]+?)(?:"|,|$|\n)',
                r'Text: "As a ([^"]+?), I (?:want to|need to|should be able to) ([^"]+?) so that ([^"]+?)"',
                r'As a ([^,]+?), I (?:want to|need to|should be able to) ([^.]+?) so that ([^.]+?)\.',
            ]

            for pattern in story_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)
                for role, action, benefit in matches:
                    if is_valid_story_parts(role, action, benefit):
                        story = create_story_from_parts(role.strip(), action.strip(), benefit.strip())
                        if story not in stories:
                            stories.append(story)

            # Approach 2: Look for story-like structures without exact pattern
            lines = text.split('\n')
            current_story = {}

            for line in lines:
                line = line.strip()

                # Detect story start
                if re.search(r'As a [^,]+, I (?:want to|need to|should be able to)', line, re.IGNORECASE):
                    if current_story and 'text' in current_story:
                        stories.append(current_story)
                        current_story = {}

                    # Extract from this line
                    story_match = re.search(r'As a ([^,]+), I (?:want to|need to|should be able to) ([^,]+?)(?: so that | in order to | to )([^,]+?)(?:"|,|$|\n)', line, re.IGNORECASE)
                    if story_match:
                        role, action, benefit = story_match.groups()
                        if is_valid_story_parts(role, action, benefit):
                            current_story = create_story_from_parts(role.strip(), action.strip(), benefit.strip())

                # Look for role/feature indicators in subsequent lines
                elif current_story and not current_story.get('feature'):
                    feature_match = re.search(r'"feature"\s*:\s*"([^"]+)"', line)
                    if feature_match:
                        current_story['feature'] = feature_match.group(1).strip()

            if current_story and 'text' in current_story:
                stories.append(current_story)

            return stories

        # ========== MAIN PARSING LOGIC ==========

        if not output_text or not output_text.strip():
            return {"user_stories": []}

        text = output_text.strip()
        print(f"      Raw LLM output preview: {text[:200]}...")

        # STRATEGY 0: Ultra-aggressive cleaning first
        text = ultra_clean_json_text(text)

        # STRATEGY 1: Try direct parsing with multiple encoding attempts
        for encoding in ['utf-8', 'latin-1', 'ascii', 'ignore']:
            try:
                if encoding == 'ignore':
                    text_clean = text.encode('utf-8', 'ignore').decode('utf-8')
                else:
                    text_clean = text.encode(encoding).decode('utf-8')

                result = json.loads(text_clean)
                if result.get('user_stories'):
                    print(f"      ✅ Direct parse successful with encoding {encoding}")
                    return result
            except (json.JSONDecodeError, UnicodeError) as e:
                continue

        # STRATEGY 2: Extract JSON using multiple pattern matchers
        json_candidates = extract_json_candidates(text)
        for candidate in json_candidates:
            try:
                result = json.loads(candidate)
                if isinstance(result, dict) and 'user_stories' in result:
                    print(f"      ✅ JSON candidate extraction successful")
                    return result
                elif isinstance(result, list):
                    print(f"      ✅ JSON array extraction successful")
                    return {"user_stories": result}
            except json.JSONDecodeError:
                continue

        # STRATEGY 3: Manual object construction from ANY text
        stories = extract_stories_from_any_text(text)
        if stories:
            print(f"      ✅ Text extraction found {len(stories)} stories")
            return {"user_stories": stories}

        # STRATEGY 4: Final fallback - regex pattern matching
        stories = []
        pattern = r'(?:text|story|userstory)[^"]*"As a ([^",]+?)(?:,| who| that)? I (?:want to|need to|should be able to|can) ([^",]+??)(?: so that | in order to | to | that )([^",]+?)"'
        matches = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)
        for role, action, benefit in matches:
            if len(role) > 2 and len(action) > 3 and len(benefit) > 3:
                story = create_story_from_parts(
                    role.strip(),
                    action.strip(),
                    benefit.strip()
                )
                stories.append(story)

        if stories:
            print(f"      ✅ Regex extraction found {len(stories)} stories")
            return {"user_stories": stories}

        print(f"      ❌ All parsing strategies failed")
        return {"user_stories": []}

    def generate_comprehensive_user_stories(self, project_info: Dict, project_analysis: Dict, similar_patterns: List[Dict]) -> List[Dict]:
        """Generate comprehensive INVEST-compliant user stories - SAME AS COLAB"""
        print("🧠 Generating comprehensive INVEST-compliant user stories...")

        # Clean role names
        users = [role.split('(')[0].strip() if '(' in role else role.strip()
                 for role in project_info.get('users', [])]
        users = users or project_analysis.get('potential_users', []) or ['Creator']

        # Use simplified role names for better LLM processing
        simplified_roles = []
        role_mapping = {}
        for role in users:
            simple_role = re.sub(r'\([^)]*\)', '', role).strip()  # Remove parentheses content
            simple_role = re.sub(r'\s+', ' ', simple_role)  # Normalize spaces
            if len(simple_role) > 30:  # Truncate very long role names
                simple_role = simple_role[:27] + "..."
            simplified_roles.append(simple_role)
            role_mapping[simple_role] = role  # Map back to original

        features = project_info.get('features', []) or project_analysis.get('potential_features', []) or ['use the system']
        domain = project_analysis.get('domain', 'General')

        # Build pattern context
        pattern_context = ""
        for i, pattern in enumerate(similar_patterns[:2]):
            if pattern and 'metadata' in pattern:
                metadata = pattern['metadata']
                pattern_context += f"Pattern {i+1}: {metadata.get('project_type', 'Unknown Pattern')}\n"
                pattern_context += f"Users: {metadata.get('target_users', 'Various Users')}\n"
                pattern_context += f"Features: {metadata.get('key_features', 'Standard Features')}\n\n"

        formatted_info = self.format_project_description(project_info)
        all_stories = []

        for simple_role in simplified_roles:
            original_role = role_mapping.get(simple_role, simple_role)
            print(f"   Generating stories for {simple_role}...")

            # SIMPLIFIED AND CLEANER PROMPT
            prompt = f"""
PROJECT: {project_info.get('title', 'Untitled Project')}
DESCRIPTION: {formatted_info}

ROLE: {simple_role}
DOMAIN: {domain}

AVAILABLE FEATURES: {', '.join(features[:5])}

RELATED PATTERNS:
{pattern_context}

INSTRUCTIONS: Generate exactly 2 user stories for {simple_role} in this EXACT JSON format:

{{
  "user_stories": [
    {{
      "text": "As a {simple_role}, I want to [action] so that [benefit]",
      "role": "{simple_role}",
      "feature": "[feature category]",
      "acceptance_criteria": ["Criterion 1", "Criterion 2", "Criterion 3"]
    }}
  ]
}}

CRITICAL RULES:
1. Return ONLY valid JSON, no other text
2. Use the exact role name: "{simple_role}"
3. Make stories specific to this project
4. Ensure acceptance criteria are testable
5. Focus on the most important features

Generate 2 user stories for {simple_role}:
"""

            try:
                raw_output = self.call_api_model(prompt, temperature=0.3, max_tokens=1200)
                print(f"      Received LLM response for {simple_role}")

                # Parse with enhanced function
                result = self.parse_json_output_userstories(raw_output)
                user_stories = result.get("user_stories", [])

                if user_stories:
                    print(f"      ✅ Generated {len(user_stories)} stories for {simple_role}")
                    # Ensure proper role assignment
                    for story in user_stories:
                        story['role'] = original_role  # Use original role name
                    all_stories.extend(user_stories)
                else:
                    print(f"      ⚠️ No stories parsed for {simple_role}, using fallback")
                    fallback_stories = self.generate_fallback_stories_for_user(original_role, features, domain)
                    all_stories.extend(fallback_stories)

            except Exception as e:
                print(f"      ❌ Error for {simple_role}: {str(e)[:100]}...")
                fallback_stories = self.generate_fallback_stories_for_user(original_role, features, domain)
                all_stories.extend(fallback_stories)

        # Final fallback if everything fails
        if not all_stories:
            print("   ⚠️ No stories generated, using comprehensive fallback")
            all_stories = self.generate_comprehensive_fallback_stories(users, features, domain)

        # Ensure all stories have required fields and proper IDs
        for i, story in enumerate(all_stories):
            story['id'] = f"US{i+1:03d}"

            # Ensure all required fields exist with proper values
            if 'text' not in story:
                role = story.get('role', 'User')
                story['text'] = f"As a {role}, I want to use the system so that I can benefit from it"
            if 'role' not in story:
                # Extract role from text if possible
                role_match = re.search(r'As a ([^,]+),', story.get('text', ''))
                story['role'] = role_match.group(1) if role_match else 'User'
            if 'feature' not in story:
                story['feature'] = 'General'
            if 'acceptance_criteria' not in story:
                story['acceptance_criteria'] = [
                    "The system should work correctly",
                    "User can complete the intended task",
                    "Proper feedback is provided to the user"
                ]
            if 'priority' not in story:
                story['priority'] = 'Medium'

        print(f"   ✅ Total user stories generated: {len(all_stories)}")

        # Debug: Show role distribution
        role_counts = {}
        for story in all_stories:
            role = story.get('role', 'Unknown')
            role_counts[role] = role_counts.get(role, 0) + 1

        print(f"   📊 Role distribution: {role_counts}")
        return all_stories

    def generate_fallback_stories_for_user(self, user: str, features: List[str], domain: str) -> List[Dict]:
        """Generate fallback stories when LLM fails - SAME AS COLAB"""
        stories = []

        # Agriculture-specific benefits
        agriculture_benefits = [
            "I can maximize crop yield and quality",
            "I can optimize water and fertilizer usage",
            "I can make data-driven farming decisions",
            "I can respond quickly to crop health issues",
            "I can improve farm profitability",
            "I can monitor field conditions in real-time",
            "I can predict and prevent crop diseases",
            "I can automate irrigation schedules"
        ]

        # Domain-specific benefits
        domain_benefits = {
            "Agriculture": agriculture_benefits,
            "Healthcare": [
                "I can provide better patient care", "I can respond to emergencies faster",
                "I can monitor health conditions effectively", "I can make informed medical decisions"
            ],
            "E-commerce": [
                "I can find products more easily", "I can complete purchases faster",
                "I can manage my account securely", "I can get better recommendations"
            ],
            "General": [
                "I can achieve my goals more efficiently", "I can save time and effort",
                "I can improve my productivity", "I can make better decisions"
            ]
        }

        benefits = domain_benefits.get(domain, domain_benefits["General"])

        # Agriculture-focused templates
        user_story_templates = [
            "As a {user}, I want to {feature} so that {benefit}.",
            "As a {user}, I need to {feature} to achieve {benefit}.",
            "As a {user}, I should be able to {feature} for {benefit}."
        ]

        # Use provided features or create agriculture-specific ones
        if not features:
            features = [
                "monitor real-time soil conditions",
                "receive crop health alerts",
                "view irrigation recommendations",
                "access yield forecasts",
                "analyze satellite imagery"
            ]

        for i, feature in enumerate(features[:4]):  # Max 4 stories per user
            template_idx = i % len(user_story_templates)
            benefit_idx = i % len(benefits)

            story_text = user_story_templates[template_idx].format(
                user=user, feature=feature, benefit=benefits[benefit_idx]
            )

            stories.append({
                "id": f"FB_{user}_{i+1:03d}",
                "text": story_text,
                "role": user,
                "feature": feature[:50],  # Truncate if too long
                "acceptance_criteria": [
                    f"The system allows {user} to {feature} successfully",
                    f"Proper feedback is provided when using this feature",
                    f"Data is accurate and updated in real-time"
                ],
                "priority": "High" if i == 0 else "Medium"
            })

        return stories

    def generate_comprehensive_fallback_stories(self, users: List[str], features: List[str], domain: str) -> List[Dict]:
        """Comprehensive fallback when all else fails"""
        all_stories = []
        for user in users:
            user_stories = self.generate_fallback_stories_for_user(user, features, domain)
            all_stories.extend(user_stories)

        # Ensure unique IDs
        for i, story in enumerate(all_stories):
            story['id'] = f"CF_{i+1:03d}"

        return all_stories

    def format_project_description(self, project_info: Dict) -> str:
        """Format project description for LLM prompt"""
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

    def generate_user_stories_for_project(self, project):
        """Main method to generate user stories for a project"""
        try:
            # Convert project to project_info format
            project_info = {
                'title': project.title,
                'objective': project.objective,
                'users': project.users_data or [],
                'features': project.features_data or [],
                'scope': project.scope,
                'flow': project.flow,
                'additional_info': project.additional_info
            }

            # Analyze project
            project_description = self.format_project_description(project_info)
            project_analysis = analyze_project_description(project_description)

            # For now, use empty similar patterns (you can integrate RAG later)
            similar_patterns = []

            # Generate stories
            stories_data = self.generate_comprehensive_user_stories(
                project_info, project_analysis, similar_patterns
            )

            # Create UserStory objects
            created_stories = []
            for story_data in stories_data:
                user_story = UserStory.objects.create(
                    project=project,
                    story_text=story_data.get('text', ''),
                    role=story_data.get('role', 'User'),
                    action=self.extract_action_from_story(story_data.get('text', '')),
                    benefit=self.extract_benefit_from_story(story_data.get('text', '')),
                    feature=story_data.get('feature', 'General'),
                    acceptance_criteria=story_data.get('acceptance_criteria', []),
                    priority=story_data.get('priority', 'medium').lower(),
                    story_points=0,
                    generated_by_llm=True,
                    iteration=1
                )
                created_stories.append(user_story)

            return created_stories

        except Exception as e:
            print(f"Error generating user stories: {e}")
            # Fallback: create basic stories
            return self.create_fallback_stories(project)

    def extract_action_from_story(self, story_text):
        """Extract action from user story text"""
        try:
            if 'I want to' in story_text:
                action_part = story_text.split('I want to')[1]
                if 'so that' in action_part:
                    return action_part.split('so that')[0].strip()
                return action_part.strip()
            return "use the system"
        except:
            return "use the system"

    def extract_benefit_from_story(self, story_text):
        """Extract benefit from user story text"""
        try:
            if 'so that' in story_text:
                return story_text.split('so that')[1].strip().rstrip('.')
            return "achieve their goals"
        except:
            return "achieve their goals"

    def create_fallback_stories(self, project):
        """Create fallback user stories"""
        fallback_stories = []
        users = project.users_data or ['User', 'Admin']
        features = project.features_data or ['use the system', 'manage content']

        for i, user in enumerate(users[:2]):
            for j, feature in enumerate(features[:2]):
                story_text = f"As a {user}, I want to {feature} so that I can achieve my goals"

                user_story = UserStory.objects.create(
                    project=project,
                    story_text=story_text,
                    role=user,
                    action=feature,
                    benefit="achieve my goals",
                    feature=feature,
                    acceptance_criteria=[
                        f"The system allows {user} to {feature}",
                        "Proper feedback is provided",
                        "The process completes successfully"
                    ],
                    priority="medium",
                    story_points=0,
                    generated_by_llm=False,
                    iteration=1
                )
                fallback_stories.append(user_story)

        return fallback_stories