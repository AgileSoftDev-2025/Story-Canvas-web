"""
Single PlantUML PNG Generation API
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import json
import base64
import string
import zlib
from stories.utils.plantuml_generator import generate_wireframe_with_diagram

# PlantUML Alphabet
PLANTUML_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"

@method_decorator(csrf_exempt, name='dispatch')
class PlantUMLGeneratePNG(View):
    """
    Single API endpoint to generate PlantUML PNG from Salt UML code
    POST /api/plantuml/generate-png/
    
    Request body:
    {
        "salt_code": "@startuml\\n@startsalt\\n{^ \"Login Page\"\\nUsername: \"Enter username\"\\n}\\n@endsalt\\n@enduml"
    }
    """
    
    def post(self, request):
        try:
            # Parse request data
            data = json.loads(request.body)
            salt_code = data.get('salt_code', '')
            
            if not salt_code:
                return JsonResponse({
                    'success': False,
                    'error': 'salt_code is required'
                }, status=400)
            
            # Generate PlantUML URL
            plantuml_url = self.generate_plantuml_url(salt_code)
            
            if not plantuml_url:
                return JsonResponse({
                    'success': False,
                    'error': 'Failed to encode PlantUML'
                }, status=500)
            
            return JsonResponse({
                'success': True,
                'message': 'PlantUML PNG URL generated',
                'png_url': plantuml_url,
                'salt_length': len(salt_code)
            })
            
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON format'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    
    def plantuml_encode(self, text: str) -> str:
        """
        Encode PlantUML text into PlantUML server format
        """
        try:
            zlibbed_str = zlib.compress(text.encode("utf-8"))
            # strip zlib header (2 bytes) and checksum (last 4 bytes)
            compressed_str = zlibbed_str[2:-4]
            
            def encode3bytes(b1, b2, b3):
                c1 = b1 >> 2
                c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
                c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
                c4 = b3 & 0x3F
                return (PLANTUML_ALPHABET[c1] + PLANTUML_ALPHABET[c2] +
                        PLANTUML_ALPHABET[c3] + PLANTUML_ALPHABET[c4])
            
            res = ""
            i = 0
            length = len(compressed_str)
            while i < length:
                b1 = compressed_str[i]
                b2 = compressed_str[i+1] if i+1 < length else 0
                b3 = compressed_str[i+2] if i+2 < length else 0
                res += encode3bytes(b1, b2, b3)
                i += 3
            return res
        except Exception as e:
            print(f"❌ PlantUML encoding error: {e}")
            return ""
    
    def generate_plantuml_url(self, salt_code: str) -> str:
        """
        Generate PlantUML PNG URL from Salt code
        """
        encoded = self.plantuml_encode(salt_code)
        if not encoded:
            return ""
        
        return f"https://www.plantuml.com/plantuml/png/{encoded}"
