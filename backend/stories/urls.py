from django.urls import path, include
from stories.views.project_description import (
    get_projects, get_project, create_project, update_project, delete_project, get_project_stats
)
from stories.views.export_preview import (
    preview_export_by_id, preview_project_export, generate_export_preview, list_user_exports
)
from stories.views.health import health_check
from stories.views.user_story import (
    get_user_stories, get_user_story_detail, create_user_story, update_user_story, 
    delete_user_story, get_project_user_stories, get_user_stories_by_status, get_user_stories_by_priority
)
from stories.views.scenario import (
    get_story_scenarios, get_project_scenarios, create_scenario, update_scenario, 
    delete_scenario, generate_story_scenarios_api, accept_scenarios, get_scenario_detail
)
from stories.views.wireframe import (
    list_wireframes, get_wireframe, create_wireframe, update_wireframe, delete_wireframe
)
from stories.views.auth.token_auth import (
    signup, signin, current_user, signout, refresh_token
)
from stories.views.auth.auth_debug import (
    debug_signin,
)
from stories.generation_views import (
    get_rag_status, query_rag_patterns, query_ui_patterns, generate_user_stories,
    generate_wireframes, generate_scenarios, export_all_artifacts, ai_edit_user_stories,
    generate_story_scenarios, ai_edit_user_story, ai_edit_story_scenarios, generate_creole,
    generate_salt_diagram, render_png_diagram, ai_edit_wireframe
)

urlpatterns = [
    # Auth endpoints
    path('auth/debug-signin/', debug_signin, name='debug_signin'),
    path('auth/signup/', signup, name='signup'),
    path('auth/signin/', signin, name='signin'),
    path('auth/user/', current_user, name='current_user'),
    path('auth/signout/', signout, name='signout'),
    path('auth/refresh/', refresh_token, name='refresh_token'),

    # Health check endpoint
    path('health/', health_check, name='health_check'),

    # Project endpoints
    path('projects/', get_projects, name='get_projects'),
    path('projects/create/', create_project, name='create_project'),
    path('projects/<uuid:project_id>/', get_project, name='get_project'),
    path('projects/<uuid:project_id>/update/', update_project, name='update_project'),
    path('projects/<uuid:project_id>/delete/', delete_project, name='delete_project'),
    path('projects/<uuid:project_id>/stats/', get_project_stats, name='get_project_stats'),

    # Project wireframes
    path('projects/<uuid:project_id>/wireframes/', list_wireframes, name='list_wireframes'),
    path('projects/<uuid:project_id>/wireframes/create/', create_wireframe, name='create_wireframe'),
    
    # Single wireframe operations
    path('wireframes/<uuid:wireframe_id>/', get_wireframe, name='get_wireframe'),
    path('wireframes/<uuid:wireframe_id>/update/', update_wireframe, name='update_wireframe'),
    path('wireframes/<uuid:wireframe_id>/delete/', delete_wireframe, name='delete_wireframe'),
    
    # Project-specific endpoints
    path('projects/<uuid:project_id>/user-stories/', get_project_user_stories, name='get_project_user_stories'),

    # User Stories endpoints (HAPUS DUPLIKASI)
    path('user-stories/', get_user_stories, name='get_user_stories'),
    path('user-stories/create/', create_user_story, name='create_user_story'),
    path('user-stories/<uuid:story_id>/', get_user_story_detail, name='get_user_story_detail'),
    path('user-stories/<uuid:story_id>/update/', update_user_story, name='update_user_story'),
    path('user-stories/<uuid:story_id>/delete/', delete_user_story, name='delete_user_story'),
    path('user-stories/status/<str:status>/', get_user_stories_by_status, name='get_user_stories_by_status'),
    path('user-stories/priority/<str:priority>/', get_user_stories_by_priority, name='get_user_stories_by_priority'),
    
    # Scenario endpoints (HAPUS DUPLIKASI, GUNAKAN UUID KONSISTEN)
    path('user-stories/<uuid:story_id>/scenarios/', get_story_scenarios, name='get_story_scenarios'),
    path('projects/<uuid:project_id>/scenarios/', get_project_scenarios, name='get_project_scenarios'),
    path('user-stories/<uuid:story_id>/generate-scenarios/', generate_story_scenarios_api, name='generate_story_scenarios_api'),
    path('user-stories/<uuid:story_id>/accept-scenarios/', accept_scenarios, name='accept_scenarios'),
    
    # Scenario CRUD endpoints
    path('scenarios/create/', create_scenario, name='create_scenario'),
    path('scenarios/create/story/<uuid:story_id>/', create_scenario, name='create_scenario_for_story'),
    path('scenarios/create/project/<uuid:project_id>/', create_scenario, name='create_scenario_for_project'),
    path('scenarios/<uuid:scenario_id>/', get_scenario_detail, name='get_scenario_detail'),
    path('scenarios/<uuid:scenario_id>/update/', update_scenario, name='update_scenario'),
    path('scenarios/<uuid:scenario_id>/delete/', delete_scenario, name='delete_scenario'),

    # Export endpoints
    path('exports/preview/<uuid:export_id>/', preview_export_by_id, name='preview-export-by-id'),
    path('projects/<uuid:project_id>/export-preview/', preview_project_export, name='preview-project-export'),
    path('projects/<uuid:project_id>/generate-export-preview/', generate_export_preview, name='generate-export-preview'),
    path('exports/my-exports/', list_user_exports, name='list-user-exports'),
    
    # RAG endpoints
    path('rag/status/', get_rag_status, name='get_rag_status'),
    path('rag/query-patterns/', query_rag_patterns, name='query_rag_patterns'),
    path('rag/query-ui-patterns/', query_ui_patterns, name='query_ui_patterns'),

    # Project generation endpoints
    path('projects/<uuid:project_id>/generate-user-stories/', generate_user_stories, name='generate_user_stories'),
    path('projects/<uuid:project_id>/generate-wireframes/', generate_wireframes, name='generate_wireframes'),
    path('projects/<uuid:project_id>/generate-scenarios/', generate_scenarios, name='generate_scenarios'),
    path('projects/<uuid:project_id>/export-all-artifacts/', export_all_artifacts, name='export_all_artifacts'),
    path('projects/<uuid:project_id>/ai-edit-user-stories/', ai_edit_user_stories, name='ai_edit_user_stories'),

    # User story generation endpoints
    path('user-stories/<uuid:story_id>/generate-scenarios/', generate_story_scenarios, name='generate_story_scenarios'),
    path('user-stories/<uuid:story_id>/ai-edit/', ai_edit_user_story, name='ai_edit_user_story'),
    path('user-stories/<uuid:story_id>/ai-edit-scenarios/', ai_edit_story_scenarios, name='ai_edit_story_scenarios'),

    # Wireframe generation endpoints
    path('wireframes/<uuid:wireframe_id>/generate-creole/', generate_creole, name='generate_creole'),
    path('wireframes/<uuid:wireframe_id>/generate-salt-diagram/', generate_salt_diagram, name='generate_salt_diagram'),
    path('wireframes/<uuid:wireframe_id>/render-png-diagram/', render_png_diagram, name='render_png_diagram'),
    path('wireframes/<uuid:wireframe_id>/ai-edit/', ai_edit_wireframe, name='ai_edit_wireframe'),
]