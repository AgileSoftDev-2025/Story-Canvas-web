from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.db.models import Q
import json
import zipfile
import io
from datetime import datetime
from stories.models import Project, Export, UserStory, Wireframe, Scenario
from stories.serializers.export_preview import (
    ExportPreviewSerializer, 
    ProjectExportPreviewSerializer
)
from stories.utils.decorators import api_view


@api_view(['GET'])
def preview_export_by_id(request, export_id):
    try:
        export = get_object_or_404(Export, export_id=export_id)
        
        serializer = ExportPreviewSerializer(export)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to preview export: {str(e)}'
        }, status=500)


@api_view(['GET'])
def preview_project_export(request, project_id):
    try:
        project = get_object_or_404(Project, project_id=project_id)
        
        include_stories = request.GET.get('include_stories', 'true').lower() == 'true'
        include_wireframes = request.GET.get('include_wireframes', 'true').lower() == 'true'
        include_scenarios = request.GET.get('include_scenarios', 'true').lower() == 'true'
        export_format = request.GET.get('format', 'html')
        
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
        
        preview_data['user_stories'] = project.user_stories.all() if include_stories else []
        preview_data['wireframes'] = project.wireframes.all() if include_wireframes else []
        preview_data['scenarios'] = project.scenarios.all() if include_scenarios else []
        
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
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to preview project export: {str(e)}'
        }, status=500)


@api_view(['POST'])
def generate_export_preview(request, project_id):
    try:
        project = get_object_or_404(Project, project_id=project_id)
        
        config = request.data.get('config', {})
        
        include_stories = config.get('include_stories', True)
        include_wireframes = config.get('include_wireframes', True)
        include_scenarios = config.get('include_scenarios', True)
        export_format = config.get('format', 'html')
        theme = config.get('theme', 'modern')
        sections = config.get('sections', ['stories', 'wireframes', 'scenarios'])
        
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
        
        stories = project.user_stories.all()
        wireframes = project.wireframes.all()
        scenarios = project.scenarios.all()
        
        status_filter = config.get('story_status')
        if status_filter:
            stories = stories.filter(status=status_filter)
            
        page_type_filter = config.get('page_type')
        if page_type_filter:
            wireframes = wireframes.filter(page_type=page_type_filter)
            
        scenario_type_filter = config.get('scenario_type')
        if scenario_type_filter:
            scenarios = scenarios.filter(scenario_type=scenario_type_filter)
        
        preview_data['user_stories'] = stories if include_stories else []
        preview_data['wireframes'] = wireframes if include_wireframes else []
        preview_data['scenarios'] = scenarios if include_scenarios else []
        
        serializer = ProjectExportPreviewSerializer(preview_data)
        
        estimated_size = calculate_estimated_size(serializer.data, export_format)
        
        return JsonResponse({
            'success': True,
            'data': serializer.data,
            'preview_info': {
                'estimated_file_size': estimated_size,
                'export_format': export_format,
                'item_counts': {
                    'stories': stories.count() if include_stories else 0,
                    'wireframes': wireframes.count() if include_wireframes else 0,
                    'scenarios': scenarios.count() if include_scenarios else 0
                },
                'config': config
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to generate export preview: {str(e)}'
        }, status=500)


@api_view(['POST'])
def export_project_data(request, project_id):
    try:
        project = get_object_or_404(Project, project_id=project_id)
        
        config = request.data.get('config', {})
        
        include_stories = config.get('include_stories', True)
        include_wireframes = config.get('include_wireframes', True)
        include_scenarios = config.get('include_scenarios', True)
        export_format = config.get('format', 'zip')
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
            project_info = {
                'title': project.title,
                'domain': project.domain,
                'objective': project.objective,
                'scope': project.scope,
                'flow': project.flow,
                'exported_at': datetime.now().isoformat()
            }
            
            zip_file.writestr('project_info.json', json.dumps(project_info, indent=2))
            
            if include_stories:
                stories_content = generate_stories_content(project)
                zip_file.writestr('user_stories.md', stories_content)
            
            if include_wireframes:
                wireframes_content = generate_wireframes_content(project)
                zip_file.writestr('wireframes.md', wireframes_content)
            
            if include_scenarios:
                scenarios_content = generate_scenarios_content(project)
                zip_file.writestr('test_scenarios.feature', scenarios_content)
            
            readme_content = generate_readme_content(project, config)
            zip_file.writestr('README.md', readme_content)
        
        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{project.title.replace(" ", "_")}_export.zip"'
        
        Export.objects.create(
            user=None,
            project=project,
            export_type='ZIP',
            file_name=f"{project.title.replace(' ', '_')}_export.zip",
            config=config
        )
        
        return response
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to export project: {str(e)}'
        }, status=500)


@api_view(['GET'])
def list_user_exports(request):
    try:
        return JsonResponse({
            'success': True,
            'data': [],
            'count': 0
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to list exports: {str(e)}'
        }, status=500)


def calculate_estimated_size(data, export_format):
    if export_format == 'json':
        content = json.dumps(data, indent=2)
    elif export_format == 'html':
        content = f"""
        <!DOCTYPE html>
        <html>
        <head><title>{data.get('title', 'Export')}</title></head>
        <body>
            <h1>{data.get('title', 'Export')}</h1>
        </body>
        </html>
        """
    else:
        content = str(data)
    
    return len(content.encode('utf-8'))


def generate_stories_content(project):
    stories = project.user_stories.all()
    
    content = f"# User Stories - {project.title}\n\n"
    content += f"**Domain:** {project.domain}\n\n"
    
    roles = {}
    for story in stories:
        role = story.role or 'General'
        if role not in roles:
            roles[role] = []
        roles[role].append(story)
    
    for role, role_stories in roles.items():
        content += f"## {role}\n\n"
        for story in role_stories:
            content += f"- **As a {story.role}**, {story.action} **so that** {story.benefit}\n"
            if story.acceptance_criteria:
                content += f"  - Acceptance Criteria: {story.acceptance_criteria}\n"
            if story.priority:
                content += f"  - Priority: {story.priority}\n"
            if story.status:
                content += f"  - Status: {story.status}\n"
            content += "\n"
    
    return content


def generate_wireframes_content(project):
    wireframes = project.wireframes.all()
    
    content = f"# Wireframes - {project.title}\n\n"
    content += f"Total Wireframes: {wireframes.count()}\n\n"
    
    for wireframe in wireframes:
        content += f"## {wireframe.title or 'Untitled Wireframe'}\n\n"
        content += f"- **Page Type:** {wireframe.page_type or 'N/A'}\n"
        content += f"- **Description:** {wireframe.description or 'No description'}\n"
        if wireframe.creole_content:
            content += f"- **Creole Content:**\n```\n{wireframe.creole_content}\n```\n"
        content += "\n"
    
    return content


def generate_scenarios_content(project):
    scenarios = project.scenarios.all()
    
    content = f"Feature: Test Scenarios for {project.title}\n\n"
    
    for scenario in scenarios:
        content += f"Scenario: {scenario.title}\n"
        if scenario.description:
            content += f"  {scenario.description}\n"
        
        if scenario.given_steps:
            for step in scenario.given_steps.split('\n'):
                if step.strip():
                    content += f"  Given {step.strip()}\n"
        
        if scenario.when_steps:
            for step in scenario.when_steps.split('\n'):
                if step.strip():
                    content += f"  When {step.strip()}\n"
        
        if scenario.then_steps:
            for step in scenario.then_steps.split('\n'):
                if step.strip():
                    content += f"  Then {step.strip()}\n"
        
        content += "\n"
    
    return content


def generate_readme_content(project, config):
    content = f"# {project.title} - Export Package\n\n"
    content += "This package contains exported project artifacts from Story Canvas.\n\n"
    
    content += "## Contents\n\n"
    if config.get('include_stories', True):
        content += "- `user_stories.md`: All user stories in Markdown format\n"
    if config.get('include_wireframes', True):
        content += "- `wireframes.md`: Wireframe descriptions and details\n"
    if config.get('include_scenarios', True):
        content += "- `test_scenarios.feature`: Test scenarios in Gherkin format\n"
    
    content += "- `project_info.json`: Project metadata\n\n"
    
    content += "## Project Information\n\n"
    content += f"- **Title:** {project.title}\n"
    content += f"- **Domain:** {project.domain}\n"
    content += f"- **Objective:** {project.objective}\n"
    content += f"- **Export Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    
    content += "---\n*Generated by Story Canvas*"
    
    return content