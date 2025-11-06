from rest_framework import serializers
from stories.models import Project

class ProjectDescriptionSerializer(serializers.ModelSerializer):
    user_stories_count = serializers.ReadOnlyField()
    wireframes_count = serializers.ReadOnlyField()
    scenarios_count = serializers.ReadOnlyField()
    
    class Meta:
        model = Project
        fields = [
            'project_id',
            'title',
            'objective',
            'scope',
            'flow',
            'additional_info',
            'domain',
            'language',
            'nlp_analysis',
            'users_data',
            'features_data',
            'status',
            'created_date',
            'last_modified',
            'user_stories_count',
            'wireframes_count',
            'scenarios_count'
        ]
        read_only_fields = ['project_id', 'created_date', 'last_modified', 'user_stories_count', 'wireframes_count', 'scenarios_count']

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Title cannot be empty")
        return value

    def validate_objective(self, value):
        if value and not value.strip():
            raise serializers.ValidationError("Objective cannot be empty if provided")
        return value

class ProjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            'title',
            'objective',
            'scope',
            'flow',
            'additional_info',
            'domain',
            'language',
            'users_data',
            'features_data',
            'status'
        ]

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Title cannot be empty")
        return value