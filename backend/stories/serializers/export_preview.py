from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import JsonResponse
from stories.models import Project, UserStory, Wireframe, Scenario, Export

# ==================== SERIALIZERS ====================

class UserStoryPreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview user story dalam export"""
    class Meta:
        model = UserStory
        fields = ['story_id', 'story_text', 'role', 'action', 'benefit', 'priority', 'status']

class WireframePreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview wireframe dalam export"""
    class Meta:
        model = Wireframe
        fields = ['wireframe_id', 'page_name', 'page_type', 'description', 'preview_url']

class ScenarioPreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview scenario dalam export"""
    class Meta:
        model = Scenario
        fields = ['scenario_id', 'title', 'scenario_type', 'scenario_text', 'status']

class ExportPreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview data export"""
    user_stories = serializers.SerializerMethodField()
    wireframes = serializers.SerializerMethodField()
    scenarios = serializers.SerializerMethodField()
    project_title = serializers.CharField(source='project.title')
    project_domain = serializers.CharField(source='project.domain')
    
    class Meta:
        model = Export
        fields = [
            'export_id',
            'project_title',
            'project_domain',
            'export_format',
            'file_size',
            'include_stories',
            'include_wireframes',
            'include_scenarios',
            'user_stories',
            'wireframes',
            'scenarios',
            'exported_at'
        ]
    
    def get_user_stories(self, obj):
        """Get user stories berdasarkan konfigurasi export"""
        if obj.include_stories:
            stories = UserStory.objects.filter(project=obj.project)
            return UserStoryPreviewSerializer(stories, many=True).data
        return []
    
    def get_wireframes(self, obj):
        """Get wireframes berdasarkan konfigurasi export"""
        if obj.include_wireframes:
            wireframes = Wireframe.objects.filter(project=obj.project)
            return WireframePreviewSerializer(wireframes, many=True).data
        return []
    
    def get_scenarios(self, obj):
        """Get scenarios berdasarkan konfigurasi export"""
        if obj.include_scenarios:
            scenarios = Scenario.objects.filter(project=obj.project)
            return ScenarioPreviewSerializer(scenarios, many=True).data
        return []

class ProjectExportPreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview export berdasarkan project"""
    user_stories = UserStoryPreviewSerializer(many=True, read_only=True)
    wireframes = WireframePreviewSerializer(many=True, read_only=True)
    scenarios = ScenarioPreviewSerializer(many=True, read_only=True)
    export_config = serializers.JSONField(default=dict)
    
    class Meta:
        model = Project
        fields = [
            'project_id',
            'title',
            'domain',
            'objective',
            'user_stories',
            'wireframes',
            'scenarios',
            'export_config'
        ]

# ==================== VIEW FUNCTIONS ====================

@api_view(['GET'])
def preview_export_by_id(request, export_id):
    """Preview export by export ID"""
    try:
        export = Export.objects.get(export_id=export_id)
        serializer = ExportPreviewSerializer(export)
        return Response({
            'success': True,
            'export': serializer.data
        })
    except Export.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Export not found'
        }, status=404)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def preview_project_export(request, project_id):
    """Preview export for a project"""
    try:
        project = Project.objects.get(project_id=project_id)
        
        # Get configuration from query params
        include_stories = request.GET.get('include_stories', 'true').lower() == 'true'
        include_wireframes = request.GET.get('include_wireframes', 'true').lower() == 'true'
        include_scenarios = request.GET.get('include_scenarios', 'true').lower() == 'true'
        export_format = request.GET.get('format', 'html')
        
        # Prepare preview data
        preview_data = {
            'project_id': project.project_id,
            'project_title': project.title,
            'project_domain': project.domain,
            'export_format': export_format,
            'include_stories': include_stories,
            'include_wireframes': include_wireframes,
            'include_scenarios': include_scenarios,
        }
        
        # Add user stories if requested
        if include_stories:
            stories = UserStory.objects.filter(project=project)
            preview_data['user_stories'] = UserStoryPreviewSerializer(stories, many=True).data
        
        # Add wireframes if requested
        if include_wireframes:
            wireframes = Wireframe.objects.filter(project=project)
            preview_data['wireframes'] = WireframePreviewSerializer(wireframes, many=True).data
        
        # Add scenarios if requested
        if include_scenarios:
            scenarios = Scenario.objects.filter(project=project)
            preview_data['scenarios'] = ScenarioPreviewSerializer(scenarios, many=True).data
        
        return Response({
            'success': True,
            'preview': preview_data
        })
        
    except Project.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Project not found'
        }, status=404)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['POST'])
def generate_export_preview(request):
    """Generate a new export preview"""
    try:
        project_id = request.data.get('project_id')
        export_format = request.data.get('format', 'html')
        include_stories = request.data.get('include_stories', True)
        include_wireframes = request.data.get('include_wireframes', True)
        include_scenarios = request.data.get('include_scenarios', True)
        
        if not project_id:
            return Response({
                'success': False,
                'error': 'project_id is required'
            }, status=400)
        
        # Simulate export preview generation
        # In a real implementation, this would generate actual files
        preview_data = {
            'preview_id': f"preview_{project_id}_{export_format}",
            'project_id': project_id,
            'export_format': export_format,
            'include_stories': include_stories,
            'include_wireframes': include_wireframes,
            'include_scenarios': include_scenarios,
            'estimated_size': '2.5 MB',
            'estimated_time': '30 seconds',
            'status': 'ready'
        }
        
        return Response({
            'success': True,
            'message': 'Export preview generated successfully',
            'preview': preview_data
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def list_user_exports(request):
    """List all exports for the current user"""
    try:
        # Get query parameters for filtering
        project_id = request.GET.get('project_id')
        export_format = request.GET.get('format')
        
        # Start with all exports
        exports = Export.objects.all()
        
        # Apply filters if provided
        if project_id:
            exports = exports.filter(project__project_id=project_id)
        if export_format:
            exports = exports.filter(export_format=export_format)
        
        # Order by most recent first
        exports = exports.order_by('-exported_at')
        
        serializer = ExportPreviewSerializer(exports, many=True)
        
        return Response({
            'success': True,
            'exports': serializer.data,
            'count': len(serializer.data)
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)