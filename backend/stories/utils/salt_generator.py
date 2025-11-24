import re
import zlib
import base64
import os
import requests
from typing import List, Optional, Dict, Any
from pathlib import Path

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
                print(f"✅ PNG saved: {output_file}")
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
    Display PlantUML diagrams as URLs (Django-compatible version).
    EXACT SAME FUNCTIONALITY AS COLAB but without IPython dependency
    """
    print("\n" + "="*60)
    print("PLANTUML DIAGRAM URLs")
    print("="*60)
    
    for name, code in plantuml_code_dict.items():
        url = plantuml_url(code)
        print(f"\n📊 {name.replace('_', ' ').title()}:")
        print(f"🌍 View diagram at: {url}")
        
        # Try to provide a simple ASCII preview for terminal
        print("   📝 Preview: [Salt UML Diagram - Open URL above to view]")

def safe_filename(name: str) -> str:
    """Sanitize role/page names for filesystem use - EXACT SAME AS COLAB"""
    return re.sub(r'[^A-Za-z0-9_-]', '_', name.strip())

def save_plantuml_files(documentation: dict, base_dir: str = None):
    """
    Save PlantUML Salt wireframes for all roles/pages in documentation.
    Produces .puml files and live preview URLs.
    EXACT SAME AS COLAB
    """
    from datetime import datetime

    # Base dir with timestamp
    if base_dir is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        project_title = documentation.get('title', 'project')
        base_dir = f"docs_{safe_filename(project_title)}_{timestamp}"
    
    os.makedirs(base_dir, exist_ok=True)

    puml_dir = os.path.join(base_dir, "puml")
    os.makedirs(puml_dir, exist_ok=True)

    # Loop through every wireframe
    for role, creole_body in documentation.get("salt_wireframes", {}).items():
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
    return base_dir

def save_plantuml_png_files(salt_wireframes: dict, base_dir: str):
    """
    Render PlantUML SALT diagrams as PNG and save them locally
    EXACT SAME AS COLAB
    """
    Path(base_dir).mkdir(parents=True, exist_ok=True)
    
    png_count = 0
    for name, salt_code in salt_wireframes.items():
        safe_name = safe_filename(name)
        output_file = os.path.join(base_dir, f"{safe_name}.png")
        try:
            # Use your existing render function
            result = render_plantuml_png(salt_code, output_file=output_file)
            if result and os.path.exists(output_file):
                png_count += 1
                print(f"✅ Saved PNG for '{name}' at: {output_file}")
            else:
                print(f"⚠️ Failed to save PNG for '{name}'")
        except Exception as e:
            print(f"⚠️ Failed to render PNG for '{name}': {e}")

    print(f"📊 Total PNG files saved: {png_count}/{len(salt_wireframes)}")

def save_all_artifacts(project_info: dict, html_docs: dict, creole_docs: dict,
                      salt_wireframes: dict, timestamp: str) -> str:
    """
    Save all documentation artifacts to files, including PNG images
    EXACT SAME AS COLAB
    """
    project_name = project_info.get('title', 'project').replace(' ', '_').lower()
    base_dir = f"docs_{project_name}_{timestamp}"
    os.makedirs(base_dir, exist_ok=True)

    # Save HTML files
    html_dir = os.path.join(base_dir, "html")
    os.makedirs(html_dir, exist_ok=True)

    html_count = 0
    for role, html_content in html_docs.get("role_pages", {}).items():
        # FIX: Replace all problematic characters including forward slashes
        safe_role = role.replace('/', '_').replace('\\', '_').replace(' ', '_').lower()
        filename = f"{safe_role}.html"
        filepath = os.path.join(html_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        html_count += 1
        print(f"✅ Saved HTML: {filepath}")

    # Save Creole files
    creole_dir = os.path.join(base_dir, "creole")
    os.makedirs(creole_dir, exist_ok=True)

    creole_count = 0
    for name, creole_content in creole_docs.items():
        # FIX: Same sanitization for creole files
        safe_name = name.replace('/', '_').replace('\\', '_').replace(' ', '_').lower()
        filepath = os.path.join(creole_dir, f"{safe_name}.creole")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(creole_content)
        creole_count += 1
        print(f"✅ Saved Creole: {filepath}")

    # Save PNG images
    png_dir = os.path.join(base_dir, "png")
    os.makedirs(png_dir, exist_ok=True)

    png_count = 0
    for name, salt_code in salt_wireframes.items():
        # FIX: Same sanitization for PNG files
        safe_name = name.replace('/', '_').replace('\\', '_').replace(' ', '_').lower()
        output_file = os.path.join(png_dir, f"{safe_name}.png")

        try:
            # Use the render function that returns URL when output_file is provided
            result = render_plantuml_png(salt_code, output_file=output_file)
            if result and os.path.exists(output_file):
                png_count += 1
                print(f"✅ Saved PNG: {output_file}")
            else:
                print(f"⚠️ Failed to save PNG for '{name}'")
        except Exception as e:
            print(f"⚠️ Failed to save PNG for '{name}': {e}")
            # Create a placeholder file to avoid further errors
            with open(output_file, 'w') as f:
                f.write("PNG generation failed")

    print(f"\n✅ All artifacts saved to: {base_dir}/")
    print(f"   📄 HTML Pages: {html_count}")
    print(f"   📝 Creole Files: {creole_count}")
    print(f"   🎨 PNG Images: {png_count}")
    print(f"   🔗 PlantUML URLs: {len(salt_wireframes)}")
    
    return base_dir

def generate_complete_documentation_pipeline(project_info: Dict, user_stories: List[Dict], rag_db: Any = None) -> Dict:
    """
    RAG-enhanced complete pipeline: HTML → Creole → Salt UML → PNG
    EXACT SAME AS COLAB but adapted for Django
    """
    print("\n" + "=" * 60)
    print("RAG-ENHANCED DOCUMENTATION PIPELINE")
    print("=" * 60)

    # 1. Generate HTML documentation with RAG patterns
    print("📝 Step 1: Generating RAG-enhanced HTML documentation...")
    from stories.utils.wireframe_generator import WireframeGenerator
    html_generator = WireframeGenerator()
    html_docs = html_generator.generate_html_documentation(project_info, user_stories, rag_db)

    # 2. Convert HTML to Creole format
    print("🔄 Step 2: Converting HTML to Creole format...")
    from stories.utils.creole_converter import convert_html_to_creole
    creole_docs = {}
    for role, html_content in html_docs["role_pages"].items():
        creole_docs[role] = convert_html_to_creole(html_content)

    # 3. Generate Salt UML wireframes
    print("🎨 Step 3: Generating Salt UML wireframes...")
    salt_wireframes = generate_all_salt_wireframes(html_docs)

    # 4. Save all artifacts
    print("💾 Step 4: Saving all documentation artifacts...")
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_dir = save_all_artifacts(project_info, html_docs, creole_docs, salt_wireframes, timestamp)

    return {
        "html_docs": html_docs,
        "creole_docs": creole_docs,
        "salt_wireframes": salt_wireframes,
        "timestamp": timestamp,
        "base_dir": base_dir,
        "used_rag_patterns": rag_db is not None
    }