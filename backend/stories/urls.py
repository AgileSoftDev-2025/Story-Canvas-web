from django.urls import path
from stories.views.project_description import (
    get_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
    get_project_stats
)

from stories.views.health import health_check

from stories.views.project_description import (
    get_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
    get_project_stats
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
    generate_user_stories
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
    # ========== AUTH ENDPOINTS ==========
    path('auth/debug-signin/', debug_signin, name='debug_signin'),
    path('auth/signup/', signup, name='signup'),
    path('auth/signin/', signin, name='signin'),
    path('auth/user/', current_user, name='current_user'),
    path('auth/signout/', signout, name='signout'),
    path('auth/refresh/', refresh_token, name='refresh_token'),

    # User Stories endpoints
    path('user-stories/', get_user_stories, name='get_user_stories'),
    path('user-stories/create/', create_user_story, name='create_user_story'),
    path('user-stories/<str:story_id>/', get_user_story_detail, name='get_user_story_detail'),
    path('user-stories/<str:story_id>/update/', update_user_story, name='update_user_story'),
    path('user-stories/<str:story_id>/delete/', delete_user_story, name='delete_user_story'),
    path('user-stories/status/<str:status>/', get_user_stories_by_status, name='get_user_stories_by_status'),
    path('user-stories/priority/<str:priority>/', get_user_stories_by_priority, name='get_user_stories_by_priority'),
    # User Stories endpoints
    path('user-stories/', get_user_stories, name='get_user_stories'),
    path('user-stories/create/', create_user_story, name='create_user_story'),
    path('user-stories/<str:story_id>/', get_user_story_detail, name='get_user_story_detail'),
    path('user-stories/<str:story_id>/update/', update_user_story, name='update_user_story'),
    path('user-stories/<str:story_id>/delete/', delete_user_story, name='delete_user_story'),
    path('user-stories/status/<str:status>/', get_user_stories_by_status, name='get_user_stories_by_status'),
    path('user-stories/priority/<str:priority>/', get_user_stories_by_priority, name='get_user_stories_by_priority'),

    # ========== COMMENT/HAPUS USER STORY PAGE ENDPOINTS (SEMENTARA) ==========
    # path('projects/<str:project_id>/user-story-page/', get_user_story_page, name='get_user_story_page'),
    # path('projects/<str:project_id>/user-story-page/create/', create_user_story_page, name='create_user_story_page'),
    # path('projects/<str:project_id>/user-story-page/update/', update_user_story_page, name='update_user_story_page'),
    # path('projects/<str:project_id>/user-story-page/accept/', accept_user_story_page, name='accept_user_story_page'),
    # path('projects/<str:project_id>/user-story-page/status/', get_user_story_page_status, name='get_user_story_page_status'),

    # ========== PROJECT-SPECIFIC USER STORIES ==========
    path('projects/<str:project_id>/user-stories/', get_project_user_stories, name='get_project_user_stories'),
    
    # User Story Scenario endpoints
    path('user-stories/<str:story_id>/scenarios/', get_story_scenarios, name='get_story_scenarios'),
    
    # Authentication endpoints

    # Health check endpoint
    path('health/', health_check, name='health_check'),

    # Project endpoints
    path('projects/', get_projects, name='get_projects'),
    path('projects/create/', create_project, name='create_project'),
    path('projects/<str:project_id>/', get_project, name='get_project'),
    path('projects/<str:project_id>/update/', update_project, name='update_project'),
    path('projects/<str:project_id>/delete/', delete_project, name='delete_project'),
    path('projects/<str:project_id>/stats/', get_project_stats, name='get_project_stats'),
    path('projects/<str:project_id>/generate-user-stories/', generate_user_stories, name='generate_user_stories'),


    # ========== WIREFRAME ENDPOINTS ==========
    path('projects/<str:project_id>/wireframes/', list_wireframes, name='list_wireframes'),
    path('projects/<str:project_id>/wireframes/create/', create_wireframe, name='create_wireframe'),
    
    # Single wireframe operations
    path('wireframes/<str:wireframe_id>/', get_wireframe, name='get_wireframe'),
    path('wireframes/<str:wireframe_id>/update/', update_wireframe, name='update_wireframe'),
    path('wireframes/<str:wireframe_id>/delete/', delete_wireframe, name='delete_wireframe'),

    # ========== SCENARIO ENDPOINTS ==========
    path('projects/<str:project_id>/scenarios/', get_project_scenarios, name='get_project_scenarios'),
    path('user-stories/<str:story_id>/scenarios/', get_story_scenarios, name='get_story_scenarios'),
    
    # Scenario CRUD endpoints
    path('scenarios/create/', create_scenario, name='create_scenario'),
    path('scenarios/create/story/<str:story_id>/', create_scenario, name='create_scenario_for_story'),
    path('scenarios/create/project/<str:project_id>/', create_scenario, name='create_scenario_for_project'),
    path('scenarios/<str:scenario_id>/update/', update_scenario, name='update_scenario'),
    path('scenarios/<str:scenario_id>/delete/', delete_scenario, name='delete_scenario'),

    # ========== EXPORT ENDPOINTS ==========
    path('exports/preview/<str:export_id>/', preview_export_by_id, name='preview-export-by-id'),
    path('projects/<str:project_id>/export-preview/', preview_project_export, name='preview-project-export'),
    path('projects/<str:project_id>/generate-export-preview/', generate_export_preview, name='generate-export-preview'),
    path('exports/my-exports/', list_user_exports, name='list-user-exports'),

    # ========== RAG ENDPOINTS ==========
    path('rag/status/', get_rag_status, name='get_rag_status'),
    path('rag/query-patterns/', query_rag_patterns, name='query_rag_patterns'),
    path('rag/query-ui-patterns/', query_ui_patterns, name='query_ui_patterns'),

    # ========== PROJECT GENERATION ENDPOINTS ==========
    path('projects/<str:project_id>/generate-user-stories/', generate_user_stories, name='generate_user_stories'),
    path('projects/<str:project_id>/generate-wireframes/', generate_wireframes, name='generate_wireframes'),
    path('projects/<str:project_id>/generate-scenarios/', generate_scenarios, name='generate_scenarios'),
    path('projects/<str:project_id>/export-all-artifacts/', export_all_artifacts, name='export_all_artifacts'),
    path('projects/<str:project_id>/ai-edit-user-stories/', ai_edit_user_stories, name='ai_edit_user_stories'),

    # ========== USER STORY GENERATION ENDPOINTS ==========
    path('user-stories/<str:story_id>/generate-scenarios/', generate_story_scenarios, name='generate_story_scenarios'),
    path('user-stories/<str:story_id>/ai-edit/', ai_edit_user_story, name='ai_edit_user_story'),
    path('user-stories/<str:story_id>/ai-edit-scenarios/', ai_edit_story_scenarios, name='ai_edit_story_scenarios'),

    # ========== WIREFRAME GENERATION ENDPOINTS ==========
    path('wireframes/<str:wireframe_id>/generate-creole/', generate_creole, name='generate_creole'),
    path('wireframes/<str:wireframe_id>/generate-salt-diagram/', generate_salt_diagram, name='generate_salt_diagram'),
    path('wireframes/<str:wireframe_id>/render-png-diagram/', render_png_diagram, name='render_png_diagram'),
    path('wireframes/<str:wireframe_id>/ai-edit/', ai_edit_wireframe, name='ai_edit_wireframe'),
]