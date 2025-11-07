# stories/views/auth/debug_auth.py
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from stories.models import CustomUser

@csrf_exempt
def debug_signin(request):
    """
    Debug signin endpoint - completely bypass CSRF
    POST /api/auth/debug-signin/
    """
    print("=== DEBUG SIGNIN CALLED ===")
    print("Method:", request.method)
    print("Headers:", dict(request.headers))
    
    try:
        body = request.body.decode('utf-8')
        print("Raw body:", body)
        data = json.loads(body)
        print("Parsed data:", data)
    except Exception as e:
        print("Body parse error:", e)
        return JsonResponse({
            'success': False,
            'error': f'JSON parse error: {str(e)}'
        }, status=400)

    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return JsonResponse({
            'success': False,
            'error': 'Username and password required'
        }, status=400)

    try:
        user = CustomUser.objects.get(username=username)
        print("User found:", user.username)
        
        if user.check_password(password):
            print("Password correct")
            return JsonResponse({
                'success': True,
                'message': 'Debug login successful',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                }
            })
        else:
            print("Password incorrect")
            return JsonResponse({
                'success': False,
                'error': 'Invalid credentials'
            }, status=401)
            
    except CustomUser.DoesNotExist:
        print("User not found")
        return JsonResponse({
            'success': False,
            'error': 'User not found'
        }, status=401)
    except Exception as e:
        print("Unexpected error:", e)
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)