from django.urls import path
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

urlpatterns = [
    # User Story endpoints dengan prefix 'api/'
    path('api/user-stories/', get_user_stories, name='get_user_stories'),
    path('api/user-stories/create/', create_user_story, name='create_user_story'),
    path('api/user-stories/<str:story_id>/', get_user_story_detail, name='get_user_story_detail'),
    path('api/user-stories/<str:story_id>/update/', update_user_story, name='update_user_story'),
    path('api/user-stories/<str:story_id>/delete/', delete_user_story, name='delete_user_story'),
    path('api/user-stories/status/<str:status>/', get_user_stories_by_status, name='get_user_stories_by_status'),
    path('api/user-stories/priority/<str:priority>/', get_user_stories_by_priority, name='get_user_stories_by_priority'),
    
    # Project-specific user stories
    path('api/projects/<str:project_id>/user-stories/', get_project_user_stories, name='get_project_user_stories'),
]