#!/usr/bin/env python3
import json
import sys
import re

# Base64 VLQ encoding characters
BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
BASE64_MAP = {char: i for i, char in enumerate(BASE64_CHARS)}

def vlq_encode(value):
    """Encodes an integer into a Base64 VLQ string."""
    if value == 0:
        return BASE64_CHARS[0]

    # Convert to two's complement for negative numbers
    vlq = (abs(value) << 1) | (1 if value < 0 else 0)

    encoded = ""
    while vlq > 0:
        digit = vlq & 0b11111 # Get the 5 least significant bits
        vlq >>= 5
        if vlq > 0:
            digit |= 0b100000 # Set the continuation bit
        encoded += BASE64_CHARS[digit]

    return encoded

def parse_input_file(file_path):
    """
    Parses the custom comment-based source map definition file.

    Args:
        file_path (str): The path to the input file.

    Returns:
        A tuple containing:
        - list: A list of source file names.
        - str: The output file name.
        - list: A list of raw mapping entries.
        - set: A set of all unique names found.
    """
    sources = []
    output_file = None
    raw_mappings = []
    names = set()

    # Regex to parse the mapping entries like [<gen-col>,<src-idx>,<src-line>,<src-col>,<NAME>]
    mapping_regex = re.compile(r'\[(.*?)\]')

    try:
        with open(file_path, 'r') as f:
            for line in f:
                if not line.strip():
                    continue

                if line.startswith("INPUT:"):
                    sources.append(line.split(':', 1)[1].strip())
                elif line.startswith("OUTPUT:"):
                    output_file = line.split(':', 1)[1].strip()
                elif line.startswith("[-]"):
                    raw_mappings.append({'type': 'newline'})
                elif line.startswith("["):
                    match = mapping_regex.match(line)
                    if match:
                        content = match.group(1)
                        if not content: # Handles empty "[]"
                            continue
                        parts = [p.strip() for p in content.split(',')]

                        mapping = {'type': 'entry'}

                        # Convert parts to integers, handle potential name
                        int_parts = []
                        for i, part in enumerate(parts):
                            try:
                                # All but the last can be numbers
                                int_parts.append(int(part))
                            except ValueError:
                                # If conversion fails, it must be the name
                                if i == len(parts) - 1:
                                    name = part
                                    if name:
                                        names.add(name)
                                    mapping['name'] = name
                                else:
                                    print(f"Error: Invalid number '{part}' in mapping: {line}", file=sys.stderr)
                                    sys.exit(1)

                        mapping['values'] = int_parts
                        raw_mappings.append(mapping)

    except FileNotFoundError:
        print(f"Error: Input file not found at '{file_path}'", file=sys.stderr)
        sys.exit(1)

    return sources, output_file, raw_mappings, names

def process_mappings(raw_mappings, names_list):
    """
    Converts raw mappings into a Base64 VLQ encoded string.

    Args:
        raw_mappings (list): The list of parsed mapping entries.
        names_list (list): The sorted list of unique names.

    Returns:
        str: The final VLQ encoded mappings string.
    """
    # Create a map from name to its index for quick lookups
    name_to_index = {name: i for i, name in enumerate(names_list)}

    # Previous state for calculating relative deltas. These values are carried
    # over between segments unless a segment explicitly overrides them.
    prev_gen_col = 0
    prev_src_index = 0
    prev_src_line = 0
    prev_src_col = 0
    prev_name_index = 0

    generated_lines = []
    current_line_segments = []

    for mapping in raw_mappings:
        if mapping['type'] == 'newline':
            # A new line in the generated file is marked by a semicolon.
            generated_lines.append(",".join(current_line_segments))
            current_line_segments = []
            prev_gen_col = 0  # Generated column is reset for each new line.
            continue

        # It's a mapping entry
        values = mapping.get('values', [])
        name = mapping.get('name')

        # 1. Process the generated column (always present in a segment).
        # Convert from 1-indexed input to 0-indexed absolute.
        gen_col = values[0] - 1

        # Calculate delta from previous segment on this line.
        delta_gen_col = gen_col - prev_gen_col
        segment = vlq_encode(delta_gen_col)

        # Update the previous state for the next segment.
        prev_gen_col = gen_col

        # 2. Process optional fields: source file, source line/col, and name.
        # These are only present for segments with 4 or 5 values.
        if len(values) > 1:
            # Convert source positions from 1-indexed to 0-indexed.
            src_index = values[1] - 1
            src_line = values[2] - 1
            src_col = values[3] - 1

            # Calculate deltas from the previous state.
            delta_src_index = src_index - prev_src_index
            delta_src_line = src_line - prev_src_line
            delta_src_col = src_col - prev_src_col

            # Append encoded deltas to the segment.
            segment += vlq_encode(delta_src_index)
            segment += vlq_encode(delta_src_line)
            segment += vlq_encode(delta_src_col)

            # Update the previous source state for the next segment.
            prev_src_index = src_index
            prev_src_line = src_line
            prev_src_col = src_col

            # A 5th value indicates a name is present.
            if name:
                name_index = name_to_index[name]
                delta_name_index = name_index - prev_name_index
                segment += vlq_encode(delta_name_index)

                # Update the previous name state for the next segment.
                prev_name_index = name_index

        current_line_segments.append(segment)

    # Add the last line's segments if any exist.
    if current_line_segments:
        generated_lines.append(",".join(current_line_segments))

    # Join all encoded lines with semicolons.
    return ";".join(generated_lines)

def main():
    """Main function to run the script."""
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <input-file>", file=sys.stderr)
        sys.exit(1)

    input_file_path = sys.argv[1]

    # 1. Parse the input file to get the basic components.
    sources, output_file, raw_mappings, names_set = parse_input_file(input_file_path)

    # Sort names to get a deterministic order for the "names" array.
    names_list = sorted(list(names_set))

    # 2. Process the raw mappings to generate the VLQ string.
    mappings_str = process_mappings(raw_mappings, names_list)

    # 3. Construct the final source map JSON object.
    source_map = {
        "version": 3,
        "file": output_file or "",
        "sourceRoot": "",
        "sources": sources,
        "names": names_list,
        "mappings": mappings_str
    }

    # 4. Print the JSON to standard output with indentation.
    print(json.dumps(source_map, indent=2))

if __name__ == "__main__":
    main()
