// Guide article URL in one language (see ../../blog/guideRoute.tsx): poradniki.
import { GuidePage, guideMetadata, guideStaticParams } from "../../blog/guideRoute";

export const revalidate = 3600;
export const generateStaticParams = () => guideStaticParams("poradniki");
export const generateMetadata = (props: { params: { lang: string; slug: string } }) => guideMetadata(props, "poradniki");
export default function Page(props: { params: { lang: string; slug: string } }) {
  return GuidePage(props, "poradniki");
}
