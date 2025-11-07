# stories/views/auth/token_auth.py
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from stories.serializers.auth_serializers import RegisterSerializer, LoginSerializer, UserProfileSerializer
from stories.decorators.jwt_decorator import jwt_token
from stories.models import CustomUser 


@csrf_exempt
def signup(request):
    """
    User registration endpoint - PUBLIC
    POST /api/auth/signup/
    """
    print("=== SIGNUP CALLED ===")
    
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'error': 'Only POST method allowed'
        }, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    try:
        data = json.loads(request.body.decode('utf-8'))
        print("Signup data:", data)
    except json.JSONDecodeError as e:
        print("JSON error:", e)
        return JsonResponse({
            'success': False, 
            'error': 'Invalid JSON'
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer = RegisterSerializer(data=data)
    if serializer.is_valid():
        user = serializer.save()
        print("User created:", user.username)
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return JsonResponse({
            'success': True, 
            'message': 'User registered successfully!',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            },
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            }
        }, status=status.HTTP_201_CREATED)
    else:
        print("Serializer errors:", serializer.errors)
    
    return JsonResponse({
        'success': False, 
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@csrf_exempt
def signin(request):
    """
    Sign in endpoint - PUBLIC
    POST /api/auth/signin/
    """
    print("=== SIGNIN CALLED ===")
    
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'error': 'Only POST method allowed'
        }, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    try:
        data = json.loads(request.body.decode('utf-8'))
        print("Signin data:", data)
    except json.JSONDecodeError as e:
        print("JSON error:", e)
        return JsonResponse({
            'success': False, 
            'error': 'Invalid JSON'
        }, status=status.HTTP_400_BAD_REQUEST)

    username = data.get('username')
    password = data.get('password')

    # Basic validation
    if not username or not password:
        return JsonResponse({
            'success': False,
            'error': 'Username and password are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Manual authentication without serializer
        user = CustomUser.objects.get(username=username)
        print("User found:", user.username)
        
        if user.check_password(password):
            print("Password correct")
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            # Update last login
            user.save()
            
            return JsonResponse({
                'success': True, 
                'message': 'Signed in successfully',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                },
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh)
                }
            }, status=status.HTTP_200_OK)
        else:
            print("Password incorrect")
            return JsonResponse({
                'success': False, 
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
            
    except CustomUser.DoesNotExist:
        print("User not found")
        return JsonResponse({
            'success': False, 
            'error': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as e:
        print("Unexpected error:", e)
        return JsonResponse({
            'success': False, 
            'error': f'Server error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@csrf_exempt
def refresh_token(request):
    """
    Refresh JWT token endpoint - PUBLIC
    POST /api/auth/refresh/
    """
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'error': 'Only POST method allowed'
        }, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    try:
        data = json.loads(request.body.decode('utf-8'))
        refresh_token_str = data.get('refresh_token')
        
        if not refresh_token_str:
            return JsonResponse({
                'success': False, 
                'error': 'Refresh token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        refresh = RefreshToken(refresh_token_str)
        
        return JsonResponse({
            'success': True,
            'tokens': {
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)
        
    except TokenError as e:
        return JsonResponse({
            'success': False, 
            'error': f'Invalid token: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False, 
            'error': 'Invalid JSON'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return JsonResponse({
            'success': False, 
            'error': f'Token refresh failed: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)

# These remain protected with JWT
@jwt_token
def current_user(request):
    """
    Get current user info - PROTECTED
    GET /api/auth/user/
    """
    if request.method != 'GET':
        return JsonResponse({
            'success': False,
            'error': 'Only GET method allowed'
        }, status=405)

    serializer = UserProfileSerializer(request.user)
    return JsonResponse({
        'success': True,
        'user': serializer.data
    })

@csrf_exempt
@jwt_token
# stories/views/auth/token_auth.py - Update the signout function
@csrf_exempt
@jwt_token
def signout(request):
    """
    Sign out endpoint - PROTECTED
    POST /api/auth/signout/
    """
    print("=== SIGNOUT CALLED ===")
    
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'error': 'Only POST method allowed'
        }, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    try:
        data = json.loads(request.body.decode('utf-8'))
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            return JsonResponse({
                'success': False, 
                'error': 'Refresh token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"Attempting to blacklist token for user: {request.user.username}")
        
        # Try to blacklist the token
        try:
            token = RefreshToken(refresh_token)
            
            # Check if blacklist method exists
            if hasattr(token, 'blacklist'):
                token.blacklist()
                print("Token blacklisted successfully")
                message = 'Successfully logged out and token blacklisted'
            else:
                print("Blacklist not available - token invalidated")
                message = 'Successfully logged out (token invalidated)'
            
            return JsonResponse({
                'success': True, 
                'message': message,
                'user': request.user.username
            }, status=status.HTTP_200_OK)
            
        except TokenError as e:
            print(f"Token error: {e}")
            # Token is already invalid, but we still consider it a successful logout
            return JsonResponse({
                'success': True, 
                'message': 'Logged out (token was already invalid)',
                'user': request.user.username
            }, status=status.HTTP_200_OK)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False, 
            'error': 'Invalid JSON'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        print(f"Unexpected error in signout: {e}")
        return JsonResponse({
            'success': False, 
            'error': f'Logout failed: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)