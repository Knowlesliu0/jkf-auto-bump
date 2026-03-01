from PIL import Image

def check_img(path):
    print(f"Checking {path}")
    try:
        img = Image.open(path)
        print(f"mode: {img.mode}, size: {img.size}")
        if img.mode in ('RGBA', 'LA'):
            extrema = img.getextrema()
            alpha_ex = extrema[-1]
            print(f"alpha extrema: {alpha_ex}")
            if alpha_ex[0] < 255:
                print("HAS transparency!")
            else:
                print("No transparent pixels found (all alpha=255)")
        else:
            print("No alpha channel")
    except Exception as e:
        print(f"Error: {e}")

check_img('d:/Projects/yuemu-spa/img/logo.png')
check_img('d:/Projects/yuemu-spa/img/1.png')
