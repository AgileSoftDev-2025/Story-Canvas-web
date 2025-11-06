from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from stories.utils.decorators import api_view
from stories.models import Project
# Ganti import ini
from stories.serializers.user_story_scenario_serializers import ProjectSerializer

@api_view(['GET'])
def get_projects(request):
    """
    Get all projects
    GET /api/projects/
    """
    try:
        projects = Project.objects.all().order_by('-created_date')
        serializer = ProjectSerializer(projects, many=True)
        
        return JsonResponse({
            'success': True,
            'projects': serializer.data,
            'count': len(serializer.data)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def get_project_detail(request, project_id):
    """
    Get specific project
    GET /api/projects/{project_id}/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        serializer = ProjectSerializer(project)
        
        return JsonResponse({
            'success': True,
            'project': serializer.data
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
def create_project(request):
    """
    Create new project
    POST /api/projects/create/
    """
    try:
        # Note: You'll need to handle user authentication to get the user ID
        # For now, we'll use a default user or get from request
        data = request.data.copy()
        
        # If user is not provided in request, you might want to handle authentication
        # data['user'] = request.user.id  # If using authentication
        
        serializer = ProjectSerializer(data=data)
        
        if serializer.is_valid():
            project = serializer.save()
            return JsonResponse({
                'success': True,
                'message': 'Project created successfully',
                'project': ProjectSerializer(project).data
            }, status=201)
        else:
            return JsonResponse({
                'success': False,
                'error': 'Invalid data',
                'details': serializer.errors
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['PUT'])
def update_project(request, project_id):
    """
    Update project
    PUT /api/projects/{project_id}/update/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        serializer = ProjectSerializer(project, data=request.data, partial=True)
        
        if serializer.is_valid():
            updated_project = serializer.save()
            return JsonResponse({
                'success': True,
                'message': 'Project updated successfully',
                'project': ProjectSerializer(updated_project).data
            }, status=200)
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

@api_view(['DELETE'])
def delete_project(request, project_id):
    """
    Delete project
    DELETE /api/projects/{project_id}/delete/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        project.delete()
        
        return JsonResponse({
            'success': True,
            'message': 'Project deleted successfully'
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