from rest_framework import serializers
from stories.models import Wireframe

class WireframeSerializer(serializers.ModelSerializer):
    # Add computed or related fields if needed
    project_id = serializers.CharField(source='project.project_id', read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)
    is_local = serializers.BooleanField(read_only=False)  # Add this field
    stories_count = serializers.IntegerField(read_only=False)  # Add this field
    features_count = serializers.IntegerField(read_only=False)  # Add this field
    generated_with_rag = serializers.BooleanField(read_only=False)  # Add this field
    
    class Meta:
        model = Wireframe
        fields = [
            'wireframe_id',
            'project_id',           # Add this
            'project_title',        # Add this
            'page_name',
            'page_type',
            'description',
            'html_content',
            'creole_content',
            'salt_diagram',
            'wireframe_type',
            'version',
            'preview_url',
            'stories_count',        # Add this
            'features_count',       # Add this
            'generated_with_rag',   # Add this
            'is_local',             # Add this
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['wireframe_id', 'created_at', 'updated_at', 'version']

class CreateWireframeSerializer(serializers.ModelSerializer):
    # Make these required for sync
    project_id = serializers.CharField(write_only=True, required=True)
    wireframe_id = serializers.CharField(required=False)  # Optional for creation
    
    class Meta:
        model = Wireframe
        fields = [
            'wireframe_id',         # Add this for sync
            'project_id',           # Add this for sync
            'page_name',
            'page_type',
            'description',
            'html_content',
            'creole_content',       # Add this for sync
            'salt_diagram',         # Add this for sync
            'wireframe_type',
            'stories_count',        # Add this for sync
            'features_count',       # Add this for sync
            'generated_with_rag',   # Add this for sync
            'is_local',             # Add this for sync
            'preview_url'           # Add this for sync
        ]
    
    def create(self, validated_data):
        # Extract project_id
        project_id = validated_data.pop('project_id')
        
        # Get or create project
        from stories.models import Project
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            raise serializers.ValidationError(f"Project with ID {project_id} does not exist")
        
        # Generate wireframe_id if not provided
        wireframe_id = validated_data.get('wireframe_id')
        if not wireframe_id:
            import time
            wireframe_id = f"wf_{project_id}_{validated_data.get('page_name', 'page')}_{int(time.time())}"
            validated_data['wireframe_id'] = wireframe_id
        
        # Create wireframe
        wireframe = Wireframe.objects.create(
            project=project,
            **validated_data
        )
        
        return wireframe

class UpdateWireframeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wireframe
        fields = [
            'page_name',
            'page_type',
            'description',
            'html_content',
            'creole_content',
            'salt_diagram',
            'wireframe_type',
            'version',
            'preview_url',
            'stories_count',
            'features_count',
            'generated_with_rag',
            'is_local'
        ]

# ============================================================================
# SYNC-SPECIFIC SERIALIZERS
# ============================================================================

class WireframeSyncSerializer(serializers.ModelSerializer):
    """Serializer specifically for sync operations"""
    project_id = serializers.CharField(source='project.project_id')
    project_title = serializers.CharField(source='project.title')
    
    class Meta:
        model = Wireframe
        fields = [
            'wireframe_id',
            'project_id',
            'project_title',
            'page_name',
            'page_type',
            'description',
            'html_content',
            'creole_content',
            'salt_diagram',
            'wireframe_type',
            'version',
            'preview_url',
            'stories_count',
            'features_count',
            'generated_with_rag',
            'is_local',
            'created_at',
            'updated_at'
        ]

class WireframeBulkSyncSerializer(serializers.Serializer):
    """Serializer for bulk sync operations"""
    operation = serializers.CharField(required=True)  # 'push' or 'pull'
    project_id = serializers.CharField(required=True)
    wireframes = WireframeSyncSerializer(many=True, required=False)
    page_type = serializers.CharField(required=False, allow_null=True)
    
    def validate_operation(self, value):
        if value not in ['push', 'pull']:
            raise serializers.ValidationError("Operation must be 'push' or 'pull'")
        return value

class WireframeLocalSyncSerializer(serializers.Serializer):
    """Serializer for local wireframe data from frontend"""
    wireframe_id = serializers.CharField(required=True)
    project_id = serializers.CharField(required=True)
    page_name = serializers.CharField(required=True)
    page_type = serializers.CharField(required=True)
    description = serializers.CharField(required=False, allow_blank=True)
    html_content = serializers.CharField(required=False, allow_blank=True)
    creole_content = serializers.CharField(required=False, allow_blank=True)
    salt_diagram = serializers.CharField(required=False, allow_blank=True)
    wireframe_type = serializers.CharField(default='desktop')
    version = serializers.IntegerField(default=1)
    preview_url = serializers.CharField(required=False, allow_blank=True)
    stories_count = serializers.IntegerField(default=0)
    features_count = serializers.IntegerField(default=0)
    generated_with_rag = serializers.BooleanField(default=False)
    is_local = serializers.BooleanField(default=True)
    generated_at = serializers.CharField(required=False)
    updated_at = serializers.CharField(required=False)
    
    def validate(self, data):
        # Ensure required fields are present
        if not data.get('html_content') and not data.get('creole_content'):
            raise serializers.ValidationError("Either html_content or creole_content must be provided")
        return data

# ============================================================================
# HELPER FUNCTIONS FOR VIEWS
# ============================================================================

def serialize_wireframe(wireframe):
    """Serialize a single wireframe for sync operations"""
    return {
        'wireframe_id': wireframe.wireframe_id,
        'project_id': wireframe.project.project_id,
        'project_title': wireframe.project.title,
        'page_name': wireframe.page_name,
        'page_type': wireframe.page_type,
        'description': wireframe.description or '',
        'html_content': wireframe.html_content or '',
        'creole_content': wireframe.creole_content or '',
        'salt_diagram': wireframe.salt_diagram or '',
        'wireframe_type': wireframe.wireframe_type,
        'version': wireframe.version,
        'preview_url': wireframe.preview_url or '',
        'stories_count': wireframe.stories_count or 0,
        'features_count': wireframe.features_count or 0,
        'generated_with_rag': wireframe.generated_with_rag,
        'is_local': wireframe.is_local,
        'created_at': wireframe.created_at.isoformat() if wireframe.created_at else None,
        'updated_at': wireframe.updated_at.isoformat() if wireframe.updated_at else None
    }

def serialize_wireframe_with_project(wireframe):
    """Serialize wireframe with detailed project info"""
    data = serialize_wireframe(wireframe)
    data['project'] = {
        'project_id': wireframe.project.project_id,
        'title': wireframe.project.title,
        'domain': wireframe.project.domain or 'general',
        'status': wireframe.project.status
    }
    return data

def serialize_wireframe_list(wireframes):
    """Serialize a list of wireframes"""
    return [serialize_wireframe(wf) for wf in wireframes]