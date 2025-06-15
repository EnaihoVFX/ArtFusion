import argparse
import torch
from diffusers import StableDiffusionImg2ImgPipeline
from PIL import Image

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompt', required=True, help='Text prompt for generation')
    parser.add_argument('--input', required=True, help='Input image path')
    parser.add_argument('--output', required=True, help='Output image path')
    parser.add_argument('--steps', type=int, default=30, help='Number of inference steps')
    parser.add_argument('--guidance', type=float, default=7.5, help='Guidance scale')
    parser.add_argument('--strength', type=float, default=0.8, help='Prompt strength')
    args = parser.parse_args()

    # Load the model
    model_id = "runwayml/stable-diffusion-v1-5"
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        model_id,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
    )
    
    if torch.cuda.is_available():
        pipe = pipe.to("cuda")

    # Load and process the input image
    init_image = Image.open(args.input).convert("RGB")
    init_image = init_image.resize((768, 768))

    # Generate the image
    image = pipe(
        prompt=args.prompt,
        image=init_image,
        num_inference_steps=args.steps,
        guidance_scale=args.guidance,
        strength=args.strength
    ).images[0]

    # Save the result
    image.save(args.output)

if __name__ == "__main__":
    main() 