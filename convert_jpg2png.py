from PIL import Image

def convert_jpg2png(jpg_input_path, png_output_path):
    # Open the JPG image
    with Image.open(jpg_input_path) as img:
        # Save as PNG
        img.save(png_output_path, 'PNG')
