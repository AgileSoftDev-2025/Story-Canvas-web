def serialize_user_story(user_story):
    """
    Serialize UserStory model to dictionary
    """
    return {
        'story_id': user_story.story_id,
        'project_id': user_story.project.project_id,
        'story_text': user_story.story_text,
        'role': user_story.role,
        'action': user_story.action,
        'benefit': user_story.benefit,
        'feature': user_story.feature,
        'acceptance_criteria': user_story.acceptance_criteria,
        'priority': user_story.priority,
        'story_points': user_story.story_points,
        'status': user_story.status,
        'generated_by_llm': user_story.generated_by_llm,
        'iteration': user_story.iteration,
        'created_at': user_story.created_at.isoformat() if user_story.created_at else None,
        'updated_at': user_story.updated_at.isoformat() if user_story.updated_at else None,
        'scenarios_count': user_story.scenarios_count,
    }

def serialize_user_story_with_project(user_story):
    """
    Serialize UserStory with project details
    """
    data = serialize_user_story(user_story)
    data['project'] = {
        'project_id': user_story.project.project_id,
        'title': user_story.project.title,
        'status': user_story.project.status
    }
    return data

def serialize_user_story_list(user_stories):
    """
    Serialize a list of UserStory objects
    """
    return [serialize_user_story_with_project(story) for story in user_stories]