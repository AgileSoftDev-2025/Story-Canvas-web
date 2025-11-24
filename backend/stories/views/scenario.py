from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from stories.utils.decorators import api_view
from stories.models import UserStory, Scenario, Project
from stories.utils.scenario_generator import ScenarioGenerator
import json
from stories.services.scenario_services import ScenarioService

def get_project_scenarios(request, project_id):
    """Get scenarios for a project"""
    try:
        print(f"🔍 [DJANGO VIEW] get_project_scenarios called for project: {project_id}")
        
        scenario_service = ScenarioService()
        result = scenario_service.get_project_scenarios(project_id)
        
        print(f"✅ [DJANGO VIEW] Service result: {result}")
        
        return JsonResponse(result)
    except Exception as e:
        error_msg = f'Error fetching project scenarios: {str(e)}'
        print(f"💥 [DJANGO VIEW] {error_msg}")
        return JsonResponse({
            'success': False, 
            'error': error_msg
        }, status=500)

# Simple serializer untuk menghindari import issues
class SimpleScenarioSerializer:
    @staticmethod
    def serialize(scenario):
        return {
            'scenario_id': str(scenario.scenario_id),
            'user_story': str(scenario.user_story.story_id) if scenario.user_story else None,
            'user_story_title': scenario.user_story.story_text[:50] + '...' if scenario.user_story else 'No Story',
            'scenario_text': scenario.scenario_text,
            'scenario_type': scenario.scenario_type,
            'title': scenario.title,
            'detected_domain': scenario.detected_domain,
            'has_proper_structure': scenario.has_proper_structure,
            'gherkin_steps': scenario.gherkin_steps,
            'enhanced_with_llm': scenario.enhanced_with_llm,
            'status': scenario.status,
            'created_at': scenario.created_at.isoformat() if scenario.created_at else None,
            'updated_at': scenario.updated_at.isoformat() if scenario.updated_at else None
        }
    
    @staticmethod
    def serialize_many(scenarios):
        return [SimpleScenarioSerializer.serialize(scenario) for scenario in scenarios]

@api_view(['GET'])
def get_story_scenarios(request, story_id):
    """Get all scenarios for a specific user story - FOR REACT COMPONENT"""
    try:
        user_story = get_object_or_404(UserStory, story_id=story_id)
        scenarios = Scenario.objects.filter(user_story=user_story).order_by('created_at')
        
        return JsonResponse({
            'success': True,
            'scenarios': SimpleScenarioSerializer.serialize_many(scenarios),
            'story_title': user_story.story_text,
            'story_id': str(story_id),
            'count': scenarios.count()
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@api_view(['GET'])
def get_scenario_detail(request, scenario_id):
    """Get detailed information for a specific scenario"""
    try:
        scenario = get_object_or_404(Scenario, scenario_id=scenario_id)
        
        return JsonResponse({
            'success': True,
            'scenario': SimpleScenarioSerializer.serialize(scenario)
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@api_view(['POST'])
def generate_story_scenarios_api(request, story_id):
    """Generate scenarios for a user story using AI - NEW ENDPOINT"""
    try:
        user_story = get_object_or_404(UserStory, story_id=story_id)
        
        # Get optional parameters from request
        try:
            data = json.loads(request.body)
            scenario_types = data.get('scenario_types')
            html_content = data.get('html_content')
        except json.JSONDecodeError:
            scenario_types = None
            html_content = None
        
        # Initialize scenario generator
        generator = ScenarioGenerator()
        
        # Generate scenarios using the comprehensive generator
        scenarios_data = generator.generate_comprehensive_scenarios(
            user_story=user_story,
            html_content=html_content,
            scenario_types=scenario_types
        )
        
        # Save generated scenarios to database
        created_scenarios = []
        for scenario_data in scenarios_data:
            scenario = Scenario.objects.create(
                user_story=user_story,
                project=user_story.project,
                title=scenario_data.get('title', f'Scenario for {user_story.story_text[:30]}'),
                scenario_text=scenario_data.get('scenario_text', ''),
                scenario_type=scenario_data.get('scenario_type', 'happy_path'),
                detected_domain=scenario_data.get('detected_domain', ''),
                has_proper_structure=scenario_data.get('has_proper_structure', True),
                gherkin_steps=scenario_data.get('gherkin_steps', []),
                enhanced_with_llm=scenario_data.get('enhanced_with_llm', False),
                status='draft'
            )
            created_scenarios.append(SimpleScenarioSerializer.serialize(scenario))
        
        return JsonResponse({
            'success': True,
            'message': f'Successfully generated {len(created_scenarios)} scenarios',
            'generated_scenarios': created_scenarios,
            'story_id': str(story_id),
            'count': len(created_scenarios)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False, 
            'error': f'Failed to generate scenarios: {str(e)}'
        }, status=500)

@api_view(['POST'])
def accept_scenarios(request, story_id):
    """Accept and finalize scenarios for a user story - NEW ENDPOINT"""
    try:
        user_story = get_object_or_404(UserStory, story_id=story_id)
        
        # Get scenario IDs to accept (optional - if empty, accept all for this story)
        try:
            data = json.loads(request.body)
            scenario_ids = data.get('scenario_ids', [])
        except json.JSONDecodeError:
            scenario_ids = []
        
        # Get scenarios to update
        if scenario_ids:
            scenarios = Scenario.objects.filter(
                user_story=user_story,
                scenario_id__in=scenario_ids
            )
        else:
            scenarios = Scenario.objects.filter(user_story=user_story)
        
        # Update status to 'accepted'
        updated_count = scenarios.update(status='accepted')
        
        # Get the updated scenarios for response
        updated_scenarios = Scenario.objects.filter(
            user_story=user_story,
            scenario_id__in=[s.scenario_id for s in scenarios]
        )
        
        return JsonResponse({
            'success': True,
            'message': f'Successfully accepted {updated_count} scenarios',
            'story_id': str(story_id),
            'accepted_count': updated_count,
            'accepted_scenarios': SimpleScenarioSerializer.serialize_many(updated_scenarios)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to accept scenarios: {str(e)}'
        }, status=500)

@api_view(['POST'])
def create_scenario(request, story_id=None, project_id=None):
    """Create a new scenario manually"""
    try:
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}

        if story_id:
            user_story = get_object_or_404(UserStory, story_id=story_id)
            project = user_story.project
        elif project_id:
            project = get_object_or_404(Project, project_id=project_id)
            user_story = None
        else:
            return JsonResponse({
                'success': False, 
                'error': 'Either story_id or project_id must be provided'
            }, status=400)

        scenario = Scenario.objects.create(
            user_story=user_story,
            project=project,
            scenario_text=data.get('scenario_text', ''),
            scenario_type=data.get('scenario_type', 'happy_path'),
            title=data.get('title', ''),
            detected_domain=data.get('detected_domain', ''),
            has_proper_structure=data.get('has_proper_structure', True),
            gherkin_steps=data.get('gherkin_steps', []),
            enhanced_with_llm=data.get('enhanced_with_llm', False),
            status=data.get('status', 'draft')
        )

        return JsonResponse({
            'success': True,
            'message': 'Scenario created successfully',
            'scenario': SimpleScenarioSerializer.serialize(scenario)
        }, status=201)

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@api_view(['PUT'])
def update_scenario(request, scenario_id):
    """Update an existing scenario"""
    try:
        scenario = get_object_or_404(Scenario, scenario_id=scenario_id)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}

        update_fields = [
            'scenario_text', 'scenario_type', 'title', 'detected_domain',
            'has_proper_structure', 'gherkin_steps', 'enhanced_with_llm', 'status'
        ]

        for field in update_fields:
            if field in data:
                setattr(scenario, field, data[field])

        scenario.save()

        return JsonResponse({
            'success': True,
            'message': 'Scenario updated successfully',
            'scenario': SimpleScenarioSerializer.serialize(scenario)
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@api_view(['DELETE'])
def delete_scenario(request, scenario_id):
    """Delete a scenario"""
    try:
        scenario = get_object_or_404(Scenario, scenario_id=scenario_id)
        scenario.delete()
        return JsonResponse({
            'success': True, 
            'message': 'Scenario deleted successfully'
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@api_view(['GET'])
def get_project_scenarios(request, project_id):
    """Get all scenarios for a specific project"""
    try:
        project = get_object_or_404(Project, project_id=project_id)
        scenarios = Scenario.objects.filter(project=project).order_by('scenario_type', 'created_at')
        return JsonResponse({
            'success': True,
            'scenarios': SimpleScenarioSerializer.serialize_many(scenarios),
            'project_title': project.title,
            'count': scenarios.count()
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)