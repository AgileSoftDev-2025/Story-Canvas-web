from rest_framework import serializers
from stories.models import Project, UserStory, Wireframe, Scenario, Export

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