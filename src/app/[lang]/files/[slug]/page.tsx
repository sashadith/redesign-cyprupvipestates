import { getFileBySlug } from "@/sanity/sanity.utils";
import { SanityFile } from "@/types/sanityFile";

type Props = {
  params: { slug: string };
};

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
