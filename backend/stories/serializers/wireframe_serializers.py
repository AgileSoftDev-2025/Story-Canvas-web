from rest_framework import serializers
from stories.models import Wireframe

class WireframeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wireframe
        fields = [
            'wireframe_id',
            'page_name',
            'page_type',
            'description',
            'html_content',
            'creole_content',
            'salt_diagram',
            'wireframe_type',
            'version',
            'preview_url',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['wireframe_id', 'created_at', 'updated_at', 'version']

class CreateWireframeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wireframe
        fields = [
            'page_name',
            'page_type',
            'description',
            'html_content',
            'wireframe_type'
        ]

class UpdateWireframeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wireframe
        fields = [
            'page_name',
            'page_type',
            'description',
            'html_content',
            'wireframe_type'
        ]