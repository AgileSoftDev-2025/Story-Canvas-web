import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required

def handle_json_request(view_func):
    """
    Decorator to handle JSON parsing and common exceptions
    """
    def wrapper(request, *args, **kwargs):
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                if request.body:
                    request.json_data = json.loads(request.body)
                else:
                    request.json_data = {}
            except json.JSONDecodeError:
                return JsonResponse({
                    'success': False,
                    'message': 'Invalid JSON data'
                }, status=400)
        
        return view_func(request, *args, **kwargs)
    return wrapper

def api_view(methods=['GET']):
    """
    Decorator for API views that handles method checking
    """
    def decorator(view_func):
        @csrf_exempt
        @handle_json_request
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return JsonResponse({
                    'success': False,
                    'message': f'Method {request.method} not allowed. Allowed: {", ".join(methods)}'
                }, status=405)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

def auth_required(view_func):
    """
    Decorator for views that require authentication
    """
    @login_required
    @api_view()
    def wrapper(request, *args, **kwargs):
        return view_func(request, *args, **kwargs)
    return wrapper