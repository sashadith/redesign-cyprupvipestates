import { Metadata } from "next";
import { getFileBySlug } from "@/sanity/sanity.utils";
import { SanityFile } from "@/types/sanityFile";
import { staticAlternates } from "@/lib/seo";

type Props = {
  params: { lang: string; slug: string };
};

// DocFile has a single, language-agnostic slug (no translationGroupId/language
// column — see prisma/schema.prisma) — the same file is reachable at
// /files/{slug}, /de/files/{slug}, /pl/files/{slug}, /ru/files/{slug}, so this
// is a fixed-path type like the listing roots, not a per-language-slug one.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = params;
  const file = await getFileBySlug(slug);
  const { canonical, languages } = staticAlternates(lang, ["files", slug]);
  return {
    title: file?.title,
    alternates: { canonical, languages },
  };
}

const FilePage = async ({ params }: Props) => {
  const { slug } = params;
  const file: SanityFile | null = await getFileBySlug(slug);

  if (!file) {
    return <div>File not found</div>;
  }

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file.asset.url);

  return (
    <main>
      <h1>{file.title}</h1>
      {isImage ? (
        <img
          src={file.file.asset.url}
          alt={file.title}
          style={{ maxWidth: "100%", height: "auto" }}
        />
      ) : (
        <iframe
          src={file.file.asset.url}
          width="100%"
          height="800px"
          style={{ border: "none" }}
          title={file.title}
        ></iframe>
      )}
    </main>
  );
};

export default FilePage;
