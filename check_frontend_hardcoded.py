#!/usr/bin/env python3

import os
import re

def check_frontend_hardcoded():
    """Check for hardcoded values in frontend files"""
    
    hardcoded_patterns = [
        r'\b\d{2,3}\.\d{2}%',  # Percentage values like 137.71%
        r'\b[1-9]\d{2,}\.\d{2}%',  # Large percentage values
        r'720\.00%',  # Specific hardcoded value
        r'137\.71%',  # Specific hardcoded value
        r'105\.00%',  # Specific hardcoded value
        r'244\.16%',  # Specific hardcoded value
        r'0\.34',     # Average correlation hardcoded
        r'fallback',  # Fallback data references
        r'mock',      # Mock data references
        r'hardcoded', # Hardcoded references
    ]
    
    frontend_dirs = [
        'web/js',
        'web/html',
        'web/css'
    ]
    
    issues_found = []
    
    for dir_path in frontend_dirs:
        if not os.path.exists(dir_path):
            continue
            
        for root, dirs, files in os.walk(dir_path):
            for file in files:
                if file.endswith(('.js', '.html', '.css')):
                    file_path = os.path.join(root, file)
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                        for i, line in enumerate(content.split('\n'), 1):
                            for pattern in hardcoded_patterns:
                                matches = re.findall(pattern, line, re.IGNORECASE)
                                if matches:
                                    issues_found.append({
                                        'file': file_path,
                                        'line': i,
                                        'pattern': pattern,
                                        'matches': matches,
                                        'content': line.strip()
                                    })
                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")
    
    print("=== FRONTEND HARDCODED VALUES CHECK ===")
    
    if not issues_found:
        print("✓ No hardcoded values found in frontend files")
        return
    
    print(f"Found {len(issues_found)} potential hardcoded values:")
    print()
    
    for issue in issues_found:
        print(f"File: {issue['file']}")
        print(f"Line {issue['line']}: {issue['content']}")
        print(f"Pattern: {issue['pattern']}")
        print(f"Matches: {issue['matches']}")
        print("-" * 50)

if __name__ == "__main__":
    check_frontend_hardcoded()