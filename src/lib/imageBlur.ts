// Safe next/image blur props. Returns `placeholder="blur" + blurDataURL` ONLY when the
// image object carries an LQIP (attached by dereferenceAssets from blurStore); otherwise
// returns {} so spreading it is always safe — next/image throws if placeholder="blur" is
// set without a blurDataURL, so never set one without the other.
//
//   <Image src={urlFor(img).url()} {...blurProps(img)} ... />
//
// Accepts the image object ({ asset: { blurDataURL } }) or a raw blur string.
export function blurProps(
  img: any,
): { placeholder: "blur"; blurDataURL: string } | Record<string, never> {
  const b =
    typeof img === "string"
      ? img
      : img?.asset?.blurDataURL ?? img?.blurDataURL ?? null;
  return b ? { placeholder: "blur", blurDataURL: b } : {};
}
