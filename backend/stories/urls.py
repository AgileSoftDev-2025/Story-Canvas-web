from django.urls import path

# Import langsung dari file masing-masing, jangan dari __init__.py
from .views.user_story_views import (
    get_user_stories,
    get_user_story_detail,
    create_user_story,
    update_user_story,
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


# stories/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, UserStoryViewSet, GenerationSessionViewSet, RAGAPIView

router = DefaultRouter()
router.register(r'projects', ProjectViewSet)
router.register(r'user-stories', UserStoryViewSet)
router.register(r'generation-sessions', GenerationSessionViewSet)
router.register(r'rag', RAGAPIView, basename='rag')

urlpatterns = [
    path('api/', include(router.urls)),
]

# stories/urls.py (project level)
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('stories.urls')),
]