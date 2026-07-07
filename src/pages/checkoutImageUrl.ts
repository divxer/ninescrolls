export function toCheckoutImageUrl(image: string | undefined, origin: string): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('//')) {
    return image;
  }
  return `${origin}${image.startsWith('/') ? image : `/${image}`}`;
}
