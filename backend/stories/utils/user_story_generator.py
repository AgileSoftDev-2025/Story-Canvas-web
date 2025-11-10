# stories/utils/user_story_generator.py
import json
import re
import os
import replicate
from django.conf import settings
from stories.models import Project
from .nlp_analyzer import ProjectAnalyzer
from ..rag_config import REPLICATE_API_TOKEN, MODEL_ID

class UserStoryGenerator:
    def __init__(self):
        self.analyzer = ProjectAnalyzer()
        self.model_id = MODEL_ID
        
    def generate_comprehensive_user_stories(self, project_info, rag_db=None, max_iterations=3):
        """Generate user stories dengan RAG integration"""
        print(f"🧠 Generating comprehensive INVEST-compliant user stories dengan RAG...")
        
        # Analyze project dengan NLP
        project_analysis = self.analyzer.analyze_project_description(project_info)
        print(f"   Detected Domain: {project_analysis.get('domain', 'Unknown')}")
        
        # Retrieve similar patterns dari RAG
        similar_patterns = []
        if rag_db:
            project_description = self._format_project_description(project_info)
            similar_patterns = rag_db.retrieve_similar_patterns(project_description)
            print(f"   Found {len(similar_patterns)} relevant patterns dari RAG")
        
        # Generate user stories
        user_stories = self._generate_user_stories_with_fallbacks(
            project_info, 
            project_analysis, 
            similar_patterns,
            max_iterations
        )
        
        print(f"   ✅ Total user stories generated: {len(user_stories)}")
        return user_stories
    
    def _generate_user_stories_with_fallbacks(self, project_info, project_analysis, similar_patterns, max_iterations):
        """Generate user stories dengan RAG context"""
        all_stories = []
        iteration = 1
        
        while iteration <= max_iterations:
            print(f"   Iteration {iteration}: Generating stories dengan RAG patterns...")
            
            try:
                users = self._clean_roles(project_info.get('users', []))
                features = project_info.get('features', [])
                domain = project_analysis.get('domain', 'General')
                
                if not users:
                    users = project_analysis.get('potential_users', ['User'])
                
                if not features:
                    features = project_analysis.get('potential_features', ['use the system'])
                
                # Generate stories untuk setiap role dengan RAG context
                for role in users:
                    role_stories = self._generate_stories_for_role_with_rag(
                        role, features, domain, project_info, similar_patterns, iteration
                    )
                    all_stories.extend(role_stories)
                
                if all_stories:
                    break
                    
            except Exception as e:
                print(f"   ⚠️ Iteration {iteration} failed: {e}")
            
            iteration += 1
        
        # Final fallback
        if not all_stories:
            print("   ⚠️ Using comprehensive fallback stories")
            all_stories = self._generate_comprehensive_fallback_stories(
                project_info.get('users', ['User']),
                project_info.get('features', ['use the system']),
                project_analysis.get('domain', 'General')
            )
        
        # Ensure all stories have required fields
        for i, story in enumerate(all_stories):
            story['id'] = f"US{i+1:03d}"
            self._ensure_story_fields(story)
        
        return all_stories
    
    def _generate_stories_for_role_with_rag(self, role, features, domain, project_info, similar_patterns, iteration):
        """Generate stories untuk role dengan RAG context"""
        print(f"      Generating stories for {role} dengan RAG...")
        
        # Build RAG pattern context
        pattern_context = self._build_rag_pattern_context(similar_patterns)
        
        # Enhanced prompt dengan RAG patterns
        prompt = f"""
PROJECT: {project_info.get('title', 'Untitled Project')}
DESCRIPTION: {self._format_project_description(project_info)}

ROLE: {role}
DOMAIN: {domain}

AVAILABLE FEATURES: {', '.join(features[:5])}

RELEVANT PATTERNS FROM SIMILAR PROJECTS:
{pattern_context}

INSTRUCTIONS: Generate exactly 2 user stories for {role} that align with the patterns above.
Use this EXACT JSON format:

{{
  "user_stories": [
    {{
      "text": "As a {role}, I want to [action] so that [benefit]",
      "role": "{role}",
      "feature": "[feature category]",
      "acceptance_criteria": ["Criterion 1", "Criterion 2", "Criterion 3"]
    }}
  ]
}}

CRITICAL RULES:
1. Return ONLY valid JSON, no other text
2. Use the exact role name: "{role}"
3. Make stories specific to this project and domain
4. Ensure acceptance criteria are testable
5. Incorporate relevant patterns from similar projects

Generate 2 user stories for {role}:
"""
        try:
            raw_output = self._call_llm_api(prompt, temperature=0.3, max_tokens=1200)
            print(f"      Received LLM response for {role}")

            result = self._parse_json_output_userstories(raw_output)
            user_stories = result.get("user_stories", [])

            if user_stories:
                print(f"      ✅ Generated {len(user_stories)} stories for {role} dengan RAG")
                for story in user_stories:
                    story['role'] = role
                    story['iteration'] = iteration
                    parsed_parts = self._parse_user_story_text(story.get('text', ''))
                    story['action'] = parsed_parts.get('action', '')
                    story['benefit'] = parsed_parts.get('benefit', '')
                return user_stories
            else:
                print(f"      ⚠️ No stories parsed for {role}, using fallback")
                return self._generate_fallback_stories_for_user(role, features, domain, iteration)

        except Exception as e:
            print(f"      ❌ Error for {role}: {str(e)[:100]}...")
            return self._generate_fallback_stories_for_user(role, features, domain, iteration)
    
    def _build_rag_pattern_context(self, similar_patterns):
        """Build context dari RAG patterns"""
        pattern_context = ""
        for i, pattern in enumerate(similar_patterns[:2]):
            if pattern and 'metadata' in pattern:
                metadata = pattern['metadata']
                pattern_context += f"Pattern {i+1}: {metadata.get('project_type', 'Unknown Pattern')}\n"
                pattern_context += f"Description: {metadata.get('description', 'No description')}\n"
                pattern_context += f"Target Users: {metadata.get('target_users', 'Various Users')}\n"
                pattern_context += f"Key Features: {metadata.get('key_features', 'Standard Features')}\n"
                pattern_context += f"Story Patterns: {metadata.get('user_story_patterns', 'Standard patterns')}\n\n"
        return pattern_context
    
    # ... (methods lainnya sama dengan sebelumnya, tetap dipertahankan)