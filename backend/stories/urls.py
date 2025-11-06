from django.urls import path
from stories.views.project_description import (
    get_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
    get_project_stats
)

from stories.views.auth.csrf_token import get_csrf_token
from stories.views.health import health_check

from stories.views.user_story import (

# Import langsung dari file masing-masing, jangan dari __init__.py
from .views.user_story_views import (
    get_user_stories,
    get_user_story_detail,
    create_user_story,
    update_user_story,
    delete_user_story,
    get_project_user_stories,
    get_user_stories_by_status,
    get_user_stories_by_priority
)

urlpatterns = [
    # User Story endpoints dengan prefix 'api/'
    path('api/user-stories/', get_user_stories, name='get_user_stories'),
    path('api/user-stories/create/', create_user_story, name='create_user_story'),
    path('api/user-stories/<str:story_id>/', get_user_story_detail, name='get_user_story_detail'),
    path('api/user-stories/<str:story_id>/update/', update_user_story, name='update_user_story'),
    path('api/user-stories/<str:story_id>/delete/', delete_user_story, name='delete_user_story'),
    path('api/user-stories/status/<str:status>/', get_user_stories_by_status, name='get_user_stories_by_status'),
    path('api/user-stories/priority/<str:priority>/', get_user_stories_by_priority, name='get_user_stories_by_priority'),
    
    # Authentication endpoints
    path('auth/csrf/', get_csrf_token, name='get_csrf_token'),

    # Project endpoints - semua di bawah /api/projects/
    path('projects/', get_projects, name='get_projects'),
    path('projects/create/', create_project, name='create_project'),
    path('projects/<str:project_id>/', get_project, name='get_project'),
    path('projects/<str:project_id>/update/', update_project, name='update_project'),
    path('projects/<str:project_id>/delete/', delete_project, name='delete_project'),
    path('projects/<str:project_id>/stats/', get_project_stats, name='get_project_stats'),
    # Project-specific user stories
    path('api/projects/<str:project_id>/user-stories/', get_project_user_stories, name='get_project_user_stories'),
    delete_user_story
)
from .views.scenario_views import (
    get_story_scenarios,
    get_project_scenarios,
    create_scenario,
    update_scenario,
    delete_scenario
)
from .views.project_views import (
    get_projects,
    get_project_detail,
    create_project,
    update_project,
    delete_project
)

urlpatterns = [
    # Project endpoints
    path('projects/', get_projects, name='get_projects'),
    path('projects/<uuid:project_id>/', get_project_detail, name='get_project_detail'),
    path('projects/create/', create_project, name='create_project'),
    path('projects/<uuid:project_id>/update/', update_project, name='update_project'),
    path('projects/<uuid:project_id>/delete/', delete_project, name='delete_project'),
    
    # User Story endpoints
    path('stories/', get_user_stories, name='get_user_stories'),
    path('projects/<uuid:project_id>/stories/', get_user_stories, name='get_project_stories'),
    path('stories/<uuid:story_id>/', get_user_story_detail, name='get_user_story_detail'),
    path('projects/<uuid:project_id>/stories/create/', create_user_story, name='create_user_story'),
    path('stories/<uuid:story_id>/update/', update_user_story, name='update_user_story'),
    path('stories/<uuid:story_id>/delete/', delete_user_story, name='delete_user_story'),
    
    # Scenario endpoints
    path('stories/<uuid:story_id>/scenarios/', get_story_scenarios, name='get_story_scenarios'),
    path('projects/<uuid:project_id>/scenarios/', get_project_scenarios, name='get_project_scenarios'),
    path('stories/<uuid:story_id>/scenarios/create/', create_scenario, name='create_scenario_for_story'),
    path('projects/<uuid:project_id>/scenarios/create/', create_scenario, name='create_scenario_for_project'),
    path('scenarios/<uuid:scenario_id>/update/', update_scenario, name='update_scenario'),
    path('scenarios/<uuid:scenario_id>/delete/', delete_scenario, name='delete_scenario'),
]