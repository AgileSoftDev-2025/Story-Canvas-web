from django.urls import path, include
from stories.views.project_description import (
    get_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
    get_project_stats,
    get_projects_history
)

from stories.views.export_preview import (
    preview_export_by_id,
    preview_project_export,
    generate_export_preview,
    list_user_exports
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
    get_user_stories_by_priority,
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

from stories.views.auth.auth_debug import (
    debug_signin,
)

from stories.generation_views import (
    get_rag_status,
    query_rag_patterns,
    query_ui_patterns,
    generate_user_stories,
    generate_wireframes,
    generate_scenarios,
    export_all_artifacts,
    ai_edit_user_stories,
    generate_story_scenarios,
    ai_edit_user_story,
    ai_edit_story_scenarios,
    generate_creole,
    generate_salt_diagram,
    render_png_diagram,
    ai_edit_wireframe,
    generate_user_stories_for_local_project,
    generate_wireframes_for_local_project
)


urlpatterns = [
    # Auth endpoints
    path('api/auth/debug-signin/', debug_signin, name='debug_signin'),
    path('api/auth/signup/', signup, name='signup'),
    path('api/auth/signin/', signin, name='signin'),
    path('api/auth/user/', current_user, name='current_user'),
    path('api/auth/signout/', signout, name='signout'),
    path('api/auth/refresh/', refresh_token, name='refresh_token'),

    # Project endpoints
    path('api/projects/', get_projects, name='get_projects'),
    path('api/projects/create/', create_project, name='create_project'),
    path('api/projects/<str:project_id>/', get_project, name='get_project'),
    path('api/projects/<str:project_id>/update/', update_project, name='update_project'),
    path('api/projects/<str:project_id>/delete/', delete_project, name='delete_project'),
    path('api/projects/<str:project_id>/stats/', get_project_stats, name='get_project_stats'),
    path('api/history/projects/', get_projects_history, name='get_projects_history'),

    # User Stories endpoints
    path('api/user-stories/', get_user_stories, name='get_user_stories'),
    path('api/user-stories/create/', create_user_story, name='create_user_story'),
    path('api/user-stories/<str:story_id>/', get_user_story_detail, name='get_user_story_detail'),
    path('api/user-stories/<str:story_id>/update/', update_user_story, name='update_user_story'),
    path('api/user-stories/<str:story_id>/delete/', delete_user_story, name='delete_user_story'),
    path('api/user-stories/status/<str:status>/', get_user_stories_by_status, name='get_user_stories_by_status'),
    path('api/user-stories/priority/<str:priority>/', get_user_stories_by_priority, name='get_user_stories_by_priority'),
    
    # User Story Scenario endpoints
    path('api/user-stories/<str:story_id>/scenarios/', get_story_scenarios, name='get_story_scenarios'),
    
    # Health check endpoint
    path('api/health/', health_check, name='health_check'),

    # Project wireframes
    path('api/projects/<str:project_id>/wireframes/', list_wireframes, name='list_wireframes'),
    path('api/projects/<str:project_id>/wireframes/create/', create_wireframe, name='create_wireframe'),
    
    # Single wireframe operations
    path('api/wireframes/<str:wireframe_id>/', get_wireframe, name='get_wireframe'),
    path('api/wireframes/<str:wireframe_id>/update/', update_wireframe, name='update_wireframe'),
    path('api/wireframes/<str:wireframe_id>/delete/', delete_wireframe, name='delete_wireframe'),
    
    # Project-specific user stories
    path('api/projects/<str:project_id>/user-stories/', get_project_user_stories, name='get_project_user_stories'),

    # ========== SCENARIO ENDPOINTS ==========
    path('api/user-stories/<str:story_id>/scenarios/', get_story_scenarios, name='get_story_scenarios'),
    path('api/projects/<str:project_id>/scenarios/', get_project_scenarios, name='get_project_scenarios'),
    path('api/scenarios/create/', create_scenario, name='create_scenario'),
    path('api/scenarios/create/story/<str:story_id>/', create_scenario, name='create_scenario_for_story'),
    path('api/scenarios/create/project/<str:project_id>/', create_scenario, name='create_scenario_for_project'),
    path('api/scenarios/<str:scenario_id>/update/', update_scenario, name='update_scenario'),
    path('api/scenarios/<str:scenario_id>/delete/', delete_scenario, name='delete_scenario'),

    # ========== WIREFRAME ENDPOINTS ==========
    path('api/projects/<str:project_id>/wireframes/', list_wireframes, name='list_wireframes'),
    path('api/projects/<str:project_id>/wireframes/create/', create_wireframe, name='create_wireframe'),
    path('api/wireframes/<str:wireframe_id>/', get_wireframe, name='get_wireframe'),
    path('api/wireframes/<str:wireframe_id>/update/', update_wireframe, name='update_wireframe'),
    path('api/wireframes/<str:wireframe_id>/delete/', delete_wireframe, name='delete_wireframe'),

    # ========== EXPORT PREVIEW ENDPOINTS ==========
    path('api/exports/preview/<str:export_id>/', preview_export_by_id, name='preview-export-by-id'),
    path('api/projects/<str:project_id>/export-preview/', preview_project_export, name='preview-project-export'),
    path('api/exports/generate-preview/', generate_export_preview, name='generate-export-preview'),
    path('api/exports/', list_user_exports, name='list-user-exports'),

    # ========== RAG ENDPOINTS ==========
    path('api/rag/status/', get_rag_status, name='get_rag_status'),
    path('api/rag/query-patterns/', query_rag_patterns, name='query_rag_patterns'),
    path('api/rag/query-ui-patterns/', query_ui_patterns, name='query_ui_patterns'),

    # ========== GENERATION ENDPOINTS ==========
    # Project generation
    path('api/projects/<str:project_id>/generate-user-stories/', generate_user_stories, name='generate_user_stories'),
    path('api/projects/<str:project_id>/generate-wireframes/', generate_wireframes, name='generate_wireframes'),
    path('api/projects/<str:project_id>/generate-scenarios/', generate_scenarios, name='generate_scenarios'),
    path('api/projects/<str:project_id>/export-all-artifacts/', export_all_artifacts, name='export_all_artifacts'),
    path('api/projects/<str:project_id>/ai-edit-user-stories/', ai_edit_user_stories, name='ai_edit_user_stories'),

    # User story generation
    path('api/user-stories/<str:story_id>/generate-scenarios/', generate_story_scenarios, name='generate_story_scenarios'),
    path('api/local-projects/generate-user-stories/', generate_user_stories_for_local_project, name='generate_user_stories_for_local_project'),
    path('api/local-projects/generate-wireframes/', generate_wireframes_for_local_project, name='generate_wireframes_for_local_project'),
    path('api/user-stories/<str:story_id>/ai-edit/', ai_edit_user_story, name='ai_edit_user_story'),
    path('api/user-stories/<str:story_id>/ai-edit-scenarios/', ai_edit_story_scenarios, name='ai_edit_story_scenarios'),

    # Wireframe generation
    path('api/wireframes/<str:wireframe_id>/generate-creole/', generate_creole, name='generate_creole'),
    path('api/wireframes/<str:wireframe_id>/generate-salt-diagram/', generate_salt_diagram, name='generate_salt_diagram'),
    path('api/wireframes/<str:wireframe_id>/render-png-diagram/', render_png_diagram, name='render_png_diagram'),
    path('api/wireframes/<str:wireframe_id>/ai-edit/', ai_edit_wireframe, name='ai_edit_wireframe'),

    # Export preview endpoints
    path('api/exports/', list_user_exports, name='list_user_exports'),
    path('api/exports/preview/', preview_project_export, name='preview_project_export'),
    path('api/exports/<str:export_id>/preview/', preview_export_by_id, name='preview_export_by_id'),
    path('api/exports/generate-preview/', generate_export_preview, name='generate_export_preview'),
]
