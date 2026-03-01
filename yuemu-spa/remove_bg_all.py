import sys

def run_rembg():
    from PIL import Image
    from rembg import remove

    input_path = 'd:/Projects/yuemu-spa/img/logo.png'
    output_path = 'd:/Projects/yuemu-spa/img/logo-transparent-2.png'
    
    print(f"Processing {input_path}...")
    img = Image.open(input_path)
    output = remove(img)
    output.save(output_path, "PNG")
    print(f"Saved cleanly to {output_path}")

    input_path = 'd:/Projects/yuemu-spa/img/1.png'
    output_path = 'd:/Projects/yuemu-spa/img/1-transparent.png'
    
    print(f"Processing {input_path}...")
    img = Image.open(input_path)
    output = remove(img)
    output.save(output_path, "PNG")
    print(f"Saved cleanly to {output_path}")

if __name__ == "__main__":
    run_rembg()
