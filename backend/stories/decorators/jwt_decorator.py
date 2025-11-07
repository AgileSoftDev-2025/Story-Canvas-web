# stories/decorators/jwt_decorator.py
from functools import wraps
from django.http import JsonResponse
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

def jwt_token(view_func):
    """
    @jwt_token decorator - Requires valid JWT token for the endpoint
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Skip authentication for OPTIONS method (preflight requests)
        if request.method == 'OPTIONS':
            return view_func(request, *args, **kwargs)
            
        try:
            # Authenticate using JWT
            jwt_auth = JWTAuthentication()
            auth_result = jwt_auth.authenticate(request)
            
            if auth_result is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication required. Please provide a valid JWT token in Authorization header.'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            user, token = auth_result
            request.user = user
            request.token = token
            
            # Check if user is active
            if not user.is_active:
                return JsonResponse({
                    'success': False,
                    'error': 'User account is disabled'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            return view_func(request, *args, **kwargs)
            
        except (InvalidToken, AuthenticationFailed) as e:
            return JsonResponse({
                'success': False,
                'error': 'Invalid or expired token',
                'detail': str(e)
            }, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': 'Authentication failed',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return _wrapped_view