from PIL import Image

for file in ['d:/Projects/yuemu-spa/img/logo.jpg', 'd:/Projects/yuemu-spa/img/logo-transparent.png', 'd:/Projects/yuemu-spa/img/1.png', 'd:/Projects/yuemu-spa/img/1-transparent.png', 'd:/Projects/yuemu-spa/img/logo.png', 'd:/Projects/yuemu-spa/img/logo-transparent-2.png']:
    try:
        img = Image.open(file)
        if img.mode == 'RGBA':
            bbox = img.getbbox()
            print(f"{file} RGBA bbox: {bbox}")
        else:
            print(f"{file} RGB bbox is full image: {img.size}")
    except Exception as e:
        print(f"Error on {file}: {e}")
