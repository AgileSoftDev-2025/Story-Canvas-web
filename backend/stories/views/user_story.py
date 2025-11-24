import json
from django.http import JsonResponse
from stories.utils.decorators import api_view
from stories.models import UserStory, Project
from stories.serializers.user_story_serializer import (
    serialize_user_story, 
    serialize_user_story_with_project, 
    serialize_user_story_list
)

@api_view(['GET'])
def get_user_stories(request):
    """
    Get all user stories with filtering options
    """
    try:
        project_id = request.GET.get('project_id')
        status = request.GET.get('status')
        priority = request.GET.get('priority')
        
        user_stories = UserStory.objects.all().select_related('project')
        
        # Apply filters
        if project_id:
            user_stories = user_stories.filter(project__project_id=project_id)
        if status:
            user_stories = user_stories.filter(status=status)
        if priority:
            user_stories = user_stories.filter(priority=priority)
        
        data = serialize_user_story_list(user_stories)
        
        return JsonResponse({
            'success': True,
            'data': data,
            'count': len(data)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def get_user_story_detail(request, story_id):
    """
    Get user story detail by story_id
    """
    try:
        user_story = UserStory.objects.select_related('project').get(story_id=story_id)
        data = serialize_user_story_with_project(user_story)
        
        return JsonResponse({
            'success': True,
            'data': data
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
def create_user_story(request):
    """
    Create new user story
    """
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['project_id', 'story_text', 'role', 'action', 'benefit']
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }, status=400)
        
        # Check if project exists
        try:
            project = Project.objects.get(project_id=data['project_id'])
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        user_story = UserStory.objects.create(
            project=project,
            story_text=data['story_text'],
            role=data['role'],
            action=data['action'],
            benefit=data['benefit'],
            feature=data.get('feature'),
            acceptance_criteria=data.get('acceptance_criteria', []),
            priority=data.get('priority', 'medium'),
            story_points=data.get('story_points', 0),
            status=data.get('status', 'draft'),
            generated_by_llm=data.get('generated_by_llm', False),
            iteration=data.get('iteration', 1)
        )
        
        return JsonResponse({
            'success': True,
            'data': serialize_user_story_with_project(user_story)
        }, status=201)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

@api_view(['PUT'])
def update_user_story(request, story_id):
    """
    Update user story
    """
    try:
        user_story = UserStory.objects.get(story_id=story_id)
        data = json.loads(request.body)
        
        # Update allowed fields
        update_fields = [
            'story_text', 'role', 'action', 'benefit', 'feature',
            'acceptance_criteria', 'priority', 'story_points', 'status',
            'generated_by_llm', 'iteration'
        ]
        
        for field in update_fields:
            if field in data:
                setattr(user_story, field, data[field])
                
        user_story.save()
        
        return JsonResponse({
            'success': True,
            'data': serialize_user_story_with_project(user_story)
        }, status=200)
        
    except UserStory.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'User story not found'
        }, status=404)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

@api_view(['DELETE'])
def delete_user_story(request, story_id):
    """
    Delete user story
    """
    try:
        user_story = UserStory.objects.get(story_id=story_id)
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

@api_view(['GET'])
def get_project_user_stories(request, project_id):
    """
    Get all user stories for a specific project
    """
    try:
        # Check if project exists
        project = Project.objects.get(project_id=project_id)
        
        user_stories = UserStory.objects.filter(project=project).select_related('project')
        
        status_filter = request.GET.get('status')
        priority_filter = request.GET.get('priority')
        
        if status_filter:
            user_stories = user_stories.filter(status=status_filter)
        if priority_filter:
            user_stories = user_stories.filter(priority=priority_filter)
        
        data = serialize_user_story_list(user_stories)
        
        return JsonResponse({
            'success': True,
            'data': data,
            'count': len(data),
            'project': {
                'project_id': project.project_id,
                'title': project.title
            }
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

@api_view(['GET'])
def get_user_stories_by_status(request, status):
    """
    Get user stories by status
    """
    try:
        valid_statuses = [choice[0] for choice in UserStory.STATUS_CHOICES]
        if status not in valid_statuses:
            return JsonResponse({
                'success': False,
                'error': f'Invalid status. Valid options: {", ".join(valid_statuses)}'
            }, status=400)
        
        user_stories = UserStory.objects.filter(status=status).select_related('project')
        data = serialize_user_story_list(user_stories)
        
        return JsonResponse({
            'success': True,
            'data': data,
            'count': len(data),
            'status': status
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def get_user_stories_by_priority(request, priority):
    """
    Get user stories by priority
    """
    try:
        valid_priorities = [choice[0] for choice in UserStory.PRIORITY_CHOICES]
        if priority not in valid_priorities:
            return JsonResponse({
                'success': False,
                'error': f'Invalid priority. Valid options: {", ".join(valid_priorities)}'
            }, status=400)
        
        user_stories = UserStory.objects.filter(priority=priority).select_related('project')
        data = serialize_user_story_list(user_stories)
        
        return JsonResponse({
            'success': True,
            'data': data,
            'count': len(data),
            'priority': priority
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    
@api_view(['POST'])
def generate_user_stories(request, project_id):
    """
    Generate user stories automatically for a project using AI
    POST /api/projects/{project_id}/generate-user-stories/
    """
    try:
        project = Project.objects.get(project_id=project_id)
        
        # Check if project has basic info
        if not project.title:
            return JsonResponse({
                'success': False,
                'error': 'Project title is required to generate user stories'
            }, status=400)
        
        # Initialize generator
        from stories.utils.user_story_generator import UserStoryGenerator
        generator = UserStoryGenerator()
        
        # Generate stories
        created_stories = generator.generate_user_stories_for_project(project)
        
        # Serialize results
        from stories.serializers.user_story_serializer import serialize_user_story_list
        stories_data = serialize_user_story_list(created_stories)
        
        return JsonResponse({
            'success': True,
            'message': f'Successfully generated {len(created_stories)} user stories',
            'data': stories_data,
            'count': len(created_stories),
            'generated_by_ai': True
        }, status=201)
        
    except Project.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Project not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to generate user stories: {str(e)}'
        }, status=500)