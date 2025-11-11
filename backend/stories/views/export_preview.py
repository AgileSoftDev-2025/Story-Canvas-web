from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required
from stories.models import Project, Export
from stories.serializers.export_preview import (
    ExportPreviewSerializer, 
    ProjectExportPreviewSerializer
)
from stories.utils.decorators import api_view

@api_view(['GET'])
@login_required
def preview_export_by_id(request, export_id):
    """
    Preview export data by export ID
    GET /exports/preview/{export_id}/
    """
    try:
        export = get_object_or_404(Export, export_id=export_id)
        
        # Check if user has permission to view this export
        if request.user != export.user:
            return JsonResponse({
                'success': False,
                'error': 'You do not have permission to view this export'
            }, status=403)
        
        serializer = ExportPreviewSerializer(export)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to preview export: {str(e)}'
        }, status=500)

@api_view(['GET'])
@login_required
def preview_project_export(request, project_id):
    """
    Preview export data for a project with configurable options
    GET /projects/{project_id}/export-preview/?include_stories=true&include_wireframes=true&include_scenarios=true
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        
        # Check if user has permission to view this project
        if request.user != project.user:
            return JsonResponse({
                'success': False,
                'error': 'You do not have permission to view this project'
            }, status=403)
        
        # Get query parameters for configuration
        include_stories = request.GET.get('include_stories', 'true').lower() == 'true'
        include_wireframes = request.GET.get('include_wireframes', 'true').lower() == 'true'
        include_scenarios = request.GET.get('include_scenarios', 'true').lower() == 'true'
        export_format = request.GET.get('format', 'html')
        
        # Prepare data for serializer
        preview_data = {
            'project_id': project.project_id,
            'title': project.title,
            'domain': project.domain,
            'objective': project.objective,
            'export_config': {
                'include_stories': include_stories,
                'include_wireframes': include_wireframes,
                'include_scenarios': include_scenarios,
                'format': export_format
            }
        }
        
        # Get related data based on configuration
        if include_stories:
            preview_data['user_stories'] = project.user_stories.all()
        else:
            preview_data['user_stories'] = []
            
        if include_wireframes:
            preview_data['wireframes'] = project.wireframes.all()
        else:
            preview_data['wireframes'] = []
            
        if include_scenarios:
            preview_data['scenarios'] = project.scenarios.all()
        else:
            preview_data['scenarios'] = []
        
        serializer = ProjectExportPreviewSerializer(preview_data)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data,
            'config': {
                'include_stories': include_stories,
                'include_wireframes': include_wireframes,
                'include_scenarios': include_scenarios,
                'format': export_format
            }
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to preview project export: {str(e)}'
        }, status=500)

@api_view(['POST'])
@login_required
def generate_export_preview(request, project_id):
    """
    Generate export preview with custom configuration
    POST /projects/{project_id}/generate-export-preview/
    """
    try:
        project = get_object_or_404(Project, project_id=project_id)
        
        # Check if user has permission to view this project
        if request.user != project.user:
            return JsonResponse({
                'success': False,
                'error': 'You do not have permission to view this project'
            }, status=403)
        
        # Get configuration from request body
        config = request.data.get('config', {})
        
        include_stories = config.get('include_stories', True)
        include_wireframes = config.get('include_wireframes', True)
        include_scenarios = config.get('include_scenarios', True)
        export_format = config.get('format', 'html')
        theme = config.get('theme', 'modern')
        sections = config.get('sections', ['stories', 'wireframes', 'scenarios'])
        
        # Prepare preview data
        preview_data = {
            'project_id': project.project_id,
            'title': project.title,
            'domain': project.domain,
            'objective': project.objective,
            'scope': project.scope,
            'flow': project.flow,
            'export_config': {
                'include_stories': include_stories,
                'include_wireframes': include_wireframes,
                'include_scenarios': include_scenarios,
                'format': export_format,
                'theme': theme,
                'sections': sections
            }
        }
        
        # Get filtered data based on configuration
        if include_stories:
            stories = project.user_stories.all()
            # Apply filters if provided
            status_filter = config.get('story_status')
            if status_filter:
                stories = stories.filter(status=status_filter)
            preview_data['user_stories'] = stories
        else:
            preview_data['user_stories'] = []
            
        if include_wireframes:
            wireframes = project.wireframes.all()
            page_type_filter = config.get('page_type')
            if page_type_filter:
                wireframes = wireframes.filter(page_type=page_type_filter)
            preview_data['wireframes'] = wireframes
        else:
            preview_data['wireframes'] = []
            
        if include_scenarios:
            scenarios = project.scenarios.all()
            scenario_type_filter = config.get('scenario_type')
            if scenario_type_filter:
                scenarios = scenarios.filter(scenario_type=scenario_type_filter)
            preview_data['scenarios'] = scenarios
        else:
            preview_data['scenarios'] = []
        
        serializer = ProjectExportPreviewSerializer(preview_data)
        
        # Calculate estimated file size
        estimated_size = calculate_estimated_size(serializer.data, export_format)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data,
            'preview_info': {
                'estimated_file_size': estimated_size,
                'export_format': export_format,
                'item_counts': {
                    'stories': len(preview_data['user_stories']),
                    'wireframes': len(preview_data['wireframes']),
                    'scenarios': len(preview_data['scenarios'])
                },
                'config': config
            }
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to generate export preview: {str(e)}'
        }, status=500)

@api_view(['GET'])
@login_required
def list_user_exports(request):
    """
    List all exports for the current user with preview information
    GET /exports/my-exports/
    """
    try:
        # Pastikan user sudah login dan bukan AnonymousUser
        if not request.user.is_authenticated:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=401)
        
        exports = Export.objects.filter(user=request.user).order_by('-exported_at')
        
        serializer = ExportPreviewSerializer(exports, many=True)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data,
            'count': len(exports)
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to list exports: {str(e)}'
        }, status=500)

def calculate_estimated_size(data, export_format):
    """
    Calculate estimated file size based on data and format
    """
    import json
    
    # Convert data to string representation based on format
    if export_format == 'json':
        content = json.dumps(data, indent=2)
    elif export_format == 'html':
        # Simple HTML template size estimation
        content = f"""
        <!DOCTYPE html>
        <html>
        <head><title>{data.get('title', 'Export')}</title></head>
        <body>
            <h1>{data.get('title', 'Export')}</h1>
            <!-- Content would be generated here -->
        </body>
        </html>
        """
    else:
        # Default estimation
        content = str(data)
    
    return len(content.encode('utf-8'))