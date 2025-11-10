from rest_framework import serializers
from stories.models import UserStory, Scenario, Project

class ScenarioSerializer(serializers.ModelSerializer):
    user_story_title = serializers.CharField(source='user_story.story_text', read_only=True)
    
    class Meta:
        model = Scenario
        fields = [
            'scenario_id', 'user_story', 'user_story_title', 'scenario_text', 
            'scenario_type', 'title', 'detected_domain', 'has_proper_structure',
            'gherkin_steps', 'enhanced_with_llm', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['scenario_id', 'created_at', 'updated_at']

class UserStorySerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source='project.title', read_only=True)
    scenarios = ScenarioSerializer(many=True, read_only=True)
    scenarios_count = serializers.SerializerMethodField()

    class Meta:
        model = UserStory
        fields = [
            'story_id', 'project', 'project_title', 'story_text', 'role', 'action',
            'benefit', 'feature', 'acceptance_criteria', 'priority', 'story_points',
            'status', 'generated_by_llm', 'iteration', 'scenarios', 'scenarios_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['story_id', 'created_at', 'updated_at', 'scenarios_count']

    def get_scenarios_count(self, obj):
        return obj.scenarios.count()

class ProjectSerializer(serializers.ModelSerializer):
    user_stories_count = serializers.ReadOnlyField()
    wireframes_count = serializers.ReadOnlyField()
    scenarios_count = serializers.ReadOnlyField()

    class Meta:
        model = Project
        fields = [
            'project_id', 'user', 'title', 'objective', 'scope', 'flow', 'additional_info',
            'domain', 'language', 'nlp_analysis', 'users_data', 'features_data',
            'status', 'user_stories_count', 'wireframes_count', 'scenarios_count',
            'created_date', 'last_modified'
        ]
        read_only_fields = ['project_id', 'created_date', 'last_modified']