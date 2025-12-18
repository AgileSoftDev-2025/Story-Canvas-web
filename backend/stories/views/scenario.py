from datetime import timezone
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action, api_view, permission_classes
from stories.models import UserStory, Scenario, Project
from stories.utils.scenario_generator import ScenarioGenerator
import json
from rest_framework.permissions import AllowAny

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
    
    # Add to your Django views.py
@api_view(['GET'])
@permission_classes([AllowAny])
def get_project_scenarios_sync(request, project_id):
    """
    Get all scenarios for a project for sync purposes
    GET /api/projects/{project_id}/scenarios-sync/
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        scenarios = Scenario.objects.filter(project=project)
        
        data = []
        for scenario in scenarios:
            data.append({
                'scenario_id': scenario.scenario_id,
                'project_id': project_id,
                'user_story_id': scenario.user_story.story_id if scenario.user_story else None,
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
            })
        
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

@api_view(['POST'])
@permission_classes([AllowAny])
def sync_project_scenarios(request, project_id):
    """
    Sync scenarios between local and database (two-way sync)
    POST /api/projects/{project_id}/sync-scenarios/
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        data = json.loads(request.body)
        local_scenarios = data.get('local_scenarios', [])
        
        # Merge strategy: database wins on conflict
        db_scenarios = Scenario.objects.filter(project=project)
        db_scenario_ids = set(s.scenario_id for s in db_scenarios)
        
        merged_scenarios = []
        updated_count = 0
        created_count = 0
        
        # Update existing or create new scenarios
        for local_scenario in local_scenarios:
            try:
                scenario_id = local_scenario.get('scenario_id')
                
                if scenario_id in db_scenario_ids:
                    # Update existing scenario
                    scenario = Scenario.objects.get(scenario_id=scenario_id, project=project)
                    
                    # Only update if local is newer (simplified logic)
                    local_updated = local_scenario.get('updated_at')
                    if local_updated:
                        local_time = timezone.datetime.fromisoformat(local_updated.replace('Z', '+00:00'))
                        if scenario.updated_at and local_time > scenario.updated_at:
                            # Update fields
                            scenario.scenario_text = local_scenario.get('scenario_text', scenario.scenario_text)
                            scenario.scenario_type = local_scenario.get('scenario_type', scenario.scenario_type)
                            scenario.title = local_scenario.get('title', scenario.title)
                            scenario.status = local_scenario.get('status', scenario.status)
                            scenario.save()
                            updated_count += 1
                else:
                    # Create new scenario
                    user_story = None
                    user_story_id = local_scenario.get('user_story_id')
                    if user_story_id:
                        try:
                            user_story = UserStory.objects.get(story_id=user_story_id, project=project)
                        except UserStory.DoesNotExist:
                            pass
                    
                    Scenario.objects.create(
                        scenario_id=scenario_id,
                        project=project,
                        user_story=user_story,
                        scenario_text=local_scenario.get('scenario_text', ''),
                        scenario_type=local_scenario.get('scenario_type', 'happy_path'),
                        title=local_scenario.get('title', 'Scenario'),
                        detected_domain=local_scenario.get('detected_domain', 'general'),
                        has_proper_structure=local_scenario.get('has_proper_structure', True),
                        gherkin_steps=local_scenario.get('gherkin_steps', []),
                        enhanced_with_llm=local_scenario.get('enhanced_with_llm', False),
                        status=local_scenario.get('status', 'draft')
                    )
                    created_count += 1
                
                merged_scenarios.append(local_scenario)
                
            except Exception as e:
                print(f"Error syncing scenario {local_scenario.get('scenario_id')}: {e}")
                continue
        
        # Get all scenarios for response (including database ones not in local)
        all_scenarios = Scenario.objects.filter(project=project)
        response_data = []
        for scenario in all_scenarios:
            response_data.append({
                'scenario_id': scenario.scenario_id,
                'project_id': project_id,
                'user_story_id': scenario.user_story.story_id if scenario.user_story else None,
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
            })
        
        return JsonResponse({
            'success': True,
            'message': f'Synced {updated_count + created_count} scenarios (updated: {updated_count}, created: {created_count})',
            'data': response_data,
            'stats': {
                'total': len(response_data),
                'updated': updated_count,
                'created': created_count
            }
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def check_scenarios_exist(request, project_id):
    """
    Check if scenarios exist in database for a project
    GET /api/projects/{project_id}/check-scenarios/
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        scenario_count = Scenario.objects.filter(project=project).count()
        
        return JsonResponse({
            'success': True,
            'exists': scenario_count > 0,
            'scenario_count': scenario_count,
            'message': f'Found {scenario_count} scenarios in database'
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_scenario_sync_status(request, project_id):
    """
    Get sync status between local and database scenarios
    GET /api/projects/{project_id}/scenario-sync-status/
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Project not found'
            }, status=404)
        
        # Get local info from query params
        local_count = int(request.GET.get('local_count', 0))
        local_last_update = request.GET.get('local_last_update')
        
        # Get database info
        db_scenarios = Scenario.objects.filter(project=project)
        db_count = db_scenarios.count()
        
        # Get latest update from database
        latest_scenario = db_scenarios.order_by('-updated_at').first()
        db_last_update = latest_scenario.updated_at.isoformat() if latest_scenario and latest_scenario.updated_at else None
        
        # Simple sync logic: check if counts match
        is_synced = local_count == db_count
        
        # Check if local is up to date with database
        needs_sync = not is_synced
        
        # If we have timestamps, check if local is older than database
        if local_last_update and db_last_update:
            try:
                local_time = timezone.datetime.fromisoformat(local_last_update.replace('Z', '+00:00'))
                db_time = timezone.datetime.fromisoformat(db_last_update.replace('Z', '+00:00'))
                if db_time > local_time:
                    needs_sync = True
            except:
                pass
        
        sync_status = {
            'is_synced': is_synced,
            'needs_sync': needs_sync,
            'database': {
                'scenario_count': db_count,
                'last_updated': db_last_update
            },
            'local': {
                'scenario_count': local_count,
                'last_updated': local_last_update
            }
        }
        
        return JsonResponse({
            'success': True,
            'sync_status': sync_status,
            'message': 'Sync status retrieved'
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    
# In views.py, add this function
@api_view(['GET'])
@permission_classes([AllowAny])
def check_scenario_exists(request, scenario_id):
    """
    Check if a scenario exists - FIXED VERSION
    """
    try:
        scenario = Scenario.objects.filter(scenario_id=scenario_id).first()
        return JsonResponse({
            'success': True,
            'exists': scenario is not None,
            'scenario_id': scenario_id
        }, status=200)
    except Exception as e:
        import traceback
        return JsonResponse({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)
    
@api_view(['PUT'])
@permission_classes([AllowAny])
def update_scenario_detailed(request, scenario_id):
    """Update an existing scenario - FIXED VERSION"""
    print(f"🔍 DEBUG: update_scenario_detailed called with scenario_id: {scenario_id}")
    print(f"🔍 DEBUG: Request method: {request.method}")
    print(f"🔍 DEBUG: Request headers: {dict(request.headers)}")
    
    try:
        # Try to get scenario by custom ID (string)
        scenario = Scenario.objects.filter(scenario_id=scenario_id).first()
        
        print(f"🔍 DEBUG: Found scenario: {scenario}")
        
        if not scenario:
            print(f"🔍 DEBUG: Scenario {scenario_id} not found in database")
            return JsonResponse({
                'success': False,
                'error': f'Scenario {scenario_id} not found'
            }, status=404)
        
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
        import traceback
        return JsonResponse({
            'success': False, 
            'error': str(e),
            'traceback': traceback.format_exc()  # Add this for debugging
        }, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def create_scenario_sync(request):
    """Create scenario - for sync service"""
    try:
        data = json.loads(request.body)
        
        # Get project
        project = Project.objects.get(project_id=data.get('project_id'))
        
        # Get user story if provided
        user_story = None
        user_story_id = data.get('user_story_id')
        if user_story_id:
            user_story = UserStory.objects.get(story_id=user_story_id, project=project)
        
        # Create scenario
        scenario = Scenario.objects.create(
            scenario_id=data.get('scenario_id'),
            project=project,
            user_story=user_story,
            scenario_text=data.get('scenario_text', ''),
            scenario_type=data.get('scenario_type', 'happy_path'),
            title=data.get('title', 'Scenario'),
            detected_domain=data.get('detected_domain', 'general'),
            has_proper_structure=data.get('has_proper_structure', True),
            gherkin_steps=data.get('gherkin_steps', []),
            enhanced_with_llm=data.get('enhanced_with_llm', False),
            status=data.get('status', 'draft')
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Scenario created',
            'scenario_id': str(scenario.scenario_id)
        }, status=201)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)