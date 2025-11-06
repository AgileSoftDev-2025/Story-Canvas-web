from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from stories.utils.decorators import api_view
from stories.models import UserStory, Scenario, Project
from stories.serializers.user_story_scenario_serializers import ScenarioSerializer
import json

# Simple serializer untuk menghindari import issues
class SimpleScenarioSerializer:
    @staticmethod
    def serialize(scenario):
        return {
            'scenario_id': scenario.scenario_id,
            'user_story': scenario.user_story.story_id if scenario.user_story else None,
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
    try:
        user_story = get_object_or_404(UserStory, story_id=story_id)
        scenarios = Scenario.objects.filter(user_story=user_story).order_by('scenario_type', 'created_at')
        return JsonResponse({
            'success': True,
            'scenarios': SimpleScenarioSerializer.serialize_many(scenarios),
            'story_title': user_story.story_text,
            'count': scenarios.count()
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@api_view(['GET'])
def get_project_scenarios(request, project_id):
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

@api_view(['POST'])
def create_scenario(request, story_id=None, project_id=None):
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
            return JsonResponse({'success': False, 'error': 'Either story_id or project_id must be provided'}, status=400)

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
    try:
        scenario = get_object_or_404(Scenario, scenario_id=scenario_id)
        scenario.delete()
        return JsonResponse({'success': True, 'message': 'Scenario deleted successfully'}, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
