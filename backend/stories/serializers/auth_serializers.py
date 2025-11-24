# stories/serializers/auth_serializers.py
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from stories.models import CustomUser
from django.core.exceptions import ValidationError
from django.core.validators import validate_email

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = CustomUser
        fields = ('email', 'username', 'password', 'password_confirm')
        extra_kwargs = {
            'password': {'write_only': True},
            'password_confirm': {'write_only': True},
        }

    def validate(self, attrs):
        # ✅ Handle both password_confirm and passwordConfirmation
        password_confirm = attrs.get('password_confirm') 
        if not password_confirm:
            # Jika password_confirm tidak ada, coba pakai passwordConfirmation
            password_confirm = attrs.get('passwordConfirmation')
            
        password = attrs.get('password')
        
        if password != password_confirm:
            raise serializers.ValidationError({"password": "Passwords don't match."})
        return attrs

    def create(self, validated_data):
        # ✅ Remove password_confirm from validated_data
        validated_data.pop('password_confirm', None)
        validated_data.pop('passwordConfirmation', None)  # Juga remove jika ada
        
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if not username or not password:
            raise serializers.ValidationError('Must include "username" and "password"')

        try:
            user = CustomUser.objects.get(username=username)
            if user.check_password(password):
                if not user.is_active:
                    raise serializers.ValidationError('User account is disabled')
                attrs['user'] = user
                return attrs
            else:
                raise serializers.ValidationError('Invalid credentials')
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError('Invalid credentials')

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'created_at', 'last_login']
        read_only_fields = ['id', 'created_at', 'last_login']