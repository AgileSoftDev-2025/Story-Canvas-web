from django.http import JsonResponse
from django.middleware.csrf import get_token
from stories.utils.decorators import api_view

@api_view(['GET'])
def get_csrf_token(request):
    """
    Get CSRF token
    GET /api/auth/csrf/
    """
    return JsonResponse({
        'success': True,
        'csrfToken': get_token(request)
    }, status=200)