from django.http import JsonResponse
from stories.utils.decorators import api_view

@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint
    GET /health/
    """
    return JsonResponse({
        'status': 'healthy',
        'service': 'Story Canvas API',
        'version': '1.0.0'
    }, status=200)