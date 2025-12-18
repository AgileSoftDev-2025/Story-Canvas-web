import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from stories.utils.decorators import api_view
from stories.models import UserStory, Project
from stories.serializers.user_story_serializer import (
    serialize_user_story, 
    serialize_user_story_with_project, 
    serialize_user_story_list
)

# ============================================================================
# EXISTING ENDPOINTS
# ============================================================================

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

# ============================================================================
# NEW ENDPOINTS FOR DATABASE SYNC
# ============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def get_user_stories_for_sync(request, project_id):
    """
    GET /api/projects/{project_id}/user-stories-sync/
    Get all user stories for a project from database for sync purposes
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
        
        # Get user stories
        user_stories = UserStory.objects.filter(project=project)
        
        # Apply filters if provided
        status = request.GET.get('status')
        priority = request.GET.get('priority')
        
        if status:
            user_stories = user_stories.filter(status=status)
        if priority:
            user_stories = user_stories.filter(priority=priority)
        
        # Serialize data
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
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def create_user_story_api(request):
    """
    POST /api/user-stories/create/
    Create new user story in database from API call
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
        required_fields = ['project_id', 'story_text', 'role']
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
        
        # Create user story
        user_story = UserStory.objects.create(
            project=project,
            story_text=data.get('story_text', ''),
            role=data.get('role', 'User'),
            action=data.get('action', ''),
            benefit=data.get('benefit', ''),
            feature=data.get('feature', 'General'),
            acceptance_criteria=data.get('acceptance_criteria', []),
            priority=data.get('priority', 'medium'),
            story_points=data.get('story_points', 0),
            status=data.get('status', 'draft'),
            generated_by_llm=data.get('generated_by_llm', False),
            iteration=data.get('iteration', 1)
        )
        
        return JsonResponse({
            'success': True,
            'data': serialize_user_story_with_project(user_story),
            'message': 'User story created successfully'
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
def update_user_story_api(request, story_id):
    """
    PUT /api/user-stories/update/{story_id}/
    Update user story in database from API call
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Check if story exists
        try:
            user_story = UserStory.objects.get(story_id=story_id)
        except UserStory.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'User story not found'
            }, status=404)
        
        # Parse request data
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
            'data': serialize_user_story_with_project(user_story),
            'message': 'User story updated successfully'
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
def bulk_sync_user_stories(request):
    """
    POST /api/user-stories/bulk-sync/
    Bulk sync user stories between local and database
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
        stories = data.get('stories', [])
        
        if operation == 'push':
            # Push local stories to database
            created_count = 0
            updated_count = 0
            errors = []
            
            for story_data in stories:
                story_id = story_data.get('story_id')
                
                try:
                    # Try to update existing story
                    user_story = UserStory.objects.get(story_id=story_id, project=project)
                    
                    # Update fields
                    update_fields = [
                        'story_text', 'role', 'action', 'benefit', 'feature',
                        'acceptance_criteria', 'priority', 'story_points', 'status',
                        'generated_by_llm', 'iteration'
                    ]
                    
                    for field in update_fields:
                        if field in story_data:
                            setattr(user_story, field, story_data[field])
                    
                    user_story.save()
                    updated_count += 1
                    
                except UserStory.DoesNotExist:
                    # Create new story
                    try:
                        UserStory.objects.create(
                            story_id=story_id,
                            project=project,
                            story_text=story_data.get('story_text', ''),
                            role=story_data.get('role', 'User'),
                            action=story_data.get('action', ''),
                            benefit=story_data.get('benefit', ''),
                            feature=story_data.get('feature', 'General'),
                            acceptance_criteria=story_data.get('acceptance_criteria', []),
                            priority=story_data.get('priority', 'medium'),
                            story_points=story_data.get('story_points', 0),
                            status=story_data.get('status', 'draft'),
                            generated_by_llm=story_data.get('generated_by_llm', False),
                            iteration=story_data.get('iteration', 1)
                        )
                        created_count += 1
                    except Exception as e:
                        errors.append(f"Failed to create story {story_id}: {str(e)}")
            
            return JsonResponse({
                'success': True,
                'message': f'Successfully pushed {len(stories)} stories to database',
                'stats': {
                    'created': created_count,
                    'updated': updated_count,
                    'total': len(stories),
                    'errors': len(errors)
                },
                'errors': errors if errors else None
            }, status=200)
        
        else:  # pull - get stories from database
            # Get all user stories for the project
            user_stories = UserStory.objects.filter(project=project)
            
            # Apply filters if provided
            status = data.get('status')
            priority = data.get('priority')
            
            if status:
                user_stories = user_stories.filter(status=status)
            if priority:
                user_stories = user_stories.filter(priority=priority)
            
            # Serialize data
            stories_data = serialize_user_story_list(user_stories)
            
            return JsonResponse({
                'success': True,
                'data': stories_data,
                'count': len(stories_data),
                'message': f'Successfully pulled {len(stories_data)} stories from database'
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
def get_sync_status(request, project_id):
    """
    GET /api/projects/{project_id}/sync-status/
    Get sync status between local and database
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
        db_stories_count = UserStory.objects.filter(project=project).count()
        db_last_update = UserStory.objects.filter(project=project).order_by('-updated_at').first()
        
        # Get local stats from request query params
        local_count = request.GET.get('local_count', 0)
        local_last_update = request.GET.get('local_last_update')
        
        try:
            local_count = int(local_count)
        except:
            local_count = 0
        
        # Calculate sync status
        is_synced = (db_stories_count == local_count) if local_count > 0 else True
        
        return JsonResponse({
            'success': True,
            'sync_status': {
                'is_synced': is_synced,
                'database': {
                    'story_count': db_stories_count,
                    'last_updated': db_last_update.updated_at.isoformat() if db_last_update else None
                },
                'local': {
                    'story_count': local_count,
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

@csrf_exempt
@require_http_methods(["POST"])
def sync_user_stories(request, project_id):
    """
    POST /api/projects/{project_id}/sync-user-stories/
    Two-way sync user stories between local and database
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
        local_stories = data.get('local_stories', [])
        
        # Check if project exists
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        # Get database stories
        db_stories = UserStory.objects.filter(project=project)
        db_stories_dict = {story.story_id: story for story in db_stories}
        
        # Get local stories dict
        local_stories_dict = {story.get('story_id'): story for story in local_stories}
        
        # Strategy: Use newest version for each story
        created_count = 0
        updated_count = 0
        merged_stories = []
        
        all_story_ids = set(list(db_stories_dict.keys()) + list(local_stories_dict.keys()))
        
        for story_id in all_story_ids:
            db_story = db_stories_dict.get(story_id)
            local_story = local_stories_dict.get(story_id)
            
            if db_story and local_story:
                # Both exist - use the newest version
                db_updated = db_story.updated_at
                local_updated = local_story.get('updated_at')
                
                if local_updated:
                    try:
                        # Parse local timestamp
                        from datetime import datetime
                        local_dt = datetime.fromisoformat(local_updated.replace('Z', '+00:00'))
                        
                        if local_dt > db_updated:
                            # Local is newer, update database
                            update_fields = [
                                'story_text', 'role', 'action', 'benefit', 'feature',
                                'acceptance_criteria', 'priority', 'story_points', 'status',
                                'generated_by_llm', 'iteration'
                            ]
                            
                            for field in update_fields:
                                if field in local_story:
                                    setattr(db_story, field, local_story[field])
                            
                            db_story.save()
                            updated_count += 1
                            merged_stories.append(serialize_user_story(db_story))
                        else:
                            # Database is newer, use database version
                            merged_stories.append(serialize_user_story(db_story))
                    except:
                        # If parsing fails, use database version
                        merged_stories.append(serialize_user_story(db_story))
                else:
                    # No local timestamp, use database
                    merged_stories.append(serialize_user_story(db_story))
            
            elif db_story and not local_story:
                # Only exists in database
                merged_stories.append(serialize_user_story(db_story))
            
            elif not db_story and local_story:
                # Only exists locally, create in database
                try:
                    new_story = UserStory.objects.create(
                        story_id=story_id,
                        project=project,
                        story_text=local_story.get('story_text', ''),
                        role=local_story.get('role', 'User'),
                        action=local_story.get('action', ''),
                        benefit=local_story.get('benefit', ''),
                        feature=local_story.get('feature', 'General'),
                        acceptance_criteria=local_story.get('acceptance_criteria', []),
                        priority=local_story.get('priority', 'medium'),
                        story_points=local_story.get('story_points', 0),
                        status=local_story.get('status', 'draft'),
                        generated_by_llm=local_story.get('generated_by_llm', False),
                        iteration=local_story.get('iteration', 1)
                    )
                    created_count += 1
                    merged_stories.append(serialize_user_story(new_story))
                except Exception as e:
                    print(f"Error creating story {story_id}: {e}")
        
        return JsonResponse({
            'success': True,
            'message': f'Sync completed. Created: {created_count}, Updated: {updated_count}',
            'data': merged_stories,
            'count': len(merged_stories),
            'stats': {
                'created': created_count,
                'updated': updated_count,
                'total': len(merged_stories)
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
def check_user_stories_exist(request, project_id):
    """
    GET /api/projects/{project_id}/check-user-stories/
    Check if user stories exist in database for a project
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
        
        # Count stories in database
        story_count = UserStory.objects.filter(project=project).count()
        has_stories = story_count > 0
        
        # Get latest update time
        latest_story = UserStory.objects.filter(project=project).order_by('-updated_at').first()
        latest_update = latest_story.updated_at.isoformat() if latest_story else None
        
        return JsonResponse({
            'success': True,
            'exists': has_stories,
            'story_count': story_count,
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

# ============================================================================
# COMPATIBILITY ENDPOINTS
# ============================================================================

@api_view(['POST'])
def generate_user_stories_for_local_project(request):
    """
    Generate user stories for local (non-database) projects
    POST /api/local-projects/generate-user-stories/
    """
    try:
        # Get project data from request body (not from database)
        data = json.loads(request.body)
        project_data = data.get('project_data')
        
        if not project_data:
            return JsonResponse({
                'success': False,
                'error': 'Project data required'
            }, status=400)
        
        # Use your existing UserStoryGenerator
        from stories.utils.user_story_generator import UserStoryGenerator
        generator = UserStoryGenerator()
        
        # Prepare project info
        project_info = {
            'title': project_data.get('title', 'Local Project'),
            'objective': project_data.get('objective', ''),
            'users': project_data.get('users', []),
            'features': project_data.get('features', []),
            'scope': project_data.get('scope', ''),
            'flow': project_data.get('flow', ''),
            'additional_info': project_data.get('additional_info', '')
        }
        
        # Analyze project
        project_description = generator.format_project_description(project_info)
        
        # Use analyze_project_description if available, else use simple analysis
        try:
            from stories.utils.project_analyzer import analyze_project_description
            project_analysis = analyze_project_description(project_description)
        except:
            project_analysis = {'domain': 'general'}
        
        # Generate stories (without RAG for local projects)
        stories_data = generator.generate_comprehensive_user_stories(
            project_info, project_analysis, []
        )
        
        # Format response for frontend
        formatted_stories = []
        for i, story_data in enumerate(stories_data):
            formatted_story = {
                'story_id': story_data.get('id', f'US_{i+1:03d}'),
                'project_id': data.get('project_id', 'local_project'),
                'story_text': story_data.get('text', ''),
                'role': story_data.get('role', 'User'),
                'action': generator.extract_action_from_story(story_data.get('text', '')),
                'benefit': generator.extract_benefit_from_story(story_data.get('text', '')),
                'feature': story_data.get('feature', 'General'),
                'acceptance_criteria': story_data.get('acceptance_criteria', []),
                'priority': story_data.get('priority', 'medium'),
                'story_points': 0,
                'status': 'draft',
                'generated_by_llm': True,
                'iteration': 1
            }
            formatted_stories.append(formatted_story)
        
        return JsonResponse({
            'success': True,
            'message': f'Generated {len(formatted_stories)} user stories for local project',
            'stories': formatted_stories,
            'count': len(formatted_stories)
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
    
# stories/views.py - Perbaiki function sync_project_to_local:
@csrf_exempt
@require_http_methods(["GET"])
def sync_project_to_local(request, project_id):
    """
    GET /api/projects/{project_id}/sync-project/
    Sync project from database to localStorage
    """
    try:
        # Check authentication
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        # Get project from database
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found in database'
            }, status=404)
        
        # Format project data for frontend
        project_data = {
            'project_id': project.project_id,
            'title': project.title,
            'objective': project.objective or '',
            'scope': project.scope or '',
            'flow': project.flow or '',
            'additional_info': project.additional_info or '',
            'domain': project.domain or 'general',
            'language': project.language or 'en',
            'users_data': project.users_data or [],
            'features_data': project.features_data or [],
            'nlp_analysis': project.nlp_analysis or {},
            'status': project.status,
            'created_at': project.created_date.isoformat(),  # Perbaikan di sini
            'updated_at': project.last_modified.isoformat(), # Perbaikan di sini
            'is_guest_project': False,
            'user_specific': True
        }
        
        return JsonResponse({
            'success': True,
            'message': 'Project synced from database',
            'project': project_data,
            'source': 'database'
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)