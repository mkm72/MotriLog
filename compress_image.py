from PIL import Image

def compress_image(input_path, output_path, quality):
    """
    Opens an image (JPG or PNG) and saves it to output_path
    with the specified quality (1-100).
    """
    # Open the image
    with Image.open(input_path) as img:
        # Convert PNG with alpha to RGB (JPEG doesn't support transparency)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Save with specified quality
        img.save(output_path, quality=quality, optimize=True)
