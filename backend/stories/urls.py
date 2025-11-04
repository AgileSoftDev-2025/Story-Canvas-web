from django.urls import path
from .views import (
    health_check,
    get_csrf_token,
)

urlpatterns = [
    # Health check
    path('health/', health_check, name='health_check'),
    
    # Authentication endpoints
    path('api/auth/csrf/', get_csrf_token, name='csrf_token'),
]