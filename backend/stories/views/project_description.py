from django.http import JsonResponse
from django.shortcuts import get_object_or_404
import json
from stories.utils.decorators import api_view
from stories.models import Project, CustomUser
from stories.serializers.project_description import ProjectDescriptionSerializer, ProjectCreateSerializer

def get_request_data(request):
    """Helper function to get data from request based on method"""
    if request.method == 'GET':
        return request.GET.dict()
    else:
        try:
            return json.loads(request.body)
        except json.JSONDecodeError:
            return {}

@api_view(['GET'])
def get_projects(request):
    """
    Get all projects for the authenticated user
    GET /api/projects/
    """
    try:
        # For now, get all projects. Later we'll filter by authenticated user
        projects = Project.objects.all()
        serializer = ProjectDescriptionSerializer(projects, many=True)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data,
            'count': len(serializer.data)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def get_project(request, project_id):
    """
    Get specific project by ID
    GET /api/projects/{project_id}/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        serializer = ProjectDescriptionSerializer(project)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data
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
        # TODO: Get authenticated user once authentication is implemented
        # For now, use the first user or handle user assignment differently
        user = CustomUser.objects.first()
        
        if not user:
            return JsonResponse({
                'success': False,
                'error': 'No user available. Please create a user first.'
            }, status=400)
        
        # Get data from request body
        data = get_request_data(request)
        
        serializer = ProjectCreateSerializer(data=data)
        
        if serializer.is_valid():
            project = serializer.save(user=user)
            
            return JsonResponse({
                'success': True,
                'message': 'Project created successfully',
                'data': ProjectDescriptionSerializer(project).data
            }, status=201)
        else:
            return JsonResponse({
                'success': False,
                'error': 'Validation failed',
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
        
        # Get data from request body
        data = get_request_data(request)
        
        serializer = ProjectDescriptionSerializer(
            project, 
            data=data, 
            partial=True
        )
        
        if serializer.is_valid():
            updated_project = serializer.save()
            
            return JsonResponse({
                'success': True,
                'message': 'Project updated successfully',
                'data': ProjectDescriptionSerializer(updated_project).data
            }, status=200)
        else:
            return JsonResponse({
                'success': False,
                'error': 'Validation failed',
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
        project_title = project.title
        project.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'Project "{project_title}" deleted successfully'
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
def get_project_stats(request, project_id):
    """
    Get project statistics
    GET /api/projects/{project_id}/stats/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        
        stats = {
            'user_stories_count': project.user_stories_count,
            'wireframes_count': project.wireframes_count,
            'scenarios_count': project.scenarios_count,
            'status': project.status,
            'created_date': project.created_date,
            'last_modified': project.last_modified
        }
        
        return JsonResponse({
            'success': True,
            'data': stats
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