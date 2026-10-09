import os
import re

target_dir = r'c:\Users\legion-5pro\Documents\restie'
pixel_id = '29080819768207553'

for root, _, files in os.walk(target_dir):
    if 'node_modules' in root or '.git' in root or 'admin-app' in root:
        continue
        
    # Calculate depth to determine script path
    rel_path = os.path.relpath(root, target_dir)
    depth = 0 if rel_path == '.' else len(rel_path.split(os.sep))
    script_path = ('../' * depth) + 'meta-pixel.js'
    
    snippet = f"""
<!-- Meta Pixel -->
<script src="{script_path}"></script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id={pixel_id}&ev=PageView&noscript=1"/></noscript>
</head>"""

    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if '<!-- Meta Pixel -->' not in content and '</head>' in content:
                # Replace the last occurrence of </head> (case insensitive)
                content = re.sub(r'</head>', snippet, content, flags=re.IGNORECASE, count=1)
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Added pixel to {filepath}")
