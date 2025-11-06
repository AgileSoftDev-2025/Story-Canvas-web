from django.urls import path
from .views import (
    health_check,
    get_csrf_token,
    get_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
    get_project_stats
)

urlpatterns = [
    # Health check
    path('health/', health_check, name='health_check'),
    
    # Authentication endpoints
    path('auth/csrf/', get_csrf_token, name='get_csrf_token'),

    # Project endpoints - semua di bawah /api/projects/
    path('projects/', get_projects, name='get_projects'),
    path('projects/create/', create_project, name='create_project'),
    path('projects/<str:project_id>/', get_project, name='get_project'),
    path('projects/<str:project_id>/update/', update_project, name='update_project'),
    path('projects/<str:project_id>/delete/', delete_project, name='delete_project'),
    path('projects/<str:project_id>/stats/', get_project_stats, name='get_project_stats'),
]