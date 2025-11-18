import os
import json
import re
from datetime import datetime
from django.http import JsonResponse
from django.views import View
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone

from stories.serializers.user_story_scenario_serializers import ScenarioSerializer, UserStorySerializer
from stories.serializers.wireframe_serializers import WireframeSerializer

# Import all models, serializers, and generators from your system
from .models import Project, UserStory, Wireframe, Scenario, GenerationSession, ProjectHistory
from .rag_vector_db import ProjectRAGVectorDB

# Import all utility functions from your other files
from .utils.project_analyzer import (
    analyze_project_description, 
    extract_action_from_story, 
    extract_benefit_from_story
)
from .utils.user_story_generator import UserStoryGenerator
from .utils.scenario_generator import ScenarioGenerator
from .utils.wireframe_generator import WireframeGenerator
from .utils.creole_converter import convert_html_to_creole
from .utils.salt_generator import (
    generate_salt_wireframe,
    render_plantuml_png,
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
        user_stories_data = _generate_user_stories_with_rag(project_info, rag_db)
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
def generate_wireframes(request, project_id):
    """
    Generates HTML wireframes for all user stories in this project.
    (Step 2 of the pipeline)
    POST /api/projects/{project_id}/generate-wireframes/
    """
    try:
        project = UserStory.objects.get(story_id=project_id)
        rag_db = ProjectRAGVectorDB()
        user_stories = project.user_stories.all()
        
        if not user_stories.exists():
            return JsonResponse({
                'success': False,
                'error': 'No user stories found. Generate user stories first.'
            }, status=400)
        
        html_docs = _generate_wireframes_with_rag(project, user_stories, rag_db)
        saved_wireframes = _save_wireframes(project, html_docs)
        
        session = _create_session(project, wireframes=len(saved_wireframes))
        _create_history(session, 'wireframes_generated',
                         f'Generated {len(saved_wireframes)} wireframes')
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {len(saved_wireframes)} wireframes',
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
def generate_scenarios(request, project_id):
    """
    Generates Gherkin scenarios for all stories, using HTML context.
    (Step 3 of the pipeline)
    POST /api/projects/{project_id}/generate-scenarios/
    """
    try:
        project = UserStory.objects.get(story_id=project_id)
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
            
            scenarios = scenario_generator.generate_comprehensive_scenarios(
                user_story=user_story, 
                html_content=html_content
            )
            saved_scenarios = _save_scenarios(user_story, scenarios)
            scenarios_generated += len(saved_scenarios)
            all_saved_scenarios.extend(saved_scenarios)
        
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
        project = UserStory.objects.get(project_id=project_id)
        project_info = _prepare_project_info(project)
        wireframes = project.wireframes.all()
        
        if not wireframes.exists():
            return JsonResponse({
                'success': False,
                'error': 'No wireframes found to export.'
            }, status=400)
        
        html_docs = {"role_pages": {wf.page_name: wf.html_content for wf in wireframes}}
        creole_docs = {wf.page_name: wf.creole_content for wf in wireframes}
        salt_wireframes = {wf.page_name: wf.salt_diagram for wf in wireframes}
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        base_dir = save_all_artifacts(
            project_info, html_docs, creole_docs, salt_wireframes, timestamp
        )
        
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
def ai_edit_user_stories(request, project_id):
    """
    AI-assisted editing for all user stories in this project
    POST /api/projects/{project_id}/ai-edit-user-stories/
    """
    try:
        project = UserStory.objects.get(story_id=story_id)
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
        
        user_stories_data = UserStorySerializer(user_stories, many=True).data
        project_info = _prepare_project_info(project)
        rag_db = ProjectRAGVectorDB()
        
        mixin = AIEditingMixin()
        improved_stories = mixin.ai_assisted_edit_user_stories(
            user_stories_data, instructions, project_info, rag_db
        )
        
        updated_stories = []
        for improved_story in improved_stories:
            story_id = improved_story.get('id')
            if story_id:
                try:
                    story = UserStory.objects.get(id=story_id, project=project)
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

def _generate_user_stories_with_rag(project_info, rag_db):
    """Calls the UserStoryGenerator"""
    generator = UserStoryGenerator()
    project_desc = generator.format_project_description(project_info)
    analysis = analyze_project_description(project_desc)
    patterns = rag_db.retrieve_similar_patterns(project_desc, k=3)
    
    print(f"Project Description: {project_desc}")  # Debug
    print(f"Analysis: {analysis}")  # Debug
    print(f"Patterns found: {len(patterns)}")  # Debug
    
    stories = generator.generate_comprehensive_user_stories(project_info, analysis, patterns)
    
    print(f"Generated stories: {len(stories)}")  # Debug
    for i, story in enumerate(stories):
        print(f"Story {i}: {story}")  # Debug
    
    return stories

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
    """Calls the WireframeGenerator"""
    generator = WireframeGenerator()
    project_info = _prepare_project_info(project)
    return generator.generate_html_documentation(project_info, user_stories, rag_db)

def _save_wireframes(project, html_docs):
    """Saves the generated HTML dict as Wireframe models."""
    saved_wireframes = []
    project.wireframes.all().delete()
    for page_name, html_content in html_docs.get("role_pages", {}).items():
        wf = Wireframe.objects.create(
            project=project,
            page_name=page_name,
            html_content=html_content,
            version=1,
            generated_by_llm=True
        )
        saved_wireframes.append(wf)
    return saved_wireframes

def _save_scenarios(user_story, scenarios_data):
    """Saves the generated scenario dicts as Scenario models."""
    saved = []
    user_story.scenarios.all().delete()
    for data in scenarios_data:
        scenario = Scenario.objects.create(
            user_story=user_story,
            scenario_text=data.get('scenario_text', ''),
            scenario_type=data.get('scenario_type', 'happy_path'),
            title=data.get('title', 'Scenario'),
            detected_domain=data.get('detected_domain', 'general'),
            enhanced_with_llm=data.get('enhanced_with_llm', False)
        )
        saved.append(scenario)
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