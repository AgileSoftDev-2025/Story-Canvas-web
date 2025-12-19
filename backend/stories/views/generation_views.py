from datetime import datetime
import os
import json
import re
from django.utils import timezone
from django.http import JsonResponse
from django.views import View
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from stories.serializers.user_story_scenario_serializers import ScenarioSerializer, UserStorySerializer
from stories.serializers.wireframe_serializers import WireframeSerializer

# Import all models, serializers, and generators from your system
from ..models import Project, UserStory, Wireframe, Scenario, GenerationSession, ProjectHistory
from ..rag_vector_db import ProjectRAGVectorDB
from stories.utils.plantuml_generator import generate_wireframe_with_diagram

# Import all utility functions from your other files
from ..utils.project_analyzer import (
    analyze_project_description, 
    extract_action_from_story, 
    extract_benefit_from_story
)
from ..utils.user_story_generator import UserStoryGenerator
from ..utils.scenario_generator import ScenarioGenerator
from ..utils.wireframe_generator import WireframeGenerator

# FIXED: Import ONLY from salt_generator to avoid conflicts
from ..utils.salt_generator import (
    convert_html_to_creole,
    convert_html_to_creole_manual,
    generate_salt_wireframe,
    generate_all_salt_wireframes,
    generate_complete_documentation_pipeline,
    render_plantuml_png,
    plantuml_url,
    save_all_artifacts
)

# ============================================================================
# AI EDITING MIXIN (Full, Unabridged)
# ============================================================================

class AIEditingMixin:
    """Mixin for AI editing functionality"""
    
    def ai_assisted_edit_user_stories(self, user_stories, instructions, project_info, rag_db):
        """AI-assisted editing for user stories"""
        project_context = self._format_project_description(project_info)
        
        similar_patterns = rag_db.retrieve_similar_patterns(project_context, k=2)
        pattern_context = ""
        for i, pattern in enumerate(similar_patterns):
            if pattern and 'metadata' in pattern:
                metadata = pattern['metadata']
                # Extract pattern info to variables first
                project_type = metadata.get('project_type', 'Unknown')
                story_patterns = metadata.get('user_story_patterns', 'Standard patterns')
                pattern_context += f"Pattern {i+1}: {project_type}\n"
                pattern_context += f"User Story Pattern: {story_patterns}\n\n"
        
        # Format user stories as JSON string first
        user_stories_json = json.dumps(user_stories, indent=2, ensure_ascii=False)
        
        # Now use the pre-formatted variables in the f-string
        prompt = f"""
    PROJECT CONTEXT:
    {project_context}

    EXISTING USER STORIES:
    {user_stories_json}

    RELATED PATTERNS:
    {pattern_context}

    USER EDITING REQUEST: {instructions}

    TASK: Revise and improve the user stories based on the user's request while maintaining:
    1. Clear role-action-benefit structure
    2. Proper acceptance criteria
    3. Appropriate prioritization
    4. Agriculture/iot focus where relevant

    CRITICAL REQUIREMENTS:
    - Return EXACTLY the same number of stories
    - Maintain the same story IDs
    - Keep the same basic structure
    - Ensure each story follows: "As a [role], I want to [action] so that [benefit]"
    - Make acceptance criteria specific and testable

    Return ONLY a JSON array with the improved user stories.
    """
        
        try:
            # Instantiate the generator to call its methods
            generator = UserStoryGenerator()
            raw_output = generator.call_api_model(prompt, temperature=0.3, max_tokens=2500)
            improved_stories = generator.parse_json_output_userstories(raw_output)
            
            if isinstance(improved_stories, dict) and 'user_stories' in improved_stories:
                improved_stories = improved_stories['user_stories']
            elif not isinstance(improved_stories, list):
                improved_stories = []
            
            # Ensure we maintain structure
            if improved_stories and len(improved_stories) == len(user_stories):
                for i, story in enumerate(improved_stories):
                    if i < len(user_stories):
                        story['id'] = user_stories[i].get('id', f'US{i+1:03d}')
                    
                    # Ensure required fields
                    if 'text' not in story:
                        story['text'] = user_stories[i].get('text', '')
                    if 'role' not in story:
                        story['role'] = user_stories[i].get('role', 'User')
                    if 'feature' not in story:
                        story['feature'] = user_stories[i].get('feature', 'General')
                    if 'acceptance_criteria' not in story:
                        story['acceptance_criteria'] = user_stories[i].get('acceptance_criteria', [])
                    if 'priority' not in story:
                        story['priority'] = user_stories[i].get('priority', 'Medium')
                
                return improved_stories
            
            # If AI fails, return original stories
            return user_stories
            
        except Exception as e:
            print(f"AI editing failed: {e}")
            return user_stories
    
    def ai_assisted_edit_html(self, html_content, page_name, instructions, project_info, rag_db):
        """AI-assisted HTML editing"""
        ui_patterns = rag_db.retrieve_ui_patterns(page_name, k=2)
        pattern_context = ""
        for i, pattern in enumerate(ui_patterns):
            metadata = pattern['metadata']
            pattern_context += f"""
UI PATTERN {i+1}: {metadata['page_type']}
- Layout: {metadata['layout']}
- Required Elements: {', '.join(metadata['required_elements'])}
- Best Practices: {metadata['best_practices']}
"""
        
        # --- FULL PROMPT ---
        prompt = f"""
PROJECT: {project_info.get('title', 'Untitled Project')}
PAGE: {page_name}

CURRENT HTML:
{html_content}

RELEVANT UI PATTERNS:
{pattern_context}

USER REQUEST: {instructions}

TASK: Improve the HTML based on the user's request while maintaining:
1. Pure HTML5 compliance (no external CSS/JS)
2. Semantic HTML structure
3. Accessibility best practices
4. Mobile responsiveness considerations
5. Clean, maintainable code

SPECIFIC REQUIREMENTS:
- Return ONLY the improved HTML code
- No explanations, no markdown, no code blocks
- Maintain all existing functionality
- Ensure proper form element structure
- Use appropriate HTML5 semantic elements
- Include necessary accessibility attributes
- Keep it as a focused, single-purpose page

IMPORTANT: The output must be valid, complete HTML that can be rendered directly.
"""
        
        try:
            # Instantiate the generator to call its methods
            generator = WireframeGenerator()
            improved_html = generator._call_llm_api(prompt, temperature=0.2, max_tokens=4000)
            improved_html = generator._extract_html_from_response(improved_html)
            return improved_html
            
        except Exception as e:
            print(f"AI HTML editing failed: {e}")
            return html_content
    
    def ai_assisted_edit_scenarios(self, scenarios, story_name, role, instructions, project_info):
        """AI-assisted scenario editing"""
        project_context = self._format_project_description(project_info) 
        separator = "\n---\n"
        prompt = f"""
            PROJECT CONTEXT:
            {project_context}

            USER STORY: {story_name}
            ROLE: {role}

            EXISTING SCENARIOS:
            {separator.join(scenarios)}

            USER REQUEST: {instructions}

            TASK: Improve these Gherkin scenarios based on the user's request while ensuring:
            1. Proper Gherkin syntax (Scenario, Given, When, Then, And)
            2. Realistic and natural language
            3. Comprehensive test coverage
            4. Clear preconditions, actions, and outcomes
            5. Appropriate scenario types (Happy Path, Alternate Path, Exception Path, Boundary Case)

            CRITICAL REQUIREMENTS:
            - Maintain the same number of scenarios
            - Keep scenario types balanced
            - Ensure each scenario has at least one Given, When, and Then
            - Use proper indentation and formatting
            - Make steps specific and testable

            Return ONLY the improved scenarios in proper Gherkin format.
            """
                
        try:
                    # Instantiate the generator to call its methods
                    generator = ScenarioGenerator()
                    raw_output = generator._call_llm_api(prompt, temperature=0.4, max_tokens=3000)
                    improved_scenarios = generator.parse_llm_scenario_output(raw_output)
                    # Return the same number of scenarios as was input
                    return improved_scenarios[:len(scenarios)] if improved_scenarios else scenarios
                    
        except Exception as e:
                    print(f"AI scenario enhancement failed: {e}")
                    return scenarios
    
    def _parse_scenario_output(self, text):
        """Helper to parse Gherkin scenarios from LLM output"""
        scenarios = []
        current_scenario = []
        for line in text.split('\n'):
            line = line.strip()
            if line.startswith('Scenario:'):
                if current_scenario: # Save the previous scenario
                    scenarios.append('\n'.join(current_scenario))
                current_scenario = [line] # Start a new one
            elif line and (line.startswith(('Given', 'When', 'Then', 'And'))):
                if current_scenario: # Only add steps if we're in a scenario
                    current_scenario.append(line)
        if current_scenario: # Add the last scenario
            scenarios.append('\n'.join(current_scenario))
        return scenarios
    
    def _format_project_description(self, project_info):
        """Format project description for prompts"""
        return f"""
        Title: {project_info.get('title', 'Untitled Project')}
        Objective: {project_info.get('objective', 'Not specified')}
        Users: {', '.join(project_info.get('users', []))}
        Features: {', '.join(project_info.get('features', []))}
        Scope: {project_info.get('scope', 'Not specified')}
        Flow: {project_info.get('flow', 'Not specified')}
        Additional Information: {project_info.get('additional_info', 'None')}
        """

# ============================================================================
# SIMPLE RAG API VIEWS
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_rag_status(request):
    """
    Get RAG system status and stats
    GET /api/rag/status/
    """
    try:
        rag_db = ProjectRAGVectorDB()
        stats = rag_db.get_collection_stats()
        
        return JsonResponse({
            'success': True,
            'status': 'RAG system ready', 
            'stats': stats
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def query_rag_patterns(request):
    """
    Query the RAG vector DB for project patterns
    POST /api/rag/query-patterns/
    """
    try:
        query = request.data.get('query', '')
        k = int(request.data.get('k', 3))
        
        if not query:
            return JsonResponse({
                'success': False,
                'error': 'Query parameter required'
            }, status=400)
        
        rag_db = ProjectRAGVectorDB()
        patterns = rag_db.retrieve_similar_patterns(query, k)
        
        results = []
        for pattern in patterns:
            results.append({
                "project_type": pattern['metadata']['project_type'],
                "description": pattern['metadata']['description'],
                "target_users": pattern['metadata']['target_users'],
                "key_features": pattern['metadata']['key_features']
            })
        
        return JsonResponse({
            'success': True,
            'query': query,
            'results': results,
            'total_found': len(results)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def query_ui_patterns(request):
    """
    Query the in-memory UI patterns
    POST /api/rag/query-ui-patterns/
    """
    try:
        query = request.data.get('query', '')
        k = int(request.data.get('k', 2))
        
        if not query:
            return JsonResponse({
                'success': False,
                'error': 'Query parameter required'
            }, status=400)
        
        rag_db = ProjectRAGVectorDB()
        patterns = rag_db.retrieve_ui_patterns(query, k)
        
        results = []
        for pattern in patterns:
            results.append({
                "page_type": pattern['metadata']['page_type'],
                "description": pattern['metadata']['description'],
                "layout": pattern['metadata']['layout'],
                "required_elements": pattern['metadata']['required_elements']
            })
        
        return JsonResponse({
            'success': True,
            'query': query,
            'results': results,
            'total_found': len(results)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ============================================================================
# PROJECT API ENDPOINTS
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_user_stories(request, project_id):
    """
    Generates user stories for this project using RAG.
    (Step 1 of the pipeline)
    POST /api/projects/{project_id}/generate-user-stories/
    """
    try:
        project = Project.objects.get(project_id=project_id)
        rag_db = ProjectRAGVectorDB()
        project_info = _prepare_project_info(project)
        
        # Pass the real project object to the generator
        user_stories_data = _generate_user_stories_with_rag(project_info, rag_db, project)
        saved_stories = _save_user_stories(project, user_stories_data)
        
        session = _create_session(project, stories=len(saved_stories))
        _create_history(session, 'stories_generated',
                         f'Generated {len(saved_stories)} user stories')
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {len(saved_stories)} user stories',
            'stories': UserStorySerializer(saved_stories, many=True).data,
            'session_id': session.session_id
        }, status=200)
        
    except Project.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Project not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    
@api_view(['POST'])
@permission_classes([AllowAny])
def generate_user_stories_for_local_project(request):
    """
    Generate user stories for local (non-database) projects
    POST /api/local-projects/generate-user-stories/
    """
    try:
        # Get project data from request body (not from database)
        project_data = request.data.get('project_data')
        if not project_data:
            return JsonResponse({
                'success': False,
                'error': 'Project data required'
            }, status=400)
        
        # Use your existing UserStoryGenerator
        generator = UserStoryGenerator()
        rag_db = ProjectRAGVectorDB()
        
        # Generate stories using the same logic but with provided project data
        project_info = {
            'title': project_data.get('title', 'Local Project'),
            'objective': project_data.get('objective', ''),
            'users': project_data.get('users', []),
            'features': project_data.get('features', []),
            'scope': project_data.get('scope', ''),
            'flow': project_data.get('flow', ''),
            'additional_info': project_data.get('additional_info', '')
        }
        
        # Analyze project
        project_description = generator.format_project_description(project_info)
        project_analysis = analyze_project_description(project_description)
        
        # Get similar patterns
        similar_patterns = rag_db.retrieve_similar_patterns(project_description, k=3)
        
        # Generate stories
        stories_data = generator.generate_comprehensive_user_stories(
            project_info, project_analysis, similar_patterns
        )
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {len(stories_data)} user stories for local project',
            'stories': stories_data,  # Return the raw story data
            'count': len(stories_data)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_wireframes(request, project_id):
    """
    Generates HTML wireframes for all user stories in this project PLUS langsung generate Creole & Salt UML
    POST /api/projects/{project_id}/generate-wireframes/
    """
    try:
        project = Project.objects.get(project_id=project_id)
        rag_db = ProjectRAGVectorDB()
        user_stories = project.user_stories.all()
        
        if not user_stories.exists():
            return JsonResponse({
                'success': False,
                'error': 'No user stories found. Generate user stories first.'
            }, status=400)
        
        # Generate HTML wireframes dengan RAG
        html_docs = _generate_wireframes_with_rag(project, user_stories, rag_db)
        saved_wireframes = _save_wireframes_with_creole_salt(project, html_docs)
        
        session = _create_session(project, wireframes=len(saved_wireframes))
        _create_history(session, 'wireframes_generated',
                         f'Generated {len(saved_wireframes)} wireframes with Creole+Salt')
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {len(saved_wireframes)} wireframes with Creole and Salt UML',
            'wireframes': WireframeSerializer(saved_wireframes, many=True).data
        }, status=200)
        
    except Project.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Project not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    
@api_view(['POST'])
@permission_classes([AllowAny])
def generate_wireframes_for_local_project(request):
    """
    Generate HTML wireframes for local (non-database) projects with user stories
    POST /api/local-projects/generate-wireframes/
    """
    import time
    time.sleep(4)  # Add 4-second delay between API calls

    try:
        print("🔍 DEBUG: Starting wireframe generation")
        # Get project data and user stories from request body
        project_data = request.data.get('project_data')
        user_stories_data = request.data.get('user_stories', [])
        project_id = request.data.get('project_id')
        
        if not project_data:
            return JsonResponse({
                'success': False,
                'error': 'Project data required'
            }, status=400)
        
        if not user_stories_data:
            return JsonResponse({
                'success': False,
                'error': 'User stories data required'
            }, status=400)
        
        # Initialize wireframe generator and RAG
        wireframe_generator = WireframeGenerator()
        rag_db = ProjectRAGVectorDB()
        
        # Prepare project info for wireframe generation
        project_info = {
            'title': project_data.get('title', 'Local Project'),
            'objective': project_data.get('objective', ''),
            'users': project_data.get('users', []),
            'features': project_data.get('features', []),
            'scope': project_data.get('scope', ''),
            'flow': project_data.get('flow', ''),
            'additional_info': project_data.get('additional_info', ''),
            'domain': project_data.get('domain', 'general')
        }
        
        print(f"🔄 Generating wireframes for local project: {project_info['title']}")
        print(f"📝 Processing {len(user_stories_data)} user stories")
        
        # Generate HTML wireframes dengan RAG
        try:
            html_docs = wireframe_generator.generate_html_documentation(
                project_info, 
                user_stories_data, 
                rag_db
            )
        except Exception as e:
            print(f"⚠️ RAG wireframe generation failed: {e}")
            return JsonResponse({
                'success': False,
                'error': f'Wireframe generation failed: {str(e)}'
            }, status=500)
        
        # Generate Creole & Salt UML documentation USING THE IMPORTED FUNCTIONS
        try:
            creole_salt_docs = _generate_creole_salt_local(
                project_info,
                user_stories_data,
                html_docs
            )
        except Exception as e:
            print(f"⚠️ Creole/Salt generation failed: {e}")
            import traceback
            traceback.print_exc()
            creole_salt_docs = {
                "creole_documentation": "Documentation generation completed",
                "salt_uml_diagrams": "@startuml\ntitle System Overview\nactor User\nUser -> System : Interacts\n@enduml",
                "features_count": len(set(story.get('feature', 'General') for story in user_stories_data)),
                "total_stories": len(user_stories_data)
            }
        
        # Save wireframes to local storage
        saved_wireframes = _save_wireframes_local(
            project_id,
            project_info,
            html_docs,
            creole_salt_docs
        )
        
        # Create session record for local project
        session_data = _create_local_session(project_id, project_info, len(saved_wireframes))
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {len(saved_wireframes)} wireframes with Creole and Salt UML for local project',
            'wireframes': saved_wireframes,
            'session': session_data,
            'count': len(saved_wireframes)
        }, status=200)
        
    except Exception as e:
        print(f"❌ Error generating wireframes for local project: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

def _save_wireframes_local(project_id, project_info, html_docs, creole_salt_docs):
    """
    Simulate saving wireframes for local projects (return data instead of DB objects)
    """
    print("💾 Saving wireframe data for local project...")
    
    wireframes_data = []
    
    current_time = timezone.now().isoformat()
    
    for page_name, html_content in html_docs.get('role_pages', {}).items():
        try:
            # Generate Creole from HTML using the imported function
            creole_content = convert_html_to_creole(html_content)
            
            # Generate Salt UML from Creole using the imported function
            salt_diagram = generate_salt_wireframe(creole_content, page_name)
            
            wireframe_id = f"local_{project_id}_{page_name}_{int(timezone.now().timestamp())}"
            
            wireframe_data = {
                'wireframe_id': wireframe_id,
                'project_id': project_id,
                'page_name': page_name,
                'html_content': html_content,
                'creole_content': creole_content,
                'salt_diagram': salt_diagram,
                'creole_documentation': creole_salt_docs.get('creole_documentation', ''),
                'salt_uml': creole_salt_docs.get('salt_uml_diagrams', ''),
                'features_count': creole_salt_docs.get('features_count', 0),
                'stories_count': creole_salt_docs.get('total_stories', 0),
                'generated_at': current_time,
                'is_local': True
            }
            wireframes_data.append(wireframe_data)
            print(f"✅ Generated Creole+Salt for {page_name}")
            
        except Exception as e:
            print(f"⚠️ Error generating Creole/Salt for {page_name}: {e}")
            # Create basic wireframe data without Creole/Salt
            wireframe_id = f"local_{project_id}_{page_name}_{int(timezone.now().timestamp())}"
            wireframe_data = {
                'wireframe_id': wireframe_id,
                'project_id': project_id,
                'page_name': page_name,
                'html_content': html_content,
                'creole_content': "",
                'salt_diagram': "",
                'creole_documentation': creole_salt_docs.get('creole_documentation', ''),
                'salt_uml': creole_salt_docs.get('salt_uml_diagrams', ''),
                'features_count': creole_salt_docs.get('features_count', 0),
                'stories_count': creole_salt_docs.get('total_stories', 0),
                'generated_at': current_time,
                'is_local': True
            }
            wireframes_data.append(wireframe_data)
    
    return wireframes_data

def _create_local_session(project_id, project_info, wireframes_count):
    """
    Create session record for local project
    """
    session_data = {
        'session_id': f"local_session_{project_id}_{int(timezone.now().timestamp())}",
        'project_id': project_id,
        'project_title': project_info.get('title', 'Local Project'),
        'wireframes_generated': wireframes_count,
        'generated_at': timezone.now().isoformat(),
        'is_local': True
    }
    
    return session_data

def _find_page_for_local_story(story_data, wireframes_by_page):
    """
    Find the matching wireframe page for a local user story
    """
    story_text = story_data.get('text', '').lower()
    feature = story_data.get('feature', '').lower()
    role = story_data.get('role', 'user').lower()
    
    # Page mapping logic similar to database version
    page_keywords = {
        "login": "login", "signin": "login", "authenticate": "login", "log in": "login",
        "dashboard": "dashboard", "overview": "dashboard", "home": "dashboard", "main": "dashboard",
        "profile": "profile", "account": "profile", "settings": "profile", "user": "profile",
        "search": "search", "find": "search", "lookup": "search", "browse": "search",
        "product": "products", "catalog": "products", "item": "products", "shop": "products",
        "cart": "cart", "basket": "cart", "shopping": "cart",
        "checkout": "checkout", "payment": "checkout", "purchase": "checkout", "buy": "checkout",
        "admin": "admin", "manage": "admin", "administration": "admin", "system": "admin",
        "order": "orders", "purchase": "orders", "history": "orders",
        "analytics": "analytics", "reports": "analytics", "metrics": "analytics",
        "notification": "notifications", "alert": "notifications", "message": "notifications"
    }
    
    # Try to find matching page
    page_name = None
    for keyword, page_type in page_keywords.items():
        if keyword in story_text or keyword in feature:
            page_name = page_type
            break
    
    # Fallback to feature or role-based page name
    if not page_name and feature:
        page_name = feature.replace(" ", "-")
    elif not page_name:
        page_name = f"{role.replace(' ', '-')}-page"
    
    # Check if this page exists in wireframes
    if page_name in wireframes_by_page:
        return page_name
    
    # Try to find any matching wireframe
    for wireframe_page in wireframes_by_page.keys():
        if page_name.lower() in wireframe_page.lower() or wireframe_page.lower() in page_name.lower():
            return wireframe_page
    
    # Return first wireframe or default
    if wireframes_by_page:
        return list(wireframes_by_page.keys())[0]
    
    return "dashboard"  # Default page


def _create_mock_user_story(story_data, project_id, index):
    """
    Create a mock UserStory-like object for the generator WITH CLEAN DATA
    """
    class MockUserStory:
        def __init__(self, data, project_id, index):
            # Clean the data before passing to generator
            raw_text = data.get('story_text') or data.get('text') or f'User story {index+1}'
            
            # Clean Python object references
            clean_text = re.sub(r'views\.\s*generation_views\.\s*_create_mock_user_story\.\s*<locals>\.\s*MockUserStory\s*object', 
                              'create user story', raw_text, flags=re.IGNORECASE)
            clean_text = re.sub(r'0x[0-9A-Fa-f]+', '', clean_text)
            
            self.story_text = clean_text
            self.role = data.get('role', 'User')
            
            # Clean action and benefit
            raw_action = data.get('action', '')
            raw_benefit = data.get('benefit', '')
            
            self.action = re.sub(r'views\.\s*generation_views\.\s*', '', raw_action)
            self.action = re.sub(r'MockUserStory\s*', '', self.action, flags=re.IGNORECASE)
            self.action = self.action or 'use the system'
            
            self.benefit = re.sub(r'0x[0-9A-Fa-f]+', '', raw_benefit)
            self.benefit = self.benefit or 'achieve goal'
            
            self.feature = data.get('feature', 'General')
            self.acceptance_criteria = data.get('acceptance_criteria', [])
            self.priority = data.get('priority', 'medium')
            
            # Create story ID
            self.story_id = data.get('story_id') or data.get('id') or f'US{index+1:03d}'
            
            # Create project reference
            class MockProject:
                def __init__(self, pid):
                    self.project_id = pid
                    self.title = "Local Project"
                    self.users_data = []
                    self.features_data = []
            self.project = MockProject(project_id)
    
    return MockUserStory(story_data, project_id, index)

def _prepare_local_scenarios(scenarios_data, story_data, project_id, project_info, story_index):
    """
    Prepare scenario data for local project response
    """
    prepared_scenarios = []
    current_time = timezone.now().isoformat()
    
    for i, scenario in enumerate(scenarios_data):
        try:
            # Extract scenario info
            scenario_text = scenario.get('scenario_text', '')
            scenario_type = scenario.get('scenario_type', 'happy_path')
            
            # Generate unique scenario ID
            scenario_id = f"local_scenario_{project_id}_{story_data.get('id', f'US{story_index}')}_{int(timezone.now().timestamp())}_{i}"
            
            # Extract Gherkin steps from scenario text
            gherkin_steps = []
            if scenario_text:
                for line in scenario_text.split('\n'):
                    line = line.strip()
                    if line.startswith(('Given', 'When', 'Then', 'And')):
                        gherkin_steps.append(line)
            
            # Prepare scenario data
            scenario_data = {
                'scenario_id': scenario_id,
                'project_id': project_id,
                'story_id': story_data.get('id') or story_data.get('story_id') or f'US{story_index}',
                'story_text': story_data.get('text') or story_data.get('story_text') or '',
                'story_role': story_data.get('role', 'User'),
                'scenario_text': scenario_text,
                'scenario_type': scenario_type,
                'title': scenario.get('title', f'Scenario {i+1}'),
                'detected_domain': scenario.get('detected_domain', 'waste_management'),
                'has_proper_structure': scenario.get('has_proper_structure', True),
                'gherkin_steps': scenario.get('gherkin_steps', gherkin_steps),
                'enhanced_with_llm': scenario.get('enhanced_with_llm', True),
                'generated_at': current_time,
                'is_local': True
            }
            
            prepared_scenarios.append(scenario_data)
            
        except Exception as e:
            print(f"⚠️ Error preparing scenario {i}: {e}")
            continue
    
    return prepared_scenarios

def _create_local_scenario_session(project_id, project_info, scenarios_count, stories_count):
    """
    Create session record for local scenario generation WITHOUT USER
    """
    session_data = {
        'session_id': f"local_scenario_session_{project_id}_{int(timezone.now().timestamp())}",
        'project_id': project_id,
        'project_title': project_info.get('title', 'Local Project'),
        'scenarios_generated': scenarios_count,
        'stories_processed': stories_count,
        'generated_at': timezone.now().isoformat(),
        'is_local': True
    }
    
    return session_data

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_scenarios_for_local_project(request):
    """
    Generate Gherkin scenarios for local (non-database) projects
    POST /api/local-projects/generate-scenarios/
    
    STOPS IMMEDIATELY if no user stories or wireframes provided
    """
    import time
    time.sleep(2)  # Add 2-second delay between API calls


    try:
        print("🔍 [BACKEND] Starting scenario generation for local project")
        
        # Get data from request body
        project_data = request.data.get('project_data')
        user_stories_data = request.data.get('user_stories', [])
        wireframes_data = request.data.get('wireframes', [])
        project_id = request.data.get('project_id')
        
        print(f"📊 [BACKEND] Received data: project_id={project_id}")
        
        # ===== EARLY VALIDATION - STOP IF MISSING DATA =====
        
        # 1. Check if project data exists
        if not project_data:
            print("❌ [BACKEND] ERROR: No project data provided")
            return JsonResponse({
                'success': False,
                'error': 'Project data is required to generate scenarios',
                'details': 'Please provide project data including title, domain, and other details'
            }, status=400)
        
        # 2. Check if user stories exist
        if not user_stories_data:
            print("❌ [BACKEND] ERROR: No user stories provided")
            return JsonResponse({
                'success': False,
                'error': 'User stories are required to generate scenarios',
                'details': 'Please generate user stories first or provide existing user stories'
            }, status=400)
        
        # 3. Check if wireframes exist
        if not wireframes_data:
            print("❌ [BACKEND] ERROR: No wireframes provided")
            return JsonResponse({
                'success': False,
                'error': 'Wireframes are required to generate scenarios',
                'details': 'Please generate wireframes first or provide existing wireframes'
            }, status=400)
        
        # 4. Validate user stories data structure
        valid_stories = []
        for i, story in enumerate(user_stories_data):
            if not isinstance(story, dict):
                print(f"⚠️ [BACKEND] Warning: User story {i} is not a dictionary")
                continue
            
            # Check for essential fields
            story_text = story.get('story_text') or story.get('text')
            if not story_text:
                print(f"⚠️ [BACKEND] Warning: User story {i} has no story text")
                continue
            
            valid_stories.append(story)
        
        if not valid_stories:
            print("❌ [BACKEND] ERROR: No valid user stories found")
            return JsonResponse({
                'success': False,
                'error': 'No valid user stories found in the provided data',
                'details': 'Please check that user stories have at least a story text field'
            }, status=400)
        
        # 5. Validate wireframes data structure
        valid_wireframes = []
        for i, wireframe in enumerate(wireframes_data):
            if not isinstance(wireframe, dict):
                print(f"⚠️ [BACKEND] Warning: Wireframe {i} is not a dictionary")
                continue
            
            # Check for essential fields
            page_name = wireframe.get('page_name')
            html_content = wireframe.get('html_content')
            
            if not page_name:
                print(f"⚠️ [BACKEND] Warning: Wireframe {i} has no page name")
                continue
            
            valid_wireframes.append(wireframe)
        
        if not valid_wireframes:
            print("❌ [BACKEND] ERROR: No valid wireframes found")
            return JsonResponse({
                'success': False,
                'error': 'No valid wireframes found in the provided data',
                'details': 'Please check that wireframes have at least a page name'
            }, status=400)
        
        print(f"✅ [BACKEND] Validation passed: {len(valid_stories)} stories, {len(valid_wireframes)} wireframes")
        
        # ===== PROCESS VALIDATED DATA =====
        
        # Initialize scenario generator
        scenario_generator = ScenarioGenerator()
        print("✅ [BACKEND] ScenarioGenerator initialized")
        
        # Prepare project info
        project_info = {
            'title': project_data.get('title', 'Local Project'),
            'objective': project_data.get('objective', ''),
            'users': project_data.get('users', []),
            'features': project_data.get('features', []),
            'scope': project_data.get('scope', ''),
            'flow': project_data.get('flow', ''),
            'additional_info': project_data.get('additional_info', ''),
            'domain': project_data.get('domain', 'general')
        }
        
        print(f"🏗️ [BACKEND] Processing project: {project_info['title']} (Domain: {project_info['domain']})")
        
        # Organize wireframes by page name
        wireframes_by_page = {}
        for wireframe in valid_wireframes:
            page_name = wireframe.get('page_name', '')
            if page_name:
                wireframes_by_page[page_name] = wireframe.get('html_content', '')
        
        print(f"🎨 [BACKEND] Organized {len(wireframes_by_page)} wireframe pages")
        
        # Generate scenarios for each user story USING REAL DATA
        all_scenarios = []
        total_scenarios_generated = 0
        
        for i, story_data in enumerate(valid_stories[:3]):  # LIMIT to first 3 stories for performance
            try:
                story_id = story_data.get('story_id') or story_data.get('id') or f'story_{i}'
                print(f"📝 [BACKEND] Processing user story {i+1}/{min(len(valid_stories), 3)}: {story_id}")
                
                # Extract real user story data
                story_text = story_data.get('story_text') or story_data.get('text', '')
                role = story_data.get('role', 'User')
                action = story_data.get('action', '')
                benefit = story_data.get('benefit', '')
                feature = story_data.get('feature', 'General')
                
                print(f"   📖 Story: {story_text[:80]}...")
                print(f"   👤 Role: {role}")
                print(f"   🎯 Action: {action}")
                
                # Find matching wireframe for this story
                page_name = _find_page_for_local_story(story_data, wireframes_by_page)
                html_content = wireframes_by_page.get(page_name, '')
                
                if not page_name:
                    print(f"   ⚠️ No matching wireframe found for story")
                    continue
                
                user_story_dict = {
                    'story_text': story_text,
                    'text': story_text,  # Include both for compatibility
                    'role': role,
                    'action': action,
                    'benefit': benefit,
                    'goal': benefit,  # Include 'goal' as alias for 'benefit'
                    'feature': feature,
                    'story_id': story_id
                }
                
                # Generate scenarios using the dictionary
                print(f"   🧠 Generating scenarios from dictionary...")
                scenarios_data = scenario_generator.generate_comprehensive_scenarios(
                    user_story=user_story_dict,  # Pass the dictionary
                    html_content=html_content,
                    scenario_types=None
                )
                
                print(f"   ✅ Generated {len(scenarios_data)} scenarios")
                
                # Prepare scenarios for response
                story_scenarios = _prepare_local_scenarios_from_real_data(
                    scenarios_data, 
                    story_data, 
                    project_id, 
                    project_info,
                    i
                )
                
                all_scenarios.extend(story_scenarios)
                total_scenarios_generated += len(story_scenarios)
                print(f"   📋 Total scenarios so far: {total_scenarios_generated}")
                
            except Exception as e:
                print(f"⚠️ [BACKEND] Error generating scenarios for story {i+1}: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
        
        # Check if any scenarios were generated
        if not all_scenarios:
            print("❌ [BACKEND] ERROR: Failed to generate any scenarios")
            return JsonResponse({
                'success': False,
                'error': 'Failed to generate scenarios from the provided data',
                'details': 'Please check that user stories and wireframes contain valid, parsable content'
            }, status=500)
        
        # Create session record
        session_data = _create_local_scenario_session(
            project_id, 
            project_info, 
            total_scenarios_generated,
            len(valid_stories[:3])
        )
        
        print(f"✅ [BACKEND] Successfully generated {total_scenarios_generated} scenarios")
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {total_scenarios_generated} scenarios for {len(valid_stories[:3])} user stories',
            'scenarios': all_scenarios,
            'session': session_data,
            'total_scenarios': total_scenarios_generated,
            'total_stories': len(valid_stories[:3])
        }, status=200)
        
    except Exception as e:
        print(f"❌ [BACKEND] Critical error in generate_scenarios_for_local_project: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return JsonResponse({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }, status=500)


def _generate_creole_salt_local(project_info, user_stories_data, html_docs):
    """
    Generate Creole and Salt UML documentation for local projects
    USING THE IMPORTED convert_html_to_creole FUNCTION
    """
    print("📋 Generating Creole and Salt UML documentation...")
    
    try:
        # Group stories by feature for better organization
        features = {}
        for story in user_stories_data:
            feature = story.get('feature', 'General')
            features.setdefault(feature, []).append(story)
        
        # Generate Creole documentation from HTML using the imported function
        creole_content = ""
        
        # If we have HTML docs, convert them to Creole
        if html_docs.get('role_pages'):
            for page_name, html_content in html_docs['role_pages'].items():
                page_creole = convert_html_to_creole(html_content)
                creole_content += f"\n=== {page_name}\n\n{page_creole}\n\n"
        else:
            # Fallback: generate basic Creole documentation
            creole_content = f"""
= {project_info.get('title', 'Local Project')} Documentation

== Project Overview

* **Title**: {project_info.get('title', 'Local Project')}
* **Objective**: {project_info.get('objective', 'Not specified')}
* **Scope**: {project_info.get('scope', 'Not specified')}

== User Stories by Feature

"""
            
            for feature, stories in features.items():
                creole_content += f"=== {feature}\n\n"
                for i, story in enumerate(stories, 1):
                    creole_content += f"{i}. {story.get('story_text', 'Story')}\n"
                    creole_content += f"   * Role: {story.get('role', 'User')}\n"
                    creole_content += f"   * Priority: {story.get('priority', 'medium')}\n"
                    creole_content += f"   * Points: {story.get('story_points', 0)}\n\n"
        
        # Generate basic Salt UML for main flows using the imported function
        salt_content = ""
        if html_docs.get('role_pages'):
            for page_name, html_content in html_docs['role_pages'].items():
                page_creole = convert_html_to_creole(html_content)
                page_salt = generate_salt_wireframe(page_creole, page_name)
                salt_content += f"\n=== {page_name} Salt Diagram\n\n{page_salt}\n\n"
        else:
            # Fallback Salt UML
            salt_content = f"""
@startuml
title {project_info.get('title', 'Local Project')} - System Overview

actor User

"""
            
            # Add basic system components based on features
            for feature in features.keys():
                salt_content += f'rectangle "{feature}" as {feature.replace(" ", "").lower()}\n'
            
            salt_content += """
User --> Authentication
User --> Dashboard
Dashboard --> Profile
Dashboard --> Analytics

@enduml
"""
        
        return {
            "creole_documentation": creole_content.strip(),
            "salt_uml_diagrams": salt_content.strip(),
            "features_count": len(features),
            "total_stories": len(user_stories_data)
        }
        
    except Exception as e:
        print(f"⚠️ Creole/Salt generation failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Try manual fallback
        try:
            # Use convert_html_to_creole_manual as fallback
            fallback_creole = ""
            if html_docs.get('role_pages'):
                for page_name, html_content in html_docs['role_pages'].items():
                    page_creole = convert_html_to_creole_manual(html_content)
                    fallback_creole += f"\n=== {page_name}\n\n{page_creole}\n\n"
            
            return {
                "creole_documentation": fallback_creole.strip() or "Documentation generation completed",
                "salt_uml_diagrams": "@startuml\ntitle System Overview\nactor User\nUser -> System : Interacts\n@enduml",
                "features_count": len(set(story.get('feature', 'General') for story in user_stories_data)),
                "total_stories": len(user_stories_data)
            }
        except Exception as e2:
            print(f"⚠️ Manual fallback also failed: {e2}")
            return {
                "creole_documentation": "Documentation generation failed",
                "salt_uml_diagrams": "@startuml\nerror Generation failed\n@enduml",
                "features_count": 0,
                "total_stories": len(user_stories_data)
            }

def _save_wireframes_with_creole_salt(project, html_docs):
    """Enhanced version that generates PNG URLs"""
    saved_wireframes = []
    
    # Hapus wireframes lama
    project.wireframes.all().delete()
    
    for page_name, html_content in html_docs.get("role_pages", {}).items():
        try:
            # Generate wireframe with PNG URL
            wireframe_data = generate_wireframe_with_diagram(html_content, page_name)
            
            # Save to database
            wireframe = Wireframe.objects.create(
                project=project,
                page_name=page_name,
                html_content=html_content,
                creole_content=wireframe_data.get('creole_content', ''),
                salt_diagram=wireframe_data.get('salt_diagram', ''),
                generated_with_rag=True,
                version=1,
            )
            saved_wireframes.append(wireframe)
            
            print(f"✅ Saved wireframe with PNG: {page_name}")
            if wireframe_data.get('png_url'):
                print(f"   🌐 PNG URL: {wireframe_data['png_url'][:100]}...")
            
        except Exception as e:
            print(f"⚠️ Error saving wireframe {page_name}: {e}")
            import traceback
            traceback.print_exc()
            # Fallback: save without diagram
            wireframe = Wireframe.objects.create(
                project=project,
                page_name=page_name,
                html_content=html_content,
                generated_with_rag=True,
                version=1,
            )
            saved_wireframes.append(wireframe)
    
    return saved_wireframes

def _prepare_local_scenarios_from_real_data(scenarios_data, story_data, project_id, project_info, story_index):
    """
    Prepare scenario data for local project response using REAL data
    """
    prepared_scenarios = []
    current_time = timezone.now().isoformat()
    
    # Get REAL story data
    story_id = story_data.get('story_id') or story_data.get('id') or f'US{story_index}'
    story_text = story_data.get('story_text') or story_data.get('text', '')
    role = story_data.get('role', 'User')
    action = story_data.get('action', '')
    benefit = story_data.get('benefit', '')
    
    for i, scenario in enumerate(scenarios_data):
        try:
            # Extract scenario info
            scenario_text = scenario.get('scenario_text', '')
            scenario_type = scenario.get('scenario_type', 'happy_path')
            
            # Generate unique scenario ID
            scenario_id = f"local_{project_id}_{story_id}_{int(timezone.now().timestamp())}_{i}"
            
            # Extract Gherkin steps from scenario text or use provided ones
            gherkin_steps = scenario.get('gherkin_steps', [])
            if not gherkin_steps and scenario_text:
                for line in scenario_text.split('\n'):
                    line = line.strip()
                    if line.startswith(('Given', 'When', 'Then', 'And')):
                        gherkin_steps.append(line)
            
            # Clean up scenario text (remove any mock references)
            clean_scenario_text = _clean_scenario_text(scenario_text, role, action, benefit, project_info.get('domain', 'general'))
            
            # Prepare scenario data
            scenario_data = {
                'scenario_id': scenario_id,
                'project_id': project_id,
                'user_story_id': story_id,
                'story_text': story_text,
                'role': role,
                'action': action,
                'benefit': benefit,
                'scenario_text': clean_scenario_text,
                'scenario_type': scenario_type,
                'title': _generate_realistic_scenario_title(scenario_type, action, role, project_info.get('domain', 'general')),
                'detected_domain': project_info.get('domain', 'general'),
                'has_proper_structure': scenario.get('has_proper_structure', True),
                'gherkin_steps': gherkin_steps,
                'enhanced_with_llm': scenario.get('enhanced_with_llm', False),
                'status': 'draft',
                'created_at': current_time,
                'updated_at': current_time,
                'generated_by': 'api',
                'is_local': True
            }
            
            prepared_scenarios.append(scenario_data)
            
        except Exception as e:
            print(f"⚠️ Error preparing scenario {i}: {e}")
            continue
    
    return prepared_scenarios

def _clean_scenario_text(scenario_text, role, action, benefit, domain):
    """
    Clean scenario text to remove any mock references and make it realistic
    """
    if not scenario_text:
        return ""
    
    # Remove memory addresses and object references
    cleaned = re.sub(r'0x[0-9A-Fa-f]+', '', scenario_text)
    cleaned = re.sub(r'views\.\s*generation_views\.\s*', '', cleaned)
    cleaned = re.sub(r'_create_mock_user_story\.\s*<locals>\.\s*', '', cleaned)
    cleaned = re.sub(r'MockUserStory\s*object', 'user story', cleaned, flags=re.IGNORECASE)
    
    # Replace generic references with specific ones
    cleaned = re.sub(r'a user wants to create a mock user story', 
                    f'{role} wants to {action}', cleaned, flags=re.IGNORECASE)
    
    # Add domain-specific context
    if domain == 'waste_management':
        cleaned = re.sub(r'the system', 'the Waste Management System', cleaned)
        cleaned = re.sub(r'user story creation section', 'Waste Collection Entry page', cleaned)
    
    return cleaned.strip()

def _generate_realistic_scenario_title(scenario_type, action, role, domain):
    """
    Generate realistic scenario titles based on type, action, and domain
    """
    # Map scenario types to readable labels
    type_labels = {
        'happy_path': 'Successful',
        'alternate_path': 'Alternate',
        'exception_path': 'Error',
        'boundary_path': 'Boundary'
    }
    
    type_label = type_labels.get(scenario_type, 'Scenario')
    
    # Create domain-specific context
    domain_context = ''
    if domain == 'waste_management':
        if 'track' in action.lower() or 'monitor' in action.lower():
            domain_context = 'Waste Tracking '
        elif 'report' in action.lower():
            domain_context = 'Waste Reporting '
        elif 'collect' in action.lower():
            domain_context = 'Collection '
        else:
            domain_context = 'Waste Management '
    
    # Clean up action text
    clean_action = action.replace('create ', '').replace('add ', '').replace('update ', '').replace('delete ', '')
    
    return f"{type_label} {domain_context}{clean_action} by {role}"

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_scenarios(request, project_id):
    """
    Generates Gherkin scenarios for all stories, using HTML context.
    (Step 3 of the pipeline)
    POST /api/projects/{project_id}/generate-scenarios/
    """
    try:
        # ✅ FIX: Use Project model instead of UserStory
        project = Project.objects.get(project_id=project_id)
        user_stories = project.user_stories.all()
        
        if not user_stories.exists():
            return JsonResponse({
                'success': False,
                'error': 'No user stories found.'
            }, status=400)

        wireframes = {wf.page_name: wf.html_content for wf in project.wireframes.all()}
        if not wireframes:
            return JsonResponse({
                'success': False,
                'error': 'No wireframes found. Generate wireframes first.'
            }, status=400)

        scenarios_generated = 0
        all_saved_scenarios = []
        scenario_generator = ScenarioGenerator()
        
        for user_story in user_stories:
            page_name = _find_page_for_story(user_story, wireframes)
            html_content = wireframes.get(page_name)
            
            print(f"🎯 Generating scenarios for user story: {user_story.story_id}")
            print(f"   Page: {page_name}, HTML content: {'Yes' if html_content else 'No'}")
            
            scenarios = scenario_generator.generate_comprehensive_scenarios(
                user_story=user_story, 
                html_content=html_content
            )
            
            print(f"   Generated {len(scenarios)} scenario templates")
            
            saved_scenarios = _save_scenarios(user_story, scenarios)
            scenarios_generated += len(saved_scenarios)
            all_saved_scenarios.extend(saved_scenarios)
            
            print(f"   ✅ Saved {len(saved_scenarios)} scenarios to database")
        
        session = _create_session(project, scenarios=scenarios_generated)
        _create_history(session, 'scenarios_generated',
                         f'Generated {scenarios_generated} scenarios')
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {scenarios_generated} scenarios',
            'scenarios': ScenarioSerializer(all_saved_scenarios, many=True).data
        }, status=200)
        
    except Project.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Project not found'
        }, status=404)
    except Exception as e:
        print(f"❌ Error in generate_scenarios: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def export_all_artifacts(request, project_id):
    """
    Exports all artifacts (HTML, Creole, PNG) to a directory on the server.
    POST /api/projects/{project_id}/export-all-artifacts/
    """
    try:
        # ✅ FIXED: Use Project model, not UserStory
        project = Project.objects.get(project_id=project_id)
        project_info = _prepare_project_info(project)
        wireframes = project.wireframes.all()
        
        if not wireframes.exists():
            return JsonResponse({
                'success': False,
                'error': 'No wireframes found to export.'
            }, status=400)
        
        # Get all wireframe data
        html_docs = {"role_pages": {wf.page_name: wf.html_content for wf in wireframes}}
        creole_docs = {wf.page_name: wf.creole_content for wf in wireframes}
        salt_wireframes = {wf.page_name: wf.salt_diagram for wf in wireframes}
        
        # Generate timestamp for unique folder
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save all artifacts using the imported function
        base_dir = save_all_artifacts(
            project_info, html_docs, creole_docs, salt_wireframes, timestamp
        )
        
        # Create history entry
        _create_history(None, 'export_created', 
                       f'Exported all artifacts to {base_dir}', 
                       project=project)
        
        return JsonResponse({
            'success': True,
            'message': 'All artifacts exported successfully.',
            'export_directory': base_dir
        }, status=200)
        
    except Project.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Project not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_edit_user_stories(request, project_id):  # ✅ Changed parameter name
    """
    AI-assisted editing for all user stories in this project
    POST /api/projects/{project_id}/ai-edit-user-stories/
    """
    try:
        # ✅ FIXED: Get Project, not UserStory
        project = Project.objects.get(project_id=project_id)
        instructions = request.data.get('instructions', '')
        
        if not instructions:
            return JsonResponse({
                'success': False,
                'error': 'Instructions required'
            }, status=400)
        
        user_stories = project.user_stories.all()
        if not user_stories.exists():
            return JsonResponse({
                'success': False,
                'error': 'No stories to edit'
            }, status=400)
        
        # Convert to dictionary format for AI processing
        user_stories_data = []
        for story in user_stories:
            user_stories_data.append({
                'id': story.story_id,  # Use story_id field
                'text': story.story_text,
                'role': story.role,
                'feature': story.feature,
                'acceptance_criteria': story.acceptance_criteria or [],
                'priority': story.priority
            })
        
        project_info = _prepare_project_info(project)
        rag_db = ProjectRAGVectorDB()
        
        mixin = AIEditingMixin()
        improved_stories = mixin.ai_assisted_edit_user_stories(
            user_stories_data, instructions, project_info, rag_db
        )
        
        # Update the stories in database
        updated_stories = []
        for improved_story in improved_stories:
            story_id = improved_story.get('id')
            if story_id:
                try:
                    story = UserStory.objects.get(story_id=story_id, project=project)
                    story.story_text = improved_story.get('text', story.story_text)
                    story.role = improved_story.get('role', story.role)
                    story.action = extract_action_from_story(improved_story.get('text', ''))
                    story.benefit = extract_benefit_from_story(improved_story.get('text', ''))
                    story.feature = improved_story.get('feature', story.feature)
                    story.acceptance_criteria = improved_story.get('acceptance_criteria', story.acceptance_criteria)
                    story.priority = improved_story.get('priority', story.priority)
                    story.save()
                    updated_stories.append(story)
                except UserStory.DoesNotExist:
                    continue
        
        _create_history(None, 'ai_bulk_edit', 
                         f'AI-edited {len(updated_stories)} user stories', 
                         project=project)
        
        return JsonResponse({
            'success': True,
            'message': f'AI-edited {len(updated_stories)} user stories',
            'updated_stories': UserStorySerializer(updated_stories, many=True).data
        }, status=200)
        
    except Project.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Project not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    
# ============================================================================
# USER STORY API ENDPOINTS
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_story_scenarios(request, story_id):
    """
    Generate scenarios for this specific user story
    POST /api/user-stories/{story_id}/generate-scenarios/
    """
    try:
        user_story = UserStory.objects.get(story_id=story_id)  # ✅ CHANGED: id → story_id
        generator = ScenarioGenerator()
        
        wireframes = {wf.page_name: wf.html_content for wf in user_story.project.wireframes.all()}
        page_name = _find_page_for_story(user_story, wireframes)
        html_content = wireframes.get(page_name)

        scenarios_data = generator.generate_comprehensive_scenarios(
            user_story=user_story,
            html_content=html_content
        )
        
        saved_scenarios = _save_scenarios(user_story, scenarios_data)
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {len(saved_scenarios)} scenarios',
            'scenarios': ScenarioSerializer(saved_scenarios, many=True).data
        }, status=200)
        
    except UserStory.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'User story not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_edit_user_story(request, story_id):
    """
    AI-assisted editing for this user story
    POST /api/user-stories/{story_id}/ai-edit/
    """
    try:
        user_story = UserStory.objects.get(story_id=story_id)  # ✅ CHANGED: id → story_id
        instructions = request.data.get('instructions', '')
        
        if not instructions:
            return JsonResponse({
                'success': False,
                'error': 'Instructions required'
            }, status=400)
        
        project_info = _prepare_project_info(user_story.project)
        story_data = [UserStorySerializer(user_story).data]
        rag_db = ProjectRAGVectorDB()
        
        mixin = AIEditingMixin()
        improved_stories = mixin.ai_assisted_edit_user_stories(
            story_data, instructions, project_info, rag_db
        )
        
        if improved_stories:
            improved_story = improved_stories[0]
            user_story.story_text = improved_story.get('text', user_story.story_text)
            user_story.role = improved_story.get('role', user_story.role)
            user_story.action = extract_action_from_story(improved_story.get('text', ''))
            user_story.benefit = extract_benefit_from_story(improved_story.get('text', ''))
            user_story.feature = improved_story.get('feature', user_story.feature)
            user_story.acceptance_criteria = improved_story.get('acceptance_criteria', user_story.acceptance_criteria)
            user_story.priority = improved_story.get('priority', user_story.priority)
            user_story.save()
            
            _create_history(None, 'review_iteration', 
                             f'AI-edited user story: {user_story.story_id}',  # ✅ CHANGED: id → story_id
                             project=user_story.project)
            
            return JsonResponse({
                'success': True,
                'message': 'User story updated with AI',
                'user_story': UserStorySerializer(user_story).data
            }, status=200)
        else:
            return JsonResponse({
                'success': False,
                'error': 'AI editing failed'
            }, status=500)
            
    except UserStory.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'User story not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_edit_story_scenarios(request, story_id):
    """
    AI-assisted editing for all scenarios on this user story
    POST /api/user-stories/{story_id}/ai-edit-scenarios/
    """
    try:
        user_story = UserStory.objects.get(story_id=story_id)  # ✅ CHANGED: id → story_id
        instructions = request.data.get('instructions', '')
        
        if not instructions:
            return JsonResponse({
                'success': False,
                'error': 'Instructions required'
            }, status=400)
        
        scenarios = user_story.scenarios.all()
        if not scenarios.exists():
            return JsonResponse({
                'success': False,
                'error': 'No scenarios to edit'
            }, status=400)
        
        scenario_texts = [s.scenario_text for s in scenarios]
        project_info = _prepare_project_info(user_story.project)
        
        mixin = AIEditingMixin()
        improved_scenarios = mixin.ai_assisted_edit_scenarios(
            scenario_texts, user_story.story_text, user_story.role, instructions, project_info
        )
        
        updated_scenarios = []
        for i, scenario_model in enumerate(scenarios):
            if i < len(improved_scenarios):
                scenario_model.scenario_text = improved_scenarios[i]
                scenario_model.enhanced_with_llm = True
                scenario_model.save()
                updated_scenarios.append(scenario_model)
        
        return JsonResponse({
            'success': True,
            'message': f'AI-edited {len(updated_scenarios)} scenarios',
            'scenarios': ScenarioSerializer(updated_scenarios, many=True).data
        }, status=200)
        
    except UserStory.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'User story not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ============================================================================
# WIREFRAME API ENDPOINTS
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_creole(request, wireframe_id):
    """
    Generate Creole content from this wireframe's HTML
    POST /api/wireframes/{wireframe_id}/generate-creole/
    """
    try:
        wireframe = Wireframe.objects.get(id=wireframe_id)
        
        if not wireframe.html_content:
            return JsonResponse({
                'success': False,
                'error': 'No HTML content available'
            }, status=400)
        
        creole_content = convert_html_to_creole(wireframe.html_content)
        wireframe.creole_content = creole_content
        wireframe.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Creole content generated',
            'creole_content': creole_content
        }, status=200)
        
    except Wireframe.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Wireframe not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def generate_salt_diagram(request, wireframe_id):
    """
    Generate Salt UML diagram code from this wireframe's Creole
    POST /api/wireframes/{wireframe_id}/generate-salt-diagram/
    """
    try:
        wireframe = Wireframe.objects.get(id=wireframe_id)
        
        if not wireframe.creole_content:
            if not wireframe.html_content:
                return JsonResponse({
                    'success': False,
                    'error': 'No HTML or Creole content available.'
                }, status=400)
            wireframe.creole_content = convert_html_to_creole(wireframe.html_content)

        salt_diagram = generate_salt_wireframe(
            wireframe.creole_content, 
            wireframe.page_name
        )
        wireframe.salt_diagram = salt_diagram
        wireframe.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Salt UML diagram generated',
            'salt_diagram': salt_diagram
        }, status=200)
        
    except Wireframe.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Wireframe not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def render_png_diagram(request, wireframe_id):
    """
    Renders the Salt diagram and returns a live PlantUML URL.
    GET /api/wireframes/{wireframe_id}/render-png-diagram/
    """
    try:
        wireframe = Wireframe.objects.get(id=wireframe_id)
        
        if not wireframe.salt_diagram:
            return JsonResponse({
                'success': False,
                'error': 'No Salt diagram code. Generate Salt first.'
            }, status=400)
        
        url = render_plantuml_png(wireframe.salt_diagram, output_file=None)
        
        if not url:
            raise Exception("Failed to encode or generate PlantUML URL")

        return JsonResponse({
            'success': True,
            'message': 'PNG URL generated',
            'plantuml_url': url
        }, status=200)
        
    except Wireframe.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Wireframe not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_edit_wireframe(request, wireframe_id):
    """
    AI-assisted editing for this HTML wireframe
    POST /api/wireframes/{wireframe_id}/ai-edit/
    """
    try:
        wireframe = Wireframe.objects.get(id=wireframe_id)
        instructions = request.data.get('instructions', '')
        
        if not instructions:
            return JsonResponse({
                'success': False,
                'error': 'Instructions required'
            }, status=400)
        
        project_info = _prepare_project_info(wireframe.project)
        rag_db = ProjectRAGVectorDB()
        
        mixin = AIEditingMixin()
        improved_html = mixin.ai_assisted_edit_html(
            wireframe.html_content, wireframe.page_name, instructions, project_info, rag_db
        )
        
        wireframe.html_content = improved_html
        wireframe.version += 1
        wireframe.save()
        
        _create_history(None, 'wireframe_updated', 
                         f'AI-edited wireframe: {wireframe.page_name}', 
                         project=wireframe.project)
        
        return JsonResponse({
            'success': True,
            'message': 'Wireframe updated with AI',
            'wireframe': WireframeSerializer(wireframe).data
        }, status=200)
        
    except Wireframe.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Wireframe not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _prepare_project_info(project):
    """Converts a Project model instance to a dict for the generators."""
    return {
        'title': project.title,
        'objective': project.objective,
        'users': project.users_data or [],
        'features': project.features_data or [],
        'scope': project.scope,
        'flow': project.flow,
        'additional_info': project.additional_info
    }

def _generate_user_stories_with_rag(project_info, rag_db, real_project):
    """Generate user stories using the existing generator method"""
    generator = UserStoryGenerator()
    

    real_project.users_data = project_info['users']
    real_project.features_data = project_info['features']
    
    # Use the existing generator method with the REAL project
    user_stories = generator.generate_user_stories_for_project(real_project, rag_db)
    
    # Convert to the expected format for _save_user_stories
    stories_data = []
    for story in user_stories:
        stories_data.append({
            'text': story.story_text,
            'role': story.role,
            'feature': story.feature,
            'acceptance_criteria': story.acceptance_criteria,
            'priority': story.priority
        })
    
    return stories_data

def _save_user_stories(project, stories_data):
    """Saves the generated story dicts as UserStory models."""
    saved_stories = []
    # Don't delete existing stories - just clear them for this generation
    project.user_stories.all().delete()
    
    for i, story_data in enumerate(stories_data):
        try:
            # Use the provided ID or generate one
            story_id = story_data.get('id') or f'US{i+1:03d}'
            
            story = UserStory.objects.create(
                story_id=story_id,  # Use story_id field, not id
                project=project,
                story_text=story_data.get('text', ''),
                role=story_data.get('role', 'User'),
                action=extract_action_from_story(story_data.get('text', '')),
                benefit=extract_benefit_from_story(story_data.get('text', '')),
                feature=story_data.get('feature', 'General'),
                acceptance_criteria=story_data.get('acceptance_criteria', []),
                priority=story_data.get('priority', 'medium').lower(),
                generated_by_llm=True
            )
            saved_stories.append(story)
        except Exception as e:
            print(f"Error saving user story {i}: {e}")
            continue
    
    return saved_stories

def _generate_wireframes_with_rag(project, user_stories, rag_db):
    """Calls the WireframeGenerator with proper data formatting"""
    generator = WireframeGenerator()
    project_info = _prepare_project_info(project)
    
    # Convert UserStory objects to simple dict format
    user_stories_data = []
    for story in user_stories:
        user_stories_data.append({
            'text': story.story_text,
            'role': story.role,
            'feature': story.feature,
            'acceptance_criteria': story.acceptance_criteria or [],
            'priority': story.priority
        })
    
    # Debug: Print what we're sending
    print(f"DEBUG: Sending {len(user_stories_data)} stories to wireframe generator")
    for i, story in enumerate(user_stories_data):
        print(f"Story {i}: {story.get('text', 'NO TEXT')[:50]}...")
    
    return generator.generate_html_documentation(project_info, user_stories_data, rag_db)

def _save_wireframes(project, html_docs):
    """Saves the generated HTML dict as Wireframe models PLUS langsung generate Creole & Salt UML."""
    saved_wireframes = []
    project.wireframes.all().delete()
    
    for page_name, html_content in html_docs.get("role_pages", {}).items():
        try:
            # Generate Creole dari HTML using the imported function
            creole_content = convert_html_to_creole(html_content)
            
            # Generate Salt UML dari Creole using the imported function
            salt_diagram = generate_salt_wireframe(creole_content, page_name)
            
            # Simpan semua ke database
            wf = Wireframe.objects.create(
                project=project,
                page_name=page_name,
                html_content=html_content,
                creole_content=creole_content,
                salt_diagram=salt_diagram,
                version=1,
            )
            saved_wireframes.append(wf)
            print(f"✅ Saved wireframe with Creole+Salt: {page_name}")
            
        except Exception as e:
            print(f"⚠️ Error generating Creole/Salt for {page_name}: {e}")
            # Fallback: simpan HTML saja tanpa Creole/Salt
            wf = Wireframe.objects.create(
                project=project,
                page_name=page_name,
                html_content=html_content,
                version=1,
            )
            saved_wireframes.append(wf)
            print(f"✅ Saved wireframe (HTML only): {page_name}")
    
    print(f"📊 Total wireframes saved: {len(saved_wireframes)}")
    print(f"📝 With Creole+Salt: {len([w for w in saved_wireframes if w.creole_content and w.salt_diagram])}")
    
    return saved_wireframes
    
def _save_scenarios(user_story, scenarios_data):
    """Saves the generated scenario dicts as Scenario models."""
    saved = []
    user_story.scenarios.all().delete()
    
    print(f"🔍 Debug: User Story ID: {user_story.story_id}")
    print(f"🔍 Debug: User Story Project ID: {user_story.project.project_id}")
    
    for i, data in enumerate(scenarios_data):
        try:
            print(f"🔍 Debug: Saving scenario {i+1}/{len(scenarios_data)}")
            
            # ISI project_id secara eksplisit
            scenario = Scenario.objects.create(
                user_story=user_story,
                project_id=user_story.project.project_id,  # ✅ TAMBAHKAN INI
                scenario_text=data.get('scenario_text', ''),
                scenario_type=data.get('scenario_type', 'happy_path'),
                title=data.get('title', 'Scenario'),
                detected_domain=data.get('detected_domain', 'general'),
                enhanced_with_llm=data.get('enhanced_with_llm', False),
                has_proper_structure=data.get('has_proper_structure', True),
                gherkin_steps=data.get('gherkin_steps', [])
            )
            saved.append(scenario)
            print(f"✅ Saved scenario: {scenario.title} for project: {user_story.project.project_id}")
            
        except Exception as e:
            print(f"❌ Error saving scenario {i+1}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    print(f"📊 Total scenarios saved: {len(saved)}")
    return saved

def _find_page_for_story(story_model, wireframe_pages):
    """Finds the matching generated page_name for a given story."""
    text = story_model.story_text.lower()
    feature = (story_model.feature or "").strip().lower()
    role = (story_model.role or "general").strip().lower()

    page_keywords = {
        "login": "login", "signin": "login", "authenticate": "login", "log in": "login",
        "dashboard": "dashboard", "overview": "dashboard", "home": "dashboard", "main": "dashboard",
        "profile": "profile", "account": "profile", "settings": "profile", "user": "profile",
        "search": "search", "find": "search", "lookup": "search", "browse": "search",
        "product": "products", "catalog": "products", "item": "products", "shop": "products",
        "cart": "cart", "basket": "cart", "shopping": "cart",
        "checkout": "checkout", "payment": "checkout", "purchase": "checkout", "buy": "checkout",
        "admin": "admin", "manage": "admin", "administration": "admin", "system": "admin",
        "order": "orders", "purchase": "orders", "history": "orders",
        "analytics": "analytics", "reports": "analytics", "metrics": "analytics",
        "notification": "notifications", "alert": "notifications", "message": "notifications"
    }
    
    page_name = None
    for keyword, page_type in page_keywords.items():
        if keyword in text or keyword in feature:
            page_name = page_type
            break
    
    if not page_name and feature:
         page_name = feature.replace(" ", "-")
    elif not page_name:
         page_name = f"{role.replace(' ', '-')}-page"
    
    if page_name in wireframe_pages:
        return page_name
    
    return None

def _create_session(project, stories=0, wireframes=0, scenarios=0):
    """Helper to create a GenerationSession."""
    return GenerationSession.objects.create(
        project=project,
        user=project.user,
        llm_model_used=os.getenv('MODEL_ID', 'ibm-granite/granite-3.3-8b-instruct'),
        user_stories_generated=stories,
        wireframes_generated=wireframes,
        scenarios_generated=scenarios,
        status='completed',
        end_time=timezone.now()
    )

def _create_history(session, action_type, description, project=None):
    """Helper to create a ProjectHistory entry."""
    if session:
        project = session.project
    
    ProjectHistory.objects.create(
        project=project,
        user=project.user,
        generation_session=session,
        action_type=action_type,
        action_details={'count': (session.user_stories_generated if session else 0) or 
                                 (session.wireframes_generated if session else 0) or 
                                 (session.scenarios_generated if session else 0)},
        description=description
    )
