from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from stories.utils.decorators import api_view
from stories.models import Wireframe, Project
from stories.serializers.wireframe_serializers import (
    WireframeSerializer, 
    CreateWireframeSerializer,
    UpdateWireframeSerializer
)

@api_view(['GET'])
def list_wireframes(request, project_id):
    """
    Get all wireframes for a project
    GET /api/projects/{project_id}/wireframes/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        wireframes = Wireframe.objects.filter(project=project)
        
        serializer = WireframeSerializer(wireframes, many=True)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def get_wireframe(request, wireframe_id):
    """
    Get single wireframe
    GET /api/wireframes/{wireframe_id}/
    """
    try:
        wireframe = get_object_or_404(Wireframe, wireframe_id=wireframe_id)
        serializer = WireframeSerializer(wireframe)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
def create_wireframe(request, project_id):
    """
    Create new wireframe
    POST /api/projects/{project_id}/wireframes/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        
        serializer = CreateWireframeSerializer(data=request.data)
        if not serializer.is_valid():
            return JsonResponse({
                'success': False,
                'errors': serializer.errors
            }, status=400)
        
        wireframe = Wireframe.objects.create(
            project=project,
            **serializer.validated_data
        )
        
        response_serializer = WireframeSerializer(wireframe)
        
        return JsonResponse({
            'success': True,
            'data': response_serializer.data,
            'message': 'Wireframe created successfully'
        }, status=201)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['PUT'])
def update_wireframe(request, wireframe_id):
    """
    Update wireframe
    PUT /api/wireframes/{wireframe_id}/
    """
    try:
        wireframe = get_object_or_404(Wireframe, wireframe_id=wireframe_id)
        
        serializer = UpdateWireframeSerializer(data=request.data)
        if not serializer.is_valid():
            return JsonResponse({
                'success': False,
                'errors': serializer.errors
            }, status=400)
        
        for attr, value in serializer.validated_data.items():
            setattr(wireframe, attr, value)
        
        wireframe.version += 1
        wireframe.save()
        
        response_serializer = WireframeSerializer(wireframe)
        
        return JsonResponse({
            'success': True,
            'data': response_serializer.data,
            'message': 'Wireframe updated successfully'
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['DELETE'])
def delete_wireframe(request, wireframe_id):
    """
    Delete wireframe
    DELETE /api/wireframes/{wireframe_id}/
    """
    try:
        wireframe = get_object_or_404(Wireframe, wireframe_id=wireframe_id)
        wireframe.delete()
        
        return JsonResponse({
            'success': True,
            'message': 'Wireframe deleted successfully'
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)