import sys
import subprocess

def install_and_run():
    try:
        import rembg
    except ImportError:
        print("Installing rembg...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "rembg", "onnxruntime"])
        import rembg
    
    from PIL import Image
    from rembg import remove

    input_path = 'd:/Projects/yuemu-spa/img/logo.jpg'
    output_path = 'd:/Projects/yuemu-spa/img/logo-transparent.png'
    
    print(f"Processing {input_path}...")
    img = Image.open(input_path)
    output = remove(img)
    output.save(output_path, "PNG")
    print(f"Saved cleanly to {output_path}")

if __name__ == "__main__":
    install_and_run()
