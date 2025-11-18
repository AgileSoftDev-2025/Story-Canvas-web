from django.urls import path
from stories.views.project_description import (
    get_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
    get_project_stats,
    get_projects_history
)

from stories.views.health import health_check

from stories.views.user_story import (
    get_user_stories,
    get_user_story_detail,
    create_user_story,
    update_user_story,
    delete_user_story,
    get_project_user_stories,
    get_user_stories_by_status,
    get_user_stories_by_priority
)

from stories.views.scenario import (
    get_story_scenarios,
    get_project_scenarios,
    create_scenario,
    update_scenario,
    delete_scenario 
)

from stories.views.wireframe import (
    list_wireframes,
    get_wireframe,
    create_wireframe,
    update_wireframe,
    delete_wireframe
)

from stories.views.auth.token_auth import (
    signup,
    signin,
    current_user,
    signout,
    refresh_token,
)

from stories.views.auth.auth_debug import debug_signin

urlpatterns = [
    # ✅ TAMBAHKAN /api/ PREFIX DI SINI
    path('api/auth/debug-signin/', debug_signin, name='debug_signin'),
    path('api/auth/signup/', signup, name='signup'),
    path('api/auth/signin/', signin, name='signin'),
    path('api/auth/user/', current_user, name='current_user'),
    path('api/auth/signout/', signout, name='signout'),
    path('api/auth/refresh/', refresh_token, name='refresh_token'),

    # User Stories endpoints - TAMBAH /api/
    path('api/user-stories/', get_user_stories, name='get_user_stories'),
    path('api/user-stories/create/', create_user_story, name='create_user_story'),
    path('api/user-stories/<str:story_id>/', get_user_story_detail, name='get_user_story_detail'),
    path('api/user-stories/<str:story_id>/update/', update_user_story, name='update_user_story'),
    path('api/user-stories/<str:story_id>/delete/', delete_user_story, name='delete_user_story'),
    path('api/user-stories/status/<str:status>/', get_user_stories_by_status, name='get_user_stories_by_status'),
    path('api/user-stories/priority/<str:priority>/', get_user_stories_by_priority, name='get_user_stories_by_priority'),
    
    # User Story Scenario endpoints - TAMBAH /api/
    path('api/user-stories/<str:story_id>/scenarios/', get_story_scenarios, name='get_story_scenarios'),
    
    # Health check endpoint - TAMBAH /api/
    path('api/health/', health_check, name='health_check'),

    # Project endpoints - TAMBAH /api/
    path('api/projects/', get_projects, name='get_projects'),
    path('api/projects/create/', create_project, name='create_project'),
    path('api/projects/<str:project_id>/', get_project, name='get_project'),
    path('api/projects/<str:project_id>/update/', update_project, name='update_project'),
    path('api/projects/<str:project_id>/delete/', delete_project, name='delete_project'),
    path('api/projects/<str:project_id>/stats/', get_project_stats, name='get_project_stats'),

    # Project wireframes - TAMBAH /api/
    path('api/projects/<str:project_id>/wireframes/', list_wireframes, name='list_wireframes'),
    path('api/projects/<str:project_id>/wireframes/create/', create_wireframe, name='create_wireframe'),
    
    # Single wireframe operations - TAMBAH /api/
    path('api/wireframes/<str:wireframe_id>/', get_wireframe, name='get_wireframe'),
    path('api/wireframes/<str:wireframe_id>/update/', update_wireframe, name='update_wireframe'),
    path('api/wireframes/<str:wireframe_id>/delete/', delete_wireframe, name='delete_wireframe'),
    
    # Project-specific endpoints - TAMBAH /api/
    path('api/projects/<str:project_id>/user-stories/', get_project_user_stories, name='get_project_user_stories'),
    path('api/projects/<str:project_id>/scenarios/', get_project_scenarios, name='get_project_scenarios'),
    
    # Scenario CRUD endpoints - TAMBAH /api/
    path('api/scenarios/create/', create_scenario, name='create_scenario'),
    path('api/scenarios/create/story/<str:story_id>/', create_scenario, name='create_scenario_for_story'),
    path('api/scenarios/create/project/<str:project_id>/', create_scenario, name='create_scenario_for_project'),
    path('api/scenarios/<str:scenario_id>/update/', update_scenario, name='update_scenario'),
    path('api/scenarios/<str:scenario_id>/delete/', delete_scenario, name='delete_scenario'),
    
    # Project history endpoints - TAMBAH /api/
    path('api/history/projects/', get_projects_history, name='get_projects_history'),
]