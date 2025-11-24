from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
import json
from stories.utils.decorators import api_view
from stories.models import Project, CustomUser
from django.views.decorators.csrf import csrf_exempt
from stories.decorators.jwt_decorator import jwt_token
from stories.models import Project, UserStory, Wireframe, Scenario
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
        
def add_cors_headers(response):
    """Helper to add CORS headers to response"""
    response["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    response["Access-Control-Allow-Credentials"] = "true"
    return response

@api_view(['GET'])
@jwt_token
def get_projects(request):
    """
    Get all projects for the authenticated user
    GET /api/projects/
    """
    try:
        # Handle OPTIONS request for CORS preflight
        if request.method == "OPTIONS":
            response = HttpResponse()
            response["Access-Control-Allow-Origin"] = "http://localhost:5173"
            response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response["Access-Control-Allow-Credentials"] = "true"
            return response
        
        # Filter by authenticated user
        projects = Project.objects.filter(user=request.user)
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
@jwt_token
def get_project(request, project_id):
    """
    Get specific project by ID
    GET /api/projects/{project_id}/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id, user=request.user)
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
@jwt_token
def create_project(request):
    """
    Create new project
    POST /api/projects/create/
    """
    try:
        # Get authenticated user from JWT token
        user = request.user
        
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
@jwt_token
def update_project(request, project_id):
    """
    Update project
    PUT /api/projects/{project_id}/update/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id, user=request.user)
        
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
@jwt_token
def delete_project(request, project_id):
    """
    Delete project
    DELETE /api/projects/{project_id}/delete/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id, user=request.user)
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
@jwt_token
def get_project_stats(request, project_id):
    """
    Get project statistics
    GET /api/projects/{project_id}/stats/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id, user=request.user)
        
        # Get actual counts from database
        user_stories_count = UserStory.objects.filter(project=project).count()
        wireframes_count = Wireframe.objects.filter(project=project).count()
        scenarios_count = Scenario.objects.filter(project=project).count()
        
        stats = {
            'user_stories_count': user_stories_count,
            'wireframes_count': wireframes_count,
            'scenarios_count': scenarios_count,
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

@csrf_exempt
@jwt_token
def get_projects_history(request):
    """
    Get all projects for the authenticated user with JWT protection
    GET /api/history/projects/
    """
    try:
        # Filter projects by authenticated user (from JWT token)
        projects = Project.objects.filter(user=request.user).order_by('-created_date')
        
        # Prepare simple projects data
        projects_data = []
        for project in projects:
            # Get actual counts from database
            user_stories_count = UserStory.objects.filter(project=project).count()
            wireframes_count = Wireframe.objects.filter(project=project).count()
            scenarios_count = Scenario.objects.filter(project=project).count()
            
            project_data = {
                'project_id': project.project_id,
                'title': project.title,
                'objective': project.objective,
                'status': project.status,
                'domain': project.domain,
                'language': project.language,
                'created_date': project.created_date,
                'last_modified': project.last_modified,
                'user_stories_count': user_stories_count,
                'wireframes_count': wireframes_count,
                'scenarios_count': scenarios_count
            }
            projects_data.append(project_data)

        response = JsonResponse({
            'success': True,
            'message': 'Projects retrieved successfully',
            'data': projects_data,
            'count': len(projects_data),
            'user': request.user.username
        })

        response = add_cors_headers(response)
        return response
        
    except Exception as e:
        print(f"Error in get_projects_history: {str(e)}")  # Debug logging
        response = JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
        response = add_cors_headers(response)
        return response