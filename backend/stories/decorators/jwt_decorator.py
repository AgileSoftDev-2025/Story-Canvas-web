# stories/decorators/jwt_decorator.py
from functools import wraps
from django.http import JsonResponse, HttpResponse
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

def jwt_token(view_func):
    """
    @jwt_token decorator - Requires valid JWT token for the endpoint
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Handle OPTIONS method (preflight requests) explicitly
        if request.method == 'OPTIONS':
            response = HttpResponse()
            response["Access-Control-Allow-Origin"] = "http://localhost:5173"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Max-Age"] = "86400"
            return response
            
        try:
            # Authenticate using JWT
            jwt_auth = JWTAuthentication()
            auth_result = jwt_auth.authenticate(request)
            
            if auth_result is None:
                response = JsonResponse({
                    'success': False,
                    'error': 'Authentication required. Please provide a valid JWT token in Authorization header.'
                }, status=status.HTTP_401_UNAUTHORIZED)
                response["Access-Control-Allow-Origin"] = "http://localhost:5173"
                return response
            
            user, token = auth_result
            request.user = user
            request.token = token
            
            # Check if user is active
            if not user.is_active:
                response = JsonResponse({
                    'success': False,
                    'error': 'User account is disabled'
                }, status=status.HTTP_401_UNAUTHORIZED)
                response["Access-Control-Allow-Origin"] = "http://localhost:5173"
                return response
            
            # Call the original view function
            result = view_func(request, *args, **kwargs)
            
            # Ensure CORS headers are added to successful responses
            if isinstance(result, (JsonResponse, HttpResponse)):
                result["Access-Control-Allow-Origin"] = "http://localhost:5173"
                result["Access-Control-Allow-Credentials"] = "true"
            
            return result
            
        except (InvalidToken, AuthenticationFailed) as e:
            response = JsonResponse({
                'success': False,
                'error': 'Invalid or expired token',
                'detail': str(e)
            }, status=status.HTTP_401_UNAUTHORIZED)
            response["Access-Control-Allow-Origin"] = "http://localhost:5173"
            return response
        except Exception as e:
            response = JsonResponse({
                'success': False,
                'error': 'Authentication failed',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            response["Access-Control-Allow-Origin"] = "http://localhost:5173"
            return response
    
    return _wrapped_view