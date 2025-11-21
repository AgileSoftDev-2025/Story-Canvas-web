from rest_framework import serializers
from stories.models import UserStory, Project

class UserStorySerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source='project.title', read_only=True)
    scenarios_count = serializers.SerializerMethodField()

    class Meta:
        model = UserStory
        fields = [
            'id', 'project', 'project_title', 'title', 'description', 'role', 'action',
            'benefit', 'feature', 'acceptance_criteria', 'priority', 'story_points',
            'status', 'scenarios_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'scenarios_count']

    def get_scenarios_count(self, obj):
        return obj.scenarios.count()

class UserStoryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserStory
        fields = [
            'project', 'title', 'description', 'role', 'action', 'benefit',
            'feature', 'acceptance_criteria', 'priority', 'story_points', 'status'
        ]

    def validate_title(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be empty")
        return value.strip()

def serialize_user_story_for_migration(user_story_data):
    """
    Serialize user story data from localStorage format to Django model format
    """
    return {
        'title': user_story_data.get('title', f"User Story {user_story_data.get('id', '')}"),
        'description': user_story_data.get('story_text', user_story_data.get('description', '')),
        'role': user_story_data.get('role', 'user'),
        'action': user_story_data.get('action', ''),
        'benefit': user_story_data.get('benefit', ''),
        'feature': user_story_data.get('feature', ''),
        'acceptance_criteria': user_story_data.get('acceptance_criteria', []),
        'priority': user_story_data.get('priority', 'medium'),
        'story_points': user_story_data.get('story_points', 0),
        'status': user_story_data.get('status', 'draft')
    }