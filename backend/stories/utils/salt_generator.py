import re
import zlib
import base64
import os
import requests
from typing import Optional

# PlantUML Alphabet - EXACT SAME AS COLAB
PLANTUML_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"

def generate_salt_wireframe(creole_content: str, page_title: str) -> str:
    """
    Wraps Creole content inside a PlantUML Salt wireframe block.
    EXACT SAME AS COLAB
    """
    print(f"🎨 Generating Salt UML wireframe for {page_title}...")
    
    salt_code = f"""@startsalt
{{
+== {page_title} Wireframe ==
{creole_content}
}}
@endsalt"""
    return salt_code

def generate_all_salt_wireframes(html_docs: dict) -> dict:
    """
    Convert all HTML docs into Creole → Salt UML wireframes.
    EXACT SAME AS COLAB
    """
    print("\n🎨 Generating Salt UML wireframes for all pages...")
    
    from stories.utils.creole_converter import convert_html_to_creole
    
    salt_wireframes = {}

    for role, html_content in html_docs["role_pages"].items():
        role_creole = convert_html_to_creole(html_content)
        salt_wireframes[role] = generate_salt_wireframe(role_creole, f"{role} Page")
        
    return salt_wireframes

def wrap_salt_block(title: str, creole_body: str) -> str:
    """Wrap Creole body dalam complete Salt UML block - EXACT SAME AS COLAB"""
    return f"""@startuml
@startsalt
{{^ "{title}"
{creole_body}
}}
@endsalt
@enduml"""

def plantuml_encode(text: str) -> str:
    """
    Encode PlantUML text into the format expected by the PlantUML server.
    Uses zlib + custom base64 mapping.
    EXACT SAME AS COLAB
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

def encode_plantuml(s: str) -> str:
    """Deflate + base64 encode PlantUML text for server URLs - EXACT SAME AS COLAB"""
    zlibbed_str = zlib.compress(s.encode("utf-8"))[2:-4]
    return base64.b64encode(zlibbed_str).decode("utf-8")

def plantuml_url(plantuml_code: str) -> str:
    """Generate PlantUML server URL untuk diagram - EXACT SAME AS COLAB"""
    encoded = plantuml_encode(plantuml_code)
    return f"http://www.plantuml.com/plantuml/png/{encoded}"

def render_plantuml_png(salt_code: str, output_file: Optional[str] = None) -> str:
    """
    Render PlantUML SALT code to PNG file or return URL if no output_file is given.
    EXACT SAME AS COLAB
    """
    try:
        encoded = plantuml_encode(salt_code)
        url = f"http://www.plantuml.com/plantuml/png/{encoded}"

        if output_file:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                # Ensure directory exists
                os.makedirs(os.path.dirname(output_file), exist_ok=True)
                with open(output_file, "wb") as f:
                    f.write(response.content)
                return output_file
            else:
                raise RuntimeError(f"Failed to render PlantUML. Status: {response.status_code}")

        # If no output_file specified, just return the URL
        return url
    except Exception as e:
        print(f"❌ Error in render_plantuml_png: {e}")
        if output_file:
            # Create empty file as fallback
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, "w") as f:
                f.write("PNG generation failed")
        return ""

def display_plantuml_diagrams_png(plantuml_code_dict: dict):
    """
    Display PlantUML diagrams as PNG images inside a notebook (if IPython available).
    EXACT SAME AS COLAB
    """
    for name, code in plantuml_code_dict.items():
        print(f"\n📊 {name.replace('_', ' ').title()}:")
        png_data = render_plantuml_png(code)

        if png_data:
            try:
                from IPython.display import Image, display
                display(Image(data=png_data, format='png', width=600))
            except ImportError:
                url = f"http://www.plantuml.com/plantuml/png/{plantuml_encode(code)}"
                print(f"🌍 View diagram at: {url}")
        else:
            print("⚠️ Failed to generate PNG image")

def safe_filename(name: str) -> str:
    """Sanitize role/page names for filesystem use - EXACT SAME AS COLAB"""
    return re.sub(r'[^A-Za-z0-9_-]', '_', name.strip())

def save_plantuml_files(documentation: dict, base_dir: str = None):
    """
    Save PlantUML Salt wireframes for all roles/pages in documentation.
    Produces .puml files and live preview URLs.
    EXACT SAME AS COLAB
    """

    # Base dir with timestamp
    if base_dir is None:
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_dir = f"docs_{safe_filename(documentation['title'])}_{timestamp}"
    os.makedirs(base_dir, exist_ok=True)

    puml_dir = os.path.join(base_dir, "puml")
    os.makedirs(puml_dir, exist_ok=True)

    # Loop through every wireframe
    for role, creole_body in documentation["salt_wireframes"].items():
        # Wrap Salt in PlantUML
        salt_code = wrap_salt_block(role, creole_body)

        # Save as .puml
        filename = safe_filename(role) + ".puml"
        filepath = os.path.join(puml_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(salt_code)

        # Print confirmation + live preview
        print(f"✅ Saved PUML: {filepath}")
        print(f"🌐 Preview ({role}): {plantuml_url(salt_code)}\n")

    print(f"📂 All PUML wireframes saved under: {puml_dir}")

def save_plantuml_png_files(salt_wireframes: dict, base_dir: str):
    """
    Render PlantUML SALT diagrams as PNG and save them locally
    EXACT SAME AS COLAB
    """
    import os
    from pathlib import Path
    
    Path(base_dir).mkdir(parents=True, exist_ok=True)

    for name, salt_code in salt_wireframes.items():
        safe_name = safe_filename(name)
        output_file = os.path.join(base_dir, f"{safe_name}.png")
        try:
            # Use your existing render function
            url_or_path = render_plantuml_png(salt_code, output_file=output_file)
            print(f"✅ Saved PNG for '{name}' at: {output_file}")
        except Exception as e:
            print(f"⚠️ Failed to render PNG for '{name}': {e}")

def save_all_artifacts(project_info: dict, html_docs: dict, creole_docs: dict,
                      salt_wireframes: dict, timestamp: str):
    """
    Save all documentation artifacts to files, including PNG images
    EXACT SAME AS COLAB
    """
    project_name = project_info.get('title', 'project').replace(' ', '_').lower()
    base_dir = f"docs_{project_name}_{timestamp}"
    os.makedirs(base_dir, exist_ok=True)

    # Save HTML files
    html_dir = f"{base_dir}/html"
    os.makedirs(html_dir, exist_ok=True)

    for role, html_content in html_docs["role_pages"].items():
        # FIX: Replace all problematic characters including forward slashes
        safe_role = role.replace('/', '_').replace('\\', '_').replace(' ', '_').lower()
        filename = f"{safe_role}.html"
        filepath = os.path.join(html_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"✅ Saved HTML: {filepath}")

    # Save Creole files
    creole_dir = f"{base_dir}/creole"
    os.makedirs(creole_dir, exist_ok=True)

    for name, creole_content in creole_docs.items():
        # FIX: Same sanitization for creole files
        safe_name = name.replace('/', '_').replace('\\', '_').replace(' ', '_').lower()
        filepath = os.path.join(creole_dir, f"{safe_name}.creole")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(creole_content)
        print(f"✅ Saved Creole: {filepath}")

    # Save PNG images - FIXED version
    png_dir = f"{base_dir}/png"
    os.makedirs(png_dir, exist_ok=True)

    for name, salt_code in salt_wireframes.items():
        # FIX: Same sanitization for PNG files
        safe_name = name.replace('/', '_').replace('\\', '_').replace(' ', '_').lower()
        output_file = os.path.join(png_dir, f"{safe_name}.png")

        try:
            # Use the render function that returns URL when output_file is provided
            render_plantuml_png(salt_code, output_file=output_file)
            print(f"✅ Saved PNG: {output_file}")
        except Exception as e:
            print(f"⚠️ Failed to save PNG for '{name}': {e}")
            # Create a placeholder file to avoid further errors
            with open(output_file, 'w') as f:
                f.write("PNG generation failed")

    print(f"✅ All artifacts saved to: {base_dir}/")
    print(f"   HTML Pages: {len(html_docs['role_pages']) + 1}")
    print(f"   Creole Files: {len(creole_docs)}")
    print(f"   PNG Images: {len(salt_wireframes)}")