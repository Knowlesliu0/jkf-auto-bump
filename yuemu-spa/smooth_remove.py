import numpy as np
from PIL import Image

def remove_white_bg_with_antialiasing(input_path, output_path):
    img = Image.open(input_path).convert('RGBA')
    arr = np.array(img).astype(float)
    
    # Calculate how close each pixel is to pure white
    # (255, 255, 255)
    
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    
    # distance from white (0-255) -> 0 means pure white, 255 means black
    # We can use the maximum of r,g,b to see how white it is.
    # Actually, min(r,g,b) tells us how dark it is.
    # We want white (255,255,255) to have alpha=0.
    # (r, g, b) are the blended colors: C = a*F + (1-a)*W -> C = a*F + (1-a)*255 -> 255 - C = a*(255 - F)
    # This means a >= (255 - C) / 255.
    
    # Let's use a simple threshold with smooth falloff
    # If a pixel is very close to white, we make it transparent.
    diff_from_white = (255 - r) + (255 - g) + (255 - b)
    
    # Thresholds
    # If sum of diffs < 10, it's basically white -> alpha 0
    # If sum of diffs > 50, it's foreground -> alpha 255
    # In between, blend alpha.
    
    alpha = np.clip((diff_from_white - 10) / 40.0, 0, 1) * 255
    
    # To fix color fringing, we subtract the white background contribution.
    # C = a*F + (1-a)*255 => F = (C - (1-a)*255) / a
    # Be careful with divide by zero
    alpha_norm = alpha / 255.0 + 1e-6
    
    new_r = np.clip((r - (1 - alpha_norm) * 255) / alpha_norm, 0, 255)
    new_g = np.clip((g - (1 - alpha_norm) * 255) / alpha_norm, 0, 255)
    new_b = np.clip((b - (1 - alpha_norm) * 255) / alpha_norm, 0, 255)
    
    new_arr = np.dstack((new_r, new_g, new_b, alpha)).astype(np.uint8)
    
    out_img = Image.fromarray(new_arr, 'RGBA')
    
    # Find bounding box of non-transparent pixels
    bbox = out_img.getbbox()
    if bbox:
        out_img = out_img.crop(bbox)
        
    out_img.save(output_path, 'PNG')

remove_white_bg_with_antialiasing('d:/Projects/yuemu-spa/img/1.png', 'd:/Projects/yuemu-spa/img/1-final.png')
remove_white_bg_with_antialiasing('d:/Projects/yuemu-spa/img/logo.png', 'd:/Projects/yuemu-spa/img/logo-final.png')
