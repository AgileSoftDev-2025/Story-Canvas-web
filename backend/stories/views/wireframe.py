from datetime import timezone
import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from stories.utils.decorators import api_view
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from stories.models import Wireframe, Project

from stories.serializers.wireframe_serializers import (
    WireframeSerializer, 
    CreateWireframeSerializer,
    UpdateWireframeSerializer,
    serialize_wireframe,
    serialize_wireframe_with_project,
    serialize_wireframe_list
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
    
# ============================================================================
# WIREFRAME SYNC ENDPOINTS
# ============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def get_wireframes_for_sync(request, project_id):
    """
    GET /api/projects/{project_id}/wireframes-sync/
    Get all wireframes for a project from database for sync purposes
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Verify project exists
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        # Get wireframes
        wireframes = Wireframe.objects.filter(project=project)
        
        # Apply filters if provided
        page_type = request.GET.get('page_type')
        
        if page_type:
            wireframes = wireframes.filter(page_type=page_type)
        
        # Serialize data
        data = serialize_wireframe_list(wireframes)
        
        return JsonResponse({
            'success': True,
            'data': data,
            'count': len(data),
            'project': {
                'project_id': project.project_id,
                'title': project.title
            }
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def create_wireframe_api(request):
    """
    POST /api/wireframes/create-api/
    Create new wireframe in database from API call
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Parse request data
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['project_id', 'page_name', 'page_type']
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
        
        # Generate wireframe_id if not provided
        wireframe_id = data.get('wireframe_id')
        if not wireframe_id:
            wireframe_id = f"wf_{data['project_id']}_{data['page_name']}_{int(timezone.now().timestamp())}"
        
        # Create wireframe
        wireframe = Wireframe.objects.create(
            wireframe_id=wireframe_id,
            project=project,
            page_name=data['page_name'],
            page_type=data['page_type'],
            description=data.get('description', ''),
            html_content=data.get('html_content', ''),
            creole_content=data.get('creole_content', ''),
            salt_diagram=data.get('salt_diagram', ''),
            generated_with_rag=data.get('generated_with_rag', False),
            wireframe_type=data.get('wireframe_type', 'desktop'),
            version=data.get('version', 1),
            preview_url=data.get('preview_url', ''),
            stories_count=data.get('stories_count', 0),
            features_count=data.get('features_count', 0),
            is_local=data.get('is_local', False)
        )
        
        # Serialize response
        return JsonResponse({
            'success': True,
            'data': serialize_wireframe_with_project(wireframe),
            'message': 'Wireframe created successfully'
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
        }, status=500)

@csrf_exempt
@require_http_methods(["PUT"])
def update_wireframe_api(request, wireframe_id):
    """
    PUT /api/wireframes/update-api/{wireframe_id}/
    Update wireframe in database from API call
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Check if wireframe exists
        try:
            wireframe = Wireframe.objects.get(wireframe_id=wireframe_id)
        except Wireframe.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Wireframe not found'
            }, status=404)
        
        # Parse request data
        data = json.loads(request.body)
        
        # Update allowed fields
        update_fields = [
            'page_name', 'page_type', 'description', 'html_content',
            'creole_content', 'salt_diagram', 'generated_with_rag',
            'wireframe_type', 'version', 'preview_url', 'stories_count',
            'features_count', 'is_local'
        ]
        
        for field in update_fields:
            if field in data:
                setattr(wireframe, field, data[field])
        
        wireframe.save()
        
        # Serialize response
        return JsonResponse({
            'success': True,
            'data': serialize_wireframe_with_project(wireframe),
            'message': 'Wireframe updated successfully'
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def bulk_sync_wireframes(request):
    """
    POST /api/wireframes/bulk-sync/
    Bulk sync wireframes between local and database
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Parse request data
        data = json.loads(request.body)
        
        project_id = data.get('project_id')
        if not project_id:
            return JsonResponse({
                'success': False,
                'error': 'project_id is required'
            }, status=400)
        
        # Check if project exists
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        operation = data.get('operation', 'pull')  # 'pull' or 'push'
        wireframes = data.get('wireframes', [])
        
        if operation == 'push':
            # Push local wireframes to database
            created_count = 0
            updated_count = 0
            errors = []
            
            for wf_data in wireframes:
                wireframe_id = wf_data.get('wireframe_id')
                
                try:
                    # Try to update existing wireframe
                    wireframe = Wireframe.objects.get(wireframe_id=wireframe_id, project=project)
                    
                    # Update fields
                    update_fields = [
                        'page_name', 'page_type', 'description', 'html_content',
                        'creole_content', 'salt_diagram', 'generated_with_rag',
                        'wireframe_type', 'version', 'preview_url', 'stories_count',
                        'features_count', 'is_local'
                    ]
                    
                    for field in update_fields:
                        if field in wf_data:
                            setattr(wireframe, field, wf_data[field])
                    
                    wireframe.save()
                    updated_count += 1
                    
                except Wireframe.DoesNotExist:
                    # Create new wireframe
                    try:
                        Wireframe.objects.create(
                            wireframe_id=wireframe_id,
                            project=project,
                            page_name=wf_data.get('page_name', ''),
                            page_type=wf_data.get('page_type', 'general'),
                            description=wf_data.get('description', ''),
                            html_content=wf_data.get('html_content', ''),
                            creole_content=wf_data.get('creole_content', ''),
                            salt_diagram=wf_data.get('salt_diagram', ''),
                            generated_with_rag=wf_data.get('generated_with_rag', False),
                            wireframe_type=wf_data.get('wireframe_type', 'desktop'),
                            version=wf_data.get('version', 1),
                            preview_url=wf_data.get('preview_url', ''),
                            stories_count=wf_data.get('stories_count', 0),
                            features_count=wf_data.get('features_count', 0),
                            is_local=wf_data.get('is_local', False)
                        )
                        created_count += 1
                    except Exception as e:
                        errors.append(f"Failed to create wireframe {wireframe_id}: {str(e)}")
            
            return JsonResponse({
                'success': True,
                'message': f'Successfully pushed {len(wireframes)} wireframes to database',
                'stats': {
                    'created': created_count,
                    'updated': updated_count,
                    'total': len(wireframes),
                    'errors': len(errors)
                },
                'errors': errors if errors else None
            }, status=200)
        
        else:  # pull - get wireframes from database
            # Get all wireframes for the project
            wireframes = Wireframe.objects.filter(project=project)
            
            # Apply filters if provided
            page_type = data.get('page_type')
            
            if page_type:
                wireframes = wireframes.filter(page_type=page_type)
            
            # Serialize data
            wireframes_data = serialize_wireframe_list(wireframes)
            
            return JsonResponse({
                'success': True,
                'data': wireframes_data,
                'count': len(wireframes_data),
                'message': f'Successfully pulled {len(wireframes_data)} wireframes from database'
            }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def sync_wireframes(request, project_id):
    """
    POST /api/projects/{project_id}/sync-wireframes/
    Two-way sync wireframes between local and database
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Parse request data
        data = json.loads(request.body)
        local_wireframes = data.get('local_wireframes', [])
        
        # Check if project exists
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        # Get database wireframes
        db_wireframes = Wireframe.objects.filter(project=project)
        db_wireframes_dict = {wf.wireframe_id: wf for wf in db_wireframes}
        
        # Get local wireframes dict
        local_wireframes_dict = {wf.get('wireframe_id'): wf for wf in local_wireframes}
        
        # Strategy: Use newest version for each wireframe
        created_count = 0
        updated_count = 0
        merged_wireframes = []
        
        all_wireframe_ids = set(list(db_wireframes_dict.keys()) + list(local_wireframes_dict.keys()))
        
        for wireframe_id in all_wireframe_ids:
            db_wireframe = db_wireframes_dict.get(wireframe_id)
            local_wireframe = local_wireframes_dict.get(wireframe_id)
            
            if db_wireframe and local_wireframe:
                # Both exist - use the newest version
                db_updated = db_wireframe.updated_at
                local_updated = local_wireframe.get('updated_at')
                
                if local_updated:
                    try:
                        # Parse local timestamp
                        from datetime import datetime
                        local_dt = datetime.fromisoformat(local_updated.replace('Z', '+00:00'))
                        
                        if local_dt > db_updated:
                            # Local is newer, update database
                            update_fields = [
                                'page_name', 'page_type', 'description', 'html_content',
                                'creole_content', 'salt_diagram', 'generated_with_rag',
                                'wireframe_type', 'version', 'preview_url', 'stories_count',
                                'features_count', 'is_local'
                            ]
                            
                            for field in update_fields:
                                if field in local_wireframe:
                                    setattr(db_wireframe, field, local_wireframe[field])
                            
                            db_wireframe.save()
                            updated_count += 1
                            merged_wireframes.append(serialize_wireframe(db_wireframe))
                        else:
                            # Database is newer, use database version
                            merged_wireframes.append(serialize_wireframe(db_wireframe))
                    except:
                        # If parsing fails, use database version
                        merged_wireframes.append(serialize_wireframe(db_wireframe))
                else:
                    # No local timestamp, use database
                    merged_wireframes.append(serialize_wireframe(db_wireframe))
            
            elif db_wireframe and not local_wireframe:
                # Only exists in database
                merged_wireframes.append(serialize_wireframe(db_wireframe))
            
            elif not db_wireframe and local_wireframe:
                # Only exists locally, create in database
                try:
                    new_wireframe = Wireframe.objects.create(
                        wireframe_id=wireframe_id,
                        project=project,
                        page_name=local_wireframe.get('page_name', ''),
                        page_type=local_wireframe.get('page_type', 'general'),
                        description=local_wireframe.get('description', ''),
                        html_content=local_wireframe.get('html_content', ''),
                        creole_content=local_wireframe.get('creole_content', ''),
                        salt_diagram=local_wireframe.get('salt_diagram', ''),
                        generated_with_rag=local_wireframe.get('generated_with_rag', False),
                        wireframe_type=local_wireframe.get('wireframe_type', 'desktop'),
                        version=local_wireframe.get('version', 1),
                        preview_url=local_wireframe.get('preview_url', ''),
                        stories_count=local_wireframe.get('stories_count', 0),
                        features_count=local_wireframe.get('features_count', 0),
                        is_local=local_wireframe.get('is_local', False)
                    )
                    created_count += 1
                    merged_wireframes.append(serialize_wireframe(new_wireframe))
                except Exception as e:
                    print(f"Error creating wireframe {wireframe_id}: {e}")
        
        return JsonResponse({
            'success': True,
            'message': f'Sync completed. Created: {created_count}, Updated: {updated_count}',
            'data': merged_wireframes,
            'count': len(merged_wireframes),
            'stats': {
                'created': created_count,
                'updated': updated_count,
                'total': len(merged_wireframes)
            }
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def check_wireframes_exist(request, project_id):
    """
    GET /api/projects/{project_id}/check-wireframes/
    Check if wireframes exist in database for a project
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Check if project exists
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        # Count wireframes in database
        wireframe_count = Wireframe.objects.filter(project=project).count()
        has_wireframes = wireframe_count > 0
        
        # Get latest update time
        latest_wireframe = Wireframe.objects.filter(project=project).order_by('-updated_at').first()
        latest_update = latest_wireframe.updated_at.isoformat() if latest_wireframe else None
        
        return JsonResponse({
            'success': True,
            'exists': has_wireframes,
            'wireframe_count': wireframe_count,
            'latest_update': latest_update,
            'project': {
                'project_id': project.project_id,
                'title': project.title
            }
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_wireframe_sync_status(request, project_id):
    """
    GET /api/projects/{project_id}/wireframe-sync-status/
    Get sync status between local and database for wireframes
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Check if project exists
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        # Get database stats
        db_wireframes_count = Wireframe.objects.filter(project=project).count()
        db_last_update = Wireframe.objects.filter(project=project).order_by('-updated_at').first()
        
        # Get local stats from request query params
        local_count = request.GET.get('local_count', 0)
        local_last_update = request.GET.get('local_last_update')
        
        try:
            local_count = int(local_count)
        except:
            local_count = 0
        
        # Calculate sync status
        is_synced = (db_wireframes_count == local_count) if local_count > 0 else True
        
        return JsonResponse({
            'success': True,
            'sync_status': {
                'is_synced': is_synced,
                'database': {
                    'wireframe_count': db_wireframes_count,
                    'last_updated': db_last_update.updated_at.isoformat() if db_last_update else None
                },
                'local': {
                    'wireframe_count': local_count,
                    'last_updated': local_last_update
                },
                'needs_sync': not is_synced
            }
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)