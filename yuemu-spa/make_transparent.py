from PIL import Image

def remove_white_bg(input_path, output_path, tolerance=220):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()

    newData = []
    for item in data:
        # if the pixel is close to white (high R, G, B)
        if item[0] >= tolerance and item[1] >= tolerance and item[2] >= tolerance:
            # make it transparent but keep the color values (or white) to avoid dark fringes
            # We can do a smooth alpha blend if we want, but simple threshold first
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    
    # Optionally, crop the image to its non-transparent bounding box
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")

remove_white_bg('d:/Projects/yuemu-spa/img/logo.jpg', 'd:/Projects/yuemu-spa/img/logo-transparent.png')
