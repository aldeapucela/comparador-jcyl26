import json
import os
import glob
import argparse

def merge_json_blocks(data_dir, output_filename, pattern="psoe_*.json"):
    """
    Merges multiple JSON partial blocks into a single structured file.
    """
    files = sorted(glob.glob(os.path.join(data_dir, pattern)))
    if not files:
        # Fallback if names don't follow pattern strictly
        files = sorted([os.path.join(data_dir, f) for f in os.listdir(data_dir) if f.endswith('.json') and '_batch' in f or any(char.isdigit() for char in f)])
    
    if not files:
        print("No partial files found to merge.")
        return

    all_propuestas = []
    final_data = {}
    
    print(f"Found {len(files)} files to merge.")

    for i, filepath in enumerate(files):
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                # In the first block, we extract metadata
                if i == 0 or not final_data.get("metadatos") or final_data["metadatos"] == "continúa":
                    if isinstance(data.get("metadatos"), dict):
                        final_data.update(data)
                
                if "propuestas" in data:
                    all_propuestas.extend(data["propuestas"])
            except Exception as e:
                print(f"Error reading {filepath}: {e}")

    # Ensure metadata is clean
    if "bloque_informacion" in final_data:
        final_data["bloque_informacion"] = {
            "rango_paginas": "Completo",
            "estado": "finalizado"
        }
    
    final_data["propuestas"] = all_propuestas
    
    output_path = os.path.join(data_dir, output_filename)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

    print(f"Successfully merged {len(all_propuestas)} proposals into {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge electoral program JSON batches.")
    parser.add_argument("--dir", default="./data", help="Directory containing JSON batches")
    parser.add_argument("--out", default="final_program.json", help="Output filename")
    parser.add_argument("--pattern", default="*.json", help="Pattern to match batch files")
    
    args = parser.parse_args()
    merge_json_blocks(args.dir, args.out, args.pattern)
