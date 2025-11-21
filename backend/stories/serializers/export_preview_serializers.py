from rest_framework import serializers
from stories.models import Project, UserStory, Wireframe, Export

class UserStoryPreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview user story dalam export"""
    class Meta:
        model = UserStory
        fields = ['id', 'title', 'description', 'role', 'action', 'benefit', 'priority', 'status', 'story_points']

class WireframePreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview wireframe dalam export"""
    class Meta:
        model = Wireframe
        fields = ['id', 'title', 'page_type', 'description', 'wireframe_type', 'version', 'status']

class ExportPreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview data export"""
    user_stories = serializers.SerializerMethodField()
    wireframes = serializers.SerializerMethodField()
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
            'user_stories',
            'wireframes',
            'exported_at',
            'status'
        ]
        read_only_fields = ['export_id', 'exported_at']
    
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

class ProjectExportPreviewSerializer(serializers.ModelSerializer):
    """Serializer untuk preview export berdasarkan project"""
    user_stories = serializers.SerializerMethodField()
    wireframes = serializers.SerializerMethodField()
    stories_count = serializers.SerializerMethodField()
    wireframes_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = [
            'project_id',
            'title',
            'domain',
            'objective',
            'stories_count',
            'wireframes_count',
            'user_stories',
            'wireframes'
        ]
    
    def get_user_stories(self, obj):
        """Get limited user stories for preview"""
        stories = UserStory.objects.filter(project=obj)[:10]  # Limit untuk preview
        return UserStoryPreviewSerializer(stories, many=True).data
    
    def get_wireframes(self, obj):
        """Get limited wireframes for preview"""
        wireframes = Wireframe.objects.filter(project=obj)[:5]  # Limit untuk preview
        return WireframePreviewSerializer(wireframes, many=True).data
    
    def get_stories_count(self, obj):
        return UserStory.objects.filter(project=obj).count()
    
    def get_wireframes_count(self, obj):
        return Wireframe.objects.filter(project=obj).count()

class ExportRequestSerializer(serializers.Serializer):
    """Serializer untuk request export"""
    project_id = serializers.IntegerField(required=True)
    export_format = serializers.ChoiceField(
        choices=['pdf', 'html', 'json', 'docx'],
        default='pdf'
    )
    include_stories = serializers.BooleanField(default=True)
    include_wireframes = serializers.BooleanField(default=True)
    include_project_info = serializers.BooleanField(default=True)
    compression_level = serializers.ChoiceField(
        choices=['none', 'low', 'medium', 'high'],
        default='none'
    )
    
    def validate_project_id(self, value):
        """Validate that project exists"""
        if not Project.objects.filter(project_id=value).exists():
            raise serializers.ValidationError("Project does not exist.")
        return value

class ExportStatusSerializer(serializers.Serializer):
    """Serializer untuk status export"""
    export_id = serializers.CharField(read_only=True)
    project_title = serializers.CharField(read_only=True)
    export_format = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    file_size = serializers.CharField(read_only=True)
    download_url = serializers.CharField(read_only=True)
    exported_at = serializers.DateTimeField(read_only=True)
    error_message = serializers.CharField(read_only=True, allow_null=True)

class QuickExportSerializer(serializers.Serializer):
    """Serializer untuk quick export tanpa konfigurasi detail"""
    project_id = serializers.IntegerField(required=True)
    format = serializers.ChoiceField(
        choices=['pdf', 'html'],
        default='pdf'
    )
    
    def validate_project_id(self, value):
        if not Project.objects.filter(project_id=value).exists():
            raise serializers.ValidationError("Project does not exist.")
        return value