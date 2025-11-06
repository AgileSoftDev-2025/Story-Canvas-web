from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from stories.utils.decorators import api_view
from stories.models import UserStory, Project, Scenario
# Ganti import ini
from stories.serializers.user_story_scenario_serializers import (
    UserStorySerializer, 
    ScenarioSerializer,
    ProjectSerializer
)

@api_view(['GET'])
def get_user_stories(request, project_id=None):
    """
    Get all user stories or filter by project
    GET /api/stories/
    GET /api/projects/{project_id}/stories/
    """
    try:
        if project_id:
            project = get_object_or_404(Project, project_id=project_id)
            user_stories = UserStory.objects.filter(project=project)
        else:
            user_stories = UserStory.objects.all()
        
        user_stories = user_stories.order_by('-created_at')
        serializer = UserStorySerializer(user_stories, many=True)
        
        return JsonResponse({
            'success': True,
            'stories': serializer.data,
            'count': len(serializer.data)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def get_user_story_detail(request, story_id):
    """
    Get specific user story with scenarios
    GET /api/stories/{story_id}/
    """
    try:
        user_story = get_object_or_404(UserStory, story_id=story_id)
        serializer = UserStorySerializer(user_story)
        
        return JsonResponse({
            'success': True,
            'story': serializer.data
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
def create_user_story(request, project_id):
    """
    Create new user story for project
    POST /api/projects/{project_id}/stories/create/
    """
    try:
        import json
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}

        project = get_object_or_404(Project, project_id=project_id)
        data['project'] = project_id  # pastikan project_id disertakan

        serializer = UserStorySerializer(data=data)
        
        if serializer.is_valid():
            user_story = serializer.save()
            return JsonResponse({
                'success': True,
                'message': 'User story created successfully',
                'story': UserStorySerializer(user_story).data
            }, status=201)
        else:
            return JsonResponse({
                'success': False,
                'error': 'Invalid data',
                'details': serializer.errors
            }, status=400)
            
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

@api_view(['PUT'])
def update_user_story(request, story_id):
    """
    Update user story
    PUT /api/stories/{story_id}/update/
    """
    try:
        user_story = get_object_or_404(UserStory, story_id=story_id)
        serializer = UserStorySerializer(user_story, data=request.data, partial=True)
        
        if serializer.is_valid():
            updated_story = serializer.save()
            return JsonResponse({
                'success': True,
                'message': 'User story updated successfully',
                'story': UserStorySerializer(updated_story).data
            }, status=200)
        else:
            return JsonResponse({
                'success': False,
                'error': 'Invalid data',
                'details': serializer.errors
            }, status=400)
            
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

@api_view(['DELETE'])
def delete_user_story(request, story_id):
    """
    Delete user story
    DELETE /api/stories/{story_id}/delete/
    """
    try:
        user_story = get_object_or_404(UserStory, story_id=story_id)
        user_story.delete()
        
        return JsonResponse({
            'success': True,
            'message': 'User story deleted successfully'
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