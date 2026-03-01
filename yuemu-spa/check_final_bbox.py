from PIL import Image
for file in ['d:/Projects/yuemu-spa/img/1-final.png', 'd:/Projects/yuemu-spa/img/logo-final.png']:
    try:
        img = Image.open(file)
        print(f"{file} size: {img.size}, bbox: {img.getbbox()}")
    except Exception as e:
        print(e)
